import type {
  CameraBodyLocalGeometry,
  CameraBodyTransform,
  CameraRigPlacement,
  CameraRigTransform,
  CameraRigViewpointAnchor,
  FilmPlaneCorners,
  StandardFrame,
  Vec3,
} from "../../types/optics";
import { planeFromPointNormal } from "../math/plane";
import {
  add,
  distance,
  isFiniteVec3,
  magnitude,
  rotateAroundX,
  rotatePointAroundX,
  safeNormalize,
  vec,
} from "../math/vec";

export type CameraBodyWorldGeometry = {
  cameraBodyPivotWorld: Vec3;
  lensCenterWorld: Vec3;
  lensNormalWorld: Vec3;
  lensPlane: ReturnType<typeof planeFromPointNormal>;
  filmCenterWorld: Vec3;
  filmNormalWorld: Vec3;
  filmPlane: ReturnType<typeof planeFromPointNormal>;
  filmPlaneCornersWorld: FilmPlaneCorners;
  rearStandardFrame: StandardFrame;
};

const approximatelyEqual = (a: number, b: number): boolean => {
  const valueScale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= Number.EPSILON * valueScale * 8;
};

/** Validate a resolved non-identity viewpoint placement at the optics boundary. */
export const isValidCameraRigPlacement = (
  placement: CameraRigPlacement,
  expectedAnchor: CameraRigViewpointAnchor,
): boolean => {
  const expectedMetadata = {
    mid: { identity: "mid", relativeHeight: "at-mid" },
    high: { identity: "high", relativeHeight: "above-mid" },
    low: { identity: "low", relativeHeight: "below-mid" },
  } as const;
  if (!["mid", "high", "low"].includes(expectedAnchor)) {
    return false;
  }
  if (
    placement?.anchor !== expectedAnchor ||
    placement.arcPlane !== "yz" ||
    placement.metadata?.identity !== expectedMetadata[expectedAnchor].identity ||
    placement.metadata.relativeHeight !== expectedMetadata[expectedAnchor].relativeHeight ||
    !isFiniteVec3(placement.arcCenterWorld) ||
    !isFiniteVec3(placement.rigOriginWorld) ||
    placement.arcCenterWorld.x !== placement.rigOriginWorld.x ||
    !Number.isFinite(placement.basePitchDeg) ||
    !Number.isFinite(placement.arcAngleDeg) ||
    !Number.isFinite(placement.radiusMm) ||
    placement.radiusMm <= 0
  ) {
    return false;
  }
  if (
    !approximatelyEqual(
      distance(placement.arcCenterWorld, placement.rigOriginWorld),
      placement.radiusMm,
    )
  ) {
    return false;
  }
  switch (expectedAnchor) {
    case "mid":
      return placement.arcAngleDeg === 0;
    case "high":
      return placement.arcAngleDeg > 0 && placement.arcAngleDeg < 180;
    case "low":
      return placement.arcAngleDeg < 0 && placement.arcAngleDeg > -180;
  }
};

const assertFiniteDirection = (label: string, direction: Vec3): void => {
  if (!isFiniteVec3(direction) || magnitude(direction) === 0) {
    throw new Error(`${label} must be a finite, non-zero direction`);
  }
};

const assertValidRigTransform = (transform: CameraRigTransform): void => {
  if (!isFiniteVec3(transform.rigOriginWorld)) {
    throw new Error("Camera rig origin must be finite");
  }
  if (!isFiniteVec3(transform.bodyPitchPivotRigLocal)) {
    throw new Error("Camera body pitch pivot must be finite in rig-local coordinates");
  }
  if (!Number.isFinite(transform.basePitchDeg) || !Number.isFinite(transform.bodyPitchDeg)) {
    throw new Error("Camera rig base pitch and body pitch must be finite");
  }
};

const assertValidLocalGeometry = (local: CameraBodyLocalGeometry): void => {
  const points: ReadonlyArray<readonly [string, Vec3]> = [
    ["lens centre", local.lensCenterLocal],
    ["film centre", local.filmCenterLocal],
    ["film top-left corner", local.filmPlaneCornersLocal.topLeft],
    ["film top-right corner", local.filmPlaneCornersLocal.topRight],
    ["film bottom-left corner", local.filmPlaneCornersLocal.bottomLeft],
    ["film bottom-right corner", local.filmPlaneCornersLocal.bottomRight],
  ];
  for (const [label, point] of points) {
    if (!isFiniteVec3(point)) {
      throw new Error(`Camera body ${label} must be finite in rig-local coordinates`);
    }
  }
  assertFiniteDirection("Camera body lens normal", local.lensNormalLocal);
  assertFiniteDirection("Camera body film normal", local.filmNormalLocal);
  assertFiniteDirection("Camera body rear-standard right", local.rearStandardFrameLocal.rightWorld);
  assertFiniteDirection("Camera body rear-standard up", local.rearStandardFrameLocal.upWorld);
};

const rotateDirection = (
  direction: Vec3,
  bodyPitchDeg: number,
  basePitchDeg: number,
): Vec3 =>
  safeNormalize(
    rotateAroundX(rotateAroundX(direction, bodyPitchDeg), basePitchDeg),
    direction,
  );

export const transformRigLocalPointToWorld = (
  pointRigLocal: Vec3,
  transform: CameraRigTransform,
): Vec3 => {
  assertValidRigTransform(transform);
  if (!isFiniteVec3(pointRigLocal)) {
    throw new Error("Camera rig local point must be finite");
  }
  const bodyPitchedRigLocal = rotatePointAroundX(
    pointRigLocal,
    transform.bodyPitchPivotRigLocal,
    transform.bodyPitchDeg,
  );
  return add(
    transform.rigOriginWorld,
    rotateAroundX(bodyPitchedRigLocal, transform.basePitchDeg),
  );
};

/**
 * Apply local camera-body pitch after standard movements, then place the
 * complete rig in world space.
 *
 * The identity midpoint transform returns the original local object references
 * exactly, preserving the PR27/PR29 zero-movement contract.
 */
export const applyCameraRigTransform = (
  local: CameraBodyLocalGeometry,
  transform: CameraRigTransform,
): CameraBodyWorldGeometry => {
  assertValidRigTransform(transform);
  assertValidLocalGeometry(local);

  const isIdentityPlacement =
    transform.bodyPitchDeg === 0 &&
    transform.basePitchDeg === 0 &&
    transform.rigOriginWorld.x === 0 &&
    transform.rigOriginWorld.y === 0 &&
    transform.rigOriginWorld.z === 0;
  if (isIdentityPlacement) {
    return {
      cameraBodyPivotWorld: transform.bodyPitchPivotRigLocal,
      lensCenterWorld: local.lensCenterLocal,
      lensNormalWorld: local.lensNormalLocal,
      lensPlane: local.lensPlaneLocal,
      filmCenterWorld: local.filmCenterLocal,
      filmNormalWorld: local.filmNormalLocal,
      filmPlane: local.filmPlaneLocal,
      filmPlaneCornersWorld: local.filmPlaneCornersLocal,
      rearStandardFrame: local.rearStandardFrameLocal,
    };
  }

  const rotatePoint = (point: Vec3): Vec3 =>
    transformRigLocalPointToWorld(point, transform);
  const lensCenterWorld = rotatePoint(local.lensCenterLocal);
  const lensNormalWorld = rotateDirection(
    local.lensNormalLocal,
    transform.bodyPitchDeg,
    transform.basePitchDeg,
  );
  const filmCenterWorld = rotatePoint(local.filmCenterLocal);
  const filmNormalWorld = rotateDirection(
    local.filmNormalLocal,
    transform.bodyPitchDeg,
    transform.basePitchDeg,
  );
  const rightWorld = rotateDirection(
    local.rearStandardFrameLocal.rightWorld,
    transform.bodyPitchDeg,
    transform.basePitchDeg,
  );
  const upWorld = rotateDirection(
    local.rearStandardFrameLocal.upWorld,
    transform.bodyPitchDeg,
    transform.basePitchDeg,
  );
  const filmPlaneCornersWorld: FilmPlaneCorners = {
    topLeft: rotatePoint(local.filmPlaneCornersLocal.topLeft),
    topRight: rotatePoint(local.filmPlaneCornersLocal.topRight),
    bottomLeft: rotatePoint(local.filmPlaneCornersLocal.bottomLeft),
    bottomRight: rotatePoint(local.filmPlaneCornersLocal.bottomRight),
  };
  const filmPlane = planeFromPointNormal(filmCenterWorld, filmNormalWorld);

  return {
    cameraBodyPivotWorld: transformRigLocalPointToWorld(
      transform.bodyPitchPivotRigLocal,
      transform,
    ),
    lensCenterWorld,
    lensNormalWorld,
    lensPlane: planeFromPointNormal(lensCenterWorld, lensNormalWorld),
    filmCenterWorld,
    filmNormalWorld,
    filmPlane,
    filmPlaneCornersWorld,
    rearStandardFrame: {
      centerWorld: filmCenterWorld,
      rightWorld,
      upWorld,
      normalWorld: filmNormalWorld,
      plane: filmPlane,
    },
  };
};

/**
 * @deprecated Compatibility adapter for legacy zero-origin, zero-base-pitch
 * consumers. Canonical optics must call applyCameraRigTransform.
 */
export const applyCameraBodyPitch = (
  local: CameraBodyLocalGeometry,
  transform: CameraBodyTransform,
): CameraBodyWorldGeometry =>
  applyCameraRigTransform(local, {
    rigOriginWorld: vec(0, 0, 0),
    basePitchDeg: 0,
    bodyPitchDeg: transform.pitchDeg,
    bodyPitchPivotRigLocal: transform.pivotWorld,
  });
