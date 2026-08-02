/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef } from "react";
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

const edgeWeightForRole = (
  role: CanonicalCameraMovementLattice["edges"][number]["role"],
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

type LatticeStyleBatch = {
  role: CanonicalCameraMovementLattice["edges"][number]["role"];
  targetRegion: CanonicalCameraMovementLattice["edges"][number]["targetRegion"];
  edgeIds: string[];
  positions: number[];
};

const createStyleBatches = (
  lattice: CanonicalCameraMovementLattice,
): LatticeStyleBatch[] => {
  const batches = new Map<string, LatticeStyleBatch>();
  lattice.edges.forEach((edge) => {
    const key = `${edge.role}:${edge.targetRegion}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        role: edge.role,
        targetRegion: edge.targetRegion,
        edgeIds: [],
        positions: [],
      };
      batches.set(key, batch);
    }
    const resolvedBatch = batch;
    resolvedBatch.edgeIds.push(edge.id);
    resolvedBatch.positions.push(
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

/**
 * Deterministic compact identity for the exact canonical millimetre geometry
 * consumed by both the interactive R3F subject and Ground Glass RTT.
 */
export const CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID =
  CAMERA_MOVEMENT_BASELINE_RENDER_MODEL.geometryId;

/** Apply target highlighting without replacing the canonical lattice objects. */
export const applyCameraMovementsGroupStyle = (
  group: THREE.Group,
  presentation: CameraMovementPresentationCalibration,
  targetRegion: CameraMovementTargetRegion,
): void => {
  group.userData.targetRegion = targetRegion;
  group.traverse((object) => {
    const edgeRole = object.userData.edgeRole;
    const edgeTargetRegion = object.userData.edgeTargetRegion;
    if (
      (edgeRole !== "internal" &&
        edgeRole !== "outer-horizontal" &&
        edgeRole !== "outer-vertical") ||
      (edgeTargetRegion !== "upper" &&
        edgeTargetRegion !== "middle" &&
        edgeTargetRegion !== "lower" &&
        edgeTargetRegion !== "neutral")
    ) return;
    const selected = edgeTargetRegion === targetRegion;
    const opacity = edgeRole === "internal" ? presentation.internalEdgeOpacity : 1;
    const material = object as THREE.LineSegments & { material?: THREE.Material };
    const lineMaterial = material.material as
      | (THREE.Material & { color?: THREE.Color; linewidth?: number; opacity?: number; transparent?: boolean })
      | undefined;
    if (!lineMaterial) return;
    lineMaterial.color?.set(
      selected ? colourForRegion(targetRegion, presentation) : presentation.inactiveColour,
    );
    if (typeof lineMaterial.linewidth === "number") {
      lineMaterial.linewidth = edgeWeightForRole(edgeRole, presentation);
    }
    if (typeof lineMaterial.opacity === "number") lineMaterial.opacity = opacity;
    if (typeof lineMaterial.transparent === "boolean") lineMaterial.transparent = opacity < 1;
    object.userData.lineOpacity = opacity;
    object.userData.selectedTarget = selected;
  });
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
  group.userData.resourceKey = `${geometryKey}|${presentationKey}`;
  group.userData.canonicalEdgeCount = lattice.edges.length;
  group.userData.canonicalEdgeIds = lattice.edges.map(({ id }) => id);
  group.userData.canonicalUnits = lattice.units;
  group.userData.canonicalBounds = lattice.bounds;

  createStyleBatches(lattice).forEach((batch) => {
    const selected = batch.targetRegion === targetRegion;
    const opacity = batch.role === "internal" ? presentation.internalEdgeOpacity : 1;
    const weight = edgeWeightForRole(batch.role, presentation);
    const lineGeometry = new LineSegmentsGeometry();
    lineGeometry.setPositions(batch.positions);
    lineGeometry.computeBoundingBox();
    lineGeometry.computeBoundingSphere();

    const lineMaterial = new LineMaterial({
      color: selected
        ? colourForRegion(targetRegion, presentation)
        : presentation.inactiveColour,
      linewidth: weight,
      opacity,
      transparent: opacity < 1,
      depthTest: true,
      depthWrite: true,
    });
    const segments = new LineSegments2(lineGeometry, lineMaterial);
    segments.name = `camera-movements-lattice-${batch.role}-${batch.targetRegion}`;
    segments.userData.edgeRole = batch.role;
    segments.userData.edgeTargetRegion = batch.targetRegion;
    segments.userData.canonicalEdgeIds = batch.edgeIds;
    segments.userData.lineWeight = weight;
    segments.userData.lineOpacity = opacity;
    segments.userData.selectedTarget = selected;
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

/** Publish a target-only presentation update without changing mount identity. */
export const updateAttachedInteractiveLatticeRuntime = (
  group: THREE.Group,
  targetRegion: CameraMovementTargetRegion,
): InteractiveLatticeRuntimeInfo | null => {
  group.userData.targetRegion = targetRegion;
  const current = useAppStore.getState().interactiveLatticeRuntimeInfo;
  const generation = group.userData.interactiveMountGeneration;
  if (!current || current.generation !== generation) return null;
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
  const onGroupChangeRef = useRef(onGroupChange);
  onGroupChangeRef.current = onGroupChange;
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
        ),
      ),
    [renderModel],
  );

  useEffect(() => {
    applyCameraMovementsGroupStyle(
      group,
      renderModel.presentation,
      targetRegion,
    );
    updateAttachedInteractiveLatticeRuntime(group, targetRegion);
  }, [group, renderModel, targetRegion]);

  useEffect(() => {
    const runtimeInfo =
      publishAttachedInteractiveLatticeRuntime(group, r3fScene);
    onGroupChangeRef.current?.(group);
    return () => {
      disposeCameraMovementsGroup(group);
      clearInteractiveLatticeRuntime(runtimeInfo);
      onGroupChangeRef.current?.(null);
    };
  }, [group, r3fScene]);

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
