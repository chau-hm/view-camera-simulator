import type { FocusTargetSharpness } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { pointToPlaneDistance } from "../math/plane";
import type { Plane } from "../../types/optics";
import { clamp } from "../math/clamps";

import type { Ray, Vec3 } from "../../types/optics";
import { safeNormalize, subtract, dot } from "../math/vec";
import { sampleDofWedge } from "./dofWedge";
export const calculateSharpness = (
  scene: SceneDefinition,
  focusPlane: Plane | null,
  _aperture: number,
  lensCenterWorld: Vec3,
  nearPlane: Plane | null,
  farPlane: Plane | null,
): FocusTargetSharpness[] => {
  return scene.focusTargets.map((target) => {
    // Build ray from lens centre through target
    const dir = safeNormalize(subtract(target.worldPosition, lensCenterWorld), {
      x: 0,
      y: 0,
      z: 1,
    });
    const ray = { origin: lensCenterWorld, direction: dir } as Ray;

    const toTarget = subtract(target.worldPosition, lensCenterWorld);
    const targetDist = Math.max(0, dot(toTarget, dir));

    // Sample wedge
    const sample = sampleDofWedge({
      ray,
      targetDistanceMm: targetDist,
      nearPlane,
      focusPlane,
      farPlane,
    });

    const sharpness = clamp(1 - sample.normalizedDefocus, 0, 1);
    const status: FocusTargetSharpness["status"] =
      sharpness >= 0.8 ? "sharp" : sharpness >= 0.5 ? "acceptable" : "soft";

    return {
      id: target.id,
      distanceToFocusPlaneMm: focusPlane
        ? pointToPlaneDistance(target.worldPosition, focusPlane)
        : 0,
      sharpness,
      status,
      insideDepthOfField: sample.insideDepthOfField,
      targetRayDistanceMm: sample.targetDistanceMm,
      nearBoundaryDistanceMm: sample.nearDistanceMm,
      focusBoundaryDistanceMm: sample.focusDistanceMm,
      farBoundaryDistanceMm: sample.farDistanceMm,
      normalizedDefocus: sample.normalizedDefocus,
    };
  });
};
