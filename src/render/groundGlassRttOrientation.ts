import type { GroundGlassPreviewMode } from "./groundGlassTargetProjection";

export type GroundGlassRttDisplayTransform = {
  flipDisplayX: boolean;
  flipDisplayY: boolean;
};

/**
 * Resolve the axis relationship between the pre-composite RTT texture and
 * the displayed Ground Glass image. The off-axis RTT camera reverses the
 * horizontal camera basis while its configured up vector preserves the
 * vertical basis. Per-axis flips are self-inverse, so this same contract can
 * map display coordinates back to the source crop for inspection windows.
 */
export const resolveGroundGlassRttDisplayTransform = (
  previewMode: GroundGlassPreviewMode,
): GroundGlassRttDisplayTransform => previewMode === "raw"
  ? { flipDisplayX: false, flipDisplayY: true }
  : { flipDisplayX: true, flipDisplayY: false };

export const applyGroundGlassRttDisplayTransform = (
  uv: { u: number; v: number },
  transform: GroundGlassRttDisplayTransform,
): { u: number; v: number } => ({
  u: transform.flipDisplayX ? 1 - uv.u : uv.u,
  v: transform.flipDisplayY ? 1 - uv.v : uv.v,
});
