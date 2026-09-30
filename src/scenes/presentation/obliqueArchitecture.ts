import geometry from "../obliqueArchitectureGeometry";

/** Renderer-neutral canonical data consumed by the Oblique Architecture asset. */
export type ObliqueArchitecturePresentation = Readonly<{
  sceneId: "oblique-architecture";
  geometry: typeof geometry;
}>;

export const OBLIQUE_ARCHITECTURE_PRESENTATION: ObliqueArchitecturePresentation = {
  sceneId: "oblique-architecture",
  geometry,
};
