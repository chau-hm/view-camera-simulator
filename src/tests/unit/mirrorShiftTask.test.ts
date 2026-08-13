import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import {
  MIRROR_SHIFT_SCENE_CALIBRATION,
  resolveMirrorShiftTeachingState,
} from "../../scenes/mirrorShiftCalibration";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const task = getTaskById("mirror-shift-01");

const cameraFor = (
  state: "neutral" | "camera-moved" | "framing-restored",
): CameraState => {
  const values = resolveMirrorShiftTeachingState(state);
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

const evaluate = (state: "neutral" | "camera-moved" | "framing-restored") => {
  if (!task) throw new Error("Mirror Shift task is not registered");
  const camera = cameraFor(state);
  return evaluateTask(task, mirrorShiftScene, camera, deriveOpticsState(camera, mirrorShiftScene));
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
      frontShiftMm: resolveMirrorShiftTeachingState("neutral").frontShiftMm,
      mirrorShiftLessonState: {
        rigLateralMm: resolveMirrorShiftTeachingState("neutral").rigLateralMm,
      },
    });
    expect(task?.initialCameraState).not.toHaveProperty("geometryView");
    expect(task?.criteria).toEqual([
      expect.objectContaining({
        type: "mirror-reflection-clear",
        minimumClearanceMm:
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
    expect(result.primaryFeedback).toContain("whole camera sideways");
  });

  it("passes reflection clearance at Camera Moved and advances to Front Shift", () => {
    const result = evaluate("camera-moved");
    expect(result.status).toBe("failed");
    expect(result.criteria.map((criterion) => criterion.passed)).toEqual([true, false, true]);
    expect(result.primaryFeedback).toContain("front standard");
  });

  it("passes the calibrated Framing Restored outcome with the viewpoint retained", () => {
    const result = evaluate("framing-restored");
    expect(result.status).toBe("passed");
    expect(result.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(result.primaryFeedback).toContain("framing is restored");
    expect(result.secondaryFeedback.join(" ")).toContain("viewpoint changed");
  });

  it("accepts a nearby outcome that satisfies the measured contracts", () => {
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
    expect(result.status).toBe("passed");
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
