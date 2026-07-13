import type { Vec3 } from "../../types/optics";

export function calculateImageDistanceAlongOpticalAxisMm(input: {
  lensCenterWorld: Vec3;
  filmPlanePointWorld: Vec3;
  opticalAxisDirection: Vec3;
}): number | null {
  const { lensCenterWorld, filmPlanePointWorld, opticalAxisDirection } = input;
  if (!lensCenterWorld || !filmPlanePointWorld || !opticalAxisDirection) return null;
  const ax = opticalAxisDirection;
  const lx = ax.x;
  const ly = ax.y;
  const lz = ax.z;
  const lenSq = lx * lx + ly * ly + lz * lz;
  if (!Number.isFinite(lenSq) || lenSq <= 1e-12) return null;
  const invLen = 1 / Math.sqrt(lenSq);
  const nx = lx * invLen;
  const ny = ly * invLen;
  const nz = lz * invLen;

  const dx = filmPlanePointWorld.x - lensCenterWorld.x;
  const dy = filmPlanePointWorld.y - lensCenterWorld.y;
  const dz = filmPlanePointWorld.z - lensCenterWorld.z;

  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dz)) return null;

  const proj = dx * nx + dy * ny + dz * nz;
  if (!Number.isFinite(proj) || Math.abs(proj) < 1e-9) return null;

  return Math.abs(proj);
}
