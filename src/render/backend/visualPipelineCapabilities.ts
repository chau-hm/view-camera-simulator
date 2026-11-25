import type { RendererCapabilities } from "./rendererCapabilities";
import type { RendererBackend } from "./rendererBackend";
import { resolveMountedRendererVisualSettings } from "./rendererVisualSettings";

export type GroundGlassVisualPipelineCapabilities = Readonly<{
  /** Runtime observations from the mounted renderer used by the Ground Glass RTT. */
  renderer: Readonly<{
    surface: "ground-glass";
    /** Identity from this mounted Three.js renderer, never browser feature detection. */
    activeBackend: RendererBackend;
    colorRenderTarget: Readonly<{
      status: "available" | "unavailable" | "unverified";
      backend: "webgl";
      evidence: "ground-glass-framebuffer-probe" | "not-probed";
    }>;
    shadowMaps: Readonly<{
      status: "active" | "disabled";
      type: "basic" | "pcf" | "pcf-soft" | "vsm" | "unknown";
    }>;
    toneMapping: Readonly<{
      active: boolean;
      mode:
        | "none"
        | "linear"
        | "reinhard"
        | "cineon"
        | "aces-filmic"
        | "agx"
        | "neutral"
        | "custom"
        | "unknown";
      exposure: number | null;
      outputColorSpace: string | null;
    }>;
  }>;
  /** Current Ground Glass implementation facts, not renderer introspection. */
  groundGlassPipeline: Readonly<{
    rtt: Readonly<{
      status: "active";
      implementation: "webgl-render-target-bundle";
      backendCoupling: "webgl";
    }>;
    dof: Readonly<{
      status: "available";
      activeOnProcessedPath: true;
      implementation: "custom-glsl-multipass";
      backendCoupling: "webgl";
    }>;
  }>;
}>;

/**
 * Reports only the mounted Ground Glass renderer and the known Ground Glass
 * pipeline implementation. It creates no renderer or GPU resource and makes
 * no claims about the observer viewport or application-wide rendering state.
 */
export const resolveGroundGlassVisualPipelineCapabilities = (
  renderer: unknown,
  colorTargetCapabilities?: RendererCapabilities | null,
): GroundGlassVisualPipelineCapabilities | null => {
  const rendererSettings = resolveMountedRendererVisualSettings(renderer);
  if (!rendererSettings) return null;

  const backend = rendererSettings.activeBackend;
  const targetResultMatchesBackend =
    colorTargetCapabilities?.backend === backend;
  const colorTargetStatus = !targetResultMatchesBackend
    ? "unverified"
    : colorTargetCapabilities.colorRenderTargetRenderable
      ? "available"
      : "unavailable";

  return {
    renderer: {
      surface: "ground-glass",
      activeBackend: backend,
      colorRenderTarget: {
        status: colorTargetStatus,
        backend,
        evidence: targetResultMatchesBackend
          ? "ground-glass-framebuffer-probe"
          : "not-probed",
      },
      shadowMaps: rendererSettings.shadowMaps,
      toneMapping: rendererSettings.toneMapping,
    },
    groundGlassPipeline: {
      rtt: {
        status: "active",
        implementation: "webgl-render-target-bundle",
        backendCoupling: "webgl",
      },
      dof: {
        status: "available",
        activeOnProcessedPath: true,
        implementation: "custom-glsl-multipass",
        backendCoupling: "webgl",
      },
    },
  };
};
