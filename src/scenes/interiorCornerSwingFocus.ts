import type { DerivedOpticsState, FocusTargetSharpness, Vec3 } from "../types/optics";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../core/optics/physicalSharpness";
import { calibrateVerticalPlaneSwing } from "../core/optics/calibrateVerticalPlaneSwing";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../utils/constants";
import { roundToStep } from "../utils/roundToStep";
import { interiorCornerScene } from "./definitions/interior-corner";
import geometry from "./interiorCornerGeometry";

export const INTERIOR_CORNER_CALIBRATION_APERTURE = 5.6 as const;

export const INTERIOR_CORNER_FOCUS_TARGET_IDS = [
  "interior-wall-near",
  "interior-wall-middle",
  "interior-wall-far",
] as const;

export type InteriorCornerFocusAlignmentStatus =
  | "misaligned"
  | "refine-focus"
  | "aligned"
  | "open-aperture-required";

const focusProbes = geometry.focusTargets.map((target) => target.worldPosition) as [
  Vec3,
  Vec3,
  Vec3,
];

const focalLengthMm =
  interiorCornerScene.cameraPreset.focalLengthMm ?? CAMERA_CONSTANTS.focalLengthMm;

const rawCalibration = calibrateVerticalPlaneSwing({
  focalLengthMm,
  focusProbes,
});

const publicCalibration = {
  frontSwingDeg: roundToStep(
    rawCalibration.frontSwingDeg,
    CAMERA_CONTROL_STEPS.swingDeg,
  ),
  focusDistanceMm: roundToStep(
    rawCalibration.focusDistanceMm,
    CAMERA_CONTROL_STEPS.focusDistanceMm,
  ),
  aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
} as const;

const focusDistanceRangeMm = geometry.focusDistanceRangeMm;

if (
  publicCalibration.frontSwingDeg < CAMERA_CONSTANTS.swingMinDeg ||
  publicCalibration.frontSwingDeg > CAMERA_CONSTANTS.swingMaxDeg ||
  publicCalibration.focusDistanceMm < focusDistanceRangeMm.min ||
  publicCalibration.focusDistanceMm > focusDistanceRangeMm.max
) {
  throw new Error("Interior Corner public Swing + Focus calibration is outside its control ranges");
}

/**
 * Raw and public-grid calibration for the one receding side-wall plane.
 * The perpendicular back wall is deliberately not part of this solution.
 */
export const interiorCornerSwingFocusCalibration = {
  focalLengthMm,
  aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
  focusDistanceRangeMm,
  targetIds: INTERIOR_CORNER_FOCUS_TARGET_IDS,
  raw: rawCalibration,
  public: publicCalibration,
  publicStep: {
    frontSwingDeg: CAMERA_CONTROL_STEPS.swingDeg,
    focusDistanceMm: CAMERA_CONTROL_STEPS.focusDistanceMm,
  },
} as const;

export type InteriorCornerSwingFocusTargetEvidence = {
  id: (typeof INTERIOR_CORNER_FOCUS_TARGET_IDS)[number];
  equivalentCoCDiameterMm: number | null;
  sharpness: number;
  passed: boolean;
};

export type InteriorCornerSwingFocusEvaluation = {
  apertureFNumber: number;
  apertureEligible: boolean;
  status: InteriorCornerFocusAlignmentStatus;
  targets: InteriorCornerSwingFocusTargetEvidence[];
  maximumCoCDiameterMm: number | null;
  passed: boolean;
};

const resolveTarget = (
  opticsState: DerivedOpticsState,
  id: (typeof INTERIOR_CORNER_FOCUS_TARGET_IDS)[number],
): FocusTargetSharpness | undefined => opticsState.focusTargets.find((target) => target.id === id);

const resolveEquivalentCoC = (target: FocusTargetSharpness | undefined): number | null => {
  const value = target?.patchEquivalentCoCDiameterMm;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
};

/**
 * Evaluate the physical sharpness of the three canonical details on the
 * receding wall. This is free-mode observation only; it is not a guided task.
 */
export const evaluateInteriorCornerSwingFocus = (
  opticsState: DerivedOpticsState,
  apertureFNumber: number,
): InteriorCornerSwingFocusEvaluation => {
  const targets = INTERIOR_CORNER_FOCUS_TARGET_IDS.map((id) => {
    const target = resolveTarget(opticsState, id);
    const equivalentCoCDiameterMm = resolveEquivalentCoC(target);
    return {
      id,
      equivalentCoCDiameterMm,
      sharpness: target?.physicalPatchSharpness ?? 0,
      passed:
        equivalentCoCDiameterMm !== null &&
        equivalentCoCDiameterMm <= ACCEPTABLE_COC_DIAMETER_MM,
    };
  });
  const cocValues = targets.map((target) => target.equivalentCoCDiameterMm);
  const maximumCoCDiameterMm = cocValues.every((value): value is number => value !== null)
    ? Math.max(...cocValues)
    : null;
  const apertureEligible = apertureFNumber === INTERIOR_CORNER_CALIBRATION_APERTURE;
  const passed = apertureEligible && targets.every((target) => target.passed);
  const calibratedSwingSign = Math.sign(interiorCornerSwingFocusCalibration.public.frontSwingDeg);
  const currentSwingAngleDeg = opticsState.diagnostics.swingAngleDeg;
  const hasMeaningfulSwing =
    Math.abs(currentSwingAngleDeg) >= CAMERA_CONTROL_STEPS.swingDeg / 2;
  const swingOrientationPlausiblyCorrect =
    hasMeaningfulSwing && Math.sign(currentSwingAngleDeg) === calibratedSwingSign;
  const status: InteriorCornerFocusAlignmentStatus = !apertureEligible
    ? "open-aperture-required"
    : passed
      ? "aligned"
      : swingOrientationPlausiblyCorrect
        ? "refine-focus"
        : "misaligned";

  return {
    apertureFNumber,
    apertureEligible,
    status,
    targets,
    maximumCoCDiameterMm,
    passed,
  };
};

export default interiorCornerSwingFocusCalibration;
