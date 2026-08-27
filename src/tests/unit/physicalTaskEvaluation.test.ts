import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  evaluateFocusTargets,
  resolvePhysicalTaskPatchSharpness,
} from "../../core/tasks/evaluateFocusTargets";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { taskRegistry } from "../../core/tasks/taskRegistry";
import { resolvePhysicalFocusTargetPresentationMetric } from "../../render/postprocessing/FocusAssistPass";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import architectureForegroundGeometry from "../../scenes/architectureForegroundGeometry";
import obliqueArchitectureGeometry from "../../scenes/obliqueArchitectureGeometry";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import type { CameraState } from "../../types/camera";
import type { FocusTargetSharpness } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraFor = (
  scene: SceneDefinition,
  overrides: Partial<CameraState> = {},
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...scene.cameraPreset,
  activeSceneId: scene.id,
  mode: "guided",
  ...overrides,
});

const focusCriteriaInventory = Object.values(taskRegistry).flatMap((task) =>
  task.criteria.flatMap((criterion) =>
    criterion.type === "focus-targets-sharp"
      ? [{
          taskId: task.id,
          criterionId: criterion.id,
          targetIds: criterion.targetIds,
          minimumSharpness: criterion.minimumSharpness,
        }]
      : [],
  ),
);

const evaluateSingleFocusCriterion = (
  target: FocusTargetSharpness,
): ReturnType<typeof evaluateTask> => {
  const task = taskRegistry["swing-01"];
  const criterion = task.criteria.find((entry) => entry.id === "swing-front-sharp");
  if (!criterion || criterion.type !== "focus-targets-sharp") {
    throw new Error("swing-01 focus criterion is not registered");
  }
  const camera = cameraFor(shelfSwingScene);
  const optics = deriveOpticsState(camera, shelfSwingScene);
  return evaluateTask(
    { ...task, criteria: [criterion] },
    shelfSwingScene,
    camera,
    { ...optics, focusTargets: [target] },
  );
};

const syntheticTarget = (
  overrides: Partial<FocusTargetSharpness> = {},
): FocusTargetSharpness => ({
  id: "shelf-front",
  distanceToFocusPlaneMm: 0,
  sharpness: 0.2,
  status: "soft",
  physicalPatchSharpness: 0.9,
  physicalPatchStatus: "sharp",
  patchEquivalentCoCDiameterMm: 0.01,
  ...overrides,
});

const canonicalTaskStates: Array<{
  taskId: string;
  scene: SceneDefinition;
  camera: Partial<CameraState>;
}> = [
  {
    taskId: "architecture-foreground-tilt-focus-01",
    scene: architectureForegroundScene,
    camera: {
      frontRiseMm: architectureForegroundGeometry.neutralCalibration.futureRiseMm,
      frontTiltDeg: architectureForegroundGeometry.neutralCalibration.publicTiltFocusSolutionDeg,
      focusDistanceMm:
        architectureForegroundGeometry.neutralCalibration.publicTiltFocusFocusDistanceMm,
      aperture: 11,
    },
  },
  {
    taskId: "architecture-foreground-dof-01",
    scene: architectureForegroundScene,
    camera: {
      frontRiseMm: architectureForegroundGeometry.neutralCalibration.futureRiseMm,
      frontTiltDeg: architectureForegroundGeometry.neutralCalibration.publicTiltFocusSolutionDeg,
      focusDistanceMm:
        architectureForegroundGeometry.neutralCalibration.publicTiltFocusFocusDistanceMm,
      aperture: 32,
    },
  },
  {
    taskId: "architecture-foreground-compound-01",
    scene: architectureForegroundScene,
    camera: {
      frontRiseMm: architectureForegroundGeometry.neutralCalibration.futureRiseMm,
      frontTiltDeg: architectureForegroundGeometry.neutralCalibration.publicTiltFocusSolutionDeg,
      focusDistanceMm:
        architectureForegroundGeometry.neutralCalibration.publicTiltFocusFocusDistanceMm,
      aperture: 32,
    },
  },
  {
    taskId: "oblique-swing-focus-01",
    scene: obliqueArchitectureScene,
    camera: {
      frontRiseMm: obliqueArchitectureGeometry.reachableFrontRiseMm,
      frontSwingDeg: obliqueArchitectureGeometry.reachableFrontSwingDeg,
      focusDistanceMm: obliqueArchitectureGeometry.reachableFacadeFocusDistanceMm,
    },
  },
  {
    taskId: "oblique-compound-01",
    scene: obliqueArchitectureScene,
    camera: {
      frontRiseMm: obliqueArchitectureGeometry.reachableFrontRiseMm,
      frontSwingDeg: obliqueArchitectureGeometry.reachableFrontSwingDeg,
      focusDistanceMm: obliqueArchitectureGeometry.reachableFacadeFocusDistanceMm,
    },
  },
  {
    taskId: "tilt-01",
    scene: tableTiltScene,
    camera: {
      frontTiltDeg: tableTiltGeometry.tableTiltCalibration.frontTiltDeg,
      focusDistanceMm: 6130,
      aperture: 11,
    },
  },
  {
    taskId: "swing-01",
    scene: shelfSwingScene,
    camera: {
      frontSwingDeg: shelfSwingGeometry.shelfSwingCalibration.controlSolution.frontSwingDeg,
      focusDistanceMm: shelfSwingGeometry.shelfSwingCalibration.controlSolution.focusDistanceMm,
      aperture: 11,
    },
  },
];

describe("physical guided-task focus evaluation", () => {
  it("inventories every production focus-targets-sharp criterion", () => {
    expect(focusCriteriaInventory).toEqual([
      {
        taskId: "architecture-foreground-tilt-focus-01",
        criterionId: "architecture-foreground-tilt-focus-near-sharp",
        targetIds: ["foreground-near"],
        minimumSharpness: 0.7,
      },
      {
        taskId: "architecture-foreground-tilt-focus-01",
        criterionId: "architecture-foreground-tilt-focus-building-sharp",
        targetIds: ["building-middle"],
        minimumSharpness: 0.7,
      },
      {
        taskId: "architecture-foreground-dof-01",
        criterionId: "architecture-foreground-dof-focus-targets",
        targetIds: ["foreground-near", "foreground-middle", "building-base", "building-middle"],
        minimumSharpness: 0.5,
      },
      {
        taskId: "architecture-foreground-compound-01",
        criterionId: "architecture-foreground-compound-focus-targets",
        targetIds: ["foreground-near", "foreground-middle", "building-base", "building-middle"],
        minimumSharpness: 0.5,
      },
      {
        taskId: "oblique-swing-focus-01",
        criterionId: "oblique-swing-focus-near-sharp",
        targetIds: ["facade-near"],
        minimumSharpness: 0.8,
      },
      {
        taskId: "oblique-swing-focus-01",
        criterionId: "oblique-swing-focus-middle-sharp",
        targetIds: ["facade-middle"],
        minimumSharpness: 0.8,
      },
      {
        taskId: "oblique-swing-focus-01",
        criterionId: "oblique-swing-focus-far-sharp",
        targetIds: ["facade-far"],
        minimumSharpness: 0.8,
      },
      {
        taskId: "oblique-compound-01",
        criterionId: "oblique-compound-near-sharp",
        targetIds: ["facade-near"],
        minimumSharpness: 0.8,
      },
      {
        taskId: "oblique-compound-01",
        criterionId: "oblique-compound-middle-sharp",
        targetIds: ["facade-middle"],
        minimumSharpness: 0.8,
      },
      {
        taskId: "oblique-compound-01",
        criterionId: "oblique-compound-far-sharp",
        targetIds: ["facade-far"],
        minimumSharpness: 0.8,
      },
      {
        taskId: "tilt-01",
        criterionId: "tilt-near-sharp",
        targetIds: ["near-cup"],
        minimumSharpness: 0.8,
      },
      {
        taskId: "tilt-01",
        criterionId: "tilt-mid-sharp",
        targetIds: ["mid-notebook"],
        minimumSharpness: 0.8,
      },
      {
        taskId: "tilt-01",
        criterionId: "tilt-far-sharp",
        targetIds: ["far-book"],
        minimumSharpness: 0.8,
      },
      {
        taskId: "swing-01",
        criterionId: "swing-front-sharp",
        targetIds: ["shelf-front"],
        minimumSharpness: 0.8,
      },
      {
        taskId: "swing-01",
        criterionId: "swing-middle-sharp",
        targetIds: ["shelf-middle"],
        minimumSharpness: 0.8,
      },
      {
        taskId: "swing-01",
        criterionId: "swing-back-sharp",
        targetIds: ["shelf-back"],
        minimumSharpness: 0.8,
      },
    ]);
  });

  it("uses physical patch sharpness for both pass/fail and criterion score", () => {
    const legacyPassingPhysicalFailing = syntheticTarget({
      sharpness: 0.95,
      status: "sharp",
      physicalPatchSharpness: 0.35,
      physicalPatchStatus: "soft",
      patchEquivalentCoCDiameterMm: 0.065,
    });
    const legacyFailingPhysicalPassing = syntheticTarget({
      physicalPatchSharpness: 0.9,
      physicalPatchStatus: "sharp",
      patchEquivalentCoCDiameterMm: 0.01,
    });

    const failing = evaluateSingleFocusCriterion(legacyPassingPhysicalFailing);
    const passing = evaluateSingleFocusCriterion(legacyFailingPhysicalPassing);

    expect(failing.criteria[0]).toMatchObject({ passed: false, score: 0.35 });
    expect(failing.status).toBe("failed");
    expect(passing.criteria[0]).toMatchObject({ passed: true, score: 0.9 });
    expect(passing.status).toBe("passed");
  });

  it("fails closed for missing, non-finite, or invalid physical metrics", () => {
    const cases = [
      syntheticTarget({ physicalPatchSharpness: undefined, patchEquivalentCoCDiameterMm: undefined }),
      syntheticTarget({ physicalPatchSharpness: Number.NaN, patchEquivalentCoCDiameterMm: 0.01 }),
      syntheticTarget({ physicalPatchSharpness: 0.9, patchEquivalentCoCDiameterMm: null }),
    ];

    cases.forEach((target) => {
      expect(resolvePhysicalTaskPatchSharpness(target)).toBeNull();
      expect(evaluateFocusTargets([target], [target.id], 0.8)).toBe(false);
      const evaluation = evaluateSingleFocusCriterion(target);
      expect(evaluation.status).toBe("failed");
      expect(evaluation.criteria[0].score).toBe(0);
      expect(Number.isFinite(evaluation.criteria[0].score)).toBe(true);
    });
  });

  it("keeps physical presentation and task evaluation on the same derived field", () => {
    const camera = cameraFor(shelfSwingScene, {
      frontSwingDeg: shelfSwingGeometry.shelfSwingCalibration.controlSolution.frontSwingDeg,
      focusDistanceMm: shelfSwingGeometry.shelfSwingCalibration.controlSolution.focusDistanceMm,
    });
    const optics = deriveOpticsState(camera, shelfSwingScene);
    optics.focusTargets.forEach((target) => {
      expect(resolvePhysicalFocusTargetPresentationMetric(target, "patch").sharpness).toBe(
        resolvePhysicalTaskPatchSharpness(target),
      );
    });
  });

  it("keeps every inventoried canonical public solution reachable", () => {
    canonicalTaskStates.forEach(({ taskId, scene, camera: overrides }) => {
      const task = taskRegistry[taskId];
      const camera = cameraFor(scene, { ...overrides, activeTaskId: taskId });
      const optics = deriveOpticsState(camera, scene);
      const evaluation = evaluateTask(task, scene, camera, optics);
      expect(evaluation.status, taskId).toBe("passed");
      expect(
        evaluation.criteria
          .filter((criterion) => task.criteria.some(
            (entry) => entry.id === criterion.criterionId && entry.type === "focus-targets-sharp",
          ))
          .every((criterion) => criterion.passed),
        taskId,
      ).toBe(true);
      task.criteria
        .filter((criterion) => criterion.type === "focus-targets-sharp")
        .forEach((criterion) => {
          const expectedScore = Math.min(
            ...criterion.targetIds.map((targetId) =>
              resolvePhysicalTaskPatchSharpness(
                optics.focusTargets.find((target) => target.id === targetId),
              ) ?? 0,
            ),
          );
          expect(
            evaluation.criteria.find((entry) => entry.criterionId === criterion.id)?.score,
            `${taskId}:${criterion.id}`,
          ).toBeCloseTo(expectedScore, 12);
        });
      optics.focusTargets.forEach((target) => {
        expect(resolvePhysicalTaskPatchSharpness(target)).not.toBeNull();
      });
    });
  });

  it("keeps the Architecture + Foreground passing states out of Soft presentation", () => {
    for (const taskId of ["architecture-foreground-dof-01", "architecture-foreground-compound-01"]) {
      const task = taskRegistry[taskId];
      const camera = cameraFor(architectureForegroundScene, {
        activeTaskId: taskId,
        frontRiseMm: architectureForegroundGeometry.neutralCalibration.futureRiseMm,
        frontTiltDeg: architectureForegroundGeometry.neutralCalibration.publicTiltFocusSolutionDeg,
        focusDistanceMm:
          architectureForegroundGeometry.neutralCalibration.publicTiltFocusFocusDistanceMm,
        aperture: 32,
      });
      const optics = deriveOpticsState(camera, architectureForegroundScene);

      expect(evaluateTask(task, architectureForegroundScene, camera, optics).status).toBe("passed");
      task.criteria
        .filter((criterion) => criterion.type === "focus-targets-sharp")
        .flatMap((criterion) => criterion.targetIds)
        .forEach((targetId) => {
          const target = optics.focusTargets.find((entry) => entry.id === targetId);
          expect(target?.physicalPatchStatus, `${taskId}:${targetId}`).not.toBe("soft");
          expect(target?.physicalPatchSharpness, `${taskId}:${targetId}`).toBeGreaterThanOrEqual(0.5);
        });
    }
  });

  it("keeps meaningful wrong-focus and incomplete-movement controls from passing", () => {
    const negativeCases: Array<{
      taskId: string;
      scene: SceneDefinition;
      camera: Partial<CameraState>;
    }> = [
      {
        taskId: "architecture-foreground-tilt-focus-01",
        scene: architectureForegroundScene,
        camera: {
          frontRiseMm: 20,
          frontTiltDeg: 0,
          focusDistanceMm: 6830,
          aperture: 11,
        },
      },
      {
        taskId: "architecture-foreground-dof-01",
        scene: architectureForegroundScene,
        camera: {
          frontRiseMm: 20,
          frontTiltDeg: 2,
          focusDistanceMm: 5000,
          aperture: 32,
        },
      },
      {
        taskId: "architecture-foreground-compound-01",
        scene: architectureForegroundScene,
        camera: {
          frontRiseMm: 20,
          frontTiltDeg: 2,
          focusDistanceMm: 5000,
          aperture: 32,
        },
      },
      {
        taskId: "oblique-swing-focus-01",
        scene: obliqueArchitectureScene,
        camera: {
          frontRiseMm: 20,
          frontSwingDeg: 0,
          focusDistanceMm: obliqueArchitectureGeometry.reachableFacadeFocusDistanceMm,
        },
      },
      {
        taskId: "oblique-compound-01",
        scene: obliqueArchitectureScene,
        camera: {
          frontRiseMm: 20,
          frontSwingDeg: obliqueArchitectureGeometry.reachableFrontSwingDeg,
          focusDistanceMm: obliqueArchitectureGeometry.canonicalFocusDistanceMm,
        },
      },
      {
        taskId: "tilt-01",
        scene: tableTiltScene,
        camera: {
          frontTiltDeg: tableTiltGeometry.tableTiltCalibration.frontTiltDeg,
          focusDistanceMm: 2000,
          aperture: 11,
        },
      },
      {
        taskId: "swing-01",
        scene: shelfSwingScene,
        camera: {
          frontSwingDeg: -4,
          focusDistanceMm: 2000,
          aperture: 11,
        },
      },
    ];

    negativeCases.forEach(({ taskId, scene, camera: overrides }) => {
      const task = taskRegistry[taskId];
      const camera = cameraFor(scene, { ...overrides, activeTaskId: taskId });
      const optics = deriveOpticsState(camera, scene);
      expect(evaluateTask(task, scene, camera, optics).status, taskId).toBe("failed");
      const focusCriteria = task.criteria.filter((criterion) => criterion.type === "focus-targets-sharp");
      focusCriteria.forEach((criterion) => {
        expect(
          evaluateTask(task, scene, camera, optics).criteria.find(
            (entry) => entry.criterionId === criterion.id,
          )?.passed,
          `${taskId}:${criterion.id}`,
        ).toBe(false);
      });
    });
  });

  it("responds monotonically to aperture through the physical task metric", () => {
    const task = taskRegistry["architecture-foreground-dof-01"];
    const scores = [11, 22, 32].map((aperture) => {
      const camera = cameraFor(architectureForegroundScene, {
        activeTaskId: task.id,
        frontRiseMm: 20,
        frontTiltDeg: 2,
        focusDistanceMm: 6830,
        aperture: aperture as CameraState["aperture"],
      });
      const optics = deriveOpticsState(camera, architectureForegroundScene);
      return evaluateTask(task, architectureForegroundScene, camera, optics).criteria.find(
        (criterion) => criterion.criterionId === "architecture-foreground-dof-focus-targets",
      )!.score;
    });

    expect(scores[0]).toBeLessThan(scores[1]);
    expect(scores[1]).toBeLessThan(scores[2]);
  });
});
