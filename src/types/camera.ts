import type { CameraRigPlacement, CameraRigViewpointAnchor, Vec3 } from "./optics";

export type SimulatorMode = "guided" | "free";

export type MovementStudy = "viewpoint" | "tilt" | "vertical-framing";

export type ActiveStandard = "front" | "rear";

/** Focus-standard selection for scenes that support selectable focusing geometry. */
export type FocusStandard = "front" | "rear";

/** Continuous canonical lesson state for Understanding Camera Movements. */
export type CameraMovementLessonState = Readonly<{
  study: MovementStudy;
  /** -1 lower viewpoint, 0 neutral, +1 higher viewpoint. */
  viewpointT: number;
  activeStandard: ActiveStandard;
  /** Signed front/rear tilt value in degrees. */
  tiltDeg: number;
  /** -1 lower framing, 0 middle, +1 upper framing. */
  framingT: number;
}>;

/** Continuous canonical lesson state for the Mirror Shift rig-position control. */
export type MirrorShiftLessonState = Readonly<{
  rigLateralMm: number;
}>;

export type ApertureValue = 5.6 | 11 | 22 | 32;

export type GeometryView = "side" | "top" | "scheimpflug";

export type CameraState = {
  focalLengthMm: number;
  aperture: ApertureValue;
  focusDistanceMm: number;
  focusStandard: FocusStandard;
  frontRiseMm: number;
  /** Physical horizontal translation of the front standard in rig-local X. */
  frontShiftMm: number;
  frontTiltDeg: number;
  frontSwingDeg: number;
  rearRiseMm: number;
  /** Physical horizontal translation of the rear standard in rig-local X. */
  rearShiftMm: number;
  rearTiltDeg: number;
  /** Vertical-axis rotation of the rear standard / film plane, in degrees. */
  rearSwingDeg: number;
  /** Rigid camera-body pitch about rig-local +X, in degrees. */
  cameraBodyPitchDeg: number;
  /** @deprecated Compatibility name; this pivot value is rig-local millimetres. */
  cameraBodyPivotWorld: Vec3;
  /** Runtime viewpoint identity for the camera-movements rig. */
  viewpointAnchor: CameraRigViewpointAnchor;
  /** Canonical resolved physical viewpoint placement consumed by optics adapters. */
  cameraRigPlacement: CameraRigPlacement;
  /** Scene-specific continuous lesson source for public camera-movement adapters. */
  cameraMovementLessonState?: CameraMovementLessonState;
  /** Scene-specific continuous lesson source for Mirror Shift rig translation. */
  mirrorShiftLessonState?: MirrorShiftLessonState;
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
