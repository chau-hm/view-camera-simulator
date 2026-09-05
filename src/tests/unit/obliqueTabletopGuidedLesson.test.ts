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
import { obliqueTabletopCompoundCalibration } from "../../scenes/obliqueTabletopCompoundCalibration";
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

const swingStageState = {
  frontTiltDeg: -7.3,
  frontSwingDeg: -1.7,
  focusDistanceMm: 3250,
} as const;

const physicalScores = (overrides: Partial<CameraState> = {}) => {
  const optics = deriveOpticsState(
    cameraFor("oblique-tabletop-swing-01", overrides),
    scene,
  );
  return new Map(
    optics.focusTargets.map((target) => [target.id, target.physicalPatchSharpness ?? 0]),
  );
};

const minimumScore = (scores: Map<string, number>, targetIds: readonly string[]) =>
  Math.min(...targetIds.map((targetId) => scores.get(targetId) ?? 0));

const visibleTargetIds = obliqueTabletopGeometry.subjectBoardVisibleFocusSamples.map(
  (sample) => sample.id,
);
const principalTargetIds = [...obliqueTabletopGeometry.subjectBoardPrincipalDepthSampleIds];
const lateralTargetIds = ["far-left", "far-right"] as const;

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

  it("uses Focus alone to establish the central reference without solving the subject board", () => {
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

  it("starts Swing from the accepted Tilt-only state and keeps the full gate for Refine", () => {
    const swingTask = requireTask("oblique-tabletop-swing-01");
    const refineTask = requireTask("oblique-tabletop-refine-01");

    expect(swingTask.initialCameraState).toEqual(
      expect.objectContaining({
        frontTiltDeg: obliqueTabletopGeometry.tiltOnlyCalibration.frontTiltDeg,
        frontSwingDeg: 0,
        focusDistanceMm: obliqueTabletopGeometry.tiltOnlyCalibration.focusDistanceMm,
      }),
    );

    const neutralScores = physicalScores({
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      focusDistanceMm: obliqueTabletopGeometry.canonicalFocusDistanceMm,
    });
    const tiltOnlyScores = physicalScores({
      frontTiltDeg: obliqueTabletopGeometry.tiltOnlyCalibration.frontTiltDeg,
      frontSwingDeg: 0,
      focusDistanceMm: obliqueTabletopGeometry.tiltOnlyCalibration.focusDistanceMm,
    });
    const swingStartScores = physicalScores(swingTask.initialCameraState);
    const swingPassScores = physicalScores(swingStageState);

    expect(minimumScore(tiltOnlyScores, principalTargetIds)).toBeGreaterThan(
      minimumScore(neutralScores, principalTargetIds) + 0.2,
    );
    expect(minimumScore(tiltOnlyScores, lateralTargetIds)).toBeLessThan(0.8);
    expect(minimumScore(swingStartScores, lateralTargetIds)).toBeLessThan(0.8);
    expect(minimumScore(swingPassScores, lateralTargetIds)).toBeGreaterThanOrEqual(0.8);
    expect(minimumScore(swingPassScores, lateralTargetIds)).toBeGreaterThan(
      minimumScore(tiltOnlyScores, lateralTargetIds) + 0.2,
    );
    expect(minimumScore(swingPassScores, visibleTargetIds)).toBeLessThan(0.8);

    expect(evaluate(swingTask.id, swingStageState).status).toBe("passed");
    expect(evaluate(refineTask.id, swingStageState).status).toBe("failed");
    expect(
      evaluate(refineTask.id, swingStageState).criteria.find((criterion) =>
        criterion.criterionId.endsWith("all-targets-sharp"),
      )?.passed,
    ).toBe(false);
  });

  it("requires the correct negative Swing direction for the partial lateral stage", () => {
    const task = requireTask("oblique-tabletop-swing-01");
    const correct = evaluate(task.id, swingStageState);
    const wrongSign = evaluate(task.id, {
      ...swingStageState,
      frontSwingDeg: 1.2,
    });
    const correctLateral = minimumScore(physicalScores(swingStageState), lateralTargetIds);
    const wrongLateral = minimumScore(
      physicalScores({ ...swingStageState, frontSwingDeg: 1.2 }),
      lateralTargetIds,
    );

    expect(correct.status).toBe("passed");
    expect(wrongSign.status).toBe("failed");
    expect(
      wrongSign.criteria.find((criterion) => criterion.criterionId.endsWith("movement-range"))?.passed,
    ).toBe(false);
    expect(
      wrongSign.criteria.find((criterion) => criterion.criterionId.endsWith("lateral-sharp"))?.passed,
    ).toBe(false);
    expect(wrongLateral).toBeLessThan(correctLateral - 0.2);
  });

  it("requires Focus refinement before the final aperture stage", () => {
    const refineTask = requireTask("oblique-tabletop-refine-01");
    const focusRefined = evaluate(refineTask.id, {
      frontTiltDeg: obliqueTabletopCompoundCalibration.public.frontTiltDeg,
      frontSwingDeg: obliqueTabletopCompoundCalibration.public.frontSwingDeg,
      focusDistanceMm: obliqueTabletopCompoundCalibration.public.focusDistanceMm,
    });
    const refined = evaluate(refineTask.id, {
      frontTiltDeg: obliqueTabletopCompoundCalibration.public.frontTiltDeg,
      frontSwingDeg: obliqueTabletopCompoundCalibration.public.frontSwingDeg,
      focusDistanceMm: obliqueTabletopCompoundCalibration.public.focusDistanceMm,
      aperture: 11,
    });
    const notRefined = evaluate(refineTask.id, swingStageState);
    const wrongCompound = evaluate(refineTask.id, {
      frontTiltDeg: 8,
      frontSwingDeg: 1.6,
      focusDistanceMm: 3030,
      aperture: 22,
    });

    expect(focusRefined.status).toBe("passed");
    expect(refined.status).toBe("passed");
    expect(notRefined.status).toBe("failed");
    expect(
      notRefined.criteria.find((criterion) =>
        criterion.criterionId.endsWith("all-targets-sharp"),
      )?.passed,
    ).toBe(false);
    expect(wrongCompound.status).toBe("failed");
  });

  it("requires the modest stop-down while preserving the aligned optical state", () => {
    const task = requireTask("oblique-tabletop-aperture-01");
    const starting = evaluate(task.id, { aperture: 11 });
    const stoppedDown = evaluate(task.id, { aperture: 22 });
    const stoppedDownWrongPlane = evaluate(task.id, {
      frontTiltDeg: 8,
      frontSwingDeg: 1.6,
      focusDistanceMm: 3030,
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
