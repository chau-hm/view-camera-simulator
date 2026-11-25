/** M5T spatial-profile metrics for research and controlled test evidence. */

export type GroundGlassM5tEvidenceScope = "registered-app-adapter" | "controlled-synthetic-fixture";
export type GroundGlassM5tSpatialValueConvention =
  | "source-target-readback-channel-r"
  | "source-target-readback-linear-luminance";

export type GroundGlassM5tSpatialProfileInput = Readonly<{
  roiId: string;
  captureId: string;
  evidenceScope: GroundGlassM5tEvidenceScope;
  colorDomain: "source-target-readback-values";
  valueConvention: GroundGlassM5tSpatialValueConvention;
  /** Ordered integer-pixel centers along one contiguous, straight spatial line. */
  samples: readonly Readonly<{
    xPx: number;
    yPx: number;
    value: number;
  }>[];
}>;

export type GroundGlassM5tSpatialProfile = GroundGlassM5tSpatialProfileInput & Readonly<{
  stepVectorPx: readonly [number, number] | null;
  status: "valid" | "invalid-profile";
  issue: string | null;
}>;

export type GroundGlassM5tEdgeSpreadMetrics = Readonly<{
  status: "measured" | "spatial-profile-insufficient-support";
  sampleCount: number;
  edgeDirection: "rising" | "falling" | "unresolved";
  baselineValue: number | null;
  plateauValue: number | null;
  edgeMidpointPositionPx: number | null;
  transitionWidth10To90Px: number | null;
  transitionWidth20To80Px: number | null;
  overshoot: number | null;
  undershoot: number | null;
  crossingCounts: Readonly<{ p10: number; p20: number; p50: number; p80: number; p90: number }>;
  issue: string | null;
}>;

export type GroundGlassM5tLineSpreadMetrics = Readonly<{
  status: "measured" | "spatial-profile-insufficient-support" | "ambiguous-peaks";
  sampleCount: number;
  samplePositionsPx: readonly number[];
  signedDerivative: readonly number[];
  fwhmPx: number | null;
  centroidPx: number | null;
  positiveSidelobeMaximum: number | null;
  negativeSidelobeMinimum: number | null;
  /** Positive LSF mass integrated over the sampled range, in raw source-target units. */
  positiveIntegral: number | null;
  /** Positive LSF mass to the left of the ESF 50% crossing, in raw source-target units. */
  leftPositiveIntegral: number | null;
  /** Positive LSF mass to the right of the ESF 50% crossing, in raw source-target units. */
  rightPositiveIntegral: number | null;
  asymmetry: number | null;
  /** Absolute difference between the raw signed LSF integral and its raw endpoint signal change. */
  integratedDirectionalSignal: number | null;
  /** Direction-corrected change from the first sample to the last sample. */
  expectedDirectionalSignal: number | null;
  integralConsistencyError: number | null;
  issue: string | null;
}>;

export type GroundGlassM5tSpatialAgreement = Readonly<{
  status: "measured" | "invalid-comparison";
  sampleCount: number;
  profileRmse: number | null;
  profileMaximumAbsoluteError: number | null;
  edgePositionErrorPx: number | null;
  transitionWidthRatio: number | null;
  maximumOvershoot: number | null;
  maximumUndershoot: number | null;
  foregroundLeakageFraction: number | null;
  classification:
    | "spatial-agreement"
    | "sharp-source-substitution"
    | "foreground-contamination-observed"
    | "profile-disagreement"
    | "spatial-profile-insufficient-support"
    | "invalid-comparison";
}>;

const finite = (value: number): boolean => Number.isFinite(value);
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Rejects scattered or reordered points before calculating any profile metric. */
export const createGroundGlassM5tSpatialProfile = (
  input: GroundGlassM5tSpatialProfileInput,
): GroundGlassM5tSpatialProfile => {
  const fail = (issue: string): GroundGlassM5tSpatialProfile => ({
    ...input,
    stepVectorPx: null,
    status: "invalid-profile",
    issue,
  });
  if (!input.roiId.trim() || !input.captureId.trim() || input.colorDomain !== "source-target-readback-values"
      || input.samples.length < 8
      || input.samples.some(({ xPx, yPx, value }) => !finite(xPx) || !finite(yPx) || !finite(value)
        || !Number.isInteger(xPx) || !Number.isInteger(yPx))) {
    return fail("Profile identity, source-target color domain, or finite eight-sample support is missing.");
  }
  const stepX = input.samples[1]!.xPx - input.samples[0]!.xPx;
  const stepY = input.samples[1]!.yPx - input.samples[0]!.yPx;
  const stepLength = Math.hypot(stepX, stepY);
  if (stepLength < 1 || stepLength > Math.SQRT2 || (stepX === 0 && stepY === 0)) {
    return fail("Spatial samples must be adjacent pixel centers along a contiguous line.");
  }
  for (let index = 1; index < input.samples.length - 1; index += 1) {
    const actualX = input.samples[index + 1]!.xPx - input.samples[index]!.xPx;
    const actualY = input.samples[index + 1]!.yPx - input.samples[index]!.yPx;
    if (actualX !== stepX || actualY !== stepY) {
      return fail("Spatial samples are not ordered and contiguous along one straight line.");
    }
  }
  return { ...input, stepVectorPx: [stepX, stepY], status: "valid", issue: null };
};

const crossingPosition = (
  positions: readonly number[],
  values: readonly number[],
  threshold: number,
): number | null => {
  for (let index = 0; index < values.length - 1; index += 1) {
    const first = values[index]!;
    const second = values[index + 1]!;
    if (first <= threshold && second >= threshold && second > first) {
      const fraction = (threshold - first) / (second - first);
      return positions[index]! + (positions[index + 1]! - positions[index]!) * fraction;
    }
  }
  return null;
};

const countCrossings = (values: readonly number[], threshold: number): number => {
  let count = 0;
  for (let index = 0; index < values.length - 1; index += 1) {
    if ((values[index]! < threshold && values[index + 1]! >= threshold)
        || (values[index]! > threshold && values[index + 1]! <= threshold)) count += 1;
  }
  return count;
};

/** Measures ESF percentiles in the declared stored source-target value domain. */
export const analyzeGroundGlassM5tEdgeSpread = (
  profile: GroundGlassM5tSpatialProfile,
): GroundGlassM5tEdgeSpreadMetrics => {
  const unresolved = (issue: string): GroundGlassM5tEdgeSpreadMetrics => ({
    status: "spatial-profile-insufficient-support",
    sampleCount: profile.samples.length,
    edgeDirection: "unresolved",
    baselineValue: null,
    plateauValue: null,
    edgeMidpointPositionPx: null,
    transitionWidth10To90Px: null,
    transitionWidth20To80Px: null,
    overshoot: null,
    undershoot: null,
    crossingCounts: { p10: 0, p20: 0, p50: 0, p80: 0, p90: 0 },
    issue,
  });
  if (profile.status !== "valid" || profile.stepVectorPx === null) {
    return unresolved(profile.issue ?? "Spatial profile is invalid.");
  }
  const values = profile.samples.map(({ value }) => value);
  const positions = profile.samples.map(({ xPx, yPx }) => {
    const [stepX, stepY] = profile.stepVectorPx!;
    return (xPx * stepX + yPx * stepY) / Math.hypot(stepX, stepY);
  });
  const median = (items: readonly number[]): number => {
    const sorted = [...items].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)]!;
  };
  const baselineValue = median(values.slice(0, 3));
  const plateauValue = median(values.slice(-3));
  const edgeMagnitude = plateauValue - baselineValue;
  if (Math.abs(edgeMagnitude) < 0.05) return unresolved("Profile has no meaningful endpoint transition.");
  const direction = edgeMagnitude > 0 ? "rising" : "falling";
  const normalized = values.map((value) => direction === "rising"
    ? (value - baselineValue) / edgeMagnitude
    : (baselineValue - value) / -edgeMagnitude);
  const crossingCounts = {
    p10: countCrossings(normalized, 0.1), p20: countCrossings(normalized, 0.2),
    p50: countCrossings(normalized, 0.5), p80: countCrossings(normalized, 0.8),
    p90: countCrossings(normalized, 0.9),
  };
  const p10 = crossingPosition(positions, normalized, 0.1);
  const p20 = crossingPosition(positions, normalized, 0.2);
  const p50 = crossingPosition(positions, normalized, 0.5);
  const p80 = crossingPosition(positions, normalized, 0.8);
  const p90 = crossingPosition(positions, normalized, 0.9);
  if (p10 === null || p20 === null || p50 === null || p80 === null || p90 === null) {
    return {
      ...unresolved("ESF does not cross every required 10–90% level."),
      baselineValue,
      plateauValue,
      crossingCounts,
    };
  }
  return {
    status: "measured",
    sampleCount: values.length,
    edgeDirection: direction,
    baselineValue,
    plateauValue,
    edgeMidpointPositionPx: p50,
    transitionWidth10To90Px: p90 - p10,
    transitionWidth20To80Px: p80 - p20,
    overshoot: Math.max(0, Math.max(...normalized) - 1),
    undershoot: Math.max(0, -Math.min(...normalized)),
    crossingCounts,
    issue: null,
  };
};

const interpolateCrossing = (
  positions: readonly number[],
  values: readonly number[],
  leftIndex: number,
  rightIndex: number,
  threshold: number,
): number | null => {
  const leftValue = values[leftIndex]!;
  const rightValue = values[rightIndex]!;
  if (leftValue === rightValue) return null;
  const fraction = (threshold - leftValue) / (rightValue - leftValue);
  if (fraction < 0 || fraction > 1) return null;
  return positions[leftIndex]! + (positions[rightIndex]! - positions[leftIndex]!) * fraction;
};

/** Derives a finite-difference LSF; ambiguous multi-peak FWHM remains null. */
export const analyzeGroundGlassM5tLineSpread = (
  profile: GroundGlassM5tSpatialProfile,
  esf: GroundGlassM5tEdgeSpreadMetrics = analyzeGroundGlassM5tEdgeSpread(profile),
): GroundGlassM5tLineSpreadMetrics => {
  if (profile.status !== "valid" || profile.stepVectorPx === null || esf.status !== "measured") {
    return {
      status: "spatial-profile-insufficient-support", sampleCount: profile.samples.length,
      samplePositionsPx: [], signedDerivative: [], fwhmPx: null, centroidPx: null,
      positiveSidelobeMaximum: null, negativeSidelobeMinimum: null, asymmetry: null,
      positiveIntegral: null, leftPositiveIntegral: null, rightPositiveIntegral: null,
      integratedDirectionalSignal: null, expectedDirectionalSignal: null,
      integralConsistencyError: null, issue: esf.issue ?? profile.issue ?? "ESF is unresolved.",
    };
  }
  const values = profile.samples.map(({ value }) => value);
  const positions = profile.samples.map(({ xPx, yPx }) => {
    const [stepX, stepY] = profile.stepVectorPx!;
    return (xPx * stepX + yPx * stepY) / Math.hypot(stepX, stepY);
  });
  const signal = esf.plateauValue! - esf.baselineValue!;
  if (!finite(signal) || Math.abs(signal) < 1e-12) {
    return {
      status: "spatial-profile-insufficient-support", sampleCount: values.length,
      samplePositionsPx: [], signedDerivative: [], fwhmPx: null, centroidPx: null,
      positiveSidelobeMaximum: null, negativeSidelobeMinimum: null, asymmetry: null,
      positiveIntegral: null, leftPositiveIntegral: null, rightPositiveIntegral: null,
      integratedDirectionalSignal: null, expectedDirectionalSignal: null,
      integralConsistencyError: null, issue: "ESF signal amplitude is unusable.",
    };
  }
  const direction = signal > 0 ? 1 : -1;
  const derivative = values.slice(0, -1).map((value, index) =>
    direction * (values[index + 1]! - value) / (positions[index + 1]! - positions[index]!));
  const derivativePositions = positions.slice(0, -1).map((value, index) => (value + positions[index + 1]!) / 2);
  const peak = Math.max(...derivative);
  const peakIndex = derivative.indexOf(peak);
  const peaks: number[] = [];
  for (let index = 0; index < derivative.length; index += 1) {
    const left = derivative[index - 1] ?? Number.NEGATIVE_INFINITY;
    const right = derivative[index + 1] ?? Number.NEGATIVE_INFINITY;
    if (derivative[index]! >= left && derivative[index]! > right && derivative[index]! >= peak * 0.5) peaks.push(index);
  }
  const ambiguous = peaks.length > 1 && peaks[peaks.length - 1]! - peaks[0]! > 1;
  let fwhmPx: number | null = null;
  if (peak > 0 && !ambiguous) {
    let leftIndex = peakIndex;
    while (leftIndex > 0 && derivative[leftIndex]! >= peak / 2) leftIndex -= 1;
    let rightIndex = peakIndex;
    while (rightIndex < derivative.length - 1 && derivative[rightIndex]! >= peak / 2) rightIndex += 1;
    if (leftIndex !== peakIndex && rightIndex !== peakIndex) {
      const leftCrossing = interpolateCrossing(derivativePositions, derivative, leftIndex, leftIndex + 1, peak / 2);
      const rightCrossing = interpolateCrossing(derivativePositions, derivative, rightIndex - 1, rightIndex, peak / 2);
      if (leftCrossing !== null && rightCrossing !== null) fwhmPx = rightCrossing - leftCrossing;
    }
  }
  const positiveIntegral = derivative.reduce((sum, value, index) =>
    sum + Math.max(0, value) * Math.abs(positions[index + 1]! - positions[index]!), 0);
  const positiveCentroidNumerator = derivative.reduce((sum, value, index) =>
    sum + Math.max(0, value) * Math.abs(positions[index + 1]! - positions[index]!) * derivativePositions[index]!, 0);
  const edgeMidpoint = esf.edgeMidpointPositionPx!;
  let leftIntegral = 0;
  let rightIntegral = 0;
  for (let index = 0; index < derivative.length; index += 1) {
    const binStart = Math.min(positions[index]!, positions[index + 1]!);
    const binEnd = Math.max(positions[index]!, positions[index + 1]!);
    const binWidth = binEnd - binStart;
    const leftWidth = Math.min(binWidth, Math.max(0, edgeMidpoint - binStart));
    const rightWidth = binWidth - leftWidth;
    const positiveDensity = Math.max(0, derivative[index]!);
    leftIntegral += positiveDensity * leftWidth;
    rightIntegral += positiveDensity * rightWidth;
  }
  const integratedDirectionalSignal = derivative.reduce((sum, value, index) =>
    sum + value * Math.abs(positions[index + 1]! - positions[index]!), 0);
  const expectedDirectionalSignal = direction * (values[values.length - 1]! - values[0]!);
  const sidelobes = derivative.filter((_value, index) => index !== peakIndex);
  return {
    status: ambiguous ? "ambiguous-peaks" : "measured",
    sampleCount: values.length,
    samplePositionsPx: derivativePositions,
    signedDerivative: derivative,
    fwhmPx: ambiguous ? null : fwhmPx,
    centroidPx: positiveIntegral > 0 ? positiveCentroidNumerator / positiveIntegral : null,
    positiveSidelobeMaximum: Math.max(0, ...sidelobes),
    negativeSidelobeMinimum: Math.min(0, ...sidelobes),
    positiveIntegral,
    leftPositiveIntegral: leftIntegral,
    rightPositiveIntegral: rightIntegral,
    asymmetry: positiveIntegral > 0 ? Math.abs(leftIntegral - rightIntegral) / positiveIntegral : null,
    integratedDirectionalSignal,
    expectedDirectionalSignal,
    integralConsistencyError: Math.abs(integratedDirectionalSignal - expectedDirectionalSignal),
    issue: ambiguous ? "Multiple separated LSF peaks exceed half the dominant peak; FWHM is withheld." : null,
  };
};

const compatibleProfiles = (
  left: GroundGlassM5tSpatialProfile,
  right: GroundGlassM5tSpatialProfile,
): boolean => left.status === "valid" && right.status === "valid"
  && left.roiId === right.roiId && left.colorDomain === right.colorDomain
  && left.valueConvention === right.valueConvention && left.samples.length === right.samples.length
  && left.samples.every((sample, index) => sample.xPx === right.samples[index]!.xPx
    && sample.yPx === right.samples[index]!.yPx);

/** Compares edge profiles, detects sharp substitution and optional foreground-color pull. */
export const compareGroundGlassM5tSpatialProfiles = (input: Readonly<{
  reference: GroundGlassM5tSpatialProfile;
  candidate: GroundGlassM5tSpatialProfile;
  sharpSource?: GroundGlassM5tSpatialProfile;
  foregroundColorSignal?: number;
  foregroundContaminationThreshold?: number;
  maximumProfileRmse?: number;
}>): GroundGlassM5tSpatialAgreement => {
  const invalid: GroundGlassM5tSpatialAgreement = {
    status: "invalid-comparison", sampleCount: 0, profileRmse: null,
    profileMaximumAbsoluteError: null, edgePositionErrorPx: null, transitionWidthRatio: null,
    maximumOvershoot: null, maximumUndershoot: null, foregroundLeakageFraction: null,
    classification: "invalid-comparison",
  };
  if (!compatibleProfiles(input.reference, input.candidate)
      || (input.sharpSource && !compatibleProfiles(input.reference, input.sharpSource))) return invalid;
  const referenceValues = input.reference.samples.map(({ value }) => value);
  const candidateValues = input.candidate.samples.map(({ value }) => value);
  const errors = candidateValues.map((value, index) => Math.abs(value - referenceValues[index]!));
  const rmse = Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length);
  const refEsf = analyzeGroundGlassM5tEdgeSpread(input.reference);
  const candidateEsf = analyzeGroundGlassM5tEdgeSpread(input.candidate);
  const sharpEsf = input.sharpSource ? analyzeGroundGlassM5tEdgeSpread(input.sharpSource) : null;
  if (refEsf.status !== "measured" || candidateEsf.status !== "measured") {
    return {
      status: "measured", sampleCount: errors.length, profileRmse: rmse,
      profileMaximumAbsoluteError: Math.max(...errors), edgePositionErrorPx: null,
      transitionWidthRatio: null, maximumOvershoot: candidateEsf.overshoot,
      maximumUndershoot: candidateEsf.undershoot, foregroundLeakageFraction: null,
      classification: "spatial-profile-insufficient-support",
    };
  }
  const widthRatio = refEsf.transitionWidth10To90Px && candidateEsf.transitionWidth10To90Px
    ? candidateEsf.transitionWidth10To90Px / refEsf.transitionWidth10To90Px : null;
  const referenceWidth = refEsf.transitionWidth10To90Px;
  const sharpSubstitution = sharpEsf?.status === "measured" && referenceWidth !== null
    && sharpEsf.transitionWidth10To90Px !== null && referenceWidth > sharpEsf.transitionWidth10To90Px * 1.2
    && candidateEsf.status === "measured" && candidateEsf.transitionWidth10To90Px !== null
    && candidateEsf.transitionWidth10To90Px <= sharpEsf.transitionWidth10To90Px * 1.1;
  let foregroundLeakageFraction: number | null = null;
  if (input.foregroundColorSignal !== undefined && finite(input.foregroundColorSignal)) {
    const farSideIndices = referenceValues.map((value, index) => ({ value, index }))
      .filter(({ value }) => Math.abs(value - refEsf.plateauValue!) < Math.abs(refEsf.plateauValue! - refEsf.baselineValue!) * 0.1)
      .map(({ index }) => index);
    const leakage = farSideIndices.map((index) => {
      const ref = referenceValues[index]!;
      const denominator = input.foregroundColorSignal! - ref;
      return Math.abs(denominator) > 1e-9
        ? clamp01((candidateValues[index]! - ref) / denominator)
        : 0;
    });
    foregroundLeakageFraction = leakage.length ? Math.max(...leakage) : null;
  }
  const contaminationThreshold = input.foregroundContaminationThreshold ?? 0.05;
  const maximumProfileRmse = input.maximumProfileRmse ?? 0.05;
  const classification: GroundGlassM5tSpatialAgreement["classification"] =
    refEsf.status !== "measured" || candidateEsf.status !== "measured"
      ? "spatial-profile-insufficient-support"
      : sharpSubstitution
        ? "sharp-source-substitution"
        : foregroundLeakageFraction !== null && foregroundLeakageFraction >= contaminationThreshold
          ? "foreground-contamination-observed"
          : rmse > maximumProfileRmse ? "profile-disagreement" : "spatial-agreement";
  return {
    status: "measured",
    sampleCount: errors.length,
    profileRmse: rmse,
    profileMaximumAbsoluteError: Math.max(...errors),
    edgePositionErrorPx: refEsf.edgeMidpointPositionPx !== null && candidateEsf.edgeMidpointPositionPx !== null
      ? Math.abs(candidateEsf.edgeMidpointPositionPx - refEsf.edgeMidpointPositionPx) : null,
    transitionWidthRatio: widthRatio,
    maximumOvershoot: candidateEsf.overshoot,
    maximumUndershoot: candidateEsf.undershoot,
    foregroundLeakageFraction,
    classification,
  };
};

export type GroundGlassM5tRoiSelectionEvidence = Readonly<{
  roiId: string;
  selectedPixelIds: readonly number[];
  evidenceInputs: readonly ("source" | "depth" | "physical" | "validity")[];
  candidateQualityOutputConsulted: boolean;
  evidenceScope: GroundGlassM5tEvidenceScope;
}>;

/** Predeclares ROI selection authority and keeps fixture evidence explicitly separate. */
export const validateGroundGlassM5tRoiSelection = (
  evidence: GroundGlassM5tRoiSelectionEvidence,
): Readonly<{ status: "valid" | "invalid"; issues: readonly string[] }> => {
  const issues: string[] = [];
  if (!evidence.roiId.trim() || !evidence.selectedPixelIds.length
      || evidence.selectedPixelIds.some((id) => !Number.isSafeInteger(id) || id < 0)) {
    issues.push("ROI identity and non-empty source pixel support are required.");
  }
  if (evidence.candidateQualityOutputConsulted) issues.push("ROI selection consulted candidate/reference error.");
  if (!evidence.evidenceInputs.includes("source") || !evidence.evidenceInputs.includes("physical")
      || !evidence.evidenceInputs.includes("depth") || !evidence.evidenceInputs.includes("validity")) {
    issues.push("ROI selection must retain source, physical, depth, and validity evidence.");
  }
  return { status: issues.length ? "invalid" : "valid", issues };
};

export const evaluateGroundGlassM5tEvidenceScope = (input: Readonly<{
  evidenceScope: GroundGlassM5tEvidenceScope;
  numericClassification: string;
  spatialClassification: string;
}>): Readonly<{
  evidenceScope: GroundGlassM5tEvidenceScope;
  classification: string;
  canEstablishRegisteredAppSupport: boolean;
  canPromoteM5q: false;
}> => ({
  evidenceScope: input.evidenceScope,
  classification: input.evidenceScope === "controlled-synthetic-fixture"
    ? "fixture-only"
    : `${input.numericClassification}+${input.spatialClassification}`,
  canEstablishRegisteredAppSupport: input.evidenceScope === "registered-app-adapter",
  canPromoteM5q: false,
});
