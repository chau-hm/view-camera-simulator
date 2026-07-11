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
};

export function createGroundGlassDofUniformState(
  opticsState: DerivedOpticsState,
  camera: THREE.PerspectiveCamera,
  aperture: number,
  width: number,
  height: number,
  maxCoC: number,
): GroundGlassDofUniformState {
  const dofModel = opticsState.diagnostics.depthOfFieldModel ?? "parallel";
  const mode = dofModel === "scheimpflug-wedge" ? 1 : 0;

  const lens = opticsState.lensCenterWorld;
  const focusPlane = opticsState.focusPlane;
  const nearPlane = opticsState.depthOfFieldNearPlane ?? null;
  const farPlane = opticsState.depthOfFieldFarPlane ?? null;

  const toMeters = (v: { x: number; y: number; z: number } | null) =>
    v ? ([v.x * 0.001, v.y * 0.001, v.z * 0.001] as [number, number, number]) : null;

  // flatten matrices to column-major arrays for GLSL uniform mat4
  const invProj = camera.projectionMatrixInverse.elements.slice();
  const camWorld = camera.matrixWorld.elements.slice();

  return {
    mode: mode as 0 | 1,
    lensCenterWorld: toMeters(lens as any) ?? [0,0,0],
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
    focalLengthMm: camera.getFocalLength ? camera.getFocalLength() : 50,
    fNumber: aperture,
    sensorWidthMm: 36, // fallback; shader also receives literal CAMERA_CONSTANTS where used
    renderWidth: width,
    renderHeight: height,
    maximumBlurRadiusPx: maxCoC,
  };
}
