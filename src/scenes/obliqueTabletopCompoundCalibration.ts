import type { Plane } from "../types/optics";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../utils/constants";
import {
  calibrateCompoundFocusPlane,
  type CompoundFocusPlaneCalibration,
} from "../core/optics/calibrateCompoundFocusPlane";
import obliqueTabletopGeometry from "./obliqueTabletopGeometry";

export type ObliqueTabletopCompoundCalibration = Omit<CompoundFocusPlaneCalibration, "public"> & {
  public: CompoundFocusPlaneCalibration["public"] & { aperture: 11 };
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
  canonicalSubjectPlane: Pick<Plane, "point" | "normal"> = obliqueTabletopGeometry.subjectBoardPlane,
): ObliqueTabletopCompoundCalibration => {
  const calibration = calibrateCompoundFocusPlane({
    focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
    subjectPlane: canonicalSubjectPlane,
    tiltRangeDeg: {
      min: CAMERA_CONSTANTS.tiltMinDeg,
      max: CAMERA_CONSTANTS.tiltMaxDeg,
    },
    swingRangeDeg: {
      min: CAMERA_CONSTANTS.swingMinDeg,
      max: CAMERA_CONSTANTS.swingMaxDeg,
    },
    focusDistanceRangeMm: obliqueTabletopGeometry.focusDistanceRangeMm,
    publicStep: {
      frontTiltDeg: CAMERA_CONTROL_STEPS.tiltDeg,
      frontSwingDeg: CAMERA_CONTROL_STEPS.swingDeg,
      focusDistanceMm: CAMERA_CONTROL_STEPS.focusDistanceMm,
    },
    label: "Oblique Tabletop",
  });

  return {
    ...calibration,
    public: {
      ...calibration.public,
      aperture: 11,
    },
  };
};

export const obliqueTabletopCompoundCalibration =
  deriveObliqueTabletopCompoundCalibration();

export default obliqueTabletopCompoundCalibration;
