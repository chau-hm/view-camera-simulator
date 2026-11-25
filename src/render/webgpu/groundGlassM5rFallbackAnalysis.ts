/**
 * Readback-only M5R analysis of B1's GPU-authored fallback decisions.
 *
 * This module does not implement or alter B1. It analyzes a matched Half32,
 * Full32, Full64 capture matrix and keeps the source-target readback color
 * domain unchanged.
 */

import {
  GROUND_GLASS_B1_FALLBACK_REASON,
  GROUND_GLASS_B1_SELECTED_PATH,
  groundGlassB1FallbackReasonName,
  type GroundGlassB1FallbackReason,
} from "./groundGlassB1Reference";
import type {
  GroundGlassApertureGatherR3Capture,
  GroundGlassApertureGatherR3CaptureMatrix,
  GroundGlassR3QualityMode,
} from "./groundGlassApertureGatherQuality";

export const GROUND_GLASS_M5R_MEANINGFUL_BLUR_FLOOR = 0.01;
export const GROUND_GLASS_M5R_DEPTH_EDGE_THRESHOLD = 0.0001;
export const GROUND_GLASS_M5R_SIGN_EPSILON_MM = 0.00001;
export const GROUND_GLASS_M5R_BOUNDARY_DIFFERENCE_THRESHOLD = 0.01;
export const GROUND_GLASS_M5R_BOUNDARY_DISTANCE_LIMIT_PX = 8;
export const GROUND_GLASS_M5R_LEAKAGE_DIRECTION_TOLERANCE = 0.000001;
const MAX_PIXELS = 1_000_000;
const MAX_BOUNDARY_DISTANCE_LIMIT_PX = 64;

const REASONS = [
  { key: "farGatherAccepted", code: GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted },
  { key: "missingOrOutOfBoundsProvenance", code: GROUND_GLASS_B1_FALLBACK_REASON.missingOrOutOfBoundsProvenance },
  { key: "selectedCenterProvenanceMismatch", code: GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterProvenanceMismatch },
  { key: "invalidOrUnresolvedCenter", code: GROUND_GLASS_B1_FALLBACK_REASON.invalidOrUnresolvedCenter },
  { key: "selectedCenterNotFarEligible", code: GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible },
  { key: "unusableGatherData", code: GROUND_GLASS_B1_FALLBACK_REASON.unusableGatherData },
] as const satisfies readonly Readonly<{ key: string; code: GroundGlassB1FallbackReason }>[];

export type GroundGlassM5rFallbackReasonKey = (typeof REASONS)[number]["key"];

export type GroundGlassM5rDistribution = Readonly<{
  sampleCount: number;
  mean: number | null;
  p50: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
  maximum: number | null;
}>;

export type GroundGlassM5rBoundaryDifferenceRing = Readonly<{
  distancePx: number;
  pixelCount: number;
  atOrAboveThresholdPixelCount: number;
  atOrAboveThresholdFraction: number | null;
  meanAbsoluteRgbDifference: number | null;
  maximumAbsoluteRgbDifference: number | null;
}>;

export type GroundGlassM5rBoundaryDifferenceProfile = Readonly<{
  status: "measured" | "insufficient-support";
  sampledPixelCount: number;
  atOrAboveThresholdPixelCount: number;
  maximumSupportedDistancePx: number | null;
  /** Number of distance rings from the boundary, including ring zero. */
  supportedWidthPx: number | null;
  radiusLimitReachedBySupportedPixels: boolean;
  byDistance: readonly GroundGlassM5rBoundaryDifferenceRing[];
}>;

export type GroundGlassM5rLeakageComparison = Readonly<{
  sampleCount: number;
  b1CloserToNearSourcePixelCount: number;
  referenceCloserToNearSourcePixelCount: number;
  tiePixelCount: number;
  b1CloserFraction: number | null;
  meanB1NearSourceRgbDifference: number | null;
  meanReferenceNearSourceRgbDifference: number | null;
  /** Positive values mean B1 is closer to the near-side source color. */
  meanReferenceMinusB1NearSourceDifference: number | null;
}>;

export type GroundGlassM5rLeakageBoundary = Readonly<{
  status: "measured" | "insufficient-support";
  pairCount: number;
  full32: GroundGlassM5rLeakageComparison;
  full64: GroundGlassM5rLeakageComparison;
}>;

export type GroundGlassM5rRgbError = Readonly<{
  pixelCount: number;
  channelCount: number;
  meanAbsoluteChannelError: number | null;
  rmse: number | null;
  maximumChannelError: number | null;
}>;

export type GroundGlassM5rRgbErrorPartitions = Readonly<{
  all: GroundGlassM5rRgbError;
  validFar: GroundGlassM5rRgbError;
  depthEdge: GroundGlassM5rRgbError;
  signedBoundary: GroundGlassM5rRgbError;
}>;

export type GroundGlassM5rReasonMetrics = Readonly<{
  reasonCode: GroundGlassB1FallbackReason;
  reasonName: string;
  pixelCount: number;
  fallbackPixelCount: number;
  validFarPixelCount: number;
  validFarFallbackPixelCount: number;
  meaningfulBlurPixelCount: number;
  negligibleBlurPixelCount: number;
  meaningfulBlurFallbackPixelCount: number;
  negligibleBlurFallbackPixelCount: number;
  referenceBlurMeanRgbDifference: number | null;
  referenceBlurMaximumRgbDifference: number | null;
  candidateBlurMeanRgbDifference: number | null;
  candidateBlurMaximumRgbDifference: number | null;
  depthEdgeOverlapPixelCount: number;
  depthEdgeFallbackOverlapPixelCount: number;
  signedBoundaryOverlapPixelCount: number;
  signedBoundaryFallbackOverlapPixelCount: number;
  sourceColorDelta: GroundGlassM5rRgbErrorPartitions;
  full32Error: GroundGlassM5rRgbErrorPartitions;
  full64Error: GroundGlassM5rRgbErrorPartitions;
}>;

export type GroundGlassM5rFallbackAnalysis = Readonly<{
  schemaVersion: 1;
  evidenceScope: "single-matched-native-webgpu-state";
  captureIds: Readonly<{ half32: string; full32: string; full64: string }>;
  requestIds: Readonly<{ half32: string; full32: string; full64: string }>;
  sceneId: string;
  sceneSourceRevision: string;
  minimumMeaningfulBlurRgbDifference: number;
  depthEdgeThreshold: number;
  fallbackSummary: Readonly<{
    pixelCount: number;
    validFarPixelCount: number;
    meaningfulBlurPixelCount: number;
    negligibleBlurPixelCount: number;
    meaningfulBlurFraction: number | null;
    meaningfulBlurValidFarPixelCount: number;
    negligibleBlurValidFarPixelCount: number;
    sourceColorDelta: GroundGlassM5rRgbError;
    full32Error: GroundGlassM5rRgbError;
    full64Error: GroundGlassM5rRgbError;
  }>;
  reasonCounts: Readonly<Record<GroundGlassM5rFallbackReasonKey, number>>;
  byReason: Readonly<Record<GroundGlassM5rFallbackReasonKey, GroundGlassM5rReasonMetrics>>;
  blurPreservation: Readonly<{
    validFarPixelCount: number;
    meaningfulReferenceBlurPixelCount: number;
    negligibleReferenceBlurPixelCount: number;
    referenceMeanRgbDifference: number | null;
    referenceMaximumRgbDifference: number | null;
    candidateMeanRgbDifference: number | null;
    candidateMaximumRgbDifference: number | null;
    candidateToReferenceMeanSignalRatio: number | null;
    relativeMeanSignalLoss: number | null;
  }>;
  fallbackBoundaryGradient: Readonly<{
    status: "measured" | "insufficient-support";
    pairCount: number;
    absoluteError: GroundGlassM5rDistribution;
    relativeError: GroundGlassM5rDistribution;
    referenceGradient: GroundGlassM5rDistribution;
    candidateGradient: GroundGlassM5rDistribution;
    denominatorFloor: Readonly<{
      value: number;
      appliedPairCount: number;
      appliedPairFraction: number | null;
    }>;
    /** Same pair set and denominator formula as the historical R3 mean. */
    historicalRelativeMeanError: number | null;
  }>;
  boundaryDifferenceSupport: Readonly<{
    status: "measured" | "insufficient-support";
    boundaryPairCount: number;
    boundaryPixelCount: number;
    thresholdRgbDifference: number;
    maximumDistancePx: number;
    distanceDefinition: "4-neighbor Manhattan distance from the nearest pixel participating in an unlike GPU fallback-status pair; boundary pixels are distance 0";
    pixelDifferenceDefinition: "mean absolute RGB channel difference at each source pixel";
    full32: GroundGlassM5rBoundaryDifferenceProfile;
    full64: GroundGlassM5rBoundaryDifferenceProfile;
  }>;
  foregroundLeakageDirection: Readonly<{
    directionToleranceRgbDifference: number;
    sampleDefinition: "compare each pair's farther-side B1/reference pixel with the Half32 source color at its near-side neighbor; lower mean absolute RGB difference is closer";
    depthNearSideDefinition: "among adjacent valid pixels with depth below 1 and depth delta at or above the configured threshold, smaller depth is near";
    signedNearSideDefinition: "among adjacent validity-code-1 pixels with opposite CoC signs beyond epsilon, negative CoC is near";
    depthEdge: GroundGlassM5rLeakageBoundary;
    signedBoundary: GroundGlassM5rLeakageBoundary;
  }>;
}>;

export type GroundGlassM5rFallbackAnalysisOptions = Readonly<{
  minimumMeaningfulBlurRgbDifference?: number;
  depthEdgeThreshold?: number;
  boundaryDifferenceThreshold?: number;
  maximumBoundaryDistancePx?: number;
  leakageDirectionTolerance?: number;
}>;

type MutableErrorAccumulator = {
  pixelCount: number;
  absoluteSum: number;
  squareSum: number;
  maximum: number;
};

type ReasonAccumulator = {
  pixelCount: number;
  fallbackPixelCount: number;
  validFarPixelCount: number;
  validFarFallbackPixelCount: number;
  meaningfulBlurPixelCount: number;
  negligibleBlurPixelCount: number;
  meaningfulBlurFallbackPixelCount: number;
  negligibleBlurFallbackPixelCount: number;
  referenceBlurSum: number;
  referenceBlurMaximum: number;
  referenceBlurSampleCount: number;
  candidateBlurSum: number;
  candidateBlurMaximum: number;
  candidateBlurSampleCount: number;
  depthEdgeOverlapPixelCount: number;
  depthEdgeFallbackOverlapPixelCount: number;
  signedBoundaryOverlapPixelCount: number;
  signedBoundaryFallbackOverlapPixelCount: number;
  sourceColorDelta: MutableErrorAccumulator;
  sourceColorDeltaValidFar: MutableErrorAccumulator;
  sourceColorDeltaDepthEdge: MutableErrorAccumulator;
  sourceColorDeltaSignedBoundary: MutableErrorAccumulator;
  full32Error: MutableErrorAccumulator;
  full32ErrorValidFar: MutableErrorAccumulator;
  full32ErrorDepthEdge: MutableErrorAccumulator;
  full32ErrorSignedBoundary: MutableErrorAccumulator;
  full64Error: MutableErrorAccumulator;
  full64ErrorValidFar: MutableErrorAccumulator;
  full64ErrorDepthEdge: MutableErrorAccumulator;
  full64ErrorSignedBoundary: MutableErrorAccumulator;
};

const makeErrorAccumulator = (): MutableErrorAccumulator => ({
  pixelCount: 0,
  absoluteSum: 0,
  squareSum: 0,
  maximum: 0,
});

const makeReasonAccumulator = (): ReasonAccumulator => ({
  pixelCount: 0,
  fallbackPixelCount: 0,
  validFarPixelCount: 0,
  validFarFallbackPixelCount: 0,
  meaningfulBlurPixelCount: 0,
  negligibleBlurPixelCount: 0,
  meaningfulBlurFallbackPixelCount: 0,
  negligibleBlurFallbackPixelCount: 0,
  referenceBlurSum: 0,
  referenceBlurMaximum: 0,
  referenceBlurSampleCount: 0,
  candidateBlurSum: 0,
  candidateBlurMaximum: 0,
  candidateBlurSampleCount: 0,
  depthEdgeOverlapPixelCount: 0,
  depthEdgeFallbackOverlapPixelCount: 0,
  signedBoundaryOverlapPixelCount: 0,
  signedBoundaryFallbackOverlapPixelCount: 0,
  sourceColorDelta: makeErrorAccumulator(),
  sourceColorDeltaValidFar: makeErrorAccumulator(),
  sourceColorDeltaDepthEdge: makeErrorAccumulator(),
  sourceColorDeltaSignedBoundary: makeErrorAccumulator(),
  full32Error: makeErrorAccumulator(),
  full32ErrorValidFar: makeErrorAccumulator(),
  full32ErrorDepthEdge: makeErrorAccumulator(),
  full32ErrorSignedBoundary: makeErrorAccumulator(),
  full64Error: makeErrorAccumulator(),
  full64ErrorValidFar: makeErrorAccumulator(),
  full64ErrorDepthEdge: makeErrorAccumulator(),
  full64ErrorSignedBoundary: makeErrorAccumulator(),
});

const emptyError = (): GroundGlassM5rRgbError => ({
  pixelCount: 0,
  channelCount: 0,
  meanAbsoluteChannelError: null,
  rmse: null,
  maximumChannelError: null,
});

const finalizeError = (accumulator: MutableErrorAccumulator): GroundGlassM5rRgbError => {
  if (accumulator.pixelCount === 0) return emptyError();
  const channelCount = accumulator.pixelCount * 3;
  return {
    pixelCount: accumulator.pixelCount,
    channelCount,
    meanAbsoluteChannelError: accumulator.absoluteSum / channelCount,
    rmse: Math.sqrt(accumulator.squareSum / channelCount),
    maximumChannelError: accumulator.maximum,
  };
};

const addError = (
  accumulator: MutableErrorAccumulator,
  reference: Float32Array,
  candidate: Float32Array,
  offset: number,
): void => {
  accumulator.pixelCount += 1;
  for (let channel = 0; channel < 3; channel += 1) {
    const error = Math.abs(reference[offset + channel]! - candidate[offset + channel]!);
    accumulator.absoluteSum += error;
    accumulator.squareSum += error * error;
    accumulator.maximum = Math.max(accumulator.maximum, error);
  }
};

const finalizePartitions = (
  all: MutableErrorAccumulator,
  validFar: MutableErrorAccumulator,
  depthEdge: MutableErrorAccumulator,
  signedBoundary: MutableErrorAccumulator,
): GroundGlassM5rRgbErrorPartitions => ({
  all: finalizeError(all),
  validFar: finalizeError(validFar),
  depthEdge: finalizeError(depthEdge),
  signedBoundary: finalizeError(signedBoundary),
});

const emptyDistribution = (): GroundGlassM5rDistribution => ({
  sampleCount: 0,
  mean: null,
  p50: null,
  p90: null,
  p95: null,
  p99: null,
  maximum: null,
});

/** Percentiles use nearest rank: sorted[ceil(q * n) - 1]. */
const summarizeDistribution = (values: readonly number[]): GroundGlassM5rDistribution => {
  if (values.length === 0) return emptyDistribution();
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (fraction: number): number => sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)]!;
  let sum = 0;
  for (const value of values) sum += value;
  return {
    sampleCount: sorted.length,
    mean: sum / sorted.length,
    p50: percentile(0.5),
    p90: percentile(0.9),
    p95: percentile(0.95),
    p99: percentile(0.99),
    maximum: sorted[sorted.length - 1]!,
  };
};

type FallbackBoundaryDistanceMap = Readonly<{
  distancePx: Int16Array;
  boundaryPairCount: number;
  boundaryPixelCount: number;
}>;

const buildFallbackBoundaryDistanceMap = (
  fallbackMask: Uint8Array,
  width: number,
  height: number,
  maximumDistancePx: number,
): FallbackBoundaryDistanceMap => {
  const pixels = width * height;
  const distancePx = new Int16Array(pixels);
  distancePx.fill(-1);
  const queue = new Int32Array(pixels);
  let queueLength = 0;
  let boundaryPairCount = 0;
  const addBoundaryPair = (first: number, second: number): void => {
    if (fallbackMask[first] === fallbackMask[second]) return;
    boundaryPairCount += 1;
    if (distancePx[first] === -1) {
      distancePx[first] = 0;
      queue[queueLength++] = first;
    }
    if (distancePx[second] === -1) {
      distancePx[second] = 0;
      queue[queueLength++] = second;
    }
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (x + 1 < width) addBoundaryPair(pixel, pixel + 1);
      if (y + 1 < height) addBoundaryPair(pixel, pixel + width);
    }
  }
  const boundaryPixelCount = queueLength;
  let queueRead = 0;
  while (queueRead < queueLength) {
    const pixel = queue[queueRead++]!;
    const distance = distancePx[pixel]!;
    if (distance >= maximumDistancePx) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const nextDistance = distance + 1;
    const enqueue = (neighbor: number): void => {
      if (distancePx[neighbor] !== -1) return;
      distancePx[neighbor] = nextDistance;
      queue[queueLength++] = neighbor;
    };
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }
  return { distancePx, boundaryPairCount, boundaryPixelCount };
};

type MutableBoundaryRing = {
  pixelCount: number;
  atOrAboveThresholdPixelCount: number;
  differenceSum: number;
  maximumDifference: number;
};

const makeBoundaryDifferenceProfile = (
  reference: Float32Array,
  candidate: Float32Array,
  distancePx: Int16Array,
  maximumDistancePx: number,
  threshold: number,
  hasBoundarySupport: boolean,
): GroundGlassM5rBoundaryDifferenceProfile => {
  const rings: MutableBoundaryRing[] = Array.from({ length: maximumDistancePx + 1 }, () => ({
    pixelCount: 0,
    atOrAboveThresholdPixelCount: 0,
    differenceSum: 0,
    maximumDifference: 0,
  }));
  for (let pixel = 0; pixel < distancePx.length; pixel += 1) {
    const distance = distancePx[pixel]!;
    if (distance < 0 || distance > maximumDistancePx) continue;
    const offset = pixel * 4;
    const difference = (Math.abs(candidate[offset]! - reference[offset]!)
      + Math.abs(candidate[offset + 1]! - reference[offset + 1]!)
      + Math.abs(candidate[offset + 2]! - reference[offset + 2]!)) / 3;
    const ring = rings[distance]!;
    ring.pixelCount += 1;
    ring.differenceSum += difference;
    ring.maximumDifference = Math.max(ring.maximumDifference, difference);
    if (difference >= threshold) ring.atOrAboveThresholdPixelCount += 1;
  }
  const byDistance = rings.map((ring, distance): GroundGlassM5rBoundaryDifferenceRing => ({
    distancePx: distance,
    pixelCount: ring.pixelCount,
    atOrAboveThresholdPixelCount: ring.atOrAboveThresholdPixelCount,
    atOrAboveThresholdFraction: ring.pixelCount
      ? ring.atOrAboveThresholdPixelCount / ring.pixelCount : null,
    meanAbsoluteRgbDifference: ring.pixelCount ? ring.differenceSum / ring.pixelCount : null,
    maximumAbsoluteRgbDifference: ring.pixelCount ? ring.maximumDifference : null,
  }));
  const sampledPixelCount = rings.reduce((sum, ring) => sum + ring.pixelCount, 0);
  const atOrAboveThresholdPixelCount = rings.reduce(
    (sum, ring) => sum + ring.atOrAboveThresholdPixelCount, 0,
  );
  const maximumSupportedDistancePx = byDistance.reduce<number | null>((maximum, ring) => (
    ring.atOrAboveThresholdPixelCount > 0 ? ring.distancePx : maximum
  ), null);
  return {
    status: hasBoundarySupport ? "measured" : "insufficient-support",
    sampledPixelCount,
    atOrAboveThresholdPixelCount,
    maximumSupportedDistancePx,
    supportedWidthPx: maximumSupportedDistancePx === null ? null : maximumSupportedDistancePx + 1,
    radiusLimitReachedBySupportedPixels: maximumSupportedDistancePx === maximumDistancePx,
    byDistance,
  };
};

type MutableLeakageComparison = {
  sampleCount: number;
  b1CloserToNearSourcePixelCount: number;
  referenceCloserToNearSourcePixelCount: number;
  tiePixelCount: number;
  b1NearSourceErrorSum: number;
  referenceNearSourceErrorSum: number;
};

const makeLeakageAccumulator = (): MutableLeakageComparison => ({
  sampleCount: 0,
  b1CloserToNearSourcePixelCount: 0,
  referenceCloserToNearSourcePixelCount: 0,
  tiePixelCount: 0,
  b1NearSourceErrorSum: 0,
  referenceNearSourceErrorSum: 0,
});

const meanRgbDifferenceAt = (
  color: Float32Array,
  pixel: number,
  source: Float32Array,
  sourcePixel: number,
): number => {
  const colorOffset = pixel * 4;
  const sourceOffset = sourcePixel * 4;
  return (Math.abs(color[colorOffset]! - source[sourceOffset]!)
    + Math.abs(color[colorOffset + 1]! - source[sourceOffset + 1]!)
    + Math.abs(color[colorOffset + 2]! - source[sourceOffset + 2]!)) / 3;
};

const addLeakageComparison = (
  accumulator: MutableLeakageComparison,
  source: Float32Array,
  nearPixel: number,
  farPixel: number,
  candidate: Float32Array,
  reference: Float32Array,
  tolerance: number,
): void => {
  const candidateError = meanRgbDifferenceAt(candidate, farPixel, source, nearPixel);
  const referenceError = meanRgbDifferenceAt(reference, farPixel, source, nearPixel);
  const referenceMinusB1 = referenceError - candidateError;
  accumulator.sampleCount += 1;
  accumulator.b1NearSourceErrorSum += candidateError;
  accumulator.referenceNearSourceErrorSum += referenceError;
  if (referenceMinusB1 > tolerance) accumulator.b1CloserToNearSourcePixelCount += 1;
  else if (referenceMinusB1 < -tolerance) accumulator.referenceCloserToNearSourcePixelCount += 1;
  else accumulator.tiePixelCount += 1;
};

const finalizeLeakageComparison = (
  accumulator: MutableLeakageComparison,
): GroundGlassM5rLeakageComparison => ({
  sampleCount: accumulator.sampleCount,
  b1CloserToNearSourcePixelCount: accumulator.b1CloserToNearSourcePixelCount,
  referenceCloserToNearSourcePixelCount: accumulator.referenceCloserToNearSourcePixelCount,
  tiePixelCount: accumulator.tiePixelCount,
  b1CloserFraction: accumulator.sampleCount
    ? accumulator.b1CloserToNearSourcePixelCount / accumulator.sampleCount : null,
  meanB1NearSourceRgbDifference: accumulator.sampleCount
    ? accumulator.b1NearSourceErrorSum / accumulator.sampleCount : null,
  meanReferenceNearSourceRgbDifference: accumulator.sampleCount
    ? accumulator.referenceNearSourceErrorSum / accumulator.sampleCount : null,
  meanReferenceMinusB1NearSourceDifference: accumulator.sampleCount
    ? (accumulator.referenceNearSourceErrorSum - accumulator.b1NearSourceErrorSum) / accumulator.sampleCount
    : null,
});

const finalizeLeakageBoundary = (
  pairCount: number,
  full32: MutableLeakageComparison,
  full64: MutableLeakageComparison,
): GroundGlassM5rLeakageBoundary => ({
  status: pairCount ? "measured" : "insufficient-support",
  pairCount,
  full32: finalizeLeakageComparison(full32),
  full64: finalizeLeakageComparison(full64),
});

const analyzeForegroundLeakageDirection = (
  half: GroundGlassApertureGatherR3Capture,
  full32: GroundGlassApertureGatherR3Capture,
  full64: GroundGlassApertureGatherR3Capture,
  depthEdgeThreshold: number,
  tolerance: number,
): GroundGlassM5rFallbackAnalysis["foregroundLeakageDirection"] => {
  const { widthPx: width, heightPx: height } = half.sourceDimensions;
  const { depth, physicalRgba, validity, sourceRgba, b1FarRgba } = half.readbackBuffers;
  const depthFull32 = makeLeakageAccumulator();
  const depthFull64 = makeLeakageAccumulator();
  const signedFull32 = makeLeakageAccumulator();
  const signedFull64 = makeLeakageAccumulator();
  let depthPairCount = 0;
  let signedPairCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= width || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (validity[pixel] !== 1 || validity[neighbor] !== 1) continue;
        const firstDepth = depth[pixel]!;
        const secondDepth = depth[neighbor]!;
        if (firstDepth < 1 && secondDepth < 1
            && Math.abs(firstDepth - secondDepth) >= depthEdgeThreshold) {
          const nearPixel = firstDepth < secondDepth ? pixel : neighbor;
          const farPixel = firstDepth < secondDepth ? neighbor : pixel;
          addLeakageComparison(depthFull32, sourceRgba, nearPixel, farPixel, b1FarRgba,
            full32.readbackBuffers.farGatherRgba, tolerance);
          addLeakageComparison(depthFull64, sourceRgba, nearPixel, farPixel, b1FarRgba,
            full64.readbackBuffers.farGatherRgba, tolerance);
          depthPairCount += 1;
        }

        const firstCoc = physicalRgba[pixel * 4]!;
        const secondCoc = physicalRgba[neighbor * 4]!;
        const firstNear = firstCoc < -GROUND_GLASS_M5R_SIGN_EPSILON_MM;
        const secondNear = secondCoc < -GROUND_GLASS_M5R_SIGN_EPSILON_MM;
        const firstFar = firstCoc > GROUND_GLASS_M5R_SIGN_EPSILON_MM;
        const secondFar = secondCoc > GROUND_GLASS_M5R_SIGN_EPSILON_MM;
        if ((firstNear && secondFar) || (secondNear && firstFar)) {
          const nearPixel = firstNear ? pixel : neighbor;
          const farPixel = firstFar ? pixel : neighbor;
          addLeakageComparison(signedFull32, sourceRgba, nearPixel, farPixel, b1FarRgba,
            full32.readbackBuffers.farGatherRgba, tolerance);
          addLeakageComparison(signedFull64, sourceRgba, nearPixel, farPixel, b1FarRgba,
            full64.readbackBuffers.farGatherRgba, tolerance);
          signedPairCount += 1;
        }
      }
    }
  }
  return {
    directionToleranceRgbDifference: tolerance,
    sampleDefinition: "compare each pair's farther-side B1/reference pixel with the Half32 source color at its near-side neighbor; lower mean absolute RGB difference is closer",
    depthNearSideDefinition: "among adjacent valid pixels with depth below 1 and depth delta at or above the configured threshold, smaller depth is near",
    signedNearSideDefinition: "among adjacent validity-code-1 pixels with opposite CoC signs beyond epsilon, negative CoC is near",
    depthEdge: finalizeLeakageBoundary(depthPairCount, depthFull32, depthFull64),
    signedBoundary: finalizeLeakageBoundary(signedPairCount, signedFull32, signedFull64),
  };
};

const validDimensions = (width: number, height: number): boolean =>
  Number.isSafeInteger(width) && Number.isSafeInteger(height)
  && width > 0 && height > 0 && width * height <= MAX_PIXELS;

const equalArray = (left: ArrayLike<number>, right: ArrayLike<number>): boolean => {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const assertMatchedCaptures = (captures: GroundGlassApertureGatherR3CaptureMatrix): number => {
  const values = [captures.half32, captures.full32, captures.full64];
  const expectedModes: readonly GroundGlassR3QualityMode[] = ["half32", "full32", "full64"];
  if (new Set(values.map((capture) => capture.captureId)).size !== values.length) {
    throw new RangeError("M5R requires three distinct capture IDs");
  }
  for (let index = 0; index < values.length; index += 1) {
    const capture = values[index]!;
    if (capture.qualityMode !== expectedModes[index]) {
      throw new RangeError("M5R captures must be ordered as Half32, Full32, Full64");
    }
    if (!capture.captureId.trim() || !capture.requestId.trim() || !capture.sceneId.trim()
        || !capture.sceneSourceRevision.trim() || !capture.effectiveOpticalRequestFingerprint.trim()
        || !capture.cameraStateFingerprint.trim()) {
      throw new RangeError("M5R capture identity and provenance must be complete");
    }
    if (capture.readbackOrigin !== "top") throw new RangeError("M5R requires verified top-origin readbacks");
    if (!validDimensions(capture.sourceDimensions.widthPx, capture.sourceDimensions.heightPx)
        || !validDimensions(capture.gatherDimensions.widthPx, capture.gatherDimensions.heightPx)) {
      throw new RangeError("M5R dimensions must be positive and bounded");
    }
  }

  const first = captures.half32;
  const sourceWidth = first.sourceDimensions.widthPx;
  const sourceHeight = first.sourceDimensions.heightPx;
  const sourcePixels = sourceWidth * sourceHeight;
  for (const capture of [captures.full32, captures.full64]) {
    if (capture.sceneId !== first.sceneId
        || capture.sceneSourceRevision !== first.sceneSourceRevision
        || capture.effectiveOpticalRequestFingerprint !== first.effectiveOpticalRequestFingerprint
        || capture.cameraStateFingerprint !== first.cameraStateFingerprint
        || capture.colorDomain !== first.colorDomain
        || capture.sourceDimensions.widthPx !== sourceWidth
        || capture.sourceDimensions.heightPx !== sourceHeight
        || capture.sampledFilmDimensionsMm.widthMm !== first.sampledFilmDimensionsMm.widthMm
        || capture.sampledFilmDimensionsMm.heightMm !== first.sampledFilmDimensionsMm.heightMm
        || capture.maximumRadiusPx !== first.maximumRadiusPx) {
      throw new RangeError("M5R captures do not describe the same scene, camera, source, film, and radius cap");
    }
    for (const key of Object.keys(first.targetFormats) as (keyof typeof first.targetFormats)[]) {
      if (capture.targetFormats[key] !== first.targetFormats[key]) {
        throw new RangeError("M5R target formats differ across the matched captures");
      }
    }
    for (const key of ["sourceRgba", "depth", "physicalRgba", "validity"] as const) {
      if (!equalArray(first.readbackBuffers[key], capture.readbackBuffers[key])) {
        throw new RangeError(`M5R ${key} input differs across the matched captures`);
      }
    }
  }
  if (captures.full32.gatherDimensions.widthPx !== sourceWidth
      || captures.full32.gatherDimensions.heightPx !== sourceHeight
      || captures.full64.gatherDimensions.widthPx !== sourceWidth
      || captures.full64.gatherDimensions.heightPx !== sourceHeight) {
    throw new RangeError("M5R Full32 and Full64 reference rasters must match the source dimensions");
  }

  for (const capture of values) {
    const sourceBuffer = capture.readbackBuffers.sourceRgba;
    const physical = capture.readbackBuffers.physicalRgba;
    const depth = capture.readbackBuffers.depth;
    const validity = capture.readbackBuffers.validity;
    const gatherPixels = capture.gatherDimensions.widthPx * capture.gatherDimensions.heightPx;
    const expectedLengths: Readonly<Record<string, number>> = {
      sourceRgba: sourcePixels * 4,
      depth: sourcePixels,
      physicalRgba: sourcePixels * 4,
      validity: sourcePixels,
      farGatherRgba: gatherPixels * 4,
      b1FarRgba: sourcePixels * 4,
      nearBeforeB1Rgba: gatherPixels * 4,
      nearAfterB1Rgba: gatherPixels * 4,
      nearCpuReferenceRgba: gatherPixels * 4,
      observedSelectedGatherIds: sourcePixels * 2,
      observedGatherCenterSourceIds: gatherPixels * 2,
      b1DecisionRgba: sourcePixels * 4,
    };
    for (const [key, length] of Object.entries(expectedLengths)) {
      const readback = capture.readbackBuffers[key as keyof typeof capture.readbackBuffers];
      if (readback.length !== length) throw new RangeError(`M5R ${capture.qualityMode} ${key} readback has the wrong length`);
    }
    for (const valuesToCheck of [sourceBuffer, physical, depth, capture.readbackBuffers.farGatherRgba,
      capture.readbackBuffers.b1FarRgba]) {
      for (let offset = 0; offset < valuesToCheck.length; offset += 1) {
        if (!Number.isFinite(valuesToCheck[offset])) throw new RangeError("M5R color, physical, and depth readbacks must be finite");
      }
    }
    for (let pixel = 0; pixel < sourcePixels; pixel += 1) {
      if (depth[pixel]! < 0 || depth[pixel]! > 1) throw new RangeError("M5R depth readbacks must be in [0,1]");
      if (validity[pixel]! > 4) throw new RangeError("M5R validity readback contains an unknown code");
    }
    const decisions = capture.readbackBuffers.b1DecisionRgba;
    for (let pixel = 0; pixel < sourcePixels; pixel += 1) {
      const offset = pixel * 4;
      const eligible = decisions[offset]!;
      const reason = decisions[offset + 1]!;
      const path = decisions[offset + 2]!;
      const accepted = reason === GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted;
      if (reason > GROUND_GLASS_B1_FALLBACK_REASON.unusableGatherData
          || eligible > 1 || path > 1
          || eligible !== (accepted ? 1 : 0)
          || path !== (accepted ? GROUND_GLASS_B1_SELECTED_PATH.farGather : GROUND_GLASS_B1_SELECTED_PATH.sourceColorFallback)) {
        throw new RangeError(`M5R ${capture.qualityMode} GPU decision bytes are inconsistent at pixel ${pixel}`);
      }
    }
  }
  return sourcePixels;
};

const buildMasks = (
  capture: GroundGlassApertureGatherR3Capture,
  depthEdgeThreshold: number,
): Readonly<{ validFar: Uint8Array; depthEdge: Uint8Array; signedBoundary: Uint8Array }> => {
  const { widthPx: width, heightPx: height } = capture.sourceDimensions;
  const pixels = width * height;
  const validFar = new Uint8Array(pixels);
  const depthEdge = new Uint8Array(pixels);
  const signedBoundary = new Uint8Array(pixels);
  const { physicalRgba, validity, depth } = capture.readbackBuffers;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    validFar[pixel] = validity[pixel] === 1
      && physicalRgba[pixel * 4]! > GROUND_GLASS_M5R_SIGN_EPSILON_MM
      && depth[pixel]! < 1
      ? 1 : 0;
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= width || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (depth[pixel]! < 1 && depth[neighbor]! < 1
            && Math.abs(depth[pixel]! - depth[neighbor]!) >= depthEdgeThreshold) {
          depthEdge[pixel] = 1;
          depthEdge[neighbor] = 1;
        }
        if (validity[pixel] !== 1 || validity[neighbor] !== 1) continue;
        const firstCoc = physicalRgba[pixel * 4]!;
        const secondCoc = physicalRgba[neighbor * 4]!;
        const oppositeSigns = (firstCoc > GROUND_GLASS_M5R_SIGN_EPSILON_MM
          && secondCoc < -GROUND_GLASS_M5R_SIGN_EPSILON_MM)
          || (firstCoc < -GROUND_GLASS_M5R_SIGN_EPSILON_MM
            && secondCoc > GROUND_GLASS_M5R_SIGN_EPSILON_MM);
        if (oppositeSigns) {
          signedBoundary[pixel] = 1;
          signedBoundary[neighbor] = 1;
        }
      }
    }
  }
  return { validFar, depthEdge, signedBoundary };
};

const metricPartitions = (
  all: MutableErrorAccumulator,
  validFar: MutableErrorAccumulator,
  depthEdge: MutableErrorAccumulator,
  signedBoundary: MutableErrorAccumulator,
): GroundGlassM5rRgbErrorPartitions => finalizePartitions(all, validFar, depthEdge, signedBoundary);

const finalizeReasonMetrics = (
  reason: (typeof REASONS)[number],
  accumulator: ReasonAccumulator,
): GroundGlassM5rReasonMetrics => ({
  reasonCode: reason.code,
  reasonName: groundGlassB1FallbackReasonName(reason.code),
  pixelCount: accumulator.pixelCount,
  fallbackPixelCount: accumulator.fallbackPixelCount,
  validFarPixelCount: accumulator.validFarPixelCount,
  validFarFallbackPixelCount: accumulator.validFarFallbackPixelCount,
  meaningfulBlurPixelCount: accumulator.meaningfulBlurPixelCount,
  negligibleBlurPixelCount: accumulator.negligibleBlurPixelCount,
  meaningfulBlurFallbackPixelCount: accumulator.meaningfulBlurFallbackPixelCount,
  negligibleBlurFallbackPixelCount: accumulator.negligibleBlurFallbackPixelCount,
  referenceBlurMeanRgbDifference: accumulator.referenceBlurSampleCount
    ? accumulator.referenceBlurSum / accumulator.referenceBlurSampleCount : null,
  referenceBlurMaximumRgbDifference: accumulator.referenceBlurSampleCount
    ? accumulator.referenceBlurMaximum : null,
  candidateBlurMeanRgbDifference: accumulator.candidateBlurSampleCount
    ? accumulator.candidateBlurSum / accumulator.candidateBlurSampleCount : null,
  candidateBlurMaximumRgbDifference: accumulator.candidateBlurSampleCount
    ? accumulator.candidateBlurMaximum : null,
  depthEdgeOverlapPixelCount: accumulator.depthEdgeOverlapPixelCount,
  depthEdgeFallbackOverlapPixelCount: accumulator.depthEdgeFallbackOverlapPixelCount,
  signedBoundaryOverlapPixelCount: accumulator.signedBoundaryOverlapPixelCount,
  signedBoundaryFallbackOverlapPixelCount: accumulator.signedBoundaryFallbackOverlapPixelCount,
  sourceColorDelta: metricPartitions(accumulator.sourceColorDelta,
    accumulator.sourceColorDeltaValidFar, accumulator.sourceColorDeltaDepthEdge,
    accumulator.sourceColorDeltaSignedBoundary),
  full32Error: metricPartitions(accumulator.full32Error, accumulator.full32ErrorValidFar,
    accumulator.full32ErrorDepthEdge, accumulator.full32ErrorSignedBoundary),
  full64Error: metricPartitions(accumulator.full64Error, accumulator.full64ErrorValidFar,
    accumulator.full64ErrorDepthEdge, accumulator.full64ErrorSignedBoundary),
});

/**
 * Analyze the actual Half32 GPU reason bytes against matched Full32/Full64
 * readbacks. This returns measurements only; it does not qualify a state or
 * change the existing R3 decision/threshold contract.
 */
export const analyzeGroundGlassM5rFallbacks = (
  captures: GroundGlassApertureGatherR3CaptureMatrix,
  options: GroundGlassM5rFallbackAnalysisOptions = {},
): GroundGlassM5rFallbackAnalysis => {
  const meaningfulBlurFloor = options.minimumMeaningfulBlurRgbDifference
    ?? GROUND_GLASS_M5R_MEANINGFUL_BLUR_FLOOR;
  const depthEdgeThreshold = options.depthEdgeThreshold ?? GROUND_GLASS_M5R_DEPTH_EDGE_THRESHOLD;
  const boundaryDifferenceThreshold = options.boundaryDifferenceThreshold
    ?? GROUND_GLASS_M5R_BOUNDARY_DIFFERENCE_THRESHOLD;
  const maximumBoundaryDistancePx = options.maximumBoundaryDistancePx
    ?? GROUND_GLASS_M5R_BOUNDARY_DISTANCE_LIMIT_PX;
  const leakageDirectionTolerance = options.leakageDirectionTolerance
    ?? GROUND_GLASS_M5R_LEAKAGE_DIRECTION_TOLERANCE;
  if (!Number.isFinite(meaningfulBlurFloor) || meaningfulBlurFloor <= 0) {
    throw new RangeError("M5R meaningful-blur floor must be positive and finite");
  }
  if (!Number.isFinite(depthEdgeThreshold) || depthEdgeThreshold < 0) {
    throw new RangeError("M5R depth-edge threshold must be finite and non-negative");
  }
  if (!Number.isFinite(boundaryDifferenceThreshold) || boundaryDifferenceThreshold < 0) {
    throw new RangeError("M5R boundary-difference threshold must be finite and non-negative");
  }
  if (!Number.isSafeInteger(maximumBoundaryDistancePx) || maximumBoundaryDistancePx < 0
      || maximumBoundaryDistancePx > MAX_BOUNDARY_DISTANCE_LIMIT_PX) {
    throw new RangeError(`M5R boundary distance limit must be an integer in [0, ${MAX_BOUNDARY_DISTANCE_LIMIT_PX}]`);
  }
  if (!Number.isFinite(leakageDirectionTolerance) || leakageDirectionTolerance < 0) {
    throw new RangeError("M5R leakage-direction tolerance must be finite and non-negative");
  }
  const sourcePixels = assertMatchedCaptures(captures);
  const half = captures.half32;
  const full32 = captures.full32;
  const full64 = captures.full64;
  const masks = buildMasks(half, depthEdgeThreshold);
  const reasonAccumulators = Object.fromEntries(REASONS.map(({ key }) => [key, makeReasonAccumulator()])) as
    Record<GroundGlassM5rFallbackReasonKey, ReasonAccumulator>;
  const reasonCounts = Object.fromEntries(REASONS.map(({ key }) => [key, 0])) as
    Record<GroundGlassM5rFallbackReasonKey, number>;
  const fallbackMask = new Uint8Array(sourcePixels);
  const fallbackSourceDelta = makeErrorAccumulator();
  const fallbackFull32Error = makeErrorAccumulator();
  const fallbackFull64Error = makeErrorAccumulator();
  let fallbackPixelCount = 0;
  let fallbackValidFarPixelCount = 0;
  let meaningfulBlurPixelCount = 0;
  let negligibleBlurPixelCount = 0;
  let meaningfulBlurValidFarPixelCount = 0;
  let negligibleBlurValidFarPixelCount = 0;
  let referenceValidFarBlurSum = 0;
  let referenceValidFarBlurMaximum = 0;
  let candidateValidFarBlurSum = 0;
  let candidateValidFarBlurMaximum = 0;
  let referenceValidFarBlurSampleCount = 0;
  let meaningfulReferenceBlurValidFarPixelCount = 0;

  for (let pixel = 0; pixel < sourcePixels; pixel += 1) {
    const offset = pixel * 4;
    const decisionOffset = offset;
    const reasonCode = half.readbackBuffers.b1DecisionRgba[decisionOffset + 1] as GroundGlassB1FallbackReason;
    const reason = REASONS.find((entry) => entry.code === reasonCode);
    if (!reason) throw new RangeError(`M5R encountered unknown B1 reason code ${reasonCode}`);
    const accumulator = reasonAccumulators[reason.key];
    const isFallback = reasonCode !== GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted;
    const isValidFar = masks.validFar[pixel] === 1;
    const isDepthEdge = masks.depthEdge[pixel] === 1;
    const isSignedBoundary = masks.signedBoundary[pixel] === 1;
    const referenceBlur = (Math.abs(full32.readbackBuffers.farGatherRgba[offset]!
      - half.readbackBuffers.sourceRgba[offset]!)
      + Math.abs(full32.readbackBuffers.farGatherRgba[offset + 1]!
        - half.readbackBuffers.sourceRgba[offset + 1]!)
      + Math.abs(full32.readbackBuffers.farGatherRgba[offset + 2]!
        - half.readbackBuffers.sourceRgba[offset + 2]!)) / 3;
    const candidateBlur = (Math.abs(half.readbackBuffers.b1FarRgba[offset]!
      - half.readbackBuffers.sourceRgba[offset]!)
      + Math.abs(half.readbackBuffers.b1FarRgba[offset + 1]!
        - half.readbackBuffers.sourceRgba[offset + 1]!)
      + Math.abs(half.readbackBuffers.b1FarRgba[offset + 2]!
        - half.readbackBuffers.sourceRgba[offset + 2]!)) / 3;
    const meaningfulBlur = referenceBlur >= meaningfulBlurFloor;

    reasonCounts[reason.key] += 1;
    accumulator.pixelCount += 1;
    if (isFallback) {
      fallbackMask[pixel] = 1;
      fallbackPixelCount += 1;
      accumulator.fallbackPixelCount += 1;
      addError(fallbackSourceDelta, half.readbackBuffers.sourceRgba, half.readbackBuffers.b1FarRgba, offset);
      addError(fallbackFull32Error, full32.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, offset);
      addError(fallbackFull64Error, full64.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, offset);
    }
    if (isValidFar) {
      accumulator.validFarPixelCount += 1;
      if (isFallback) {
        fallbackValidFarPixelCount += 1;
        accumulator.validFarFallbackPixelCount += 1;
      }
    }
    if (meaningfulBlur) {
      accumulator.meaningfulBlurPixelCount += 1;
      if (isFallback) {
        meaningfulBlurPixelCount += 1;
        accumulator.meaningfulBlurFallbackPixelCount += 1;
      }
      if (isFallback && isValidFar) meaningfulBlurValidFarPixelCount += 1;
    } else {
      accumulator.negligibleBlurPixelCount += 1;
      if (isFallback) {
        negligibleBlurPixelCount += 1;
        accumulator.negligibleBlurFallbackPixelCount += 1;
      }
      if (isFallback && isValidFar) negligibleBlurValidFarPixelCount += 1;
    }
    if (isValidFar) {
      referenceValidFarBlurSampleCount += 1;
      referenceValidFarBlurSum += referenceBlur;
      referenceValidFarBlurMaximum = Math.max(referenceValidFarBlurMaximum, referenceBlur);
      candidateValidFarBlurSum += candidateBlur;
      candidateValidFarBlurMaximum = Math.max(candidateValidFarBlurMaximum, candidateBlur);
      if (meaningfulBlur) meaningfulReferenceBlurValidFarPixelCount += 1;
    }
    accumulator.referenceBlurSum += referenceBlur;
    accumulator.referenceBlurMaximum = Math.max(accumulator.referenceBlurMaximum, referenceBlur);
    accumulator.referenceBlurSampleCount += 1;
    accumulator.candidateBlurSum += candidateBlur;
    accumulator.candidateBlurMaximum = Math.max(accumulator.candidateBlurMaximum, candidateBlur);
    accumulator.candidateBlurSampleCount += 1;
    if (isDepthEdge) {
      accumulator.depthEdgeOverlapPixelCount += 1;
      if (isFallback) accumulator.depthEdgeFallbackOverlapPixelCount += 1;
    }
    if (isSignedBoundary) {
      accumulator.signedBoundaryOverlapPixelCount += 1;
      if (isFallback) accumulator.signedBoundaryFallbackOverlapPixelCount += 1;
    }

    addError(accumulator.sourceColorDelta, half.readbackBuffers.sourceRgba, half.readbackBuffers.b1FarRgba, offset);
    addError(accumulator.full32Error, full32.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, offset);
    addError(accumulator.full64Error, full64.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, offset);
    if (isValidFar) {
      addError(accumulator.sourceColorDeltaValidFar, half.readbackBuffers.sourceRgba, half.readbackBuffers.b1FarRgba, offset);
      addError(accumulator.full32ErrorValidFar, full32.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, offset);
      addError(accumulator.full64ErrorValidFar, full64.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, offset);
    }
    if (isDepthEdge) {
      addError(accumulator.sourceColorDeltaDepthEdge, half.readbackBuffers.sourceRgba, half.readbackBuffers.b1FarRgba, offset);
      addError(accumulator.full32ErrorDepthEdge, full32.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, offset);
      addError(accumulator.full64ErrorDepthEdge, full64.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, offset);
    }
    if (isSignedBoundary) {
      addError(accumulator.sourceColorDeltaSignedBoundary, half.readbackBuffers.sourceRgba, half.readbackBuffers.b1FarRgba, offset);
      addError(accumulator.full32ErrorSignedBoundary, full32.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, offset);
      addError(accumulator.full64ErrorSignedBoundary, full64.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, offset);
    }
  }

  const boundaryDistanceMap = buildFallbackBoundaryDistanceMap(
    fallbackMask,
    half.sourceDimensions.widthPx,
    half.sourceDimensions.heightPx,
    maximumBoundaryDistancePx,
  );
  const hasFallbackBoundarySupport = boundaryDistanceMap.boundaryPairCount > 0;
  const boundaryDifferenceSupport: GroundGlassM5rFallbackAnalysis["boundaryDifferenceSupport"] = {
    status: hasFallbackBoundarySupport ? "measured" : "insufficient-support",
    boundaryPairCount: boundaryDistanceMap.boundaryPairCount,
    boundaryPixelCount: boundaryDistanceMap.boundaryPixelCount,
    thresholdRgbDifference: boundaryDifferenceThreshold,
    maximumDistancePx: maximumBoundaryDistancePx,
    distanceDefinition: "4-neighbor Manhattan distance from the nearest pixel participating in an unlike GPU fallback-status pair; boundary pixels are distance 0",
    pixelDifferenceDefinition: "mean absolute RGB channel difference at each source pixel",
    full32: makeBoundaryDifferenceProfile(full32.readbackBuffers.farGatherRgba,
      half.readbackBuffers.b1FarRgba, boundaryDistanceMap.distancePx, maximumBoundaryDistancePx,
      boundaryDifferenceThreshold, hasFallbackBoundarySupport),
    full64: makeBoundaryDifferenceProfile(full64.readbackBuffers.farGatherRgba,
      half.readbackBuffers.b1FarRgba, boundaryDistanceMap.distancePx, maximumBoundaryDistancePx,
      boundaryDifferenceThreshold, hasFallbackBoundarySupport),
  };
  const foregroundLeakageDirection = analyzeForegroundLeakageDirection(
    half,
    full32,
    full64,
    depthEdgeThreshold,
    leakageDirectionTolerance,
  );

  const absoluteErrors: number[] = [];
  const relativeErrors: number[] = [];
  const referenceGradients: number[] = [];
  const candidateGradients: number[] = [];
  let denominatorFloorAppliedPairCount = 0;
  let historicalRelativeErrorSum = 0;
  const { widthPx: width, heightPx: height } = half.sourceDimensions;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= width || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (fallbackMask[pixel] === fallbackMask[neighbor]) continue;
        const leftOffset = pixel * 4;
        const rightOffset = neighbor * 4;
        let candidateGradient = 0;
        let referenceGradient = 0;
        for (let channel = 0; channel < 3; channel += 1) {
          candidateGradient += Math.abs(half.readbackBuffers.b1FarRgba[leftOffset + channel]!
            - half.readbackBuffers.b1FarRgba[rightOffset + channel]!);
          referenceGradient += Math.abs(full32.readbackBuffers.farGatherRgba[leftOffset + channel]!
            - full32.readbackBuffers.farGatherRgba[rightOffset + channel]!);
        }
        candidateGradient /= 3;
        referenceGradient /= 3;
        const absoluteError = Math.abs(candidateGradient - referenceGradient);
        // Keep this exact expression and aggregation order aligned with R3's historical halo metric.
        const denominator = Math.max(referenceGradient, meaningfulBlurFloor);
        const relativeError = absoluteError / denominator;
        if (referenceGradient < meaningfulBlurFloor) denominatorFloorAppliedPairCount += 1;
        absoluteErrors.push(absoluteError);
        relativeErrors.push(relativeError);
        referenceGradients.push(referenceGradient);
        candidateGradients.push(candidateGradient);
        historicalRelativeErrorSum += relativeError;
      }
    }
  }

  const byReason = Object.fromEntries(REASONS.map((reason) => [
    reason.key,
    finalizeReasonMetrics(reason, reasonAccumulators[reason.key]),
  ])) as Record<GroundGlassM5rFallbackReasonKey, GroundGlassM5rReasonMetrics>;
  const referenceFarBlurMean = referenceValidFarBlurSampleCount
    ? referenceValidFarBlurSum / referenceValidFarBlurSampleCount : null;
  const candidateFarBlurMean = referenceValidFarBlurSampleCount
    ? candidateValidFarBlurSum / referenceValidFarBlurSampleCount : null;
  const gradientPairCount = absoluteErrors.length;

  return {
    schemaVersion: 1,
    evidenceScope: "single-matched-native-webgpu-state",
    captureIds: {
      half32: half.captureId,
      full32: full32.captureId,
      full64: full64.captureId,
    },
    requestIds: {
      half32: half.requestId,
      full32: full32.requestId,
      full64: full64.requestId,
    },
    sceneId: half.sceneId,
    sceneSourceRevision: half.sceneSourceRevision,
    minimumMeaningfulBlurRgbDifference: meaningfulBlurFloor,
    depthEdgeThreshold,
    fallbackSummary: {
      pixelCount: fallbackPixelCount,
      validFarPixelCount: fallbackValidFarPixelCount,
      meaningfulBlurPixelCount,
      negligibleBlurPixelCount,
      meaningfulBlurFraction: fallbackPixelCount ? meaningfulBlurPixelCount / fallbackPixelCount : null,
      meaningfulBlurValidFarPixelCount,
      negligibleBlurValidFarPixelCount,
      sourceColorDelta: finalizeError(fallbackSourceDelta),
      full32Error: finalizeError(fallbackFull32Error),
      full64Error: finalizeError(fallbackFull64Error),
    },
    reasonCounts,
    byReason,
    blurPreservation: {
      validFarPixelCount: referenceValidFarBlurSampleCount,
      meaningfulReferenceBlurPixelCount: meaningfulReferenceBlurValidFarPixelCount,
      negligibleReferenceBlurPixelCount: referenceValidFarBlurSampleCount - meaningfulReferenceBlurValidFarPixelCount,
      referenceMeanRgbDifference: referenceFarBlurMean,
      referenceMaximumRgbDifference: referenceValidFarBlurSampleCount ? referenceValidFarBlurMaximum : null,
      candidateMeanRgbDifference: candidateFarBlurMean,
      candidateMaximumRgbDifference: referenceValidFarBlurSampleCount ? candidateValidFarBlurMaximum : null,
      candidateToReferenceMeanSignalRatio: referenceFarBlurMean !== null && referenceFarBlurMean > 0
        ? (candidateFarBlurMean ?? 0) / referenceFarBlurMean : null,
      relativeMeanSignalLoss: referenceFarBlurMean !== null && referenceFarBlurMean > 0
        ? 1 - (candidateFarBlurMean ?? 0) / referenceFarBlurMean : null,
    },
    fallbackBoundaryGradient: {
      status: gradientPairCount > 0 ? "measured" : "insufficient-support",
      pairCount: gradientPairCount,
      absoluteError: summarizeDistribution(absoluteErrors),
      relativeError: summarizeDistribution(relativeErrors),
      referenceGradient: summarizeDistribution(referenceGradients),
      candidateGradient: summarizeDistribution(candidateGradients),
      denominatorFloor: {
        value: meaningfulBlurFloor,
        appliedPairCount: denominatorFloorAppliedPairCount,
        appliedPairFraction: gradientPairCount
          ? denominatorFloorAppliedPairCount / gradientPairCount : null,
      },
      historicalRelativeMeanError: gradientPairCount
        ? historicalRelativeErrorSum / gradientPairCount : null,
    },
    boundaryDifferenceSupport,
    foregroundLeakageDirection,
  };
};
