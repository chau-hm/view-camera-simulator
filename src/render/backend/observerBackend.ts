import * as THREE from "three";
import type { CanvasProps, GLProps } from "@react-three/fiber";

export type ObserverRendererRequest = "webgl" | "webgpu-pilot";
export type ObserverRendererAttempt = "webgl" | "webgpu";
export type ObserverRendererFamily =
  | "webgl-renderer"
  | "webgpu-renderer"
  | "unknown";
export type ObserverExecutionBackend =
  | "webgl2"
  | "webgpu"
  | "webgl2-fallback"
  | "unknown";
export type ObserverApplicationFallback = "none" | "app-webgl";

export type ObserverBackendSelection =
  | Readonly<{
      status: "selected";
      requestedRenderer: ObserverRendererRequest;
      rendererAttempt: ObserverRendererAttempt;
      applicationFallback: ObserverApplicationFallback;
      webglAvailable: boolean;
    }>
  | Readonly<{
      status: "unavailable";
      requestedRenderer: ObserverRendererRequest;
      rendererAttempt: null;
      applicationFallback: ObserverApplicationFallback;
      webglAvailable: boolean;
      reason: "no-supported-backend" | "renderer-initialization-failed";
    }>;

export type SelectedObserverBackend = Extract<
  ObserverBackendSelection,
  { status: "selected" }
>;

export type ObserverBackendSelectionInput = Readonly<{
  webglAvailable: boolean;
  requestedRendererParam: string | null;
  sceneId: string;
  developmentPilotEnabled: boolean;
}>;

const WEBGPU_PILOT_SCENE_IDS = new Set(["view-camera-anatomy"]);

/** Pure policy: browser hints select a bounded attempt, never prove mounted identity. */
export const selectObserverBackend = (
  input: ObserverBackendSelectionInput,
): ObserverBackendSelection => {
  const pilotRequested =
    input.requestedRendererParam === "webgpu" &&
    input.developmentPilotEnabled &&
    WEBGPU_PILOT_SCENE_IDS.has(input.sceneId);

  if (pilotRequested) {
    return {
      status: "selected",
      requestedRenderer: "webgpu-pilot",
      rendererAttempt: "webgpu",
      applicationFallback: "none",
      webglAvailable: input.webglAvailable,
    };
  }

  if (!input.webglAvailable) {
    return {
      status: "unavailable",
      requestedRenderer: "webgl",
      rendererAttempt: null,
      applicationFallback: "none",
      webglAvailable: false,
      reason: "no-supported-backend",
    };
  }

  return {
    status: "selected",
    requestedRenderer: "webgl",
    rendererAttempt: "webgl",
    applicationFallback: "none",
    webglAvailable: true,
  };
};

export const resolveObserverRendererInitializationFailure = (
  selection: SelectedObserverBackend,
): ObserverBackendSelection => {
  if (
    selection.requestedRenderer === "webgpu-pilot" &&
    selection.rendererAttempt === "webgpu" &&
    selection.applicationFallback === "none"
  ) {
    if (selection.webglAvailable) {
      return {
        ...selection,
        rendererAttempt: "webgl",
        applicationFallback: "app-webgl",
      };
    }

    return {
      status: "unavailable",
      requestedRenderer: selection.requestedRenderer,
      rendererAttempt: null,
      applicationFallback: "none",
      webglAvailable: false,
      reason: "renderer-initialization-failed",
    };
  }

  return {
    status: "unavailable",
    requestedRenderer: selection.requestedRenderer,
    rendererAttempt: null,
    applicationFallback: selection.applicationFallback,
    webglAvailable: selection.webglAvailable,
    reason: "renderer-initialization-failed",
  };
};

export type ObserverRendererRuntime = Readonly<{
  rendererFamily: ObserverRendererFamily;
  executionBackend: ObserverExecutionBackend;
}>;

/** Classifies the actual initialized R3F renderer using public Three r186 evidence. */
export const resolveObserverRendererRuntime = (
  renderer: unknown,
): ObserverRendererRuntime => {
  if (typeof renderer !== "object" || renderer === null) {
    return { rendererFamily: "unknown", executionBackend: "unknown" };
  }

  const candidate = renderer as {
    isWebGLRenderer?: unknown;
    isWebGPURenderer?: unknown;
    coordinateSystem?: unknown;
  };

  if (candidate.isWebGPURenderer === true) {
    if (candidate.coordinateSystem === THREE.WebGPUCoordinateSystem) {
      return { rendererFamily: "webgpu-renderer", executionBackend: "webgpu" };
    }
    if (candidate.coordinateSystem === THREE.WebGLCoordinateSystem) {
      return {
        rendererFamily: "webgpu-renderer",
        executionBackend: "webgl2-fallback",
      };
    }
    return { rendererFamily: "webgpu-renderer", executionBackend: "unknown" };
  }

  if (candidate.isWebGLRenderer === true) {
    return { rendererFamily: "webgl-renderer", executionBackend: "webgl2" };
  }

  return { rendererFamily: "unknown", executionBackend: "unknown" };
};

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

/** R3F initialization seam; only the explicitly requested pilot loads three/webgpu. */
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
