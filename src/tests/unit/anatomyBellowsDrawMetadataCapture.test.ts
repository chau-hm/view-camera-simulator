import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAnatomyBellowsDrawMetadataCapture } from "../../render/backend/anatomyBellowsDrawMetadataCapture";
import { linkObserverOutputSourceMaterial } from "../../render/backend/observerMaterialOutputIdentity";
import {
  installMInv8NativePipelineObserverInRealm,
  M_INV8_NATIVE_PIPELINE_OBSERVER_KEY,
} from "../../render/backend/anatomyBellowsNativePipelineEvidence";

const runtime = {
  rendererFamily: "webgl-renderer",
  executionBackend: "webgl2",
} as const;

const makeCapture = (renderer: unknown, selected: THREE.Mesh, isCaptureActive = () => true) => {
  let cleanup: (() => void) | null = null;
  const promise = runAnatomyBellowsDrawMetadataCapture({
    renderer: renderer as never,
    runtime,
    generation: 3,
    generationIdentity: {},
    selected,
    sourceMaterialId: (selected.material as THREE.Material).uuid,
    isCaptureActive,
    registerCleanup: (next) => {
      cleanup = next;
      return () => { cleanup = null; };
    },
  });
  return { promise, runCleanup: () => cleanup?.() };
};

const makeFakeGl = () => {
  const parameters = new Map<number, number | boolean>([
    [13, 770], [14, 771], [15, 32774], [16, 770], [17, 771], [18, 32774], [19, true], [20, 513],
  ]);
  const gl = {
    BLEND: 1,
    DEPTH_TEST: 2,
    BLEND_SRC_RGB: 13,
    BLEND_DST_RGB: 14,
    BLEND_EQUATION_RGB: 15,
    BLEND_SRC_ALPHA: 16,
    BLEND_DST_ALPHA: 17,
    BLEND_EQUATION_ALPHA: 18,
    DEPTH_WRITEMASK: 19,
    DEPTH_FUNC: 20,
    STENCIL_TEST: 3,
    isEnabled: vi.fn((capability: number) => capability === 1 || capability === 2),
    getParameter: vi.fn((parameter: number) => parameters.get(parameter) ?? 0),
    drawElements: vi.fn(),
    drawArrays: vi.fn(),
    drawElementsInstanced: vi.fn(),
    drawArraysInstanced: vi.fn(),
  };
  return gl;
};

const makeNativePipelineFixture = async (generation: number, descriptor: Readonly<Record<string, unknown>>) => {
  const gpuPipeline = {};
  const pipelineKey = {};
  const device = {
    createRenderPipeline: vi.fn((...args: unknown[]) => { void args; return gpuPipeline; }),
    createRenderPipelineAsync: vi.fn(async (...args: unknown[]) => { void args; return gpuPipeline; }),
    lost: new Promise<never>(() => undefined),
  };
  const adapter = { requestDevice: vi.fn(async () => device) };
  const gpu = { requestAdapter: vi.fn(async () => adapter) };
  const realm = { navigator: { gpu } };
  const generationIdentity = {};
  const observer = installMInv8NativePipelineObserverInRealm(realm as never);
  if (!observer) throw new Error("Native pipeline observer did not install in the test realm");
  await gpu.requestAdapter();
  await adapter.requestDevice();
  if (!observer.attachDevice(device, generation, generationIdentity)) throw new Error("Native pipeline observer did not attach to the test device");
  Object.defineProperty(window, M_INV8_NATIVE_PIPELINE_OBSERVER_KEY, { configurable: true, value: observer });
  nativeObservers.push({ observer, device, generation, generationIdentity });
  device.createRenderPipeline(descriptor);
  const data = new WeakMap<object, Readonly<{ pipeline?: object; error?: boolean }>>();
  data.set(pipelineKey, { pipeline: gpuPipeline, error: false });
  const backend = {
    device,
    data,
    utils: {
      getCurrentColorFormats: vi.fn(() => ["bgra8unorm"]),
      getCurrentDepthStencilFormat: vi.fn(() => undefined),
      getSampleCountRenderContext: vi.fn(() => 1),
    },
    draw: vi.fn((_renderObject: unknown, info: { render: { drawCalls: number }; [key: string]: unknown }) => {
      info.render.drawCalls += 1;
      return "draw-complete";
    }),
    finishRender: vi.fn(),
  };
  return { backend, pipelineKey, observer, device, gpuPipeline, data, generationIdentity };
};

const pipelineDescriptor = (blend?: Readonly<Record<string, unknown>>) => ({
  fragment: { targets: [{ format: "bgra8unorm", ...(blend ? { blend } : {}), writeMask: 15 }] },
  multisample: { count: 1, alphaToCoverageEnabled: false, mask: 0xffffffff },
  primitive: { topology: "triangle-list", frontFace: "ccw", cullMode: "back" },
});

const expectR187FailClosed = (
  result: Awaited<ReturnType<typeof runAnatomyBellowsDrawMetadataCapture>>,
) => {
  expect(THREE.REVISION).toBe("187");
  expect(result).toMatchObject({ status: "ok", feasibility: "F0", drawCount: 1 });
  expect(result.drawObservations).toMatchObject([{
    gpuBlendEnabled: null,
    gpuBlendDescriptor: null,
    nativePipelineBlendQualification: {
      status: "unsupported",
      reason: "unsupported-three-revision",
    },
  }]);
};

const nativeObservers: Array<Readonly<{
  observer: { restoreDevice: (device: object, generation: number, generationIdentity: object) => boolean; restoreAll: () => void };
  device: object;
  generation: number;
  generationIdentity: object;
}>> = [];

afterEach(() => {
  for (const { observer, device, generation, generationIdentity } of nativeObservers.splice(0)) {
    observer.restoreDevice(device, generation, generationIdentity);
    observer.restoreAll();
  }
  delete (window as unknown as Record<string, unknown>)[M_INV8_NATIVE_PIPELINE_OBSERVER_KEY];
});

describe("Anatomy Bellows metadata-only draw capture", () => {
  it("records both actual WebGL face passes and restores wrappers without framebuffer reads", async () => {
    const source = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16, side: THREE.DoubleSide });
    const selected = new THREE.Mesh(new THREE.BufferGeometry(), source);
    const gl = makeFakeGl();
    const renderer: {
      getContext: () => ReturnType<typeof makeFakeGl>;
      renderBufferDirect: (...args: unknown[]) => unknown;
      render: () => void;
    } = {
      getContext: () => gl,
      renderBufferDirect: (...args: unknown[]) => { gl.drawElements(4, 240, 5123, 0); return args; },
      render: () => {
        source.side = THREE.BackSide;
        renderer.renderBufferDirect!(null, null, null, source, selected);
        source.side = THREE.FrontSide;
        renderer.renderBufferDirect!(null, null, null, source, selected);
        source.side = THREE.DoubleSide;
      },
    };
    const originalRender = renderer.render;
    const originalRenderBufferDirect = renderer.renderBufferDirect;
    const originalDrawElements = gl.drawElements;
    const capture = makeCapture(renderer, selected);

    (renderer.render as () => void)();
    const result = await capture.promise;
    expect(result).toMatchObject({ status: "ok", feasibility: "F1", drawCount: 2 });
    expect(result.readbackStarted).toBe(false);
    expect(result.framebufferCopyStarted).toBe(false);
    expect(result.drawObservations).toMatchObject([
      { command: "drawElements", material: { side: THREE.BackSide, opacity: 0.16, transparent: true } },
      { command: "drawElements", material: { side: THREE.FrontSide, opacity: 0.16, transparent: true } },
    ]);
    expect(renderer.render).toBe(originalRender);
    expect(renderer.renderBufferDirect).toBe(originalRenderBufferDirect);
    expect(gl.drawElements).toBe(originalDrawElements);
    source.dispose();
    selected.geometry.dispose();
  });

  it("keeps the r186 native blend evidence fail-closed on r187 without copying or readback", async () => {
    const source = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16, side: THREE.DoubleSide });
    const activeOutput = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16, side: THREE.BackSide });
    linkObserverOutputSourceMaterial(activeOutput, source);
    const selected = new THREE.Mesh(new THREE.BufferGeometry(), activeOutput);
    const context = {};
    const fixture = await makeNativePipelineFixture(7, pipelineDescriptor({
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    }));
    const { backend } = fixture;
    expect(fixture.observer.read(fixture.device, fixture.gpuPipeline, 7, fixture.generationIdentity)).toMatchObject({ status: "observed" });
    backend.finishRender.mockReturnValue("finish-complete");
    const renderer = { backend };
    const originalDraw = backend.draw;
    const originalFinish = backend.finishRender;
    const capture = runAnatomyBellowsDrawMetadataCapture({
      renderer: renderer as never,
      runtime: { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" },
      generation: 7,
      generationIdentity: fixture.generationIdentity,
      selected,
      sourceMaterialId: source.uuid,
      isCaptureActive: () => true,
      registerCleanup: () => () => undefined,
    });
    backend.draw({
      object: selected,
      material: activeOutput,
      context,
      getIndex: () => ({ count: 240 }),
      getDrawParameters: () => ({ indexCount: 240, firstIndex: 0, instanceCount: 1 }),
      pipeline: fixture.pipelineKey,
      passId: "front",
    }, { count: 240, render: { drawCalls: 0 } });
    backend.finishRender(context);

    const result = await capture;
    expectR187FailClosed(result);
    expect(result.readbackStarted).toBe(false);
    expect(result.framebufferCopyStarted).toBe(false);
    expect(result.drawObservations).toMatchObject([{
      command: "drawIndexed",
      sourceMaterialId: source.uuid,
      material: { id: activeOutput.uuid, side: THREE.BackSide, opacity: 0.16 },
      drawParameters: { indexCount: 240, instanceCount: 1 },
      nativeDrawExecution: { backendDrawReturned: true, completed: true },
    }]);
    expect(backend.draw).toBe(originalDraw);
    expect(backend.finishRender).toBe(originalFinish);
    source.dispose();
    activeOutput.dispose();
    selected.geometry.dispose();
  });

  it("rejects r186 native qualification on r187 even when a descriptor is unavailable", async () => {
    const source = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16 });
    const activeOutput = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16 });
    activeOutput.blending = THREE.NoBlending;
    linkObserverOutputSourceMaterial(activeOutput, source);
    const selected = new THREE.Mesh(new THREE.BufferGeometry(), activeOutput);
    const context = {};
    const backend = {
      draw: vi.fn((...args: unknown[]) => { void args; }),
      finishRender: vi.fn((...args: unknown[]) => { void args; }),
    };
    const capture = runAnatomyBellowsDrawMetadataCapture({
      renderer: { backend } as never,
      runtime: { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" },
      generation: 8,
      generationIdentity: {},
      selected,
      sourceMaterialId: source.uuid,
      isCaptureActive: () => true,
      registerCleanup: () => () => undefined,
    });
    backend.draw({ object: selected, material: activeOutput, context }, {});
    backend.finishRender(context);

    const result = await capture;
    expectR187FailClosed(result);
    expect(result.drawObservations).toMatchObject([{
      material: { blending: THREE.NoBlending },
    }]);
    source.dispose();
    activeOutput.dispose();
    selected.geometry.dispose();
  });

  it("does not accept an r186 blend descriptor that contradicts material flags on r187", async () => {
    const source = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16 });
    const activeOutput = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16, blending: THREE.NoBlending });
    linkObserverOutputSourceMaterial(activeOutput, source);
    const selected = new THREE.Mesh(new THREE.BufferGeometry(), activeOutput);
    const context = {};
    const fixture = await makeNativePipelineFixture(9, pipelineDescriptor({
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    }));
    const capture = runAnatomyBellowsDrawMetadataCapture({
      renderer: { backend: fixture.backend } as never,
      runtime: { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" },
      generation: 9,
      generationIdentity: fixture.generationIdentity,
      selected,
      sourceMaterialId: source.uuid,
      isCaptureActive: () => true,
      registerCleanup: () => () => undefined,
    });
    fixture.backend.draw({ object: selected, material: activeOutput, context, pipeline: fixture.pipelineKey }, { render: { drawCalls: 0 } });
    fixture.backend.finishRender(context);
    const result = await capture;
    expectR187FailClosed(result);
    expect(result.drawObservations).toMatchObject([{
      effectiveMaterialState: { blending: THREE.NoBlending },
    }]);
    source.dispose();
    activeOutput.dispose();
    selected.geometry.dispose();
  });

  it("does not reuse an r186 descriptor association as r187 qualification", async () => {
    const source = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16 });
    const activeOutput = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16 });
    linkObserverOutputSourceMaterial(activeOutput, source);
    const selected = new THREE.Mesh(new THREE.BufferGeometry(), activeOutput);
    const context = {};
    const fixture = await makeNativePipelineFixture(10, pipelineDescriptor({
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    }));
    fixture.data.set(fixture.pipelineKey, { pipeline: {}, error: false });
    const capture = runAnatomyBellowsDrawMetadataCapture({
      renderer: { backend: fixture.backend } as never,
      runtime: { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" },
      generation: 10,
      generationIdentity: fixture.generationIdentity,
      selected,
      sourceMaterialId: source.uuid,
      isCaptureActive: () => true,
      registerCleanup: () => () => undefined,
    });
    fixture.backend.draw({ object: selected, material: activeOutput, context, pipeline: fixture.pipelineKey }, { render: { drawCalls: 0 } });
    fixture.backend.finishRender(context);
    const result = await capture;
    expectR187FailClosed(result);
    source.dispose();
    activeOutput.dispose();
    selected.geometry.dispose();
  });

  it("settles synchronously on a draw exception, preserves it, and restores hooks", async () => {
    const source = new THREE.MeshStandardMaterial();
    const selected = new THREE.Mesh(new THREE.BufferGeometry(), source);
    const gl = makeFakeGl();
    const failure = new Error("renderer draw failed");
    const renderer: {
      getContext: () => ReturnType<typeof makeFakeGl>;
      renderBufferDirect: (...args: unknown[]) => unknown;
      render: () => void;
    } = {
      getContext: () => gl,
      renderBufferDirect: () => gl.drawElements(4, 240, 5123, 0),
      render: () => {
        renderer.renderBufferDirect!(null, null, null, source, selected);
        throw failure;
      },
    };
    const originalRender = renderer.render;
    const originalDraw = gl.drawElements;
    const capture = makeCapture(renderer, selected);
    expect(() => (renderer.render as () => void)()).toThrow(failure);
    await expect(capture.promise).resolves.toMatchObject({ status: "failed", reason: "renderer draw failed" });
    expect(renderer.render).toBe(originalRender);
    expect(gl.drawElements).toBe(originalDraw);
    source.dispose();
    selected.geometry.dispose();
  });

  it("restores native hooks and suppresses evidence when the generation is retired", async () => {
    const source = new THREE.MeshStandardMaterial();
    const selected = new THREE.Mesh(new THREE.BufferGeometry(), source);
    const backend = { draw: vi.fn(), finishRender: vi.fn() };
    const renderer = { backend };
    const originalDraw = backend.draw;
    const originalFinish = backend.finishRender;
    const cleanup = { current: null as (() => void) | null };
    const capture = runAnatomyBellowsDrawMetadataCapture({
      renderer: renderer as never,
      runtime: { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" },
      generation: 11,
      generationIdentity: {},
      selected,
      sourceMaterialId: source.uuid,
      isCaptureActive: () => false,
      registerCleanup: (callback) => {
        cleanup.current = callback;
        return () => { cleanup.current = null; };
      },
    });
    cleanup.current?.();
    await expect(capture).resolves.toMatchObject({ status: "cancelled", drawCount: 0 });
    expect(backend.draw).toBe(originalDraw);
    expect(backend.finishRender).toBe(originalFinish);
    source.dispose();
    selected.geometry.dispose();
  });
});
