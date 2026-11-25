import * as THREE from "three";

export type AnatomyProjectedRegion = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

export type AnatomyWorldBounds = Readonly<{
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}>;

export type AnatomyProjectedBoundsSnapshot = Readonly<{
  worldBounds: AnatomyWorldBounds | null;
  projectedBounds: AnatomyProjectedRegion | null;
}>;

const supportsReadOnlyPreciseBounds = (object: THREE.Object3D): boolean => {
  let supported = true;
  object.traverse((candidate) => {
    const geometry = (candidate as THREE.Object3D & { geometry?: THREE.BufferGeometry }).geometry;
    if (geometry && (candidate as THREE.InstancedMesh).isInstancedMesh === true) supported = false;
    if (geometry && geometry.getAttribute("position") === undefined) supported = false;
  });
  return supported;
};

/**
 * Measures the current vertex geometry without updating or replacing geometry bounds.
 * Box3's precise path walks descendants and applies their current world transforms.
 */
export const calculateAnatomyProjectedBounds = (
  object: THREE.Object3D,
  camera: THREE.Camera,
): AnatomyProjectedBoundsSnapshot => {
  object.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  camera.updateMatrixWorld(true);

  // Box3's precise path falls back to cached bounds for unsupported geometry. Fail closed
  // rather than allowing that fallback to compute and cache a geometry bounding box.
  if (!supportsReadOnlyPreciseBounds(object)) {
    return { worldBounds: null, projectedBounds: null };
  }

  const bounds = new THREE.Box3().setFromObject(object, true);
  if (bounds.isEmpty()) return { worldBounds: null, projectedBounds: null };

  const worldBounds: AnatomyWorldBounds = {
    min: [bounds.min.x, bounds.min.y, bounds.min.z],
    max: [bounds.max.x, bounds.max.y, bounds.max.z],
  };
  const points: THREE.Vector3[] = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        points.push(new THREE.Vector3(x, y, z).project(camera));
      }
    }
  }
  const visiblePoints = points.filter((point) =>
    Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z) &&
    point.z >= -1 && point.z <= 1,
  );
  if (visiblePoints.length === 0) return { worldBounds, projectedBounds: null };

  const left = Math.max(0, Math.min(...visiblePoints.map((point) => point.x * 0.5 + 0.5)));
  const right = Math.min(1, Math.max(...visiblePoints.map((point) => point.x * 0.5 + 0.5)));
  const top = Math.max(0, Math.min(...visiblePoints.map((point) => 0.5 - point.y * 0.5)));
  const bottom = Math.min(1, Math.max(...visiblePoints.map((point) => 0.5 - point.y * 0.5)));

  return {
    worldBounds,
    projectedBounds: right > left && bottom > top
      ? { left, top, right, bottom }
      : null,
  };
};
