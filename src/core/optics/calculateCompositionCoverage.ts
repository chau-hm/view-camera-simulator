import { calculateGroundGlassFrameBoundsAtZ } from "../tasks/calculateGroundGlassFrameBounds";
import type { DerivedOpticsState } from "../../types/optics";
import type { Bounds3 } from "../../types/optics";
import type { CompositionTarget, SceneDefinition } from "../../types/scene";

const overlap1d = (aMin: number, aMax: number, bMin: number, bMax: number): number =>
  Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));

const boundsCorners = (bounds: Bounds3) =>
  [bounds.min.x, bounds.max.x].flatMap((x) =>
    [bounds.min.y, bounds.max.y].flatMap((y) =>
      [bounds.min.z, bounds.max.z].map((z) => ({ x, y, z })),
    ),
  );

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

/**
 * Measures the fraction of a target's canonical 3D bounds corners that land
 * inside the usable Ground Glass frame. This complements the legacy
 * frame-area estimate for targets that span enough depth for perspective to
 * crop one end while the center-depth rectangle still appears covered.
 */
export const calculateProjectedCompositionCoverageByTarget = (
  scene: SceneDefinition,
  opticsState: DerivedOpticsState,
): Record<string, number> => {
  const entries = scene.compositionTargets.map((target: CompositionTarget) => {
    const corners = boundsCorners(target.worldBounds);
    const visibleCount = corners.filter((worldPoint) => {
      const frameBounds = calculateGroundGlassFrameBoundsAtZ(opticsState, worldPoint.z);
      return (
        worldPoint.x >= frameBounds.minX &&
        worldPoint.x <= frameBounds.maxX &&
        worldPoint.y >= frameBounds.minY &&
        worldPoint.y <= frameBounds.maxY
      );
    }).length;
    return [target.id, corners.length === 0 ? 0 : visibleCount / corners.length] as const;
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
