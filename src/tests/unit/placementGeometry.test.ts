import { describe, expect, it } from "vitest";
import {
  areBounds3Finite,
  findPairwiseIntersections,
  hasPositiveFiniteBoxDimensionsMm,
  intersectsBounds3,
  intersectsProtectedRegionXZ,
  isOutsideBounds3,
  isSupportedAtHeightMm,
  isWithinBounds3,
  isWithinBoundsXZ,
} from "../../scenes/variation/placementConstraints";
import {
  getBoundsXZMm,
  getSupportSurfaceBoundsXZMm,
  getYawRotatedBoxBoundsMm,
} from "../../scenes/variation/placementGeometry";
import type { Bounds3 } from "../../types/optics";

const bounds = (
  x: number,
  y: number,
  z: number,
  width = 2,
  height = 2,
  depth = 2,
): Bounds3 => ({
  min: { x: x - width / 2, y: y - height / 2, z: z - depth / 2 },
  max: { x: x + width / 2, y: y + height / 2, z: z + depth / 2 },
});

describe("shared placement geometry", () => {
  it("computes an unrotated rectangular footprint and vertical bounds in millimetres", () => {
    expect(getYawRotatedBoxBoundsMm(
      { x: 10, y: 20, z: 30 },
      { width: 80, height: 40, depth: 20 },
    )).toEqual({
      min: { x: -30, y: 0, z: 20 },
      max: { x: 50, y: 40, z: 40 },
    });
  });

  it.each([5, -5])("keeps the symmetric footprint for a %s degree yaw", (rotationYDeg) => {
    const result = getYawRotatedBoxBoundsMm(
      { x: 0, y: 0, z: 0 },
      { width: 100, height: 20, depth: 40 },
      rotationYDeg,
    );
    const halfWidth = Math.abs(Math.cos(rotationYDeg * Math.PI / 180)) * 50 +
      Math.abs(Math.sin(rotationYDeg * Math.PI / 180)) * 20;
    const halfDepth = Math.abs(Math.sin(rotationYDeg * Math.PI / 180)) * 50 +
      Math.abs(Math.cos(rotationYDeg * Math.PI / 180)) * 20;
    expect(result.min.x).toBeCloseTo(-halfWidth, 12);
    expect(result.max.x).toBeCloseTo(halfWidth, 12);
    expect(result.min.z).toBeCloseTo(-halfDepth, 12);
    expect(result.max.z).toBeCloseTo(halfDepth, 12);
  });

  it("swaps a non-square box footprint at 90 degrees", () => {
    const result = getYawRotatedBoxBoundsMm(
      { x: 0, y: 50, z: 0 },
      { width: 120, height: 30, depth: 40 },
      90,
    );
    expect(result.min.x).toBeCloseTo(-20, 12);
    expect(result.max.x).toBeCloseTo(20, 12);
    expect(result.min.z).toBeCloseTo(-60, 12);
    expect(result.max.z).toBeCloseTo(60, 12);
  });

  it("keeps non-finite inputs visible for the constraint audit", () => {
    const result = getYawRotatedBoxBoundsMm(
      { x: Number.NaN, y: 0, z: 0 },
      { width: 20, height: 20, depth: 20 },
      Number.POSITIVE_INFINITY,
    );
    expect(areBounds3Finite(result)).toBe(false);
    expect(hasPositiveFiniteBoxDimensionsMm({ width: 20, height: 0, depth: -1 })).toBe(false);
  });
});

describe("shared placement constraints", () => {
  const roomBounds: Bounds3 = {
    min: { x: -10, y: 0, z: 0 },
    max: { x: 10, y: 20, z: 20 },
  };

  it("allows exact containment boundaries and detects each excursion", () => {
    expect(isWithinBounds3(roomBounds, roomBounds)).toBe(true);
    expect(isOutsideBounds3(roomBounds, roomBounds)).toBe(false);
    expect(isWithinBounds3(bounds(10, 10, 10, 2, 2, 2), roomBounds)).toBe(false);
    expect(isOutsideBounds3(bounds(10, 10, 10, 2, 2, 2), roomBounds)).toBe(true);
  });

  it("checks support containment inclusively in X/Z", () => {
    const support = getSupportSurfaceBoundsXZMm({
      center: { x: 0, y: 5, z: 0 },
      size: { x: 100, y: 10, z: 80 },
      topY: 10,
    });
    expect(isWithinBoundsXZ({ minX: -50, maxX: 50, minZ: -40, maxZ: 40 }, support)).toBe(true);
    expect(isWithinBoundsXZ({ minX: -51, maxX: 49, minZ: -40, maxZ: 40 }, support)).toBe(false);
  });

  it("checks vertical support with an explicit millimetre tolerance", () => {
    expect(isSupportedAtHeightMm(100, 100.0000005, 1e-6)).toBe(true);
    expect(isSupportedAtHeightMm(100, 100.00001, 1e-6)).toBe(false);
    expect(isSupportedAtHeightMm(Number.NaN, 100, 1e-6)).toBe(false);
  });

  it("treats touching boxes as non-overlapping and strict interior overlap as an intersection", () => {
    expect(intersectsBounds3(bounds(0, 0, 0), bounds(2, 0, 0))).toBe(false);
    expect(intersectsBounds3(bounds(0, 0, 0), bounds(1.99, 0, 0))).toBe(true);
  });

  it("uses inclusive boundaries for protected X/Z regions, including half-planes", () => {
    const footprint = { minX: 5, maxX: 8, minZ: 10, maxZ: 15 };
    expect(intersectsProtectedRegionXZ(footprint, { minX: 8, minZ: 15, maxZ: 20 })).toBe(true);
    expect(intersectsProtectedRegionXZ(footprint, { minX: 8.001, minZ: 0, maxZ: 20 })).toBe(false);
  });

  it("returns pairwise overlaps in stable left-major input order", () => {
    const items = [
      { id: "a", bounds: bounds(0, 0, 0) },
      { id: "b", bounds: bounds(0.5, 0, 0) },
      { id: "c", bounds: bounds(0, 0.5, 0) },
      { id: "d", bounds: bounds(10, 0, 0) },
    ];
    expect(findPairwiseIntersections(items, (item) => item.bounds).map(({ left, right }) =>
      `${left.id}-${right.id}`,
    )).toEqual(["a-b", "a-c", "b-c"]);
  });

  it("extracts X/Z dimensions from shared three-dimensional bounds", () => {
    expect(getBoundsXZMm(bounds(2, 4, 6, 8, 10, 12))).toEqual({
      minX: -2,
      maxX: 6,
      minZ: 0,
      maxZ: 12,
    });
  });
});
