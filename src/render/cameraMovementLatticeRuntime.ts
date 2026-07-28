import type * as THREE from "three";
import type { CameraMovementTargetRegion } from "../scenes/cameraMovementSceneCalibration";

export type InteractiveLatticeRuntimeInfo = Readonly<{
  mounted: true;
  geometryId: string;
  edgeCount: number;
  targetRegion: CameraMovementTargetRegion;
  generation: number;
}>;

let interactiveLatticeGeneration = 0;

export const nextInteractiveLatticeGeneration = (): number => {
  interactiveLatticeGeneration += 1;
  return interactiveLatticeGeneration;
};

const isTargetRegion = (value: unknown): value is CameraMovementTargetRegion =>
  value === "upper" || value === "middle" || value === "lower";

/**
 * Read diagnostics from the actual mounted group. Missing or malformed
 * userData is a mount failure, not a registry fallback.
 */
export const readInteractiveLatticeRuntimeInfo = (
  group: THREE.Group,
): InteractiveLatticeRuntimeInfo => {
  const geometryId = group.userData.canonicalGeometryId;
  const edgeCount = group.userData.canonicalEdgeCount;
  const targetRegion = group.userData.targetRegion;
  const generation = group.userData.interactiveMountGeneration;

  if (
    typeof geometryId !== "string" ||
    geometryId.length === 0 ||
    !Number.isInteger(edgeCount) ||
    edgeCount <= 0 ||
    !isTargetRegion(targetRegion) ||
    !Number.isInteger(generation) ||
    generation <= 0
  ) {
    throw new Error("Mounted camera-movement lattice runtime metadata is invalid");
  }

  return {
    mounted: true,
    geometryId,
    edgeCount,
    targetRegion,
    generation,
  };
};
