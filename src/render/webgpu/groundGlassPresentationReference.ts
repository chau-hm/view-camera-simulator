import { calculateGroundGlassCoverageRenderGain, type GroundGlassCoverageRenderState } from "../groundGlassCoverage";
import type { GroundGlassFilmWindow } from "../groundGlassFilmWindow";
import { calculateGroundGlassNaturalIlluminationGain } from "../../core/optics/groundGlassNaturalIllumination";
import type { GroundGlassNaturalIlluminationRenderState } from "../groundGlassNaturalIllumination";
import {
  mapGroundGlassDisplayUvToRttSourceTopUv,
} from "../groundGlassInspectionWindow";
import type { GroundGlassPreviewMode } from "../groundGlassTargetProjection";

export type GroundGlassPresentationRgba = readonly [number, number, number, number];

/**
 * Apply the accepted M6 opaque-material output contract to the pre-material
 * presentation expression. RGB is already final linear presentation output;
 * the opaque node material writes alpha one independently of source alpha.
 */
export const finalizeGroundGlassOpaquePresentationRgba = (
  preMaterialLinearRgba: GroundGlassPresentationRgba,
): GroundGlassPresentationRgba => [
  preMaterialLinearRgba[0],
  preMaterialLinearRgba[1],
  preMaterialLinearRgba[2],
  1,
];

export type GroundGlassPresentationReferenceInput = Readonly<{
  displayUvTopOrigin: Readonly<{ u: number; v: number }>;
  previewMode: GroundGlassPreviewMode;
  filmWindow: GroundGlassFilmWindow;
  coverage: GroundGlassCoverageRenderState;
  naturalIllumination: GroundGlassNaturalIlluminationRenderState;
  throughputGain: number;
  /** Samples a controlled source texture by canonical top-origin source crop UV. */
  sampleSource: (sourceUvTopOrigin: Readonly<{ u: number; v: number }>) => GroundGlassPresentationRgba;
}>;

export type GroundGlassPresentationReferenceResult = Readonly<{
  sourceUvTopOrigin: Readonly<{ u: number; v: number }>;
  physicalFilmPointMm: Readonly<{ x: number; y: number }>;
  coverageGain: number;
  naturalIlluminationGain: number;
  throughputGain: number;
  inputLinearRgba: GroundGlassPresentationRgba;
  /** The TSL color expression before MeshBasicNodeMaterial applies opaque output semantics. */
  outputLinearRgba: GroundGlassPresentationRgba;
  /** Expected final linear target value under the M6 opaque-material contract; not a GPU readback. */
  expectedOpaqueTargetLinearRgba: GroundGlassPresentationRgba;
}>;

/** Independent CPU oracle for display-to-source mapping and canonical physical presentation. */
export const evaluateGroundGlassPresentationReference = (
  input: GroundGlassPresentationReferenceInput,
): GroundGlassPresentationReferenceResult => {
  if (
    input.coverage.filmWindow.centerXMm !== input.filmWindow.centerXMm ||
    input.coverage.filmWindow.centerYMm !== input.filmWindow.centerYMm ||
    input.coverage.filmWindow.widthMm !== input.filmWindow.widthMm ||
    input.coverage.filmWindow.heightMm !== input.filmWindow.heightMm ||
    input.naturalIllumination.filmWindow.centerXMm !== input.filmWindow.centerXMm ||
    input.naturalIllumination.filmWindow.centerYMm !== input.filmWindow.centerYMm ||
    input.naturalIllumination.filmWindow.widthMm !== input.filmWindow.widthMm ||
    input.naturalIllumination.filmWindow.heightMm !== input.filmWindow.heightMm
  ) {
    throw new Error("Coverage, illumination, and sampling must use the same physical film window");
  }
  if (!Number.isFinite(input.throughputGain) || input.throughputGain < 0) {
    throw new RangeError("Ground Glass throughput gain must be finite and non-negative");
  }

  const sourceUvTopOrigin = mapGroundGlassDisplayUvToRttSourceTopUv(
    input.displayUvTopOrigin,
    input.previewMode,
  );
  const physicalFilmPointMm = {
    x: input.filmWindow.centerXMm + (sourceUvTopOrigin.u - 0.5) * input.filmWindow.widthMm,
    y: input.filmWindow.centerYMm + (0.5 - sourceUvTopOrigin.v) * input.filmWindow.heightMm,
  };
  const source = input.sampleSource(sourceUvTopOrigin);
  if (!source.every(Number.isFinite)) {
    throw new RangeError("Ground Glass source sample must contain finite RGBA values");
  }
  const coverageGain = calculateGroundGlassCoverageRenderGain(
    input.coverage,
    physicalFilmPointMm.x,
    physicalFilmPointMm.y,
  );
  const naturalIlluminationGain = input.naturalIllumination.enabled
    ? calculateGroundGlassNaturalIlluminationGain(
        input.naturalIllumination.geometry ?? { kind: "neutral", reason: "invalid-geometry" },
        physicalFilmPointMm.x,
        physicalFilmPointMm.y,
      )
    : 1;
  const rgbGain = input.throughputGain * naturalIlluminationGain * coverageGain;
  const outputLinearRgba: GroundGlassPresentationRgba = [
    source[0] * rgbGain,
    source[1] * rgbGain,
    source[2] * rgbGain,
    source[3],
  ];
  return {
    sourceUvTopOrigin,
    physicalFilmPointMm,
    coverageGain,
    naturalIlluminationGain,
    throughputGain: input.throughputGain,
    inputLinearRgba: source,
    outputLinearRgba,
    expectedOpaqueTargetLinearRgba: finalizeGroundGlassOpaquePresentationRgba(outputLinearRgba),
  };
};

/** Screen conversion expected from the renderer's linear NoColorSpace -> sRGB output path. */
export const encodeGroundGlassLinearChannelToSrgb = (linear: number): number => {
  if (!Number.isFinite(linear)) throw new RangeError("Linear channel must be finite");
  const nonNegative = Math.max(0, linear);
  return nonNegative <= 0.0031308
    ? 12.92 * nonNegative
    : 1.055 * nonNegative ** (1 / 2.4) - 0.055;
};
