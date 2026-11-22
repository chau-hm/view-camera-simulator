import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { toWorld } from "../rttUtils";

export type PointMm = readonly [number, number, number];

type Batch = {
  name: string;
  material: THREE.Material;
  pieces: THREE.BufferGeometry[];
};

/** Keep each elevation's masonry, window and ornamental batches local to that face. */
export function createBuildingGeometry(parent: THREE.Group) {
  const cube = new THREE.BoxGeometry();
  const batches = new Map<string, Batch>();

  function add(name: string, material: THREE.Material, geometry: THREE.BufferGeometry) {
    let batch = batches.get(name);
    if (!batch) {
      batch = { name, material, pieces: [] };
      batches.set(name, batch);
    }
    batch.pieces.push(geometry);
  }

  function box(name: string, material: THREE.Material, center: PointMm, size: PointMm) {
    const geometry = cube.clone()
      .scale(toWorld(size[0]), toWorld(size[1]), toWorld(size[2]))
      .translate(toWorld(center[0]), toWorld(center[1]), toWorld(center[2]));
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv");
    // Continuous plane coordinates keep the finish at one physical scale
    // across wall pieces of different sizes.
    for (let i = 0; i < position.count; i++) {
      uv.setXY(
        i,
        Math.abs(normal.getX(i)) > 0.5 ? position.getZ(i) : position.getX(i),
        Math.abs(normal.getY(i)) > 0.5 ? position.getZ(i) : position.getY(i),
      );
    }
    add(name, material, geometry);
  }

  function finish() {
    cube.dispose();
    for (const { name, material, pieces } of batches.values()) {
      const geometry = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces);
      if (pieces.length > 1) pieces.forEach(piece => piece.dispose());
      if (!geometry) throw new Error("Unable to merge architecture geometry: " + name);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = "architecture-foreground-" + name;
      parent.add(mesh);
    }
  }

  return { add, box, finish };
}
