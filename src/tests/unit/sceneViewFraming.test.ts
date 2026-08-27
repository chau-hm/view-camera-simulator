import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createObserverViewPresets,
  createCameraInspectionView,
  resolveCameraInspectionFocusTargetWorld,
  resolveSceneViewportFraming,
  resolveStableCameraInspectionTarget,
  translateObserverViewByRigOrigin,
  translateObserverViewToTarget,
  type ObserverViewState,
} from "../../render/sceneViewFraming";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
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
      resolveCameraInspectionFocusTargetWorld(cameraRigTransformFor("mid")),
    );
    const highTarget = resolveCameraInspectionFocusTargetWorld(
      cameraRigTransformFor("high"),
    );
    const inspectionView = translateObserverViewToTarget(baseView, highTarget);
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

  it("translates the calibrated Mirror Shift camera inspection view with the rig", () => {
    const neutralView = createCameraInspectionView(
      mirrorShiftScene,
      sceneView,
      resolveStableCameraInspectionTarget(
        mirrorShiftScene.id,
        mirrorShiftScene.cameraPreset.focalLengthMm ?? CAMERA_CONSTANTS.focalLengthMm,
      ),
    );
    const movedView = translateObserverViewByRigOrigin(neutralView, {
      x: 1800,
      y: 0,
      z: 0,
    });

    expect(neutralView.target[0]).toBeCloseTo(0, 10);
    expect(movedView.target[0]).toBeCloseTo(1.8, 10);
    expect(movedView.position[0]).toBeCloseTo(neutralView.position[0] + 1.8, 10);
    expect(movedView.target[1]).toBeCloseTo(neutralView.target[1], 10);
    expect(movedView.target[2]).toBeCloseTo(neutralView.target[2], 10);
    expect(movedView.position[1]).toBeCloseTo(neutralView.position[1], 10);
    expect(movedView.position[2]).toBeCloseTo(neutralView.position[2], 10);

    for (let index = 0; index < 3; index += 1) {
      expect(movedView.position[index] - movedView.target[index]).toBeCloseTo(
        neutralView.position[index] - neutralView.target[index],
        10,
      );
    }
  });

  it("resolves Scene and Camera focus through one shared public-scene contract", () => {
    const optics = deriveOpticsState(cameraState(), architectureRiseScene);
    const framing = resolveSceneViewportFraming({
      scene: architectureRiseScene,
      focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
      cameraRigTransform: optics.cameraRigTransform,
    });

    expect(framing.scene.target).toEqual([
      architectureRiseScene.cameraPlacement.target.x * 0.001,
      architectureRiseScene.cameraPlacement.target.y * 0.001,
      architectureRiseScene.cameraPlacement.target.z * 0.001,
    ]);
    expect(framing.camera.target).toEqual(
      resolveStableCameraInspectionTarget(
        architectureRiseScene.id,
        CAMERA_CONSTANTS.focalLengthMm,
      ),
    );
  });

  it("does not use Architecture + Foreground's subject composition target for Camera focus", () => {
    const optics = deriveOpticsState(
      {
        ...cameraState(),
        ...architectureForegroundScene.cameraPreset,
        activeSceneId: architectureForegroundScene.id,
      },
      architectureForegroundScene,
    );
    const framing = resolveSceneViewportFraming({
      scene: architectureForegroundScene,
      focalLengthMm: architectureForegroundScene.cameraPreset.focalLengthMm ?? CAMERA_CONSTANTS.focalLengthMm,
      cameraRigTransform: optics.cameraRigTransform,
    });

    expect(framing.scene.target).toEqual([
      architectureForegroundScene.cameraPlacement.target.x * 0.001,
      architectureForegroundScene.cameraPlacement.target.y * 0.001,
      architectureForegroundScene.cameraPlacement.target.z * 0.001,
    ]);
    expect(framing.camera.target).toEqual(
      resolveStableCameraInspectionTarget(
        architectureForegroundScene.id,
        architectureForegroundScene.cameraPreset.focalLengthMm ?? CAMERA_CONSTANTS.focalLengthMm,
      ),
    );
    expect(framing.camera.target[2]).not.toBeCloseTo(6.5, 5);
  });

  it.each(["mid", "high", "low"] as const)(
    "uses the canonical physical camera pivot for the %s camera-movements rig",
    (anchor) => {
      const framing = resolveSceneViewportFraming({
        scene: understandingCameraMovementsScene,
        focalLengthMm: CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocalLengthMm,
        cameraRigTransform: cameraRigTransformFor(anchor),
      });

      expect(framing.camera.target).toEqual(
        resolveCameraInspectionFocusTargetWorld(cameraRigTransformFor(anchor)),
      );
    },
  );

  it("moves Mirror Shift's physical camera anchor with the rig while preserving its orbit offset", () => {
    const neutralTransform: CameraRigTransform = {
      rigOriginWorld: { x: 0, y: 0, z: 0 },
      basePitchDeg: 0,
      bodyPitchDeg: 0,
      bodyPitchPivotRigLocal: { x: 0, y: 0, z: 0 },
    };
    const movedTransform: CameraRigTransform = {
      ...neutralTransform,
      rigOriginWorld: { x: 1800, y: 0, z: 0 },
    };
    const neutral = resolveSceneViewportFraming({
      scene: mirrorShiftScene,
      focalLengthMm: mirrorShiftScene.cameraPreset.focalLengthMm ?? CAMERA_CONSTANTS.focalLengthMm,
      cameraRigTransform: neutralTransform,
    }).camera;
    const moved = resolveSceneViewportFraming({
      scene: mirrorShiftScene,
      focalLengthMm: mirrorShiftScene.cameraPreset.focalLengthMm ?? CAMERA_CONSTANTS.focalLengthMm,
      cameraRigTransform: movedTransform,
    }).camera;

    expect(moved.target[0] - neutral.target[0]).toBeCloseTo(1.8, 10);
    expect(moved.position[0] - neutral.position[0]).toBeCloseTo(1.8, 10);
    expect(moved.target.slice(1)).toEqual(neutral.target.slice(1));
    expect(moved.position.slice(1)).toEqual(neutral.position.slice(1));
    for (let index = 0; index < 3; index += 1) {
      expect(moved.position[index] - moved.target[index]).toBeCloseTo(
        neutral.position[index] - neutral.target[index],
        10,
      );
    }
  });
});
