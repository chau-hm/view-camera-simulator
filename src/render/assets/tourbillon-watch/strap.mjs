import * as THREE from 'three';

const TAU = Math.PI * 2;

function part(parent, name, geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function strapDimensions(length, tongueEnd) {
  const halfWidth = (s) => {
    const taper = 10.76 - 2.02 * THREE.MathUtils.smoothstep(s, 0, length - 3);
    if (!tongueEnd) return taper - 0.42 * THREE.MathUtils.smoothstep(s, length - 0.9, length);
    const end = Math.max(0, (s - length + 5.5) / 5.52);
    return taper * Math.sqrt(1 - end * end);
  };
  const axis = (s) => -0.0074 * s * s;
  const surface = (u, s, front) => {
    const halfThickness = 1.4 - 0.20 * s / length;
    const shoulder = Math.max(0, (Math.abs(u) - 0.91) / 0.09);
    const crown = front
      ? halfThickness - (s / length) * 0.17 * u * u - 0.24 * shoulder ** 2
      : -halfThickness + (s / length) * 0.09 * u * u + 0.22 * shoulder ** 2;
    return new THREE.Vector3(halfWidth(s) * u, s, axis(s) + crown);
  };
  return { length, halfWidth, axis, surface };
}

/**
 * Surface patches are sampled in a strap's own length and width coordinates,
 * then folded into a single solid with edge strips and punched hole walls.
 */
function strapGeometry(dimensions, centres) {
  const { length, surface, halfWidth } = dimensions;
  const across = [-1, -0.91, -0.78, -0.6, -0.4, -0.18, 0.18, 0.4, 0.6, 0.78, 0.91, 1];
  const rows = new Set([0, length, length - 0.08, length - 0.3, length - 0.65, length - 1.15]);
  for (let y = 0.65; y < length - 0.7; y += 0.65) {
    if (centres.every((centre) => Math.abs(y - centre) > 1.201)) rows.add(y);
  }
  const holes = new Map();
  for (const centre of centres) {
    rows.add(centre - 1.2);
    rows.add(centre + 1.2);
    const ring = [];
    for (let i = 31; i >= 0; i -= 1) {
      const angle = i * TAU / 32;
      const y = centre + 0.92 * Math.sin(angle);
      ring.push(new THREE.Vector2(0.79 * Math.cos(angle) / halfWidth(y), y));
    }
    holes.set(centre - 1.2, ring);
  }

  const along = [...rows].sort((a, b) => a - b);
  const positions = [];
  const uv = [];
  const materialIndices = [[], [], [], []];
  const vertexCache = new Map();
  function addVertex(xyz) {
    const key = xyz.toArray().map((value) => value.toFixed(6)).join(',');
    const seen = vertexCache.get(key);
    if (seen !== undefined) return seen;
    const at = positions.length / 3;
    positions.push(...xyz);
    uv.push((xyz.x + 10.9) / 21.8, xyz.y / 44.5);
    vertexCache.set(key, at);
    return at;
  }
  function triangle(material, p, q, r) {
    materialIndices[material].push(addVertex(p), addVertex(q), addVertex(r));
  }
  function quad(material, p, q, r, s) {
    triangle(material, p, q, r);
    triangle(material, p, r, s);
  }
  function edgeAt(side, s) {
    const top = surface(side, s, true);
    const bottom = surface(side, s, false);
    const outward = 0.10 * THREE.MathUtils.smoothstep(s, 0, 0.3);
    return [
      bottom,
      new THREE.Vector3(top.x + outward * side, s, bottom.z + 0.19),
      new THREE.Vector3(top.x + outward * side, s, top.z - 0.17),
      top,
    ];
  }
  for (let row = 0; row + 1 < along.length; row += 1) {
    const s0 = along[row];
    const s1 = along[row + 1];
    for (let column = 0; column + 1 < across.length; column += 1) {
      const u0 = across[column];
      const u1 = across[column + 1];
      const outline = [[u0, s0], [u1, s0], [u1, s1], [u0, s1]];
      const ring = u0 === -0.18 ? holes.get(s0) : null;
      if (ring) {
        const patch = outline.map(([u, s]) => new THREE.Vector2(u, s));
        const triangles = THREE.ShapeUtils.triangulateShape(patch, [ring]);
        const points = [...patch, ...ring];
        for (const cell of triangles) {
          const upper = cell.map((i) => surface(points[i].x, points[i].y, true));
          const lower = cell.map((i) => surface(points[i].x, points[i].y, false));
          triangle(0, ...upper);
          triangle(2, ...lower.reverse());
        }
        const centre = s0 + 1.2;
        function bevelBore(point, front) {
          const s = centre + (point.y - centre) * 0.87;
          const bevel = surface(point.x * 0.87, s, front);
          bevel.z += front ? -0.16 : 0.16;
          return bevel;
        }
        for (let edge = 0; edge < ring.length; edge += 1) {
          const a = ring[edge];
          const b = ring[(edge + 1) % ring.length];
          const lowerA = bevelBore(a, false);
          const lowerB = bevelBore(b, false);
          const upperA = bevelBore(a, true);
          const upperB = bevelBore(b, true);
          quad(1, surface(a.x, a.y, false), surface(b.x, b.y, false), lowerB, lowerA);
          quad(3, lowerA, lowerB, upperB, upperA);
          quad(1, upperA, upperB, surface(b.x, b.y, true), surface(a.x, a.y, true));
        }
      } else {
        quad(0, ...outline.map(([u, s]) => surface(u, s, true)));
        quad(2, ...outline.map(([u, s]) => surface(u, s, false)).reverse());
      }
    }
    for (const side of [-1, 1]) {
      const a = edgeAt(side, s0);
      const b = edgeAt(side, s1);
      for (let layer = 0; layer + 1 < a.length; layer += 1) {
        const points = [a[layer], b[layer], b[layer + 1], a[layer + 1]];
        quad(layer === 0 ? 2 : 1, ...(side === 1 ? points : points.reverse()));
      }
    }
  }
  for (const s of [0, length]) {
    const edge = [
      ...across.map((u) => surface(u, s, false)),
      ...edgeAt(1, s).slice(1, 3),
      ...across.toReversed().map((u) => surface(u, s, true)),
      ...edgeAt(-1, s).slice(1, 3).reverse(),
    ];
    const center = surface(0, s, true).lerp(surface(0, s, false), 0.5);
    if (s === length) edge.reverse();
    for (let i = 0; i < edge.length; i += 1) {
      triangle(1, center, edge[i], edge[(i + 1) % edge.length]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  const indices = [];
  for (const [material, faces] of materialIndices.entries()) {
    geometry.addGroup(indices.length, faces.length, material);
    indices.push(...faces);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function barWrap() {
  const wrap = new THREE.Shape();
  // The semicircular sleeve is open at the strap body and clear of the bar.
  wrap.moveTo(0, 1.4);
  wrap.absarc(0, 0, 1.4, Math.PI / 2, 3 * Math.PI / 2, false);
  wrap.lineTo(0, -0.745);
  wrap.absarc(0, 0, 0.745, 3 * Math.PI / 2, Math.PI / 2, true);
  wrap.closePath();
  const geometry = new THREE.ExtrudeGeometry(wrap, {
    depth: 21.48, bevelEnabled: false, curveSegments: 28,
  });
  const frame = new THREE.Matrix4().set(
    0, 0, 1, -10.74,
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 0, 1,
  );
  geometry.applyMatrix4(frame);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i += 1) {
    const angle = Math.atan2(-positions.getY(i), positions.getZ(i));
    uv.setXY(i, (positions.getX(i) + 10.9) / 21.8, (angle + Math.PI / 2) * 1.4 / 44.5);
  }
  return geometry;
}

function addStitching(parent, dimensions, geometry, material, tongueEnd) {
  const { length, surface } = dimensions;
  const segments = [];
  const topOffset = 0.03;
  const undersideOffset = -0.026;
  for (const front of [true, false]) {
    const level = front ? topOffset : undersideOffset;
    for (const side of [-1, 1]) {
      const limit = tongueEnd ? length - 4.2 : length - 1.7;
      for (let s = 1; s < limit; s += 1.75) {
        const start = surface(side * 0.865, s, front);
        const end = surface(side * 0.882, s + 1.12, front);
        start.z += level;
        end.z += level;
        segments.push([start, end]);
      }
    }
    if (tongueEnd) {
      const point = (angle) => {
        const u = 0.865 * Math.cos(angle);
        const s = length - 4.1 + 3.35 * Math.sin(angle);
        const p = surface(u, s, front);
        p.z += level;
        return p;
      };
      for (let i = 0; i < 13; i += 1) {
        const step = Math.PI / 13;
        segments.push([point(i * step), point((i + 0.61) * step)]);
      }
    }
  }
  const stitches = new THREE.InstancedMesh(geometry, material, segments.length);
  stitches.name = 'saddle stitching';
  const pose = new THREE.Object3D();
  const direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  segments.forEach(([start, end], i) => {
    direction.subVectors(end, start);
    pose.position.copy(start).lerp(end, 0.5);
    pose.scale.set(1, direction.length(), 1);
    pose.quaternion.setFromUnitVectors(up, direction.normalize());
    pose.updateMatrix();
    stitches.setMatrixAt(i, pose.matrix);
  });
  stitches.instanceMatrix.needsUpdate = true;
  stitches.computeBoundingBox();
  stitches.computeBoundingSphere();
  parent.add(stitches);
}

function roundedRectangle(path, left, bottom, right, top, radius) {
  path.moveTo(left + radius, bottom);
  path.lineTo(right - radius, bottom);
  path.quadraticCurveTo(right, bottom, right, bottom + radius);
  path.lineTo(right, top - radius);
  path.quadraticCurveTo(right, top, right - radius, top);
  path.lineTo(left + radius, top);
  path.quadraticCurveTo(left, top, left, top - radius);
  path.lineTo(left, bottom + radius);
  path.quadraticCurveTo(left, bottom, left + radius, bottom);
  path.closePath();
  return path;
}

function buckleFrame() {
  const shape = roundedRectangle(new THREE.Shape(), -10.5, -0.95, 10.5, 7.4, 1.18);
  const aperture = roundedRectangle(new THREE.Path(), -8.81, 0.73, 8.81, 5.78, 0.81);
  shape.holes.push(aperture);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.92, bevelEnabled: true, bevelThickness: 0.21, bevelSize: 0.20,
    bevelSegments: 5, curveSegments: 8,
  }).translate(0, 0, -0.46);
}

function addBuckle(parent, dimensions, material) {
  const { length, axis, halfWidth } = dimensions;
  const clasp = new THREE.Group();
  clasp.name = 'tang buckle assembly';
  clasp.position.set(0, length - 0.65, axis(length - 0.65));
  clasp.rotation.x = Math.atan2(axis(length) - axis(length - 1), 1);
  parent.add(clasp);

  part(clasp, 'polished buckle frame and axle', buckleFrame(), material.gold);
  const tonguePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0.17),
    new THREE.Vector3(0, 2.7, 0.98),
    new THREE.Vector3(0, 5.1, 0.88),
    new THREE.Vector3(0, 6.4, 0.59),
  ]);
  const tongue = new THREE.TubeGeometry(tonguePath, 28, 0.35, 12, false);
  part(clasp, 'buckle tongue', tongue, material.gold);
  part(clasp, 'rounded end of buckle tongue', new THREE.SphereGeometry(0.35, 20, 12),
    material.gold).position.copy(tonguePath.getPoint(1));

  const at = length - 6.8;
  const width = halfWidth(at) + 0.25;
  const keeper = roundedRectangle(new THREE.Shape(), -width - 0.75, -2.12,
    width + 0.75, 2.05, 0.85);
  keeper.holes.push(roundedRectangle(new THREE.Path(), -width, -1.43, width, 1.40, 0.51));
  const frame = new THREE.ExtrudeGeometry(keeper, {
    depth: 2.42, bevelEnabled: true, bevelSize: 0.11, bevelThickness: 0.11,
    bevelSegments: 3, curveSegments: 8,
  }).translate(0, 0, -1.21).rotateX(Math.PI / 2);
  const loop = part(parent, 'leather keeper', frame, material.leatherEdge);
  loop.position.set(0, at, axis(at));
  loop.rotation.x = Math.atan2(axis(at + 0.5) - axis(at - 0.5), 1);
}

export function buildStrap(materials) {
  const group = new THREE.Group();
  group.name = 'Strap assembly';
  const wrap = barWrap();
  const stitch = new THREE.CylinderGeometry(0.060, 0.060, 1, 9, 1);

  for (const [sign, length, tongueEnd] of [[1, 33.5, false], [-1, 44.5, true]]) {
    const section = new THREE.Group();
    section.name = tongueEnd ? '6 o’clock strap' : '12 o’clock strap';
    section.position.set(0, sign * 23.6, -1.6);
    section.scale.y = sign;
    group.add(section);
    const dimensions = strapDimensions(length, tongueEnd);
    const holes = tongueEnd ? [20.7, 25.0, 29.3, 33.6, 37.9] : [];
    part(section, 'leather, lining and burnished edge', strapGeometry(dimensions, holes),
      [materials.leather, materials.leatherEdge, materials.lining, materials.rubber]);
    part(section, 'folded spring bar sleeve', wrap, materials.leather);
    addStitching(section, dimensions, stitch, materials.thread, tongueEnd);
    if (!tongueEnd) addBuckle(section, dimensions, materials);
  }
  return group;
}
