import { describe, expect, it } from "vitest";
import { distance, rotateAroundX, rotatePointAroundX } from "../../core/math/vec";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import geometry, {
  CAMERA_BODY_PIVOT_WORLD,
  CAMERA_BODY_RAIL_GEOMETRY,
} from "../../scenes/understandingCameraMovementsGeometry";
import type { CameraState } from "../../types/camera";
import type { Plane, Vec3 } from "../../types/optics";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const expectVecClose = (actual: Vec3, expected: Vec3, digits = 10): void => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
};

const expectPlaneRigidlyTransformed = (
  actual: Plane | null | undefined,
  baseline: Plane | null | undefined,
  pitchDeg: number,
): void => {
  expect(actual).not.toBeNull();
  expect(actual).not.toBeUndefined();
  expect(baseline).not.toBeNull();
  expect(baseline).not.toBeUndefined();
  expectVecClose(
    actual?.point as Vec3,
    rotatePointAroundX(baseline?.point as Vec3, CAMERA_BODY_PIVOT_WORLD, pitchDeg),
  );
  expectVecClose(actual?.normal as Vec3, rotateAroundX(baseline?.normal as Vec3, pitchDeg));
};

const cameraFor = (pitchDeg: number, overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...understandingCameraMovementsScene.cameraPreset,
  cameraBodyPitchDeg: pitchDeg,
  cameraBodyPivotWorld: CAMERA_BODY_PIVOT_WORLD,
  activeSceneId: understandingCameraMovementsScene.id,
  ...overrides,
});

describe("canonical camera-body pitch optics", () => {
  it("publishes a fixed tripod pivot and rail derived from the zero-body standard span", () => {
    expect(CAMERA_BODY_PIVOT_WORLD.x).toBe(0);
    expect(CAMERA_BODY_PIVOT_WORLD.y).toBe(-90);
    expect(CAMERA_BODY_PIVOT_WORLD.z).toBeCloseTo(
      -geometry.cameraBody.rail.dimensionsMm.z / 2 + CAMERA_BODY_RAIL_GEOMETRY.standardOverhangMm,
      10,
    );
    expect(CAMERA_BODY_RAIL_GEOMETRY.centerWorld).toBe(CAMERA_BODY_PIVOT_WORLD);
    expect(
      CAMERA_BODY_RAIL_GEOMETRY.frontEndpointWorld.z -
        CAMERA_BODY_RAIL_GEOMETRY.rearEndpointWorld.z,
    ).toBeCloseTo(CAMERA_BODY_RAIL_GEOMETRY.dimensionsMm.z, 10);
  });

  it.each([-8, 8])(
    "applies %i degrees as one rigid +X transform after local standard movements",
    (pitchDeg) => {
      const localMovements: Partial<CameraState> = {
        frontRiseMm: 18,
        frontTiltDeg: 4,
        rearRiseMm: 11,
        rearTiltDeg: -3,
      };
      const baseline = deriveOpticsState(
        cameraFor(0, localMovements),
        understandingCameraMovementsScene,
      );
      const pitched = deriveOpticsState(
        cameraFor(pitchDeg, localMovements),
        understandingCameraMovementsScene,
      );

      expect(pitched.cameraBodyTransform).toEqual({
        pitchDeg,
        pivotWorld: CAMERA_BODY_PIVOT_WORLD,
      });
      expect(pitched.cameraBodyLocalGeometry).toEqual(baseline.cameraBodyLocalGeometry);
      expectVecClose(
        pitched.lensCenterWorld,
        rotatePointAroundX(baseline.lensCenterWorld, CAMERA_BODY_PIVOT_WORLD, pitchDeg),
      );
      expectVecClose(
        pitched.filmCenterWorld,
        rotatePointAroundX(baseline.filmCenterWorld, CAMERA_BODY_PIVOT_WORLD, pitchDeg),
      );
      expectVecClose(pitched.lensNormalWorld, rotateAroundX(baseline.lensNormalWorld, pitchDeg));
      expectVecClose(pitched.filmNormalWorld, rotateAroundX(baseline.filmNormalWorld, pitchDeg));

      for (const cornerName of ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const) {
        expectVecClose(
          pitched.filmPlaneCornersWorld[cornerName],
          rotatePointAroundX(
            baseline.filmPlaneCornersWorld[cornerName],
            CAMERA_BODY_PIVOT_WORLD,
            pitchDeg,
          ),
        );
      }

      expectPlaneRigidlyTransformed(pitched.focusPlane, baseline.focusPlane, pitchDeg);
      expectPlaneRigidlyTransformed(
        pitched.depthOfFieldNearPlane,
        baseline.depthOfFieldNearPlane,
        pitchDeg,
      );
      expectPlaneRigidlyTransformed(
        pitched.depthOfFieldFarPlane,
        baseline.depthOfFieldFarPlane,
        pitchDeg,
      );
    },
  );

  it("preserves lens-film distance, relative standard geometry, and intrinsic projection", () => {
    const baseline = deriveOpticsState(cameraFor(0), understandingCameraMovementsScene);
    const pitched = deriveOpticsState(cameraFor(8), understandingCameraMovementsScene);

    expect(distance(pitched.lensCenterWorld, pitched.filmCenterWorld)).toBeCloseTo(
      distance(baseline.lensCenterWorld, baseline.filmCenterWorld),
      10,
    );
    expect(
      distance(pitched.filmPlaneCornersWorld.topLeft, pitched.filmPlaneCornersWorld.bottomRight),
    ).toBeCloseTo(
      distance(baseline.filmPlaneCornersWorld.topLeft, baseline.filmPlaneCornersWorld.bottomRight),
      10,
    );
    pitched.offAxisProjectionMatrix.forEach((value, index) => {
      expect(value).toBeCloseTo(baseline.offAxisProjectionMatrix[index], 12);
    });
    expect(
      Object.values(pitched.offAxisProjectionInput)
        .flatMap((value) =>
          "x" in value
            ? [value.x, value.y, value.z]
            : Object.values(value).flatMap((point) => [point.x, point.y, point.z]),
        )
        .every(Number.isFinite),
    ).toBe(true);
    expect(pitched.offAxisProjectionInput).not.toEqual(baseline.offAxisProjectionInput);
  });

  it("keeps zero pitch exactly compatible and ignores body pose for legacy scenes", () => {
    const zero = deriveOpticsState(cameraFor(0), understandingCameraMovementsScene);
    expect(zero.lensCenterWorld).toBe(zero.cameraBodyLocalGeometry.lensCenterLocal);
    expect(zero.filmCenterWorld).toBe(zero.cameraBodyLocalGeometry.filmCenterLocal);
    expect(zero.filmPlaneCornersWorld).toBe(zero.cameraBodyLocalGeometry.filmPlaneCornersLocal);

    const legacyBase = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      cameraBodyPitchDeg: 0,
      cameraBodyPivotWorld: CAMERA_BODY_PIVOT_WORLD,
      activeSceneId: architectureRiseScene.id,
    };
    const legacyZero = deriveOpticsState(legacyBase, architectureRiseScene);
    const legacyNonzero = deriveOpticsState(
      { ...legacyBase, cameraBodyPitchDeg: 8 },
      architectureRiseScene,
    );
    expect(legacyNonzero.cameraBodyTransform.pitchDeg).toBe(0);
    expect(legacyNonzero.lensCenterWorld).toEqual(legacyZero.lensCenterWorld);
    expect(legacyNonzero.filmPlaneCornersWorld).toEqual(legacyZero.filmPlaneCornersWorld);
  });
});
