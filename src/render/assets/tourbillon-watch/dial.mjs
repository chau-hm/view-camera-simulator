import * as THREE from 'three';

const { cos, sin, PI, acos, atan2 } = Math;
const TAU = 2 * PI;

export const DIAL_Z = 3.55;
export const APERTURE = Object.freeze({ x: 0, y: -10.4, radius: 6.5 });
const APERTURE_DISTANCE = -APERTURE.y;

function sampleArc(target, x, y, r, start, end, first) {
  const steps = Math.ceil(Math.abs(end - start) / (TAU / 192));
  for (let i = 0; i <= steps; i++) {
    const a = start + (end - start) * i / steps;
    const px = x + r * cos(a);
    const py = y + r * sin(a);
    if (first && i === 0) target.moveTo(px, py);
    else target.lineTo(px, py);
  }
}

function circle(r, x = 0, y = 0, outline = new THREE.Shape()) {
  sampleArc(outline, x, y, r, 0, TAU, true);
  outline.closePath();
  return outline;
}

function concentricRing(outside, inside) {
  const shape = circle(outside);
  shape.holes.push(circle(inside, 0, 0, new THREE.Path()));
  return shape;
}

function apertureCircle() {
  return circle(APERTURE.radius, APERTURE.x, APERTURE.y, new THREE.Path());
}

function dialFieldOutline(radius, inverse) {
  const holeRadius = APERTURE.radius;
  const halfMissingArc = acos((radius ** 2 + APERTURE_DISTANCE ** 2 - holeRadius ** 2) /
    (2 * radius * APERTURE_DISTANCE));
  const right = -PI / 2 + halfMissingArc;
  const left = 3 * PI / 2 - halfMissingArc;
  const apertureRight = atan2(radius * sin(right) - APERTURE.y, radius * cos(right));
  const apertureLeft = atan2(radius * sin(left) - APERTURE.y, radius * cos(left));
  const path = inverse ? new THREE.Path() : new THREE.Shape();
  sampleArc(path, 0, 0, radius, right, left, true);
  sampleArc(path, 0, APERTURE.y, holeRadius, apertureLeft,
    apertureRight - (inverse ? 0 : TAU), false);
  path.closePath();
  return path;
}

function relief(parent, name, shape, z, depth, material, bevel = 0) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: 14, bevelEnabled: bevel > 0,
    bevelSegments: 3, bevelThickness: bevel, bevelSize: bevel,
  });
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / 38 + 0.5, pos.getY(i) / 38 + 0.5);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.z = z;
  parent.add(mesh);
  return mesh;
}

function localSlab(x0, y0, x1, y1) {
  const shape = new THREE.Shape();
  shape.moveTo(x0, y0);
  shape.lineTo(x1, y0);
  shape.lineTo(x1, y1);
  shape.lineTo(x0, y1);
  shape.closePath();
  return shape;
}

// Inlay letterforms are drawn as slender tapered black stems with wedge serifs.
const roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', '', 'VII', 'VIII', 'IX', 'X', 'XI'];
const glyphWidth = { I: 0.43, V: 1.08, X: 1.05 };

function numeralShapes(text, xScale) {
  const width = [...text].reduce((sum, c) => sum + glyphWidth[c] + 0.105, -0.105);
  let origin = -width / 2;
  const shapes = [];
  const height = 2.35;
  function stem(from, to, w1, w2) {
    const x0 = (origin + from) * xScale;
    const x1 = (origin + to) * xScale;
    const p = new THREE.Shape();
    p.moveTo(x0 - w1 / 2, 0);
    p.lineTo(x0 + w1 / 2, 0);
    p.lineTo(x1 + w2 / 2, height);
    p.lineTo(x1 - w2 / 2, height);
    p.closePath();
    shapes.push(p);
  }
  function serif(x, y, width, sign, stroke = 0.12) {
    const mid = (origin + x) * xScale;
    const p = new THREE.Shape();
    p.moveTo(mid - width / 2, y);
    p.lineTo(mid + width / 2, y);
    p.lineTo(mid + stroke / 2, y + sign * 0.14);
    p.lineTo(mid - stroke / 2, y + sign * 0.14);
    p.closePath();
    shapes.push(p);
  }
  for (const c of text) {
    if (c === 'I') {
      stem(0.215, 0.215, 0.155, 0.185);
      serif(0.215, -0.016, 0.43 * xScale, 1);
      serif(0.215, height + 0.016, 0.43 * xScale, -1);
    } else if (c === 'V') {
      stem(0.56, 0.16, 0.105, 0.198);
      stem(0.56, 0.89, 0.075, 0.086);
      serif(0.16, height + 0.012, 0.32 * xScale, -1);
      serif(0.89, height + 0.012, 0.30 * xScale, -1, 0.065);
    } else {
      stem(0.84, 0.20, 0.17, 0.18);
      stem(0.17, 0.84, 0.088, 0.088);
      for (const x of [0.17, 0.84]) {
        serif(x, -0.012, 0.32 * xScale, 1);
        serif(x, height + 0.012, 0.32 * xScale, -1);
      }
    }
    origin += glyphWidth[c] + 0.105;
  }
  return shapes;
}

// Mill the visibly legible pitch as one relief mesh. The bottom edge of
// each cut sits in the silver field, and height tapers into the two borders.
function addHobnailRelief(parent, material) {
  const positions = [];
  const indices = [];
  const pitch = 0.447;
  const fieldRadius = 13.73;
  const half = pitch * 0.49;
  const rotate = Math.SQRT1_2;
  const boundary = (x, y) => Math.min(fieldRadius - Math.hypot(x, y),
    Math.hypot(x, y - APERTURE.y) - (APERTURE.radius + 0.24));
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  function patch(points) {
    const i = positions.length / 3;
    for (const point of points) positions.push(...point);
    indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  const toXY = (u, v) => [(u - v) * rotate, (u + v) * rotate];
  const baseZ = 3.415;
  for (let row = -32; row <= 32; row++) {
    for (let column = -32; column <= 32; column++) {
      const v = row * pitch;
      const u = column * pitch;
      const perimeter = corners.map(([dx, dy]) => toXY(u + dx * half, v + dy * half));
      const clearance = Math.min(...perimeter.map(([x, y]) => boundary(x, y)));
      if (clearance < 0.045) continue;
      const height = 0.008 + 0.062 * THREE.MathUtils.smoothstep(clearance, 0.045, 0.72);
      const shoulder = corners.map(([dx, dy]) => [...toXY(u + dx * half * 0.26, v + dy * half * 0.26), baseZ + height]);
      for (let edge = 0; edge < 4; edge++) {
        const next = (edge + 1) % 4;
        patch([[...perimeter[edge], baseZ], [...perimeter[next], baseZ], shoulder[next], shoulder[edge]]);
      }
      patch(shoulder);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, material);
  mesh.name = 'Machined hobnail relief';
  parent.add(mesh);
}

export function buildDial(m) {
  const dial = new THREE.Group();
  dial.name = 'Dial assembly';
  const plate = circle(18.62);
  plate.holes.push(apertureCircle());
  relief(dial, 'Pierced silver dial plate', plate, 2.93, 0.38, m.silver, 0.04);
  relief(dial, 'Recessed engine-turned hobnail field', dialFieldOutline(13.82, false),
    3.33, 0.087, m.dialField);
  addHobnailRelief(dial, m.dialField);

  const chapter = circle(18.52);
  chapter.holes.push(dialFieldOutline(13.82, true));
  relief(dial, 'Satin Roman chapter ring', chapter, 3.33, 0.22, m.chapter);
  // Rings are interrupted before the aperture so their ends terminate on its collar.
  const r = 13.95;
  const limit = acos((r * r + APERTURE_DISTANCE ** 2 - 6.62 ** 2) / (2 * r * APERTURE_DISTANCE));
  const edge = new THREE.Shape();
  sampleArc(edge, 0, 0, r, -PI / 2 + limit, 3 * PI / 2 - limit, true);
  sampleArc(edge, 0, 0, 13.72, 3 * PI / 2 - limit, -PI / 2 + limit, false);
  edge.closePath();
  relief(dial, 'Interrupted polished inner lip', edge, 3.396, 0.098, m.steel, 0.012);

  const collar = concentricRing(6.73, 6.53);
  const apertureSeat = relief(dial, 'Polished aperture countersink collar', collar, 3.20, 0.266, m.goldShadow, 0.028);
  apertureSeat.position.y = APERTURE.y;
  const rim = relief(dial, 'Bright tourbillon rim', concentricRing(6.72, 6.59), 3.466, 0.068, m.steel, 0.014);
  rim.position.y = APERTURE.y;
  const innerCircle = relief(dial, 'Dark aperture wall', concentricRing(6.51, 6.43), 2.55, 0.72, m.rubber, 0.014);
  innerCircle.position.y = APERTURE.y;

  relief(dial, 'Railway track inner rule', concentricRing(17.067, 17.025), DIAL_Z, 0.018, m.ink);
  relief(dial, 'Railway track outer rule', concentricRing(18.064, 18.015), DIAL_Z, 0.018, m.ink);
  relief(dial, 'Polished outer dial border', concentricRing(18.54, 18.39), DIAL_Z, 0.065, m.steel);

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const width = i % 5 === 0 ? 0.19 : 0.074;
    const angle = -i * TAU / 60;
    const shape = localSlab(-width / 2, i % 5 === 0 ? 17.028 : 17.28, width / 2, 18.05);
    for (const line of shape.curves) {
      line.v1.rotateAround(ORIGIN, angle);
      line.v2.rotateAround(ORIGIN, angle);
    }
    return shape;
  });
  relief(dial, 'Sixty minute graduations', ticks, DIAL_Z, 0.019, m.ink);

  for (let i = 0; i < roman.length; i++) {
    if (!roman[i]) continue;
    const numeral = relief(dial, 'Roman ' + roman[i], numeralShapes(roman[i], 1.20), DIAL_Z, 0.021, m.ink);
    const angle = -i * TAU / 12;
    const radius = 14.24;
    numeral.rotation.z = angle;
    numeral.position.x = -radius * sin(angle);
    numeral.position.y = radius * cos(angle);
  }
  return dial;
}

const ORIGIN = new THREE.Vector2();

function handOutline(length, eyeY, eyeRadius, width) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -1.12);
  shape.bezierCurveTo(0.63, -0.95, 0.50, -0.42, width, 0.78);
  shape.bezierCurveTo(width * 0.88, 3.7, width * 0.76, eyeY - 1.65, eyeRadius * 0.72, eyeY - eyeRadius * 0.78);
  shape.bezierCurveTo(eyeRadius * 1.18, eyeY - eyeRadius * 0.50, eyeRadius * 1.20, eyeY + eyeRadius * 0.54, eyeRadius * 0.48, eyeY + eyeRadius * 0.91);
  shape.quadraticCurveTo(0.17, eyeY + eyeRadius * 1.42, 0, length);
  shape.quadraticCurveTo(-0.17, eyeY + eyeRadius * 1.42, -eyeRadius * 0.48, eyeY + eyeRadius * 0.91);
  shape.bezierCurveTo(-eyeRadius * 1.20, eyeY + eyeRadius * 0.54, -eyeRadius * 1.18, eyeY - eyeRadius * 0.50, -eyeRadius * 0.72, eyeY - eyeRadius * 0.78);
  shape.bezierCurveTo(-width * 0.76, eyeY - 1.65, -width * 0.88, 3.7, -width, 0.78);
  shape.bezierCurveTo(-0.50, -0.42, -0.63, -0.95, 0, -1.12);
  shape.closePath();
  shape.holes.push(circle(eyeRadius * 0.69, 0, eyeY, new THREE.Path()));
  return shape;
}

export function buildHands(m) {
  const hands = new THREE.Group();
  hands.name = 'Hand assembly';
  const hour = relief(hands, 'Hour blade', handOutline(12.45, 10.47, 0.87, 0.31),
    3.823, 0.128, m.blue, 0.022);
  hour.rotation.z = THREE.MathUtils.degToRad(55);
  const minute = relief(hands, 'Minute blade', handOutline(16.5, 14.25, 0.77, 0.247),
    4.17, 0.12, m.blue, 0.022);
  minute.rotation.z = -PI / 3;

  const cylinder = (name, r, low, high, material) =>
    relief(hands, name, circle(r), low, high - low, material, 0.025);
  cylinder('Cannon pinion', 0.49, 3.33, 4.39, m.steelDark);
  cylinder('Hour hand hub', 0.91, 3.76, 4.07, m.blue);
  cylinder('Minute hand hub', 0.70, 4.11, 4.35, m.blue);
  cylinder('Polished hand collet', 0.34, 4.34, 4.51, m.steel);
  return hands;
}
