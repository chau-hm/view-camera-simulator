import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { runAnatomyGpuBlendCalibration } from "../../render/backend/anatomyGpuBlendCalibration";

const runtime = { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" } as const;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const makeRenderer = (readback: Promise<ArrayBufferView>) => {
  const calls = { renders: 0, clears: 0, reads: 0, targetChanges: 0 };
  let activeTarget: THREE.RenderTarget | null = null;
  const renderer = {
    getRenderTarget: () => activeTarget,
    setRenderTarget: (target: THREE.RenderTarget | null) => {
      calls.targetChanges += 1;
      activeTarget = target;
    },
    getClearColor: (target: THREE.Color) => target.set(0.1, 0.2, 0.3),
    getClearAlpha: () => 0.75,
    setClearColor: () => undefined,
    getViewport: (target: THREE.Vector4) => target.set(2, 3, 40, 50),
    setViewport: () => undefined,
    getScissor: (target: THREE.Vector4) => target.set(4, 5, 20, 30),
    setScissor: () => undefined,
    getScissorTest: () => true,
    setScissorTest: () => undefined,
    clear: () => { calls.clears += 1; },
    render: () => { calls.renders += 1; },
    readRenderTargetPixelsAsync: () => {
      calls.reads += 1;
      return readback;
    },
  };
  return { renderer, calls, activeTarget: () => activeTarget };
};

describe("Anatomy GPU blend calibration cancellation", () => {
  it("waits for a pending readback before disposing fixtures and starts no later fixture", async () => {
    const readback = deferred<ArrayBufferView>();
    const { renderer, calls, activeTarget } = makeRenderer(readback.promise);
    const controller = new AbortController();
    let released: Readonly<{ targetDisposeCount: number; geometryDisposeCount: number; materialDisposeCount: number }> | null = null;
    const calibration = runAnatomyGpuBlendCalibration(renderer, runtime, {
      signal: controller.signal,
      onResourcesReleased: (lifecycle) => { released = lifecycle; },
    });

    await Promise.resolve();
    expect(calls.reads).toBe(1);
    expect(calls.renders).toBe(1);
    expect(calls.clears).toBe(1);
    expect(activeTarget()).toBeNull();
    expect(released).toBeNull();

    controller.abort(new Error("probe-unmounted"));
    expect(released).toBeNull();
    readback.resolve(new Uint8Array([191, 64, 26, 255]));
    await expect(calibration).rejects.toMatchObject({ name: "Error", message: "probe-unmounted" });

    expect(calls).toEqual({ renders: 1, clears: 1, reads: 1, targetChanges: 2 });
    expect(released).toEqual({ targetDisposeCount: 2, geometryDisposeCount: 1, materialDisposeCount: 8 });
    expect(activeTarget()).toBeNull();
  });

  it("handles a readback rejection after invalidation without replacing the cancellation reason", async () => {
    const readback = deferred<ArrayBufferView>();
    const { renderer, calls } = makeRenderer(readback.promise);
    const controller = new AbortController();
    let released: Readonly<{ targetDisposeCount: number; geometryDisposeCount: number; materialDisposeCount: number }> | null = null;
    const calibration = runAnatomyGpuBlendCalibration(renderer, runtime, {
      signal: controller.signal,
      onResourcesReleased: (lifecycle) => { released = lifecycle; },
    });
    const result = expect(calibration).rejects.toMatchObject({ name: "Error", message: "renderer-generation-retired" });

    await Promise.resolve();
    controller.abort(new Error("renderer-generation-retired"));
    readback.reject(new Error("device lost while mapping buffer"));
    await result;

    expect(calls).toEqual({ renders: 1, clears: 1, reads: 1, targetChanges: 2 });
    expect(released).toEqual({ targetDisposeCount: 2, geometryDisposeCount: 1, materialDisposeCount: 8 });
  });
});
