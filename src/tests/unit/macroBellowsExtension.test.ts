import { describe, expect, it } from "vitest";
import { deriveMacroFocusMetrics } from "../../core/optics/deriveMacroFocusMetrics";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { calculateGroundGlassCoverageGain } from "../../core/optics/groundGlassCoverage";
import { calculateGroundGlassNaturalIlluminationGain } from "../../core/optics/groundGlassNaturalIllumination";
import { deriveLensCoverage } from "../../core/optics/lensCoverage";
import { imageDistanceMm } from "../../core/optics/thinLensModel";
import { resolvePhysicalImageCircleRenderGeometry } from "../../render/imageCircleGeometry";
import {
  getSceneById,
  getSceneFocusDistanceRange,
  sceneOrder,
} from "../../scenes/definitions";
import { macroBellowsExtensionScene } from "../../scenes/definitions/macro-bellows-extension";
import type { CameraState } from "../../types/camera";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

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

  it.each([
    [900, 180, 261.56, 0.2, 1.44, 0.53],
    [450, 225, 326.94, 0.5, 2.25, 1.17],
    [300, 300, 435.93, 1, 4, 2],
  ])(
    "keeps canonical coverage, Ground Glass coverage, and macro metrics aligned at U=%s mm",
    (U, v, diameterMm, magnification, bellowsFactor, stops) => {
      const optics = deriveOpticsState(cameraAt(U), macroBellowsExtensionScene);

      expect(optics.diagnostics.imageDistanceMm).toBeCloseTo(v, 12);
      expect(optics.lensDefinition).toMatchObject({
        id: "simulator-parametric-150mm",
        focalLengthMm: 150,
        coverage: { kind: "angular", fullCoverageAngleDeg: 72 },
      });
      expect(optics.lensCoverage?.kind).toBe("angular");
      if (optics.lensCoverage?.kind !== "angular") return;
      expect(optics.lensCoverage.imageCircleDiameterMm).toBeCloseTo(diameterMm, 1);

      expect(optics.groundGlassCoverage.kind).toBe("parallel-circle");
      if (optics.groundGlassCoverage.kind !== "parallel-circle") return;
      expect(optics.groundGlassCoverage.imageCircleRadiusMm).toBeGreaterThan(
        Math.hypot(CAMERA_CONSTANTS.filmWidthMm / 2, CAMERA_CONSTANTS.filmHeightMm / 2),
      );
      for (const x of [-1, 1]) {
        for (const y of [-1, 1]) {
          expect(calculateGroundGlassCoverageGain(
            optics.groundGlassCoverage,
            x * CAMERA_CONSTANTS.filmWidthMm / 2,
            y * CAMERA_CONSTANTS.filmHeightMm / 2,
          )).toBe(1);
        }
      }

      const imageCircle = resolvePhysicalImageCircleRenderGeometry({
        coverage: optics.groundGlassCoverage,
        rearStandardFrame: optics.rearStandardFrame,
      });
      expect(imageCircle?.radiusMm).toBeCloseTo(optics.lensCoverage.imageCircleRadiusMm, 10);
      for (const endpoint of imageCircle?.coverageRayEndpointsWorld ?? []) {
        expect(Math.hypot(
          endpoint.x - imageCircle!.centerWorld.x,
          endpoint.y - imageCircle!.centerWorld.y,
          endpoint.z - imageCircle!.centerWorld.z,
        )).toBeCloseTo(imageCircle!.radiusMm, 7);
      }

      const metrics = deriveMacroFocusMetrics({
        focalLengthMm: 150,
        objectDistanceMm: U,
        imageDistanceMm: v,
      });
      expect(metrics?.magnification).toBeCloseTo(magnification, 12);
      expect(metrics?.bellowsFactor).toBeCloseTo(bellowsFactor, 12);
      expect(metrics?.exposureCompensationStops).toBeCloseTo(stops, 1);

      const cornerGain = calculateGroundGlassNaturalIlluminationGain(
        optics.groundGlassNaturalIllumination,
        CAMERA_CONSTANTS.filmWidthMm / 2,
        CAMERA_CONSTANTS.filmHeightMm / 2,
      );
      expect(cornerGain).toBeGreaterThan(0);
    },
  );

  it("doubles the Image Circle diameter at 1:1 without equating it to the 4x exposure factor", () => {
    const optics = deriveOpticsState(cameraAt(300), macroBellowsExtensionScene);
    expect(optics.lensDefinition).not.toBeNull();
    expect(optics.lensCoverage?.kind).toBe("angular");
    if (optics.lensDefinition?.coverage.kind !== "angular" || optics.lensCoverage?.kind !== "angular") return;

    const infinityReference = deriveLensCoverage(
      optics.lensDefinition.coverage,
      optics.lensDefinition.focalLengthMm,
    );
    expect(infinityReference?.kind).toBe("angular");
    if (infinityReference?.kind !== "angular") return;
    expect(optics.lensCoverage.imageCircleDiameterMm).toBeCloseTo(435.93, 1);
    expect(optics.lensCoverage.imageCircleDiameterMm / infinityReference.imageCircleDiameterMm).toBeCloseTo(2, 12);

    const metrics = deriveMacroFocusMetrics({
      focalLengthMm: 150,
      objectDistanceMm: 300,
      imageDistanceMm: optics.diagnostics.imageDistanceMm!,
    });
    expect(metrics?.magnification).toBeCloseTo(1, 12);
    expect(metrics?.bellowsFactor).toBeCloseTo(4, 12);
    expect(metrics?.exposureCompensationStops).toBeCloseTo(2, 12);
  });

  it("reduces relative film-corner falloff as image distance increases", () => {
    const cornerGains = [900, 450, 300].map((focusDistanceMm) => {
      const optics = deriveOpticsState(cameraAt(focusDistanceMm), macroBellowsExtensionScene);
      return calculateGroundGlassNaturalIlluminationGain(
        optics.groundGlassNaturalIllumination,
        CAMERA_CONSTANTS.filmWidthMm / 2,
        CAMERA_CONSTANTS.filmHeightMm / 2,
      );
    });
    expect(cornerGains[1]).toBeGreaterThan(cornerGains[0]);
    expect(cornerGains[2]).toBeGreaterThan(cornerGains[1]);
  });

  it("keeps closer focus, longer image distance, larger coverage, and stronger bellows cost monotonic", () => {
    const checkpoints = [900, 450, 300].map((focusDistanceMm) => {
      const optics = deriveOpticsState(cameraAt(focusDistanceMm), macroBellowsExtensionScene);
      const metrics = deriveMacroFocusMetrics({
        focalLengthMm: 150,
        objectDistanceMm: focusDistanceMm,
        imageDistanceMm: optics.diagnostics.imageDistanceMm!,
      });
      expect(optics.lensCoverage?.kind).toBe("angular");
      if (optics.lensCoverage?.kind !== "angular" || !metrics) return null;
      return {
        focusDistanceMm,
        imageDistanceMm: optics.lensCoverage.imageDistanceMm,
        imageCircleDiameterMm: optics.lensCoverage.imageCircleDiameterMm,
        magnification: metrics.magnification,
        bellowsFactor: metrics.bellowsFactor,
        exposureCompensationStops: metrics.exposureCompensationStops,
      };
    });
    expect(checkpoints.every((checkpoint) => checkpoint !== null)).toBe(true);
    const [far, middle, close] = checkpoints;
    if (!far || !middle || !close) return;
    for (const [farValue, closeValue] of [
      [far.imageDistanceMm, middle.imageDistanceMm],
      [middle.imageDistanceMm, close.imageDistanceMm],
      [far.imageCircleDiameterMm, middle.imageCircleDiameterMm],
      [middle.imageCircleDiameterMm, close.imageCircleDiameterMm],
      [far.magnification, middle.magnification],
      [middle.magnification, close.magnification],
      [far.bellowsFactor, middle.bellowsFactor],
      [middle.bellowsFactor, close.bellowsFactor],
      [far.exposureCompensationStops, middle.exposureCompensationStops],
      [middle.exposureCompensationStops, close.exposureCompensationStops],
    ]) {
      expect(closeValue).toBeGreaterThan(farValue);
    }
    expect(close.focusDistanceMm).toBeLessThan(middle.focusDistanceMm);
    expect(middle.focusDistanceMm).toBeLessThan(far.focusDistanceMm);
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
    expect(stoppedDown.lensCoverage?.kind).toBe("angular");
    expect(wideOpen.lensCoverage?.kind).toBe("angular");
    if (stoppedDown.lensCoverage?.kind === "angular" && wideOpen.lensCoverage?.kind === "angular") {
      expect(stoppedDown.lensCoverage.imageCircleDiameterMm).toBeCloseTo(
        wideOpen.lensCoverage.imageCircleDiameterMm,
        12,
      );
    }
    const wideOpenCircle = resolvePhysicalImageCircleRenderGeometry({
      coverage: wideOpen.groundGlassCoverage,
      rearStandardFrame: wideOpen.rearStandardFrame,
    });
    const stoppedDownCircle = resolvePhysicalImageCircleRenderGeometry({
      coverage: stoppedDown.groundGlassCoverage,
      rearStandardFrame: stoppedDown.rearStandardFrame,
    });
    expect(stoppedDownCircle?.radiusMm).toBeCloseTo(wideOpenCircle?.radiusMm ?? Number.NaN, 12);
    expect(stoppedDown.focusTargets[0].patchEquivalentCoCDiameterMm).toBeLessThan(
      wideOpen.focusTargets[0].patchEquivalentCoCDiameterMm!,
    );
  });
});
