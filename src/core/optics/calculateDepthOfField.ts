import type { Plane } from "../../types/optics";

export const calculateDepthOfField = (
  focusPlane: Plane,
  aperture: number,
): { depthOfFieldNearPlane: Plane; depthOfFieldFarPlane: Plane } => {
  const dofOffset = Math.max(5, 30 / aperture);
  return {
    depthOfFieldNearPlane: { ...focusPlane, distance: focusPlane.distance - dofOffset },
    depthOfFieldFarPlane: { ...focusPlane, distance: focusPlane.distance + dofOffset },
  };
};
