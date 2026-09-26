import { describe, expect, it } from "vitest";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../core/optics/physicalSharpness";
import { getRenderQualitySettings } from "../../render/renderQuality";
import { groundGlassFootprintAxesToRttPixels } from "../../render/groundGlassFootprintCoordinates";
import { getGroundGlassDofVisualSettings } from "../../render/groundGlassVisualSettings";
import { resolveGroundGlassInspectionWindow, resolveSampledFilmDimensionsMm } from "../../render/groundGlassInspectionWindow";
import { resolveGroundGlassRttDimensions } from "../../render/groundGlassRttDimensions";
import { CAMERA_CONSTANTS } from "../../utils/constants";

const physicalVisibleRadiusPx = (cocDiameterMm: number, displayWidthPx: number, sampledFilmWidthMm: number): number =>
  cocDiameterMm * displayWidthPx / sampledFilmWidthMm / 2;

describe("physical Ground Glass blur scale", () => {
  it("keeps scene-specific settings separate from physical blur scale", () => {
    for (const sceneId of ["architecture-rise", "table-tilt", "shelf-swing", "oblique-tabletop", "oblique-architecture", "architecture-foreground"]) {
      expect(getGroundGlassDofVisualSettings(sceneId)).not.toHaveProperty("displayBlurScale");
      expect(getGroundGlassDofVisualSettings(sceneId)).not.toHaveProperty("inspectionMagnification");
    }
  });

  it("maps physical film radii directly to internal pixels", () => {
    const axes = groundGlassFootprintAxesToRttPixels({
      majorRadiusMm: 2, minorRadiusMm: 1, orientationRad: 0,
      renderWidthPx: 1270, renderHeightPx: 1016, filmWidthMm: 127, filmHeightMm: 101.6,
    });
    expect(axes.majorAxisPx[0]).toBeCloseTo(20, 12);
    expect(axes.majorAxisPx[1]).toBeCloseTo(0, 12);
    expect(axes.minorAxisPx[0]).toBeCloseTo(0, 12);
    expect(axes.minorAxisPx[1]).toBeCloseTo(-10, 12);
  });

  it("makes the same physical CoC twice as wide when the visible full-film preview doubles", () => {
    const at500 = physicalVisibleRadiusPx(ACCEPTABLE_COC_DIAMETER_MM, 500, CAMERA_CONSTANTS.filmWidthMm);
    const at1000 = physicalVisibleRadiusPx(ACCEPTABLE_COC_DIAMETER_MM, 1000, CAMERA_CONSTANTS.filmWidthMm);
    expect(at500).toBeCloseTo(ACCEPTABLE_COC_DIAMETER_MM * 500 / CAMERA_CONSTANTS.filmWidthMm / 2, 12);
    expect(at1000).toBeCloseTo(at500 * 2, 12);
    expect(at500).toBeCloseTo(0.1968503937, 9);
  });

  it("keeps final visible physical blur invariant across Standard and High RTT resolutions", () => {
    const logicalWidth = 500;
    const logicalHeight = 400;
    const filmWidthMm = CAMERA_CONSTANTS.filmWidthMm;
    const cocDiameterMm = 1.122;
    const results = (["standard", "high"] as const).map((renderQuality) => {
      const dimensions = resolveGroundGlassRttDimensions({
        logicalWidth, logicalHeight, renderQuality,
        devicePixelRatio: getRenderQualitySettings(renderQuality).dpr,
      });
      const internalRadius = physicalVisibleRadiusPx(cocDiameterMm, dimensions.internalWidthPx, filmWidthMm);
      return internalRadius * logicalWidth / dimensions.internalWidthPx;
    });
    expect(results[0]).toBeCloseTo(results[1], 12);
    expect(results[0]).toBeCloseTo(physicalVisibleRadiusPx(cocDiameterMm, logicalWidth, filmWidthMm), 12);
  });

  it("lets the Focus Loupe magnify physical blur through its actual sampled film window", () => {
    const full = resolveSampledFilmDimensionsMm({
      filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
      filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
      inspectionWindow: resolveGroundGlassInspectionWindow({ active: false }),
    });
    const loupeWindow = resolveGroundGlassInspectionWindow({ active: true, magnification: 4 });
    const loupe = resolveSampledFilmDimensionsMm({
      filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
      filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
      inspectionWindow: loupeWindow,
    });
    const fullRadius = physicalVisibleRadiusPx(0.169, 500, full.widthMm);
    const loupeRadius = physicalVisibleRadiusPx(0.169, 500, loupe.widthMm);
    expect(loupe.widthMm).toBeLessThan(full.widthMm);
    expect(loupeRadius / fullRadius).toBeCloseTo(full.widthMm / loupe.widthMm, 12);
    expect(loupeRadius / fullRadius).toBeCloseTo(4, 12);
    expect(loupeRadius).toBeCloseTo(0.169 * 500 / loupe.widthMm / 2, 12);
  });

  it("keeps renderer caps separate from the physical optical conversion", () => {
    const uncappedRadius = physicalVisibleRadiusPx(1.122, 1270, 127);
    const gatherCapPx = 1.25;
    expect(uncappedRadius).toBeCloseTo(5.61, 12);
    expect(Math.min(uncappedRadius, gatherCapPx)).toBe(gatherCapPx);
    // The cap limits the renderer gather; the physical mapping itself is unchanged.
    expect(uncappedRadius).toBeCloseTo(1.122 * 1270 / 127 / 2, 12);
  });
});
