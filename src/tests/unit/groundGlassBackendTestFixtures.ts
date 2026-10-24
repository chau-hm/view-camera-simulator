import { createGroundGlassPilotRetryState } from "../../render/backend/groundGlassBackendContracts";
import type {
  GroundGlassBackendPolicyInput,
  GroundGlassCapabilityPreflightEvidence,
  GroundGlassWebGpuAuthorization,
} from "../../render/backend/groundGlassBackendPolicy";
import type {
  GroundGlassFeatureCompatibility,
  GroundGlassFeatureName,
  GroundGlassSceneCompatibility,
} from "../../render/backend/groundGlassSceneCompatibility";

export const SYNTHETIC_SCENE_ID = "m1-synthetic-scene";
export const SYNTHETIC_CHANNEL_ID = "primary";
export const SYNTHETIC_PILOT_SESSION_ID = "m1-synthetic-session";

export const completeCapabilityPreflight: GroundGlassCapabilityPreflightEvidence = {
  webgpuAvailability: "reported-available",
  adapterFeatures: ["float32-filterable"],
  textureStorageFormats: ["rgba16float"],
};

export const createVerifiedFeature = (
  feature: GroundGlassFeatureName = "raw-rtt",
  overrides: Partial<Extract<GroundGlassFeatureCompatibility, { status: "verified" }>> = {},
): Extract<GroundGlassFeatureCompatibility, { status: "verified" }> => ({
  feature,
  status: "verified",
  sourceRevision: "synthetic-scene-r1",
  evidenceRevision: "synthetic-verification-r1",
  testedContext: {
    rendererFamily: "webgpu-renderer",
    executionApi: "webgpu",
    rendererRevision: "three-test-r186",
    runtimeDescription: "synthetic unit-test evidence only",
  },
  verificationEvidence: ["synthetic-unit-test-evidence"],
  requiredCapabilities: {
    adapterFeatures: ["float32-filterable"],
    textureStorageFormats: ["rgba16float"],
  },
  knownIncompatibilities: [],
  ...overrides,
});

export const createSyntheticCompatibility = (
  features: readonly GroundGlassFeatureCompatibility[] = [createVerifiedFeature()],
  sceneId = SYNTHETIC_SCENE_ID,
  sourceRevision = "synthetic-scene-r1",
): GroundGlassSceneCompatibility => ({
  sceneId,
  sourceRevision,
  features,
});

const defaultAuthorization: GroundGlassWebGpuAuthorization = {
  status: "authorized",
  source: "application-configuration",
  pilotSessionId: SYNTHETIC_PILOT_SESSION_ID,
};

export const createWebGpuPolicyInput = (
  overrides: Partial<GroundGlassBackendPolicyInput> = {},
): GroundGlassBackendPolicyInput => {
  const base: GroundGlassBackendPolicyInput = {
    requestedBackend: "webgpu",
    environment: "development",
    authorization: defaultAuthorization,
    channelId: SYNTHETIC_CHANNEL_ID,
    sceneId: SYNTHETIC_SCENE_ID,
    requestedFeatures: ["raw-rtt"],
    sceneCompatibility: createSyntheticCompatibility(),
    expectedCandidateRendererRevision: "three-test-r186",
    capabilityPreflight: completeCapabilityPreflight,
    retryState: createGroundGlassPilotRetryState(
      SYNTHETIC_CHANNEL_ID,
      SYNTHETIC_PILOT_SESSION_ID,
    ),
    webglAvailable: true,
  };
  const input = { ...base, ...overrides };
  if (overrides.retryState !== undefined) return input;

  const authorization = input.authorization;
  return {
    ...input,
    retryState: authorization.status === "authorized"
      ? createGroundGlassPilotRetryState(input.channelId, authorization.pilotSessionId)
      : null,
  };
};
