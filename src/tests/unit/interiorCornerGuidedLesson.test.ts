import { afterEach, describe, expect, it } from "vitest";
import { getGuidedLessonContext, getGuidedLessonStages } from "../../app/guidedLesson";
import { getPublicSceneEntryById } from "../../app/publicScenes";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import {
  evaluateInteriorCornerFocusAtCalibrationAperture,
  INTERIOR_CORNER_GUIDED_TASK_IDS,
} from "../../scenes/interiorCornerGuidedLesson";
import { evaluateInteriorCornerRiseComposition } from "../../scenes/interiorCornerRiseComposition";
import {
  INTERIOR_CORNER_CALIBRATION_APERTURE,
  evaluateInteriorCornerSwingFocus,
  interiorCornerSwingFocusCalibration,
} from "../../scenes/interiorCornerSwingFocus";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import { useAppStore } from "../../state/appStore";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE, CAMERA_CONTROL_STEPS } from "../../utils/constants";

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...interiorCornerScene.cameraPreset,
  activeSceneId: interiorCornerScene.id,
  activeTaskId: null,
  mode: "guided",
  geometryView: "top",
  ...overrides,
});

const evaluateInteriorTask = (
  taskId: string,
  overrides: Partial<CameraState> = {},
) => {
  const task = getTaskById(taskId);
  if (!task) throw new Error(`Missing Interior Corner task: ${taskId}`);
  const camera = cameraFor({ ...overrides, activeTaskId: taskId });
  const opticsState = deriveOpticsState(camera, interiorCornerScene);
  return {
    camera,
    opticsState,
    evaluation: evaluateTask(task, interiorCornerScene, camera, opticsState),
  };
};

const criterion = (evaluation: ReturnType<typeof evaluateTask>, id: string) => {
  const result = evaluation.criteria.find((entry) => entry.criterionId === id);
  if (!result) throw new Error(`Missing criterion: ${id}`);
  return result;
};

describe("Interior Corner guided lesson", () => {
  afterEach(() => {
    useAppStore.getState().resetCamera();
  });

  it("publishes the Observe plus three photographic task stages", () => {
    const entry = getPublicSceneEntryById(interiorCornerScene.id);
    expect(entry?.availableModes).toEqual(["free", "guided"]);
    expect(entry?.guidedTaskIds).toEqual([
      INTERIOR_CORNER_GUIDED_TASK_IDS.compose,
      INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus,
      INTERIOR_CORNER_GUIDED_TASK_IDS.depthOfField,
    ]);
    expect(getGuidedLessonStages(entry!)).toEqual([
      { id: "observe" },
      { id: "compose", taskId: INTERIOR_CORNER_GUIDED_TASK_IDS.compose },
      { id: "align-focus", taskId: INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus },
      { id: "depth-of-field", taskId: INTERIOR_CORNER_GUIDED_TASK_IDS.depthOfField },
    ]);

    expect(
      getGuidedLessonContext({
        entry: entry!,
        mode: "free",
        sceneId: interiorCornerScene.id,
        taskId: null,
        search: "?lesson=1",
      })?.nextHref,
    ).toBe(
      `/simulator/guided/${interiorCornerScene.id}/${INTERIOR_CORNER_GUIDED_TASK_IDS.compose}?lesson=1`,
    );

    expect(getTaskById(INTERIOR_CORNER_GUIDED_TASK_IDS.compose)?.enabledControls).toEqual([
      "rise",
      "geometryView",
    ]);
    expect(getTaskById(INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus)?.enabledControls).toEqual([
      "swing",
      "focusDistance",
      "geometryView",
    ]);
    expect(getTaskById(INTERIOR_CORNER_GUIDED_TASK_IDS.depthOfField)?.enabledControls).toEqual([
      "aperture",
      "geometryView",
    ]);
  });

  it("starts with a failing projected composition and finds a public Rise solution", () => {
    const neutral = evaluateInteriorTask(INTERIOR_CORNER_GUIDED_TASK_IDS.compose);
    expect(evaluateInteriorCornerRiseComposition(neutral.opticsState).passed).toBe(false);
    expect(neutral.evaluation.status).toBe("failed");

    const reachableRise = Array.from(
      { length: Math.floor((40 - 0) / CAMERA_CONTROL_STEPS.riseMm) + 1 },
      (_, index) => index * CAMERA_CONTROL_STEPS.riseMm,
    ).find((riseMm) =>
      evaluateInteriorCornerRiseComposition(
        deriveOpticsState(cameraFor({ frontRiseMm: riseMm }), interiorCornerScene),
      ).passed,
    );

    if (reachableRise === undefined) throw new Error("No public Rise state solves composition");
    expect(reachableRise % CAMERA_CONTROL_STEPS.riseMm).toBe(0);
    const solved = evaluateInteriorTask(INTERIOR_CORNER_GUIDED_TASK_IDS.compose, {
      frontRiseMm: reachableRise,
    });
    expect(solved.evaluation.status).toBe("passed");
    expect(criterion(solved.evaluation, "interior-corner-compose-composition").passed).toBe(true);
    expect(criterion(solved.evaluation, "interior-corner-compose-camera-level").passed).toBe(true);
  });

  it("keeps the focus stages separate: Swing orientation before Focus placement", () => {
    const neutral = evaluateInteriorTask(INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus);
    expect(criterion(neutral.evaluation, "interior-corner-align-focus-orientation").passed).toBe(false);
    expect(criterion(neutral.evaluation, "interior-corner-align-focus-wall").passed).toBe(false);

    const oriented = evaluateInteriorTask(INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus, {
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerScene.cameraPreset.focusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });
    expect(criterion(oriented.evaluation, "interior-corner-align-focus-orientation").passed).toBe(true);
    expect(criterion(oriented.evaluation, "interior-corner-align-focus-wall").passed).toBe(false);
    expect(oriented.evaluation.status).toBe("failed");
  });

  it("requires the accepted public Swing + Focus state for the receding wall", () => {
    const accepted = evaluateInteriorTask(INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus, {
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });
    expect(accepted.evaluation.status).toBe("passed");
    expect(criterion(accepted.evaluation, "interior-corner-align-focus-wall").passed).toBe(true);

    const wrongSign = evaluateInteriorTask(INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus, {
      frontSwingDeg: -interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });
    const wrongSignPhysical = evaluateInteriorCornerSwingFocus(
      wrongSign.opticsState,
      INTERIOR_CORNER_CALIBRATION_APERTURE,
    );
    const acceptedPhysical = evaluateInteriorCornerSwingFocus(
      accepted.opticsState,
      INTERIOR_CORNER_CALIBRATION_APERTURE,
    );
    expect(wrongSign.evaluation.status).toBe("failed");
    expect(wrongSignPhysical.passed).toBe(false);
    expect(wrongSignPhysical.maximumCoCDiameterMm!).toBeGreaterThan(
      acceptedPhysical.maximumCoCDiameterMm!,
    );
    expect(criterion(wrongSign.evaluation, "interior-corner-align-focus-orientation").passed).toBe(false);
  });

  it("requires open-aperture focus to be preserved before the final stop-down", () => {
    const finalState = {
      frontRiseMm: 33,
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: 11 as const,
    };
    const final = evaluateInteriorTask(INTERIOR_CORNER_GUIDED_TASK_IDS.depthOfField, finalState);
    expect(evaluateInteriorCornerFocusAtCalibrationAperture(final.camera, final.opticsState).passed).toBe(true);
    expect(final.evaluation.status).toBe("passed");

    const stoppedDownWithBadFocus = evaluateInteriorTask(INTERIOR_CORNER_GUIDED_TASK_IDS.depthOfField, {
      ...finalState,
      focusDistanceMm: interiorCornerScene.cameraPreset.focusDistanceMm,
    });
    expect(criterion(stoppedDownWithBadFocus.evaluation, "interior-corner-depth-focus-preserved").passed).toBe(false);
    expect(stoppedDownWithBadFocus.evaluation.status).toBe("failed");

    const open = evaluateInteriorTask(INTERIOR_CORNER_GUIDED_TASK_IDS.depthOfField, {
      ...finalState,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });
    expect(criterion(open.evaluation, "interior-corner-depth-aperture").passed).toBe(false);
    expect(open.evaluation.status).toBe("failed");
  });

  it("preserves solved state across forward and backward lesson routes and resets on Observe", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: interiorCornerScene.id,
      taskId: null,
      lessonEntry: true,
    });
    store.setRise(33);
    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: interiorCornerScene.id,
      taskId: INTERIOR_CORNER_GUIDED_TASK_IDS.compose,
      lessonEntry: true,
    });
    expect(useAppStore.getState().camera.frontRiseMm).toBe(33);
    expect(useAppStore.getState().camera.frontSwingDeg).toBe(0);
    expect(useAppStore.getState().camera.focusDistanceMm).toBe(8000);

    store.setSwing(interiorCornerSwingFocusCalibration.public.frontSwingDeg);
    store.setFocusDistance(interiorCornerSwingFocusCalibration.public.focusDistanceMm);
    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: interiorCornerScene.id,
      taskId: INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus,
      lessonEntry: true,
    });
    expect(useAppStore.getState().camera).toMatchObject({
      frontRiseMm: 33,
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });

    store.setAperture(11);
    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: interiorCornerScene.id,
      taskId: INTERIOR_CORNER_GUIDED_TASK_IDS.depthOfField,
      lessonEntry: true,
    });
    expect(useAppStore.getState().camera).toMatchObject({
      frontRiseMm: 33,
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: 11,
    });

    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: interiorCornerScene.id,
      taskId: INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus,
      lessonEntry: true,
    });
    expect(useAppStore.getState().camera).toMatchObject({
      frontRiseMm: 33,
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });

    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: interiorCornerScene.id,
      taskId: INTERIOR_CORNER_GUIDED_TASK_IDS.compose,
      lessonEntry: true,
    });
    expect(useAppStore.getState().camera).toMatchObject({
      frontRiseMm: 33,
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
    });

    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: interiorCornerScene.id,
      taskId: INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus,
      lessonEntry: true,
    });
    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: interiorCornerScene.id,
      taskId: INTERIOR_CORNER_GUIDED_TASK_IDS.depthOfField,
      lessonEntry: true,
    });
    expect(useAppStore.getState().camera).toMatchObject({
      frontRiseMm: 33,
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });

    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: interiorCornerScene.id,
      taskId: null,
      lessonEntry: true,
    });
    expect(useAppStore.getState().camera).toMatchObject({
      frontRiseMm: 0,
      frontSwingDeg: 0,
      focusDistanceMm: 8000,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
      activeTaskId: null,
    });
  });
});
