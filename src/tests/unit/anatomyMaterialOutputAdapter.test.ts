import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../../scenes/presentation/viewCameraAnatomy";
import {
  inspectAnatomyMaterialOutputReadiness,
  resolveAnatomyMaterialOutputOwner,
} from "../../render/backend/anatomyMaterialOutputAdapter";
import type { ObserverMaterialInventory } from "../../render/backend/architectureRiseMaterialInventory";
import { buildAnatomyMaterialInventory } from "../../render/backend/anatomyMaterialInventory";
import { createObserverControllerMaterialOutputOwner } from "../../render/backend/materialAwareMaterialTracker";

const createReadyScene = () => {
  const scene = new THREE.Scene();
  const target = new THREE.Group();
  target.name = "view-camera-anatomy-subject";
  const sharedMaterial = new THREE.MeshStandardMaterial();
  const sharedGeometry = new THREE.BoxGeometry(1, 1, 1);
  VIEW_CAMERA_ANATOMY_PRESENTATION.geometry.boxes.forEach((_, index) => {
    const mesh = new THREE.Mesh(sharedGeometry, sharedMaterial);
    mesh.name = `target-box-${index}`;
    target.add(mesh);
  });
  scene.add(target);

  const camera = new THREE.Group();
  camera.name = "camera-rig-placement";
  camera.userData.anatomyPart = "lens";
  camera.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  scene.add(camera);
  const fill = new THREE.HemisphereLight();
  fill.name = "teaching-lighting-fill";
  const key = new THREE.DirectionalLight();
  key.name = "teaching-lighting-key";
  scene.add(fill, key);
  return scene;
};

describe("Anatomy material-aware output adapter", () => {
  it("keeps adapted copies under the Observer controller owner, never the borrowed source owner", () => {
    const owner = createObserverControllerMaterialOutputOwner();
    expect(resolveAnatomyMaterialOutputOwner(new THREE.Mesh(), owner)).toBe(owner);
    expect(owner.kind).toBe("observer-controller");
  });

  it("requires the registered target, conceptual camera, lighting, background and complete coverage", () => {
    const scene = createReadyScene();
    const sourceScene = scene.clone(true);
    const assignments = 18;
    const supportedInventory = {
      sceneId: "view-camera-anatomy",
      frame: 1,
      totalMeshAssignments: assignments,
      distinctMaterialInstances: 2,
      adaptedMaterialInstances: 2,
      unsupportedMaterialInstances: 0,
      unsupported: [],
      families: [],
      background: { authoredColor: "#f8fafc", nodeInstalled: true },
      environment: { assigned: false, textureType: null, colorSpace: null, intensity: 1 },
      lighting: { hemisphereLights: 1, directionalLights: 1, shadowCastingDirectionalLights: 0, shadowMapSizes: [] },
    } satisfies ObserverMaterialInventory;

    expect(inspectAnatomyMaterialOutputReadiness(
      scene,
      supportedInventory,
      assignments,
      true,
      [],
    )).toMatchObject({ ready: true, reason: null, registeredSubjectRenderables: assignments - 1 });
    expect(inspectAnatomyMaterialOutputReadiness(
      scene,
      supportedInventory,
      assignments - 1,
      true,
      [],
    )).toMatchObject({ ready: false, reason: "material-adaptation-incomplete" });
    expect(inspectAnatomyMaterialOutputReadiness(
      scene,
      supportedInventory,
      assignments,
      false,
      [],
    )).toMatchObject({ ready: false, reason: "display-background-not-installed" });

    const hiddenTargetScene = new THREE.Scene();
    const camera = sourceScene.getObjectByName("camera-rig-placement");
    const fill = sourceScene.getObjectByName("teaching-lighting-fill");
    const key = sourceScene.getObjectByName("teaching-lighting-key");
    if (camera) hiddenTargetScene.add(camera.clone(true));
    if (fill) hiddenTargetScene.add(fill.clone(true));
    if (key) hiddenTargetScene.add(key.clone(true));
    expect(inspectAnatomyMaterialOutputReadiness(
      hiddenTargetScene,
      supportedInventory,
      assignments,
      true,
      [],
    )).toMatchObject({ ready: false, reason: "registered-anatomy-subject-incomplete" });

    const inventory = buildAnatomyMaterialInventory(scene, 2, []);
    expect(inventory.sceneId).toBe("view-camera-anatomy");
    expect(inventory.families.map((family) => family.role)).toContain("registered-target-subject");
    expect(inventory.families.map((family) => family.role)).toContain("conceptual-camera/lens");
  });
});
