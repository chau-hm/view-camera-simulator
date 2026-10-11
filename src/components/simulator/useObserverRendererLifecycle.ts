import { useCallback, useInsertionEffect, useLayoutEffect, useRef, useState } from "react";
import {
  resolveObserverRendererInitializationFailure,
  type ObserverBackendSelection,
} from "../../render/backend/observerBackend";
import type { ObserverVisualPipelineCapabilities } from "../../render/backend/observerVisualPipelineCapabilities";

type ObserverRendererLifecycleOptions = Readonly<{
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
  const failedWebGpuGenerationRef = useRef<number | null>(null);
  useInsertionEffect(() => {
    activeGenerationRef.current = mountGeneration;
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
    stage: "initialization";
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
      if (activeGenerationRef.current !== generation) return;
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
    failedWebGpuGenerationRef.current = mountGeneration;
    setRendererFailure((current) =>
      activeGenerationRef.current === mountGeneration
        ? { requestIdentity, stage: "initialization" }
        : current,
    );
  }, [mountGeneration, requestIdentity]);

  const onObserverCanvasError = useCallback(() => {
    if (activeGenerationRef.current !== mountGeneration) return;
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
  ]);

  return {
    mountGeneration,
    initializationAttempts,
    rendererFailureStage:
      rendererFailure?.requestIdentity === requestIdentity ? rendererFailure.stage : null,
    observerCapabilities:
      reportedCapabilities?.generation === mountGeneration
        ? reportedCapabilities.capabilities
        : null,
    onObserverCapabilitiesChange,
    onWebGpuInitializationAttempt,
    onWebGpuInitializationFailure,
    onObserverCanvasError,
  } as const;
};
