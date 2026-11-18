import { expect, test, type Page } from "@playwright/test";

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

type StudyViewDefinition = {
  positionM: readonly number[];
  targetM: readonly number[];
  fovDeg: number;
  nearM: number;
  farM: number;
};

type GeometryBaselineIdentity = {
  id: string;
  fixtureVersion: string;
  modelIdentity: string;
  paneIds: string[];
  sampledPaneIdsByView: Record<"A" | "B" | "C", string[]>;
  sampleCountsByPaneByView: Record<"A" | "B" | "C", Record<string, number>>;
  sampleFractions: readonly number[];
  views: Record<"A" | "B" | "C", StudyViewDefinition>;
  probeAOriginM: readonly number[];
  historicalReference: {
    id: "PR S corrected Probe A — historical-only";
    baseSha: string;
    source: "docs/LOCAL_REFLECTION_TECHNIQUE_DECISION.md, PR S section";
  };
};

type SampleDomain = Record<"A" | "B" | "C", {
  paneCount: number;
  totalPaneSamples: number;
  visibleFrontFaceSamples: number;
  physicalFiniteHitCount: number;
  physicalNoHitCount: number;
  sampleFractions: readonly number[];
}>;

type DiagnosticProof = {
  mode: "diagnostic";
  geometryBaseline: GeometryBaselineIdentity;
  sampleDomain: SampleDomain;
  probeAOnly: Record<"A" | "B" | "C", GeometryMetrics>;
};

type CoverageProof = {
  mode: "full";
  geometryBaseline: GeometryBaselineIdentity;
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
  views: Record<"A" | "B" | "C", StudyViewDefinition>;
  sampleDomain: SampleDomain;
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
    holdoutExcludedFromPlacement: true;
    rankingOrder: readonly string[];
    evaluatedProbeBPairCount: number;
    bestTwo: PublicConfiguration & { probeB: { id: string; originM: readonly number[] }; placementRank: number };
    topPairRankings: Array<{
      rank: number;
      probeIds: string[];
      probeOriginsM: Record<string, readonly number[]>;
      probeBOriginM: readonly number[];
      sameObjectHitCount: number;
      falseNegativeCount: number;
      falsePositiveCount: number;
      wrongObjectCount: number;
      p95QErrorM: number | null;
      p95AngularErrorDeg: number | null;
    }>;
    probeBMateriallyImprovesProbeA: boolean;
    evaluatedThreeProbeConfigurationCount: number;
    topTripleRankings: Array<{
      rank: number;
      probeIds: string[];
      probeOriginsM: Record<string, readonly number[]>;
      sameObjectHitCount: number;
      falseNegativeCount: number;
      falsePositiveCount: number;
      wrongObjectCount: number;
      p95QErrorM: number | null;
      p95AngularErrorDeg: number | null;
    }>;
    greedyBestPairExtension: PublicConfiguration & {
      probeB: { id: string; originM: readonly number[] };
      probeC: { id: string; originM: readonly number[] };
    };
    globalBestThree: PublicConfiguration & {
      probeB: { id: string; originM: readonly number[] };
      probeC: { id: string; originM: readonly number[] };
      placementRank: number;
      differsFromGreedyBestPairExtension: boolean;
      marginalVsBestTwo: {
        sameObjectHits: number;
        falseNegatives: number;
        falsePositives: number;
        wrongObjects: number;
        falsePositiveRateChange: number;
        p95QErrorChangeM: number;
        p95AngularErrorChangeDeg: number;
      };
    };
    threeProbeComplexityGate: {
      thresholds: {
        sameObjectGainAtLeast: number;
        falseNegativeReductionAtLeast: number;
        maxFalsePositiveRateIncrease: number;
        maxWrongObjectCountIncrease: number;
      };
      passed: boolean;
    };
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

declare global {
  interface Window {
    __architectureRiseMultiProbeCoverage?: { proof: unknown };
  }
}

const verifyMultiProbeDiagnostic = async (page: Page): Promise<void> => {
  await page.goto("/src/tests/e2e/fixtures/architecture-rise-multiprobe-coverage.html?mode=diagnostic");
  const body = page.locator("body");
  await expect.poll(async () =>
    (await body.getAttribute("data-proof-ready")) === "true" ||
    (await body.getAttribute("data-proof-error")) !== null,
  { timeout: 60_000 }).toBe(true);
  expect(await body.getAttribute("data-proof-error")).toBeNull();
  expect(await body.getAttribute("data-proof-ready")).toBe("true");

  const proof = await page.evaluate(() => {
    const result = window.__architectureRiseMultiProbeCoverage?.proof as DiagnosticProof | undefined;
    if (!result || result.mode !== "diagnostic") {
      throw new Error("Multi-Probe diagnostic did not publish the measured v2 sampling domain");
    }
    return result as DiagnosticProof;
  });
  console.info("Architecture Rise v2 pre-gate measured domain:", JSON.stringify(proof));
  expect(proof.geometryBaseline.id).toBe("architecture-rise-v2-seven-front-pane-east-mullion-exterior");
  expect(proof.geometryBaseline.paneIds).toEqual([
    "architecture-rise-window-ground-left-glazing",
    "architecture-rise-window-ground-right-glazing",
    "architecture-rise-window-middle-center-glazing",
    "architecture-rise-window-middle-left-glazing",
    "architecture-rise-window-middle-right-glazing",
    "architecture-rise-window-top-center-glazing",
    "architecture-rise-window-top-left-glazing",
  ]);
  expect(proof.geometryBaseline.sampleFractions).toEqual([0.1, 0.3, 0.7, 0.9]);
  expect(proof.geometryBaseline.sampleCountsByPaneByView.A).toMatchObject({
    "architecture-rise-window-ground-left-glazing": 9,
    "architecture-rise-window-ground-right-glazing": 12,
    "architecture-rise-window-middle-left-glazing": 9,
    "architecture-rise-window-middle-center-glazing": 9,
    "architecture-rise-window-middle-right-glazing": 12,
    "architecture-rise-window-top-left-glazing": 9,
    "architecture-rise-window-top-center-glazing": 9,
  });
  for (const viewId of ["A", "B", "C"] as const) {
    const domain = proof.sampleDomain[viewId];
    const probeA = proof.probeAOnly[viewId];
    expect(domain).toMatchObject({ paneCount: 7, totalPaneSamples: 112 });
    expect(domain.visibleFrontFaceSamples)
      .toBe(domain.physicalFiniteHitCount + domain.physicalNoHitCount);
    expect(probeA.sampleCount).toBe(domain.visibleFrontFaceSamples);
  }
  expect(proof.sampleDomain).toMatchObject({
    A: { visibleFrontFaceSamples: 69, physicalFiniteHitCount: 35, physicalNoHitCount: 34 },
    B: { visibleFrontFaceSamples: 42, physicalFiniteHitCount: 42, physicalNoHitCount: 0 },
    C: { visibleFrontFaceSamples: 63, physicalFiniteHitCount: 20, physicalNoHitCount: 43 },
  });
  expect(proof.probeAOnly.A).toMatchObject({
    candidateValidCount: 11, sameObjectHitCount: 5, wrongObjectCount: 4,
    falsePositiveCount: 2, falseNegativeCount: 26, p95QErrorM: 3.3174128832766003,
    p95AngularErrorDeg: 3.582669912367314,
  });
  expect(proof.probeAOnly.B).toMatchObject({
    candidateValidCount: 0, sameObjectHitCount: 0, wrongObjectCount: 0,
    falsePositiveCount: 0, falseNegativeCount: 42,
  });
  expect(proof.probeAOnly.C).toMatchObject({
    candidateValidCount: 3, sameObjectHitCount: 2, wrongObjectCount: 1,
    falsePositiveCount: 0, falseNegativeCount: 17, p95QErrorM: 5.755903167780692,
    p95AngularErrorDeg: 11.534030040784835,
  });
};

const verifyInvalidBaselineIdentity = async (page: Page): Promise<void> => {
  await page.goto(
    "/src/tests/e2e/fixtures/architecture-rise-multiprobe-coverage.html?expectedBaselineIdentity=architecture-rise-v1-legacy-layout",
  );
  const body = page.locator("body");
  await expect.poll(async () => (await body.getAttribute("data-proof-error")) !== null, { timeout: 60_000 }).toBe(true);
  expect(await body.getAttribute("data-proof-error")).toContain("geometry baseline identity mismatch");
  expect(await body.getAttribute("data-proof-error")).toContain("architecture-rise-v1-legacy-layout");
  expect(await body.getAttribute("data-proof-ready")).toBe("false");
  expect(await page.evaluate(() => window.__architectureRiseMultiProbeCoverage?.proof)).toBeUndefined();
};

const runFullMultiProbeStudy = async (page: Page): Promise<void> => {
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
  { timeout: 240_000 }).toBe(true);
  expect(await body.getAttribute("data-proof-error"), "CPU multi-Probe study must fail closed").toBeNull();
  await expect(page.locator("canvas")).toHaveCount(0);

  const proof = await page.evaluate(() => {
    const result = window.__architectureRiseMultiProbeCoverage?.proof as CoverageProof | undefined;
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
    pairConfigurations: proof.placement.evaluatedProbeBPairCount,
    tripleConfigurations: proof.placement.evaluatedThreeProbeConfigurationCount,
    topPairRankings: proof.placement.topPairRankings,
    topTripleRankings: proof.placement.topTripleRankings,
    greedyBestPairExtension: {
      probeIds: proof.placement.greedyBestPairExtension.probeIds,
      training: summarizeView(proof.placement.greedyBestPairExtension.combined.trainingAB),
      holdoutC: summarizeView(proof.placement.greedyBestPairExtension.combined.byView.C),
    },
    globalBestThree: {
      probeIds: proof.placement.globalBestThree.probeIds,
      origins: proof.placement.globalBestThree.probeOriginsM,
      metrics: summarizeConfiguration(proof.placement.globalBestThree.combined),
      marginalVsBestTwo: proof.placement.globalBestThree.marginalVsBestTwo,
      differsFromGreedyBestPairExtension: proof.placement.globalBestThree.differsFromGreedyBestPairExtension,
    },
    threeProbeComplexityGate: proof.placement.threeProbeComplexityGate,
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
  expect(proof.mode).toBe("full");
  expect(proof.geometryBaseline.id).toBe("architecture-rise-v2-seven-front-pane-east-mullion-exterior");
  expect(proof.geometryBaseline.historicalReference).toMatchObject({
    id: "PR S corrected Probe A — historical-only",
    baseSha: "635fd868063759e61c284046d0bac0515ee82632",
  });
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
    expect(proof.sampleDomain[viewId].paneCount).toBe(7);
    expect(proof.sampleDomain[viewId].totalPaneSamples).toBe(112);
    expect(proof.sampleDomain[viewId].visibleFrontFaceSamples)
      .toBe(proof.sampleDomain[viewId].physicalFiniteHitCount + proof.sampleDomain[viewId].physicalNoHitCount);
  }

  expect(proof.probeAOnly.baselineGate.passed).toBe(true);
  expect(proof.probeAOnly.baselineGate.expectedAuthority).toContain(proof.geometryBaseline.id);
  expect(proof.probeAOnly.originM).toEqual([-1.2725, 1.5, 6.972]);
  expect(proof.probeAOnly.byView.A).toMatchObject({
    sampleCount: 69,
    physicalFiniteHitCount: 35,
    physicalNoHitCount: 34,
    candidateValidCount: 11,
    sameObjectHitCount: 5,
    wrongObjectCount: 4,
    falsePositiveCount: 2,
    falseNegativeCount: 26,
  });
  expect(proof.probeAOnly.byView.A.p95QErrorM).toBeCloseTo(3.3174128832766003, 6);
  expect(proof.probeAOnly.byView.B).toMatchObject({
    sampleCount: 42,
    physicalFiniteHitCount: 42,
    physicalNoHitCount: 0,
    candidateValidCount: 0,
    falseNegativeCount: 42,
  });
  expect(proof.probeAOnly.byView.C).toMatchObject({
    sampleCount: 63,
    physicalFiniteHitCount: 20,
    physicalNoHitCount: 43,
    candidateValidCount: 3,
    sameObjectHitCount: 2,
    wrongObjectCount: 1,
    falsePositiveCount: 0,
    falseNegativeCount: 17,
  });

  expect(proof.search.rawCandidateCount).toBe(80);
  expect(proof.search.rejectedCandidateCount).toBe(9);
  expect(proof.search.validCandidateCount).toBe(71);
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
  expect(proof.placement.holdoutExcludedFromPlacement).toBe(true);
  expect(proof.placement.rankingOrder).toEqual([
    "higher same-object physical-hit count",
    "lower false-negative count",
    "lower false-positive count",
    "lower wrong-object count",
    "lower p95 Q error",
    "lower p95 angular error",
    "lower B grid index, then lower C grid index for unordered triples",
  ]);
  expect(proof.placement.evaluatedProbeBPairCount).toBe(proof.search.validCandidateCount);
  expect(proof.placement.evaluatedProbeBPairCount).toBe(71);
  expect(proof.placement.topPairRankings).toHaveLength(5);
  expect(proof.placement.topPairRankings.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5]);
  expect(proof.placement.bestTwo.placementRank).toBe(1);
  expect(proof.placement.bestTwo.probeB.originM).toHaveLength(3);
  expect(proof.placement.topPairRankings[0].probeBOriginM).toEqual(proof.placement.bestTwo.probeB.originM);
  expect(proof.placement.topPairRankings[0].probeIds).toEqual(proof.placement.bestTwo.combined.probeIds);
  expect(proof.placement.bestTwo.combined.probeIds).toHaveLength(2);
  expect(proof.placement.probeBMateriallyImprovesProbeA).toBe(true);
  const expectedTripleCount = proof.search.validCandidateCount * (proof.search.validCandidateCount - 1) / 2;
  expect(proof.placement.evaluatedThreeProbeConfigurationCount).toBe(expectedTripleCount);
  expect(proof.placement.evaluatedThreeProbeConfigurationCount).toBe(2_485);
  expect(proof.placement.topTripleRankings).toHaveLength(5);
  expect(proof.placement.topTripleRankings.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5]);
  const globalBestThree = proof.placement.globalBestThree;
  expect(globalBestThree.placementRank).toBe(1);
  expect(globalBestThree.combined.probeIds).toHaveLength(3);
  expect(globalBestThree.combined.probeIds[0]).toBe("probe-a-pr-s-r");
  expect(new Set(globalBestThree.combined.probeIds).size).toBe(3);
  expect(globalBestThree.probeB.id).not.toBe(globalBestThree.probeC.id);
  const validCandidateIds = new Set(proof.search.probeOrigins.map((candidate) => candidate.id));
  expect(validCandidateIds.has(globalBestThree.probeB.id)).toBe(true);
  expect(validCandidateIds.has(globalBestThree.probeC.id)).toBe(true);
  const gridIndexById = new Map(proof.search.probeOrigins.map((candidate, index) => [candidate.id, index]));
  expect(gridIndexById.get(globalBestThree.probeB.id) ?? Number.MAX_SAFE_INTEGER)
    .toBeLessThan(gridIndexById.get(globalBestThree.probeC.id) ?? Number.MAX_SAFE_INTEGER);
  expect(proof.placement.topTripleRankings[0].probeIds).toEqual(globalBestThree.combined.probeIds);
  const [topTriple, nextTriple] = proof.placement.topTripleRankings;
  const tripleRankingComparison = [
    nextTriple.sameObjectHitCount - topTriple.sameObjectHitCount,
    topTriple.falseNegativeCount - nextTriple.falseNegativeCount,
    topTriple.falsePositiveCount - nextTriple.falsePositiveCount,
    topTriple.wrongObjectCount - nextTriple.wrongObjectCount,
    (topTriple.p95QErrorM ?? Number.POSITIVE_INFINITY) - (nextTriple.p95QErrorM ?? Number.POSITIVE_INFINITY),
    (topTriple.p95AngularErrorDeg ?? Number.POSITIVE_INFINITY) - (nextTriple.p95AngularErrorDeg ?? Number.POSITIVE_INFINITY),
    (gridIndexById.get(topTriple.probeIds[1]) ?? Number.MAX_SAFE_INTEGER) -
      (gridIndexById.get(nextTriple.probeIds[1]) ?? Number.MAX_SAFE_INTEGER),
    (gridIndexById.get(topTriple.probeIds[2]) ?? Number.MAX_SAFE_INTEGER) -
      (gridIndexById.get(nextTriple.probeIds[2]) ?? Number.MAX_SAFE_INTEGER),
  ].find((difference) => difference !== 0) ?? 0;
  expect(tripleRankingComparison).toBeLessThanOrEqual(0);
  const greedyExtension = proof.placement.greedyBestPairExtension;
  expect(greedyExtension.combined.probeIds).toHaveLength(3);
  expect(greedyExtension.combined.probeIds).toContain(proof.placement.bestTwo.probeB.id);
  expect(greedyExtension.probeB.id).not.toBe(greedyExtension.probeC.id);
  const globalThirdCandidateIds = globalBestThree.combined.probeIds.slice(1).join("|");
  const greedyThirdCandidateIds = greedyExtension.combined.probeIds.slice(1).join("|");
  expect(globalBestThree.differsFromGreedyBestPairExtension)
    .toBe(globalThirdCandidateIds !== greedyThirdCandidateIds);

  const bestTwoTraining = proof.placement.bestTwo.combined.trainingAB.metrics;
  expect(bestTwoTraining).toMatchObject({
    sampleCount: 111,
    physicalFiniteHitCount: 77,
    physicalNoHitCount: 34,
    sameObjectHitCount: 19,
    wrongObjectCount: 23,
    falsePositiveCount: 2,
    falseNegativeCount: 35,
  });
  expect(bestTwoTraining.falsePositiveRate).toBeCloseTo(2 / 34, 10);
  expect(bestTwoTraining.p95QErrorM).toBeCloseTo(4.6150048686432035, 6);
  expect(proof.placement.bestTwo.combined.byView.A.metrics).toMatchObject({
    sameObjectHitCount: 19, wrongObjectCount: 7, falsePositiveCount: 2, falseNegativeCount: 9,
  });
  expect(proof.placement.bestTwo.combined.byView.B.metrics).toMatchObject({
    sameObjectHitCount: 0, wrongObjectCount: 16, falsePositiveCount: 0, falseNegativeCount: 26,
  });
  expect(proof.placement.bestTwo.probeB.id).toBe("probe-grid-32");
  expect(proof.placement.bestTwo.probeB.originM).toEqual([-0.15399999999999991, -0.7999999999999984, 5.800000000000001]);

  const bestThreeTraining = globalBestThree.combined.trainingAB.metrics;
  const marginalVsBestTwo = globalBestThree.marginalVsBestTwo;
  expect(marginalVsBestTwo.sameObjectHits)
    .toBe(bestThreeTraining.sameObjectHitCount - bestTwoTraining.sameObjectHitCount);
  expect(marginalVsBestTwo.falseNegatives)
    .toBe(bestTwoTraining.falseNegativeCount - bestThreeTraining.falseNegativeCount);
  expect(marginalVsBestTwo.falsePositives)
    .toBe(bestThreeTraining.falsePositiveCount - bestTwoTraining.falsePositiveCount);
  expect(marginalVsBestTwo.wrongObjects)
    .toBe(bestThreeTraining.wrongObjectCount - bestTwoTraining.wrongObjectCount);
  expect(marginalVsBestTwo.falsePositiveRateChange)
    .toBeCloseTo((bestThreeTraining.falsePositiveRate ?? 0) - (bestTwoTraining.falsePositiveRate ?? 0), 10);
  expect(marginalVsBestTwo.p95QErrorChangeM)
    .toBeCloseTo((bestThreeTraining.p95QErrorM ?? 0) - (bestTwoTraining.p95QErrorM ?? 0), 10);
  expect(marginalVsBestTwo.p95AngularErrorChangeDeg)
    .toBeCloseTo((bestThreeTraining.p95AngularErrorDeg ?? 0) - (bestTwoTraining.p95AngularErrorDeg ?? 0), 10);
  expect(marginalVsBestTwo.sameObjectHits).toBe(0);
  expect(marginalVsBestTwo.falseNegatives).toBe(2);
  expect(marginalVsBestTwo.falsePositives).toBe(0);
  expect(marginalVsBestTwo.wrongObjects).toBe(2);
  expect(globalBestThree.differsFromGreedyBestPairExtension).toBe(false);
  expect(proof.placement.threeProbeComplexityGate.thresholds).toEqual({
    sameObjectGainAtLeast: 5,
    falseNegativeReductionAtLeast: 5,
    maxFalsePositiveRateIncrease: 0.05,
    maxWrongObjectCountIncrease: 5,
  });
  const gateShouldPass =
    (marginalVsBestTwo.sameObjectHits >= 5 || marginalVsBestTwo.falseNegatives >= 5) &&
    marginalVsBestTwo.falsePositiveRateChange <= 0.05 && marginalVsBestTwo.wrongObjects <= 5;
  expect(proof.placement.threeProbeComplexityGate.passed).toBe(gateShouldPass);
  expect(proof.placement.threeProbeComplexityGate.passed).toBe(false);
  expect(globalBestThree.combined.byView.C.metrics.sampleCount)
    .toBe(proof.sampleDomain.C.visibleFrontFaceSamples);
  expect(globalBestThree.combined.byView.C.metrics).toMatchObject({
    sameObjectHitCount: 17, wrongObjectCount: 1, falsePositiveCount: 1, falseNegativeCount: 2,
  });
  expect(greedyExtension.combined.byView.C.metrics.sampleCount)
    .toBe(proof.sampleDomain.C.visibleFrontFaceSamples);

  const expectedSelectedProbeCount = 2;
  expect(proof.placement.selectedConfiguration.selectedProbeCount).toBe(expectedSelectedProbeCount);
  expect(proof.placement.selectedConfiguration.combined.probeIds)
    .toHaveLength(proof.placement.selectedConfiguration.selectedProbeCount);
  expect(proof.placement.selectedConfiguration.combined.probeIds[0]).toBe("probe-a-pr-s-r");
  expect(proof.placement.selectedConfiguration.holdoutC.metrics.sampleCount)
    .toBe(proof.sampleDomain.C.visibleFrontFaceSamples);
  expect(proof.placement.selectedConfiguration.combined.probeIds)
    .toEqual(proof.placement.bestTwo.combined.probeIds);
  for (const viewId of ["A", "B", "C"] as const) {
    const selection = proof.placement.selectedConfiguration.selectionByView[viewId];
    expect(Object.values(selection.validCandidateOverlap).reduce((sum, count) => sum + count, 0))
      .toBe(proof.sampleDomain[viewId].visibleFrontFaceSamples);
    expect(selection.multiValidSameObjectCount).toBeLessThanOrEqual(selection.multiValidSampleCount);
    expect(Object.keys(selection.selectedByProbe)).toHaveLength(expectedSelectedProbeCount);
  }

  const holdout = proof.placement.selectedConfiguration.holdoutC.metrics;
  expect(holdout.physicalFiniteHitCount).toBe(20);
  expect(holdout.physicalNoHitCount).toBe(43);
  expect(holdout.sameObjectCoverage).not.toBeNull();
  expect(holdout.falsePositiveRate).not.toBeNull();
  expect(holdout.falseNegativeCount + holdout.sameObjectHitCount + holdout.wrongObjectCount)
    .toBe(holdout.physicalFiniteHitCount);
  expect(holdout.candidateValidCount + holdout.candidateNoHitCount).toBe(holdout.sampleCount);
  expect(holdout.falsePositiveCount).toBeLessThanOrEqual(holdout.physicalNoHitCount);
  expect(holdout.falseNegativeCount).toBeLessThanOrEqual(holdout.physicalFiniteHitCount);
  expect(holdout.sameObjectHitCount).toBe(17);
  expect(holdout.wrongObjectCount).toBe(1);
  expect(holdout.sameObjectCoverage).toBeCloseTo(0.85, 10);
  expect(holdout.wrongObjectRate).toBeCloseTo(0.05, 10);
  expect(holdout.falseNegativeCount).toBe(2);
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
  expect(proof.decision.basis.join(" ")).toContain("holdout C same-object hits changed from");
  expect(proof.decision.basis.join(" ")).toContain("View B false negatives changed from 42 to 26");
};

const runMeasuredVerificationStage = async (
  name: string,
  run: () => Promise<void>,
  failures: string[],
): Promise<void> => {
  const startedAt = Date.now();
  let failure: string | undefined;
  try {
    await test.step(name, run);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${failure}`);
  }
  console.info("Architecture Rise Multi-Probe verification stage:", JSON.stringify({
    name,
    status: failure ? "failed" : "passed",
    elapsedMs: Date.now() - startedAt,
    ...(failure ? { failure } : {}),
  }));
};

test("Architecture Rise bounded multi-Probe CPU study protects the placement and holdout conclusion", async ({ page }) => {
  test.setTimeout(300_000);
  const stageFailures: string[] = [];

  // Each helper navigates to its own fixture URL, so the invalid-identity state cannot leak into the full study.
  // A failed step is recorded and later stages still run; the final assertion makes every stage mandatory.
  await runMeasuredVerificationStage("Stage 1 — geometry sampling diagnostic", () => verifyMultiProbeDiagnostic(page), stageFailures);
  await runMeasuredVerificationStage("Stage 2 — invalid baseline identity negative control", () => verifyInvalidBaselineIdentity(page), stageFailures);
  await runMeasuredVerificationStage("Stage 3 — full bounded CPU study", () => runFullMultiProbeStudy(page), stageFailures);

  expect(stageFailures, `Every Multi-Probe verification stage must pass:\n${stageFailures.join("\n")}`).toEqual([]);
});
