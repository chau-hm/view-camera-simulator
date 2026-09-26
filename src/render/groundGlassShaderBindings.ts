import * as THREE from "three";
import type { GroundGlassDofRenderState } from "./groundGlassDofRenderState";
import type { GroundGlassPhysicalRenderState } from "./groundGlassPhysicalRenderState";

/** Apply the semantic DOF snapshot to the current GLSL CoC/gather contract. */
export const bindGroundGlassDofStateToShaderMaterial = (
  material: THREE.ShaderMaterial,
  state: GroundGlassDofRenderState,
): void => {
  material.uniforms.dofMode.value = state.model === "derived-planes" ? 1 : 0;
  material.uniforms.lensCenterWorld.value.set(
    state.lens.centerWorldM.x,
    state.lens.centerWorldM.y,
    state.lens.centerWorldM.z,
  );
  if (material.uniforms.lensPlaneNormal) material.uniforms.lensPlaneNormal.value.set(
    state.lens.planeNormal.x,
    state.lens.planeNormal.y,
    state.lens.planeNormal.z,
  );
  if (material.uniforms.lensPlaneBasisX) material.uniforms.lensPlaneBasisX.value.set(
    state.lens.planeBasisX.x,
    state.lens.planeBasisX.y,
    state.lens.planeBasisX.z,
  );
  if (material.uniforms.lensPlaneBasisY) material.uniforms.lensPlaneBasisY.value.set(
    state.lens.planeBasisY.x,
    state.lens.planeBasisY.y,
    state.lens.planeBasisY.z,
  );
  if (material.uniforms.filmPlanePoint) material.uniforms.filmPlanePoint.value.set(
    state.film.planePointWorldM.x,
    state.film.planePointWorldM.y,
    state.film.planePointWorldM.z,
  );
  if (material.uniforms.filmPlaneNormal) material.uniforms.filmPlaneNormal.value.set(
    state.film.planeNormal.x,
    state.film.planeNormal.y,
    state.film.planeNormal.z,
  );
  if (material.uniforms.filmPlaneBasisX) material.uniforms.filmPlaneBasisX.value.set(
    state.film.planeBasisX.x,
    state.film.planeBasisX.y,
    state.film.planeBasisX.z,
  );
  if (material.uniforms.filmPlaneBasisY) material.uniforms.filmPlaneBasisY.value.set(
    state.film.planeBasisY.x,
    state.film.planeBasisY.y,
    state.film.planeBasisY.z,
  );

  // Preserve the current neutral defaults for absent infinite-focus planes.
  const focusPoint = state.focus.plane?.pointWorldM;
  material.uniforms.focusPlanePoint.value.set(
    focusPoint?.x ?? 0,
    focusPoint?.y ?? 0,
    focusPoint?.z ?? 0,
  );
  const focusNormal = state.focus.plane?.normal;
  material.uniforms.focusPlaneNormal.value.set(
    focusNormal?.x ?? 0,
    focusNormal?.y ?? 0,
    focusNormal?.z ?? 1,
  );
  if (state.focus.nearPlane) {
    material.uniforms.nearPlanePoint.value.set(
      state.focus.nearPlane.pointWorldM.x,
      state.focus.nearPlane.pointWorldM.y,
      state.focus.nearPlane.pointWorldM.z,
    );
    material.uniforms.nearPlaneNormal.value.set(
      state.focus.nearPlane.normal.x,
      state.focus.nearPlane.normal.y,
      state.focus.nearPlane.normal.z,
    );
  }
  if (state.focus.farPlane) {
    material.uniforms.farPlanePoint.value.set(
      state.focus.farPlane.pointWorldM.x,
      state.focus.farPlane.pointWorldM.y,
      state.focus.farPlane.pointWorldM.z,
    );
    material.uniforms.farPlaneNormal.value.set(
      state.focus.farPlane.normal.x,
      state.focus.farPlane.normal.y,
      state.focus.farPlane.normal.z,
    );
  }
  material.uniforms.hasFiniteFar.value = state.focus.farPlane ? 1 : 0;
  material.uniforms.inverseProjectionMatrix.value.fromArray(state.camera.inverseProjectionMatrixElements);
  material.uniforms.cameraMatrixWorld.value.fromArray(state.camera.worldMatrixElements);

  // CoC and gather stages share physical values. The currently defined GLSL
  // material contract differs slightly by stage, so optional fields stay
  // guarded at this implementation boundary.
  if (material.uniforms.maximumBlurRadiusPx) {
    material.uniforms.maximumBlurRadiusPx.value = state.render.maximumBlurRadiusPx;
  }
  if (material.uniforms.maximumCoCRadiusPx) {
    material.uniforms.maximumCoCRadiusPx.value = state.render.maximumBlurRadiusPx;
  }
  if (material.uniforms.focalLengthMm) {
    material.uniforms.focalLengthMm.value = state.optics.focalLengthMm;
  }
  if (material.uniforms.filmWidthMm) material.uniforms.filmWidthMm.value = state.film.widthMm;
  if (material.uniforms.filmHeightMm) material.uniforms.filmHeightMm.value = state.film.heightMm;
  if (material.uniforms.sampledFilmWidthMm) {
    material.uniforms.sampledFilmWidthMm.value = state.film.sampledWidthMm;
  }
  if (material.uniforms.sampledFilmHeightMm) {
    material.uniforms.sampledFilmHeightMm.value = state.film.sampledHeightMm;
  }
  if (material.uniforms.fNumber) {
    material.uniforms.fNumber.value = state.optics.apertureFNumber;
  }
  if (material.uniforms.imageDistanceMm) {
    material.uniforms.imageDistanceMm.value = state.optics.imageDistanceMm;
  }
  if (material.uniforms.renderWidth) material.uniforms.renderWidth.value = state.render.widthPx;
  if (material.uniforms.renderHeight) material.uniforms.renderHeight.value = state.render.heightPx;
  if (material.uniforms.circleOfConfusionMm) {
    material.uniforms.circleOfConfusionMm.value = state.optics.acceptableCoCDiameterMm;
  }
};

/** Apply only semantic physical effects to the current GLSL composite. */
export const bindGroundGlassPhysicalStateToComposite = (
  material: THREE.ShaderMaterial,
  state: GroundGlassPhysicalRenderState,
): void => {
  const coverage = state.coverage;
  const circle = coverage.active && coverage.geometry?.kind === "parallel-circle"
    ? coverage.geometry
    : null;
  const conic = coverage.active && coverage.geometry?.kind === "nonparallel-conic"
    ? coverage.geometry
    : null;
  const illumination = state.naturalIllumination;
  const cos4 = illumination.enabled && illumination.geometry?.kind === "parallel-cos4"
    ? illumination.geometry
    : null;

  material.uniforms.groundGlassIlluminanceGain.value = state.relativeIlluminanceGain;
  material.uniforms.groundGlassNaturalIlluminationEnabled.value = cos4 ? 1 : 0;
  material.uniforms.groundGlassNaturalIlluminationImageDistanceMm.value = cos4?.imageDistanceMm ?? 0;
  material.uniforms.groundGlassNaturalIlluminationOffsetXMm.value = cos4?.opticalAxisOffsetXMm ?? 0;
  material.uniforms.groundGlassNaturalIlluminationOffsetYMm.value = cos4?.opticalAxisOffsetYMm ?? 0;

  material.uniforms.groundGlassCoverageEnabled.value = coverage.active ? 1 : 0;
  material.uniforms.groundGlassCoverageMode.value = circle ? 1 : conic ? 2 : 0;
  material.uniforms.groundGlassCoverageRadiusMm.value = circle?.radiusMm ?? 0;
  material.uniforms.groundGlassCoverageOffsetXMm.value = circle?.opticalAxisOffsetXMm ?? 0;
  material.uniforms.groundGlassCoverageOffsetYMm.value = circle?.opticalAxisOffsetYMm ?? 0;
  material.uniforms.groundGlassCoverageConicQuadratic.value.set(
    conic?.quadratic.a ?? 0,
    conic?.quadratic.b ?? 0,
    conic?.quadratic.c ?? 0,
  );
  material.uniforms.groundGlassCoverageConicLinear.value.set(
    conic?.quadratic.d ?? 0,
    conic?.quadratic.e ?? 0,
    conic?.quadratic.f ?? 0,
  );
  material.uniforms.groundGlassCoverageConicAxial.value.set(
    conic?.axial.x ?? 0,
    conic?.axial.y ?? 0,
    conic?.axial.constant ?? 0,
  );
  material.uniforms.groundGlassCoverageEdgeFeatherMm.value = coverage.edgeFeatherMm;
  material.uniforms.groundGlassFilmWindowCenterXMm.value = coverage.filmWindow.centerXMm;
  material.uniforms.groundGlassFilmWindowCenterYMm.value = coverage.filmWindow.centerYMm;
  material.uniforms.groundGlassFilmWindowWidthMm.value = coverage.filmWindow.widthMm;
  material.uniforms.groundGlassFilmWindowHeightMm.value = coverage.filmWindow.heightMm;
};

/** Keep GLSL depth linearization aligned with the live RTT camera clip range. */
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
