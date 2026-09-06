import { deriveOpticsState } from "../core/optics/deriveOpticsState";
import {
  INTERIOR_CORNER_CALIBRATION_APERTURE,
  evaluateInteriorCornerSwingFocus,
} from "./interiorCornerSwingFocus";
import { evaluateInteriorCornerRiseComposition } from "./interiorCornerRiseComposition";
import { interiorCornerScene } from "./definitions/interior-corner";
import type { CameraState } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";
import type { InteriorCornerGuidedCriterion } from "../types/task";

export const INTERIOR_CORNER_GUIDED_TASK_IDS = {
  compose: "interior-corner-compose-01",
  swing: "interior-corner-swing-01",
  refine: "interior-corner-refine-01",
  aperture: "interior-corner-aperture-01",
  // Compatibility aliases retained for the PR129 lifecycle/store consumers.
  // They intentionally point at the semantically equivalent PR130 stages.
  alignFocus: "interior-corner-refine-01",
  depthOfField: "interior-corner-aperture-01",
} as const;

export const INTERIOR_CORNER_GUIDED_FINAL_APERTURE = 11 as const;

/**
 * Robust public range used by the Swing, Refine, and Aperture stages. The
 * physical calibration remains the source of truth; this range only keeps
 * the task operable across neighboring public control steps.
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
): number =>
  targets.length === 0
    ? 0
    : targets.filter((target) => target.passed).length / targets.length;

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

const isInteriorCornerGuidedTask = (taskId: string | null): boolean =>
  taskId === INTERIOR_CORNER_GUIDED_TASK_IDS.compose ||
  taskId === INTERIOR_CORNER_GUIDED_TASK_IDS.swing ||
  taskId === INTERIOR_CORNER_GUIDED_TASK_IDS.refine ||
  taskId === INTERIOR_CORNER_GUIDED_TASK_IDS.aperture;

const hasPlausibleSwingOrientation = (
  camera: CameraState,
  opticsState: DerivedOpticsState,
): boolean => {
  const evaluation = evaluateInteriorCornerSwingFocus(opticsState, camera.aperture);
  return evaluation.status === "refine-focus" || evaluation.status === "aligned";
};

/**
 * A later Interior Corner lesson route is only safe to enter when the current
 * in-memory lesson session still contains the prerequisite photographic
 * result. Fresh deep links or reloads therefore restart at Observe rather
 * than presenting a locked stage whose prerequisite cannot be repaired.
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
    !lastInitializedRouteKey?.endsWith(":lesson") ||
    !isInteriorCornerGuidedTask(camera.activeTaskId)
  ) {
    return false;
  }

  const opticsState = deriveOpticsState(camera, interiorCornerScene);
  const compositionPassed = evaluateInteriorCornerRiseComposition(opticsState).passed;
  if (!compositionPassed) return false;

  if (taskId === INTERIOR_CORNER_GUIDED_TASK_IDS.swing) {
    return true;
  }

  if (taskId === INTERIOR_CORNER_GUIDED_TASK_IDS.refine) {
    if (
      camera.activeTaskId !== INTERIOR_CORNER_GUIDED_TASK_IDS.swing &&
      camera.activeTaskId !== INTERIOR_CORNER_GUIDED_TASK_IDS.refine &&
      camera.activeTaskId !== INTERIOR_CORNER_GUIDED_TASK_IDS.aperture
    ) {
      return false;
    }
    return hasPlausibleSwingOrientation(camera, opticsState);
  }

  if (taskId === INTERIOR_CORNER_GUIDED_TASK_IDS.aperture) {
    if (
      camera.activeTaskId !== INTERIOR_CORNER_GUIDED_TASK_IDS.refine &&
      camera.activeTaskId !== INTERIOR_CORNER_GUIDED_TASK_IDS.aperture
    ) {
      return false;
    }
    return evaluateInteriorCornerFocusAtCalibrationAperture(camera, opticsState).passed;
  }

  return false;
};

const evaluateSwingOrientationCriterion = (
  camera: CameraState,
  opticsState: DerivedOpticsState,
): InteriorCornerGuidedCriterionResult => {
  const evaluation = evaluateInteriorCornerSwingFocus(opticsState, camera.aperture);
  // Swing is deliberately a partial orientation stage. A fully aligned state
  // belongs to Refine Focus, so only the evaluator's refine-focus status passes.
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
