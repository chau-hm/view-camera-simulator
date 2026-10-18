import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  runAnatomyNativeWebGpuDrawBoundaryCapture,
  runAnatomyNativeWebGpuFinalFrameCapture,
  type AnatomyNativeBoundarySelection,
} from "../../render/backend/anatomyNativeWebGpuDrawBoundaryCapture";

type Deferred<T> = Readonly<{ promise: Promise<T>; resolve: (value: T) => void; reject: (cause: unknown) => void }>;

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const runtime = { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" } as const;
const format = "rgba8unorm";

const createFixture = (options: Readonly<{
  finishRender?: () => unknown;
  afterFramebufferCopy?: () => void;
  mapAsync?: () => Promise<void>;
}> = {}) => {
  const queueFence = deferred<unknown>();
  const resourceRelease = deferred<Readonly<Record<string, unknown>>>();
  const releasedDetails: Readonly<Record<string, unknown>>[] = [];
  let finishRenderImplementation = options.finishRender;
  const deviceLost = deferred<unknown>();
  const contextData: {
    currentPass: { end: () => void };
    descriptor: { colorAttachments: Array<{ loadOp: string; storeOp: string; resolveTarget: null }> };
    encoder: object;
  } = {
    currentPass: { end: vi.fn() },
    descriptor: { colorAttachments: [{ loadOp: "load", storeOp: "store", resolveTarget: null }] },
    encoder: {},
  };
  const originalBeginRender = vi.fn(() => {
    contextData.encoder = {};
    contextData.currentPass = { end: vi.fn() };
    contextData.descriptor = { colorAttachments: [{ loadOp: "load", storeOp: "store", resolveTarget: null }] };
  });
  const originalFinishRender = vi.fn(() => finishRenderImplementation?.());
  const originalDraw = vi.fn(() => undefined);
  const renderContext = {
    id: 1,
    renderTarget: null,
    textures: null,
    sampleCount: 1,
    depth: false,
    stencil: false,
    occlusionQueryCount: 0,
    camera: new THREE.PerspectiveCamera(),
  };
  const pipeline = { id: 3 };
  const backend = {
    beginRender: originalBeginRender,
    draw: originalDraw,
    finishRender: originalFinishRender,
    get: (value: object) => {
      if (value === renderContext) return contextData;
      if (value === pipeline) return { pipeline: {} };
      if (value instanceof THREE.Texture) {
        return { texture: {}, textureDescriptorGPU: { format } };
      }
      return {};
    },
    device: {
      createBuffer: vi.fn(() => ({
        mapAsync: vi.fn(() => options.mapAsync?.() ?? Promise.resolve()),
        getMappedRange: () => new Uint8Array([0, 0, 0, 255]).buffer,
        destroy: vi.fn(),
      })),
      createCommandEncoder: vi.fn(() => ({
        copyTextureToBuffer: vi.fn(),
        finish: () => ({}),
      })),
      queue: {
        submit: vi.fn(),
        onSubmittedWorkDone: vi.fn(() => queueFence.promise),
      },
      lost: deviceLost.promise,
    },
    context: {
      getCurrentTexture: () => ({ format }),
      getConfiguration: () => ({ alphaMode: "opaque" }),
    },
    utils: {
      getPreferredCanvasFormat: () => format,
      getSampleCountRenderContext: () => 1,
      getCurrentColorFormat: () => format,
      getCurrentDepthStencilFormat: () => "depth24plus",
    },
    pipelineUtils: {
      _getBlending: () => null,
      _getDepthCompare: () => "less",
    },
  };
  const renderer = {
    backend,
    outputColorSpace: THREE.SRGBColorSpace,
    toneMapping: THREE.NoToneMapping,
    getRenderTarget: () => null,
    getScissorTest: () => false,
    getDrawingBufferSize: (target: THREE.Vector2) => target.set(1, 1),
    copyFramebufferToTexture: vi.fn(() => {
      contextData.currentPass = { end: vi.fn() };
      contextData.descriptor = { colorAttachments: [{ loadOp: "load", storeOp: "store", resolveTarget: null }] };
      options.afterFramebufferCopy?.();
    }),
  };
  let registeredCleanup: (() => void) | null = null;
  let unregisterCount = 0;
  const callbacks = {
    isCaptureActive: () => true,
    awaitReadbacks: vi.fn(async (readbacks: readonly Promise<ArrayBufferView>[]) =>
      Promise.all(readbacks)),
    registerCleanup: vi.fn((cleanup: () => void) => {
      registeredCleanup = cleanup;
      return () => { unregisterCount += 1; registeredCleanup = null; };
    }),
    onResourcesReleased: vi.fn((detail: Readonly<Record<string, unknown>>) => {
      releasedDetails.push(detail);
      resourceRelease.resolve(detail);
    }),
  };

  return {
    backend,
    renderer,
    renderContext,
    pipeline,
    queueFence,
    deviceLost,
    resourceRelease,
    releasedDetails,
    callbacks,
    originalBeginRender,
    originalFinishRender,
    originalDraw,
    setFinishRender: (implementation: (() => unknown) | undefined) => {
      finishRenderImplementation = implementation;
    },
    get registeredCleanup() { return registeredCleanup; },
    get unregisterCount() { return unregisterCount; },
  };
};

const finalFrameOptions = (fixture: ReturnType<typeof createFixture>, callbacks = fixture.callbacks) => ({
  renderer: fixture.renderer as unknown as Parameters<typeof runAnatomyNativeWebGpuFinalFrameCapture>[0]["renderer"],
  runtime,
  threeRevision: "186",
  generation: 12,
  samplePixelIndices: [0],
  includeRawFramebuffer: true,
  isCaptureActive: callbacks.isCaptureActive,
  awaitReadbacks: callbacks.awaitReadbacks,
  registerCleanup: callbacks.registerCleanup,
  onResourcesReleased: callbacks.onResourcesReleased,
});

const drawBoundaryOptions = (
  fixture: ReturnType<typeof createFixture>,
  boundarySelection?: AnatomyNativeBoundarySelection,
) => {
  const material = new THREE.MeshBasicMaterial();
  const selected = new THREE.Mesh(new THREE.BufferGeometry(), material);
  selected.name = "selected-test-renderable";
  return {
    selected,
    options: {
      renderer: fixture.renderer as unknown as Parameters<typeof runAnatomyNativeWebGpuDrawBoundaryCapture>[0]["renderer"],
      runtime,
      threeRevision: "186",
      generation: 12,
      selected,
      ...(boundarySelection ? { boundarySelection } : {}),
      samplePixelIndices: [0],
      baselineCanvas: {
        width: 1,
        height: 1,
        rgbaBase64: window.btoa(String.fromCharCode(0, 0, 0, 255)),
        repeatNoiseMae: 0,
      },
      resolveSourceMaterial: (source: THREE.Material) => source,
      isCaptureActive: fixture.callbacks.isCaptureActive,
      awaitReadbacks: fixture.callbacks.awaitReadbacks,
      registerCleanup: fixture.callbacks.registerCleanup,
      onResourcesReleased: fixture.callbacks.onResourcesReleased,
    } satisfies Parameters<typeof runAnatomyNativeWebGpuDrawBoundaryCapture>[0],
  };
};

const stubReadbackApi = () => {
  vi.stubGlobal("GPUBufferUsage", { COPY_DST: 1, MAP_READ: 2 });
  vi.stubGlobal("GPUMapMode", { READ: 1 });
};

const selectedRenderObject = (
  fixture: ReturnType<typeof createFixture>,
  selected: THREE.Object3D,
  id: number,
  passId = id === 8 ? "backSide" : "frontSide",
) => ({
  id,
  object: selected,
  material: (selected as THREE.Mesh).material as THREE.Material,
  context: fixture.renderContext,
  pipeline: fixture.pipeline,
  passId,
  getDrawParameters: () => ({ vertexCount: 240, firstVertex: 0, instanceCount: 1, firstInstance: 0 }),
});

const invokeTwoSelectedDraws = (
  fixture: ReturnType<typeof createFixture>,
  selected: THREE.Object3D,
) => {
  const backend = fixture.backend as unknown as {
    draw: (renderObject: object, info: unknown) => unknown;
    finishRender: (context: object) => unknown;
  };
  backend.draw(selectedRenderObject(fixture, selected, 8, "backSide"), {});
  backend.draw(selectedRenderObject(fixture, selected, 9, "frontSide"), {});
  return backend;
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("native WebGPU selected draw failure settlement", () => {
  it("settles P0 when the first selected draw throws before any snapshot exists", async () => {
    vi.useFakeTimers();
    const failure = new Error("injected selected native draw failure");
    const fixture = createFixture();
    const clearTimeout = vi.spyOn(window, "clearTimeout");
    const { selected, options } = drawBoundaryOptions(fixture, {
      beforeFirstDraw: false,
      afterFirstDraw: false,
      beforeSecondDraw: false,
      afterSecondDraw: false,
    });
    const capture = runAnatomyNativeWebGpuDrawBoundaryCapture(options);
    let settled = false;
    let outcome: Readonly<Record<string, unknown>> | null = null;
    void capture.then(
      (result) => { settled = true; outcome = result; },
      (cause) => { settled = true; outcome = { error: cause }; },
    );
    const backend = fixture.backend as unknown as {
      draw: (renderObject: object, info: unknown) => unknown;
      finishRender: (context: object) => unknown;
    };
    fixture.originalDraw.mockImplementationOnce(() => { throw failure; });

    expect(() => backend.draw(selectedRenderObject(fixture, selected, 8), {})).toThrow(failure);
    await vi.advanceTimersByTimeAsync(10_001);
    await Promise.resolve();

    expect(settled).toBe(true);
    expect(outcome).toMatchObject({
      status: "unsupported",
      feasibility: "F0",
      reason: "native-selected-draw-failed",
      selectedDrawFailure: { name: "Error", message: failure.message },
      selectedDrawProgress: { attempted: 1, completed: 0 },
      captureLifecycle: {
        copyAttemptCount: 0,
        submissionState: "not-submitted",
        readbackState: "not-started",
        encoderRetirementOutcome: "not-required",
      },
    });
    expect(fixture.renderer.copyFramebufferToTexture).not.toHaveBeenCalled();
    expect(fixture.backend.device.createBuffer).not.toHaveBeenCalled();
    expect(backend.draw).toBe(fixture.originalDraw);
    expect(backend.finishRender).toBe(fixture.originalFinishRender);
    expect(fixture.unregisterCount).toBe(1);
    expect(clearTimeout).toHaveBeenCalled();
    expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(1);
    expect(fixture.releasedDetails[0]).toMatchObject({
      temporaryFramebufferTextureCount: 0,
      temporaryFramebufferTextureDisposeCount: 0,
      submissionState: "not-submitted",
      readbackState: "not-started",
      noBorrowedResourceDisposed: true,
    });

    stubReadbackApi();
    const healthy = runAnatomyNativeWebGpuDrawBoundaryCapture(options);
    const nextBackend = invokeTwoSelectedDraws(fixture, selected);
    expect(() => nextBackend.finishRender(fixture.renderContext)).not.toThrow();
    expect(await healthy).toMatchObject({ status: "ok", nativeDrawCount: 2, feasibility: "F1" });
    expect(nextBackend.draw).toBe(fixture.originalDraw);
    expect(nextBackend.finishRender).toBe(fixture.originalFinishRender);
  });

  it("keeps the timeout active after one completed P0 draw of a required two-draw capture", async () => {
    vi.useFakeTimers();
    const fixture = createFixture();
    const { selected, options } = drawBoundaryOptions(fixture, {
      beforeFirstDraw: false,
      afterFirstDraw: false,
      beforeSecondDraw: false,
      afterSecondDraw: false,
    });
    const capture = runAnatomyNativeWebGpuDrawBoundaryCapture(options);
    const backend = fixture.backend as unknown as {
      draw: (renderObject: object, info: unknown) => unknown;
      finishRender: (context: object) => unknown;
    };

    expect(() => backend.draw(selectedRenderObject(fixture, selected, 8), {})).not.toThrow();
    await vi.advanceTimersByTimeAsync(10_001);

    expect(await capture).toMatchObject({
      status: "unsupported",
      reason: "boundary-selection-requires-two-completed-selected-native-draws-before-timeout",
    });
    expect(backend.draw).toBe(fixture.originalDraw);
    expect(backend.finishRender).toBe(fixture.originalFinishRender);
    expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(1);
  });

  it("settles a capture when no selected native draw arrives before the timeout", async () => {
    vi.useFakeTimers();
    const fixture = createFixture();
    const { options } = drawBoundaryOptions(fixture, {
      beforeFirstDraw: false,
      afterFirstDraw: false,
      beforeSecondDraw: false,
      afterSecondDraw: false,
    });
    const capture = runAnatomyNativeWebGpuDrawBoundaryCapture(options);

    await vi.advanceTimersByTimeAsync(10_001);

    expect(await capture).toMatchObject({
      status: "unsupported",
      reason: "selected-renderable-did-not-issue-a-qualifiable-native-draw-before-timeout",
    });
    expect(fixture.backend.draw).toBe(fixture.originalDraw);
    expect(fixture.backend.finishRender).toBe(fixture.originalFinishRender);
    expect(fixture.unregisterCount).toBe(1);
    expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(1);
  });

  it("keeps timeout settlement available for a deferred encoded-copy failure", async () => {
    vi.useFakeTimers();
    const failure = new Error("injected S1 framebuffer copy failure");
    const fixture = createFixture();
    const { selected, options } = drawBoundaryOptions(fixture, {
      beforeFirstDraw: true,
      afterFirstDraw: false,
      beforeSecondDraw: false,
      afterSecondDraw: false,
    });
    const capture = runAnatomyNativeWebGpuDrawBoundaryCapture(options);
    let rejection: unknown;
    void capture.catch((cause) => { rejection = cause; });
    const backend = fixture.backend as unknown as {
      beginRender: (context: object) => unknown;
      draw: (renderObject: object, info: unknown) => unknown;
      finishRender: (context: object) => unknown;
    };
    fixture.renderer.copyFramebufferToTexture.mockImplementationOnce(() => { throw failure; });

    expect(() => backend.draw(selectedRenderObject(fixture, selected, 8), {})).not.toThrow();
    expect(backend.draw).toBe(fixture.originalDraw);
    expect(backend.finishRender).not.toBe(fixture.originalFinishRender);
    expect(fixture.callbacks.onResourcesReleased).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_001);
    await Promise.resolve();

    expect(rejection).toBe(failure);
    expect(backend.finishRender).toBe(fixture.originalFinishRender);
    expect(fixture.backend.device.createBuffer).not.toHaveBeenCalled();
    expect(fixture.backend.device.queue.onSubmittedWorkDone).not.toHaveBeenCalled();
    expect(fixture.callbacks.onResourcesReleased).not.toHaveBeenCalled();

    expect(() => backend.beginRender(fixture.renderContext)).not.toThrow();
    expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(1);
    expect(fixture.releasedDetails[0]).toMatchObject({
      copyState: "unknown",
      submissionState: "not-submitted",
      encoderRetirementOutcome: "encoder-replaced",
      noBorrowedResourceDisposed: true,
    });
  });

  it("retires an encoded S1 snapshot only after r186 replaces the abandoned encoder", async () => {
    const failure = new Error("injected P1 selected native draw failure");
    const fixture = createFixture();
    const { selected, options } = drawBoundaryOptions(fixture, {
      beforeFirstDraw: true,
      afterFirstDraw: false,
      beforeSecondDraw: false,
      afterSecondDraw: false,
    });
    const capture = runAnatomyNativeWebGpuDrawBoundaryCapture(options);
    const backend = fixture.backend as unknown as {
      beginRender: (context: object) => unknown;
      draw: (renderObject: object, info: unknown) => unknown;
      finishRender: (context: object) => unknown;
    };
    fixture.originalDraw.mockImplementationOnce(() => { throw failure; });

    expect(() => backend.draw(selectedRenderObject(fixture, selected, 8), {})).toThrow(failure);
    expect(await capture).toMatchObject({
      status: "unsupported",
      feasibility: "F0",
      reason: "native-selected-draw-failed",
      selectedDrawProgress: { attempted: 1, completed: 0 },
      captureLifecycle: {
        copyState: "encoded",
        copyAttemptCount: 1,
        submissionState: "not-submitted",
        readbackState: "not-started",
        encoderRetirementOutcome: "pending",
      },
    });
    expect(fixture.renderer.copyFramebufferToTexture).toHaveBeenCalledTimes(1);
    expect(fixture.backend.device.createBuffer).not.toHaveBeenCalled();
    expect(fixture.backend.device.queue.onSubmittedWorkDone).not.toHaveBeenCalled();
    expect(backend.draw).toBe(fixture.originalDraw);
    expect(backend.finishRender).toBe(fixture.originalFinishRender);
    expect(backend.beginRender).not.toBe(fixture.originalBeginRender);
    expect(fixture.callbacks.onResourcesReleased).not.toHaveBeenCalled();

    expect(() => backend.beginRender(fixture.renderContext)).not.toThrow();
    expect(backend.beginRender).toBe(fixture.originalBeginRender);
    expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(1);
    expect(fixture.releasedDetails[0]).toMatchObject({
      temporaryFramebufferTextureCount: 1,
      temporaryFramebufferTextureDisposeCount: 1,
      copyState: "encoded",
      submissionState: "not-submitted",
      readbackState: "not-started",
      queueFenceOutcome: "not-required",
      encoderRetirementOutcome: "encoder-replaced",
      noBorrowedResourceDisposed: true,
    });
  });

  it("keeps the first completed draw distinct when the second selected draw throws", async () => {
    const failure = new Error("injected second selected native draw failure");
    const fixture = createFixture();
    const { selected, options } = drawBoundaryOptions(fixture, {
      beforeFirstDraw: true,
      afterFirstDraw: false,
      beforeSecondDraw: false,
      afterSecondDraw: false,
    });
    const capture = runAnatomyNativeWebGpuDrawBoundaryCapture(options);
    const backend = fixture.backend as unknown as {
      beginRender: (context: object) => unknown;
      draw: (renderObject: object, info: unknown) => unknown;
      finishRender: (context: object) => unknown;
    };
    fixture.originalDraw
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => { throw failure; });

    expect(() => backend.draw(selectedRenderObject(fixture, selected, 8), {})).not.toThrow();
    expect(() => backend.draw(selectedRenderObject(fixture, selected, 9), {})).toThrow(failure);
    expect(await capture).toMatchObject({
      status: "unsupported",
      feasibility: "F0",
      reason: "native-selected-draw-failed",
      selectedDrawFailure: { message: failure.message },
      selectedDrawProgress: { attempted: 2, completed: 1 },
      captureLifecycle: {
        copyState: "encoded",
        submissionState: "not-submitted",
        readbackState: "not-started",
        encoderRetirementOutcome: "pending",
      },
    });
    expect(fixture.renderer.copyFramebufferToTexture).toHaveBeenCalledTimes(1);
    expect(fixture.backend.device.createBuffer).not.toHaveBeenCalled();
    expect(fixture.backend.device.queue.onSubmittedWorkDone).not.toHaveBeenCalled();
    expect(backend.draw).toBe(fixture.originalDraw);
    expect(backend.finishRender).toBe(fixture.originalFinishRender);
    expect(fixture.callbacks.onResourcesReleased).not.toHaveBeenCalled();

    fixture.registeredCleanup?.();
    expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(1);
    expect(fixture.releasedDetails[0]).toMatchObject({
      temporaryFramebufferTextureCount: 1,
      temporaryFramebufferTextureDisposeCount: 1,
      submissionState: "not-submitted",
      encoderRetirementOutcome: "renderer-generation-retired",
      noBorrowedResourceDisposed: true,
    });
    expect(fixture.backend.device.queue.onSubmittedWorkDone).not.toHaveBeenCalled();
  });
});

describe("native WebGPU finishRender failure settlement", () => {
  it("settles A1 when the original finishRender throws before a result exists and fences texture disposal", async () => {
    const failure = new Error("injected r186 finishRender failure");
    const fixture = createFixture({ finishRender: () => { throw failure; } });
    const clearTimeout = vi.spyOn(window, "clearTimeout");
    const capture = runAnatomyNativeWebGpuFinalFrameCapture(finalFrameOptions(fixture));
    const backend = fixture.backend as unknown as { finishRender: (context: object) => unknown };

    expect(backend.finishRender).not.toBe(fixture.originalFinishRender);
    expect(() => backend.finishRender(fixture.renderContext)).toThrow(failure);

    const result = await capture;
    expect(result).toMatchObject({
      status: "unsupported",
      method: "native-final-frame",
      feasibility: "F0",
      reason: "native-finish-render-failed",
      finishRenderError: { name: "Error", message: failure.message },
    });
    expect(fixture.callbacks.awaitReadbacks).not.toHaveBeenCalled();
    expect(backend.finishRender).toBe(fixture.originalFinishRender);
    expect(fixture.unregisterCount).toBe(1);
    expect(clearTimeout).toHaveBeenCalled();
    expect(fixture.callbacks.onResourcesReleased).not.toHaveBeenCalled();
    expect(fixture.backend.device.queue.onSubmittedWorkDone).toHaveBeenCalledTimes(1);

    fixture.queueFence.resolve(undefined);
    const released = await fixture.resourceRelease.promise;
    expect(released).toMatchObject({
      temporaryFramebufferTextureCount: 1,
      temporaryFramebufferTextureDisposeCount: 1,
      temporaryFramebufferTextureDisposeEventsPerResource: [1],
      copyState: "encoded",
      copyAttemptCount: 1,
      copyEncodedCount: 1,
      submissionState: "unknown",
      readbackState: "not-started",
      queueFenceOutcome: "queue-completed",
      noBorrowedResourceDisposed: true,
    });
    expect(fixture.releasedDetails).toHaveLength(1);
    expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(1);
  });

  it("allows a new A1 capture to succeed while the failed capture only awaits its cleanup fence", async () => {
    const failure = new Error("one-shot r186 finishRender failure");
    const fixture = createFixture({ finishRender: () => { throw failure; } });
    const backend = fixture.backend as unknown as { finishRender: (context: object) => unknown };
    const failedCapture = runAnatomyNativeWebGpuFinalFrameCapture(finalFrameOptions(fixture));

    expect(() => backend.finishRender(fixture.renderContext)).toThrow(failure);
    expect(await failedCapture).toMatchObject({ reason: "native-finish-render-failed" });
    expect(backend.finishRender).toBe(fixture.originalFinishRender);

    vi.stubGlobal("GPUBufferUsage", { COPY_DST: 1, MAP_READ: 2 });
    vi.stubGlobal("GPUMapMode", { READ: 1 });
    fixture.setFinishRender(() => undefined);
    const nextCapture = runAnatomyNativeWebGpuFinalFrameCapture(finalFrameOptions(fixture));
    expect(backend.finishRender).not.toBe(fixture.originalFinishRender);
    expect(() => backend.finishRender(fixture.renderContext)).not.toThrow();

    const result = await nextCapture;
    expect(result).toMatchObject({
      status: "ok",
      method: "native-final-frame",
      feasibility: "F2",
      finalFrame: { rawFramebufferSamples: [{ index: 0, x: 0, y: 0, rgba: [0, 0, 0, 255] }] },
    });
    expect(fixture.backend.device.createBuffer).toHaveBeenCalledTimes(1);
    expect(backend.finishRender).toBe(fixture.originalFinishRender);

    fixture.queueFence.resolve(undefined);
    await fixture.resourceRelease.promise;
    expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(2);
    expect(fixture.releasedDetails).toEqual(expect.arrayContaining([
      expect.objectContaining({ submissionState: "unknown", queueFenceOutcome: "queue-completed" }),
      expect.objectContaining({ submissionState: "confirmed", readbackState: "settled", queueFenceOutcome: "not-required" }),
    ]));
  });

  it("keeps A1's first cancellation outcome when finishRender also throws", async () => {
    const failure = new Error("injected r186 finishRender failure after cancellation");
    let active = true;
    let cancelRegisteredCapture: (() => void) | null = null;
    const fixture = createFixture({
      finishRender: () => { throw failure; },
      afterFramebufferCopy: () => {
        active = false;
        cancelRegisteredCapture?.();
      },
    });
    const options = finalFrameOptions(fixture, {
      ...fixture.callbacks,
      isCaptureActive: () => active,
    });
    const capture = runAnatomyNativeWebGpuFinalFrameCapture(options);
    cancelRegisteredCapture = fixture.registeredCleanup;
    const backend = fixture.backend as unknown as { finishRender: (context: object) => unknown };

    expect(() => backend.finishRender(fixture.renderContext)).toThrow(failure);
    const result = await capture;
    expect(result).toMatchObject({
      status: "unsupported",
      reason: "renderer-generation-retired",
    });
    expect(result).not.toHaveProperty("finishRenderError");
    expect(fixture.callbacks.awaitReadbacks).not.toHaveBeenCalled();
    expect(backend.finishRender).toBe(fixture.originalFinishRender);
    expect(fixture.unregisterCount).toBe(1);
    expect(fixture.callbacks.onResourcesReleased).not.toHaveBeenCalled();

    fixture.queueFence.resolve(undefined);
    expect(await fixture.resourceRelease.promise).toMatchObject({
      submissionState: "unknown",
      cancelled: true,
      queueFenceOutcome: "queue-completed",
      temporaryFramebufferTextureDisposeCount: 1,
    });
    expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(1);
  });

  it("settles A2 after encoded snapshots without starting readback or retaining either hook", async () => {
    const failure = new Error("injected A2 finishRender failure");
    const fixture = createFixture({ finishRender: () => { throw failure; } });
    const { selected, options } = drawBoundaryOptions(fixture);
    const capture = runAnatomyNativeWebGpuDrawBoundaryCapture(options);
    const backend = fixture.backend as unknown as {
      draw: (renderObject: object, info: unknown) => unknown;
      finishRender: (context: object) => unknown;
    };
    const material = selected.material as THREE.Material;
    const renderObject = {
      id: 8,
      object: selected,
      material,
      context: fixture.renderContext,
      pipeline: fixture.pipeline,
      getDrawParameters: () => ({ vertexCount: 3, instanceCount: 1 }),
    };

    expect(() => backend.draw(renderObject, {})).not.toThrow();
    expect(fixture.renderer.copyFramebufferToTexture).toHaveBeenCalledTimes(2);
    expect(() => backend.finishRender(fixture.renderContext)).toThrow(failure);

    const result = await capture;
    expect(result).toMatchObject({
      status: "unsupported",
      method: "native-draw-boundary",
      feasibility: "F0",
      reason: "native-finish-render-failed",
      finishRenderError: { message: failure.message },
    });
    expect(fixture.callbacks.awaitReadbacks).not.toHaveBeenCalled();
    expect(fixture.backend.device.createBuffer).not.toHaveBeenCalled();
    expect(backend.draw).toBe(fixture.originalDraw);
    expect(backend.finishRender).toBe(fixture.originalFinishRender);
    expect(fixture.unregisterCount).toBe(1);
    expect(fixture.callbacks.onResourcesReleased).not.toHaveBeenCalled();

    fixture.queueFence.resolve(undefined);
    const released = await fixture.resourceRelease.promise;
    expect(released).toMatchObject({
      temporaryFramebufferTextureCount: 3,
      temporaryFramebufferTextureDisposeCount: 3,
      temporaryFramebufferTextureDisposeEventsPerResource: [1, 1, 1],
      copyState: "encoded",
      copyAttemptCount: 3,
      copyEncodedCount: 3,
      submissionState: "unknown",
      readbackState: "not-started",
      queueFenceOutcome: "queue-completed",
      noBorrowedResourceDisposed: true,
    });
    expect(fixture.releasedDetails).toHaveLength(1);
  });

  it("executes only the enabled progressive and isolated boundary copies", async () => {
    stubReadbackApi();
    const modes: Readonly<{ name: string; selection: AnatomyNativeBoundarySelection; expectedBoundaries: string[] }>[] = [
      { name: "P0", selection: { beforeFirstDraw: false, afterFirstDraw: false, beforeSecondDraw: false, afterSecondDraw: false }, expectedBoundaries: [] },
      { name: "P1", selection: { beforeFirstDraw: true, afterFirstDraw: false, beforeSecondDraw: false, afterSecondDraw: false }, expectedBoundaries: ["S1"] },
      { name: "P2", selection: { beforeFirstDraw: true, afterFirstDraw: true, beforeSecondDraw: false, afterSecondDraw: false }, expectedBoundaries: ["S1", "S2"] },
      { name: "P3", selection: { beforeFirstDraw: true, afterFirstDraw: true, beforeSecondDraw: true, afterSecondDraw: false }, expectedBoundaries: ["S1", "S2", "S3"] },
      { name: "P4", selection: { beforeFirstDraw: true, afterFirstDraw: true, beforeSecondDraw: true, afterSecondDraw: true }, expectedBoundaries: ["S1", "S2", "S3", "S4"] },
      { name: "I1", selection: { beforeFirstDraw: true, afterFirstDraw: false, beforeSecondDraw: false, afterSecondDraw: false }, expectedBoundaries: ["S1"] },
      { name: "I2", selection: { beforeFirstDraw: false, afterFirstDraw: true, beforeSecondDraw: false, afterSecondDraw: false }, expectedBoundaries: ["S2"] },
      { name: "I3", selection: { beforeFirstDraw: false, afterFirstDraw: false, beforeSecondDraw: true, afterSecondDraw: false }, expectedBoundaries: ["S3"] },
      { name: "I4", selection: { beforeFirstDraw: false, afterFirstDraw: false, beforeSecondDraw: false, afterSecondDraw: true }, expectedBoundaries: ["S4"] },
    ];

    for (const mode of modes) {
      const fixture = createFixture();
      const { selected, options } = drawBoundaryOptions(fixture, mode.selection);
      const capture = runAnatomyNativeWebGpuDrawBoundaryCapture(options);
      const backend = invokeTwoSelectedDraws(fixture, selected);
      const expectedCopyCount = mode.expectedBoundaries.length + 1;
      expect(fixture.renderer.copyFramebufferToTexture, mode.name).toHaveBeenCalledTimes(mode.expectedBoundaries.length);
      expect(() => backend.finishRender(fixture.renderContext)).not.toThrow();
      expect(fixture.renderer.copyFramebufferToTexture, mode.name).toHaveBeenCalledTimes(expectedCopyCount);

      const result = await capture;
      expect(result, mode.name).toMatchObject({
        status: "ok",
        method: "native-draw-boundary",
        nativeDrawCount: 2,
        framebufferCopyCount: expectedCopyCount,
        nativeDrawObservations: [
          { drawOrder: 0, passId: "backSide", commandCount: 1, drawParameters: { vertexCount: 240 } },
          { drawOrder: 1, passId: "frontSide", commandCount: 1, drawParameters: { vertexCount: 240 } },
        ],
        boundarySnapshots: mode.expectedBoundaries.map((boundaryId) => ({ boundaryId })),
        finalFrame: { rawFramebufferSamples: [{ index: 0, rgba: [0, 0, 0, 255] }] },
      });
      expect(fixture.callbacks.awaitReadbacks).toHaveBeenCalledTimes(1);
      expect(fixture.callbacks.awaitReadbacks.mock.calls[0]?.[0]).toHaveLength(expectedCopyCount);
      expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(1);
      expect(fixture.releasedDetails[0]).toMatchObject({
        temporaryFramebufferTextureCount: expectedCopyCount,
        temporaryFramebufferTextureDisposeCount: expectedCopyCount,
        temporaryFramebufferTextureDisposeEventsPerResource: Array(expectedCopyCount).fill(1),
        submissionState: "confirmed",
        readbackState: "settled",
        noBorrowedResourceDisposed: true,
      });
    }
  });

  it("rejects malformed boundary selection before installing backend hooks", async () => {
    const fixture = createFixture();
    const { options } = drawBoundaryOptions(fixture);
    const malformed = {
      ...options,
      boundarySelection: {
        beforeFirstDraw: true,
        afterFirstDraw: "yes",
        beforeSecondDraw: false,
        afterSecondDraw: false,
      },
    } as unknown as Parameters<typeof runAnatomyNativeWebGpuDrawBoundaryCapture>[0];

    expect(await runAnatomyNativeWebGpuDrawBoundaryCapture(malformed)).toMatchObject({
      status: "unsupported",
      reason: "invalid-native-boundary-selection",
    });
    expect(fixture.backend.draw).toBe(fixture.originalDraw);
    expect(fixture.backend.finishRender).toBe(fixture.originalFinishRender);
    expect(fixture.renderer.copyFramebufferToTexture).not.toHaveBeenCalled();
  });

  it("keeps partial-boundary finishRender failure terminal and fences all encoded snapshots", async () => {
    const failure = new Error("partial boundary finishRender failure");
    const fixture = createFixture({ finishRender: () => { throw failure; } });
    const selection: AnatomyNativeBoundarySelection = {
      beforeFirstDraw: false,
      afterFirstDraw: true,
      beforeSecondDraw: false,
      afterSecondDraw: false,
    };
    const { selected, options } = drawBoundaryOptions(fixture, selection);
    const capture = runAnatomyNativeWebGpuDrawBoundaryCapture(options);
    const backend = invokeTwoSelectedDraws(fixture, selected);

    expect(fixture.renderer.copyFramebufferToTexture).toHaveBeenCalledTimes(1);
    expect(() => backend.finishRender(fixture.renderContext)).toThrow(failure);
    expect(fixture.renderer.copyFramebufferToTexture).toHaveBeenCalledTimes(2);
    expect(await capture).toMatchObject({ reason: "native-finish-render-failed", finishRenderError: { message: failure.message } });
    expect(fixture.callbacks.awaitReadbacks).not.toHaveBeenCalled();
    expect(backend.draw).toBe(fixture.originalDraw);
    expect(backend.finishRender).toBe(fixture.originalFinishRender);

    fixture.queueFence.resolve(undefined);
    expect(await fixture.resourceRelease.promise).toMatchObject({
      temporaryFramebufferTextureCount: 2,
      temporaryFramebufferTextureDisposeCount: 2,
      temporaryFramebufferTextureDisposeEventsPerResource: [1, 1],
      copyState: "encoded",
      submissionState: "unknown",
      readbackState: "not-started",
      queueFenceOutcome: "queue-completed",
      noBorrowedResourceDisposed: true,
    });
    expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(1);
  });

  it("waits for selected partial snapshots to settle before cancellation cleanup", async () => {
    stubReadbackApi();
    const map = deferred<void>();
    let active = true;
    const fixture = createFixture({ mapAsync: () => map.promise });
    const { selected, options } = drawBoundaryOptions(fixture, {
      beforeFirstDraw: true,
      afterFirstDraw: false,
      beforeSecondDraw: false,
      afterSecondDraw: false,
    });
    const capture = runAnatomyNativeWebGpuDrawBoundaryCapture({
      ...options,
      isCaptureActive: () => active,
    });
    const backend = invokeTwoSelectedDraws(fixture, selected);
    expect(() => backend.finishRender(fixture.renderContext)).not.toThrow();
    expect(fixture.renderer.copyFramebufferToTexture).toHaveBeenCalledTimes(2);
    expect(backend.draw).toBe(fixture.originalDraw);
    expect(backend.finishRender).toBe(fixture.originalFinishRender);
    expect(fixture.backend.device.createBuffer).toHaveBeenCalledTimes(2);
    expect(fixture.callbacks.onResourcesReleased).not.toHaveBeenCalled();

    active = false;
    map.resolve(undefined);
    await expect(capture).rejects.toThrow("renderer-generation-retired");
    expect(await fixture.resourceRelease.promise).toMatchObject({
      temporaryFramebufferTextureCount: 2,
      temporaryFramebufferTextureDisposeCount: 2,
      temporaryFramebufferTextureDisposeEventsPerResource: [1, 1],
      readbackBufferCount: 2,
      readbackBufferDestroyCount: 2,
      submissionState: "confirmed",
      readbackState: "settled",
      noBorrowedResourceDisposed: true,
    });
    expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(1);
  });

  it("waits for confirmed device loss if the queue fence rejects", async () => {
    const fixture = createFixture({ finishRender: () => { throw new Error("injected finishRender failure"); } });
    const capture = runAnatomyNativeWebGpuFinalFrameCapture(finalFrameOptions(fixture));
    const backend = fixture.backend as unknown as { finishRender: (context: object) => unknown };
    expect(() => backend.finishRender(fixture.renderContext)).toThrow("injected finishRender failure");
    expect(await capture).toMatchObject({ reason: "native-finish-render-failed" });

    fixture.queueFence.reject(new Error("device removed during queue fence"));
    await Promise.resolve();
    expect(fixture.callbacks.onResourcesReleased).not.toHaveBeenCalled();
    fixture.deviceLost.resolve({ reason: "destroyed" });
    expect(await fixture.resourceRelease.promise).toMatchObject({
      submissionState: "unknown",
      queueFenceOutcome: "device-lost",
      temporaryFramebufferTextureDisposeCount: 1,
    });
    expect(fixture.callbacks.onResourcesReleased).toHaveBeenCalledTimes(1);
  });
});
