import * as geometry from "../macroObliquePlaneGeometry";

/** Canonical renderer-neutral oblique plane, focus samples, and plate dimensions. */
export type MacroObliquePlanePresentation = Readonly<{
  sceneId: "macro-oblique-plane";
  geometry: typeof geometry;
}>;

export const MACRO_OBLIQUE_PLANE_PRESENTATION: MacroObliquePlanePresentation =
  Object.freeze({
    sceneId: "macro-oblique-plane",
    geometry,
  });
