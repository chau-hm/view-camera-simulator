import * as THREE from "three";
import type { CameraMovementsGroupOptions } from "./assets/CameraMovementLatticeAsset";
import {
  CAMERA_MOVEMENT_LATTICE_ASSET_KEY,
  resolveSceneAsset,
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
  const registration = resolveSceneAsset(
    options.presentation.object.id,
    registry,
  );
  const group = registration.create(options);
  group.userData.assetImplementationId = registration.implementationId;
  return group;
};

/** Dispose through the registration paired with this scene-specific asset slot. */
export const disposeCameraMovementLatticeAsset = (
  group: THREE.Group,
  registry: SceneAssetRegistry = sceneAssetRegistry,
): void => {
  const registration = resolveSceneAsset(
    CAMERA_MOVEMENT_LATTICE_ASSET_KEY,
    registry,
  );
  if (group.userData.assetImplementationId !== registration.implementationId) {
    throw new Error(
      'Cannot dispose scene asset "' +
        registration.assetKey +
        '" with implementation "' +
        registration.implementationId +
        '"',
    );
  }
  registration.dispose(group);
};
