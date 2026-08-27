import type { RenderQualityProfile } from "../types/ui";

export type RenderQualitySettings = {
  dpr: number;
  groundGlassScale: number;
  blurPassScale: number;
  antialias: boolean;
  /** Resolution scale for the aperture gather only; CoC remains full-resolution. */
  gatherScale: number;
  /** Runtime aperture sample count; the shader receives this as a uniform. */
  sampleCount: number;
  /** Quality-tier cap for the displayed CoC radius in source pixels. */
  maximumCoCRadiusPx: number;
};

const RENDER_QUALITY_SETTINGS: Record<RenderQualityProfile, RenderQualitySettings> = {
  high: {
    dpr: 2,
    groundGlassScale: 1,
    blurPassScale: 0.5,
    antialias: true,
    gatherScale: 1,
    sampleCount: 32,
    maximumCoCRadiusPx: 64,
  },
  standard: {
    dpr: 1.5,
    groundGlassScale: 0.85,
    blurPassScale: 0.5,
    antialias: true,
    gatherScale: 1,
    sampleCount: 32,
    maximumCoCRadiusPx: 60,
  },
  low: {
    dpr: 1,
    groundGlassScale: 0.65,
    blurPassScale: 0.25,
    antialias: false,
    gatherScale: 0.5,
    sampleCount: 16,
    maximumCoCRadiusPx: 32,
  },
};

export const getRenderQualitySettings = (
  renderQuality: RenderQualityProfile,
): RenderQualitySettings => RENDER_QUALITY_SETTINGS[renderQuality];

export const scaleResolution = (value: number, scale: number): number =>
  Math.max(1, Math.floor(value * scale));
