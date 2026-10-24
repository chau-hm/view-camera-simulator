import { describe, expect, it } from "vitest";
import {
  isGroundGlassNativeWebGpuRuntime,
} from "../../render/backend/groundGlassBackendDiagnostics";
import type {
  GroundGlassBackendDiagnostics,
  GroundGlassMountedRuntimeEvidence,
} from "../../render/backend/groundGlassBackendDiagnostics";
import {
  canPublishGroundGlassFrame,
  createGroundGlassPilotRetryState,
} from "../../render/backend/groundGlassBackendContracts";
import type { GroundGlassFrameResult } from "../../render/backend/groundGlassBackendContracts";
import { selectGroundGlassBackend } from "../../render/backend/groundGlassBackendPolicy";
import {
  createWebGpuPolicyInput,
  SYNTHETIC_CHANNEL_ID,
  SYNTHETIC_PILOT_SESSION_ID,
  SYNTHETIC_SCENE_ID,
} from "./groundGlassBackendTestFixtures";

const requestIdentity = {
  requestId: "frame-state-8",
  channelId: SYNTHETIC_CHANNEL_ID,
  sceneId: SYNTHETIC_SCENE_ID,
} as const;

const webGpuSelection = () => {
  const selection = selectGroundGlassBackend(createWebGpuPolicyInput());
  if (selection.status !== "selected" || selection.selectedBackend !== "webgpu") {
    throw new Error("Synthetic test request should select an authorized WebGPU attempt");
  }
  return selection;
};

const diagnostics = (
  overrides: Partial<GroundGlassBackendDiagnostics> = {},
): GroundGlassBackendDiagnostics => ({
  requestIdentity,
  pilotSessionId: SYNTHETIC_PILOT_SESSION_ID,
  policySelection: webGpuSelection(),
  attemptedBackend: { status: "not-started" },
  mountedRuntime: { status: "unknown" },
  applicationFallback: { status: "not-observed" },
  rendererGeneration: null,
  lifecycleStatus: "idle",
  cleanup: { status: "not-required" },
  frame: { current: null, lastSuccessfullyCompleted: null },
  retryState: createGroundGlassPilotRetryState(SYNTHETIC_CHANNEL_ID, SYNTHETIC_PILOT_SESSION_ID),
  backendDetails: null,
  ...overrides,
});

describe("Ground Glass runtime diagnostics contract", () => {
  it("keeps a matching candidate revision and reported WebGPU capability separate from mounted execution", () => {
    const result = diagnostics();
    expect(result.policySelection).toMatchObject({
      selectedBackend: "webgpu",
      policyDecision: { capabilityPreflight: { status: "satisfied" } },
    });
    expect(result.attemptedBackend).toEqual({ status: "not-started" });
    expect(result.mountedRuntime).toEqual({ status: "unknown" });
    expect(result.rendererGeneration).toBeNull();
    expect(result.frame).toEqual({ current: null, lastSuccessfullyCompleted: null });
    expect(result).not.toHaveProperty("navigator");
    expect(result.policySelection).not.toHaveProperty("expectedCandidateRendererRevision");
  });

  it("does not place actual execution identity on a WebGPU policy selection", () => {
    const selection = webGpuSelection();
    expect(selection).not.toHaveProperty("rendererFamily");
    expect(selection).not.toHaveProperty("actualExecutionApi");
    expect(selection).not.toHaveProperty("mountedRuntime");
  });

  it("distinguishes native WebGPU from WebGPURenderer using its WebGL2 compatibility path", () => {
    const nativeRuntime: GroundGlassMountedRuntimeEvidence = {
      status: "mounted",
      generation: { generationId: "generation-native", channelId: SYNTHETIC_CHANNEL_ID },
      rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgpu",
      internalFallback: "none",
    };
    const compatibilityRuntime: GroundGlassMountedRuntimeEvidence = {
      status: "mounted",
      generation: { generationId: "generation-compat", channelId: SYNTHETIC_CHANNEL_ID },
      rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgl2",
      internalFallback: "webgl2-compatibility",
    };

    expect(isGroundGlassNativeWebGpuRuntime(nativeRuntime)).toBe(true);
    expect(isGroundGlassNativeWebGpuRuntime(compatibilityRuntime)).toBe(false);
    expect(compatibilityRuntime).toMatchObject({
      rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgl2",
      internalFallback: "webgl2-compatibility",
    });
  });

  it("reports application WebGL fallback independently from internal WebGL2 execution", () => {
    const internalFallback = diagnostics({
      attemptedBackend: { status: "mounted", backend: "webgpu" },
      mountedRuntime: {
        status: "mounted",
        generation: { generationId: "generation-internal-fallback", channelId: SYNTHETIC_CHANNEL_ID },
        rendererFamily: "webgpu-renderer",
        actualExecutionApi: "webgl2",
        internalFallback: "webgl2-compatibility",
      },
      rendererGeneration: {
        generationId: "generation-internal-fallback",
        channelId: SYNTHETIC_CHANNEL_ID,
      },
    });
    const applicationFallback = diagnostics({
      attemptedBackend: {
        status: "failed",
        backend: "webgpu",
        stage: "initialization",
        failureReason: "device request failed",
      },
      mountedRuntime: {
        status: "mounted",
        generation: { generationId: "generation-app-fallback", channelId: SYNTHETIC_CHANNEL_ID },
        rendererFamily: "webgl-renderer",
        actualExecutionApi: "webgl2",
        internalFallback: "none",
      },
      applicationFallback: {
        status: "occurred",
        failedBackend: "webgpu",
        fallbackRendererFamily: "webgl-renderer",
        failureStage: "initialization",
        reason: "device request failed",
      },
      rendererGeneration: {
        generationId: "generation-app-fallback",
        channelId: SYNTHETIC_CHANNEL_ID,
      },
    });

    expect(internalFallback.applicationFallback).toEqual({ status: "not-observed" });
    expect(internalFallback.mountedRuntime).toMatchObject({
      rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgl2",
      internalFallback: "webgl2-compatibility",
    });
    expect(applicationFallback.mountedRuntime).toMatchObject({
      rendererFamily: "webgl-renderer",
      actualExecutionApi: "webgl2",
      internalFallback: "none",
    });
    expect(applicationFallback.applicationFallback).toMatchObject({
      status: "occurred",
      failedBackend: "webgpu",
      fallbackRendererFamily: "webgl-renderer",
    });
  });

  it("keeps failed current-frame evidence separate from successful completed output", () => {
    const failedFrame: GroundGlassFrameResult = {
      status: "failed",
      request: requestIdentity,
      generation: { generationId: "generation-1", channelId: SYNTHETIC_CHANNEL_ID },
      failedStage: "nearGather",
      failureReason: "injected gather failure",
    };
    const result = diagnostics({
      mountedRuntime: {
        status: "mounted",
        generation: { generationId: "generation-1", channelId: SYNTHETIC_CHANNEL_ID },
        rendererFamily: "webgpu-renderer",
        actualExecutionApi: "webgpu",
        internalFallback: "none",
      },
      rendererGeneration: { generationId: "generation-1", channelId: SYNTHETIC_CHANNEL_ID },
      lifecycleStatus: "failed",
      frame: { current: failedFrame, lastSuccessfullyCompleted: null },
    });

    expect(result.frame.current).toMatchObject({ status: "failed", failedStage: "nearGather" });
    expect(result.frame.lastSuccessfullyCompleted).toBeNull();
    expect(canPublishGroundGlassFrame(failedFrame, {
      mounted: true,
      activeGeneration: { generationId: "generation-1", channelId: SYNTHETIC_CHANNEL_ID },
      latestAcceptedRequest: requestIdentity,
    })).toBe(false);
  });
});
