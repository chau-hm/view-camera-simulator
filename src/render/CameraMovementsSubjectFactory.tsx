/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { CAMERA_MOVEMENT_LATTICE } from "../scenes/cameraMovementLatticeGeometry";
import {
  CAMERA_MOVEMENT_SCENE_CALIBRATION,
  type CameraMovementTargetRegion,
} from "../scenes/cameraMovementSceneCalibration";
import { useAppStore } from "../state/appStore";
import type { SceneDefinition } from "../types/scene";
import {
  nextInteractiveLatticeGeneration,
  readInteractiveLatticeRuntimeInfo,
} from "./cameraMovementLatticeRuntime";
import { toWorld } from "./rttUtils";

const { presentation } = CAMERA_MOVEMENT_SCENE_CALIBRATION;

type LatticeStyleBatch = {
  role: (typeof CAMERA_MOVEMENT_LATTICE.edges)[number]["role"];
  colour: string;
  opacity: number;
  weight: number;
  edgeIds: string[];
  positions: number[];
};

const edgeWeightForRole = (
  role: LatticeStyleBatch["role"],
): number => {
  if (role === "outer-vertical") return presentation.outerVerticalWeight;
  if (role === "outer-horizontal") return presentation.outerHorizontalWeight;
  return presentation.internalEdgeWeight;
};

const colourForRegion = (region: CameraMovementTargetRegion): string => {
  if (region === "upper") return presentation.upperRegionColour;
  if (region === "lower") return presentation.lowerRegionColour;
  return presentation.middleRegionColour;
};

const canonicalLatticeIdentityPayload = JSON.stringify({
  dimensions: CAMERA_MOVEMENT_LATTICE.dimensions,
  vertices: CAMERA_MOVEMENT_LATTICE.vertices.map(({ id, positionWorld }) => [
    id,
    positionWorld.x,
    positionWorld.y,
    positionWorld.z,
  ]),
  edgeIds: CAMERA_MOVEMENT_LATTICE.edges.map(({ id }) => id),
});

const hashIdentityPayload = (payload: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

/**
 * Deterministic compact identity for the exact canonical millimetre geometry
 * consumed by both the interactive R3F subject and Ground Glass RTT.
 */
export const CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID =
  `camera-movement-lattice-${hashIdentityPayload(canonicalLatticeIdentityPayload)}`;

const createStyleBatches = (
  targetRegion: CameraMovementTargetRegion,
): LatticeStyleBatch[] => {
  const batches = new Map<string, LatticeStyleBatch>();

  CAMERA_MOVEMENT_LATTICE.edges.forEach((edge) => {
    const selected = edge.targetRegion === targetRegion;
    const colour = selected
      ? colourForRegion(targetRegion)
      : presentation.inactiveColour;
    const opacity =
      edge.role === "internal" ? presentation.internalEdgeOpacity : 1;
    const weight = edgeWeightForRole(edge.role);
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

/**
 * Create one owned Three.js representation of the canonical lattice.
 *
 * LineSegments2 gives the calibrated hierarchy meaningful pixel weights in
 * both the interactive renderer and RTT. Each unique canonical edge appears
 * in exactly one style batch; no renderer reconstructs cells or cube faces.
 */
export function createCameraMovementsGroup(
  targetRegion: CameraMovementTargetRegion = presentation.defaultTargetRegion,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "camera-movements-lattice-subject";
  group.userData.resourceOwnership = "owned";
  group.userData.targetRegion = targetRegion;
  group.userData.canonicalGeometryId = CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID;
  group.userData.canonicalEdgeCount = CAMERA_MOVEMENT_LATTICE.edges.length;
  group.userData.canonicalEdgeIds = CAMERA_MOVEMENT_LATTICE.edges.map(({ id }) => id);
  group.userData.canonicalUnits = CAMERA_MOVEMENT_LATTICE.units;

  createStyleBatches(targetRegion).forEach((batch) => {
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

  return group;
}

export type CameraMovementsSubjectProps = {
  scene?: SceneDefinition;
  onGroupChange?: (group: THREE.Group | null) => void;
};

export const CameraMovementsSubject: React.FC<CameraMovementsSubjectProps> = ({
  onGroupChange,
}) => {
  const targetRegion = useAppStore((state) => state.scene.targetRegion);
  const group = useMemo(
    () => createCameraMovementsGroup(targetRegion),
    [targetRegion],
  );

  useEffect(() => {
    group.userData.interactiveMountGeneration =
      nextInteractiveLatticeGeneration();
    const runtimeInfo = readInteractiveLatticeRuntimeInfo(group);
    useAppStore.getState().setInteractiveLatticeRuntimeInfo(runtimeInfo);
    onGroupChange?.(group);
    return () => {
      disposeCameraMovementsGroup(group);
      const currentRuntime =
        useAppStore.getState().interactiveLatticeRuntimeInfo;
      if (currentRuntime?.generation === runtimeInfo.generation) {
        useAppStore.getState().setInteractiveLatticeRuntimeInfo(null);
      }
      onGroupChange?.(null);
    };
  }, [group, onGroupChange]);

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
}
