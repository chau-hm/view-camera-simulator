import type { Vec3 } from "../../types/optics";

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const normalize = (value: Vec3): Vec3 => {
  const length = Math.hypot(value.x, value.y, value.z);
  if (length === 0) {
    return vec(0, 0, 1);
  }
  return vec(value.x / length, value.y / length, value.z / length);
};

export const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);

export const scale = (value: Vec3, factor: number): Vec3 =>
  vec(value.x * factor, value.y * factor, value.z * factor);

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
