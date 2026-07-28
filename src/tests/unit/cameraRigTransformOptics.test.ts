import { describe, expect, it } from "vitest";
import {
  add,
  distance,
  dot,
  magnitude,
  rotateAroundX,
  rotatePointAroundX,
  subtract,
} from "../../core/math/vec";
import {
  applyCameraRigTransform,
  transformRigLocalPointToWorld,
} from "../../core/optics/applyCameraBodyPitch";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import {
  CAMERA_BODY_PIVOT_RIG_LOCAL,
  CAMERA_RIG_VIEWPOINT_ANCHORS,
} from "../../scenes/understandingCameraMovementsGeometry";
import type { CameraState } from "../../types/camera";
import type { CameraRigTransform, Plane, Vec3 } from "../../types/optics";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const expectVecClose = (actual: Vec3, expected: Vec3, digits = 10): void => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
};

const finiteCamera = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...understandingCameraMovementsScene.cameraPreset,
  cameraBodyPivotWorld: CAMERA_BODY_PIVOT_RIG_LOCAL,
  viewpointAnchor: "mid",
  cameraRigPlacement: CAMERA_RIG_VIEWPOINT_ANCHORS.mid,
  activeSceneId: understandingCameraMovementsScene.id,
  ...overrides,
});

const expectedPoint = (point: Vec3, transform: CameraRigTransform): Vec3 =>
  add(
    transform.rigOriginWorld,
    rotateAroundX(
      rotatePointAroundX(
        point,
        transform.bodyPitchPivotRigLocal,
        transform.bodyPitchDeg,
      ),
      transform.basePitchDeg,
    ),
  );

const expectPlaneTransformed = (
  actual: Plane | null | undefined,
  baseline: Plane | null | undefined,
  transform: CameraRigTransform,
): void => {
  expect(actual).toBeTruthy();
  expect(baseline).toBeTruthy();
  expectVecClose(actual!.point, expectedPoint(baseline!.point, transform));
  expectVecClose(
    actual!.normal,
    rotateAroundX(
      rotateAroundX(baseline!.normal, transform.bodyPitchDeg),
      transform.basePitchDeg,
    ),
  );
};

describe("canonical camera rig transform", () => {
  it("preserves local geometry, film size, lens-film separation, and axial focus distance across anchors", () => {
    const opticsByAnchor = (["mid", "high", "low"] as const).map((anchor) =>
      deriveOpticsState(
        finiteCamera({
          viewpointAnchor: anchor,
          cameraRigPlacement: CAMERA_RIG_VIEWPOINT_ANCHORS[anchor],
        }),
        understandingCameraMovementsScene,
      ),
    );
    const baseline = opticsByAnchor[0];
    const baselineLensFilmDistance = distance(
      baseline.lensCenterWorld,
      baseline.filmCenterWorld,
    );
    const baselineFilmWidth = distance(
      baseline.filmPlaneCornersWorld.topLeft,
      baseline.filmPlaneCornersWorld.topRight,
    );
    const baselineFilmHeight = distance(
      baseline.filmPlaneCornersWorld.topLeft,
      baseline.filmPlaneCornersWorld.bottomLeft,
    );

    for (const optics of opticsByAnchor) {
      expect(optics.cameraBodyLocalGeometry).toEqual(
        baseline.cameraBodyLocalGeometry,
      );
      expect(distance(optics.lensCenterWorld, optics.filmCenterWorld)).toBeCloseTo(
        baselineLensFilmDistance,
        10,
      );
      expect(
        distance(
          optics.filmPlaneCornersWorld.topLeft,
          optics.filmPlaneCornersWorld.topRight,
        ),
      ).toBeCloseTo(baselineFilmWidth, 10);
      expect(
        distance(
          optics.filmPlaneCornersWorld.topLeft,
          optics.filmPlaneCornersWorld.bottomLeft,
        ),
      ).toBeCloseTo(baselineFilmHeight, 10);

      const frame = optics.rearStandardFrame;
      for (const basis of [frame.rightWorld, frame.upWorld, frame.normalWorld]) {
        expect(magnitude(basis)).toBeCloseTo(1, 12);
      }
      expect(dot(frame.rightWorld, frame.upWorld)).toBeCloseTo(0, 12);
      expect(dot(frame.rightWorld, frame.normalWorld)).toBeCloseTo(0, 12);
      expect(dot(frame.upWorld, frame.normalWorld)).toBeCloseTo(0, 12);

      const lensToFocus = subtract(
        optics.focusPointWorld,
        optics.lensCenterWorld,
      );
      expect(dot(lensToFocus, optics.opticalAxis.direction)).toBeCloseTo(
        finiteCamera().focusDistanceMm,
        9,
      );
      expect(optics.offAxisProjectionMatrix.every(Number.isFinite)).toBe(true);
    }
  });

  it.each(["high", "low"] as const)(
    "rotates body pitch rigidly around the transformed %s tripod pivot",
    (anchor) => {
      const zero = deriveOpticsState(
        finiteCamera({
          viewpointAnchor: anchor,
          cameraRigPlacement: CAMERA_RIG_VIEWPOINT_ANCHORS[anchor],
        }),
        understandingCameraMovementsScene,
      );
      const pitched = deriveOpticsState(
        finiteCamera({
          viewpointAnchor: anchor,
          cameraRigPlacement: CAMERA_RIG_VIEWPOINT_ANCHORS[anchor],
          cameraBodyPitchDeg: 8,
        }),
        understandingCameraMovementsScene,
      );

      expectVecClose(pitched.cameraBodyPivotWorld, zero.cameraBodyPivotWorld);
      expectVecClose(
        pitched.lensCenterWorld,
        expectedPoint(
          pitched.cameraBodyLocalGeometry.lensCenterLocal,
          pitched.cameraRigTransform,
        ),
      );
      expect(distance(pitched.lensCenterWorld, pitched.cameraBodyPivotWorld)).toBeCloseTo(
        distance(zero.lensCenterWorld, zero.cameraBodyPivotWorld),
        10,
      );
    },
  );

  it("composes local body pitch before a synthetic non-zero outer rig pitch", () => {
    const baseline = deriveOpticsState(
      finiteCamera({ frontRiseMm: 18, frontTiltDeg: 4, rearRiseMm: 11, rearTiltDeg: -3 }),
      understandingCameraMovementsScene,
    );
    const transform: CameraRigTransform = {
      rigOriginWorld: CAMERA_RIG_VIEWPOINT_ANCHORS.high.rigOriginWorld,
      basePitchDeg: 12,
      bodyPitchDeg: 8,
      bodyPitchPivotRigLocal: CAMERA_BODY_PIVOT_RIG_LOCAL,
    };

    const transformed = applyCameraRigTransform(baseline.cameraBodyLocalGeometry, transform);

    expectVecClose(
      transformed.lensCenterWorld,
      expectedPoint(baseline.cameraBodyLocalGeometry.lensCenterLocal, transform),
    );
    expectVecClose(
      transformed.filmCenterWorld,
      expectedPoint(baseline.cameraBodyLocalGeometry.filmCenterLocal, transform),
    );
    expectPlaneTransformed(
      transformed.lensPlane,
      baseline.cameraBodyLocalGeometry.lensPlaneLocal,
      transform,
    );
    expectPlaneTransformed(
      transformed.filmPlane,
      baseline.cameraBodyLocalGeometry.filmPlaneLocal,
      transform,
    );
    expectVecClose(
      transformed.cameraBodyPivotWorld,
      add(
        transform.rigOriginWorld,
        rotateAroundX(transform.bodyPitchPivotRigLocal, transform.basePitchDeg),
      ),
    );
    for (const corner of ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const) {
      expectVecClose(
        transformed.filmPlaneCornersWorld[corner],
        expectedPoint(baseline.cameraBodyLocalGeometry.filmPlaneCornersLocal[corner], transform),
      );
    }
    expectVecClose(
      transformed.rearStandardFrame.rightWorld,
      rotateAroundX(
        rotateAroundX(
          baseline.cameraBodyLocalGeometry.rearStandardFrameLocal.rightWorld,
          transform.bodyPitchDeg,
        ),
        transform.basePitchDeg,
      ),
    );

    const reverseOrderLens = rotatePointAroundX(
      add(
        transform.rigOriginWorld,
        rotateAroundX(
          baseline.cameraBodyLocalGeometry.lensCenterLocal,
          transform.basePitchDeg,
        ),
      ),
      transform.bodyPitchPivotRigLocal,
      transform.bodyPitchDeg,
    );
    expect(distance(transformed.lensCenterWorld, reverseOrderLens)).toBeGreaterThan(1);
  });

  it("propagates placement through finite focus, DOF, and Ground Glass projection inputs", () => {
    const localMovements = { frontTiltDeg: 4, rearTiltDeg: -3 };
    const baseline = deriveOpticsState(
      finiteCamera(localMovements),
      understandingCameraMovementsScene,
    );
    const camera = finiteCamera({
      ...localMovements,
      cameraBodyPitchDeg: 8,
      viewpointAnchor: "high",
      cameraRigPlacement: {
        ...CAMERA_RIG_VIEWPOINT_ANCHORS.high,
        basePitchDeg: 12,
      },
    });
    const transformed = deriveOpticsState(camera, understandingCameraMovementsScene);
    const transform = transformed.cameraRigTransform;

    expect(transformed.cameraRigPlacement).toBe(camera.cameraRigPlacement);
    expect(transform).toEqual({
      rigOriginWorld: CAMERA_RIG_VIEWPOINT_ANCHORS.high.rigOriginWorld,
      basePitchDeg: 12,
      bodyPitchDeg: 8,
      bodyPitchPivotRigLocal: CAMERA_BODY_PIVOT_RIG_LOCAL,
    });
    expectVecClose(transformed.lensCenterWorld, expectedPoint(baseline.lensCenterWorld, transform));
    expectVecClose(transformed.filmCenterWorld, expectedPoint(baseline.filmCenterWorld, transform));
    expectVecClose(transformed.focusPointWorld, expectedPoint(baseline.focusPointWorld, transform));
    expectPlaneTransformed(transformed.focusPlane, baseline.focusPlane, transform);
    expectPlaneTransformed(
      transformed.depthOfFieldNearPlane,
      baseline.depthOfFieldNearPlane,
      transform,
    );
    expectPlaneTransformed(
      transformed.depthOfFieldFarPlane,
      baseline.depthOfFieldFarPlane,
      transform,
    );
    expect(transformed.offAxisProjectionInput.lensCenterWorld).toEqual(
      transformed.lensCenterWorld,
    );
    expect(transformed.offAxisProjectionInput.filmCornersWorld).toEqual(
      transformed.filmPlaneCornersWorld,
    );
    transformed.offAxisProjectionMatrix.forEach((value, index) => {
      expect(value).toBeCloseTo(baseline.offAxisProjectionMatrix[index], 11);
    });
  });

  it.each([
    ["infinity", { focusMode: "infinity" } as Partial<CameraState>],
    ["fallback", { focalLengthMm: Number.NaN } as Partial<CameraState>],
  ])("keeps the %s path finite after outer placement", (_label, overrides) => {
    const optics = deriveOpticsState(
      finiteCamera({
        cameraBodyPitchDeg: -5,
        viewpointAnchor: "low",
        cameraRigPlacement: {
          ...CAMERA_RIG_VIEWPOINT_ANCHORS.low,
          basePitchDeg: -7,
        },
        ...overrides,
      }),
      understandingCameraMovementsScene,
    );

    expect(
      [
        optics.cameraBodyPivotWorld,
        optics.lensCenterWorld,
        optics.lensNormalWorld,
        optics.filmCenterWorld,
        optics.filmNormalWorld,
        ...Object.values(optics.filmPlaneCornersWorld),
      ]
        .flatMap((point) => [point.x, point.y, point.z])
        .every(Number.isFinite),
    ).toBe(true);
    expect(optics.offAxisProjectionMatrix.every(Number.isFinite)).toBe(true);
    expect(optics.cameraRigPlacement.anchor).toBe("low");
  });

  it("falls back to identity placement when state anchor and placement do not match", () => {
    const optics = deriveOpticsState(
      finiteCamera({
        viewpointAnchor: "high",
        cameraRigPlacement: CAMERA_RIG_VIEWPOINT_ANCHORS.low,
      }),
      understandingCameraMovementsScene,
    );

    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.diagnostics.errorMessage).toBe("Invalid camera input");
    expect(optics.cameraRigPlacement.anchor).toBe("mid");
    expect(optics.cameraRigTransform).toEqual({
      rigOriginWorld: { x: 0, y: 0, z: 0 },
      basePitchDeg: 0,
      bodyPitchDeg: 0,
      bodyPitchPivotRigLocal: CAMERA_BODY_PIVOT_RIG_LOCAL,
    });
  });

  it("validates explicit placement on the infinity path", () => {
    const optics = deriveOpticsState(
      finiteCamera({
        focusMode: "infinity",
        viewpointAnchor: "high",
        cameraRigPlacement: {
          ...CAMERA_RIG_VIEWPOINT_ANCHORS.high,
          rigOriginWorld: {
            ...CAMERA_RIG_VIEWPOINT_ANCHORS.high.rigOriginWorld,
            y: Number.NaN,
          },
        },
      }),
      understandingCameraMovementsScene,
    );

    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.diagnostics.errorMessage).toBe("Invalid input values for infinity focus");
    expect(optics.cameraRigPlacement.anchor).toBe("mid");
    expect(
      [
        optics.lensCenterWorld,
        optics.filmCenterWorld,
        optics.cameraBodyPivotWorld,
      ]
        .flatMap((point) => [point.x, point.y, point.z])
        .every(Number.isFinite),
    ).toBe(true);
  });

  it("forces identity placement for scenes without the rig capability", () => {
    const camera = finiteCamera({
      viewpointAnchor: "high",
      cameraRigPlacement: CAMERA_RIG_VIEWPOINT_ANCHORS.high,
    });
    const legacyScene = {
      ...understandingCameraMovementsScene,
      cameraBodyPitchCapability: undefined,
    };
    const optics = deriveOpticsState(camera, legacyScene);

    expect(optics.cameraRigPlacement.anchor).toBe("mid");
    expect(optics.cameraRigTransform).toEqual({
      rigOriginWorld: { x: 0, y: 0, z: 0 },
      basePitchDeg: 0,
      bodyPitchDeg: 0,
      bodyPitchPivotRigLocal: { x: 0, y: 0, z: 0 },
    });
  });

  it("rejects non-finite canonical transform inputs loudly", () => {
    const local = deriveOpticsState(
      finiteCamera(),
      understandingCameraMovementsScene,
    ).cameraBodyLocalGeometry;
    expect(() =>
      transformRigLocalPointToWorld(local.lensCenterLocal, {
        rigOriginWorld: { x: 0, y: Number.NaN, z: 0 },
        basePitchDeg: 0,
        bodyPitchDeg: 0,
        bodyPitchPivotRigLocal: CAMERA_BODY_PIVOT_RIG_LOCAL,
      }),
    ).toThrow(/origin must be finite/);
  });
});
