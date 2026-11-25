import * as THREE from "three";

export type AnatomyMaterialRole = Readonly<{
  role: string;
  cameraPart: string | null;
  owner: string;
}>;

const getAncestors = (object: THREE.Object3D, scene: THREE.Scene): THREE.Object3D[] => {
  const ancestors: THREE.Object3D[] = [];
  let current: THREE.Object3D | null = object;
  while (current && current !== scene) {
    ancestors.push(current);
    current = current.parent;
  }
  return ancestors;
};

/** Shared role interpretation for the read-only audit and live output inventory. */
export const classifyAnatomyMaterialRole = (
  object: THREE.Object3D,
  scene: THREE.Scene,
): AnatomyMaterialRole => {
  const ancestors = getAncestors(object, scene);
  const hasName = (name: string) => ancestors.some((candidate) => candidate.name === name);
  const cameraPart = ancestors.find(
    (candidate) => typeof candidate.userData.anatomyPart === "string",
  )?.userData.anatomyPart as string | undefined;

  if (hasName("view-camera-anatomy-subject")) {
    return { role: "registered-target-subject", cameraPart: null, owner: "module-shared-asset-source" };
  }
  if (hasName("original-ghost-camera-rig-placement")) {
    return {
      role: cameraPart ? `ghost-reference-camera/${cameraPart}` : "ghost-reference-camera",
      cameraPart: cameraPart ?? null,
      owner: "r3f-scene-component",
    };
  }
  if (hasName("camera-rig-placement")) {
    return {
      role: cameraPart ? `conceptual-camera/${cameraPart}` : "conceptual-camera",
      cameraPart: cameraPart ?? null,
      owner: object.name === "bellows-folded-surface"
        ? "component-owned-dynamic-geometry"
        : "r3f-scene-component",
    };
  }
  if ((object as THREE.Light).isLight === true) {
    return { role: "lighting", cameraPart: null, owner: "r3f-scene-component" };
  }
  if (/image-circle|coverage|lens-plane|film-plane|focus-plane|dof|scheimpflug|optical|fov|helper/i.test(
    ancestors.map((candidate) => candidate.name).join("/"),
  )) {
    return { role: "optical-helper", cameraPart: null, owner: "r3f-scene-component" };
  }
  return { role: "other-scene-renderable", cameraPart: null, owner: "r3f-scene-component" };
};
