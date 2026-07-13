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

  // focus-detail patch: use canonical pure helpers to construct checkerboard and crosshair
  const focusGroup = new THREE.Group();
  const cells = geometry.getArchitectureFocusChartCells();
  const bars = geometry.getArchitectureFocusChartBars();

  // checker cells: use MeshBasicMaterial for stable high-contrast appearance in both RTT and R3F
  cells.forEach((c) => {
    const mat = new THREE.MeshBasicMaterial({ color: c.dark ? 0x0f1724 : 0xf8fafc });
    const box = new THREE.Mesh(new THREE.BoxGeometry(toWorld(c.width), toWorld(c.height), toWorld(c.depth)), mat);
    box.position.set(toWorld(c.x), toWorld(c.y), toWorld(c.z));
    box.name = c.id;
    focusGroup.add(box);
  });

  // crosshair bars: horizontal and vertical
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xff0000, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  bars.forEach((b) => {
    const geom = new THREE.BoxGeometry(toWorld(b.width), toWorld(b.height), toWorld(b.depth));
    const mesh = new THREE.Mesh(geom, crossMat);
    mesh.position.set(toWorld(b.x), toWorld(b.y), toWorld(b.z));
    mesh.name = `architecture-focus-crosshair-${b.id}`;
    mesh.renderOrder = 1000; // render last to avoid z-fighting
    focusGroup.add(mesh);
  });

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
      // optional detail patterns rendered as simple geometry on the plinth front face
      const frontZ = def.z - def.depth / 2 - 4; // small offset forward in mm
      const stripeDepth = 10; // mm thickness for detail geometry
      if (def.detail === "vertical-stripes") {
        const stripeW = Math.min(80, def.width * 0.22);
        const gap = stripeW * 0.5;
        const count = 3;
        for (let i = 0; i < count; i++) {
          const offsetX = -((count - 1) * (stripeW + gap)) / 2 + i * (stripeW + gap);
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(toWorld(stripeW), toWorld(def.height * 0.7), toWorld(stripeDepth)), new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.98 }));
          stripe.position.set(toWorld(def.x + offsetX), toWorld(geometry.ground.y + def.height * 0.35), toWorld(frontZ));
          grp.add(stripe);
        }
      } else if (def.detail === "horizontal-bands") {
        const bandH = Math.min(80, def.height * 0.18);
        const bandCount = 2;
        for (let i = 0; i < bandCount; i++) {
          const offsetY = (i - (bandCount - 1) / 2) * (bandH + 20);
          const band = new THREE.Mesh(new THREE.BoxGeometry(toWorld(def.width * 0.92), toWorld(bandH), toWorld(stripeDepth)), new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.98 }));
          band.position.set(toWorld(def.x), toWorld(geometry.ground.y + def.height * 0.5 + offsetY), toWorld(frontZ));
          grp.add(band);
        }
      } else if (def.detail === "checker") {
        const panelW = Math.min(320, def.width * 0.9);
        const panelH = Math.min(320, def.height * 0.9);
        const cols = 4;
        const rows = 4;
        const cellW = panelW / cols;
        const cellH = panelH / rows;
        const panelLeft = def.x - panelW / 2;
        const panelBottom = geometry.ground.y + def.height * 0.5 - panelH / 2;
        for (let cx = 0; cx < cols; cx++) {
          for (let cy = 0; cy < rows; cy++) {
            const isDark = (cx + cy) % 2 === 0;
            const cell = new THREE.Mesh(new THREE.BoxGeometry(toWorld(cellW), toWorld(cellH), toWorld(stripeDepth)), new THREE.MeshStandardMaterial({ color: isDark ? "#1f2937" : "#e6eef7", roughness: 0.95 }));
            const px = panelLeft + cx * cellW + cellW / 2;
            const py = panelBottom + cy * cellH + cellH / 2;
            cell.position.set(toWorld(px), toWorld(py), toWorld(frontZ));
            grp.add(cell);
          }
        }
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
          const cells = geometry.getArchitectureFocusChartCells();
          const bars = geometry.getArchitectureFocusChartBars();
          const elems = [] as React.ReactNode[];
          // render checker cells using MeshBasicMaterial for parity with RTT
          cells.forEach((c) => {
            elems.push(
              <mesh key={c.id} position={[toW(c.x), toW(c.y), toW(c.z)]} name={c.id}>
                <boxGeometry args={[toW(c.width), toW(c.height), toW(c.depth)]} />
                <meshBasicMaterial color={c.dark ? "#1f2937" : "#e6eef7"} />
              </mesh>,
            );
          });
          // render crosshair bars
          bars.forEach((b) => {
            elems.push(
              <mesh key={`bar-${b.id}`} position={[toW(b.x), toW(b.y), toW(b.z)]} name={`architecture-focus-crosshair-${b.id}`} renderOrder={1000}>
                <boxGeometry args={[toW(b.width), toW(b.height), toW(b.depth)]} />
                <meshBasicMaterial color="#ff0000" polygonOffset={true} polygonOffsetFactor={1} polygonOffsetUnits={1} />
              </mesh>,
            );
          });
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
        return (
          <group key={def.id}>
            <mesh position={[toW(x), toW(geometry.ground.y + h / 2), toW(z)]}>
              <boxGeometry args={[toW(w), toW(h), toW(d)]} />
              <meshStandardMaterial color={def.color || "#9aa6b2"} roughness={0.95} metalness={0} />
            </mesh>
            {def.detail === "vertical-stripes" ? (
              (() => {
                const stripes = [] as React.ReactNode[];
                const stripeW = Math.min(80, w * 0.22);
                const gap = stripeW * 0.5;
                const count = 3;
                const frontZ = toW(z - d / 2 - 4);
                for (let i = 0; i < count; i++) {
                  const offsetX = -((count - 1) * (stripeW + gap)) / 2 + i * (stripeW + gap);
                  stripes.push(
                    <mesh key={`vs-${def.id}-${i}`} position={[toW(x + offsetX), toW(geometry.ground.y + h * 0.35), frontZ]}>
                      <boxGeometry args={[toW(stripeW), toW(h * 0.7), toW(10)]} />
                      <meshStandardMaterial color="#f1f5f9" roughness={0.98} />
                    </mesh>,
                  );
                }
                return <group>{stripes}</group>;
              })()
            ) : null}

            {def.detail === "horizontal-bands" ? (
              (() => {
                const bands = [] as React.ReactNode[];
                const bandH = Math.min(80, h * 0.18);
                const bandCount = 2;
                const frontZ = toW(z - d / 2 - 4);
                for (let i = 0; i < bandCount; i++) {
                  const offsetY = (i - (bandCount - 1) / 2) * (bandH + 20);
                  bands.push(
                    <mesh key={`hb-${def.id}-${i}`} position={[toW(x), toW(geometry.ground.y + h * 0.5 + offsetY), frontZ]}>
                      <boxGeometry args={[toW(w * 0.92), toW(bandH), toW(10)]} />
                      <meshStandardMaterial color="#f1f5f9" roughness={0.98} />
                    </mesh>,
                  );
                }
                return <group>{bands}</group>;
              })()
            ) : null}

            {def.detail === "checker" ? (
              (() => {
                const cells: React.ReactNode[] = [];
                const panelW = Math.min(320, w * 0.9);
                const panelH = Math.min(320, h * 0.9);
                const cols = 4;
                const rows = 4;
                const cellW = panelW / cols;
                const cellH = panelH / rows;
                const panelLeft = x - panelW / 2;
                const panelBottom = geometry.ground.y + h * 0.5 - panelH / 2;
                const frontZ = toW(z - d / 2 - 4);
                for (let cx = 0; cx < cols; cx++) {
                  for (let cy = 0; cy < rows; cy++) {
                    const isDark = (cx + cy) % 2 === 0;
                    const px = panelLeft + cx * cellW + cellW / 2;
                    const py = panelBottom + cy * cellH + cellH / 2;
                    cells.push(
                      <mesh key={`ch-${def.id}-${cx}-${cy}`} position={[toW(px), toW(py), frontZ]}>
                        <boxGeometry args={[toW(cellW), toW(cellH), toW(10)]} />
                        <meshStandardMaterial color={isDark ? "#1f2937" : "#e6eef7"} roughness={0.95} />
                      </mesh>,
                    );
                  }
                }
                return <group>{cells}</group>;
              })()
            ) : null}
          </group>
        );
        });
      })()}
    </group>
  );
};
