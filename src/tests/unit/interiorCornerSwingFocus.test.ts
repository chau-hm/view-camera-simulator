import { describe, expect, it } from "vitest";
import { dot } from "../../core/math/vec";
import { pointToPlaneDistance } from "../../core/math/plane";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { getSceneFocusDistanceRange } from "../../scenes/definitions";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import {
  evaluateInteriorCornerRiseComposition,
} from "../../scenes/interiorCornerRiseComposition";
import geometry from "../../scenes/interiorCornerGeometry";
import {
  evaluateInteriorCornerSwingFocus,
  INTERIOR_CORNER_CALIBRATION_APERTURE,
  INTERIOR_CORNER_FOCUS_TARGET_IDS,
  interiorCornerSwingFocusCalibration,
} from "../../scenes/interiorCornerSwingFocus";
import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState, Vec3 } from "../../types/optics";
import {
  CAMERA_CONSTANTS,
  CAMERA_CONTROL_STEPS,
  DEFAULT_CAMERA_STATE,
} from "../../utils/constants";

const focusRange = getSceneFocusDistanceRange(
  interiorCornerScene.id,
  interiorCornerScene.cameraPreset.focalLengthMm,
);

const cameraAt = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...interiorCornerScene.cameraPreset,
  activeSceneId: interiorCornerScene.id,
  activeTaskId: null,
  mode: "free",
  ...overrides,
});

const opticsAt = (overrides: Partial<CameraState> = {}): DerivedOpticsState =>
  deriveOpticsState(cameraAt(overrides), interiorCornerScene);

const focusEvaluationAt = (overrides: Partial<CameraState> = {}) => {
  return focusEvaluationAtState(cameraAt(overrides));
};

const focusEvaluationAtState = (state: CameraState) => {
  const optics = deriveOpticsState(state, interiorCornerScene);
  return {
    optics,
    evaluation: evaluateInteriorCornerSwingFocus(optics, state.aperture),
  };
};

const publicRiseValues = Array.from(
  {
    length:
      Math.floor(
        (CAMERA_CONSTANTS.riseMaxMm - CAMERA_CONSTANTS.riseMinMm) /
          CAMERA_CONTROL_STEPS.riseMm,
      ) + 1,
  },
  (_, index) => CAMERA_CONSTANTS.riseMinMm + index * CAMERA_CONTROL_STEPS.riseMm,
);

const firstPassingRise = (): number | undefined =>
  publicRiseValues.find((frontRiseMm) =>
    evaluateInteriorCornerRiseComposition(opticsAt({ frontRiseMm })).passed,
  );

const publicFocusValues = (): number[] => {
  const values: number[] = [];
  for (
    let focusDistanceMm = focusRange.min;
    focusDistanceMm <= focusRange.max;
    focusDistanceMm += CAMERA_CONTROL_STEPS.focusDistanceMm
  ) {
    values.push(focusDistanceMm);
  }
  return values;
};

const isOnGrid = (value: number, minimum: number, step: number): boolean => {
  const gridIndex = (value - minimum) / step;
  return Math.abs(gridIndex - Math.round(gridIndex)) < 1e-9;
};

const maxCoC = (values: { equivalentCoCDiameterMm: number | null }[]): number => {
  const finiteValues = values
    .map((target) => target.equivalentCoCDiameterMm)
    .filter((value): value is number => value !== null);
  return Math.max(...finiteValues);
};

const expectVecClose = (actual: Vec3, expected: Vec3): void => {
  expect(actual.x).toBeCloseTo(expected.x, 8);
  expect(actual.y).toBeCloseTo(expected.y, 8);
  expect(actual.z).toBeCloseTo(expected.z, 8);
};

describe("Interior Corner Swing + Focus calibration", () => {
  it("keeps the near, middle, and far anchors on one vertical receding-wall plane", () => {
    const [near, middle, far] = geometry.focusTargets.map((target) => target.worldPosition);
    const { raw } = interiorCornerSwingFocusCalibration;

    expect(new Set([near.x, middle.x, far.x]).size).toBe(1);
    expect(new Set([near.y, middle.y, far.y]).size).toBe(1);
    expect(raw.collinearityErrorMm).toBeLessThan(1e-9);
    [near, middle, far].forEach((point) => {
      expect(pointToPlaneDistance(point, raw.subjectPlane)).toBeLessThan(1e-9);
    });
  });

  it("derives a finite positive raw Swing and optical-axis focus intersection", () => {
    const { raw, public: publicCalibration } = interiorCornerSwingFocusCalibration;

    expect(raw.frontSwingDeg).toBeGreaterThan(0);
    expect(raw.frontSwingDeg).toBeLessThan(CAMERA_CONSTANTS.swingMaxDeg);
    expect(raw.focusDistanceMm).toBeGreaterThan(focusRange.min);
    expect(raw.focusDistanceMm).toBeLessThanOrEqual(focusRange.max);
    expect(raw.focusDistanceMm).toBeCloseTo(38144.4267, 3);
    expect(raw.frontSwingDeg).toBeCloseTo(3.5953, 3);
    expect(pointToPlaneDistance(raw.opticalAxisIntersection, raw.subjectPlane)).toBeLessThan(1e-9);
    expect(raw.frontSwingDeg).not.toBe(publicCalibration.frontSwingDeg);
    expect(raw.focusDistanceMm).not.toBe(publicCalibration.focusDistanceMm);
  });

  it("keeps the rounded public calibration on the shared control grids and in scene ranges", () => {
    const { public: publicCalibration, publicStep } = interiorCornerSwingFocusCalibration;

    expect(publicCalibration).toMatchObject({
      frontSwingDeg: 3.6,
      focusDistanceMm: 38140,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });
    expect(isOnGrid(
      publicCalibration.frontSwingDeg,
      CAMERA_CONSTANTS.swingMinDeg,
      publicStep.frontSwingDeg,
    )).toBe(true);
    expect(isOnGrid(
      publicCalibration.focusDistanceMm,
      focusRange.min,
      publicStep.focusDistanceMm,
    )).toBe(true);
    expect(publicCalibration.frontSwingDeg).toBeGreaterThanOrEqual(CAMERA_CONSTANTS.swingMinDeg);
    expect(publicCalibration.frontSwingDeg).toBeLessThanOrEqual(CAMERA_CONSTANTS.swingMaxDeg);
    expect(publicCalibration.focusDistanceMm).toBeGreaterThanOrEqual(focusRange.min);
    expect(publicCalibration.focusDistanceMm).toBeLessThanOrEqual(focusRange.max);
  });

  it("shows depth-dependent mismatch at neutral focus with zero Swing", () => {
    const { optics, evaluation } = focusEvaluationAt({
      frontSwingDeg: 0,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });

    expect(optics.diagnostics.swingAngleDeg).toBe(0);
    expect(evaluation.status).toBe("misaligned");
    expect(evaluation.passed).toBe(false);
    expect(evaluation.targets.map((target) => target.id)).toEqual(INTERIOR_CORNER_FOCUS_TARGET_IDS);
    expect(evaluation.targets.every((target) => target.equivalentCoCDiameterMm !== null)).toBe(true);
    expect(evaluation.maximumCoCDiameterMm).toBeGreaterThan(0.1);
  });

  it("proves that Focus-only public states cannot align the wall at f/5.6", () => {
    const focusOnlyEvaluations = publicFocusValues().map((focusDistanceMm) =>
      focusEvaluationAtState(cameraAt({
        frontSwingDeg: 0,
        focusDistanceMm,
        aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
      })),
    );
    const best = focusOnlyEvaluations.reduce((currentBest, candidate) =>
      maxCoC(candidate.evaluation.targets) < maxCoC(currentBest.evaluation.targets)
        ? candidate
        : currentBest,
    );

    expect(focusOnlyEvaluations.every(({ evaluation }) => !evaluation.passed)).toBe(true);
    expect(maxCoC(best.evaluation.targets)).toBeGreaterThan(0.1);
    expect(best.optics.diagnostics.swingAngleDeg).toBe(0);
  });

  it("shows Swing changing focus-plane orientation before Focus placement is refined", () => {
    const neutral = opticsAt({
      frontSwingDeg: 0,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });
    const swingOnly = focusEvaluationAtState(cameraAt({
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    }));

    expect(neutral.focusPlane).not.toBeNull();
    expect(swingOnly.optics.focusPlane).not.toBeNull();
    expect(swingOnly.evaluation.passed).toBe(false);
    expect(swingOnly.evaluation.status).toBe("refine-focus");
    expect(Math.abs(swingOnly.optics.focusPlane!.normal.x)).toBeGreaterThan(
      Math.abs(neutral.focusPlane!.normal.x),
    );
    expect(Math.abs(dot(
      swingOnly.optics.focusPlane!.normal,
      interiorCornerSwingFocusCalibration.raw.subjectPlane.normal,
    ))).toBeGreaterThan(Math.abs(dot(
      neutral.focusPlane!.normal,
      interiorCornerSwingFocusCalibration.raw.subjectPlane.normal,
    )));

    const refined = focusEvaluationAtState(cameraAt({
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    }));
    expect(maxCoC(refined.evaluation.targets)).toBeLessThan(
      maxCoC(swingOnly.evaluation.targets),
    );
  });

  it("passes every canonical wall target at the public Swing + Focus state", () => {
    const { public: publicCalibration } = interiorCornerSwingFocusCalibration;
    const { optics, evaluation } = focusEvaluationAtState(cameraAt({
      frontSwingDeg: publicCalibration.frontSwingDeg,
      focusDistanceMm: publicCalibration.focusDistanceMm,
      aperture: publicCalibration.aperture,
    }));

    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.diagnostics.focusPlaneModel).toBe("scheimpflug");
    expect(evaluation.apertureEligible).toBe(true);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.targets).toHaveLength(3);
    expect(evaluation.targets.every((target) => target.passed)).toBe(true);
    expect(evaluation.maximumCoCDiameterMm).toBeLessThanOrEqual(0.1);
    evaluation.targets.forEach((target) => {
      expect(target.equivalentCoCDiameterMm).not.toBeNull();
      expect(target.equivalentCoCDiameterMm!).toBeLessThanOrEqual(0.1);
    });
  });

  it("makes the opposite Swing sign materially worse", () => {
    const { public: publicCalibration } = interiorCornerSwingFocusCalibration;
    const correct = focusEvaluationAtState(cameraAt({
      frontSwingDeg: publicCalibration.frontSwingDeg,
      focusDistanceMm: publicCalibration.focusDistanceMm,
      aperture: publicCalibration.aperture,
    }));
    const wrongSign = focusEvaluationAtState(cameraAt({
      frontSwingDeg: -publicCalibration.frontSwingDeg,
      focusDistanceMm: publicCalibration.focusDistanceMm,
      aperture: publicCalibration.aperture,
    }));

    expect(wrongSign.evaluation.passed).toBe(false);
    expect(wrongSign.evaluation.maximumCoCDiameterMm).toBeGreaterThan(0.1);
    expect(wrongSign.evaluation.maximumCoCDiameterMm).toBeGreaterThan(
      (correct.evaluation.maximumCoCDiameterMm ?? 0) * 10,
    );
  });

  it("does not let a stopped-down aperture masquerade as the calibration state", () => {
    const { public: publicCalibration } = interiorCornerSwingFocusCalibration;
    const stoppedDown = focusEvaluationAtState(cameraAt({
      frontSwingDeg: publicCalibration.frontSwingDeg,
      focusDistanceMm: publicCalibration.focusDistanceMm,
      aperture: 11,
    }));

    expect(stoppedDown.evaluation.apertureEligible).toBe(false);
    expect(stoppedDown.evaluation.status).toBe("open-aperture-required");
    expect(stoppedDown.evaluation.passed).toBe(false);
  });

  it("preserves the PR12B composition when the public wall calibration is applied", () => {
    const passingRiseMm = firstPassingRise();
    const { public: publicCalibration } = interiorCornerSwingFocusCalibration;

    expect(passingRiseMm).toBeDefined();
    if (passingRiseMm === undefined) return;

    const state = cameraAt({
      frontRiseMm: passingRiseMm,
      frontSwingDeg: publicCalibration.frontSwingDeg,
      focusDistanceMm: publicCalibration.focusDistanceMm,
      aperture: publicCalibration.aperture,
    });
    const optics = deriveOpticsState(state, interiorCornerScene);
    const composition = evaluateInteriorCornerRiseComposition(optics);
    const focus = evaluateInteriorCornerSwingFocus(optics, state.aperture);

    expect(composition.passed).toBe(true);
    expect(focus.passed).toBe(true);
    expect(state.frontSwingDeg).toBe(publicCalibration.frontSwingDeg);
    expect(state.frontRiseMm).toBe(passingRiseMm);
  });

  it("keeps the neutral state distinct from the public calibrated state", () => {
    const neutral = cameraAt({
      frontRiseMm: 0,
      frontSwingDeg: 0,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });
    const calibrated = cameraAt({
      frontRiseMm: 0,
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
    });

    expectVecClose(
      deriveOpticsState(neutral, interiorCornerScene).opticalAxis.direction,
      { x: 0, y: 0, z: 1 },
    );
    expect(deriveOpticsState(calibrated, interiorCornerScene).diagnostics.swingAngleDeg).toBe(3.6);
    expect(neutral.frontRiseMm).toBe(0);
    expect(neutral.frontSwingDeg).toBe(0);
    expect(neutral.focusDistanceMm).toBe(geometry.canonicalFocusDistanceMm);
  });
});
