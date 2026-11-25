import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SceneDefinition } from "../types/scene";
import type { SimulatorMode } from "../types/camera";
import { useAppStore } from "../state/appStore";
import {
  parseSceneSeedFromSearch,
  parseSceneVariationSchemaFromSearch,
  withSceneVariantInSearch,
} from "./sceneVariationUrl";

type SceneVariationRouteProps = {
  mode: SimulatorMode;
  scene: Pick<SceneDefinition, "id" | "sceneVariation">;
  /** Lesson Observe is a canonical presentation even though its route is Free Mode. */
  guidedLessonEntry?: boolean;
  /** Optional deterministic seed source for route lifecycle tests. */
  createSeed?: () => number;
};

/** Synchronizes one simulator URL entry into the independent variant store. */
export const SceneVariationRouteSync = ({
  mode,
  scene,
  guidedLessonEntry = false,
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
      schema: parseSceneVariationSchemaFromSearch(location.search),
      eligible: !guidedLessonEntry,
      createSeed,
    });
    const nextSearch = resolution.status === "resolved"
      ? withSceneVariantInSearch(location.search, resolution.identity)
      : resolution.status === "disabled"
        ? withSceneVariantInSearch(location.search, null)
        : location.search;
    if (nextSearch !== location.search) {
      navigate(
        { pathname: location.pathname, search: nextSearch, hash: location.hash },
        { replace: true },
      );
    }
  }, [
    createSeed,
    guidedLessonEntry,
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
