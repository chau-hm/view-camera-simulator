import type { GroundGlassPreviewMode } from "./groundGlassTargetProjection";

export type GroundGlassRttDisplayTransform = {
  flipDisplayX: boolean;
  flipDisplayY: boolean;
};

/**
 * Resolve the source-texture transform used by the final Ground Glass
 * composite.
 *
 * The pre-composite RTT is already a physical-film view, not an upright scene
 * reference. `configureGroundGlassCamera` points the camera along the
 * object-facing film normal and uses the physical film's up vector. That makes
 * the camera screen-right basis opposite the physical film-right basis, so the
 * RTT source U coordinate already contains the physical horizontal inversion.
 * The remaining Raw source/display difference is the bottom-origin WebGL
 * texture V coordinate versus the top-origin Ground Glass display coordinate.
 *
 * Raw therefore applies only that V correction; Upright Assist applies the
 * complementary X correction instead. At the displayed-image boundary this
 * makes Raw the physical 180-degree view of the upright scene and makes Raw
 * and Upright exact complements. Per-axis flips are self-inverse, so this same
 * contract maps displayed coordinates back to the source crop for inspection
 * windows.
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
