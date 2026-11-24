import * as THREE from "three";
import type { ObliqueArchitectureGroundGeometry } from "../../../scenes/obliqueArchitectureGeometry";
import { createBuildingGeometry, type PointMm } from "../BuildingGeometry";
import { toWorld } from "../../rttUtils";
import { industrialBuildings } from "./IndustrialBuildings";
import type { IndustrialMaterials } from "./IndustrialMaterials";

function localGroup(parent: THREE.Group, id: string) {
  const group = new THREE.Group();
  group.name = "oblique-architecture-industrial-" + id;
  parent.add(group);
  return group;
}

function fixture(group: THREE.Group, id: string, geometry: THREE.BufferGeometry, material: THREE.Material, position: PointMm) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = group.name + "-" + id;
  mesh.position.set(toWorld(position[0]), toWorld(position[1]), toWorld(position[2]));
  group.add(mesh);
}

export function addIndustrialStreet(root: THREE.Group, m: IndustrialMaterials, ground: ObliqueArchitectureGroundGeometry) {
  const parcel = localGroup(root, "ground-pavement");
  const road = createBuildingGeometry(parcel);
  const x0 = ground.centerX - ground.width / 2;
  const x1 = ground.centerX + ground.width / 2;
  const districtWest = -9050, districtEast = 10500;
  const groundSection = (id: string, left: number, right: number, near: number, far: number) => {
    road.box(parcel.name + "-" + id, m.road,
      [(left + right) / 2, ground.y - 5, (near + far) / 2], [right - left, 10, far - near]);
  };
  // Four abutting plots share the original ground's height and UV origin.
  groundSection("foreground", districtWest, districtEast, 4350, ground.nearZ);
  groundSection("west", districtWest, x0, ground.nearZ, ground.farZ);
  groundSection("east", x1, districtEast, ground.nearZ, ground.farZ);
  groundSection("rear", districtWest, districtEast, ground.farZ, 19820);
  road.finish();

  for (const b of industrialBuildings) {
    const yard = localGroup(root, "sidewalk-" + b.id);
    const batch = createBuildingGeometry(yard);
    const near = b.z - b.depth / 2;
    const width = b.width + 230;
    batch.box(yard.name, m.pavers, [b.x, ground.y + 14, near - 211], [width, 28, 420]);
    const count = Math.ceil(width / 460);
    const pitch = width / count;
    for (let i = 0; i < count; i++) {
      batch.box(yard.name + "-curb", m.trim, [b.x + ((i + .5) / count - .5) * width, ground.y + 13, near - 425],
        [pitch - 3, 26, 56]);
    }
    if (b.id === "gasworks" || b.id === "machine-workshops") {
      batch.box(yard.name, m.pavers, [b.x + b.width / 2 + 134, ground.y + 14, b.z - 165], [267, 28, b.depth + 324]);
    }
    batch.finish();
  }

  const gutter = localGroup(root, "drainage");
  const run = createBuildingGeometry(gutter);
  const { y } = ground;
  run.box(gutter.name + "-lane", m.trim, [335, y + 2, 13070], [156, 4, 7890]);
  for (const z of [9530, 12390, 16020]) {
    run.box(gutter.name + "-grate", m.steel, [337, y + 4, z], [146, 6, 229]);
    for (let slot = 0; slot < 6; slot++) {
      run.box(gutter.name + "-bars", m.cap, [337, y + 8, z + (slot - 2.5) * 34], [136, 5, 7]);
    }
  }
  run.finish();
}

function loadingStack(group: THREE.Group, m: IndustrialMaterials, x: number, y: number, z: number, stacked: boolean) {
  const batch = createBuildingGeometry(group);
  const crate = (px: number, pz: number, base: number, size: number) => {
    const centerY = y + base + size / 2;
    batch.box(group.name + "-crates", m.wood, [px, centerY, pz], [size, size, size]);
    for (const sign of [-1, 1]) {
      for (const offset of [-.42, .42]) {
        batch.box(group.name + "-battens", m.woodTrim, [px + offset * size, centerY, pz + sign * (size / 2 + 6)], [24, size, 12]);
        batch.box(group.name + "-battens", m.woodTrim, [px + sign * (size / 2 + 6), centerY, pz + offset * size], [12, size, 24]);
        batch.box(group.name + "-battens", m.woodTrim, [px, centerY + offset * size, pz + sign * (size / 2 + 6)], [size, 23, 12]);
        batch.box(group.name + "-battens", m.woodTrim, [px + sign * (size / 2 + 6), centerY + offset * size, pz], [12, 23, size]);
      }
    }
  };
  crate(x, z, 42, 331);
  crate(x - 380, z + 27, 42, 270);
  if (stacked) crate(x + 14, z + 26, 373, 248);
  for (let i = 0; i < 5; i++) {
    batch.box(group.name + "-pallet", m.woodTrim, [x - 154, y + 33, z + (i - 2) * 73], [780, 18, 58]);
  }
  for (const dx of [-480, -180, 130]) {
    batch.box(group.name + "-pallet", m.woodTrim, [x + dx, y + 12, z], [54, 24, 384]);
  }
  batch.finish();
}

function barrels(group: THREE.Group, m: IndustrialMaterials, x: number, y: number, z: number) {
  const profile = [[0, 0], [107, 0], [119, 18], [135, 91], [139, 158], [131, 224], [112, 292], [0, 292]]
    .map(([r, h]) => new THREE.Vector2(toWorld(r), toWorld(h)));
  const barrelShape = new THREE.LatheGeometry(profile, 14);
  const bandShape = new THREE.CylinderGeometry(.136, .136, .012, 14, 1, true);
  for (let i = 0; i < 2; i++) {
    const px = x + i * 303;
    const pz = z + i * 41;
    fixture(group, "barrel", barrelShape, m.wood, [px, y, pz]);
    for (const height of [89, 206]) fixture(group, "barrel-hoop", bandShape, m.steel, [px, y + height, pz]);
  }
}

function lamp(group: THREE.Group, m: IndustrialMaterials, x: number, y: number, z: number) {
  const path = new THREE.CatmullRomCurve3([
    [0, 0, 0], [0, 38, -83], [0, 149, -148], [0, 81, -288],
  ].map(([dx, dy, dz]) => new THREE.Vector3(toWorld(dx), toWorld(dy), toWorld(dz))));
  fixture(group, "gooseneck", new THREE.TubeGeometry(path, 8, .014, 6), m.steel, [x, y, z]);
  fixture(group, "shade", new THREE.CylinderGeometry(.052, .117, .071, 12), m.brass, [x, y + 40, z - 286]);
  fixture(group, "underside", new THREE.CylinderGeometry(.098, .092, .016, 12), m.roofLight, [x, y + 1, z - 286]);
}

export function addIndustrialFurniture(root: THREE.Group, m: IndustrialMaterials, y: number) {
  for (const [id, x, z, stack, lampHeight] of [
    ["gasworks", -4330, 8820, true, 1740],
    ["foundry", 6320, 8750, true, 1340],
    ["depot", -3380, 16175, false, 1690],
    ["yard-store", -680, 18030, false, 1680],
  ] as const) {
    const furnishing = localGroup(root, "loading-" + id);
    loadingStack(furnishing, m, x, y + 28, z, stack);
    barrels(furnishing, m, x + 450, y + 28, z + 24);
    const house = industrialBuildings.find(b => b.id === (id === "depot" ? "west-depot" : id === "foundry" ? "foundry-office" : id));
    if (house) lamp(furnishing, m, house.x, y + lampHeight, house.z - house.depth / 2 - 16);
  }

  const fence = localGroup(root, "yard-railing");
  const rails = createBuildingGeometry(fence);
  rails.box(fence.name + "-plinth", m.trim, [6904, y + 53, 8490], [1185, 106, 118]);
  for (const railY of [175, 471])
    rails.box(fence.name + "-crossbars", m.steel, [6904, y + railY, 8490], [1175, 22, 22]);
  for (let i = 0; i < 12; i++)
    rails.box(fence.name + "-pickets", m.steel, [6354 + i * 100, y + 308, 8490], [16, 394, 18]);
  rails.finish();

  for (const [id, positions] of [
    ["near-bollards", [[-3770, 8750], [-5640, 8705], [4390, 8705], [7470, 8710]]],
    ["lane-bollards", [[-3110, 11940], [-3140, 15000], [-2410, 16640], [-2400, 18510]]],
  ] as const) {
    const bollards = localGroup(root, id);
    const shape = new THREE.LatheGeometry([[0, 0], [.064, 0], [.064, .045], [.041, .07], [.03, .342], [.048, .364],
      [.044, .401], [.018, .431], [0, .431]].map(([radius, height]) => new THREE.Vector2(radius, height)), 10);
    for (const [x, z] of positions) fixture(bollards, "iron", shape, m.steel, [x, y, z]);
  }

  const chimney = localGroup(root, "works-chimney");
  const stack = new THREE.CylinderGeometry(.117, .238, 3.37, 14);
  // The texture's dimensions are metres; remap the cylinder course heights and circumference.
  const uv = stack.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.14, uv.getY(i) * 3.37);
  fixture(chimney, "taper", stack, m.cooler, [-5050, y + 1685, 18210]);
  const rim = new THREE.CylinderGeometry(.155, .149, .099, 14);
  for (const height of [1760, 3305, 3430])
    fixture(chimney, "cornice", rim, m.trim, [-5050, y + height, 18210]);
}
