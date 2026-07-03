/* eslint-disable react-refresh/only-export-components */
import * as THREE from "three";
import React from "react";
import { toWorld } from "./rttUtils";

// Shared colors
const FLOOR_COLOR = new THREE.Color("#9aa6b5");

// Shared sizes in mm
const BOARD_W = 120;
const BOARD_H = 180;
const BOARD_THICK = 10;

// Positions in mm (as specified)
const NEAR_CENTER = { x: -180, y: -60, z: 1000 };
const FAR_CENTER = { x: 180, y: 40, z: 3000 };
const FLOOR_Y = -150;

let nearCanvasTexture: THREE.Texture | null = null;
let farCanvasTexture: THREE.Texture | null = null;
let nearMaterial: THREE.MeshBasicMaterial | null = null;
let farMaterial: THREE.MeshBasicMaterial | null = null;
let boardGeometry: THREE.BoxGeometry | null = null;
let floorGeometry: THREE.PlaneGeometry | null = null;
let floorMaterial: THREE.MeshStandardMaterial | null = null;

function makeCheckerTexture(markerColor = "#ef4444", addLowerMarker = false): THREE.Texture {
  const w = 512;
  const h = 768;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // checkerboard
  const cols = 6;
  const rows = 9;
  const cellW = Math.floor(w / cols);
  const cellH = Math.floor(h / rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = "#111111";
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      }
    }
  }

  // L marker top-left (colored)
  ctx.fillStyle = markerColor; // marker
  const markerW = Math.floor(cellW * 1.5);
  const markerH = Math.floor(cellH * 1.5);
  ctx.fillRect(4, 4, markerW, Math.floor(markerH / 4));
  ctx.fillRect(4, 4, Math.floor(markerW / 4), markerH);

  if (addLowerMarker) {
    // add a lower-left vertical marker to help orientation; ensure visible size ~15mm equivalent
    // canvas height corresponds to BOARD_H mm; choose markerMm = 15
    const markerMm = 15;
    const markerPixelH = Math.max(4, Math.floor((markerMm / BOARD_H) * h));
    const x = 6;
    const y = h - 6 - markerPixelH;
    ctx.fillStyle = "#ffdd00"; // saturated yellow
    ctx.fillRect(x, y, Math.floor(markerPixelH * 0.6), markerPixelH);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function ensureSharedResources() {
  if (!boardGeometry) boardGeometry = new THREE.BoxGeometry(toWorld(BOARD_W), toWorld(BOARD_H), toWorld(BOARD_THICK));
  if (!nearCanvasTexture) nearCanvasTexture = makeCheckerTexture("#ef4444", false);
  if (!farCanvasTexture) farCanvasTexture = makeCheckerTexture("#ef4444", true);
  if (!nearMaterial) nearMaterial = new THREE.MeshBasicMaterial({ map: nearCanvasTexture, side: THREE.DoubleSide });
  if (!farMaterial) farMaterial = new THREE.MeshBasicMaterial({ map: farCanvasTexture, side: THREE.DoubleSide });
  if (!floorGeometry) floorGeometry = new THREE.PlaneGeometry(toWorld(5000), toWorld(7000));
  if (!floorMaterial) floorMaterial = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.9, metalness: 0 });
}

export function createFocusFundamentalsGroup(): THREE.Group {
  ensureSharedResources();
  const group = new THREE.Group();

  // Near board
  const near = new THREE.Mesh(boardGeometry!, nearMaterial!);
  near.position.set(toWorld(NEAR_CENTER.x), toWorld(NEAR_CENTER.y), toWorld(NEAR_CENTER.z));
  // face camera toward -Z: rotate so plane normal points -Z; default plane faces +Z so rotate 180 on Y
  near.rotation.y = Math.PI; // ensure facing -Z
  group.add(near);

  // Far board
  const far = new THREE.Mesh(boardGeometry!, farMaterial!);
  far.position.set(toWorld(FAR_CENTER.x), toWorld(FAR_CENTER.y), toWorld(FAR_CENTER.z));
  far.rotation.y = Math.PI;
  // small pedestal: simple box
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(toWorld(40), toWorld(40), toWorld(40)), new THREE.MeshStandardMaterial({ color: "#111827" }));
  pedestal.position.set(toWorld(FAR_CENTER.x), toWorld(FAR_CENTER.y - (BOARD_H / 2 + 20)), toWorld(FAR_CENTER.z));
  group.add(pedestal);
  group.add(far);

  // Floor
  const floor = new THREE.Mesh(floorGeometry!, floorMaterial!);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = toWorld(FLOOR_Y);
  group.add(floor);

  return group;
}

// React component that reuses the same shared resources and renders via JSX for SceneRenderer
export const FocusFundamentalsSubject: React.FC = () => {
  ensureSharedResources();
  return (
    <group>
      {/* Near board */}
          <mesh position={[toWorld(NEAR_CENTER.x), toWorld(NEAR_CENTER.y), toWorld(NEAR_CENTER.z)]} rotation={[0, Math.PI, 0]}>
        <boxGeometry args={[toWorld(BOARD_W), toWorld(BOARD_H), toWorld(BOARD_THICK)]} />
        <meshBasicMaterial attach="material" map={nearCanvasTexture ?? makeCheckerTexture()} side={THREE.DoubleSide} />
      </mesh>

      {/* Far board and pedestal */}
      <mesh position={[toWorld(FAR_CENTER.x), toWorld(FAR_CENTER.y), toWorld(FAR_CENTER.z)]} rotation={[0, Math.PI, 0]}>
        <boxGeometry args={[toWorld(BOARD_W), toWorld(BOARD_H), toWorld(BOARD_THICK)]} />
        <meshBasicMaterial attach="material" map={farCanvasTexture ?? makeCheckerTexture(undefined, true)} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[toWorld(FAR_CENTER.x), toWorld(FAR_CENTER.y - (BOARD_H / 2 + 20)), toWorld(FAR_CENTER.z)]}>
        <boxGeometry args={[toWorld(40), toWorld(40), toWorld(40)]} />
        <meshStandardMaterial attach="material" color="#111827" />
      </mesh>

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, toWorld(FLOOR_Y), 0]}>
        <planeGeometry args={[toWorld(5000), toWorld(7000)]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
};
