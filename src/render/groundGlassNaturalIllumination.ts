import type { GroundGlassNaturalIlluminationState } from "../types/optics";
import type { GroundGlassInspectionWindow } from "./groundGlassInspectionWindow";
import { resolveGroundGlassInspectionFilmWindowMm } from "./groundGlassInspectionWindow";

export type GroundGlassNaturalIlluminationUniformState = Readonly<{
  enabled: boolean;
  imageDistanceMm: number;
  opticalAxisOffsetXMm: number;
  opticalAxisOffsetYMm: number;
  filmWindowCenterXMm: number;
  filmWindowCenterYMm: number;
  filmWindowWidthMm: number;
  filmWindowHeightMm: number;
}>;

/**
 * Adapt canonical physical illumination state and the existing RTT crop to
 * the small uniform contract consumed by the composite shader.
 */
export const resolveGroundGlassNaturalIlluminationUniformState = (input: {
  state: GroundGlassNaturalIlluminationState;
  rawDebug: boolean;
  filmWidthMm: number;
  filmHeightMm: number;
  inspectionWindow: GroundGlassInspectionWindow;
}): GroundGlassNaturalIlluminationUniformState => {
  const filmWindow = resolveGroundGlassInspectionFilmWindowMm({
    filmWidthMm: input.filmWidthMm,
    filmHeightMm: input.filmHeightMm,
    inspectionWindow: input.inspectionWindow,
  });
  const parallelState = input.state.kind === "parallel-cos4" ? input.state : null;
  const enabled = !input.rawDebug && parallelState !== null;

  return {
    enabled,
    imageDistanceMm: enabled ? parallelState.imageDistanceMm : 0,
    opticalAxisOffsetXMm: enabled ? parallelState.opticalAxisOffsetXMm : 0,
    opticalAxisOffsetYMm: enabled ? parallelState.opticalAxisOffsetYMm : 0,
    filmWindowCenterXMm: filmWindow.centerXMm,
    filmWindowCenterYMm: filmWindow.centerYMm,
    filmWindowWidthMm: filmWindow.widthMm,
    filmWindowHeightMm: filmWindow.heightMm,
  };
};
