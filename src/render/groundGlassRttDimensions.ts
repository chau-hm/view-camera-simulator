import { getRenderQualitySettings } from "./renderQuality";
import type { RenderQualityProfile } from "../types/ui";

export type GroundGlassRttDimensions = {
  logicalWidthPx: number;
  logicalHeightPx: number;
  internalWidthPx: number;
  internalHeightPx: number;
  resolutionScale: number;
  effectiveDevicePixelRatio: number;
  zoomRenderScale: number;
  wasClamped: boolean;
};

const MAX_INTERNAL_WIDTH = 1600;
const MAX_INTERNAL_HEIGHT = 1280;

export function resolveGroundGlassRttDimensions(opts: {
  logicalWidth: number;
  logicalHeight: number;
  renderQuality: RenderQualityProfile;
  devicePixelRatio: number;
  zoomEnabled?: boolean;
}): GroundGlassRttDimensions {
  const { logicalWidth, logicalHeight, renderQuality, devicePixelRatio, zoomEnabled } = opts;
  const quality = getRenderQualitySettings(renderQuality);
  // map zoomEnabled -> zoomScale used by stage
  const stageZoomScale = zoomEnabled ? 1.9 : 1.0;
  // conservative zoom render scale mapping (sqrt) clamped
  const zoomRenderScale = Math.min(1.5, Math.max(1.0, Math.sqrt(stageZoomScale)));
  const resolutionScale = quality.groundGlassScale * zoomRenderScale;
  // effective DPR limited by profile dpr
  const effectiveDevicePixelRatio = Math.min(devicePixelRatio || 1, quality.dpr);

  let internalWidth = Math.max(
    1,
    Math.round(logicalWidth * resolutionScale * effectiveDevicePixelRatio),
  );
  let internalHeight = Math.max(
    1,
    Math.round(logicalHeight * resolutionScale * effectiveDevicePixelRatio),
  );

  let wasClamped = false;
  if (internalWidth > MAX_INTERNAL_WIDTH) {
    const scale = MAX_INTERNAL_WIDTH / internalWidth;
    internalWidth = MAX_INTERNAL_WIDTH;
    internalHeight = Math.max(1, Math.round(internalHeight * scale));
    wasClamped = true;
  }
  if (internalHeight > MAX_INTERNAL_HEIGHT) {
    const scale = MAX_INTERNAL_HEIGHT / internalHeight;
    internalHeight = MAX_INTERNAL_HEIGHT;
    internalWidth = Math.max(1, Math.round(internalWidth * scale));
    wasClamped = true;
  }

  return {
    logicalWidthPx: logicalWidth,
    logicalHeightPx: logicalHeight,
    internalWidthPx: internalWidth,
    internalHeightPx: internalHeight,
    resolutionScale,
    effectiveDevicePixelRatio,
    zoomRenderScale,
    wasClamped,
  };
}
