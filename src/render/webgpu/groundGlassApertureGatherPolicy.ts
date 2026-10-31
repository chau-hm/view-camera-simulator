import type { GroundGlassFrameRequest, GroundGlassFrameRequestInput } from "../groundGlassFrameRequest";
import type { GroundGlassSceneCompatibility } from "../backend/groundGlassSceneCompatibility";
import { REVISION } from "three";
import { getGroundGlassDofVisualSettings } from "../groundGlassVisualSettings";
import { isGroundGlassRawWebGpuPilotRequest } from "./groundGlassRawWebGpuPolicyInput";
import {
  ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
  resolveGroundGlassRawWebGpuCompatibility,
} from "./groundGlassRawWebGpuCompatibility";
import { isGroundGlassM6PresentationRevisionMatched } from "./groundGlassPhysicalCocPolicy";
import {
  ARCHITECTURE_RISE_M6_PRESENTATION_SOURCE_REVISION,
  GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
  isGroundGlassM6CapablePilotSessionForBuild,
  isGroundGlassM6PresentationBuildEnabled,
  isGroundGlassM6PresentationRequest,
} from "./groundGlassM6PresentationPolicy";

export type GroundGlassApertureGatherQualityMode =
  | "full32"
  | "full64"
  | "half16"
  | "half32"
  | "half64";

export type GroundGlassApertureGatherSettings = Readonly<{
  qualityMode: GroundGlassApertureGatherQualityMode;
  gatherScale: 0.5 | 1;
  sampleCount: 16 | 32 | 64;
  maximumRadiusPx: number;
}>;

export type GroundGlassApertureGatherResearchEligibility =
  | Readonly<{ status: "eligible" }>
  | Readonly<{ status: "disabled" | "unsupported"; reason: string }>;

export type GroundGlassApertureGatherEligibilityInput = Readonly<{
  request: GroundGlassFrameRequest;
  runtime: Readonly<{
    rendererFamily: "webgpu-renderer" | "unknown";
    actualExecutionApi: "webgpu" | "webgl2" | "unknown";
  }>;
  physicalStatus: "completed" | "disabled" | "ready" | "unsupported" | "failed";
  physicalRequestId: string | null;
  compatibility?: GroundGlassSceneCompatibility;
  expectedRendererRevision: string | null;
  qualificationHarnessAuthorized?: boolean;
}>;

export type GroundGlassApertureGatherFormatEligibilityInput = Readonly<{
  observedFormats: Readonly<{
    sourceColor: string | null;
    depth: string | null;
    physical: string | null;
    validity: string | null;
    far: string | null;
    near: string | null;
    b1: string | null;
    composite: string | null;
    provenance: string | null;
    decisions: string | null;
  }>;
}>;

export type GroundGlassApertureGatherR187QualificationBuildFlags = Readonly<{
  developmentBuild: boolean;
  rawPilotFlag: string | undefined;
  physicalCocResearchFlag: string | undefined;
  apertureGatherResearchFlag: string | undefined;
  testSeamFlag: string | undefined;
  qualificationFlag: string | undefined;
}>;

/** r187 qualification gathers evidence only; this does not authorize renderer selection. */
export const isGroundGlassApertureGatherR187QualificationBuildAuthorizedForFlags = (
  flags: GroundGlassApertureGatherR187QualificationBuildFlags,
  rendererRevision: string,
): boolean => flags.developmentBuild &&
  rendererRevision === "187" &&
  flags.rawPilotFlag === "true" &&
  flags.physicalCocResearchFlag === "true" &&
  flags.apertureGatherResearchFlag === "true" &&
  flags.testSeamFlag === "true" &&
  flags.qualificationFlag === "true";

const apertureGatherQualificationBuildFlags = (): GroundGlassApertureGatherR187QualificationBuildFlags => ({
  developmentBuild: import.meta.env.DEV,
  rawPilotFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT,
  physicalCocResearchFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH,
  apertureGatherResearchFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH,
  testSeamFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM,
  qualificationFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_APERTURE_GATHER_R187_QUALIFICATION,
});

export const isGroundGlassApertureGatherR187QualificationHarnessEnabled = (
  request: GroundGlassFrameRequestInput,
): boolean => isGroundGlassRawWebGpuPilotRequest(request) &&
  isGroundGlassApertureGatherR187QualificationBuildAuthorizedForFlags(
    apertureGatherQualificationBuildFlags(),
    REVISION,
  );

/** Matches all required revision-bound research records without authorizing a backend attempt. */
export const isGroundGlassApertureGatherResearchEvidenceRevisionMatched = (
  compatibility: GroundGlassSceneCompatibility | null,
  rendererRevision: string,
): boolean => {
  if (compatibility?.sceneId !== "architecture-rise"
      || compatibility.sourceRevision !== ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION) return false;
  for (const featureName of ["physical-coc", "aperture-gather", "far-reconstruction-b1"] as const) {
    const matches = compatibility.features.filter((feature) => feature.feature === featureName);
    if (matches.length !== 1) return false;
    const [feature] = matches;
    if (feature.status !== "research-only"
        || feature.sourceRevision !== compatibility.sourceRevision
        || !feature.evidenceRevision.trim()
        || feature.testedContext.rendererFamily !== "webgpu-renderer"
        || feature.testedContext.executionApi !== "webgpu"
        || feature.testedContext.rendererRevision !== rendererRevision
        || feature.evidence.length === 0
        || feature.evidence.some((entry) => !entry.trim())) return false;
  }
  return true;
};

const isM6EvidenceRevisionMatched = (): boolean => isGroundGlassM6PresentationRevisionMatched(
  GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
  `r${REVISION}`,
);

const QUALITY: Readonly<Record<GroundGlassApertureGatherQualityMode, Omit<GroundGlassApertureGatherSettings, "maximumRadiusPx" | "qualityMode">>> = {
  full32: { gatherScale: 1, sampleCount: 32 },
  full64: { gatherScale: 1, sampleCount: 64 },
  half16: { gatherScale: 0.5, sampleCount: 16 },
  half32: { gatherScale: 0.5, sampleCount: 32 },
  half64: { gatherScale: 0.5, sampleCount: 64 },
};

/**
 * The gather experiment is separately enabled by trusted development build
 * configuration and remains nested inside the already authorized M3 Raw pilot.
 * Query parameters, storage and scene metadata cannot enable it.
 */
export const isGroundGlassApertureGatherResearchEnabled = (
  request: GroundGlassFrameRequestInput,
): boolean => {
  if (isGroundGlassM6PresentationRequest(request)) return isM6EvidenceRevisionMatched();
  if (!import.meta.env.DEV
      || import.meta.env.VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH !== "true"
      || !isGroundGlassRawWebGpuPilotRequest(request)) return false;
  if (isGroundGlassApertureGatherR187QualificationHarnessEnabled(request)) return true;
  return isGroundGlassApertureGatherResearchEvidenceRevisionMatched(
    resolveGroundGlassRawWebGpuCompatibility(`r${REVISION}`),
    `r${REVISION}`,
  );
};

/** M6-capable sessions provision M5 resources even if their first frame is Raw Debug. */
export const isGroundGlassApertureGatherResourceProvisioningEnabled = (
  request: GroundGlassFrameRequestInput,
): boolean => {
  const m6CapableSession = isGroundGlassM6CapablePilotSessionForBuild(
    request,
    isGroundGlassM6PresentationBuildEnabled(),
    "webgpu",
    "webgpu",
  );
  if (m6CapableSession) return isM6EvidenceRevisionMatched();
  return isGroundGlassApertureGatherResearchEnabled(request);
};

/**
 * M5 is a research-only downstream pass. This check binds it to the current
 * native M3/M4 request and the exact Architecture Rise research evidence; it
 * does not authorize a renderer attempt or infer mounted runtime identity.
 */
export const resolveGroundGlassApertureGatherResearchEligibility = (
  input: GroundGlassApertureGatherEligibilityInput,
): GroundGlassApertureGatherResearchEligibility => {
  const m6Request = isGroundGlassM6PresentationRequest(input.request);
  const revision = input.expectedRendererRevision?.trim();
  if (!m6Request && !isGroundGlassRawWebGpuPilotRequest(input.request)) {
    return { status: "unsupported", reason: "request-outside-architecture-rise-raw-pilot" };
  }
  if (!revision) return { status: "unsupported", reason: "candidate-renderer-revision-unresolved" };
  const compatibility = input.compatibility ?? (m6Request
    ? GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY
    : resolveGroundGlassRawWebGpuCompatibility(revision));
  if (!compatibility) return { status: "unsupported", reason: "candidate-renderer-revision-unsupported" };
  const expectedSourceRevision = m6Request
    ? ARCHITECTURE_RISE_M6_PRESENTATION_SOURCE_REVISION
    : ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION;
  if (compatibility.sceneId !== input.request.scene.id
      || compatibility.sourceRevision !== expectedSourceRevision
      || !compatibility.sourceRevision.trim()) {
    return { status: "unsupported", reason: "scene-source-compatibility-mismatch" };
  }
  for (const featureName of ["physical-coc", "aperture-gather", "far-reconstruction-b1"] as const) {
    const matches = compatibility.features.filter((feature) => feature.feature === featureName);
    if (matches.length !== 1) {
      return { status: "unsupported", reason: `${featureName}-evidence-missing-or-ambiguous` };
    }
    const [feature] = matches;
    const qualificationMayGatherWithoutM5Record = input.qualificationHarnessAuthorized === true &&
      revision === "r187" && !m6Request &&
      (featureName === "aperture-gather" || featureName === "far-reconstruction-b1");
    if (qualificationMayGatherWithoutM5Record) continue;
    const evidence = feature.status === "research-only"
      ? feature.evidence
      : feature.status === "implementation-verified"
        ? feature.verificationEvidence
        : [];
    const expectedStatus = m6Request ? "implementation-verified" : "research-only";
    if (feature.status !== expectedStatus
        || feature.sourceRevision !== compatibility.sourceRevision
        || !feature.evidenceRevision.trim()
        || !feature.testedContext.rendererRevision.trim()
        || feature.testedContext.rendererRevision !== revision
        || feature.testedContext.rendererFamily !== "webgpu-renderer"
        || feature.testedContext.executionApi !== "webgpu"
        || evidence.length === 0
        || evidence.some((entry) => !entry.trim())) {
      return { status: "unsupported", reason: `${featureName}-evidence-does-not-match-candidate` };
    }
  }
  if (input.runtime.rendererFamily !== "webgpu-renderer"
      || input.runtime.actualExecutionApi !== "webgpu") {
    return { status: "unsupported", reason: "native-webgpu-runtime-not-observed" };
  }
  if (input.physicalStatus !== "completed"
      || input.physicalRequestId !== input.request.identity.requestId) {
    return { status: "unsupported", reason: "current-m4-physical-inputs-not-completed" };
  }
  return { status: "eligible" };
};

/** Actual target formats are checked after native allocation, separately from runtime identity. */
export const resolveGroundGlassApertureGatherFormatEligibility = (
  input: GroundGlassApertureGatherFormatEligibilityInput,
): GroundGlassApertureGatherResearchEligibility => {
  const expectedFormats = {
    sourceColor: "rgba8unorm",
    depth: "depth24plus",
    physical: "rgba16float",
    validity: "rgba8unorm",
    far: "rgba16float",
    near: "rgba16float",
    b1: "rgba16float",
    composite: "rgba16float",
    provenance: "rgba32float",
    decisions: "rgba8unorm",
  } as const;
  for (const [name, expected] of Object.entries(expectedFormats)) {
    if (input.observedFormats[name as keyof typeof expectedFormats] !== expected) {
      return { status: "unsupported", reason: `${name}-format-unavailable` };
    }
  }
  return { status: "eligible" };
};

export const resolveGroundGlassApertureGatherSettings = (
  sceneId: string,
  qualityMode: GroundGlassApertureGatherQualityMode = "half32",
  radiusOverridePx?: number,
): GroundGlassApertureGatherSettings => {
  const quality = QUALITY[qualityMode];
  const maximumRadiusPx = radiusOverridePx ?? getGroundGlassDofVisualSettings(sceneId).maximumBlurRadiusPx;
  if (!Number.isFinite(maximumRadiusPx) || maximumRadiusPx <= 0 || maximumRadiusPx > 128) {
    throw new RangeError("Ground Glass aperture gather radius must be finite and in (0, 128] source pixels");
  }
  return Object.freeze({ qualityMode, ...quality, maximumRadiusPx });
};
