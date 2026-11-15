import type { Bounds3 } from "../../types/optics";
import type { BoundsXZMm, BoxDimensionsMm } from "./placementGeometry";

/** True when every dimension is finite and strictly positive. */
export const hasPositiveFiniteBoxDimensionsMm = (dimensionsMm: BoxDimensionsMm): boolean =>
  [dimensionsMm.width, dimensionsMm.height, dimensionsMm.depth]
    .every((value) => Number.isFinite(value) && value > 0);

export const areBounds3Finite = (bounds: Bounds3): boolean =>
  [
    bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z,
  ].every(Number.isFinite);

/** Inclusive containment; equality at any boundary is allowed. */
export const isWithinBounds3 = (bounds: Bounds3, container: Bounds3): boolean =>
  bounds.min.x >= container.min.x && bounds.max.x <= container.max.x &&
  bounds.min.y >= container.min.y && bounds.max.y <= container.max.y &&
  bounds.min.z >= container.min.z && bounds.max.z <= container.max.z;

/** Raw boundary excursion check, kept separate from finite-number validation. */
export const isOutsideBounds3 = (bounds: Bounds3, container: Bounds3): boolean =>
  bounds.min.x < container.min.x || bounds.max.x > container.max.x ||
  bounds.min.y < container.min.y || bounds.max.y > container.max.y ||
  bounds.min.z < container.min.z || bounds.max.z > container.max.z;

/** Inclusive X/Z containment; equality at a support edge is allowed. */
export const isWithinBoundsXZ = (bounds: BoundsXZMm, container: BoundsXZMm): boolean =>
  bounds.minX >= container.minX && bounds.maxX <= container.maxX &&
  bounds.minZ >= container.minZ && bounds.maxZ <= container.maxZ;

/**
 * Support alignment with a caller-provided tolerance in millimetres.
 * A non-finite input is never considered supported.
 */
export const isSupportedAtHeightMm = (
  bottomYmm: number,
  supportTopYmm: number,
  toleranceMm: number,
): boolean =>
  Number.isFinite(bottomYmm) && Number.isFinite(supportTopYmm) &&
  Number.isFinite(toleranceMm) && toleranceMm >= 0 &&
  Math.abs(bottomYmm - supportTopYmm) <= toleranceMm;

/** Strict AABB overlap. Merely touching faces, edges, or corners do not overlap. */
export const intersectsBounds3 = (left: Bounds3, right: Bounds3): boolean =>
  left.min.x < right.max.x && left.max.x > right.min.x &&
  left.min.y < right.max.y && left.max.y > right.min.y &&
  left.min.z < right.max.z && left.max.z > right.min.z;

/**
 * X/Z overlap for protected areas. Edges are inclusive, so touching a
 * protected-area boundary counts as an intersection. Omitted edges are
 * intentionally unbounded, which supports protected half-planes.
 */
export type ProtectedRegionXZMm = Readonly<{
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
}>;

export const intersectsProtectedRegionXZ = (
  bounds: BoundsXZMm,
  region: ProtectedRegionXZMm,
): boolean =>
  bounds.maxX >= (region.minX ?? Number.NEGATIVE_INFINITY) &&
  bounds.minX <= (region.maxX ?? Number.POSITIVE_INFINITY) &&
  bounds.maxZ >= (region.minZ ?? Number.NEGATIVE_INFINITY) &&
  bounds.minZ <= (region.maxZ ?? Number.POSITIVE_INFINITY);

export type PairwiseIntersection<T> = Readonly<{
  left: T;
  right: T;
}>;

/** Returns strict overlaps in stable input order (left-major, then right). */
export const findPairwiseIntersections = <T>(
  items: readonly T[],
  getBounds: (item: T) => Bounds3,
): readonly PairwiseIntersection<T>[] => {
  const intersections: PairwiseIntersection<T>[] = [];
  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    const left = items[leftIndex]!;
    const leftBounds = getBounds(left);
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const right = items[rightIndex]!;
      if (intersectsBounds3(leftBounds, getBounds(right))) {
        intersections.push({ left, right });
      }
    }
  }
  return intersections;
};
