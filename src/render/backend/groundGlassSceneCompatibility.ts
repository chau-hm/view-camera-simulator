export type GroundGlassFeatureName =
  | "raw-rtt"
  | "physical-coc"
  | "aperture-gather"
  | "far-reconstruction-b1"
  | "composite"
  | "full-presentation";

export type GroundGlassCapabilityRequirements = Readonly<{
  adapterFeatures: readonly string[];
  textureStorageFormats: readonly string[];
}>;

export type GroundGlassResearchRuntimeContext = Readonly<{
  rendererFamily: "webgpu-renderer";
  executionApi: "webgpu" | "webgl2" | "unknown";
  rendererRevision: string;
  runtimeDescription: string;
}>;

export type GroundGlassVerifiedRuntimeContext = Readonly<{
  rendererFamily: "webgpu-renderer";
  executionApi: "webgpu";
  rendererRevision: string;
  runtimeDescription: string;
}>;

type GroundGlassFeatureCompatibilityBase = Readonly<{
  feature: string;
  sourceRevision: string;
  knownIncompatibilities: readonly string[];
}>;

export type GroundGlassFeatureCompatibility =
  | (GroundGlassFeatureCompatibilityBase & Readonly<{
      status: "not-evaluated";
    }>)
  | (GroundGlassFeatureCompatibilityBase & Readonly<{
      status: "research-only";
      evidenceRevision: string;
      testedContext: GroundGlassResearchRuntimeContext;
      evidence: readonly string[];
      requiredCapabilities: GroundGlassCapabilityRequirements;
    }>)
  | (GroundGlassFeatureCompatibilityBase & Readonly<{
      status: "verified";
      evidenceRevision: string;
      testedContext: GroundGlassVerifiedRuntimeContext;
      verificationEvidence: readonly string[];
      requiredCapabilities: GroundGlassCapabilityRequirements;
    }>)
  | (GroundGlassFeatureCompatibilityBase & Readonly<{
      /** Development implementation is verified while optical quality remains unqualified. */
      status: "implementation-verified";
      qualityQualification: "unqualified";
      evidenceRevision: string;
      testedContext: GroundGlassVerifiedRuntimeContext;
      verificationEvidence: readonly string[];
      requiredCapabilities: GroundGlassCapabilityRequirements;
    }>);

export type GroundGlassSceneCompatibility = Readonly<{
  sceneId: string;
  /** Declared revision paired with feature evidence; M1 cannot bind it to a mounted scene. */
  sourceRevision: string;
  features: readonly GroundGlassFeatureCompatibility[];
}>;

export type GroundGlassSceneEligibilityReason =
  | "unknown-scene"
  | "scene-identity-mismatch"
  | "no-features-requested"
  | "candidate-renderer-revision-missing"
  | "scene-source-revision-missing"
  | "feature-source-revision-missing"
  | "feature-source-revision-mismatch"
  | "feature-renderer-revision-missing"
  | "renderer-revision-mismatch"
  | "unknown-feature"
  | "feature-not-declared"
  | "feature-not-evaluated"
  | "feature-research-only"
  | "feature-evidence-insufficient"
  | "feature-has-known-incompatibility"
  | "ambiguous-feature-evidence";

export type GroundGlassSceneEligibility =
  | Readonly<{
      status: "eligible";
      sceneId: string;
      requestedFeatures: readonly GroundGlassFeatureName[];
      requiredCapabilities: GroundGlassCapabilityRequirements;
      evidenceRevisions: readonly string[];
      /** Present when a development-only implementation record supports eligibility. */
      qualityQualification?: "unqualified";
    }>
  | Readonly<{
      status: "denied";
      sceneId: string;
      requestedFeatures: readonly string[];
      reasons: readonly GroundGlassSceneEligibilityReason[];
    }>;

const KNOWN_GROUND_GLASS_FEATURES: ReadonlySet<string> = new Set([
  "raw-rtt",
  "physical-coc",
  "aperture-gather",
  "far-reconstruction-b1",
  "composite",
  "full-presentation",
]);

const isGroundGlassFeatureName = (
  feature: string,
): feature is GroundGlassFeatureName => KNOWN_GROUND_GLASS_FEATURES.has(feature);

const mergeRequirements = (
  features: readonly Extract<GroundGlassFeatureCompatibility, {
    status: "verified" | "implementation-verified";
  }>[],
): GroundGlassCapabilityRequirements => ({
  adapterFeatures: [...new Set(features.flatMap((feature) =>
    feature.requiredCapabilities.adapterFeatures,
  ))],
  textureStorageFormats: [...new Set(features.flatMap((feature) =>
    feature.requiredCapabilities.textureStorageFormats,
  ))],
});

/** Checks only the exact scene and requested feature set; research fixtures never qualify. */
export const resolveGroundGlassSceneEligibility = (
  sceneId: string,
  requestedFeatures: readonly string[],
  compatibility: GroundGlassSceneCompatibility | null,
  expectedCandidateRendererRevision: string | null,
): GroundGlassSceneEligibility => {
  const reasons = new Set<GroundGlassSceneEligibilityReason>();

  if (!expectedCandidateRendererRevision?.trim()) {
    reasons.add("candidate-renderer-revision-missing");
  }

  if (!compatibility) {
    reasons.add("unknown-scene");
    return { status: "denied", sceneId, requestedFeatures: [...requestedFeatures], reasons: [...reasons] };
  }

  if (compatibility.sceneId !== sceneId) reasons.add("scene-identity-mismatch");
  if (requestedFeatures.length === 0) reasons.add("no-features-requested");

  const requestedEntries: Array<Extract<GroundGlassFeatureCompatibility, {
    status: "verified" | "implementation-verified";
  }>> = [];
  for (const requestedFeature of requestedFeatures) {
    if (!isGroundGlassFeatureName(requestedFeature)) {
      reasons.add("unknown-feature");
      continue;
    }

    const matches = compatibility.features.filter((feature) => feature.feature === requestedFeature);
    if (matches.length === 0) {
      reasons.add("feature-not-declared");
      continue;
    }
    if (matches.length > 1) {
      reasons.add("ambiguous-feature-evidence");
      continue;
    }

    const [feature] = matches;
    if (feature.status === "not-evaluated") {
      reasons.add("feature-not-evaluated");
      continue;
    }
    if (feature.status === "research-only") {
      reasons.add("feature-research-only");
      continue;
    }
    let revisionsMatch = Boolean(expectedCandidateRendererRevision?.trim());
    if (!compatibility.sourceRevision.trim()) {
      reasons.add("scene-source-revision-missing");
      revisionsMatch = false;
    }
    if (!feature.sourceRevision.trim()) {
      reasons.add("feature-source-revision-missing");
      revisionsMatch = false;
    } else if (
      compatibility.sourceRevision.trim() &&
      feature.sourceRevision !== compatibility.sourceRevision
    ) {
      reasons.add("feature-source-revision-mismatch");
      revisionsMatch = false;
    }

    if (!feature.testedContext.rendererRevision.trim()) {
      reasons.add("feature-renderer-revision-missing");
      revisionsMatch = false;
    } else if (
      expectedCandidateRendererRevision?.trim() &&
      feature.testedContext.rendererRevision !== expectedCandidateRendererRevision
    ) {
      reasons.add("renderer-revision-mismatch");
      revisionsMatch = false;
    }

    if (!revisionsMatch) continue;

    if (
      !feature.evidenceRevision.trim() ||
      !feature.testedContext.runtimeDescription.trim() ||
      feature.verificationEvidence.length === 0 ||
      feature.verificationEvidence.some((evidence) => !evidence.trim())
    ) {
      reasons.add("feature-evidence-insufficient");
      continue;
    }
    if (feature.knownIncompatibilities.length > 0) {
      reasons.add("feature-has-known-incompatibility");
      continue;
    }
    requestedEntries.push(feature);
  }

  if (reasons.size > 0) {
    return {
      status: "denied",
      sceneId,
      requestedFeatures: [...requestedFeatures],
      reasons: [...reasons],
    };
  }

  return {
    status: "eligible",
    sceneId,
    requestedFeatures: requestedEntries.map((feature) => feature.feature as GroundGlassFeatureName),
    requiredCapabilities: mergeRequirements(requestedEntries),
    evidenceRevisions: requestedEntries.map((feature) => feature.evidenceRevision),
    ...(requestedEntries.some((feature) => feature.status === "implementation-verified")
      ? { qualityQualification: "unqualified" as const }
      : {}),
  };
};
