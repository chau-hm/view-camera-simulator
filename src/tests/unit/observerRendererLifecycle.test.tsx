import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  selectObserverBackend,
  type ObserverBackendSelection,
} from "../../render/backend/observerBackend";
import { resolveObserverSceneCompatibility } from "../../render/backend/observerSceneCompatibility";
import type { ObserverVisualPipelineCapabilities } from "../../render/backend/observerVisualPipelineCapabilities";
import { initializeObserverWebGpuRenderer } from "../../render/backend/observerRendererInitialization";
import { useObserverRendererLifecycle } from "../../components/simulator/useObserverRendererLifecycle";

const selectionFor = (
  sceneId: string,
  requestedRendererParam: string | null,
): ObserverBackendSelection =>
  selectObserverBackend({
    webglAvailable: true,
    requestedRendererParam,
    sceneCompatibility: resolveObserverSceneCompatibility(sceneId),
    developmentPilotEnabled: true,
  });

const capabilities = (
  rendererFamily: "webgl-renderer" | "webgpu-renderer",
  executionBackend: "webgl2" | "webgpu",
): ObserverVisualPipelineCapabilities => ({
  surface: "observer",
  status: "active",
  rendererFamily,
  executionBackend,
  shadowMaps: { status: "active", type: "pcf" },
  toneMapping: {
    active: true,
    mode: "aces-filmic",
    exposure: 1,
    outputColorSpace: "srgb",
  },
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const requestIdentityFor = (sceneId: string, query: string | null) =>
  `${sceneId}:${query ?? "default"}`;

describe("Observer renderer lifecycle generations", () => {
  it("rejects delayed A callbacks across Anatomy → Architecture Rise → Anatomy and preserves current fallback", async () => {
    const onApplicationFallback = vi.fn<(selection: ObserverBackendSelection) => void>();
    const onFallbackRemount = vi.fn();
    const onCanvasFailure = vi.fn();
    const anatomyRequest = requestIdentityFor("view-camera-anatomy", "webgpu");
    const anatomySelection = selectionFor("view-camera-anatomy", "webgpu");
    const initialProps = {
      requestIdentity: anatomyRequest,
      backendSelection: anatomySelection,
      rendererMountKey: 0,
      onApplicationFallback,
      onFallbackRemount,
      onCanvasFailure,
    };
    const { result, rerender } = renderHook(
      (props: typeof initialProps) => useObserverRendererLifecycle(props),
      { initialProps },
    );

    const attemptA = result.current;
    const generationA = attemptA.mountGeneration;
    const pendingA = deferred<void>();
    const disposeA = vi.fn(async () => undefined);
    let initializationA!: Promise<{ init: () => Promise<void>; dispose: typeof disposeA }>;
    act(() => {
      // The real R3F GL factory calls the attempt callback before awaiting init().
      attemptA.onWebGpuInitializationAttempt();
      initializationA = initializeObserverWebGpuRenderer(
        () => ({ init: () => pendingA.promise, dispose: disposeA }),
        attemptA.onWebGpuInitializationFailure,
      );
    });
    expect(result.current.initializationAttempts).toBe(1);

    const architectureRequest = requestIdentityFor("architecture-rise", "webgpu");
    rerender({
      ...initialProps,
      requestIdentity: architectureRequest,
      backendSelection: selectionFor("architecture-rise", "webgpu"),
    });
    const architectureGeneration = result.current.mountGeneration;
    expect(architectureGeneration).toBeGreaterThan(generationA);
    expect(result.current.initializationAttempts).toBe(0);
    expect(result.current.observerCapabilities).toBeNull();

    rerender(initialProps);
    const attemptB = result.current;
    const generationB = attemptB.mountGeneration;
    expect(generationB).toBeGreaterThan(architectureGeneration);
    expect(generationB).not.toBe(generationA);
    expect(attemptB.initializationAttempts).toBe(0);
    expect(attemptB.rendererFailureStage).toBeNull();
    expect(attemptB.observerCapabilities).toBeNull();

    const capabilitiesB = capabilities("webgpu-renderer", "webgpu");
    act(() => attemptB.onObserverCapabilitiesChange(generationB, capabilitiesB));
    expect(result.current.observerCapabilities).toEqual(capabilitiesB);

    // A's late factory start, initialization rejection, Canvas error, and
    // reporter cleanup must not mutate B despite returning to the same scene
    // and backend request.
    act(() => {
      attemptA.onWebGpuInitializationAttempt();
      attemptA.onObserverCanvasError();
      attemptA.onObserverCapabilitiesChange(
        generationA,
        capabilities("webgl-renderer", "webgl2"),
      );
      attemptA.onObserverCapabilitiesChange(generationA, null);
    });
    pendingA.reject(new Error("A completed after B became active"));
    await act(async () => {
      await initializationA.catch(() => undefined);
    });

    expect(result.current.mountGeneration).toBe(generationB);
    expect(result.current.initializationAttempts).toBe(0);
    expect(result.current.rendererFailureStage).toBeNull();
    expect(result.current.observerCapabilities).toEqual(capabilitiesB);
    expect(onApplicationFallback).not.toHaveBeenCalled();
    expect(onFallbackRemount).not.toHaveBeenCalled();
    expect(onCanvasFailure).not.toHaveBeenCalled();
    expect(disposeA).toHaveBeenCalledOnce();

    // B's own failure still records the failure and enters the existing
    // one-shot WebGL application fallback.
    const pendingB = deferred<void>();
    const disposeB = vi.fn(async () => undefined);
    let initializationB!: Promise<{ init: () => Promise<void>; dispose: typeof disposeB }>;
    act(() => {
      attemptB.onWebGpuInitializationAttempt();
      initializationB = initializeObserverWebGpuRenderer(
        () => ({ init: () => pendingB.promise, dispose: disposeB }),
        attemptB.onWebGpuInitializationFailure,
      );
    });
    expect(result.current.initializationAttempts).toBe(1);
    pendingB.reject(new Error("B initialization failed"));
    await act(async () => {
      await initializationB.catch(() => undefined);
    });
    expect(result.current.rendererFailureStage).toBe("initialization");

    act(() => attemptB.onObserverCanvasError());
    expect(onApplicationFallback).toHaveBeenCalledOnce();
    expect(onFallbackRemount).toHaveBeenCalledOnce();
    const fallbackSelection = onApplicationFallback.mock.calls[0]?.[0];
    expect(fallbackSelection).toMatchObject({
      status: "selected",
      rendererAttempt: "webgl",
      applicationFallback: "app-webgl",
    });
    if (!fallbackSelection) throw new Error("Expected the current failure to request fallback");

    rerender({
      ...initialProps,
      backendSelection: fallbackSelection,
      rendererMountKey: 1,
    });
    const fallbackGeneration = result.current.mountGeneration;
    expect(fallbackGeneration).toBeGreaterThan(generationB);
    expect(result.current.observerCapabilities).toBeNull();
    expect(result.current.initializationAttempts).toBe(1);

    act(() => attemptB.onObserverCanvasError());
    expect(onApplicationFallback).toHaveBeenCalledOnce();
    expect(onFallbackRemount).toHaveBeenCalledOnce();
    expect(onCanvasFailure).not.toHaveBeenCalled();
    expect(disposeB).toHaveBeenCalledOnce();

    rerender({
      ...initialProps,
      backendSelection: fallbackSelection,
      rendererMountKey: 1,
    });
    expect(result.current.mountGeneration).toBe(fallbackGeneration);
  });

  it("rejects late mounted-capability reports and cleanup from a successfully completed old renderer", async () => {
    const onApplicationFallback = vi.fn<(selection: ObserverBackendSelection) => void>();
    const onFallbackRemount = vi.fn();
    const onCanvasFailure = vi.fn();
    const initialProps = {
      requestIdentity: requestIdentityFor("view-camera-anatomy", "webgpu"),
      backendSelection: selectionFor("view-camera-anatomy", "webgpu"),
      rendererMountKey: 0,
      onApplicationFallback,
      onFallbackRemount,
      onCanvasFailure,
    };
    const { result, rerender } = renderHook(
      (props: typeof initialProps) => useObserverRendererLifecycle(props),
      { initialProps },
    );
    const oldAttempt = result.current;
    const oldGeneration = oldAttempt.mountGeneration;
    const oldCapabilities = capabilities("webgpu-renderer", "webgpu");
    act(() => oldAttempt.onObserverCapabilitiesChange(oldGeneration, oldCapabilities));
    expect(result.current.observerCapabilities).toEqual(oldCapabilities);

    const pendingInitialization = deferred<void>();
    let initialization!: Promise<{ init: () => Promise<void>; dispose: () => Promise<void> }>;
    act(() => {
      oldAttempt.onWebGpuInitializationAttempt();
      initialization = initializeObserverWebGpuRenderer(
        () => ({
          init: () => pendingInitialization.promise,
          dispose: async () => undefined,
        }),
        oldAttempt.onWebGpuInitializationFailure,
      );
    });

    rerender({
      ...initialProps,
      requestIdentity: requestIdentityFor("architecture-rise", "webgpu"),
      backendSelection: selectionFor("architecture-rise", "webgpu"),
    });
    const architectureGeneration = result.current.mountGeneration;
    rerender(initialProps);
    const currentAttempt = result.current;
    expect(currentAttempt.mountGeneration).toBeGreaterThan(architectureGeneration);
    expect(currentAttempt.mountGeneration).not.toBe(oldGeneration);
    expect(currentAttempt.observerCapabilities).toBeNull();

    const currentCapabilities = capabilities("webgpu-renderer", "webgpu");
    act(() =>
      currentAttempt.onObserverCapabilitiesChange(
        currentAttempt.mountGeneration,
        currentCapabilities,
      ),
    );
    pendingInitialization.resolve();
    await act(async () => {
      await initialization;
    });
    act(() => {
      oldAttempt.onObserverCapabilitiesChange(oldGeneration, oldCapabilities);
      oldAttempt.onObserverCapabilitiesChange(oldGeneration, null);
    });

    expect(result.current.observerCapabilities).toEqual(currentCapabilities);
    expect(result.current.initializationAttempts).toBe(0);
    expect(result.current.rendererFailureStage).toBeNull();
    expect(onApplicationFallback).not.toHaveBeenCalled();
    expect(onFallbackRemount).not.toHaveBeenCalled();
    expect(onCanvasFailure).not.toHaveBeenCalled();
  });

  it("invalidates every callback when its owning Observer host unmounts", () => {
    const onApplicationFallback = vi.fn<(selection: ObserverBackendSelection) => void>();
    const onFallbackRemount = vi.fn();
    const onCanvasFailure = vi.fn();
    const { result, unmount } = renderHook(() =>
      useObserverRendererLifecycle({
        requestIdentity: requestIdentityFor("view-camera-anatomy", "webgpu"),
        backendSelection: selectionFor("view-camera-anatomy", "webgpu"),
        rendererMountKey: 0,
        onApplicationFallback,
        onFallbackRemount,
        onCanvasFailure,
      }),
    );
    const oldAttempt = result.current;
    const generation = oldAttempt.mountGeneration;
    unmount();

    act(() => {
      oldAttempt.onWebGpuInitializationAttempt();
      oldAttempt.onWebGpuInitializationFailure();
      oldAttempt.onObserverCanvasError();
      oldAttempt.onObserverCapabilitiesChange(
        generation,
        capabilities("webgpu-renderer", "webgpu"),
      );
      oldAttempt.onObserverCapabilitiesChange(generation, null);
    });

    expect(onApplicationFallback).not.toHaveBeenCalled();
    expect(onFallbackRemount).not.toHaveBeenCalled();
    expect(onCanvasFailure).not.toHaveBeenCalled();
  });
});
