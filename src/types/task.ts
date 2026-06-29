import type { CameraState } from "./camera";

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
  movementConstraint?: "rise-only" | "tilt-only" | "swing-only";
  initialCameraState?: TaskInitialCameraState;
};

export type TaskEvaluation = {
  taskId: string;
  passed: boolean;
  score: number;
  feedback: string[];
};
