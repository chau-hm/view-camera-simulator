import { describe, expect, it } from "vitest";
import {
  compositeGroundGlassB1ResearchReference,
} from "../../render/webgpu/groundGlassB1Reference";
import {
  evaluateGroundGlassPresentationReference,
  finalizeGroundGlassOpaquePresentationRgba,
} from "../../render/webgpu/groundGlassPresentationReference";
import { resolveGroundGlassCoverageRenderState } from "../../render/groundGlassCoverage";
import { resolveGroundGlassNaturalIlluminationRenderState } from "../../render/groundGlassNaturalIllumination";
import type { GroundGlassCoverageState } from "../../types/optics";

const filmWindow = { centerXMm: 0, centerYMm: 0, widthMm: 127, heightMm: 101.6 };
const fullFilm = { active: false, centerU: 0.5, centerV: 0.5, widthFraction: 1, heightFraction: 1 };

const compositeCases = [
  { coverage: 0, expected: [0.75, 0.5, 0.25, 1] },
  { coverage: 0.25, expected: [0.625, 0.5625, 0.3125, 1] },
  { coverage: 0.5, expected: [0.5, 0.625, 0.375, 1] },
  { coverage: 0.75, expected: [0.375, 0.6875, 0.4375, 1] },
  { coverage: 1, expected: [0.25, 0.75, 0.5, 1] },
] as const;

describe("M6D opaque presentation output contract", () => {
  it.each(compositeCases)("matches completed M5 Far/Near RGB at Near coverage $coverage", ({ coverage, expected }) => {
    const far = new Float32Array([0.75, 0.5, 0.25, 1]);
    const near = new Float32Array([0.25, 0.75, 0.5, coverage]);
    const nearBefore = near.slice();
    const measuredReference = compositeGroundGlassB1ResearchReference(
      far,
      { widthPx: 1, heightPx: 1 },
      near,
      { widthPx: 1, heightPx: 1 },
    );

    expect([...measuredReference]).toEqual(expected);
    expect(near).toEqual(nearBefore);
    expect(measuredReference[3]).toBe(1);
  });

  it("detects ignored coverage, a second Near blend, raw Near output, and non-opaque composite alpha", () => {
    const { coverage, expected } = compositeCases[2];
    const far = [0.75, 0.5, 0.25, 1] as const;
    const near = [0.25, 0.75, 0.5, coverage] as const;
    const ignoredCoverage = far;
    const rawNear = near;
    const doubleBlend = [
      expected[0] * (1 - coverage) + near[0] * coverage,
      expected[1] * (1 - coverage) + near[1] * coverage,
      expected[2] * (1 - coverage) + near[2] * coverage,
      1,
    ];
    const distance = (candidate: readonly number[]) => Math.max(
      ...candidate.map((value, channel) => Math.abs(value - expected[channel]!)),
    );

    expect(distance(ignoredCoverage)).toBeGreaterThan(0.01);
    expect(distance(doubleBlend)).toBeGreaterThan(0.01);
    expect(distance(rawNear)).toBeGreaterThan(0.01);
    expect(near[3]).not.toBe(1);
    expect(expected[3]).toBe(1);
  });

  it("keeps the CPU reference's pre-material source alpha distinct from the opaque target alpha", () => {
    for (const sourceAlpha of [0, 0.25, 0.5, 0.75, 1]) {
      expect(finalizeGroundGlassOpaquePresentationRgba([0.2, 0.4, 0.6, sourceAlpha]))
        .toEqual([0.2, 0.4, 0.6, 1]);
    }
  });

  it("keeps zero Image Circle RGB coverage and presentation gains from changing final alpha", () => {
    const coverageState: GroundGlassCoverageState = {
      kind: "parallel-circle",
      imageCircleRadiusMm: 1,
      opticalAxisOffsetXMm: 0,
      opticalAxisOffsetYMm: 0,
    };
    const coverage = resolveGroundGlassCoverageRenderState({
      state: coverageState,
      rawDebug: false,
      filmWidthMm: filmWindow.widthMm,
      filmHeightMm: filmWindow.heightMm,
      inspectionWindow: fullFilm,
      renderWidthPx: 1270,
      renderHeightPx: 1016,
    });
    const naturalIllumination = resolveGroundGlassNaturalIlluminationRenderState({
      state: {
        kind: "parallel-cos4",
        imageDistanceMm: 150,
        opticalAxisOffsetXMm: 8,
        opticalAxisOffsetYMm: -4,
      },
      rawDebug: false,
      filmWidthMm: filmWindow.widthMm,
      filmHeightMm: filmWindow.heightMm,
      inspectionWindow: fullFilm,
    });
    const result = evaluateGroundGlassPresentationReference({
      displayUvTopOrigin: { u: 0.99, v: 0.99 },
      previewMode: "upright",
      filmWindow,
      coverage,
      naturalIllumination,
      throughputGain: 0.5,
      sampleSource: () => [0.2, 0.4, 0.6, 0.35],
    });

    expect(result.coverageGain).toBe(0);
    expect(result.outputLinearRgba).toEqual([0, 0, 0, 0.35]);
    expect(result.expectedOpaqueTargetLinearRgba).toEqual([0, 0, 0, 1]);
    const incorrectFinalAlpha = {
      imageCircleCoverage: result.outputLinearRgba[3] * result.coverageGain,
      naturalIllumination: result.outputLinearRgba[3] * result.naturalIlluminationGain,
      throughput: result.outputLinearRgba[3] * result.throughputGain,
      copiedPartialSourceAlpha: result.outputLinearRgba[3],
    };
    expect(incorrectFinalAlpha.imageCircleCoverage).toBe(0);
    expect(incorrectFinalAlpha.naturalIllumination).toBeLessThan(1);
    expect(incorrectFinalAlpha.throughput).toBe(0.175);
    expect(incorrectFinalAlpha.copiedPartialSourceAlpha).toBe(0.35);
    expect(Object.values(incorrectFinalAlpha).every((alpha) => alpha !== 1)).toBe(true);
  });
});
