import type { CameraState } from "../../types/camera";
import type { Plane, Vec3 } from "../../types/optics";
import { planeFromPointNormal } from "../math/plane";
import { vec } from "../math/vec";

export const calculateLensPlane = (
  cameraState: CameraState,
): { lensCenterWorld: Vec3; lensNormalWorld: Vec3; lensPlane: Plane } => {
  const lensCenterWorld = vec(0, cameraState.frontRiseMm, 0);
  const lensNormalWorld = vec(
    Math.sin((cameraState.frontSwingDeg * Math.PI) / 180),
    Math.sin((cameraState.frontTiltDeg * Math.PI) / 180),
    1,
  );
  return {
    lensCenterWorld,
    lensNormalWorld,
    lensPlane: planeFromPointNormal(lensCenterWorld, lensNormalWorld),
  };
};
