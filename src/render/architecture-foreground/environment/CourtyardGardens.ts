import * as THREE from "three";
import { createBuildingGeometry, type PointMm } from "../BuildingGeometry";
import { toWorld } from "../../rttUtils";
import type { CourtyardMaterials } from "./CourtyardMaterials";

type Shapes = ReturnType<typeof createBuildingGeometry>;
const world = ([x, y, z]: PointMm) => new THREE.Vector3(toWorld(x), toWorld(y), toWorld(z));

function tube(shapes: Shapes, role: string, material: THREE.Material, a: PointMm, b: PointMm, base: number, tip = base) {
  const start = world(a);
  const end = world(b);
  const direction = end.clone().sub(start);
  const cylinder = new THREE.CylinderGeometry(toWorld(tip), toWorld(base), direction.length(), 7);
  cylinder.clearGroups();
  cylinder.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
  );
  cylinder.translate(...start.lerp(end, 0.5).toArray());
  shapes.add(role, material, cylinder);
}

function localRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function foliage(shapes: Shapes, materials: CourtyardMaterials, random: () => number) {
  const points: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const uv: number[] = [];
  const shade = new THREE.Color("#5b6b42");
  const sun = new THREE.Color("#a6ad60");
  const tint = new THREE.Color();
  const bladeUV = [0.5, 0, 0, 0.48, 0.5, 1, 1, 0.48, 0.5, 0.5];

  function cluster(center: PointMm, radius: PointMm, count: number, size: number, flower?: THREE.Color) {
    const [cx, cy, cz] = center;
    const origin = new THREE.Vector3();
    const blade = new THREE.Vector3();
    const width = new THREE.Vector3();
    const normal = new THREE.Vector3();
    for (let leaf = 0; leaf < count; leaf++) {
      const azimuth = random() * Math.PI * 2;
      const polar = random() * 2 - 1;
      const distance = Math.cbrt(0.12 + random() * 0.88);
      const horizontal = Math.sqrt(1 - polar * polar);
      origin.set(
        toWorld(cx + Math.cos(azimuth) * horizontal * radius[0] * distance),
        toWorld(cy + polar * radius[1] * distance),
        toWorld(cz + Math.sin(azimuth) * horizontal * radius[2] * distance),
      );
      const angle = random() * Math.PI * 2;
      const cross = (random() - 0.5) * 1.55;
      const length = toWorld(size * (0.58 + random() * 0.62));
      blade.set(Math.cos(angle), cross, Math.sin(angle)).normalize().multiplyScalar(length);
      width.set(-Math.sin(angle), (random() - 0.5) * 0.95, Math.cos(angle)).normalize().multiplyScalar(length * 0.48);
      normal.crossVectors(blade, width).normalize().multiplyScalar(length * 0.16);
      if (flower) tint.copy(flower).multiplyScalar(0.77 + random() * 0.31);
      else tint.lerpColors(shade, sun, random() * 0.82 + 0.08 + polar * 0.08);
      const i = points.length / 3;
      points.push(
        ...origin.clone().addScaledVector(blade, -0.48).toArray(),
        ...origin.clone().add(width).toArray(),
        ...origin.clone().addScaledVector(blade, 0.55).toArray(),
        ...origin.clone().sub(width).toArray(),
        ...origin.clone().add(normal).toArray(),
      );
      uv.push(...bladeUV);
      for (let vertex = 0; vertex < 5; vertex++) colors.push(tint.r, tint.g, tint.b);
      indices.push(i, i + 1, i + 4, i + 1, i + 2, i + 4, i + 2, i + 3, i + 4, i + 3, i, i + 4);
    }
  }

  function finish() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    shapes.add("foliage", materials.leaves, geometry);
  }
  return { cluster, finish };
}

function addTree(
  parent: THREE.Group, materials: CourtyardMaterials, id: string, x: number, y: number, z: number,
  height: number, spread: number, seed: number,
) {
  const group = new THREE.Group();
  group.name = "courtyard-vegetation-tree-" + id;
  group.position.copy(world([x, y, z]));
  parent.add(group);
  const shapes = createBuildingGeometry(group);
  const random = localRandom(seed);
  const leaves = foliage(shapes, materials, random);
  const fork: PointMm = [38, height * 0.44, -45];
  const crown: PointMm = [-57, height * 0.81, 38];
  tube(shapes, "bark", materials.bark, [0, 0, 0], fork, height * .031, height * .018);
  tube(shapes, "bark", materials.bark, fork, crown, height * .018, height * .006);
  for (let limb = 0; limb < 8; limb++) {
    const angle = limb * 2.399963 + random() * 0.48;
    const reach = spread * (0.61 + random() * 0.32);
    const forkHeight = height * (0.37 + limb * 0.049);
    const elbow: PointMm = [Math.cos(angle) * reach * 0.54, forkHeight + height * .16, Math.sin(angle) * reach * .54];
    const tip: PointMm = [Math.cos(angle) * reach, Math.min(height * .89, elbow[1] + height * .19), Math.sin(angle) * reach];
    const trunkRatio = Math.max(0, (forkHeight - fork[1]) / (crown[1] - fork[1]));
    const branchBase: PointMm = [THREE.MathUtils.lerp(fork[0], crown[0], trunkRatio),
      Math.max(forkHeight, fork[1]), THREE.MathUtils.lerp(fork[2], crown[2], trunkRatio)];
    tube(shapes, "bark", materials.bark, branchBase, elbow, 37 - limb * 2, 22 - limb);
    tube(shapes, "bark", materials.bark, elbow, tip, 22 - limb, 6);
    leaves.cluster(tip, [spread * .34, height * .131, spread * .36], 86, 137);
    for (const side of [-1, 1]) {
      const offshoot = angle + side * (0.4 + random() * .36);
      const twig: PointMm = [Math.cos(offshoot) * reach * .86, tip[1] + height * .06, Math.sin(offshoot) * reach * .86];
      tube(shapes, "bark", materials.bark, elbow, twig, 14, 4);
      leaves.cluster(twig, [spread * .29, height * .111, spread * .27], 51, 121);
    }
  }
  leaves.cluster([crown[0], height * .94, crown[2]], [spread * .33, height * .10, spread * .34], 113, 124);
  leaves.finish();
  shapes.finish();
}

function addBed(
  parent: THREE.Group, materials: CourtyardMaterials, id: string, x: number, groundY: number, z: number,
  width: number, depth: number, seed: number,
) {
  const planter = new THREE.Group();
  planter.name = "courtyard-furniture-planter-" + id;
  planter.position.copy(world([x, groundY, z]));
  parent.add(planter);
  const stone = createBuildingGeometry(planter);
  const rim = 104;
  for (const side of [-1, 1]) {
    const outerZ = side * (depth - rim) / 2;
    const outerX = side * (width - rim) / 2;
    stone.box("bed-wall", materials.trim, [0, 81, outerZ], [width, 162, rim]);
    stone.box("bed-wall", materials.trim, [outerX, 81, 0], [rim, 162, depth - 2 * rim]);
    stone.box("bed-coping", materials.cap, [0, 178, outerZ], [width + 22, 32, rim + 22]);
    stone.box("bed-coping", materials.cap, [outerX, 178, 0], [rim + 22, 32, depth - 2 * rim - 22]);
  }
  stone.box("soil", materials.soil, [0, 141, 0], [width - 2 * rim, 26, depth - 2 * rim]);
  stone.finish();

  const greenery = new THREE.Group();
  greenery.name = "courtyard-vegetation-border-" + id;
  greenery.position.copy(planter.position);
  parent.add(greenery);
  const plants = createBuildingGeometry(greenery);
  const random = localRandom(seed);
  const leaves = foliage(plants, materials, random);
  const lavender = new THREE.Color("#897a9a");
  const petals = new THREE.Color("#dad0ae");
  for (let u = -width / 2 + 220; u < width / 2 - 129; u += 172) {
    for (const side of [-1, 1]) {
      const along = side * (depth / 2 - 230);
      leaves.cluster([u, 295, along], [155, 130, 135], 58, 76);
    }
  }
  for (let index = 0; index < 9; index++) {
    const u = (random() - 0.5) * (width - 460);
    const v = (random() - 0.5) * (depth - 390);
    const smallBloom = index % 3 !== 0;
    leaves.cluster([u, 301, v], [124, 128, 106], 39, 92);
    leaves.cluster([u + 28, smallBloom ? 424 : 389, v + 14], [80, smallBloom ? 99 : 55, 75],
      43, smallBloom ? 42 : 55, smallBloom ? lavender : petals);
  }
  leaves.finish();
  plants.finish();
}

function addBench(
  parent: THREE.Group, materials: CourtyardMaterials, id: string, x: number, y: number, z: number, turn: number,
) {
  const group = new THREE.Group();
  group.name = "courtyard-furniture-bench-" + id;
  group.position.copy(world([x, y, z]));
  group.rotation.y = turn;
  parent.add(group);
  const shape = createBuildingGeometry(group);
  for (let i = 0; i < 4; i++) shape.box("oak", materials.oak, [0, 370, -110 + i * 75], [995, 47, 61]);
  for (let i = 0; i < 3; i++) shape.box("oak", materials.oak, [0, 472 + i * 79, 163 + i * 12], [995, 58, 29]);
  for (const u of [-442, 442]) {
    const frontFoot: PointMm = [u, 21, -155];
    const rearFoot: PointMm = [u, 21, 167];
    const frontSeat: PointMm = [u, 353, -116];
    const rearSeat: PointMm = [u, 350, 149];
    const arm: PointMm = [u, 517, -116];
    tube(shape, "iron", materials.iron, frontFoot, frontSeat, 28, 20);
    tube(shape, "iron", materials.iron, rearFoot, rearSeat, 26, 19);
    tube(shape, "iron", materials.iron, rearSeat, [u, 654, 192], 20, 17);
    tube(shape, "iron", materials.iron, frontSeat, rearSeat, 24);
    tube(shape, "iron", materials.iron, frontSeat, arm, 15, 13);
    tube(shape, "iron", materials.iron, arm, [u, 530, 153], 15, 12);
  }
  shape.finish();
}

function addTerrace(parent: THREE.Group, materials: CourtyardMaterials, id: string, x: number, y: number, z: number, length: number) {
  const group = new THREE.Group();
  group.name = "courtyard-furniture-balustrade-" + id;
  group.position.copy(world([x, y, z]));
  parent.add(group);
  const shape = createBuildingGeometry(group);
  shape.box("base", materials.trim, [0, 75, 0], [342, 150, length]);
  shape.box("top", materials.cap, [0, 591, 0], [266, 73, length]);
  for (let z = -length / 2 + 326; z < length / 2 - 190; z += 207) {
    const profile: PointMm[] = [[60, 0, 0], [60, 35, 0], [41, 46, 0], [40, 76, 0], [70, 126, 0],
      [68, 177, 0], [44, 247, 0], [36, 306, 0], [55, 354, 0], [55, 426, 0]];
    const spindle = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(toWorld(r), toWorld(y))), 9);
    spindle.translate(0, toWorld(144), toWorld(z));
    shape.add("balusters", materials.trim, spindle);
  }
  for (const end of [-1, 1]) {
    const along = end * (length / 2 - 155);
    shape.box("piers", materials.plinth, [0, 311, along], [355, 622, 309]);
    shape.box("top", materials.cap, [0, 652, along], [411, 64, 379]);
  }
  shape.finish();
}

function addLantern(parent: THREE.Group, materials: CourtyardMaterials, id: string, x: number, y: number, z: number, wallSide: number) {
  const group = new THREE.Group();
  group.name = "courtyard-furniture-lantern-" + id;
  group.position.copy(world([x, y, z]));
  parent.add(group);
  const shape = createBuildingGeometry(group);
  shape.box("iron", materials.iron, [wallSide * 148, 36, 0], [25, 222, 84]);
  tube(shape, "iron", materials.iron, [wallSide * 138, -30, 0], [0, -103, 0], 14);
  shape.box("iron", materials.iron, [0, -83, 0], [117, 21, 117]);
  shape.box("glass", materials.lanternPane, [0, 12, 0], [104, 178, 104]);
  shape.box("iron", materials.iron, [0, 108, 0], [136, 24, 136]);
  for (const dx of [-58, 58]) {
    for (const dz of [-58, 58]) {
      shape.box("iron", materials.iron, [dx, 13, dz], [12, 185, 12]);
    }
  }
  tube(shape, "iron", materials.iron, [0, 119, 0], [0, 185, 0], 90, 17);
  tube(shape, "iron", materials.iron, [0, 174, 0], [0, 204, 0], 15, 5);
  shape.finish();
}

function addUrn(parent: THREE.Group, materials: CourtyardMaterials, y: number, x: number, z: number) {
  const group = new THREE.Group();
  group.name = "courtyard-furniture-terrace-urn";
  group.position.copy(world([x, y, z]));
  parent.add(group);
  const shapes = createBuildingGeometry(group);
  shapes.box("pedestal", materials.trim, [0, 150, 0], [374, 300, 374]);
  shapes.box("pedestal-cap", materials.cap, [0, 302, 0], [430, 58, 430]);
  const profile = [[124, 330], [124, 369], [87, 395], [75, 433], [154, 496],
    [181, 565], [191, 640], [207, 678], [194, 700], [172, 692], [161, 631], [0, 594]];
  const bowl = new THREE.LatheGeometry(profile.map(([radius, h]) => new THREE.Vector2(toWorld(radius), toWorld(h))), 18);
  shapes.add("urn", materials.cap, bowl);
  const plants = foliage(shapes, materials, localRandom(719));
  plants.cluster([0, 716, 0], [208, 112, 208], 168, 102);
  plants.cluster([28, 785, -13], [182, 100, 175], 59, 54, new THREE.Color("#ded4b8"));
  plants.finish();
  shapes.finish();
}

export function addCourtyardGardens(parent: THREE.Group, materials: CourtyardMaterials, groundY: number) {
  addBed(parent, materials, "east", 4540, groundY, 7470, 1750, 1720, 71);
  addBed(parent, materials, "west", -4580, groundY, 6710, 1990, 2100, 179);
  addTree(parent, materials, "east", 4480, groundY + 154, 7540, 2590, 970, 95);
  addTree(parent, materials, "west", -4440, groundY + 154, 6680, 2500, 1080, 173);
  addBench(parent, materials, "east", 4490, groundY, 6310, 0);
  addBench(parent, materials, "west", -4610, groundY, 5470, 0.09);

  addTerrace(parent, materials, "east", 6320, groundY, 3260, 4430);
  addTerrace(parent, materials, "west", -7240, groundY, 4250, 1730);
  addBed(parent, materials, "east-terrace", 6890, groundY, 4190, 861, 2480, 253);

  addUrn(parent, materials, groundY, 6660, 1290);
  for (const [index, z] of [7160, 9160, 10160].entries()) {
    addLantern(parent, materials, "east-" + index, 5660, groundY + 1580, z, 1);
  }
  for (const [index, z] of [8480, 9560, 10640].entries()) {
    addLantern(parent, materials, "west-" + index, -5605, groundY + 1490, z, -1);
  }

  addTree(parent, materials, "east-roofs", 7820, groundY, 13080, 3320, 1040, 418);
  addTree(parent, materials, "west-roofs", -7580, groundY, 12450, 3580, 880, 47);
}
