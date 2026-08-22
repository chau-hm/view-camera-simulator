import * as THREE from "three";

export type GroundGlassCocStorageFormat = "half-float-mm" | "encoded-byte";

export type GroundGlassCocTarget = {
  target: THREE.WebGLRenderTarget;
  storageFormat: GroundGlassCocStorageFormat;
};

/**
 * CPU reference for the signed CoC storage contract used by the GLSL stages.
 * Half-float targets store signed millimetres directly. Byte targets map the
 * configured signed range [-maxMm, +maxMm] to [0, 1], with focus at 0.5.
 */
export const encodeGroundGlassSignedCoC = (
  signedCocMm: number,
  storageFormat: GroundGlassCocStorageFormat,
  maximumCoCMm: number,
): number => {
  if (!Number.isFinite(signedCocMm)) return storageFormat === "encoded-byte" ? 0.5 : 0;
  if (storageFormat === "half-float-mm") return signedCocMm;
  if (!Number.isFinite(maximumCoCMm) || maximumCoCMm <= 0) return 0.5;
  return Math.min(1, Math.max(0, signedCocMm / (2 * maximumCoCMm) + 0.5));
};

export const decodeGroundGlassSignedCoC = (
  storedCoc: number,
  storageFormat: GroundGlassCocStorageFormat,
  maximumCoCMm: number,
): number => {
  if (!Number.isFinite(storedCoc)) return 0;
  if (storageFormat === "half-float-mm") return storedCoc;
  if (!Number.isFinite(maximumCoCMm) || maximumCoCMm <= 0) return 0;
  const normalized = Math.min(1, Math.max(0, storedCoc));
  return (normalized * 2 - 1) * maximumCoCMm;
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
 * The encoded-byte mode stores normalized signed CoC in the red channel;
 * shader uniforms carry the physical millimetre range needed to decode it.
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
