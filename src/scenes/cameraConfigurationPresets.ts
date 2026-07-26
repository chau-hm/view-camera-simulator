import type { CameraState } from "../types/camera";
import { CAMERA_CONSTANTS } from "../utils/constants";

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
 *
 * Calibrated with {@link CAMERA_CONFIGURATION_DIRECT_SHIFT_MM} so the shared
 * composition target (upper cube centre for upward, lower for downward) lands
 * at nearly the same Ground Glass location across the three configurations.
 */
export const CAMERA_CONFIGURATION_PITCH_DEG = 8;

/**
 * Direct front rise/fall magnitude matched to {@link CAMERA_CONFIGURATION_PITCH_DEG}.
 * Film-plane UV residual versus whole-camera pitch on the shared composition
 * target is well below {@link CAMERA_CONFIGURATION_COMPOSITION_TOLERANCE_UV}.
 * Fall is represented as negative frontRiseMm.
 */
export const CAMERA_CONFIGURATION_DIRECT_SHIFT_MM = 15;

/**
 * Maximum allowed |ΔvRaw| on the shared composition target between the three
 * configurations in one direction. Documented film height is 101.6 mm, so
 * 0.015 ≈ 1.5 mm on the ground glass (~1.5% of film height).
 */
export const CAMERA_CONFIGURATION_COMPOSITION_TOLERANCE_UV = 0.015;

/** Scene-local signed vertical movement range for Understanding Camera Movements. */
export const UNDERSTANDING_CAMERA_MOVEMENTS_RISE_MIN_MM = -40;
export const UNDERSTANDING_CAMERA_MOVEMENTS_RISE_MAX_MM = 40;

export const DEFAULT_CAMERA_CONFIGURATION_MODE: CameraConfigurationMode | null = null;

export const DEFAULT_CAMERA_CONFIGURATION_DIRECTION: VerticalDirection = "upward";

export const CAMERA_CONFIGURATION_SCENE_ID = "understanding-camera-movements" as const;

export type CameraConfigurationPresetFields = Pick<
  CameraState,
  | "cameraBodyPitchDeg"
  | "frontRiseMm"
  | "frontTiltDeg"
  | "frontSwingDeg"
  | "rearRiseMm"
  | "rearTiltDeg"
>;

export type RiseRangeMm = {
  minMm: number;
  maxMm: number;
};

/** Resolve public rise/fall clamp bounds for a scene. Other scenes stay 0…40. */
export const resolveSceneRiseRangeMm = (sceneId: string): RiseRangeMm => {
  if (sceneId === CAMERA_CONFIGURATION_SCENE_ID) {
    return {
      minMm: UNDERSTANDING_CAMERA_MOVEMENTS_RISE_MIN_MM,
      maxMm: UNDERSTANDING_CAMERA_MOVEMENTS_RISE_MAX_MM,
    };
  }
  return {
    minMm: CAMERA_CONSTANTS.riseMinMm,
    maxMm: CAMERA_CONSTANTS.riseMaxMm,
  };
};

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
        // Rail pitch alone already places the shared composition near the
        // whole-camera target; no additional front rise/fall is required.
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
