import type { DerivedOpticsState, Bounds3, Vec3 } from "../types/optics";
import { projectWorldPointToFilmPlaneGroundGlass } from "../render/groundGlassFilmPlaneProjection";
import { mirrorShiftGeometry } from "./mirrorShiftGeometry";

export type MirrorShiftTeachingSegment = Readonly<{
  start: Vec3;
  end: Vec3;
}>;

export type MirrorShiftTeachingRay = Readonly<{
  mirrorPoint: Vec3;
  lensPoint: Vec3;
  filmPoint: Vec3 | null;
}>;

export type MirrorShiftTeachingCameraGeometry = Readonly<{
  filmPlane: MirrorShiftTeachingSegment;
  lensPlane: MirrorShiftTeachingSegment;
  filmCenter: Vec3;
  lensCenter: Vec3;
  chiefRay: MirrorShiftTeachingRay;
}>;

export type MirrorShiftTeachingDiagramModel = Readonly<{
  bounds: Bounds3;
  mirrorPlane: MirrorShiftTeachingSegment;
  mirrorCenter: Vec3;
  neutral: MirrorShiftTeachingCameraGeometry;
  current: MirrorShiftTeachingCameraGeometry;
  rigShiftCue: MirrorShiftTeachingSegment | null;
  rigLateralMm: number;
  frontShiftCue: MirrorShiftTeachingSegment | null;
  frontShiftMm: number;
}>;

const point = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const segmentBounds = (
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  segment: MirrorShiftTeachingSegment,
): void => {
  for (const value of [segment.start, segment.end]) {
    bounds.minX = Math.min(bounds.minX, value.x);
    bounds.maxX = Math.max(bounds.maxX, value.x);
    bounds.minZ = Math.min(bounds.minZ, value.z);
    bounds.maxZ = Math.max(bounds.maxZ, value.z);
  }
};

const resolveFilmPlaneSegment = (
  opticsState: DerivedOpticsState,
): MirrorShiftTeachingSegment => ({
  start: opticsState.filmPlaneCornersWorld.topLeft,
  end: opticsState.filmPlaneCornersWorld.topRight,
});

const resolveLensPlaneSegment = (
  opticsState: DerivedOpticsState,
): MirrorShiftTeachingSegment => {
  const halfWidth = mirrorShiftGeometry.camera.frontStandard.widthMm / 2;
  return {
    start: point(opticsState.lensCenterWorld.x - halfWidth, opticsState.lensCenterWorld.y, opticsState.lensCenterWorld.z),
    end: point(opticsState.lensCenterWorld.x + halfWidth, opticsState.lensCenterWorld.y, opticsState.lensCenterWorld.z),
  };
};

const resolveChiefRay = (opticsState: DerivedOpticsState): MirrorShiftTeachingRay => {
  const mirrorPoint = mirrorShiftGeometry.mirror.center;
  const projection = projectWorldPointToFilmPlaneGroundGlass({
    worldPoint: mirrorPoint,
    lensCenterWorld: opticsState.lensCenterWorld,
    filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
  });
  return {
    mirrorPoint,
    lensPoint: opticsState.lensCenterWorld,
    filmPoint: projection.filmPointWorld,
  };
};

const resolveCameraGeometry = (
  opticsState: DerivedOpticsState,
): MirrorShiftTeachingCameraGeometry => ({
  filmPlane: resolveFilmPlaneSegment(opticsState),
  lensPlane: resolveLensPlaneSegment(opticsState),
  filmCenter: opticsState.filmCenterWorld,
  lensCenter: opticsState.lensCenterWorld,
  chiefRay: resolveChiefRay(opticsState),
});

/** Build the scene-local top-view model from the same optics used by 3D/RTT. */
export const resolveMirrorShiftTeachingDiagramModel = ({
  neutralOptics,
  currentOptics,
}: {
  neutralOptics: DerivedOpticsState;
  currentOptics: DerivedOpticsState;
}): MirrorShiftTeachingDiagramModel => {
  const mirrorPlane: MirrorShiftTeachingSegment = {
    start: mirrorShiftGeometry.mirror.innerBounds.min,
    end: mirrorShiftGeometry.mirror.innerBounds.max,
  };
  const mirrorCenter = mirrorShiftGeometry.mirror.center;
  const neutral = resolveCameraGeometry(neutralOptics);
  const current = resolveCameraGeometry(currentOptics);
  const rigLateralMm = current.filmCenter.x - neutral.filmCenter.x;
  const rigShiftCue = Math.abs(rigLateralMm) > 1e-6
    ? {
        start: point(neutral.filmCenter.x, 0, Math.max(neutral.filmCenter.z, current.filmCenter.z) + 140),
        end: point(current.filmCenter.x, 0, Math.max(neutral.filmCenter.z, current.filmCenter.z) + 140),
      }
    : null;
  const frontShiftMm = current.lensCenter.x - current.filmCenter.x;
  const frontShiftCue = Math.abs(frontShiftMm) > 1e-6
    ? {
        start: point(current.filmCenter.x, 0, Math.max(current.filmCenter.z, current.lensCenter.z) + 360),
        end: point(current.lensCenter.x, 0, Math.max(current.filmCenter.z, current.lensCenter.z) + 360),
      }
    : null;

  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
  };
  const segments = [
    mirrorPlane,
    neutral.filmPlane,
    neutral.lensPlane,
    current.filmPlane,
    current.lensPlane,
  ];
  for (const segment of segments) segmentBounds(bounds, segment);
  if (rigShiftCue) segmentBounds(bounds, rigShiftCue);
  for (const ray of [neutral.chiefRay, current.chiefRay]) {
    for (const rayPoint of [ray.mirrorPoint, ray.lensPoint, ray.filmPoint]) {
      if (!rayPoint) continue;
      bounds.minX = Math.min(bounds.minX, rayPoint.x);
      bounds.maxX = Math.max(bounds.maxX, rayPoint.x);
      bounds.minZ = Math.min(bounds.minZ, rayPoint.z);
      bounds.maxZ = Math.max(bounds.maxZ, rayPoint.z);
    }
  }
  if (frontShiftCue) segmentBounds(bounds, frontShiftCue);

  const xMargin = Math.max(260, (bounds.maxX - bounds.minX) * 0.12);
  const zMargin = Math.max(260, (bounds.maxZ - bounds.minZ) * 0.08);
  return {
    bounds: {
      min: { x: bounds.minX - xMargin, y: 0, z: bounds.minZ - zMargin },
      max: { x: bounds.maxX + xMargin, y: 0, z: bounds.maxZ + zMargin },
    },
    mirrorPlane,
    mirrorCenter,
    neutral,
    current,
    rigShiftCue,
    rigLateralMm,
    frontShiftCue,
    frontShiftMm,
  };
};
