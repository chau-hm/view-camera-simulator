/**
 * Independent CPU R3 evaluator for explicit, bounded native M5 readbacks.
 *
 * This module consumes captured numeric render-target data. It does not import
 * the renderer or the B1 algorithm oracle. RGB metrics operate on the stored
 * source-target readback values without applying a color-space transform.
 */

export type GroundGlassR3Dimensions = Readonly<{ widthPx: number; heightPx: number }>;
export type GroundGlassR3FilmDimensionsMm = Readonly<{ widthMm: number; heightMm: number }>;
export type GroundGlassR3QualityMode = "half32" | "full32" | "full64";
export type GroundGlassR3ColorDomain = "source-target-readback-values";

export type GroundGlassApertureGatherR3ReadbackBuffers = Readonly<{
  /** Top-origin numeric readbacks. */
  sourceRgba: Float32Array;
  depth: Float32Array;
  physicalRgba: Float32Array;
  validity: Uint8Array;
  farGatherRgba: Float32Array;
  b1FarRgba: Float32Array;
  nearBeforeB1Rgba: Float32Array;
  nearAfterB1Rgba: Float32Array;
  nearCpuReferenceRgba: Float32Array;
  /** GPU-observed full-source-pixel to gather-texel mapping, [x,y] per source pixel. */
  observedSelectedGatherIds: Int32Array;
  /** GPU-observed gather-texel to source-center mapping, [x,y] per gather pixel. */
  observedGatherCenterSourceIds: Int32Array;
  /** RGBA8 decision readback: eligibility, fallback reason, selected path, alpha. */
  b1DecisionRgba: Uint8Array;
}>;

export type GroundGlassApertureGatherR3Capture = Readonly<{
  /** Unique explicit capture token. Request IDs may be shared across quality captures. */
  captureId: string;
  requestId: string;
  sceneId: string;
  sceneSourceRevision: string;
  effectiveOpticalRequestFingerprint: string;
  cameraStateFingerprint: string;
  readbackOrigin: "top" | "bottom" | "unresolved";
  qualityMode: GroundGlassR3QualityMode;
  sourceDimensions: GroundGlassR3Dimensions;
  gatherDimensions: GroundGlassR3Dimensions;
  sampledFilmDimensionsMm: GroundGlassR3FilmDimensionsMm;
  sampleCount: 32 | 64;
  maximumRadiusPx: number;
  colorDomain: GroundGlassR3ColorDomain;
  targetFormats: Readonly<{
    sourceColor: string;
    physical: string;
    validity: string;
    far: string;
    near: string;
    b1: string;
  }>;
  /** Independent CPU radius summary emitted by the explicit capture, checked against physical data. */
  reportedRadiusEvidence: Readonly<{
    maximumUncappedRadiusPx: number;
    cappedPixelCount: number;
  }>;
  readbackBuffers: GroundGlassApertureGatherR3ReadbackBuffers;
}>;

export type GroundGlassApertureGatherR3CaptureMatrix = Readonly<{
  half32: GroundGlassApertureGatherR3Capture;
  full32: GroundGlassApertureGatherR3Capture;
  full64: GroundGlassApertureGatherR3Capture;
}>;

export type GroundGlassApertureGatherR3CaptureProvenance = Readonly<{
  captureId: string;
  requestId: string;
  sceneId: string;
  sceneSourceRevision: string;
  effectiveOpticalRequestFingerprint: string;
  cameraStateFingerprint: string;
  qualityMode: GroundGlassR3QualityMode;
  readbackOrigin: "top" | "bottom" | "unresolved";
  sourceDimensions: GroundGlassR3Dimensions;
  gatherDimensions: GroundGlassR3Dimensions;
  sampledFilmDimensionsMm: GroundGlassR3FilmDimensionsMm;
  sampleCount: number;
  maximumRadiusPx: number;
  colorDomain: GroundGlassR3ColorDomain;
  targetFormats: GroundGlassApertureGatherR3Capture["targetFormats"];
}>;

/** Thresholds are caller-supplied and must be frozen before a confirmatory capture. */
export type GroundGlassApertureGatherR3Thresholds = Readonly<{
  revision: string;
  evidenceScope: "single-native-state";
  frozenBeforeConfirmatory: boolean;
  minimumInteriorFarPixels: number;
  minimumDepthEdgePixels: number;
  minimumNearFarBoundaryPairs: number;
  minimumNearCoveragePixels: number;
  minimumFractionalCoveragePixels: number;
  minimumNearFarBoundaryCoveragePixels: number;
  minimumSpreadOutsideSharpNearPixels: number;
  minimumFallbackBoundaryPairs: number;
  minimumStrongOverrunPx: number;
  maximumReferenceRmse: number;
  maximumReferenceChannelError: number;
  maximumReferenceInteriorFarRmse: number;
  maximumReferenceDepthEdgeRmse: number;
  maximumB1FullFrameRmse: number;
  maximumB1InteriorFarRmse: number;
  maximumB1DepthEdgeRmse: number;
  maximumB1SignedBoundaryRmse: number;
  maximumBlurGradientRelativeError: number;
  maximumMeaningfulBlurFallbackFraction: number;
  maximumFallbackBoundaryGradientRelativeError: number;
  maximumFallbackSourceError: number;
  maximumNearCpuRgbRmse: number;
  maximumNearCpuAlphaRmse: number;
  maximumNearB1RgbMaximumError: number;
  maximumNearB1AlphaMaximumError: number;
  /** Positive RGB-distance floor for meaningful reference blur and fallback evidence. */
  minimumMeaningfulBlurRgbDifference: number;
  /** Normalized depth difference used to construct the geometry-aware edge mask. */
  depthEdgeThreshold: number;
}>;

export type GroundGlassR3DecisionStatus =
  | "not-evaluated"
  | "invalid-comparison"
  | "insufficient-roi-support"
  | "reference-not-converged"
  | "candidate-quality-failed"
  | "bounded-qualified";

export type GroundGlassR3RgbMetrics = Readonly<{
  status: "measured" | "insufficient-support" | "unavailable";
  pixelCount: number;
  channelCount: number;
  mae: number | null;
  rmse: number | null;
  maximumChannelError: number | null;
}>;

export type GroundGlassApertureGatherR3Evaluation = Readonly<{
  schemaVersion: 1;
  evidenceScope: "single-native-webgpu-state";
  captureProvenance: Readonly<{
    half32: GroundGlassApertureGatherR3CaptureProvenance;
    full32: GroundGlassApertureGatherR3CaptureProvenance;
    full64: GroundGlassApertureGatherR3CaptureProvenance;
  }>;
  captureIds: Readonly<{ half32: string; full32: string; full64: string }>;
  requestIds: Readonly<{ half32: string; full32: string; full64: string }>;
  provenance: Readonly<{
    status: "matched" | "invalid";
    reasons: readonly string[];
    fingerprints: Readonly<{
      half32: Readonly<{ sourceColor: string | null; depth: string | null; physical: string | null; validity: string | null }>;
      full32: Readonly<{ sourceColor: string | null; depth: string | null; physical: string | null; validity: string | null }>;
      full64: Readonly<{ sourceColor: string | null; depth: string | null; physical: string | null; validity: string | null }>;
    }>;
  }>;
  referenceConvergence: Readonly<{
    status: "not-evaluated" | "converged" | "not-converged" | "insufficient-support";
    fullFrame: GroundGlassR3RgbMetrics;
    interiorFar: GroundGlassR3RgbMetrics;
    depthEdge: GroundGlassR3RgbMetrics;
  }>;
  fullFrameMetrics: Readonly<{
    half32B1VsFull32: GroundGlassR3RgbMetrics;
    half32B1VsFull64: GroundGlassR3RgbMetrics;
    half32B0VsFull32: GroundGlassR3RgbMetrics;
    half32B0VsFull64: GroundGlassR3RgbMetrics;
  }>;
  interiorFarMetrics: Readonly<{
    status: "measured" | "insufficient-support";
    pixelCount: number;
    expectedBlurMeanRgbDifference: number | null;
    expectedBlurMaximumRgbDifference: number | null;
    half32B1VsFull32: GroundGlassR3RgbMetrics;
    half32B0VsFull32: GroundGlassR3RgbMetrics;
  }>;
  depthEdgeMetrics: Readonly<{
    status: "measured" | "insufficient-support";
    pixelCount: number;
    depthEdgePairCount: number;
    averageDepthDelta: number | null;
    nearSidePixelCount: number;
    farSidePixelCount: number;
    averageFull32RgbEdgeContrast: number | null;
    half32B1VsFull32: GroundGlassR3RgbMetrics;
    half32B0VsFull32: GroundGlassR3RgbMetrics;
    full32VsFull64: GroundGlassR3RgbMetrics;
  }>;
  fallbackMetrics: Readonly<{
    pixelCount: number;
    sourceColorMismatchPixelCount: number;
    meaningfulBlurPixelCount: number;
    meaningfulBlurFraction: number | null;
    b1VsFull32: GroundGlassR3RgbMetrics;
    boundaryGradient: Readonly<{
      status: "measured" | "insufficient-support";
      pairCount: number;
      meanRelativeError: number | null;
      maximumRelativeError: number | null;
    }>;
  }>;
  blurSpreadMetrics: Readonly<{
    status: "measured" | "insufficient-support";
    roiPixelCount: number;
    full32ReferenceGradientEnergy: number | null;
    b1CandidateGradientEnergy: number | null;
    candidateToReferenceGradientRatio: number | null;
    relativeGradientError: number | null;
  }>;
  foregroundLeakageMetrics: Readonly<{
    status: "measured" | "insufficient-support";
    depthEdgePixelCount: number;
    signedBoundaryPairCount: number;
    signedBoundaryPixelCount: number;
    full32VsFull64AtSignedBoundary: GroundGlassR3RgbMetrics;
    half32B1VsFull32AtDepthEdges: GroundGlassR3RgbMetrics;
    half32B0VsFull32AtDepthEdges: GroundGlassR3RgbMetrics;
    half32B1VsFull32AtSignedBoundary: GroundGlassR3RgbMetrics;
  }>;
  nearInvariance: Readonly<{
    status: "measured" | "insufficient-support";
    gpuVsCpuRgb: GroundGlassR3RgbMetrics;
    gpuVsCpuAlpha: GroundGlassR3RgbMetrics;
    beforeVsAfterB1Rgb: GroundGlassR3RgbMetrics;
    beforeVsAfterB1Alpha: GroundGlassR3RgbMetrics;
    nonzeroCoveragePixelCount: number;
    fractionalCoveragePixelCount: number;
    spreadOutsideSharpNearPixelCount: number;
    nearFarBoundaryCoveragePixelCount: number;
  }>;
  radiusCapEvidence: Readonly<{
    status: "matched" | "insufficient-support" | "inconsistent";
    maximumUncappedRadiusPx: number | null;
    maximumOverrunPx: number | null;
    cappedPixelCount: number;
    reportedMaximumUncappedRadiusPx: number;
    reportedCappedPixelCount: number;
    reportedEvidenceMatches: boolean;
  }>;
  signedBoundaryEvidence: Readonly<{
    status: "present" | "absent" | "invalid";
    adjacentNearFarPairCount: number;
    participatingPixelCount: number;
    nearSidePixelCount: number;
    farSidePixelCount: number;
    populationConsistent: boolean;
  }>;
  qualityDecision: Readonly<{
    status: GroundGlassR3DecisionStatus;
    reasons: readonly string[];
    thresholdRevision: string | null;
    thresholdsFrozenBeforeConfirmatory: boolean;
  }>;
}>;

const MAX_PIXELS = 1_000_000;
const SIGN_EPSILON_MM = 0.00001;
const REPORT_RADIUS_TOLERANCE_PX = 0.01;
const MEANINGFUL_BLUR_DEFAULT = 0.01;
const EDGE_THRESHOLD_DEFAULT = 0.0001;

const unavailableMetrics = (): GroundGlassR3RgbMetrics => ({
  status: "unavailable", pixelCount: 0, channelCount: 0, mae: null, rmse: null, maximumChannelError: null,
});

const emptyMetrics = (): GroundGlassR3RgbMetrics => ({
  status: "insufficient-support", pixelCount: 0, channelCount: 0, mae: null, rmse: null,
  maximumChannelError: null,
});

const validDimensions = (value: GroundGlassR3Dimensions): boolean =>
  Number.isSafeInteger(value.widthPx) && Number.isSafeInteger(value.heightPx)
  && value.widthPx > 0 && value.heightPx > 0
  && value.widthPx * value.heightPx <= MAX_PIXELS;

const finiteArray = (values: ArrayLike<number>): boolean => {
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) return false;
  }
  return true;
};

const equalArray = (left: ArrayLike<number>, right: ArrayLike<number>): boolean => {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

/** FNV-1a over the captured typed-array bytes; diagnostic fingerprint, not a security hash. */
const fingerprint = (values: Float32Array | Uint8Array): string => {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let hash = 0x811c9dc5;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return "fnv1a32:" + hash.toString(16).padStart(8, "0") + ":" + values.length;
};

const validateCapture = (capture: GroundGlassApertureGatherR3Capture, label: string): string[] => {
  const errors: string[] = [];
  const { readbackBuffers: b } = capture;
  const sourcePixels = validDimensions(capture.sourceDimensions)
    ? capture.sourceDimensions.widthPx * capture.sourceDimensions.heightPx : 0;
  const gatherPixels = validDimensions(capture.gatherDimensions)
    ? capture.gatherDimensions.widthPx * capture.gatherDimensions.heightPx : 0;
  if (!capture.captureId.trim() || !capture.requestId.trim() || !capture.sceneId.trim()
      || !capture.sceneSourceRevision.trim() || !capture.effectiveOpticalRequestFingerprint.trim()
      || !capture.cameraStateFingerprint.trim()) errors.push(label + ": incomplete capture identity/provenance");
  if (!validDimensions(capture.sourceDimensions) || !validDimensions(capture.gatherDimensions)) {
    errors.push(label + ": invalid or unbounded dimensions");
  }
  if (capture.readbackOrigin !== "top") errors.push(label + ": readback origin is not verified top-origin");
  if (!Number.isFinite(capture.sampledFilmDimensionsMm.widthMm)
      || capture.sampledFilmDimensionsMm.widthMm <= 0
      || !Number.isFinite(capture.sampledFilmDimensionsMm.heightMm)
      || capture.sampledFilmDimensionsMm.heightMm <= 0
      || !Number.isFinite(capture.maximumRadiusPx) || capture.maximumRadiusPx <= 0) {
    errors.push(label + ": invalid film dimensions or radius cap");
  }
  if (capture.colorDomain !== "source-target-readback-values") errors.push(label + ": unsupported color domain");
  for (const [name, value] of Object.entries(capture.targetFormats)) {
    if (!value.trim()) errors.push(label + ": missing target format " + name);
  }
  const requiredFormats = {
    sourceColor: "rgba8unorm",
    physical: "rgba16float",
    validity: "rgba8unorm",
    far: "rgba16float",
    near: "rgba16float",
    b1: "rgba16float",
  } as const;
  for (const [name, expected] of Object.entries(requiredFormats)) {
    if (capture.targetFormats[name as keyof typeof requiredFormats] !== expected) {
      errors.push(label + ": unsupported target format " + name);
    }
  }
  const expectedSampleCount = capture.qualityMode === "full64" ? 64 : 32;
  if (capture.sampleCount !== expectedSampleCount) errors.push(label + ": quality/sample-count mismatch");
  if (validDimensions(capture.sourceDimensions) && validDimensions(capture.gatherDimensions)) {
    const scale = capture.qualityMode === "half32" ? 0.5 : 1;
    const expectedWidth = Math.max(1, Math.round(capture.sourceDimensions.widthPx * scale));
    const expectedHeight = Math.max(1, Math.round(capture.sourceDimensions.heightPx * scale));
    if (capture.gatherDimensions.widthPx !== expectedWidth || capture.gatherDimensions.heightPx !== expectedHeight) {
      errors.push(label + ": gather dimensions do not match the declared quality mode");
    }
  }
  const expectedLengths: Readonly<Record<keyof GroundGlassApertureGatherR3ReadbackBuffers, number>> = {
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
  for (const [name, length] of Object.entries(expectedLengths)) {
    if (b[name as keyof typeof expectedLengths].length !== length) {
      errors.push(label + ": malformed " + name + " readback length");
    }
  }
  for (const name of ["sourceRgba", "depth", "physicalRgba", "farGatherRgba", "b1FarRgba",
    "nearBeforeB1Rgba", "nearAfterB1Rgba", "nearCpuReferenceRgba"] as const) {
    if (!finiteArray(b[name])) errors.push(label + ": non-finite " + name + " readback");
  }
  for (let index = 0; index < b.validity.length; index += 1) {
    if (b.validity[index]! > 4) errors.push(label + ": unknown M4 validity code");
  }
  for (let index = 0; index < b.depth.length; index += 1) {
    if (b.depth[index]! < 0 || b.depth[index]! > 1) errors.push(label + ": depth readback outside [0,1]");
  }
  if (validDimensions(capture.sourceDimensions) && validDimensions(capture.gatherDimensions)
      && b.observedSelectedGatherIds.length === sourcePixels * 2) {
    for (let pixel = 0; pixel < sourcePixels; pixel += 1) {
      const x = b.observedSelectedGatherIds[pixel * 2]!;
      const y = b.observedSelectedGatherIds[pixel * 2 + 1]!;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0
          || x >= capture.gatherDimensions.widthPx || y >= capture.gatherDimensions.heightPx) {
        errors.push(label + ": selected gather identity is missing or out of bounds");
        break;
      }
    }
  }
  if (validDimensions(capture.sourceDimensions) && validDimensions(capture.gatherDimensions)
      && b.observedGatherCenterSourceIds.length === gatherPixels * 2) {
    for (let pixel = 0; pixel < gatherPixels; pixel += 1) {
      const x = b.observedGatherCenterSourceIds[pixel * 2]!;
      const y = b.observedGatherCenterSourceIds[pixel * 2 + 1]!;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0
          || x >= capture.sourceDimensions.widthPx || y >= capture.sourceDimensions.heightPx) {
        errors.push(label + ": gather-center source identity is missing or out of bounds");
        break;
      }
    }
  }
  if (b.b1DecisionRgba.length === sourcePixels * 4) {
    for (let pixel = 0; pixel < sourcePixels; pixel += 1) {
      const offset = pixel * 4;
      const eligible = b.b1DecisionRgba[offset]!;
      const reason = b.b1DecisionRgba[offset + 1]!;
      const selectedPath = b.b1DecisionRgba[offset + 2]!;
      const knownReason = reason <= 5;
      const acceptedConsistent = selectedPath === 1 && eligible === 1 && reason === 0;
      const fallbackConsistent = selectedPath === 0 && eligible === 0 && reason >= 1 && reason <= 5;
      if (eligible > 1 || selectedPath > 1 || !knownReason
          || (!acceptedConsistent && !fallbackConsistent)) {
        errors.push(label + ": B1 eligibility and selected-path evidence disagree");
        break;
      }
    }
  }
  if (!Number.isFinite(capture.reportedRadiusEvidence.maximumUncappedRadiusPx)
      || capture.reportedRadiusEvidence.maximumUncappedRadiusPx < 0
      || !Number.isSafeInteger(capture.reportedRadiusEvidence.cappedPixelCount)
      || capture.reportedRadiusEvidence.cappedPixelCount < 0) {
    errors.push(label + ": invalid reported cap evidence");
  }
  return errors;
};

const makeRgbMetrics = (
  reference: Float32Array,
  candidate: Float32Array,
  pixelCount: number,
  mask?: Uint8Array,
): GroundGlassR3RgbMetrics => {
  if (reference.length !== candidate.length || reference.length % 4 !== 0) return unavailableMetrics();
  let selectedPixels = 0;
  let absoluteSum = 0;
  let squareSum = 0;
  let maximum = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (mask && mask[pixel] !== 1) continue;
    selectedPixels += 1;
    const offset = pixel * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      const error = Math.abs(reference[offset + channel]! - candidate[offset + channel]!);
      absoluteSum += error;
      squareSum += error * error;
      maximum = Math.max(maximum, error);
    }
  }
  if (selectedPixels === 0) return emptyMetrics();
  const channelCount = selectedPixels * 3;
  return {
    status: "measured", pixelCount: selectedPixels, channelCount,
    mae: absoluteSum / channelCount,
    rmse: Math.sqrt(squareSum / channelCount),
    maximumChannelError: maximum,
  };
};

const makeChannelMetrics = (
  reference: Float32Array,
  candidate: Float32Array,
  pixelCount: number,
  channel: 0 | 1 | 2 | 3,
): GroundGlassR3RgbMetrics => {
  if (reference.length !== candidate.length || reference.length !== pixelCount * 4) return unavailableMetrics();
  let sum = 0;
  let squares = 0;
  let maximum = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const error = Math.abs(reference[pixel * 4 + channel]! - candidate[pixel * 4 + channel]!);
    sum += error;
    squares += error * error;
    maximum = Math.max(maximum, error);
  }
  return {
    status: pixelCount > 0 ? "measured" : "insufficient-support",
    pixelCount, channelCount: pixelCount,
    mae: pixelCount ? sum / pixelCount : null,
    rmse: pixelCount ? Math.sqrt(squares / pixelCount) : null,
    maximumChannelError: pixelCount ? maximum : null,
  };
};

const deriveB0 = (capture: GroundGlassApertureGatherR3Capture): Float32Array => {
  const sourcePixels = capture.sourceDimensions.widthPx * capture.sourceDimensions.heightPx;
  const gatherWidth = capture.gatherDimensions.widthPx;
  const output = new Float32Array(sourcePixels * 4);
  for (let pixel = 0; pixel < sourcePixels; pixel += 1) {
    const x = capture.readbackBuffers.observedSelectedGatherIds[pixel * 2]!;
    const y = capture.readbackBuffers.observedSelectedGatherIds[pixel * 2 + 1]!;
    const gatherOffset = (y * gatherWidth + x) * 4;
    output.set(capture.readbackBuffers.farGatherRgba.subarray(gatherOffset, gatherOffset + 4), pixel * 4);
  }
  return output;
};

const mapPhysicalRadiusPx = (
  physicalRgba: Float32Array,
  pixel: number,
  film: GroundGlassR3FilmDimensionsMm,
  source: GroundGlassR3Dimensions,
): number => {
  const offset = pixel * 4;
  const majorRadiusMm = physicalRgba[offset + 1]!;
  const minorRadiusMm = physicalRgba[offset + 2]!;
  const orientationRad = physicalRgba[offset + 3]! * Math.PI;
  const cosine = Math.cos(orientationRad);
  const sine = Math.sin(orientationRad);
  const majorX = cosine * majorRadiusMm * source.widthPx / film.widthMm;
  const majorY = -sine * majorRadiusMm * source.heightPx / film.heightMm;
  const minorX = -sine * minorRadiusMm * source.widthPx / film.widthMm;
  const minorY = -cosine * minorRadiusMm * source.heightPx / film.heightMm;
  const gramMajor = majorX * majorX + majorY * majorY;
  const gramMinor = minorX * minorX + minorY * minorY;
  const gramCross = majorX * minorX + majorY * minorY;
  const traceHalf = (gramMajor + gramMinor) / 2;
  const discriminant = Math.hypot((gramMajor - gramMinor) / 2, gramCross);
  return Math.sqrt(Math.max(0, traceHalf + discriminant));
};

type Masks = Readonly<{
  interiorFar: Uint8Array;
  depthEdge: Uint8Array;
  signedBoundary: Uint8Array;
  depthEdgePairCount: number;
  signedBoundaryPairCount: number;
  signedBoundaryNearSidePixelCount: number;
  signedBoundaryFarSidePixelCount: number;
  signedBoundaryPopulationConsistent: boolean;
  averageDepthDelta: number | null;
}>;

const buildMasks = (
  capture: GroundGlassApertureGatherR3Capture,
  depthEdgeThreshold: number,
): Masks => {
  const { widthPx: width, heightPx: height } = capture.sourceDimensions;
  const pixels = width * height;
  const depthEdge = new Uint8Array(pixels);
  const signedBoundary = new Uint8Array(pixels);
  let depthEdgePairCount = 0;
  let depthDeltaSum = 0;
  let signedBoundaryPairCount = 0;
  const { physicalRgba, validity, depth } = capture.readbackBuffers;
  const neighbors = [[1, 0], [0, 1]] as const;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= width || ny >= height) continue;
        const other = ny * width + nx;
        if (depth[pixel]! < 1 && depth[other]! < 1) {
          const delta = Math.abs(depth[pixel]! - depth[other]!);
          if (delta >= depthEdgeThreshold) {
            depthEdge[pixel] = 1;
            depthEdge[other] = 1;
            depthEdgePairCount += 1;
            depthDeltaSum += delta;
          }
        }
        if (validity[pixel] === 1 && validity[other] === 1) {
          const firstCoc = physicalRgba[pixel * 4]!;
          const secondCoc = physicalRgba[other * 4]!;
          const nearFar = (firstCoc > SIGN_EPSILON_MM && secondCoc < -SIGN_EPSILON_MM)
            || (firstCoc < -SIGN_EPSILON_MM && secondCoc > SIGN_EPSILON_MM);
          if (nearFar) {
            signedBoundary[pixel] = 1;
            signedBoundary[other] = 1;
            signedBoundaryPairCount += 1;
          }
        }
      }
    }
  }
  const interiorFar = new Uint8Array(pixels);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x;
      if (validity[pixel] !== 1 || physicalRgba[pixel * 4]! <= SIGN_EPSILON_MM || depth[pixel]! >= 1) continue;
      let nearEdge = false;
      for (let dy = -1; dy <= 1 && !nearEdge; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (depthEdge[(y + dy) * width + x + dx] === 1) { nearEdge = true; break; }
        }
      }
      if (!nearEdge) interiorFar[pixel] = 1;
    }
  }
  let signedBoundaryNearSidePixelCount = 0;
  let signedBoundaryFarSidePixelCount = 0;
  let signedBoundaryPopulationConsistent = true;
  let signedBoundaryPixelCount = 0;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    if (signedBoundary[pixel] !== 1) continue;
    signedBoundaryPixelCount += 1;
    if (validity[pixel] !== 1) {
      signedBoundaryPopulationConsistent = false;
      continue;
    }
    const coc = physicalRgba[pixel * 4]!;
    if (coc < -SIGN_EPSILON_MM) signedBoundaryNearSidePixelCount += 1;
    else if (coc > SIGN_EPSILON_MM) signedBoundaryFarSidePixelCount += 1;
    else signedBoundaryPopulationConsistent = false;
  }
  signedBoundaryPopulationConsistent = signedBoundaryPopulationConsistent
    && Number.isSafeInteger(signedBoundaryNearSidePixelCount)
    && signedBoundaryNearSidePixelCount >= 0
    && Number.isSafeInteger(signedBoundaryFarSidePixelCount)
    && signedBoundaryFarSidePixelCount >= 0
    && signedBoundaryNearSidePixelCount + signedBoundaryFarSidePixelCount === signedBoundaryPixelCount;
  return {
    interiorFar,
    depthEdge,
    signedBoundary,
    depthEdgePairCount,
    signedBoundaryPairCount,
    signedBoundaryNearSidePixelCount,
    signedBoundaryFarSidePixelCount,
    signedBoundaryPopulationConsistent,
    averageDepthDelta: depthEdgePairCount ? depthDeltaSum / depthEdgePairCount : null,
  };
};

const gradientEnergy = (rgba: Float32Array, dimensions: GroundGlassR3Dimensions, mask: Uint8Array): number | null => {
  const { widthPx: width, heightPx: height } = dimensions;
  let sum = 0;
  let edges = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (mask[pixel] !== 1) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= width || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (mask[neighbor] !== 1) continue;
        const offset = pixel * 4;
        const neighborOffset = neighbor * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          sum += Math.abs(rgba[offset + channel]! - rgba[neighborOffset + channel]!);
        }
        edges += 1;
      }
    }
  }
  return edges ? sum / (edges * 3) : null;
};

const hashCapture = (capture: GroundGlassApertureGatherR3Capture) => ({
  sourceColor: fingerprint(capture.readbackBuffers.sourceRgba),
  depth: fingerprint(capture.readbackBuffers.depth),
  physical: fingerprint(capture.readbackBuffers.physicalRgba),
  validity: fingerprint(capture.readbackBuffers.validity),
});

const captureProvenance = (capture: GroundGlassApertureGatherR3Capture): GroundGlassApertureGatherR3CaptureProvenance => ({
  captureId: capture.captureId,
  requestId: capture.requestId,
  sceneId: capture.sceneId,
  sceneSourceRevision: capture.sceneSourceRevision,
  effectiveOpticalRequestFingerprint: capture.effectiveOpticalRequestFingerprint,
  cameraStateFingerprint: capture.cameraStateFingerprint,
  qualityMode: capture.qualityMode,
  readbackOrigin: capture.readbackOrigin,
  sourceDimensions: capture.sourceDimensions,
  gatherDimensions: capture.gatherDimensions,
  sampledFilmDimensionsMm: capture.sampledFilmDimensionsMm,
  sampleCount: capture.sampleCount,
  maximumRadiusPx: capture.maximumRadiusPx,
  colorDomain: capture.colorDomain,
  targetFormats: capture.targetFormats,
});

const meanRgbDistance = (
  left: Float32Array,
  right: Float32Array,
  pixelCount: number,
  mask: Uint8Array,
): Readonly<{ mean: number | null; maximum: number | null }> => {
  let sum = 0;
  let maximum = 0;
  let count = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (mask[pixel] !== 1) continue;
    let distance = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      distance += Math.abs(left[pixel * 4 + channel]! - right[pixel * 4 + channel]!);
    }
    distance /= 3;
    sum += distance;
    maximum = Math.max(maximum, distance);
    count += 1;
  }
  return { mean: count ? sum / count : null, maximum: count ? maximum : null };
};

const averageRgbEdgeContrast = (
  rgba: Float32Array,
  capture: GroundGlassApertureGatherR3Capture,
  depthEdgeThreshold: number,
): number | null => {
  const { widthPx: width, heightPx: height } = capture.sourceDimensions;
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= width || ny >= height) continue;
        const neighbor = ny * width + nx;
        const depthDelta = Math.abs(capture.readbackBuffers.depth[pixel]! - capture.readbackBuffers.depth[neighbor]!);
        if (capture.readbackBuffers.validity[pixel] !== 1 || capture.readbackBuffers.validity[neighbor] !== 1
            || capture.readbackBuffers.depth[pixel]! >= 1 || capture.readbackBuffers.depth[neighbor]! >= 1
            || depthDelta < depthEdgeThreshold) continue;
        let contrast = 0;
        for (let channel = 0; channel < 3; channel += 1) {
          contrast += Math.abs(rgba[pixel * 4 + channel]! - rgba[neighbor * 4 + channel]!);
        }
        sum += contrast / 3;
        count += 1;
      }
    }
  }
  return count ? sum / count : null;
};

const metricsForMask = (
  reference: Float32Array,
  candidate: Float32Array,
  pixels: number,
  mask: Uint8Array,
): GroundGlassR3RgbMetrics => makeRgbMetrics(reference, candidate, pixels, mask);

const invalidResult = (
  captures: GroundGlassApertureGatherR3CaptureMatrix,
  reasons: readonly string[],
  hashes: GroundGlassApertureGatherR3Evaluation["provenance"]["fingerprints"],
): GroundGlassApertureGatherR3Evaluation => ({
  schemaVersion: 1,
  evidenceScope: "single-native-webgpu-state",
  captureProvenance: {
    half32: captureProvenance(captures.half32),
    full32: captureProvenance(captures.full32),
    full64: captureProvenance(captures.full64),
  },
  captureIds: { half32: captures.half32.captureId, full32: captures.full32.captureId, full64: captures.full64.captureId },
  requestIds: { half32: captures.half32.requestId, full32: captures.full32.requestId, full64: captures.full64.requestId },
  provenance: { status: "invalid", reasons, fingerprints: hashes },
  referenceConvergence: { status: "not-evaluated", fullFrame: unavailableMetrics(), interiorFar: unavailableMetrics(), depthEdge: unavailableMetrics() },
  fullFrameMetrics: {
    half32B1VsFull32: unavailableMetrics(), half32B1VsFull64: unavailableMetrics(),
    half32B0VsFull32: unavailableMetrics(), half32B0VsFull64: unavailableMetrics(),
  },
  interiorFarMetrics: { status: "insufficient-support", pixelCount: 0,
    expectedBlurMeanRgbDifference: null, expectedBlurMaximumRgbDifference: null,
    half32B1VsFull32: unavailableMetrics(), half32B0VsFull32: unavailableMetrics() },
  depthEdgeMetrics: { status: "insufficient-support", pixelCount: 0, depthEdgePairCount: 0, averageDepthDelta: null,
    nearSidePixelCount: 0, farSidePixelCount: 0, averageFull32RgbEdgeContrast: null,
    half32B1VsFull32: unavailableMetrics(), half32B0VsFull32: unavailableMetrics(), full32VsFull64: unavailableMetrics() },
  fallbackMetrics: { pixelCount: 0, sourceColorMismatchPixelCount: 0, meaningfulBlurPixelCount: 0,
    meaningfulBlurFraction: null, b1VsFull32: unavailableMetrics(),
    boundaryGradient: { status: "insufficient-support", pairCount: 0, meanRelativeError: null, maximumRelativeError: null } },
  blurSpreadMetrics: { status: "insufficient-support", roiPixelCount: 0, full32ReferenceGradientEnergy: null,
    b1CandidateGradientEnergy: null, candidateToReferenceGradientRatio: null, relativeGradientError: null },
  foregroundLeakageMetrics: { status: "insufficient-support", depthEdgePixelCount: 0, signedBoundaryPairCount: 0,
    signedBoundaryPixelCount: 0, half32B1VsFull32AtDepthEdges: unavailableMetrics(),
    full32VsFull64AtSignedBoundary: unavailableMetrics(), half32B0VsFull32AtDepthEdges: unavailableMetrics(),
    half32B1VsFull32AtSignedBoundary: unavailableMetrics() },
  nearInvariance: { status: "insufficient-support", gpuVsCpuRgb: unavailableMetrics(), gpuVsCpuAlpha: unavailableMetrics(),
    beforeVsAfterB1Rgb: unavailableMetrics(), beforeVsAfterB1Alpha: unavailableMetrics(), nonzeroCoveragePixelCount: 0,
    fractionalCoveragePixelCount: 0, spreadOutsideSharpNearPixelCount: 0, nearFarBoundaryCoveragePixelCount: 0 },
  radiusCapEvidence: { status: "inconsistent", maximumUncappedRadiusPx: null, maximumOverrunPx: null, cappedPixelCount: 0,
    reportedMaximumUncappedRadiusPx: captures.half32.reportedRadiusEvidence.maximumUncappedRadiusPx,
    reportedCappedPixelCount: captures.half32.reportedRadiusEvidence.cappedPixelCount, reportedEvidenceMatches: false },
  signedBoundaryEvidence: { status: "absent", adjacentNearFarPairCount: 0, participatingPixelCount: 0,
    nearSidePixelCount: 0, farSidePixelCount: 0, populationConsistent: true },
  qualityDecision: { status: "invalid-comparison", reasons, thresholdRevision: null, thresholdsFrozenBeforeConfirmatory: false },
});

const validateMatrix = (captures: GroundGlassApertureGatherR3CaptureMatrix): string[] => {
  const reasons = [
    ...validateCapture(captures.half32, "half32"),
    ...validateCapture(captures.full32, "full32"),
    ...validateCapture(captures.full64, "full64"),
  ];
  const all = [captures.half32, captures.full32, captures.full64];
  if (new Set(all.map((capture) => capture.captureId)).size !== all.length) reasons.push("capture IDs are not unique; self-comparison is invalid");
  if (captures.half32.qualityMode !== "half32" || captures.full32.qualityMode !== "full32"
      || captures.full64.qualityMode !== "full64") reasons.push("capture matrix quality modes are incomplete or misassigned");
  const first = captures.half32;
  for (const capture of [captures.full32, captures.full64]) {
    if (capture.sceneId !== first.sceneId) reasons.push("scene identity differs across captures");
    if (capture.sceneSourceRevision !== first.sceneSourceRevision) reasons.push("scene source revision differs across captures");
    if (capture.effectiveOpticalRequestFingerprint !== first.effectiveOpticalRequestFingerprint) reasons.push("effective optical request differs across captures");
    if (capture.cameraStateFingerprint !== first.cameraStateFingerprint) reasons.push("camera state differs across captures");
    if (capture.colorDomain !== first.colorDomain) reasons.push("numeric color domain differs across captures");
    if (capture.sourceDimensions.widthPx !== first.sourceDimensions.widthPx
        || capture.sourceDimensions.heightPx !== first.sourceDimensions.heightPx) reasons.push("source dimensions differ across captures");
    if (capture.sampledFilmDimensionsMm.widthMm !== first.sampledFilmDimensionsMm.widthMm
        || capture.sampledFilmDimensionsMm.heightMm !== first.sampledFilmDimensionsMm.heightMm) reasons.push("sampled film dimensions differ across captures");
    if (capture.maximumRadiusPx !== first.maximumRadiusPx) reasons.push("radius cap differs across captures");
    for (const key of Object.keys(first.targetFormats) as (keyof GroundGlassApertureGatherR3Capture["targetFormats"])[]) {
      if (capture.targetFormats[key] !== first.targetFormats[key]) reasons.push("target format differs: " + key);
    }
    for (const key of ["sourceRgba", "depth", "physicalRgba", "validity"] as const) {
      const a = first.readbackBuffers[key];
      const b = capture.readbackBuffers[key];
      if (!equalArray(a, b)) reasons.push(key + " content differs across matched captures");
    }
  }
  return [...new Set(reasons)];
};

const validateThresholds = (thresholds: GroundGlassApertureGatherR3Thresholds): string[] => {
  const errors: string[] = [];
  if (!thresholds.revision.trim() || thresholds.evidenceScope !== "single-native-state"
      || !thresholds.frozenBeforeConfirmatory) errors.push("thresholds are missing a frozen single-state evidence scope");
  const numericKeys: readonly (keyof Omit<GroundGlassApertureGatherR3Thresholds,
    "revision" | "evidenceScope" | "frozenBeforeConfirmatory">)[] = [
    "minimumInteriorFarPixels", "minimumDepthEdgePixels", "minimumNearFarBoundaryPairs",
    "minimumNearCoveragePixels", "minimumFractionalCoveragePixels", "minimumNearFarBoundaryCoveragePixels",
    "minimumSpreadOutsideSharpNearPixels", "minimumFallbackBoundaryPairs", "minimumStrongOverrunPx",
    "maximumReferenceRmse", "maximumReferenceChannelError", "maximumReferenceInteriorFarRmse",
    "maximumReferenceDepthEdgeRmse", "maximumB1FullFrameRmse",
    "maximumB1InteriorFarRmse", "maximumB1DepthEdgeRmse", "maximumB1SignedBoundaryRmse",
    "maximumBlurGradientRelativeError",
    "maximumMeaningfulBlurFallbackFraction", "maximumFallbackBoundaryGradientRelativeError",
    "maximumFallbackSourceError", "maximumNearCpuRgbRmse",
    "maximumNearCpuAlphaRmse", "maximumNearB1RgbMaximumError", "maximumNearB1AlphaMaximumError",
    "minimumMeaningfulBlurRgbDifference", "depthEdgeThreshold",
  ];
  for (const key of numericKeys) {
    const value = thresholds[key];
    if (!Number.isFinite(value) || value < 0) errors.push("invalid threshold " + key);
  }
  const positiveCountKeys = [
    "minimumInteriorFarPixels", "minimumDepthEdgePixels", "minimumNearFarBoundaryPairs",
    "minimumNearCoveragePixels", "minimumFractionalCoveragePixels", "minimumNearFarBoundaryCoveragePixels",
    "minimumSpreadOutsideSharpNearPixels", "minimumFallbackBoundaryPairs",
  ] as const;
  for (const key of positiveCountKeys) {
    if (!Number.isSafeInteger(thresholds[key]) || thresholds[key] <= 0) {
      errors.push("minimum evidence threshold " + key + " must be a positive integer");
    }
  }
  if (thresholds.minimumStrongOverrunPx <= 0) {
    errors.push("minimum strong-overrun threshold must be positive");
  }
  if (thresholds.minimumMeaningfulBlurRgbDifference <= 0) {
    errors.push("minimum meaningful blur threshold must be positive");
  }
  return errors;
};

/**
 * Scores only matched, bounded readback evidence. Missing thresholds leave the
 * decision at not-evaluated; this function has no permissive default gate.
 */
export const evaluateGroundGlassApertureGatherR3 = (
  captures: GroundGlassApertureGatherR3CaptureMatrix,
  thresholds?: GroundGlassApertureGatherR3Thresholds,
): GroundGlassApertureGatherR3Evaluation => {
  const matrixHashes = {
    half32: hashCapture(captures.half32),
    full32: hashCapture(captures.full32),
    full64: hashCapture(captures.full64),
  };
  const matrixErrors = validateMatrix(captures);
  if (matrixErrors.length) return invalidResult(captures, matrixErrors, matrixHashes);
  const hashEntries = [matrixHashes.half32, matrixHashes.full32, matrixHashes.full64];
  const fingerprintIssues: string[] = [];
  for (const key of ["sourceColor", "depth", "physical", "validity"] as const) {
    if (new Set(hashEntries.map((entry) => entry[key])).size !== 1) fingerprintIssues.push(key + " fingerprint mismatch");
  }
  if (fingerprintIssues.length) return invalidResult(captures, fingerprintIssues, matrixHashes);

  const half = captures.half32;
  const full32 = captures.full32;
  const full64 = captures.full64;
  const sourcePixels = half.sourceDimensions.widthPx * half.sourceDimensions.heightPx;
  const gatherPixels = half.gatherDimensions.widthPx * half.gatherDimensions.heightPx;
  const b0 = deriveB0(half);
  const edgeThreshold = thresholds?.depthEdgeThreshold ?? EDGE_THRESHOLD_DEFAULT;
  const meaningfulBlur = thresholds?.minimumMeaningfulBlurRgbDifference ?? MEANINGFUL_BLUR_DEFAULT;
  const masks = buildMasks(half, edgeThreshold);
  const interiorCount = masks.interiorFar.reduce((sum, selected) => sum + selected, 0);
  const edgeCount = masks.depthEdge.reduce((sum, selected) => sum + selected, 0);
  const signedBoundaryPixelCount = masks.signedBoundary.reduce((sum, selected) => sum + selected, 0);

  const convergenceFull = makeRgbMetrics(full32.readbackBuffers.farGatherRgba,
    full64.readbackBuffers.farGatherRgba, sourcePixels);
  const convergenceInterior = metricsForMask(full32.readbackBuffers.farGatherRgba,
    full64.readbackBuffers.farGatherRgba, sourcePixels, masks.interiorFar);
  const convergenceEdges = metricsForMask(full32.readbackBuffers.farGatherRgba,
    full64.readbackBuffers.farGatherRgba, sourcePixels, masks.depthEdge);
  const b1VsFull32 = makeRgbMetrics(full32.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, sourcePixels);
  const b1VsFull64 = makeRgbMetrics(full64.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, sourcePixels);
  const b0VsFull32 = makeRgbMetrics(full32.readbackBuffers.farGatherRgba, b0, sourcePixels);
  const b0VsFull64 = makeRgbMetrics(full64.readbackBuffers.farGatherRgba, b0, sourcePixels);
  const b1Interior = metricsForMask(full32.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, sourcePixels, masks.interiorFar);
  const b0Interior = metricsForMask(full32.readbackBuffers.farGatherRgba, b0, sourcePixels, masks.interiorFar);
  const b1Edges = metricsForMask(full32.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, sourcePixels, masks.depthEdge);
  const b0Edges = metricsForMask(full32.readbackBuffers.farGatherRgba, b0, sourcePixels, masks.depthEdge);
  const referenceBoundary = metricsForMask(full32.readbackBuffers.farGatherRgba,
    full64.readbackBuffers.farGatherRgba, sourcePixels, masks.signedBoundary);
  const b1Boundary = metricsForMask(full32.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba, sourcePixels, masks.signedBoundary);

  let fallbackPixelCount = 0;
  let fallbackMismatchCount = 0;
  let meaningfulBlurFallbackCount = 0;
  const fallbackMask = new Uint8Array(sourcePixels);
  for (let pixel = 0; pixel < sourcePixels; pixel += 1) {
    const decisionOffset = pixel * 4;
    if (half.readbackBuffers.b1DecisionRgba[decisionOffset + 2] === 1) continue;
    fallbackPixelCount += 1;
    fallbackMask[pixel] = 1;
    let sourceMismatch = 0;
    let referenceBlur = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const offset = pixel * 4 + channel;
      const sourceDifference = Math.abs(half.readbackBuffers.b1FarRgba[offset]! - half.readbackBuffers.sourceRgba[offset]!);
      sourceMismatch = Math.max(sourceMismatch, sourceDifference);
      const blurDifference = Math.abs(full32.readbackBuffers.farGatherRgba[offset]! - half.readbackBuffers.sourceRgba[offset]!);
      referenceBlur += blurDifference / 3;
    }
    if (sourceMismatch > (thresholds?.maximumFallbackSourceError ?? 0.001)) fallbackMismatchCount += 1;
    if (referenceBlur >= meaningfulBlur) meaningfulBlurFallbackCount += 1;
  }
  const fallbackFraction = fallbackPixelCount ? meaningfulBlurFallbackCount / fallbackPixelCount : 0;
  let fallbackBoundaryPairCount = 0;
  let fallbackBoundaryRelativeErrorSum = 0;
  let fallbackBoundaryRelativeErrorMaximum = 0;
  for (let y = 0; y < half.sourceDimensions.heightPx; y += 1) {
    for (let x = 0; x < half.sourceDimensions.widthPx; x += 1) {
      const pixel = y * half.sourceDimensions.widthPx + x;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= half.sourceDimensions.widthPx || ny >= half.sourceDimensions.heightPx) continue;
        const other = ny * half.sourceDimensions.widthPx + nx;
        if (fallbackMask[pixel] === fallbackMask[other]) continue;
        let candidateGradient = 0;
        let referenceGradient = 0;
        for (let channel = 0; channel < 3; channel += 1) {
          const leftOffset = pixel * 4 + channel;
          const rightOffset = other * 4 + channel;
          candidateGradient += Math.abs(half.readbackBuffers.b1FarRgba[leftOffset]!
            - half.readbackBuffers.b1FarRgba[rightOffset]!);
          referenceGradient += Math.abs(full32.readbackBuffers.farGatherRgba[leftOffset]!
            - full32.readbackBuffers.farGatherRgba[rightOffset]!);
        }
        candidateGradient /= 3;
        referenceGradient /= 3;
        const relativeError = Math.abs(candidateGradient - referenceGradient)
          / Math.max(referenceGradient, meaningfulBlur);
        fallbackBoundaryPairCount += 1;
        fallbackBoundaryRelativeErrorSum += relativeError;
        fallbackBoundaryRelativeErrorMaximum = Math.max(fallbackBoundaryRelativeErrorMaximum, relativeError);
      }
    }
  }
  const fallbackMetrics: GroundGlassApertureGatherR3Evaluation["fallbackMetrics"] = {
    pixelCount: fallbackPixelCount,
    sourceColorMismatchPixelCount: fallbackMismatchCount,
    meaningfulBlurPixelCount: meaningfulBlurFallbackCount,
    meaningfulBlurFraction: fallbackPixelCount ? fallbackFraction : null,
    b1VsFull32: fallbackPixelCount
      ? makeRgbMetrics(full32.readbackBuffers.farGatherRgba, half.readbackBuffers.b1FarRgba,
        sourcePixels, fallbackMask)
      : emptyMetrics(),
    boundaryGradient: {
      status: fallbackBoundaryPairCount ? "measured" : "insufficient-support",
      pairCount: fallbackBoundaryPairCount,
      meanRelativeError: fallbackBoundaryPairCount
        ? fallbackBoundaryRelativeErrorSum / fallbackBoundaryPairCount : null,
      maximumRelativeError: fallbackBoundaryPairCount ? fallbackBoundaryRelativeErrorMaximum : null,
    },
  };

  const referenceGradient = gradientEnergy(full32.readbackBuffers.farGatherRgba, half.sourceDimensions, masks.interiorFar);
  const candidateGradient = gradientEnergy(half.readbackBuffers.b1FarRgba, half.sourceDimensions, masks.interiorFar);
  const gradientRatio = referenceGradient !== null && candidateGradient !== null && referenceGradient > 1e-12
    ? candidateGradient / referenceGradient : null;
  const gradientError = gradientRatio === null ? null : Math.abs(gradientRatio - 1);

  let nonzeroCoveragePixelCount = 0;
  let fractionalCoveragePixelCount = 0;
  let spreadOutsideSharpNearPixelCount = 0;
  let nearFarBoundaryCoveragePixelCount = 0;
  const near = half.readbackBuffers.nearBeforeB1Rgba;
  const nearCpu = half.readbackBuffers.nearCpuReferenceRgba;
  const gw = half.gatherDimensions.widthPx;
  const gh = half.gatherDimensions.heightPx;
  const sw = half.sourceDimensions.widthPx;
  const sh = half.sourceDimensions.heightPx;
  for (let pixel = 0; pixel < gatherPixels; pixel += 1) {
    const alpha = near[pixel * 4 + 3]!;
    if (alpha > 0) nonzeroCoveragePixelCount += 1;
    if (alpha > 0 && alpha < 1) fractionalCoveragePixelCount += 1;
  }
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const pixel = y * sw + x;
      const nearX = Math.min(gw - 1, Math.floor(((x + 0.5) / sw) * gw));
      const nearY = Math.min(gh - 1, Math.floor(((y + 0.5) / sh) * gh));
      const alpha = near[(nearY * gw + nearX) * 4 + 3]!;
      const coc = half.readbackBuffers.physicalRgba[pixel * 4]!;
      if (alpha > 0 && (half.readbackBuffers.validity[pixel] !== 1 || coc >= -SIGN_EPSILON_MM)) {
        spreadOutsideSharpNearPixelCount += 1;
      }
      if (alpha > 0 && masks.signedBoundary[pixel] === 1) nearFarBoundaryCoveragePixelCount += 1;
    }
  }
  const gpuVsCpuRgb = makeRgbMetrics(nearCpu, near, gatherPixels);
  const gpuVsCpuAlpha = makeChannelMetrics(nearCpu, near, gatherPixels, 3);
  const nearBeforeAfterRgb = makeRgbMetrics(half.readbackBuffers.nearBeforeB1Rgba, half.readbackBuffers.nearAfterB1Rgba, gatherPixels);
  const nearBeforeAfterAlpha = makeChannelMetrics(half.readbackBuffers.nearBeforeB1Rgba, half.readbackBuffers.nearAfterB1Rgba, gatherPixels, 3);
  const expectedInteriorBlur = meanRgbDistance(full32.readbackBuffers.farGatherRgba,
    half.readbackBuffers.sourceRgba, sourcePixels, masks.interiorFar);

  let nearSidePixelCount = 0;
  let farSidePixelCount = 0;
  for (let pixel = 0; pixel < sourcePixels; pixel += 1) {
    if (masks.depthEdge[pixel] !== 1 || half.readbackBuffers.validity[pixel] !== 1) continue;
    const coc = half.readbackBuffers.physicalRgba[pixel * 4]!;
    if (coc < -SIGN_EPSILON_MM) nearSidePixelCount += 1;
    if (coc > SIGN_EPSILON_MM) farSidePixelCount += 1;
  }
  const full32EdgeContrast = averageRgbEdgeContrast(full32.readbackBuffers.farGatherRgba, half, edgeThreshold);

  let maximumUncappedRadiusPx: number | null = null;
  let cappedPixelCount = 0;
  let eligibleFarCenterCount = 0;
  for (let gatherPixel = 0; gatherPixel < gatherPixels; gatherPixel += 1) {
    const centerX = half.readbackBuffers.observedGatherCenterSourceIds[gatherPixel * 2]!;
    const centerY = half.readbackBuffers.observedGatherCenterSourceIds[gatherPixel * 2 + 1]!;
    const centerPixel = centerY * sw + centerX;
    if (half.readbackBuffers.validity[centerPixel] !== 1
        || half.readbackBuffers.physicalRgba[centerPixel * 4]! <= SIGN_EPSILON_MM) continue;
    const radius = mapPhysicalRadiusPx(half.readbackBuffers.physicalRgba, centerPixel,
      half.sampledFilmDimensionsMm, half.sourceDimensions);
    eligibleFarCenterCount += 1;
    maximumUncappedRadiusPx = maximumUncappedRadiusPx === null
      ? radius : Math.max(maximumUncappedRadiusPx, radius);
    if (radius > half.maximumRadiusPx) cappedPixelCount += 1;
  }
  const maximumOverrunPx = maximumUncappedRadiusPx === null
    ? null : Math.max(0, maximumUncappedRadiusPx - half.maximumRadiusPx);
  const radiusReportedMatches = maximumUncappedRadiusPx !== null
    && Math.abs(maximumUncappedRadiusPx - half.reportedRadiusEvidence.maximumUncappedRadiusPx)
      <= REPORT_RADIUS_TOLERANCE_PX
    && cappedPixelCount === half.reportedRadiusEvidence.cappedPixelCount;

  let qualityStatus: GroundGlassR3DecisionStatus = "not-evaluated";
  let qualityReasons: string[] = [];
  let thresholdErrors: string[] = [];
  if (!thresholds) {
    qualityReasons = ["acceptance thresholds were not supplied; exploratory metrics cannot qualify a state"];
  } else {
    thresholdErrors = validateThresholds(thresholds);
    if (thresholdErrors.length) qualityReasons = thresholdErrors;
    else if (!masks.signedBoundaryPopulationConsistent) {
      qualityStatus = "invalid-comparison";
      qualityReasons = ["signed-boundary Near/Far unique-pixel population is inconsistent with its mask"];
    }
    else {
      const supportErrors: string[] = [];
      if (interiorCount < thresholds.minimumInteriorFarPixels) supportErrors.push("interior far ROI support is insufficient");
      if (expectedInteriorBlur.mean === null
          || expectedInteriorBlur.mean < thresholds.minimumMeaningfulBlurRgbDifference) {
        supportErrors.push("interior-far reference blur signal is below the minimum meaningful-blur support threshold");
      }
      if (edgeCount < thresholds.minimumDepthEdgePixels) supportErrors.push("depth-edge ROI support is insufficient");
      if (masks.signedBoundaryPairCount < thresholds.minimumNearFarBoundaryPairs) supportErrors.push("valid near/far signed-boundary support is insufficient");
      if (maximumOverrunPx === null || maximumOverrunPx < thresholds.minimumStrongOverrunPx) supportErrors.push("physical radius does not strongly overrun the active cap");
      if (nonzeroCoveragePixelCount < thresholds.minimumNearCoveragePixels) supportErrors.push("near coverage support is insufficient");
      if (fractionalCoveragePixelCount < thresholds.minimumFractionalCoveragePixels) supportErrors.push("fractional near coverage support is insufficient");
      if (nearFarBoundaryCoveragePixelCount < thresholds.minimumNearFarBoundaryCoveragePixels) supportErrors.push("near coverage at the signed boundary is insufficient");
      if (spreadOutsideSharpNearPixelCount < thresholds.minimumSpreadOutsideSharpNearPixels) supportErrors.push("near spread beyond the sharp silhouette is insufficient");
      if (fallbackMetrics.boundaryGradient.status !== "measured"
          || fallbackMetrics.boundaryGradient.pairCount < thresholds.minimumFallbackBoundaryPairs) {
        supportErrors.push("fallback-boundary halo ROI support is insufficient");
      }
      if (b1Boundary.status !== "measured" || b1Boundary.rmse === null) {
        supportErrors.push("signed near/far-boundary B1 metrics are unavailable");
      }
      if (edgeCount === 0 || interiorCount === 0) supportErrors.push("geometry-aware ROI metrics have no valid support");
      const converged = convergenceFull.rmse !== null
        && convergenceFull.maximumChannelError !== null
        && convergenceInterior.rmse !== null
        && convergenceEdges.rmse !== null
        && convergenceFull.rmse <= thresholds.maximumReferenceRmse
        && convergenceFull.maximumChannelError <= thresholds.maximumReferenceChannelError
        && convergenceInterior.rmse <= thresholds.maximumReferenceInteriorFarRmse
        && convergenceEdges.rmse <= thresholds.maximumReferenceDepthEdgeRmse;
      if (supportErrors.length) {
        qualityStatus = "insufficient-roi-support";
        qualityReasons = supportErrors;
      } else if (!converged) {
        qualityStatus = "reference-not-converged";
        qualityReasons = ["Full32/Full64 full-frame or ROI reference difference exceeds the frozen convergence limits"];
      } else {
        const candidateFailures: string[] = [];
        if (!radiusReportedMatches) candidateFailures.push("reported radius-cap evidence does not match recomputed physical radii");
        if (b1VsFull32.rmse === null || b1VsFull32.rmse > thresholds.maximumB1FullFrameRmse) candidateFailures.push("Half32 B1 full-frame error exceeds its limit");
        if (b1Interior.rmse === null || b1Interior.rmse > thresholds.maximumB1InteriorFarRmse) candidateFailures.push("Half32 B1 interior-far error exceeds its limit");
        if (b1Edges.rmse === null || b1Edges.rmse > thresholds.maximumB1DepthEdgeRmse) candidateFailures.push("Half32 B1 depth-edge error exceeds its limit");
        if (b1Boundary.rmse === null || b1Boundary.rmse > thresholds.maximumB1SignedBoundaryRmse) candidateFailures.push("Half32 B1 signed near/far-boundary error exceeds its limit");
        if (gradientError === null || gradientError > thresholds.maximumBlurGradientRelativeError) candidateFailures.push("B1 blur-gradient spread differs from Full32 beyond its limit");
        if (fallbackFraction > thresholds.maximumMeaningfulBlurFallbackFraction) candidateFailures.push("meaningful-defocus source fallback fraction exceeds its limit");
        if (fallbackMetrics.boundaryGradient.meanRelativeError === null
            || fallbackMetrics.boundaryGradient.meanRelativeError > thresholds.maximumFallbackBoundaryGradientRelativeError) {
          candidateFailures.push("fallback-boundary halo gradient differs from Full32 beyond its limit");
        }
        if (fallbackMismatchCount > 0) candidateFailures.push("B1 source-color fallback does not preserve source color");
        if (gpuVsCpuRgb.rmse === null || gpuVsCpuRgb.rmse > thresholds.maximumNearCpuRgbRmse) candidateFailures.push("GPU near RGB differs from the independent CPU reference");
        if (gpuVsCpuAlpha.rmse === null || gpuVsCpuAlpha.rmse > thresholds.maximumNearCpuAlphaRmse) candidateFailures.push("GPU near alpha differs from the independent CPU reference");
        if (nearBeforeAfterRgb.maximumChannelError === null || nearBeforeAfterRgb.maximumChannelError > thresholds.maximumNearB1RgbMaximumError) candidateFailures.push("B1 changed near RGB");
        if (nearBeforeAfterAlpha.maximumChannelError === null || nearBeforeAfterAlpha.maximumChannelError > thresholds.maximumNearB1AlphaMaximumError) candidateFailures.push("B1 changed near alpha");
        if (!radiusReportedMatches) qualityStatus = "invalid-comparison";
        else qualityStatus = candidateFailures.length ? "candidate-quality-failed" : "bounded-qualified";
        qualityReasons = candidateFailures.length ? candidateFailures : ["all frozen single-state R3 gates passed"];
      }
    }
  }
  if (thresholds && !thresholdErrors.length && !radiusReportedMatches && qualityStatus !== "reference-not-converged"
      && qualityStatus !== "insufficient-roi-support") {
    qualityStatus = "invalid-comparison";
  }

  const referenceStatus: GroundGlassApertureGatherR3Evaluation["referenceConvergence"]["status"] =
    convergenceFull.rmse === null || convergenceInterior.rmse === null || convergenceEdges.rmse === null
      ? "insufficient-support"
      : thresholds && !thresholdErrors.length
        ? convergenceFull.rmse <= thresholds.maximumReferenceRmse
          && (convergenceFull.maximumChannelError ?? Infinity) <= thresholds.maximumReferenceChannelError
          && convergenceInterior.rmse <= thresholds.maximumReferenceInteriorFarRmse
          && convergenceEdges.rmse <= thresholds.maximumReferenceDepthEdgeRmse
          ? "converged" : "not-converged"
        : "not-evaluated";

  return {
    schemaVersion: 1,
    evidenceScope: "single-native-webgpu-state",
    captureProvenance: {
      half32: captureProvenance(half),
      full32: captureProvenance(full32),
      full64: captureProvenance(full64),
    },
    captureIds: { half32: half.captureId, full32: full32.captureId, full64: full64.captureId },
    requestIds: { half32: half.requestId, full32: full32.requestId, full64: full64.requestId },
    provenance: { status: "matched", reasons: [], fingerprints: matrixHashes },
    referenceConvergence: { status: referenceStatus, fullFrame: convergenceFull, interiorFar: convergenceInterior, depthEdge: convergenceEdges },
    fullFrameMetrics: { half32B1VsFull32: b1VsFull32, half32B1VsFull64: b1VsFull64,
      half32B0VsFull32: b0VsFull32, half32B0VsFull64: b0VsFull64 },
    interiorFarMetrics: { status: interiorCount > 0 ? "measured" : "insufficient-support", pixelCount: interiorCount,
      expectedBlurMeanRgbDifference: expectedInteriorBlur.mean,
      expectedBlurMaximumRgbDifference: expectedInteriorBlur.maximum,
      half32B1VsFull32: b1Interior, half32B0VsFull32: b0Interior },
    depthEdgeMetrics: { status: edgeCount > 0 ? "measured" : "insufficient-support", pixelCount: edgeCount,
      depthEdgePairCount: masks.depthEdgePairCount, averageDepthDelta: masks.averageDepthDelta,
      nearSidePixelCount, farSidePixelCount, averageFull32RgbEdgeContrast: full32EdgeContrast,
      half32B1VsFull32: b1Edges, half32B0VsFull32: b0Edges, full32VsFull64: convergenceEdges },
    fallbackMetrics,
    blurSpreadMetrics: { status: gradientError === null ? "insufficient-support" : "measured", roiPixelCount: interiorCount,
      full32ReferenceGradientEnergy: referenceGradient, b1CandidateGradientEnergy: candidateGradient,
      candidateToReferenceGradientRatio: gradientRatio, relativeGradientError: gradientError },
    foregroundLeakageMetrics: { status: edgeCount > 0 ? "measured" : "insufficient-support", depthEdgePixelCount: edgeCount,
      signedBoundaryPairCount: masks.signedBoundaryPairCount, signedBoundaryPixelCount,
      full32VsFull64AtSignedBoundary: referenceBoundary,
      half32B1VsFull32AtDepthEdges: b1Edges, half32B0VsFull32AtDepthEdges: b0Edges,
      half32B1VsFull32AtSignedBoundary: b1Boundary },
    nearInvariance: { status: nonzeroCoveragePixelCount > 0 ? "measured" : "insufficient-support",
      gpuVsCpuRgb, gpuVsCpuAlpha, beforeVsAfterB1Rgb: nearBeforeAfterRgb, beforeVsAfterB1Alpha: nearBeforeAfterAlpha,
      nonzeroCoveragePixelCount, fractionalCoveragePixelCount, spreadOutsideSharpNearPixelCount,
      nearFarBoundaryCoveragePixelCount },
    radiusCapEvidence: { status: eligibleFarCenterCount === 0 ? "insufficient-support" : radiusReportedMatches ? "matched" : "inconsistent",
      maximumUncappedRadiusPx, maximumOverrunPx, cappedPixelCount,
      reportedMaximumUncappedRadiusPx: half.reportedRadiusEvidence.maximumUncappedRadiusPx,
      reportedCappedPixelCount: half.reportedRadiusEvidence.cappedPixelCount,
      reportedEvidenceMatches: radiusReportedMatches },
    signedBoundaryEvidence: { status: !masks.signedBoundaryPopulationConsistent ? "invalid"
      : masks.signedBoundaryPairCount > 0 ? "present" : "absent",
      adjacentNearFarPairCount: masks.signedBoundaryPairCount, participatingPixelCount: signedBoundaryPixelCount,
      nearSidePixelCount: masks.signedBoundaryNearSidePixelCount,
      farSidePixelCount: masks.signedBoundaryFarSidePixelCount,
      populationConsistent: masks.signedBoundaryPopulationConsistent },
    qualityDecision: { status: qualityStatus, reasons: qualityReasons,
      thresholdRevision: thresholds?.revision ?? null,
      thresholdsFrozenBeforeConfirmatory: thresholds?.frozenBeforeConfirmatory ?? false },
  };
};
