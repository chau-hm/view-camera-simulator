import { selectGroundGlassBackend } from "./groundGlassBackendPolicy";
import type {
  GroundGlassBackendPolicyInput,
  GroundGlassBackendSelection,
} from "./groundGlassBackendPolicy";
import { isGroundGlassPilotRecoveryAction } from "./groundGlassBackendDiagnostics";
import type { GroundGlassRenderOperationId } from "../groundGlassPassGraph";

/** requestId versions one complete immutable render-relevant input snapshot. */
export type GroundGlassAcceptedRequestIdentity = Readonly<{
  requestId: string;
  channelId: string;
  sceneId: string;
}>;

/** A renderer generation has a separate lifetime from the accepted frame request. */
export type GroundGlassRendererGenerationIdentity = Readonly<{
  generationId: string;
  channelId: string;
}>;

export type GroundGlassMountedChannelState = Readonly<{
  mounted: boolean;
  activeGeneration: GroundGlassRendererGenerationIdentity | null;
  latestAcceptedRequest: GroundGlassAcceptedRequestIdentity | null;
}>;

export type GroundGlassFrameResult =
  | Readonly<{
      status: "pending";
      generation: GroundGlassRendererGenerationIdentity;
      request: GroundGlassAcceptedRequestIdentity;
    }>
  | Readonly<{
      status: "completed";
      generation: GroundGlassRendererGenerationIdentity;
      request: GroundGlassAcceptedRequestIdentity;
      frameId: string;
      requiredOperations: "all-completed";
    }>
  | Readonly<{
      status: "failed";
      generation: GroundGlassRendererGenerationIdentity;
      request: GroundGlassAcceptedRequestIdentity;
      failedStage: GroundGlassRenderOperationId | null;
      failureReason: string;
    }>;

const sameRequest = (
  left: GroundGlassAcceptedRequestIdentity,
  right: GroundGlassAcceptedRequestIdentity,
): boolean =>
  left.requestId === right.requestId &&
  left.channelId === right.channelId &&
  left.sceneId === right.sceneId;

const sameGeneration = (
  left: GroundGlassRendererGenerationIdentity,
  right: GroundGlassRendererGenerationIdentity,
): boolean =>
  left.generationId === right.generationId && left.channelId === right.channelId;

/** True only for a successfully completed frame matching the mounted channel's exact current identities. */
export const canPublishGroundGlassFrame = (
  frame: GroundGlassFrameResult,
  current: GroundGlassMountedChannelState,
): boolean => {
  return frame.status === "completed" &&
    frame.requiredOperations === "all-completed" &&
    matchesGroundGlassFrameIdentity(frame, current);
};

/** Matches request and generation identities for either a completed or failed frame result. */
export const matchesGroundGlassFrameIdentity = (
  frame: GroundGlassFrameResult,
  current: GroundGlassMountedChannelState,
): boolean => {
  if (!current.mounted || !current.activeGeneration || !current.latestAcceptedRequest) return false;
  return (
    frame.generation.channelId === frame.request.channelId &&
    current.activeGeneration.channelId === current.latestAcceptedRequest.channelId &&
    sameGeneration(frame.generation, current.activeGeneration) &&
    sameRequest(frame.request, current.latestAcceptedRequest)
  );
};

export type GroundGlassPilotFailureStage = "initialization" | "runtime";

/** Runtime identity captured at the host boundary where a failed attempt is accepted. */
export type GroundGlassPilotFailureContext = Readonly<{
  hostId: string;
  generation: GroundGlassRendererGenerationIdentity;
  request: GroundGlassAcceptedRequestIdentity;
  failedOperation: GroundGlassRenderOperationId | null;
}>;

export type GroundGlassPilotFailureRecord = Readonly<{
  channelId: string;
  pilotSessionId: string;
  retryEpoch: number;
  hostId: string;
  rendererGenerationId: string;
  requestId: string;
  sceneId: string;
  failedSceneId: string;
  stage: GroundGlassPilotFailureStage;
  failedOperation: GroundGlassRenderOperationId | null;
  failureReason: string;
}>;

export type GroundGlassPilotRetryResetReason =
  | "none"
  | "explicit-retry"
  | "new-pilot-session";

type GroundGlassPilotRetryStateBase = Readonly<{
  channelId: string;
  pilotSessionId: string;
  retryEpoch: number;
  /** History is retained when retry eligibility is explicitly reset. */
  failureHistory: readonly GroundGlassPilotFailureRecord[];
}>;

/**
 * A logical channel/session latch. It intentionally has no frame request or renderer-generation
 * identity, so focus, crop, resize, remount, generation replacement, and scene changes cannot reset it.
 */
export type GroundGlassPilotRetryState =
  | (GroundGlassPilotRetryStateBase & Readonly<{
      status: "available";
      resetReason: "none";
      failedSceneId: null;
      failureHistory: readonly [];
    }>)
  | (GroundGlassPilotRetryStateBase & Readonly<{
      status: "consumed";
      resetReason: GroundGlassPilotRetryResetReason;
      /** The scene where the latest authorized attempt failed. */
      failedSceneId: string;
    }>)
  | (GroundGlassPilotRetryStateBase & Readonly<{
      status: "explicit-retry-requested";
      resetReason: Exclude<GroundGlassPilotRetryResetReason, "none">;
      /** The scene from the most recent failed attempt, retained across reset. */
      failedSceneId: string;
    }>);

export const createGroundGlassPilotRetryState = (
  channelId: string,
  pilotSessionId: string,
): GroundGlassPilotRetryState => ({
  channelId,
  pilotSessionId,
  retryEpoch: 0,
  status: "available",
  resetReason: "none",
  failedSceneId: null,
  failureHistory: [],
});

export type GroundGlassRetryResetResult =
  | Readonly<{
      status: "authorized";
      retryState: GroundGlassPilotRetryState;
      selection: Extract<GroundGlassBackendSelection, { selectedBackend: "webgpu" }>;
    }>
  | Readonly<{
      status: "rejected";
      reason:
        | "retry-not-consumed"
        | "invalid-recovery-action"
        | "channel-identity-mismatch"
        | "pilot-session-identity-mismatch"
        | "cleanup-not-confirmed"
        | "policy-rejected";
      policySelection?: GroundGlassBackendSelection;
    }>;

/** Explicitly resets one session's retry latch only after cleanup and fresh policy checks pass. */
export const authorizeGroundGlassPilotRetry = (
  previous: GroundGlassPilotRetryState,
  input: GroundGlassBackendPolicyInput,
  resetReason: Exclude<GroundGlassPilotRetryResetReason, "none">,
  safePriorCleanup: "confirmed" | "failed" | "uncertain",
): GroundGlassRetryResetResult => {
  if (!isGroundGlassPilotRecoveryAction(resetReason)) {
    return { status: "rejected", reason: "invalid-recovery-action" };
  }
  if (previous.status !== "consumed") return { status: "rejected", reason: "retry-not-consumed" };
  if (input.channelId !== previous.channelId) {
    return { status: "rejected", reason: "channel-identity-mismatch" };
  }
  if (safePriorCleanup !== "confirmed") {
    return { status: "rejected", reason: "cleanup-not-confirmed" };
  }

  const authorizedPilotSessionId = input.authorization.status === "authorized"
    ? input.authorization.pilotSessionId
    : null;
  if (
    resetReason === "explicit-retry" &&
    authorizedPilotSessionId !== previous.pilotSessionId
  ) {
    return { status: "rejected", reason: "pilot-session-identity-mismatch" };
  }
  if (
    resetReason === "new-pilot-session" &&
    (!authorizedPilotSessionId || authorizedPilotSessionId === previous.pilotSessionId)
  ) {
    return { status: "rejected", reason: "pilot-session-identity-mismatch" };
  }

  const pilotSessionId = authorizedPilotSessionId ?? previous.pilotSessionId;
  const retryState: GroundGlassPilotRetryState = {
    channelId: previous.channelId,
    pilotSessionId,
    retryEpoch: previous.retryEpoch + 1,
    status: "explicit-retry-requested",
    resetReason,
    failedSceneId: previous.failedSceneId,
    failureHistory: previous.failureHistory,
  };
  const policySelection = selectGroundGlassBackend({ ...input, retryState });

  if (policySelection.status !== "selected" || policySelection.selectedBackend !== "webgpu") {
    return { status: "rejected", reason: "policy-rejected", policySelection };
  }

  return {
    status: "authorized",
    retryState,
    selection: policySelection,
  };
};

export type GroundGlassRetryConsumeResult =
  | Readonly<{ status: "consumed"; retryState: GroundGlassPilotRetryState }>
  | Readonly<{
      status: "rejected";
      reason:
        | "not-an-authorized-webgpu-attempt"
        | "retry-state-identity-mismatch"
        | "failure-identity-mismatch"
        | "retry-already-consumed";
    }>;

/** Records an authorized initialization/runtime failure against its exact channel/session/scene attempt. */
export const consumeGroundGlassPilotRetry = (
  state: GroundGlassPilotRetryState,
  selection: GroundGlassBackendSelection,
  failedSceneId: string,
  stage: GroundGlassPilotFailureStage,
  failureReason: string,
  failureContext: GroundGlassPilotFailureContext,
): GroundGlassRetryConsumeResult => {
  if (
    selection.status !== "selected" ||
    selection.selectedBackend !== "webgpu" ||
    selection.policyDecision.status !== "authorized" ||
    !selection.authorizedAttempt
  ) {
    return { status: "rejected", reason: "not-an-authorized-webgpu-attempt" };
  }
  if (state.status === "consumed") return { status: "rejected", reason: "retry-already-consumed" };

  if (
    !failureContext.hostId.trim() ||
    !failureContext.generation.generationId.trim() ||
    !failureContext.request.requestId.trim() ||
    failureContext.generation.channelId !== state.channelId ||
    failureContext.request.channelId !== state.channelId ||
    failureContext.request.sceneId !== failedSceneId
  ) {
    return { status: "rejected", reason: "failure-identity-mismatch" };
  }

  const attempt = selection.authorizedAttempt;
  if (
    state.channelId !== attempt.channelId ||
    state.pilotSessionId !== attempt.pilotSessionId ||
    state.retryEpoch !== attempt.retryEpoch ||
    failedSceneId !== attempt.sceneId
  ) {
    return { status: "rejected", reason: "retry-state-identity-mismatch" };
  }

  const failure: GroundGlassPilotFailureRecord = {
    channelId: state.channelId,
    pilotSessionId: state.pilotSessionId,
    retryEpoch: state.retryEpoch,
    hostId: failureContext.hostId,
    rendererGenerationId: failureContext.generation.generationId,
    requestId: failureContext.request.requestId,
    sceneId: failureContext.request.sceneId,
    failedSceneId,
    stage,
    failedOperation: failureContext.failedOperation,
    failureReason,
  };

  return {
    status: "consumed",
    retryState: {
      ...state,
      status: "consumed",
      failedSceneId,
      failureHistory: [...state.failureHistory, failure],
    },
  };
};
