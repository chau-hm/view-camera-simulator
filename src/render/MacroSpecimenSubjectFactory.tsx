/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { toWorld } from "./rttUtils";
import { disposeTeachingSubjectResources } from "./TeachingMaterials";
import { createMacroMaterial } from "./MacroSubjectMaterials";
import {
  MACRO_SPECIMEN,
  MACRO_SPECIMEN_BACK_DETAIL_MAX_OFFSET_MM,
  MACRO_SPECIMEN_RADIAL_DOT_ORBIT_RADIUS_MM,
  MACRO_SPECIMEN_RADIAL_DOT_RADIUS_MM,
} from "../scenes/macroSpecimenGeometry";

/** An invented specimen medallion, with all visible detail in physical geometry. */
export function createMacroSpecimenGroup(): THREE.Group {
  const root = new THREE.Group();
  root.name = "macro-bellows-extension-subject";
  root.position.set(...[
    MACRO_SPECIMEN.faceCenterMm.x,
    MACRO_SPECIMEN.faceCenterMm.y,
    MACRO_SPECIMEN.faceCenterMm.z,
  ].map(toWorld) as [number, number, number]);
  const bronze = createMacroMaterial({
    color: "#b47a3d",
    roughness: 0.4,
    metalness: 0.32,
    seed: 11,
    roughnessVariation: 0.12,
    repeat: [6, 6],
  });
  const bright = createMacroMaterial({
    color: "#f0ce8b",
    roughness: 0.32,
    metalness: 0.38,
    seed: 17,
    roughnessVariation: 0.1,
    repeat: [8, 8],
  });
  const dark = createMacroMaterial({
    color: "#58412d",
    roughness: 0.74,
    metalness: 0.08,
    seed: 23,
    roughnessVariation: 0.14,
    repeat: [10, 4],
  });
  const copper = createMacroMaterial({
    color: "#d88645",
    roughness: 0.45,
    metalness: 0.3,
    seed: 29,
    roughnessVariation: 0.1,
    repeat: [5, 5],
  });
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
  const facePlate = new THREE.CylinderGeometry(toWorld(34), toWorld(34), toWorld(0.34), 128);
  facePlate.rotateX(Math.PI / 2);
  add("face-plate", facePlate, bronze, 0, 0, 0.17);
  const faceInset = new THREE.CylinderGeometry(toWorld(30.8), toWorld(30.8), toWorld(0.2), 128);
  faceInset.rotateX(Math.PI / 2);
  add("face-inset", faceInset, dark, 0, 0, 0.1);
  // Torus relief faces the lens (-Z), leaving the base face at exactly 300 mm.
  for (const [name, radius, tube] of [["outer-rim", 44.4, 0.6], ["inner-ring", 35, 0.45], ["central-ring", 17, 0.3]] as const) {
    add(name, new THREE.TorusGeometry(toWorld(radius), toWorld(tube), 8, 128), bright);
  }
  for (const [index, radius] of [40.8, 38.1, 28.2, 25.6].entries()) {
    add(
      `engraved-channel-${index}`,
      new THREE.TorusGeometry(toWorld(radius), toWorld(0.22), 8, 128),
      dark,
      0,
      0,
      -0.05,
    );
  }
  const tick = new THREE.BoxGeometry(toWorld(0.55), toWorld(3.8), toWorld(0.25));
  const edgeKnurl = new THREE.BoxGeometry(toWorld(0.42), toWorld(1.2), toWorld(0.26));
  const fineRadialMark = new THREE.BoxGeometry(toWorld(0.32), toWorld(2.4), toWorld(0.12));
  const dot = new THREE.SphereGeometry(
    toWorld(MACRO_SPECIMEN_RADIAL_DOT_RADIUS_MM),
    8,
    6,
  );
  for (let i = 0; i < 72; i++) {
    const angle = i * Math.PI * 2 / 72;
    const mark = add(
      `radial-mark-${i}`,
      tick,
      i % 3 === 0 ? dark : bright,
      40 * Math.sin(angle),
      40 * Math.cos(angle),
      -0.125,
    );
    mark.rotation.z = -angle;
    add(
      `dot-${i}`,
      dot,
      dark,
      MACRO_SPECIMEN_RADIAL_DOT_ORBIT_RADIUS_MM * Math.sin(angle),
      MACRO_SPECIMEN_RADIAL_DOT_ORBIT_RADIUS_MM * Math.cos(angle),
    );
  }
  for (let i = 0; i < 48; i += 1) {
    const angle = (i * Math.PI * 2) / 48;
    const knurl = add(
      `edge-knurl-${i}`,
      edgeKnurl,
      i % 4 === 0 ? copper : bright,
      43.2 * Math.sin(angle),
      43.2 * Math.cos(angle),
      0.08,
    );
    knurl.rotation.z = -angle;
  }
  for (let i = 0; i < 24; i += 1) {
    const angle = (i * Math.PI * 2) / 24 + Math.PI / 24;
    const mark = add(
      `radial-engraving-${i}`,
      fineRadialMark,
      i % 3 === 0 ? copper : dark,
      29 * Math.sin(angle),
      29 * Math.cos(angle),
      -0.06,
    );
    mark.rotation.z = -angle;
  }
  const fastener = new THREE.CylinderGeometry(toWorld(1.2), toWorld(1.2), toWorld(0.22), 24);
  fastener.rotateX(Math.PI / 2);
  const fastenerSlot = new THREE.BoxGeometry(toWorld(0.22), toWorld(1.6), toWorld(0.1));
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI * 2) / 8 + Math.PI / 8;
    const x = 24.5 * Math.sin(angle);
    const y = 24.5 * Math.cos(angle);
    add(`fastener-${i}`, fastener, copper, x, y, 0.02);
    const slot = add(`fastener-slot-${i}`, fastenerSlot, dark, x, y, -0.11);
    slot.rotation.z = angle + Math.PI / 2;
  }
  // Asymmetric geometric relief makes image inversion observable without text.
  const relief = new THREE.Shape();
  relief.moveTo(0, toWorld(14));
  relief.lineTo(toWorld(11), toWorld(-9));
  relief.lineTo(toWorld(-9), toWorld(-6));
  relief.closePath();
  add("central-relief", new THREE.ExtrudeGeometry(relief, { depth: toWorld(0.5), bevelEnabled: false }), bright, 0, 0, -0.5);
  const centralInsetRing = new THREE.TorusGeometry(toWorld(12.8), toWorld(0.22), 8, 96);
  add("central-inset-ring", centralInsetRing, copper, 0, 0, -0.04);
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

  // The default observer is on the rear side of this flat specimen. A shallow
  // fabricated inspection pattern on the back keeps the 3D viewport useful
  // without changing any lens-facing focus surfaces.
  const backCap = new THREE.CylinderGeometry(toWorld(33.5), toWorld(33.5), toWorld(0.24), 128);
  backCap.rotateX(Math.PI / 2);
  add("back-cap", backCap, bronze, 0, 0, 2.12);
  add(
    "back-outer-ring",
    new THREE.TorusGeometry(toWorld(31.5), toWorld(0.22), 8, 128),
    bright,
    0,
    0,
    MACRO_SPECIMEN_BACK_DETAIL_MAX_OFFSET_MM - 0.22,
  );
  add(
    "back-inner-ring",
    new THREE.TorusGeometry(toWorld(15), toWorld(0.18), 8, 96),
    copper,
    0,
    0,
    MACRO_SPECIMEN_BACK_DETAIL_MAX_OFFSET_MM - 0.18,
  );
  add(
    "back-relief",
    new THREE.ExtrudeGeometry(relief, { depth: toWorld(0.24), bevelEnabled: false }),
    bright,
    0,
    0,
    MACRO_SPECIMEN_BACK_DETAIL_MAX_OFFSET_MM - 0.24,
  );
  const backMark = new THREE.BoxGeometry(toWorld(0.35), toWorld(2.8), toWorld(0.12));
  for (let i = 0; i < 24; i += 1) {
    const angle = (i * Math.PI * 2) / 24;
    const mark = add(
      `back-radial-mark-${i}`,
      backMark,
      i % 4 === 0 ? copper : dark,
      25 * Math.sin(angle),
      25 * Math.cos(angle),
      MACRO_SPECIMEN_BACK_DETAIL_MAX_OFFSET_MM - 0.12,
    );
    mark.rotation.z = -angle;
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
