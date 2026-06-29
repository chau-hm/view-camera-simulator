import type { Ray, Vec3 } from "../../types/optics";
import { add, scale } from "./vec";

export const pointOnRay = (ray: Ray, distance: number): Vec3 =>
  add(ray.origin, scale(ray.direction, distance));
