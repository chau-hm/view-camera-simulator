import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import type { ApertureValue, CameraState } from "../../types/camera";
import type { MovementRangeCriterion, TaskDefinition } from "../../types/task";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const task = getTaskById("swing-01") as TaskDefinition;
const calibration = shelfSwingGeometry.shelfSwingCalibration;

const evaluate = ({
  swing = calibration.frontSwingDeg,
  focus = calibration.focusDistanceMm,
  aperture = 11,
  rise = 0,
  tilt = 0,
}: {
  swing?: number;
  focus?: number;
  aperture?: ApertureValue;
  rise?: number;
  tilt?: number;
} = {}) => {
  const camera: CameraState = {
    ...DEFAULT_CAMERA_STATE,
    activeSceneId: shelfSwingScene.id,
    frontRiseMm: rise,
    frontTiltDeg: tilt,
    frontSwingDeg: swing,
    focusDistanceMm: focus,
    aperture,
  };
  const optics = deriveOpticsState(camera, shelfSwingScene);
  return { optics, result: evaluateTask(task, shelfSwingScene, camera, optics) };
};

describe("Shelf Swing guided task", () => {
  it("defines the calibrated signed lesson without obsolete criteria", () => {
    expect(task.sceneId).toBe("shelf-swing");
    expect(task.mode).toBe("guided");
    expect(task.title).toBe("Align the diagonal focus plane with swing");
    expect(task.objective).toContain("negative front swing");
    expect(task.enabledControls).toEqual([
      "swing",
      "focusDistance",
      "aperture",
      "geometryView",
    ]);
    expect(task.constraints.movement).toBe("swing-only");
    expect(task.initialCameraState).toMatchObject({
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      focusDistanceMm: shelfSwingGeometry.middleSubject.focusDetailProbeWorld.z,
      aperture: 11,
      geometryView: "top",
    });

    const aperture = task.criteria.find((criterion) => criterion.id === "swing-allowed-aperture");
    expect(aperture).toMatchObject({ type: "allowed-aperture", allowedApertures: [11, 22] });
    expect(task.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "swing-rise-zero", min: 0, max: 0 }),
        expect.objectContaining({ id: "swing-tilt-zero", min: 0, max: 0 }),
      ]),
    );
    const range = task.criteria.find(
      (criterion): criterion is MovementRangeCriterion =>
        criterion.id === "swing-movement-range" && criterion.type === "movement-range",
    );
    expect(range).toMatchObject({
      movement: "swing",
      valueMode: "signed",
      min: calibration.allowedSwingMinDeg,
      max: calibration.allowedSwingMaxDeg,
    });
    expect(range?.label).toBe("Swing remains within -4.2° to -3.4°");
    expect(task.criteria.some((criterion) => criterion.id === "swing-movement-used")).toBe(false);
    expect(
      task.criteria
        .filter((criterion) => criterion.type === "focus-targets-sharp")
        .flatMap((criterion) => criterion.targetIds),
    ).toEqual(["shelf-front", "shelf-middle", "shelf-back"]);
    task.criteria.forEach((criterion) => {
      expect(task.feedbackRules.failPrimaryByCriterionId[criterion.id]).toBeTruthy();
      expect(task.feedbackRules.failSecondaryByCriterionId[criterion.id]).toBeTruthy();
    });
  });

  it.each([
    [-4.2, true],
    [-3.8, true],
    [-3.4, true],
    [-4.3, false],
    [-3.3, false],
    [3.8, false],
    [0, false],
  ])("matches the signed movement criterion to public Swing value %s", (swing, passed) => {
    const { result } = evaluate({ swing });
    const movementRange = result.criteria.find(
      (criterion) => criterion.criterionId === "swing-movement-range",
    );
    expect(movementRange?.passed).toBe(passed);
    expect(Number.isFinite(movementRange?.score)).toBe(true);
  });

  it("starts from a clear zero-swing failure focused most sharply on the middle chart", () => {
    const { optics, result } = evaluate({
      swing: 0,
      focus: shelfSwingGeometry.middleSubject.focusDetailProbeWorld.z,
    });
    expect(result.status).toBe("failed");
    const sharpness = Object.fromEntries(optics.focusTargets.map((target) => [target.id, target.sharpness]));
    expect(sharpness["shelf-middle"]).toBe(Math.max(...Object.values(sharpness)));
    expect(
      result.criteria.find((criterion) => criterion.criterionId === "swing-movement-range")?.passed,
    ).toBe(false);
    expect(
      result.criteria
        .filter((criterion) => criterion.criterionId.endsWith("-sharp"))
        .every((criterion) => criterion.passed),
    ).toBe(false);
  });

  it.each([11, 22] as const)("passes the canonical negative solution at f/%s", (aperture) => {
    const { optics, result } = evaluate({ aperture });
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(result.status).toBe("passed");
    expect(result.score).toBe(100);
    expect(result.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(result.primaryFeedback).toContain("Negative front swing");
  });

  it("rejects the opposite sign and explicitly directs the learner to negative swing", () => {
    const canonical = evaluate();
    const opposite = evaluate({ swing: Math.abs(calibration.frontSwingDeg) });
    expect(opposite.result.status).toBe("failed");
    expect(
      opposite.result.criteria.find(
        (criterion) => criterion.criterionId === "swing-movement-range",
      )?.passed,
    ).toBe(false);
    expect(opposite.result.primaryFeedback).toContain("negative front swing");
    const endSharpness = (state: typeof canonical.optics) =>
      Math.min(
        state.focusTargets.find((target) => target.id === "shelf-front")?.sharpness ?? 0,
        state.focusTargets.find((target) => target.id === "shelf-back")?.sharpness ?? 0,
      );
    expect(endSharpness(opposite.optics)).toBeLessThan(endSharpness(canonical.optics));
  });

  it.each([
    [{ swing: -5 }, "swing-movement-range"],
    [{ rise: 1 }, "swing-rise-zero"],
    [{ tilt: 1 }, "swing-tilt-zero"],
    [{ aperture: 5.6 as const }, "swing-allowed-aperture"],
    [{ aperture: 32 as const }, "swing-allowed-aperture"],
  ])("rejects invalid lesson state %j", (state, criterionId) => {
    const { result } = evaluate(state);
    expect(result.status).toBe("failed");
    expect(result.criteria.find((criterion) => criterion.criterionId === criterionId)?.passed).toBe(
      false,
    );
  });
});
