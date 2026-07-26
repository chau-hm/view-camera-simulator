import type { CameraState } from "../types/camera";

/** Preset modes comparing conventional pitch vs corrected shift techniques. */
export type CameraConfigurationMode =
  | "whole-camera-pitch"
  | "direct-shift"
  | "indirect-shift";

/** Vertical aiming or shift sense for a configuration preset. */
export type VerticalDirection = "upward" | "downward";

/**
 * Demo pitch magnitude for Understanding Camera Movements presets.
 * Stays inside the public tilt control range ([-10°, 10°]) so compensated
 * front/rear tilts remain within the manual UI envelope.
 */
export const CAMERA_CONFIGURATION_PITCH_DEG = 8;

/**
 * Direct front rise/fall magnitude for the parallel comparison preset.
 * Stays inside the actable rise range magnitude (0–40 mm). Fall is stored as
 * signed frontRiseMm only through the atomic configuration action.
 */
export const CAMERA_CONFIGURATION_DIRECT_SHIFT_MM = 30;

export const DEFAULT_CAMERA_CONFIGURATION_MODE: CameraConfigurationMode =
  "direct-shift";

export const DEFAULT_CAMERA_CONFIGURATION_DIRECTION: VerticalDirection =
  "upward";

export type CameraConfigurationPresetFields = Pick<
  CameraState,
  | "cameraBodyPitchDeg"
  | "frontRiseMm"
  | "frontTiltDeg"
  | "frontSwingDeg"
  | "rearRiseMm"
  | "rearTiltDeg"
>;

/**
 * Resolve the atomic camera fields for a configuration preset.
 *
 * Sign contract (scene leverage: +Y up, +Z toward subject, +X pitch axis):
 * - upward whole/indirect body pitch is negative (looks toward +Y);
 * - compensating front/rear tilts are opposite the body pitch so both standards
 *   remain vertical in world space under the body transform;
 * - upward direct shift uses positive front rise; downward uses negative rise (fall).
 */
export const resolveCameraConfigurationPreset = (
  mode: CameraConfigurationMode,
  direction: VerticalDirection,
): CameraConfigurationPresetFields => {
  const bodyPitchSign = direction === "upward" ? -1 : 1;
  const riseSign = direction === "upward" ? 1 : -1;
  const bodyPitchDeg = bodyPitchSign * CAMERA_CONFIGURATION_PITCH_DEG;
  const compensatingTiltDeg = -bodyPitchDeg;

  switch (mode) {
    case "whole-camera-pitch":
      return {
        cameraBodyPitchDeg: bodyPitchDeg,
        frontRiseMm: 0,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        rearRiseMm: 0,
        rearTiltDeg: 0,
      };
    case "direct-shift":
      return {
        cameraBodyPitchDeg: 0,
        frontRiseMm: riseSign * CAMERA_CONFIGURATION_DIRECT_SHIFT_MM,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        rearRiseMm: 0,
        rearTiltDeg: 0,
      };
    case "indirect-shift":
      return {
        cameraBodyPitchDeg: bodyPitchDeg,
        frontRiseMm: 0,
        frontTiltDeg: compensatingTiltDeg,
        frontSwingDeg: 0,
        rearRiseMm: 0,
        rearTiltDeg: compensatingTiltDeg,
      };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
};

export const neutralCameraConfigurationFields = (): CameraConfigurationPresetFields => ({
  cameraBodyPitchDeg: 0,
  frontRiseMm: 0,
  frontTiltDeg: 0,
  frontSwingDeg: 0,
  rearRiseMm: 0,
  rearTiltDeg: 0,
});
