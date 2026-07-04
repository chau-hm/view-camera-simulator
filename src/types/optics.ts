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
  acceptableRangeMm: number;
  sharpness: number;
  status: "sharp" | "acceptable" | "soft";
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
  lensFilmHingeLine: Line3 | null;
  focusPointWorld: Vec3;
  focusPlane: Plane;
  depthOfFieldNearPlane: Plane;
  depthOfFieldFarPlane: Plane;
  offAxisProjectionInput: OffAxisProjectionInput;
  offAxisProjectionMatrix: number[];
  groundGlassProjection: ProjectionData;
  focusTargets: FocusTargetSharpness[];
  diagnostics: {
    isParallelLensFilm: boolean;
    tiltAngleDeg: number;
    swingAngleDeg: number;
    focusPlaneModel: "parallel" | "scheimpflug";
    fallbackApplied: boolean;
    errorMessage?: string;
    isInfinityFocus?: boolean;
  };
};
