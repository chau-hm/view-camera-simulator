import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SceneDefinition } from "../types/scene";
import type { SimulatorMode } from "../types/camera";
import { useAppStore } from "../state/appStore";
import { createSceneVariantRegenerationLocation } from "./sceneVariationUrl";

/**
 * Future Regenerate Scene control API. It pushes a new seeded URL; the route
 * synchronizer then updates the active identity from that URL. No camera state
 * is written here.
 */
export const useRegenerateSceneVariant = (options: {
  mode: SimulatorMode;
  scene: Pick<SceneDefinition, "id" | "sceneVariation">;
  /** Optional deterministic seed source for route lifecycle tests. */
  createSeed?: () => number;
}): (() => boolean) => {
  const { mode, scene, createSeed } = options;
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(() => {
    const currentState = useAppStore.getState();
    if (
      currentState.ui.mode !== "free" ||
      currentState.scene.activeSceneId !== scene.id
    ) {
      return false;
    }
    const nextLocation = createSceneVariantRegenerationLocation({
      mode,
      scene,
      location,
      createSeed,
    });
    if (!nextLocation) return false;
    navigate(nextLocation);
    return true;
  }, [createSeed, location, mode, navigate, scene]);
};
