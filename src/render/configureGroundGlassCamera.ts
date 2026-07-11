import * as THREE from "three";
import { WORLD_SCALE } from "./rttUtils";
import type { DerivedOpticsState } from "../types/optics";

export type GroundGlassCameraConfigResult =
  | {
      ok: true;
      left: number;
      right: number;
      top: number;
      bottom: number;
      near: number;
      far: number;
      determinant: number;
    }
  | {
      ok: false;
      reason: string;
    };

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
): GroundGlassCameraConfigResult {
  const film = opticsState.filmPlaneCornersWorld;
  const lens = opticsState.lensCenterWorld;
  if (!film || !lens) return { ok: false, reason: "missing film or lens data" };

  // convert mm -> meters
  const toW = (v: { x: number; y: number; z: number }) =>
    new THREE.Vector3(v.x * WORLD_SCALE, v.y * WORLD_SCALE, v.z * WORLD_SCALE);
  const fTL = toW(film.topLeft);
  const fTR = toW(film.topRight);
  const fBL = toW(film.bottomLeft);
  const fBR = toW(film.bottomRight ?? { x: (film.topLeft.x + film.topRight.x + film.bottomLeft.x) / 3, y: (film.topLeft.y + film.topRight.y + film.bottomLeft.y) / 3, z: (film.topLeft.z + film.topRight.z + film.bottomLeft.z) / 3 });
  const lensPos = toW(lens);

  // compute film center
  const filmCenter = new THREE.Vector3().addVectors(fTL, fTR).add(fBL).add(fBR).multiplyScalar(0.25);

  // filmUp: topLeft - bottomLeft
  const filmUp = new THREE.Vector3().subVectors(fTL, fBL);
  const filmRight = new THREE.Vector3().subVectors(fTR, fTL);
  if (filmUp.lengthSq() < 1e-9 || filmRight.lengthSq() < 1e-9) {
    return { ok: false, reason: "degenerate film axes" };
  }
  filmUp.normalize();
  filmRight.normalize();

  // film normal derived from filmRight and filmUp (object-facing)
  const filmNormal = new THREE.Vector3().crossVectors(filmRight, filmUp);
  if (filmNormal.lengthSq() < 1e-9) return { ok: false, reason: "degenerate film normal" };
  filmNormal.normalize();
  // Ensure filmNormal points toward the object side (toward the lens). Use sign only, not as the projection basis.
  const lensVec = new THREE.Vector3().subVectors(lensPos, filmCenter);
  if (filmNormal.dot(lensVec) < 0) filmNormal.negate();

  // objectForward: use object-facing film-plane normal (prevents camera tilt when lens shifts due to rise)
  const objectForward = filmNormal.clone();

  // Configure camera transform using real API: position at lens, up=filmUp, look towards lens + objectForward
  camera.position.set(lensPos.x, lensPos.y, lensPos.z);
  camera.up.copy(filmUp);
  const lookTarget = new THREE.Vector3().copy(lensPos).add(objectForward);
  (camera as THREE.Camera).lookAt(lookTarget);
  // ensure matrices updated
  camera.updateMatrix();
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

  // Reflect film corners through lens to get virtual object-side corners
  const virtual = [fTL, fTR, fBL, fBR].map((fc) => new THREE.Vector3().subVectors(lensPos, fc).add(lensPos)); // lens + (lens - fc)

  // Transform each virtual corner into camera-local coords
  const local = virtual.map((v) => v.clone().applyMatrix4(camera.matrixWorldInverse));

  // Check that each local.z < 0 (in front of camera in three.js camera coords)
  for (const p of local) {
    if (!Number.isFinite(p.z) || p.z >= -1e-6) {
      return { ok: false, reason: "virtual film corner behind lens or invalid z" };
    }
  }

  const near = nearWorld;
  const far = farWorld;

  // compute near-plane extents: xNear = x * near / depth (depth = -local.z)
  const xp = local.map((p) => (p.x * near) / (-p.z));
  const yp = local.map((p) => (p.y * near) / (-p.z));

  const left = Math.min(...xp);
  const right = Math.max(...xp);
  const bottom = Math.min(...yp);
  const top = Math.max(...yp);

  // validate extents
  if (!isFinite(left) || !isFinite(right) || !isFinite(top) || !isFinite(bottom)) {
    return { ok: false, reason: "non-finite frustum extents" };
  }
  if (Math.abs(right - left) < 1e-12 || Math.abs(top - bottom) < 1e-12) {
    return { ok: false, reason: "degenerate frustum extents" };
  }

  // Set custom off-axis projection
  (camera.projectionMatrix as THREE.Matrix4).makePerspective(left, right, top, bottom, near, far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  // Ensure camera world/inverse are current
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

  const det = camera.projectionMatrix.determinant();
  if (!isFinite(det) || Math.abs(det) < 1e-12) {
    return { ok: false, reason: "projection matrix determinant invalid" };
  }

  return { ok: true, left, right, top, bottom, near, far, determinant: det };
}
