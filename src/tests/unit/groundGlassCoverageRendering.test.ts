import { describe, expect, it } from "vitest";
import { calculateGroundGlassCoverageGain } from "../../core/optics/groundGlassCoverage";
import { resolveGroundGlassCoverageUniformState } from "../../render/groundGlassCoverage";
import { resolveGroundGlassNaturalIlluminationUniformState } from "../../render/groundGlassNaturalIllumination";
import { FULL_GROUND_GLASS_INSPECTION_WINDOW } from "../../render/groundGlassInspectionWindow";
import {
  applyGroundGlassRttDisplayTransform,
  mapGroundGlassRttSourceUvToPhysicalRawFilmUv,
  resolveGroundGlassRttDisplayTransform,
} from "../../render/groundGlassRttOrientation";

const state = {
  kind: "parallel-circle" as const,
  imageCircleRadiusMm: 35,
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

describe("Ground Glass finite-coverage render contract", () => {
  it("shares the physical Raw-film crop with natural illumination", () => {
    const coverage = resolveGroundGlassCoverageUniformState({
      state,
      rawDebug: false,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: croppedWindow,
      renderWidthPx: 800,
      renderHeightPx: 600,
    });
    const natural = resolveGroundGlassNaturalIlluminationUniformState({
      state: {
        kind: "parallel-cos4",
        imageDistanceMm: 150,
        opticalAxisOffsetXMm: 18,
        opticalAxisOffsetYMm: 20,
      },
      rawDebug: false,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: croppedWindow,
    });

    expect(coverage.enabled).toBe(true);
    expect(coverage.filmWindow.centerXMm).toBeCloseTo(-47.625, 12);
    expect(coverage.filmWindow.centerYMm).toBeCloseTo(-38.1, 12);
    expect(coverage.filmWindow.widthMm).toBeCloseTo(31.75, 12);
    expect(coverage.filmWindow.heightMm).toBeCloseTo(25.4, 12);
    expect(coverage.filmWindow.centerXMm).toBe(natural.filmWindowCenterXMm);
    expect(coverage.filmWindow.centerYMm).toBe(natural.filmWindowCenterYMm);
    expect(coverage.filmWindow.widthMm).toBe(natural.filmWindowWidthMm);
    expect(coverage.filmWindow.heightMm).toBe(natural.filmWindowHeightMm);
    expect(coverage.edgeFeatherMm).toBeCloseTo(Math.max(31.75 / 800, 25.4 / 600), 12);
  });

  it("keeps the finite mask disabled for Raw RTT Debug and neutral states", () => {
    const debug = resolveGroundGlassCoverageUniformState({
      state,
      rawDebug: true,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: FULL_GROUND_GLASS_INSPECTION_WINDOW,
      renderWidthPx: 800,
      renderHeightPx: 600,
    });
    const nonParallel = resolveGroundGlassCoverageUniformState({
      state: { kind: "neutral", reason: "non-parallel-lens-film" },
      rawDebug: false,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: FULL_GROUND_GLASS_INSPECTION_WINDOW,
      renderWidthPx: 800,
      renderHeightPx: 600,
    });

    expect(debug.enabled).toBe(false);
    expect(debug.kind).toBe("parallel-circle");
    expect(debug.imageCircleRadiusMm).toBe(0);
    expect(nonParallel.enabled).toBe(false);
    expect(nonParallel.kind).toBe("neutral");
  });

  it("keeps an asymmetric coverage pattern attached to the physical film in Raw and Upright", () => {
    const physicalPositiveY = { u: 0.5, v: 0.25 };
    const physicalNegativeY = { u: 0.5, v: 0.75 };
    const sourcePositiveY = mapGroundGlassRttSourceUvToPhysicalRawFilmUv(physicalPositiveY);
    const sourceNegativeY = mapGroundGlassRttSourceUvToPhysicalRawFilmUv(physicalNegativeY);
    const sourceTexturePositiveY = { u: sourcePositiveY.u, v: 1 - sourcePositiveY.v };
    const sourceTextureNegativeY = { u: sourceNegativeY.u, v: 1 - sourceNegativeY.v };
    const filmPointFromPhysicalRawFilmUv = (uv: { u: number; v: number }) => ({
      xMm: (uv.u - 0.5) * 127,
      yMm: (0.5 - uv.v) * 101.6,
    });
    const physicalRawFilmFromSourceTexture = (sourceTextureUv: { u: number; v: number }) =>
      mapGroundGlassRttSourceUvToPhysicalRawFilmUv({
        u: sourceTextureUv.u,
        v: 1 - sourceTextureUv.v,
      });
    const displayedScreenUvForSource = (
      sourceTextureUv: { u: number; v: number },
      mode: "raw" | "upright",
    ) => {
      const sampledSourceUv = applyGroundGlassRttDisplayTransform(
        sourceTextureUv,
        resolveGroundGlassRttDisplayTransform(mode),
      );
      return { u: sampledSourceUv.u, v: 1 - sampledSourceUv.v };
    };

    const expectedPositive = filmPointFromPhysicalRawFilmUv(physicalPositiveY);
    const expectedNegative = filmPointFromPhysicalRawFilmUv(physicalNegativeY);
    expect(calculateGroundGlassCoverageGain(state, expectedPositive.xMm, expectedPositive.yMm)).toBe(1);
    expect(calculateGroundGlassCoverageGain(state, expectedNegative.xMm, expectedNegative.yMm)).toBe(0);

    expect(physicalRawFilmFromSourceTexture(sourceTexturePositiveY)).toEqual(physicalPositiveY);
    expect(physicalRawFilmFromSourceTexture(sourceTextureNegativeY)).toEqual(physicalNegativeY);
    const rawPositiveScreen = displayedScreenUvForSource(sourceTexturePositiveY, "raw");
    const uprightPositiveScreen = displayedScreenUvForSource(sourceTexturePositiveY, "upright");
    expect(uprightPositiveScreen).toEqual({
      u: 1 - rawPositiveScreen.u,
      v: 1 - rawPositiveScreen.v,
    });
    const positivePoint = filmPointFromPhysicalRawFilmUv(
      physicalRawFilmFromSourceTexture(sourceTexturePositiveY),
    );
    const negativePoint = filmPointFromPhysicalRawFilmUv(
      physicalRawFilmFromSourceTexture(sourceTextureNegativeY),
    );
    expect(calculateGroundGlassCoverageGain(state, positivePoint.xMm, positivePoint.yMm)).toBe(1);
    expect(calculateGroundGlassCoverageGain(state, negativePoint.xMm, negativePoint.yMm)).toBe(0);
  });
});
