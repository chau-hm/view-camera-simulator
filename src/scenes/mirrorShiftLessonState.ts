import type { MirrorShiftLessonState } from "../types/camera";
import type { CameraRigPlacement } from "../types/optics";
import {
  CAMERA_CONSTANTS,
  CAMERA_CONTROL_STEPS,
  clampStandardShiftMm,
} from "../utils/constants";

export const MIRROR_SHIFT_RIG_LATERAL_RANGE_MM = {
  min: -2200,
  max: 2200,
  step: 50,
  default: 0,
} as const;

export const DEFAULT_MIRROR_SHIFT_LESSON_STATE: MirrorShiftLessonState = {
  rigLateralMm: MIRROR_SHIFT_RIG_LATERAL_RANGE_MM.default,
};

export const MIRROR_SHIFT_FRONT_SHIFT_RANGE_MM = {
  min: CAMERA_CONSTANTS.shiftMinMm,
  max: CAMERA_CONSTANTS.shiftMaxMm,
  step: CAMERA_CONTROL_STEPS.shiftMm,
  default: 0,
} as const;

export const clampMirrorShiftFrontShiftMm = (value: number): number =>
  clampStandardShiftMm(value);

export const clampMirrorShiftRigLateralMm = (value: number): number =>
  Math.min(
    MIRROR_SHIFT_RIG_LATERAL_RANGE_MM.max,
    Math.max(MIRROR_SHIFT_RIG_LATERAL_RANGE_MM.min, value),
  );

/** Resolve the identity-placement payload for Mirror Shift's rigid x translation. */
export const resolveMirrorShiftRigPlacement = (
  rigLateralMm: number,
): CameraRigPlacement => ({
  kind: "identity",
  rigOriginWorld: { x: rigLateralMm, y: 0, z: 0 },
  basePitchDeg: 0,
});
