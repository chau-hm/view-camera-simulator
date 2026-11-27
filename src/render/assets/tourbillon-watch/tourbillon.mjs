import * as THREE from "three";

const TAU = Math.PI * 2;
const RADIANS = Math.PI / 180;
const polar = (radius, angle) => [radius * Math.cos(angle), radius * Math.sin(angle)];

function mesh(parent, name, geometry, material, x = 0, y = 0, z = 0) {
  const part = new THREE.Mesh(geometry, material);
  part.name = name;
  part.position.set(x, y, z);
  parent.add(part);
  return part;
}

function assembly(parent, name, x = 0, y = 0) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(x, y, 0);
  parent?.add(group);
  return group;
}

function circleHole(shape, x, y, radius) {
  const hole = new THREE.Path();
  // Keep holes counterclockwise even on explicitly clockwise outer curves.
  hole.absarc(x, y, radius, 0, TAU, false);
  shape.holes.push(hole);
}

function outline(points) {
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
}

function plate(shape, lo, hi, bevel = 0.04, segments = 16) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: hi - lo - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: segments,
  });
  geometry.translate(0, 0, lo + bevel);
  return geometry;
}

function ringGeometry(inner, outer, lo, hi, bevel, segments) {
  // Start the meridian on the underside to put the profile seam on a flat.
  const mid = (inner + outer) / 2;
  const profile = [
    [mid, lo], [outer - bevel, lo], [outer, lo + bevel],
    [outer, hi - bevel], [outer - bevel, hi], [inner + bevel, hi],
    [inner, hi - bevel], [inner, lo + bevel], [inner + bevel, lo], [mid, lo],
  ].map(([radius, z]) => new THREE.Vector2(radius, z));
  return new THREE.LatheGeometry(profile, segments).rotateX(Math.PI / 2);
}

function ring(parent, name, material, x, y, inner, outer, lo, hi, bevel = 0.025, segments = 56) {
  return mesh(parent, name, ringGeometry(inner, outer, lo, hi, bevel, segments), material, x, y);
}

function cylinderGeometry(radius, lo, hi, segments = 32) {
  const geometry = new THREE.CylinderGeometry(radius, radius, hi - lo, segments);
  return geometry.rotateX(Math.PI / 2).translate(0, 0, (lo + hi) / 2);
}

function cylinder(parent, name, material, x, y, radius, lo, hi, segments) {
  return mesh(parent, name, cylinderGeometry(radius, lo, hi, segments), material, x, y);
}

function screwCrown(radius, height, slotHalfWidth) {
  const angle = Math.asin(slotHalfWidth / radius);
  const reach = radius * Math.cos(angle);
  // Split the head along its actual milled slot. Both lobes sit on the same
  // solid head base, whose exposed centre is the floor of the slot.
  const upper = new THREE.Shape();
  upper.moveTo(reach, slotHalfWidth);
  upper.absarc(0, 0, radius, angle, Math.PI - angle, false);
  upper.lineTo(reach, slotHalfWidth);

  const lower = new THREE.Shape();
  lower.moveTo(-reach, -slotHalfWidth);
  lower.absarc(0, 0, radius, Math.PI + angle, TAU - angle, false);
  lower.lineTo(-reach, -slotHalfWidth);
  const geometry = new THREE.ExtrudeGeometry([upper, lower], {
    depth: height, bevelEnabled: false, curveSegments: 12,
  });
  geometry.computeBoundingBox();
  return geometry;
}

function screwParts(radius, height, slotHalfWidth) {
  return {
    base: cylinderGeometry(radius, -height * 0.64, height * 0.38),
    crown: screwCrown(radius, height * 0.62, slotHalfWidth).translate(0, 0, height * 0.38),
  };
}

function screw(parent, name, fastener, material, x, y, z, clocking = 0) {
  const head = assembly(parent, name, x, y);
  head.position.z = z;
  head.rotation.z = clocking;
  mesh(head, "Slotted screw base", fastener.base, material);
  mesh(head, "Milled screw head", fastener.crown, material);
  return head;
}

function jewelBearing(parent, name, surfaces, x, y, seat, scale = 1) {
  const bearing = assembly(parent, name, x, y);
  bearing.position.z = seat;
  bearing.scale.setScalar(scale);
  ring(bearing, "Gold chaton", surfaces.brass, 0, 0, 0.34, 0.51, -0.12, 0.13, 0.045, 40);
  ring(bearing, "Pierced ruby bearing", surfaces.ruby, 0, 0, 0.17, 0.34, -0.065, 0.19, 0.06, 48);
  return bearing;
}

function gearShape(teeth, root, tip, hole, swept = false) {
  const pitch = TAU / teeth;
  const flank = swept
    ? [[0.02, root], [0.31, root], [0.64, tip], [0.75, tip], [0.82, root]]
    : [[0.02, root], [0.20, root], [0.34, tip], [0.65, tip], [0.79, root]];
  const points = [];
  for (let i = 0; i < teeth; i += 1) {
    for (const [phase, radius] of flank) points.push(polar(radius, (i + phase) * pitch));
  }
  const shape = outline(points);
  if (hole > 0) circleHole(shape, 0, 0, hole);
  return shape;
}

function spoke(parent, name, material, profile, angle, lo, hi, bevel) {
  const part = mesh(parent, name, plate(outline(profile), lo, hi, bevel), material);
  part.rotation.z = angle;
  return part;
}

function frontBridgeShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-7.38, -0.71);
  shape.bezierCurveTo(-8.25, -0.75, -8.29, 0.58, -7.57, 0.76);
  shape.bezierCurveTo(-6.62, 0.98, -6.46, 0.41, -5.61, 0.33);
  shape.bezierCurveTo(-4.01, 0.23, -2.29, 0.36, -1.28, 0.62);
  shape.bezierCurveTo(-0.75, 0.78, -0.57, 0.94, 0, 0.94);
  shape.bezierCurveTo(0.57, 0.94, 0.75, 0.78, 1.28, 0.62);
  shape.bezierCurveTo(2.29, 0.36, 4.01, 0.23, 5.61, 0.33);
  shape.bezierCurveTo(6.46, 0.41, 6.62, 0.98, 7.57, 0.76);
  shape.bezierCurveTo(8.29, 0.58, 8.25, -0.75, 7.38, -0.71);
  shape.bezierCurveTo(6.78, -0.71, 6.31, -0.22, 5.52, -0.19);
  shape.bezierCurveTo(3.57, -0.14, 1.83, -0.40, 1.19, -0.67);
  shape.bezierCurveTo(0.45, -1.02, -0.45, -1.02, -1.19, -0.67);
  shape.bezierCurveTo(-1.83, -0.40, -3.57, -0.14, -5.52, -0.19);
  shape.bezierCurveTo(-6.31, -0.22, -6.78, -0.71, -7.38, -0.71);
  circleHole(shape, 0, 0, 0.54);
  circleHole(shape, -7.29, 0.06, 0.555);
  circleHole(shape, 7.29, 0.06, 0.555);
  return shape;
}

function buildFrontBridge(parent, m) {
  const bridge = assembly(parent, "Fixed dial-side tourbillon bridge");
  const geometry = plate(frontBridgeShape(), 3.055, 3.625, 0.085);
  const vertices = geometry.getAttribute("position");
  for (let i = 0; i < vertices.count; i += 1) {
    const shoulder = THREE.MathUtils.smoothstep(Math.abs(vertices.getX(i)), 3.8, 6.48);
    vertices.setZ(i, vertices.getZ(i) + shoulder * 0.495);
  }
  geometry.computeVertexNormals();
  mesh(bridge, "Arched bridge with polished anglage", geometry, [m.silver, m.steel]);
  jewelBearing(bridge, "Upper cage staff bearing", m, 0, 0, 3.64);
  ring(bridge, "Upper journal sleeve", m.steel, 0, 0, 0.17, 0.475, 3.075, 3.55, 0.025);
  const screwGeometry = screwParts(0.31, 0.14, 0.051);
  for (const side of [-1, 1]) {
    const x = side * 7.29;
    ring(bridge, "Foot mounting ferrule", m.steelDark, x, 0.06, 0.191, 0.53, 3.396, 3.584, 0.025);
    ring(bridge, "Foot screw counterbore", m.steel, x, 0.06, 0.29, 0.49, 3.56, 4.085);
    const fastener = screw(bridge, "Bridge foot screw", screwGeometry, m.blue, x, 0.06, 4.06, 0.5 + side * 0.53);
    cylinder(fastener, "Bridge screw shank in dial seat", m.steel, 0, 0, 0.193, -0.745, -0.058, 24);
  }
}

function buildFixedWheel(parent, m) {
  const mounts = assembly(parent, "Fixed fourth wheel and lower staff journal");
  ring(mounts, "Lower cock mating collar", m.steel, 0, 0, 0.20, 0.59, -3.24, -2.63);
  ring(mounts, "Jewel receiver lip", m.brass, 0, 0, 0.22, 0.46, -2.80, -2.57);
  ring(mounts, "Lower cage bearing ruby", m.ruby, 0, 0, 0.165, 0.225, -2.86, -2.57, 0.012, 40);
  ring(mounts, "Stationary wheel pressed boss", m.brass, 0, 0, 0.455, 0.78, -2.68, -2.14);
  const stationaryWheel = gearShape(48, 3.44, 3.635, 0.745);
  for (let i = 0; i < 4; i += 1) {
    const angle = (i + 0.5) * TAU / 4;
    circleHole(stationaryWheel, ...polar(2.04, angle), 0.84);
  }
  mesh(mounts, "Stationary wheel with four relieved openings", plate(stationaryWheel, -2.47, -2.14, 0.021), [m.brass, m.goldSatin]);
}

function buildFrame(cage, m) {
  const frame = assembly(cage, "Open lower and upper carriage");
  const lower = assembly(frame, "Lower three-armed carriage");
  const upper = assembly(frame, "Upper three-armed carriage");
  ring(lower, "Lower skeleton perimeter", m.steelDark, 0, 0, 5.22, 5.57, -1.93, -1.54, 0.076, 100);
  ring(upper, "Upper polished cage perimeter", m.steel, 0, 0, 5.37, 5.63, 1.92, 2.20, 0.065, 100);
  ring(lower, "Lower balance journal support", m.steel, 0, 0, 0.285, 0.83, -2.02, -1.48, 0.08);
  ring(upper, "Upper balance journal support", m.steel, 0, 0, 0.285, 0.83, 1.87, 2.23, 0.08);
  for (const [journal, z] of [[lower, -1.90], [upper, 1.86]]) {
    ring(journal, "Balance staff chaton", m.brass, 0, 0, 0.215, 0.286, z, z + 0.28, 0.024);
    ring(journal, "Balance staff jewel", m.ruby, 0, 0, 0.145, 0.215, z + 0.03, z + 0.30, 0.021, 40);
  }

  const lowerArm = [[0.63, -0.25], [1.42, -0.20], [3.44, -0.14], [4.99, -0.43], [5.35, -0.29],
    [5.37, 0.33], [4.98, 0.44], [3.63, 0.35], [1.42, 0.21], [0.60, 0.26]];
  const upperArm = [[0.64, -0.21], [1.21, -0.16], [2.61, -0.17], [4.37, -0.27], [4.90, -0.39], [5.43, -0.29],
    [5.43, 0.29], [4.89, 0.40], [4.23, 0.24], [2.78, 0.17], [1.25, 0.16], [0.62, 0.21]];
  const armClockings = [43, 163, 283].map((angle) => angle * RADIANS);
  const smallScrew = screwParts(0.24, 0.125, 0.041);
  const postShaft = cylinderGeometry(0.28, -2.78, 2.07, 40);
  const postSeat = ringGeometry(0.26, 0.47, -1.55, -1.23, 0.045, 32);
  const postHead = ringGeometry(0.263, 0.47, 1.64, 2.24, 0.06, 32);

  for (const [index, angle] of armClockings.entries()) {
    spoke(lower, "Radiused lower arm", [m.steelDark, m.steel], lowerArm, angle, -1.91, -1.55, 0.05);
    spoke(upper, "Polished upper arm", [m.steelDark, m.steel], upperArm, angle, 1.92, 2.20, 0.06);
    const [x, y] = polar(4.90, angle);
    mesh(frame, "Shouldered cage pillar", postShaft, m.steel, x, y);
    mesh(lower, "Lower cage-pillar socket", postSeat, m.brass, x, y);
    mesh(upper, "Upper cage-pillar boss", postHead, m.steel, x, y);
    screw(upper, "Cage pillar screw", smallScrew, m.blue, x, y, 2.213, 0.75 + index * 0.83);
  }

  const driveRing = gearShape(68, 5.42, 5.52);
  // Leave the metal needed around each cage pillar and relieve the web between
  // those three seats so the lower stage remains open from both faces.
  const relievedBore = new THREE.Path();
  for (let i = 0; i < 216; i += 1) {
    const angle = -i * TAU / 216;
    const nearestPillar = Math.min(...armClockings.map((clocking) =>
      Math.abs(Math.atan2(Math.sin(angle - clocking), Math.cos(angle - clocking)))));
    const radius = THREE.MathUtils.lerp(4.53, 5.02, THREE.MathUtils.smoothstep(nearestPillar, 0.085, 0.174));
    const [x, y] = polar(radius, angle);
    if (i === 0) relievedBore.moveTo(x, y);
    else relievedBore.lineTo(x, y);
  }
  relievedBore.closePath();
  driveRing.holes.push(relievedBore);
  mesh(lower, "Toothed cage driving ring", plate(driveRing, -2.89, -2.63, 0.018), [m.brass, m.goldSatin]);

  cylinder(lower, "Coaxial lower cage staff", m.steel, 0, 0, 0.137, -3.17, -1.96);
  ring(lower, "Lower cage-staff shoulder", m.steel, 0, 0, 0.132, 0.44, -2.11, -1.92, 0.055);
  ring(upper, "Upper cage staff flange", m.steel, 0, 0, 0.132, 0.44, 2.17, 2.76, 0.08);
  cylinder(upper, "Coaxial upper cage staff", m.steel, 0, 0, 0.137, 2.5, 3.74);
}

function buildBalance(cage, m) {
  const balance = assembly(cage, "Screw balance and hairspring");
  ring(balance, "Beveled balance rim", m.brass, 0, 0, 2.92, 3.37, -0.28, 0.37, 0.105, 100);
  ring(balance, "Polished upper rim lip", m.gold, 0, 0, 3.09, 3.31, 0.342, 0.405, 0.02, 100);
  ring(balance, "Balance staff collet", m.brass, 0, 0, 0.17, 0.50, -0.35, 0.55, 0.055);
  cylinder(balance, "Balance staff", m.steel, 0, 0, 0.138, -1.87, 2.07);
  ring(balance, "Roller table below balance", m.steel, 0, 0, 0.13, 0.56, -1.04, -0.82);
  cylinder(balance, "Roller impulse jewel", m.ruby, 0.35, -0.22, 0.085, -1.20, -0.98, 20);

  const arm = [[0.39, -0.19], [1.55, -0.20], [2.29, -0.19], [3.04, -0.33],
    [3.04, 0.34], [2.27, 0.19], [1.54, 0.20], [0.39, 0.19]];
  for (const angle of [9, 129, 249]) {
    spoke(balance, "Gold balance-wheel spoke", [m.brass, m.gold], arm, angle * RADIANS, -0.15, 0.20, 0.06);
  }

  const poisingScrew = screwParts(0.154, 0.14, 0.035);
  for (let i = 0; i < 9; i += 1) {
    const angle = i * TAU / 9 + 0.25;
    const [x, y] = polar(3.369, angle);
    const screwAssembly = screw(balance, "Radial timing screw", poisingScrew, m.gold, x, y, 0.055);
    screwAssembly.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0));
  }

  const coils = 6.08;
  const startAngle = 0.30;
  const springPoint = (t) => polar(0.32 + 2.81 * t, startAngle + TAU * coils * t);
  const edge = (side) => {
    const points = [];
    for (let i = 0; i <= 324; i += 1) {
      const t = i / 324;
      const [x, y] = springPoint(t);
      const [ax, ay] = springPoint(t - 0.0001);
      const [bx, by] = springPoint(t + 0.0001);
      const length = Math.hypot(bx - ax, by - ay);
      points.push([x - side * (by - ay) / length * 0.043, y + side * (bx - ax) / length * 0.043]);
    }
    return points;
  };
  const springLayer = assembly(balance, "Hairspring with captured ends");
  const spring = outline([...edge(1), ...edge(-1).reverse()]);
  mesh(springLayer, "Flat six-turn blued ribbon", plate(spring, 0.58, 0.72, 0), m.blue);
  ring(springLayer, "Hairspring inner collet", m.steel, 0, 0, 0.135, 0.385, 0.51, 0.75);
  const [sx, sy] = springPoint(1);
  const studAngle = startAngle + TAU * coils;
  spoke(springLayer, "Spring stud carrier from cage rim", [m.steelDark, m.steel],
    [[2.96, -0.20], [3.26, -0.27], [4.65, -0.15], [5.36, -0.32], [5.37, 0.33], [4.61, 0.15],
      [3.25, 0.27], [2.96, 0.18]],
    studAngle, 1.64, 1.99, 0.048);
  cylinder(springLayer, "Hairspring outer stud pin", m.steel, sx, sy, 0.12, 0.62, 1.72);
  ring(springLayer, "Outer stud clamp sleeve", m.brass, sx, sy, 0.11, 0.21, 0.62, 0.88, 0.035);
}

function buildEscapement(cage, m) {
  const clocking = -38 * RADIANS;
  const [ex, ey] = polar(4.34, clocking);
  const escapement = assembly(cage, "Lateral lever escapement");
  const escape = assembly(escapement, "Escape wheel arbor and pinion", ex, ey);
  const escapeWheel = gearShape(15, 0.93, 1.285, 0.22, true);
  for (let i = 0; i < 5; i += 1) {
    const windowCentre = polar(0.58, i * TAU / 5);
    circleHole(escapeWheel, ...windowCentre, 0.201);
  }
  mesh(escape, "Five-window swept escape wheel", plate(escapeWheel, -1.30, -1.04, 0.024), [m.gold, m.brass]);
  mesh(escape, "Escape pinion at fixed wheel plane", plate(gearShape(9, 0.40, 0.655, 0.146), -2.45, -2.14, 0.019), m.steel);
  ring(escape, "Escape wheel pinion hub", m.steelDark, 0, 0, 0.135, 0.275, -2.25, -2.02);
  ring(escape, "Escape wheel collar", m.steelDark, 0, 0, 0.121, 0.265, -1.51, -1.10);
  cylinder(escape, "Escape arbor", m.steel, 0, 0, 0.125, -2.50, 2.108);
  cylinder(escape, "Escape arbor upper pivot tip", m.steel, 0, 0, 0.101, 2.096, 2.23);
  const escapeSupport = outline([[4.03, -0.26], [4.47, -0.40], [4.86, -0.22], [5.38, -0.24],
    [5.38, 0.24], [4.89, 0.22], [4.46, 0.40], [4.03, 0.26]]);
  circleHole(escapeSupport, 4.34, 0, 0.182);
  mesh(escapement, "Escape arbor lower cock", plate(escapeSupport, -1.96, -1.55, 0.05),
    [m.steelDark, m.steel]).rotation.z = clocking;
  mesh(escapement, "Escape arbor upper cock", plate(escapeSupport, 1.91, 2.16, 0.05),
    [m.steelDark, m.steel]).rotation.z = clocking;
  jewelBearing(escapement, "Escape arbor cap jewel", m, ex, ey, 2.16, 0.63);

  const [px, py] = polar(1.94, clocking);
  const pallet = assembly(escapement, "Lever, pallet stones and pivot", px, py);
  pallet.rotation.z = clocking;
  const forkShape = outline([[-1.55, -0.35], [-1.17, -0.33], [-0.95, -0.12], [-0.24, -0.12],
    [0.16, -0.32], [0.74, -0.52], [0.97, -0.43], [1.03, -0.25], [0.39, -0.11], [0.39, 0.10],
    [1.04, 0.32], [0.98, 0.49], [0.76, 0.53], [0.16, 0.34], [-0.20, 0.15],
    [-0.96, 0.12], [-1.17, 0.32], [-1.55, 0.33], [-1.55, 0.19], [-1.26, 0.113],
    [-1.26, -0.113], [-1.55, -0.192]]);
  circleHole(forkShape, 0, 0, 0.10);
  mesh(pallet, "Hardened steel pallet fork", plate(forkShape, -1.25, -1.075, 0.026), [m.blue, m.steel]);
  for (const side of [-1, 1]) {
    const stone = new THREE.BoxGeometry(0.29, 0.16, 0.155);
    const tooth = mesh(pallet, "Ruby pallet stone", stone, m.ruby, 0.99, side * 0.346, -1.15);
    tooth.rotation.z = side * 0.30;
  }
  cylinder(pallet, "Lever pivot", m.steel, 0, 0, 0.098, -1.75, 1.08);
  ring(pallet, "Lever jewel seat", m.brass, 0, 0, 0.115, 0.255, 0.82, 1.07);
  ring(pallet, "Lever pivot ruby", m.ruby, 0, 0, 0.105, 0.15, 0.88, 1.092, 0.014, 32);
  spoke(escapement, "Pallet cock from lower carriage", [m.steelDark, m.steel],
    [[1.67, -0.19], [1.93, -0.25], [3.70, -0.20], [4.13, -0.23], [4.13, 0.23],
      [3.62, 0.24], [1.94, 0.26], [1.67, 0.17]],
    clocking, -1.90, -1.53, 0.05);
  // The jeweled pallet bridge reaches the upper cage from outside the
  // balance rim, above the spring's ribbon and below the upper carriage.
  spoke(escapement, "Raised pallet pivot bridge", [m.steelDark, m.steel],
    [[1.71, -0.19], [1.98, -0.24], [3.47, 0.08], [4.33, 0.24], [4.79, 0.22], [5.26, -0.06], [5.29, 0.48],
      [4.76, 0.64], [4.30, 0.69], [3.43, 0.43], [2.00, 0.24], [1.72, 0.19]],
    clocking, 0.90, 1.15, 0.042);
  const [supportX, supportY] = polar(5.16, clocking);
  cylinder(escapement, "Pallet bridge outer support", m.steelDark, supportX - 0.22 * Math.sin(clocking),
    supportY + 0.22 * Math.cos(clocking), 0.18, 1.10, 2.05);
}

export function buildTourbillon(materials) {
  const group = assembly(null, "Tourbillon assembly", 0, -10.4);
  const cage = assembly(group, "Rotating one-minute tourbillon cage");
  buildFrontBridge(group, materials);
  buildFixedWheel(group, materials);
  buildFrame(cage, materials);
  buildBalance(cage, materials);
  buildEscapement(cage, materials);
  return { group, cage };
}
