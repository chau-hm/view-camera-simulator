import type { DerivedOpticsState, Vec3 } from "../types/optics";
import { dot, distance, normalize, subtract } from "../core/math/vec";
import {
  focusFundamentalsParallaxFeatures,
  focusFundamentalsParallaxReferenceGeometry,
} from "../scenes/focusFundamentalsParallax";
import { projectWorldPointToFilmPlaneGroundGlass } from "./groundGlassFilmPlaneProjection";

export type FocusFundamentalsParallaxMetric = {
  nearFilmPointWorld: Vec3;
  farFilmPointWorld: Vec3;
  separationMm: number;
  /** Signed far-minus-near displacement along the film-right axis. */
  signedSeparationMm: number;
  allPointsVisible: boolean;
};

/** Conservative floor below the observed front-state physical separation. */
export const focusFundamentalsMinimumFrontParallaxAlignmentSeparationMm = 0.05;

/**
 * Project the two physical sight features through the resolved film plane.
 * Since both features share the reference lens ray, a fixed rear lens keeps
 * their projected separation at numerical zero even when the film moves.
 */
export const projectFocusFundamentalsParallaxMetric = (
  opticsState: DerivedOpticsState,
): FocusFundamentalsParallaxMetric | null => {
  const [nearFeature, farFeature] = focusFundamentalsParallaxFeatures;
  const nearProjection = projectWorldPointToFilmPlaneGroundGlass({
    worldPoint: nearFeature.referenceWorldPositionMm,
    lensCenterWorld: opticsState.lensCenterWorld,
    filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
  });
  const farProjection = projectWorldPointToFilmPlaneGroundGlass({
    worldPoint: farFeature.referenceWorldPositionMm,
    lensCenterWorld: opticsState.lensCenterWorld,
    filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
  });
  if (!nearProjection.filmPointWorld || !farProjection.filmPointWorld) return null;

  const filmRight = normalize(
    subtract(
      opticsState.filmPlaneCornersWorld.topRight,
      opticsState.filmPlaneCornersWorld.topLeft,
    ),
  );
  const filmUp = normalize(
    subtract(
      opticsState.filmPlaneCornersWorld.topLeft,
      opticsState.filmPlaneCornersWorld.bottomLeft,
    ),
  );
  const delta = subtract(farProjection.filmPointWorld, nearProjection.filmPointWorld);
  const referenceOffset = focusFundamentalsParallaxReferenceGeometry.projectedFilmOffsetMm;
  const signedAxis =
    Math.abs(referenceOffset.x) >= Math.abs(referenceOffset.y) ? filmRight : filmUp;

  return {
    nearFilmPointWorld: nearProjection.filmPointWorld,
    farFilmPointWorld: farProjection.filmPointWorld,
    separationMm: distance(
      nearProjection.filmPointWorld,
      farProjection.filmPointWorld,
    ),
    signedSeparationMm: dot(delta, signedAxis),
    allPointsVisible: nearProjection.visible && farProjection.visible,
  };
};
