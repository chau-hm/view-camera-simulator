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

export type GroundGlassCleanupOutcome = "confirmed" | "failed" | "uncertain";

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
  latestRequest: GroundGlassFrameRequest | null;
  requestFingerprint: string | null;
  sceneFingerprint: string | null;
  selection: GroundGlassBackendSelection | null;
  attemptedBackend: GroundGlassBackendDiagnostics["attemptedBackend"];
  mountedRuntime: GroundGlassMountedRuntimeEvidence;
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
  latestRequest: null,
  requestFingerprint: null,
  sceneFingerprint: null,
  selection: null,
  attemptedBackend: { status: "not-started" },
  mountedRuntime: unknownRuntime,
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
    const generation = this.allocateGeneration(state.channelId);
    const latestRequest = state.latestRequest;
    return {
      ...state,
      activeHostId: hostId,
      pendingHostId: null,
      activeGeneration: generation,
      retiringGeneration: null,
      mounted: false,
      adapterStarted: false,
      cleanupStatus: state.cleanupStatus === "confirmed" ? "confirmed" : "none",
      selection: latestRequest
        ? createDefaultWebGlSelection(state.channelId, latestRequest.scene.id)
        : null,
      attemptedBackend: { status: "started", backend: "webgl" },
      mountedRuntime: unknownRuntime,
      lifecycleStatus: latestRequest ? "initializing" : "idle",
      frame: {
        current: latestRequest
          ? { status: "pending", generation, request: latestRequest.identity }
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
  ): void => {
    this.update(channel, (state) => {
      if (state.activeHostId !== hostId && state.pendingHostId !== hostId) return state;
      const fingerprint = createGroundGlassFrameRequestFingerprint(input);
      if (state.requestFingerprint === fingerprint && state.latestRequest) return state;
      this.requestSequence += 1;
      const identity = Object.freeze({
        requestId: `gg-${this.instanceId}-${channel}-request-${this.requestSequence}`,
        channelId: channel,
        sceneId: input.scene.id,
      });
      const sceneFingerprint = createGroundGlassSceneFingerprint(input.scene);
      // A crop, resize, optics, or display update must retain the mounted scene subject. Reuse the
      // immutable scene snapshot while its Ground Glass identity/bounds remain unchanged.
      const stableSceneSnapshot = state.sceneFingerprint === sceneFingerprint
        ? state.latestRequest?.scene
        : undefined;
      const request = createGroundGlassFrameRequest(input, identity, stableSceneSnapshot);
      const selection = createDefaultWebGlSelection(channel, input.scene.id);
      const acceptedByActiveHost = state.activeHostId === hostId;
      const activeGeneration = acceptedByActiveHost ? state.activeGeneration : null;
      return {
        ...state,
        latestRequest: request,
        requestFingerprint: fingerprint,
        sceneFingerprint,
        selection,
        lifecycleStatus: activeGeneration
          ? state.mounted ? "rendering" : "initializing"
          : state.retiringGeneration || state.activeGeneration ? "retiring" : "idle",
        frame: {
          current: activeGeneration
            ? { status: "pending", generation: activeGeneration, request: identity }
            : null,
          lastSuccessfullyCompleted: state.frame.lastSuccessfullyCompleted,
        },
      };
    });
  };

  markAdapterStarted = (
    channel: GroundGlassRttChannel,
    hostId: string,
    generation: GroundGlassRendererGenerationIdentity,
  ): void => {
    this.update(channel, (state) => {
      if (state.activeHostId !== hostId || state.activeGeneration?.generationId !== generation.generationId) return state;
      return {
        ...state,
        adapterStarted: true,
        cleanupStatus: state.cleanupStatus === "confirmed" ? "none" : state.cleanupStatus,
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
      if (state.activeHostId !== hostId || state.activeGeneration?.generationId !== generation.generationId) return state;
      return {
        ...state,
        mounted: true,
        adapterStarted: true,
        cleanupStatus: state.cleanupStatus === "confirmed" ? "none" : state.cleanupStatus,
        attemptedBackend: { status: "mounted", backend: "webgl" },
        mountedRuntime: {
          status: "mounted",
          generation,
          rendererFamily: "webgl-renderer",
          actualExecutionApi,
          internalFallback: "none",
        },
        lifecycleStatus: state.latestRequest ? "rendering" : "ready",
      };
    });
  };

  reportAdapterFailure = (
    channel: GroundGlassRttChannel,
    hostId: string,
    generation: GroundGlassRendererGenerationIdentity,
    failureReason: string,
  ): void => {
    this.update(channel, (state) => {
      if (state.activeHostId !== hostId || state.activeGeneration?.generationId !== generation.generationId) return state;
      const stage = state.mounted ? "runtime" : "initialization";
      const request = state.latestRequest;
      return {
        ...state,
        attemptedBackend: {
          status: "failed",
          backend: "webgl",
          stage,
          failureReason,
        },
        lifecycleStatus: "failed",
        frame: {
          current: request
            ? {
                status: "failed",
                generation,
                request: request.identity,
                failedStage: null,
                failureReason,
              }
            : null,
          lastSuccessfullyCompleted: state.frame.lastSuccessfullyCompleted,
        },
      };
    });
  };

  canReceiveRuntimeInfo = (
    channel: GroundGlassRttChannel,
    hostId: string,
    generation: GroundGlassRendererGenerationIdentity,
  ): boolean => {
    const state = this.getSnapshot(channel);
    return state.activeHostId === hostId &&
      state.activeGeneration?.generationId === generation.generationId &&
      state.retiringGeneration === null;
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
        !state.latestRequest
      ) return state;

      const mountedState = {
        mounted: true,
        activeGeneration: state.activeGeneration,
        latestAcceptedRequest: state.latestRequest.identity,
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
          attemptedBackend: { status: "mounted", backend: "webgl" },
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
        result.request.requestId === state.latestRequest.identity.requestId &&
        result.request.channelId === channel &&
        result.request.sceneId === state.latestRequest.identity.sceneId;
      if (!matchesCurrent || result.status !== "failed") return state;
      accepted = true;
      return {
        ...state,
        lifecycleStatus: "failed",
        attemptedBackend: {
          status: "failed",
          backend: "webgl",
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
      sameRequestResult(state.frame.current, result) &&
      canPublishGroundGlassFrame(result, {
        mounted: true,
        activeGeneration: state.activeGeneration,
        latestAcceptedRequest: state.latestRequest?.identity ?? null,
      });
  };

  requestSafeReplacement = (channel: GroundGlassRttChannel, hostId: string): boolean => {
    let requested = false;
    this.update(channel, (state) => {
      const generation = state.activeGeneration;
      if (state.activeHostId !== hostId || !generation || state.retiringGeneration) return state;
      requested = true;
      return {
        ...state,
        activeHostId: null,
        pendingHostId: hostId,
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
      this.update(channel, (state) => ({ ...state, pendingHostId: null }));
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
  ): void => {
    this.update(channel, (state) => {
      if (state.retiringGeneration?.generationId === generation.generationId) {
        return { ...state, cleanupStatus: outcome };
      }
      if (state.activeGeneration?.generationId === generation.generationId) {
        return {
          ...state,
          cleanupStatus: outcome,
          adapterStarted: false,
          mounted: false,
          mountedRuntime: unknownRuntime,
          lifecycleStatus: state.lifecycleStatus === "failed"
            ? "failed"
            : outcome === "confirmed" ? "disposed" : "unavailable",
        };
      }
      return state;
    });
    const state = this.getSnapshot(channel);
    if (state.retiringGeneration?.generationId === generation.generationId) {
      this.finishCleanup(channel, outcome);
    }
  };

  private finishCleanup(channel: GroundGlassRttChannel, outcome: GroundGlassCleanupOutcome): void {
    this.update(channel, (state) => {
      if (!state.retiringGeneration) return state;
      if (outcome !== "confirmed") {
        return {
          ...state,
          cleanupStatus: outcome,
          mounted: false,
          mountedRuntime: unknownRuntime,
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
        mountedRuntime: unknownRuntime,
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
    const cleanup = state.cleanupStatus === "confirmed"
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
    const request = state.latestRequest;
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
                  ? "owned-resource-disposal-failed"
                  : "adapter-cleanup-not-confirmed",
              }
            : { status: "not-required" };
    const diagnostics: GroundGlassBackendDiagnostics = {
      requestIdentity: request.identity,
      pilotSessionId: state.retryState?.pilotSessionId ?? null,
      policySelection: selection,
      attemptedBackend: state.attemptedBackend,
      mountedRuntime: state.mountedRuntime,
      applicationFallback: { status: "not-observed" },
      rendererGeneration: generation,
      lifecycleStatus: state.lifecycleStatus,
      cleanup,
      frame: state.frame,
      retryState: state.retryState,
      backendDetails: null,
    };
    this.diagnosticsByState.set(state, diagnostics);
    return diagnostics;
  };
}
