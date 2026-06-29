import type { CameraState } from "./camera";
import type { SceneDefinition } from "./scene";

export type TaskInitialCameraState = Pick<
  CameraState,
  | "frontRiseMm"
  | "frontTiltDeg"
  | "frontSwingDeg"
  | "focusDistanceMm"
  | "aperture"
  | "geometryView"
  | "groundGlassAssistEnabled"
  | "focusAssistEnabled"
  | "gridEnabled"
>;

export type TaskDefinition = {
  id: string;
  sceneId: string;
  title: string;
  mode: "guided" | "free";
  enabledControls: Array<"rise" | "tilt" | "swing" | "focusDistance" | "aperture" | "geometryView">;
  constraints: {
    movement?: "rise-only" | "tilt-only" | "swing-only";
    notes: string[];
  };
  criteria: Array<{
    id: string;
    label: string;
    target: "focus" | "composition";
    threshold: number;
  }>;
  feedbackRules: {
    passPrimary: string;
    failPrimary: string;
    failSecondary: string[];
  };
  initialCameraState?: TaskInitialCameraState;
};

export type TaskCriteriaEvaluation = {
  criterionId: string;
  label: string;
  passed: boolean;
  score: number;
};

export type TaskEvaluation = {
  taskId: string;
  status: "passed" | "failed";
  score: number;
  criteria: TaskCriteriaEvaluation[];
  primaryFeedback: string;
  secondaryFeedback: string[];
};

export type TaskEvaluationContext = {
  task: TaskDefinition;
  scene: SceneDefinition;
};
