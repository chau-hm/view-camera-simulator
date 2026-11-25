import * as THREE from "three";
import { UrbanGeometry, type Millimetres3 } from "./UrbanGeometry";
import type { UrbanMaterials } from "./UrbanMaterials";

type FacadeFinish = "limestone" | "tanBrick" | "umberBrick" | "plaster";
type Townhouse = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  eaves: number;
  roofRise: number;
  floors: number;
  bays: number;
  finish: FacadeFinish;
  shop?: true;
  dressed?: true;
};

const townhouses: readonly Townhouse[] = [
  { id: "east-corner-shop", x: 5090, z: 8450, width: 2280, depth: 1690, eaves: 2550, roofRise: 570, floors: 2, bays: 3, finish: "limestone", shop: true, dressed: true },
  { id: "east-pale-terrace", x: 4520, z: 10475, width: 2120, depth: 1380, eaves: 2730, roofRise: 520, floors: 2, bays: 3, finish: "plaster" },
  { id: "east-rear-terrace", x: 3780, z: 12375, width: 2400, depth: 1490, eaves: 2400, roofRise: 490, floors: 2, bays: 3, finish: "tanBrick" },
  { id: "east-lane-end", x: 6700, z: 12250, width: 2320, depth: 1720, eaves: 3000, roofRise: 670, floors: 3, bays: 3, finish: "umberBrick" },
  { id: "west-corner-house", x: -3780, z: 9625, width: 2440, depth: 2010, eaves: 2490, roofRise: 630, floors: 2, bays: 3, finish: "limestone", dressed: true },
  { id: "west-stone-row", x: -6510, z: 9695, width: 2400, depth: 1840, eaves: 2780, roofRise: 560, floors: 2, bays: 3, finish: "tanBrick" },
  { id: "west-rear-terrace", x: -3885, z: 12140, width: 1970, depth: 1940, eaves: 2750, roofRise: 570, floors: 2, bays: 2, finish: "plaster" },
  { id: "west-lane-end", x: -6300, z: 12190, width: 2200, depth: 1850, eaves: 2350, roofRise: 510, floors: 2, bays: 3, finish: "umberBrick" },
  { id: "west-row-extension", x: -9320, z: 9825, width: 2480, depth: 2130, eaves: 2920, roofRise: 640, floors: 3, bays: 3, finish: "plaster" },
  { id: "west-end-terrace", x: -12000, z: 10265, width: 2530, depth: 1800, eaves: 2540, roofRise: 610, floors: 2, bays: 3, finish: "umberBrick" },
  { id: "rear-court", x: -1570, z: 12450, width: 1760, depth: 1480, eaves: 2230, roofRise: 380, floors: 2, bays: 2, finish: "tanBrick" },
];

type Opening = {
  center: number;
  sill: number;
  top: number;
  width: number;
  kind: "sash" | "shop" | "door";
};

function addElevation(
  batch: UrbanGeometry,
  materials: UrbanMaterials,
  house: Townhouse,
  groundY: number,
  face: Readonly<{ x: number; z: number; angle: number; width: number; bays: number; front?: boolean }>,
) {
  const { x, z, angle, width } = face;
  const wallThickness = 140;
  const place = (material: THREE.Material, w: number, h: number, d: number, u: number, y: number, v: number) => {
    if (w <= 0 || h <= 0) return;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    batch.box(material, [w, h, d], [x + u * cos + v * sin, groundY + y, z - u * sin + v * cos], angle);
  };

  const openings: Opening[] = [];
  const pitch = width / (face.bays + .15);
  const floorHeight = house.eaves / house.floors;
  for (let story = 0; story < house.floors; story++) {
    if (!story && face.front && house.shop) {
      openings.push({
        kind: "shop", center: -width * .155, width: width * .58,
        sill: 150, top: 1000,
      }, { kind: "door", center: width * .31, width: 395, sill: 0, top: 1010 });
      continue;
    }
    for (let bay = 0; bay < face.bays; bay++) {
      const center = (bay - (face.bays - 1) / 2) * pitch;
      const door = !story && face.front && bay === Math.floor(face.bays / 2);
      const sill = door ? 0 : story * floorHeight + floorHeight * .29;
      openings.push({
        center, sill, top: door ? floorHeight * .79 : (story + .78) * floorHeight,
        width: door ? 380 : Math.min(410, pitch * .51),
        kind: door ? "door" : "sash",
      });
    }
  }

  // Solid horizontal beds and piers leave genuine openings at the sash and
  // door positions. Joinery sits well behind the outside face of the wall.
  const edges = [...new Set([0, house.eaves, ...openings.flatMap(o => [o.sill, o.top])])].sort((a, b) => a - b);
  const frontMaterial = materials[house.finish];
  for (let i = 1; i < edges.length; i++) {
    const lower = edges[i - 1];
    const upper = edges[i];
    const open = openings.filter(o => o.sill < upper && o.top > lower).sort((a, b) => a.center - b.center);
    let left = -width / 2;
    for (const { center, width: openingWidth } of open) {
      const right = center - openingWidth / 2;
      place(frontMaterial, right - left, upper - lower, wallThickness, (left + right) / 2, (lower + upper) / 2, wallThickness / 2);
      left = center + openingWidth / 2;
    }
    place(frontMaterial, width / 2 - left, upper - lower, wallThickness, (left + width / 2) / 2, (lower + upper) / 2, wallThickness / 2);
  }

  for (const { center: u, sill, top, width: w, kind } of openings) {
    const h = top - sill;
    const mid = (top + sill) / 2;
    const frame = kind === "shop" ? materials.paintedWood : materials.joinery;
    const casework = kind === "shop" ? frame : materials.band;
    const glass = kind === "shop" ? materials.shopGlass : materials.glass;
    place(kind === "door" ? frame : glass, w, h, 24, u, mid, 87);
    for (const side of [-1, 1]) {
      place(casework, 40, h + 25, 46, u + side * (w / 2 + 12), mid, -14);
      if (kind !== "door") {
        place(frame, 24, h, 25, u + side * (w / 2 - 12), mid, 63);
      }
    }
    place(casework, w + 75, 48, 65, u, top + 19, -21);
    place(casework, w + (kind === "door" ? 105 : 100), 38, 89, u, sill + 2, -29);
    if (house.dressed && kind !== "shop") {
      place(casework, w + 107, 21, 77, u, top + 48, -25);
      if (kind === "sash") {
        place(casework, w * .55, 22, 54, u, sill - 28, -14);
        place(materials.band, 72, 49, 49, u, top + 42, -44);
      }
    }
    if (kind === "door") {
      place(materials.band, w + 175, 37, 143, u, 18.5, -81);
      place(materials.timber, 26, 16, 20, u + w * .31, mid - 35, 67);
      for (const v of [.22, .64]) place(materials.paintedWood, w * .67, h * .21, 12, u, sill + h * v, 69);
    } else {
      place(frame, w, 22, 28, u, sill + h * .49, 61);
      const mullions = kind === "shop" ? [-.25, .25] : [0];
      for (const mullion of mullions) place(frame, 23, h, 28, u + w * mullion, mid, 61);
    }
  }

  for (const [y, height, depth] of [[house.eaves - 92, 47, 60], [house.eaves - 32, 56, 108]]) {
    place(materials.band, width + 26, height, depth, 0, y, 9);
  }
  if (house.dressed) {
    const brackets = Math.floor(width / 196);
    for (let i = 0; i < brackets; i++) {
      const u = ((i + 0.5) / brackets - 0.5) * width;
      place(materials.band, 55, 38, 56, u, house.eaves - 133, -15);
    }
  }
  if (face.front && house.shop) {
    const span = width * .67;
    place(materials.paintedWood, span + 75, 116, 81, -width * .13, 1122, -38);
    for (let stripe = 0; stripe < 12; stripe++) {
      const u = -width * .13 - span / 2 + span * (stripe + .5) / 12;
      const stripeMaterial = stripe % 2 === 0 ? materials.canvas : materials.canvasStripe;
      const points: Millimetres3[] = [
        [x + u - span / 24, groundY + 1083, z - 38], [x + u + span / 24, groundY + 1083, z - 38],
        [x + u - span / 24, groundY + 953, z - 304], [x + u + span / 24, groundY + 953, z - 304],
      ];
      batch.roof(stripeMaterial, points, [[0, 1, 2], [1, 3, 2]]);
      place(stripeMaterial, span / 12, 46, 20, u, 932, -302);
    }
  }
}

function addRoof(batch: UrbanGeometry, materials: UrbanMaterials, house: Townhouse, groundY: number) {
  const { x, z, width, depth, roofRise } = house;
  const y = groundY + house.eaves;
  const px = width / 2 + 67;
  const pz = depth / 2 + 64;
  const ridge = width * .31;
  const points: Millimetres3[] = [
    [x - px, y, z - pz], [x + px, y, z - pz], [x + px, y, z + pz], [x - px, y, z + pz],
    [x - ridge, y + roofRise, z], [x + ridge, y + roofRise, z],
  ];
  batch.roof(materials.roof, points, [[1, 0, 4], [1, 4, 5], [2, 1, 5], [3, 2, 5], [3, 5, 4], [0, 3, 4]]);
  batch.box(materials.roofCap, [ridge * 2, 30, 63], [x, y + roofRise - 8, z]);
  const chimneyX = x + ridge * (house.shop ? -.77 : .73);
  const chimneyY = y + roofRise + 28;
  const chimneyZ = z + depth * .11;
  batch.box(materials[house.finish], [302, 343, 247], [chimneyX, chimneyY, chimneyZ]);
  batch.box(materials.band, [339, 46, 282], [chimneyX, chimneyY + 178, chimneyZ]);
  for (const offset of [-82, 82]) {
    batch.tube(materials.chimneyPot, [chimneyX + offset, chimneyY + 196, chimneyZ],
      [chimneyX + offset, chimneyY + 298, chimneyZ], 49, 43);
  }
}

export function addUrbanBuildings(root: THREE.Group, materials: UrbanMaterials, groundY: number) {
  for (const house of townhouses) {
    const group = new THREE.Group();
    group.name = `architecture-rise-urban-building-${house.id}`;
    root.add(group);
    const batch = new UrbanGeometry(group);
    const { x, z, width, depth, bays } = house;
    addElevation(batch, materials, house, groundY, { x, z: z - depth / 2, angle: 0, width, bays, front: true });
    addElevation(batch, materials, house, groundY, { x, z: z + depth / 2, angle: Math.PI, width, bays });
    addElevation(batch, materials, house, groundY, {
      x: x + width / 2, z, angle: -Math.PI / 2, width: depth - 280, bays: 2,
    });
    addElevation(batch, materials, house, groundY, {
      x: x - width / 2, z, angle: Math.PI / 2, width: depth - 280, bays: 2,
    });
    addRoof(batch, materials, house, groundY);
    batch.mount();
  }
}
