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
  sharpness: number;
  status: "sharp" | "acceptable" | "soft";
};

export type ProjectionData = {
  invertHorizontal: boolean;
  invertVertical: boolean;
  assistModeEnabled: boolean;
};

export type DerivedOpticsState = {
  lensCenterWorld: Vec3;
  lensNormalWorld: Vec3;
  lensPlane: Plane;
  filmCenterWorld: Vec3;
  filmNormalWorld: Vec3;
  filmPlane: Plane;
  opticalAxis: Ray;
  focusPointWorld: Vec3;
  focusPlane: Plane;
  depthOfFieldNearPlane: Plane;
  depthOfFieldFarPlane: Plane;
  groundGlassProjection: ProjectionData;
  focusTargets: FocusTargetSharpness[];
  diagnostics: {
    isParallelLensFilm: boolean;
    tiltAngleDeg: number;
    swingAngleDeg: number;
    fallbackApplied: boolean;
    errorMessage?: string;
  };
};
