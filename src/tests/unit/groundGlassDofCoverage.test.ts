import { describe, expect, it } from "vitest";
import {
  estimateNearLayerCoverage,
  nearCoverageProposalCompensation,
} from "../../render/groundGlassDofCoverage";

describe("Ground Glass near-layer coverage estimator", () => {
  const sampleCount = 32;
  const searchRadiusPx = 60;

  const coverageForUniformFootprint = (sampleRadiusPx: number) => {
    const areaRatio = (sampleRadiusPx / searchRadiusPx) ** 2;
    const expectedAcceptedWeight = sampleCount * areaRatio;
    const compensation = nearCoverageProposalCompensation(
      sampleRadiusPx,
      searchRadiusPx,
      sampleCount,
    );
    return estimateNearLayerCoverage({
      coverageMass: expectedAcceptedWeight * compensation,
      sampleCount,
    });
  };

  it("keeps maximum-radius and moderate-radius footprints visible", () => {
    const maximumCoverage = coverageForUniformFootprint(searchRadiusPx);
    const moderateCoverage = coverageForUniformFootprint(10);

    expect(maximumCoverage).toBeGreaterThan(0.5);
    expect(moderateCoverage).toBeGreaterThan(0.4);
    expect(moderateCoverage).toBeLessThanOrEqual(1);
  });

  it("uses a sample-count-derived cap so one sparse proposal is not opaque", () => {
    const compensation = nearCoverageProposalCompensation(1, searchRadiusPx, sampleCount);
    const oneProposalCoverage = estimateNearLayerCoverage({
      coverageMass: compensation,
      sampleCount,
    });

    expect(compensation).toBe(sampleCount);
    expect(oneProposalCoverage).toBeGreaterThan(0);
    expect(oneProposalCoverage).toBeLessThan(1);
  });

  it("fails closed for negligible footprints and keeps center foreground opaque", () => {
    expect(nearCoverageProposalCompensation(0, searchRadiusPx, sampleCount)).toBe(0);
    expect(
      estimateNearLayerCoverage({ coverageMass: 0, sampleCount }),
    ).toBe(0);
    expect(
      estimateNearLayerCoverage({ coverageMass: 0, sampleCount, centerForeground: true }),
    ).toBe(1);
  });

  it("bounds invalid and saturated estimates", () => {
    expect(
      estimateNearLayerCoverage({ coverageMass: Number.POSITIVE_INFINITY, sampleCount }),
    ).toBe(0);
    expect(
      estimateNearLayerCoverage({ coverageMass: Number.MAX_VALUE, sampleCount }),
    ).toBeLessThanOrEqual(1);
    expect(
      nearCoverageProposalCompensation(10, searchRadiusPx, sampleCount),
    ).toBeLessThanOrEqual(sampleCount);
  });
});
