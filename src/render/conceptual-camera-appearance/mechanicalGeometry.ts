import {
  BoxGeometry,
  type BufferAttribute,
  type BufferGeometry,
  type TypedArray,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Path,
  Shape,
  Vector2,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WORLD_SCALE } from "../rttUtils";

export type PointMm = readonly [number, number, number];
type SizeMm = readonly [number, number];
type Axis = "x" | "y" | "z";
export type Part = () => BufferGeometry;

export const toWorld = (mm: number): number => mm * WORLD_SCALE;

export const partPosition = ([x, y, z]: PointMm): [number, number, number] => [
  toWorld(x),
  toWorld(y),
  toWorld(z),
];

const place = (geometry: BufferGeometry, position: PointMm, axis: Axis = "y") => {
  if (axis === "x") geometry.rotateZ(Math.PI / 2);
  if (axis === "z") geometry.rotateX(Math.PI / 2);
  return geometry.translate(...partPosition(position));
};

export const block =
  ([width, height, depth]: PointMm, position: PointMm, angleRad = 0): Part =>
  () =>
    place(
      new BoxGeometry(toWorld(width), toWorld(height), toWorld(depth)).rotateZ(angleRad),
      position,
    );

const rectangularOutline = <T extends Path>(
  path: T,
  [width, height]: SizeMm,
  corner: number,
): T => {
  const x = toWorld(width / 2);
  const y = toWorld(height / 2);
  const c = toWorld(Math.min(corner, width / 4, height / 4));
  path.moveTo(-x + c, -y);
  path.lineTo(x - c, -y);
  path.lineTo(x, -y + c);
  path.lineTo(x, y - c);
  path.lineTo(x - c, y);
  path.lineTo(-x + c, y);
  path.lineTo(-x, y - c);
  path.lineTo(-x, -y + c);
  path.closePath();
  return path;
};

export const machinedPlate =
  ([width, height, depth]: PointMm, position: PointMm, bevel: number, opening?: SizeMm): Part =>
  () => {
    const outer = rectangularOutline(
      new Shape(),
      [width - bevel * 2, height - bevel * 2],
      bevel * 1.8,
    );
    if (opening) {
      const hole = rectangularOutline(
        new Path(),
        [opening[0] + bevel * 2, opening[1] + bevel * 2],
        bevel,
      );
      outer.holes.push(hole);
    }
    const geometry = new ExtrudeGeometry(outer, {
      depth: toWorld(depth - bevel * 2),
      bevelEnabled: true,
      bevelThickness: toWorld(bevel),
      bevelSize: toWorld(bevel),
      bevelSegments: 1,
      curveSegments: 1,
    });
    geometry.translate(0, 0, toWorld(bevel - depth / 2));
    return place(geometry, position);
  };

export const pin =
  (radius: number, depth: number, position: PointMm, axis: Axis = "z", segments = 16): Part =>
  () =>
    place(
      new CylinderGeometry(toWorld(radius), toWorld(radius), toWorld(depth), segments),
      position,
      axis,
    );

export const turned =
  (profile: readonly SizeMm[], position: PointMm, axis: Axis = "z", segments = 32): Part =>
  () =>
    place(
      new LatheGeometry(
        profile.map(([radius, axial]) => new Vector2(toWorld(radius), toWorld(axial))),
        segments,
      ),
      position,
      axis,
    );

export const grip =
  (radius: number, depth: number, position: PointMm, axis: Axis): Part =>
  () => {
    const profile = new Shape();
    const teeth = 24;
    for (let index = 0; index < teeth * 2; index += 1) {
      const angle = (index * Math.PI) / teeth;
      const r = toWorld(index % 2 === 0 ? radius : radius - 0.65);
      if (index === 0) profile.moveTo(r, 0);
      else profile.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    profile.closePath();
    const geometry = new ExtrudeGeometry(profile, {
      depth: toWorld(depth),
      bevelEnabled: false,
      curveSegments: 1,
    });
    geometry.translate(0, 0, toWorld(-depth / 2));
    if (axis === "x") geometry.rotateY(Math.PI / 2);
    if (axis === "y") geometry.rotateX(Math.PI / 2);
    return place(geometry, position);
  };

const bufferCache = new WeakMap<readonly Part[], { position: TypedArray; normal: TypedArray }>();

/** CPU buffers are immutable. Each mounted copy owns its GPU buffers through R3F. */
export const resolveMechanicalBuffers = (parts: readonly Part[]) => {
  const cached = bufferCache.get(parts);
  if (cached) return cached;

  const geometry = mergeGeometries(
    parts.map((part) => {
      const geometry = part();
      return geometry.index ? geometry.toNonIndexed() : geometry;
    }),
  );
  const position = (geometry.getAttribute("position") as BufferAttribute).array;
  const normal = (geometry.getAttribute("normal") as BufferAttribute).array;
  const buffers = { position, normal };
  bufferCache.set(parts, buffers);
  return buffers;
};
