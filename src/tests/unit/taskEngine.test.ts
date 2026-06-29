import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { calculateCompositionCoverage, calculateCompositionCoverageByTarget } from "../../core/optics/calculateCompositionCoverage";
import { calculateGroundGlassFrameBoundsAtZ } from "../../core/tasks/calculateGroundGlassFrameBounds";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { evaluateFocusTargets } from "../../core/tasks/evaluateFocusTargets";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import type { CameraState } from "../../types/camera";
import type { SceneDefinition } from "../../types/scene";
import type { TaskDefinition } from "../../types/task";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const buildCustomTask = (): TaskDefinition => ({
  id: "custom-task",
  sceneId: tableTiltScene.id,
  title: "Custom evaluator task",
  mode: "guided",
  enabledControls: ["tilt", "focusDistance", "aperture", "geometryView"],
  constraints: {
    movement: "tilt-only",
    notes: ["Custom criteria for unit test"],
  },
  criteria: [
    {
      id: "c-aperture",
      label: "Allowed aperture",
      type: "allowed-aperture",
      allowedApertures: [11, 22],
    },
    {
      id: "c-tilt-used",
      label: "Tilt used",
      type: "movement-used",
      movement: "tilt",
      minimumAbs: 1.5,
    },
    {
      id: "c-tilt-range",
      label: "Tilt range",
      type: "movement-range",
      movement: "tilt",
      min: 1.5,
      max: 8,
    },
    {
      id: "c-focus",
      label: "Near target sharp",
      type: "focus-targets-sharp",
      targetIds: ["near-cup"],
      minimumSharpness: 0,
    },
  ],
  feedbackRules: {
    passPrimary: "Pass",
    defaultFailPrimary: "Default fail",
    failPrimaryByCriterionId: {
      "c-aperture": "Aperture fail",
      "c-tilt-used": "Tilt used fail",
      "c-tilt-range": "Tilt range fail",
      "c-focus": "Focus fail",
    },
    failSecondaryByCriterionId: {
      "c-aperture": "Aperture hint",
      "c-tilt-used": "Tilt used hint",
      "c-tilt-range": "Tilt range hint",
      "c-focus": "Focus hint",
    },
  },
});

describe("task engine", () => {
  it("registers rise/tilt/swing task definitions", () => {
    expect(getTaskById("rise-01")?.id).toBe("rise-01");
    expect(getTaskById("tilt-01")?.id).toBe("tilt-01");
    expect(getTaskById("swing-01")?.id).toBe("swing-01");
  });

  it("checks specified focus targets against sharpness threshold", () => {
    expect(
      evaluateFocusTargets(
        [
          { id: "a", distanceToFocusPlaneMm: 0, acceptableRangeMm: 10, sharpness: 0.9, status: "sharp" },
          { id: "b", distanceToFocusPlaneMm: 1, acceptableRangeMm: 10, sharpness: 0.7, status: "acceptable" },
        ],
        ["a"],
        0.8,
      ),
    ).toBe(true);
    expect(
      evaluateFocusTargets(
        [
          { id: "a", distanceToFocusPlaneMm: 0, acceptableRangeMm: 10, sharpness: 0.9, status: "sharp" },
          { id: "b", distanceToFocusPlaneMm: 1, acceptableRangeMm: 10, sharpness: 0.7, status: "acceptable" },
        ],
        ["a", "b"],
        0.8,
      ),
    ).toBe(false);
  });

  it("computes frame bounds and composition coverage by target", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, tableTiltScene);
    const z = (tableTiltScene.compositionTargets[0].worldBounds.min.z + tableTiltScene.compositionTargets[0].worldBounds.max.z) / 2;
    const frame = calculateGroundGlassFrameBoundsAtZ(opticsState, z);
    expect(frame.maxX).toBeGreaterThan(frame.minX);
    expect(frame.maxY).toBeGreaterThan(frame.minY);

    const byTarget = calculateCompositionCoverageByTarget(tableTiltScene, opticsState);
    expect(byTarget["table-surface"]).toBeGreaterThanOrEqual(0);
    expect(byTarget["table-surface"]).toBeLessThanOrEqual(1);
    const total = calculateCompositionCoverage(tableTiltScene, opticsState);
    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(1);
  });

  it("scores tasks by passed criteria ratio and requires all criteria to pass", () => {
    const task = buildCustomTask();
    const passingCamera: CameraState = {
      ...DEFAULT_CAMERA_STATE,
      activeSceneId: tableTiltScene.id,
      aperture: 11,
      frontTiltDeg: 2,
    };
    const passingOptics = deriveOpticsState(passingCamera, tableTiltScene);
    const passing = evaluateTask(task, tableTiltScene, passingCamera, passingOptics);
    expect(passing.status).toBe("passed");
    expect(passing.score).toBe(100);

    const failingCamera: CameraState = {
      ...passingCamera,
      aperture: 32,
      frontTiltDeg: 0,
    };
    const failingOptics = deriveOpticsState(failingCamera, tableTiltScene);
    const failing = evaluateTask(task, tableTiltScene, failingCamera, failingOptics);
    expect(failing.status).toBe("failed");
    expect(failing.score).toBeLessThan(100);
  });

  it("prioritizes first failed criterion for primary feedback and only one secondary hint", () => {
    const task = buildCustomTask();
    const camera: CameraState = {
      ...DEFAULT_CAMERA_STATE,
      activeSceneId: tableTiltScene.id,
      aperture: 32,
      frontTiltDeg: 0,
    };
    const optics = deriveOpticsState(camera, tableTiltScene);
    const evaluation = evaluateTask(task, tableTiltScene, camera, optics);
    expect(evaluation.primaryFeedback).toBe("Aperture fail");
    expect(evaluation.secondaryFeedback).toEqual(["Aperture hint"]);
  });

  it("enforces tilt task f/32 restriction", () => {
    const tiltTask = getTaskById("tilt-01") as TaskDefinition;
    const camera: CameraState = {
      ...DEFAULT_CAMERA_STATE,
      activeSceneId: tableTiltScene.id,
      aperture: 32,
      frontTiltDeg: 2,
    };
    const optics = deriveOpticsState(camera, tableTiltScene);
    const evaluation = evaluateTask(tiltTask, tableTiltScene, camera, optics);
    const apertureCriterion = evaluation.criteria.find((criterion) => criterion.criterionId === "tilt-allowed-aperture");
    expect(apertureCriterion?.passed).toBe(false);
  });

  it("evaluates composition-visible criterion with projection relation", () => {
    const optics = deriveOpticsState(DEFAULT_CAMERA_STATE, tableTiltScene);
    const coverageByTarget = calculateCompositionCoverageByTarget(tableTiltScene, optics);
    const scene: SceneDefinition = {
      ...tableTiltScene,
      compositionTargets: [
        {
          id: "tiny-target",
          label: "tiny",
          worldBounds: {
            min: { x: -10, y: 830, z: 2200 },
            max: { x: 10, y: 850, z: 2220 },
          },
        },
      ],
    };
    const task: TaskDefinition = {
      ...buildCustomTask(),
      criteria: [
        {
          id: "c-composition",
          label: "Composition visible",
          type: "composition-visible",
          targetId: "tiny-target",
          minimumCoverage: 0.5,
        },
      ],
    };
    const evaluation = evaluateTask(task, scene, DEFAULT_CAMERA_STATE, optics);
    expect(evaluation.criteria[0].score).toBeGreaterThanOrEqual(0);
    expect(coverageByTarget["table-surface"]).toBeGreaterThanOrEqual(0);
  });
});
