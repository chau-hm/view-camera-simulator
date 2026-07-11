import type { Plane, Vec3 } from "../../types/optics";
import { DEFAULT_EPSILON, add, angleDeg, cross, dot, normalize, scale, subtract } from "./vec";

export const planeFromPointNormal = (point: Vec3, normal: Vec3): Plane => {
  const safeNormal = normalize(normal);
  return {
    point,
    normal: safeNormal,
    distance: dot(safeNormal, point),
  };
};

export const pointToPlaneSignedDistance = (point: Vec3, plane: Plane): number =>
  dot(plane.normal, subtract(point, plane.point));

export const pointToPlaneDistance = (point: Vec3, plane: Plane): number =>
  Math.abs(pointToPlaneSignedDistance(point, plane));

export type PlaneIntersectionLine = {
  point: Vec3;
  direction: Vec3;
};

export const intersectPlanes = (
  first: Plane,
  second: Plane,
  epsilon = DEFAULT_EPSILON,
): PlaneIntersectionLine | null => {
  const direction = cross(first.normal, second.normal);
  const denominator = dot(direction, direction);
  if (denominator <= epsilon * epsilon) {
    return null;
  }

  const firstPart = scale(cross(direction, second.normal), first.distance);
  const secondPart = scale(cross(first.normal, direction), second.distance);
  const point = scale(add(firstPart, secondPart), 1 / denominator);

  return {
    point,
    direction: normalize(direction),
  };
};

export const arePlanesNearlyParallel = (
  first: Plane,
  second: Plane,
  thresholdDeg = 0.1,
): boolean => {
  const angle = angleDeg(first.normal, second.normal);
  const acuteAngle = Math.min(angle, 180 - angle);
  return acuteAngle < thresholdDeg;
};

/**
 * Construct a plane that contains the provided infinite line and the given point.
 * If the construction numerically fails (colinear), returns null.
 */
export const planeFromLineAndPoint = (
  line: PlaneIntersectionLine,
  point: Vec3,
  fallbackNormal?: Vec3,
): Plane | null => {
  // normal is cross(line.direction, point - line.point)
  const v = subtract(point, line.point);
  const n = cross(line.direction, v);
  const nLenSq = dot(n, n);
  if (nLenSq <= 1e-12) {
    if (fallbackNormal) return planeFromPointNormal(point, fallbackNormal);
    return null;
  }
  return planeFromPointNormal(point, normalize(n));
};
