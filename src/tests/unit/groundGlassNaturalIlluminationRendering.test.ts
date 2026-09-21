import { describe, expect, it } from "vitest";
import { resolveGroundGlassNaturalIlluminationUniformState } from "../../render/groundGlassNaturalIllumination";
import { FULL_GROUND_GLASS_INSPECTION_WINDOW } from "../../render/groundGlassInspectionWindow";

const state = {
  kind: "parallel-cos4" as const,
  imageDistanceMm: 150,
  opticalAxisOffsetXMm: 18,
  opticalAxisOffsetYMm: 20,
};

const croppedWindow = {
  active: true,
  centerU: 0.875,
  centerV: 0.125,
  widthFraction: 0.25,
  heightFraction: 0.25,
};

describe("Ground Glass natural-illumination render contract", () => {
  it("passes the physical crop origin instead of recentering a loupe window", () => {
    const uniforms = resolveGroundGlassNaturalIlluminationUniformState({
      state,
      rawDebug: false,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: croppedWindow,
    });

    expect(uniforms.enabled).toBe(true);
    expect(uniforms.filmWindowCenterXMm).toBeCloseTo(47.625, 12);
    expect(uniforms.filmWindowCenterYMm).toBeCloseTo(38.1, 12);
    expect(uniforms.filmWindowWidthMm).toBeCloseTo(31.75, 12);
    expect(uniforms.filmWindowHeightMm).toBeCloseTo(25.4, 12);
    expect(uniforms.opticalAxisOffsetXMm).toBe(18);
    expect(uniforms.opticalAxisOffsetYMm).toBe(20);
  });

  it("keeps normal raw/upright physical state enabled but bypasses it for Raw RTT Debug", () => {
    const normal = resolveGroundGlassNaturalIlluminationUniformState({
      state,
      rawDebug: false,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: FULL_GROUND_GLASS_INSPECTION_WINDOW,
    });
    const debug = resolveGroundGlassNaturalIlluminationUniformState({
      state,
      rawDebug: true,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: FULL_GROUND_GLASS_INSPECTION_WINDOW,
    });

    expect(normal.enabled).toBe(true);
    expect(normal.imageDistanceMm).toBe(150);
    expect(debug.enabled).toBe(false);
    expect(debug.imageDistanceMm).toBe(0);
    expect(debug.opticalAxisOffsetXMm).toBe(0);
    expect(debug.opticalAxisOffsetYMm).toBe(0);
  });

  it("keeps non-parallel optics neutral in the render adapter", () => {
    const uniforms = resolveGroundGlassNaturalIlluminationUniformState({
      state: { kind: "neutral", reason: "non-parallel-lens-film" },
      rawDebug: false,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: FULL_GROUND_GLASS_INSPECTION_WINDOW,
    });

    expect(uniforms.enabled).toBe(false);
    expect(uniforms.imageDistanceMm).toBe(0);
  });
});
