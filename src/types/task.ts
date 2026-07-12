import type { CameraState } from "./camera";
import type { ApertureValue } from "./camera";
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
  /** Optional presentation-only objective/summary for UI cards */
  objective?: string;
  mode: "guided" | "free";
  enabledControls: Array<"rise" | "tilt" | "swing" | "focusDistance" | "aperture" | "geometryView">;
  constraints: {
    movement?: "rise-only" | "tilt-only" | "swing-only";
    notes: string[];
  };
  criteria: TaskSuccessCriterion[];
  feedbackRules: {
    passPrimary: string;
    defaultFailPrimary: string;
    failPrimaryByCriterionId: Record<string, string>;
    failSecondaryByCriterionId: Record<string, string>;
  };
  initialCameraState?: TaskInitialCameraState;
};

export type MovementAxis = "rise" | "tilt" | "swing";

export type FocusTargetsSharpCriterion = {
  id: string;
  label: string;
  type: "focus-targets-sharp";
  targetIds: string[];
  minimumSharpness: number;
};

export type MovementUsedCriterion = {
  id: string;
  label: string;
  type: "movement-used";
  movement: MovementAxis;
  minimumAbs: number;
};

export type MovementRangeCriterion = {
  id: string;
  label: string;
  type: "movement-range";
  movement: MovementAxis;
  min: number;
  max: number;
};

export type AllowedApertureCriterion = {
  id: string;
  label: string;
  type: "allowed-aperture";
  allowedApertures: ApertureValue[];
};

export type CompositionVisibleCriterion = {
  id: string;
  label: string;
  type: "composition-visible";
  targetId: string;
  minimumCoverage: number;
};

export type TaskSuccessCriterion =
  | FocusTargetsSharpCriterion
  | MovementUsedCriterion
  | MovementRangeCriterion
  | AllowedApertureCriterion
  | CompositionVisibleCriterion;

export type TaskCriteriaEvaluation = {
  criterionId: string;
  label: string;
  passed: boolean;
  score: number;
  message: string;
};

export type TaskEvaluation = {
  taskId: string;
  status: "passed" | "failed";
  score: number;
  criteria: TaskCriteriaEvaluation[];
  primaryFeedback: string;
  secondaryFeedback: string[];
  finalCameraState?: Pick<CameraState, "frontRiseMm" | "frontTiltDeg" | "frontSwingDeg" | "focusDistanceMm" | "aperture">;
};

export type TaskEvaluationContext = {
  task: TaskDefinition;
  scene: SceneDefinition;
};
