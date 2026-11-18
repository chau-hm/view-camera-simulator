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

/** Scene-local lighting placement shared by Observer, Ground Glass, and diagnostics. */
export const STILL_LIFE_STUDIO_PRESENTATION_LIGHTING = {
  targetMm: { x: 0, y: 130, z: 4100 },
  keyOffsetWorld: { x: -2, y: 3.5, z: -4.5 },
} as const;
