import type { PresentationLightingProfile } from "../../render/presentationLightingContract";
import * as geometry from "../macroSpecimenGeometry";

/**
 * A subject-scale shadow frustum and modest fill lift keep small metal relief
 * visible without changing the shared renderer lighting recipe.
 */
export const MACRO_BELLOWS_WATCH_LIGHTING_PROFILE = {
  id: "macro-bellows-watch-teaching",
  fill: {
    skyColor: "#ffffff",
    groundColor: "#64748b",
    intensity: 0.8,
  },
  key: {
    color: "#ffffff",
    intensity: 1.45,
    castsShadow: true,
    shadowMapSize: 1024,
    shadowBias: -0.00004,
    shadowNormalBias: 0.0004,
    shadowCamera: {
      left: -0.07,
      right: 0.07,
      top: 0.07,
      bottom: -0.07,
      near: 0.1,
      far: 8,
    },
  },
} as const satisfies PresentationLightingProfile;

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
