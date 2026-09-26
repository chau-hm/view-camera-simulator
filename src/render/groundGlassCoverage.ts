import type {
  GroundGlassCoverageAxial,
  GroundGlassCoverageQuadratic,
  GroundGlassCoverageState,
} from "../types/optics";
import type { GroundGlassInspectionWindow } from "./groundGlassInspectionWindow";
import {
  resolveGroundGlassFilmWindowUniformState,
  type GroundGlassFilmWindowUniformState,
} from "./groundGlassFilmWindow";

export type GroundGlassCoverageUniformState = Readonly<{
  enabled: boolean;
  kind: GroundGlassCoverageState["kind"];
  /** 0 = disabled, 1 = parallel circle, 2 = non-parallel film conic. */
  mode: 0 | 1 | 2;
  imageCircleRadiusMm: number;
  opticalAxisOffsetXMm: number;
  opticalAxisOffsetYMm: number;
  conicQuadratic: readonly [number, number, number];
  conicLinear: readonly [number, number, number];
  conicAxial: readonly [number, number, number];
  /** One-pixel raster anti-aliasing width, not an optical transition. */
  edgeFeatherMm: number;
  filmWindow: GroundGlassFilmWindowUniformState;
}>;

const isFiniteQuadratic = (quadratic: GroundGlassCoverageQuadratic): boolean =>
  [quadratic.a, quadratic.b, quadratic.c, quadratic.d, quadratic.e, quadratic.f]
    .every(Number.isFinite);

const isFiniteAxial = (axial: GroundGlassCoverageAxial): boolean =>
  [axial.x, axial.y, axial.constant].every(Number.isFinite);

const resolvePixelMm = (input: {
  filmWindow: GroundGlassFilmWindowUniformState;
  renderWidthPx: number;
  renderHeightPx: number;
}): number => {
  const renderWidthPx = Number.isFinite(input.renderWidthPx) && input.renderWidthPx > 0
    ? input.renderWidthPx
    : 1;
  const renderHeightPx = Number.isFinite(input.renderHeightPx) && input.renderHeightPx > 0
    ? input.renderHeightPx
    : 1;
  const pixelMm = Math.max(
    input.filmWindow.widthMm / renderWidthPx,
    input.filmWindow.heightMm / renderHeightPx,
  );
  return Number.isFinite(pixelMm) && pixelMm > 0 ? pixelMm : 0;
};

/**
 * Adapt canonical finite coverage to the final Ground Glass composite.
 * The crop is resolved through the same canonical physical film window used by
 * natural illumination; Raw RTT Debug deliberately disables the mask.
 */
export const resolveGroundGlassCoverageUniformState = (input: {
  state: GroundGlassCoverageState;
  rawDebug: boolean;
  filmWidthMm: number;
  filmHeightMm: number;
  /** Top-origin RTT-source crop, converted to canonical physical film mm here. */
  inspectionWindow: GroundGlassInspectionWindow;
  renderWidthPx: number;
  renderHeightPx: number;
}): GroundGlassCoverageUniformState => {
  const filmWindow = resolveGroundGlassFilmWindowUniformState({
    filmWidthMm: input.filmWidthMm,
    filmHeightMm: input.filmHeightMm,
    inspectionWindow: input.inspectionWindow,
  });
  const circleState = input.state.kind === "parallel-circle" ? input.state : null;
  const conicState = input.state.kind === "nonparallel-conic" ? input.state : null;
  const finiteCircle =
    circleState !== null &&
    Number.isFinite(circleState.imageCircleRadiusMm) &&
    circleState.imageCircleRadiusMm > 0 &&
    Number.isFinite(circleState.opticalAxisOffsetXMm) &&
    Number.isFinite(circleState.opticalAxisOffsetYMm);
  const finiteConic =
    conicState !== null &&
    isFiniteQuadratic(conicState.quadratic) &&
    isFiniteAxial(conicState.axial);
  const mode: GroundGlassCoverageUniformState["mode"] = input.rawDebug
    ? 0
    : finiteCircle
      ? 1
      : finiteConic
        ? 2
        : 0;
  const enabled = mode !== 0;
  const pixelMm = enabled
    ? resolvePixelMm({
        filmWindow,
        renderWidthPx: input.renderWidthPx,
        renderHeightPx: input.renderHeightPx,
      })
    : 0;

  return {
    enabled,
    kind: input.state.kind,
    mode,
    imageCircleRadiusMm: enabled && circleState ? circleState.imageCircleRadiusMm : 0,
    opticalAxisOffsetXMm: enabled && circleState ? circleState.opticalAxisOffsetXMm : 0,
    opticalAxisOffsetYMm: enabled && circleState ? circleState.opticalAxisOffsetYMm : 0,
    conicQuadratic: enabled && conicState
      ? [conicState.quadratic.a, conicState.quadratic.b, conicState.quadratic.c]
      : [0, 0, 0],
    conicLinear: enabled && conicState
      ? [conicState.quadratic.d, conicState.quadratic.e, conicState.quadratic.f]
      : [0, 0, 0],
    conicAxial: enabled && conicState
      ? [conicState.axial.x, conicState.axial.y, conicState.axial.constant]
      : [0, 0, 0],
    edgeFeatherMm: pixelMm,
    filmWindow,
  };
};
