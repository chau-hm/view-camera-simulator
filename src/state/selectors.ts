import { deriveOpticsState } from "../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../scenes/definitions/architecture-rise";
import { getSceneById, getSceneFocusDistanceRange } from "../scenes/definitions";
import type { AppStore } from "./appStore";
import type { CameraState } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";

export const selectCameraState = (state: AppStore): CameraState => state.camera;

export const selectMovementControlState = (state: AppStore) => ({
  frontRiseMm: state.camera.frontRiseMm,
  frontTiltDeg: state.camera.frontTiltDeg,
  frontSwingDeg: state.camera.frontSwingDeg,
});

export const selectFocusControlState = (state: AppStore) => ({
  focusDistanceMm: state.camera.focusDistanceMm,
  focusDistanceMinMm: getSceneFocusDistanceRange(state.camera.activeSceneId).min,
  focusDistanceMaxMm: getSceneFocusDistanceRange(state.camera.activeSceneId).max,
  focusMode: state.camera.focusMode,
  lastFiniteFocusDepthMm: state.camera.lastFiniteFocusDepthMm,
  activeSceneId: state.camera.activeSceneId,
});

export const selectApertureControlState = (state: AppStore) => ({
  aperture: state.camera.aperture,
});

export const selectViewOptionState = (state: AppStore) => ({
  geometryView: state.camera.geometryView,
  groundGlassAssistEnabled: state.camera.groundGlassAssistEnabled,
  focusAssistEnabled: state.camera.focusAssistEnabled,
  gridEnabled: state.camera.gridEnabled,
});

let lastCameraKey = "";
let lastDerivedOpticsState: DerivedOpticsState | null = null;

const buildDerivedCameraKey = (camera: CameraState) =>
  [
    camera.focalLengthMm,
    camera.aperture,
    camera.focusDistanceMm,
    camera.focusMode ?? 'finite',
    camera.lastFiniteFocusDepthMm ?? '',
    camera.frontRiseMm,
    camera.frontTiltDeg,
    camera.frontSwingDeg,
    camera.activeSceneId,
    camera.groundGlassAssistEnabled,
  ].join("|");

export const selectDerivedOpticsState = (camera: CameraState): DerivedOpticsState => {
  const cameraKey = buildDerivedCameraKey(camera);
  if (lastDerivedOpticsState && lastCameraKey === cameraKey) {
    return lastDerivedOpticsState;
  }

  const scene = getSceneById(camera.activeSceneId) ?? architectureRiseScene;
  lastDerivedOpticsState = deriveOpticsState(camera, scene);
  lastCameraKey = cameraKey;
  return lastDerivedOpticsState;
};
