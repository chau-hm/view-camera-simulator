import {
  resolveObserverRendererRuntime,
  type ObserverExecutionBackend,
  type ObserverRendererFamily,
} from "./observerBackend";
import {
  resolveRendererVisualSettings,
  type RendererVisualSettingsSnapshot,
} from "./rendererVisualSettings";

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
