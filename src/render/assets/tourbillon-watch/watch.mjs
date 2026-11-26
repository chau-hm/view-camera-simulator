import * as THREE from 'three';
import { buildCase } from './case.mjs';
import { APERTURE, DIAL_Z, buildDial, buildHands } from './dial.mjs';
import { createWatchMaterials } from './materials.mjs';
import { buildMovement } from './movement.mjs';
import { buildStrap } from './strap.mjs';
import { buildTourbillon } from './tourbillon.mjs';

export const WATCH_DIMENSIONS_MM = Object.freeze({
  caseDiameter: 42,
  caseThickness: 12,
  apertureDiameter: APERTURE.radius * 2,
  apertureCenter: Object.freeze([APERTURE.x, APERTURE.y]),
  dialDatumZ: DIAL_Z,
});

export const CAGE_REVOLUTION_SECONDS = 60;

/**
 * Build a new, independently owned native Three.js assembly. Units are
 * millimetres, the dial faces +Z and the crown is on +X.
 */
export function createTourbillonWatch({ includeStrap = true } = {}) {
  const materials = createWatchMaterials();
  const root = new THREE.Group();
  root.name = 'Tourbillon wristwatch';
  const head = new THREE.Group();
  head.name = 'Watch head';
  const { group: tourbillon, cage } = buildTourbillon(materials);
  head.add(buildCase(materials), buildDial(materials), buildHands(materials), tourbillon, buildMovement(materials));
  root.add(head);
  const strap = includeStrap ? buildStrap(materials) : null;
  if (strap) root.add(strap);

  // Capture ownership at construction so callers can detach the strap or
  // temporarily override materials without changing disposal responsibilities.
  const ownedMaterials = new Set(Object.values(materials));
  const geometries = new Set();
  const instances = [];
  root.traverse(object => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    for (const material of [object.material].flat()) ownedMaterials.add(material);
    if (object.isInstancedMesh) instances.push(object);
  });
  const textures = new Set();
  for (const material of ownedMaterials) {
    for (const value of Object.values(material)) {
      if (value?.isTexture) textures.add(value);
    }
  }

  let disposed = false;
  return {
    root, head, strap, cage,
    // Expose the instance-owned materials so integrations can audit their
    // rendering properties without reaching into shared construction state.
    materials: Object.freeze([...ownedMaterials]),
    setCageAngle(radians) {
      cage.rotation.z = radians;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const mesh of instances) mesh.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of ownedMaterials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
