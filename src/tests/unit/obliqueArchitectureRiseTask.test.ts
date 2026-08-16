import { describe, expect, it } from "vitest";
import { calculateProjectedCompositionCoverageByTarget } from "../../core/optics/calculateCompositionCoverage";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import geometry, { reachableFrontRiseMm } from "../../scenes/obliqueArchitectureGeometry";
import type { CameraState } from "../../types/camera";
import type { SceneDefinition } from "../../types/scene";
import type { TaskDefinition } from "../../types/task";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const task = getTaskById("oblique-rise-01");

const cameraAtRise = (frontRiseMm: number): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...obliqueArchitectureScene.cameraPreset,
  activeSceneId: obliqueArchitectureScene.id,
  activeTaskId: task?.id ?? null,
  mode: "guided",
  frontRiseMm,
});

const cameraLevelRegressionTaskFor = (scene: SceneDefinition): TaskDefinition => ({
  id: `camera-level-regression-${scene.id}`,
  sceneId: scene.id,
  mode: "guided",
  enabledControls: [],
  constraints: {},
  criteria: [{ id: "camera-level-regression", type: "camera-level" }],
});

const cameraLevelPassed = (scene: SceneDefinition, camera: CameraState): boolean => {
  const optics = deriveOpticsState(camera, scene);
  const evaluation = evaluateTask(cameraLevelRegressionTaskFor(scene), scene, camera, optics);
  return evaluation.criteria[0]?.passed ?? false;
};

const evaluateAtRise = (frontRiseMm: number) => {
  if (!task) {
    throw new Error("oblique-rise-01 is not registered");
  }
  const camera = cameraAtRise(frontRiseMm);
  const optics = deriveOpticsState(camera, obliqueArchitectureScene);
  return {
    camera,
    optics,
    coverage: calculateProjectedCompositionCoverageByTarget(obliqueArchitectureScene, optics),
    evaluation: evaluateTask(task, obliqueArchitectureScene, camera, optics),
  };
};

describe("Oblique Architecture Rise composition task", () => {
  it("registers Front Rise as the only public solving control", () => {
    expect(task).toBeDefined();
    expect(task?.sceneId).toBe(obliqueArchitectureScene.id);
    expect(task?.enabledControls).toEqual(["rise", "geometryView"]);
    expect(task?.constraints).toEqual({ movement: "rise-only" });
    expect(obliqueArchitectureScene.movementCapabilities?.available).toEqual(["frontRiseMm"]);
    expect(obliqueArchitectureScene.cameraControlPolicy).toEqual({
      focusDistance: "fixed",
      aperture: "fixed",
      infinityReset: false,
    });
  });

  it("keeps the neutral roof cropped and the guided task incomplete", () => {
    const result = evaluateAtRise(0);
    expect(result.coverage["building-top"]).toBeLessThan(0.95);
    expect(result.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
    expect(result.evaluation.status).toBe("failed");
    expect(result.evaluation.criteria.find((criterion) => criterion.criterionId === "oblique-rise-building-top-visible")?.passed).toBe(false);
    expect(result.evaluation.criteria.find((criterion) => criterion.criterionId === "oblique-rise-camera-level")?.passed).toBe(true);
  });

  it("passes at the calibrated public Rise value without requiring an exact slider value", () => {
    const calibrated = evaluateAtRise(reachableFrontRiseMm);
    const nearby = evaluateAtRise(reachableFrontRiseMm - 1);

    expect(reachableFrontRiseMm).toBe(20);
    expect(calibrated.coverage["building-top"]).toBeGreaterThanOrEqual(0.95);
    expect(calibrated.coverage["building-base"]).toBeGreaterThanOrEqual(0.95);
    expect(calibrated.evaluation.status).toBe("passed");
    expect(calibrated.evaluation.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(calibrated.optics.rearStandardFrame).toEqual(
      evaluateAtRise(0).optics.rearStandardFrame,
    );
    expect(nearby.evaluation.status).toBe("passed");
  });

  it("uses rear-standard orientation, so front movements and rear translation remain level", () => {
    const validCamera = cameraAtRise(reachableFrontRiseMm);

    expect(cameraLevelPassed(obliqueArchitectureScene, { ...validCamera, frontSwingDeg: 4 })).toBe(true);
    expect(cameraLevelPassed(obliqueArchitectureScene, { ...validCamera, frontTiltDeg: 4 })).toBe(true);
    expect(cameraLevelPassed(obliqueArchitectureScene, { ...validCamera, rearRiseMm: 40 })).toBe(true);
  });

  it("fails when rear tilt or supported whole-camera pitch changes the derived level frame", () => {
    const validCamera = cameraAtRise(reachableFrontRiseMm);

    expect(cameraLevelPassed(obliqueArchitectureScene, { ...validCamera, rearTiltDeg: 4 })).toBe(false);

    const pitchedCamera: CameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...understandingCameraMovementsScene.cameraPreset,
      activeSceneId: understandingCameraMovementsScene.id,
      activeTaskId: null,
      mode: "guided",
      cameraBodyPitchDeg: 4,
    };
    expect(cameraLevelPassed(understandingCameraMovementsScene, pitchedCamera)).toBe(false);
  });

  it("keeps the oblique façade focus problem after Rise solves framing", () => {
    const optics = evaluateAtRise(reachableFrontRiseMm).optics;
    const sharpnessById = new Map(
      optics.focusTargets.map((target) => [target.id, target.sharpness]),
    );

    expect(optics.focusTargets).toHaveLength(3);
    expect(sharpnessById.get("facade-middle")).toBeGreaterThan(
      sharpnessById.get("facade-near") ?? 1,
    );
    expect(sharpnessById.get("facade-middle")).toBeGreaterThan(
      sharpnessById.get("facade-far") ?? 1,
    );
    expect(optics.focusTargets.some((target) => target.status !== "sharp")).toBe(true);
    expect(geometry.reachableFrontRiseMm).toBe(reachableFrontRiseMm);
  });
});
