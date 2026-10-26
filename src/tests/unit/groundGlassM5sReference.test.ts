import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_M5S_SAMPLE_COUNTS,
  auditGroundGlassM5sProposalStrategy,
  compareGroundGlassM5sRgb,
  createGroundGlassM5sProposalStrategy,
  fingerprintGroundGlassM5sProposalCoordinates,
  groundGlassM5sProposalIdentityKey,
  integrateGroundGlassM5sUnitDiskFunction,
  runGroundGlassM5sReferenceMatrix,
  runGroundGlassM5sSparseFarReference,
  type GroundGlassM5sFarReferenceInput,
  type GroundGlassM5sProposalStrategy,
} from "../../render/webgpu/groundGlassM5sReference";
import {
  aggregateGroundGlassM5sStrata,
  analyzeGroundGlassM5sReferenceMatrix,
  evaluateGroundGlassM5sBlurPreservation,
  evaluateGroundGlassM5sAnalyticAuthority,
  evaluateGroundGlassM5sEvidence,
  evaluateGroundGlassM5sProposalAnalyticControls,
  type GroundGlassM5sAnalyticControlReport,
  type GroundGlassM5sAnalyticAuthority,
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

const requiredStrategiesAt1024 = () => [
  createGroundGlassM5sProposalStrategy({ method: "golden-angle-count-dependent", sampleCount: 1024 }),
  createGroundGlassM5sProposalStrategy({ method: "halton-2-3-progressive", sampleCount: 1024 }),
  createGroundGlassM5sProposalStrategy({
    method: "seeded-stratified-square-to-disk", sampleCount: 1024, seed: 104729,
  }),
  createGroundGlassM5sProposalStrategy({
    method: "seeded-stratified-square-to-disk", sampleCount: 1024, seed: 130363,
  }),
];

let cachedValidAnalyticEvidence: Readonly<{
  strategies: readonly GroundGlassM5sProposalStrategy[];
  reports: readonly GroundGlassM5sAnalyticControlReport[];
  authority: GroundGlassM5sAnalyticAuthority;
}> | null = null;
const analyticReportCache = new Map<string, GroundGlassM5sAnalyticControlReport>();

const analyticReportFor = (strategy: GroundGlassM5sProposalStrategy) => {
  const fingerprint = fingerprintGroundGlassM5sProposalCoordinates(strategy);
  const key = `${groundGlassM5sProposalIdentityKey(strategy.descriptor)}:${fingerprint}`;
  const cached = analyticReportCache.get(key);
  if (cached) return cached;
  const report = evaluateGroundGlassM5sProposalAnalyticControls(strategy);
  analyticReportCache.set(key, report);
  return report;
};

const validAnalyticEvidence = () => {
  if (cachedValidAnalyticEvidence) return cachedValidAnalyticEvidence;
  const strategies = requiredStrategiesAt1024();
  const reports = strategies.map(analyticReportFor);
  const authority = evaluateGroundGlassM5sAnalyticAuthority({
    requiredStrategies: strategies.map(({ descriptor }) => descriptor),
    observedParticipants: strategies.map((strategy) => ({
      descriptor: strategy.descriptor,
      coordinateFingerprint: fingerprintGroundGlassM5sProposalCoordinates(strategy),
    })),
    analyticResults: reports,
  });
  cachedValidAnalyticEvidence = { strategies, reports, authority };
  return cachedValidAnalyticEvidence;
};

const passingAnalyticAuthority = (): GroundGlassM5sAnalyticAuthority =>
  validAnalyticEvidence().authority;

const passingMetric = compareGroundGlassM5sRgb([0, 0, 0], [0.0002, 0, 0]);
const passingEvidence = (overrides: Partial<Parameters<typeof evaluateGroundGlassM5sEvidence>[0]> = {}) =>
  evaluateGroundGlassM5sEvidence({
    provenanceStatus: "matched",
    candidateCount: 16,
    selectedPixelCount: 16,
    minimumSupport: 12,
    analyticAuthority: passingAnalyticAuthority(),
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

const strategyFor = (
  method: GroundGlassM5sProposalStrategy["descriptor"]["method"],
  sampleCount: 512 | 1024,
  seed: number | null = null,
  transform?: (point: readonly [number, number]) => readonly [number, number],
): GroundGlassM5sProposalStrategy => {
  const base = createGroundGlassM5sProposalStrategy({
    method, sampleCount, ...(seed === null ? {} : { seed }),
  });
  return transform ? {
    descriptor: base.descriptor,
    proposalAt: (index) => transform(base.proposalAt(index)),
  } : base;
};

const matrixFor = (input: Readonly<{
  strategyTransform?: (strategy: GroundGlassM5sProposalStrategy) => GroundGlassM5sProposalStrategy;
  analyticReportTransform?: (reports: readonly GroundGlassM5sAnalyticControlReport[]) => readonly GroundGlassM5sAnalyticControlReport[];
}> = {}) => {
  const methods = [
    ["golden-angle-count-dependent", null],
    ["halton-2-3-progressive", null],
    ["seeded-stratified-square-to-disk", 104729],
    ["seeded-stratified-square-to-disk", 130363],
  ] as const;
  const transform = (strategy: GroundGlassM5sProposalStrategy) =>
    input.strategyTransform?.(strategy) ?? strategy;
  const requiredStrategies = methods.map(([method, seed]) => transform(
    strategyFor(method, 1024, seed),
  ));
  const reports = requiredStrategies.map(analyticReportFor);
  const analyticResults = input.analyticReportTransform?.(reports) ?? reports;
  const runs = methods.flatMap(([method, seed]) => ([512, 1024] as const).map((sampleCount) =>
    runGroundGlassM5sSparseFarReference({
      referenceInput: makeInput(),
      selectedGatherPixelIds: [0],
      strategy: transform(strategyFor(method, sampleCount, seed)),
    })));
  const stratum = {
    id: "S1-smooth-valid-far-interior",
    candidateCount: 1,
    selectedGatherPixelIds: [0],
    minimumSupport: 1,
  } as unknown as GroundGlassM5sRoiStratum;
  const study = analyzeGroundGlassM5sReferenceMatrix({
    strata: [stratum],
    runs,
    provenanceStatus: "matched",
    requiredAnalyticStrategies: requiredStrategies.map(({ descriptor }) => descriptor),
    analyticResults,
    blurPreservationByStratum: { [stratum.id]: "preserved" },
  })[0]!;
  const authority = evaluateGroundGlassM5sAnalyticAuthority({
    requiredStrategies: requiredStrategies.map(({ descriptor }) => descriptor),
    observedParticipants: runs.filter(({ descriptor }) => descriptor.sampleCount === 1024)
      .map(({ descriptor, proposalCoordinateFingerprint }) => ({
        descriptor, coordinateFingerprint: proposalCoordinateFingerprint,
      })),
    analyticResults,
  });
  return { requiredStrategies, reports, analyticResults, runs, study, authority };
};

describe("Ground Glass M5S independent sparse Far reference", () => {
  it("runs analytic controls independently for every high-tier method and seed", () => {
    const { strategies, reports, authority } = validAnalyticEvidence();
    expect(strategies.map(({ descriptor }) => groundGlassM5sProposalIdentityKey(descriptor)))
      .toEqual(reports.map(({ strategyId }) => strategyId));
    expect(reports.map(({ method, seed }) => [method, seed])).toEqual([
      ["golden-angle-count-dependent", null],
      ["halton-2-3-progressive", null],
      ["seeded-stratified-square-to-disk", 104729],
      ["seeded-stratified-square-to-disk", 130363],
    ]);
    expect(reports.every(({ sampleCount, analyticStatus, independentRasterOracle }) =>
      sampleCount === 1024 && analyticStatus === "passed"
      && Object.values(independentRasterOracle).includes(512))).toBe(true);
    expect(reports.every(({ analyticCases }) => Object.values(analyticCases)
      .every(({ status }) => status === "passed"))).toBe(true);
    expect(authority.status).toBe("passed");
  });

  it("fingerprints proposal sequences deterministically from canonical binary coordinates", () => {
    const first = createGroundGlassM5sProposalStrategy({ method: "halton-2-3-progressive", sampleCount: 64 });
    const regenerated = createGroundGlassM5sProposalStrategy({ method: "halton-2-3-progressive", sampleCount: 64 });
    const changed: GroundGlassM5sProposalStrategy = {
      descriptor: first.descriptor,
      proposalAt: (index) => {
        const [x, y] = first.proposalAt(index);
        return index === 17 ? [x + 1e-7, y] : [x, y];
      },
    };
    expect(fingerprintGroundGlassM5sProposalCoordinates(regenerated))
      .toBe(fingerprintGroundGlassM5sProposalCoordinates(first));
    expect(fingerprintGroundGlassM5sProposalCoordinates(changed))
      .not.toBe(fingerprintGroundGlassM5sProposalCoordinates(first));
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
    const duplicateBase = createGroundGlassM5sProposalStrategy({
      method: "halton-2-3-progressive", sampleCount: 32,
    });
    const duplicateStrategy: GroundGlassM5sProposalStrategy = {
      descriptor: { ...duplicateBase.descriptor, sequenceId: "intentionally-duplicated-control" },
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
    const radialBase = createGroundGlassM5sProposalStrategy({
      method: "golden-angle-count-dependent", sampleCount: 1024,
    });
    const radialUniform: GroundGlassM5sProposalStrategy = {
      descriptor: { ...radialBase.descriptor, sequenceId: "uniform-radius-negative-control" },
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
    const outsideBase = createGroundGlassM5sProposalStrategy({
      method: "halton-2-3-progressive", sampleCount: 32,
    });
    const outside: GroundGlassM5sProposalStrategy = {
      descriptor: { ...outsideBase.descriptor, sequenceId: "outside-disk-negative-control" },
      proposalAt: (index) => index === 0 ? [1.01, 0] : [0.5 * Math.cos(index), 0.5 * Math.sin(index)],
    };
    expect(auditGroundGlassM5sProposalStrategy(outside).status).toBe("invalid");
    expect(() => runGroundGlassM5sSparseFarReference({
      referenceInput: makeInput(), selectedGatherPixelIds: [0], strategy: outside,
    })).toThrow(/invalid proposal sequence/);
  });

  it("does not qualify agreeing methods when the analytic oracle fails (N7)", () => {
    const authority = passingAnalyticAuthority();
    const evidence = passingEvidence({ analyticAuthority: { ...authority, status: "failed" } });
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

  it("allows cross-method analysis only when every actual high-tier participant passes its controls (F1)", () => {
    const result = matrixFor();
    expect(result.authority.status).toBe("passed");
    expect(result.authority.qualifiedStrategyIds).toHaveLength(4);
    expect(result.study.evidence.analyticAuthority).toEqual(result.authority);
    expect(result.study.evidence.classification).toBe("converged-and-cross-validated");
  });

  it("rejects a structurally valid center-biased Golden-angle sequence (F2)", () => {
    const result = matrixFor({
      strategyTransform: (strategy) => strategy.descriptor.method === "golden-angle-count-dependent"
        ? { descriptor: strategy.descriptor, proposalAt: (index) => {
          const [x, y] = strategy.proposalAt(index);
          return [x * 0.5, y * 0.5];
        } }
        : strategy,
    });
    const golden = result.reports.find(({ method }) => method === "golden-angle-count-dependent")!;
    expect(golden.proposalAudit.status).toBe("valid");
    expect(golden.analyticCases.unitDiskAreaMoment.observed).toBeCloseTo(0.125, 6);
    expect(golden.analyticCases.unitDiskAreaMoment.status).toBe("failed");
    expect(result.authority.status).toBe("failed");
    expect(result.study.evidence.classification).toBe("analytically-invalid");
    expect(result.study.evidence.classification).not.toBe("converged-and-cross-validated");
  });

  it("rejects a uniform-radius seeded strategy despite all proposals remaining inside the disk (F3)", () => {
    const result = matrixFor({
      strategyTransform: (strategy) => strategy.descriptor.method === "seeded-stratified-square-to-disk"
        && strategy.descriptor.seed === 104729
        ? { descriptor: strategy.descriptor, proposalAt: (index) => {
          const radius = (index + 0.5) / strategy.descriptor.sampleCount;
          const angle = (index + 0.5) * 2.399963229728653;
          return [radius * Math.cos(angle), radius * Math.sin(angle)];
        } }
        : strategy,
    });
    const seedA = result.reports.find(({ seed }) => seed === 104729)!;
    expect(seedA.proposalAudit.status).toBe("valid");
    expect(seedA.analyticCases.unitDiskAreaMoment.observed).toBeCloseTo(1 / 3, 5);
    expect(seedA.analyticCases.unitDiskAreaMoment.status).toBe("failed");
    expect(result.study.evidence.classification).toBe("analytically-invalid");
  });

  it("keeps seed A qualified while an analytically failed seed B blocks aggregate qualification (F4)", () => {
    const result = matrixFor({
      strategyTransform: (strategy) => strategy.descriptor.method === "seeded-stratified-square-to-disk"
        && strategy.descriptor.seed === 130363
        ? { descriptor: strategy.descriptor, proposalAt: (index) => {
          const [x, y] = strategy.proposalAt(index);
          return [x * 0.5, y * 0.5];
        } }
        : strategy,
    });
    const seedA = groundGlassM5sProposalIdentityKey(result.requiredStrategies[2]!.descriptor);
    const seedB = groundGlassM5sProposalIdentityKey(result.requiredStrategies[3]!.descriptor);
    expect(result.authority.qualifiedStrategyIds).toContain(seedA);
    expect(result.authority.failedStrategies.map(({ strategyId }) => strategyId)).toContain(seedB);
    expect(result.study.evidence.classification).toBe("analytically-invalid");
  });

  it("fails closed when a required seed result is missing or replaced by another seed (F5/F6)", () => {
    const { strategies, reports } = validAnalyticEvidence();
    const observedParticipants = strategies.map((strategy) => ({
      descriptor: strategy.descriptor,
      coordinateFingerprint: fingerprintGroundGlassM5sProposalCoordinates(strategy),
    }));
    const missing = evaluateGroundGlassM5sAnalyticAuthority({
      requiredStrategies: strategies.map(({ descriptor }) => descriptor),
      observedParticipants,
      analyticResults: reports.filter(({ seed }) => seed !== 130363),
    });
    expect(missing.status).toBe("invalid");
    expect(missing.missingStrategyIds).toContain(groundGlassM5sProposalIdentityKey(
      strategies[3]!.descriptor,
    ));

    const wrongSeed = evaluateGroundGlassM5sAnalyticAuthority({
      requiredStrategies: strategies.map(({ descriptor }) => descriptor),
      observedParticipants,
      analyticResults: [...reports.slice(0, 3), reports[2]!],
    });
    expect(wrongSeed.status).toBe("invalid");
    expect(wrongSeed.duplicateStrategyIds).toContain(groundGlassM5sProposalIdentityKey(
      strategies[2]!.descriptor,
    ));
    expect(wrongSeed.missingStrategyIds).toContain(groundGlassM5sProposalIdentityKey(
      strategies[3]!.descriptor,
    ));
  });

  it("does not let a Halton-only PASS qualify missing methods or seeds (F7)", () => {
    const { strategies, reports } = validAnalyticEvidence();
    const authority = evaluateGroundGlassM5sAnalyticAuthority({
      requiredStrategies: strategies.map(({ descriptor }) => descriptor),
      observedParticipants: strategies.map((strategy) => ({
        descriptor: strategy.descriptor,
        coordinateFingerprint: fingerprintGroundGlassM5sProposalCoordinates(strategy),
      })),
      analyticResults: [reports[1]!],
    });
    expect(authority.status).toBe("invalid");
    expect(authority.qualifiedStrategyIds).toHaveLength(1);
    const evidence = passingEvidence({ analyticAuthority: authority });
    expect(evidence.classification).toBe("invalid-comparison");
    expect(evidence.referenceAuthority).toBe("none");
  });

  it("does not let identical numerical outputs override one failed method's analytic evidence (F8)", () => {
    const result = matrixFor({
      strategyTransform: (strategy) => strategy.descriptor.method === "golden-angle-count-dependent"
        ? { descriptor: strategy.descriptor, proposalAt: (index) => {
          const [x, y] = strategy.proposalAt(index);
          return [x * 0.5, y * 0.5];
        } }
        : strategy,
    });
    expect(result.study.highTierCrossMethodAgreement.every(({ metrics }) => metrics.rmse === 0)).toBe(true);
    expect(result.study.evidence.classification).toBe("analytically-invalid");
  });

  it("rejects analytic evidence for a different sample tier or algorithm revision (F9)", () => {
    const { strategies, reports } = validAnalyticEvidence();
    const wrongTier = {
      ...reports[0]!,
      sampleCount: 512,
    } as GroundGlassM5sAnalyticControlReport;
    const wrongMethod = {
      ...reports[1]!,
      method: "golden-angle-count-dependent",
    } as GroundGlassM5sAnalyticControlReport;
    const wrongRevision = {
      ...reports[1]!,
      algorithmRevision: "unreviewed-proposal-revision",
    } as unknown as GroundGlassM5sAnalyticControlReport;
    const reportSets = [
      reports.map((_report, index) => index === 0 ? wrongTier : reports[index]!),
      reports.map((_report, index) => index === 1 ? wrongMethod : reports[index]!),
      reports.map((_report, index) => index === 1 ? wrongRevision : reports[index]!),
    ];
    for (const analyticResults of reportSets) {
      const authority = evaluateGroundGlassM5sAnalyticAuthority({
        requiredStrategies: strategies.map(({ descriptor }) => descriptor),
        observedParticipants: strategies.map((strategy) => ({
          descriptor: strategy.descriptor,
          coordinateFingerprint: fingerprintGroundGlassM5sProposalCoordinates(strategy),
        })),
        analyticResults,
      });
      expect(authority.status).toBe("invalid");
      expect(authority.qualifiedStrategyIds).toHaveLength(3);
    }
  });

  it("serializes one consistent analytic status from method to stratum and aggregate (F10)", () => {
    const result = matrixFor({
      strategyTransform: (strategy) => strategy.descriptor.method === "golden-angle-count-dependent"
        ? { descriptor: strategy.descriptor, proposalAt: (index) => {
          const [x, y] = strategy.proposalAt(index);
          return [x * 0.5, y * 0.5];
        } }
        : strategy,
    });
    const aggregate = aggregateGroundGlassM5sStrata([result.study]);
    const serialized = JSON.parse(JSON.stringify({
      methodStatuses: result.analyticResults.map(({ strategyId, analyticStatus }) => ({ strategyId, analyticStatus })),
      stratumAuthority: result.study.evidence.analyticAuthority,
      stratumClassification: result.study.evidence.classification,
      aggregate,
    })) as {
      methodStatuses: readonly { strategyId: string; analyticStatus: string }[];
      stratumAuthority: { status: string };
      stratumClassification: string;
      aggregate: { classification: string; referenceAuthority: string };
    };
    expect(serialized.methodStatuses.some(({ analyticStatus }) => analyticStatus === "failed")).toBe(true);
    expect(serialized.stratumAuthority.status).toBe("failed");
    expect(serialized.stratumClassification).toBe("analytically-invalid");
    expect(serialized.aggregate.classification).toBe("analytically-invalid");
    expect(serialized.aggregate.referenceAuthority).toBe("unresolved");
  });

  it("keeps the tracked M5S report compact while retaining reproducibility and native evidence", () => {
    const report = JSON.parse(readFileSync(
      "docs/architecture/GROUND_GLASS_M5S_REFERENCE_CONVERGENCE_REPORT.json", "utf8",
    )) as {
      nativeRuntime: { browserProject: string; rendererFamily: string; actualExecutionApi: string };
      samplingFamilies: {
        methods: readonly string[];
        sampleCounts: readonly number[];
        randomizedSeeds: readonly number[];
        samplingPatterns: readonly Record<string, unknown>[];
      };
      analyticValidation: {
        authority: { status: string; expectedStrategyIds: readonly string[]; observedStrategyIds: readonly string[] };
        strategies: readonly { method: string; sampleCount: number; seed: number | null; analyticStatus: string }[];
      };
      perSequenceEvidence: readonly { inputFingerprints: object; descriptor: object; acceptedProposalCounts: readonly number[] }[];
      opticalStates: readonly { captureIds: object; inputFingerprints: object; roiStrata: readonly Record<string, unknown>[] }[];
    };
    expect(report.nativeRuntime).toEqual(expect.objectContaining({
      browserProject: "chrome-native-webgpu", rendererFamily: "webgpu-renderer", actualExecutionApi: "webgpu",
    }));
    expect(report.samplingFamilies.methods).toEqual([
      "golden-angle-count-dependent",
      "halton-2-3-progressive",
      "seeded-stratified-square-to-disk",
    ]);
    expect(report.samplingFamilies.sampleCounts).toEqual([32, 64, 128, 256, 512, 1024]);
    expect(report.samplingFamilies.randomizedSeeds).toEqual([104729, 130363]);
    expect(report.samplingFamilies.samplingPatterns.length).toBeGreaterThan(0);
    expect(report.samplingFamilies.samplingPatterns.every((pattern) =>
      !Object.hasOwn(pattern, "proposals") && typeof pattern.coordinateFingerprint === "string"
      && typeof pattern.proposalAudit === "object" && typeof pattern.descriptor === "object"
      && typeof pattern.proposalCount === "number")).toBe(true);
    const highTierPatterns = report.samplingFamilies.samplingPatterns.filter((pattern) =>
      (pattern.descriptor as { sampleCount?: number }).sampleCount === 1024);
    expect(highTierPatterns.map((pattern) => {
      const descriptor = pattern.descriptor as { method: string; seed: number | null; algorithmRevision: string };
      return [descriptor.method, descriptor.seed, descriptor.algorithmRevision];
    })).toEqual([
      ["golden-angle-count-dependent", null, "ground-glass-m5s-proposal-v1"],
      ["halton-2-3-progressive", null, "ground-glass-m5s-proposal-v1"],
      ["seeded-stratified-square-to-disk", 104729, "ground-glass-m5s-proposal-v1"],
      ["seeded-stratified-square-to-disk", 130363, "ground-glass-m5s-proposal-v1"],
    ]);
    expect(report.analyticValidation.authority.status).toBe("passed");
    expect(report.analyticValidation.authority.expectedStrategyIds).toHaveLength(4);
    expect(report.analyticValidation.authority.observedStrategyIds).toHaveLength(4);
    expect(report.analyticValidation.strategies.map(({ method, sampleCount, seed, analyticStatus }) =>
      [method, sampleCount, seed, analyticStatus])).toEqual([
      ["golden-angle-count-dependent", 1024, null, "passed"],
      ["halton-2-3-progressive", 1024, null, "passed"],
      ["seeded-stratified-square-to-disk", 1024, 104729, "passed"],
      ["seeded-stratified-square-to-disk", 1024, 130363, "passed"],
    ]);
    expect(report.perSequenceEvidence.length).toBeGreaterThan(0);
    expect(report.perSequenceEvidence.every(({ inputFingerprints, descriptor, acceptedProposalCounts }) =>
      Object.keys(inputFingerprints).length === 4 && Object.keys(descriptor).length > 0
      && acceptedProposalCounts.length === 10)).toBe(true);
    expect(report.opticalStates.some(({ roiStrata }) => roiStrata.some((stratum) =>
      Array.isArray(stratum.convergenceCurves) && Array.isArray(stratum.highTierCrossMethodAgreement)
      && typeof stratum.evidence === "object"))).toBe(true);
    expect(report.opticalStates.every(({ captureIds, inputFingerprints }) =>
      Object.keys(captureIds).includes("full32") && Object.keys(captureIds).includes("full64")
      && Object.keys(inputFingerprints).length === 4)).toBe(true);
  });
});
