import { feedbackEngine } from "./feedbackEngine";
import { evaluateCompositionTargets } from "./evaluateCompositionTargets";
import { evaluateFocusTargets } from "./evaluateFocusTargets";
import { calculateCompositionCoverage } from "../optics/calculateCompositionCoverage";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import type { TaskDefinition, TaskEvaluation } from "../../types/task";

export const evaluateTask = (
  task: TaskDefinition,
  scene: SceneDefinition,
  opticsState: DerivedOpticsState,
): TaskEvaluation => {
  const focusPass = evaluateFocusTargets(opticsState.focusTargets);
  const compositionPass = evaluateCompositionTargets(calculateCompositionCoverage(scene));
  const passed = focusPass && compositionPass;
  const score = passed ? 100 : 55;

  const evaluation: TaskEvaluation = {
    taskId: task.id,
    passed,
    score,
    feedback: [],
  };
  evaluation.feedback = feedbackEngine(evaluation);
  return evaluation;
};
