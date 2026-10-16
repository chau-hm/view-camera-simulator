import type * as THREE from "three";

/** Private ownership link used to keep authored materials and textures owned by their existing disposers. */
export const observerOutputSourceMaterial = Symbol("observer-output-source-material");
/** Identifies the per-subject or controller lifetime that owns an adapted copy. */
export const observerOutputOwnerIdentity = Symbol("observer-output-owner-identity");
/** Diagnostic identity for the renderer-generation-scoped tracker that created a copy. */
export const observerOutputTrackerIdentity = Symbol("observer-output-tracker-identity");

export type AdaptedObserverMaterial = THREE.Material & {
  [observerOutputSourceMaterial]?: THREE.Material;
  [observerOutputOwnerIdentity]?: object;
  [observerOutputTrackerIdentity]?: object;
};
