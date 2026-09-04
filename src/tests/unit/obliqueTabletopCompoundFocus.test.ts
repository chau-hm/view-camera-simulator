import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { pointToPlaneDistance, planeFromPointNormal } from "../../core/math/plane";
import { angleDeg, dot } from "../../core/math/vec";
import { calculateLensNormal } from "../../core/optics/calculateLensPlane";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../core/optics/physicalSharpness";
import { getSceneFocusDistanceRange } from "../../scenes/definitions";
import { obliqueTabletopScene } from "../../scenes/definitions/oblique-tabletop";
import obliqueTabletopGeometry from "../../scenes/obliqueTabletopGeometry";
import {
  deriveObliqueTabletopCompoundCalibration,
  obliqueTabletopCompoundCalibration,
} from "../../scenes/obliqueTabletopCompoundCalibration";
import type { CameraState } from "../../types/camera";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { roundToStep } from "../../utils/roundToStep";

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...obliqueTabletopScene.cameraPreset,
  activeSceneId: obliqueTabletopScene.id,
  activeTaskId: null,
  mode: "free",
  ...overrides,
});

const evaluate = (overrides: Partial<CameraState>) =>
  deriveOpticsState(cameraFor(overrides), obliqueTabletopScene);

const physicalCoc = (target: { pointEquivalentCoCDiameterMm?: number | null }): number =>
  target.pointEquivalentCoCDiameterMm ?? Number.POSITIVE_INFINITY;

const cocValues = (overrides: Partial<CameraState>): number[] =>
  evaluate(overrides).focusTargets.map(physicalCoc);

const valuesById = (values: number[]): Map<string, number> =>
  new Map(
    obliqueTabletopGeometry.tabletopSurfaceSamples.map((sample, index) => [
      sample.id,
      values[index],
    ]),
  );

const max = (values: number[]): number => Math.max(...values);

const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const acuteAngle = (first: { x: number; y: number; z: number }, second: { x: number; y: number; z: number }): number => {
  const angle = angleDeg(first, second);
  return Math.min(angle, 180 - angle);
};

describe("Oblique Tabletop compound focus", () => {
  it("exposes exactly the compound front controls and keeps f/11 fixed", () => {
    expect(obliqueTabletopScene.movementCapabilities).toEqual({
      available: ["frontTiltDeg", "frontSwingDeg"],
      selectionMode: "multiple",
      defaultMovement: "frontTiltDeg",
    });
    expect(obliqueTabletopScene.cameraControlPolicy).toEqual({
      aperture: "fixed",
      infinityReset: false,
    });
    expect(obliqueTabletopScene.cameraPreset.aperture).toBe(11);
    expect(obliqueTabletopScene.movementCapabilities?.available).not.toContain("frontRiseMm");
    expect(obliqueTabletopScene.movementCapabilities?.available).not.toContain("frontShiftMm");
    expect(obliqueTabletopScene.movementCapabilities?.available).not.toContain("rearTiltDeg");
    expect(obliqueTabletopScene.movementCapabilities?.available).not.toContain("rearSwingDeg");
  });

  it("rejects an infeasible plane before producing a calibration", () => {
    const oldPr10APlane = planeFromPointNormal(
      { x: 0, y: -600, z: 4550 },
      { x: -0.021771, y: 0.987688, z: 0.154912 },
    );

    expect(() => deriveObliqueTabletopCompoundCalibration(oldPr10APlane)).toThrow(
      /infeasible: required horizontal lens-normal magnitude/,
    );
  });

  it("derives a feasible continuous lens orientation from the canonical plane", () => {
    const calibration = obliqueTabletopCompoundCalibration;
    const canonicalPlane = obliqueTabletopGeometry.tabletopTopSurfacePlane;

    expect(calibration.subjectPlane.normal).toEqual(canonicalPlane.normal);
    expect(calibration.subjectPlane.point).toEqual(canonicalPlane.point);
    expect(calibration.requiredLensHorizontalNormalMagnitude).toBeGreaterThan(0);
    expect(calibration.requiredLensHorizontalNormalMagnitude).toBeLessThan(1);
    expect(Math.abs(canonicalPlane.normal.x)).toBeGreaterThan(0.1);
    expect(Math.abs(canonicalPlane.normal.z)).toBeGreaterThan(0.2);
    expect(calibration.continuous.frontTiltDeg).toBeLessThan(0);
    expect(calibration.continuous.frontSwingDeg).toBeLessThan(0);
    expect(calibration.continuous.frontSwingDeg).toBeLessThan(-1);
    expect(calibration.continuous.frontTiltDeg).toBeGreaterThan(CAMERA_CONSTANTS.tiltMinDeg);
    expect(calibration.continuous.frontTiltDeg).toBeLessThan(CAMERA_CONSTANTS.tiltMaxDeg);
    expect(calibration.continuous.frontSwingDeg).toBeGreaterThan(CAMERA_CONSTANTS.swingMinDeg);
    expect(calibration.continuous.frontSwingDeg).toBeLessThan(CAMERA_CONSTANTS.swingMaxDeg);
    expect(calculateLensNormal(
      calibration.continuous.frontTiltDeg,
      calibration.continuous.frontSwingDeg,
    )).toEqual(calibration.continuous.lensNormal);
  });

  it("makes the continuous focus plane coincide with the canonical tabletop plane", () => {
    const calibration = obliqueTabletopCompoundCalibration;
    const continuous = evaluate({
      frontTiltDeg: calibration.continuous.frontTiltDeg,
      frontSwingDeg: calibration.continuous.frontSwingDeg,
      focusDistanceMm: calibration.continuous.focusDistanceMm,
      aperture: 11,
    });
    const focusPlane = continuous.focusPlane;

    expect(focusPlane).not.toBeNull();
    expect(acuteAngle(focusPlane!.normal, calibration.subjectPlane.normal)).toBeLessThan(1e-6);
    expect(pointToPlaneDistance(calibration.subjectPlane.point, focusPlane!)).toBeLessThan(1e-6);
    expect(dot(continuous.lensNormalWorld, calibration.continuous.lensNormal)).toBeCloseTo(1, 10);
  });

  it("quantizes the geometry-derived solution to the real public control steps", () => {
    const calibration = obliqueTabletopCompoundCalibration;
    const focusRange = getSceneFocusDistanceRange(obliqueTabletopScene.id);
    const { public: publicSolution, publicStep } = calibration;

    expect(publicSolution.frontTiltDeg).toBe(
      roundToStep(calibration.continuous.frontTiltDeg, publicStep.frontTiltDeg),
    );
    expect(publicSolution.frontSwingDeg).toBe(
      roundToStep(calibration.continuous.frontSwingDeg, publicStep.frontSwingDeg),
    );
    expect(publicSolution.focusDistanceMm).toBe(
      roundToStep(calibration.continuous.focusDistanceMm, publicStep.focusDistanceMm),
    );
    expect(publicSolution.frontTiltDeg / publicStep.frontTiltDeg).toBeCloseTo(
      Math.round(publicSolution.frontTiltDeg / publicStep.frontTiltDeg),
      10,
    );
    expect(publicSolution.frontSwingDeg / publicStep.frontSwingDeg).toBeCloseTo(
      Math.round(publicSolution.frontSwingDeg / publicStep.frontSwingDeg),
      10,
    );
    expect((publicSolution.focusDistanceMm - focusRange.min) / publicStep.focusDistanceMm).toBeCloseTo(
      Math.round((publicSolution.focusDistanceMm - focusRange.min) / publicStep.focusDistanceMm),
      10,
    );
    expect(publicSolution.frontTiltDeg).toBeGreaterThanOrEqual(CAMERA_CONSTANTS.tiltMinDeg);
    expect(publicSolution.frontTiltDeg).toBeLessThanOrEqual(CAMERA_CONSTANTS.tiltMaxDeg);
    expect(publicSolution.frontSwingDeg).toBeGreaterThanOrEqual(CAMERA_CONSTANTS.swingMinDeg);
    expect(publicSolution.frontSwingDeg).toBeLessThanOrEqual(CAMERA_CONSTANTS.swingMaxDeg);
    expect(publicSolution.focusDistanceMm).toBeGreaterThanOrEqual(focusRange.min);
    expect(publicSolution.focusDistanceMm).toBeLessThanOrEqual(focusRange.max);
  });

  it("brings all seven canonical samples under the physical CoC threshold", () => {
    const solution = obliqueTabletopCompoundCalibration.public;
    const values = cocValues({
      frontTiltDeg: solution.frontTiltDeg,
      frontSwingDeg: solution.frontSwingDeg,
      focusDistanceMm: solution.focusDistanceMm,
      aperture: solution.aperture,
    });

    expect(values).toHaveLength(7);
    expect(max(values)).toBeLessThanOrEqual(ACCEPTABLE_COC_DIAMETER_MM);
  });

  it("shows Swing materially resolving the residual lateral error", () => {
    const solution = obliqueTabletopCompoundCalibration.public;
    const tiltOnlyAtCompoundFocus = cocValues({
      frontTiltDeg: solution.frontTiltDeg,
      frontSwingDeg: 0,
      focusDistanceMm: solution.focusDistanceMm,
      aperture: solution.aperture,
    });
    const compound = cocValues({
      frontTiltDeg: solution.frontTiltDeg,
      frontSwingDeg: solution.frontSwingDeg,
      focusDistanceMm: solution.focusDistanceMm,
      aperture: solution.aperture,
    });
    const tiltOnlyById = valuesById(tiltOnlyAtCompoundFocus);
    const compoundById = valuesById(compound);
    const tiltOnlyOffAxis = obliqueTabletopGeometry.tabletopOffAxisSampleIds.map((id) => tiltOnlyById.get(id)!);
    const compoundOffAxis = obliqueTabletopGeometry.tabletopOffAxisSampleIds.map((id) => compoundById.get(id)!);

    expect(max(tiltOnlyAtCompoundFocus)).toBeGreaterThan(ACCEPTABLE_COC_DIAMETER_MM);
    expect(mean(compoundOffAxis)).toBeLessThan(mean(tiltOnlyOffAxis) * 0.25);
    expect(max(compound)).toBeLessThan(max(tiltOnlyAtCompoundFocus) * 0.25);
  });

  it("makes the opposite Swing direction materially worse", () => {
    const solution = obliqueTabletopCompoundCalibration.public;
    const selected = cocValues({
      frontTiltDeg: solution.frontTiltDeg,
      frontSwingDeg: solution.frontSwingDeg,
      focusDistanceMm: solution.focusDistanceMm,
      aperture: solution.aperture,
    });
    const opposite = cocValues({
      frontTiltDeg: solution.frontTiltDeg,
      frontSwingDeg: -solution.frontSwingDeg,
      focusDistanceMm: solution.focusDistanceMm,
      aperture: solution.aperture,
    });

    expect(max(opposite)).toBeGreaterThan(max(selected) * 10);
    expect(mean(opposite)).toBeGreaterThan(mean(selected) * 10);
  });

  it("retains the PR10B Tilt-only incomplete boundary", () => {
    const tiltOnly = cocValues({
      frontTiltDeg: obliqueTabletopGeometry.tiltOnlyCalibration.frontTiltDeg,
      frontSwingDeg: 0,
      focusDistanceMm: obliqueTabletopGeometry.tiltOnlyCalibration.focusDistanceMm,
      aperture: obliqueTabletopGeometry.tiltOnlyCalibration.aperture,
    });
    const compound = cocValues({
      frontTiltDeg: obliqueTabletopCompoundCalibration.public.frontTiltDeg,
      frontSwingDeg: obliqueTabletopCompoundCalibration.public.frontSwingDeg,
      focusDistanceMm: obliqueTabletopCompoundCalibration.public.focusDistanceMm,
      aperture: obliqueTabletopCompoundCalibration.public.aperture,
    });

    expect(max(tiltOnly)).toBeGreaterThan(ACCEPTABLE_COC_DIAMETER_MM);
    expect(max(compound)).toBeLessThanOrEqual(ACCEPTABLE_COC_DIAMETER_MM);
    expect(obliqueTabletopGeometry.tiltOnlyCalibration.frontTiltDeg).toBeLessThan(0);
  });
});
