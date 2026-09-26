export type RendererBackend = "webgl";

type RendererWithBackendMarker = {
  isWebGLRenderer?: unknown;
};

/** Identifies the Three.js renderer instance without exposing WebGL state. */
export const resolveRendererBackend = (
  renderer: unknown,
): RendererBackend | null => {
  if (typeof renderer !== "object" || renderer === null) return null;
  return (renderer as RendererWithBackendMarker).isWebGLRenderer === true
    ? "webgl"
    : null;
};

/**
 * Reports whether the application's currently active renderer backend can be
 * created in this browser. The WebGL context itself stays inside this module.
 */
export const detectAvailableRendererBackend = (): RendererBackend | null => {
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
      ? "webgl"
      : null;
  } catch {
    return null;
  }
};
