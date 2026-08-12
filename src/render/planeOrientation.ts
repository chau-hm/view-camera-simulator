import { Matrix4, Quaternion, Vector3 } from "three";
import { WORLD_SCALE } from "./rttUtils";
import type {
  CameraBodyTransform,
  CameraRigTransform,
  Vec3,
} from "../types/optics";

export type PlaneOrthonormalBasis = {
  tangent: Vec3;
  bitangent: Vec3;
  normal: Vec3;
};

export type RenderGroupTransform = {
  position: [number, number, number];
  quaternion: Quaternion;
};

export type CameraRigRenderTransform = {
  rigPlacement: RenderGroupTransform;
  bodyPitch: RenderGroupTransform;
  localOffset: [number, number, number];
};

export type CameraBodyRenderTransform = RenderGroupTransform & {
  localOffset: [number, number, number];
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
  const s = WORLD_SCALE;
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

/**
 * Derive the front-standard render transform from canonical lens geometry.
 *
 * Position comes directly from lensCenterWorld (mm → render units via WORLD_SCALE).
 * Orientation comes from lensNormalWorld using quaternionForPlaneNormal to avoid
 * Euler-order divergence for combined tilt and swing.  Diagnostics tilt/swing values
 * must not be used as the geometry source.
 *
 * Local +Z represents the lens-plane normal, local +X/+Y follow the deterministic
 * orthonormal basis produced by createPlaneOrthonormalBasis.
 */
export const resolveFrontStandardRenderTransform = (
  lensCenterWorld: Vec3,
  lensNormalWorld: Vec3,
): { position: [number, number, number]; quaternion: Quaternion } => {
  const s = WORLD_SCALE;
  const position: [number, number, number] = [
    lensCenterWorld.x * s,
    lensCenterWorld.y * s,
    lensCenterWorld.z * s,
  ];
  const quaternion = quaternionForPlaneNormal(lensNormalWorld);
  return { position, quaternion };
};

/**
 * Build the canonical render hierarchy for a rigid camera rig.
 *
 * The outer group applies rig placement once. The body-pitch child translates
 * to the fixed rig-local pivot and rotates around rig-local +X. The local
 * geometry child translates back by that pivot, so standards, bellows, and
 * rail remain in rig-local coordinates and receive each transform exactly once.
 */
export const resolveCameraRigRenderTransform = (
  transform: CameraRigTransform,
): CameraRigRenderTransform => {
  const pivot = transform.bodyPitchPivotRigLocal;
  return {
    rigPlacement: {
      position: [
        transform.rigOriginWorld.x * WORLD_SCALE,
        transform.rigOriginWorld.y * WORLD_SCALE,
        transform.rigOriginWorld.z * WORLD_SCALE,
      ],
      quaternion: new Quaternion().setFromAxisAngle(
        new Vector3(1, 0, 0),
        (transform.basePitchDeg * Math.PI) / 180,
      ),
    },
    bodyPitch: {
      position: [
        pivot.x * WORLD_SCALE,
        pivot.y * WORLD_SCALE,
        pivot.z * WORLD_SCALE,
      ],
      quaternion: new Quaternion().setFromAxisAngle(
        new Vector3(1, 0, 0),
        (transform.bodyPitchDeg * Math.PI) / 180,
      ),
    },
    localOffset: [
      -pivot.x * WORLD_SCALE,
      -pivot.y * WORLD_SCALE,
      -pivot.z * WORLD_SCALE,
    ],
  };
};

/**
 * @deprecated Compatibility adapter for the former zero-origin,
 * zero-base-pitch renderer contract.
 */
export const resolveCameraBodyRenderTransform = (
  transform: CameraBodyTransform,
): CameraBodyRenderTransform => {
  const canonical = resolveCameraRigRenderTransform({
    rigOriginWorld: { x: 0, y: 0, z: 0 },
    basePitchDeg: 0,
    bodyPitchDeg: transform.pitchDeg,
    bodyPitchPivotRigLocal: transform.pivotWorld,
  });
  return {
    ...canonical.bodyPitch,
    localOffset: canonical.localOffset,
  };
};
