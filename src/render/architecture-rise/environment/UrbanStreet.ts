import * as THREE from "three";
import { toWorld } from "../../rttUtils";
import { UrbanGeometry, type Millimetres3 } from "./UrbanGeometry";
import type { UrbanMaterials } from "./UrbanMaterials";

function localGroup(root: THREE.Group, label: string) {
  const group = new THREE.Group();
  group.name = "architecture-rise-urban-" + label;
  root.add(group);
  return group;
}

function pavedSurface(
  root: THREE.Group,
  name: string,
  material: THREE.Material,
  bounds: readonly [number, number, number, number],
  y: number,
  tile: readonly [number, number],
) {
  const [west, east, front, back] = bounds;
  const geometry = new THREE.PlaneGeometry(toWorld(east - west), toWorld(back - front));
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) * 1000 + (east + west) / 2;
    const z = position.getZ(i) * 1000 + (back + front) / 2;
    uv.setXY(i, x / tile[0], z / tile[1]);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(toWorld((west + east) / 2), toWorld(y), toWorld((front + back) / 2));
  root.add(mesh);
}

export function addUrbanStreet(root: THREE.Group, m: UrbanMaterials, groundY: number) {
  const [front, back] = [-2000, 13520];
  const street = localGroup(root, "street");
  pavedSurface(street, "architecture-rise-urban-sett-pavement", m.setts, [-8000, 8000, front, back], groundY + 3, [1090, 710]);
  // The existing raised near pavement sits inside this open street apron.
  // Sidewalks stop short of the teaching frontage and the canonical cube sites.
  for (const [label, west, east, start, end] of [
    ["west-walk", -7990, -2310, 8040, 13430],
    ["east-walk", 3450, 7990, 7180, 13430],
    ["hero-apron", -1620, 2000, 8370, 10890],
  ] as const) {
    const group = localGroup(street, label);
    const curb = new UrbanGeometry(group);
    const sidewalkTop = groundY + 32;
    pavedSurface(group, group.name + "-pavement", m.flags, [west, east, start, end], sidewalkTop, [1480, 1810]);
    const buildCurb = (length: number, x: number, z: number, longitudinal: boolean) => {
      const count = Math.ceil(length / 445);
      const pitch = length / count;
      for (let i = 0; i < count; i++) {
        const along = (i + .5) * pitch - length / 2;
        curb.box(m.pavingTrim, longitudinal ? [64, 35, pitch - 4] : [pitch - 4, 35, 64],
          [x + (longitudinal ? 0 : along), sidewalkTop - 12, z + (longitudinal ? along : 0)]);
      }
    };
    buildCurb(east - west, (west + east) / 2, start, false);
    const laneEdge = west < -2000 ? east : west;
    buildCurb(end - start - 70, laneEdge, (start + end) / 2 + 35, true);
    curb.box(m.drainage, [east - west, 5, 54], [(west + east) / 2, groundY + 5, start - 64]);
    curb.mount();
  }
  pavedSurface(street, "architecture-rise-urban-foreground-pavement", m.flags, [-8000, 8000, -2000, 1660], groundY + 8, [1870, 1960]);
}

function addBollards(root: THREE.Group, m: UrbanMaterials, y: number, name: string, positions: readonly (readonly [number, number])[]) {
  const batch = new UrbanGeometry(localGroup(root, name));
  for (const [x, z] of positions) {
    batch.tube(m.iron, [x, y, z], [x, y + 43, z], 78, 69);
    batch.tube(m.iron, [x, y + 43, z], [x, y + 382, z], 47, 31);
    batch.tube(m.iron, [x, y + 352, z], [x, y + 385, z], 38, 42);
    batch.round(m.iron, new THREE.SphereGeometry(.042, 8, 5), [x, y + 405, z]);
  }
  batch.mount();
}

function addLamp(root: THREE.Group, m: UrbanMaterials, x: number, y: number, z: number, label: string) {
  const batch = new UrbanGeometry(localGroup(root, label));
  batch.tube(m.iron, [x, y, z], [x, y + 115, z], 87, 56);
  batch.tube(m.iron, [x, y + 115, z], [x, y + 1120, z], 44, 21);
  batch.tube(m.iron, [x, y + 1110, z], [x, y + 1190, z], 41, 68);
  batch.round(m.lampPane, new THREE.CylinderGeometry(.106, .058, .24, 4).rotateY(Math.PI / 4), [x, y + 1310, z]);
  const lower = 38;
  const upper = 74;
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
    batch.tube(m.iron, [x + dx * lower, y + 1190, z + dz * lower],
      [x + dx * upper, y + 1430, z + dz * upper], 9);
  }
  batch.round(m.iron, new THREE.CylinderGeometry(.022, .115, .107, 4).rotateY(Math.PI / 4), [x, y + 1482, z]);
  batch.round(m.iron, new THREE.SphereGeometry(.022, 8, 5), [x, y + 1551, z]);
  batch.mount();
}

function addTree(root: THREE.Group, m: UrbanMaterials, x: number, y: number, z: number, size: number, label: string) {
  const batch = new UrbanGeometry(localGroup(root, label));
  const at = (dx: number, dy: number, dz: number): Millimetres3 => [x + dx * size, y + dy * size, z + dz * size];
  batch.box(m.iron, [398, 20, 390], [x, y + 7, z]);
  batch.tube(m.treeBark, at(0, 0, 0), at(-23, 1000, 30), 56 * size, 36 * size);
  batch.tube(m.treeBark, at(-23, 1000, 30), at(48, 1650, 16), 36 * size, 16 * size);
  const foliage = [m.leafShade, m.leaf, m.leafLight];
  for (let branch = 0; branch < 7; branch++) {
    const angle = branch * 2.399963;
    const low = 1020 + branch * 39;
    const spread = 425 - branch * 20;
    const dx = Math.cos(angle) * spread;
    const dz = Math.sin(angle) * spread;
    const by = 1540 + branch * 69;
    batch.tube(m.treeBark, at(-23, low, 20), at(dx, by, dz), 22 * size, 9 * size);
    for (let lobe = 0; lobe < 5; lobe++) {
      const a = angle + lobe * 1.256637;
      const radius = (185 + ((branch * 13 + lobe * 53) % 91)) * size;
      const c = at(dx + Math.cos(a) * 138, by + (lobe % 3) * 97, dz + Math.sin(a) * 137);
      const geometry = new THREE.IcosahedronGeometry(toWorld(radius), 1);
      batch.round(foliage[(branch + lobe) % foliage.length], geometry, c, [1.12, .83, 1]);
    }
  }
  batch.mount();
}

function addBenchAndRailing(root: THREE.Group, m: UrbanMaterials, y: number) {
  const bench = new UrbanGeometry(localGroup(root, "west-bench"));
  for (const x of [-5010, -4320]) {
    bench.tube(m.iron, [x, y, 8190], [x, y + 322, 8223], 19);
    bench.tube(m.iron, [x, y, 8440], [x, y + 620, 8405], 19);
    bench.box(m.iron, [37, 30, 296], [x, y + 318, 8300]);
  }
  for (const z of [8200, 8262, 8324, 8386]) bench.box(m.timber, [864, 28, 51], [-4665, y + 341, z]);
  for (const h of [461, 518, 575]) bench.box(m.timber, [864, 46, 25], [-4665, y + h, 8390]);
  bench.mount();

  const railing = new UrbanGeometry(localGroup(root, "west-garden-railing"));
  railing.box(m.pavingTrim, [2225, 204, 230], [-6670, y + 102, 8530]);
  railing.box(m.band, [2225, 36, 258], [-6670, y + 222, 8530]);
  for (const height of [257, 540]) railing.box(m.iron, [2200, 22, 28], [-6670, y + height, 8530]);
  for (let i = 0; i < 20; i++) {
    const x = -7734 + i * 112;
    railing.tube(m.iron, [x, y + 235, 8530], [x, y + 575, 8530], 11);
  }
  for (const x of [-7790, -5530]) {
    railing.box(m.pavingTrim, [228, 618, 281], [x, y + 309, 8530]);
    railing.box(m.band, [253, 52, 305], [x, y + 632, 8530]);
  }
  railing.mount();
}

export function addStreetFurniture(root: THREE.Group, m: UrbanMaterials, groundY: number) {
  const y = groundY + 32;
  addBollards(root, m, y, "west-bollards", [[-2660, 8190], [-3650, 8190], [-5210, 8190], [-6140, 8190]]);
  addBollards(root, m, y, "east-bollards", [[3650, 7370], [4710, 7370], [5840, 7370], [3610, 9740]]);
  addLamp(root, m, -3370, y, 8220, "west-lantern");
  addLamp(root, m, 3650, y, 7600, "east-lantern");
  addLamp(root, m, 3360, y, 11640, "lane-lantern");
  addTree(root, m, -5040, y, 8075, .90, "west-street-tree");
  addTree(root, m, 3290, groundY + 4, 10450, .76, "east-lane-tree");
  addTree(root, m, -5270, y, 10860, 1.02, "rear-street-tree");
  addBenchAndRailing(root, m, y);
}
