import * as THREE from "three";
import type { MaterialAwareNode } from "./materialAwareNodeMaterials";
import type { MaterialOutputOwner } from "./materialAwareMaterialTracker";

type ArchitectureRiseOutputResources = Readonly<{
  adaptedOutputMaterials: Set<THREE.Material>;
}>;

const outputOwners = new WeakMap<THREE.Object3D, MaterialOutputOwner>();

/** Architecture Rise's registered subject is the readiness authority for this candidate. */
export const isArchitectureRiseMaterialOutputReady = (scene: THREE.Scene): boolean =>
  scene.getObjectByName("architecture-rise-subject") !== undefined;

/**
 * Resolve the registered-subject lifetime outside the reusable tracker. Each
 * root has its own adapted-material registry, so source materials shared with
 * another owner never inherit disposal authority from traversal order.
 */
export const resolveArchitectureRiseMaterialOutputOwner = (
  object: THREE.Object3D,
  controllerOwner: MaterialOutputOwner,
): MaterialOutputOwner => {
  let root: THREE.Object3D | null = object;
  while (root && root.name !== "architecture-rise-subject") root = root.parent;
  if (!root) return controllerOwner;

  const resources = root.userData.resources as ArchitectureRiseOutputResources | undefined;
  if (!(resources?.adaptedOutputMaterials instanceof Set)) {
    throw new Error("Architecture Rise subject has no registered adapted-material owner");
  }

  let owner = outputOwners.get(root);
  if (!owner) {
    const adaptedMaterials = resources.adaptedOutputMaterials;
    owner = {
      identity: root,
      kind: "registered-subject",
      retain: (output) => {
        adaptedMaterials.add(output);
      },
      release: (output: MaterialAwareNode) => {
        if (!adaptedMaterials.delete(output)) return;
        output.dispose();
      },
    };
    outputOwners.set(root, owner);
  }
  return owner;
};
