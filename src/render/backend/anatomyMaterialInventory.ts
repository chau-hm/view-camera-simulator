import * as THREE from "three";
import { classifyAnatomyMaterialRole } from "../anatomyMaterialRoles";
import {
  buildObserverMaterialInventory,
  type ObserverMaterialInventory,
} from "./architectureRiseMaterialInventory";
import type { UnsupportedMaterialAssignment } from "./materialAwareMaterialTracker";

/** Anatomy-specific labels over the shared output controller inventory. */
export const buildAnatomyMaterialInventory = (
  scene: THREE.Scene,
  frame: number,
  unsupported: readonly UnsupportedMaterialAssignment[],
): ObserverMaterialInventory => buildObserverMaterialInventory(scene, frame, unsupported, {
  sceneId: "view-camera-anatomy",
  roleForObject: (object, currentScene) => classifyAnatomyMaterialRole(object, currentScene).role,
  outputOwnerForRole: (role) => role === "registered-target-subject"
    ? "Observer output-policy controller (NodeMaterial); module-shared source borrowed"
    : "Observer output-policy controller (NodeMaterial); authored material source borrowed",
});
