/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { toWorld } from "./rttUtils";
import { disposeTeachingSubjectResources } from "./TeachingMaterials";
import { MACRO_SPECIMEN } from "../scenes/macroSpecimenGeometry";

/** An invented specimen medallion, with all visible detail in physical geometry. */
export function createMacroSpecimenGroup(): THREE.Group {
  const root = new THREE.Group();
  root.name = "macro-bellows-extension-subject";
  root.position.set(...[
    MACRO_SPECIMEN.faceCenterMm.x,
    MACRO_SPECIMEN.faceCenterMm.y,
    MACRO_SPECIMEN.faceCenterMm.z,
  ].map(toWorld) as [number, number, number]);
  const bronze = new THREE.MeshStandardMaterial({ color: "#b89557", roughness: 0.65, metalness: 0.25 });
  const bright = new THREE.MeshStandardMaterial({ color: "#ead6a1", roughness: 0.55, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: "#493b2d", roughness: 0.85, metalness: 0.1 });
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `macro-specimen-${name}`;
    mesh.position.set(toWorld(x), toWorld(y), toWorld(z));
    root.add(mesh);
    return mesh;
  };
  const disc = new THREE.CylinderGeometry(toWorld(MACRO_SPECIMEN.diameterMm / 2), toWorld(MACRO_SPECIMEN.diameterMm / 2), toWorld(MACRO_SPECIMEN.thicknessMm), 128);
  disc.rotateX(Math.PI / 2);
  add("body", disc, bronze, 0, 0, MACRO_SPECIMEN.thicknessMm / 2);
  // Torus relief faces the lens (-Z), leaving the base face at exactly 300 mm.
  for (const [name, radius, tube] of [["outer-rim", 44.4, 0.6], ["inner-ring", 35, 0.45], ["central-ring", 17, 0.3]] as const) {
    add(name, new THREE.TorusGeometry(toWorld(radius), toWorld(tube), 8, 128), bright);
  }
  const tick = new THREE.BoxGeometry(toWorld(0.55), toWorld(3.8), toWorld(0.25));
  const dot = new THREE.SphereGeometry(toWorld(0.48), 8, 6);
  for (let i = 0; i < 72; i++) {
    const angle = i * Math.PI * 2 / 72;
    const mark = add(`radial-mark-${i}`, tick, i % 3 === 0 ? dark : bright, 40 * Math.sin(angle), 40 * Math.cos(angle), -0.125);
    mark.rotation.z = -angle;
    add(`dot-${i}`, dot, dark, 32.5 * Math.sin(angle), 32.5 * Math.cos(angle));
  }
  // Asymmetric geometric relief makes image inversion observable without text.
  const relief = new THREE.Shape();
  relief.moveTo(0, toWorld(14));
  relief.lineTo(toWorld(11), toWorld(-9));
  relief.lineTo(toWorld(-9), toWorld(-6));
  relief.closePath();
  add("central-relief", new THREE.ExtrudeGeometry(relief, { depth: toWorld(0.5), bevelEnabled: false }), bright, 0, 0, -0.5);
  const fineLine = new THREE.BoxGeometry(toWorld(0.28), toWorld(9), toWorld(0.12));
  for (let i = 0; i < 15; i++) {
    add(`fine-line-${i}`, fineLine, dark, -7 + i, -23, -0.06);
  }
  const grain = new THREE.SphereGeometry(toWorld(0.18), 6, 4);
  for (let i = 0; i < 96; i++) {
    const angle = i * 2.399963229728653;
    const radius = 20 + (i % 9);
    add(`surface-dot-${i}`, grain, i % 2 ? bright : dark, radius * Math.cos(angle), radius * Math.sin(angle));
  }
  return root;
}

export const disposeMacroSpecimenGroup = (group: THREE.Group): void => {
  disposeTeachingSubjectResources(group);
};

export function MacroSpecimenSubject() {
  const group = useMemo(createMacroSpecimenGroup, []);
  useEffect(() => () => disposeMacroSpecimenGroup(group), [group]);
  return <primitive object={group} dispose={null} />;
}
