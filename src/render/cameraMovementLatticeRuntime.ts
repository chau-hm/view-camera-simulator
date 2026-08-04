import type * as THREE from "three";
import type { CameraMovementPresentationRegion } from "../scenes/cameraMovementSceneCalibration";

export type InteractiveLatticeRuntimeInfo = Readonly<{
  mounted: true;
  geometryId: string;
  geometryKey: string;
  presentationKey: string;
  resourceKey: string;
  edgeCount: number;
  presentationRegion: CameraMovementPresentationRegion;
  generation: number;
}>;

let interactiveLatticeGeneration = 0;
let rttLatticeGeneration = 0;

export const nextInteractiveLatticeGeneration = (): number => {
  interactiveLatticeGeneration += 1;
  return interactiveLatticeGeneration;
};

export const nextRttLatticeGeneration = (): number => {
  rttLatticeGeneration += 1;
  return rttLatticeGeneration;
};

const isPresentationRegion = (
  value: unknown,
): value is CameraMovementPresentationRegion =>
  value === "whole" || value === "upper" || value === "middle" || value === "lower";

/**
 * Read diagnostics from the actual mounted group. Missing or malformed
 * userData is a mount failure, not a registry fallback.
 */
export const readInteractiveLatticeRuntimeInfo = (
  group: THREE.Group,
): InteractiveLatticeRuntimeInfo => {
  const geometryId = group.userData.canonicalGeometryId;
  const geometryKey = group.userData.canonicalGeometryKey;
  const presentationKey = group.userData.presentationKey;
  const resourceKey = group.userData.resourceKey;
  const edgeCount = group.userData.canonicalEdgeCount;
  const presentationRegion = group.userData.presentationRegion;
  const generation = group.userData.interactiveMountGeneration;

  if (
    typeof geometryId !== "string" ||
    geometryId.length === 0 ||
    typeof geometryKey !== "string" ||
    geometryKey.length === 0 ||
    typeof presentationKey !== "string" ||
    presentationKey.length === 0 ||
    typeof resourceKey !== "string" ||
    resourceKey.length === 0 ||
    !Number.isInteger(edgeCount) ||
    edgeCount <= 0 ||
    !isPresentationRegion(presentationRegion) ||
    !Number.isInteger(generation) ||
    generation <= 0
  ) {
    throw new Error("Mounted camera-movement lattice runtime metadata is invalid");
  }

  return {
    mounted: true,
    geometryId,
    geometryKey,
    presentationKey,
    resourceKey,
    edgeCount,
    presentationRegion,
    generation,
  };
};

export type RttLatticeRuntimeInfo = Readonly<{
  mounted: true;
  geometryId: string;
  geometryKey: string;
  presentationKey: string;
  resourceKey: string;
  edgeCount: number;
  presentationRegion: CameraMovementPresentationRegion;
  generation: number;
}>;

/** Read RTT diagnostics only after the owned group has joined its scene. */
export const publishAttachedRttLatticeRuntime = (
  group: THREE.Group,
  scene: THREE.Scene,
): RttLatticeRuntimeInfo | null => {
  let current: THREE.Object3D | null = group;
  while (current && current !== scene) current = current.parent;
  if (current !== scene) return null;

  group.userData.rttMountGeneration = nextRttLatticeGeneration();
  const geometryId = group.userData.canonicalGeometryId;
  const geometryKey = group.userData.canonicalGeometryKey;
  const presentationKey = group.userData.presentationKey;
  const resourceKey = group.userData.resourceKey;
  const edgeCount = group.userData.canonicalEdgeCount;
  const presentationRegion = group.userData.presentationRegion;
  const generation = group.userData.rttMountGeneration;
  if (
    typeof geometryId !== "string" ||
    geometryId.length === 0 ||
    typeof geometryKey !== "string" ||
    geometryKey.length === 0 ||
    typeof presentationKey !== "string" ||
    presentationKey.length === 0 ||
    typeof resourceKey !== "string" ||
    resourceKey.length === 0 ||
    !Number.isInteger(edgeCount) ||
    edgeCount <= 0 ||
    !isPresentationRegion(presentationRegion) ||
    !Number.isInteger(generation) ||
    generation <= 0
  ) {
    throw new Error("Mounted RTT camera-movement lattice runtime metadata is invalid");
  }
  return {
    mounted: true,
    geometryId,
    geometryKey,
    presentationKey,
    resourceKey,
    edgeCount,
    presentationRegion,
    generation,
  };
};
