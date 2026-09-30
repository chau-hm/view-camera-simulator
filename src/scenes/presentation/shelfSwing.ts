import geometry from "../shelfSwingGeometry";

/** Renderer-neutral canonical data consumed by the Shelf Swing asset. */
export type ShelfSwingPresentation = Readonly<{
  sceneId: "shelf-swing";
  geometry: typeof geometry;
}>;

export const SHELF_SWING_PRESENTATION: ShelfSwingPresentation = {
  sceneId: "shelf-swing",
  geometry,
};
