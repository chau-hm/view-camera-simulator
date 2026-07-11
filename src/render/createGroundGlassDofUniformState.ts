import type { DerivedOpticsState } from "../types/optics";
import * as THREE from "three";

export type GroundGlassDofUniformState = {
  mode: 0 | 1;
  lensCenterWorld: [number, number, number];
  focusPlanePoint: [number, number, number];
  focusPlaneNormal: [number, number, number];
  nearPlanePoint: [number, number, number] | null;
  nearPlaneNormal: [number, number, number] | null;
  farPlanePoint: [number, number, number] | null;
  farPlaneNormal: [number, number, number] | null;
  hasFiniteFarPlane: boolean;
  inverseProjectionMatrix: number[];
  cameraMatrixWorld: number[];
  imageDistanceMm: number;
  focalLengthMm: number;
  fNumber: number;
  sensorWidthMm: number;
  renderWidth: number;
  renderHeight: number;
  maximumBlurRadiusPx: number;
  // Physical CoC / calibration values
  circleOfConfusionMm: number;
  boundaryCoCDiameterPx: number;
  boundaryBlurRadiusPx: number;
  filmWidthMm: number;
  filmHeightMm: number;
  displayBlurScale: number;
};

export function createGroundGlassDofUniformState(
  opticsState: DerivedOpticsState,
  camera: THREE.PerspectiveCamera,
  focalLengthMm: number,
  filmWidthMm: number,
  filmHeightMm: number,
  circleOfConfusionMm: number,
  aperture: number,
  width: number,
  height: number,
  maximumBlurRadiusPx: number,
  displayBlurScale = 1,
): GroundGlassDofUniformState {
  const dofModel = opticsState.diagnostics.depthOfFieldModel ?? "parallel";
  const mode = dofModel === "scheimpflug-wedge" ? 1 : 0;

  // Validate physical constants
  if (!Number.isFinite(focalLengthMm) || focalLengthMm <= 0) throw new Error("Invalid focalLengthMm");
  if (!Number.isFinite(filmWidthMm) || filmWidthMm <= 0) throw new Error("Invalid filmWidthMm");
  if (!Number.isFinite(filmHeightMm) || filmHeightMm <= 0) throw new Error("Invalid filmHeightMm");
  if (!Number.isFinite(circleOfConfusionMm) || circleOfConfusionMm <= 0) throw new Error("Invalid circleOfConfusionMm");
  if (!Number.isFinite(width) || width <= 0) throw new Error("Invalid render width");
  if (!Number.isFinite(height) || height <= 0) throw new Error("Invalid render height");

  const lens = opticsState.lensCenterWorld;
  const focusPlane = opticsState.focusPlane;
  const nearPlane = opticsState.depthOfFieldNearPlane ?? null;
  const farPlane = opticsState.depthOfFieldFarPlane ?? null;

  const toMeters = (v: { x: number; y: number; z: number } | null) =>
    v ? ([v.x * 0.001, v.y * 0.001, v.z * 0.001] as [number, number, number]) : null;

  // flatten matrices to column-major arrays for GLSL uniform mat4
  const invProj = camera.projectionMatrixInverse.elements.slice();
  const camWorld = camera.matrixWorld.elements.slice();

  const boundaryCoCDiameterPx = (circleOfConfusionMm * width) / filmWidthMm;
  const boundaryBlurRadiusPx = boundaryCoCDiameterPx / 2;

  return {
    mode: mode as 0 | 1,
    lensCenterWorld: toMeters(lens) ?? [0, 0, 0],
    focusPlanePoint: focusPlane ? toMeters(focusPlane.point) as [number, number, number] : [0, 0, 0],
    focusPlaneNormal: focusPlane ? [focusPlane.normal.x, focusPlane.normal.y, focusPlane.normal.z] : [0, 0, 1],
    nearPlanePoint: nearPlane ? toMeters(nearPlane.point) : null,
    nearPlaneNormal: nearPlane ? [nearPlane.normal.x, nearPlane.normal.y, nearPlane.normal.z] : null,
    farPlanePoint: farPlane ? toMeters(farPlane.point) : null,
    farPlaneNormal: farPlane ? [farPlane.normal.x, farPlane.normal.y, farPlane.normal.z] : null,
    hasFiniteFarPlane: !!farPlane,
    inverseProjectionMatrix: invProj,
    cameraMatrixWorld: camWorld,
    imageDistanceMm: Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z),
    focalLengthMm: focalLengthMm,
    fNumber: aperture,
    sensorWidthMm: filmWidthMm,
    renderWidth: width,
    renderHeight: height,
    maximumBlurRadiusPx,
    circleOfConfusionMm,
    boundaryCoCDiameterPx,
    boundaryBlurRadiusPx,
    filmWidthMm,
    filmHeightMm,
    displayBlurScale,
  };
}
