import { expect, test } from "@playwright/test";

type GeometryMetrics = {
  sampleCount: number;
  physicalFiniteHitCount: number;
  physicalNoHitCount: number;
  candidateValidCount: number;
  candidateNoHitCount: number;
  sameObjectHitCount: number;
  wrongObjectCount: number;
  falsePositiveCount: number;
  falseNegativeCount: number;
  sameObjectCoverage: number | null;
  falsePositiveRate: number | null;
  falseNegativeRate: number | null;
  wrongObjectRate: number | null;
  medianQErrorM: number | null;
  p95QErrorM: number | null;
  medianAngularErrorDeg: number | null;
  p95AngularErrorDeg: number | null;
};

type ConfigurationView = {
  metrics: GeometryMetrics;
  selection: {
    validCandidateOverlap: Record<string, number>;
    selectedByProbe: Record<string, { count: number; fraction: number }>;
    multiValidSampleCount: number;
    multiValidSameObjectCount: number;
    multiValidSameObjectRate: number | null;
    selectedResidualMedianM: number | null;
    selectedResidualP95M: number | null;
    candidateRuntimeDiagnostics: Record<string, {
      validCount: number;
      medianResidualM: number | null;
      p95ResidualM: number | null;
      medianCorrectionDirectionChangeDeg: number | null;
      medianFinalRadialDistanceM: number | null;
    }>;
  };
};

type ConfigurationEvaluation = {
  probeIds: string[];
  byView: Record<"A" | "B" | "C", ConfigurationView>;
  trainingAB: ConfigurationView;
};

type PublicConfiguration = {
  probeIds: string[];
  probeOriginsM: Record<string, readonly number[]>;
  probeOnlyMetrics: Record<string, Record<"A" | "B" | "C", GeometryMetrics>>;
  combined: ConfigurationEvaluation;
  marginalVsProbeA: {
    sameObjectHits: number;
    falseNegatives: number;
    falsePositives: number;
    p95QErrorM: number | null;
  };
};

type CoverageProof = {
  baseSha: string;
  phase: string;
  probeContract: {
    probeAOriginM: readonly number[];
    correctionUpdates: number;
    correctionAuthority: string;
    selection: string;
    selectionInputs: readonly string[];
    selectionUsesPhysicalQ: boolean;
    selectionUsesPhysicalHitObject: boolean;
    blending: boolean;
  };
  views: Record<"A" | "B" | "C", { positionM: readonly number[]; targetM: readonly number[]; fovDeg: number; nearM: number; farM: number }>;
  sampleDomain: Record<"A" | "B" | "C", {
    paneCount: number;
    totalPaneSamples: number;
    visibleFrontFaceSamples: number;
    physicalFiniteHitCount: number;
    physicalNoHitCount: number;
    sampleFractions: readonly number[];
  }>;
  search: {
    derivation: readonly string[];
    boundsM: { x: { min: number; max: number }; y: { min: number; max: number }; z: { min: number; max: number } };
    gridSize: { x: number; y: number; z: number };
    rawCandidateCount: number;
    rejectedCandidateCount: number;
    validCandidateCount: number;
    rejectionCounts: Record<string, number>;
    evaluatedCandidateCount: number;
    probeOrigins: Array<{ id: string; originM: readonly number[] }>;
    selectedProbeOrigins: Array<{ id: string; originM: readonly number[] }>;
    probeNearM: number;
    duplicateToleranceM: number;
  };
  probeAOnly: {
    originM: readonly number[];
    byView: Record<"A" | "B" | "C", GeometryMetrics>;
    trainingAB: GeometryMetrics;
    baselineGate: { passed: boolean; expectedAuthority: string };
  };
  placement: {
    optimizedViews: readonly ["A", "B"];
    holdoutView: "C";
    rankingOrder: readonly string[];
    evaluatedProbeBPairCount: number;
    bestTwo: PublicConfiguration & { probeB: { id: string; originM: readonly number[] }; placementRank: number };
    topTwoProbeRankings: Array<{
      rank: number;
      probeBOriginM: readonly number[];
      sameObjectHitCount: number;
      falseNegativeCount: number;
      falsePositiveCount: number;
      wrongObjectCount: number;
      p95QErrorM: number | null;
      p95AngularErrorDeg: number | null;
    }>;
    probeBMateriallyImprovesProbeA: boolean;
    evaluatedProbeCCount: number;
    bestThree: (PublicConfiguration & {
      probeC: { id: string; originM: readonly number[] };
      placementRank: number;
      marginalVsBestTwo: { sameObjectHits: number; falseNegatives: number; falsePositives: number };
    }) | null;
    selectedConfiguration: PublicConfiguration & {
      holdoutC: ConfigurationView;
      selectedProbeCount: number;
      selectionByView: Record<"A" | "B" | "C", ConfigurationView["selection"]>;
    };
  };
  resourceScaling: {
    nominalBytesPerColorCube: number;
    nominalBytesPerDistanceCube: number;
    nominalMebibytesPerCorrectedProbe: number;
    selectedProbeCount: number;
    selectedNominalMebibytes: number;
    captureSceneRendersByProbeCount: Record<"1" | "2" | "3", number>;
    correctedDistanceSamplesPerPanePixelByProbeCount: Record<"1" | "2" | "3", number>;
    winningColorSamplesPerPanePixel: number;
    hardwareGpuTiming: string;
    worldChangeRecaptureScalesAs: string;
  };
  decision: {
    classification: string;
    basis: readonly string[];
    gpuValidationPerformed: boolean;
    recommendation: string;
  };
};

test("Architecture Rise bounded multi-Probe CPU study protects the placement and holdout conclusion", async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/src/tests/e2e/fixtures/architecture-rise-multiprobe-coverage.html");
  const body = page.locator("body");
  await expect.poll(async () =>
    (await body.getAttribute("data-proof-ready")) === "true" ||
    (await body.getAttribute("data-proof-error")) !== null,
  { timeout: 90_000 }).toBe(true);
  expect(await body.getAttribute("data-proof-error"), "CPU multi-Probe study must fail closed").toBeNull();
  await expect(page.locator("canvas")).toHaveCount(0);

  const proof = await page.evaluate(() => {
    const result = window.__architectureRiseMultiProbeCoverage?.proof;
    if (!result) throw new Error("Multi-Probe CPU study did not publish measurements");
    return result as CoverageProof;
  });
  const summarizeView = (view: ConfigurationView) => ({ metrics: view.metrics, selection: {
    validCandidateOverlap: view.selection.validCandidateOverlap,
    selectedByProbe: view.selection.selectedByProbe,
    multiValidSampleCount: view.selection.multiValidSampleCount,
    multiValidSameObjectCount: view.selection.multiValidSameObjectCount,
    multiValidSameObjectRate: view.selection.multiValidSameObjectRate,
  } });
  const summarizeConfiguration = (configuration: ConfigurationEvaluation) => ({
    train: summarizeView(configuration.trainingAB),
    A: summarizeView(configuration.byView.A),
    B: summarizeView(configuration.byView.B),
    C: summarizeView(configuration.byView.C),
  });
  console.info("Architecture Rise bounded multi-Probe CPU decision summary:", JSON.stringify({
    search: {
      boundsM: proof.search.boundsM,
      gridSize: proof.search.gridSize,
      rawCandidateCount: proof.search.rawCandidateCount,
      rejectedCandidateCount: proof.search.rejectedCandidateCount,
      validCandidateCount: proof.search.validCandidateCount,
      rejectionCounts: proof.search.rejectionCounts,
      selectedProbeOrigins: proof.search.selectedProbeOrigins,
    },
    baselineA: proof.probeAOnly.byView.A,
    baselineB: proof.probeAOnly.byView.B,
    baselineC: proof.probeAOnly.byView.C,
    probeBMateriallyImprovesProbeA: proof.placement.probeBMateriallyImprovesProbeA,
    bestTwo: {
      origin: proof.placement.bestTwo.probeB,
      metrics: summarizeConfiguration(proof.placement.bestTwo.combined),
      marginalVsA: proof.placement.bestTwo.marginalVsProbeA,
    },
    evaluatedProbeCCount: proof.placement.evaluatedProbeCCount,
    bestThree: proof.placement.bestThree ? {
      origin: proof.placement.bestThree.probeC,
      metrics: summarizeConfiguration(proof.placement.bestThree.combined),
      marginalVsBestTwo: proof.placement.bestThree.marginalVsBestTwo,
    } : null,
    selected: {
      probeCount: proof.placement.selectedConfiguration.selectedProbeCount,
      metrics: summarizeConfiguration(proof.placement.selectedConfiguration.combined),
      holdoutC: summarizeView(proof.placement.selectedConfiguration.holdoutC),
      selection: proof.placement.selectedConfiguration.selectionByView,
    },
    resourceScaling: proof.resourceScaling,
    decision: proof.decision,
  }));

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(proof.baseSha).toBe("635fd868063759e61c284046d0bac0515ee82632");
  expect(proof.phase).toContain("CPU ideal one-step Probe study");
  expect(proof.phase).toContain("no color or distance cube is allocated");
  expect(proof.probeContract).toMatchObject({
    probeAOriginM: [-1.2725, 1.5, 6.972],
    correctionUpdates: 1,
    selectionUsesPhysicalQ: false,
    selectionUsesPhysicalHitObject: false,
    blending: false,
  });
  expect(proof.probeContract.selectionInputs).not.toContain("physicalQ");
  expect(proof.probeContract.selectionInputs).not.toContain("physicalHitObject");
  expect(proof.probeContract.correctionAuthority).toContain("probe-distance-cube-correction.ts");
  expect(proof.views.A.positionM).toEqual([6.5, 3, -6.5]);
  expect(proof.views.B.positionM).toEqual([11.037666, 3, 0.323947]);
  proof.views.C.positionM.forEach((value, index) => expect(value).toBeCloseTo([8.768833, 3, -3.0880265][index], 6));
  for (const viewId of ["A", "B", "C"] as const) {
    expect(proof.views[viewId].targetM).toEqual([0, 0.9, 5.6000000000000005]);
    expect(proof.views[viewId]).toMatchObject({ fovDeg: 45, nearM: 0.01, farM: 200 });
    expect(proof.sampleDomain[viewId].paneCount).toBe(16);
    expect(proof.sampleDomain[viewId].totalPaneSamples).toBe(256);
    expect(proof.sampleDomain[viewId].visibleFrontFaceSamples)
      .toBe(proof.sampleDomain[viewId].physicalFiniteHitCount + proof.sampleDomain[viewId].physicalNoHitCount);
  }

  expect(proof.probeAOnly.baselineGate.passed).toBe(true);
  expect(proof.probeAOnly.originM).toEqual([-1.2725, 1.5, 6.972]);
  expect(proof.probeAOnly.byView.A).toMatchObject({
    sampleCount: 238,
    physicalFiniteHitCount: 54,
    physicalNoHitCount: 184,
    sameObjectHitCount: 22,
    wrongObjectCount: 24,
    falsePositiveCount: 46,
    falseNegativeCount: 8,
  });
  expect(proof.probeAOnly.byView.A.p95QErrorM).toBeCloseTo(7.1963, 1);
  expect(proof.probeAOnly.byView.B).toMatchObject({
    sampleCount: 171,
    physicalFiniteHitCount: 29,
    physicalNoHitCount: 142,
    candidateValidCount: 0,
    falseNegativeCount: 29,
  });

  expect(proof.search.rawCandidateCount).toBe(80);
  expect(proof.search.rawCandidateCount).toBeLessThanOrEqual(80);
  expect(proof.search.validCandidateCount).toBeGreaterThanOrEqual(40);
  expect(proof.search.validCandidateCount).toBeLessThanOrEqual(80);
  expect(proof.search.evaluatedCandidateCount).toBe(proof.search.validCandidateCount);
  expect(proof.search.probeOrigins).toHaveLength(proof.search.validCandidateCount);
  expect(proof.search.selectedProbeOrigins).toHaveLength(2);
  expect(proof.search.rejectedCandidateCount + proof.search.validCandidateCount).toBe(proof.search.rawCandidateCount);
  expect(Object.values(proof.search.rejectionCounts).reduce((sum, count) => sum + count, 0))
    .toBe(proof.search.rejectedCandidateCount);
  expect(proof.search.derivation.join(" ")).toContain("front-pane world bounds");
  expect(proof.search.derivation.join(" ")).toContain("ground mesh bounds");
  expect(proof.placement.optimizedViews).toEqual(["A", "B"]);
  expect(proof.placement.holdoutView).toBe("C");
  expect(proof.placement.rankingOrder).toEqual([
    "higher same-object physical-hit count",
    "lower false-negative count",
    "lower false-positive count",
    "lower wrong-object count",
    "lower p95 Q error",
    "lower p95 angular error",
    "fewer Probes when marginal gains do not meet the complexity gate",
    "lower deterministic grid index for candidate ties",
  ]);
  expect(proof.placement.evaluatedProbeBPairCount).toBe(proof.search.validCandidateCount);
  expect(proof.placement.bestTwo.placementRank).toBe(1);
  expect(proof.placement.bestTwo.probeB.originM).toHaveLength(3);
  expect(proof.placement.topTwoProbeRankings[0].probeBOriginM).toEqual(proof.placement.bestTwo.probeB.originM);
  expect(proof.placement.bestTwo.combined.probeIds).toHaveLength(2);
  expect(proof.placement.probeBMateriallyImprovesProbeA).toBe(true);
  expect(proof.placement.evaluatedProbeCCount).toBe(proof.search.validCandidateCount - 1);
  const bestThree = proof.placement.bestThree;
  if (!bestThree) throw new Error("Probe C placement study should be published after the material A+B gain");
  expect(bestThree.placementRank).toBe(1);
  expect(bestThree.combined.probeIds).toHaveLength(3);
  expect(bestThree.probeC.id).not.toBe(proof.placement.bestTwo.probeB.id);

  const bestTwoTraining = proof.placement.bestTwo.combined.trainingAB.metrics;
  expect(bestTwoTraining).toMatchObject({
    physicalFiniteHitCount: 83,
    physicalNoHitCount: 326,
  });
  expect(bestTwoTraining.sameObjectHitCount).toBeGreaterThanOrEqual(70);
  expect(bestTwoTraining.sameObjectHitCount).toBeLessThan(75);
  expect(bestTwoTraining.wrongObjectCount).toBeLessThanOrEqual(10);
  expect(bestTwoTraining.falsePositiveCount).toBeLessThanOrEqual(50);
  expect(bestTwoTraining.falseNegativeCount).toBeLessThanOrEqual(4);
  expect(bestTwoTraining.falsePositiveRate).toBeGreaterThan(0.15);
  expect(bestTwoTraining.falsePositiveRate).toBeLessThan(0.17);
  expect(bestTwoTraining.p95QErrorM).toBeLessThan(1.25);
  expect(proof.placement.bestTwo.combined.byView.A.metrics.sameObjectHitCount).toBeGreaterThanOrEqual(44);
  expect(proof.placement.bestTwo.combined.byView.A.metrics.falsePositiveCount).toBeLessThanOrEqual(46);
  expect(proof.placement.bestTwo.combined.byView.B.metrics.sameObjectHitCount).toBeGreaterThanOrEqual(25);
  expect(proof.placement.bestTwo.combined.byView.B.metrics.falseNegativeCount).toBeLessThanOrEqual(4);
  expect(proof.placement.bestTwo.combined.byView.B.metrics.falsePositiveCount).toBeLessThanOrEqual(5);

  const bestThreeTraining = bestThree.combined.trainingAB.metrics;
  const thirdProbeSameObjectGain = bestThreeTraining.sameObjectHitCount - bestTwoTraining.sameObjectHitCount;
  const thirdProbeFalseNegativeReduction = bestTwoTraining.falseNegativeCount - bestThreeTraining.falseNegativeCount;
  expect(thirdProbeSameObjectGain).toBeGreaterThanOrEqual(0);
  expect(thirdProbeSameObjectGain).toBeLessThan(5);
  expect(thirdProbeFalseNegativeReduction).toBeGreaterThanOrEqual(0);
  expect(thirdProbeFalseNegativeReduction).toBeLessThan(5);
  expect(bestThree.marginalVsBestTwo.falsePositives).toBeLessThanOrEqual(0);
  expect(bestThreeTraining.p95QErrorM).toBeLessThan(1.0);
  expect(bestThree.combined.byView.C.metrics.sameObjectHitCount).toBeGreaterThanOrEqual(33);
  expect(bestThree.combined.byView.C.metrics.sameObjectCoverage).toBeLessThan(0.6);

  expect(proof.placement.selectedConfiguration.selectedProbeCount).toBe(2);
  expect(proof.placement.selectedConfiguration.combined.probeIds)
    .toHaveLength(proof.placement.selectedConfiguration.selectedProbeCount);
  expect(proof.placement.selectedConfiguration.holdoutC.metrics.sampleCount)
    .toBe(proof.sampleDomain.C.visibleFrontFaceSamples);
  expect(proof.placement.selectedConfiguration.selectionByView.A.validCandidateOverlap)
    .toEqual({ "0": 138, "1": 56, "2": 44 });
  expect(proof.placement.selectedConfiguration.selectionByView.A.multiValidSampleCount).toBe(44);
  expect(proof.placement.selectedConfiguration.selectionByView.A.multiValidSameObjectCount).toBe(36);
  expect(proof.placement.selectedConfiguration.selectionByView.B.selectedByProbe[proof.placement.bestTwo.probeB.id].count)
    .toBe(30);

  const holdout = proof.placement.selectedConfiguration.holdoutC.metrics;
  expect(holdout.physicalFiniteHitCount).toBe(64);
  expect(holdout.physicalNoHitCount).toBe(170);
  expect(holdout.sameObjectHitCount).toBeGreaterThanOrEqual(25);
  expect(holdout.sameObjectCoverage).toBeGreaterThan(0.35);
  expect(holdout.sameObjectCoverage).toBeLessThan(0.5);
  expect(holdout.wrongObjectRate).toBeGreaterThan(0.2);
  expect(holdout.falseNegativeCount).toBeGreaterThanOrEqual(20);
  expect(holdout.falsePositiveCount).toBe(0);

  expect(proof.resourceScaling).toMatchObject({
    nominalBytesPerColorCube: 786_432,
    nominalBytesPerDistanceCube: 786_432,
    nominalMebibytesPerCorrectedProbe: 1.5,
    selectedProbeCount: proof.placement.selectedConfiguration.selectedProbeCount,
    selectedNominalMebibytes: proof.placement.selectedConfiguration.selectedProbeCount * 1.5,
    captureSceneRendersByProbeCount: { "1": 12, "2": 24, "3": 36 },
    correctedDistanceSamplesPerPanePixelByProbeCount: { "1": 2, "2": 4, "3": 6 },
    winningColorSamplesPerPanePixel: 1,
    hardwareGpuTiming: "unmeasured",
  });
  expect(proof.decision.gpuValidationPerformed).toBe(false);
  expect(proof.decision.classification)
    .toBe("MULTI-PROBE COVERAGE IMPROVES BUT COMPLEXITY / VALIDITY IS NOT JUSTIFIED");
  expect(proof.decision.basis.join(" ")).toContain("holdout C same-object hits changed from 0 to 27");
});
