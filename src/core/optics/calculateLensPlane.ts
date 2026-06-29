import type { CameraState } from "../../types/camera";
import type { Line3, Plane, Ray, Vec3 } from "../../types/optics";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { arePlanesNearlyParallel, intersectPlanes, planeFromPointNormal } from "../math/plane";
import { rotateAroundX, rotateAroundY, safeNormalize, vec } from "../math/vec";

export const createFilmPlane = (focalLengthMm: number): { filmCenterWorld: Vec3; filmNormalWorld: Vec3; filmPlane: Plane } => {
  const filmCenterWorld = vec(0, 0, -focalLengthMm);
  const filmNormalWorld = vec(0, 0, 1);
  return {
    filmCenterWorld,
    filmNormalWorld,
    filmPlane: planeFromPointNormal(filmCenterWorld, filmNormalWorld),
  };
};

export const calculateBaseLensCenter = (): Vec3 => vec(0, 0, 0);

export const calculateLensCenter = (baseLensCenter: Vec3, riseMm: number): Vec3 =>
  vec(baseLensCenter.x, baseLensCenter.y + riseMm, baseLensCenter.z);

export const calculateTiltRotation = (tiltDeg: number): Vec3 => rotateAroundX(vec(0, 0, 1), tiltDeg);

export const calculateSwingRotation = (tiltRotatedNormal: Vec3, swingDeg: number): Vec3 =>
  rotateAroundY(tiltRotatedNormal, swingDeg);

export const calculateLensNormal = (tiltDeg: number, swingDeg: number): Vec3 => {
  const tiltRotated = calculateTiltRotation(tiltDeg);
  const swingRotated = calculateSwingRotation(tiltRotated, swingDeg);
  return safeNormalize(swingRotated, vec(0, 0, 1));
};

export const createOpticalAxis = (lensCenterWorld: Vec3, lensNormalWorld: Vec3): Ray => ({
  origin: lensCenterWorld,
  direction: safeNormalize(lensNormalWorld, vec(0, 0, 1)),
});

export const isLensFilmNearlyParallel = (lensPlane: Plane, filmPlane: Plane): boolean =>
  arePlanesNearlyParallel(lensPlane, filmPlane, CAMERA_CONSTANTS.tiltParallelThresholdDeg);

export const calculateLensFilmHingeLine = (lensPlane: Plane, filmPlane: Plane): Line3 | null => {
  const intersection = intersectPlanes(lensPlane, filmPlane);
  if (!intersection) {
    return null;
  }
  return {
    point: intersection.point,
    direction: intersection.direction,
  };
};

export const calculateLensPlane = (
  cameraState: CameraState,
): { lensCenterWorld: Vec3; lensNormalWorld: Vec3; lensPlane: Plane } => {
  const baseLensCenter = calculateBaseLensCenter();
  const lensCenterWorld = calculateLensCenter(baseLensCenter, cameraState.frontRiseMm);
  const lensNormalWorld = calculateLensNormal(cameraState.frontTiltDeg, cameraState.frontSwingDeg);
  return {
    lensCenterWorld,
    lensNormalWorld,
    lensPlane: planeFromPointNormal(lensCenterWorld, lensNormalWorld),
  };
};
