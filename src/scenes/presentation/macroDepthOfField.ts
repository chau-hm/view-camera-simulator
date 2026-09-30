import * as geometry from "../macroDepthOfFieldGeometry";

/** Canonical renderer-neutral station and focus-zone data for the Macro DOF subject. */
export type MacroDepthOfFieldPresentation = Readonly<{
  sceneId: "macro-depth-of-field";
  geometry: typeof geometry;
}>;

export const MACRO_DEPTH_OF_FIELD_PRESENTATION: MacroDepthOfFieldPresentation =
  Object.freeze({
    sceneId: "macro-depth-of-field",
    geometry,
  });
