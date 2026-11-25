import * as THREE from "three";
import { REVISION } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGroundGlassFrameRequest } from "../../render/groundGlassFrameRequest";
import type { GroundGlassRendererGenerationIdentity } from "../../render/backend/groundGlassBackendContracts";
import type { GroundGlassMountedRuntimeEvidence } from "../../render/backend/groundGlassBackendDiagnostics";
import {
  makeGroundGlassWebGpuDiagnosticDetails,
  makeGroundGlassWebGpuPresentationDiagnostic,
} from "../../render/webgpu/groundGlassWebGpuDiagnostics";
import {
  ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
  ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION,
  resolveGroundGlassRawWebGpuEvidenceRevision,
} from "../../render/webgpu/groundGlassRawWebGpuCompatibility";
import {
  ARCHITECTURE_RISE_M6_PRESENTATION_SOURCE_REVISION,
  isGroundGlassM6PresentationBuildEnabled,
} from "../../render/webgpu/groundGlassM6PresentationPolicy";
import { createGroundGlassRequestInput } from "./groundGlassFrameRequestFixtures";

const createRawRttDiagnosticFixture = () => {
  const input = createGroundGlassRequestInput({ rawDebug: true });
  const request = createGroundGlassFrameRequest(input, {
    requestId: "r187-adapter-diagnostic",
    channelId: input.channel,
    sceneId: input.scene.id,
  });
  const generation: GroundGlassRendererGenerationIdentity = {
    generationId: "r187-adapter-generation",
    channelId: input.channel,
  };
  const runtime: GroundGlassMountedRuntimeEvidence = {
    status: "mounted",
    generation,
    rendererFamily: "webgpu-renderer",
    actualExecutionApi: "webgpu",
    internalFallback: "none",
  };
  return {
    input,
    request,
    generation,
    runtime,
    expectedEvidenceRevision: resolveGroundGlassRawWebGpuEvidenceRevision(`r${REVISION}`),
  };
};

afterEach(() => vi.unstubAllEnvs());

describe("GroundGlassWebGPUAdapter diagnostic evidence attribution", () => {
  it("publishes source-bound diagnostics for the revalidated r187 v2 Raw RTT feature", () => {
    const { input, request, runtime, expectedEvidenceRevision } = createRawRttDiagnosticFixture();
    const target = new THREE.WebGLRenderTarget(input.widthPx, input.heightPx);

    try {
      expect(REVISION).toBe("187");
      expect(ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION)
        .toBe("m3-architecture-rise-raw-rtt-native-r187-v2");
      expect(expectedEvidenceRevision).toBe(ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION);
      expect(makeGroundGlassWebGpuDiagnosticDetails({
        request,
        target,
        camera: { left: -1, right: 1, top: 1, bottom: -1, near: 0.1, far: 100 },
        subjectChildCount: 1,
        runtime,
        backend: {
          adapter: { features: [] },
          device: {
            features: [],
          },
        },
        completedPasses: ["sceneRender", "textureDisplay"],
      })).toMatchObject({
        sceneSourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
        verificationEvidenceRevision: ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION,
        actualExecutionApi: "webgpu",
        internalFallback: "none",
      });
    } finally {
      target.dispose();
    }
  });

  it("publishes r187 Raw display diagnostics against the verified M3 evidence", () => {
    const { request, generation, expectedEvidenceRevision } = createRawRttDiagnosticFixture();
    expect(REVISION).toBe("187");
    expect(expectedEvidenceRevision).toBe(ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION);
    expect(makeGroundGlassWebGpuPresentationDiagnostic({
      request,
      generation,
      status: "completed",
      source: "raw-scene-target",
      throughputGain: null,
      naturalIllumination: "bypassed",
      coverage: "bypassed",
    })).toMatchObject({
      sceneSourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
      verificationEvidenceRevision: ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION,
      mode: "raw-diagnostic",
    });
  });

  it("keeps M6 disabled and its historical evidence separate after M3 v2 revalidation", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_GROUND_GLASS_WEBGPU_RAW_PILOT", "true");
    vi.stubEnv("VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION", "true");

    const input = createGroundGlassRequestInput({ rawDebug: false });
    const request = createGroundGlassFrameRequest(input, {
      requestId: "m6-adapter-diagnostic",
      channelId: input.channel,
      sceneId: input.scene.id,
    });
    const generation: GroundGlassRendererGenerationIdentity = {
      generationId: "m6-adapter-generation",
      channelId: input.channel,
    };
    const runtime: GroundGlassMountedRuntimeEvidence = {
      status: "mounted",
      generation,
      rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgpu",
      internalFallback: "none",
    };
    const target = new THREE.WebGLRenderTarget(input.widthPx, input.heightPx);

    try {
      expect(ARCHITECTURE_RISE_M6_PRESENTATION_SOURCE_REVISION)
        .toBe("architecture-rise-raw-rtt-v1+m6-presentation-v1");
      expect(isGroundGlassM6PresentationBuildEnabled()).toBe(false);
      expect(makeGroundGlassWebGpuDiagnosticDetails({
        request,
        target,
        camera: { left: -1, right: 1, top: 1, bottom: -1, near: 0.1, far: 100 },
        subjectChildCount: 1,
        runtime,
        backend: {},
        completedPasses: ["sceneRender", "presentation"],
      })).toMatchObject({
        sceneSourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
        verificationEvidenceRevision: ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION,
      });
      expect(makeGroundGlassWebGpuPresentationDiagnostic({
        request,
        generation,
        status: "completed",
        source: "m5-research-composite",
        throughputGain: null,
        naturalIllumination: "bypassed",
        coverage: "bypassed",
      })).toMatchObject({
        mode: "raw-diagnostic",
        sceneSourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
        verificationEvidenceRevision: ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION,
      });
    } finally {
      target.dispose();
    }
  });
});
