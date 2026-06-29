import type { SceneDefinition } from "../../types/scene";
import { architectureRiseScene } from "./architecture-rise";
import { shelfSwingScene } from "./shelf-swing";
import { tableTiltScene } from "./table-tilt";

export const sceneRegistry: Record<string, SceneDefinition> = {
  [architectureRiseScene.id]: architectureRiseScene,
  [tableTiltScene.id]: tableTiltScene,
  [shelfSwingScene.id]: shelfSwingScene,
};

export const getSceneById = (sceneId: string): SceneDefinition | undefined => sceneRegistry[sceneId];
