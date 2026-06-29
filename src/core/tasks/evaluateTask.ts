import { feedbackEngine } from "./feedbackEngine";
import { evaluateCompositionTargets } from "./evaluateCompositionTargets";
import { evaluateFocusTargets } from "./evaluateFocusTargets";
import { calculateCompositionCoverage } from "../optics/calculateCompositionCoverage";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import type { TaskCriteriaEvaluation, TaskDefinition, TaskEvaluation } from "../../types/task";

export const evaluateTask = (
  task: TaskDefinition,
  scene: SceneDefinition,
  opticsState: DerivedOpticsState,
): TaskEvaluation => {
  const focusCoverage = opticsState.focusTargets.length === 0 ? 0 : opticsState.focusTargets[0].sharpness;
  const compositionCoverage = calculateCompositionCoverage(scene);
  const criteria: TaskCriteriaEvaluation[] = task.criteria.map((criterion) => {
    const score = criterion.target === "focus" ? focusCoverage : compositionCoverage;
    const passed = criterion.target === "focus" ? evaluateFocusTargets(opticsState.focusTargets) : evaluateCompositionTargets(compositionCoverage);
    return {
      criterionId: criterion.id,
      label: criterion.label,
      passed,
      score,
    };
  });
  const passed = criteria.every((criterion) => criterion.passed);
  const score = Math.round((criteria.reduce((total, criterion) => total + criterion.score, 0) / criteria.length) * 100);
  const status: TaskEvaluation["status"] = passed ? "passed" : "failed";

  const evaluation: TaskEvaluation = {
    taskId: task.id,
    status,
    score,
    criteria,
    primaryFeedback: "",
    secondaryFeedback: [],
  };
  const feedback = feedbackEngine(task, evaluation);
  evaluation.primaryFeedback = feedback.primaryFeedback;
  evaluation.secondaryFeedback = feedback.secondaryFeedback;
  return evaluation;
};
