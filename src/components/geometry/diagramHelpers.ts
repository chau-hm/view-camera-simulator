import type { Plane, Vec3 } from "../../types/optics";
import type { Bounds3 } from "../../types/optics";
import type { GeometryView } from "../../types/camera";

export type DiagramPoint = {
  x: number;
  y: number;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const normalize = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 0.5;
  }
  return clamp01((value - min) / (max - min));
};

export const worldToSideView = (
  point: Vec3,
  bounds: Bounds3,
  width: number,
  height: number,
  padding = 24,
): DiagramPoint => {
  const xNorm = normalize(point.z, bounds.min.z, bounds.max.z);
  const yNorm = normalize(point.y, bounds.min.y, bounds.max.y);
  return {
    x: padding + xNorm * (width - padding * 2),
    y: height - padding - yNorm * (height - padding * 2),
  };
};

export const worldToTopView = (
  point: Vec3,
  bounds: Bounds3,
  width: number,
  height: number,
  padding = 24,
): DiagramPoint => {
  const xNorm = normalize(point.x, bounds.min.x, bounds.max.x);
  const yNorm = normalize(point.z, bounds.min.z, bounds.max.z);
  return {
    x: padding + xNorm * (width - padding * 2),
    y: height - padding - yNorm * (height - padding * 2),
  };
};

const normalize2d = (x: number, y: number): { x: number; y: number } => {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 1e-9) {
    return { x: 1, y: 0 };
  }
  return { x: x / length, y: y / length };
};

export const planeLineWorldEndpoints = (
  plane: Plane,
  view: GeometryView,
  bounds: Bounds3,
): { start: Vec3; end: Vec3 } => {
  const extent =
    Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z) * 0.6;
  const direction =
    view === "side"
      ? normalize2d(-plane.normal.z, plane.normal.y)
      : normalize2d(-plane.normal.z, plane.normal.x);

  if (view === "side") {
    return {
      start: {
        x: plane.point.x,
        y: plane.point.y + direction.y * extent,
        z: plane.point.z + direction.x * extent,
      },
      end: {
        x: plane.point.x,
        y: plane.point.y - direction.y * extent,
        z: plane.point.z - direction.x * extent,
      },
    };
  }

  return {
    start: {
      x: plane.point.x + direction.y * extent,
      y: plane.point.y,
      z: plane.point.z + direction.x * extent,
    },
    end: {
      x: plane.point.x - direction.y * extent,
      y: plane.point.y,
      z: plane.point.z - direction.x * extent,
    },
  };
};

export const worldToDiagramPoint = (
  point: Vec3,
  view: GeometryView,
  bounds: Bounds3,
  width: number,
  height: number,
): DiagramPoint =>
  view === "side"
    ? worldToSideView(point, bounds, width, height)
    : worldToTopView(point, bounds, width, height);
