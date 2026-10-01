import * as THREE from "three";
import type { WebGLRenderer } from "three";
import type { RendererCapabilities } from "./rendererCapabilities";
import {
  resolveRendererBackend,
  type RendererBackend,
} from "./rendererBackend";

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

type RendererVisualSettings = Pick<
  WebGLRenderer,
  "shadowMap" | "toneMapping" | "toneMappingExposure" | "outputColorSpace"
>;

const resolveShadowMapType = (
  type: number | undefined,
): GroundGlassVisualPipelineCapabilities["renderer"]["shadowMaps"]["type"] => {
  if (type === THREE.BasicShadowMap) return "basic";
  if (type === THREE.PCFShadowMap) return "pcf";
  if (type === THREE.PCFSoftShadowMap) return "pcf-soft";
  if (type === THREE.VSMShadowMap) return "vsm";
  return "unknown";
};

const resolveToneMapping = (
  toneMapping: number | undefined,
): GroundGlassVisualPipelineCapabilities["renderer"]["toneMapping"]["mode"] => {
  if (toneMapping === undefined) return "unknown";
  if (toneMapping === THREE.NoToneMapping) return "none";
  if (toneMapping === THREE.LinearToneMapping) return "linear";
  if (toneMapping === THREE.ReinhardToneMapping) return "reinhard";
  if (toneMapping === THREE.CineonToneMapping) return "cineon";
  if (toneMapping === THREE.ACESFilmicToneMapping) return "aces-filmic";
  if (toneMapping === THREE.AgXToneMapping) return "agx";
  if (toneMapping === THREE.NeutralToneMapping) return "neutral";
  if (toneMapping === THREE.CustomToneMapping) return "custom";
  return "unknown";
};

/**
 * Reports only the mounted Ground Glass renderer and the known Ground Glass
 * pipeline implementation. It creates no renderer or GPU resource and makes
 * no claims about the observer viewport or application-wide rendering state.
 */
export const resolveGroundGlassVisualPipelineCapabilities = (
  renderer: unknown,
  colorTargetCapabilities?: RendererCapabilities | null,
): GroundGlassVisualPipelineCapabilities | null => {
  const backend = resolveRendererBackend(renderer);
  if (backend !== "webgl") return null;

  const settings = renderer as Partial<RendererVisualSettings>;
  const targetResultMatchesBackend =
    colorTargetCapabilities?.backend === backend;
  const colorTargetStatus = !targetResultMatchesBackend
    ? "unverified"
    : colorTargetCapabilities.colorRenderTargetRenderable
      ? "available"
      : "unavailable";
  const toneMapping = resolveToneMapping(settings.toneMapping);

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
      shadowMaps: {
        status: settings.shadowMap?.enabled === true ? "active" : "disabled",
        type: resolveShadowMapType(settings.shadowMap?.type),
      },
      toneMapping: {
        active: toneMapping !== "none" && toneMapping !== "unknown",
        mode: toneMapping,
        exposure: Number.isFinite(settings.toneMappingExposure)
          ? settings.toneMappingExposure ?? null
          : null,
        outputColorSpace: typeof settings.outputColorSpace === "string"
          ? settings.outputColorSpace
          : null,
      },
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
