import type { Vec3 } from "../types/optics";

export type GroundGlassFilmPlaneProjectionInput = {
  worldPoint: Vec3;
  lensCenterWorld: Vec3;
  filmPlaneCornersWorld: {
    topLeft: Vec3;
    topRight: Vec3;
    bottomLeft: Vec3;
    bottomRight: Vec3;
  };
};

export type GroundGlassFilmPlaneProjectionResult = {
  visible: boolean;
  uRaw: number;
  vRaw: number;
  filmPointWorld: Vec3 | null;
};

const EPSILON = 1e-6;

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function mulScalar(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}
function normalize(a: Vec3): Vec3 {
  const len = length(a);
  if (len < EPSILON) return { x: 0, y: 0, z: 0 };
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

export function projectWorldPointToFilmPlaneGroundGlass(
  input: GroundGlassFilmPlaneProjectionInput,
): GroundGlassFilmPlaneProjectionResult {
  const { worldPoint, lensCenterWorld, filmPlaneCornersWorld } = input;

  const origin = filmPlaneCornersWorld.topLeft;
  const uAxis = sub(filmPlaneCornersWorld.topRight, filmPlaneCornersWorld.topLeft);
  const vAxis = sub(filmPlaneCornersWorld.bottomLeft, filmPlaneCornersWorld.topLeft);

  const planeNormal = normalize(cross(uAxis, vAxis));

  const rayOrigin = lensCenterWorld;
  // Scene points are in front of the lens (positive Z), while the film plane is behind it (negative Z).
  // Project by extending the object ray through the lens toward the film side: trace from the lens
  // center back toward the film by using (lensCenter - worldPoint) as the ray direction.
  const rayDir = normalize(sub(lensCenterWorld, worldPoint));

  const denom = dot(rayDir, planeNormal);
  if (Math.abs(denom) < EPSILON) {
    return { visible: false, uRaw: 0, vRaw: 0, filmPointWorld: null };
  }

  const t = dot(sub(origin, rayOrigin), planeNormal) / denom;
  if (t <= 0) {
    return { visible: false, uRaw: 0, vRaw: 0, filmPointWorld: null };
  }

  const intersection = add(rayOrigin, mulScalar(rayDir, t));
  const relative = sub(intersection, origin);

  const uDen = dot(uAxis, uAxis);
  const vDen = dot(vAxis, vAxis);
  if (Math.abs(uDen) < EPSILON || Math.abs(vDen) < EPSILON) {
    return { visible: false, uRaw: 0, vRaw: 0, filmPointWorld: null };
  }

  const uRaw = dot(relative, uAxis) / uDen;
  const vRaw = dot(relative, vAxis) / vDen;

  const visible = uRaw >= 0 && uRaw <= 1 && vRaw >= 0 && vRaw <= 1;

  return { visible, uRaw, vRaw, filmPointWorld: intersection };
}
