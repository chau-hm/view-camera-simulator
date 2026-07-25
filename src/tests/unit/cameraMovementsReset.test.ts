import { describe, expect, it, beforeEach } from "vitest";
import { useAppStore } from "../../state/appStore";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";

function setup() {
  useAppStore.getState().initializeSimulatorRoute({
    mode: "free",
    sceneId: "understanding-camera-movements",
  });
}

describe("Reset and restart preserve scene preset overlap", () => {
  beforeEach(setup);

  it("resetMovements restores scene preset and complete overlap", () => {
    useAppStore.getState().setSelectedMovement("rearRiseMm");
    useAppStore.getState().setRearRise(30);
    useAppStore.getState().setSelectedMovement("frontTiltDeg");
    useAppStore.getState().setTilt(-8);

    useAppStore.getState().resetMovements();
    const s = useAppStore.getState();

    expect(s.camera.frontRiseMm).toBe(0);
    expect(s.camera.rearRiseMm).toBe(0);
    expect(s.camera.frontTiltDeg).toBe(0);
    expect(s.camera.rearTiltDeg).toBe(0);
    expect(s.camera.frontSwingDeg).toBe(0);
    expect(s.camera.focusDistanceMm).toBe(2000);
    expect(s.camera.aperture).toBe(32);
    expect(s.camera.focusMode).toBe("finite");
    expect(s.selectedMovement).toBe("frontRiseMm");

    // Verify optics overlap
    const current = s.camera;
    const currentOptics = deriveOpticsState(current, understandingCameraMovementsScene);
    const original = { ...current, frontRiseMm: 0, rearRiseMm: 0, frontTiltDeg: 0, rearTiltDeg: 0, frontSwingDeg: 0 };
    const originalOptics = deriveOpticsState(original, understandingCameraMovementsScene);
    expect(currentOptics.lensCenterWorld).toEqual(originalOptics.lensCenterWorld);
    expect(currentOptics.filmCenterWorld).toEqual(originalOptics.filmCenterWorld);
  });

  it("restartTask restores scene preset when no task", () => {
    useAppStore.getState().setSelectedMovement("rearTiltDeg");
    useAppStore.getState().setRearTilt(5);

    useAppStore.getState().restartTask();
    const s = useAppStore.getState();

    expect(s.camera.rearTiltDeg).toBe(0);
    expect(s.camera.focusDistanceMm).toBe(2000);
    expect(s.camera.aperture).toBe(32);
    expect(s.selectedMovement).toBe("frontRiseMm");
  });
});
