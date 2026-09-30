import * as THREE from "three";
import type { CameraMovementsGroupOptions } from "./assets/CameraMovementLatticeAsset";
import {
  CAMERA_MOVEMENT_LATTICE_ASSET_KEY,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
  sceneAssetRegistry,
  type SceneAssetRegistry,
} from "./assets/sceneAssetRegistry";

export type { CameraMovementLatticeAssetFactory } from "./assets/sceneAssetRegistry";

/**
 * Scene-specific adapter shared by interactive and RTT consumers. Tests may
 * supply an isolated registry; application callers use the immutable default.
 */
export const createCameraMovementLatticeAsset = (
  options: CameraMovementsGroupOptions,
  registry: SceneAssetRegistry = sceneAssetRegistry,
): THREE.Group => {
  return createRegisteredSceneAsset(
    options.presentation.object.id,
    options,
    registry,
  );
};

/** Dispose through the registration paired with this scene-specific asset slot. */
export const disposeCameraMovementLatticeAsset = (
  group: THREE.Group,
  registry: SceneAssetRegistry = sceneAssetRegistry,
): void => {
  disposeRegisteredSceneAsset(
    CAMERA_MOVEMENT_LATTICE_ASSET_KEY,
    group,
    registry,
  );
};
