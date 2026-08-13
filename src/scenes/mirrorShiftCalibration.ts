import type { DerivedOpticsState, Vec3 } from "../types/optics";
import {
  mirrorShiftGeometry,
  resolveMirrorShiftCameraAnchors,
  type MirrorShiftCameraAnchorSet,
  type MirrorShiftProp,
} from "./mirrorShiftGeometry";
import {
  projectWorldPointToFilmPlaneGroundGlass,
  type GroundGlassFilmPlaneProjectionResult,
} from "../render/groundGlassFilmPlaneProjection";

export type MirrorShiftTeachingStateName =
  | "neutral"
  | "camera-moved"
  | "framing-restored";

export type MirrorShiftTeachingStateValues = Readonly<{
  rigLateralMm: number;
  frontShiftMm: number;
}>;

/**
 * Scene-local reference values for PR 5D. B and C deliberately share the
 * same rig position; only the front standard changes between them.
 */
export const MIRROR_SHIFT_SCENE_CALIBRATION = {
  states: {
    neutral: {
      rigLateralMm: 0,
      frontShiftMm: 0,
    },
    "camera-moved": {
      rigLateralMm: 2000,
      frontShiftMm: 0,
    },
    "framing-restored": {
      rigLateralMm: 2000,
      frontShiftMm: -55,
    },
  },
  tolerances: {
    mirrorFramingRestoredNormalized: 0.02,
    minimumMovedMirrorDisplacementNormalized: 0.25,
    cameraReflectionClearanceMm: 80,
    minimumPropParallaxDeltaNormalized: 0.02,
    mirrorRectangularityResidual: 1e-8,
  },
} as const;

export const resolveMirrorShiftTeachingState = (
  state: MirrorShiftTeachingStateName,
): MirrorShiftTeachingStateValues =>
  MIRROR_SHIFT_SCENE_CALIBRATION.states[state];

export type MirrorShiftMirrorCornerName =
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

export type MirrorShiftTeachingProjection = GroundGlassFilmPlaneProjectionResult;

export type MirrorShiftCameraReflectionMetrics = Readonly<{
  boundsMm: Readonly<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }>;
  intersectsMirrorAperture: boolean;
  clearanceMm: number;
}>;

export type MirrorShiftRectangularityMetrics = Readonly<{
  horizontalEdgeVResidual: number;
  verticalEdgeUResidual: number;
  oppositeHorizontalEdgeParallelResidual: number;
  oppositeVerticalEdgeParallelResidual: number;
  maxResidual: number;
}>;

export type MirrorShiftTeachingMetrics = Readonly<{
  mirrorCenter: MirrorShiftTeachingProjection;
  mirrorCorners: Readonly<Record<MirrorShiftMirrorCornerName, MirrorShiftTeachingProjection>>;
  cameraReflection: MirrorShiftCameraReflectionMetrics;
  reflectedPropProjections: Readonly<Record<MirrorShiftProp["id"], MirrorShiftTeachingProjection>>;
  reflectedPropSeparationNormalized: number;
  rectangularity: MirrorShiftRectangularityMetrics;
}>;

const mirrorCorners = (): Record<MirrorShiftMirrorCornerName, Vec3> => {
  const { innerBounds, plane } = mirrorShiftGeometry.mirror;
  return {
    topLeft: {
      x: innerBounds.min.x,
      y: innerBounds.max.y,
      z: plane.point.z,
    },
    topRight: {
      x: innerBounds.max.x,
      y: innerBounds.max.y,
      z: plane.point.z,
    },
    bottomLeft: {
      x: innerBounds.min.x,
      y: innerBounds.min.y,
      z: plane.point.z,
    },
    bottomRight: {
      x: innerBounds.max.x,
      y: innerBounds.min.y,
      z: plane.point.z,
    },
  };
};

const project = (
  opticsState: DerivedOpticsState,
  worldPoint: Vec3,
): MirrorShiftTeachingProjection =>
  projectWorldPointToFilmPlaneGroundGlass({
    worldPoint,
    lensCenterWorld: opticsState.lensCenterWorld,
    filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
  });

const extendBounds = (
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  point: Vec3,
  halfWidthMm: number,
  halfHeightMm: number,
): void => {
  bounds.minX = Math.min(bounds.minX, point.x - halfWidthMm);
  bounds.maxX = Math.max(bounds.maxX, point.x + halfWidthMm);
  bounds.minY = Math.min(bounds.minY, point.y - halfHeightMm);
  bounds.maxY = Math.max(bounds.maxY, point.y + halfHeightMm);
};

const resolveCameraReflectionBounds = (
  anchors: MirrorShiftCameraAnchorSet,
): MirrorShiftCameraReflectionMetrics => {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  const { camera } = mirrorShiftGeometry;

  extendBounds(
    bounds,
    anchors.frontStandardCenter,
    camera.frontStandard.widthMm / 2,
    camera.frontStandard.heightMm / 2,
  );
  extendBounds(
    bounds,
    anchors.rearStandardCenter,
    camera.rearStandard.widthMm / 2,
    camera.rearStandard.heightMm / 2,
  );
  extendBounds(bounds, anchors.tripodHead, 110 / 2, 70 / 2);
  extendBounds(
    bounds,
    anchors.leftTripodFoot,
    camera.tripod.legWidthMm / 2,
    camera.tripod.legWidthMm / 2,
  );
  extendBounds(
    bounds,
    anchors.rightTripodFoot,
    camera.tripod.legWidthMm / 2,
    camera.tripod.legWidthMm / 2,
  );

  const aperture = mirrorShiftGeometry.mirror.innerBounds;
  const xClearance =
    bounds.maxX < aperture.min.x
      ? aperture.min.x - bounds.maxX
      : bounds.minX > aperture.max.x
        ? bounds.minX - aperture.max.x
        : 0;
  const yClearance =
    bounds.maxY < aperture.min.y
      ? aperture.min.y - bounds.maxY
      : bounds.minY > aperture.max.y
        ? bounds.minY - aperture.max.y
        : 0;

  return {
    boundsMm: bounds,
    intersectsMirrorAperture: xClearance === 0 && yClearance === 0,
    clearanceMm: Math.max(xClearance, yClearance),
  };
};

const normalizedCrossResidual = (
  first: { x: number; y: number },
  second: { x: number; y: number },
): number => {
  const denominator = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
  if (!Number.isFinite(denominator) || denominator <= 1e-12) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(first.x * second.y - first.y * second.x) / denominator;
};

const resolveRectangularity = (
  corners: Readonly<Record<MirrorShiftMirrorCornerName, MirrorShiftTeachingProjection>>,
): MirrorShiftRectangularityMetrics => {
  const top = {
    x: corners.topRight.uRaw - corners.topLeft.uRaw,
    y: corners.topRight.vRaw - corners.topLeft.vRaw,
  };
  const bottom = {
    x: corners.bottomRight.uRaw - corners.bottomLeft.uRaw,
    y: corners.bottomRight.vRaw - corners.bottomLeft.vRaw,
  };
  const left = {
    x: corners.topLeft.uRaw - corners.bottomLeft.uRaw,
    y: corners.topLeft.vRaw - corners.bottomLeft.vRaw,
  };
  const right = {
    x: corners.topRight.uRaw - corners.bottomRight.uRaw,
    y: corners.topRight.vRaw - corners.bottomRight.vRaw,
  };
  const horizontalEdgeVResidual = Math.max(Math.abs(top.y), Math.abs(bottom.y));
  const verticalEdgeUResidual = Math.max(Math.abs(left.x), Math.abs(right.x));
  const oppositeHorizontalEdgeParallelResidual = normalizedCrossResidual(top, bottom);
  const oppositeVerticalEdgeParallelResidual = normalizedCrossResidual(left, right);
  return {
    horizontalEdgeVResidual,
    verticalEdgeUResidual,
    oppositeHorizontalEdgeParallelResidual,
    oppositeVerticalEdgeParallelResidual,
    maxResidual: Math.max(
      horizontalEdgeVResidual,
      verticalEdgeUResidual,
      oppositeHorizontalEdgeParallelResidual,
      oppositeVerticalEdgeParallelResidual,
    ),
  };
};

/** Measure the scene-local teaching contracts from canonical optics output. */
export const measureMirrorShiftTeachingState = (
  opticsState: DerivedOpticsState,
  values: Partial<MirrorShiftTeachingStateValues> = {},
): MirrorShiftTeachingMetrics => {
  const rigLateralMm = values.rigLateralMm ?? opticsState.cameraRigTransform.rigOriginWorld.x;
  const frontShiftMm = values.frontShiftMm ?? opticsState.cameraBodyLocalGeometry.lensCenterLocal.x;
  const corners = mirrorCorners();
  const projectedCorners = Object.fromEntries(
    Object.entries(corners).map(([name, point]) => [name, project(opticsState, point)]),
  ) as Record<MirrorShiftMirrorCornerName, MirrorShiftTeachingProjection>;
  const reflectedPropProjections = Object.fromEntries(
    mirrorShiftGeometry.reflectedProps.map((prop) => [prop.id, project(opticsState, prop.position)]),
  ) as Record<MirrorShiftProp["id"], MirrorShiftTeachingProjection>;
  const reflected = resolveMirrorShiftCameraAnchors(
    { x: rigLateralMm, y: 0, z: 0 },
    frontShiftMm,
  ).reflected;

  return {
    mirrorCenter: project(opticsState, mirrorShiftGeometry.mirror.center),
    mirrorCorners: projectedCorners,
    cameraReflection: resolveCameraReflectionBounds(reflected),
    reflectedPropProjections,
    reflectedPropSeparationNormalized:
      reflectedPropProjections["tall-marker"].uRaw -
      reflectedPropProjections["round-stool"].uRaw,
    rectangularity: resolveRectangularity(projectedCorners),
  };
};
