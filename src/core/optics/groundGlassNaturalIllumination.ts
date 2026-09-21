import type {
  GroundGlassNaturalIlluminationState,
  Plane,
  Ray,
  StandardFrame,
  Vec3,
} from "../../types/optics";
import { intersectRayPlane } from "../math/ray";
import { calculateImageDistanceAlongOpticalAxisMm } from "./calculateImageDistance";
import { dot, isFiniteVec3, magnitude, scale, subtract } from "../math/vec";

export type GroundGlassNaturalIlluminationGeometry = Readonly<{
  lensCenterWorld: Vec3;
  filmPlane: Plane;
  rearStandardFrame: StandardFrame;
  opticalAxis: Ray;
  isParallelLensFilm: boolean;
}>;

export const createNeutralGroundGlassNaturalIllumination = (
  reason: "non-parallel-lens-film" | "invalid-geometry",
): GroundGlassNaturalIlluminationState => ({
  kind: "neutral",
  reason,
});

/**
 * Derive the physical film-space origin and distance for the parallel-film
 * cos^4 natural-illumination approximation.
 *
 * The canonical optical axis points from the lens towards the object.  The
 * image-side ray therefore uses the opposite direction when intersecting the
 * film plane.  This keeps front rise/shift effects in the same geometry used
 * by the rest of the optics model instead of re-deriving them from controls.
 */
export const deriveGroundGlassNaturalIllumination = (
  geometry: GroundGlassNaturalIlluminationGeometry,
): GroundGlassNaturalIlluminationState => {
  if (!geometry.isParallelLensFilm) {
    return createNeutralGroundGlassNaturalIllumination("non-parallel-lens-film");
  }

  const {
    lensCenterWorld,
    filmPlane,
    rearStandardFrame,
    opticalAxis,
  } = geometry;
  if (
    !isFiniteVec3(lensCenterWorld) ||
    !isFiniteVec3(filmPlane.point) ||
    !isFiniteVec3(filmPlane.normal) ||
    !isFiniteVec3(rearStandardFrame.centerWorld) ||
    !isFiniteVec3(rearStandardFrame.rightWorld) ||
    !isFiniteVec3(rearStandardFrame.upWorld) ||
    !isFiniteVec3(opticalAxis.origin) ||
    !isFiniteVec3(opticalAxis.direction) ||
    magnitude(filmPlane.normal) <= 1e-9 ||
    magnitude(rearStandardFrame.rightWorld) <= 1e-9 ||
    magnitude(rearStandardFrame.upWorld) <= 1e-9 ||
    magnitude(opticalAxis.direction) <= 1e-9
  ) {
    return createNeutralGroundGlassNaturalIllumination("invalid-geometry");
  }

  const imageDistanceMm = calculateImageDistanceAlongOpticalAxisMm({
    lensCenterWorld,
    filmPlanePointWorld: filmPlane.point,
    opticalAxisDirection: opticalAxis.direction,
  });
  if (
    imageDistanceMm === null ||
    !Number.isFinite(imageDistanceMm) ||
    imageDistanceMm <= 0
  ) {
    return createNeutralGroundGlassNaturalIllumination("invalid-geometry");
  }

  const imageSideRay: Ray = {
    origin: lensCenterWorld,
    direction: scale(opticalAxis.direction, -1),
  };
  const opticalAxisIntersection = intersectRayPlane(imageSideRay, filmPlane)?.point;
  if (!opticalAxisIntersection || !isFiniteVec3(opticalAxisIntersection)) {
    return createNeutralGroundGlassNaturalIllumination("invalid-geometry");
  }

  const fromFilmCenter = subtract(
    opticalAxisIntersection,
    rearStandardFrame.centerWorld,
  );
  const opticalAxisOffsetXMm = dot(fromFilmCenter, rearStandardFrame.rightWorld);
  const opticalAxisOffsetYMm = dot(fromFilmCenter, rearStandardFrame.upWorld);
  if (
    !Number.isFinite(opticalAxisOffsetXMm) ||
    !Number.isFinite(opticalAxisOffsetYMm)
  ) {
    return createNeutralGroundGlassNaturalIllumination("invalid-geometry");
  }

  return {
    kind: "parallel-cos4",
    imageDistanceMm,
    opticalAxisOffsetXMm,
    opticalAxisOffsetYMm,
  };
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
  if (
    state.kind !== "parallel-cos4" ||
    !Number.isFinite(filmPointXMm) ||
    !Number.isFinite(filmPointYMm) ||
    !Number.isFinite(state.imageDistanceMm) ||
    state.imageDistanceMm <= 0 ||
    !Number.isFinite(state.opticalAxisOffsetXMm) ||
    !Number.isFinite(state.opticalAxisOffsetYMm)
  ) {
    return 1;
  }

  const deltaX = filmPointXMm - state.opticalAxisOffsetXMm;
  const deltaY = filmPointYMm - state.opticalAxisOffsetYMm;
  const imageDistanceSquared = state.imageDistanceMm * state.imageDistanceMm;
  const denominator = imageDistanceSquared + deltaX * deltaX + deltaY * deltaY;
  if (!Number.isFinite(denominator) || denominator <= 0) return 1;

  const cosineSquared = imageDistanceSquared / denominator;
  const gain = cosineSquared * cosineSquared;
  return Number.isFinite(gain) && gain >= 0 && gain <= 1 ? gain : 1;
};
