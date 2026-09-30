import type { Bounds3, Vec3 } from "../../types/optics";
import {
  generateCameraMovementLattice,
  type CanonicalCameraMovementLattice,
} from "../cameraMovementLatticeGeometry";
import {
  CAMERA_MOVEMENT_CALIBRATION_BASELINE,
  resolveEffectiveCameraMovementCalibration,
  type EffectiveCameraMovementCalibration,
} from "../cameraMovementEffectiveCalibration";
import type { CameraMovementPresentationCalibration } from "../cameraMovementSceneCalibration";

/**
 * Plain application data for presenting the canonical movement lattice.
 * Coordinates and dimensions are canonical world-space millimetres: +X is
 * camera-right, +Y is up, and +Z runs from the lens toward the subject.
 * This module deliberately contains no renderer or asset implementation.
 */
export type CameraMovementLatticePresentation = Readonly<{
  sceneId: "understanding-camera-movements";
  object: Readonly<{
    id: "camera-movement-lattice";
    role: "camera-movement-target-lattice";
  }>;
  lattice: CanonicalCameraMovementLattice;
  presentation: CameraMovementPresentationCalibration;
  geometryKey: string;
  presentationKey: string;
  geometryId: string;
  subjectBoundsWorldMm: Bounds3;
  referenceGrid: Readonly<{
    centerWorldMm: Vec3;
    halfExtentMm: number;
    cellSizeMm: number;
  }>;
  /** Current teaching-light aim point; light behavior remains renderer-owned. */
  lightingTargetWorldMm: Vec3;
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

/** Deterministic identity for physical lattice geometry, excluding styling. */
export const createCameraMovementLatticeGeometryId = (
  lattice: CanonicalCameraMovementLattice,
): string =>
  `camera-movement-lattice-${hashIdentityPayload(latticeIdentityPayload(lattice))}`;

type CachedGeometry = Readonly<{
  geometryKey: string;
  lattice: CanonicalCameraMovementLattice;
  geometryId: string;
  subjectBoundsWorldMm: Bounds3;
  referenceGrid: CameraMovementLatticePresentation["referenceGrid"];
}>;

const geometryCache = new Map<string, CachedGeometry>();
const presentationCache = new Map<string, CameraMovementLatticePresentation>();
const GEOMETRY_CACHE_LIMIT = 8;
const PRESENTATION_CACHE_LIMIT = 8;

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
    subjectBoundsWorldMm: lattice.bounds,
    referenceGrid: {
      centerWorldMm: {
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
 * Derive the scene-specific presentation contract from canonical calibration.
 * Interactive rendering and Ground Glass share this same immutable-by-contract
 * data; neither asset implementation can redefine its targets or dimensions.
 */
export const resolveCameraMovementLatticePresentation = (
  calibration: EffectiveCameraMovementCalibration,
): CameraMovementLatticePresentation => {
  const cacheKey = `${calibration.subjectGeometryKey}|${calibration.presentationKey}`;
  const cached = presentationCache.get(cacheKey);
  if (cached) {
    presentationCache.delete(cacheKey);
    presentationCache.set(cacheKey, cached);
    return cached;
  }
  const geometry = resolveGeometry(calibration);
  const contract: CameraMovementLatticePresentation = {
    sceneId: "understanding-camera-movements",
    object: {
      id: "camera-movement-lattice",
      role: "camera-movement-target-lattice",
    },
    ...geometry,
    presentation: calibration.presentation,
    presentationKey: calibration.presentationKey,
    lightingTargetWorldMm: {
      x: calibration.subject.originWorld.x,
      y: calibration.subject.originWorld.y,
      z: calibration.subject.originWorld.z,
    },
    showReferenceCamera: calibration.presentation.showReferenceCamera,
  };
  presentationCache.set(cacheKey, contract);
  if (presentationCache.size > PRESENTATION_CACHE_LIMIT) {
    const oldestKey = presentationCache.keys().next().value;
    if (typeof oldestKey === "string") presentationCache.delete(oldestKey);
  }
  return contract;
};

export const CAMERA_MOVEMENT_BASELINE_PRESENTATION =
  resolveCameraMovementLatticePresentation(
    resolveEffectiveCameraMovementCalibration(
      CAMERA_MOVEMENT_CALIBRATION_BASELINE,
    ),
  );
