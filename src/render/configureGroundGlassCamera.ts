import * as THREE from "three";
import { WORLD_SCALE } from "./rttUtils";
import type { DerivedOpticsState } from "../types/optics";

/**
 * Configure a Three.js camera to use an off-axis projection matching the optics state.
 * - opticsState fields are in millimetres. Convert them to world units (meters) using WORLD_SCALE.
 * - nearWorld/farWorld are in world units (meters).
 */
export function configureGroundGlassCamera(
  camera: THREE.Camera,
  opticsState: DerivedOpticsState,
  nearWorld: number,
  farWorld: number,
): void {
  const film = opticsState.filmPlaneCornersWorld;
  const lens = opticsState.lensCenterWorld;
  if (!film || !lens) return;

  // convert mm -> meters
  const toW = (v: { x: number; y: number; z: number }) =>
    new THREE.Vector3(v.x * WORLD_SCALE, v.y * WORLD_SCALE, v.z * WORLD_SCALE);
  const topLeft = toW(film.topLeft);
  const topRight = toW(film.topRight);
  const bottomLeft = toW(film.bottomLeft);
  const lensPos = toW(lens);

  // compute distances in world units (meters)
  const dz = Math.abs(topLeft.z - lensPos.z);
  if (!Number.isFinite(dz) || dz <= 0.0) return;

  const near = nearWorld;
  const far = farWorld;
  const scale = near / dz;

  const left = (topLeft.x - lensPos.x) * scale;
  const right = (topRight.x - lensPos.x) * scale;
  const top = (topLeft.y - lensPos.y) * scale;
  const bottom = (bottomLeft.y - lensPos.y) * scale;

  const width = right - left;
  const height = top - bottom;
  const depth = far - near;

  if (width === 0 || height === 0 || depth === 0) return;

  const m = new THREE.Matrix4();
  // row-major set
  m.set(
    (2 * near) / width,
    0,
    0,
    0,
    0,
    (2 * near) / height,
    0,
    0,
    (right + left) / width,
    (top + bottom) / height,
    -(far + near) / depth,
    -1,
    0,
    0,
    (-2 * far * near) / depth,
    0,
  );

  camera.projectionMatrix.copy(m);
  // ensure inverse is up-to-date
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  // set camera world transform: put camera at lens position and orient along optical axis
  camera.position.set(lensPos.x, lensPos.y, lensPos.z);
  // derive lookAt direction from opticsState.opticalAxis
  const dir = opticsState.opticalAxis.direction;
  const lookAt = new THREE.Vector3(
    lensPos.x + dir.x * 1000 * WORLD_SCALE,
    lensPos.y + dir.y * 1000 * WORLD_SCALE,
    lensPos.z + dir.z * 1000 * WORLD_SCALE,
  );
  camera.up.set(0, 1, 0);
  (camera as THREE.PerspectiveCamera).lookAt(lookAt);
  camera.updateMatrixWorld(true);
}
