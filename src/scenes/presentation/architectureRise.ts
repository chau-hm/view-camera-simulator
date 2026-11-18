import geometry from "../architectureRiseGeometry";
import { referenceObjects } from "../architectureRiseGeometry";
import { ARCHITECTURE_RISE_PRESENTATION_LAYOUT } from "./architectureRiseLayout";

/** Renderer-neutral canonical data consumed by the Architecture Rise asset. */
export type ArchitectureRisePresentation = Readonly<{
  sceneId: "architecture-rise";
  geometry: typeof geometry;
  referenceObjects: typeof referenceObjects;
  layout: typeof ARCHITECTURE_RISE_PRESENTATION_LAYOUT;
}>;

export const ARCHITECTURE_RISE_PRESENTATION: ArchitectureRisePresentation = {
  sceneId: "architecture-rise",
  geometry,
  referenceObjects,
  layout: ARCHITECTURE_RISE_PRESENTATION_LAYOUT,
};
