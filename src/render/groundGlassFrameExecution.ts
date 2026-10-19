import type { WebGLRenderer } from "three";

type GroundGlassFrameStateRenderer = Pick<
  WebGLRenderer,
  "getRenderTarget" | "setRenderTarget" | "setClearColor"
>;

/** Execute one RTT frame and restore the caller's renderer state on every exit. */
export const withGroundGlassFrameState = (
  renderer: GroundGlassFrameStateRenderer,
  skyColor: number,
  executeFrame: () => void,
  onFailure: (error: unknown) => void,
): void => {
  let previousRenderTarget: ReturnType<WebGLRenderer["getRenderTarget"]> = null;
  let previousRenderTargetCaptured = false;
  let failed = false;
  let failure: unknown;

  try {
    previousRenderTarget = renderer.getRenderTarget();
    previousRenderTargetCaptured = true;
    executeFrame();
  } catch (error) {
    failed = true;
    failure = error;
  }

  if (previousRenderTargetCaptured) {
    try {
      renderer.setRenderTarget(previousRenderTarget);
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
  }

  try {
    renderer.setClearColor(skyColor, 1);
  } catch (error) {
    if (!failed) {
      failed = true;
      failure = error;
    }
  }

  if (!failed) return;

  try {
    onFailure(failure);
  } catch {
    // Keep the original frame/cleanup error observable to the frame loop.
  }
  throw failure;
};
