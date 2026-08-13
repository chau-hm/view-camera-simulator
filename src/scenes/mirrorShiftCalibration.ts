import type { DerivedOpticsState, Plane, Vec3 } from "../types/optics";
import { planeFromPointNormal } from "../core/math/plane";
import { intersectRayPlane } from "../core/math/ray";
import {
  add,
  cross,
  dot,
  isFiniteVec3,
  magnitude,
  normalize,
  scale,
  subtract,
} from "../core/math/vec";
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
    // Corrected mirror-plane projection leaves state C 34 mm beyond this gate.
    cameraReflectionClearanceMm: 180,
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
  /** True only when every representative proxy point projected successfully. */
  valid: boolean;
  /** Footprint projected onto the mirror plane from the current lens viewpoint. */
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
): void => {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxY = Math.max(bounds.maxY, point.y);
};

const boxCorners = (center: Vec3, halfSize: Vec3): Vec3[] => {
  const corners: Vec3[] = [];
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        corners.push({
          x: center.x + x * halfSize.x,
          y: center.y + y * halfSize.y,
          z: center.z + z * halfSize.z,
        });
      }
    }
  }
  return corners;
};

const beamCorners = (
  start: Vec3,
  end: Vec3,
  halfWidthMm: number,
  halfHeightMm: number,
): Vec3[] => {
  const direction = subtract(end, start);
  const length = magnitude(direction);
  if (!Number.isFinite(length) || length <= 1e-9) return [];

  const axis = scale(direction, 1 / length);
  const reference = Math.abs(axis.y) < 0.9
    ? { x: 0, y: 1, z: 0 }
    : { x: 1, y: 0, z: 0 };
  const widthAxis = normalize(cross(reference, axis));
  const heightAxis = normalize(cross(axis, widthAxis));
  const corners: Vec3[] = [];
  for (const endpoint of [start, end]) {
    for (const widthSign of [-1, 1]) {
      for (const heightSign of [-1, 1]) {
        corners.push(
          add(
            add(endpoint, scale(widthAxis, widthSign * halfWidthMm)),
            scale(heightAxis, heightSign * halfHeightMm),
          ),
        );
      }
    }
  }
  return corners;
};

const mirrorPlaneAsOpticsPlane = (plane: { point: Vec3; normal: Vec3 }): Plane =>
  planeFromPointNormal(plane.point, plane.normal);

/**
 * Project a virtual reflected point back to the physical mirror plane from
 * the current lens viewpoint. The result is on the mirror plane, rather than
 * at the virtual point's world-space X/Y coordinates.
 */
export const projectVirtualPointToMirrorPlane = ({
  viewpoint,
  virtualPoint,
  mirrorPlane = mirrorShiftGeometry.mirror.plane,
}: {
  viewpoint: Vec3;
  virtualPoint: Vec3;
  mirrorPlane?: { point: Vec3; normal: Vec3 };
}): Vec3 | null => {
  if (!isFiniteVec3(viewpoint) || !isFiniteVec3(virtualPoint)) return null;
  if (
    !isFiniteVec3(mirrorPlane.point) ||
    !isFiniteVec3(mirrorPlane.normal) ||
    magnitude(mirrorPlane.normal) <= 1e-9
  ) {
    return null;
  }
  const direction = subtract(virtualPoint, viewpoint);
  const directionLength = magnitude(direction);
  if (!Number.isFinite(directionLength) || directionLength <= 1e-9) return null;

  const hit = intersectRayPlane(
    {
      origin: viewpoint,
      direction: normalize(direction),
    },
    mirrorPlaneAsOpticsPlane(mirrorPlane),
  );
  if (!hit || !isFiniteVec3(hit.point)) return null;

  const alongRay = dot(subtract(hit.point, viewpoint), direction) /
    (directionLength * directionLength);
  if (!Number.isFinite(alongRay) || alongRay < -1e-9 || alongRay > 1 + 1e-9) {
    return null;
  }
  return hit.point;
};

const resolveCameraProxyRepresentativePoints = (
  anchors: MirrorShiftCameraAnchorSet,
): Vec3[] => {
  const { camera } = mirrorShiftGeometry;
  return [
    ...boxCorners(anchors.frontStandardCenter, {
      x: camera.frontStandard.widthMm / 2,
      y: camera.frontStandard.heightMm / 2,
      z: camera.frontStandard.depthMm / 2,
    }),
    ...boxCorners(anchors.rearStandardCenter, {
      x: camera.rearStandard.widthMm / 2,
      y: camera.rearStandard.heightMm / 2,
      z: camera.rearStandard.depthMm / 2,
    }),
    ...boxCorners(anchors.tripodHead, { x: 55, y: 35, z: 50 }),
    ...boxCorners(
      {
        x: anchors.frontStandardCenter.x,
        y: anchors.frontStandardCenter.y,
        z: anchors.frontStandardCenter.z - camera.lens.depthMm / 2 - 10,
      },
      { x: camera.lens.radiusMm, y: camera.lens.radiusMm, z: camera.lens.depthMm / 2 },
    ),
    ...beamCorners(
      anchors.frontStandardCenter,
      anchors.rearStandardCenter,
      camera.bellows.widthMm / 2,
      camera.bellows.heightMm / 2,
    ),
    ...beamCorners(
      anchors.tripodHead,
      anchors.leftTripodFoot,
      camera.tripod.legWidthMm / 2,
      camera.tripod.legWidthMm / 2,
    ),
    ...beamCorners(
      anchors.tripodHead,
      anchors.rightTripodFoot,
      camera.tripod.legWidthMm / 2,
      camera.tripod.legWidthMm / 2,
    ),
  ];
};

const resolveCameraReflectionBounds = (
  viewpoint: Vec3,
  anchors: MirrorShiftCameraAnchorSet,
): MirrorShiftCameraReflectionMetrics => {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  const projectedPoints = resolveCameraProxyRepresentativePoints(anchors)
    .map((virtualPoint) =>
      projectVirtualPointToMirrorPlane({ viewpoint, virtualPoint }),
    );

  if (projectedPoints.some((point) => point === null)) {
    return {
      valid: false,
      boundsMm: {
        minX: Number.NaN,
        maxX: Number.NaN,
        minY: Number.NaN,
        maxY: Number.NaN,
      },
      intersectsMirrorAperture: false,
      clearanceMm: Number.NaN,
    };
  }

  projectedPoints.forEach((point) => {
    if (point) extendBounds(bounds, point);
  });

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
    valid: true,
    boundsMm: bounds,
    intersectsMirrorAperture: xClearance === 0 && yClearance === 0,
    clearanceMm: Math.hypot(xClearance, yClearance),
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
    cameraReflection: resolveCameraReflectionBounds(opticsState.lensCenterWorld, reflected),
    reflectedPropProjections,
    reflectedPropSeparationNormalized:
      reflectedPropProjections["tall-marker"].uRaw -
      reflectedPropProjections["round-stool"].uRaw,
    rectangularity: resolveRectangularity(projectedCorners),
  };
};
