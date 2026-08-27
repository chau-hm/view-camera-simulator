import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { distance, dot, subtract } from "../../core/math/vec";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  computePhysicalBlurFootprint,
  deriveOrthonormalPlaneBasis,
} from "../../core/optics/computePhysicalBlurFootprint";
import { imageDistanceMm } from "../../core/optics/thinLensModel";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { createGroundGlassDofUniformState } from "../../render/createGroundGlassDofUniformState";
import { getGroundGlassClipRangeWorld } from "../../render/groundGlassRttScenes";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import architectureForegroundGeometry from "../../scenes/architectureForegroundGeometry";
import type { CameraState } from "../../types/camera";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const focusCamera = (
  focusDistanceMm: number,
  frontTiltDeg = 0,
  aperture: CameraState["aperture"] = 5.6,
  frontRiseMm = 0,
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureForegroundScene.cameraPreset,
  activeSceneId: architectureForegroundScene.id,
  activeTaskId: null,
  mode: "free",
  focusDistanceMm,
  frontRiseMm,
  frontTiltDeg,
  aperture,
});

const footprintAt = (
  optics: ReturnType<typeof deriveOpticsState>,
  objectPoint: { x: number; y: number; z: number },
  apertureFNumber = 5.6,
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
  if (!lensBasis || !filmBasis) throw new Error("Architecture footprint bases should resolve");

  return computePhysicalBlurFootprint({
    objectPoint,
    lensCenter: optics.lensCenterWorld,
    lensPlaneNormal: lensBasis.normal,
    lensPlaneBasisX: lensBasis.x,
    lensPlaneBasisY: lensBasis.y,
    filmPlane: optics.filmPlane,
    filmPlaneBasisX: filmBasis.x,
    filmPlaneBasisY: filmBasis.y,
    focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
    apertureFNumber,
  });
};

const representativeTargetIds = ["foreground-near", "building-middle"] as const;

const physicalMetricAt = (optics: ReturnType<typeof deriveOpticsState>) => {
  const footprints = representativeTargetIds.flatMap((id) => {
    const target = architectureForegroundScene.focusTargets.find((candidate) => candidate.id === id);
    if (!target) throw new Error(`Missing Architecture + Foreground target ${id}`);
    return (target.sampleWorldPositions ?? [target.worldPosition]).map((point) =>
      footprintAt(optics, point, 11),
    );
  });
  return {
    maxAbsSignedCoC: Math.max(...footprints.map((footprint) => Math.abs(footprint.signedCoCDiameterMm))),
    maxMajorRadius: Math.max(...footprints.map((footprint) => footprint.majorRadiusMm)),
    maxMinorRadius: Math.max(...footprints.map((footprint) => footprint.minorRadiusMm)),
    maxBlurDiameterMm: Math.max(
      ...footprints.flatMap((footprint) => [
        Math.abs(footprint.signedCoCDiameterMm),
        2 * footprint.majorRadiusMm,
        2 * footprint.minorRadiusMm,
      ]),
    ),
  };
};

const rayPlaneDistance = (
  rayOrigin: { x: number; y: number; z: number },
  rayDirection: { x: number; y: number; z: number },
  plane: { point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number } },
) => {
  const denominator = dot(rayDirection, plane.normal);
  const parameter = dot(subtract(plane.point, rayOrigin), plane.normal) / denominator;
  return Math.abs(parameter);
};

describe("Architecture + Foreground focus-to-film propagation", () => {
  it("moves the finite-focus film plane with focus and changes physical footprints", () => {
    expect(architectureForegroundScene.finiteFocusStrategy).toEqual({
      kind: "rear-standard-thin-lens",
      lensDatum: "baseline-origin",
      focusDistanceReference: "lens-to-focus-plane",
      filmDepthReference: "optical-axis-conjugate",
    });
    const focusNear = deriveOpticsState(focusCamera(3920), architectureForegroundScene);
    const focusFar = deriveOpticsState(focusCamera(9450), architectureForegroundScene);

    expect(focusNear.lensCenterWorld).toEqual(focusFar.lensCenterWorld);
    expect(focusNear.cameraRigTransform).toEqual(focusFar.cameraRigTransform);
    expect(distance(focusNear.lensCenterWorld, focusNear.filmCenterWorld)).toBeCloseTo(
      imageDistanceMm(CAMERA_CONSTANTS.focalLengthMm, 3920),
      10,
    );
    expect(distance(focusFar.lensCenterWorld, focusFar.filmCenterWorld)).toBeCloseTo(
      imageDistanceMm(CAMERA_CONSTANTS.focalLengthMm, 9450),
      10,
    );
    expect(focusNear.filmCenterWorld.z).toBeCloseTo(
      -imageDistanceMm(CAMERA_CONSTANTS.focalLengthMm, 3920),
      10,
    );
    expect(focusFar.filmCenterWorld.z).toBeCloseTo(
      -imageDistanceMm(CAMERA_CONSTANTS.focalLengthMm, 9450),
      10,
    );
    expect(focusNear.filmCenterWorld.z).not.toBeCloseTo(focusFar.filmCenterWorld.z, 6);
    const facade = { x: 0, y: 0, z: 9500 };
    const foreground = { x: 0, y: 0, z: 4700 };
    const nearFacade = footprintAt(focusNear, facade);
    const farFacade = footprintAt(focusFar, facade);
    const nearForeground = footprintAt(focusNear, foreground);
    const farForeground = footprintAt(focusFar, foreground);

    expect(Math.abs(farFacade.signedCoCDiameterMm)).toBeLessThan(
      Math.abs(nearFacade.signedCoCDiameterMm),
    );
    expect(Math.abs(nearForeground.signedCoCDiameterMm)).not.toBeCloseTo(
      Math.abs(farForeground.signedCoCDiameterMm),
      5,
    );
    expect(nearFacade.signedCoCDiameterMm).toBeGreaterThan(0);
    expect(farFacade.signedCoCDiameterMm).toBeGreaterThan(0);
    expect(nearForeground.signedCoCDiameterMm).toBeGreaterThan(0);
    expect(farForeground.signedCoCDiameterMm).toBeLessThan(0);
    expect(nearFacade.valid && farFacade.valid && nearForeground.valid && farForeground.valid).toBe(
      true,
    );
  });

  it("propagates the resolved film plane into Ground Glass physical-DOF uniforms", () => {
    const states = [3920, 9450].map((focusDistanceMm) =>
      deriveOpticsState(focusCamera(focusDistanceMm), architectureForegroundScene),
    );
    const uniforms = states.map((optics) => {
      const clip = getGroundGlassClipRangeWorld(architectureForegroundScene, optics.lensCenterWorld);
      const camera = new THREE.PerspectiveCamera(45, 1.25, clip.near, clip.far);
      expect(configureGroundGlassCamera(camera, optics, clip.near, clip.far).ok).toBe(true);
      return createGroundGlassDofUniformState(
        optics,
        camera,
        CAMERA_CONSTANTS.focalLengthMm,
        CAMERA_CONSTANTS.filmWidthMm,
        CAMERA_CONSTANTS.filmHeightMm,
        0.1,
        5.6,
        500,
        400,
        48,
      );
    });

    expect(uniforms[0].filmPlanePoint[2]).toBeCloseTo(
      -imageDistanceMm(CAMERA_CONSTANTS.focalLengthMm, 3920) * 0.001,
      10,
    );
    expect(uniforms[1].filmPlanePoint[2]).toBeCloseTo(
      -imageDistanceMm(CAMERA_CONSTANTS.focalLengthMm, 9450) * 0.001,
      10,
    );
    expect(uniforms[0].filmPlanePoint).not.toEqual(uniforms[1].filmPlanePoint);
    expect(uniforms[0].lensCenterWorld).toEqual(uniforms[1].lensCenterWorld);
    expect(uniforms.every((state) =>
      [
        ...state.filmPlanePoint,
        ...state.filmPlaneNormal,
        ...state.filmPlaneBasisX,
        ...state.filmPlaneBasisY,
      ].every(Number.isFinite),
    )).toBe(true);
  });

  it("keeps the canonical Tilt + Focus state physically conjugate", () => {
    const tiltDeg = architectureForegroundGeometry.neutralCalibration.publicTiltFocusSolutionDeg;
    const focusDistanceMm = architectureForegroundGeometry.neutralCalibration.publicTiltFocusFocusDistanceMm;
    const riseMm = architectureForegroundGeometry.neutralCalibration.futureRiseMm;
    const canonical = deriveOpticsState(
      focusCamera(focusDistanceMm, tiltDeg, 11, riseMm),
      architectureForegroundScene,
    );
    const focusOnly = deriveOpticsState(
      focusCamera(focusDistanceMm, 0, 11, riseMm),
      architectureForegroundScene,
    );
    const tiltOnly = deriveOpticsState(
      focusCamera(
        architectureForegroundGeometry.canonicalFocusDistanceMm,
        tiltDeg,
        11,
        riseMm,
      ),
      architectureForegroundScene,
    );
    const expectedImageDistance = imageDistanceMm(
      CAMERA_CONSTANTS.focalLengthMm,
      focusDistanceMm,
    );
    const conjugateDistance = rayPlaneDistance(
      canonical.lensCenterWorld,
      canonical.opticalAxis.direction,
      canonical.filmPlane,
    );
    const canonicalMetric = physicalMetricAt(canonical);
    const focusOnlyMetric = physicalMetricAt(focusOnly);
    const tiltOnlyMetric = physicalMetricAt(tiltOnly);

    expect(conjugateDistance).toBeCloseTo(expectedImageDistance, 10);
    expect(canonicalMetric.maxBlurDiameterMm).toBeLessThan(focusOnlyMetric.maxBlurDiameterMm * 0.25);
    expect(canonicalMetric.maxBlurDiameterMm).toBeLessThan(tiltOnlyMetric.maxBlurDiameterMm * 0.25);
    expect(canonicalMetric.maxAbsSignedCoC).toBeGreaterThan(0);
    expect(canonicalMetric.maxMajorRadius).toBeGreaterThan(0);
    expect(canonicalMetric.maxMinorRadius).toBeGreaterThan(0);
  });
});
