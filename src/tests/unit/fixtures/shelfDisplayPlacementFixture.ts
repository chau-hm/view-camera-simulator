import type { SceneVariationDescriptor } from "../../../types/sceneVariation";
import {
  areBounds3Finite,
  findPairwiseIntersections,
  hasPositiveFiniteBoxDimensionsMm,
  intersectsProtectedRegionXZ,
  isSupportedAtHeightMm,
  isWithinBoundsXZ,
} from "../../../scenes/variation/placementConstraints";
import {
  getBoundsXZMm,
  getSupportSurfaceBoundsXZMm,
  getYawRotatedBoxBoundsMm,
  type BoxDimensionsMm,
  type SupportSurfaceMm,
} from "../../../scenes/variation/placementGeometry";

/** Test-only example of an unrelated scene's bounded shelf placement problem. */
export const shelfSupportSurfaceMm: SupportSurfaceMm = Object.freeze({
  center: Object.freeze({ x: 0, y: 900, z: 0 }),
  size: Object.freeze({ x: 1000, y: 40, z: 300 }),
  topY: 920,
});

export const shelfProtectedRegionXZ = Object.freeze({
  minX: -85,
  maxX: 85,
  minZ: -125,
  maxZ: 125,
});

export const shelfDisplaySlots = Object.freeze([
  Object.freeze({ id: "shelf-left-slot", direction: -1 }),
  Object.freeze({ id: "shelf-right-slot", direction: 1 }),
] as const);
export type ShelfDisplaySlot = (typeof shelfDisplaySlots)[number];

export type ShelfDisplayPlacement = Readonly<{
  id: "shelf-left-slot" | "shelf-right-slot";
  kind: "book" | "small-object";
  positionMm: Readonly<{ x: number; y: number; z: number }>;
  dimensionsMm: BoxDimensionsMm;
}>;

export type ShelfDisplayPlacementPlan = Readonly<{
  identity: SceneVariationDescriptor["identity"];
  items: readonly ShelfDisplayPlacement[];
}>;

const placementBounds = (placement: ShelfDisplayPlacement) =>
  getYawRotatedBoxBoundsMm(placement.positionMm, placement.dimensionsMm);

export const resolveShelfDisplayPlacementPlan = (
  descriptor: SceneVariationDescriptor,
  slots: readonly ShelfDisplaySlot[] = shelfDisplaySlots,
): ShelfDisplayPlacementPlan => {
  const items = slots.map(({ id, direction }) => {
    const propStream = descriptor.createRandomStream("props", id);
    const layoutStream = descriptor.createRandomStream("layout", id);
    const kind = propStream.pick(["book", "small-object"] as const);
    const dimensionsMm = kind === "book"
      ? Object.freeze({ width: 120, height: propStream.nextInt(110, 190), depth: 155 })
      : Object.freeze({ width: 145, height: propStream.nextInt(100, 175), depth: 130 });
    const positionMm = Object.freeze({
      x: shelfSupportSurfaceMm.center.x + direction * (320 + layoutStream.nextInt(-15, 15)),
      y: shelfSupportSurfaceMm.topY + dimensionsMm.height / 2,
      z: shelfSupportSurfaceMm.center.z + layoutStream.nextInt(-10, 10),
    });
    return Object.freeze({ id, kind, positionMm, dimensionsMm });
  });
  return Object.freeze({
    identity: descriptor.identity,
    items: Object.freeze(items),
  });
};

/** Fixture-owned policy composes shared checks but keeps fallback decisions local. */
export const getShelfDisplayPlacementSafetyIssues = (
  plan: ShelfDisplayPlacementPlan,
): readonly string[] => {
  const issues: string[] = [];
  const supportBounds = getSupportSurfaceBoundsXZMm(shelfSupportSurfaceMm);

  plan.items.forEach((item) => {
    const bounds = placementBounds(item);
    if (!hasPositiveFiniteBoxDimensionsMm(item.dimensionsMm)) {
      issues.push(`${item.id}: dimensions must be positive and finite`);
    }
    if (!areBounds3Finite(bounds)) issues.push(`${item.id}: non-finite bounds`);
    if (!isWithinBoundsXZ(getBoundsXZMm(bounds), supportBounds)) {
      issues.push(`${item.id}: outside shelf support`);
    }
    if (!isSupportedAtHeightMm(bounds.min.y, shelfSupportSurfaceMm.topY, 1e-6)) {
      issues.push(`${item.id}: not supported by shelf`);
    }
    if (intersectsProtectedRegionXZ(getBoundsXZMm(bounds), shelfProtectedRegionXZ)) {
      issues.push(`${item.id}: intersects protected shelf region`);
    }
  });

  findPairwiseIntersections(plan.items, placementBounds).forEach(({ left, right }) => {
    issues.push(`${left.id} intersects ${right.id}`);
  });
  return Object.freeze(issues);
};

export const serializeShelfDisplayPlacementPlan = (
  plan: ShelfDisplayPlacementPlan,
): string => JSON.stringify(plan);
