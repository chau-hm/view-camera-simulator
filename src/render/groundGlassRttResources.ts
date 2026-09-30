import * as THREE from "three";
import {
  createGroundGlassCocTarget,
  type GroundGlassCocStorageFormat,
} from "./groundGlassCocTarget";
import type { RendererCapabilities } from "./backend/rendererCapabilities";

type GroundGlassRttRenderer = Pick<
  THREE.WebGLRenderer,
  "getContext" | "getRenderTarget" | "setRenderTarget"
>;

/**
 * Current Three.js targets grouped by the Ground Glass stage/resource role
 * they implement. This is an application-specific ownership bundle, not a
 * renderer or render-target abstraction.
 */
export type GroundGlassRttResources = {
  scene: {
    colorDepthTarget: THREE.WebGLRenderTarget;
    depthFallback: THREE.DataTexture;
  };
  coc: {
    classificationTarget: THREE.WebGLRenderTarget;
    storageFormat: GroundGlassCocStorageFormat;
    rendererCapabilities: RendererCapabilities;
  };
  gather: {
    farTarget: THREE.WebGLRenderTarget;
    nearTarget: THREE.WebGLRenderTarget;
  };
  composite: {
    outputTarget: THREE.WebGLRenderTarget;
  };
  diagnostics: {
    rawSceneTarget: THREE.WebGLRenderTarget;
    compositeOutputTarget: THREE.WebGLRenderTarget;
  };
  /** Disposes the targets and fallback texture created by this bundle once. */
  dispose: () => void;
};

export type GroundGlassRttPassMaterials = {
  coc: THREE.ShaderMaterial;
  gather: THREE.ShaderMaterial;
  composite: THREE.ShaderMaterial;
};

const disposeQuietly = (resource: { dispose: () => void }): void => {
  try {
    resource.dispose();
  } catch {
    // Continue disposing the other resources owned by this Ground Glass bundle.
  }
};

/** Creates the concrete Three.js resources for the current Ground Glass passes. */
export const createGroundGlassRttResources = (input: {
  renderer: GroundGlassRttRenderer;
  widthPx: number;
  heightPx: number;
  gatherScale: number;
}): GroundGlassRttResources => {
  const { renderer, widthPx, heightPx, gatherScale } = input;
  const safeGatherScale =
    Number.isFinite(gatherScale) && gatherScale > 0 ? gatherScale : 1;
  const gatherWidthPx = Math.max(1, Math.floor(widthPx * safeGatherScale));
  const gatherHeightPx = Math.max(1, Math.floor(heightPx * safeGatherScale));
  const ownedTargets: THREE.WebGLRenderTarget[] = [];
  let depthFallback: THREE.DataTexture | null = null;

  try {
    const colorDepthTarget = new THREE.WebGLRenderTarget(widthPx, heightPx);
    ownedTargets.push(colorDepthTarget);

    // Keep the runtime constructor check used by the existing Three.js integration.
    type UnknownCtor = new (...args: unknown[]) => unknown;
    const DepthTextureCtor = (THREE as unknown as { DepthTexture?: UnknownCtor })
      .DepthTexture;
    const depthTexture = DepthTextureCtor
      ? new DepthTextureCtor(widthPx, heightPx)
      : undefined;
    if (depthTexture) {
      (depthTexture as { type?: number }).type =
        (THREE as unknown as { UnsignedShortType?: number }).UnsignedShortType ??
        (THREE as unknown as { UnsignedIntType?: number }).UnsignedIntType;
      (colorDepthTarget as unknown as { depthTexture?: unknown }).depthTexture =
        depthTexture;
    }
    colorDepthTarget.depthBuffer = true;

    const fallbackData = new Uint8Array([255, 255, 255, 255]);
    depthFallback = new THREE.DataTexture(fallbackData, 1, 1, THREE.RGBAFormat);
    depthFallback.needsUpdate = true;

    const coc = createGroundGlassCocTarget(renderer, widthPx, heightPx);
    coc.target.depthBuffer = false;
    ownedTargets.push(coc.target);

    const farTarget = new THREE.WebGLRenderTarget(gatherWidthPx, gatherHeightPx, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    farTarget.depthBuffer = false;
    ownedTargets.push(farTarget);

    const nearTarget = new THREE.WebGLRenderTarget(gatherWidthPx, gatherHeightPx, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    nearTarget.depthBuffer = false;
    ownedTargets.push(nearTarget);

    const outputTarget = new THREE.WebGLRenderTarget(widthPx, heightPx);
    outputTarget.depthBuffer = false;
    ownedTargets.push(outputTarget);

    const rawSceneTarget = new THREE.WebGLRenderTarget(32, 32);
    rawSceneTarget.depthBuffer = false;
    ownedTargets.push(rawSceneTarget);

    const compositeOutputTarget = new THREE.WebGLRenderTarget(32, 32);
    compositeOutputTarget.depthBuffer = false;
    ownedTargets.push(compositeOutputTarget);

    let disposed = false;
    return {
      scene: { colorDepthTarget, depthFallback },
      coc: {
        classificationTarget: coc.target,
        storageFormat: coc.storageFormat,
        rendererCapabilities: coc.rendererCapabilities,
      },
      gather: { farTarget, nearTarget },
      composite: { outputTarget },
      diagnostics: { rawSceneTarget, compositeOutputTarget },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        ownedTargets.forEach(disposeQuietly);
        if (depthFallback) disposeQuietly(depthFallback);
      },
    };
  } catch (error) {
    ownedTargets.forEach(disposeQuietly);
    if (depthFallback) disposeQuietly(depthFallback);
    throw error;
  }
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
 * Resizes each semantic target role and its size uniforms as one synchronous
 * lifecycle transaction. Returns true only when a target, depth attachment,
 * or shader uniform actually changed.
 */
export const resizeGroundGlassRttResources = (
  resources: GroundGlassRttResources,
  materials: GroundGlassRttPassMaterials,
  widthPx: number,
  heightPx: number,
  gatherScale = 1,
): boolean => {
  let changed = resizeTargetIfNeeded(
    resources.scene.colorDepthTarget,
    widthPx,
    heightPx,
  );

  // RenderTarget.setSize updates the color attachment, while Three.js may not
  // publish attached DepthTexture dimensions until the next render.
  const depthTexture = resources.scene.colorDepthTarget.depthTexture;
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

  changed = resizeTargetIfNeeded(
    resources.coc.classificationTarget,
    widthPx,
    heightPx,
  ) || changed;
  changed = resizeTargetIfNeeded(
    resources.gather.farTarget,
    gatherWidthPx,
    gatherHeightPx,
  ) || changed;
  changed = resizeTargetIfNeeded(
    resources.gather.nearTarget,
    gatherWidthPx,
    gatherHeightPx,
  ) || changed;
  changed = resizeTargetIfNeeded(
    resources.composite.outputTarget,
    widthPx,
    heightPx,
  ) || changed;
  changed = updateUniformPair(materials.coc, widthPx, heightPx) || changed;
  changed = updateUniformPair(materials.gather, widthPx, heightPx) || changed;
  changed = updateUniformPair(materials.composite, widthPx, heightPx) || changed;
  return changed;
};
