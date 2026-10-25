import { describe, expect, it } from "vitest";
import { classifyGroundGlassWebGpuRuntime } from "../../render/webgpu/groundGlassWebGpuRuntime";

const generation = { generationId: "generation-1", channelId: "default" } as const;

describe("Ground Glass mounted WebGPU runtime evidence", () => {
  it("requires initialized WebGPURenderer and native backend evidence", () => {
    expect(classifyGroundGlassWebGpuRuntime(generation, {
      rendererIsWebGpu: true,
      backendIsWebGpu: true,
      backendIsWebGl: false,
    })).toEqual({
      status: "mounted",
      generation,
      rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgpu",
      internalFallback: "none",
    });
  });

  it("distinguishes WebGPURenderer using the internal WebGL2 backend", () => {
    expect(classifyGroundGlassWebGpuRuntime(generation, {
      rendererIsWebGpu: true,
      backendIsWebGpu: false,
      backendIsWebGl: true,
    })).toEqual({
      status: "mounted",
      generation,
      rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgl2",
      internalFallback: "webgl2-compatibility",
    });
  });

  it("does not treat browser or backend capability alone as mounted renderer evidence", () => {
    expect(classifyGroundGlassWebGpuRuntime(generation, {
      rendererIsWebGpu: false,
      backendIsWebGpu: true,
      backendIsWebGl: false,
    })).toEqual({ status: "unknown" });
    expect(classifyGroundGlassWebGpuRuntime(generation, {
      rendererIsWebGpu: true,
      backendIsWebGpu: false,
      backendIsWebGl: false,
    })).toEqual({ status: "unknown" });
  });
});
