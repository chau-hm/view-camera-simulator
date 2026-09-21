import { describe, expect, it } from "vitest";
import { calculateGroundGlassNaturalIlluminationGain } from "../../core/optics/groundGlassNaturalIllumination";
import { resolveGroundGlassNaturalIlluminationUniformState } from "../../render/groundGlassNaturalIllumination";
import { FULL_GROUND_GLASS_INSPECTION_WINDOW } from "../../render/groundGlassInspectionWindow";
import {
  applyGroundGlassRttDisplayTransform,
  mapGroundGlassRttSourceUvToPhysicalRawFilmUv,
  resolveGroundGlassRttDisplayTransform,
} from "../../render/groundGlassRttOrientation";
import { CAMERA_CONSTANTS } from "../../utils/constants";

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
    expect(uniforms.filmWindowCenterXMm).toBeCloseTo(-47.625, 12);
    expect(uniforms.filmWindowCenterYMm).toBeCloseTo(-38.1, 12);
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

  it("keeps an asymmetric rise centre aligned across source, Raw, and Upright contracts", () => {
    const riseState = {
      kind: "parallel-cos4" as const,
      imageDistanceMm: 150,
      opticalAxisOffsetXMm: 0,
      opticalAxisOffsetYMm: 20,
    };
    const filmPointFromPhysicalRawFilmUv = (uv: { u: number; v: number }) => ({
      xMm: (uv.u - 0.5) * CAMERA_CONSTANTS.filmWidthMm,
      yMm: (0.5 - uv.v) * CAMERA_CONSTANTS.filmHeightMm,
    });
    const displayTopOriginUv = (
      sourceTextureUv: { u: number; v: number },
      mode: "raw" | "upright",
    ) => {
      const sampledSourceUv = applyGroundGlassRttDisplayTransform(
        sourceTextureUv,
        resolveGroundGlassRttDisplayTransform(mode),
      );
      return { u: sampledSourceUv.u, v: 1 - sampledSourceUv.v };
    };

    const physicalPositiveY = { u: 0.5, v: 0.25 };
    const physicalNegativeY = { u: 0.5, v: 0.75 };
    const sourcePositiveY = mapGroundGlassRttSourceUvToPhysicalRawFilmUv(physicalPositiveY);
    const sourceNegativeY = mapGroundGlassRttSourceUvToPhysicalRawFilmUv(physicalNegativeY);
    const sourceTexturePositiveY = { u: sourcePositiveY.u, v: 1 - sourcePositiveY.v };
    const sourceTextureNegativeY = { u: sourceNegativeY.u, v: 1 - sourceNegativeY.v };
    const physicalRawFilmFromSourceTexture = (sourceTextureUv: { u: number; v: number }) =>
      mapGroundGlassRttSourceUvToPhysicalRawFilmUv({
        u: sourceTextureUv.u,
        v: 1 - sourceTextureUv.v,
      });

    expect(displayTopOriginUv(sourceTexturePositiveY, "raw")).toEqual(physicalPositiveY);
    expect(displayTopOriginUv(sourceTextureNegativeY, "raw")).toEqual(physicalNegativeY);
    expect(displayTopOriginUv(sourceTexturePositiveY, "upright")).toEqual(sourcePositiveY);
    expect(displayTopOriginUv(sourceTextureNegativeY, "upright")).toEqual(sourceNegativeY);
    expect(physicalRawFilmFromSourceTexture(sourceTexturePositiveY)).toEqual(physicalPositiveY);
    expect(physicalRawFilmFromSourceTexture(sourceTextureNegativeY)).toEqual(physicalNegativeY);

    const positiveFilmPoint = filmPointFromPhysicalRawFilmUv(physicalPositiveY);
    const negativeFilmPoint = filmPointFromPhysicalRawFilmUv(physicalNegativeY);
    const positiveGain = calculateGroundGlassNaturalIlluminationGain(
      riseState,
      positiveFilmPoint.xMm,
      positiveFilmPoint.yMm,
    );
    const negativeGain = calculateGroundGlassNaturalIlluminationGain(
      riseState,
      negativeFilmPoint.xMm,
      negativeFilmPoint.yMm,
    );
    expect(positiveGain).toBeGreaterThan(negativeGain);

    // The reviewed bug treated the upright source coordinate as physical Raw
    // film, which reverses this asymmetric ordering.
    const incorrectlyMappedPositive = filmPointFromPhysicalRawFilmUv(sourcePositiveY);
    const incorrectlyMappedNegative = filmPointFromPhysicalRawFilmUv(sourceNegativeY);
    expect(
      calculateGroundGlassNaturalIlluminationGain(
        riseState,
        incorrectlyMappedPositive.xMm,
        incorrectlyMappedPositive.yMm,
      ),
    ).toBeLessThan(
      calculateGroundGlassNaturalIlluminationGain(
        riseState,
        incorrectlyMappedNegative.xMm,
        incorrectlyMappedNegative.yMm,
      ),
    );
  });
});
