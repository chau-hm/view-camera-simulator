import type { RenderQualityProfile } from "../types/ui";

export type RenderQualitySettings = {
  dpr: number;
  groundGlassScale: number;
  blurPassScale: number;
  antialias: boolean;
};

const RENDER_QUALITY_SETTINGS: Record<RenderQualityProfile, RenderQualitySettings> = {
  high: {
    dpr: 2,
    groundGlassScale: 1,
    blurPassScale: 0.5,
    antialias: true,
  },
  standard: {
    dpr: 1.5,
    groundGlassScale: 0.85,
    blurPassScale: 0.5,
    antialias: true,
  },
  low: {
    dpr: 1,
    groundGlassScale: 0.65,
    blurPassScale: 0.25,
    antialias: false,
  },
};

export const getRenderQualitySettings = (
  renderQuality: RenderQualityProfile,
): RenderQualitySettings => RENDER_QUALITY_SETTINGS[renderQuality];

export const scaleResolution = (value: number, scale: number): number =>
  Math.max(1, Math.floor(value * scale));
