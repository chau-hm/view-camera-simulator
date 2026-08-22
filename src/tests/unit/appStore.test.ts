import { afterEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../state/appStore";
import { getSceneFocusDistanceRange } from "../../scenes/definitions";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import architectureForegroundGeometry from "../../scenes/architectureForegroundGeometry";
import { resolveInitialOpticalGeometryVisibility } from "../../state/sceneViewDefaults";
import { getTaskById } from "../../core/tasks/taskRegistry";
import obliqueArchitectureGeometry from "../../scenes/obliqueArchitectureGeometry";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import {
  focusFundamentalsFarFocusDepthMm,
  focusFundamentalsFocusDepthRangeMm,
  focusFundamentalsReferenceFocusDepthMm,
} from "../../scenes/focusFundamentalsTargets";

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
    expect(typeof store.setShowOpticalGeometry).toBe("function");
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
          label: { key: "tasks.common.genericCriterion" },
          passed: false,
          score: 0.4,
          message: { key: "tasks.results.focusTargetsSharp.fail" },
        },
      ],
      primaryFeedback: { key: "tasks.common.genericFailPrimary" },
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

  it("defaults Optical Geometry on, allows a session override, and restores it on restart", () => {
    const { setShowOpticalGeometry, restartTask } = useAppStore.getState();
    expect(useAppStore.getState().ui.showOpticalGeometry).toBe(true);

    setShowOpticalGeometry(false);
    expect(useAppStore.getState().ui.showOpticalGeometry).toBe(false);

    restartTask();
    expect(useAppStore.getState().ui.showOpticalGeometry).toBe(true);
  });

  it("uses an explicit guided-task view override and otherwise keeps the shared default", () => {
    const task = getTaskById("rise-01");
    if (!task) throw new Error("rise-01 task missing");

    expect(resolveInitialOpticalGeometryVisibility(task)).toBe(true);
    expect(
      resolveInitialOpticalGeometryVisibility({
        ...task,
        initialViewState: { showOpticalGeometry: false },
      }),
    ).toBe(false);
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

  it("restores finite focus when lesson Observe follows another scene's Infinity Reset", () => {
    const store = useAppStore.getState();

    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: "architecture-rise",
      taskId: null,
    });
    store.setInfinityFocus();
    expect(useAppStore.getState().camera.focusMode).toBe("infinity");

    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: "oblique-architecture",
      taskId: null,
      lessonEntry: true,
    });

    expect(useAppStore.getState().camera).toMatchObject({
      frontRiseMm: 0,
      frontSwingDeg: 0,
      frontTiltDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
      focusMode: "finite",
      focusDistanceMm: obliqueArchitectureGeometry.canonicalFocusDistanceMm,
      lastFiniteFocusDepthMm: obliqueArchitectureGeometry.canonicalFocusDistanceMm,
      activeTaskId: null,
    });
  });

  it("freshly reinitializes lesson Observe after leaving while preserving same-route changes", () => {
    const store = useAppStore.getState();
    const lessonObserveRoute = {
      mode: "free" as const,
      sceneId: "oblique-architecture",
      taskId: null,
      lessonEntry: true,
    };

    store.initializeSimulatorRoute(lessonObserveRoute);
    store.setRise(20);
    store.setSwing(5);
    store.setFocusDistance(5260);

    store.initializeSimulatorRoute(lessonObserveRoute);
    expect(useAppStore.getState().camera).toMatchObject({
      frontRiseMm: 20,
      frontSwingDeg: 5,
      focusDistanceMm: 5260,
    });

    // This is the cleanup performed when the Guided Lesson workspace is left.
    store.clearSimulatorRouteInitialization();
    store.initializeSimulatorRoute(lessonObserveRoute);

    expect(useAppStore.getState().camera).toMatchObject({
      frontRiseMm: 0,
      frontSwingDeg: 0,
      focusMode: "finite",
      focusDistanceMm: obliqueArchitectureGeometry.canonicalFocusDistanceMm,
      lastFiniteFocusDepthMm: obliqueArchitectureGeometry.canonicalFocusDistanceMm,
      activeTaskId: null,
    });
  });

  it("re-enters Architecture + Foreground lesson Observe from a neutral finite-focus state", () => {
    const store = useAppStore.getState();

    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: "architecture-foreground",
      taskId: null,
    });
    store.setRise(20);
    store.setTilt(2);
    store.setFocusDistance(6830);
    store.setAperture(22);

    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: "architecture-foreground",
      taskId: null,
      lessonEntry: true,
    });

    expect(useAppStore.getState().camera).toMatchObject({
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
      focusMode: "finite",
      focusDistanceMm: architectureForegroundGeometry.canonicalFocusDistanceMm,
      lastFiniteFocusDepthMm: architectureForegroundGeometry.canonicalFocusDistanceMm,
      aperture: 11,
      activeTaskId: null,
    });
  });

  it("selects focus standard without changing finite or infinity focus state", () => {
    const { initializeSimulatorRoute, setFocusDistance, setFocusStandard, setInfinityFocus } =
      useAppStore.getState();

    initializeSimulatorRoute({ mode: "free", sceneId: focusFundamentalsTwoTargets.id, taskId: null });
    setFocusDistance(focusFundamentalsFarFocusDepthMm);
    setFocusStandard("rear");
    expect(useAppStore.getState().camera).toMatchObject({
      focusStandard: "rear",
      focusDistanceMm: focusFundamentalsFarFocusDepthMm,
      focusMode: "finite",
      lastFiniteFocusDepthMm: focusFundamentalsFarFocusDepthMm,
    });

    setInfinityFocus();
    setFocusStandard("front");
    expect(useAppStore.getState().camera).toMatchObject({
      focusStandard: "front",
      focusMode: "infinity",
      lastFiniteFocusDepthMm: focusFundamentalsFarFocusDepthMm,
    });
  });

  it("resets Focus Fundamentals standard and finite focus to its declared baseline", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: focusFundamentalsTwoTargets.id, taskId: null });
    store.setFocusStandard("rear");
    store.setFocusDistance(4000);
    store.setInfinityFocus();
    store.resetMovements();
    expect(useAppStore.getState().camera).toMatchObject({
      focusStandard: "front",
      focusDistanceMm: focusFundamentalsReferenceFocusDepthMm,
      focusMode: "finite",
      lastFiniteFocusDepthMm: focusFundamentalsReferenceFocusDepthMm,
      aperture: 32,
    });
  });

  it("keeps Mirror Shift movement, focus, and aperture controls fixed", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "mirror-shift", taskId: null });
    store.setRise(24);
    store.setTilt(4);
    store.setSwing(-3);
    store.setRearRise(18);
    store.setRearTilt(-2);
    store.setFocusDistance(2500);
    store.setAperture(5.6);

    expect(useAppStore.getState().camera).toMatchObject({
      activeSceneId: "mirror-shift",
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
      focusDistanceMm: 6000,
      aperture: 32,
    });
    expect(useAppStore.getState().selectedMovement).toBeNull();

    store.resetMovements();
    expect(useAppStore.getState().camera).toMatchObject({
      focusDistanceMm: 6000,
      aperture: 32,
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
    });
  });

  it("keeps Mirror Shift lateral position canonical, resettable, and isolated across scenes", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "mirror-shift", taskId: null });

    expect(useAppStore.getState().camera.mirrorShiftLessonState).toEqual({
      rigLateralMm: 0,
    });
    store.setMirrorShiftRigLateralMm(1800);
    expect(useAppStore.getState().camera).toMatchObject({
      mirrorShiftLessonState: { rigLateralMm: 1800 },
      cameraRigPlacement: {
        kind: "identity",
        rigOriginWorld: { x: 1800, y: 0, z: 0 },
      },
    });

    store.setRise(20);
    store.setTilt(4);
    store.setSwing(-3);
    store.setRearRise(18);
    store.setRearTilt(-2);
    expect(useAppStore.getState().camera).toMatchObject({
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
    });

    store.resetMovements();
    expect(useAppStore.getState().camera.mirrorShiftLessonState).toEqual({
      rigLateralMm: 0,
    });
    expect(useAppStore.getState().camera.cameraRigPlacement.rigOriginWorld).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });

    store.setMirrorShiftRigLateralMm(-1800);
    store.initializeSimulatorRoute({ mode: "free", sceneId: "architecture-rise", taskId: null });
    expect(useAppStore.getState().camera.mirrorShiftLessonState).toBeUndefined();
    store.setMirrorShiftRigLateralMm(1800);
    expect(useAppStore.getState().camera.mirrorShiftLessonState).toBeUndefined();

    store.initializeSimulatorRoute({ mode: "free", sceneId: "mirror-shift", taskId: null });
    expect(useAppStore.getState().camera.mirrorShiftLessonState).toEqual({
      rigLateralMm: 0,
    });
  });

  it("keeps front shift canonical, bounded, resettable, and isolated across scenes", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "mirror-shift", taskId: null });

    expect(useAppStore.getState().camera.frontShiftMm).toBe(0);
    store.setFrontShiftMm(40);
    expect(useAppStore.getState().camera.frontShiftMm).toBe(40);
    store.setFrontShiftMm(100);
    expect(useAppStore.getState().camera.frontShiftMm).toBe(60);
    store.setFrontShiftMm(Number.NaN);
    expect(useAppStore.getState().camera.frontShiftMm).toBe(60);

    store.setMirrorShiftRigLateralMm(1800);
    expect(useAppStore.getState().camera).toMatchObject({
      frontShiftMm: 60,
      mirrorShiftLessonState: { rigLateralMm: 1800 },
    });

    store.resetMovements();
    expect(useAppStore.getState().camera).toMatchObject({
      frontShiftMm: 0,
      mirrorShiftLessonState: { rigLateralMm: 0 },
    });

    store.setFrontShiftMm(-50);
    store.initializeSimulatorRoute({ mode: "free", sceneId: "architecture-rise", taskId: null });
    expect(useAppStore.getState().camera.frontShiftMm).toBe(0);
    store.setFrontShiftMm(50);
    expect(useAppStore.getState().camera.frontShiftMm).toBe(0);

    store.initializeSimulatorRoute({ mode: "free", sceneId: "mirror-shift", taskId: null });
    expect(useAppStore.getState().camera.frontShiftMm).toBe(0);
  });

  it("initializes and restarts the guided Mirror Shift task at calibrated Neutral", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "architecture-rise", taskId: null });
    store.setGeometryView("side");

    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: "mirror-shift",
      taskId: "mirror-shift-01",
    });

    expect(useAppStore.getState().camera).toMatchObject({
      mode: "guided",
      activeTaskId: "mirror-shift-01",
      frontShiftMm: 0,
      mirrorShiftLessonState: { rigLateralMm: 0 },
    });
    expect(useAppStore.getState().camera.geometryView).toBe("side");
    expect(useAppStore.getState().ui.geometryView).toBe("side");

    store.setMirrorShiftRigLateralMm(2000);
    store.setFrontShiftMm(-55);
    store.setCurrentTaskEvaluation({
      taskId: "mirror-shift-01",
      status: "passed",
      score: 100,
      criteria: [],
      primaryFeedback: { key: "tasks.common.genericPassPrimary" },
      secondaryFeedback: [],
    });
    store.restartTask();

    expect(useAppStore.getState().camera).toMatchObject({
      mode: "guided",
      activeTaskId: "mirror-shift-01",
      frontShiftMm: 0,
      mirrorShiftLessonState: { rigLateralMm: 0 },
    });
    expect(useAppStore.getState().camera.geometryView).toBe("side");
    expect(useAppStore.getState().ui.geometryView).toBe("side");
    expect(useAppStore.getState().task.currentTaskEvaluation).toBeNull();
  });

  it("keeps guided evaluation and movement state isolated from Mirror Shift Free Mode", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "mirror-shift", taskId: null });
    store.setMirrorShiftRigLateralMm(1800);
    store.setFrontShiftMm(-50);

    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: "mirror-shift",
      taskId: "mirror-shift-01",
    });
    expect(useAppStore.getState().camera).toMatchObject({
      mode: "guided",
      frontShiftMm: 0,
      mirrorShiftLessonState: { rigLateralMm: 0 },
    });

    store.setMirrorShiftRigLateralMm(2000);
    store.setFrontShiftMm(-55);
    store.setCurrentTaskEvaluation({
      taskId: "mirror-shift-01",
      status: "passed",
      score: 100,
      criteria: [],
      primaryFeedback: { key: "tasks.common.genericPassPrimary" },
      secondaryFeedback: [],
    });
    store.initializeSimulatorRoute({ mode: "free", sceneId: "mirror-shift", taskId: null });

    expect(useAppStore.getState().camera).toMatchObject({
      mode: "free",
      activeTaskId: null,
      frontShiftMm: 0,
      mirrorShiftLessonState: { rigLateralMm: 0 },
    });
    expect(useAppStore.getState().task).toMatchObject({
      activeTaskId: null,
      currentTaskEvaluation: null,
    });
  });

  it("preserves the stored geometry view when entering and leaving Mirror Shift", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "architecture-rise", taskId: null });
    store.setGeometryView("side");

    store.initializeSimulatorRoute({ mode: "free", sceneId: "mirror-shift", taskId: null });
    expect(useAppStore.getState().camera.geometryView).toBe("side");
    expect(useAppStore.getState().ui.geometryView).toBe("side");

    store.initializeSimulatorRoute({ mode: "free", sceneId: "architecture-rise", taskId: null });
    expect(useAppStore.getState().camera.geometryView).toBe("side");
    expect(useAppStore.getState().ui.geometryView).toBe("side");

    store.setGeometryView("top");
    store.setActiveScene("mirror-shift");
    expect(useAppStore.getState().camera.geometryView).toBe("top");
    store.setActiveScene("architecture-rise");
    expect(useAppStore.getState().camera.geometryView).toBe("top");
  });

  it("restores Focus Fundamentals f/32 across scene entry, mode changes, and reset actions", () => {
    const store = useAppStore.getState();

    store.initializeSimulatorRoute({ mode: "free", sceneId: "architecture-rise", taskId: null });
    expect(useAppStore.getState().camera.aperture).toBe(11);

    store.initializeSimulatorRoute({ mode: "free", sceneId: focusFundamentalsTwoTargets.id, taskId: null });
    expect(useAppStore.getState().camera.aperture).toBe(32);

    store.setAperture(11);
    store.setMode("guided");
    expect(useAppStore.getState().camera.aperture).toBe(32);

    store.setActiveScene("architecture-rise");
    store.setAperture(11);
    store.setActiveScene(focusFundamentalsTwoTargets.id);
    expect(useAppStore.getState().camera.aperture).toBe(32);

    store.setAperture(11);
    store.resetMovements();
    expect(useAppStore.getState().camera.aperture).toBe(32);

    store.setAperture(11);
    store.restartTask();
    expect(useAppStore.getState().camera.aperture).toBe(32);
  });

  it("keeps the selectable-focus route inside the physical focus range", () => {
    expect(getSceneFocusDistanceRange(focusFundamentalsTwoTargets.id)).toEqual({
      min: focusFundamentalsFocusDepthRangeMm.min,
      max: focusFundamentalsFocusDepthRangeMm.max,
    });
  });

  it("does not change focus standard on scenes without selectable-focus capability", () => {
    const store = useAppStore.getState();
    store.setActiveScene("architecture-rise");
    const before = useAppStore.getState().camera;
    store.setFocusStandard("rear");
    expect(useAppStore.getState().camera).toEqual(before);
  });
});
