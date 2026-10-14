import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { release } from "node:os";
import { inflateSync } from "node:zlib";
import { PerspectiveCamera, REVISION, Vector3 } from "three";
import { expect, test, type Browser, type Locator, type Page, type TestInfo } from "@playwright/test";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import architectureRiseGeometry from "../../scenes/architectureRiseGeometry";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../../scenes/presentation/viewCameraAnatomy";
import { toWorld } from "../../render/rttUtils";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";

const waitForMountedObserver = async (
  page: Page,
  sceneId = "view-camera-anatomy",
) => {
  const observer = page.getByTestId("scene-canvas");
  await expect(observer.locator("canvas")).toHaveCount(1);
  await expect(observer).toHaveAttribute("data-observer-renderer-generation", /^\d+$/);
  await expect(observer).toHaveAttribute("data-observer-renderer-request", /^(webgl|webgpu-pilot)$/);
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", {
    timeout: 60_000,
  });
  await expect(observer).toHaveAttribute(
    "data-observer-renderer-family",
    /^(webgl-renderer|webgpu-renderer)$/,
    { timeout: 60_000 },
  );
  await expect(observer).toHaveAttribute("data-scene-subject-id", sceneId);
  return observer;
};

const navigateWithinSimulator = async (page: Page, path: string) => {
  await page.evaluate((nextPath) => {
    window.history.pushState(window.history.state, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }, path);
};

const readObserverAttributes = async (observer: Locator) => observer.evaluate((element) =>
  Object.fromEntries(
    Array.from(element.attributes)
      .filter((attribute) => attribute.name.startsWith("data-observer-"))
      .map((attribute) => [attribute.name, attribute.value]),
  ),
);

const expectNativeWebGpuMount = (attributes: Record<string, string>) => {
  expect(attributes["data-observer-renderer-attempt"]).toBe("webgpu");
  expect(attributes["data-observer-renderer-family"]).toBe("webgpu-renderer");
  expect(attributes["data-observer-execution-backend"]).toBe("webgpu");
  expect(attributes["data-observer-application-fallback"]).toBe("none");
  expect(attributes["data-observer-renderer-failure-stage"]).toBeUndefined();
  expect(attributes["data-observer-webgpu-initialization-attempts"]).toBe("1");
};

const expectResolvedWebGpuPilotOutcome = (attributes: Record<string, string>) => {
  expect(attributes["data-observer-webgpu-initialization-attempts"]).toBe("1");
  if (attributes["data-observer-renderer-family"] === "webgpu-renderer") {
    expect(attributes["data-observer-renderer-attempt"]).toBe("webgpu");
    expect(attributes["data-observer-execution-backend"]).toMatch(/^(webgpu|webgl2-fallback)$/);
    expect(attributes["data-observer-application-fallback"]).toBe("none");
    expect(attributes["data-observer-renderer-failure-stage"]).toBeUndefined();
  } else {
    expect(attributes["data-observer-renderer-family"]).toBe("webgl-renderer");
    expect(attributes["data-observer-renderer-attempt"]).toBe("webgl");
    expect(attributes["data-observer-execution-backend"]).toBe("webgl2");
    expect(attributes["data-observer-application-fallback"]).toBe("app-webgl");
    expect(attributes["data-observer-renderer-failure-stage"]).toBe("initialization");
  }
};

const attachMountedObserverEvidence = async (
  testInfo: TestInfo,
  observer: Locator,
) => {
  const attributes = await readObserverAttributes(observer);
  await testInfo.attach("mounted-observer-capabilities.json", {
    body: JSON.stringify(attributes, null, 2),
    contentType: "application/json",
  });
  return attributes;
};

type CanvasPixelEvidence = Readonly<{
  width: number;
  height: number;
  distinctColorBuckets: number;
  foregroundPixelSamples: number;
  contentful: boolean;
}>;

type PixelRegion = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

type SubjectRenderingEvidence = Readonly<{
  status: "verified" | "missing" | "unverified";
  method: "registered-subject-visibility-differential";
  projectedSubjectRegion: PixelRegion | null;
  subjectVisibleVsHidden: {
    changedPixels: number;
    changedPixelsInProjectedRegion: number;
    changedPixelsOutsideProjectedRegion: number;
    changedPixelFractionInProjectedRegion: number;
    minimumChangedPixels: number;
    hiddenCanvasContentful: boolean;
  };
  restoration: {
    changedPixelsFromInitialAfterRestore: number;
    changedPixelsFromHiddenAfterRestore: number;
  };
  observerViewState: ObserverViewState;
  captureViewStateStable: boolean;
  mountedBackendStable: boolean;
}>;

type DecodedPng = Readonly<{
  width: number;
  height: number;
  channels: 3 | 4;
  pixels: Buffer;
}>;

const paethPredictor = (left: number, above: number, upperLeft: number): number => {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
};

const decodePngScreenshot = (png: Buffer): DecodedPng => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!png.subarray(0, 8).equals(signature)) throw new Error("Observer capture is not PNG");

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const imageData: Buffer[] = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
    } else if (type === "IDAT") {
      imageData.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }

  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!width || !height || bitDepth !== 8 || (channels !== 3 && channels !== 4) || interlace !== 0) {
    throw new Error("Unsupported Playwright PNG screenshot format");
  }

  const bytesPerPixel = channels;
  const rowBytes = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(imageData));
  const pixels = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y += 1) {
    const sourceRow = y * (rowBytes + 1);
    const filter = inflated[sourceRow] ?? 0;
    const targetRow = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[sourceRow + 1 + x] ?? 0;
      const left = x >= bytesPerPixel ? pixels[targetRow + x - bytesPerPixel] ?? 0 : 0;
      const above = y > 0 ? pixels[targetRow - rowBytes + x] ?? 0 : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[targetRow - rowBytes + x - bytesPerPixel] ?? 0
        : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
        : filter === 2 ? above
        : filter === 3 ? Math.floor((left + above) / 2)
        : filter === 4 ? paethPredictor(left, above, upperLeft)
        : Number.NaN;
      if (!Number.isFinite(predictor)) throw new Error(`Unsupported PNG row filter ${filter}`);
      pixels[targetRow + x] = (raw + predictor) & 0xff;
    }
  }
  return { width, height, channels, pixels };
};

const ANATOMY_VISIBILITY_EVENT = "vcs:observer-verification:anatomy-visibility";
const ANATOMY_VERIFICATION_VIEW_EVENT = "vcs:observer-verification:anatomy-view";

const setAnatomySubjectVisible = async (
  page: Page,
  observer: Locator,
  visible: boolean,
) => {
  await observer.evaluate((element, { nextVisible, eventName }) => {
    element.dispatchEvent(
      new CustomEvent(eventName, { detail: nextVisible }),
    );
  }, { nextVisible: visible, eventName: ANATOMY_VISIBILITY_EVENT });
  await expect(observer).toHaveAttribute(
    "data-observer-test-anatomy-subject-visible",
    String(visible),
  );
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
};

const projectAnatomySubjectRegion = (
  width: number,
  height: number,
  viewState: ObserverViewState,
): PixelRegion | null => {
  if (!viewState.position || !viewState.target) return null;
  const position = viewState.position.split(",").map(Number);
  const target = viewState.target.split(",").map(Number);
  if (
    position.length !== 3 || target.length !== 3 ||
    !position.every(Number.isFinite) || !target.every(Number.isFinite)
  ) {
    return null;
  }

  const camera = new PerspectiveCamera(45, width / height, 0.01, 200);
  camera.position.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
  camera.up.set(0, 1, 0);
  camera.lookAt(target[0] ?? 0, target[1] ?? 0, target[2] ?? 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const bounds = VIEW_CAMERA_ANATOMY_PRESENTATION.geometry.bounds;
  const projectedCorners: Array<{ x: number; y: number }> = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new Vector3(toWorld(x), toWorld(y), toWorld(z)).project(camera);
        if (point.z < -1 || point.z > 1) continue;
        projectedCorners.push({
          x: (point.x + 1) * 0.5 * width,
          y: (1 - point.y) * 0.5 * height,
        });
      }
    }
  }
  if (projectedCorners.length < 2) return null;

  const padding = 8;
  const left = Math.max(0, Math.floor(Math.min(...projectedCorners.map(({ x }) => x)) - padding));
  const top = Math.max(0, Math.floor(Math.min(...projectedCorners.map(({ y }) => y)) - padding));
  const right = Math.min(width, Math.ceil(Math.max(...projectedCorners.map(({ x }) => x)) + padding));
  const bottom = Math.min(height, Math.ceil(Math.max(...projectedCorners.map(({ y }) => y)) + padding));
  return right > left && bottom > top ? { left, top, right, bottom } : null;
};

const architectureRiseFocusChartBounds = () => {
  const boxes = [
    ...architectureRiseGeometry.getArchitectureFocusChartCells(),
    ...architectureRiseGeometry.getArchitectureFocusChartBars(),
  ];
  const minX = Math.min(...boxes.map(({ x, width }) => x - width / 2));
  const minY = Math.min(...boxes.map(({ y, height }) => y - height / 2));
  const minZ = Math.min(...boxes.map(({ z, depth }) => z - depth / 2));
  const maxX = Math.max(...boxes.map(({ x, width }) => x + width / 2));
  const maxY = Math.max(...boxes.map(({ y, height }) => y + height / 2));
  const maxZ = Math.max(...boxes.map(({ z, depth }) => z + depth / 2));
  return {
    min: [toWorld(minX), toWorld(minY), toWorld(minZ)] as const,
    max: [toWorld(maxX), toWorld(maxY), toWorld(maxZ)] as const,
  };
};

const projectWorldBoundsRegion = (
  width: number,
  height: number,
  viewState: ObserverViewState,
  bounds: Readonly<{ min: readonly [number, number, number]; max: readonly [number, number, number] }>,
): PixelRegion | null => {
  if (!viewState.position || !viewState.target) return null;
  const position = viewState.position.split(",").map(Number);
  const target = viewState.target.split(",").map(Number);
  if (
    position.length !== 3 || target.length !== 3 ||
    !position.every(Number.isFinite) || !target.every(Number.isFinite)
  ) return null;
  const camera = new PerspectiveCamera(45, width / height, 0.01, 200);
  camera.position.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
  camera.up.set(0, 1, 0);
  camera.lookAt(target[0] ?? 0, target[1] ?? 0, target[2] ?? 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const corners: Vector3[] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const point = new Vector3(x, y, z).project(camera);
        if (point.z < -1 || point.z > 1) continue;
        corners.push(point);
      }
    }
  }
  if (corners.length < 2) return null;
  const padding = 6;
  const left = Math.max(0, Math.floor(Math.min(...corners.map((point) => (point.x + 1) * width / 2)) - padding));
  const right = Math.min(width, Math.ceil(Math.max(...corners.map((point) => (point.x + 1) * width / 2)) + padding));
  const top = Math.max(0, Math.floor(Math.min(...corners.map((point) => (1 - point.y) * height / 2)) - padding));
  const bottom = Math.min(height, Math.ceil(Math.max(...corners.map((point) => (1 - point.y) * height / 2)) + padding));
  return right > left && bottom > top ? { left, top, right, bottom } : null;
};

type MaterialColorSample = Readonly<{
  referencePixelCount: number;
  meanAbsoluteRgbDelta: number | null;
  maximumChannelDelta: number | null;
}>;

const architectureRiseOpticalAxisPolyline = (): Vector3[] => {
  const opticsState = deriveOpticsState({
    ...DEFAULT_CAMERA_STATE,
    ...architectureRiseScene.cameraPreset,
    activeSceneId: architectureRiseScene.id,
  }, architectureRiseScene);
  const toWorldVector = (point: { x: number; y: number; z: number }) =>
    new Vector3(toWorld(point.x), toWorld(point.y), toWorld(point.z));
  const filmCenter = toWorldVector(opticsState.filmCenterWorld);
  const lensCenter = toWorldVector(opticsState.lensCenterWorld);
  const focusCenter = opticsState.focusPlane?.point
    ? toWorldVector(opticsState.focusPlane.point)
    : lensCenter.clone().addScaledVector(
        toWorldVector(opticsState.opticalAxis.direction).normalize(),
        toWorld(10_000),
      );
  const forwardPoint = lensCenter.clone().addScaledVector(
    focusCenter.clone().sub(lensCenter).normalize(),
    toWorld(10_000),
  );
  return [filmCenter, lensCenter, focusCenter, forwardPoint];
};

const compareToneMappedMaterialPixels = (
  webglFocusChartScreenshot: Buffer,
  webgpuFocusChartScreenshot: Buffer,
  webglOpticalGeometryScreenshot: Buffer,
  webgpuOpticalGeometryScreenshot: Buffer,
  focusChartRegion: PixelRegion,
  opticalAxisViewState: ObserverViewState,
  opticalAxisPolyline: readonly Vector3[],
) => {
  const chartReference = decodePngScreenshot(webglFocusChartScreenshot);
  const chartCandidate = decodePngScreenshot(webgpuFocusChartScreenshot);
  const lineReference = decodePngScreenshot(webglOpticalGeometryScreenshot);
  const lineCandidate = decodePngScreenshot(webgpuOpticalGeometryScreenshot);
  const dimensionsMatch = (first: DecodedPng, second: DecodedPng) =>
    first.width === second.width && first.height === second.height && first.channels === second.channels;
  if (!dimensionsMatch(chartReference, chartCandidate) || !dimensionsMatch(lineReference, lineCandidate)) {
    throw new Error("Matched WebGL/WebGPU material captures have different dimensions");
  }

  const sample = (
    reference: DecodedPng,
    candidate: DecodedPng,
    region: PixelRegion,
    matches: (red: number, green: number, blue: number) => boolean,
  ): MaterialColorSample => {
    const left = Math.max(0, Math.floor(region.left));
    const top = Math.max(0, Math.floor(region.top));
    const right = Math.min(reference.width, Math.ceil(region.right));
    const bottom = Math.min(reference.height, Math.ceil(region.bottom));
    let referencePixelCount = 0;
    let deltaTotal = 0;
    let maximumChannelDelta = 0;
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const offset = (y * reference.width + x) * reference.channels;
        const red = reference.pixels[offset] ?? 0;
        const green = reference.pixels[offset + 1] ?? 0;
        const blue = reference.pixels[offset + 2] ?? 0;
        if (!matches(red, green, blue)) continue;
        const channelDeltas = [0, 1, 2].map((channel) =>
          Math.abs((reference.pixels[offset + channel] ?? 0) - (candidate.pixels[offset + channel] ?? 0)),
        );
        referencePixelCount += 1;
        deltaTotal += channelDeltas.reduce((sum, value) => sum + value, 0) / 3;
        maximumChannelDelta = Math.max(maximumChannelDelta, ...channelDeltas);
      }
    }
    return {
      referencePixelCount,
      meanAbsoluteRgbDelta: referencePixelCount ? deltaTotal / referencePixelCount : null,
      maximumChannelDelta: referencePixelCount ? maximumChannelDelta : null,
    };
  };
  const redLike = (red: number, green: number, blue: number) =>
    red > 190 && green < 90 && blue < 90 && red > green * 1.25 && red > blue * 1.25;

  const viewPosition = opticalAxisViewState.position?.split(",").map(Number) ?? [];
  const viewTarget = opticalAxisViewState.target?.split(",").map(Number) ?? [];
  if (viewPosition.length !== 3 || viewTarget.length !== 3) {
    throw new Error("The matched optical-axis view is missing a camera position or orbit target");
  }
  const lineCamera = new PerspectiveCamera(45, lineReference.width / lineReference.height, 0.01, 200);
  lineCamera.position.set(viewPosition[0] ?? 0, viewPosition[1] ?? 0, viewPosition[2] ?? 0);
  lineCamera.up.set(0, 1, 0);
  lineCamera.lookAt(viewTarget[0] ?? 0, viewTarget[1] ?? 0, viewTarget[2] ?? 0);
  lineCamera.updateProjectionMatrix();
  lineCamera.updateMatrixWorld(true);
  const projectedOpticalAxisPath = opticalAxisPolyline.map((point) => {
    const projected = point.clone().project(lineCamera);
    return {
      x: (projected.x + 1) * lineReference.width / 2,
      y: (1 - projected.y) * lineReference.height / 2,
      depth: projected.z,
    };
  });
  const pathSegments = projectedOpticalAxisPath.slice(1).flatMap((point, index) => {
    const previous = projectedOpticalAxisPath[index];
    return previous && previous.depth >= -1 && previous.depth <= 1 && point.depth >= -1 && point.depth <= 1
      ? [{ start: previous, end: point }]
      : [];
  });
  const pathPadding = 4;
  const pathBounds = {
    left: Math.max(0, Math.floor(Math.min(...projectedOpticalAxisPath.map((point) => point.x)) - pathPadding)),
    top: Math.max(0, Math.floor(Math.min(...projectedOpticalAxisPath.map((point) => point.y)) - pathPadding)),
    right: Math.min(lineReference.width, Math.ceil(Math.max(...projectedOpticalAxisPath.map((point) => point.x)) + pathPadding)),
    bottom: Math.min(lineReference.height, Math.ceil(Math.max(...projectedOpticalAxisPath.map((point) => point.y)) + pathPadding)),
  };
  const linePathSample = (() => {
    let referencePixelCount = 0;
    let deltaTotal = 0;
    let maximumChannelDelta = 0;
    for (let y = pathBounds.top; y < pathBounds.bottom; y += 1) {
      for (let x = pathBounds.left; x < pathBounds.right; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const onProjectedLine = pathSegments.some(({ start, end }) => {
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const lengthSquared = dx * dx + dy * dy;
          const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - start.x) * dx + (py - start.y) * dy) / lengthSquared));
          return Math.hypot(px - (start.x + t * dx), py - (start.y + t * dy)) <= 1.5;
        });
        if (!onProjectedLine) continue;
        const offset = (y * lineReference.width + x) * lineReference.channels;
        const red = lineReference.pixels[offset] ?? 0;
        const green = lineReference.pixels[offset + 1] ?? 0;
        const blue = lineReference.pixels[offset + 2] ?? 0;
        if (!(red + 12 < green && green + 2 < blue && blue > 40)) continue;
        const deltas = [0, 1, 2].map((channel) =>
          Math.abs((lineReference.pixels[offset + channel] ?? 0) - (lineCandidate.pixels[offset + channel] ?? 0)),
        );
        referencePixelCount += 1;
        deltaTotal += deltas.reduce((sum, value) => sum + value, 0) / 3;
        maximumChannelDelta = Math.max(maximumChannelDelta, ...deltas);
      }
    }
    return {
      referencePixelCount,
      meanAbsoluteRgbDelta: referencePixelCount ? deltaTotal / referencePixelCount : null,
      maximumChannelDelta: referencePixelCount ? maximumChannelDelta : null,
    } satisfies MaterialColorSample;
  })();

  return {
    dimensions: { width: chartReference.width, height: chartReference.height },
    focusChartRegion,
    focusChart: {
      darkBasic: sample(chartReference, chartCandidate, focusChartRegion, (red, green, blue) =>
        !redLike(red, green, blue) && red < 55 && green < 75 && blue < 100,
      ),
      lightBasic: sample(chartReference, chartCandidate, focusChartRegion, (red, green, blue) =>
        red > 180 && green > 180 && blue > 180 &&
        Math.max(red, green, blue) - Math.min(red, green, blue) < 48,
      ),
      redCrosshairBasic: sample(chartReference, chartCandidate, focusChartRegion, redLike),
    },
    opticalAxisLineBasic: linePathSample,
    projectedOpticalAxisPath,
    opticalAxisPixelRegion: pathBounds,
  };
};

const compareSubjectFrames = (
  initial: Buffer,
  hidden: Buffer,
  restored: Buffer,
  region: PixelRegion | null,
) => {
  const first = decodePngScreenshot(initial);
  const second = decodePngScreenshot(hidden);
  const third = decodePngScreenshot(restored);
  if (
    first.width !== second.width || first.height !== second.height || first.channels !== second.channels ||
    first.width !== third.width || first.height !== third.height || first.channels !== third.channels
  ) {
    throw new Error("Observer subject captures changed dimensions");
  }

  const pixelCount = first.width * first.height;
  const projectedRegion = region
    ? {
        left: Math.max(0, Math.min(first.width, Math.floor(region.left))),
        top: Math.max(0, Math.min(first.height, Math.floor(region.top))),
        right: Math.max(0, Math.min(first.width, Math.ceil(region.right))),
        bottom: Math.max(0, Math.min(first.height, Math.ceil(region.bottom))),
      }
    : null;
  const visibleVsHidden = {
    changedPixels: 0,
    changedPixelsInProjectedRegion: 0,
    changedPixelsOutsideProjectedRegion: 0,
    changedPixelFractionInProjectedRegion: 0,
  };
  let changedPixelsFromInitialAfterRestore = 0;
  let changedPixelsFromHiddenAfterRestore = 0;
  const pixelDiffers = (a: Buffer, b: Buffer, offset: number) =>
    Math.max(
      Math.abs((a[offset] ?? 0) - (b[offset] ?? 0)),
      Math.abs((a[offset + 1] ?? 0) - (b[offset + 1] ?? 0)),
      Math.abs((a[offset + 2] ?? 0) - (b[offset + 2] ?? 0)),
    ) >= 12;

  for (let y = 0; y < first.height; y += 1) {
    for (let x = 0; x < first.width; x += 1) {
      const offset = (y * first.width + x) * first.channels;
      if (pixelDiffers(first.pixels, second.pixels, offset)) {
        visibleVsHidden.changedPixels += 1;
        const inside = projectedRegion !== null &&
          x >= projectedRegion.left && x < projectedRegion.right &&
          y >= projectedRegion.top && y < projectedRegion.bottom;
        if (inside) visibleVsHidden.changedPixelsInProjectedRegion += 1;
        else visibleVsHidden.changedPixelsOutsideProjectedRegion += 1;
      }
      if (pixelDiffers(first.pixels, third.pixels, offset)) {
        changedPixelsFromInitialAfterRestore += 1;
      }
      if (pixelDiffers(second.pixels, third.pixels, offset)) {
        changedPixelsFromHiddenAfterRestore += 1;
      }
    }
  }
  visibleVsHidden.changedPixelFractionInProjectedRegion =
    visibleVsHidden.changedPixels > 0
      ? visibleVsHidden.changedPixelsInProjectedRegion / visibleVsHidden.changedPixels
      : 0;

  const colorBuckets = new Set<string>();
  let mostCommonColorCount = 0;
  const colorCounts = new Map<string, number>();
  for (let offset = 0; offset < second.pixels.length; offset += second.channels) {
    const color = `${(second.pixels[offset] ?? 0) >> 4}:${(second.pixels[offset + 1] ?? 0) >> 4}:${(second.pixels[offset + 2] ?? 0) >> 4}`;
    colorBuckets.add(color);
    const count = (colorCounts.get(color) ?? 0) + 1;
    colorCounts.set(color, count);
    mostCommonColorCount = Math.max(mostCommonColorCount, count);
  }

  return {
    width: first.width,
    height: first.height,
    pixelCount,
    visibleVsHidden,
    changedPixelsFromInitialAfterRestore,
    changedPixelsFromHiddenAfterRestore,
    hiddenCanvasContentful:
      colorBuckets.size >= 12 && pixelCount - mostCommonColorCount >= 20,
  };
};

const captureObserverCanvasScreenshot = async (
  page: Page,
  canvas: Locator,
  path?: string,
): Promise<Buffer> => {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Observer canvas has no visible screenshot bounds");
  return page.screenshot({
    path,
    clip: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
    animations: "disabled",
  });
};

const captureObserverFramebufferScreenshot = async (page: Page, canvas: Locator): Promise<Buffer> => {
  // The page screenshot is clipped to the canvas because WebGPU does not expose
  // a public readback path for the presented canvas texture. Temporarily hide
  // only overlapping DOM control wrappers/buttons so page chrome cannot enter
  // the comparison; the Canvas, scene, camera, and renderer remain untouched.
  await canvas.evaluate((element) => {
    const canvasRect = element.getBoundingClientRect();
    const captureChrome = new Set(document.querySelectorAll<HTMLElement>(".scene-overlay-controls-wrap, button"));
    for (const element of captureChrome) {
      const bounds = element.getBoundingClientRect();
      const overlaps = bounds.left < canvasRect.right && bounds.right > canvasRect.left &&
        bounds.top < canvasRect.bottom && bounds.bottom > canvasRect.top;
      if (!overlaps) continue;
      element.dataset.observerCapturePreviousStyle = element.getAttribute("style") ?? "__no_style__";
      element.style.visibility = "hidden";
    }
  });
  try {
    return await captureObserverCanvasScreenshot(page, canvas);
  } finally {
    await page.evaluate(() => {
      for (const element of document.querySelectorAll<HTMLElement>("[data-observer-capture-previous-style]")) {
        const previousStyle = element.dataset.observerCapturePreviousStyle;
        if (previousStyle === "__no_style__") element.removeAttribute("style");
        else if (previousStyle !== undefined) element.setAttribute("style", previousStyle);
        delete element.dataset.observerCapturePreviousStyle;
      }
    });
  }
};

const captureSubjectRenderingEvidence = async (
  page: Page,
  observer: Locator,
  testInfo: TestInfo,
): Promise<SubjectRenderingEvidence> => {
  await expect(observer).toHaveAttribute(
    "data-observer-test-anatomy-visibility-hook",
    "ready",
  );

  const canvas = observer.locator("canvas");
  const initialViewState = await readObserverViewState(observer);
  const initialAttributes = await readObserverAttributes(observer);
  const initial = await captureObserverCanvasScreenshot(
    page,
    canvas,
    "test-results/observer-subject-before-hide.png",
  );
  const imageSize = decodePngScreenshot(initial);
  const projectedSubjectRegion = projectAnatomySubjectRegion(
    imageSize.width,
    imageSize.height,
    initialViewState,
  );

  let hidden = initial;
  let restored = initial;
  try {
    await setAnatomySubjectVisible(page, observer, false);
    hidden = await captureObserverCanvasScreenshot(
      page,
      canvas,
      "test-results/observer-subject-hidden-negative-control.png",
    );
  } finally {
    await setAnatomySubjectVisible(page, observer, true);
    restored = await captureObserverCanvasScreenshot(
      page,
      canvas,
      "test-results/observer-subject-restored.png",
    );
  }

  const pixelEvidence = compareSubjectFrames(
    initial,
    hidden,
    restored,
    projectedSubjectRegion,
  );
  const finalViewState = await readObserverViewState(observer);
  const finalAttributes = await readObserverAttributes(observer);
  const changedPixels = pixelEvidence.visibleVsHidden.changedPixels;
  const minimumChangedPixels = Math.max(128, Math.ceil(pixelEvidence.pixelCount * 0.0025));
  const contributionVerified =
    projectedSubjectRegion !== null &&
    pixelEvidence.hiddenCanvasContentful &&
    changedPixels >= minimumChangedPixels &&
    pixelEvidence.visibleVsHidden.changedPixelsInProjectedRegion >= 128 &&
    pixelEvidence.visibleVsHidden.changedPixelFractionInProjectedRegion >= 0.6 &&
    pixelEvidence.changedPixelsFromInitialAfterRestore <= Math.ceil(pixelEvidence.pixelCount * 0.005);
  const captureViewStateStable =
    vectorsMatch(initialViewState.position, finalViewState.position) &&
    vectorsMatch(initialViewState.target, finalViewState.target);
  const mountedBackendStable =
    initialAttributes["data-observer-renderer-family"] ===
      finalAttributes["data-observer-renderer-family"] &&
    initialAttributes["data-observer-execution-backend"] ===
      finalAttributes["data-observer-execution-backend"] &&
    initialAttributes["data-observer-application-fallback"] ===
      finalAttributes["data-observer-application-fallback"] &&
    initialAttributes["data-observer-webgpu-initialization-attempts"] ===
      finalAttributes["data-observer-webgpu-initialization-attempts"];

  const evidence: SubjectRenderingEvidence = {
    status:
      projectedSubjectRegion !== null && captureViewStateStable && mountedBackendStable
        ? contributionVerified ? "verified" : "missing"
        : "unverified",
    method: "registered-subject-visibility-differential",
    projectedSubjectRegion,
    subjectVisibleVsHidden: {
      ...pixelEvidence.visibleVsHidden,
      minimumChangedPixels,
      hiddenCanvasContentful: pixelEvidence.hiddenCanvasContentful,
    },
    restoration: {
      changedPixelsFromInitialAfterRestore:
        pixelEvidence.changedPixelsFromInitialAfterRestore,
      changedPixelsFromHiddenAfterRestore:
        pixelEvidence.changedPixelsFromHiddenAfterRestore,
    },
    observerViewState: initialViewState,
    captureViewStateStable,
    mountedBackendStable,
  };

  await testInfo.attach("observer-subject-before-hide.png", {
    body: initial,
    contentType: "image/png",
  });
  await testInfo.attach("observer-subject-hidden-negative-control.png", {
    body: hidden,
    contentType: "image/png",
  });
  await testInfo.attach("observer-subject-restored.png", {
    body: restored,
    contentType: "image/png",
  });
  return evidence;
};

const analyzeCanvasScreenshot = (screenshot: Buffer): CanvasPixelEvidence => {
  const image = decodePngScreenshot(screenshot);
  const colors = new Map<string, number>();
  for (let index = 0; index < image.pixels.length; index += image.channels) {
    const red = image.pixels[index] ?? 0;
    const green = image.pixels[index + 1] ?? 0;
    const blue = image.pixels[index + 2] ?? 0;
    const bucket = `${red >> 4}:${green >> 4}:${blue >> 4}`;
    colors.set(bucket, (colors.get(bucket) ?? 0) + 1);
  }

  const backgroundPixelSamples = Math.max(...colors.values());
  const foregroundPixelSamples = image.width * image.height - backgroundPixelSamples;

  return {
    width: image.width,
    height: image.height,
    distinctColorBuckets: colors.size,
    foregroundPixelSamples,
    contentful: colors.size >= 12 && foregroundPixelSamples >= 20,
  };
};

type ObserverViewState = Readonly<{
  position: string | null;
  target: string | null;
}>;

type OverlayVisibility = Readonly<{
  focusPlane: boolean;
  dofRegion: boolean;
  opticalGeometry: boolean;
}>;

const readObserverViewState = async (observer: Locator): Promise<ObserverViewState> => ({
  position: await observer.getAttribute("data-observer-camera-position"),
  target: await observer.getAttribute("data-orbit-target"),
});

const readObserverCaptureConfiguration = async (page: Page, observer: Locator) => {
  const canvas = observer.locator("canvas");
  return {
    viewport: await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
    devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
    canvas: await canvas.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        cssWidth: bounds.width,
        cssHeight: bounds.height,
        backingWidth: (element as HTMLCanvasElement).width,
        backingHeight: (element as HTMLCanvasElement).height,
      };
    }),
  };
};

const readOverlayVisibility = async (observer: Locator): Promise<OverlayVisibility> => {
  const values = await Promise.all([
    observer.getAttribute("data-focus-overlay-visible"),
    observer.getAttribute("data-dof-overlay-visible"),
    observer.getAttribute("data-optical-geometry-visible"),
  ]);
  if (values.some((value) => value !== "true" && value !== "false")) {
    throw new Error("The Observer overlay state is unavailable");
  }
  return {
    focusPlane: values[0] === "true",
    dofRegion: values[1] === "true",
    opticalGeometry: values[2] === "true",
  };
};

const waitForRenderFrames = async (page: Page) => page.evaluate(() => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
}));

const setOverlayVisibility = async (
  page: Page,
  observer: Locator,
  label: "Focus plane" | "DOF region" | "Optical geometry",
  enabled: boolean,
) => {
  const choices = page.locator('[data-testid="scene-overlay-inline"], [data-testid="scene-overlay-collapsed"]');
  if (!(await choices.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "View overlays", exact: true }).click();
    await expect(choices).toBeVisible();
  }
  const button = page.getByRole("button", { name: new RegExp(`^(Show|Hide) ${label}$`, "i") });
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-pressed")) !== String(enabled)) await button.click();
  await expect(button).toHaveAttribute("aria-pressed", String(enabled));
  const attribute = label === "Focus plane"
    ? "data-focus-overlay-visible"
    : label === "DOF region"
      ? "data-dof-overlay-visible"
      : "data-optical-geometry-visible";
  await expect(observer).toHaveAttribute(attribute, String(enabled));
  await waitForRenderFrames(page);
};

const applyOverlayVisibility = async (
  page: Page,
  observer: Locator,
  visibility: OverlayVisibility,
) => {
  await setOverlayVisibility(page, observer, "Focus plane", visibility.focusPlane);
  await setOverlayVisibility(page, observer, "DOF region", visibility.dofRegion);
  await setOverlayVisibility(page, observer, "Optical geometry", visibility.opticalGeometry);
};

const setObserverViewFocus = async (page: Page, observer: Locator, focus: "scene" | "camera") => {
  const label = focus === "scene" ? "Scene" : "Camera";
  const button = page.getByRole("button", { name: label, exact: true });
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(observer).toHaveAttribute("data-view-focus", focus);
  await waitForRenderFrames(page);
};

const collapseOverlayControls = async (page: Page) => {
  const choices = page.locator('[data-testid="scene-overlay-inline"], [data-testid="scene-overlay-collapsed"]');
  const trigger = page.getByRole("button", { name: "View overlays", exact: true });
  if (await trigger.isVisible().catch(() => false) && await choices.isVisible().catch(() => false)) {
    await trigger.click();
    await expect(choices).toBeHidden();
  }
};

const expandSceneViewport = async (page: Page) => {
  const canvas = page.getByTestId("scene-canvas").locator("canvas");
  if (await canvas.evaluate((element) => element.getBoundingClientRect().width) > 700) return;
  await page.getByRole("button", { name: "Expand 3D Scene", exact: true }).click();
  await expect(page.locator('button[data-viewport-expanded="true"]')).toBeVisible();
  await page.waitForFunction(() =>
    (document.querySelector('[data-testid="scene-canvas"] canvas')?.getBoundingClientRect().width ?? 0) > 700,
  );
  await waitForRenderFrames(page);
};

const restoreSceneViewport = async (page: Page) => {
  const canvas = page.getByTestId("scene-canvas").locator("canvas");
  if (await canvas.evaluate((element) => element.getBoundingClientRect().width) <= 700) return;
  await page.getByRole("button", { name: "Restore 3D Scene", exact: true }).click();
  await expect(page.getByRole("button", { name: "Expand 3D Scene", exact: true })).toBeVisible();
  await page.waitForFunction(() =>
    (document.querySelector('[data-testid="scene-canvas"] canvas')?.getBoundingClientRect().width ?? 0) <= 700,
  );
  await waitForRenderFrames(page);
};

const vectorsMatch = (first: string | null, second: string | null): boolean => {
  if (first === null || second === null) return false;
  const firstValues = first.split(",").map(Number);
  const secondValues = second.split(",").map(Number);
  return firstValues.length === 3 && secondValues.length === 3 &&
    firstValues.every((value, index) =>
      Number.isFinite(value) && Number.isFinite(secondValues[index]) &&
      Math.abs(value - (secondValues[index] ?? Number.NaN)) < 0.00001
    );
};

const waitForViewStateChange = async (
  observer: Locator,
  baseline: ObserverViewState,
  shouldMatch: boolean,
  timeoutMs: number,
): Promise<ObserverViewState> => {
  const deadline = Date.now() + timeoutMs;
  let current = await readObserverViewState(observer);
  const matches = (state: ObserverViewState) =>
    vectorsMatch(state.position, baseline.position) &&
    vectorsMatch(state.target, baseline.target);

  while ((matches(current) !== shouldMatch) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    current = await readObserverViewState(observer);
  }
  return current;
};

const exerciseObserverControls = async (
  page: Page,
  observer: Locator,
) => {
  await page.getByRole("button", { name: "Camera" }).click();
  await expect(observer).toHaveAttribute("data-view-focus", "camera");
  const cameraFocusSelected = await observer.getAttribute("data-view-focus") === "camera";
  const resetBaseline = await readObserverViewState(observer);

  const canvas = observer.locator("canvas");
  const bounds = await canvas.boundingBox();
  if (bounds) {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 72, centerY + 26, { steps: 5 });
    await page.mouse.up();
  }

  const orbitViewState = await waitForViewStateChange(
    observer,
    resetBaseline,
    false,
    3_000,
  );
  const orbitInteractionWorked =
    !vectorsMatch(orbitViewState.position, resetBaseline.position) ||
    !vectorsMatch(orbitViewState.target, resetBaseline.target);

  await page.getByRole("button", { name: "Reset 3D view" }).click();
  const resetViewState = await waitForViewStateChange(
    observer,
    resetBaseline,
    true,
    5_000,
  );

  return {
    cameraFocusSelected,
    orbitInteractionWorked,
    resetRestoredCameraPosition: vectorsMatch(
      resetViewState.position,
      resetBaseline.position,
    ),
    resetRestoredOrbitTarget: vectorsMatch(resetViewState.target, resetBaseline.target),
  };
};

const selectAnatomySceneFocus = async (page: Page, observer: Locator) => {
  await page.getByRole("button", { name: "Scene", exact: true }).click();
  await expect(observer).toHaveAttribute("data-view-focus", "scene");
};

const setAnatomyVerificationView = async (
  page: Page,
  observer: Locator,
): Promise<ObserverViewState> => {
  const baseline = await readObserverViewState(observer);
  const bounds = VIEW_CAMERA_ANATOMY_PRESENTATION.geometry.bounds;
  const target: [number, number, number] = [
    toWorld((bounds.min.x + bounds.max.x) / 2),
    toWorld((bounds.min.y + bounds.max.y) / 2),
    toWorld((bounds.min.z + bounds.max.z) / 2),
  ];
  const view = {
    target,
    position: [target[0] + 0.55, target[1] + 0.3, target[2] + 1.2] as [number, number, number],
  };

  await observer.evaluate((element, { nextView, eventName }) => {
    element.dispatchEvent(new CustomEvent(eventName, { detail: nextView }));
  }, { nextView: view, eventName: ANATOMY_VERIFICATION_VIEW_EVENT });
  await expect.poll(async () => {
    const current = await readObserverViewState(observer);
    return vectorsMatch(current.position, view.position.join(",")) &&
      vectorsMatch(current.target, view.target.join(","));
  }).toBe(true);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  return baseline;
};

const restoreObserverSceneView = async (
  page: Page,
  observer: Locator,
  sceneView: ObserverViewState,
) => {
  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await expect.poll(async () => {
    const current = await readObserverViewState(observer);
    return vectorsMatch(current.position, sceneView.position) &&
      vectorsMatch(current.target, sceneView.target);
  }, { timeout: 5_000 }).toBe(true);
};

const attachRuntimeVerification = async (input: Readonly<{
  testInfo: TestInfo;
  browser: Browser;
  attributes: Record<string, string>;
  sceneSubjectId: string;
  groundGlassContentful: boolean;
  canvasPixels: CanvasPixelEvidence;
  subjectRendering: SubjectRenderingEvidence;
  interactions: Awaited<ReturnType<typeof exerciseObserverControls>>;
  pageErrors: string[];
}>) => {
  const {
    testInfo,
    browser,
    attributes,
    sceneSubjectId,
    groundGlassContentful,
    canvasPixels,
    subjectRendering,
    interactions,
    pageErrors,
  } = input;
  const observerReady =
    sceneSubjectId === "view-camera-anatomy" &&
    subjectRendering.status === "verified" &&
    canvasPixels.contentful && interactions.cameraFocusSelected &&
    interactions.orbitInteractionWorked &&
    interactions.resetRestoredCameraPosition &&
    interactions.resetRestoredOrbitTarget;

  const report = {
    schemaVersion: 3,
    environment: {
      operatingSystem: process.platform,
      osRelease: release(),
      architecture: process.arch,
      browserEngine: browser.browserType().name(),
      browserProduct: nativeWebGpuRequired ? "Google Chrome (stable channel)" : "Playwright Chromium",
      browserVersion: browser.version(),
      threeRevision: REVISION,
    },
    requestedRenderer: attributes["data-observer-renderer-request"] ?? "unknown",
    rendererMountGeneration: Number(
      attributes["data-observer-renderer-generation"] ?? "-1",
    ),
    selectionReason: attributes["data-observer-selection-reason"] ?? "unknown",
    sceneCompatibility: {
      status: attributes["data-observer-webgpu-scene-compatibility"] ?? "unknown",
      developmentPilotEligibility:
        attributes["data-observer-webgpu-pilot-eligibility"] ?? "unknown",
      requirementsStatus:
        attributes["data-observer-scene-requirements-status"] ?? "unknown",
      renderingRequirements:
        attributes["data-observer-scene-rendering-requirements"] ?? "unknown",
      knownBackendConstraints:
        attributes["data-observer-scene-known-backend-constraints"] ?? "unknown",
    },
    browserWebGpuApi:
      attributes["data-observer-webgpu-api-present"] === "true" ? "present" :
      attributes["data-observer-webgpu-api-present"] === "false" ? "absent" : "unknown",
    adapterAvailability: attributes["data-observer-adapter-availability"] ?? "unknown",
    mountedRendererFamily: attributes["data-observer-renderer-family"] ?? "unknown",
    executionBackend: attributes["data-observer-execution-backend"] ?? "unknown",
    applicationFallback: attributes["data-observer-application-fallback"] ?? "unknown",
    webgpuInitializationAttempts: Number(
      attributes["data-observer-webgpu-initialization-attempts"] ?? "0",
    ),
    initializationFailure:
      attributes["data-observer-renderer-failure-stage"] === "initialization",
    observerReadiness: {
      status: observerReady ? "ready" : "not-ready",
      sceneSubjectId,
      subjectRendering,
      screenshotPixels: canvasPixels,
      interactions,
    },
    groundGlassReadiness: {
      status: groundGlassContentful ? "contentful" : "not-contentful",
      finalTargetContentful: groundGlassContentful,
    },
    hardwareAcceleration: {
      classification:
        attributes["data-observer-hardware-acceleration"] === "confirmed"
          ? "confirmed"
          : "unconfirmed",
      evidence:
        "Renderer identity and adapter availability do not establish whether the browser uses a hardware or software adapter.",
    },
    pageErrors,
  };

  const body = JSON.stringify(report, null, 2);
  await testInfo.attach("observer-runtime-verification.json", {
    body,
    contentType: "application/json",
  });
  console.info(`OBSERVER_RUNTIME_EVIDENCE ${JSON.stringify(report)}`);
  return report;
};

const attachScreenshots = async (
  page: Page,
  testInfo: TestInfo,
  canvas: Locator,
  canvasPath: string,
  pagePath: string,
) => {
  const canvasScreenshot = await captureObserverCanvasScreenshot(page, canvas, canvasPath);
  const canvasPixels = analyzeCanvasScreenshot(canvasScreenshot);
  await testInfo.attach("observer-canvas.png", {
    body: canvasScreenshot,
    contentType: "image/png",
  });
  const fullPageScreenshot = await page.screenshot({ path: pagePath });
  await testInfo.attach("observer-and-ground-glass.png", {
    body: fullPageScreenshot,
    contentType: "image/png",
  });
  return canvasPixels;
};

test("View Camera Anatomy keeps its default mounted Observer on WebGL", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const webgpuModuleRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (/three[._/-]webgpu/i.test(request.url())) webgpuModuleRequests.push(request.url());
  });

  await page.goto("/simulator/free/view-camera-anatomy?rttDiagnostics=1");
  const observer = await waitForMountedObserver(page);
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgl");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "default-webgl-request");
  await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "verified");
  await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "eligible");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  await expect(observer).toHaveAttribute("data-observer-adapter-availability", "not-requested");
  await expect(observer).not.toHaveAttribute("data-observer-webgpu-initialization-attempts");
  await expect(observer).not.toHaveAttribute("data-observer-hardware-acceleration");
  await expect(observer).toHaveAttribute("data-observer-shadow-map-status", "active");
  await expect(observer).toHaveAttribute("data-observer-shadow-map-type", "pcf");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping-active", "true");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping", "aces-filmic");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping-exposure", "1.000000");
  await expect(observer).toHaveAttribute("data-observer-output-color-space", "srgb");
  await expect(observer).toHaveAttribute("data-scene-subject-id", "view-camera-anatomy");
  const evidence = await attachMountedObserverEvidence(testInfo, observer);
  const initialMountGeneration = Number(evidence["data-observer-renderer-generation"]);
  const sceneSubjectId = await observer.getAttribute("data-scene-subject-id") ?? "unknown";
  expect(webgpuModuleRequests).toEqual([]);

  const groundGlass = page.getByTestId("ground-glass-rtt");
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", {
    timeout: 60_000,
  });
  const groundGlassContentful =
    await groundGlass.getAttribute("data-rtt-final-contentful") === "true";
  const canvas = observer.locator("canvas");
  const canvasPixels = await attachScreenshots(
    page,
    testInfo,
    canvas,
    "test-results/observer-webgl-baseline.png",
    "test-results/observer-webgl-baseline-page.png",
  );
  const interactions = await exerciseObserverControls(page, observer);
  await selectAnatomySceneFocus(page, observer);
  const sceneView = await setAnatomyVerificationView(page, observer);
  const subjectRendering = await captureSubjectRenderingEvidence(
    page,
    observer,
    testInfo,
  );
  await restoreObserverSceneView(page, observer, sceneView);
  expect(
    Number(await observer.getAttribute("data-observer-renderer-generation")),
  ).toBe(initialMountGeneration);
  await attachRuntimeVerification({
    testInfo,
    browser,
    attributes: evidence,
    sceneSubjectId,
    groundGlassContentful,
    canvasPixels,
    subjectRendering,
    interactions,
    pageErrors,
  });

  expect(canvasPixels.contentful).toBe(true);
  expect(subjectRendering.status, "Anatomy subject must contribute projected pixels").toBe("verified");
  expect(interactions).toEqual({
    cameraFocusSelected: true,
    orbitInteractionWorked: true,
    resetRestoredCameraPosition: true,
    resetRestoredOrbitTarget: true,
  });
  expect(evidence["data-observer-adapter-availability"]).toBe("not-requested");
  expect(webgpuModuleRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("development WebGPU pilot keeps View Camera Anatomy interactive beside WebGL Ground Glass", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const webgpuModuleRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (/three[._/-]webgpu/i.test(request.url())) webgpuModuleRequests.push(request.url());
  });

  await page.goto("/simulator/free/view-camera-anatomy?observerRenderer=webgpu&rttDiagnostics=1");
  const observer = await waitForMountedObserver(page);
  const generationWhenMounted = Number(
    await observer.getAttribute("data-observer-renderer-generation"),
  );
  await expect.poll(() => webgpuModuleRequests.length).toBeGreaterThan(0);
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "webgpu-pilot-approved");
  await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "verified");
  await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "eligible");
  await expect(observer).toHaveAttribute("data-observer-webgpu-api-present", /^(true|false)$/);
  await expect(observer).toHaveAttribute("data-observer-hardware-acceleration", "unconfirmed");
  await expect(observer).toHaveAttribute(
    "data-observer-adapter-availability",
    /^(api-absent|available|unavailable|request-rejected|timed-out)$/,
    { timeout: 10_000 },
  );
  expect(
    Number(await observer.getAttribute("data-observer-renderer-generation")),
  ).toBe(generationWhenMounted);
  await expect.poll(() =>
    observer.getAttribute("data-observer-webgpu-initialization-attempts"),
  ).toBe("1");

  const initialEvidence = await attachMountedObserverEvidence(testInfo, observer);
  const initialMountGeneration = Number(
    initialEvidence["data-observer-renderer-generation"],
  );
  const sceneSubjectId = await observer.getAttribute("data-scene-subject-id") ?? "unknown";
  const family = initialEvidence["data-observer-renderer-family"];
  const executionBackend = initialEvidence["data-observer-execution-backend"];
  const applicationFallback = initialEvidence["data-observer-application-fallback"];
  await expect(observer).toHaveAttribute("data-observer-shadow-map-status", "active");
  await expect(observer).toHaveAttribute("data-observer-shadow-map-type", "pcf");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping-active", "true");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping", "aces-filmic");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping-exposure", "1.000000");
  await expect(observer).toHaveAttribute("data-observer-output-color-space", "srgb");

  if (process.env.OBSERVER_TEST_HIDE_ANATOMY_SUBJECT === "1") {
    await expect(observer).toHaveAttribute(
      "data-observer-test-anatomy-visibility-hook",
      "ready",
    );
    await setAnatomySubjectVisible(page, observer, false);
  }

  if (family === "webgpu-renderer") {
    expect(executionBackend).toMatch(/^(webgpu|webgl2-fallback)$/);
    expect(applicationFallback).toBe("none");
  } else {
    expect(family).toBe("webgl-renderer");
    expect(executionBackend).toBe("webgl2");
    expect(applicationFallback).toBe("app-webgl");
    await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", "initialization");
  }

  const groundGlass = page.getByTestId("ground-glass-rtt");
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", {
    timeout: 60_000,
  });
  const groundGlassContentful =
    await groundGlass.getAttribute("data-rtt-final-contentful") === "true";
  const canvas = observer.locator("canvas");
  const canvasPixels = await attachScreenshots(
    page,
    testInfo,
    canvas,
    "test-results/observer-webgpu-pilot.png",
    "test-results/observer-webgpu-pilot-page.png",
  );
  const interactions = await exerciseObserverControls(page, observer);
  await selectAnatomySceneFocus(page, observer);
  const sceneView = await setAnatomyVerificationView(page, observer);
  const subjectRendering = await captureSubjectRenderingEvidence(
    page,
    observer,
    testInfo,
  );
  await restoreObserverSceneView(page, observer, sceneView);
  expect(
    Number(await observer.getAttribute("data-observer-renderer-generation")),
  ).toBe(initialMountGeneration);
  const runtimeEvidence = await attachRuntimeVerification({
    testInfo,
    browser,
    attributes: initialEvidence,
    sceneSubjectId,
    groundGlassContentful,
    canvasPixels,
    subjectRendering,
    interactions,
    pageErrors,
  });

  expect(webgpuModuleRequests).toHaveLength(1);
  expect(initialEvidence["data-observer-webgpu-initialization-attempts"]).toBe("1");
  expect(canvasPixels.contentful).toBe(true);
  expect(subjectRendering.status, "Anatomy subject must contribute projected pixels").toBe("verified");
  expect(interactions).toEqual({
    cameraFocusSelected: true,
    orbitInteractionWorked: true,
    resetRestoredCameraPosition: true,
    resetRestoredOrbitTarget: true,
  });
  expect(pageErrors).toEqual([]);

  if (nativeWebGpuRequired) {
    expect(initialEvidence["data-observer-webgpu-api-present"]).toBe("true");
    expect(initialEvidence["data-observer-adapter-availability"]).toBe("available");
    expect(family).toBe("webgpu-renderer");
    expect(executionBackend).toBe("webgpu");
    expect(applicationFallback).toBe("none");
    expect(initialEvidence["data-observer-renderer-failure-stage"]).toBeUndefined();
    expect(runtimeEvidence.webgpuInitializationAttempts).toBe(1);
    expect(runtimeEvidence.observerReadiness.status).toBe("ready");
    expect(runtimeEvidence.observerReadiness.subjectRendering.status).toBe("verified");
    expect(runtimeEvidence.groundGlassReadiness.status).toBe("contentful");
    expect(runtimeEvidence.initializationFailure).toBe(false);
  }
});

test("application fallback remounts once and clears when the scene changes", async ({ page, browser }, testInfo) => {
  test.skip(
    nativeWebGpuRequired,
    "This fault-injection case verifies application fallback; the native-required pilot test separately requires native execution.",
  );
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const webgpuModuleRequests: string[] = [];
  const documentNavigations: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (/three[._/-]webgpu/i.test(request.url())) webgpuModuleRequests.push(request.url());
    if (request.isNavigationRequest() && request.resourceType() === "document") {
      documentNavigations.push(request.url());
    }
  });
  await page.route(/three[._/-]webgpu/i, (route) => route.abort());

  await page.goto("/simulator/free/view-camera-anatomy?observerRenderer=webgpu&rttDiagnostics=1");
  const observer = await waitForMountedObserver(page);
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl", {
    timeout: 60_000,
  });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", "app-webgl");
  await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", "initialization");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  const initialEvidence = await attachMountedObserverEvidence(testInfo, observer);
  const initialMountGeneration = Number(
    initialEvidence["data-observer-renderer-generation"],
  );
  const sceneSubjectId = await observer.getAttribute("data-scene-subject-id") ?? "unknown";

  const groundGlass = page.getByTestId("ground-glass-rtt");
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", {
    timeout: 60_000,
  });
  const groundGlassContentful =
    await groundGlass.getAttribute("data-rtt-final-contentful") === "true";
  const canvas = observer.locator("canvas");
  const canvasPixels = await attachScreenshots(
    page,
    testInfo,
    canvas,
    "test-results/observer-webgpu-app-fallback.png",
    "test-results/observer-webgpu-app-fallback-page.png",
  );
  const interactions = await exerciseObserverControls(page, observer);
  await selectAnatomySceneFocus(page, observer);
  const sceneView = await setAnatomyVerificationView(page, observer);
  const subjectRendering = await captureSubjectRenderingEvidence(page, observer, testInfo);
  await restoreObserverSceneView(page, observer, sceneView);
  const runtimeEvidence = await attachRuntimeVerification({
    testInfo,
    browser,
    attributes: initialEvidence,
    sceneSubjectId,
    groundGlassContentful,
    canvasPixels,
    subjectRendering,
    interactions,
    pageErrors,
  });

  expect(webgpuModuleRequests).toHaveLength(1);
  expect(canvasPixels.contentful).toBe(true);
  expect(subjectRendering.status).toBe("verified");
  expect(runtimeEvidence.observerReadiness.status).toBe("ready");
  expect(interactions).toEqual({
    cameraFocusSelected: true,
    orbitInteractionWorked: true,
    resetRestoredCameraPosition: true,
    resetRestoredOrbitTarget: true,
  });
  expect(pageErrors).toEqual([]);

  // The injected failure applies only to the first renderer import. The next
  // scene is independently eligible and must be able to attempt WebGPU.
  await page.unroute(/three[._/-]webgpu/i);
  await navigateWithinSimulator(
    page,
    "/simulator/free/architecture-rise?observerRenderer=webgpu&rttDiagnostics=1",
  );
  await waitForMountedObserver(page, "architecture-rise");
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute(
    "data-observer-selection-reason",
    "webgpu-pilot-approved",
  );
  await expect(observer).toHaveAttribute("data-observer-adapter-availability", /^(available|unavailable|api-absent|request-rejected|timed-out)$/);
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  const architectureFamily = await observer.getAttribute("data-observer-renderer-family");
  if (architectureFamily === "webgpu-renderer") {
    await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgpu");
    await expect(observer).toHaveAttribute("data-observer-execution-backend", /^(webgpu|webgl2-fallback)$/);
    await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
    await expect(observer).not.toHaveAttribute("data-observer-renderer-failure-stage");
  } else {
    await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
    await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
    await expect(observer).toHaveAttribute("data-observer-application-fallback", "app-webgl");
    await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", "initialization");
  }
  expect(webgpuModuleRequests.length).toBeGreaterThanOrEqual(1);
  expect(documentNavigations).toHaveLength(1);
  expect(pageErrors).toEqual([]);
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");
  const afterSceneChange = await readObserverAttributes(observer);
  expect(Number(afterSceneChange["data-observer-renderer-generation"])).toBeGreaterThan(
    initialMountGeneration,
  );
  expect(afterSceneChange["data-observer-selection-reason"]).toBe("webgpu-pilot-approved");
  expect(afterSceneChange["data-observer-webgpu-initialization-attempts"]).toBe("1");

  await testInfo.attach("observer-application-fallback-lifecycle.json", {
    body: JSON.stringify({
      initialFallback: {
        request: initialEvidence["data-observer-renderer-request"],
        rendererAttempt: initialEvidence["data-observer-renderer-attempt"],
        rendererFamily: initialEvidence["data-observer-renderer-family"],
        executionBackend: initialEvidence["data-observer-execution-backend"],
        applicationFallback: initialEvidence["data-observer-application-fallback"],
        failureStage: initialEvidence["data-observer-renderer-failure-stage"],
        initializationAttempts: initialEvidence["data-observer-webgpu-initialization-attempts"],
        subjectRendering,
        interactions,
        groundGlassContentful,
      },
      afterSceneChange,
      webgpuModuleRequests,
      documentNavigations,
      pageErrors,
    }, null, 2),
    contentType: "application/json",
  });
});

test("Architecture Rise uses one application fallback after a controlled WebGPU initialization failure", async ({ page }, testInfo) => {
  test.skip(
    nativeWebGpuRequired,
    "This controlled initialization failure is separate from native-required renderer verification.",
  );
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const webgpuRequests: string[] = [];
  const webgpuModuleRoute = /three[._/-]webgpu/i;
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (webgpuModuleRoute.test(request.url())) webgpuRequests.push(request.url());
  });
  await page.route(webgpuModuleRoute, (route) => route.abort());
  await page.goto("/simulator/free/architecture-rise?observerRenderer=webgpu&rttDiagnostics=1");

  const observer = await waitForMountedObserver(page, "architecture-rise");
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "webgpu-pilot-approved");
  await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", "app-webgl");
  await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", "initialization");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "verified");
  await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "eligible");
  await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 60_000 });
  const groundGlass = page.getByTestId("ground-glass-rtt").first();
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-scene-subject-id", "architecture-rise");
  const architectureCanvas = observer.locator("canvas");
  const architectureScreenshot = await captureObserverCanvasScreenshot(page, architectureCanvas);
  const architectureCanvasPixels = analyzeCanvasScreenshot(architectureScreenshot);
  expect(architectureCanvasPixels.contentful).toBe(true);
  await testInfo.attach("architecture-rise-app-fallback-observer.png", {
    body: architectureScreenshot,
    contentType: "image/png",
  });
  expect(webgpuRequests).toHaveLength(1);

  const fallbackGeneration = await observer.getAttribute("data-observer-renderer-generation");
  await setStepRangeInput(page, "Rise", 22);
  await setStepRangeInput(page, "Tilt", 0.4);
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  await expect(observer).toHaveAttribute("data-observer-renderer-generation", fallbackGeneration ?? "");
  await expect(observer).toHaveAttribute("data-observer-environment-status", "active");
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");

  await navigateWithinSimulator(
    page,
    "/simulator/free/table-tilt?observerRenderer=webgpu&rttDiagnostics=1",
  );
  await expect(observer).toHaveAttribute("data-scene-subject-id", "table-tilt", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "scene-requirements-not-declared");
  await expect(observer).toHaveAttribute("data-observer-adapter-availability", "not-requested");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "0");
  expect(pageErrors).toEqual([]);
  const afterIneligibleScene = await readObserverAttributes(observer);
  expect(Number(afterIneligibleScene["data-observer-renderer-generation"])).toBeGreaterThan(
    Number(fallbackGeneration),
  );
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");

  await page.unroute(webgpuModuleRoute);
  await navigateWithinSimulator(
    page,
    "/simulator/free/view-camera-anatomy?observerRenderer=webgpu&rttDiagnostics=1",
  );
  await waitForMountedObserver(page);
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "webgpu-pilot-approved");
  await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "verified");
  await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "eligible");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  const recoveredEligibleScene = await readObserverAttributes(observer);
  expect(Number(recoveredEligibleScene["data-observer-renderer-generation"])).toBeGreaterThan(
    Number(afterIneligibleScene["data-observer-renderer-generation"]),
  );
  if (recoveredEligibleScene["data-observer-renderer-family"] === "webgpu-renderer") {
    expect(recoveredEligibleScene["data-observer-renderer-attempt"]).toBe("webgpu");
    expect(recoveredEligibleScene["data-observer-execution-backend"]).toMatch(/^(webgpu|webgl2-fallback)$/);
    expect(recoveredEligibleScene["data-observer-application-fallback"]).toBe("none");
    expect(recoveredEligibleScene["data-observer-renderer-failure-stage"]).toBeUndefined();
  } else {
    expect(recoveredEligibleScene["data-observer-renderer-family"]).toBe("webgl-renderer");
    expect(recoveredEligibleScene["data-observer-renderer-attempt"]).toBe("webgl");
    expect(recoveredEligibleScene["data-observer-execution-backend"]).toBe("webgl2");
    expect(recoveredEligibleScene["data-observer-application-fallback"]).toBe("app-webgl");
    expect(recoveredEligibleScene["data-observer-renderer-failure-stage"]).toBe("initialization");
  }
  await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute("data-rtt-final-contentful", "true", {
    timeout: 60_000,
  });
  expect(webgpuRequests.length).toBeGreaterThanOrEqual(1);
  expect(pageErrors).toEqual([]);

  await testInfo.attach("architecture-rise-application-fallback.json", {
    body: JSON.stringify({
      selected: "webgpu-pilot-approved",
      actualMountedRenderer: {
        family: "webgl-renderer",
        backend: "webgl2",
        applicationFallback: "app-webgl",
        failureStage: "initialization",
        initializationAttempts: 1,
        generation: fallbackGeneration,
      },
      webgpuRequests,
      groundGlassContentful: true,
      architectureCanvasPixels,
      afterIneligibleScene,
      recoveredEligibleScene,
      pageErrors,
    }, null, 2),
    contentType: "application/json",
  });
});

test("an unevaluated scene refuses the WebGPU pilot", async ({ page }, testInfo) => {
  const webgpuModuleRequests: string[] = [];
  page.on("request", (request) => {
    if (/three[._/-]webgpu/i.test(request.url())) webgpuModuleRequests.push(request.url());
  });

  await page.goto("/simulator/free/table-tilt?observerRenderer=webgpu&rttDiagnostics=1");
  const observer = await waitForMountedObserver(page, "table-tilt");
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute(
    "data-observer-selection-reason",
    "scene-requirements-not-declared",
  );
  await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "not-evaluated");
  await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "not-eligible");
  await expect(observer).toHaveAttribute("data-observer-scene-requirements-status", "not-evaluated");
  await expect(observer).toHaveAttribute(
    "data-observer-scene-known-backend-constraints",
    "none",
  );
  await expect(observer).toHaveAttribute("data-observer-adapter-availability", "not-requested");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "0");
  await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute(
    "data-rtt-final-contentful",
    "true",
    { timeout: 60_000 },
  );
  expect(webgpuModuleRequests).toEqual([]);

  const attributes = await attachMountedObserverEvidence(testInfo, observer);
  await testInfo.attach("architecture-rise-backend-selection.json", {
    body: JSON.stringify({
      requestedRenderer: attributes["data-observer-renderer-request"],
      selectionReason: attributes["data-observer-selection-reason"],
      rendererAttempt: attributes["data-observer-renderer-attempt"],
      mountedRendererFamily: attributes["data-observer-renderer-family"],
      executionBackend: attributes["data-observer-execution-backend"],
      adapterAvailability: attributes["data-observer-adapter-availability"],
      webgpuModuleRequests,
      groundGlassContentful: true,
    }, null, 2),
    contentType: "application/json",
  });
});

test("Architecture Rise restores standard output after a controlled material-aware module failure", async ({ page }, testInfo) => {
  test.skip(
    nativeWebGpuRequired,
    "This fault-injection case verifies output-policy fallback; native-required parity runs without module interception.",
  );
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const materialAwareModuleRequests: string[] = [];
  const materialAwareModuleRoute = /materialAwareObserverOutput/i;
  let releaseOutputPolicyFailure!: () => void;
  const outputPolicyFailureGate = new Promise<void>((resolve) => {
    releaseOutputPolicyFailure = resolve;
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (materialAwareModuleRoute.test(request.url())) {
      materialAwareModuleRequests.push(request.url());
    }
  });
  const moduleRequest = page.waitForRequest(materialAwareModuleRoute, { timeout: 90_000 });
  await page.route(materialAwareModuleRoute, async (route) => {
    await outputPolicyFailureGate;
    await route.abort();
  });
  await page.goto(
    "/simulator/free/architecture-rise?observerRenderer=webgpu&observerOutput=material-aware&rttDiagnostics=1",
    { waitUntil: "domcontentloaded" },
  );

  const observer = await waitForMountedObserver(page, "architecture-rise");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "webgpu-pilot-approved");
  await expect(observer).toHaveAttribute("data-observer-output-policy-requested", "material-aware");
  await moduleRequest;
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgpu-renderer", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgpu");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  releaseOutputPolicyFailure();
  await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", "app-webgl");
  await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", "output-policy");
  await expect(observer).toHaveAttribute("data-observer-output-policy-selected", "standard");
  await expect(observer).toHaveAttribute("data-observer-output-policy-selection-reason", "webgpu-not-selected");
  await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping", "aces-filmic");
  await expect(observer).toHaveAttribute("data-observer-output-color-space", "srgb");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  await expect(observer).toHaveAttribute("data-scene-subject-id", "architecture-rise");

  const screenshot = await captureObserverCanvasScreenshot(page, observer.locator("canvas"));
  const screenshotPixels = analyzeCanvasScreenshot(screenshot);
  expect(screenshotPixels.contentful).toBe(true);
  const groundGlass = page.getByTestId("ground-glass-rtt").first();
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  expect(materialAwareModuleRequests).toHaveLength(1);
  expect(pageErrors).toEqual([]);

  await testInfo.attach("architecture-rise-material-aware-fallback.png", {
    body: screenshot,
    contentType: "image/png",
  });
  await testInfo.attach("architecture-rise-material-aware-fallback.json", {
    body: JSON.stringify({
      request: page.url(),
      outputPolicyRequested: await observer.getAttribute("data-observer-output-policy-requested"),
      outputPolicySelectedAfterFallback: await observer.getAttribute("data-observer-output-policy-selected"),
      outputPolicyFailure: await observer.getAttribute("data-observer-output-policy-failure"),
      rendererFamily: await observer.getAttribute("data-observer-renderer-family"),
      executionBackend: await observer.getAttribute("data-observer-execution-backend"),
      applicationFallback: await observer.getAttribute("data-observer-application-fallback"),
      failureStage: await observer.getAttribute("data-observer-renderer-failure-stage"),
      initializationAttempts: await observer.getAttribute("data-observer-webgpu-initialization-attempts"),
      screenshotPixels,
      groundGlassContentful: await groundGlass.getAttribute("data-rtt-final-contentful"),
      materialAwareModuleRequests,
      pageErrors,
    }, null, 2),
    contentType: "application/json",
  });
});

test("material-aware output adapts the Architecture Rise Observer and stays scene-scoped across navigation", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const materialAwareModuleRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (/materialAwareObserverOutput/i.test(request.url())) {
      materialAwareModuleRequests.push(request.url());
    }
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  const webglObserver = await waitForMountedObserver(page, "architecture-rise");
  await expect(webglObserver).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(webglObserver).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(page.getByTestId("ground-glass-rtt").first()).toHaveAttribute("data-rtt-final-contentful", "true");
  const webglViewState = await readObserverViewState(webglObserver);
  const webglOverlayVisibility = await readOverlayVisibility(webglObserver);
  await expandSceneViewport(page);
  const webglCaptureConfiguration = await readObserverCaptureConfiguration(page, webglObserver);
  await applyOverlayVisibility(page, webglObserver, {
    focusPlane: false,
    dofRegion: false,
    opticalGeometry: false,
  });
  await collapseOverlayControls(page);
  const webglFocusChartCapture = await captureObserverFramebufferScreenshot(page, webglObserver.locator("canvas"));
  await setObserverViewFocus(page, webglObserver, "camera");
  await applyOverlayVisibility(page, webglObserver, {
    focusPlane: false,
    dofRegion: false,
    opticalGeometry: true,
  });
  await collapseOverlayControls(page);
  const webglOpticalGeometryCapture = await captureObserverFramebufferScreenshot(page, webglObserver.locator("canvas"));
  const webglOpticalAxisViewState = await readObserverViewState(webglObserver);
  await setObserverViewFocus(page, webglObserver, "scene");
  await applyOverlayVisibility(page, webglObserver, webglOverlayVisibility);
  await restoreSceneViewport(page);
  expect(materialAwareModuleRequests).toHaveLength(0);
  await testInfo.attach("architecture-rise-webgl-focus-chart-no-overlays.png", {
    body: webglFocusChartCapture,
    contentType: "image/png",
  });
  await testInfo.attach("architecture-rise-webgl-optical-geometry-only.png", {
    body: webglOpticalGeometryCapture,
    contentType: "image/png",
  });

  const candidatePath = "/simulator/free/architecture-rise?observerRenderer=webgpu&observerOutput=material-aware&rttDiagnostics=1";
  await page.goto(candidatePath);

  const observer = await waitForMountedObserver(page, "architecture-rise");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "webgpu-pilot-approved");
  await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "verified");
  await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "eligible");
  await expect(observer).toHaveAttribute("data-observer-output-policy-requested", "material-aware");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLElement>('[data-testid="scene-canvas"]');
    const family = element?.getAttribute("data-observer-renderer-family");
    const fallback = element?.getAttribute("data-observer-application-fallback");
    return (family === "webgpu-renderer" && element?.getAttribute("data-observer-output-policy-status") === "active") ||
      (family === "webgl-renderer" && fallback === "app-webgl");
  }, undefined, { timeout: 90_000 });
  const firstGeneration = Number(await observer.getAttribute("data-observer-renderer-generation"));
  const firstFamily = await observer.getAttribute("data-observer-renderer-family");
  if (nativeWebGpuRequired) {
    await expect(observer).toHaveAttribute("data-observer-webgpu-api-present", "true");
    await expect(observer).toHaveAttribute("data-observer-adapter-availability", "available", {
      timeout: 60_000,
    });
    expectNativeWebGpuMount(await readObserverAttributes(observer));
  }
  let materialInventory: Record<string, unknown> | null = null;
  if (firstFamily === "webgpu-renderer") {
    await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgpu");
    await expect(observer).toHaveAttribute("data-observer-execution-backend", /^(webgpu|webgl2-fallback)$/);
    await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
    await expect(observer).toHaveAttribute("data-observer-output-policy-selected", "material-aware");
    await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "material-aware");
    await expect(observer).toHaveAttribute("data-observer-output-policy-status", "active", { timeout: 60_000 });
    const inventoryValue = await observer.getAttribute("data-observer-material-inventory");
    if (!inventoryValue) throw new Error("The mounted material-aware candidate did not publish a runtime inventory");
    materialInventory = JSON.parse(inventoryValue) as Record<string, unknown>;
    expect(materialInventory.sceneId).toBe("architecture-rise");
    expect(materialInventory.unsupportedMaterialInstances).toBe(0);
    expect(Number(materialInventory.adaptedMaterialInstances)).toBeGreaterThan(0);
    expect(Array.isArray(materialInventory.families)).toBe(true);
    expect((materialInventory.families as Array<Record<string, unknown>>).length).toBeGreaterThan(0);
    expect((materialInventory.families as Array<Record<string, unknown>>).every((family) => family.status === "supported")).toBe(true);
    expect((materialInventory.environment as Record<string, unknown>).assigned).toBe(true);
  } else if (firstFamily === "webgl-renderer") {
    await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
    await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
    await expect(observer).toHaveAttribute("data-observer-application-fallback", "app-webgl");
    await expect(observer).toHaveAttribute("data-observer-output-policy-selected", "standard");
    await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard");
    await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", /^(initialization|output-policy)$/);
  } else {
    throw new Error(`The material-aware request mounted an unsupported renderer family: ${String(firstFamily)}`);
  }
  await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 90_000 });
  const groundGlass = page.getByTestId("ground-glass-rtt").first();
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 90_000 });
  const firstMountAttributes = await readObserverAttributes(observer);
  const firstScreenshot = await captureObserverCanvasScreenshot(page, observer.locator("canvas"));
  const firstScreenshotPixels = analyzeCanvasScreenshot(firstScreenshot);
  expect(firstScreenshotPixels.contentful).toBe(true);
  const firstViewState = await readObserverViewState(observer);
  expect(vectorsMatch(webglViewState.position, firstViewState.position)).toBe(true);
  expect(vectorsMatch(webglViewState.target, firstViewState.target)).toBe(true);
  const candidateOverlayVisibility = await readOverlayVisibility(observer);
  expect(candidateOverlayVisibility).toEqual(webglOverlayVisibility);
  await expandSceneViewport(page);
  const candidateCaptureConfiguration = await readObserverCaptureConfiguration(page, observer);
  await applyOverlayVisibility(page, observer, {
    focusPlane: false,
    dofRegion: false,
    opticalGeometry: false,
  });
  await collapseOverlayControls(page);
  const webgpuFocusChartCapture = await captureObserverFramebufferScreenshot(page, observer.locator("canvas"));
  await setObserverViewFocus(page, observer, "camera");
  await applyOverlayVisibility(page, observer, {
    focusPlane: false,
    dofRegion: false,
    opticalGeometry: true,
  });
  await collapseOverlayControls(page);
  const webgpuOpticalGeometryCapture = await captureObserverFramebufferScreenshot(page, observer.locator("canvas"));
  const webgpuOpticalAxisViewState = await readObserverViewState(observer);
  expect(vectorsMatch(webglOpticalAxisViewState.position, webgpuOpticalAxisViewState.position)).toBe(true);
  expect(vectorsMatch(webglOpticalAxisViewState.target, webgpuOpticalAxisViewState.target)).toBe(true);
  await setObserverViewFocus(page, observer, "scene");
  await applyOverlayVisibility(page, observer, candidateOverlayVisibility);
  await restoreSceneViewport(page);
  await mkdir(testInfo.outputDir, { recursive: true });
  await Promise.all([
    writeFile(testInfo.outputPath("architecture-rise-webgl-focus-chart-no-overlays.png"), webglFocusChartCapture),
    writeFile(testInfo.outputPath("architecture-rise-webgl-optical-geometry-only.png"), webglOpticalGeometryCapture),
    writeFile(testInfo.outputPath("architecture-rise-webgpu-focus-chart-no-overlays.png"), webgpuFocusChartCapture),
    writeFile(testInfo.outputPath("architecture-rise-webgpu-optical-geometry-only.png"), webgpuOpticalGeometryCapture),
  ]);
  await testInfo.attach("architecture-rise-webgpu-focus-chart-no-overlays.png", {
    body: webgpuFocusChartCapture,
    contentType: "image/png",
  });
  await testInfo.attach("architecture-rise-webgpu-optical-geometry-only.png", {
    body: webgpuOpticalGeometryCapture,
    contentType: "image/png",
  });
  await testInfo.attach("architecture-rise-webgl-focus-chart-no-overlays.png", {
    body: webglFocusChartCapture,
    contentType: "image/png",
  });
  await testInfo.attach("architecture-rise-webgl-optical-geometry-only.png", {
    body: webglOpticalGeometryCapture,
    contentType: "image/png",
  });
  const focusChartReference = decodePngScreenshot(webglFocusChartCapture);
  const focusChartRegion = projectWorldBoundsRegion(
    focusChartReference.width,
    focusChartReference.height,
    webglViewState,
    architectureRiseFocusChartBounds(),
  );
  if (!focusChartRegion) throw new Error("The canonical Architecture Rise focus-chart ROI is not visible in the matched Observer view");
  const toneMappedMaterialPixelEvidence = compareToneMappedMaterialPixels(
    webglFocusChartCapture,
    webgpuFocusChartCapture,
    webglOpticalGeometryCapture,
    webgpuOpticalGeometryCapture,
    focusChartRegion,
    webglOpticalAxisViewState,
    architectureRiseOpticalAxisPolyline(),
  );
  const toneMappedMaterialPixelEvidenceDocument = {
      referenceDimensions: { width: focusChartReference.width, height: focusChartReference.height },
      candidateDimensions: {
        width: decodePngScreenshot(webgpuFocusChartCapture).width,
        height: decodePngScreenshot(webgpuFocusChartCapture).height,
      },
      projectedFocusChartRegion: focusChartRegion,
      evidence: toneMappedMaterialPixelEvidence,
      webglViewState,
      candidateViewState: firstViewState,
      webglOpticalAxisViewState,
      candidateOpticalAxisViewState: webgpuOpticalAxisViewState,
      webglCaptureConfiguration,
      candidateCaptureConfiguration,
    };
  const toneMappedMaterialPixelEvidenceBody = JSON.stringify(toneMappedMaterialPixelEvidenceDocument, null, 2);
  await writeFile(testInfo.outputPath("architecture-rise-tone-mapped-material-pixel-evidence.json"), toneMappedMaterialPixelEvidenceBody);
  await testInfo.attach("architecture-rise-tone-mapped-material-pixel-evidence.json", {
    body: toneMappedMaterialPixelEvidenceBody,
    contentType: "application/json",
  });
  console.info(`Tone-mapped material pixel evidence: ${JSON.stringify(toneMappedMaterialPixelEvidence)}`);
  expect(webglCaptureConfiguration).toEqual(candidateCaptureConfiguration);
  const focusChartViewStable = vectorsMatch(webglViewState.position, await observer.getAttribute("data-observer-camera-position")) &&
    vectorsMatch(webglViewState.target, await observer.getAttribute("data-orbit-target"));
  expect(focusChartViewStable).toBe(true);
  const lineBasicSamples = toneMappedMaterialPixelEvidence.opticalAxisLineBasic;
  const focusChartSamples = toneMappedMaterialPixelEvidence.focusChart;
  if (nativeWebGpuRequired) {
    for (const [role, sample] of Object.entries({
      darkCell: focusChartSamples.darkBasic,
      lightCell: focusChartSamples.lightBasic,
      redCrosshair: focusChartSamples.redCrosshairBasic,
    })) {
      expect(sample.referencePixelCount, `WebGL focus-chart ${role} samples must be visible`).toBeGreaterThan(role === "redCrosshair" ? 5 : 20);
      expect(sample.meanAbsoluteRgbDelta, `native WebGPU focus-chart ${role} must match the tone-mapped WebGL reference`).not.toBeNull();
      expect(sample.meanAbsoluteRgbDelta!, `native WebGPU focus-chart ${role} RGB MAE`).toBeLessThan(5);
    }
    expect(lineBasicSamples.referencePixelCount, "projected tone-mapped optical-axis LineBasic pixels must be visible in the WebGL reference").toBeGreaterThan(10);
    expect(lineBasicSamples.meanAbsoluteRgbDelta, "native WebGPU cyan LineBasic must match WebGL tone-mapping semantics").not.toBeNull();
    expect(lineBasicSamples.meanAbsoluteRgbDelta!, "native WebGPU cyan LineBasic RGB MAE").toBeLessThan(8);
  }
  if (firstFamily === "webgpu-renderer") {
    const outputFamilies = (JSON.parse(
      (await observer.getAttribute("data-observer-material-inventory")) ?? "{}",
    ) as { families?: Array<Record<string, unknown>> }).families ?? [];
    expect(outputFamilies.some((family) =>
      family.role === "architecture-rise-subject" &&
      family.sourceMaterialFamily === "MeshBasicMaterial" &&
      Number(family.toneMappedInstances) > 0,
    )).toBe(true);
    expect(outputFamilies.some((family) =>
      family.role === "observer-other" &&
      family.sourceMaterialFamily === "LineBasicMaterial" &&
      family.nodeMaterialFamily === "LineBasicNodeMaterial" &&
      Number(family.toneMappedInstances) > 0,
    )).toBe(true);
  }
  const candidateInteractions = await exerciseObserverControls(page, observer);
  expect(candidateInteractions.cameraFocusSelected).toBe(true);
  expect(candidateInteractions.orbitInteractionWorked).toBe(true);
  expect(candidateInteractions.resetRestoredCameraPosition).toBe(true);
  expect(candidateInteractions.resetRestoredOrbitTarget).toBe(true);
  expect(await observer.getAttribute("data-observer-renderer-generation")).toBe(String(firstGeneration));

  const requestsBeforeIneligibleScene = materialAwareModuleRequests.length;
  await navigateWithinSimulator(
    page,
    "/simulator/free/view-camera-anatomy?observerRenderer=webgpu&observerOutput=material-aware&rttDiagnostics=1",
  );
  await expect(observer).toHaveAttribute("data-scene-subject-id", "view-camera-anatomy", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-output-policy-requested", "material-aware");
  await expect(observer).toHaveAttribute("data-observer-output-policy-selected", "standard");
  await expect(observer).toHaveAttribute("data-observer-output-policy-selection-reason", "scene-not-eligible");
  await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard");
  await expect(observer).not.toHaveAttribute("data-observer-material-inventory");
  if (nativeWebGpuRequired) {
    await expect(observer).toHaveAttribute("data-observer-adapter-availability", "available", {
      timeout: 60_000,
    });
    expectNativeWebGpuMount(await readObserverAttributes(observer));
  }
  const anatomyPolicyAttributes = await readObserverAttributes(observer);
  expect(materialAwareModuleRequests).toHaveLength(requestsBeforeIneligibleScene);
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");

  await navigateWithinSimulator(page, candidatePath);
  await expect(observer).toHaveAttribute("data-scene-subject-id", "architecture-rise", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLElement>('[data-testid="scene-canvas"]');
    const family = element?.getAttribute("data-observer-renderer-family");
    const fallback = element?.getAttribute("data-observer-application-fallback");
    return (family === "webgpu-renderer" && element?.getAttribute("data-observer-output-policy-status") === "active") ||
      (family === "webgl-renderer" && fallback === "app-webgl");
  }, undefined, { timeout: 90_000 });
  if (nativeWebGpuRequired) {
    await expect(observer).toHaveAttribute("data-observer-adapter-availability", "available", {
      timeout: 60_000,
    });
    expectNativeWebGpuMount(await readObserverAttributes(observer));
  }
  expect(Number(await observer.getAttribute("data-observer-renderer-generation"))).toBeGreaterThan(firstGeneration);
  const returnedFamily = await observer.getAttribute("data-observer-renderer-family");
  let returnedMaterialInventory: Record<string, unknown> | null = null;
  if (returnedFamily === "webgpu-renderer") {
    await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "material-aware");
    await expect(observer).toHaveAttribute("data-observer-output-policy-status", "active", { timeout: 60_000 });
    const returnedInventory = await observer.getAttribute("data-observer-material-inventory");
    expect(returnedInventory).toBeTruthy();
    returnedMaterialInventory = JSON.parse(returnedInventory ?? "{}") as Record<string, unknown>;
    expect(returnedMaterialInventory.unsupportedMaterialInstances).toBe(0);
  } else {
    await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
    await expect(observer).toHaveAttribute("data-observer-application-fallback", "app-webgl");
    await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard");
  }
  await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 90_000 });
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 90_000 });
  expect(pageErrors).toEqual([]);
  const returnedAttributes = await readObserverAttributes(observer);

  const integrationEvidence = {
    requestedRoute: candidatePath,
    firstMount: {
      rendererFamily: firstMountAttributes["data-observer-renderer-family"],
      executionBackend: firstMountAttributes["data-observer-execution-backend"],
      applicationFallback: firstMountAttributes["data-observer-application-fallback"],
      failureStage: firstMountAttributes["data-observer-renderer-failure-stage"] ?? null,
      generation: firstGeneration,
      materialInventory,
      screenshotPixels: firstScreenshotPixels,
      toneMappedMaterialPixelEvidence: {
        status: firstFamily === "webgpu-renderer" && firstMountAttributes["data-observer-execution-backend"] === "webgpu"
          ? "native-webgpu"
          : "measured-non-native-or-fallback",
        candidateRendererFamily: firstMountAttributes["data-observer-renderer-family"],
        candidateExecutionBackend: firstMountAttributes["data-observer-execution-backend"],
        webglCapture: "architecture-rise-webgl-focus-chart-no-overlays.png",
        candidateCapture: "architecture-rise-webgpu-focus-chart-no-overlays.png",
        webglOpticalGeometryCapture: "architecture-rise-webgl-optical-geometry-only.png",
        candidateOpticalGeometryCapture: "architecture-rise-webgpu-optical-geometry-only.png",
        captureConfiguration: candidateCaptureConfiguration,
        viewState: firstViewState,
      opticalAxisViewState: webgpuOpticalAxisViewState,
        measurements: toneMappedMaterialPixelEvidence,
      },
      interactions: candidateInteractions,
    },
    anatomyCandidateSelection: {
      scene: "view-camera-anatomy",
      requestedRenderer: anatomyPolicyAttributes["data-observer-renderer-request"],
      rendererFamily: anatomyPolicyAttributes["data-observer-renderer-family"],
      executionBackend: anatomyPolicyAttributes["data-observer-execution-backend"],
      applicationFallback: anatomyPolicyAttributes["data-observer-application-fallback"],
      adapterAvailability: anatomyPolicyAttributes["data-observer-adapter-availability"],
      initializationAttempts: anatomyPolicyAttributes["data-observer-webgpu-initialization-attempts"],
      outputPolicy: anatomyPolicyAttributes["data-observer-output-policy-selected"],
      reason: anatomyPolicyAttributes["data-observer-output-policy-selection-reason"],
    },
    returnedArchitectureRise: {
      requestedRenderer: returnedAttributes["data-observer-renderer-request"],
      selectionReason: returnedAttributes["data-observer-selection-reason"],
      rendererAttempt: returnedAttributes["data-observer-renderer-attempt"],
      rendererFamily: returnedAttributes["data-observer-renderer-family"],
      executionBackend: returnedAttributes["data-observer-execution-backend"],
      applicationFallback: returnedAttributes["data-observer-application-fallback"],
      failureStage: returnedAttributes["data-observer-renderer-failure-stage"] ?? null,
      adapterAvailability: returnedAttributes["data-observer-adapter-availability"],
      initializationAttempts: returnedAttributes["data-observer-webgpu-initialization-attempts"],
      outputPolicyRequested: returnedAttributes["data-observer-output-policy-requested"],
      outputPolicySelected: returnedAttributes["data-observer-output-policy-selected"],
      outputPolicy: returnedAttributes["data-observer-output-policy-installed"],
      outputPolicyStatus: returnedAttributes["data-observer-output-policy-status"],
      generation: returnedAttributes["data-observer-renderer-generation"],
      materialInventory: returnedMaterialInventory,
    },
    materialAwareModuleRequests,
    groundGlassContentful: await groundGlass.getAttribute("data-rtt-final-contentful"),
    pageErrors,
  };
  const evidenceBody = JSON.stringify(integrationEvidence, null, 2);
  const evidencePath = testInfo.outputPath("architecture-rise-material-aware-integration.json");
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, evidenceBody);
  await testInfo.attach("architecture-rise-material-aware-integration.json", {
    body: evidenceBody,
    contentType: "application/json",
  });
  console.info(`Architecture Rise material-aware evidence: ${evidencePath}`);
});

test("Observer backend state follows eligible and ineligible SPA scene/request transitions", async ({ page }, testInfo) => {
  test.setTimeout(360_000);
  const pageErrors: string[] = [];
  const webgpuModuleRequests: string[] = [];
  const documentNavigations: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (/three[._/-]webgpu/i.test(request.url())) webgpuModuleRequests.push(request.url());
    if (request.isNavigationRequest() && request.resourceType() === "document") {
      documentNavigations.push(request.url());
    }
  });

  await page.goto("/simulator/free/view-camera-anatomy?rttDiagnostics=1");
  const observer = await waitForMountedObserver(page);
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  const defaultWebglGeneration = Number(
    await observer.getAttribute("data-observer-renderer-generation"),
  );
  expect(webgpuModuleRequests).toEqual([]);

  await navigateWithinSimulator(
    page,
    "/simulator/free/view-camera-anatomy?observerRenderer=webgpu&rttDiagnostics=1",
  );
  await expect.poll(() => webgpuModuleRequests.length, { timeout: 60_000 }).toBe(1);
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", {
    timeout: 60_000,
  });
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  await expect(observer).toHaveAttribute(
    "data-observer-renderer-family",
    /^(webgl-renderer|webgpu-renderer)$/,
    { timeout: 60_000 },
  );
  const firstPilot = await readObserverAttributes(observer);
  expectResolvedWebGpuPilotOutcome(firstPilot);
  expect(Number(firstPilot["data-observer-renderer-generation"])).toBeGreaterThan(
    defaultWebglGeneration,
  );
  if (nativeWebGpuRequired) expectNativeWebGpuMount(firstPilot);

  await navigateWithinSimulator(
    page,
    "/simulator/free/architecture-rise?observerRenderer=webgpu&rttDiagnostics=1",
  );
  await expect(observer).toHaveAttribute("data-scene-subject-id", "architecture-rise", {
    timeout: 60_000,
  });
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute(
    "data-observer-selection-reason",
    "webgpu-pilot-approved",
  );
  await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "verified");
  await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "eligible");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", {
    timeout: 60_000,
  });
  await expect(observer).toHaveAttribute("data-observer-adapter-availability", /^(available|unavailable|api-absent|request-rejected|timed-out)$/);
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  await expect(observer).toHaveAttribute(
    "data-observer-renderer-family",
    /^(webgl-renderer|webgpu-renderer)$/,
    { timeout: 60_000 },
  );
  const architectureRiseRequest = await readObserverAttributes(observer);
  expectResolvedWebGpuPilotOutcome(architectureRiseRequest);
  expect(Number(architectureRiseRequest["data-observer-renderer-generation"])).toBeGreaterThan(
    Number(firstPilot["data-observer-renderer-generation"]),
  );
  await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 60_000 });
  await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  if (nativeWebGpuRequired) {
    expectNativeWebGpuMount(architectureRiseRequest);
  }

  await navigateWithinSimulator(
    page,
    "/simulator/free/table-tilt?observerRenderer=webgpu&rttDiagnostics=1",
  );
  await expect(observer).toHaveAttribute("data-scene-subject-id", "table-tilt", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active");
  await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "scene-requirements-not-declared");
  await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "not-evaluated");
  await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "not-eligible");
  await expect(observer).toHaveAttribute("data-observer-adapter-availability", "not-requested");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "0");
  const unevaluatedScene = await readObserverAttributes(observer);
  expect(Number(unevaluatedScene["data-observer-renderer-generation"])).toBeGreaterThan(
    Number(architectureRiseRequest["data-observer-renderer-generation"]),
  );

  await navigateWithinSimulator(
    page,
    "/simulator/free/architecture-rise?observerRenderer=webgpu&rttDiagnostics=1",
  );
  await expect(observer).toHaveAttribute("data-scene-subject-id", "architecture-rise", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "webgpu-pilot-approved");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute(
    "data-observer-renderer-family",
    /^(webgl-renderer|webgpu-renderer)$/,
    { timeout: 60_000 },
  );
  const returnedArchitectureRise = await readObserverAttributes(observer);
  expectResolvedWebGpuPilotOutcome(returnedArchitectureRise);
  expect(Number(returnedArchitectureRise["data-observer-renderer-generation"])).toBeGreaterThan(
    Number(unevaluatedScene["data-observer-renderer-generation"]),
  );
  if (nativeWebGpuRequired) {
    expectNativeWebGpuMount(returnedArchitectureRise);
  }

  await navigateWithinSimulator(
    page,
    "/simulator/free/architecture-rise?observerRenderer=webgl&rttDiagnostics=1",
  );
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgl");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "default-webgl-request");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  await expect(observer).toHaveAttribute("data-observer-adapter-availability", "not-requested");
  await expect(observer).not.toHaveAttribute("data-observer-webgpu-initialization-attempts");
  const explicitWebgl = await readObserverAttributes(observer);
  expect(Number(explicitWebgl["data-observer-renderer-generation"])).toBeGreaterThan(
    Number(returnedArchitectureRise["data-observer-renderer-generation"]),
  );

  await navigateWithinSimulator(
    page,
    "/simulator/free/architecture-rise?observerRenderer=webgpu&rttDiagnostics=1",
  );
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "webgpu-pilot-approved");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  await expect.poll(
    async () => Number(await observer.getAttribute("data-observer-renderer-generation")),
    { timeout: 60_000 },
  ).toBeGreaterThan(Number(explicitWebgl["data-observer-renderer-generation"]));
  await expect(observer).toHaveAttribute(
    "data-observer-renderer-family",
    /^(webgl-renderer|webgpu-renderer)$/,
    { timeout: 60_000 },
  );
  const sameSceneWebgpu = await readObserverAttributes(observer);
  expectResolvedWebGpuPilotOutcome(sameSceneWebgpu);
  expect(Number(sameSceneWebgpu["data-observer-renderer-generation"])).toBeGreaterThan(
    Number(explicitWebgl["data-observer-renderer-generation"]),
  );
  if (nativeWebGpuRequired) {
    expectNativeWebGpuMount(sameSceneWebgpu);
  }

  await navigateWithinSimulator(
    page,
    "/simulator/free/view-camera-anatomy?observerRenderer=webgpu&rttDiagnostics=1",
  );
  await expect(observer).toHaveAttribute("data-scene-subject-id", "view-camera-anatomy", {
    timeout: 60_000,
  });
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  await expect(observer).toHaveAttribute(
    "data-observer-renderer-family",
    /^(webgl-renderer|webgpu-renderer)$/,
    { timeout: 60_000 },
  );
  const secondPilot = await readObserverAttributes(observer);
  expectResolvedWebGpuPilotOutcome(secondPilot);
  expect(Number(secondPilot["data-observer-renderer-generation"])).toBeGreaterThan(
    Number(sameSceneWebgpu["data-observer-renderer-generation"]),
  );
  expect(webgpuModuleRequests).toHaveLength(1);
  if (nativeWebGpuRequired) {
    expect(secondPilot["data-observer-webgpu-api-present"]).toBe("true");
    expect(secondPilot["data-observer-adapter-availability"]).toBe("available");
    expectNativeWebGpuMount(secondPilot);
  }

  await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute(
    "data-rtt-final-contentful",
    "true",
    { timeout: 60_000 },
  );
  expect(documentNavigations).toHaveLength(1);
  expect(pageErrors).toEqual([]);
  await testInfo.attach("observer-spa-backend-lifecycle.json", {
    body: JSON.stringify({
      documentNavigations,
      webgpuModuleRequests,
      anatomyPilotBeforeSceneChange: firstPilot,
      architectureRiseRequest,
      unevaluatedScene,
      returnedArchitectureRise,
      explicitWebgl,
      sameSceneWebgpu,
      anatomyPilotAfterReturn: secondPilot,
      groundGlassContentful: true,
      pageErrors,
    }, null, 2),
    contentType: "application/json",
  });
});
