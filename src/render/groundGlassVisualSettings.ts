import type { DerivedOpticsState } from "../types/optics";

/** Presentation-only magnification used to make subpixel CoC differences inspectable. */
export const DEFAULT_GROUND_GLASS_INSPECTION_MAGNIFICATION = 4;

export type GroundGlassDofVisualSettings = {
  maximumBlurRadiusPx: number;
  planeMode: "automatic" | "derived-planes";
  inspectionMagnification: number;
};

const DEFAULT_DOF_VISUAL_SETTINGS: GroundGlassDofVisualSettings = {
  maximumBlurRadiusPx: 60,
  planeMode: "automatic",
  inspectionMagnification: DEFAULT_GROUND_GLASS_INSPECTION_MAGNIFICATION,
};

const SCENE_DOF_VISUAL_SETTINGS: Readonly<
  Record<string, Partial<Omit<GroundGlassDofVisualSettings, "inspectionMagnification">>>
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
  "oblique-tabletop": {
    maximumBlurRadiusPx: 48,
    planeMode: "automatic",
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
): GroundGlassDofVisualSettings => ({
  ...DEFAULT_DOF_VISUAL_SETTINGS,
  ...(sceneId ? SCENE_DOF_VISUAL_SETTINGS[sceneId] : undefined),
});

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
