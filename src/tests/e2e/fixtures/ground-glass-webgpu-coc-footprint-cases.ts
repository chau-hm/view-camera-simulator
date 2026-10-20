import { planeFromPointNormal } from "../../../core/math/plane";
import { rotateAroundX, vec } from "../../../core/math/vec";
import { computePhysicalBlurFootprint, deriveOrthonormalPlaneBasis } from "../../../core/optics/computePhysicalBlurFootprint";
import { resolveGroundGlassCocStorageMaxMm } from "../../../render/groundGlassCocTarget";

export type PhysicalStorageSample = Readonly<{
  id: string;
  source: "synthetic-storage-vector" | "canonical-physical-footprint";
  signedCoCDiameterMm: number;
  majorRadiusMm: number;
  minorRadiusMm: number;
  orientationRad: number;
}>;

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
];
