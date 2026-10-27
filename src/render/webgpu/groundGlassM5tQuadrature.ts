/**
 * M5T development-only CPU references for the conditional Far aperture
 * integral. This module has no React, Three.js runtime, GPU, or browser API
 * dependency. It shares only the established physical ellipse, top-origin
 * nearest-texel, depth reconstruction, and Far eligibility contracts.
 */
import {
  GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FLOOR_MM,
  GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FRACTION,
  GROUND_GLASS_APERTURE_SIGN_EPSILON_MM,
  GROUND_GLASS_APERTURE_VALIDITY_CODE,
  capGroundGlassPixelEllipse,
  groundGlassViewDistanceMmAtTopUv,
  mapGroundGlassPhysicalEllipseToSourcePixels,
  nearestGroundGlassSourcePixelAtTopUv,
  type GroundGlassApertureDimensions,
  type GroundGlassFilmDimensionsMm,
} from "./groundGlassApertureGatherReference";

export const GROUND_GLASS_M5T_QUADRATURE_REVISION = "ground-glass-m5t-adaptive-quadtree-v1" as const;
export const GROUND_GLASS_M5T_QUADRATURE_RESOLUTIONS = [32, 64, 128, 256] as const;
export type GroundGlassM5tQuadratureResolution = (typeof GROUND_GLASS_M5T_QUADRATURE_RESOLUTIONS)[number];
export const GROUND_GLASS_M5T_MAX_ADAPTIVE_DEPTH = 12;
export const GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL = 250_000;
export const GROUND_GLASS_M5T_MAX_PIXELS_PER_STUDY = 128;
export const GROUND_GLASS_M5T_FIXED_GRID_RESOLUTION = 512;
export const GROUND_GLASS_M5T_REFERENCE_RMSE_LIMIT = 0.001;
export const GROUND_GLASS_M5T_REFERENCE_MAXIMUM_CHANNEL_ERROR = 0.01;
export const GROUND_GLASS_M5T_RELATIVE_AREA_STABILITY_LIMIT = 0.005;
export const GROUND_GLASS_M5T_UNRESOLVED_AREA_FRACTION_LIMIT = 0.005;

export type GroundGlassM5tInputFingerprints = Readonly<{
  sourceColor: string;
  depth: string;
  physical: string;
  validity: string;
}>;

/** Native readbacks normalized to top-origin source rows. */
export type GroundGlassM5tFarReferenceInput = Readonly<{
  source: GroundGlassApertureDimensions;
  gather: GroundGlassApertureDimensions;
  film: GroundGlassFilmDimensionsMm;
  sourceRgba: Float32Array;
  physicalRgba: Float32Array;
  validity: Uint8Array;
  depth: Float32Array;
  observedGatherCenterSourceIds: ArrayLike<number>;
  observedGatherCenterSourceUvs: ArrayLike<number>;
  inverseProjectionMatrix: ArrayLike<number>;
  maximumRadiusPx: number;
  inputFingerprints: GroundGlassM5tInputFingerprints;
}>;

export type GroundGlassM5tCellClass =
  | "smooth-interior"
  | "disk-boundary"
  | "source-texel-boundary"
  | "eligibility-boundary"
  | "unresolved-cell";

export type GroundGlassM5tFarPixelEstimate = Readonly<{
  gatherPixelId: number;
  centerSourceId: number;
  centerEligibleFar: boolean;
  uncappedMaximumRadiusPx: number | null;
  effectiveMaximumRadiusPx: number | null;
  capApplied: boolean | null;
  acceptedAreaEstimate: number;
  acceptedColorAreaIntegralRgb: readonly [number, number, number];
  /** Null means no positive accepted area was established; it is never RGB zero. */
  conditionalMeanRgb: readonly [number, number, number] | null;
  estimatedAreaError: number;
  estimatedColorErrorRgb: readonly [number, number, number];
  unresolvedArea: number;
  unresolvedAreaFraction: number;
  unresolvedCellCount: number;
  evaluatedPoints: number;
  refinementDepth: number;
  cellClassCounts: Readonly<Record<GroundGlassM5tCellClass, number>>;
  classification: "estimated" | "empty-accepted-area" | "invalid-center" | "evaluation-budget-exceeded";
}>;

export type GroundGlassM5tQuadratureRun = Readonly<{
  algorithm: typeof GROUND_GLASS_M5T_QUADRATURE_REVISION;
  method: "adaptive-quadtree-midpoint";
  inputFingerprints: GroundGlassM5tInputFingerprints;
  initialResolution: GroundGlassM5tQuadratureResolution;
  maximumDepth: number;
  evaluationBudgetPerPixel: number;
  evaluatedPoints: number;
  elapsedMs: number;
  pixels: readonly GroundGlassM5tFarPixelEstimate[];
}>;

export type GroundGlassM5tFixedGridRun = Readonly<{
  algorithm: "ground-glass-m5t-fixed-midpoint-v1";
  method: "independent-square-grid-midpoint";
  inputFingerprints: GroundGlassM5tInputFingerprints;
  resolution: typeof GROUND_GLASS_M5T_FIXED_GRID_RESOLUTION;
  evaluationBudgetPerPixel: number;
  evaluatedPoints: number;
  elapsedMs: number;
  pixels: readonly GroundGlassM5tFarPixelEstimate[];
}>;

export type GroundGlassM5tRgbMetrics = Readonly<{
  status: "measured" | "unavailable";
  valueCount: number;
  rmse: number | null;
  maximumChannelError: number | null;
  maximumErrorIndex: number | null;
}>;

export type GroundGlassM5tPixelComparison = Readonly<{
  gatherPixelId: number;
  acceptedAreaAbsoluteError: number | null;
  acceptedAreaRelativeError: number | null;
  rgb: GroundGlassM5tRgbMetrics;
}>;

export type GroundGlassM5tReferenceEvidence = Readonly<{
  classification:
    | "converged-with-independent-support"
    | "converging-but-unresolved"
    | "budget-limited-unresolved"
    | "discontinuity-limited"
    | "quadrature-method-disagreement"
    | "insufficient-support"
    | "invalid-comparison";
  inputProvenance: "matched" | "mismatched" | "incomplete";
  support: Readonly<{ comparedPixelCount: number; requiredPixelCount: number; adequate: boolean }>;
  budgetExceededPixelCount: number;
  adaptiveRefinement: GroundGlassM5tRgbMetrics;
  independentFixedGrid: GroundGlassM5tRgbMetrics;
  acceptedAreaStable: boolean;
  unresolvedAreaAcceptable: boolean;
  analyticControlsPassed: boolean;
  m5qPromotionAllowed: false;
  reasons: readonly string[];
}>;

type PixelContext = Readonly<{
  gatherPixelId: number;
  centerSourceId: number;
  centerUv: readonly [number, number];
  centerRgb: readonly [number, number, number];
  centerViewDistanceMm: number;
  centerEligibleFar: boolean;
  uncappedMaximumRadiusPx: number;
  effectiveMaximumRadiusPx: number;
  capApplied: boolean;
  majorAxisPx: readonly [number, number];
  minorAxisPx: readonly [number, number];
  clampScale: number;
}>;

type PointValue = Readonly<{
  insideDisk: boolean;
  accepted: boolean;
  sourcePixelId: number;
  rgb: readonly [number, number, number];
  viewDistanceMm: number;
}>;

type Cell = Readonly<{ minX: number; minY: number; size: number; depth: number }>;
type CellNode = {
  cell: Cell;
  areaEstimate: number;
  colorArea: [number, number, number];
  needsRefinement: boolean;
  unresolved: boolean;
  children: CellNode[] | null;
};
type Accumulator = {
  acceptedArea: number;
  colorArea: [number, number, number];
  areaError: number;
  colorError: [number, number, number];
  unresolvedArea: number;
  unresolvedCellCount: number;
  evaluations: number;
  maximumDepth: number;
  budgetExceeded: boolean;
  counts: Record<GroundGlassM5tCellClass, number>;
};

const zeroCounts = (): Record<GroundGlassM5tCellClass, number> => ({
  "smooth-interior": 0,
  "disk-boundary": 0,
  "source-texel-boundary": 0,
  "eligibility-boundary": 0,
  "unresolved-cell": 0,
});

const validDimensions = (value: GroundGlassApertureDimensions): boolean =>
  Number.isSafeInteger(value.widthPx) && value.widthPx > 0
  && Number.isSafeInteger(value.heightPx) && value.heightPx > 0;

const assertFiniteArray = (values: ArrayLike<number>, label: string): void => {
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) throw new RangeError(`${label} must contain finite values`);
  }
};

const validateInput = (input: GroundGlassM5tFarReferenceInput): void => {
  const sourceCount = input.source.widthPx * input.source.heightPx;
  const gatherCount = input.gather.widthPx * input.gather.heightPx;
  if (!validDimensions(input.source) || !validDimensions(input.gather)
      || !Number.isSafeInteger(sourceCount) || !Number.isSafeInteger(gatherCount)
      || input.sourceRgba.length !== sourceCount * 4
      || input.physicalRgba.length !== sourceCount * 4
      || input.validity.length !== sourceCount
      || input.depth.length !== sourceCount
      || input.observedGatherCenterSourceIds.length !== gatherCount * 2
      || input.observedGatherCenterSourceUvs.length !== gatherCount * 2
      || input.inverseProjectionMatrix.length !== 16
      || !Number.isFinite(input.film.widthMm) || input.film.widthMm <= 0
      || !Number.isFinite(input.film.heightMm) || input.film.heightMm <= 0
      || !Number.isFinite(input.maximumRadiusPx) || input.maximumRadiusPx < 0) {
    throw new RangeError("M5T readbacks, dimensions, film, or radius cap are inconsistent");
  }
  const fingerprints = Object.values(input.inputFingerprints);
  if (fingerprints.some((value) => typeof value !== "string" || value.trim().length === 0)) {
    throw new RangeError("M5T input fingerprints must be complete non-empty strings");
  }
  assertFiniteArray(input.sourceRgba, "M5T source color");
  assertFiniteArray(input.physicalRgba, "M5T physical CoC");
  assertFiniteArray(input.depth, "M5T depth");
  assertFiniteArray(input.inverseProjectionMatrix, "M5T inverse projection");
  assertFiniteArray(input.observedGatherCenterSourceIds, "M5T observed center identity");
  assertFiniteArray(input.observedGatherCenterSourceUvs, "M5T observed center UV");
  for (let index = 0; index < input.depth.length; index += 1) {
    if (input.depth[index]! < 0 || input.depth[index]! > 1) {
      throw new RangeError("M5T depth readback must use normalized [0,1] values");
    }
  }
};

const rgbAt = (input: GroundGlassM5tFarReferenceInput, sourcePixelId: number): readonly [number, number, number] => {
  const offset = sourcePixelId * 4;
  return [input.sourceRgba[offset]!, input.sourceRgba[offset + 1]!, input.sourceRgba[offset + 2]!];
};

const contextAt = (
  input: GroundGlassM5tFarReferenceInput,
  gatherPixelId: number,
): PixelContext | null => {
  const x = input.observedGatherCenterSourceIds[gatherPixelId * 2]!;
  const y = input.observedGatherCenterSourceIds[gatherPixelId * 2 + 1]!;
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)
      || x < 0 || y < 0 || x >= input.source.widthPx || y >= input.source.heightPx) {
    throw new RangeError("M5T observed gather-center identity is outside the source image");
  }
  const centerSourceId = y * input.source.widthPx + x;
  const centerUv = [input.observedGatherCenterSourceUvs[gatherPixelId * 2]!,
    input.observedGatherCenterSourceUvs[gatherPixelId * 2 + 1]!] as const;
  if (!centerUv.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
    throw new RangeError("M5T observed gather-center UV must be finite and in [0,1]");
  }
  const offset = centerSourceId * 4;
  const centerRgb = rgbAt(input, centerSourceId);
  const centerViewDistanceMm = groundGlassViewDistanceMmAtTopUv(
    centerUv[0], centerUv[1], input.depth[centerSourceId]!, input.inverseProjectionMatrix,
  );
  const centerEligibleFar = input.validity[centerSourceId] === GROUND_GLASS_APERTURE_VALIDITY_CODE
    && input.physicalRgba[offset]! > GROUND_GLASS_APERTURE_SIGN_EPSILON_MM;
  if (!centerEligibleFar) return null;
  const ellipse = capGroundGlassPixelEllipse(mapGroundGlassPhysicalEllipseToSourcePixels({
    majorRadiusMm: input.physicalRgba[offset + 1]!,
    minorRadiusMm: input.physicalRgba[offset + 2]!,
    orientationRad: input.physicalRgba[offset + 3]! * Math.PI,
    film: input.film,
    source: input.source,
  }), input.maximumRadiusPx);
  return {
    gatherPixelId,
    centerSourceId,
    centerUv,
    centerRgb,
    centerViewDistanceMm,
    centerEligibleFar,
    uncappedMaximumRadiusPx: ellipse.uncappedMaximumRadiusPx,
    effectiveMaximumRadiusPx: ellipse.effectiveMaximumRadiusPx,
    capApplied: ellipse.capApplied,
    majorAxisPx: ellipse.majorAxisPx,
    minorAxisPx: ellipse.minorAxisPx,
    clampScale: ellipse.clampScale,
  };
};

const toleranceMm = (centerDistanceMm: number): number => Math.max(
  GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FLOOR_MM,
  centerDistanceMm * GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FRACTION,
);

const uvAt = (
  input: GroundGlassM5tFarReferenceInput,
  context: PixelContext,
  x: number,
  y: number,
): readonly [number, number] => {
  const offsetX = (context.majorAxisPx[0] * x + context.minorAxisPx[0] * y) * context.clampScale;
  const offsetY = (context.majorAxisPx[1] * x + context.minorAxisPx[1] * y) * context.clampScale;
  return [
    Math.fround(Math.min(1, Math.max(0, context.centerUv[0] + offsetX / input.source.widthPx))),
    Math.fround(Math.min(1, Math.max(0, context.centerUv[1] + offsetY / input.source.heightPx))),
  ];
};

const evaluatePoint = (
  input: GroundGlassM5tFarReferenceInput,
  context: PixelContext,
  x: number,
  y: number,
): PointValue => {
  const insideDisk = x * x + y * y <= 1;
  if (!insideDisk) return { insideDisk, accepted: false, sourcePixelId: -1, rgb: [0, 0, 0], viewDistanceMm: 0 };
  const [uTop, vTop] = uvAt(input, context, x, y);
  const [sourceX, sourceY] = nearestGroundGlassSourcePixelAtTopUv(uTop, vTop, input.source);
  const sourcePixelId = sourceY * input.source.widthPx + sourceX;
  const offset = sourcePixelId * 4;
  const depth = input.depth[sourcePixelId]!;
  const viewDistanceMm = groundGlassViewDistanceMmAtTopUv(
    uTop, vTop, depth, input.inverseProjectionMatrix,
  );
  const signedCocMm = input.physicalRgba[offset]!;
  const accepted = input.validity[sourcePixelId] === GROUND_GLASS_APERTURE_VALIDITY_CODE
    && depth < 1
    && signedCocMm >= -GROUND_GLASS_APERTURE_SIGN_EPSILON_MM
    && viewDistanceMm >= context.centerViewDistanceMm - toleranceMm(context.centerViewDistanceMm);
  return { insideDisk, accepted, sourcePixelId, rgb: rgbAt(input, sourcePixelId), viewDistanceMm };
};

const cellRelationToDisk = (cell: Cell): "outside" | "inside" | "boundary" => {
  const maxX = cell.minX + cell.size;
  const maxY = cell.minY + cell.size;
  const nearestX = cell.minX > 0 ? cell.minX : (maxX < 0 ? maxX : 0);
  const nearestY = cell.minY > 0 ? cell.minY : (maxY < 0 ? maxY : 0);
  const minimumRadiusSquared = nearestX * nearestX + nearestY * nearestY;
  if (minimumRadiusSquared >= 1) return "outside";
  const farthestRadiusSquared = Math.max(
    cell.minX * cell.minX + cell.minY * cell.minY,
    cell.minX * cell.minX + maxY * maxY,
    maxX * maxX + cell.minY * cell.minY,
    maxX * maxX + maxY * maxY,
  );
  return farthestRadiusSquared <= 1 ? "inside" : "boundary";
};

const cornersOf = (cell: Cell): readonly (readonly [number, number])[] => [
  [cell.minX, cell.minY],
  [cell.minX + cell.size, cell.minY],
  [cell.minX, cell.minY + cell.size],
  [cell.minX + cell.size, cell.minY + cell.size],
];

const cellCrossesSourceTexel = (
  input: GroundGlassM5tFarReferenceInput,
  context: PixelContext,
  cell: Cell,
): boolean => {
  const mapped = cornersOf(cell).map(([x, y]) => uvAt(input, context, x, y));
  for (const [axis, dimension] of [[0, input.source.widthPx], [1, input.source.heightPx]] as const) {
    const minimum = Math.min(...mapped.map((point) => point[axis])) * dimension;
    const maximum = Math.max(...mapped.map((point) => point[axis])) * dimension;
    if (maximum - minimum <= 1e-9) continue;
    const lowIndex = Math.min(dimension - 1, Math.floor(minimum + 1e-9));
    const highIndex = Math.min(dimension - 1, Math.floor(maximum - 1e-9));
    if (lowIndex !== highIndex) return true;
  }
  return false;
};

const viewDistanceDependsOnUv = (input: GroundGlassM5tFarReferenceInput): boolean =>
  input.inverseProjectionMatrix[2] !== 0
  || input.inverseProjectionMatrix[6] !== 0
  || input.inverseProjectionMatrix[3] !== 0
  || input.inverseProjectionMatrix[7] !== 0;

const addRgb = (
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): [number, number, number] => [left[0] + right[0], left[1] + right[1], left[2] + right[2]];

const rgbAreaAt = (value: PointValue, area: number): [number, number, number] =>
  value.insideDisk && value.accepted
    ? [value.rgb[0] * area, value.rgb[1] * area, value.rgb[2] * area]
    : [0, 0, 0];

const createAccumulator = (): Accumulator => ({
  acceptedArea: 0,
  colorArea: [0, 0, 0],
  areaError: 0,
  colorError: [0, 0, 0],
  unresolvedArea: 0,
  unresolvedCellCount: 0,
  evaluations: 0,
  maximumDepth: 0,
  budgetExceeded: false,
  counts: zeroCounts(),
});

const invalidPixelResult = (gatherPixelId: number, centerSourceId: number): GroundGlassM5tFarPixelEstimate => ({
  gatherPixelId,
  centerSourceId,
  centerEligibleFar: false,
  uncappedMaximumRadiusPx: null,
  effectiveMaximumRadiusPx: null,
  capApplied: null,
  acceptedAreaEstimate: 0,
  acceptedColorAreaIntegralRgb: [0, 0, 0],
  conditionalMeanRgb: null,
  estimatedAreaError: 0,
  estimatedColorErrorRgb: [0, 0, 0],
  unresolvedArea: 0,
  unresolvedAreaFraction: 0,
  unresolvedCellCount: 0,
  evaluatedPoints: 0,
  refinementDepth: 0,
  cellClassCounts: zeroCounts(),
  classification: "invalid-center",
});

const makePixelResult = (
  context: PixelContext,
  accumulator: Accumulator,
  classificationOverride?: GroundGlassM5tFarPixelEstimate["classification"],
): GroundGlassM5tFarPixelEstimate => ({
  gatherPixelId: context.gatherPixelId,
  centerSourceId: context.centerSourceId,
  centerEligibleFar: context.centerEligibleFar,
  uncappedMaximumRadiusPx: context.uncappedMaximumRadiusPx,
  effectiveMaximumRadiusPx: context.effectiveMaximumRadiusPx,
  capApplied: context.capApplied,
  acceptedAreaEstimate: accumulator.acceptedArea,
  acceptedColorAreaIntegralRgb: accumulator.colorArea,
  conditionalMeanRgb: accumulator.acceptedArea > 0
    ? [accumulator.colorArea[0] / accumulator.acceptedArea,
      accumulator.colorArea[1] / accumulator.acceptedArea,
      accumulator.colorArea[2] / accumulator.acceptedArea]
    : null,
  estimatedAreaError: accumulator.areaError,
  estimatedColorErrorRgb: accumulator.colorError,
  unresolvedArea: accumulator.unresolvedArea,
  unresolvedAreaFraction: accumulator.unresolvedArea / Math.PI,
  unresolvedCellCount: accumulator.unresolvedCellCount,
  evaluatedPoints: accumulator.evaluations,
  refinementDepth: accumulator.maximumDepth,
  cellClassCounts: accumulator.counts,
  classification: classificationOverride
    ?? (accumulator.acceptedArea > 0 ? "estimated" : "empty-accepted-area"),
});

const validateRunArgs = (input: Readonly<{
  referenceInput: GroundGlassM5tFarReferenceInput;
  selectedGatherPixelIds: readonly number[];
  initialResolution: GroundGlassM5tQuadratureResolution;
  maximumDepth?: number;
  maxEvaluationsPerPixel?: number;
}>): Readonly<{ maximumDepth: number; maxEvaluationsPerPixel: number }> => {
  validateInput(input.referenceInput);
  const gatherCount = input.referenceInput.gather.widthPx * input.referenceInput.gather.heightPx;
  if (!input.selectedGatherPixelIds.length || input.selectedGatherPixelIds.length > GROUND_GLASS_M5T_MAX_PIXELS_PER_STUDY
      || input.selectedGatherPixelIds.some((id) => !Number.isSafeInteger(id) || id < 0 || id >= gatherCount)
      || new Set(input.selectedGatherPixelIds).size !== input.selectedGatherPixelIds.length) {
    throw new RangeError("M5T requires unique in-range gather pixels, capped at 128 per study");
  }
  if (!(GROUND_GLASS_M5T_QUADRATURE_RESOLUTIONS as readonly number[]).includes(input.initialResolution)) {
    throw new RangeError("M5T initial resolution must be 32, 64, 128, or 256");
  }
  const maximumDepth = input.maximumDepth ?? GROUND_GLASS_M5T_MAX_ADAPTIVE_DEPTH;
  const maxEvaluationsPerPixel = input.maxEvaluationsPerPixel ?? GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL;
  if (!Number.isSafeInteger(maximumDepth) || maximumDepth < 0 || maximumDepth > GROUND_GLASS_M5T_MAX_ADAPTIVE_DEPTH
      || !Number.isSafeInteger(maxEvaluationsPerPixel) || maxEvaluationsPerPixel < 1
      || maxEvaluationsPerPixel > GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL) {
    throw new RangeError("M5T maximum depth or per-pixel evaluation budget exceeds the declared hard limit");
  }
  return { maximumDepth, maxEvaluationsPerPixel };
};

/**
 * Deterministic adaptive quadtree midpoint integration over [-1,1]^2 with
 * explicit unit-disk, texel, and sample-eligibility boundary refinement.
 * Reported differences are convergence indicators, not certified error bounds.
 */
export const runGroundGlassM5tAdaptiveQuadrature = (input: Readonly<{
  referenceInput: GroundGlassM5tFarReferenceInput;
  selectedGatherPixelIds: readonly number[];
  initialResolution: GroundGlassM5tQuadratureResolution;
  maximumDepth?: number;
  maxEvaluationsPerPixel?: number;
}>): GroundGlassM5tQuadratureRun => {
  const { maximumDepth, maxEvaluationsPerPixel } = validateRunArgs(input);
  const startedAt = Date.now();
  const pixels: GroundGlassM5tFarPixelEstimate[] = [];
  let runEvaluations = 0;
  for (const gatherPixelId of input.selectedGatherPixelIds) {
    const centerX = input.referenceInput.observedGatherCenterSourceIds[gatherPixelId * 2]!;
    const centerY = input.referenceInput.observedGatherCenterSourceIds[gatherPixelId * 2 + 1]!;
    const centerSourceId = Number.isSafeInteger(centerX) && Number.isSafeInteger(centerY)
      ? centerY * input.referenceInput.source.widthPx + centerX : -1;
    const context = contextAt(input.referenceInput, gatherPixelId);
    if (!context) {
      pixels.push(invalidPixelResult(gatherPixelId, centerSourceId));
      continue;
    }
    const accumulator = createAccumulator();
    const resolution = input.initialResolution;
    const cellSize = 2 / resolution;
    const uvDependentDepth = viewDistanceDependsOnUv(input.referenceInput);
    let areaError = 0;
    const colorError: [number, number, number] = [0, 0, 0];

    const buildCell = (cell: Cell): CellNode => {
      const relation = cellRelationToDisk(cell);
      const cellArea = cell.size * cell.size;
      if (relation === "outside") return {
        cell, areaEstimate: 0, colorArea: [0, 0, 0], needsRefinement: false,
        unresolved: false, children: null,
      };
      if (accumulator.evaluations >= maxEvaluationsPerPixel) {
        accumulator.budgetExceeded = true;
        accumulator.counts["unresolved-cell"] += 1;
        return {
          cell, areaEstimate: 0, colorArea: [0, 0, 0], needsRefinement: true,
          unresolved: true, children: null,
        };
      }
      const centerX = cell.minX + cell.size / 2;
      const centerY = cell.minY + cell.size / 2;
      const centerValue = evaluatePoint(input.referenceInput, context, centerX, centerY);
      accumulator.evaluations += 1;
      accumulator.maximumDepth = Math.max(accumulator.maximumDepth, cell.depth);
      const parentArea = centerValue.insideDisk && centerValue.accepted ? cellArea : 0;
      const parentColor = rgbAreaAt(centerValue, cellArea);
      const crossesTexel = cellCrossesSourceTexel(input.referenceInput, context, cell);
      let eligibilityBoundary = false;
      let probeBudgetUnavailable = false;
      if (uvDependentDepth && relation === "inside" && !crossesTexel) {
        const depth = input.referenceInput.depth[centerValue.sourcePixelId]!;
        const limit = context.centerViewDistanceMm - toleranceMm(context.centerViewDistanceMm);
        const corners = cornersOf(cell);
        if (accumulator.evaluations + corners.length > maxEvaluationsPerPixel) {
          accumulator.budgetExceeded = true;
          eligibilityBoundary = true;
          probeBudgetUnavailable = true;
        } else {
          const distances = corners.map(([x, y]) => {
            const [uTop, vTop] = uvAt(input.referenceInput, context, x, y);
            return groundGlassViewDistanceMmAtTopUv(uTop, vTop, depth, input.referenceInput.inverseProjectionMatrix);
          });
          accumulator.evaluations += corners.length;
          const centerDecision = centerValue.viewDistanceMm >= limit;
          eligibilityBoundary = distances.some((distance) => (distance >= limit) !== centerDecision);
        }
      }
      const needsRefinement = relation === "boundary" || crossesTexel || eligibilityBoundary;
      if (!needsRefinement) {
        accumulator.counts["smooth-interior"] += 1;
        return { cell, areaEstimate: parentArea, colorArea: parentColor,
          needsRefinement: false, unresolved: false, children: null };
      }
      if (relation === "boundary") accumulator.counts["disk-boundary"] += 1;
      if (crossesTexel) accumulator.counts["source-texel-boundary"] += 1;
      if (eligibilityBoundary) accumulator.counts["eligibility-boundary"] += 1;
      const unresolved = probeBudgetUnavailable;
      if (unresolved) {
        accumulator.counts["unresolved-cell"] += 1;
      }
      return { cell, areaEstimate: parentArea, colorArea: parentColor,
        needsRefinement, unresolved, children: null };
    };

    const roots: CellNode[] = [];
    for (let row = 0; row < resolution; row += 1) {
      for (let column = 0; column < resolution; column += 1) {
        roots.push(buildCell({
          minX: -1 + column * cellSize,
          minY: -1 + row * cellSize,
          size: cellSize,
          depth: 0,
        }));
      }
    }

    let frontier = roots;
    while (frontier.length) {
      const nextFrontier: CellNode[] = [];
      for (const node of frontier) {
        if (!node.needsRefinement || node.unresolved) continue;
        if (node.cell.depth >= maximumDepth) {
          node.unresolved = true;
          accumulator.counts["unresolved-cell"] += 1;
          continue;
        }
        if (accumulator.evaluations + 4 > maxEvaluationsPerPixel) {
          node.unresolved = true;
          accumulator.budgetExceeded = true;
          accumulator.counts["unresolved-cell"] += 1;
          continue;
        }
        const half = node.cell.size / 2;
        const childCells: readonly Cell[] = [
          { minX: node.cell.minX, minY: node.cell.minY, size: half, depth: node.cell.depth + 1 },
          { minX: node.cell.minX + half, minY: node.cell.minY, size: half, depth: node.cell.depth + 1 },
          { minX: node.cell.minX, minY: node.cell.minY + half, size: half, depth: node.cell.depth + 1 },
          { minX: node.cell.minX + half, minY: node.cell.minY + half, size: half, depth: node.cell.depth + 1 },
        ];
        const children = childCells.map(buildCell);
        node.children = children;
        const refinedArea = children.reduce((sum, child) => sum + child.areaEstimate, 0);
        areaError += Math.abs(refinedArea - node.areaEstimate);
        for (let channel = 0; channel < 3; channel += 1) {
          const refinedColor = children.reduce((sum, child) => sum + child.colorArea[channel]!, 0);
          colorError[channel] += Math.abs(refinedColor - node.colorArea[channel]!);
        }
        nextFrontier.push(...children);
      }
      frontier = nextFrontier;
    }

    let unresolvedArea = 0;
    let unresolvedCellCount = 0;
    const collectLeaves = (node: CellNode): void => {
      if (node.children) {
        node.children.forEach(collectLeaves);
        return;
      }
      accumulator.acceptedArea += node.areaEstimate;
      accumulator.colorArea = addRgb(accumulator.colorArea, node.colorArea);
      if (node.unresolved) {
        const cellArea = node.cell.size * node.cell.size;
        unresolvedArea += cellArea;
        unresolvedCellCount += 1;
        areaError += cellArea;
        for (let channel = 0; channel < 3; channel += 1) {
          colorError[channel] += Math.abs(node.colorArea[channel]!);
        }
      }
    };
    roots.forEach(collectLeaves);
    accumulator.areaError = areaError;
    accumulator.colorError = colorError;
    accumulator.unresolvedArea = unresolvedArea;
    accumulator.unresolvedCellCount = unresolvedCellCount;
    runEvaluations += accumulator.evaluations;
    pixels.push(makePixelResult(context, accumulator,
      accumulator.budgetExceeded ? "evaluation-budget-exceeded" : undefined));
  }
  return {
    algorithm: GROUND_GLASS_M5T_QUADRATURE_REVISION,
    method: "adaptive-quadtree-midpoint",
    inputFingerprints: input.referenceInput.inputFingerprints,
    initialResolution: input.initialResolution,
    maximumDepth,
    evaluationBudgetPerPixel: maxEvaluationsPerPixel,
    evaluatedPoints: runEvaluations,
    elapsedMs: Date.now() - startedAt,
    pixels,
  };
};

/**
 * Independent uniform midpoint raster over the unit disk. Its points and
 * accumulation loop do not reuse the adaptive tree or its cell decisions.
 */
export const runGroundGlassM5tFixedGridReference = (input: Readonly<{
  referenceInput: GroundGlassM5tFarReferenceInput;
  selectedGatherPixelIds: readonly number[];
  resolution?: typeof GROUND_GLASS_M5T_FIXED_GRID_RESOLUTION;
  maxEvaluationsPerPixel?: number;
}>): GroundGlassM5tFixedGridRun => {
  validateInput(input.referenceInput);
  const resolution = input.resolution ?? GROUND_GLASS_M5T_FIXED_GRID_RESOLUTION;
  const maxEvaluationsPerPixel = input.maxEvaluationsPerPixel ?? GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL;
  if (resolution !== GROUND_GLASS_M5T_FIXED_GRID_RESOLUTION
      || !Number.isSafeInteger(maxEvaluationsPerPixel) || maxEvaluationsPerPixel < 1
      || maxEvaluationsPerPixel > GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL
      || !input.selectedGatherPixelIds.length
      || input.selectedGatherPixelIds.length > GROUND_GLASS_M5T_MAX_PIXELS_PER_STUDY
      || new Set(input.selectedGatherPixelIds).size !== input.selectedGatherPixelIds.length) {
    throw new RangeError("M5T fixed-grid run exceeds the 512-grid, support, or evaluation contract");
  }
  const gatherCount = input.referenceInput.gather.widthPx * input.referenceInput.gather.heightPx;
  if (input.selectedGatherPixelIds.some((id) => !Number.isSafeInteger(id) || id < 0 || id >= gatherCount)) {
    throw new RangeError("M5T fixed-grid selected gather pixel is out of range");
  }
  const startedAt = Date.now();
  const spacing = 2 / resolution;
  const cellArea = spacing * spacing;
  const maximumSourceMagnitude: [number, number, number] = [0, 0, 0];
  for (let offset = 0; offset < input.referenceInput.sourceRgba.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      maximumSourceMagnitude[channel] = Math.max(maximumSourceMagnitude[channel]!,
        Math.abs(input.referenceInput.sourceRgba[offset + channel]!));
    }
  }
  const fixedGridBoundaryErrorEstimate = cellArea * Math.sqrt(resolution) * 2;
  let runEvaluations = 0;
  const pixels = input.selectedGatherPixelIds.map((gatherPixelId): GroundGlassM5tFarPixelEstimate => {
    const context = contextAt(input.referenceInput, gatherPixelId);
    const centerX = input.referenceInput.observedGatherCenterSourceIds[gatherPixelId * 2]!;
    const centerY = input.referenceInput.observedGatherCenterSourceIds[gatherPixelId * 2 + 1]!;
    const centerSourceId = Number.isSafeInteger(centerX) && Number.isSafeInteger(centerY)
      ? centerY * input.referenceInput.source.widthPx + centerX : -1;
    if (!context) return invalidPixelResult(gatherPixelId, centerSourceId);
    let evaluatedPoints = 0;
    let acceptedArea = 0;
    const colorArea: [number, number, number] = [0, 0, 0];
    let exceeded = false;
    for (let row = 0; row < resolution && !exceeded; row += 1) {
      const y = -1 + (row + 0.5) * spacing;
      for (let column = 0; column < resolution; column += 1) {
        const x = -1 + (column + 0.5) * spacing;
        if (x * x + y * y > 1) continue;
        if (evaluatedPoints >= maxEvaluationsPerPixel) {
          exceeded = true;
          break;
        }
        const value = evaluatePoint(input.referenceInput, context, x, y);
        evaluatedPoints += 1;
        if (!value.accepted) continue;
        acceptedArea += cellArea;
        colorArea[0] += value.rgb[0] * cellArea;
        colorArea[1] += value.rgb[1] * cellArea;
        colorArea[2] += value.rgb[2] * cellArea;
      }
    }
    runEvaluations += evaluatedPoints;
    const counts = zeroCounts();
    const unresolvedArea = exceeded ? Math.PI : 0;
    const areaError = exceeded ? Math.PI : fixedGridBoundaryErrorEstimate;
    const colorError = maximumSourceMagnitude.map((maximum) =>
      maximum * areaError) as [number, number, number];
    return {
      ...makePixelResult(context, {
        acceptedArea,
        colorArea,
        areaError,
        colorError,
        unresolvedArea,
        unresolvedCellCount: exceeded ? 1 : 0,
        evaluations: evaluatedPoints,
        maximumDepth: 0,
        budgetExceeded: exceeded,
        counts,
      }, exceeded ? "evaluation-budget-exceeded" : undefined),
      cellClassCounts: counts,
    };
  });
  return {
    algorithm: "ground-glass-m5t-fixed-midpoint-v1",
    method: "independent-square-grid-midpoint",
    inputFingerprints: input.referenceInput.inputFingerprints,
    resolution,
    evaluationBudgetPerPixel: maxEvaluationsPerPixel,
    evaluatedPoints: runEvaluations,
    elapsedMs: Date.now() - startedAt,
    pixels,
  };
};

const compareRgb = (
  left: readonly [number, number, number] | null,
  right: readonly [number, number, number] | null,
): GroundGlassM5tRgbMetrics => {
  if (!left || !right || ![...left, ...right].every(Number.isFinite)) {
    return { status: "unavailable", valueCount: 0, rmse: null, maximumChannelError: null, maximumErrorIndex: null };
  }
  let sumSquares = 0;
  let maximumChannelError = 0;
  let maximumErrorIndex = -1;
  for (let channel = 0; channel < 3; channel += 1) {
    const error = Math.abs(left[channel]! - right[channel]!);
    sumSquares += error * error;
    if (error > maximumChannelError) {
      maximumChannelError = error;
      maximumErrorIndex = channel;
    }
  }
  return {
    status: "measured",
    valueCount: 3,
    rmse: Math.sqrt(sumSquares / 3),
    maximumChannelError,
    maximumErrorIndex,
  };
};

export const compareGroundGlassM5tPixelEstimates = (
  left: readonly GroundGlassM5tFarPixelEstimate[],
  right: readonly GroundGlassM5tFarPixelEstimate[],
): readonly GroundGlassM5tPixelComparison[] => {
  const rightById = new Map(right.map((pixel) => [pixel.gatherPixelId, pixel]));
  return left.map((pixel) => {
    const other = rightById.get(pixel.gatherPixelId);
    if (!other) return {
      gatherPixelId: pixel.gatherPixelId,
      acceptedAreaAbsoluteError: null,
      acceptedAreaRelativeError: null,
      rgb: { status: "unavailable", valueCount: 0, rmse: null, maximumChannelError: null, maximumErrorIndex: null },
    };
    if (pixel.classification === "evaluation-budget-exceeded"
        || other.classification === "evaluation-budget-exceeded"
        || pixel.classification === "invalid-center" || other.classification === "invalid-center") {
      return {
        gatherPixelId: pixel.gatherPixelId,
        acceptedAreaAbsoluteError: null,
        acceptedAreaRelativeError: null,
        rgb: { status: "unavailable", valueCount: 0, rmse: null,
          maximumChannelError: null, maximumErrorIndex: null },
      };
    }
    const absoluteAreaError = Math.abs(pixel.acceptedAreaEstimate - other.acceptedAreaEstimate);
    const relativeAreaError = Math.max(pixel.acceptedAreaEstimate, other.acceptedAreaEstimate) > 0
      ? absoluteAreaError / Math.max(pixel.acceptedAreaEstimate, other.acceptedAreaEstimate) : null;
    return {
      gatherPixelId: pixel.gatherPixelId,
      acceptedAreaAbsoluteError: absoluteAreaError,
      acceptedAreaRelativeError: relativeAreaError,
      rgb: compareRgb(pixel.conditionalMeanRgb, other.conditionalMeanRgb),
    };
  });
};

const aggregateRgbMetrics = (comparisons: readonly GroundGlassM5tPixelComparison[]): GroundGlassM5tRgbMetrics => {
  const values = comparisons.flatMap(({ rgb }) => rgb.status === "measured" && rgb.rmse !== null
    && rgb.maximumChannelError !== null ? [rgb] : []);
  if (values.length !== comparisons.length || !values.length) {
    return { status: "unavailable", valueCount: 0, rmse: null, maximumChannelError: null, maximumErrorIndex: null };
  }
  const rmse = Math.sqrt(values.reduce((sum, value) => sum + value.rmse! ** 2, 0) / values.length);
  const maximum = values.reduce((best, value) => value.maximumChannelError! > best.maximumChannelError!
    ? value : best);
  return { status: "measured", valueCount: values.length * 3, rmse,
    maximumChannelError: maximum.maximumChannelError, maximumErrorIndex: maximum.maximumErrorIndex };
};

/** One evidence-gated decision shared by convergence reporting and native summaries. */
export const evaluateGroundGlassM5tReferenceEvidence = (input: Readonly<{
  inputFingerprintSets: readonly GroundGlassM5tInputFingerprints[];
  refinementComparisons: readonly GroundGlassM5tPixelComparison[];
  fixedGridComparisons: readonly GroundGlassM5tPixelComparison[];
  comparedPixelCount: number;
  requiredPixelCount: number;
  budgetExceededPixelCount?: number;
  latestUnresolvedAreaFractions: readonly number[];
  analyticControlsPassed: boolean;
  rmseLimit?: number;
  maximumChannelErrorLimit?: number;
  relativeAreaStabilityLimit?: number;
  unresolvedAreaFractionLimit?: number;
}>): GroundGlassM5tReferenceEvidence => {
  const rmseLimit = input.rmseLimit ?? GROUND_GLASS_M5T_REFERENCE_RMSE_LIMIT;
  const maximumChannelErrorLimit = input.maximumChannelErrorLimit ?? GROUND_GLASS_M5T_REFERENCE_MAXIMUM_CHANNEL_ERROR;
  const relativeAreaStabilityLimit = input.relativeAreaStabilityLimit ?? GROUND_GLASS_M5T_RELATIVE_AREA_STABILITY_LIMIT;
  const unresolvedAreaFractionLimit = input.unresolvedAreaFractionLimit ?? GROUND_GLASS_M5T_UNRESOLVED_AREA_FRACTION_LIMIT;
  const fingerprintValues = input.inputFingerprintSets.map((set) => JSON.stringify(set));
  const inputProvenance: GroundGlassM5tReferenceEvidence["inputProvenance"] = !fingerprintValues.length
    || Object.values(input.inputFingerprintSets[0] ?? {}).some((value) => !value.trim())
    ? "incomplete"
    : new Set(fingerprintValues).size === 1 ? "matched" : "mismatched";
  const support = {
    comparedPixelCount: input.comparedPixelCount,
    requiredPixelCount: input.requiredPixelCount,
    adequate: Number.isSafeInteger(input.comparedPixelCount) && input.comparedPixelCount >= input.requiredPixelCount
      && input.requiredPixelCount > 0,
  };
  const budgetExceededPixelCount = input.budgetExceededPixelCount ?? 0;
  const budgetCountValid = Number.isSafeInteger(budgetExceededPixelCount) && budgetExceededPixelCount >= 0;
  const adaptiveRefinement = aggregateRgbMetrics(input.refinementComparisons);
  const independentFixedGrid = aggregateRgbMetrics(input.fixedGridComparisons);
  const finiteMetrics = [rmseLimit, maximumChannelErrorLimit, relativeAreaStabilityLimit, unresolvedAreaFractionLimit,
    ...input.latestUnresolvedAreaFractions,
    adaptiveRefinement.rmse ?? Number.NaN,
    adaptiveRefinement.maximumChannelError ?? Number.NaN,
    independentFixedGrid.rmse ?? Number.NaN,
    independentFixedGrid.maximumChannelError ?? Number.NaN,
    ...input.refinementComparisons.map(({ acceptedAreaRelativeError }) => acceptedAreaRelativeError ?? Number.NaN),
    ...input.fixedGridComparisons.map(({ acceptedAreaRelativeError }) => acceptedAreaRelativeError ?? Number.NaN)];
  const reasons: string[] = [];
  if (!budgetCountValid) reasons.push("Budget-exceeded pixel count is invalid.");
  if (budgetExceededPixelCount > 0) reasons.push("One or more quadrature pixels exhausted the declared evaluation budget.");
  if (inputProvenance !== "matched") reasons.push(`Input provenance is ${inputProvenance}.`);
  if (!support.adequate) reasons.push("The predeclared ROI support floor is not met.");
  if (finiteMetrics.some((value) => !Number.isFinite(value))) reasons.push("One or more required evidence metrics are missing or non-finite.");
  if (adaptiveRefinement.status !== "measured" || adaptiveRefinement.rmse === null
      || adaptiveRefinement.maximumChannelError === null
      || adaptiveRefinement.rmse > rmseLimit
      || adaptiveRefinement.maximumChannelError > maximumChannelErrorLimit) {
    reasons.push("Adaptive refinement levels do not meet the declared RGB stability targets.");
  }
  if (independentFixedGrid.status !== "measured" || independentFixedGrid.rmse === null
      || independentFixedGrid.maximumChannelError === null
      || independentFixedGrid.rmse > rmseLimit
      || independentFixedGrid.maximumChannelError > maximumChannelErrorLimit) {
    reasons.push("Adaptive output does not agree with the independent fixed-grid reference.");
  }
  const areaValues = input.refinementComparisons.map(({ acceptedAreaRelativeError }) => acceptedAreaRelativeError);
  const acceptedAreaStable = areaValues.length > 0 && areaValues.every((value) => value !== null
    && Number.isFinite(value) && value <= relativeAreaStabilityLimit);
  if (!acceptedAreaStable) reasons.push("Accepted-area denominator stability is unresolved.");
  const unresolvedAreaAcceptable = input.latestUnresolvedAreaFractions.length > 0
    && input.latestUnresolvedAreaFractions.every((value) => Number.isFinite(value)
      && value <= unresolvedAreaFractionLimit);
  if (!unresolvedAreaAcceptable) reasons.push("Unresolved aperture area exceeds the declared coverage limit.");
  if (!input.analyticControlsPassed) reasons.push("Independent analytic controls did not pass.");

  let classification: GroundGlassM5tReferenceEvidence["classification"];
  if (inputProvenance !== "matched" || !budgetCountValid) {
    classification = "invalid-comparison";
  } else if (budgetExceededPixelCount > 0) {
    // A budget stop makes the downstream RGB/area comparisons unavailable by
    // construction. Preserve that specific bounded outcome instead of
    // relabeling its expected missing metrics as an invalid comparison.
    classification = "budget-limited-unresolved";
  } else if (finiteMetrics.some((value) => !Number.isFinite(value))) {
    classification = "invalid-comparison";
  } else if (!support.adequate) {
    classification = "insufficient-support";
  } else if (independentFixedGrid.rmse !== null && independentFixedGrid.rmse > rmseLimit) {
    classification = "quadrature-method-disagreement";
  } else if (input.latestUnresolvedAreaFractions.some((value) => value > unresolvedAreaFractionLimit)) {
    classification = "discontinuity-limited";
  } else if (adaptiveRefinement.rmse !== null && adaptiveRefinement.rmse > rmseLimit) {
    classification = "converging-but-unresolved";
  } else if (reasons.length) {
    classification = "converging-but-unresolved";
  } else {
    classification = "converged-with-independent-support";
  }
  return {
    classification,
    inputProvenance,
    support,
    budgetExceededPixelCount,
    adaptiveRefinement,
    independentFixedGrid,
    acceptedAreaStable,
    unresolvedAreaAcceptable,
    analyticControlsPassed: input.analyticControlsPassed,
    m5qPromotionAllowed: false,
    reasons,
  };
};

/** Stable analytic area for the x >= offset unit-disk half-plane. */
export const groundGlassM5tUnitDiskRightSegmentArea = (offset: number): number => {
  if (!Number.isFinite(offset) || offset < -1 || offset > 1) {
    throw new RangeError("Unit-disk segment offset must lie in [-1,1]");
  }
  return Math.acos(offset) - offset * Math.sqrt(Math.max(0, 1 - offset * offset));
};
