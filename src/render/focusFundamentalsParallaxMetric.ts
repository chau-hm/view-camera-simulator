import type { DerivedOpticsState, Vec3 } from "../types/optics";
import { dot, distance, normalize, subtract } from "../core/math/vec";
import {
  getFocusFundamentalsParallaxFeatureEdgeWorldPosition,
  getFocusFundamentalsParallaxPointerAssemblyEdgeWorldPosition,
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
  gateInnerWidthMm: number;
  pointerWidthMm: number;
  leftClearanceMm: number;
  rightClearanceMm: number;
  clearanceAsymmetryMm: number;
  pointerAssembly: FocusFundamentalsParallaxPointerAssemblyMetric;
  allPointsVisible: boolean;
};

export type FocusFundamentalsParallaxPointerAssemblyMetric = {
  cyanLeftFilmPointWorld: Vec3;
  cyanRightFilmPointWorld: Vec3;
  redLeftOuterFilmPointWorld: Vec3;
  redRightOuterFilmPointWorld: Vec3;
  cyanPointerWidthMm: number;
  redSleeveWidthMm: number;
  redSleeveLeftOffsetFromCyanCenterMm: number;
  redSleeveRightOffsetFromCyanCenterMm: number;
};

/** Conservative floor below the observed front-state physical separation. */
export const focusFundamentalsMinimumFrontParallaxAlignmentSeparationMm = 0.05;
/** Conservative positive edge clearance floor below the selected calibration. */
export const focusFundamentalsMinimumParallaxEdgeClearanceMm = 0.1;
/** Conservative visual asymmetry floor below the selected calibration. */
export const focusFundamentalsMinimumFrontParallaxClearanceAsymmetryMm = 0.15;
/** Rear asymmetry should remain numerical noise, not a visual response. */
export const focusFundamentalsMaximumRearParallaxClearanceAsymmetryMm = 1e-10;

/**
 * Project the two physical sight features through the resolved film plane.
 * Since both features share the reference lens ray, a fixed rear lens keeps
 * their projected separation at numerical zero even when the film moves.
 */
export const projectFocusFundamentalsParallaxMetric = (
  opticsState: DerivedOpticsState,
): FocusFundamentalsParallaxMetric | null => {
  const [nearFeature, farFeature] = focusFundamentalsParallaxFeatures;
  const project = (worldPoint: Vec3) =>
    projectWorldPointToFilmPlaneGroundGlass({
      worldPoint,
      lensCenterWorld: opticsState.lensCenterWorld,
      filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
    });
  const nearProjection = project(nearFeature.referenceWorldPositionMm);
  const farProjection = project(farFeature.referenceWorldPositionMm);
  const nearGateLeftProjection = project(
    getFocusFundamentalsParallaxFeatureEdgeWorldPosition(nearFeature, "left"),
  );
  const nearGateRightProjection = project(
    getFocusFundamentalsParallaxFeatureEdgeWorldPosition(nearFeature, "right"),
  );
  const farPointerLeftProjection = project(
    getFocusFundamentalsParallaxFeatureEdgeWorldPosition(farFeature, "left"),
  );
  const farPointerRightProjection = project(
    getFocusFundamentalsParallaxFeatureEdgeWorldPosition(farFeature, "right"),
  );
  const cyanPointerLeftProjection = project(
    getFocusFundamentalsParallaxPointerAssemblyEdgeWorldPosition(
      farFeature,
      "cyan-left",
    ),
  );
  const cyanPointerRightProjection = project(
    getFocusFundamentalsParallaxPointerAssemblyEdgeWorldPosition(
      farFeature,
      "cyan-right",
    ),
  );
  const redSleeveLeftProjection = project(
    getFocusFundamentalsParallaxPointerAssemblyEdgeWorldPosition(
      farFeature,
      "red-left-outer",
    ),
  );
  const redSleeveRightProjection = project(
    getFocusFundamentalsParallaxPointerAssemblyEdgeWorldPosition(
      farFeature,
      "red-right-outer",
    ),
  );
  const projections = [
    nearProjection,
    farProjection,
    nearGateLeftProjection,
    nearGateRightProjection,
    farPointerLeftProjection,
    farPointerRightProjection,
    cyanPointerLeftProjection,
    cyanPointerRightProjection,
    redSleeveLeftProjection,
    redSleeveRightProjection,
  ];
  if (projections.some(({ filmPointWorld }) => !filmPointWorld)) return null;
  if (
    !nearProjection.filmPointWorld ||
    !farProjection.filmPointWorld ||
    !nearGateLeftProjection.filmPointWorld ||
    !nearGateRightProjection.filmPointWorld ||
    !farPointerLeftProjection.filmPointWorld ||
    !farPointerRightProjection.filmPointWorld ||
    !cyanPointerLeftProjection.filmPointWorld ||
    !cyanPointerRightProjection.filmPointWorld ||
    !redSleeveLeftProjection.filmPointWorld ||
    !redSleeveRightProjection.filmPointWorld
  ) {
    return null;
  }

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

  const axisValue = (point: Vec3) => dot(point, signedAxis);
  const pointerAxisDirection = Math.sign(
    axisValue(cyanPointerRightProjection.filmPointWorld) -
      axisValue(cyanPointerLeftProjection.filmPointWorld),
  ) || 1;
  const orientedAxisValue = (point: Vec3) => axisValue(point) * pointerAxisDirection;
  const gateEdgeValues = [
    axisValue(nearGateLeftProjection.filmPointWorld),
    axisValue(nearGateRightProjection.filmPointWorld),
  ];
  const pointerEdgeValues = [
    axisValue(farPointerLeftProjection.filmPointWorld),
    axisValue(farPointerRightProjection.filmPointWorld),
  ];
  const gateInnerLeft = Math.min(...gateEdgeValues);
  const gateInnerRight = Math.max(...gateEdgeValues);
  const pointerLeft = Math.min(...pointerEdgeValues);
  const pointerRight = Math.max(...pointerEdgeValues);
  const leftClearanceMm = pointerLeft - gateInnerLeft;
  const rightClearanceMm = gateInnerRight - pointerRight;
  const cyanPointerCenterAxis = orientedAxisValue(farProjection.filmPointWorld);
  const cyanPointerLeftAxis = orientedAxisValue(cyanPointerLeftProjection.filmPointWorld);
  const cyanPointerRightAxis = orientedAxisValue(cyanPointerRightProjection.filmPointWorld);
  const redSleeveLeftAxis = orientedAxisValue(redSleeveLeftProjection.filmPointWorld);
  const redSleeveRightAxis = orientedAxisValue(redSleeveRightProjection.filmPointWorld);

  return {
    nearFilmPointWorld: nearProjection.filmPointWorld,
    farFilmPointWorld: farProjection.filmPointWorld,
    separationMm: distance(
      nearProjection.filmPointWorld,
      farProjection.filmPointWorld,
    ),
    signedSeparationMm: dot(delta, signedAxis),
    gateInnerWidthMm: gateInnerRight - gateInnerLeft,
    pointerWidthMm: pointerRight - pointerLeft,
    leftClearanceMm,
    rightClearanceMm,
    clearanceAsymmetryMm: rightClearanceMm - leftClearanceMm,
    pointerAssembly: {
      cyanLeftFilmPointWorld: cyanPointerLeftProjection.filmPointWorld,
      cyanRightFilmPointWorld: cyanPointerRightProjection.filmPointWorld,
      redLeftOuterFilmPointWorld: redSleeveLeftProjection.filmPointWorld,
      redRightOuterFilmPointWorld: redSleeveRightProjection.filmPointWorld,
      cyanPointerWidthMm: cyanPointerRightAxis - cyanPointerLeftAxis,
      redSleeveWidthMm: redSleeveRightAxis - redSleeveLeftAxis,
      redSleeveLeftOffsetFromCyanCenterMm: redSleeveLeftAxis - cyanPointerCenterAxis,
      redSleeveRightOffsetFromCyanCenterMm: redSleeveRightAxis - cyanPointerCenterAxis,
    },
    allPointsVisible: projections.every(({ visible }) => visible),
  };
};
