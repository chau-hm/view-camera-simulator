import * as geometry from "../macroCompoundMovementsGeometry";

/** Canonical renderer-neutral compound planes, station surfaces, and focus samples. */
export type MacroCompoundMovementsPresentation = Readonly<{
  sceneId: "macro-compound-movements";
  geometry: typeof geometry;
}>;

export const MACRO_COMPOUND_MOVEMENTS_PRESENTATION: MacroCompoundMovementsPresentation =
  Object.freeze({
    sceneId: "macro-compound-movements",
    geometry,
  });
