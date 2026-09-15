/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { toWorld } from "./rttUtils";
import { disposeTeachingSubjectResources } from "./TeachingMaterials";
import {
  MACRO_DEPTH_BASE_CENTER_MM,
  MACRO_DEPTH_BASE_DIMENSIONS_MM,
  MACRO_DEPTH_FOCUS_ZONE_SPECS,
  MACRO_DEPTH_SPECIMEN_CENTER_MM,
  MACRO_DEPTH_STATION_BODY_DEPTH_MM,
  MACRO_DEPTH_STATION_BODY_RADIUS_MM,
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

  const chassis = new THREE.MeshStandardMaterial({
    color: "#263746",
    roughness: 0.42,
    metalness: 0.72,
  });
  const stationBody = new THREE.MeshStandardMaterial({
    color: "#526575",
    roughness: 0.34,
    metalness: 0.78,
  });
  const face = new THREE.MeshStandardMaterial({
    color: "#aebdca",
    roughness: 0.28,
    metalness: 0.7,
  });
  const detail = new THREE.MeshStandardMaterial({
    color: "#d9a441",
    roughness: 0.32,
    metalness: 0.62,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: "#62c6c8",
    roughness: 0.26,
    metalness: 0.48,
  });
  const groove = new THREE.MeshStandardMaterial({
    color: "#19232e",
    roughness: 0.64,
    metalness: 0.54,
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
    new THREE.BoxGeometry(toWorld(78), toWorld(5), toWorld(4)),
    chassis,
    { x: 0, y: 5, z: 416 },
  );
  add(
    "front-lip",
    new THREE.BoxGeometry(toWorld(98), toWorld(2.2), toWorld(3)),
    detail,
    { x: 0, y: 2, z: 419 },
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
  const radialSlotGeometry = new THREE.BoxGeometry(toWorld(0.55), toWorld(3.4), toWorld(0.18));
  const toothGeometry = new THREE.BoxGeometry(toWorld(0.72), toWorld(2.1), toWorld(0.22));
  const screwGeometry = new THREE.CylinderGeometry(toWorld(1.35), toWorld(1.35), toWorld(0.5), 24);
  screwGeometry.rotateX(Math.PI / 2);
  const screwSlotGeometry = new THREE.BoxGeometry(toWorld(0.35), toWorld(2.1), toWorld(0.12));
  const fineSlotGeometry = new THREE.BoxGeometry(toWorld(5.4), toWorld(0.32), toWorld(0.14));
  const microDotGeometry = new THREE.SphereGeometry(toWorld(0.16), 8, 6);

  MACRO_DEPTH_FOCUS_ZONE_SPECS.forEach((zone, stationIndex) => {
    const { x, y } = zone.centerMm;
    const surfaceZ = zone.surfaceZMm;
    add(
      `station-${stationIndex}-body`,
      bodyGeometry,
      stationBody,
      { x, y, z: surfaceZ + 3 },
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
