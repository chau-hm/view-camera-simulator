import * as THREE from "three";
import {
  resolveRendererVisualSettings,
  type RendererVisualSettingsSnapshot,
} from "./rendererVisualSettings";

export type ObserverRendererFamily =
  | "webgl-renderer"
  | "webgpu-renderer"
  | "unknown";
export type ObserverExecutionBackend =
  | "webgl2"
  | "webgpu"
  | "webgl2-fallback"
  | "unknown";

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

export type ObserverVisualPipelineCapabilities =
  | Readonly<{
      surface: "observer";
      status: "active";
      rendererFamily: Exclude<ObserverRendererFamily, "unknown">;
      executionBackend: ObserverExecutionBackend;
      shadowMaps: RendererVisualSettingsSnapshot["shadowMaps"];
      toneMapping: RendererVisualSettingsSnapshot["toneMapping"];
    }>
  | Readonly<{
      surface: "observer";
      status: "unsupported";
      rendererFamily: "unknown";
      executionBackend: "unknown";
    }>;

/** Resolves mounted Observer evidence from the actual R3F renderer, not browser hints. */
export const resolveObserverVisualPipelineCapabilities = (
  renderer: unknown,
): ObserverVisualPipelineCapabilities => {
  const runtime = resolveObserverRendererRuntime(renderer);
  const visualSettings = resolveRendererVisualSettings(renderer);

  if (runtime.rendererFamily === "unknown") {
    return {
      surface: "observer",
      status: "unsupported",
      rendererFamily: "unknown",
      executionBackend: "unknown",
    };
  }
  if (!visualSettings) {
    return {
      surface: "observer",
      status: "unsupported",
      rendererFamily: "unknown",
      executionBackend: "unknown",
    };
  }

  return {
    surface: "observer",
    status: "active",
    rendererFamily: runtime.rendererFamily,
    executionBackend: runtime.executionBackend,
    ...visualSettings,
  };
};
