import { describe, expect, it } from "vitest";
import {
  evaluateGroundGlassM5qDimensions,
  type GroundGlassM5qDecisionStatus,
  type GroundGlassM5qDimensionId,
  type GroundGlassM5qEvidenceContext,
  type GroundGlassM5qFrozenThresholds,
  type GroundGlassM5qPairedCapEvidence,
  type GroundGlassM5qQualification,
} from "../../render/webgpu/groundGlassM5qQualification";
import type {
  GroundGlassApertureGatherR3Evaluation,
  GroundGlassR3RgbMetrics,
} from "../../render/webgpu/groundGlassApertureGatherQuality";

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

const rgb = (rmse = 0.001, pixelCount = 64): GroundGlassR3RgbMetrics => ({
  status: "measured",
  pixelCount,
  channelCount: pixelCount * 3,
  mae: rmse / 2,
  rmse,
  maximumChannelError: rmse * 2,
});

const sourceDimensions = { widthPx: 8, heightPx: 8 } as const;
const gatherDimensions = { widthPx: 4, heightPx: 4 } as const;
const sampledFilmDimensionsMm = { widthMm: 31.75, heightMm: 25.4 } as const;
const targetFormats = {
  sourceColor: "rgba8unorm",
  physical: "rgba16float",
  validity: "rgba8unorm",
  far: "rgba16float",
  near: "rgba16float",
  b1: "rgba16float",
} as const;

const provenance = (
  captureId: string,
  qualityMode: "half32" | "full32" | "full64",
  maximumRadiusPx = 12,
) => ({
  captureId,
  requestId: "accepted-request-1",
  sceneId: "architecture-rise",
  sceneSourceRevision: "architecture-rise-r1",
  effectiveOpticalRequestFingerprint: "optical-state-fingerprint",
  cameraStateFingerprint: "camera-state-fingerprint",
  qualityMode,
  readbackOrigin: "top" as const,
  sourceDimensions,
  gatherDimensions: qualityMode === "half32" ? gatherDimensions : sourceDimensions,
  sampledFilmDimensionsMm,
  sampleCount: qualityMode === "full64" ? 64 : 32,
  maximumRadiusPx,
  colorDomain: "source-target-readback-values" as const,
  targetFormats,
});

const baseR3 = (): DeepMutable<GroundGlassApertureGatherR3Evaluation> => ({
  schemaVersion: 1,
  evidenceScope: "single-native-webgpu-state",
  captureProvenance: {
    half32: provenance("capture-half32", "half32"),
    full32: provenance("capture-full32", "full32"),
    full64: provenance("capture-full64", "full64"),
  },
  captureIds: {
    half32: "capture-half32",
    full32: "capture-full32",
    full64: "capture-full64",
  },
  requestIds: {
    half32: "accepted-request-1",
    full32: "accepted-request-1",
    full64: "accepted-request-1",
  },
  provenance: {
    status: "matched",
    reasons: [],
    fingerprints: {
      half32: { sourceColor: "source-a", depth: "depth-a", physical: "physical-a", validity: "validity-a" },
      full32: { sourceColor: "source-a", depth: "depth-a", physical: "physical-a", validity: "validity-a" },
      full64: { sourceColor: "source-a", depth: "depth-a", physical: "physical-a", validity: "validity-a" },
    },
  },
  referenceConvergence: {
    status: "converged",
    fullFrame: rgb(0.0001),
    interiorFar: rgb(0.0001),
    depthEdge: rgb(0.0001),
  },
  fullFrameMetrics: {
    half32B1VsFull32: rgb(0.004),
    half32B1VsFull64: rgb(0.005),
    half32B0VsFull32: rgb(0.01),
    half32B0VsFull64: rgb(0.011),
  },
  interiorFarMetrics: {
    status: "measured",
    pixelCount: 64,
    expectedBlurMeanRgbDifference: 0.05,
    expectedBlurMaximumRgbDifference: 0.2,
    half32B1VsFull32: rgb(0.004),
    half32B0VsFull32: rgb(0.01),
  },
  depthEdgeMetrics: {
    status: "measured",
    pixelCount: 32,
    depthEdgePairCount: 24,
    averageDepthDelta: 0.1,
    nearSidePixelCount: 16,
    farSidePixelCount: 16,
    averageFull32RgbEdgeContrast: 0.2,
    half32B1VsFull32: rgb(0.006, 32),
    half32B0VsFull32: rgb(0.02, 32),
    full32VsFull64: rgb(0.0001, 32),
  },
  fallbackMetrics: {
    pixelCount: 16,
    sourceColorMismatchPixelCount: 0,
    meaningfulBlurPixelCount: 4,
    meaningfulBlurFraction: 0.25,
    b1VsFull32: rgb(0.003, 16),
    boundaryGradient: {
      status: "measured",
      pairCount: 24,
      meanRelativeError: 0.1,
      maximumRelativeError: 0.2,
    },
  },
  blurSpreadMetrics: {
    status: "measured",
    roiPixelCount: 64,
    full32ReferenceGradientEnergy: 0.2,
    b1CandidateGradientEnergy: 0.19,
    candidateToReferenceGradientRatio: 0.95,
    relativeGradientError: 0.05,
  },
  foregroundLeakageMetrics: {
    status: "measured",
    depthEdgePixelCount: 32,
    signedBoundaryPairCount: 8,
    signedBoundaryPixelCount: 16,
    half32B1VsFull32AtDepthEdges: rgb(0.006, 32),
    half32B0VsFull32AtDepthEdges: rgb(0.02, 32),
    half32B1VsFull32AtSignedBoundary: rgb(0.006, 16),
  },
  nearInvariance: {
    status: "measured",
    gpuVsCpuRgb: rgb(0.0002, 16),
    gpuVsCpuAlpha: rgb(0.0002, 16),
    beforeVsAfterB1Rgb: rgb(0.00001, 16),
    beforeVsAfterB1Alpha: rgb(0.00001, 16),
    nonzeroCoveragePixelCount: 32,
    fractionalCoveragePixelCount: 16,
    spreadOutsideSharpNearPixelCount: 12,
    nearFarBoundaryCoveragePixelCount: 8,
  },
  radiusCapEvidence: {
    status: "matched",
    maximumUncappedRadiusPx: 20,
    maximumOverrunPx: 8,
    cappedPixelCount: 24,
    reportedMaximumUncappedRadiusPx: 20,
    reportedCappedPixelCount: 24,
    reportedEvidenceMatches: true,
  },
  signedBoundaryEvidence: {
    status: "present",
    adjacentNearFarPairCount: 8,
    participatingPixelCount: 16,
  },
  qualityDecision: {
    status: "not-evaluated",
    reasons: ["M5Q dimension-specific thresholds are evaluated separately"],
    thresholdRevision: null,
    thresholdsFrozenBeforeConfirmatory: false,
  },
} as DeepMutable<GroundGlassApertureGatherR3Evaluation>);

const context: GroundGlassM5qEvidenceContext = {
  opticalStateId: "architecture-rise-focus-mid-f5_6-crop-4x",
  sceneId: "architecture-rise",
  evidenceSource: "registered-app-adapter",
  m5ExecutionPath: "ground-glass-webgpu-adapter",
  sceneSourceRevision: "architecture-rise-r1",
  candidateSelectionReason: "geometry preflight found valid near/far signs and a measurable Full32 blur signal",
  runtime: {
    rendererFamily: "webgpu-renderer",
    actualExecutionApi: "webgpu",
    internalFallback: "none",
    applicationFallback: false,
    rendererRevision: "r186",
  },
};

const thresholds: GroundGlassM5qFrozenThresholds = {
  revision: "m5q-synthetic-test-v1",
  frozenBeforeConfirmatory: true,
  minimumInteriorFarPixels: 16,
  minimumFallbackPixels: 8,
  minimumMeaningfulBlurFallbackPixels: 2,
  minimumFallbackBoundaryPairs: 8,
  minimumSignedBoundaryPairs: 4,
  minimumSignedBoundarySidePixels: 8,
  minimumNearCoveragePixels: 16,
  minimumFractionalCoveragePixels: 4,
  minimumNearFarBoundaryCoveragePixels: 4,
  minimumSpreadOutsideSharpNearPixels: 4,
  minimumStrongOverrunPx: 4,
  minimumCappedPixels: 8,
  maximumReferenceFullFrameRmse: 0.001,
  maximumReferenceChannelError: 0.01,
  maximumReferenceInteriorFarRmse: 0.001,
  maximumReferenceDepthEdgeRmse: 0.001,
  maximumB1FullFrameRmse: 0.01,
  maximumB1InteriorFarRmse: 0.01,
  maximumB1DepthEdgeRmse: 0.01,
  maximumB1SignedBoundaryRmse: 0.01,
  maximumB1FallbackRmse: 0.01,
  maximumBlurGradientRelativeError: 0.2,
  maximumMeaningfulBlurFallbackFraction: 0.3,
  maximumFallbackBoundaryGradientRelativeError: 0.2,
  maximumNearCpuRgbRmse: 0.001,
  maximumNearCpuAlphaRmse: 0.001,
  maximumNearB1RgbMaximumError: 0.001,
  maximumNearB1AlphaMaximumError: 0.001,
  minimumMeaningfulBlurRgbDifference: 0.02,
};

const makePairedCaps = (): DeepMutable<GroundGlassM5qPairedCapEvidence> => ({
  opticalStateId: context.opticalStateId,
  stressedCapPx: 12,
  controlCapPx: 60,
  maximumUncappedRadiusPx: 20,
  stressedCappedPixelCount: 24,
  controlCappedPixelCount: 0,
  captureIds: {
    stressedHalf32: "capture-half32",
    stressedFull32: "capture-full32",
    stressedFull64: "capture-full64",
    controlHalf32: "control-half32",
    controlFull32: "control-full32",
    controlFull64: "control-full64",
  },
  fingerprints: {
    stressed: {
      depth: "depth-a", physical: "physical-a", validity: "validity-a", sourceColor: "source-a", camera: "camera-state-fingerprint",
    },
    control: {
      depth: "depth-a", physical: "physical-a", validity: "validity-a", sourceColor: "source-a", camera: "camera-state-fingerprint",
    },
  },
  sameCapReferences: {
    stressed: {
      fullFrameRmse: 0.0001, fullFramePixelCount: 64, maximumChannelError: 0.0002,
      interiorFarRmse: 0.0001, interiorFarPixelCount: 64, depthEdgeRmse: 0.0001, depthEdgePixelCount: 64,
    },
    control: {
      fullFrameRmse: 0.0001, fullFramePixelCount: 64, maximumChannelError: 0.0002,
      interiorFarRmse: 0.0001, interiorFarPixelCount: 64, depthEdgeRmse: 0.0001, depthEdgePixelCount: 64,
    },
  },
  crossCapSensitivity: {
    full32FarRmse: 0.03,
    half32B1Rmse: 0.04,
    nearRgbRmse: 0,
    nearAlphaRmse: 0,
    fallbackBoundaryGradientDelta: 0.1,
  },
} as DeepMutable<GroundGlassM5qPairedCapEvidence>);

const evaluate = (
  r3: DeepMutable<GroundGlassApertureGatherR3Evaluation> = baseR3(),
  evidenceContext = context,
  frozenThresholds = thresholds,
  pairedCapEvidence: DeepMutable<GroundGlassM5qPairedCapEvidence> | undefined = makePairedCaps(),
) => evaluateGroundGlassM5qDimensions({
  context: evidenceContext,
  r3,
  thresholds: frozenThresholds,
  ...(pairedCapEvidence ? { pairedCapEvidence } : {}),
});

const expectOnlyDimension = (
  result: GroundGlassM5qQualification,
  targetDimension: GroundGlassM5qDimensionId,
  expectedStatus: GroundGlassM5qDecisionStatus,
) => {
  for (const [dimension, decision] of Object.entries(result.dimensions)) {
    expect(decision.status).toBe(dimension === targetDimension ? expectedStatus : "bounded-qualified");
  }
};

describe("Ground Glass M5Q independent R3 dimension decisions", () => {
  it("qualifies synthetic native evidence dimension by dimension and exposes no universal result", () => {
    const result = evaluate();
    expect(Object.values(result.dimensions).map(({ status }) => status))
      .toEqual(Array(7).fill("bounded-qualified"));
    expect(result.evidenceScope).toBe("independent-dimension-decisions-for-one-optical-state");
    expect(result.runtime.actualExecutionApi).toBe("webgpu");
    expect("status" in result).toBe(false);
    expect(result.dimensions.Q5.measurements).toMatchObject({
      radiusCapPx: 12,
      controlRadiusCapPx: 60,
      maximumOverrunPx: 8,
      cappedPixels: 24,
      pairedCapFingerprintsMatch: true,
      stressedCapDepthEdgeReferenceRmse: 0.0001,
      controlCapDepthEdgeReferenceRmse: 0.0001,
    });
  });

  it("rejects non-native or falsely labeled fixture evidence before any Q dimension can qualify", () => {
    const ordinaryWebGlContext: GroundGlassM5qEvidenceContext = {
      ...context,
      runtime: { ...context.runtime, actualExecutionApi: "webgl2", internalFallback: "webgl2" },
    };
    const fallback = evaluate(baseR3(), ordinaryWebGlContext);
    expect(Object.values(fallback.dimensions).every(({ status }) => status === "invalid-comparison")).toBe(true);

    const mislabeledFixtureContext: GroundGlassM5qEvidenceContext = {
      ...context,
      evidenceSource: "registered-app-adapter",
      m5ExecutionPath: "m5-tsl-research-fixture",
    };
    const mislabeled = evaluate(baseR3(), mislabeledFixtureContext);
    expect(Object.values(mislabeled.dimensions).every(({ status }) => status === "invalid-comparison")).toBe(true);
    expect(mislabeled.evidenceSource).toBe("registered-app-adapter");
    expect(mislabeled.dimensions.Q1.evidenceSource).not.toBe("native-research-fixture");
  });

  it("N1/N2/N19: rejects empty far support and the historical weak-blur f/8 signal", () => {
    const baselineF8 = baseR3();
    baselineF8.qualityDecision.status = "insufficient-roi-support";
    baselineF8.interiorFarMetrics = {
      ...baselineF8.interiorFarMetrics,
      status: "insufficient-support",
      pixelCount: 0,
      expectedBlurMeanRgbDifference: 0.000086,
      expectedBlurMaximumRgbDifference: 0.0002,
    };
    const result = evaluate(baselineF8);
    expect(result.dimensions.Q1.status).toBe("insufficient-support");
    expect(result.dimensions.Q6.status).toBe("insufficient-support");
    expect(baselineF8.qualityDecision.status).toBe("insufficient-roi-support");

    const sharpSubstitution = baseR3();
    sharpSubstitution.interiorFarMetrics.expectedBlurMeanRgbDifference = 0;
    expect(evaluate(sharpSubstitution).dimensions.Q1.status).toBe("insufficient-support");
    expect(evaluate(sharpSubstitution).dimensions.Q6.status).toBe("insufficient-support");
  });

  it("N3/N4/N22: rejects mismatched capture fingerprints and repeated capture identity", () => {
    const sourceMismatch = baseR3();
    sourceMismatch.provenance.fingerprints.full64.sourceColor = "source-b";
    expect(evaluate(sourceMismatch).dimensions.Q7.status).toBe("invalid-comparison");

    const cameraMismatch = baseR3();
    cameraMismatch.captureProvenance.full64.cameraStateFingerprint = "different-camera-or-focus";
    expect(evaluate(cameraMismatch).dimensions.Q1.status).toBe("invalid-comparison");

    const selfComparison = baseR3();
    selfComparison.captureIds.full64 = selfComparison.captureIds.full32;
    selfComparison.captureProvenance.full64.captureId = selfComparison.captureProvenance.full32.captureId;
    expect(evaluate(selfComparison).dimensions.Q7.status).toBe("invalid-comparison");
    expect(evaluate(selfComparison).dimensions.Q7.criteria.some((criterion) =>
      criterion.key.includes("reuse a capture identity"))).toBe(true);
  });

  it("N5: separates reference non-convergence from candidate quality failure", () => {
    const unstableReference = baseR3();
    unstableReference.referenceConvergence.status = "not-converged";
    unstableReference.referenceConvergence.fullFrame = rgb(0.2);
    const result = evaluate(unstableReference);
    expect(result.dimensions.Q1.status).toBe("reference-not-converged");
    expect(result.dimensions.Q2.status).toBe("reference-not-converged");
    expect(result.dimensions.Q7.status).toBe("reference-not-converged");
  });

  it("N6/N15: carries upstream provenance and validity rejection forward without inventing raw-buffer evidence", () => {
    const badObservedCenter = baseR3();
    badObservedCenter.provenance.status = "invalid";
    badObservedCenter.provenance.reasons = ["observed B1 center/provenance mismatch"];
    expect(evaluate(badObservedCenter).dimensions.Q1.status).toBe("invalid-comparison");

    const overflowCountedAsNoSignedSupport = baseR3();
    overflowCountedAsNoSignedSupport.provenance.status = "invalid";
    overflowCountedAsNoSignedSupport.provenance.reasons = ["validity-code-2 overflow cannot qualify a signed side"];
    overflowCountedAsNoSignedSupport.depthEdgeMetrics.nearSidePixelCount = 0;
    expect(evaluate(overflowCountedAsNoSignedSupport).dimensions.Q3.status).toBe("invalid-comparison");
    // R3's one-state summary contains no raw validity-code buffer to reclassify here.
  });

  it("N7/N9: rejects wrong source fallback and a sharp fallback halo", () => {
    const wrongFallbackSource = baseR3();
    wrongFallbackSource.fallbackMetrics.sourceColorMismatchPixelCount = 1;
    expectOnlyDimension(evaluate(wrongFallbackSource), "Q2", "candidate-quality-failed");

    const sharpHalo = baseR3();
    sharpHalo.fallbackMetrics.boundaryGradient.meanRelativeError = 0.9;
    expectOnlyDimension(evaluate(sharpHalo), "Q2", "candidate-quality-failed");
  });

  it("N8/N10: scores foreground contamination and suppressed blur as separate failures", () => {
    const contamination = baseR3();
    contamination.foregroundLeakageMetrics.half32B1VsFull32AtSignedBoundary = rgb(0.2, 16);
    expectOnlyDimension(evaluate(contamination), "Q3", "candidate-quality-failed");

    const suppressedBlur = baseR3();
    suppressedBlur.blurSpreadMetrics.relativeGradientError = 0.8;
    const result = evaluate(suppressedBlur);
    expect(result.dimensions.Q6.status).toBe("candidate-quality-failed");
    expect(result.dimensions.Q1.status).toBe("bounded-qualified");
  });

  it("N11/N12/N13: requires actual fractional coverage and independent RGB/alpha agreement", () => {
    const alphaMutation = baseR3();
    alphaMutation.nearInvariance.beforeVsAfterB1Alpha = rgb(0.1, 16);
    expectOnlyDimension(evaluate(alphaMutation), "Q4", "candidate-quality-failed");

    const rgbMutation = baseR3();
    rgbMutation.nearInvariance.gpuVsCpuRgb = rgb(0.1, 16);
    expectOnlyDimension(evaluate(rgbMutation), "Q4", "candidate-quality-failed");

    const noFractionalCoverage = baseR3();
    noFractionalCoverage.nearInvariance.fractionalCoveragePixelCount = 0;
    expectOnlyDimension(evaluate(noFractionalCoverage), "Q4", "insufficient-support");
  });

  it("N14: a depth edge without a valid signed near/far pair cannot qualify Q3", () => {
    const farFarOnly = baseR3();
    farFarOnly.signedBoundaryEvidence = {
      status: "absent",
      adjacentNearFarPairCount: 0,
      participatingPixelCount: 0,
    };
    expect(farFarOnly.depthEdgeMetrics.depthEdgePairCount).toBeGreaterThan(0);
    expectOnlyDimension(evaluate(farFarOnly), "Q3", "insufficient-support");
  });

  it("N16/N17: Q5 needs invariant paired caps and real cap activation", () => {
    const changedDepth = makePairedCaps();
    changedDepth.fingerprints.control.depth = "depth-c";
    const changedDepthResult = evaluate(baseR3(), context, thresholds, changedDepth);
    expectOnlyDimension(changedDepthResult, "Q5", "invalid-comparison");

    const changedPhysical = makePairedCaps();
    changedPhysical.fingerprints.control.physical = "physical-c";
    const changedPhysicalResult = evaluate(baseR3(), context, thresholds, changedPhysical);
    expectOnlyDimension(changedPhysicalResult, "Q5", "invalid-comparison");

    const noOverrun = makePairedCaps();
    noOverrun.stressedCappedPixelCount = 0;
    noOverrun.maximumUncappedRadiusPx = 12;
    const noOverrunR3 = baseR3();
    noOverrunR3.radiusCapEvidence.maximumUncappedRadiusPx = 12;
    noOverrunR3.radiusCapEvidence.maximumOverrunPx = 0;
    noOverrunR3.radiusCapEvidence.cappedPixelCount = 0;
    noOverrunR3.radiusCapEvidence.reportedMaximumUncappedRadiusPx = 12;
    noOverrunR3.radiusCapEvidence.reportedCappedPixelCount = 0;
    const noOverrunResult = evaluate(noOverrunR3, context, thresholds, noOverrun);
    expectOnlyDimension(noOverrunResult, "Q5", "insufficient-support");
    expect(noOverrunResult.dimensions.Q5.measurements.cappedPixels).toBe(0);
    expect(noOverrunResult.dimensions.Q5.measurements.crossCapFull32FarRmse).toBe(0.03);
    expect(noOverrunResult.dimensions.Q5.measurements.crossCapNearAlphaRmse).toBe(0);

    const activeControlCap = makePairedCaps();
    activeControlCap.controlCappedPixelCount = 2;
    expectOnlyDimension(evaluate(baseR3(), context, thresholds, activeControlCap), "Q5", "insufficient-support");

    const noCapDepthEdgeRoi = makePairedCaps();
    noCapDepthEdgeRoi.sameCapReferences.stressed.depthEdgeRmse = null;
    noCapDepthEdgeRoi.sameCapReferences.stressed.depthEdgePixelCount = 0;
    noCapDepthEdgeRoi.sameCapReferences.control.depthEdgeRmse = null;
    noCapDepthEdgeRoi.sameCapReferences.control.depthEdgePixelCount = 0;
    const noCapDepthEdgeR3 = baseR3();
    noCapDepthEdgeR3.referenceConvergence.depthEdge = {
      status: "insufficient-support", pixelCount: 0, channelCount: 0,
      mae: null, rmse: null, maximumChannelError: null,
    };
    const noEdgeResult = evaluate(noCapDepthEdgeR3, context, thresholds, noCapDepthEdgeRoi);
    expect(noEdgeResult.dimensions.Q5.status).toBe("bounded-qualified");
    expect(noEdgeResult.dimensions.Q5.measurements.stressedCapDepthEdgeReferenceRmse).toBeNull();
  });

  it("N23/N24: Q5 cannot pass zero-RMSE references with empty ROIs or fabricated stress metrics", () => {
    const emptyInterior = makePairedCaps();
    emptyInterior.sameCapReferences.stressed.fullFrameRmse = 0;
    emptyInterior.sameCapReferences.stressed.maximumChannelError = 0;
    emptyInterior.sameCapReferences.stressed.interiorFarRmse = 0;
    emptyInterior.sameCapReferences.stressed.interiorFarPixelCount = 0;
    const emptyInteriorR3 = baseR3();
    emptyInteriorR3.referenceConvergence.fullFrame = rgb(0, 64);
    emptyInteriorR3.referenceConvergence.interiorFar = rgb(0, 0);
    const emptyResult = evaluate(emptyInteriorR3, context, thresholds, emptyInterior);
    expect(emptyResult.dimensions.Q5.status).toBe("insufficient-support");
    expect(emptyResult.dimensions.Q5.criteria.find((criterion) =>
      criterion.key === "stressed-cap-reference-roi-support")?.met).toBe(false);

    const underMinimum = makePairedCaps();
    underMinimum.sameCapReferences.control.fullFrameRmse = 0;
    underMinimum.sameCapReferences.control.maximumChannelError = 0;
    underMinimum.sameCapReferences.control.interiorFarRmse = 0;
    underMinimum.sameCapReferences.control.interiorFarPixelCount = thresholds.minimumInteriorFarPixels - 1;
    const underMinimumResult = evaluate(baseR3(), context, thresholds, underMinimum);
    expectOnlyDimension(underMinimumResult, "Q5", "insufficient-support");
    expect(underMinimumResult.dimensions.Q5.criteria.find((criterion) =>
      criterion.key === "control-cap-reference-roi-support")?.met).toBe(false);

    const incompleteFullFrame = makePairedCaps();
    incompleteFullFrame.sameCapReferences.control.fullFramePixelCount = 63;
    expectOnlyDimension(evaluate(baseR3(), context, thresholds, incompleteFullFrame), "Q5", "insufficient-support");

    const wrongStressCapture = makePairedCaps();
    wrongStressCapture.captureIds.stressedHalf32 = "different-half32-capture";
    expectOnlyDimension(evaluate(baseR3(), context, thresholds, wrongStressCapture), "Q5", "invalid-comparison");

    const wrongStressDepth = makePairedCaps();
    wrongStressDepth.fingerprints.stressed.depth = "different-depth-fingerprint";
    expectOnlyDimension(evaluate(baseR3(), context, thresholds, wrongStressDepth), "Q5", "invalid-comparison");

    const fabricatedStressReference = makePairedCaps();
    fabricatedStressReference.sameCapReferences.stressed.fullFrameRmse = 0;
    fabricatedStressReference.sameCapReferences.stressed.maximumChannelError = 0;
    fabricatedStressReference.sameCapReferences.stressed.interiorFarRmse = 0;
    expectOnlyDimension(evaluate(baseR3(), context, thresholds, fabricatedStressReference), "Q5", "invalid-comparison");
  });

  it("N18: a Q1 pass does not convert a failed Q2 or any other dimension into a universal pass", () => {
    const poorFallback = baseR3();
    poorFallback.fallbackMetrics.boundaryGradient.meanRelativeError = 0.9;
    const result = evaluate(poorFallback);
    expectOnlyDimension(result, "Q2", "candidate-quality-failed");
    expect("overallStatus" in result).toBe(false);
    expect(Object.keys(result.dimensions)).toEqual(["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7"]);
  });

  it("keeps Q3, Q4, Q6, and Q7 failure decisions scoped to their own evidence", () => {
    const badSignedBoundary = baseR3();
    badSignedBoundary.foregroundLeakageMetrics.half32B1VsFull32AtSignedBoundary = rgb(0.2, 16);
    const q3Failure = evaluate(badSignedBoundary);
    expectOnlyDimension(q3Failure, "Q3", "candidate-quality-failed");

    const badNearCpu = baseR3();
    badNearCpu.nearInvariance.gpuVsCpuAlpha = rgb(0.1, 16);
    const q4Failure = evaluate(badNearCpu);
    expectOnlyDimension(q4Failure, "Q4", "candidate-quality-failed");

    const suppressedBlur = baseR3();
    suppressedBlur.blurSpreadMetrics.relativeGradientError = 0.8;
    const q6Failure = evaluate(suppressedBlur);
    expectOnlyDimension(q6Failure, "Q6", "candidate-quality-failed");

    const noFallback = baseR3();
    noFallback.fallbackMetrics.pixelCount = 0;
    noFallback.fallbackMetrics.meaningfulBlurPixelCount = 0;
    noFallback.fallbackMetrics.meaningfulBlurFraction = null;
    noFallback.fallbackMetrics.boundaryGradient = {
      status: "insufficient-support",
      pairCount: 0,
      meanRelativeError: null,
      maximumRelativeError: null,
    };
    const noFallbackResult = evaluate(noFallback);
    expect(noFallbackResult.dimensions.Q6.status).toBe("bounded-qualified");
    expect(noFallbackResult.dimensions.Q2.status).toBe("insufficient-support");

    const divergentFull64Candidate = baseR3();
    divergentFull64Candidate.fullFrameMetrics.half32B1VsFull64 = rgb(0.2);
    const q7Failure = evaluate(divergentFull64Candidate);
    expectOnlyDimension(q7Failure, "Q7", "candidate-quality-failed");
  });

  it("N20/N21: preserves source labels and refuses unfrozen thresholds", () => {
    const fixtureAsApp: GroundGlassM5qEvidenceContext = {
      ...context,
      evidenceSource: "registered-app-adapter",
      m5ExecutionPath: "m5-tsl-research-fixture",
    };
    expect(evaluate(baseR3(), fixtureAsApp).dimensions.Q1.status).toBe("invalid-comparison");

    const unfrozen = { ...thresholds, revision: "m5q-exploratory", frozenBeforeConfirmatory: false };
    const result = evaluate(baseR3(), context, unfrozen);
    expect(result.dimensions.Q1.status).toBe("not-evaluated");
    expect(result.dimensions.Q5.status).toBe("not-evaluated");
  });

  it("missing metrics and missing paired-cap evidence cannot silently become zero or pass", () => {
    const missingBlur = baseR3();
    missingBlur.interiorFarMetrics.expectedBlurMeanRgbDifference = null;
    expect(evaluate(missingBlur).dimensions.Q1.status).toBe("insufficient-support");

    const result = evaluateGroundGlassM5qDimensions({ context, r3: baseR3(), thresholds });
    expect(result.dimensions.Q5.status).toBe("insufficient-support");
    expect(result.dimensions.Q5.measurements.controlRadiusCapPx).toBeNull();
  });
});
