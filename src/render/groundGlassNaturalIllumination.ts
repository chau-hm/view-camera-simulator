import type { GroundGlassNaturalIlluminationState } from "../types/optics";
import type { GroundGlassInspectionWindow } from "./groundGlassInspectionWindow";
import {
  resolveGroundGlassFilmWindow,
  type GroundGlassFilmWindow,
} from "./groundGlassFilmWindow";

export type GroundGlassNaturalIlluminationRenderState = Readonly<{
  enabled: boolean;
  geometry: GroundGlassNaturalIlluminationState | null;
  filmWindow: GroundGlassFilmWindow;
}>;

/**
 * Derive the physical illumination semantics consumed by the current final
 * composite. Raw RTT Debug disables the effect while retaining the canonical
 * geometry in the snapshot for diagnostics and other renderer bindings.
 */
export const resolveGroundGlassNaturalIlluminationRenderState = (input: {
  state: GroundGlassNaturalIlluminationState;
  rawDebug: boolean;
  filmWidthMm: number;
  filmHeightMm: number;
  /** Top-origin RTT-source crop, converted to canonical physical film mm here. */
  inspectionWindow: GroundGlassInspectionWindow;
}): GroundGlassNaturalIlluminationRenderState => {
  const filmWindow = resolveGroundGlassFilmWindow({
    filmWidthMm: input.filmWidthMm,
    filmHeightMm: input.filmHeightMm,
    inspectionWindow: input.inspectionWindow,
  });
  return {
    enabled: !input.rawDebug && input.state.kind === "parallel-cos4",
    geometry: input.state,
    filmWindow,
  };
};
