/**
 * Bounded research analysis for M5R Near alpha captures. This module does not
 * construct renderer state, choose quality thresholds, or alter the production
 * Near output. Inputs are normalized top-origin capture arrays.
 */

export const GROUND_GLASS_M5R_NEAR_ALPHA_MAX_PIXELS = 262_144;
export const GROUND_GLASS_M5R_NEAR_ALPHA_MAX_PROPOSALS = 64;

export type GroundGlassM5rNearAlphaIdentity = Readonly<{
  captureId: string;
  requestId: string;
  sceneId: string;
  inputFingerprint: string;
  outputWidthPx: number;
  outputHeightPx: number;
  sampleCount: number;
  pixelOrder: "top-origin";
}>;

export type GroundGlassM5rNearAlphaRendererProvenance = Readonly<{
  rendererFamily: "webgpu-renderer";
  actualExecutionApi: "webgpu";
  internalFallback: "none";
  rendererGenerationId: string;
}>;

export type GroundGlassM5rNearAlphaIntermediates = Readonly<{
  /** 1 when the sampled gather center is Near; otherwise 0. */
  nearCenterIsNear: ArrayLike<number>;
  nearEvaluatedProposalCount: ArrayLike<number>;
  nearAcceptedProposalCount: ArrayLike<number>;
  nearNonzeroMembershipCount: ArrayLike<number>;
  nearWeightSum: ArrayLike<number>;
  nearCoverageMass: ArrayLike<number>;
  /** Proposal-derived coverage before the center-Near alpha override. */
  nearEstimatedCoverage: ArrayLike<number>;
  nearFinalAlpha: ArrayLike<number>;
  nearAcceptedAreaRatioMean: ArrayLike<number>;
  nearAcceptedCompensationMaximum: ArrayLike<number>;
}>;

export type GroundGlassM5rNearAlphaCapture = Readonly<{
  identity: GroundGlassM5rNearAlphaIdentity;
  intermediates: GroundGlassM5rNearAlphaIntermediates;
  /** Final target RGBA, normalized to Float32 values and top-origin rows. */
  nearRgba: Float32Array;
  /** Raw alpha lane from the RGBA16F Near target, one Uint16 per output pixel. */
  rawNearAlphaHalfBits?: Uint16Array;
}>;

export type GroundGlassM5rNearAlphaGpuCapture = GroundGlassM5rNearAlphaCapture & Readonly<{
  renderer: GroundGlassM5rNearAlphaRendererProvenance;
}>;

export type GroundGlassM5rNearAlphaCpuCapture = GroundGlassM5rNearAlphaCapture & Readonly<{
  referenceId: string;
}>;

export type GroundGlassM5rNearAlphaAnalysisInput = Readonly<{
  gpu: GroundGlassM5rNearAlphaGpuCapture;
  cpu: GroundGlassM5rNearAlphaCpuCapture;
}>;

export type GroundGlassM5rScalarError = Readonly<{
  valueCount: number;
  exactMismatchCount: number;
  rootMeanSquareError: number;
  maximumAbsoluteError: number;
  maximumAbsoluteErrorIndex: number;
}>;

export type GroundGlassM5rAlphaDistribution = Readonly<{
  pixelCount: number;
  zeroCount: number;
  oneCount: number;
  fractionalCount: number;
  belowZeroCount: number;
  aboveOneCount: number;
  minimum: number;
  maximum: number;
  mean: number;
}>;

export type GroundGlassM5rNearAlphaPopulation = Readonly<{
  outputCount: number;
  withAcceptedProposals: number;
  withoutAcceptedProposals: number;
  evaluatedProposalTotal: number;
  acceptedProposalTotal: number;
  rejectedProposalTotal: number;
  nonzeroMembershipProposalTotal: number;
  alpha: GroundGlassM5rAlphaDistribution;
}>;

export type GroundGlassM5rNearAlphaPopulationGroups = Readonly<{
  all: GroundGlassM5rNearAlphaPopulation;
  withAcceptedProposals: GroundGlassM5rNearAlphaPopulation;
  withoutAcceptedProposals: GroundGlassM5rNearAlphaPopulation;
}>;

export type GroundGlassM5rNearAlphaSideSummary = Readonly<{
  outputAlpha: GroundGlassM5rAlphaDistribution;
  diagnosticFinalAlpha: GroundGlassM5rAlphaDistribution;
  populations: Readonly<{
    centerNear: GroundGlassM5rNearAlphaPopulationGroups;
    offCenter: GroundGlassM5rNearAlphaPopulationGroups;
  }>;
  /** Off-center, accepted, fractional, and internally consistent pixels. */
  validOffCenterFractionalCoveragePixelCount: number;
}>;

export type GroundGlassM5rNearAlphaAnalysis = Readonly<{
  identity: GroundGlassM5rNearAlphaIdentity;
  renderer: GroundGlassM5rNearAlphaRendererProvenance;
  referenceId: string;
  gpu: GroundGlassM5rNearAlphaSideSummary;
  cpu: GroundGlassM5rNearAlphaSideSummary;
  intermediateErrors: Readonly<{
    nearCenterIsNear: GroundGlassM5rScalarError;
    nearEvaluatedProposalCount: GroundGlassM5rScalarError;
    nearAcceptedProposalCount: GroundGlassM5rScalarError;
    nearNonzeroMembershipCount: GroundGlassM5rScalarError;
    nearWeightSum: GroundGlassM5rScalarError;
    nearCoverageMass: GroundGlassM5rScalarError;
    nearEstimatedCoverage: GroundGlassM5rScalarError;
    nearFinalAlpha: GroundGlassM5rScalarError;
    nearAcceptedAreaRatioMean: GroundGlassM5rScalarError;
    nearAcceptedCompensationMaximum: GroundGlassM5rScalarError;
  }>;
  nearOutputErrors: Readonly<{
    red: GroundGlassM5rScalarError;
    green: GroundGlassM5rScalarError;
    blue: GroundGlassM5rScalarError;
    rgb: GroundGlassM5rScalarError;
    alpha: GroundGlassM5rScalarError;
    rgba: GroundGlassM5rScalarError;
  }>;
  centerOverride: Readonly<{
    gpuCenterNearAlphaNotOneCount: number;
    cpuCenterNearAlphaNotOneCount: number;
    gpuFinalAlphaFormulaError: GroundGlassM5rScalarError;
    cpuFinalAlphaFormulaError: GroundGlassM5rScalarError;
  }>;
  /**
   * Decision mismatches are reported separately from numeric-only differences.
   * No tolerance is used to label a value as equal: metrics retain exact and
   * maximum-error evidence for callers to interpret.
   */
  rejectionVsPrecisionAttribution: Readonly<{
    proposalDecisionMismatchPixels: number;
    centerClassificationMismatchPixels: number;
    proposalEvaluationScheduleMismatchPixels: number;
    numericOnlyDifferencePixels: number;
    decisionAndNumericDifferencePixels: number;
    decisionOnlyDifferencePixels: number;
    exactMatchPixels: number;
  }>;
  binary16: Readonly<{
    available: boolean;
    storedAlpha: GroundGlassM5rAlphaDistribution | null;
    rawBitsRoundTripMismatchCount: number | null;
    decodedBitsVsGpuTargetAlpha: GroundGlassM5rScalarError | null;
    gpuDiagnosticVsStoredAlpha: GroundGlassM5rScalarError | null;
    cpuDiagnosticVsStoredAlpha: GroundGlassM5rScalarError | null;
    sameHalfBinCount: number | null;
    differentHalfBinCount: number | null;
    preQuantizationDifferenceWithinSameHalfBinCount: number | null;
  }>;
}>;

const IDENTITY_FIELDS = [
  "captureId",
  "requestId",
  "sceneId",
  "inputFingerprint",
  "outputWidthPx",
  "outputHeightPx",
  "sampleCount",
  "pixelOrder",
] as const satisfies readonly (keyof GroundGlassM5rNearAlphaIdentity)[];

const INTERMEDIATE_FIELDS = [
  "nearCenterIsNear",
  "nearEvaluatedProposalCount",
  "nearAcceptedProposalCount",
  "nearNonzeroMembershipCount",
  "nearWeightSum",
  "nearCoverageMass",
  "nearEstimatedCoverage",
  "nearFinalAlpha",
  "nearAcceptedAreaRatioMean",
  "nearAcceptedCompensationMaximum",
] as const satisfies readonly (keyof GroundGlassM5rNearAlphaIntermediates)[];

type NearIntermediateField = typeof INTERMEDIATE_FIELDS[number];

const requireNonEmptyString = (value: string, label: string): void => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError(`${label} must be a non-empty string`);
  }
};

const assertIdentity = (identity: GroundGlassM5rNearAlphaIdentity): number => {
  for (const field of ["captureId", "requestId", "sceneId", "inputFingerprint"] as const) {
    requireNonEmptyString(identity[field], `Near alpha ${field}`);
  }
  if (!Number.isSafeInteger(identity.outputWidthPx) || identity.outputWidthPx < 1
      || !Number.isSafeInteger(identity.outputHeightPx) || identity.outputHeightPx < 1) {
    throw new RangeError("Near alpha output dimensions must be positive safe integers");
  }
  if (!Number.isInteger(identity.sampleCount) || identity.sampleCount < 1
      || identity.sampleCount > GROUND_GLASS_M5R_NEAR_ALPHA_MAX_PROPOSALS) {
    throw new RangeError("Near alpha sample count is outside the bounded proposal range");
  }
  if (identity.pixelOrder !== "top-origin") {
    throw new RangeError("Near alpha arrays must use normalized top-origin pixel order");
  }
  const outputCount = identity.outputWidthPx * identity.outputHeightPx;
  if (!Number.isSafeInteger(outputCount) || outputCount > GROUND_GLASS_M5R_NEAR_ALPHA_MAX_PIXELS) {
    throw new RangeError("Near alpha output exceeds the bounded research-analysis size");
  }
  return outputCount;
};

const assertMatchingIdentity = (
  gpu: GroundGlassM5rNearAlphaIdentity,
  cpu: GroundGlassM5rNearAlphaIdentity,
): void => {
  for (const field of IDENTITY_FIELDS) {
    if (gpu[field] !== cpu[field]) {
      throw new RangeError(`Near alpha GPU/CPU provenance mismatch at ${field}`);
    }
  }
};

const assertRendererProvenance = (renderer: GroundGlassM5rNearAlphaRendererProvenance): void => {
  if (renderer.rendererFamily !== "webgpu-renderer"
      || renderer.actualExecutionApi !== "webgpu"
      || renderer.internalFallback !== "none") {
    throw new RangeError("Near alpha GPU evidence must come from native WebGPU without fallback");
  }
  requireNonEmptyString(renderer.rendererGenerationId, "Near alpha renderer generation ID");
};

const isIntegerInRange = (value: number, minimum: number, maximum: number): boolean =>
  Number.isInteger(value) && value >= minimum && value <= maximum;

const halfConversionScratch = new DataView(new ArrayBuffer(4));

const validateCapture = (
  capture: GroundGlassM5rNearAlphaCapture,
  outputCount: number,
  sampleCount: number,
  label: string,
): void => {
  if (!(capture.nearRgba instanceof Float32Array)
      || capture.nearRgba.length !== outputCount * 4) {
    throw new RangeError(`${label} Near RGBA must contain exactly four Float32 values per output`);
  }
  for (let index = 0; index < capture.nearRgba.length; index += 1) {
    if (!Number.isFinite(capture.nearRgba[index]!)) {
      throw new RangeError(`${label} Near RGBA must contain finite values`);
    }
  }
  for (const field of INTERMEDIATE_FIELDS) {
    const values = capture.intermediates[field];
    if (values.length !== outputCount) {
      throw new RangeError(`${label} ${field} length does not match the declared output dimensions`);
    }
    for (let index = 0; index < outputCount; index += 1) {
      const value = values[index]!;
      if (!Number.isFinite(value)) throw new RangeError(`${label} ${field} must contain finite values`);
      switch (field) {
        case "nearCenterIsNear":
          if (value !== 0 && value !== 1) {
            throw new RangeError(`${label} nearCenterIsNear values must be 0 or 1`);
          }
          break;
        case "nearEvaluatedProposalCount":
          if (!isIntegerInRange(value, 0, sampleCount)) {
            throw new RangeError(`${label} evaluated proposal counts are outside the sample count`);
          }
          break;
        case "nearAcceptedProposalCount":
          if (!isIntegerInRange(value, 0, sampleCount)) {
            throw new RangeError(`${label} accepted proposal counts are outside the sample count`);
          }
          break;
        case "nearNonzeroMembershipCount":
          if (!isIntegerInRange(value, 0, sampleCount)) {
            throw new RangeError(`${label} nonzero membership counts are outside the sample count`);
          }
          break;
        case "nearWeightSum":
        case "nearCoverageMass":
          if (value < 0) throw new RangeError(`${label} ${field} must be non-negative`);
          break;
        case "nearEstimatedCoverage":
        case "nearFinalAlpha":
          if (value < 0 || value > 1) throw new RangeError(`${label} ${field} must be in [0,1]`);
          break;
        case "nearAcceptedAreaRatioMean":
          if (value < 0 || value > 1) {
            throw new RangeError(`${label} accepted area-ratio means must be in [0,1]`);
          }
          break;
        case "nearAcceptedCompensationMaximum":
          if (value < 0 || value > sampleCount) {
            throw new RangeError(`${label} accepted compensation maxima exceed the sample count`);
          }
          break;
        default: {
          const exhaustive: never = field as never;
          throw new RangeError(`Unsupported Near alpha field ${String(exhaustive)}`);
        }
      }
    }
  }
  for (let output = 0; output < outputCount; output += 1) {
    const evaluated = capture.intermediates.nearEvaluatedProposalCount[output]!;
    const accepted = capture.intermediates.nearAcceptedProposalCount[output]!;
    const membership = capture.intermediates.nearNonzeroMembershipCount[output]!;
    if (accepted > evaluated) {
      throw new RangeError(`${label} accepted proposals exceed evaluated proposals`);
    }
    if (membership > evaluated) {
      throw new RangeError(`${label} nonzero memberships exceed evaluated proposals`);
    }
  }
  if (capture.rawNearAlphaHalfBits !== undefined) {
    if (!(capture.rawNearAlphaHalfBits instanceof Uint16Array)
        || capture.rawNearAlphaHalfBits.length !== outputCount) {
      throw new RangeError(`${label} binary16 alpha bits must contain one Uint16 per output`);
    }
  }
};

const halfFloatToNumber = (bits: number): number => {
  const sign = (bits & 0x8000) === 0 ? 1 : -1;
  const exponent = (bits >>> 10) & 0x1f;
  const mantissa = bits & 0x03ff;
  if (exponent === 0) return sign * mantissa * 2 ** -24;
  if (exponent === 0x1f) return mantissa === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  return sign * (1 + mantissa / 1024) * 2 ** (exponent - 15);
};

const floatToHalfBits = (value: number): number => {
  halfConversionScratch.setFloat32(0, value, false);
  const bits = halfConversionScratch.getUint32(0, false);
  const sign = (bits >>> 16) & 0x8000;
  const exponent = (bits >>> 23) & 0xff;
  let mantissa = bits & 0x7fffff;
  if (exponent === 0xff) return sign | (mantissa === 0 ? 0x7c00 : 0x7e00);
  let halfExponent = exponent - 127 + 15;
  if (halfExponent >= 0x1f) return sign | 0x7c00;
  if (halfExponent <= 0) {
    if (halfExponent < -10) return sign;
    mantissa |= 0x800000;
    const shift = 14 - halfExponent;
    let halfMantissa = mantissa >>> shift;
    const remainderMask = (1 << shift) - 1;
    const remainder = mantissa & remainderMask;
    const halfway = 1 << (shift - 1);
    if (remainder > halfway || (remainder === halfway && (halfMantissa & 1) === 1)) {
      halfMantissa += 1;
    }
    return sign | halfMantissa;
  }
  let halfMantissa = mantissa >>> 13;
  const remainder = mantissa & 0x1fff;
  if (remainder > 0x1000 || (remainder === 0x1000 && (halfMantissa & 1) === 1)) {
    halfMantissa += 1;
    if (halfMantissa === 0x400) {
      halfMantissa = 0;
      halfExponent += 1;
      if (halfExponent >= 0x1f) return sign | 0x7c00;
    }
  }
  return sign | (halfExponent << 10) | halfMantissa;
};

const compareScalars = (
  length: number,
  leftAt: (index: number) => number,
  rightAt: (index: number) => number,
): GroundGlassM5rScalarError => {
  let squaredError = 0;
  let exactMismatchCount = 0;
  let maximumAbsoluteError = 0;
  let maximumAbsoluteErrorIndex = 0;
  for (let index = 0; index < length; index += 1) {
    const left = leftAt(index);
    const right = rightAt(index);
    const difference = Math.abs(left - right);
    if (!Number.isFinite(difference)) throw new RangeError("Near alpha comparison encountered a non-finite difference");
    squaredError += difference * difference;
    if (difference !== 0) exactMismatchCount += 1;
    if (difference > maximumAbsoluteError) {
      maximumAbsoluteError = difference;
      maximumAbsoluteErrorIndex = index;
    }
  }
  return {
    valueCount: length,
    exactMismatchCount,
    rootMeanSquareError: Math.sqrt(squaredError / length),
    maximumAbsoluteError,
    maximumAbsoluteErrorIndex,
  };
};

const alphaDistribution = (values: ArrayLike<number>, pixelCount: number, alphaOffset = 0): GroundGlassM5rAlphaDistribution => {
  let zeroCount = 0;
  let oneCount = 0;
  let fractionalCount = 0;
  let belowZeroCount = 0;
  let aboveOneCount = 0;
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const alpha = values[pixel * 4 + alphaOffset]!;
    if (!Number.isFinite(alpha)) throw new RangeError("Near alpha distribution contains a non-finite value");
    if (alpha === 0) zeroCount += 1;
    else if (alpha === 1) oneCount += 1;
    else if (alpha > 0 && alpha < 1) fractionalCount += 1;
    if (alpha < 0) belowZeroCount += 1;
    if (alpha > 1) aboveOneCount += 1;
    minimum = Math.min(minimum, alpha);
    maximum = Math.max(maximum, alpha);
    sum += alpha;
  }
  return {
    pixelCount,
    zeroCount,
    oneCount,
    fractionalCount,
    belowZeroCount,
    aboveOneCount,
    minimum,
    maximum,
    mean: sum / pixelCount,
  };
};

const diagnosticAlphaDistribution = (
  values: ArrayLike<number>,
  pixelCount: number,
): GroundGlassM5rAlphaDistribution => {
  const rgba = new Float32Array(pixelCount * 4);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) rgba[pixel * 4 + 3] = values[pixel]!;
  return alphaDistribution(rgba, pixelCount, 3);
};

const summarizePopulation = (
  capture: GroundGlassM5rNearAlphaCapture,
  pixels: readonly number[],
): GroundGlassM5rNearAlphaPopulation => {
  let withAcceptedProposals = 0;
  let evaluatedProposalTotal = 0;
  let acceptedProposalTotal = 0;
  let nonzeroMembershipProposalTotal = 0;
  let alphaSum = 0;
  let alphaMinimum = Number.POSITIVE_INFINITY;
  let alphaMaximum = Number.NEGATIVE_INFINITY;
  let alphaZeroCount = 0;
  let alphaOneCount = 0;
  let alphaFractionalCount = 0;
  let alphaBelowZeroCount = 0;
  let alphaAboveOneCount = 0;
  for (const pixel of pixels) {
    const evaluated = capture.intermediates.nearEvaluatedProposalCount[pixel]!;
    const accepted = capture.intermediates.nearAcceptedProposalCount[pixel]!;
    const nonzero = capture.intermediates.nearNonzeroMembershipCount[pixel]!;
    const alpha = capture.nearRgba[pixel * 4 + 3]!;
    if (accepted > 0) withAcceptedProposals += 1;
    evaluatedProposalTotal += evaluated;
    acceptedProposalTotal += accepted;
    nonzeroMembershipProposalTotal += nonzero;
    alphaSum += alpha;
    alphaMinimum = Math.min(alphaMinimum, alpha);
    alphaMaximum = Math.max(alphaMaximum, alpha);
    if (alpha === 0) alphaZeroCount += 1;
    else if (alpha === 1) alphaOneCount += 1;
    else if (alpha > 0 && alpha < 1) alphaFractionalCount += 1;
    if (alpha < 0) alphaBelowZeroCount += 1;
    if (alpha > 1) alphaAboveOneCount += 1;
  }
  const outputCount = pixels.length;
  return {
    outputCount,
    withAcceptedProposals,
    withoutAcceptedProposals: outputCount - withAcceptedProposals,
    evaluatedProposalTotal,
    acceptedProposalTotal,
    rejectedProposalTotal: evaluatedProposalTotal - acceptedProposalTotal,
    nonzeroMembershipProposalTotal,
    alpha: {
      pixelCount: outputCount,
      zeroCount: alphaZeroCount,
      oneCount: alphaOneCount,
      fractionalCount: alphaFractionalCount,
      belowZeroCount: alphaBelowZeroCount,
      aboveOneCount: alphaAboveOneCount,
      minimum: outputCount ? alphaMinimum : 0,
      maximum: outputCount ? alphaMaximum : 0,
      mean: outputCount ? alphaSum / outputCount : 0,
    },
  };
};

const summarizeGroups = (
  capture: GroundGlassM5rNearAlphaCapture,
  pixelCount: number,
  centerNear: boolean,
): GroundGlassM5rNearAlphaPopulationGroups => {
  const matchingPixels: number[] = [];
  const acceptedPixels: number[] = [];
  const rejectedPixels: number[] = [];
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if ((capture.intermediates.nearCenterIsNear[pixel] === 1) !== centerNear) continue;
    matchingPixels.push(pixel);
    if (capture.intermediates.nearAcceptedProposalCount[pixel]! > 0) acceptedPixels.push(pixel);
    else rejectedPixels.push(pixel);
  }
  return {
    all: summarizePopulation(capture, matchingPixels),
    withAcceptedProposals: summarizePopulation(capture, acceptedPixels),
    withoutAcceptedProposals: summarizePopulation(capture, rejectedPixels),
  };
};

const sideSummary = (
  capture: GroundGlassM5rNearAlphaCapture,
  pixelCount: number,
): GroundGlassM5rNearAlphaSideSummary => {
  let validOffCenterFractionalCoveragePixelCount = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (capture.intermediates.nearCenterIsNear[pixel] !== 0
        || capture.intermediates.nearAcceptedProposalCount[pixel] === 0) continue;
    const estimate = capture.intermediates.nearEstimatedCoverage[pixel]!;
    const finalAlpha = capture.intermediates.nearFinalAlpha[pixel]!;
    const expectedFinalAlpha = Math.min(1, Math.max(0, estimate));
    const outputAlpha = capture.nearRgba[pixel * 4 + 3]!;
    if (estimate > 0 && estimate < 1
        && finalAlpha === expectedFinalAlpha
        && finalAlpha > 0 && finalAlpha < 1
        && outputAlpha > 0 && outputAlpha < 1) {
      validOffCenterFractionalCoveragePixelCount += 1;
    }
  }
  return {
    outputAlpha: alphaDistribution(capture.nearRgba, pixelCount, 3),
    diagnosticFinalAlpha: diagnosticAlphaDistribution(capture.intermediates.nearFinalAlpha, pixelCount),
    populations: {
      centerNear: summarizeGroups(capture, pixelCount, true),
      offCenter: summarizeGroups(capture, pixelCount, false),
    },
    validOffCenterFractionalCoveragePixelCount,
  };
};

const formulaError = (
  capture: GroundGlassM5rNearAlphaCapture,
  pixelCount: number,
): GroundGlassM5rScalarError => compareScalars(
  pixelCount,
  (pixel) => capture.intermediates.nearFinalAlpha[pixel]!,
  (pixel) => capture.intermediates.nearCenterIsNear[pixel] === 1
    ? 1
    : Math.min(1, Math.max(0, capture.intermediates.nearEstimatedCoverage[pixel]!)),
);

const rgbaErrors = (
  gpu: Float32Array,
  cpu: Float32Array,
  pixelCount: number,
): GroundGlassM5rNearAlphaAnalysis["nearOutputErrors"] => {
  const channelMetric = (channel: number): GroundGlassM5rScalarError =>
    compareScalars(pixelCount, (pixel) => gpu[pixel * 4 + channel]!, (pixel) => cpu[pixel * 4 + channel]!);
  return {
    red: channelMetric(0),
    green: channelMetric(1),
    blue: channelMetric(2),
    rgb: compareScalars(pixelCount * 3,
      (index) => gpu[Math.floor(index / 3) * 4 + index % 3]!,
      (index) => cpu[Math.floor(index / 3) * 4 + index % 3]!),
    alpha: channelMetric(3),
    rgba: compareScalars(pixelCount * 4, (index) => gpu[index]!, (index) => cpu[index]!),
  };
};

const compareIntermediates = (
  gpu: GroundGlassM5rNearAlphaIntermediates,
  cpu: GroundGlassM5rNearAlphaIntermediates,
  outputCount: number,
): GroundGlassM5rNearAlphaAnalysis["intermediateErrors"] => {
  const result = {} as Record<NearIntermediateField, GroundGlassM5rScalarError>;
  for (const field of INTERMEDIATE_FIELDS) {
    result[field] = compareScalars(outputCount, (index) => gpu[field][index]!, (index) => cpu[field][index]!);
  }
  return result;
};

const classifyDifferences = (
  gpu: GroundGlassM5rNearAlphaCapture,
  cpu: GroundGlassM5rNearAlphaCapture,
  pixelCount: number,
): GroundGlassM5rNearAlphaAnalysis["rejectionVsPrecisionAttribution"] => {
  let proposalDecisionMismatchPixels = 0;
  let centerClassificationMismatchPixels = 0;
  let proposalEvaluationScheduleMismatchPixels = 0;
  let numericOnlyDifferencePixels = 0;
  let decisionAndNumericDifferencePixels = 0;
  let decisionOnlyDifferencePixels = 0;
  let exactMatchPixels = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const gpuCenter = gpu.intermediates.nearCenterIsNear[pixel]!;
    const cpuCenter = cpu.intermediates.nearCenterIsNear[pixel]!;
    const centerMismatch = gpuCenter !== cpuCenter;
    const scheduleMismatch = gpu.intermediates.nearEvaluatedProposalCount[pixel]
      !== cpu.intermediates.nearEvaluatedProposalCount[pixel];
    const acceptanceMismatch = gpu.intermediates.nearAcceptedProposalCount[pixel]
      !== cpu.intermediates.nearAcceptedProposalCount[pixel]
      || gpu.intermediates.nearNonzeroMembershipCount[pixel]
        !== cpu.intermediates.nearNonzeroMembershipCount[pixel];
    if (centerMismatch) centerClassificationMismatchPixels += 1;
    if (scheduleMismatch) proposalEvaluationScheduleMismatchPixels += 1;
    if (acceptanceMismatch) proposalDecisionMismatchPixels += 1;

    const discreteMismatch = centerMismatch || scheduleMismatch || acceptanceMismatch;
    let numericMismatch = false;
    for (const field of INTERMEDIATE_FIELDS) {
      if (field === "nearCenterIsNear" || field === "nearEvaluatedProposalCount"
          || field === "nearAcceptedProposalCount" || field === "nearNonzeroMembershipCount") continue;
      if (gpu.intermediates[field][pixel] !== cpu.intermediates[field][pixel]) numericMismatch = true;
    }
    for (let channel = 0; channel < 4; channel += 1) {
      if (gpu.nearRgba[pixel * 4 + channel] !== cpu.nearRgba[pixel * 4 + channel]) numericMismatch = true;
    }
    if (discreteMismatch && numericMismatch) decisionAndNumericDifferencePixels += 1;
    else if (discreteMismatch) decisionOnlyDifferencePixels += 1;
    else if (numericMismatch) numericOnlyDifferencePixels += 1;
    else exactMatchPixels += 1;
  }
  return {
    proposalDecisionMismatchPixels,
    centerClassificationMismatchPixels,
    proposalEvaluationScheduleMismatchPixels,
    numericOnlyDifferencePixels,
    decisionAndNumericDifferencePixels,
    decisionOnlyDifferencePixels,
    exactMatchPixels,
  };
};

const binary16Summary = (
  gpu: GroundGlassM5rNearAlphaCapture,
  cpu: GroundGlassM5rNearAlphaCapture,
  pixelCount: number,
): GroundGlassM5rNearAlphaAnalysis["binary16"] => {
  const bits = gpu.rawNearAlphaHalfBits;
  if (bits === undefined) {
    return {
      available: false,
      storedAlpha: null,
      rawBitsRoundTripMismatchCount: null,
      decodedBitsVsGpuTargetAlpha: null,
      gpuDiagnosticVsStoredAlpha: null,
      cpuDiagnosticVsStoredAlpha: null,
      sameHalfBinCount: null,
      differentHalfBinCount: null,
      preQuantizationDifferenceWithinSameHalfBinCount: null,
    };
  }
  const decodedAlpha = new Float32Array(pixelCount);
  let rawBitsRoundTripMismatchCount = 0;
  let sameHalfBinCount = 0;
  let differentHalfBinCount = 0;
  let preQuantizationDifferenceWithinSameHalfBinCount = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const value = halfFloatToNumber(bits[pixel]!);
    if (!Number.isFinite(value)) throw new RangeError("Near binary16 alpha bits decode to a non-finite value");
    decodedAlpha[pixel] = value;
    if (floatToHalfBits(gpu.intermediates.nearFinalAlpha[pixel]!) !== bits[pixel]) {
      rawBitsRoundTripMismatchCount += 1;
    }
    const gpuBin = floatToHalfBits(gpu.intermediates.nearFinalAlpha[pixel]!);
    const cpuBin = floatToHalfBits(cpu.intermediates.nearFinalAlpha[pixel]!);
    if (gpuBin === cpuBin) {
      sameHalfBinCount += 1;
      if (gpu.intermediates.nearFinalAlpha[pixel] !== cpu.intermediates.nearFinalAlpha[pixel]) {
        preQuantizationDifferenceWithinSameHalfBinCount += 1;
      }
    } else {
      differentHalfBinCount += 1;
    }
  }
  return {
    available: true,
    storedAlpha: diagnosticAlphaDistribution(decodedAlpha, pixelCount),
    rawBitsRoundTripMismatchCount,
    decodedBitsVsGpuTargetAlpha: compareScalars(pixelCount,
      (pixel) => halfFloatToNumber(bits[pixel]!),
      (pixel) => gpu.nearRgba[pixel * 4 + 3]!),
    gpuDiagnosticVsStoredAlpha: compareScalars(pixelCount,
      (pixel) => gpu.intermediates.nearFinalAlpha[pixel]!,
      (pixel) => halfFloatToNumber(bits[pixel]!),
    ),
    cpuDiagnosticVsStoredAlpha: compareScalars(pixelCount,
      (pixel) => cpu.intermediates.nearFinalAlpha[pixel]!,
      (pixel) => halfFloatToNumber(bits[pixel]!),
    ),
    sameHalfBinCount,
    differentHalfBinCount,
    preQuantizationDifferenceWithinSameHalfBinCount,
  };
};

/** Analyze one matched, bounded CPU/native-GPU Near alpha capture pair. */
export const analyzeGroundGlassM5rNearAlpha = (
  input: GroundGlassM5rNearAlphaAnalysisInput,
): GroundGlassM5rNearAlphaAnalysis => {
  const { gpu, cpu } = input;
  assertMatchingIdentity(gpu.identity, cpu.identity);
  const outputCount = assertIdentity(gpu.identity);
  assertIdentity(cpu.identity);
  assertRendererProvenance(gpu.renderer);
  requireNonEmptyString(cpu.referenceId, "Near alpha CPU reference ID");
  validateCapture(gpu, outputCount, gpu.identity.sampleCount, "GPU");
  validateCapture(cpu, outputCount, cpu.identity.sampleCount, "CPU");

  const intermediateErrors = compareIntermediates(gpu.intermediates, cpu.intermediates, outputCount);
  let gpuCenterNearAlphaNotOneCount = 0;
  let cpuCenterNearAlphaNotOneCount = 0;
  for (let pixel = 0; pixel < outputCount; pixel += 1) {
    if (gpu.intermediates.nearCenterIsNear[pixel] === 1
        && gpu.intermediates.nearFinalAlpha[pixel] !== 1) gpuCenterNearAlphaNotOneCount += 1;
    if (cpu.intermediates.nearCenterIsNear[pixel] === 1
        && cpu.intermediates.nearFinalAlpha[pixel] !== 1) cpuCenterNearAlphaNotOneCount += 1;
  }

  return {
    identity: gpu.identity,
    renderer: gpu.renderer,
    referenceId: cpu.referenceId,
    gpu: sideSummary(gpu, outputCount),
    cpu: sideSummary(cpu, outputCount),
    intermediateErrors,
    nearOutputErrors: rgbaErrors(gpu.nearRgba, cpu.nearRgba, outputCount),
    centerOverride: {
      gpuCenterNearAlphaNotOneCount,
      cpuCenterNearAlphaNotOneCount,
      gpuFinalAlphaFormulaError: formulaError(gpu, outputCount),
      cpuFinalAlphaFormulaError: formulaError(cpu, outputCount),
    },
    rejectionVsPrecisionAttribution: classifyDifferences(gpu, cpu, outputCount),
    binary16: binary16Summary(gpu, cpu, outputCount),
  };
};
