import type { GroundGlassCoverageState } from "../types/optics";
import type { GroundGlassInspectionWindow } from "./groundGlassInspectionWindow";
import {
  resolveGroundGlassFilmWindowUniformState,
  type GroundGlassFilmWindowUniformState,
} from "./groundGlassFilmWindow";

export type GroundGlassCoverageUniformState = Readonly<{
  enabled: boolean;
  kind: GroundGlassCoverageState["kind"];
  imageCircleRadiusMm: number;
  opticalAxisOffsetXMm: number;
  opticalAxisOffsetYMm: number;
  /** One-pixel raster anti-aliasing width, not an optical transition. */
  edgeFeatherMm: number;
  filmWindow: GroundGlassFilmWindowUniformState;
}>;

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
 * The crop is resolved through the same physical Raw-film window used by
 * natural illumination; Raw RTT Debug deliberately disables the mask.
 */
export const resolveGroundGlassCoverageUniformState = (input: {
  state: GroundGlassCoverageState;
  rawDebug: boolean;
  filmWidthMm: number;
  filmHeightMm: number;
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
  const finiteCircle =
    circleState !== null &&
    Number.isFinite(circleState.imageCircleRadiusMm) &&
    circleState.imageCircleRadiusMm > 0 &&
    Number.isFinite(circleState.opticalAxisOffsetXMm) &&
    Number.isFinite(circleState.opticalAxisOffsetYMm);
  const enabled = !input.rawDebug && finiteCircle;
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
    imageCircleRadiusMm: enabled && circleState ? circleState.imageCircleRadiusMm : 0,
    opticalAxisOffsetXMm: enabled && circleState ? circleState.opticalAxisOffsetXMm : 0,
    opticalAxisOffsetYMm: enabled && circleState ? circleState.opticalAxisOffsetYMm : 0,
    edgeFeatherMm: pixelMm,
    filmWindow,
  };
};
