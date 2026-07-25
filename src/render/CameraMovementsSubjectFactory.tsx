/* eslint-disable react-refresh/only-export-components */
import { useMemo } from "react";
import * as THREE from "three";
import geometry from "../scenes/understandingCameraMovementsGeometry";
import { toWorld } from "./rttUtils";

const { cube, grid } = geometry;

export function createCameraMovementsGroup(): THREE.Group {
  const group = new THREE.Group();

  // --- Cube ---
  const cubeGeo = new THREE.BoxGeometry(
    toWorld(cube.sizeMm),
    toWorld(cube.sizeMm),
    toWorld(cube.sizeMm),
  );
  const cubeMat = new THREE.MeshStandardMaterial({
    color: "#6366f1",
    roughness: 0.4,
    metalness: 0.1,
  });
  const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
  cubeMesh.position.set(
    toWorld(cube.center.x),
    toWorld(cube.center.y),
    toWorld(cube.center.z),
  );
  cubeMesh.name = "camera-movements-cube";
  group.add(cubeMesh);

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
  return <primitive object={group} />;
};
