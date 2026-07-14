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
    const positions = target.sampleWorldPositions?.length
      ? target.sampleWorldPositions
      : [target.worldPosition];
    const evaluatedSamples = positions.map((worldPosition) => {
      const direction = safeNormalize(subtract(worldPosition, lensCenterWorld), {
        x: 0,
        y: 0,
        z: 1,
      });
      const ray = { origin: lensCenterWorld, direction } as Ray;
      const targetDistanceMm = Math.max(
        0,
        dot(subtract(worldPosition, lensCenterWorld), direction),
      );
      const wedge = sampleDofWedge({
        ray,
        targetDistanceMm,
        nearPlane,
        focusPlane,
        farPlane,
      });
      return {
        worldPosition,
        wedge,
        sharpness: clamp(1 - wedge.normalizedDefocus, 0, 1),
      };
    });
    const worst = evaluatedSamples.reduce((currentWorst, candidate) =>
      candidate.sharpness < currentWorst.sharpness ? candidate : currentWorst,
    );
    const sharpness = worst.sharpness;
    const status: FocusTargetSharpness["status"] =
      sharpness >= 0.8 ? "sharp" : sharpness >= 0.5 ? "acceptable" : "soft";

    return {
      id: target.id,
      distanceToFocusPlaneMm: focusPlane
        ? Math.max(...positions.map((position) => pointToPlaneDistance(position, focusPlane)))
        : 0,
      sharpness,
      status,
      insideDepthOfField: evaluatedSamples.every((sample) => sample.wedge.insideDepthOfField),
      targetRayDistanceMm: worst.wedge.targetDistanceMm,
      nearBoundaryDistanceMm: worst.wedge.nearDistanceMm,
      focusBoundaryDistanceMm: worst.wedge.focusDistanceMm,
      farBoundaryDistanceMm: worst.wedge.farDistanceMm,
      normalizedDefocus: worst.wedge.normalizedDefocus,
    };
  });
};
