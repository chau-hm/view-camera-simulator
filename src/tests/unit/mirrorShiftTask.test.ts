import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import {
  MIRROR_SHIFT_SCENE_CALIBRATION,
  measureMirrorShiftTeachingState,
  resolveMirrorShiftTeachingState,
} from "../../scenes/mirrorShiftCalibration";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const task = getTaskById("mirror-shift-01");

const cameraForValues = (values: { rigLateralMm: number; frontShiftMm: number }): CameraState => {
  return {
    ...DEFAULT_CAMERA_STATE,
    ...mirrorShiftScene.cameraPreset,
    activeSceneId: mirrorShiftScene.id,
    activeTaskId: "mirror-shift-01",
    mode: "guided",
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    rearRiseMm: 0,
    rearTiltDeg: 0,
    frontShiftMm: values.frontShiftMm,
    mirrorShiftLessonState: { rigLateralMm: values.rigLateralMm },
  };
};

const cameraFor = (
  state: "neutral" | "camera-moved" | "framing-restored",
): CameraState => cameraForValues(resolveMirrorShiftTeachingState(state));

const evaluateValues = (values: { rigLateralMm: number; frontShiftMm: number }) => {
  if (!task) throw new Error("Mirror Shift task is not registered");
  const camera = cameraForValues(values);
  const optics = deriveOpticsState(camera, mirrorShiftScene);
  return {
    result: evaluateTask(task, mirrorShiftScene, camera, optics),
    reflection: measureMirrorShiftTeachingState(optics, values).cameraReflection,
  };
};

const evaluate = (state: "neutral" | "camera-moved" | "framing-restored") => {
  return evaluateValues(resolveMirrorShiftTeachingState(state)).result;
};

describe("Mirror Shift guided task", () => {
  it("registers the guided task with calibrated controls and initial state", () => {
    expect(task).toBeDefined();
    expect(task).toMatchObject({
      id: "mirror-shift-01",
      sceneId: "mirror-shift",
      mode: "guided",
      enabledControls: ["cameraPosition", "frontShift", "geometryView"],
    });
    expect(task?.initialCameraState).toMatchObject({
      aperture: 11,
      frontShiftMm: resolveMirrorShiftTeachingState("neutral").frontShiftMm,
      mirrorShiftLessonState: {
        rigLateralMm: resolveMirrorShiftTeachingState("neutral").rigLateralMm,
      },
    });
    expect(task?.initialCameraState).not.toHaveProperty("geometryView");
    expect(task?.criteria).toEqual([
      expect.objectContaining({
        type: "mirror-reflection-clear",
        clearanceForFullProgressMm:
          MIRROR_SHIFT_SCENE_CALIBRATION.tolerances.cameraReflectionClearanceMm,
      }),
      expect.objectContaining({
        type: "mirror-framing-restored",
        maximumCenterErrorNormalized:
          MIRROR_SHIFT_SCENE_CALIBRATION.tolerances.mirrorFramingRestoredNormalized,
      }),
      expect.objectContaining({
        type: "mirror-viewpoint-retained",
        minimumParallaxDeltaNormalized:
          MIRROR_SHIFT_SCENE_CALIBRATION.tolerances.minimumPropParallaxDeltaNormalized,
      }),
    ]);
  });

  it("fails Neutral and asks for the whole-camera move", () => {
    const result = evaluate("neutral");
    expect(result.status).toBe("failed");
    expect(result.criteria.map((criterion) => criterion.passed)).toEqual([false, true, false]);
    expect(result.primaryFeedback.key).toBe("tasks.mirrorShift.feedback.primary.reflectionClear");
  });

  it("passes reflection clearance at Camera Moved and advances to Front Shift", () => {
    const result = evaluate("camera-moved");
    expect(result.status).toBe("failed");
    expect(result.criteria.map((criterion) => criterion.passed)).toEqual([true, false, true]);
    expect(result.primaryFeedback.key).toBe("tasks.mirrorShift.feedback.primary.framingRestored");
  });

  it("passes the calibrated Framing Restored outcome with the viewpoint retained", () => {
    const result = evaluate("framing-restored");
    expect(result.status).toBe("passed");
    expect(result.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(result.primaryFeedback.key).toBe("tasks.mirrorShift.feedback.passPrimary");
    expect(result.secondaryFeedback[0]?.key).toBe("tasks.mirrorShift.feedback.passSecondary");
  });

  it("passes the reported negative-side state when its reflected footprint is outside the mirror", () => {
    const { reflection, result } = evaluateValues({ rigLateralMm: -1850, frontShiftMm: 54 });

    expect(reflection.valid).toBe(true);
    expect(reflection.intersectsMirrorAperture).toBe(false);
    expect(reflection.clearanceMm).toBeCloseTo(65.67418546365911, 8);
    expect(reflection.boundsMm.minX).toBeCloseTo(-1961.0714701131733, 8);
    expect(reflection.boundsMm.maxX).toBeCloseTo(-1665.6741854636591, 8);
    expect(reflection.boundsMm.minY).toBeCloseTo(-521.6891469055979, 8);
    expect(reflection.boundsMm.maxY).toBeCloseTo(95.23809523809524, 8);
    expect(result.criteria.map((criterion) => criterion.passed)).toEqual([true, true, true]);
    expect(result.status).toBe("passed");
  });

  it("keeps a nearby public-step state failing while the reflection still intersects the mirror", () => {
    const { reflection, result } = evaluateValues({ rigLateralMm: -1750, frontShiftMm: 54 });

    expect(reflection.valid).toBe(true);
    expect(reflection.intersectsMirrorAperture).toBe(true);
    expect(reflection.boundsMm.maxX).toBeCloseTo(-1565.6741854636591, 8);
    expect(reflection.clearanceMm).toBe(0);
    expect(result.criteria[0]?.criterionId).toBe("mirror-reflection-clear");
    expect(result.criteria[0]?.passed).toBe(false);
  });

  it("keeps the unchanged framing threshold tied to the corrected film projection", () => {
    if (!task) throw new Error("Mirror Shift task is not registered");
    const camera = cameraFor("framing-restored");
    camera.mirrorShiftLessonState = { rigLateralMm: 2000 };
    camera.frontShiftMm = -54;
    const result = evaluateTask(
      task,
      mirrorShiftScene,
      camera,
      deriveOpticsState(camera, mirrorShiftScene),
    );
    expect(result.status).toBe("failed");
    expect(result.criteria.map(({ passed }) => passed)).toEqual([true, false, true]);
  });

  it("fails a front-shift-only shortcut", () => {
    const camera = cameraFor("neutral");
    camera.frontShiftMm = -60;
    if (!task) throw new Error("Mirror Shift task is not registered");
    const result = evaluateTask(
      task,
      mirrorShiftScene,
      camera,
      deriveOpticsState(camera, mirrorShiftScene),
    );
    expect(result.status).toBe("failed");
    expect(result.criteria[0]?.passed).toBe(false);
  });
});
