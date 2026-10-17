import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import {
  LESSON_ZERO_STEPS,
  resolveLessonZeroCameraPresentation,
} from "../../app/anatomyLesson";
import type { ConceptualCameraAnatomyPresentation } from "../../render/ConceptualViewCamera";
import {
  ANATOMY_OUTPUT_INTERVENTION_EVENT,
  ANATOMY_OUTPUT_INTERVENTION_RESULT_EVENT,
  type AnatomyOutputInterventionMode,
} from "../../render/backend/anatomyMaterialOutputIntervention";
import {
  ANATOMY_GPU_BLEND_INTERMEDIATE_CAPTURE_EVENT,
  ANATOMY_GPU_BLEND_INTERMEDIATE_RESULT_EVENT,
  type AnatomyGpuCaptureMethod,
  type AnatomyGpuColorRepresentation,
  compareAnatomyGpuSamples,
  convertSrgbRgbaToLinear,
  type AnatomyGpuRgbaSample,
} from "../../render/backend/anatomyGpuBlendIntermediate";
import {
  anatomyMaskBounds,
  compareAnatomyImages,
  type AnatomyPixelMask,
} from "../../render/anatomyRenderableContribution";
import { decodePlaywrightPng } from "./observerBackendBenchmark";

const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const auditMode = process.env.OBSERVER_ANATOMY_AUDIT_MODE ?? "standard";
const auditRequestEvent = "vcs:observer-verification:anatomy-material-audit";
const auditResultEvent = "vcs:observer-verification:anatomy-material-audit-result";
const cameraPoseEvent = "vcs:observer-verification:anatomy-view";
const canvasSelector = '[data-testid="scene-canvas"]';
const referenceRoot = resolve(process.cwd(), "docs/architecture");
let requestCounter = 0;

type AuditRenderable = Readonly<{
  objectId: string;
  name: string;
  role: string;
  cameraPart: string | null;
  visible: boolean;
  worldMatrix: readonly number[];
  renderOrder: number;
  castShadow: boolean;
  receiveShadow: boolean;
  geometry: Readonly<Record<string, unknown>>;
  materialAssignments: readonly Readonly<{ source: Readonly<Record<string, unknown>> }>[];
}>;
type AuditSnapshot = Readonly<{
  generation: number;
  sceneId: string;
  anatomyPresentation: ConceptualCameraAnatomyPresentation | null;
  background: string | null;
  environment: Readonly<Record<string, unknown>>;
  lights: readonly Readonly<Record<string, unknown>>[];
  viewport: Readonly<{
    width: number;
    height: number;
    devicePixelRatio: number;
    canvasBackingWidth: number;
    canvasBackingHeight: number;
    cameraPosition: readonly number[];
    cameraQuaternion: readonly number[];
    orbitTarget: readonly number[] | null;
  }>;
  renderables: readonly AuditRenderable[];
}>;
type BackendName = "webgl" | "native-webgpu-standard" | "native-webgpu-material-aware";
type BackendPage = Readonly<{ context: Awaited<ReturnType<Browser["newContext"]>>; page: Page; initial: AuditSnapshot }>;
type ProbeRequest = Readonly<{
  generation: number;
  method: AnatomyGpuCaptureMethod | "calibration";
  renderableId?: string;
  sourceMaterialId?: string;
  maskPixelIndices?: readonly number[];
  samplePixelIndices?: readonly number[];
  baselineCanvas?: Readonly<{
    width: number;
    height: number;
    rgbaBase64: string;
    repeatNoiseMae: number;
  }>;
}>;
type ProbeResult = Readonly<Record<string, unknown> & { requestId: string }>;
type ProxyProbeResult = ProbeResult & Readonly<{
  status: string;
  feasibility: string;
  rendererRuntime: Readonly<{ rendererFamily: string; executionBackend: string }>;
  selectedRenderable: Readonly<Record<string, unknown> & { id: string; name: string; cameraPart: string | null; outputMaterials: readonly unknown[] }>;
  replay: Readonly<{
    outputRepresentation: AnatomyGpuColorRepresentation;
    samples: readonly Readonly<{ index: number; x: number; y: number; rgba: readonly number[] }>[];
    maskedCoverage: Readonly<{ sampleCount: number; nonzeroAlphaCount: number; meanAlpha: number | null }>;
    caveats: readonly string[];
  }>;
  integrity: Readonly<Record<string, unknown> & {
    sourcePropertiesPreserved: boolean;
    originalRenderableMaterialAndGeometryRestored: boolean;
    targetDisposeCount: number;
    temporaryMaterialDisposeCount: number;
  }>;
}>;
type DirectProbeResult = ProbeResult & Readonly<{
  status: string;
  feasibility: string;
  rendererRuntime: Readonly<{ rendererFamily: string; executionBackend: string }>;
  attachment: Readonly<Record<string, unknown>>;
  selectedRenderable: Readonly<Record<string, unknown> & { id: string; materialId: string | null; sourceMaterialId: string | null }>;
  drawObservations: readonly Readonly<{
    captureOrder?: number;
    call: string;
    state: Readonly<Record<string, unknown>>;
    response: Readonly<Record<string, number>>;
    destinationAndPostDrawSamples: readonly Readonly<{
      index: number;
      destination: readonly number[];
      postDraw: readonly number[];
      x: number;
      y: number;
    }>[];
  }>[];
  maskSelection: Readonly<Record<string, unknown>>;
}>;
type NativeBoundaryProbeResult = (ProbeResult & Readonly<{
  status: "unsupported";
  feasibility: "F0";
  reason: string;
}>) | (ProbeResult & Readonly<{
  status: "ok";
  feasibility: "F1" | "F2";
  rendererRuntime: Readonly<{ rendererFamily: string; executionBackend: string }>;
  threeRevision: string;
  selectedRenderable: Readonly<Record<string, unknown> & { id: string; name: string; geometry: Readonly<Record<string, unknown>> }>;
  attachment: Readonly<Record<string, unknown> & { width: number; height: number; format: string; sampleCount: number }>;
  drawObservations: readonly Readonly<Record<string, unknown> & {
    call: string;
    drawOrder: number;
    commandCount: number;
    sourceMaterialId: string;
    destinationAndPostDrawSamples: readonly Readonly<{
      index: number;
      x: number;
      y: number;
      destination: readonly number[];
      postDraw: readonly number[];
    }>[];
    response: Readonly<Record<string, unknown>>;
    state: Readonly<Record<string, unknown>>;
  }>[];
  finalFrame: Readonly<{
    classification: string;
    rawFramebufferSamples: readonly Readonly<{ index: number; x: number; y: number; rgba: readonly number[] }>[];
    screenshotParity: Readonly<Record<string, unknown> & {
      meanAbsoluteRgbDifference: number | null;
      maxAbsoluteRgbDifference: number;
      qualified: boolean;
    }>;
  }>;
}>);
type Image = ReturnType<typeof decodePlaywrightPng>;

const readAuditSnapshot = async (page: Page, requestId: string): Promise<AuditSnapshot> =>
  page.locator(canvasSelector).evaluate((element, payload) => new Promise<AuditSnapshot>((resolveSnapshot, reject) => {
    const timeout = window.setTimeout(() => {
      element.removeEventListener(payload.resultEvent, onResult);
      reject(new Error("Timed out waiting for the mounted Anatomy snapshot"));
    }, 15_000);
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<{ requestId: string; snapshot: AuditSnapshot }>).detail;
      if (detail?.requestId !== payload.requestId) return;
      window.clearTimeout(timeout);
      element.removeEventListener(payload.resultEvent, onResult);
      resolveSnapshot(detail.snapshot);
    };
    element.addEventListener(payload.resultEvent, onResult);
    element.dispatchEvent(new CustomEvent(payload.requestEvent, { detail: { requestId: payload.requestId } }));
  }), { requestId, requestEvent: auditRequestEvent, resultEvent: auditResultEvent });

const requestOutputMode = async (
  page: Page,
  generation: number,
  mode: AnatomyOutputInterventionMode,
  renderableIds: readonly string[] = [],
): Promise<Readonly<Record<string, unknown> & { ok: boolean; reason?: string }>> => {
  const requestId = `anatomy-gpu-output-${++requestCounter}`;
  return page.locator(canvasSelector).evaluate((element, payload) => new Promise((resolveResult, reject) => {
    const timeout = window.setTimeout(() => {
      element.removeEventListener(payload.resultEvent, onResult);
      reject(new Error("Timed out waiting for the scoped Anatomy output mode"));
    }, 10_000);
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<Readonly<Record<string, unknown>> & { requestId: string; ok: boolean; reason?: string }>).detail;
      if (detail?.requestId !== payload.requestId) return;
      window.clearTimeout(timeout);
      element.removeEventListener(payload.resultEvent, onResult);
      resolveResult(detail);
    };
    element.addEventListener(payload.resultEvent, onResult);
    element.dispatchEvent(new CustomEvent(payload.eventName, {
      detail: {
        requestId: payload.requestId,
        generation: payload.generation,
        mode: payload.mode,
        selection: payload.mode === "B0"
          ? undefined
          : { kind: "renderable-ids", renderableIds: payload.renderableIds },
      },
    }));
  }), {
    requestId,
    generation,
    mode,
    renderableIds: [...renderableIds],
    eventName: ANATOMY_OUTPUT_INTERVENTION_EVENT,
    resultEvent: ANATOMY_OUTPUT_INTERVENTION_RESULT_EVENT,
  });
};

const requestProbe = async (
  page: Page,
  request: ProbeRequest,
  requestId = `anatomy-gpu-intermediate-${++requestCounter}`,
): Promise<ProbeResult> => {
  return page.locator(canvasSelector).evaluate((element, payload) => new Promise<ProbeResult>((resolveResult, reject) => {
    const timeout = window.setTimeout(() => {
      element.removeEventListener(payload.resultEvent, onResult);
      reject(new Error(`Timed out waiting for GPU intermediate capture: ${payload.request.method}`));
    }, 90_000);
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<ProbeResult>).detail;
      if (detail?.requestId !== payload.requestId) return;
      window.clearTimeout(timeout);
      element.removeEventListener(payload.resultEvent, onResult);
      resolveResult(detail);
    };
    element.addEventListener(payload.resultEvent, onResult);
    element.dispatchEvent(new CustomEvent(payload.eventName, {
      detail: { ...payload.request, requestId: payload.requestId },
    }));
  }), {
    requestId,
    request,
    eventName: ANATOMY_GPU_BLEND_INTERMEDIATE_CAPTURE_EVENT,
    resultEvent: ANATOMY_GPU_BLEND_INTERMEDIATE_RESULT_EVENT,
  });
};

type CaptureLifecycleState = {
  pendingCount: number;
  pendingMethods: string[];
  pendingReadbackCounts: number[];
  pendingMapAsyncCount: number;
  mapAsyncCount: number;
  mapAsyncRejectionCount: number;
  results: ProbeResult[];
  settlements: Readonly<Record<string, unknown>>[];
  pendingPromise: Promise<void>;
  settledPromise: Promise<Readonly<Record<string, unknown>>>;
  release: () => Promise<void>;
  rejectPending: () => Promise<void>;
  resolvePending: () => void;
  resolveSettled: (value: Readonly<Record<string, unknown>>) => void;
};

type CaptureLifecycleWindow = Window & {
  __anatomyGpuCaptureLifecycle?: CaptureLifecycleState;
  __anatomyGpuOldProbeContainer?: HTMLElement;
};

const holdCaptureAtNativeReadback = async (
  page: Page,
  requestId: string,
  request: ProbeRequest,
): Promise<void> => {
  await page.locator(canvasSelector).evaluate((element, payload) => {
    const browserWindow = window as CaptureLifecycleWindow;
    const nativeWindow = browserWindow as unknown as {
      GPUBuffer?: { prototype?: { mapAsync?: (this: object, ...args: unknown[]) => Promise<void> } };
    };
    const gpuBufferPrototype = nativeWindow.GPUBuffer?.prototype;
    const originalMapAsync = gpuBufferPrototype?.mapAsync;
    if (!gpuBufferPrototype || typeof originalMapAsync !== "function") {
      throw new Error("Native GPUBuffer.mapAsync cannot be controlled for deterministic teardown coverage");
    }
    const deferredMaps: Array<Readonly<{
      resume: () => Promise<void>;
      reject: (reason: Error) => Promise<void>;
    }>> = [];
    let resolveGate!: () => void;
    const gate = new Promise<void>((resolvePromise) => { resolveGate = resolvePromise; });
    let resolvePending!: () => void;
    let resolveSettled!: (value: Readonly<Record<string, unknown>>) => void;
    let released = false;
    const restoreMapAsync = () => {
      if (gpuBufferPrototype.mapAsync === patchedMapAsync) gpuBufferPrototype.mapAsync = originalMapAsync;
    };
    const releaseMaps = async () => {
      if (released) return;
      released = true;
      restoreMapAsync();
      await Promise.allSettled(deferredMaps.map(({ resume }) => resume()));
      resolveGate();
    };
    const rejectMaps = async () => {
      if (released) return;
      released = true;
      restoreMapAsync();
      await Promise.all(deferredMaps.map(({ reject }) =>
        reject(new Error("test-native-readback-rejected-after-retirement")),
      ));
      resolveGate();
    };
    const state: CaptureLifecycleState = {
      pendingCount: 0,
      pendingMethods: [],
      pendingReadbackCounts: [],
      pendingMapAsyncCount: 0,
      mapAsyncCount: 0,
      mapAsyncRejectionCount: 0,
      results: [],
      settlements: [],
      pendingPromise: new Promise<void>((resolvePromise) => { resolvePending = resolvePromise; }),
      settledPromise: new Promise<Readonly<Record<string, unknown>>>((resolvePromise) => { resolveSettled = resolvePromise; }),
      release: releaseMaps,
      rejectPending: rejectMaps,
      resolvePending: () => resolvePending(),
      resolveSettled: (value) => resolveSettled(value),
    };
    const patchedMapAsync = function (this: object, ...args: unknown[]): Promise<void> {
      state.mapAsyncCount += 1;
      state.pendingMapAsyncCount += 1;
      let resolveMap!: () => void;
      let rejectMap!: (reason: Error) => void;
      const pendingMap = new Promise<void>((resolvePromise, rejectPromise) => {
        resolveMap = resolvePromise;
        rejectMap = rejectPromise;
      });
      let nativeMap: Promise<void>;
      try {
        // Start the actual native mapAsync now. The harness holds only the
        // application-visible promise, so navigation occurs while real GPU
        // readback work has already been submitted and is being mapped.
        nativeMap = Promise.resolve(originalMapAsync.apply(this, args));
      } catch (cause) {
        nativeMap = Promise.reject(cause);
      }
      const settledNativeMap = nativeMap.then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      deferredMaps.push({
        resume: async () => {
          const outcome = await settledNativeMap;
          state.pendingMapAsyncCount -= 1;
          if (outcome.ok) resolveMap();
          else {
            state.mapAsyncRejectionCount += 1;
            rejectMap(outcome.error instanceof Error ? outcome.error : new Error(String(outcome.error)));
          }
        },
        reject: async (reason) => {
          // Let the submitted native map settle before rejecting the
          // application-visible promise; capture cleanup can then destroy its
          // owned GPUBuffer without racing an outstanding map operation.
          await settledNativeMap;
          state.pendingMapAsyncCount -= 1;
          state.mapAsyncRejectionCount += 1;
          rejectMap(reason);
        },
      });
      return pendingMap;
    };
    gpuBufferPrototype.mapAsync = patchedMapAsync;
    browserWindow.__anatomyGpuCaptureLifecycle = state;
    browserWindow.__anatomyGpuOldProbeContainer = element as HTMLElement;
    element.addEventListener("vcs:observer-verification:anatomy-gpu-blend-intermediate-readback-pending", (event) => {
      const detail = (event as CustomEvent<{
        requestId: string;
        method: string;
        readbackCount?: number;
        defer: (wait: Promise<unknown>) => void;
      }>).detail;
      if (detail?.requestId !== payload.requestId) return;
      state.pendingCount += 1;
      state.pendingMethods.push(detail.method);
      state.pendingReadbackCounts.push(detail.readbackCount ?? 1);
      detail.defer(gate);
      state.resolvePending();
    });
    element.addEventListener(payload.resultEvent, (event) => {
      const detail = (event as CustomEvent<ProbeResult>).detail;
      if (detail?.requestId === payload.requestId || detail?.requestId === payload.overlapRequestId) {
        state.results.push(detail);
      }
    });
    element.addEventListener("vcs:observer-verification:anatomy-gpu-blend-intermediate-capture-settled", (event) => {
      const detail = (event as CustomEvent<Readonly<Record<string, unknown>> & { requestId: string }>).detail;
      if (detail?.requestId !== payload.requestId) return;
      state.settlements.push(detail);
      state.resolveSettled(detail);
    });
    element.dispatchEvent(new CustomEvent(payload.captureEvent, {
      detail: { ...payload.request, requestId: payload.requestId },
    }));
  }, {
    requestId,
    request,
    overlapRequestId: `${requestId}-overlap`,
    captureEvent: ANATOMY_GPU_BLEND_INTERMEDIATE_CAPTURE_EVENT,
    resultEvent: ANATOMY_GPU_BLEND_INTERMEDIATE_RESULT_EVENT,
  });
  await expect.poll(async () => page.evaluate(() =>
    (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.pendingCount ?? 0,
  ), { timeout: 30_000 }).toBe(1);
  await expect.poll(async () => page.evaluate(() =>
    (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.pendingMapAsyncCount ?? 0,
  ), { timeout: 30_000 }).toBeGreaterThan(0);
};

const openBackend = async (browser: Browser, backend: BackendName): Promise<BackendPage> => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const params = new URLSearchParams({
    lesson: "1",
    observerMaterialAudit: "1",
    rttDiagnostics: "1",
    observerOutput: backend === "native-webgpu-material-aware" ? "material-aware" : "standard",
  });
  if (backend !== "webgl") params.set("observerRenderer", "webgpu");
  await page.goto(`/simulator/free/view-camera-anatomy?${params.toString()}`);
  const canvas = page.locator(canvasSelector);
  await expect(canvas).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(canvas).toHaveAttribute("data-observer-anatomy-gpu-blend-probe", "ready");
  await expect(canvas).toHaveAttribute("data-observer-test-renderable-contribution-hook", "ready");
  if (backend === "webgl") {
    await expect(canvas).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
    await expect(canvas).toHaveAttribute("data-observer-execution-backend", "webgl2");
  } else {
    await expect(canvas).toHaveAttribute("data-observer-renderer-family", "webgpu-renderer");
    await expect(canvas).toHaveAttribute("data-observer-execution-backend", "webgpu");
    await expect(canvas).toHaveAttribute("data-observer-adapter-availability", "available");
    await expect(canvas).toHaveAttribute("data-observer-application-fallback", "none");
  }
  if (backend === "native-webgpu-material-aware") {
    await expect(canvas).toHaveAttribute("data-observer-output-policy-installed", "material-aware");
    await expect(canvas).toHaveAttribute("data-observer-output-policy-status", "active");
    await expect(canvas).toHaveAttribute("data-observer-anatomy-output-intervention-hook", "ready");
  }
  const initial = await readAuditSnapshot(page, `${backend}-initial`);
  expect(initial.sceneId).toBe("view-camera-anatomy");
  expect(initial.viewport.devicePixelRatio).toBe(1);
  return { context, page, initial };
};

test("native calibration stops after SPA retirement while its readback boundary is held pending", async ({ browser }) => {
  test.skip(!nativeRequired || auditMode !== "material-aware", "Requires the native material-aware Anatomy audit configuration.");
  test.setTimeout(240_000);
  const backend = await openBackend(browser, "native-webgpu-material-aware");
  const pageErrors: string[] = [];
  backend.page.on("pageerror", (error) => { pageErrors.push(error.message); });
  const canvas = backend.page.locator(canvasSelector);
  const generation = Number(await canvas.getAttribute("data-observer-renderer-generation"));
  const requestId = `anatomy-cancel-calibration-${++requestCounter}`;
  const overlapRequestId = `${requestId}-overlap`;

  try {
    await holdCaptureAtNativeReadback(backend.page, requestId, {
      generation,
      method: "calibration",
    });
    expect(await backend.page.evaluate(() =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.pendingMethods,
    )).toEqual(["calibration"]);

    await canvas.evaluate((element, payload) => {
      element.dispatchEvent(new CustomEvent(payload.eventName, {
        detail: { requestId: payload.requestId, generation: payload.generation, method: "calibration" },
      }));
    }, {
      eventName: ANATOMY_GPU_BLEND_INTERMEDIATE_CAPTURE_EVENT,
      requestId: overlapRequestId,
      generation,
    });
    const overlap = await backend.page.evaluate((id) =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.results.find((result) => result.requestId === id) ?? null,
    overlapRequestId);
    expect(overlap).toMatchObject({ status: "rejected", reason: "capture-already-active" });

    await backend.page.evaluate(() => {
      window.history.pushState(window.history.state, "", "/simulator/free/architecture-rise?observerRenderer=webgpu");
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    });
    await expect(backend.page).toHaveURL(/\/simulator\/free\/architecture-rise/);
    const nextCanvas = backend.page.locator(canvasSelector);
    await expect(nextCanvas).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
    await expect.poll(async () => Number(await nextCanvas.getAttribute("data-observer-renderer-generation")))
      .toBeGreaterThan(generation);
    await expect(nextCanvas).not.toHaveAttribute("data-observer-anatomy-gpu-blend-probe", "ready");

    const beforeStaleRequestCount = await backend.page.evaluate(() =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.results.length ?? 0,
    );
    await backend.page.evaluate((payload) => {
      (window as CaptureLifecycleWindow).__anatomyGpuOldProbeContainer?.dispatchEvent(new CustomEvent(payload.eventName, {
        detail: { requestId: "retired-generation-request", generation: payload.generation, method: "calibration" },
      }));
    }, { eventName: ANATOMY_GPU_BLEND_INTERMEDIATE_CAPTURE_EVENT, generation });
    expect(await backend.page.evaluate(() =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.results.length ?? 0,
    )).toBe(beforeStaleRequestCount);

    await backend.page.evaluate(() =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.release(),
    );
    const settlement = await backend.page.evaluate(() =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.settledPromise,
    );
    expect(settlement).toMatchObject({
      requestId,
      method: "calibration",
      generation,
      status: "cancelled",
      resourceCleanup: { targetDisposeCount: 2, geometryDisposeCount: 1, materialDisposeCount: 8 },
    });
    const finalState = await backend.page.evaluate(() => {
      const state = (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle;
      return { pendingCount: state?.pendingCount, results: state?.results };
    });
    expect(finalState.pendingCount).toBe(1);
    expect(finalState.results).toHaveLength(1);
    expect(finalState.results?.[0]).toMatchObject({ requestId: overlapRequestId, reason: "capture-already-active" });
    expect(pageErrors).toEqual([]);
  } finally {
    await backend.page.evaluate(() =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.release(),
    ).catch(() => undefined);
    await backend.context.close();
  }
});

test("native proxy restores authored scene state before a pending readback and suppresses the retired result", async ({ browser }) => {
  test.skip(!nativeRequired || auditMode !== "material-aware", "Requires the native material-aware Anatomy audit configuration.");
  test.setTimeout(240_000);
  const backend = await openBackend(browser, "native-webgpu-material-aware");
  const pageErrors: string[] = [];
  backend.page.on("pageerror", (error) => { pageErrors.push(error.message); });

  try {
    await advanceToFrontStandard(backend.page);
    const baseline = await readAuditSnapshot(backend.page, `proxy-cancel-before-${++requestCounter}`);
    const bellows = baseline.renderables.find((renderable) =>
      renderable.visible && renderable.name === "bellows-folded-surface" && renderable.cameraPart === "bellows",
    );
    expect(bellows).toBeTruthy();
    if (!bellows) throw new Error("The Front Standard bellows renderable was not found");
    const generation = baseline.generation;
    const sourceMaterialId = bellows.materialAssignments[0]?.source.id;
    const requestId = `anatomy-cancel-proxy-${++requestCounter}`;

    await holdCaptureAtNativeReadback(backend.page, requestId, {
      generation,
      method: "single-renderable-replay",
      renderableId: bellows.objectId,
      ...(typeof sourceMaterialId === "string" ? { sourceMaterialId } : {}),
      maskPixelIndices: [0],
      samplePixelIndices: [0],
    });

    const duringPendingReadback = await readAuditSnapshot(backend.page, `proxy-cancel-restored-${++requestCounter}`);
    expect(canonicalSceneInputs(duringPendingReadback)).toEqual(canonicalSceneInputs(baseline));
    const restoredBellows = duringPendingReadback.renderables.find((renderable) => renderable.objectId === bellows.objectId);
    expect(restoredBellows?.geometry.id).toBe(bellows.geometry.id);
    expect(restoredBellows?.materialAssignments.map(({ source }) => source.id))
      .toEqual(bellows.materialAssignments.map(({ source }) => source.id));

    await backend.page.evaluate(() => {
      window.history.pushState(window.history.state, "", "/simulator/free/architecture-rise?observerRenderer=webgpu");
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    });
    await expect(backend.page).toHaveURL(/\/simulator\/free\/architecture-rise/);
    const nextCanvas = backend.page.locator(canvasSelector);
    await expect(nextCanvas).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
    await expect.poll(async () => Number(await nextCanvas.getAttribute("data-observer-renderer-generation")))
      .toBeGreaterThan(generation);
    await expect(nextCanvas).not.toHaveAttribute("data-observer-anatomy-gpu-blend-probe", "ready");

    await backend.page.evaluate(() =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.release(),
    );
    const settlement = await backend.page.evaluate(() =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.settledPromise,
    );
    expect(settlement).toMatchObject({
      requestId,
      method: "single-renderable-replay",
      generation,
      status: "cancelled",
      resourceCleanup: {
        temporaryTargetDisposeCount: 1,
        temporaryMaterialDisposeCount: 1,
        originalRenderableMaterialAndGeometryRestored: true,
        sourcePropertiesPreserved: true,
        noBorrowedResourceDisposed: true,
      },
    });
    const finalState = await backend.page.evaluate(() => {
      const state = (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle;
      return { pendingCount: state?.pendingCount, results: state?.results };
    });
    expect(finalState.pendingCount).toBe(1);
    expect(finalState.results).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    await backend.page.evaluate(() =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.release(),
    ).catch(() => undefined);
    await backend.context.close();
  }
});

test("native draw-boundary readback rejection after SPA retirement is handled and overlap is rejected", async ({ browser }) => {
  test.skip(!nativeRequired || auditMode !== "material-aware", "Requires the native material-aware Anatomy audit configuration.");
  test.setTimeout(240_000);
  const native = await openBackend(browser, "native-webgpu-material-aware");
  const pageErrors: string[] = [];
  native.page.on("pageerror", (error) => { pageErrors.push(error.message); });

  try {
    await advanceToFrontStandard(native.page);
    const snapshot = await readAuditSnapshot(native.page, `native-draw-retire-${++requestCounter}`);
    const bellows = snapshot.renderables.find((renderable) =>
      renderable.visible && renderable.name === "bellows-folded-surface" && renderable.cameraPart === "bellows",
    );
    expect(bellows).toBeTruthy();
    if (!bellows) throw new Error("The mounted Front Standard bellows renderable was not found");
    const sourceMaterialId = bellows.materialAssignments[0]?.source.id;
    const selection = await preselectEvidencePixels();
    const baseline = await captureCanvas(native.page);
    const baselineRepeat = await captureCanvas(native.page);
    const baselineNoise = compareAnatomyImages(baseline.image, baselineRepeat.image);
    expect(baselineNoise.meanAbsoluteRgbDifference).toBeLessThanOrEqual(0.5);
    const scaleX = snapshot.viewport.canvasBackingWidth / selection.width;
    const scaleY = snapshot.viewport.canvasBackingHeight / selection.height;
    const toFramebufferIndex = (index: number): number => {
      const x = index % selection.width;
      const y = Math.floor(index / selection.width);
      const framebufferX = Math.min(snapshot.viewport.canvasBackingWidth - 1, Math.floor((x + 0.5) * scaleX));
      const framebufferY = Math.min(snapshot.viewport.canvasBackingHeight - 1, Math.floor((y + 0.5) * scaleY));
      return framebufferY * snapshot.viewport.canvasBackingWidth + framebufferX;
    };
    const fixedSamples = selection.samplePixelIndices.map(toFramebufferIndex);
    const control = selection.unaffectedCandidateMaskPixelIndices.reduce((best, index) => {
      const first = selection.samplePixelIndices[0]!;
      const distance = (candidate: number) => {
        const x = candidate % selection.width;
        const y = Math.floor(candidate / selection.width);
        const firstX = first % selection.width;
        const firstY = Math.floor(first / selection.width);
        return Math.hypot(x - firstX, y - firstY);
      };
      return distance(index) < distance(best) ? index : best;
    }, selection.unaffectedCandidateMaskPixelIndices[0]!);
    const samplePixelIndices = [...fixedSamples, toFramebufferIndex(control)];
    const generation = snapshot.generation;
    const requestId = `anatomy-native-draw-retire-${++requestCounter}`;
    const overlapRequestId = `${requestId}-overlap`;
    const request: ProbeRequest = {
      generation,
      method: "native-draw-boundary",
      renderableId: bellows.objectId,
      ...(typeof sourceMaterialId === "string" ? { sourceMaterialId } : {}),
      samplePixelIndices,
      baselineCanvas: baselineCanvasPayload(baseline.image, baselineNoise.meanAbsoluteRgbDifference),
    };

    await holdCaptureAtNativeReadback(native.page, requestId, request);
    const pending = await native.page.evaluate(() => {
      const state = (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle;
      return { methods: state?.pendingMethods, readbackCounts: state?.pendingReadbackCounts };
    });
    expect(pending.methods).toEqual(["native-draw-boundary"]);
    expect(pending.readbackCounts?.[0] ?? 0).toBeGreaterThanOrEqual(2);

    await native.page.locator(canvasSelector).evaluate((element, payload) => {
      element.dispatchEvent(new CustomEvent(payload.eventName, { detail: payload.request }));
    }, {
      eventName: ANATOMY_GPU_BLEND_INTERMEDIATE_CAPTURE_EVENT,
      request: { ...request, requestId: overlapRequestId },
    });
    await expect.poll(async () => native.page.evaluate((id) =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.results
        .find((result) => result.requestId === id)?.reason ?? null,
    overlapRequestId)).toBe("capture-already-active");

    await native.page.evaluate(() => {
      window.history.pushState(window.history.state, "", "/simulator/free/architecture-rise?observerRenderer=webgpu");
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    });
    await expect(native.page).toHaveURL(/\/simulator\/free\/architecture-rise/);
    const nextCanvas = native.page.locator(canvasSelector);
    await expect(nextCanvas).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
    await expect.poll(async () => Number(await nextCanvas.getAttribute("data-observer-renderer-generation")))
      .toBeGreaterThan(generation);
    await expect(nextCanvas).not.toHaveAttribute("data-observer-anatomy-gpu-blend-probe", "ready");

    await native.page.evaluate(() =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.rejectPending(),
    );
    const settlement = await native.page.evaluate(() =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.settledPromise,
    );
    expect(settlement).toMatchObject({
      requestId,
      method: "native-draw-boundary",
      generation,
      status: "cancelled",
      resourceCleanup: {
        noBorrowedResourceDisposed: true,
        temporaryFramebufferTextureDisposeCount: pending.readbackCounts?.[0],
        temporaryFramebufferTextureDisposalFailures: 0,
        readbackBufferCount: pending.readbackCounts?.[0],
        readbackBufferDestroyCount: pending.readbackCounts?.[0],
        readbackBufferDisposalFailures: 0,
      },
    });
    const finalState = await native.page.evaluate((id) => {
      const state = (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle;
      return {
        pendingCount: state?.pendingCount,
        pendingMapAsyncCount: state?.pendingMapAsyncCount,
        mapAsyncCount: state?.mapAsyncCount,
        mapAsyncRejectionCount: state?.mapAsyncRejectionCount,
        primaryResults: state?.results.filter((result) => result.requestId === id),
        overlapResults: state?.results.filter((result) => result.requestId === `${id}-overlap`),
      };
    }, requestId);
    expect(finalState.pendingCount).toBe(1);
    expect(finalState.pendingMapAsyncCount).toBe(0);
    expect(finalState.mapAsyncCount).toBe(pending.readbackCounts?.[0]);
    expect(finalState.mapAsyncRejectionCount).toBe(pending.readbackCounts?.[0]);
    expect(finalState.primaryResults).toEqual([]);
    expect(finalState.overlapResults).toHaveLength(1);
    expect(pageErrors).toEqual([]);
  } finally {
    await native.page.evaluate(() =>
      (window as CaptureLifecycleWindow).__anatomyGpuCaptureLifecycle?.release(),
    ).catch(() => undefined);
    await native.context.close();
  }
});

const stabilizeFrame = async (page: Page): Promise<void> => page.evaluate(() => new Promise<void>((resolveFrame) => {
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())));
}));

const advanceToFrontStandard = async (page: Page): Promise<void> => {
  const panel = page.locator(".anatomy-lesson-panel");
  const heading = panel.getByRole("heading", { level: 3 });
  const next = panel.getByRole("button", { name: "Next", exact: true });
  for (let step = 0; step < 6; step += 1) {
    if ((await heading.textContent())?.trim() === "Front Standard") return;
    await next.click();
    await expect(heading).toBeVisible();
  }
  await expect(heading).toHaveText("Front Standard");
};

const setCameraPose = async (page: Page, position: readonly number[], target: readonly number[]): Promise<void> => {
  await page.locator(canvasSelector).evaluate((element, payload) => {
    element.dispatchEvent(new CustomEvent(payload.eventName, { detail: { position: payload.position, target: payload.target } }));
  }, { eventName: cameraPoseEvent, position: [...position], target: [...target] });
  await stabilizeFrame(page);
};

const captureCanvas = async (page: Page): Promise<Readonly<{ png: Buffer; image: Image }>> => {
  await stabilizeFrame(page);
  const png = await page.locator(canvasSelector).locator("canvas").screenshot({ animations: "disabled" });
  return { png, image: decodePlaywrightPng(png) };
};

const baselineCanvasPayload = (image: Image, repeatNoiseMae: number) => {
  const rgba = Buffer.alloc(image.width * image.height * 4);
  for (let index = 0; index < image.width * image.height; index += 1) {
    const source = index * image.channels;
    const target = index * 4;
    rgba[target] = image.pixels[source] ?? 0;
    rgba[target + 1] = image.pixels[source + 1] ?? 0;
    rgba[target + 2] = image.pixels[source + 2] ?? 0;
    rgba[target + 3] = image.channels > 3 ? image.pixels[source + 3] ?? 255 : 255;
  }
  return {
    width: image.width,
    height: image.height,
    rgbaBase64: rgba.toString("base64"),
    repeatNoiseMae,
  };
};

const captureGroundGlass = async (page: Page): Promise<Image> => {
  const png = await page.getByTestId("ground-glass-rtt").locator("canvas").first().screenshot({ animations: "disabled" });
  return decodePlaywrightPng(png);
};

const distinctColorBucketCount = (image: Image): number => {
  const buckets = new Set<number>();
  for (let index = 0; index < image.width * image.height; index += 1) {
    const offset = index * image.channels;
    const red = (image.pixels[offset] ?? 0) >> 4;
    const green = (image.pixels[offset + 1] ?? 0) >> 4;
    const blue = (image.pixels[offset + 2] ?? 0) >> 4;
    buckets.add((red << 8) | (green << 4) | blue);
  }
  return buckets.size;
};

const imageMae = (first: Image, second: Image, pixelIndices?: readonly number[]): number => {
  if (first.width !== second.width || first.height !== second.height) throw new Error("Compared screenshots have different dimensions");
  const indices = pixelIndices ?? Array.from({ length: first.width * first.height }, (_, index) => index);
  if (indices.length === 0) return 0;
  let difference = 0;
  for (const index of indices) {
    const firstOffset = index * first.channels;
    const secondOffset = index * second.channels;
    for (let channel = 0; channel < 3; channel += 1) {
      difference += Math.abs((first.pixels[firstOffset + channel] ?? 0) - (second.pixels[secondOffset + channel] ?? 0));
    }
  }
  return difference / (indices.length * 3);
};

const readPng = async (relativePath: string): Promise<Image> =>
  decodePlaywrightPng(await readFile(resolve(referenceRoot, relativePath)));

const preselectEvidencePixels = async () => {
  const dimmedMaskImage = await readPng("anatomy-dimmed-output-mechanism/masks/front-standard-dimmed-response.png");
  const bellowsMaskImage = await readPng("anatomy-renderable-contribution-investigation/masks/M3-webgl-bellows-selected-part.png");
  const unaffectedMaskImage = await readPng("anatomy-dimmed-output-mechanism/masks/front-standard-unaffected-candidate.png");
  const webglReference = await readPng("anatomy-dimmed-output-mechanism/selected-captures/webgl-standard-front-standard.png");
  const materialAwareReference = await readPng("anatomy-dimmed-output-mechanism/selected-captures/material-aware-b0-front-standard.png");
  const images = [dimmedMaskImage, bellowsMaskImage, unaffectedMaskImage, webglReference, materialAwareReference];
  expect(new Set(images.map(({ width, height }) => `${width}x${height}`)).size).toBe(1);
  const width = dimmedMaskImage.width;
  const dimmedMask: number[] = [];
  const bellowsMask: number[] = [];
  const unaffectedMask: number[] = [];
  const candidates: Array<{ index: number; score: number }> = [];
  for (let index = 0; index < width * dimmedMaskImage.height; index += 1) {
    const maskOffset = index * dimmedMaskImage.channels;
    const partOffset = index * bellowsMaskImage.channels;
    const isDimmed = (dimmedMaskImage.pixels[maskOffset] ?? 0) > 127;
    const isBellowsResponse = (bellowsMaskImage.pixels[partOffset] ?? 0) > 127;
    if (isDimmed) dimmedMask.push(index);
    if (isBellowsResponse) bellowsMask.push(index);
    if ((unaffectedMaskImage.pixels[index * unaffectedMaskImage.channels] ?? 0) > 127) unaffectedMask.push(index);
    if (!isDimmed || !isBellowsResponse) continue;
    const webglOffset = index * webglReference.channels;
    const candidateOffset = index * materialAwareReference.channels;
    const score = [0, 1, 2].reduce((sum, channel) => sum + Math.abs(
      (webglReference.pixels[webglOffset + channel] ?? 0) -
      (materialAwareReference.pixels[candidateOffset + channel] ?? 0),
    ), 0) / 3;
    candidates.push({ index, score });
  }
  candidates.sort((left, right) => right.score - left.score || left.index - right.index);
  const chosen: Array<{ index: number; score: number }> = [];
  for (const candidate of candidates) {
    const x = candidate.index % width;
    const y = Math.floor(candidate.index / width);
    if (chosen.some((other) => {
      const otherX = other.index % width;
      const otherY = Math.floor(other.index / width);
      return Math.hypot(x - otherX, y - otherY) < 8;
    })) continue;
    chosen.push(candidate);
    if (chosen.length >= 8) break;
  }
  expect(dimmedMask.length).toBe(12_287);
  expect(bellowsMask.length).toBeGreaterThan(0);
  expect(chosen.length).toBeGreaterThanOrEqual(4);
  return {
    width,
    height: dimmedMaskImage.height,
    dimmedMaskPixelIndices: dimmedMask,
    unaffectedCandidateMaskPixelIndices: unaffectedMask,
    bellowsResponseMaskPixelCount: bellowsMask.length,
    candidateIntersectionPixelCount: candidates.length,
    samplePixelIndices: chosen.map(({ index }) => index),
    selectedCoordinates: chosen.map(({ index, score }) => ({ index, x: index % width, y: Math.floor(index / width), referenceB0VsWebglRgbMae: score })),
    referenceSelection: {
      dimmedMask: "anatomy-dimmed-output-mechanism/masks/front-standard-dimmed-response.png",
      bellowsResponseMask: "anatomy-renderable-contribution-investigation/masks/M3-webgl-bellows-selected-part.png",
      unaffectedCandidateMask: "anatomy-dimmed-output-mechanism/masks/front-standard-unaffected-candidate.png",
      webglImage: "anatomy-dimmed-output-mechanism/selected-captures/webgl-standard-front-standard.png",
      materialAwareB0Image: "anatomy-dimmed-output-mechanism/selected-captures/material-aware-b0-front-standard.png",
      rule: "intersection of the two previously committed masks; rank by B0-vs-WebGL RGB difference; fixed before M-INV4 captures; greedily retain points at least 8 pixels apart",
    },
  };
};

const authoredMaterialInputs = (source: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => {
  const textureSlots = source.textureSlots && typeof source.textureSlots === "object"
    ? Object.fromEntries(Object.entries(source.textureSlots as Record<string, Readonly<Record<string, unknown>>>).map(([slot, texture]) => [
        slot,
        { type: texture.type, colorSpace: texture.colorSpace },
      ]))
    : {};
  return {
    family: source.family,
    color: source.color,
    emissive: source.emissive,
    emissiveIntensity: source.emissiveIntensity,
    toneMapped: source.toneMapped,
    opacity: source.opacity,
    transparent: source.transparent,
    blending: source.blending,
    premultipliedAlpha: source.premultipliedAlpha,
    depthTest: source.depthTest,
    depthWrite: source.depthWrite,
    side: source.side,
    alphaTest: source.alphaTest,
    roughness: source.roughness,
    metalness: source.metalness,
    textureSlots,
  };
};

const canonicalSceneInputs = (snapshot: AuditSnapshot) => snapshot.renderables.map((renderable) => ({
  name: renderable.name === `${renderable.role}#${renderable.name.split("#").at(-1)}` && /#\d+$/.test(renderable.name)
    ? `${renderable.role}#<generated>`
    : renderable.name,
  role: renderable.role,
  cameraPart: renderable.cameraPart,
  visible: renderable.visible,
  worldMatrix: renderable.worldMatrix,
  renderOrder: renderable.renderOrder,
  castShadow: renderable.castShadow,
  receiveShadow: renderable.receiveShadow,
  geometry: Object.fromEntries(Object.entries(renderable.geometry).filter(([key]) => key !== "id")),
  sourceMaterials: renderable.materialAssignments.map(({ source }) => authoredMaterialInputs(source)),
})).sort((left, right) => `${left.role}/${left.cameraPart}/${left.name}`
  .localeCompare(`${right.role}/${right.cameraPart}/${right.name}`));

const proxySamples = (result: ProxyProbeResult): AnatomyGpuRgbaSample[] => result.replay.samples.map(({ rgba }) => {
  if (rgba.length !== 4 || rgba.some((value) => typeof value !== "number")) throw new Error("Proxy RGBA sample is incomplete");
  return [rgba[0] as number, rgba[1] as number, rgba[2] as number, rgba[3] as number];
});

const sampleRepeatNoise = (first: ProxyProbeResult, second: ProxyProbeResult): Readonly<{ rgb: number; alpha: number }> => {
  const firstSamples = proxySamples(first);
  const secondSamples = proxySamples(second);
  expect(first.replay.samples.map(({ index }) => index)).toEqual(second.replay.samples.map(({ index }) => index));
  const comparison = compareAnatomyGpuSamples(
    { representation: first.replay.outputRepresentation, samples: firstSamples },
    { representation: second.replay.outputRepresentation, samples: secondSamples },
  );
  expect(comparison.compatible).toBe(true);
  return {
    rgb: comparison.meanAbsoluteRgbDifference ?? Number.NaN,
    alpha: comparison.meanAbsoluteAlphaDifference ?? Number.NaN,
  };
};

const meanCompatibleProxyDifference = (
  first: ProxyProbeResult,
  second: ProxyProbeResult,
  convertFirstToLinear = false,
): Readonly<Record<string, unknown>> => {
  const firstMap = new Map(first.replay.samples.map((sample) => [sample.index, sample.rgba]));
  const secondMap = new Map(second.replay.samples.map((sample) => [sample.index, sample.rgba]));
  const indices = first.replay.samples.map(({ index }) => index);
  const comparable: AnatomyGpuRgbaSample[] = [];
  const compared: AnatomyGpuRgbaSample[] = [];
  for (const index of indices) {
    const a = firstMap.get(index);
    const b = secondMap.get(index);
    if (!a || !b || a.length !== 4 || b.length !== 4 || [...a, ...b].some((value) => typeof value !== "number")) continue;
    const firstSample: AnatomyGpuRgbaSample = [a[0] as number, a[1] as number, a[2] as number, a[3] as number];
    const secondSample: AnatomyGpuRgbaSample = [b[0] as number, b[1] as number, b[2] as number, b[3] as number];
    if (firstSample[3] <= 1e-6 || secondSample[3] <= 1e-6) continue;
    comparable.push(convertFirstToLinear ? convertSrgbRgbaToLinear(firstSample) : firstSample);
    compared.push(secondSample);
  }
  const firstRepresentation = convertFirstToLinear
    ? "tone-mapped-linear-rgba32f-straight-alpha"
    : first.replay.outputRepresentation;
  const comparison = compareAnatomyGpuSamples(
    { representation: firstRepresentation, samples: comparable },
    { representation: second.replay.outputRepresentation, samples: compared },
  );
  return {
    comparison,
    commonCoveredSampleCount: comparable.length,
    commonCoverageRule: "fixed preselected sample positions with nonzero alpha in both isolated replay outputs",
    conversion: convertFirstToLinear ? "IEC 61966-2-1 inverse sRGB transfer on RGB; straight alpha retained" : null,
  };
};

test("Anatomy GPU blend intermediates distinguish WebGL draw boundary from native replay proxy", async ({ browser }, testInfo: TestInfo) => {
  test.skip(auditMode !== "material-aware", "Set OBSERVER_ANATOMY_AUDIT_MODE=material-aware for the bounded native Anatomy capture.");
  test.setTimeout(20 * 60 * 1000);
  expect(nativeRequired, "This experiment requires a headed native WebGPU browser").toBe(true);

  const selection = await preselectEvidencePixels();
  const webgl = await openBackend(browser, "webgl");
  const standard = await openBackend(browser, "native-webgpu-standard");
  const candidate = await openBackend(browser, "native-webgpu-material-aware");
  const contexts = [webgl.context, standard.context, candidate.context];

  try {
    const cameraPose = {
      position: webgl.initial.viewport.cameraPosition,
      target: webgl.initial.viewport.orbitTarget ?? [0, 0, 0],
    };
    for (const backend of [webgl, standard, candidate]) {
      await advanceToFrontStandard(backend.page);
      await setCameraPose(backend.page, cameraPose.position, cameraPose.target);
    }
    const expectedStep = LESSON_ZERO_STEPS.find((step) => step.id === "front-standard");
    if (!expectedStep) throw new Error("The Front Standard lesson step is unavailable");
    const expectedPresentation = resolveLessonZeroCameraPresentation(expectedStep, false).anatomy;
    const snapshots = await Promise.all([
      readAuditSnapshot(webgl.page, "front-standard-webgl"),
      readAuditSnapshot(standard.page, "front-standard-webgpu-standard"),
      readAuditSnapshot(candidate.page, "front-standard-webgpu-material-aware"),
    ]);
    snapshots.forEach((snapshot) => {
      expect(snapshot.sceneId).toBe("view-camera-anatomy");
      expect(snapshot.anatomyPresentation).toEqual(expectedPresentation);
      expect(snapshot.viewport.devicePixelRatio).toBe(1);
      expect(snapshot.viewport.cameraPosition).toEqual(cameraPose.position);
      expect(snapshot.viewport.orbitTarget).toEqual(cameraPose.target);
    });
    expect(new Set(snapshots.map(({ viewport }) => `${viewport.canvasBackingWidth}x${viewport.canvasBackingHeight}`)).size).toBe(1);
    expect(new Set(snapshots.map(({ viewport }) => viewport.devicePixelRatio)).size).toBe(1);
    const referenceInputs = snapshots[0]!;
    expect(snapshots[1]!.background).toBe(referenceInputs.background);
    expect(snapshots[2]!.background).toBeNull();
    for (const snapshot of snapshots.slice(1)) {
      expect(snapshot.environment).toEqual(referenceInputs.environment);
      expect(snapshot.lights).toEqual(referenceInputs.lights);
      expect({
        width: snapshot.viewport.width,
        height: snapshot.viewport.height,
        devicePixelRatio: snapshot.viewport.devicePixelRatio,
        canvasBackingWidth: snapshot.viewport.canvasBackingWidth,
        canvasBackingHeight: snapshot.viewport.canvasBackingHeight,
        cameraPosition: snapshot.viewport.cameraPosition,
        cameraQuaternion: snapshot.viewport.cameraQuaternion,
        orbitTarget: snapshot.viewport.orbitTarget,
      }).toEqual({
        width: referenceInputs.viewport.width,
        height: referenceInputs.viewport.height,
        devicePixelRatio: referenceInputs.viewport.devicePixelRatio,
        canvasBackingWidth: referenceInputs.viewport.canvasBackingWidth,
        canvasBackingHeight: referenceInputs.viewport.canvasBackingHeight,
        cameraPosition: referenceInputs.viewport.cameraPosition,
        cameraQuaternion: referenceInputs.viewport.cameraQuaternion,
        orbitTarget: referenceInputs.viewport.orbitTarget,
      });
      expect(canonicalSceneInputs(snapshot)).toEqual(canonicalSceneInputs(referenceInputs));
    }
    const framebufferWidth = snapshots[0]!.viewport.canvasBackingWidth;
    const framebufferHeight = snapshots[0]!.viewport.canvasBackingHeight;
    const framebufferScaleX = framebufferWidth / selection.width;
    const framebufferScaleY = framebufferHeight / selection.height;
    expect(framebufferScaleX).toBeGreaterThanOrEqual(1);
    expect(framebufferScaleY).toBeGreaterThanOrEqual(1);
    const toFramebufferIndex = (screenshotPixelIndex: number): number => {
      const screenshotX = screenshotPixelIndex % selection.width;
      const screenshotY = Math.floor(screenshotPixelIndex / selection.width);
      const framebufferX = Math.min(framebufferWidth - 1, Math.floor((screenshotX + 0.5) * framebufferScaleX));
      const framebufferY = Math.min(framebufferHeight - 1, Math.floor((screenshotY + 0.5) * framebufferScaleY));
      return framebufferY * framebufferWidth + framebufferX;
    };
    const framebufferMaskPixelIndices = selection.dimmedMaskPixelIndices.map(toFramebufferIndex);
    const framebufferSamplePixelIndices = selection.samplePixelIndices.map(toFramebufferIndex);
    const webglBellows = snapshots[0]!.renderables.find((renderable) =>
      renderable.visible && renderable.cameraPart === "bellows" && renderable.name === "bellows-folded-surface",
    );
    const bellows = snapshots[2]!.renderables.find((renderable) =>
      renderable.visible && renderable.cameraPart === "bellows" && renderable.name === "bellows-folded-surface",
    );
    expect(webglBellows, "the mounted WebGL Front Standard scene must contain the dimmed bellows renderable").toBeTruthy();
    expect(bellows, "the mounted Front Standard scene must contain the dimmed bellows renderable").toBeTruthy();
    if (!webglBellows || !bellows) throw new Error("No mounted dimmed bellows renderable was found");
    const webglSourceMaterialId = webglBellows.materialAssignments[0]?.source.id;
    const sourceMaterialId = bellows.materialAssignments[0]?.source.id;
    const standardBellows = snapshots[1]!.renderables.find((renderable) =>
      renderable.visible && renderable.cameraPart === "bellows" && renderable.name === "bellows-folded-surface",
    );
    expect(standardBellows).toBeTruthy();
    if (!standardBellows) throw new Error("Native standard did not mount the bellows renderable");
    expect(authoredMaterialInputs(standardBellows.materialAssignments[0]!.source))
      .toEqual(authoredMaterialInputs(webglBellows.materialAssignments[0]!.source));
    expect(authoredMaterialInputs(bellows.materialAssignments[0]!.source))
      .toEqual(authoredMaterialInputs(webglBellows.materialAssignments[0]!.source));
    expect(typeof sourceMaterialId).toBe("string");
    expect(typeof webglSourceMaterialId).toBe("string");
    if (typeof sourceMaterialId !== "string" || typeof webglSourceMaterialId !== "string") {
      throw new Error("The bellows source material ID is unavailable");
    }

    const b0Mode = await requestOutputMode(candidate.page, candidate.initial.generation, "B0");
    expect(b0Mode.ok).toBe(true);
    const outputPolicyInstalled = await candidate.page.locator(canvasSelector).getAttribute("data-observer-output-policy-installed");
    expect(outputPolicyInstalled).toBe("material-aware");
    const groundGlassCanvas = candidate.page.getByTestId("ground-glass-rtt");
    await expect(groundGlassCanvas).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 90_000 });
    const groundGlassBaseline = await captureGroundGlass(candidate.page);
    const groundGlassRepeat = await captureGroundGlass(candidate.page);
    const groundGlassBaselineNoise = compareAnatomyImages(groundGlassBaseline, groundGlassRepeat);
    expect(groundGlassBaselineNoise.meanAbsoluteRgbDifference).toBeLessThanOrEqual(0.5);
    expect(distinctColorBucketCount(groundGlassBaseline)).toBeGreaterThan(1);
    const webglBaseline = await captureCanvas(webgl.page);
    const webglRepeat = await captureCanvas(webgl.page);
    const standardBaseline = await captureCanvas(standard.page);
    const standardRepeat = await captureCanvas(standard.page);
    const b0Baseline = await captureCanvas(candidate.page);
    const b0Repeat = await captureCanvas(candidate.page);
    const webglNoise = compareAnatomyImages(webglBaseline.image, webglRepeat.image);
    const standardNoise = compareAnatomyImages(standardBaseline.image, standardRepeat.image);
    const b0Noise = compareAnatomyImages(b0Baseline.image, b0Repeat.image);
    expect(webglNoise.meanAbsoluteRgbDifference).toBeLessThanOrEqual(0.5);
    expect(standardNoise.meanAbsoluteRgbDifference).toBeLessThanOrEqual(0.5);
    expect(b0Noise.meanAbsoluteRgbDifference).toBeLessThanOrEqual(0.5);
    const b0VsWebglFullFrameMae = imageMae(b0Baseline.image, webglBaseline.image);
    const b0VsWebglDimmedMae = imageMae(b0Baseline.image, webglBaseline.image, selection.dimmedMaskPixelIndices);
    const b0VsWebglUnaffectedMae = imageMae(b0Baseline.image, webglBaseline.image, selection.unaffectedCandidateMaskPixelIndices);
    const standardVsWebglFullFrameMae = imageMae(standardBaseline.image, webglBaseline.image);
    expect(Math.abs(b0VsWebglFullFrameMae - 6.0819345432512515)).toBeLessThanOrEqual(1);
    expect(Math.abs(b0VsWebglDimmedMae - 104.1276959387971)).toBeLessThanOrEqual(2);
    expect(Math.abs(b0VsWebglUnaffectedMae - 0.009075620199631979)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(standardVsWebglFullFrameMae - 25.221015144486415)).toBeLessThanOrEqual(2);

    const mask = {
      width: selection.width,
      height: selection.height,
      pixels: new Uint8Array(selection.width * selection.height),
    } satisfies AnatomyPixelMask;
    selection.dimmedMaskPixelIndices.forEach((index) => { mask.pixels[index] = 1; });
    expect(anatomyMaskBounds(mask)).not.toBeNull();

    const webglDraw = await requestProbe(webgl.page, {
      generation: webgl.initial.generation,
      method: "draw-boundary",
      renderableId: webglBellows.objectId,
      sourceMaterialId: webglSourceMaterialId,
      maskPixelIndices: framebufferMaskPixelIndices,
      samplePixelIndices: framebufferSamplePixelIndices,
    }) as DirectProbeResult;
    expect(webglDraw.status).toBe("ok");
    expect(webglDraw.feasibility).toBe("F1");
    expect(webglDraw.rendererRuntime).toEqual({ rendererFamily: "webgl-renderer", executionBackend: "webgl2" });
    expect(webglDraw.selectedRenderable).toMatchObject({
      id: webglBellows.objectId,
      name: "bellows-folded-surface",
      cameraPart: "bellows",
      sourceMaterialId: webglSourceMaterialId,
    });
    expect(webglDraw.drawObservations.length).toBeGreaterThan(0);
    expect(webglDraw.drawObservations[0]?.response.thresholdPixelCount ?? 0).toBeGreaterThan(0);
    const directlyChangedSamples = webglDraw.drawObservations.flatMap(({ destinationAndPostDrawSamples }) =>
      destinationAndPostDrawSamples.filter(({ destination, postDraw }) =>
        destination.some((value, channel) => value !== postDraw[channel]),
      ),
    );
    expect(directlyChangedSamples.length).toBeGreaterThan(0);

    const webglProxyRequest = {
      generation: webgl.initial.generation,
      method: "single-renderable-replay" as const,
      renderableId: webglBellows.objectId,
      sourceMaterialId: webglSourceMaterialId,
      maskPixelIndices: framebufferMaskPixelIndices,
      samplePixelIndices: framebufferSamplePixelIndices,
    };
    const webglProxy1 = await requestProbe(webgl.page, webglProxyRequest) as ProxyProbeResult;
    const webglProxy2 = await requestProbe(webgl.page, webglProxyRequest) as ProxyProbeResult;
    expect(webglProxy1.status).toBe("ok");
    expect(webglProxy1.feasibility).toBe("F2");
    expect(webglProxy1.rendererRuntime.executionBackend).toBe("webgl2");
    expect(webglProxy1.selectedRenderable).toMatchObject({
      id: webglBellows.objectId,
      name: "bellows-folded-surface",
      cameraPart: "bellows",
      outputMaterials: [{ source: { id: webglSourceMaterialId } }],
    });
    expect(webglProxy1.integrity).toMatchObject({
      sourcePropertiesPreserved: true,
      originalRenderableMaterialAndGeometryRestored: true,
      targetDisposeCount: 1,
      temporaryMaterialDisposeCount: 1,
    });

    const nativeProxyRequest = {
      generation: candidate.initial.generation,
      method: "single-renderable-replay" as const,
      renderableId: bellows.objectId,
      sourceMaterialId,
      maskPixelIndices: framebufferMaskPixelIndices,
      samplePixelIndices: framebufferSamplePixelIndices,
    };
    const nativeProxy1 = await requestProbe(candidate.page, nativeProxyRequest) as ProxyProbeResult;
    const nativeProxy2 = await requestProbe(candidate.page, nativeProxyRequest) as ProxyProbeResult;
    expect(nativeProxy1.status).toBe("ok");
    expect(nativeProxy1.feasibility).toBe("F2");
    expect(nativeProxy1.rendererRuntime).toEqual({ rendererFamily: "webgpu-renderer", executionBackend: "webgpu" });
    expect(nativeProxy1.selectedRenderable).toMatchObject({
      id: bellows.objectId,
      name: "bellows-folded-surface",
      cameraPart: "bellows",
      outputMaterials: [{ source: { id: sourceMaterialId } }],
    });
    expect(nativeProxy1.integrity).toMatchObject({
      sourcePropertiesPreserved: true,
      originalRenderableMaterialAndGeometryRestored: true,
      targetDisposeCount: 1,
      temporaryMaterialDisposeCount: 1,
    });
    expect(nativeProxy1.replay.maskedCoverage.nonzeroAlphaCount).toBeGreaterThan(0);

    const representationMatchedSourceComparison = meanCompatibleProxyDifference(webglProxy1, nativeProxy1);
    const sourceRepeatNoiseWebgl = sampleRepeatNoise(webglProxy1, webglProxy2);
    const sourceRepeatNoiseNative = sampleRepeatNoise(nativeProxy1, nativeProxy2);
    expect(sourceRepeatNoiseWebgl.rgb).toBeLessThanOrEqual(1e-6);
    expect(sourceRepeatNoiseWebgl.alpha).toBeLessThanOrEqual(1e-6);
    expect(sourceRepeatNoiseNative.rgb).toBeLessThanOrEqual(1e-6);
    expect(sourceRepeatNoiseNative.alpha).toBeLessThanOrEqual(1e-6);
    expect(representationMatchedSourceComparison.commonCoveredSampleCount).toBeGreaterThan(0);
    expect((representationMatchedSourceComparison.comparison as { compatible: boolean }).compatible).toBe(true);

    const b1 = await requestOutputMode(candidate.page, candidate.initial.generation, "B1", [bellows.objectId]);
    expect(b1.ok).toBe(true);
    const b1Proxy = await requestProbe(candidate.page, nativeProxyRequest) as ProxyProbeResult;
    expect(b1Proxy.status).toBe("ok");
    const b3 = await requestOutputMode(candidate.page, candidate.initial.generation, "B3", [bellows.objectId]);
    expect(b3.ok).toBe(true);
    const b3Proxy = await requestProbe(candidate.page, nativeProxyRequest) as ProxyProbeResult;
    expect(b3Proxy.status).toBe("ok");
    const b0ToB3TransferComparison = meanCompatibleProxyDifference(nativeProxy1, b3Proxy, true);
    const b0ToB1Comparison = meanCompatibleProxyDifference(nativeProxy1, b1Proxy);
    const b0Restored = await requestOutputMode(candidate.page, candidate.initial.generation, "B0");
    expect(b0Restored.ok).toBe(true);

    const nativeDirectAttempt = await requestProbe(candidate.page, {
      generation: candidate.initial.generation,
      method: "draw-boundary",
      renderableId: bellows.objectId,
      sourceMaterialId,
      maskPixelIndices: framebufferMaskPixelIndices,
      samplePixelIndices: framebufferSamplePixelIndices,
    });
    expect(nativeDirectAttempt).toMatchObject({ status: "rejected", feasibility: "F0" });

    const staleSelection = await requestProbe(candidate.page, {
      generation: candidate.initial.generation - 1,
      method: "single-renderable-replay",
      renderableId: bellows.objectId,
      sourceMaterialId,
    });
    expect(staleSelection).toMatchObject({ status: "rejected", reason: "stale-renderer-generation" });
    const highlighted = snapshots[2]!.renderables.find((renderable) =>
      renderable.visible && renderable.role.startsWith("conceptual-camera/") && renderable.cameraPart === "lens",
    );
    expect(highlighted).toBeTruthy();
    if (!highlighted) throw new Error("No contrasting Anatomy semantic group is mounted");
    const wrongGroup = await requestProbe(candidate.page, {
      generation: candidate.initial.generation,
      method: "single-renderable-replay",
      renderableId: highlighted.objectId,
    });
    expect(wrongGroup).toMatchObject({ status: "rejected", reason: "selection-outside-target-group" });
    const invalidId = await requestProbe(candidate.page, {
      generation: candidate.initial.generation,
      method: "single-renderable-replay",
      renderableId: "stale-object-id",
    });
    expect(invalidId).toMatchObject({ status: "rejected", reason: "stale-renderable-id" });

    const webglCalibration = await requestProbe(webgl.page, {
      generation: webgl.initial.generation,
      method: "calibration",
    });
    const nativeCalibration = await requestProbe(candidate.page, {
      generation: candidate.initial.generation,
      method: "calibration",
    });
    expect(webglCalibration.status).toBe("passed");
    expect(nativeCalibration.status).toBe("passed");
    const nativeCalibrationRecord = nativeCalibration.calibration as Record<string, unknown>;
    expect(nativeCalibrationRecord).toMatchObject({
      runtime: { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" },
      orientation: { asymmetricQuadrantControl: "passed" },
      lifecycle: { targetDisposeCount: 2, geometryDisposeCount: 1, materialDisposeCount: 8 },
    });

    const [webglRestored, nativeRestored] = await Promise.all([
      captureCanvas(webgl.page), captureCanvas(candidate.page),
    ]);
    const webglRestorationMae = imageMae(webglBaseline.image, webglRestored.image);
    const nativeRestorationMae = imageMae(b0Baseline.image, nativeRestored.image);
    expect(webglRestorationMae).toBeLessThanOrEqual(webglNoise.meanAbsoluteRgbDifference + 0.5);
    expect(nativeRestorationMae).toBeLessThanOrEqual(b0Noise.meanAbsoluteRgbDifference + 0.5);
    await expect(groundGlassCanvas).toHaveAttribute("data-rtt-final-contentful", "true");
    const groundGlassAfter = await captureGroundGlass(candidate.page);
    const groundGlassRestoration = compareAnatomyImages(groundGlassBaseline, groundGlassAfter);
    expect(groundGlassRestoration.meanAbsoluteRgbDifference)
      .toBeLessThanOrEqual(groundGlassBaselineNoise.meanAbsoluteRgbDifference + 0.5);

    const nativeProbeMarker = candidate.page.locator(canvasSelector);
    await nativeProbeMarker.evaluate((element) => {
      window.history.pushState(window.history.state, "", "/simulator/free/architecture-rise");
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
      void element;
    });
    await expect(nativeProbeMarker).not.toHaveAttribute("data-observer-anatomy-gpu-blend-probe", "ready", { timeout: 30_000 });
    let staleTeardownResponses = 0;
    await nativeProbeMarker.evaluate((element, eventName) => {
      element.addEventListener(eventName, () => { (window as Window & { __anatomyGpuTeardownResponse?: number }).__anatomyGpuTeardownResponse = 1; }, { once: true });
      element.dispatchEvent(new CustomEvent("vcs:observer-verification:anatomy-gpu-blend-intermediate-capture", {
        detail: { requestId: "after-spa-teardown", generation: 0, method: "calibration" },
      }));
    }, ANATOMY_GPU_BLEND_INTERMEDIATE_RESULT_EVENT);
    await candidate.page.waitForTimeout(50);
    staleTeardownResponses = await candidate.page.evaluate(() =>
      (window as Window & { __anatomyGpuTeardownResponse?: number }).__anatomyGpuTeardownResponse ?? 0,
    );
    expect(staleTeardownResponses).toBe(0);

    const report = {
      schemaVersion: 1,
      audit: "anatomy-gpu-blend-intermediate",
      decision: "pending",
      provenance: {
        viewport: [1440, 1000],
        devicePixelRatio: 1,
        threeRevision: "186",
        webglRuntime: "webgl-renderer/webgl2",
        nativeRuntime: nativeProxy1.rendererRuntime,
        materialAwareOutputPolicy: outputPolicyInstalled,
        hardwareAcceleration: "unconfirmed by this experiment",
      },
      sampleSelection: {
        screenshotWidth: selection.width,
        screenshotHeight: selection.height,
        dimmedResponseMaskPixelCount: selection.dimmedMaskPixelIndices.length,
        unaffectedCandidateMaskPixelCount: selection.unaffectedCandidateMaskPixelIndices.length,
        bellowsResponseMaskPixelCount: selection.bellowsResponseMaskPixelCount,
        candidateIntersectionPixelCount: selection.candidateIntersectionPixelCount,
        selectedCoordinates: selection.selectedCoordinates,
        referenceSelection: selection.referenceSelection,
        coordinateMapping: {
          framebufferWidth,
          framebufferHeight,
          scaleX: framebufferScaleX,
          scaleY: framebufferScaleY,
          rule: "each screenshot pixel maps to the center pixel of its corresponding framebuffer cell; fixed indices were selected from previous M3 captures before M-INV4 measurements",
          framebufferMaskSampleCount: framebufferMaskPixelIndices.length,
          framebufferSamplePoints: framebufferSamplePixelIndices.map((index, sampleIndex) => ({
            index,
            x: index % framebufferWidth,
            y: Math.floor(index / framebufferWidth),
            screenshotCoordinate: selection.selectedCoordinates[sampleIndex],
          })),
        },
      },
      baseline: {
        A0: { repeatNoise: webglNoise, screenshotComparedAgainstA2Mae: b0VsWebglFullFrameMae },
        A1: { repeatNoise: standardNoise, screenshotComparedAgainstA0Mae: standardVsWebglFullFrameMae },
        A2: {
          repeatNoise: b0Noise,
          screenshotComparedAgainstA0DimmedResponseMae: b0VsWebglDimmedMae,
          screenshotComparedAgainstA0UnaffectedCandidateMae: b0VsWebglUnaffectedMae,
        },
        sceneBackgroundMetadata: {
          webgl: snapshots[0]!.background,
          nativeStandard: snapshots[1]!.background,
          nativeMaterialAware: snapshots[2]!.background,
          interpretation: "The material-aware controller sets scene.background to null and installs its backgroundNode from the authored #f8fafc color; the independent rendered unaffected-candidate region is also measured.",
        },
        priorM3Reference: {
          fullFrameMae: 6.0819345432512515,
          dimmedResponseMae: 104.1276959387971,
          unaffectedCandidateMae: 0.009075620199631979,
          standardWebgpuFullFrameMae: 25.221015144486415,
        },
        tolerances: {
          sameModeRepeatRgbMaeMax: 0.5,
          priorFullFrameRgbMaeAbsoluteTolerance: 1,
          priorDimmedResponseRgbMaeAbsoluteTolerance: 2,
          priorUnaffectedRgbMaeAbsoluteTolerance: 0.1,
          priorStandardWebgpuFullFrameRgbMaeAbsoluteTolerance: 2,
        },
      },
      sourceFragmentObservations: {
        selectedRenderableInputs: {
          semanticPart: "bellows",
          name: "bellows-folded-surface",
          webgl: {
            objectId: webglBellows.objectId,
            sourceMaterialId: webglSourceMaterialId,
            sourceMaterial: authoredMaterialInputs(webglBellows.materialAssignments[0]!.source),
            worldMatrix: webglBellows.worldMatrix,
            renderOrder: webglBellows.renderOrder,
            castShadow: webglBellows.castShadow,
            receiveShadow: webglBellows.receiveShadow,
          },
          nativeStandard: {
            objectId: standardBellows.objectId,
            sourceMaterialId: standardBellows.materialAssignments[0]!.source.id,
            sourceMaterial: authoredMaterialInputs(standardBellows.materialAssignments[0]!.source),
          },
          nativeMaterialAware: {
            objectId: bellows.objectId,
            sourceMaterialId,
            sourceMaterial: authoredMaterialInputs(bellows.materialAssignments[0]!.source),
            worldMatrix: bellows.worldMatrix,
            renderOrder: bellows.renderOrder,
            castShadow: bellows.castShadow,
            receiveShadow: bellows.receiveShadow,
          },
          authoredPropertiesAndCanonicalSceneInputsMatch: true,
          identityQualification: "Object/material UUIDs are mount-local and differ between the independent renderer trees; the semantic renderable, transform, geometry fingerprint, and authored source material properties were matched. No cross-mount object identity is claimed.",
        },
        webglDirectShaderOutput: { classification: "F3", rgb: null, alpha: null, reason: "WebGL readPixels exposes attachment output, not the source fragment before fixed-function blending." },
        webglDrawBoundary: webglDraw,
        webglReplayProxy: { first: webglProxy1, repeat: webglProxy2, repeatNoise: sourceRepeatNoiseWebgl },
        nativeMaterialAwareReplayProxy: { first: nativeProxy1, repeat: nativeProxy2, repeatNoise: sourceRepeatNoiseNative },
        compatibleB0SourceComparison: representationMatchedSourceComparison,
        selectiveOutputInterventions: {
          B1: { intervention: b1, proxy: b1Proxy, comparisonWithB0: b0ToB1Comparison },
          B3: { intervention: b3, proxy: b3Proxy, comparisonWithB0AfterSrgbDecode: b0ToB3TransferComparison },
        },
      },
      destinationObservations: {
        webgl: {
          classification: "F1",
          boundary: "immediately before/after the actual selected WebGL draw call in the default canvas drawing buffer",
          drawObservations: webglDraw.drawObservations,
          nativeWebgpu: null,
          nativeReason: "r186 encodes the WebGPU render pass before submit and exposes no readback boundary between actual draws.",
        },
      },
      blendObservations: {
        webgl: webglDraw.drawObservations.map(({ state, response }) => ({ state, response })),
        nativeWebgpu: null,
        predictedCrossBackendComposite: null,
        reason: "The F2 source replay changes draw isolation and does not preserve the original shadow/occlusion context; its source sample is not a valid substitute for the exact fragment consumed by the F1 draw. No numeric blend decomposition is claimed.",
      },
      colorRepresentation: {
        webglDrawBoundary: "RGBA8 bytes from default WebGL canvas framebuffer; pre-browser composition; material and canvas premultiplication recorded in draw result.",
        webglProxy: webglProxy1.replay.outputRepresentation,
        nativeMaterialAwareProxy: nativeProxy1.replay.outputRepresentation,
        alpha: "straight shader alpha read from the RGBA32F replay attachment; native baseline screenshots have RGB only.",
        webgpuReadback: "RGBA32F rows unpacked from Three r186 256-byte padded copyTextureToBuffer output; orientation checked by asymmetric quadrant fixture.",
      },
      pairwiseExperiments: {
        status: "not-run",
        reason: "The prior Bellows + Ground Glass Back response-mask intersection is not fragment overlap. The validated native method is a one-renderable replay, while WebGPU has no direct draw-boundary readback; no matched two-renderable native replay was implemented.",
        pairwiseOverlapClaimed: false,
      },
      negativeControls: {
        NC1: { active: true, webglBaselineRestorationMae: webglRestorationMae, nativeBaselineRestorationMae: nativeRestorationMae },
        NC2toNC5: { webgl: (webglCalibration as Record<string, unknown>).calibration, nativeWebgpu: nativeCalibrationRecord },
        NC6: { staleGeneration: staleSelection, wrongSemanticGroup: wrongGroup, staleRenderableId: invalidId, nativeF1Unsupported: nativeDirectAttempt },
        NC7: { originalMaterialAndGeometryRestored: nativeProxy1.integrity.originalRenderableMaterialAndGeometryRestored, sourcePropertiesPreserved: nativeProxy1.integrity.sourcePropertiesPreserved },
        NC8: { calibrationResourceCounts: nativeCalibrationRecord.lifecycle, spaListenerResponseCountAfterTeardown: staleTeardownResponses },
      },
      resourceLifecycle: {
        proxy: { webgl: webglProxy1.integrity, nativeWebgpu: nativeProxy1.integrity },
        calibration: nativeCalibrationRecord.lifecycle,
        rendererGenerationScoped: true,
      },
      regressions: {
        groundGlass: {
          dataRttFinalContentful: true,
          distinctColorBuckets: distinctColorBucketCount(groundGlassBaseline),
          repeatNoiseMae: groundGlassBaselineNoise.meanAbsoluteRgbDifference,
          postExperimentRestorationMae: groundGlassRestoration.meanAbsoluteRgbDifference,
          sourceResourceOwnership: "The probe creates no RTT resources and does not access or dispose source geometry, material, or texture; F2 uses owned target and material clones only.",
        },
        architectureRise: "pending required strict parity run",
        productionBundleIsolation: "pending production build and asset scan",
      },
      remainingUnknowns: [
        "Native WebGPU source fragments and destination attachments cannot be observed at the actual draw boundary through r186 public APIs.",
        "The F2 isolated replay is not an unchanged production fragment when other renderables, depth ordering, or shadow casters are hidden.",
        "Canvas browser composition after the GPU drawing buffer is not isolated by the F1 draw-boundary readback.",
      ],
    };
    const evidencePath = testInfo.outputPath("anatomy-gpu-blend-intermediate-evidence.json");
    await mkdir(dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, JSON.stringify(report, null, 2));
    const representativeCaptures = [
      ["captures/front-standard-webgl-a0.png", webglBaseline.png],
      ["captures/front-standard-native-standard-a1.png", standardBaseline.png],
      ["captures/front-standard-native-material-aware-a2.png", b0Baseline.png],
    ] as const;
    for (const [relativePath, png] of representativeCaptures) {
      const capturePath = testInfo.outputPath(relativePath);
      await mkdir(dirname(capturePath), { recursive: true });
      await writeFile(capturePath, png);
    }
    await testInfo.attach("anatomy-gpu-blend-intermediate-evidence.json", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
    await testInfo.attach("front-standard-webgl-a0.png", { body: webglBaseline.png, contentType: "image/png" });
    await testInfo.attach("front-standard-native-standard-a1.png", { body: standardBaseline.png, contentType: "image/png" });
    await testInfo.attach("front-standard-native-material-aware-a2.png", { body: b0Baseline.png, contentType: "image/png" });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("M-INV5 qualifies real Anatomy native WebGPU draw-boundary samples", async ({ browser }, testInfo: TestInfo) => {
  test.skip(!nativeRequired || auditMode !== "material-aware", "Requires the native material-aware Anatomy audit configuration.");
  test.setTimeout(20 * 60 * 1000);
  expect(nativeRequired, "This experiment requires a native WebGPU browser").toBe(true);

  const selection = await preselectEvidencePixels();
  const webgl = await openBackend(browser, "webgl");
  const native = await openBackend(browser, "native-webgpu-material-aware");
  const contexts = [webgl.context, native.context];
  const writeReport = async (report: Readonly<Record<string, unknown>>) => {
    const reportPath = testInfo.outputPath("anatomy-native-webgpu-draw-boundary-report.json");
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    await testInfo.attach("anatomy-native-webgpu-draw-boundary-report.json", {
      path: reportPath,
      contentType: "application/json",
    });
  };

  try {
    const cameraPose = {
      position: webgl.initial.viewport.cameraPosition,
      target: webgl.initial.viewport.orbitTarget ?? [0, 0, 0],
    };
    await Promise.all([webgl, native].map(async (backend) => {
      await advanceToFrontStandard(backend.page);
      await setCameraPose(backend.page, cameraPose.position, cameraPose.target);
    }));
    const [webglSnapshot, nativeSnapshot] = await Promise.all([
      readAuditSnapshot(webgl.page, `m-inv5-webgl-${++requestCounter}`),
      readAuditSnapshot(native.page, `m-inv5-native-${++requestCounter}`),
    ]);
    expect(webglSnapshot.sceneId).toBe("view-camera-anatomy");
    expect(nativeSnapshot.sceneId).toBe("view-camera-anatomy");
    expect(webglSnapshot.anatomyPresentation).toEqual(nativeSnapshot.anatomyPresentation);
    expect(webglSnapshot.viewport.cameraPosition).toEqual(nativeSnapshot.viewport.cameraPosition);
    expect(webglSnapshot.viewport.cameraQuaternion).toEqual(nativeSnapshot.viewport.cameraQuaternion);
    expect(webglSnapshot.viewport.canvasBackingWidth).toBe(nativeSnapshot.viewport.canvasBackingWidth);
    expect(webglSnapshot.viewport.canvasBackingHeight).toBe(nativeSnapshot.viewport.canvasBackingHeight);

    const webglBellows = webglSnapshot.renderables.find((renderable) =>
      renderable.visible && renderable.name === "bellows-folded-surface" && renderable.cameraPart === "bellows",
    );
    const nativeBellows = nativeSnapshot.renderables.find((renderable) =>
      renderable.visible && renderable.name === "bellows-folded-surface" && renderable.cameraPart === "bellows",
    );
    expect(webglBellows).toBeTruthy();
    expect(nativeBellows).toBeTruthy();
    if (!webglBellows || !nativeBellows) throw new Error("The matched Front Standard Bellows renderable was not mounted");

    const scaleX = nativeSnapshot.viewport.canvasBackingWidth / selection.width;
    const scaleY = nativeSnapshot.viewport.canvasBackingHeight / selection.height;
    const toFramebufferIndex = (index: number): number => {
      const x = index % selection.width;
      const y = Math.floor(index / selection.width);
      const framebufferX = Math.min(nativeSnapshot.viewport.canvasBackingWidth - 1, Math.floor((x + 0.5) * scaleX));
      const framebufferY = Math.min(nativeSnapshot.viewport.canvasBackingHeight - 1, Math.floor((y + 0.5) * scaleY));
      return framebufferY * nativeSnapshot.viewport.canvasBackingWidth + framebufferX;
    };
    const fixedSamples = selection.samplePixelIndices.map(toFramebufferIndex);
    const control = selection.unaffectedCandidateMaskPixelIndices.reduce((best, index) => {
      const first = selection.samplePixelIndices[0]!;
      const distance = (candidate: number) => {
        const x = candidate % selection.width;
        const y = Math.floor(candidate / selection.width);
        return Math.hypot(x - first % selection.width, y - Math.floor(first / selection.width));
      };
      return distance(index) < distance(best) ? index : best;
    }, selection.unaffectedCandidateMaskPixelIndices[0]!);
    const samplePixelIndices = [...fixedSamples, toFramebufferIndex(control)];

    const b0 = await requestOutputMode(native.page, nativeSnapshot.generation, "B0");
    expect(b0.ok).toBe(true);
    const [baseline, baselineRepeat] = await Promise.all([
      captureCanvas(native.page), captureCanvas(native.page),
    ]);
    const baselineNoise = compareAnatomyImages(baseline.image, baselineRepeat.image);
    expect(baselineNoise.meanAbsoluteRgbDifference).toBeLessThanOrEqual(0.5);
    const groundGlass = native.page.getByTestId("ground-glass-rtt");
    await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");
    const [groundGlassBaseline, groundGlassBaselineRepeat] = await Promise.all([
      captureGroundGlass(native.page), captureGroundGlass(native.page),
    ]);
    const groundGlassNoise = compareAnatomyImages(groundGlassBaseline, groundGlassBaselineRepeat);
    expect(groundGlassNoise.meanAbsoluteRgbDifference).toBeLessThanOrEqual(0.5);
    const baselineCanvas = baselineCanvasPayload(baseline.image, baselineNoise.meanAbsoluteRgbDifference);
    const sourceMaterialId = nativeBellows.materialAssignments[0]?.source.id;
    const nativeRequest: ProbeRequest = {
      generation: nativeSnapshot.generation,
      method: "native-draw-boundary",
      renderableId: nativeBellows.objectId,
      ...(typeof sourceMaterialId === "string" ? { sourceMaterialId } : {}),
      samplePixelIndices,
      baselineCanvas,
    };
    const nativeRequestId = `anatomy-m-inv5-native-${++requestCounter}`;
    const nativeSettlementPromise = native.page.locator(canvasSelector).evaluate((element, payload) =>
      new Promise<Readonly<Record<string, unknown>>>((resolveSettlement) => {
        const onSettled = (event: Event) => {
          const detail = (event as CustomEvent<Readonly<Record<string, unknown>> & { requestId: string }>).detail;
          if (detail?.requestId !== payload.requestId) return;
          element.removeEventListener(payload.eventName, onSettled);
          resolveSettlement(detail);
        };
        element.addEventListener(payload.eventName, onSettled);
      }),
    { requestId: nativeRequestId, eventName: "vcs:observer-verification:anatomy-gpu-blend-intermediate-capture-settled" });
    const [nativeBoundaryResult, nativeCaptureSettlement] = await Promise.all([
      requestProbe(native.page, nativeRequest, nativeRequestId),
      nativeSettlementPromise,
    ]);
    const nativeBoundary = nativeBoundaryResult as NativeBoundaryProbeResult;
    if (nativeBoundary.status === "unsupported") {
      const webglBellowsSourceMaterialId = webglBellows.materialAssignments[0]?.source.id;
      const webglDirect = await requestProbe(webgl.page, {
        generation: webglSnapshot.generation,
        method: "draw-boundary",
        renderableId: webglBellows.objectId,
        ...(typeof webglBellowsSourceMaterialId === "string" ? { sourceMaterialId: webglBellowsSourceMaterialId } : {}),
        samplePixelIndices,
      }) as DirectProbeResult;
      expect(webglDirect.status).toBe("ok");
      expect(webglDirect.feasibility).toBe("F1");
      const afterUnsupportedCapture = await captureCanvas(native.page);
      const unsupportedNoopMae = imageMae(baseline.image, afterUnsupportedCapture.image);
      const report = {
        schemaVersion: 1,
        audit: "anatomy-native-webgpu-draw-boundary",
        decision: "N3",
        preservedResearchDecisions: { anatomy: "M2 — OPT-IN IMPLEMENTATION INCOMPLETE", overall: "G2 — PARTIAL STAGE ATTRIBUTION" },
        provenance: {
          baseCommit: process.env.M_INV5_BASE_COMMIT ?? null,
          measurementCommit: process.env.M_INV5_MEASUREMENT_COMMIT ?? null,
          threeRevision: "186",
          browserVersion: browser.version(),
          operatingSystem: { platform: process.platform, architecture: process.arch },
          viewport: [1440, 1000],
          devicePixelRatio: nativeSnapshot.viewport.devicePixelRatio,
          rendererFamily: "webgpu-renderer",
          executionBackend: "webgpu",
          applicationFallback: "none",
          outputPolicy: "material-aware",
          hardwareAcceleration: "unconfirmed by this experiment",
        },
        scope: {
          teachingState: "Front Standard highlighted; Bellows dimmed",
          semanticPart: "bellows-folded-surface",
          selectedRenderable: { id: nativeBellows.objectId, name: nativeBellows.name },
          sourceMaterialId,
          geometry: nativeBellows.geometry,
          selectedFixedFramebufferSamples: samplePixelIndices,
        },
        feasibilityByMeasurement: {
          actualNativeDestinationAndPostDrawSamples: { classification: "F0", values: null, reason: nativeBoundary.reason },
          actualNativeDrawIdentityAndPassMetadata: { classification: "F0", values: null, reason: nativeBoundary.reason },
          nativeGpuPipelineBlendDescriptor: { classification: "F0", values: null, reason: nativeBoundary.reason },
          nativeSourceFragmentRgbAndAlpha: { classification: "F0", rgb: null, alpha: null, reason: "The WebGPU API does not expose source shader outputs from the compiled render pipeline." },
          nativeFinalFrameParity: { classification: "F0", value: null, reason: "Pass instrumentation was rejected before a native boundary snapshot could qualify." },
          webglDrawBoundaryBaseline: "F1",
        },
        unsupported: { reason: nativeBoundary.reason },
        baseline: {
          repeatNoiseMae: baselineNoise.meanAbsoluteRgbDifference,
          unsupportedCaptureNoopMae: unsupportedNoopMae,
          unsupportedCaptureNoopWithinNoise: unsupportedNoopMae <= baselineNoise.meanAbsoluteRgbDifference,
        },
        nativeDestinationObservations: null,
        webglComparison: {
          classification: "F1 raw RGBA8 default-framebuffer readback; top-left row order.",
          drawCount: webglDirect.drawObservations.length,
          observations: webglDirect.drawObservations,
          nativeComparison: null,
          reason: nativeBoundary.reason,
        },
        negativeControls: {
          unsupportedCaptureLeftCanvasWithinRepeatNoise: unsupportedNoopMae <= baselineNoise.meanAbsoluteRgbDifference,
          originalSourceMaterialsAndGeometryMutated: false,
          resourceOwnership: "Unsupported capture exits before taking ownership of source resources.",
        },
        captureLifecycle: {
          activeOperationSettlement: nativeCaptureSettlement,
          resourceCleanup: nativeCaptureSettlement.resourceCleanup ?? null,
          singleActiveCapturePolicy: "reject capture-already-active",
          pendingReadbackCancellationTest: "run separately by the same focused suite",
        },
        limitations: [
          "No native destination or post-draw pixel values are reported for an unsupported pass shape.",
          "Hardware acceleration was not independently identified by this test.",
        ],
      };
      await writeReport(report);
      expect(nativeBoundary.feasibility).toBe("F0");
      expect(unsupportedNoopMae).toBeLessThanOrEqual(baselineNoise.meanAbsoluteRgbDifference);
      return;
    }
    expect(nativeBoundary.status).toBe("ok");
    expect(nativeBoundary.rendererRuntime).toEqual({ rendererFamily: "webgpu-renderer", executionBackend: "webgpu" });
    expect(nativeBoundary.threeRevision).toBe("186");
    expect(nativeBoundary.selectedRenderable).toMatchObject({
      id: nativeBellows.objectId,
      name: "bellows-folded-surface",
      geometry: { id: nativeBellows.geometry.id },
    });
    expect(nativeBoundary.drawObservations.length).toBeGreaterThan(0);
    expect(nativeBoundary.drawObservations.every(({ commandCount }) => commandCount === 1)).toBe(true);
    expect(nativeBoundary.drawObservations.every(({ sourceMaterialId: capturedSource }) =>
      capturedSource === sourceMaterialId)).toBe(true);
    expect(nativeBoundary.drawObservations.some(({ response }) =>
      Number(response.changedSampleCount) > 0)).toBe(true);
    expect(nativeBoundary.finalFrame.rawFramebufferSamples).toHaveLength(samplePixelIndices.length);
    const nativeResourceCleanup = nativeCaptureSettlement.resourceCleanup as Readonly<Record<string, unknown>>;
    expect(nativeResourceCleanup.noBorrowedResourceDisposed).toBe(true);
    expect(nativeResourceCleanup.temporaryFramebufferTextureDisposeCount)
      .toBe(nativeResourceCleanup.temporaryFramebufferTextureCount);
    expect(nativeResourceCleanup.readbackBufferDestroyCount).toBe(nativeResourceCleanup.readbackBufferCount);
    expect(nativeResourceCleanup.readbackBufferDisposalFailures).toBe(0);

    const nativeControl = nativeBoundary.finalFrame.rawFramebufferSamples.at(-1);
    expect(nativeControl).toBeTruthy();
    const negativeControlUnchanged = nativeBoundary.drawObservations.every((observation) => {
      const controlSample = observation.destinationAndPostDrawSamples.at(-1);
      return JSON.stringify(controlSample?.destination) === JSON.stringify(controlSample?.postDraw);
    });
    const finalFrameParity = nativeBoundary.finalFrame.screenshotParity;
    expect(finalFrameParity.meanAbsoluteRgbDifference).not.toBeNull();

    const postCaptureSnapshot = await readAuditSnapshot(native.page, `m-inv5-native-after-${++requestCounter}`);
    const postCaptureBellows = postCaptureSnapshot.renderables.find((renderable) =>
      renderable.objectId === nativeBellows.objectId,
    );
    expect(postCaptureSnapshot.generation).toBe(nativeSnapshot.generation);
    expect(postCaptureBellows).toBeTruthy();
    expect(postCaptureBellows?.geometry).toEqual(nativeBellows.geometry);
    expect(postCaptureBellows?.materialAssignments).toEqual(nativeBellows.materialAssignments);
    expect(postCaptureBellows?.worldMatrix).toEqual(nativeBellows.worldMatrix);
    expect(postCaptureBellows?.visible).toBe(nativeBellows.visible);
    const restoredCanvas = await captureCanvas(native.page);
    const restoredCanvasMae = imageMae(baseline.image, restoredCanvas.image);
    await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");
    const groundGlassAfter = await captureGroundGlass(native.page);
    const groundGlassRestorationMae = imageMae(groundGlassBaseline, groundGlassAfter);

    const webglBellowsSourceMaterialId = webglBellows.materialAssignments[0]?.source.id;
    const webglDirect = await requestProbe(webgl.page, {
      generation: webglSnapshot.generation,
      method: "draw-boundary",
      renderableId: webglBellows.objectId,
      ...(typeof webglBellowsSourceMaterialId === "string" ? { sourceMaterialId: webglBellowsSourceMaterialId } : {}),
      samplePixelIndices,
    }) as DirectProbeResult;
    expect(webglDirect.status).toBe("ok");
    expect(webglDirect.feasibility).toBe("F1");
    expect(webglDirect.rendererRuntime).toEqual({ rendererFamily: "webgl-renderer", executionBackend: "webgl2" });
    const webglByCaptureOrder = [...webglDirect.drawObservations].sort((left, right) =>
      (left.captureOrder ?? 0) - (right.captureOrder ?? 0));
    const stageComparisons = nativeBoundary.drawObservations.flatMap((nativeObservation) =>
      webglByCaptureOrder.map((webglObservation) => {
      const webglSamples = new Map(webglObservation.destinationAndPostDrawSamples.map((sample) => [sample.index, sample]));
      let rgbDifference = 0;
      let alphaDifference = 0;
      let comparedSampleCount = 0;
      for (const nativeSample of nativeObservation.destinationAndPostDrawSamples) {
        const webglSample = webglSamples.get(nativeSample.index);
        if (!webglSample) continue;
        for (let channel = 0; channel < 3; channel += 1) {
          rgbDifference += Math.abs((nativeSample.destination[channel] ?? 0) - (webglSample.destination[channel] ?? 0));
          rgbDifference += Math.abs((nativeSample.postDraw[channel] ?? 0) - (webglSample.postDraw[channel] ?? 0));
        }
        alphaDifference += Math.abs((nativeSample.destination[3] ?? 0) - (webglSample.destination[3] ?? 0));
        alphaDifference += Math.abs((nativeSample.postDraw[3] ?? 0) - (webglSample.postDraw[3] ?? 0));
        comparedSampleCount += 1;
      }
      const valueCount = comparedSampleCount * 2;
      return {
        nativeDrawOrder: nativeObservation.drawOrder,
        webglCaptureOrder: webglObservation.captureOrder ?? null,
        pairing: "all-pairs numerical candidate; no native/WebGL draw-order equivalence is asserted",
        sampleCount: comparedSampleCount,
        meanAbsoluteRgbCodeValueDifference: valueCount > 0 ? rgbDifference / (valueCount * 3) : null,
        meanAbsoluteAlphaCodeValueDifference: valueCount > 0 ? alphaDifference / valueCount : null,
      };
      }),
    );

    const passShapes = nativeBoundary.drawObservations.map((observation) => {
      const state = observation.state;
      return {
        drawOrder: observation.drawOrder,
        call: observation.call,
        commandCount: observation.commandCount,
        drawParameters: observation.drawParameters ?? null,
        renderPassId: observation.renderPassId ?? null,
        passId: observation.passId ?? null,
        materialId: observation.materialId ?? null,
        sourceMaterialId: observation.sourceMaterialId,
        material: observation.material ?? null,
        sourceMaterial: observation.sourceMaterial ?? null,
        pipeline: observation.pipeline ?? null,
        state,
      };
    });
    const resumedLoadsPreserved = nativeBoundary.drawObservations.every(({ state }) => {
      const stateRecord = state as Record<string, unknown>;
      const drawPassState = stateRecord.drawPassState as {
        colorAttachments?: readonly { loadOp?: unknown }[];
        depthStencilAttachment?: { depthLoadOp?: unknown; stencilLoadOp?: unknown } | null;
      };
      return drawPassState.colorAttachments?.every(({ loadOp }) => loadOp === "load") === true &&
        (drawPassState.depthStencilAttachment?.depthLoadOp === null || drawPassState.depthStencilAttachment?.depthLoadOp === "load") &&
        (drawPassState.depthStencilAttachment?.stencilLoadOp === null || drawPassState.depthStencilAttachment?.stencilLoadOp === "load");
    });
    const sourceGeometryRestored = postCaptureBellows?.geometry !== undefined &&
      JSON.stringify(postCaptureBellows.geometry) === JSON.stringify(nativeBellows.geometry);
    const sourceMaterialPropertiesPreserved = postCaptureBellows?.materialAssignments !== undefined &&
      JSON.stringify(postCaptureBellows.materialAssignments) === JSON.stringify(nativeBellows.materialAssignments);
    const qualified = finalFrameParity.qualified && negativeControlUnchanged && resumedLoadsPreserved &&
      restoredCanvasMae <= baselineNoise.meanAbsoluteRgbDifference &&
      groundGlassRestorationMae <= groundGlassNoise.meanAbsoluteRgbDifference &&
      sourceGeometryRestored && sourceMaterialPropertiesPreserved &&
      nativeBoundary.drawObservations.length > 0 &&
      nativeBoundary.drawObservations.every(({ commandCount }) => commandCount === 1);
    const researchDecision = qualified ? "N1" : "N2";
    const report = {
      schemaVersion: 1,
      audit: "anatomy-native-webgpu-draw-boundary",
      decision: researchDecision,
      preservedResearchDecisions: { anatomy: "M2 — OPT-IN IMPLEMENTATION INCOMPLETE", overall: "G2 — PARTIAL STAGE ATTRIBUTION" },
      provenance: {
        baseCommit: process.env.M_INV5_BASE_COMMIT ?? null,
        measurementCommit: process.env.M_INV5_MEASUREMENT_COMMIT ?? null,
        threeRevision: nativeBoundary.threeRevision,
        browserVersion: browser.version(),
        operatingSystem: { platform: process.platform, architecture: process.arch },
        viewport: [1440, 1000],
        devicePixelRatio: nativeSnapshot.viewport.devicePixelRatio,
        rendererFamily: nativeBoundary.rendererRuntime.rendererFamily,
        executionBackend: nativeBoundary.rendererRuntime.executionBackend,
        applicationFallback: "none",
        outputPolicy: "material-aware",
        hardwareAcceleration: "unconfirmed by this experiment",
      },
      scope: {
        teachingState: "Front Standard highlighted; Bellows dimmed",
        semanticPart: "bellows-folded-surface",
        selectedRenderable: { id: nativeBoundary.selectedRenderable.id, name: nativeBoundary.selectedRenderable.name },
        sourceMaterialId,
        geometry: nativeBoundary.selectedRenderable.geometry,
        selectedFixedFramebufferSamples: samplePixelIndices,
        negativeControlFramebufferSample: samplePixelIndices.at(-1),
      },
      feasibilityByMeasurement: {
        actualNativeDestinationAndPostDrawSamples: nativeBoundary.feasibility,
        actualNativeDrawIdentityAndPassMetadata: "F1",
        nativeGpuPipelineBlendDescriptor: "F3",
        nativeSourceFragmentRgbAndAlpha: { classification: "F0", rgb: null, alpha: null, reason: "The WebGPU API does not expose source shader outputs from the compiled render pipeline." },
        rawAttachmentToCssScreenshotComparison: {
          classification: finalFrameParity.qualified ? "F1" : "F0",
          result: finalFrameParity,
          reason: finalFrameParity.qualified
            ? null
            : "The raw GPU drawing buffer and CSS-sized browser screenshot do not meet the measured repeat-noise threshold under the recorded resampling; this cross-representation comparison cannot establish unchanged final output.",
        },
        webglDrawBoundaryBaseline: "F1",
      },
      renderPass: {
        instrumentation: "Guarded r186 WebGPUBackend.draw and finishRender wrappers; renderer.copyFramebufferToTexture splits the live pass in its existing command encoder.",
        observations: passShapes,
        actualNativeBackendDrawInvocationCount: nativeBoundary.drawObservations.length,
        eachBackendInvocationContainsOneNativeDrawCommand: nativeBoundary.drawObservations.every(({ commandCount }) => commandCount === 1),
        attachments: nativeBoundary.drawObservations.map(({ state }) => state),
        finalFramePassCountAdded: 1,
        addedPassCount: nativeBoundary.drawObservations.length * 2 + 1,
        passEquivalence: {
          descriptorLoadOpsResumedAsLoad: resumedLoadsPreserved,
          finalFrameParity,
          parityQualified: finalFrameParity.qualified,
        },
      },
      nativeDestinationObservations: nativeBoundary.drawObservations,
      webglComparison: {
        classification: "F1 raw 8-bit default-canvas code values; BGRA was normalized to RGBA; no browser-composited output is used for the draw-boundary pair.",
        webglDrawCount: webglByCaptureOrder.length,
        nativeDrawCount: nativeBoundary.drawObservations.length,
        crossBackendDrawPairCount: stageComparisons.length,
        drawPairingPolicy: "All-pairs numerical candidates are retained. No native/WebGL draw-order equivalence is asserted.",
        stageComparisons,
      },
      finalFrameParity: {
        repeatNoiseMae: baselineNoise.meanAbsoluteRgbDifference,
        ...finalFrameParity,
        nextUninstrumentedCanvasRestorationMae: restoredCanvasMae,
        groundGlassRestorationMae,
        groundGlassRepeatNoiseMae: groundGlassNoise.meanAbsoluteRgbDifference,
      },
      negativeControls: {
        unchangedCanvasSampleAfterSelectedDraws: negativeControlUnchanged,
        unchangedControlIndex: samplePixelIndices.at(-1),
        sourceMaterialIdentityMatched: nativeBoundary.drawObservations.every(({ sourceMaterialId: id }) => id === sourceMaterialId),
        sourceMaterialPropertiesPreserved,
        sourceGeometryRestored,
        resourceOwnership: "The capture owns FramebufferTexture snapshots and readback buffers. Each buffer is destroyed in finally after mapAsync settles or rejects. Scene materials, geometry, textures and Ground Glass targets are borrowed and untouched.",
        resourceCleanup: nativeResourceCleanup,
      },
      captureLifecycle: {
        singleActiveCapturePolicy: "reject capture-already-active",
        cancellationEvidence: "The pending native readback SPA-retirement regression is a separate deterministic browser test in the same focused suite.",
      },
      interpretation: qualified
        ? "Pass-segmented native destination/post-draw samples met full-frame baseline parity, attachment load-op, one-command, source-state, restoration, and unaffected-pixel checks; these are qualified stage observations, not a complete dominant-cause diagnosis."
        : "The pass split yielded actual native draw identities and raw destination/post-draw bytes, but semantic equivalence did not qualify. The raw GPU attachment was compared with a lower-resolution CSS screenshot and did not meet repeat noise; that cross-representation delta is not attributed to the pass split. Keep pixel evidence at F2 and use the narrow raw-to-raw baseline comparison as the next step.",
      remainingUnknowns: [
        "The WebGPU API does not expose compiled pipeline descriptors after creation; blend and depth mappings are recorded from the pinned r186 pipeline utility and active render-object material.",
        "Native fragment RGB/alpha before fixed-function blending remains unavailable.",
        "A qualified native boundary observation does not by itself establish the dominant rendering mechanism or authorize correction.",
      ],
    };
    await writeReport(report);
    expect(report.provenance.applicationFallback).toBe("none");
    expect(report.scope.teachingState).toContain("Front Standard");
    expect(report.feasibilityByMeasurement.nativeSourceFragmentRgbAndAlpha.classification).toBe("F0");
    expect(report.preservedResearchDecisions.overall).toBe("G2 — PARTIAL STAGE ATTRIBUTION");
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
