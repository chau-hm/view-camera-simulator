import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { calculateDepthOfField } from "./calculateDepthOfField";
import { calculateFocusPlane } from "./calculateFocusPlane";
import { calculateGroundGlassProjection } from "./calculateGroundGlassProjection";
import { calculateLensPlane } from "./calculateLensPlane";
import { calculateSharpness } from "./calculateSharpness";

const baseFallbackState = (cameraState: CameraState): DerivedOpticsState => {
  const lensCenterWorld = { x: 0, y: cameraState.frontRiseMm, z: 0 };
  const lensNormalWorld = { x: 0, y: 0, z: 1 };
  const filmCenterWorld = { x: 0, y: 0, z: -cameraState.focalLengthMm };
  const filmNormalWorld = { x: 0, y: 0, z: 1 };
  const opticalAxis = {
    origin: lensCenterWorld,
    direction: { x: 0, y: 0, z: 1 },
  };

  return {
    lensCenterWorld,
    lensNormalWorld,
    lensPlane: { point: lensCenterWorld, normal: lensNormalWorld, distance: 0 },
    filmCenterWorld,
    filmNormalWorld,
    filmPlane: { point: filmCenterWorld, normal: filmNormalWorld, distance: -cameraState.focalLengthMm },
    opticalAxis,
    focusPointWorld: { x: 0, y: 0, z: cameraState.focusDistanceMm },
    focusPlane: {
      point: { x: 0, y: 0, z: cameraState.focusDistanceMm },
      normal: { x: 0, y: 0, z: 1 },
      distance: cameraState.focusDistanceMm,
    },
    depthOfFieldNearPlane: {
      point: { x: 0, y: 0, z: cameraState.focusDistanceMm - 10 },
      normal: { x: 0, y: 0, z: 1 },
      distance: cameraState.focusDistanceMm - 10,
    },
    depthOfFieldFarPlane: {
      point: { x: 0, y: 0, z: cameraState.focusDistanceMm + 10 },
      normal: { x: 0, y: 0, z: 1 },
      distance: cameraState.focusDistanceMm + 10,
    },
    groundGlassProjection: calculateGroundGlassProjection(cameraState.groundGlassAssistEnabled),
    focusTargets: [],
    diagnostics: {
      isParallelLensFilm: true,
      tiltAngleDeg: cameraState.frontTiltDeg,
      swingAngleDeg: cameraState.frontSwingDeg,
      fallbackApplied: true,
      errorMessage: "Fallback optics state in use",
    },
  };
};

export const deriveOpticsState = (
  cameraState: CameraState,
  scene: SceneDefinition,
): DerivedOpticsState => {
  try {
    const { lensCenterWorld, lensNormalWorld, lensPlane } = calculateLensPlane(cameraState);
    const filmCenterWorld = { x: 0, y: 0, z: -cameraState.focalLengthMm };
    const filmNormalWorld = { x: 0, y: 0, z: 1 };
    const filmPlane = { point: filmCenterWorld, normal: filmNormalWorld, distance: -cameraState.focalLengthMm };
    const opticalAxis = { origin: lensCenterWorld, direction: lensNormalWorld };

    const { focusPointWorld, focusPlane } = calculateFocusPlane(cameraState, opticalAxis);
    const { depthOfFieldNearPlane, depthOfFieldFarPlane } = calculateDepthOfField(
      focusPlane,
      cameraState.aperture,
    );

    return {
      lensCenterWorld,
      lensNormalWorld,
      lensPlane,
      filmCenterWorld,
      filmNormalWorld,
      filmPlane,
      opticalAxis,
      focusPointWorld,
      focusPlane,
      depthOfFieldNearPlane,
      depthOfFieldFarPlane,
      groundGlassProjection: calculateGroundGlassProjection(cameraState.groundGlassAssistEnabled),
      focusTargets: calculateSharpness(scene),
      diagnostics: {
        isParallelLensFilm: cameraState.frontTiltDeg === 0 && cameraState.frontSwingDeg === 0,
        tiltAngleDeg: cameraState.frontTiltDeg,
        swingAngleDeg: cameraState.frontSwingDeg,
        fallbackApplied: false,
      },
    };
  } catch (error) {
    const fallbackState = baseFallbackState(cameraState);
    fallbackState.diagnostics.errorMessage =
      error instanceof Error ? error.message : "Unknown optics computation error";
    return fallbackState;
  }
};
