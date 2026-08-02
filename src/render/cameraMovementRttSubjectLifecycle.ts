import * as THREE from "three";
import type { CameraMovementTargetRegion } from "../scenes/cameraMovementSceneCalibration";
import {
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
} from "./sceneSubjectRegistry";
import type { CameraMovementLatticeRenderModel } from "./cameraMovementLatticeRenderModel";
import {
  publishAttachedRttLatticeRuntime,
  type RttLatticeRuntimeInfo,
} from "./cameraMovementLatticeRuntime";
import { applyCameraMovementsGroupStyle } from "./CameraMovementsSubjectFactory";

const CAMERA_MOVEMENT_SCENE_ID = "understanding-camera-movements";

export type MountedCameraMovementRttSubject = Readonly<{
  scene: THREE.Scene;
  group: THREE.Group;
  runtimeInfo: RttLatticeRuntimeInfo;
}>;

/**
 * Attach a fresh, independently owned RTT subject. Render targets, cameras,
 * lights, and post-processing resources are intentionally outside this owner.
 */
export const mountCameraMovementRttSubject = (
  scene: THREE.Scene,
  renderModel: CameraMovementLatticeRenderModel,
  targetRegion: CameraMovementTargetRegion,
): MountedCameraMovementRttSubject => {
  const group = createRegisteredRttSubject(CAMERA_MOVEMENT_SCENE_ID, {
    targetRegion,
    cameraMovementRenderModel: renderModel,
  });
  if (!group) {
    throw new Error("Camera-movement RTT subject registration is missing");
  }
  scene.add(group);
  const runtimeInfo = publishAttachedRttLatticeRuntime(group, scene);
  if (!runtimeInfo) {
    scene.remove(group);
    disposeRegisteredRttSubject(CAMERA_MOVEMENT_SCENE_ID, group);
    throw new Error("Camera-movement RTT subject did not attach to its scene");
  }
  return { scene, group, runtimeInfo };
};

/** Remove and dispose only the subject group's explicitly owned resources. */
export const unmountCameraMovementRttSubject = (
  mounted: MountedCameraMovementRttSubject,
): void => {
  mounted.scene.remove(mounted.group);
  disposeRegisteredRttSubject(CAMERA_MOVEMENT_SCENE_ID, mounted.group);
};

/** Update only target presentation on the mounted subject. */
export const updateCameraMovementRttSubjectTarget = (
  mounted: MountedCameraMovementRttSubject,
  renderModel: CameraMovementLatticeRenderModel,
  targetRegion: CameraMovementTargetRegion,
): void => {
  applyCameraMovementsGroupStyle(
    mounted.group,
    renderModel.presentation,
    targetRegion,
  );
};
