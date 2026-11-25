import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createBuildingGeometry, type PointMm } from "../BuildingGeometry";
import { toWorld } from "../../rttUtils";
import type { CourtyardMaterials } from "./CourtyardMaterials";

type Building = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  roofRise: number;
  frontBays: number;
  turn?: number;
  upperFloor?: boolean;
  plaster?: boolean;
};

const sites: readonly Building[] = [
  { id: "east-arcade", x: 7120, z: 8660, width: 5000, depth: 2600, height: 2420, roofRise: 795, frontBays: 5, turn: Math.PI / 2 },
  { id: "east-return", x: 4240, z: 14850, width: 4230, depth: 1820, height: 2180, roofRise: 690, frontBays: 5 },
  { id: "east-gate-lodge", x: 8760, z: 4440, width: 1810, depth: 2120, height: 2130, roofRise: 625, frontBays: 2, turn: Math.PI / 2, plaster: true },
  { id: "overlook-pavilion", x: 9900, z: 12260, width: 2640, depth: 1800, height: 2760, roofRise: 680, frontBays: 3, upperFloor: true, plaster: true },
  { id: "west-gallery", x: -6950, z: 9560, width: 4320, depth: 2370, height: 2370, roofRise: 850, frontBays: 4, turn: -Math.PI / 2, plaster: true },
  { id: "west-return", x: -5700, z: 12600, width: 3540, depth: 1090, height: 2330, roofRise: 640, frontBays: 4 },
  { id: "west-garden-lodge", x: -8550, z: 6185, width: 1800, depth: 1850, height: 1940, roofRise: 620, frontBays: 2, turn: -Math.PI / 2 },
  { id: "west-overlook", x: -9850, z: 11540, width: 2350, depth: 2440, height: 2800, roofRise: 690, frontBays: 3, upperFloor: true, plaster: true },
];

function indexed(geometry: THREE.BufferGeometry) {
  geometry.clearGroups();
  if (!geometry.index) {
    const indices = Array.from({ length: geometry.getAttribute("position").count }, (_, i) => i);
    geometry.setIndex(indices);
  }
  return geometry;
}

function arch(
  path: THREE.Path, center: number, bottom: number, spring: number, radius: number, clockwise: boolean,
) {
  path.moveTo(toWorld(center - radius), toWorld(spring));
  path.absarc(toWorld(center), toWorld(spring), toWorld(radius), Math.PI, 0, clockwise);
  path.lineTo(toWorld(center + radius), toWorld(bottom));
  path.lineTo(toWorld(center - radius), toWorld(bottom));
  path.closePath();
}

function rectangle(path: THREE.Path, left: number, right: number, bottom: number, top: number) {
  path.moveTo(toWorld(left), toWorld(bottom));
  path.lineTo(toWorld(left), toWorld(top));
  path.lineTo(toWorld(right), toWorld(top));
  path.lineTo(toWorld(right), toWorld(bottom));
  path.closePath();
}

function relief(shape: THREE.Shape, projection: number, depth: number) {
  return indexed(new THREE.ExtrudeGeometry(shape, {
    depth: toWorld(depth), bevelEnabled: false, curveSegments: 9,
  })).translate(0, 0, toWorld(projection));
}

function elevation(
  parent: THREE.Group, materials: CourtyardMaterials, site: Building,
  width: number, plane: number, rotation: number, bays: number, label: string,
) {
  const group = new THREE.Group();
  group.name = label;
  group.rotateY(rotation);
  // Work with the front at local Z=0, with inward depth measured towards +Z.
  group.translateZ(toWorld(-plane));
  parent.add(group);
  const shape = createBuildingGeometry(group);
  const inside = 155;
  const pitch = width / bays;
  const halfOpening = Math.min(235, pitch * 0.285);
  const spring = site.upperFloor ? 1060 : site.height - 715;
  const sill = 345;
  const upperBottom = site.height - 935;
  const upperTop = site.height - 360;
  const openingCenters = Array.from({ length: bays }, (_, i) => (i + 0.5) * pitch - width / 2);
  const wall = new THREE.Shape();
  rectangle(wall, -width / 2, width / 2, 0, site.height);
  for (const u of openingCenters) {
    const hole = new THREE.Path();
    arch(hole, u, sill, spring, halfOpening, true);
    wall.holes.push(hole);
    if (site.upperFloor) {
      const upper = new THREE.Path();
      rectangle(upper, u - halfOpening, u + halfOpening, upperBottom, upperTop);
      wall.holes.push(upper);
    }
  }
  shape.add("wall", site.plaster ? materials.plaster : materials.limestone, relief(wall, 0, inside));

  for (const u of openingCenters) {
    const glass = new THREE.Shape();
    arch(glass, u, sill + 14, spring, halfOpening - 13, true);
    shape.add("glass", materials.glazing, relief(glass, 130, 8));

    const surround = new THREE.Shape();
    arch(surround, u, sill - 16, spring, halfOpening + 55, true);
    const opening = new THREE.Path();
    arch(opening, u, sill, spring, halfOpening, true);
    surround.holes.push(opening);
    shape.add("surrounds", materials.trim, relief(surround, -37, 53));
    shape.box("keys", materials.cap, [u, spring + halfOpening + 33, -40], [68, 69, 44]);
    shape.box("keys", materials.cap, [u, sill - 22, -39], [2 * halfOpening + 144, 33, 105]);

    shape.box("sash", materials.joinery, [u, (sill + spring + halfOpening) / 2, 115],
      [25, spring + halfOpening - sill, 36]);
    shape.box("sash", materials.joinery, [u, spring - 18, 115], [2 * halfOpening, 27, 35]);
    for (const side of [-1, 1]) {
      shape.box("sash", materials.joinery, [u + side * (halfOpening - 9), (sill + spring) / 2, 114],
        [19, spring - sill, 34]);
      const spoke = new THREE.BoxGeometry(toWorld(halfOpening - 12), toWorld(14), toWorld(23));
      spoke.translate(toWorld(halfOpening / 2 - 4), 0, 0);
      spoke.rotateZ(Math.PI / 2 - side * Math.PI / 3);
      spoke.translate(toWorld(u), toWorld(spring - 12), toWorld(114));
      shape.add("sash", materials.joinery, spoke);
    }

    if (site.upperFloor) {
      const height = upperTop - upperBottom;
      const mid = (upperBottom + upperTop) / 2;
      shape.box("glass", materials.glazing, [u, mid, 130], [2 * halfOpening - 12, height - 12, 10]);
      shape.box("sash", materials.joinery, [u, mid, 115], [21, height - 10, 32]);
      for (const edge of [-1, 1]) {
        shape.box("keys", materials.cap, [u + edge * (halfOpening + 17), mid, -14], [36, height + 54, 55]);
        shape.box("keys", materials.cap, [u, mid + edge * (height / 2 + 17), -25], [2 * halfOpening + 78, 34, 77]);
      }
    }
  }

  for (let i = 0; i <= bays; i++) {
    const pier = Math.max(-width / 2 + 54, Math.min(width / 2 - 54, i * pitch - width / 2));
    const shaftTop = site.upperFloor ? upperBottom - 118 : site.height - 298;
    shape.box("pilasters", materials.trim, [pier, (shaftTop + 165) / 2, -27], [107, shaftTop - 165, 72]);
    shape.box("keys", materials.cap, [pier, shaftTop + 10, -39], [147, 58, 105]);
    shape.box("keys", materials.cap, [pier, 168, -34], [144, 52, 105]);
  }

  shape.box("plinths", materials.plinth, [0, 66, -9], [width + 22, 132, 59]);
  shape.box("plinths", materials.plinth, [0, 126, -17], [width + 37, 26, 68]);
  shape.box("mouldings", materials.trim, [0, site.height - 157, -32], [width + 54, 141, 80]);
  shape.box("keys", materials.cap, [0, site.height - 52, -49], [width + 123, 49, 118]);
  shape.box("mouldings", materials.trim, [0, site.height - 8, -66], [width + 152, 46, 151]);
  if (site.upperFloor) {
    shape.box("mouldings", materials.trim, [0, upperBottom - 120, -18], [width + 26, 65, 79]);
  }
  shape.finish();
}

function addRoof(group: THREE.Group, materials: CourtyardMaterials, site: Building) {
  const geometry = createBuildingGeometry(group);
  const w = site.width / 2 + 116;
  const d = site.depth / 2 + 116;
  const eave = site.height + 12;
  const top = eave + site.roofRise;
  const ridge = Math.max(125, w - d * 0.7);
  const corners: readonly PointMm[] = [
    [-w, eave, -d], [w, eave, -d], [w, eave, d], [-w, eave, d],
    [-ridge, top, 0], [ridge, top, 0],
  ];
  const faces = [[0, 1, 5, 4], [1, 2, 5], [2, 3, 4, 5], [3, 0, 4]];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const [faceIndex, face] of faces.entries()) {
    const start = positions.length / 3;
    const across = faceIndex % 2 === 0;
    for (const id of face) {
      const [x, y, z] = corners[id];
      positions.push(toWorld(x), toWorld(y), toWorld(z));
      const riseAlongSlope = (y - eave) * Math.hypot(site.roofRise, across ? d : w - ridge) / site.roofRise;
      uvs.push((across ? x : z) / 1570, riseAlongSlope / 910);
    }
    indices.push(start, start + 2, start + 1);
    if (face.length === 4) indices.push(start, start + 3, start + 2);
  }
  const roof = new THREE.BufferGeometry();
  roof.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  roof.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  roof.setIndex(indices);
  roof.computeVertexNormals();
  geometry.add("hipped-roof", materials.slate, roof);
  geometry.box("ridge", materials.ridge, [0, top + 16, 0], [2 * ridge + 60, 72, 90]);

  if (site.width > 3000) {
    const x = ridge * .68;
    geometry.box("chimney", materials.trim, [x, top - 190, 130], [230, 640, 260]);
    geometry.box("chimney-cap", materials.cap, [x, top + 132, 130], [285, 55, 308]);
  }
  geometry.finish();
}

function batchBuilding(building: THREE.Group, walls: THREE.Group) {
  const finishes = new Map<THREE.Material, THREE.BufferGeometry[]>();
  walls.updateMatrixWorld(true);
  walls.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const geometry = object.geometry.applyMatrix4(object.matrixWorld);
    const batch = finishes.get(object.material);
    if (batch) batch.push(geometry);
    else finishes.set(object.material, [geometry]);
  });
  for (const [material, parts] of finishes) {
    const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts);
    if (!geometry) throw new Error("Incompatible courtyard geometry: " + building.name);
    if (parts.length > 1) parts.forEach(part => part.dispose());
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = building.name + "-" + material.name;
    building.add(mesh);
  }
}

export function addCourtyardBuildings(parent: THREE.Group, materials: CourtyardMaterials, groundY: number) {
  for (const site of sites) {
    const group = new THREE.Group();
    group.name = "courtyard-building-" + site.id;
    group.position.set(toWorld(site.x), toWorld(groundY), toWorld(site.z));
    group.rotation.y = site.turn ?? 0;
    parent.add(group);
    const parts = new THREE.Group();
    elevation(parts, materials, site, site.width, site.depth / 2, 0, site.frontBays, "courtyard-elevation-front");
    elevation(parts, materials, site, site.width, site.depth / 2, Math.PI, site.frontBays, "courtyard-elevation-rear");
    const sides = site.depth > 2000 ? 2 : 1;
    elevation(parts, materials, site, site.depth - 310, site.width / 2, Math.PI / 2, sides, "courtyard-elevation-east");
    elevation(parts, materials, site, site.depth - 310, site.width / 2, -Math.PI / 2, sides, "courtyard-elevation-west");
    addRoof(parts, materials, site);
    batchBuilding(group, parts);
  }
}
