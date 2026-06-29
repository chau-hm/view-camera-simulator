import type { Vec3 } from "../../types/optics";

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const DEFAULT_EPSILON = 1e-9;

export const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);

export const subtract = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);

export const scale = (value: Vec3, factor: number): Vec3 =>
  vec(value.x * factor, value.y * factor, value.z * factor);

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export const magnitude = (value: Vec3): number => Math.hypot(value.x, value.y, value.z);

export const epsilonGuard = (value: number, epsilon = DEFAULT_EPSILON): number =>
  Math.abs(value) <= epsilon ? 0 : value;

export const isFiniteVec3 = (value: Vec3): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);

export const safeNormalize = (value: Vec3, fallback: Vec3 = vec(0, 0, 1)): Vec3 => {
  if (!isFiniteVec3(value)) {
    return fallback;
  }
  const length = magnitude(value);
  if (!Number.isFinite(length) || length <= DEFAULT_EPSILON) {
    return fallback;
  }
  return vec(value.x / length, value.y / length, value.z / length);
};

export const normalize = (value: Vec3): Vec3 => safeNormalize(value);

export const distance = (a: Vec3, b: Vec3): number => magnitude(subtract(a, b));

export const angleDeg = (a: Vec3, b: Vec3): number => {
  const normalizedA = safeNormalize(a, vec(0, 0, 0));
  const normalizedB = safeNormalize(b, vec(0, 0, 0));
  if (magnitude(normalizedA) === 0 || magnitude(normalizedB) === 0) {
    return 0;
  }
  const cosine = dot(normalizedA, normalizedB);
  const clampedCosine = Math.min(1, Math.max(-1, cosine));
  return (Math.acos(clampedCosine) * 180) / Math.PI;
};

export const rotateAroundX = (value: Vec3, angleDeg: number): Vec3 => {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return vec(value.x, value.y * cos - value.z * sin, value.y * sin + value.z * cos);
};

export const rotateAroundY = (value: Vec3, angleDeg: number): Vec3 => {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return vec(value.x * cos + value.z * sin, value.y, -value.x * sin + value.z * cos);
};
