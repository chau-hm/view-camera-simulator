import { planeFromPointNormal } from "../../../core/math/plane";
import { rotateAroundX, vec } from "../../../core/math/vec";
import { computePhysicalBlurFootprint, deriveOrthonormalPlaneBasis } from "../../../core/optics/computePhysicalBlurFootprint";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../../core/optics/physicalSharpness";
import { resolveGroundGlassCocStorageMaxMm } from "../../../render/groundGlassCocTarget";

export type PhysicalStorageSample = Readonly<{
  id: string;
  source: "synthetic-storage-vector" | "canonical-physical-footprint";
  signedCoCDiameterMm: number;
  majorRadiusMm: number;
  minorRadiusMm: number;
  orientationRad: number;
}>;

export type Binary16RangeProbeSample = Readonly<{
  id: string;
  signedCoCDiameterMm: number;
  majorRadiusMm: number;
  minorRadiusMm: number;
  orientationRad: number;
}>;

export const MAX_FINITE_BINARY16 = 65504;

export const STORAGE_TEST_RENDER_WIDTH_PX = 425;
export const STORAGE_TEST_FILM_WIDTH_MM = 127;
export const STORAGE_TEST_MAXIMUM_GATHER_RADIUS_PX = 60;
export const SIGNED_COC_STORAGE_MAX_MM = resolveGroundGlassCocStorageMaxMm({
  maximumCoCRadiusPx: STORAGE_TEST_MAXIMUM_GATHER_RADIUS_PX,
  filmWidthMm: STORAGE_TEST_FILM_WIDTH_MM,
  renderWidthPx: STORAGE_TEST_RENDER_WIDTH_PX,
});
export const FOOTPRINT_STORAGE_MAX_MM = SIGNED_COC_STORAGE_MAX_MM / 2;

const focusDistanceMm = 1000;
const focalLengthMm = 150;
const apertureFNumber = 8;
const focusedImageDistanceMm = (focalLengthMm * focusDistanceMm) /
  (focusDistanceMm - focalLengthMm);
const filmBasisX = vec(1, 0, 0);
const filmBasisY = vec(0, 1, 0);
const lensNormal = vec(0, 0, 1);
const lensCenter = vec(0, 0, 0);

const canonicalFootprint = (input: {
  id: string;
  objectPoint: ReturnType<typeof vec>;
  filmPoint: ReturnType<typeof vec>;
  filmNormal: ReturnType<typeof vec>;
  basisX: ReturnType<typeof vec>;
  basisY: ReturnType<typeof vec>;
}): PhysicalStorageSample => {
  const result = computePhysicalBlurFootprint({
    objectPoint: input.objectPoint,
    lensCenter,
    lensPlaneNormal: lensNormal,
    lensPlaneBasisX: filmBasisX,
    lensPlaneBasisY: filmBasisY,
    filmPlane: planeFromPointNormal(input.filmPoint, input.filmNormal),
    filmPlaneBasisX: input.basisX,
    filmPlaneBasisY: input.basisY,
    focalLengthMm,
    apertureFNumber,
  });
  if (!result.valid) throw new Error(`Canonical physical storage sample ${input.id} did not resolve`);
  return {
    id: input.id,
    source: "canonical-physical-footprint",
    signedCoCDiameterMm: result.signedCoCDiameterMm,
    majorRadiusMm: result.majorRadiusMm,
    minorRadiusMm: result.minorRadiusMm,
    orientationRad: result.orientationRad,
  };
};

const parallelFilmPoint = vec(0, 0, -focusedImageDistanceMm);
const parallelFilmNormal = vec(0, 0, 1);
const tiltedFilmNormal = rotateAroundX(lensNormal, 25);
const tiltedFilmUp = rotateAroundX(filmBasisY, 25);
const tiltedFilmBasis = deriveOrthonormalPlaneBasis(tiltedFilmNormal, filmBasisX, tiltedFilmUp);
if (!tiltedFilmBasis) throw new Error("Canonical tilted-film basis did not resolve");

/**
 * Fixed physical and storage-boundary inputs. The GPU writer receives these
 * physical values; expected encoded results are computed independently by the
 * Playwright CPU oracle using the existing production codec functions.
 */
export const PHYSICAL_STORAGE_SAMPLES: readonly PhysicalStorageSample[] = [
  {
    id: "adjacent-negative",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: -8,
    majorRadiusMm: 0.5,
    minorRadiusMm: 0.25,
    orientationRad: Math.PI / 3,
  },
  {
    id: "adjacent-positive",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: 8,
    majorRadiusMm: 0.5,
    minorRadiusMm: 0.25,
    orientationRad: Math.PI / 3,
  },
  {
    id: "exact-neutral",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: 0,
    majorRadiusMm: 0,
    minorRadiusMm: 0,
    orientationRad: 0,
  },
  {
    id: "near-acceptable-negative",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: -0.169,
    majorRadiusMm: 0.0845,
    minorRadiusMm: 0.0845,
    orientationRad: 0,
  },
  {
    id: "near-acceptable-positive",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: 0.169,
    majorRadiusMm: 0.0845,
    minorRadiusMm: 0.0845,
    orientationRad: 0,
  },
  {
    id: "sub-byte-sign-negative",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: -0.01,
    majorRadiusMm: 0.005,
    minorRadiusMm: 0.0025,
    orientationRad: 0.001,
  },
  {
    id: "sub-byte-sign-positive",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: 0.01,
    majorRadiusMm: 0.005,
    minorRadiusMm: 0.0025,
    orientationRad: Math.PI - 0.001,
  },
  canonicalFootprint({
    id: "canonical-near-side",
    objectPoint: vec(0, 0, 800),
    filmPoint: parallelFilmPoint,
    filmNormal: parallelFilmNormal,
    basisX: filmBasisX,
    basisY: filmBasisY,
  }),
  canonicalFootprint({
    id: "canonical-far-side",
    objectPoint: vec(0, 0, 1500),
    filmPoint: parallelFilmPoint,
    filmNormal: parallelFilmNormal,
    basisX: filmBasisX,
    basisY: filmBasisY,
  }),
  canonicalFootprint({
    id: "canonical-tilted-anisotropic",
    objectPoint: vec(30, 20, 1000),
    filmPoint: vec(0, 0, -160),
    filmNormal: tiltedFilmNormal,
    basisX: tiltedFilmBasis.x,
    basisY: tiltedFilmBasis.y,
  }),
  {
    id: "strong-ellipse-near-pi",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: -0.75,
    majorRadiusMm: 2,
    minorRadiusMm: 0.5,
    orientationRad: Math.PI - 0.0001,
  },
  {
    id: "near-degenerate-minor",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: 0.25,
    majorRadiusMm: 0.125,
    minorRadiusMm: 0.0001,
    orientationRad: 0.001,
  },
  {
    id: "in-range-channel-layout",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: 8,
    majorRadiusMm: 2.5,
    minorRadiusMm: 1,
    orientationRad: Math.PI / 3,
  },
  {
    id: "over-range-pair-scale",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: 1.25,
    majorRadiusMm: 40,
    minorRadiusMm: 10,
    orientationRad: -Math.PI / 4,
  },
  {
    id: "over-range-negative-coc",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: -50,
    majorRadiusMm: 25,
    minorRadiusMm: 5,
    orientationRad: Math.PI / 6,
  },
  {
    id: "over-range-positive-coc",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: 50,
    majorRadiusMm: 25,
    minorRadiusMm: 5,
    orientationRad: Math.PI / 6,
  },
  {
    id: "invalid-axis-ordering",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: 0,
    majorRadiusMm: 1,
    minorRadiusMm: 2,
    orientationRad: 0,
  },
  {
    id: "sharpness-boundary-negative",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: -ACCEPTABLE_COC_DIAMETER_MM,
    majorRadiusMm: 0.05,
    minorRadiusMm: 0.025,
    orientationRad: 0.41,
  },
  {
    id: "sharpness-boundary-positive",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: ACCEPTABLE_COC_DIAMETER_MM,
    majorRadiusMm: 0.05,
    minorRadiusMm: 0.025,
    orientationRad: 1.17,
  },
  {
    id: "byte-neutral-transition-negative",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: -0.14,
    majorRadiusMm: 0.07,
    minorRadiusMm: 0.035,
    orientationRad: 0.63,
  },
  {
    id: "byte-neutral-transition-positive",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: 0.14,
    majorRadiusMm: 0.07,
    minorRadiusMm: 0.035,
    orientationRad: 0.91,
  },
  {
    id: "byte-sign-transition-negative",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: -0.15,
    majorRadiusMm: 0.075,
    minorRadiusMm: 0.0375,
    orientationRad: 0.73,
  },
  {
    id: "byte-sign-transition-positive",
    source: "synthetic-storage-vector",
    signedCoCDiameterMm: 0.15,
    majorRadiusMm: 0.075,
    minorRadiusMm: 0.0375,
    orientationRad: 1.03,
  },
];

/**
 * Synthetic finite float32 values that probe the native rgba16float boundary.
 * These are representation tests, not realistic optical scene outputs.
 */
export const BINARY16_RANGE_PROBE_SAMPLES: readonly Binary16RangeProbeSample[] = [
  { id: "zero", signedCoCDiameterMm: 0, majorRadiusMm: 0, minorRadiusMm: 0, orientationRad: 0 },
  { id: "small-0.01-mm", signedCoCDiameterMm: 0.01, majorRadiusMm: 0.01, minorRadiusMm: 0.005, orientationRad: 0.4 },
  { id: "ordinary-1-mm", signedCoCDiameterMm: 1, majorRadiusMm: 1, minorRadiusMm: 0.5, orientationRad: 0.7 },
  { id: "large-1000-mm", signedCoCDiameterMm: 1000, majorRadiusMm: 1000, minorRadiusMm: 500, orientationRad: 1.1 },
  { id: "maximum-finite-positive", signedCoCDiameterMm: MAX_FINITE_BINARY16, majorRadiusMm: MAX_FINITE_BINARY16, minorRadiusMm: 32752, orientationRad: 0.5 },
  { id: "slightly-above-maximum-positive", signedCoCDiameterMm: 65505, majorRadiusMm: 65505, minorRadiusMm: 32752, orientationRad: 0.5 },
  { id: "binary16-overflow-edge-positive", signedCoCDiameterMm: 65520, majorRadiusMm: 65520, minorRadiusMm: 32760, orientationRad: 0.5 },
  { id: "clearly-overflow-positive", signedCoCDiameterMm: 100000, majorRadiusMm: 100000, minorRadiusMm: 50000, orientationRad: 0.5 },
  { id: "maximum-finite-negative", signedCoCDiameterMm: -MAX_FINITE_BINARY16, majorRadiusMm: MAX_FINITE_BINARY16, minorRadiusMm: 32752, orientationRad: 0.5 },
  { id: "slightly-above-maximum-negative", signedCoCDiameterMm: -65505, majorRadiusMm: 65505, minorRadiusMm: 32752, orientationRad: 0.5 },
  { id: "binary16-overflow-edge-negative", signedCoCDiameterMm: -65520, majorRadiusMm: 65520, minorRadiusMm: 32760, orientationRad: 0.5 },
  { id: "clearly-overflow-negative", signedCoCDiameterMm: -100000, majorRadiusMm: 100000, minorRadiusMm: 50000, orientationRad: 0.5 },
  { id: "oversized-ellipse-axes", signedCoCDiameterMm: 1, majorRadiusMm: 100000, minorRadiusMm: 65520, orientationRad: 0.7 },
];
