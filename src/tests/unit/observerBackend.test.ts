import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  resolveObserverRendererInitializationFailure,
  selectArchitectureRiseWebGpuVerificationBackend,
  selectObserverBackend,
} from "../../render/backend/observerBackend";
import {
  initializeObserverWebGpuRenderer,
  resolveObserverCanvasInitialization,
} from "../../render/backend/observerRendererInitialization";
import { resolveObserverSceneCompatibility } from "../../render/backend/observerSceneCompatibility";
import { resolveObserverRendererRuntime } from "../../render/backend/observerVisualPipelineCapabilities";

const selectionInput = {
  webglAvailable: true,
  requestedRendererParam: null as string | null,
  sceneCompatibility: resolveObserverSceneCompatibility("view-camera-anatomy"),
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
      selectionReason: "default-webgl-request",
    });
  });

  it("keeps default requests on WebGL for both verified scenes", () => {
    for (const sceneId of ["view-camera-anatomy", "architecture-rise"]) {
      expect(selectObserverBackend({
        ...selectionInput,
        sceneCompatibility: resolveObserverSceneCompatibility(sceneId),
      })).toMatchObject({
        requestedRenderer: "webgl",
        rendererAttempt: "webgl",
        selectionReason: "default-webgl-request",
      });
    }
  });

  it("approves explicit development WebGPU pilot requests only for the two verified eligible scenes", () => {
    for (const sceneId of ["view-camera-anatomy", "architecture-rise"]) {
      expect(selectObserverBackend({
        ...selectionInput,
        requestedRendererParam: "webgpu",
        sceneCompatibility: resolveObserverSceneCompatibility(sceneId),
      })).toMatchObject({
        status: "selected",
        requestedRenderer: "webgpu-pilot",
        rendererAttempt: "webgpu",
        applicationFallback: "none",
        selectionReason: "webgpu-pilot-approved",
      });
    }
  });

  it("keeps Architecture Rise verification selection separate from its normal pilot request", () => {
    expect(selectArchitectureRiseWebGpuVerificationBackend(true)).toMatchObject({
      status: "selected",
      requestedRenderer: "webgpu-verification",
      rendererAttempt: "webgpu",
      applicationFallback: "none",
      selectionReason: "test-only-architecture-rise-verification",
    });
  });

  it("preserves one-shot application fallback for an Architecture Rise pilot attempt", () => {
    const selection = selectObserverBackend({
      ...selectionInput,
      requestedRendererParam: "webgpu",
      sceneCompatibility: resolveObserverSceneCompatibility("architecture-rise"),
    });
    expect(selection.status).toBe("selected");
    if (selection.status !== "selected") return;
    const fallback = resolveObserverRendererInitializationFailure(selection);
    expect(fallback).toMatchObject({
      status: "selected",
      requestedRenderer: "webgpu-pilot",
      rendererAttempt: "webgl",
      applicationFallback: "app-webgl",
      selectionReason: "webgpu-pilot-approved",
    });
    if (fallback.status !== "selected") return;
    expect(resolveObserverRendererInitializationFailure(fallback)).toMatchObject({
      status: "unavailable",
      failureReason: "renderer-initialization-failed",
      applicationFallback: "app-webgl",
    });
  });

  it("ignores the pilot query when the development gate is disabled", () => {
    for (const sceneId of ["view-camera-anatomy", "architecture-rise"]) {
      expect(selectObserverBackend({
        ...selectionInput,
        requestedRendererParam: "webgpu",
        developmentPilotEnabled: false,
        sceneCompatibility: resolveObserverSceneCompatibility(sceneId),
      })).toMatchObject({
        requestedRenderer: "webgpu-pilot",
        rendererAttempt: "webgl",
        selectionReason: "development-gate-disabled",
      });
    }
  });

  it("fails closed for an unknown scene and a registered unevaluated scene", () => {
    for (const sceneId of ["future-scene", "table-tilt"]) {
      expect(selectObserverBackend({
        ...selectionInput,
        requestedRendererParam: "webgpu",
        sceneCompatibility: resolveObserverSceneCompatibility(sceneId),
      })).toMatchObject({
        status: "selected",
        requestedRenderer: "webgpu-pilot",
        rendererAttempt: "webgl",
        selectionReason: "scene-requirements-not-declared",
      });
    }
  });

  it("does not attempt WebGPU for a scene whose declared rendering review is not evaluated", () => {
    const architectureRise = resolveObserverSceneCompatibility("architecture-rise");
    const unevaluated = {
      ...architectureRise,
      webgpu: { status: "not-evaluated" } as const,
      developmentWebGpuPilot: "not-eligible" as const,
    };
    expect(selectObserverBackend({
      ...selectionInput,
      requestedRendererParam: "webgpu",
      sceneCompatibility: unevaluated,
    })).toMatchObject({
      rendererAttempt: "webgl",
      selectionReason: "scene-compatibility-not-evaluated",
    });
  });

  it("rejects unknown renderer requests to the WebGL path", () => {
    expect(
      selectObserverBackend({ ...selectionInput, requestedRendererParam: "vulkan" }),
    ).toMatchObject({
      status: "selected",
      requestedRenderer: "unknown",
      rendererAttempt: "webgl",
      selectionReason: "unrecognized-renderer-request",
    });
  });

  it("does not enable a newly declared but unverified rendering requirement", () => {
    const architectureRise = resolveObserverSceneCompatibility("architecture-rise");
    if (architectureRise.webgpu.status !== "verified") {
      throw new Error("Architecture Rise verification evidence expected");
    }
    const incompleteReview = {
      ...architectureRise,
      webgpu: {
        ...architectureRise.webgpu,
        verifiedRequirements: architectureRise.webgpu.verifiedRequirements.filter(
          (requirement) => requirement !== "procedural-world-environment",
        ),
      },
    };
    expect(
      selectObserverBackend({
        ...selectionInput,
        requestedRendererParam: "webgpu",
        sceneCompatibility: incompleteReview,
      }),
    ).toMatchObject({
      rendererAttempt: "webgl",
      selectionReason: "scene-requirement-unverified",
    });
  });

  it("keeps a scene ineligible when a known backend constraint is present", () => {
    const architectureRise = resolveObserverSceneCompatibility("architecture-rise");
    const constrained = {
      ...architectureRise,
      knownBackendConstraints: ["procedural-world-environment-uses-webgl-pmrem"] as const,
    };
    expect(selectObserverBackend({
      ...selectionInput,
      requestedRendererParam: "webgpu",
      sceneCompatibility: constrained,
    })).toMatchObject({
      rendererAttempt: "webgl",
      selectionReason: "scene-has-known-webgpu-constraint",
    });
  });

  it("keeps verified scenes denied when their pilot approval is revoked", () => {
    const r186 = resolveObserverSceneCompatibility("architecture-rise", "186");
    expect(r186.webgpu).toMatchObject({
      status: "verified",
      rendererRevision: "186",
      evidence: "pr-251-native-architecture-rise-e2e",
    });
    const architectureRise = resolveObserverSceneCompatibility("architecture-rise", "187");
    expect(architectureRise.webgpu).toMatchObject({
      status: "verified",
      rendererRevision: "187",
      evidence: "r187-native-architecture-rise-verification-e2e",
    });
    const revoked = { ...architectureRise, developmentWebGpuPilot: "not-eligible" as const };
    expect(revoked.webgpu).toMatchObject({ status: "verified", evidence: "r187-native-architecture-rise-verification-e2e" });
    expect(selectObserverBackend({
      ...selectionInput,
      requestedRendererParam: "webgpu",
      sceneCompatibility: revoked,
    })).toMatchObject({
      rendererAttempt: "webgl",
      selectionReason: "scene-not-pilot-enabled",
    });
  });

  it("preserves the existing unavailable state when WebGL is absent", () => {
    expect(
      selectObserverBackend({ ...selectionInput, webglAvailable: false }),
    ).toMatchObject({
      status: "unavailable",
      failureReason: "no-supported-backend",
    });
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

  it("reports failed Architecture Rise initialization as unavailable when WebGL is unavailable", () => {
    const selection = selectObserverBackend({
      ...selectionInput,
      webglAvailable: false,
      requestedRendererParam: "webgpu",
      sceneCompatibility: resolveObserverSceneCompatibility("architecture-rise"),
    });
    expect(selection).toMatchObject({ status: "selected", rendererAttempt: "webgpu" });
    if (selection.status !== "selected") return;
    expect(resolveObserverRendererInitializationFailure(selection)).toMatchObject({
      status: "unavailable",
      failureReason: "renderer-initialization-failed",
    });
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

  it("uses R3F Canvas output controls only for the material-aware WebGPU candidate", () => {
    const webgpuSelection = selectObserverBackend({
      ...selectionInput,
      sceneCompatibility: resolveObserverSceneCompatibility("architecture-rise"),
      requestedRendererParam: "webgpu",
    });
    if (webgpuSelection.status !== "selected") throw new Error("Pilot selection expected");

    const standard = resolveObserverCanvasInitialization(
      webgpuSelection,
      true,
      vi.fn(),
      vi.fn(),
      "standard",
    );
    expect(standard.canvasProps).toEqual({ gl: expect.any(Function) });

    const materialAware = resolveObserverCanvasInitialization(
      webgpuSelection,
      true,
      vi.fn(),
      vi.fn(),
      "material-aware",
    );
    expect(materialAware.canvasProps).toEqual({
      gl: expect.any(Function),
      linear: true,
      flat: true,
    });

    const webglSelection = selectObserverBackend(selectionInput);
    if (webglSelection.status !== "selected") throw new Error("WebGL selection expected");
    expect(resolveObserverCanvasInitialization(
      webglSelection,
      true,
      vi.fn(),
      vi.fn(),
      "material-aware",
    ).canvasProps).toEqual({ gl: { antialias: true } });
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
