import type { DerivedOpticsState } from "../../types/optics";

export type FrameBounds2d = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const interpolateAtZ = (
  origin: { x: number; y: number; z: number },
  through: { x: number; y: number; z: number },
  targetZ: number,
): { x: number; y: number } => {
  const denominator = through.z - origin.z;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-9) {
    return { x: through.x, y: through.y };
  }
  const t = (targetZ - origin.z) / denominator;
  return {
    x: origin.x + (through.x - origin.x) * t,
    y: origin.y + (through.y - origin.y) * t,
  };
};

export const calculateGroundGlassFrameBoundsAtZ = (
  opticsState: DerivedOpticsState,
  worldZ: number,
): FrameBounds2d => {
  const lensCenter = opticsState.offAxisProjectionInput.lensCenterWorld;
  const corners = opticsState.offAxisProjectionInput.filmCornersWorld;
  const projected = [
    interpolateAtZ(lensCenter, corners.topLeft, worldZ),
    interpolateAtZ(lensCenter, corners.topRight, worldZ),
    interpolateAtZ(lensCenter, corners.bottomLeft, worldZ),
    interpolateAtZ(lensCenter, corners.bottomRight, worldZ),
  ];

  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};
