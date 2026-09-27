import type { DerivedOpticsState, Plane, Vec3 } from "../types/optics";
import { calculateImageDistanceAlongOpticalAxisMm } from "../core/optics/calculateImageDistance";
import { deriveOrthonormalPlaneBasis } from "../core/optics/computePhysicalBlurFootprint";

export type GroundGlassDofRenderState = Readonly<{
  model: "parallel-thin-lens" | "derived-planes";
  /** Camera projection snapshot used to reconstruct scene points. */
  camera: Readonly<{
    inverseProjectionMatrixElements: readonly number[];
    worldMatrixElements: readonly number[];
  }>;
  lens: Readonly<{
    centerWorldM: Vec3;
    planeNormal: Vec3;
    planeBasisX: Vec3;
    planeBasisY: Vec3;
  }>;
  film: Readonly<{
    planePointWorldM: Vec3;
    planeNormal: Vec3;
    planeBasisX: Vec3;
    planeBasisY: Vec3;
    widthMm: number;
    heightMm: number;
    sampledWidthMm: number;
    sampledHeightMm: number;
  }>;
  focus: Readonly<{
    plane: Readonly<{ pointWorldM: Vec3; normal: Vec3 }> | null;
    nearPlane: Readonly<{ pointWorldM: Vec3; normal: Vec3 }> | null;
    farPlane: Readonly<{ pointWorldM: Vec3; normal: Vec3 }> | null;
  }>;
  optics: Readonly<{
    imageDistanceMm: number;
    focalLengthMm: number;
    apertureFNumber: number;
    acceptableCoCDiameterMm: number;
  }>;
  render: Readonly<{
    widthPx: number;
    heightPx: number;
    maximumBlurRadiusPx: number;
    /** Visible CSS viewport width, used for the presentation boundary only. */
    displayWidthPx: number;
  }>;
  physicalCoC: Readonly<{
    boundaryDiameterPx: number;
    boundaryRadiusPx: number;
    visibleBoundaryRadiusPx: number;
  }>;
}>;

/** A Three.js camera's relevant values, expressed without importing Three.js. */
export type GroundGlassCameraProjectionSource = Readonly<{
  projectionMatrixInverse: Readonly<{ elements: ArrayLike<number> }>;
  matrixWorld: Readonly<{ elements: ArrayLike<number> }>;
}>;

const toMeters = (value: Vec3): Vec3 => ({
  x: value.x * 0.001,
  y: value.y * 0.001,
  z: value.z * 0.001,
});

const toPlaneState = (plane: Plane | null | undefined) => plane
  ? { pointWorldM: toMeters(plane.point), normal: { ...plane.normal } }
  : null;

/**
 * Derive the renderer-independent Ground Glass DOF snapshot from canonical
 * optics and the configured view camera. World-space points are expressed in
 * metres to match the application's Three.js render-world convention; optical
 * lengths and film dimensions remain explicitly in millimetres.
 */
export function createGroundGlassDofRenderState(
  opticsState: DerivedOpticsState,
  camera: GroundGlassCameraProjectionSource,
  focalLengthMm: number,
  filmWidthMm: number,
  filmHeightMm: number,
  circleOfConfusionMm: number,
  aperture: number,
  widthPx: number,
  heightPx: number,
  maximumBlurRadiusPx: number,
  sampledFilmWidthMm = filmWidthMm,
  sampledFilmHeightMm = filmHeightMm,
  /** Visible CSS viewport width; internal render width is used for shader pixels. */
  displayWidthPx = widthPx,
): GroundGlassDofRenderState {
  const dofModel =
    opticsState.diagnostics.groundGlassDofModel ??
    (opticsState.diagnostics.depthOfFieldModel === "scheimpflug-wedge"
      ? "derived-planes"
      : "parallel-thin-lens");

  if (!Number.isFinite(focalLengthMm) || focalLengthMm <= 0) throw new Error("Invalid focalLengthMm");
  if (!Number.isFinite(filmWidthMm) || filmWidthMm <= 0) throw new Error("Invalid filmWidthMm");
  if (!Number.isFinite(filmHeightMm) || filmHeightMm <= 0) throw new Error("Invalid filmHeightMm");
  if (!Number.isFinite(sampledFilmWidthMm) || sampledFilmWidthMm <= 0) {
    throw new Error("Invalid sampledFilmWidthMm");
  }
  if (!Number.isFinite(sampledFilmHeightMm) || sampledFilmHeightMm <= 0) {
    throw new Error("Invalid sampledFilmHeightMm");
  }
  if (!Number.isFinite(circleOfConfusionMm) || circleOfConfusionMm <= 0) throw new Error("Invalid circleOfConfusionMm");
  if (!Number.isFinite(widthPx) || widthPx <= 0) throw new Error("Invalid render width");
  if (!Number.isFinite(heightPx) || heightPx <= 0) throw new Error("Invalid render height");
  if (!Number.isFinite(aperture) || aperture <= 0) throw new Error("Invalid aperture");
  if (!Number.isFinite(maximumBlurRadiusPx) || maximumBlurRadiusPx < 0) {
    throw new Error("Invalid maximumBlurRadiusPx");
  }
  if (!Number.isFinite(displayWidthPx) || displayWidthPx <= 0) {
    throw new Error("Invalid display width");
  }

  const lensBasis = deriveOrthonormalPlaneBasis(
    opticsState.lensPlane.normal,
    opticsState.rearStandardFrame.rightWorld,
    opticsState.rearStandardFrame.upWorld,
  );
  const filmBasis = deriveOrthonormalPlaneBasis(
    opticsState.filmPlane.normal,
    opticsState.rearStandardFrame.rightWorld,
    opticsState.rearStandardFrame.upWorld,
  );
  const focusPlane = opticsState.focusPlane ?? null;
  const nearPlane = opticsState.depthOfFieldNearPlane ?? null;
  const farPlane = opticsState.depthOfFieldFarPlane ?? null;

  const inverseProjectionMatrixElements = Array.from(camera.projectionMatrixInverse.elements);
  const worldMatrixElements = Array.from(camera.matrixWorld.elements);
  if (
    inverseProjectionMatrixElements.length !== 16 ||
    !inverseProjectionMatrixElements.every(Number.isFinite)
  ) {
    throw new Error("Ground Glass inverse projection matrix must contain exactly 16 finite elements");
  }
  if (worldMatrixElements.length !== 16 || !worldMatrixElements.every(Number.isFinite)) {
    throw new Error("Ground Glass world matrix must contain exactly 16 finite elements");
  }

  const finiteVec = (value: Vec3 | null | undefined) =>
    Boolean(value && [value.x, value.y, value.z].every(Number.isFinite));
  if (!finiteVec(opticsState.lensCenterWorld)) throw new Error("Lens centre contains non-finite values");
  if (!lensBasis || !filmBasis) {
    throw new Error("Lens/film plane bases contain degenerate geometry");
  }
  if (dofModel === "derived-planes" && (!focusPlane || !nearPlane)) {
    throw new Error("Derived-plane DOF requires finite focus and near planes");
  }
  for (const [name, plane] of [
    ["focus", focusPlane],
    ["near", nearPlane],
    ["far", farPlane],
  ] as const) {
    if (
      plane &&
      (!finiteVec(plane.point) ||
        !finiteVec(plane.normal) ||
        !Number.isFinite(plane.distance))
    ) {
      throw new Error(`${name} DOF plane contains non-finite values`);
    }
  }

  const boundaryDiameterPx = (circleOfConfusionMm * widthPx) / sampledFilmWidthMm;
  const boundaryRadiusPx = boundaryDiameterPx / 2;
  const visibleBoundaryRadiusPx =
    (circleOfConfusionMm * displayWidthPx) / sampledFilmWidthMm / 2;
  if (
    !Number.isFinite(boundaryDiameterPx) ||
    !Number.isFinite(boundaryRadiusPx) ||
    !Number.isFinite(visibleBoundaryRadiusPx)
  ) {
    throw new Error("Physical Ground Glass blur scale is non-finite");
  }

  const imageDistanceMm = calculateImageDistanceAlongOpticalAxisMm({
    lensCenterWorld: opticsState.lensCenterWorld,
    filmPlanePointWorld: opticsState.filmPlane.point,
    opticalAxisDirection: opticsState.opticalAxis.direction,
  });
  if (
    imageDistanceMm === null ||
    !Number.isFinite(imageDistanceMm) ||
    imageDistanceMm <= 0
  ) {
    throw new Error("Unable to calculate image distance along the optical axis");
  }

  return {
    model: dofModel,
    camera: {
      inverseProjectionMatrixElements,
      worldMatrixElements,
    },
    lens: {
      centerWorldM: toMeters(opticsState.lensCenterWorld),
      planeNormal: { ...lensBasis.normal },
      planeBasisX: { ...lensBasis.x },
      planeBasisY: { ...lensBasis.y },
    },
    film: {
      planePointWorldM: toMeters(opticsState.filmPlane.point),
      planeNormal: { ...filmBasis.normal },
      planeBasisX: { ...filmBasis.x },
      planeBasisY: { ...filmBasis.y },
      widthMm: filmWidthMm,
      heightMm: filmHeightMm,
      sampledWidthMm: sampledFilmWidthMm,
      sampledHeightMm: sampledFilmHeightMm,
    },
    focus: {
      plane: toPlaneState(focusPlane),
      nearPlane: toPlaneState(nearPlane),
      farPlane: toPlaneState(farPlane),
    },
    optics: {
      imageDistanceMm,
      focalLengthMm,
      apertureFNumber: aperture,
      acceptableCoCDiameterMm: circleOfConfusionMm,
    },
    render: {
      widthPx,
      heightPx,
      maximumBlurRadiusPx,
      displayWidthPx,
    },
    physicalCoC: {
      boundaryDiameterPx,
      boundaryRadiusPx,
      visibleBoundaryRadiusPx,
    },
  };
}
