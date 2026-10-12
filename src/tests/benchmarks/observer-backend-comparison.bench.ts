import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { arch, platform, release } from "node:os";
import { PerspectiveCamera, REVISION, Vector3 } from "three";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../../scenes/presentation/viewCameraAnatomy";
import architectureRiseGeometry, { architectureRiseWindowBays } from "../../scenes/architectureRiseGeometry";
import { toWorld } from "../../render/rttUtils";
import {
  comparePixelRegions,
  decodePlaywrightPng,
  observerBackendMismatches,
  serializeBenchmarkReport,
  summarizeFrameCadence,
  summarizePixelRegion,
  subjectRoiHasMeaningfulPixels,
  type ImageDifferenceSummary,
  type PixelRegion,
} from "./observerBackendBenchmark";

const benchmarkEnabled = process.env.OBSERVER_BACKEND_BENCHMARK === "1";
const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const trialCount = 3;
const viewport = { width: 1440, height: 1000 } as const;
const deviceScaleFactor = 1;
const closeArchitectureView = {
  position: [4.8, 2.7, 4.2] as const,
  target: [0, 1.25, 9.3] as const,
};
const architectureViewEvent = "vcs:observer-verification:architecture-rise-view";
const anatomyViewEvent = "vcs:observer-verification:anatomy-view";
const rAFMeasurementWindowMs = 2500;
const orbitSequence = [
  { deltaX: 72, deltaY: -36, steps: 8 },
  { deltaX: -48, deltaY: 24, steps: 8 },
  { deltaX: 40, deltaY: 18, steps: 8 },
  { deltaX: -56, deltaY: -14, steps: 8 },
] as const;
const benchmarkScenes = ["view-camera-anatomy", "architecture-rise"] as const;

type Vector3Tuple = readonly [number, number, number];
type ObserverView = Readonly<{ position: Vector3Tuple | null; target: Vector3Tuple | null }>;
type ImageRegionEvidence = Readonly<{
  bounds: PixelRegion | null;
  screenshot: ReturnType<typeof summarizePixelRegion> | null;
}>;
type CapturedView = Readonly<{
  viewName: string;
  camera: ObserverView;
  width: number;
  height: number;
  screenshotPath: string;
  screenshotRelativePath: string;
  subjectRegionName: string;
  regions: Record<string, ImageRegionEvidence>;
}>;
type VisualComparison = Readonly<{
  sceneId: string;
  trialNumber: number;
  viewName: string;
  webglScreenshot: string;
  webgpuScreenshot: string;
  dimensions: { width: number; height: number };
  changedChannelThreshold: number;
  roiCoordinates: Record<string, PixelRegion | null>;
  regions: Record<string, ImageDifferenceSummary>;
  interpretation: string;
}>;
type BenchmarkTrial = {
  sceneId: (typeof benchmarkScenes)[number];
  trialNumber: number;
  executionOrder: number;
  orderWithinPair: number;
  requestedBackend: "webgl" | "webgpu";
  mountedBackend: string | null;
  valid: boolean;
  invalidReasons: string[];
  navigationWallMs: { toDocumentReady: number | null; toActiveRenderer: number | null; toFirstContentfulObserverCapture: number | null };
  mountedObserver: Record<string, string>;
  adapter: { apiPresent: string | null; availability: string | null };
  browserGpuDiagnostics: BrowserGpuDiagnostics;
  canonicalState: unknown;
  canvas: { cssWidth: number | null; cssHeight: number | null; backingWidth: number; backingHeight: number; dpr: number } | null;
  sceneResources: unknown;
  environment: { status: string | null; recipeIdentity: string };
  views: CapturedView[];
  interaction: unknown;
  groundGlass: unknown;
  pageErrors: string[];
  consoleErrors: string[];
  webgpuModuleRequests: string[];
};
type BrowserGpuDiagnostics = Readonly<{
  source: "Chrome DevTools Protocol SystemInfo.getInfo" | "unavailable";
  softwareRendererDetected: boolean | null;
  reportedGraphicsBackend: string | null;
  rawDeviceIdentifiersOmitted: true;
}>;

const outputDirectory = resolve(
  process.env.OBSERVER_BACKEND_BENCHMARK_OUTPUT_DIR ??
    join("test-results", "observer-backend-comparison", `manual-${Date.now()}`),
);
const commitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const observerLocator = (page: Page) => page.getByTestId("scene-canvas");

const readObserverAttributes = async (observer: Locator): Promise<Record<string, string>> =>
  observer.evaluate((element) => Object.fromEntries(
    Array.from(element.attributes)
      .filter((attribute) => attribute.name.startsWith("data-observer-"))
      .map((attribute) => [attribute.name, attribute.value]),
  ));

const readObserverView = async (observer: Locator): Promise<ObserverView> => {
  const raw = await observer.evaluate((element) => ({
    position: element.getAttribute("data-observer-camera-position"),
    target: element.getAttribute("data-orbit-target"),
  }));
  const parseVector = (value: string | null): Vector3Tuple | null => {
    if (!value) return null;
    const components = value.split(",").map(Number);
    return components.length === 3 && components.every(Number.isFinite)
      ? [components[0] ?? 0, components[1] ?? 0, components[2] ?? 0]
      : null;
  };
  return { position: parseVector(raw.position), target: parseVector(raw.target) };
};

const vectorsMatch = (first: Vector3Tuple | null, second: Vector3Tuple | null): boolean =>
  first !== null && second !== null && first.every((value, index) =>
    Math.abs(value - (second[index] ?? Number.NaN)) < 1e-5,
  );

const waitForFrames = async (page: Page, count = 3): Promise<void> => {
  await page.evaluate((frames) => new Promise<void>((resolvePromise) => {
    const next = (remaining: number) => {
      if (remaining <= 0) return resolvePromise();
      requestAnimationFrame(() => next(remaining - 1));
    };
    next(frames);
  }), count);
};

const readCanonicalState = async (page: Page, observer: Locator) => {
  const controls = await page.evaluate(() => Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"),
  ).filter((element) => element.getClientRects().length > 0).map((element) => {
    const label = Array.from(element.labels ?? []).map((entry) => entry.textContent?.trim() ?? "")
      .filter(Boolean).join(" / ");
    const input = element instanceof HTMLInputElement ? element : null;
    return {
      label: label || element.getAttribute("aria-label") || element.name || element.tagName.toLowerCase(),
      type: element instanceof HTMLInputElement ? element.type : "select",
      name: element.name,
      value: element.value,
      checked: input?.type === "checkbox" || input?.type === "radio" ? input.checked : null,
      min: input?.type === "range" ? input.min : null,
      max: input?.type === "range" ? input.max : null,
      step: input?.type === "range" ? input.step : null,
    };
  }).filter((entry) => entry.type !== "radio" || entry.checked === true)
    .sort((a, b) => `${a.label}:${a.name}`.localeCompare(`${b.label}:${b.name}`)));
  const attributes = await observer.evaluate((element) => ({
    sceneId: element.getAttribute("data-scene-subject-id"),
    viewFocus: element.getAttribute("data-view-focus"),
    focusOverlayVisible: element.getAttribute("data-focus-overlay-visible"),
    dofOverlayVisible: element.getAttribute("data-dof-overlay-visible"),
    opticalGeometryVisible: element.getAttribute("data-optical-geometry-visible"),
    referenceCameraVisible: element.getAttribute("data-reference-camera-visible"),
    toneMapping: element.getAttribute("data-observer-tone-mapping"),
    exposure: element.getAttribute("data-observer-tone-mapping-exposure"),
    outputColorSpace: element.getAttribute("data-observer-output-color-space"),
    shadowMapStatus: element.getAttribute("data-observer-shadow-map-status"),
    shadowMapType: element.getAttribute("data-observer-shadow-map-type"),
  }));
  const renderQuality = await page.getByLabel("Render quality").inputValue().catch(() => null);
  return {
    controls,
    renderQuality,
    observer: attributes,
    overlays: {
      focusPlane: attributes.focusOverlayVisible,
      depthOfField: attributes.dofOverlayVisible,
      opticalGeometry: attributes.opticalGeometryVisible,
      conceptualCamera: attributes.referenceCameraVisible,
    },
  };
};

const mmBoundsToWorld = (bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }) => ({
  min: [toWorld(bounds.min.x), toWorld(bounds.min.y), toWorld(bounds.min.z)] as const,
  max: [toWorld(bounds.max.x), toWorld(bounds.max.y), toWorld(bounds.max.z)] as const,
});

const projectWorldBounds = (
  bounds: Readonly<{ min: Vector3Tuple; max: Vector3Tuple }>,
  width: number,
  height: number,
  view: ObserverView,
): PixelRegion | null => {
  if (!view.position || !view.target) return null;
  const camera = new PerspectiveCamera(45, width / height, 0.01, 200);
  camera.position.set(...view.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(...view.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const projectedCorners: Vector3[] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const point = new Vector3(x, y, z).project(camera);
        if (point.z >= -1 && point.z <= 1) projectedCorners.push(point);
      }
    }
  }
  if (projectedCorners.length < 2) return null;
  const padding = 4;
  const left = Math.max(0, Math.floor((Math.min(...projectedCorners.map((point) => point.x)) + 1) * 0.5 * width - padding));
  const right = Math.min(width, Math.ceil((Math.max(...projectedCorners.map((point) => point.x)) + 1) * 0.5 * width + padding));
  const top = Math.max(0, Math.floor((1 - Math.max(...projectedCorners.map((point) => point.y))) * 0.5 * height - padding));
  const bottom = Math.min(height, Math.ceil((1 - Math.min(...projectedCorners.map((point) => point.y))) * 0.5 * height + padding));
  return right > left && bottom > top ? { left, top, right, bottom } : null;
};

const percentRegion = (width: number, height: number): PixelRegion => ({
  left: Math.floor(width * 0.02),
  top: Math.floor(height * 0.03),
  right: Math.floor(width * 0.18),
  bottom: Math.floor(height * 0.17),
});

const getNamedRegions = (
  sceneId: (typeof benchmarkScenes)[number],
  view: ObserverView,
  width: number,
  height: number,
  viewName: string,
): { subjectRegionName: string; regions: Record<string, PixelRegion | null> } => {
  if (sceneId === "view-camera-anatomy") {
    if (viewName === "registered-anatomy-subject") {
      const subject = mmBoundsToWorld(VIEW_CAMERA_ANATOMY_PRESENTATION.geometry.bounds);
      return {
        subjectRegionName: "registeredTargetBoard",
        regions: {
          registeredTargetBoard: projectWorldBounds(subject, width, height, view),
          backgroundReference: percentRegion(width, height),
        },
      };
    }
    return {
      subjectRegionName: "cameraModel",
      regions: {
        // The normal Anatomy camera inspection pose frames the conceptual camera
        // body, while the registered target board is behind that camera. Keep this
        // bounded central ROI separate from the geometry-derived subject capture.
        cameraModel: {
          left: Math.floor(width * 0.26),
          top: Math.floor(height * 0.28),
          right: Math.ceil(width * 0.74),
          bottom: Math.ceil(height * 0.82),
        },
        backgroundReference: percentRegion(width, height),
      },
    };
  }

  const { building, facade, ground } = architectureRiseGeometry;
  const primaryFacade = mmBoundsToWorld({
    min: { x: -building.width / 2, y: facade.mainBodyBottomY, z: facade.frontFacadeZ - 20 },
    max: { x: building.width / 2, y: facade.mainBodyTopY, z: facade.backFacadeZ + 20 },
  });
  const bay = architectureRiseWindowBays.find((entry) => entry.id === "bay-3-3");
  const glazing = bay ? mmBoundsToWorld({
    min: { x: bay.x - bay.width / 2, y: bay.y - bay.height / 2, z: facade.frontFacadeZ - bay.depth },
    max: { x: bay.x + bay.width / 2, y: bay.y + bay.height / 2, z: facade.frontFacadeZ + 2 },
  }) : null;
  const roofParapet = mmBoundsToWorld({
    min: { x: -building.width / 2, y: facade.parapetBottomY, z: facade.frontFacadeZ },
    max: { x: building.width / 2, y: facade.parapetTopY, z: facade.backFacadeZ },
  });
  const shadowZone = mmBoundsToWorld({
    min: { x: -building.width * 0.65, y: ground.y + 1, z: facade.frontFacadeZ - 2_400 },
    max: { x: building.width * 0.65, y: ground.y + 35, z: facade.frontFacadeZ + 800 },
  });
  return {
    subjectRegionName: "primaryFacade",
    regions: {
      primaryFacade: projectWorldBounds(primaryFacade, width, height, view),
      glazing: glazing ? projectWorldBounds(glazing, width, height, view) : null,
      shadowedSubjectRegion: projectWorldBounds(shadowZone, width, height, view),
      roofParapet: projectWorldBounds(roofParapet, width, height, view),
      backgroundReference: percentRegion(width, height),
    },
  };
};

const saveImage = async (path: string, image: Buffer) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, image);
};

const captureObserverView = async (
  page: Page,
  observer: Locator,
  sceneId: (typeof benchmarkScenes)[number],
  viewName: string,
  testNumber: number,
  backend: "webgl" | "webgpu",
): Promise<CapturedView> => {
  await waitForFrames(page, 4);
  const camera = await readObserverView(observer);
  const canvas = observer.locator("canvas");
  const png = await canvas.screenshot({ animations: "disabled" });
  const decoded = decodePlaywrightPng(png);
  const namedRegions = getNamedRegions(sceneId, camera, decoded.width, decoded.height, viewName);
  const regionEvidence = Object.fromEntries(Object.entries(namedRegions.regions).map(([name, region]) => [
    name,
    {
      bounds: region,
      screenshot: region ? summarizePixelRegion(decoded, region) : null,
    },
  ]));
  const screenshotRelativePath = join(
    "screenshots",
    `${sceneId}-${backend}-trial-${testNumber}-${viewName}.png`,
  );
  const screenshotPath = join(outputDirectory, screenshotRelativePath);
  await saveImage(screenshotPath, png);
  return {
    viewName,
    camera,
    width: decoded.width,
    height: decoded.height,
    screenshotPath,
    screenshotRelativePath: screenshotRelativePath.replaceAll("\\", "/"),
    subjectRegionName: namedRegions.subjectRegionName,
    regions: regionEvidence,
  };
};

const setArchitectureCloseView = async (observer: Locator) => {
  await observer.evaluate((element, payload) => {
    element.dispatchEvent(new CustomEvent(payload.name, { detail: payload.view }));
  }, { name: architectureViewEvent, view: closeArchitectureView });
  await expect.poll(async () => {
    const view = await readObserverView(observer);
    return vectorsMatch(view.position, closeArchitectureView.position) &&
      vectorsMatch(view.target, closeArchitectureView.target);
  }).toBe(true);
};

const setAnatomyRegisteredSubjectView = async (observer: Locator): Promise<ObserverView> => {
  const baseline = await readObserverView(observer);
  const bounds = VIEW_CAMERA_ANATOMY_PRESENTATION.geometry.bounds;
  const target: Vector3Tuple = [
    toWorld((bounds.min.x + bounds.max.x) / 2),
    toWorld((bounds.min.y + bounds.max.y) / 2),
    toWorld((bounds.min.z + bounds.max.z) / 2),
  ];
  const view = {
    target,
    position: [target[0] + 0.55, target[1] + 0.3, target[2] + 1.2] as const,
  };
  await observer.evaluate((element, payload) => {
    element.dispatchEvent(new CustomEvent(payload.name, { detail: payload.view }));
  }, { name: anatomyViewEvent, view });
  await expect.poll(async () => {
    const current = await readObserverView(observer);
    return vectorsMatch(current.position, view.position) && vectorsMatch(current.target, view.target);
  }).toBe(true);
  return baseline;
};

const restoreObserverView = async (observer: Locator, view: ObserverView): Promise<void> => {
  if (!view.position || !view.target) throw new Error("Cannot restore an unknown Observer camera pose");
  await observer.evaluate((element, payload) => {
    element.dispatchEvent(new CustomEvent(payload.name, { detail: payload.view }));
  }, {
    name: anatomyViewEvent,
    view: { position: view.position, target: view.target },
  });
  await expect.poll(async () => {
    const current = await readObserverView(observer);
    return vectorsMatch(current.position, view.position) && vectorsMatch(current.target, view.target);
  }).toBe(true);
};

const prepareView = async (
  page: Page,
  observer: Locator,
  sceneId: (typeof benchmarkScenes)[number],
): Promise<void> => {
  const desiredFocus = sceneId === "view-camera-anatomy" ? "camera" : "scene";
  if (await observer.getAttribute("data-view-focus") !== desiredFocus) {
    const focusButton = page.getByRole("button", {
      name: desiredFocus === "camera" ? "Camera" : "Scene",
      exact: true,
    }).first();
    await expect(focusButton).toBeVisible();
    await focusButton.click();
  }
  await expect(observer).toHaveAttribute("data-view-focus", desiredFocus);
};

const startCadenceCapture = async (page: Page) => page.evaluate((durationMs) => {
  const capture = {
    startedAt: performance.now(),
    lastTimestamp: null as number | null,
    intervals: [] as number[],
    pointerEvents: [] as Array<{ type: string; time: number }>,
    finished: false,
  };
  const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="scene-canvas"] canvas');
  if (!canvas) throw new Error("Observer canvas is missing before warm interaction capture");
  const recordPointer = (event: Event) => capture.pointerEvents.push({ type: event.type, time: performance.now() });
  for (const name of ["pointerdown", "pointermove", "pointerup"]) canvas.addEventListener(name, recordPointer);
  const tick = (timestamp: number) => {
    if (capture.lastTimestamp !== null) capture.intervals.push(timestamp - capture.lastTimestamp);
    capture.lastTimestamp = timestamp;
    if (timestamp - capture.startedAt >= durationMs) {
      capture.finished = true;
      for (const name of ["pointerdown", "pointermove", "pointerup"]) canvas.removeEventListener(name, recordPointer);
      return;
    }
    requestAnimationFrame(tick);
  };
  (window as unknown as { __observerBackendBenchmarkCapture?: typeof capture }).__observerBackendBenchmarkCapture = capture;
  requestAnimationFrame(tick);
}, rAFMeasurementWindowMs);

const runOrbitWorkload = async (
  page: Page,
  observer: Locator,
): Promise<{ frameCadence: ReturnType<typeof summarizeFrameCadence>; pointerEvents: Array<{ type: string; time: number }>; gesturePoseChanges: number; durationMs: number }> => {
  const start = Date.now();
  const canvas = observer.locator("canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Observer canvas has no visible browser bounds");
  const center = { x: bounds.x + bounds.width * 0.52, y: bounds.y + bounds.height * 0.52 };
  let gesturePoseChanges = 0;
  await startCadenceCapture(page);
  for (const [gestureIndex, gesture] of orbitSequence.entries()) {
    const before = await observer.getAttribute("data-observer-camera-position");
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await waitForFrames(page, 1);
    await page.mouse.move(center.x + gesture.deltaX, center.y + gesture.deltaY, { steps: gesture.steps });
    await waitForFrames(page, 1);
    await page.mouse.up();
    try {
      await expect.poll(async () => observer.getAttribute("data-observer-camera-position"), {
        timeout: 10_000,
      }).not.toBe(before);
    } catch (error) {
      const after = await observer.getAttribute("data-observer-camera-position");
      throw new Error(
        `orbit gesture ${gestureIndex + 1}/${orbitSequence.length} (${gesture.deltaX}, ${gesture.deltaY}) did not change camera position (${before} → ${after}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    gesturePoseChanges += 1;
  }
  await page.waitForFunction(() =>
    (window as unknown as { __observerBackendBenchmarkCapture?: { finished?: boolean } })
      .__observerBackendBenchmarkCapture?.finished === true,
  { timeout: 10_000 });
  const captured = await page.evaluate(() => {
    const capture = (window as unknown as {
      __observerBackendBenchmarkCapture?: {
        intervals: number[];
        pointerEvents: Array<{ type: string; time: number }>;
      };
    }).__observerBackendBenchmarkCapture;
    return capture ?? null;
  });
  if (!captured) throw new Error("Observer frame-cadence capture produced no record");
  const downTimes = captured.pointerEvents.filter((event) => event.type === "pointerdown").map((event) => event.time);
  const upTimes = captured.pointerEvents.filter((event) => event.type === "pointerup").map((event) => event.time);
  const durationMs = downTimes.length && upTimes.length
    ? (upTimes.at(-1) ?? 0) - (downTimes[0] ?? 0)
    : Date.now() - start;
  return {
    frameCadence: summarizeFrameCadence(captured.intervals),
    pointerEvents: captured.pointerEvents,
    gesturePoseChanges,
    durationMs,
  };
};

const captureGroundGlass = async (page: Page) => {
  const groundGlass = page.getByTestId("ground-glass-rtt").first();
  await waitForFrames(page, 4);
  const canvas = groundGlass.locator("canvas").first();
  const backend = await canvas.evaluate((element: HTMLCanvasElement) => {
    // RTT readiness and the frames above establish that this is the existing Ground Glass
    // Canvas. getContext returns its current context; it does not create a renderer or canvas.
    const context = element.getContext("webgl2");
    return context ? {
      contextType: context.constructor.name,
      version: context.getParameter(context.VERSION),
      isWebGL2: context instanceof WebGL2RenderingContext,
    } : { contextType: null, version: null, isWebGL2: false };
  });
  const screenshot = await canvas.screenshot({ animations: "disabled" });
  const image = decodePlaywrightPng(screenshot);
  const content = summarizePixelRegion(image, { left: 0, top: 0, right: image.width, bottom: image.height });
  const metrics = await groundGlass.evaluate((element) => ({
    rawContentful: element.getAttribute("data-rtt-raw-contentful"),
    finalContentful: element.getAttribute("data-rtt-final-contentful"),
    resourceGeneration: element.getAttribute("data-rtt-resource-generation"),
    ownerId: element.getAttribute("data-rtt-owner-id"),
    resourceCanvasCount: element.querySelectorAll("canvas").length,
  }));
  return { locator: groundGlass, screenshot, width: image.width, height: image.height, content, backend, metrics };
};

const verifyGroundGlassResponse = async (page: Page, observer: Locator) => {
  const generationBefore = await observer.getAttribute("data-observer-renderer-generation");
  const before = await captureGroundGlass(page);
  const rawMode = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
  const uprightMode = page.getByRole("radio", { name: "Upright Assist", exact: true });
  await expect(rawMode).toBeVisible();
  await expect(uprightMode).toBeVisible();
  const initiallyRaw = await rawMode.isChecked();
  const originalMode = initiallyRaw ? rawMode : uprightMode;
  const alternateMode = initiallyRaw ? uprightMode : rawMode;
  const originalModeName = initiallyRaw ? "raw" : "upright-assist";
  const alternateModeName = initiallyRaw ? "upright-assist" : "raw";
  await alternateMode.check();
  await expect(alternateMode).toBeChecked();
  await waitForFrames(page, 4);
  const after = await captureGroundGlass(page);
  const beforePixels = decodePlaywrightPng(before.screenshot);
  const afterPixels = decodePlaywrightPng(after.screenshot);
  const difference = comparePixelRegions(
    beforePixels,
    afterPixels,
    { left: 0, top: 0, right: before.width, bottom: before.height },
  );
  await originalMode.check();
  await expect(originalMode).toBeChecked();
  await waitForFrames(page, 4);
  const restored = await captureGroundGlass(page);
  const restoredPixels = decodePlaywrightPng(restored.screenshot);
  const restorationDifference = comparePixelRegions(
    beforePixels,
    restoredPixels,
    { left: 0, top: 0, right: before.width, bottom: before.height },
  );
  await expect(observer).toHaveAttribute("data-observer-renderer-generation", generationBefore ?? "");
  return {
    backend: before.backend,
    before: { mode: originalModeName, contentful: subjectRoiHasMeaningfulPixels(before.content), ...before.metrics, pixelSummary: before.content, backend: before.backend },
    after: { mode: alternateModeName, contentful: subjectRoiHasMeaningfulPixels(after.content), ...after.metrics, pixelSummary: after.content, backend: after.backend },
    restored: {
      mode: originalModeName,
      contentful: subjectRoiHasMeaningfulPixels(restored.content),
      ...restored.metrics,
      pixelSummary: restored.content,
      changedPixelCountFromInitial: restorationDifference.changedPixelCount,
      changedPixelFractionFromInitial: restorationDifference.changedPixelFraction,
      backend: restored.backend,
    },
    interaction: {
      control: "public Raw Ground Glass / Upright Assist radio group",
      modeBefore: originalModeName,
      modeDuring: alternateModeName,
      modeRestored: originalModeName,
      restored: true,
      changedPixelCount: difference.changedPixelCount,
      changedPixelFraction: difference.changedPixelFraction,
      meanAbsoluteRgbDifference: difference.meanAbsoluteRgbDifference,
      responseTimingMeasured: false,
    },
    observerRendererGenerationStable: generationBefore === await observer.getAttribute("data-observer-renderer-generation"),
    observerCanvasCount: await observer.locator("canvas").count(),
    imageDimensionsMatched: before.width === after.width && before.height === after.height,
  };
};

const readBrowserGpuDiagnostics = async (browser: Browser): Promise<BrowserGpuDiagnostics> => {
  try {
    const session = await browser.newBrowserCDPSession();
    try {
      const result = await session.send("SystemInfo.getInfo");
      const info = result as {
        gpu?: {
          devices?: Array<{ deviceString?: string }>;
          auxAttributes?: Record<string, unknown>;
        };
      };
      const sources = [
        ...(info.gpu?.devices ?? []).map((device) => device.deviceString ?? ""),
        String(info.gpu?.auxAttributes?.glRenderer ?? ""),
        String(info.gpu?.auxAttributes?.glImplementationParts ?? ""),
      ].join(" ");
      const softwareRendererDetected = /(swiftshader|llvmpipe|lavapipe|software rasterizer|warp)/i.test(sources);
      const backend = sources.match(/\b(?:metal|direct3d ?11|direct3d ?12|vulkan|opengl|swiftshader|llvmpipe|lavapipe)\b/i)?.[0] ?? null;
      return {
        source: "Chrome DevTools Protocol SystemInfo.getInfo",
        softwareRendererDetected,
        reportedGraphicsBackend: backend,
        rawDeviceIdentifiersOmitted: true,
      };
    } finally {
      await session.detach();
    }
  } catch {
    return {
      source: "unavailable",
      softwareRendererDetected: null,
      reportedGraphicsBackend: null,
      rawDeviceIdentifiersOmitted: true,
    };
  }
};

const runtimeBackend = (attributes: Record<string, string>): string | null => {
  const family = attributes["data-observer-renderer-family"] ?? null;
  const backend = attributes["data-observer-execution-backend"] ?? null;
  return family && backend ? `${family} / ${backend}` : family ?? backend;
};

const runSingleTrial = async (
  browser: Browser,
  sceneId: (typeof benchmarkScenes)[number],
  trialNumber: number,
  executionOrder: number,
  orderWithinPair: number,
  requestedBackend: "webgl" | "webgpu",
  browserGpuDiagnostics: BrowserGpuDiagnostics,
): Promise<BenchmarkTrial> => {
  const trial: BenchmarkTrial = {
    sceneId,
    trialNumber,
    executionOrder,
    orderWithinPair,
    requestedBackend,
    mountedBackend: null,
    valid: false,
    invalidReasons: [],
    navigationWallMs: { toDocumentReady: null, toActiveRenderer: null, toFirstContentfulObserverCapture: null },
    mountedObserver: {},
    adapter: { apiPresent: null, availability: null },
    browserGpuDiagnostics,
    canonicalState: null,
    canvas: null,
    sceneResources: null,
    environment: { status: null, recipeIdentity: `${sceneId}:registered-scene-presentation` },
    views: [],
    interaction: null,
    groundGlass: null,
    pageErrors: [],
    consoleErrors: [],
    webgpuModuleRequests: [],
  };

  const startedAt = Date.now();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => trial.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") trial.consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    if (/(three[_-]webgpu|three\/webgpu|webgpu\.js|\/webgpu\/)/i.test(request.url())) {
      trial.webgpuModuleRequests.push(request.url());
    }
  });

  try {
    const rendererQuery = requestedBackend === "webgpu" ? "?observerRenderer=webgpu" : "";
    await page.goto(
      `/simulator/free/${sceneId}${rendererQuery}`,
      { waitUntil: "domcontentloaded", timeout: 120_000 },
    );
    trial.navigationWallMs.toDocumentReady = Date.now() - startedAt;
    const observer = observerLocator(page);
    await expect(observer.locator("canvas")).toHaveCount(1, { timeout: 90_000 });
    await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 120_000 });
    await expect(observer).toHaveAttribute("data-scene-subject-id", sceneId, { timeout: 90_000 });
    if (requestedBackend === "webgpu") {
      await expect(observer).toHaveAttribute(
        "data-observer-adapter-availability",
        /^(available|unavailable|api-absent|request-rejected|timed-out)$/,
        { timeout: 30_000 },
      );
    }
    trial.navigationWallMs.toActiveRenderer = Date.now() - startedAt;
    const attributes = await readObserverAttributes(observer);
    trial.mountedObserver = attributes;
    trial.mountedBackend = runtimeBackend(attributes);
    trial.adapter = {
      apiPresent: attributes["data-observer-webgpu-api-present"] ?? null,
      availability: attributes["data-observer-adapter-availability"] ?? null,
    };
    console.log(`[benchmark] ${sceneId} pair ${trialNumber} ${requestedBackend}: active ${trial.mountedBackend ?? "unknown"} after ${trial.navigationWallMs.toActiveRenderer} ms`);
    const mismatches = observerBackendMismatches(
      attributes,
      requestedBackend === "webgpu" ? "native-webgpu" : "webgl",
    );
    if (requestedBackend === "webgl" && trial.webgpuModuleRequests.length > 0) {
      mismatches.push("default WebGL request loaded the lazy WebGPU module");
    }
    if (requestedBackend === "webgpu" && trial.webgpuModuleRequests.length === 0) {
      mismatches.push("WebGPU pilot did not request the lazy WebGPU module");
    }
    trial.invalidReasons.push(...mismatches);

    const groundGlass = page.getByTestId("ground-glass-rtt").first();
    await expect(groundGlass).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 90_000 });
    trial.environment.status = attributes["data-observer-environment-status"] ?? "not-reported";
    if (sceneId === "architecture-rise" && trial.environment.status !== "active") {
      trial.invalidReasons.push("Architecture Rise world environment was not active");
    }

    trial.sceneResources = {
      observerSubject: "not measured by this benchmark",
      groundGlassRenderer: "mounted canvas WebGL2 context inspected directly",
      interpretation: "No renderer-owned memory or VRAM metric is inferred.",
    };

    await prepareView(page, observer, sceneId);
    trial.canonicalState = await readCanonicalState(page, observer);
    const canvasData = await observer.locator("canvas").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        cssWidth: rect.width,
        cssHeight: rect.height,
        backingWidth: (element as HTMLCanvasElement).width,
        backingHeight: (element as HTMLCanvasElement).height,
        dpr: window.devicePixelRatio,
      };
    });
    trial.canvas = canvasData;
    const anatomyView = sceneId === "view-camera-anatomy";
    trial.views.push(await captureObserverView(
      page,
      observer,
      sceneId,
      anatomyView ? "camera-inspection" : "default",
      trialNumber,
      requestedBackend,
    ));
    trial.navigationWallMs.toFirstContentfulObserverCapture = Date.now() - startedAt;
    if (anatomyView) {
      const baselineView = await setAnatomyRegisteredSubjectView(observer);
      trial.views.push(await captureObserverView(
        page,
        observer,
        sceneId,
        "registered-anatomy-subject",
        trialNumber,
        requestedBackend,
      ));
      await restoreObserverView(observer, baselineView);
    } else {
      await setArchitectureCloseView(observer);
      trial.views.push(await captureObserverView(
        page,
        observer,
        sceneId,
        "close-facade",
        trialNumber,
        requestedBackend,
      ));
    }
    console.log(`[benchmark] ${sceneId} pair ${trialNumber} ${requestedBackend}: captured ${trial.views.length} Observer view(s)`);

    const interaction = await runOrbitWorkload(page, observer);
    if (interaction.frameCadence.sampleCount < 30) {
      trial.invalidReasons.push("fewer than 30 browser requestAnimationFrame intervals were sampled");
    }
    if (interaction.gesturePoseChanges !== orbitSequence.length) {
      trial.invalidReasons.push("not every orbit gesture changed the mounted Observer camera pose");
    }
    trial.interaction = {
      method: "real Playwright pointer drags through the mounted OrbitControls canvas",
      sequence: orbitSequence,
      gesturePoseChanges: interaction.gesturePoseChanges,
      pointerEventCount: interaction.pointerEvents.length,
      pointerEvents: interaction.pointerEvents,
      pointerDownToLastUpMs: interaction.durationMs,
      frameCadence: interaction.frameCadence,
      frameCadenceLabel: "Observed browser requestAnimationFrame cadence during the pointer workload; not Three.js render or GPU time.",
    };
    console.log(`[benchmark] ${sceneId} pair ${trialNumber} ${requestedBackend}: orbit workload recorded ${interaction.frameCadence.sampleCount} rAF intervals`);
    trial.groundGlass = await verifyGroundGlassResponse(page, observer);
    const groundGlassEvidence = trial.groundGlass as {
      interaction?: { changedPixelCount?: number };
      backend?: { isWebGL2?: boolean; version?: string | null };
      before?: { contentful?: boolean; backend?: { isWebGL2?: boolean } };
      after?: { contentful?: boolean; backend?: { isWebGL2?: boolean } };
      restored?: { contentful?: boolean; changedPixelFractionFromInitial?: number; backend?: { isWebGL2?: boolean } };
      observerRendererGenerationStable?: boolean;
      observerCanvasCount?: number;
    };
    if (!groundGlassEvidence.before?.contentful || !groundGlassEvidence.after?.contentful) {
      trial.invalidReasons.push("Ground Glass screenshot did not show meaningful rendered content before and after preview-mode interaction");
    }
    if (!groundGlassEvidence.restored?.contentful ||
      (groundGlassEvidence.restored.changedPixelFractionFromInitial ?? 1) > 0.005) {
      trial.invalidReasons.push("Ground Glass preview mode did not restore its initial visible output");
    }
    if (groundGlassEvidence.backend?.isWebGL2 !== true ||
      groundGlassEvidence.before?.backend?.isWebGL2 !== true ||
      groundGlassEvidence.after?.backend?.isWebGL2 !== true ||
      groundGlassEvidence.restored?.backend?.isWebGL2 !== true) {
      trial.invalidReasons.push("Ground Glass canvas did not retain its mounted WebGL2 context throughout preview-mode interaction");
    }
    if ((groundGlassEvidence.interaction?.changedPixelCount ?? 0) <= 0) {
      trial.invalidReasons.push("Ground Glass image did not change after the public preview-mode control changed");
    }
    if (!groundGlassEvidence.observerRendererGenerationStable || groundGlassEvidence.observerCanvasCount !== 1) {
      trial.invalidReasons.push("Ground Glass control interaction caused an Observer remount or canvas replacement");
    }

    for (const view of trial.views) {
      const subject = view.regions[view.subjectRegionName]?.screenshot;
      if (!subjectRoiHasMeaningfulPixels(subject ?? null)) {
        trial.invalidReasons.push(`${view.viewName} subject ROI lacked meaningful rendered color/detail evidence`);
      }
      if (Object.values(view.regions).some((region) => region.bounds === null)) {
        trial.invalidReasons.push(`${view.viewName} has an unprojectable geometry ROI`);
      }
    }
  } catch (error) {
    trial.invalidReasons.push(error instanceof Error ? error.message : String(error));
  } finally {
    if (trial.pageErrors.length > 0) {
      trial.invalidReasons.push(`unexpected page errors: ${trial.pageErrors.join(" | ")}`);
    }
    if (trial.consoleErrors.length > 0) {
      trial.invalidReasons.push(`unexpected console errors: ${trial.consoleErrors.join(" | ")}`);
    }
    trial.valid = trial.invalidReasons.length === 0;
    await context.close().catch(() => undefined);
  }
  console.log(`[benchmark] ${sceneId} pair ${trialNumber} ${requestedBackend}: ${trial.valid ? "valid" : `invalid (${trial.invalidReasons.join("; ")})`}`);
  return trial;
};

const computeVisualComparisons = async (trials: readonly BenchmarkTrial[]) => {
  const comparisons: VisualComparison[] = [];
  const pairProblems: string[] = [];
  for (const sceneId of benchmarkScenes) {
    for (let trialNumber = 1; trialNumber <= trialCount; trialNumber += 1) {
      const webgl = trials.find((trial) => trial.sceneId === sceneId && trial.trialNumber === trialNumber && trial.requestedBackend === "webgl");
      const webgpu = trials.find((trial) => trial.sceneId === sceneId && trial.trialNumber === trialNumber && trial.requestedBackend === "webgpu");
      if (!webgl || !webgpu) {
        pairProblems.push(`${sceneId} trial ${trialNumber} is missing one backend sample`);
        continue;
      }
      if (!webgl.valid || !webgpu.valid) {
        pairProblems.push(`${sceneId} trial ${trialNumber} is incomplete because at least one backend sample is invalid`);
      }
      if (JSON.stringify(webgl.canonicalState) !== JSON.stringify(webgpu.canonicalState)) {
        webgl.invalidReasons.push("canonical controls/overlays differ from its paired backend sample");
        webgpu.invalidReasons.push("canonical controls/overlays differ from its paired backend sample");
        webgl.valid = false;
        webgpu.valid = false;
        pairProblems.push(`${sceneId} trial ${trialNumber} canonical state mismatch`);
      }
      if (JSON.stringify(webgl.canvas) !== JSON.stringify(webgpu.canvas)) {
        webgl.invalidReasons.push("Observer canvas backing/CSS dimensions or DPR differ from its paired backend sample");
        webgpu.invalidReasons.push("Observer canvas backing/CSS dimensions or DPR differ from its paired backend sample");
        webgl.valid = false;
        webgpu.valid = false;
        pairProblems.push(`${sceneId} trial ${trialNumber} viewport/DPR mismatch`);
      }
      for (const viewName of webgl.views.map((view) => view.viewName)) {
        const webglView = webgl.views.find((view) => view.viewName === viewName);
        const webgpuView = webgpu.views.find((view) => view.viewName === viewName);
        if (!webglView || !webgpuView) {
          pairProblems.push(`${sceneId} trial ${trialNumber} is missing ${viewName}`);
          continue;
        }
        if (!vectorsMatch(webglView.camera.position, webgpuView.camera.position) ||
          !vectorsMatch(webglView.camera.target, webgpuView.camera.target)) {
          webgl.invalidReasons.push(`${viewName} camera pose differs from the paired backend`);
          webgpu.invalidReasons.push(`${viewName} camera pose differs from the paired backend`);
          webgl.valid = false;
          webgpu.valid = false;
          pairProblems.push(`${sceneId} trial ${trialNumber} ${viewName} camera pose mismatch`);
        }
        const webglPixels = decodePlaywrightPng(await readFile(webglView.screenshotPath));
        const webgpuPixels = decodePlaywrightPng(await readFile(webgpuView.screenshotPath));
        const names = ["fullCanvas", ...Object.keys(webglView.regions)];
        const regionalResults: Record<string, ImageDifferenceSummary> = {};
        for (const regionName of names) {
          const region = regionName === "fullCanvas"
            ? { left: 0, top: 0, right: webglPixels.width, bottom: webglPixels.height }
            : webglView.regions[regionName]?.bounds ?? null;
          if (!region) continue;
          regionalResults[regionName] = comparePixelRegions(webglPixels, webgpuPixels, region, 16);
        }
        comparisons.push({
          sceneId,
          trialNumber,
          viewName,
          webglScreenshot: webglView.screenshotRelativePath,
          webgpuScreenshot: webgpuView.screenshotRelativePath,
          dimensions: { width: webglView.width, height: webglView.height },
          changedChannelThreshold: 16,
          roiCoordinates: Object.fromEntries(Object.entries(webglView.regions).map(([name, value]) => [name, value.bounds])),
          regions: regionalResults,
          interpretation: "Differences are descriptive; pixel divergence alone does not establish a teaching defect.",
        });
      }
    }
  }
  return { comparisons, pairProblems };
};

const runRecoverySequence = async (
  browser: Browser,
  sceneId: (typeof benchmarkScenes)[number],
): Promise<Record<string, unknown>> => {
  const context = await browser.newContext({ viewport, deviceScaleFactor, locale: "en-US", timezoneId: "UTC" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const steps: Array<Record<string, unknown>> = [];
  try {
    await page.goto(`/simulator/free/${sceneId}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const observer = observerLocator(page);
    await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 120_000 });
    const sequence = [
      { label: "default-webgl", query: "", expected: "webgl" as const },
      { label: "explicit-webgpu", query: "?observerRenderer=webgpu", expected: "webgpu" as const },
      { label: "return-to-webgl", query: "", expected: "webgl" as const },
      { label: "return-to-webgpu", query: "?observerRenderer=webgpu", expected: "webgpu" as const },
    ];
    for (let index = 0; index < sequence.length; index += 1) {
      const step = sequence[index];
      if (!step) continue;
      if (index > 0) {
        const previousGeneration = Number(steps.at(-1)?.rendererGeneration);
        await page.evaluate((query) => {
          window.history.pushState(window.history.state, "", `${window.location.pathname}${query}`);
          window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
        }, step.query);
        await expect.poll(async () => Number(await observer.getAttribute("data-observer-renderer-generation")), {
          timeout: 120_000,
          message: `${step.label}: expected a new Observer mount generation`,
        }).toBeGreaterThan(previousGeneration);
        await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 120_000 });
      }
      await expect(observer).toHaveAttribute(
        "data-observer-renderer-family",
        step.expected === "webgl" ? "webgl-renderer" : "webgpu-renderer",
        { timeout: 120_000 },
      );
      await expect(observer).toHaveAttribute(
        "data-observer-execution-backend",
        step.expected === "webgl" ? "webgl2" : "webgpu",
        { timeout: 120_000 },
      );
      await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
      await expect(observer).toHaveAttribute("data-scene-subject-id", sceneId);
      await expect(page.getByTestId("ground-glass-rtt").first()).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 30_000 });
      const groundGlassCapture = await captureGroundGlass(page);
      const groundGlassContentful = subjectRoiHasMeaningfulPixels(groundGlassCapture.content);
      if (!groundGlassContentful) throw new Error(`${step.label}: Ground Glass screenshot was not contentful`);
      if (sceneId === "architecture-rise") {
        await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 90_000 });
      }
      const attrs = await readObserverAttributes(observer);
      if (step.expected === "webgpu") {
        const errorsForNative = observerBackendMismatches(attrs, "native-webgpu");
        if (errorsForNative.length > 0) throw new Error(`${step.label}: ${errorsForNative.join("; ")}`);
      } else {
        const errorsForGl = observerBackendMismatches(attrs, "webgl");
        if (errorsForGl.length > 0) throw new Error(`${step.label}: ${errorsForGl.join("; ")}`);
      }
      steps.push({
        label: step.label,
        rendererGeneration: attrs["data-observer-renderer-generation"],
        rendererFamily: attrs["data-observer-renderer-family"],
        executionBackend: attrs["data-observer-execution-backend"],
        applicationFallback: attrs["data-observer-application-fallback"],
        environmentStatus: attrs["data-observer-environment-status"] ?? null,
        groundGlassContentful,
        observerCanvasCount: await observer.locator("canvas").count(),
      });
    }
    for (let index = 1; index < steps.length; index += 1) {
      const previous = Number(steps[index - 1]?.rendererGeneration);
      const current = Number(steps[index]?.rendererGeneration);
      if (!(current > previous)) throw new Error("Renderer generation did not advance across a backend request transition");
    }
  } finally {
    await context.close().catch(() => undefined);
  }
  return { sceneId, steps, pageErrors: errors, stable: steps.length === 4 && errors.length === 0 };
};

type BenchmarkSummaryReport = Readonly<{
  status: string;
  gitCommit: string;
  generatedAt: string;
  environment: {
    os: string;
    architecture: string;
    osRelease: string;
    browserName: string;
    browserVersion: string;
    threeRevision: string;
    browserGpuDiagnostics: BrowserGpuDiagnostics;
  };
  qualification: {
    nativeWebGpuExecution: string;
    hardwareAcceleration: string;
  };
  configuration: { viewport: { width: number; height: number }; deviceScaleFactor: number };
  trials: BenchmarkTrial[];
  visualComparisons: VisualComparison[];
  comparisonComplete: boolean;
  invalidPairs: string[];
  decision: {
    functionalRendering: string;
    visualEquivalence: string;
    performance: string;
    nextDirection: string;
    interpretation: string;
  };
  limitations: string[];
}>;

const buildMarkdown = (report: BenchmarkSummaryReport): string => {
  const trialRows = report.trials.map((trial) => {
    const cadence = trial.interaction as { frameCadence?: ReturnType<typeof summarizeFrameCadence> } | null;
    const frame = cadence?.frameCadence;
    return `| ${trial.sceneId} | ${trial.trialNumber} | ${trial.requestedBackend} | ${trial.mountedBackend ?? "unavailable"} | ${trial.valid ? "valid" : "invalid"} | ${trial.navigationWallMs.toActiveRenderer ?? "—"} | ${frame?.sampleCount ?? 0} | ${frame?.medianMs ?? "—"} | ${frame?.p95Ms ?? "—"} | ${frame?.p99Ms ?? "—"} |`;
  });
  const visualRows = report.visualComparisons.map((comparison) => {
    const fullCanvas = comparison.regions.fullCanvas;
    const facade = comparison.regions.primaryFacade ?? comparison.regions.cameraModel;
    return `| ${comparison.sceneId} | ${comparison.trialNumber} | ${comparison.viewName} | ${comparison.dimensions.width}×${comparison.dimensions.height} | ${fullCanvas?.meanAbsoluteRgbDifference?.toFixed(2) ?? "—"} | ${fullCanvas ? (fullCanvas.changedPixelFraction * 100).toFixed(2) : "—"}% | ${facade?.meanAbsoluteRgbDifference?.toFixed(2) ?? "—"} | [WebGL](./${comparison.webglScreenshot}) · [WebGPU](./${comparison.webgpuScreenshot}) |`;
  });
  const invalid = report.trials.filter((trial) => !trial.valid);
  return [
    "# Observer backend comparison benchmark",
    "",
    `Status: **${report.status}**  `,
    `Git commit: \`${report.gitCommit}\`  `,
    `Run timestamp: ${report.generatedAt}`,
    "",
    "## Environment",
    "",
    `- OS / architecture: ${report.environment.os} / ${report.environment.architecture} (${report.environment.osRelease})`,
    `- Browser: ${report.environment.browserName} ${report.environment.browserVersion}`,
    `- Three.js: r${report.environment.threeRevision}`,
    `- Viewport / DPR: ${report.configuration.viewport.width}×${report.configuration.viewport.height} / ${report.configuration.deviceScaleFactor}`,
    `- Native WebGPU API execution: ${report.qualification.nativeWebGpuExecution}`,
    `- Hardware acceleration: **${report.qualification.hardwareAcceleration}**`,
    `- Browser GPU diagnostic: ${report.environment.browserGpuDiagnostics.source}; software renderer detected: ${report.environment.browserGpuDiagnostics.softwareRendererDetected ?? "unknown"}; reported graphics backend: ${report.environment.browserGpuDiagnostics.reportedGraphicsBackend ?? "unavailable"}`,
    "",
    "The browser GPU diagnostic omits raw device identifiers. Chrome system GPU reporting does not by itself prove which adapter WebGPU selected. `unconfirmed` therefore remains the hardware classification unless a software renderer is explicitly detected.",
    "",
    "## Observer trials",
    "",
    "| Scene | Pair | Requested backend | Mounted family / execution | Validity | Navigation to active renderer (wall ms) | rAF samples | rAF median ms | rAF p95 ms | rAF p99 ms |",
    "| --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...trialRows,
    "",
    "Navigation wall time covers the simulator route from `page.goto` start through the active mounted renderer. It includes browser/server scheduling, module loading, initialization, and scene realization; it is not a pure GPU startup measurement. rAF intervals are observed browser frame cadence during actual OrbitControls pointer drags, not Three.js render duration or GPU time.",
    "",
    "## Paired visual evidence",
    "",
    "| Scene | Pair | View | Dimensions | Whole-canvas MAE (0–255) | Changed pixels at 16/255 | Subject ROI MAE | Captures |",
    "| --- | ---: | --- | --- | ---: | ---: | ---: | --- |",
    ...visualRows,
    "",
    "Changed-pixel fraction counts pixels with at least one RGB channel differing by 16 or more. Region coordinates, per-region luminance/color-detail summaries, and the exact captures are in `run.json`. WebGL and WebGPU output is not expected to be pixel-identical; visual teaching acceptability requires human review.",
    "",
    "## Measurement interpretation",
    "",
    "- Observer GPU time: **not measured**; this PR does not add a GPU timestamp-query system.",
    "- Observer frame cadence: browser `requestAnimationFrame` interval distribution during a fixed orbit workload; presentation cadence only.",
    "- Interaction: fixed sequence of real pointer drags; reports pose changes and pointer timing, not input-to-present latency.",
    "- Resource observations: Observer mesh/resource counts, renderer-owned GPU memory, and VRAM are not measured.",
    "- Ground Glass: separately verifies its mounted WebGL2 canvas, contentfulness, and visible response to the Raw Ground Glass / Upright Assist control. Its timings are not aggregated with Observer results.",
    `- Paired comparison complete: ${report.comparisonComplete ? "yes" : "no"}. ${report.invalidPairs.length} incomplete pair(s) are listed in the JSON report and were not presented as a complete matrix.`,
    `- Invalid trials: ${invalid.length}.`,
    "",
    "## Decision",
    "",
    `- Functional rendering: **${report.decision.functionalRendering}**`,
    `- Visual equivalence: **${report.decision.visualEquivalence}**`,
    `- Performance: **${report.decision.performance}**`,
    `- Recommended next direction: **${report.decision.nextDirection}**`,
    `- Interpretation: ${report.decision.interpretation}`,
    "",
    "## Limitations",
    "",
    ...report.limitations.map((limitation) => `- ${limitation}`),
    "",
  ].join("\n");
};

const writeVisualReport = async (comparisons: readonly VisualComparison[]) => {
  const cards = comparisons.map((comparison) => `
    <section>
      <h2>${comparison.sceneId} · trial ${comparison.trialNumber} · ${comparison.viewName}</h2>
      <p>${comparison.dimensions.width}×${comparison.dimensions.height}; full-frame MAE ${comparison.regions.fullCanvas.meanAbsoluteRgbDifference.toFixed(2)}; changed fraction ${(comparison.regions.fullCanvas.changedPixelFraction * 100).toFixed(2)}%</p>
      <div class="pair"><figure><img src="${comparison.webglScreenshot}" alt="${comparison.sceneId} WebGL"><figcaption>WebGL2</figcaption></figure><figure><img src="${comparison.webgpuScreenshot}" alt="${comparison.sceneId} WebGPU"><figcaption>Native WebGPU</figcaption></figure></div>
    </section>`).join("\n");
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Observer backend visual pairs</title><style>body{font:16px system-ui,sans-serif;margin:2rem;background:#f4f4f5;color:#18181b}section{max-width:1500px;margin:2rem auto;padding:1rem;background:white;border:1px solid #d4d4d8;border-radius:8px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:1rem}img{display:block;width:100%;height:auto;background:#27272a}figcaption{padding:.5rem 0}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style><h1>Observer backend visual pairs</h1><p>Captures are from the actual Observer canvas. Pixel differences are descriptive and do not replace human review.</p>${cards}</html>`;
  await writeFile(join(outputDirectory, "visual-report.html"), html);
};

test.describe("Observer backend comparison benchmark", () => {
  test.skip(!benchmarkEnabled, "Opt-in only: run npm run benchmark:observer-backends.");
  test.skip(!nativeRequired, "The comparison requires the explicit native-WebGPU Chrome run mode.");
  test.describe.configure({ mode: "serial" });

  test("records matched WebGL2 and native WebGPU Observer trials", async ({ browser }, testInfo) => {
    test.setTimeout(30 * 60 * 1000);
    const browserGpuDiagnostics = await readBrowserGpuDiagnostics(browser);
    const trials: BenchmarkTrial[] = [];
    const runStartedAt = new Date().toISOString();
    const writeProgress = async () => {
      await mkdir(outputDirectory, { recursive: true });
      const completedNativeTrials = trials.filter((trial) => trial.requestedBackend === "webgpu");
      await writeFile(join(outputDirectory, "run.json"), serializeBenchmarkReport({
        schemaVersion: 1,
        status: "in-progress",
        gitCommit: commitSha,
        generatedAt: runStartedAt,
        environment: {
          os: platform(),
          architecture: arch(),
          osRelease: release(),
          browserName: browser.browserType().name(),
          browserVersion: browser.version(),
          threeRevision: REVISION,
          browserGpuDiagnostics,
        },
        qualification: {
          nativeWebGpuExecution: completedNativeTrials.length === 0
            ? "pending"
            : completedNativeTrials.every((trial) => trial.mountedBackend === "webgpu-renderer / webgpu")
              ? "verified for completed native trials"
              : "not verified",
          hardwareAcceleration: browserGpuDiagnostics.softwareRendererDetected === true ? "software-backed" : "unconfirmed",
        },
        configuration: { viewport, deviceScaleFactor, pairedTrialsPerScene: trialCount },
        trials,
        limitations: ["An in-progress report is partial and is not a completed comparison."],
      }));
    };
    await writeProgress();
    let executionOrder = 0;
    const sceneSequence: readonly (readonly [(typeof benchmarkScenes)[number], (typeof benchmarkScenes)[number]])[] = [
      ["view-camera-anatomy", "architecture-rise"],
      ["architecture-rise", "view-camera-anatomy"],
      ["view-camera-anatomy", "architecture-rise"],
    ];
    for (let trialIndex = 0; trialIndex < trialCount; trialIndex += 1) {
      const requestedOrder = trialIndex % 2 === 0 ? ["webgl", "webgpu"] as const : ["webgpu", "webgl"] as const;
      const scenes = sceneSequence[trialIndex] ?? benchmarkScenes;
      for (const sceneId of scenes) {
        for (let orderWithinPair = 0; orderWithinPair < requestedOrder.length; orderWithinPair += 1) {
          const requestedBackend = requestedOrder[orderWithinPair];
          if (!requestedBackend) continue;
          executionOrder += 1;
          trials.push(await runSingleTrial(
            browser,
            sceneId,
            trialIndex + 1,
            executionOrder,
            orderWithinPair + 1,
            requestedBackend,
            browserGpuDiagnostics,
          ));
          await writeProgress();
        }
      }
    }

    const recovery: Array<Record<string, unknown>> = [];
    for (const sceneId of benchmarkScenes) {
      try {
        recovery.push(await runRecoverySequence(browser, sceneId));
      } catch (error) {
        recovery.push({ sceneId, stable: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    const { comparisons, pairProblems } = await computeVisualComparisons(trials);
    for (const problem of pairProblems) {
      const affected = trials.filter((trial) => problem.includes(trial.sceneId) && (problem.includes(`trial ${trial.trialNumber}`) || !/trial \d+/.test(problem)));
      for (const trial of affected) {
        if (!trial.invalidReasons.includes(problem)) trial.invalidReasons.push(problem);
        trial.valid = false;
      }
    }
    const complete = trials.length === benchmarkScenes.length * trialCount * 2 &&
      trials.every((trial) => trial.valid) &&
      recovery.every((record) => record.stable === true) && pairProblems.length === 0;
    const nativeExecution = trials.length > 0 && trials.every((trial) =>
      trial.requestedBackend !== "webgpu" || trial.mountedBackend === "webgpu-renderer / webgpu",
    );
    const hardwareAcceleration: "hardware-backed" | "software-backed" | "unconfirmed" = browserGpuDiagnostics.softwareRendererDetected === true
      ? "software-backed"
      : "unconfirmed";
    const report = {
      schemaVersion: 1,
      status: complete ? "complete" : "completed-with-invalid-or-missing-evidence",
      gitCommit: commitSha,
      generatedAt: new Date().toISOString(),
      environment: {
        os: platform(),
        architecture: arch(),
        osRelease: release(),
        browserName: browser.browserType().name(),
        browserVersion: browser.version(),
        threeRevision: REVISION,
        browserGpuDiagnostics,
      },
      qualification: {
        browserWebGpuApiPresent: trials.some((trial) => trial.adapter.apiPresent === "true"),
        adapterAvailable: trials.some((trial) => trial.adapter.availability === "available"),
        nativeWebGpuExecution: nativeExecution ? "verified" : "not-verified",
        hardwareAcceleration,
        hardwareQualifiedPerformanceResult: false,
      },
      configuration: {
        sceneIds: benchmarkScenes,
        pairedTrialsPerScene: trialCount,
        viewport,
        deviceScaleFactor,
        renderQuality: "high (simulator route default)",
        route: "/simulator/free/<scene>?observerRenderer=<backend>",
        executionOrder: trials.map(({ executionOrder: order, sceneId, trialNumber, requestedBackend }) => ({ order, sceneId, trialNumber, requestedBackend })),
        orbitSequence,
        rAFMeasurementWindowMs,
        pixelDifferenceThresholdPerRgbChannel: 16,
      },
      comparisonComplete: complete,
      trials,
      recovery,
      visualComparisons: comparisons,
      invalidPairs: pairProblems,
      decision: {
        functionalRendering: complete ? "verified" : "inconclusive",
        visualEquivalence: "inconclusive; captures and ROI metrics require human teaching-purpose review",
        performance: "inconclusive; no Observer GPU timers, three pairs per scene, and no predeclared performance thresholds",
        nextDirection: "A — Continue development-only pilots",
        interpretation: complete
          ? "The tested scenes render through the required backends with matched state and stable interactions. The available measurements do not establish a WebGPU performance advantage or production readiness."
          : "The comparison did not satisfy every required sample/lifecycle condition; use the invalid trial records and limitations before drawing conclusions.",
      },
      limitations: [
        "Observer GPU render time is not measured. Browser rAF cadence is not Three.js render duration or GPU execution time.",
        "Cold navigation wall time excludes browser process launch but includes page load, module loading, renderer initialization, and scene realization.",
        "Three paired trials per scene are descriptive evidence, not a stable performance ranking or general platform result.",
        "Hardware acceleration remains unconfirmed unless Chrome system diagnostics explicitly identify a software renderer; they do not prove which adapter WebGPU selected.",
        "Pixel differences are quantitative descriptions only. A human must decide whether they affect the scene's teaching purpose.",
        "Observer subject resource counts, renderer-owned GPU memory, and VRAM bytes are not measured.",
        "Ground Glass backend evidence reads the already-mounted display canvas WebGL2 context and pairs it with contentful screenshot and public preview-mode response checks.",
      ],
    };
    const json = serializeBenchmarkReport(report);
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(join(outputDirectory, "run.json"), json);
    await writeFile(join(outputDirectory, "summary.md"), buildMarkdown(report));
    await writeVisualReport(comparisons);
    await testInfo.attach("observer-backend-comparison-run.json", { body: json, contentType: "application/json" });
    await testInfo.attach("observer-backend-comparison-summary.md", { body: await readFile(join(outputDirectory, "summary.md")), contentType: "text/markdown" });
    await testInfo.attach("observer-backend-comparison-visual-report.html", { body: await readFile(join(outputDirectory, "visual-report.html")), contentType: "text/html" });

    if (!complete) {
      const invalids = trials.flatMap((trial) => trial.invalidReasons.map((reason) =>
        `${trial.sceneId} trial ${trial.trialNumber} ${trial.requestedBackend}: ${reason}`,
      ));
      const recoveryFailures = recovery.filter((record) => record.stable !== true).map((record) =>
        `${record.sceneId ?? "unknown scene"} recovery: ${String(record.error ?? "unstable")}`,
      );
      throw new Error([
        `Observer backend comparison is incomplete. Evidence written to ${relative(process.cwd(), outputDirectory)}.`,
        ...invalids,
        ...pairProblems,
        ...recoveryFailures,
      ].join("\n"));
    }
    expect(nativeExecution, "WebGPU trials must all mount WebGPURenderer with native WebGPU execution").toBe(true);
  });
});
