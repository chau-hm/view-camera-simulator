import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { GroundGlassBackendDiagnostics } from "./backend/groundGlassBackendDiagnostics";
import type {
  GroundGlassFrameResult,
  GroundGlassRendererGenerationIdentity,
} from "./backend/groundGlassBackendContracts";
import type { GroundGlassFrameRequestInput } from "./groundGlassFrameRequest";
import { createGroundGlassFrameRequestFingerprint } from "./groundGlassFrameRequest";
import { GroundGlassWebGLAdapter } from "./GroundGlassWebGLAdapter";
import type { GroundGlassRttRuntimeInfoChangeHandler } from "./groundGlassRttDimensions";
import type { GroundGlassRuntimeInfoObservation } from "./groundGlassRuntimeObservation";
import {
  GroundGlassRenderHostState,
  type GroundGlassCleanupOutcome,
} from "./groundGlassRenderHostState";

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
    owner.acceptRequest(channel, hostId, request);
  }, [channel, fingerprint, hostId, owner, request]);

  const generation = state.activeGeneration;
  const activeForThisHost = state.activeHostId === hostId && generation !== null;
  const acceptedRequest = state.activeRequest;
  const shouldMountAdapter = activeForThisHost && acceptedRequest !== null;

  useEffect(() => {
    diagnosticsChangeRef.current?.(channel, diagnostics);
  }, [channel, diagnostics]);

  const handleRendererMounted = useCallback((
    mountedGeneration: GroundGlassRendererGenerationIdentity,
    actualExecutionApi: "webgl" | "webgl2",
  ) => {
    owner.reportRendererMounted(channel, hostId, mountedGeneration, actualExecutionApi);
  }, [channel, hostId, owner]);

  const handleAdapterStarted = useCallback((
    startedGeneration: GroundGlassRendererGenerationIdentity,
  ) => {
    owner.markAdapterStarted(channel, hostId, startedGeneration);
  }, [channel, hostId, owner]);

  const handleFrameResult = useCallback((result: GroundGlassFrameResult) => {
    if (!owner.receiveFrameResult(channel, hostId, result)) return;
    if (
      result.status === "completed" &&
      owner.canPublishFrameNow(channel, hostId, result)
    ) {
      framePublishedRef.current?.(result);
    }
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

  const handleAdapterFailure = useCallback((error: Error) => {
    if (!generation) return;
    owner.reportAdapterFailure(channel, hostId, generation, error.message || String(error));
  }, [channel, generation, hostId, owner]);

  if (!shouldMountAdapter || !generation || !acceptedRequest) return null;

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
