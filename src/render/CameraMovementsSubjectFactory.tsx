/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import geometry from "../scenes/understandingCameraMovementsGeometry";
import { toWorld } from "./rttUtils";

const { cube, grid } = geometry;

export function createCameraMovementsGroup(): THREE.Group {
  const group = new THREE.Group();

  const s = toWorld(cube.sizeMm);
  const hs = toWorld(cube.halfSizeMm);
  const cx = toWorld(cube.center.x);
  const cy = toWorld(cube.center.y);
  const cz = toWorld(cube.center.z);

  // --- Cube group (semi-transparent faces, edges, vertex markers) ---
  const cubeGroup = new THREE.Group();
  cubeGroup.name = "camera-movements-cube";

  // Each face is a separate Mesh so front/back can have different opacity
  const faceGeo = new THREE.PlaneGeometry(s, s);
  const frontMat = new THREE.MeshStandardMaterial({
    color: "#818cf8",
    roughness: 0.3,
    metalness: 0.05,
    transparent: true,
    opacity: 0.55,
    side: THREE.FrontSide,
    depthWrite: true,
  });
  const backMat = new THREE.MeshStandardMaterial({
    color: "#6366f1",
    roughness: 0.3,
    metalness: 0.05,
    transparent: true,
    opacity: 0.35,
    side: THREE.FrontSide,
    depthWrite: true,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    color: "#a5b4fc",
    roughness: 0.3,
    metalness: 0.05,
    transparent: true,
    opacity: 0.45,
    side: THREE.FrontSide,
    depthWrite: true,
  });

  // +Z (front)
  const front = new THREE.Mesh(faceGeo, frontMat);
  front.position.set(cx, cy, cz + hs);
  cubeGroup.add(front);

  // -Z (back)
  const back = new THREE.Mesh(faceGeo, backMat);
  back.position.set(cx, cy, cz - hs);
  back.rotation.y = Math.PI;
  cubeGroup.add(back);

  // +X
  const right = new THREE.Mesh(faceGeo, sideMat);
  right.position.set(cx + hs, cy, cz);
  right.rotation.y = Math.PI / 2;
  cubeGroup.add(right);

  // -X
  const left = new THREE.Mesh(faceGeo, sideMat);
  left.position.set(cx - hs, cy, cz);
  left.rotation.y = -Math.PI / 2;
  cubeGroup.add(left);

  // +Y (top)
  const top = new THREE.Mesh(faceGeo, sideMat);
  top.position.set(cx, cy + hs, cz);
  top.rotation.x = -Math.PI / 2;
  cubeGroup.add(top);

  // -Y (bottom)
  const bottom = new THREE.Mesh(faceGeo, sideMat);
  bottom.position.set(cx, cy - hs, cz);
  bottom.rotation.x = Math.PI / 2;
  cubeGroup.add(bottom);

  // --- Contrasting edges (wireframe) ---
  const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(s, s, s));
  const edgeMat = new THREE.LineBasicMaterial({
    color: "#4338ca",
    linewidth: 1,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
  });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  edges.position.set(cx, cy, cz);
  edges.renderOrder = 3;
  cubeGroup.add(edges);

  // --- Vertex markers (small spheres at corners) ---
  const cornerRadius = toWorld(12);
  const cornerGeo = new THREE.SphereGeometry(cornerRadius, 8, 8);
  const cornerMat = new THREE.MeshStandardMaterial({
    color: "#4f46e5",
    roughness: 0.2,
    metalness: 0.3,
  });
  const corners = [
    [-hs, -hs, -hs], [hs, -hs, -hs], [-hs, hs, -hs], [hs, hs, -hs],
    [-hs, -hs,  hs], [hs, -hs,  hs], [-hs, hs,  hs], [hs, hs,  hs],
  ];
  corners.forEach(([dx, dy, dz]) => {
    const marker = new THREE.Mesh(cornerGeo, cornerMat);
    marker.position.set(cx + dx, cy + dy, cz + dz);
    marker.renderOrder = 4;
    cubeGroup.add(marker);
  });

  group.add(cubeGroup);

  // --- Grid (wireframe) ---
  const gridSize = grid.halfExtentMm * 2;
  const gridSegments = Math.round(gridSize / grid.cellSizeMm);
  const gridGeo = new THREE.PlaneGeometry(
    toWorld(gridSize),
    toWorld(gridSize),
    gridSegments,
    gridSegments,
  );
  const gridMat = new THREE.MeshStandardMaterial({
    color: "#94a3b8",
    roughness: 0.85,
    metalness: 0.05,
    wireframe: true,
  });
  const gridMesh = new THREE.Mesh(gridGeo, gridMat);
  gridMesh.rotation.x = -Math.PI / 2;
  gridMesh.position.set(
    toWorld(grid.center.x),
    toWorld(grid.center.y),
    toWorld(grid.center.z),
  );
  gridMesh.renderOrder = 1;
  gridMesh.name = "camera-movements-grid";
  group.add(gridMesh);

  // --- Ground plane (solid, subtle fill) ---
  const groundGeo = new THREE.PlaneGeometry(toWorld(gridSize), toWorld(gridSize));
  const groundMat = new THREE.MeshStandardMaterial({
    color: "#e2e8f0",
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(
    toWorld(grid.center.x),
    toWorld(grid.center.y) - 0.001,
    toWorld(grid.center.z),
  );
  groundMesh.renderOrder = 2;
  groundMesh.name = "camera-movements-ground";
  group.add(groundMesh);

  return group;
}

export const CameraMovementsSubject: React.FC = () => {
  const group = useMemo(() => createCameraMovementsGroup(), []);

  useEffect(() => {
    return () => {
      disposeCameraMovementsGroup(group);
    };
  }, [group]);

  return <primitive object={group} dispose={null} />;
};

/** Dispose all owned Three.js resources in the given group. */
export function disposeCameraMovementsGroup(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) return;
    if (object instanceof THREE.Mesh) {
      if (object.geometry) geometries.add(object.geometry);
      const mats = Array.isArray(object.material) ? object.material : [object.material];
      mats.forEach((m) => { if (m) materials.add(m); });
    } else if (object instanceof THREE.LineSegments) {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material as THREE.Material);
    }
  });

  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
