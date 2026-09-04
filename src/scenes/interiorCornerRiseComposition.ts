import type { Bounds3, DerivedOpticsState, Vec3 } from "../types/optics";
import {
  projectWorldPointToFilmPlaneGroundGlass,
  type GroundGlassFilmPlaneProjectionResult,
} from "../render/groundGlassFilmPlaneProjection";
import geometry from "./interiorCornerGeometry";

/**
 * Normalized Ground Glass margins for the Interior Corner framing exercise.
 * The upper architectural landmark and the room-corner anchor must both stay
 * inside this zone for the composition to remain comfortable.
 */
export const INTERIOR_CORNER_RISE_SAFE_FRAME = {
  minU: 0.1,
  maxU: 0.9,
  minV: 0.1,
  maxV: 0.9,
} as const;

export type InteriorCornerRiseCompositionAnchor = {
  projection: GroundGlassFilmPlaneProjectionResult;
  withinSafeFrame: boolean;
};

export type InteriorCornerRiseCompositionEvaluation = {
  upperArchitecture: InteriorCornerRiseCompositionAnchor;
  roomCorner: InteriorCornerRiseCompositionAnchor;
  passed: boolean;
};

const centerOfBounds = (bounds: Bounds3): Vec3 => ({
  x: (bounds.min.x + bounds.max.x) / 2,
  y: (bounds.min.y + bounds.max.y) / 2,
  z: (bounds.min.z + bounds.max.z) / 2,
});

const roomCornerAnchor = centerOfBounds(geometry.compositionTargets.roomCorner);

const isWithinSafeFrame = (
  projection: GroundGlassFilmPlaneProjectionResult,
): boolean => {
  const safeFrame = INTERIOR_CORNER_RISE_SAFE_FRAME;
  return (
    projection.visible &&
    Number.isFinite(projection.uRaw) &&
    Number.isFinite(projection.vRaw) &&
    projection.uRaw >= safeFrame.minU &&
    projection.uRaw <= safeFrame.maxU &&
    projection.vRaw >= safeFrame.minV &&
    projection.vRaw <= safeFrame.maxV
  );
};

const projectAnchor = (
  worldPoint: Vec3,
  opticsState: DerivedOpticsState,
): InteriorCornerRiseCompositionAnchor => {
  const projection = projectWorldPointToFilmPlaneGroundGlass({
    worldPoint,
    lensCenterWorld: opticsState.lensCenterWorld,
    filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
  });

  return {
    projection,
    withinSafeFrame: isWithinSafeFrame(projection),
  };
};

/**
 * Evaluate only the Interior Corner composition problem. This deliberately
 * measures projected framing rather than a Rise control value so the camera
 * can remain level while the learner corrects the upper-frame tension.
 */
export const evaluateInteriorCornerRiseComposition = (
  opticsState: DerivedOpticsState,
): InteriorCornerRiseCompositionEvaluation => {
  const upperArchitecture = projectAnchor(
    geometry.upperArchitectureFocusPoint,
    opticsState,
  );
  const roomCorner = projectAnchor(roomCornerAnchor, opticsState);

  return {
    upperArchitecture,
    roomCorner,
    passed: upperArchitecture.withinSafeFrame && roomCorner.withinSafeFrame,
  };
};
