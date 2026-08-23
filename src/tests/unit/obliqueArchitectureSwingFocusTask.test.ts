import { describe, expect, it } from "vitest";
import { calculateProjectedCompositionCoverageByTarget } from "../../core/optics/calculateCompositionCoverage";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { isStandardFrameLevel } from "../../core/optics/calculateRearStandardFrame";
import { getSceneFocusDistanceRange } from "../../scenes/definitions";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import geometry, {
  reachableFacadeFocusDistanceMm,
  reachableFrontRiseMm,
  reachableFrontSwingDeg,
  facadeSharpnessMinimum,
} from "../../scenes/obliqueArchitectureGeometry";
import type { CameraState } from "../../types/camera";
import { CAMERA_CONTROL_STEPS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const task = getTaskById("oblique-swing-focus-01");

const cameraAt = (frontSwingDeg: number, focusDistanceMm: number): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...obliqueArchitectureScene.cameraPreset,
  activeSceneId: obliqueArchitectureScene.id,
  activeTaskId: task?.id ?? null,
  mode: "guided",
  frontRiseMm: reachableFrontRiseMm,
  frontSwingDeg,
  focusDistanceMm,
});

const evaluateAt = (frontSwingDeg: number, focusDistanceMm: number) => {
  if (!task) throw new Error("oblique-swing-focus-01 is not registered");
  const camera = cameraAt(frontSwingDeg, focusDistanceMm);
  const optics = deriveOpticsState(camera, obliqueArchitectureScene);
  return {
    camera,
    optics,
    coverage: calculateProjectedCompositionCoverageByTarget(obliqueArchitectureScene, optics),
    evaluation: evaluateTask(task, obliqueArchitectureScene, camera, optics),
  };
};

describe("Oblique Architecture Swing + façade focus task", () => {
  it("starts from solved Rise composition with zero Swing and incomplete façade sharpness", () => {
    expect(task).toBeDefined();
    expect(task?.enabledControls).toEqual(["swing", "focusDistance", "geometryView"]);
    expect(task?.constraints).toEqual({});
    expect(task?.initialCameraState).toMatchObject({
      frontRiseMm: reachableFrontRiseMm,
      frontSwingDeg: 0,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      aperture: obliqueArchitectureScene.cameraPreset.aperture,
      geometryView: "top",
    });

    const result = evaluateAt(0, geometry.canonicalFocusDistanceMm);
    expect(result.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
    expect(result.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
    expect(result.evaluation.criteria.find((criterion) => criterion.criterionId.endsWith("camera-level"))?.passed).toBe(true);
    expect(result.evaluation.criteria.filter((criterion) => criterion.criterionId.endsWith("-sharp")).every((criterion) => criterion.passed)).toBe(false);
    expect(result.evaluation.status).toBe("failed");
  });

  it("passes at the rounded public-grid calibration and at a nearby public Swing step", () => {
    const solved = evaluateAt(reachableFrontSwingDeg, reachableFacadeFocusDistanceMm);
    const nearby = evaluateAt(
      reachableFrontSwingDeg - CAMERA_CONTROL_STEPS.swingDeg,
      reachableFacadeFocusDistanceMm,
    );
    expect(reachableFrontSwingDeg).toBe(9.8);
    expect(reachableFacadeFocusDistanceMm).toBe(5190);
    expect(solved.evaluation.status).toBe("passed");
    expect(solved.evaluation.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(nearby.evaluation.status).toBe("passed");
    expect(nearby.evaluation.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(isStandardFrameLevel(solved.optics.rearStandardFrame)).toBe(true);
    const neutralFrame = evaluateAt(0, geometry.canonicalFocusDistanceMm).optics.rearStandardFrame;
    expect(solved.optics.rearStandardFrame.upWorld).toEqual(neutralFrame.upWorld);
    expect(solved.optics.rearStandardFrame.rightWorld).toEqual(neutralFrame.rightWorld);
    expect(solved.optics.rearStandardFrame.normalWorld).toEqual(neutralFrame.normalWorld);
  });

  it("keeps the façade unsolved when only Focus or only Swing changes", () => {
    const range = getSceneFocusDistanceRange(obliqueArchitectureScene.id);
    const focusOnlyCanPass = Array.from(
      { length: Math.floor((range.max - range.min) / CAMERA_CONTROL_STEPS.focusDistanceMm) + 1 },
      (_, index) => range.min + index * CAMERA_CONTROL_STEPS.focusDistanceMm,
    ).some((focusDistanceMm) =>
      evaluateAt(0, focusDistanceMm).optics.focusTargets.every((target) => target.sharpness >= facadeSharpnessMinimum),
    );
    const swingOnlyCanPass = Array.from(
      { length: Math.round((10 - -10) / CAMERA_CONTROL_STEPS.swingDeg) + 1 },
      (_, index) => -10 + index * CAMERA_CONTROL_STEPS.swingDeg,
    ).some((frontSwingDeg) =>
      evaluateAt(frontSwingDeg, geometry.canonicalFocusDistanceMm).optics.focusTargets.every(
        (target) => target.sharpness >= facadeSharpnessMinimum,
      ),
    );

    expect(focusOnlyCanPass).toBe(false);
    expect(swingOnlyCanPass).toBe(false);
  });

  it("keeps architectural perspective level during a valid non-zero Front Swing", () => {
    const result = evaluateAt(reachableFrontSwingDeg, reachableFacadeFocusDistanceMm);
    expect(result.evaluation.criteria.find((criterion) => criterion.criterionId.endsWith("camera-level"))?.passed).toBe(true);
    expect(result.optics.rearStandardFrame.upWorld).toEqual(
      evaluateAt(0, geometry.canonicalFocusDistanceMm).optics.rearStandardFrame.upWorld,
    );
  });
});
