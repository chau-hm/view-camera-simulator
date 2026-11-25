/**
 * Independent CPU aperture-gather reference for bounded M5 research captures.
 *
 * Inputs are readback buffers already normalized to top-origin source rows.
 * This module intentionally has no React, Three.js, TSL, renderer, or fixture
 * dependencies. Color values remain in the source target's stored channel
 * representation; this reference does not add a color-space transform.
 */

export type GroundGlassApertureDimensions = Readonly<{
  widthPx: number;
  heightPx: number;
}>;

export type GroundGlassFilmDimensionsMm = Readonly<{
  widthMm: number;
  heightMm: number;
}>;

export type GroundGlassPixelPoint = readonly [x: number, y: number];
export type GroundGlassPixelAxis = readonly [x: number, y: number];

export const GROUND_GLASS_APERTURE_GOLDEN_ANGLE_RAD = 2.399963229728653;
export const GROUND_GLASS_APERTURE_VALIDITY_CODE = 1;
export const GROUND_GLASS_APERTURE_SIGN_EPSILON_MM = 0.00001;
export const GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FLOOR_MM = 20;
export const GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FRACTION = 0.015;
export const GROUND_GLASS_APERTURE_MAX_SAMPLE_COUNT = 64;

export type GroundGlassPixelEllipse = Readonly<{
  majorAxisPx: GroundGlassPixelAxis;
  minorAxisPx: GroundGlassPixelAxis;
  uncappedMaximumRadiusPx: number;
}>;

export type GroundGlassCappedPixelEllipse = GroundGlassPixelEllipse & Readonly<{
  clampScale: number;
  effectiveMaximumRadiusPx: number;
  capApplied: boolean;
}>;

export type GroundGlassApertureGatherReferenceInput = Readonly<{
  source: GroundGlassApertureDimensions;
  gather: GroundGlassApertureDimensions;
  film: GroundGlassFilmDimensionsMm;
  /** Source RGBA values normalized to [0,1], in top-origin row order. */
  sourceRgba: Float32Array;
  /** M4 RGBA physical CoC/footprint readback, in top-origin row order. */
  physicalRgba: Float32Array;
  /** M4 validity codes, in top-origin row order. Only code 1 contributes. */
  validity: Uint8Array;
  /** Native depth readback in normalized device-depth range [0,1]. */
  depth: Float32Array;
  /**
   * GPU-observed source texel IDs for each gather center, when available.
   * These IDs are authoritative for center inputs because reduced-resolution
   * sampling can differ from the nominal pixel-center formula by one pixel.
   */
  observedGatherCenterSourceIds?: ArrayLike<number>;
  /** Exact top-origin screen UV emitted by the native gather-center provenance pass. */
  observedGatherCenterSourceUvs?: ArrayLike<number>;
  /** Three.js Matrix4.elements style: column-major inverse projection values. */
  inverseProjectionMatrix: ArrayLike<number>;
  sampleCount: number;
  /** Renderer radius cap in source pixels, applied after physical mapping. */
  maximumRadiusPx: number;
}>;

/** Diagnostic-only sample counts; the native TSL gather remains capped at 64. */
export type GroundGlassApertureGatherDiagnosticInput = Omit<
  GroundGlassApertureGatherReferenceInput,
  "sampleCount"
> & Readonly<{
  sampleCount: 128 | 256;
}>;

export type GroundGlassApertureGatherNestedSampleCount = 16 | 32 | 64;

export type GroundGlassApertureGatherReferenceResult = Readonly<{
  /**
   * Gather-grid RGBA; far alpha is 1, near alpha is coverage. These are
   * Float32 outputs written from JavaScript double-precision intermediates.
   */
  farRgba: Float32Array;
  nearRgba: Float32Array;
  /** Actual top-origin source texel sampled for each gather output center. */
  gatherCenterSourceIds: Int32Array;
  /** Nominal source IDs computed from normalized gather pixel centers. */
  nominalGatherCenterSourceIds: Int32Array;
  centerViewDistanceMm: Float32Array;
  /** Physical center footprint metrics for each far output gather texel. */
  farUncappedMaximumRadiusPx: Float32Array;
  farEffectiveMaximumRadiusPx: Float32Array;
  farCapApplied: Uint8Array;
  /** Maximum candidate-footprint radius evaluated by the near pass per output texel. */
  nearMaximumCandidateUncappedRadiusPx: Float32Array;
  nearCandidateFootprintEvaluationCount: Uint16Array;
  nearCandidateCapAppliedCount: Uint16Array;
  /** Per output texel: 1 iff the observed center has valid negative signed CoC. */
  nearCenterIsNear: Uint8Array;
  /** Number of proposals visited by the near pass. */
  nearEvaluatedProposalCount: Uint16Array;
  /** Number of near proposals accepted after validity, sign, footprint, and depth gates. */
  nearAcceptedProposalCount: Uint16Array;
  /** Number of proposals with positive candidate-ellipse membership, before other gates. */
  nearNonzeroMembershipCount: Uint16Array;
  /** Near color weight sum, including the center sample when the center is near. */
  nearWeightSum: Float32Array;
  /** Proposal-derived coverage mass before division by sample count. */
  nearCoverageMass: Float32Array;
  /** Proposal-derived alpha estimate before the center-near alpha override. */
  nearEstimatedCoverage: Float32Array;
  /** Mean candidate area ratio over accepted proposals; zero when none are accepted. */
  nearAcceptedAreaRatioMean: Float32Array;
  /** Maximum candidate proposal compensation over accepted proposals; zero if none. */
  nearAcceptedCompensationMaximum: Float32Array;
  summary: Readonly<{
    maximumFarUncappedRadiusPx: number;
    farCappedCenterCount: number;
    maximumNearCandidateUncappedRadiusPx: number;
    nearCappedCandidateCount: number;
  }>;
}>;

const validDimensions = (dimensions: GroundGlassApertureDimensions): boolean =>
  Number.isSafeInteger(dimensions.widthPx)
  && Number.isSafeInteger(dimensions.heightPx)
  && dimensions.widthPx > 0
  && dimensions.heightPx > 0;

const assertFiniteArray = (values: ArrayLike<number>, label: string): void => {
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) throw new RangeError(`${label} must contain finite values`);
  }
};

const assertInput = (
  input: GroundGlassApertureGatherReferenceInput,
  maximumSampleCount = GROUND_GLASS_APERTURE_MAX_SAMPLE_COUNT,
): number => {
  if (!validDimensions(input.source) || !validDimensions(input.gather)) {
    throw new RangeError("Aperture gather source and output dimensions must be positive safe integers");
  }
  const sourcePixelCount = input.source.widthPx * input.source.heightPx;
  const gatherPixelCount = input.gather.widthPx * input.gather.heightPx;
  if (!Number.isSafeInteger(sourcePixelCount) || !Number.isSafeInteger(gatherPixelCount)) {
    throw new RangeError("Aperture gather dimensions exceed safe array indexing");
  }
  if (input.sourceRgba.length !== sourcePixelCount * 4
      || input.physicalRgba.length !== sourcePixelCount * 4
      || input.validity.length !== sourcePixelCount
      || input.depth.length !== sourcePixelCount
      || input.inverseProjectionMatrix.length !== 16
      || (input.observedGatherCenterSourceIds !== undefined
        && input.observedGatherCenterSourceIds.length !== gatherPixelCount * 2)
      || (input.observedGatherCenterSourceUvs !== undefined
        && input.observedGatherCenterSourceUvs.length !== gatherPixelCount * 2)) {
    throw new RangeError("Aperture gather readbacks do not match source dimensions");
  }
  if (!Number.isFinite(input.film.widthMm) || input.film.widthMm <= 0
      || !Number.isFinite(input.film.heightMm) || input.film.heightMm <= 0
      || !Number.isInteger(input.sampleCount)
      || input.sampleCount <= 0
      || input.sampleCount > maximumSampleCount
      || !Number.isFinite(input.maximumRadiusPx)
      || input.maximumRadiusPx < 0) {
    throw new RangeError("Aperture gather film, sample count, or radius cap is invalid");
  }
  assertFiniteArray(input.sourceRgba, "Aperture gather source color");
  assertFiniteArray(input.physicalRgba, "Aperture gather physical CoC");
  assertFiniteArray(input.depth, "Aperture gather depth");
  assertFiniteArray(input.inverseProjectionMatrix, "Aperture gather inverse projection matrix");
  if (input.observedGatherCenterSourceUvs !== undefined) {
    assertFiniteArray(input.observedGatherCenterSourceUvs, "Observed gather-center source UV");
    for (let index = 0; index < input.observedGatherCenterSourceUvs.length; index += 1) {
      const value = input.observedGatherCenterSourceUvs[index]!;
      if (value < 0 || value > 1) throw new RangeError("Observed gather-center source UV must be in [0,1]");
    }
  }
  for (let pixel = 0; pixel < sourcePixelCount; pixel += 1) {
    const depth = input.depth[pixel]!;
    if (depth < 0 || depth > 1) {
      throw new RangeError("Aperture gather depth readback must be in normalized [0,1] range");
    }
    if (input.validity[pixel] === GROUND_GLASS_APERTURE_VALIDITY_CODE) {
      const offset = pixel * 4;
      const coc = input.physicalRgba[offset]!;
      const major = input.physicalRgba[offset + 1]!;
      const minor = input.physicalRgba[offset + 2]!;
      const orientation = input.physicalRgba[offset + 3]!;
      if (major < 0 || minor < 0 || orientation < 0 || orientation > 1) {
        throw new RangeError("Valid M4 physical data requires non-negative radii and normalized orientation");
      }
      if (!Number.isFinite(coc)) throw new RangeError("Valid M4 signed CoC must be finite");
    }
  }
  return gatherPixelCount;
};

/** Top-origin nearest texture lookup matching the readback coordinate contract. */
export const nearestGroundGlassSourcePixelAtTopUv = (
  uTop: number,
  vTop: number,
  source: GroundGlassApertureDimensions,
): GroundGlassPixelPoint => {
  if (!Number.isFinite(uTop) || !Number.isFinite(vTop) || !validDimensions(source)) {
    throw new RangeError("Top-origin texture lookup requires finite UVs and positive source dimensions");
  }
  // The native TSL path supplies f32 normalized texture coordinates. Round at
  // the texture boundary so CPU texel selection agrees at exact/near-exact
  // pixel boundaries instead of relying on JavaScript's wider f64 precision.
  const u = Math.fround(Math.min(1, Math.max(0, uTop)));
  const v = Math.fround(Math.min(1, Math.max(0, vTop)));
  return [
    Math.min(source.widthPx - 1, Math.floor(Math.fround(u * source.widthPx))),
    Math.min(source.heightPx - 1, Math.floor(Math.fround(v * source.heightPx))),
  ];
};

/**
 * Reconstructs `getViewPosition()`'s WebGPU branch from Three.js r186
 * `src/nodes/utils/PostProcessingUtils.js`: input UV is top-origin, WebGPU
 * clip XY is `(2u-1, 1-2v)`, clip Z is the sampled depth, then the column-major
 * inverse projection is multiplied and divided by W. The gather depth gate
 * uses `abs(viewZ) * 1000` millimeters, matching the Phase F TSL caller.
 */
export const groundGlassViewDistanceMmAtTopUv = (
  uTop: number,
  vTop: number,
  normalizedDepth: number,
  inverseProjectionMatrix: ArrayLike<number>,
): number => {
  if (!Number.isFinite(uTop) || !Number.isFinite(vTop)
      || !Number.isFinite(normalizedDepth)
      || inverseProjectionMatrix.length !== 16) {
    throw new RangeError("View-distance reconstruction requires finite top-origin UV, depth, and a 4x4 matrix");
  }
  const clipX = uTop * 2 - 1;
  const clipY = 1 - vTop * 2;
  const clipZ = normalizedDepth;
  const viewZ = inverseProjectionMatrix[2]! * clipX
    + inverseProjectionMatrix[6]! * clipY
    + inverseProjectionMatrix[10]! * clipZ
    + inverseProjectionMatrix[14]!;
  const viewW = inverseProjectionMatrix[3]! * clipX
    + inverseProjectionMatrix[7]! * clipY
    + inverseProjectionMatrix[11]! * clipZ
    + inverseProjectionMatrix[15]!;
  if (!Number.isFinite(viewZ) || !Number.isFinite(viewW) || Math.abs(viewW) <= 1e-12) {
    throw new RangeError("Inverse projection produced an unusable view position");
  }
  const distanceMm = Math.abs(viewZ / viewW) * 1000;
  if (!Number.isFinite(distanceMm)) throw new RangeError("Inverse projection produced a non-finite view distance");
  return distanceMm;
};

/** Physical ellipse to source-pixel map, using separate horizontal/vertical scales. */
export const mapGroundGlassPhysicalEllipseToSourcePixels = (input: Readonly<{
  majorRadiusMm: number;
  minorRadiusMm: number;
  orientationRad: number;
  film: GroundGlassFilmDimensionsMm;
  source: GroundGlassApertureDimensions;
}>): GroundGlassPixelEllipse => {
  const { majorRadiusMm, minorRadiusMm, orientationRad, film, source } = input;
  if (![majorRadiusMm, minorRadiusMm, orientationRad, film.widthMm, film.heightMm].every(Number.isFinite)
      || majorRadiusMm < 0 || minorRadiusMm < 0
      || film.widthMm <= 0 || film.heightMm <= 0
      || !validDimensions(source)) {
    throw new RangeError("Physical ellipse mapping requires finite radii and valid film/source dimensions");
  }
  const cosine = Math.cos(orientationRad);
  const sine = Math.sin(orientationRad);
  const majorAxisPx: GroundGlassPixelAxis = [
    cosine * majorRadiusMm * source.widthPx / film.widthMm,
    -sine * majorRadiusMm * source.heightPx / film.heightMm,
  ];
  const minorAxisPx: GroundGlassPixelAxis = [
    -sine * minorRadiusMm * source.widthPx / film.widthMm,
    -cosine * minorRadiusMm * source.heightPx / film.heightMm,
  ];
  return {
    majorAxisPx,
    minorAxisPx,
    uncappedMaximumRadiusPx: maximumSingularValue(majorAxisPx, minorAxisPx),
  };
};

/** Computes sigma-max of the 2x2 ellipse map without assuming orthogonality. */
const maximumSingularValue = (
  major: GroundGlassPixelAxis,
  minor: GroundGlassPixelAxis,
): number => {
  const values = [...major, ...minor];
  if (!values.every(Number.isFinite)) throw new RangeError("Pixel ellipse axes must be finite");
  const scale = Math.max(...values.map(Math.abs));
  if (scale === 0) return 0;
  const [majorX, majorY, minorX, minorY] = values.map((value) => value / scale);
  const gramMajor = majorX! * majorX! + majorY! * majorY!;
  const gramMinor = minorX! * minorX! + minorY! * minorY!;
  const gramCross = majorX! * minorX! + majorY! * minorY!;
  const traceHalf = (gramMajor + gramMinor) / 2;
  const discriminant = Math.hypot((gramMajor - gramMinor) / 2, gramCross);
  return scale * Math.sqrt(Math.max(0, traceHalf + discriminant));
};

/** Applies the sampling cap after physical-to-source-pixel conversion. */
export const capGroundGlassPixelEllipse = (
  ellipse: GroundGlassPixelEllipse,
  maximumRadiusPx: number,
): GroundGlassCappedPixelEllipse => {
  if (!Number.isFinite(maximumRadiusPx) || maximumRadiusPx < 0) {
    throw new RangeError("Aperture radius cap must be finite and non-negative");
  }
  const clampScale = ellipse.uncappedMaximumRadiusPx > 0
    ? Math.min(1, maximumRadiusPx / ellipse.uncappedMaximumRadiusPx)
    : 1;
  return {
    ...ellipse,
    clampScale,
    effectiveMaximumRadiusPx: ellipse.uncappedMaximumRadiusPx * clampScale,
    capApplied: clampScale < 1,
  };
};

/** Deterministic equal-area golden-angle disk proposal from Phase F. */
export const groundGlassGoldenAngleDiskProposal = (
  index: number,
  sampleCount: number,
): GroundGlassPixelAxis => {
  if (!Number.isInteger(index) || !Number.isInteger(sampleCount)
      || sampleCount <= 0 || index < 0 || index >= sampleCount) {
    throw new RangeError("Golden-angle proposal index must be inside a positive sample count");
  }
  const radius = Math.sqrt((index + 0.5) / sampleCount);
  const angle = (index + 0.5) * GROUND_GLASS_APERTURE_GOLDEN_ANGLE_RAD;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
};

/**
 * Test-only nested subset of a single 64-point equal-area master sequence.
 * Sixteen uses every fourth master point; 32 uses every second point.
 */
export const groundGlassGoldenAngleNestedDiskProposalFrom64ForTesting = (
  index: number,
  sampleCount: GroundGlassApertureGatherNestedSampleCount,
): GroundGlassPixelAxis => {
  if (sampleCount !== 16 && sampleCount !== 32 && sampleCount !== 64) {
    throw new RangeError("Nested M5R sample count must be 16, 32, or 64");
  }
  if (!Number.isInteger(index) || index < 0 || index >= sampleCount) {
    throw new RangeError("Nested golden-angle proposal index must be inside the selected sample count");
  }
  const masterStride = GROUND_GLASS_APERTURE_MAX_SAMPLE_COUNT / sampleCount;
  return groundGlassGoldenAngleDiskProposal(index * masterStride, GROUND_GLASS_APERTURE_MAX_SAMPLE_COUNT);
};

const depthToleranceMm = (centerDistanceMm: number): number => Math.max(
  GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FLOOR_MM,
  centerDistanceMm * GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FRACTION,
);

const readPixel = (input: GroundGlassApertureGatherReferenceInput, x: number, y: number) => {
  const pixelIndex = y * input.source.widthPx + x;
  const offset = pixelIndex * 4;
  return {
    pixelIndex,
    colorOffset: offset,
    uvTop: [(x + 0.5) / input.source.widthPx, (y + 0.5) / input.source.heightPx] as const,
    color: [
      input.sourceRgba[offset]!,
      input.sourceRgba[offset + 1]!,
      input.sourceRgba[offset + 2]!,
    ] as const,
    physicalOffset: offset,
    signedCocMm: input.physicalRgba[offset]!,
    majorRadiusMm: input.physicalRgba[offset + 1]!,
    minorRadiusMm: input.physicalRgba[offset + 2]!,
    orientationRad: input.physicalRgba[offset + 3]! * Math.PI,
    validity: input.validity[pixelIndex]!,
    depth: input.depth[pixelIndex]!,
  };
};

const sampleAtUv = (
  input: GroundGlassApertureGatherReferenceInput,
  uTop: number,
  vTop: number,
) => {
  const clampedU = Math.fround(Math.min(1, Math.max(0, uTop)));
  const clampedV = Math.fround(Math.min(1, Math.max(0, vTop)));
  const [x, y] = nearestGroundGlassSourcePixelAtTopUv(clampedU, clampedV, input.source);
  const sample = readPixel(input, x, y);
  return {
    ...sample,
    uvTop: [clampedU, clampedV] as const,
    viewDistanceMm: groundGlassViewDistanceMmAtTopUv(
      clampedU,
      clampedV,
      sample.depth,
      input.inverseProjectionMatrix,
    ),
  };
};

const sampleAtSourcePixel = (
  input: GroundGlassApertureGatherReferenceInput,
  x: number,
  y: number,
  uvTop: GroundGlassPixelPoint,
) => {
  if (!Number.isInteger(x) || !Number.isInteger(y)
      || x < 0 || y < 0 || x >= input.source.widthPx || y >= input.source.heightPx) {
    throw new RangeError("Observed gather-center source provenance is outside the source image");
  }
  const sample = readPixel(input, x, y);
  return {
    ...sample,
    uvTop,
    viewDistanceMm: groundGlassViewDistanceMmAtTopUv(
      uvTop[0],
      uvTop[1],
      sample.depth,
      input.inverseProjectionMatrix,
    ),
  };
};

const mappedEllipseForSample = (
  input: GroundGlassApertureGatherReferenceInput,
  sample: ReturnType<typeof readPixel>,
): GroundGlassCappedPixelEllipse => capGroundGlassPixelEllipse(
  mapGroundGlassPhysicalEllipseToSourcePixels({
    majorRadiusMm: sample.majorRadiusMm,
    minorRadiusMm: sample.minorRadiusMm,
    orientationRad: sample.orientationRad,
    film: input.film,
    source: input.source,
  }),
  input.maximumRadiusPx,
);

const ellipseProposalOffset = (
  disk: GroundGlassPixelAxis,
  ellipse: GroundGlassCappedPixelEllipse,
): GroundGlassPixelAxis => [
  (ellipse.majorAxisPx[0] * disk[0] + ellipse.minorAxisPx[0] * disk[1]) * ellipse.clampScale,
  (ellipse.majorAxisPx[1] * disk[0] + ellipse.minorAxisPx[1] * disk[1]) * ellipse.clampScale,
];

const offsetTopUvByPixels = (
  centerUv: GroundGlassPixelPoint,
  offsetPx: GroundGlassPixelAxis,
  source: GroundGlassApertureDimensions,
): GroundGlassPixelPoint => [
  centerUv[0] + offsetPx[0] / source.widthPx,
  centerUv[1] + offsetPx[1] / source.heightPx,
];

const footprintMembership = (
  offsetPx: GroundGlassPixelAxis,
  ellipse: GroundGlassCappedPixelEllipse,
): number => {
  const majorX = ellipse.majorAxisPx[0] * ellipse.clampScale;
  const majorY = ellipse.majorAxisPx[1] * ellipse.clampScale;
  const minorX = ellipse.minorAxisPx[0] * ellipse.clampScale;
  const minorY = ellipse.minorAxisPx[1] * ellipse.clampScale;
  const determinant = majorX * minorY - majorY * minorX;
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= 1e-6) return 0;
  const localX = (offsetPx[0] * minorY - offsetPx[1] * minorX) / determinant;
  const localY = (offsetPx[1] * majorX - offsetPx[0] * majorY) / determinant;
  const radius = Math.hypot(localX, localY);
  const t = Math.min(1, Math.max(0, (radius - 1) / 0.02));
  const smooth = t * t * (3 - 2 * t);
  return 1 - smooth;
};

/**
 * Computes native-like far and near gather targets from top-origin readbacks.
 * Far proposals use the center pixel's physical ellipse; near proposals use
 * the renderer cap and test each sampled candidate against that candidate's
 * own capped physical ellipse, then retain the Phase F area coverage estimate.
 */
const referenceGroundGlassApertureGatherKernel = (
  input: GroundGlassApertureGatherReferenceInput,
  maximumSampleCount: number,
  proposalForIndex: (index: number, sampleCount: number) => GroundGlassPixelAxis =
    groundGlassGoldenAngleDiskProposal,
): GroundGlassApertureGatherReferenceResult => {
  const gatherPixelCount = assertInput(input, maximumSampleCount);
  const farRgba = new Float32Array(gatherPixelCount * 4);
  const nearRgba = new Float32Array(gatherPixelCount * 4);
  const gatherCenterSourceIds = new Int32Array(gatherPixelCount * 2);
  const nominalGatherCenterSourceIds = new Int32Array(gatherPixelCount * 2);
  const centerViewDistanceMm = new Float32Array(gatherPixelCount);
  const farUncappedMaximumRadiusPx = new Float32Array(gatherPixelCount);
  const farEffectiveMaximumRadiusPx = new Float32Array(gatherPixelCount);
  const farCapApplied = new Uint8Array(gatherPixelCount);
  const nearMaximumCandidateUncappedRadiusPx = new Float32Array(gatherPixelCount);
  const nearCandidateFootprintEvaluationCount = new Uint16Array(gatherPixelCount);
  const nearCandidateCapAppliedCount = new Uint16Array(gatherPixelCount);
  const nearCenterIsNear = new Uint8Array(gatherPixelCount);
  const nearEvaluatedProposalCount = new Uint16Array(gatherPixelCount);
  const nearAcceptedProposalCount = new Uint16Array(gatherPixelCount);
  const nearNonzeroMembershipCount = new Uint16Array(gatherPixelCount);
  const nearWeightSum = new Float32Array(gatherPixelCount);
  const nearCoverageMassByOutput = new Float32Array(gatherPixelCount);
  const nearEstimatedCoverage = new Float32Array(gatherPixelCount);
  const nearAcceptedAreaRatioMean = new Float32Array(gatherPixelCount);
  const nearAcceptedCompensationMaximum = new Float32Array(gatherPixelCount);
  let maximumFarRadius = 0;
  let farCappedCenterCount = 0;
  let maximumNearCandidateRadius = 0;
  let nearCappedCandidateCount = 0;

  for (let gatherY = 0; gatherY < input.gather.heightPx; gatherY += 1) {
    for (let gatherX = 0; gatherX < input.gather.widthPx; gatherX += 1) {
      const gatherIndex = gatherY * input.gather.widthPx + gatherX;
      const outputOffset = gatherIndex * 4;
      const nominalCenterUvTop: readonly [number, number] = [
        (gatherX + 0.5) / input.gather.widthPx,
        (gatherY + 0.5) / input.gather.heightPx,
      ];
      const [nominalCenterX, nominalCenterY] = nearestGroundGlassSourcePixelAtTopUv(
        nominalCenterUvTop[0], nominalCenterUvTop[1], input.source,
      );
      const centerUvTop: readonly [number, number] = input.observedGatherCenterSourceUvs === undefined
        ? nominalCenterUvTop
        : [
          input.observedGatherCenterSourceUvs[gatherIndex * 2]!,
          input.observedGatherCenterSourceUvs[gatherIndex * 2 + 1]!,
        ];
      const centerIdOffset = gatherIndex * 2;
      const centerSourceX = input.observedGatherCenterSourceIds?.[centerIdOffset] ?? nominalCenterX;
      const centerSourceY = input.observedGatherCenterSourceIds?.[centerIdOffset + 1] ?? nominalCenterY;
      const center = sampleAtSourcePixel(input, centerSourceX, centerSourceY, centerUvTop);
      const centerFar = center.validity === GROUND_GLASS_APERTURE_VALIDITY_CODE
        && center.signedCocMm > GROUND_GLASS_APERTURE_SIGN_EPSILON_MM;
      const centerNear = center.validity === GROUND_GLASS_APERTURE_VALIDITY_CODE
        && center.signedCocMm < -GROUND_GLASS_APERTURE_SIGN_EPSILON_MM;
      nearCenterIsNear[gatherIndex] = centerNear ? 1 : 0;
      const centerEllipse = mappedEllipseForSample(input, center);
      gatherCenterSourceIds[centerIdOffset] = centerSourceX;
      gatherCenterSourceIds[centerIdOffset + 1] = centerSourceY;
      nominalGatherCenterSourceIds[centerIdOffset] = nominalCenterX;
      nominalGatherCenterSourceIds[centerIdOffset + 1] = nominalCenterY;
      centerViewDistanceMm[gatherIndex] = center.viewDistanceMm;
      farUncappedMaximumRadiusPx[gatherIndex] = centerEllipse.uncappedMaximumRadiusPx;
      farEffectiveMaximumRadiusPx[gatherIndex] = centerEllipse.effectiveMaximumRadiusPx;
      farCapApplied[gatherIndex] = centerEllipse.capApplied ? 1 : 0;
      if (centerFar) {
        maximumFarRadius = Math.max(maximumFarRadius, centerEllipse.uncappedMaximumRadiusPx);
        if (centerEllipse.capApplied) farCappedCenterCount += 1;
      }

      const farAccumulated = [0, 0, 0];
      let farWeight = 0;
      if (centerFar) {
        farAccumulated[0] = center.color[0];
        farAccumulated[1] = center.color[1];
        farAccumulated[2] = center.color[2];
        farWeight = 1;
      }

      const nearAccumulated = [0, 0, 0];
      let nearWeight = 0;
      let nearCoverageMass = 0;
      let acceptedAreaRatioSum = 0;
      let acceptedProposalCount = 0;
      if (centerNear) {
        nearAccumulated[0] = center.color[0];
        nearAccumulated[1] = center.color[1];
        nearAccumulated[2] = center.color[2];
        nearWeight = 1;
      }

      const activeSamples = Math.max(input.sampleCount, 1);
      for (let sampleIndex = 0; sampleIndex < input.sampleCount; sampleIndex += 1) {
        const disk = proposalForIndex(sampleIndex, activeSamples);

        const farOffset = ellipseProposalOffset(disk, centerEllipse);
        const farSampleUv = offsetTopUvByPixels(centerUvTop, farOffset, input.source);
        const farSample = sampleAtUv(input, farSampleUv[0], farSampleUv[1]);
        const farSampleValid = farSample.validity === GROUND_GLASS_APERTURE_VALIDITY_CODE
          && farSample.depth < 1;
        const farSampleAccepted = centerFar
          && farSampleValid
          && farSample.signedCocMm >= -GROUND_GLASS_APERTURE_SIGN_EPSILON_MM
          && farSample.viewDistanceMm >= center.viewDistanceMm - depthToleranceMm(center.viewDistanceMm);
        if (farSampleAccepted) {
          farAccumulated[0] += farSample.color[0];
          farAccumulated[1] += farSample.color[1];
          farAccumulated[2] += farSample.color[2];
          farWeight += 1;
        }

        const nearProposalOffset: GroundGlassPixelAxis = [
          disk[0] * input.maximumRadiusPx,
          disk[1] * input.maximumRadiusPx,
        ];
        const nearSampleUv = offsetTopUvByPixels(centerUvTop, nearProposalOffset, input.source);
        const nearSample = sampleAtUv(input, nearSampleUv[0], nearSampleUv[1]);
        const candidateEllipse = mappedEllipseForSample(input, nearSample);
        nearEvaluatedProposalCount[gatherIndex] += 1;
        nearCandidateFootprintEvaluationCount[gatherIndex] += 1;
        nearMaximumCandidateUncappedRadiusPx[gatherIndex] = Math.max(
          nearMaximumCandidateUncappedRadiusPx[gatherIndex]!,
          candidateEllipse.uncappedMaximumRadiusPx,
        );
        maximumNearCandidateRadius = Math.max(maximumNearCandidateRadius, candidateEllipse.uncappedMaximumRadiusPx);
        if (candidateEllipse.capApplied) {
          nearCandidateCapAppliedCount[gatherIndex] += 1;
          nearCappedCandidateCount += 1;
        }
        const member = footprintMembership(nearProposalOffset, candidateEllipse);
        const behindNearCenter = !centerNear
          || nearSample.viewDistanceMm <= center.viewDistanceMm + depthToleranceMm(center.viewDistanceMm);
        const nearSampleValid = nearSample.validity === GROUND_GLASS_APERTURE_VALIDITY_CODE
          && nearSample.depth < 1;
        const nearSampleAccepted = nearSampleValid
          && nearSample.signedCocMm < -GROUND_GLASS_APERTURE_SIGN_EPSILON_MM
          && member > 0
          && behindNearCenter;
        if (member > 0) nearNonzeroMembershipCount[gatherIndex] += 1;
        if (nearSampleAccepted) nearAcceptedProposalCount[gatherIndex] += 1;
        const nearSampleWeight = nearSampleAccepted ? member : 0;
        if (nearSampleWeight > 0) {
          nearAccumulated[0] += nearSample.color[0] * nearSampleWeight;
          nearAccumulated[1] += nearSample.color[1] * nearSampleWeight;
          nearAccumulated[2] += nearSample.color[2] * nearSampleWeight;
          nearWeight += nearSampleWeight;
          const scaledMajorX = candidateEllipse.majorAxisPx[0] * candidateEllipse.clampScale;
          const scaledMajorY = candidateEllipse.majorAxisPx[1] * candidateEllipse.clampScale;
          const scaledMinorX = candidateEllipse.minorAxisPx[0] * candidateEllipse.clampScale;
          const scaledMinorY = candidateEllipse.minorAxisPx[1] * candidateEllipse.clampScale;
          const area = Math.abs(scaledMajorX * scaledMinorY - scaledMajorY * scaledMinorX);
          const areaRatio = Math.min(1, Math.max(0,
            area / Math.max(input.maximumRadiusPx * input.maximumRadiusPx, 1e-6),
          ));
          const areaFloor = 1 / activeSamples;
          const compensation = Math.min(activeSamples, 1 / Math.max(areaRatio, areaFloor));
          acceptedAreaRatioSum += areaRatio;
          acceptedProposalCount += 1;
          nearAcceptedCompensationMaximum[gatherIndex] = Math.max(
            nearAcceptedCompensationMaximum[gatherIndex]!,
            compensation,
          );
          nearCoverageMass += nearSampleWeight * compensation;
        }
      }

      const farColor = farWeight > 1e-6
        ? farAccumulated.map((value) => value / farWeight)
        : [...center.color];
      farRgba.set([farColor[0]!, farColor[1]!, farColor[2]!, 1], outputOffset);
      const nearColor = nearWeight > 1e-6
        ? nearAccumulated.map((value) => value / nearWeight)
        : [0, 0, 0];
      const nearCoverage = centerNear
        ? 1
        : Math.min(1, Math.max(0, 1 - Math.exp(-nearCoverageMass / activeSamples)));
      nearRgba.set([nearColor[0]!, nearColor[1]!, nearColor[2]!, nearCoverage], outputOffset);
      nearWeightSum[gatherIndex] = nearWeight;
      nearCoverageMassByOutput[gatherIndex] = nearCoverageMass;
      nearEstimatedCoverage[gatherIndex] = Math.min(
        1,
        Math.max(0, 1 - Math.exp(-nearCoverageMass / activeSamples)),
      );
      nearAcceptedAreaRatioMean[gatherIndex] = acceptedProposalCount > 0
        ? acceptedAreaRatioSum / acceptedProposalCount
        : 0;
    }
  }

  return {
    farRgba,
    nearRgba,
    gatherCenterSourceIds,
    nominalGatherCenterSourceIds,
    centerViewDistanceMm,
    farUncappedMaximumRadiusPx,
    farEffectiveMaximumRadiusPx,
    farCapApplied,
    nearMaximumCandidateUncappedRadiusPx,
    nearCandidateFootprintEvaluationCount,
    nearCandidateCapAppliedCount,
    nearCenterIsNear,
    nearEvaluatedProposalCount,
    nearAcceptedProposalCount,
    nearNonzeroMembershipCount,
    nearWeightSum,
    nearCoverageMass: nearCoverageMassByOutput,
    nearEstimatedCoverage,
    nearAcceptedAreaRatioMean,
    nearAcceptedCompensationMaximum,
    summary: {
      maximumFarUncappedRadiusPx: maximumFarRadius,
      farCappedCenterCount,
      maximumNearCandidateUncappedRadiusPx: maximumNearCandidateRadius,
      nearCappedCandidateCount,
    },
  };
};

/**
 * Existing native-range CPU oracle. Its accepted input range remains limited
 * to the TSL maximum of 64 samples.
 */
export const referenceGroundGlassApertureGather = (
  input: GroundGlassApertureGatherReferenceInput,
): GroundGlassApertureGatherReferenceResult =>
  referenceGroundGlassApertureGatherKernel(input, GROUND_GLASS_APERTURE_MAX_SAMPLE_COUNT);

/**
 * Diagnostic CPU-only convergence oracle for predeclared 128/256-sample runs.
 * It shares the native-range reference kernel and does not raise the TSL limit.
 */
export const referenceGroundGlassApertureGatherDiagnostic = (
  input: GroundGlassApertureGatherDiagnosticInput,
): GroundGlassApertureGatherReferenceResult => {
  if (input.sampleCount !== 128 && input.sampleCount !== 256) {
    throw new RangeError("Aperture gather diagnostic sample count must be 128 or 256");
  }
  return referenceGroundGlassApertureGatherKernel(input, 256);
};

/**
 * CPU-only test variant for nested sample-count comparisons. Proposal indices
 * are selected from one 64-point master, while the shared gather kernel keeps
 * the requested count for coverage normalization and all physical gates.
 */
export const referenceGroundGlassApertureGatherNestedGoldenAngle64ForTesting = (
  input: GroundGlassApertureGatherReferenceInput & Readonly<{
    sampleCount: GroundGlassApertureGatherNestedSampleCount;
  }>,
): GroundGlassApertureGatherReferenceResult =>
  referenceGroundGlassApertureGatherKernel(
    input,
    GROUND_GLASS_APERTURE_MAX_SAMPLE_COUNT,
    (index) => groundGlassGoldenAngleNestedDiskProposalFrom64ForTesting(index, input.sampleCount),
  );
