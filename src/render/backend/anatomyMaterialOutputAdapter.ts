import * as THREE from "three";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../../scenes/presentation/viewCameraAnatomy";
import type { ObserverMaterialInventory } from "./architectureRiseMaterialInventory";
import {
  type MaterialOutputOwner,
  type UnsupportedMaterialAssignment,
} from "./materialAwareMaterialTracker";

const countRenderables = (root: THREE.Object3D): number => {
  let count = 0;
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh || (object as THREE.Line).isLine || (object as THREE.Points).isPoints) {
      count += 1;
    }
  });
  return count;
};

export type AnatomyMaterialOutputReadiness = Readonly<{
  ready: boolean;
  reason: string | null;
  registeredSubjectRenderables: number;
  expectedSubjectRenderables: number;
  conceptualCameraRenderables: number;
  materialAssignments: number;
  trackedAttachments: number;
}>;

/**
 * Anatomy borrows module-shared source geometry/materials. All adapted copies
 * therefore stay with this renderer-generation-scoped Observer controller.
 */
export const resolveAnatomyMaterialOutputOwner = (
  _object: THREE.Object3D,
  controllerOwner: MaterialOutputOwner,
): MaterialOutputOwner => controllerOwner;

/**
 * Readiness is based on the actual mounted Anatomy target and camera renderables,
 * plus complete current-frame adaptation. It deliberately excludes optional
 * teaching overlays which mount only in selected lessons.
 */
export const inspectAnatomyMaterialOutputReadiness = (
  scene: THREE.Scene,
  inventory: ObserverMaterialInventory | null,
  trackedAttachments: number,
  backgroundInstalled: boolean,
  unsupported: readonly UnsupportedMaterialAssignment[],
): AnatomyMaterialOutputReadiness => {
  const target = scene.getObjectByName("view-camera-anatomy-subject");
  const camera = scene.getObjectByName("camera-rig-placement");
  const registeredSubjectRenderables = target ? countRenderables(target) : 0;
  const conceptualCameraRenderables = camera ? countRenderables(camera) : 0;
  const expectedSubjectRenderables = VIEW_CAMERA_ANATOMY_PRESENTATION.geometry.boxes.length;
  const materialAssignments = inventory?.totalMeshAssignments ?? 0;
  const result = (reason: string | null): AnatomyMaterialOutputReadiness => ({
    ready: reason === null,
    reason,
    registeredSubjectRenderables,
    expectedSubjectRenderables,
    conceptualCameraRenderables,
    materialAssignments,
    trackedAttachments,
  });

  if (!target || registeredSubjectRenderables !== expectedSubjectRenderables) {
    return result("registered-anatomy-subject-incomplete");
  }
  if (!camera || conceptualCameraRenderables === 0) {
    return result("conceptual-camera-not-mounted");
  }
  if (!scene.getObjectByName("teaching-lighting-fill") || !scene.getObjectByName("teaching-lighting-key")) {
    return result("presentation-lighting-not-mounted");
  }
  if (!backgroundInstalled) return result("display-background-not-installed");
  if (!inventory || inventory.sceneId !== "view-camera-anatomy" || inventory.totalMeshAssignments === 0) {
    return result("anatomy-material-inventory-not-ready");
  }
  if (unsupported.length > 0 || inventory.unsupportedMaterialInstances > 0) {
    return result("unsupported-material-assignment");
  }
  if (trackedAttachments !== materialAssignments || inventory.adaptedMaterialInstances === 0 ||
      inventory.families.some((family) => family.status !== "supported")) {
    return result("material-adaptation-incomplete");
  }
  return result(null);
};
