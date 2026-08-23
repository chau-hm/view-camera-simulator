import { describe, expect, it } from "vitest";
import { groundGlassFootprintAxesToRttPixels } from "../../render/groundGlassFootprintCoordinates";

const baseInput = {
  majorRadiusMm: 2,
  minorRadiusMm: 1,
  renderWidthPx: 1000,
  renderHeightPx: 800,
  filmWidthMm: 100,
  filmHeightMm: 80,
  displayBlurScale: 1,
};

describe("physical film footprint to raw RTT coordinates", () => {
  it("reflects physical film +Y into decreasing raw RTT V for a diagonal ellipse", () => {
    const axes = groundGlassFootprintAxesToRttPixels({
      ...baseInput,
      orientationRad: Math.PI / 6,
    });

    expect(axes.majorAxisPx[0]).toBeCloseTo(Math.cos(Math.PI / 6) * 20, 12);
    expect(axes.majorAxisPx[1]).toBeCloseTo(-Math.sin(Math.PI / 6) * 20, 12);
    expect(axes.minorAxisPx[0]).toBeCloseTo(-Math.sin(Math.PI / 6) * 10, 12);
    expect(axes.minorAxisPx[1]).toBeCloseTo(-Math.cos(Math.PI / 6) * 10, 12);
    expect(axes.majorAxisPx[1]).toBeLessThan(0);
    expect(axes.minorAxisPx[1]).toBeLessThan(0);
  });

  it("keeps axis-aligned footprints in the expected raw RTT directions", () => {
    const horizontal = groundGlassFootprintAxesToRttPixels({
      ...baseInput,
      orientationRad: 0,
    });
    expect(horizontal.majorAxisPx[0]).toBeCloseTo(20, 12);
    expect(horizontal.majorAxisPx[1]).toBeCloseTo(0, 12);
    expect(horizontal.minorAxisPx[0]).toBeCloseTo(0, 12);
    expect(horizontal.minorAxisPx[1]).toBeCloseTo(-10, 12);

    const vertical = groundGlassFootprintAxesToRttPixels({
      ...baseInput,
      orientationRad: Math.PI / 2,
    });
    expect(vertical.majorAxisPx[0]).toBeCloseTo(0, 12);
    expect(vertical.majorAxisPx[1]).toBeCloseTo(-20, 12);
    expect(vertical.minorAxisPx[0]).toBeCloseTo(-10, 12);
    expect(vertical.minorAxisPx[1]).toBeCloseTo(0, 12);
  });

  it("does not apply preview-upright inversion to raw footprint coordinates", () => {
    const axes = groundGlassFootprintAxesToRttPixels({
      ...baseInput,
      orientationRad: Math.PI / 4,
      displayBlurScale: 2,
    });

    expect(axes.majorAxisPx[1]).toBeLessThan(0);
    expect(axes.minorAxisPx[1]).toBeLessThan(0);
    expect(Math.abs(axes.majorAxisPx[0])).toBeCloseTo(Math.abs(axes.majorAxisPx[1]), 12);
  });
});
