import { afterEach, describe, expect, it } from "vitest";
import { getGuidedLessonStages } from "../../app/guidedLesson";
import { getPublicSceneEntryById } from "../../app/publicScenes";
import { validatePublicSceneCatalog } from "../../app/publicSceneCatalogValidation";
import { publicSceneCatalog } from "../../app/publicScenes";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getGuidedTaskCopy } from "../../core/tasks/guidedTaskCopyKeys";
import { getTaskById, taskRegistry } from "../../core/tasks/taskRegistry";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { getSceneById } from "../../scenes/definitions";
import { obliqueTabletopScene } from "../../scenes/definitions/oblique-tabletop";
import obliqueTabletopGeometry from "../../scenes/obliqueTabletopGeometry";
import { useAppStore } from "../../state/appStore";
import type { CameraState } from "../../types/camera";
import type { TaskDefinition } from "../../types/task";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const scene = obliqueTabletopScene;
const taskIds = [
  "oblique-tabletop-focus-01",
  "oblique-tabletop-tilt-01",
  "oblique-tabletop-swing-01",
  "oblique-tabletop-refine-01",
  "oblique-tabletop-aperture-01",
] as const;

const requireTask = (taskId: string): TaskDefinition => {
  const task = getTaskById(taskId);
  if (!task) throw new Error(`Missing task ${taskId}`);
  return task;
};

const cameraFor = (
  taskId: string,
  overrides: Partial<CameraState> = {},
): CameraState => {
  const task = requireTask(taskId);
  return {
    ...DEFAULT_CAMERA_STATE,
    ...scene.cameraPreset,
    ...task.initialCameraState,
    activeSceneId: scene.id,
    activeTaskId: task.id,
    mode: "guided",
    ...overrides,
  };
};

const evaluate = (taskId: string, overrides: Partial<CameraState> = {}) => {
  const task = requireTask(taskId);
  const camera = cameraFor(taskId, overrides);
  return evaluateTask(task, scene, camera, deriveOpticsState(camera, scene));
};

describe("Oblique Tabletop Guided Lesson", () => {
  afterEach(() => {
    useAppStore.getState().resetCamera();
  });

  it("registers the five ordered guided stages and complete task copy", () => {
    const entry = getPublicSceneEntryById(scene.id);
    if (!entry) throw new Error("Oblique Tabletop public entry is missing");

    expect(entry.availableModes).toEqual(["free", "guided"]);
    expect(entry.guidedTaskId).toBe("oblique-tabletop-aperture-01");
    expect(entry.guidedTaskIds).toEqual(taskIds);
    expect(getGuidedLessonStages(entry)).toEqual([
      { id: "observe" },
      { id: "focus", taskId: "oblique-tabletop-focus-01" },
      { id: "tilt", taskId: "oblique-tabletop-tilt-01" },
      { id: "swing", taskId: "oblique-tabletop-swing-01" },
      { id: "refine", taskId: "oblique-tabletop-refine-01" },
      { id: "aperture", taskId: "oblique-tabletop-aperture-01" },
    ]);

    for (const taskId of taskIds) {
      const task = requireTask(taskId);
      const copy = getGuidedTaskCopy(task);
      expect(task.sceneId).toBe(scene.id);
      expect(task.mode).toBe("guided");
      expect(copy.notes.length).toBeGreaterThan(0);
      expect(Object.keys(copy.criteria)).toEqual(task.criteria.map((criterion) => criterion.id));
    }

    const validation = validatePublicSceneCatalog({
      entries: publicSceneCatalog,
      resolveScene: getSceneById,
      resolveTask: (taskId) => taskRegistry[taskId],
    });
    expect(validation).toEqual({ valid: true, errors: [] });
  });

  it("exposes only the controls needed at each guided stage", () => {
    expect(requireTask(taskIds[0]).enabledControls).toEqual(["focusDistance", "geometryView"]);
    expect(requireTask(taskIds[1]).enabledControls).toEqual([
      "tilt",
      "focusDistance",
      "geometryView",
    ]);
    expect(requireTask(taskIds[2]).enabledControls).toEqual([
      "tilt",
      "swing",
      "focusDistance",
      "geometryView",
    ]);
    expect(requireTask(taskIds[3]).enabledControls).toEqual([
      "tilt",
      "swing",
      "focusDistance",
      "geometryView",
    ]);
    expect(requireTask(taskIds[4]).enabledControls).toEqual(["aperture", "geometryView"]);
    expect(requireTask(taskIds.slice(0, 4)[0]).criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "allowed-aperture", allowedApertures: [11] }),
      ]),
    );
    expect(requireTask(taskIds[4]).criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "allowed-aperture", allowedApertures: [22] }),
      ]),
    );
  });

  it("uses Focus alone to establish the central reference without solving the tabletop", () => {
    const task = requireTask("oblique-tabletop-focus-01");
    const starting = evaluate(task.id);
    const focused = evaluate(task.id, {
      focusDistanceMm: obliqueTabletopGeometry.canonicalFocusDistanceMm,
    });

    expect(starting.status).toBe("failed");
    expect(focused.status).toBe("passed");
    expect(focused.criteria.find((criterion) => criterion.criterionId.endsWith("middle-sharp"))?.passed).toBe(true);
    expect(focused.criteria.find((criterion) => criterion.criterionId.endsWith("focus-used"))?.passed).toBe(true);
    expect(
      focused.criteria.find((criterion) => criterion.criterionId.endsWith("tilt-zero"))?.passed,
    ).toBe(true);
  });

  it("requires the calibrated negative Tilt direction for the near-to-far stage", () => {
    const task = requireTask("oblique-tabletop-tilt-01");
    const correct = evaluate(task.id, {
      frontTiltDeg: obliqueTabletopGeometry.tiltOnlyCalibration.frontTiltDeg,
      focusDistanceMm: obliqueTabletopGeometry.tiltOnlyCalibration.focusDistanceMm,
    });
    const wrongSign = evaluate(task.id, {
      frontTiltDeg: -obliqueTabletopGeometry.tiltOnlyCalibration.frontTiltDeg,
      focusDistanceMm: obliqueTabletopGeometry.tiltOnlyCalibration.focusDistanceMm,
    });

    expect(correct.status).toBe("passed");
    expect(wrongSign.status).toBe("failed");
    expect(
      wrongSign.criteria.find((criterion) => criterion.criterionId.endsWith("movement-range"))?.passed,
    ).toBe(false);
    expect(wrongSign.criteria.filter((criterion) => criterion.criterionId.includes("sharp")).some((criterion) => !criterion.passed)).toBe(true);
  });

  it("requires negative Swing to resolve the compound visible tabletop", () => {
    const task = requireTask("oblique-tabletop-swing-01");
    const correct = evaluate(task.id, {
      frontTiltDeg: -8,
      frontSwingDeg: -1.7,
      focusDistanceMm: 2450,
    });
    const wrongSign = evaluate(task.id, {
      frontTiltDeg: -8,
      frontSwingDeg: 1.7,
      focusDistanceMm: 2450,
    });

    expect(correct.status).toBe("passed");
    expect(wrongSign.status).toBe("failed");
    expect(
      wrongSign.criteria.find((criterion) => criterion.criterionId.endsWith("movement-range"))?.passed,
    ).toBe(false);
    expect(
      wrongSign.criteria.find((criterion) => criterion.criterionId.endsWith("all-targets-sharp"))?.passed,
    ).toBe(false);
  });

  it("requires Focus refinement before the final aperture stage", () => {
    const refineTask = requireTask("oblique-tabletop-refine-01");
    const refined = evaluate(refineTask.id, {
      frontTiltDeg: -8,
      frontSwingDeg: -1.7,
      focusDistanceMm: 2450,
      aperture: 11,
    });
    const notRefined = evaluate(refineTask.id, {
      frontTiltDeg: -8,
      frontSwingDeg: -1.7,
      focusDistanceMm: 2550,
      aperture: 11,
    });
    const wrongCompound = evaluate(refineTask.id, {
      frontTiltDeg: 8,
      frontSwingDeg: 1.7,
      focusDistanceMm: 2450,
      aperture: 22,
    });

    expect(refined.status).toBe("passed");
    expect(notRefined.status).toBe("failed");
    expect(wrongCompound.status).toBe("failed");
  });

  it("requires the modest stop-down while preserving the aligned optical state", () => {
    const task = requireTask("oblique-tabletop-aperture-01");
    const starting = evaluate(task.id, { aperture: 11 });
    const stoppedDown = evaluate(task.id, { aperture: 22 });
    const stoppedDownWrongPlane = evaluate(task.id, {
      frontTiltDeg: 8,
      frontSwingDeg: 1.7,
      focusDistanceMm: 2450,
      aperture: 22,
    });

    expect(starting.status).toBe("failed");
    expect(stoppedDown.status).toBe("passed");
    expect(stoppedDownWrongPlane.status).toBe("failed");
  });

  it("keeps Free Practice fixed while the final guided task can change aperture", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: scene.id, taskId: null });
    store.setAperture(22);
    expect(useAppStore.getState().camera.aperture).toBe(11);

    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: scene.id,
      taskId: "oblique-tabletop-focus-01",
    });
    store.setAperture(22);
    expect(useAppStore.getState().camera.aperture).toBe(11);

    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: scene.id,
      taskId: "oblique-tabletop-aperture-01",
    });
    expect(useAppStore.getState().camera.aperture).toBe(11);
    store.setAperture(22);
    expect(useAppStore.getState().camera.aperture).toBe(22);

    store.setMode("free");
    expect(useAppStore.getState().camera.aperture).toBe(11);
    store.setAperture(22);
    expect(useAppStore.getState().camera.aperture).toBe(11);
  });
});
