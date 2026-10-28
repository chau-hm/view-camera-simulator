import type { GroundGlassFrameRequestInput } from "../groundGlassFrameRequest";
import { isGroundGlassRawWebGpuPilotRequest } from "./groundGlassRawWebGpuPolicyInput";
import { isGroundGlassM6PresentationRequest } from "./groundGlassM6PresentationPolicy";

/**
 * M4 is a separately gated research pass inside the already-authorized M3
 * Architecture Rise Raw pilot. The flag is trusted Vite build configuration;
 * URL, storage, and scene metadata cannot activate the physical pass.
 */
export const isGroundGlassPhysicalCocResearchEnabled = (
  request: GroundGlassFrameRequestInput,
): boolean =>
  isGroundGlassM6PresentationRequest(request) || (
    import.meta.env.DEV &&
    import.meta.env.VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH === "true" &&
    isGroundGlassRawWebGpuPilotRequest(request)
  );
