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
