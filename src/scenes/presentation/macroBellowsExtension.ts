import * as geometry from "../macroSpecimenGeometry";

/** Canonical renderer-neutral geometry and focus data for the Macro Bellows subject. */
export type MacroBellowsExtensionPresentation = Readonly<{
  sceneId: "macro-bellows-extension";
  geometry: typeof geometry;
}>;

export const MACRO_BELLOWS_EXTENSION_PRESENTATION: MacroBellowsExtensionPresentation =
  Object.freeze({
    sceneId: "macro-bellows-extension",
    geometry,
  });
