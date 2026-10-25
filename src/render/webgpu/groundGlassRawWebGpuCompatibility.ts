import type { GroundGlassSceneCompatibility } from "../backend/groundGlassSceneCompatibility";

/**
 * Manual scene-source revision for the narrowly verified Architecture Rise Raw RTT path.
 * Update this when any file listed in the M3 roadmap's source-binding note changes.
 */
export const ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION =
  "architecture-rise-raw-rtt-v1";

/** Verification evidence is bound to the installed r186 renderer API/runtime. */
export const ARCHITECTURE_RISE_RAW_RTT_VERIFIED_RENDERER_REVISION = "r186";

export const ARCHITECTURE_RISE_RAW_RTT_EVIDENCE_REVISION =
  "m3-architecture-rise-raw-rtt-native-v1";

/** M4 physical CoC remains research-only even after the bounded native evidence run. */
export const ARCHITECTURE_RISE_PHYSICAL_COC_EVIDENCE_REVISION =
  "m4-architecture-rise-physical-coc-native-v1";

/**
 * This record authorizes only the Raw scene target and its separate texture display.
 * M4 physical CoC is recorded as research-only and cannot authorize a renderer attempt.
 * Gathers, composite, coverage, and full-presentation features remain unverified.
 */
export const GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY: GroundGlassSceneCompatibility = {
  sceneId: "architecture-rise",
  sourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
  features: [
    {
      feature: "raw-rtt",
      status: "verified",
      sourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
      evidenceRevision: ARCHITECTURE_RISE_RAW_RTT_EVIDENCE_REVISION,
      testedContext: {
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
        rendererRevision: ARCHITECTURE_RISE_RAW_RTT_VERIFIED_RENDERER_REVISION,
        runtimeDescription: "Three.js r186 WebGPURenderer native WebGPU backend",
      },
      verificationEvidence: [
        "native-required Architecture Rise Ground Glass host browser integration",
        "canonical off-axis camera and registered RTT subject raster validation",
        "Raw/Upright orientation, asymmetric landmarks, crop, resize, and cleanup validation",
      ],
      requiredCapabilities: {
        adapterFeatures: [],
        textureStorageFormats: [],
      },
      knownIncompatibilities: [],
    },
    {
      feature: "physical-coc",
      status: "research-only",
      sourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
      evidenceRevision: ARCHITECTURE_RISE_PHYSICAL_COC_EVIDENCE_REVISION,
      testedContext: {
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
        rendererRevision: ARCHITECTURE_RISE_RAW_RTT_VERIFIED_RENDERER_REVISION,
        runtimeDescription: "Three.js r186 native WebGPU M4 development research pass",
      },
      evidence: [
        "native-required Architecture Rise application adapter depth reconstruction and RGBA16F/RGBA8 targets",
        "independent near, far, off-axis, asymmetric, and clear-background scene probes compared with canonical CPU optics",
        "controlled U=f boundary vectors evaluated by the same M4 TSL kernel and compared with computePhysicalBlurFootprint",
        "focus, aperture, rise, crop, resize, and confirmed SPA cleanup/remount lifecycle validation",
      ],
      requiredCapabilities: {
        adapterFeatures: [],
        textureStorageFormats: ["depth24plus", "rgba16float", "rgba8unorm"],
      },
      knownIncompatibilities: [],
    },
  ],
};
