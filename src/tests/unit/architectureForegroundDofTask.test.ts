import { describe, expect, it } from "vitest";
import { calculateProjectedCompositionCoverageByTarget } from "../../core/optics/calculateCompositionCoverage";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import geometry from "../../scenes/architectureForegroundGeometry";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import type { ApertureValue, CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const task = getTaskById("architecture-foreground-dof-01");

const cameraAt = (
  aperture: ApertureValue,
  overrides: Partial<CameraState> = {},
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureForegroundScene.cameraPreset,
  activeSceneId: architectureForegroundScene.id,
  activeTaskId: task?.id ?? null,
  mode: "guided",
  frontRiseMm: geometry.neutralCalibration.futureRiseMm,
  frontTiltDeg: geometry.neutralCalibration.publicTiltFocusSolutionDeg,
  focusDistanceMm: geometry.neutralCalibration.publicTiltFocusFocusDistanceMm,
  aperture,
  ...overrides,
});

const evaluateAt = (aperture: ApertureValue, overrides: Partial<CameraState> = {}) => {
  if (!task) throw new Error("architecture-foreground-dof-01 is not registered");
  const camera = cameraAt(aperture, overrides);
  const optics = deriveOpticsState(camera, architectureForegroundScene);
  return {
    camera,
    optics,
    coverage: calculateProjectedCompositionCoverageByTarget(architectureForegroundScene, optics),
    evaluation: evaluateTask(task, architectureForegroundScene, camera, optics),
  };
};

const criterionPassed = (criterionId: string, evaluation: ReturnType<typeof evaluateTask>) =>
  evaluation.criteria.find((criterion) => criterion.criterionId === criterionId)?.passed;

const targetSharpness = (result: ReturnType<typeof evaluateAt>) =>
  Object.fromEntries(
    result.optics.focusTargets.map((target) => [target.id, target.physicalPatchSharpness ?? 0]),
  );

describe("Architecture + Foreground Aperture / Depth of Field task", () => {
  it("registers the cumulative controls and starts from the solved PR7C state", () => {
    expect(task).toBeDefined();
    expect(task?.sceneId).toBe(architectureForegroundScene.id);
    expect(task?.enabledControls).toEqual(["aperture", "geometryView"]);
    expect(task?.initialCameraState).toMatchObject({
      frontRiseMm: geometry.neutralCalibration.futureRiseMm,
      frontTiltDeg: geometry.neutralCalibration.publicTiltFocusSolutionDeg,
      focusDistanceMm: geometry.neutralCalibration.publicTiltFocusFocusDistanceMm,
      aperture: architectureForegroundScene.cameraPreset.aperture,
    });
    expect(architectureForegroundScene.movementCapabilities).toEqual({
      available: ["frontRiseMm", "frontTiltDeg"],
      selectionMode: "multiple",
      defaultMovement: "frontRiseMm",
    });
    expect(architectureForegroundScene.cameraControlPolicy).toEqual({
      infinityReset: false,
    });
  });

  it("starts close to correct but leaves the residual depth-of-field targets soft at f/11", () => {
    const result = evaluateAt(11);
    const sharpness = targetSharpness(result);

    expect(result.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
    expect(result.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
    expect(result.evaluation.status).toBe("failed");
    expect(criterionPassed("architecture-foreground-dof-aperture", result.evaluation)).toBe(false);
    expect(criterionPassed("architecture-foreground-dof-focus-targets", result.evaluation)).toBe(false);
    expect(sharpness["foreground-near"]).toBeGreaterThanOrEqual(
      geometry.neutralCalibration.tiltFocusSharpnessMinimum,
    );
    expect(sharpness["building-middle"]).toBeGreaterThanOrEqual(
      geometry.neutralCalibration.tiltFocusSharpnessMinimum,
    );
    expect(sharpness["foreground-middle"]).toBeLessThan(
      geometry.neutralCalibration.dofSharpnessMinimum,
    );
    expect(sharpness["building-base"]).toBeLessThan(
      geometry.neutralCalibration.dofSharpnessMinimum,
    );
  });

  it.each([22, 32] as const)("passes at the calibrated stopped-down aperture f/%s", (aperture) => {
    const result = evaluateAt(aperture);
    expect(result.evaluation.status).toBe("passed");
    expect(result.evaluation.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(result.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
    expect(result.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
  });

  it("uses the optical outcome rather than one exact aperture value", () => {
    const start = evaluateAt(11);
    const stoppedDown = evaluateAt(22);
    const smallest = evaluateAt(32);
    const residualTargets = ["foreground-middle", "building-base"];
    const minimumScore = (result: ReturnType<typeof evaluateAt>) =>
      Math.min(...residualTargets.map((id) => targetSharpness(result)[id]));

    expect(minimumScore(stoppedDown)).toBeGreaterThan(minimumScore(start));
    expect(minimumScore(smallest)).toBeGreaterThan(minimumScore(stoppedDown));
    expect(stoppedDown.evaluation.criteria.find(
      (criterion) => criterion.criterionId === "architecture-foreground-dof-aperture",
    )?.passed).toBe(true);
    expect(smallest.evaluation.criteria.find(
      (criterion) => criterion.criterionId === "architecture-foreground-dof-aperture",
    )?.passed).toBe(true);
  });

  it("does not let a clearly wrong focus hide behind a stopped-down aperture", () => {
    const wrongFocus = evaluateAt(32, { focusDistanceMm: 5000 });

    expect(wrongFocus.evaluation.status).toBe("failed");
    expect(wrongFocus.evaluation.criteria.every((criterion) =>
      criterion.criterionId === "architecture-foreground-dof-focus-targets"
        ? !criterion.passed
        : true,
    )).toBe(true);
  });

  it("keeps composition, level perspective, and the focus plane unchanged while aperture changes DOF", () => {
    const start = evaluateAt(11);
    const solved = evaluateAt(22);

    expect(solved.camera.frontRiseMm).toBe(start.camera.frontRiseMm);
    expect(solved.camera.frontTiltDeg).toBe(start.camera.frontTiltDeg);
    expect(solved.camera.focusDistanceMm).toBe(start.camera.focusDistanceMm);
    expect(solved.camera.aperture).not.toBe(start.camera.aperture);
    expect(solved.optics.focusPlane).toEqual(start.optics.focusPlane);
    expect(solved.optics.diagnostics.tiltAngleDeg).toBe(start.optics.diagnostics.tiltAngleDeg);
    expect(solved.optics.diagnostics.swingAngleDeg).toBe(0);
    expect(solved.optics.rearStandardFrame.normalWorld).toEqual(start.optics.rearStandardFrame.normalWorld);
    expect(solved.coverage).toEqual(start.coverage);
    expect(solved.optics.diagnostics.nearU).toBeLessThan(start.optics.diagnostics.nearU ?? Number.POSITIVE_INFINITY);
    expect(solved.optics.diagnostics.farU).toBeGreaterThan(start.optics.diagnostics.farU ?? 0);
  });
});
