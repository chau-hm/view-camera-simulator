import { afterEach, describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import {
  evaluateInteriorCornerRiseComposition,
  INTERIOR_CORNER_RISE_SAFE_FRAME,
} from "../../scenes/interiorCornerRiseComposition";
import geometry from "../../scenes/interiorCornerGeometry";
import { useAppStore } from "../../state/appStore";
import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState, Vec3 } from "../../types/optics";
import {
  CAMERA_CONSTANTS,
  CAMERA_CONTROL_STEPS,
  DEFAULT_CAMERA_STATE,
} from "../../utils/constants";

const cameraAtRise = (frontRiseMm: number): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...interiorCornerScene.cameraPreset,
  activeSceneId: interiorCornerScene.id,
  activeTaskId: null,
  mode: "free",
  frontRiseMm,
});

const opticsAtRise = (frontRiseMm: number): DerivedOpticsState =>
  deriveOpticsState(cameraAtRise(frontRiseMm), interiorCornerScene);

const evaluationAtRise = (frontRiseMm: number) => {
  const optics = opticsAtRise(frontRiseMm);
  return {
    optics,
    composition: evaluateInteriorCornerRiseComposition(optics),
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
  (_, index) =>
    CAMERA_CONSTANTS.riseMinMm + index * CAMERA_CONTROL_STEPS.riseMm,
);

const firstPassingRise = (): number | undefined =>
  publicRiseValues.find((riseMm) => evaluationAtRise(riseMm).composition.passed);

const expectVecClose = (actual: Vec3, expected: Vec3): void => {
  expect(actual.x).toBeCloseTo(expected.x, 8);
  expect(actual.y).toBeCloseTo(expected.y, 8);
  expect(actual.z).toBeCloseTo(expected.z, 8);
};

describe("Interior Corner Rise composition", () => {
  afterEach(() => {
    useAppStore.getState().resetCamera();
  });

  it("fails at neutral while keeping the level camera and usable room corner in frame", () => {
    const { optics, composition } = evaluationAtRise(0);

    expect(composition.passed).toBe(false);
    expect(composition.upperArchitecture.projection.visible).toBe(false);
    expect(composition.upperArchitecture.withinSafeFrame).toBe(false);
    expect(composition.roomCorner.withinSafeFrame).toBe(true);
    expect(composition.upperArchitecture.projection.vRaw).toBeGreaterThan(
      INTERIOR_CORNER_RISE_SAFE_FRAME.maxV,
    );
    expect(optics.opticalAxis.direction.y).toBeCloseTo(0, 8);
    expect(optics.diagnostics.tiltAngleDeg).toBe(0);
    expect(optics.diagnostics.swingAngleDeg).toBe(0);
  });

  it("finds a successful state on the existing public Rise grid with an insufficient neighbor", () => {
    const passingRiseMm = firstPassingRise();

    expect(passingRiseMm).toBeDefined();
    if (passingRiseMm === undefined) return;

    expect(passingRiseMm).toBeGreaterThan(CAMERA_CONSTANTS.riseMinMm);
    expect(passingRiseMm).toBeLessThanOrEqual(CAMERA_CONSTANTS.riseMaxMm);
    expect(
      (passingRiseMm - CAMERA_CONSTANTS.riseMinMm) % CAMERA_CONTROL_STEPS.riseMm,
    ).toBe(0);
    expect(evaluationAtRise(passingRiseMm).composition.passed).toBe(true);

    const insufficientRiseMm = passingRiseMm - CAMERA_CONTROL_STEPS.riseMm;
    expect(insufficientRiseMm).toBeGreaterThanOrEqual(CAMERA_CONSTANTS.riseMinMm);
    expect(evaluationAtRise(insufficientRiseMm).composition.passed).toBe(false);
  });

  it("moves the framing without changing canonical camera orientation or perspective references", () => {
    const passingRiseMm = firstPassingRise();

    expect(passingRiseMm).toBeDefined();
    if (passingRiseMm === undefined) return;

    const neutral = evaluationAtRise(0);
    const risen = evaluationAtRise(passingRiseMm);

    expectVecClose(risen.optics.lensNormalWorld, neutral.optics.lensNormalWorld);
    expectVecClose(risen.optics.opticalAxis.direction, neutral.optics.opticalAxis.direction);
    expectVecClose(
      risen.optics.rearStandardFrame.rightWorld,
      neutral.optics.rearStandardFrame.rightWorld,
    );
    expectVecClose(
      risen.optics.rearStandardFrame.upWorld,
      neutral.optics.rearStandardFrame.upWorld,
    );
    expectVecClose(
      risen.optics.rearStandardFrame.normalWorld,
      neutral.optics.rearStandardFrame.normalWorld,
    );

    const project = (optics: DerivedOpticsState, worldPoint: Vec3) =>
      projectWorldPointToFilmPlaneGroundGlass({
        worldPoint,
        lensCenterWorld: optics.lensCenterWorld,
        filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
      });
    const verticalBottom = {
      ...geometry.upperArchitectureFocusPoint,
      y: geometry.room.floorY + 600,
    };
    const verticalTop = {
      ...geometry.upperArchitectureFocusPoint,
      y: geometry.room.ceilingY - 250,
    };
    const neutralBottom = project(neutral.optics, verticalBottom);
    const neutralTop = project(neutral.optics, verticalTop);
    const risenBottom = project(risen.optics, verticalBottom);
    const risenTop = project(risen.optics, verticalTop);

    expect(risen.optics.lensCenterWorld.y).toBeGreaterThan(
      neutral.optics.lensCenterWorld.y,
    );
    expect(risen.composition.upperArchitecture.projection.vRaw).toBeLessThan(
      neutral.composition.upperArchitecture.projection.vRaw,
    );
    expect(neutralTop.uRaw - neutralBottom.uRaw).toBeCloseTo(
      risenTop.uRaw - risenBottom.uRaw,
      8,
    );
  });

  it("returns to the neutral composition after the scene reset", () => {
    const passingRiseMm = firstPassingRise();

    expect(passingRiseMm).toBeDefined();
    if (passingRiseMm === undefined) return;

    const store = useAppStore.getState();
    store.initializeSimulatorRoute({
      mode: "free",
      sceneId: interiorCornerScene.id,
      taskId: null,
    });
    store.setRise(passingRiseMm);
    expect(
      evaluateInteriorCornerRiseComposition(
        deriveOpticsState(useAppStore.getState().camera, interiorCornerScene),
      ).passed,
    ).toBe(true);

    store.resetMovements();
    const resetCamera = useAppStore.getState().camera;
    expect(resetCamera).toMatchObject({
      activeSceneId: interiorCornerScene.id,
      activeTaskId: null,
      frontRiseMm: 0,
      frontSwingDeg: 0,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      aperture: 5.6,
    });
    expect(
      evaluateInteriorCornerRiseComposition(
        deriveOpticsState(resetCamera, interiorCornerScene),
      ).passed,
    ).toBe(false);
  });
});
