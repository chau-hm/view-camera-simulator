import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import {
  MIRROR_SHIFT_SCENE_CALIBRATION,
  measureMirrorShiftTeachingState,
  resolveMirrorShiftTeachingState,
} from "../../scenes/mirrorShiftCalibration";
import { resolveMirrorShiftTeachingDiagramModel } from "../../scenes/mirrorShiftTeachingGeometry";
import { mirrorShiftGeometry } from "../../scenes/mirrorShiftGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const opticsFor = (rigLateralMm: number, frontShiftMm: number) =>
  deriveOpticsState(
    {
      ...DEFAULT_CAMERA_STATE,
      ...mirrorShiftScene.cameraPreset,
      activeSceneId: mirrorShiftScene.id,
      activeTaskId: null,
      mode: "free",
      mirrorShiftLessonState: { rigLateralMm },
      frontShiftMm,
    },
    mirrorShiftScene,
  );

const calibrationOptics = (name: "neutral" | "camera-moved" | "framing-restored") => {
  const values = resolveMirrorShiftTeachingState(name);
  return { values, optics: opticsFor(values.rigLateralMm, values.frontShiftMm) };
};

describe("Mirror Shift teaching calibration", () => {
  it("defines A/B/C with a shared moved rig and distinct front shift", () => {
    const neutral = resolveMirrorShiftTeachingState("neutral");
    const moved = resolveMirrorShiftTeachingState("camera-moved");
    const restored = resolveMirrorShiftTeachingState("framing-restored");

    expect(neutral).toEqual({ rigLateralMm: 0, frontShiftMm: 0 });
    expect(moved.frontShiftMm).toBe(0);
    expect(restored.rigLateralMm).toBe(moved.rigLateralMm);
    expect(restored.frontShiftMm).toBeLessThan(0);
  });

  it("proves framing restoration, camera clearance, parallax, and rectangularity", () => {
    const neutral = calibrationOptics("neutral");
    const moved = calibrationOptics("camera-moved");
    const restored = calibrationOptics("framing-restored");
    const neutralMetrics = measureMirrorShiftTeachingState(neutral.optics, neutral.values);
    const movedMetrics = measureMirrorShiftTeachingState(moved.optics, moved.values);
    const restoredMetrics = measureMirrorShiftTeachingState(restored.optics, restored.values);
    const tolerances = MIRROR_SHIFT_SCENE_CALIBRATION.tolerances;

    expect(neutralMetrics.mirrorCenter.uRaw).toBeCloseTo(0.5, 10);
    expect(Math.abs(movedMetrics.mirrorCenter.uRaw - neutralMetrics.mirrorCenter.uRaw)).toBeGreaterThanOrEqual(
      tolerances.minimumMovedMirrorDisplacementNormalized,
    );
    expect(Math.abs(restoredMetrics.mirrorCenter.uRaw - neutralMetrics.mirrorCenter.uRaw)).toBeLessThanOrEqual(
      tolerances.mirrorFramingRestoredNormalized,
    );

    expect(neutralMetrics.cameraReflection.intersectsMirrorAperture).toBe(true);
    expect(movedMetrics.cameraReflection.intersectsMirrorAperture).toBe(false);
    expect(restoredMetrics.cameraReflection.intersectsMirrorAperture).toBe(false);
    expect(movedMetrics.cameraReflection.clearanceMm).toBeGreaterThanOrEqual(
      tolerances.cameraReflectionClearanceMm,
    );
    expect(restoredMetrics.cameraReflection.clearanceMm).toBeGreaterThanOrEqual(
      tolerances.cameraReflectionClearanceMm,
    );

    expect(Math.abs(restoredMetrics.reflectedPropSeparationNormalized - neutralMetrics.reflectedPropSeparationNormalized)).toBeGreaterThanOrEqual(
      tolerances.minimumPropParallaxDeltaNormalized,
    );
    for (const metrics of [neutralMetrics, movedMetrics, restoredMetrics]) {
      expect(metrics.rectangularity.maxResidual).toBeLessThanOrEqual(
        tolerances.mirrorRectangularityResidual,
      );
    }
  });

  it("keeps the B/C rig and film fixed while changing only the front/lens geometry", () => {
    const moved = calibrationOptics("camera-moved");
    const restored = calibrationOptics("framing-restored");

    expect(moved.values.rigLateralMm).toBe(restored.values.rigLateralMm);
    expect(restored.optics.cameraRigTransform.rigOriginWorld).toEqual(
      moved.optics.cameraRigTransform.rigOriginWorld,
    );
    expect(restored.optics.filmCenterWorld).toEqual(moved.optics.filmCenterWorld);
    expect(restored.optics.filmPlaneCornersWorld).toEqual(moved.optics.filmPlaneCornersWorld);
    expect(restored.optics.rearStandardFrame).toEqual(moved.optics.rearStandardFrame);
    expect(restored.optics.lensCenterWorld.x).not.toBe(moved.optics.lensCenterWorld.x);
    expect(restored.optics.lensCenterWorld.x).toBeCloseTo(1945, 10);
  });

  it("derives the top-view current/neutral construction from canonical optics", () => {
    const neutral = calibrationOptics("neutral");
    const moved = calibrationOptics("camera-moved");
    const restored = calibrationOptics("framing-restored");
    const neutralModel = resolveMirrorShiftTeachingDiagramModel({
      neutralOptics: neutral.optics,
      currentOptics: neutral.optics,
    });
    const movedModel = resolveMirrorShiftTeachingDiagramModel({
      neutralOptics: neutral.optics,
      currentOptics: moved.optics,
    });
    const restoredModel = resolveMirrorShiftTeachingDiagramModel({
      neutralOptics: neutral.optics,
      currentOptics: restored.optics,
    });

    expect(neutralModel.current.filmCenter).toEqual(neutralModel.neutral.filmCenter);
    expect(neutralModel.current.lensCenter).toEqual(neutralModel.neutral.lensCenter);
    expect(movedModel.current.filmCenter.x - movedModel.neutral.filmCenter.x).toBeCloseTo(2000, 10);
    expect(movedModel.current.lensCenter.x - movedModel.current.filmCenter.x).toBe(0);
    expect(restoredModel.current.filmCenter).toEqual(movedModel.current.filmCenter);
    expect(restoredModel.current.lensCenter.x - restoredModel.current.filmCenter.x).toBe(-55);
    expect(restoredModel.frontShiftCue).not.toBeNull();
    expect(restoredModel.current.chiefRay.lensPoint).toEqual(restored.optics.lensCenterWorld);
    expect(restoredModel.current.chiefRay.filmPoint).not.toBeNull();
    expect(restoredModel.bounds.min.x).toBeLessThan(mirrorShiftGeometry.mirror.center.x);
    expect(restoredModel.bounds.max.x).toBeGreaterThan(restored.optics.filmCenterWorld.x);
  });
});
