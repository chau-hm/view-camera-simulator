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

/**
 * This record authorizes only the Raw scene target and its separate texture display.
 * CoC, gathers, composite, coverage, and full-presentation features remain unverified.
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
  ],
};
