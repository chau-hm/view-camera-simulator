import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { imageDistanceMm } from "../../core/optics/thinLensModel";
import {
  getSceneById,
  getSceneFocusDistanceRange,
  sceneOrder,
} from "../../scenes/definitions";
import { macroBellowsExtensionScene } from "../../scenes/definitions/macro-bellows-extension";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraAt = (focusDistanceMm: number): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...macroBellowsExtensionScene.cameraPreset,
  activeSceneId: macroBellowsExtensionScene.id,
  mode: "free",
  activeTaskId: null,
  focusDistanceMm,
  focusMode: "finite",
});

describe("macro-bellows-extension scene", () => {
  it("is registered as a finite-focus 150 mm macro scene", () => {
    expect(getSceneById("macro-bellows-extension")).toBe(macroBellowsExtensionScene);
    expect(sceneOrder).toContain("macro-bellows-extension");
    expect(macroBellowsExtensionScene.cameraPreset.focalLengthMm).toBe(150);
    expect(getSceneFocusDistanceRange("macro-bellows-extension", 150)).toEqual({
      min: 300,
      max: 900,
    });
    expect(macroBellowsExtensionScene.cameraPreset.focusDistanceMm).toBeGreaterThan(300);
    expect(macroBellowsExtensionScene.finiteFocusStrategy).toEqual({
      kind: "rear-standard-thin-lens",
      lensDatum: "baseline-origin",
      focusDistanceReference: "lens-to-focus-plane",
      filmDepthReference: "optical-axis-conjugate",
    });
  });

  it("keeps movement, lens, and standard selection fixed while allowing aperture control", () => {
    expect(macroBellowsExtensionScene.cameraPreset).toMatchObject({
      aperture: 5.6,
      frontRiseMm: 0,
      frontShiftMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearShiftMm: 0,
      rearTiltDeg: 0,
      rearSwingDeg: 0,
    });
    expect(macroBellowsExtensionScene.cameraControlPolicy).toEqual({
      movement: "fixed",
      infinityReset: false,
    });
    expect(macroBellowsExtensionScene.movementCapabilities).toBeUndefined();
    expect(macroBellowsExtensionScene.focalLengthCapability).toBeUndefined();
    expect(macroBellowsExtensionScene.focusStandardCapability).toBeUndefined();
    expect(macroBellowsExtensionScene.macroFocusMetricsCapability).toEqual({ enabled: true });
    expect(macroBellowsExtensionScene.focusTargets).toHaveLength(1);
    expect(macroBellowsExtensionScene.focusTargets[0].sampleWorldPositions).toHaveLength(4);
    expect(macroBellowsExtensionScene.macroTeachingCapability).toEqual({
      kind: "bellows-extension",
      groundGlassGridSquareMm: 10,
      availableBellowsTravelMm: 320,
    });
  });

  it.each([
    [900, 180],
    [450, 225],
    [300, 300],
  ])("follows the canonical rear-standard image distance at U=%s mm", (U, v) => {
    const result = deriveOpticsState(cameraAt(U), macroBellowsExtensionScene);

    expect(result.diagnostics.fallbackApplied).toBe(false);
    expect(result.diagnostics.focusObjectDistanceMm).toBe(U);
    expect(result.diagnostics.imageDistanceMm).toBeCloseTo(v, 12);
    expect(result.filmCenterWorld.z).toBeCloseTo(-v, 12);
    expect(result.rearStandardFrame.centerWorld.z).toBeCloseTo(-v, 12);
    expect(result.cameraBodyLocalGeometry.rearStandardFrameLocal.centerWorld.z).toBeCloseTo(
      -v,
      12,
    );
    expect(imageDistanceMm(150, U)).toBeCloseTo(v, 12);
  });

  it("extends the rear standard as focus distance decreases", () => {
    const far = deriveOpticsState(cameraAt(900), macroBellowsExtensionScene);
    const near = deriveOpticsState(cameraAt(300), macroBellowsExtensionScene);

    const farSeparation = Math.abs(
      far.lensCenterWorld.z - far.rearStandardFrame.centerWorld.z,
    );
    const nearSeparation = Math.abs(
      near.lensCenterWorld.z - near.rearStandardFrame.centerWorld.z,
    );
    expect(farSeparation).toBeCloseTo(180, 12);
    expect(nearSeparation).toBeCloseTo(300, 12);
    expect(nearSeparation).toBeGreaterThan(farSeparation);
  });

  it("changes physical blur with aperture without changing macro geometry", () => {
    const wideOpen = deriveOpticsState(
      cameraAt(300),
      macroBellowsExtensionScene,
    );
    const stoppedDown = deriveOpticsState(
      { ...cameraAt(300), aperture: 22 },
      macroBellowsExtensionScene,
    );

    expect(stoppedDown.diagnostics.focusObjectDistanceMm).toBeCloseTo(
      wideOpen.diagnostics.focusObjectDistanceMm!,
      12,
    );
    expect(stoppedDown.diagnostics.imageDistanceMm).toBeCloseTo(
      wideOpen.diagnostics.imageDistanceMm!,
      12,
    );
    expect(stoppedDown.filmCenterWorld.z).toBeCloseTo(wideOpen.filmCenterWorld.z, 12);
    expect(stoppedDown.focusTargets[0].patchEquivalentCoCDiameterMm).toBeLessThan(
      wideOpen.focusTargets[0].patchEquivalentCoCDiameterMm!,
    );
  });
});
