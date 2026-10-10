import type { RendererBackend } from "./rendererBackend";
import type { MountedRendererVisualSettings } from "./rendererVisualSettings";
import { resolveMountedRendererVisualSettings } from "./rendererVisualSettings";

export type ObserverVisualPipelineCapabilities =
  | Readonly<{
      surface: "observer";
      status: "active";
      activeBackend: RendererBackend;
      shadowMaps: MountedRendererVisualSettings["shadowMaps"];
      toneMapping: MountedRendererVisualSettings["toneMapping"];
    }>
  | Readonly<{
      surface: "observer";
      status: "unsupported";
      activeBackend: null;
    }>;

/** Resolves only facts available on the actual mounted Observer renderer. */
export const resolveObserverVisualPipelineCapabilities = (
  renderer: unknown,
): ObserverVisualPipelineCapabilities => {
  const visualSettings = resolveMountedRendererVisualSettings(renderer);
  if (!visualSettings) {
    return {
      surface: "observer",
      status: "unsupported",
      activeBackend: null,
    };
  }

  return {
    surface: "observer",
    status: "active",
    ...visualSettings,
  };
};
