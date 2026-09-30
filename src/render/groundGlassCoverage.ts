import type {
  GroundGlassCoverageAxial,
  GroundGlassCoverageQuadratic,
  GroundGlassCoverageState,
} from "../types/optics";
import type { GroundGlassInspectionWindow } from "./groundGlassInspectionWindow";
import {
  resolveGroundGlassFilmWindow,
  type GroundGlassFilmWindow,
} from "./groundGlassFilmWindow";

export type GroundGlassCoverageRenderState = Readonly<{
  kind: GroundGlassCoverageState["kind"];
  active: boolean;
  geometry:
    | Readonly<{
        kind: "parallel-circle";
        radiusMm: number;
        opticalAxisOffsetXMm: number;
        opticalAxisOffsetYMm: number;
      }>
    | Readonly<{
        kind: "nonparallel-conic";
        quadratic: GroundGlassCoverageQuadratic;
        axial: GroundGlassCoverageAxial;
      }>
    | null;
  /** One-pixel raster anti-aliasing width, not an optical transition. */
  edgeFeatherMm: number;
  filmWindow: GroundGlassFilmWindow;
}>;

const isFiniteQuadratic = (quadratic: GroundGlassCoverageQuadratic): boolean =>
  [quadratic.a, quadratic.b, quadratic.c, quadratic.d, quadratic.e, quadratic.f]
    .every(Number.isFinite);

const isFiniteAxial = (axial: GroundGlassCoverageAxial): boolean =>
  [axial.x, axial.y, axial.constant].every(Number.isFinite);

const resolvePixelMm = (input: {
  filmWindow: GroundGlassFilmWindow;
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
export const resolveGroundGlassCoverageRenderState = (input: {
  state: GroundGlassCoverageState;
  rawDebug: boolean;
  filmWidthMm: number;
  filmHeightMm: number;
  /** Top-origin RTT-source crop, converted to canonical physical film mm here. */
  inspectionWindow: GroundGlassInspectionWindow;
  renderWidthPx: number;
  renderHeightPx: number;
}): GroundGlassCoverageRenderState => {
  const filmWindow = resolveGroundGlassFilmWindow({
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
  const geometry = finiteCircle && circleState
    ? {
        kind: "parallel-circle" as const,
        radiusMm: circleState.imageCircleRadiusMm,
        opticalAxisOffsetXMm: circleState.opticalAxisOffsetXMm,
        opticalAxisOffsetYMm: circleState.opticalAxisOffsetYMm,
      }
    : finiteConic && conicState
      ? {
          kind: "nonparallel-conic" as const,
          quadratic: conicState.quadratic,
          axial: conicState.axial,
        }
      : null;
  const active = !input.rawDebug && geometry !== null;
  const pixelMm = active
    ? resolvePixelMm({
        filmWindow,
        renderWidthPx: input.renderWidthPx,
        renderHeightPx: input.renderHeightPx,
      })
    : 0;

  return {
    kind: input.state.kind,
    active,
    geometry,
    edgeFeatherMm: pixelMm,
    filmWindow,
  };
};
