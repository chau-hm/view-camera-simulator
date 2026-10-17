import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { arch, platform, release } from "node:os";
import { performance } from "node:perf_hooks";
import { dirname } from "node:path";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { REVISION } from "three";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../../scenes/presentation/viewCameraAnatomy";
import { toWorld } from "../../render/rttUtils";
import {
  anatomyMaskBounds,
  combineAnatomyMasks,
  compareAnatomyDifferentialResponses,
  compareAnatomyImages,
  complementAnatomyMask,
  countAnatomyMaskPixels,
  deriveAnatomyDifferenceHeatmap,
  deriveAnatomyObservedDifferentialMask,
  deriveAnatomyDifferentialResponseMask,
  type AnatomyPixelMask,
  type AnatomyRenderableSelector,
} from "../../render/anatomyRenderableContribution";
import {
  comparePixelRegions,
  decodePlaywrightPng,
  subjectRoiHasMeaningfulPixels,
  summarizePixelRegion,
  type DecodedPng,
  type PixelRegion,
} from "./observerBackendBenchmark";

const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const anatomyAuditMode = process.env.OBSERVER_ANATOMY_AUDIT_MODE ?? "standard";
const auditRequestEvent = "vcs:observer-verification:anatomy-material-audit";
const auditResultEvent = "vcs:observer-verification:anatomy-material-audit-result";
const visibilityEvent = "vcs:observer-verification:anatomy-object-visibility";
const visibilityResultEvent = "vcs:observer-verification:anatomy-object-visibility-result";
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
type OutputMode = "standard" | "material-aware";
type Bounds = Readonly<{ left: number; top: number; right: number; bottom: number }>;
type Bounds3 = Readonly<{
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}>;
type MaterialRecord = Readonly<{
  role: string;
  cameraPart: string | null;
  owner: string;
  sourceMaterialId: string;
  outputMaterialIds: readonly string[];
  outputMaterialFamilies: readonly string[];
  adapted: boolean;
  assignments: number;
  objectNames: readonly string[];
  properties: Readonly<{
    id: string;
    type: string;
    family: string;
    color: string | null;
    emissive: string | null;
    emissiveIntensity: number | null;
    toneMapped: boolean;
    opacity: number;
    transparent: boolean;
    blending: number;
    premultipliedAlpha: boolean;
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
type RenderableAuditRecord = Readonly<{
  objectId: string;
  name: string;
  type: string;
  role: string;
  cameraPart: string | null;
  parentHierarchy: readonly Readonly<{ id: string; name: string; type: string }>[];
  worldMatrix: readonly number[];
  renderOrder: number;
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  transparencyCategories: readonly string[];
  projectedBounds: Bounds | null;
  geometry: Readonly<Record<string, unknown>>;
  materialAssignments: readonly Readonly<{
    slot: number;
    adapted: boolean;
    transparencyCategories: readonly string[];
    sourceTransparency: Readonly<{ transparent: boolean; opacity: number; alphaTest: number; hasAlphaMap: boolean }>;
    source: MaterialRecord["properties"];
    output: MaterialRecord["properties"];
  }>[];
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
  renderables: readonly RenderableAuditRecord[];
  transparencyInventory: Readonly<{
    materialAssignmentCounts: readonly Readonly<{
      role: string;
      cameraPart: string | null;
      classification: string;
      materialFamily: string;
      assignmentCount: number;
    }>[];
    mixedMaterialRenderableCount: number;
    visibleExplicitTransparentRenderableCount: number;
    transparentOverlapCandidateCount: number;
    transparentOverlapCandidates: readonly Readonly<Record<string, unknown>>[];
  }>;
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
  outputMode: OutputMode;
  screenshot: Buffer;
  decoded: DecodedPng;
  subjectPixels: CanvasEvidence | null;
  movementState: readonly Readonly<{ label: string; value: string }>[];
  inventory: InventorySnapshot;
  observerAttributes: Record<string, string>;
  groundGlass: Readonly<{
    attributes: Record<string, string>;
    pixels: CanvasEvidence;
    decoded: DecodedPng;
    resourceSnapshot: string | null;
  }>;
}>;

type RenderableContributionCondition =
  | "explicit-transparent"
  | "known-transparent-surface"
  | "selected-part"
  | "dimmed-parts"
  | "registered-target-subject"
  | "conceptual-camera"
  | "all-renderables";

type RenderableContributionFrame = Readonly<{
  state: string;
  condition: RenderableContributionCondition;
  trial: number;
  selector: AnatomyRenderableSelector;
  evidenceArtifactPrefix: string;
  evidenceArtifactsRetained: boolean;
  targets: readonly Readonly<Record<string, unknown>>[];
  excludedPng: Buffer;
  excluded: DecodedPng;
  hiddenInventory: InventorySnapshot;
  restoredPng: Buffer;
  restored: DecodedPng;
  restoredInventory: InventorySnapshot;
  visibleToExcluded: ReturnType<typeof compareAnatomyImages>;
  visibleToRestored: ReturnType<typeof compareAnatomyImages>;
  sameModeRepeatNoise: ReturnType<typeof compareAnatomyImages>;
  visibleBaselineDrift: ReturnType<typeof compareAnatomyImages>;
  observedDifferentialMask: AnatomyPixelMask;
  projectedCandidateMask: AnatomyPixelMask | null;
  projectedCandidateBounds: Bounds | null;
  projectedCandidateDifference: ReturnType<typeof compareAnatomyImages> | null;
  changedPixelsInsideProjectedCandidate: number;
  changedPixelsLocalizedFraction: number;
  hiddenGroundGlassAttributes: Record<string, string>;
  restoredGroundGlassAttributes: Record<string, string>;
  hiddenObserverAttributes: Record<string, string>;
  restoredObserverAttributes: Record<string, string>;
  hiddenGroundGlassDifference: ReturnType<typeof compareAnatomyImages>;
  restorationGroundGlassDifference: ReturnType<typeof compareAnatomyImages>;
  rendererIdentityStable: boolean;
  sourceResourceIdentityPreservedByVisibilityMutations: boolean;
  sourceResourceIdentityMatchesInitialExclusion: boolean;
  sourceMaterialPropertiesAndGeometryContentsStable: boolean;
  geometryIdentityChanges: Readonly<{
    referenceToVisible: readonly Readonly<Record<string, unknown>>[];
    visibleToExcluded: readonly Readonly<Record<string, unknown>>[];
    excludedToRestored: readonly Readonly<Record<string, unknown>>[];
  }>;
  restoredVisibilityMatches: boolean;
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

const startFrameCadenceProbe = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    type ProbeWindow = Window & {
      __anatomyMaterialAwareFrameCadence?: {
        active: boolean;
        previousTimestamp: number | null;
        intervals: number[];
      };
    };
    const target = window as ProbeWindow;
    const probe: NonNullable<ProbeWindow["__anatomyMaterialAwareFrameCadence"]> = {
      active: true,
      previousTimestamp: null,
      intervals: [],
    };
    target.__anatomyMaterialAwareFrameCadence = probe;
    const sample = (timestamp: number) => {
      if (!probe.active) return;
      if (probe.previousTimestamp !== null) probe.intervals.push(timestamp - probe.previousTimestamp);
      probe.previousTimestamp = timestamp;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
};

const finishFrameCadenceProbe = async (page: Page) => page.evaluate(() => {
  type ProbeWindow = Window & {
    __anatomyMaterialAwareFrameCadence?: {
      active: boolean;
      previousTimestamp: number | null;
      intervals: number[];
    };
  };
  const probe = (window as ProbeWindow).__anatomyMaterialAwareFrameCadence;
  if (!probe) throw new Error("Anatomy frame cadence probe was not started");
  probe.active = false;
  const sorted = probe.intervals.slice().sort((left, right) => left - right);
  const percentile = (fraction: number): number | null => sorted.length === 0
    ? null
    : sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)] ?? null;
  const medianFrameIntervalMs = percentile(0.5);
  return {
    sampleCount: sorted.length,
    medianFrameIntervalMs,
    p95FrameIntervalMs: percentile(0.95),
    medianFramesPerSecond: medianFrameIntervalMs && medianFrameIntervalMs > 0
      ? 1000 / medianFrameIntervalMs
      : null,
  };
});

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
  outputMode: OutputMode,
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
  const resourceChannel = page.locator('[data-rtt-resource-channel="default"]');
  const resourceSnapshot = await resourceChannel.getAttribute("data-rtt-anatomy-resource-snapshot");
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
  const filename = `${backend}${outputMode === "material-aware" ? "-material-aware" : ""}-${state}.png`;
  const output = testInfo.outputPath(filename);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, screenshot);
  await testInfo.attach(filename, { body: screenshot, contentType: "image/png" });

  return {
    id: `${backend}${outputMode === "material-aware" ? "-material-aware" : ""}/${state}`,
    filename,
    state,
    backend,
    outputMode,
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
    groundGlass: { attributes: groundGlassAttributes, pixels: groundGlassPixels, decoded: groundGlassImage, resourceSnapshot },
  };
};

const waitForInitialState = async (
  page: Page,
  backend: BackendName,
  outputMode: OutputMode = "standard",
  includeGhost = false,
): Promise<Readonly<{
  position: number[];
  target: number[];
}>> => {
  const params = new URLSearchParams({
    lesson: "1",
    observerMaterialAudit: "1",
    rttDiagnostics: "1",
    observerOutput: "standard",
  });
  if (includeGhost) params.set("observerMaterialAuditGhost", "1");
  if (backend === "native-webgpu") {
    params.set("observerRenderer", "webgpu");
    params.set("observerOutput", outputMode);
  }
  await page.goto(`/simulator/free/view-camera-anatomy?${params.toString()}`);
  const observer = page.getByTestId("scene-canvas");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", /^(webgl-renderer|webgpu-renderer)$/);
  await expect(observer).toHaveAttribute("data-observer-execution-backend", /^(webgl2|webgpu|webgl2-fallback)$/);
  if (backend === "webgl" || outputMode === "standard") {
    await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard");
  } else {
    await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "material-aware", { timeout: 60_000 });
    await expect(observer).toHaveAttribute("data-observer-output-policy-scene-adapter", "view-camera-anatomy");
    await expect(observer).toHaveAttribute("data-observer-output-policy-readiness", "ready");
    await expect(observer).toHaveAttribute("data-observer-output-policy-status", "active");
    await expect(observer).toHaveAttribute("data-observer-output-policy-unsupported-count", "0");
  }
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
    // The mounted renderer/backend assertions above are authoritative. The
    // cached public API probe is bounded and may time out while a native adapter
    // is already in use; record that probe as unknown instead of blocking the
    // native capture on a secondary diagnostic.
    await expect(observer).toHaveAttribute("data-observer-adapter-availability", /^(available|timed-out)$/);
    await expect(observer).not.toHaveAttribute("data-observer-renderer-failure-stage");
    await expect(observer).toHaveAttribute("data-observer-output-policy-selected", outputMode);
  }

  const positionText = await observer.getAttribute("data-observer-camera-position");
  const targetText = await observer.getAttribute("data-orbit-target");
  if (!positionText || !targetText) throw new Error("Anatomy Observer did not expose its active camera pose");
  return {
    position: positionText.split(",").map(Number),
    target: targetText.split(",").map(Number),
  };
};

let visibilityRequestSequence = 0;

type VisibilityRequestResult = Readonly<{
  requestId: string;
  generation: number;
  ok: boolean;
  reason?: string;
  operation?: string;
  transactionId?: string;
  targetCount?: number;
  sourceResourceIdentityPreserved?: boolean;
  sourceResourceIdentityMatchesInitialExclusion?: boolean;
  targets?: readonly Readonly<Record<string, unknown>>[];
  restored?: readonly Readonly<{ id: string; visible: boolean }>[];
}>;

const requestRenderableVisibility = async (
  page: Page,
  request: Readonly<{
    generation: number;
    operation: "exclude" | "restore" | "noop";
    transactionId?: string;
    selector?: AnatomyRenderableSelector;
  }>,
): Promise<VisibilityRequestResult> => {
  const requestId = `anatomy-visibility-${request.generation}-${++visibilityRequestSequence}`;
  const result = await page.getByTestId("scene-canvas").evaluate((element, payload) =>
    new Promise<VisibilityRequestResult>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        element.removeEventListener(payload.resultEvent, onResult);
        reject(new Error("Timed out waiting for the generation-scoped Anatomy visibility result"));
      }, 5_000);
      const onResult = (event: Event) => {
        const detail = (event as CustomEvent<VisibilityRequestResult>).detail;
        if (detail?.requestId !== payload.requestId) return;
        window.clearTimeout(timeout);
        element.removeEventListener(payload.resultEvent, onResult);
        resolve(detail);
      };
      element.addEventListener(payload.resultEvent, onResult);
      element.dispatchEvent(new CustomEvent(payload.eventName, {
        detail: { ...payload.request, requestId: payload.requestId },
      }));
    }),
  {
    request,
    requestId,
    eventName: visibilityEvent,
    resultEvent: visibilityResultEvent,
  });
  expect(result.requestId).toBe(requestId);
  expect(result.generation).toBe(request.generation);
  return result;
};

const createPixelMaskForRegion = (width: number, height: number, region: PixelRegion): AnatomyPixelMask => {
  const left = Math.max(0, Math.min(width, Math.floor(region.left)));
  const top = Math.max(0, Math.min(height, Math.floor(region.top)));
  const right = Math.max(left, Math.min(width, Math.ceil(region.right)));
  const bottom = Math.max(top, Math.min(height, Math.ceil(region.bottom)));
  if (right <= left || bottom <= top) throw new Error("Projected candidate mask has zero area");
  const pixels = new Uint8Array(width * height);
  for (let y = top; y < bottom; y += 1) {
    pixels.fill(1, y * width + left, y * width + right);
  }
  return { width, height, pixels };
};

const renderableResourceRecords = (inventory: InventorySnapshot) => inventory.renderables.map((renderable) => ({
  objectId: renderable.objectId,
  name: renderable.name,
  geometryContentFingerprint: (renderable.geometry as { contentFingerprint?: string }).contentFingerprint ?? null,
  materials: renderable.materialAssignments.map((assignment) => ({
    slot: assignment.slot,
    source: assignment.source,
    output: assignment.output,
  })),
})).sort((left, right) => left.objectId.localeCompare(right.objectId));

const changedGeometryInstanceIds = (expected: InventorySnapshot, actual: InventorySnapshot) => {
  const expectedById = new Map(expected.renderables.map((renderable) => [renderable.objectId, renderable]));
  const actualById = new Map(actual.renderables.map((renderable) => [renderable.objectId, renderable]));
  return expected.renderables.flatMap((renderable) => {
    const next = actualById.get(renderable.objectId);
    const beforeId = (renderable.geometry as { id?: string }).id ?? null;
    const afterId = next ? (next.geometry as { id?: string }).id ?? null : null;
    return next && beforeId !== afterId
      ? [{ objectId: renderable.objectId, name: renderable.name, beforeGeometryId: beforeId, afterGeometryId: afterId }]
      : [];
  }).concat(actual.renderables.filter((renderable) => !expectedById.has(renderable.objectId)).map((renderable) => ({
    objectId: renderable.objectId,
    name: renderable.name,
    beforeGeometryId: null,
    afterGeometryId: (renderable.geometry as { id?: string }).id ?? null,
  })));
};

const changedRenderableResourceIdentities = (
  expected: InventorySnapshot,
  actual: InventorySnapshot,
) => {
  const expectedById = new Map(renderableResourceRecords(expected).map((record) => [record.objectId, record]));
  const actualById = new Map(renderableResourceRecords(actual).map((record) => [record.objectId, record]));
  const objectIds = new Set([...expectedById.keys(), ...actualById.keys()]);
  return [...objectIds].filter((objectId) =>
    JSON.stringify(expectedById.get(objectId) ?? null) !== JSON.stringify(actualById.get(objectId) ?? null),
  ).map((objectId) => ({
    objectId,
    expected: expectedById.get(objectId) ?? null,
    actual: actualById.get(objectId) ?? null,
  }));
};

const observerIdentity = (attributes: Record<string, string>): string => JSON.stringify({
  generation: attributes["data-observer-renderer-generation"],
  request: attributes["data-observer-renderer-request"],
  attempt: attributes["data-observer-renderer-attempt"],
  family: attributes["data-observer-renderer-family"],
  backend: attributes["data-observer-execution-backend"],
  fallback: attributes["data-observer-application-fallback"],
  outputPolicy: attributes["data-observer-output-policy-installed"],
  outputPolicyStatus: attributes["data-observer-output-policy-status"],
  outputPolicyReadiness: attributes["data-observer-output-policy-readiness"],
});

const renderStateIdentity = (inventory: InventorySnapshot): string => JSON.stringify({
  viewport: inventory.viewport,
  background: inventory.background,
  environment: inventory.environment,
  lights: inventory.lights,
  renderer: inventory.renderer,
});

const captureBackend = async (
  browser: Browser,
  backend: BackendName,
  pose: Readonly<{ position: readonly number[]; target: readonly number[] }> | null,
  testInfo: TestInfo,
  outputMode: OutputMode = "standard",
  includeGhost = false,
  collectNegativeControls = false,
  collectRenderableContributions = false,
) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const navigationStartedAt = performance.now();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  try {
    const initialPose = await waitForInitialState(page, backend, outputMode, includeGhost);
    const navigationToRendererReadyMs = performance.now() - navigationStartedAt;
    const cameraPose = pose ?? initialPose;
    const observer = page.getByTestId("scene-canvas");
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
    await startFrameCadenceProbe(page);
    const panel = page.locator(".anatomy-lesson-panel");
    const heading = panel.getByRole("heading", { level: 3 });
    const next = panel.getByRole("button", { name: "Next", exact: true });
    const captures: Capture[] = [];
    const renderableContributionFrames: RenderableContributionFrame[] = [];
    const repeatNoiseByState = new Map<string, ReturnType<typeof compareAnatomyImages>>();
    const repeatCaptureConsistency: Record<string, unknown> = {};
    const negativeControls: Record<string, unknown> = {};
    const captureVisibilityDifferential = async (
      reference: Capture,
      controlName: "registered-target-subject" | "camera-anatomy-front-standard",
      regionName: string,
    ) => {
      const normalized = reference.inventory.projectedRegions[regionName];
      if (!normalized) throw new Error(`${backend}/${outputMode} has no projected region for ${regionName}`);
      const region = regionInPixels(normalized, reference.decoded);
      if (region.right <= region.left || region.bottom <= region.top) {
        throw new Error(`${backend}/${outputMode} ${regionName} is empty`);
      }
      const canvas = observer.locator("canvas");
      let hidden: Buffer | null = null;
      let restored: Buffer | null = null;
      try {
        if (controlName === "registered-target-subject") {
          await observer.evaluate((element) => element.dispatchEvent(new CustomEvent(
            "vcs:observer-verification:anatomy-visibility",
            { detail: false },
          )));
          await expect(observer).toHaveAttribute("data-observer-test-anatomy-subject-visible", "false");
        } else {
          await observer.evaluate((element) => element.dispatchEvent(new CustomEvent(
            "vcs:observer-verification:anatomy-object-visibility",
            { detail: { objectName: "camera-anatomy-front-standard", visible: false } },
          )));
          await expect(observer).toHaveAttribute("data-observer-test-object-visibility", JSON.stringify({
            objectName: "camera-anatomy-front-standard",
            visible: false,
          }));
        }
        await stabilizeFrame(page);
        hidden = await canvas.screenshot({ animations: "disabled" });
      } finally {
        if (controlName === "registered-target-subject") {
          await observer.evaluate((element) => element.dispatchEvent(new CustomEvent(
            "vcs:observer-verification:anatomy-visibility",
            { detail: true },
          )));
          await expect(observer).toHaveAttribute("data-observer-test-anatomy-subject-visible", "true");
        } else {
          await observer.evaluate((element) => element.dispatchEvent(new CustomEvent(
            "vcs:observer-verification:anatomy-object-visibility",
            { detail: { objectName: "camera-anatomy-front-standard", visible: true } },
          )));
          await expect(observer).toHaveAttribute("data-observer-test-object-visibility", JSON.stringify({
            objectName: "camera-anatomy-front-standard",
            visible: true,
          }));
        }
        await stabilizeFrame(page);
        restored = await canvas.screenshot({ animations: "disabled" });
      }
      if (!hidden || !restored) throw new Error(`${controlName} negative-control captures were not completed`);
      const hiddenDecoded = decodePlaywrightPng(hidden);
      const restoredDecoded = decodePlaywrightPng(restored);
      const regionDifference = comparePixelRegions(reference.decoded, hiddenDecoded, region, 12);
      const fullDifference = comparePixelRegions(reference.decoded, hiddenDecoded, {
        left: 0,
        top: 0,
        right: reference.decoded.width,
        bottom: reference.decoded.height,
      }, 12);
      const restorationDifference = comparePixelRegions(reference.decoded, restoredDecoded, {
        left: 0,
        top: 0,
        right: reference.decoded.width,
        bottom: reference.decoded.height,
      }, 12);
      const hiddenPixels = summarizeImage(hiddenDecoded);
      const hiddenCanvasContentful = subjectRoiHasMeaningfulPixels({
        region: { left: 0, top: 0, right: hiddenDecoded.width, bottom: hiddenDecoded.height },
        sampleCount: hiddenPixels.sampleCount,
        distinctColorBuckets: hiddenPixels.distinctColorBuckets,
        meanLuminance: hiddenPixels.meanLuminance,
        luminanceStandardDeviation: hiddenPixels.luminanceStandardDeviation,
      });
      const localizedFraction = fullDifference.changedPixelCount > 0
        ? regionDifference.changedPixelCount / fullDifference.changedPixelCount
        : 0;
      const minimumChangedPixels = Math.max(64, Math.ceil(regionDifference.changedPixelCount > 0 ? 0.001 * (region.right - region.left) * (region.bottom - region.top) : 64));
      const evidence = {
        method: "actual Observer framebuffer visibility differential",
        objectName: controlName === "registered-target-subject" ? "view-camera-anatomy-subject" : controlName,
        normalizedProjectedRegion: normalized,
        pixelRegion: region,
        regionDifference,
        fullCanvasDifference: fullDifference,
        changedPixelFractionLocalizedToRegion: localizedFraction,
        minimumChangedPixels,
        hiddenCanvasContentful,
        restorationDifference,
      };
      expect(regionDifference.changedPixelCount, `${backend}/${outputMode} ${controlName} absence must change projected pixels`)
        .toBeGreaterThan(minimumChangedPixels);
      expect(localizedFraction, `${backend}/${outputMode} ${controlName} pixel change must be localized to its projected ROI`)
        .toBeGreaterThanOrEqual(0.6);
      expect(hiddenCanvasContentful, `${backend}/${outputMode} unrelated scene and background remain visible in the negative control`)
        .toBe(true);
      expect(restorationDifference.changedPixelFraction)
        .toBeLessThanOrEqual(0.005);
      return evidence;
    };
    const captureRenderableContribution = async (
      reference: Capture,
      condition: RenderableContributionCondition,
      selector: AnatomyRenderableSelector,
      trial = 1,
    ): Promise<Omit<RenderableContributionFrame, "evidenceArtifactPrefix" | "evidenceArtifactsRetained">> => {
      let sameModeRepeatNoise = repeatNoiseByState.get(reference.state);
      if (!sameModeRepeatNoise) {
        await stabilizeFrame(page);
        const repeatedBaseline = decodePlaywrightPng(await observer.locator("canvas").screenshot({ animations: "disabled" }));
        const repeatMetrics = compareAnatomyImages(reference.decoded, repeatedBaseline);
        const noOpResult = await requestRenderableVisibility(page, {
          generation: reference.inventory.generation,
          operation: "noop",
        });
        expect(noOpResult.ok, `${backend}/${outputMode}/${reference.state} no-op request must be accepted`).toBe(true);
        await stabilizeFrame(page);
        const noOpFrame = decodePlaywrightPng(await observer.locator("canvas").screenshot({ animations: "disabled" }));
        const noOpMetrics = compareAnatomyImages(reference.decoded, noOpFrame);
        sameModeRepeatNoise = {
          sampleCount: reference.decoded.width * reference.decoded.height,
          meanAbsoluteRgbDifference: Math.max(repeatMetrics.meanAbsoluteRgbDifference, noOpMetrics.meanAbsoluteRgbDifference),
          perChannelMeanAbsoluteDifference: [0, 1, 2].map((channel) => Math.max(
            repeatMetrics.perChannelMeanAbsoluteDifference[channel] ?? 0,
            noOpMetrics.perChannelMeanAbsoluteDifference[channel] ?? 0,
          )) as [number, number, number],
          changedPixelCount: Math.max(repeatMetrics.changedPixelCount, noOpMetrics.changedPixelCount),
          changedPixelFraction: Math.max(repeatMetrics.changedPixelFraction, noOpMetrics.changedPixelFraction),
          meanSignedLuminanceDifference: Math.abs(repeatMetrics.meanSignedLuminanceDifference) >=
            Math.abs(noOpMetrics.meanSignedLuminanceDifference)
            ? repeatMetrics.meanSignedLuminanceDifference
            : noOpMetrics.meanSignedLuminanceDifference,
        };
        repeatNoiseByState.set(reference.state, sameModeRepeatNoise);
      }

      const transactionId = `${backend}-${outputMode}-${reference.state}-${condition}-${trial}`;
      await stabilizeFrame(page);
      const visibleBaselinePng = await observer.locator("canvas").screenshot({ animations: "disabled" });
      const visibleBaseline = decodePlaywrightPng(visibleBaselinePng);
      const visibleInventory = await readInventory(page, `${transactionId}-visible`);
      const visibleObserverAttributes = await attributes(observer);
      const groundGlass = page.getByTestId("ground-glass-rtt");
      const visibleGroundGlassAttributes = await attributes(groundGlass);
      const visibleGroundGlassPng = await groundGlass.locator("canvas").first().screenshot({ animations: "disabled" });
      const visibleGroundGlass = decodePlaywrightPng(visibleGroundGlassPng);
      const visibleBaselineDrift = compareAnatomyImages(reference.decoded, visibleBaseline);
      expect(visibleBaselineDrift.meanAbsoluteRgbDifference)
        .toBeLessThanOrEqual(sameModeRepeatNoise.meanAbsoluteRgbDifference + Number.EPSILON);
      const visibleObserverIdentity = observerIdentity(visibleObserverAttributes);
      expect(visibleInventory.generation).toBe(reference.inventory.generation);
      expect(visibleObserverIdentity).toBe(observerIdentity(reference.observerAttributes));
      expect(renderStateIdentity(visibleInventory)).toBe(renderStateIdentity(reference.inventory));
      expect(visibleGroundGlassAttributes["data-rtt-final-contentful"]).toBe("true");
      let applied = false;
      let exclusionResult: VisibilityRequestResult | null = null;
      let excludedPng: Buffer | null = null;
      let excluded: DecodedPng | null = null;
      let hiddenInventory: InventorySnapshot | null = null;
      let hiddenGroundGlassDifference: ReturnType<typeof compareAnatomyImages> | null = null;
      let hiddenGroundGlassAttributes: Record<string, string> | null = null;
      let restoredPng: Buffer | null = null;
      let restored: DecodedPng | null = null;
      let restoredInventory: InventorySnapshot | null = null;
      let restorationGroundGlassDifference: ReturnType<typeof compareAnatomyImages> | null = null;
      let restoredGroundGlassAttributes: Record<string, string> | null = null;
      let restoreResult: VisibilityRequestResult | null = null;
      let hiddenObserverAttributes: Record<string, string> | null = null;
      let restoredObserverAttributes: Record<string, string> | null = null;

      try {
        exclusionResult = await requestRenderableVisibility(page, {
          generation: reference.inventory.generation,
          operation: "exclude",
          transactionId,
          selector,
        });
        expect(exclusionResult.ok, `${backend}/${outputMode}/${reference.state}/${condition} exclusion must resolve current renderables`)
          .toBe(true);
        applied = true;
        expect(exclusionResult.targetCount ?? 0).toBeGreaterThan(0);
        await stabilizeFrame(page);
        excludedPng = await observer.locator("canvas").screenshot({ animations: "disabled" });
        excluded = decodePlaywrightPng(excludedPng);
        hiddenInventory = await readInventory(page, `${transactionId}-hidden`);
        hiddenObserverAttributes = await attributes(observer);
        hiddenGroundGlassAttributes = await attributes(groundGlass);
        const hiddenGroundGlassPng = await groundGlass.locator("canvas").first().screenshot({ animations: "disabled" });
        hiddenGroundGlassDifference = compareAnatomyImages(
          visibleGroundGlass,
          decodePlaywrightPng(hiddenGroundGlassPng),
        );
      } finally {
        if (applied) {
          restoreResult = await requestRenderableVisibility(page, {
            generation: reference.inventory.generation,
            operation: "restore",
            transactionId,
          });
          expect(restoreResult.ok, `${backend}/${outputMode}/${reference.state}/${condition} exact visibility restore must succeed`)
            .toBe(true);
          expect(restoreResult.sourceResourceIdentityPreserved,
            `${backend}/${outputMode}/${reference.state}/${condition} restore must preserve source geometry/material references`)
            .toBe(true);
          await stabilizeFrame(page);
          restoredPng = await observer.locator("canvas").screenshot({ animations: "disabled" });
          restored = decodePlaywrightPng(restoredPng);
          restoredInventory = await readInventory(page, `${transactionId}-restored`);
          restoredObserverAttributes = await attributes(observer);
          restoredGroundGlassAttributes = await attributes(groundGlass);
          const restoredGroundGlassPng = await groundGlass.locator("canvas").first().screenshot({ animations: "disabled" });
          restorationGroundGlassDifference = compareAnatomyImages(
            visibleGroundGlass,
            decodePlaywrightPng(restoredGroundGlassPng),
          );
        }
      }

      if (!exclusionResult || !excludedPng || !excluded || !hiddenInventory ||
          !hiddenGroundGlassDifference || !hiddenGroundGlassAttributes ||
          !restoredPng || !restored || !restoredInventory || !restorationGroundGlassDifference ||
          !restoredGroundGlassAttributes || !restoreResult || !hiddenObserverAttributes || !restoredObserverAttributes) {
        throw new Error(`${backend}/${outputMode}/${reference.state}/${condition} did not complete hidden and restoration evidence`);
      }
      const visibleToExcluded = compareAnatomyImages(visibleBaseline, excluded);
      const visibleToRestored = compareAnatomyImages(visibleBaseline, restored);
      expect(visibleToRestored.meanAbsoluteRgbDifference)
        .toBeLessThanOrEqual(sameModeRepeatNoise.meanAbsoluteRgbDifference + Number.EPSILON);
      expect(visibleToRestored.changedPixelCount).toBeLessThanOrEqual(sameModeRepeatNoise.changedPixelCount);
      expect(hiddenInventory.generation).toBe(visibleInventory.generation);
      expect(restoredInventory.generation).toBe(visibleInventory.generation);
      expect(observerIdentity(hiddenObserverAttributes)).toBe(visibleObserverIdentity);
      expect(observerIdentity(restoredObserverAttributes)).toBe(visibleObserverIdentity);
      expect(renderStateIdentity(hiddenInventory)).toBe(renderStateIdentity(visibleInventory));
      expect(renderStateIdentity(restoredInventory)).toBe(renderStateIdentity(visibleInventory));
      const targetIds = new Set((exclusionResult.targets ?? []).map((target) => String(target.id)));
      expect(changedRenderableResourceIdentities(visibleInventory, hiddenInventory),
        "A visibility-only exclusion must preserve scene object identities, source/output material values, and geometry vertex/index data")
        .toEqual([]);
      expect(changedRenderableResourceIdentities(visibleInventory, restoredInventory),
        "Restoring visibility must preserve scene object identities, source/output material values, and geometry vertex/index data")
        .toEqual([]);
      expect(hiddenGroundGlassAttributes["data-rtt-final-contentful"]).toBe("true");
      expect(restoredGroundGlassAttributes["data-rtt-final-contentful"]).toBe("true");
      expect(hiddenGroundGlassDifference.meanAbsoluteRgbDifference).toBeLessThanOrEqual(0.5);
      expect(restorationGroundGlassDifference.meanAbsoluteRgbDifference).toBeLessThanOrEqual(0.5);
      if (outputMode === "material-aware") {
        expect(hiddenObserverAttributes["data-observer-output-policy-readiness"]).toBe("ready");
        expect(hiddenObserverAttributes["data-observer-output-policy-status"]).toBe("active");
        expect(restoredObserverAttributes["data-observer-output-policy-readiness"]).toBe("ready");
        expect(restoredObserverAttributes["data-observer-output-policy-status"]).toBe("active");
      }

      const hiddenTargetRecords = hiddenInventory.renderables.filter((renderable) => targetIds.has(renderable.objectId));
      expect(hiddenTargetRecords).toHaveLength(targetIds.size);
      expect(hiddenTargetRecords.every((renderable) => !renderable.visible)).toBe(true);
      const visibilityRestoreMismatches = (restoreResult.restored ?? []).flatMap((entry) => {
        const original = (exclusionResult?.targets ?? []).find((target) => target.id === entry.id);
        return original?.originalVisibility === entry.visible ? [] : [{ id: entry.id, expected: original?.originalVisibility, actual: entry.visible }];
      });
      const restoredVisibilityMatches = visibilityRestoreMismatches.length === 0;
      expect(visibilityRestoreMismatches, "Visibility restore values must exactly match the exclusion snapshots").toEqual([]);
      const sourceResourceIdentityPreservedByVisibilityMutations =
        exclusionResult.sourceResourceIdentityPreserved === true && restoreResult.sourceResourceIdentityPreserved === true;
      expect(sourceResourceIdentityPreservedByVisibilityMutations,
        `${backend}/${outputMode}/${reference.state}/${condition} visibility operations must preserve source geometry/material references`)
        .toBe(true);
      const sourceResourceIdentityMatchesInitialExclusion = restoreResult.sourceResourceIdentityMatchesInitialExclusion === true;
      const restoredTargetRecords = restoredInventory.renderables.filter((renderable) => targetIds.has(renderable.objectId));
      expect(restoredTargetRecords).toHaveLength(targetIds.size);
      expect(restoredTargetRecords.every((renderable) => renderable.visible)).toBe(true);
      const normalizedBounds = visibleInventory.renderables
        .filter((renderable) => targetIds.has(renderable.objectId) && renderable.projectedBounds !== null)
        .map((renderable) => renderable.projectedBounds as Bounds);
      const projectedCandidateBounds = normalizedBounds.length > 0
        ? normalizedBounds.reduce((combined, bounds) => unionBounds(combined, bounds))
        : null;
      const projectedCandidateMask = projectedCandidateBounds
        ? createPixelMaskForRegion(reference.decoded.width, reference.decoded.height,
            regionInPixels(projectedCandidateBounds, reference.decoded))
        : null;
      const observedDifferentialMask = deriveAnatomyObservedDifferentialMask(visibleBaseline, excluded, 8);
      const projectedCandidateDifference = projectedCandidateMask
        ? compareAnatomyImages(visibleBaseline, excluded, projectedCandidateMask)
        : null;
      const candidatePixelsChanged = projectedCandidateMask
        ? countAnatomyMaskPixels(combineAnatomyMasks(observedDifferentialMask, projectedCandidateMask, "intersection"))
        : 0;
      const localizedFraction = countAnatomyMaskPixels(observedDifferentialMask) > 0
        ? candidatePixelsChanged / countAnatomyMaskPixels(observedDifferentialMask)
        : 0;
      if (condition === "known-transparent-surface") {
        expect((exclusionResult.targets ?? []).length).toBe(1);
        expect((exclusionResult.targets?.[0]?.materialSlots as Array<{ transparent?: boolean }> | undefined)
          ?.some((material) => material.transparent)).toBe(true);
        expect(countAnatomyMaskPixels(observedDifferentialMask), "Known visible transparent lens surface must affect rendered pixels")
          .toBeGreaterThan(sameModeRepeatNoise.changedPixelCount);
        expect(projectedCandidateMask, "Known transparent lens surface must have a projected geometry candidate").not.toBeNull();
        expect(candidatePixelsChanged, "Known transparent lens surface pixel changes must intersect its projected geometry")
          .toBeGreaterThan(0);
        expect(localizedFraction, "Known transparent surface changes should localize to its projected geometry")
          .toBeGreaterThanOrEqual(0.5);
      }
      if (["all-renderables", "registered-target-subject", "conceptual-camera", "selected-part", "dimmed-parts"].includes(condition)) {
        expect(countAnatomyMaskPixels(observedDifferentialMask),
          `${backend}/${outputMode}/${reference.state}/${condition} must contribute pixels beyond same-mode frame noise`)
          .toBeGreaterThan(sameModeRepeatNoise.changedPixelCount);
      }
      if (projectedCandidateMask) {
        expect(candidatePixelsChanged,
          `${backend}/${outputMode}/${reference.state}/${condition} observed pixels must intersect the selected renderables' projected bounds`)
          .toBeGreaterThan(0);
        expect(localizedFraction,
          `${backend}/${outputMode}/${reference.state}/${condition} contribution must be spatially consistent with projected geometry`)
          .toBeGreaterThanOrEqual(0.5);
      }
      return {
        state: reference.state,
        condition,
        trial,
        selector,
        targets: exclusionResult.targets ?? [],
        excludedPng,
        excluded,
        hiddenInventory,
        restoredPng,
        restored,
        restoredInventory,
        visibleToExcluded,
        visibleToRestored,
        sameModeRepeatNoise,
        visibleBaselineDrift,
        observedDifferentialMask,
        projectedCandidateMask,
        projectedCandidateBounds,
        projectedCandidateDifference,
        changedPixelsInsideProjectedCandidate: candidatePixelsChanged,
        changedPixelsLocalizedFraction: localizedFraction,
        hiddenGroundGlassDifference,
        restorationGroundGlassDifference,
        hiddenGroundGlassAttributes,
        restoredGroundGlassAttributes,
        hiddenObserverAttributes,
        restoredObserverAttributes,
        sourceResourceIdentityPreservedByVisibilityMutations,
        sourceResourceIdentityMatchesInitialExclusion,
        rendererIdentityStable: observerIdentity(hiddenObserverAttributes) === observerIdentity(reference.observerAttributes) &&
          observerIdentity(restoredObserverAttributes) === observerIdentity(reference.observerAttributes),
        sourceMaterialPropertiesAndGeometryContentsStable: changedRenderableResourceIdentities(visibleInventory, hiddenInventory).length === 0 &&
          changedRenderableResourceIdentities(visibleInventory, restoredInventory).length === 0,
        geometryIdentityChanges: {
          referenceToVisible: changedGeometryInstanceIds(reference.inventory, visibleInventory),
          visibleToExcluded: changedGeometryInstanceIds(visibleInventory, hiddenInventory),
          excludedToRestored: changedGeometryInstanceIds(hiddenInventory, restoredInventory),
        },
        restoredVisibilityMatches,
      };
    };
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
      const result = await captureState(page, backend, outputMode, state, capturePose, testInfo);
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
      if (outputMode === "material-aware") {
        expect(result.observerAttributes["data-observer-output-policy-installed"]).toBe("material-aware");
        expect(result.observerAttributes["data-observer-output-policy-status"]).toBe("active");
        expect(result.observerAttributes["data-observer-output-policy-readiness"]).toBe("ready");
        expect(result.observerAttributes["data-observer-output-policy-unsupported-count"]).toBe("0");
      }
      captures.push(result);
      if (collectRenderableContributions) {
        const captureContribution = async (
          condition: RenderableContributionCondition,
          selector: AnatomyRenderableSelector,
          trial = 1,
        ) => {
          const capturedFrame = await captureRenderableContribution(result, condition, selector, trial);
          const prefix = `${backend}${outputMode === "material-aware" ? "-material-aware" : ""}-${state}-${condition}${trial > 1 ? `-trial-${trial}` : ""}`
            .replace(/[^a-zA-Z0-9-]/g, "-");
          const retainEvidenceImages = condition === "all-renderables" ||
            condition === "known-transparent-surface" ||
            (condition === "selected-part" && state === "aperture-small-opening" && trial === 1);
          const frame = {
            ...capturedFrame,
            evidenceArtifactPrefix: prefix,
            evidenceArtifactsRetained: retainEvidenceImages,
          };
          renderableContributionFrames.push(frame);
          const excludedName = `${prefix}-excluded.png`;
          const restoredName = `${prefix}-restored.png`;
          if (retainEvidenceImages) {
            const excludedPath = testInfo.outputPath(excludedName);
            const restoredPath = testInfo.outputPath(restoredName);
            await writeFile(excludedPath, frame.excludedPng);
            await writeFile(restoredPath, frame.restoredPng);
            await testInfo.attach(excludedName, { path: excludedPath, contentType: "image/png" });
            await testInfo.attach(restoredName, { path: restoredPath, contentType: "image/png" });
          }
        };

        if (state === "registered-target-subject") {
          await captureContribution("registered-target-subject", {
            kind: "semantic-role",
            role: "registered-target-subject",
          });
        }
        if (state === "initial") {
          await captureContribution("conceptual-camera", { kind: "conceptual-camera" });
          await captureContribution("all-renderables", { kind: "all-renderables" });
          await captureContribution("explicit-transparent", { kind: "explicit-transparent" });
          const glass = result.inventory.renderables.filter((renderable) =>
            renderable.name === "lens-front-glass" &&
            renderable.materialAssignments.some((assignment) => assignment.sourceTransparency.transparent),
          );
          await captureContribution("known-transparent-surface", {
            kind: "renderable-ids",
            renderableIds: glass.map((renderable) => renderable.objectId),
          });
        }
        if (state === "highlighted-front-standard") {
          await captureContribution("selected-part", { kind: "camera-part", cameraPart: "front-standard" });
          await captureContribution("dimmed-parts", {
            kind: "dimmed-camera-parts",
            selectedCameraParts: ["front-standard"],
          });
        }
        if (state === "highlighted-lens-and-board") {
          await captureContribution("selected-part", {
            kind: "camera-parts",
            cameraParts: ["lens", "lens-board"],
          });
          await captureContribution("dimmed-parts", {
            kind: "dimmed-camera-parts",
            selectedCameraParts: ["lens", "lens-board"],
          });
        }
        if (state === "aperture-small-opening") {
          const apertureIds = result.inventory.renderables.filter((renderable) =>
            renderable.name.startsWith("lens-aperture-") && renderable.visible,
          ).map((renderable) => renderable.objectId);
          await captureContribution("selected-part", { kind: "renderable-ids", renderableIds: apertureIds });
          await captureContribution("dimmed-parts", {
            kind: "dimmed-camera-parts",
            selectedCameraParts: ["lens"],
          });
          await captureContribution("selected-part", { kind: "renderable-ids", renderableIds: apertureIds }, 2);
        }
        if (state === "bellows-highlighted") {
          await captureContribution("selected-part", { kind: "camera-part", cameraPart: "bellows" });
          await captureContribution("dimmed-parts", {
            kind: "dimmed-camera-parts",
            selectedCameraParts: ["bellows"],
          });
        }
        if (state === "ground-glass-back") {
          await captureContribution("selected-part", { kind: "camera-part", cameraPart: "ground-glass-back" });
        }
        if (state === "film-holder") {
          await captureContribution("selected-part", { kind: "camera-part", cameraPart: "film-holder" });
        }
      }
      if (state === "initial") {
        await stabilizeFrame(page);
        const repeatedPng = await observer.locator("canvas").screenshot({ animations: "disabled" });
        const repeated = decodePlaywrightPng(repeatedPng);
        const fullRegion = { left: 0, top: 0, right: result.decoded.width, bottom: result.decoded.height };
        const consistency = comparePixelRegions(result.decoded, repeated, fullRegion, 8);
        expect(repeated.width).toBe(result.decoded.width);
        expect(repeated.height).toBe(result.decoded.height);
        expect(consistency.meanAbsoluteRgbDifference, `${backend}/${outputMode} repeated initial capture must stay within measured noise limit`)
          .toBeLessThanOrEqual(0.5);
        const repeatFilename = `${backend}${outputMode === "material-aware" ? "-material-aware" : ""}-initial-repeat-1.png`;
        const repeatPath = testInfo.outputPath(repeatFilename);
        await writeFile(repeatPath, repeatedPng);
        await testInfo.attach(repeatFilename, { body: repeatedPng, contentType: "image/png" });
        repeatCaptureConsistency.initial = {
          firstCaptureId: result.id,
          repeatedCaptureId: `${result.id}/initial-repeat-1`,
          repeatedFilename: repeatFilename,
          sameOutputMode: outputMode,
          sameSceneState: state,
          cameraPose: result.inventory.viewport.cameraPosition,
          orbitTarget: result.inventory.viewport.orbitTarget,
          viewport: [result.decoded.width, result.decoded.height],
          devicePixelRatio: result.inventory.viewport.devicePixelRatio,
          metrics: consistency,
        };
      }
      if (collectNegativeControls && state === "registered-target-subject") {
        negativeControls.registeredTargetHidden = await captureVisibilityDifferential(
          result,
          "registered-target-subject",
          "registeredTargetSubject",
        );
      }
      if (collectNegativeControls && state === "highlighted-front-standard") {
        negativeControls.frontStandardHidden = await captureVisibilityDifferential(
          result,
          "camera-anatomy-front-standard",
          "cameraPart:front-standard",
        );
      }
      return result;
    };

    const subjectCapture = await capture("registered-target-subject", subjectPose);
    const navigationToFirstVerifiedCaptureMs = performance.now() - navigationStartedAt;
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
    const frameCadenceDuringTeachingStates = await finishFrameCadenceProbe(page);

    if (outputMode === "material-aware") {
      await page.evaluate(() => window.dispatchEvent(new Event("vcs:observer-verification:read-output-policy-performance")));
    }
    const observerAttributes = await attributes(observer);
    const outputPerformanceText = await observer.getAttribute("data-observer-output-policy-performance");
    const runtime = {
      browserVersion: browser.version(),
      os: { platform: platform(), release: release(), architecture: arch() },
      threeRevision: REVISION,
      observerAttributes,
      outputMode,
      outputPerformance: outputPerformanceText ? JSON.parse(outputPerformanceText) as unknown : null,
      navigationToRendererReadyMs,
      navigationToFirstVerifiedCaptureMs,
      frameCadenceDuringTeachingStates,
      pageErrors,
      captureCount: captures.length,
      repeatCaptureConsistency,
      negativeControls,
      groundGlassContentfulForEveryCapture: captures.every((item) =>
        item.groundGlass.attributes["data-rtt-final-contentful"] === "true" &&
        item.groundGlass.pixels.distinctColorBuckets > 4),
      initialAndResetSubjectBoundsMatch:
        JSON.stringify(initial.inventory.projectedRegions.registeredTargetSubject) ===
        JSON.stringify(reset.inventory.projectedRegions.registeredTargetSubject),
    };
    expect(pageErrors, `${backend} must not produce page or console errors`).toEqual([]);
    return { context, captures, runtime, renderableContributionFrames };
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

const summarizeContributionMask = (mask: AnatomyPixelMask) => {
  const changedPixels = countAnatomyMaskPixels(mask);
  return {
    width: mask.width,
    height: mask.height,
    changedPixels,
    changedPixelFraction: changedPixels / (mask.width * mask.height),
    bounds: changedPixels > 0 ? anatomyMaskBounds(mask) : null,
  };
};

const contributionBackgroundProbeRegion = { left: 0, top: 0, right: 32, bottom: 32 };

const summarizeContributionBackgroundProbe = (run: CapturedBackendRun) => {
  const initial = captureForState(run.captures, "initial");
  const allRenderableExclusion = run.renderableContributionFrames.find((frame) =>
    frame.state === "initial" && frame.condition === "all-renderables" && frame.trial === 1);
  if (!allRenderableExclusion) throw new Error("Missing initial all-renderables exclusion for background probe");
  const regionMask = createPixelMaskForRegion(
    initial.decoded.width,
    initial.decoded.height,
    contributionBackgroundProbeRegion,
  );
  const fullToExcluded = compareAnatomyImages(initial.decoded, allRenderableExclusion.excluded, regionMask);
  expect(fullToExcluded.changedPixelCount, "Top-left background probe must remain unchanged when audited renderables are hidden")
    .toBe(0);
  return {
    region: contributionBackgroundProbeRegion,
    sampleCount: regionMask.pixels.length > 0 ? 32 * 32 : 0,
    fullFrameMeanRgb: meanRgb(initial.decoded, contributionBackgroundProbeRegion),
    allRenderableExcludedMeanRgb: meanRgb(allRenderableExclusion.excluded, contributionBackgroundProbeRegion),
    fullToExcluded,
    classification: "unaffected canvas-corner background candidate; it is independently checked by this exclusion and is not a general object-id mask",
  };
};

const summarizeGeometryIdentityChanges = (changes: readonly Readonly<Record<string, unknown>>[]) => ({
  count: changes.length,
  names: [...new Set(changes.map((entry) => String(entry.name)))],
  sample: changes.slice(0, 2),
});

const encodeContributionMaskPng = async (page: Page, mask: AnatomyPixelMask): Promise<Buffer> => {
  const dataUrl = await page.evaluate(({ width, height, pixels }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create a canvas context for contribution-mask evidence");
    const image = context.createImageData(width, height);
    for (let pixel = 0; pixel < pixels.length; pixel += 1) {
      const value = pixels[pixel] ? 255 : 0;
      const offset = pixel * 4;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }, { width: mask.width, height: mask.height, pixels: Array.from(mask.pixels) });
  const encoded = dataUrl.split(",")[1];
  if (!encoded) throw new Error("Contribution-mask canvas returned an invalid PNG data URL");
  return Buffer.from(encoded, "base64");
};

const encodeDifferenceHeatmapPng = async (
  page: Page,
  reference: DecodedPng,
  compared: DecodedPng,
): Promise<Buffer> => {
  const heatmap = deriveAnatomyDifferenceHeatmap(reference, compared);
  const dataUrl = await page.evaluate(({ width, height, pixels }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create a canvas context for differential heatmap evidence");
    const imageData = context.createImageData(width, height);
    imageData.data.set(pixels);
    context.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  }, { width: heatmap.width, height: heatmap.height, pixels: Array.from(heatmap.pixels) });
  const encoded = dataUrl.split(",")[1];
  if (!encoded) throw new Error("Differential heatmap canvas returned an invalid PNG data URL");
  return Buffer.from(encoded, "base64");
};

const summarizeRenderableContributionFrame = (frame: RenderableContributionFrame) => {
  const backgroundCandidate = frame.condition === "all-renderables"
    ? complementAnatomyMask(frame.observedDifferentialMask)
    : null;
  return {
    state: frame.state,
    condition: frame.condition,
    trial: frame.trial,
    selector: frame.selector,
    evidenceArtifacts: frame.evidenceArtifactsRetained
      ? {
          excluded: `${frame.evidenceArtifactPrefix}-excluded.png`,
          restored: `${frame.evidenceArtifactPrefix}-restored.png`,
        }
      : null,
    targets: frame.targets,
    sameModeRepeatNoise: frame.sameModeRepeatNoise,
    visibleToExcluded: frame.visibleToExcluded,
    visibleToRestored: frame.visibleToRestored,
    observedVisibleContributionMask: summarizeContributionMask(frame.observedDifferentialMask),
    projectedRectangularCandidate: frame.projectedCandidateMask
      ? {
          bounds: frame.projectedCandidateBounds,
          mask: summarizeContributionMask(frame.projectedCandidateMask),
          pixelDifferenceWithinCandidate: frame.projectedCandidateDifference,
          observedChangedPixelsInsideCandidate: frame.changedPixelsInsideProjectedCandidate,
          observedChangeLocalizedFraction: frame.changedPixelsLocalizedFraction,
        }
      : null,
    backgroundOrUnaffectedCandidateMask: backgroundCandidate
      ? summarizeContributionMask(backgroundCandidate)
      : null,
    groundGlass: {
      remainsContentfulWhenExcluded: frame.hiddenGroundGlassAttributes["data-rtt-final-contentful"] === "true",
      remainsContentfulWhenRestored: frame.restoredGroundGlassAttributes["data-rtt-final-contentful"] === "true",
      sourceFrameToExcludedDifference: frame.hiddenGroundGlassDifference,
      sourceFrameToRestoredDifference: frame.restorationGroundGlassDifference,
    },
    rendererIdentityStable: frame.rendererIdentityStable,
    sourceResourceIdentityPreservedByVisibilityMutations: frame.sourceResourceIdentityPreservedByVisibilityMutations,
    sourceResourceIdentityMatchesInitialExclusion: frame.sourceResourceIdentityMatchesInitialExclusion,
    sourceMaterialPropertiesAndGeometryContentsStable: frame.sourceMaterialPropertiesAndGeometryContentsStable,
    geometryIdentityChanges: {
      referenceToVisible: summarizeGeometryIdentityChanges(frame.geometryIdentityChanges.referenceToVisible),
      visibleToExcluded: summarizeGeometryIdentityChanges(frame.geometryIdentityChanges.visibleToExcluded),
      excludedToRestored: summarizeGeometryIdentityChanges(frame.geometryIdentityChanges.excludedToRestored),
    },
    restoredVisibilityMatchesOriginal: frame.restoredVisibilityMatches,
  };
};

const renderableContributionKey = (frame: RenderableContributionFrame): string =>
  `${frame.state}/${frame.condition}/${frame.trial}`;

const compareRenderableContributions = (
  referenceRun: CapturedBackendRun,
  comparisonRun: CapturedBackendRun,
): Readonly<{
  comparisons: readonly Readonly<Record<string, unknown>>[];
  maskEvidence: readonly Readonly<{ name: string; mask: AnatomyPixelMask }>[];
  heatmapEvidence: readonly Readonly<{ name: string; reference: DecodedPng; compared: DecodedPng }>[];
}> => {
  const comparisonFrames = new Map(comparisonRun.renderableContributionFrames.map((frame) => [renderableContributionKey(frame), frame]));
  const referenceCaptures = new Map(referenceRun.captures.map((capture) => [capture.state, capture]));
  const comparisonCaptures = new Map(comparisonRun.captures.map((capture) => [capture.state, capture]));
  const maskEvidence: { name: string; mask: AnatomyPixelMask }[] = [];
  const heatmapEvidence: { name: string; reference: DecodedPng; compared: DecodedPng }[] = [];
  const comparisons = referenceRun.renderableContributionFrames.map((referenceFrame) => {
    const key = renderableContributionKey(referenceFrame);
    const comparisonFrame = comparisonFrames.get(key);
    const referenceCapture = referenceCaptures.get(referenceFrame.state);
    const comparisonCapture = comparisonCaptures.get(referenceFrame.state);
    if (!comparisonFrame || !referenceCapture || !comparisonCapture) {
      throw new Error(`Missing matched renderable contribution evidence for ${key}`);
    }
    const fullDifference = compareAnatomyImages(referenceCapture.decoded, comparisonCapture.decoded);
    const excludedDifference = compareAnatomyImages(referenceFrame.excluded, comparisonFrame.excluded);
    const differentialResponseDifference = compareAnatomyDifferentialResponses(
      referenceCapture.decoded,
      referenceFrame.excluded,
      comparisonCapture.decoded,
      comparisonFrame.excluded,
    );
    const fullDifferenceMask = deriveAnatomyObservedDifferentialMask(referenceCapture.decoded, comparisonCapture.decoded, 8);
    const excludedDifferenceMask = deriveAnatomyObservedDifferentialMask(referenceFrame.excluded, comparisonFrame.excluded, 8);
    const foregroundOnlyCandidateMask = combineAnatomyMasks(fullDifferenceMask, excludedDifferenceMask, "difference");
    const changedInBothMask = combineAnatomyMasks(fullDifferenceMask, excludedDifferenceMask, "intersection");
    const differentialResponseMask = deriveAnatomyDifferentialResponseMask(
      referenceCapture.decoded,
      referenceFrame.excluded,
      comparisonCapture.decoded,
      comparisonFrame.excluded,
      8,
    );
    if (referenceFrame.state === "initial" && referenceFrame.condition === "all-renderables" && referenceFrame.trial === 1) {
      const pairName = `${referenceRun.runtime.outputMode}-${referenceRun.runtime.observerAttributes["data-observer-execution-backend"]}-vs-${comparisonRun.runtime.outputMode}-${comparisonRun.runtime.observerAttributes["data-observer-execution-backend"]}`
        .replace(/[^a-zA-Z0-9-]/g, "-");
      maskEvidence.push(
        { name: `${pairName}-DFull`, mask: fullDifferenceMask },
        { name: `${pairName}-DExcluded`, mask: excludedDifferenceMask },
        { name: `${pairName}-DResponse`, mask: differentialResponseMask },
      );
      heatmapEvidence.push({
        name: `${pairName}-DFull-absolute-rgb-heatmap`,
        reference: referenceCapture.decoded,
        compared: comparisonCapture.decoded,
      });
    }
    return {
      state: referenceFrame.state,
      condition: referenceFrame.condition,
      trial: referenceFrame.trial,
      reference: `${referenceRun.runtime.outputMode}/${referenceRun.runtime.observerAttributes["data-observer-execution-backend"]}`,
      comparison: `${comparisonRun.runtime.outputMode}/${comparisonRun.runtime.observerAttributes["data-observer-execution-backend"]}`,
      exclusionSelector: referenceFrame.selector,
      exclusionTargetCount: referenceFrame.targets.length,
      fullFrameCrossBackendDifference: fullDifference,
      excludedSetCrossBackendDifference: excludedDifference,
      differentialRenderableResponseDifference: differentialResponseDifference,
      masks: {
        DFull: summarizeContributionMask(fullDifferenceMask),
        DExcluded: summarizeContributionMask(excludedDifferenceMask),
        DResponse: summarizeContributionMask(differentialResponseMask),
        DFullMinusDExcludedCandidate: summarizeContributionMask(foregroundOnlyCandidateMask),
        DFullAndDExcludedOverlap: summarizeContributionMask(changedInBothMask),
        interpretation: "DExcluded is the cross-backend difference after the selected renderable set is hidden; its exclusionSelector and exclusionTargetCount identify that set. DResponse is the difference between visible-minus-hidden framebuffer responses. The foreground-only mask is a conservative pixel candidate; transparent compositing and occlusion prevent treating rectangular bounds or subtraction as exact semantic segmentation.",
      },
    };
  });
  return { comparisons, maskEvidence, heatmapEvidence };
};

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
      const firstRegionEvidence = summarizePixelRegion(first.decoded, region);
      const secondRegionEvidence = summarizePixelRegion(second.decoded, region);
      if (firstRegionEvidence.sampleCount === 0 || secondRegionEvidence.sampleCount === 0) {
        throw new Error(`Matched ROI ${state}/${name} has no framebuffer samples`);
      }
      return [{
        regionName: name,
        normalizedRegion: bounds,
        sampleCount: firstRegionEvidence.sampleCount,
        webglMeanRgb: meanRgb(first.decoded, region),
        nativeWebGpuMeanRgb: meanRgb(second.decoded, region),
        subjectRoiColorEvidence: name === "registeredTargetSubject"
          ? {
              webgl: firstRegionEvidence,
              nativeWebGpu: secondRegionEvidence,
            }
          : undefined,
        webglVsNativeWebGpu: comparePixelRegions(first.decoded, second.decoded, region, 8),
      }];
    });
    const firstGroundGlass = first.groundGlass.decoded;
    const secondGroundGlass = second.groundGlass.decoded;
    if (firstGroundGlass.width !== secondGroundGlass.width || firstGroundGlass.height !== secondGroundGlass.height) {
      throw new Error(`Ground Glass captures for ${state} have incompatible dimensions`);
    }
    const groundGlassRegion = {
      left: 0,
      top: 0,
      right: firstGroundGlass.width,
      bottom: firstGroundGlass.height,
    };
    const groundGlassSamples = summarizePixelRegion(firstGroundGlass, groundGlassRegion);
    if (groundGlassSamples.sampleCount === 0 || groundGlassSamples.distinctColorBuckets <= 4) {
      throw new Error(`Ground Glass capture for ${state} is not contentful`);
    }
    if (!first.groundGlass.resourceSnapshot || !second.groundGlass.resourceSnapshot) {
      throw new Error(`Ground Glass resource snapshots are missing for ${state}`);
    }
    const firstGroundGlassResources = JSON.parse(first.groundGlass.resourceSnapshot) as {
      rendererFamily?: string;
      executionBackend?: string;
      sourceMaterials?: Array<{ uuid: string }>;
      geometryIds?: string[];
    };
    const secondGroundGlassResources = JSON.parse(second.groundGlass.resourceSnapshot) as typeof firstGroundGlassResources;
    expect(firstGroundGlassResources.rendererFamily).toBe("webgl-renderer");
    expect(secondGroundGlassResources.rendererFamily).toBe("webgl-renderer");
    expect(firstGroundGlassResources.executionBackend).toBe("webgl2");
    expect(secondGroundGlassResources.executionBackend).toBe("webgl2");
    const groundGlassComparison = comparePixelRegions(firstGroundGlass, secondGroundGlass, groundGlassRegion, 8);
    const backgroundBounds = { left: 0.015, top: 0.015, right: 0.085, bottom: 0.085 };
    const backgroundRegion = regionInPixels(backgroundBounds, first.decoded);
    const backgroundSamples = summarizePixelRegion(first.decoded, backgroundRegion).sampleCount;
    if (backgroundSamples === 0) throw new Error(`Matched background ROI for ${state} has no framebuffer samples`);
    return {
      state,
      screenshotDimensions: { width: first.decoded.width, height: first.decoded.height },
      measurements,
      groundGlassReference: {
        left: {
          backend: firstGroundGlassResources.rendererFamily,
          executionBackend: firstGroundGlassResources.executionBackend,
          sourceMaterials: firstGroundGlassResources.sourceMaterials,
          geometryIds: firstGroundGlassResources.geometryIds,
        },
        right: {
          backend: secondGroundGlassResources.rendererFamily,
          executionBackend: secondGroundGlassResources.executionBackend,
          sourceMaterials: secondGroundGlassResources.sourceMaterials,
          geometryIds: secondGroundGlassResources.geometryIds,
        },
        sampleCount: groundGlassSamples.sampleCount,
        distinctColorBuckets: groundGlassSamples.distinctColorBuckets,
        webglVsNativeWebGpu: groundGlassComparison,
      },
      backgroundReference: {
        normalizedRegion: backgroundBounds,
        sampleCount: backgroundSamples,
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

const verifyDynamicPresentationInventory = (captures: readonly Capture[], expectGhost = false) => {
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
  const conceptualCameraObjects = (capture: Capture) => capture.inventory.categories
    .filter((category) => category.role.startsWith("conceptual-camera/"))
    .flatMap((category) => category.objectNames);
  expect(conceptualCameraObjects(groundGlassBack)).toContain("ground-glass-screen");
  expect(conceptualCameraObjects(filmHolder)).toContain("film-holder-body");
  expect(conceptualCameraObjects(filmHolder)).not.toContain("ground-glass-screen");

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
  if (expectGhost) {
    expect(initial.inventory.projectedRegions.ghostReferenceCamera).not.toBeNull();
  } else {
    expect(initial.inventory.projectedRegions.ghostReferenceCamera).toBeUndefined();
  }
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

const verifyGroundGlassBorrowedResources = (captures: readonly Capture[]) => captures.map((capture) => {
  const snapshotText = capture.groundGlass.resourceSnapshot;
  if (!snapshotText) throw new Error(`${capture.id} has no mounted Ground Glass Anatomy resource snapshot`);
  const snapshot = JSON.parse(snapshotText) as {
    rootName: string;
    meshAssignments: number;
    materialAssignments: number;
    sourceMaterials: Array<{ uuid: string; family: string }>;
    geometryIds: string[];
    rendererFamily: string;
    executionBackend: string;
  };
  const targetMaterials = capture.inventory.materials.filter((entry) => entry.role === "registered-target-subject");
  const observerSourceIds = targetMaterials.map((entry) => entry.sourceMaterialId).sort();
  const groundGlassSourceIds = snapshot.sourceMaterials.map((entry) => entry.uuid).sort();
  const observerGeometryIds = capture.inventory.geometries
    .filter((entry) => entry.role === "registered-target-subject")
    .map((entry) => entry.properties.id)
    .sort();
  expect(snapshot.rootName).toBe("view-camera-anatomy-subject");
  expect(snapshot.meshAssignments).toBe(VIEW_CAMERA_ANATOMY_PRESENTATION.geometry.boxes.length);
  expect(snapshot.materialAssignments).toBe(5);
  expect(snapshot.sourceMaterials.every((entry) => entry.family === "MeshStandardMaterial")).toBe(true);
  expect(snapshot.geometryIds).toHaveLength(1);
  expect(observerGeometryIds).toEqual(snapshot.geometryIds);
  expect(snapshot.rendererFamily).toBe("webgl-renderer");
  expect(snapshot.executionBackend).toBe("webgl2");
  expect(observerSourceIds).toEqual(groundGlassSourceIds);
  const outputIds = targetMaterials.flatMap((entry) => entry.outputMaterialIds);
  if (capture.outputMode === "material-aware") {
    expect(targetMaterials.every((entry) => entry.adapted)).toBe(true);
    expect(outputIds.some((id) => groundGlassSourceIds.includes(id))).toBe(false);
    expect(targetMaterials.every((entry) => entry.outputMaterialFamilies.some((family) => family.startsWith("MaterialAware")))).toBe(true);
  } else {
    expect(targetMaterials.every((entry) => !entry.adapted)).toBe(true);
  }
  return {
    captureId: capture.id,
    outputMode: capture.outputMode,
    observerSourceMaterialIds: observerSourceIds,
    groundGlassSourceMaterialIds: groundGlassSourceIds,
    observerOutputMaterialIds: [...new Set(outputIds)].sort(),
    observerOutputMaterialsDistinctFromGroundGlass: !outputIds.some((id) => groundGlassSourceIds.includes(id)),
    observerGeometryIds,
    groundGlassGeometryIds: snapshot.geometryIds,
    resourceSnapshot: snapshot,
  };
});

const verifyStableGroundGlassSourceIdentity = (captures: readonly Capture[]) => {
  if (captures.length === 0) throw new Error("Cannot verify Ground Glass identity without captures");
  const resourceIds = captures.map((capture) => {
    if (!capture.groundGlass.resourceSnapshot) {
      throw new Error(`${capture.id} has no mounted Ground Glass Anatomy resource snapshot`);
    }
    const snapshot = JSON.parse(capture.groundGlass.resourceSnapshot) as {
      sourceMaterials: Array<{ uuid: string }>;
      geometryIds: string[];
    };
    return {
      captureId: capture.id,
      sourceMaterialIds: snapshot.sourceMaterials.map((entry) => entry.uuid).sort(),
      geometryIds: snapshot.geometryIds.slice().sort(),
    };
  });
  const [first, ...remaining] = resourceIds;
  if (!first) throw new Error("Ground Glass identity evidence is empty");
  for (const resource of remaining) {
    expect(resource.sourceMaterialIds, `${resource.captureId} should retain its run's module-shared Anatomy source materials`)
      .toEqual(first.sourceMaterialIds);
    expect(resource.geometryIds, `${resource.captureId} should retain its run's module-shared Anatomy geometry`)
      .toEqual(first.geometryIds);
  }
  return {
    captureCount: captures.length,
    stableAcrossTeachingStates: true,
    sourceMaterialIds: first.sourceMaterialIds,
    geometryIds: first.geometryIds,
  };
};

const createCompatibilityMatrix = (captures: readonly Capture[], materialAwareCandidate = false) => {
  const groups = new Map<string, {
    role: string;
    sourceFamily: string;
    backend: BackendName;
    outputMode: OutputMode;
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
    outputFamilies: Set<string>;
    adaptedSourceIds: Set<string>;
  }>();
  captures.forEach((capture) => {
    capture.inventory.materials.forEach((entry) => {
      const key = `${capture.backend}/${capture.outputMode}/${entry.role}/${entry.properties.family}`;
      const group = groups.get(key) ?? {
        role: entry.role,
        sourceFamily: entry.properties.family,
        backend: capture.backend,
        outputMode: capture.outputMode,
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
        outputFamilies: new Set<string>(),
        adaptedSourceIds: new Set<string>(),
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
      entry.outputMaterialFamilies.forEach((family) => group.outputFamilies.add(family));
      if (entry.adapted) group.adaptedSourceIds.add(entry.sourceMaterialId);
      groups.set(key, group);
    });
  });
  return [...groups.values()].map((group) => ({
    backend: group.backend,
    outputMode: group.outputMode,
    role: group.role,
    sourceMaterialFamily: group.sourceFamily,
    distinctSourceMaterials: group.instances.size,
    maxSimultaneousMeshMaterialAssignments: Math.max(0, ...group.assignmentsByState.values()),
    observedStates: [...group.states].sort(),
    owner: group.owner,
    candidateNodeMaterialFamily: materialAwareNodeFamilyBySourceFamily[group.sourceFamily] ?? null,
    candidateFamilySupportedByExistingAdapter: group.sourceFamily in materialAwareNodeFamilyBySourceFamily,
    actualOutputMaterialFamilies: [...group.outputFamilies].sort(),
    adaptedSourceMaterialCount: group.adaptedSourceIds.size,
    integrationStatus: materialAwareCandidate && group.outputMode === "material-aware"
      ? "observed in the development-only Anatomy candidate; visual acceptance remains a separate evidence gate"
      : "source and output family evidence from the explicit control mode",
    toneMappedValues: [...group.toneMappedValues].sort(),
    transparentMaterialInstances: group.transparentInstances.size,
    depthTestValues: [...group.depthTestValues].sort(),
    depthWriteValues: [...group.depthWriteValues].sort(),
    sides: [...group.sides].sort(),
    textureSlots: [...group.textureSlots].sort(),
    adapterOwnerRequirement: group.owner === "module-shared-asset-source"
      ? "Observer-owned NodeMaterial copies; module-shared source materials and geometry remain borrowed"
      : "Observer controller owns adapted NodeMaterials; preserve component material lifecycle",
  })).sort((left, right) => `${left.backend}/${left.outputMode}/${left.role}/${left.sourceMaterialFamily}`
    .localeCompare(`${right.backend}/${right.outputMode}/${right.role}/${right.sourceMaterialFamily}`));
};

test("Anatomy visibility controls stay absent without the explicit audit query", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/view-camera-anatomy?rttDiagnostics=1");
  const observer = page.getByTestId("scene-canvas");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-scene-subject-id", "view-camera-anatomy");
  await expect(observer).not.toHaveAttribute("data-observer-test-renderable-contribution-hook");

  const respondedToDiagnosticEvent = await observer.evaluate((element, resultEventName) => new Promise<boolean>((resolve) => {
    let responded = false;
    const onResult = () => { responded = true; };
    element.addEventListener(resultEventName, onResult);
    element.dispatchEvent(new CustomEvent("vcs:observer-verification:anatomy-object-visibility", {
      detail: {
        requestId: "normal-route-must-not-handle-diagnostic",
        generation: Number(element.getAttribute("data-observer-renderer-generation")),
        operation: "noop",
      },
    }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      element.removeEventListener(resultEventName, onResult);
      resolve(responded);
    }));
  }), visibilityResultEvent);
  expect(respondedToDiagnosticEvent, "A normal Anatomy route must not install the visibility-exclusion listener").toBe(false);
});

test("View Camera Anatomy runtime material audit records matched WebGL and native WebGPU states", async ({ browser }, testInfo) => {
  test.skip(anatomyAuditMode === "material-aware", "The explicit material-aware mode emits a separate three-way evidence report.");
  test.setTimeout(300_000);
  expect(nativeRequired, "Run this evidence audit with OBSERVER_NATIVE_WEBGPU_REQUIRED=1 and headed Chrome").toBe(true);

  const webgl = await captureBackend(browser, "webgl", null, testInfo, "standard");
  const webglSharedResources = verifyDynamicPresentationInventory(webgl.captures);
  const initialWebgl = webgl.captures.find((capture) => capture.state === "initial");
  if (!initialWebgl) throw new Error("The WebGL initial capture is missing");
  const initialOrbitTarget = initialWebgl.inventory.viewport.orbitTarget;
  if (!initialOrbitTarget) throw new Error("The WebGL inventory is missing the active orbit target");
  const nativeWebGpu = await captureBackend(browser, "native-webgpu", {
      position: initialWebgl.inventory.viewport.cameraPosition,
      target: initialOrbitTarget,
  }, testInfo, "standard");
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

type CapturedBackendRun = Awaited<ReturnType<typeof captureBackend>>;

const compactRendererEvidence = (observerAttributes: Record<string, string>) => ({
  rendererGeneration: observerAttributes["data-observer-renderer-generation"] ?? null,
  rendererRequest: observerAttributes["data-observer-renderer-request"] ?? null,
  rendererAttempt: observerAttributes["data-observer-renderer-attempt"] ?? null,
  selectionReason: observerAttributes["data-observer-selection-reason"] ?? null,
  rendererFamily: observerAttributes["data-observer-renderer-family"] ?? null,
  executionBackend: observerAttributes["data-observer-execution-backend"] ?? null,
  webgpuApiPresent: observerAttributes["data-observer-webgpu-api-present"] ?? null,
  adapterAvailability: observerAttributes["data-observer-adapter-availability"] ?? null,
  initializationAttempts: observerAttributes["data-observer-webgpu-initialization-attempts"] ?? null,
  applicationFallback: observerAttributes["data-observer-application-fallback"] ?? null,
  outputPolicyRequested: observerAttributes["data-observer-output-policy-requested"] ?? null,
  outputPolicySelected: observerAttributes["data-observer-output-policy-selected"] ?? null,
  outputPolicySelectionReason: observerAttributes["data-observer-output-policy-selection-reason"] ?? null,
  outputPolicyInstalled: observerAttributes["data-observer-output-policy-installed"] ?? null,
  outputPolicyStatus: observerAttributes["data-observer-output-policy-status"] ?? null,
  outputPolicyReadiness: observerAttributes["data-observer-output-policy-readiness"] ?? null,
  outputPolicyReadinessEvidence: observerAttributes["data-observer-output-policy-readiness-evidence"]
    ? JSON.parse(observerAttributes["data-observer-output-policy-readiness-evidence"]!) as unknown
    : null,
  unsupportedMaterialCount: observerAttributes["data-observer-output-policy-unsupported-count"] ?? null,
  initializationFailureStage: observerAttributes["data-observer-renderer-failure-stage"] ?? null,
  toneMapping: observerAttributes["data-observer-tone-mapping"] ?? null,
  toneMappingActive: observerAttributes["data-observer-tone-mapping-active"] ?? null,
  toneMappingExposure: observerAttributes["data-observer-tone-mapping-exposure"] ?? null,
  outputColorSpace: observerAttributes["data-observer-output-color-space"] ?? null,
  shadowMapStatus: observerAttributes["data-observer-shadow-map-status"] ?? null,
  shadowMapType: observerAttributes["data-observer-shadow-map-type"] ?? null,
});

const compactRuntimeEvidence = (runtime: CapturedBackendRun["runtime"]) => ({
  browserVersion: runtime.browserVersion,
  operatingSystem: runtime.os,
  threeRevision: runtime.threeRevision,
  outputMode: runtime.outputMode,
  navigationToRendererReadyMs: runtime.navigationToRendererReadyMs,
  navigationToFirstVerifiedCaptureMs: runtime.navigationToFirstVerifiedCaptureMs,
  frameCadenceDuringTeachingStates: runtime.frameCadenceDuringTeachingStates,
  renderer: compactRendererEvidence(runtime.observerAttributes),
  pageErrors: runtime.pageErrors,
  captureCount: runtime.captureCount,
  repeatCaptureConsistency: runtime.repeatCaptureConsistency,
  negativeControls: runtime.negativeControls,
  groundGlassContentfulForEveryCapture: runtime.groundGlassContentfulForEveryCapture,
  initialAndResetSubjectBoundsMatch: runtime.initialAndResetSubjectBoundsMatch,
});

const summarizeRenderableInventoryRun = (run: CapturedBackendRun) => ({
  mountedRenderer: compactRendererEvidence(captureForState(run.captures, "initial").observerAttributes),
  teachingStates: run.captures.map((capture) => ({
    state: capture.state,
    captureId: capture.id,
    screenshot: capture.filename,
    sceneId: capture.inventory.sceneId,
    generation: capture.inventory.generation,
    renderer: capture.inventory.renderer,
    viewport: capture.inventory.viewport,
    background: capture.inventory.background,
    environment: capture.inventory.environment,
    lights: capture.inventory.lights,
    counts: capture.inventory.counts,
    categories: capture.inventory.categories,
    materialAssignmentCounts: capture.inventory.transparencyInventory.materialAssignmentCounts,
    mixedMaterialRenderableCount: capture.inventory.transparencyInventory.mixedMaterialRenderableCount,
    visibleExplicitTransparentRenderableCount: capture.inventory.transparencyInventory.visibleExplicitTransparentRenderableCount,
    transparentOverlapCandidates: capture.inventory.transparencyInventory.transparentOverlapCandidates,
    projectedRegions: capture.inventory.projectedRegions,
    worldBounds: capture.inventory.worldBounds,
    renderables: capture.inventory.renderables,
  })),
});

const summarizeRoiDifferences = (states: ReturnType<typeof compareBackendCaptures>) => {
  const values = states.flatMap((state) => state.measurements
    .map((measurement) => measurement.webglVsNativeWebGpu.meanAbsoluteRgbDifference));
  if (values.length === 0) throw new Error("Cannot summarize an empty Anatomy ROI comparison");
  return {
    stateCount: states.length,
    roiCount: values.length,
    meanRoiRgbMae: values.reduce((total, value) => total + value, 0) / values.length,
    minimumRoiRgbMae: Math.min(...values),
    maximumRoiRgbMae: Math.max(...values),
    perStateMeanRoiRgbMae: states.map((state) => ({
      state: state.state,
      meanRoiRgbMae: state.measurements.reduce(
        (total, measurement) => total + measurement.webglVsNativeWebGpu.meanAbsoluteRgbDifference,
        0,
      ) / state.measurements.length,
    })),
  };
};

const verifyAdaptedMaterialProperties = (captures: readonly Capture[]): void => {
  const copiedProperties = [
    "color",
    "emissive",
    "emissiveIntensity",
    "toneMapped",
    "opacity",
    "transparent",
    "blending",
    "premultipliedAlpha",
    "depthTest",
    "depthWrite",
    "side",
    "alphaTest",
    "roughness",
    "metalness",
    "textureSlots",
  ] as const;
  for (const capture of captures) {
    for (const renderable of capture.inventory.renderables) {
      const assignment = renderable as unknown as {
        name?: string;
        materialAssignments?: Array<{
          slot?: number;
          adapted?: boolean;
          source?: Record<string, unknown>;
          output?: Record<string, unknown>;
        }>;
      };
      for (const material of assignment.materialAssignments ?? []) {
        if (!material.adapted || !material.source || !material.output) continue;
        for (const property of copiedProperties) {
          expect(
            material.output[property],
            `Adapted ${property} differs for ${capture.state}/${assignment.name}/slot-${material.slot}`,
          ).toEqual(material.source[property]);
        }
      }
    }
  }
};

test("Anatomy material-aware candidate captures matched WebGL, standard WebGPU, and candidate states", async ({ browser }, testInfo) => {
  test.skip(anatomyAuditMode !== "material-aware", "Set OBSERVER_ANATOMY_AUDIT_MODE=material-aware to run the three-way candidate audit.");
  test.setTimeout(900_000);
  expect(nativeRequired, "Material-aware evidence requires OBSERVER_NATIVE_WEBGPU_REQUIRED=1 and headed Chrome").toBe(true);

  const webgl = await captureBackend(browser, "webgl", null, testInfo, "standard", false, true, true);
  const webglInitial = captureForState(webgl.captures, "initial");
  const orbitTarget = webglInitial.inventory.viewport.orbitTarget;
  if (!orbitTarget) throw new Error("The matched WebGL capture did not expose an orbit target");
  const pose = { position: webglInitial.inventory.viewport.cameraPosition, target: orbitTarget };
  const nativeStandard = await captureBackend(browser, "native-webgpu", pose, testInfo, "standard", false, true, true);
  const nativeCandidate = await captureBackend(browser, "native-webgpu", pose, testInfo, "material-aware", false, true, true);
  const inventories = {
    webgl: verifyDynamicPresentationInventory(webgl.captures),
    nativeStandard: verifyDynamicPresentationInventory(nativeStandard.captures),
    nativeMaterialAware: verifyDynamicPresentationInventory(nativeCandidate.captures),
  };
  verifyAdaptedMaterialProperties(nativeCandidate.captures);
  const groundGlassOwnership = {
    webgl: {
      borrowedResourcesByCapture: verifyGroundGlassBorrowedResources(webgl.captures),
      stableIdentity: verifyStableGroundGlassSourceIdentity(webgl.captures),
    },
    nativeStandard: {
      borrowedResourcesByCapture: verifyGroundGlassBorrowedResources(nativeStandard.captures),
      stableIdentity: verifyStableGroundGlassSourceIdentity(nativeStandard.captures),
    },
    nativeMaterialAware: {
      borrowedResourcesByCapture: verifyGroundGlassBorrowedResources(nativeCandidate.captures),
      stableIdentity: verifyStableGroundGlassSourceIdentity(nativeCandidate.captures),
    },
  };
  const standardInitial = captureForState(nativeStandard.captures, "initial");
  const candidateInitial = captureForState(nativeCandidate.captures, "initial");
  for (const capture of [standardInitial, candidateInitial]) {
    expect(capture.observerAttributes["data-observer-renderer-family"]).toBe("webgpu-renderer");
    expect(capture.observerAttributes["data-observer-execution-backend"]).toBe("webgpu");
    expect(capture.observerAttributes["data-observer-application-fallback"]).toBe("none");
    expect(capture.observerAttributes["data-observer-webgpu-initialization-attempts"]).toBe("1");
    // This bounded browser API probe can time out while the mounted renderer
    // is already using native WebGPU. Preserve that as unknown evidence; the
    // strict mounted-backend and initialization assertions above qualify this
    // capture, while rejection/unavailability still fail the audit.
    expect(capture.observerAttributes["data-observer-adapter-availability"]).toMatch(/^(available|timed-out)$/);
    expect(capture.observerAttributes["data-observer-renderer-failure-stage"]).toBeUndefined();
  }
  expect(standardInitial.observerAttributes["data-observer-output-policy-selected"]).toBe("standard");
  expect(standardInitial.observerAttributes["data-observer-output-policy-installed"]).toBe("standard");
  expect(candidateInitial.observerAttributes["data-observer-output-policy-selected"]).toBe("material-aware");
  expect(candidateInitial.observerAttributes["data-observer-output-policy-installed"]).toBe("material-aware");
  expect(candidateInitial.observerAttributes["data-observer-output-policy-scene-adapter"]).toBe("view-camera-anatomy");
  expect(candidateInitial.observerAttributes["data-observer-output-policy-readiness"]).toBe("ready");
  expect(candidateInitial.observerAttributes["data-observer-output-policy-unsupported-count"]).toBe("0");
  const outputInventory = JSON.parse(candidateInitial.observerAttributes["data-observer-material-inventory"] ?? "{}") as {
    sceneId?: string;
    totalMeshAssignments?: number;
    adaptedMaterialInstances?: number;
    unsupportedMaterialInstances?: number;
  };
  expect(outputInventory.sceneId).toBe("view-camera-anatomy");
  expect(outputInventory.totalMeshAssignments).toBeGreaterThan(0);
  expect(outputInventory.adaptedMaterialInstances).toBeGreaterThan(0);
  expect(outputInventory.unsupportedMaterialInstances).toBe(0);

  const matchedMeasurements = {
    webglVsNativeStandard: compareBackendCaptures(webgl.captures, nativeStandard.captures),
    webglVsNativeMaterialAware: compareBackendCaptures(webgl.captures, nativeCandidate.captures),
    nativeStandardVsNativeMaterialAware: compareBackendCaptures(nativeStandard.captures, nativeCandidate.captures),
  };
  const renderableContributionComparisonsByPair = {
    webglVsNativeStandard: compareRenderableContributions(webgl, nativeStandard),
    webglVsNativeMaterialAware: compareRenderableContributions(webgl, nativeCandidate),
    nativeStandardVsNativeMaterialAware: compareRenderableContributions(nativeStandard, nativeCandidate),
  };
  const renderableContributionComparisons = {
    webglVsNativeStandard: renderableContributionComparisonsByPair.webglVsNativeStandard.comparisons,
    webglVsNativeMaterialAware: renderableContributionComparisonsByPair.webglVsNativeMaterialAware.comparisons,
    nativeStandardVsNativeMaterialAware: renderableContributionComparisonsByPair.nativeStandardVsNativeMaterialAware.comparisons,
  };
  const evidenceMaskRuns = [
    { name: "webgl", run: webgl },
    { name: "native-standard", run: nativeStandard },
    { name: "native-material-aware", run: nativeCandidate },
  ];
  const withinRendererMasks = evidenceMaskRuns.flatMap(({ name, run }) => {
    const byCondition = (state: string, condition: RenderableContributionCondition) => {
      const frame = run.renderableContributionFrames.find((candidate) =>
        candidate.state === state && candidate.condition === condition && candidate.trial === 1);
      if (!frame) throw new Error(`Missing ${name} ${state}/${condition} differential mask`);
      const changedPixels = countAnatomyMaskPixels(frame.observedDifferentialMask);
      expect(changedPixels, `${name} ${state}/${condition} must produce measurable framebuffer evidence`)
        .toBeGreaterThan(32);
      return frame.observedDifferentialMask;
    };
    return [
      { name: `M1-${name}-initial-all-renderables-observed-differential`, mask: byCondition("initial", "all-renderables") },
      {
        name: `M2-${name}-initial-all-renderables-unaffected-candidate`,
        mask: complementAnatomyMask(byCondition("initial", "all-renderables")),
      },
      { name: `M3-${name}-initial-known-transparent-surface`, mask: byCondition("initial", "known-transparent-surface") },
      { name: `M3-${name}-aperture-selected-part`, mask: byCondition("aperture-small-opening", "selected-part") },
      { name: `M3-${name}-bellows-selected-part`, mask: byCondition("bellows-highlighted", "selected-part") },
      { name: `M3-${name}-registered-target-subject`, mask: byCondition("registered-target-subject", "registered-target-subject") },
    ];
  });
  const crossBackendMasks = [
    ...renderableContributionComparisonsByPair.webglVsNativeStandard.maskEvidence,
    ...renderableContributionComparisonsByPair.webglVsNativeMaterialAware.maskEvidence,
    ...renderableContributionComparisonsByPair.nativeStandardVsNativeMaterialAware.maskEvidence,
  ];
  const contributionMaskArtifacts: Readonly<Record<string, unknown>>[] = [];
  const differentialHeatmapArtifacts: Readonly<Record<string, unknown>>[] = [];
  const maskOutputPage = webgl.context.pages()[0];
  if (!maskOutputPage) throw new Error("The WebGL evidence page is unavailable for mask artifact encoding");
  for (const evidence of [...withinRendererMasks, ...crossBackendMasks]) {
    const changedPixels = countAnatomyMaskPixels(evidence.mask);
    const filename = `${evidence.name}.png`;
    const png = await encodeContributionMaskPng(maskOutputPage, evidence.mask);
    const path = testInfo.outputPath(filename);
    await writeFile(path, png);
    await testInfo.attach(filename, { path, contentType: "image/png" });
    contributionMaskArtifacts.push({
      name: evidence.name,
      filename,
      dimensions: [evidence.mask.width, evidence.mask.height],
      changedPixels,
      changedPixelFraction: changedPixels / (evidence.mask.width * evidence.mask.height),
      bounds: changedPixels > 0 ? anatomyMaskBounds(evidence.mask) : null,
      encoding: "black=unmarked; white=marked; RGB-channel threshold=8 for cross-backend response masks and contribution masks",
    });
  }
  const differentialHeatmapEvidence = [
    ...renderableContributionComparisonsByPair.webglVsNativeStandard.heatmapEvidence,
    ...renderableContributionComparisonsByPair.webglVsNativeMaterialAware.heatmapEvidence,
    ...renderableContributionComparisonsByPair.nativeStandardVsNativeMaterialAware.heatmapEvidence,
  ];
  for (const evidence of differentialHeatmapEvidence) {
    const png = await encodeDifferenceHeatmapPng(maskOutputPage, evidence.reference, evidence.compared);
    const filename = `${evidence.name}.png`;
    const path = testInfo.outputPath(filename);
    await writeFile(path, png);
    await testInfo.attach(filename, { path, contentType: "image/png" });
    differentialHeatmapArtifacts.push({
      name: filename.replace(/\.png$/, ""),
      filename,
      dimensions: [evidence.reference.width, evidence.reference.height],
      intensity: "grayscale = maximum absolute RGB-channel difference at each pixel; black = equal",
      sourceComparison: evidence.name.replace(/-DFull-absolute-rgb-heatmap$/, ""),
    });
  }
  const exclusionRepeatConsistency = Object.fromEntries(evidenceMaskRuns.map(({ name, run }) => {
    const apertureTrials = run.renderableContributionFrames.filter((frame) =>
      frame.state === "aperture-small-opening" && frame.condition === "selected-part");
    expect(apertureTrials, `${name} must independently capture both aperture exclusion trials`).toHaveLength(2);
    const first = apertureTrials[0]!;
    const second = apertureTrials[1]!;
    const excluded = compareAnatomyImages(first.excluded, second.excluded);
    const restored = compareAnatomyImages(first.restored, second.restored);
    expect(excluded.meanAbsoluteRgbDifference, `${name} repeated aperture exclusion must remain within calibrated capture noise`)
      .toBeLessThanOrEqual(0.5);
    expect(restored.meanAbsoluteRgbDifference, `${name} repeated aperture restoration must remain within calibrated capture noise`)
      .toBeLessThanOrEqual(0.5);
    expect(first.targets.map((target) => target.id)).toEqual(second.targets.map((target) => target.id));
    return [name, {
      independentCaptureIds: [renderableContributionKey(first), renderableContributionKey(second)],
      excludedFrameDifference: excluded,
      restoredFrameDifference: restored,
      sameTargetIds: true,
      maximumMeanAbsoluteRgbDifference: 0.5,
    }];
  }));
  const backgroundProbe = {
    method: "32×32 top-left canvas region matched to the initial state and sampled before/after all audited renderables are hidden",
    runs: {
      webgl: summarizeContributionBackgroundProbe(webgl),
      nativeStandard: summarizeContributionBackgroundProbe(nativeStandard),
      nativeMaterialAware: summarizeContributionBackgroundProbe(nativeCandidate),
    },
    crossBackend: {} as Record<string, unknown>,
  };
  const compareBackgroundProbe = (referenceRun: CapturedBackendRun, comparisonRun: CapturedBackendRun) => {
    const referenceFull = captureForState(referenceRun.captures, "initial");
    const comparisonFull = captureForState(comparisonRun.captures, "initial");
    const referenceExcluded = referenceRun.renderableContributionFrames.find((frame) =>
      frame.state === "initial" && frame.condition === "all-renderables" && frame.trial === 1);
    const comparisonExcluded = comparisonRun.renderableContributionFrames.find((frame) =>
      frame.state === "initial" && frame.condition === "all-renderables" && frame.trial === 1);
    if (!referenceExcluded || !comparisonExcluded) throw new Error("Missing matched background-probe exclusion captures");
    const mask = createPixelMaskForRegion(
      referenceFull.decoded.width,
      referenceFull.decoded.height,
      contributionBackgroundProbeRegion,
    );
    return {
      fullFrameDifference: compareAnatomyImages(referenceFull.decoded, comparisonFull.decoded, mask),
      excludedFrameDifference: compareAnatomyImages(referenceExcluded.excluded, comparisonExcluded.excluded, mask),
      differentialResponseDifference: compareAnatomyDifferentialResponses(
        referenceFull.decoded,
        referenceExcluded.excluded,
        comparisonFull.decoded,
        comparisonExcluded.excluded,
        mask,
      ),
    };
  };
  backgroundProbe.crossBackend = {
    webglVsNativeStandard: compareBackgroundProbe(webgl, nativeStandard),
    webglVsNativeMaterialAware: compareBackgroundProbe(webgl, nativeCandidate),
    nativeStandardVsNativeMaterialAware: compareBackgroundProbe(nativeStandard, nativeCandidate),
  };
  const renderableContributionEvidence = {
    method: "same mounted Observer framebuffer; generation-scoped visibility exclusion; exact visibility restoration",
    interpretation: "Observed pixel deltas are renderable-set contributions under the captured scene state. They do not by themselves identify a renderer root cause. Projected rectangles are localization candidates, not exact silhouettes.",
    matchedConditions: [
      "registered target subject",
      "conceptual camera",
      "all renderables hidden for a background/unaffected control",
      "explicit-transparent renderables",
      "selected and dimmed presentation parts",
      "a known transparent lens-front-glass surface",
    ],
    conditionsByRun: {
      webgl: webgl.renderableContributionFrames.map(summarizeRenderableContributionFrame),
      nativeStandard: nativeStandard.renderableContributionFrames.map(summarizeRenderableContributionFrame),
      nativeMaterialAware: nativeCandidate.renderableContributionFrames.map(summarizeRenderableContributionFrame),
    },
    crossBackendComparisons: renderableContributionComparisons,
    exclusionRepeatConsistency,
    maskMethodology: {
      threshold: "At least one RGB channel changes by more than 8/255 for a pixel to be marked.",
      measuredSameModeNoise: evidenceMaskRuns.map(({ name, run }) => ({
        run: name,
        worstMeasuredNoise: Math.max(...run.renderableContributionFrames.map((frame) => frame.sameModeRepeatNoise.meanAbsoluteRgbDifference)),
      })),
      meaningfulMinimumChangedPixels: 32,
      antialiasing: "The threshold excludes low-level edge/noise variations; marked edges still include antialiasing where a channel crosses the threshold.",
      shadowsAndOcclusion: "Masks include any framebuffer changes caused by visibility exclusion, including shadow/depth consequences; they are not exact mesh silhouettes or per-layer IDs.",
      interactionMask: "No pairwise transparent interaction mask was generated: the initial inventories contained no T5 projected-rectangle overlap candidates, and the explicit-transparent group did not justify escalation. Candidate masks remain conservative and do not prove physical overlap.",
      backgroundControl: "M2 is the complement of the within-renderer all-renderables observed-differential mask. It is an unaffected/background candidate, not proof that every pixel is background. The independently sampled 32×32 top-left canvas patch is checked before and after exclusion and cross-backend.",
      maskArtifacts: contributionMaskArtifacts,
      differentialHeatmapArtifacts,
    },
    backgroundProbe,
    transparentProjectedOverlapCandidates: {
      webgl: captureForState(webgl.captures, "initial").inventory.transparencyInventory.transparentOverlapCandidates,
      nativeStandard: captureForState(nativeStandard.captures, "initial").inventory.transparencyInventory.transparentOverlapCandidates,
      nativeMaterialAware: captureForState(nativeCandidate.captures, "initial").inventory.transparencyInventory.transparentOverlapCandidates,
      interpretation: "T5 candidates are pairs of actual renderables with overlapping projected rectangles. They are ranked candidates for later pair isolation, not proof that visible transparent pixels overlap.",
    },
    restorationAndGroundGlassContracts: {
      allTransactionsRestoreOriginalVisibility: [webgl, nativeStandard, nativeCandidate].every((run) =>
        run.renderableContributionFrames.every((frame) => frame.restoredVisibilityMatches &&
          frame.rendererIdentityStable && frame.sourceResourceIdentityPreservedByVisibilityMutations &&
          frame.sourceMaterialPropertiesAndGeometryContentsStable)),
      groundGlassContentfulDuringEveryExclusion: [webgl, nativeStandard, nativeCandidate].every((run) =>
        run.renderableContributionFrames.every((frame) =>
          frame.hiddenGroundGlassAttributes["data-rtt-final-contentful"] === "true" &&
          frame.restoredGroundGlassAttributes["data-rtt-final-contentful"] === "true")),
      outputPolicyReadinessPreserved: nativeCandidate.renderableContributionFrames.every((frame) =>
        frame.hiddenObserverAttributes["data-observer-output-policy-readiness"] === "ready" &&
        frame.restoredObserverAttributes["data-observer-output-policy-readiness"] === "ready"),
    },
  };
  const allCaptures = [...webgl.captures, ...nativeStandard.captures, ...nativeCandidate.captures];
  const report = {
    schemaVersion: 1,
    audit: "view-camera-anatomy-material-aware-integration",
    decision: "M2 — OPT-IN IMPLEMENTATION INCOMPLETE",
    decisionReason: "The candidate initialized natively, adapted all current material assignments, and captured all 13 matched states. However, object-aligned RGB MAE is large in highlighted, dimmed, aperture, and rear-back states (see the per-state summaries); only initial/reset and background samples are close. Repeat capture noise measured zero in this run, but no approved cross-backend tolerance exists. Keep the opt-in experimental pending focused transparency/material-output investigation and independent parity criteria.",
    provenance: {
      measurementCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      browserVersion: nativeCandidate.runtime.browserVersion,
      operatingSystem: nativeCandidate.runtime.os,
      threeRevision: REVISION,
      hardwareAcceleration: "unconfirmed",
      nativeQualification: compactRendererEvidence(candidateInitial.observerAttributes),
      captureConfiguration: {
        viewport: [webglInitial.inventory.viewport.width, webglInitial.inventory.viewport.height],
        devicePixelRatio: webglInitial.inventory.viewport.devicePixelRatio,
        cameraPosition: pose.position,
        orbitTarget: pose.target,
        states: evidenceStates,
      },
    },
    runtime: {
      webgl: compactRuntimeEvidence(webgl.runtime),
      nativeStandard: compactRuntimeEvidence(nativeStandard.runtime),
      nativeMaterialAware: compactRuntimeEvidence(nativeCandidate.runtime),
    },
    candidateMaterialInventory: outputInventory,
    sourceOwnership: {
      observerAdaptedOutputs: "renderer-generation-scoped MaterialAwareMaterialTracker controllerOwner",
      moduleSharedAnatomyResources: { geometryCount: 1, materialCount: 5 },
      groundGlass: "independent WebGL2 RTT; source material and geometry UUIDs match Observer source UUIDs while candidate NodeMaterial UUIDs remain separate",
      evidence: groundGlassOwnership,
    },
    dynamicTeachingStates: {
      count: evidenceStates.length,
      states: evidenceStates,
      inventoryChecks: inventories,
      criteria: "registered target, highlight/dim state, aperture, rear-back, bellows deformation, optical helper, reset, and Ground Glass checks completed",
    },
    repeatCaptureNoiseCalibration: {
      webgl: webgl.runtime.repeatCaptureConsistency,
      nativeStandard: nativeStandard.runtime.repeatCaptureConsistency,
      nativeMaterialAware: nativeCandidate.runtime.repeatCaptureConsistency,
      maximumMeanAbsoluteRgbDifference: 0.5,
      thresholdInterpretation: "Same-mode repeat stability only; not a cross-backend parity threshold.",
    },
    negativeControls: {
      registeredTargetHidden: {
        webgl: webgl.runtime.negativeControls,
        nativeStandard: nativeStandard.runtime.negativeControls,
        nativeMaterialAware: nativeCandidate.runtime.negativeControls,
      },
      frontStandardHidden: "run during the highlighted-front-standard state under each backend/output mode",
    },
    matchedMeasurements: {
      parityStatus: "descriptive; no cross-backend pass threshold claimed",
      roiMethod: "current projected object bounds; every emitted ROI requires nonzero pixel samples",
      metrics: ["RGB MAE", "changed pixels/fraction", "signed luminance", "mean RGB", "color buckets", "sample count"],
      summary: {
        webglVsNativeStandard: summarizeRoiDifferences(matchedMeasurements.webglVsNativeStandard),
        webglVsNativeMaterialAware: summarizeRoiDifferences(matchedMeasurements.webglVsNativeMaterialAware),
        nativeStandardVsNativeMaterialAware: summarizeRoiDifferences(matchedMeasurements.nativeStandardVsNativeMaterialAware),
      },
      ...matchedMeasurements,
    },
    renderableContributionInvestigation: {
      decision: "I2 — PARTIAL ROOT CAUSE",
      decisionReason: "The controlled exclusions directly measure which registered Anatomy subject, conceptual-camera, teaching-part, and transparent renderables contribute pixels in the current framebuffer state. These measurements localize contribution and allow background and differential response comparisons, but do not isolate a complete material/output/transparency mechanism in the real Anatomy scene.",
      evidence: renderableContributionEvidence,
    },
    performance: {
      standard: nativeStandard.runtime.outputPerformance,
      materialAware: nativeCandidate.runtime.outputPerformance,
      interpretation: "CPU controller callback, adaptation, inventory and cleanup counters; GPU timing is not inferred.",
    },
    compatibilityMatrix: createCompatibilityMatrix(allCaptures, true),
    captureFiles: allCaptures.map(({ id, filename, state, backend, outputMode, inventory }) => ({
      id,
      filename,
      state,
      backend,
      outputMode,
      renderer: inventory.renderer,
      camera: inventory.viewport,
      projectedRegions: inventory.projectedRegions,
      worldBounds: inventory.worldBounds,
      sourceMaterials: inventory.materials.map((entry) => ({
        role: entry.role,
        sourceMaterialId: entry.sourceMaterialId,
        outputMaterialIds: entry.outputMaterialIds,
        outputMaterialFamilies: entry.outputMaterialFamilies,
        adapted: entry.adapted,
        properties: entry.properties,
      })),
      renderables: inventory.renderables,
    })),
    architectureRiseRegression: {
      thresholdsAnd81CriteriaChanged: false,
      command: "OBSERVER_VISUAL_PARITY_REQUIRED=1 OBSERVER_NATIVE_WEBGPU_REQUIRED=1 OBSERVER_OUTPUT_POLICY=material-aware npx playwright test --config=playwright.observer-backend-benchmark.config.ts src/tests/benchmarks/observer-visual-parity.bench.ts --workers=1",
    },
    limitations: [
      "Hardware acceleration is unconfirmed.",
      "Visual parity thresholds remain provisional pending independent review of measured noise and ROI differences.",
      "Ghost-camera rendering is verified separately by the candidate E2E visibility differential and is excluded from the matched 13-state triad.",
      "Ground Glass remains the existing independent WebGL RTT.",
    ],
  };
  const reportPath = testInfo.outputPath("view-camera-anatomy-material-aware-integration.json");
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await testInfo.attach("view-camera-anatomy-material-aware-integration.json", {
    path: reportPath,
    contentType: "application/json",
  });
  const contributionReportPath = testInfo.outputPath("anatomy-renderable-contribution-investigation.json");
  await mkdir(dirname(contributionReportPath), { recursive: true });
  const contributionReport = {
    schemaVersion: 1,
    audit: "view-camera-anatomy-renderable-contribution-isolation",
    investigationDecision: "I2 — PARTIAL ROOT CAUSE",
    anatomyIntegrationDecision: "M2 — OPT-IN IMPLEMENTATION INCOMPLETE",
    experiment: {
      id: "m-inv2-real-anatomy-renderable-contribution",
      method: "Matched full/excluded/restored captures from the actual mounted Observer framebuffer; same camera pose and viewport per renderer mode.",
      interpretation: "Visibility differentials establish contribution under the tested state. They are not additive color decomposition and do not independently isolate material, alpha blending, depth/occlusion, or shadow mechanisms.",
      matchedCaptureCountPerMode: evidenceStates.length,
      renderableExclusionTransactionCountPerMode: webgl.renderableContributionFrames.length,
      captureStability: "Same-mode unchanged and repeated aperture exclusion/restoration captures measured zero RGB MAE in this run.",
      backgroundProbeRegion: contributionBackgroundProbeRegion,
    },
    provenance: {
      measurementCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      browserVersion: nativeCandidate.runtime.browserVersion,
      operatingSystem: nativeCandidate.runtime.os,
      threeRevision: REVISION,
      hardwareAcceleration: "unconfirmed",
      nativeWebGpu: compactRendererEvidence(candidateInitial.observerAttributes),
      webgl: compactRendererEvidence(captureForState(webgl.captures, "initial").observerAttributes),
      cameraPose: pose,
      viewport: [webglInitial.inventory.viewport.width, webglInitial.inventory.viewport.height],
      devicePixelRatio: webglInitial.inventory.viewport.devicePixelRatio,
    },
    transparencyClasses: {
      T0: "Material.transparent=false; may still have partial opacity and participate in depth-writing opaque rendering.",
      T1: "Material.transparent=true; explicit transparent render path.",
      T2: "Material.opacity<1; independent from T1.",
      T3: "alphaTest>0 or alphaMap present.",
      T4: "Renderable has mixed material-slot transparency semantics.",
      T5: "Projected rectangle overlap candidates among visible explicit-transparent renderables; not exact pixel overlap.",
    },
    runs: {
      webgl: compactRuntimeEvidence(webgl.runtime),
      nativeStandard: compactRuntimeEvidence(nativeStandard.runtime),
      nativeMaterialAware: compactRuntimeEvidence(nativeCandidate.runtime),
    },
    sceneInventoryByRun: {
      webgl: summarizeRenderableInventoryRun(webgl),
      nativeStandard: summarizeRenderableInventoryRun(nativeStandard),
      nativeMaterialAware: summarizeRenderableInventoryRun(nativeCandidate),
    },
    subjectAndRenderableCaptures: renderableContributionEvidence.conditionsByRun,
    crossBackendComparisons: renderableContributionComparisons,
    backgroundProbe: renderableContributionEvidence.backgroundProbe,
    exclusionRepeatConsistency: renderableContributionEvidence.exclusionRepeatConsistency,
    maskMethodology: renderableContributionEvidence.maskMethodology,
    rankedTransparentProjectedOverlapCandidates: renderableContributionEvidence.transparentProjectedOverlapCandidates,
    controls: renderableContributionEvidence.restorationAndGroundGlassContracts,
    hypothesisClassification: [
      {
        id: "explicit-transparent-renderables",
        status: "visible contribution measured; blending mechanism unresolved",
        evidence: "Two explicit-transparent renderables were excluded in the initial state; the lens-front-glass was also excluded independently.",
      },
      {
        id: "selected-and-dimmed-camera-parts",
        status: "part-group contribution associated with high-error teaching states; mechanism unresolved",
        evidence: "Cross-backend differential responses are reported for selected and dimmed groups in the highlighted front-standard, lens/board, aperture, and bellows states.",
      },
      {
        id: "standard-webgpu-canvas-background",
        status: "large background-associated discrepancy measured; renderer cause unresolved",
        evidence: "The full-scene and all-renderables-hidden comparisons plus a fixed top-left canvas sample are reported separately.",
      },
      {
        id: "transparent-overlap",
        status: "not isolated",
        evidence: "No T5 projected-rectangle overlap candidates were found in the initial state; projected rectangles do not prove visible-pixel overlap.",
      },
      {
        id: "lighting-and-shadows",
        status: "not independently varied",
        evidence: "Light and shadow state were held constant and inventoried; no light, shadow, or depth intervention was run.",
      },
      {
        id: "renderer-context-premultiplication",
        status: "untested",
        evidence: "PR #261 varied Material.premultipliedAlpha only; renderer/context and browser-compositor configuration were not varied.",
      },
      {
        id: "complete-real-scene-root-cause",
        status: "not isolated",
        evidence: "Visibility differentials include revealed background, occlusion, depth, blending, and shadow effects.",
      },
    ],
    resourceLifecycleObservation: {
      generationAndRendererStableDuringEveryVisibilityTransaction: true,
      objectAndMaterialPropertiesAndGeometryContentsUnchangedByVisibilityMutation: true,
      exactVisibilityRestoration: true,
      crossSnapshotGeometryUuidChurn: {
        affectedRenderableNames: [
          "lens-aperture-blade-0-surface",
          "lens-aperture-blade-1-surface",
          "lens-aperture-blade-2-surface",
          "lens-aperture-blade-3-surface",
          "lens-aperture-blade-4-surface",
          "lens-aperture-blade-5-surface",
        ],
        interpretation: "Six blade geometry UUIDs changed between some inventory snapshots while vertex/index content and material properties remained equal. The visibility transaction itself preserved the live object/material/geometry references; cross-snapshot UUID churn is recorded separately and is not attributed to the visibility controller.",
      },
    },
    groundGlassResourcePreservation: Object.fromEntries(
      Object.entries(groundGlassOwnership).map(([mode, evidence]) => {
        const captures = evidence.borrowedResourcesByCapture;
        const first = captures[0];
        if (!first) throw new Error(`${mode} has no Ground Glass resource evidence`);
        return [mode, {
          captureCount: captures.length,
          sourceMaterialCount: first.observerSourceMaterialIds.length,
          observerAndGroundGlassSourceMaterialIdsMatchEveryCapture: captures.every((capture) =>
            JSON.stringify(capture.observerSourceMaterialIds) === JSON.stringify(capture.groundGlassSourceMaterialIds)),
          observerAndGroundGlassGeometryIdsMatchEveryCapture: captures.every((capture) =>
            JSON.stringify(capture.observerGeometryIds) === JSON.stringify(capture.groundGlassGeometryIds)),
          observerOutputMaterialsDistinctFromGroundGlassEveryCapture: captures.every((capture) =>
            capture.observerOutputMaterialsDistinctFromGroundGlass),
          groundGlassRenderer: "webgl-renderer/webgl2",
          sourceIdentityStableAcrossTeachingStates: evidence.stableIdentity.stableAcrossTeachingStates,
        }];
      }),
    ),
    nextInvestigation: "Investigate the selected/dimmed material output response in highlighted Anatomy states and the Standard WebGPU canvas background as separate mechanisms. Keep source assignments and output pipeline fixed while making one bounded intervention at a time. Add pairwise transparent-overlap tests only if a later camera view or state yields a verified candidate.",
    limitations: [
      "Projected rectangles are candidate localization only and do not prove exact visible-silhouette overlap.",
      "Visibility exclusion measures renderable-set contribution under one state; it does not independently vary renderer/context premultiplication or browser compositing.",
      "No lighting, shadow, depth, or pairwise-overlap intervention was performed; those mechanisms remain unresolved.",
      "The complement of an observed visibility differential is an unaffected/background candidate and may contain other pixels unaffected by the selected renderable set.",
      "Hardware acceleration is unconfirmed.",
      "Ground Glass remains its independent WebGL RTT.",
      "No production renderer or material behavior changed.",
    ],
  };
  await writeFile(contributionReportPath, JSON.stringify(contributionReport, null, 2));
  await testInfo.attach("anatomy-renderable-contribution-investigation.json", {
    path: contributionReportPath,
    contentType: "application/json",
  });
  console.info("ANATOMY_MATERIAL_AWARE_EVIDENCE " + reportPath);
  await webgl.context.close();
  await nativeStandard.context.close();
  await nativeCandidate.context.close();
});

const capturesSubjectEvidence = (
  _inventory: InventorySnapshot,
  captures: readonly Capture[],
  state: string,
): CanvasEvidence | null => captures.find((capture) => capture.state === state)?.subjectPixels ?? null;
