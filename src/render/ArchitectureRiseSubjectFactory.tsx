/* eslint-disable react-refresh/only-export-components */
import * as THREE from "three";
import React from "react";
import { toWorld } from "./rttUtils";
import geometry, { referenceObjects } from "../scenes/architectureRiseGeometry";
import type { ReferenceObjectDef } from "../scenes/architectureRiseGeometry";

let buildingGeom: THREE.BoxGeometry | null = null;
let mullionGeom: THREE.BoxGeometry | null = null;
let floorPlaneGeom: THREE.PlaneGeometry | null = null;
let buildingMaterial: THREE.MeshStandardMaterial | null = null;
let mullionMaterial: THREE.MeshStandardMaterial | null = null;
let groundMaterial: THREE.MeshStandardMaterial | null = null;

function ensureResources() {
  if (!buildingGeom) buildingGeom = new THREE.BoxGeometry(toWorld(geometry.building.width), toWorld(geometry.building.height), toWorld(geometry.building.depth));
  if (!mullionGeom) mullionGeom = new THREE.BoxGeometry(toWorld(geometry.mullionWidthMm), toWorld(geometry.building.height - 80), toWorld(geometry.facadeDetailThicknessMm));
  if (!floorPlaneGeom) floorPlaneGeom = new THREE.PlaneGeometry(toWorld(geometry.ground.width), toWorld(geometry.ground.depth));
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
  // vertical mullions placed just in front of the front façade so their front faces are coplanar
  for (let i = 0; i < divisions; i++) {
    const x = (-geometry.building.width / 2) + (i / (divisions - 1)) * geometry.building.width;
    const mull = new THREE.Mesh(mullionGeom!, mullionMaterial!);
    const detailZ = geometry.facade.frontFacadeZ - geometry.facadeDetailThicknessMm / 2 - geometry.facadeDetailSmallGapMm;
    mull.position.set(toWorld(x), toWorld(geometry.building.center.y), toWorld(detailZ));
    g.add(mull);
  }

  // horizontal floor/window divisions produced as thin boxes placed just in front of the façade
  const floors = geometry.building.facadeHorizontalDivisionCount;
  const stripeMat = new THREE.MeshStandardMaterial({ color: "#c7d2fe", roughness: 0.95 });
  for (let f = 0; f < floors; f++) {
    const y = geometry.facade.mainBodyBottomY + ((f + 0.5) / floors) * geometry.building.height;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(toWorld(geometry.building.width + 40), toWorld(geometry.horizontalStripeHeightMm), toWorld(geometry.facadeDetailThicknessMm)), stripeMat);
    const detailZ = geometry.facade.frontFacadeZ - geometry.facadeDetailThicknessMm / 2 - geometry.facadeDetailSmallGapMm;
    stripe.position.set(toWorld(geometry.building.center.x), toWorld(y), toWorld(detailZ));
    g.add(stripe);
  }

  // ground plane
  const ground = new THREE.Mesh(floorPlaneGeom!, groundMaterial!);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, toWorld(geometry.ground.y), toWorld(geometry.ground.centerZ));
  g.add(ground);

  // focus-detail patch: larger procedural checker/stripe panel slightly in front of facade
  const focusGroup = new THREE.Group();
  const patchSize = geometry.focusChartSizeMm; // mm
  const cells = geometry.focusChartCells;
  const cellSize = patchSize / cells;
  const detailZ = geometry.facade.frontFacadeZ - geometry.facadeDetailThicknessMm / 2 - (geometry.facadeDetailSmallGapMm + 2);
  for (let ix = 0; ix < cells; ix++) {
    for (let iy = 0; iy < cells; iy++) {
      const isDark = (ix + iy) % 2 === 0;
      const mat = new THREE.MeshBasicMaterial({ color: isDark ? 0x0f1724 : 0xf8fafc });
      const box = new THREE.Mesh(new THREE.BoxGeometry(toWorld(cellSize), toWorld(cellSize), toWorld(2)), mat);
      const x = (-patchSize / 2) + ix * cellSize + cellSize / 2;
      const y = geometry.building.center.y - patchSize / 2 + iy * cellSize + cellSize / 2;
      box.position.set(toWorld(x), toWorld(y), toWorld(detailZ));
      focusGroup.add(box);
    }
  }
  // add a crosshair centre marker
  const crosshair = new THREE.Group();
  const crossLen = patchSize * 0.2;
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const h = new THREE.Mesh(new THREE.BoxGeometry(toWorld(crossLen), toWorld(4), toWorld(2)), crossMat);
  const v = new THREE.Mesh(new THREE.BoxGeometry(toWorld(4), toWorld(crossLen), toWorld(2)), crossMat);
  h.position.set(toWorld(0), toWorld(0), toWorld(detailZ));
  v.position.set(toWorld(0), toWorld(0), toWorld(detailZ));
  crosshair.add(h, v);
  focusGroup.add(crosshair);
  g.add(focusGroup);

  // small reference objects (plinths) around the building to aid depth reading
  if (Array.isArray(referenceObjects) && referenceObjects.length > 0) {
    const rots: ReferenceObjectDef[] = referenceObjects;
    rots.forEach((def) => {
      const grp = new THREE.Group();
      const bw = toWorld(def.width);
      const bd = toWorld(def.depth);
      const bh = toWorld(def.height);
      const baseMat = new THREE.MeshStandardMaterial({ color: def.color || "#9aa6b2", roughness: 0.95, metalness: 0 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), baseMat);
      base.position.set(toWorld(def.x), toWorld(geometry.ground.y + def.height / 2), toWorld(def.z));
      grp.add(base);
      // optional subtle top band for high-frequency cue
      if (def.band) {
        const bandH = toWorld(Math.min(10, def.height * 0.08));
        const band = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.92, bandH, bd * 0.95), new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.98 }));
        band.position.set(toWorld(def.x), toWorld(geometry.ground.y + def.height - bandH / 2), toWorld(def.z));
        grp.add(band);
      }
      g.add(grp);
    });
  }

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
          <mesh key={i} position={[toW(x), toW(geometry.building.center.y), toW(geometry.facade.frontFacadeZ - geometry.facadeDetailThicknessMm / 2 - geometry.facadeDetailSmallGapMm)]}>
            <boxGeometry args={[toW(geometry.mullionWidthMm), toW(geometry.building.height - 80), toW(geometry.facadeDetailThicknessMm)]} />
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, toW(geometry.ground.y), toW(geometry.ground.centerZ)]}>
        <planeGeometry args={[toW(geometry.ground.width), toW(geometry.ground.depth)]} />
        <meshStandardMaterial color="#e6eef7" roughness={1} metalness={0} />
      </mesh>

      {/* focus-detail patch */}
      <group>
        {(() => {
          const patchSize = 200; // mm
          const cells = 8;
          const cellSize = patchSize / cells;
          const zPos = geometry.facade.frontFacadeZ - 20; // slightly in front
          const elems = [] as React.ReactNode[];
          for (let ix = 0; ix < cells; ix++) {
            for (let iy = 0; iy < cells; iy++) {
              const isDark = (ix + iy) % 2 === 0;
              const x = (-patchSize / 2) + ix * cellSize + cellSize / 2;
              const y = geometry.building.center.y - patchSize / 2 + iy * cellSize + cellSize / 2;
              elems.push(
                <mesh key={`fd-${ix}-${iy}`} position={[toW(x), toW(y), toW(zPos)]}>
                  <boxGeometry args={[toW(cellSize), toW(cellSize), toW(2)]} />
                  <meshStandardMaterial color={isDark ? "#1f2937" : "#e6eef7"} roughness={0.9} />
                </mesh>,
              );
            }
          }
          return elems;
        })()}
      </group>

      {/* reference objects (plinths) */}
      {(() => {
        const objs: ReferenceObjectDef[] = referenceObjects || [];
        return objs.map((def) => {
          const x = def.x;
          const z = def.z;
          const w = def.width;
          const d = def.depth;
          const h = def.height;
          const band = def.band;
          return (
            <group key={def.id}>
              <mesh position={[toW(x), toW(geometry.ground.y + h / 2), toW(z)]}>
                <boxGeometry args={[toW(w), toW(h), toW(d)]} />
                <meshStandardMaterial color={def.color || "#9aa6b2"} roughness={0.95} metalness={0} />
              </mesh>
              {band ? (
                <mesh position={[toW(x), toW(geometry.ground.y + h - Math.min(10, h * 0.08) / 2), toW(z)]}>
                  <boxGeometry args={[toW(w * 0.92), toW(Math.min(10, h * 0.08)), toW(d * 0.95)]} />
                  <meshStandardMaterial color="#f1f5f9" roughness={0.98} />
                </mesh>
              ) : null}
            </group>
          );
        });
      })()}
    </group>
  );
};
