import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { arch, platform, release } from "node:os";
import { dirname } from "node:path";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { REVISION } from "three";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../../scenes/presentation/viewCameraAnatomy";
import { toWorld } from "../../render/rttUtils";
import {
  comparePixelRegions,
  decodePlaywrightPng,
  subjectRoiHasMeaningfulPixels,
  summarizePixelRegion,
  type DecodedPng,
  type PixelRegion,
} from "./observerBackendBenchmark";

const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const auditRequestEvent = "vcs:observer-verification:anatomy-material-audit";
const auditResultEvent = "vcs:observer-verification:anatomy-material-audit-result";
const cameraPoseEvent = "vcs:observer-verification:anatomy-view";
const evidenceStates = [
  "initial",
  "registered-target-subject",
  "highlighted-front-standard",
  "highlighted-lens-and-board",
  "aperture-small-opening",
  "bellows-highlighted",
  "rear-standard-highlighted",
  "ground-glass-back",
  "film-holder",
  "camera-support-highlighted",
  "image-circle-lesson",
  "front-rise-adjusted",
  "after-reset",
] as const;

type BackendName = "webgl" | "native-webgpu";
type Bounds = Readonly<{ left: number; top: number; right: number; bottom: number }>;
type Bounds3 = Readonly<{
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}>;
type MaterialRecord = Readonly<{
  role: string;
  cameraPart: string | null;
  owner: string;
  assignments: number;
  objectNames: readonly string[];
  properties: Readonly<{
    id: string;
    type: string;
    family: string;
    color: string | null;
    emissive: string | null;
    toneMapped: boolean;
    opacity: number;
    transparent: boolean;
    blending: number;
    depthTest: boolean;
    depthWrite: boolean;
    side: string;
    alphaTest: number;
    roughness: number | null;
    metalness: number | null;
    textureSlots: Readonly<Record<string, Readonly<{ uuid: string; type: string; colorSpace: string }>>>;
  }>;
}>;
type GeometryRecord = Readonly<{
  role: string;
  owner: string;
  assignments: number;
  objectNames: readonly string[];
  properties: Readonly<{
    id: string;
    type: string;
    vertexCount: number;
    positionAttributeVersion: number | null;
    indexCount: number;
    indexVersion: number | null;
    cachedBoundingBox: Bounds3 | null;
  }>;
}>;
type InventorySnapshot = Readonly<{
  schemaVersion: number;
  sceneId: string;
  generation: number;
  renderer: Readonly<Record<string, unknown>>;
  browser: Readonly<Record<string, string | boolean>>;
  viewport: Readonly<{
    width: number;
    height: number;
    devicePixelRatio: number;
    canvasCssWidth: number;
    canvasCssHeight: number;
    canvasBackingWidth: number;
    canvasBackingHeight: number;
    cameraPosition: readonly number[];
    cameraQuaternion: readonly number[];
    cameraProjectionMatrix: readonly number[];
    orbitTarget: readonly number[] | null;
  }>;
  background: string | null;
  environment: Readonly<{ assigned: boolean; type: string | null; colorSpace: string | null }>;
  lights: readonly Readonly<Record<string, unknown>>[];
  counts: Readonly<Record<string, number>>;
  categories: readonly Readonly<{
    role: string;
    objectCount: number;
    visibleObjectCount: number;
    hiddenObjectCount: number;
    shadowCasterCount: number;
    shadowReceiverCount: number;
    objectNames: readonly string[];
    visibleObjectNames: readonly string[];
    hiddenObjectNames: readonly string[];
    shadowCasterObjectNames: readonly string[];
    shadowReceiverObjectNames: readonly string[];
    renderOrderCounts: Readonly<Record<string, number>>;
  }>[];
  materials: readonly MaterialRecord[];
  geometries: readonly GeometryRecord[];
  projectedRegions: Readonly<Record<string, Bounds | null>>;
  worldBounds: Readonly<Record<string, Bounds3 | null>>;
}>;
type CanvasEvidence = Readonly<{
  width: number;
  height: number;
  sampleCount: number;
  distinctColorBuckets: number;
  meanLuminance: number | null;
  luminanceStandardDeviation: number | null;
}>;
type Capture = Readonly<{
  id: string;
  filename: string;
  state: string;
  backend: BackendName;
  screenshot: Buffer;
  decoded: DecodedPng;
  subjectPixels: CanvasEvidence | null;
  movementState: readonly Readonly<{ label: string; value: string }>[];
  inventory: InventorySnapshot;
  observerAttributes: Record<string, string>;
  groundGlass: Readonly<{
    attributes: Record<string, string>;
    pixels: CanvasEvidence;
  }>;
}>;

const attributes = async (element: import("@playwright/test").Locator) =>
  element.evaluate((node) => Object.fromEntries(
    Array.from(node.attributes)
      .filter((attribute) => attribute.name.startsWith("data-"))
      .map((attribute) => [attribute.name, attribute.value]),
  ));

const summarizeImage = (image: DecodedPng): CanvasEvidence => {
  const summary = summarizePixelRegion(image, {
    left: 0,
    top: 0,
    right: image.width,
    bottom: image.height,
  });
  return {
    width: image.width,
    height: image.height,
    sampleCount: summary.sampleCount,
    distinctColorBuckets: summary.distinctColorBuckets,
    meanLuminance: summary.meanLuminance,
    luminanceStandardDeviation: summary.luminanceStandardDeviation,
  };
};

const meanRgb = (image: DecodedPng, region: PixelRegion) => {
  const left = Math.max(0, Math.min(image.width, Math.floor(region.left)));
  const top = Math.max(0, Math.min(image.height, Math.floor(region.top)));
  const right = Math.max(left, Math.min(image.width, Math.ceil(region.right)));
  const bottom = Math.max(top, Math.min(image.height, Math.ceil(region.bottom)));
  let red = 0;
  let green = 0;
  let blue = 0;
  let pixels = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * image.width + x) * image.channels;
      red += image.pixels[offset] ?? 0;
      green += image.pixels[offset + 1] ?? 0;
      blue += image.pixels[offset + 2] ?? 0;
      pixels += 1;
    }
  }
  return pixels > 0
    ? { red: red / pixels, green: green / pixels, blue: blue / pixels, pixels }
    : { red: null, green: null, blue: null, pixels: 0 };
};

const regionInPixels = (bounds: Bounds, image: DecodedPng): PixelRegion => ({
  left: Math.floor(bounds.left * image.width),
  top: Math.floor(bounds.top * image.height),
  right: Math.ceil(bounds.right * image.width),
  bottom: Math.ceil(bounds.bottom * image.height),
});

const readInventory = async (page: Page, requestId: string): Promise<InventorySnapshot> => {
  const observer = page.getByTestId("scene-canvas");
  return observer.evaluate((element, payload) => new Promise<InventorySnapshot>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      element.removeEventListener(payload.resultEvent, onResult);
      reject(new Error("Timed out waiting for the mounted Anatomy scene inventory"));
    }, 10_000);
    const onResult = (event: Event) => {
      const result = (event as CustomEvent<{ requestId: string; snapshot: InventorySnapshot }>).detail;
      if (result?.requestId !== payload.requestId) return;
      window.clearTimeout(timeout);
      element.removeEventListener(payload.resultEvent, onResult);
      resolve(result.snapshot);
    };
    element.addEventListener(payload.resultEvent, onResult);
    element.dispatchEvent(new CustomEvent(payload.requestEvent, { detail: { requestId: payload.requestId } }));
  }), { requestId, requestEvent: auditRequestEvent, resultEvent: auditResultEvent });
};

const stabilizeFrame = async (page: Page): Promise<void> => {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }));
};

const setCameraPose = async (
  page: Page,
  position: readonly number[],
  target: readonly number[],
): Promise<void> => {
  await page.getByTestId("scene-canvas").evaluate((element, payload) => {
    element.dispatchEvent(new CustomEvent(payload.eventName, {
      detail: { position: payload.position, target: payload.target },
    }));
  }, { eventName: cameraPoseEvent, position: [...position], target: [...target] });
  await stabilizeFrame(page);
};

const captureState = async (
  page: Page,
  backend: BackendName,
  state: string,
  pose: Readonly<{ position: readonly number[]; target: readonly number[] }>,
  testInfo: TestInfo,
): Promise<Capture> => {
  const observer = page.getByTestId("scene-canvas");
  await setCameraPose(page, pose.position, pose.target);
  const inventory = await readInventory(page, `${backend}-${state}`);
  const screenshot = await observer.locator("canvas").screenshot({ animations: "disabled" });
  const decoded = decodePlaywrightPng(screenshot);
  const subjectBounds = inventory.projectedRegions.registeredTargetSubject;
  const subjectPixels = subjectBounds
    ? summarizePixelRegion(decoded, regionInPixels(subjectBounds, decoded))
    : null;
  const groundGlass = page.getByTestId("ground-glass-rtt");
  const groundGlassAttributes = await attributes(groundGlass);
  const groundGlassScreenshot = await groundGlass.locator("canvas").first().screenshot({ animations: "disabled" });
  const groundGlassImage = decodePlaywrightPng(groundGlassScreenshot);
  const groundGlassPixels = summarizeImage(groundGlassImage);
  const movementState = await page.locator('input[type="range"]').evaluateAll((inputs) =>
    inputs.map((input, index) => {
      const range = input as HTMLInputElement;
      const labels = Array.from(range.labels ?? []).map((label) => label.textContent?.trim()).filter(Boolean);
      return {
        label: range.getAttribute("aria-label") || labels.join(" ") || range.id || `range-${index}`,
        value: range.value,
      };
    }),
  );
  const filename = `${backend}-${state}.png`;
  const output = testInfo.outputPath(filename);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, screenshot);
  await testInfo.attach(filename, { body: screenshot, contentType: "image/png" });

  return {
    id: `${backend}/${state}`,
    filename,
    state,
    backend,
    screenshot,
    decoded,
    subjectPixels: subjectPixels
      ? {
          width: decoded.width,
          height: decoded.height,
          sampleCount: subjectPixels.sampleCount,
          distinctColorBuckets: subjectPixels.distinctColorBuckets,
          meanLuminance: subjectPixels.meanLuminance,
          luminanceStandardDeviation: subjectPixels.luminanceStandardDeviation,
        }
      : null,
    movementState,
    inventory,
    observerAttributes: await attributes(observer),
    groundGlass: { attributes: groundGlassAttributes, pixels: groundGlassPixels },
  };
};

const waitForInitialState = async (page: Page, backend: BackendName): Promise<Readonly<{
  position: number[];
  target: number[];
}>> => {
  await page.goto("/simulator/free/view-camera-anatomy?lesson=1&observerMaterialAudit=1&rttDiagnostics=1" +
    (backend === "native-webgpu" ? "&observerRenderer=webgpu" : ""));
  const observer = page.getByTestId("scene-canvas");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", /^(webgl-renderer|webgpu-renderer)$/);
  await expect(observer).toHaveAttribute("data-observer-execution-backend", /^(webgl2|webgpu|webgl2-fallback)$/);
  await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard");
  await expect(observer).toHaveAttribute("data-scene-subject-id", "view-camera-anatomy");
  await expect(page.locator(".anatomy-lesson-panel").getByRole("heading", { level: 3 })).toHaveText("The complete camera");
  await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 90_000 });
  await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute("data-rtt-camera-ok", "true");

  if (backend === "webgl") {
    await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgl");
    await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
    await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
    await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
    await expect(observer).not.toHaveAttribute("data-observer-webgpu-initialization-attempts");
  } else {
    await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgpu");
    await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgpu-renderer");
    await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgpu");
    await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
    await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
    await expect(observer).toHaveAttribute("data-observer-adapter-availability", "available");
    await expect(observer).not.toHaveAttribute("data-observer-renderer-failure-stage");
  }

  const positionText = await observer.getAttribute("data-observer-camera-position");
  const targetText = await observer.getAttribute("data-orbit-target");
  if (!positionText || !targetText) throw new Error("Anatomy Observer did not expose its active camera pose");
  return {
    position: positionText.split(",").map(Number),
    target: targetText.split(",").map(Number),
  };
};

const captureBackend = async (
  browser: Browser,
  backend: BackendName,
  pose: Readonly<{ position: readonly number[]; target: readonly number[] }> | null,
  testInfo: TestInfo,
) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  try {
    const initialPose = await waitForInitialState(page, backend);
    const cameraPose = pose ?? initialPose;
    const subjectBounds = VIEW_CAMERA_ANATOMY_PRESENTATION.geometry.bounds;
    const subjectTarget = [
      toWorld((subjectBounds.min.x + subjectBounds.max.x) / 2),
      toWorld((subjectBounds.min.y + subjectBounds.max.y) / 2),
      toWorld((subjectBounds.min.z + subjectBounds.max.z) / 2),
    ];
    const subjectPose = {
      target: subjectTarget,
      position: [subjectTarget[0] + 0.55, subjectTarget[1] + 0.3, subjectTarget[2] + 1.2],
    };
    await setCameraPose(page, cameraPose.position, cameraPose.target);
    const panel = page.locator(".anatomy-lesson-panel");
    const heading = panel.getByRole("heading", { level: 3 });
    const next = panel.getByRole("button", { name: "Next", exact: true });
    const captures: Capture[] = [];
    const capture = async (
      state: typeof evidenceStates[number],
      capturePose: Readonly<{ position: readonly number[]; target: readonly number[] }> = cameraPose,
    ) => {
      await expect(heading).toHaveText(state === "initial" || state === "after-reset" || state === "registered-target-subject"
        ? "The complete camera"
        : state === "highlighted-front-standard" ? "Front Standard"
        : state === "highlighted-lens-and-board" ? "Lens and Lens Board"
        : state === "aperture-small-opening" ? "Aperture"
        : state === "bellows-highlighted" ? "Bellows"
        : state === "rear-standard-highlighted" ? "Rear Standard"
        : state === "ground-glass-back" ? "Ground Glass"
        : state === "film-holder" ? "Film Holder"
        : state === "camera-support-highlighted" ? "Camera Support"
        : state === "image-circle-lesson" ? "Understanding the Image Circle"
        : "Front Rise");
      await stabilizeFrame(page);
      const result = await captureState(page, backend, state, capturePose, testInfo);
      const subjectSummary = result.subjectPixels;
      if (state === "registered-target-subject") {
        expect(subjectSummary, `${backend}/${state} must project the registered target subject into the Observer`).not.toBeNull();
      }
      if (state === "registered-target-subject") expect(subjectRoiHasMeaningfulPixels(subjectSummary
        ? {
            region: { left: 0, top: 0, right: subjectSummary.width, bottom: subjectSummary.height },
            sampleCount: subjectSummary.sampleCount,
            distinctColorBuckets: subjectSummary.distinctColorBuckets,
            meanLuminance: subjectSummary.meanLuminance,
            luminanceStandardDeviation: subjectSummary.luminanceStandardDeviation,
          }
        : null), `${backend}/${state} registered-subject ROI must contain structured visible pixels`).toBe(true);
      expect(result.groundGlass.attributes["data-rtt-final-contentful"]).toBe("true");
      expect(result.groundGlass.attributes["data-rtt-camera-ok"]).toBe("true");
      expect(result.groundGlass.pixels.distinctColorBuckets).toBeGreaterThan(4);
      expect(result.groundGlass.pixels.luminanceStandardDeviation ?? 0).toBeGreaterThan(1);
      captures.push(result);
      return result;
    };

    const subjectCapture = await capture("registered-target-subject", subjectPose);
    expect(subjectCapture.inventory.projectedRegions.registeredTargetSubject).not.toBeNull();
    const initial = await capture("initial", cameraPose);
    const activePose = initial.inventory.viewport;
    expect(activePose.devicePixelRatio).toBe(1);
    expect(activePose.width).toBe(1440);
    expect(activePose.height).toBe(1000);
    expect(activePose.canvasBackingWidth).toBeGreaterThan(0);
    expect(activePose.canvasBackingHeight).toBeGreaterThan(0);

    const advance = async (title: string) => {
      await next.click();
      await expect(heading).toHaveText(title);
    };
    await advance("Front Standard");
    await capture("highlighted-front-standard");
    await advance("Lens and Lens Board");
    await capture("highlighted-lens-and-board");
    await advance("Aperture");
    await panel.getByRole("button", { name: "Show a smaller opening", exact: true }).click();
    await capture("aperture-small-opening");
    await advance("Bellows");
    await capture("bellows-highlighted");
    await advance("Rear Standard");
    await capture("rear-standard-highlighted");
    await advance("Ground Glass");
    await capture("ground-glass-back");
    await advance("Film Holder");
    await capture("film-holder");
    await advance("Camera Support");
    await capture("camera-support-highlighted");
    await advance("Recap");
    await advance("Now try the controls");
    await advance("Understanding the Image Circle");
    const imageCircleObserver = page.getByTestId("scene-canvas");
    await expect(imageCircleObserver).toHaveAttribute("data-conceptual-image-circle-visible", "true");
    const imageCircleCapture = await capture("image-circle-lesson");
    expect(imageCircleCapture.inventory.projectedRegions).toHaveProperty("conceptualCamera");
    await advance("Front Rise");
    await page.getByRole("slider", { name: "Front Rise", exact: true }).fill("12");
    await capture("front-rise-adjusted");
    await advance("Front Shift");
    await page.getByRole("slider", { name: "Front Shift", exact: true }).fill("12");
    await advance("Front Tilt");
    await page.getByRole("slider", { name: "Front Tilt", exact: true }).fill("3");
    await advance("Front Swing");
    await page.getByRole("slider", { name: "Front Swing", exact: true }).fill("3");
    await advance("Focus — Front Standard");
    await page.getByRole("slider", { name: "Focus distance", exact: true }).fill("2200");
    await advance("Focus — Rear Standard");
    await page.getByRole("slider", { name: "Focus distance", exact: true }).fill("2200");
    await advance("Aperture control");
    await page.getByRole("radiogroup", { name: "Aperture", exact: true })
      .getByRole("radio", { name: "f/5.6" }).check();
    await advance("Controls recap");
    await expect(panel.getByRole("status")).toHaveText("Lesson complete");
    await panel.getByRole("button", { name: "Restart lesson", exact: true }).click();
    await expect(heading).toHaveText("The complete camera");
    const reset = await capture("after-reset");

    const observer = page.getByTestId("scene-canvas");
    const observerAttributes = await attributes(observer);
    const runtime = {
      browserVersion: browser.version(),
      os: { platform: platform(), release: release(), architecture: arch() },
      threeRevision: REVISION,
      observerAttributes,
      pageErrors,
      captureCount: captures.length,
      groundGlassContentfulForEveryCapture: captures.every((item) =>
        item.groundGlass.attributes["data-rtt-final-contentful"] === "true" &&
        item.groundGlass.pixels.distinctColorBuckets > 4),
      initialAndResetSubjectBoundsMatch:
        JSON.stringify(initial.inventory.projectedRegions.registeredTargetSubject) ===
        JSON.stringify(reset.inventory.projectedRegions.registeredTargetSubject),
    };
    expect(pageErrors, `${backend} must not produce page or console errors`).toEqual([]);
    return { context, captures, runtime };
  } catch (error) {
    await context.close();
    throw error;
  }
};

const unionBounds = (first: Bounds, second: Bounds): Bounds => ({
  left: Math.min(first.left, second.left),
  top: Math.min(first.top, second.top),
  right: Math.max(first.right, second.right),
  bottom: Math.max(first.bottom, second.bottom),
});

const roleRegionNames = (snapshot: InventorySnapshot): string[] => Object.keys(snapshot.projectedRegions)
  .filter((name) => name === "registeredTargetSubject" || name.startsWith("registeredTargetPart:") ||
    name.startsWith("cameraPart:") || name.startsWith("opticalHelper:") ||
    name === "conceptualCamera" || name === "ghostReferenceCamera")
  .sort();

const compareBackendCaptures = (webgl: readonly Capture[], native: readonly Capture[]) =>
  evidenceStates.map((state) => {
    const first = webgl.find((capture) => capture.state === state);
    const second = native.find((capture) => capture.state === state);
    if (!first || !second) throw new Error(`Missing matched captures for ${state}`);
    if (first.decoded.width !== second.decoded.width || first.decoded.height !== second.decoded.height) {
      throw new Error(`Backend captures for ${state} have incompatible dimensions`);
    }
    expect(first.inventory.viewport.devicePixelRatio).toBe(second.inventory.viewport.devicePixelRatio);
    expect(first.inventory.viewport.width).toBe(second.inventory.viewport.width);
    expect(first.inventory.viewport.height).toBe(second.inventory.viewport.height);
    expect(first.inventory.viewport.canvasCssWidth).toBe(second.inventory.viewport.canvasCssWidth);
    expect(first.inventory.viewport.canvasCssHeight).toBe(second.inventory.viewport.canvasCssHeight);
    expect(first.inventory.viewport.canvasBackingWidth).toBe(second.inventory.viewport.canvasBackingWidth);
    expect(first.inventory.viewport.canvasBackingHeight).toBe(second.inventory.viewport.canvasBackingHeight);
    expect(first.inventory.viewport.cameraPosition).toEqual(second.inventory.viewport.cameraPosition);
    expect(first.inventory.viewport.cameraQuaternion).toEqual(second.inventory.viewport.cameraQuaternion);
    const screenProjection = (matrix: readonly number[]) => matrix
      .filter((_, index) => index !== 10 && index !== 14);
    expect(screenProjection(first.inventory.viewport.cameraProjectionMatrix))
      .toEqual(screenProjection(second.inventory.viewport.cameraProjectionMatrix));
    expect(first.inventory.viewport.orbitTarget).toEqual(second.inventory.viewport.orbitTarget);
    const measurements = roleRegionNames(first.inventory).flatMap((name) => {
      const firstBounds = first.inventory.projectedRegions[name];
      const secondBounds = second.inventory.projectedRegions[name];
      if (!firstBounds || !secondBounds) return [];
      const bounds = unionBounds(firstBounds, secondBounds);
      const region = regionInPixels(bounds, first.decoded);
      return [{
        regionName: name,
        normalizedRegion: bounds,
        webglMeanRgb: meanRgb(first.decoded, region),
        nativeWebGpuMeanRgb: meanRgb(second.decoded, region),
        subjectRoiColorEvidence: name === "registeredTargetSubject"
          ? {
              webgl: summarizePixelRegion(first.decoded, region),
              nativeWebGpu: summarizePixelRegion(second.decoded, region),
            }
          : undefined,
        webglVsNativeWebGpu: comparePixelRegions(first.decoded, second.decoded, region, 8),
      }];
    });
    const backgroundBounds = { left: 0.015, top: 0.015, right: 0.085, bottom: 0.085 };
    const backgroundRegion = regionInPixels(backgroundBounds, first.decoded);
    return {
      state,
      screenshotDimensions: { width: first.decoded.width, height: first.decoded.height },
      measurements,
      backgroundReference: {
        normalizedRegion: backgroundBounds,
        webglMeanRgb: meanRgb(first.decoded, backgroundRegion),
        nativeWebGpuMeanRgb: meanRgb(second.decoded, backgroundRegion),
        webglVsNativeWebGpu: comparePixelRegions(first.decoded, second.decoded, backgroundRegion, 8),
      },
    };
  });

const materialForObject = (capture: Capture, objectName: string): MaterialRecord => {
  const material = capture.inventory.materials.find((entry) => entry.objectNames.includes(objectName));
  if (!material) throw new Error(`Material inventory omitted renderable ${objectName} in ${capture.id}`);
  return material;
};

const geometryForObject = (capture: Capture, objectName: string): GeometryRecord => {
  const geometry = capture.inventory.geometries.find((entry) => entry.objectNames.includes(objectName));
  if (!geometry) throw new Error(`Geometry inventory omitted renderable ${objectName} in ${capture.id}`);
  return geometry;
};

const captureForState = (captures: readonly Capture[], state: string): Capture => {
  const capture = captures.find((entry) => entry.state === state);
  if (!capture) throw new Error(`Anatomy audit is missing ${state}`);
  return capture;
};

const verifyDynamicPresentationInventory = (captures: readonly Capture[]) => {
  const initial = captureForState(captures, "initial");
  const highlightedLens = captureForState(captures, "highlighted-lens-and-board");
  const dimmedBellows = materialForObject(highlightedLens, "bellows-folded-surface");
  const normalLens = materialForObject(initial, "lens-front-barrel");
  const activeLens = materialForObject(highlightedLens, "lens-front-barrel");
  expect(activeLens.properties.id, "R3F should update the lens presentation on the mounted material").toBe(normalLens.properties.id);
  expect(activeLens.properties.color, "the highlighted lens color must change visibly").not.toBe(normalLens.properties.color);
  expect(activeLens.properties.color).toBe("f59e0b");
  expect(dimmedBellows.properties.transparent).toBe(true);
  expect(dimmedBellows.properties.opacity).toBe(0.16);
  expect(dimmedBellows.properties.depthWrite).toBe(false);

  const aperture = captureForState(captures, "aperture-small-opening");
  expect(geometryForObject(aperture, "lens-aperture-blade-0-surface").properties.id)
    .not.toBe(geometryForObject(initial, "lens-aperture-blade-0-surface").properties.id);
  expect(materialForObject(aperture, "lens-aperture-blade-0-surface").properties.side).toBe("double");

  const groundGlassBack = captureForState(captures, "ground-glass-back");
  const filmHolder = captureForState(captures, "film-holder");
  expect(groundGlassBack.inventory.categories.flatMap((category) => category.objectNames))
    .toContain("ground-glass-screen");
  expect(filmHolder.inventory.categories.flatMap((category) => category.objectNames))
    .toContain("film-holder-body");
  expect(filmHolder.inventory.categories.flatMap((category) => category.objectNames))
    .not.toContain("ground-glass-screen");

  const imageCircleLesson = captureForState(captures, "image-circle-lesson");
  expect(imageCircleLesson.inventory.projectedRegions).toHaveProperty("conceptualCamera");

  const moved = captureForState(captures, "front-rise-adjusted");
  expect(moved.observerAttributes["data-lens-coverage-visible"]).toBe("true");
  expect(new Set(moved.inventory.materials.map((entry) => entry.properties.family)))
    .toContain("LineBasicMaterial");
  expect(moved.inventory.categories.some((category) => category.role === "optical-helper")).toBe(true);
  expect(geometryForObject(moved, "bellows-folded-surface").properties.id)
    .toBe(geometryForObject(initial, "bellows-folded-surface").properties.id);
  expect(geometryForObject(moved, "bellows-folded-surface").properties.positionAttributeVersion)
    .toBeGreaterThan(geometryForObject(initial, "bellows-folded-surface").properties.positionAttributeVersion ?? -1);
  expect(moved.movementState).toContainEqual({ label: "Front Rise", value: "12" });
  const reset = captureForState(captures, "after-reset");
  expect(reset.inventory.worldBounds["cameraPart:bellows"])
    .toEqual(initial.inventory.worldBounds["cameraPart:bellows"]);
  expect(reset.inventory.projectedRegions["cameraPart:bellows"])
    .toEqual(initial.inventory.projectedRegions["cameraPart:bellows"]);
  expect(reset.inventory.worldBounds.conceptualCamera)
    .toEqual(initial.inventory.worldBounds.conceptualCamera);

  for (const capture of [
    initial,
    captureForState(captures, "bellows-highlighted"),
    moved,
    reset,
  ]) {
    for (const regionName of ["cameraPart:bellows", "conceptualCamera"]) {
      const worldBounds = capture.inventory.worldBounds[regionName];
      const projectedRegion = capture.inventory.projectedRegions[regionName];
      expect(worldBounds, `${capture.id} ${regionName} world bounds must be recorded`).not.toBeNull();
      expect(projectedRegion, `${capture.id} ${regionName} projected ROI must be recorded`).not.toBeNull();
      expect(worldBounds && [...worldBounds.min, ...worldBounds.max].every(Number.isFinite)).toBe(true);
    }
    const bellowsGeometry = geometryForObject(capture, "bellows-folded-surface").properties;
    expect(bellowsGeometry.id).toBeTruthy();
    expect(typeof bellowsGeometry.positionAttributeVersion).toBe("number");
    expect(bellowsGeometry).toHaveProperty("cachedBoundingBox");
  }

  const sourceMaterials = initial.inventory.materials
    .filter((entry) => entry.role === "registered-target-subject")
    .map((entry) => entry.properties.id)
    .sort();
  const sourceMaterialSignatures = JSON.stringify(initial.inventory.materials
    .filter((entry) => entry.role === "registered-target-subject")
    .map((entry) => ({ assignments: entry.assignments, properties: entry.properties }))
    .sort((left, right) => left.properties.id.localeCompare(right.properties.id)));
  expect(sourceMaterials).toHaveLength(5);
  expect(initial.inventory.geometries.filter((entry) => entry.role === "registered-target-subject")).toHaveLength(1);
  for (const capture of captures) {
    const subjectMaterials = capture.inventory.materials
      .filter((entry) => entry.role === "registered-target-subject");
    expect(subjectMaterials
      .map((entry) => entry.properties.id)
      .sort(), `module-shared Anatomy material identities changed during ${capture.id}`)
      .toEqual(sourceMaterials);
    expect(JSON.stringify(subjectMaterials
      .map((entry) => ({ assignments: entry.assignments, properties: entry.properties }))
      .sort((left, right) => left.properties.id.localeCompare(right.properties.id))),
    `module-shared Anatomy material properties changed during ${capture.id}`)
      .toBe(sourceMaterialSignatures);
  }
  const targetSubject = initial.inventory.categories.find((entry) => entry.role === "registered-target-subject");
  expect(targetSubject?.objectCount).toBe(17);
  expect(targetSubject?.visibleObjectCount).toBe(17);
  expect(targetSubject?.hiddenObjectCount).toBe(0);
  expect(targetSubject?.shadowCasterCount).toBe(17);
  expect(targetSubject?.shadowReceiverCount).toBe(0);
  const cameraCategories = initial.inventory.categories
    .filter((entry) => entry.role.startsWith("conceptual-camera/"));
  expect(cameraCategories).toHaveLength(7);
  expect(cameraCategories.reduce((total, entry) => total + entry.shadowCasterCount, 0)).toBe(0);
  expect(cameraCategories.reduce((total, entry) => total + entry.shadowReceiverCount, 0)).toBe(0);
  const cameraPartsAcrossLesson = new Set(captures.flatMap((capture) => capture.inventory.categories
    .map((entry) => entry.role)
    .filter((role) => role.startsWith("conceptual-camera/"))
    .map((role) => role.slice("conceptual-camera/".length))));
  expect([...cameraPartsAcrossLesson].sort()).toEqual([
    "bellows",
    "camera-support",
    "film-holder",
    "front-standard",
    "ground-glass-back",
    "lens",
    "lens-board",
    "rear-standard",
  ]);
  expect(initial.inventory.lights.filter((light) => light.family === "HemisphereLight")).toHaveLength(1);
  expect(initial.inventory.lights.filter((light) => light.family === "DirectionalLight" && light.castShadow === true)).toHaveLength(1);
  expect(initial.inventory.projectedRegions.ghostReferenceCamera).toBeUndefined();
  return {
    owner: "module-shared-asset-source",
    uniqueSourceMaterials: sourceMaterials.length,
    uniqueSourceGeometries: initial.inventory.geometries.filter((entry) => entry.role === "registered-target-subject").length,
    meshAssignments: targetSubject?.objectCount ?? 0,
    targetShadowCasters: targetSubject?.shadowCasterCount ?? 0,
    targetShadowReceivers: targetSubject?.shadowReceiverCount ?? 0,
    conceptualCameraSemanticPartCount: cameraPartsAcrossLesson.size,
    conceptualCameraShadowCasters: cameraCategories.reduce((total, entry) => total + entry.shadowCasterCount, 0),
    conceptualCameraShadowReceivers: cameraCategories.reduce((total, entry) => total + entry.shadowReceiverCount, 0),
    lighting: initial.inventory.lights,
    moduleSharedTargetIdentityAndPropertiesStableAcrossLessonStates: true,
    ghostCameraMounted: initial.inventory.projectedRegions.ghostReferenceCamera !== undefined,
  };
};

const materialAwareNodeFamilyBySourceFamily: Readonly<Record<string, string>> = {
  MeshStandardMaterial: "MaterialAwareStandardNodeMaterial",
  MeshBasicMaterial: "MaterialAwareBasicNodeMaterial",
  LineBasicMaterial: "MaterialAwareLineNodeMaterial",
};

const createCompatibilityMatrix = (captures: readonly Capture[]) => {
  const groups = new Map<string, {
    role: string;
    sourceFamily: string;
    backend: BackendName;
    owner: string;
    instances: Set<string>;
    assignmentsByState: Map<string, number>;
    states: Set<string>;
    toneMappedValues: Set<boolean>;
    transparentInstances: Set<string>;
    depthTestValues: Set<boolean>;
    depthWriteValues: Set<boolean>;
    sides: Set<string>;
    textureSlots: Set<string>;
  }>();
  captures.forEach((capture) => {
    capture.inventory.materials.forEach((entry) => {
      const key = `${capture.backend}/${entry.role}/${entry.properties.family}`;
      const group = groups.get(key) ?? {
        role: entry.role,
        sourceFamily: entry.properties.family,
        backend: capture.backend,
        owner: entry.owner,
        instances: new Set<string>(),
        assignmentsByState: new Map<string, number>(),
        states: new Set<string>(),
        toneMappedValues: new Set<boolean>(),
        transparentInstances: new Set<string>(),
        depthTestValues: new Set<boolean>(),
        depthWriteValues: new Set<boolean>(),
        sides: new Set<string>(),
        textureSlots: new Set<string>(),
      };
      group.instances.add(entry.properties.id);
      group.assignmentsByState.set(
        capture.state,
        (group.assignmentsByState.get(capture.state) ?? 0) + entry.assignments,
      );
      group.states.add(capture.state);
      group.toneMappedValues.add(entry.properties.toneMapped);
      if (entry.properties.transparent) group.transparentInstances.add(entry.properties.id);
      group.depthTestValues.add(entry.properties.depthTest);
      group.depthWriteValues.add(entry.properties.depthWrite);
      group.sides.add(entry.properties.side);
      Object.keys(entry.properties.textureSlots).forEach((slot) => group.textureSlots.add(slot));
      groups.set(key, group);
    });
  });
  return [...groups.values()].map((group) => ({
    backend: group.backend,
    role: group.role,
    sourceMaterialFamily: group.sourceFamily,
    distinctSourceMaterials: group.instances.size,
    maxSimultaneousMeshMaterialAssignments: Math.max(0, ...group.assignmentsByState.values()),
    observedStates: [...group.states].sort(),
    owner: group.owner,
    candidateNodeMaterialFamily: materialAwareNodeFamilyBySourceFamily[group.sourceFamily] ?? null,
    candidateFamilySupportedByExistingAdapter: group.sourceFamily in materialAwareNodeFamilyBySourceFamily,
    integrationStatus: "family support is source-level evidence; Anatomy adaptation is not implemented or validated",
    toneMappedValues: [...group.toneMappedValues].sort(),
    transparentMaterialInstances: group.transparentInstances.size,
    depthTestValues: [...group.depthTestValues].sort(),
    depthWriteValues: [...group.depthWriteValues].sort(),
    sides: [...group.sides].sort(),
    textureSlots: [...group.textureSlots].sort(),
    adapterOwnerRequirement: group.owner === "module-shared-asset-source"
      ? "Observer-owned NodeMaterial copies; never mutate/dispose module-shared source resources"
      : "Observer controller owns adapted NodeMaterials; preserve component material lifecycle",
  })).sort((left, right) => `${left.backend}/${left.role}/${left.sourceMaterialFamily}`
    .localeCompare(`${right.backend}/${right.role}/${right.sourceMaterialFamily}`));
};

test("View Camera Anatomy runtime material audit records matched WebGL and native WebGPU states", async ({ browser }, testInfo) => {
  test.setTimeout(300_000);
  expect(nativeRequired, "Run this evidence audit with OBSERVER_NATIVE_WEBGPU_REQUIRED=1 and headed Chrome").toBe(true);

  const webgl = await captureBackend(browser, "webgl", null, testInfo);
  const webglSharedResources = verifyDynamicPresentationInventory(webgl.captures);
  const initialWebgl = webgl.captures.find((capture) => capture.state === "initial");
  if (!initialWebgl) throw new Error("The WebGL initial capture is missing");
  const initialOrbitTarget = initialWebgl.inventory.viewport.orbitTarget;
  if (!initialOrbitTarget) throw new Error("The WebGL inventory is missing the active orbit target");
  const nativeWebGpu = await captureBackend(browser, "native-webgpu", {
      position: initialWebgl.inventory.viewport.cameraPosition,
      target: initialOrbitTarget,
  }, testInfo);
  const nativeSharedResources = verifyDynamicPresentationInventory(nativeWebGpu.captures);

  const nativeInitial = nativeWebGpu.captures.find((capture) => capture.state === "initial");
  if (!nativeInitial) throw new Error("The native WebGPU initial capture is missing");
  expect(nativeInitial.observerAttributes["data-observer-renderer-family"]).toBe("webgpu-renderer");
  expect(nativeInitial.observerAttributes["data-observer-execution-backend"]).toBe("webgpu");
  expect(nativeInitial.observerAttributes["data-observer-application-fallback"]).toBe("none");
  expect(nativeInitial.observerAttributes["data-observer-webgpu-initialization-attempts"]).toBe("1");
  expect(nativeInitial.observerAttributes["data-observer-adapter-availability"]).toBe("available");
  expect(nativeInitial.observerAttributes["data-observer-renderer-failure-stage"]).toBeUndefined();

  const crossBackendMeasurements = compareBackendCaptures(webgl.captures, nativeWebGpu.captures);
  const report = {
    schemaVersion: 1,
    audit: "view-camera-anatomy-material-aware-compatibility",
    evidenceMethod: "Development-only, read-only R3F scene traversal requested by a test event; material and geometry objects are never changed.",
    projectedBoundsMethod: {
      threeRevision: `r${REVISION}`,
      method: "THREE.Box3.setFromObject(object, true)",
      vertexSource: "Current position attributes via Mesh.getVertexPosition() for meshes.",
      groups: "Descendants are traversed and each child world transform is applied.",
      cachePolicy: "Existing geometry bounding boxes are recorded when present but never computed or replaced by the audit.",
      unsupportedGeometry: "Regions without position attributes or containing InstancedMesh return unknown bounds rather than using a mutating fallback.",
    },
    decisionGate: "K2 — ARCHITECTURE WORK REQUIRED",
    decisionReason: "Native standard WebGPU executes, but the Architecture Rise controller currently binds readiness, subject lookup, inventory schema, ownership, and disposal to Architecture Rise-owned resources. Anatomy source assets are module-shared and dynamic camera materials need an explicit independently owned adapter lifecycle before integration.",
    provenance: {
      measurementCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      browserVersion: nativeWebGpu.runtime.browserVersion,
      operatingSystem: nativeWebGpu.runtime.os,
      threeRevision: nativeWebGpu.runtime.threeRevision,
      hardwareAcceleration: "unconfirmed",
      hardwareAccelerationEvidence: "No independent browser/system GPU diagnostics were collected by this audit.",
      nativeQualification: {
        rendererFamily: nativeInitial.observerAttributes["data-observer-renderer-family"],
        executionBackend: nativeInitial.observerAttributes["data-observer-execution-backend"],
        adapterAvailability: nativeInitial.observerAttributes["data-observer-adapter-availability"],
        applicationFallback: nativeInitial.observerAttributes["data-observer-application-fallback"],
        initializationAttempts: nativeInitial.observerAttributes["data-observer-webgpu-initialization-attempts"],
        initializationFailure: nativeInitial.observerAttributes["data-observer-renderer-failure-stage"] ?? null,
        outputPolicy: nativeInitial.observerAttributes["data-observer-output-policy-installed"],
      },
    },
    runtime: { webgl: webgl.runtime, nativeWebGpu: nativeWebGpu.runtime },
    moduleSharedResources: {
      webgl: webglSharedResources,
      nativeWebGpu: nativeSharedResources,
      groundGlassIdentityEvidence: {
        verificationSource: "src/tests/unit/sharedSceneResourceLifecycle.test.ts (separately executed during audit validation)",
        registeredSubjectRoot: "view-camera-anatomy-subject",
        moduleOwnedResources: { geometries: 1, materials: 5, textures: 0 },
        ownershipContract: "The Observer and Ground Glass receive distinct Object3D groups over the same source geometry/material identity sets; group cleanup must not dispose those module-shared resources.",
      },
    },
    compatibilityMatrix: createCompatibilityMatrix([...webgl.captures, ...nativeWebGpu.captures]),
    existingControllerAssumptions: [
      { assumption: "inventory sceneId is architecture-rise", classification: "scene-specific; must separate from shared output mechanics" },
      { assumption: "subject lookup uses architecture-rise-subject", classification: "scene-specific readiness/ownership adapter" },
      { assumption: "registered subject disposer owns adapted NodeMaterials", classification: "unsafe for Anatomy module-shared source assets; Anatomy adapter must own its copies" },
      { assumption: "source-to-NodeMaterial output conversion and property signatures", classification: "candidate reusable core; verify dynamic semantics with Anatomy tests" },
      { assumption: "background output installation and renderer capability reporting", classification: "potentially reusable renderer-level mechanism" },
    ],
    sourceEvidenceReferences: [
      "src/render/LessonZeroGroundGlassSubjectFactory.tsx",
      "src/render/assets/sceneAssetRegistry.ts",
      "src/render/SceneAssetSubjects.tsx",
      "src/render/sceneSubjectRegistry.tsx",
      "src/render/ConceptualViewCamera.tsx",
      "src/render/anatomyProjectedBounds.ts",
      "src/render/CameraBodyAssembly.tsx",
      "src/render/TeachingLighting.tsx",
      "src/render/backend/materialAwareNodeMaterials.ts",
      "src/render/backend/materialAwareObserverOutput.tsx",
      "src/tests/unit/sharedSceneResourceLifecycle.test.ts",
      "src/tests/unit/anatomyProjectedBounds.test.ts",
    ],
    captureFiles: [...webgl.captures, ...nativeWebGpu.captures].map(({
      id,
      filename,
      state,
      backend,
      inventory,
      movementState,
    }) => ({
      id,
      filename,
      documentationPath: `view-camera-anatomy-material-compatibility/${filename}`,
      state,
      backend,
      renderer: inventory.renderer,
      camera: {
        position: inventory.viewport.cameraPosition,
        quaternion: inventory.viewport.cameraQuaternion,
        projectionMatrix: inventory.viewport.cameraProjectionMatrix,
        orbitTarget: inventory.viewport.orbitTarget,
        viewport: [inventory.viewport.width, inventory.viewport.height],
        devicePixelRatio: inventory.viewport.devicePixelRatio,
        canvasCssSize: [inventory.viewport.canvasCssWidth, inventory.viewport.canvasCssHeight],
        canvasBackingSize: [inventory.viewport.canvasBackingWidth, inventory.viewport.canvasBackingHeight],
      },
      projectedRegions: inventory.projectedRegions,
      worldBounds: inventory.worldBounds,
      movementState,
      subjectPixels: capturesSubjectEvidence(inventory, backend === "webgl" ? webgl.captures : nativeWebGpu.captures, state),
      background: inventory.background,
      environment: inventory.environment,
      lights: inventory.lights,
      groundGlass: {
        attributes: [...webgl.captures, ...nativeWebGpu.captures].find((capture) => capture.id === id)?.groundGlass.attributes,
        pixels: [...webgl.captures, ...nativeWebGpu.captures].find((capture) => capture.id === id)?.groundGlass.pixels,
      },
      counts: inventory.counts,
      categories: inventory.categories,
      materials: inventory.materials,
      geometries: inventory.geometries,
    })),
    crossBackendMeasurements,
    limitations: [
      "This is the standard Anatomy WebGPU baseline. No Anatomy material-aware adapter was installed or exercised.",
      "Pixel differences are descriptive and object-aligned; the audit does not claim visual parity or set a pass threshold.",
      "Hardware acceleration remains unconfirmed.",
      "The independent Ground Glass RTT stays on its existing WebGL path; its content and resource identity are not adapted by this Observer audit.",
    ],
  };
  const reportPath = testInfo.outputPath("view-camera-anatomy-material-inventory.json");
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await testInfo.attach("view-camera-anatomy-material-inventory.json", {
    path: reportPath,
    contentType: "application/json",
  });
  await webgl.context.close();
  await nativeWebGpu.context.close();
});

const capturesSubjectEvidence = (
  _inventory: InventorySnapshot,
  captures: readonly Capture[],
  state: string,
): CanvasEvidence | null => captures.find((capture) => capture.state === state)?.subjectPixels ?? null;
