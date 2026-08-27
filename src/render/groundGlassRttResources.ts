import type * as THREE from "three";

export type SizeDependentRttResources = {
  renderTarget: THREE.WebGLRenderTarget;
  cocTarget: THREE.WebGLRenderTarget;
  gatherTarget: THREE.WebGLRenderTarget;
  nearGatherTarget: THREE.WebGLRenderTarget;
  finalTarget: THREE.WebGLRenderTarget;
  cocMaterial: THREE.ShaderMaterial;
  gatherMaterial: THREE.ShaderMaterial;
  compositeMaterial: THREE.ShaderMaterial;
};

const resizeTargetIfNeeded = (
  target: THREE.WebGLRenderTarget,
  widthPx: number,
  heightPx: number,
): boolean => {
  if (target.width === widthPx && target.height === heightPx) return false;
  target.setSize(widthPx, heightPx);
  return true;
};

const updateUniformPair = (
  material: THREE.ShaderMaterial,
  widthPx: number,
  heightPx: number,
): boolean => {
  const widthUniform = material.uniforms.renderWidth;
  const heightUniform = material.uniforms.renderHeight;
  if (!widthUniform || !heightUniform) return false;
  const changed = widthUniform.value !== widthPx || heightUniform.value !== heightPx;
  widthUniform.value = widthPx;
  heightUniform.value = heightPx;
  return changed;
};

/**
 * Resizes every size-dependent RTT resource as one synchronous lifecycle
 * transaction. Returns true only when a target, depth attachment, or shader
 * uniform actually changed.
 */
export const resizeGroundGlassRttResources = (
  resources: SizeDependentRttResources,
  widthPx: number,
  heightPx: number,
  gatherScale = 1,
): boolean => {
  let changed = resizeTargetIfNeeded(resources.renderTarget, widthPx, heightPx);

  // RenderTarget.setSize updates the color attachment, while Three.js may not
  // publish attached DepthTexture dimensions until the next render.
  const depthTexture = resources.renderTarget.depthTexture;
  if (depthTexture) {
    const depthImage = depthTexture.image as { width: number; height: number };
    if (depthImage.width !== widthPx || depthImage.height !== heightPx) {
      depthImage.width = widthPx;
      depthImage.height = heightPx;
      depthTexture.needsUpdate = true;
      changed = true;
    }
  }

  const safeGatherScale = Number.isFinite(gatherScale) && gatherScale > 0 ? gatherScale : 1;
  const gatherWidthPx = Math.max(1, Math.floor(widthPx * safeGatherScale));
  const gatherHeightPx = Math.max(1, Math.floor(heightPx * safeGatherScale));

  changed = resizeTargetIfNeeded(resources.cocTarget, widthPx, heightPx) || changed;
  changed = resizeTargetIfNeeded(resources.gatherTarget, gatherWidthPx, gatherHeightPx) || changed;
  changed = resizeTargetIfNeeded(resources.nearGatherTarget, gatherWidthPx, gatherHeightPx) || changed;
  changed = resizeTargetIfNeeded(resources.finalTarget, widthPx, heightPx) || changed;
  changed = updateUniformPair(resources.cocMaterial, widthPx, heightPx) || changed;
  changed = updateUniformPair(resources.gatherMaterial, widthPx, heightPx) || changed;
  changed = updateUniformPair(resources.compositeMaterial, widthPx, heightPx) || changed;
  return changed;
};
