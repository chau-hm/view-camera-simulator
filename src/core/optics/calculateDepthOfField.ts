import type { Plane } from "../../types/optics";
import { planeFromPointNormal } from "../math/plane";
import { add, scale } from "../math/vec";

const APERTURE_TOLERANCE_MM: Record<number, number> = {
  5.6: 800,
  11: 1600,
  22: 3200,
  32: 4800,
};

export const mapApertureToToleranceMm = (aperture: number): number => APERTURE_TOLERANCE_MM[aperture] ?? 16;

export const calculateDepthOfField = (
  focusPlane: Plane,
  aperture: number,
): { depthOfFieldNearPlane: Plane; depthOfFieldFarPlane: Plane } => {
  const dofOffset = mapApertureToToleranceMm(aperture);
  const nearPoint = add(focusPlane.point, scale(focusPlane.normal, -dofOffset));
  const farPoint = add(focusPlane.point, scale(focusPlane.normal, dofOffset));

  return {
    depthOfFieldNearPlane: planeFromPointNormal(nearPoint, focusPlane.normal),
    depthOfFieldFarPlane: planeFromPointNormal(farPoint, focusPlane.normal),
  };
};
