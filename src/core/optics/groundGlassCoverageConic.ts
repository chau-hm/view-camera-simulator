import type { DerivedLensCoverage } from "../../types/lens";
import type {
  GroundGlassCoverageAxial,
  GroundGlassCoverageQuadratic,
  Plane,
  StandardFrame,
} from "../../types/optics";
import {
  cross,
  dot,
  isFiniteVec3,
  magnitude,
  scale,
  subtract,
} from "../math/vec";
import type { GroundGlassParallelFilmGeometryInput } from "./groundGlassParallelFilmGeometry";

export type GroundGlassCoverageConic = Readonly<{
  quadratic: GroundGlassCoverageQuadratic;
  axial: GroundGlassCoverageAxial;
}>;

const VECTOR_EPSILON = 1e-9;
const BASIS_TOLERANCE = 1e-6;
const PLANE_TOLERANCE_MM = 1e-5;

const isUsablePlane = (plane: Plane): boolean => {
  if (
    !isFiniteVec3(plane.point) ||
    !isFiniteVec3(plane.normal) ||
    !Number.isFinite(plane.distance)
  ) {
    return false;
  }
  const normalLength = magnitude(plane.normal);
  return (
    Number.isFinite(normalLength) &&
    Math.abs(normalLength - 1) <= BASIS_TOLERANCE &&
    Math.abs(dot(plane.normal, plane.point) - plane.distance) <= PLANE_TOLERANCE_MM
  );
};

const isUsableFilmFrame = (frame: StandardFrame, filmPlane: Plane): boolean => {
  const { centerWorld, rightWorld, upWorld, normalWorld, plane } = frame;
  if (
    !isFiniteVec3(centerWorld) ||
    !isFiniteVec3(rightWorld) ||
    !isFiniteVec3(upWorld) ||
    !isFiniteVec3(normalWorld) ||
    !isUsablePlane(plane)
  ) {
    return false;
  }

  const rightLength = magnitude(rightWorld);
  const upLength = magnitude(upWorld);
  const frameNormalLength = magnitude(normalWorld);
  const filmNormalLength = magnitude(filmPlane.normal);
  if (
    Math.abs(rightLength - 1) > BASIS_TOLERANCE ||
    Math.abs(upLength - 1) > BASIS_TOLERANCE ||
    Math.abs(frameNormalLength - 1) > BASIS_TOLERANCE ||
    Math.abs(filmNormalLength - 1) > BASIS_TOLERANCE ||
    Math.abs(dot(rightWorld, upWorld)) > BASIS_TOLERANCE ||
    Math.abs(dot(rightWorld, normalWorld)) > BASIS_TOLERANCE ||
    Math.abs(dot(upWorld, normalWorld)) > BASIS_TOLERANCE ||
    Math.abs(dot(cross(rightWorld, upWorld), normalWorld)) < 1 - BASIS_TOLERANCE ||
    Math.abs(dot(normalWorld, filmPlane.normal)) < 1 - BASIS_TOLERANCE ||
    Math.abs(dot(normalWorld, plane.normal)) < 1 - BASIS_TOLERANCE
  ) {
    return false;
  }

  const centerFromFilmPlane = subtract(centerWorld, filmPlane.point);
  const filmPlaneFromFramePlane = subtract(filmPlane.point, plane.point);
  return (
    Math.abs(dot(filmPlane.normal, centerFromFilmPlane)) <= PLANE_TOLERANCE_MM &&
    Math.abs(dot(plane.normal, filmPlaneFromFramePlane)) <= PLANE_TOLERANCE_MM
  );
};

/**
 * Intersect the canonical finite right-circular image-side coverage cone with
 * the actual film plane, expressed in rear-standard film-local millimetres.
 *
 * With image-side unit axis `a`, lens centre `L`, film centre `F`, and film
 * basis `r,u`, let `q0 = F-L`, `P(x,y)=F+x*r+y*u`, and
 * `k = v²/(v²+R²)` from canonical `DerivedLensCoverage` values. The boundary
 * quadratic is `Q = k*dot(q,q) - dot(q,a)²`; physical coverage additionally
 * requires the image-side half-space `T=dot(q,a)>0`.
 *
 * The coverage angle is intentionally not recomputed here. `DerivedLensCoverage`
 * remains the single authority for the perpendicular reference-plane radius.
 */
export const deriveGroundGlassCoverageConic = (input: {
  lensCoverage: DerivedLensCoverage;
  geometry: GroundGlassParallelFilmGeometryInput;
}): GroundGlassCoverageConic | null => {
  const { lensCoverage, geometry } = input;
  if (lensCoverage.kind !== "angular") return null;

  const radiusMm = lensCoverage.imageCircleRadiusMm;
  const imageDistanceMm = lensCoverage.imageDistanceMm;
  if (
    !Number.isFinite(radiusMm) ||
    radiusMm <= 0 ||
    !Number.isFinite(imageDistanceMm) ||
    imageDistanceMm <= 0
  ) {
    return null;
  }

  const {
    lensCenterWorld,
    filmPlane,
    rearStandardFrame,
    opticalAxis,
  } = geometry;
  const axisLength = magnitude(opticalAxis.direction);
  if (
    !isFiniteVec3(lensCenterWorld) ||
    !isFiniteVec3(opticalAxis.origin) ||
    !isFiniteVec3(opticalAxis.direction) ||
    !Number.isFinite(axisLength) ||
    axisLength <= VECTOR_EPSILON ||
    !isUsablePlane(filmPlane) ||
    !isUsableFilmFrame(rearStandardFrame, filmPlane) ||
    magnitude(subtract(opticalAxis.origin, lensCenterWorld)) > PLANE_TOLERANCE_MM
  ) {
    return null;
  }

  const slope = radiusMm / imageDistanceMm;
  const slopeSquared = slope * slope;
  const cosSquared = 1 / (1 + slopeSquared);
  if (
    !Number.isFinite(slope) ||
    slope <= 0 ||
    !Number.isFinite(slopeSquared) ||
    !Number.isFinite(cosSquared) ||
    cosSquared <= 0 ||
    cosSquared >= 1
  ) {
    return null;
  }

  const imageSideAxis = scale(opticalAxis.direction, -1 / axisLength);
  const q0 = subtract(rearStandardFrame.centerWorld, lensCenterWorld);
  const { rightWorld: right, upWorld: up } = rearStandardFrame;
  const axisQ0 = dot(imageSideAxis, q0);
  const axisRight = dot(imageSideAxis, right);
  const axisUp = dot(imageSideAxis, up);

  const quadratic: GroundGlassCoverageQuadratic = {
    a: cosSquared * dot(right, right) - axisRight * axisRight,
    b: 2 * (cosSquared * dot(right, up) - axisRight * axisUp),
    c: cosSquared * dot(up, up) - axisUp * axisUp,
    d: 2 * (cosSquared * dot(q0, right) - axisQ0 * axisRight),
    e: 2 * (cosSquared * dot(q0, up) - axisQ0 * axisUp),
    f: cosSquared * dot(q0, q0) - axisQ0 * axisQ0,
  };
  const axial: GroundGlassCoverageAxial = {
    x: axisRight,
    y: axisUp,
    constant: axisQ0,
  };

  const coefficients = [
    quadratic.a,
    quadratic.b,
    quadratic.c,
    quadratic.d,
    quadratic.e,
    quadratic.f,
    axial.x,
    axial.y,
    axial.constant,
  ];
  if (!coefficients.every(Number.isFinite)) return null;

  return { quadratic, axial };
};
