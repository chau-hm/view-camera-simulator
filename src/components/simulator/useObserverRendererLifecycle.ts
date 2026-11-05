import { useCallback, useInsertionEffect, useLayoutEffect, useRef, useState } from "react";
import {
  resolveObserverRendererInitializationFailure,
  type ObserverBackendSelection,
} from "../../render/backend/observerBackend";
import type { ObserverVisualPipelineCapabilities } from "../../render/backend/observerVisualPipelineCapabilities";
import {
  recordRendererLifecycleEvent,
  rendererLifecycleTraceEnabled,
} from "../../render/testing/m7nRendererLifecycleTrace";

type TraceGenerationIdentity = Readonly<{
  routeId: string;
  sceneId: string;
  viewportMountId: string;
  requestIdentity: string;
  backendStatus: ObserverBackendSelection["status"];
  rendererAttempt: ObserverBackendSelection["rendererAttempt"];
}>;

type ObserverRendererLifecycleOptions = Readonly<{
  sceneId?: string;
  routeId?: string;
  viewportMountId?: string;
  requestIdentity: string;
  backendSelection: ObserverBackendSelection;
  rendererMountKey: number;
  onApplicationFallback: (selection: ObserverBackendSelection) => void;
  onFallbackRemount: () => void;
  onCanvasFailure: () => void;
}>;

type AttemptGenerationState = Readonly<{
  descriptor: string;
  generation: number;
}>;

type ReportedCapabilities = Readonly<{
  generation: number;
  capabilities: ObserverVisualPipelineCapabilities;
}>;

/**
 * Owns one Observer host's renderer-attempt generation and callback authority.
 * A conditional render-phase state update advances the generation only when
 * the requested Canvas attempt changes, before its descendant effects can
 * start renderer initialization.
 */
export const useObserverRendererLifecycle = ({
  sceneId = "unknown-scene",
  routeId = "unknown-route",
  viewportMountId = "unknown-viewport",
  requestIdentity,
  backendSelection,
  rendererMountKey,
  onApplicationFallback,
  onFallbackRemount,
  onCanvasFailure,
}: ObserverRendererLifecycleOptions) => {
  const attemptDescriptor = JSON.stringify([
    requestIdentity,
    backendSelection.status,
    backendSelection.rendererAttempt,
    backendSelection.applicationFallback,
    backendSelection.selectionReason,
    backendSelection.status === "unavailable" ? backendSelection.failureReason : null,
    rendererMountKey,
  ]);
  const [attemptGenerationState, setAttemptGenerationState] = useState<AttemptGenerationState>(
    () => ({ descriptor: attemptDescriptor, generation: 0 }),
  );
  if (attemptGenerationState.descriptor !== attemptDescriptor) {
    setAttemptGenerationState((current) => ({
      descriptor: attemptDescriptor,
      generation: current.generation + 1,
    }));
  }
  const mountGeneration = attemptGenerationState.descriptor === attemptDescriptor
    ? attemptGenerationState.generation
    : attemptGenerationState.generation + 1;

  const activeGenerationRef = useRef<number | null>(null);
  const traceGenerationIdentitiesRef = useRef<Map<number, TraceGenerationIdentity> | null>(null);
  if (rendererLifecycleTraceEnabled) {
    const identities = traceGenerationIdentitiesRef.current ?? new Map<number, TraceGenerationIdentity>();
    identities.set(mountGeneration, {
      routeId,
      sceneId,
      viewportMountId,
      requestIdentity,
      backendStatus: backendSelection.status,
      rendererAttempt: backendSelection.rendererAttempt,
    });
    while (identities.size > 16) {
      const oldestGeneration = identities.keys().next().value;
      if (oldestGeneration === undefined) break;
      identities.delete(oldestGeneration);
    }
    traceGenerationIdentitiesRef.current = identities;
  }
  const failedWebGpuGenerationRef = useRef<number | null>(null);
  const failedOutputPolicyGenerationRef = useRef<number | null>(null);
  const fallbackRequestedGenerationRef = useRef<number | null>(null);
  useInsertionEffect(() => {
    activeGenerationRef.current = mountGeneration;
    if (rendererLifecycleTraceEnabled) {
      const traceIdentity = traceGenerationIdentitiesRef.current?.get(mountGeneration);
      recordRendererLifecycleEvent({
        surface: "observer",
        event: "observer-generation-authority-activated",
        routeId: traceIdentity?.routeId,
        sceneId: traceIdentity?.sceneId,
        mountGeneration: traceIdentity?.viewportMountId,
        rendererGeneration: mountGeneration,
        status: "awaiting-capabilities",
        detail: {
          backendStatus: traceIdentity?.backendStatus ?? "unavailable",
          rendererAttempt: traceIdentity?.rendererAttempt ?? null,
          requestIdentity: traceIdentity?.requestIdentity ?? null,
          generationNumber: mountGeneration,
        },
      });
    }
    if (failedWebGpuGenerationRef.current !== mountGeneration) {
      failedWebGpuGenerationRef.current = null;
    }
    return () => {
      if (activeGenerationRef.current === mountGeneration) {
        activeGenerationRef.current = null;
      }
      if (failedWebGpuGenerationRef.current === mountGeneration) {
        failedWebGpuGenerationRef.current = null;
      }
      if (failedOutputPolicyGenerationRef.current === mountGeneration) {
        failedOutputPolicyGenerationRef.current = null;
      }
      if (fallbackRequestedGenerationRef.current === mountGeneration) {
        fallbackRequestedGenerationRef.current = null;
      }
      if (rendererLifecycleTraceEnabled) {
        const retiredTraceIdentity = traceGenerationIdentitiesRef.current?.get(mountGeneration);
        recordRendererLifecycleEvent({
          surface: "observer",
          event: "observer-generation-authority-retired",
          routeId: retiredTraceIdentity?.routeId,
          sceneId: retiredTraceIdentity?.sceneId,
          mountGeneration: retiredTraceIdentity?.viewportMountId,
          rendererGeneration: mountGeneration,
          status: "retired",
        });
      }
    };
  }, [mountGeneration]);

  const [initializationAttemptsByRequest, setInitializationAttemptsByRequest] = useState({
    requestIdentity,
    count: 0,
  });
  const initializationAttempts =
    initializationAttemptsByRequest.requestIdentity === requestIdentity
      ? initializationAttemptsByRequest.count
      : 0;
  const [rendererFailure, setRendererFailure] = useState<{
    requestIdentity: string;
    stage: "initialization" | "output-policy";
    reason?: string;
  } | null>(null);
  useLayoutEffect(() => {
    setInitializationAttemptsByRequest((current) =>
      current.requestIdentity === requestIdentity
        ? current
        : { requestIdentity, count: 0 },
    );
    setRendererFailure((current) =>
      current?.requestIdentity === requestIdentity ? current : null,
    );
  }, [requestIdentity]);

  const [reportedCapabilities, setReportedCapabilities] =
    useState<ReportedCapabilities | null>(null);
  const onObserverCapabilitiesChange = useCallback(
    (
      generation: number,
      capabilities: ObserverVisualPipelineCapabilities | null,
    ) => {
      const traceIdentity = rendererLifecycleTraceEnabled
        ? traceGenerationIdentitiesRef.current?.get(generation)
        : undefined;
      if (activeGenerationRef.current !== generation) {
        if (rendererLifecycleTraceEnabled) recordRendererLifecycleEvent({
          surface: "observer",
          event: "observer-stale-capability-callback-rejected",
          routeId: traceIdentity?.routeId,
          sceneId: traceIdentity?.sceneId,
          mountGeneration: traceIdentity?.viewportMountId,
          rendererGeneration: generation,
          status: "rejected-stale",
          detail: { activeGeneration: activeGenerationRef.current },
        });
        return;
      }
      if (rendererLifecycleTraceEnabled) recordRendererLifecycleEvent({
        surface: "observer",
        event: capabilities ? "observer-capabilities-published" : "observer-capabilities-cleared",
        routeId: traceIdentity?.routeId,
        sceneId: traceIdentity?.sceneId,
        mountGeneration: traceIdentity?.viewportMountId,
        rendererGeneration: generation,
        status: capabilities?.status ?? "cleared",
        detail: capabilities ? {
          rendererFamily: capabilities.rendererFamily,
          executionBackend: capabilities.executionBackend,
        } : undefined,
      });
      setReportedCapabilities((current) => {
        // Recheck inside the state updater in case the report was queued just
        // before a newer Canvas generation became active.
        if (activeGenerationRef.current !== generation) return current;
        if (capabilities === null) {
          return current?.generation === generation ? null : current;
        }
        return { generation, capabilities };
      });
    },
    [],
  );

  const onWebGpuInitializationAttempt = useCallback(() => {
    if (activeGenerationRef.current !== mountGeneration) return;
    setInitializationAttemptsByRequest((current) => {
      if (activeGenerationRef.current !== mountGeneration) return current;
      return {
        requestIdentity,
        count: current.requestIdentity === requestIdentity ? current.count + 1 : 1,
      };
    });
  }, [mountGeneration, requestIdentity]);

  const onWebGpuInitializationFailure = useCallback(() => {
    if (activeGenerationRef.current !== mountGeneration) return;
    if (fallbackRequestedGenerationRef.current === mountGeneration) return;
    failedWebGpuGenerationRef.current = mountGeneration;
    setRendererFailure((current) =>
      activeGenerationRef.current === mountGeneration
        ? { requestIdentity, stage: "initialization" }
        : current,
    );
  }, [mountGeneration, requestIdentity]);

  const onWebGpuOutputPolicyFailure = useCallback((reason: string) => {
    if (activeGenerationRef.current !== mountGeneration) return;
    if (failedOutputPolicyGenerationRef.current === mountGeneration) return;
    if (failedWebGpuGenerationRef.current === mountGeneration) return;
    failedOutputPolicyGenerationRef.current = mountGeneration;
    fallbackRequestedGenerationRef.current = mountGeneration;
    setRendererFailure((current) => activeGenerationRef.current === mountGeneration
      ? { requestIdentity, stage: "output-policy", reason }
      : current);
    if (backendSelection.status === "selected" && backendSelection.rendererAttempt === "webgpu") {
      const nextSelection = resolveObserverRendererInitializationFailure(backendSelection);
      onApplicationFallback(nextSelection);
      if (nextSelection.status === "selected") onFallbackRemount();
      return;
    }
    onCanvasFailure();
  }, [
    backendSelection,
    mountGeneration,
    onApplicationFallback,
    onCanvasFailure,
    onFallbackRemount,
    requestIdentity,
  ]);

  const onObserverCanvasError = useCallback(() => {
    if (activeGenerationRef.current !== mountGeneration) return;
    if (rendererLifecycleTraceEnabled) recordRendererLifecycleEvent({
      surface: "observer",
      event: "observer-canvas-error-boundary-reported",
      routeId,
      sceneId,
      mountGeneration: viewportMountId,
      rendererGeneration: mountGeneration,
      status: "failed",
    });
    if (fallbackRequestedGenerationRef.current === mountGeneration) return;
    const failedDuringWebGpuInitialization =
      failedWebGpuGenerationRef.current === mountGeneration;
    if (failedDuringWebGpuInitialization) {
      failedWebGpuGenerationRef.current = null;
    }

    if (failedDuringWebGpuInitialization && backendSelection.status === "selected") {
      const nextSelection = resolveObserverRendererInitializationFailure(backendSelection);
      onApplicationFallback(nextSelection);
      if (nextSelection.status === "selected") onFallbackRemount();
      return;
    }

    onCanvasFailure();
  }, [
    backendSelection,
    mountGeneration,
    onApplicationFallback,
    onCanvasFailure,
    onFallbackRemount,
    routeId,
    sceneId,
    viewportMountId,
  ]);

  return {
    mountGeneration,
    initializationAttempts,
    rendererFailureStage:
      rendererFailure?.requestIdentity === requestIdentity ? rendererFailure.stage : null,
    rendererFailureReason:
      rendererFailure?.requestIdentity === requestIdentity ? rendererFailure.reason ?? null : null,
    observerCapabilities:
      reportedCapabilities?.generation === mountGeneration
        ? reportedCapabilities.capabilities
        : null,
    onObserverCapabilitiesChange,
    onWebGpuInitializationAttempt,
    onWebGpuInitializationFailure,
    onWebGpuOutputPolicyFailure,
    onObserverCanvasError,
  } as const;
};
