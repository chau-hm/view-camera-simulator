import type { Transform, Vec3 } from "../../types/optics";
import { add } from "./vec";

export const applyTransform = (point: Vec3, transform: Transform): Vec3 => {
  return add(point, transform.translation);
};
