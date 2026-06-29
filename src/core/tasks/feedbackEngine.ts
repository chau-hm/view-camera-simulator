import type { TaskDefinition, TaskEvaluation } from "../../types/task";

export const feedbackEngine = (
  task: TaskDefinition,
  evaluation: TaskEvaluation,
): { primaryFeedback: string; secondaryFeedback: string[] } => {
  if (evaluation.status === "passed") {
    return {
      primaryFeedback: task.feedbackRules.passPrimary,
      secondaryFeedback: [],
    };
  }
  return {
    primaryFeedback: task.feedbackRules.failPrimary,
    secondaryFeedback: task.feedbackRules.failSecondary,
  };
};
