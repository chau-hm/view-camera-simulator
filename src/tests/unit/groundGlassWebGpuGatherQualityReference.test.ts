import { describe, expect, it } from "vitest";
import { requireGatherReferenceProbePair } from "../e2e/fixtures/ground-glass-webgpu-aperture-gather-cases";
import {
  GATHER_QUALITY_MATRIX,
  createSourceToGatherPixelCenterLookup,
  estimateGatherTargetMemory,
  gatherTexelAtSourcePixelCenter,
  summarizeMeasurements,
} from "../e2e/fixtures/ground-glass-webgpu-gather-quality-cases";

describe("Ground Glass WebGPU gather quality study helpers", () => {
  it("defines an independent full/half by 16/32/64 factorial matrix", () => {
    expect(GATHER_QUALITY_MATRIX).toHaveLength(6);
    for (const scale of [0.5, 1]) {
      expect(GATHER_QUALITY_MATRIX.filter((cell) => cell.gatherScale === scale).map((cell) => cell.sampleCount))
        .toEqual([16, 32, 64]);
    }
  });

  it("maps source pixel centers to nearest half-resolution gather texels without a half-texel bias", () => {
    const source = { widthPx: 128, heightPx: 96 };
    const half = { widthPx: 64, heightPx: 48 };
    expect(gatherTexelAtSourcePixelCenter([0, 0], source, half)).toEqual([0, 0]);
    expect(gatherTexelAtSourcePixelCenter([1, 1], source, half)).toEqual([0, 0]);
    expect(gatherTexelAtSourcePixelCenter([2, 2], source, half)).toEqual([1, 1]);
    expect(gatherTexelAtSourcePixelCenter([127, 95], source, half)).toEqual([63, 47]);
    const lookup = createSourceToGatherPixelCenterLookup(source, half);
    expect([lookup.x[0], lookup.y[0]]).toEqual([0, 0]);
    expect([lookup.x[2], lookup.y[2]]).toEqual([1, 1]);
    expect([lookup.x[127], lookup.y[95]]).toEqual([63, 47]);
    // An incorrect half-source-texel offset would shift source pixel 1 into texel 1.
    expect(lookup.x[1]).toBe(0);
    expect(Math.floor((1 * half.widthPx / source.widthPx) + 0.5)).toBe(1);
    expect(() => gatherTexelAtSourcePixelCenter([128, 0], source, half)).toThrow(RangeError);
  });

  it("reports a storage estimate that grows with target dimensions and gather scale", () => {
    const full = estimateGatherTargetMemory({ widthPx: 128, heightPx: 96 }, { widthPx: 128, heightPx: 96 });
    const half = estimateGatherTargetMemory({ widthPx: 128, heightPx: 96 }, { widthPx: 64, heightPx: 48 });
    const larger = estimateGatherTargetMemory({ widthPx: 256, heightPx: 192 }, { widthPx: 256, heightPx: 192 });
    expect(full.sourcePixels).toBe(12_288);
    expect(full.gatherPixels).toBe(full.sourcePixels);
    expect(half.gatherPixels).toBe(full.gatherPixels / 4);
    expect(full.estimatedBytes).toBeGreaterThan(half.estimatedBytes);
    expect(larger.estimatedBytes).toBeGreaterThan(full.estimatedBytes);
    expect(() => estimateGatherTargetMemory({ widthPx: 0, heightPx: 96 }, { widthPx: 1, heightPx: 1 })).toThrow(RangeError);
  });

  it("rejects a missing far or near probe instead of treating absent evidence as a pass", () => {
    expect(() => requireGatherReferenceProbePair([{ layer: "near" }])).toThrow("exactly one far");
    expect(() => requireGatherReferenceProbePair([{ layer: "far" }])).toThrow("exactly one near");
  });

  it("summarizes repeated timings without requiring a machine-specific threshold", () => {
    expect(summarizeMeasurements([5, 1, 3, 2, 4])).toMatchObject({
      count: 5,
      median: 3,
      mean: 3,
      min: 1,
      max: 5,
      p95: 5,
      range: 4,
      samples: [1, 2, 3, 4, 5],
    });
    expect(() => summarizeMeasurements([])).toThrow(RangeError);
  });
});
