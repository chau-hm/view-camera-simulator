import type { Group } from "three";
import * as cameraMovementLatticeAsset from "./assets/CameraMovementLatticeAsset";
import type { CameraMovementsGroupOptions } from "./assets/CameraMovementLatticeAsset";

/** Scene-specific factory type for the replaceable camera-movement lattice asset. */
export type CameraMovementLatticeAssetFactory = (
  options: CameraMovementsGroupOptions,
) => Group;

/**
 * Shared construction seam for the interactive and RTT consumers.
 * Application callers use the current Three.js asset by default; the optional
 * factory is an explicit dependency only for focused substitution tests.
 */
export const createCameraMovementLatticeAsset = (
  options: CameraMovementsGroupOptions,
  assetFactory: CameraMovementLatticeAssetFactory =
    cameraMovementLatticeAsset.createCameraMovementsGroup,
): Group => assetFactory(options);
