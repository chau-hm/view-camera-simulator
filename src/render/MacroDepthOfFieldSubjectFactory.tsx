/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { toWorld } from "./rttUtils";
import { disposeTeachingSubjectResources } from "./TeachingMaterials";
import { createMacroMaterial } from "./MacroSubjectMaterials";
import {
  MACRO_DEPTH_BASE_CENTER_MM,
  MACRO_DEPTH_BASE_DIMENSIONS_MM,
  MACRO_DEPTH_BRIDGE_CENTER_MM,
  MACRO_DEPTH_BRIDGE_DIMENSIONS_MM,
  MACRO_DEPTH_FRONT_LIP_CENTER_MM,
  MACRO_DEPTH_FRONT_LIP_DIMENSIONS_MM,
  MACRO_DEPTH_FOCUS_ZONE_SPECS,
  MACRO_DEPTH_SPECIMEN_CENTER_MM,
  MACRO_DEPTH_STATION_BODY_CENTER_OFFSET_MM,
  MACRO_DEPTH_STATION_BODY_DEPTH_MM,
  MACRO_DEPTH_STATION_BODY_RADIUS_MM,
  MACRO_DEPTH_STATION_SUPPORT_DIMENSIONS_MM,
  MACRO_DEPTH_STATION_SUPPORT_OVERLAP_MM,
  MACRO_DEPTH_STATION_FACE_RADIUS_MM,
  MACRO_DEPTH_STATION_FACE_THICKNESS_MM,
  MACRO_DEPTH_STATION_INNER_RING_RADIUS_MM,
  MACRO_DEPTH_STATION_INNER_RING_TUBE_MM,
  MACRO_DEPTH_STATION_OUTER_RING_RADIUS_MM,
  MACRO_DEPTH_STATION_OUTER_RING_TUBE_MM,
} from "../scenes/macroDepthOfFieldGeometry";

/** A single connected fictional precision inspection mechanism. */
export function createMacroDepthOfFieldGroup(): THREE.Group {
  const root = new THREE.Group();
  root.name = "macro-depth-of-field-subject";
  root.position.set(
    toWorld(MACRO_DEPTH_SPECIMEN_CENTER_MM.x),
    toWorld(MACRO_DEPTH_SPECIMEN_CENTER_MM.y),
    toWorld(MACRO_DEPTH_SPECIMEN_CENTER_MM.z),
  );

  const chassis = createMacroMaterial({
    color: "#3c5661",
    roughness: 0.58,
    metalness: 0.14,
    seed: 41,
    roughnessVariation: 0.12,
    repeat: [4, 3],
  });
  const stationBody = createMacroMaterial({
    color: "#66808a",
    roughness: 0.38,
    metalness: 0.42,
    seed: 47,
    roughnessVariation: 0.1,
    repeat: [8, 3],
  });
  const face = createMacroMaterial({
    color: "#d6e0e1",
    roughness: 0.34,
    metalness: 0.38,
    seed: 53,
    roughnessVariation: 0.08,
    repeat: [10, 10],
  });
  const detail = createMacroMaterial({
    color: "#e0a451",
    roughness: 0.36,
    metalness: 0.46,
    seed: 59,
    roughnessVariation: 0.1,
    repeat: [8, 6],
  });
  const accent = createMacroMaterial({
    color: "#62c8c4",
    roughness: 0.4,
    metalness: 0.28,
    seed: 61,
    roughnessVariation: 0.11,
    repeat: [6, 6],
  });
  const groove = createMacroMaterial({
    color: "#22333b",
    roughness: 0.8,
    metalness: 0.05,
    seed: 67,
    roughnessVariation: 0.14,
    repeat: [12, 4],
  });

  const add = (
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    positionMm: { x: number; y: number; z: number },
    rotationZ = 0,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `macro-depth-${name}`;
    mesh.position.set(
      toWorld(positionMm.x - MACRO_DEPTH_SPECIMEN_CENTER_MM.x),
      toWorld(positionMm.y - MACRO_DEPTH_SPECIMEN_CENTER_MM.y),
      toWorld(positionMm.z - MACRO_DEPTH_SPECIMEN_CENTER_MM.z),
    );
    mesh.rotation.z = rotationZ;
    root.add(mesh);
    return mesh;
  };

  add(
    "chassis",
    new THREE.BoxGeometry(
      toWorld(MACRO_DEPTH_BASE_DIMENSIONS_MM.x),
      toWorld(MACRO_DEPTH_BASE_DIMENSIONS_MM.y),
      toWorld(MACRO_DEPTH_BASE_DIMENSIONS_MM.z),
    ),
    chassis,
    MACRO_DEPTH_BASE_CENTER_MM,
  );
  add(
    "bridge",
    new THREE.BoxGeometry(
      toWorld(MACRO_DEPTH_BRIDGE_DIMENSIONS_MM.x),
      toWorld(MACRO_DEPTH_BRIDGE_DIMENSIONS_MM.y),
      toWorld(MACRO_DEPTH_BRIDGE_DIMENSIONS_MM.z),
    ),
    chassis,
    MACRO_DEPTH_BRIDGE_CENTER_MM,
  );
  add(
    "front-lip",
    new THREE.BoxGeometry(
      toWorld(MACRO_DEPTH_FRONT_LIP_DIMENSIONS_MM.x),
      toWorld(MACRO_DEPTH_FRONT_LIP_DIMENSIONS_MM.y),
      toWorld(MACRO_DEPTH_FRONT_LIP_DIMENSIONS_MM.z),
    ),
    detail,
    MACRO_DEPTH_FRONT_LIP_CENTER_MM,
  );

  const bodyGeometry = new THREE.CylinderGeometry(
    toWorld(MACRO_DEPTH_STATION_BODY_RADIUS_MM),
    toWorld(MACRO_DEPTH_STATION_BODY_RADIUS_MM),
    toWorld(MACRO_DEPTH_STATION_BODY_DEPTH_MM),
    64,
  );
  bodyGeometry.rotateX(Math.PI / 2);
  const faceGeometry = new THREE.CylinderGeometry(
    toWorld(MACRO_DEPTH_STATION_FACE_RADIUS_MM),
    toWorld(MACRO_DEPTH_STATION_FACE_RADIUS_MM),
    toWorld(MACRO_DEPTH_STATION_FACE_THICKNESS_MM),
    64,
  );
  faceGeometry.rotateX(Math.PI / 2);
  const outerRingGeometry = new THREE.TorusGeometry(
    toWorld(MACRO_DEPTH_STATION_OUTER_RING_RADIUS_MM),
    toWorld(MACRO_DEPTH_STATION_OUTER_RING_TUBE_MM),
    10,
    64,
  );
  const innerRingGeometry = new THREE.TorusGeometry(
    toWorld(MACRO_DEPTH_STATION_INNER_RING_RADIUS_MM),
    toWorld(MACRO_DEPTH_STATION_INNER_RING_TUBE_MM),
    10,
    64,
  );
  const bezelGeometry = new THREE.TorusGeometry(toWorld(10.1), toWorld(0.5), 12, 96);
  const faceTrimGeometry = new THREE.TorusGeometry(toWorld(8.45), toWorld(0.18), 10, 96);
  const centerRingGeometry = new THREE.TorusGeometry(toWorld(3.55), toWorld(0.2), 10, 64);
  const machiningBandGeometry = new THREE.TorusGeometry(toWorld(5.05), toWorld(0.11), 8, 64);
  const radialSlotGeometry = new THREE.BoxGeometry(toWorld(0.55), toWorld(3.4), toWorld(0.18));
  const toothGeometry = new THREE.BoxGeometry(toWorld(0.72), toWorld(2.1), toWorld(0.22));
  const radialRibGeometry = new THREE.BoxGeometry(toWorld(0.34), toWorld(2.5), toWorld(0.16));
  const knurlGeometry = new THREE.BoxGeometry(toWorld(0.45), toWorld(1.15), toWorld(0.32));
  const screwGeometry = new THREE.CylinderGeometry(toWorld(1.35), toWorld(1.35), toWorld(0.5), 24);
  screwGeometry.rotateX(Math.PI / 2);
  const screwSlotGeometry = new THREE.BoxGeometry(toWorld(0.35), toWorld(2.1), toWorld(0.12));
  const fineSlotGeometry = new THREE.BoxGeometry(toWorld(5.4), toWorld(0.32), toWorld(0.14));
  const microDotGeometry = new THREE.SphereGeometry(toWorld(0.16), 8, 6);
  const faceFastenerGeometry = new THREE.CylinderGeometry(toWorld(0.58), toWorld(0.58), toWorld(0.24), 20);
  faceFastenerGeometry.rotateX(Math.PI / 2);
  const faceFastenerSlotGeometry = new THREE.BoxGeometry(toWorld(0.18), toWorld(0.95), toWorld(0.1));
  const bridgeFastenerGeometry = new THREE.CylinderGeometry(toWorld(1.15), toWorld(1.15), toWorld(0.6), 24);
  bridgeFastenerGeometry.rotateX(Math.PI / 2);
  const chassisFastenerGeometry = new THREE.CylinderGeometry(toWorld(0.8), toWorld(0.8), toWorld(0.42), 20);
  chassisFastenerGeometry.rotateX(Math.PI / 2);

  MACRO_DEPTH_FOCUS_ZONE_SPECS.forEach((zone, stationIndex) => {
    const { x, y } = zone.centerMm;
    const surfaceZ = zone.surfaceZMm;
    add(
      `station-${stationIndex}-body`,
      bodyGeometry,
      stationBody,
      { x, y, z: surfaceZ + MACRO_DEPTH_STATION_BODY_CENTER_OFFSET_MM },
    );

    const bodyRearZMm =
      surfaceZ +
      MACRO_DEPTH_STATION_BODY_CENTER_OFFSET_MM +
      MACRO_DEPTH_STATION_BODY_DEPTH_MM / 2;
    const bridgeFrontZMm =
      MACRO_DEPTH_BRIDGE_CENTER_MM.z - MACRO_DEPTH_BRIDGE_DIMENSIONS_MM.z / 2;
    const supportStartZMm = bodyRearZMm - MACRO_DEPTH_STATION_SUPPORT_OVERLAP_MM;
    const supportEndZMm = bridgeFrontZMm + MACRO_DEPTH_STATION_SUPPORT_OVERLAP_MM;
    add(
      `station-${stationIndex}-support`,
      new THREE.BoxGeometry(
        toWorld(MACRO_DEPTH_STATION_SUPPORT_DIMENSIONS_MM.x),
        toWorld(MACRO_DEPTH_STATION_SUPPORT_DIMENSIONS_MM.y),
        toWorld(supportEndZMm - supportStartZMm),
      ),
      chassis,
      { x, y, z: (supportStartZMm + supportEndZMm) / 2 },
    );
    add(
      `station-${stationIndex}-face`,
      faceGeometry,
      face,
      { x, y, z: surfaceZ + MACRO_DEPTH_STATION_FACE_THICKNESS_MM / 2 },
    );
    add(
      `station-${stationIndex}-outer-ring`,
      outerRingGeometry,
      detail,
      { x, y, z: surfaceZ - MACRO_DEPTH_STATION_OUTER_RING_TUBE_MM },
    );
    add(
      `station-${stationIndex}-inner-ring`,
      innerRingGeometry,
      accent,
      { x, y, z: surfaceZ - MACRO_DEPTH_STATION_INNER_RING_TUBE_MM },
    );
    add(
      `station-${stationIndex}-bezel`,
      bezelGeometry,
      stationBody,
      { x, y, z: surfaceZ - 0.18 },
    );
    add(
      `station-${stationIndex}-face-trim`,
      faceTrimGeometry,
      face,
      { x, y, z: surfaceZ - 0.16 },
    );
    add(
      `station-${stationIndex}-center-ring`,
      centerRingGeometry,
      detail,
      { x, y, z: surfaceZ - 0.14 },
    );
    add(
      `station-${stationIndex}-machining-band`,
      machiningBandGeometry,
      groove,
      { x, y, z: surfaceZ - 0.12 },
    );

    for (let index = 0; index < 16; index += 1) {
      const angle = (index * Math.PI * 2) / 16;
      const radius = 7.85;
      add(
        `station-${stationIndex}-gear-tooth-${index}`,
        toothGeometry,
        index % 2 === 0 ? detail : accent,
        {
          x: x + radius * Math.cos(angle),
          y: y + radius * Math.sin(angle),
          z: surfaceZ - 0.11,
        },
        angle,
      );
    }

    for (let index = 0; index < 24; index += 1) {
      const angle = (index * Math.PI * 2) / 24 + Math.PI / 48;
      const radius = 6.65;
      const rib = add(
        `station-${stationIndex}-machining-rib-${index}`,
        radialRibGeometry,
        index % 4 === 0 ? accent : groove,
        {
          x: x + radius * Math.cos(angle),
          y: y + radius * Math.sin(angle),
          z: surfaceZ - 0.08,
        },
        angle,
      );
      rib.scale.y = index % 3 === 0 ? 0.72 : 1;
    }

    for (let index = 0; index < 32; index += 1) {
      const angle = (index * Math.PI * 2) / 32;
      const knurl = add(
        `station-${stationIndex}-knurl-${index}`,
        knurlGeometry,
        index % 5 === 0 ? detail : stationBody,
        {
          x: x + 11.3 * Math.cos(angle),
          y: y + 11.3 * Math.sin(angle),
          z: surfaceZ + 1.18,
        },
        angle,
      );
      knurl.scale.y = index % 4 === 0 ? 0.8 : 1;
    }

    for (let index = 0; index < 6; index += 1) {
      const angle = (index * Math.PI * 2) / 6 + Math.PI / 6;
      const fastenerX = x + 7.1 * Math.cos(angle);
      const fastenerY = y + 7.1 * Math.sin(angle);
      add(
        `station-${stationIndex}-face-fastener-${index}`,
        faceFastenerGeometry,
        detail,
        { x: fastenerX, y: fastenerY, z: surfaceZ - 0.18 },
      );
      const slot = add(
        `station-${stationIndex}-face-fastener-slot-${index}`,
        faceFastenerSlotGeometry,
        groove,
        { x: fastenerX, y: fastenerY, z: surfaceZ - 0.33 },
        angle,
      );
      slot.scale.y = index % 2 === 0 ? 0.85 : 1;
    }

    for (let index = 0; index < 12; index += 1) {
      const angle = (index * Math.PI * 2) / 12;
      const radius = 5.85;
      add(
        `station-${stationIndex}-radial-groove-${index}`,
        radialSlotGeometry,
        groove,
        {
          x: x + radius * Math.cos(angle),
          y: y + radius * Math.sin(angle),
          z: surfaceZ - 0.09,
        },
        angle,
      );
    }

    const screwX = x + 0.3;
    const screwY = y + 4.25;
    add(
      `station-${stationIndex}-screw-head`,
      screwGeometry,
      detail,
      { x: screwX, y: screwY, z: surfaceZ - 0.25 },
    );
    add(
      `station-${stationIndex}-screw-slot-a`,
      screwSlotGeometry,
      groove,
      { x: screwX, y: screwY, z: surfaceZ - 0.52 },
    );
    add(
      `station-${stationIndex}-screw-slot-b`,
      screwSlotGeometry,
      groove,
      { x: screwX, y: screwY, z: surfaceZ - 0.53 },
      Math.PI / 2,
    );
    add(
      `station-${stationIndex}-fine-slot`,
      fineSlotGeometry,
      groove,
      { x, y: y - 4.2, z: surfaceZ - 0.07 },
    );

    for (let index = 0; index < 8; index += 1) {
      const angle = (index * Math.PI * 2) / 8 + Math.PI / 8;
      const radius = 2.95;
      add(
        `station-${stationIndex}-micro-dot-${index}`,
        microDotGeometry,
        index % 2 === 0 ? accent : groove,
        {
          x: x + radius * Math.cos(angle),
          y: y + radius * Math.sin(angle),
          z: surfaceZ - 0.16,
        },
      );
    }
  });

  for (const x of [-46, 46]) {
    add(
      `bridge-fastener-${x < 0 ? "left" : "right"}`,
      bridgeFastenerGeometry,
      detail,
      { x, y: 5, z: MACRO_DEPTH_BRIDGE_CENTER_MM.z - MACRO_DEPTH_BRIDGE_DIMENSIONS_MM.z / 2 - 0.18 },
    );
  }

  const bridgeRailGeometry = new THREE.BoxGeometry(toWorld(92), toWorld(0.9), toWorld(0.9));
  add("bridge-top-rail", bridgeRailGeometry, stationBody, { x: 0, y: 6.55, z: 415.45 });

  for (const x of [-44, 44]) {
    add(
      `chassis-fastener-${x < 0 ? "left" : "right"}`,
      chassisFastenerGeometry,
      detail,
      { x, y: -11, z: MACRO_DEPTH_BASE_CENTER_MM.z - MACRO_DEPTH_BASE_DIMENSIONS_MM.z / 2 - 0.2 },
    );
  }

  const chassisRailGeometry = new THREE.BoxGeometry(toWorld(3.2), toWorld(18), toWorld(1.2));
  add("chassis-rail-left", chassisRailGeometry, groove, { x: -44, y: -10, z: 419.1 });
  add("chassis-rail-right", chassisRailGeometry, groove, { x: 44, y: -10, z: 419.1 });

  return root;
}

export const disposeMacroDepthOfFieldGroup = (group: THREE.Group): void => {
  disposeTeachingSubjectResources(group);
};

export function MacroDepthOfFieldSubject() {
  const group = useMemo(createMacroDepthOfFieldGroup, []);
  useEffect(() => () => disposeMacroDepthOfFieldGroup(group), [group]);
  return <primitive object={group} dispose={null} />;
}
