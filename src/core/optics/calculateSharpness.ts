import type { FocusTargetSharpness } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { pointToPlaneDistance } from "../math/plane";
import type { Plane } from "../../types/optics";
import { clamp } from "../math/clamps";
import { mapApertureToToleranceMm } from "./calculateDepthOfField";

export const calculateSharpness = (
  scene: SceneDefinition,
  focusPlane: Plane,
  aperture: number,
): FocusTargetSharpness[] => {
  const acceptableRangeMm = mapApertureToToleranceMm(aperture);

  return scene.focusTargets.map((target) => {
    const distanceToFocusPlaneMm = pointToPlaneDistance(target.worldPosition, focusPlane);
    const sharpness = clamp(1 - distanceToFocusPlaneMm / acceptableRangeMm, 0, 1);
    const status: FocusTargetSharpness["status"] =
      sharpness >= 0.8 ? "sharp" : sharpness >= 0.5 ? "acceptable" : "soft";

    return {
      id: target.id,
      distanceToFocusPlaneMm,
      acceptableRangeMm,
      sharpness,
      status,
    };
  });
};
