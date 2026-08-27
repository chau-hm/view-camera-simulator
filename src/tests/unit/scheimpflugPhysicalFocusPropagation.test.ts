import { describe, expect, it } from "vitest";
import { deriveOrthonormalPlaneBasis, computePhysicalBlurFootprint } from "../../core/optics/computePhysicalBlurFootprint";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { imageDistanceMm } from "../../core/optics/thinLensModel";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import shelfGeometry from "../../scenes/shelfSwingGeometry";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import tableGeometry from "../../scenes/tableTiltGeometry";
import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState, Vec3 } from "../../types/optics";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraFor = (
  scene: typeof shelfSwingScene | typeof tableTiltScene,
  overrides: Partial<CameraState> = {},
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...scene.cameraPreset,
  activeSceneId: scene.id,
  ...overrides,
});

const footprintFor = (
  optics: DerivedOpticsState,
  objectPoint: Vec3,
  apertureFNumber: number,
) => {
  const lensBasis = deriveOrthonormalPlaneBasis(
    optics.lensPlane.normal,
    optics.rearStandardFrame.rightWorld,
    optics.rearStandardFrame.upWorld,
  );
  const filmBasis = deriveOrthonormalPlaneBasis(
    optics.filmPlane.normal,
    optics.rearStandardFrame.rightWorld,
    optics.rearStandardFrame.upWorld,
  );
  if (!lensBasis || !filmBasis) {
    throw new Error("Canonical lens/film bases must be resolvable for this regression");
  }

  return computePhysicalBlurFootprint({
    objectPoint,
    lensCenter: optics.lensCenterWorld,
    lensPlaneNormal: optics.lensPlane.normal,
    lensPlaneBasisX: lensBasis.x,
    lensPlaneBasisY: lensBasis.y,
    filmPlane: optics.filmPlane,
    filmPlaneBasisX: filmBasis.x,
    filmPlaneBasisY: filmBasis.y,
    focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
    apertureFNumber,
  });
};

describe("Scheimpflug focus propagation into the physical Ground Glass film plane", () => {
  it("collapses Shelf Swing footprints at the canonical solved focus and expands them at 2000 mm", () => {
    const solvedCamera = cameraFor(shelfSwingScene, {
      frontRiseMm: shelfGeometry.shelfSwingCalibration.frontRiseMm,
      frontTiltDeg: shelfGeometry.shelfSwingCalibration.frontTiltDeg,
      frontSwingDeg: shelfGeometry.shelfSwingCalibration.frontSwingDeg,
      focusDistanceMm: shelfGeometry.shelfSwingCalibration.focusDistanceMm,
      aperture: 11,
    });
    const wrongFocusCamera = {
      ...solvedCamera,
      focusDistanceMm: 2000,
    };
    const solved = deriveOpticsState(solvedCamera, shelfSwingScene);
    const wrongFocus = deriveOpticsState(wrongFocusCamera, shelfSwingScene);

    expect(solved.filmCenterWorld.z).toBeCloseTo(
      -shelfGeometry.calibrationSolution.filmDistanceMm,
      9,
    );
    expect(solved.focusTargets.every((target) => target.sharpness >= 0.96)).toBe(true);

    const solvedFootprints = shelfGeometry.subjects.map((subject) =>
      footprintFor(solved, subject.focusDetailProbeWorld, 11),
    );
    const wrongFocusFootprints = shelfGeometry.subjects.map((subject) =>
      footprintFor(wrongFocus, subject.focusDetailProbeWorld, 11),
    );

    solvedFootprints.forEach((footprint) => {
      expect(footprint.valid).toBe(true);
      expect(Math.abs(footprint.signedCoCDiameterMm)).toBeLessThan(1e-7);
      expect(footprint.majorRadiusMm).toBeLessThan(1e-7);
      expect(footprint.minorRadiusMm).toBeLessThan(1e-7);
    });
    wrongFocusFootprints.forEach((footprint) => {
      expect(footprint.valid).toBe(true);
      expect(Math.abs(footprint.signedCoCDiameterMm)).toBeGreaterThan(0.4);
      expect(footprint.majorRadiusMm).toBeGreaterThan(0.2);
      expect(footprint.minorRadiusMm).toBeGreaterThan(0.2);
    });
  });

  it("keeps the public Shelf Swing control solution physically close to focus", () => {
    const control = shelfGeometry.shelfSwingCalibration.controlSolution;
    const optics = deriveOpticsState(
      cameraFor(shelfSwingScene, {
        frontSwingDeg: control.frontSwingDeg,
        focusDistanceMm: control.focusDistanceMm,
        aperture: control.aperture,
      }),
      shelfSwingScene,
    );

    shelfGeometry.subjects.forEach((subject) => {
      const footprint = footprintFor(optics, subject.focusDetailProbeWorld, control.aperture);
      expect(Math.abs(footprint.signedCoCDiameterMm)).toBeLessThan(0.01);
      expect(footprint.majorRadiusMm).toBeLessThan(0.01);
      expect(footprint.minorRadiusMm).toBeLessThan(0.01);
    });
  });

  it("collapses Table Tilt footprints at its canonical solved focus", () => {
    const calibration = tableGeometry.tableTiltCalibration;
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, {
        frontTiltDeg: calibration.frontTiltDeg,
        frontSwingDeg: calibration.frontSwingDeg,
        focusDistanceMm: calibration.focusDistanceMm,
        aperture: calibration.aperture,
      }),
      tableTiltScene,
    );

    const expectedFilmDistanceMm =
      imageDistanceMm(CAMERA_CONSTANTS.focalLengthMm, calibration.focusDistanceMm) *
      Math.cos((calibration.frontTiltDeg * Math.PI) / 180);
    expect(optics.filmCenterWorld.z).toBeCloseTo(-expectedFilmDistanceMm, 9);
    expect(optics.focusTargets.every((target) => target.sharpness >= 0.96)).toBe(true);

    tableGeometry.subjects.forEach((subject) => {
      const footprint = footprintFor(optics, subject.focusDetailProbeWorld, calibration.aperture);
      expect(footprint.valid).toBe(true);
      expect(Math.abs(footprint.signedCoCDiameterMm)).toBeLessThan(1e-7);
      expect(footprint.majorRadiusMm).toBeLessThan(1e-7);
      expect(footprint.minorRadiusMm).toBeLessThan(1e-7);
    });
  });
});
