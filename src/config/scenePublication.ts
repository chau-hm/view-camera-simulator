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

  // Macro Photography
  "macro-bellows-extension": true,
  "macro-depth-of-field": true,
  "macro-oblique-plane": true,
  "macro-compound-movements": true,

  // Free Practice
  "still-life-studio": false,
} as const satisfies Record<string, boolean>;

export type ScenePublicationConfig = Readonly<Record<string, boolean>>;

/**
 * The named qualification build can expose a scene to browser tests before its
 * manual publication gate is opened. Standard builds use the manual flag, and
 * production route validation itself remains unchanged.
 */
export const resolveScenePublication = (
  mode: string = import.meta.env.MODE,
): ScenePublicationConfig =>
  mode === "still-life-studio-qualification"
    ? { ...scenePublication, "still-life-studio": true }
    : scenePublication;

export const isScenePublished = (
  sceneId: string,
  publication: ScenePublicationConfig = scenePublication,
): boolean =>
  Object.prototype.hasOwnProperty.call(publication, sceneId) && publication[sceneId] === true;
