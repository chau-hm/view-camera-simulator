import { describe, expect, it } from "vitest";
import {
  computePhysicalBlurFootprint,
  deriveOrthonormalPlaneBasis,
} from "../../core/optics/computePhysicalBlurFootprint";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { imageDistanceMm } from "../../core/optics/thinLensModel";
import { dot, subtract } from "../../core/math/vec";
import {
  mirrorShiftGeometry,
  mirrorShiftMirrorPlane,
  reflectPointAcrossMirrorPlane,
} from "../../scenes/mirrorShiftGeometry";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState, Vec3 } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const focalLengthMm = 120;
const focusDistanceMm = 6000;
const apertureFNumber = 11;

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...mirrorShiftScene.cameraPreset,
  activeSceneId: mirrorShiftScene.id,
  activeTaskId: null,
  mode: "free",
  ...overrides,
});

const footprintFor = (optics: DerivedOpticsState, objectPoint: Vec3) => {
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
    throw new Error("Canonical Mirror Shift lens and film bases must be resolvable");
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
    focalLengthMm,
    apertureFNumber,
  });
};

const axialLensToFilmDistanceMm = (optics: DerivedOpticsState): number =>
  Math.abs(dot(subtract(optics.filmCenterWorld, optics.lensCenterWorld), optics.lensNormalWorld));

const reflectedPropCenter = (id: "tall-marker" | "round-stool"): Vec3 => {
  const prop = mirrorShiftGeometry.props.find((candidate) => candidate.id === id);
  if (!prop) throw new Error(`Mirror Shift is missing its ${id} prop`);
  return reflectPointAcrossMirrorPlane(prop.position, mirrorShiftMirrorPlane);
};

describe("Mirror Shift finite-focus physical configuration", () => {
  it("focuses the actual reflected tall-marker centre and catches the historical F=f baseline", () => {
    const expectedImageDistanceMm = imageDistanceMm(focalLengthMm, focusDistanceMm);
    const camera = cameraFor();
    const optics = deriveOpticsState(camera, mirrorShiftScene);
    const tallMarker = reflectedPropCenter("tall-marker");
    const focusedMarkerFootprint = footprintFor(optics, tallMarker);

    expect(mirrorShiftScene.cameraPreset.focalLengthMm).toBe(focalLengthMm);
    expect(mirrorShiftScene.cameraPreset.focusDistanceMm).toBe(focusDistanceMm);
    expect(mirrorShiftScene.cameraPreset.aperture).toBe(apertureFNumber);
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.diagnostics.focusObjectDistanceMm).toBeCloseTo(focusDistanceMm, 10);
    expect(optics.diagnostics.imageDistanceMm).toBeCloseTo(expectedImageDistanceMm, 10);
    expect(axialLensToFilmDistanceMm(optics)).toBeCloseTo(expectedImageDistanceMm, 10);
    expect(optics.cameraBodyLocalGeometry.lensCenterLocal).toEqual({ x: 0, y: 0, z: 0 });
    expect(optics.cameraBodyLocalGeometry.filmCenterLocal.z).toBeCloseTo(
      -expectedImageDistanceMm,
      10,
    );
    expect(optics.focusPointWorld.z).toBeCloseTo(focusDistanceMm, 10);
    expect(optics.focusPlane).not.toBeNull();
    expect(optics.focusPlane?.point.z).toBeCloseTo(focusDistanceMm, 10);
    expect(
      Math.abs(
        dot(
          subtract(tallMarker, optics.focusPlane!.point),
          optics.focusPlane!.normal,
        ),
      ),
    ).toBeLessThan(1e-7);
    expect(tallMarker.z).toBeCloseTo(focusDistanceMm, 10);
    expect(focusedMarkerFootprint.valid).toBe(true);
    expect(Math.abs(focusedMarkerFootprint.signedCoCDiameterMm)).toBeLessThan(1e-7);
    expect(focusedMarkerFootprint.majorRadiusMm).toBeLessThan(1e-7);
    expect(focusedMarkerFootprint.minorRadiusMm).toBeLessThan(1e-7);

    const legacyScene: SceneDefinition = { ...mirrorShiftScene };
    delete legacyScene.finiteFocusStrategy;
    const legacyOptics = deriveOpticsState(camera, legacyScene);
    const legacyMarkerFootprint = footprintFor(legacyOptics, tallMarker);
    const historicalCoCMm = Math.abs(legacyMarkerFootprint.signedCoCDiameterMm);

    expect(axialLensToFilmDistanceMm(legacyOptics)).toBeCloseTo(focalLengthMm, 10);
    expect(legacyOptics.lensCenterWorld).toEqual(optics.lensCenterWorld);
    expect(legacyOptics.cameraRigTransform).toEqual(optics.cameraRigTransform);
    expect(legacyMarkerFootprint.valid).toBe(true);
    expect(historicalCoCMm).toBeCloseTo(0.21818181818181837, 9);
  });

  it("keeps a reflected subject at another depth physically defocused", () => {
    const optics = deriveOpticsState(cameraFor(), mirrorShiftScene);
    const stool = reflectedPropCenter("round-stool");
    const stoolFootprint = footprintFor(optics, stool);

    expect(stool.z).toBeCloseTo(5300, 10);
    expect(stoolFootprint.valid).toBe(true);
    expect(Number.isFinite(stoolFootprint.signedCoCDiameterMm)).toBe(true);
    expect(Math.abs(stoolFootprint.signedCoCDiameterMm)).toBeGreaterThan(1e-6);
  });

  it("moves only the intended camera geometry while preserving conjugate film depth", () => {
    const expectedImageDistanceMm = imageDistanceMm(focalLengthMm, focusDistanceMm);
    const neutral = deriveOpticsState(cameraFor(), mirrorShiftScene);
    const tallMarker = reflectedPropCenter("tall-marker");

    for (const rigLateralMm of [-1800, 1800]) {
      const moved = deriveOpticsState(
        cameraFor({ mirrorShiftLessonState: { rigLateralMm } }),
        mirrorShiftScene,
      );

      expect(moved.cameraRigTransform.rigOriginWorld.x).toBeCloseTo(rigLateralMm, 10);
      expect(moved.lensCenterWorld.x - neutral.lensCenterWorld.x).toBeCloseTo(
        rigLateralMm,
        10,
      );
      expect(moved.filmCenterWorld.x - neutral.filmCenterWorld.x).toBeCloseTo(
        rigLateralMm,
        10,
      );
      expect(axialLensToFilmDistanceMm(moved)).toBeCloseTo(expectedImageDistanceMm, 10);
      expect(Math.abs(footprintFor(moved, tallMarker).signedCoCDiameterMm)).toBeLessThan(1e-7);
    }

    const frontShiftedCamera = cameraFor({
      mirrorShiftLessonState: { rigLateralMm: 1800 },
      frontShiftMm: -55,
    });
    const frontShifted = deriveOpticsState(frontShiftedCamera, mirrorShiftScene);

    expect(frontShiftedCamera.focusDistanceMm).toBe(focusDistanceMm);
    expect(frontShiftedCamera.aperture).toBe(apertureFNumber);
    expect(frontShifted.cameraBodyLocalGeometry.lensCenterLocal.x).toBeCloseTo(-55, 10);
    expect(frontShifted.lensCenterWorld.x).toBeCloseTo(1745, 10);
    expect(frontShifted.filmCenterWorld.x).toBeCloseTo(1800, 10);
    expect(frontShifted.lensCenterWorld.z).toBeCloseTo(neutral.lensCenterWorld.z, 10);
    expect(frontShifted.filmCenterWorld.z).toBeCloseTo(neutral.filmCenterWorld.z, 10);
    expect(axialLensToFilmDistanceMm(frontShifted)).toBeCloseTo(expectedImageDistanceMm, 10);
    expect(Math.abs(footprintFor(frontShifted, tallMarker).signedCoCDiameterMm)).toBeLessThan(
      1e-7,
    );
    expect(mirrorShiftScene.cameraControlPolicy?.focusDistance).toBe("fixed");
    expect(mirrorShiftScene.cameraControlPolicy?.aperture).toBe("fixed");
  });
});
