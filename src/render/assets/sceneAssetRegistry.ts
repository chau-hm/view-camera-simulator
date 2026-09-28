import * as THREE from "three";
import type { CameraMovementsGroupOptions } from "./CameraMovementLatticeAsset";
import * as cameraMovementLatticeAsset from "./CameraMovementLatticeAsset";
import type { ArchitectureRiseAssetRequest } from "../ArchitectureRiseSubjectFactory";
import * as architectureRiseAsset from "../ArchitectureRiseSubjectFactory";
import type { ObliqueArchitectureAssetRequest } from "../ObliqueArchitectureSubjectFactory";
import * as obliqueArchitectureAsset from "../ObliqueArchitectureSubjectFactory";
import type { TableTiltAssetRequest } from "../TableTiltSubjectFactory";
import * as tableTiltAsset from "../TableTiltSubjectFactory";
import type { ShelfSwingAssetRequest } from "../ShelfSwingSubjectFactory";
import * as shelfSwingAsset from "../ShelfSwingSubjectFactory";

/** Stable asset slot owned by the scene asset registry layer. */
export const CAMERA_MOVEMENT_LATTICE_ASSET_KEY =
  "camera-movement-lattice" as const;
export const ARCHITECTURE_RISE_ASSET_KEY = "architecture-rise-subject" as const;
export const OBLIQUE_ARCHITECTURE_ASSET_KEY = "oblique-architecture-subject" as const;
export const TABLE_TILT_ASSET_KEY = "table-tilt-subject" as const;
export const SHELF_SWING_ASSET_KEY = "shelf-swing-subject" as const;

/** Registry-owned set of visual asset slots; scene IDs remain separate. */
export type SceneAssetKey =
  | typeof CAMERA_MOVEMENT_LATTICE_ASSET_KEY
  | typeof ARCHITECTURE_RISE_ASSET_KEY
  | typeof OBLIQUE_ARCHITECTURE_ASSET_KEY
  | typeof TABLE_TILT_ASSET_KEY
  | typeof SHELF_SWING_ASSET_KEY;

export type CameraMovementLatticeAssetFactory = (
  options: CameraMovementsGroupOptions,
) => THREE.Group;

export type SceneAssetRequestMap = {
  [CAMERA_MOVEMENT_LATTICE_ASSET_KEY]: CameraMovementsGroupOptions;
  [ARCHITECTURE_RISE_ASSET_KEY]: ArchitectureRiseAssetRequest;
  [OBLIQUE_ARCHITECTURE_ASSET_KEY]: ObliqueArchitectureAssetRequest;
  [TABLE_TILT_ASSET_KEY]: TableTiltAssetRequest;
  [SHELF_SWING_ASSET_KEY]: ShelfSwingAssetRequest;
};

export type SceneAssetRegistration<K extends SceneAssetKey> = Readonly<{
  assetKey: K;
  implementationId: string;
  create: (request: SceneAssetRequestMap[K]) => THREE.Group;
  dispose: (asset: THREE.Group) => void;
}>;

export type SceneAssetRegistry = Readonly<{
  [K in SceneAssetKey]?: SceneAssetRegistration<K>;
}>;

type CompleteSceneAssetRegistry = Readonly<{
  [K in SceneAssetKey]: SceneAssetRegistration<K>;
}>;

export const CAMERA_MOVEMENT_LATTICE_IMPLEMENTATION_ID =
  "threejs-camera-movement-lattice";
export const ARCHITECTURE_RISE_IMPLEMENTATION_ID = "threejs-architecture-rise";
export const OBLIQUE_ARCHITECTURE_IMPLEMENTATION_ID = "threejs-oblique-architecture";
export const TABLE_TILT_IMPLEMENTATION_ID = "threejs-table-tilt";
export const SHELF_SWING_IMPLEMENTATION_ID = "threejs-shelf-swing";

const cameraMovementLatticeRegistration: SceneAssetRegistration<typeof CAMERA_MOVEMENT_LATTICE_ASSET_KEY> =
  Object.freeze({
    assetKey: CAMERA_MOVEMENT_LATTICE_ASSET_KEY,
    implementationId: CAMERA_MOVEMENT_LATTICE_IMPLEMENTATION_ID,
    create: (options) =>
      cameraMovementLatticeAsset.createCameraMovementsGroup(options),
    dispose: (asset) =>
      cameraMovementLatticeAsset.disposeCameraMovementsGroup(asset),
  });

const architectureRiseRegistration: SceneAssetRegistration<typeof ARCHITECTURE_RISE_ASSET_KEY> =
  Object.freeze({
    assetKey: ARCHITECTURE_RISE_ASSET_KEY,
    implementationId: ARCHITECTURE_RISE_IMPLEMENTATION_ID,
    create: (request) => architectureRiseAsset.createArchitectureRiseGroup(request),
    dispose: (asset) => architectureRiseAsset.disposeArchitectureRiseGroup(asset),
  });

const obliqueArchitectureRegistration: SceneAssetRegistration<typeof OBLIQUE_ARCHITECTURE_ASSET_KEY> =
  Object.freeze({
    assetKey: OBLIQUE_ARCHITECTURE_ASSET_KEY,
    implementationId: OBLIQUE_ARCHITECTURE_IMPLEMENTATION_ID,
    create: (request) => obliqueArchitectureAsset.createObliqueArchitectureGroup(request),
    dispose: (asset) => obliqueArchitectureAsset.disposeObliqueArchitectureGroup(asset),
  });

const tableTiltRegistration: SceneAssetRegistration<typeof TABLE_TILT_ASSET_KEY> =
  Object.freeze({
    assetKey: TABLE_TILT_ASSET_KEY,
    implementationId: TABLE_TILT_IMPLEMENTATION_ID,
    create: (request) => tableTiltAsset.createTableTiltGroup(request),
    dispose: (asset) => tableTiltAsset.disposeTableTiltGroup(asset),
  });

const shelfSwingRegistration: SceneAssetRegistration<typeof SHELF_SWING_ASSET_KEY> =
  Object.freeze({
    assetKey: SHELF_SWING_ASSET_KEY,
    implementationId: SHELF_SWING_IMPLEMENTATION_ID,
    create: (request) => shelfSwingAsset.createShelfSwingGroup(request),
    dispose: (asset) => shelfSwingAsset.disposeShelfSwingGroup(asset),
  });

/** Immutable production mapping from each registered scene asset slot. */
export const sceneAssetRegistry: CompleteSceneAssetRegistry = Object.freeze({
  [CAMERA_MOVEMENT_LATTICE_ASSET_KEY]: cameraMovementLatticeRegistration,
  [ARCHITECTURE_RISE_ASSET_KEY]: architectureRiseRegistration,
  [OBLIQUE_ARCHITECTURE_ASSET_KEY]: obliqueArchitectureRegistration,
  [TABLE_TILT_ASSET_KEY]: tableTiltRegistration,
  [SHELF_SWING_ASSET_KEY]: shelfSwingRegistration,
});

/**
 * Resolve one known asset slot. The string boundary allows runtime callers to
 * fail explicitly for an unknown identity; typed callers retain their
 * key-specific presentation/options relationship.
 */
export function resolveSceneAsset<K extends SceneAssetKey>(
  assetKey: K,
  registry?: SceneAssetRegistry,
): SceneAssetRegistration<K>;
export function resolveSceneAsset(
  assetKey: string,
  registry?: SceneAssetRegistry,
): SceneAssetRegistration<SceneAssetKey>;
export function resolveSceneAsset(
  assetKey: string,
  registry: SceneAssetRegistry = sceneAssetRegistry,
): SceneAssetRegistration<SceneAssetKey> {
  if (
    assetKey !== CAMERA_MOVEMENT_LATTICE_ASSET_KEY &&
    assetKey !== ARCHITECTURE_RISE_ASSET_KEY &&
    assetKey !== OBLIQUE_ARCHITECTURE_ASSET_KEY &&
    assetKey !== TABLE_TILT_ASSET_KEY &&
    assetKey !== SHELF_SWING_ASSET_KEY
  ) {
    throw new Error('Unknown scene asset "' + assetKey + '"');
  }

  const registration = registry[assetKey as SceneAssetKey];
  if (!registration) {
    throw new Error(
      'Scene asset "' + assetKey + '" is not registered',
    );
  }
  return registration as SceneAssetRegistration<SceneAssetKey>;
}

/** Resolve and create a typed registered implementation for one scene asset slot. */
export const createRegisteredSceneAsset = <K extends SceneAssetKey>(
  assetKey: K,
  request: SceneAssetRequestMap[K],
  registry: SceneAssetRegistry = sceneAssetRegistry,
): THREE.Group => {
  const registration = resolveSceneAsset(assetKey, registry);
  const group = registration.create(request);
  // Diagnostic metadata only; slot plus registry remain lifecycle authority.
  group.userData.assetImplementationId = registration.implementationId;
  return group;
};

/** Dispose through the implementation registered for the explicit asset slot. */
export const disposeRegisteredSceneAsset = <K extends SceneAssetKey>(
  assetKey: K,
  group: THREE.Group,
  registry: SceneAssetRegistry = sceneAssetRegistry,
): void => {
  resolveSceneAsset(assetKey, registry).dispose(group);
};
