import geometry from "../stillLifeStudioGeometry";

/** Renderer-neutral canonical data shared by Observer and Ground Glass. */
export type StillLifeStudioPresentation = Readonly<{
  sceneId: "still-life-studio";
  geometry: typeof geometry;
}>;

export const STILL_LIFE_STUDIO_PRESENTATION: StillLifeStudioPresentation = {
  sceneId: "still-life-studio",
  geometry,
};

