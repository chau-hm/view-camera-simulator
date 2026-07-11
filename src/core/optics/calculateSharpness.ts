import type { FocusTargetSharpness } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { pointToPlaneDistance } from "../math/plane";
import type { Plane } from "../../types/optics";
import { clamp } from "../math/clamps";
import { mapApertureToToleranceMm } from "./calculateDepthOfField";

import { intersectRayPlane } from "../math/ray";
import type { Ray, Vec3 } from "../../types/optics";
import { safeNormalize, subtract, dot } from "../math/vec";

export const calculateSharpness = (
  scene: SceneDefinition,
  focusPlane: Plane | null,
  aperture: number,
  lensCenterWorld: Vec3,
  nearPlane: Plane | null,
  farPlane: Plane | null,
): FocusTargetSharpness[] => {
  const acceptableRangeMm = mapApertureToToleranceMm(aperture);

  return scene.focusTargets.map((target) => {
    // Build ray from lens centre through target
    const dir = safeNormalize(subtract(target.worldPosition, lensCenterWorld), {
      x: 0,
      y: 0,
      z: 1,
    });
    const ray = { origin: lensCenterWorld, direction: dir } as Ray;

    // Intersect with focus/near/far planes
    const focusHit = focusPlane ? intersectRayPlane(ray, focusPlane) : null;
    const nearHit = nearPlane ? intersectRayPlane(ray, nearPlane) : null;
    const farHit = farPlane ? intersectRayPlane(ray, farPlane) : null;

    // Determine distances along ray (distance from lens)
    const targetVec = target.worldPosition;
    // approximate target distance along ray
    const toTarget = subtract(targetVec, lensCenterWorld);
    const targetDist = Math.max(0, dot(toTarget, dir));

    const focusDist = focusHit ? focusHit.distance : targetDist;
    const nearDist = nearHit ? nearHit.distance : Math.max(0, targetDist - acceptableRangeMm);
    const farDist = farHit
      ? farHit.distance
      : Math.min(Number.POSITIVE_INFINITY, targetDist + acceptableRangeMm);

    let normalizedDefocus = 0;
    if (targetDist < nearDist) {
      normalizedDefocus = (nearDist - targetDist) / acceptableRangeMm;
    } else if (targetDist > farDist) {
      normalizedDefocus = (targetDist - farDist) / acceptableRangeMm;
    } else {
      normalizedDefocus = Math.abs(targetDist - focusDist) / acceptableRangeMm;
    }

    const sharpness = clamp(1 - normalizedDefocus, 0, 1);
    const status: FocusTargetSharpness["status"] =
      sharpness >= 0.8 ? "sharp" : sharpness >= 0.5 ? "acceptable" : "soft";

    return {
      id: target.id,
      distanceToFocusPlaneMm: focusPlane
        ? pointToPlaneDistance(target.worldPosition, focusPlane)
        : 0,
      acceptableRangeMm,
      sharpness,
      status,
    };
  });
};
