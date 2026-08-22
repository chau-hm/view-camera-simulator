import * as THREE from "three";

export type GroundGlassCocStorageFormat = "half-float-mm" | "encoded-byte";

export type GroundGlassCocTarget = {
  target: THREE.WebGLRenderTarget;
  storageFormat: GroundGlassCocStorageFormat;
};

export const GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE = 128;
const GROUND_GLASS_SIGNED_COC_MAX_BYTE = 255;

const clampByte = (value: number): number =>
  Math.min(GROUND_GLASS_SIGNED_COC_MAX_BYTE, Math.max(0, Math.round(value)));

/** Quantizes a normalized byte-target write using the actual RGBA8 code grid. */
export const quantizeGroundGlassSignedCoCByte = (encoded: number): number => {
  if (!Number.isFinite(encoded)) return GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE;
  return clampByte(Math.min(1, Math.max(0, encoded)) * GROUND_GLASS_SIGNED_COC_MAX_BYTE);
};

/**
 * Encodes signed CoC as an explicit RGBA8 code. Code 128 is neutral; codes
 * 0..127 are negative and codes 129..255 are positive. The two sides use
 * their available code counts independently so zero survives quantization.
 */
export const encodeGroundGlassSignedCoCByte = (
  signedCocMm: number,
  maximumCoCMm: number,
): number => {
  if (!Number.isFinite(signedCocMm) || !Number.isFinite(maximumCoCMm) || maximumCoCMm <= 0) {
    return GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE;
  }
  const normalized = Math.min(1, Math.max(-1, signedCocMm / maximumCoCMm));
  if (normalized < 0) {
    return clampByte(GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE + normalized * 128);
  }
  return clampByte(GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE + normalized * 127);
};

export const decodeGroundGlassSignedCoCByte = (
  byteCode: number,
  maximumCoCMm: number,
): number => {
  if (!Number.isFinite(byteCode) || !Number.isFinite(maximumCoCMm) || maximumCoCMm <= 0) {
    return 0;
  }
  const code = clampByte(byteCode);
  if (code < GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE) {
    return ((code - GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE) / 128) * maximumCoCMm;
  }
  if (code > GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE) {
    return ((code - GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE) / 127) * maximumCoCMm;
  }
  return 0;
};

/**
 * CPU reference for the signed CoC storage contract used by the GLSL stages.
 * Half-float targets store signed millimetres directly. Byte targets use the
 * explicit neutral-safe integer code contract above and return its normalized
 * code-grid value for the RGBA8 render target.
 */
export const encodeGroundGlassSignedCoC = (
  signedCocMm: number,
  storageFormat: GroundGlassCocStorageFormat,
  maximumCoCMm: number,
): number => {
  if (!Number.isFinite(signedCocMm)) {
    return storageFormat === "encoded-byte"
      ? GROUND_GLASS_SIGNED_COC_NEUTRAL_BYTE / GROUND_GLASS_SIGNED_COC_MAX_BYTE
      : 0;
  }
  if (storageFormat === "half-float-mm") return signedCocMm;
  return encodeGroundGlassSignedCoCByte(signedCocMm, maximumCoCMm) /
    GROUND_GLASS_SIGNED_COC_MAX_BYTE;
};

export const decodeGroundGlassSignedCoC = (
  storedCoc: number,
  storageFormat: GroundGlassCocStorageFormat,
  maximumCoCMm: number,
): number => {
  if (!Number.isFinite(storedCoc)) return 0;
  if (storageFormat === "half-float-mm") return storedCoc;
  return decodeGroundGlassSignedCoCByte(
    quantizeGroundGlassSignedCoCByte(storedCoc),
    maximumCoCMm,
  );
};

export const GROUND_GLASS_FOOTPRINT_ORIENTATION_PERIOD_RAD = Math.PI;

/** Quantizes a non-negative normalized footprint channel to the RGBA8 grid. */
export const quantizeGroundGlassFootprintByte = (encoded: number): number => {
  if (!Number.isFinite(encoded)) return 0;
  return Math.min(255, Math.max(0, Math.round(Math.min(1, Math.max(0, encoded)) * 255)));
};

/**
 * Encodes a local ellipse radius. Half-float stores physical millimetres;
 * byte fallback stores a normalized value against the configured physical
 * radius range. The decoded value is always non-negative.
 */
export const encodeGroundGlassFootprintRadiusMm = (
  radiusMm: number,
  storageFormat: GroundGlassCocStorageFormat,
  maximumRadiusMm: number,
): number => {
  if (!Number.isFinite(radiusMm) || radiusMm <= 0) return 0;
  if (storageFormat === "half-float-mm") return radiusMm;
  if (!Number.isFinite(maximumRadiusMm) || maximumRadiusMm <= 0) return 0;
  return Math.min(1, radiusMm / maximumRadiusMm);
};

export const decodeGroundGlassFootprintRadiusMm = (
  storedRadius: number,
  storageFormat: GroundGlassCocStorageFormat,
  maximumRadiusMm: number,
): number => {
  if (!Number.isFinite(storedRadius)) return 0;
  if (storageFormat === "half-float-mm") return Math.max(0, storedRadius);
  if (!Number.isFinite(maximumRadiusMm) || maximumRadiusMm <= 0) return 0;
  return (quantizeGroundGlassFootprintByte(storedRadius) / 255) * maximumRadiusMm;
};

/**
 * Ellipse orientation is a line direction, so it is periodic over pi rather
 * than 2*pi. It is normalized for both storage modes; zero footprint makes
 * the angle immaterial but still deterministic.
 */
export const encodeGroundGlassFootprintOrientation = (orientationRad: number): number => {
  if (!Number.isFinite(orientationRad)) return 0;
  const wrapped = ((orientationRad % GROUND_GLASS_FOOTPRINT_ORIENTATION_PERIOD_RAD) +
    GROUND_GLASS_FOOTPRINT_ORIENTATION_PERIOD_RAD) %
    GROUND_GLASS_FOOTPRINT_ORIENTATION_PERIOD_RAD;
  return wrapped / GROUND_GLASS_FOOTPRINT_ORIENTATION_PERIOD_RAD;
};

export const decodeGroundGlassFootprintOrientation = (
  storedOrientation: number,
  storageFormat: GroundGlassCocStorageFormat,
): number => {
  if (!Number.isFinite(storedOrientation)) return 0;
  const normalized = storageFormat === "encoded-byte"
    ? quantizeGroundGlassFootprintByte(storedOrientation) / 255
    : Math.min(1, Math.max(0, storedOrientation));
  return normalized * GROUND_GLASS_FOOTPRINT_ORIENTATION_PERIOD_RAD;
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
 * The encoded-byte mode stores the explicit neutral-safe normalized signed CoC
 * code in the red channel; shader uniforms carry the physical millimetre range
 * needed to decode it. Signed CoC is surface classification data, so neither
 * storage representation may interpolate between opposing signs.
 */
export const createGroundGlassCocTarget = (
  renderer: GroundGlassCocRenderer,
  widthPx: number,
  heightPx: number,
): GroundGlassCocTarget => {
  const targetOptions = {
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
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
