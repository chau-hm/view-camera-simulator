/**
 * M5U Strategy A: integrate source-texel regions over the aperture disk.
 * This CPU-only research reference is intentionally separate from the M5T
 * adaptive quadtree and from all renderer/runtime modules.
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
} from "./groundGlassApertureGatherReference";
import {
  GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL,
  GROUND_GLASS_M5T_MAX_PIXELS_PER_STUDY,
  type GroundGlassM5tFarPixelEstimate,
  type GroundGlassM5tFarReferenceInput,
} from "./groundGlassM5tQuadrature";

export const GROUND_GLASS_M5U_QUADRATURE_REVISION = "ground-glass-m5u-texel-footprint-area-v1" as const;
export const GROUND_GLASS_M5U_AREA_PARTITION_TOLERANCE = 1e-8;

export type GroundGlassM5uPixelResult = Readonly<{
  gatherPixelId: number;
  centerSourceId: number;
  classification:
    | "integrated"
    | "empty-accepted-area"
    | "invalid-center"
    | "unsupported-uv-dependent-view-distance"
    | "evaluation-budget-exceeded"
    | "area-partition-unresolved"
    | "area-partition-invalid";
  acceptedAreaEstimate: number;
  acceptedColorAreaIntegralRgb: readonly [number, number, number];
  conditionalMeanRgb: readonly [number, number, number] | null;
  knownPartitionArea: number;
  unresolvedArea: number;
  unresolvedAreaFraction: number;
  estimatedAreaError: number;
  estimatedColorErrorRgb: readonly [number, number, number];
  partitionResidual: number;
  integrandEvaluations: number;
  candidateSourceTexelRegions: number;
  sourceTexelRegions: number;
  acceptedAreaContributions: number;
  depthEligibilityChecks: number;
  geometricOperations: number;
  sourceMappingEvaluations: number;
  rgbFetches: number;
  capApplied: boolean | null;
  uncappedMaximumRadiusPx: number | null;
  effectiveMaximumRadiusPx: number | null;
  areaPartitionDiagnostics?: Readonly<{
    coefficients: ReturnType<typeof affineUvCoefficients>;
    xError: number;
    yError: number;
    candidateBounds: Readonly<{ firstX: number; lastX: number; firstY: number; lastY: number }>;
  }>;
}>;

export type GroundGlassM5uCostBreakdown = Readonly<{
  geometricOperations: number;
  candidateSourceTexelRegions: number;
  sourceTexelRegions: number;
  integrandEvaluations: number;
  sourceMappingEvaluations: number;
  sourceBoundarySearchEvaluations: number;
  rgbFetches: number;
  acceptedAreaContributions: number;
  depthEligibilityChecks: number;
  budgetChargedEvaluationUnits: number;
  estimatedPeakWorkingMemoryBytes: number;
}>;

export type GroundGlassM5uQuadratureRun = Readonly<{
  algorithm: typeof GROUND_GLASS_M5U_QUADRATURE_REVISION;
  method: "source-texel-footprint-circle-polygon-area";
  inputFingerprints: GroundGlassM5tFarReferenceInput["inputFingerprints"];
  evaluationBudgetPerPixel: number;
  integrandEvaluations: number;
  elapsedMs: number;
  costBreakdown: GroundGlassM5uCostBreakdown;
  pixels: readonly GroundGlassM5uPixelResult[];
}>;

type Point2 = readonly [x: number, y: number];
type MutableStats = {
  geometricOperations: number;
  candidateSourceTexelRegions: number;
  sourceTexelRegions: number;
  integrandEvaluations: number;
  sourceMappingEvaluations: number;
  rgbFetches: number;
  acceptedAreaContributions: number;
  depthEligibilityChecks: number;
  estimatedPeakWorkingMemoryBytes: number;
};
type PixelContext = Readonly<{
  centerSourceId: number;
  centerUv: Point2;
  centerViewDistanceMm: number;
  centerEligibleFar: boolean;
  majorAxisPx: Point2;
  minorAxisPx: Point2;
  clampScale: number;
  uncappedMaximumRadiusPx: number;
  effectiveMaximumRadiusPx: number;
  capApplied: boolean;
}>;

const zeroStats = (): MutableStats => ({
  geometricOperations: 0,
  candidateSourceTexelRegions: 0,
  sourceTexelRegions: 0,
  integrandEvaluations: 0,
  sourceMappingEvaluations: 0,
  rgbFetches: 0,
  acceptedAreaContributions: 0,
  depthEligibilityChecks: 0,
  estimatedPeakWorkingMemoryBytes: 0,
});

const viewDistanceDependsOnUv = (input: GroundGlassM5tFarReferenceInput): boolean =>
  input.inverseProjectionMatrix[2] !== 0
  || input.inverseProjectionMatrix[6] !== 0
  || input.inverseProjectionMatrix[3] !== 0
  || input.inverseProjectionMatrix[7] !== 0;

const validInput = (input: GroundGlassM5tFarReferenceInput): void => {
  const sourceCount = input.source.widthPx * input.source.heightPx;
  const gatherCount = input.gather.widthPx * input.gather.heightPx;
  if (!Number.isSafeInteger(input.source.widthPx) || input.source.widthPx <= 0
      || !Number.isSafeInteger(input.source.heightPx) || input.source.heightPx <= 0
      || !Number.isSafeInteger(input.gather.widthPx) || input.gather.widthPx <= 0
      || !Number.isSafeInteger(input.gather.heightPx) || input.gather.heightPx <= 0
      || !Number.isSafeInteger(sourceCount) || sourceCount <= 0
      || !Number.isSafeInteger(gatherCount) || gatherCount <= 0
      || input.sourceRgba.length !== sourceCount * 4
      || input.physicalRgba.length !== sourceCount * 4
      || input.validity.length !== sourceCount
      || input.depth.length !== sourceCount
      || input.observedGatherCenterSourceIds.length !== gatherCount * 2
      || input.observedGatherCenterSourceUvs.length !== gatherCount * 2
      || input.inverseProjectionMatrix.length !== 16
      || !Number.isFinite(input.film.widthMm) || input.film.widthMm <= 0
      || !Number.isFinite(input.film.heightMm) || input.film.heightMm <= 0
      || !Number.isFinite(input.maximumRadiusPx) || input.maximumRadiusPx < 0
      || Object.values(input.inputFingerprints).some((value) => typeof value !== "string" || !value.trim())) {
    throw new RangeError("M5U readbacks, dimensions, film, fingerprints, or cap are inconsistent");
  }
  for (const values of [input.sourceRgba, input.physicalRgba, input.depth, input.inverseProjectionMatrix]) {
    for (let index = 0; index < values.length; index += 1) {
      if (!Number.isFinite(values[index])) throw new RangeError("M5U input arrays must contain finite values");
    }
  }
  for (let index = 0; index < input.depth.length; index += 1) {
    if (input.depth[index]! < 0 || input.depth[index]! > 1) {
      throw new RangeError("M5U depth readback must use normalized [0,1] values");
    }
  }
  for (let offset = 0; offset < input.sourceRgba.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      if (input.sourceRgba[offset + channel]! < 0 || input.sourceRgba[offset + channel]! > 1) {
        throw new RangeError("M5U source RGB must retain the normalized [0,1] readback domain");
      }
    }
  }
};

const contextAt = (input: GroundGlassM5tFarReferenceInput, gatherPixelId: number): PixelContext => {
  const sourceX = input.observedGatherCenterSourceIds[gatherPixelId * 2]!;
  const sourceY = input.observedGatherCenterSourceIds[gatherPixelId * 2 + 1]!;
  if (!Number.isSafeInteger(sourceX) || !Number.isSafeInteger(sourceY)
      || sourceX < 0 || sourceY < 0
      || sourceX >= input.source.widthPx || sourceY >= input.source.heightPx) {
    throw new RangeError("M5U observed gather-center identity is outside the source image");
  }
  const centerSourceId = sourceY * input.source.widthPx + sourceX;
  const centerUv: Point2 = [input.observedGatherCenterSourceUvs[gatherPixelId * 2]!,
    input.observedGatherCenterSourceUvs[gatherPixelId * 2 + 1]!];
  if (centerUv.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new RangeError("M5U observed gather-center UV must be finite and normalized");
  }
  const offset = centerSourceId * 4;
  const centerViewDistanceMm = groundGlassViewDistanceMmAtTopUv(
    centerUv[0], centerUv[1], input.depth[centerSourceId]!, input.inverseProjectionMatrix,
  );
  const centerEligibleFar = input.validity[centerSourceId] === GROUND_GLASS_APERTURE_VALIDITY_CODE
    && input.physicalRgba[offset]! > GROUND_GLASS_APERTURE_SIGN_EPSILON_MM;
  const ellipse = capGroundGlassPixelEllipse(mapGroundGlassPhysicalEllipseToSourcePixels({
    majorRadiusMm: input.physicalRgba[offset + 1]!,
    minorRadiusMm: input.physicalRgba[offset + 2]!,
    orientationRad: input.physicalRgba[offset + 3]! * Math.PI,
    film: input.film,
    source: input.source,
  }), input.maximumRadiusPx);
  return {
    centerSourceId,
    centerUv,
    centerViewDistanceMm,
    centerEligibleFar,
    majorAxisPx: ellipse.majorAxisPx,
    minorAxisPx: ellipse.minorAxisPx,
    clampScale: ellipse.clampScale,
    uncappedMaximumRadiusPx: ellipse.uncappedMaximumRadiusPx,
    effectiveMaximumRadiusPx: ellipse.effectiveMaximumRadiusPx,
    capApplied: ellipse.capApplied,
  };
};

const affineUvCoefficients = (input: GroundGlassM5tFarReferenceInput, context: PixelContext) => ({
  centerU: context.centerUv[0],
  centerV: context.centerUv[1],
  uX: context.majorAxisPx[0] * context.clampScale / input.source.widthPx,
  uY: context.minorAxisPx[0] * context.clampScale / input.source.widthPx,
  vX: context.majorAxisPx[1] * context.clampScale / input.source.heightPx,
  vY: context.minorAxisPx[1] * context.clampScale / input.source.heightPx,
});

const sourcePixelThresholds = (dimension: number, onSearchEvaluation: () => void): Float64Array => {
  const thresholds = new Float64Array(dimension + 1);
  thresholds[0] = 0;
  thresholds[dimension] = 1;
  const source = { widthPx: dimension, heightPx: 1 };
  for (let pixel = 1; pixel < dimension; pixel += 1) {
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 64; iteration += 1) {
      onSearchEvaluation();
      const middle = (low + high) / 2;
      if (nearestGroundGlassSourcePixelAtTopUv(middle, 0.5, source)[0] >= pixel) high = middle;
      else low = middle;
    }
    thresholds[pixel] = high;
  }
  return thresholds;
};

const clipHalfPlane = (
  polygon: readonly Point2[],
  a: number,
  b: number,
  c: number,
  stats: MutableStats,
): Point2[] => {
  if (polygon.length === 0) return [];
  const output: Point2[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const first = polygon[index]!;
    const second = polygon[(index + 1) % polygon.length]!;
    const firstValue = a * first[0] + b * first[1] + c;
    const secondValue = a * second[0] + b * second[1] + c;
    stats.geometricOperations += 1;
    const firstInside = firstValue >= 0;
    const secondInside = secondValue >= 0;
    if (firstInside && secondInside) output.push(second);
    else if (firstInside !== secondInside) {
      const denominator = firstValue - secondValue;
      if (denominator === 0) continue;
      const ratio = firstValue / denominator;
      const intersection: Point2 = [
        first[0] + (second[0] - first[0]) * ratio,
        first[1] + (second[1] - first[1]) * ratio,
      ];
      if (firstInside) output.push(intersection);
      else {
        output.push(intersection, second);
      }
    }
  }
  return output;
};

const circleSegmentContribution = (first: Point2, second: Point2): number => {
  const cross = first[0] * second[1] - first[1] * second[0];
  const dot = first[0] * second[0] + first[1] * second[1];
  const middleX = (first[0] + second[0]) / 2;
  const middleY = (first[1] + second[1]) / 2;
  const middleRadiusSquared = middleX * middleX + middleY * middleY;
  const boundaryRoundoff = 32 * Number.EPSILON * (1 + middleRadiusSquared);
  // Tangent segments can produce a slightly positive or negative circle-line
  // discriminant. Treat their midpoint as outside within roundoff so the same
  // geometric tangent contributes its circular arc on either side of zero.
  if (middleRadiusSquared < 1 - boundaryRoundoff) return cross / 2;
  return Math.atan2(cross, dot) / 2;
};

const circlePolygonIntersectionArea = (polygon: readonly Point2[], stats: MutableStats): number => {
  if (polygon.length < 3) return 0;
  let signedArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const first = polygon[index]!;
    const second = polygon[(index + 1) % polygon.length]!;
    const dx = second[0] - first[0];
    const dy = second[1] - first[1];
    const quadraticA = dx * dx + dy * dy;
    const quadraticB = 2 * (first[0] * dx + first[1] * dy);
    const quadraticC = first[0] * first[0] + first[1] * first[1] - 1;
    const cuts = [0, 1];
    if (quadraticA > 0) {
      const discriminant = quadraticB * quadraticB - 4 * quadraticA * quadraticC;
      stats.geometricOperations += 1;
      if (discriminant >= 0) {
        const root = Math.sqrt(discriminant);
        const firstRoot = (-quadraticB - root) / (2 * quadraticA);
        const secondRoot = (-quadraticB + root) / (2 * quadraticA);
        if (firstRoot > 0 && firstRoot < 1) cuts.push(firstRoot);
        if (secondRoot > 0 && secondRoot < 1) cuts.push(secondRoot);
      }
    }
    cuts.sort((left, right) => left - right);
    for (let cut = 0; cut < cuts.length - 1; cut += 1) {
      const from = cuts[cut]!;
      const to = cuts[cut + 1]!;
      const start: Point2 = [first[0] + dx * from, first[1] + dy * from];
      const end: Point2 = [first[0] + dx * to, first[1] + dy * to];
      signedArea += circleSegmentContribution(start, end);
      stats.geometricOperations += 1;
    }
  }
  const area = Math.abs(signedArea);
  if (!Number.isFinite(area)) return Number.NaN;
  return Math.min(Math.PI, area);
};

const pixelFootprintPolygon = (
  coefficients: ReturnType<typeof affineUvCoefficients>,
  xPixel: number,
  yPixel: number,
  xThresholds: Float64Array,
  yThresholds: Float64Array,
  xError: number,
  yError: number,
  stats: MutableStats,
): Point2[] => {
  let polygon: Point2[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const lowU = xPixel === 0 ? Number.NEGATIVE_INFINITY : xThresholds[xPixel]! + xError;
  const highU = xPixel === xThresholds.length - 2 ? Number.POSITIVE_INFINITY : xThresholds[xPixel + 1]! - xError;
  const lowV = yPixel === 0 ? Number.NEGATIVE_INFINITY : yThresholds[yPixel]! + yError;
  const highV = yPixel === yThresholds.length - 2 ? Number.POSITIVE_INFINITY : yThresholds[yPixel + 1]! - yError;
  if (Number.isFinite(lowU)) polygon = clipHalfPlane(polygon, coefficients.uX, coefficients.uY,
    coefficients.centerU - lowU, stats);
  if (Number.isFinite(highU)) polygon = clipHalfPlane(polygon, -coefficients.uX, -coefficients.uY,
    highU - coefficients.centerU, stats);
  if (Number.isFinite(lowV)) polygon = clipHalfPlane(polygon, coefficients.vX, coefficients.vY,
    coefficients.centerV - lowV, stats);
  if (Number.isFinite(highV)) polygon = clipHalfPlane(polygon, -coefficients.vX, -coefficients.vY,
    highV - coefficients.centerV, stats);
  return polygon;
};

const makePixelResult = (
  input: GroundGlassM5tFarReferenceInput,
  gatherPixelId: number,
  context: PixelContext,
  xThresholds: Float64Array,
  yThresholds: Float64Array,
  evaluationBudget: number,
): GroundGlassM5uPixelResult => {
  const stats = zeroStats();
  if (!context.centerEligibleFar) {
    return {
      gatherPixelId, centerSourceId: context.centerSourceId, classification: "invalid-center",
      acceptedAreaEstimate: 0, acceptedColorAreaIntegralRgb: [0, 0, 0], conditionalMeanRgb: null,
      knownPartitionArea: 0, unresolvedArea: 0, unresolvedAreaFraction: 0, estimatedAreaError: 0,
      estimatedColorErrorRgb: [0, 0, 0], partitionResidual: 0, integrandEvaluations: 0,
      sourceTexelRegions: 0, geometricOperations: 0, sourceMappingEvaluations: 0, rgbFetches: 0,
      candidateSourceTexelRegions: 0, acceptedAreaContributions: 0, depthEligibilityChecks: 0,
      capApplied: context.capApplied, uncappedMaximumRadiusPx: context.uncappedMaximumRadiusPx,
      effectiveMaximumRadiusPx: context.effectiveMaximumRadiusPx,
    };
  }
  if (viewDistanceDependsOnUv(input)) {
    return {
      gatherPixelId, centerSourceId: context.centerSourceId,
      classification: "unsupported-uv-dependent-view-distance",
      acceptedAreaEstimate: 0, acceptedColorAreaIntegralRgb: [0, 0, 0], conditionalMeanRgb: null,
      knownPartitionArea: 0, unresolvedArea: Math.PI, unresolvedAreaFraction: 1, estimatedAreaError: Math.PI,
      estimatedColorErrorRgb: [0, 0, 0], partitionResidual: Math.PI, integrandEvaluations: 0,
      sourceTexelRegions: 0, geometricOperations: 0, sourceMappingEvaluations: 0, rgbFetches: 0,
      candidateSourceTexelRegions: 0, acceptedAreaContributions: 0, depthEligibilityChecks: 0,
      capApplied: context.capApplied, uncappedMaximumRadiusPx: context.uncappedMaximumRadiusPx,
      effectiveMaximumRadiusPx: context.effectiveMaximumRadiusPx,
    };
  }

  const coefficients = affineUvCoefficients(input, context);
  const xError = 16 * Number.EPSILON * (1 + Math.abs(coefficients.centerU)
    + Math.abs(coefficients.uX) + Math.abs(coefficients.uY));
  const yError = 16 * Number.EPSILON * (1 + Math.abs(coefficients.centerV)
    + Math.abs(coefficients.vX) + Math.abs(coefficients.vY));
  const corners: Point2[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const values = corners.map(([x, y]) => [
    coefficients.centerU + coefficients.uX * x + coefficients.uY * y,
    coefficients.centerV + coefficients.vX * x + coefficients.vY * y,
  ] as const);
  const minU = Math.min(...values.map(([u]) => u)) - xError;
  const maxU = Math.max(...values.map(([u]) => u)) + xError;
  const minV = Math.min(...values.map(([, v]) => v)) - yError;
  const maxV = Math.max(...values.map(([, v]) => v)) + yError;
  const firstX = nearestGroundGlassSourcePixelAtTopUv(minU, 0.5, input.source)[0];
  const lastX = nearestGroundGlassSourcePixelAtTopUv(maxU, 0.5, input.source)[0];
  const firstY = nearestGroundGlassSourcePixelAtTopUv(0.5, minV, input.source)[1];
  const lastY = nearestGroundGlassSourcePixelAtTopUv(0.5, maxV, input.source)[1];
  const sourceColorMagnitude: [number, number, number] = [0, 0, 0];
  sourceColorMagnitude.fill(1);

  let acceptedArea = 0;
  const colorArea: [number, number, number] = [0, 0, 0];
  let knownPartitionArea = 0;
  let stoppedForBudget = false;
  let areaInvalid = false;
  for (let sourceY = firstY; sourceY <= lastY && !stoppedForBudget && !areaInvalid; sourceY += 1) {
    for (let sourceX = firstX; sourceX <= lastX; sourceX += 1) {
      stats.candidateSourceTexelRegions += 1;
      const polygon = pixelFootprintPolygon(coefficients, sourceX, sourceY,
        xThresholds, yThresholds, xError, yError, stats);
      const area = circlePolygonIntersectionArea(polygon, stats);
      if (!Number.isFinite(area) || area < 0) {
        areaInvalid = true;
        break;
      }
      if (area <= 1e-18) continue;
      if (stats.integrandEvaluations >= evaluationBudget) {
        stoppedForBudget = true;
        break;
      }
      stats.sourceTexelRegions += 1;
      stats.integrandEvaluations += 1;
      stats.sourceMappingEvaluations += 1;
      stats.depthEligibilityChecks += 1;
      knownPartitionArea += area;
      const sourceId = sourceY * input.source.widthPx + sourceX;
      const offset = sourceId * 4;
      const accepted = input.validity[sourceId] === GROUND_GLASS_APERTURE_VALIDITY_CODE
        && input.depth[sourceId]! < 1
        && input.physicalRgba[offset]! >= -GROUND_GLASS_APERTURE_SIGN_EPSILON_MM
        && groundGlassViewDistanceMmAtTopUv(context.centerUv[0], context.centerUv[1],
          input.depth[sourceId]!, input.inverseProjectionMatrix)
          >= context.centerViewDistanceMm - Math.max(
            GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FLOOR_MM,
            context.centerViewDistanceMm * GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FRACTION,
          );
      if (!accepted) continue;
      acceptedArea += area;
      stats.acceptedAreaContributions += 1;
      stats.rgbFetches += 1;
      for (let channel = 0; channel < 3; channel += 1) {
        colorArea[channel] += input.sourceRgba[offset + channel]! * area;
      }
    }
    if (areaInvalid) break;
  }

  const partitionResidual = Math.PI - knownPartitionArea;
  const unresolvedArea = Math.max(0, partitionResidual);
  const areaInvalidBeyondRoundoff = partitionResidual < -GROUND_GLASS_M5U_AREA_PARTITION_TOLERANCE;
  const classification: GroundGlassM5uPixelResult["classification"] = areaInvalid || areaInvalidBeyondRoundoff
    ? "area-partition-invalid"
    : stoppedForBudget ? "evaluation-budget-exceeded"
      : unresolvedArea > GROUND_GLASS_M5U_AREA_PARTITION_TOLERANCE ? "area-partition-unresolved"
        : acceptedArea > 0 ? "integrated" : "empty-accepted-area";
  const unresolvedColorError: [number, number, number] = sourceColorMagnitude.map((magnitude) =>
    magnitude * unresolvedArea) as [number, number, number];
  stats.estimatedPeakWorkingMemoryBytes = (xThresholds.length + yThresholds.length) * 8 + 512;
  const areaPartitionDiagnostics = classification === "area-partition-invalid"
    ? {
      coefficients,
      xError,
      yError,
      candidateBounds: { firstX, lastX, firstY, lastY },
    }
    : undefined;
  return {
    gatherPixelId,
    centerSourceId: context.centerSourceId,
    classification,
    acceptedAreaEstimate: acceptedArea,
    acceptedColorAreaIntegralRgb: colorArea,
    conditionalMeanRgb: acceptedArea > 0
      ? [colorArea[0] / acceptedArea, colorArea[1] / acceptedArea, colorArea[2] / acceptedArea]
      : null,
    knownPartitionArea,
    unresolvedArea,
    unresolvedAreaFraction: unresolvedArea / Math.PI,
    estimatedAreaError: unresolvedArea + Math.abs(Math.min(0, partitionResidual)),
    estimatedColorErrorRgb: unresolvedColorError,
    partitionResidual,
    integrandEvaluations: stats.integrandEvaluations,
    candidateSourceTexelRegions: stats.candidateSourceTexelRegions,
    sourceTexelRegions: stats.sourceTexelRegions,
    acceptedAreaContributions: stats.acceptedAreaContributions,
    depthEligibilityChecks: stats.depthEligibilityChecks,
    geometricOperations: stats.geometricOperations,
    sourceMappingEvaluations: stats.sourceMappingEvaluations,
    rgbFetches: stats.rgbFetches,
    capApplied: context.capApplied,
    uncappedMaximumRadiusPx: context.uncappedMaximumRadiusPx,
    effectiveMaximumRadiusPx: context.effectiveMaximumRadiusPx,
    ...(areaPartitionDiagnostics ? { areaPartitionDiagnostics } : {}),
  };
};

export type GroundGlassM5uReferenceComparison = Readonly<{
  reference: "m5t-adaptive" | "m5t-fixed-grid-512" | "m5s-finite-sampling";
  status: "measured" | "unavailable";
  rgbRmse: number | null;
  maximumChannelError: number | null;
  acceptedAreaRelativeError: number | null;
}>;

export type GroundGlassM5uPixelEvidence = Readonly<{
  classification: "supported" | "unresolved" | "invalid-comparison";
  inputProvenance: "matched" | "mismatched";
  analyticControlsPassed: boolean;
  acceptedAreaStable: boolean;
  rgbStable: boolean;
  independentReferenceCount: number;
  evaluationReductionRatio: number | null;
  elapsedTimeRatio: number | null;
  candidateResolved: boolean;
  newlyResolved: boolean;
  reasons: readonly string[];
  m5qPromotionAllowed: false;
  m6QualityPresentationAllowed: false;
  productionWebGpuAllowed: false;
}>;

/** A bounded evidence gate: efficiency never overrides provenance or error evidence. */
export const evaluateGroundGlassM5uPixelEvidence = (input: Readonly<{
  inputFingerprintsMatch: boolean;
  analyticControlsPassed: boolean;
  evidenceScope: "controlled-fixture" | "registered-app";
  candidate: GroundGlassM5uPixelResult;
  baselineClassification: GroundGlassM5tFarPixelEstimate["classification"];
  baselineEvaluations: number;
  candidateEvaluations: number;
  baselineElapsedMs: number;
  candidateElapsedMs: number;
  independentComparisons: readonly GroundGlassM5uReferenceComparison[];
  acceptedAreaRelativeLimit?: number;
  rgbRmseLimit?: number;
  rgbMaximumErrorLimit?: number;
}>): GroundGlassM5uPixelEvidence => {
  const acceptedAreaRelativeLimit = input.acceptedAreaRelativeLimit ?? 0.005;
  const rgbRmseLimit = input.rgbRmseLimit ?? 0.001;
  const rgbMaximumErrorLimit = input.rgbMaximumErrorLimit ?? 0.01;
  const reasons: string[] = [];
  const finiteCandidate = Number.isFinite(input.candidate.acceptedAreaEstimate)
    && Number.isFinite(input.candidate.estimatedAreaError)
    && input.candidate.estimatedColorErrorRgb.every(Number.isFinite)
    && input.candidate.conditionalMeanRgb?.every(Number.isFinite) === true;
  const measuredComparisons = input.independentComparisons.filter(({ reference, status }) =>
    status === "measured" && reference !== "m5t-adaptive");
  const hasFixedGrid = measuredComparisons.some(({ reference }) => reference === "m5t-fixed-grid-512");
  const hasM5s = measuredComparisons.some(({ reference }) => reference === "m5s-finite-sampling");
  const comparisonsFinite = measuredComparisons.length > 0 && measuredComparisons.every((comparison) =>
    Number.isFinite(comparison.rgbRmse) && Number.isFinite(comparison.maximumChannelError));
  const comparisonsWithinLimits = comparisonsFinite && measuredComparisons.every((comparison) =>
    comparison.rgbRmse! <= rgbRmseLimit
    && comparison.maximumChannelError! <= rgbMaximumErrorLimit);
  const areaComparisons = input.independentComparisons.filter(({ reference, status, acceptedAreaRelativeError }) =>
    reference === "m5t-fixed-grid-512" && status === "measured"
    && Number.isFinite(acceptedAreaRelativeError));
  const areaWithinLimits = areaComparisons.length > 0 && areaComparisons.every(({ acceptedAreaRelativeError }) =>
    acceptedAreaRelativeError! <= acceptedAreaRelativeLimit);
  const acceptedAreaStable = finiteCandidate
    && input.candidate.classification === "integrated"
    && input.candidate.unresolvedArea <= GROUND_GLASS_M5U_AREA_PARTITION_TOLERANCE
    && input.candidate.estimatedAreaError <= acceptedAreaRelativeLimit * Math.max(input.candidate.acceptedAreaEstimate, 1e-12)
    && hasFixedGrid
    && areaWithinLimits;
  const rgbStable = finiteCandidate && comparisonsWithinLimits && hasFixedGrid && hasM5s;
  const candidateResolved = input.candidate.classification === "integrated"
    && finiteCandidate
    && input.candidate.unresolvedArea <= GROUND_GLASS_M5U_AREA_PARTITION_TOLERANCE;
  const newlyResolved = candidateResolved && input.baselineClassification === "evaluation-budget-exceeded";
  if (!input.inputFingerprintsMatch) reasons.push("Input fingerprints differ; this is not a valid numerical comparison.");
  if (!input.analyticControlsPassed) reasons.push("One or more analytic controls failed.");
  if (!finiteCandidate) reasons.push("Candidate output or uncertainty metrics are missing or non-finite.");
  if (!candidateResolved) reasons.push("Candidate did not completely integrate this pixel within its declared area bound.");
  if (!acceptedAreaStable) reasons.push("Accepted-area stability is unresolved against independent evidence.");
  if (!rgbStable) reasons.push("RGB agreement is unresolved against the fixed grid and M5S evidence.");
  if (input.evidenceScope !== "registered-app") reasons.push("Controlled fixtures cannot establish registered-app support.");
  const classification: GroundGlassM5uPixelEvidence["classification"] = !input.inputFingerprintsMatch
    ? "invalid-comparison"
    : input.analyticControlsPassed && acceptedAreaStable && rgbStable && candidateResolved
      && input.evidenceScope === "registered-app" ? "supported" : "unresolved";
  const evaluationReductionRatio = Number.isFinite(input.baselineEvaluations)
    && Number.isFinite(input.candidateEvaluations) && input.baselineEvaluations > 0
    ? 1 - input.candidateEvaluations / input.baselineEvaluations : null;
  const elapsedTimeRatio = Number.isFinite(input.baselineElapsedMs)
    && Number.isFinite(input.candidateElapsedMs) && input.baselineElapsedMs > 0
    ? input.candidateElapsedMs / input.baselineElapsedMs : null;
  return {
    classification,
    inputProvenance: input.inputFingerprintsMatch ? "matched" : "mismatched",
    analyticControlsPassed: input.analyticControlsPassed,
    acceptedAreaStable,
    rgbStable,
    independentReferenceCount: measuredComparisons.length,
    evaluationReductionRatio,
    elapsedTimeRatio,
    candidateResolved,
    newlyResolved,
    reasons,
    m5qPromotionAllowed: false,
    m6QualityPresentationAllowed: false,
    productionWebGpuAllowed: false,
  };
};

export const runGroundGlassM5uQuadrature = (input: Readonly<{
  referenceInput: GroundGlassM5tFarReferenceInput;
  selectedGatherPixelIds: readonly number[];
  maxEvaluationsPerPixel?: number;
}>): GroundGlassM5uQuadratureRun => {
  validInput(input.referenceInput);
  const gatherCount = input.referenceInput.gather.widthPx * input.referenceInput.gather.heightPx;
  const evaluationBudget = input.maxEvaluationsPerPixel ?? GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL;
  if (!input.selectedGatherPixelIds.length
      || input.selectedGatherPixelIds.length > GROUND_GLASS_M5T_MAX_PIXELS_PER_STUDY
      || input.selectedGatherPixelIds.some((id) => !Number.isSafeInteger(id) || id < 0 || id >= gatherCount)
      || new Set(input.selectedGatherPixelIds).size !== input.selectedGatherPixelIds.length
      || !Number.isSafeInteger(evaluationBudget) || evaluationBudget < 1
      || evaluationBudget > GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL) {
    throw new RangeError("M5U requires unique in-range pixels and the unchanged M5T per-pixel evaluation ceiling");
  }
  const startedAt = performance.now();
  let sourceBoundarySearchEvaluations = 0;
  const xThresholds = sourcePixelThresholds(input.referenceInput.source.widthPx,
    () => { sourceBoundarySearchEvaluations += 1; });
  const yThresholds = sourcePixelThresholds(input.referenceInput.source.heightPx,
    () => { sourceBoundarySearchEvaluations += 1; });
  const pixels = input.selectedGatherPixelIds.map((gatherPixelId) => makePixelResult(
    input.referenceInput,
    gatherPixelId,
    contextAt(input.referenceInput, gatherPixelId),
    xThresholds,
    yThresholds,
    evaluationBudget,
  ));
  const costBreakdown: GroundGlassM5uCostBreakdown = {
    geometricOperations: pixels.reduce((sum, pixel) => sum + pixel.geometricOperations, 0)
      + sourceBoundarySearchEvaluations,
    candidateSourceTexelRegions: pixels.reduce((sum, pixel) => sum
      + pixel.candidateSourceTexelRegions, 0),
    sourceTexelRegions: pixels.reduce((sum, pixel) => sum + pixel.sourceTexelRegions, 0),
    integrandEvaluations: pixels.reduce((sum, pixel) => sum + pixel.integrandEvaluations, 0),
    sourceMappingEvaluations: pixels.reduce((sum, pixel) => sum + pixel.sourceMappingEvaluations, 0),
    sourceBoundarySearchEvaluations,
    rgbFetches: pixels.reduce((sum, pixel) => sum + pixel.rgbFetches, 0),
    acceptedAreaContributions: pixels.reduce((sum, pixel) => sum + pixel.acceptedAreaContributions, 0),
    depthEligibilityChecks: pixels.reduce((sum, pixel) => sum + pixel.depthEligibilityChecks, 0),
    budgetChargedEvaluationUnits: pixels.reduce((sum, pixel) => sum + pixel.integrandEvaluations, 0),
    estimatedPeakWorkingMemoryBytes: pixels.reduce((maximum, pixel) => Math.max(maximum,
      pixel.sourceTexelRegions > 0 ? (xThresholds.length + yThresholds.length) * 8 + 512 : 512), 0),
  };
  return {
    algorithm: GROUND_GLASS_M5U_QUADRATURE_REVISION,
    method: "source-texel-footprint-circle-polygon-area",
    inputFingerprints: input.referenceInput.inputFingerprints,
    evaluationBudgetPerPixel: evaluationBudget,
    integrandEvaluations: costBreakdown.integrandEvaluations,
    elapsedMs: performance.now() - startedAt,
    costBreakdown,
    pixels,
  };
};

