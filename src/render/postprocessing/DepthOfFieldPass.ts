import type { DerivedOpticsState } from "../../types/optics";
import {
  calculateApertureBlurStrength,
  calculateFocusPlaneDistanceMm,
  createHalfResolutionBlurPass,
  linearizeDepthSample,
  reconstructWorldPosition,
} from "../groundGlassPipeline";

export type DepthOfFieldPassConfig = {
  enabled: boolean;
  widthPx: number;
  heightPx: number;
  sampleDepth: number;
  sampleUv: { u: number; v: number };
  aperture: number;
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
  const worldPosition = reconstructWorldPosition(
    config.sampleUv.u,
    config.sampleUv.v,
    linearDepthMm,
    opticsState,
  );
  const distanceToFocusPlaneMm = calculateFocusPlaneDistanceMm(worldPosition, opticsState.focusPlane);
  const blurStrength = config.enabled
    ? calculateApertureBlurStrength(distanceToFocusPlaneMm, config.aperture)
    : 0;

  return {
    enabled: config.enabled,
    linearDepthMm,
    distanceToFocusPlaneMm,
    blurStrength,
    blurPass: createHalfResolutionBlurPass({
      widthPx: config.widthPx,
      heightPx: config.heightPx,
      textureId: "dof-source",
    }),
  };
};
