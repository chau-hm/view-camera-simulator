import { describe, expect, it } from "vitest";
import { distance } from "../../core/math/vec";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  resolveCameraMovementGroundGlassComparison,
} from "../../scenes/cameraMovementGroundGlassComparison";
import {
  CAMERA_MOVEMENT_CALIBRATION_BASELINE,
  resolveEffectiveCameraMovementCalibration,
} from "../../scenes/cameraMovementEffectiveCalibration";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { resolveCameraRigViewpointAnchor } from "../../scenes/cameraRigViewpointGeometry";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";
import { CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS } from "../../scenes/cameraMovementTeachingCases";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraForRoute = (overrides: Partial<typeof DEFAULT_CAMERA_STATE> = {}) => ({
  ...DEFAULT_CAMERA_STATE,
  activeSceneId: understandingCameraMovementsScene.id,
  cameraRigPlacement: resolveCameraRigViewpointAnchor(
    CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig,
    overrides.viewpointAnchor ?? "mid",
  ),
  ...overrides,
});

describe("camera-movement Ground Glass comparison resolver", () => {
  it("derives a frozen neutral Original from the same canonical calibration as Current", () => {
    const result = resolveCameraMovementGroundGlassComparison({
      camera: {
        ...cameraForRoute(),
      },
    });

    expect(result.sceneId).toBe(understandingCameraMovementsScene.id);
    expect(result.targetRegion).toBe("middle");
    expect(result.original.targetRegion).toBe(result.current.targetRegion);
    expect(result.original.camera.viewpointAnchor).toBe("mid");
    expect(result.original.camera.frontRiseMm).toBe(0);
    expect(result.original.camera.rearRiseMm).toBe(0);
    expect(result.original.camera.frontTiltDeg).toBe(0);
    expect(result.original.camera.rearTiltDeg).toBe(0);
    expect(result.original.opticsState.diagnostics.fallbackApplied).toBe(false);
    expect(result.current.opticsState.diagnostics.fallbackApplied).toBe(false);
    expect(result.shared.focalLengthMm).toBe(result.original.camera.focalLengthMm);
    expect(result.shared.focusDistanceMm).toBe(result.original.camera.focusDistanceMm);
    expect(result.shared.aperture).toBe(result.original.camera.aperture);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.original)).toBe(true);
    expect(Object.isFrozen(result.original.camera)).toBe(true);
    expect(Object.isFrozen(result.original.opticsState)).toBe(true);
  });

  it.each([
    ["high", "upper"],
    ["low", "lower"],
  ] as const)(
    "uses the same %s target-region semantics on both layers",
    (anchor: "high" | "low", region: "upper" | "lower") => {
      const camera = {
        ...cameraForRoute({
        viewpointAnchor: anchor,
        cameraBodyPitchDeg:
          anchor === "high"
            ? CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg
            : -CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg,
        }),
      };
      const result = resolveCameraMovementGroundGlassComparison({
        camera,
        targetRegion: region,
      });

      expect(result.targetRegion).toBe(region);
      expect(result.originalTargetRegion).toBe(region);
      expect(result.currentTargetRegion).toBe(region);
      expect(result.original.targetRegion).toBe(region);
      expect(result.current.targetRegion).toBe(region);
      expect(result.original.camera.viewpointAnchor).toBe("mid");
      expect(result.current.camera.viewpointAnchor).toBe(anchor);
      expect(result.original.calibrationKey).toBe(result.current.calibrationKey);
      expect(
        distance(
          result.original.opticsState.cameraRigPlacement.rigOriginWorld,
          CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig.arcCenterWorld,
        ),
      ).toBeCloseTo(2000, 12);
      expect(
        distance(
          result.current.opticsState.cameraRigPlacement.rigOriginWorld,
          CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig.arcCenterWorld,
        ),
      ).toBeCloseTo(1520, 12);
    },
  );

  it("keeps effective calibration identity and physical values shared after an override", () => {
    const calibration = resolveEffectiveCameraMovementCalibration(
      CAMERA_MOVEMENT_CALIBRATION_BASELINE,
      {
        optics: { provisionalFocalLengthMm: 120, provisionalFocusDistanceMm: 2400 },
        geometry: { subjectDistanceMm: 2400 },
      },
    );
    const camera = {
      ...cameraForRoute(),
      focalLengthMm: calibration.optics.provisionalFocalLengthMm,
      focusDistanceMm: calibration.optics.provisionalFocusDistanceMm,
    };
    const result = resolveCameraMovementGroundGlassComparison({
      camera,
      effectiveCalibration: calibration,
    });

    expect(result.shared).toMatchObject({
      focalLengthMm: 120,
      focusDistanceMm: 2400,
      calibrationKey: calibration.effectiveKey,
      effectiveKey: calibration.effectiveKey,
    });
    expect(result.calibration).toEqual({
      effectiveKey: calibration.effectiveKey,
      subjectGeometryKey: calibration.subjectGeometryKey,
      opticsKey: calibration.opticsKey,
      rigKey: calibration.rigKey,
    });
    expect(result.original.opticsState.lensCenterWorld).toEqual(
      result.current.opticsState.lensCenterWorld,
    );
  });

  it("uses supplied Current optics without mutating the caller's object", () => {
    const camera = {
      ...cameraForRoute(),
      frontRiseMm: 20,
    };
    const currentOptics = deriveOpticsState(camera, understandingCameraMovementsScene);
    const before = currentOptics.lensCenterWorld.y;
    const result = resolveCameraMovementGroundGlassComparison({
      camera,
      currentOptics,
    });

    expect(result.current.opticsState.lensCenterWorld.y).toBe(before);
    expect(currentOptics.lensCenterWorld.y).toBe(before);
    expect(result.current.opticsState).not.toBe(currentOptics);
  });
});
