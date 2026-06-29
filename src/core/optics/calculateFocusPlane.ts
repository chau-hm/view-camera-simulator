import type { CameraState } from "../../types/camera";
import type { Plane, Ray, Vec3 } from "../../types/optics";
import { planeFromPointNormal } from "../math/plane";
import { pointOnRay } from "../math/ray";
import { normalize } from "../math/vec";

export const calculateFocusPlane = (
  cameraState: CameraState,
  opticalAxis: Ray,
): { focusPointWorld: Vec3; focusPlane: Plane } => {
  if (!Number.isFinite(cameraState.focusDistanceMm) || cameraState.focusDistanceMm <= 0) {
    throw new Error("Invalid focus distance");
  }

  const focusPointWorld = pointOnRay(opticalAxis, cameraState.focusDistanceMm);
  return {
    focusPointWorld,
    focusPlane: planeFromPointNormal(focusPointWorld, normalize(opticalAxis.direction)),
  };
};
