import { Matrix4, Quaternion, Vector3 } from "three";
import type { Vec3 } from "../types/optics";

export type PlaneOrthonormalBasis = {
  tangent: Vec3;
  bitangent: Vec3;
  normal: Vec3;
};

const fromVector3 = (value: Vector3): Vec3 => ({ x: value.x, y: value.y, z: value.z });

/** Build a deterministic right-handed basis whose local +Z is the plane normal. */
export const createPlaneOrthonormalBasis = (normal: Vec3): PlaneOrthonormalBasis => {
  const normalVector = new Vector3(normal.x, normal.y, normal.z).normalize();
  const reference = Math.abs(normalVector.z) < 0.9
    ? new Vector3(0, 0, 1)
    : new Vector3(0, 1, 0);
  const tangent = new Vector3().crossVectors(reference, normalVector).normalize();
  const bitangent = new Vector3().crossVectors(normalVector, tangent).normalize();
  return {
    tangent: fromVector3(tangent),
    bitangent: fromVector3(bitangent),
    normal: fromVector3(normalVector),
  };
};

export const quaternionForPlaneNormal = (normal: Vec3): Quaternion => {
  const basis = createPlaneOrthonormalBasis(normal);
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(
      new Vector3(basis.tangent.x, basis.tangent.y, basis.tangent.z),
      new Vector3(basis.bitangent.x, basis.bitangent.y, basis.bitangent.z),
      new Vector3(basis.normal.x, basis.normal.y, basis.normal.z),
    ),
  );
};

/**
 * Derive the rear-standard render transform from the canonical frame.
 *
 * Uses the full frame (right, up, normal, centre) to preserve roll
 * information that would be lost when reconstructing an orthonormal
 * basis from normal alone.
 *
 * Basis mapping: local +X → rightWorld, +Y → upWorld, +Z → normalWorld.
 * All inputs are in millimetre world space; the position is scaled to
 * render world units.
 */
export const resolveRearStandardRenderTransform = (frame: {
  centerWorld: Vec3;
  rightWorld: Vec3;
  upWorld: Vec3;
  normalWorld: Vec3;
}): { position: [number, number, number]; quaternion: Quaternion } => {
  const s = 0.001; // WORLD_SCALE
  const position: [number, number, number] = [
    frame.centerWorld.x * s,
    frame.centerWorld.y * s,
    frame.centerWorld.z * s,
  ];
  const quaternion = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(
      new Vector3(frame.rightWorld.x, frame.rightWorld.y, frame.rightWorld.z),
      new Vector3(frame.upWorld.x, frame.upWorld.y, frame.upWorld.z),
      new Vector3(frame.normalWorld.x, frame.normalWorld.y, frame.normalWorld.z),
    ),
  );
  return { position, quaternion };
};
