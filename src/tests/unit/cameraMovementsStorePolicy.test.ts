import { describe, expect, it, beforeEach } from "vitest";
import { useAppStore } from "../../state/appStore";

function initCameraMovements() {
  useAppStore.getState().initializeSimulatorRoute({
    mode: "free",
    sceneId: "understanding-camera-movements",
  });
}

function initArchitectureRise() {
  useAppStore.getState().initializeSimulatorRoute({
    mode: "free",
    sceneId: "architecture-rise",
  });
}

describe("Store-enforced cameraControlPolicy", () => {
  describe("Understanding Camera Movements (fixed focus/aperture)", () => {
    beforeEach(initCameraMovements);

    it("setFocusDistance is a no-op when focus is locked", () => {
      const before = useAppStore.getState().camera.focusDistanceMm;
      useAppStore.getState().setFocusDistance(3000);
      expect(useAppStore.getState().camera.focusDistanceMm).toBe(before);
    });

    it("setAperture is a no-op when aperture is locked", () => {
      const before = useAppStore.getState().camera.aperture;
      useAppStore.getState().setAperture(22);
      expect(useAppStore.getState().camera.aperture).toBe(before);
    });

    it("setInfinityFocus is a no-op when infinityReset is disallowed", () => {
      useAppStore.getState().setInfinityFocus();
      expect(useAppStore.getState().camera.focusMode).not.toBe("infinity");
    });

    it("keeps body pitch internal and restores the calibrated pivot on reset", () => {
      const store = useAppStore.getState();
      const pivot = useAppStore.getState().camera.cameraBodyPivotWorld;
      store.setCameraBodyPitchDeg(4);
      expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(4);
      store.initializeSimulatorRoute({ mode: "free", sceneId: "architecture-rise" });
      expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(0);
      expect(useAppStore.getState().camera.cameraBodyPivotWorld).toEqual({ x: 0, y: 0, z: 0 });
      store.initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements" });
      expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(0);
      expect(useAppStore.getState().camera.cameraBodyPivotWorld).toEqual(pivot);
      store.setCameraBodyPitchDeg(3);
      store.initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements" });
      expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(3);
      store.resetMovements();
      expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(0);
      expect(useAppStore.getState().camera.cameraBodyPivotWorld).toEqual(pivot);
      store.initializeSimulatorRoute({ mode: "free", sceneId: "architecture-rise" });
      expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(0);
      expect(useAppStore.getState().camera.cameraBodyPivotWorld).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("restartTask (no task) restores scene preset (2000mm, f/32)", () => {
      useAppStore.getState().setSelectedMovement("rearRiseMm");
      useAppStore.getState().setRearRise(20);
      useAppStore.getState().restartTask();
      const s = useAppStore.getState();
      expect(s.camera.focusDistanceMm).toBe(2000);
      expect(s.camera.aperture).toBe(32);
      expect(s.camera.frontRiseMm).toBe(0);
      expect(s.camera.rearRiseMm).toBe(0);
      expect(s.selectedMovement).toBe("frontRiseMm");
    });

    it("defaults target region to middle and preserves it through movement reset", () => {
      const store = useAppStore.getState();
      expect(store.scene.targetRegion).toBe("middle");
      useAppStore.setState((state) => ({ scene: { ...state.scene, targetRegion: "upper" } }));
      store.setSelectedMovement("rearRiseMm");
      store.resetMovements();
      expect(useAppStore.getState().scene.targetRegion).toBe("upper");
    });

    it("restores default target region and focal preset on restart and route changes", () => {
      const store = useAppStore.getState();
      useAppStore.setState((state) => ({ scene: { ...state.scene, targetRegion: "lower" } }));
      store.restartTask();
      expect(useAppStore.getState().scene.targetRegion).toBe("middle");
      expect(useAppStore.getState().camera.focalLengthMm).toBe(105);
      store.initializeSimulatorRoute({ mode: "free", sceneId: "architecture-rise" });
      expect(useAppStore.getState().scene.targetRegion).toBe("middle");
      expect(useAppStore.getState().camera.focalLengthMm).toBe(150);
      store.initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements" });
      expect(useAppStore.getState().scene.targetRegion).toBe("middle");
      expect(useAppStore.getState().camera.focalLengthMm).toBe(105);
    });
  });

  describe("Architecture Rise (no policy)", () => {
    beforeEach(initArchitectureRise);

    it("setFocusDistance works normally", () => {
      useAppStore.getState().setFocusDistance(3000);
      expect(useAppStore.getState().camera.focusDistanceMm).toBe(3000);
    });

    it("setAperture works normally", () => {
      useAppStore.getState().setAperture(32);
      expect(useAppStore.getState().camera.aperture).toBe(32);
    });

    it("setInfinityFocus works normally", () => {
      useAppStore.getState().setInfinityFocus();
      expect(useAppStore.getState().camera.focusMode).toBe("infinity");
    });
  });
});
