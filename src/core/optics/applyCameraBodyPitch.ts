import type {
  CameraBodyLocalGeometry,
  CameraBodyTransform,
  FilmPlaneCorners,
  StandardFrame,
  Vec3,
} from "../../types/optics";
import { planeFromPointNormal } from "../math/plane";
import { rotateAroundX, rotatePointAroundX, safeNormalize } from "../math/vec";

export type CameraBodyWorldGeometry = {
  lensCenterWorld: Vec3;
  lensNormalWorld: Vec3;
  lensPlane: ReturnType<typeof planeFromPointNormal>;
  filmCenterWorld: Vec3;
  filmNormalWorld: Vec3;
  filmPlane: ReturnType<typeof planeFromPointNormal>;
  filmPlaneCornersWorld: FilmPlaneCorners;
  rearStandardFrame: StandardFrame;
};

const rotateDirection = (direction: Vec3, pitchDeg: number): Vec3 =>
  safeNormalize(rotateAroundX(direction, pitchDeg), direction);

/**
 * Apply camera-body pitch after all local standard movements.
 *
 * A zero pitch returns the original local values exactly. Non-zero pitch is
 * one rigid transform: points rotate around the fixed tripod/rail pivot while
 * direction vectors rotate around +X without translation.
 */
export const applyCameraBodyPitch = (
  local: CameraBodyLocalGeometry,
  transform: CameraBodyTransform,
): CameraBodyWorldGeometry => {
  if (transform.pitchDeg === 0) {
    return {
      lensCenterWorld: local.lensCenterLocal,
      lensNormalWorld: local.lensNormalLocal,
      lensPlane: local.lensPlaneLocal,
      filmCenterWorld: local.filmCenterLocal,
      filmNormalWorld: local.filmNormalLocal,
      filmPlane: local.filmPlaneLocal,
      filmPlaneCornersWorld: local.filmPlaneCornersLocal,
      rearStandardFrame: local.rearStandardFrameLocal,
    };
  }

  const rotatePoint = (point: Vec3): Vec3 =>
    rotatePointAroundX(point, transform.pivotWorld, transform.pitchDeg);
  const lensCenterWorld = rotatePoint(local.lensCenterLocal);
  const lensNormalWorld = rotateDirection(local.lensNormalLocal, transform.pitchDeg);
  const filmCenterWorld = rotatePoint(local.filmCenterLocal);
  const filmNormalWorld = rotateDirection(local.filmNormalLocal, transform.pitchDeg);
  const rightWorld = rotateDirection(local.rearStandardFrameLocal.rightWorld, transform.pitchDeg);
  const upWorld = rotateDirection(local.rearStandardFrameLocal.upWorld, transform.pitchDeg);
  const filmPlaneCornersWorld: FilmPlaneCorners = {
    topLeft: rotatePoint(local.filmPlaneCornersLocal.topLeft),
    topRight: rotatePoint(local.filmPlaneCornersLocal.topRight),
    bottomLeft: rotatePoint(local.filmPlaneCornersLocal.bottomLeft),
    bottomRight: rotatePoint(local.filmPlaneCornersLocal.bottomRight),
  };
  const filmPlane = planeFromPointNormal(filmCenterWorld, filmNormalWorld);

  return {
    lensCenterWorld,
    lensNormalWorld,
    lensPlane: planeFromPointNormal(lensCenterWorld, lensNormalWorld),
    filmCenterWorld,
    filmNormalWorld,
    filmPlane,
    filmPlaneCornersWorld,
    rearStandardFrame: {
      centerWorld: filmCenterWorld,
      rightWorld,
      upWorld,
      normalWorld: filmNormalWorld,
      plane: filmPlane,
    },
  };
};
