import { CAMERA_CONTROL_STEPS } from "../../utils/constants";

/**
 * Return the first control-step value strictly greater than the focal length.
 * Real-image finite focus uses U > f; the public control therefore needs a
 * step-aligned boundary rather than an epsilon-sized mathematical offset.
 */
export const minimumRealImageFiniteFocusDistanceMm = (
  focalLengthMm: number,
  stepMm: number = CAMERA_CONTROL_STEPS.focusDistanceMm,
): number | null => {
  if (
    !Number.isFinite(focalLengthMm) ||
    focalLengthMm <= 0 ||
    !Number.isFinite(stepMm) ||
    stepMm <= 0
  ) {
    return null;
  }

  return (Math.floor(focalLengthMm / stepMm) + 1) * stepMm;
};
