import type { DerivedOpticsState } from "../../types/optics";
import type { RenderQualityProfile } from "../../types/ui";
import {
  calculateApertureBlurStrength,
  calculateFocusPlaneDistanceMm,
  createScaledBlurPass,
  linearizeDepthSample,
  reconstructWorldPosition,
} from "../groundGlassPipeline";
import { getRenderQualitySettings } from "../renderQuality";

export type DepthOfFieldPassConfig = {
  enabled: boolean;
  widthPx: number;
  heightPx: number;
  sampleDepth: number;
  sampleUv: { u: number; v: number };
  aperture: number;
  renderQuality: RenderQualityProfile;
};

export type DepthOfFieldPassResult = {
  enabled: boolean;
  linearDepthMm: number;
  distanceToFocusPlaneMm: number;
  blurStrength: number;
  blurPass: {
    widthPx: number;
    heightPx: number;
  };
};

export const createDepthOfFieldPass = (
  config: DepthOfFieldPassConfig,
  opticsState: DerivedOpticsState,
): DepthOfFieldPassResult => {
  const linearDepthMm = linearizeDepthSample(config.sampleDepth) * 1000;
  const qualitySettings = getRenderQualitySettings(config.renderQuality);
  const worldPosition = config.enabled
    ? reconstructWorldPosition(config.sampleUv.u, config.sampleUv.v, linearDepthMm, opticsState)
    : null;
  const distanceToFocusPlaneMm = worldPosition
    ? calculateFocusPlaneDistanceMm(worldPosition, opticsState.focusPlane)
    : 0;
  const blurStrength = config.enabled ? calculateApertureBlurStrength(distanceToFocusPlaneMm, config.aperture) : 0;

  return {
    enabled: config.enabled,
    linearDepthMm,
    distanceToFocusPlaneMm,
    blurStrength,
    blurPass: createScaledBlurPass({
      widthPx: config.widthPx,
      heightPx: config.heightPx,
      textureId: "dof-source",
    }, qualitySettings.blurPassScale),
  };
};
