import { calculateGroundGlassFrameBoundsAtZ } from "../tasks/calculateGroundGlassFrameBounds";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";

const overlap1d = (aMin: number, aMax: number, bMin: number, bMax: number): number =>
  Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));

export const calculateCompositionCoverageByTarget = (
  scene: SceneDefinition,
  opticsState: DerivedOpticsState,
): Record<string, number> => {
  const entries = scene.compositionTargets.map((target) => {
    const centerZ = (target.worldBounds.min.z + target.worldBounds.max.z) / 2;
    const frameBounds = calculateGroundGlassFrameBoundsAtZ(opticsState, centerZ);
    const targetWidth = Math.max(1e-9, target.worldBounds.max.x - target.worldBounds.min.x);
    const targetHeight = Math.max(1e-9, target.worldBounds.max.y - target.worldBounds.min.y);
    const overlapWidth = overlap1d(
      target.worldBounds.min.x,
      target.worldBounds.max.x,
      frameBounds.minX,
      frameBounds.maxX,
    );
    const overlapHeight = overlap1d(
      target.worldBounds.min.y,
      target.worldBounds.max.y,
      frameBounds.minY,
      frameBounds.maxY,
    );
    const coverage = (overlapWidth * overlapHeight) / (targetWidth * targetHeight);
    return [target.id, Math.min(1, Math.max(0, coverage))] as const;
  });
  return Object.fromEntries(entries);
};

export const calculateCompositionCoverage = (
  scene: SceneDefinition,
  opticsState: DerivedOpticsState,
): number => {
  if (scene.compositionTargets.length === 0) {
    return 0;
  }
  const byTarget = calculateCompositionCoverageByTarget(scene, opticsState);
  const total = scene.compositionTargets.reduce((sum, target) => sum + (byTarget[target.id] ?? 0), 0);
  return total / scene.compositionTargets.length;
};
