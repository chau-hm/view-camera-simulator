import * as THREE from "three";

/**
 * Keep the shared RTT shadow map in the virtual mirror-side domain.
 *
 * Mirror Shift deliberately mounts the physical room and its reflected copy
 * in one RTT scene so the existing Ground Glass pipeline can render both
 * through the aperture. That scene has one directional shadow map, however;
 * the RTT key is the mirror-reflected light and cannot provide a valid shadow
 * for the physical duplicate at the same time. Keep physical geometry visible
 * but out of that shared shadow domain, and leave the reflected floor as a
 * receiver for reflected props and the reflected camera.
 */
export const configureMirrorShiftRttShadowParticipation = (
  root: THREE.Object3D,
): void => {
  const reflectedGroup = root.getObjectByName("mirror-shift-reflected-props");
  if (!reflectedGroup) return;

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!reflectedGroup.getObjectById(object.id)) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });

  const reflectedFloor = root.getObjectByName("mirror-shift-reflected-floor");
  if (reflectedFloor instanceof THREE.Mesh) {
    reflectedFloor.castShadow = false;
    reflectedFloor.receiveShadow = true;
  }
};
