import { describe, expect, it } from "vitest";
import { getGuidedLessonStages } from "../../app/guidedLesson";
import { getPublicSceneEntryById } from "../../app/publicScenes";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import {
  INTERIOR_CORNER_CALIBRATION_APERTURE,
  evaluateInteriorCornerSwingFocus,
  INTERIOR_CORNER_FOCUS_TARGET_IDS,
  interiorCornerSwingFocusCalibration,
} from "../../scenes/interiorCornerSwingFocus";
import {
  evaluateInteriorCornerRiseComposition,
} from "../../scenes/interiorCornerRiseComposition";
import geometry from "../../scenes/interiorCornerGeometry";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS, DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { CameraState } from "../../types/camera";
import type { TaskDefinition, TaskEvaluation } from "../../types/task";

const entry = getPublicSceneEntryById(interiorCornerScene.id);
if (!entry) throw new Error("Missing Interior Corner public scene entry");

const taskIds = {
  compose: "interior-corner-compose-01",
  swing: "interior-corner-swing-01",
  refine: "interior-corner-refine-01",
  aperture: "interior-corner-aperture-01",
} as const;

const task = (id: string): TaskDefinition => {
  const definition = getTaskById(id);
  if (!definition) throw new Error(`Missing Interior Corner task: ${id}`);
  return definition;
};

const cameraFor = (
  taskId: string,
  overrides: Partial<CameraState> = {},
): CameraState => {
  const definition = task(taskId);
  return {
    ...DEFAULT_CAMERA_STATE,
    ...interiorCornerScene.cameraPreset,
    ...definition.initialCameraState,
    activeSceneId: interiorCornerScene.id,
    activeTaskId: taskId,
    mode: "guided",
    ...overrides,
  };
};

const evaluate = (taskId: string, overrides: Partial<CameraState> = {}): TaskEvaluation => {
  const camera = cameraFor(taskId, overrides);
  const optics = deriveOpticsState(camera, interiorCornerScene);
  return evaluateTask(task(taskId), interiorCornerScene, camera, optics);
};

const criterion = (evaluation: TaskEvaluation, id: string) => {
  const result = evaluation.criteria.find((candidate) => candidate.criterionId === id);
  if (!result) throw new Error(`Missing criterion ${id}`);
  return result;
};

describe("Interior Corner guided lesson", () => {
  it("publishes Observe plus the ordered Compose, Swing, Refine, and Aperture stages", () => {
    expect(entry.availableModes).toEqual(["free", "guided"]);
    expect(entry.guidedTaskIds).toEqual(Object.values(taskIds));
    expect(getGuidedLessonStages(entry)).toEqual([
      { id: "observe" },
      { id: "compose", taskId: taskIds.compose },
      { id: "swing", taskId: taskIds.swing },
      { id: "refine", taskId: taskIds.refine },
      { id: "aperture", taskId: taskIds.aperture },
    ]);
    expect(interiorCornerScene.cameraPreset).toMatchObject({
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      frontRiseMm: 0,
      frontSwingDeg: 0,
    });
  });

  it("keeps each stage's public control boundary explicit", () => {
    expect(task(taskIds.compose).enabledControls).toEqual(["rise", "geometryView"]);
    expect(task(taskIds.swing).enabledControls).toEqual(["swing", "geometryView"]);
    expect(task(taskIds.refine).enabledControls).toEqual([
      "swing",
      "focusDistance",
      "geometryView",
    ]);
    expect(task(taskIds.aperture).enabledControls).toEqual(["aperture", "geometryView"]);
    expect(task(taskIds.compose).constraints).toEqual({ movement: "rise-only" });
    expect(task(taskIds.swing).constraints).toEqual({ movement: "swing-only" });
    expect(CAMERA_CONSTANTS.apertureOptions).toEqual([5.6, 11, 22, 32]);
    for (const taskId of Object.values(taskIds)) {
      expect(task(taskId).initialCameraState).toMatchObject({
        focusMode: "finite",
      });
    }
    expect(task(taskIds.compose).initialCameraState?.focusDistanceMm).toBe(8000);
    expect(task(taskIds.swing).initialCameraState?.focusDistanceMm).toBe(8000);
    expect(task(taskIds.refine).initialCameraState?.focusDistanceMm).toBe(8000);
    expect(task(taskIds.aperture).initialCameraState?.focusDistanceMm).toBe(38140);
  });

  it("keeps Compose neutral until public Rise produces a valid level composition", () => {
    const neutral = evaluate(taskIds.compose, { frontRiseMm: 0 });
    expect(neutral.status).toBe("failed");
    expect(criterion(neutral, "interior-corner-compose-composition").passed).toBe(false);

    const publicRiseValues = Array.from(
      { length: CAMERA_CONSTANTS.riseMaxMm / CAMERA_CONTROL_STEPS.riseMm + 1 },
      (_, index) => CAMERA_CONSTANTS.riseMinMm + index * CAMERA_CONTROL_STEPS.riseMm,
    );
    const firstPassingRise = publicRiseValues.find(
      (frontRiseMm) =>
        evaluateInteriorCornerRiseComposition(
          deriveOpticsState(cameraFor(taskIds.compose, { frontRiseMm }), interiorCornerScene),
        ).passed,
    );

    expect(firstPassingRise).toBe(33);
    if (firstPassingRise === undefined) {
      throw new Error("Expected a public Rise value to pass the composition criterion");
    }
    expect(evaluate(taskIds.compose, { frontRiseMm: firstPassingRise }).status).toBe("passed");
    expect(evaluate(taskIds.compose, { frontRiseMm: firstPassingRise - 1 }).status).toBe("failed");
    expect(criterion(evaluate(taskIds.compose, { frontRiseMm: firstPassingRise }), "interior-corner-compose-camera-level").passed).toBe(true);
  });

  it("starts Swing from the real composed partial state and keeps it separate from Refine", () => {
    const swingTask = task(taskIds.swing);
    expect(swingTask.initialCameraState).toMatchObject({
      frontRiseMm: 33,
      frontSwingDeg: 0,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });

    const initial = evaluate(taskIds.swing);
    const correctSwing = evaluate(taskIds.swing, {
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
    });
    const correctOptics = deriveOpticsState(
      cameraFor(taskIds.swing, {
        frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      }),
      interiorCornerScene,
    );
    const correctPhysical = evaluateInteriorCornerSwingFocus(
      correctOptics,
      INTERIOR_CORNER_CALIBRATION_APERTURE,
    );

    expect(initial.status).toBe("failed");
    expect(correctPhysical.status).toBe("refine-focus");
    expect(correctPhysical.passed).toBe(false);
    expect(correctSwing.status).toBe("passed");
    expect(evaluate(taskIds.swing, { frontSwingDeg: -3.6 }).status).toBe("failed");
    expect(evaluate(taskIds.swing, {
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
    }).status).toBe("failed");

    const refineAtSwingStart = evaluate(taskIds.refine, {
      frontRiseMm: 33,
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
    });
    expect(refineAtSwingStart.status).toBe("failed");
    expect(criterion(refineAtSwingStart, "interior-corner-refine-wall-focus").passed).toBe(false);
  });

  it("makes Refine Focus the first full near/middle/far wall sharpness gate", () => {
    const publicSolution = interiorCornerSwingFocusCalibration.public;
    const partial = evaluate(taskIds.refine, {
      frontRiseMm: 33,
      frontSwingDeg: publicSolution.frontSwingDeg,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
    });
    const solved = evaluate(taskIds.refine, {
      frontRiseMm: 33,
      frontSwingDeg: publicSolution.frontSwingDeg,
      focusDistanceMm: publicSolution.focusDistanceMm,
    });
    const focusOnly = evaluate(taskIds.refine, {
      frontRiseMm: 33,
      frontSwingDeg: 0,
      focusDistanceMm: publicSolution.focusDistanceMm,
    });

    expect(partial.status).toBe("failed");
    expect(criterion(partial, "interior-corner-refine-wall-focus").passed).toBe(false);
    expect(solved.status).toBe("passed");
    expect(criterion(solved, "interior-corner-refine-wall-focus").passed).toBe(true);
    expect(focusOnly.status).toBe("failed");
    expect(criterion(focusOnly, "interior-corner-refine-swing-range").passed).toBe(false);
    expect(INTERIOR_CORNER_FOCUS_TARGET_IDS).toEqual([
      "interior-wall-near",
      "interior-wall-middle",
      "interior-wall-far",
    ]);
  });

  it("preserves composition and rejects a wrong compound state at Aperture", () => {
    const publicSolution = interiorCornerSwingFocusCalibration.public;
    const initial = evaluate(taskIds.aperture);
    const solved = evaluate(taskIds.aperture, {
      frontRiseMm: 33,
      frontSwingDeg: publicSolution.frontSwingDeg,
      focusDistanceMm: publicSolution.focusDistanceMm,
      aperture: 11,
    });
    const wrongPlane = evaluate(taskIds.aperture, {
      frontRiseMm: 33,
      frontSwingDeg: -publicSolution.frontSwingDeg,
      focusDistanceMm: publicSolution.focusDistanceMm,
      aperture: 11,
    });

    expect(initial.status).toBe("failed");
    expect(criterion(initial, "interior-corner-aperture-allowed-aperture").passed).toBe(false);
    expect(criterion(initial, "interior-corner-aperture-focus-preserved").passed).toBe(true);
    expect(solved.status).toBe("passed");
    expect(criterion(solved, "interior-corner-aperture-composition").passed).toBe(true);
    expect(criterion(solved, "interior-corner-aperture-focus-preserved").passed).toBe(true);
    expect(wrongPlane.status).toBe("failed");
    expect(criterion(wrongPlane, "interior-corner-aperture-focus-preserved").passed).toBe(false);
  });

  it("keeps the public wall contract limited to the one receding wall", () => {
    expect(interiorCornerScene.focusTargets.map((target) => target.id)).toEqual([
      "interior-wall-near",
      "interior-wall-middle",
      "interior-wall-far",
    ]);
    expect(interiorCornerScene.focusTargets.map((target) => target.id)).toEqual(
      [...INTERIOR_CORNER_FOCUS_TARGET_IDS],
    );
  });
});
