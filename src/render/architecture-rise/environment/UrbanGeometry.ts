import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { toWorld } from "../../rttUtils";

export type Millimetres3 = readonly [x: number, y: number, z: number];

/** Batch only parts of one building, sidewalk or prop so mesh bounds stay local. */
export class UrbanGeometry {
  private readonly parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  private readonly group: THREE.Group;

  constructor(group: THREE.Group) {
    this.group = group;
  }

  private add(material: THREE.Material, geometry: THREE.BufferGeometry) {
    geometry.clearGroups();
    const parts = this.parts.get(material);
    if (parts) parts.push(geometry);
    else this.parts.set(material, [geometry]);
  }

  box(material: THREE.Material, size: Millimetres3, center: Millimetres3, aroundY = 0) {
    const [w, h, d] = size;
    const [x, y, z] = center;
    const geometry = new THREE.BoxGeometry(toWorld(w), toWorld(h), toWorld(d));
    geometry.rotateY(aroundY).translate(toWorld(x), toWorld(y), toWorld(z));
    const tile = material.userData.urbanFacadeTileMm as readonly [number, number] | undefined;
    if (tile) {
      const positions = geometry.getAttribute("position");
      const normals = geometry.getAttribute("normal");
      const uv = geometry.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) {
        const tangent = Math.abs(normals.getZ(i)) > 0.5 ? positions.getX(i) : positions.getZ(i);
        uv.setXY(i, tangent * 1000 / tile[0], positions.getY(i) * 1000 / tile[1]);
      }
    }
    this.add(material, geometry);
  }

  round(
    material: THREE.Material,
    shape: THREE.BufferGeometry,
    center: Millimetres3,
    scale: Millimetres3 = [1, 1, 1],
  ) {
    shape.scale(...scale);
    shape.translate(toWorld(center[0]), toWorld(center[1]), toWorld(center[2]));
    this.add(material, shape);
  }

  tube(material: THREE.Material, start: Millimetres3, end: Millimetres3, base: number, top = base) {
    const from = new THREE.Vector3(...start).multiplyScalar(0.001);
    const to = new THREE.Vector3(...end).multiplyScalar(0.001);
    const axis = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(toWorld(top), toWorld(base), axis.length(), 8, 1);
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
    geometry.applyQuaternion(rotation).translate(...from.lerp(to, 0.5).toArray());
    this.add(material, geometry);
  }

  roof(
    material: THREE.Material,
    points: readonly Millimetres3[],
    triangles: readonly (readonly [number, number, number])[],
  ) {
    // Split the faces at their edges so physically distinct slopes retain their normals.
    const vertices: number[] = [];
    const uvs: number[] = [];
    for (const triangle of triangles) {
      const [a, b, c] = triangle.map(index => points[index]);
      const alongX = Math.abs(b[0] - a[0]) >= Math.abs(b[2] - a[2]);
      for (const [x, y, z] of [a, b, c]) {
        vertices.push(toWorld(x), toWorld(y), toWorld(z));
        uvs.push((alongX ? x : z) / 2400, (z + y * .4) / 1300);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(Array.from({ length: vertices.length / 3 }, (_, index) => index));
    geometry.computeVertexNormals();
    this.add(material, geometry);
  }

  mount() {
    for (const [material, pieces] of this.parts) {
      const geometry = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces);
      if (!geometry) throw new Error("Architecture Rise urban geometry batch is incompatible");
      if (pieces.length > 1) pieces.forEach(piece => piece.dispose());
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${this.group.name}-${material.name}`;
      this.group.add(mesh);
    }
    this.parts.clear();
  }
}
