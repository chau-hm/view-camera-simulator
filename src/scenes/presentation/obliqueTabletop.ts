import geometry from "../obliqueTabletopGeometry";

/** Renderer-neutral canonical data consumed by the Oblique Tabletop asset. */
export type ObliqueTabletopPresentation = Readonly<{
  sceneId: "oblique-tabletop";
  geometry: typeof geometry;
}>;

export const OBLIQUE_TABLETOP_PRESENTATION: ObliqueTabletopPresentation = {
  sceneId: "oblique-tabletop",
  geometry,
};
