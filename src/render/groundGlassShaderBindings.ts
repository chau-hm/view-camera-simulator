import * as THREE from "three";
import type { GroundGlassDofRenderState } from "./groundGlassDofRenderState";
import type { GroundGlassPhysicalRenderState } from "./groundGlassPhysicalRenderState";

type GroundGlassDofShaderStage = "CoC" | "gather";

const dofStateUniformNames = [
  "dofMode",
  "lensCenterWorld",
  "lensPlaneNormal",
  "lensPlaneBasisX",
  "lensPlaneBasisY",
  "filmPlanePoint",
  "filmPlaneNormal",
  "filmPlaneBasisX",
  "filmPlaneBasisY",
  "focusPlanePoint",
  "focusPlaneNormal",
  "nearPlanePoint",
  "nearPlaneNormal",
  "farPlanePoint",
  "farPlaneNormal",
  "hasFiniteFar",
  "inverseProjectionMatrix",
  "cameraMatrixWorld",
  "maximumCoCRadiusPx",
  "focalLengthMm",
  "sampledFilmWidthMm",
  "sampledFilmHeightMm",
  "fNumber",
  "imageDistanceMm",
  "renderWidth",
  "renderHeight",
  "circleOfConfusionMm",
] as const;

const stageUniformNames: Record<GroundGlassDofShaderStage, readonly string[]> = {
  // Stage textures and gatherLayer are routed by the RTT executor; validate
  // their current GLSL declarations here without taking over their values.
  CoC: ["tDepth"],
  gather: ["tColor", "tDepth", "tCoC", "gatherLayer"],
};

const requireGroundGlassDofShaderContract = (
  material: THREE.ShaderMaterial,
  stage: GroundGlassDofShaderStage,
): void => {
  for (const name of [...dofStateUniformNames, ...stageUniformNames[stage]]) {
    if (material.uniforms[name] == null) {
      throw new Error(`Ground Glass ${stage} shader is missing required uniform "${name}"`);
    }
  }
};

const bindGroundGlassDofState = (
  material: THREE.ShaderMaterial,
  state: GroundGlassDofRenderState,
  stage: GroundGlassDofShaderStage,
): void => {
  requireGroundGlassDofShaderContract(material, stage);

  material.uniforms.dofMode.value = state.model === "derived-planes" ? 1 : 0;
  material.uniforms.lensCenterWorld.value.set(
    state.lens.centerWorldM.x,
    state.lens.centerWorldM.y,
    state.lens.centerWorldM.z,
  );
  material.uniforms.lensPlaneNormal.value.set(
    state.lens.planeNormal.x,
    state.lens.planeNormal.y,
    state.lens.planeNormal.z,
  );
  material.uniforms.lensPlaneBasisX.value.set(
    state.lens.planeBasisX.x,
    state.lens.planeBasisX.y,
    state.lens.planeBasisX.z,
  );
  material.uniforms.lensPlaneBasisY.value.set(
    state.lens.planeBasisY.x,
    state.lens.planeBasisY.y,
    state.lens.planeBasisY.z,
  );
  material.uniforms.filmPlanePoint.value.set(
    state.film.planePointWorldM.x,
    state.film.planePointWorldM.y,
    state.film.planePointWorldM.z,
  );
  material.uniforms.filmPlaneNormal.value.set(
    state.film.planeNormal.x,
    state.film.planeNormal.y,
    state.film.planeNormal.z,
  );
  material.uniforms.filmPlaneBasisX.value.set(
    state.film.planeBasisX.x,
    state.film.planeBasisX.y,
    state.film.planeBasisX.z,
  );
  material.uniforms.filmPlaneBasisY.value.set(
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

  material.uniforms.maximumCoCRadiusPx.value = state.render.maximumBlurRadiusPx;
  material.uniforms.focalLengthMm.value = state.optics.focalLengthMm;
  material.uniforms.sampledFilmWidthMm.value = state.film.sampledWidthMm;
  material.uniforms.sampledFilmHeightMm.value = state.film.sampledHeightMm;
  material.uniforms.fNumber.value = state.optics.apertureFNumber;
  material.uniforms.imageDistanceMm.value = state.optics.imageDistanceMm;
  material.uniforms.renderWidth.value = state.render.widthPx;
  material.uniforms.renderHeight.value = state.render.heightPx;
  material.uniforms.circleOfConfusionMm.value = state.optics.acceptableCoCDiameterMm;
};

/** Apply semantic DOF state to the current GLSL CoC material contract. */
export const bindGroundGlassDofStateToCocMaterial = (
  material: THREE.ShaderMaterial,
  state: GroundGlassDofRenderState,
): void => bindGroundGlassDofState(material, state, "CoC");

/** Apply semantic DOF state to the current GLSL gather material contract. */
export const bindGroundGlassDofStateToGatherMaterial = (
  material: THREE.ShaderMaterial,
  state: GroundGlassDofRenderState,
): void => bindGroundGlassDofState(material, state, "gather");

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
