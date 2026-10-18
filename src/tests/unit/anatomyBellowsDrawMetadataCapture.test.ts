import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { runAnatomyBellowsDrawMetadataCapture } from "../../render/backend/anatomyBellowsDrawMetadataCapture";
import { linkObserverOutputSourceMaterial } from "../../render/backend/observerMaterialOutputIdentity";

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

  it("records native selected draws and effective pipeline descriptors without copying or readback", async () => {
    const source = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16, side: THREE.DoubleSide });
    const activeOutput = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16, side: THREE.BackSide });
    linkObserverOutputSourceMaterial(activeOutput, source);
    const selected = new THREE.Mesh(new THREE.BufferGeometry(), activeOutput);
    const context = {};
    const backend = {
      draw: vi.fn((...args: unknown[]) => { void args; return "draw-complete"; }),
      finishRender: vi.fn((...args: unknown[]) => { void args; return "finish-complete"; }),
      pipelineUtils: {
        _getBlending: vi.fn(() => ({ color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" } })),
        _getDepthCompare: vi.fn(() => "less-equal"),
      },
    };
    const renderer = { backend };
    const originalDraw = backend.draw;
    const originalFinish = backend.finishRender;
    const capture = runAnatomyBellowsDrawMetadataCapture({
      renderer: renderer as never,
      runtime: { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" },
      generation: 7,
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
      pipeline: { id: 4 },
      passId: "front",
    }, { count: 240 });
    backend.finishRender(context);

    const result = await capture;
    expect(result).toMatchObject({ status: "ok", feasibility: "F1", drawCount: 1 });
    expect(result.readbackStarted).toBe(false);
    expect(result.framebufferCopyStarted).toBe(false);
    expect(result.drawObservations).toMatchObject([{
      command: "drawIndexed",
      sourceMaterialId: source.uuid,
      material: { id: activeOutput.uuid, side: THREE.BackSide, opacity: 0.16 },
      drawParameters: { indexCount: 240, instanceCount: 1 },
      gpuBlendDescriptor: { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" } },
      gpuDepthCompare: "less-equal",
    }]);
    expect(backend.draw).toBe(originalDraw);
    expect(backend.finishRender).toBe(originalFinish);
    source.dispose();
    activeOutput.dispose();
    selected.geometry.dispose();
  });

  it("records native NoBlending as a disabled pipeline blend without calling the blend mapper", async () => {
    const source = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16 });
    const activeOutput = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16 });
    activeOutput.blending = THREE.NoBlending;
    linkObserverOutputSourceMaterial(activeOutput, source);
    const selected = new THREE.Mesh(new THREE.BufferGeometry(), activeOutput);
    const context = {};
    const backend = {
      draw: vi.fn((...args: unknown[]) => { void args; }),
      finishRender: vi.fn((...args: unknown[]) => { void args; }),
      pipelineUtils: {
        _getBlending: vi.fn(() => { throw new Error("NoBlending has no blend descriptor"); }),
        _getDepthCompare: vi.fn(() => "less-equal"),
      },
    };
    const capture = runAnatomyBellowsDrawMetadataCapture({
      renderer: { backend } as never,
      runtime: { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" },
      generation: 8,
      selected,
      sourceMaterialId: source.uuid,
      isCaptureActive: () => true,
      registerCleanup: () => () => undefined,
    });
    backend.draw({ object: selected, material: activeOutput, context }, {});
    backend.finishRender(context);

    const result = await capture;
    expect(result).toMatchObject({ status: "ok", drawCount: 1 });
    expect(result.drawObservations).toMatchObject([{
      material: { blending: THREE.NoBlending },
      gpuBlendEnabled: false,
      gpuBlendDescriptor: null,
    }]);
    expect(backend.pipelineUtils._getBlending).not.toHaveBeenCalled();
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
