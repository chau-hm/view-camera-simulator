import geometry from "../tableTiltGeometry";

/** Renderer-neutral canonical data consumed by the Table Tilt asset. */
export type TableTiltPresentation = Readonly<{
  sceneId: "table-tilt";
  geometry: typeof geometry;
}>;

export const TABLE_TILT_PRESENTATION: TableTiltPresentation = {
  sceneId: "table-tilt",
  geometry,
};
