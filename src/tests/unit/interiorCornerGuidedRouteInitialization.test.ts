import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import { interiorCornerSwingFocusCalibration } from "../../scenes/interiorCornerSwingFocus";
import { useAppStore } from "../../state/appStore";
import { resetStoreForTest } from "../helpers/resetStore";

const apertureTaskId = "interior-corner-aperture-01";
const apertureTask = getTaskById(apertureTaskId);
if (!apertureTask) throw new Error(`Missing task ${apertureTaskId}`);

const evaluateApertureTask = () => {
  const { camera } = useAppStore.getState();
  return evaluateTask(
    apertureTask,
    interiorCornerScene,
    camera,
    deriveOpticsState(camera, interiorCornerScene),
  );
};

const criterionPassed = (criterionId: string) => {
  const evaluation = evaluateApertureTask();
  const criterion = evaluation.criteria.find(
    (candidate) => candidate.criterionId === criterionId,
  );
  if (!criterion) throw new Error(`Missing criterion ${criterionId}`);
  return criterion.passed;
};

const enterInteriorCornerApertureAfterInfinity = () => {
  const store = useAppStore.getState();
  store.initializeSimulatorRoute({
    mode: "free",
    sceneId: "architecture-rise",
    taskId: null,
  });
  store.setInfinityFocus();
  expect(useAppStore.getState().camera.focusMode).toBe("infinity");

  store.initializeSimulatorRoute({
    mode: "guided",
    sceneId: interiorCornerScene.id,
    taskId: apertureTaskId,
  });
};

describe("Interior Corner guided route focus initialization", () => {
  beforeEach(resetStoreForTest);
  afterEach(resetStoreForTest);

  it("restores finite focus when Aperture follows another scene's Infinity focus", () => {
    enterInteriorCornerApertureAfterInfinity();

    const { camera } = useAppStore.getState();
    expect(camera).toMatchObject({
      activeSceneId: interiorCornerScene.id,
      activeTaskId: apertureTaskId,
      mode: "guided",
      focusMode: "finite",
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      lastFiniteFocusDepthMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: interiorCornerScene.cameraPreset.aperture,
    });

    const optics = deriveOpticsState(camera, interiorCornerScene);
    expect(optics.focusTargets).toHaveLength(3);
    expect(criterionPassed("interior-corner-aperture-focus-preserved")).toBe(true);
    expect(evaluateApertureTask().status).toBe("failed");

    useAppStore.getState().setAperture(11);
    expect(useAppStore.getState().camera.focusMode).toBe("finite");
    expect(evaluateApertureTask().status).toBe("passed");
  });

  it("reinitializes and restarts the same guided task with consistent finite metadata", () => {
    enterInteriorCornerApertureAfterInfinity();
    const store = useAppStore.getState();

    store.setAperture(11);
    store.clearSimulatorRouteInitialization();
    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: interiorCornerScene.id,
      taskId: apertureTaskId,
    });

    expect(useAppStore.getState().camera).toMatchObject({
      focusMode: "finite",
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      lastFiniteFocusDepthMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: interiorCornerScene.cameraPreset.aperture,
    });

    useAppStore.getState().setAperture(11);
    useAppStore.getState().restartTask();
    expect(useAppStore.getState().camera).toMatchObject({
      activeTaskId: apertureTaskId,
      focusMode: "finite",
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      lastFiniteFocusDepthMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: interiorCornerScene.cameraPreset.aperture,
    });
  });
});
