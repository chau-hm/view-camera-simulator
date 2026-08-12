import { afterEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../state/appStore";
import { selectDerivedOpticsState, selectMovementControlState } from "../../state/selectors";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { getTaskById } from "../../core/tasks/taskRegistry";
import type { TaskDefinition } from "../../types/task";

describe("rear-standard canonical state defaults", () => {
  it("DEFAULT_CAMERA_STATE has zero rear movement", () => {
    expect(DEFAULT_CAMERA_STATE.rearRiseMm).toBe(0);
    expect(DEFAULT_CAMERA_STATE.rearTiltDeg).toBe(0);
  });

  it("all four scene presets have zero rear movement", () => {
    expect(architectureRiseScene.cameraPreset.rearRiseMm).toBe(0);
    expect(architectureRiseScene.cameraPreset.rearTiltDeg).toBe(0);
    expect(tableTiltScene.cameraPreset.rearRiseMm).toBe(0);
    expect(tableTiltScene.cameraPreset.rearTiltDeg).toBe(0);
    expect(shelfSwingScene.cameraPreset.rearRiseMm).toBe(0);
    expect(shelfSwingScene.cameraPreset.rearTiltDeg).toBe(0);
    expect(focusFundamentalsTwoTargets.cameraPreset.rearRiseMm).toBe(0);
    expect(focusFundamentalsTwoTargets.cameraPreset.rearTiltDeg).toBe(0);
  });
});

describe("rear-standard guided task initial state", () => {
  const taskIds = ["rise-01", "tilt-01", "swing-01"];
  for (const taskId of taskIds) {
    it(`task ${taskId} resets rear movement to zero`, () => {
      const task = getTaskById(taskId) as TaskDefinition;
      expect(task.initialCameraState?.rearRiseMm).toBe(0);
      expect(task.initialCameraState?.rearTiltDeg).toBe(0);
    });
  }

  it("no guided task adds rear movement to enabledControls", () => {
    for (const taskId of taskIds) {
      const task = getTaskById(taskId) as TaskDefinition;
      expect(task.enabledControls).not.toContain("rearRise" as never);
      expect(task.enabledControls).not.toContain("rearTilt" as never);
    }
  });
});

describe("rear-standard store reset semantics", () => {
  afterEach(() => {
    useAppStore.getState().resetCamera();
  });

  it("resetMovements resets both rear values", () => {
    useAppStore.setState({
      camera: {
        ...useAppStore.getState().camera,
        rearRiseMm: 15,
        rearTiltDeg: 5,
      },
    });
    useAppStore.getState().resetMovements();
    const { camera } = useAppStore.getState();
    expect(camera.rearRiseMm).toBe(0);
    expect(camera.rearTiltDeg).toBe(0);
  });

  it("restartTask resets both rear values via task initialCameraState", () => {
    useAppStore.setState({
      camera: {
        ...useAppStore.getState().camera,
        rearRiseMm: 20,
        rearTiltDeg: -3,
      },
    });
    useAppStore.getState().setActiveTask("tilt-01");
    useAppStore.getState().restartTask();
    const { camera } = useAppStore.getState();
    expect(camera.rearRiseMm).toBe(0);
    expect(camera.rearTiltDeg).toBe(0);
  });

  it("resetCamera resets both rear values", () => {
    useAppStore.setState({
      camera: {
        ...useAppStore.getState().camera,
        rearRiseMm: 25,
        rearTiltDeg: 7,
      },
    });
    useAppStore.getState().resetCamera();
    const { camera } = useAppStore.getState();
    expect(camera.rearRiseMm).toBe(0);
    expect(camera.rearTiltDeg).toBe(0);
  });

  it("initializeSimulatorRoute applies scene preset with zero rear movement", () => {
    useAppStore.getState().resetCamera();
    useAppStore.setState({
      camera: {
        ...useAppStore.getState().camera,
        rearRiseMm: 30,
        rearTiltDeg: 9,
      },
    });
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "table-tilt",
      taskId: null,
    });
    const { camera } = useAppStore.getState();
    expect(camera.rearRiseMm).toBe(0);
    expect(camera.rearTiltDeg).toBe(0);
  });

  it("initializeSimulatorRoute applies task initialCameraState with zero rear movement", () => {
    useAppStore.getState().resetCamera();
    useAppStore.setState({
      camera: {
        ...useAppStore.getState().camera,
        rearRiseMm: 12,
        rearTiltDeg: 4,
      },
    });
    useAppStore.getState().initializeSimulatorRoute({
      mode: "guided",
      sceneId: "table-tilt",
      taskId: "tilt-01",
    });
    const { camera } = useAppStore.getState();
    expect(camera.rearRiseMm).toBe(0);
    expect(camera.rearTiltDeg).toBe(0);
  });

  it("setInfinityFocus resets both rear values", () => {
    useAppStore.setState({
      camera: {
        ...useAppStore.getState().camera,
        rearRiseMm: 18,
        rearTiltDeg: 6,
      },
    });
    useAppStore.getState().setInfinityFocus();
    const { camera } = useAppStore.getState();
    expect(camera.rearRiseMm).toBe(0);
    expect(camera.rearTiltDeg).toBe(0);
  });
});

describe("rear-standard selector cache invalidation", () => {
  it("selectMovementControlState includes rear fields", () => {
    const state = useAppStore.getState();
    const ctrl = selectMovementControlState(state);
    expect(ctrl).toHaveProperty("rearRiseMm");
    expect(ctrl).toHaveProperty("rearTiltDeg");
  });

  it("selectDerivedOpticsState invalidates when rearRiseMm changes", () => {
    const base = { ...DEFAULT_CAMERA_STATE, activeSceneId: "architecture-rise" };
    const first = selectDerivedOpticsState(base);
    const changed = { ...base, rearRiseMm: 10 };
    const second = selectDerivedOpticsState(changed);
    expect(second).not.toBe(first);
  });

  it("selectDerivedOpticsState invalidates when rearTiltDeg changes", () => {
    const base = { ...DEFAULT_CAMERA_STATE, activeSceneId: "architecture-rise" };
    const first = selectDerivedOpticsState(base);
    const changed = { ...base, rearTiltDeg: 5 };
    const second = selectDerivedOpticsState(changed);
    expect(second).not.toBe(first);
  });

  it("selectDerivedOpticsState returns same instance for zero rear movement", () => {
    const base = { ...DEFAULT_CAMERA_STATE, activeSceneId: "architecture-rise" };
    const first = selectDerivedOpticsState(base);
    const same = selectDerivedOpticsState(base);
    expect(same).toBe(first);
  });
});
