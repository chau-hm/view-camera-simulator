import type {
  SceneDefinition,
  SceneFocusDistanceRangeMm,
} from "../../types/scene";
import { minimumRealImageFiniteFocusDistanceMm } from "../../core/optics/finiteFocusDomain";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { architectureRiseScene } from "./architecture-rise";
import { shelfSwingScene } from "./shelf-swing";
import { tableTiltScene } from "./table-tilt";
import { focusFundamentalsTwoTargets } from "./focus-fundamentals-two-targets";
import { understandingCameraMovementsScene } from "./understanding-camera-movements";
import { mirrorShiftScene } from "./mirror-shift";
import { obliqueArchitectureScene } from "./oblique-architecture";
import { architectureForegroundScene } from "./architecture-foreground";
import { viewCameraAnatomyScene } from "./view-camera-anatomy";

export const sceneRegistry: Record<string, SceneDefinition> = {
  [viewCameraAnatomyScene.id]: viewCameraAnatomyScene,
  [understandingCameraMovementsScene.id]: understandingCameraMovementsScene,
  [architectureRiseScene.id]: architectureRiseScene,
  [architectureForegroundScene.id]: architectureForegroundScene,
  [tableTiltScene.id]: tableTiltScene,
  [shelfSwingScene.id]: shelfSwingScene,
  [focusFundamentalsTwoTargets.id]: focusFundamentalsTwoTargets,
  [mirrorShiftScene.id]: mirrorShiftScene,
  [obliqueArchitectureScene.id]: obliqueArchitectureScene,
};

export const sceneOrder = [
  viewCameraAnatomyScene.id,
  understandingCameraMovementsScene.id,
  architectureRiseScene.id,
  architectureForegroundScene.id,
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

export type FocusDistanceRangeMm = SceneFocusDistanceRangeMm;

const isValidExplicitFocusDistanceRange = (
  range: FocusDistanceRangeMm | undefined,
): range is FocusDistanceRangeMm =>
  range !== undefined &&
  Number.isFinite(range.min) &&
  Number.isFinite(range.max) &&
  range.min > 0 &&
  range.max >= range.min;

const DEFAULT_FOCUS_DISTANCE_RANGE_MM: FocusDistanceRangeMm = {
  min: 100,
  max: 12000,
};

export const getSceneFocusDistanceRange = (
  sceneId: string,
  focalLengthMm: number = CAMERA_CONSTANTS.focalLengthMm,
): FocusDistanceRangeMm => {
  const scene = getSceneById(sceneId);
  if (!scene) {
    return DEFAULT_FOCUS_DISTANCE_RANGE_MM;
  }

  const usesRealImageFocusDistance =
    scene.finiteFocusStrategy?.kind === "rear-standard-thin-lens" &&
    scene.finiteFocusStrategy.focusDistanceReference === "lens-to-focus-plane";
  const realImageMinimum = usesRealImageFocusDistance
    ? minimumRealImageFiniteFocusDistanceMm(focalLengthMm)
    : null;

  if (isValidExplicitFocusDistanceRange(scene.focusDistanceRangeMm)) {
    const min = Math.max(scene.focusDistanceRangeMm.min, realImageMinimum ?? -Infinity);
    return {
      min,
      max: Math.max(scene.focusDistanceRangeMm.max, min),
    };
  }

  const min = Math.max(
    DEFAULT_FOCUS_DISTANCE_RANGE_MM.min,
    scene.bounds.min.z,
    scene.focusStandardCapability?.minimumFocusDepthMm ?? DEFAULT_FOCUS_DISTANCE_RANGE_MM.min,
    realImageMinimum ?? -Infinity,
  );
  const max = Math.max(min, scene.bounds.max.z);
  return { min, max };
};
