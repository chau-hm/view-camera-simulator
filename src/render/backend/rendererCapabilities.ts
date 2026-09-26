import type { WebGLRenderTarget, WebGLRenderer } from "three";
import {
  resolveRendererBackend,
  type RendererBackend,
} from "./rendererBackend";

export type RendererCapabilities = Readonly<{
  backend: RendererBackend;
  /** Whether the supplied color target can be attached and rendered by Three.js. */
  colorRenderTargetRenderable: boolean;
}>;

/**
 * Resolves the current application's render-target capability for a concrete
 * candidate. The framebuffer probe is WebGL-specific; its result is plain
 * application data and contains no renderer, context, or framebuffer handle.
 */
export const resolveRendererCapabilities = (
  renderer: unknown,
  target: WebGLRenderTarget,
): RendererCapabilities | null => {
  const backend = resolveRendererBackend(renderer);
  if (backend !== "webgl") return null;

  const webglRenderer = renderer as Pick<
    WebGLRenderer,
    "getContext" | "getRenderTarget" | "setRenderTarget"
  >;
  let previousTarget: WebGLRenderTarget | null = null;
  let previousTargetCaptured = false;
  let colorRenderTargetRenderable = false;

  try {
    previousTarget = webglRenderer.getRenderTarget();
    previousTargetCaptured = true;
    webglRenderer.setRenderTarget(target);
    const context = webglRenderer.getContext();
    colorRenderTargetRenderable =
      context.checkFramebufferStatus(context.FRAMEBUFFER) ===
      context.FRAMEBUFFER_COMPLETE;
  } catch {
    colorRenderTargetRenderable = false;
  } finally {
    if (previousTargetCaptured) {
      try {
        webglRenderer.setRenderTarget(previousTarget);
      } catch {
        colorRenderTargetRenderable = false;
      }
    }
  }

  return { backend, colorRenderTargetRenderable };
};
