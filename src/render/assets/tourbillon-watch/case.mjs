import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;

function part(parent, name, geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

/**
 * Revolve the closed meridian of a turned surface, following its outside from
 * rear to front. The outer cut is sampled around every flute. Blank faces,
 * flange lips and at-axis poles remain part of the same closed mesh.
 */
function turned(profile, segments, flutes = 0, cutDepth = 0, satinRows = null) {
  const coordinates = [];
  const indices = [];
  const rows = profile.map(([radius, z, cut = 0]) => {
    const ring = [];
    for (let column = 0; column < (radius === 0 ? 1 : segments); column += 1) {
      const angle = column * TAU / segments;
      const groove = 0.5 - 0.5 * Math.cos(flutes * angle);
      const r = radius - cut * cutDepth * groove ** 1.35;
      ring.push(coordinates.length / 3);
      coordinates.push(r * Math.cos(angle), r * Math.sin(angle), z);
    }
    return ring;
  });

  const geometry = new THREE.BufferGeometry();
  for (let row = 0; row < rows.length; row += 1) {
    const near = rows[row];
    const far = rows[(row + 1) % rows.length];
    if (near.length === 1 && far.length === 1) continue;
    const start = indices.length;
    for (let column = 0; column < segments; column += 1) {
      const next = (column + 1) % segments;
      const a = near[column % near.length];
      const b = near[next % near.length];
      const c = far[next % far.length];
      const d = far[column % far.length];
      if (a !== b) indices.push(a, b, d);
      if (c !== d) indices.push(b, c, d);
    }
    if (satinRows) {
      const useSatin = row >= satinRows[0] && row <= satinRows[1];
      const materialIndex = useSatin ? 1 : 0;
      const previous = geometry.groups.at(-1);
      if (previous?.materialIndex === materialIndex) {
        previous.count += indices.length - start;
      } else {
        geometry.addGroup(start, indices.length - start, materialIndex);
      }
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(coordinates, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function sapphireProfile(radius, back, front, dome) {
  // The sapphire has a nearly flat underside and blends to its faceted seat.
  const profile = [[0, back], [radius * 0.68, back], [radius * 0.96, back]];
  profile.push([radius - 0.035, back + 0.03], [radius, back + 0.085]);
  for (let i = 40; i >= 1; i -= 1) {
    const u = i / 40;
    const r = (radius - 0.035) * u;
    const localDome = dome * (1 - u * u);
    const edgeBlend = 0.055 * Math.max(0, (u - 0.92) / 0.08) ** 2;
    profile.push([r, front - dome + localDome - edgeBlend]);
  }
  profile.push([0, front]);
  return profile;
}

function addCaseShell(parent, material) {
  const band = [
    [19.25, -4.65], [20.54, -4.65], [20.65, -4.63], [20.79, -4.55],
    [20.91, -4.42], [20.98, -4.23], [21, -3.97], [21, -3.59, 0.06],
    [21, -3.47, 0.28], [21, -3.29, 0.68], [21, -3.07, 1],
    [21, 1.93, 1], [21, 2.22, 0.87], [21, 2.43, 0.55],
    [21, 2.63, 0.17], [20.99, 2.76, 0.02], [20.95, 2.9],
    [20.87, 3.06], [20.73, 3.2], [20.55, 3.32], [20.38, 3.4],
    [19.25, 3.4],
  ];
  part(parent, 'case-middle-fluted', turned(band, 960, 120, 0.28, [7, 14]),
    [material.gold, material.goldSatin]);

  const bezel = [
    [18.55, 3.37], [20.39, 3.37], [20.56, 3.42], [20.71, 3.51],
    [20.86, 3.66], [20.94, 3.83], [20.95, 4.00], [20.91, 4.17],
    [20.82, 4.34], [20.67, 4.52], [20.44, 4.69], [20.17, 4.82],
    [19.85, 4.9], [19.42, 4.92], [19.09, 4.90], [18.91, 4.84],
    [18.87, 4.66], [18.77, 4.56], [18.64, 4.51], [18.55, 4.44],
  ];
  part(parent, 'front-bezel', turned(bezel, 192), material.gold);
  part(parent, 'front-crystal-gasket', turned([
    [18.78, 4.59], [18.90, 4.59], [18.90, 4.79], [18.78, 4.79],
  ], 160), material.rubber);
  part(parent, 'front-sapphire',
    turned(sapphireProfile(18.92, 4.76, 6, 0.83), 192), material.glass);

  const back = [
    [17.60, -5.93], [17.63, -5.97], [17.76, -5.995], [19.73, -5.995],
    [20.06, -5.95], [20.33, -5.83], [20.54, -5.68], [20.70, -5.50],
    [20.78, -5.31], [20.79, -5.10], [20.75, -4.95], [20.67, -4.80],
    [20.54, -4.66], [20.31, -4.64], [19.44, -4.64], [19.37, -4.46],
    [18.11, -4.46], [18.06, -5.33], [17.76, -5.34], [17.62, -5.41],
  ];
  part(parent, 'exhibition-caseback-rim', turned(back, 192), material.gold);
  part(parent, 'rear-crystal-gasket', turned([
    [17.62, -5.80], [17.74, -5.80], [17.74, -5.37], [17.62, -5.37],
  ], 160), material.rubber);
  const rearCrystal = turned(sapphireProfile(17.67, 5.34, 6, 0.01), 192);
  rearCrystal.rotateY(Math.PI);
  part(parent, 'rear-sapphire', rearCrystal, material.glass);
}

function addCrown(parent, material) {
  const crown = new THREE.Group();
  crown.name = 'Winding crown';
  crown.position.z = -0.45;
  crown.rotation.y = Math.PI / 2;
  parent.add(crown);

  part(crown, 'crown-tube', turned([
    [0.54, 20.69], [1.05, 20.69], [1.42, 20.95], [1.45, 21.04],
    [1.45, 21.28], [1.27, 21.43], [0.54, 21.43],
  ], 64), material.goldSatin);
  part(crown, 'crown-stem', turned([
    [0, 20.65], [0.51, 20.65], [0.51, 21.72], [0, 21.72],
  ], 40), material.steel);
  part(crown, 'crown-neck-gasket', turned([
    [0.58, 21.40], [1.19, 21.40], [1.21, 21.49], [1.13, 21.58], [0.58, 21.58],
  ], 48), material.rubber);

  part(crown, 'scalloped-crown-body', turned([
    [0, 21.54], [1.87, 21.54], [2.00, 21.58], [2.22, 21.73],
    [2.43, 21.93, 0.12], [2.63, 22.12, 0.55], [2.73, 22.36, 1],
    [2.76, 22.62, 1], [2.76, 23.36, 1], [2.72, 23.68, 1],
    [2.65, 23.90, 0.8], [2.51, 24.10, 0.28], [2.33, 24.23],
    [2.16, 24.31], [1.89, 24.39], [1.53, 24.47], [0.96, 24.53],
    [0.48, 24.55], [0, 24.56],
  ], 320, 40, 0.26, [5, 10]), [material.gold, material.goldSatin]);
}

function lugBlank() {
  // The drill axis is the local extrusion axis. The YZ outline is swept down
  // to the spring bar, and its curved root follows the real case-band radius.
  const shape = new THREE.Shape();
  shape.moveTo(14.55, -2.95);
  shape.bezierCurveTo(15.21, -3.46, 18.32, -3.56, 20.23, -3.86);
  shape.bezierCurveTo(22.75, -4.10, 24.61, -4.28, 25.22, -3.16);
  shape.bezierCurveTo(25.83, -2.02, 25.34, -0.82, 24.54, -0.10);
  shape.bezierCurveTo(23.34, 0.94, 21.31, 1.40, 19.61, 1.80);
  shape.bezierCurveTo(18.05, 2.15, 16.67, 2.11, 14.55, 1.81);
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(23.6, -1.6, 0.64, 0, TAU, true);
  shape.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 2.81,
    bevelEnabled: true,
    bevelSize: 0.18,
    bevelThickness: 0.20,
    bevelSegments: 5,
    curveSegments: 16,
  });
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    const y = positions.getX(i);
    const z = positions.getY(i);
    const rootFlare = 0.24 * (1 - THREE.MathUtils.smoothstep(y, 18.4, 23.1));
    const tipTaper = 0.09 * THREE.MathUtils.smoothstep(y, 24.3, 25.6);
    const x = 11 + (0.20 + positions.getZ(i)) * (1 + rootFlare - tipTaper);
    const rootWeight = 1 - THREE.MathUtils.smoothstep(y, 14.45, 21.8);
    const saddle = Math.sqrt(20.7 ** 2 - x * x);
    positions.setXYZ(i, x, y + rootWeight * (saddle - 14.65), z);
  }
  return toCreasedNormals(geometry, Math.PI / 4);
}

function screwRim() {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 0.66, 0, TAU, false);
  const slot = new THREE.Path();
  slot.moveTo(-0.51, -0.095);
  slot.lineTo(-0.51, 0.095);
  slot.lineTo(0.51, 0.095);
  slot.lineTo(0.51, -0.095);
  slot.closePath();
  shape.holes.push(slot);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.085, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.028,
    bevelSegments: 2, curveSegments: 20,
  });
}

function addLugs(parent, material) {
  const lugs = new THREE.Group();
  lugs.name = 'Lugs and spring bars';
  parent.add(lugs);
  const blank = lugBlank();
  const screw = screwRim();
  const screwFloor = turned([[0, -0.055], [0.63, -0.055], [0.63, 0], [0, 0]], 48);
  const springBar = turned([
    [0, -14.1], [0.43, -14.1], [0.45, -14.03], [0.45, -10.85],
    [0.63, -10.85], [0.70, -10.73], [0.70, 10.73], [0.63, 10.85],
    [0.45, 10.85], [0.45, 14.03], [0.43, 14.1], [0, 14.1],
  ], 48);

  for (const sy of [-1, 1]) {
    const end = sy === 1 ? '12' : '6';
    const bar = part(lugs, `spring-bar-${end}`, springBar, material.steel);
    bar.position.set(0, sy * 23.6, -1.6);
    bar.rotation.y = Math.PI / 2;
    for (const sx of [-1, 1]) {
      const side = sx === 1 ? 'crown-side' : 'opposite-side';
      const lug = part(lugs, `swept-lug-${end}-${side}`, blank, material.gold);
      lug.scale.set(sx, sy, 1);
      const head = part(lugs, `lug-screw-${end}-${side}`, screw, material.goldSatin);
      head.position.set(sx * 14.135, sy * 23.6, -1.6);
      head.rotation.y = sx * Math.PI / 2;
      head.rotation.z = sy * 0.44;

      const seat = part(lugs, `lug-screw-slot-floor-${end}-${side}`, screwFloor,
        material.steelDark);
      seat.position.copy(head.position);
      seat.rotation.copy(head.rotation);
    }
  }
}

export function buildCase(materials) {
  const group = new THREE.Group();
  group.name = 'Case assembly';
  addCaseShell(group, materials);
  addLugs(group, materials);
  addCrown(group, materials);
  return group;
}
