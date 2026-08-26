export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type CameraRigViewpointAnchor = "mid" | "high" | "low";
export type CameraRigViewpointArcPlane = "yz";
export type CameraRigViewpointRelativeHeight = "at-mid" | "above-mid" | "below-mid";

export type CameraRigViewpointAnchorMetadata = Readonly<{
  identity: CameraRigViewpointAnchor;
  relativeHeight: CameraRigViewpointRelativeHeight;
}>;

/** Identity placement used by scenes without a calibrated viewpoint arc. */
export type IdentityCameraRigPlacement = Readonly<{
  kind: "identity";
  rigOriginWorld: Vec3;
  basePitchDeg: 0;
}>;

/** Resolved calibrated arc anchor. Body pitch and its pivot remain separate. */
export type ArcAnchorCameraRigPlacement = Readonly<{
  kind: "arc-anchor";
  anchor: CameraRigViewpointAnchor;
  metadata: CameraRigViewpointAnchorMetadata;
  arcPlane: CameraRigViewpointArcPlane;
  arcCenterWorld: Vec3;
  rigOriginWorld: Vec3;
  basePitchDeg: number;
  arcAngleDeg: number;
  radiusMm: number;
  /** Optional continuous lesson parameter; omitted for discrete endpoints. */
  viewpointT?: number;
}>;

export type CameraRigPlacement =
  | IdentityCameraRigPlacement
  | ArcAnchorCameraRigPlacement;

export type Ray = {
  origin: Vec3;
  direction: Vec3;
};

export type Plane = {
  point: Vec3;
  normal: Vec3;
  distance: number;
};

export type Line3 = {
  point: Vec3;
  direction: Vec3;
};

export type FocusTargetStatus = "sharp" | "acceptable" | "soft";

export type Transform = {
  translation: Vec3;
  rotationDeg: Vec3;
};

export type Bounds3 = {
  min: Vec3;
  max: Vec3;
};

export type FocusTargetSharpness = {
  id: string;
  distanceToFocusPlaneMm: number;
  // legacy field kept for compatibility; may be undefined for wedge model
  acceptableRangeMm?: number | undefined;
  sharpness: number;
  status: FocusTargetStatus;
  /** Centre-sample focus used for point-focusing feedback in Free Mode. */
  pointSharpness?: number;
  pointStatus?: FocusTargetStatus;
  /** Conservative worst-sample score used for whole-patch task coverage. */
  patchSharpness?: number;
  patchStatus?: FocusTargetStatus;
  /** Physical film-space presentation metric paired with the point sample. */
  physicalPointSharpness?: number;
  physicalPointStatus?: FocusTargetStatus;
  /** Physical film-space presentation metric using the worst patch sample. */
  physicalPatchSharpness?: number;
  physicalPatchStatus?: FocusTargetStatus;
  /** Absolute equivalent CoC diameter used by the physical point metric. */
  pointEquivalentCoCDiameterMm?: number | null;
  /** Absolute equivalent CoC diameter used by the physical patch metric. */
  patchEquivalentCoCDiameterMm?: number | null;
  /** Centre-sample defocus paired with pointSharpness. */
  pointNormalizedDefocus?: number;
  /** Worst-sample defocus paired with patchSharpness. */
  patchNormalizedDefocus?: number;
  // extended diagnostics
  insideDepthOfField?: boolean;
  targetRayDistanceMm?: number;
  nearBoundaryDistanceMm?: number | null;
  focusBoundaryDistanceMm?: number | null;
  farBoundaryDistanceMm?: number | null;
  normalizedDefocus?: number;
};

export type ProjectionData = {
  invertHorizontal: boolean;
  invertVertical: boolean;
  assistModeEnabled: boolean;
};

export type FilmPlaneCorners = {
  topLeft: Vec3;
  topRight: Vec3;
  bottomLeft: Vec3;
  bottomRight: Vec3;
};

export type OffAxisProjectionInput = {
  lensCenterWorld: Vec3;
  filmCornersWorld: FilmPlaneCorners;
};

export type LensFilmRelationship = {
  isParallel: boolean;
  commonLine: Line3 | null;
};
export type DerivedOpticsState = {
  /** Validated resolved outer placement consumed by every downstream view. */
  cameraRigPlacement: CameraRigPlacement;
  /** Canonical local-body-pitch then outer-rig placement transform. */
  cameraRigTransform: CameraRigTransform;
  /**
   * @deprecated Compatibility adapter for renderer/state consumers that only
   * understand the original zero-origin, zero-base-pitch body transform.
   */
  cameraBodyTransform: CameraBodyTransform;
  cameraBodyLocalGeometry: CameraBodyLocalGeometry;
  /** Body-pitch pivot resolved into world coordinates. */
  cameraBodyPivotWorld: Vec3;
  lensCenterWorld: Vec3;
  lensNormalWorld: Vec3;
  lensPlane: Plane;
  filmCenterWorld: Vec3;
  filmNormalWorld: Vec3;
  filmPlane: Plane;
  filmPlaneCornersWorld: FilmPlaneCorners;
  rearStandardFrame: StandardFrame;
  opticalAxis: Ray;
  /** Legacy compatibility name: this is the film/lens Scheimpflug common line, not the Hinge Rule line. */
  lensFilmHingeLine: Line3 | null;
  focusPointWorld: Vec3;
  // In infinity focus mode the physical focusPlane may be absent (null)
  focusPlane: Plane | null;
  // depth-of-field planes may be absent in infinity mode
  depthOfFieldNearPlane?: Plane | null;
  depthOfFieldFarPlane?: Plane | null;
  offAxisProjectionInput: OffAxisProjectionInput;
  offAxisProjectionMatrix: number[];
  groundGlassProjection: ProjectionData;
  focusTargets: FocusTargetSharpness[];
  // optional scene visual cap depth (non-physical, for debug rendering)
  sceneVisualCapDepthMm?: number;
  diagnostics: {
    isParallelLensFilm: boolean;
    tiltAngleDeg: number;
    swingAngleDeg: number;
    focusPlaneModel: "parallel" | "scheimpflug";
    // which DOF model is currently used
    depthOfFieldModel?: "parallel" | "scheimpflug-wedge";
    /** Ground Glass blur source. Table Tilt deliberately uses its derived planes at every tilt. */
    groundGlassDofModel?: "parallel-thin-lens" | "derived-planes";
    // near/far distances along optical axis from lens centre
    nearU?: number | null;
    farU?: number | null;
    farIsInfinite?: boolean;
    fallbackApplied: boolean;
    fallbackReason?: string | null;
    errorMessage?: string;
    isInfinityFocus?: boolean;
    /** Resolved focus-standard geometry diagnostics for selectable-focus scenes. */
    focusStandard?: "front" | "rear";
    /** Requested focus standard before any safe geometry fallback. */
    requestedFocusStandard?: "front" | "rear";
    /** Actual lens-to-focus-plane distance passed to DOF for finite focus. */
    focusObjectDistanceMm?: number | null;
    /** Actual lens-to-film image distance used by the focus resolver. */
    imageDistanceMm?: number | null;
  };
};

export type StandardFrame = {
  centerWorld: Vec3;
  rightWorld: Vec3;
  upWorld: Vec3;
  normalWorld: Vec3;
  plane: Plane;
};

export type CameraBodyTransform = {
  /** Legacy rig-local +X pitch. Positive sends rig-local +Z toward rig-local -Y. */
  pitchDeg: number;
  /**
   * @deprecated Despite the legacy name, this value is the rig-local pivot.
   * Use CameraRigTransform.bodyPitchPivotRigLocal in canonical calculations.
   */
  pivotWorld: Vec3;
};

/**
 * Canonical camera-rig composition.
 *
 * Local standard geometry is first pitched around bodyPitchPivotRigLocal.
 * The complete result is then rotated by basePitchDeg around the rig-local
 * origin and translated so that the zero-movement lens datum lands at
 * rigOriginWorld.
 */
export type CameraRigTransform = {
  /** World position of the zero-movement rig-local lens datum, in millimetres. */
  rigOriginWorld: Vec3;
  /** Outer rig rotation about rig-local +X, in degrees. */
  basePitchDeg: number;
  /** Body rotation about rig-local +X. Positive sends local +Z toward local -Y. */
  bodyPitchDeg: number;
  /** Fixed tripod/rail pivot expressed in rig-local millimetres. */
  bodyPitchPivotRigLocal: Vec3;
};

/**
 * Standard geometry after local rise/tilt/swing, before the rigid body pitch.
 * These values are expressed in rig-local millimetres.
 */
export type CameraBodyLocalGeometry = {
  lensCenterLocal: Vec3;
  lensNormalLocal: Vec3;
  lensPlaneLocal: Plane;
  filmCenterLocal: Vec3;
  filmNormalLocal: Vec3;
  filmPlaneLocal: Plane;
  filmPlaneCornersLocal: FilmPlaneCorners;
  rearStandardFrameLocal: StandardFrame;
};
