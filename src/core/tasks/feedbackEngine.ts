import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import type { TaskDefinition, TaskEvaluation } from "../../types/task";

type FeedbackContext = {
  camera: CameraState;
  opticsState: DerivedOpticsState;
  scene: SceneDefinition;
  compositionCoverage: number;
  compositionCoverageByTarget: Record<string, number>;
};

export const feedbackEngine = (
  task: TaskDefinition,
  evaluation: TaskEvaluation,
  _context: FeedbackContext,
): { primaryFeedback: string; secondaryFeedback: string[] } => {
  void _context;

  if (evaluation.status === "passed") {
    return {
      primaryFeedback: task.feedbackRules.passPrimary,
      secondaryFeedback: [],
    };
  }

  const firstFailedCriterion = evaluation.criteria.find((criterion) => !criterion.passed);
  const primaryFeedback =
    (firstFailedCriterion && task.feedbackRules.failPrimaryByCriterionId[firstFailedCriterion.criterionId]) ||
    task.feedbackRules.defaultFailPrimary;
  const secondaryHint = firstFailedCriterion
    ? task.feedbackRules.failSecondaryByCriterionId[firstFailedCriterion.criterionId]
    : undefined;

  return {
    primaryFeedback,
    secondaryFeedback: secondaryHint ? [secondaryHint] : [],
  };
};
