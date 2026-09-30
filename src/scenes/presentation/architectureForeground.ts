import geometry from "../architectureForegroundGeometry";

/** Renderer-neutral canonical data consumed by the Architecture Foreground asset. */
export type ArchitectureForegroundPresentation = Readonly<{
  sceneId: "architecture-foreground";
  geometry: typeof geometry;
}>;

export const ARCHITECTURE_FOREGROUND_PRESENTATION: ArchitectureForegroundPresentation = {
  sceneId: "architecture-foreground",
  geometry,
};
