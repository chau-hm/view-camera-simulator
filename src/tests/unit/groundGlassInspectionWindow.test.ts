import { describe, expect, it } from "vitest";
import {
  FULL_GROUND_GLASS_INSPECTION_WINDOW,
  mapGroundGlassDisplayUvToFilmUv,
  mapGroundGlassInspectionWindowToFilmSpace,
  resolveGroundGlassInspectionFrustum,
  resolveGroundGlassInspectionWindow,
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

  it("maps displayed Raw pan to the inverse pre-composite film crop", () => {
    const crop = mapGroundGlassDisplayUvToFilmUv({ u: 0.8, v: 0.2 }, "raw");
    expect(crop.u).toBeCloseTo(0.2, 12);
    expect(crop.v).toBeCloseTo(0.8, 12);
  });

  it("keeps Upright displayed pan aligned with the pre-composite film crop", () => {
    expect(mapGroundGlassDisplayUvToFilmUv({ u: 0.8, v: 0.2 }, "upright")).toEqual({
      u: 0.8,
      v: 0.2,
    });
  });

  it("maps the displayed inspection window through the dedicated crop contract", () => {
    const displayedWindow = {
      active: true,
      centerU: 0.875,
      centerV: 0.125,
      widthFraction: 0.25,
      heightFraction: 0.25,
    };

    expect(mapGroundGlassInspectionWindowToFilmSpace(displayedWindow, "raw")).toEqual(
      {
        ...displayedWindow,
        centerU: 0.125,
        centerV: 0.875,
      },
    );
    expect(mapGroundGlassInspectionWindowToFilmSpace(displayedWindow, "upright")).toEqual(displayedWindow);
  });
});
