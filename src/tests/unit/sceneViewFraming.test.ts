import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createObserverViewPresets,
  resolvePhysicalCameraCenter,
  translateObserverViewToTarget,
  type ObserverViewState,
} from "../../render/sceneViewFraming";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

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
  it("preserves the canonical scene view and frames the camera around the standards midpoint", () => {
    const optics = deriveOpticsState(cameraState(), architectureRiseScene);
    const presets = createObserverViewPresets(sceneView, optics);
    const expectedCenter = resolvePhysicalCameraCenter(optics);

    expect(presets.scene).toBe(sceneView);
    expect(presets.camera.target).toEqual(expectedCenter);
    expect(Math.hypot(
      presets.camera.position[0] - expectedCenter[0],
      presets.camera.position[1] - expectedCenter[1],
      presets.camera.position[2] - expectedCenter[2],
    )).toBeCloseTo(0.72, 8);
  });

  it("keeps tilt and swing target-stable while rise follows the physical camera smoothly", () => {
    const baseline = resolvePhysicalCameraCenter(
      deriveOpticsState(cameraState(), architectureRiseScene),
    );
    const rotated = resolvePhysicalCameraCenter(
      deriveOpticsState(cameraState({ frontTiltDeg: 7, frontSwingDeg: -6 }), architectureRiseScene),
    );
    const risen = resolvePhysicalCameraCenter(
      deriveOpticsState(cameraState({ frontRiseMm: 40 }), architectureRiseScene),
    );

    expect(rotated).toEqual(baseline);
    expect(risen[0]).toBe(baseline[0]);
    expect(risen[1] - baseline[1]).toBeCloseTo(0.02, 8);
    expect(risen[2]).toBe(baseline[2]);
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

