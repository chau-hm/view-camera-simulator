import type {
  GroundGlassApertureGatherR3Evaluation,
  GroundGlassR3RgbMetrics,
} from "./groundGlassApertureGatherQuality";

export type GroundGlassM5qDimensionId = "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6" | "Q7";

export const GROUND_GLASS_M5Q_EVALUATOR_REVISION = "m5q-r3-review-fix-2";

export type GroundGlassM5qEvidenceSource = "registered-app-adapter" | "native-research-fixture";

export type GroundGlassM5qRuntimeEvidence = Readonly<{
  rendererFamily: "webgpu-renderer" | "webgl-renderer" | "unknown";
  actualExecutionApi: "webgpu" | "webgl2" | "unknown";
  internalFallback: "none" | "webgl2" | "unknown";
  applicationFallback: boolean | null;
  /** Observed mounted-runtime revision, not candidate policy input. */
  rendererRevision: string | null;
}>;

export type GroundGlassM5qEvidenceContext = Readonly<{
  opticalStateId: string;
  sceneId: string;
  evidenceSource: GroundGlassM5qEvidenceSource;
  /** Identifies the actual M5 adapter or M5 TSL fixture path. */
  m5ExecutionPath: "ground-glass-webgpu-adapter" | "m5-tsl-research-fixture" | "other";
  sceneSourceRevision: string;
  candidateSelectionReason: string;
  runtime: GroundGlassM5qRuntimeEvidence;
}>;

export type GroundGlassM5qPairedCapEvidence = Readonly<{
  opticalStateId: string;
  stressedCapPx: number;
  controlCapPx: number;
  maximumUncappedRadiusPx: number | null;
  stressedCappedPixelCount: number;
  controlCappedPixelCount: number;
  captureIds: Readonly<{
    stressedHalf32: string;
    stressedFull32: string;
    stressedFull64: string;
    controlHalf32: string;
    controlFull32: string;
    controlFull64: string;
  }>;
  fingerprints: Readonly<{
    stressed: Readonly<{
      depth: string;
      physical: string;
      validity: string;
      sourceColor: string;
      camera: string;
    }>;
    control: Readonly<{
      depth: string;
      physical: string;
      validity: string;
      sourceColor: string;
      camera: string;
    }>;
  }>;
  sameCapReferences: Readonly<{
    stressed: Readonly<{
      fullFrameRmse: number | null;
      fullFramePixelCount: number;
      maximumChannelError: number | null;
      interiorFarRmse: number | null;
      interiorFarPixelCount: number;
      depthEdgeRmse: number | null;
      depthEdgePixelCount: number | null;
    }>;
    control: Readonly<{
      fullFrameRmse: number | null;
      fullFramePixelCount: number;
      maximumChannelError: number | null;
      interiorFarRmse: number | null;
      interiorFarPixelCount: number;
      depthEdgeRmse: number | null;
      depthEdgePixelCount: number | null;
    }>;
  }>;
  /** Cross-cap changes are reported independently from the same-cap references. */
  crossCapSensitivity: Readonly<{
    full32FarRmse: number | null;
    half32B1Rmse: number | null;
    nearRgbRmse: number | null;
    nearAlphaRmse: number | null;
    fallbackBoundaryGradientDelta: number | null;
  }>;
}>;

/**
 * M5Q thresholds are a separate, state-scoped contract. Callers must freeze
 * this revision before confirmatory captures; no defaults are supplied here.
 */
export type GroundGlassM5qFrozenThresholds = Readonly<{
  revision: string;
  frozenBeforeConfirmatory: boolean;
  minimumInteriorFarPixels: number;
  minimumFallbackPixels: number;
  minimumMeaningfulBlurFallbackPixels: number;
  minimumFallbackBoundaryPairs: number;
  minimumSignedBoundaryPairs: number;
  minimumSignedBoundarySidePixels: number;
  minimumNearCoveragePixels: number;
  minimumFractionalCoveragePixels: number;
  minimumNearFarBoundaryCoveragePixels: number;
  minimumSpreadOutsideSharpNearPixels: number;
  minimumStrongOverrunPx: number;
  minimumCappedPixels: number;
  maximumReferenceFullFrameRmse: number;
  maximumReferenceChannelError: number;
  maximumReferenceInteriorFarRmse: number;
  maximumReferenceDepthEdgeRmse: number;
  maximumB1FullFrameRmse: number;
  maximumB1InteriorFarRmse: number;
  maximumB1DepthEdgeRmse: number;
  maximumB1SignedBoundaryRmse: number;
  maximumB1FallbackRmse: number;
  maximumBlurGradientRelativeError: number;
  maximumMeaningfulBlurFallbackFraction: number;
  maximumFallbackBoundaryGradientRelativeError: number;
  maximumNearCpuRgbRmse: number;
  maximumNearCpuAlphaRmse: number;
  maximumNearB1RgbMaximumError: number;
  maximumNearB1AlphaMaximumError: number;
  minimumMeaningfulBlurRgbDifference: number;
}>;

export type GroundGlassM5qCriterion = Readonly<{
  key: string;
  category: "support" | "reference" | "quality" | "provenance";
  met: boolean | null;
  requirement: string;
  observed: number | string | boolean | null;
}>;

export type GroundGlassM5qDimensionMeasurements = Readonly<{
  interiorFarPixels: number | null;
  expectedBlurMeanRgbDifference: number | null;
  expectedBlurMaximumRgbDifference: number | null;
  b1InteriorFarRmse: number | null;
  b0InteriorFarRmse: number | null;
  fallbackPixels: number | null;
  meaningfulBlurFallbackPixels: number | null;
  meaningfulBlurFallbackFraction: number | null;
  fallbackBoundaryPairs: number | null;
  fallbackBoundaryMeanRelativeError: number | null;
  fallbackSourceMismatchPixels: number | null;
  signedBoundaryPairCount: number | null;
  signedBoundaryTotalPixels: number | null;
  signedBoundaryNearSidePixels: number | null;
  signedBoundaryFarSidePixels: number | null;
  b1SignedBoundaryRmse: number | null;
  signedBoundaryReferencePixelCount: number | null;
  signedBoundaryReferenceRmse: number | null;
  signedBoundaryReferenceMaximumChannelError: number | null;
  depthEdgeTotalPixels: number | null;
  depthEdgePairs: number | null;
  depthEdgeNearSidePixels: number | null;
  depthEdgeFarSidePixels: number | null;
  b1DepthEdgeRmse: number | null;
  nearCoveragePixels: number | null;
  fractionalNearCoveragePixels: number | null;
  nearFarBoundaryCoveragePixels: number | null;
  spreadOutsideSharpNearPixels: number | null;
  nearCpuRgbRmse: number | null;
  nearCpuAlphaRmse: number | null;
  nearB1RgbMaximumError: number | null;
  nearB1AlphaMaximumError: number | null;
  radiusCapPx: number | null;
  maximumUncappedRadiusPx: number | null;
  maximumOverrunPx: number | null;
  cappedPixels: number | null;
  blurGradientRelativeError: number | null;
  referenceFullFrameRmse: number | null;
  referenceInteriorFarRmse: number | null;
  referenceDepthEdgeRmse: number | null;
  b1FullFrameRmse: number | null;
  b1VsFull64Rmse: number | null;
  controlRadiusCapPx: number | null;
  stressedCapFullFrameReferenceRmse: number | null;
  stressedCapFullFrameReferencePixels: number | null;
  stressedCapInteriorFarReferencePixels: number | null;
  stressedCapDepthEdgeReferencePixels: number | null;
  stressedCapDepthEdgeReferenceRmse: number | null;
  controlCapFullFrameReferenceRmse: number | null;
  controlCapFullFrameReferencePixels: number | null;
  controlCapInteriorFarReferencePixels: number | null;
  controlCapDepthEdgeReferencePixels: number | null;
  controlCapDepthEdgeReferenceRmse: number | null;
  pairedCapFingerprintsMatch: boolean | null;
  crossCapFull32FarRmse: number | null;
  crossCapHalf32B1Rmse: number | null;
  crossCapNearRgbRmse: number | null;
  crossCapNearAlphaRmse: number | null;
  crossCapFallbackBoundaryGradientDelta: number | null;
  stressedCapB1FullFrameRmse: number | null;
  stressedCapB1InteriorFarRmse: number | null;
  stressedCapBlurGradientRelativeError: number | null;
  stressedCapDepthEdgeB1Rmse: number | null;
  stressedCapDepthEdgeQualityCoverage: "measured" | "unavailable" | null;
  stressedCapFallbackB1Rmse: number | null;
  stressedCapFallbackBoundaryGradientRelativeError: number | null;
  stressedCapFallbackQualityCoverage: "measured" | "unavailable" | null;
}>;

export type GroundGlassM5qDecisionStatus =
  | "not-evaluated"
  | "insufficient-support"
  | "invalid-comparison"
  | "reference-not-converged"
  | "candidate-quality-failed"
  | "bounded-qualified";

export type GroundGlassM5qDimensionDecision = Readonly<{
  evaluatorRevision: string;
  dimension: GroundGlassM5qDimensionId;
  status: GroundGlassM5qDecisionStatus;
  opticalStateId: string;
  sceneId: string;
  evidenceSource: GroundGlassM5qEvidenceSource;
  sceneSourceRevision: string;
  candidateSelectionReason: string;
  runtime: GroundGlassM5qRuntimeEvidence;
  thresholdRevision: string | null;
  captureIds: GroundGlassApertureGatherR3Evaluation["captureIds"];
  criteria: readonly GroundGlassM5qCriterion[];
  measurements: GroundGlassM5qDimensionMeasurements;
}>;

export type GroundGlassM5qQualification = Readonly<{
  schemaVersion: 3;
  evaluatorRevision: string;
  evidenceScope: "independent-dimension-decisions-for-one-optical-state";
  opticalStateId: string;
  sceneId: string;
  evidenceSource: GroundGlassM5qEvidenceSource;
  sceneSourceRevision: string;
  candidateSelectionReason: string;
  runtime: GroundGlassM5qRuntimeEvidence;
  thresholdRevision: string | null;
  captureIds: GroundGlassApertureGatherR3Evaluation["captureIds"];
  /** No aggregate status is provided: each R3 dimension stands on its own evidence. */
  dimensions: Readonly<Record<GroundGlassM5qDimensionId, GroundGlassM5qDimensionDecision>>;
}>;

export type GroundGlassM5qEvaluationInput = Readonly<{
  context: GroundGlassM5qEvidenceContext;
  r3: GroundGlassApertureGatherR3Evaluation;
  thresholds: GroundGlassM5qFrozenThresholds;
  pairedCapEvidence?: GroundGlassM5qPairedCapEvidence;
}>;

type Gate = Omit<GroundGlassM5qCriterion, "met"> & Readonly<{ met: boolean | null }>;

const isFiniteNumber = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

const nonEmpty = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim().length > 0;

const measured = (metrics: GroundGlassR3RgbMetrics, minimumPixels: number): boolean =>
  metrics.status === "measured" && Number.isInteger(metrics.pixelCount) && metrics.pixelCount >= minimumPixels
  && isFiniteNumber(metrics.rmse) && isFiniteNumber(metrics.maximumChannelError);

const measuredRgb = (metrics: GroundGlassR3RgbMetrics, minimumPixels: number): boolean =>
  measured(metrics, minimumPixels)
  && Number.isSafeInteger(metrics.channelCount)
  && metrics.channelCount === metrics.pixelCount * 3
  && isFiniteNumber(metrics.mae);

const numberGate = (
  key: string,
  category: Gate["category"],
  observed: number | null,
  predicate: (value: number) => boolean,
  requirement: string,
): Gate => ({
  key,
  category,
  met: isFiniteNumber(observed) ? predicate(observed) : null,
  requirement,
  observed,
});

const booleanGate = (
  key: string,
  category: Gate["category"],
  observed: boolean | null,
  requirement: string,
): Gate => ({ key, category, met: observed, requirement, observed });

const measurement = (
  metrics: GroundGlassApertureGatherR3Evaluation,
  pairedCapEvidence?: GroundGlassM5qPairedCapEvidence,
  pairedCapFingerprintsMatch?: boolean | null,
  q5QualityCoverage?: Readonly<{ depthEdge: boolean; fallback: boolean }>,
): GroundGlassM5qDimensionMeasurements => ({
  interiorFarPixels: metrics.interiorFarMetrics.pixelCount,
  expectedBlurMeanRgbDifference: metrics.interiorFarMetrics.expectedBlurMeanRgbDifference,
  expectedBlurMaximumRgbDifference: metrics.interiorFarMetrics.expectedBlurMaximumRgbDifference,
  b1InteriorFarRmse: metrics.interiorFarMetrics.half32B1VsFull32.rmse,
  b0InteriorFarRmse: metrics.interiorFarMetrics.half32B0VsFull32.rmse,
  fallbackPixels: metrics.fallbackMetrics.pixelCount,
  meaningfulBlurFallbackPixels: metrics.fallbackMetrics.meaningfulBlurPixelCount,
  meaningfulBlurFallbackFraction: metrics.fallbackMetrics.meaningfulBlurFraction,
  fallbackBoundaryPairs: metrics.fallbackMetrics.boundaryGradient.pairCount,
  fallbackBoundaryMeanRelativeError: metrics.fallbackMetrics.boundaryGradient.meanRelativeError,
  fallbackSourceMismatchPixels: metrics.fallbackMetrics.sourceColorMismatchPixelCount,
  signedBoundaryPairCount: metrics.signedBoundaryEvidence.adjacentNearFarPairCount,
  signedBoundaryTotalPixels: metrics.signedBoundaryEvidence.participatingPixelCount,
  signedBoundaryNearSidePixels: metrics.signedBoundaryEvidence.nearSidePixelCount,
  signedBoundaryFarSidePixels: metrics.signedBoundaryEvidence.farSidePixelCount,
  b1SignedBoundaryRmse: metrics.foregroundLeakageMetrics.half32B1VsFull32AtSignedBoundary.rmse,
  signedBoundaryReferencePixelCount: metrics.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.pixelCount,
  signedBoundaryReferenceRmse: metrics.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.rmse,
  signedBoundaryReferenceMaximumChannelError:
    metrics.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.maximumChannelError,
  depthEdgeTotalPixels: metrics.depthEdgeMetrics.pixelCount,
  depthEdgePairs: metrics.depthEdgeMetrics.depthEdgePairCount,
  depthEdgeNearSidePixels: metrics.depthEdgeMetrics.nearSidePixelCount,
  depthEdgeFarSidePixels: metrics.depthEdgeMetrics.farSidePixelCount,
  b1DepthEdgeRmse: metrics.depthEdgeMetrics.half32B1VsFull32.rmse,
  nearCoveragePixels: metrics.nearInvariance.nonzeroCoveragePixelCount,
  fractionalNearCoveragePixels: metrics.nearInvariance.fractionalCoveragePixelCount,
  nearFarBoundaryCoveragePixels: metrics.nearInvariance.nearFarBoundaryCoveragePixelCount,
  spreadOutsideSharpNearPixels: metrics.nearInvariance.spreadOutsideSharpNearPixelCount,
  nearCpuRgbRmse: metrics.nearInvariance.gpuVsCpuRgb.rmse,
  nearCpuAlphaRmse: metrics.nearInvariance.gpuVsCpuAlpha.rmse,
  nearB1RgbMaximumError: metrics.nearInvariance.beforeVsAfterB1Rgb.maximumChannelError,
  nearB1AlphaMaximumError: metrics.nearInvariance.beforeVsAfterB1Alpha.maximumChannelError,
  radiusCapPx: metrics.captureProvenance.half32.maximumRadiusPx,
  maximumUncappedRadiusPx: metrics.radiusCapEvidence.maximumUncappedRadiusPx,
  maximumOverrunPx: metrics.radiusCapEvidence.maximumOverrunPx,
  cappedPixels: metrics.radiusCapEvidence.cappedPixelCount,
  blurGradientRelativeError: metrics.blurSpreadMetrics.relativeGradientError,
  referenceFullFrameRmse: metrics.referenceConvergence.fullFrame.rmse,
  referenceInteriorFarRmse: metrics.referenceConvergence.interiorFar.rmse,
  referenceDepthEdgeRmse: metrics.referenceConvergence.depthEdge.rmse,
  b1FullFrameRmse: metrics.fullFrameMetrics.half32B1VsFull32.rmse,
  b1VsFull64Rmse: metrics.fullFrameMetrics.half32B1VsFull64.rmse,
  controlRadiusCapPx: pairedCapEvidence?.controlCapPx ?? null,
  stressedCapFullFrameReferenceRmse: pairedCapEvidence?.sameCapReferences.stressed.fullFrameRmse ?? null,
  stressedCapFullFrameReferencePixels: pairedCapEvidence?.sameCapReferences.stressed.fullFramePixelCount ?? null,
  stressedCapInteriorFarReferencePixels: pairedCapEvidence?.sameCapReferences.stressed.interiorFarPixelCount ?? null,
  stressedCapDepthEdgeReferencePixels: pairedCapEvidence?.sameCapReferences.stressed.depthEdgePixelCount ?? null,
  stressedCapDepthEdgeReferenceRmse: pairedCapEvidence?.sameCapReferences.stressed.depthEdgeRmse ?? null,
  controlCapFullFrameReferenceRmse: pairedCapEvidence?.sameCapReferences.control.fullFrameRmse ?? null,
  controlCapFullFrameReferencePixels: pairedCapEvidence?.sameCapReferences.control.fullFramePixelCount ?? null,
  controlCapInteriorFarReferencePixels: pairedCapEvidence?.sameCapReferences.control.interiorFarPixelCount ?? null,
  controlCapDepthEdgeReferencePixels: pairedCapEvidence?.sameCapReferences.control.depthEdgePixelCount ?? null,
  controlCapDepthEdgeReferenceRmse: pairedCapEvidence?.sameCapReferences.control.depthEdgeRmse ?? null,
  pairedCapFingerprintsMatch: pairedCapEvidence ? pairedCapFingerprintsMatch ?? false : null,
  crossCapFull32FarRmse: pairedCapEvidence?.crossCapSensitivity.full32FarRmse ?? null,
  crossCapHalf32B1Rmse: pairedCapEvidence?.crossCapSensitivity.half32B1Rmse ?? null,
  crossCapNearRgbRmse: pairedCapEvidence?.crossCapSensitivity.nearRgbRmse ?? null,
  crossCapNearAlphaRmse: pairedCapEvidence?.crossCapSensitivity.nearAlphaRmse ?? null,
  crossCapFallbackBoundaryGradientDelta: pairedCapEvidence?.crossCapSensitivity.fallbackBoundaryGradientDelta ?? null,
  stressedCapB1FullFrameRmse: pairedCapEvidence ? metrics.fullFrameMetrics.half32B1VsFull32.rmse : null,
  stressedCapB1InteriorFarRmse: pairedCapEvidence ? metrics.interiorFarMetrics.half32B1VsFull32.rmse : null,
  stressedCapBlurGradientRelativeError: pairedCapEvidence ? metrics.blurSpreadMetrics.relativeGradientError : null,
  stressedCapDepthEdgeB1Rmse: pairedCapEvidence ? metrics.depthEdgeMetrics.half32B1VsFull32.rmse : null,
  stressedCapDepthEdgeQualityCoverage: pairedCapEvidence
    ? q5QualityCoverage?.depthEdge ? "measured" : "unavailable" : null,
  stressedCapFallbackB1Rmse: pairedCapEvidence ? metrics.fallbackMetrics.b1VsFull32.rmse : null,
  stressedCapFallbackBoundaryGradientRelativeError: pairedCapEvidence
    ? metrics.fallbackMetrics.boundaryGradient.meanRelativeError : null,
  stressedCapFallbackQualityCoverage: pairedCapEvidence
    ? q5QualityCoverage?.fallback ? "measured" : "unavailable" : null,
});

const validateThresholds = (thresholds: GroundGlassM5qFrozenThresholds): string[] => {
  const reasons: string[] = [];
  if (!nonEmpty(thresholds.revision)) reasons.push("M5Q threshold revision is missing");
  if (thresholds.frozenBeforeConfirmatory !== true) reasons.push("M5Q thresholds were not frozen before confirmatory capture");
  const minimumKeys = [
    "minimumInteriorFarPixels", "minimumFallbackPixels", "minimumMeaningfulBlurFallbackPixels",
    "minimumFallbackBoundaryPairs", "minimumSignedBoundaryPairs", "minimumSignedBoundarySidePixels",
    "minimumNearCoveragePixels", "minimumFractionalCoveragePixels", "minimumNearFarBoundaryCoveragePixels",
    "minimumSpreadOutsideSharpNearPixels", "minimumStrongOverrunPx", "minimumCappedPixels",
  ] as const;
  for (const key of minimumKeys) {
    const value = thresholds[key];
    if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
      reasons.push(`${key} must be a positive integer`);
    }
  }
  const maximumKeys = [
    "maximumReferenceFullFrameRmse", "maximumReferenceChannelError", "maximumReferenceInteriorFarRmse",
    "maximumReferenceDepthEdgeRmse", "maximumB1FullFrameRmse", "maximumB1InteriorFarRmse",
    "maximumB1DepthEdgeRmse", "maximumB1SignedBoundaryRmse", "maximumB1FallbackRmse",
    "maximumBlurGradientRelativeError", "maximumMeaningfulBlurFallbackFraction",
    "maximumFallbackBoundaryGradientRelativeError", "maximumNearCpuRgbRmse",
    "maximumNearCpuAlphaRmse", "maximumNearB1RgbMaximumError", "maximumNearB1AlphaMaximumError",
  ] as const;
  for (const key of maximumKeys) {
    const value = thresholds[key];
    if (!Number.isFinite(value) || value < 0) reasons.push(`${key} must be finite and nonnegative`);
  }
  if (!Number.isFinite(thresholds.minimumMeaningfulBlurRgbDifference)
      || thresholds.minimumMeaningfulBlurRgbDifference <= 0) {
    reasons.push("minimumMeaningfulBlurRgbDifference must be positive");
  }
  if (thresholds.maximumMeaningfulBlurFallbackFraction > 1) {
    reasons.push("maximumMeaningfulBlurFallbackFraction must not exceed one");
  }
  return reasons;
};

const commonProvenanceIssues = (context: GroundGlassM5qEvidenceContext, r3: GroundGlassApertureGatherR3Evaluation): string[] => {
  const issues: string[] = [];
  if (!nonEmpty(context.opticalStateId)) issues.push("optical-state identity is missing");
  if (!nonEmpty(context.sceneId)) issues.push("scene identity is missing");
  if (!nonEmpty(context.sceneSourceRevision)) issues.push("scene source revision is missing");
  if (!nonEmpty(context.candidateSelectionReason)) issues.push("candidate selection reason is missing");
  if (context.m5ExecutionPath === "other") issues.push("capture did not use the actual Ground Glass M5 adapter or TSL fixture");
  if (context.evidenceSource === "registered-app-adapter"
      && context.m5ExecutionPath !== "ground-glass-webgpu-adapter") {
    issues.push("registered application evidence is not bound to the Ground Glass WebGPU adapter");
  }
  if (context.evidenceSource === "native-research-fixture"
      && context.m5ExecutionPath !== "m5-tsl-research-fixture") {
    issues.push("fixture evidence is not bound to the actual M5 TSL research path");
  }
  if (context.runtime.rendererFamily !== "webgpu-renderer"
      || context.runtime.actualExecutionApi !== "webgpu"
      || context.runtime.internalFallback !== "none"
      || context.runtime.applicationFallback !== false
      || !nonEmpty(context.runtime.rendererRevision)) {
    issues.push("native mounted WebGPU runtime identity is incomplete or reports fallback");
  }
  if (r3.evidenceScope !== "single-native-webgpu-state" || r3.provenance.status !== "matched") {
    issues.push("R3 captures are not a matched single-state native comparison");
  }
  const modes = ["half32", "full32", "full64"] as const;
  if (new Set(modes.map((mode) => r3.captureIds[mode])).size !== modes.length) {
    issues.push("quality profiles reuse a capture identity instead of independent captures");
  }
  const referenceProvenance = r3.captureProvenance.full32;
  for (const mode of modes) {
    const provenance = r3.captureProvenance[mode];
    if (!nonEmpty(r3.captureIds[mode]) || !nonEmpty(r3.requestIds[mode])) {
      issues.push(`${mode} capture identity is missing`);
    }
    if (provenance.captureId !== r3.captureIds[mode]
        || provenance.requestId !== r3.requestIds[mode]) {
      issues.push(`${mode} summary identities differ from capture provenance`);
    }
    if (r3.requestIds[mode] !== r3.requestIds.full32) {
      issues.push(`${mode} capture does not belong to the same accepted frame request`);
    }
    if (provenance.sceneId !== context.sceneId || provenance.sceneSourceRevision !== context.sceneSourceRevision) {
      issues.push(`${mode} scene identity or source revision does not match the evidence context`);
    }
    if (!nonEmpty(provenance.effectiveOpticalRequestFingerprint)
        || provenance.effectiveOpticalRequestFingerprint !== referenceProvenance.effectiveOpticalRequestFingerprint) {
      issues.push(`${mode} effective optical request differs from the R3 matrix`);
    }
    if (!nonEmpty(provenance.cameraStateFingerprint)
        || provenance.cameraStateFingerprint !== referenceProvenance.cameraStateFingerprint) {
      issues.push(`${mode} camera state differs from the R3 matrix`);
    }
    if (JSON.stringify(provenance.sourceDimensions) !== JSON.stringify(referenceProvenance.sourceDimensions)
        || JSON.stringify(provenance.sampledFilmDimensionsMm) !== JSON.stringify(referenceProvenance.sampledFilmDimensionsMm)
        || provenance.maximumRadiusPx !== referenceProvenance.maximumRadiusPx
        || provenance.colorDomain !== referenceProvenance.colorDomain
        || JSON.stringify(provenance.targetFormats) !== JSON.stringify(referenceProvenance.targetFormats)) {
      issues.push(`${mode} dimensions, cap, color domain or target formats differ from the R3 matrix`);
    }
  }
  for (const fingerprint of ["sourceColor", "depth", "physical", "validity"] as const) {
    const values = modes.map((mode) => r3.provenance.fingerprints[mode][fingerprint]);
    if (values.some((value) => !nonEmpty(value)) || new Set(values).size !== 1) {
      issues.push(`${fingerprint} readback fingerprints are missing or mismatched`);
    }
  }
  if (r3.captureProvenance.half32.qualityMode !== "half32"
      || r3.captureProvenance.full32.qualityMode !== "full32"
      || r3.captureProvenance.full64.qualityMode !== "full64"
      || r3.captureProvenance.half32.sampleCount !== 32
      || r3.captureProvenance.full32.sampleCount !== 32
      || r3.captureProvenance.full64.sampleCount !== 64) {
    issues.push("R3 quality profile identities do not match Half32/Full32/Full64");
  }
  return issues;
};

const buildDecision = (input: {
  dimension: GroundGlassM5qDimensionId;
  context: GroundGlassM5qEvidenceContext;
  r3: GroundGlassApertureGatherR3Evaluation;
  thresholds: GroundGlassM5qFrozenThresholds;
  thresholdIssues: readonly string[];
  provenanceIssues: readonly string[];
  gates: readonly Gate[];
  pairedCapEvidence?: GroundGlassM5qPairedCapEvidence;
  pairedCapFingerprintsMatch?: boolean | null;
  q5QualityCoverage?: Readonly<{ depthEdge: boolean; fallback: boolean }>;
}): GroundGlassM5qDimensionDecision => {
  const thresholdRevision = nonEmpty(input.thresholds.revision) ? input.thresholds.revision : null;
  const criteria: GroundGlassM5qCriterion[] = [
    ...input.provenanceIssues.map((issue) => ({
      key: `provenance:${issue}`,
      category: "provenance" as const,
      met: false,
      requirement: "all capture and mounted-runtime provenance must match",
      observed: issue,
    })),
    ...input.thresholdIssues.map((issue) => ({
      key: `thresholds:${issue}`,
      category: "provenance" as const,
      met: false,
      requirement: "versioned M5Q thresholds must be valid and frozen before capture",
      observed: issue,
    })),
    ...input.gates.map((gate) => ({ ...gate })),
  ];
  let status: GroundGlassM5qDecisionStatus;
  if (input.provenanceIssues.length || input.gates.some((gate) => gate.category === "provenance" && gate.met === false)) {
    status = "invalid-comparison";
  }
  else if (input.thresholdIssues.length) status = "not-evaluated";
  else if (input.gates.some((gate) => gate.met === null)) status = "insufficient-support";
  else if (input.gates.some((gate) => gate.category === "support" && gate.met !== true)) {
    status = "insufficient-support";
  } else if (input.gates.some((gate) => gate.category === "reference" && gate.met !== true)) {
    status = "reference-not-converged";
  } else if (input.gates.some((gate) => gate.category === "quality" && gate.met !== true)) {
    status = "candidate-quality-failed";
  } else status = "bounded-qualified";

  return {
    evaluatorRevision: GROUND_GLASS_M5Q_EVALUATOR_REVISION,
    dimension: input.dimension,
    status,
    opticalStateId: input.context.opticalStateId,
    sceneId: input.context.sceneId,
    evidenceSource: input.context.evidenceSource,
    sceneSourceRevision: input.context.sceneSourceRevision,
    candidateSelectionReason: input.context.candidateSelectionReason,
    runtime: input.context.runtime,
    thresholdRevision,
    captureIds: input.r3.captureIds,
    criteria,
    measurements: measurement(input.r3, input.pairedCapEvidence, input.pairedCapFingerprintsMatch, input.q5QualityCoverage),
  };
};

const support = (key: string, observed: number | null, minimum: number, description: string): Gate =>
  numberGate(key, "support", observed, (value) => Number.isInteger(value) && value >= minimum, description);

const minimumSignal = (key: string, observed: number | null, minimum: number, description: string): Gate =>
  numberGate(key, "support", observed, (value) => value >= minimum, description);

const quality = (key: string, observed: number | null, maximum: number, description: string): Gate =>
  numberGate(key, "quality", observed, (value) => value <= maximum, description);

const reference = (
  key: string,
  metrics: GroundGlassR3RgbMetrics,
  minimumPixels: number,
  maximumRmse: number,
  maximumChannelError: number,
): Gate[] => [
  booleanGate(`${key}-measured`, "support", measuredRgb(metrics, minimumPixels),
    `matched reference ROI must contain at least ${minimumPixels} finite pixels`),
  numberGate(`${key}-rmse`, "reference", metrics.rmse, (value) => value <= maximumRmse,
    `Full32/Full64 ${key} RMSE must be <= ${maximumRmse}`),
  numberGate(`${key}-maximum-channel-error`, "reference", metrics.maximumChannelError,
    (value) => value <= maximumChannelError,
    `Full32/Full64 ${key} maximum channel error must be <= ${maximumChannelError}`),
];

/**
 * Evaluate each R3 claim independently. A qualified dimension does not qualify
 * another dimension, scene, quality profile, or production backend.
 */
export const evaluateGroundGlassM5qDimensions = (
  input: GroundGlassM5qEvaluationInput,
): GroundGlassM5qQualification => {
  const { context, r3, thresholds } = input;
  const thresholdIssues = validateThresholds(thresholds);
  const provenanceIssues = commonProvenanceIssues(context, r3);
  const sharedReferenceGates = [
    ...reference("full-frame-reference", r3.referenceConvergence.fullFrame, 1,
      thresholds.maximumReferenceFullFrameRmse, thresholds.maximumReferenceChannelError),
    ...reference("interior-far-reference", r3.referenceConvergence.interiorFar,
      thresholds.minimumInteriorFarPixels, thresholds.maximumReferenceInteriorFarRmse,
      thresholds.maximumReferenceChannelError),
    ...reference("depth-edge-reference", r3.referenceConvergence.depthEdge,
      thresholds.minimumSignedBoundarySidePixels, thresholds.maximumReferenceDepthEdgeRmse,
      thresholds.maximumReferenceChannelError),
  ];
  const isReferenceConverged = r3.referenceConvergence.status === "converged";
  const expectedFullFramePixels = r3.captureProvenance.full32.sourceDimensions.widthPx
    * r3.captureProvenance.full32.sourceDimensions.heightPx;
  const q1 = buildDecision({
    dimension: "Q1", context, r3, thresholds, thresholdIssues, provenanceIssues,
    gates: [
      support("interior-far-roi", r3.interiorFarMetrics.status === "measured" ? r3.interiorFarMetrics.pixelCount : null,
        thresholds.minimumInteriorFarPixels, `interior-far ROI must have >= ${thresholds.minimumInteriorFarPixels} pixels`),
      minimumSignal("meaningful-reference-blur", r3.interiorFarMetrics.expectedBlurMeanRgbDifference,
        thresholds.minimumMeaningfulBlurRgbDifference, `Full32/source mean RGB difference must be >= ${thresholds.minimumMeaningfulBlurRgbDifference}`),
      ...reference("interior-far", r3.referenceConvergence.interiorFar,
        thresholds.minimumInteriorFarPixels, thresholds.maximumReferenceInteriorFarRmse,
        thresholds.maximumReferenceChannelError),
      booleanGate("reference-convergence-status", "reference",
        r3.referenceConvergence.interiorFar.status === "measured"
          && isFiniteNumber(r3.referenceConvergence.interiorFar.rmse)
          && r3.referenceConvergence.interiorFar.rmse <= thresholds.maximumReferenceInteriorFarRmse
          && isFiniteNumber(r3.referenceConvergence.interiorFar.maximumChannelError)
          && r3.referenceConvergence.interiorFar.maximumChannelError <= thresholds.maximumReferenceChannelError,
      "Full32/Full64 references must converge on the Q1 interior-far ROI"),
      booleanGate("b1-interior-metric-measured", "support", measured(r3.interiorFarMetrics.half32B1VsFull32,
        thresholds.minimumInteriorFarPixels), "Half32 B1 must be measured against Full32 on the same ROI"),
      quality("b1-interior-far-rmse", r3.interiorFarMetrics.half32B1VsFull32.rmse,
        thresholds.maximumB1InteriorFarRmse, `Half32 B1 interior-far RMSE must be <= ${thresholds.maximumB1InteriorFarRmse}`),
    ],
  });
  const q2 = buildDecision({
    dimension: "Q2", context, r3, thresholds, thresholdIssues, provenanceIssues,
    gates: [
      support("fallback-roi", r3.fallbackMetrics.pixelCount,
        thresholds.minimumFallbackPixels, `fallback population must have >= ${thresholds.minimumFallbackPixels} pixels`),
      support("fallback-with-meaningful-blur", r3.fallbackMetrics.meaningfulBlurPixelCount,
        thresholds.minimumMeaningfulBlurFallbackPixels,
        `meaningfully defocused fallback pixels must be >= ${thresholds.minimumMeaningfulBlurFallbackPixels}`),
      support("fallback-boundary-pairs", r3.fallbackMetrics.boundaryGradient.status === "measured"
        ? r3.fallbackMetrics.boundaryGradient.pairCount : null, thresholds.minimumFallbackBoundaryPairs,
      `fallback boundary must contain >= ${thresholds.minimumFallbackBoundaryPairs} adjacent pairs`),
      booleanGate("fallback-reference-converged", "reference", isReferenceConverged,
        "fallback halo comparison requires a converged Full32/Full64 reference"),
      booleanGate("meaningful-blur-fallback-fraction-measured", "support",
        isFiniteNumber(r3.fallbackMetrics.meaningfulBlurFraction),
        "meaningful-blur fallback fraction must be present"),
      quality("meaningful-blur-fallback-fraction", r3.fallbackMetrics.meaningfulBlurFraction,
        thresholds.maximumMeaningfulBlurFallbackFraction,
      `fraction of fallback pixels with meaningful blur must be <= ${thresholds.maximumMeaningfulBlurFallbackFraction}`),
      quality("fallback-boundary-gradient-error", r3.fallbackMetrics.boundaryGradient.meanRelativeError,
        thresholds.maximumFallbackBoundaryGradientRelativeError,
      `fallback boundary gradient relative error must be <= ${thresholds.maximumFallbackBoundaryGradientRelativeError}`),
      numberGate("fallback-source-mismatch-pixels", "quality", r3.fallbackMetrics.sourceColorMismatchPixelCount,
        (value) => Number.isInteger(value) && value === 0,
        "B1 fallback must preserve source color; zero source-color mismatches are required"),
      booleanGate("fallback-b1-reference-measured", "support", measured(r3.fallbackMetrics.b1VsFull32,
        thresholds.minimumFallbackPixels), "B1 fallback pixels must be compared against matched Full32 output"),
      quality("fallback-b1-full32-rmse", r3.fallbackMetrics.b1VsFull32.rmse,
        thresholds.maximumB1FallbackRmse, `B1 fallback ROI RMSE must be <= ${thresholds.maximumB1FallbackRmse}`),
    ],
  });
  const q3 = buildDecision({
    dimension: "Q3", context, r3, thresholds, thresholdIssues, provenanceIssues,
    gates: [
      booleanGate("signed-boundary-population-invariant", "provenance",
        r3.signedBoundaryEvidence.status !== "invalid"
          && r3.signedBoundaryEvidence.populationConsistent === true
          && Number.isSafeInteger(r3.signedBoundaryEvidence.participatingPixelCount)
          && r3.signedBoundaryEvidence.participatingPixelCount >= 0
          && Number.isSafeInteger(r3.signedBoundaryEvidence.nearSidePixelCount)
          && r3.signedBoundaryEvidence.nearSidePixelCount >= 0
          && Number.isSafeInteger(r3.signedBoundaryEvidence.farSidePixelCount)
          && r3.signedBoundaryEvidence.farSidePixelCount >= 0
          && r3.signedBoundaryEvidence.nearSidePixelCount + r3.signedBoundaryEvidence.farSidePixelCount
            === r3.signedBoundaryEvidence.participatingPixelCount,
        "unique signed-boundary Near and Far pixels must equal the participating source-pixel total"),
      support("signed-near-far-pairs", r3.signedBoundaryEvidence.status === "present"
        ? r3.signedBoundaryEvidence.adjacentNearFarPairCount : null,
      thresholds.minimumSignedBoundaryPairs, `valid signed near/far adjacency must contain >= ${thresholds.minimumSignedBoundaryPairs} pairs`),
      support("signed-boundary-pixels", r3.signedBoundaryEvidence.participatingPixelCount,
        thresholds.minimumSignedBoundarySidePixels, `signed-boundary ROI must contain >= ${thresholds.minimumSignedBoundarySidePixels} pixels`),
      support("signed-boundary-near-side-unique-pixels", r3.signedBoundaryEvidence.status === "present"
        ? r3.signedBoundaryEvidence.nearSidePixelCount : null,
      thresholds.minimumSignedBoundarySidePixels,
      `unique signed-boundary Near-side pixels must be >= ${thresholds.minimumSignedBoundarySidePixels}`),
      support("signed-boundary-far-side-unique-pixels", r3.signedBoundaryEvidence.status === "present"
        ? r3.signedBoundaryEvidence.farSidePixelCount : null,
      thresholds.minimumSignedBoundarySidePixels,
      `unique signed-boundary Far-side pixels must be >= ${thresholds.minimumSignedBoundarySidePixels}`),
      ...reference("signed-boundary", r3.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary,
        thresholds.minimumSignedBoundarySidePixels, thresholds.maximumReferenceDepthEdgeRmse,
        thresholds.maximumReferenceChannelError),
      booleanGate("b1-signed-boundary-measured", "support", measuredRgb(
        r3.foregroundLeakageMetrics.half32B1VsFull32AtSignedBoundary,
        thresholds.minimumSignedBoundarySidePixels), "B1 signed-boundary error must use the valid signed-boundary ROI"),
      quality("b1-signed-boundary-rmse", r3.foregroundLeakageMetrics.half32B1VsFull32AtSignedBoundary.rmse,
        thresholds.maximumB1SignedBoundaryRmse, `B1 signed-boundary RMSE must be <= ${thresholds.maximumB1SignedBoundaryRmse}`),
    ],
  });
  const q4 = buildDecision({
    dimension: "Q4", context, r3, thresholds, thresholdIssues, provenanceIssues,
    gates: [
      support("nonzero-near-coverage", r3.nearInvariance.status === "measured"
        ? r3.nearInvariance.nonzeroCoveragePixelCount : null,
      thresholds.minimumNearCoveragePixels, `nonzero Near coverage must contain >= ${thresholds.minimumNearCoveragePixels} pixels`),
      support("fractional-near-coverage", r3.nearInvariance.fractionalCoveragePixelCount,
        thresholds.minimumFractionalCoveragePixels,
      `fractional Near alpha must contain >= ${thresholds.minimumFractionalCoveragePixels} pixels`),
      support("near-far-boundary-coverage", r3.nearInvariance.nearFarBoundaryCoveragePixelCount,
        thresholds.minimumNearFarBoundaryCoveragePixels,
      `Near coverage on the signed boundary must contain >= ${thresholds.minimumNearFarBoundaryCoveragePixels} pixels`),
      support("near-spread-outside-sharp-object", r3.nearInvariance.spreadOutsideSharpNearPixelCount,
        thresholds.minimumSpreadOutsideSharpNearPixels,
      `Near coverage beyond the sharp near silhouette must contain >= ${thresholds.minimumSpreadOutsideSharpNearPixels} pixels`),
      booleanGate("near-cpu-rgb-measured", "support", measured(
        r3.nearInvariance.gpuVsCpuRgb, thresholds.minimumNearCoveragePixels),
        "GPU Near RGB must be measured against the independent CPU gather oracle"),
      booleanGate("near-cpu-alpha-measured", "support", measured(
        r3.nearInvariance.gpuVsCpuAlpha, thresholds.minimumNearCoveragePixels),
        "GPU Near alpha must be measured against the independent CPU gather oracle"),
      booleanGate("near-b1-rgb-measured", "support", measured(
        r3.nearInvariance.beforeVsAfterB1Rgb, thresholds.minimumNearCoveragePixels),
        "Near RGB must be measured before and after B1"),
      booleanGate("near-b1-alpha-measured", "support", measured(
        r3.nearInvariance.beforeVsAfterB1Alpha, thresholds.minimumNearCoveragePixels),
        "Near alpha must be measured before and after B1"),
      quality("near-cpu-rgb-rmse", r3.nearInvariance.gpuVsCpuRgb.rmse,
        thresholds.maximumNearCpuRgbRmse, `GPU/CPU Near RGB RMSE must be <= ${thresholds.maximumNearCpuRgbRmse}`),
      quality("near-cpu-alpha-rmse", r3.nearInvariance.gpuVsCpuAlpha.rmse,
        thresholds.maximumNearCpuAlphaRmse, `GPU/CPU Near alpha RMSE must be <= ${thresholds.maximumNearCpuAlphaRmse}`),
      quality("near-b1-rgb-maximum-error", r3.nearInvariance.beforeVsAfterB1Rgb.maximumChannelError,
        thresholds.maximumNearB1RgbMaximumError, `B1 Near RGB maximum change must be <= ${thresholds.maximumNearB1RgbMaximumError}`),
      quality("near-b1-alpha-maximum-error", r3.nearInvariance.beforeVsAfterB1Alpha.maximumChannelError,
        thresholds.maximumNearB1AlphaMaximumError, `B1 Near alpha maximum change must be <= ${thresholds.maximumNearB1AlphaMaximumError}`),
    ],
  });
  const capEvidence = input.pairedCapEvidence;
  const capFingerprintsMatch: boolean | null = capEvidence === undefined ? null : [
    [capEvidence.fingerprints.stressed.depth, capEvidence.fingerprints.control.depth],
    [capEvidence.fingerprints.stressed.physical, capEvidence.fingerprints.control.physical],
    [capEvidence.fingerprints.stressed.validity, capEvidence.fingerprints.control.validity],
    [capEvidence.fingerprints.stressed.sourceColor, capEvidence.fingerprints.control.sourceColor],
    [capEvidence.fingerprints.stressed.camera, capEvidence.fingerprints.control.camera],
  ].every(([stressed, control]) => nonEmpty(stressed) && stressed === control);
  const capRadiusEvidenceMatches: boolean | null = capEvidence === undefined ? null
    : isFiniteNumber(capEvidence.maximumUncappedRadiusPx)
      && r3.radiusCapEvidence.maximumUncappedRadiusPx !== null
      && Math.abs(capEvidence.maximumUncappedRadiusPx - r3.radiusCapEvidence.maximumUncappedRadiusPx) <= 0.01
      && capEvidence.stressedCappedPixelCount === r3.radiusCapEvidence.cappedPixelCount;
  const capStressMatchesR3: boolean | null = capEvidence === undefined ? null
    : capEvidence.captureIds.stressedHalf32 === r3.captureIds.half32
      && capEvidence.captureIds.stressedFull32 === r3.captureIds.full32
      && capEvidence.captureIds.stressedFull64 === r3.captureIds.full64
      && capEvidence.fingerprints.stressed.depth === r3.provenance.fingerprints.half32.depth
      && capEvidence.fingerprints.stressed.physical === r3.provenance.fingerprints.half32.physical
      && capEvidence.fingerprints.stressed.validity === r3.provenance.fingerprints.half32.validity
      && capEvidence.fingerprints.stressed.sourceColor === r3.provenance.fingerprints.half32.sourceColor
      && capEvidence.fingerprints.stressed.camera === r3.captureProvenance.half32.cameraStateFingerprint;
  const capStressReferencesMatchR3: boolean | null = capEvidence === undefined ? null
    : capEvidence.sameCapReferences.stressed.fullFrameRmse === r3.referenceConvergence.fullFrame.rmse
      && capEvidence.sameCapReferences.stressed.fullFramePixelCount === r3.referenceConvergence.fullFrame.pixelCount
      && capEvidence.sameCapReferences.stressed.maximumChannelError
        === r3.referenceConvergence.fullFrame.maximumChannelError
      && capEvidence.sameCapReferences.stressed.interiorFarRmse === r3.referenceConvergence.interiorFar.rmse
      && capEvidence.sameCapReferences.stressed.interiorFarPixelCount === r3.referenceConvergence.interiorFar.pixelCount
      && capEvidence.sameCapReferences.stressed.depthEdgeRmse === r3.referenceConvergence.depthEdge.rmse
      && capEvidence.sameCapReferences.stressed.depthEdgePixelCount === r3.referenceConvergence.depthEdge.pixelCount;
  const capReferenceConverged = (value: GroundGlassM5qPairedCapEvidence["sameCapReferences"]["stressed"]) =>
    isFiniteNumber(value.fullFrameRmse)
      && isFiniteNumber(value.maximumChannelError)
      && isFiniteNumber(value.interiorFarRmse)
      && value.fullFrameRmse <= thresholds.maximumReferenceFullFrameRmse
      && value.maximumChannelError <= thresholds.maximumReferenceChannelError
      && value.interiorFarRmse <= thresholds.maximumReferenceInteriorFarRmse
      && (value.depthEdgeRmse === null
        || (isFiniteNumber(value.depthEdgeRmse) && value.depthEdgeRmse <= thresholds.maximumReferenceDepthEdgeRmse));
  const capReferenceHasSupport = (value: GroundGlassM5qPairedCapEvidence["sameCapReferences"]["stressed"]) =>
    Number.isSafeInteger(expectedFullFramePixels)
      && Number.isSafeInteger(value.fullFramePixelCount)
      && value.fullFramePixelCount === expectedFullFramePixels
      && Number.isSafeInteger(value.interiorFarPixelCount)
      && value.interiorFarPixelCount >= thresholds.minimumInteriorFarPixels
      && (value.depthEdgeRmse === null
        ? value.depthEdgePixelCount === null || value.depthEdgePixelCount === 0
        : Number.isSafeInteger(value.depthEdgePixelCount)
          && (value.depthEdgePixelCount ?? 0) > 0);
  const q5DepthEdgeQualityApplicable = r3.depthEdgeMetrics.status === "measured"
    && Number.isSafeInteger(r3.depthEdgeMetrics.pixelCount)
    && r3.depthEdgeMetrics.pixelCount >= thresholds.minimumSignedBoundarySidePixels;
  const q5FallbackQualityApplicable = Number.isSafeInteger(r3.fallbackMetrics.pixelCount)
    && r3.fallbackMetrics.pixelCount >= thresholds.minimumFallbackPixels
    && Number.isSafeInteger(r3.fallbackMetrics.meaningfulBlurPixelCount)
    && r3.fallbackMetrics.meaningfulBlurPixelCount >= thresholds.minimumMeaningfulBlurFallbackPixels
    && r3.fallbackMetrics.boundaryGradient.status === "measured"
    && Number.isSafeInteger(r3.fallbackMetrics.boundaryGradient.pairCount)
    && r3.fallbackMetrics.boundaryGradient.pairCount >= thresholds.minimumFallbackBoundaryPairs;
  const q5QualityCoverage = { depthEdge: q5DepthEdgeQualityApplicable, fallback: q5FallbackQualityApplicable } as const;
  const q5 = buildDecision({
    dimension: "Q5", context, r3, thresholds, thresholdIssues, provenanceIssues,
    pairedCapEvidence: capEvidence,
    pairedCapFingerprintsMatch: capFingerprintsMatch,
    q5QualityCoverage,
    gates: [
      booleanGate("paired-cap-evidence-present", "support", capEvidence !== undefined,
        "paired lower-cap/control-cap native capture evidence is required"),
      booleanGate("paired-cap-state-matches", "provenance",
        capEvidence === undefined ? null : capEvidence.opticalStateId === context.opticalStateId,
        "paired cap captures must use this exact optical state"),
      booleanGate("cap-fingerprint-invariance", "provenance", capFingerprintsMatch,
        "depth/source geometry, physical CoC, validity, source color and camera fingerprints must be unchanged between caps"),
      booleanGate("paired-cap-radius-evidence-matches-r3", "provenance", capRadiusEvidenceMatches,
        "paired stress-cap radius evidence must match the independently recomputed R3 metrics"),
      booleanGate("stressed-cap-captures-match-r3", "provenance", capStressMatchesR3,
        "the paired stress-cap capture IDs and input fingerprints must match this exact R3 matrix"),
      booleanGate("stressed-cap-references-match-r3", "provenance", capStressReferencesMatchR3,
        "stress-cap reference metrics and ROI counts must be copied from this exact R3 Full32/Full64 comparison"),
      booleanGate("stressed-cap-reference-roi-support", "support", capEvidence === undefined ? null
        : capReferenceHasSupport(capEvidence.sameCapReferences.stressed),
      `stressed-cap references require the complete ${expectedFullFramePixels}-pixel full frame and at least ${thresholds.minimumInteriorFarPixels} interior-far pixels`),
      booleanGate("control-cap-reference-roi-support", "support", capEvidence === undefined ? null
        : capReferenceHasSupport(capEvidence.sameCapReferences.control),
      `control-cap references require the complete ${expectedFullFramePixels}-pixel full frame and at least ${thresholds.minimumInteriorFarPixels} interior-far pixels`),
      booleanGate("same-cap-reference-convergence", "reference", capEvidence === undefined ? null
        : capReferenceConverged(capEvidence.sameCapReferences.stressed)
          && capReferenceConverged(capEvidence.sameCapReferences.control),
      "Full32/Full64 references must converge separately under both declared cap settings"),
      booleanGate("stressed-cap-b1-full-frame-measured", "support",
        measuredRgb(r3.fullFrameMetrics.half32B1VsFull32, expectedFullFramePixels)
          && r3.fullFrameMetrics.half32B1VsFull32.pixelCount === expectedFullFramePixels,
      `stressed Half32 B1 must be measured against Full32 over the complete ${expectedFullFramePixels}-pixel source frame`),
      quality("stressed-cap-b1-full-frame-rmse", r3.fullFrameMetrics.half32B1VsFull32.rmse,
        thresholds.maximumB1FullFrameRmse,
      `stressed-cap Half32 B1 full-frame RMSE must be <= ${thresholds.maximumB1FullFrameRmse}`),
      booleanGate("stressed-cap-b1-interior-far-measured", "support",
        measuredRgb(r3.interiorFarMetrics.half32B1VsFull32, thresholds.minimumInteriorFarPixels)
          && r3.interiorFarMetrics.half32B1VsFull32.pixelCount === r3.interiorFarMetrics.pixelCount,
      `stressed Half32 B1 must be measured over at least ${thresholds.minimumInteriorFarPixels} interior-far pixels`),
      quality("stressed-cap-b1-interior-far-rmse", r3.interiorFarMetrics.half32B1VsFull32.rmse,
        thresholds.maximumB1InteriorFarRmse,
      `stressed-cap Half32 B1 interior-far RMSE must be <= ${thresholds.maximumB1InteriorFarRmse}`),
      minimumSignal("stressed-cap-meaningful-reference-blur", r3.interiorFarMetrics.expectedBlurMeanRgbDifference,
        thresholds.minimumMeaningfulBlurRgbDifference,
      `stressed-cap Full32/source interior-far blur must be >= ${thresholds.minimumMeaningfulBlurRgbDifference}`),
      booleanGate("stressed-cap-blur-spread-measured", "support",
        r3.blurSpreadMetrics.status === "measured"
          && Number.isSafeInteger(r3.blurSpreadMetrics.roiPixelCount)
          && r3.blurSpreadMetrics.roiPixelCount >= thresholds.minimumInteriorFarPixels
          && isFiniteNumber(r3.blurSpreadMetrics.full32ReferenceGradientEnergy)
          && isFiniteNumber(r3.blurSpreadMetrics.b1CandidateGradientEnergy)
          && isFiniteNumber(r3.blurSpreadMetrics.relativeGradientError),
      "stressed-cap candidate and Full32 reference gradients must be measured on the interior-far ROI"),
      quality("stressed-cap-blur-gradient-relative-error", r3.blurSpreadMetrics.relativeGradientError,
        thresholds.maximumBlurGradientRelativeError,
      `stressed-cap B1 blur-gradient relative error must be <= ${thresholds.maximumBlurGradientRelativeError}`),
      ...(q5DepthEdgeQualityApplicable ? [
        booleanGate("stressed-cap-depth-edge-b1-measured", "support",
          measuredRgb(r3.depthEdgeMetrics.half32B1VsFull32, thresholds.minimumSignedBoundarySidePixels)
            && r3.depthEdgeMetrics.half32B1VsFull32.pixelCount === r3.depthEdgeMetrics.pixelCount,
        "applicable stressed-cap depth-edge B1 quality must be measured on the complete depth-edge ROI"),
        quality("stressed-cap-depth-edge-b1-rmse", r3.depthEdgeMetrics.half32B1VsFull32.rmse,
          thresholds.maximumB1DepthEdgeRmse,
        `stressed-cap B1 depth-edge RMSE must be <= ${thresholds.maximumB1DepthEdgeRmse}`),
      ] : []),
      ...(q5FallbackQualityApplicable ? [
        booleanGate("stressed-cap-fallback-b1-measured", "support",
          measuredRgb(r3.fallbackMetrics.b1VsFull32, thresholds.minimumFallbackPixels)
            && r3.fallbackMetrics.b1VsFull32.pixelCount === r3.fallbackMetrics.pixelCount,
        "applicable stressed-cap fallback B1 quality must be measured on the complete fallback ROI"),
        quality("stressed-cap-fallback-b1-rmse", r3.fallbackMetrics.b1VsFull32.rmse,
          thresholds.maximumB1FallbackRmse,
        `stressed-cap B1 fallback RMSE must be <= ${thresholds.maximumB1FallbackRmse}`),
        booleanGate("stressed-cap-fallback-boundary-gradient-measured", "support",
          isFiniteNumber(r3.fallbackMetrics.boundaryGradient.meanRelativeError),
        "applicable stressed-cap fallback boundary gradient error must be measured"),
        quality("stressed-cap-fallback-boundary-gradient-error", r3.fallbackMetrics.boundaryGradient.meanRelativeError,
          thresholds.maximumFallbackBoundaryGradientRelativeError,
        `stressed-cap fallback boundary gradient relative error must be <= ${thresholds.maximumFallbackBoundaryGradientRelativeError}`),
        quality("stressed-cap-meaningful-blur-fallback-fraction", r3.fallbackMetrics.meaningfulBlurFraction,
          thresholds.maximumMeaningfulBlurFallbackFraction,
        `stressed-cap meaningful-blur fallback fraction must be <= ${thresholds.maximumMeaningfulBlurFallbackFraction}`),
        numberGate("stressed-cap-fallback-source-mismatches", "quality",
          r3.fallbackMetrics.sourceColorMismatchPixelCount,
          (value) => Number.isSafeInteger(value) && value === 0,
          "stressed-cap source fallback must preserve source color"),
      ] : []),
      booleanGate("paired-cap-capture-identities", "support", capEvidence === undefined ? null
        : Object.values(capEvidence.captureIds).every(nonEmpty)
          && new Set(Object.values(capEvidence.captureIds)).size === 6,
        "all six Half32/Full32/Full64 cap-comparison captures must have distinct recorded IDs"),
      numberGate("strong-overrun", "support", capEvidence?.maximumUncappedRadiusPx ?? null,
        (value) => value - (capEvidence?.stressedCapPx ?? Infinity) >= thresholds.minimumStrongOverrunPx,
        `valid far radius must overrun the stressed cap by >= ${thresholds.minimumStrongOverrunPx} px`),
      numberGate("stressed-cap-active-pixels", "support", capEvidence?.stressedCappedPixelCount ?? null,
        (value) => Number.isInteger(value) && value >= thresholds.minimumCappedPixels,
        `stressed cap must affect >= ${thresholds.minimumCappedPixels} valid far pixels`),
      booleanGate("stressed-cap-matches-r3-matrix", "provenance", capEvidence === undefined ? null
        : capEvidence.stressedCapPx === r3.captureProvenance.half32.maximumRadiusPx
          && r3.radiusCapEvidence.status === "matched",
      "the stressed cap must match the R3 Half32 matrix and recomputed physical radius evidence"),
      booleanGate("paired-caps-are-distinct", "support", capEvidence !== undefined
        && Number.isFinite(capEvidence.stressedCapPx)
        && Number.isFinite(capEvidence.controlCapPx)
        && capEvidence.stressedCapPx > 0
        && capEvidence.controlCapPx > capEvidence.stressedCapPx,
      "the stress cap must be positive and lower than the control cap"),
      numberGate("control-cap-inactive", "support", capEvidence?.controlCappedPixelCount ?? null,
        (value) => Number.isSafeInteger(value) && value === 0,
        "the control cap must leave every valid far footprint uncapped"),
    ],
  });
  const q6 = buildDecision({
    dimension: "Q6", context, r3, thresholds, thresholdIssues, provenanceIssues,
    gates: [
      support("interior-far-roi", r3.interiorFarMetrics.status === "measured" ? r3.interiorFarMetrics.pixelCount : null,
        thresholds.minimumInteriorFarPixels, `interior-far ROI must have >= ${thresholds.minimumInteriorFarPixels} pixels`),
      minimumSignal("meaningful-reference-blur", r3.interiorFarMetrics.expectedBlurMeanRgbDifference,
        thresholds.minimumMeaningfulBlurRgbDifference, `Full32/source blur must be >= ${thresholds.minimumMeaningfulBlurRgbDifference}`),
      ...reference("interior-far", r3.referenceConvergence.interiorFar,
        thresholds.minimumInteriorFarPixels, thresholds.maximumReferenceInteriorFarRmse,
        thresholds.maximumReferenceChannelError),
      booleanGate("reference-convergence-status", "reference",
        r3.referenceConvergence.interiorFar.status === "measured"
          && isFiniteNumber(r3.referenceConvergence.interiorFar.rmse)
          && r3.referenceConvergence.interiorFar.rmse <= thresholds.maximumReferenceInteriorFarRmse
          && isFiniteNumber(r3.referenceConvergence.interiorFar.maximumChannelError)
          && r3.referenceConvergence.interiorFar.maximumChannelError <= thresholds.maximumReferenceChannelError,
      "Full32/Full64 references must converge on the Q6 interior-far ROI"),
      booleanGate("blur-spread-measured", "support", r3.blurSpreadMetrics.status === "measured"
        && isFiniteNumber(r3.blurSpreadMetrics.relativeGradientError),
      "B1 and Full32 blur spread must be measured on the same interior-far ROI"),
      quality("blur-spread-relative-error", r3.blurSpreadMetrics.relativeGradientError,
        thresholds.maximumBlurGradientRelativeError,
      `B1 blur-gradient relative error must be <= ${thresholds.maximumBlurGradientRelativeError}`),
      quality("b1-interior-far-rmse", r3.interiorFarMetrics.half32B1VsFull32.rmse,
        thresholds.maximumB1InteriorFarRmse, `Half32 B1 interior-far RMSE must be <= ${thresholds.maximumB1InteriorFarRmse}`),
    ],
  });
  const q7 = buildDecision({
    dimension: "Q7", context, r3, thresholds, thresholdIssues, provenanceIssues,
    gates: [
      booleanGate("profile-identities", "provenance",
        r3.captureProvenance.half32.qualityMode === "half32"
          && r3.captureProvenance.full32.qualityMode === "full32"
          && r3.captureProvenance.full64.qualityMode === "full64"
          && r3.captureProvenance.half32.sampleCount === 32
          && r3.captureProvenance.full32.sampleCount === 32
          && r3.captureProvenance.full64.sampleCount === 64,
      "Half32, Full32 and Full64 profile identities and sample counts must be explicit"),
      support("interior-far-roi", r3.interiorFarMetrics.status === "measured" ? r3.interiorFarMetrics.pixelCount : null,
        thresholds.minimumInteriorFarPixels, `cross-profile interior-far ROI must have >= ${thresholds.minimumInteriorFarPixels} pixels`),
      support("depth-edge-roi", r3.depthEdgeMetrics.pixelCount,
        thresholds.minimumSignedBoundarySidePixels, `cross-profile depth-edge ROI must have >= ${thresholds.minimumSignedBoundarySidePixels} pixels`),
      ...sharedReferenceGates,
      booleanGate("reference-convergence-status", "reference", isReferenceConverged,
        "Full32/Full64 cross-profile references must converge"),
      booleanGate("half32-b1-profile-measured", "support",
        measured(r3.fullFrameMetrics.half32B1VsFull32, 1)
          && measured(r3.fullFrameMetrics.half32B1VsFull64, 1)
          && measured(r3.interiorFarMetrics.half32B1VsFull32, thresholds.minimumInteriorFarPixels)
          && measured(r3.depthEdgeMetrics.half32B1VsFull32, thresholds.minimumSignedBoundarySidePixels),
      "Half32 B1 must be measured against both full-resolution profiles on full-frame and scoped ROIs"),
      quality("half32-b1-full-frame-rmse", r3.fullFrameMetrics.half32B1VsFull32.rmse,
        thresholds.maximumB1FullFrameRmse, `Half32 B1 / Full32 RMSE must be <= ${thresholds.maximumB1FullFrameRmse}`),
      quality("half32-b1-vs-full64-rmse", r3.fullFrameMetrics.half32B1VsFull64.rmse,
        thresholds.maximumB1FullFrameRmse, `Half32 B1 / Full64 RMSE must be <= ${thresholds.maximumB1FullFrameRmse}`),
      quality("half32-b1-interior-far-rmse", r3.interiorFarMetrics.half32B1VsFull32.rmse,
        thresholds.maximumB1InteriorFarRmse, `Half32 B1 / Full32 interior-far RMSE must be <= ${thresholds.maximumB1InteriorFarRmse}`),
      quality("half32-b1-depth-edge-rmse", r3.depthEdgeMetrics.half32B1VsFull32.rmse,
        thresholds.maximumB1DepthEdgeRmse, `Half32 B1 / Full32 depth-edge RMSE must be <= ${thresholds.maximumB1DepthEdgeRmse}`),
    ],
  });
  const dimensions: Record<GroundGlassM5qDimensionId, GroundGlassM5qDimensionDecision> = {
    Q1: q1,
    Q2: q2,
    Q3: q3,
    Q4: q4,
    Q5: q5,
    Q6: q6,
    Q7: q7,
  };
  return {
    schemaVersion: 3,
    evaluatorRevision: GROUND_GLASS_M5Q_EVALUATOR_REVISION,
    evidenceScope: "independent-dimension-decisions-for-one-optical-state",
    opticalStateId: context.opticalStateId,
    sceneId: context.sceneId,
    evidenceSource: context.evidenceSource,
    sceneSourceRevision: context.sceneSourceRevision,
    candidateSelectionReason: context.candidateSelectionReason,
    runtime: context.runtime,
    thresholdRevision: nonEmpty(thresholds.revision) ? thresholds.revision : null,
    captureIds: r3.captureIds,
    dimensions,
  };
};
