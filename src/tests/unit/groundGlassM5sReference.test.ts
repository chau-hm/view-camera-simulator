import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_M5S_SAMPLE_COUNTS,
  auditGroundGlassM5sProposalStrategy,
  compareGroundGlassM5sRgb,
  createGroundGlassM5sProposalStrategy,
  integrateGroundGlassM5sUnitDiskFunction,
  runGroundGlassM5sReferenceMatrix,
  runGroundGlassM5sSparseFarReference,
  type GroundGlassM5sFarReferenceInput,
  type GroundGlassM5sProposalStrategy,
} from "../../render/webgpu/groundGlassM5sReference";
import {
  aggregateGroundGlassM5sStrata,
  evaluateGroundGlassM5sBlurPreservation,
  evaluateGroundGlassM5sEvidence,
  runGroundGlassM5sAnalyticControls,
  type GroundGlassM5sEvidenceAssessment,
  type GroundGlassM5sRoiStratum,
  type GroundGlassM5sStratumStudy,
} from "../../render/webgpu/groundGlassM5sAnalysis";

const makeInput = (size = 65): GroundGlassM5sFarReferenceInput => {
  const pixels = size * size;
  const sourceRgba = new Float32Array(pixels * 4);
  const physicalRgba = new Float32Array(pixels * 4);
  const validity = new Uint8Array(pixels).fill(1);
  const depth = new Float32Array(pixels).fill(0.5);
  for (let id = 0; id < pixels; id += 1) {
    sourceRgba.set([0.1, 0.2, 0.3, 1], id * 4);
    physicalRgba.set([1, 12, 12, 0], id * 4);
  }
  const center = Math.floor(size / 2);
  return {
    source: { widthPx: size, heightPx: size },
    gather: { widthPx: 1, heightPx: 1 },
    film: { widthMm: size, heightMm: size },
    sourceRgba,
    physicalRgba,
    validity,
    depth,
    observedGatherCenterSourceIds: new Int32Array([center, center]),
    observedGatherCenterSourceUvs: new Float32Array([(center + 0.5) / size, (center + 0.5) / size]),
    inverseProjectionMatrix: new Float64Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]),
    maximumRadiusPx: 16,
    inputFingerprints: {
      sourceColor: "source-v1",
      depth: "depth-v1",
      physical: "physical-v1",
      validity: "validity-v1",
    },
  };
};

const halton32 = () => createGroundGlassM5sProposalStrategy({
  method: "halton-2-3-progressive",
  sampleCount: 32,
});

const passingMetric = compareGroundGlassM5sRgb([0, 0, 0], [0.0002, 0, 0]);
const passingEvidence = (overrides: Partial<Parameters<typeof evaluateGroundGlassM5sEvidence>[0]> = {}) =>
  evaluateGroundGlassM5sEvidence({
    provenanceStatus: "matched",
    candidateCount: 16,
    selectedPixelCount: 16,
    minimumSupport: 12,
    analyticControlsPassed: true,
    blurPreservationStatus: "preserved",
    withinMethodConvergence: [passingMetric],
    crossMethodAgreement: [passingMetric],
    randomizedSeedVariationRmse: 0.0002,
    randomizedSeedVariationMaximumChannelError: 0.0002,
    ...overrides,
  });

const metricWith = (rmse: number, maximumChannelError: number) => ({
  ...passingMetric,
  rmse,
  maximumChannelError,
});

const validStudy = (
  id: GroundGlassM5sRoiStratum["id"],
  classification: GroundGlassM5sEvidenceAssessment["classification"],
): GroundGlassM5sStratumStudy => ({
  stratum: { id } as GroundGlassM5sRoiStratum,
  convergenceCurves: [],
  finalTierWithinMethod: [],
  highTierCrossMethodAgreement: [],
  randomizedSeedVariation: passingMetric,
  maximumSeedRmse: 0.0002,
  maximumSeedChannelError: 0.0002,
  evidence: { classification, adequateSupport: true } as GroundGlassM5sEvidenceAssessment,
});

describe("Ground Glass M5S independent sparse Far reference", () => {
  it("runs analytic uniform, affine, boundary, silhouette, depth, cap, and blur controls", () => {
    const controls = runGroundGlassM5sAnalyticControls();
    expect(controls.status).toBe("passed");
    expect(Object.values(controls.cases).every(({ status }) => status === "passed")).toBe(true);
    expect(controls.independentRasterOracle.resolutionPerAxis).toBe(512);
  });

  it("detects a one-channel mutation with RGB error metrics (N1)", () => {
    const first = new Float32Array([0.1, 0.2, 0.3]);
    const changed = first.slice();
    changed[1] = 0.21;
    const metrics = compareGroundGlassM5sRgb(first, changed);
    expect(metrics.status).toBe("measured");
    expect(metrics.maximumChannelError).toBeCloseTo(0.01, 6);
    expect(metrics.maximumErrorIndex).toBe(1);
    expect(metrics.rmse).toBeGreaterThan(0);
  });

  it("rejects mismatched capture fingerprints before reference qualification (N2)", () => {
    const evidence = passingEvidence({ provenanceStatus: "mismatched" });
    expect(evidence.classification).toBe("invalid-comparison");
    expect(evidence.referenceAuthority).toBe("none");
    expect(evidence.provenanceValid).toBe(false);
  });

  it("flags duplicate proposals and prevents the sparse engine from using them (N3)", () => {
    const duplicateStrategy: GroundGlassM5sProposalStrategy = {
      descriptor: {
        method: "halton-2-3-progressive",
        sequenceId: "intentionally-duplicated-control",
        sampleCount: 32,
        seed: null,
        progressivePrefix: true,
      },
      proposalAt: () => [0, 0],
    };
    const audit = auditGroundGlassM5sProposalStrategy(duplicateStrategy);
    expect(audit.status).toBe("invalid");
    expect(audit.duplicateCount).toBe(31);
    expect(() => runGroundGlassM5sSparseFarReference({
      referenceInput: makeInput(), selectedGatherPixelIds: [0], strategy: duplicateStrategy,
    })).toThrow(/invalid proposal sequence/);
  });

  it("detects center-biased proposals with the analytic disk second moment (N4)", () => {
    const count = 1024;
    const base = createGroundGlassM5sProposalStrategy({
      method: "golden-angle-count-dependent", sampleCount: count,
    });
    const biased: GroundGlassM5sProposalStrategy = {
      descriptor: { ...base.descriptor, sequenceId: "center-biased-negative-control" },
      proposalAt: (index) => {
        const [x, y] = base.proposalAt(index);
        return [x * 0.5, y * 0.5];
      },
    };
    const observed = integrateGroundGlassM5sUnitDiskFunction(
      biased, ([x, y]) => x * x + y * y,
    );
    expect(auditGroundGlassM5sProposalStrategy(biased).status).toBe("valid");
    expect(observed).toBeCloseTo(0.125, 3);
    expect(Math.abs(observed - 0.5)).toBeGreaterThan(0.3);
  });

  it("distinguishes uniform-radius sampling from the equal-area disk oracle (N5)", () => {
    const count = 1024;
    const radialUniform: GroundGlassM5sProposalStrategy = {
      descriptor: {
        method: "golden-angle-count-dependent",
        sequenceId: "uniform-radius-negative-control",
        sampleCount: count,
        seed: null,
        progressivePrefix: false,
      },
      proposalAt: (index) => {
        const radius = (index + 0.5) / count;
        const angle = (index + 0.5) * 2.399963229728653;
        return [radius * Math.cos(angle), radius * Math.sin(angle)];
      },
    };
    const observed = integrateGroundGlassM5sUnitDiskFunction(
      radialUniform, ([x, y]) => x * x + y * y,
    );
    expect(observed).toBeCloseTo(1 / 3, 3);
    expect(Math.abs(observed - 0.5)).toBeGreaterThan(0.15);
  });

  it("rejects aperture proposals outside the unit disk (N6)", () => {
    const outside: GroundGlassM5sProposalStrategy = {
      descriptor: {
        method: "halton-2-3-progressive", sequenceId: "outside-disk-negative-control",
        sampleCount: 32, seed: null, progressivePrefix: true,
      },
      proposalAt: (index) => index === 0 ? [1.01, 0] : [0.5 * Math.cos(index), 0.5 * Math.sin(index)],
    };
    expect(auditGroundGlassM5sProposalStrategy(outside).status).toBe("invalid");
    expect(() => runGroundGlassM5sSparseFarReference({
      referenceInput: makeInput(), selectedGatherPixelIds: [0], strategy: outside,
    })).toThrow(/invalid proposal sequence/);
  });

  it("does not qualify agreeing methods when the analytic oracle fails (N7)", () => {
    const evidence = passingEvidence({ analyticControlsPassed: false });
    expect(evidence.classification).toBe("analytically-invalid");
    expect(evidence.referenceAuthority).toBe("none");
  });

  it("rejects a sharp-source replacement when the controlled reference requires blur (N8)", () => {
    const result = evaluateGroundGlassM5sBlurPreservation({
      sourceRgb: [0, 1, 0],
      expectedBlurRgb: [0.4, 0.6, 0.4],
      candidateRgb: [0, 1, 0],
    });
    expect(result.expectedBlurSignalPresent).toBe(true);
    expect(result.candidateRetainsBlurSignal).toBe(false);
    expect(result.status).toBe("failed");
  });

  it("rejects nearer foreground samples at a two-layer depth discontinuity (N9)", () => {
    const input = makeInput();
    const center = Math.floor(input.source.widthPx / 2);
    for (let y = 0; y < input.source.heightPx; y += 1) {
      for (let x = center + 3; x < input.source.widthPx; x += 1) {
        const id = y * input.source.widthPx + x;
        input.sourceRgba.set([1, 1, 1, 1], id * 4);
        input.physicalRgba[id * 4] = 0;
        input.depth[id] = 0.4;
      }
    }
    const result = runGroundGlassM5sSparseFarReference({
      referenceInput: input,
      selectedGatherPixelIds: [0],
      strategy: createGroundGlassM5sProposalStrategy({
        method: "halton-2-3-progressive", sampleCount: 1024,
      }),
    }).pixels[0]!;
    expect(result.acceptedProposalCount).toBeGreaterThan(0);
    result.limitingIntegralRgb!.forEach((value, index) => expect(value).toBeCloseTo([0.1, 0.2, 0.3][index]!, 6));
  });

  it("requires both RMSE and maximum-channel limits for convergence (N10)", () => {
    const evidence = passingEvidence({
      crossMethodAgreement: [metricWith(0.0005, 0.02)],
    });
    expect(evidence.crossMethodAgreementPassed).toBe(false);
    expect(evidence.classification).not.toBe("converged-and-cross-validated");
    expect(evidence.referenceAuthority).not.toBe("supported-for-exact-stratum");
  });

  it("qualifies only individually supported strata, not an aggregate average (N11)", () => {
    const result = aggregateGroundGlassM5sStrata([
      validStudy("S1-smooth-valid-far-interior", "converged-and-cross-validated"),
      validStudy("S5-signed-coc-boundary-neighborhood", "systematic-method-disagreement"),
    ]);
    expect(result.supportedStrata).toEqual(["S1-smooth-valid-far-interior"]);
    expect(result.unresolvedStrata).toEqual(["S5-signed-coc-boundary-neighborhood"]);
    expect(result.classification).toBe("convergence-trending-but-unresolved");
  });

  it("does not mislabel adequately measured method disagreement as insufficient support", () => {
    const result = aggregateGroundGlassM5sStrata([
      validStudy("S4-depth-discontinuity-valid-far", "systematic-method-disagreement"),
    ]);
    expect(result.classification).toBe("systematic-method-disagreement");
    expect(result.referenceAuthority).toBe("unresolved");
  });

  it("keeps convergence unresolved when randomized seed variation exceeds its limit (N12)", () => {
    const evidence = passingEvidence({ randomizedSeedVariationRmse: 0.01 });
    expect(evidence.randomizedUncertaintyPassed).toBe(false);
    expect(evidence.classification).toBe("convergence-trending-but-unresolved");
    expect(evidence.referenceAuthority).toBe("unresolved");
    const channelOutlier = passingEvidence({ randomizedSeedVariationMaximumChannelError: 0.02 });
    expect(channelOutlier.randomizedUncertaintyPassed).toBe(false);
    expect(channelOutlier.referenceAuthority).toBe("unresolved");
  });

  it("does not treat CPU256 as authoritative while CPU128/256 still diverges (N13)", () => {
    const evidence = passingEvidence({
      withinMethodConvergence: [metricWith(0.004157, 0.02)],
    });
    expect(evidence.finiteSampleReferenceConverged).toBe(false);
    expect(evidence.classification).not.toBe("converged-and-cross-validated");
    expect(evidence.referenceAuthority).toBe("unresolved");
  });

  it("aborts when ROI, sample, proposal, or sequence budgets are exceeded (N15)", () => {
    const input = makeInput();
    const strategy = halton32();
    expect(() => runGroundGlassM5sSparseFarReference({
      referenceInput: input, selectedGatherPixelIds: [0, 0], strategy,
    })).toThrow(/duplicate gather pixel IDs/);
    expect(() => runGroundGlassM5sSparseFarReference({
      referenceInput: input, selectedGatherPixelIds: [0], strategy,
      budget: { maxProposalEvaluations: 31 },
    })).toThrow(/proposal evaluation count/);
    expect(() => runGroundGlassM5sSparseFarReference({
      referenceInput: input, selectedGatherPixelIds: Array.from({ length: 129 }, (_v, i) => i), strategy,
    })).toThrow(/ROI pixel count/);
    expect(() => createGroundGlassM5sProposalStrategy({
      method: "halton-2-3-progressive", sampleCount: 32,
    })).not.toThrow();
    expect(() => runGroundGlassM5sReferenceMatrix({
      referenceInput: input, selectedGatherPixelIds: [0], sampleCounts: [32, 64, 128, 256, 512, 1024],
      stratifiedSeeds: Array.from({ length: 9 }, (_v, i) => i + 1),
    })).toThrow(/bounded tiers and one to eight uint32 seeds/);
    expect(GROUND_GLASS_M5S_SAMPLE_COUNTS).toEqual([32, 64, 128, 256, 512, 1024]);
  });

  it("keeps M5Q Q1–Q7 qualification and Q3's narrow status frozen (N14/N16)", () => {
    const report = JSON.parse(readFileSync("docs/architecture/GROUND_GLASS_M5Q_REVIEW_FIX_2_REPORT.json", "utf8")) as {
      qualificationMatrix: Record<string, { status: string }>;
      thresholdContract: { revision: string };
      q3: { frozenThresholdRevision: string };
    };
    expect(report.thresholdContract.revision).toBe("m5q-architecture-rise-r186-v3");
    expect(report.q3.frozenThresholdRevision).toBe("m5q-architecture-rise-r186-v3");
    expect(Object.fromEntries(Object.entries(report.qualificationMatrix).map(([id, value]) => [id, value.status])))
      .toEqual({
        Q1: "reference-not-converged",
        Q2: "insufficient-support",
        Q3: "bounded-qualified",
        Q4: "insufficient-support",
        Q5: "reference-not-converged",
        Q6: "reference-not-converged",
        Q7: "reference-not-converged",
      });
  });

  it("keeps the finite center contribution separate from the limiting integral", () => {
    const input = makeInput();
    const centerId = Math.floor(input.source.widthPx / 2) * input.source.widthPx
      + Math.floor(input.source.widthPx / 2);
    input.sourceRgba.set([1, 0, 0, 1], centerId * 4);
    for (let id = 0; id < input.source.widthPx * input.source.heightPx; id += 1) {
      if (id !== centerId) input.sourceRgba.set([0, 0, 1, 1], id * 4);
    }
    const result = runGroundGlassM5sSparseFarReference({
      referenceInput: input,
      selectedGatherPixelIds: [0],
      strategy: halton32(),
    }).pixels[0]!;
    expect(result.centerContributionFraction).toBeCloseTo(1 / 33, 8);
    expect(result.finiteEstimatorRgb).not.toEqual(result.limitingIntegralRgb);
    expect(result.finiteEstimatorWeightSum).toBe(result.acceptedProposalCount + 1);
  });

  it("distinguishes all three deterministic, progressive, and seeded sampling families", () => {
    const golden32 = createGroundGlassM5sProposalStrategy({
      method: "golden-angle-count-dependent", sampleCount: 32,
    });
    const golden64 = createGroundGlassM5sProposalStrategy({
      method: "golden-angle-count-dependent", sampleCount: 64,
    });
    const halton32 = createGroundGlassM5sProposalStrategy({
      method: "halton-2-3-progressive", sampleCount: 32,
    });
    const halton64 = createGroundGlassM5sProposalStrategy({
      method: "halton-2-3-progressive", sampleCount: 64,
    });
    const seedA = createGroundGlassM5sProposalStrategy({
      method: "seeded-stratified-square-to-disk", sampleCount: 64, seed: 101,
    });
    const seedARepeat = createGroundGlassM5sProposalStrategy({
      method: "seeded-stratified-square-to-disk", sampleCount: 64, seed: 101,
    });
    const seedB = createGroundGlassM5sProposalStrategy({
      method: "seeded-stratified-square-to-disk", sampleCount: 64, seed: 202,
    });
    const equalPoint = (a: readonly [number, number], b: readonly [number, number]) =>
      Math.abs(a[0] - b[0]) < 1e-14 && Math.abs(a[1] - b[1]) < 1e-14;
    expect(Array.from({ length: 32 }, (_v, i) => equalPoint(halton32.proposalAt(i), halton64.proposalAt(i)))
      .every(Boolean)).toBe(true);
    expect(Array.from({ length: 32 }, (_v, i) => equalPoint(golden32.proposalAt(i), golden64.proposalAt(i)))
      .some(Boolean)).toBe(false);
    expect(Array.from({ length: 64 }, (_v, i) => equalPoint(seedA.proposalAt(i), seedARepeat.proposalAt(i)))
      .every(Boolean)).toBe(true);
    expect(Array.from({ length: 64 }, (_v, i) => equalPoint(seedA.proposalAt(i), seedB.proposalAt(i)))
      .some((same) => !same)).toBe(true);
    expect(auditGroundGlassM5sProposalStrategy(seedA).status).toBe("valid");
    expect(auditGroundGlassM5sProposalStrategy(seedB).status).toBe("valid");
  });
});
