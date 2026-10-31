import {
  resolveGroundGlassSceneEligibility,
  type GroundGlassFeatureCompatibility,
  type GroundGlassSceneCompatibility,
} from "../backend/groundGlassSceneCompatibility";

/**
 * Manual scene-source revision for the narrowly verified Architecture Rise Raw RTT path.
 * Update this when any file listed in the M3 roadmap's source-binding note changes.
 */
export const ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION =
  "architecture-rise-raw-rtt-v1";

/** Verification evidence is bound to the installed r186 renderer API/runtime. */
export const ARCHITECTURE_RISE_RAW_RTT_VERIFIED_RENDERER_REVISION = "r186";

/** Native r187 evidence is separate and qualifies only the Raw RTT feature. */
export const ARCHITECTURE_RISE_RAW_RTT_R187_VERIFIED_RENDERER_REVISION = "r187";

export const ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION =
  "m3-architecture-rise-raw-rtt-native-r187-v1";

export const ARCHITECTURE_RISE_RAW_RTT_EVIDENCE_REVISION =
  "m3-architecture-rise-raw-rtt-native-v1";

/** M4 physical CoC remains research-only even after the bounded native evidence run. */
export const ARCHITECTURE_RISE_PHYSICAL_COC_EVIDENCE_REVISION =
  "m4-architecture-rise-physical-coc-native-v1";

export const ARCHITECTURE_RISE_APERTURE_GATHER_EVIDENCE_REVISION =
  "m5-architecture-rise-aperture-gather-research-v1";

export const ARCHITECTURE_RISE_B1_RESEARCH_EVIDENCE_REVISION =
  "m5-architecture-rise-far-reconstruction-b1-research-v1";

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
    {
      feature: "aperture-gather",
      status: "research-only",
      sourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
      evidenceRevision: ARCHITECTURE_RISE_APERTURE_GATHER_EVIDENCE_REVISION,
      testedContext: {
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
        rendererRevision: ARCHITECTURE_RISE_RAW_RTT_VERIFIED_RENDERER_REVISION,
        runtimeDescription: "Three.js r186 native WebGPU M5 development research pass",
      },
      evidence: [
        "M5 adapter-owned far and near passes consume the successful current M4 physical and validity outputs",
        "research-only targets are separate from the M3 Raw display and public Ground Glass output",
      ],
      requiredCapabilities: {
        adapterFeatures: [],
        textureStorageFormats: ["rgba16float", "rgba32float", "rgba8unorm"],
      },
      knownIncompatibilities: [
        "Architecture Rise gather quality remains research-only until matched native references and edge gates are evaluated",
        "full presentation parity and production materials are not established",
      ],
    },
    {
      feature: "far-reconstruction-b1",
      status: "research-only",
      sourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
      evidenceRevision: ARCHITECTURE_RISE_B1_RESEARCH_EVIDENCE_REVISION,
      testedContext: {
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
        rendererRevision: ARCHITECTURE_RISE_RAW_RTT_VERIFIED_RENDERER_REVISION,
        runtimeDescription: "Three.js r186 native WebGPU Phase H B1 research pass",
      },
      evidence: [
        "B1 preserves GPU-observed gather selection and source-center provenance with explicit source-color fallback",
        "the independent CPU oracle is separate from the Phase I C1 neighbor-search oracle",
      ],
      requiredCapabilities: {
        adapterFeatures: [],
        textureStorageFormats: ["rgba16float", "rgba32float", "rgba8unorm"],
      },
      knownIncompatibilities: [
        "B1 quality qualification remains state-specific and incomplete until matched references and fallback-halo gates pass",
        "M5 research composition does not establish M6 presentation or production parity",
      ],
    },
  ],
};

const architectureRiseRawRttR187Feature: Extract<
  GroundGlassFeatureCompatibility,
  { status: "verified" }
> = {
  feature: "raw-rtt",
  status: "verified",
  sourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
  evidenceRevision: ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION,
  testedContext: {
    rendererFamily: "webgpu-renderer",
    executionApi: "webgpu",
    rendererRevision: ARCHITECTURE_RISE_RAW_RTT_R187_VERIFIED_RENDERER_REVISION,
    runtimeDescription: "Three.js r187 WebGPURenderer native WebGPU backend in Chrome 156 on macOS 27 arm64",
  },
  verificationEvidence: [
    "native-required r187 application-host run rendered Raw RTT on WebGPURenderer/webgpu with no internal fallback, preserved contentful output during focus/aperture changes, and confirmed cleanup on SPA scene transition",
    "native-required r187 Raw RTT fixture verified asymmetric Raw/Upright landmarks, full and off-center crop, and inspection-window source correspondence",
    "the r187 fixture verified target resize, stale-request rejection, exact resource cleanup, readback rejection, and allocation-failure disposal without publishing retired output",
  ],
  requiredCapabilities: {
    adapterFeatures: [],
    textureStorageFormats: [],
  },
  knownIncompatibilities: [],
};

/**
 * New native r187 evidence qualifies only M3 Raw RTT. Existing M4/M5 evidence remains bound
 * to r186 inside the original record and cannot be reused to authorize those research passes.
 */
export const GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY: GroundGlassSceneCompatibility = {
  ...GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY,
  features: [
    architectureRiseRawRttR187Feature,
    ...GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY.features.filter(
      (feature) => feature.feature !== "raw-rtt",
    ),
  ],
};

/** Selects renderer evidence by the installed Three.js revision; unknown revisions fail closed. */
export const resolveGroundGlassRawWebGpuCompatibility = (
  rendererRevision: string,
): GroundGlassSceneCompatibility | null => {
  if (rendererRevision === "r186") return GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY;
  if (rendererRevision === ARCHITECTURE_RISE_RAW_RTT_R187_VERIFIED_RENDERER_REVISION) {
    return GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY;
  }
  return null;
};

/** Returns only a Raw RTT qualification whose tested renderer revision matches the request. */
export const resolveGroundGlassRawWebGpuEvidenceRevision = (
  rendererRevision: string,
): string | null => {
  const compatibility = resolveGroundGlassRawWebGpuCompatibility(rendererRevision);
  if (!compatibility) return null;
  const eligibility = resolveGroundGlassSceneEligibility(
    compatibility.sceneId,
    ["raw-rtt"],
    compatibility,
    rendererRevision,
  );
  return eligibility.status === "eligible" && eligibility.evidenceRevisions.length === 1
    ? eligibility.evidenceRevisions[0]
    : null;
};

export const requireGroundGlassRawWebGpuEvidenceRevision = (
  rendererRevision: string,
): string => {
  const evidenceRevision = resolveGroundGlassRawWebGpuEvidenceRevision(rendererRevision);
  if (!evidenceRevision) {
    throw new Error(`Ground Glass Raw RTT is not qualified for renderer ${rendererRevision}`);
  }
  return evidenceRevision;
};
