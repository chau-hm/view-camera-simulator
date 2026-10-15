import type * as THREE from "three";

/** Private ownership link used to keep authored materials and textures owned by their existing disposers. */
export const observerOutputSourceMaterial = Symbol("observer-output-source-material");

export type AdaptedObserverMaterial = THREE.Material & {
  [observerOutputSourceMaterial]?: THREE.Material;
};
