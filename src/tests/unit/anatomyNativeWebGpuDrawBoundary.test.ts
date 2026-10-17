import { describe, expect, it } from "vitest";
import {
  anatomyNativeFramebufferSamples,
  anatomyNativeFramebufferTexelToRgba,
  classifyAnatomyNativeDrawBoundary,
  describeAnatomyNativeDrawCommands,
} from "../../render/backend/anatomyNativeWebGpuDrawBoundary";

const nativeRuntime = { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" } as const;

describe("Anatomy native WebGPU draw-boundary qualification", () => {
  it("only proposes pass segmentation for the pinned native r186 runtime", () => {
    expect(classifyAnatomyNativeDrawBoundary(nativeRuntime, "186").classification).toBe("F1");
    expect(classifyAnatomyNativeDrawBoundary(nativeRuntime, "187").classification).toBe("F0");
    expect(classifyAnatomyNativeDrawBoundary(
      { rendererFamily: "webgpu-renderer", executionBackend: "webgl2-fallback" },
      "186",
    ).classification).toBe("F0");
    expect(classifyAnatomyNativeDrawBoundary(
      { rendererFamily: "webgl-renderer", executionBackend: "webgl2" },
      "186",
    ).classification).toBe("F0");
  });

  it("describes one ordinary native command and fails closed for grouped commands", () => {
    const direct = describeAnatomyNativeDrawCommands({
      object: { geometry: { index: new Uint16Array([0, 1, 2]) } },
      getDrawParameters: () => ({ vertexCount: 3 }),
      getIndirect: () => null,
    });
    expect(direct).toMatchObject({ supported: true, commandCount: 1, kind: "draw-indexed", reason: null });

    const batched = describeAnatomyNativeDrawCommands({
      object: { isBatchedMesh: true, _multiDrawCount: 2 },
      getDrawParameters: () => ({ vertexCount: 6 }),
      getIndirect: () => null,
    });
    expect(batched).toMatchObject({ supported: false, commandCount: 2, kind: "batched" });

    const indirect = describeAnatomyNativeDrawCommands({
      object: { geometry: { index: null } },
      getDrawParameters: () => ({ vertexCount: 6 }),
      getIndirect: () => ({}),
      getIndirectOffset: () => [0, 16],
    });
    expect(indirect).toMatchObject({ supported: false, commandCount: 2, kind: "draw-indirect" });
  });

  it("rejects bundles, array cameras, and missing draw metadata", () => {
    const common = {
      object: { geometry: { index: null } },
      getDrawParameters: () => ({ vertexCount: 3 }),
      getIndirect: () => null,
    };
    expect(describeAnatomyNativeDrawCommands({ ...common, bundle: {} }).supported).toBe(false);
    expect(describeAnatomyNativeDrawCommands({ ...common, camera: { isArrayCamera: true } }).kind)
      .toBe("array-camera");
    expect(describeAnatomyNativeDrawCommands({ ...common, getDrawParameters: () => null }).supported).toBe(false);
  });

  it("normalizes BGRA attachment bytes and rejects unsupported formats", () => {
    expect(anatomyNativeFramebufferTexelToRgba(new Uint8Array([9, 8, 7, 6]), "bgra8unorm"))
      .toEqual([7, 8, 9, 6]);
    expect(anatomyNativeFramebufferTexelToRgba(new Uint8Array([9, 8, 7, 6]), "rgba8unorm"))
      .toEqual([9, 8, 7, 6]);
    expect(() => anatomyNativeFramebufferTexelToRgba(new Uint8Array([0, 0, 0, 0]), "rgba16float"))
      .toThrow(/not four-channel 8-bit normalized color/);
  });

  it("samples fixed framebuffer positions from a compact copied rectangle", () => {
    const samples = anatomyNativeFramebufferSamples(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      4,
      { x: 1, y: 2, width: 2, height: 1 },
      "bgra8unorm",
      [9, 10],
    );
    expect(samples).toEqual([
      { index: 9, x: 1, y: 2, rgba: [3, 2, 1, 4] },
      { index: 10, x: 2, y: 2, rgba: [7, 6, 5, 8] },
    ]);
    expect(() => anatomyNativeFramebufferSamples(
      new Uint8Array(8), 4, { x: 1, y: 2, width: 2, height: 1 }, "bgra8unorm", [4],
    )).toThrow(/outside the copied native framebuffer region/);
  });
});
