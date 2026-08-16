import type { SceneDefinition } from "../../types/scene";
import { architectureRiseScene } from "./architecture-rise";
import { shelfSwingScene } from "./shelf-swing";
import { tableTiltScene } from "./table-tilt";
import { focusFundamentalsTwoTargets } from "./focus-fundamentals-two-targets";
import { understandingCameraMovementsScene } from "./understanding-camera-movements";
import { mirrorShiftScene } from "./mirror-shift";
import { obliqueArchitectureScene } from "./oblique-architecture";

export const sceneRegistry: Record<string, SceneDefinition> = {
  [understandingCameraMovementsScene.id]: understandingCameraMovementsScene,
  [architectureRiseScene.id]: architectureRiseScene,
  [tableTiltScene.id]: tableTiltScene,
  [shelfSwingScene.id]: shelfSwingScene,
  [focusFundamentalsTwoTargets.id]: focusFundamentalsTwoTargets,
  [mirrorShiftScene.id]: mirrorShiftScene,
  [obliqueArchitectureScene.id]: obliqueArchitectureScene,
};

export const sceneOrder = [
  understandingCameraMovementsScene.id,
  architectureRiseScene.id,
  tableTiltScene.id,
  shelfSwingScene.id,
  focusFundamentalsTwoTargets.id,
  mirrorShiftScene.id,
  obliqueArchitectureScene.id,
] as const;

export const getSceneById = (sceneId: string): SceneDefinition | undefined =>
  sceneRegistry[sceneId];

export const getAllScenes = (): SceneDefinition[] =>
  sceneOrder.map((sceneId) => sceneRegistry[sceneId]);

export const getNextSceneId = (sceneId: string): string | null => {
  const index = sceneOrder.indexOf(sceneId as (typeof sceneOrder)[number]);
  if (index === -1 || index + 1 >= sceneOrder.length) {
    return null;
  }
  return sceneOrder[index + 1];
};

export const getRequiredSceneAssets = (sceneId: string) => {
  const scene = getSceneById(sceneId);
  return scene?.assets.filter((asset) => asset.loadStrategy !== "lazy") ?? [];
};

export const getLazySceneAssets = (sceneId: string) => {
  const scene = getSceneById(sceneId);
  return scene?.assets.filter((asset) => asset.loadStrategy === "lazy") ?? [];
};

export const getPreloadSceneAssets = (sceneId: string) => {
  const nextSceneId = getNextSceneId(sceneId);
  if (!nextSceneId) {
    return [];
  }
  return getRequiredSceneAssets(nextSceneId);
};

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

  const min = Math.max(
    DEFAULT_FOCUS_DISTANCE_RANGE_MM.min,
    scene.bounds.min.z,
    scene.focusStandardCapability?.minimumFocusDepthMm ?? DEFAULT_FOCUS_DISTANCE_RANGE_MM.min,
  );
  const max = Math.max(min, scene.bounds.max.z);
  return { min, max };
};
