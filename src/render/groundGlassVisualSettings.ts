import type { DerivedOpticsState } from "../types/optics";

export type GroundGlassDofVisualSettings = {
  maximumBlurRadiusPx: number;
  displayBlurScale: number;
  planeMode: "automatic" | "derived-planes";
};

const DEFAULT_DOF_VISUAL_SETTINGS: GroundGlassDofVisualSettings = {
  maximumBlurRadiusPx: 60,
  displayBlurScale: 1,
  planeMode: "automatic",
};

const SCENE_DOF_VISUAL_SETTINGS: Readonly<
  Record<string, GroundGlassDofVisualSettings>
> = {
  "table-tilt": {
    // The physical CoC still comes from the shared optics state. This display
    // calibration makes its small pixel footprint legible on Table Tilt detail.
    maximumBlurRadiusPx: 42,
    displayBlurScale: 3.2,
    planeMode: "automatic",
  },
  "shelf-swing": {
    // Keep physical focus and target scoring unchanged while making the
    // front-to-back chart defocus legible at Ground Glass display resolution.
    maximumBlurRadiusPx: 42,
    displayBlurScale: 3.2,
    // Shelf Swing focus distance is expressed by the canonical scene focus
    // plane. RTT should display those already-derived planes even at 0° swing.
    planeMode: "derived-planes",
  },
};

export const getGroundGlassDofVisualSettings = (
  sceneId?: string,
): GroundGlassDofVisualSettings =>
  (sceneId ? SCENE_DOF_VISUAL_SETTINGS[sceneId] : undefined) ??
  DEFAULT_DOF_VISUAL_SETTINGS;

export const resolveGroundGlassDisplayOpticsState = (
  sceneId: string | undefined,
  opticsState: DerivedOpticsState,
): DerivedOpticsState => {
  const settings = getGroundGlassDofVisualSettings(sceneId);
  if (
    settings.planeMode !== "derived-planes" ||
    opticsState.diagnostics.isInfinityFocus ||
    !opticsState.focusPlane ||
    !opticsState.depthOfFieldNearPlane
  ) {
    return opticsState;
  }
  return {
    ...opticsState,
    diagnostics: {
      ...opticsState.diagnostics,
      groundGlassDofModel: "derived-planes",
    },
  };
};
