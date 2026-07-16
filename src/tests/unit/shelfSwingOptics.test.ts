import { describe, expect, it } from "vitest";
import { pointToPlaneDistance } from "../../core/math/plane";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import geometry from "../../scenes/shelfSwingGeometry";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...shelfSwingScene.cameraPreset,
  activeSceneId: shelfSwingScene.id,
  ...overrides,
});

const calibratedCamera = (overrides: Partial<CameraState> = {}): CameraState =>
  cameraFor({
    frontRiseMm: geometry.shelfSwingCalibration.frontRiseMm,
    frontTiltDeg: geometry.shelfSwingCalibration.frontTiltDeg,
    frontSwingDeg: geometry.shelfSwingCalibration.frontSwingDeg,
    focusDistanceMm: geometry.shelfSwingCalibration.focusDistanceMm,
    aperture: geometry.shelfSwingCalibration.aperture,
    ...overrides,
  });

describe("Shelf Swing optics calibration", () => {
  it("does not make all three targets sharp at zero swing and f/11", () => {
    const state = deriveOpticsState(cameraFor({ frontSwingDeg: 0, aperture: 11 }), shelfSwingScene);
    expect(state.diagnostics.fallbackApplied).toBe(false);
    expect(
      state.focusTargets.every(
        (target) => target.sharpness >= geometry.shelfSwingCalibration.targetSharpnessMinimum,
      ),
    ).toBe(false);
  });

  it("makes all three sampled chart surfaces sharp at the calibrated signed swing", () => {
    const camera = calibratedCamera();
    const state = deriveOpticsState(camera, shelfSwingScene);

    expect(camera.frontRiseMm).toBe(0);
    expect(camera.frontTiltDeg).toBe(0);
    expect(state.diagnostics.fallbackApplied).toBe(false);
    expect(state.diagnostics.focusPlaneModel).toBe("scheimpflug");
    expect(state.focusTargets).toHaveLength(3);
    state.focusTargets.forEach((target) => {
      expect(target.sharpness).toBeGreaterThanOrEqual(
        geometry.shelfSwingCalibration.targetSharpnessMinimum,
      );
      expect(target.insideDepthOfField).toBe(true);
    });
  });

  it("does not pass all targets when the swing sign is reversed", () => {
    const state = deriveOpticsState(
      calibratedCamera({ frontSwingDeg: -geometry.shelfSwingCalibration.frontSwingDeg }),
      shelfSwingScene,
    );
    expect(state.diagnostics.fallbackApplied).toBe(false);
    expect(
      state.focusTargets.every(
        (target) => target.sharpness >= geometry.shelfSwingCalibration.targetSharpnessMinimum,
      ),
    ).toBe(false);
  });

  it("derives a focus plane through all three centre probes", () => {
    const state = deriveOpticsState(calibratedCamera(), shelfSwingScene);
    expect(state.focusPlane).not.toBeNull();
    geometry.subjects.forEach((subject) => {
      expect(pointToPlaneDistance(subject.focusDetailProbeWorld, state.focusPlane!)).toBeLessThan(
        geometry.shelfSwingCalibration.planeIntersectionToleranceMm,
      );
    });
  });
});
