import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createObserverViewPresets,
  createCameraInspectionView,
  resolveCameraInspectionFocusTargetWorld,
  resolveStableCameraInspectionTarget,
  translateObserverViewToTarget,
  type ObserverViewState,
} from "../../render/sceneViewFraming";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import {
  CAMERA_MOVEMENT_SCENE_CALIBRATION,
} from "../../scenes/cameraMovementSceneCalibration";
import {
  CAMERA_BODY_PIVOT_RIG_LOCAL,
  CAMERA_RIG_VIEWPOINT_ANCHORS,
} from "../../scenes/understandingCameraMovementsGeometry";
import { transformRigLocalPointToWorld } from "../../core/optics/applyCameraBodyPitch";
import type { CameraState } from "../../types/camera";
import type { CameraRigTransform } from "../../types/optics";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const sceneView: ObserverViewState = {
  position: [6.5, 3, -6.5],
  target: [0, 0.9, 5.6],
};

const cameraState = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureRiseScene.cameraPreset,
  activeSceneId: architectureRiseScene.id,
  activeTaskId: null,
  mode: "free",
  ...overrides,
});

describe("3D observer view framing", () => {
  const cameraRigTransformFor = (
    anchor: "mid" | "high" | "low",
  ): CameraRigTransform => {
    const placement = CAMERA_RIG_VIEWPOINT_ANCHORS[anchor];
    return {
      rigOriginWorld: placement.rigOriginWorld,
      basePitchDeg: placement.basePitchDeg,
      bodyPitchDeg: anchor === "high" ? 34 : anchor === "low" ? -34 : 0,
      bodyPitchPivotRigLocal: CAMERA_BODY_PIVOT_RIG_LOCAL,
    };
  };

  it.each(["mid", "high", "low"] as const)(
    "resolves the %s camera inspection target from the canonical rig transform",
    (anchor) => {
      const transform = cameraRigTransformFor(anchor);
      const expectedPivot = transformRigLocalPointToWorld(
        transform.bodyPitchPivotRigLocal,
        transform,
      );
      const actualTarget = resolveCameraInspectionFocusTargetWorld(transform);

      expect(actualTarget[0]).toBeCloseTo(expectedPivot.x * 0.001, 10);
      expect(actualTarget[1]).toBeCloseTo(expectedPivot.y * 0.001, 10);
      expect(actualTarget[2]).toBeCloseTo(expectedPivot.z * 0.001, 10);
    },
  );

  it("keeps camera inspection framing distance and offset when targeting a moved rig", () => {
    const baseView = createCameraInspectionView(
      understandingCameraMovementsScene,
      {
        position: [2.43, 0.64, -0.68],
        target: [0, 0, 0.8],
      },
      CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocalLengthMm,
    );
    const highTarget = resolveCameraInspectionFocusTargetWorld(
      cameraRigTransformFor("high"),
    );
    const inspectionView = createCameraInspectionView(
      understandingCameraMovementsScene,
      {
        position: [2.43, 0.64, -0.68],
        target: [0, 0, 0.8],
      },
      CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocalLengthMm,
      highTarget,
    );
    const baseOffset = baseView.position.map(
      (value, index) => value - baseView.target[index],
    );
    const inspectionOffset = inspectionView.position.map(
      (value, index) => value - inspectionView.target[index],
    );

    expect(inspectionView.target).toEqual(highTarget);
    inspectionOffset.forEach((value, index) => {
      expect(value).toBeCloseTo(baseOffset[index], 10);
    });
    expect(Math.hypot(...inspectionOffset)).toBeCloseTo(
      Math.hypot(...baseOffset),
      10,
    );
  });

  it("preserves the canonical scene view and frames the camera around its stable body anchor", () => {
    const expectedCenter = resolveStableCameraInspectionTarget(
      architectureRiseScene.id,
      CAMERA_CONSTANTS.focalLengthMm,
    );
    const presets = createObserverViewPresets(sceneView, expectedCenter);

    expect(presets.scene).toBe(sceneView);
    expect(presets.camera.target).toEqual(expectedCenter);
    expect(expectedCenter).toEqual([0, 0, -0.075]);
    expect(Math.hypot(
      presets.camera.position[0] - expectedCenter[0],
      presets.camera.position[1] - expectedCenter[1],
      presets.camera.position[2] - expectedCenter[2],
    )).toBeCloseTo(0.72, 8);
  });

  it("keeps the inspection anchor stable when front geometry and focus change", () => {
    const baselineOptics = deriveOpticsState(cameraState(), architectureRiseScene);
    const risenOptics = deriveOpticsState(cameraState({ frontRiseMm: 40 }), architectureRiseScene);
    const focusedOptics = deriveOpticsState(cameraState({ focusDistanceMm: 5000 }), architectureRiseScene);
    const stableTarget = resolveStableCameraInspectionTarget(
      architectureRiseScene.id,
      CAMERA_CONSTANTS.focalLengthMm,
    );

    expect(risenOptics.lensCenterWorld.y).not.toBe(baselineOptics.lensCenterWorld.y);
    expect(focusedOptics.filmCenterWorld.z).not.toBe(baselineOptics.filmCenterWorld.z);
    expect(stableTarget).toEqual([0, 0, -0.075]);
  });

  it("moves a saved camera view with a new camera center without changing its orbit offset", () => {
    const saved: ObserverViewState = {
      position: [0.4, 0.3, -0.6],
      target: [0, 0, -0.08],
    };
    const translated = translateObserverViewToTarget(saved, [0, 0.02, -0.09]);

    expect(translated.target).toEqual([0, 0.02, -0.09]);
    expect(translated.position).toEqual([0.4, 0.32, -0.61]);
  });
});
