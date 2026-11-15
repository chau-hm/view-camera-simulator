import type { Bounds3, Vec3 } from "../../types/optics";

/** Axis-aligned X/Z bounds in canonical millimetres. */
export type BoundsXZMm = Readonly<{
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}>;

/** Rectangular support data in canonical millimetres. `topY` is the usable top plane. */
export type SupportSurfaceMm = Readonly<{
  center: Vec3;
  size: Vec3;
  topY: number;
}>;

export type BoxDimensionsMm = Readonly<{
  width: number;
  height: number;
  depth: number;
}>;

/**
 * Bounds of a box after yaw about the Y axis. This is an axis-aligned bounding
 * box, not an arbitrary 3D collision shape. Inputs and outputs are millimetres.
 */
export const getYawRotatedBoxBoundsMm = (
  positionMm: Vec3,
  dimensionsMm: BoxDimensionsMm,
  rotationYDeg = 0,
): Bounds3 => {
  const angle = (rotationYDeg * Math.PI) / 180;
  const halfWidth = Math.abs(Math.cos(angle)) * dimensionsMm.width / 2 +
    Math.abs(Math.sin(angle)) * dimensionsMm.depth / 2;
  const halfDepth = Math.abs(Math.sin(angle)) * dimensionsMm.width / 2 +
    Math.abs(Math.cos(angle)) * dimensionsMm.depth / 2;
  const halfHeight = dimensionsMm.height / 2;

  return {
    min: {
      x: positionMm.x - halfWidth,
      y: positionMm.y - halfHeight,
      z: positionMm.z - halfDepth,
    },
    max: {
      x: positionMm.x + halfWidth,
      y: positionMm.y + halfHeight,
      z: positionMm.z + halfDepth,
    },
  };
};

export const getBoundsXZMm = (bounds: Bounds3): BoundsXZMm => ({
  minX: bounds.min.x,
  maxX: bounds.max.x,
  minZ: bounds.min.z,
  maxZ: bounds.max.z,
});

export const getSupportSurfaceBoundsXZMm = (surface: SupportSurfaceMm): BoundsXZMm => ({
  minX: surface.center.x - surface.size.x / 2,
  maxX: surface.center.x + surface.size.x / 2,
  minZ: surface.center.z - surface.size.z / 2,
  maxZ: surface.center.z + surface.size.z / 2,
});
