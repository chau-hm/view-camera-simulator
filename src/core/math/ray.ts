import type { Plane, Ray, Vec3 } from "../../types/optics";
import { DEFAULT_EPSILON, add, dot, scale } from "./vec";

export const pointOnRay = (ray: Ray, distance: number): Vec3 =>
  add(ray.origin, scale(ray.direction, distance));

export type RayPlaneIntersection = {
  point: Vec3;
  distance: number;
};

export const intersectRayPlane = (
  ray: Ray,
  plane: Plane,
  epsilon = DEFAULT_EPSILON,
): RayPlaneIntersection | null => {
  const denominator = dot(plane.normal, ray.direction);
  if (Math.abs(denominator) <= epsilon) {
    return null;
  }

  const numerator = plane.distance - dot(plane.normal, ray.origin);
  const intersectionDistance = numerator / denominator;
  if (!Number.isFinite(intersectionDistance) || intersectionDistance < 0) {
    return null;
  }

  return {
    point: pointOnRay(ray, intersectionDistance),
    distance: intersectionDistance,
  };
};
