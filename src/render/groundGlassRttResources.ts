import type * as THREE from "three";

export type SizeDependentRttResources = {
  renderTarget: THREE.WebGLRenderTarget;
  tempTarget: THREE.WebGLRenderTarget;
  finalTarget: THREE.WebGLRenderTarget;
  horizontalMaterial: THREE.ShaderMaterial;
  verticalMaterial: THREE.ShaderMaterial;
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

  changed = resizeTargetIfNeeded(resources.tempTarget, widthPx, heightPx) || changed;
  changed = resizeTargetIfNeeded(resources.finalTarget, widthPx, heightPx) || changed;
  changed = updateUniformPair(resources.horizontalMaterial, widthPx, heightPx) || changed;
  changed = updateUniformPair(resources.verticalMaterial, widthPx, heightPx) || changed;
  return changed;
};
