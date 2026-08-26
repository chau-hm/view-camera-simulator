import { describe, expect, it } from "vitest";
import { calculateProjectedCompositionCoverageByTarget } from "../../core/optics/calculateCompositionCoverage";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import geometry from "../../scenes/architectureForegroundGeometry";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import type { ApertureValue, CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const task = getTaskById("architecture-foreground-compound-01");

const cameraAt = (
  frontRiseMm: number,
  frontTiltDeg: number,
  focusDistanceMm: number,
  aperture: ApertureValue,
  overrides: Partial<CameraState> = {},
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureForegroundScene.cameraPreset,
  activeSceneId: architectureForegroundScene.id,
  activeTaskId: task?.id ?? null,
  mode: "guided",
  frontRiseMm,
  frontTiltDeg,
  focusDistanceMm,
  aperture,
  ...overrides,
});

const evaluateAt = (
  frontRiseMm: number,
  frontTiltDeg: number,
  focusDistanceMm: number,
  aperture: ApertureValue,
  overrides: Partial<CameraState> = {},
) => {
  if (!task) throw new Error("architecture-foreground-compound-01 is not registered");
  const camera = cameraAt(frontRiseMm, frontTiltDeg, focusDistanceMm, aperture, overrides);
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

const focusSharpness = (result: ReturnType<typeof evaluateAt>) =>
  Object.fromEntries(
    result.optics.focusTargets.map((target) => [target.id, target.physicalPatchSharpness ?? 0]),
  );

const canonicalFocus = geometry.neutralCalibration.publicTiltFocusFocusDistanceMm;

describe("Architecture + Foreground compound task", () => {
  it("registers the neutral compound task and exposes all solving controls", () => {
    expect(task).toBeDefined();
    expect(task?.sceneId).toBe(architectureForegroundScene.id);
    expect(task?.enabledControls).toEqual([
      "rise",
      "tilt",
      "focusDistance",
      "aperture",
      "geometryView",
    ]);
    expect(task?.constraints).toEqual({});
    expect(task?.initialCameraState).toMatchObject({
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      aperture: 11,
      geometryView: "side",
    });
    expect(task?.enabledControls).not.toContain("swing");
  });

  it("fails at neutral and at each partial photographic solution", () => {
    const candidates = [
      evaluateAt(0, 0, geometry.canonicalFocusDistanceMm, 11),
      evaluateAt(20, 0, geometry.canonicalFocusDistanceMm, 11),
      evaluateAt(20, 2, geometry.canonicalFocusDistanceMm, 11),
      evaluateAt(20, 2, canonicalFocus, 11),
    ];

    expect(candidates[0].coverage["building-top"]).toBeLessThan(0.95);
    expect(candidates[0].coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
    for (const result of candidates) {
      expect(result.evaluation.status).toBe("failed");
      expect(criterionPassed(result.evaluation, "architecture-foreground-compound-focus-targets")).toBe(false);
    }

    expect(candidates[1].coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
    expect(candidates[1].coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
    expect(focusSharpness(candidates[2])["foreground-near"]).toBeLessThan(0.6);
    expect(focusSharpness(candidates[3])["foreground-middle"]).toBeLessThan(0.6);
    expect(focusSharpness(candidates[3])["building-base"]).toBeLessThan(0.6);
  });

  it("passes the canonical and nearby outcome-based solutions", () => {
    const candidates = [
      evaluateAt(20, 2, canonicalFocus, 22),
      evaluateAt(20, 1.8, 6750, 22),
      evaluateAt(25, 2.2, 6930, 22),
    ];

    for (const result of candidates) {
      expect(result.evaluation.status).toBe("passed");
      expect(result.evaluation.criteria.every((criterion) => criterion.passed)).toBe(true);
      expect(result.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
      expect(result.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
      expect(Math.abs(result.optics.diagnostics.tiltAngleDeg)).toBeGreaterThan(0);
    }
  });

  it("rejects excessive Rise and non-level rear-standard state", () => {
    const excessiveRise = evaluateAt(40, 2, canonicalFocus, 22);
    expect(excessiveRise.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
    expect(excessiveRise.coverage["building-base"]).toBeLessThan(0.95);
    expect(excessiveRise.evaluation.status).toBe("failed");
    expect(
      criterionPassed(excessiveRise.evaluation, "architecture-foreground-compound-building-base-visible"),
    ).toBe(false);

    const rearTilted = evaluateAt(20, 2, canonicalFocus, 22, { rearTiltDeg: 1 });
    expect(rearTilted.evaluation.status).toBe("failed");
    expect(criterionPassed(rearTilted.evaluation, "architecture-foreground-compound-camera-level")).toBe(false);
  });

  it("rejects a clearly wrong focus even at the smallest supported aperture", () => {
    const wrongFocus = evaluateAt(20, 2, 5000, 32);

    expect(wrongFocus.evaluation.status).toBe("failed");
    expect(criterionPassed(wrongFocus.evaluation, "architecture-foreground-compound-focus-targets")).toBe(false);
    expect(focusSharpness(wrongFocus)["foreground-middle"]).toBeLessThan(0.4);
    expect(focusSharpness(wrongFocus)["building-base"]).toBeLessThan(0.4);
  });

  it("preserves parallel verticals and a level rear standard at the canonical solution", () => {
    const result = evaluateAt(20, 2, canonicalFocus, 22);
    const project = (worldPoint: (typeof geometry.buildingVerticalEdges)[number]["bottom"]) =>
      projectWorldPointToFilmPlaneGroundGlass({
        worldPoint,
        lensCenterWorld: result.optics.lensCenterWorld,
        filmPlaneCornersWorld: result.optics.filmPlaneCornersWorld,
      });

    for (const edge of geometry.buildingVerticalEdges) {
      expect(Math.abs(project(edge.bottom).uRaw - project(edge.top).uRaw)).toBeLessThan(1e-8);
    }
    expect(result.optics.rearStandardFrame.centerWorld.y).toBe(0);
    expect(result.camera.rearTiltDeg).toBe(0);
    expect(result.camera.frontSwingDeg).toBe(0);
    expect(result.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
    expect(result.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
    expect(Object.values(focusSharpness(result)).every(
      (sharpness) => sharpness >= geometry.neutralCalibration.dofSharpnessMinimum,
    )).toBe(true);
  });
});
