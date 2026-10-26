import {
  groundGlassGoldenAngleDiskProposal,
  type GroundGlassApertureGatherReferenceResult,
} from "./groundGlassApertureGatherReference";

export const GROUND_GLASS_M5R_REFERENCE_SAMPLE_COUNTS = [16, 32, 64, 128, 256] as const;
export type GroundGlassM5rReferenceSampleCount = (typeof GROUND_GLASS_M5R_REFERENCE_SAMPLE_COUNTS)[number];
export type GroundGlassM5rNativeSampleCount = 16 | 32 | 64;
export type GroundGlassM5rHighSampleCount = 128 | 256;

export type GroundGlassM5rSampleDistribution = Readonly<{
  proposalCount: number;
  uniqueProposalCount: number;
  allInsideUnitDisk: boolean;
  centroid: readonly [x: number, y: number];
  minimumRadius: number;
  maximumRadius: number;
  meanRadius: number;
  meanSquaredRadius: number;
  /** Four equal-area radial bins, counted by squared radius. */
  radialAreaBandCounts: readonly [number, number, number, number];
  /** Eight equal-angle bins in screen coordinates. */
  angularSectorCounts: readonly [number, number, number, number, number, number, number, number];
}>;

export type GroundGlassM5rArrayDifference = Readonly<{
  valueCount: number;
  exact: boolean;
  changedValueCount: number;
  meanAbsoluteError: number;
  rootMeanSquareError: number;
  maximumAbsoluteError: number;
  maximumErrorIndex: number;
}>;

export type GroundGlassM5rGatherDifference = Readonly<{
  farRgb: GroundGlassM5rArrayDifference;
  nearRgb: GroundGlassM5rArrayDifference;
  nearAlpha: GroundGlassM5rArrayDifference;
}>;

export type GroundGlassM5rEvidenceStatus = "supported" | "contradicted" | "unresolved";
export type GroundGlassM5rReferenceClassification =
  | "deterministic-reference-sampling-limited"
  | "capture-instability-observed"
  | "gpu-cpu-mismatch"
  | "invalid-comparison"
  | "insufficient-evidence";

export type GroundGlassM5rRepeatComparison = Readonly<{
  qualityMode: "Full32" | "Full64";
  comparedCaptureIds: readonly [first: string, second: string];
  comparison: "A/B" | "A/C";
  far: GroundGlassM5rArrayDifference | null;
  near: GroundGlassM5rArrayDifference | null;
}>;

export type GroundGlassM5rReferenceEvidenceInput = Readonly<{
  inputFingerprintMatch: boolean | null;
  repeatedCaptures: readonly GroundGlassM5rRepeatComparison[] | null;
  gpu32VsCpu32RgbRmse: number | null;
  gpu64VsCpu64RgbRmse: number | null;
  declaredMatchedCountConformanceLimit: number;
  cpu128VsCpu256RgbRmse: number | null;
  declaredReferenceConvergenceLimit: number;
}>;

export type GroundGlassM5rReferenceEvidenceDecision = Readonly<{
  provenanceValid: boolean | null;
  sameProfileRepeatable: boolean | null;
  gpuCpuConformancePassed: boolean | null;
  finiteSampleReferenceConverged: boolean | null;
  repeatability: readonly GroundGlassM5rRepeatComparison[] | null;
  supportingEvidence: readonly string[];
  failedConditions: readonly string[];
  classification: GroundGlassM5rReferenceClassification;
  confidence: "high" | "low" | "none";
  evidenceStatus: Readonly<{
    provenance: GroundGlassM5rEvidenceStatus;
    repeatability: GroundGlassM5rEvidenceStatus;
    gpuCpuConformance: GroundGlassM5rEvidenceStatus;
    finiteSampleReferenceConvergence: GroundGlassM5rEvidenceStatus;
  }>;
  rootCauseStatementsAllowed: Readonly<{
    deterministicReferenceSamplingLimited: boolean;
    captureInstabilityObserved: boolean;
    captureInstabilityNotObserved: boolean;
    geometryProvenanceMismatchNotObserved: boolean;
  }>;
}>;

export type GroundGlassM5rReferenceReportFields = Readonly<{
  referenceRepeatability: Readonly<{
    sameProfileRepeatable: boolean | null;
    inputFingerprintsMatchedAcrossProfilesAndRepeats: boolean | null;
  }>;
  referenceConvergence: Readonly<{
    classification: GroundGlassM5rReferenceClassification;
    confidence: "high" | "low" | "none";
    supportingEvidence: readonly string[];
    contradictingEvidence: readonly string[];
    finiteSampleReferenceConverged: boolean | null;
  }>;
  rootCauseMatrix: Readonly<{
    hA1: Readonly<{
      classification: GroundGlassM5rReferenceClassification;
      confidence: "high" | "low" | "none";
      supportingEvidence: readonly string[];
      contradictingEvidence: readonly string[];
    }>;
    hA5: Readonly<{
      classification: "capture-instability-not-observed" | "capture-instability-observed" | "capture-repeatability-unresolved";
      confidence: "high" | "low" | "none";
      supportingEvidence: readonly string[];
      contradictingEvidence: readonly string[];
    }>;
    hA6: Readonly<{
      classification: "geometry-provenance-mismatch-not-observed" | "geometry-provenance-mismatch-observed" | "geometry-provenance-unresolved";
      confidence: "high" | "low" | "none";
      supportingEvidence: readonly string[];
      contradictingEvidence: readonly string[];
    }>;
  }>;
  negativeControls: Readonly<{ nativeAssertions: readonly string[] }>;
}>;

const isReferenceSampleCount = (value: number): value is GroundGlassM5rReferenceSampleCount =>
  (GROUND_GLASS_M5R_REFERENCE_SAMPLE_COUNTS as readonly number[]).includes(value);

/** Builds the deterministic equal-area golden-angle points used by the CPU oracle. */
export const createGroundGlassM5rGoldenAngleProposals = (
  sampleCount: GroundGlassM5rReferenceSampleCount,
): Float64Array => {
  if (!isReferenceSampleCount(sampleCount)) {
    throw new RangeError("M5R proposal sample count must be 16, 32, 64, 128, or 256");
  }
  const proposals = new Float64Array(sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    const [x, y] = groundGlassGoldenAngleDiskProposal(index, sampleCount);
    proposals[index * 2] = x;
    proposals[index * 2 + 1] = y;
  }
  return proposals;
};

/** Pure descriptive metrics for an interleaved [x,y] proposal array. */
export const analyzeGroundGlassM5rSampleDistribution = (
  proposals: ArrayLike<number>,
): GroundGlassM5rSampleDistribution => {
  if (proposals.length === 0 || proposals.length % 2 !== 0) {
    throw new RangeError("M5R sample proposals must be a non-empty interleaved [x,y] array");
  }
  const proposalCount = proposals.length / 2;
  const seen = new Set<string>();
  const radialAreaBandCounts = [0, 0, 0, 0];
  const angularSectorCounts = [0, 0, 0, 0, 0, 0, 0, 0];
  let sumX = 0;
  let sumY = 0;
  let sumRadius = 0;
  let sumSquaredRadius = 0;
  let minimumRadius = Number.POSITIVE_INFINITY;
  let maximumRadius = 0;
  let allInsideUnitDisk = true;

  for (let index = 0; index < proposalCount; index += 1) {
    const x = proposals[index * 2]!;
    const y = proposals[index * 2 + 1]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError("M5R sample proposals must contain finite coordinates");
    }
    const radiusSquared = x * x + y * y;
    const radius = Math.sqrt(radiusSquared);
    if (radius > 1 + 1e-12) allInsideUnitDisk = false;
    minimumRadius = Math.min(minimumRadius, radius);
    maximumRadius = Math.max(maximumRadius, radius);
    sumX += x;
    sumY += y;
    sumRadius += radius;
    sumSquaredRadius += radiusSquared;
    radialAreaBandCounts[Math.min(3, Math.floor(radiusSquared * 4))]! += 1;
    const angle = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);
    angularSectorCounts[Math.min(7, Math.floor(angle * 8 / (Math.PI * 2)))]! += 1;
    seen.add(`${x},${y}`);
  }

  return {
    proposalCount,
    uniqueProposalCount: seen.size,
    allInsideUnitDisk,
    centroid: [sumX / proposalCount, sumY / proposalCount],
    minimumRadius,
    maximumRadius,
    meanRadius: sumRadius / proposalCount,
    meanSquaredRadius: sumSquaredRadius / proposalCount,
    radialAreaBandCounts: radialAreaBandCounts as [number, number, number, number],
    angularSectorCounts: angularSectorCounts as [number, number, number, number, number, number, number, number],
  };
};

/**
 * Compares finite numeric arrays for repeatability or reference error. Exact
 * equality is reported separately from magnitude so tiny changes remain visible.
 */
export const compareGroundGlassM5rNumericArrays = (
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): GroundGlassM5rArrayDifference => {
  if (left.length === 0 || left.length !== right.length) {
    throw new RangeError("M5R array comparison requires equal, non-empty arrays");
  }
  let changedValueCount = 0;
  let absoluteErrorSum = 0;
  let squaredErrorSum = 0;
  let maximumAbsoluteError = 0;
  let maximumErrorIndex = -1;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index]!;
    const rightValue = right[index]!;
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
      throw new RangeError("M5R array comparison requires finite values");
    }
    const error = Math.abs(leftValue - rightValue);
    if (error !== 0) changedValueCount += 1;
    absoluteErrorSum += error;
    squaredErrorSum += error * error;
    if (error > maximumAbsoluteError) {
      maximumAbsoluteError = error;
      maximumErrorIndex = index;
    }
  }
  return {
    valueCount: left.length,
    exact: changedValueCount === 0,
    changedValueCount,
    meanAbsoluteError: absoluteErrorSum / left.length,
    rootMeanSquareError: Math.sqrt(squaredErrorSum / left.length),
    maximumAbsoluteError,
    maximumErrorIndex,
  };
};

const compareRgbaChannels = (
  left: Float32Array,
  right: Float32Array,
  channels: readonly number[],
): GroundGlassM5rArrayDifference => {
  if (left.length === 0 || left.length !== right.length || left.length % 4 !== 0
      || channels.length === 0
      || channels.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 3)) {
    throw new RangeError("M5R RGBA comparison requires matching RGBA buffers and valid channels");
  }
  const selectedLeft = new Float64Array((left.length / 4) * channels.length);
  const selectedRight = new Float64Array(selectedLeft.length);
  let outputIndex = 0;
  for (let pixelOffset = 0; pixelOffset < left.length; pixelOffset += 4) {
    for (const channel of channels) {
      selectedLeft[outputIndex] = left[pixelOffset + channel]!;
      selectedRight[outputIndex] = right[pixelOffset + channel]!;
      outputIndex += 1;
    }
  }
  return compareGroundGlassM5rNumericArrays(selectedLeft, selectedRight);
};

/** RGB and alpha comparisons over CPU-reference Float32 output buffers. */
export const compareGroundGlassM5rGatherResults = (
  left: GroundGlassApertureGatherReferenceResult,
  right: GroundGlassApertureGatherReferenceResult,
): GroundGlassM5rGatherDifference => ({
  farRgb: compareRgbaChannels(left.farRgba, right.farRgba, [0, 1, 2]),
  nearRgb: compareRgbaChannels(left.nearRgba, right.nearRgba, [0, 1, 2]),
  nearAlpha: compareRgbaChannels(left.nearRgba, right.nearRgba, [3]),
});

/** Same-profile output repeatability; inputs must already have been identity-checked by the caller. */
export const compareGroundGlassM5rGatherRepeats = (
  first: GroundGlassApertureGatherReferenceResult,
  repeat: GroundGlassApertureGatherReferenceResult,
): GroundGlassM5rGatherDifference => compareGroundGlassM5rGatherResults(first, repeat);

/** Compares a native-range sample result with one diagnostic high-sample result. */
export const compareGroundGlassM5rWithHighSampleReference = (
  candidateSampleCount: GroundGlassM5rNativeSampleCount,
  candidate: GroundGlassApertureGatherReferenceResult,
  referenceSampleCount: GroundGlassM5rHighSampleCount,
  reference: GroundGlassApertureGatherReferenceResult,
): Readonly<{
  candidateSampleCount: GroundGlassM5rNativeSampleCount;
  referenceSampleCount: GroundGlassM5rHighSampleCount;
  metrics: GroundGlassM5rGatherDifference;
}> => {
  if (candidateSampleCount >= referenceSampleCount) {
    throw new RangeError("M5R high-sample reference count must exceed the candidate count");
  }
  return {
    candidateSampleCount,
    referenceSampleCount,
    metrics: compareGroundGlassM5rGatherResults(candidate, reference),
  };
};

const isValidDifference = (difference: GroundGlassM5rArrayDifference | null): difference is GroundGlassM5rArrayDifference => {
  if (difference === null) return false;
  const finiteMetrics = [
    difference.meanAbsoluteError,
    difference.rootMeanSquareError,
    difference.maximumAbsoluteError,
  ].every(Number.isFinite);
  if (!finiteMetrics
      || !Number.isInteger(difference.valueCount) || difference.valueCount <= 0
      || !Number.isInteger(difference.changedValueCount)
      || difference.changedValueCount < 0 || difference.changedValueCount > difference.valueCount
      || difference.meanAbsoluteError < 0 || difference.rootMeanSquareError < 0
      || difference.maximumAbsoluteError < 0) return false;
  const exactFromMetrics = difference.changedValueCount === 0
    && difference.meanAbsoluteError === 0
    && difference.rootMeanSquareError === 0
    && difference.maximumAbsoluteError === 0
    && difference.maximumErrorIndex === -1;
  const nonExactIndexIsValid = difference.changedValueCount === 0
    ? difference.maximumErrorIndex === -1
    : Number.isInteger(difference.maximumErrorIndex)
      && difference.maximumErrorIndex >= 0 && difference.maximumErrorIndex < difference.valueCount;
  return difference.exact === exactFromMetrics && nonExactIndexIsValid;
};

const requiredRepeatComparisons = ["Full32:A/B", "Full32:A/C", "Full64:A/B", "Full64:A/C"] as const;

const repeatKey = (comparison: GroundGlassM5rRepeatComparison): string =>
  `${comparison.qualityMode}:${comparison.comparison}`;

/**
 * Evaluates M5R's native repeatability, input provenance, matched-count GPU/CPU
 * conformance, and finite-reference convergence gates from measured evidence.
 * It does not infer a mounted runtime or qualify an M5Q/R3 result.
 */
export const evaluateGroundGlassM5rReferenceEvidence = (
  input: GroundGlassM5rReferenceEvidenceInput,
): GroundGlassM5rReferenceEvidenceDecision => {
  const failures: string[] = [];
  const support: string[] = [];
  const provenanceValid = input.inputFingerprintMatch;
  if (provenanceValid === true) support.push("Input fingerprints match for the compared native captures.");
  else if (provenanceValid === false) failures.push("Input fingerprints differ; this is not a valid same-input comparison.");
  else failures.push("Input fingerprint evidence is missing.");

  const comparisons = input.repeatedCaptures;
  const comparisonKeys = comparisons?.map(repeatKey) ?? [];
  const repeatSetValid = comparisons !== null
    && comparisons.length === requiredRepeatComparisons.length
    && requiredRepeatComparisons.every((key) => comparisonKeys.filter((candidate) => candidate === key).length === 1)
    && comparisons.every(({ comparedCaptureIds }) => comparedCaptureIds.length === 2
      && comparedCaptureIds.every((id) => id.trim().length > 0));
  const repeatMetricsPresent = repeatSetValid && comparisons!.every(({ far, near }) => far !== null && near !== null);
  const repeatMetricsValid = repeatMetricsPresent && comparisons!.every(({ far, near }) =>
    isValidDifference(far) && isValidDifference(near));
  let sameProfileRepeatable: boolean | null = null;

  if (comparisons === null || !repeatSetValid || !repeatMetricsPresent) {
    failures.push("Complete Full32/Full64 A/B and A/C Far/Near repeat metrics are required.");
  } else if (!repeatMetricsValid) {
    failures.push("Repeat comparison metrics are malformed or non-finite.");
  } else {
    sameProfileRepeatable = comparisons!.every(({ far, near }) => far!.exact && near!.exact);
    if (sameProfileRepeatable) {
      support.push("Full32 and Full64 A/B and A/C Far and Near buffers are bit-exact.");
    } else {
      comparisons!.forEach(({ qualityMode, comparedCaptureIds, comparison, far, near }) => {
        for (const [buffer, difference] of [["Far", far!], ["Near", near!]] as const) {
          if (difference.exact) continue;
          failures.push(
            `${qualityMode} ${comparedCaptureIds[0]}/${comparedCaptureIds[1]} ${buffer} (${comparison}) differs: `
            + `${difference.changedValueCount} values, max ${difference.maximumAbsoluteError} at `
            + `${difference.maximumErrorIndex}, RMSE ${difference.rootMeanSquareError}.`,
          );
        }
      });
    }
  }

  const thresholdValid = Number.isFinite(input.declaredMatchedCountConformanceLimit)
    && input.declaredMatchedCountConformanceLimit > 0
    && Number.isFinite(input.declaredReferenceConvergenceLimit)
    && input.declaredReferenceConvergenceLimit > 0;
  const gpuMetricsPresent = input.gpu32VsCpu32RgbRmse !== null && input.gpu64VsCpu64RgbRmse !== null;
  const gpuMetricsValid = thresholdValid && gpuMetricsPresent
    && Number.isFinite(input.gpu32VsCpu32RgbRmse) && input.gpu32VsCpu32RgbRmse! >= 0
    && Number.isFinite(input.gpu64VsCpu64RgbRmse) && input.gpu64VsCpu64RgbRmse! >= 0;
  let gpuCpuConformancePassed: boolean | null = null;
  if (!thresholdValid) failures.push("Declared M5R evidence thresholds are missing or invalid.");
  if (!gpuMetricsPresent) failures.push("Both GPU/CPU matched-count RMSE measurements are required.");
  else if (!gpuMetricsValid) failures.push("GPU/CPU matched-count RMSE measurements must be finite and non-negative.");
  else {
    gpuCpuConformancePassed = input.gpu32VsCpu32RgbRmse! <= input.declaredMatchedCountConformanceLimit
      && input.gpu64VsCpu64RgbRmse! <= input.declaredMatchedCountConformanceLimit;
    if (gpuCpuConformancePassed) {
      support.push(
        `GPU32/CPU32 (${input.gpu32VsCpu32RgbRmse}) and GPU64/CPU64 `
        + `(${input.gpu64VsCpu64RgbRmse}) RMSE meet the ${input.declaredMatchedCountConformanceLimit} diagnostic limit.`,
      );
    } else {
      if (input.gpu32VsCpu32RgbRmse! > input.declaredMatchedCountConformanceLimit) {
        failures.push(`GPU32/CPU32 RMSE ${input.gpu32VsCpu32RgbRmse} exceeds ${input.declaredMatchedCountConformanceLimit}.`);
      }
      if (input.gpu64VsCpu64RgbRmse! > input.declaredMatchedCountConformanceLimit) {
        failures.push(`GPU64/CPU64 RMSE ${input.gpu64VsCpu64RgbRmse} exceeds ${input.declaredMatchedCountConformanceLimit}.`);
      }
    }
  }

  let finiteSampleReferenceConverged: boolean | null = null;
  const highSampleMetricPresent = input.cpu128VsCpu256RgbRmse !== null;
  const highSampleMetricValid = thresholdValid && highSampleMetricPresent
    && Number.isFinite(input.cpu128VsCpu256RgbRmse) && input.cpu128VsCpu256RgbRmse! >= 0;
  if (!highSampleMetricPresent) failures.push("CPU128/CPU256 RGB RMSE evidence is missing.");
  else if (!highSampleMetricValid) failures.push("CPU128/CPU256 RGB RMSE must be finite and non-negative.");
  else {
    finiteSampleReferenceConverged = input.cpu128VsCpu256RgbRmse! <= input.declaredReferenceConvergenceLimit;
    if (finiteSampleReferenceConverged) {
      support.push(`CPU128/CPU256 RMSE meets the ${input.declaredReferenceConvergenceLimit} reference-convergence limit.`);
    } else {
      failures.push(
        `CPU128/CPU256 RMSE ${input.cpu128VsCpu256RgbRmse} exceeds `
        + `${input.declaredReferenceConvergenceLimit}; reference authority remains unresolved.`,
      );
    }
  }

  const hasInvalidEvidence = provenanceValid === false
    || (comparisons !== null && repeatSetValid && repeatMetricsPresent && !repeatMetricsValid)
    || (thresholdValid === false)
    || (gpuMetricsPresent && !gpuMetricsValid)
    || (highSampleMetricPresent && !highSampleMetricValid);
  const hasMissingEvidence = provenanceValid === null
    || !repeatSetValid || !repeatMetricsPresent
    || !gpuMetricsPresent || !highSampleMetricPresent;
  let classification: GroundGlassM5rReferenceClassification;
  let confidence: GroundGlassM5rReferenceEvidenceDecision["confidence"];
  if (hasInvalidEvidence) {
    classification = "invalid-comparison";
    confidence = "none";
  } else if (sameProfileRepeatable === false) {
    classification = "capture-instability-observed";
    confidence = "high";
  } else if (hasMissingEvidence || provenanceValid !== true || sameProfileRepeatable !== true
      || gpuCpuConformancePassed === null) {
    classification = "insufficient-evidence";
    confidence = "none";
  } else if (gpuCpuConformancePassed === false) {
    classification = "gpu-cpu-mismatch";
    confidence = "high";
  } else {
    classification = "deterministic-reference-sampling-limited";
    confidence = "high";
  }

  const evidenceStatus = {
    provenance: provenanceValid === true ? "supported" : provenanceValid === false ? "contradicted" : "unresolved",
    repeatability: sameProfileRepeatable === true ? "supported" : sameProfileRepeatable === false ? "contradicted" : "unresolved",
    gpuCpuConformance: gpuCpuConformancePassed === true ? "supported"
      : gpuCpuConformancePassed === false ? "contradicted" : "unresolved",
    finiteSampleReferenceConvergence: finiteSampleReferenceConverged === true ? "supported"
      : finiteSampleReferenceConverged === false ? "contradicted" : "unresolved",
  } as const;

  return {
    provenanceValid,
    sameProfileRepeatable,
    gpuCpuConformancePassed,
    finiteSampleReferenceConverged,
    repeatability: comparisons,
    supportingEvidence: support,
    failedConditions: failures,
    classification,
    confidence,
    evidenceStatus,
    rootCauseStatementsAllowed: {
      deterministicReferenceSamplingLimited: classification === "deterministic-reference-sampling-limited",
      captureInstabilityObserved: sameProfileRepeatable === false && provenanceValid === true,
      captureInstabilityNotObserved: sameProfileRepeatable === true && provenanceValid === true,
      geometryProvenanceMismatchNotObserved: provenanceValid === true && gpuCpuConformancePassed === true,
    },
  };
};

/** Creates the shared report fields so top-level conclusions and H-A1/H-A5/H-A6 cannot drift. */
export const createGroundGlassM5rReferenceReportFields = (
  decision: GroundGlassM5rReferenceEvidenceDecision,
): GroundGlassM5rReferenceReportFields => {
  const hA1 = {
    classification: decision.classification,
    confidence: decision.confidence,
    supportingEvidence: decision.supportingEvidence,
    contradictingEvidence: decision.failedConditions,
  } as const;
  const hA5Classification = decision.rootCauseStatementsAllowed.captureInstabilityNotObserved
    ? "capture-instability-not-observed" as const
    : decision.rootCauseStatementsAllowed.captureInstabilityObserved
      ? "capture-instability-observed" as const
      : "capture-repeatability-unresolved" as const;
  const hA6Classification = decision.rootCauseStatementsAllowed.geometryProvenanceMismatchNotObserved
    ? "geometry-provenance-mismatch-not-observed" as const
    : decision.provenanceValid === false
      ? "geometry-provenance-mismatch-observed" as const
      : "geometry-provenance-unresolved" as const;
  const passedN1 = decision.sameProfileRepeatable === true;
  const passedN2 = decision.provenanceValid === true;
  return {
    referenceRepeatability: {
      sameProfileRepeatable: decision.sameProfileRepeatable,
      inputFingerprintsMatchedAcrossProfilesAndRepeats: decision.provenanceValid,
    },
    referenceConvergence: {
      classification: decision.classification,
      confidence: decision.confidence,
      supportingEvidence: decision.supportingEvidence,
      contradictingEvidence: decision.failedConditions,
      finiteSampleReferenceConverged: decision.finiteSampleReferenceConverged,
    },
    rootCauseMatrix: {
      hA1,
      hA5: {
        classification: hA5Classification,
        confidence: passedN1 ? "high" : decision.sameProfileRepeatable === false ? "high" : "none",
        supportingEvidence: passedN1 ? ["All four Full32/Full64 A/B and A/C Far/Near comparisons are exact."] : [],
        contradictingEvidence: passedN1 ? [] : decision.failedConditions,
      },
      hA6: {
        classification: hA6Classification,
        confidence: passedN2 && decision.gpuCpuConformancePassed === true ? "high"
          : decision.provenanceValid === false ? "high" : "none",
        supportingEvidence: decision.rootCauseStatementsAllowed.geometryProvenanceMismatchNotObserved
          ? ["Input fingerprints match and matched-count GPU/CPU conformance passes."] : [],
        contradictingEvidence: decision.provenanceValid === false
          ? ["Input fingerprints differ across the comparison captures."]
          : decision.gpuCpuConformancePassed === false ? ["Matched-count GPU/CPU conformance failed."] : [],
      },
    },
    negativeControls: {
      nativeAssertions: [
        passedN1 ? "N1 repeated Full32/Full64 Far/Near captures are bit-exact (passed)."
          : "N1 repeated Full32/Full64 Far/Near captures are bit-exact (failed or unresolved).",
        passedN2 ? "N2 comparison inputs have matching source, depth, physical, and validity fingerprints (passed)."
          : "N2 comparison inputs have matching source, depth, physical, and validity fingerprints (failed or unresolved).",
        "registered-app and native-research-fixture evidence scopes remain distinct",
      ],
    },
  };
};
