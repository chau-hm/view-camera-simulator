import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyAnatomyGpuCaptureFeasibility,
  compareAnatomyGpuSamples,
  convertLinearRgbaToSrgb,
  convertSrgbRgbaToLinear,
  predictNormalSourceOver,
  summarizeAnatomyGpuDrawResponse,
  unpackAnatomyGpuRgbaReadbackRows,
} from "../../render/backend/anatomyGpuBlendIntermediate";

describe("Anatomy GPU blend-intermediate evidence", () => {
  it("classifies direct WebGL draw reads, WebGPU replay proxies, and unsupported boundaries", () => {
    expect(classifyAnatomyGpuCaptureFeasibility(
      { rendererFamily: "webgl-renderer", executionBackend: "webgl2" },
      "draw-boundary",
    ).classification).toBe("F1");
    expect(classifyAnatomyGpuCaptureFeasibility(
      { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" },
      "draw-boundary",
    )).toMatchObject({ classification: "F0", reason: expect.stringContaining("no public readback boundary") });
    expect(classifyAnatomyGpuCaptureFeasibility(
      { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" },
      "single-renderable-replay",
    ).classification).toBe("F2");
    expect(classifyAnatomyGpuCaptureFeasibility(
      { rendererFamily: "webgpu-renderer", executionBackend: "webgl2-fallback" },
      "single-renderable-replay",
    ).classification).toBe("F0");
  });

  it("refuses comparisons across different RGB representations and retains alpha separately", () => {
    const mismatch = compareAnatomyGpuSamples(
      { representation: "linear-working-rgba32f-straight-alpha", samples: [[0.5, 0.25, 0.1, 0.16]] },
      { representation: "srgb-encoded-rgba32f-straight-alpha", samples: [[0.5, 0.25, 0.1, 0.16]] },
    );
    expect(mismatch).toMatchObject({ compatible: false, sampleCount: 0, meanAbsoluteRgbDifference: null });

    const matched = compareAnatomyGpuSamples(
      { representation: "linear-working-rgba32f-straight-alpha", samples: [[0.5, 0.25, 0.1, 0.16]] },
      { representation: "linear-working-rgba32f-straight-alpha", samples: [[0.4, 0.25, 0.2, 0.20]] },
    );
    expect(matched).toMatchObject({ compatible: true, sampleCount: 1 });
    expect(matched.meanAbsoluteRgbDifference).toBeCloseTo(0.0666667, 6);
    expect(matched.meanAbsoluteAlphaDifference).toBeCloseTo(0.04, 6);
  });

  it("applies the sRGB OETF to RGB without changing straight alpha", () => {
    expect(convertLinearRgbaToSrgb([0, 0.0031308, 1, 0.16])).toEqual([
      0,
      expect.closeTo(0.0404499, 6),
      expect.closeTo(1, 6),
      0.16,
    ]);
    expect(convertSrgbRgbaToLinear(convertLinearRgbaToSrgb([0.18, 0.5, 0.8, 0.16]))).toEqual([
      expect.closeTo(0.18, 8),
      expect.closeTo(0.5, 8),
      expect.closeTo(0.8, 8),
      0.16,
    ]);
  });

  it("summarizes only the preselected mask and picks threshold samples in deterministic order", () => {
    const before = new Uint8Array([
      10, 20, 30, 255,
      10, 20, 30, 255,
      10, 20, 30, 255,
    ]);
    const after = new Uint8Array([
      18, 20, 30, 255,
      11, 20, 30, 255,
      10, 20, 30, 255,
    ]);
    expect(summarizeAnatomyGpuDrawResponse(before, after, [2, 0, 1], 8, 2)).toEqual({
      sampleCount: 3,
      changedPixelCount: 2,
      thresholdPixelCount: 1,
      meanAbsoluteRgbDifference: 1,
      meanAbsoluteAlphaDifference: 0,
      maxAbsoluteRgbChannelDifference: 8,
      selectedPixelIndices: [0],
    });
    expect(() => summarizeAnatomyGpuDrawResponse(before, after, [3])).toThrow(/out-of-range/);
  });

  it("predicts the explicitly selected source-over equation", () => {
    expect(predictNormalSourceOver(
      [0.75, 0.25, 0.1, 0.25],
      [0.2, 0.1, 0.05, 0.4],
    )).toEqual([0.3375, 0.1375, 0.0625, 0.55]);
  });

  it("removes r186 WebGPU's 256-byte row padding from byte and float RGBA readbacks", () => {
    const byteRows = new Uint8Array(260);
    byteRows.set([1, 2, 3, 4], 0);
    byteRows.set([5, 6, 7, 8], 256);
    expect(unpackAnatomyGpuRgbaReadbackRows(byteRows, 1, 2)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

    const floatRows = new Float32Array(68);
    floatRows.set([0.1, 0.2, 0.3, 0.4], 0);
    floatRows.set([0.5, 0.6, 0.7, 0.8], 64);
    expect(unpackAnatomyGpuRgbaReadbackRows(floatRows, 1, 2)).toEqual(new Float32Array([
      0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8,
    ]));
    expect(() => unpackAnatomyGpuRgbaReadbackRows(new Uint8Array(4), 1, 2)).toThrow(/truncated/);
  });

  it("keeps the committed decision aligned with its capture limits and promotion boundary", () => {
    const report = JSON.parse(readFileSync(resolve(
      process.cwd(),
      "docs/architecture/anatomy-gpu-blend-intermediate/report.json",
    ), "utf8")) as {
      audit: string;
      decision: string;
      decisionBasis: { promotionBoundary: string };
      captureFeasibility: { F0: { nativeDrawBoundary: string } };
      pairwiseExperiments: { status: string; pairwiseOverlapClaimed: boolean };
      remainingUnknowns: string[];
    };
    expect(report.audit).toBe("anatomy-gpu-blend-intermediate");
    expect(report.decision).toBe("G2");
    expect(report.decisionBasis.promotionBoundary).toContain("M2 — OPT-IN IMPLEMENTATION INCOMPLETE");
    expect(report.captureFeasibility.F0.nativeDrawBoundary).toContain("no public readback boundary");
    expect(report.pairwiseExperiments).toMatchObject({ status: "not-run", pairwiseOverlapClaimed: false });
    expect(report.remainingUnknowns.some((item) => item.includes("actual-draw source fragments"))).toBe(true);
  });
});
