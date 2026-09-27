import type { GroundGlassCoverageRenderState } from "./groundGlassCoverage";
import type { GroundGlassDofRenderState } from "./groundGlassDofRenderState";
import type { GroundGlassNaturalIlluminationRenderState } from "./groundGlassNaturalIllumination";

/**
 * Per-frame snapshot of Ground Glass physical effects and their render inputs.
 * It deliberately contains semantic geometry and values, never Three.js
 * uniforms, textures, storage encodings, or pass routing.
 */
export type GroundGlassPhysicalRenderState = Readonly<{
  dof: GroundGlassDofRenderState | null;
  coverage: GroundGlassCoverageRenderState;
  naturalIllumination: GroundGlassNaturalIlluminationRenderState;
  /** Relative aperture and trusted bellows-extension illumination gain. */
  relativeIlluminanceGain: number;
}>;
