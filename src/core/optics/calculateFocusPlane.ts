import type { CameraState } from "../../types/camera";
import type { Line3, Plane, Ray, Vec3 } from "../../types/optics";
import { planeFromPointNormal } from "../math/plane";
import { pointOnRay } from "../math/ray";
import { cross, safeNormalize, subtract, vec } from "../math/vec";

export const calculateFocusPoint = (cameraState: CameraState, opticalAxis: Ray): Vec3 => {
  if (!Number.isFinite(cameraState.focusDistanceMm) || cameraState.focusDistanceMm <= 0) {
    throw new Error("Invalid focus distance");
  }
  return pointOnRay(opticalAxis, cameraState.focusDistanceMm);
};

export const createParallelFocusPlane = (focusPointWorld: Vec3, filmPlane: Plane): Plane =>
  planeFromPointNormal(focusPointWorld, filmPlane.normal);

export const createScheimpflugFocusPlane = (focusPointWorld: Vec3, hingeLine: Line3, fallbackNormal: Vec3): Plane => {
  const focusPlaneNormal = safeNormalize(
    cross(hingeLine.direction, subtract(focusPointWorld, hingeLine.point)),
    safeNormalize(fallbackNormal, vec(0, 0, 1)),
  );
  return planeFromPointNormal(focusPointWorld, focusPlaneNormal);
};

export const calculateFocusPlaneWithFallback = (
  focusPointWorld: Vec3,
  filmPlane: Plane,
  hingeLine: Line3 | null,
  useParallelModel: boolean,
): { focusPlane: Plane; focusPlaneModel: "parallel" | "scheimpflug" } => {
  if (useParallelModel || !hingeLine) {
    return {
      focusPlane: createParallelFocusPlane(focusPointWorld, filmPlane),
      focusPlaneModel: "parallel",
    };
  }

  return {
    focusPlane: createScheimpflugFocusPlane(focusPointWorld, hingeLine, filmPlane.normal),
    focusPlaneModel: "scheimpflug",
  };
};

export const calculateFocusPlane = (
  focusPointWorld: Vec3,
  filmPlane: Plane,
  hingeLine: Line3 | null,
  useParallelModel: boolean,
): Plane => calculateFocusPlaneWithFallback(focusPointWorld, filmPlane, hingeLine, useParallelModel).focusPlane;
