import {
  authorizeGroundGlassPilotRetry,
  canPublishGroundGlassFrame,
  consumeGroundGlassPilotRetry,
  createGroundGlassPilotRetryState,
  type GroundGlassFrameResult,
  type GroundGlassPilotFailureStage,
  type GroundGlassPilotRetryResetReason,
  type GroundGlassPilotRetryState,
  type GroundGlassRendererGenerationIdentity,
} from "./backend/groundGlassBackendContracts";
import type {
  GroundGlassBackendDiagnostics,
  GroundGlassBackendDiagnosticDetails,
  GroundGlassApplicationFallbackEvidence,
  GroundGlassCleanupEvidence,
  GroundGlassMountedRuntimeEvidence,
} from "./backend/groundGlassBackendDiagnostics";
import {
  selectGroundGlassBackend,
  type GroundGlassBackendPolicyInput,
  type GroundGlassBackendSelection,
  type GroundGlassWebGpuAuthorization,
} from "./backend/groundGlassBackendPolicy";
import type { GroundGlassFrameRequest, GroundGlassFrameRequestInput } from "./groundGlassFrameRequest";
import {
  createGroundGlassFrameRequest,
  createGroundGlassFrameRequestFingerprint,
  createGroundGlassSceneFingerprint,
} from "./groundGlassFrameRequest";
import type { GroundGlassRttChannel } from "./groundGlassRttDimensions";
import type { GroundGlassCleanupOutcome } from "./groundGlassCleanupEvidence";
import type { GroundGlassRenderOperationId } from "./groundGlassPassGraph";

export type { GroundGlassCleanupOutcome } from "./groundGlassCleanupEvidence";

export type GroundGlassRenderHostChannelState = Readonly<{
  channelId: GroundGlassRttChannel;
  activeHostId: string | null;
  pendingHostId: string | null;
  activeGeneration: GroundGlassRendererGenerationIdentity | null;
  retiringGeneration: GroundGlassRendererGenerationIdentity | null;
  lastCleanupGeneration: GroundGlassRendererGenerationIdentity | null;
  mounted: boolean;
  adapterStarted: boolean;
  cleanupStatus: "none" | "pending" | GroundGlassCleanupOutcome;
  cleanupFailureReason: string | null;
  runtimeOwnerId: string | null;
  latestRequest: GroundGlassFrameRequest | null;
  /** Request owned by the active host and executable by its current generation. */
  activeRequest: GroundGlassFrameRequest | null;
  activeRequestFingerprint: string | null;
  activeSceneFingerprint: string | null;
  /** Latest request intent accepted by the pending replacement host. */
  pendingRequest: GroundGlassFrameRequest | null;
  pendingRequestFingerprint: string | null;
  pendingSceneFingerprint: string | null;
  pendingSelection: GroundGlassBackendSelection | null;
  pendingPolicyInput: GroundGlassBackendPolicyInput | null;
  requestFingerprint: string | null;
  sceneFingerprint: string | null;
  selection: GroundGlassBackendSelection | null;
  activePolicyInput: GroundGlassBackendPolicyInput | null;
  attemptedBackend: GroundGlassBackendDiagnostics["attemptedBackend"];
  mountedRuntime: GroundGlassMountedRuntimeEvidence;
  backendDetails: GroundGlassBackendDiagnosticDetails | null;
  applicationFallback: GroundGlassApplicationFallbackEvidence;
  fallbackCause: Readonly<{
    stage: GroundGlassPilotFailureStage;
    reason: string;
  }> | null;
  lastFailure: GroundGlassBackendDiagnostics["lastFailure"];
  lifecycleStatus: GroundGlassBackendDiagnostics["lifecycleStatus"];
  frame: GroundGlassBackendDiagnostics["frame"];
  retryState: GroundGlassPilotRetryState | null;
}>;

const unknownRuntime: GroundGlassMountedRuntimeEvidence = { status: "unknown" };

const emptyChannelState = (channelId: GroundGlassRttChannel): GroundGlassRenderHostChannelState => ({
  channelId,
  activeHostId: null,
  pendingHostId: null,
  activeGeneration: null,
  retiringGeneration: null,
  lastCleanupGeneration: null,
  mounted: false,
  adapterStarted: false,
  cleanupStatus: "none",
  cleanupFailureReason: null,
  runtimeOwnerId: null,
  latestRequest: null,
  activeRequest: null,
  activeRequestFingerprint: null,
  activeSceneFingerprint: null,
  pendingRequest: null,
  pendingRequestFingerprint: null,
  pendingSceneFingerprint: null,
  pendingSelection: null,
  pendingPolicyInput: null,
  requestFingerprint: null,
  sceneFingerprint: null,
  selection: null,
  activePolicyInput: null,
  attemptedBackend: { status: "not-started" },
  mountedRuntime: unknownRuntime,
  backendDetails: null,
  applicationFallback: { status: "not-observed" },
  fallbackCause: null,
  lastFailure: null,
  lifecycleStatus: "idle",
  frame: { current: null, lastSuccessfullyCompleted: null },
  retryState: null,
});

const sameRequestResult = (left: GroundGlassFrameResult, right: GroundGlassFrameResult): boolean =>
  left.status === right.status &&
  left.generation.generationId === right.generation.generationId &&
  left.request.requestId === right.request.requestId &&
  (left.status !== "completed" || (right.status === "completed" && left.frameId === right.frameId));

const createDefaultWebGlSelection = (
  channelId: GroundGlassRttChannel,
  sceneId: string,
): GroundGlassBackendSelection => selectGroundGlassBackend({
  requestedBackend: null,
  environment: "production",
  authorization: { status: "unauthorized", reason: "not-configured" },
  channelId,
  sceneId,
  requestedFeatures: [],
  sceneCompatibility: null,
  expectedCandidateRendererRevision: null,
  capabilityPreflight: {
    webgpuAvailability: "unresolved",
    adapterFeatures: null,
    textureStorageFormats: null,
  },
  retryState: null,
  // This selects the configured WebGL attempt; mounted runtime evidence is reported separately.
  webglAvailable: true,
});

const samePolicySelection = (
  left: GroundGlassBackendSelection | null,
  right: GroundGlassBackendSelection,
): boolean => left !== null && JSON.stringify(left) === JSON.stringify(right);

const samePolicyInput = (
  left: GroundGlassBackendPolicyInput | null,
  right: GroundGlassBackendPolicyInput | null,
): boolean => left === right || (
  left !== null && right !== null && JSON.stringify(left) === JSON.stringify(right)
);

const selectPolicyForState = (
  channelId: GroundGlassRttChannel,
  sceneId: string,
  policyInput: GroundGlassBackendPolicyInput | null,
  retryState: GroundGlassPilotRetryState | null,
): GroundGlassBackendSelection => policyInput
  ? selectGroundGlassBackend({ ...policyInput, retryState })
  : createDefaultWebGlSelection(channelId, sceneId);

/**
 * App-lifetime owner for channel request/generation identities and pilot-session retry state.
 * It contains no renderer objects and is provided above RouterProvider so route remounts cannot
 * silently reset channel/session authority.
 */
export class GroundGlassRenderHostState {
  private readonly instanceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  private requestSequence = 0;
  private generationSequence = 0;
  private readonly states = new Map<GroundGlassRttChannel, GroundGlassRenderHostChannelState>();
  private readonly listeners = new Map<GroundGlassRttChannel, Set<() => void>>();
  private readonly diagnosticsByState = new WeakMap<
    GroundGlassRenderHostChannelState,
    GroundGlassBackendDiagnostics | null
  >();

  getSnapshot = (channel: GroundGlassRttChannel): GroundGlassRenderHostChannelState => {
    const state = this.states.get(channel);
    if (state) return state;
    const initial = emptyChannelState(channel);
    this.states.set(channel, initial);
    return initial;
  };

  subscribe = (channel: GroundGlassRttChannel, listener: () => void): (() => void) => {
    const channelListeners = this.listeners.get(channel) ?? new Set<() => void>();
    channelListeners.add(listener);
    this.listeners.set(channel, channelListeners);
    return () => {
      channelListeners.delete(listener);
      if (channelListeners.size === 0) this.listeners.delete(channel);
    };
  };

  private update(
    channel: GroundGlassRttChannel,
    updater: (current: GroundGlassRenderHostChannelState) => GroundGlassRenderHostChannelState,
  ): GroundGlassRenderHostChannelState {
    const current = this.getSnapshot(channel);
    const next = updater(current);
    if (next === current) return current;
    this.states.set(channel, next);
    this.listeners.get(channel)?.forEach((listener) => listener());
    return next;
  }

  private allocateGeneration(channel: GroundGlassRttChannel): GroundGlassRendererGenerationIdentity {
    this.generationSequence += 1;
    return Object.freeze({
      generationId: `gg-${this.instanceId}-${channel}-generation-${this.generationSequence}`,
      channelId: channel,
    });
  }

  private activateHost(
    state: GroundGlassRenderHostChannelState,
    hostId: string,
  ): GroundGlassRenderHostChannelState {
    const activatingPendingHost = state.pendingHostId === hostId;
    const acceptedRequest = activatingPendingHost ? state.pendingRequest : null;
    const policyInput = activatingPendingHost ? state.pendingPolicyInput : null;
    const selection = acceptedRequest
      ? selectPolicyForState(state.channelId, acceptedRequest.scene.id, policyInput, state.retryState)
      : null;
    const selectedBackend = selection?.status === "selected" ? selection.selectedBackend : null;
    const generation = selectedBackend === null ? null : this.allocateGeneration(state.channelId);
    return {
      ...state,
      activeHostId: hostId,
      pendingHostId: null,
      activeGeneration: generation,
      retiringGeneration: null,
      mounted: false,
      adapterStarted: false,
      cleanupStatus: "none",
      cleanupFailureReason: null,
      runtimeOwnerId: null,
      latestRequest: acceptedRequest ?? state.latestRequest,
      activeRequest: acceptedRequest,
      activeRequestFingerprint: activatingPendingHost ? state.pendingRequestFingerprint : null,
      activeSceneFingerprint: activatingPendingHost ? state.pendingSceneFingerprint : null,
      pendingRequest: null,
      pendingRequestFingerprint: null,
      pendingSceneFingerprint: null,
      pendingSelection: null,
      pendingPolicyInput: null,
      requestFingerprint: acceptedRequest
        ? state.pendingRequestFingerprint
        : state.requestFingerprint,
      sceneFingerprint: acceptedRequest
        ? state.pendingSceneFingerprint
        : state.sceneFingerprint,
      selection: acceptedRequest
        ? selection
        : null,
      activePolicyInput: acceptedRequest ? policyInput : null,
      attemptedBackend: { status: "not-started" },
      mountedRuntime: unknownRuntime,
      backendDetails: null,
      lifecycleStatus: !acceptedRequest
        ? "idle"
        : selection?.status !== "selected" || selectedBackend === null
          ? "unavailable"
          : "initializing",
      frame: {
        current: acceptedRequest && generation
          ? { status: "pending", generation, request: acceptedRequest.identity }
          : null,
        lastSuccessfullyCompleted: state.frame.lastSuccessfullyCompleted,
      },
    };
  }

  attachHost = (channel: GroundGlassRttChannel, hostId: string): void => {
    this.update(channel, (state) => {
      if (state.activeHostId === hostId || state.pendingHostId === hostId) return state;
      if (
        state.activeHostId === null &&
        state.retiringGeneration === null &&
        state.cleanupStatus !== "failed" &&
        state.cleanupStatus !== "uncertain"
      ) {
        return this.activateHost(state, hostId);
      }
      if (state.pendingHostId !== null) return state;
      return { ...state, pendingHostId: hostId };
    });
  };

  acceptRequest = (
    channel: GroundGlassRttChannel,
    hostId: string,
    input: GroundGlassFrameRequestInput,
    policyInput: GroundGlassBackendPolicyInput | null = null,
  ): void => {
    let shouldFinishUnstartedRetirement = false;
    this.update(channel, (state) => {
      if (state.activeHostId !== hostId && state.pendingHostId !== hostId) return state;
      const selection = selectPolicyForState(channel, input.scene.id, policyInput, state.retryState);
      const fingerprint = createGroundGlassFrameRequestFingerprint(input);
      const acceptedByActiveHost = state.activeHostId === hostId;
      const priorRequest = acceptedByActiveHost ? state.activeRequest : state.pendingRequest;
      const priorFingerprint = acceptedByActiveHost
        ? state.activeRequestFingerprint
        : state.pendingRequestFingerprint;
      const priorPolicyInput = acceptedByActiveHost ? state.activePolicyInput : state.pendingPolicyInput;
      const priorSelection = acceptedByActiveHost ? state.selection : state.pendingSelection;
      const sameFrameRequest = priorFingerprint === fingerprint && priorRequest !== null;
      const sameSelection = samePolicySelection(priorSelection, selection);
      const samePolicy = samePolicyInput(priorPolicyInput, policyInput);
      if (sameFrameRequest && sameSelection && samePolicy) return state;

      const request = sameFrameRequest
        ? priorRequest
        : (() => {
            this.requestSequence += 1;
            const identity = Object.freeze({
              requestId: `gg-${this.instanceId}-${channel}-request-${this.requestSequence}`,
              channelId: channel,
              sceneId: input.scene.id,
            });
            const sceneFingerprint = createGroundGlassSceneFingerprint(input.scene);
            // Frame updates reuse the stable scene snapshot while its Ground Glass identity/bounds
            // remain unchanged. Policy-only updates reuse the entire accepted request identity.
            const priorSceneFingerprint = acceptedByActiveHost
              ? state.activeSceneFingerprint
              : state.pendingSceneFingerprint;
            const stableSceneSnapshot = priorSceneFingerprint === sceneFingerprint
              ? priorRequest?.scene
              : undefined;
            return createGroundGlassFrameRequest(input, identity, stableSceneSnapshot);
          })();
      const sceneFingerprint = createGroundGlassSceneFingerprint(input.scene);
      if (!acceptedByActiveHost) {
        return {
          ...state,
          latestRequest: request,
          requestFingerprint: fingerprint,
          sceneFingerprint,
          pendingRequest: request,
          pendingRequestFingerprint: fingerprint,
          pendingSceneFingerprint: sceneFingerprint,
          pendingSelection: selection,
          pendingPolicyInput: policyInput,
        };
      }
      const activeGeneration = state.activeGeneration;
      const activeBackend = state.selection?.status === "selected"
        ? state.selection.selectedBackend
        : null;
      const requestedBackend = selection.status === "selected" ? selection.selectedBackend : null;

      if (state.activeRequest && activeGeneration && activeBackend !== requestedBackend) {
        const preserveOtherPendingHost = state.pendingHostId !== null && state.pendingHostId !== hostId;
        shouldFinishUnstartedRetirement = !state.adapterStarted;
        return {
          ...state,
          activeHostId: null,
          pendingHostId: preserveOtherPendingHost ? state.pendingHostId : hostId,
          latestRequest: preserveOtherPendingHost ? state.latestRequest : request,
          pendingRequest: preserveOtherPendingHost ? state.pendingRequest : request,
          pendingRequestFingerprint: preserveOtherPendingHost ? state.pendingRequestFingerprint : fingerprint,
          pendingSceneFingerprint: preserveOtherPendingHost ? state.pendingSceneFingerprint : sceneFingerprint,
          pendingSelection: preserveOtherPendingHost ? state.pendingSelection : selection,
          pendingPolicyInput: preserveOtherPendingHost ? state.pendingPolicyInput : policyInput,
          activeRequest: state.activeRequest,
          activeRequestFingerprint: state.activeRequestFingerprint,
          activeSceneFingerprint: state.activeSceneFingerprint,
          requestFingerprint: preserveOtherPendingHost ? state.requestFingerprint : fingerprint,
          sceneFingerprint: preserveOtherPendingHost ? state.sceneFingerprint : sceneFingerprint,
          activeGeneration: null,
          retiringGeneration: activeGeneration,
          mounted: false,
          cleanupStatus: state.adapterStarted ? "pending" : "confirmed",
          cleanupFailureReason: null,
          lifecycleStatus: "retiring",
          frame: {
            current: null,
            lastSuccessfullyCompleted: state.frame.lastSuccessfullyCompleted,
          },
          ...(!state.adapterStarted ? { mountedRuntime: unknownRuntime, backendDetails: null } : {}),
        };
      }
      if (sameFrameRequest && sameSelection && !samePolicy) {
        return { ...state, activePolicyInput: policyInput };
      }
      const activatedGeneration = !activeGeneration && selection.status === "selected"
        ? this.allocateGeneration(channel)
        : activeGeneration;
      return {
        ...state,
        latestRequest: request,
        activeRequest: request,
        activeRequestFingerprint: fingerprint,
        activeSceneFingerprint: sceneFingerprint,
        requestFingerprint: fingerprint,
        sceneFingerprint,
        selection,
        activePolicyInput: policyInput,
        activeGeneration: activatedGeneration,
        lifecycleStatus: activatedGeneration
          ? selection.status === "unavailable"
            ? "unavailable"
            : state.mounted ? "rendering" : "initializing"
          : state.retiringGeneration ? "retiring" : selection.status === "unavailable" ? "unavailable" : "idle",
        frame: {
          current: activatedGeneration
            ? { status: "pending", generation: activatedGeneration, request: request.identity }
            : null,
          lastSuccessfullyCompleted: state.frame.lastSuccessfullyCompleted,
        },
      };
    });
    if (shouldFinishUnstartedRetirement) this.finishCleanup(channel, "confirmed");
  };

  markAdapterStarted = (
    channel: GroundGlassRttChannel,
    hostId: string,
    generation: GroundGlassRendererGenerationIdentity,
  ): void => {
    this.update(channel, (state) => {
      if (
        state.activeHostId !== hostId ||
        state.activeGeneration?.generationId !== generation.generationId ||
        state.cleanupStatus === "failed" ||
        state.cleanupStatus === "uncertain"
      ) return state;
      return {
        ...state,
        adapterStarted: true,
        attemptedBackend: state.selection?.status === "selected"
          ? { status: "started", backend: state.selection.selectedBackend }
          : { status: "not-started" },
        cleanupStatus: "none",
        cleanupFailureReason: null,
        lifecycleStatus: state.lifecycleStatus === "disposed" ? "initializing" : state.lifecycleStatus,
      };
    });
  };

  reportRendererMounted = (
    channel: GroundGlassRttChannel,
    hostId: string,
    generation: GroundGlassRendererGenerationIdentity,
    actualExecutionApi: "webgl" | "webgl2",
  ): void => {
    this.update(channel, (state) => {
      if (
        state.activeHostId !== hostId ||
        state.activeGeneration?.generationId !== generation.generationId ||
        state.cleanupStatus === "failed" ||
        state.cleanupStatus === "uncertain"
      ) return state;
      return {
        ...state,
        mounted: true,
        adapterStarted: true,
        cleanupStatus: state.cleanupStatus === "confirmed" ? "none" : state.cleanupStatus,
        attemptedBackend: { status: "mounted", backend: "webgl" },
        backendDetails: null,
        applicationFallback: state.fallbackCause
          ? {
              status: "occurred",
              failedBackend: "webgpu",
              fallbackRendererFamily: "webgl-renderer",
              failureStage: state.fallbackCause.stage,
              reason: state.fallbackCause.reason,
            }
          : state.applicationFallback,
        mountedRuntime: {
          status: "mounted",
          generation,
          rendererFamily: "webgl-renderer",
          actualExecutionApi,
          internalFallback: "none",
        },
        lifecycleStatus: state.activeRequest ? "rendering" : "ready",
      };
    });
  };

  reportWebGpuRendererMounted = (
    channel: GroundGlassRttChannel,
    hostId: string,
    generation: GroundGlassRendererGenerationIdentity,
    runtime: GroundGlassMountedRuntimeEvidence,
    details: GroundGlassBackendDiagnosticDetails,
  ): void => {
    this.update(channel, (state) => {
      if (
        state.activeHostId !== hostId ||
        state.activeGeneration?.generationId !== generation.generationId ||
        runtime.status !== "mounted" ||
        runtime.generation.generationId !== generation.generationId ||
        runtime.rendererFamily !== "webgpu-renderer" ||
        details.backend !== "webgpu" ||
        state.selection?.status !== "selected" ||
        state.selection.selectedBackend !== "webgpu" ||
        state.cleanupStatus === "failed" ||
        state.cleanupStatus === "uncertain"
      ) return state;
      return {
        ...state,
        mounted: true,
        adapterStarted: true,
        attemptedBackend: { status: "mounted", backend: "webgpu" },
        mountedRuntime: runtime,
        backendDetails: details,
        lifecycleStatus: state.activeRequest ? "rendering" : "ready",
      };
    });
  };

  reportBackendDetails = (
    channel: GroundGlassRttChannel,
    hostId: string,
    generation: GroundGlassRendererGenerationIdentity,
    details: GroundGlassBackendDiagnosticDetails,
  ): void => {
    this.update(channel, (state) => {
      if (
        state.activeHostId !== hostId ||
        state.activeGeneration?.generationId !== generation.generationId ||
        state.mountedRuntime.status !== "mounted" ||
        state.mountedRuntime.generation.generationId !== generation.generationId ||
        details.backend !== "webgpu" ||
        details.requestId !== state.activeRequest?.identity.requestId ||
        details.sceneId !== state.activeRequest?.identity.sceneId
      ) return state;
      return { ...state, backendDetails: details };
    });
  };

  reportAdapterFailure = (
    channel: GroundGlassRttChannel,
    hostId: string,
    generation: GroundGlassRendererGenerationIdentity,
    failureReason: string,
    explicitStage?: GroundGlassPilotFailureStage,
    failedPass: GroundGlassRenderOperationId | null = null,
  ): boolean => {
    let accepted = false;
    this.update(channel, (state) => {
      if (
        state.activeHostId !== hostId ||
        state.activeGeneration?.generationId !== generation.generationId ||
        state.lifecycleStatus === "failed"
      ) return state;
      accepted = true;
      const stage = explicitStage ?? (state.mounted ? "runtime" : "initialization");
      const backend = state.selection?.status === "selected"
        ? state.selection.selectedBackend
        : "webgl";
      const request = state.activeRequest;
      let retryState = state.retryState;
      if (
        backend === "webgpu" &&
        state.selection?.status === "selected" &&
        request &&
        state.retryState
      ) {
        const consumed = consumeGroundGlassPilotRetry(
          state.retryState,
          state.selection,
          request.scene.id,
          stage,
          failureReason,
        );
        if (consumed.status === "consumed") retryState = consumed.retryState;
      }
      return {
        ...state,
        attemptedBackend: {
          status: "failed",
          backend,
          stage,
          failureReason,
        },
        retryState,
        fallbackCause: backend === "webgpu" ? { stage, reason: failureReason } : state.fallbackCause,
        lastFailure: request
          ? { generation, request: request.identity, backend, stage, failedPass, reason: failureReason }
          : state.lastFailure,
        lifecycleStatus: "failed",
        frame: {
          current: request
            ? {
                status: "failed",
                generation,
                request: request.identity,
                failedStage: failedPass,
                failureReason,
              }
            : null,
          lastSuccessfullyCompleted: state.frame.lastSuccessfullyCompleted,
        },
      };
    });
    return accepted;
  };

  canReceiveRuntimeInfo = (
    channel: GroundGlassRttChannel,
    hostId: string,
    generation: GroundGlassRendererGenerationIdentity,
    requestIdentity: GroundGlassFrameRequest["identity"] | null,
    runtimeOwnerId: string,
  ): boolean => {
    if (
      !generation ||
      typeof generation.generationId !== "string" ||
      typeof generation.channelId !== "string" ||
      typeof runtimeOwnerId !== "string" ||
      !runtimeOwnerId.trim() ||
      (requestIdentity !== null && (
        typeof requestIdentity.requestId !== "string" ||
        typeof requestIdentity.channelId !== "string" ||
        typeof requestIdentity.sceneId !== "string"
      ))
    ) return false;
    const state = this.getSnapshot(channel);
    const current = state.activeHostId === hostId &&
      state.activeGeneration?.generationId === generation.generationId &&
      generation.channelId === channel &&
      state.retiringGeneration === null &&
      state.mounted &&
      (requestIdentity === null || (
        state.activeRequest?.identity.requestId === requestIdentity.requestId &&
        state.activeRequest.identity.channelId === requestIdentity.channelId &&
        state.activeRequest.identity.sceneId === requestIdentity.sceneId
      ));
    if (!current) return false;
    if (state.runtimeOwnerId && state.runtimeOwnerId !== runtimeOwnerId) return false;
    if (!state.runtimeOwnerId) {
      this.update(channel, (latest) => latest === state
        ? { ...latest, runtimeOwnerId }
        : latest);
    }
    return true;
  };

  receiveFrameResult = (
    channel: GroundGlassRttChannel,
    hostId: string,
    result: GroundGlassFrameResult,
  ): boolean => {
    let accepted = false;
    this.update(channel, (state) => {
      if (
        state.activeHostId !== hostId ||
        !state.mounted ||
        state.mountedRuntime.status !== "mounted" ||
        state.activeGeneration?.generationId !== result.generation.generationId ||
        !state.activeRequest
      ) return state;

      const mountedState = {
        mounted: true,
        activeGeneration: state.activeGeneration,
        latestAcceptedRequest: state.activeRequest.identity,
      } as const;
      if (result.status === "completed") {
        if (!canPublishGroundGlassFrame(result, mountedState)) return state;
        if (
          state.frame.current?.status === "completed" &&
          state.frame.current.generation.generationId === result.generation.generationId &&
          state.frame.current.request.requestId === result.request.requestId
        ) return state;
        accepted = true;
        return {
          ...state,
          lifecycleStatus: "ready",
          attemptedBackend: {
            status: "mounted",
            backend: state.selection?.status === "selected" ? state.selection.selectedBackend : "webgl",
          },
          frame: {
            current: result,
            lastSuccessfullyCompleted: {
              request: result.request,
              generation: result.generation,
              frameId: result.frameId,
            },
          },
        };
      }

      const matchesCurrent =
        result.generation.generationId === state.activeGeneration.generationId &&
        result.generation.channelId === channel &&
        result.request.requestId === state.activeRequest.identity.requestId &&
        result.request.channelId === channel &&
        result.request.sceneId === state.activeRequest.identity.sceneId;
      if (!matchesCurrent || result.status !== "failed") return state;
      accepted = true;
      return {
        ...state,
        lifecycleStatus: "failed",
        attemptedBackend: {
          status: "failed",
          backend: state.selection?.status === "selected" ? state.selection.selectedBackend : "webgl",
          stage: "runtime",
          failureReason: result.failureReason,
        },
        frame: {
          current: result,
          lastSuccessfullyCompleted: state.frame.lastSuccessfullyCompleted,
        },
      };
    });
    return accepted;
  };

  canPublishFrameNow = (
    channel: GroundGlassRttChannel,
    hostId: string,
    result: GroundGlassFrameResult,
  ): boolean => {
    const state = this.getSnapshot(channel);
    return state.activeHostId === hostId &&
      state.mounted &&
      state.mountedRuntime.status === "mounted" &&
      state.frame.current !== null &&
      state.activeRequest !== null &&
      sameRequestResult(state.frame.current, result) &&
      canPublishGroundGlassFrame(result, {
        mounted: true,
        activeGeneration: state.activeGeneration,
        latestAcceptedRequest: state.activeRequest.identity,
      });
  };

  requestSafeReplacement = (
    channel: GroundGlassRttChannel,
    hostId: string,
    replacementPolicyInput?: GroundGlassBackendPolicyInput,
  ): boolean => {
    let requested = false;
    this.update(channel, (state) => {
      const generation = state.activeGeneration;
      if (
        state.activeHostId !== hostId ||
        !generation ||
        state.retiringGeneration
      ) return state;
      requested = true;
      const preserveOtherPendingHost = state.pendingHostId !== null && state.pendingHostId !== hostId;
      const policyInput = preserveOtherPendingHost
        ? state.pendingPolicyInput
        : replacementPolicyInput ?? state.activePolicyInput;
      const selection = state.activeRequest
        ? selectPolicyForState(channel, state.activeRequest.scene.id, policyInput, state.retryState)
        : state.selection;
      return {
        ...state,
        activeHostId: null,
        pendingHostId: preserveOtherPendingHost ? state.pendingHostId : hostId,
        latestRequest: preserveOtherPendingHost ? state.latestRequest : state.activeRequest,
        pendingRequest: preserveOtherPendingHost ? state.pendingRequest : state.activeRequest,
        pendingRequestFingerprint: preserveOtherPendingHost ? state.pendingRequestFingerprint : state.activeRequestFingerprint,
        pendingSceneFingerprint: preserveOtherPendingHost ? state.pendingSceneFingerprint : state.activeSceneFingerprint,
        pendingSelection: preserveOtherPendingHost ? state.pendingSelection : selection,
        pendingPolicyInput: policyInput,
        activeGeneration: null,
        retiringGeneration: generation,
        mounted: false,
        cleanupStatus: state.adapterStarted
          ? "pending"
          : state.cleanupStatus === "failed" || state.cleanupStatus === "uncertain"
            ? state.cleanupStatus
            : "confirmed",
        lifecycleStatus: "retiring",
        frame: {
          current: null,
          lastSuccessfullyCompleted: state.frame.lastSuccessfullyCompleted,
        },
        ...(state.adapterStarted ? {} : { mountedRuntime: unknownRuntime, backendDetails: null }),
      };
    });
    if (requested && !this.getSnapshot(channel).adapterStarted) {
      const cleanupStatus = this.getSnapshot(channel).cleanupStatus;
      this.finishCleanup(
        channel,
        cleanupStatus === "failed" || cleanupStatus === "uncertain" ? cleanupStatus : "confirmed",
      );
    }
    return requested;
  };

  detachHost = (channel: GroundGlassRttChannel, hostId: string): void => {
    const stateBefore = this.getSnapshot(channel);
    if (stateBefore.pendingHostId === hostId && stateBefore.activeHostId !== hostId) {
      this.update(channel, (state) => ({
        ...state,
        pendingHostId: null,
        pendingRequest: null,
        pendingRequestFingerprint: null,
        pendingSceneFingerprint: null,
        pendingSelection: null,
        pendingPolicyInput: null,
        latestRequest: state.activeRequest ?? state.latestRequest,
        requestFingerprint: state.activeRequestFingerprint ?? state.requestFingerprint,
        sceneFingerprint: state.activeSceneFingerprint ?? state.sceneFingerprint,
      }));
      return;
    }
    this.update(channel, (state) => {
      if (state.activeHostId !== hostId) return state;
      const generation = state.activeGeneration;
      if (!generation) {
        return { ...state, activeHostId: null, mounted: false, lifecycleStatus: "disposed" };
      }
      return {
        ...state,
        activeHostId: null,
        activeGeneration: null,
        retiringGeneration: generation,
        mounted: false,
        cleanupStatus: state.adapterStarted
          ? "pending"
          : state.cleanupStatus === "failed" || state.cleanupStatus === "uncertain"
            ? state.cleanupStatus
            : "confirmed",
        lifecycleStatus: "retiring",
        frame: {
          current: null,
          lastSuccessfullyCompleted: state.frame.lastSuccessfullyCompleted,
        },
        ...(state.adapterStarted ? {} : { mountedRuntime: unknownRuntime }),
      };
    });
    const current = this.getSnapshot(channel);
    if (current.retiringGeneration?.channelId === channel && current.cleanupStatus === "confirmed") {
      this.finishCleanup(channel, "confirmed");
    } else if (
      current.retiringGeneration?.channelId === channel &&
      (current.cleanupStatus === "failed" || current.cleanupStatus === "uncertain")
    ) {
      this.finishCleanup(channel, current.cleanupStatus);
    }
  };

  reportAdapterDisposed = (
    channel: GroundGlassRttChannel,
    generation: GroundGlassRendererGenerationIdentity,
    outcome: GroundGlassCleanupOutcome,
    reason?: string,
  ): void => {
    this.update(channel, (state) => {
      if (state.retiringGeneration?.generationId === generation.generationId) {
        const stickyOutcome = state.cleanupStatus === "failed" || state.cleanupStatus === "uncertain"
          ? state.cleanupStatus
          : outcome;
        return {
          ...state,
          cleanupStatus: stickyOutcome,
          cleanupFailureReason: state.cleanupFailureReason ?? reason ?? null,
        };
      }
      if (state.activeGeneration?.generationId === generation.generationId) {
        const stickyOutcome = state.cleanupStatus === "failed" || state.cleanupStatus === "uncertain"
          ? state.cleanupStatus
          : outcome;
        return {
          ...state,
          cleanupStatus: stickyOutcome,
          cleanupFailureReason: state.cleanupFailureReason ?? reason ?? null,
          adapterStarted: false,
          mounted: false,
          runtimeOwnerId: null,
          mountedRuntime: unknownRuntime,
          backendDetails: null,
          lifecycleStatus: state.lifecycleStatus === "failed"
            ? "failed"
            : stickyOutcome === "confirmed" ? "disposed" : "unavailable",
        };
      }
      return state;
    });
    const state = this.getSnapshot(channel);
    if (state.retiringGeneration?.generationId === generation.generationId) {
      const finalOutcome = state.cleanupStatus === "failed" || state.cleanupStatus === "uncertain"
        ? state.cleanupStatus
        : outcome;
      this.finishCleanup(channel, finalOutcome);
    }
  };

  private finishCleanup(channel: GroundGlassRttChannel, outcome: GroundGlassCleanupOutcome): void {
    this.update(channel, (state) => {
      if (!state.retiringGeneration) return state;
      const finalOutcome = state.cleanupStatus === "failed" || state.cleanupStatus === "uncertain"
        ? state.cleanupStatus
        : outcome;
      if (finalOutcome !== "confirmed") {
        return {
          ...state,
          cleanupStatus: finalOutcome,
          cleanupFailureReason: state.cleanupFailureReason ?? (finalOutcome === "failed"
            ? "owned-resource-disposal-failed"
            : "adapter-cleanup-not-confirmed"),
          mounted: false,
          mountedRuntime: unknownRuntime,
          backendDetails: null,
          lifecycleStatus: "unavailable",
        };
      }
      const cleaned = {
        ...state,
        activeHostId: null,
        activeGeneration: null,
        lastCleanupGeneration: state.retiringGeneration,
        retiringGeneration: null,
        mounted: false,
        adapterStarted: false,
        cleanupStatus: "confirmed" as const,
        cleanupFailureReason: null,
        runtimeOwnerId: null,
        activePolicyInput: null,
        activeRequest: state.pendingHostId ? state.activeRequest : null,
        activeRequestFingerprint: state.pendingHostId ? state.activeRequestFingerprint : null,
        activeSceneFingerprint: state.pendingHostId ? state.activeSceneFingerprint : null,
        mountedRuntime: unknownRuntime,
        backendDetails: null,
        lifecycleStatus: "disposed" as const,
      };
      return state.pendingHostId ? this.activateHost(cleaned, state.pendingHostId) : cleaned;
    });
  }

  beginPilotSession = (
    channel: GroundGlassRttChannel,
    authorization: GroundGlassWebGpuAuthorization,
  ): boolean => {
    if (authorization.status !== "authorized" || !authorization.pilotSessionId.trim()) return false;
    if (this.getSnapshot(channel).retryState !== null) return false;
    this.update(channel, (state) => ({
      ...state,
      retryState: createGroundGlassPilotRetryState(channel, authorization.pilotSessionId),
    }));
    return true;
  };

  recordPilotAttemptFailure = (
    channel: GroundGlassRttChannel,
    selection: GroundGlassBackendSelection,
    sceneId: string,
    stage: GroundGlassPilotFailureStage,
    reason: string,
  ): boolean => {
    let consumed = false;
    this.update(channel, (state) => {
      if (!state.retryState) return state;
      const result = consumeGroundGlassPilotRetry(state.retryState, selection, sceneId, stage, reason);
      if (result.status !== "consumed") return state;
      consumed = true;
      return { ...state, retryState: result.retryState };
    });
    return consumed;
  };

  authorizePilotRetry = (
    channel: GroundGlassRttChannel,
    input: GroundGlassBackendPolicyInput,
    resetReason: Exclude<GroundGlassPilotRetryResetReason, "none">,
  ) => {
    const state = this.getSnapshot(channel);
    if (!state.retryState) return { status: "rejected", reason: "retry-not-consumed" } as const;
    const cleanup = state.cleanupStatus === "confirmed" || (
      state.cleanupStatus === "none" &&
      state.lifecycleStatus !== "failed" &&
      state.retiringGeneration === null &&
      state.lastCleanupGeneration !== null
    )
      ? "confirmed"
      : state.cleanupStatus === "failed" ? "failed" : "uncertain";
    const result = authorizeGroundGlassPilotRetry(state.retryState, input, resetReason, cleanup);
    if (result.status === "authorized") {
      this.update(channel, (current) => ({ ...current, retryState: result.retryState }));
    }
    return result;
  };

  getDiagnostics = (channel: GroundGlassRttChannel): GroundGlassBackendDiagnostics | null => {
    const state = this.getSnapshot(channel);
    if (this.diagnosticsByState.has(state)) return this.diagnosticsByState.get(state) ?? null;
    // Diagnostics identify the latest accepted request even while a prior generation retires.
    // The retiring generation's last failure retains its own request identity separately.
    const request = state.latestRequest ?? state.activeRequest;
    const selection = state.selection;
    if (!request || !selection) {
      this.diagnosticsByState.set(state, null);
      return null;
    }
    const generation = state.activeGeneration ?? state.retiringGeneration;
    const cleanupGeneration = state.retiringGeneration ?? state.activeGeneration ?? state.lastCleanupGeneration;
    const cleanup: GroundGlassCleanupEvidence = state.cleanupStatus === "none"
      ? { status: "not-required" }
      : state.cleanupStatus === "pending" && cleanupGeneration
        ? { status: "pending", generation: cleanupGeneration }
        : state.cleanupStatus === "confirmed" && cleanupGeneration
          ? { status: "confirmed", generation: cleanupGeneration }
          : (state.cleanupStatus === "failed" || state.cleanupStatus === "uncertain") && cleanupGeneration
            ? {
                status: state.cleanupStatus,
                generation: cleanupGeneration,
                reason: state.cleanupStatus === "failed"
                  ? state.cleanupFailureReason ?? "owned-resource-disposal-failed"
                  : state.cleanupFailureReason ?? "adapter-cleanup-not-confirmed",
              }
            : { status: "not-required" };
    const diagnostics: GroundGlassBackendDiagnostics = {
      requestIdentity: request.identity,
      pilotSessionId: state.retryState?.pilotSessionId ?? null,
      policySelection: selection,
      attemptedBackend: state.attemptedBackend,
      mountedRuntime: state.mountedRuntime,
      applicationFallback: state.applicationFallback,
      rendererGeneration: generation,
      lifecycleStatus: state.lifecycleStatus,
      cleanup,
      frame: state.frame,
      retryState: state.retryState,
      backendDetails: state.backendDetails,
      lastFailure: state.lastFailure,
    };
    this.diagnosticsByState.set(state, diagnostics);
    return diagnostics;
  };
}
