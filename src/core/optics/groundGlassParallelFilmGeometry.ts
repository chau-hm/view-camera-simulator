import type { Plane, Ray, StandardFrame, Vec3 } from "../../types/optics";
import { intersectRayPlane } from "../math/ray";
import { dot, isFiniteVec3, magnitude, scale, subtract } from "../math/vec";
import { calculateImageDistanceAlongOpticalAxisMm } from "./calculateImageDistance";

export type GroundGlassParallelFilmGeometryInput = Readonly<{
  lensCenterWorld: Vec3;
  filmPlane: Plane;
  rearStandardFrame: StandardFrame;
  opticalAxis: Ray;
  isParallelLensFilm: boolean;
}>;

/**
 * Physical geometry shared by the parallel-film Ground Glass effects.
 *
 * The canonical optical axis points from the lens towards the object. The
 * image-side ray therefore uses the opposite direction when intersecting
 * the film plane. Offsets are returned in the rear-standard +X/+Y basis from
 * the film centre to that intersection.
 */
export type GroundGlassParallelFilmGeometry = Readonly<{
  imageDistanceMm: number;
  opticalAxisOffsetXMm: number;
  opticalAxisOffsetYMm: number;
}>;

export const deriveGroundGlassParallelFilmGeometry = (
  geometry: GroundGlassParallelFilmGeometryInput,
): GroundGlassParallelFilmGeometry | null => {
  if (!geometry.isParallelLensFilm) return null;

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
    return null;
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
    return null;
  }

  const imageSideRay: Ray = {
    origin: lensCenterWorld,
    direction: scale(opticalAxis.direction, -1),
  };
  const opticalAxisIntersection = intersectRayPlane(imageSideRay, filmPlane)?.point;
  if (!opticalAxisIntersection || !isFiniteVec3(opticalAxisIntersection)) {
    return null;
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
    return null;
  }

  return {
    imageDistanceMm,
    opticalAxisOffsetXMm,
    opticalAxisOffsetYMm,
  };
};
