import * as THREE from "three";
import type {
  GroundGlassProfilingSnapshot,
  GroundGlassProfilingTimingStats,
} from "./groundGlassProfiling";

export type SceneGraphCapacityMetrics = Readonly<{
  objectCount: number;
  meshCount: number;
  instancedMeshCount: number;
  lightCount: number;
  lineCount: number;
  pointsCount: number;
  uniqueGeometryCount: number;
  uniqueMaterialCount: number;
  uniqueTextureCount: number;
  triangleCount: number;
  instancedTriangleCount: number;
  effectiveTriangleCount: number;
}>;

export type SceneCapacityRendererResources = Readonly<{
  geometries: number;
  textures: number;
}>;

export type SceneCapacityFrameCadence = Readonly<{
  p50Ms: number | null;
  p95Ms: number | null;
  approxFps: number | null;
  count: number;
}>;

export type SceneCapacityRuntimeDetails = Readonly<{
  rttSubject: SceneGraphCapacityMetrics | null;
  rendererResources: SceneCapacityRendererResources | null;
}>;

export type SceneCapacitySnapshot = Readonly<{
  sceneId: string | null;
  viewportSubject: SceneGraphCapacityMetrics | null;
  rttSubject: SceneGraphCapacityMetrics | null;
  rendererResources: SceneCapacityRendererResources | null;
  frameCadence: SceneCapacityFrameCadence;
  groundGlass: GroundGlassProfilingSnapshot | null;
}>;

const EMPTY_FRAME_CADENCE: SceneCapacityFrameCadence = {
  p50Ms: null,
  p95Ms: null,
  approxFps: null,
  count: 0,
};

const finiteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const triangleCountForGeometry = (geometry: THREE.BufferGeometry): number => {
  const count = geometry.index?.count ?? geometry.attributes.position?.count ?? 0;
  return Number.isFinite(count) && count > 0 ? Math.floor(count / 3) : 0;
};

const collectTextures = (
  value: unknown,
  textures: Set<THREE.Texture>,
  visited: WeakSet<object>,
  depth: number,
): void => {
  if (value instanceof THREE.Texture) {
    textures.add(value);
    return;
  }
  if (depth <= 0 || value === null || typeof value !== "object") return;
  if (visited.has(value)) return;
  visited.add(value);

  if (Array.isArray(value)) {
    value.forEach((entry) => collectTextures(entry, textures, visited, depth - 1));
    return;
  }

  Object.values(value as Record<string, unknown>).forEach((entry) =>
    collectTextures(entry, textures, visited, depth - 1),
  );
};

const collectMaterialResources = (
  material: THREE.Material,
  materials: Set<THREE.Material>,
  textures: Set<THREE.Texture>,
): void => {
  materials.add(material);
  const visited = new WeakSet<object>();
  collectTextures(material, textures, visited, 3);
};

/**
 * Collect static scene-graph pressure without touching a renderer or GPU.
 * Resource sets are identity-based so shared geometry/material/texture objects
 * are counted once even when many meshes reference them.
 */
export const collectSceneGraphCapacity = (
  root: THREE.Object3D,
): SceneGraphCapacityMetrics => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let objectCount = 0;
  let meshCount = 0;
  let instancedMeshCount = 0;
  let lightCount = 0;
  let lineCount = 0;
  let pointsCount = 0;
  let triangleCount = 0;
  let instancedTriangleCount = 0;

  root.traverse((object) => {
    objectCount += 1;
    if (object instanceof THREE.Light) lightCount += 1;
    if (object instanceof THREE.Line) lineCount += 1;
    if (object instanceof THREE.Points) pointsCount += 1;

    const materialValue = (object as unknown as { material?: unknown }).material;
    if (materialValue instanceof THREE.Material) {
      collectMaterialResources(materialValue, materials, textures);
    } else if (Array.isArray(materialValue)) {
      materialValue.forEach((material) => {
        if (material instanceof THREE.Material) {
          collectMaterialResources(material, materials, textures);
        }
      });
    }

    if (!(object instanceof THREE.Mesh)) return;
    meshCount += 1;
    const geometry = object.geometry;
    if (!(geometry instanceof THREE.BufferGeometry)) return;
    geometries.add(geometry);
    const baseTriangles = triangleCountForGeometry(geometry);
    if (object instanceof THREE.InstancedMesh) {
      instancedMeshCount += 1;
      instancedTriangleCount += baseTriangles * Math.max(0, object.count);
    } else {
      triangleCount += baseTriangles;
    }
  });

  return {
    objectCount,
    meshCount,
    instancedMeshCount,
    lightCount,
    lineCount,
    pointsCount,
    uniqueGeometryCount: geometries.size,
    uniqueMaterialCount: materials.size,
    uniqueTextureCount: textures.size,
    triangleCount,
    instancedTriangleCount,
    effectiveTriangleCount: triangleCount + instancedTriangleCount,
  };
};

export const readSceneCapacityRendererResources = (
  renderer: unknown,
): SceneCapacityRendererResources | null => {
  const memory = (
    renderer as { info?: { memory?: { geometries?: unknown; textures?: unknown } } }
  )?.info?.memory;
  if (!memory || !finiteNonNegative(memory.geometries) || !finiteNonNegative(memory.textures)) {
    return null;
  }
  return {
    geometries: memory.geometries,
    textures: memory.textures,
  };
};

export const isSceneCapacityProfilingEnabled = (search?: string): boolean => {
  const locationSearch = search ?? (typeof window !== "undefined" ? window.location.search : "");
  return new URLSearchParams(locationSearch).get("sceneCapacityProfiling") === "1";
};

export const resolveSceneCapacityFrameCadence = (
  snapshot: GroundGlassProfilingSnapshot | null | undefined,
): SceneCapacityFrameCadence => {
  if (!snapshot) return { ...EMPTY_FRAME_CADENCE };
  const frame: GroundGlassProfilingTimingStats = snapshot.frame;
  return {
    p50Ms: frame.p50Ms,
    p95Ms: frame.p95Ms,
    approxFps: snapshot.approxFps,
    count: frame.count,
  };
};

export const createSceneCapacitySnapshot = ({
  sceneId,
  viewportSubject = null,
  rttSubject = null,
  rendererResources = null,
  groundGlass = null,
}: {
  sceneId: string | null;
  viewportSubject?: SceneGraphCapacityMetrics | null;
  rttSubject?: SceneGraphCapacityMetrics | null;
  rendererResources?: SceneCapacityRendererResources | null;
  groundGlass?: GroundGlassProfilingSnapshot | null;
}): SceneCapacitySnapshot => ({
  sceneId,
  viewportSubject,
  rttSubject,
  rendererResources,
  frameCadence: resolveSceneCapacityFrameCadence(groundGlass),
  groundGlass,
});
