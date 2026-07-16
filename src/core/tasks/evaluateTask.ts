import { feedbackEngine } from "./feedbackEngine";
import { evaluateCompositionTargets } from "./evaluateCompositionTargets";
import { evaluateFocusTargets } from "./evaluateFocusTargets";
import { calculateCompositionCoverage, calculateCompositionCoverageByTarget } from "../optics/calculateCompositionCoverage";
import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import type { TaskCriteriaEvaluation, TaskDefinition, TaskEvaluation, MovementAxis } from "../../types/task";

const movementValue = (camera: CameraState, movement: MovementAxis): number => {
  switch (movement) {
    case "rise":
      return camera.frontRiseMm;
    case "tilt":
      return camera.frontTiltDeg;
    case "swing":
      return camera.frontSwingDeg;
  }
};

export const evaluateTask = (
  task: TaskDefinition,
  scene: SceneDefinition,
  camera: CameraState,
  opticsState: DerivedOpticsState,
): TaskEvaluation => {
  const compositionCoverageByTarget = calculateCompositionCoverageByTarget(scene, opticsState);
  const compositionCoverage = calculateCompositionCoverage(scene, opticsState);

  const criteria: TaskCriteriaEvaluation[] = task.criteria.map((criterion) => {
    switch (criterion.type) {
      case "focus-targets-sharp": {
        const passed = evaluateFocusTargets(
          opticsState.focusTargets,
          criterion.targetIds,
          criterion.minimumSharpness,
        );
        const targetScores = criterion.targetIds.map((targetId) => {
          const target = opticsState.focusTargets.find((entry) => entry.id === targetId);
          return target?.sharpness ?? 0;
        });
        const score = targetScores.length === 0 ? 0 : Math.min(...targetScores);
        return {
          criterionId: criterion.id,
          label: criterion.label,
          passed,
          score,
          message: passed ? "Focus targets are sharp enough" : "Some focus targets are too soft",
        };
      }
      case "movement-used": {
        const value = Math.abs(movementValue(camera, criterion.movement));
        const passed = value >= criterion.minimumAbs;
        return {
          criterionId: criterion.id,
          label: criterion.label,
          passed,
          score: Math.min(1, value / Math.max(criterion.minimumAbs, 1e-9)),
          message: passed
            ? `${criterion.movement} movement used`
            : `${criterion.movement} movement not used enough`,
        };
      }
      case "movement-range": {
        const rawValue = movementValue(camera, criterion.movement);
        const value = criterion.valueMode === "signed" ? rawValue : Math.abs(rawValue);
        const passed = value >= criterion.min && value <= criterion.max;
        const inRangeScore =
          criterion.valueMode === "signed"
            ? (() => {
                const rangeSpan = Math.max(Math.abs(criterion.max - criterion.min), 1e-9);
                const distanceToRange =
                  value < criterion.min
                    ? criterion.min - value
                    : value > criterion.max
                      ? value - criterion.max
                      : 0;
                return passed ? 1 : 1 - distanceToRange / rangeSpan;
              })()
            : passed
              ? 1
              : value < criterion.min
                ? value / Math.max(criterion.min, 1e-9)
                : criterion.max / value;
        return {
          criterionId: criterion.id,
          label: criterion.label,
          passed,
          score: Math.max(0, Math.min(1, inRangeScore)),
          message: passed
            ? `${criterion.movement} is within allowed range`
            : `${criterion.movement} is outside allowed range`,
        };
      }
      case "allowed-aperture": {
        const passed = criterion.allowedApertures.includes(camera.aperture);
        return {
          criterionId: criterion.id,
          label: criterion.label,
          passed,
          score: passed ? 1 : 0,
          message: passed ? "Aperture is allowed" : "Aperture is not allowed for this task",
        };
      }
      case "composition-visible": {
        const score = compositionCoverageByTarget[criterion.targetId] ?? 0;
        const passed = evaluateCompositionTargets(
          compositionCoverageByTarget,
          criterion.targetId,
          criterion.minimumCoverage,
        );
        return {
          criterionId: criterion.id,
          label: criterion.label,
          passed,
          score,
          message: passed ? "Composition target is visible enough" : "Composition target visibility is too low",
        };
      }
    }
  });

  const requiredCriteria = criteria;
  const passed = requiredCriteria.every((criterion) => criterion.passed);
  const passedCount = requiredCriteria.filter((criterion) => criterion.passed).length;
  const score = requiredCriteria.length === 0 ? 0 : Math.round((passedCount / requiredCriteria.length) * 100);
  const status: TaskEvaluation["status"] = passed ? "passed" : "failed";

  const evaluation: TaskEvaluation = {
    taskId: task.id,
    status,
    score,
    criteria,
    primaryFeedback: "",
    secondaryFeedback: [],
    finalCameraState: {
      frontRiseMm: camera.frontRiseMm,
      frontTiltDeg: camera.frontTiltDeg,
      frontSwingDeg: camera.frontSwingDeg,
      focusDistanceMm: camera.focusDistanceMm,
      aperture: camera.aperture,
    },
  };
  const feedback = feedbackEngine(task, evaluation, {
    camera,
    opticsState,
    scene,
    compositionCoverage,
    compositionCoverageByTarget,
  });
  evaluation.primaryFeedback = feedback.primaryFeedback;
  evaluation.secondaryFeedback = feedback.secondaryFeedback;
  return evaluation;
};
