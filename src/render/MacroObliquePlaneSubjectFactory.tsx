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
} from "../scenes/macroObliquePlaneGeometry";

const plateLocalZ = -MACRO_OBLIQUE_PLATE_DIMENSIONS_MM.thickness / 2;
const pcbReliefCenterZ = plateLocalZ - 0.06;
const pcbReliefDepth = 0.08;
const pcbSilkscreenStrokeMm = 0.55;
const pcbTraceStrokeMm = 0.8;

type Segment = readonly [number, number, number, number];

const glyphSegments: Record<string, readonly Segment[]> = {
  "1": [[0.5, 0, 0.5, 1]],
  A: [[0, 0, 0.5, 1], [0.5, 1, 1, 0], [0.2, 0.42, 0.8, 0.42]],
  B: [[0, 0, 0, 1], [0, 1, 0.72, 1], [0.72, 1, 1, 0.78], [1, 0.78, 0.72, 0.52], [0.72, 0.52, 1, 0.25], [1, 0.25, 0.72, 0], [0.72, 0, 0, 0]],
  C: [[1, 1, 0.2, 1], [0.2, 1, 0, 0.75], [0, 0.75, 0, 0.25], [0, 0.25, 0.2, 0], [0.2, 0, 1, 0]],
  F: [[0, 0, 0, 1], [0, 1, 1, 1], [0, 0.5, 0.75, 0.5]],
  J: [[0.2, 1, 1, 1], [0.7, 1, 0.7, 0.15], [0.7, 0.15, 0.45, 0], [0.45, 0, 0, 0.15], [0, 0.15, 0, 0.35]],
  M: [[0, 0, 0, 1], [0, 1, 0.5, 0.45], [0.5, 0.45, 1, 1], [1, 1, 1, 0]],
  N: [[0, 0, 0, 1], [0, 1, 1, 0], [1, 0, 1, 1]],
  P: [[0, 0, 0, 1], [0, 1, 0.72, 1], [0.72, 1, 1, 0.75], [1, 0.75, 0.72, 0.5], [0.72, 0.5, 0, 0.5]],
  R: [[0, 0, 0, 1], [0, 1, 0.72, 1], [0.72, 1, 1, 0.75], [1, 0.75, 0.72, 0.5], [0.72, 0.5, 0, 0.5], [0.5, 0.5, 1, 0]],
  T: [[0, 1, 1, 1], [0.5, 1, 0.5, 0]],
  U: [[0, 1, 0, 0.2], [0, 0.2, 0.25, 0], [0.25, 0, 0.75, 0], [0.75, 0, 1, 0.2], [1, 0.2, 1, 1]],
};

function addGroup(parent: THREE.Object3D, name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  parent.add(group);
  return group;
}

function addMesh(
  parent: THREE.Object3D,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  xMm = 0,
  yMm = 0,
  zMm = 0,
  rotationZ = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(toWorld(xMm), toWorld(yMm), toWorld(zMm));
  mesh.rotation.z = rotationZ;
  parent.add(mesh);
  return mesh;
}

function addLine(
  parent: THREE.Object3D,
  name: string,
  material: THREE.Material,
  xMm: number,
  yMm: number,
  lengthMm: number,
  widthMm: number,
  zMm: number,
  rotationZ = 0,
): THREE.Mesh {
  return addMesh(
    parent,
    name,
    new THREE.BoxGeometry(toWorld(lengthMm), toWorld(widthMm), toWorld(pcbReliefDepth)),
    material,
    xMm,
    yMm,
    zMm,
    rotationZ,
  );
}

function addTraceSegment(
  parent: THREE.Object3D,
  name: string,
  material: THREE.Material,
  start: readonly [number, number],
  end: readonly [number, number],
  widthMm: number,
): THREE.Mesh {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthMm = Math.hypot(dx, dy);
  return addLine(
    parent,
    name,
    material,
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    lengthMm,
    widthMm,
    pcbReliefCenterZ,
    Math.atan2(dy, dx),
  );
}

function addSilkscreenRectangle(
  parent: THREE.Object3D,
  name: string,
  material: THREE.Material,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
): void {
  const halfWidth = widthMm / 2;
  const halfHeight = heightMm / 2;
  addLine(parent, `${name}-top`, material, xMm, yMm + halfHeight, widthMm, pcbSilkscreenStrokeMm, pcbReliefCenterZ);
  addLine(parent, `${name}-bottom`, material, xMm, yMm - halfHeight, widthMm, pcbSilkscreenStrokeMm, pcbReliefCenterZ);
  addLine(parent, `${name}-left`, material, xMm - halfWidth, yMm, heightMm, pcbSilkscreenStrokeMm, pcbReliefCenterZ, Math.PI / 2);
  addLine(parent, `${name}-right`, material, xMm + halfWidth, yMm, heightMm, pcbSilkscreenStrokeMm, pcbReliefCenterZ, Math.PI / 2);
}

function addGlyph(
  parent: THREE.Object3D,
  name: string,
  material: THREE.Material,
  glyph: string,
  xMm: number,
  yMm: number,
  widthMm = 4,
  heightMm = 5,
): void {
  const segments = glyphSegments[glyph];
  if (!segments) return;
  for (const [index, [x1, y1, x2, y2]] of segments.entries()) {
    addTraceSegment(
      parent,
      `${name}-${glyph}-${index}`,
      material,
      [xMm + x1 * widthMm, yMm + y1 * heightMm],
      [xMm + x2 * widthMm, yMm + y2 * heightMm],
      pcbSilkscreenStrokeMm,
    );
  }
}

function addPad(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
  xMm: number,
  yMm: number,
): void {
  addMesh(parent, name, geometry, material, xMm, yMm, pcbReliefCenterZ);
}

function addVia(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
  xMm: number,
  yMm: number,
): void {
  addMesh(parent, name, geometry, material, xMm, yMm, pcbReliefCenterZ, Math.PI / 2);
}

/** A shared, asymmetric, planar PCB subject for viewport and RTT. */
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

  const boardMaterial = createMacroMaterial({
    color: "#2a9557",
    roughness: 0.68,
    metalness: 0.02,
    seed: 101,
    roughnessVariation: 0.1,
    repeat: [8, 8],
  });
  const fiberglassMaterial = createMacroMaterial({
    color: "#bd9b68",
    roughness: 0.82,
    metalness: 0.04,
    seed: 103,
    roughnessVariation: 0.08,
    repeat: [4, 4],
  });
  const copperMaterial = createMacroMaterial({
    color: "#e19a4d",
    roughness: 0.38,
    metalness: 0.95,
    seed: 107,
    roughnessVariation: 0.12,
    repeat: [7, 5],
  });
  const goldMaterial = createMacroMaterial({
    color: "#f0c866",
    roughness: 0.28,
    metalness: 0.97,
    seed: 109,
    roughnessVariation: 0.08,
    repeat: [6, 4],
  });
  const silkscreenMaterial = createMacroMaterial({
    color: "#fffbe8",
    roughness: 0.76,
    metalness: 0,
    seed: 113,
    roughnessVariation: 0.06,
    repeat: [5, 5],
  });
  const viaMaterial = createMacroMaterial({
    color: "#111b1a",
    roughness: 0.58,
    metalness: 0.16,
    seed: 127,
    roughnessVariation: 0.1,
    repeat: [8, 8],
  });
  const recessMaterial = createMacroMaterial({
    color: "#092d20",
    roughness: 0.86,
    metalness: 0.02,
    seed: 131,
    roughnessVariation: 0.08,
    repeat: [4, 4],
  });

  const boardGroup = addGroup(plateAssembly, "macro-oblique-pcb-board");
  const padGroup = addGroup(plateAssembly, "macro-oblique-pcb-pad");
  const viaGroup = addGroup(plateAssembly, "macro-oblique-pcb-via");
  const traceGroup = addGroup(plateAssembly, "macro-oblique-pcb-trace");
  const silkscreenGroup = addGroup(plateAssembly, "macro-oblique-pcb-silkscreen");
  const nearZone = addGroup(silkscreenGroup, "macro-oblique-pcb-near-zone");
  const middleZone = addGroup(silkscreenGroup, "macro-oblique-pcb-middle-zone");
  const farZone = addGroup(silkscreenGroup, "macro-oblique-pcb-far-zone");

  addMesh(
    boardGroup,
    "macro-oblique-pcb-fiberglass-edge",
    new THREE.BoxGeometry(toWorld(113), toWorld(113), toWorld(2.8)),
    fiberglassMaterial,
    0,
    0,
    0.2,
  );
  addMesh(
    boardGroup,
    "macro-oblique-base-plate",
    new THREE.BoxGeometry(
      toWorld(MACRO_OBLIQUE_PLATE_DIMENSIONS_MM.x),
      toWorld(MACRO_OBLIQUE_PLATE_DIMENSIONS_MM.y),
      toWorld(MACRO_OBLIQUE_PLATE_DIMENSIONS_MM.thickness),
    ),
    boardMaterial,
  );
  addMesh(
    boardGroup,
    "macro-oblique-pcb-rear-support",
    new THREE.BoxGeometry(toWorld(102), toWorld(102), toWorld(1.8)),
    recessMaterial,
    0,
    0,
    2.2,
  );

  const postGeometry = new THREE.CylinderGeometry(toWorld(2.1), toWorld(2.1), toWorld(3.8), 20);
  postGeometry.rotateX(Math.PI / 2);
  for (const [xMm, yMm] of [[-48, -48], [48, -48], [-48, 48], [48, 48]] as const) {
    addMesh(boardGroup, "macro-oblique-pcb-rear-post", postGeometry, fiberglassMaterial, xMm, yMm, 3.2);
  }

  addSilkscreenRectangle(silkscreenGroup, "macro-oblique-pcb-board-outline", silkscreenMaterial, 0, 0, 106, 106);
  const mountingHoleGeometry = new THREE.CylinderGeometry(toWorld(2.8), toWorld(2.8), toWorld(0.12), 24);
  mountingHoleGeometry.rotateX(Math.PI / 2);
  for (const [xMm, yMm] of [[-49, -49], [49, -49], [-49, 49], [49, 49]] as const) {
    addVia(viaGroup, mountingHoleGeometry, viaMaterial, "macro-oblique-pcb-mounting-hole", xMm, yMm);
  }

  const padGeometry = new THREE.BoxGeometry(toWorld(3.6), toWorld(2.2), toWorld(0.1));
  const smallPadGeometry = new THREE.BoxGeometry(toWorld(2.3), toWorld(1.6), toWorld(0.1));
  const viaGeometry = new THREE.CylinderGeometry(toWorld(0.95), toWorld(0.95), toWorld(0.12), 16);
  viaGeometry.rotateX(Math.PI / 2);

  // Near zone: an asymmetric connector and test-pad bank.
  addSilkscreenRectangle(nearZone, "macro-oblique-pcb-j1-footprint", silkscreenMaterial, 0, -52.8, 68, 8);
  addGlyph(nearZone, "macro-oblique-pcb-j1-label", silkscreenMaterial, "J", -41, -42);
  addGlyph(nearZone, "macro-oblique-pcb-tp1-label", silkscreenMaterial, "1", -16, -42);
  for (const xMm of [-28, -21, -14, -7, 0, 7, 14, 21, 28]) {
    addPad(padGroup, padGeometry, goldMaterial, "macro-oblique-pcb-connector-pad", xMm, -51);
    addPad(padGroup, padGeometry, copperMaterial, "macro-oblique-pcb-connector-pad", xMm, -55);
  }
  addTraceSegment(traceGroup, "macro-oblique-pcb-near-bus", copperMaterial, [-40, -37], [40, -37], 1.05);
  for (const xMm of [-37, -29, -21, -13, -5, 5, 13, 21, 29, 37]) {
    addVia(viaGroup, viaGeometry, viaMaterial, "macro-oblique-pcb-near-via", xMm, -31);
  }

  // Middle zone: a high-contrast U1 footprint and a dense, still-planar pad field.
  addMesh(
    middleZone,
    "macro-oblique-pcb-u1-recess",
    new THREE.BoxGeometry(toWorld(24), toWorld(22), toWorld(0.08)),
    recessMaterial,
    18,
    0,
    pcbReliefCenterZ,
  );
  addSilkscreenRectangle(middleZone, "macro-oblique-pcb-u1-outline", silkscreenMaterial, 18, 0, 31, 29);
  addGlyph(middleZone, "macro-oblique-pcb-u1-label", silkscreenMaterial, "U", 7, -17);
  addGlyph(middleZone, "macro-oblique-pcb-u1-number", silkscreenMaterial, "1", 13, -17);
  for (const xMm of [3, 33]) {
    for (const yMm of [-11, -8, -5, 5, 8, 11]) {
      addPad(padGroup, padGeometry, copperMaterial, "macro-oblique-pcb-u1-pad", xMm, yMm);
    }
  }
  for (const xMm of [11, 17, 23]) {
    for (const yMm of [-9, -5, 5, 9]) {
      addPad(padGroup, smallPadGeometry, goldMaterial, "macro-oblique-pcb-u1-bga-pad", xMm, yMm);
    }
  }
  addTraceSegment(traceGroup, "macro-oblique-pcb-middle-bus-left", copperMaterial, [-27, 15], [4, 15], pcbTraceStrokeMm);
  addTraceSegment(traceGroup, "macro-oblique-pcb-middle-bus-right", copperMaterial, [32, -15], [48, -15], pcbTraceStrokeMm);

  // Far zone: a fan-out field and deliberately different silkscreen landmarks.
  addSilkscreenRectangle(farZone, "macro-oblique-pcb-far-footprint", silkscreenMaterial, -22, 36, 22, 12);
  addGlyph(farZone, "macro-oblique-pcb-tp1-far-label", silkscreenMaterial, "1", -45, 32);
  addGlyph(farZone, "macro-oblique-pcb-far-marker", silkscreenMaterial, "F", 42, 44);
  for (const xMm of [-30, -24, -18, -12]) {
    addPad(padGroup, smallPadGeometry, goldMaterial, "macro-oblique-pcb-far-pad", xMm, 35);
    addPad(padGroup, smallPadGeometry, copperMaterial, "macro-oblique-pcb-far-pad", xMm, 41);
  }
  for (const [index, xMm] of [8, 14, 20, 26, 32].entries()) {
    addTraceSegment(traceGroup, `macro-oblique-pcb-fanout-${index}`, goldMaterial, [xMm, 20], [xMm + 5, 39], 0.82);
    addTraceSegment(traceGroup, `macro-oblique-pcb-fanout-fine-${index}`, copperMaterial, [xMm + 1.6, 20], [xMm + 5.6, 39], 0.52);
  }
  for (const [xMm, yMm] of [[-40, 28], [-33, 28], [38, 31], [45, 31], [-42, 39], [45, 39]] as const) {
    addVia(viaGroup, viaGeometry, viaMaterial, "macro-oblique-pcb-far-via", xMm, yMm);
  }

  // Board-wide routing and asymmetric reference marks keep orientation readable.
  addTraceSegment(traceGroup, "macro-oblique-pcb-left-bus", copperMaterial, [-46, -25], [-46, 22], 1.1);
  addTraceSegment(traceGroup, "macro-oblique-pcb-right-bus", goldMaterial, [46, -28], [46, 22], 0.8);
  addTraceSegment(traceGroup, "macro-oblique-pcb-upper-bus", copperMaterial, [-40, 24], [-4, 24], 0.82);
  addTraceSegment(traceGroup, "macro-oblique-pcb-lower-bus", copperMaterial, [4, -24], [40, -24], 0.82);
  addSilkscreenRectangle(silkscreenGroup, "macro-oblique-pcb-corner-marker", silkscreenMaterial, -45, 45, 7, 7);
  addGlyph(silkscreenGroup, "macro-oblique-pcb-north-marker", silkscreenMaterial, "N", -50, 20);
  addGlyph(silkscreenGroup, "macro-oblique-pcb-middle-marker", silkscreenMaterial, "M", 34, -38);
  for (const yMm of [-29, -23, 22, 28]) {
    addLine(silkscreenGroup, "macro-oblique-pcb-scale-mark", silkscreenMaterial, -4, yMm, 18, 0.3, pcbReliefCenterZ);
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
