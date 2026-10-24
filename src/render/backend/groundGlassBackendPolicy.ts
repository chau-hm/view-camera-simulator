import type {
  GroundGlassCapabilityRequirements,
  GroundGlassSceneCompatibility,
  GroundGlassSceneEligibility,
} from "./groundGlassSceneCompatibility";
import { resolveGroundGlassSceneEligibility } from "./groundGlassSceneCompatibility";
import type { GroundGlassPilotRetryState } from "./groundGlassBackendContracts";

export type GroundGlassEnvironment = "production" | "development" | "test";

export type GroundGlassWebGpuAuthorization =
  | Readonly<{
      status: "authorized";
      source: "application-configuration";
      pilotSessionId: string;
    }>
  | Readonly<{
      status: "unauthorized";
      reason: "not-configured" | "disabled";
    }>;

/** Reported preflight only. This evidence never claims an adapter/device was mounted. */
export type GroundGlassCapabilityPreflightEvidence = Readonly<{
  webgpuAvailability: "reported-available" | "reported-unavailable" | "unresolved";
  adapterFeatures: readonly string[] | null;
  textureStorageFormats: readonly string[] | null;
}>;

export type GroundGlassCapabilityPreflightReason =
  | "webgpu-unavailable"
  | "webgpu-availability-unresolved"
  | "adapter-features-unresolved"
  | "texture-storage-formats-unresolved"
  | "missing-required-adapter-feature"
  | "missing-required-texture-storage-format";

export type GroundGlassCapabilityPreflightResult =
  | Readonly<{ status: "not-evaluated" }>
  | Readonly<{
      status: "satisfied";
      required: GroundGlassCapabilityRequirements;
      missing: Readonly<{ adapterFeatures: readonly []; textureStorageFormats: readonly [] }>;
      unresolved: readonly [];
    }>
  | Readonly<{
      status: "denied";
      reasons: readonly GroundGlassCapabilityPreflightReason[];
      required: GroundGlassCapabilityRequirements;
      missing: Readonly<{
        adapterFeatures: readonly string[];
        textureStorageFormats: readonly string[];
      }>;
      unresolved: readonly ("webgpu-availability" | "adapter-features" | "texture-storage-formats")[];
    }>;

export type GroundGlassPolicyDenialReason =
  | "unrecognized-backend-request"
  | "production-webgpu-forbidden"
  | "environment-not-development-or-test"
  | "webgpu-authorization-required"
  | "authorization-source-not-trusted"
  | "pilot-session-id-missing"
  | "retry-state-missing"
  | "retry-state-identity-mismatch"
  | "pilot-session-retry-consumed"
  | "scene-ineligible"
  | "capability-preflight-failed";

export type GroundGlassPolicyDecision =
  | Readonly<{ status: "defaulted"; reason: "webgl-default" }>
  | Readonly<{ status: "accepted"; reason: "explicit-webgl-request" }>
  | Readonly<{
      status: "authorized";
      reason: "development-webgpu-request-authorized";
      sceneEligibility: Extract<GroundGlassSceneEligibility, { status: "eligible" }>;
      capabilityPreflight: Extract<GroundGlassCapabilityPreflightResult, { status: "satisfied" }>;
    }>
  | Readonly<{
      status: "denied";
      requestedBackend: string;
      reasons: readonly GroundGlassPolicyDenialReason[];
      sceneEligibility: GroundGlassSceneEligibility | null;
      capabilityPreflight: GroundGlassCapabilityPreflightResult;
    }>;

type GroundGlassBackendSelectionBase = Readonly<{
  requestedBackend: string | null;
}>;

export type GroundGlassBackendSelection =
  | (GroundGlassBackendSelectionBase & Readonly<{
      status: "selected";
      selectedBackend: "webgl";
      policyDecision: GroundGlassPolicyDecision;
      selectionReason:
        | "webgl-default"
        | "explicit-webgl-request"
        | "webgl-after-request-denial";
    }>)
  | (GroundGlassBackendSelectionBase & Readonly<{
      status: "selected";
      selectedBackend: "webgpu";
      policyDecision: Extract<GroundGlassPolicyDecision, { status: "authorized" }>;
      selectionReason: "authorized-development-webgpu-request";
      /** Authorization to start one attempt, not evidence that initialization or execution succeeded. */
      authorizedAttempt: Readonly<{
        channelId: string;
        pilotSessionId: string;
        sceneId: string;
        retryEpoch: number;
      }>;
    }>)
  | (GroundGlassBackendSelectionBase & Readonly<{
      status: "unavailable";
      selectedBackend: null;
      policyDecision: GroundGlassPolicyDecision;
      selectionReason: "no-valid-backend-available";
      failureReason: "webgl-unavailable-and-webgpu-not-authorized";
    }>);

export type GroundGlassBackendPolicyInput = Readonly<{
  requestedBackend: string | null;
  environment: GroundGlassEnvironment;
  authorization: GroundGlassWebGpuAuthorization;
  channelId: string;
  sceneId: string;
  requestedFeatures: readonly string[];
  sceneCompatibility: GroundGlassSceneCompatibility | null;
  capabilityPreflight: GroundGlassCapabilityPreflightEvidence;
  retryState: GroundGlassPilotRetryState | null;
  webglAvailable: boolean;
}>;

const evaluateCapabilityPreflight = (
  required: GroundGlassCapabilityRequirements,
  evidence: GroundGlassCapabilityPreflightEvidence,
): GroundGlassCapabilityPreflightResult => {
  const reasons = new Set<GroundGlassCapabilityPreflightReason>();
  const unresolved = new Set<"webgpu-availability" | "adapter-features" | "texture-storage-formats">();
  const missingAdapterFeatures: string[] = [];
  const missingTextureStorageFormats: string[] = [];

  if (evidence.webgpuAvailability === "reported-unavailable") {
    reasons.add("webgpu-unavailable");
  } else if (evidence.webgpuAvailability === "unresolved") {
    reasons.add("webgpu-availability-unresolved");
    unresolved.add("webgpu-availability");
  }

  if (required.adapterFeatures.length > 0) {
    if (evidence.adapterFeatures === null) {
      reasons.add("adapter-features-unresolved");
      unresolved.add("adapter-features");
    } else {
      missingAdapterFeatures.push(...required.adapterFeatures.filter(
        (feature) => !evidence.adapterFeatures?.includes(feature),
      ));
      if (missingAdapterFeatures.length > 0) reasons.add("missing-required-adapter-feature");
    }
  }

  if (required.textureStorageFormats.length > 0) {
    if (evidence.textureStorageFormats === null) {
      reasons.add("texture-storage-formats-unresolved");
      unresolved.add("texture-storage-formats");
    } else {
      missingTextureStorageFormats.push(...required.textureStorageFormats.filter(
        (format) => !evidence.textureStorageFormats?.includes(format),
      ));
      if (missingTextureStorageFormats.length > 0) {
        reasons.add("missing-required-texture-storage-format");
      }
    }
  }

  if (reasons.size > 0) {
    return {
      status: "denied",
      reasons: [...reasons],
      required,
      missing: {
        adapterFeatures: missingAdapterFeatures,
        textureStorageFormats: missingTextureStorageFormats,
      },
      unresolved: [...unresolved],
    };
  }

  return {
    status: "satisfied",
    required,
    missing: { adapterFeatures: [], textureStorageFormats: [] },
    unresolved: [],
  };
};

const sceneReasonsRequireDenial = (
  eligibility: GroundGlassSceneEligibility,
): boolean => eligibility.status === "denied";

/**
 * Pure Ground Glass policy. It selects a backend attempt only; it never initializes a renderer
 * or derives mounted runtime identity from browser capability evidence.
 */
export const selectGroundGlassBackend = (
  input: GroundGlassBackendPolicyInput,
): GroundGlassBackendSelection => {
  const requestedBackend = input.requestedBackend;

  if (requestedBackend === null) {
    return input.webglAvailable
      ? {
          status: "selected",
          requestedBackend,
          selectedBackend: "webgl",
          selectionReason: "webgl-default",
          policyDecision: { status: "defaulted", reason: "webgl-default" },
        }
      : {
          status: "unavailable",
          requestedBackend,
          selectedBackend: null,
          selectionReason: "no-valid-backend-available",
          failureReason: "webgl-unavailable-and-webgpu-not-authorized",
          policyDecision: { status: "defaulted", reason: "webgl-default" },
        };
  }

  if (requestedBackend === "webgl") {
    return input.webglAvailable
      ? {
          status: "selected",
          requestedBackend,
          selectedBackend: "webgl",
          selectionReason: "explicit-webgl-request",
          policyDecision: { status: "accepted", reason: "explicit-webgl-request" },
        }
      : {
          status: "unavailable",
          requestedBackend,
          selectedBackend: null,
          selectionReason: "no-valid-backend-available",
          failureReason: "webgl-unavailable-and-webgpu-not-authorized",
          policyDecision: { status: "accepted", reason: "explicit-webgl-request" },
        };
  }

  const denialReasons = new Set<GroundGlassPolicyDenialReason>();
  let sceneEligibility: GroundGlassSceneEligibility | null = null;
  let capabilityPreflight: GroundGlassCapabilityPreflightResult = { status: "not-evaluated" };

  if (requestedBackend !== "webgpu") {
    denialReasons.add("unrecognized-backend-request");
  } else {
    if (input.environment === "production") {
      denialReasons.add("production-webgpu-forbidden");
    } else if (input.environment !== "development" && input.environment !== "test") {
      denialReasons.add("environment-not-development-or-test");
    }

    if (input.authorization.status !== "authorized") {
      denialReasons.add("webgpu-authorization-required");
    } else {
      if (input.authorization.source !== "application-configuration") {
        denialReasons.add("authorization-source-not-trusted");
      }
      if (!input.authorization.pilotSessionId.trim()) {
        denialReasons.add("pilot-session-id-missing");
      }
    }

    const authorizedSessionId = input.authorization.status === "authorized" &&
        input.authorization.source === "application-configuration" &&
        input.authorization.pilotSessionId.trim().length > 0
      ? input.authorization.pilotSessionId
      : null;
    if (authorizedSessionId !== null) {
      if (!input.retryState) {
        denialReasons.add("retry-state-missing");
      } else if (
        input.retryState.channelId !== input.channelId ||
        input.retryState.pilotSessionId !== authorizedSessionId
      ) {
        denialReasons.add("retry-state-identity-mismatch");
      } else if (input.retryState.status === "consumed") {
        denialReasons.add("pilot-session-retry-consumed");
      }
    }

    sceneEligibility = resolveGroundGlassSceneEligibility(
      input.sceneId,
      input.requestedFeatures,
      input.sceneCompatibility,
    );
    if (sceneReasonsRequireDenial(sceneEligibility)) denialReasons.add("scene-ineligible");

    if (sceneEligibility.status === "eligible") {
      capabilityPreflight = evaluateCapabilityPreflight(
        sceneEligibility.requiredCapabilities,
        input.capabilityPreflight,
      );
      if (capabilityPreflight.status !== "satisfied") {
        denialReasons.add("capability-preflight-failed");
      }
    }
  }

  if (denialReasons.size === 0) {
    if (
      input.authorization.status === "authorized" &&
      input.retryState &&
      sceneEligibility?.status === "eligible" &&
      capabilityPreflight.status === "satisfied"
    ) {
      return {
        status: "selected",
        requestedBackend,
        selectedBackend: "webgpu",
        selectionReason: "authorized-development-webgpu-request",
        authorizedAttempt: {
          channelId: input.channelId,
          pilotSessionId: input.authorization.pilotSessionId,
          sceneId: input.sceneId,
          retryEpoch: input.retryState.retryEpoch,
        },
        policyDecision: {
          status: "authorized",
          reason: "development-webgpu-request-authorized",
          sceneEligibility,
          capabilityPreflight,
        },
      };
    }
    denialReasons.add("webgpu-authorization-required");
  }

  const policyDecision: GroundGlassPolicyDecision = {
    status: "denied",
    requestedBackend,
    reasons: [...denialReasons],
    sceneEligibility,
    capabilityPreflight,
  };

  return input.webglAvailable
    ? {
        status: "selected",
        requestedBackend,
        selectedBackend: "webgl",
        selectionReason: "webgl-after-request-denial",
        policyDecision,
      }
    : {
        status: "unavailable",
        requestedBackend,
        selectedBackend: null,
        selectionReason: "no-valid-backend-available",
        failureReason: "webgl-unavailable-and-webgpu-not-authorized",
        policyDecision,
      };
};

export const evaluateGroundGlassCapabilityPreflight = (
  required: GroundGlassCapabilityRequirements,
  evidence: GroundGlassCapabilityPreflightEvidence,
): GroundGlassCapabilityPreflightResult => evaluateCapabilityPreflight(required, evidence);
