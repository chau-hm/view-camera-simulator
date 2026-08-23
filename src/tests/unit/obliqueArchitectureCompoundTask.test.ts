import { describe, expect, it } from "vitest";
import { calculateProjectedCompositionCoverageByTarget } from "../../core/optics/calculateCompositionCoverage";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { isStandardFrameLevel } from "../../core/optics/calculateRearStandardFrame";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import geometry, {
  reachableFacadeFocusDistanceMm,
  reachableFrontRiseMm,
  reachableFrontSwingDeg,
  facadeSharpnessMinimum,
} from "../../scenes/obliqueArchitectureGeometry";
import type { CameraState } from "../../types/camera";
import { CAMERA_CONTROL_STEPS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const task = getTaskById("oblique-compound-01");

const cameraAt = (
  frontRiseMm: number,
  frontSwingDeg: number,
  focusDistanceMm: number,
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...obliqueArchitectureScene.cameraPreset,
  activeSceneId: obliqueArchitectureScene.id,
  activeTaskId: task?.id ?? null,
  mode: "guided",
  frontRiseMm,
  frontSwingDeg,
  focusDistanceMm,
});

const evaluateAt = (
  frontRiseMm: number,
  frontSwingDeg: number,
  focusDistanceMm: number,
) => {
  if (!task) throw new Error("oblique-compound-01 is not registered");
  const camera = cameraAt(frontRiseMm, frontSwingDeg, focusDistanceMm);
  const optics = deriveOpticsState(camera, obliqueArchitectureScene);
  return {
    camera,
    optics,
    coverage: calculateProjectedCompositionCoverageByTarget(obliqueArchitectureScene, optics),
    evaluation: evaluateTask(task, obliqueArchitectureScene, camera, optics),
  };
};

const criterionPassed = (result: ReturnType<typeof evaluateAt>, suffix: string): boolean =>
  result.evaluation.criteria.find((criterion) => criterion.criterionId.endsWith(suffix))?.passed ?? false;

describe("Oblique Architecture compound outcome task", () => {
  it("starts completely neutral and fails the compound outcome", () => {
    expect(task).toBeDefined();
    expect(task?.enabledControls).toEqual(["rise", "swing", "focusDistance", "geometryView"]);
    expect(task?.constraints).toEqual({});
    expect(task?.initialCameraState).toMatchObject({
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      rearRiseMm: 0,
      rearTiltDeg: 0,
      aperture: obliqueArchitectureScene.cameraPreset.aperture,
      geometryView: "top",
    });

    const neutral = evaluateAt(0, 0, geometry.canonicalFocusDistanceMm);
    expect(neutral.coverage["building-top"]).toBeLessThan(0.95);
    expect(neutral.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
    expect(criterionPassed(neutral, "camera-level")).toBe(true);
    expect(neutral.optics.focusTargets.every((target) => target.sharpness >= facadeSharpnessMinimum)).toBe(false);
    expect(neutral.evaluation.status).toBe("failed");
  });

  it("keeps the Rise-only and Swing+Focus partial solutions incomplete", () => {
    const riseOnly = evaluateAt(reachableFrontRiseMm, 0, geometry.canonicalFocusDistanceMm);
    expect(riseOnly.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
    expect(riseOnly.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
    expect(criterionPassed(riseOnly, "camera-level")).toBe(true);
    expect(riseOnly.optics.focusTargets.every((target) => target.sharpness >= facadeSharpnessMinimum)).toBe(false);
    expect(riseOnly.evaluation.status).toBe("failed");

    const swingAndFocusOnly = evaluateAt(0, reachableFrontSwingDeg, reachableFacadeFocusDistanceMm);
    expect(swingAndFocusOnly.optics.focusTargets.every((target) => target.sharpness >= facadeSharpnessMinimum)).toBe(true);
    expect(swingAndFocusOnly.coverage["building-top"]).toBeLessThan(0.95);
    expect(swingAndFocusOnly.evaluation.status).toBe("failed");
  });

  it("keeps composition-plus-Swing incomplete until Focus is refined", () => {
    const result = evaluateAt(
      reachableFrontRiseMm,
      reachableFrontSwingDeg,
      geometry.canonicalFocusDistanceMm,
    );

    expect(result.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
    expect(result.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
    expect(criterionPassed(result, "camera-level")).toBe(true);
    expect(result.optics.focusTargets.every((target) => target.sharpness >= facadeSharpnessMinimum)).toBe(false);
    expect(result.evaluation.status).toBe("failed");
  });

  it("passes the public verification state and a nearby public Swing step", () => {
    const solved = evaluateAt(
      reachableFrontRiseMm,
      reachableFrontSwingDeg,
      reachableFacadeFocusDistanceMm,
    );
    const nearby = evaluateAt(
      reachableFrontRiseMm,
      reachableFrontSwingDeg - CAMERA_CONTROL_STEPS.swingDeg,
      reachableFacadeFocusDistanceMm,
    );

    expect(reachableFrontRiseMm).toBe(20);
    expect(reachableFrontSwingDeg).toBe(9.8);
    expect(reachableFacadeFocusDistanceMm).toBe(5190);
    expect(solved.evaluation.status).toBe("passed");
    expect(solved.evaluation.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(nearby.evaluation.status).toBe("passed");
    expect(nearby.evaluation.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(isStandardFrameLevel(solved.optics.rearStandardFrame)).toBe(true);
    expect(solved.optics.rearStandardFrame.upWorld).toEqual(
      evaluateAt(0, 0, geometry.canonicalFocusDistanceMm).optics.rearStandardFrame.upWorld,
    );
  });
});
