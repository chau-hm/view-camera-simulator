import { describe, expect, it } from "vitest";
import type { GroundGlassApertureGatherReferenceResult } from "../../render/webgpu/groundGlassApertureGatherReference";
import {
  analyzeGroundGlassM5rSampleDistribution,
  compareGroundGlassM5rGatherRepeats,
  compareGroundGlassM5rGatherResults,
  compareGroundGlassM5rNumericArrays,
  compareGroundGlassM5rWithHighSampleReference,
  createGroundGlassM5rGoldenAngleProposals,
  createGroundGlassM5rReferenceReportFields,
  evaluateGroundGlassM5rReferenceEvidence,
  type GroundGlassM5rReferenceEvidenceInput,
  type GroundGlassM5rRepeatComparison,
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

const makeRepeatComparisons = (
  mutation?: Readonly<{ qualityMode: "Full32" | "Full64"; comparison: "A/B" | "A/C"; buffer: "far" | "near" }>,
): readonly GroundGlassM5rRepeatComparison[] => ([
  { qualityMode: "Full32", comparison: "A/B", comparedCaptureIds: ["f32-a", "f32-b"] },
  { qualityMode: "Full32", comparison: "A/C", comparedCaptureIds: ["f32-a", "f32-c"] },
  { qualityMode: "Full64", comparison: "A/B", comparedCaptureIds: ["f64-a", "f64-b"] },
  { qualityMode: "Full64", comparison: "A/C", comparedCaptureIds: ["f64-a", "f64-c"] },
] as const).map((entry) => ({
  ...entry,
  far: (() => {
    const first = new Float32Array([0.1, 0.2, 0.3, 1]);
    const repeat = first.slice();
    if (mutation?.qualityMode === entry.qualityMode
        && mutation.comparison === entry.comparison && mutation.buffer === "far") repeat[2] = 0.31;
    return compareGroundGlassM5rNumericArrays(first, repeat);
  })(),
  near: (() => {
    const first = new Float32Array([0.3, 0.2, 0.1, 0.4]);
    const repeat = first.slice();
    if (mutation?.qualityMode === entry.qualityMode
        && mutation.comparison === entry.comparison && mutation.buffer === "near") repeat[3] = 0.41;
    return compareGroundGlassM5rNumericArrays(first, repeat);
  })(),
}));

const stableEvidenceInput = (
  overrides: Partial<GroundGlassM5rReferenceEvidenceInput> = {},
): GroundGlassM5rReferenceEvidenceInput => ({
  inputFingerprintMatch: true,
  repeatedCaptures: makeRepeatComparisons(),
  gpu32VsCpu32RgbRmse: 0.0000000652,
  gpu64VsCpu64RgbRmse: 0.000000134,
  declaredMatchedCountConformanceLimit: 0.001,
  cpu128VsCpu256RgbRmse: 0.004157,
  declaredReferenceConvergenceLimit: 0.001,
  ...overrides,
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

  it("M5R-A1: supports deterministic finite-sampling attribution only after all measured gates pass", () => {
    const decision = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput());
    const fields = createGroundGlassM5rReferenceReportFields(decision);

    expect(decision.provenanceValid).toBe(true);
    expect(decision.sameProfileRepeatable).toBe(true);
    expect(decision.gpuCpuConformancePassed).toBe(true);
    expect(decision.classification).toBe("deterministic-reference-sampling-limited");
    expect(decision.rootCauseStatementsAllowed.deterministicReferenceSamplingLimited).toBe(true);
    expect(fields.rootCauseMatrix.hA5.classification).toBe("capture-instability-not-observed");
    expect(fields.negativeControls.nativeAssertions[0]).toContain("(passed)");
  });

  it("M5R-A2: detects a one-channel Full32 Far mutation with measured error details", () => {
    const decision = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput({
      repeatedCaptures: makeRepeatComparisons({ qualityMode: "Full32", comparison: "A/B", buffer: "far" }),
    }));
    const changed = decision.repeatability!.find((entry) => entry.qualityMode === "Full32" && entry.comparison === "A/B")!.far!;

    expect(decision.sameProfileRepeatable).toBe(false);
    expect(changed.changedValueCount).toBeGreaterThan(0);
    expect(changed.maximumAbsoluteError).toBeGreaterThan(0);
    expect(changed.maximumErrorIndex).toBe(2);
    expect(changed.rootMeanSquareError).toBeGreaterThan(0);
    expect(decision.classification).toBe("capture-instability-observed");
    expect(decision.rootCauseStatementsAllowed.deterministicReferenceSamplingLimited).toBe(false);
  });

  it("M5R-A3: detects a one-channel Full64 Near-alpha mutation even when Far is exact", () => {
    const decision = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput({
      repeatedCaptures: makeRepeatComparisons({ qualityMode: "Full64", comparison: "A/C", buffer: "near" }),
    }));
    const comparison = decision.repeatability!.find((entry) => entry.qualityMode === "Full64" && entry.comparison === "A/C")!;

    expect(comparison.far!.exact).toBe(true);
    expect(comparison.near!.exact).toBe(false);
    expect(comparison.near!.changedValueCount).toBe(1);
    expect(comparison.near!.maximumErrorIndex % 4).toBe(3);
    expect(decision.sameProfileRepeatable).toBe(false);
  });

  it("M5R-A4: rejects sampling attribution when stable captures have a GPU32/CPU32 mismatch", () => {
    const decision = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput({
      gpu32VsCpu32RgbRmse: 0.0011,
    }));

    expect(decision.sameProfileRepeatable).toBe(true);
    expect(decision.gpuCpuConformancePassed).toBe(false);
    expect(decision.classification).toBe("gpu-cpu-mismatch");
    expect(decision.rootCauseStatementsAllowed.deterministicReferenceSamplingLimited).toBe(false);
  });

  it("M5R-A5: rejects sampling attribution when stable captures have a GPU64/CPU64 mismatch", () => {
    const decision = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput({
      gpu64VsCpu64RgbRmse: 0.0011,
    }));

    expect(decision.sameProfileRepeatable).toBe(true);
    expect(decision.gpuCpuConformancePassed).toBe(false);
    expect(decision.classification).toBe("gpu-cpu-mismatch");
    expect(decision.rootCauseStatementsAllowed.deterministicReferenceSamplingLimited).toBe(false);
  });

  it("M5R-A6: rejects identical outputs as an invalid comparison when fingerprints differ", () => {
    const decision = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput({ inputFingerprintMatch: false }));
    const fields = createGroundGlassM5rReferenceReportFields(decision);

    expect(decision.sameProfileRepeatable).toBe(true);
    expect(decision.classification).toBe("invalid-comparison");
    expect(decision.rootCauseStatementsAllowed.deterministicReferenceSamplingLimited).toBe(false);
    expect(fields.rootCauseMatrix.hA6.classification).toBe("geometry-provenance-mismatch-observed");
  });

  it("M5R-A7: missing, NaN, and infinite metrics never produce a successful classification", () => {
    const missing = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput({ gpu32VsCpu32RgbRmse: null }));
    const nan = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput({ gpu32VsCpu32RgbRmse: Number.NaN }));
    const infinity = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput({ cpu128VsCpu256RgbRmse: Number.POSITIVE_INFINITY }));

    expect(missing.classification).toBe("insufficient-evidence");
    expect(nan.classification).toBe("invalid-comparison");
    expect(infinity.classification).toBe("invalid-comparison");
    expect([missing, nan, infinity].every((decision) =>
      decision.rootCauseStatementsAllowed.deterministicReferenceSamplingLimited)).toBe(false);
  });

  it("M5R-A8: preserves unresolved high-sample reference authority when the measured sequence is not converged", () => {
    const decision = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput());

    expect(decision.classification).toBe("deterministic-reference-sampling-limited");
    expect(decision.finiteSampleReferenceConverged).toBe(false);
    expect(decision.evidenceStatus.finiteSampleReferenceConvergence).toBe("contradicted");
    expect(decision.failedConditions.some((condition) => condition.includes("reference authority remains unresolved")))
      .toBe(true);
  });

  it("M5R-A9: keeps the matrix aligned with failed top-level decisions and removes unsupported success claims", () => {
    const gpuMismatch = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput({
      gpu32VsCpu32RgbRmse: 0.002,
    }));
    const mismatchFields = createGroundGlassM5rReferenceReportFields(gpuMismatch);
    const unstable = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput({
      repeatedCaptures: makeRepeatComparisons({ qualityMode: "Full32", comparison: "A/B", buffer: "far" }),
    }));
    const unstableFields = createGroundGlassM5rReferenceReportFields(unstable);

    expect(mismatchFields.rootCauseMatrix.hA1.classification).toBe(mismatchFields.referenceConvergence.classification);
    expect(mismatchFields.rootCauseMatrix.hA1.classification).toBe("gpu-cpu-mismatch");
    expect(mismatchFields.rootCauseMatrix.hA1.contradictingEvidence.some((item) => item.includes("GPU32/CPU32")))
      .toBe(true);
    expect(unstableFields.rootCauseMatrix.hA1.classification).toBe(unstableFields.referenceConvergence.classification);
    expect(unstableFields.rootCauseMatrix.hA5.classification).toBe("capture-instability-observed");
    expect(unstableFields.rootCauseMatrix.hA5.classification).not.toBe("capture-instability-not-observed");
    expect(unstableFields.negativeControls.nativeAssertions[0]).toContain("(failed or unresolved)");
  });

  it("M5R-A10: serializes one consistent decision across repeatability, convergence, matrix, and N1", () => {
    const decision = evaluateGroundGlassM5rReferenceEvidence(stableEvidenceInput());
    const fields = createGroundGlassM5rReferenceReportFields(decision);
    const report = JSON.parse(JSON.stringify(fields)) as typeof fields;

    expect(report.referenceRepeatability.sameProfileRepeatable).toBe(true);
    expect(report.referenceConvergence.classification).toBe("deterministic-reference-sampling-limited");
    expect(report.rootCauseMatrix.hA1.classification).toBe(report.referenceConvergence.classification);
    expect(report.rootCauseMatrix.hA5.classification).toBe("capture-instability-not-observed");
    expect(report.negativeControls.nativeAssertions[0]).toContain("(passed)");
  });
});
