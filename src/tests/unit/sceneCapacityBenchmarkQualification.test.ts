import { describe, expect, it } from "vitest";
import { classifyGraphicsBackend } from "../../render/sceneCapacityBenchmarkQualification";

describe("classifyGraphicsBackend", () => {
  it.each([
    "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0)))",
    "llvmpipe (LLVM 17.0.6, 256 bits)",
    "Software Rasterizer",
  ])("recognizes %s as a known software renderer", (renderer) => {
    const result = classifyGraphicsBackend({
      renderer,
      profilingBackend: "cpu-fallback",
      timingUnit: "cpu-submit-ms",
    });

    expect(result.softwareRendererDetected).toBe(true);
    expect(result.hardwareRendererQualified).toBe(false);
    expect(result.gpuTimingQualified).toBe(false);
  });

  it.each([
    "ANGLE Metal Renderer: Apple M4",
    "ANGLE (NVIDIA, D3D11: NVIDIA GeForce RTX 4070)",
    "A future renderer string",
  ])("treats %s as a hardware candidate", (renderer) => {
    const result = classifyGraphicsBackend({
      renderer,
      profilingBackend: "gpu-query",
      timingUnit: "gpu-ms",
    });

    expect(result.softwareRendererDetected).toBe(false);
    expect(result.hardwareRendererQualified).toBe(true);
    expect(result.gpuTimingQualified).toBe(true);
  });

  it("keeps renderer qualification separate from GPU timing qualification", () => {
    const result = classifyGraphicsBackend({
      renderer: "ANGLE Metal Renderer: Apple M4",
      profilingBackend: "cpu-fallback",
      timingUnit: "cpu-submit-ms",
    });

    expect(result.hardwareRendererQualified).toBe(true);
    expect(result.gpuTimingQualified).toBe(false);
  });

  it("does not qualify an unavailable renderer", () => {
    const result = classifyGraphicsBackend({
      renderer: null,
      profilingBackend: "gpu-query",
      timingUnit: "gpu-ms",
    });

    expect(result.hardwareRendererQualified).toBe(false);
    expect(result.gpuTimingQualified).toBe(true);
  });
});
