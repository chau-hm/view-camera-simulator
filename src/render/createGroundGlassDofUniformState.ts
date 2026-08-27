import type { DerivedOpticsState } from "../types/optics";
import * as THREE from "three";
import { calculateImageDistanceAlongOpticalAxisMm } from "../core/optics/calculateImageDistance";
import { deriveOrthonormalPlaneBasis } from "../core/optics/computePhysicalBlurFootprint";

export type GroundGlassDofUniformState = {
  mode: 0 | 1;
  lensCenterWorld: [number, number, number];
  lensPlaneNormal: [number, number, number];
  lensPlaneBasisX: [number, number, number];
  lensPlaneBasisY: [number, number, number];
  filmPlanePoint: [number, number, number];
  filmPlaneNormal: [number, number, number];
  filmPlaneBasisX: [number, number, number];
  filmPlaneBasisY: [number, number, number];
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
  renderWidth: number;
  renderHeight: number;
  maximumBlurRadiusPx: number;
  // Physical CoC / calibration values
  circleOfConfusionMm: number;
  boundaryCoCDiameterPx: number;
  boundaryBlurRadiusPx: number;
  filmWidthMm: number;
  filmHeightMm: number;
};

/** Keep depth linearization on every DOF stage aligned with the live RTT camera. */
export const synchronizeGroundGlassDofClipRange = (
  materials: readonly THREE.ShaderMaterial[],
  nearWorld: number,
  farWorld: number,
): void => {
  materials.forEach((material) => {
    material.uniforms.near.value = nearWorld;
    material.uniforms.far.value = farWorld;
  });
};

export function applyGroundGlassDofUniformState(
  material: THREE.ShaderMaterial,
  state: GroundGlassDofUniformState,
): void {
  material.uniforms.dofMode.value = state.mode;
  material.uniforms.lensCenterWorld.value.set(...state.lensCenterWorld);
  if (material.uniforms.lensPlaneNormal) material.uniforms.lensPlaneNormal.value.set(...state.lensPlaneNormal);
  if (material.uniforms.lensPlaneBasisX) material.uniforms.lensPlaneBasisX.value.set(...state.lensPlaneBasisX);
  if (material.uniforms.lensPlaneBasisY) material.uniforms.lensPlaneBasisY.value.set(...state.lensPlaneBasisY);
  if (material.uniforms.filmPlanePoint) material.uniforms.filmPlanePoint.value.set(...state.filmPlanePoint);
  if (material.uniforms.filmPlaneNormal) material.uniforms.filmPlaneNormal.value.set(...state.filmPlaneNormal);
  if (material.uniforms.filmPlaneBasisX) material.uniforms.filmPlaneBasisX.value.set(...state.filmPlaneBasisX);
  if (material.uniforms.filmPlaneBasisY) material.uniforms.filmPlaneBasisY.value.set(...state.filmPlaneBasisY);
  material.uniforms.focusPlanePoint.value.set(...state.focusPlanePoint);
  material.uniforms.focusPlaneNormal.value.set(...state.focusPlaneNormal);
  if (state.nearPlanePoint) material.uniforms.nearPlanePoint.value.set(...state.nearPlanePoint);
  if (state.nearPlaneNormal) material.uniforms.nearPlaneNormal.value.set(...state.nearPlaneNormal);
  if (state.farPlanePoint) material.uniforms.farPlanePoint.value.set(...state.farPlanePoint);
  if (state.farPlaneNormal) material.uniforms.farPlaneNormal.value.set(...state.farPlaneNormal);
  material.uniforms.hasFiniteFar.value = state.hasFiniteFarPlane ? 1 : 0;
  material.uniforms.inverseProjectionMatrix.value.fromArray(state.inverseProjectionMatrix);
  material.uniforms.cameraMatrixWorld.value.fromArray(state.cameraMatrixWorld);
  // CoC and gather materials share this state, but only the gather material
  // owns the quality cap. Keep the application helper compatible with both
  // stages so optics preparation remains a single source of truth.
  if (material.uniforms.maximumBlurRadiusPx) {
    material.uniforms.maximumBlurRadiusPx.value = state.maximumBlurRadiusPx;
  }
  if (material.uniforms.maximumCoCRadiusPx) {
    material.uniforms.maximumCoCRadiusPx.value = state.maximumBlurRadiusPx;
  }
  if (material.uniforms.focalLengthMm) material.uniforms.focalLengthMm.value = state.focalLengthMm;
  if (material.uniforms.filmWidthMm) material.uniforms.filmWidthMm.value = state.filmWidthMm;
  if (material.uniforms.filmHeightMm) material.uniforms.filmHeightMm.value = state.filmHeightMm;
  if (material.uniforms.fNumber) material.uniforms.fNumber.value = state.fNumber;
  if (material.uniforms.imageDistanceMm) material.uniforms.imageDistanceMm.value = state.imageDistanceMm;
  if (material.uniforms.renderWidth) material.uniforms.renderWidth.value = state.renderWidth;
  if (material.uniforms.renderHeight) material.uniforms.renderHeight.value = state.renderHeight;
}

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
): GroundGlassDofUniformState {
  const groundGlassDofModel =
    opticsState.diagnostics.groundGlassDofModel ??
    (opticsState.diagnostics.depthOfFieldModel === "scheimpflug-wedge"
      ? "derived-planes"
      : "parallel-thin-lens");
  const mode = groundGlassDofModel === "derived-planes" ? 1 : 0;

  // Validate physical constants
  if (!Number.isFinite(focalLengthMm) || focalLengthMm <= 0) throw new Error("Invalid focalLengthMm");
  if (!Number.isFinite(filmWidthMm) || filmWidthMm <= 0) throw new Error("Invalid filmWidthMm");
  if (!Number.isFinite(filmHeightMm) || filmHeightMm <= 0) throw new Error("Invalid filmHeightMm");
  if (!Number.isFinite(circleOfConfusionMm) || circleOfConfusionMm <= 0) throw new Error("Invalid circleOfConfusionMm");
  if (!Number.isFinite(width) || width <= 0) throw new Error("Invalid render width");
  if (!Number.isFinite(height) || height <= 0) throw new Error("Invalid render height");
  if (!Number.isFinite(aperture) || aperture <= 0) throw new Error("Invalid aperture");
  if (!Number.isFinite(maximumBlurRadiusPx) || maximumBlurRadiusPx < 0) {
    throw new Error("Invalid maximumBlurRadiusPx");
  }
  const lens = opticsState.lensCenterWorld;
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
  const focusPlane = opticsState.focusPlane;
  const nearPlane = opticsState.depthOfFieldNearPlane ?? null;
  const farPlane = opticsState.depthOfFieldFarPlane ?? null;

  const toMeters = (v: { x: number; y: number; z: number } | null) =>
    v ? ([v.x * 0.001, v.y * 0.001, v.z * 0.001] as [number, number, number]) : null;

  // flatten matrices to column-major arrays for GLSL uniform mat4
  const invProj = camera.projectionMatrixInverse.elements.slice();
  const camWorld = camera.matrixWorld.elements.slice();
  if (![...invProj, ...camWorld].every(Number.isFinite)) {
    throw new Error("Ground Glass camera matrices contain non-finite values");
  }

  const finiteVec = (value: { x: number; y: number; z: number } | null | undefined) =>
    Boolean(value && [value.x, value.y, value.z].every(Number.isFinite));
  if (!finiteVec(lens)) throw new Error("Lens centre contains non-finite values");
  if (!lensBasis || !filmBasis) {
    throw new Error("Lens/film plane bases contain degenerate geometry");
  }
  if (mode === 1 && (!focusPlane || !nearPlane)) {
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

  const boundaryCoCDiameterPx = (circleOfConfusionMm * width) / filmWidthMm;
  const boundaryBlurRadiusPx = boundaryCoCDiameterPx / 2;
  if (!Number.isFinite(boundaryCoCDiameterPx) || !Number.isFinite(boundaryBlurRadiusPx)) {
    throw new Error("Ground Glass boundary blur calibration is non-finite");
  }

  // compute image distance along optical axis using shared helper
  const imageDistanceComputed = calculateImageDistanceAlongOpticalAxisMm({
    lensCenterWorld: opticsState.lensCenterWorld,
    filmPlanePointWorld: opticsState.filmPlane.point,
    opticalAxisDirection: opticsState.opticalAxis.direction,
  });

  // If the image distance cannot be computed, treat this as a preparation error.
  if (
    imageDistanceComputed === null ||
    !Number.isFinite(imageDistanceComputed) ||
    imageDistanceComputed <= 0
  ) {
    throw new Error("Unable to calculate image distance along the optical axis");
  }

  return {
    mode: mode as 0 | 1,
    lensCenterWorld: toMeters(lens) ?? [0, 0, 0],
    lensPlaneNormal: [lensBasis.normal.x, lensBasis.normal.y, lensBasis.normal.z],
    lensPlaneBasisX: [lensBasis.x.x, lensBasis.x.y, lensBasis.x.z],
    lensPlaneBasisY: [lensBasis.y.x, lensBasis.y.y, lensBasis.y.z],
    filmPlanePoint: toMeters(opticsState.filmPlane.point) as [number, number, number],
    filmPlaneNormal: [filmBasis.normal.x, filmBasis.normal.y, filmBasis.normal.z],
    filmPlaneBasisX: [filmBasis.x.x, filmBasis.x.y, filmBasis.x.z],
    filmPlaneBasisY: [filmBasis.y.x, filmBasis.y.y, filmBasis.y.z],
    focusPlanePoint: focusPlane ? toMeters(focusPlane.point) as [number, number, number] : [0, 0, 0],
    focusPlaneNormal: focusPlane ? [focusPlane.normal.x, focusPlane.normal.y, focusPlane.normal.z] : [0, 0, 1],
    nearPlanePoint: nearPlane ? toMeters(nearPlane.point) : null,
    nearPlaneNormal: nearPlane ? [nearPlane.normal.x, nearPlane.normal.y, nearPlane.normal.z] : null,
    farPlanePoint: farPlane ? toMeters(farPlane.point) : null,
    farPlaneNormal: farPlane ? [farPlane.normal.x, farPlane.normal.y, farPlane.normal.z] : null,
    hasFiniteFarPlane: !!farPlane,
    inverseProjectionMatrix: invProj,
    cameraMatrixWorld: camWorld,
    imageDistanceMm: imageDistanceComputed,
    focalLengthMm: focalLengthMm,
    fNumber: aperture,
    renderWidth: width,
    renderHeight: height,
    maximumBlurRadiusPx,
    circleOfConfusionMm,
    boundaryCoCDiameterPx,
    boundaryBlurRadiusPx,
    filmWidthMm,
    filmHeightMm,
  };
}
