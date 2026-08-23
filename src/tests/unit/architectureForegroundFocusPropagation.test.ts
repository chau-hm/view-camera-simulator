import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { distance } from "../../core/math/vec";
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
import type { CameraState } from "../../types/camera";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const focusCamera = (focusDistanceMm: number): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureForegroundScene.cameraPreset,
  activeSceneId: architectureForegroundScene.id,
  activeTaskId: null,
  mode: "free",
  focusDistanceMm,
  aperture: 5.6,
});

const footprintAt = (
  optics: ReturnType<typeof deriveOpticsState>,
  objectPoint: { x: number; y: number; z: number },
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
    apertureFNumber: 5.6,
  });
};

describe("Architecture + Foreground focus-to-film propagation", () => {
  it("moves the rear-standard film plane with focus and changes physical footprints", () => {
    expect(architectureForegroundScene.finiteFocusStrategy).toEqual({
      kind: "rear-standard-thin-lens",
      lensDatum: "baseline-origin",
      focusDistanceReference: "lens-to-focus-plane",
      filmDepthReference: "rear-standard-z",
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
});
