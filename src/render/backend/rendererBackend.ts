export type RendererBackend = "webgl";

type RendererWithBackendMarker = {
  isWebGLRenderer?: unknown;
};

/** Identifies the backend represented by an actual Three.js renderer instance. */
export const resolveRendererBackend = (
  renderer: unknown,
): RendererBackend | null => {
  if (typeof renderer !== "object" || renderer === null) return null;
  return (renderer as RendererWithBackendMarker).isWebGLRenderer === true
    ? "webgl"
    : null;
};

/**
 * Reports whether this browser can provide the WebGL context required by the
 * current production renderer. This is browser availability, not active
 * renderer identity; use resolveRendererBackend for a renderer instance.
 * The WebGL context itself stays inside this module.
 */
export const detectAvailableWebGLBackend = (): RendererBackend | null => {
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
