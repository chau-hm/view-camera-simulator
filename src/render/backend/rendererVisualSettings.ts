import * as THREE from "three";
import {
  resolveRendererBackend,
  type RendererBackend,
} from "./rendererBackend";

export type RendererShadowMapType =
  | "basic"
  | "pcf"
  | "pcf-soft"
  | "vsm"
  | "unknown";

export type RendererToneMappingMode =
  | "none"
  | "linear"
  | "reinhard"
  | "cineon"
  | "aces-filmic"
  | "agx"
  | "neutral"
  | "custom"
  | "unknown";

export type RendererVisualSettingsSnapshot = Readonly<{
  shadowMaps: Readonly<{
    status: "active" | "disabled";
    type: RendererShadowMapType;
  }>;
  toneMapping: Readonly<{
    active: boolean;
    mode: RendererToneMappingMode;
    exposure: number | null;
    outputColorSpace: string | null;
  }>;
}>;

export type MountedRendererVisualSettings = RendererVisualSettingsSnapshot & Readonly<{
  activeBackend: RendererBackend;
}>;

type RendererVisualSettingsSource = {
  shadowMap?: { enabled?: boolean; type?: number };
  toneMapping?: number;
  toneMappingExposure?: number;
  outputColorSpace?: string;
};

const resolveShadowMapType = (type: number | undefined): RendererShadowMapType => {
  if (type === THREE.BasicShadowMap) return "basic";
  if (type === THREE.PCFShadowMap) return "pcf";
  if (type === THREE.PCFSoftShadowMap) return "pcf-soft";
  if (type === THREE.VSMShadowMap) return "vsm";
  return "unknown";
};

const resolveToneMapping = (
  toneMapping: number | undefined,
): RendererToneMappingMode => {
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

/** Reads only common display/shadow settings; callers must establish renderer identity. */
export const resolveRendererVisualSettings = (
  renderer: unknown,
): RendererVisualSettingsSnapshot | null => {
  if (typeof renderer !== "object" || renderer === null) return null;

  const settings = renderer as Partial<RendererVisualSettingsSource>;
  const toneMapping = resolveToneMapping(settings.toneMapping);

  return {
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
  };
};

/** Reads the mounted WebGL renderer settings used by the production Ground Glass path. */
export const resolveMountedRendererVisualSettings = (
  renderer: unknown,
): MountedRendererVisualSettings | null => {
  const activeBackend = resolveRendererBackend(renderer);
  if (activeBackend !== "webgl") return null;

  const visualSettings = resolveRendererVisualSettings(renderer);
  return visualSettings ? { activeBackend, ...visualSettings } : null;
};
