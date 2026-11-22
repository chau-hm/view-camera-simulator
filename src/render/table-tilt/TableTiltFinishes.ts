import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { toWorld } from "../rttUtils";

export const easedBox = (width: number, height: number, depth: number, radius: number) =>
  new RoundedBoxGeometry(toWorld(width), toWorld(height), toWorld(depth), 1, toWorld(radius));

/** The outside, lip, inner wall, and foot share one continuous ceramic profile. */
export const cupShell = (radius: number, height: number, segments: number) => {
  const profile = [
    [0, 3], [0.71, 3], [0.73, 0], [0.79, 0], [0.81, 3],
    [0.81, 9], [0.86, 14], [0.90, 24], [0.95, 51], [0.97, 99],
    [0.99, height - 14], [1, height - 5], [0.997, height - 2],
    [0.98, height], [0.955, height], [0.935, height - 2],
    [0.925, height - 5], [0.92, height - 15], [0.90, 98], [0.88, 52],
    [0.84, 31], [0.80, 24], [0.71, 20], [0, 20],
  ];
  const geometry = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(toWorld(r * radius), toWorld(y))),
    segments,
  );
  const colors: number[] = [];
  const clay = new THREE.Color("#b48f6b");
  const glaze = new THREE.Color("#f5e6d5");
  const innerGlaze = new THREE.Color("#d8c6af");
  for (let segment = 0; segment <= segments; segment++) {
    profile.forEach(([, y], row) => {
      const color = glaze.clone().lerp(clay, 1 - THREE.MathUtils.smoothstep(y, 9, 25));
      if (row >= 17) color.lerp(innerGlaze, THREE.MathUtils.smoothstep(row, 16, 21));
      colors.push(color.r, color.g, color.b);
    });
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
};

export const ceramicGlaze = () => {
  // A repeatable, mipmapped glaze map keeps the specks attached to the pottery
  // in both renderers and filters them out as they become subpixel.
  const size = 256;
  const texels = new Uint8Array(size * size * 4);
  let seed = 8191;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  for (let i = 0; i < texels.length; i += 4) {
    const value = 245 + Math.floor(random() * 11);
    texels.set([value, value, value, 255], i);
  }
  for (let i = 0; i < 890; i++) {
    const x = Math.floor(random() * size);
    const y = Math.floor(random() * size);
    const value = 105 + Math.floor(random() * 87);
    texels.set([value + 10, value, value - 12, 255], (y * size + x) * 4);
    if (i % 7 === 0) {
      texels.set([value + 28, value + 17, value + 2, 255], (y * size + (x + 1) % size) * 4);
    }
  }
  const map = new THREE.DataTexture(texels, size, size);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map, roughness: 0.62, vertexColors: true });
};

export const paperEdges = (
  width: number,
  height: number,
  depth: number,
  layers: number,
) => {
  const geometry = new THREE.BoxGeometry(toWorld(width), toWorld(height), toWorld(depth), 1, layers * 2, 1);
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const colors = new Float32Array(positions.count * 3);
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const fraction = positions.getY(vertex) / toWorld(height) + 0.5;
    const row = Math.round(fraction * layers * 2);
    const isRuling = normals.getY(vertex) === 0 && row % 2 === 1;
    const value = isRuling ? 0.77 + (row % 5) * 0.032 : 1;
    colors.set([value, value, value], vertex * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
};

/** Recess the existing tray while retaining the original outer envelope. */
export const recessedTray = (width: number, height: number, depth: number) => {
  const outline = (path: THREE.Path, halfWidth: number, halfDepth: number, radius: number) => {
    path.moveTo(-halfWidth + radius, -halfDepth);
    path.lineTo(halfWidth - radius, -halfDepth);
    path.quadraticCurveTo(halfWidth, -halfDepth, halfWidth, -halfDepth + radius);
    path.lineTo(halfWidth, halfDepth - radius);
    path.quadraticCurveTo(halfWidth, halfDepth, halfWidth - radius, halfDepth);
    path.lineTo(-halfWidth + radius, halfDepth);
    path.quadraticCurveTo(-halfWidth, halfDepth, -halfWidth, halfDepth - radius);
    path.lineTo(-halfWidth, -halfDepth + radius);
    path.quadraticCurveTo(-halfWidth, -halfDepth, -halfWidth + radius, -halfDepth);
  };
  const wallThickness = 14;
  const floorThickness = 15;
  const outside = new THREE.Shape();
  const inside = new THREE.Path();
  outline(outside, toWorld(width / 2), toWorld(depth / 2), toWorld(16));
  outline(inside, toWorld(width / 2 - wallThickness), toWorld(depth / 2 - wallThickness), toWorld(7));
  outside.holes.push(inside);
  const sides = new THREE.ExtrudeGeometry(outside, {
    depth: toWorld(height), bevelEnabled: false, curveSegments: 3,
  });
  sides.rotateX(-Math.PI / 2);
  sides.translate(0, -toWorld(height / 2), 0);
  const floor = easedBox(width - wallThickness * 1.5, floorThickness, depth - wallThickness * 1.5, 3);
  floor.translate(0, toWorld((floorThickness - height) / 2), 0);
  const geometry = mergeGeometries([sides, floor]);
  sides.dispose();
  floor.dispose();
  return geometry;
};
