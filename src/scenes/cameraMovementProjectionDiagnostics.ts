import { distance, isFiniteVec3, magnitude } from "../core/math/vec";
import { projectWorldPointToFilmPlaneGroundGlass } from "../render/groundGlassFilmPlaneProjection";
import type {
  Bounds3,
  CameraRigViewpointAnchor,
  DerivedOpticsState,
  FilmPlaneCorners,
  Vec3,
} from "../types/optics";
import type {
  CanonicalCameraMovementLattice,
  CanonicalLatticeVertex,
} from "./cameraMovementLatticeGeometry";
import type { CameraMovementTargetRegion } from "./cameraMovementSceneCalibration";
import {
  type EffectiveCameraMovementCalibration,
  validateEffectiveCameraMovementCalibration,
} from "./cameraMovementEffectiveCalibration";

export const CAMERA_MOVEMENT_CONVERGENCE_EPSILON = 1e-6;

export type CameraMovementDiagnosticMetric<T> =
  | Readonly<{
      status: "available";
      value: T;
      reason: null;
    }>
  | Readonly<{
      status: "unavailable";
      value: null;
      reason: string;
    }>;

export type CameraMovementProjectionStatus = Readonly<{
  level: "ok" | "warning" | "error";
  code:
    | "all-in-frame"
    | "partially-off-frame"
    | "fully-off-frame"
    | "invalid-identity"
    | "invalid-calibration"
    | "invalid-lattice"
    | "anchor-mismatch"
    | "optics-fallback"
    | "projection-unavailable";
  messages: readonly string[];
}>;

export type CameraMovementProjectedUv = Readonly<{
  u: number;
  v: number;
}>;

type ProjectedPoint = Readonly<{
  uv: CameraMovementProjectedUv;
  inFrame: boolean;
}>;

export type CameraMovementVertexProjection = Readonly<{
  vertexId: CanonicalLatticeVertex["id"];
  projection: CameraMovementDiagnosticMetric<ProjectedPoint>;
}>;

export type CameraMovementCalibrationIdentity = Readonly<{
  sessionActive: boolean;
  revision: CameraMovementDiagnosticMetric<number>;
  geometryId: CameraMovementDiagnosticMetric<string>;
  edgeCount: CameraMovementDiagnosticMetric<number>;
  targetRegion: CameraMovementTargetRegion;
  effectiveKey: string;
}>;

export type CameraMovementFrontFaceCorners = Readonly<{
  topLeft: Readonly<Vec3>;
  topRight: Readonly<Vec3>;
  bottomLeft: Readonly<Vec3>;
  bottomRight: Readonly<Vec3>;
}>;

export type CameraMovementWorldGeometryDiagnostics = Readonly<{
  latticeBoundsWorld: CameraMovementDiagnosticMetric<Readonly<Bounds3>>;
  targetCentreWorld: CameraMovementDiagnosticMetric<Readonly<Vec3>>;
  nearestCameraFrontFaceWorld: CameraMovementDiagnosticMetric<
    Readonly<{
      zWorld: number;
      corners: CameraMovementFrontFaceCorners;
    }>
  >;
  rigOriginWorld: CameraMovementDiagnosticMetric<Readonly<Vec3>>;
  rigArcCentreWorld: CameraMovementDiagnosticMetric<Readonly<Vec3>>;
  lensCentreWorld: CameraMovementDiagnosticMetric<Readonly<Vec3>>;
  filmCentreWorld: CameraMovementDiagnosticMetric<Readonly<Vec3>>;
  bodyPitchPivotWorld: CameraMovementDiagnosticMetric<Readonly<Vec3>>;
  lensNormalWorld: CameraMovementDiagnosticMetric<Readonly<Vec3>>;
  filmNormalWorld: CameraMovementDiagnosticMetric<Readonly<Vec3>>;
  lensFilmDistanceMm: CameraMovementDiagnosticMetric<number>;
  lensTargetDistanceMm: CameraMovementDiagnosticMetric<number>;
}>;

export type CameraMovementSelectedTargetDiagnostic = Readonly<{
  region: CameraMovementTargetRegion;
  levelIndex: CameraMovementDiagnosticMetric<number>;
  centreWorld: CameraMovementDiagnosticMetric<Readonly<Vec3>>;
  uv: CameraMovementDiagnosticMetric<ProjectedPoint>;
}>;

export type CameraMovementProjectionDiagnostics = Readonly<{
  identity: CameraMovementCalibrationIdentity;
  currentAnchor: CameraRigViewpointAnchor;
  uvConvention: Readonly<{
    origin: "film-top-left";
    positiveU: "toward-film-right";
    positiveV: "toward-film-bottom";
    unclamped: true;
  }>;
  status: CameraMovementProjectionStatus;
  worldGeometry: CameraMovementWorldGeometryDiagnostics;
  selectedTarget: CameraMovementSelectedTargetDiagnostic;
  projectedVertices: readonly CameraMovementVertexProjection[];
  projectedBoundsUv: CameraMovementDiagnosticMetric<
    Readonly<{
      minU: number;
      maxU: number;
      minV: number;
      maxV: number;
    }>
  >;
  marginsUv: Readonly<{
    left: CameraMovementDiagnosticMetric<number>;
    right: CameraMovementDiagnosticMetric<number>;
    top: CameraMovementDiagnosticMetric<number>;
    bottom: CameraMovementDiagnosticMetric<number>;
  }>;
  coverage: Readonly<{
    horizontal: CameraMovementDiagnosticMetric<number>;
    vertical: CameraMovementDiagnosticMetric<number>;
    projectedBoundsInsideFrame: CameraMovementDiagnosticMetric<number>;
    filmFrameCovered: CameraMovementDiagnosticMetric<number>;
    visibleVertexFraction: CameraMovementDiagnosticMetric<number>;
  }>;
  convergence: Readonly<{
    construction: "nearest-camera-front-face-outer-corners";
    cornerUv: Readonly<{
      topLeft: CameraMovementDiagnosticMetric<ProjectedPoint>;
      topRight: CameraMovementDiagnosticMetric<ProjectedPoint>;
      bottomLeft: CameraMovementDiagnosticMetric<ProjectedPoint>;
      bottomRight: CameraMovementDiagnosticMetric<ProjectedPoint>;
    }>;
    topWidthUv: CameraMovementDiagnosticMetric<number>;
    bottomWidthUv: CameraMovementDiagnosticMetric<number>;
    leftVerticalSlope: CameraMovementDiagnosticMetric<number>;
    rightVerticalSlope: CameraMovementDiagnosticMetric<number>;
    normalizedSignal: CameraMovementDiagnosticMetric<number>;
    direction: CameraMovementDiagnosticMetric<"top" | "parallel" | "bottom">;
    epsilon: typeof CAMERA_MOVEMENT_CONVERGENCE_EPSILON;
  }>;
}>;

export type CameraMovementProjectionDiagnosticsInput = Readonly<{
  effectiveCalibration: EffectiveCameraMovementCalibration;
  lattice: CanonicalCameraMovementLattice;
  calibrationIdentity: Readonly<{
    sessionActive: boolean;
    revision: number;
    geometryId: string;
  }>;
  currentAnchor: CameraRigViewpointAnchor;
  targetRegion: CameraMovementTargetRegion;
  opticsState: DerivedOpticsState;
}>;

const available = <T>(value: T): CameraMovementDiagnosticMetric<T> => ({
  status: "available",
  value,
  reason: null,
});

const unavailable = <T>(reason: string): CameraMovementDiagnosticMetric<T> => ({
  status: "unavailable",
  value: null,
  reason,
});

const boundedFraction = (value: number): number => Math.min(1, Math.max(0, value));

const finitePointMetric = (
  point: Readonly<Vec3>,
  reason: string,
): CameraMovementDiagnosticMetric<Readonly<Vec3>> =>
  isFiniteVec3(point) ? available({ ...point }) : unavailable(reason);

const finiteNormalMetric = (
  normal: Readonly<Vec3>,
  reason: string,
): CameraMovementDiagnosticMetric<Readonly<Vec3>> =>
  isFiniteVec3(normal) && magnitude(normal) > CAMERA_MOVEMENT_CONVERGENCE_EPSILON
    ? available({ ...normal })
    : unavailable(reason);

const filmCornersAreFinite = (corners: FilmPlaneCorners): boolean =>
  isFiniteVec3(corners.topLeft) &&
  isFiniteVec3(corners.topRight) &&
  isFiniteVec3(corners.bottomLeft) &&
  isFiniteVec3(corners.bottomRight);

const projectPoint = (
  worldPoint: Readonly<Vec3>,
  opticsState: DerivedOpticsState,
): CameraMovementDiagnosticMetric<ProjectedPoint> => {
  if (!isFiniteVec3(worldPoint)) {
    return unavailable("World point is not finite");
  }
  if (
    !isFiniteVec3(opticsState.lensCenterWorld) ||
    !filmCornersAreFinite(opticsState.filmPlaneCornersWorld)
  ) {
    return unavailable("Lens centre or film corners are not finite");
  }
  const result = projectWorldPointToFilmPlaneGroundGlass({
    worldPoint: { ...worldPoint },
    lensCenterWorld: opticsState.lensCenterWorld,
    filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
  });
  if (
    result.filmPointWorld === null ||
    !isFiniteVec3(result.filmPointWorld) ||
    !Number.isFinite(result.uRaw) ||
    !Number.isFinite(result.vRaw)
  ) {
    return unavailable("Point ray does not produce a finite forward film-plane intersection");
  }
  return available({
    // Intentionally raw: valid off-frame values may be below 0 or above 1.
    uv: { u: result.uRaw, v: result.vRaw },
    inFrame: result.visible,
  });
};

const boundsAreFinite = (bounds: Readonly<Bounds3>): boolean =>
  isFiniteVec3(bounds.min) &&
  isFiniteVec3(bounds.max) &&
  bounds.max.x > bounds.min.x &&
  bounds.max.y > bounds.min.y &&
  bounds.max.z > bounds.min.z;

const levelCentre = (
  lattice: CanonicalCameraMovementLattice,
  region: CameraMovementTargetRegion,
): Readonly<{ levelIndex: number; worldPoint: Vec3 }> | null => {
  const levelIndex = lattice.targetLevelByRegion[region];
  const level = lattice.perLevelBounds[levelIndex];
  if (!level || !Number.isInteger(levelIndex) || !boundsAreFinite(level.bounds)) return null;
  return {
    levelIndex,
    worldPoint: {
      x: (level.bounds.min.x + level.bounds.max.x) / 2,
      y: (level.bounds.min.y + level.bounds.max.y) / 2,
      z: (level.bounds.min.z + level.bounds.max.z) / 2,
    },
  };
};

const cornersAtZ = (bounds: Readonly<Bounds3>, zWorld: number): CameraMovementFrontFaceCorners => ({
  topLeft: { x: bounds.min.x, y: bounds.max.y, z: zWorld },
  topRight: { x: bounds.max.x, y: bounds.max.y, z: zWorld },
  bottomLeft: { x: bounds.min.x, y: bounds.min.y, z: zWorld },
  bottomRight: { x: bounds.max.x, y: bounds.min.y, z: zWorld },
});

const nearestCameraFrontFace = (
  bounds: Readonly<Bounds3>,
  lensCentreWorld: Readonly<Vec3>,
): Readonly<{ zWorld: number; corners: CameraMovementFrontFaceCorners }> | null => {
  if (!boundsAreFinite(bounds) || !isFiniteVec3(lensCentreWorld)) return null;
  const faceCentre = (z: number): Vec3 => ({
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z,
  });
  const minDistance = distance(lensCentreWorld, faceCentre(bounds.min.z));
  const maxDistance = distance(lensCentreWorld, faceCentre(bounds.max.z));
  if (!Number.isFinite(minDistance) || !Number.isFinite(maxDistance)) return null;
  const zWorld = minDistance <= maxDistance ? bounds.min.z : bounds.max.z;
  return { zWorld, corners: cornersAtZ(bounds, zWorld) };
};

const approximatelyEqual = (a: number, b: number): boolean => {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * scale;
};

const latticeMatchesCalibration = (
  lattice: CanonicalCameraMovementLattice,
  calibration: EffectiveCameraMovementCalibration,
): boolean => {
  const { subject } = calibration;
  const expectedWidth =
    subject.columns * subject.cubeSizeMm + (subject.columns - 1) * subject.horizontalGapMm;
  const expectedDepth =
    subject.rows * subject.cubeSizeMm + (subject.rows - 1) * subject.horizontalGapMm;
  const expectedHeight =
    subject.levels * subject.cubeSizeMm + (subject.levels - 1) * subject.verticalGapMm;
  const centre = {
    x: (lattice.bounds.min.x + lattice.bounds.max.x) / 2,
    y: (lattice.bounds.min.y + lattice.bounds.max.y) / 2,
    z: (lattice.bounds.min.z + lattice.bounds.max.z) / 2,
  };
  return (
    lattice.units === "millimetres" &&
    lattice.dimensions.columns === subject.columns &&
    lattice.dimensions.rows === subject.rows &&
    lattice.dimensions.levels === subject.levels &&
    lattice.vertices.length > 0 &&
    lattice.vertices.every(({ positionWorld }) => isFiniteVec3(positionWorld)) &&
    lattice.perLevelBounds.length === subject.levels &&
    lattice.targetLevelByRegion.lower === subject.lowerTargetLevel &&
    lattice.targetLevelByRegion.middle === subject.middleTargetLevel &&
    lattice.targetLevelByRegion.upper === subject.upperTargetLevel &&
    approximatelyEqual(centre.x, subject.originWorld.x) &&
    approximatelyEqual(centre.y, subject.originWorld.y) &&
    approximatelyEqual(centre.z, subject.originWorld.z) &&
    approximatelyEqual(lattice.bounds.max.x - lattice.bounds.min.x, expectedWidth) &&
    approximatelyEqual(lattice.bounds.max.y - lattice.bounds.min.y, expectedHeight) &&
    approximatelyEqual(lattice.bounds.max.z - lattice.bounds.min.z, expectedDepth)
  );
};

const finiteDistanceMetric = (
  first: CameraMovementDiagnosticMetric<Readonly<Vec3>>,
  second: CameraMovementDiagnosticMetric<Readonly<Vec3>>,
  reason: string,
): CameraMovementDiagnosticMetric<number> => {
  if (first.status !== "available" || second.status !== "available") return unavailable(reason);
  const measured = distance(first.value, second.value);
  return Number.isFinite(measured) ? available(measured) : unavailable(reason);
};

const buildIdentity = (
  input: CameraMovementProjectionDiagnosticsInput,
): CameraMovementCalibrationIdentity => ({
  sessionActive: input.calibrationIdentity.sessionActive,
  revision:
    Number.isInteger(input.calibrationIdentity.revision) && input.calibrationIdentity.revision >= 0
      ? available(input.calibrationIdentity.revision)
      : unavailable("Calibration revision must be a finite non-negative integer"),
  geometryId:
    input.calibrationIdentity.geometryId.trim().length > 0
      ? available(input.calibrationIdentity.geometryId)
      : unavailable("Geometry ID must be non-empty"),
  edgeCount: Number.isSafeInteger(input.lattice.edges.length)
    ? available(input.lattice.edges.length)
    : unavailable("Lattice edge count is unavailable"),
  targetRegion: input.targetRegion,
  effectiveKey: input.effectiveCalibration.effectiveKey,
});

const buildWorldGeometry = (
  input: CameraMovementProjectionDiagnosticsInput,
  target: ReturnType<typeof levelCentre>,
  frontFace: ReturnType<typeof nearestCameraFrontFace>,
): CameraMovementWorldGeometryDiagnostics => {
  const latticeBoundsWorld = boundsAreFinite(input.lattice.bounds)
    ? available({
        min: { ...input.lattice.bounds.min },
        max: { ...input.lattice.bounds.max },
      })
    : unavailable<Readonly<Bounds3>>("Lattice bounds are not finite and non-degenerate");
  const targetCentreWorld = target
    ? available<Readonly<Vec3>>({ ...target.worldPoint })
    : unavailable<Readonly<Vec3>>("Target region has no finite lattice level centre");
  const lensCentreWorld = finitePointMetric(
    input.opticsState.lensCenterWorld,
    "Lens centre is not finite",
  );
  const filmCentreWorld = finitePointMetric(
    input.opticsState.filmCenterWorld,
    "Film centre is not finite",
  );
  const rigOriginWorld = finitePointMetric(
    input.opticsState.cameraRigPlacement.rigOriginWorld,
    "Rig origin is not finite",
  );
  const rigArcCentreWorld =
    input.opticsState.cameraRigPlacement.kind === "arc-anchor"
      ? finitePointMetric(
          input.opticsState.cameraRigPlacement.arcCenterWorld,
          "Rig arc centre is not finite",
        )
      : unavailable<Readonly<Vec3>>("Resolved rig placement has no viewpoint arc centre");

  return {
    latticeBoundsWorld,
    targetCentreWorld,
    nearestCameraFrontFaceWorld: frontFace
      ? available({
          zWorld: frontFace.zWorld,
          corners: frontFace.corners,
        })
      : unavailable("Nearest-camera lattice face cannot be resolved"),
    rigOriginWorld,
    rigArcCentreWorld,
    lensCentreWorld,
    filmCentreWorld,
    bodyPitchPivotWorld: finitePointMetric(
      input.opticsState.cameraBodyPivotWorld,
      "Body-pitch pivot is not finite",
    ),
    lensNormalWorld: finiteNormalMetric(
      input.opticsState.lensNormalWorld,
      "Lens normal is not finite and non-degenerate",
    ),
    filmNormalWorld: finiteNormalMetric(
      input.opticsState.filmNormalWorld,
      "Film normal is not finite and non-degenerate",
    ),
    lensFilmDistanceMm: finiteDistanceMetric(
      lensCentreWorld,
      filmCentreWorld,
      "Lens-film distance requires finite lens and film centres",
    ),
    lensTargetDistanceMm: finiteDistanceMetric(
      lensCentreWorld,
      targetCentreWorld,
      "Lens-target distance requires finite lens and target centres",
    ),
  };
};

const unavailableProjectionAggregates = (reason: string) => ({
  projectedBoundsUv: unavailable<{
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
  }>(reason),
  marginsUv: {
    left: unavailable<number>(reason),
    right: unavailable<number>(reason),
    top: unavailable<number>(reason),
    bottom: unavailable<number>(reason),
  },
  coverage: {
    horizontal: unavailable<number>(reason),
    vertical: unavailable<number>(reason),
    projectedBoundsInsideFrame: unavailable<number>(reason),
    filmFrameCovered: unavailable<number>(reason),
    visibleVertexFraction: unavailable<number>(reason),
  },
});

const slopeMetric = (
  top: CameraMovementDiagnosticMetric<ProjectedPoint>,
  bottom: CameraMovementDiagnosticMetric<ProjectedPoint>,
  edgeName: string,
): CameraMovementDiagnosticMetric<number> => {
  if (top.status !== "available" || bottom.status !== "available") {
    return unavailable(`${edgeName} slope requires both projected front-face corners`);
  }
  const deltaV = bottom.value.uv.v - top.value.uv.v;
  if (Math.abs(deltaV) <= CAMERA_MOVEMENT_CONVERGENCE_EPSILON) {
    return unavailable(`${edgeName} slope is undefined because vertical UV span is too small`);
  }
  const slope = (bottom.value.uv.u - top.value.uv.u) / deltaV;
  return Number.isFinite(slope) ? available(slope) : unavailable(`${edgeName} slope is not finite`);
};

const widthMetric = (
  left: CameraMovementDiagnosticMetric<ProjectedPoint>,
  right: CameraMovementDiagnosticMetric<ProjectedPoint>,
  edgeName: string,
): CameraMovementDiagnosticMetric<number> => {
  if (left.status !== "available" || right.status !== "available") {
    return unavailable(`${edgeName} width requires both projected front-face corners`);
  }
  const width = Math.abs(right.value.uv.u - left.value.uv.u);
  return Number.isFinite(width) ? available(width) : unavailable(`${edgeName} width is not finite`);
};

const buildConvergence = (
  frontFace: ReturnType<typeof nearestCameraFrontFace>,
  opticsState: DerivedOpticsState,
): CameraMovementProjectionDiagnostics["convergence"] => {
  const missingFaceReason = "Nearest-camera front face is unavailable";
  const cornerUv = frontFace
    ? {
        topLeft: projectPoint(frontFace.corners.topLeft, opticsState),
        topRight: projectPoint(frontFace.corners.topRight, opticsState),
        bottomLeft: projectPoint(frontFace.corners.bottomLeft, opticsState),
        bottomRight: projectPoint(frontFace.corners.bottomRight, opticsState),
      }
    : {
        topLeft: unavailable<ProjectedPoint>(missingFaceReason),
        topRight: unavailable<ProjectedPoint>(missingFaceReason),
        bottomLeft: unavailable<ProjectedPoint>(missingFaceReason),
        bottomRight: unavailable<ProjectedPoint>(missingFaceReason),
      };
  const topWidthUv = widthMetric(cornerUv.topLeft, cornerUv.topRight, "Top");
  const bottomWidthUv = widthMetric(cornerUv.bottomLeft, cornerUv.bottomRight, "Bottom");
  let normalizedSignal: CameraMovementDiagnosticMetric<number>;
  let direction: CameraMovementDiagnosticMetric<"top" | "parallel" | "bottom">;
  if (topWidthUv.status !== "available" || bottomWidthUv.status !== "available") {
    normalizedSignal = unavailable("Normalized convergence requires top and bottom widths");
    direction = unavailable("Convergence direction requires a normalized signal");
  } else {
    const denominator = Math.max(
      topWidthUv.value,
      bottomWidthUv.value,
      CAMERA_MOVEMENT_CONVERGENCE_EPSILON,
    );
    const signal = (topWidthUv.value - bottomWidthUv.value) / denominator;
    if (!Number.isFinite(signal)) {
      normalizedSignal = unavailable("Normalized convergence signal is not finite");
      direction = unavailable("Convergence direction requires a finite normalized signal");
    } else {
      normalizedSignal = available(signal);
      direction = available(
        Math.abs(signal) <= CAMERA_MOVEMENT_CONVERGENCE_EPSILON
          ? "parallel"
          : signal < 0
            ? "top"
            : "bottom",
      );
    }
  }
  return {
    construction: "nearest-camera-front-face-outer-corners",
    cornerUv,
    topWidthUv,
    bottomWidthUv,
    leftVerticalSlope: slopeMetric(cornerUv.topLeft, cornerUv.bottomLeft, "Left vertical"),
    rightVerticalSlope: slopeMetric(cornerUv.topRight, cornerUv.bottomRight, "Right vertical"),
    normalizedSignal,
    direction,
    epsilon: CAMERA_MOVEMENT_CONVERGENCE_EPSILON,
  };
};

const baseResult = (
  input: CameraMovementProjectionDiagnosticsInput,
  identity: CameraMovementCalibrationIdentity,
  worldGeometry: CameraMovementWorldGeometryDiagnostics,
  target: ReturnType<typeof levelCentre>,
  frontFace: ReturnType<typeof nearestCameraFrontFace>,
  status: CameraMovementProjectionStatus,
  projectionReason: string,
): CameraMovementProjectionDiagnostics => ({
  identity,
  currentAnchor: input.currentAnchor,
  uvConvention: {
    origin: "film-top-left",
    positiveU: "toward-film-right",
    positiveV: "toward-film-bottom",
    unclamped: true,
  },
  status,
  worldGeometry,
  selectedTarget: {
    region: input.targetRegion,
    levelIndex: target
      ? available(target.levelIndex)
      : unavailable("Target region has no valid level index"),
    centreWorld: worldGeometry.targetCentreWorld,
    uv: unavailable(projectionReason),
  },
  projectedVertices: input.lattice.vertices.map(({ id }) => ({
    vertexId: id,
    projection: unavailable(projectionReason),
  })),
  ...unavailableProjectionAggregates(projectionReason),
  convergence: buildConvergence(frontFace, input.opticsState),
});

/**
 * Diagnose canonical lattice framing with Ground Glass' film-plane projector.
 *
 * UV is raw and unclamped with (0,0) at film top-left, +U toward film right,
 * and +V toward film bottom. Unavailable metrics carry null plus an explicit
 * reason; every available numeric value is finite.
 */
export const calculateCameraMovementProjectionDiagnostics = (
  input: CameraMovementProjectionDiagnosticsInput,
): CameraMovementProjectionDiagnostics => {
  const identity = buildIdentity(input);
  const target = levelCentre(input.lattice, input.targetRegion);
  const frontFace = nearestCameraFrontFace(input.lattice.bounds, input.opticsState.lensCenterWorld);
  const worldGeometry = buildWorldGeometry(input, target, frontFace);

  if (identity.revision.status !== "available" || identity.geometryId.status !== "available") {
    const reason = "Calibration identity is invalid";
    return baseResult(
      input,
      identity,
      worldGeometry,
      target,
      frontFace,
      {
        level: "error",
        code: "invalid-identity",
        messages: [reason],
      },
      reason,
    );
  }
  const validation = validateEffectiveCameraMovementCalibration(input.effectiveCalibration);
  if (!validation.valid) {
    const reason = "Effective calibration is invalid";
    return baseResult(
      input,
      identity,
      worldGeometry,
      target,
      frontFace,
      {
        level: "error",
        code: "invalid-calibration",
        messages: validation.errors.map(({ path, message }) => `${path}: ${message}`),
      },
      reason,
    );
  }
  if (!latticeMatchesCalibration(input.lattice, input.effectiveCalibration)) {
    const reason = "Generated lattice does not match effective canonical geometry";
    return baseResult(
      input,
      identity,
      worldGeometry,
      target,
      frontFace,
      { level: "error", code: "invalid-lattice", messages: [reason] },
      reason,
    );
  }
  if (
    input.opticsState.cameraRigPlacement.kind !== "arc-anchor" ||
    input.opticsState.cameraRigPlacement.anchor !== input.currentAnchor
  ) {
    const reason = "Current anchor does not match the resolved optics rig placement";
    return baseResult(
      input,
      identity,
      worldGeometry,
      target,
      frontFace,
      { level: "error", code: "anchor-mismatch", messages: [reason] },
      reason,
    );
  }
  if (input.opticsState.diagnostics.fallbackApplied) {
    const reason =
      input.opticsState.diagnostics.fallbackReason ??
      input.opticsState.diagnostics.errorMessage ??
      "Optics state used fallback geometry";
    return baseResult(
      input,
      identity,
      worldGeometry,
      target,
      frontFace,
      { level: "error", code: "optics-fallback", messages: [reason] },
      reason,
    );
  }
  if (!target) {
    const reason = "Selected target region does not resolve to a finite lattice level centre";
    return baseResult(
      input,
      identity,
      worldGeometry,
      target,
      frontFace,
      { level: "error", code: "invalid-lattice", messages: [reason] },
      reason,
    );
  }

  const projectedVertices: CameraMovementVertexProjection[] = input.lattice.vertices.map(
    (vertex) => ({
      vertexId: vertex.id,
      projection: projectPoint(vertex.positionWorld, input.opticsState),
    }),
  );
  const availableVertices = projectedVertices.filter(
    (
      vertex,
    ): vertex is CameraMovementVertexProjection & {
      projection: Extract<CameraMovementDiagnosticMetric<ProjectedPoint>, { status: "available" }>;
    } => vertex.projection.status === "available",
  );
  const selectedTargetUv = projectPoint(target.worldPoint, input.opticsState);
  if (
    availableVertices.length !== projectedVertices.length ||
    selectedTargetUv.status !== "available"
  ) {
    const reason =
      availableVertices.length !== projectedVertices.length
        ? "At least one lattice vertex has no finite forward film-plane projection"
        : "Selected target has no finite forward film-plane projection";
    return {
      ...baseResult(
        input,
        identity,
        worldGeometry,
        target,
        frontFace,
        { level: "error", code: "projection-unavailable", messages: [reason] },
        reason,
      ),
      projectedVertices,
      selectedTarget: {
        region: input.targetRegion,
        levelIndex: available(target.levelIndex),
        centreWorld: worldGeometry.targetCentreWorld,
        uv: selectedTargetUv,
      },
    };
  }

  const uValues = availableVertices.map(({ projection }) => projection.value.uv.u);
  const vValues = availableVertices.map(({ projection }) => projection.value.uv.v);
  const minU = Math.min(...uValues);
  const maxU = Math.max(...uValues);
  const minV = Math.min(...vValues);
  const maxV = Math.max(...vValues);
  const projectedWidth = maxU - minU;
  const projectedHeight = maxV - minV;
  const overlapWidth = Math.max(0, Math.min(1, maxU) - Math.max(0, minU));
  const overlapHeight = Math.max(0, Math.min(1, maxV) - Math.max(0, minV));
  const overlapArea = overlapWidth * overlapHeight;
  const projectedArea = projectedWidth * projectedHeight;
  const visibleCount = availableVertices.filter(
    ({ projection }) => projection.value.inFrame,
  ).length;
  const coverageReason = "Projected bounds are degenerate";
  const horizontal =
    projectedWidth > CAMERA_MOVEMENT_CONVERGENCE_EPSILON
      ? available(boundedFraction(overlapWidth / projectedWidth))
      : unavailable<number>(coverageReason);
  const vertical =
    projectedHeight > CAMERA_MOVEMENT_CONVERGENCE_EPSILON
      ? available(boundedFraction(overlapHeight / projectedHeight))
      : unavailable<number>(coverageReason);
  const projectedBoundsInsideFrame =
    projectedArea > CAMERA_MOVEMENT_CONVERGENCE_EPSILON
      ? available(boundedFraction(overlapArea / projectedArea))
      : unavailable<number>(coverageReason);
  const projectedBoundsInsideFilm = minU >= 0 && maxU <= 1 && minV >= 0 && maxV <= 1;
  const status: CameraMovementProjectionStatus =
    projectedBoundsInsideFilm
      ? { level: "ok", code: "all-in-frame", messages: [] }
      : overlapWidth === 0 || overlapHeight === 0
        ? {
            level: "warning",
            code: "fully-off-frame",
            messages: ["The lattice projects outside the film frame"],
          }
        : {
            level: "warning",
            code: "partially-off-frame",
            messages: ["Part of the lattice projects outside the film frame"],
          };

  return {
    identity,
    currentAnchor: input.currentAnchor,
    uvConvention: {
      origin: "film-top-left",
      positiveU: "toward-film-right",
      positiveV: "toward-film-bottom",
      unclamped: true,
    },
    status,
    worldGeometry,
    selectedTarget: {
      region: input.targetRegion,
      levelIndex: available(target.levelIndex),
      centreWorld: worldGeometry.targetCentreWorld,
      uv: selectedTargetUv,
    },
    projectedVertices,
    projectedBoundsUv: available({ minU, maxU, minV, maxV }),
    marginsUv: {
      left: available(minU),
      right: available(1 - maxU),
      top: available(minV),
      bottom: available(1 - maxV),
    },
    coverage: {
      horizontal,
      vertical,
      projectedBoundsInsideFrame,
      filmFrameCovered: available(boundedFraction(overlapArea)),
      visibleVertexFraction: available(boundedFraction(visibleCount / projectedVertices.length)),
    },
    convergence: buildConvergence(frontFace, input.opticsState),
  };
};
