import type { SceneDefinition } from "../types/scene";
import { getSceneById } from "../scenes/definitions";

export const publicSceneIds = ["focus-fundamentals-two-targets", "architecture-rise"] as const;
export type PublicSceneId = (typeof publicSceneIds)[number];

export type PublicSceneEntry = {
  id: PublicSceneId;
  description: string;
  topics: readonly string[];
};

export const publicSceneCatalog: readonly PublicSceneEntry[] = [
  {
    id: "focus-fundamentals-two-targets",
    description:
      "Compare two targets at different distances. Adjust focus and aperture to see how the plane of focus and depth of field change.",
    topics: ["Focus", "Aperture", "Depth of field"],
  },
  {
    id: "architecture-rise",
    description:
      "Use front rise to include the top of a building while keeping the camera level and vertical lines parallel.",
    topics: ["Rise", "Architecture", "Perspective control"],
  },
];

export const getPublicSceneEntries = (): Array<{
  scene: SceneDefinition;
  meta: PublicSceneEntry;
}> =>
  publicSceneCatalog
    .map((entry) => ({ scene: getSceneById(entry.id), meta: entry }))
    .filter(
      (e): e is { scene: SceneDefinition; meta: PublicSceneEntry } =>
        typeof e.scene !== "undefined",
    );

export const getPublicScenes = (): SceneDefinition[] => getPublicSceneEntries().map((e) => e.scene);
