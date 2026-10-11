import type { CanvasProps, GLProps } from "@react-three/fiber";
import type { ObserverRendererAttempt, SelectedObserverBackend } from "./observerBackend";

type InitializableRenderer = Readonly<{
  init: () => PromiseLike<unknown> | unknown;
  dispose: () => PromiseLike<unknown> | unknown;
}>;

/** Initializes one factory-owned renderer and disposes a partial instance on failure. */
export const initializeObserverWebGpuRenderer = async <
  TRenderer extends InitializableRenderer,
>(
  createRenderer: () => TRenderer | PromiseLike<TRenderer>,
  onInitializationFailure: () => void,
): Promise<TRenderer> => {
  let renderer: TRenderer | null = null;
  try {
    renderer = await createRenderer();
    await renderer.init();
    return renderer;
  } catch (error) {
    if (renderer) {
      try {
        await renderer.dispose();
      } catch {
        // Preserve the initialization failure so the Observer host can fall back.
      }
    }
    onInitializationFailure();
    throw error;
  }
};

export type ObserverCanvasInitialization = Readonly<{
  rendererAttempt: ObserverRendererAttempt;
  canvasProps: Pick<CanvasProps, "gl">;
}>;

/** R3F initialization seam; only the explicitly selected pilot loads three/webgpu. */
export const resolveObserverCanvasInitialization = (
  selection: SelectedObserverBackend,
  antialias: boolean,
  onWebGpuInitializationFailure: () => void,
  onWebGpuInitializationAttempt: () => void = () => undefined,
): ObserverCanvasInitialization => {
  if (selection.rendererAttempt === "webgl") {
    return {
      rendererAttempt: "webgl",
      canvasProps: { gl: { antialias } },
    };
  }

  const createWebGpuRenderer: GLProps = async (defaults) => {
    onWebGpuInitializationAttempt();
    return initializeObserverWebGpuRenderer(
      async () => {
        const { WebGPURenderer } = await import("three/webgpu");
        return new WebGPURenderer({
          // Canvas currently mounts a DOM canvas; R3F's public factory type includes a local OffscreenCanvas shim.
          canvas: defaults.canvas as HTMLCanvasElement,
          alpha: defaults.alpha,
          powerPreference: defaults.powerPreference === "low-power"
            ? "low-power"
            : "high-performance",
          antialias,
        });
      },
      onWebGpuInitializationFailure,
    );
  };

  return {
    rendererAttempt: "webgpu",
    canvasProps: { gl: createWebGpuRenderer },
  };
};
