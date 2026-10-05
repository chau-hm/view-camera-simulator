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
import type { ArchitectureForegroundAssetRequest } from "../ArchitectureForegroundSubjectFactory";
import * as architectureForegroundAsset from "../ArchitectureForegroundSubjectFactory";
import type { InteriorCornerAssetRequest } from "../InteriorCornerSubjectFactory";
import * as interiorCornerAsset from "../InteriorCornerSubjectFactory";
import type { ObliqueTabletopAssetRequest } from "../ObliqueTabletopSubjectFactory";
import * as obliqueTabletopAsset from "../ObliqueTabletopSubjectFactory";
import type { FocusFundamentalsAssetRequest } from "../FocusFundamentalsSubjectFactory";
import * as focusFundamentalsAsset from "../FocusFundamentalsSubjectFactory";
import type { ViewCameraAnatomyAssetRequest } from "../LessonZeroGroundGlassSubjectFactory";
import * as viewCameraAnatomyAsset from "../LessonZeroGroundGlassSubjectFactory";
import type { MirrorShiftAssetRequest } from "../MirrorShiftSubjectFactory";
import * as mirrorShiftAsset from "../MirrorShiftSubjectFactory";
import type { MacroBellowsExtensionAssetRequest } from "../MacroSpecimenSubjectFactory";
import * as macroBellowsExtensionAsset from "../MacroSpecimenSubjectFactory";
import type { MacroDepthOfFieldAssetRequest } from "../MacroDepthOfFieldSubjectFactory";
import * as macroDepthOfFieldAsset from "../MacroDepthOfFieldSubjectFactory";
import type { MacroObliquePlaneAssetRequest } from "../MacroObliquePlaneSubjectFactory";
import * as macroObliquePlaneAsset from "../MacroObliquePlaneSubjectFactory";
import type { MacroCompoundMovementsAssetRequest } from "../MacroCompoundMovementsSubjectFactory";
import * as macroCompoundMovementsAsset from "../MacroCompoundMovementsSubjectFactory";
import type { FringeClubAssetRequest } from "./FringeClubRuntimeAsset";
import * as fringeClubRuntimeAsset from "./FringeClubRuntimeAsset";

/** Stable asset slot owned by the scene asset registry layer. */
export const CAMERA_MOVEMENT_LATTICE_ASSET_KEY =
  "camera-movement-lattice" as const;
export const ARCHITECTURE_RISE_ASSET_KEY = "architecture-rise-subject" as const;
export const OBLIQUE_ARCHITECTURE_ASSET_KEY = "oblique-architecture-subject" as const;
export const TABLE_TILT_ASSET_KEY = "table-tilt-subject" as const;
export const SHELF_SWING_ASSET_KEY = "shelf-swing-subject" as const;
export const ARCHITECTURE_FOREGROUND_ASSET_KEY =
  "architecture-foreground-subject" as const;
export const INTERIOR_CORNER_ASSET_KEY = "interior-corner-subject" as const;
export const OBLIQUE_TABLETOP_ASSET_KEY = "oblique-tabletop-subject" as const;
export const FOCUS_FUNDAMENTALS_ASSET_KEY = "focus-fundamentals-subject" as const;
export const VIEW_CAMERA_ANATOMY_ASSET_KEY = "view-camera-anatomy-subject" as const;
export const MIRROR_SHIFT_ASSET_KEY = "mirror-shift-subject" as const;
export const MACRO_BELLOWS_EXTENSION_ASSET_KEY = "macro-bellows-extension-subject" as const;
export const MACRO_DEPTH_OF_FIELD_ASSET_KEY = "macro-depth-of-field-subject" as const;
export const MACRO_OBLIQUE_PLANE_ASSET_KEY = "macro-oblique-plane-subject" as const;
export const MACRO_COMPOUND_MOVEMENTS_ASSET_KEY = "macro-compound-movements-subject" as const;
/** Dormant development fixture slot; this is not a public scene identity. */
export const FRINGE_CLUB_RUNTIME_ASSET_KEY = "fringe-club-runtime-subject" as const;

/** Registry-owned set of visual asset slots; scene IDs remain separate. */
export type SceneAssetKey =
  | typeof CAMERA_MOVEMENT_LATTICE_ASSET_KEY
  | typeof ARCHITECTURE_RISE_ASSET_KEY
  | typeof OBLIQUE_ARCHITECTURE_ASSET_KEY
  | typeof TABLE_TILT_ASSET_KEY
  | typeof SHELF_SWING_ASSET_KEY
  | typeof ARCHITECTURE_FOREGROUND_ASSET_KEY
  | typeof INTERIOR_CORNER_ASSET_KEY
  | typeof OBLIQUE_TABLETOP_ASSET_KEY
  | typeof FOCUS_FUNDAMENTALS_ASSET_KEY
  | typeof VIEW_CAMERA_ANATOMY_ASSET_KEY
  | typeof MIRROR_SHIFT_ASSET_KEY
  | typeof MACRO_BELLOWS_EXTENSION_ASSET_KEY
  | typeof MACRO_DEPTH_OF_FIELD_ASSET_KEY
  | typeof MACRO_OBLIQUE_PLANE_ASSET_KEY
  | typeof MACRO_COMPOUND_MOVEMENTS_ASSET_KEY
  | typeof FRINGE_CLUB_RUNTIME_ASSET_KEY;

export type CameraMovementLatticeAssetFactory = (
  options: CameraMovementsGroupOptions,
) => THREE.Group;

export type SceneAssetRequestMap = {
  [CAMERA_MOVEMENT_LATTICE_ASSET_KEY]: CameraMovementsGroupOptions;
  [ARCHITECTURE_RISE_ASSET_KEY]: ArchitectureRiseAssetRequest;
  [OBLIQUE_ARCHITECTURE_ASSET_KEY]: ObliqueArchitectureAssetRequest;
  [TABLE_TILT_ASSET_KEY]: TableTiltAssetRequest;
  [SHELF_SWING_ASSET_KEY]: ShelfSwingAssetRequest;
  [ARCHITECTURE_FOREGROUND_ASSET_KEY]: ArchitectureForegroundAssetRequest;
  [INTERIOR_CORNER_ASSET_KEY]: InteriorCornerAssetRequest;
  [OBLIQUE_TABLETOP_ASSET_KEY]: ObliqueTabletopAssetRequest;
  [FOCUS_FUNDAMENTALS_ASSET_KEY]: FocusFundamentalsAssetRequest;
  [VIEW_CAMERA_ANATOMY_ASSET_KEY]: ViewCameraAnatomyAssetRequest;
  [MIRROR_SHIFT_ASSET_KEY]: MirrorShiftAssetRequest;
  [MACRO_BELLOWS_EXTENSION_ASSET_KEY]: MacroBellowsExtensionAssetRequest;
  [MACRO_DEPTH_OF_FIELD_ASSET_KEY]: MacroDepthOfFieldAssetRequest;
  [MACRO_OBLIQUE_PLANE_ASSET_KEY]: MacroObliquePlaneAssetRequest;
  [MACRO_COMPOUND_MOVEMENTS_ASSET_KEY]: MacroCompoundMovementsAssetRequest;
  [FRINGE_CLUB_RUNTIME_ASSET_KEY]: FringeClubAssetRequest;
};

export type SceneAssetResourceLifetimeByKey = {
  [CAMERA_MOVEMENT_LATTICE_ASSET_KEY]: "instance-owned";
  [ARCHITECTURE_RISE_ASSET_KEY]: "instance-owned";
  [OBLIQUE_ARCHITECTURE_ASSET_KEY]: "instance-owned";
  [TABLE_TILT_ASSET_KEY]: "instance-owned";
  [SHELF_SWING_ASSET_KEY]: "instance-owned";
  [ARCHITECTURE_FOREGROUND_ASSET_KEY]: "instance-owned";
  [INTERIOR_CORNER_ASSET_KEY]: "instance-owned";
  [OBLIQUE_TABLETOP_ASSET_KEY]: "instance-owned";
  [FOCUS_FUNDAMENTALS_ASSET_KEY]: "module-shared";
  [VIEW_CAMERA_ANATOMY_ASSET_KEY]: "module-shared";
  [MIRROR_SHIFT_ASSET_KEY]: "instance-owned";
  [MACRO_BELLOWS_EXTENSION_ASSET_KEY]: "instance-owned";
  [MACRO_DEPTH_OF_FIELD_ASSET_KEY]: "instance-owned";
  [MACRO_OBLIQUE_PLANE_ASSET_KEY]: "instance-owned";
  [MACRO_COMPOUND_MOVEMENTS_ASSET_KEY]: "instance-owned";
  [FRINGE_CLUB_RUNTIME_ASSET_KEY]: "instance-owned";
};

export type SceneAssetKeyWithLifetime<
  Lifetime extends SceneAssetResourceLifetimeByKey[SceneAssetKey],
> = {
  [K in SceneAssetKey]: SceneAssetResourceLifetimeByKey[K] extends Lifetime
    ? K
    : never;
}[SceneAssetKey];

export type InstanceOwnedSceneAssetKey = SceneAssetKeyWithLifetime<"instance-owned">;
export type ModuleSharedSceneAssetKey = SceneAssetKeyWithLifetime<"module-shared">;

type SceneAssetRegistrationBase<K extends SceneAssetKey> = Readonly<{
  assetKey: K;
  implementationId: string;
  create: (request: SceneAssetRequestMap[K]) => THREE.Group;
}>;

/**
 * Instance-owned slots require their paired disposer. Module-shared slots
 * explicitly declare their lifetime and cannot install a per-instance disposer.
 */
type SceneAssetLifecycleFields<K extends SceneAssetKey> = {
  [AssetKey in K]: SceneAssetResourceLifetimeByKey[AssetKey] extends "module-shared"
    ? Readonly<{
        renderResourceLifetime: "module-shared";
        dispose?: never;
      }>
    : Readonly<{
        renderResourceLifetime?: "instance-owned";
        dispose: (asset: THREE.Group) => void;
      }>;
}[K];

export type SceneAssetRegistration<K extends SceneAssetKey> =
  SceneAssetRegistrationBase<K> & SceneAssetLifecycleFields<K>;

export type AnySceneAssetRegistration = {
  [K in SceneAssetKey]: SceneAssetRegistration<K>;
}[SceneAssetKey];

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
export const ARCHITECTURE_FOREGROUND_IMPLEMENTATION_ID =
  "threejs-architecture-foreground";
export const INTERIOR_CORNER_IMPLEMENTATION_ID = "threejs-interior-corner";
export const OBLIQUE_TABLETOP_IMPLEMENTATION_ID = "threejs-oblique-tabletop";
export const FOCUS_FUNDAMENTALS_IMPLEMENTATION_ID = "threejs-focus-fundamentals";
export const VIEW_CAMERA_ANATOMY_IMPLEMENTATION_ID = "threejs-view-camera-anatomy";
export const MIRROR_SHIFT_IMPLEMENTATION_ID = "threejs-mirror-shift";
export const MACRO_BELLOWS_EXTENSION_IMPLEMENTATION_ID = "threejs-macro-bellows-extension";
export const MACRO_DEPTH_OF_FIELD_IMPLEMENTATION_ID = "threejs-macro-depth-of-field";
export const MACRO_OBLIQUE_PLANE_IMPLEMENTATION_ID = "threejs-macro-oblique-plane";
export const MACRO_COMPOUND_MOVEMENTS_IMPLEMENTATION_ID = "threejs-macro-compound-movements";
export const FRINGE_CLUB_RUNTIME_IMPLEMENTATION_ID = "threejs-fringe-club-runtime";

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

const architectureForegroundRegistration: SceneAssetRegistration<typeof ARCHITECTURE_FOREGROUND_ASSET_KEY> =
  Object.freeze({
    assetKey: ARCHITECTURE_FOREGROUND_ASSET_KEY,
    implementationId: ARCHITECTURE_FOREGROUND_IMPLEMENTATION_ID,
    create: (request) =>
      architectureForegroundAsset.createArchitectureForegroundGroup(request),
    dispose: (asset) =>
      architectureForegroundAsset.disposeArchitectureForegroundGroup(asset),
  });

const interiorCornerRegistration: SceneAssetRegistration<typeof INTERIOR_CORNER_ASSET_KEY> =
  Object.freeze({
    assetKey: INTERIOR_CORNER_ASSET_KEY,
    implementationId: INTERIOR_CORNER_IMPLEMENTATION_ID,
    create: (request) => interiorCornerAsset.createInteriorCornerGroup(request),
    dispose: (asset) => interiorCornerAsset.disposeInteriorCornerGroup(asset),
  });

const obliqueTabletopRegistration: SceneAssetRegistration<typeof OBLIQUE_TABLETOP_ASSET_KEY> =
  Object.freeze({
    assetKey: OBLIQUE_TABLETOP_ASSET_KEY,
    implementationId: OBLIQUE_TABLETOP_IMPLEMENTATION_ID,
    create: (request) => obliqueTabletopAsset.createObliqueTabletopGroup(request),
    dispose: (asset) => obliqueTabletopAsset.disposeObliqueTabletopGroup(asset),
  });

const focusFundamentalsRegistration: SceneAssetRegistration<typeof FOCUS_FUNDAMENTALS_ASSET_KEY> =
  Object.freeze({
    assetKey: FOCUS_FUNDAMENTALS_ASSET_KEY,
    implementationId: FOCUS_FUNDAMENTALS_IMPLEMENTATION_ID,
    renderResourceLifetime: "module-shared",
    create: (request) =>
      focusFundamentalsAsset.createFocusFundamentalsGroup(request),
  });

const viewCameraAnatomyRegistration: SceneAssetRegistration<typeof VIEW_CAMERA_ANATOMY_ASSET_KEY> =
  Object.freeze({
    assetKey: VIEW_CAMERA_ANATOMY_ASSET_KEY,
    implementationId: VIEW_CAMERA_ANATOMY_IMPLEMENTATION_ID,
    renderResourceLifetime: "module-shared",
    create: (request) =>
      viewCameraAnatomyAsset.createLessonZeroGroundGlassGroup(request),
  });

const mirrorShiftRegistration: SceneAssetRegistration<typeof MIRROR_SHIFT_ASSET_KEY> =
  Object.freeze({
    assetKey: MIRROR_SHIFT_ASSET_KEY,
    implementationId: MIRROR_SHIFT_IMPLEMENTATION_ID,
    create: (request) => mirrorShiftAsset.createMirrorShiftAssetGroup(request),
    dispose: (asset) => mirrorShiftAsset.disposeMirrorShiftGroup(asset),
  });

const macroBellowsExtensionRegistration: SceneAssetRegistration<typeof MACRO_BELLOWS_EXTENSION_ASSET_KEY> =
  Object.freeze({
    assetKey: MACRO_BELLOWS_EXTENSION_ASSET_KEY,
    implementationId: MACRO_BELLOWS_EXTENSION_IMPLEMENTATION_ID,
    create: (request) => macroBellowsExtensionAsset.createMacroSpecimenGroup(request),
    dispose: (asset) => macroBellowsExtensionAsset.disposeMacroSpecimenGroup(asset),
  });

const macroDepthOfFieldRegistration: SceneAssetRegistration<typeof MACRO_DEPTH_OF_FIELD_ASSET_KEY> =
  Object.freeze({
    assetKey: MACRO_DEPTH_OF_FIELD_ASSET_KEY,
    implementationId: MACRO_DEPTH_OF_FIELD_IMPLEMENTATION_ID,
    create: (request) => macroDepthOfFieldAsset.createMacroDepthOfFieldGroup(request),
    dispose: (asset) => macroDepthOfFieldAsset.disposeMacroDepthOfFieldGroup(asset),
  });

const macroObliquePlaneRegistration: SceneAssetRegistration<typeof MACRO_OBLIQUE_PLANE_ASSET_KEY> =
  Object.freeze({
    assetKey: MACRO_OBLIQUE_PLANE_ASSET_KEY,
    implementationId: MACRO_OBLIQUE_PLANE_IMPLEMENTATION_ID,
    create: (request) => macroObliquePlaneAsset.createMacroObliquePlaneGroup(request),
    dispose: (asset) => macroObliquePlaneAsset.disposeMacroObliquePlaneGroup(asset),
  });

const macroCompoundMovementsRegistration: SceneAssetRegistration<typeof MACRO_COMPOUND_MOVEMENTS_ASSET_KEY> =
  Object.freeze({
    assetKey: MACRO_COMPOUND_MOVEMENTS_ASSET_KEY,
    implementationId: MACRO_COMPOUND_MOVEMENTS_IMPLEMENTATION_ID,
    create: (request) => macroCompoundMovementsAsset.createMacroCompoundMovementsGroup(request),
    dispose: (asset) => macroCompoundMovementsAsset.disposeMacroCompoundMovementsGroup(asset),
  });

const fringeClubRuntimeRegistration: SceneAssetRegistration<typeof FRINGE_CLUB_RUNTIME_ASSET_KEY> =
  Object.freeze({
    assetKey: FRINGE_CLUB_RUNTIME_ASSET_KEY,
    implementationId: FRINGE_CLUB_RUNTIME_IMPLEMENTATION_ID,
    renderResourceLifetime: "instance-owned",
    create: (request) =>
      fringeClubRuntimeAsset.createFringeClubRegisteredGroup(request),
    dispose: (asset) =>
      fringeClubRuntimeAsset.disposeFringeClubRegisteredGroup(asset),
  });

/** Immutable production mapping from each registered scene asset slot. */
export const sceneAssetRegistry: CompleteSceneAssetRegistry = Object.freeze({
  [CAMERA_MOVEMENT_LATTICE_ASSET_KEY]: cameraMovementLatticeRegistration,
  [ARCHITECTURE_RISE_ASSET_KEY]: architectureRiseRegistration,
  [OBLIQUE_ARCHITECTURE_ASSET_KEY]: obliqueArchitectureRegistration,
  [TABLE_TILT_ASSET_KEY]: tableTiltRegistration,
  [SHELF_SWING_ASSET_KEY]: shelfSwingRegistration,
  [ARCHITECTURE_FOREGROUND_ASSET_KEY]: architectureForegroundRegistration,
  [INTERIOR_CORNER_ASSET_KEY]: interiorCornerRegistration,
  [OBLIQUE_TABLETOP_ASSET_KEY]: obliqueTabletopRegistration,
  [FOCUS_FUNDAMENTALS_ASSET_KEY]: focusFundamentalsRegistration,
  [VIEW_CAMERA_ANATOMY_ASSET_KEY]: viewCameraAnatomyRegistration,
  [MIRROR_SHIFT_ASSET_KEY]: mirrorShiftRegistration,
  [MACRO_BELLOWS_EXTENSION_ASSET_KEY]: macroBellowsExtensionRegistration,
  [MACRO_DEPTH_OF_FIELD_ASSET_KEY]: macroDepthOfFieldRegistration,
  [MACRO_OBLIQUE_PLANE_ASSET_KEY]: macroObliquePlaneRegistration,
  [MACRO_COMPOUND_MOVEMENTS_ASSET_KEY]: macroCompoundMovementsRegistration,
  [FRINGE_CLUB_RUNTIME_ASSET_KEY]: fringeClubRuntimeRegistration,
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
): AnySceneAssetRegistration;
export function resolveSceneAsset(
  assetKey: string,
  registry: SceneAssetRegistry = sceneAssetRegistry,
): AnySceneAssetRegistration {
  if (
    assetKey !== CAMERA_MOVEMENT_LATTICE_ASSET_KEY &&
    assetKey !== ARCHITECTURE_RISE_ASSET_KEY &&
    assetKey !== OBLIQUE_ARCHITECTURE_ASSET_KEY &&
    assetKey !== TABLE_TILT_ASSET_KEY &&
    assetKey !== SHELF_SWING_ASSET_KEY &&
    assetKey !== ARCHITECTURE_FOREGROUND_ASSET_KEY &&
    assetKey !== INTERIOR_CORNER_ASSET_KEY &&
    assetKey !== OBLIQUE_TABLETOP_ASSET_KEY &&
    assetKey !== FOCUS_FUNDAMENTALS_ASSET_KEY &&
    assetKey !== VIEW_CAMERA_ANATOMY_ASSET_KEY &&
    assetKey !== MIRROR_SHIFT_ASSET_KEY &&
    assetKey !== MACRO_BELLOWS_EXTENSION_ASSET_KEY &&
    assetKey !== MACRO_DEPTH_OF_FIELD_ASSET_KEY &&
    assetKey !== MACRO_OBLIQUE_PLANE_ASSET_KEY &&
    assetKey !== MACRO_COMPOUND_MOVEMENTS_ASSET_KEY &&
    assetKey !== FRINGE_CLUB_RUNTIME_ASSET_KEY
  ) {
    throw new Error('Unknown scene asset "' + assetKey + '"');
  }

  const registration = registry[assetKey as SceneAssetKey];
  if (!registration) {
    throw new Error(
      'Scene asset "' + assetKey + '" is not registered',
    );
  }
  return registration as AnySceneAssetRegistration;
}

/** Resolve and create a typed registered implementation for one scene asset slot. */
export const createRegisteredSceneAsset = <K extends SceneAssetKey>(
  assetKey: K,
  request: SceneAssetRequestMap[K],
  registry: SceneAssetRegistry = sceneAssetRegistry,
): THREE.Group => {
  const registration = resolveSceneAsset(assetKey, registry) as SceneAssetRegistration<K>;
  const group = registration.create(request);
  // Diagnostic metadata only; slot plus registry remain lifecycle authority.
  group.userData.assetImplementationId = registration.implementationId;
  return group;
};

/**
 * Apply the registered instance cleanup policy for an explicit asset slot.
 * Module-shared registrations intentionally leave borrowed GPU resources alive;
 * their consumer removes/discards its Object3D graph during unmount.
 */
export const disposeRegisteredSceneAsset = <K extends SceneAssetKey>(
  assetKey: K,
  group: THREE.Group,
  registry: SceneAssetRegistry = sceneAssetRegistry,
): void => {
  const registration = resolveSceneAsset(assetKey, registry);
  if (registration.renderResourceLifetime === "module-shared") return;
  if (typeof registration.dispose !== "function") {
    throw new Error(
      `Instance-owned scene asset "${assetKey}" has no registered disposer`,
    );
  }
  registration.dispose(group);
};
