import { afterEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../state/appStore";
import { selectEffectiveCameraMovementCalibration } from "../../state/selectors";
import type { CameraMovementCalibrationOverrides } from "../../scenes/cameraMovementEffectiveCalibration";

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
    expect(rejected.validation.valid).toBe(true);
    expect(rejected.rejectedProposalValidation?.valid).toBe(false);
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

  it("clears overrides and the route cache when the calibration route exits", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
      calibrationEnabled: true,
    });
    store.updateCameraMovementCalibration({ geometry: { levels: 7 } });

    store.clearCameraMovementCalibrationSession();

    const cleared = useAppStore.getState();
    expect(cleared.cameraMovementCalibrationSession.active).toBe(false);
    expect(cleared.cameraMovementCalibrationSession.revision).toBe(0);
    expect(cleared.cameraMovementCalibrationSession.overrides).toEqual({});
    expect(cleared.lastInitializedRouteKey).toBeNull();
  });

  it.each([
    [{ geometry: { columns: 9 } }, "columns"],
    [{ geometry: { rows: 0 } }, "rows"],
    [{ geometry: { levels: 13 } }, "levels"],
    [{ geometry: { cubeSizeMm: 1001 } }, "cubeSizeMm"],
    [{ geometry: { horizontalGapMm: 1001 } }, "horizontalGapMm"],
    [{ geometry: { verticalGapMm: -1 } }, "verticalGapMm"],
    [{ geometry: { subjectDistanceMm: 10001 } }, "subject distance"],
    [{ optics: { provisionalFocalLengthMm: 1001 } }, "focal length"],
    [{ optics: { provisionalFocusDistanceMm: 10001 } }, "focus distance"],
    [{ rig: { arcAngleDeg: 45.1 } }, "arc angle"],
    [{ rig: { provisionalBasePitchDeg: -20.1 } }, "base pitch"],
    [{ presentation: { outerVerticalWeight: 10.1 } }, "outerVerticalWeight"],
    [{ presentation: { outerHorizontalWeight: 0 } }, "outerHorizontalWeight"],
    [{ presentation: { internalEdgeWeight: 10.1 } }, "internalEdgeWeight"],
    [{ presentation: { internalEdgeOpacity: 1.01 } }, "internalEdgeOpacity"],
  ] as const)("rejects an out-of-range canonical update atomically: %s", (overrides, message) => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements", calibrationEnabled: true });
    const before = useAppStore.getState();

    expect(store.updateCameraMovementCalibration(overrides as CameraMovementCalibrationOverrides)).toBe(false);

    const after = useAppStore.getState();
    expect(after.cameraMovementCalibrationSession.revision).toBe(before.cameraMovementCalibrationSession.revision);
    expect(after.cameraMovementCalibrationSession.effectiveCalibration).toBe(before.cameraMovementCalibrationSession.effectiveCalibration);
    expect(after.camera).toEqual(before.camera);
    expect(after.cameraMovementCalibrationSession.overrides).toEqual(
      before.cameraMovementCalibrationSession.overrides,
    );
    expect(after.cameraMovementCalibrationSession.validation.valid).toBe(true);
    expect(
      after.cameraMovementCalibrationSession.rejectedProposalValidation?.errors
        .map(({ message: errorMessage }) => errorMessage)
        .join(" "),
    ).toMatch(new RegExp(message, "i"));
  });

  it("increments draft reset generation for start, reset, clear, and re-entry", () => {
    const initial = useAppStore.getState().cameraMovementCalibrationSession
      .draftResetGeneration;
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
      calibrationEnabled: true,
    });
    const started = useAppStore.getState().cameraMovementCalibrationSession
      .draftResetGeneration;
    expect(started).toBe(initial + 1);

    useAppStore.getState().resetCameraMovementCalibration();
    const reset = useAppStore.getState().cameraMovementCalibrationSession
      .draftResetGeneration;
    expect(reset).toBe(started + 1);

    useAppStore.getState().clearCameraMovementCalibrationSession();
    const cleared = useAppStore.getState().cameraMovementCalibrationSession
      .draftResetGeneration;
    expect(cleared).toBe(reset + 1);

    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
      calibrationEnabled: true,
    });
    expect(
      useAppStore.getState().cameraMovementCalibrationSession
        .draftResetGeneration,
    ).toBe(cleared + 1);
  });

  it("rejects out-of-range camera-body pitch at the store boundary", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements", calibrationEnabled: true });
    store.setCameraBodyPitchDeg(46);
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(0);
    store.setCameraBodyPitchDeg(-45);
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(-45);
  });
});
