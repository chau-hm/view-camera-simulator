import type { SceneDefinition } from "../../types/scene";

export const calculateCompositionCoverage = (scene: SceneDefinition): number => {
  if (scene.focusTargets.length === 0) {
    return 0;
  }
  return 1;
};
