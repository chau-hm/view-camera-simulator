import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { resolveGroundGlassCoverageUniformState } from "../../render/groundGlassCoverage";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { resolveGroundGlassNaturalIlluminationUniformState } from "../../render/groundGlassNaturalIllumination";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import {
  applyGroundGlassRttDisplayTransform,
  resolveGroundGlassRttDisplayTransform,
} from "../../render/groundGlassRttOrientation";
import { WORLD_SCALE } from "../../render/rttUtils";
import { macroDepthOfFieldScene } from "../../scenes/definitions/macro-depth-of-field";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import {
  FULL_GROUND_GLASS_INSPECTION_WINDOW,
  mapGroundGlassDisplayUvToRttSourceTopUv,
  mapGroundGlassInspectionWindowToRttSourceCrop,
  resolveGroundGlassInspectionFrustum,
  resolveGroundGlassInspectionWindow,
  resolveGroundGlassInspectionFilmWindowMm,
  resolveSampledFilmDimensionsMm,
} from "../../render/groundGlassInspectionWindow";

describe("Ground Glass physical inspection window", () => {
  it("keeps the inactive window at the complete film", () => {
    expect(resolveGroundGlassInspectionWindow({ active: false })).toEqual(
      FULL_GROUND_GLASS_INSPECTION_WINDOW,
    );
  });

  it("maps the centered 4x loupe to a quarter-size film window", () => {
    const window = resolveGroundGlassInspectionWindow({
      active: true,
      normalizedPan: { x: 0, y: 0 },
      magnification: 4,
    });

    expect(window).toEqual({
      active: true,
      centerU: 0.5,
      centerV: 0.5,
      widthFraction: 0.25,
      heightFraction: 0.25,
    });
    expect(resolveSampledFilmDimensionsMm({
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: window,
    })).toEqual({ widthMm: 31.75, heightMm: 25.4 });
  });

  it("keeps pan at the physical film edges without leaving the film", () => {
    const right = resolveGroundGlassInspectionWindow({
      active: true,
      normalizedPan: { x: -1, y: 0 },
      magnification: 4,
    });
    const upper = resolveGroundGlassInspectionWindow({
      active: true,
      normalizedPan: { x: 0, y: 1 },
      magnification: 4,
    });

    expect(right.centerU).toBeCloseTo(0.875, 12);
    expect(upper.centerV).toBeCloseTo(0.125, 12);
    expect(right.centerU - right.widthFraction / 2).toBeGreaterThanOrEqual(0);
    expect(right.centerU + right.widthFraction / 2).toBeLessThanOrEqual(1);
    expect(upper.centerV - upper.heightFraction / 2).toBeGreaterThanOrEqual(0);
    expect(upper.centerV + upper.heightFraction / 2).toBeLessThanOrEqual(1);
  });

  it("interpolates a cropped off-axis frustum while preserving its near/far range", () => {
    const full = { left: -4, right: 6, top: 8, bottom: -2, near: 0.1, far: 50 };
    const crop = resolveGroundGlassInspectionFrustum(full, {
      active: true,
      centerU: 0.75,
      centerV: 0.25,
      widthFraction: 0.25,
      heightFraction: 0.5,
    });

    expect(crop).toEqual({
      left: 2.25,
      right: 4.75,
      top: 8,
      bottom: 3,
      near: 0.1,
      far: 50,
    });
  });

  it("maps displayed Raw pan through the physical 180-degree inverse", () => {
    const crop = mapGroundGlassDisplayUvToRttSourceTopUv({ u: 0.8, v: 0.2 }, "raw");
    expect(crop.u).toBeCloseTo(0.2, 12);
    expect(crop.v).toBeCloseTo(0.8, 12);
  });

  it("keeps displayed Upright pan aligned with the upright RTT source", () => {
    const crop = mapGroundGlassDisplayUvToRttSourceTopUv({ u: 0.8, v: 0.2 }, "upright");
    expect(crop.u).toBeCloseTo(0.8, 12);
    expect(crop.v).toBeCloseTo(0.2, 12);
  });

  it("maps the displayed inspection window through the dedicated crop contract", () => {
    const displayedWindow = {
      active: true,
      centerU: 0.875,
      centerV: 0.125,
      widthFraction: 0.25,
      heightFraction: 0.25,
    };

    expect(mapGroundGlassInspectionWindowToRttSourceCrop(displayedWindow, "raw")).toEqual({
      ...displayedWindow,
      centerU: 0.125,
      centerV: 0.875,
    });
    expect(mapGroundGlassInspectionWindowToRttSourceCrop(displayedWindow, "upright")).toEqual(
      displayedWindow,
    );
  });

  it("keeps the physical film crop origin when resolving natural illumination", () => {
    const filmWindow = resolveGroundGlassInspectionFilmWindowMm({
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: {
        active: true,
        centerU: 0.75,
        centerV: 0.25,
        widthFraction: 0.25,
        heightFraction: 0.5,
      },
    });

    expect(filmWindow.centerXMm).toBeCloseTo(31.75, 12);
    expect(filmWindow.centerYMm).toBeCloseTo(-25.4, 12);
    expect(filmWindow.widthMm).toBeCloseTo(31.75, 12);
    expect(filmWindow.heightMm).toBeCloseTo(50.8, 12);
  });

  it("maps an asymmetric RTT source crop to the corresponding physical film region", () => {
    const filmWindow = resolveGroundGlassInspectionFilmWindowMm({
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: {
        active: true,
        centerU: 0.875,
        centerV: 0.125,
        widthFraction: 0.25,
        heightFraction: 0.25,
      },
    });

    expect(filmWindow.centerXMm).toBeCloseTo(47.625, 12);
    expect(filmWindow.centerYMm).toBeCloseTo(-38.1, 12);
    expect(filmWindow.widthMm).toBeCloseTo(31.75, 12);
    expect(filmWindow.heightMm).toBeCloseTo(25.4, 12);
  });

  it("crops an asymmetric Macro target from its visible Raw/Upright raster position", () => {
    const cameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...macroDepthOfFieldScene.cameraPreset,
      activeSceneId: macroDepthOfFieldScene.id,
      focusDistanceMm: 400,
    };
    const optics = deriveOpticsState(cameraState, macroDepthOfFieldScene);
    const target = macroDepthOfFieldScene.focusTargets![0];
    const targetWorldPoint = new THREE.Vector3(
      target.worldPosition.x,
      target.worldPosition.y,
      target.worldPosition.z,
    ).multiplyScalar(WORLD_SCALE);

    const fullFilmCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    const fullFilmConfiguration = configureGroundGlassCamera(
      fullFilmCamera,
      optics,
      0.01,
      100,
    );
    expect(fullFilmConfiguration.ok).toBe(true);
    if (!fullFilmConfiguration.ok) return;

    // Use the actual configured RTT camera as the raster oracle. Its NDC is
    // bottom-origin texture UV; the production composite and CSS conversion
    // then determine the learner-visible position in each mode.
    const fullNdc = targetWorldPoint.clone().project(fullFilmCamera);
    const sourceTextureUv = {
      u: (fullNdc.x + 1) / 2,
      v: (fullNdc.y + 1) / 2,
    };
    const rawUprightDisplay = new Map<string, { u: number; v: number }>();
    const physicalWindows = new Map<string, ReturnType<typeof resolveGroundGlassInspectionFilmWindowMm>>();

    for (const previewMode of ["raw", "upright"] as const) {
      const compositeSampleUv = applyGroundGlassRttDisplayTransform(
        sourceTextureUv,
        resolveGroundGlassRttDisplayTransform(previewMode),
      );
      const visibleTopOriginUv = {
        u: compositeSampleUv.u,
        v: 1 - compositeSampleUv.v,
      };
      rawUprightDisplay.set(previewMode, visibleTopOriginUv);

      const displayedWindow = {
        active: true,
        centerU: visibleTopOriginUv.u,
        centerV: visibleTopOriginUv.v,
        widthFraction: 0.25,
        heightFraction: 0.25,
      };
      const sourceCrop = mapGroundGlassInspectionWindowToRttSourceCrop(
        displayedWindow,
        previewMode,
      );
      expect(sourceCrop.centerU).toBeCloseTo(sourceTextureUv.u, 8);
      expect(sourceCrop.centerV).toBeCloseTo(1 - sourceTextureUv.v, 8);

      // The cropped production camera must place the selected visible detail
      // at the center of its RTT, independently of the target projection helper.
      const croppedCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
      const cropConfiguration = configureGroundGlassCamera(
        croppedCamera,
        optics,
        0.01,
        100,
        sourceCrop,
      );
      expect(cropConfiguration.ok).toBe(true);
      if (!cropConfiguration.ok) continue;
      const cropNdc = targetWorldPoint.clone().project(croppedCamera);
      expect(cropNdc.x).toBeCloseTo(0, 6);
      expect(cropNdc.y).toBeCloseTo(0, 6);

      const filmWindow = resolveGroundGlassInspectionFilmWindowMm({
        filmWidthMm: 127,
        filmHeightMm: 101.6,
        inspectionWindow: sourceCrop,
      });
      const targetProjection = projectWorldPointToFilmPlaneGroundGlass({
        worldPoint: target.worldPosition,
        lensCenterWorld: optics.lensCenterWorld,
        filmPlaneCornersWorld: optics.filmPlaneCornersWorld!,
      });
      expect(targetProjection.visible).toBe(true);
      if (!targetProjection.filmPointWorld) continue;
      const filmDelta = {
        x: targetProjection.filmPointWorld.x - optics.filmCenterWorld.x,
        y: targetProjection.filmPointWorld.y - optics.filmCenterWorld.y,
        z: targetProjection.filmPointWorld.z - optics.filmCenterWorld.z,
      };
      const targetFilmX =
        filmDelta.x * optics.rearStandardFrame.rightWorld.x +
        filmDelta.y * optics.rearStandardFrame.rightWorld.y +
        filmDelta.z * optics.rearStandardFrame.rightWorld.z;
      const targetFilmY =
        filmDelta.x * optics.rearStandardFrame.upWorld.x +
        filmDelta.y * optics.rearStandardFrame.upWorld.y +
        filmDelta.z * optics.rearStandardFrame.upWorld.z;
      expect(filmWindow.centerXMm).toBeCloseTo(targetFilmX, 6);
      expect(filmWindow.centerYMm).toBeCloseTo(targetFilmY, 6);

      const coverage = resolveGroundGlassCoverageUniformState({
        state: optics.groundGlassCoverage,
        rawDebug: false,
        filmWidthMm: 127,
        filmHeightMm: 101.6,
        inspectionWindow: sourceCrop,
        renderWidthPx: 800,
        renderHeightPx: 600,
      });
      const naturalIllumination = resolveGroundGlassNaturalIlluminationUniformState({
        state: optics.groundGlassNaturalIllumination,
        rawDebug: false,
        filmWidthMm: 127,
        filmHeightMm: 101.6,
        inspectionWindow: sourceCrop,
      });
      expect(coverage.filmWindow.centerXMm).toBeCloseTo(targetFilmX, 6);
      expect(coverage.filmWindow.centerYMm).toBeCloseTo(targetFilmY, 6);
      expect(naturalIllumination.filmWindowCenterXMm).toBeCloseTo(targetFilmX, 6);
      expect(naturalIllumination.filmWindowCenterYMm).toBeCloseTo(targetFilmY, 6);
      physicalWindows.set(previewMode, filmWindow);
    }

    const rawDisplay = rawUprightDisplay.get("raw");
    const uprightDisplay = rawUprightDisplay.get("upright");
    const rawWindow = physicalWindows.get("raw");
    const uprightWindow = physicalWindows.get("upright");
    expect(rawDisplay).toBeDefined();
    expect(uprightDisplay).toBeDefined();
    expect(rawWindow).toBeDefined();
    expect(uprightWindow).toBeDefined();
    if (!rawDisplay || !uprightDisplay || !rawWindow || !uprightWindow) return;
    expect(uprightDisplay.u).toBeCloseTo(1 - rawDisplay.u, 12);
    expect(uprightDisplay.v).toBeCloseTo(1 - rawDisplay.v, 12);
    expect(uprightWindow.centerXMm).toBeCloseTo(rawWindow.centerXMm, 12);
    expect(uprightWindow.centerYMm).toBeCloseTo(rawWindow.centerYMm, 12);
  });
});
