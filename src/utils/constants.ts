import type { ApertureValue, CameraState } from "../types/camera";

export const CAMERA_CONSTANTS = {
  filmWidthMm: 127,
  filmHeightMm: 101.6,
  frontStandardWidthMm: 180,
  frontStandardHeightMm: 140,
  focalLengthMm: 150,
  riseMinMm: 0,
  riseMaxMm: 40,
  tiltMinDeg: -10,
  tiltMaxDeg: 10,
  swingMinDeg: -10,
  swingMaxDeg: 10,
  apertureOptions: [5.6, 11, 22, 32] as const,
  tiltParallelThresholdDeg: 0.1,
  defaultFocusDistanceMm: 2000,
} as const;

export const CAMERA_CONTROL_STEPS = {
  riseMm: 1,
  tiltDeg: 0.1,
  swingDeg: 0.1,
  focusDistanceMm: 10,
} as const;

export const DEFAULT_CAMERA_STATE: CameraState = {
  focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
  aperture: 11,
  focusDistanceMm: CAMERA_CONSTANTS.defaultFocusDistanceMm,
  frontRiseMm: 0,
  frontTiltDeg: 0,
  frontSwingDeg: 0,
  activeSceneId: "architecture-rise",
  activeTaskId: "rise-01",
  mode: "guided",
  groundGlassAssistEnabled: false,
  focusAssistEnabled: false,
  gridEnabled: true,
  geometryView: "side",
  focusMode: "finite",
  lastFiniteFocusDepthMm: CAMERA_CONSTANTS.defaultFocusDistanceMm,
};

export const isApertureValue = (value: number): value is ApertureValue =>
  CAMERA_CONSTANTS.apertureOptions.includes(
    value as (typeof CAMERA_CONSTANTS.apertureOptions)[number],
  );
