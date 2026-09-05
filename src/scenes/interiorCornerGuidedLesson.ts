import { deriveOpticsState } from "../core/optics/deriveOpticsState";
import {
  INTERIOR_CORNER_CALIBRATION_APERTURE,
  evaluateInteriorCornerSwingFocus,
} from "./interiorCornerSwingFocus";
import { evaluateInteriorCornerRiseComposition } from "./interiorCornerRiseComposition";
import { interiorCornerScene } from "./definitions/interior-corner";
import type { CameraState } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";
import type {
  InteriorCornerGuidedCriterion,
} from "../types/task";

export const INTERIOR_CORNER_GUIDED_TASK_IDS = {
  compose: "interior-corner-compose-01",
  swing: "interior-corner-swing-01",
  refine: "interior-corner-refine-01",
  aperture: "interior-corner-aperture-01",
} as const;

export const INTERIOR_CORNER_GUIDED_FINAL_APERTURE = 11 as const;

/**
 * Robust public ranges used by the Swing, Refine, and Aperture stages. The
 * physical calibration remains the source of truth; these ranges only keep
 * the task operable across neighboring public steps.
 */
export const INTERIOR_CORNER_GUIDED_SWING_RANGE = {
  min: 3.0,
  max: 4.2,
} as const;

export type InteriorCornerGuidedCriterionResult = {
  passed: boolean;
  score: number;
};

const passingTargetScore = (
  targets: readonly { passed: boolean }[],
): number => (targets.length === 0 ? 0 : targets.filter((target) => target.passed).length / targets.length);

const evaluateRiseCompositionCriterion = (
  opticsState: DerivedOpticsState,
): InteriorCornerGuidedCriterionResult => {
  const evaluation = evaluateInteriorCornerRiseComposition(opticsState);
  const passingAnchors = [evaluation.upperArchitecture, evaluation.roomCorner].filter(
    (anchor) => anchor.withinSafeFrame,
  ).length;
  return {
    passed: evaluation.passed,
    score: passingAnchors / 2,
  };
};

/**
 * Re-evaluate the open-aperture focus contract without changing the learner's
 * current aperture. The final aperture task must prove that the aligned
 * focus plane was preserved before the stop-down.
 */
export const evaluateInteriorCornerFocusAtCalibrationAperture = (
  camera: CameraState,
  opticsState: DerivedOpticsState,
) => {
  const calibrationOptics =
    camera.aperture === INTERIOR_CORNER_CALIBRATION_APERTURE
      ? opticsState
      : deriveOpticsState(
          { ...camera, aperture: INTERIOR_CORNER_CALIBRATION_APERTURE },
          interiorCornerScene,
        );
  return evaluateInteriorCornerSwingFocus(
    calibrationOptics,
    INTERIOR_CORNER_CALIBRATION_APERTURE,
  );
};

const evaluateSwingOrientationCriterion = (
  camera: CameraState,
  opticsState: DerivedOpticsState,
): InteriorCornerGuidedCriterionResult => {
  const evaluation = evaluateInteriorCornerSwingFocus(opticsState, camera.aperture);
  // The Swing stage teaches orientation only. Deliberately exclude the
  // aligned status so the first full wall-sharpness gate remains Refine.
  const passed = evaluation.status === "refine-focus";
  return {
    passed,
    score: passed ? 1 : 0,
  };
};

const evaluateWallFocusCriterion = (
  camera: CameraState,
  opticsState: DerivedOpticsState,
): InteriorCornerGuidedCriterionResult => {
  const evaluation = evaluateInteriorCornerSwingFocus(opticsState, camera.aperture);
  return {
    passed: evaluation.passed,
    score: passingTargetScore(evaluation.targets),
  };
};

const evaluateFocusPreservedCriterion = (
  camera: CameraState,
  opticsState: DerivedOpticsState,
): InteriorCornerGuidedCriterionResult => {
  const evaluation = evaluateInteriorCornerFocusAtCalibrationAperture(camera, opticsState);
  return {
    passed: evaluation.passed,
    score: passingTargetScore(evaluation.targets),
  };
};

export const evaluateInteriorCornerGuidedCriterion = (
  criterion: InteriorCornerGuidedCriterion,
  camera: CameraState,
  opticsState: DerivedOpticsState,
): InteriorCornerGuidedCriterionResult => {
  switch (criterion.type) {
    case "interior-corner-rise-composition":
      return evaluateRiseCompositionCriterion(opticsState);
    case "interior-corner-swing-orientation":
      return evaluateSwingOrientationCriterion(camera, opticsState);
    case "interior-corner-wall-focus":
      return evaluateWallFocusCriterion(camera, opticsState);
    case "interior-corner-focus-preserved":
      return evaluateFocusPreservedCriterion(camera, opticsState);
  }
};
