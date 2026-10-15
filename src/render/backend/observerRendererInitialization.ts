import type { CanvasProps, GLProps } from "@react-three/fiber";
import type { ObserverRendererAttempt, SelectedObserverBackend } from "./observerBackend";
import type { ObserverOutputPolicy } from "./observerOutputPolicy";

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
  canvasProps: Pick<CanvasProps, "gl" | "linear" | "flat">;
}>;

/** R3F initialization seam; only the explicitly selected pilot loads three/webgpu. */
export const resolveObserverCanvasInitialization = (
  selection: SelectedObserverBackend,
  antialias: boolean,
  onWebGpuInitializationFailure: () => void,
  onWebGpuInitializationAttempt: () => void = () => undefined,
  outputPolicy: ObserverOutputPolicy = "standard",
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
        const renderer = new WebGPURenderer({
          // Canvas currently mounts a DOM canvas; R3F's public factory type includes a local OffscreenCanvas shim.
          canvas: defaults.canvas as HTMLCanvasElement,
          alpha: defaults.alpha,
          powerPreference: defaults.powerPreference === "low-power"
            ? "low-power"
            : "high-performance",
          antialias,
        });
        return renderer;
      },
      onWebGpuInitializationFailure,
    );
  };

  return {
    rendererAttempt: "webgpu",
    // R3F configures outputColorSpace and toneMapping after resolving an async
    // renderer factory. Use its public Canvas controls so these values survive
    // configure() and are active before the first scene frame.
    canvasProps: outputPolicy === "material-aware"
      ? { gl: createWebGpuRenderer, linear: true, flat: true }
      : { gl: createWebGpuRenderer },
  };
};
