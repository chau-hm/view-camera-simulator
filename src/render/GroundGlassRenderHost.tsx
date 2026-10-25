import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import type {
  GroundGlassBackendDiagnosticDetails,
  GroundGlassBackendDiagnostics,
  GroundGlassMountedRuntimeEvidence,
} from "./backend/groundGlassBackendDiagnostics";
import type {
  GroundGlassFrameResult,
  GroundGlassRendererGenerationIdentity,
} from "./backend/groundGlassBackendContracts";
import { selectGroundGlassBackend, type GroundGlassBackendPolicyInput } from "./backend/groundGlassBackendPolicy";
import type { GroundGlassFrameRequest, GroundGlassFrameRequestInput } from "./groundGlassFrameRequest";
import { createGroundGlassFrameRequestFingerprint } from "./groundGlassFrameRequest";
import { holdGroundGlassFrameResultForTest } from "./webgpu/groundGlassWebGpuTestSeam";
import { GroundGlassWebGLAdapter } from "./GroundGlassWebGLAdapter";
import type { GroundGlassRttRuntimeInfoChangeHandler } from "./groundGlassRttDimensions";
import type { GroundGlassRuntimeInfoObservation } from "./groundGlassRuntimeObservation";
import {
  GroundGlassRenderHostState,
  type GroundGlassCleanupOutcome,
} from "./groundGlassRenderHostState";
import {
  createGroundGlassRawWebGpuPolicyInput,
} from "./webgpu/groundGlassRawWebGpuPolicyInput";
import type { GroundGlassRenderOperationId } from "./groundGlassPassGraph";

const GroundGlassRenderHostStateContext = createContext<GroundGlassRenderHostState | null>(null);

class GroundGlassAdapterErrorBoundary extends Component<{
  children: ReactNode;
  onFailure: (error: Error) => void;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onFailure(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export const GroundGlassRenderHostStateProvider = ({
  children,
  owner: suppliedOwner,
}: {
  children: ReactNode;
  /** Intended for focused lifecycle tests; production creates one app-lifetime owner. */
  owner?: GroundGlassRenderHostState;
}) => {
  const [createdOwner] = useState(() => new GroundGlassRenderHostState());
  const owner = suppliedOwner ?? createdOwner;
  return (
    <GroundGlassRenderHostStateContext.Provider value={owner}>
      {children}
    </GroundGlassRenderHostStateContext.Provider>
  );
};

type GroundGlassWebGpuAdapterProps = Readonly<{
  request: GroundGlassFrameRequest;
  generation: GroundGlassRendererGenerationIdentity;
  isGenerationActive: () => boolean;
  onAdapterStarted: (generation: GroundGlassRendererGenerationIdentity) => void;
  onRendererMounted: (
    generation: GroundGlassRendererGenerationIdentity,
    runtime: GroundGlassMountedRuntimeEvidence,
    details: GroundGlassBackendDiagnosticDetails,
  ) => void;
  onBackendDetails: (details: GroundGlassBackendDiagnosticDetails) => void;
  onFrameResult: (result: GroundGlassFrameResult) => void;
  onAdapterDisposed: (
    generation: GroundGlassRendererGenerationIdentity,
    outcome: GroundGlassCleanupOutcome,
    reason?: string,
  ) => void;
  onFailure: (
    error: Error,
    stage: "initialization" | "runtime",
    failedPass: GroundGlassRenderOperationId | null,
  ) => void;
}>;

export type GroundGlassRenderHostProps = Readonly<{
  request: GroundGlassFrameRequestInput;
  onRuntimeInfoChange?: GroundGlassRttRuntimeInfoChangeHandler;
  onDiagnosticsChange?: (
    channel: GroundGlassFrameRequestInput["channel"],
    diagnostics: GroundGlassBackendDiagnostics | null,
  ) => void;
  onFramePublished?: (result: Extract<GroundGlassFrameResult, { status: "completed" }>) => void;
}>;

/**
 * Application-facing Ground Glass lifecycle seam. M2 deliberately mounts one adapter only:
 * the existing WebGL GroundGlassRTT implementation.
 */
export const GroundGlassRenderHost = ({
  request,
  onRuntimeInfoChange,
  onDiagnosticsChange,
  onFramePublished,
}: GroundGlassRenderHostProps) => {
  const sharedOwner = useContext(GroundGlassRenderHostStateContext);
  const [localOwner] = useState(() => new GroundGlassRenderHostState());
  const owner = sharedOwner ?? localOwner;
  const reactId = useId();
  const [hostId] = useState(() => `gg-host-${reactId}-${Math.random().toString(36).slice(2)}`);
  const [WebGpuAdapter, setWebGpuAdapter] = useState<ComponentType<GroundGlassWebGpuAdapterProps> | null>(null);
  const channel = request.channel;
  const fingerprint = createGroundGlassFrameRequestFingerprint(request);
  const subscribe = useCallback(
    (listener: () => void) => owner.subscribe(channel, listener),
    [channel, owner],
  );
  const getSnapshot = useCallback(() => owner.getSnapshot(channel), [channel, owner]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const diagnostics = owner.getDiagnostics(channel);
  const runtimeInfoChangeRef = useRef(onRuntimeInfoChange);
  const diagnosticsChangeRef = useRef(onDiagnosticsChange);
  const framePublishedRef = useRef(onFramePublished);
  const lifecycleEffectEpochRef = useRef(0);
  runtimeInfoChangeRef.current = onRuntimeInfoChange;
  diagnosticsChangeRef.current = onDiagnosticsChange;
  framePublishedRef.current = onFramePublished;

  const policyInput = useMemo(
    () => createGroundGlassRawWebGpuPolicyInput(request, state.retryState),
    [request, state.retryState],
  );
  const policyInputIdentity = JSON.stringify(policyInput);

  useLayoutEffect(() => {
    lifecycleEffectEpochRef.current += 1;
    owner.attachHost(channel, hostId);
    return () => {
      const cleanupEpoch = ++lifecycleEffectEpochRef.current;
      // React StrictMode replays effect cleanup/setup in one commit. Deferring only the detach
      // decision to the next microtask lets the replayed setup cancel that synthetic detach;
      // a real unmount still revokes publication before the next browser frame.
      queueMicrotask(() => {
        if (lifecycleEffectEpochRef.current === cleanupEpoch) owner.detachHost(channel, hostId);
      });
    };
  }, [channel, hostId, owner]);

  // This is the acceptance boundary: only a committed React tree can create a request revision.
  useLayoutEffect(() => {
    if (policyInput.authorization.status === "authorized" && owner.getSnapshot(channel).retryState === null) {
      owner.beginPilotSession(channel, policyInput.authorization);
    }
    const acceptedPolicyInput: GroundGlassBackendPolicyInput = {
      ...policyInput,
      retryState: owner.getSnapshot(channel).retryState,
    };
    owner.acceptRequest(channel, hostId, request, acceptedPolicyInput);
  }, [channel, fingerprint, hostId, owner, policyInput, policyInputIdentity, request]);

  const generation = state.activeGeneration;
  const activeForThisHost = state.activeHostId === hostId && generation !== null;
  const acceptedRequest = state.activeRequest;
  const shouldMountAdapter = activeForThisHost &&
    acceptedRequest !== null &&
    state.selection?.status === "selected";
  const shouldMountWebGpuAdapter = shouldMountAdapter &&
    state.selection?.status === "selected" &&
    state.selection.selectedBackend === "webgpu";

  const isGenerationActive = useCallback(() => {
    const latest = owner.getSnapshot(channel);
    return Boolean(
      generation &&
      latest.activeHostId === hostId &&
      latest.activeGeneration?.generationId === generation.generationId &&
      latest.retiringGeneration === null &&
      latest.selection?.status === "selected" &&
      latest.selection.selectedBackend === "webgpu",
    );
  }, [channel, generation, hostId, owner]);

  useEffect(() => {
    diagnosticsChangeRef.current?.(channel, diagnostics);
  }, [channel, diagnostics]);

  const handleRendererMounted = useCallback((
    mountedGeneration: GroundGlassRendererGenerationIdentity,
    actualExecutionApi: "webgl" | "webgl2",
  ) => {
    owner.reportRendererMounted(channel, hostId, mountedGeneration, actualExecutionApi);
  }, [channel, hostId, owner]);

  const handleWebGpuRendererMounted = useCallback((
    mountedGeneration: GroundGlassRendererGenerationIdentity,
    runtime: GroundGlassMountedRuntimeEvidence,
    details: GroundGlassBackendDiagnosticDetails,
  ) => {
    owner.reportWebGpuRendererMounted(channel, hostId, mountedGeneration, runtime, details);
  }, [channel, hostId, owner]);

  const handleWebGpuBackendDetails = useCallback((details: GroundGlassBackendDiagnosticDetails) => {
    if (!generation) return;
    owner.reportBackendDetails(channel, hostId, generation, details);
  }, [channel, generation, hostId, owner]);

  const handleAdapterStarted = useCallback((
    startedGeneration: GroundGlassRendererGenerationIdentity,
  ) => {
    owner.markAdapterStarted(channel, hostId, startedGeneration);
  }, [channel, hostId, owner]);

  const handleFrameResult = useCallback((result: GroundGlassFrameResult) => {
    const deliver = () => {
      if (!owner.receiveFrameResult(channel, hostId, result)) return;
      if (
        result.status === "completed" &&
        owner.canPublishFrameNow(channel, hostId, result)
      ) {
        framePublishedRef.current?.(result);
      }
    };
    if (!holdGroundGlassFrameResultForTest(result, deliver)) deliver();
  }, [channel, hostId, owner]);

  const handleRuntimeObservation = useCallback((observation: GroundGlassRuntimeInfoObservation) => {
    if (
      !observation ||
      typeof observation !== "object" ||
      observation.channelId !== channel ||
      !observation.generation ||
      typeof observation.generation.generationId !== "string" ||
      typeof observation.generation.channelId !== "string" ||
      typeof observation.ownerId !== "string" ||
      !observation.ownerId.trim() ||
      (observation.scope === "request" && !observation.requestIdentity) ||
      (observation.scope === "generation" && observation.requestIdentity !== null) ||
      (observation.scope !== "request" && observation.scope !== "generation") ||
      (observation.info !== null && (
        observation.info.channel !== observation.channelId ||
        observation.info.ownerId !== observation.ownerId
      )) ||
      !owner.canReceiveRuntimeInfo(
        observation.channelId,
        hostId,
        observation.generation,
        observation.scope === "request" ? observation.requestIdentity : null,
        observation.ownerId,
      )
    ) return;
    runtimeInfoChangeRef.current?.(
      observation.channelId,
      observation.info,
      observation.ownerId,
    );
  }, [channel, hostId, owner]);

  const handleAdapterDisposed = useCallback((
    retiredGeneration: GroundGlassRendererGenerationIdentity,
    outcome: GroundGlassCleanupOutcome,
    reason?: string,
  ) => {
    owner.reportAdapterDisposed(channel, retiredGeneration, outcome, reason);
  }, [channel, owner]);

  const handleAdapterFailureAtStage = useCallback((
    error: Error,
    stage: "initialization" | "runtime",
    failedPass: GroundGlassRenderOperationId | null,
  ) => {
    const current = owner.getSnapshot(channel);
    const activeGeneration = current.activeGeneration;
    if (!activeGeneration || current.activeHostId !== hostId) return;
    const failureReason = error.message || String(error);
    if (!owner.reportAdapterFailure(
      channel,
      hostId,
      activeGeneration,
      failureReason,
      stage,
      failedPass,
    )) return;

    const latest = owner.getSnapshot(channel);
    const latestRequest = latest.latestRequest ?? latest.activeRequest;
    if (!latestRequest) return;
    const latestPolicyInput = createGroundGlassRawWebGpuPolicyInput(
      latestRequest,
      latest.retryState,
    );
    if (current.selection?.status !== "selected" || current.selection.selectedBackend !== "webgpu") {
      // A WebGL failure is terminal for this host generation. The boundary removes the failed
      // adapter and its own cleanup reports; no second WebGL mount is attempted.
      return;
    }
    let replacementPolicyInput = latestPolicyInput;
    const replacementSelection = selectGroundGlassBackend(replacementPolicyInput);
    if (
      replacementSelection.status === "selected" &&
      replacementSelection.selectedBackend === "webgpu"
    ) {
      // Failure to consume the session latch is an invariant violation. Fail closed rather
      // than allowing another attempt or mounting over uncertain ownership.
      replacementPolicyInput = {
        ...latestPolicyInput,
        requestedBackend: "webgl",
        webglAvailable: false,
      };
    }
    owner.requestSafeReplacement(channel, hostId, replacementPolicyInput);
  }, [channel, hostId, owner]);

  const handleAdapterFailure = useCallback((error: Error) => {
    const stage = state.selection?.status === "selected" && state.selection.selectedBackend === "webgpu"
      ? "runtime"
      : "initialization";
    handleAdapterFailureAtStage(error, stage, null);
  }, [handleAdapterFailureAtStage, state.selection]);

  const handleWebGpuFailure = useCallback((
    error: Error,
    stage: "initialization" | "runtime",
    failedPass: GroundGlassRenderOperationId | null,
  ) => handleAdapterFailureAtStage(error, stage, failedPass), [handleAdapterFailureAtStage]);

  useEffect(() => {
    if (!shouldMountWebGpuAdapter || WebGpuAdapter) return;
    let current = true;
    import("./webgpu/GroundGlassWebGPUAdapter")
      .then((module) => {
        if (current) setWebGpuAdapter(() => module.GroundGlassWebGPUAdapter);
      })
      .catch((cause: unknown) => {
        if (!current) return;
        const error = cause instanceof Error ? cause : new Error(String(cause));
        handleWebGpuFailure(error, "initialization", null);
      });
    return () => { current = false; };
  }, [WebGpuAdapter, generation?.generationId, handleWebGpuFailure, shouldMountWebGpuAdapter]);

  if (!shouldMountAdapter || !generation || !acceptedRequest) return null;

  if (state.selection?.status === "selected" && state.selection.selectedBackend === "webgpu") {
    if (!WebGpuAdapter) {
      return <div data-testid="ground-glass-webgpu-loading" data-generation={generation.generationId} />;
    }
    return (
      <GroundGlassAdapterErrorBoundary key={generation.generationId} onFailure={handleAdapterFailure}>
        <WebGpuAdapter
          request={acceptedRequest}
          generation={generation}
          isGenerationActive={isGenerationActive}
          onAdapterStarted={handleAdapterStarted}
          onRendererMounted={handleWebGpuRendererMounted}
          onBackendDetails={handleWebGpuBackendDetails}
          onFrameResult={handleFrameResult}
          onAdapterDisposed={handleAdapterDisposed}
          onFailure={handleWebGpuFailure}
        />
      </GroundGlassAdapterErrorBoundary>
    );
  }

  return (
    <GroundGlassAdapterErrorBoundary key={generation.generationId} onFailure={handleAdapterFailure}>
      <GroundGlassWebGLAdapter
        request={acceptedRequest}
        generation={generation}
        onAdapterStarted={handleAdapterStarted}
        onRendererMounted={handleRendererMounted}
        onFrameResult={handleFrameResult}
        onRuntimeObservation={handleRuntimeObservation}
        onAdapterDisposed={handleAdapterDisposed}
      />
    </GroundGlassAdapterErrorBoundary>
  );
};
