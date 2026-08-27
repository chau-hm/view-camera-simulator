import { clamp } from "../math/clamps";
import type { FocusTargetStatus } from "../../types/optics";

/** Physical CoC diameter at the useful end of the learner sharpness scale. */
export const ACCEPTABLE_COC_DIAMETER_MM = 0.1;

export const focusTargetStatusForSharpness = (
  sharpness: number,
): FocusTargetStatus =>
  sharpness >= 0.8 ? "sharp" : sharpness >= 0.5 ? "acceptable" : "soft";

/**
 * Convert the physical equivalent CoC diameter into the existing bounded
 * learner-facing sharpness scale. Invalid physical geometry fails closed.
 */
export const calculatePhysicalSharpnessFromEquivalentCoCDiameterMm = (
  equivalentCoCDiameterMm: number | null | undefined,
): number => {
  if (
    equivalentCoCDiameterMm === null ||
    equivalentCoCDiameterMm === undefined ||
    !Number.isFinite(equivalentCoCDiameterMm) ||
    equivalentCoCDiameterMm < 0
  ) {
    return 0;
  }
  return clamp(
    1 - equivalentCoCDiameterMm / ACCEPTABLE_COC_DIAMETER_MM,
    0,
    1,
  );
};
