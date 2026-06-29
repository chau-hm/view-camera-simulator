import type { FocusTargetSharpness } from "../../types/optics";

export const evaluateFocusTargets = (targets: FocusTargetSharpness[]): boolean =>
  targets.some((target) => target.status === "sharp");
