import type { SceneDefinition } from "../types/scene";
import { getSceneById } from "../scenes/definitions";

export const publicSceneIds = ["focus-fundamentals-two-targets"] as const;

export const getPublicScenes = (): SceneDefinition[] =>
  publicSceneIds
    .map((id) => getSceneById(id))
    .filter((s): s is SceneDefinition => typeof s !== "undefined");

export type PublicSceneId = (typeof publicSceneIds)[number];
