/**
 * Diagnostic-only sparse ROI Far reference for M5 sampling research.
 *
 * This module is deliberately separate from the production TSL gather. It
 * reuses only the established physical ellipse, top-origin texel, and view
 * distance helpers. Proposal generation, sparse accumulation, and convergence
 * analysis are implemented independently here.
 */
import {
  GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FLOOR_MM,
  GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FRACTION,
  GROUND_GLASS_APERTURE_SIGN_EPSILON_MM,
  GROUND_GLASS_APERTURE_VALIDITY_CODE,
  capGroundGlassPixelEllipse,
  groundGlassGoldenAngleDiskProposal,
  groundGlassViewDistanceMmAtTopUv,
  mapGroundGlassPhysicalEllipseToSourcePixels,
  nearestGroundGlassSourcePixelAtTopUv,
  type GroundGlassApertureDimensions,
  type GroundGlassFilmDimensionsMm,
  type GroundGlassPixelAxis,
} from "./groundGlassApertureGatherReference";

export const GROUND_GLASS_M5S_SAMPLE_COUNTS = [32, 64, 128, 256, 512, 1024] as const;
export const GROUND_GLASS_M5S_PROPOSAL_ALGORITHM_REVISION = "ground-glass-m5s-proposal-v1";
export type GroundGlassM5sSampleCount = (typeof GROUND_GLASS_M5S_SAMPLE_COUNTS)[number];
export type GroundGlassM5sSamplingMethod =
  | "golden-angle-count-dependent"
  | "halton-2-3-progressive"
  | "seeded-stratified-square-to-disk";

export const GROUND_GLASS_M5S_MAX_SAMPLE_COUNT = 1024;
export const GROUND_GLASS_M5S_MAX_ROI_PIXELS = 128;
export const GROUND_GLASS_M5S_MAX_PROPOSAL_EVALUATIONS_PER_RUN = 131_072;
export const GROUND_GLASS_M5S_MAX_TOTAL_PROPOSAL_EVALUATIONS = 2_000_000;
export const GROUND_GLASS_M5S_MAX_SEQUENCE_RUNS = 64;
export const GROUND_GLASS_M5S_DECLARED_REFERENCE_RMSE_LIMIT = 0.001;
export const GROUND_GLASS_M5S_DECLARED_MAXIMUM_CHANNEL_ERROR = 0.01;

export type GroundGlassM5sProposalDescriptor = Readonly<{
  method: GroundGlassM5sSamplingMethod;
  sequenceId: string;
  algorithmRevision: typeof GROUND_GLASS_M5S_PROPOSAL_ALGORITHM_REVISION;
  sampleCount: GroundGlassM5sSampleCount;
  seed: number | null;
  progressivePrefix: boolean;
}>;

export type GroundGlassM5sProposalStrategy = Readonly<{
  descriptor: GroundGlassM5sProposalDescriptor;
  proposalAt: (index: number) => GroundGlassPixelAxis;
}>;

export type GroundGlassM5sProposalAudit = Readonly<{
  status: "valid" | "invalid";
  proposalCount: number;
  uniqueProposalCount: number;
  duplicateCount: number;
  nonFiniteCount: number;
  outsideUnitDiskCount: number;
  centroid: readonly [x: number, y: number];
  minimumRadius: number | null;
  maximumRadius: number | null;
  meanRadius: number | null;
  meanSquaredRadius: number | null;
  radialAreaBandCounts: readonly [number, number, number, number];
  angularSectorCounts: readonly [number, number, number, number, number, number, number, number];
  meanNearestNeighborDistance: number | null;
  issues: readonly string[];
}>;

export type GroundGlassM5sInputFingerprints = Readonly<{
  sourceColor: string;
  depth: string;
  physical: string;
  validity: string;
}>;

export type GroundGlassM5sFarReferenceInput = Readonly<{
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
  inputFingerprints: GroundGlassM5sInputFingerprints;
}>;

export type GroundGlassM5sFarPixelResult = Readonly<{
  gatherPixelId: number;
  centerSourceId: number;
  centerEligibleFar: boolean;
  uncappedMaximumRadiusPx: number;
  effectiveMaximumRadiusPx: number;
  capApplied: boolean;
  centerRgb: readonly [number, number, number];
  finiteEstimatorRgb: readonly [number, number, number];
  limitingIntegralRgb: readonly [number, number, number] | null;
  centerContributionWeight: 0 | 1;
  acceptedProposalCount: number;
  finiteEstimatorWeightSum: number;
  centerContributionFraction: number;
}>;

export type GroundGlassM5sFarReferenceResult = Readonly<{
  algorithm: "ground-glass-m5s-sparse-far-v1";
  targetSemantics: "finite-estimator-and-limiting-conditional-integral";
  descriptor: GroundGlassM5sProposalDescriptor;
  proposalAudit: GroundGlassM5sProposalAudit;
  proposalCoordinateFingerprint: string;
  inputFingerprints: GroundGlassM5sInputFingerprints;
  selectedGatherPixelIds: readonly number[];
  evaluatedProposalCount: number;
  elapsedMs: number;
  pixels: readonly GroundGlassM5sFarPixelResult[];
}>;

export type GroundGlassM5sReferenceBudget = Readonly<{
  maxRoiPixels: number;
  maxSampleCount: number;
  maxProposalEvaluations: number;
}>;

const DEFAULT_RUN_BUDGET: GroundGlassM5sReferenceBudget = Object.freeze({
  maxRoiPixels: GROUND_GLASS_M5S_MAX_ROI_PIXELS,
  maxSampleCount: GROUND_GLASS_M5S_MAX_SAMPLE_COUNT,
  maxProposalEvaluations: GROUND_GLASS_M5S_MAX_PROPOSAL_EVALUATIONS_PER_RUN,
});

const isPositiveSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

const assertSampleCount: (value: number) => asserts value is GroundGlassM5sSampleCount = (value) => {
  if (!(GROUND_GLASS_M5S_SAMPLE_COUNTS as readonly number[]).includes(value)) {
    throw new RangeError("M5S sample count must be one of 32, 64, 128, 256, 512, or 1024");
  }
};

const radicalInverse = (value: number, base: number): number => {
  let remainder = value;
  let factor = 1 / base;
  let result = 0;
  while (remainder > 0) {
    result += (remainder % base) * factor;
    remainder = Math.floor(remainder / base);
    factor /= base;
  }
  return result;
};

const hashUint32 = (value: number): number => {
  let result = value >>> 0;
  result ^= result >>> 16;
  result = Math.imul(result, 0x7feb352d);
  result ^= result >>> 15;
  result = Math.imul(result, 0x846ca68b);
  result ^= result >>> 16;
  return result >>> 0;
};

const seededUnit = (seed: number, index: number, lane: number): number => {
  let value = hashUint32(seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(lane + 1, 0x85ebca6b));
  value = (value + 0x6d2b79f5) >>> 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
};

const concentricSquareToDisk = (u: number, v: number): GroundGlassPixelAxis => {
  const a = 2 * u - 1;
  const b = 2 * v - 1;
  if (a === 0 && b === 0) return [0, 0];
  let radius: number;
  let angle: number;
  if (Math.abs(a) > Math.abs(b)) {
    radius = a;
    angle = (Math.PI / 4) * (b / a);
  } else {
    radius = b;
    angle = Math.PI / 2 - (Math.PI / 4) * (a / b);
  }
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
};

/** Creates deterministic M5S proposal strategies. Halton points are true prefixes. */
export const createGroundGlassM5sProposalStrategy = (input: Readonly<{
  method: GroundGlassM5sSamplingMethod;
  sampleCount: GroundGlassM5sSampleCount;
  seed?: number;
}>): GroundGlassM5sProposalStrategy => {
  assertSampleCount(input.sampleCount);
  if (input.method === "seeded-stratified-square-to-disk") {
    if (!Number.isSafeInteger(input.seed) || input.seed! < 0 || input.seed! > 0xffff_ffff) {
      throw new RangeError("Seeded M5S proposals require a uint32 seed");
    }
  } else if (input.seed !== undefined) {
    throw new RangeError("Only seeded stratified M5S proposals accept a seed");
  }

  const seed = input.seed ?? null;
  const descriptor: GroundGlassM5sProposalDescriptor = Object.freeze({
    method: input.method,
    sequenceId: input.method === "golden-angle-count-dependent"
      ? "golden-angle-sqrt-index-plus-half-v1"
      : input.method === "halton-2-3-progressive"
        ? "halton-base-2-3-equal-area-polar-v1"
        : "seeded-jittered-equal-area-square-grid-concentric-v1",
    algorithmRevision: GROUND_GLASS_M5S_PROPOSAL_ALGORITHM_REVISION,
    sampleCount: input.sampleCount,
    seed,
    progressivePrefix: input.method === "halton-2-3-progressive",
  });

  const proposalAt = (index: number): GroundGlassPixelAxis => {
    if (!Number.isInteger(index) || index < 0 || index >= input.sampleCount) {
      throw new RangeError("M5S proposal index is outside the selected sample count");
    }
    if (input.method === "golden-angle-count-dependent") {
      return groundGlassGoldenAngleDiskProposal(index, input.sampleCount);
    }
    if (input.method === "halton-2-3-progressive") {
      const u = radicalInverse(index + 1, 2);
      const v = radicalInverse(index + 1, 3);
      const radius = Math.sqrt(u);
      const angle = 2 * Math.PI * v;
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    }
    const columns = 2 ** Math.floor(Math.log2(Math.sqrt(input.sampleCount)));
    const rows = input.sampleCount / columns;
    const column = index % columns;
    const row = Math.floor(index / columns);
    const u = (column + seededUnit(input.seed!, index, 0)) / columns;
    const v = (row + seededUnit(input.seed!, index, 1)) / rows;
    return concentricSquareToDisk(u, v);
  };

  return Object.freeze({ descriptor, proposalAt });
};

export const groundGlassM5sProposalIdentityKey = (
  descriptor: GroundGlassM5sProposalDescriptor,
): string => JSON.stringify([
  descriptor.method,
  descriptor.sequenceId,
  descriptor.sampleCount,
  descriptor.seed,
  descriptor.algorithmRevision,
]);

/**
 * Fingerprints proposal coordinates using a canonical binary representation:
 * each x then y coordinate is encoded as IEEE-754 binary64, little-endian,
 * in proposal order, then folded through FNV-1a 64-bit. This is a reproducible
 * integrity checksum, not a cryptographic hash.
 */
export const fingerprintGroundGlassM5sProposalCoordinates = (
  strategy: GroundGlassM5sProposalStrategy,
): string => {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  for (let index = 0; index < strategy.descriptor.sampleCount; index += 1) {
    const point = strategy.proposalAt(index);
    for (const coordinate of point) {
      if (!Number.isFinite(coordinate)) throw new RangeError("Cannot fingerprint a non-finite M5S proposal");
      view.setFloat64(0, coordinate, true);
      for (let byteIndex = 0; byteIndex < 8; byteIndex += 1) {
        hash ^= BigInt(view.getUint8(byteIndex));
        hash = (hash * prime) & mask;
      }
    }
  }
  return `fnv1a64-f64le-v1:${hash.toString(16).padStart(16, "0")}`;
};

/** Audits proposal integrity and basic spatial coverage before numerical use. */
export const auditGroundGlassM5sProposalStrategy = (
  strategy: GroundGlassM5sProposalStrategy,
): GroundGlassM5sProposalAudit => {
  const count = strategy.descriptor.sampleCount;
  const issues: string[] = [];
  if (!(GROUND_GLASS_M5S_SAMPLE_COUNTS as readonly number[]).includes(count)) {
    issues.push("sample count is outside the declared M5S tiers");
  }
  const seen = new Set<string>();
  const points: GroundGlassPixelAxis[] = [];
  const radialBands = [0, 0, 0, 0];
  const angularSectors = [0, 0, 0, 0, 0, 0, 0, 0];
  let duplicateCount = 0;
  let nonFiniteCount = 0;
  let outsideCount = 0;
  let sumX = 0;
  let sumY = 0;
  let sumRadius = 0;
  let sumRadiusSquared = 0;
  let minimumRadius = Number.POSITIVE_INFINITY;
  let maximumRadius = 0;

  for (let index = 0; index < count; index += 1) {
    const point = strategy.proposalAt(index);
    const [x, y] = point;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      nonFiniteCount += 1;
      continue;
    }
    const radiusSquared = x * x + y * y;
    const radius = Math.sqrt(radiusSquared);
    if (radiusSquared > 1 + 1e-12) outsideCount += 1;
    const key = x.toPrecision(17) + "," + y.toPrecision(17);
    if (seen.has(key)) duplicateCount += 1;
    seen.add(key);
    points.push([x, y]);
    sumX += x;
    sumY += y;
    sumRadius += radius;
    sumRadiusSquared += radiusSquared;
    minimumRadius = Math.min(minimumRadius, radius);
    maximumRadius = Math.max(maximumRadius, radius);
    if (radiusSquared <= 1) {
      radialBands[Math.min(3, Math.floor(radiusSquared * 4))]! += 1;
      const angle = (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
      angularSectors[Math.min(7, Math.floor(angle / (Math.PI / 4)))]! += 1;
    }
  }

  let nearestNeighborTotal = 0;
  if (points.length >= 2) {
    const gridSide = Math.ceil(Math.sqrt(points.length));
    const cellWidth = 2 / gridSide;
    const cellFor = (coordinate: number): number => Math.min(gridSide - 1,
      Math.max(0, Math.floor((coordinate + 1) / cellWidth)));
    const bucketKey = (x: number, y: number): number => y * gridSide + x;
    const buckets = new Map<number, number[]>();
    const cells = points.map(([x, y], index) => {
      const cellX = cellFor(x);
      const cellY = cellFor(y);
      const key = bucketKey(cellX, cellY);
      const members = buckets.get(key) ?? [];
      members.push(index);
      buckets.set(key, members);
      return [cellX, cellY] as const;
    });
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]!;
      const [cellX, cellY] = cells[index]!;
      let nearest = Number.POSITIVE_INFINITY;
      for (let radius = 0; radius < gridSide; radius += 1) {
        for (let y = Math.max(0, cellY - radius); y <= Math.min(gridSide - 1, cellY + radius); y += 1) {
          for (let x = Math.max(0, cellX - radius); x <= Math.min(gridSide - 1, cellX + radius); x += 1) {
            for (const otherIndex of buckets.get(bucketKey(x, y)) ?? []) {
              if (otherIndex === index) continue;
              const other = points[otherIndex]!;
              nearest = Math.min(nearest, Math.hypot(point[0] - other[0], point[1] - other[1]));
            }
          }
        }
        // Any point outside this cell square is at least `radius * cellWidth` away.
        if (nearest <= radius * cellWidth || radius === gridSide - 1) break;
      }
      nearestNeighborTotal += nearest;
    }
  }

  if (duplicateCount > 0) issues.push("proposal sequence contains duplicate points");
  if (nonFiniteCount > 0) issues.push("proposal sequence contains non-finite points");
  if (outsideCount > 0) issues.push("proposal sequence contains points outside the unit disk");
  if (points.length !== count) issues.push("proposal sequence does not contain the requested number of finite points");

  return {
    status: issues.length === 0 ? "valid" : "invalid",
    proposalCount: count,
    uniqueProposalCount: seen.size,
    duplicateCount,
    nonFiniteCount,
    outsideUnitDiskCount: outsideCount,
    centroid: count > 0 ? [sumX / count, sumY / count] : [Number.NaN, Number.NaN],
    minimumRadius: points.length > 0 ? minimumRadius : null,
    maximumRadius: points.length > 0 ? maximumRadius : null,
    meanRadius: points.length > 0 ? sumRadius / points.length : null,
    meanSquaredRadius: points.length > 0 ? sumRadiusSquared / points.length : null,
    radialAreaBandCounts: radialBands as [number, number, number, number],
    angularSectorCounts: angularSectors as [number, number, number, number, number, number, number, number],
    meanNearestNeighborDistance: points.length >= 2 ? nearestNeighborTotal / points.length : null,
    issues,
  };
};

const validDimensions = (dimensions: GroundGlassApertureDimensions): boolean =>
  isPositiveSafeInteger(dimensions.widthPx) && isPositiveSafeInteger(dimensions.heightPx);

const validateReferenceInput = (
  input: GroundGlassM5sFarReferenceInput,
  gatherPixelIds: readonly number[],
  budget: GroundGlassM5sReferenceBudget,
): void => {
  if (!validDimensions(input.source) || !validDimensions(input.gather)) {
    throw new RangeError("M5S source and gather dimensions must be positive safe integers");
  }
  const sourcePixelCount = input.source.widthPx * input.source.heightPx;
  const gatherPixelCount = input.gather.widthPx * input.gather.heightPx;
  if (!Number.isSafeInteger(sourcePixelCount) || !Number.isSafeInteger(gatherPixelCount)
      || input.sourceRgba.length !== sourcePixelCount * 4
      || input.physicalRgba.length !== sourcePixelCount * 4
      || input.validity.length !== sourcePixelCount
      || input.depth.length !== sourcePixelCount
      || input.observedGatherCenterSourceIds.length !== gatherPixelCount * 2
      || input.observedGatherCenterSourceUvs.length !== gatherPixelCount * 2
      || input.inverseProjectionMatrix.length !== 16) {
    throw new RangeError("M5S readback arrays must match the source and gather dimensions");
  }
  if (!Number.isFinite(input.film.widthMm) || input.film.widthMm <= 0
      || !Number.isFinite(input.film.heightMm) || input.film.heightMm <= 0
      || !Number.isFinite(input.maximumRadiusPx) || input.maximumRadiusPx < 0) {
    throw new RangeError("M5S film dimensions and radius cap must be finite and valid");
  }
  if (gatherPixelIds.length === 0 || gatherPixelIds.length > budget.maxRoiPixels) {
    throw new RangeError("M5S ROI pixel count exceeds its declared budget or is empty");
  }
  const seen = new Set<number>();
  for (const gatherPixelId of gatherPixelIds) {
    if (!Number.isSafeInteger(gatherPixelId) || gatherPixelId < 0 || gatherPixelId >= gatherPixelCount) {
      throw new RangeError("M5S ROI contains a gather pixel outside the output image");
    }
    if (seen.has(gatherPixelId)) throw new RangeError("M5S ROI contains duplicate gather pixel IDs");
    seen.add(gatherPixelId);
  }
};

const assertFiniteSample = (input: GroundGlassM5sFarReferenceInput, sourcePixelId: number): void => {
  const offset = sourcePixelId * 4;
  const values = [
    input.sourceRgba[offset],
    input.sourceRgba[offset + 1],
    input.sourceRgba[offset + 2],
    input.physicalRgba[offset],
    input.physicalRgba[offset + 1],
    input.physicalRgba[offset + 2],
    input.physicalRgba[offset + 3],
    input.depth[sourcePixelId],
  ];
  if (!values.every((value) => Number.isFinite(value))) {
    throw new RangeError("M5S selected source/depth/physical inputs must be finite");
  }
};

type SampledPixel = Readonly<{
  sourcePixelId: number;
  rgb: readonly [number, number, number];
  signedCocMm: number;
  depth: number;
}>;

const readSample = (
  input: GroundGlassM5sFarReferenceInput,
  sourcePixelId: number,
): SampledPixel => {
  assertFiniteSample(input, sourcePixelId);
  const offset = sourcePixelId * 4;
  return {
    sourcePixelId,
    rgb: [
      input.sourceRgba[offset]!,
      input.sourceRgba[offset + 1]!,
      input.sourceRgba[offset + 2]!,
    ],
    signedCocMm: input.physicalRgba[offset]!,
    depth: input.depth[sourcePixelId]!,
  };
};

const mappedCappedEllipseAt = (
  input: GroundGlassM5sFarReferenceInput,
  sourcePixelId: number,
) => {
  const offset = sourcePixelId * 4;
  return capGroundGlassPixelEllipse(mapGroundGlassPhysicalEllipseToSourcePixels({
    majorRadiusMm: input.physicalRgba[offset + 1]!,
    minorRadiusMm: input.physicalRgba[offset + 2]!,
    orientationRad: input.physicalRgba[offset + 3]! * Math.PI,
    film: input.film,
    source: input.source,
  }), input.maximumRadiusPx);
};

const sourcePixelAtUv = (
  input: GroundGlassM5sFarReferenceInput,
  uTop: number,
  vTop: number,
): number => {
  const boundedU = Math.fround(Math.min(1, Math.max(0, uTop)));
  const boundedV = Math.fround(Math.min(1, Math.max(0, vTop)));
  const point = nearestGroundGlassSourcePixelAtTopUv(boundedU, boundedV, input.source);
  return point[1] * input.source.widthPx + point[0];
};

const depthDistanceAtUv = (
  input: GroundGlassM5sFarReferenceInput,
  uTop: number,
  vTop: number,
  sampledDepth: number,
): number => groundGlassViewDistanceMmAtTopUv(
  uTop,
  vTop,
  sampledDepth,
  input.inverseProjectionMatrix,
);

const assertFingerprintValues = (fingerprints: GroundGlassM5sInputFingerprints): void => {
  const values = Object.values(fingerprints);
  if (values.some((value) => typeof value !== "string" || value.trim().length === 0)) {
    throw new RangeError("M5S input fingerprints must all be non-empty strings");
  }
};

export const runGroundGlassM5sSparseFarReference = (input: Readonly<{
  referenceInput: GroundGlassM5sFarReferenceInput;
  selectedGatherPixelIds: readonly number[];
  strategy: GroundGlassM5sProposalStrategy;
  budget?: Partial<GroundGlassM5sReferenceBudget>;
}>): GroundGlassM5sFarReferenceResult => {
  const budget = { ...DEFAULT_RUN_BUDGET, ...input.budget };
  const strategy = input.strategy;
  assertSampleCount(strategy.descriptor.sampleCount);
  if (strategy.descriptor.sampleCount > budget.maxSampleCount
      || strategy.descriptor.sampleCount > GROUND_GLASS_M5S_MAX_SAMPLE_COUNT) {
    throw new RangeError("M5S sample count exceeds the hard diagnostic limit");
  }
  const evaluatedProposalCount = strategy.descriptor.sampleCount * input.selectedGatherPixelIds.length;
  if (!Number.isSafeInteger(evaluatedProposalCount)
      || evaluatedProposalCount > budget.maxProposalEvaluations
      || evaluatedProposalCount > GROUND_GLASS_M5S_MAX_PROPOSAL_EVALUATIONS_PER_RUN) {
    throw new RangeError("M5S proposal evaluation count exceeds the declared run budget");
  }
  validateReferenceInput(input.referenceInput, input.selectedGatherPixelIds, budget);
  assertFingerprintValues(input.referenceInput.inputFingerprints);
  const proposalAudit = auditGroundGlassM5sProposalStrategy(strategy);
  if (proposalAudit.status !== "valid") {
    throw new RangeError("M5S invalid proposal sequence: " + proposalAudit.issues.join("; "));
  }
  const proposalCoordinateFingerprint = fingerprintGroundGlassM5sProposalCoordinates(strategy);

  const startedAt = Date.now();
  const results: GroundGlassM5sFarPixelResult[] = [];
  const sourceWidth = input.referenceInput.source.widthPx;
  const toleranceMm = (distanceMm: number): number => Math.max(
    GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FLOOR_MM,
    distanceMm * GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FRACTION,
  );

  for (const gatherPixelId of input.selectedGatherPixelIds) {
    const centerX = input.referenceInput.observedGatherCenterSourceIds[gatherPixelId * 2]!;
    const centerY = input.referenceInput.observedGatherCenterSourceIds[gatherPixelId * 2 + 1]!;
    if (!Number.isSafeInteger(centerX) || !Number.isSafeInteger(centerY)
        || centerX < 0 || centerY < 0
        || centerX >= input.referenceInput.source.widthPx
        || centerY >= input.referenceInput.source.heightPx) {
      throw new RangeError("M5S observed gather-center source ID is outside the source image");
    }
    const centerSourceId = centerY * sourceWidth + centerX;
    const centerUv: GroundGlassPixelAxis = [
      input.referenceInput.observedGatherCenterSourceUvs[gatherPixelId * 2]!,
      input.referenceInput.observedGatherCenterSourceUvs[gatherPixelId * 2 + 1]!,
    ];
    if (!centerUv.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
      throw new RangeError("M5S observed gather-center UV must be finite and in [0,1]");
    }

    const center = readSample(input.referenceInput, centerSourceId);
    const centerViewDistance = depthDistanceAtUv(
      input.referenceInput, centerUv[0], centerUv[1], center.depth,
    );
    const centerEligibleFar = input.referenceInput.validity[centerSourceId] === GROUND_GLASS_APERTURE_VALIDITY_CODE
      && center.signedCocMm > GROUND_GLASS_APERTURE_SIGN_EPSILON_MM;
    const ellipse = mappedCappedEllipseAt(input.referenceInput, centerSourceId);
    const centerContributionWeight: 0 | 1 = centerEligibleFar ? 1 : 0;
    const finiteNumerator = [center.rgb[0] * centerContributionWeight,
      center.rgb[1] * centerContributionWeight, center.rgb[2] * centerContributionWeight];
    let finiteWeight = centerContributionWeight;
    const limitingNumerator = [0, 0, 0];
    let acceptedProposalCount = 0;

    for (let sampleIndex = 0; sampleIndex < strategy.descriptor.sampleCount; sampleIndex += 1) {
      const proposal = strategy.proposalAt(sampleIndex);
      const offsetX = (ellipse.majorAxisPx[0] * proposal[0] + ellipse.minorAxisPx[0] * proposal[1])
        * ellipse.clampScale;
      const offsetY = (ellipse.majorAxisPx[1] * proposal[0] + ellipse.minorAxisPx[1] * proposal[1])
        * ellipse.clampScale;
      const sampleUv: GroundGlassPixelAxis = [
        centerUv[0] + offsetX / input.referenceInput.source.widthPx,
        centerUv[1] + offsetY / input.referenceInput.source.heightPx,
      ];
      const sampleSourceId = sourcePixelAtUv(input.referenceInput, sampleUv[0], sampleUv[1]);
      const sample = readSample(input.referenceInput, sampleSourceId);
      const sampleViewDistance = depthDistanceAtUv(
        input.referenceInput,
        Math.fround(Math.min(1, Math.max(0, sampleUv[0]))),
        Math.fround(Math.min(1, Math.max(0, sampleUv[1]))),
        sample.depth,
      );
      const accepted = centerEligibleFar
        && input.referenceInput.validity[sampleSourceId] === GROUND_GLASS_APERTURE_VALIDITY_CODE
        && sample.depth < 1
        && sample.signedCocMm >= -GROUND_GLASS_APERTURE_SIGN_EPSILON_MM
        && sampleViewDistance >= centerViewDistance - toleranceMm(centerViewDistance);
      if (!accepted) continue;

      acceptedProposalCount += 1;
      finiteWeight += 1;
      finiteNumerator[0]! += sample.rgb[0];
      finiteNumerator[1]! += sample.rgb[1];
      finiteNumerator[2]! += sample.rgb[2];
      limitingNumerator[0]! += sample.rgb[0];
      limitingNumerator[1]! += sample.rgb[1];
      limitingNumerator[2]! += sample.rgb[2];
    }

    const finiteEstimatorRgb = finiteWeight > 0
      ? [
        finiteNumerator[0]! / finiteWeight,
        finiteNumerator[1]! / finiteWeight,
        finiteNumerator[2]! / finiteWeight,
      ] as const
      : center.rgb;
    const limitingIntegralRgb = acceptedProposalCount > 0
      ? [
        limitingNumerator[0]! / acceptedProposalCount,
        limitingNumerator[1]! / acceptedProposalCount,
        limitingNumerator[2]! / acceptedProposalCount,
      ] as const
      : null;
    results.push({
      gatherPixelId,
      centerSourceId,
      centerEligibleFar,
      uncappedMaximumRadiusPx: ellipse.uncappedMaximumRadiusPx,
      effectiveMaximumRadiusPx: ellipse.effectiveMaximumRadiusPx,
      capApplied: ellipse.capApplied,
      centerRgb: center.rgb,
      finiteEstimatorRgb,
      limitingIntegralRgb,
      centerContributionWeight,
      acceptedProposalCount,
      finiteEstimatorWeightSum: finiteWeight,
      centerContributionFraction: finiteWeight > 0 ? centerContributionWeight / finiteWeight : 0,
    });
  }

  return {
    algorithm: "ground-glass-m5s-sparse-far-v1",
    targetSemantics: "finite-estimator-and-limiting-conditional-integral",
    descriptor: strategy.descriptor,
    proposalAudit,
    proposalCoordinateFingerprint,
    inputFingerprints: input.referenceInput.inputFingerprints,
    selectedGatherPixelIds: [...input.selectedGatherPixelIds],
    evaluatedProposalCount,
    elapsedMs: Date.now() - startedAt,
    pixels: results,
  };
};

export const runGroundGlassM5sReferenceMatrix = (input: Readonly<{
  referenceInput: GroundGlassM5sFarReferenceInput;
  selectedGatherPixelIds: readonly number[];
  sampleCounts?: readonly GroundGlassM5sSampleCount[];
  stratifiedSeeds?: readonly number[];
}>): readonly GroundGlassM5sFarReferenceResult[] => {
  const sampleCounts = input.sampleCounts ?? GROUND_GLASS_M5S_SAMPLE_COUNTS;
  const seeds = input.stratifiedSeeds ?? [104729, 130363, 155921, 196613];
  if (sampleCounts.length === 0 || sampleCounts.length > GROUND_GLASS_M5S_SAMPLE_COUNTS.length
      || seeds.length === 0 || seeds.length > 8
      || new Set(sampleCounts).size !== sampleCounts.length
      || new Set(seeds).size !== seeds.length
      || seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff)) {
    throw new RangeError("M5S matrix requires unique bounded tiers and one to eight uint32 seeds");
  }
  for (const count of sampleCounts) assertSampleCount(count);
  const plannedRuns = sampleCounts.length * (2 + seeds.length);
  const plannedEvaluations = input.selectedGatherPixelIds.length
    * sampleCounts.reduce((sum, count) => sum + count * (2 + seeds.length), 0);
  if (plannedRuns > GROUND_GLASS_M5S_MAX_SEQUENCE_RUNS
      || plannedEvaluations > GROUND_GLASS_M5S_MAX_TOTAL_PROPOSAL_EVALUATIONS) {
    throw new RangeError("M5S reference matrix exceeds its sequence or total proposal budget");
  }

  const results: GroundGlassM5sFarReferenceResult[] = [];
  for (const sampleCount of sampleCounts) {
    const strategies = [
      createGroundGlassM5sProposalStrategy({ method: "golden-angle-count-dependent", sampleCount }),
      createGroundGlassM5sProposalStrategy({ method: "halton-2-3-progressive", sampleCount }),
      ...seeds.map((seed) => createGroundGlassM5sProposalStrategy({
        method: "seeded-stratified-square-to-disk",
        sampleCount,
        seed,
      })),
    ];
    for (const strategy of strategies) {
      results.push(runGroundGlassM5sSparseFarReference({
        referenceInput: input.referenceInput,
        selectedGatherPixelIds: input.selectedGatherPixelIds,
        strategy,
      }));
    }
  }
  return results;
};

export type GroundGlassM5sRgbMetrics = Readonly<{
  status: "measured" | "invalid-comparison";
  valueCount: number;
  mae: number | null;
  rmse: number | null;
  maximumChannelError: number | null;
  maximumErrorIndex: number;
  p50AbsoluteError: number | null;
  p90AbsoluteError: number | null;
  p99AbsoluteError: number | null;
}>;

export const compareGroundGlassM5sRgb = (
  first: ArrayLike<number>,
  second: ArrayLike<number>,
): GroundGlassM5sRgbMetrics => {
  if (first.length === 0 || first.length !== second.length || first.length % 3 !== 0) {
    return {
      status: "invalid-comparison", valueCount: 0, mae: null, rmse: null,
      maximumChannelError: null, maximumErrorIndex: -1,
      p50AbsoluteError: null, p90AbsoluteError: null, p99AbsoluteError: null,
    };
  }
  let sumAbsolute = 0;
  let sumSquared = 0;
  let maxError = 0;
  let maxIndex = -1;
  const pixelErrors: number[] = [];
  for (let index = 0; index < first.length; index += 1) {
    const a = first[index]!;
    const b = second[index]!;
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return {
        status: "invalid-comparison", valueCount: first.length / 3, mae: null, rmse: null,
        maximumChannelError: null, maximumErrorIndex: -1,
        p50AbsoluteError: null, p90AbsoluteError: null, p99AbsoluteError: null,
      };
    }
    const error = Math.abs(a - b);
    sumAbsolute += error;
    sumSquared += error * error;
    if (error > maxError) {
      maxError = error;
      maxIndex = index;
    }
    pixelErrors[Math.floor(index / 3)] = Math.max(pixelErrors[Math.floor(index / 3)] ?? 0, error);
  }
  pixelErrors.sort((a, b) => a - b);
  const percentile = (fraction: number): number => pixelErrors[
    Math.min(pixelErrors.length - 1, Math.floor((pixelErrors.length - 1) * fraction))
  ]!;
  return {
    status: "measured",
    valueCount: first.length / 3,
    mae: sumAbsolute / first.length,
    rmse: Math.sqrt(sumSquared / first.length),
    maximumChannelError: maxError,
    maximumErrorIndex: maxIndex,
    p50AbsoluteError: percentile(0.5),
    p90AbsoluteError: percentile(0.9),
    p99AbsoluteError: percentile(0.99),
  };
};

/** Evaluates a supplied unit-disk function with the same audited proposal strategy. */
export const integrateGroundGlassM5sUnitDiskFunction = (
  strategy: GroundGlassM5sProposalStrategy,
  evaluate: (point: GroundGlassPixelAxis) => number,
): number => {
  const audit = auditGroundGlassM5sProposalStrategy(strategy);
  if (audit.status !== "valid") throw new RangeError("M5S disk integration rejected invalid proposals");
  let sum = 0;
  for (let index = 0; index < strategy.descriptor.sampleCount; index += 1) {
    const value = evaluate(strategy.proposalAt(index));
    if (!Number.isFinite(value)) throw new RangeError("M5S analytic integrand must be finite");
    sum += value;
  }
  return sum / strategy.descriptor.sampleCount;
};

