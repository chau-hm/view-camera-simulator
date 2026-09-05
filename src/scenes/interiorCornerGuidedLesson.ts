import { deriveOpticsState } from "../core/optics/deriveOpticsState";
import { INTERIOR_CORNER_CALIBRATION_APERTURE, evaluateInteriorCornerSwingFocus } from "./interiorCornerSwingFocus";
import { evaluateInteriorCornerRiseComposition } from "./interiorCornerRiseComposition";
import { interiorCornerScene } from "./definitions/interior-corner";
import type { CameraState } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";
import type { InteriorCornerGuidedCriterion } from "../types/task";

export const INTERIOR_CORNER_GUIDED_TASK_IDS = {
  compose: "interior-corner-compose-01",
  alignFocus: "interior-corner-align-focus-01",
  depthOfField: "interior-corner-depth-of-field-01",
} as const;

export const INTERIOR_CORNER_GUIDED_FINAL_APERTURE = 11 as const;

export type InteriorCornerGuidedCriterionResult = {
  passed: boolean;
  score: number;
};

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
 * current aperture. The final lesson stage must prove that Aperture was added
 * after the focus plane was aligned, rather than allowing it to hide a bad
 * Swing + Focus state.
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

/**
 * A later Interior Corner lesson route is only safe to enter when the current
 * in-memory lesson session still contains the prerequisite photographic
 * result. This keeps a fresh deep link or a browser reload from presenting a
 * locked, neutral stage that cannot be repaired with its visible controls.
 */
export const isInteriorCornerGuidedStageEntryRecoverable = ({
  taskId,
  camera,
  lastInitializedRouteKey,
}: {
  taskId: string;
  camera: CameraState;
  lastInitializedRouteKey?: string | null;
}): boolean => {
  if (taskId === INTERIOR_CORNER_GUIDED_TASK_IDS.compose) return true;
  if (
    camera.activeSceneId !== interiorCornerScene.id ||
    !lastInitializedRouteKey?.endsWith(":lesson")
  ) {
    return false;
  }

  const currentTaskId = camera.activeTaskId;
  const isInteriorCornerTask = (candidate: string | null): boolean =>
    candidate === INTERIOR_CORNER_GUIDED_TASK_IDS.compose ||
    candidate === INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus ||
    candidate === INTERIOR_CORNER_GUIDED_TASK_IDS.depthOfField;
  if (!isInteriorCornerTask(currentTaskId)) return false;

  const opticsState = deriveOpticsState(camera, interiorCornerScene);
  const compositionPassed = evaluateInteriorCornerRiseComposition(opticsState).passed;

  if (taskId === INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus) {
    return compositionPassed;
  }

  if (taskId === INTERIOR_CORNER_GUIDED_TASK_IDS.depthOfField) {
    if (
      currentTaskId !== INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus &&
      currentTaskId !== INTERIOR_CORNER_GUIDED_TASK_IDS.depthOfField
    ) {
      return false;
    }
    return (
      compositionPassed &&
      evaluateInteriorCornerFocusAtCalibrationAperture(camera, opticsState).passed
    );
  }

  return false;
};

const evaluateSwingOrientationCriterion = (
  camera: CameraState,
  opticsState: DerivedOpticsState,
): InteriorCornerGuidedCriterionResult => {
  const evaluation = evaluateInteriorCornerSwingFocus(opticsState, camera.aperture);
  const passed = evaluation.status === "refine-focus" || evaluation.status === "aligned";
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
  const passingTargets = evaluation.targets.filter((target) => target.passed).length;
  return {
    passed: evaluation.passed,
    score: passingTargets / evaluation.targets.length,
  };
};

const evaluateFocusPreservedCriterion = (
  camera: CameraState,
  opticsState: DerivedOpticsState,
): InteriorCornerGuidedCriterionResult => {
  const evaluation = evaluateInteriorCornerFocusAtCalibrationAperture(camera, opticsState);
  const passingTargets = evaluation.targets.filter((target) => target.passed).length;
  return {
    passed: evaluation.passed,
    score: passingTargets / evaluation.targets.length,
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
