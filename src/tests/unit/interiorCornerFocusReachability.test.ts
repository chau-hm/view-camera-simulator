import { describe, expect, it } from "vitest";
import { calibrateShelfSwing, type ShelfSwingVec3 } from "../../scenes/shelfSwingGeometry";
import { getSceneFocusDistanceRange } from "../../scenes/definitions";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import geometry from "../../scenes/interiorCornerGeometry";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../../utils/constants";
import { roundToStep } from "../../utils/roundToStep";

describe("Interior Corner future Swing focus reachability", () => {
  it("keeps the canonical receding-wall solution inside the public Focus grid", () => {
    const focusProbes = geometry.focusTargets.map((target) => target.worldPosition) as [
      ShelfSwingVec3,
      ShelfSwingVec3,
      ShelfSwingVec3,
    ];
    const focalLengthMm =
      interiorCornerScene.cameraPreset.focalLengthMm ?? CAMERA_CONSTANTS.focalLengthMm;
    const calibration = calibrateShelfSwing({
      focalLengthMm,
      focusProbes,
    });
    const publicFocusDistanceMm = roundToStep(
      calibration.focusDistanceMm,
      CAMERA_CONTROL_STEPS.focusDistanceMm,
    );
    const focusRange = getSceneFocusDistanceRange(
      interiorCornerScene.id,
      focalLengthMm,
    );
    const publicGridFocusAtOrAbovePhysicalMm =
      Math.ceil(calibration.focusDistanceMm / CAMERA_CONTROL_STEPS.focusDistanceMm) *
      CAMERA_CONTROL_STEPS.focusDistanceMm;

    expect(new Set(focusProbes.map((probe) => probe.x)).size).toBe(1);
    expect(new Set(focusProbes.map((probe) => probe.y)).size).toBe(1);
    expect(calibration.frontSwingDeg).toBeGreaterThan(0);
    expect(calibration.frontSwingDeg).toBeCloseTo(3.5953, 3);
    expect(calibration.focusDistanceMm).toBeCloseTo(38144.4267, 3);

    expect(publicFocusDistanceMm).toBe(38140);
    expect(publicFocusDistanceMm % CAMERA_CONTROL_STEPS.focusDistanceMm).toBe(0);
    expect(publicGridFocusAtOrAbovePhysicalMm).toBe(38150);
    expect(publicGridFocusAtOrAbovePhysicalMm).toBeLessThanOrEqual(focusRange.max);
    expect(calibration.focusDistanceMm).toBeLessThanOrEqual(focusRange.max);

    // This is the previous PR12A ceiling: the physical solution must not fit
    // only because the scene range was widened by an arbitrary amount.
    const previousRangeMaxMm = geometry.room.farZ + 300;
    expect(previousRangeMaxMm).toBe(11300);
    expect(previousRangeMaxMm).toBeLessThan(calibration.focusDistanceMm);
  });
});
