import geometry from "../interiorCornerGeometry";

/** Renderer-neutral canonical data consumed by the Interior Corner asset. */
export type InteriorCornerPresentation = Readonly<{
  sceneId: "interior-corner";
  geometry: typeof geometry;
}>;

export const INTERIOR_CORNER_PRESENTATION: InteriorCornerPresentation = {
  sceneId: "interior-corner",
  geometry,
};
