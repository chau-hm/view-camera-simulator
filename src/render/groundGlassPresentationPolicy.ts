import type { SceneDefinition } from "../types/scene";

export type GroundGlassPresentationPolicy = Readonly<{
  showDecorativeVignette: boolean;
}>;

const DEFAULT_GROUND_GLASS_PRESENTATION_POLICY: GroundGlassPresentationPolicy = {
  showDecorativeVignette: true,
};

const FOCUS_FUNDAMENTALS_PRESENTATION_POLICY: GroundGlassPresentationPolicy = {
  showDecorativeVignette: false,
};

export const resolveGroundGlassPresentationPolicy = (
  scene: SceneDefinition,
): GroundGlassPresentationPolicy =>
  scene.id === "focus-fundamentals-two-targets"
    ? FOCUS_FUNDAMENTALS_PRESENTATION_POLICY
    : DEFAULT_GROUND_GLASS_PRESENTATION_POLICY;
