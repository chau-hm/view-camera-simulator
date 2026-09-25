import { describe, expect, it } from "vitest";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../core/optics/physicalSharpness";
import { resolveGroundGlassRttDimensions } from "../../render/groundGlassRttDimensions";
import { getRenderQualitySettings } from "../../render/renderQuality";
import {
  GROUND_GLASS_TARGET_BOUNDARY_BLUR_RADIUS_PX,
  resolveGroundGlassDisplayBlurScale,
} from "../../render/groundGlassBlurCalibration";

const FILM_WIDTH_MM = 127;

describe("Ground Glass display blur calibration", () => {
  it("maps the acceptable physical CoC boundary to the target display radius", () => {
    const displayWidthPx = 500;
    const scale = resolveGroundGlassDisplayBlurScale({
      acceptableCoCDiameterMm: ACCEPTABLE_COC_DIAMETER_MM,
      filmWidthMm: FILM_WIDTH_MM,
      displayWidthPx,
    });
    const boundaryRadiusPx =
      (ACCEPTABLE_COC_DIAMETER_MM * displayWidthPx / FILM_WIDTH_MM / 2) * scale;

    expect(GROUND_GLASS_TARGET_BOUNDARY_BLUR_RADIUS_PX).toBe(1);
    expect(scale).toBeCloseTo(5.08, 12);
    expect(boundaryRadiusPx).toBeCloseTo(GROUND_GLASS_TARGET_BOUNDARY_BLUR_RADIUS_PX, 12);
  });

  it("scales inversely with visible preview width", () => {
    const calibration = {
      acceptableCoCDiameterMm: ACCEPTABLE_COC_DIAMETER_MM,
      filmWidthMm: FILM_WIDTH_MM,
    };
    const scaleAt500Px = resolveGroundGlassDisplayBlurScale({
      ...calibration,
      displayWidthPx: 500,
    });
    const scaleAt1000Px = resolveGroundGlassDisplayBlurScale({
      ...calibration,
      displayWidthPx: 1000,
    });

    expect(scaleAt1000Px).toBeCloseTo(scaleAt500Px / 2, 12);
  });

  it("keeps the acceptable-CoC CSS blur radius equal across Standard and High RTT resolutions", () => {
    const logicalWidthPx = 500;
    const scale = resolveGroundGlassDisplayBlurScale({
      acceptableCoCDiameterMm: ACCEPTABLE_COC_DIAMETER_MM,
      filmWidthMm: FILM_WIDTH_MM,
      displayWidthPx: logicalWidthPx,
    });

    for (const renderQuality of ["standard", "high"] as const) {
      const dimensions = resolveGroundGlassRttDimensions({
        logicalWidth: logicalWidthPx,
        logicalHeight: 400,
        renderQuality,
        devicePixelRatio: getRenderQualitySettings(renderQuality).dpr,
      });
      const internalBoundaryRadiusPx =
        (ACCEPTABLE_COC_DIAMETER_MM * dimensions.internalWidthPx / FILM_WIDTH_MM / 2) * scale;
      const visibleBoundaryRadiusPx =
        internalBoundaryRadiusPx * dimensions.logicalWidthPx / dimensions.internalWidthPx;

      expect(visibleBoundaryRadiusPx).toBeCloseTo(
        GROUND_GLASS_TARGET_BOUNDARY_BLUR_RADIUS_PX,
        12,
      );
    }
  });

  it("keeps Front/Rear Focus's 1.122 mm defocus the same visible size across Standard and High", () => {
    const logicalWidthPx = 500;
    const physicalCocMm = 1.122;
    const scale = resolveGroundGlassDisplayBlurScale({
      acceptableCoCDiameterMm: ACCEPTABLE_COC_DIAMETER_MM,
      filmWidthMm: FILM_WIDTH_MM,
      displayWidthPx: logicalWidthPx,
    });
    const expectedVisibleRadiusPx =
      (physicalCocMm * logicalWidthPx / FILM_WIDTH_MM / 2) * scale;

    for (const renderQuality of ["standard", "high"] as const) {
      const quality = getRenderQualitySettings(renderQuality);
      const dimensions = resolveGroundGlassRttDimensions({
        logicalWidth: logicalWidthPx,
        logicalHeight: 400,
        renderQuality,
        devicePixelRatio: quality.dpr,
      });
      const maximumCoCRadiusPx = Math.min(60, quality.maximumCoCRadiusPx);
      const internalRadiusPx = Math.min(
        (physicalCocMm * dimensions.internalWidthPx / FILM_WIDTH_MM / 2) * scale,
        maximumCoCRadiusPx,
      );
      const visibleRadiusPx =
        internalRadiusPx * dimensions.logicalWidthPx / dimensions.internalWidthPx;

      expect(internalRadiusPx).toBeLessThan(maximumCoCRadiusPx);
      expect(visibleRadiusPx).toBeCloseTo(expectedVisibleRadiusPx, 12);
    }
  });

  it("keeps Focus Loupe crop magnification instead of calibrating it away", () => {
    const displayWidthPx = 500;
    const scale = resolveGroundGlassDisplayBlurScale({
      acceptableCoCDiameterMm: ACCEPTABLE_COC_DIAMETER_MM,
      filmWidthMm: FILM_WIDTH_MM,
      displayWidthPx,
    });
    const fullFilmBoundaryRadiusPx =
      (ACCEPTABLE_COC_DIAMETER_MM * displayWidthPx / FILM_WIDTH_MM / 2) * scale;
    const quarterWidthCropBoundaryRadiusPx =
      (ACCEPTABLE_COC_DIAMETER_MM * displayWidthPx / (FILM_WIDTH_MM * 0.25) / 2) * scale;

    expect(fullFilmBoundaryRadiusPx).toBeCloseTo(1, 12);
    expect(quarterWidthCropBoundaryRadiusPx).toBeCloseTo(
      fullFilmBoundaryRadiusPx * 4,
      12,
    );
  });

  it.each([
    { acceptableCoCDiameterMm: 0, filmWidthMm: FILM_WIDTH_MM, displayWidthPx: 500 },
    { acceptableCoCDiameterMm: 0.1, filmWidthMm: 0, displayWidthPx: 500 },
    { acceptableCoCDiameterMm: 0.1, filmWidthMm: FILM_WIDTH_MM, displayWidthPx: 0 },
    { acceptableCoCDiameterMm: Number.NaN, filmWidthMm: FILM_WIDTH_MM, displayWidthPx: 500 },
    { acceptableCoCDiameterMm: 0.1, filmWidthMm: FILM_WIDTH_MM, displayWidthPx: Number.NaN },
  ])("falls back to a finite positive scale for invalid calibration input %#", (input) => {
    const scale = resolveGroundGlassDisplayBlurScale(input);

    expect(Number.isFinite(scale)).toBe(true);
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBe(1);
  });
});
