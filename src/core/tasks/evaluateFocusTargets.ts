import type { FocusTargetSharpness } from "../../types/optics";

/**
 * Resolve the physical patch metric used by production guided focus criteria.
 *
 * The CoC value is required as well as the normalized score so that a target
 * with invalid physical geometry (which reports score 0 and a null CoC) cannot
 * accidentally pass a zero-threshold criterion.
 */
export const resolvePhysicalTaskPatchSharpness = (
  target: FocusTargetSharpness | undefined,
): number | null => {
  const sharpness = target?.physicalPatchSharpness;
  const equivalentCoCDiameterMm = target?.patchEquivalentCoCDiameterMm;
  return target &&
    typeof sharpness === "number" &&
    Number.isFinite(sharpness) &&
    sharpness >= 0 &&
    sharpness <= 1 &&
    typeof equivalentCoCDiameterMm === "number" &&
    Number.isFinite(equivalentCoCDiameterMm) &&
    equivalentCoCDiameterMm >= 0
    ? sharpness
    : null;
};

/**
 * Production guided-task focus criteria deliberately do not fall back to the
 * legacy wedge sharpness fields. Presentation compatibility belongs at the
 * presentation boundary, not in task success evaluation.
 */
export const evaluateFocusTargets = (
  targets: FocusTargetSharpness[],
  targetIds: string[],
  minimumSharpness: number,
): boolean =>
  targetIds.every((targetId) => {
    const target = targets.find((entry) => entry.id === targetId);
    const sharpness = resolvePhysicalTaskPatchSharpness(target);
    return sharpness !== null && sharpness >= minimumSharpness;
  });
