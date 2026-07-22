import { describe, it, expect } from 'vitest';
import { resolveGroundGlassRttDimensions } from "../../render/groundGlassRttDimensions";

describe("resolveGroundGlassRttDimensions", () => {
  it("resolves responsive logical dimensions across every quality profile", () => {
    const profiles = ["low", "standard", "high"] as const;
    const dimensions = profiles.map((renderQuality) =>
      resolveGroundGlassRttDimensions({
        logicalWidth: 731,
        logicalHeight: 585,
        renderQuality,
        devicePixelRatio: 1,
      }),
    );

    dimensions.forEach((dims) => {
      expect(dims.logicalWidthPx).toBe(731);
      expect(dims.logicalHeightPx).toBe(585);
    });
    expect(dimensions[0].internalWidthPx).toBeLessThan(dimensions[1].internalWidthPx);
    expect(dimensions[1].internalWidthPx).toBeLessThan(dimensions[2].internalWidthPx);
  });

  it("computes expected sizes at DPR=1", () => {
    const logicalW = 500;
    const logicalH = 400;
    const low = resolveGroundGlassRttDimensions({
      logicalWidth: logicalW,
      logicalHeight: logicalH,
      renderQuality: "low",
      devicePixelRatio: 1,
      zoomEnabled: false,
    });
    const standard = resolveGroundGlassRttDimensions({
      logicalWidth: logicalW,
      logicalHeight: logicalH,
      renderQuality: "standard",
      devicePixelRatio: 1,
      zoomEnabled: false,
    });
    const high = resolveGroundGlassRttDimensions({
      logicalWidth: logicalW,
      logicalHeight: logicalH,
      renderQuality: "high",
      devicePixelRatio: 1,
      zoomEnabled: false,
    });

    expect(low.internalWidthPx).toBe(Math.round(500 * 0.65));
    expect(standard.internalWidthPx).toBe(Math.round(500 * 0.85));
    expect(high.internalWidthPx).toBe(Math.round(500 * 1.0));
    expect(low.internalWidthPx).toBeLessThan(standard.internalWidthPx);
    expect(standard.internalWidthPx).toBeLessThanOrEqual(high.internalWidthPx);
  });

  it("honours devicePixelRatio up to profile limit and avoids double-DPR", () => {
    const logicalW = 500;
    // device DPR 2 should double High when high.dpr is 2
    const high = resolveGroundGlassRttDimensions({
      logicalWidth: logicalW,
      logicalHeight: 400,
      renderQuality: "high",
      devicePixelRatio: 2,
      zoomEnabled: false,
    });
    expect(high.internalWidthPx).toBe(1000);

    // Low profile dpr=1, device DPR=2 should be clamped to 1
    const low = resolveGroundGlassRttDimensions({
      logicalWidth: logicalW,
      logicalHeight: 400,
      renderQuality: "low",
      devicePixelRatio: 2,
      zoomEnabled: false,
    });
    expect(low.internalWidthPx).toBe(Math.round(500 * 0.65 * 1));
  });

  it("matches the stage zoom scale and clamps to max dimensions", () => {
    const zoomed = resolveGroundGlassRttDimensions({
      logicalWidth: 500,
      logicalHeight: 400,
      renderQuality: "standard",
      devicePixelRatio: 1,
      zoomEnabled: true,
    });
    expect(zoomed.zoomRenderScale).toBe(1.9);
    expect(zoomed.internalWidthPx).toBe(Math.round(500 * 0.85 * 1.9));

    const logicalW = 1000;
    const logicalH = 800;
    // high quality with DPR 2 would produce 2000x1600; clamp to 1600x1280
    const dims = resolveGroundGlassRttDimensions({
      logicalWidth: logicalW,
      logicalHeight: logicalH,
      renderQuality: "high",
      devicePixelRatio: 2,
      zoomEnabled: false,
    });
    expect(dims.internalWidthPx).toBeLessThanOrEqual(1600);
    expect(dims.internalHeightPx).toBeLessThanOrEqual(1280);
    expect(dims.wasClamped).toBe(true);
    expect(dims.internalWidthPx / dims.internalHeightPx).toBeCloseTo(logicalW / logicalH, 2);
  });

  it("normalizes invalid logical dimensions to positive integer pixels", () => {
    const dims = resolveGroundGlassRttDimensions({
      logicalWidth: Number.NaN,
      logicalHeight: 0,
      renderQuality: "standard",
      devicePixelRatio: 1,
    });

    expect(dims.logicalWidthPx).toBe(1);
    expect(dims.logicalHeightPx).toBe(1);
    expect(dims.internalWidthPx).toBe(1);
    expect(dims.internalHeightPx).toBe(1);
  });
});
