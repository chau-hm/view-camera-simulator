import type { SceneDefinition } from "../../types/scene";

export const calculateCompositionCoverage = (scene: SceneDefinition): number => {
  if (scene.compositionTargets.length === 0) {
    return 0;
  }
  return 1;
};
