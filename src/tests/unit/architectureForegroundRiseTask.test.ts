import { describe, expect, it } from "vitest";
import { calculateProjectedCompositionCoverageByTarget } from "../../core/optics/calculateCompositionCoverage";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import {
  projectWorldPointToFilmPlaneGroundGlass,
} from "../../render/groundGlassFilmPlaneProjection";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import geometry from "../../scenes/architectureForegroundGeometry";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const task = getTaskById("architecture-foreground-rise-01");

const cameraAtRise = (frontRiseMm: number, overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureForegroundScene.cameraPreset,
  activeSceneId: architectureForegroundScene.id,
  activeTaskId: task?.id ?? null,
  mode: "guided",
  frontRiseMm,
  ...overrides,
});

const evaluateAtRise = (frontRiseMm: number, overrides: Partial<CameraState> = {}) => {
  if (!task) throw new Error("architecture-foreground-rise-01 is not registered");
  const camera = cameraAtRise(frontRiseMm, overrides);
  const optics = deriveOpticsState(camera, architectureForegroundScene);
  return {
    camera,
    optics,
    coverage: calculateProjectedCompositionCoverageByTarget(architectureForegroundScene, optics),
    evaluation: evaluateTask(task, architectureForegroundScene, camera, optics),
  };
};

const criterionPassed = (evaluation: ReturnType<typeof evaluateTask>, criterionId: string) =>
  evaluation.criteria.find((criterion) => criterion.criterionId === criterionId)?.passed;

describe("Architecture + Foreground Rise composition task", () => {
  it("keeps the Rise task isolated while the scene exposes cumulative capabilities", () => {
    expect(task).toBeDefined();
    expect(task?.sceneId).toBe(architectureForegroundScene.id);
    expect(task?.enabledControls).toEqual(["rise", "geometryView"]);
    expect(task?.constraints).toEqual({ movement: "rise-only" });
    expect(architectureForegroundScene.movementCapabilities).toEqual({
      available: ["frontRiseMm", "frontTiltDeg"],
      selectionMode: "multiple",
      defaultMovement: "frontRiseMm",
    });
    expect(architectureForegroundScene.cameraControlPolicy).toEqual({
      infinityReset: false,
    });
  });

  it("keeps the neutral roof cropped, retains the base, and fails before Rise is used", () => {
    const result = evaluateAtRise(0);

    expect(result.coverage["building-top"]).toBeLessThan(0.95);
    expect(result.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
    expect(result.evaluation.status).toBe("failed");
    expect(
      criterionPassed(result.evaluation, "architecture-foreground-rise-building-top-visible"),
    ).toBe(false);
    expect(
      criterionPassed(result.evaluation, "architecture-foreground-rise-building-base-visible"),
    ).toBe(true);
    expect(criterionPassed(result.evaluation, "architecture-foreground-rise-camera-level")).toBe(true);
    expect(criterionPassed(result.evaluation, "architecture-foreground-rise-movement-used")).toBe(false);
  });

  it("passes across nearby calibrated Rise steps instead of requiring one magic value", () => {
    expect(geometry.neutralCalibration.futureRiseMm).toBe(20);

    for (const frontRiseMm of [10, 11, geometry.neutralCalibration.futureRiseMm, 25]) {
      const result = evaluateAtRise(frontRiseMm);
      expect(result.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
      expect(result.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
      expect(result.evaluation.status).toBe("passed");
      expect(result.evaluation.criteria.every((criterion) => criterion.passed)).toBe(true);
    }
  });

  it("fails when the roof remains cropped or excessive Rise loses the base", () => {
    const roofStillCropped = evaluateAtRise(1);
    expect(roofStillCropped.evaluation.status).toBe("failed");
    expect(
      criterionPassed(
        roofStillCropped.evaluation,
        "architecture-foreground-rise-building-top-visible",
      ),
    ).toBe(false);

    const baseLost = evaluateAtRise(30);
    expect(baseLost.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
    expect(baseLost.coverage["building-base"]).toBeLessThan(0.95);
    expect(baseLost.evaluation.status).toBe("failed");
    expect(
      criterionPassed(baseLost.evaluation, "architecture-foreground-rise-building-base-visible"),
    ).toBe(false);
  });

  it("requires the camera and rear standard to remain level", () => {
    const pitchedRearStandard = evaluateAtRise(geometry.neutralCalibration.futureRiseMm, {
      rearTiltDeg: 1,
    });

    expect(pitchedRearStandard.evaluation.status).toBe("failed");
    expect(
      criterionPassed(pitchedRearStandard.evaluation, "architecture-foreground-rise-camera-level"),
    ).toBe(false);
  });

  it("preserves parallel verticals and the unresolved foreground softness after Rise", () => {
    const neutral = evaluateAtRise(0).optics;
    const solved = evaluateAtRise(geometry.neutralCalibration.futureRiseMm).optics;
    const project = (optics: typeof neutral, worldPoint: (typeof geometry.buildingVerticalEdges)[number]["bottom"]) =>
      projectWorldPointToFilmPlaneGroundGlass({
        worldPoint,
        lensCenterWorld: optics.lensCenterWorld,
        filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
      });

    for (const optics of [neutral, solved]) {
      for (const edge of geometry.buildingVerticalEdges) {
        expect(Math.abs(project(optics, edge.bottom).uRaw - project(optics, edge.top).uRaw)).toBeLessThan(1e-8);
      }
      expect(optics.diagnostics.tiltAngleDeg).toBe(0);
      expect(optics.diagnostics.swingAngleDeg).toBe(0);
    }

    const sharpness = Object.fromEntries(solved.focusTargets.map((target) => [target.id, target.sharpness]));
    expect(sharpness["foreground-near"]).toBeLessThan(sharpness["building-middle"]);
    expect(sharpness["building-middle"]).toBeGreaterThanOrEqual(0.8);
  });
});
