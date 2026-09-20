import type { GroundGlassPreviewMode } from "./groundGlassTargetProjection";

export type GroundGlassRttDisplayTransform = {
  flipDisplayX: boolean;
  flipDisplayY: boolean;
};

/**
 * Resolve the source-texture transform used by the Ground Glass composite.
 * The RTT source is the upright scene reference; Raw Ground Glass applies
 * the physical 180-degree inversion and Upright Assist removes it. Per-axis
 * flips are self-inverse, so this same contract maps displayed coordinates
 * back to the source crop for inspection windows.
 */
export const resolveGroundGlassRttDisplayTransform = (
  previewMode: GroundGlassPreviewMode,
): GroundGlassRttDisplayTransform => previewMode === "raw"
  ? { flipDisplayX: true, flipDisplayY: true }
  : { flipDisplayX: false, flipDisplayY: false };

export const applyGroundGlassRttDisplayTransform = (
  uv: { u: number; v: number },
  transform: GroundGlassRttDisplayTransform,
): { u: number; v: number } => ({
  u: transform.flipDisplayX ? 1 - uv.u : uv.u,
  v: transform.flipDisplayY ? 1 - uv.v : uv.v,
});
