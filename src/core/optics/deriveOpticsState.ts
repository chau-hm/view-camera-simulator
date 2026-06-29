import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { calculateDepthOfField } from "./calculateDepthOfField";
import { calculateFocusPlaneWithFallback, calculateFocusPoint } from "./calculateFocusPlane";
import { calculateGroundGlassProjection } from "./calculateGroundGlassProjection";
import {
  calculateLensFilmHingeLine,
  calculateLensPlane,
  createFilmPlane,
  createOpticalAxis,
  isLensFilmNearlyParallel,
} from "./calculateLensPlane";
import {
  calculateFilmPlaneCorners,
  calculateOffAxisProjectionMatrix,
  createOffAxisProjectionInput,
} from "./calculateOffAxisProjection";
import { calculateSharpness } from "./calculateSharpness";
import { isFiniteVec3, vec } from "../math/vec";

const isFiniteCameraInput = (cameraState: CameraState): boolean =>
  [
    cameraState.focalLengthMm,
    cameraState.focusDistanceMm,
    cameraState.frontRiseMm,
    cameraState.frontTiltDeg,
    cameraState.frontSwingDeg,
  ].every((value) => Number.isFinite(value));

const baseFallbackState = (cameraState: CameraState, errorMessage: string): DerivedOpticsState => {
  const lensCenterWorld = vec(0, cameraState.frontRiseMm, 0);
  const lensNormalWorld = vec(0, 0, 1);
  const { filmCenterWorld, filmNormalWorld, filmPlane } = createFilmPlane(cameraState.focalLengthMm);
  const filmPlaneCornersWorld = calculateFilmPlaneCorners(filmPlane);
  const opticalAxis = createOpticalAxis(lensCenterWorld, lensNormalWorld);
  const focusPointWorld = vec(0, 0, cameraState.focusDistanceMm);
  const focusPlane = {
    point: focusPointWorld,
    normal: filmNormalWorld,
    distance: focusPointWorld.z,
  };
  const offAxisProjectionInput = createOffAxisProjectionInput(lensCenterWorld, filmPlaneCornersWorld);

  return {
    lensCenterWorld,
    lensNormalWorld,
    lensPlane: { point: lensCenterWorld, normal: lensNormalWorld, distance: lensCenterWorld.z },
    filmCenterWorld,
    filmNormalWorld,
    filmPlane,
    filmPlaneCornersWorld,
    opticalAxis,
    lensFilmHingeLine: null,
    focusPointWorld,
    focusPlane,
    depthOfFieldNearPlane: {
      point: { x: 0, y: 0, z: cameraState.focusDistanceMm - 16 },
      normal: filmNormalWorld,
      distance: cameraState.focusDistanceMm - 16,
    },
    depthOfFieldFarPlane: {
      point: { x: 0, y: 0, z: cameraState.focusDistanceMm + 16 },
      normal: filmNormalWorld,
      distance: cameraState.focusDistanceMm + 16,
    },
    offAxisProjectionInput,
    offAxisProjectionMatrix: calculateOffAxisProjectionMatrix(offAxisProjectionInput),
    groundGlassProjection: calculateGroundGlassProjection(cameraState.groundGlassAssistEnabled),
    focusTargets: [],
    diagnostics: {
      isParallelLensFilm: true,
      tiltAngleDeg: cameraState.frontTiltDeg,
      swingAngleDeg: cameraState.frontSwingDeg,
      focusPlaneModel: "parallel",
      fallbackApplied: true,
      errorMessage,
    },
  };
};

export const deriveOpticsState = (
  cameraState: CameraState,
  scene: SceneDefinition,
): DerivedOpticsState => {
  if (!isFiniteCameraInput(cameraState)) {
    return baseFallbackState(cameraState, "Invalid camera input");
  }
  if (cameraState.focusDistanceMm <= 0) {
    return baseFallbackState(cameraState, "Invalid focus distance");
  }
  if (cameraState.focalLengthMm <= 0) {
    return baseFallbackState(cameraState, "Invalid focal length");
  }

  const { lensCenterWorld, lensNormalWorld, lensPlane } = calculateLensPlane(cameraState);
  if (!isFiniteVec3(lensCenterWorld) || !isFiniteVec3(lensNormalWorld)) {
    return baseFallbackState(cameraState, "Invalid lens geometry");
  }

  const { filmCenterWorld, filmNormalWorld, filmPlane } = createFilmPlane(cameraState.focalLengthMm);
  const filmPlaneCornersWorld = calculateFilmPlaneCorners(filmPlane);
  const opticalAxis = createOpticalAxis(lensCenterWorld, lensNormalWorld);
  const focusPointWorld = calculateFocusPoint(cameraState, opticalAxis);
  const isParallelLensFilm = isLensFilmNearlyParallel(lensPlane, filmPlane);
  const lensFilmHingeLine = isParallelLensFilm ? null : calculateLensFilmHingeLine(lensPlane, filmPlane);
  const { focusPlane, focusPlaneModel } = calculateFocusPlaneWithFallback(
    focusPointWorld,
    filmPlane,
    lensFilmHingeLine,
    isParallelLensFilm || !lensFilmHingeLine,
  );
  const { depthOfFieldNearPlane, depthOfFieldFarPlane } = calculateDepthOfField(
    focusPlane,
    cameraState.aperture,
  );
  const offAxisProjectionInput = createOffAxisProjectionInput(lensCenterWorld, filmPlaneCornersWorld);
  const offAxisProjectionMatrix = calculateOffAxisProjectionMatrix(offAxisProjectionInput);

  return {
    lensCenterWorld,
    lensNormalWorld,
    lensPlane,
    filmCenterWorld,
    filmNormalWorld,
    filmPlane,
    filmPlaneCornersWorld,
    opticalAxis,
    lensFilmHingeLine,
    focusPointWorld,
    focusPlane,
    depthOfFieldNearPlane,
    depthOfFieldFarPlane,
    offAxisProjectionInput,
    offAxisProjectionMatrix,
    groundGlassProjection: calculateGroundGlassProjection(cameraState.groundGlassAssistEnabled),
    focusTargets: calculateSharpness(scene, focusPlane, cameraState.aperture),
    diagnostics: {
      isParallelLensFilm,
      tiltAngleDeg: cameraState.frontTiltDeg,
      swingAngleDeg: cameraState.frontSwingDeg,
      focusPlaneModel,
      fallbackApplied: false,
    },
  };
};
