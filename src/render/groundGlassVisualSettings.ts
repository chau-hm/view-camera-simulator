import type { DerivedOpticsState } from "../types/optics";

export type GroundGlassDofVisualSettings = {
  maximumBlurRadiusPx: number;
  planeMode: "automatic" | "derived-planes";
};

const DEFAULT_DOF_VISUAL_SETTINGS: GroundGlassDofVisualSettings = {
  maximumBlurRadiusPx: 60,
  planeMode: "automatic",
};

const SCENE_DOF_VISUAL_SETTINGS: Readonly<
  Record<string, GroundGlassDofVisualSettings>
> = {
  "table-tilt": {
    maximumBlurRadiusPx: 42,
    planeMode: "automatic",
  },
  "shelf-swing": {
    maximumBlurRadiusPx: 42,
    // Shelf Swing focus distance is expressed by the canonical scene focus
    // plane. RTT should display those already-derived planes even at 0° swing.
    planeMode: "derived-planes",
  },
  "oblique-architecture": {
    maximumBlurRadiusPx: 48,
    planeMode: "automatic",
  },
  "architecture-foreground": {
    maximumBlurRadiusPx: 48,
    planeMode: "automatic",
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
