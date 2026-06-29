import type { TaskEvaluation } from "../../types/task";

export const feedbackEngine = (evaluation: TaskEvaluation): string[] => {
  if (evaluation.passed) {
    return ["Good work. You matched the task constraints."];
  }
  return ["Adjust movement and focus to align the focus plane with subject geometry."];
};
