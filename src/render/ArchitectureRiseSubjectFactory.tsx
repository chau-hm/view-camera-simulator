/* eslint-disable react-refresh/only-export-components */
import * as THREE from "three";
import React from "react";
import { toWorld } from "./rttUtils";
import geometry from "../scenes/architectureRiseGeometry";

let buildingGeom: THREE.BoxGeometry | null = null;
let mullionGeom: THREE.BoxGeometry | null = null;
let floorPlaneGeom: THREE.PlaneGeometry | null = null;
let buildingMaterial: THREE.MeshStandardMaterial | null = null;
let mullionMaterial: THREE.MeshStandardMaterial | null = null;
let groundMaterial: THREE.MeshStandardMaterial | null = null;

function ensureResources() {
  if (!buildingGeom) buildingGeom = new THREE.BoxGeometry(toWorld(geometry.building.width), toWorld(geometry.building.height), toWorld(geometry.building.depth));
  if (!mullionGeom) mullionGeom = new THREE.BoxGeometry(toWorld(40), toWorld(geometry.building.height - 80), toWorld(geometry.building.depth + 40));
  if (!floorPlaneGeom) floorPlaneGeom = new THREE.PlaneGeometry(toWorld(12000), toWorld(12000));
  if (!buildingMaterial) buildingMaterial = new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.9, metalness: 0.05 });
  if (!mullionMaterial) mullionMaterial = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.92, metalness: 0 });
  if (!groundMaterial) groundMaterial = new THREE.MeshStandardMaterial({ color: "#e6eef7", roughness: 1, metalness: 0 });
}

export function createArchitectureRiseGroup(): THREE.Group {
  ensureResources();
  const g = new THREE.Group();

  // building main block
  const b = new THREE.Mesh(buildingGeom!, buildingMaterial!);
  b.position.set(toWorld(geometry.building.center.x), toWorld(geometry.building.center.y), toWorld(geometry.building.center.z));
  g.add(b);

  // roof/parapet as thin box sitting on top — center computed so parapet touches main body
  const parapetHeight = geometry.building.topHeight;
  const parapetGeom = new THREE.BoxGeometry(
    toWorld(geometry.building.width + 80),
    toWorld(parapetHeight),
    toWorld(geometry.building.depth + 80),
  );
  const parapet = new THREE.Mesh(parapetGeom, new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.85 }));
  const parapetCenterY = geometry.facade.mainBodyTopY + parapetHeight / 2; // mainBodyTopY + topHeight/2
  parapet.position.set(toWorld(geometry.building.center.x), toWorld(parapetCenterY), toWorld(geometry.building.center.z));
  g.add(parapet);

  // vertical mullions
  const divisions = geometry.building.facadeVerticalDivisionCount;
  for (let i = 0; i < divisions; i++) {
    const x = (-geometry.building.width / 2) + (i / (divisions - 1)) * geometry.building.width;
    const mull = new THREE.Mesh(mullionGeom!, mullionMaterial!);
    mull.position.set(toWorld(x), toWorld(geometry.building.center.y), toWorld(geometry.building.center.z - 200));
    g.add(mull);
  }

  // horizontal floor/window divisions produced as thin planes
  const floors = geometry.building.facadeHorizontalDivisionCount;
  const stripeMat = new THREE.MeshStandardMaterial({ color: "#c7d2fe", roughness: 0.95 });
  for (let f = 0; f < floors; f++) {
    const y = geometry.facade.mainBodyBottomY + ((f + 0.5) / floors) * geometry.building.height;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(toWorld(geometry.building.width + 40), toWorld(12), toWorld(geometry.building.depth + 40)), stripeMat);
    stripe.position.set(toWorld(geometry.building.center.x), toWorld(y), toWorld(geometry.building.center.z));
    g.add(stripe);
  }

  // ground plane
  const ground = new THREE.Mesh(floorPlaneGeom!, groundMaterial!);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, toWorld(geometry.groundHeightMm - 60), 0);
  g.add(ground);

  return g;
}

export const ArchitectureRiseSubject: React.FC = () => {
  ensureResources();
  const toW = toWorld;
  return (
    <group>
      {/* building main block */}
      <mesh position={[toW(geometry.building.center.x), toW(geometry.building.center.y), toW(geometry.building.center.z)]}>
        <boxGeometry args={[toW(geometry.building.width), toW(geometry.building.height), toW(geometry.building.depth)]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* parapet */}
      <mesh position={[toW(geometry.building.center.x), toW(geometry.facade.mainBodyTopY + geometry.building.topHeight / 2), toW(geometry.building.center.z)]}>
        <boxGeometry args={[toW(geometry.building.width + 80), toW(geometry.building.topHeight), toW(geometry.building.depth + 80)]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
      </mesh>

      {/* mullions */}
      {Array.from({ length: geometry.building.facadeVerticalDivisionCount }).map((_, i) => {
        const x = (-geometry.building.width / 2) + (i / (geometry.building.facadeVerticalDivisionCount - 1)) * geometry.building.width;
        return (
          <mesh key={i} position={[toW(x), toW(geometry.building.center.y), toW(geometry.building.center.z - 200)]}>
            <boxGeometry args={[toW(40), toW(geometry.building.height - 80), toW(geometry.building.depth + 40)]} />
            <meshStandardMaterial color="#334155" roughness={0.92} />
          </mesh>
        );
      })}

      {/* horizontal stripes */}
      {Array.from({ length: geometry.building.facadeHorizontalDivisionCount }).map((_, f) => {
        const y = geometry.facade.mainBodyBottomY + ((f + 0.5) / geometry.building.facadeHorizontalDivisionCount) * geometry.building.height;
        return (
          <mesh key={`h-${f}`} position={[toW(geometry.building.center.x), toW(y), toW(geometry.building.center.z)]}>
            <boxGeometry args={[toW(geometry.building.width + 40), toW(12), toW(geometry.building.depth + 40)]} />
            <meshStandardMaterial color="#c7d2fe" roughness={0.95} />
          </mesh>
        );
      })}

      {/* ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, toW(geometry.groundHeightMm - 60), 0]}>
        <planeGeometry args={[toW(12000), toW(12000)]} />
        <meshStandardMaterial color="#e6eef7" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
};
