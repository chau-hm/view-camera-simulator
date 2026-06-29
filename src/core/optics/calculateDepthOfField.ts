import type { Plane } from "../../types/optics";

export const calculateDepthOfField = (
  focusPlane: Plane,
  aperture: number,
): { depthOfFieldNearPlane: Plane; depthOfFieldFarPlane: Plane } => {
  const dofOffset = Math.max(5, 30 / aperture);
  return {
    depthOfFieldNearPlane: {
      ...focusPlane,
      point: {
        x: focusPlane.point.x - focusPlane.normal.x * dofOffset,
        y: focusPlane.point.y - focusPlane.normal.y * dofOffset,
        z: focusPlane.point.z - focusPlane.normal.z * dofOffset,
      },
      distance: focusPlane.distance - dofOffset,
    },
    depthOfFieldFarPlane: {
      ...focusPlane,
      point: {
        x: focusPlane.point.x + focusPlane.normal.x * dofOffset,
        y: focusPlane.point.y + focusPlane.normal.y * dofOffset,
        z: focusPlane.point.z + focusPlane.normal.z * dofOffset,
      },
      distance: focusPlane.distance + dofOffset,
    },
  };
};
