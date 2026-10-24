import { describe, expect, it } from "vitest";
import {
  authorizeGroundGlassPilotRetry,
  canPublishGroundGlassFrame,
  consumeGroundGlassPilotRetry,
  createGroundGlassPilotRetryState,
} from "../../render/backend/groundGlassBackendContracts";
import { selectGroundGlassBackend } from "../../render/backend/groundGlassBackendPolicy";
import type {
  GroundGlassAcceptedRequestIdentity,
  GroundGlassFrameResult,
  GroundGlassMountedChannelState,
  GroundGlassRendererGenerationIdentity,
} from "../../render/backend/groundGlassBackendContracts";
import {
  createSyntheticCompatibility,
  createVerifiedFeature,
  createWebGpuPolicyInput,
  SYNTHETIC_CHANNEL_ID,
  SYNTHETIC_PILOT_SESSION_ID,
  SYNTHETIC_SCENE_ID,
} from "./groundGlassBackendTestFixtures";

const generation = (generationId = "generation-1", channelId = "primary"):
GroundGlassRendererGenerationIdentity => ({ generationId, channelId });

const request = (
  requestId = "request-1",
  channelId = "primary",
  sceneId = SYNTHETIC_SCENE_ID,
): GroundGlassAcceptedRequestIdentity => ({ requestId, channelId, sceneId });

const completedFrame = (
  requestIdentity = request(),
  generationIdentity = generation(),
): GroundGlassFrameResult => ({
  status: "completed",
  request: requestIdentity,
  generation: generationIdentity,
  frameId: "frame-1",
  requiredOperations: "all-completed",
});

const mountedState = (
  currentRequest = request(),
  currentGeneration = generation(),
): GroundGlassMountedChannelState => ({
  mounted: true,
  latestAcceptedRequest: currentRequest,
  activeGeneration: currentGeneration,
});

describe("Ground Glass accepted request freshness", () => {
  it("allows publication only for matching request, channel, scene, generation, and successful completion", () => {
    expect(canPublishGroundGlassFrame(completedFrame(), mountedState())).toBe(true);
  });

  it("rejects a different request ID for the same scene and generation", () => {
    expect(
      canPublishGroundGlassFrame(completedFrame(request("older-request")), mountedState(request("new-request"))),
    ).toBe(false);
  });

  it("rejects a matching request from a retired renderer generation", () => {
    expect(
      canPublishGroundGlassFrame(completedFrame(request(), generation("retired-generation")), mountedState()),
    ).toBe(false);
  });

  it("rejects a result from the wrong channel or scene", () => {
    expect(canPublishGroundGlassFrame(
      completedFrame(request("request-1", "secondary"), generation("generation-1", "secondary")),
      mountedState(),
    )).toBe(false);
    expect(canPublishGroundGlassFrame(completedFrame(request("request-1", "primary", "other-scene")), mountedState())).toBe(false);
  });

  it("rejects output from an unmounted channel", () => {
    expect(canPublishGroundGlassFrame(completedFrame(), { ...mountedState(), mounted: false })).toBe(false);
  });

  it("rejects pending and failed frames as publication candidates", () => {
    const pending: GroundGlassFrameResult = {
      status: "pending",
      request: request(),
      generation: generation(),
    };
    const failed: GroundGlassFrameResult = {
      status: "failed",
      request: request(),
      generation: generation(),
      failedStage: "composite",
      failureReason: "injected pass failure",
    };

    expect(canPublishGroundGlassFrame(pending, mountedState())).toBe(false);
    expect(canPublishGroundGlassFrame(failed, mountedState())).toBe(false);
    expect(failed.status).toBe("failed");
  });

  it("rejects a completion that has not completed every required operation", () => {
    const incomplete = {
      ...completedFrame(),
      requiredOperations: "display-pending",
    } as unknown as GroundGlassFrameResult;
    expect(canPublishGroundGlassFrame(incomplete, mountedState())).toBe(false);
  });
});

const authorizedAttempt = () => {
  const input = createWebGpuPolicyInput();
  const selection = selectGroundGlassBackend(input);
  if (selection.status !== "selected" || selection.selectedBackend !== "webgpu") {
    throw new Error("Synthetic fixture must authorize a WebGPU attempt selection");
  }
  return { input, selection };
};

const consumeFailure = (
  retryState = createGroundGlassPilotRetryState(SYNTHETIC_CHANNEL_ID, SYNTHETIC_PILOT_SESSION_ID),
  stage: "initialization" | "runtime" = "initialization",
) => {
  const { selection } = authorizedAttempt();
  return consumeGroundGlassPilotRetry(
    retryState,
    selection,
    SYNTHETIC_SCENE_ID,
    stage,
    "synthetic attempt failure",
  );
};

describe("Ground Glass pilot-session retry contract", () => {
  it("consumes retry eligibility after an authorized initialization or runtime failure", () => {
    const initFailure = consumeFailure(undefined, "initialization");
    const runtimeFailure = consumeFailure(undefined, "runtime");
    expect(initFailure).toMatchObject({
      status: "consumed",
      retryState: { status: "consumed", failedSceneId: SYNTHETIC_SCENE_ID },
    });
    expect(runtimeFailure).toMatchObject({
      status: "consumed",
      retryState: { failureHistory: [{ stage: "runtime" }] },
    });
  });

  it("does not consume retry state for a WebGL selection", () => {
    const { selection } = authorizedAttempt();
    const webglSelection = selectGroundGlassBackend({
      ...createWebGpuPolicyInput(),
      requestedBackend: "webgl",
    });
    const state = createGroundGlassPilotRetryState(SYNTHETIC_CHANNEL_ID, SYNTHETIC_PILOT_SESSION_ID);
    expect(consumeGroundGlassPilotRetry(state, webglSelection, SYNTHETIC_SCENE_ID, "runtime", "error"))
      .toMatchObject({ status: "rejected", reason: "not-an-authorized-webgpu-attempt" });
    expect(selection.selectedBackend).toBe("webgpu");
    expect(state.status).toBe("available");
  });

  it("keeps the consumed latch across frame updates, resize, generation replacement, remount, and scene change", () => {
    const consumed = consumeFailure();
    if (consumed.status !== "consumed") throw new Error("Expected a consumed retry state");
    const state = consumed.retryState;
    const incidentalUpdates = [
      { kind: "focus/aperture/crop/pan", requestId: "request-after-controls" },
      { kind: "resize", requestId: "request-after-resize" },
      { kind: "generation-replacement", generationId: "generation-2" },
      { kind: "incidental-remount", generationId: "generation-after-remount" },
    ];

    for (const update of incidentalUpdates) {
      expect(state.status, update.kind).toBe("consumed");
      expect(state.failedSceneId, update.kind).toBe(SYNTHETIC_SCENE_ID);
    }

    const changedScene = selectGroundGlassBackend(createWebGpuPolicyInput({
      sceneId: "another-scene",
      sceneCompatibility: null,
      retryState: state,
    }));
    expect(changedScene.policyDecision).toMatchObject({
      status: "denied",
      reasons: expect.arrayContaining(["pilot-session-retry-consumed"]),
    });
    expect(state).not.toHaveProperty("requestId");
    expect(state).not.toHaveProperty("generationId");
  });

  it("keeps retry eligibility independent for another logical channel", () => {
    const consumed = consumeFailure();
    if (consumed.status !== "consumed") throw new Error("Expected a consumed retry state");
    const secondChannel = createWebGpuPolicyInput({
      channelId: "comparison",
      authorization: {
        status: "authorized",
        source: "application-configuration",
        pilotSessionId: "comparison-session",
      },
    });
    const selection = selectGroundGlassBackend(secondChannel);
    expect(selection).toMatchObject({ status: "selected", selectedBackend: "webgpu" });
    expect(selection.selectedBackend).not.toBe("webgl");
    expect(consumed.retryState.channelId).toBe(SYNTHETIC_CHANNEL_ID);
  });

  it("rejects a retry state borrowed from a different channel or pilot session", () => {
    const original = createWebGpuPolicyInput();
    const mismatched = selectGroundGlassBackend({
      ...original,
      channelId: "comparison",
    });
    expect(mismatched.policyDecision).toMatchObject({
      status: "denied",
      reasons: expect.arrayContaining(["retry-state-identity-mismatch"]),
    });
  });

  it("authorizes an explicit retry as a new epoch after fresh policy checks and safe cleanup", () => {
    const failure = consumeFailure();
    if (failure.status !== "consumed") throw new Error("Expected a consumed retry state");
    const result = authorizeGroundGlassPilotRetry(
      failure.retryState,
      createWebGpuPolicyInput({ retryState: failure.retryState }),
      "explicit-retry",
      "confirmed",
    );

    expect(result).toMatchObject({
      status: "authorized",
      retryState: {
        status: "explicit-retry-requested",
        retryEpoch: 1,
        resetReason: "explicit-retry",
        failedSceneId: SYNTHETIC_SCENE_ID,
        failureHistory: [{ failedSceneId: SYNTHETIC_SCENE_ID }],
      },
      selection: { selectedBackend: "webgpu" },
    });
  });

  it("allows a deliberate new pilot session and preserves prior failure history", () => {
    const failure = consumeFailure();
    if (failure.status !== "consumed") throw new Error("Expected a consumed retry state");
    const result = authorizeGroundGlassPilotRetry(
      failure.retryState,
      createWebGpuPolicyInput({
        retryState: failure.retryState,
        authorization: {
          status: "authorized",
          source: "application-configuration",
          pilotSessionId: "m1-new-session",
        },
      }),
      "new-pilot-session",
      "confirmed",
    );

    expect(result).toMatchObject({
      status: "authorized",
      retryState: {
        pilotSessionId: "m1-new-session",
        status: "explicit-retry-requested",
        resetReason: "new-pilot-session",
        failureHistory: [{ pilotSessionId: SYNTHETIC_PILOT_SESSION_ID }],
      },
    });
  });

  it("rejects an unauthorized retry reset", () => {
    const failure = consumeFailure();
    if (failure.status !== "consumed") throw new Error("Expected a consumed retry state");
    const result = authorizeGroundGlassPilotRetry(
      failure.retryState,
      createWebGpuPolicyInput({
        retryState: failure.retryState,
        authorization: { status: "unauthorized", reason: "disabled" },
      }),
      "explicit-retry",
      "confirmed",
    );
    expect(result).toMatchObject({ status: "rejected", reason: "pilot-session-identity-mismatch" });
    expect(failure.retryState.status).toBe("consumed");
  });

  it("requires fresh scene eligibility and capabilities before resetting retry eligibility", () => {
    const failure = consumeFailure();
    if (failure.status !== "consumed") throw new Error("Expected a consumed retry state");

    const missingCapability = authorizeGroundGlassPilotRetry(
      failure.retryState,
      createWebGpuPolicyInput({
        retryState: failure.retryState,
        capabilityPreflight: { webgpuAvailability: "reported-available", adapterFeatures: [], textureStorageFormats: [] },
      }),
      "explicit-retry",
      "confirmed",
    );
    expect(missingCapability).toMatchObject({
      status: "rejected",
      reason: "policy-rejected",
      policySelection: { policyDecision: { status: "denied", reasons: ["capability-preflight-failed"] } },
    });

    const missingEligibility = authorizeGroundGlassPilotRetry(
      failure.retryState,
      createWebGpuPolicyInput({ retryState: failure.retryState, sceneCompatibility: null }),
      "explicit-retry",
      "confirmed",
    );
    expect(missingEligibility).toMatchObject({
      status: "rejected",
      reason: "policy-rejected",
      policySelection: { policyDecision: { status: "denied", reasons: ["scene-ineligible"] } },
    });
  });

  it("rejects an explicit retry when verified renderer evidence is stale for the candidate revision", () => {
    const failure = consumeFailure();
    if (failure.status !== "consumed") throw new Error("Expected a consumed retry state");
    const originalState = failure.retryState;

    const result = authorizeGroundGlassPilotRetry(
      originalState,
      createWebGpuPolicyInput({
        retryState: originalState,
        expectedCandidateRendererRevision: "three-test-r187",
      }),
      "explicit-retry",
      "confirmed",
    );

    expect(result).toMatchObject({
      status: "rejected",
      reason: "policy-rejected",
      policySelection: {
        policyDecision: {
          status: "denied",
          reasons: ["scene-ineligible"],
          sceneEligibility: { status: "denied", reasons: ["renderer-revision-mismatch"] },
        },
      },
    });
    expect(originalState).toMatchObject({
      status: "consumed",
      retryEpoch: 0,
      failureHistory: [{ failedSceneId: SYNTHETIC_SCENE_ID }],
    });
  });

  it("rejects an explicit retry when verified feature evidence belongs to another scene revision", () => {
    const failure = consumeFailure();
    if (failure.status !== "consumed") throw new Error("Expected a consumed retry state");
    const originalState = failure.retryState;
    const staleSceneEvidence = createSyntheticCompatibility([
      createVerifiedFeature("raw-rtt", { sourceRevision: "scene-r1" }),
    ], SYNTHETIC_SCENE_ID, "scene-r2");

    const result = authorizeGroundGlassPilotRetry(
      originalState,
      createWebGpuPolicyInput({
        retryState: originalState,
        sceneCompatibility: staleSceneEvidence,
      }),
      "explicit-retry",
      "confirmed",
    );

    expect(result).toMatchObject({
      status: "rejected",
      reason: "policy-rejected",
      policySelection: {
        policyDecision: {
          status: "denied",
          reasons: ["scene-ineligible"],
          sceneEligibility: { status: "denied", reasons: ["feature-source-revision-mismatch"] },
        },
      },
    });
    expect(originalState).toMatchObject({
      status: "consumed",
      retryEpoch: 0,
      failureHistory: [{ failedSceneId: SYNTHETIC_SCENE_ID }],
    });
  });

  it("rejects retry when prior cleanup failed or is uncertain", () => {
    const failure = consumeFailure();
    if (failure.status !== "consumed") throw new Error("Expected a consumed retry state");
    for (const cleanup of ["failed", "uncertain"] as const) {
      expect(authorizeGroundGlassPilotRetry(
        failure.retryState,
        createWebGpuPolicyInput({ retryState: failure.retryState }),
        "explicit-retry",
        cleanup,
      )).toMatchObject({ status: "rejected", reason: "cleanup-not-confirmed" });
    }
  });

  it("consumes a failed explicit retry again rather than creating an automatic loop", () => {
    const firstFailure = consumeFailure();
    if (firstFailure.status !== "consumed") throw new Error("Expected first failure to consume retry state");
    const retry = authorizeGroundGlassPilotRetry(
      firstFailure.retryState,
      createWebGpuPolicyInput({ retryState: firstFailure.retryState }),
      "explicit-retry",
      "confirmed",
    );
    if (retry.status !== "authorized") throw new Error("Expected the explicitly authorized retry");

    const secondFailure = consumeGroundGlassPilotRetry(
      retry.retryState,
      retry.selection,
      SYNTHETIC_SCENE_ID,
      "runtime",
      "retry runtime failed",
    );
    expect(secondFailure).toMatchObject({
      status: "consumed",
      retryState: {
        status: "consumed",
        retryEpoch: 1,
        failureHistory: [
          { retryEpoch: 0, stage: "initialization" },
          { retryEpoch: 1, stage: "runtime" },
        ],
      },
    });
    if (secondFailure.status !== "consumed") throw new Error("Expected retry failure to consume the epoch");
    expect(selectGroundGlassBackend(createWebGpuPolicyInput({ retryState: secondFailure.retryState })).policyDecision)
      .toMatchObject({ status: "denied", reasons: expect.arrayContaining(["pilot-session-retry-consumed"]) });
  });
});
