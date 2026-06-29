import type { FocusTargetSharpness } from "../../types/optics";

export const evaluateFocusTargets = (
  targets: FocusTargetSharpness[],
  targetIds: string[],
  minimumSharpness: number,
): boolean =>
  targetIds.every((targetId) => {
    const target = targets.find((entry) => entry.id === targetId);
    return Boolean(target && target.sharpness >= minimumSharpness);
  });
