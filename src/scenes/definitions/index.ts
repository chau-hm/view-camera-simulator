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

export type FocusDistanceRangeMm = {
  min: number;
  max: number;
};

const DEFAULT_FOCUS_DISTANCE_RANGE_MM: FocusDistanceRangeMm = {
  min: 100,
  max: 12000,
};

export const getSceneFocusDistanceRange = (sceneId: string): FocusDistanceRangeMm => {
  const scene = getSceneById(sceneId);
  if (!scene) {
    return DEFAULT_FOCUS_DISTANCE_RANGE_MM;
  }

  const min = Math.max(DEFAULT_FOCUS_DISTANCE_RANGE_MM.min, scene.bounds.min.z);
  const max = Math.max(min, scene.bounds.max.z);
  return { min, max };
};
