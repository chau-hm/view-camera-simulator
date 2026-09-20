/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { disposeTeachingSubjectResources } from "./TeachingMaterials";
import { createMacroMaterial } from "./MacroSubjectMaterials";
import { toWorld } from "./rttUtils";
import {
  macroCompoundMovementsFocusFaceTransforms,
  macroCompoundMovementsStationSpecs,
  type MacroCompoundStationSpec,
} from "../scenes/macroCompoundMovementsGeometry";

const localVector = (value: { x: number; y: number; z: number }): THREE.Vector3 =>
  new THREE.Vector3(value.x, value.y, value.z);

const createStationTransform = (station: MacroCompoundStationSpec): THREE.Group => {
  const group = new THREE.Group();
  const transform = macroCompoundMovementsFocusFaceTransforms.find(
    (candidate) => candidate.targetId === station.targetId,
  );
  if (!transform) throw new Error(`Missing compound focus face for ${station.targetId}`);

  group.name = `macro-compound-${station.id}-station`;
  group.position.set(
    toWorld(transform.centerMm.x),
    toWorld(transform.centerMm.y),
    toWorld(transform.centerMm.z),
  );
  const basis = new THREE.Matrix4().makeBasis(
    localVector(transform.basisU),
    localVector(transform.basisV),
    localVector(transform.normal),
  );
  group.quaternion.setFromRotationMatrix(basis);
  return group;
};

const addBox = (
  parent: THREE.Object3D,
  name: string,
  material: THREE.Material,
  dimensionsMm: { x: number; y: number; z: number },
  positionMm: { u: number; v: number; z: number },
  rotationZ = 0,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(dimensionsMm.x),
      toWorld(dimensionsMm.y),
      toWorld(dimensionsMm.z),
    ),
    material,
  );
  mesh.name = name;
  mesh.position.set(
    toWorld(positionMm.u),
    toWorld(positionMm.v),
    toWorld(positionMm.z),
  );
  mesh.rotation.z = rotationZ;
  parent.add(mesh);
  return mesh;
};

const addCylinder = (
  parent: THREE.Object3D,
  name: string,
  material: THREE.Material,
  radiusMm: number,
  depthMm: number,
  positionMm: { u: number; v: number; z: number },
  segments = 32,
): THREE.Mesh => {
  const geometry = new THREE.CylinderGeometry(
    toWorld(radiusMm),
    toWorld(radiusMm),
    toWorld(depthMm),
    segments,
  );
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(
    toWorld(positionMm.u),
    toWorld(positionMm.v),
    toWorld(positionMm.z),
  );
  parent.add(mesh);
  return mesh;
};

const addRing = (
  parent: THREE.Object3D,
  name: string,
  material: THREE.Material,
  radiusMm: number,
  tubeMm: number,
  positionMm: { u: number; v: number; z: number },
  segments = 64,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(toWorld(radiusMm), toWorld(tubeMm), 10, segments),
    material,
  );
  mesh.name = name;
  mesh.position.set(
    toWorld(positionMm.u),
    toWorld(positionMm.v),
    toWorld(positionMm.z),
  );
  parent.add(mesh);
  return mesh;
};

const addRaisedLine = (
  parent: THREE.Object3D,
  name: string,
  material: THREE.Material,
  start: { u: number; v: number },
  end: { u: number; v: number },
  widthMm: number,
  depthMm = 0.24,
  zMm = -0.18,
): THREE.Mesh => {
  const dx = end.u - start.u;
  const dy = end.v - start.v;
  const lengthMm = Math.hypot(dx, dy);
  return addBox(
    parent,
    name,
    material,
    { x: lengthMm, y: widthMm, z: depthMm },
    {
      u: (start.u + end.u) / 2,
      v: (start.v + end.v) / 2,
      z: zMm,
    },
    Math.atan2(dy, dx),
  );
};

const addStationBackplate = (
  stationGroup: THREE.Group,
  station: MacroCompoundStationSpec,
  material: THREE.Material,
): void => {
  addBox(
    stationGroup,
    `macro-compound-${station.id}-focus-face`,
    material,
    {
      x: station.faceWidthMm,
      y: station.faceHeightMm,
      z: station.faceThicknessMm,
    },
    { u: 0, v: 0, z: station.faceThicknessMm / 2 },
  );
  addBox(
    stationGroup,
    `macro-compound-${station.id}-body`,
    material,
    { x: station.faceWidthMm - 4, y: station.faceHeightMm - 4, z: 7.2 },
    { u: 0, v: 0, z: station.faceThicknessMm + 3.6 },
  );
  addBox(
    stationGroup,
    `macro-compound-${station.id}-pedestal`,
    material,
    { x: station.faceWidthMm - 12, y: 9, z: 8 },
    { u: 0, v: -station.faceHeightMm / 2 - 6, z: station.faceThicknessMm + 8 },
  );
  addBox(
    stationGroup,
    `macro-compound-${station.id}-support-arm`,
    material,
    { x: 9, y: 28, z: 7 },
    { u: 0, v: -station.faceHeightMm / 2 - 20, z: station.faceThicknessMm + 8 },
  );
};

const addNearLeftGearScale = (
  stationGroup: THREE.Group,
  station: MacroCompoundStationSpec,
  brass: THREE.Material,
  dark: THREE.Material,
  accent: THREE.Material,
): void => {
  addRing(
    stationGroup,
    `macro-compound-${station.id}-gear-rim`,
    brass,
    19.2,
    1.35,
    { u: 0, v: 0, z: -0.22 },
  );
  addRing(
    stationGroup,
    `macro-compound-${station.id}-inner-engraving`,
    dark,
    6.2,
    0.55,
    { u: 0, v: 1, z: -0.23 },
  );
  addCylinder(
    stationGroup,
    `macro-compound-${station.id}-hub`,
    brass,
    3.2,
    0.6,
    { u: 0, v: 1, z: -0.36 },
    24,
  );
  for (const [index, u] of [-18, -12, -6, 6, 12, 18].entries()) {
    addRaisedLine(
      stationGroup,
      `macro-compound-${station.id}-scale-tick-${index}`,
      accent,
      { u, v: 13 },
      { u, v: index % 2 === 0 ? 17 : 15 },
      0.55,
    );
  }
  addRaisedLine(
    stationGroup,
    `macro-compound-${station.id}-scale-baseline`,
    accent,
    { u: -20, v: 12 },
    { u: 20, v: 12 },
    0.42,
  );
  addRaisedLine(
    stationGroup,
    `macro-compound-${station.id}-datum-line`,
    dark,
    { u: -17, v: 3 },
    { u: -17, v: 9 },
    0.5,
  );
  for (const [index, u] of [-11, -5, 5, 11].entries()) {
    addBox(
      stationGroup,
      `macro-compound-${station.id}-engraved-slot-${index}`,
      dark,
      { x: 2.2, y: 0.6, z: 0.18 },
      { u, v: -1, z: -0.2 },
      Math.PI / 2,
    );
  }
};

const addCentreConcentricTarget = (
  stationGroup: THREE.Group,
  station: MacroCompoundStationSpec,
  brass: THREE.Material,
  dark: THREE.Material,
  light: THREE.Material,
): void => {
  addRing(
    stationGroup,
    `macro-compound-${station.id}-outer-bezel`,
    brass,
    17.5,
    1.0,
    { u: 0, v: 0, z: -0.22 },
  );
  addRing(
    stationGroup,
    `macro-compound-${station.id}-target-ring-a`,
    dark,
    8.5,
    0.55,
    { u: 0, v: 0, z: -0.25 },
  );
  addRing(
    stationGroup,
    `macro-compound-${station.id}-target-ring-b`,
    light,
    4.5,
    0.32,
    { u: 0, v: 0, z: -0.26 },
  );
  addRaisedLine(
    stationGroup,
    `macro-compound-${station.id}-crosshair-horizontal`,
    dark,
    { u: -14, v: 0 },
    { u: 14, v: 0 },
    0.42,
  );
  addRaisedLine(
    stationGroup,
    `macro-compound-${station.id}-crosshair-vertical`,
    dark,
    { u: 0, v: -9 },
    { u: 0, v: 9 },
    0.42,
  );
  for (const [index, u] of [-16, -12, 12, 16].entries()) {
    addBox(
      stationGroup,
      `macro-compound-${station.id}-target-mark-${index}`,
      brass,
      { x: 1.1, y: 3.6, z: 0.2 },
      { u, v: 0, z: -0.22 },
    );
  }
};

const addFarRightFineArray = (
  stationGroup: THREE.Group,
  station: MacroCompoundStationSpec,
  brass: THREE.Material,
  dark: THREE.Material,
  accent: THREE.Material,
): void => {
  addRing(
    stationGroup,
    `macro-compound-${station.id}-array-bezel`,
    brass,
    18.2,
    0.9,
    { u: 0, v: 0, z: -0.22 },
  );
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const u = -8 + column * 4;
      const v = -1 + row * 4;
      addBox(
        stationGroup,
        `macro-compound-${station.id}-pad-${row}-${column}`,
        column % 2 === row % 2 ? brass : accent,
        { x: 2.1, y: 2.1, z: 0.22 },
        { u, v, z: -0.24 },
      );
    }
  }
  for (const [index, v] of [11, 14, 17].entries()) {
    addRaisedLine(
      stationGroup,
      `macro-compound-${station.id}-array-trace-${index}`,
      dark,
      { u: -16, v },
      { u: 16, v },
      0.42,
    );
  }
  addRaisedLine(
    stationGroup,
    `macro-compound-${station.id}-array-axis`,
    dark,
    { u: -17, v: -8 },
    { u: 17, v: -8 },
    0.48,
  );
};

/** Shared precision-station subject used by the 3D observer and Ground Glass RTT. */
export function createMacroCompoundMovementsGroup(): THREE.Group {
  const root = new THREE.Group();
  root.name = "macro-compound-movements-subject";

  const chassis = createMacroMaterial({
    color: "#263238",
    roughness: 0.68,
    metalness: 0.22,
    seed: 211,
    roughnessVariation: 0.14,
    repeat: [5, 3],
  });
  const machined = createMacroMaterial({
    color: "#9aa6a8",
    roughness: 0.34,
    metalness: 0.86,
    seed: 223,
    roughnessVariation: 0.1,
    repeat: [9, 7],
  });
  const bronze = createMacroMaterial({
    color: "#c98d45",
    roughness: 0.3,
    metalness: 0.92,
    seed: 227,
    roughnessVariation: 0.1,
    repeat: [8, 6],
  });
  const brass = createMacroMaterial({
    color: "#e2b45d",
    roughness: 0.28,
    metalness: 0.94,
    seed: 229,
    roughnessVariation: 0.08,
    repeat: [7, 7],
  });
  const dark = createMacroMaterial({
    color: "#152027",
    roughness: 0.82,
    metalness: 0.16,
    seed: 233,
    roughnessVariation: 0.12,
    repeat: [12, 8],
  });
  const accent = createMacroMaterial({
    color: "#4fb6b0",
    roughness: 0.42,
    metalness: 0.28,
    seed: 239,
    roughnessVariation: 0.1,
    repeat: [8, 8],
  });
  const ivory = createMacroMaterial({
    color: "#d9d0b7",
    roughness: 0.6,
    metalness: 0.05,
    seed: 241,
    roughnessVariation: 0.08,
    repeat: [6, 6],
  });

  addBox(
    root,
    "macro-compound-fixture-rail",
    chassis,
    { x: 222, y: 8, z: 10 },
    { u: 0, v: -61, z: 514 },
  );
  addBox(
    root,
    "macro-compound-fixture-rail-top",
    machined,
    { x: 214, y: 2.4, z: 1.1 },
    { u: 0, v: -56.4, z: 508.2 },
  );

  for (const station of macroCompoundMovementsStationSpecs) {
    const stationGroup = createStationTransform(station);
    root.add(stationGroup);
    const stationFaceMaterial = station.kind === "gear-scale" ? machined : ivory;
    addStationBackplate(stationGroup, station, stationFaceMaterial);

    if (station.kind === "gear-scale") {
      addNearLeftGearScale(stationGroup, station, bronze, dark, brass);
    } else if (station.kind === "concentric-target") {
      addCentreConcentricTarget(stationGroup, station, brass, dark, machined);
    } else {
      addFarRightFineArray(stationGroup, station, brass, dark, accent);
    }

    for (const [index, { u, v }] of [
      { u: -20, v: -16 },
      { u: 20, v: -16 },
    ].entries()) {
      addCylinder(
        stationGroup,
        `macro-compound-${station.id}-fastener-${index}`,
        brass,
        1.4,
        0.42,
        { u, v, z: -0.29 },
        20,
      );
    }
  }

  return root;
}

export const disposeMacroCompoundMovementsGroup = (group: THREE.Group): void => {
  disposeTeachingSubjectResources(group);
};

export function MacroCompoundMovementsSubject() {
  const group = useMemo(createMacroCompoundMovementsGroup, []);
  useEffect(() => () => disposeMacroCompoundMovementsGroup(group), [group]);
  return <primitive object={group} dispose={null} />;
}
