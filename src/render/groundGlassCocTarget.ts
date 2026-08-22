import * as THREE from "three";

export type GroundGlassCocStorageFormat = "half-float-mm" | "encoded-byte";

export type GroundGlassCocTarget = {
  target: THREE.WebGLRenderTarget;
  storageFormat: GroundGlassCocStorageFormat;
};

type GroundGlassCocRenderer = Pick<
  THREE.WebGLRenderer,
  "getContext" | "getRenderTarget" | "setRenderTarget"
>;

/**
 * Checks the actual framebuffer status after Three.js has attached the target.
 * A WebGL context alone does not prove that a half-float color attachment is
 * renderable on the current device/browser.
 */
export const isGroundGlassColorRenderTargetRenderable = (
  renderer: GroundGlassCocRenderer,
  target: THREE.WebGLRenderTarget,
): boolean => {
  const previousTarget = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    const context = renderer.getContext();
    return (
      context.checkFramebufferStatus(context.FRAMEBUFFER) ===
      context.FRAMEBUFFER_COMPLETE
    );
  } catch {
    return false;
  } finally {
    renderer.setRenderTarget(previousTarget);
  }
};

/**
 * Creates a full-resolution CoC target with an explicit storage fallback.
 * The encoded-byte mode stores normalized CoC in the red channel; shader
 * uniforms carry the physical millimetre range needed to decode it.
 */
export const createGroundGlassCocTarget = (
  renderer: GroundGlassCocRenderer,
  widthPx: number,
  heightPx: number,
): GroundGlassCocTarget => {
  const targetOptions = {
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  } as const;

  const halfFloatTarget = new THREE.WebGLRenderTarget(widthPx, heightPx, {
    ...targetOptions,
    type: THREE.HalfFloatType,
  });
  if (isGroundGlassColorRenderTargetRenderable(renderer, halfFloatTarget)) {
    return {
      target: halfFloatTarget,
      storageFormat: "half-float-mm",
    };
  }
  halfFloatTarget.dispose();

  const encodedByteTarget = new THREE.WebGLRenderTarget(widthPx, heightPx, {
    ...targetOptions,
    type: THREE.UnsignedByteType,
  });
  if (!isGroundGlassColorRenderTargetRenderable(renderer, encodedByteTarget)) {
    encodedByteTarget.dispose();
    throw new Error("No renderable Ground Glass CoC color target is available");
  }

  return {
    target: encodedByteTarget,
    storageFormat: "encoded-byte",
  };
};

/**
 * Physical CoC diameter range represented by the display-radius cap. This is
 * used only for byte storage normalization; optical CoC calculation remains
 * unchanged and full resolution.
 */
export const resolveGroundGlassCocStorageMaxMm = (input: {
  maximumCoCRadiusPx: number;
  filmWidthMm: number;
  renderWidthPx: number;
  displayBlurScale: number;
}): number => {
  const { maximumCoCRadiusPx, filmWidthMm, renderWidthPx, displayBlurScale } = input;
  if (
    !Number.isFinite(maximumCoCRadiusPx) ||
    maximumCoCRadiusPx < 0 ||
    !Number.isFinite(filmWidthMm) ||
    filmWidthMm <= 0 ||
    !Number.isFinite(renderWidthPx) ||
    renderWidthPx <= 0 ||
    !Number.isFinite(displayBlurScale) ||
    displayBlurScale <= 0
  ) {
    return 1;
  }

  return Math.max(
    1e-6,
    (maximumCoCRadiusPx * 2 * filmWidthMm) /
      (renderWidthPx * displayBlurScale),
  );
};
