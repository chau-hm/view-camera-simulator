import type { Bounds3, Vec3 } from "../types/optics";
import {
  generateCameraMovementLattice,
  type CanonicalCameraMovementLattice,
} from "../scenes/cameraMovementLatticeGeometry";
import {
  CAMERA_MOVEMENT_CALIBRATION_BASELINE,
  resolveEffectiveCameraMovementCalibration,
  type EffectiveCameraMovementCalibration,
} from "../scenes/cameraMovementEffectiveCalibration";
import type { CameraMovementPresentationCalibration } from "../scenes/cameraMovementSceneCalibration";

export type CameraMovementLatticeRenderModel = Readonly<{
  lattice: CanonicalCameraMovementLattice;
  presentation: CameraMovementPresentationCalibration;
  geometryKey: string;
  presentationKey: string;
  geometryId: string;
  subjectBounds: Bounds3;
  grid: Readonly<{
    center: Vec3;
    halfExtentMm: number;
    cellSizeMm: number;
  }>;
  lightingTargetMm: Vec3;
  showReferenceCamera: boolean;
}>;

const hashIdentityPayload = (payload: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const latticeIdentityPayload = (
  lattice: CanonicalCameraMovementLattice,
): string =>
  JSON.stringify({
    units: lattice.units,
    dimensions: lattice.dimensions,
    vertices: lattice.vertices.map(({ id, positionWorld }) => [
      id,
      positionWorld.x,
      positionWorld.y,
      positionWorld.z,
    ]),
    edges: lattice.edges.map(({ id, vertexIds, axis, role, levelIndices }) => [
      id,
      vertexIds,
      axis,
      role,
      levelIndices,
    ]),
    bounds: lattice.bounds,
    targetLevelByRegion: lattice.targetLevelByRegion,
  });

/**
 * Deterministic identity for physical lattice geometry. Presentation, optics,
 * rig placement, and the selected target are deliberately excluded.
 */
export const createCameraMovementLatticeGeometryId = (
  lattice: CanonicalCameraMovementLattice,
): string =>
  `camera-movement-lattice-${hashIdentityPayload(latticeIdentityPayload(lattice))}`;

type CachedGeometry = Readonly<{
  geometryKey: string;
  lattice: CanonicalCameraMovementLattice;
  geometryId: string;
  subjectBounds: Bounds3;
  grid: CameraMovementLatticeRenderModel["grid"];
}>;

const geometryCache = new Map<string, CachedGeometry>();
const renderModelCache = new Map<string, CameraMovementLatticeRenderModel>();
const GEOMETRY_CACHE_LIMIT = 8;
const RENDER_MODEL_CACHE_LIMIT = 8;

const resolveGeometry = (
  calibration: EffectiveCameraMovementCalibration,
): CachedGeometry => {
  const cached = geometryCache.get(calibration.subjectGeometryKey);
  if (cached) {
    geometryCache.delete(calibration.subjectGeometryKey);
    geometryCache.set(calibration.subjectGeometryKey, cached);
    return cached;
  }

  const lattice = generateCameraMovementLattice(calibration.subject);
  const latticeWidthMm = lattice.bounds.max.x - lattice.bounds.min.x;
  const latticeDepthMm = lattice.bounds.max.z - lattice.bounds.min.z;
  const geometry: CachedGeometry = {
    geometryKey: calibration.subjectGeometryKey,
    lattice,
    geometryId: createCameraMovementLatticeGeometryId(lattice),
    subjectBounds: lattice.bounds,
    grid: {
      center: {
        x: calibration.subject.originWorld.x,
        y: lattice.bounds.min.y - calibration.subject.cubeSizeMm / 2,
        z: calibration.subject.originWorld.z,
      },
      halfExtentMm:
        Math.max(latticeWidthMm, latticeDepthMm) / 2 +
        calibration.subject.cubeSizeMm,
      cellSizeMm: calibration.subject.cubeSizeMm,
    },
  };
  geometryCache.set(calibration.subjectGeometryKey, geometry);
  if (geometryCache.size > GEOMETRY_CACHE_LIMIT) {
    const oldestKey = geometryCache.keys().next().value;
    if (typeof oldestKey === "string") geometryCache.delete(oldestKey);
  }
  return geometry;
};

/**
 * Resolve one renderer-facing bundle from the canonical effective calibration.
 *
 * Physical lattices are kept in a small bounded cache by scoped geometry key
 * so the interactive scene and Ground Glass consume the same immutable
 * lattice object. GPU groups and their resources remain independently owned.
 */
export const resolveCameraMovementLatticeRenderModel = (
  calibration: EffectiveCameraMovementCalibration,
): CameraMovementLatticeRenderModel => {
  const cacheKey =
    `${calibration.subjectGeometryKey}|${calibration.presentationKey}`;
  const cached = renderModelCache.get(cacheKey);
  if (cached) {
    renderModelCache.delete(cacheKey);
    renderModelCache.set(cacheKey, cached);
    return cached;
  }
  const geometry = resolveGeometry(calibration);
  const renderModel: CameraMovementLatticeRenderModel = {
    ...geometry,
    presentation: calibration.presentation,
    presentationKey: calibration.presentationKey,
    lightingTargetMm: {
      x: calibration.subject.originWorld.x,
      y: calibration.subject.originWorld.y,
      z: calibration.subject.originWorld.z,
    },
    showReferenceCamera: calibration.presentation.showReferenceCamera,
  };
  renderModelCache.set(cacheKey, renderModel);
  if (renderModelCache.size > RENDER_MODEL_CACHE_LIMIT) {
    const oldestKey = renderModelCache.keys().next().value;
    if (typeof oldestKey === "string") renderModelCache.delete(oldestKey);
  }
  return renderModel;
};

export const CAMERA_MOVEMENT_BASELINE_RENDER_MODEL =
  resolveCameraMovementLatticeRenderModel(
    resolveEffectiveCameraMovementCalibration(
      CAMERA_MOVEMENT_CALIBRATION_BASELINE,
    ),
  );
