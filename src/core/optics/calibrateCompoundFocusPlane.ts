import type { Plane, Vec3 } from "../../types/optics";
import { planeFromPointNormal } from "../math/plane";
import { dot, isFiniteVec3, safeNormalize, scale } from "../math/vec";
import { calculateLensNormal } from "./calculateLensPlane";
import { roundToStep } from "../../utils/roundToStep";

type CompoundOpticalValues = {
  frontTiltDeg: number;
  frontSwingDeg: number;
  focusDistanceMm: number;
};
export type CompoundFocusPlaneCalibration = {
  focalLengthMm: number;
  subjectPlane: Plane;
  horizontalNormalMagnitude: number;
  requiredLensHorizontalNormalMagnitude: number;
  continuous: CompoundOpticalValues & {
    lensNormal: Vec3;
  };
  public: CompoundOpticalValues & {
    lensNormal: Vec3;
  };
  publicStep: {
    frontTiltDeg: number;
    frontSwingDeg: number;
    focusDistanceMm: number;
  };
};

export type CompoundFocusPlaneCalibrationInput = {
  focalLengthMm: number;
  subjectPlane: Pick<Plane, "point" | "normal">;
  tiltRangeDeg: { min: number; max: number };
  swingRangeDeg: { min: number; max: number };
  focusDistanceRangeMm?: { min: number; max: number };
  publicStep: {
    frontTiltDeg: number;
    frontSwingDeg: number;
    focusDistanceMm: number;
  };
  label?: string;
};

const radiansToDegrees = (radians: number): number => (radians * 180) / Math.PI;

const assertWithin = (
  value: number,
  min: number,
  max: number,
  label: string,
  prefix: string,
): void => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${prefix} ${label} ${value} is outside [${min}, ${max}]`);
  }
};

/**
 * Derive the finite-focus compound solution for a canonical subject plane.
 *
 * The optical-axis-conjugate film datum requires the horizontal component of
 * the lens normal to be parallel to the horizontal component of the subject
 * normal. If q=|N_xy| and d is the positive subject-plane distance, the
 * conjugate condition is |n_xy| = f*q/d. The caller owns the public control
 * ranges and steps so scene modules can validate their own reachable lattice.
 */
export const calibrateCompoundFocusPlane = ({
  focalLengthMm,
  subjectPlane: canonicalSubjectPlane,
  tiltRangeDeg,
  swingRangeDeg,
  focusDistanceRangeMm,
  publicStep,
  label = "Compound focus-plane",
}: CompoundFocusPlaneCalibrationInput): CompoundFocusPlaneCalibration => {
  const prefix = `${label} compound calibration`;
  const subjectPlane = planeFromPointNormal(
    canonicalSubjectPlane.point,
    canonicalSubjectPlane.normal,
  );
  const opticalSubjectPlane = planeFromPointNormal(
    subjectPlane.point,
    subjectPlane.normal.z < 0 ? scale(subjectPlane.normal, -1) : subjectPlane.normal,
  );
  const horizontalNormalMagnitude = Math.hypot(
    opticalSubjectPlane.normal.x,
    opticalSubjectPlane.normal.y,
  );
  const signedPlaneDistanceMm = opticalSubjectPlane.distance;

  if (
    !Number.isFinite(horizontalNormalMagnitude) ||
    horizontalNormalMagnitude <= 1e-9
  ) {
    throw new Error(`${prefix} requires a horizontal plane component`);
  }
  if (!Number.isFinite(signedPlaneDistanceMm) || signedPlaneDistanceMm <= 0) {
    throw new Error(`${prefix} requires a positive subject-plane distance`);
  }

  const requiredLensHorizontalNormalMagnitude =
    (focalLengthMm * horizontalNormalMagnitude) / signedPlaneDistanceMm;
  if (
    !Number.isFinite(requiredLensHorizontalNormalMagnitude) ||
    requiredLensHorizontalNormalMagnitude <= 0 ||
    requiredLensHorizontalNormalMagnitude >= 1
  ) {
    throw new Error(
      `${prefix} is infeasible: required horizontal lens-normal magnitude is ${requiredLensHorizontalNormalMagnitude}`,
    );
  }

  const horizontalDirection = safeNormalize(
    {
      x: opticalSubjectPlane.normal.x,
      y: opticalSubjectPlane.normal.y,
      z: 0,
    },
    { x: 0, y: 1, z: 0 },
  );
  const lensNormal = safeNormalize(
    {
      x: horizontalDirection.x * requiredLensHorizontalNormalMagnitude,
      y: horizontalDirection.y * requiredLensHorizontalNormalMagnitude,
      z: Math.sqrt(1 - requiredLensHorizontalNormalMagnitude ** 2),
    },
    { x: 0, y: 0, z: 1 },
  );
  if (!isFiniteVec3(lensNormal) || lensNormal.z <= 0) {
    throw new Error(`${prefix} produced an invalid lens normal`);
  }

  // calculateLensNormal uses n_y=-sin(Tilt), then applies Swing around Y.
  // These inverse mappings preserve the repository's public signs.
  const frontTiltDeg = radiansToDegrees(Math.asin(-lensNormal.y));
  const frontSwingDeg = radiansToDegrees(Math.atan2(lensNormal.x, lensNormal.z));
  const normalAlignment = dot(opticalSubjectPlane.normal, lensNormal);
  const focusDistanceMm = signedPlaneDistanceMm / normalAlignment;

  assertWithin(
    frontTiltDeg,
    tiltRangeDeg.min,
    tiltRangeDeg.max,
    "continuous Front Tilt",
    prefix,
  );
  assertWithin(
    frontSwingDeg,
    swingRangeDeg.min,
    swingRangeDeg.max,
    "continuous Front Swing",
    prefix,
  );
  if (!Number.isFinite(focusDistanceMm) || focusDistanceMm <= 0) {
    throw new Error(`${prefix} produced an invalid focus distance`);
  }

  const publicValues: CompoundOpticalValues = {
    frontTiltDeg: roundToStep(frontTiltDeg, publicStep.frontTiltDeg),
    frontSwingDeg: roundToStep(frontSwingDeg, publicStep.frontSwingDeg),
    focusDistanceMm: roundToStep(focusDistanceMm, publicStep.focusDistanceMm),
  };
  assertWithin(
    publicValues.frontTiltDeg,
    tiltRangeDeg.min,
    tiltRangeDeg.max,
    "public Front Tilt",
    prefix,
  );
  assertWithin(
    publicValues.frontSwingDeg,
    swingRangeDeg.min,
    swingRangeDeg.max,
    "public Front Swing",
    prefix,
  );
  if (focusDistanceRangeMm) {
    assertWithin(
      publicValues.focusDistanceMm,
      focusDistanceRangeMm.min,
      focusDistanceRangeMm.max,
      "public Focus",
      prefix,
    );
  }

  return {
    focalLengthMm,
    subjectPlane,
    horizontalNormalMagnitude,
    requiredLensHorizontalNormalMagnitude,
    continuous: {
      frontTiltDeg,
      frontSwingDeg,
      focusDistanceMm,
      lensNormal: calculateLensNormal(frontTiltDeg, frontSwingDeg),
    },
    public: {
      ...publicValues,
      lensNormal: calculateLensNormal(
        publicValues.frontTiltDeg,
        publicValues.frontSwingDeg,
      ),
    },
    publicStep,
  };
};
