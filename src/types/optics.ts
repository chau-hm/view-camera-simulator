export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

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
  status: "sharp" | "acceptable" | "soft";
  /** Centre-sample focus used for point-focusing feedback in Free Mode. */
  pointSharpness?: number;
  pointStatus?: "sharp" | "acceptable" | "soft";
  /** Conservative worst-sample score used for whole-patch task coverage. */
  patchSharpness?: number;
  patchStatus?: "sharp" | "acceptable" | "soft";
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

export type DerivedOpticsState = {
  lensCenterWorld: Vec3;
  lensNormalWorld: Vec3;
  lensPlane: Plane;
  filmCenterWorld: Vec3;
  filmNormalWorld: Vec3;
  filmPlane: Plane;
  filmPlaneCornersWorld: FilmPlaneCorners;
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
  };
};
