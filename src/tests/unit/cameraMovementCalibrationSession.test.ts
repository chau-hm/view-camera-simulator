import { afterEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../state/appStore";
import { selectEffectiveCameraMovementCalibration } from "../../state/selectors";

describe("camera movement calibration session", () => {
  afterEach(() => useAppStore.getState().resetCamera());

  it("accepts valid updates atomically and rejects invalid updates", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements", calibrationEnabled: true });
    expect(store.updateCameraMovementCalibration({ geometry: { levels: 7 } })).toBe(true);
    const accepted = useAppStore.getState().cameraMovementCalibrationSession;
    expect(accepted.revision).toBe(1);
    expect(accepted.effectiveCalibration.subject.levels).toBe(7);
    expect(store.updateCameraMovementCalibration({ geometry: { levels: 2 } })).toBe(false);
    const rejected = useAppStore.getState().cameraMovementCalibrationSession;
    expect(rejected.revision).toBe(1);
    expect(rejected.effectiveCalibration.subject.levels).toBe(7);
  });

  it("returns production calibration when inactive and preserves overrides on movement reset", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements", calibrationEnabled: true });
    store.updateCameraMovementCalibration({ geometry: { levels: 7 } });
    store.setRise(20);
    store.resetMovements();
    expect(useAppStore.getState().cameraMovementCalibrationSession.overrides.geometry?.levels).toBe(7);
    store.setCameraMovementCalibrationActive(false);
    expect(selectEffectiveCameraMovementCalibration(useAppStore.getState()).subject.levels).toBe(5);
  });
});
