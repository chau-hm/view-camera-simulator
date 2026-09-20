/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { toWorld } from "./rttUtils";
import { disposeTeachingSubjectResources } from "./TeachingMaterials";
import { createMacroMaterial } from "./MacroSubjectMaterials";
import {
  MACRO_OBLIQUE_PLANE_SURFACE_CENTER_Z_MM,
  MACRO_OBLIQUE_PLANE_SURFACE_ANGLE_RAD,
  MACRO_OBLIQUE_PLATE_CENTER_MM,
  MACRO_OBLIQUE_PLATE_DIMENSIONS_MM,
  MACRO_OBLIQUE_TARGET_Y_MM,
} from "../scenes/macroObliquePlaneGeometry";

const plateLocalZ = -MACRO_OBLIQUE_PLATE_DIMENSIONS_MM.thickness / 2;

/** A shared, planar, high-frequency precision plate for viewport and RTT. */
export function createMacroObliquePlaneGroup(): THREE.Group {
  const root = new THREE.Group();
  root.name = "macro-oblique-plane-subject";
  root.position.set(
    toWorld(MACRO_OBLIQUE_PLATE_CENTER_MM.x),
    toWorld(MACRO_OBLIQUE_PLATE_CENTER_MM.y),
    toWorld(MACRO_OBLIQUE_PLANE_SURFACE_CENTER_Z_MM),
  );

  const plateAssembly = new THREE.Group();
  plateAssembly.name = "macro-oblique-plane-plate-assembly";
  plateAssembly.rotation.x = MACRO_OBLIQUE_PLANE_SURFACE_ANGLE_RAD;
  plateAssembly.position.set(
    0,
    toWorld(-MACRO_OBLIQUE_PLATE_DIMENSIONS_MM.thickness / 2 * Math.sin(MACRO_OBLIQUE_PLANE_SURFACE_ANGLE_RAD)),
    toWorld(MACRO_OBLIQUE_PLATE_DIMENSIONS_MM.thickness / 2 * Math.cos(MACRO_OBLIQUE_PLANE_SURFACE_ANGLE_RAD)),
  );
  root.add(plateAssembly);

  const plate = createMacroMaterial({
    color: "#83949a",
    roughness: 0.34,
    metalness: 0.88,
    seed: 71,
    roughnessVariation: 0.14,
    repeat: [9, 9],
    emissiveIntensity: 0.1,
  });
  const edgeMetal = createMacroMaterial({
    color: "#c7d2d4",
    roughness: 0.24,
    metalness: 0.94,
    seed: 73,
    roughnessVariation: 0.1,
    repeat: [12, 4],
    emissiveIntensity: 0.12,
  });
  const copper = createMacroMaterial({
    color: "#c87845",
    roughness: 0.4,
    metalness: 0.86,
    seed: 79,
    roughnessVariation: 0.16,
    repeat: [7, 5],
    emissiveIntensity: 0.1,
  });
  const etch = createMacroMaterial({
    color: "#1d3036",
    roughness: 0.78,
    metalness: 0.06,
    seed: 83,
    roughnessVariation: 0.12,
    repeat: [16, 6],
  });
  const backing = createMacroMaterial({
    color: "#35444b",
    roughness: 0.68,
    metalness: 0.12,
    seed: 89,
    roughnessVariation: 0.14,
    repeat: [4, 4],
  });
  const accent = createMacroMaterial({
    color: "#58bfc0",
    roughness: 0.42,
    metalness: 0.22,
    seed: 97,
    roughnessVariation: 0.12,
    repeat: [6, 6],
  });

  const add = (
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    xMm = 0,
    yMm = 0,
    zMm = 0,
    rotationZ = 0,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `macro-oblique-${name}`;
    mesh.position.set(toWorld(xMm), toWorld(yMm), toWorld(zMm));
    mesh.rotation.z = rotationZ;
    plateAssembly.add(mesh);
    return mesh;
  };

  const plateGeometry = new THREE.BoxGeometry(
    toWorld(MACRO_OBLIQUE_PLATE_DIMENSIONS_MM.x),
    toWorld(MACRO_OBLIQUE_PLATE_DIMENSIONS_MM.y),
    toWorld(MACRO_OBLIQUE_PLATE_DIMENSIONS_MM.thickness),
  );
  add("base-plate", plateGeometry, plate);

  // The rear mounting slab and four posts make the plate read as a fabricated
  // inspection object while remaining entirely behind the canonical surface.
  add("rear-mount", new THREE.BoxGeometry(toWorld(102), toWorld(102), toWorld(1.8)), backing, 0, 0, 2.2);
  const postGeometry = new THREE.CylinderGeometry(toWorld(2.1), toWorld(2.1), toWorld(3.8), 20);
  postGeometry.rotateX(Math.PI / 2);
  for (const [x, y] of [[-48, -48], [48, -48], [-48, 48], [48, 48]] as const) {
    add("rear-post", postGeometry, edgeMetal, x, y, 3.2);
  }

  const raisedRing = new THREE.TorusGeometry(toWorld(49), toWorld(0.7), 10, 128);
  const innerRing = new THREE.TorusGeometry(toWorld(42), toWorld(0.38), 8, 128);
  const centralRing = new THREE.TorusGeometry(toWorld(11), toWorld(0.42), 8, 96);
  add("outer-raised-ring", raisedRing, edgeMetal, 0, 0, plateLocalZ - 0.34);
  add("inner-engraved-ring", innerRing, copper, 0, 0, plateLocalZ - 0.2);
  add("central-registration-ring", centralRing, edgeMetal, 0, 0, plateLocalZ - 0.22);

  const edgeBar = new THREE.BoxGeometry(toWorld(96), toWorld(1.2), toWorld(0.22));
  const edgeBarVertical = new THREE.BoxGeometry(toWorld(1.2), toWorld(96), toWorld(0.22));
  for (const y of [-49, 49]) add("raised-edge-horizontal", edgeBar, edgeMetal, 0, y, plateLocalZ - 0.12);
  for (const x of [-49, 49]) add("raised-edge-vertical", edgeBarVertical, edgeMetal, x, 0, plateLocalZ - 0.12);

  // Repeated line pairs provide focus texture without placing relief directly
  // over the three semantic sample columns (x = -34, 0, +34).
  const horizontalLine = new THREE.BoxGeometry(toWorld(62), toWorld(0.26), toWorld(0.1));
  for (const y of [-32, -26, -20, 20, 26, 32]) {
    add("fine-horizontal-line", horizontalLine, etch, -3, y, plateLocalZ - 0.08);
  }
  const verticalLine = new THREE.BoxGeometry(toWorld(0.26), toWorld(62), toWorld(0.1));
  for (const x of [-25, -18, -11, 11, 18, 25]) {
    add("fine-vertical-line", verticalLine, etch, x, 0, plateLocalZ - 0.08);
  }

  const trace = new THREE.BoxGeometry(toWorld(14), toWorld(0.42), toWorld(0.12));
  const traceVertical = new THREE.BoxGeometry(toWorld(0.42), toWorld(14), toWorld(0.12));
  for (const y of MACRO_OBLIQUE_TARGET_Y_MM) {
    add("target-trace-horizontal", trace, accent, 20, y, plateLocalZ - 0.11);
    add("target-trace-vertical", traceVertical, accent, 20, y - 7, plateLocalZ - 0.11);
    add("target-trace-horizontal", trace, copper, -20, y + 7, plateLocalZ - 0.11, Math.PI / 12);
  }

  const registrationBar = new THREE.BoxGeometry(toWorld(1.1), toWorld(10), toWorld(0.16));
  for (const y of MACRO_OBLIQUE_TARGET_Y_MM) {
    add("registration-bar", registrationBar, edgeMetal, -45, y, plateLocalZ - 0.16);
    add("registration-cross-bar", registrationBar, edgeMetal, -45, y, plateLocalZ - 0.16, Math.PI / 2);
  }

  const detailRing = new THREE.TorusGeometry(toWorld(5.5), toWorld(0.24), 8, 64);
  const microDot = new THREE.SphereGeometry(toWorld(0.34), 8, 6);
  for (const y of MACRO_OBLIQUE_TARGET_Y_MM) {
    add("target-detail-ring", detailRing, copper, 20, y, plateLocalZ - 0.17);
    for (let index = 0; index < 8; index += 1) {
      const angle = (index * Math.PI * 2) / 8;
      add(
        "target-micro-dot",
        microDot,
        index % 2 === 0 ? edgeMetal : etch,
        20 + 4 * Math.cos(angle),
        y + 4 * Math.sin(angle),
        plateLocalZ - 0.2,
      );
    }
  }

  const notch = new THREE.BoxGeometry(toWorld(0.7), toWorld(4.5), toWorld(0.12));
  for (let index = 0; index < 18; index += 1) {
    const angle = (index * Math.PI * 2) / 18;
    const notchMesh = add(
      "radial-notch",
      notch,
      index % 3 === 0 ? copper : etch,
      0,
      0,
      plateLocalZ - 0.1,
      angle,
    );
    // The offset is intentionally applied in the plate's local XY plane.
    notchMesh.position.x += toWorld(25 * Math.cos(angle));
    notchMesh.position.y += toWorld(25 * Math.sin(angle));
  }

  const labelLine = new THREE.BoxGeometry(toWorld(12), toWorld(0.3), toWorld(0.1));
  for (let index = 0; index < 5; index += 1) {
    add("engraved-label-line", labelLine, etch, 16, -8 + index * 2.1, plateLocalZ - 0.07);
  }

  return root;
}

export const disposeMacroObliquePlaneGroup = (group: THREE.Group): void => {
  disposeTeachingSubjectResources(group);
};

export function MacroObliquePlaneSubject() {
  const group = useMemo(createMacroObliquePlaneGroup, []);
  useEffect(() => () => disposeMacroObliquePlaneGroup(group), [group]);
  return <primitive object={group} dispose={null} />;
}
