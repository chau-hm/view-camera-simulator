import geometry from "../architectureRiseGeometry";
import { referenceObjects } from "../architectureRiseGeometry";

/** Renderer-neutral canonical data consumed by the Architecture Rise asset. */
export type ArchitectureRisePresentation = Readonly<{
  sceneId: "architecture-rise";
  geometry: typeof geometry;
  referenceObjects: typeof referenceObjects;
}>;

export const ARCHITECTURE_RISE_PRESENTATION: ArchitectureRisePresentation = {
  sceneId: "architecture-rise",
  geometry,
  referenceObjects,
};
