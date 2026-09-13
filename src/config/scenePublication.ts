/**
 * The single manual control surface for public scene publication.
 *
 * A scene is public only when it has an explicit `true` entry here. Missing
 * scene IDs remain unpublished by default.
 */
export const scenePublication = {
  // Foundations
  "view-camera-anatomy": true,
  "understanding-camera-movements": true,
  "focus-fundamentals-two-targets": true,

  // Core Movements
  "architecture-rise": true,
  "table-tilt": true,
  "shelf-swing": true,
  "mirror-shift": true,

  // Combined Movements
  "oblique-tabletop": true,
  "oblique-architecture": true,
  "architecture-foreground": true,
  "interior-corner": true,
} as const satisfies Record<string, boolean>;

export type ScenePublicationConfig = Readonly<Record<string, boolean>>;

export const isScenePublished = (
  sceneId: string,
  publication: ScenePublicationConfig = scenePublication,
): boolean =>
  Object.prototype.hasOwnProperty.call(publication, sceneId) && publication[sceneId] === true;
