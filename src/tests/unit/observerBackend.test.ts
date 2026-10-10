import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  initializeObserverWebGpuRenderer,
  resolveObserverCanvasInitialization,
  resolveObserverRendererInitializationFailure,
  resolveObserverRendererRuntime,
  selectObserverBackend,
} from "../../render/backend/observerBackend";

const selectionInput = {
  webglAvailable: true,
  requestedRendererParam: null as string | null,
  sceneId: "view-camera-anatomy",
  developmentPilotEnabled: true,
};

describe("Observer renderer selection policy", () => {
  it("keeps the normal route on WebGL", () => {
    expect(selectObserverBackend(selectionInput)).toEqual({
      status: "selected",
      requestedRenderer: "webgl",
      rendererAttempt: "webgl",
      applicationFallback: "none",
      webglAvailable: true,
    });
  });

  it("allows the explicit development pilot only on View Camera Anatomy", () => {
    expect(
      selectObserverBackend({ ...selectionInput, requestedRendererParam: "webgpu" }),
    ).toMatchObject({
      status: "selected",
      requestedRenderer: "webgpu-pilot",
      rendererAttempt: "webgpu",
      applicationFallback: "none",
    });
  });

  it("ignores the pilot query for other scenes", () => {
    expect(
      selectObserverBackend({
        ...selectionInput,
        requestedRendererParam: "webgpu",
        sceneId: "architecture-rise",
      }),
    ).toMatchObject({ requestedRenderer: "webgl", rendererAttempt: "webgl" });
  });

  it("ignores the pilot query when the development gate is disabled", () => {
    expect(
      selectObserverBackend({
        ...selectionInput,
        requestedRendererParam: "webgpu",
        developmentPilotEnabled: false,
      }),
    ).toMatchObject({ requestedRenderer: "webgl", rendererAttempt: "webgl" });
  });

  it("preserves the existing unavailable state when WebGL is absent", () => {
    expect(
      selectObserverBackend({ ...selectionInput, webglAvailable: false }),
    ).toMatchObject({ status: "unavailable", reason: "no-supported-backend" });
  });

  it("allows the bounded WebGPU attempt without treating the API hint as proof", () => {
    expect(
      selectObserverBackend({
        ...selectionInput,
        webglAvailable: false,
        requestedRendererParam: "webgpu",
      }),
    ).toMatchObject({ status: "selected", rendererAttempt: "webgpu" });
  });
});

describe("Observer renderer runtime classification", () => {
  it("classifies a mounted WebGLRenderer as WebGL2", () => {
    expect(resolveObserverRendererRuntime({ isWebGLRenderer: true })).toEqual({
      rendererFamily: "webgl-renderer",
      executionBackend: "webgl2",
    });
  });

  it("classifies an initialized WebGPURenderer using its public coordinate system", () => {
    expect(
      resolveObserverRendererRuntime({
        isWebGPURenderer: true,
        coordinateSystem: THREE.WebGPUCoordinateSystem,
      }),
    ).toEqual({ rendererFamily: "webgpu-renderer", executionBackend: "webgpu" });
    expect(
      resolveObserverRendererRuntime({
        isWebGPURenderer: true,
        coordinateSystem: THREE.WebGLCoordinateSystem,
      }),
    ).toEqual({
      rendererFamily: "webgpu-renderer",
      executionBackend: "webgl2-fallback",
    });
  });

  it("does not treat a WebGPU renderer marker alone as native WebGPU", () => {
    expect(resolveObserverRendererRuntime({ isWebGPURenderer: true })).toEqual({
      rendererFamily: "webgpu-renderer",
      executionBackend: "unknown",
    });
  });

  it("fails closed for unknown renderer identities", () => {
    expect(resolveObserverRendererRuntime({})).toEqual({
      rendererFamily: "unknown",
      executionBackend: "unknown",
    });
    expect(resolveObserverRendererRuntime(null)).toEqual({
      rendererFamily: "unknown",
      executionBackend: "unknown",
    });
  });
});

describe("Observer renderer initialization and fallback", () => {
  it("preserves the WebGL antialias option at the R3F seam", () => {
    const selection = selectObserverBackend(selectionInput);
    if (selection.status !== "selected") throw new Error("WebGL selection expected");
    expect(resolveObserverCanvasInitialization(selection, true, vi.fn())).toEqual({
      rendererAttempt: "webgl",
      canvasProps: { gl: { antialias: true } },
    });
  });

  it("falls back once from a failed WebGPU attempt to the legacy WebGL path", () => {
    const webgpuSelection = selectObserverBackend({
      ...selectionInput,
      requestedRendererParam: "webgpu",
    });
    if (webgpuSelection.status !== "selected") throw new Error("Pilot selection expected");
    const fallback = resolveObserverRendererInitializationFailure(webgpuSelection);
    expect(fallback).toMatchObject({
      status: "selected",
      requestedRenderer: "webgpu-pilot",
      rendererAttempt: "webgl",
      applicationFallback: "app-webgl",
    });
    if (fallback.status !== "selected") throw new Error("WebGL fallback expected");
    expect(resolveObserverRendererInitializationFailure(fallback)).toMatchObject({
      status: "unavailable",
      rendererAttempt: null,
      applicationFallback: "app-webgl",
    });
  });

  it("does not claim an application fallback when Three initializes on WebGL2 internally", () => {
    const runtime = resolveObserverRendererRuntime({
      isWebGPURenderer: true,
      coordinateSystem: THREE.WebGLCoordinateSystem,
    });
    expect(runtime.executionBackend).toBe("webgl2-fallback");
    // Successful init is reported as WebGPURenderer + internal fallback; the app failure transition is not used.
    expect(runtime.rendererFamily).toBe("webgpu-renderer");
  });

  it("returns a successfully initialized renderer", async () => {
    const init = vi.fn(async () => undefined);
    const dispose = vi.fn(async () => undefined);
    const renderer = { init, dispose };
    const onFailure = vi.fn();
    await expect(initializeObserverWebGpuRenderer(() => renderer, onFailure)).resolves.toBe(renderer);
    expect(init).toHaveBeenCalledOnce();
    expect(dispose).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("disposes a renderer whose async initialization fails and propagates the error", async () => {
    const error = new Error("backend initialization failed");
    const init = vi.fn(async () => { throw error; });
    const dispose = vi.fn(async () => undefined);
    const renderer = { init, dispose };
    const onFailure = vi.fn();
    await expect(initializeObserverWebGpuRenderer(() => renderer, onFailure)).rejects.toBe(error);
    expect(dispose).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledOnce();
  });
});
