import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  runAnatomyNativeWebGpuDrawBoundaryCapture,
  runAnatomyNativeWebGpuFinalFrameCapture,
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
}> = {}) => {
  const queueFence = deferred<unknown>();
  const resourceRelease = deferred<Readonly<Record<string, unknown>>>();
  const releasedDetails: Readonly<Record<string, unknown>>[] = [];
  let finishRenderImplementation = options.finishRender;
  const originalFinishRender = vi.fn(() => finishRenderImplementation?.());
  const originalDraw = vi.fn(() => undefined);
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
        mapAsync: vi.fn().mockResolvedValue(undefined),
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

const drawBoundaryOptions = (fixture: ReturnType<typeof createFixture>) => {
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
