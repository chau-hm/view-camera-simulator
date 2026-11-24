import * as THREE from "three";
import { createBuildingGeometry, type PointMm } from "../BuildingGeometry";
import { toWorld } from "../../rttUtils";
import type { IndustrialMaterials } from "./IndustrialMaterials";

type Roof = "gable" | "north-light" | "flat";
type Building = Readonly<{
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  eaves: number;
  rise: number;
  roof: Roof;
  frontBays: number;
  sideBays: number;
  floors: number;
  finish: "warmer" | "cooler";
}>;

export const industrialBuildings: readonly Building[] = [
  { id: "foundry-office", x: 5650, z: 10220, width: 3020, depth: 2510, eaves: 2710, rise: 670, roof: "gable", frontBays: 3, sideBays: 3, floors: 2, finish: "warmer" },
  { id: "ironworks", x: 6530, z: 14675, width: 2930, depth: 2870, eaves: 2160, rise: 790, roof: "north-light", frontBays: 3, sideBays: 3, floors: 1, finish: "cooler" },
  { id: "engine-shop", x: 9050, z: 11750, width: 2380, depth: 2900, eaves: 1980, rise: 535, roof: "gable", frontBays: 3, sideBays: 3, floors: 1, finish: "cooler" },
  { id: "east-warehouse", x: 7500, z: 18110, width: 3260, depth: 2560, eaves: 2160, rise: 450, roof: "gable", frontBays: 4, sideBays: 3, floors: 1, finish: "warmer" },
  { id: "gasworks", x: -4910, z: 10265, width: 2630, depth: 2310, eaves: 2020, rise: 680, roof: "gable", frontBays: 3, sideBays: 3, floors: 1, finish: "warmer" },
  { id: "machine-workshops", x: -4770, z: 13765, width: 2690, depth: 3370, eaves: 1970, rise: 710, roof: "north-light", frontBays: 3, sideBays: 4, floors: 1, finish: "cooler" },
  { id: "west-depot", x: -3940, z: 17760, width: 2720, depth: 2850, eaves: 1950, rise: 480, roof: "gable", frontBays: 3, sideBays: 3, floors: 1, finish: "warmer" },
  { id: "yard-store", x: -1130, z: 18940, width: 2280, depth: 1470, eaves: 2050, rise: 0, roof: "flat", frontBays: 3, sideBays: 2, floors: 1, finish: "cooler" },
  { id: "outer-forge", x: -7690, z: 14015, width: 2160, depth: 3050, eaves: 2150, rise: 570, roof: "gable", frontBays: 3, sideBays: 3, floors: 1, finish: "warmer" },
];

type Face = { axis: 0 | 2; sign: -1 | 1; span: number; plane: number; bays: number; loading?: boolean };

function addElevation(
  box: ReturnType<typeof createBuildingGeometry>["box"],
  group: THREE.Group,
  b: Building,
  m: IndustrialMaterials,
  y0: number,
  face: Face,
) {
  const { axis, sign, span, plane, bays } = face;
  const thickness = 145;
  const center = axis === 0 ? b.x : b.z;
  const part = (role: string, material: THREE.Material, u: number, y: number, depth: number, w: number, h: number, d: number) => {
    if (w <= 0 || h <= 0) return;
    const position: PointMm = axis === 0 ? [center + u, y0 + y, plane + sign * depth] : [plane + sign * depth, y0 + y, center + u];
    const size: PointMm = axis === 0 ? [w, h, d] : [d, h, w];
    box(group.name + "-" + role, material, position, size);
  };
  const pitch = span / (bays + .25);
  const floorHeight = b.eaves / b.floors;
  for (let row = 0; row < b.floors; row++) {
    const isLoading = row === 0 && face.loading;
    const low = row * floorHeight;
    const sill = low + floorHeight * .29;
    const head = low + floorHeight * .79;
    const apertures = Array.from({ length: bays }, (_, i) => {
      const loading = Boolean(isLoading && i === Math.floor((bays - 1) / 2));
      return {
        u: (i - (bays - 1) / 2) * pitch,
        w: pitch * (loading ? .82 : .55),
        sill: loading ? low + 38 : sill,
        loading,
      };
    });

    // Beds and piers carry the wall. Each aperture remains open for its
    // entire depth until the inset steel sash or loading-door panel.
    const levels = [...new Set([low, ...apertures.map(a => a.sill), head, low + floorHeight])].sort((a, b) => a - b);
    for (let i = 1; i < levels.length; i++) {
      const bottom = levels[i - 1];
      const top = levels[i];
      const mid = (bottom + top) / 2;
      let left = -span / 2;
      for (const opening of apertures.filter(a => a.sill < top && head > bottom)) {
        const right = opening.u - opening.w / 2;
        part("wall", m[b.finish], (left + right) / 2, mid, -thickness / 2, right - left, top - bottom, thickness);
        left = opening.u + opening.w / 2;
      }
      part("wall", m[b.finish], (left + span / 2) / 2, mid, -thickness / 2, span / 2 - left, top - bottom, thickness);
    }

    for (const a of apertures) {
      const height = head - a.sill;
      const mid = (head + a.sill) / 2;
      part(a.loading ? "loading-doors" : "sash-panes", a.loading ? m.timber : m.factoryGlass,
        a.u, mid, -91, a.w - 2, height - 2, 22);
      part("surrounds", m.trim, a.u, head + 17, 19, a.w + 98, 61, 59);
      part("surrounds", m.trim, a.u, a.sill - 7, 20, a.w + 88, 35, 67);
      for (const d of [-1, 1]) {
        part("sash-bars", m.steel, a.u + d * (a.w / 2 - 10), mid, -68, 18, height, 26);
      }
      for (const f of a.loading ? [-.33, -.16, 0, .16, .33] : [-.18, .18]) {
        part(a.loading ? "loading-doors" : "sash-bars", a.loading ? m.timber : m.steel,
          a.u + f * a.w, mid, -70, a.loading ? 13 : 18, height, 22);
      }
      for (const f of a.loading ? [.17, .79] : [.28, .52, .76]) {
        part("sash-bars", m.steel, a.u, a.sill + f * height, -67, a.w, 17, 17);
      }
      if (a.loading) {
        part("surrounds", m.trim, a.u, 22, 96, a.w + 139, 44, 184);
      }
    }
  }
  part("surrounds", m.trim, 0, b.eaves - 36, 10, span + 24, 52, 82);
}

function panel(group: THREE.Group, name: string, material: THREE.Material, points: readonly PointMm[]) {
  const positions = points.flatMap(p => p.map(toWorld));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const indices = points.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  const side = Math.abs(normals.getX(0)) > 0.65;
  const vertical = Math.abs(normals.getY(0)) < 0.55;
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(points.flatMap(([x, y, z]) => [
    toWorld(side ? z : x),
    toWorld(vertical ? y : z + y * 0.25),
  ]), 2));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = group.name + "-" + name;
  group.add(mesh);
}

function addRoof(group: THREE.Group, b: Building, m: IndustrialMaterials, y0: number, batch: ReturnType<typeof createBuildingGeometry>) {
  const y = y0 + b.eaves;
  const l = b.x - b.width / 2, r = b.x + b.width / 2;
  const n = b.z - b.depth / 2, f = b.z + b.depth / 2;
  const left = l - 53, right = r + 53, near = n - 47, far = f + 47;
  const box = (name: string, mat: THREE.Material, center: PointMm, size: PointMm) => batch.box(group.name + "-" + name, mat, center, size);
  const roof = (points: readonly PointMm[]) => panel(group, "roof", m.slate, points);
  if (b.roof === "flat") {
    box("roof", m.slate, [b.x, y + 5, b.z], [b.width + 92, 55, b.depth + 92]);
    for (const z of [n, f]) box("coping", m.cap, [b.x, y + 92, z], [b.width + 94, 141, 89]);
    for (const x of [l, r]) box("coping", m.cap, [x, y + 92, b.z], [89, 141, b.depth - 89]);
    return;
  }
  if (b.roof === "north-light") {
    const bays = 3;
    for (let i = 0; i < bays; i++) {
      const start = near + i * (far - near) / bays;
      const end = near + (i + 1) * (far - near) / bays;
      const peak = start + 105;
      const top = y + b.rise;
      roof([[left, top, peak], [left, y, end], [right, y, end], [right, top, peak]]);
      panel(group, "north-light", m.roofLight, [[left, y, start], [left, top, peak], [right, top, peak], [right, y, start]]);
      panel(group, "roof-gable", m[b.finish], [[left, y, start], [left, y, end], [left, top, peak]]);
      panel(group, "roof-gable", m[b.finish], [[right, y, end], [right, y, start], [right, top, peak]]);
      box("roof-flashing", m.cap, [b.x, top, peak], [b.width + 108, 25, 51]);
      for (let j = 0; j <= 6; j++) {
        const x = l + b.width * j / 6;
        box("north-light-mullions", m.steel, [x, y + b.rise / 2, (start + peak) / 2 - 11], [24, b.rise - 20, 102]);
      }
    }
    return;
  }
  const peak = y + b.rise;
  roof([[left, y, near], [left, y, far], [b.x, peak, far], [b.x, peak, near]]);
  roof([[b.x, peak, near], [b.x, peak, far], [right, y, far], [right, y, near]]);
  panel(group, "roof-gable", m[b.finish], [[l, y, n], [b.x, peak - 19, n], [r, y, n]]);
  panel(group, "roof-gable", m[b.finish], [[r, y, f], [b.x, peak - 19, f], [l, y, f]]);
  box("roof-flashing", m.cap, [b.x, peak, b.z], [44, 26, b.depth + 96]);
  if (b.id === "gasworks" || b.id === "foundry-office") {
    // The roof light sits parallel to the Observer-facing slope.
    const side = -1;
    const wide = b.width / 2;
    const nearLight = b.z - b.depth * .29;
    const farLight = b.z + b.depth * .26;
    const low = b.x + side * wide * .78;
    const high = b.x + side * wide * .31;
    const highY = y + b.rise * .69 + 27;
    const lowY = y + b.rise * .22 + 27;
    panel(group, "raised-roof-light", m.roofLight, [[low, lowY, nearLight], [low, lowY, farLight], [high, highY, farLight], [high, highY, nearLight]]);
    for (const [x, railY] of [[low, lowY], [high, highY]]) {
      box("light-curb", m.steel, [x, railY - 13, (nearLight + farLight) / 2], [38, 49, farLight - nearLight + 24]);
    }
    for (let i = 0; i <= 4; i++) {
      const z = nearLight + i * (farLight - nearLight) / 4;
      panel(group, "roof-light-dividers", m.steel, [[low, lowY + 3, z - 10], [low, lowY + 3, z + 10], [high, highY + 3, z + 10], [high, highY + 3, z - 10]]);
    }
  }
}

export function addIndustrialBuildings(root: THREE.Group, materials: IndustrialMaterials, groundY: number) {
  for (const b of industrialBuildings) {
    const group = new THREE.Group();
    group.name = "oblique-architecture-industrial-building-" + b.id;
    root.add(group);
    const batch = createBuildingGeometry(group);
    for (const sign of [-1, 1] as const) {
      addElevation(batch.box, group, b, materials, groundY, {
        axis: 0, sign, span: b.width, plane: b.z + sign * b.depth / 2, bays: b.frontBays, loading: sign < 0,
      });
      addElevation(batch.box, group, b, materials, groundY, {
        axis: 2, sign, span: b.depth - 290, plane: b.x + sign * b.width / 2, bays: b.sideBays,
      });
    }
    addRoof(group, b, materials, groundY, batch);
    batch.finish();
  }
}
