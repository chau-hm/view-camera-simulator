import * as THREE from "three";
import type { CameraMovementLatticePresentation } from "../../scenes/presentation/understandingCameraMovements";
import type { CameraMovementsGroupOptions } from "./CameraMovementLatticeAsset";
import * as cameraMovementLatticeAsset from "./CameraMovementLatticeAsset";

/** Stable asset slot for the semantic camera-movement lattice object. */
export type SceneAssetKey =
  CameraMovementLatticePresentation["object"]["id"];

export const CAMERA_MOVEMENT_LATTICE_ASSET_KEY: SceneAssetKey =
  "camera-movement-lattice";

/** Identity of the current concrete Three.js implementation registered for the slot. */
export const CAMERA_MOVEMENT_LATTICE_IMPLEMENTATION_ID =
  "threejs-camera-movement-lattice";

export type CameraMovementLatticeAssetFactory = (
  options: CameraMovementsGroupOptions,
) => THREE.Group;

export type SceneAssetRegistration = Readonly<{
  assetKey: SceneAssetKey;
  implementationId: string;
  create: CameraMovementLatticeAssetFactory;
  dispose: (asset: THREE.Group) => void;
}>;

/** This SA2 registry intentionally contains only the migrated lattice asset. */
export type SceneAssetRegistry = Readonly<
  Partial<Record<SceneAssetKey, SceneAssetRegistration>>
>;

const cameraMovementLatticeRegistration: SceneAssetRegistration =
  Object.freeze({
    assetKey: CAMERA_MOVEMENT_LATTICE_ASSET_KEY,
    implementationId: CAMERA_MOVEMENT_LATTICE_IMPLEMENTATION_ID,
    create: (options) =>
      cameraMovementLatticeAsset.createCameraMovementsGroup(options),
    dispose: (asset) =>
      cameraMovementLatticeAsset.disposeCameraMovementsGroup(asset),
  });

/** Immutable production mapping from the existing subject identity to its implementation. */
export const sceneAssetRegistry: SceneAssetRegistry = Object.freeze({
  [CAMERA_MOVEMENT_LATTICE_ASSET_KEY]: cameraMovementLatticeRegistration,
});

/**
 * Resolve one known asset slot. The string boundary allows runtime callers to
 * fail explicitly for an unknown identity; the returned registration retains
 * the camera-movement presentation/options type.
 */
export const resolveSceneAsset = (
  assetKey: string,
  registry: SceneAssetRegistry = sceneAssetRegistry,
): SceneAssetRegistration => {
  if (assetKey !== CAMERA_MOVEMENT_LATTICE_ASSET_KEY) {
    throw new Error('Unknown scene asset "' + assetKey + '"');
  }

  const registration = registry[CAMERA_MOVEMENT_LATTICE_ASSET_KEY];
  if (!registration) {
    throw new Error(
      'Scene asset "' + assetKey + '" is not registered',
    );
  }
  return registration;
};
