import type { PresentationLightingProfile } from "../../render/presentationLightingContract";
import * as geometry from "../macroSpecimenGeometry";

/** Accepted warm/cool watch studio key, with its dimensional shadow bounds in metres. */
export const MACRO_BELLOWS_WATCH_LIGHTING_PROFILE = {
  id: "macro-bellows-watch-studio",
  fill: {
    skyColor: "#ffffff",
    groundColor: "#796f67",
    intensity: 0.12,
  },
  key: {
    color: "#ffefe1",
    intensity: 1.82,
    castsShadow: true,
    shadowMapSize: 2048,
    shadowBias: -0.00013,
    shadowNormalBias: 0.000024,
    shadowCamera: {
      left: -0.029,
      right: 0.029,
      top: 0.031,
      bottom: -0.031,
      near: 0.0005,
      far: 0.088,
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
