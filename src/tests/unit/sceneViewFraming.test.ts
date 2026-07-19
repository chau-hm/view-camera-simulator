import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createObserverViewPresets,
  resolveStableCameraInspectionTarget,
  translateObserverViewToTarget,
  type ObserverViewState,
} from "../../render/sceneViewFraming";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import type { CameraState } from "../../types/camera";
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
