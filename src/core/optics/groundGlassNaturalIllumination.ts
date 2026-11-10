import type {
  GroundGlassNaturalIlluminationState,
  Plane,
  Ray,
  StandardFrame,
  Vec3,
} from "../../types/optics";
import { cross, dot, isFiniteVec3, magnitude, scale, subtract } from "../math/vec";
import { intersectRayPlane } from "../math/ray";
import { deriveGroundGlassParallelFilmGeometry } from "./groundGlassParallelFilmGeometry";

export type GroundGlassNaturalIlluminationGeometry = Readonly<{
  lensCenterWorld: Vec3;
  filmPlane: Plane;
  rearStandardFrame: StandardFrame;
  opticalAxis: Ray;
}>;

export const createNeutralGroundGlassNaturalIllumination = (
  reason: "non-parallel-lens-film" | "invalid-geometry",
): GroundGlassNaturalIlluminationState => ({
  kind: "neutral",
  reason,
});

const unitVectorOrNull = (value: Vec3): Vec3 | null => {
  if (!isFiniteVec3(value)) return null;
  const length = magnitude(value);
  if (!Number.isFinite(length) || length <= 1e-9) return null;
  return scale(value, 1 / length);
};

const tupleInFrame = (
  value: Vec3,
  right: Vec3,
  up: Vec3,
  normal: Vec3,
): readonly [number, number, number] => [
  dot(value, right),
  dot(value, up),
  dot(value, normal),
];

const tupleIsFinite = (value: readonly number[]): boolean =>
  value.length === 3 && value.every(Number.isFinite);

/**
 * For constant-radiance, unobstructed thin-pupil geometry, relative irradiance
 * is proportional to projected pupil response × film incidence / distance².
 * The state normalizes this ratio at the image-axis/film-plane intersection;
 * it does not model pupil clipping, measured lens transmission, or elements.
 */
const deriveNonparallelGeometricState = (
  geometry: GroundGlassNaturalIlluminationGeometry,
): GroundGlassNaturalIlluminationState => {
  const { lensCenterWorld, filmPlane, rearStandardFrame, opticalAxis } = geometry;
  if (
    !isFiniteVec3(lensCenterWorld) ||
    !isFiniteVec3(filmPlane.point) ||
    !isFiniteVec3(filmPlane.normal) ||
    !Number.isFinite(filmPlane.distance) ||
    !isFiniteVec3(rearStandardFrame.centerWorld) ||
    !isFiniteVec3(rearStandardFrame.rightWorld) ||
    !isFiniteVec3(rearStandardFrame.upWorld) ||
    !isFiniteVec3(rearStandardFrame.normalWorld) ||
    !isFiniteVec3(opticalAxis.origin) ||
    !isFiniteVec3(opticalAxis.direction)
  ) {
    return createNeutralGroundGlassNaturalIllumination("invalid-geometry");
  }

  const right = unitVectorOrNull(rearStandardFrame.rightWorld);
  const up = unitVectorOrNull(rearStandardFrame.upWorld);
  const normal = unitVectorOrNull(rearStandardFrame.normalWorld);
  const filmNormal = unitVectorOrNull(filmPlane.normal);
  const imageSideAxis = unitVectorOrNull(scale(opticalAxis.direction, -1));
  if (!right || !up || !normal || !filmNormal || !imageSideAxis) {
    return createNeutralGroundGlassNaturalIllumination("invalid-geometry");
  }

  const axisOriginDelta = subtract(opticalAxis.origin, lensCenterWorld);
  const frameOrthogonality = [dot(right, up), dot(right, normal), dot(up, normal)];
  const normalizedFilmPlane = {
    point: filmPlane.point,
    normal: filmNormal,
    distance: dot(filmNormal, filmPlane.point),
  };
  if (
    magnitude(axisOriginDelta) > 1e-6 ||
    frameOrthogonality.some((value) => Math.abs(value) > 1e-6) ||
    Math.abs(dot(normal, filmNormal)) < 1 - 1e-6 ||
    Math.abs(dot(filmNormal, subtract(rearStandardFrame.centerWorld, filmPlane.point))) > 1e-5
  ) {
    return createNeutralGroundGlassNaturalIllumination("invalid-geometry");
  }

  const imageAxisPlaneIntersection = intersectRayPlane(
    { origin: lensCenterWorld, direction: imageSideAxis },
    normalizedFilmPlane,
  );
  if (
    !imageAxisPlaneIntersection ||
    !Number.isFinite(imageAxisPlaneIntersection.distance) ||
    imageAxisPlaneIntersection.distance <= 0
  ) {
    return createNeutralGroundGlassNaturalIllumination("invalid-geometry");
  }

  const lensToFilmCenterWorld = subtract(rearStandardFrame.centerWorld, lensCenterWorld);
  const lensSideNormalDot = dot(subtract(lensCenterWorld, rearStandardFrame.centerWorld), normal);
  if (!Number.isFinite(lensSideNormalDot) || Math.abs(lensSideNormalDot) <= 1e-9) {
    return createNeutralGroundGlassNaturalIllumination("invalid-geometry");
  }
  const filmNormalTowardLensSign: -1 | 1 = lensSideNormalDot < 0 ? -1 : 1;
  const referenceFilmIncidenceCosine =
    -filmNormalTowardLensSign * dot(imageSideAxis, normal);
  const referenceImageDistanceMm = imageAxisPlaneIntersection.distance;
  const lensToFilmCenterLocalMm = tupleInFrame(lensToFilmCenterWorld, right, up, normal);
  const imageSideAxisLocal = tupleInFrame(imageSideAxis, right, up, normal);
  if (
    !Number.isFinite(referenceFilmIncidenceCosine) ||
    referenceFilmIncidenceCosine <= 1e-9 ||
    referenceFilmIncidenceCosine > 1 + 1e-6 ||
    !Number.isFinite(referenceImageDistanceMm) ||
    !tupleIsFinite(lensToFilmCenterLocalMm) ||
    !tupleIsFinite(imageSideAxisLocal)
  ) {
    return createNeutralGroundGlassNaturalIllumination("invalid-geometry");
  }

  return {
    kind: "nonparallel-geometric",
    referenceImageDistanceMm,
    referenceFilmIncidenceCosine,
    lensToFilmCenterLocalMm,
    imageSideAxisLocal,
    filmNormalTowardLensSign,
  };
};

/**
 * Derive a physical rear-standard film-space natural-illumination model.
 * Exactly parallel geometry retains the established cos^4 implementation;
 * every nonzero plane angle uses the continuous geometric model.
 */
export const deriveGroundGlassNaturalIllumination = (
  geometry: GroundGlassNaturalIlluminationGeometry,
): GroundGlassNaturalIlluminationState => {
  const imageAxis = unitVectorOrNull(scale(geometry.opticalAxis.direction, -1));
  const filmNormal = unitVectorOrNull(geometry.filmPlane.normal);
  if (!imageAxis || !filmNormal) {
    return createNeutralGroundGlassNaturalIllumination("invalid-geometry");
  }

  const parallelDeviation = magnitude(cross(imageAxis, filmNormal));
  if (!Number.isFinite(parallelDeviation)) {
    return createNeutralGroundGlassNaturalIllumination("invalid-geometry");
  }
  if (parallelDeviation > 1e-10) return deriveNonparallelGeometricState(geometry);

  const parallelFilmGeometry = deriveGroundGlassParallelFilmGeometry({
    ...geometry,
    isParallelLensFilm: true,
  });
  return parallelFilmGeometry
    ? {
        kind: "parallel-cos4",
        imageDistanceMm: parallelFilmGeometry.imageDistanceMm,
        opticalAxisOffsetXMm: parallelFilmGeometry.opticalAxisOffsetXMm,
        opticalAxisOffsetYMm: parallelFilmGeometry.opticalAxisOffsetYMm,
      }
    : createNeutralGroundGlassNaturalIllumination("invalid-geometry");
};

/**
 * Resolve cos^4 natural illumination for one physical rear-standard film
 * point.  Inputs and offsets are millimetres; invalid state or points fail
 * closed to neutral rather than fabricating a finite optical result.
 */
export const calculateGroundGlassNaturalIlluminationGain = (
  state: GroundGlassNaturalIlluminationState,
  filmPointXMm: number,
  filmPointYMm: number,
): number => {
  if (!Number.isFinite(filmPointXMm) || !Number.isFinite(filmPointYMm)) {
    return 1;
  }

  if (state.kind === "nonparallel-geometric") {
    const {
      referenceImageDistanceMm,
      referenceFilmIncidenceCosine,
      lensToFilmCenterLocalMm,
      imageSideAxisLocal,
      filmNormalTowardLensSign,
    } = state;
    if (
      !Number.isFinite(referenceImageDistanceMm) || referenceImageDistanceMm <= 0 ||
      !Number.isFinite(referenceFilmIncidenceCosine) ||
      referenceFilmIncidenceCosine <= 0 || referenceFilmIncidenceCosine > 1 + 1e-6 ||
      !tupleIsFinite(lensToFilmCenterLocalMm) || !tupleIsFinite(imageSideAxisLocal) ||
      (filmNormalTowardLensSign !== -1 && filmNormalTowardLensSign !== 1)
    ) return 1;

    const axisLength = Math.hypot(...imageSideAxisLocal);
    if (!Number.isFinite(axisLength) || Math.abs(axisLength - 1) > 1e-6) return 1;
    const expectedReferenceIncidence = -filmNormalTowardLensSign * imageSideAxisLocal[2];
    if (
      !Number.isFinite(expectedReferenceIncidence) ||
      expectedReferenceIncidence <= 0 ||
      Math.abs(expectedReferenceIncidence - referenceFilmIncidenceCosine) > 1e-6 ||
      filmNormalTowardLensSign * lensToFilmCenterLocalMm[2] >= 0
    ) return 1;
    const qx = lensToFilmCenterLocalMm[0] + filmPointXMm;
    const qy = lensToFilmCenterLocalMm[1] + filmPointYMm;
    const qz = lensToFilmCenterLocalMm[2];
    const qLengthSquared = qx * qx + qy * qy + qz * qz;
    const lensProjectedPupil = imageSideAxisLocal[0] * qx +
      imageSideAxisLocal[1] * qy + imageSideAxisLocal[2] * qz;
    const filmIncidenceNumerator = -filmNormalTowardLensSign * qz;
    if (!Number.isFinite(qLengthSquared) || qLengthSquared <= 1e-18) return 1;
    if (!Number.isFinite(lensProjectedPupil) || !Number.isFinite(filmIncidenceNumerator)) return 1;
    if (lensProjectedPupil <= 0 || filmIncidenceNumerator <= 0) return 0;

    const gain = referenceImageDistanceMm * referenceImageDistanceMm *
      lensProjectedPupil * filmIncidenceNumerator /
      (qLengthSquared * qLengthSquared * referenceFilmIncidenceCosine);
    return Number.isFinite(gain) && gain >= 0 ? gain : 1;
  }

  if (state.kind !== "parallel-cos4" || !Number.isFinite(state.imageDistanceMm) ||
    state.imageDistanceMm <= 0 || !Number.isFinite(state.opticalAxisOffsetXMm) ||
    !Number.isFinite(state.opticalAxisOffsetYMm)) return 1;

  const deltaX = filmPointXMm - state.opticalAxisOffsetXMm;
  const deltaY = filmPointYMm - state.opticalAxisOffsetYMm;
  const imageDistanceSquared = state.imageDistanceMm * state.imageDistanceMm;
  const denominator = imageDistanceSquared + deltaX * deltaX + deltaY * deltaY;
  if (!Number.isFinite(denominator) || denominator <= 0) return 1;

  const cosineSquared = imageDistanceSquared / denominator;
  const gain = cosineSquared * cosineSquared;
  return Number.isFinite(gain) && gain >= 0 && gain <= 1 ? gain : 1;
};
