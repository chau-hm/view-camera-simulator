import type { CameraState } from "./camera";
import type { ApertureValue } from "./camera";
import type { SceneDefinition } from "./scene";
import type { GuidedTaskMessageKey } from "../i18n/guidedTaskMessageKeys";

export type MessageValues = Record<string, string | number>;

export type MessageRef<Key extends string = string> = {
  key: Key;
  values?: MessageValues;
};

export type GuidedTaskMessageRef = MessageRef<GuidedTaskMessageKey>;

export type TaskInitialCameraState = Pick<
  CameraState,
  | "frontRiseMm"
  | "frontTiltDeg"
  | "frontSwingDeg"
  | "rearRiseMm"
  | "rearTiltDeg"
  | "focusDistanceMm"
  | "aperture"
  | "groundGlassAssistEnabled"
  | "gridEnabled"
> &
  Partial<
    Pick<
      CameraState,
      "geometryView" | "frontShiftMm" | "mirrorShiftLessonState"
    >
  >;

export type TaskDefinition = {
  id: string;
  sceneId: string;
  mode: "guided" | "free";
  enabledControls: Array<
    | "rise"
    | "tilt"
    | "swing"
    | "focusDistance"
    | "aperture"
    | "geometryView"
    | "cameraPosition"
    | "frontShift"
  >;
  constraints: {
    movement?: "rise-only" | "tilt-only" | "swing-only";
  };
  criteria: TaskSuccessCriterion[];
  initialCameraState?: TaskInitialCameraState;
  initialViewState?: {
    showOpticalGeometry?: boolean;
  };
};

export type MovementAxis = "rise" | "tilt" | "swing";

export type FocusTargetsSharpCriterion = {
  id: string;
  type: "focus-targets-sharp";
  targetIds: string[];
  minimumSharpness: number;
};

export type MovementUsedCriterion = {
  id: string;
  type: "movement-used";
  movement: MovementAxis;
  minimumAbs: number;
};

export type FocusUsedCriterion = {
  id: string;
  type: "focus-used";
  minimumAbsMm: number;
};

export type MovementRangeCriterion = {
  id: string;
  type: "movement-range";
  movement: MovementAxis;
  min: number;
  max: number;
  valueMode?: "absolute" | "signed";
};

export type AllowedApertureCriterion = {
  id: string;
  type: "allowed-aperture";
  allowedApertures: ApertureValue[];
};

export type CompositionVisibleCriterion = {
  id: string;
  type: "composition-visible";
  targetId: string;
  minimumCoverage: number;
  /** Use projected target corners when a target spans meaningful depth. */
  coverageMode?: "frame-area" | "projected-corners";
};

/** Requires the camera and rear standard to remain in the neutral level state. */
export type CameraLevelCriterion = {
  id: string;
  type: "camera-level";
};

export type MirrorReflectionClearCriterion = {
  id: string;
  type: "mirror-reflection-clear";
  minimumClearanceMm: number;
};

export type MirrorFramingRestoredCriterion = {
  id: string;
  type: "mirror-framing-restored";
  maximumCenterErrorNormalized: number;
};

export type MirrorViewpointRetainedCriterion = {
  id: string;
  type: "mirror-viewpoint-retained";
  minimumParallaxDeltaNormalized: number;
};

export type TaskSuccessCriterion =
  | FocusTargetsSharpCriterion
  | MovementUsedCriterion
  | FocusUsedCriterion
  | MovementRangeCriterion
  | AllowedApertureCriterion
  | CompositionVisibleCriterion
  | CameraLevelCriterion
  | MirrorReflectionClearCriterion
  | MirrorFramingRestoredCriterion
  | MirrorViewpointRetainedCriterion;

export type TaskCriteriaEvaluation = {
  criterionId: string;
  label: GuidedTaskMessageRef;
  passed: boolean;
  score: number;
  message: GuidedTaskMessageRef;
};

export type TaskEvaluation = {
  taskId: string;
  status: "passed" | "failed";
  score: number;
  criteria: TaskCriteriaEvaluation[];
  primaryFeedback: GuidedTaskMessageRef;
  secondaryFeedback: GuidedTaskMessageRef[];
  finalCameraState?: Pick<
    CameraState,
    "frontRiseMm" | "frontTiltDeg" | "frontSwingDeg" | "focusDistanceMm" | "aperture"
  > &
    Partial<Pick<CameraState, "frontShiftMm" | "mirrorShiftLessonState">>;
};

export type TaskEvaluationContext = {
  task: TaskDefinition;
  scene: SceneDefinition;
};
