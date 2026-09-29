import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import * as cameraMovementLatticeAsset from "../../render/assets/CameraMovementLatticeAsset";
import { CAMERA_MOVEMENT_BASELINE_PRESENTATION } from "../../scenes/presentation/understandingCameraMovements";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";
import { OBLIQUE_ARCHITECTURE_PRESENTATION } from "../../scenes/presentation/obliqueArchitecture";
import { TABLE_TILT_PRESENTATION } from "../../scenes/presentation/tableTilt";
import { SHELF_SWING_PRESENTATION } from "../../scenes/presentation/shelfSwing";
import { ARCHITECTURE_FOREGROUND_PRESENTATION } from "../../scenes/presentation/architectureForeground";
import { INTERIOR_CORNER_PRESENTATION } from "../../scenes/presentation/interiorCorner";
import { OBLIQUE_TABLETOP_PRESENTATION } from "../../scenes/presentation/obliqueTabletop";
import { FOCUS_FUNDAMENTALS_PRESENTATION } from "../../scenes/presentation/focusFundamentals";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../../scenes/presentation/viewCameraAnatomy";
import { MIRROR_SHIFT_PRESENTATION } from "../../scenes/presentation/mirrorShift";
import {
  ARCHITECTURE_RISE_ASSET_KEY,
  ARCHITECTURE_FOREGROUND_ASSET_KEY,
  INTERIOR_CORNER_ASSET_KEY,
  OBLIQUE_TABLETOP_ASSET_KEY,
  FOCUS_FUNDAMENTALS_ASSET_KEY,
  VIEW_CAMERA_ANATOMY_ASSET_KEY,
  MIRROR_SHIFT_ASSET_KEY,
  OBLIQUE_ARCHITECTURE_ASSET_KEY,
  SHELF_SWING_ASSET_KEY,
  TABLE_TILT_ASSET_KEY,
  CAMERA_MOVEMENT_LATTICE_ASSET_KEY,
  CAMERA_MOVEMENT_LATTICE_IMPLEMENTATION_ID,
  createRegisteredSceneAsset,
  resolveSceneAsset,
  sceneAssetRegistry,
  type SceneAssetKey,
  type SceneAssetRegistry,
  type SceneAssetRegistration,
} from "../../render/assets/sceneAssetRegistry";
import { cameraMovementsGroupOptionsFromPresentation } from "../../render/assets/CameraMovementLatticeAsset";
import {
  createCameraMovementLatticeAsset,
  disposeCameraMovementLatticeAsset,
} from "../../render/cameraMovementLatticeAssetConsumer";

const assertSceneAssetRequestKeyPairings = (): void => {
  createRegisteredSceneAsset(ARCHITECTURE_RISE_ASSET_KEY, {
    presentation: ARCHITECTURE_RISE_PRESENTATION,
  });
  createRegisteredSceneAsset(OBLIQUE_ARCHITECTURE_ASSET_KEY, {
    presentation: OBLIQUE_ARCHITECTURE_PRESENTATION,
  });
  createRegisteredSceneAsset(TABLE_TILT_ASSET_KEY, {
    presentation: TABLE_TILT_PRESENTATION,
  });
  createRegisteredSceneAsset(SHELF_SWING_ASSET_KEY, {
    presentation: SHELF_SWING_PRESENTATION,
  });
  createRegisteredSceneAsset(ARCHITECTURE_FOREGROUND_ASSET_KEY, {
    presentation: ARCHITECTURE_FOREGROUND_PRESENTATION,
  });
  createRegisteredSceneAsset(INTERIOR_CORNER_ASSET_KEY, {
    presentation: INTERIOR_CORNER_PRESENTATION,
  });
  createRegisteredSceneAsset(OBLIQUE_TABLETOP_ASSET_KEY, {
    presentation: OBLIQUE_TABLETOP_PRESENTATION,
  });
  createRegisteredSceneAsset(FOCUS_FUNDAMENTALS_ASSET_KEY, {
    presentation: FOCUS_FUNDAMENTALS_PRESENTATION,
  });
  createRegisteredSceneAsset(VIEW_CAMERA_ANATOMY_ASSET_KEY, {
    presentation: VIEW_CAMERA_ANATOMY_PRESENTATION,
  });
  createRegisteredSceneAsset(MIRROR_SHIFT_ASSET_KEY, {
    presentation: MIRROR_SHIFT_PRESENTATION,
    representation: "viewport",
  });
  createRegisteredSceneAsset(MIRROR_SHIFT_ASSET_KEY, {
    presentation: MIRROR_SHIFT_PRESENTATION,
    representation: "rtt",
  });

  // The Architecture Rise slot rejects the Table Tilt request.
  createRegisteredSceneAsset(ARCHITECTURE_RISE_ASSET_KEY, {
    // @ts-expect-error The key selects ArchitectureRiseAssetRequest.
    presentation: TABLE_TILT_PRESENTATION,
  });
  // The Oblique Architecture slot rejects the Shelf Swing request.
  createRegisteredSceneAsset(OBLIQUE_ARCHITECTURE_ASSET_KEY, {
    // @ts-expect-error The key selects ObliqueArchitectureAssetRequest.
    presentation: SHELF_SWING_PRESENTATION,
  });
  // The Table Tilt slot rejects the Architecture Rise request.
  createRegisteredSceneAsset(TABLE_TILT_ASSET_KEY, {
    // @ts-expect-error The key selects TableTiltAssetRequest.
    presentation: ARCHITECTURE_RISE_PRESENTATION,
  });
  // The Shelf Swing slot rejects the Oblique Architecture request.
  createRegisteredSceneAsset(SHELF_SWING_ASSET_KEY, {
    // @ts-expect-error The key selects ShelfSwingAssetRequest.
    presentation: OBLIQUE_ARCHITECTURE_PRESENTATION,
  });
  // The Architecture Foreground slot rejects an Interior Corner request.
  createRegisteredSceneAsset(ARCHITECTURE_FOREGROUND_ASSET_KEY, {
    // @ts-expect-error The key selects ArchitectureForegroundAssetRequest.
    presentation: INTERIOR_CORNER_PRESENTATION,
  });
  // The Interior Corner slot rejects an Oblique Tabletop request.
  createRegisteredSceneAsset(INTERIOR_CORNER_ASSET_KEY, {
    // @ts-expect-error The key selects InteriorCornerAssetRequest.
    presentation: OBLIQUE_TABLETOP_PRESENTATION,
  });
  // The Oblique Tabletop slot rejects an Architecture Foreground request.
  createRegisteredSceneAsset(OBLIQUE_TABLETOP_ASSET_KEY, {
    // @ts-expect-error The key selects ObliqueTabletopAssetRequest.
    presentation: ARCHITECTURE_FOREGROUND_PRESENTATION,
  });
  // Each shared subject slot accepts only its own renderer-neutral request.
  createRegisteredSceneAsset(FOCUS_FUNDAMENTALS_ASSET_KEY, {
    // @ts-expect-error Focus Fundamentals rejects the View Camera Anatomy request.
    presentation: VIEW_CAMERA_ANATOMY_PRESENTATION,
  });
  createRegisteredSceneAsset(VIEW_CAMERA_ANATOMY_ASSET_KEY, {
    // @ts-expect-error View Camera Anatomy rejects the Focus Fundamentals request.
    presentation: FOCUS_FUNDAMENTALS_PRESENTATION,
  });
  // Mirror Shift rejects unrelated scene presentation data.
  createRegisteredSceneAsset(MIRROR_SHIFT_ASSET_KEY, {
    // @ts-expect-error Mirror Shift requests require MirrorShiftPresentation.
    presentation: VIEW_CAMERA_ANATOMY_PRESENTATION,
    representation: "rtt",
  });
  createRegisteredSceneAsset(MIRROR_SHIFT_ASSET_KEY, {
    presentation: MIRROR_SHIFT_PRESENTATION,
    // @ts-expect-error The request is explicitly one of the two supported representations.
    representation: "interactive",
  });

  const sharedRegistration: SceneAssetRegistration<typeof FOCUS_FUNDAMENTALS_ASSET_KEY> = {
    assetKey: FOCUS_FUNDAMENTALS_ASSET_KEY,
    implementationId: "type-test-focus-shared",
    renderResourceLifetime: "module-shared",
    create: () => new THREE.Group(),
  };
  const instanceOwnedRegistration: SceneAssetRegistration<typeof ARCHITECTURE_RISE_ASSET_KEY> = {
    assetKey: ARCHITECTURE_RISE_ASSET_KEY,
    implementationId: "type-test-rise-owned",
    create: () => new THREE.Group(),
    dispose: () => undefined,
  };
  const mirrorShiftOwnedRegistration: SceneAssetRegistration<typeof MIRROR_SHIFT_ASSET_KEY> = {
    assetKey: MIRROR_SHIFT_ASSET_KEY,
    implementationId: "type-test-mirror-shift-owned",
    create: () => new THREE.Group(),
    dispose: () => undefined,
  };
  const sharedWithDisposer: SceneAssetRegistration<typeof FOCUS_FUNDAMENTALS_ASSET_KEY> = {
    assetKey: FOCUS_FUNDAMENTALS_ASSET_KEY,
    implementationId: "type-test-invalid-shared-disposer",
    renderResourceLifetime: "module-shared",
    create: () => new THREE.Group(),
    // @ts-expect-error Module-shared registrations cannot dispose borrowed resources.
    dispose: () => undefined,
  };
  // @ts-expect-error Omitting a disposer does not imply module-shared lifetime.
  const sharedWithoutPolicy: SceneAssetRegistration<typeof FOCUS_FUNDAMENTALS_ASSET_KEY> = {
    assetKey: FOCUS_FUNDAMENTALS_ASSET_KEY,
    implementationId: "type-test-invalid-missing-policy",
    create: () => new THREE.Group(),
  };
  // @ts-expect-error Instance-owned registrations require their paired disposer.
  const ownedWithoutDisposer: SceneAssetRegistration<typeof ARCHITECTURE_RISE_ASSET_KEY> = {
    assetKey: ARCHITECTURE_RISE_ASSET_KEY,
    implementationId: "type-test-invalid-missing-disposer",
    create: () => new THREE.Group(),
  };
  // @ts-expect-error Mirror Shift is instance-owned and requires its paired disposer.
  const mirrorShiftWithoutDisposer: SceneAssetRegistration<typeof MIRROR_SHIFT_ASSET_KEY> = {
    assetKey: MIRROR_SHIFT_ASSET_KEY,
    implementationId: "type-test-invalid-mirror-shift-missing-disposer",
    create: () => new THREE.Group(),
  };
  void sharedRegistration;
  void instanceOwnedRegistration;
  void mirrorShiftOwnedRegistration;
  void sharedWithDisposer;
  void sharedWithoutPolicy;
  void ownedWithoutDisposer;
  void mirrorShiftWithoutDisposer;
};
void assertSceneAssetRequestKeyPairings;

describe("scene asset registry", () => {
  it("resolves the production lattice factory and its matching exactly-once disposer", () => {
    const presentation = CAMERA_MOVEMENT_BASELINE_PRESENTATION;
    const options = cameraMovementsGroupOptionsFromPresentation(
      presentation,
      "middle",
    );
    const presentationAssetKey: SceneAssetKey = presentation.object.id;
    const registration = resolveSceneAsset(presentationAssetKey);
    const factorySpy = vi.spyOn(
      cameraMovementLatticeAsset,
      "createCameraMovementsGroup",
    );
    let group: THREE.Group | null = null;

    try {
      expect(registration).toBe(
        sceneAssetRegistry[CAMERA_MOVEMENT_LATTICE_ASSET_KEY],
      );
      expect(registration.assetKey).toBe(CAMERA_MOVEMENT_LATTICE_ASSET_KEY);
      expect(registration.implementationId).toBe(
        CAMERA_MOVEMENT_LATTICE_IMPLEMENTATION_ID,
      );
      expect(Object.keys(sceneAssetRegistry)).toEqual([
        CAMERA_MOVEMENT_LATTICE_ASSET_KEY,
        ARCHITECTURE_RISE_ASSET_KEY,
        OBLIQUE_ARCHITECTURE_ASSET_KEY,
        TABLE_TILT_ASSET_KEY,
        SHELF_SWING_ASSET_KEY,
        ARCHITECTURE_FOREGROUND_ASSET_KEY,
        INTERIOR_CORNER_ASSET_KEY,
        OBLIQUE_TABLETOP_ASSET_KEY,
        FOCUS_FUNDAMENTALS_ASSET_KEY,
        VIEW_CAMERA_ANATOMY_ASSET_KEY,
        MIRROR_SHIFT_ASSET_KEY,
      ]);
      expect(presentationAssetKey).toBe(CAMERA_MOVEMENT_LATTICE_ASSET_KEY);
      expect(Object.isFrozen(sceneAssetRegistry)).toBe(true);
      Object.entries(sceneAssetRegistry).forEach(([assetKey, assetRegistration]) => {
        expect(Object.isFrozen(assetRegistration), assetKey).toBe(true);
      });
      expect(
        new Set(
          Object.values(sceneAssetRegistry).map(
            (assetRegistration) => assetRegistration?.implementationId,
          ),
        ).size,
      ).toBe(Object.keys(sceneAssetRegistry).length);

      group = createCameraMovementLatticeAsset(options);
      expect(factorySpy).toHaveBeenCalledTimes(1);
      const factoryOptions = factorySpy.mock.calls[0]?.[0];
      expect(factoryOptions).toBe(options);
      if (!factoryOptions || typeof factoryOptions !== "object") {
        throw new Error("The registered factory did not receive options");
      }
      expect(factoryOptions.presentation).toBe(presentation);
      expect(group.userData.canonicalEdgeCount).toBe(
        presentation.lattice.edges.length,
      );

      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) {
          return;
        }
        geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        objectMaterials.forEach((material) => materials.add(material));
      });
      const geometryDisposals = [...geometries].map((geometry) =>
        vi.spyOn(geometry, "dispose"),
      );
      const materialDisposals = [...materials].map((material) =>
        vi.spyOn(material, "dispose"),
      );

      expect(group.userData.assetImplementationId).toBe(
        registration.implementationId,
      );
      group.userData.assetImplementationId = "tampered-diagnostic-value";
      disposeCameraMovementLatticeAsset(group);
      disposeCameraMovementLatticeAsset(group);

      expect(group.userData.resourcesDisposed).toBe(true);
      geometryDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
      materialDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    } finally {
      if (group && group.userData.resourcesDisposed !== true) {
        disposeCameraMovementLatticeAsset(group);
      }
      vi.restoreAllMocks();
    }
  });

  it("fails closed for unknown keys and a known key with no registration", () => {
    const emptyRegistry: SceneAssetRegistry = Object.freeze({});
    expect(() => resolveSceneAsset("unregistered-subject")).toThrowError(
      'Unknown scene asset "unregistered-subject"',
    );
    expect(() =>
      resolveSceneAsset(CAMERA_MOVEMENT_LATTICE_ASSET_KEY, emptyRegistry),
    ).toThrowError(
      'Scene asset "camera-movement-lattice" is not registered',
    );
    expect(() =>
      resolveSceneAsset(ARCHITECTURE_RISE_ASSET_KEY, emptyRegistry),
    ).toThrowError('Scene asset "architecture-rise-subject" is not registered');
    expect(() =>
      resolveSceneAsset(ARCHITECTURE_FOREGROUND_ASSET_KEY, emptyRegistry),
    ).toThrowError(
      'Scene asset "architecture-foreground-subject" is not registered',
    );
    expect(() =>
      resolveSceneAsset(INTERIOR_CORNER_ASSET_KEY, emptyRegistry),
    ).toThrowError('Scene asset "interior-corner-subject" is not registered');
    expect(() =>
      resolveSceneAsset(OBLIQUE_TABLETOP_ASSET_KEY, emptyRegistry),
    ).toThrowError('Scene asset "oblique-tabletop-subject" is not registered');
    expect(() =>
      resolveSceneAsset(FOCUS_FUNDAMENTALS_ASSET_KEY, emptyRegistry),
    ).toThrowError(
      'Scene asset "focus-fundamentals-subject" is not registered',
    );
    expect(() =>
      resolveSceneAsset(VIEW_CAMERA_ANATOMY_ASSET_KEY, emptyRegistry),
    ).toThrowError(
      'Scene asset "view-camera-anatomy-subject" is not registered',
    );
  });
});
