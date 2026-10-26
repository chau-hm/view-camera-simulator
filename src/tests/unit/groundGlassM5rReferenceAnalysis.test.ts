import { describe, expect, it } from "vitest";
import type { GroundGlassApertureGatherReferenceResult } from "../../render/webgpu/groundGlassApertureGatherReference";
import {
  analyzeGroundGlassM5rSampleDistribution,
  compareGroundGlassM5rGatherRepeats,
  compareGroundGlassM5rGatherResults,
  compareGroundGlassM5rNumericArrays,
  compareGroundGlassM5rWithHighSampleReference,
  createGroundGlassM5rGoldenAngleProposals,
  type GroundGlassM5rHighSampleCount,
} from "../../render/webgpu/groundGlassM5rReferenceAnalysis";

const makeResult = (
  farRgba: readonly [number, number, number, number],
  nearRgba: readonly [number, number, number, number],
): GroundGlassApertureGatherReferenceResult => ({
  farRgba: new Float32Array(farRgba),
  nearRgba: new Float32Array(nearRgba),
  gatherCenterSourceIds: new Int32Array([0, 0]),
  nominalGatherCenterSourceIds: new Int32Array([0, 0]),
  centerViewDistanceMm: new Float32Array([1000]),
  farUncappedMaximumRadiusPx: new Float32Array([0]),
  farEffectiveMaximumRadiusPx: new Float32Array([0]),
  farCapApplied: new Uint8Array([0]),
  nearMaximumCandidateUncappedRadiusPx: new Float32Array([0]),
  nearCandidateFootprintEvaluationCount: new Uint16Array([0]),
  nearCandidateCapAppliedCount: new Uint16Array([0]),
  nearCenterIsNear: new Uint8Array([0]),
  nearEvaluatedProposalCount: new Uint16Array([0]),
  nearAcceptedProposalCount: new Uint16Array([0]),
  nearNonzeroMembershipCount: new Uint16Array([0]),
  nearWeightSum: new Float32Array([0]),
  nearCoverageMass: new Float32Array([0]),
  nearEstimatedCoverage: new Float32Array([0]),
  nearAcceptedAreaRatioMean: new Float32Array([0]),
  nearAcceptedCompensationMaximum: new Float32Array([0]),
  summary: {
    maximumFarUncappedRadiusPx: 0,
    farCappedCenterCount: 0,
    maximumNearCandidateUncappedRadiusPx: 0,
    nearCappedCandidateCount: 0,
  },
});

describe("Ground Glass M5R CPU-reference analysis", () => {
  it.each([16, 32, 64, 128, 256] as const)(
    "summarizes the deterministic %i-point equal-area golden-angle proposal distribution",
    (sampleCount) => {
      const proposals = createGroundGlassM5rGoldenAngleProposals(sampleCount);
      const summary = analyzeGroundGlassM5rSampleDistribution(proposals);

      expect(summary.proposalCount).toBe(sampleCount);
      expect(summary.uniqueProposalCount).toBe(sampleCount);
      expect(summary.allInsideUnitDisk).toBe(true);
      expect(summary.minimumRadius).toBeGreaterThan(0);
      expect(summary.maximumRadius).toBeLessThan(1);
      expect(summary.meanSquaredRadius).toBeCloseTo(0.5, 12);
      expect(summary.radialAreaBandCounts.reduce((sum, count) => sum + count, 0)).toBe(sampleCount);
      expect(summary.angularSectorCounts.reduce((sum, count) => sum + count, 0)).toBe(sampleCount);
    },
  );

  it("detects duplicated and out-of-disk proposals as negative controls", () => {
    const proposals = createGroundGlassM5rGoldenAngleProposals(16);
    const duplicated = proposals.slice();
    duplicated[duplicated.length - 2] = duplicated[0]!;
    duplicated[duplicated.length - 1] = duplicated[1]!;
    const outsideDisk = proposals.slice();
    outsideDisk[0] = 1.25;
    outsideDisk[1] = 0;

    expect(analyzeGroundGlassM5rSampleDistribution(duplicated).uniqueProposalCount).toBe(15);
    expect(analyzeGroundGlassM5rSampleDistribution(outsideDisk).allInsideUnitDisk).toBe(false);
    expect(() => analyzeGroundGlassM5rSampleDistribution(new Float64Array([Number.NaN, 0])))
      .toThrow(/finite coordinates/);
  });

  it("reports exact same-profile repeatability and detects a changed-value negative control", () => {
    const first = makeResult([0.1, 0.2, 0.3, 1], [0.3, 0.2, 0.1, 0.4]);
    const exactRepeat = makeResult([0.1, 0.2, 0.3, 1], [0.3, 0.2, 0.1, 0.4]);
    const changedRepeat = makeResult([0.1, 0.2, 0.31, 1], [0.3, 0.2, 0.1, 0.4]);

    const exact = compareGroundGlassM5rGatherRepeats(first, exactRepeat);
    expect(exact.farRgb.exact).toBe(true);
    expect(exact.farRgb.rootMeanSquareError).toBe(0);
    expect(exact.nearRgb.exact).toBe(true);
    expect(exact.nearAlpha.exact).toBe(true);

    const changed = compareGroundGlassM5rGatherRepeats(first, changedRepeat);
    expect(changed.farRgb.exact).toBe(false);
    expect(changed.farRgb.changedValueCount).toBe(1);
    expect(changed.farRgb.maximumAbsoluteError).toBeCloseTo(0.01, 6);
    expect(changed.farRgb.maximumErrorIndex).toBe(2);
  });

  it("compares a native-range result with a high-sample reference and rejects a false order", () => {
    const candidate = makeResult([0.1, 0.2, 0.3, 1], [0.3, 0.2, 0.1, 0.4]);
    const highSample = makeResult([0.1, 0.2, 0.5, 1], [0.4, 0.2, 0.1, 0.6]);
    const comparison = compareGroundGlassM5rWithHighSampleReference(64, candidate, 256, highSample);

    expect(comparison.candidateSampleCount).toBe(64);
    expect(comparison.referenceSampleCount).toBe(256);
    expect(comparison.metrics.farRgb.maximumAbsoluteError).toBeCloseTo(0.2, 6);
    expect(comparison.metrics.nearRgb.maximumAbsoluteError).toBeCloseTo(0.1, 6);
    expect(comparison.metrics.nearAlpha.maximumAbsoluteError).toBeCloseTo(0.2, 6);
    const identicalHighReference = compareGroundGlassM5rWithHighSampleReference(64, candidate, 256, candidate);
    expect(identicalHighReference.metrics.farRgb.exact).toBe(true);
    expect(identicalHighReference.metrics.nearRgb.exact).toBe(true);
    expect(identicalHighReference.metrics.nearAlpha.exact).toBe(true);
    expect(() => compareGroundGlassM5rWithHighSampleReference(
      64,
      candidate,
      32 as unknown as GroundGlassM5rHighSampleCount,
      highSample,
    ))
      .toThrow(/must exceed/);
  });

  it("N6: detects matching sampling patterns that both disagree with the independent reference", () => {
    const patternA = makeResult([0.2, 0.3, 0.4, 1], [0.1, 0.2, 0.3, 0.25]);
    const patternB = makeResult([0.2, 0.3, 0.4, 1], [0.1, 0.2, 0.3, 0.25]);
    const independentReference = makeResult([0.8, 0.7, 0.6, 1], [0.7, 0.6, 0.5, 0.75]);

    const patternAgreement = compareGroundGlassM5rGatherResults(patternA, patternB);
    const patternAToReference = compareGroundGlassM5rWithHighSampleReference(
      32,
      patternA,
      256,
      independentReference,
    );
    const patternBToReference = compareGroundGlassM5rWithHighSampleReference(
      64,
      patternB,
      256,
      independentReference,
    );

    expect(patternAgreement.farRgb.exact).toBe(true);
    expect(patternAgreement.nearRgb.exact).toBe(true);
    expect(patternAToReference.metrics.farRgb.rootMeanSquareError).toBeGreaterThan(0.4);
    expect(patternBToReference.metrics.farRgb.rootMeanSquareError).toBeGreaterThan(0.4);
    expect(patternAToReference.metrics.nearAlpha.rootMeanSquareError).toBeGreaterThan(0.4);
    expect(patternBToReference.metrics.nearAlpha.rootMeanSquareError).toBeGreaterThan(0.4);
  });

  it("fails closed for malformed or non-finite repeatability inputs", () => {
    expect(() => compareGroundGlassM5rNumericArrays(new Float32Array([1]), new Float32Array([1, 2])))
      .toThrow(/equal, non-empty/);
    expect(() => compareGroundGlassM5rNumericArrays(new Float32Array([Number.NaN]), new Float32Array([1])))
      .toThrow(/finite values/);
  });
});
