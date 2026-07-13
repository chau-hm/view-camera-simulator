import type { Bounds3, Plane, Vec3 } from "../types/optics";
import type { SceneDefinition } from "../types/scene";

export type ScenePlaneOverlayGeometry = {
  verticesMm: Vec3[];
  triangleIndices: number[];
};

const BOX_EDGES = [
  [0, 1], [0, 2], [0, 4],
  [1, 3], [1, 5],
  [2, 3], [2, 6],
  [3, 7],
  [4, 5], [4, 6],
  [5, 7],
  [6, 7],
] as const;

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const normalize = (value: Vec3): Vec3 => {
  const length = Math.hypot(value.x, value.y, value.z) || 1;
  return { x: value.x / length, y: value.y / length, z: value.z / length };
};

const getBoundsCorners = (bounds: Bounds3): Vec3[] => [
  { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
  { x: bounds.min.x, y: bounds.min.y, z: bounds.max.z },
  { x: bounds.min.x, y: bounds.max.y, z: bounds.min.z },
  { x: bounds.min.x, y: bounds.max.y, z: bounds.max.z },
  { x: bounds.max.x, y: bounds.min.y, z: bounds.min.z },
  { x: bounds.max.x, y: bounds.min.y, z: bounds.max.z },
  { x: bounds.max.x, y: bounds.max.y, z: bounds.min.z },
  { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
];

export const getScenePlaneOverlayBounds = (scene: SceneDefinition): Bounds3 => {
  if (scene.id !== "table-tilt" || scene.compositionTargets.length === 0) {
    return scene.bounds;
  }

  // Table Tilt helpers should explain the tabletop, not cover the floor-sized
  // scene. Keep the physical scene height so all three planes can intersect,
  // while clipping their X/Z extent to the teaching subject.
  const subjectBounds = scene.compositionTargets[0].worldBounds;
  const horizontalMarginMm = 220;
  return {
    min: {
      x: subjectBounds.min.x - horizontalMarginMm,
      y: scene.bounds.min.y,
      z: subjectBounds.min.z - horizontalMarginMm,
    },
    max: {
      x: subjectBounds.max.x + horizontalMarginMm,
      y: scene.bounds.max.y,
      z: subjectBounds.max.z + horizontalMarginMm,
    },
  };
};

export const createScenePlaneOverlayGeometry = (
  plane: Plane,
  bounds: Bounds3,
  options: { extendToPlanePoint?: boolean } = {},
): ScenePlaneOverlayGeometry | null => {
  // A finite DOF boundary can sit just beyond the physical scene bounds. Extend
  // only far enough to include the canonical point on that plane; this keeps
  // helpers bounded while preserving existing scenes at their focus extremes.
  const marginMm = Math.max(
    1,
    Math.max(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z,
    ) * 0.01,
  );
  const clipBounds: Bounds3 = options.extendToPlanePoint === false ? bounds : {
    min: {
      x: Math.min(bounds.min.x, plane.point.x - marginMm),
      y: Math.min(bounds.min.y, plane.point.y - marginMm),
      z: Math.min(bounds.min.z, plane.point.z - marginMm),
    },
    max: {
      x: Math.max(bounds.max.x, plane.point.x + marginMm),
      y: Math.max(bounds.max.y, plane.point.y + marginMm),
      z: Math.max(bounds.max.z, plane.point.z + marginMm),
    },
  };
  const corners = getBoundsCorners(clipBounds);
  const normal = normalize(plane.normal);
  const epsilonMm = 1e-5;
  const vertices: Vec3[] = [];

  const signedDistance = (point: Vec3) => dot(subtract(point, plane.point), normal);
  const addVertex = (point: Vec3) => {
    if (
      vertices.some(
        (existing) =>
          Math.hypot(
            existing.x - point.x,
            existing.y - point.y,
            existing.z - point.z,
          ) < 1e-3,
      )
    ) {
      return;
    }
    vertices.push(point);
  };

  for (const [startIndex, endIndex] of BOX_EDGES) {
    const start = corners[startIndex];
    const end = corners[endIndex];
    const startDistance = signedDistance(start);
    const endDistance = signedDistance(end);

    if (Math.abs(startDistance) <= epsilonMm) addVertex(start);
    if (Math.abs(endDistance) <= epsilonMm) addVertex(end);

    if (startDistance * endDistance < -(epsilonMm ** 2)) {
      const t = startDistance / (startDistance - endDistance);
      addVertex({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        z: start.z + (end.z - start.z) * t,
      });
    }
  }

  if (vertices.length < 3) return null;

  const centroid = vertices.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y, z: sum.z + point.z }),
    { x: 0, y: 0, z: 0 },
  );
  centroid.x /= vertices.length;
  centroid.y /= vertices.length;
  centroid.z /= vertices.length;

  const reference = Math.abs(normal.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const axisU = normalize(cross(normal, reference));
  const axisV = normalize(cross(normal, axisU));
  vertices.sort((a, b) => {
    const aDelta = subtract(a, centroid);
    const bDelta = subtract(b, centroid);
    return (
      Math.atan2(dot(aDelta, axisV), dot(aDelta, axisU)) -
      Math.atan2(dot(bDelta, axisV), dot(bDelta, axisU))
    );
  });

  const triangleIndices: number[] = [];
  for (let index = 1; index < vertices.length - 1; index += 1) {
    triangleIndices.push(0, index, index + 1);
  }

  return { verticesMm: vertices, triangleIndices };
};
