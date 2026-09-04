import type { Plane, Vec3 } from "../types/optics";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../utils/constants";
import { roundToStep } from "../utils/roundToStep";
import { planeFromPointNormal } from "../core/math/plane";
import { calculateLensNormal } from "../core/optics/calculateLensPlane";
import { dot, isFiniteVec3, safeNormalize } from "../core/math/vec";
import obliqueTabletopGeometry from "./obliqueTabletopGeometry";

const radiansToDegrees = (radians: number): number => (radians * 180) / Math.PI;

type CompoundOpticalValues = {
  frontTiltDeg: number;
  frontSwingDeg: number;
  focusDistanceMm: number;
};

export type ObliqueTabletopCompoundCalibration = {
  focalLengthMm: number;
  subjectPlane: Plane;
  horizontalNormalMagnitude: number;
  requiredLensHorizontalNormalMagnitude: number;
  continuous: CompoundOpticalValues & {
    lensNormal: Vec3;
  };
  public: CompoundOpticalValues & {
    aperture: 11;
    lensNormal: Vec3;
  };
  publicStep: {
    frontTiltDeg: number;
    frontSwingDeg: number;
    focusDistanceMm: number;
  };
};

const assertWithin = (
  value: number,
  min: number,
  max: number,
  label: string,
): void => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(
      `Oblique Tabletop compound calibration ${label} ${value} is outside [${min}, ${max}]`,
    );
  }
};

/**
 * Derive the compound solution from the canonical subject plane.
 *
 * With the existing optical-axis-conjugate film datum, the subject normal's
 * horizontal component must be parallel to the lens normal's horizontal
 * component. If N·x=d and q=|N_xy|, the conjugate-film hinge condition gives
 * |n_xy| = f*q/d. This is a feasibility check as well as the continuous
 * solution; it fails closed when the canonical plane cannot be reached by a
 * real lens normal. The public values are only the nearest shared control
 * steps and are validated separately by physical tests.
 */
export const deriveObliqueTabletopCompoundCalibration = (
  canonicalSubjectPlane: Pick<Plane, "point" | "normal"> = obliqueTabletopGeometry.tabletopTopSurfacePlane,
): ObliqueTabletopCompoundCalibration => {
  const focalLengthMm = CAMERA_CONSTANTS.focalLengthMm;
  const subjectPlane = planeFromPointNormal(
    canonicalSubjectPlane.point,
    canonicalSubjectPlane.normal,
  );
  const horizontalNormalMagnitude = Math.hypot(
    subjectPlane.normal.x,
    subjectPlane.normal.y,
  );
  const signedPlaneDistanceMm = subjectPlane.distance;

  if (
    !Number.isFinite(horizontalNormalMagnitude) ||
    horizontalNormalMagnitude <= 1e-9
  ) {
    throw new Error("Oblique Tabletop compound calibration requires a horizontal plane component");
  }
  if (!Number.isFinite(signedPlaneDistanceMm) || signedPlaneDistanceMm <= 0) {
    throw new Error("Oblique Tabletop compound calibration requires a positive subject-plane distance");
  }

  const requiredLensHorizontalNormalMagnitude =
    (focalLengthMm * horizontalNormalMagnitude) / signedPlaneDistanceMm;
  if (
    !Number.isFinite(requiredLensHorizontalNormalMagnitude) ||
    requiredLensHorizontalNormalMagnitude <= 0 ||
    requiredLensHorizontalNormalMagnitude >= 1
  ) {
    throw new Error(
      `Oblique Tabletop compound calibration is infeasible: required horizontal lens-normal magnitude is ${requiredLensHorizontalNormalMagnitude}`,
    );
  }

  const horizontalDirection = safeNormalize(
    {
      x: subjectPlane.normal.x,
      y: subjectPlane.normal.y,
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
    throw new Error("Oblique Tabletop compound calibration produced an invalid lens normal");
  }

  // calculateLensNormal uses n_y=-sin(Tilt), then applies Swing around Y.
  // These inverse mappings therefore preserve the repository's public signs.
  const frontTiltDeg = radiansToDegrees(Math.asin(-lensNormal.y));
  const frontSwingDeg = radiansToDegrees(Math.atan2(lensNormal.x, lensNormal.z));
  const normalAlignment = dot(subjectPlane.normal, lensNormal);
  const focusDistanceMm = signedPlaneDistanceMm / normalAlignment;

  assertWithin(
    frontTiltDeg,
    CAMERA_CONSTANTS.tiltMinDeg,
    CAMERA_CONSTANTS.tiltMaxDeg,
    "continuous Front Tilt",
  );
  assertWithin(
    frontSwingDeg,
    CAMERA_CONSTANTS.swingMinDeg,
    CAMERA_CONSTANTS.swingMaxDeg,
    "continuous Front Swing",
  );
  if (!Number.isFinite(focusDistanceMm) || focusDistanceMm <= 0) {
    throw new Error("Oblique Tabletop compound calibration produced an invalid focus distance");
  }

  const continuousLensNormal = calculateLensNormal(frontTiltDeg, frontSwingDeg);
  const publicValues: CompoundOpticalValues = {
    frontTiltDeg: roundToStep(frontTiltDeg, CAMERA_CONTROL_STEPS.tiltDeg),
    frontSwingDeg: roundToStep(frontSwingDeg, CAMERA_CONTROL_STEPS.swingDeg),
    focusDistanceMm: roundToStep(focusDistanceMm, CAMERA_CONTROL_STEPS.focusDistanceMm),
  };
  assertWithin(
    publicValues.frontTiltDeg,
    CAMERA_CONSTANTS.tiltMinDeg,
    CAMERA_CONSTANTS.tiltMaxDeg,
    "public Front Tilt",
  );
  assertWithin(
    publicValues.frontSwingDeg,
    CAMERA_CONSTANTS.swingMinDeg,
    CAMERA_CONSTANTS.swingMaxDeg,
    "public Front Swing",
  );
  assertWithin(
    publicValues.focusDistanceMm,
    obliqueTabletopGeometry.focusDistanceRangeMm.min,
    obliqueTabletopGeometry.focusDistanceRangeMm.max,
    "public Focus",
  );

  return {
    focalLengthMm,
    subjectPlane,
    horizontalNormalMagnitude,
    requiredLensHorizontalNormalMagnitude,
    continuous: {
      ...{
        frontTiltDeg,
        frontSwingDeg,
        focusDistanceMm,
      },
      lensNormal: continuousLensNormal,
    },
    public: {
      ...publicValues,
      aperture: 11,
      lensNormal: calculateLensNormal(
        publicValues.frontTiltDeg,
        publicValues.frontSwingDeg,
      ),
    },
    publicStep: {
      frontTiltDeg: CAMERA_CONTROL_STEPS.tiltDeg,
      frontSwingDeg: CAMERA_CONTROL_STEPS.swingDeg,
      focusDistanceMm: CAMERA_CONTROL_STEPS.focusDistanceMm,
    },
  };
};

export const obliqueTabletopCompoundCalibration =
  deriveObliqueTabletopCompoundCalibration();

export default obliqueTabletopCompoundCalibration;
