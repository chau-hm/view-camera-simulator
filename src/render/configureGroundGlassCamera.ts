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

  // compute film center and local basis
  const filmCenter = new THREE.Vector3().addVectors(fTL, fTR).add(fBL).add(fBR).multiplyScalar(0.25);
  const rightAxis = new THREE.Vector3().subVectors(fTR, fTL);
  const upAxis = new THREE.Vector3().subVectors(fTL, fBL);
  if (rightAxis.lengthSq() < 1e-9 || upAxis.lengthSq() < 1e-9) {
    return { ok: false, reason: "degenerate film axes" };
  }
  rightAxis.normalize();
  upAxis.normalize();
  // film normal (points from film toward object-side if oriented that way)
  const filmNormal = new THREE.Vector3().crossVectors(rightAxis, upAxis).normalize();
  // make sure normal points from lens towards virtual film side
  if (filmNormal.dot(new THREE.Vector3().subVectors(lensPos, filmCenter)) > 0) {
    filmNormal.negate();
  }

  // virtual corners: reflect film corners through the lens center
  const virtual = [fTL, fTR, fBL, fBR].map((fc) => new THREE.Vector3().subVectors(lensPos, fc).add(lensPos)); // lens + (lens - fc)

  // project virtual corners into camera-local basis defined by rightAxis, upAxis, filmNormal
  const projected = virtual.map((v) => {
    const rel = new THREE.Vector3().subVectors(v, lensPos);
    return {
      x: rel.dot(rightAxis),
      y: rel.dot(upAxis),
      z: rel.dot(filmNormal),
    };
  });

  // ensure all z are positive (in front of lens)
  for (const p of projected) {
    if (!Number.isFinite(p.z) || p.z <= 1e-6) {
      return { ok: false, reason: "virtual film corner behind lens or invalid z" };
    }
  }

  const near = nearWorld;
  const far = farWorld;

  // compute near-plane extents by perspective scale: x' = x * near / z
  const xp = projected.map((p) => (p.x * near) / p.z);
  const yp = projected.map((p) => (p.y * near) / p.z);

  const left = Math.min(...xp);
  const right = Math.max(...xp);
  const bottom = Math.min(...yp);
  const top = Math.max(...yp);

  // validate extents
  if (!isFinite(left) || !isFinite(right) || !isFinite(top) || !isFinite(bottom)) {
    return { ok: false, reason: "non-finite frustum extents" };
  }
  if (Math.abs(right - left) < 1e-9 || Math.abs(top - bottom) < 1e-9) {
    return { ok: false, reason: "degenerate frustum extents" };
  }

  // Use Three.js helper to construct projection matrix in column-major as expected
  // Matrix4.makePerspective expects (left, right, top, bottom, near, far)
  (camera.projectionMatrix as THREE.Matrix4).makePerspective(left, right, top, bottom, near, far);
  // ensure inverse is up-to-date
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  // Build a camera world transform: put camera at lensPos, with -Z pointing along filmNormal
  // Use an orthonormal basis where camera local X=rightAxis, local Y=upAxis, local Z = -filmNormal
  const cz = new THREE.Vector3().copy(filmNormal).negate();
  const cx = new THREE.Vector3().copy(rightAxis);
  const cy = new THREE.Vector3().copy(upAxis);
  const mat = new THREE.Matrix4();
  mat.makeBasis(cx, cy, cz); // columns are basis vectors
  // camera.matrixWorld = translation * rotation
  const t = new THREE.Matrix4().makeTranslation(lensPos.x, lensPos.y, lensPos.z);
  camera.matrixWorld.copy(t).multiply(mat);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  camera.position.set(lensPos.x, lensPos.y, lensPos.z);
  camera.up.copy(upAxis);

  // compute determinant for diagnostics
  const det = camera.projectionMatrix.determinant();
  if (!isFinite(det) || Math.abs(det) < 1e-12) {
    return { ok: false, reason: "projection matrix determinant invalid" };
  }

  return { ok: true, left, right, top, bottom, near, far, determinant: det };
}
