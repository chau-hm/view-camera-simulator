import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import * as cameraMovementLatticeAsset from "../../render/assets/CameraMovementLatticeAsset";
import { CAMERA_MOVEMENT_BASELINE_PRESENTATION } from "../../scenes/presentation/understandingCameraMovements";
import {
  CAMERA_MOVEMENT_LATTICE_ASSET_KEY,
  CAMERA_MOVEMENT_LATTICE_IMPLEMENTATION_ID,
  resolveSceneAsset,
  sceneAssetRegistry,
  type SceneAssetRegistry,
} from "../../render/assets/sceneAssetRegistry";
import { cameraMovementsGroupOptionsFromPresentation } from "../../render/assets/CameraMovementLatticeAsset";

describe("scene asset registry", () => {
  it("resolves the production lattice factory and its matching exactly-once disposer", () => {
    const presentation = CAMERA_MOVEMENT_BASELINE_PRESENTATION;
    const options = cameraMovementsGroupOptionsFromPresentation(
      presentation,
      "middle",
    );
    const registration = resolveSceneAsset(presentation.object.id);
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
      expect(Object.isFrozen(sceneAssetRegistry)).toBe(true);
      expect(Object.isFrozen(registration)).toBe(true);

      group = registration.create(options);
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

      registration.dispose(group);
      registration.dispose(group);

      expect(group.userData.resourcesDisposed).toBe(true);
      geometryDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
      materialDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    } finally {
      if (group && group.userData.resourcesDisposed !== true) {
        registration.dispose(group);
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
  });
});
