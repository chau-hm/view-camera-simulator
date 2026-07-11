import type { FocusTargetSharpness } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { pointToPlaneDistance } from "../math/plane";
import type { Plane } from "../../types/optics";
import { clamp } from "../math/clamps";

import { intersectRayPlane } from "../math/ray";
import type { Ray, Vec3 } from "../../types/optics";
import { safeNormalize, subtract, dot } from "../math/vec";
import { calculateDofWedgeDefocus } from "./dofWedge";
export const calculateSharpness = (
  scene: SceneDefinition,
  focusPlane: Plane | null,
  _aperture: number,  lensCenterWorld: Vec3,
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

    // Intersect with focus/near/far planes to get distances
    const focusHit = focusPlane ? intersectRayPlane(ray, focusPlane) : null;
    const nearHit = nearPlane ? intersectRayPlane(ray, nearPlane) : null;
    const farHit = farPlane ? intersectRayPlane(ray, farPlane) : null;

    const toTarget = subtract(target.worldPosition, lensCenterWorld);
    const targetDist = Math.max(0, dot(toTarget, dir));

    const focusDist = focusHit ? focusHit.distance : targetDist;
    const nearDist = nearHit ? nearHit.distance : null;
    const farDist = farHit ? farHit.distance : null;

    // Compute normalized defocus using DOF wedge intervals
    const { insideDepthOfField, normalizedDefocus } = calculateDofWedgeDefocus(
      targetDist,
      nearDist,
      focusDist,
      farDist,
    );

    const sharpness = clamp(1 - normalizedDefocus, 0, 1);
    const status: FocusTargetSharpness["status"] =
      sharpness >= 0.8 ? "sharp" : sharpness >= 0.5 ? "acceptable" : "soft";

    return {
      id: target.id,
      distanceToFocusPlaneMm: focusPlane
        ? pointToPlaneDistance(target.worldPosition, focusPlane)
        : 0,
      sharpness,
      status,
      insideDepthOfField,
      targetRayDistanceMm: targetDist,
      nearBoundaryDistanceMm: nearDist,
      focusBoundaryDistanceMm: focusDist,
      farBoundaryDistanceMm: farDist,
      normalizedDefocus,
    };
  });
};
