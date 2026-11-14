import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SceneDefinition } from "../types/scene";
import type { SimulatorMode } from "../types/camera";
import { useAppStore } from "../state/appStore";
import {
  parseSceneSeedFromSearch,
  withSceneSeedInSearch,
} from "./sceneVariationUrl";

type SceneVariationRouteProps = {
  mode: SimulatorMode;
  scene: Pick<SceneDefinition, "id" | "sceneVariation">;
  /** Optional deterministic seed source for route lifecycle tests. */
  createSeed?: () => number;
};

/** Synchronizes one simulator URL entry into the independent variant store. */
export const SceneVariationRouteSync = ({
  mode,
  scene,
  createSeed,
}: SceneVariationRouteProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const resolveSceneVariantRoute = useAppStore(
    (state) => state.resolveSceneVariantRoute,
  );

  useEffect(() => {
    const resolution = resolveSceneVariantRoute({
      mode,
      sceneId: scene.id,
      capability: scene.sceneVariation,
      routeKey: `${location.key}:${location.pathname}:${mode}:${scene.id}`,
      seed: parseSceneSeedFromSearch(location.search),
      createSeed,
    });
    const nextSearch = withSceneSeedInSearch(
      location.search,
      resolution.identity?.seed ?? null,
    );
    if (nextSearch !== location.search) {
      navigate(
        { pathname: location.pathname, search: nextSearch, hash: location.hash },
        { replace: true },
      );
    }
  }, [
    createSeed,
    location.hash,
    location.key,
    location.pathname,
    location.search,
    mode,
    navigate,
    resolveSceneVariantRoute,
    scene.id,
    scene.sceneVariation,
  ]);

  return null;
};

