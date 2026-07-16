import { afterEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../state/appStore";
import { getSceneFocusDistanceRange } from "../../scenes/definitions";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";

describe("app store STA-001", () => {
  afterEach(() => {
    useAppStore.getState().resetCamera();
  });

  it("exposes required STA-001 actions", () => {
    const store = useAppStore.getState();

    expect(typeof store.setRise).toBe("function");
    expect(typeof store.setTilt).toBe("function");
    expect(typeof store.setSwing).toBe("function");
    expect(typeof store.setFocusDistance).toBe("function");
    expect(typeof store.setAperture).toBe("function");
    expect(typeof store.setMode).toBe("function");
    expect(typeof store.setActiveScene).toBe("function");
    expect(typeof store.setActiveTask).toBe("function");
    expect(typeof store.resetMovements).toBe("function");
    expect(typeof store.restartTask).toBe("function");
  });

  it("contains camera scene task ui state groups", () => {
    const { camera, scene, task, ui } = useAppStore.getState();

    expect(camera.activeSceneId).toBe(scene.activeSceneId);
    expect(camera.activeTaskId).toBe(task.activeTaskId);
    expect(camera.mode).toBe(ui.mode);
    expect(camera.geometryView).toBe(ui.geometryView);
    expect(camera.groundGlassAssistEnabled).toBe(ui.groundGlassAssistEnabled);
    expect(camera.focusAssistEnabled).toBe(ui.focusAssistEnabled);
    expect(camera.gridEnabled).toBe(ui.gridEnabled);
  });

  it("updates active scene and task with STA-001 actions", () => {
    const { setActiveScene, setActiveTask } = useAppStore.getState();

    setActiveScene("table-tilt");
    setActiveTask("tilt-01");

    const { camera, scene, task } = useAppStore.getState();
    expect(camera.activeSceneId).toBe("table-tilt");
    expect(camera.activeTaskId).toBe("tilt-01");
    expect(scene.activeSceneId).toBe("table-tilt");
    expect(task.activeTaskId).toBe("tilt-01");
  });

  it("resets only movement values with resetMovements", () => {
    const { setRise, setTilt, setSwing, setFocusDistance, setAperture, resetMovements } =
      useAppStore.getState();

    setRise(20);
    setTilt(4);
    setSwing(-5);
    setFocusDistance(4500);
    setAperture(22);
    resetMovements();

    const { camera } = useAppStore.getState();
    expect(camera.frontRiseMm).toBe(DEFAULT_CAMERA_STATE.frontRiseMm);
    expect(camera.frontTiltDeg).toBe(DEFAULT_CAMERA_STATE.frontTiltDeg);
    expect(camera.frontSwingDeg).toBe(DEFAULT_CAMERA_STATE.frontSwingDeg);
    expect(camera.focusDistanceMm).toBe(DEFAULT_CAMERA_STATE.focusDistanceMm);
    expect(camera.aperture).toBe(DEFAULT_CAMERA_STATE.aperture);
  });

  it("restarts task by resetting controls and clearing evaluation", () => {
    const {
      setRise,
      setTilt,
      setSwing,
      setFocusDistance,
      setAperture,
      setCurrentTaskEvaluation,
      setActiveScene,
      setActiveTask,
      restartTask,
    } = useAppStore.getState();

    setActiveScene("shelf-swing");
    setActiveTask("swing-01");
    setRise(30);
    setTilt(3);
    setSwing(7);
    setFocusDistance(6000);
    setAperture(22);
    setCurrentTaskEvaluation({
      taskId: "swing-01",
      status: "failed",
      score: 40,
      criteria: [
        {
          criterionId: "focus-main",
          label: "Primary focus target is sharp",
          passed: false,
          score: 0.4,
          message: "Primary focus target is soft",
        },
      ],
      primaryFeedback: "Adjust movement",
      secondaryFeedback: [],
    });

    restartTask();

    const { camera, scene, ui, task } = useAppStore.getState();
    expect(camera.activeSceneId).toBe("shelf-swing");
    expect(camera.activeTaskId).toBe("swing-01");
    expect(camera.frontRiseMm).toBe(DEFAULT_CAMERA_STATE.frontRiseMm);
    expect(camera.frontTiltDeg).toBe(DEFAULT_CAMERA_STATE.frontTiltDeg);
    expect(camera.frontSwingDeg).toBe(DEFAULT_CAMERA_STATE.frontSwingDeg);
    expect(camera.focusDistanceMm).toBe(shelfSwingGeometry.middleSubject.focusDetailProbeWorld.z);
    expect(camera.aperture).toBe(DEFAULT_CAMERA_STATE.aperture);
    expect(camera.geometryView).toBe("top");
    expect(scene.activeSceneId).toBe("shelf-swing");
    expect(ui.mode).toBe("guided");
    expect(task.currentTaskEvaluation).toBeNull();
  });

  it("uses guided-task default geometry view for rise and tilt as side view", () => {
    const { setActiveTask, restartTask } = useAppStore.getState();

    setActiveTask("rise-01");
    restartTask();
    expect(useAppStore.getState().camera.geometryView).toBe("side");

    setActiveTask("tilt-01");
    restartTask();
    expect(useAppStore.getState().camera.geometryView).toBe("side");
  });

  it("keeps the Scheimpflug Section selection synchronized across camera and UI state", () => {
    useAppStore.getState().setGeometryView("scheimpflug");
    expect(useAppStore.getState().camera.geometryView).toBe("scheimpflug");
    expect(useAppStore.getState().ui.geometryView).toBe("scheimpflug");
  });

  it("clamps focus distance to current scene range", () => {
    const { setActiveScene, setFocusDistance } = useAppStore.getState();
    setActiveScene("table-tilt");
    const tableTiltRange = getSceneFocusDistanceRange("table-tilt");

    setFocusDistance(tableTiltRange.min - 500);
    expect(useAppStore.getState().camera.focusDistanceMm).toBe(tableTiltRange.min);

    setFocusDistance(tableTiltRange.max + 500);
    expect(useAppStore.getState().camera.focusDistanceMm).toBe(tableTiltRange.max);
  });

  it("re-clamps focus when active scene changes", () => {
    const { setActiveScene, setFocusDistance } = useAppStore.getState();
    const architectureRange = getSceneFocusDistanceRange("architecture-rise");
    setActiveScene("architecture-rise");
    setFocusDistance(architectureRange.max);

    setActiveScene("table-tilt");
    const tableTiltRange = getSceneFocusDistanceRange("table-tilt");
    expect(useAppStore.getState().camera.focusDistanceMm).toBe(tableTiltRange.max);
  });

  it("rejects invalid aperture values", () => {
    const { setAperture } = useAppStore.getState();
    setAperture(22);
    expect(useAppStore.getState().camera.aperture).toBe(22);

    Reflect.apply(setAperture, undefined, [7.1]);
    expect(useAppStore.getState().camera.aperture).toBe(22);
  });

  it("toggles focus and grid assists in both camera and ui state", () => {
    const { toggleFocusAssist, toggleGrid } = useAppStore.getState();

    toggleFocusAssist();
    toggleGrid();

    const { camera, ui } = useAppStore.getState();
    expect(camera.focusAssistEnabled).toBe(true);
    expect(ui.focusAssistEnabled).toBe(true);
    expect(camera.gridEnabled).toBe(false);
    expect(ui.gridEnabled).toBe(false);
  });

  it("initializeSimulatorRoute applies scene preset on direct route entry", () => {
    const { initializeSimulatorRoute, resetCamera } = useAppStore.getState();
    resetCamera();
    // simulate direct free route to architecture-rise
    initializeSimulatorRoute({ mode: "free", sceneId: "architecture-rise", taskId: null });
    const { camera } = useAppStore.getState();
    // architecture preset focusDistanceMm must equal scene-specified preset (non-default)
    expect(camera.focusDistanceMm).not.toBe(2000);
    expect(camera.activeSceneId).toBe("architecture-rise");
  });
});
