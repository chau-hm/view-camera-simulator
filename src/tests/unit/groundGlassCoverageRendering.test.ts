import { describe, expect, it } from "vitest";
import { calculateGroundGlassCoverageGain } from "../../core/optics/groundGlassCoverage";
import { resolveGroundGlassCoverageUniformState } from "../../render/groundGlassCoverage";
import { resolveGroundGlassNaturalIlluminationUniformState } from "../../render/groundGlassNaturalIllumination";
import { FULL_GROUND_GLASS_INSPECTION_WINDOW } from "../../render/groundGlassInspectionWindow";
import {
  applyGroundGlassRttDisplayTransform,
  mapGroundGlassRttTextureUvToCanonicalFilmUv,
  resolveGroundGlassRttDisplayTransform,
} from "../../render/groundGlassRttOrientation";

const state = {
  kind: "parallel-circle" as const,
  imageCircleRadiusMm: 35,
  opticalAxisOffsetXMm: 18,
  opticalAxisOffsetYMm: 20,
};

const asymmetricConic = {
  kind: "nonparallel-conic" as const,
  quadratic: { a: 1, b: 0, c: 1, d: 0, e: -40, f: -825 },
  axial: { x: 0, y: 0, constant: 150 },
};

const croppedWindow = {
  active: true,
  centerU: 0.875,
  centerV: 0.125,
  widthFraction: 0.25,
  heightFraction: 0.25,
};

describe("Ground Glass finite-coverage render contract", () => {
  it("shares the canonical physical film crop with natural illumination", () => {
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
    expect(coverage.filmWindow.centerXMm).toBeCloseTo(47.625, 12);
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
      state: { kind: "neutral", reason: "invalid-geometry" },
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

  it("packs the conic unchanged, retains the physical crop, and bypasses it in Raw RTT Debug", () => {
    const adapted = resolveGroundGlassCoverageUniformState({
      state: asymmetricConic,
      rawDebug: false,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: croppedWindow,
      renderWidthPx: 800,
      renderHeightPx: 600,
    });
    expect(adapted.enabled).toBe(true);
    expect(adapted.mode).toBe(2);
    expect(adapted.conicQuadratic).toEqual([1, 0, 1]);
    expect(adapted.conicLinear).toEqual([0, -40, -825]);
    expect(adapted.conicAxial).toEqual([0, 0, 150]);
    expect(adapted.filmWindow.centerXMm).toBeCloseTo(47.625, 12);
    expect(adapted.filmWindow.centerYMm).toBeCloseTo(-38.1, 12);
    expect(adapted.edgeFeatherMm).toBeCloseTo(Math.max(31.75 / 800, 25.4 / 600), 12);

    const debug = resolveGroundGlassCoverageUniformState({
      state: asymmetricConic,
      rawDebug: true,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: croppedWindow,
      renderWidthPx: 800,
      renderHeightPx: 600,
    });
    expect(debug.kind).toBe("nonparallel-conic");
    expect(debug.enabled).toBe(false);
    expect(debug.mode).toBe(0);
    expect(debug.conicQuadratic).toEqual([0, 0, 0]);
  });

  it("fails neutral for non-finite conic coefficients", () => {
    const invalid = {
      ...asymmetricConic,
      quadratic: { ...asymmetricConic.quadratic, a: Number.NaN },
    };
    const adapted = resolveGroundGlassCoverageUniformState({
      state: invalid,
      rawDebug: false,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: FULL_GROUND_GLASS_INSPECTION_WINDOW,
      renderWidthPx: 800,
      renderHeightPx: 600,
    });
    expect(adapted.kind).toBe("nonparallel-conic");
    expect(adapted.enabled).toBe(false);
    expect(adapted.mode).toBe(0);
    expect(calculateGroundGlassCoverageGain(invalid, 0, 0)).toBe(1);
  });

  it("keeps conic coefficients fixed while an off-centre inspection crop moves the viewed window", () => {
    const centered = resolveGroundGlassCoverageUniformState({
      state: asymmetricConic,
      rawDebug: false,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: FULL_GROUND_GLASS_INSPECTION_WINDOW,
      renderWidthPx: 800,
      renderHeightPx: 600,
    });
    const inspected = resolveGroundGlassCoverageUniformState({
      state: asymmetricConic,
      rawDebug: false,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow: croppedWindow,
      renderWidthPx: 800,
      renderHeightPx: 600,
    });

    expect(inspected.conicQuadratic).toEqual(centered.conicQuadratic);
    expect(inspected.conicLinear).toEqual(centered.conicLinear);
    expect(inspected.conicAxial).toEqual(centered.conicAxial);
    expect(inspected.filmWindow.centerXMm).not.toBe(centered.filmWindow.centerXMm);
    expect(inspected.filmWindow.centerYMm).not.toBe(centered.filmWindow.centerYMm);
  });

  it("keeps an asymmetric coverage pattern attached to the physical film in Raw and Upright", () => {
    const physicalPositiveY = { u: 0.5, v: 0.25 };
    const physicalNegativeY = { u: 0.5, v: 0.75 };
    const sourceTexturePositiveY = physicalPositiveY;
    const sourceTextureNegativeY = physicalNegativeY;
    const filmPointFromPhysicalRawFilmUv = (uv: { u: number; v: number }) => ({
      xMm: (uv.u - 0.5) * 127,
      yMm: (0.5 - uv.v) * 101.6,
    });
    const physicalRawFilmFromSourceTexture = (sourceTextureUv: { u: number; v: number }) =>
      mapGroundGlassRttTextureUvToCanonicalFilmUv(sourceTextureUv);
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
    expect(rawPositiveScreen.u).toBeCloseTo(0.5, 12);
    expect(uprightPositiveScreen.v).toBeCloseTo(1 - rawPositiveScreen.v, 12);
    const positivePoint = filmPointFromPhysicalRawFilmUv(
      physicalRawFilmFromSourceTexture(sourceTexturePositiveY),
    );
    const negativePoint = filmPointFromPhysicalRawFilmUv(
      physicalRawFilmFromSourceTexture(sourceTextureNegativeY),
    );
    expect(calculateGroundGlassCoverageGain(state, positivePoint.xMm, positivePoint.yMm)).toBe(1);
    expect(calculateGroundGlassCoverageGain(state, negativePoint.xMm, negativePoint.yMm)).toBe(0);
  });

  it("keeps asymmetric conic coverage tied to the same physical samples in Raw and Upright", () => {
    const physicalPositiveY = { u: 0.5, v: 0.25 };
    const physicalNegativeY = { u: 0.5, v: 0.75 };
    const filmPoint = (uv: { u: number; v: number }) => ({
      x: (uv.u - 0.5) * 127,
      y: (0.5 - uv.v) * 101.6,
    });
    const screenUvForPhysicalPoint = (
      physicalUv: { u: number; v: number },
      mode: "raw" | "upright",
    ) => {
      const canonicalFilmUv = mapGroundGlassRttTextureUvToCanonicalFilmUv(physicalUv);
      const sampledTextureUv = applyGroundGlassRttDisplayTransform(
        canonicalFilmUv,
        resolveGroundGlassRttDisplayTransform(mode),
      );
      return { u: sampledTextureUv.u, v: 1 - sampledTextureUv.v };
    };
    const physicalPointAtScreenUv = (
      screenUv: { u: number; v: number },
      mode: "raw" | "upright",
    ) => {
      const screenTextureUv = { u: screenUv.u, v: 1 - screenUv.v };
      const sampledTextureUv = applyGroundGlassRttDisplayTransform(
        screenTextureUv,
        resolveGroundGlassRttDisplayTransform(mode),
      );
      return filmPoint(mapGroundGlassRttTextureUvToCanonicalFilmUv(sampledTextureUv));
    };
    const samples = [physicalPositiveY, physicalNegativeY].map((physicalUv) => ({
      rawPoint: physicalPointAtScreenUv(screenUvForPhysicalPoint(physicalUv, "raw"), "raw"),
      uprightPoint: physicalPointAtScreenUv(screenUvForPhysicalPoint(physicalUv, "upright"), "upright"),
      rawScreenUv: screenUvForPhysicalPoint(physicalUv, "raw"),
      uprightScreenUv: screenUvForPhysicalPoint(physicalUv, "upright"),
    }));

    expect(calculateGroundGlassCoverageGain(asymmetricConic, 0, 25.4)).toBe(1);
    expect(calculateGroundGlassCoverageGain(asymmetricConic, 0, -25.4)).toBe(0);
    for (const { rawPoint, uprightPoint } of samples) {
      expect(rawPoint).toEqual(uprightPoint);
      expect(calculateGroundGlassCoverageGain(asymmetricConic, rawPoint.x, rawPoint.y)).toBe(
        calculateGroundGlassCoverageGain(asymmetricConic, uprightPoint.x, uprightPoint.y),
      );
    }
    expect(samples[0].rawScreenUv).not.toEqual(samples[0].uprightScreenUv);
  });
});
