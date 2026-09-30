import * as THREE from "three";
import type { WebGLRenderer } from "three";
import type { RendererCapabilities } from "./rendererCapabilities";
import {
  resolveRendererBackend,
  type RendererBackend,
} from "./rendererBackend";

export type VisualPipelineCapabilities = Readonly<{
  /** Identity from the mounted Three.js renderer, never browser feature detection. */
  activeRendererBackend: RendererBackend;
  colorRenderTarget: Readonly<{
    status: "available" | "unavailable" | "unverified";
    backend: "webgl";
    evidence: "ground-glass-framebuffer-probe" | "not-probed";
  }>;
  shadowMaps: Readonly<{
    status: "active" | "available";
    backend: "webgl";
    type: "basic" | "pcf" | "pcf-soft" | "vsm" | "unknown";
  }>;
  litPbrMaterials: Readonly<{
    status: "available";
    backend: "webgl";
    currentAssetsUseMeshStandardMaterial: true;
  }>;
  environmentLighting: Readonly<{
    status: "available";
    backend: "webgl";
    active: false;
  }>;
  toneMappingExposure: Readonly<{
    status: "available";
    backend: "webgl";
    active: boolean;
    toneMapping:
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
  globalPostProcessing: Readonly<{
    status: "inactive";
  }>;
  groundGlassRtt: Readonly<{
    status: "active";
    implementation: "webgl-render-target-bundle";
    backendCoupling: "webgl";
  }>;
  groundGlassDof: Readonly<{
    status: "available";
    activeOnProcessedPath: true;
    implementation: "custom-glsl-multipass";
    backendCoupling: "webgl";
  }>;
  webgpuApplicationBackend: Readonly<{
    status: "inactive";
  }>;
}>;

type RendererVisualSettings = Pick<
  WebGLRenderer,
  "shadowMap" | "toneMapping" | "toneMappingExposure" | "outputColorSpace"
>;

const resolveShadowMapType = (
  type: number | undefined,
): VisualPipelineCapabilities["shadowMaps"]["type"] => {
  if (type === THREE.BasicShadowMap) return "basic";
  if (type === THREE.PCFShadowMap) return "pcf";
  if (type === THREE.PCFSoftShadowMap) return "pcf-soft";
  if (type === THREE.VSMShadowMap) return "vsm";
  return "unknown";
};

const resolveToneMapping = (
  toneMapping: number | undefined,
): VisualPipelineCapabilities["toneMappingExposure"]["toneMapping"] => {
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
 * Describes the renderer that is actually mounted and the visual paths in use
 * around it. The optional target result must come from the existing Ground
 * Glass framebuffer probe; this function creates no renderer or GPU resource.
 */
export const resolveVisualPipelineCapabilities = (
  renderer: unknown,
  colorTargetCapabilities?: RendererCapabilities | null,
): VisualPipelineCapabilities | null => {
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
    activeRendererBackend: backend,
    colorRenderTarget: {
      status: colorTargetStatus,
      backend,
      evidence: targetResultMatchesBackend
        ? "ground-glass-framebuffer-probe"
        : "not-probed",
    },
    shadowMaps: {
      status: settings.shadowMap?.enabled === true ? "active" : "available",
      backend,
      type: resolveShadowMapType(settings.shadowMap?.type),
    },
    litPbrMaterials: {
      status: "available",
      backend,
      currentAssetsUseMeshStandardMaterial: true,
    },
    environmentLighting: {
      status: "available",
      backend,
      active: false,
    },
    toneMappingExposure: {
      status: "available",
      backend,
      active: toneMapping !== "none" && toneMapping !== "unknown",
      toneMapping,
      exposure: Number.isFinite(settings.toneMappingExposure)
        ? settings.toneMappingExposure ?? null
        : null,
      outputColorSpace: typeof settings.outputColorSpace === "string"
        ? settings.outputColorSpace
        : null,
    },
    globalPostProcessing: {
      status: "inactive",
    },
    groundGlassRtt: {
      status: "active",
      implementation: "webgl-render-target-bundle",
      backendCoupling: "webgl",
    },
    groundGlassDof: {
      status: "available",
      activeOnProcessedPath: true,
      implementation: "custom-glsl-multipass",
      backendCoupling: "webgl",
    },
    webgpuApplicationBackend: {
      status: "inactive",
    },
  };
};
