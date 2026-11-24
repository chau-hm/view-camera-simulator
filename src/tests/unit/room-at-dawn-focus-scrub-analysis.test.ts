import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { analyzeRegisteredRoiSamples, comparisonStatus } = require(
  "../../../experiments/room-at-dawn/analyze-focus-scrub.cjs",
) as {
  analyzeRegisteredRoiSamples: (samples: unknown[]) => {
    status: string;
    discontinuities: unknown[];
  };
  comparisonStatus: (metrics: Record<string, number>, equivalentState: boolean) => {
    status: string;
  };
};

type RegionSample = {
  regionId: string;
  focusMm: number;
  valid: true;
  signedCoCMm: number;
  predicted: { positionPx: { x: number; y: number }; edgeSpreadPx: number };
  observed: { positionPx: { x: number; y: number }; edgeSpreadPx: number };
};

const makeSamples = (observedOverrides: Partial<RegionSample>[] = []): RegionSample[] => {
  const predicted = [
    { focusMm: 1000, x: 120, blurPx: 5.5, cocMm: -0.4 },
    { focusMm: 1400, x: 122, blurPx: 2.5, cocMm: -0.2 },
    { focusMm: 1800, x: 125, blurPx: 0.6, cocMm: 0 },
    { focusMm: 2200, x: 127, blurPx: 2.1, cocMm: 0.2 },
    { focusMm: 2600, x: 130, blurPx: 4.8, cocMm: 0.4 },
  ];
  return predicted.map((point, index) => {
    const overrides = observedOverrides[index] || {};
    return {
      regionId: "fixture-edge-a",
      focusMm: point.focusMm,
      valid: true,
      signedCoCMm: point.cocMm,
      predicted: { positionPx: { x: point.x, y: 72 }, edgeSpreadPx: point.blurPx },
      observed: { positionPx: { x: point.x + 0.2, y: 72.1 }, edgeSpreadPx: point.blurPx + 0.2 },
      ...overrides,
    };
  });
};

describe("Room-at-Dawn Focus scrub evidence analysis", () => {
  it("accepts smooth focus breathing and a focus-centered sharpness peak", () => {
    const result = analyzeRegisteredRoiSamples(makeSamples());

    expect(result.status).toBe("registered-roi-residual-continuous");
    expect(result.discontinuities).toEqual([]);
  });

  it("flags an abrupt local reversal after registration to the canonical projection", () => {
    const samples = makeSamples();
    samples[2] = {
      ...samples[2],
      observed: { positionPx: { x: samples[2].predicted.positionPx.x + 8, y: 72.1 }, edgeSpreadPx: 8.6 },
    };

    const result = analyzeRegisteredRoiSamples(samples);

    expect(result.status).toBe("registered-roi-discontinuity-candidate");
    expect(result.discontinuities).toHaveLength(2);
  });

  it("rejects pixel equality when the paired camera states differ", () => {
    expect(comparisonStatus({ meanAbsoluteRgb8: 0, p99MeanChannelDifference: 0 }, false).status)
      .toBe("rejected");
  });
});
