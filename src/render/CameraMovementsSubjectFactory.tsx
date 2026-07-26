/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import geometry, {
  DEFAULT_SUBJECT_COUNT,
  getSubjectLayout,
  type SubjectCount,
} from "../scenes/understandingCameraMovementsGeometry";
import { useAppStore } from "../state/appStore";
import type { SceneDefinition } from "../types/scene";
import { toWorld } from "./rttUtils";

const { grid } = geometry;

export function createCameraMovementsGroup(
  subjectCount: SubjectCount = DEFAULT_SUBJECT_COUNT,
): THREE.Group {
  const group = new THREE.Group();
  const layout = getSubjectLayout(subjectCount);
  group.name = "camera-movements-subject";
  group.userData.subjectCount = layout.count;
  group.userData.resourceOwnership = "owned";

  layout.cubes.forEach((cube) => {
    const s = toWorld(cube.sizeMm);
    const hs = toWorld(cube.halfSizeMm);
    const cx = toWorld(cube.center.x);
    const cy = toWorld(cube.center.y);
    const cz = toWorld(cube.center.z);

    // Each cube owns a fresh resource set. Resources shared by faces or vertex
    // markers are disposed once by the root group's unique-resource disposer.
    const cubeGroup = new THREE.Group();
    cubeGroup.name = cube.id;
    cubeGroup.userData.subjectRole = cube.role;

  // Semi-transparent faces
  const faceGeo = new THREE.PlaneGeometry(s, s);
  const frontFaceMat = new THREE.MeshStandardMaterial({
    color: "#a5b4fc",
    roughness: 0.25,
    metalness: 0.05,
    transparent: true,
    opacity: 0.22,
    side: THREE.FrontSide,
    depthWrite: true,
  });
  const backFaceMat = new THREE.MeshStandardMaterial({
    color: "#6366f1",
    roughness: 0.25,
    metalness: 0.05,
    transparent: true,
    opacity: 0.15,
    side: THREE.FrontSide,
    depthWrite: true,
  });
  const sideFaceMat = new THREE.MeshStandardMaterial({
    color: "#818cf8",
    roughness: 0.25,
    metalness: 0.05,
    transparent: true,
    opacity: 0.18,
    side: THREE.FrontSide,
    depthWrite: true,
  });

  // +Z (front)
  const faceFront = new THREE.Mesh(faceGeo, frontFaceMat);
  faceFront.position.set(cx, cy, cz + hs);
  cubeGroup.add(faceFront);

  // -Z (back)
  const faceBack = new THREE.Mesh(faceGeo, backFaceMat);
  faceBack.position.set(cx, cy, cz - hs);
  faceBack.rotation.y = Math.PI;
  cubeGroup.add(faceBack);

  // +X (right)
  const faceRight = new THREE.Mesh(faceGeo, sideFaceMat);
  faceRight.position.set(cx + hs, cy, cz);
  faceRight.rotation.y = Math.PI / 2;
  cubeGroup.add(faceRight);

  // -X (left)
  const faceLeft = new THREE.Mesh(faceGeo, sideFaceMat);
  faceLeft.position.set(cx - hs, cy, cz);
  faceLeft.rotation.y = -Math.PI / 2;
  cubeGroup.add(faceLeft);

  // +Y (top)
  const faceTop = new THREE.Mesh(faceGeo, sideFaceMat);
  faceTop.position.set(cx, cy + hs, cz);
  faceTop.rotation.x = -Math.PI / 2;
  cubeGroup.add(faceTop);

  // -Y (bottom)
  const faceBottom = new THREE.Mesh(faceGeo, sideFaceMat);
  faceBottom.position.set(cx, cy - hs, cz);
  faceBottom.rotation.x = Math.PI / 2;
  cubeGroup.add(faceBottom);

  // --- Near/front edges (all edges touching +Z face, warmer highlight) ---
  // Edges are drawn as individual line segments for the 12 edges,
  // with the 4 front-Z edges colored differently from the 4 back-Z edges.
  const nearEdgeColor = "#f59e0b";  // amber
  const farEdgeColor  = "#a855f7";  // violet
  const midEdgeColor  = "#6366f1";  // indigo (edges connecting near to far)

  // Helper: create a world-space line between two corners
  function addEdgeLine(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    color: string,
  ) {
    const pts = new Float32Array([x1, y1, z1, x2, y2, z2]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color,
      linewidth: 1,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 1.0,
    });
    const line = new THREE.LineSegments(geo, mat);
    line.renderOrder = 10;
    cubeGroup.add(line);
  }

  const c = (axis: number, sign: number) => (axis === 0 ? cx + sign * hs : axis === 1 ? cy + sign * hs : cz + sign * hs);
  const corner = (sx: number, sy: number, sz: number) => [c(0, sx), c(1, sy), c(2, sz)] as const;

  // 12 edges of the cube
  const edgeDefs: Array<[number, number, number, number, number, number, string]> = [
    // Front face edges (+Z) — near, amber
    [-1, -1, 1,  1, -1, 1],
    [ 1, -1, 1,  1,  1, 1],
    [ 1,  1, 1, -1,  1, 1],
    [-1,  1, 1, -1, -1, 1],
  ].map((quad) => {
    const [sx1, sy1, sz1, sx2, sy2, sz2] = quad;
    const [x1, y1, z1] = corner(sx1, sy1, sz1);
    const [x2, y2, z2] = corner(sx2, sy2, sz2);
    return [x1, y1, z1, x2, y2, z2, nearEdgeColor] as [number, number, number, number, number, number, string];
  });

  const backEdges: Array<[number, number, number, number, number, number, string]> = [
    // Back face edges (-Z) — far, violet
    [-1, -1, -1,  1, -1, -1],
    [ 1, -1, -1,  1,  1, -1],
    [ 1,  1, -1, -1,  1, -1],
    [-1,  1, -1, -1, -1, -1],
  ].map((quad) => {
    const [sx1, sy1, sz1, sx2, sy2, sz2] = quad;
    const [x1, y1, z1] = corner(sx1, sy1, sz1);
    const [x2, y2, z2] = corner(sx2, sy2, sz2);
    return [x1, y1, z1, x2, y2, z2, farEdgeColor] as [number, number, number, number, number, number, string];
  });

  const midEdges: Array<[number, number, number, number, number, number, string]> = [
    // Connecting edges (near-to-far) — indigo
    [-1, -1, 1, -1, -1, -1],
    [ 1, -1, 1,  1, -1, -1],
    [-1,  1, 1, -1,  1, -1],
    [ 1,  1, 1,  1,  1, -1],
  ].map(([sx1, sy1, sz1, sx2, sy2, sz2]) => {
    const [x1, y1, z1] = corner(sx1, sy1, sz1);
    const [x2, y2, z2] = corner(sx2, sy2, sz2);
    return [x1, y1, z1, x2, y2, z2, midEdgeColor] as [number, number, number, number, number, number, string];
  });

  [...edgeDefs, ...backEdges, ...midEdges].forEach(([x1, y1, z1, x2, y2, z2, color]) => {
    addEdgeLine(x1, y1, z1, x2, y2, z2, color);
  });

  // --- Vertex markers: near (amber), far (violet) ---
  const vertexRadius = toWorld(14);
  const nearVertexGeo = new THREE.SphereGeometry(vertexRadius, 10, 10);
  const nearVertexMat = new THREE.MeshStandardMaterial({
    color: nearEdgeColor,
    roughness: 0.15,
    metalness: 0.35,
  });
  const farVertexGeo = new THREE.SphereGeometry(vertexRadius, 10, 10);
  const farVertexMat = new THREE.MeshStandardMaterial({
    color: farEdgeColor,
    roughness: 0.15,
    metalness: 0.35,
  });

  // Near vertices (+Z)
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [vx, vy, vz] = corner(sx, sy, 1);
    const marker = new THREE.Mesh(nearVertexGeo, nearVertexMat);
    marker.position.set(vx, vy, vz);
    marker.renderOrder = 10;
    cubeGroup.add(marker);
  }
  // Far vertices (-Z)
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [vx, vy, vz] = corner(sx, sy, -1);
    const marker = new THREE.Mesh(farVertexGeo, farVertexMat);
    marker.position.set(vx, vy, vz);
    marker.renderOrder = 4;
    cubeGroup.add(marker);
  }

    group.add(cubeGroup);
  });

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

export type CameraMovementsSubjectProps = {
  scene?: SceneDefinition;
  onGroupChange?: (group: THREE.Group | null) => void;
};

export const CameraMovementsSubject: React.FC<CameraMovementsSubjectProps> = ({
  onGroupChange,
}) => {
  const subjectCount = useAppStore((state) => state.scene.subjectCount);
  const group = useMemo(() => createCameraMovementsGroup(subjectCount), [subjectCount]);

  useEffect(() => {
    onGroupChange?.(group);
    return () => {
      disposeCameraMovementsGroup(group);
      onGroupChange?.(null);
    };
  }, [group, onGroupChange]);

  return <primitive object={group} dispose={null} />;
};

/** Dispose all owned Three.js resources in the given group. */
export function disposeCameraMovementsGroup(group: THREE.Group): void {
  if (group.userData.resourcesDisposed === true) return;
  group.userData.resourcesDisposed = true;

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
