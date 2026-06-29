import type { Plane, Vec3 } from "../../types/optics";
import { dot, normalize } from "./vec";

export const planeFromPointNormal = (point: Vec3, normal: Vec3): Plane => {
  const safeNormal = normalize(normal);
  return {
    point,
    normal: safeNormal,
    distance: dot(safeNormal, point),
  };
};
