import * as THREE from "three";
import { toWorld } from "../rttUtils";

interface Batch {
  positions: number[];
  normals: number[];
  uv: number[];
  colors: number[];
  indices: number[];
  material: THREE.Material;
  parent: THREE.Group;
}

export type PointMm = readonly [number, number, number];

/** Bake rectilinear masonry and fittings once. Each named material batch submits one draw. */
export function createBuildingGeometry(root: THREE.Group) {
  const batches = new Map<string, Batch>();
  const cube = new THREE.BoxGeometry();
  const position = cube.getAttribute("position");
  const normal = cube.getAttribute("normal");
  const index = cube.getIndex()!;

  function box(name: string, material: THREE.Material, centerMm: PointMm, sizeMm: PointMm, parent = root) {
    let batch = batches.get(name);
    if (!batch) {
      batch = { positions: [], normals: [], uv: [], colors: [], indices: [], material, parent };
      batches.set(name, batch);
    }
    const offset = batch.positions.length / 3;
    for (let i = 0; i < position.count; i++) {
      const x = toWorld(centerMm[0] + position.getX(i) * sizeMm[0]);
      const y = toWorld(centerMm[1] + position.getY(i) * sizeMm[1]);
      const z = toWorld(centerMm[2] + position.getZ(i) * sizeMm[2]);
      const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i);
      batch.positions.push(x, y, z);
      batch.normals.push(nx, ny, nz);
      batch.uv.push(Math.abs(nx) > 0.5 ? z : x, Math.abs(ny) > 0.5 ? z : y);
      if (material.vertexColors) {
        // Upper panes pick up cool sky, lower panes read as a dark interior.
        const level = position.getY(i) > 0 ? 0.84 : 0.26;
        batch.colors.push(level * 0.88, level * 0.96, level);
      }
    }
    for (let i = 0; i < index.count; i++) batch.indices.push(offset + index.getX(i));
  }

  function finish() {
    cube.dispose();
    for (const [name, batch] of batches) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(batch.positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(batch.normals, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(batch.uv, 2));
      if (batch.colors.length) geometry.setAttribute("color", new THREE.Float32BufferAttribute(batch.colors, 3));
      geometry.setIndex(batch.indices);
      const mesh = new THREE.Mesh(geometry, batch.material);
      mesh.name = name;
      batch.parent.add(mesh);
    }
  }
  return { box, finish };
}

export type BuildingGeometry = ReturnType<typeof createBuildingGeometry>;
