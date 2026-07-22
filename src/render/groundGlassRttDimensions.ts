import { getRenderQualitySettings } from "./renderQuality";
import type { RenderQualityProfile } from "../types/ui";
import { GROUND_GLASS_ZOOM_SCALE } from "./groundGlassStageTransform";

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

export type GroundGlassRttRuntimeInfo = GroundGlassRttDimensions & {
  profile: RenderQualityProfile;

  configuredCanvasDpr: number; // the DPR configured by the selected quality profile
  rendererPixelRatio: number; // actual renderer pixel ratio from gl.getPixelRatio()

  canvasCssWidthPx: number;
  canvasCssHeightPx: number;

  drawingBufferWidthPx: number; // canvas.width
  drawingBufferHeightPx: number; // canvas.height

  internalWidthPx: number;
  internalHeightPx: number;

  colorTargetWidthPx: number;
  colorTargetHeightPx: number;

  depthTargetWidthPx: number;
  depthTargetHeightPx: number;

  blurTargetWidthPx: number;
  blurTargetHeightPx: number;

  finalTargetWidthPx: number;
  finalTargetHeightPx: number;

  horizontalShaderRenderWidthPx: number;
  horizontalShaderRenderHeightPx: number;
  verticalShaderRenderWidthPx: number;
  verticalShaderRenderHeightPx: number;

  cameraNearWorld?: number;
  cameraFarWorld?: number;
  cameraConfigurationOk?: boolean;
  cameraConfigurationError?: string | null;
  projectionDeterminant?: number | null;
  depthTextureAvailable?: boolean;
  dofMode?: "parallel-thin-lens" | "derived-planes";
  uniformsFinite?: boolean;
  uniformPreparationError?: string | null;
  rawColorVariance?: number;
  rawNonBackgroundPixelCount?: number;
  rawContentful?: boolean;
  finalColorVariance?: number;
  finalNonBackgroundPixelCount?: number;
  finalContentful?: boolean;
  renderSanitySampleCount?: number;
  renderSanityStateKey?: string;
  renderSanityError?: string | null;

  resourceGeneration: number; // increments when RTT resources are recreated
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
  const logicalWidthPx = Math.max(
    1,
    Math.round(Number.isFinite(logicalWidth) ? logicalWidth : 1),
  );
  const logicalHeightPx = Math.max(
    1,
    Math.round(Number.isFinite(logicalHeight) ? logicalHeight : 1),
  );
  const quality = getRenderQualitySettings(renderQuality);
  // map zoomEnabled -> zoomScale used by stage
  const stageZoomScale = zoomEnabled ? GROUND_GLASS_ZOOM_SCALE : 1.0;
  // Match the CSS magnification so zooming does not upscale a lower-resolution
  // RTT. Hard texture caps below still protect memory on large/high-DPR panels.
  const zoomRenderScale = stageZoomScale;
  const resolutionScale = quality.groundGlassScale * zoomRenderScale;
  // effective DPR limited by profile dpr
  const effectiveDevicePixelRatio = Math.min(devicePixelRatio || 1, quality.dpr);

  let internalWidth = Math.max(
    1,
    Math.round(logicalWidthPx * resolutionScale * effectiveDevicePixelRatio),
  );
  let internalHeight = Math.max(
    1,
    Math.round(logicalHeightPx * resolutionScale * effectiveDevicePixelRatio),
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
    logicalWidthPx,
    logicalHeightPx,
    internalWidthPx: internalWidth,
    internalHeightPx: internalHeight,
    resolutionScale,
    effectiveDevicePixelRatio,
    zoomRenderScale,
    wasClamped,
  };
}
