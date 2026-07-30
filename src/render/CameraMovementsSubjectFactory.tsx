/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { CanonicalCameraMovementLattice } from "../scenes/cameraMovementLatticeGeometry";
import type {
  CameraMovementPresentationCalibration,
  CameraMovementTargetRegion,
} from "../scenes/cameraMovementSceneCalibration";
import { useAppStore } from "../state/appStore";
import { selectEffectiveCameraMovementCalibration } from "../state/selectors";
import type { SceneDefinition } from "../types/scene";
import {
  CAMERA_MOVEMENT_BASELINE_RENDER_MODEL,
  resolveCameraMovementLatticeRenderModel,
  type CameraMovementLatticeRenderModel,
} from "./cameraMovementLatticeRenderModel";
import {
  nextInteractiveLatticeGeneration,
  readInteractiveLatticeRuntimeInfo,
  type InteractiveLatticeRuntimeInfo,
} from "./cameraMovementLatticeRuntime";
import { toWorld } from "./rttUtils";

type LatticeStyleBatch = {
  role: CanonicalCameraMovementLattice["edges"][number]["role"];
  colour: string;
  opacity: number;
  weight: number;
  edgeIds: string[];
  positions: number[];
};

const edgeWeightForRole = (
  role: LatticeStyleBatch["role"],
  presentation: CameraMovementPresentationCalibration,
): number => {
  if (role === "outer-vertical") return presentation.outerVerticalWeight;
  if (role === "outer-horizontal") return presentation.outerHorizontalWeight;
  return presentation.internalEdgeWeight;
};

const colourForRegion = (
  region: CameraMovementTargetRegion,
  presentation: CameraMovementPresentationCalibration,
): string => {
  if (region === "upper") return presentation.upperRegionColour;
  if (region === "lower") return presentation.lowerRegionColour;
  return presentation.middleRegionColour;
};

/**
 * Deterministic compact identity for the exact canonical millimetre geometry
 * consumed by both the interactive R3F subject and Ground Glass RTT.
 */
export const CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID =
  CAMERA_MOVEMENT_BASELINE_RENDER_MODEL.geometryId;

const createStyleBatches = (
  lattice: CanonicalCameraMovementLattice,
  presentation: CameraMovementPresentationCalibration,
  targetRegion: CameraMovementTargetRegion,
): LatticeStyleBatch[] => {
  const batches = new Map<string, LatticeStyleBatch>();

  lattice.edges.forEach((edge) => {
    const selected = edge.targetRegion === targetRegion;
    const colour = selected
      ? colourForRegion(targetRegion, presentation)
      : presentation.inactiveColour;
    const opacity =
      edge.role === "internal" ? presentation.internalEdgeOpacity : 1;
    const weight = edgeWeightForRole(edge.role, presentation);
    const key = `${edge.role}:${colour}:${opacity}:${weight}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        role: edge.role,
        colour,
        opacity,
        weight,
        edgeIds: [],
        positions: [],
      };
      batches.set(key, batch);
    }
    batch.edgeIds.push(edge.id);
    batch.positions.push(
      toWorld(edge.startWorld.x),
      toWorld(edge.startWorld.y),
      toWorld(edge.startWorld.z),
      toWorld(edge.endWorld.x),
      toWorld(edge.endWorld.y),
      toWorld(edge.endWorld.z),
    );
  });

  return [...batches.values()];
};

export type CameraMovementsGroupOptions = Readonly<{
  lattice: CanonicalCameraMovementLattice;
  presentation: CameraMovementPresentationCalibration;
  geometryKey: string;
  presentationKey: string;
  geometryId: string;
  grid: CameraMovementLatticeRenderModel["grid"];
  targetRegion?: CameraMovementTargetRegion;
}>;

export const cameraMovementsGroupOptionsFromRenderModel = (
  model: CameraMovementLatticeRenderModel,
  targetRegion?: CameraMovementTargetRegion,
): CameraMovementsGroupOptions => ({
  lattice: model.lattice,
  presentation: model.presentation,
  geometryKey: model.geometryKey,
  presentationKey: model.presentationKey,
  geometryId: model.geometryId,
  grid: model.grid,
  targetRegion,
});

const resolveGroupOptions = (
  optionsOrTarget?: CameraMovementsGroupOptions | CameraMovementTargetRegion,
): Required<CameraMovementsGroupOptions> => {
  const baseline = CAMERA_MOVEMENT_BASELINE_RENDER_MODEL;
  const options =
    typeof optionsOrTarget === "object"
      ? optionsOrTarget
      : cameraMovementsGroupOptionsFromRenderModel(
          baseline,
          optionsOrTarget,
        );
  return {
    ...options,
    targetRegion:
      options.targetRegion ?? options.presentation.defaultTargetRegion,
  };
};

/**
 * Create one owned Three.js representation of the canonical lattice.
 *
 * LineSegments2 gives the calibrated hierarchy meaningful pixel weights in
 * both the interactive renderer and RTT. Each unique canonical edge appears
 * in exactly one style batch; no renderer reconstructs cells or cube faces.
 */
export function createCameraMovementsGroup(
  optionsOrTarget?: CameraMovementsGroupOptions | CameraMovementTargetRegion,
): THREE.Group {
  const {
    lattice,
    presentation,
    geometryKey,
    presentationKey,
    geometryId,
    grid,
    targetRegion,
  } = resolveGroupOptions(optionsOrTarget);
  const group = new THREE.Group();
  group.name = "camera-movements-lattice-subject";
  group.userData.resourceOwnership = "owned";
  group.userData.targetRegion = targetRegion;
  group.userData.canonicalGeometryId = geometryId;
  group.userData.canonicalGeometryKey = geometryKey;
  group.userData.presentationKey = presentationKey;
  group.userData.resourceKey =
    `${geometryKey}|${presentationKey}|target:${targetRegion}`;
  group.userData.canonicalEdgeCount = lattice.edges.length;
  group.userData.canonicalEdgeIds = lattice.edges.map(({ id }) => id);
  group.userData.canonicalUnits = lattice.units;
  group.userData.canonicalBounds = lattice.bounds;

  createStyleBatches(lattice, presentation, targetRegion).forEach((batch) => {
    const lineGeometry = new LineSegmentsGeometry();
    lineGeometry.setPositions(batch.positions);
    lineGeometry.computeBoundingBox();
    lineGeometry.computeBoundingSphere();

    const lineMaterial = new LineMaterial({
      color: batch.colour,
      linewidth: batch.weight,
      opacity: batch.opacity,
      transparent: batch.opacity < 1,
      depthTest: true,
      depthWrite: true,
    });
    const segments = new LineSegments2(lineGeometry, lineMaterial);
    segments.name = `camera-movements-lattice-${batch.role}`;
    segments.userData.edgeRole = batch.role;
    segments.userData.canonicalEdgeIds = batch.edgeIds;
    segments.userData.lineWeight = batch.weight;
    segments.userData.lineOpacity = batch.opacity;
    segments.computeLineDistances();
    group.add(segments);
  });

  const gridSizeWorld = toWorld(grid.halfExtentMm * 2);
  const gridDivisions = Math.max(
    1,
    Math.round((grid.halfExtentMm * 2) / grid.cellSizeMm),
  );
  const referenceGrid = new THREE.GridHelper(
    gridSizeWorld,
    gridDivisions,
    presentation.inactiveColour,
    presentation.inactiveColour,
  );
  referenceGrid.name = "camera-movements-reference-grid";
  referenceGrid.position.set(
    toWorld(grid.center.x),
    toWorld(grid.center.y),
    toWorld(grid.center.z),
  );
  referenceGrid.userData.geometryKey = geometryKey;
  referenceGrid.userData.presentationKey = presentationKey;
  referenceGrid.userData.canonicalEdgeIds = [];
  referenceGrid.userData.cellSizeMm = grid.cellSizeMm;
  referenceGrid.userData.halfExtentMm = grid.halfExtentMm;
  const gridMaterials = Array.isArray(referenceGrid.material)
    ? referenceGrid.material
    : [referenceGrid.material];
  gridMaterials.forEach((material) => {
    material.transparent = presentation.internalEdgeOpacity < 1;
    material.opacity = presentation.internalEdgeOpacity;
    material.depthWrite = false;
  });
  group.add(referenceGrid);

  return group;
}

export type CameraMovementsSubjectProps = {
  scene?: SceneDefinition;
  onGroupChange?: (group: THREE.Group | null) => void;
};

const belongsToScene = (group: THREE.Group, scene: THREE.Scene): boolean => {
  let current: THREE.Object3D | null = group;
  while (current) {
    if (current === scene) return true;
    current = current.parent;
  }
  return false;
};

export const publishAttachedInteractiveLatticeRuntime = (
  group: THREE.Group,
  scene: THREE.Scene,
): InteractiveLatticeRuntimeInfo | null => {
  if (!belongsToScene(group, scene)) return null;
  group.userData.interactiveMountGeneration =
    nextInteractiveLatticeGeneration();
  const runtimeInfo = readInteractiveLatticeRuntimeInfo(group);
  useAppStore.getState().setInteractiveLatticeRuntimeInfo(runtimeInfo);
  return runtimeInfo;
};

export const clearInteractiveLatticeRuntime = (
  runtimeInfo: InteractiveLatticeRuntimeInfo | null,
): void => {
  if (!runtimeInfo) return;
  const currentRuntime =
    useAppStore.getState().interactiveLatticeRuntimeInfo;
  if (currentRuntime?.generation === runtimeInfo.generation) {
    useAppStore.getState().setInteractiveLatticeRuntimeInfo(null);
  }
};

export const CameraMovementsSubject: React.FC<CameraMovementsSubjectProps> = ({
  onGroupChange,
}) => {
  const targetRegion = useAppStore((state) => state.scene.targetRegion);
  const effectiveCalibration = useAppStore(
    selectEffectiveCameraMovementCalibration,
  );
  const r3fScene = useThree((state) => state.scene);
  const renderModel = resolveCameraMovementLatticeRenderModel(
    effectiveCalibration,
  );
  const group = useMemo(
    () =>
      createCameraMovementsGroup(
        cameraMovementsGroupOptionsFromRenderModel(
          renderModel,
          targetRegion,
        ),
      ),
    [renderModel, targetRegion],
  );

  useEffect(() => {
    const runtimeInfo =
      publishAttachedInteractiveLatticeRuntime(group, r3fScene);
    onGroupChange?.(group);
    return () => {
      disposeCameraMovementsGroup(group);
      clearInteractiveLatticeRuntime(runtimeInfo);
      onGroupChange?.(null);
    };
  }, [group, onGroupChange, r3fScene]);

  return <primitive object={group} dispose={null} />;
};

/** Dispose every resource owned by this lattice group exactly once. */
export function disposeCameraMovementsGroup(group: THREE.Group): void {
  if (group.userData.resourcesDisposed === true) return;
  group.userData.resourcesDisposed = true;

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) {
      return;
    }
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.forEach((material) => {
      if (material) materials.add(material);
    });
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  group.userData.disposedGeometryCount = geometries.size;
  group.userData.disposedMaterialCount = materials.size;
}
