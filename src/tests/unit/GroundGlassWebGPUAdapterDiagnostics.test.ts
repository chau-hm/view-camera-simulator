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
import { resolveGroundGlassRawWebGpuEvidenceRevision } from "../../render/webgpu/groundGlassRawWebGpuCompatibility";
import { ARCHITECTURE_RISE_M6_R187_PRESENTATION_EVIDENCE_REVISION } from "../../render/webgpu/groundGlassM6PresentationPolicy";
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
  it("attributes mounted backend details to the installed Raw RTT qualification", () => {
    const { input, request, runtime, expectedEvidenceRevision } = createRawRttDiagnosticFixture();
    const target = new THREE.WebGLRenderTarget(input.widthPx, input.heightPx);

    try {
      expect(REVISION).toBe("187");
      expect(expectedEvidenceRevision).toBe("m3-architecture-rise-raw-rtt-native-r187-v1");
      const backendDetails = makeGroundGlassWebGpuDiagnosticDetails({
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
      });

      expect(backendDetails).toMatchObject({
        backend: "webgpu",
        rendererRevision: "r187",
        verificationEvidenceRevision: expectedEvidenceRevision,
        actualExecutionApi: "webgpu",
        internalFallback: "none",
      });
    } finally {
      target.dispose();
    }
  });

  it("attributes Raw RTT presentation diagnostics to the same qualification", () => {
    const { request, generation, expectedEvidenceRevision } = createRawRttDiagnosticFixture();
    expect(REVISION).toBe("187");
    expect(expectedEvidenceRevision).toBe("m3-architecture-rise-raw-rtt-native-r187-v1");

    const presentationDiagnostic = makeGroundGlassWebGpuPresentationDiagnostic({
      request,
      generation,
      status: "completed",
      source: "raw-scene-target",
      throughputGain: null,
      naturalIllumination: "bypassed",
      coverage: "bypassed",
    });

    expect(presentationDiagnostic).toMatchObject({
      rendererRevision: "r187",
      verificationEvidenceRevision: expectedEvidenceRevision,
    });
  });

  it("keeps M6 diagnostics on the distinct r187 presentation evidence", () => {
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
      const backendDetails = makeGroundGlassWebGpuDiagnosticDetails({
        request,
        target,
        camera: { left: -1, right: 1, top: 1, bottom: -1, near: 0.1, far: 100 },
        subjectChildCount: 1,
        runtime,
        backend: {},
        completedPasses: ["sceneRender", "presentation"],
      });
      const presentationDiagnostic = makeGroundGlassWebGpuPresentationDiagnostic({
        request,
        generation,
        status: "completed",
        source: "m5-research-composite",
        throughputGain: null,
        naturalIllumination: "bypassed",
        coverage: "bypassed",
      });

      expect(backendDetails).toMatchObject({
        rendererRevision: "r187",
        sceneSourceRevision: "architecture-rise-raw-rtt-v1+m6-presentation-v1",
        verificationEvidenceRevision: ARCHITECTURE_RISE_M6_R187_PRESENTATION_EVIDENCE_REVISION,
      });
      expect(presentationDiagnostic).toMatchObject({
        mode: "m6-experimental-dof",
        rendererRevision: "r187",
        sceneSourceRevision: "architecture-rise-raw-rtt-v1+m6-presentation-v1",
        verificationEvidenceRevision: ARCHITECTURE_RISE_M6_R187_PRESENTATION_EVIDENCE_REVISION,
      });
    } finally {
      target.dispose();
    }
  });
});
