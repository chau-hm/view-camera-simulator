import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { arch, platform, release } from "node:os";
import { performance } from "node:perf_hooks";
import { PerspectiveCamera, REVISION, Vector3 } from "three";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../../scenes/presentation/viewCameraAnatomy";
import architectureRiseGeometry, { architectureRiseWindowBays } from "../../scenes/architectureRiseGeometry";
import { toWorld } from "../../render/rttUtils";
import { setStepRangeInput } from "../e2e/helpers/stepRangeInput";
import {
  analyzeOrbitCadence,
  calculateBenchmarkWallTimes,
  comparePixelRegions,
  decodePlaywrightPng,
  deriveImageRestorationTolerance,
  imageMatchesRestorationTolerance,
  observerBackendMismatches,
  serializeBenchmarkReport,
  summarizeFrameCadence,
  summarizePixelRegion,
  subjectRoiHasMeaningfulPixels,
  type ImageDifferenceSummary,
  type BenchmarkTimingMarks,
  type BenchmarkWallTimes,
  type PixelRegion,
  type OrbitFrame,
  type OrbitPointerEvent,
} from "./observerBackendBenchmark";

const benchmarkEnabled = process.env.OBSERVER_BACKEND_BENCHMARK === "1";
const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const outputPolicyComparisonEnabled = process.env.OBSERVER_OUTPUT_POLICY_COMPARISON === "1";
if (process.env.OBSERVER_BACKEND_BENCHMARK_OUTPUT_POLICY !== undefined &&
  !new Set(["standard", "material-aware"]).has(process.env.OBSERVER_BACKEND_BENCHMARK_OUTPUT_POLICY)) {
  throw new Error("OBSERVER_BACKEND_BENCHMARK_OUTPUT_POLICY must be standard or material-aware");
}
const trialCount = 3;
const viewport = { width: 1440, height: 1000 } as const;
const deviceScaleFactor = 1;
const closeArchitectureView = {
  position: [4.8, 2.7, 4.2] as const,
  target: [0, 1.25, 9.3] as const,
};
const architectureViewEvent = "vcs:observer-verification:architecture-rise-view";
const anatomyViewEvent = "vcs:observer-verification:anatomy-view";
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
  requestedOutputPolicy: "standard" | "material-aware" | null;
  mountedBackend: string | null;
  valid: boolean;
  invalidReasons: string[];
  timing: BenchmarkWallTimes;
  readiness: {
    navigationToEnvironmentActiveWallMs: number | null;
    navigationToOutputPolicyActiveWallMs: number | null;
  };
  outputPolicyPerformance: Record<string, unknown> | null;
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

const startCadenceCapture = async (page: Page, watchdogTimeoutMs = 60_000): Promise<void> => page.evaluate((timeoutMs) => {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="scene-canvas"] canvas');
  if (!canvas) throw new Error("Observer canvas is missing before orbit cadence capture");
  const capture = {
    frames: [] as Array<{ timestampMs: number }>,
    pointerEvents: [] as Array<{
      type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel";
      timeMs: number;
      pointerId: number;
      gestureId: number;
    }>,
    activePointerId: null as number | null,
    activeGestureId: null as number | null,
    nextGestureId: 0,
    animationFrameId: 0,
    stopped: false,
    timedOut: false,
    watchdogTimeoutId: 0,
    stop: null as (() => void) | null,
  };
  const isFromCanvas = (event: PointerEvent) => event.target instanceof Node && canvas.contains(event.target);
  const onPointerDown = (event: PointerEvent) => {
    if (!isFromCanvas(event) || event.button !== 0 || capture.activePointerId !== null) return;
    const gestureId = capture.nextGestureId + 1;
    capture.nextGestureId = gestureId;
    capture.activePointerId = event.pointerId;
    capture.activeGestureId = gestureId;
    capture.pointerEvents.push({
      type: "pointerdown",
      timeMs: performance.now(),
      pointerId: event.pointerId,
      gestureId,
    });
  };
  const onPointerMove = (event: PointerEvent) => {
    if (capture.activePointerId !== event.pointerId || capture.activeGestureId === null) return;
    capture.pointerEvents.push({
      type: "pointermove",
      timeMs: performance.now(),
      pointerId: event.pointerId,
      gestureId: capture.activeGestureId,
    });
  };
  const endPointer = (type: "pointerup" | "pointercancel", event: PointerEvent) => {
    if (capture.activePointerId !== event.pointerId || capture.activeGestureId === null) return;
    capture.pointerEvents.push({
      type,
      timeMs: performance.now(),
      pointerId: event.pointerId,
      gestureId: capture.activeGestureId,
    });
    capture.activePointerId = null;
    capture.activeGestureId = null;
  };
  const onPointerUp = (event: PointerEvent) => endPointer("pointerup", event);
  const onPointerCancel = (event: PointerEvent) => endPointer("pointercancel", event);
  const tick = (timestampMs: number) => {
    if (capture.stopped) return;
    capture.frames.push({ timestampMs });
    capture.animationFrameId = requestAnimationFrame(tick);
  };
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("pointercancel", onPointerCancel, true);
  capture.animationFrameId = requestAnimationFrame(tick);
  capture.stop = () => {
    if (capture.stopped) return;
    capture.stopped = true;
    window.clearTimeout(capture.watchdogTimeoutId);
    cancelAnimationFrame(capture.animationFrameId);
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerCancel, true);
  };
  capture.watchdogTimeoutId = window.setTimeout(() => {
    capture.timedOut = true;
    capture.stop?.();
  }, timeoutMs);
  (window as unknown as { __observerBackendBenchmarkCapture?: typeof capture })
    .__observerBackendBenchmarkCapture = capture;
}, watchdogTimeoutMs);

const finishCadenceCapture = async (page: Page): Promise<{
  frames: OrbitFrame[];
  pointerEvents: OrbitPointerEvent[];
  timedOut: boolean;
}> =>
  page.evaluate(() => {
    const capture = (window as unknown as {
      __observerBackendBenchmarkCapture?: {
        frames: OrbitFrame[];
        pointerEvents: OrbitPointerEvent[];
        timedOut: boolean;
        stop?: () => void;
      };
    }).__observerBackendBenchmarkCapture;
    if (!capture) throw new Error("Observer orbit cadence capture was not installed");
    capture.stop?.();
    const snapshot = { frames: capture.frames, pointerEvents: capture.pointerEvents, timedOut: capture.timedOut };
    delete (window as unknown as { __observerBackendBenchmarkCapture?: unknown }).__observerBackendBenchmarkCapture;
    return snapshot;
  });

const performOrbitGestures = async (
  page: Page,
  observer: Locator,
): Promise<number> => {
  const canvas = observer.locator("canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Observer canvas has no visible browser bounds");
  const center = { x: bounds.x + bounds.width * 0.52, y: bounds.y + bounds.height * 0.52 };
  let gesturePoseChanges = 0;
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

  return gesturePoseChanges;
};

const runOrbitWorkload = async (
  page: Page,
  observer: Locator,
): Promise<{
  cadence: ReturnType<typeof analyzeOrbitCadence>;
  gesturePoseChanges: number;
  frames: OrbitFrame[];
  pointerEvents: OrbitPointerEvent[];
  captureTimedOut: boolean;
}> => {
  await startCadenceCapture(page);
  let captured: { frames: OrbitFrame[]; pointerEvents: OrbitPointerEvent[]; timedOut: boolean } | null = null;
  let gesturePoseChanges = 0;
  try {
    gesturePoseChanges = await performOrbitGestures(page, observer);
  } finally {
    captured = await finishCadenceCapture(page);
  }
  if (!captured) throw new Error("Observer orbit cadence capture produced no record");
  return {
    cadence: analyzeOrbitCadence(captured.pointerEvents, captured.frames, orbitSequence.length),
    frames: captured.frames,
    pointerEvents: captured.pointerEvents,
    gesturePoseChanges,
    captureTimedOut: captured.timedOut,
  };
};

const runArchitectureRiseControlWorkload = async (page: Page, observer: Locator) => {
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const focusValueBefore = Number(await focus.inputValue());
  await focus.focus();
  await focus.press("ArrowRight");
  await expect.poll(async () => Number(await focus.inputValue())).not.toBe(focusValueBefore);
  await focus.press("ArrowLeft");
  await expect.poll(async () => Number(await focus.inputValue())).toBe(focusValueBefore);

  const rise = page.getByRole("slider", { name: "Rise", exact: true });
  const riseValueBefore = Number(await rise.inputValue());
  await setStepRangeInput(page, "Rise", 22);
  await setStepRangeInput(page, "Rise", riseValueBefore);

  for (const overlay of ["Focus plane", "DOF region"]) {
    let button = page.getByRole("button", { name: new RegExp(`^(Show|Hide) ${overlay}$`) });
    if (!await button.isVisible().catch(() => false)) {
      const menuTrigger = page.getByRole("button", { name: /View overlays/i });
      await expect(menuTrigger).toBeVisible({ timeout: 5_000 });
      if (await menuTrigger.getAttribute("aria-expanded") !== "true") await menuTrigger.click();
      button = page.getByRole("button", { name: new RegExp(`^(Show|Hide) ${overlay}$`) });
    }
    await expect(button).toBeVisible({ timeout: 5_000 });
    const initiallyVisible = await observer.getAttribute(
      overlay === "Focus plane" ? "data-focus-overlay-visible" : "data-dof-overlay-visible",
    );
    await button.click();
    await expect(observer).toHaveAttribute(
      overlay === "Focus plane" ? "data-focus-overlay-visible" : "data-dof-overlay-visible",
      initiallyVisible === "true" ? "false" : "true",
    );
    await expect.poll(async () => button.getAttribute("aria-pressed")).not.toBe(initiallyVisible);
    await page.getByRole("button", { name: new RegExp(`^(Show|Hide) ${overlay}$`) }).click();
    await expect(observer).toHaveAttribute(
      overlay === "Focus plane" ? "data-focus-overlay-visible" : "data-dof-overlay-visible",
      initiallyVisible ?? "true",
    );
  }
  const overlayMenuTrigger = page.getByRole("button", { name: /View overlays/i });
  if (await overlayMenuTrigger.count() > 0 && await overlayMenuTrigger.getAttribute("aria-expanded") === "true") {
    await overlayMenuTrigger.click();
  }

  await page.getByRole("button", { name: "Camera", exact: true }).first().click();
  await expect(observer).toHaveAttribute("data-view-focus", "camera");
  await page.getByRole("button", { name: "Scene", exact: true }).first().click();
  await expect(observer).toHaveAttribute("data-view-focus", "scene");
  await page.getByRole("button", { name: "Reset 3D view", exact: true }).click();
  await waitForFrames(page, 4);
  return {
    focusDistanceChangedAndRestored: true,
    frontRiseChangedAndRestored: true,
    focusOverlayToggledAndRestored: true,
    dofOverlayToggledAndRestored: true,
    cameraAndSceneFocusSelected: true,
    reset3dView: true,
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
  const fullGroundGlassRegion = { left: 0, top: 0, right: before.width, bottom: before.height };
  const repeatedBaseline = [await captureGroundGlass(page), await captureGroundGlass(page)];
  const repeatedBaselineDifferences = repeatedBaseline.map((capture) => comparePixelRegions(
    decodePlaywrightPng(before.screenshot),
    decodePlaywrightPng(capture.screenshot),
    fullGroundGlassRegion,
    1,
  ));
  const restorationTolerance = deriveImageRestorationTolerance(repeatedBaselineDifferences);
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
    restorationTolerance.changedChannelThreshold,
  );
  const restorationDifferenceAt16 = comparePixelRegions(
    beforePixels,
    restoredPixels,
    { left: 0, top: 0, right: before.width, bottom: before.height },
    16,
  );
  const restorationMatchesBaseline = imageMatchesRestorationTolerance(restorationDifference, restorationTolerance);
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
      changedPixelCountLowThreshold: restorationDifference.changedPixelCount,
      changedPixelFractionLowThreshold: restorationDifference.changedPixelFraction,
      changedPixelCount16Level: restorationDifferenceAt16.changedPixelCount,
      changedPixelFraction16Level: restorationDifferenceAt16.changedPixelFraction,
      meanAbsoluteRgbDifferenceFromInitial: restorationDifference.meanAbsoluteRgbDifference,
      meanSignedLuminanceDifferenceFromInitial: restorationDifference.meanSignedLuminanceDifference,
      restorationAccepted: restorationMatchesBaseline,
      matchesRepeatedCaptureTolerance: restorationMatchesBaseline,
      backend: restored.backend,
    },
    restorationEvidence: {
      comparison: "full Ground Glass canvas RGB pixels at a one-level channel threshold",
      baselineCaptureCount: restorationTolerance.baselineCaptureCount,
      repeatedCaptureDifferences: repeatedBaselineDifferences,
      tolerance: restorationTolerance,
      observedRestorationDifference: restorationDifference,
      observedRestorationDifferenceAt16: restorationDifferenceAt16,
      matchesRepeatedCaptureTolerance: restorationMatchesBaseline,
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
  requestedOutputPolicy: "standard" | "material-aware" | null,
  browserGpuDiagnostics: BrowserGpuDiagnostics,
): Promise<BenchmarkTrial> => {
  const trial: BenchmarkTrial = {
    sceneId,
    trialNumber,
    executionOrder,
    orderWithinPair,
    requestedBackend,
    requestedOutputPolicy,
    mountedBackend: null,
    valid: false,
    invalidReasons: [],
    timing: {
      contextPageSetupWallMs: null,
      navigationToDocumentReadyWallMs: null,
      navigationToActiveRendererWallMs: null,
      activeRendererToAdapterDiagnosticWallMs: null,
      navigationToAdapterDiagnosticWallMs: null,
      navigationToFirstVerifiedObserverCaptureWallMs: null,
    },
    readiness: {
      navigationToEnvironmentActiveWallMs: null,
      navigationToOutputPolicyActiveWallMs: null,
    },
    outputPolicyPerformance: null,
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

  let timingMarks: BenchmarkTimingMarks = {
    contextPageSetupStartedAtMs: performance.now(),
    navigationStartedAtMs: null,
    documentReadyAtMs: null,
    rendererActiveAtMs: null,
    adapterDiagnosticCompletedAtMs: null,
    firstVerifiedObserverCaptureAtMs: null,
  };
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
    const rendererQuery = requestedBackend === "webgpu"
      ? `?observerRenderer=webgpu&observerOutput=${requestedOutputPolicy ?? "standard"}`
      : "";
    timingMarks = { ...timingMarks, navigationStartedAtMs: performance.now() };
    await page.goto(
      `/simulator/free/${sceneId}${rendererQuery}`,
      { waitUntil: "domcontentloaded", timeout: 120_000 },
    );
    timingMarks = { ...timingMarks, documentReadyAtMs: performance.now() };
    const observer = observerLocator(page);
    await expect(observer.locator("canvas")).toHaveCount(1, { timeout: 90_000 });
    await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 120_000 });
    await expect(observer).toHaveAttribute("data-scene-subject-id", sceneId, { timeout: 90_000 });
    await expect(observer).toHaveAttribute("data-observer-renderer-family", /^(webgl-renderer|webgpu-renderer)$/);
    await expect(observer).toHaveAttribute("data-observer-execution-backend", /^(webgl2|webgpu|webgl2-fallback)$/);
    await expect(observer).toHaveAttribute("data-observer-renderer-generation", /^\d+$/);
    timingMarks = { ...timingMarks, rendererActiveAtMs: performance.now() };
    const activeAttributes = await readObserverAttributes(observer);
    trial.mountedBackend = runtimeBackend(activeAttributes);
    let adapterObservationError: string | null = null;
    let adapterObservationPromise: Promise<void> = Promise.resolve();
    if (requestedBackend === "webgpu") {
      adapterObservationPromise = expect(observer).toHaveAttribute(
        "data-observer-adapter-availability",
        /^(available|unavailable|api-absent|request-rejected|timed-out)$/,
        { timeout: 30_000 },
      ).then(() => {
        timingMarks = { ...timingMarks, adapterDiagnosticCompletedAtMs: performance.now() };
      }).catch((error: unknown) => {
        adapterObservationError = error instanceof Error ? error.message : String(error);
      });
    }
    console.log(`[benchmark] ${sceneId} pair ${trialNumber} ${requestedBackend}: observed ${trial.mountedBackend ?? "unknown"}`);

    await prepareView(page, observer, sceneId);
    if (sceneId === "architecture-rise") {
      await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 90_000 });
      trial.readiness.navigationToEnvironmentActiveWallMs =
        performance.now() - (timingMarks.navigationStartedAtMs ?? performance.now());
    }
    if (requestedBackend === "webgpu" && requestedOutputPolicy) {
      const expectedPolicy = requestedOutputPolicy;
      if (expectedPolicy === "material-aware") {
        await expect(observer).toHaveAttribute("data-observer-output-policy-status", "active", { timeout: 90_000 });
      } else {
        await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard", { timeout: 30_000 });
      }
      const selected = await observer.getAttribute("data-observer-output-policy-selected");
      const installed = await observer.getAttribute("data-observer-output-policy-installed");
      if (selected !== expectedPolicy || installed !== expectedPolicy) {
        trial.invalidReasons.push(`requested ${expectedPolicy} output policy but observed ${selected}/${installed}`);
      }
      trial.readiness.navigationToOutputPolicyActiveWallMs =
        performance.now() - (timingMarks.navigationStartedAtMs ?? performance.now());
    }
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
    const firstCapture = await captureObserverView(
      page,
      observer,
      sceneId,
      anatomyView ? "camera-inspection" : "default",
      trialNumber,
      requestedBackend,
    );
    trial.views.push(firstCapture);
    const firstCaptureSubject = firstCapture.regions[firstCapture.subjectRegionName]?.screenshot ?? null;
    if (subjectRoiHasMeaningfulPixels(firstCaptureSubject)) {
      timingMarks = { ...timingMarks, firstVerifiedObserverCaptureAtMs: performance.now() };
    } else {
      trial.invalidReasons.push("first Observer screenshot did not contain meaningful pixels in the geometry-derived subject ROI");
    }

    if (requestedBackend === "webgpu") {
      await adapterObservationPromise;
      if (adapterObservationError) {
        trial.invalidReasons.push(`adapter diagnostic did not reach a terminal state: ${adapterObservationError}`);
      }
    }
    const attributes = await readObserverAttributes(observer);
    trial.mountedObserver = attributes;
    const finalMountedBackend = runtimeBackend(attributes);
    if (finalMountedBackend !== trial.mountedBackend) {
      trial.invalidReasons.push(`mounted renderer identity changed after readiness was first observed (${trial.mountedBackend ?? "unknown"} → ${finalMountedBackend ?? "unknown"})`);
    }
    trial.mountedBackend = finalMountedBackend;
    trial.adapter = {
      apiPresent: attributes["data-observer-webgpu-api-present"] ?? null,
      availability: attributes["data-observer-adapter-availability"] ?? null,
    };
    console.log(`[benchmark] ${sceneId} pair ${trialNumber} ${requestedBackend}: adapter diagnostic ${attributes["data-observer-adapter-availability"] ?? "not-applicable"}`);
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
    let materialInventory: Record<string, unknown> | null = null;
    const inventoryAttribute = attributes["data-observer-material-inventory"];
    if (inventoryAttribute) {
      try {
        materialInventory = JSON.parse(inventoryAttribute) as Record<string, unknown>;
      } catch {
        trial.invalidReasons.push("material-aware runtime inventory was not valid JSON");
      }
    }
    trial.sceneResources = {
      observerCanvasCount: await observer.locator("canvas").count(),
      groundGlassCanvasCount: await groundGlass.locator("canvas").count(),
      architectureRiseInventory: materialInventory ? {
        totalMeshAssignments: materialInventory.totalMeshAssignments ?? null,
        distinctMaterialInstances: materialInventory.distinctMaterialInstances ?? null,
        adaptedMaterialInstances: materialInventory.adaptedMaterialInstances ?? null,
        unsupportedMaterialInstances: materialInventory.unsupportedMaterialInstances ?? null,
      } : null,
      rendererOwnedGpuMemory: "not reported",
      vram: "not measured",
      interpretation: "Scene/material inventory counts are object-level evidence, not GPU allocation or VRAM measurements.",
    };
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
    trial.invalidReasons.push(...interaction.cadence.invalidReasons);
    if (interaction.captureTimedOut) {
      trial.invalidReasons.push("orbit cadence capture exceeded its 60-second safety timeout");
    }
    if (interaction.gesturePoseChanges !== orbitSequence.length) {
      trial.invalidReasons.push("not every orbit gesture changed the mounted Observer camera pose");
    }
    const architectureRiseControls = outputPolicyComparisonEnabled && sceneId === "architecture-rise"
      ? await runArchitectureRiseControlWorkload(page, observer)
      : null;
    trial.interaction = {
      method: "real Playwright pointer drags through the mounted OrbitControls canvas",
      sequence: orbitSequence,
      gesturePoseChanges: interaction.gesturePoseChanges,
      expectedGestureCount: orbitSequence.length,
      observedGestureCount: interaction.cadence.observedGestureCount,
      pointerEventCount: interaction.cadence.pointerEventCount,
      pointerEvents: interaction.pointerEvents,
      requestAnimationFrameTimestampsMs: interaction.frames.map((frame) => frame.timestampMs),
      timestampClock: "same page performance time origin for pointer events and requestAnimationFrame callbacks",
      gestureCadence: interaction.cadence.gestures,
      pointerDownToLastUpMs: interaction.cadence.workloadDurationMs,
      totalActiveDragDurationMs: interaction.cadence.totalActiveDragDurationMs,
      interGestureDurationMs: interaction.cadence.interGestureDurationMs,
      activeGestureCadence: interaction.cadence.activeGestureCadence,
      interGestureCadence: interaction.cadence.interGestureCadence,
      excludedFrameIntervalCount: interaction.cadence.excludedFrameIntervalCount,
      architectureRiseControls,
      frameCadenceLabel: "Observed browser requestAnimationFrame intervals with both interval endpoints inside the same actual pointer-down/up OrbitControls gesture. Inter-gesture intervals are reported separately; pre/post workload idle intervals are excluded.",
    };
    if (requestedBackend === "webgpu" && requestedOutputPolicy === "material-aware") {
      trial.outputPolicyPerformance = await observer.evaluate((element) => {
        window.dispatchEvent(new Event("vcs:observer-verification:read-output-policy-performance"));
        const value = element.getAttribute("data-observer-output-policy-performance");
        return value ? JSON.parse(value) as Record<string, unknown> : null;
      });
      if (!trial.outputPolicyPerformance) {
        trial.invalidReasons.push("material-aware controller performance instrumentation was unavailable");
      }
    }
    console.log(`[benchmark] ${sceneId} pair ${trialNumber} ${requestedBackend}: orbit workload recorded ${interaction.cadence.activeGestureCadence.sampleCount} active-gesture and ${interaction.cadence.interGestureCadence.sampleCount} inter-gesture rAF intervals`);
    trial.groundGlass = await verifyGroundGlassResponse(page, observer);
    const groundGlassEvidence = trial.groundGlass as {
      interaction?: { changedPixelCount?: number };
      backend?: { isWebGL2?: boolean; version?: string | null };
      before?: { contentful?: boolean; backend?: { isWebGL2?: boolean } };
      after?: { contentful?: boolean; backend?: { isWebGL2?: boolean } };
      restored?: {
        contentful?: boolean;
        matchesRepeatedCaptureTolerance?: boolean;
        backend?: { isWebGL2?: boolean };
      };
      observerRendererGenerationStable?: boolean;
      observerCanvasCount?: number;
    };
    if (!groundGlassEvidence.before?.contentful || !groundGlassEvidence.after?.contentful) {
      trial.invalidReasons.push("Ground Glass screenshot did not show meaningful rendered content before and after preview-mode interaction");
    }
    if (!groundGlassEvidence.restored?.contentful ||
      groundGlassEvidence.restored.matchesRepeatedCaptureTolerance !== true) {
      trial.invalidReasons.push("Ground Glass preview mode did not restore its initial output within measured repeated-capture variation at a one-level RGB threshold");
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
    trial.timing = calculateBenchmarkWallTimes(timingMarks);
    const requiredTimingValues: Array<[string, number | null]> = [
      ["context/page setup", trial.timing.contextPageSetupWallMs],
      ["navigation to document ready", trial.timing.navigationToDocumentReadyWallMs],
      ["navigation to observed active renderer", trial.timing.navigationToActiveRendererWallMs],
      ["navigation to verified Observer capture", trial.timing.navigationToFirstVerifiedObserverCaptureWallMs],
    ];
    if (requestedBackend === "webgpu") {
      requiredTimingValues.push(["navigation to adapter diagnostic", trial.timing.navigationToAdapterDiagnosticWallMs]);
    }
    for (const [label, durationMs] of requiredTimingValues) {
      if (durationMs === null) trial.invalidReasons.push(`required ${label} timing boundary was unavailable`);
    }
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
      { label: "explicit-webgpu-standard", query: "?observerRenderer=webgpu&observerOutput=standard", expected: "webgpu" as const },
      { label: "return-to-webgl", query: "", expected: "webgl" as const },
      { label: "return-to-webgpu-standard", query: "?observerRenderer=webgpu&observerOutput=standard", expected: "webgpu" as const },
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
      if (step.expected === "webgpu") {
        await expect(observer).toHaveAttribute("data-observer-output-policy-selected", "standard");
        await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard");
      }
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
        outputPolicy: attrs["data-observer-output-policy-installed"] ?? null,
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

const readOutputPolicyPerformance = async (observer: Locator): Promise<Record<string, unknown> | null> =>
  observer.evaluate((element) => {
    window.dispatchEvent(new Event("vcs:observer-verification:read-output-policy-performance"));
    const value = element.getAttribute("data-observer-output-policy-performance");
    return value ? JSON.parse(value) as Record<string, unknown> : null;
  });

const navigateWithinObserverApp = async (page: Page, path: string): Promise<void> => page.evaluate((nextPath) => {
  window.history.pushState(window.history.state, "", nextPath);
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
}, path);

const captureSubjectPixelEvidence = async (
  page: Page,
  observer: Locator,
  sceneId: (typeof benchmarkScenes)[number],
): Promise<Record<string, unknown>> => {
  let restoreView: ObserverView | null = null;
  const viewName = sceneId === "architecture-rise" ? "close-facade" : "registered-anatomy-subject";
  if (sceneId === "architecture-rise") {
    await setArchitectureCloseView(observer);
  } else {
    restoreView = await setAnatomyRegisteredSubjectView(observer);
  }
  try {
    await waitForFrames(page, 4);
    const camera = await readObserverView(observer);
    const image = decodePlaywrightPng(await observer.locator("canvas").screenshot({ animations: "disabled" }));
    const subjectRegionName = getNamedRegions(sceneId, camera, image.width, image.height, viewName).subjectRegionName;
    const region = getNamedRegions(sceneId, camera, image.width, image.height, viewName).regions[subjectRegionName] ?? null;
    const pixels = region ? summarizePixelRegion(image, region) : null;
    const contentful = subjectRoiHasMeaningfulPixels(pixels);
    if (!contentful) throw new Error(`${sceneId} ${subjectRegionName} subject ROI did not contain meaningful rendered pixels`);
    return { sceneId, subjectRegionName, camera, imageDimensions: { width: image.width, height: image.height }, region, pixels, contentful };
  } finally {
    if (restoreView) await restoreObserverView(observer, restoreView);
  }
};

const readLifecycleReports = async (page: Page): Promise<Array<Record<string, unknown>>> =>
  page.evaluate(() => {
    const target = window as unknown as { __observerOutputPolicyLifecycleReports?: unknown[] };
    return (target.__observerOutputPolicyLifecycleReports ?? []) as Array<Record<string, unknown>>;
  });

const runMaterialAwareLifecycleQualification = async (
  browser: Browser,
): Promise<Record<string, unknown>> => {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.addInitScript(() => {
    const target = window as unknown as { __observerOutputPolicyLifecycleReports: unknown[] };
    target.__observerOutputPolicyLifecycleReports = [];
    window.addEventListener("vcs:observer-output-policy-lifecycle", (event) => {
      target.__observerOutputPolicyLifecycleReports.push((event as CustomEvent<unknown>).detail);
    });
  });

  const observer = observerLocator(page);
  const groundGlass = page.getByTestId("ground-glass-rtt").first();
  const snapshots: Array<Record<string, unknown>> = [];
  const transitions: Array<Record<string, unknown>> = [];
  const outputPolicyTransitions: Array<Record<string, unknown>> = [];
  const groundGlassIdentity: { ownerId: string | null; resourceGeneration: string | null } = {
    ownerId: null,
    resourceGeneration: null,
  };

  const assertNativeMount = async (
    sceneId: (typeof benchmarkScenes)[number],
    previousGeneration: number | null,
    expectedGroundGlassIdentity: Readonly<{ ownerId: string | null; resourceGeneration: string | null }> | null = null,
  ) => {
    await expect(observer).toHaveAttribute("data-scene-subject-id", sceneId, { timeout: 120_000 });
    await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 120_000 });
    await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgpu-renderer");
    await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgpu");
    await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
    await expect(observer).toHaveAttribute("data-observer-adapter-availability", "available");
    await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
    await expect(observer.locator("canvas")).toHaveCount(1);
    const generation = Number(await observer.getAttribute("data-observer-renderer-generation"));
    if (!Number.isFinite(generation) || (previousGeneration !== null && generation <= previousGeneration)) {
      throw new Error(`${sceneId} did not advance to a unique Observer generation (${previousGeneration} → ${generation})`);
    }
    if (sceneId === "architecture-rise") {
      await expect(observer).toHaveAttribute("data-observer-output-policy-selected", "material-aware");
      await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "material-aware");
      await expect(observer).toHaveAttribute("data-observer-output-policy-status", "active", { timeout: 90_000 });
      await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 90_000 });
      const inventory = JSON.parse((await observer.getAttribute("data-observer-material-inventory")) ?? "null") as Record<string, unknown> | null;
      if (!inventory || inventory.sceneId !== sceneId || Number(inventory.unsupportedMaterialInstances) !== 0 || Number(inventory.adaptedMaterialInstances) < 1) {
        throw new Error("Architecture Rise material-aware inventory was missing, unsupported, or empty");
      }
    } else {
      await expect(observer).toHaveAttribute("data-observer-output-policy-selected", "standard");
      await expect(observer).toHaveAttribute("data-observer-output-policy-selection-reason", "scene-not-eligible");
      await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard");
      await expect(observer).not.toHaveAttribute("data-observer-material-inventory");
      await expect(observer).not.toHaveAttribute("data-observer-output-policy-status");
    }
    await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 90_000 });
    const groundGlassCapture = await captureGroundGlass(page);
    if (!subjectRoiHasMeaningfulPixels(groundGlassCapture.content) || groundGlassCapture.backend.isWebGL2 !== true) {
      throw new Error(`${sceneId} transition did not retain contentful WebGL2 Ground Glass output`);
    }
    const ownerId = String(groundGlassCapture.metrics.ownerId ?? "");
    const resourceGeneration = String(groundGlassCapture.metrics.resourceGeneration ?? "");
    if (!ownerId || !resourceGeneration) throw new Error("Ground Glass ownership/generation evidence was missing");
    if (groundGlassIdentity.ownerId === null) {
      groundGlassIdentity.ownerId = ownerId;
      groundGlassIdentity.resourceGeneration = resourceGeneration;
    } else if (expectedGroundGlassIdentity && (
      ownerId !== expectedGroundGlassIdentity.ownerId ||
      resourceGeneration !== expectedGroundGlassIdentity.resourceGeneration
    )) {
      throw new Error("Output-policy switching on the same scene unexpectedly recreated Ground Glass resources");
    }
    const subjectPixels = await captureSubjectPixelEvidence(page, observer, sceneId);
    return {
      sceneId,
      rendererGeneration: generation,
      rendererFamily: await observer.getAttribute("data-observer-renderer-family"),
      executionBackend: await observer.getAttribute("data-observer-execution-backend"),
      applicationFallback: await observer.getAttribute("data-observer-application-fallback"),
      outputPolicy: await observer.getAttribute("data-observer-output-policy-installed"),
      observerCanvasCount: await observer.locator("canvas").count(),
      subjectPixels,
      groundGlass: {
        contentful: true,
        backend: groundGlassCapture.backend,
        ownerId,
        resourceGeneration,
        canvasCount: groundGlassCapture.metrics.resourceCanvasCount,
      },
    };
  };

  const readResourceSnapshot = async (label: string) => {
    const attributes = await readObserverAttributes(observer);
    const performanceMetrics = await readOutputPolicyPerformance(observer);
    const inventory = JSON.parse(attributes["data-observer-material-inventory"] ?? "null") as Record<string, unknown> | null;
    const snapshot = {
      label,
      rendererGeneration: attributes["data-observer-renderer-generation"] ?? null,
      outputPolicyStatus: attributes["data-observer-output-policy-status"] ?? null,
      performance: performanceMetrics,
      inventory: inventory ? {
        totalMeshAssignments: inventory.totalMeshAssignments ?? null,
        distinctMaterialInstances: inventory.distinctMaterialInstances ?? null,
        adaptedMaterialInstances: inventory.adaptedMaterialInstances ?? null,
        unsupportedMaterialInstances: inventory.unsupportedMaterialInstances ?? null,
      } : null,
    };
    snapshots.push(snapshot);
    return snapshot;
  };

  try {
    await page.goto("/simulator/free/architecture-rise?observerRenderer=webgpu&observerOutput=material-aware&rttDiagnostics=1", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await assertNativeMount("architecture-rise", null);
    const initialAttributes = await readObserverAttributes(observer);
    const initialGeneration = Number(initialAttributes["data-observer-renderer-generation"]);
    const initialSubjectPixels = await captureSubjectPixelEvidence(page, observer, "architecture-rise");
    const initialSnapshot = await readResourceSnapshot("sustained-start");
    const initialPerformance = initialSnapshot.performance as Record<string, unknown> | null;
    if (!initialPerformance) throw new Error("Initial candidate performance snapshot was unavailable");

    const sustainedDurationTargetMs = 120_000;
    const sustainedStartedAt = performance.now();
    const orbitFrames: OrbitFrame[] = [];
    const orbitPointerEvents: OrbitPointerEvent[] = [];
    let orbitGestureCount = 0;
    let controlWorkloadCount = 0;
    let sustainedOrbitCaptureTimedOut = false;
    await startCadenceCapture(page, 180_000);
    try {
      while (performance.now() - sustainedStartedAt < sustainedDurationTargetMs) {
        orbitGestureCount += await performOrbitGestures(page, observer);
        if (orbitGestureCount > 0 && orbitGestureCount % (orbitSequence.length * 4) === 0) {
          await runArchitectureRiseControlWorkload(page, observer);
          controlWorkloadCount += 1;
        }
        if (controlWorkloadCount > 0 && controlWorkloadCount % 5 === 0) {
          const attributes = await readObserverAttributes(observer);
          if (attributes["data-observer-renderer-generation"] !== String(initialGeneration) ||
            attributes["data-observer-output-policy-status"] !== "active" ||
            attributes["data-observer-renderer-family"] !== "webgpu-renderer" ||
            attributes["data-observer-execution-backend"] !== "webgpu") {
            throw new Error("The sustained candidate mount lost its active native material-aware identity");
          }
          await readResourceSnapshot(`sustained-cycle-${controlWorkloadCount}`);
        }
      }
    } finally {
      const cadenceCapture = await finishCadenceCapture(page);
      orbitFrames.push(...cadenceCapture.frames);
      orbitPointerEvents.push(...cadenceCapture.pointerEvents);
      sustainedOrbitCaptureTimedOut = cadenceCapture.timedOut;
    }
    const sustainedDurationMs = performance.now() - sustainedStartedAt;
    await page.getByRole("button", { name: "Reset 3D view", exact: true }).click();
    await waitForFrames(page, 4);
    const endingSnapshot = await readResourceSnapshot("sustained-end");
    const endingPerformance = endingSnapshot.performance as Record<string, unknown> | null;
    const finalSubjectPixelsDuringSustain = await captureSubjectPixelEvidence(page, observer, "architecture-rise");
    const sustainedCadence = analyzeOrbitCadence(orbitPointerEvents, orbitFrames, orbitGestureCount);
    if (sustainedOrbitCaptureTimedOut || sustainedDurationMs < sustainedDurationTargetMs || sustainedCadence.invalidReasons.length > 0) {
      throw new Error(`Sustained workload did not complete cleanly: ${sustainedCadence.invalidReasons.join("; ")}`);
    }
    if (!endingPerformance || !finalSubjectPixelsDuringSustain.contentful) throw new Error("Final sustained candidate evidence was unavailable");

    const startTiming = (initialPerformance.timing as Record<string, unknown>).controllerCallback as Record<string, unknown>;
    const endTiming = (endingPerformance.timing as Record<string, unknown>).controllerCallback as Record<string, unknown>;
    const measuredFrames = Number(endingPerformance.frameCount) - Number(initialPerformance.frameCount);
    const callbackTotal = (timing: Record<string, unknown>) => Number(timing.cumulativeMeanMs) * Number(timing.sampleCount);
    const sustainedControllerMeanMsPerFrame = measuredFrames > 0
      ? (callbackTotal(endTiming) - callbackTotal(startTiming)) / measuredFrames
      : null;
    const sustainedInventory = endingSnapshot.inventory as Record<string, unknown> | null;
    const sustainedPerformanceMetrics = endingPerformance as Record<string, unknown>;
    const activeMaterialCount = Number(sustainedPerformanceMetrics.managedMaterialCount);
    const activeCreationBalance = Number(sustainedPerformanceMetrics.adaptedMaterialCreations) - Number(sustainedPerformanceMetrics.disposedNodeMaterials);
    if (measuredFrames < 1000 || activeMaterialCount < 1 || activeCreationBalance !== activeMaterialCount ||
      Number(sustainedInventory?.unsupportedMaterialInstances) !== 0) {
      throw new Error("Sustained candidate material/resource counts were not stable or did not balance to the active managed set");
    }

    const candidateGeneration = Number(await observer.getAttribute("data-observer-renderer-generation"));
    const outputSwitchStart = (await readLifecycleReports(page)).length;
    await navigateWithinObserverApp(page, "/simulator/free/architecture-rise?observerRenderer=webgpu&observerOutput=standard&rttDiagnostics=1");
    await expect.poll(async () => Number(await observer.getAttribute("data-observer-renderer-generation")), { timeout: 120_000 }).toBeGreaterThan(candidateGeneration);
    await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 120_000 });
    await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgpu-renderer");
    await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgpu");
    await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
    await expect(observer).toHaveAttribute("data-observer-output-policy-selected", "standard");
    await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard");
    await expect(observer).not.toHaveAttribute("data-observer-material-inventory");
    await expect(observer).not.toHaveAttribute("data-observer-output-policy-status");
    await expect.poll(async () => (await readLifecycleReports(page)).length).toBeGreaterThan(outputSwitchStart);
    const standardGeneration = Number(await observer.getAttribute("data-observer-renderer-generation"));
    const outputLifecycleReport = (await readLifecycleReports(page)).at(-1);
    if (!outputLifecycleReport || Number(outputLifecycleReport.rendererGeneration) !== candidateGeneration ||
      Number(outputLifecycleReport.managedMaterialCount) !== 0 ||
      Number(outputLifecycleReport.adaptedMaterialCreations) !== Number(outputLifecycleReport.disposedNodeMaterials)) {
      throw new Error("Material-aware → standard transition did not report disposal of the old candidate mount's adapted materials");
    }
    const standardGroundGlass = await captureGroundGlass(page);
    if (!subjectRoiHasMeaningfulPixels(standardGroundGlass.content) || standardGroundGlass.backend.isWebGL2 !== true) {
      throw new Error("Ground Glass did not remain contentful WebGL2 during the standard-output rollback");
    }
    if (String(standardGroundGlass.metrics.ownerId) !== groundGlassIdentity.ownerId ||
      String(standardGroundGlass.metrics.resourceGeneration) !== groundGlassIdentity.resourceGeneration) {
      throw new Error("Standard output rollback recreated Ground Glass resources");
    }
    outputPolicyTransitions.push({
      from: "material-aware",
      to: "standard",
      candidateGeneration,
      standardGeneration,
      rendererFamily: await observer.getAttribute("data-observer-renderer-family"),
      executionBackend: await observer.getAttribute("data-observer-execution-backend"),
      applicationFallback: await observer.getAttribute("data-observer-application-fallback"),
      inventoryCleared: true,
      lifecycleDisposal: outputLifecycleReport,
    });

    await navigateWithinObserverApp(page, "/simulator/free/architecture-rise?observerRenderer=webgpu&observerOutput=material-aware&rttDiagnostics=1");
    await expect.poll(async () => Number(await observer.getAttribute("data-observer-renderer-generation")), { timeout: 120_000 }).toBeGreaterThan(standardGeneration);
    const remountedCandidate = await assertNativeMount("architecture-rise", standardGeneration, groundGlassIdentity);
    outputPolicyTransitions.push({
      from: "standard",
      to: "material-aware",
      rendererGeneration: remountedCandidate.rendererGeneration,
      outputPolicy: remountedCandidate.outputPolicy,
      inventory: remountedCandidate.subjectPixels,
    });

    let previousGeneration = Number(remountedCandidate.rendererGeneration);
    for (let index = 0; index < 11; index += 1) {
      const sceneId = index % 2 === 0 ? "view-camera-anatomy" : "architecture-rise";
      const path = `/simulator/free/${sceneId}?observerRenderer=webgpu&observerOutput=material-aware&rttDiagnostics=1`;
      await navigateWithinObserverApp(page, path);
      const transition = await assertNativeMount(sceneId, previousGeneration);
      previousGeneration = Number(transition.rendererGeneration);
      transitions.push({ ordinal: index + 1, ...transition });
    }

    const lifecycleReports = await readLifecycleReports(page);
    const archGenerations = new Set([
      candidateGeneration,
      Number(remountedCandidate.rendererGeneration),
      ...transitions.filter((transition) => transition.sceneId === "architecture-rise").map((transition) => Number(transition.rendererGeneration)),
    ]);
    const disposedReports = lifecycleReports.filter((report) => archGenerations.has(Number(report.rendererGeneration)));
    if (disposedReports.length < 7 || disposedReports.some((report) =>
      Number(report.managedMaterialCount) !== 0 ||
      Number(report.adaptedMaterialCreations) !== Number(report.disposedNodeMaterials),
    )) {
      throw new Error("Repeated Architecture Rise remounts did not fully release their adapted NodeMaterials");
    }

    const finalAttributes = await readObserverAttributes(observer);
    const finalSceneSubjectId = await observer.getAttribute("data-scene-subject-id");
    const finalGroundGlass = await captureGroundGlass(page);
    const finalSubjectPixels = transitions.at(-1)?.subjectPixels;
    if (finalSceneSubjectId !== "view-camera-anatomy" ||
      finalAttributes["data-observer-output-policy-installed"] !== "standard" ||
      finalAttributes["data-observer-material-inventory"] !== undefined) {
      throw new Error(`The final Anatomy scene inherited stale Architecture Rise output-policy diagnostics: scene=${finalSceneSubjectId}, installed=${finalAttributes["data-observer-output-policy-installed"]}, inventory=${finalAttributes["data-observer-material-inventory"]}`);
    }
    if (finalGroundGlass.backend.isWebGL2 !== true ||
      !subjectRoiHasMeaningfulPixels(finalGroundGlass.content)) {
      throw new Error("Ground Glass did not retain contentful WebGL2 output after leaving Architecture Rise");
    }
    if (pageErrors.length > 0 || consoleErrors.length > 0) throw new Error("Lifecycle qualification produced browser errors");
    return {
      stable: true,
      nativeBackend: "webgpu-renderer / webgpu",
      sustainedUse: {
        targetDurationMs: sustainedDurationTargetMs,
        measuredDurationMs: sustainedDurationMs,
        orbitGestureCount: orbitGestureCount,
        controlWorkloadCount,
        activeGestureCadence: sustainedCadence.activeGestureCadence,
        allObservedFrameCadence: summarizeFrameCadence(orbitFrames.slice(1).map((frame, index) =>
          frame.timestampMs - (orbitFrames[index]?.timestampMs ?? frame.timestampMs),
        )),
        framesMeasured: measuredFrames,
        controllerMeanCpuMsPerFrameDuringSustain: sustainedControllerMeanMsPerFrame,
        signatureEvaluationsPerFrame: Number(sustainedPerformanceMetrics.materialSignatureEvaluations) / Number(sustainedPerformanceMetrics.frameCount),
        inventoryBuildCount: Number(sustainedPerformanceMetrics.inventoryBuildCount) - Number(initialPerformance.inventoryBuildCount),
        inventoryRefreshIntervalFrames: sustainedPerformanceMetrics.inventoryRefreshIntervalFrames,
        initialResources: initialSnapshot,
        peakManagedMaterialCount: sustainedPerformanceMetrics.peakManagedMaterialCount,
        finalResources: endingSnapshot,
        initialSubjectPixels,
        finalSubjectPixels: finalSubjectPixelsDuringSustain,
        activeAdaptedMaterialBalance: activeCreationBalance,
      },
      outputPolicyTransitions,
      spaTransitions: {
        requiredCount: 11,
        observedCount: transitions.length,
        states: transitions,
        everyRendererGenerationAdvanced: true,
        groundGlassRemainedWebGlAndContentful: true,
        groundGlassIdentityStableAcrossSameSceneOutputSwitch: true,
        lifecycleReports,
        disposedCandidateMountCount: disposedReports.length,
        finalSceneId: finalSceneSubjectId,
        finalOutputPolicy: finalAttributes["data-observer-output-policy-installed"],
        finalRendererGeneration: finalAttributes["data-observer-renderer-generation"],
        finalGroundGlass: {
          contentful: subjectRoiHasMeaningfulPixels(finalGroundGlass.content),
          backend: finalGroundGlass.backend,
          ownerId: finalGroundGlass.metrics.ownerId,
          resourceGeneration: finalGroundGlass.metrics.resourceGeneration,
        },
        finalSubjectPixels,
      },
      pageErrors,
      consoleErrors,
    };
  } catch (error) {
    return {
      stable: false,
      error: error instanceof Error ? error.message : String(error),
      partial: {
        snapshots,
        outputPolicyTransitions,
        spaTransitions: transitions,
        groundGlassIdentity,
        lifecycleReports: await readLifecycleReports(page).catch(() => []),
        pageErrors,
        consoleErrors,
      },
    };
  } finally {
    await context.close().catch(() => undefined);
  }
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
    const cadence = trial.interaction as {
      activeGestureCadence?: ReturnType<typeof summarizeFrameCadence>;
      interGestureCadence?: ReturnType<typeof summarizeFrameCadence>;
    } | null;
    const active = cadence?.activeGestureCadence;
    const gaps = cadence?.interGestureCadence;
    return `| ${trial.sceneId} | ${trial.trialNumber} | ${trial.requestedBackend} | ${trial.requestedOutputPolicy ?? "n/a"} | ${trial.mountedBackend ?? "unavailable"} | ${trial.valid ? "valid" : "invalid"} | ${trial.timing.contextPageSetupWallMs?.toFixed(1) ?? "—"} | ${trial.timing.navigationToDocumentReadyWallMs?.toFixed(1) ?? "—"} | ${trial.timing.navigationToActiveRendererWallMs?.toFixed(1) ?? "—"} | ${trial.timing.navigationToAdapterDiagnosticWallMs?.toFixed(1) ?? "—"} | ${trial.timing.activeRendererToAdapterDiagnosticWallMs?.toFixed(1) ?? "—"} | ${trial.timing.navigationToFirstVerifiedObserverCaptureWallMs?.toFixed(1) ?? "—"} | ${active?.sampleCount ?? 0} / ${active?.medianMs?.toFixed(2) ?? "—"} | ${gaps?.sampleCount ?? 0} / ${gaps?.medianMs?.toFixed(2) ?? "—"} |`;
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
    "| Scene | Pair | Requested backend | Requested output | Mounted family / execution | Validity | Context/page setup ms | Navigation to DOMContentLoaded ms | Navigation to observed active renderer ms | Navigation to adapter diagnostic ms | Active renderer to adapter diagnostic ms | Navigation to verified subject capture ms | Active gesture rAF samples / median ms | Inter-gesture rAF samples / median ms |",
    "| --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...trialRows,
    "",
    "Context/page setup is timed separately and ends before navigation begins. Navigation timing uses one monotonic Node `performance.now()` clock starting immediately before `page.goto`; observed renderer readiness requires the correct scene, active status, resolved renderer family/execution backend, and a current renderer generation. Adapter diagnostic completion is captured asynchronously from the active-renderer boundary, so its time does not delay renderer readiness or the first verified capture. The verified-capture value is recorded only after an actual Observer screenshot has meaningful pixels in its geometry-derived subject ROI; it is not labeled the first contentful frame. None of these wall times is GPU time.",
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
    "- Observer frame cadence: browser `requestAnimationFrame` intervals whose two endpoints both fall between pointerdown and pointerup for the same real OrbitControls gesture. Pre/post idle intervals are discarded; inter-gesture cadence is reported separately. This is presentation scheduling, not Three.js render duration or GPU time.",
    "- Interaction: four real pointer drags with complete down/move/up evidence and camera-pose change checks; cadence intervals are not padded with idle samples. The report does not measure input-to-present latency.",
    "- Ground Glass restoration: the full canvas is captured three times in the same mode before switching. At a one-level RGB channel threshold, the restored image must stay within the worst observed repeated-capture changed-pixel fraction, RGB MAE, and absolute signed-luminance difference. A separate 16-level comparison remains descriptive.",
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

  test("records matched Observer backend or output-policy trials", async ({ browser }, testInfo) => {
    test.setTimeout(30 * 60 * 1000);
    const browserGpuDiagnostics = await readBrowserGpuDiagnostics(browser);
    const trials: BenchmarkTrial[] = [];
    const runStartedAt = new Date().toISOString();
    const writeProgress = async () => {
      await mkdir(outputDirectory, { recursive: true });
      const completedNativeTrials = trials.filter((trial) => trial.requestedBackend === "webgpu");
      await writeFile(join(outputDirectory, "run.json"), serializeBenchmarkReport({
        schemaVersion: 2,
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
        configuration: {
          viewport,
          deviceScaleFactor,
          pairedTrialsPerScene: trialCount,
          outputPolicyComparisonEnabled,
          requestedOutputPolicy: process.env.OBSERVER_BACKEND_BENCHMARK_OUTPUT_POLICY ?? "standard",
        },
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
    if (outputPolicyComparisonEnabled) {
      for (let trialIndex = 0; trialIndex < trialCount; trialIndex += 1) {
        const policyOrder = trialIndex % 2 === 0
          ? ["standard", "material-aware"] as const
          : ["material-aware", "standard"] as const;
        for (let orderWithinPair = 0; orderWithinPair < policyOrder.length; orderWithinPair += 1) {
          const requestedOutputPolicy = policyOrder[orderWithinPair];
          if (!requestedOutputPolicy) continue;
          executionOrder += 1;
          trials.push(await runSingleTrial(
            browser,
            "architecture-rise",
            trialIndex + 1,
            executionOrder,
            orderWithinPair + 1,
            "webgpu",
            requestedOutputPolicy,
            browserGpuDiagnostics,
          ));
          await writeProgress();
        }
      }
    } else {
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
              requestedBackend === "webgpu" ? "standard" : null,
              browserGpuDiagnostics,
            ));
            await writeProgress();
          }
        }
      }
    }

    const recovery: Array<Record<string, unknown>> = [];
    const recoveryScenes = outputPolicyComparisonEnabled ? ["architecture-rise"] as const : benchmarkScenes;
    for (const sceneId of recoveryScenes) {
      try {
        recovery.push(await runRecoverySequence(browser, sceneId));
      } catch (error) {
        recovery.push({ sceneId, stable: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    let materialAwareLifecycleQualification: Record<string, unknown> | null = null;
    if (outputPolicyComparisonEnabled) {
      try {
        materialAwareLifecycleQualification = await runMaterialAwareLifecycleQualification(browser);
      } catch (error) {
        materialAwareLifecycleQualification = {
          stable: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    const { comparisons, pairProblems } = outputPolicyComparisonEnabled
      ? { comparisons: [] as VisualComparison[], pairProblems: [] as string[] }
      : await computeVisualComparisons(trials);
    if (outputPolicyComparisonEnabled) {
      for (let trialNumber = 1; trialNumber <= trialCount; trialNumber += 1) {
        const standard = trials.find((trial) =>
          trial.trialNumber === trialNumber && trial.requestedOutputPolicy === "standard",
        );
        const materialAware = trials.find((trial) =>
          trial.trialNumber === trialNumber && trial.requestedOutputPolicy === "material-aware",
        );
        if (!standard || !materialAware) {
          pairProblems.push(`Architecture Rise output-policy pair ${trialNumber} is incomplete`);
          continue;
        }
        const standardState = standard.canonicalState as {
          controls?: unknown;
          renderQuality?: unknown;
          overlays?: unknown;
        } | null;
        const candidateState = materialAware.canonicalState as {
          controls?: unknown;
          renderQuality?: unknown;
          overlays?: unknown;
        } | null;
        if (JSON.stringify(standardState?.controls) !== JSON.stringify(candidateState?.controls) ||
          standardState?.renderQuality !== candidateState?.renderQuality ||
          JSON.stringify(standardState?.overlays) !== JSON.stringify(candidateState?.overlays)) {
          pairProblems.push(`Architecture Rise output-policy pair ${trialNumber} has different canonical controls or quality`);
        }
        if (!standard.canvas || !materialAware.canvas ||
          standard.canvas.cssWidth !== materialAware.canvas.cssWidth ||
          standard.canvas.cssHeight !== materialAware.canvas.cssHeight ||
          standard.canvas.backingWidth !== materialAware.canvas.backingWidth ||
          standard.canvas.backingHeight !== materialAware.canvas.backingHeight ||
          standard.canvas.dpr !== materialAware.canvas.dpr) {
          pairProblems.push(`Architecture Rise output-policy pair ${trialNumber} has different canvas dimensions or DPR`);
        }
        const standardView = standard.views[0]?.camera;
        const candidateView = materialAware.views[0]?.camera;
        if (!standardView || !candidateView ||
          !vectorsMatch(standardView.position, candidateView.position) ||
          !vectorsMatch(standardView.target, candidateView.target)) {
          pairProblems.push(`Architecture Rise output-policy pair ${trialNumber} has different camera pose`);
        }
      }
    }
    for (const problem of pairProblems) {
      const affected = trials.filter((trial) => problem.includes(trial.sceneId) && (problem.includes(`trial ${trial.trialNumber}`) || !/trial \d+/.test(problem)));
      for (const trial of affected) {
        if (!trial.invalidReasons.includes(problem)) trial.invalidReasons.push(problem);
        trial.valid = false;
      }
    }
    const expectedTrialCount = outputPolicyComparisonEnabled
      ? trialCount * 2
      : benchmarkScenes.length * trialCount * 2;
    const complete = trials.length === expectedTrialCount &&
      trials.every((trial) => trial.valid) &&
      recovery.every((record) => record.stable === true) &&
      (!outputPolicyComparisonEnabled || materialAwareLifecycleQualification?.stable === true) &&
      pairProblems.length === 0;
    const nativeExecution = trials.length > 0 && trials.every((trial) =>
      trial.requestedBackend !== "webgpu" || trial.mountedBackend === "webgpu-renderer / webgpu",
    );
    const hardwareAcceleration: "hardware-backed" | "software-backed" | "unconfirmed" = browserGpuDiagnostics.softwareRendererDetected === true
      ? "software-backed"
      : "unconfirmed";
    const report = {
      schemaVersion: 2,
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
        sceneIds: outputPolicyComparisonEnabled ? ["architecture-rise"] : benchmarkScenes,
        pairedTrialsPerScene: trialCount,
        viewport,
        deviceScaleFactor,
        renderQuality: "high (simulator route default)",
        route: outputPolicyComparisonEnabled
          ? "/simulator/free/architecture-rise?observerRenderer=webgpu&observerOutput=<standard|material-aware>"
          : "/simulator/free/<scene>?observerRenderer=<backend>&observerOutput=standard for WebGPU controls",
        outputPolicyRunOrder: trials.map(({ executionOrder: order, trialNumber, requestedOutputPolicy }) => ({ order, trialNumber, requestedOutputPolicy })),
        executionOrder: trials.map(({ executionOrder: order, sceneId, trialNumber, requestedBackend, requestedOutputPolicy }) => ({ order, sceneId, trialNumber, requestedBackend, requestedOutputPolicy })),
        orbitSequence,
        cadenceSampling: "rAF intervals wholly inside actual pointerdown/up gestures; inter-gesture cadence separate; pre/post idle discarded",
        minimumActiveGestureCadenceSamples: 8,
        groundGlassRestorationPixelThreshold: 1,
        groundGlassRepeatedCaptureCount: 3,
        pixelDifferenceThresholdPerRgbChannel: 16,
      },
      comparisonComplete: complete,
      trials,
      outputPolicyComparison: outputPolicyComparisonEnabled ? {
        scene: "architecture-rise",
        backendQualification: "Every policy trial must mount webgpu-renderer / webgpu with no fallback and one initialization attempt.",
        order: "Three matched pairs; standard/candidate order alternates by pair: standard→candidate, candidate→standard, standard→candidate.",
        pairedEvidence: Array.from({ length: trialCount }, (_, index) => {
          const trialNumber = index + 1;
          const standard = trials.find((trial) => trial.trialNumber === trialNumber && trial.requestedOutputPolicy === "standard");
          const candidate = trials.find((trial) => trial.trialNumber === trialNumber && trial.requestedOutputPolicy === "material-aware");
          const standardActive = standard?.timing.navigationToActiveRendererWallMs ?? null;
          const candidateActive = candidate?.timing.navigationToActiveRendererWallMs ?? null;
          const standardCapture = standard?.timing.navigationToFirstVerifiedObserverCaptureWallMs ?? null;
          const candidateCapture = candidate?.timing.navigationToFirstVerifiedObserverCaptureWallMs ?? null;
          const standardCadence = (standard?.interaction as { activeGestureCadence?: { medianMs?: number | null; p95Ms?: number | null } } | null)?.activeGestureCadence;
          const candidateCadence = (candidate?.interaction as { activeGestureCadence?: { medianMs?: number | null; p95Ms?: number | null } } | null)?.activeGestureCadence;
          return {
            trialNumber,
            order: standard && candidate
              ? (standard.executionOrder < candidate.executionOrder ? "standard-then-material-aware" : "material-aware-then-standard")
              : "incomplete",
            nativeBackend: { standard: standard?.mountedBackend ?? null, materialAware: candidate?.mountedBackend ?? null },
            readinessDeltaMs: {
              materialAwareMinusStandardActiveRenderer: standardActive !== null && candidateActive !== null ? candidateActive - standardActive : null,
              materialAwareMinusStandardVerifiedCapture: standardCapture !== null && candidateCapture !== null ? candidateCapture - standardCapture : null,
              materialAwareOutputPolicyReady: candidate?.readiness.navigationToOutputPolicyActiveWallMs ?? null,
              environmentReadyStandard: standard?.readiness.navigationToEnvironmentActiveWallMs ?? null,
              environmentReadyMaterialAware: candidate?.readiness.navigationToEnvironmentActiveWallMs ?? null,
            },
            activeGestureCadence: {
              standardMedianMs: standardCadence?.medianMs ?? null,
              materialAwareMedianMs: candidateCadence?.medianMs ?? null,
              standardP95Ms: standardCadence?.p95Ms ?? null,
              materialAwareP95Ms: candidateCadence?.p95Ms ?? null,
            },
            controllerCpu: candidate?.outputPolicyPerformance ?? null,
          };
        }),
        measuredGpuTime: false,
        interpretation: "Compare paired deltas with the within-mode trial ranges; three pairs are bounded evidence, not a broad performance ranking.",
      } : null,
      recovery,
      materialAwareLifecycleQualification,
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
        "Context/page setup is reported separately. Navigation wall time starts immediately before page.goto and includes browser/server scheduling, module loading, renderer initialization, and scene realization; it is not GPU time.",
        "Three paired trials per scene are descriptive evidence, not a stable performance ranking or general platform result.",
        "Hardware acceleration remains unconfirmed unless Chrome system diagnostics explicitly identify a software renderer; they do not prove which adapter WebGPU selected.",
        "Pixel differences are quantitative descriptions only. A human must decide whether they affect the scene's teaching purpose.",
        "Observer subject resource counts, renderer-owned GPU memory, and VRAM bytes are not measured.",
        "Ground Glass backend evidence reads the already-mounted display canvas WebGL2 context. Restoration tolerance is the worst observed full-canvas pixel delta across two same-mode repeat captures at a one-level RGB threshold; it is not a fixed percentage threshold.",
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
      const lifecycleFailures = materialAwareLifecycleQualification?.stable === false
        ? [`material-aware lifecycle qualification: ${String(materialAwareLifecycleQualification.error ?? "unstable")}`]
        : [];
      throw new Error([
        `Observer backend comparison is incomplete. Evidence written to ${relative(process.cwd(), outputDirectory)}.`,
        ...invalids,
        ...pairProblems,
        ...recoveryFailures,
        ...lifecycleFailures,
      ].join("\n"));
    }
    expect(nativeExecution, "WebGPU trials must all mount WebGPURenderer with native WebGPU execution").toBe(true);
  });
});
