import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import type { TaskDefinition, TaskEvaluation } from "../../types/task";
import { getGuidedTaskCopy, type GuidedTaskMessageRef } from "./guidedTaskCopyKeys";

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
): { primaryFeedback: GuidedTaskMessageRef; secondaryFeedback: GuidedTaskMessageRef[] } => {
  void _context;
  const copy = getGuidedTaskCopy(task);

  if (evaluation.status === "passed") {
    return {
      primaryFeedback: copy.feedback.passPrimary,
      secondaryFeedback: copy.feedback.passSecondary
        ? [copy.feedback.passSecondary]
        : [],
    };
  }

  const firstFailedCriterion = evaluation.criteria.find((criterion) => !criterion.passed);
  const primaryFeedback =
    (firstFailedCriterion && copy.feedback.primary[firstFailedCriterion.criterionId]) ||
    copy.feedback.defaultFailPrimary;
  const secondaryHint = firstFailedCriterion
    ? copy.feedback.secondary[firstFailedCriterion.criterionId]
    : undefined;

  return {
    primaryFeedback,
    secondaryFeedback: secondaryHint ? [secondaryHint] : [],
  };
};
