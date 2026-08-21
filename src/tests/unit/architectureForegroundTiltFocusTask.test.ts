import { describe, expect, it } from "vitest";
import { calculateProjectedCompositionCoverageByTarget } from "../../core/optics/calculateCompositionCoverage";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import geometry from "../../scenes/architectureForegroundGeometry";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import type { CameraState } from "../../types/camera";
import { CAMERA_CONTROL_STEPS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const task = getTaskById("architecture-foreground-tilt-focus-01");

const cameraAt = (
  frontTiltDeg: number,
  focusDistanceMm: number,
  overrides: Partial<CameraState> = {},
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureForegroundScene.cameraPreset,
  activeSceneId: architectureForegroundScene.id,
  activeTaskId: task?.id ?? null,
  mode: "guided",
  frontRiseMm: geometry.neutralCalibration.futureRiseMm,
  frontTiltDeg,
  focusDistanceMm,
  ...overrides,
});

const evaluateAt = (
  frontTiltDeg: number,
  focusDistanceMm: number,
  overrides: Partial<CameraState> = {},
) => {
  if (!task) throw new Error("architecture-foreground-tilt-focus-01 is not registered");
  const camera = cameraAt(frontTiltDeg, focusDistanceMm, overrides);
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

describe("Architecture + Foreground Tilt + Focus task", () => {
  it("registers cumulative Free Practice capabilities and Tilt + Focus guided controls", () => {
    expect(task).toBeDefined();
    expect(task?.sceneId).toBe(architectureForegroundScene.id);
    expect(task?.enabledControls).toEqual(["tilt", "focusDistance", "geometryView"]);
    expect(task?.constraints).toEqual({});
    expect(task?.initialCameraState?.frontRiseMm).toBe(geometry.neutralCalibration.futureRiseMm);
    expect(task?.initialCameraState?.frontTiltDeg).toBe(0);
    expect(task?.initialCameraState?.focusDistanceMm).toBe(geometry.canonicalFocusDistanceMm);
    expect(task?.initialCameraState?.aperture).toBe(architectureForegroundScene.cameraPreset.aperture);
    expect(architectureForegroundScene.movementCapabilities).toEqual({
      available: ["frontRiseMm", "frontTiltDeg"],
      selectionMode: "multiple",
      defaultMovement: "frontRiseMm",
    });
    expect(architectureForegroundScene.cameraControlPolicy).toEqual({
      aperture: "fixed",
      infinityReset: false,
    });
  });

  it("starts composition-solved but leaves the near foreground unresolved", () => {
    const result = evaluateAt(0, geometry.canonicalFocusDistanceMm);
    const near = result.optics.focusTargets.find((target) => target.id === "foreground-near");
    const building = result.optics.focusTargets.find((target) => target.id === "building-middle");

    expect(result.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
    expect(result.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
    expect(result.evaluation.status).toBe("failed");
    expect(near?.sharpness).toBeLessThan(geometry.neutralCalibration.tiltFocusSharpnessMinimum);
    expect(building?.sharpness).toBeGreaterThanOrEqual(0.8);
    expect(criterionPassed(result.evaluation, "architecture-foreground-tilt-focus-focus-used")).toBe(false);
    expect(criterionPassed(result.evaluation, "architecture-foreground-tilt-focus-near-sharp")).toBe(false);
    expect(criterionPassed(result.evaluation, "architecture-foreground-tilt-focus-building-sharp")).toBe(true);
  });

  it.each([
    ["focus-only", 0, 6830],
    ["tilt-only", 2, geometry.canonicalFocusDistanceMm],
  ])("fails the %s negative probe", (_label, frontTiltDeg, focusDistanceMm) => {
    const result = evaluateAt(frontTiltDeg, focusDistanceMm);
    expect(result.evaluation.status).toBe("failed");
    expect(criterionPassed(result.evaluation, "architecture-foreground-tilt-focus-near-sharp")).toBe(false);
  });

  it("passes the canonical and nearby calibrated Tilt + Focus states", () => {
    const candidates = [
      [geometry.neutralCalibration.publicTiltFocusSolutionDeg, geometry.neutralCalibration.publicTiltFocusFocusDistanceMm],
      [1.8, 6750],
      [2.2, 6930],
    ] as const;

    for (const [frontTiltDeg, focusDistanceMm] of candidates) {
      const result = evaluateAt(frontTiltDeg, focusDistanceMm);
      expect(result.evaluation.status).toBe("passed");
      expect(result.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
      expect(result.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
      expect(result.evaluation.criteria.every((criterion) => criterion.passed)).toBe(true);
    }
  });

  it("rejects excessive Tilt, lost composition, and a non-level rear standard", () => {
    const excessive = evaluateAt(4, geometry.canonicalFocusDistanceMm);
    expect(excessive.evaluation.status).toBe("failed");
    expect(criterionPassed(excessive.evaluation, "architecture-foreground-tilt-focus-building-sharp")).toBe(false);

    const roofLost = evaluateAt(geometry.neutralCalibration.publicTiltFocusSolutionDeg, geometry.neutralCalibration.publicTiltFocusFocusDistanceMm, {
      frontRiseMm: 0,
    });
    expect(roofLost.coverage["building-top"]).toBeLessThan(0.95);
    expect(criterionPassed(roofLost.evaluation, "architecture-foreground-tilt-focus-building-top-visible")).toBe(false);

    const rearTilted = evaluateAt(
      geometry.neutralCalibration.publicTiltFocusSolutionDeg,
      geometry.neutralCalibration.publicTiltFocusFocusDistanceMm,
      { rearTiltDeg: 1 },
    );
    expect(rearTilted.evaluation.status).toBe("failed");
    expect(criterionPassed(rearTilted.evaluation, "architecture-foreground-tilt-focus-camera-level")).toBe(false);
  });

  it("keeps parallel verticals, fixed aperture, and a residual finite-DOF problem", () => {
    const result = evaluateAt(
      geometry.neutralCalibration.publicTiltFocusSolutionDeg,
      geometry.neutralCalibration.publicTiltFocusFocusDistanceMm,
    );
    const project = (worldPoint: (typeof geometry.buildingVerticalEdges)[number]["bottom"]) =>
      projectWorldPointToFilmPlaneGroundGlass({
        worldPoint,
        lensCenterWorld: result.optics.lensCenterWorld,
        filmPlaneCornersWorld: result.optics.filmPlaneCornersWorld,
      });

    for (const edge of geometry.buildingVerticalEdges) {
      expect(Math.abs(project(edge.bottom).uRaw - project(edge.top).uRaw)).toBeLessThan(1e-8);
    }
    expect(result.optics.diagnostics.tiltAngleDeg).toBe(geometry.neutralCalibration.publicTiltFocusSolutionDeg);
    expect(result.optics.diagnostics.swingAngleDeg).toBe(0);
    expect(result.camera.rearTiltDeg).toBe(0);
    expect(result.camera.aperture).toBe(architectureForegroundScene.cameraPreset.aperture);

    const sharpness = Object.fromEntries(result.optics.focusTargets.map((target) => [target.id, target.sharpness]));
    expect(sharpness["foreground-near"]).toBeGreaterThanOrEqual(geometry.neutralCalibration.tiltFocusSharpnessMinimum);
    expect(sharpness["building-middle"]).toBeGreaterThanOrEqual(geometry.neutralCalibration.tiltFocusSharpnessMinimum);
    expect(sharpness["building-base"]).toBeLessThan(geometry.neutralCalibration.tiltFocusSharpnessMinimum);
    expect(sharpness["foreground-middle"]).toBeLessThan(geometry.neutralCalibration.tiltFocusSharpnessMinimum);
    expect(CAMERA_CONTROL_STEPS.tiltDeg).toBe(0.1);
    expect(CAMERA_CONTROL_STEPS.focusDistanceMm).toBe(10);
  });
});
