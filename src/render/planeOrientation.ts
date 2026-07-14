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
