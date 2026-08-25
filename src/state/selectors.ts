import { deriveOpticsState } from "../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../scenes/definitions/architecture-rise";
import { getSceneById, getSceneFocusDistanceRange } from "../scenes/definitions";
import {
  getFocusStandardDefault,
  supportsFocusStandard,
} from "./appStore";
import type { AppStore } from "./appStore";
import type { CameraState } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";
import {
  CAMERA_MOVEMENT_CALIBRATION_BASELINE,
  resolveEffectiveCameraMovementCalibration,
  type EffectiveCameraMovementCalibration,
} from "../scenes/cameraMovementEffectiveCalibration";

export const selectCameraState = (state: AppStore): CameraState => state.camera;

export const selectMovementControlState = (state: AppStore) => ({
  frontRiseMm: state.camera.frontRiseMm,
  frontTiltDeg: state.camera.frontTiltDeg,
  frontSwingDeg: state.camera.frontSwingDeg,
  rearRiseMm: state.camera.rearRiseMm,
  rearTiltDeg: state.camera.rearTiltDeg,
});

export const selectFocusControlState = (state: AppStore) => ({
  focusDistanceMm: state.camera.focusDistanceMm,
  focusDistanceMinMm: getSceneFocusDistanceRange(
    state.camera.activeSceneId,
    state.camera.focalLengthMm,
  ).min,
  focusDistanceMaxMm: getSceneFocusDistanceRange(
    state.camera.activeSceneId,
    state.camera.focalLengthMm,
  ).max,
  focusMode: state.camera.focusMode,
  lastFiniteFocusDepthMm: state.camera.lastFiniteFocusDepthMm,
  activeSceneId: state.camera.activeSceneId,
  focusStandard: state.camera.focusStandard ?? getFocusStandardDefault(state.camera.activeSceneId),
  supportsFocusStandard: supportsFocusStandard(state.camera.activeSceneId),
});

export const selectApertureControlState = (state: AppStore) => ({
  aperture: state.camera.aperture,
});

export const selectViewOptionState = (state: AppStore) => ({
  geometryView: state.camera.geometryView,
  groundGlassAssistEnabled: state.camera.groundGlassAssistEnabled,
  focusAssistEnabled: state.camera.focusAssistEnabled,
  gridEnabled: state.camera.gridEnabled,
  showOpticalGeometry: state.ui.showOpticalGeometry,
});

const PRODUCTION_EFFECTIVE_CAMERA_MOVEMENT_CALIBRATION =
  resolveEffectiveCameraMovementCalibration(CAMERA_MOVEMENT_CALIBRATION_BASELINE);

export const selectEffectiveCameraMovementCalibration = (
  state: AppStore,
): EffectiveCameraMovementCalibration =>
  state.cameraMovementCalibrationSession.active
    ? state.cameraMovementCalibrationSession.effectiveCalibration
    : PRODUCTION_EFFECTIVE_CAMERA_MOVEMENT_CALIBRATION;

let lastCameraKey = "";
let lastDerivedOpticsState: DerivedOpticsState | null = null;

const buildCameraRigPlacementKey = (camera: CameraState): ReadonlyArray<string | number> => {
  const placement = camera.cameraRigPlacement;
  const common = [
    placement.kind,
    placement.rigOriginWorld.x,
    placement.rigOriginWorld.y,
    placement.rigOriginWorld.z,
    placement.basePitchDeg,
  ];
  if (placement.kind === "identity") return common;
  return [
    ...common,
    placement.anchor,
    placement.metadata.identity,
    placement.metadata.relativeHeight,
    placement.arcPlane,
    placement.arcCenterWorld.x,
    placement.arcCenterWorld.y,
    placement.arcCenterWorld.z,
    placement.arcAngleDeg,
    placement.radiusMm,
  ];
};

const buildDerivedCameraKey = (
  camera: CameraState,
  cameraMovementCalibration?: EffectiveCameraMovementCalibration,
) =>
  [
    camera.focalLengthMm,
    camera.aperture,
    camera.focusDistanceMm,
    camera.focusStandard,
    camera.focusMode ?? "finite",
    camera.lastFiniteFocusDepthMm ?? "",
    camera.frontRiseMm,
    camera.frontShiftMm,
    camera.frontTiltDeg,
    camera.frontSwingDeg,
    camera.rearRiseMm,
    camera.rearTiltDeg,
    camera.cameraBodyPitchDeg,
    camera.cameraBodyPivotWorld.x,
    camera.cameraBodyPivotWorld.y,
    camera.cameraBodyPivotWorld.z,
    camera.viewpointAnchor,
    camera.cameraMovementLessonState?.study ?? "",
    camera.cameraMovementLessonState?.viewpointT ?? "",
    camera.cameraMovementLessonState?.activeStandard ?? "",
    camera.cameraMovementLessonState?.tiltDeg ?? "",
    camera.cameraMovementLessonState?.framingT ?? "",
    ...buildCameraRigPlacementKey(camera),
    camera.activeSceneId,
    camera.groundGlassAssistEnabled,
    cameraMovementCalibration?.opticsKey ?? "",
    cameraMovementCalibration?.rigKey ?? "",
  ].join("|");

export const selectDerivedOpticsState = (
  camera: CameraState,
  cameraMovementCalibration?: EffectiveCameraMovementCalibration,
): DerivedOpticsState => {
  const cameraKey = buildDerivedCameraKey(camera, cameraMovementCalibration);
  if (lastDerivedOpticsState && lastCameraKey === cameraKey) {
    return lastDerivedOpticsState;
  }

  const scene = getSceneById(camera.activeSceneId) ?? architectureRiseScene;
  lastDerivedOpticsState = deriveOpticsState(
    camera,
    scene,
    cameraMovementCalibration,
  );
  lastCameraKey = cameraKey;
  return lastDerivedOpticsState;
};
