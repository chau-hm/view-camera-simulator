import { describe, expect, it } from "vitest";
import { calibrateCompoundFocusPlane } from "../../core/optics/calibrateCompoundFocusPlane";
import { obliqueTabletopCompoundCalibration } from "../../scenes/obliqueTabletopCompoundCalibration";
import obliqueTabletopGeometry from "../../scenes/obliqueTabletopGeometry";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../../utils/constants";

describe("generic compound focus-plane calibration", () => {
  it("preserves Oblique Tabletop's continuous and public calibration", () => {
    const extracted = calibrateCompoundFocusPlane({
      focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
      subjectPlane: obliqueTabletopGeometry.subjectBoardPlane,
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

    expect(extracted.subjectPlane).toEqual(obliqueTabletopCompoundCalibration.subjectPlane);
    expect(extracted.horizontalNormalMagnitude).toBe(
      obliqueTabletopCompoundCalibration.horizontalNormalMagnitude,
    );
    expect(extracted.requiredLensHorizontalNormalMagnitude).toBe(
      obliqueTabletopCompoundCalibration.requiredLensHorizontalNormalMagnitude,
    );
    expect(extracted.continuous).toEqual(obliqueTabletopCompoundCalibration.continuous);
    expect(extracted.public).toEqual({
      frontTiltDeg: obliqueTabletopCompoundCalibration.public.frontTiltDeg,
      frontSwingDeg: obliqueTabletopCompoundCalibration.public.frontSwingDeg,
      focusDistanceMm: obliqueTabletopCompoundCalibration.public.focusDistanceMm,
      lensNormal: obliqueTabletopCompoundCalibration.public.lensNormal,
    });
    expect(extracted.publicStep).toEqual(obliqueTabletopCompoundCalibration.publicStep);
  });
});
