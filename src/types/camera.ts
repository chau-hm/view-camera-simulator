import type { Vec3 } from "./optics";

export type SimulatorMode = "guided" | "free";

export type ApertureValue = 5.6 | 11 | 22 | 32;

export type GeometryView = "side" | "top" | "scheimpflug";

export type CameraState = {
  focalLengthMm: number;
  aperture: ApertureValue;
  focusDistanceMm: number;
  frontRiseMm: number;
  frontTiltDeg: number;
  frontSwingDeg: number;
  rearRiseMm: number;
  rearTiltDeg: number;
  /** Rigid camera-body pitch about world +X, in degrees. */
  cameraBodyPitchDeg: number;
  /** Fixed tripod/rail pivot for camera-body pitch, in world millimetres. */
  cameraBodyPivotWorld: Vec3;
  activeSceneId: string;
  activeTaskId: string | null;
  mode: SimulatorMode;
  groundGlassAssistEnabled: boolean;
  focusAssistEnabled: boolean;
  gridEnabled: boolean;
  geometryView: GeometryView;
  // Optional focus mode: 'finite' (default) or 'infinity'
  focusMode?: "finite" | "infinity";
  // Store last finite focus value so infinity mode can remember and restore
  lastFiniteFocusDepthMm?: number;
};
