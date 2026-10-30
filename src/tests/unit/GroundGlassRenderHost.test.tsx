import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GroundGlassRenderHost, GroundGlassRenderHostStateProvider } from "../../render/GroundGlassRenderHost";
import { GroundGlassCleanupEvidenceCoordinator } from "../../render/groundGlassCleanupEvidence";
import type { GroundGlassWebGLAdapterProps } from "../../render/GroundGlassWebGLAdapter";
import type {
  GroundGlassFrameResult,
  GroundGlassRendererGenerationIdentity,
} from "../../render/backend/groundGlassBackendContracts";
import type { GroundGlassRttRuntimeInfoChangeHandler } from "../../render/groundGlassRttDimensions";
import { selectGroundGlassBackend } from "../../render/backend/groundGlassBackendPolicy";
import { GroundGlassRenderHostState } from "../../render/groundGlassRenderHostState";
import { createGroundGlassRequestInput } from "./groundGlassFrameRequestFixtures";
import {
  createSyntheticCompatibility,
  createVerifiedFeature,
  createWebGpuPolicyInput,
  SYNTHETIC_PILOT_SESSION_ID,
} from "./groundGlassBackendTestFixtures";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import type {
  GroundGlassBackendDiagnosticDetails,
  GroundGlassMountedRuntimeEvidence,
  GroundGlassPilotRecoveryActionEvidence,
} from "../../render/backend/groundGlassBackendDiagnostics";
import type { GroundGlassFrameRequest } from "../../render/groundGlassFrameRequest";
import type { GroundGlassRenderOperationId } from "../../render/groundGlassPassGraph";

type MockWebGpuAdapterProps = Readonly<{
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
  onAdapterDisposed: (generation: GroundGlassRendererGenerationIdentity, outcome: "confirmed" | "failed" | "uncertain", reason?: string) => void;
  onFailure: (error: Error, stage: "initialization" | "runtime", failedPass: GroundGlassRenderOperationId | null) => void;
}>;

const adapterHarness = vi.hoisted(() => ({
  propsByGeneration: new Map<string, unknown>(),
  cleanupCallbacks: [] as Array<() => void>,
  failNextInitialization: false,
}));

const webGpuHarness = vi.hoisted(() => ({
  propsByGeneration: new Map<string, unknown>(),
  cleanupCallbacks: [] as Array<() => void>,
}));

const recoveryActionHarness = vi.hoisted(() => ({
  handlers: new Map<string, (action: "explicit-retry" | "new-pilot-session") => GroundGlassPilotRecoveryActionEvidence>(),
}));

vi.mock("../../render/GroundGlassWebGLAdapter", async () => {
  const ReactModule = await import("react");
  const MockAdapter = (props: GroundGlassWebGLAdapterProps) => {
    if (adapterHarness.failNextInitialization) {
      throw new Error("controlled adapter initialization failure");
    }
    adapterHarness.propsByGeneration.set(props.generation.generationId, props);
    ReactModule.useEffect(() => {
      props.onAdapterStarted(props.generation);
      return () => {
        adapterHarness.cleanupCallbacks.push(() =>
          props.onAdapterDisposed(props.generation, "confirmed"),
        );
      };
    }, [props.generation.generationId]);
    return ReactModule.createElement("div", {
      "data-testid": "controlled-webgl-adapter",
      "data-generation": props.generation.generationId,
    });
  };
  return { GroundGlassWebGLAdapter: MockAdapter };
});

vi.mock("../../render/webgpu/GroundGlassWebGPUAdapter", async () => {
  const ReactModule = await import("react");
  const MockAdapter = (props: MockWebGpuAdapterProps) => {
    webGpuHarness.propsByGeneration.set(props.generation.generationId, props);
    ReactModule.useEffect(() => {
      props.onAdapterStarted(props.generation);
      return () => {
        webGpuHarness.cleanupCallbacks.push(() =>
          props.onAdapterDisposed(props.generation, "confirmed"),
        );
      };
    }, [props.generation.generationId]);
    return ReactModule.createElement("div", {
      "data-testid": "controlled-webgpu-adapter",
      "data-generation": props.generation.generationId,
    });
  };
  return { GroundGlassWebGPUAdapter: MockAdapter };
});

vi.mock("../../render/webgpu/groundGlassWebGpuTestSeam", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../render/webgpu/groundGlassWebGpuTestSeam")>();
  return {
    ...actual,
    registerGroundGlassPilotRecoveryActionForTest: (
      channelId: string,
      _registrationId: string,
      handler: (action: "explicit-retry" | "new-pilot-session") => GroundGlassPilotRecoveryActionEvidence,
    ) => {
      recoveryActionHarness.handlers.set(channelId, handler);
      return () => {
        if (recoveryActionHarness.handlers.get(channelId) === handler) {
          recoveryActionHarness.handlers.delete(channelId);
        }
      };
    },
  };
});

const adapterProps = (generationId: string): GroundGlassWebGLAdapterProps => {
  const props = adapterHarness.propsByGeneration.get(generationId);
  if (!props) throw new Error(`No controlled adapter recorded for ${generationId}`);
  return props as GroundGlassWebGLAdapterProps;
};

const webGpuAdapterProps = (generationId: string): MockWebGpuAdapterProps => {
  const props = webGpuHarness.propsByGeneration.get(generationId);
  if (!props) throw new Error(`No controlled WebGPU adapter recorded for ${generationId}`);
  return props as MockWebGpuAdapterProps;
};

const completedFrame = (
  props: GroundGlassWebGLAdapterProps,
  frameId: string,
): Extract<GroundGlassFrameResult, { status: "completed" }> => ({
  status: "completed",
  generation: props.generation,
  request: props.request.identity,
  frameId,
  requiredOperations: "all-completed",
});

const architectureRiseWebGpuPolicyInput = () => createWebGpuPolicyInput({
  channelId: "default",
  sceneId: architectureRiseScene.id,
  sceneCompatibility: createSyntheticCompatibility(
    [createVerifiedFeature()],
    architectureRiseScene.id,
  ),
  authorization: {
    status: "authorized",
    source: "application-configuration",
    pilotSessionId: SYNTHETIC_PILOT_SESSION_ID,
  },
});

const asWebGlPolicyInput = (input: ReturnType<typeof architectureRiseWebGpuPolicyInput>) => ({
  ...input,
  requestedBackend: "webgl" as const,
});

const nativeRuntime = (generation: NonNullable<ReturnType<GroundGlassRenderHostState["getSnapshot"]>["activeGeneration"]>): GroundGlassMountedRuntimeEvidence => ({
  status: "mounted",
  generation,
  rendererFamily: "webgpu-renderer",
  actualExecutionApi: "webgpu",
  internalFallback: "none",
});

const webGpuDetails = (
  request: { identity: { requestId: string; sceneId: string } },
) => ({
  backend: "webgpu" as const,
  sceneId: request.identity.sceneId,
  requestId: request.identity.requestId,
  rendererRevision: "r186",
  sceneSourceRevision: "architecture-rise-raw-rtt-v1",
  verificationEvidenceRevision: "m3-architecture-rise-raw-rtt-native-v1",
  sceneSubject: {
    realization: "registered-ground-glass-profile" as const,
    mounted: true as const,
    childCount: 1,
  },
  camera: {
    coordinateSystem: "webgpu" as const,
    left: -1,
    right: 1,
    top: 1,
    bottom: -1,
    near: 0.1,
    far: 100,
  },
  actualExecutionApi: "webgpu" as const,
  internalFallback: "none" as const,
  adapterFeatures: [],
  deviceFeatures: [],
  textureStorageFormats: [],
  target: {
    widthPx: 500,
    heightPx: 400,
    colorFormat: "rgba8unorm" as const,
    depthAttachment: "enabled" as const,
    depthFormat: "depth24plus" as const,
    textureColorSpace: "no-color-space" as const,
    rendererOutputColorSpace: "srgb" as const,
    toneMapping: "none" as const,
  },
  completedPasses: [] as const,
});

const hostTree = (
  owner: GroundGlassRenderHostState,
  request: ReturnType<typeof createGroundGlassRequestInput>,
  onFramePublished?: (result: Extract<GroundGlassFrameResult, { status: "completed" }>) => void,
  onRuntimeInfoChange?: GroundGlassRttRuntimeInfoChangeHandler,
) => React.createElement(GroundGlassRenderHostStateProvider, {
  owner,
  children: React.createElement(GroundGlassRenderHost, { request, onFramePublished, onRuntimeInfoChange }),
});

afterEach(() => {
  cleanup();
  adapterHarness.propsByGeneration.clear();
  adapterHarness.cleanupCallbacks.length = 0;
  adapterHarness.failNextInitialization = false;
  webGpuHarness.propsByGeneration.clear();
  webGpuHarness.cleanupCallbacks.length = 0;
  recoveryActionHarness.handlers.clear();
  vi.unstubAllEnvs();
  Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
});

describe("GroundGlassRenderHost request and lifecycle authority", () => {
  it("keeps an active WebGPU selection isolated while a pending host requests WebGL", () => {
    const owner = new GroundGlassRenderHostState();
    const webGpuInput = architectureRiseWebGpuPolicyInput();
    const authorization = webGpuInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected pilot authorization");
    owner.beginPilotSession("default", authorization);
    const activeRequest = createGroundGlassRequestInput({ rawDebug: true });
    const pendingRequest = createGroundGlassRequestInput({ rawDebug: false });

    owner.attachHost("default", "host-a");
    owner.acceptRequest("default", "host-a", activeRequest, webGpuInput);
    const retiringGeneration = owner.getSnapshot("default").activeGeneration;
    if (!retiringGeneration) throw new Error("Expected active WebGPU generation");
    owner.markAdapterStarted("default", "host-a", retiringGeneration);
    owner.attachHost("default", "host-b");
    owner.acceptRequest("default", "host-b", pendingRequest, asWebGlPolicyInput(webGpuInput));

    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: "host-a",
      pendingHostId: "host-b",
      activeGeneration: retiringGeneration,
      selection: { status: "selected", selectedBackend: "webgpu" },
      pendingSelection: { status: "selected", selectedBackend: "webgl" },
      cleanupStatus: "none",
    });

    owner.detachHost("default", "host-a");
    expect(owner.getSnapshot("default")).toMatchObject({
      activeGeneration: null,
      retiringGeneration,
      selection: { status: "selected", selectedBackend: "webgpu" },
      pendingSelection: { status: "selected", selectedBackend: "webgl" },
      cleanupStatus: "pending",
    });
    const pendingRequestId = owner.getSnapshot("default").pendingRequest?.identity.requestId;
    owner.reportAdapterDisposed("default", retiringGeneration, "confirmed");
    const promoted = owner.getSnapshot("default");
    expect(promoted.activeHostId).toBe("host-b");
    expect(promoted.activeGeneration?.generationId).not.toBe(retiringGeneration.generationId);
    expect(promoted.activeRequest?.identity.requestId).toBe(pendingRequestId);
    expect(promoted.selection).toMatchObject({ status: "selected", selectedBackend: "webgl" });
  });

  it("keeps an active WebGL selection isolated until an authorized pending WebGPU request is promoted", () => {
    const owner = new GroundGlassRenderHostState();
    const webGpuInput = architectureRiseWebGpuPolicyInput();
    const authorization = webGpuInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected pilot authorization");
    owner.beginPilotSession("default", authorization);
    const webGlInput = asWebGlPolicyInput(webGpuInput);
    const activeRequest = createGroundGlassRequestInput({ rawDebug: false });
    const pendingRequest = createGroundGlassRequestInput({ rawDebug: true });

    owner.attachHost("default", "host-a");
    owner.acceptRequest("default", "host-a", activeRequest, webGlInput);
    const retiringGeneration = owner.getSnapshot("default").activeGeneration;
    if (!retiringGeneration) throw new Error("Expected active WebGL generation");
    owner.markAdapterStarted("default", "host-a", retiringGeneration);
    owner.attachHost("default", "host-b");
    owner.acceptRequest("default", "host-b", pendingRequest, webGpuInput);

    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: "host-a",
      activeGeneration: retiringGeneration,
      selection: { status: "selected", selectedBackend: "webgl" },
      pendingSelection: { status: "selected", selectedBackend: "webgpu" },
      cleanupStatus: "none",
    });
    owner.detachHost("default", "host-a");
    expect(owner.getSnapshot("default").activeGeneration).toBeNull();
    expect(owner.getSnapshot("default").retiringGeneration).toEqual(retiringGeneration);
    owner.reportAdapterDisposed("default", retiringGeneration, "confirmed");

    const promoted = owner.getSnapshot("default");
    expect(promoted.activeHostId).toBe("host-b");
    expect(promoted.activeGeneration?.generationId).not.toBe(retiringGeneration.generationId);
    expect(promoted.selection).toMatchObject({ status: "selected", selectedBackend: "webgpu" });
  });

  it("processes policy-only backend transitions without changing the accepted request identity", () => {
    const owner = new GroundGlassRenderHostState();
    const webGpuInput = architectureRiseWebGpuPolicyInput();
    const authorization = webGpuInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected pilot authorization");
    owner.beginPilotSession("default", authorization);
    const request = createGroundGlassRequestInput({ rawDebug: true });
    const webGlInput = asWebGlPolicyInput(webGpuInput);
    owner.attachHost("default", "host-a");
    owner.acceptRequest("default", "host-a", request, webGlInput);
    const oldGeneration = owner.getSnapshot("default").activeGeneration;
    const originalRequestId = owner.getSnapshot("default").activeRequest?.identity.requestId;
    if (!oldGeneration || !originalRequestId) throw new Error("Expected active WebGL request");
    owner.markAdapterStarted("default", "host-a", oldGeneration);

    owner.acceptRequest("default", "host-a", request, webGpuInput);
    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      pendingHostId: "host-a",
      activeGeneration: null,
      retiringGeneration: oldGeneration,
      selection: { status: "selected", selectedBackend: "webgl" },
      pendingSelection: { status: "selected", selectedBackend: "webgpu" },
      pendingRequest: { identity: { requestId: originalRequestId } },
      cleanupStatus: "pending",
    });
    owner.reportAdapterDisposed("default", oldGeneration, "confirmed");

    const promoted = owner.getSnapshot("default");
    expect(promoted.activeGeneration?.generationId).not.toBe(oldGeneration.generationId);
    expect(promoted.activeRequest?.identity.requestId).toBe(originalRequestId);
    expect(promoted.selection).toMatchObject({ status: "selected", selectedBackend: "webgpu" });
  });

  it("keeps request and generation identity stable when the same frame and policy are accepted again", () => {
    const owner = new GroundGlassRenderHostState();
    const request = createGroundGlassRequestInput();
    const policyInput = asWebGlPolicyInput(architectureRiseWebGpuPolicyInput());
    owner.attachHost("default", "host-a");
    owner.acceptRequest("default", "host-a", request, policyInput);
    const first = owner.getSnapshot("default");
    const requestId = first.activeRequest?.identity.requestId;
    const generationId = first.activeGeneration?.generationId;

    owner.acceptRequest("default", "host-a", request, { ...policyInput });

    expect(owner.getSnapshot("default")).toBe(first);
    expect(owner.getSnapshot("default").activeRequest?.identity.requestId).toBe(requestId);
    expect(owner.getSnapshot("default").activeGeneration?.generationId).toBe(generationId);
  });

  it("retires WebGPU after capability revocation without changing the frame request", () => {
    const owner = new GroundGlassRenderHostState();
    const webGpuInput = architectureRiseWebGpuPolicyInput();
    const authorization = webGpuInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected pilot authorization");
    owner.beginPilotSession("default", authorization);
    const request = createGroundGlassRequestInput({ rawDebug: true });
    owner.attachHost("default", "host-a");
    owner.acceptRequest("default", "host-a", request, webGpuInput);
    const oldGeneration = owner.getSnapshot("default").activeGeneration;
    const requestId = owner.getSnapshot("default").activeRequest?.identity.requestId;
    if (!oldGeneration || !requestId) throw new Error("Expected native WebGPU attempt state");
    owner.markAdapterStarted("default", "host-a", oldGeneration);

    const revokedPolicy = {
      ...webGpuInput,
      capabilityPreflight: {
        ...webGpuInput.capabilityPreflight,
        webgpuAvailability: "reported-unavailable" as const,
      },
    };
    owner.acceptRequest("default", "host-a", request, revokedPolicy);
    expect(owner.getSnapshot("default")).toMatchObject({
      selection: { status: "selected", selectedBackend: "webgpu" },
      pendingSelection: { status: "selected", selectedBackend: "webgl" },
      pendingRequest: { identity: { requestId } },
      retiringGeneration: oldGeneration,
      cleanupStatus: "pending",
    });
    owner.reportAdapterDisposed("default", oldGeneration, "confirmed");

    const promoted = owner.getSnapshot("default");
    expect(promoted.activeGeneration?.generationId).not.toBe(oldGeneration.generationId);
    expect(promoted).toMatchObject({
      activeRequest: { identity: { requestId } },
      selection: {
        status: "selected",
        selectedBackend: "webgl",
        selectionReason: "webgl-after-request-denial",
      },
      retryState: { status: "available" },
    });
  });

  it("fails closed on a scene or renderer revision mismatch during a policy-only update", () => {
    const owner = new GroundGlassRenderHostState();
    const webGpuInput = architectureRiseWebGpuPolicyInput();
    const authorization = webGpuInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected pilot authorization");
    owner.beginPilotSession("default", authorization);
    const request = createGroundGlassRequestInput({ rawDebug: true });
    owner.attachHost("default", "host-a");
    owner.acceptRequest("default", "host-a", request, webGpuInput);
    const oldGeneration = owner.getSnapshot("default").activeGeneration;
    const requestId = owner.getSnapshot("default").activeRequest?.identity.requestId;
    if (!oldGeneration || !requestId) throw new Error("Expected active WebGPU attempt");
    owner.markAdapterStarted("default", "host-a", oldGeneration);

    const compatibility = webGpuInput.sceneCompatibility;
    if (!compatibility) throw new Error("Expected verified synthetic scene evidence");
    const staleRevisionPolicy = {
      ...webGpuInput,
      sceneCompatibility: {
        ...compatibility,
        sourceRevision: `${compatibility.sourceRevision}-changed`,
      },
    };
    owner.acceptRequest("default", "host-a", request, staleRevisionPolicy);
    expect(owner.getSnapshot("default").pendingSelection).toMatchObject({
      status: "selected",
      selectedBackend: "webgl",
      selectionReason: "webgl-after-request-denial",
      policyDecision: {
        status: "denied",
        reasons: expect.arrayContaining(["scene-ineligible"]),
      },
    });
    expect(owner.getSnapshot("default").pendingRequest?.identity.requestId).toBe(requestId);

    const staleRendererPolicy = {
      ...webGpuInput,
      sceneCompatibility: {
        ...compatibility,
        features: compatibility.features.map((feature) => feature.status === "verified"
          ? {
              ...feature,
              testedContext: { ...feature.testedContext, rendererRevision: "three-test-r185" },
            }
          : feature),
      },
    };
    owner.acceptRequest("default", "host-a", request, staleRendererPolicy);
    expect(owner.getSnapshot("default").pendingSelection).toMatchObject({
      status: "selected",
      selectedBackend: "webgl",
      policyDecision: {
        status: "denied",
        sceneEligibility: {
          status: "denied",
          reasons: expect.arrayContaining(["renderer-revision-mismatch"]),
        },
      },
    });
    expect(owner.getSnapshot("default").pendingRequest?.identity.requestId).toBe(requestId);
  });

  it("allows an explicit authorized retry with the unchanged frame only after safe cleanup", () => {
    const owner = new GroundGlassRenderHostState();
    const policyInput = architectureRiseWebGpuPolicyInput();
    const authorization = policyInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected pilot authorization");
    owner.beginPilotSession("default", authorization);
    const request = createGroundGlassRequestInput({ rawDebug: true });
    owner.attachHost("default", "pilot-host");
    owner.acceptRequest("default", "pilot-host", request, policyInput);
    const firstGeneration = owner.getSnapshot("default").activeGeneration;
    if (!firstGeneration) throw new Error("Expected initial WebGPU generation");
    owner.markAdapterStarted("default", "pilot-host", firstGeneration);
    owner.reportAdapterFailure("default", "pilot-host", firstGeneration, "controlled initialization failure", "initialization");
    expect(owner.getDiagnostics("default")?.lastFailure).toMatchObject({
      hostId: "pilot-host",
      pilotSessionId: authorization.pilotSessionId,
      retryEpoch: 0,
      generation: firstGeneration,
      request: { channelId: "default", sceneId: architectureRiseScene.id },
      backend: "webgpu",
      stage: "initialization",
      failedPass: null,
      reason: "controlled initialization failure",
    });
    owner.requestSafeReplacement("default", "pilot-host", policyInput);
    const retryDuringCleanup = owner.authorizePilotRetry("default", policyInput, "explicit-retry");
    expect(retryDuringCleanup).toMatchObject({ status: "rejected", reason: "cleanup-not-confirmed" });
    expect(owner.getSnapshot("default").retryState).toMatchObject({
      status: "consumed",
      retryEpoch: 0,
      failureHistory: [{ failureReason: "controlled initialization failure" }],
    });
    owner.reportAdapterDisposed("default", firstGeneration, "confirmed");

    const fallbackGeneration = owner.getSnapshot("default").activeGeneration;
    const firstRequestId = owner.getSnapshot("default").activeRequest?.identity.requestId;
    if (!fallbackGeneration || !firstRequestId) throw new Error("Expected the confirmed WebGL fallback");
    owner.markAdapterStarted("default", "pilot-host", fallbackGeneration);
    owner.reportRendererMounted("default", "pilot-host", fallbackGeneration, "webgl2");
    const retry = owner.authorizePilotRetry("default", policyInput, "explicit-retry");
    expect(retry.status).toBe("authorized");
    if (retry.status !== "authorized") throw new Error("Expected explicit retry authorization");

    owner.acceptRequest("default", "pilot-host", request, {
      ...policyInput,
      retryState: retry.retryState,
    });
    expect(owner.getSnapshot("default")).toMatchObject({
      activeGeneration: null,
      retiringGeneration: fallbackGeneration,
      selection: { status: "selected", selectedBackend: "webgl" },
      pendingSelection: { status: "selected", selectedBackend: "webgpu" },
      pendingRequest: { identity: { requestId: firstRequestId } },
      retryState: { status: "explicit-retry-requested", failureHistory: [{ failureReason: "controlled initialization failure" }] },
    });
    owner.reportAdapterDisposed("default", fallbackGeneration, "confirmed");

    const retried = owner.getSnapshot("default");
    expect(retried.activeGeneration?.generationId).not.toBe(fallbackGeneration.generationId);
    expect(retried.activeRequest?.identity.requestId).toBe(firstRequestId);
    expect(retried.selection).toMatchObject({ status: "selected", selectedBackend: "webgpu" });
    expect(retried.retryState).toMatchObject({
      status: "explicit-retry-requested",
      retryEpoch: 1,
      failureHistory: [{
        channelId: "default",
        pilotSessionId: authorization.pilotSessionId,
        retryEpoch: 0,
        hostId: "pilot-host",
        rendererGenerationId: firstGeneration.generationId,
        requestId: firstRequestId,
        sceneId: architectureRiseScene.id,
        failedSceneId: architectureRiseScene.id,
        stage: "initialization",
        failedOperation: null,
        failureReason: "controlled initialization failure",
      }],
    });
    expect(owner.getDiagnostics("default")?.pilotRecoveryAction).toMatchObject({
      action: "explicit-retry",
      status: "authorized",
      retryEpoch: 1,
      reason: null,
    });
  });

  it("routes explicit retry and new-session actions through the app owner and preserves failed epochs", async () => {
    vi.stubEnv("VITE_GROUND_GLASS_WEBGPU_RAW_PILOT", "true");
    vi.stubEnv("VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION", "true");
    Object.defineProperty(navigator, "gpu", { value: {}, configurable: true });
    const owner = new GroundGlassRenderHostState();
    const request = createGroundGlassRequestInput({ rawDebug: false });
    const view = render(hostTree(owner, request));

    await waitFor(() => expect(recoveryActionHarness.handlers.has("default")).toBe(true));
    await waitFor(() => expect(webGpuHarness.propsByGeneration.size).toBe(1));
    const initialGeneration = owner.getSnapshot("default").activeGeneration;
    if (!initialGeneration) throw new Error("Expected an authorized initial WebGPU generation");
    const firstSessionId = owner.getSnapshot("default").retryState?.pilotSessionId;
    const firstWebGpuProps = webGpuAdapterProps(initialGeneration.generationId);
    await act(async () => {
      firstWebGpuProps.onFailure(new Error("initial controlled failure"), "initialization", null);
      await Promise.resolve();
    });
    await waitFor(() => expect(webGpuHarness.cleanupCallbacks).toHaveLength(1));
    act(() => webGpuHarness.cleanupCallbacks[0]());
    await waitFor(() => expect(owner.getSnapshot("default").selection).toMatchObject({
      status: "selected",
      selectedBackend: "webgl",
    }));
    const firstFallbackGeneration = owner.getSnapshot("default").activeGeneration;
    if (!firstFallbackGeneration) throw new Error("Expected confirmed WebGL fallback");
    await waitFor(() => expect(owner.getSnapshot("default").adapterStarted).toBe(true));

    const recoveryHandler = recoveryActionHarness.handlers.get("default");
    if (!recoveryHandler) throw new Error("Expected registered development recovery action");
    let explicitRetry: GroundGlassPilotRecoveryActionEvidence | undefined;
    act(() => { explicitRetry = recoveryHandler("explicit-retry"); });
    expect(explicitRetry).toMatchObject({
      action: "explicit-retry",
      status: "authorized",
      pilotSessionId: firstSessionId,
      retryEpoch: 1,
      reason: null,
    });
    await waitFor(() => expect(adapterHarness.cleanupCallbacks).toHaveLength(1));
    act(() => adapterHarness.cleanupCallbacks[0]());
    await waitFor(() => expect(webGpuHarness.propsByGeneration.size).toBe(2));
    const retryGeneration = owner.getSnapshot("default").activeGeneration;
    if (!retryGeneration) throw new Error("Expected the explicitly retried WebGPU generation");
    const retryWebGpuProps = webGpuAdapterProps(retryGeneration.generationId);
    await act(async () => {
      retryWebGpuProps.onFailure(new Error("explicit retry failed"), "runtime", null);
      await Promise.resolve();
    });
    await waitFor(() => expect(webGpuHarness.cleanupCallbacks).toHaveLength(2));
    act(() => webGpuHarness.cleanupCallbacks[1]());
    await waitFor(() => expect(owner.getSnapshot("default").selection).toMatchObject({
      status: "selected",
      selectedBackend: "webgl",
    }));
    await waitFor(() => expect(owner.getSnapshot("default").adapterStarted).toBe(true));
    expect(owner.getSnapshot("default").retryState).toMatchObject({
      status: "consumed",
      retryEpoch: 1,
      failureHistory: [
        { failureReason: "initial controlled failure" },
        { failureReason: "explicit retry failed" },
      ],
    });
    expect(webGpuHarness.propsByGeneration.size).toBe(2);

    const stateBeforeInvalidAction = owner.getSnapshot("default");
    const activeGenerationBeforeInvalidAction = stateBeforeInvalidAction.activeGeneration;
    const lastFailureBeforeInvalidAction = stateBeforeInvalidAction.lastFailure;
    let invalidAction: GroundGlassPilotRecoveryActionEvidence | undefined;
    act(() => { invalidAction = recoveryHandler("force-retry" as never); });
    expect(invalidAction).toMatchObject({
      action: "invalid",
      invalidAction: "force-retry",
      status: "rejected",
      pilotSessionId: firstSessionId,
      retryEpoch: 1,
      reason: "invalid-recovery-action",
    });
    expect(owner.getSnapshot("default")).toMatchObject({
      activeGeneration: activeGenerationBeforeInvalidAction,
      retryState: stateBeforeInvalidAction.retryState,
      lastFailure: lastFailureBeforeInvalidAction,
    });
    expect(webGpuHarness.propsByGeneration.size).toBe(2);

    let newSession: GroundGlassPilotRecoveryActionEvidence | undefined;
    act(() => { newSession = recoveryHandler("new-pilot-session"); });
    expect(newSession).toMatchObject({
      action: "new-pilot-session",
      status: "authorized",
      retryEpoch: 2,
      reason: null,
    });
    expect(newSession?.pilotSessionId).not.toBe(firstSessionId);
    await waitFor(() => expect(adapterHarness.cleanupCallbacks).toHaveLength(2));
    act(() => adapterHarness.cleanupCallbacks[1]());
    await waitFor(() => expect(webGpuHarness.propsByGeneration.size).toBe(3));
    expect(owner.getSnapshot("default").retryState).toMatchObject({
      status: "explicit-retry-requested",
      pilotSessionId: newSession?.pilotSessionId,
      retryEpoch: 2,
      failureHistory: [
        { failureReason: "initial controlled failure" },
        { failureReason: "explicit retry failed" },
      ],
    });
    expect(owner.getDiagnostics("default")?.pilotRecoveryAction).toEqual(newSession);
    expect(firstFallbackGeneration.generationId).not.toBe(initialGeneration.generationId);
    view.unmount();
  });

  it("rejects stale retry evidence and preserves consumed history until a fresh session is authorized", () => {
    const owner = new GroundGlassRenderHostState();
    const policyInput = architectureRiseWebGpuPolicyInput();
    const authorization = policyInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected pilot authorization");
    owner.beginPilotSession("default", authorization);
    const request = createGroundGlassRequestInput({ rawDebug: true });
    owner.attachHost("default", "pilot-host");
    owner.acceptRequest("default", "pilot-host", request, policyInput);
    const generation = owner.getSnapshot("default").activeGeneration;
    if (!generation) throw new Error("Expected initial WebGPU generation");
    owner.markAdapterStarted("default", "pilot-host", generation);
    owner.reportAdapterFailure("default", "pilot-host", generation, "first failure", "runtime");
    owner.requestSafeReplacement("default", "pilot-host", policyInput);
    owner.reportAdapterDisposed("default", generation, "confirmed");

    const consumed = owner.getSnapshot("default").retryState;
    if (!consumed || consumed.status !== "consumed") throw new Error("Expected consumed retry eligibility");
    const staleRendererEvidence = {
      ...policyInput,
      expectedCandidateRendererRevision: "three-test-r187",
    };
    const rejected = owner.authorizePilotRetry("default", staleRendererEvidence, "explicit-retry");
    expect(rejected).toMatchObject({ status: "rejected", reason: "policy-rejected" });
    expect(owner.getSnapshot("default").retryState).toEqual(consumed);
    expect(owner.getDiagnostics("default")?.pilotRecoveryAction).toMatchObject({
      action: "explicit-retry",
      status: "rejected",
      reason: "policy-rejected",
    });

    const newPilotSessionId = owner.createNewPilotSessionId("default");
    expect(newPilotSessionId).not.toBe(consumed.pilotSessionId);
    const newSessionPolicy = {
      ...policyInput,
      authorization: {
        status: "authorized" as const,
        source: "application-configuration" as const,
        pilotSessionId: newPilotSessionId,
      },
      retryState: consumed,
    };
    const newSession = owner.authorizePilotRetry("default", newSessionPolicy, "new-pilot-session");
    expect(newSession.status).toBe("authorized");
    if (newSession.status !== "authorized") throw new Error("Expected fresh-session authorization");
    expect(newSession.retryState).toMatchObject({
      pilotSessionId: newPilotSessionId,
      retryEpoch: consumed.retryEpoch + 1,
      status: "explicit-retry-requested",
      failureHistory: consumed.failureHistory,
    });
  });

  it("keeps a pending host request isolated from the active renderer generation", () => {
    const owner = new GroundGlassRenderHostState();
    const activeRequest = createGroundGlassRequestInput();
    const pendingRequest = createGroundGlassRequestInput({
      scene: understandingCameraMovementsScene,
      camera: { focusDistanceMm: 2400 },
      aperture: 16,
    });
    const view = render(React.createElement(
      GroundGlassRenderHostStateProvider,
      {
        owner,
        children: React.createElement(React.Fragment, null,
          React.createElement(GroundGlassRenderHost, { request: activeRequest }),
          React.createElement(GroundGlassRenderHost, { request: pendingRequest }),
        ),
      },
    ));

    const state = owner.getSnapshot("default");
    const activeGeneration = state.activeGeneration;
    if (!activeGeneration || !state.activeRequest || !state.pendingRequest) {
      throw new Error("Expected active and pending request ownership");
    }
    const activeAdapter = adapterProps(activeGeneration.generationId);
    expect(activeAdapter.request.identity).toEqual(state.activeRequest.identity);
    expect(activeAdapter.request.identity.sceneId).toBe(activeRequest.scene.id);
    expect(state.pendingRequest.identity.sceneId).toBe(understandingCameraMovementsScene.id);
    expect(adapterHarness.propsByGeneration.size).toBe(1);

    act(() => activeAdapter.onRendererMounted(activeGeneration, "webgl2"));
    const pendingResult: GroundGlassFrameResult = {
      status: "completed",
      generation: activeGeneration,
      request: state.pendingRequest.identity,
      frameId: "pending-host-must-not-publish",
      requiredOperations: "all-completed",
    };
    expect(owner.receiveFrameResult("default", state.activeHostId!, pendingResult)).toBe(false);
    expect(owner.canPublishFrameNow("default", state.activeHostId!, pendingResult)).toBe(false);
    expect(owner.getSnapshot("default").frame.lastSuccessfullyCompleted).toBeNull();
    view.unmount();
  });

  it("activates a replacement with only its latest request after confirmed cleanup", () => {
    const owner = new GroundGlassRenderHostState();
    const r1 = createGroundGlassRequestInput();
    const r2 = createGroundGlassRequestInput({
      scene: understandingCameraMovementsScene,
      camera: { focusDistanceMm: 1800 },
    });
    const r3 = createGroundGlassRequestInput({
      scene: understandingCameraMovementsScene,
      camera: { focusDistanceMm: 2100 },
    });
    const r4 = createGroundGlassRequestInput({
      scene: understandingCameraMovementsScene,
      camera: { focusDistanceMm: 2600 },
      aperture: 16,
    });

    owner.attachHost("default", "host-a");
    owner.acceptRequest("default", "host-a", r1);
    const retiringGeneration = owner.getSnapshot("default").activeGeneration;
    if (!retiringGeneration) throw new Error("Expected active generation");
    owner.markAdapterStarted("default", "host-a", retiringGeneration);
    owner.detachHost("default", "host-a");
    owner.attachHost("default", "host-b");
    owner.acceptRequest("default", "host-b", r2);
    owner.acceptRequest("default", "host-b", r3);
    owner.acceptRequest("default", "host-b", r4);

    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      pendingHostId: "host-b",
      activeGeneration: null,
      pendingRequest: { identity: { sceneId: understandingCameraMovementsScene.id } },
      cleanupStatus: "pending",
      frame: { current: null },
    });
    const latestPendingId = owner.getSnapshot("default").pendingRequest?.identity.requestId;
    owner.reportAdapterDisposed("default", retiringGeneration, "confirmed");

    const afterCleanup = owner.getSnapshot("default");
    expect(afterCleanup.activeHostId).toBe("host-b");
    expect(afterCleanup.activeGeneration?.generationId).not.toBe(retiringGeneration.generationId);
    expect(afterCleanup.activeRequest?.identity.requestId).toBe(latestPendingId);
    expect(afterCleanup.latestRequest?.identity.requestId).toBe(latestPendingId);
    expect(afterCleanup.frame.current).toMatchObject({
      status: "pending",
      request: { requestId: latestPendingId, sceneId: understandingCameraMovementsScene.id },
    });
    expect(afterCleanup.frame.lastSuccessfullyCompleted).toBeNull();
  });

  it("drops a pending host and its request when it detaches before cleanup", () => {
    const owner = new GroundGlassRenderHostState();
    owner.attachHost("default", "host-a");
    owner.acceptRequest("default", "host-a", createGroundGlassRequestInput());
    const generation = owner.getSnapshot("default").activeGeneration;
    if (!generation) throw new Error("Expected active generation");
    owner.markAdapterStarted("default", "host-a", generation);
    owner.detachHost("default", "host-a");
    owner.attachHost("default", "host-b");
    owner.acceptRequest("default", "host-b", createGroundGlassRequestInput({
      scene: understandingCameraMovementsScene,
    }));
    owner.detachHost("default", "host-b");

    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      pendingHostId: null,
      pendingRequest: null,
      retiringGeneration: generation,
      cleanupStatus: "pending",
      frame: { current: null },
    });
    owner.reportAdapterDisposed("default", generation, "confirmed");
    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      pendingHostId: null,
      activeGeneration: null,
      pendingRequest: null,
      retiringGeneration: null,
      cleanupStatus: "confirmed",
      frame: { current: null, lastSuccessfullyCompleted: null },
    });
  });

  it("keeps concurrent host handovers independent across comparison channels", () => {
    const owner = new GroundGlassRenderHostState();
    const channels = ["camera-movement-original", "camera-movement-current"] as const;
    for (const channel of channels) {
      owner.attachHost(channel, channel + "-a");
      owner.acceptRequest(channel, channel + "-a", createGroundGlassRequestInput({ channel }));
      const generation = owner.getSnapshot(channel).activeGeneration;
      if (!generation) throw new Error("Expected comparison channel generation");
      owner.markAdapterStarted(channel, channel + "-a", generation);
      owner.detachHost(channel, channel + "-a");
      owner.attachHost(channel, channel + "-b");
      owner.acceptRequest(channel, channel + "-b", createGroundGlassRequestInput({
        channel,
        scene: understandingCameraMovementsScene,
      }));
    }

    const originalRetiring = owner.getSnapshot(channels[0]).retiringGeneration;
    const currentBefore = owner.getSnapshot(channels[1]);
    if (!originalRetiring) throw new Error("Expected original channel retirement");
    owner.reportAdapterDisposed(channels[0], originalRetiring, "confirmed");

    expect(owner.getSnapshot(channels[0]).activeRequest?.identity.sceneId)
      .toBe(understandingCameraMovementsScene.id);
    expect(owner.getSnapshot(channels[1])).toMatchObject({
      activeHostId: null,
      activeGeneration: null,
      pendingHostId: "camera-movement-current-b",
      pendingRequest: currentBefore.pendingRequest,
      retiringGeneration: currentBefore.retiringGeneration,
      cleanupStatus: "pending",
    });
  });

  it("makes WebGL runtime failure terminal and rejects stale output and host remounts", async () => {
    const owner = new GroundGlassRenderHostState();
    const r1 = createGroundGlassRequestInput();
    const r2 = createGroundGlassRequestInput({
      scene: understandingCameraMovementsScene,
      camera: { focusDistanceMm: 1800 },
    });
    const published: string[] = [];
    const first = render(hostTree(
      owner,
      r1,
      (result) => published.push(result.request.requestId),
    ));
    const firstGeneration = owner.getSnapshot("default").activeGeneration;
    if (!firstGeneration) throw new Error("Expected initial renderer generation");

    act(() => adapterProps(firstGeneration.generationId).onRendererMounted(firstGeneration, "webgl2"));
    expect(owner.getSnapshot("default").mountedRuntime).toMatchObject({
      status: "mounted",
      rendererFamily: "webgl-renderer",
      actualExecutionApi: "webgl2",
    });

    const r1Props = adapterProps(firstGeneration.generationId);
    act(() => r1Props.onFrameResult({
      status: "failed",
      generation: firstGeneration,
      request: r1Props.request.identity,
      failedStage: "nearGather",
      failureReason: "controlled runtime failure",
    }));
    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      activeGeneration: null,
      retiringGeneration: firstGeneration,
      terminalWebGlFailure: true,
      cleanupStatus: "pending",
      lifecycleStatus: "retiring",
      lastFailure: { backend: "webgl", stage: "runtime", failedPass: "nearGather" },
    });

    const second = render(hostTree(
      owner,
      r2,
      (result) => published.push(result.request.requestId),
    ));
    first.unmount();
    await act(async () => { await Promise.resolve(); });
    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      retiringGeneration: firstGeneration,
      pendingHostId: null,
      cleanupStatus: "pending",
    });
    expect(adapterHarness.cleanupCallbacks).toHaveLength(1);

    act(() => adapterHarness.cleanupCallbacks[0]());
    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      activeGeneration: null,
      retiringGeneration: null,
      pendingHostId: null,
      terminalWebGlFailure: true,
      cleanupStatus: "confirmed",
      lifecycleStatus: "unavailable",
      mountedRuntime: { status: "unknown" },
    });
    act(() => r1Props.onFrameResult(completedFrame(r1Props, "late-r1")));
    expect(published).toEqual([]);
    expect(owner.getSnapshot("default").frame.lastSuccessfullyCompleted).toBeNull();
    expect(owner.getSnapshot("default").latestRequest?.scene.id).not.toBe(understandingCameraMovementsScene.id);
    expect(adapterHarness.propsByGeneration.size).toBe(1);
    second.unmount();
  });

  it("keeps one generation across resize and other request revisions", () => {
    const owner = new GroundGlassRenderHostState();
    const base = createGroundGlassRequestInput();
    const view = render(hostTree(owner, base));
    const before = owner.getSnapshot("default");
    if (!before.activeGeneration || !before.latestRequest) throw new Error("Expected initial host state");
    const generationId = before.activeGeneration.generationId;
    const requestId = before.latestRequest.identity.requestId;
    const sceneSnapshot = before.latestRequest.scene;

    view.rerender(hostTree(owner, createGroundGlassRequestInput({ widthPx: 720, heightPx: 480 })));
    const after = owner.getSnapshot("default");

    expect(after.activeGeneration?.generationId).toBe(generationId);
    expect(after.latestRequest?.identity.requestId).not.toBe(requestId);
    expect(after.latestRequest?.scene).toBe(sceneSnapshot);
    view.unmount();
  });

  it("keeps diagnostics reference-stable so the Surface callback cannot feed a render loop", () => {
    const owner = new GroundGlassRenderHostState();
    const request = createGroundGlassRequestInput();
    const notifications: Array<string | null> = [];
    const FeedbackHarness = () => {
      const [diagnostics, setDiagnostics] = React.useState<ReturnType<typeof owner.getDiagnostics>>(null);
      const [revision, setRevision] = React.useState(0);
      const onDiagnosticsChange = React.useCallback((
        _channel: typeof request.channel,
        next: ReturnType<typeof owner.getDiagnostics>,
      ) => {
        notifications.push(next?.requestIdentity.requestId ?? null);
        setDiagnostics(next);
      }, []);
      return React.createElement("div", null,
        React.createElement(GroundGlassRenderHost, { request, onDiagnosticsChange }),
        React.createElement("output", { "data-testid": "diagnostics-request" },
          diagnostics?.requestIdentity.requestId ?? "pending"),
        React.createElement("button", { onClick: () => setRevision((value) => value + 1) }, String(revision)),
      );
    };
    const view = render(React.createElement(GroundGlassRenderHostStateProvider, {
      owner,
      children: React.createElement(FeedbackHarness),
    }));
    const settledNotificationCount = notifications.length;

    expect(settledNotificationCount).toBeGreaterThan(0);
    expect(settledNotificationCount).toBeLessThan(4);
    expect(view.getByTestId("diagnostics-request").textContent)
      .toBe(owner.getSnapshot("default").latestRequest?.identity.requestId);

    fireEvent.click(view.getByRole("button"));
    expect(notifications).toHaveLength(settledNotificationCount);
    view.unmount();
  });

  it("keeps comparison channels independently versioned and mounted", () => {
    const owner = new GroundGlassRenderHostState();
    const originalRequest = createGroundGlassRequestInput({ channel: "camera-movement-original" });
    const currentRequest = createGroundGlassRequestInput({ channel: "camera-movement-current" });
    const tree = (current: typeof currentRequest) => React.createElement(
      GroundGlassRenderHostStateProvider,
      {
        owner,
        children: React.createElement(React.Fragment, null,
        React.createElement(GroundGlassRenderHost, { request: originalRequest }),
        React.createElement(GroundGlassRenderHost, { request: current }),
        ),
      },
    );
    const view = render(tree(currentRequest));
    const originalBefore = owner.getSnapshot("camera-movement-original");
    const currentBefore = owner.getSnapshot("camera-movement-current");
    if (!originalBefore.activeGeneration || !currentBefore.activeGeneration) throw new Error("Expected both channel generations");

    view.rerender(tree(createGroundGlassRequestInput({
      channel: "camera-movement-current",
      aperture: 22,
    })));

    expect(owner.getSnapshot("camera-movement-original").activeGeneration).toEqual(originalBefore.activeGeneration);
    expect(owner.getSnapshot("camera-movement-original").latestRequest?.identity.requestId)
      .toBe(originalBefore.latestRequest?.identity.requestId);
    expect(owner.getSnapshot("camera-movement-current").activeGeneration).toEqual(currentBefore.activeGeneration);
    expect(owner.getSnapshot("camera-movement-current").latestRequest?.identity.requestId)
      .not.toBe(currentBefore.latestRequest?.identity.requestId);
    view.unmount();
  });

  it("reports adapter initialization failure without claiming mounted runtime or completed output", () => {
    const owner = new GroundGlassRenderHostState();
    adapterHarness.failNextInitialization = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(hostTree(owner, createGroundGlassRequestInput()));
    const diagnostics = owner.getDiagnostics("default");

    expect(diagnostics?.attemptedBackend).toMatchObject({
      status: "failed",
      backend: "webgl",
      stage: "initialization",
    });
    expect(diagnostics?.mountedRuntime).toEqual({ status: "unknown" });
    expect(diagnostics?.frame.lastSuccessfullyCompleted).toBeNull();
    expect(diagnostics?.frame.current?.status).toBe("failed");
    expect(diagnostics?.cleanup.status).toBe("confirmed");
    expect(diagnostics?.lifecycleStatus).toBe("unavailable");
    expect(owner.getSnapshot("default").terminalWebGlFailure).toBe(true);

    view.unmount();
    consoleError.mockRestore();
  });

  it("blocks a pending generation when retirement cleanup is uncertain", () => {
    const owner = new GroundGlassRenderHostState();
    owner.attachHost("default", "retiring-host");
    owner.acceptRequest("default", "retiring-host", createGroundGlassRequestInput());
    const generation = owner.getSnapshot("default").activeGeneration;
    if (!generation) throw new Error("Expected initial generation");
    owner.markAdapterStarted("default", "retiring-host", generation);
    owner.detachHost("default", "retiring-host");
    owner.attachHost("default", "replacement-host");
    owner.acceptRequest("default", "replacement-host", createGroundGlassRequestInput({
      scene: understandingCameraMovementsScene,
    }));
    owner.reportAdapterDisposed("default", generation, "uncertain");

    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      activeGeneration: null,
      retiringGeneration: generation,
      pendingHostId: "replacement-host",
      cleanupStatus: "uncertain",
      lifecycleStatus: "unavailable",
    });
    expect(owner.getDiagnostics("default")?.rendererGeneration).toEqual(generation);
  });

  it("does not let a later confirmed notification erase failed cleanup or mount a replacement", () => {
    const owner = new GroundGlassRenderHostState();
    owner.attachHost("default", "retiring-host");
    owner.acceptRequest("default", "retiring-host", createGroundGlassRequestInput());
    const generation = owner.getSnapshot("default").activeGeneration;
    if (!generation) throw new Error("Expected initial generation");
    owner.markAdapterStarted("default", "retiring-host", generation);
    owner.detachHost("default", "retiring-host");
    owner.attachHost("default", "replacement-host");
    owner.acceptRequest("default", "replacement-host", createGroundGlassRequestInput({
      scene: understandingCameraMovementsScene,
    }));

    owner.reportAdapterDisposed("default", generation, "failed", "subject dispose failed");
    owner.reportAdapterDisposed("default", generation, "confirmed");

    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      activeGeneration: null,
      pendingHostId: "replacement-host",
      retiringGeneration: generation,
      cleanupStatus: "failed",
      cleanupFailureReason: "subject dispose failed",
      lifecycleStatus: "unavailable",
    });
  });

  it("keeps a partially initialized WebGL failure unavailable after owned cleanup", () => {
    const owner = new GroundGlassRenderHostState();
    owner.attachHost("default", "initializing-host");
    owner.acceptRequest("default", "initializing-host", createGroundGlassRequestInput());
    const firstGeneration = owner.getSnapshot("default").activeGeneration;
    if (!firstGeneration) throw new Error("Expected initial generation");
    owner.markAdapterStarted("default", "initializing-host", firstGeneration);
    owner.reportAdapterFailure(
      "default",
      "initializing-host",
      firstGeneration,
      "controlled failure after RTT allocation",
    );
    owner.detachHost("default", "initializing-host");
    owner.attachHost("default", "replacement-host");
    owner.acceptRequest("default", "replacement-host", createGroundGlassRequestInput({
      scene: understandingCameraMovementsScene,
    }));

    const coordinator = new GroundGlassCleanupEvidenceCoordinator((outcome, reason) => {
      owner.reportAdapterDisposed("default", firstGeneration, outcome, reason);
    });
    coordinator.acquired("rtt-targets");
    expect(owner.getSnapshot("default").activeGeneration).toBeNull();
    coordinator.ownerCleanupCompleted("rtt-targets", "confirmed");
    coordinator.rendererRetired("confirmed");

    const state = owner.getSnapshot("default");
    expect(state.activeHostId).toBeNull();
    expect(state.activeGeneration).toBeNull();
    expect(state.pendingHostId).toBeNull();
    expect(state.retiringGeneration).toBeNull();
    expect(state.terminalWebGlFailure).toBe(true);
    expect(state.lifecycleStatus).toBe("unavailable");
    expect(state.cleanupStatus).toBe("confirmed");
    expect(state.mountedRuntime).toEqual({ status: "unknown" });
    expect(state.frame).toMatchObject({
      current: { status: "failed" },
      lastSuccessfullyCompleted: null,
    });
  });

  it.each(["failed", "uncertain"] as const)(
    "keeps terminal WebGL failure unavailable when cleanup is %s and ignores later confirmation",
    (cleanupOutcome) => {
      const owner = new GroundGlassRenderHostState();
      owner.attachHost("default", "webgl-host");
      owner.acceptRequest("default", "webgl-host", createGroundGlassRequestInput());
      const generation = owner.getSnapshot("default").activeGeneration;
      if (!generation) throw new Error("Expected WebGL generation");
      owner.markAdapterStarted("default", "webgl-host", generation);
      owner.reportAdapterFailure(
        "default",
        "webgl-host",
        generation,
        "terminal WebGL runtime failure",
        "runtime",
        "nearGather",
      );
      owner.reportAdapterDisposed("default", generation, cleanupOutcome, "WebGL owned cleanup not confirmed");
      owner.attachHost("default", "replacement-host");
      owner.acceptRequest("default", "replacement-host", createGroundGlassRequestInput({
        scene: understandingCameraMovementsScene,
      }));
      owner.reportAdapterDisposed("default", generation, "confirmed");

      expect(owner.getSnapshot("default")).toMatchObject({
        activeHostId: null,
        activeGeneration: null,
        retiringGeneration: generation,
        pendingHostId: null,
        terminalWebGlFailure: true,
        cleanupStatus: cleanupOutcome,
        cleanupFailureReason: "WebGL owned cleanup not confirmed",
        lifecycleStatus: "unavailable",
        mountedRuntime: { status: "unknown" },
        frame: { current: { status: "failed" }, lastSuccessfullyCompleted: null },
      });
      expect(owner.requestSafeReplacement("default", "replacement-host")).toBe(false);
      expect(owner.beginPilotSession("default", {
        status: "authorized",
        source: "application-configuration",
        pilotSessionId: "should-not-restart-webgl",
      })).toBe(false);
    },
  );

  it("does not claim a successful WebGL fallback when its initialization fails", () => {
    const owner = new GroundGlassRenderHostState();
    const policyInput = architectureRiseWebGpuPolicyInput();
    const authorization = policyInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected pilot authorization");
    const request = createGroundGlassRequestInput({ rawDebug: true });
    owner.beginPilotSession("default", authorization);
    owner.attachHost("default", "pilot-host");
    owner.acceptRequest("default", "pilot-host", request, policyInput);
    const webGpuGeneration = owner.getSnapshot("default").activeGeneration;
    if (!webGpuGeneration) throw new Error("Expected initial WebGPU attempt");
    owner.markAdapterStarted("default", "pilot-host", webGpuGeneration);
    owner.reportAdapterFailure("default", "pilot-host", webGpuGeneration, "WebGPU initialization failure", "initialization");
    owner.requestSafeReplacement("default", "pilot-host", policyInput);
    owner.reportAdapterDisposed("default", webGpuGeneration, "confirmed");

    const webGlGeneration = owner.getSnapshot("default").activeGeneration;
    if (!webGlGeneration) throw new Error("Expected bounded WebGL fallback attempt");
    owner.reportAdapterFailure("default", "pilot-host", webGlGeneration, "WebGL initialization failure", "initialization");

    expect(owner.getSnapshot("default")).toMatchObject({
      terminalWebGlFailure: true,
      activeGeneration: null,
      retiringGeneration: null,
      lifecycleStatus: "unavailable",
      cleanupStatus: "confirmed",
      applicationFallback: { status: "not-observed" },
      mountedRuntime: { status: "unknown" },
      attemptedBackend: { status: "failed", backend: "webgl", stage: "initialization" },
      frame: { current: { status: "failed" }, lastSuccessfullyCompleted: null },
      lastFailure: { backend: "webgl", reason: "WebGL initialization failure" },
      retryState: { status: "consumed", failureHistory: [{ failureReason: "WebGPU initialization failure" }] },
    });
  });

  it("keeps retry state per channel and sticky across request changes and replacement", async () => {
    const owner = new GroundGlassRenderHostState();
    const policyInput = createWebGpuPolicyInput({ channelId: "default" });
    const policySelection = selectGroundGlassBackend(policyInput);
    const authorization = policyInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected synthetic test authorization");

    expect(owner.beginPilotSession("default", authorization)).toBe(true);
    expect(owner.beginPilotSession("camera-movement-original", authorization)).toBe(true);
    expect(owner.recordPilotAttemptFailure(
      "default",
      policySelection,
      "m1-synthetic-scene",
      "initialization",
      "controlled future WebGPU failure",
      {
        hostId: "synthetic-host",
        generation: { generationId: "synthetic-generation", channelId: "default" },
        request: {
          requestId: "synthetic-request",
          channelId: "default",
          sceneId: "m1-synthetic-scene",
        },
        failedOperation: "sceneRender",
      },
    )).toBe(true);

    const view = render(hostTree(owner, createGroundGlassRequestInput()));
    view.rerender(hostTree(owner, createGroundGlassRequestInput({
      camera: { focusDistanceMm: 2100 },
      aperture: 16,
      inspectionWindow: {
        active: true,
        centerU: 0.6,
        centerV: 0.4,
        widthFraction: 0.25,
        heightFraction: 0.25,
      },
    })));
    expect(owner.getSnapshot("default").retryState).toMatchObject({
      status: "consumed",
      failedSceneId: "m1-synthetic-scene",
      failureHistory: [{ stage: "initialization" }],
    });
    expect(owner.getSnapshot("camera-movement-original").retryState?.status).toBe("available");

    const oldGeneration = owner.getSnapshot("default").activeGeneration;
    const replacement = render(hostTree(owner, createGroundGlassRequestInput({
      scene: understandingCameraMovementsScene,
    })));
    view.unmount();
    await act(async () => { await Promise.resolve(); });
    act(() => adapterHarness.cleanupCallbacks[0]?.());

    expect(owner.getSnapshot("default").retryState).toMatchObject({
      status: "consumed",
      failedSceneId: "m1-synthetic-scene",
      failureHistory: [{ stage: "initialization" }],
    });
    expect(owner.getSnapshot("default").activeGeneration?.generationId)
      .not.toBe(oldGeneration?.generationId);
    expect(owner.getSnapshot("default").lastCleanupGeneration?.generationId)
      .toBe(oldGeneration?.generationId);
    replacement.unmount();
    await act(async () => { await Promise.resolve(); });
    act(() => adapterHarness.cleanupCallbacks[1]?.());
  });

  it("rejects a stale WebGL failure after a newer request in the same mounted generation", () => {
    const owner = new GroundGlassRenderHostState();
    const hostId = "webgl-host";
    const r1 = createGroundGlassRequestInput();
    const r2 = createGroundGlassRequestInput({ camera: { focusDistanceMm: 1800 } });
    owner.attachHost("default", hostId);
    owner.acceptRequest("default", hostId, r1);
    const initial = owner.getSnapshot("default");
    const generation = initial.activeGeneration;
    const acceptedR1 = initial.activeRequest;
    if (!generation || !acceptedR1) throw new Error("Expected mounted WebGL generation and R1");
    owner.markAdapterStarted("default", hostId, generation);
    owner.reportRendererMounted("default", hostId, generation, "webgl2");

    owner.acceptRequest("default", hostId, r2);
    const updated = owner.getSnapshot("default");
    const acceptedR2 = updated.activeRequest;
    if (!acceptedR2) throw new Error("Expected R2 to become the active request");
    const failureBeforeStaleResult = updated.lastFailure;
    const staleR1Failure: Extract<GroundGlassFrameResult, { status: "failed" }> = {
      status: "failed",
      generation,
      request: acceptedR1.identity,
      failedStage: "nearGather",
      failureReason: "delayed R1 WebGL frame failure",
    };

    expect(owner.receiveFrameResult("default", hostId, staleR1Failure)).toBe(false);
    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: hostId,
      activeGeneration: generation,
      retiringGeneration: null,
      terminalWebGlFailure: false,
      activeRequest: { identity: acceptedR2.identity },
      lastFailure: failureBeforeStaleResult,
      frame: { current: { status: "pending", request: acceptedR2.identity } },
    });

    const r2Completion: Extract<GroundGlassFrameResult, { status: "completed" }> = {
      status: "completed",
      generation,
      request: acceptedR2.identity,
      frameId: "r2-current-frame",
      requiredOperations: "all-completed",
    };
    expect(owner.receiveFrameResult("default", hostId, r2Completion)).toBe(true);
    expect(owner.getSnapshot("default").frame.lastSuccessfullyCompleted).toMatchObject({
      request: acceptedR2.identity,
      generation,
      frameId: "r2-current-frame",
    });
  });

  it("retires a current WebGL frame failure once and becomes unavailable after confirmed cleanup", () => {
    const owner = new GroundGlassRenderHostState();
    const hostId = "webgl-host";
    owner.attachHost("default", hostId);
    owner.acceptRequest("default", hostId, createGroundGlassRequestInput());
    const initial = owner.getSnapshot("default");
    const generation = initial.activeGeneration;
    const request = initial.activeRequest;
    if (!generation || !request) throw new Error("Expected current WebGL generation and request");
    owner.markAdapterStarted("default", hostId, generation);
    owner.reportRendererMounted("default", hostId, generation, "webgl2");

    const currentFailure: Extract<GroundGlassFrameResult, { status: "failed" }> = {
      status: "failed",
      generation,
      request: request.identity,
      failedStage: "sceneRender",
      failureReason: "current WebGL frame failed",
    };
    expect(owner.receiveFrameResult("default", hostId, currentFailure)).toBe(true);
    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      activeGeneration: null,
      retiringGeneration: generation,
      terminalWebGlFailure: true,
      cleanupStatus: "pending",
      lifecycleStatus: "retiring",
      lastFailure: { backend: "webgl", stage: "runtime", reason: "current WebGL frame failed" },
    });
    expect(owner.receiveFrameResult("default", hostId, currentFailure)).toBe(false);
    expect(owner.getSnapshot("default").retiringGeneration).toEqual(generation);

    owner.reportAdapterDisposed("default", generation, "confirmed");
    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      activeGeneration: null,
      pendingHostId: null,
      retiringGeneration: null,
      terminalWebGlFailure: true,
      cleanupStatus: "confirmed",
      lifecycleStatus: "unavailable",
      mountedRuntime: { status: "unknown" },
    });
    expect(owner.requestSafeReplacement("default", hostId)).toBe(false);
  });

  it("ignores a delayed failure from a retired WebGPU generation after WebGL replacement", () => {
    const owner = new GroundGlassRenderHostState();
    const policyInput = architectureRiseWebGpuPolicyInput();
    const authorization = policyInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected pilot authorization");
    owner.beginPilotSession("default", authorization);
    const r1 = createGroundGlassRequestInput({ rawDebug: true });
    owner.attachHost("default", "pilot-host");
    owner.acceptRequest("default", "pilot-host", r1, policyInput);
    const initial = owner.getSnapshot("default");
    const generation1 = initial.activeGeneration;
    const request1 = initial.activeRequest;
    if (!generation1 || !request1) throw new Error("Expected initial WebGPU generation and request");
    owner.markAdapterStarted("default", "pilot-host", generation1);
    owner.reportWebGpuRendererMounted(
      "default",
      "pilot-host",
      generation1,
      nativeRuntime(generation1),
      webGpuDetails(request1),
    );
    owner.reportAdapterFailure("default", "pilot-host", generation1, "first WebGPU failure", "runtime", "nearGather");
    owner.requestSafeReplacement("default", "pilot-host", policyInput);
    owner.reportAdapterDisposed("default", generation1, "confirmed");

    const replacement = owner.getSnapshot("default");
    const generation2 = replacement.activeGeneration;
    const request2 = replacement.activeRequest;
    if (!generation2 || !request2) throw new Error("Expected replacement generation and request");
    expect(generation2.generationId).not.toBe(generation1.generationId);
    expect(replacement.selection).toMatchObject({ status: "selected", selectedBackend: "webgl" });
    owner.markAdapterStarted("default", "pilot-host", generation2);
    owner.reportRendererMounted("default", "pilot-host", generation2, "webgl2");
    const beforeLateFailure = owner.getSnapshot("default");

    expect(owner.receiveFrameResult("default", "pilot-host", {
      status: "failed",
      generation: generation1,
      request: request1.identity,
      failedStage: "nearGather",
      failureReason: "late failure result from retired WebGPU generation",
    })).toBe(false);
    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: "pilot-host",
      activeGeneration: generation2,
      activeRequest: { identity: request2.identity },
      retiringGeneration: null,
      terminalWebGlFailure: false,
      retryState: beforeLateFailure.retryState,
      lastFailure: beforeLateFailure.lastFailure,
      lifecycleStatus: "rendering",
    });
  });

  it("uses the latest request after confirmed WebGPU cleanup and rejects late frame completions", () => {
    const owner = new GroundGlassRenderHostState();
    const policyInput = architectureRiseWebGpuPolicyInput();
    const authorization = policyInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected pilot authorization");
    owner.beginPilotSession("default", authorization);

    const r1 = createGroundGlassRequestInput({ rawDebug: true });
    const webGpuSelection = selectGroundGlassBackend(policyInput);
    expect(webGpuSelection).toMatchObject({ status: "selected", selectedBackend: "webgpu" });
    owner.attachHost("default", "pilot-host");
    owner.acceptRequest("default", "pilot-host", r1, policyInput);
    const webGpuGeneration = owner.getSnapshot("default").activeGeneration;
    const acceptedR1 = owner.getSnapshot("default").activeRequest;
    if (!webGpuGeneration || !acceptedR1) throw new Error("Expected the initial WebGPU generation and request");
    owner.markAdapterStarted("default", "pilot-host", webGpuGeneration);
    owner.reportWebGpuRendererMounted(
      "default",
      "pilot-host",
      webGpuGeneration,
      nativeRuntime(webGpuGeneration),
      webGpuDetails(acceptedR1),
    );

    expect(owner.reportAdapterFailure(
      "default",
      "pilot-host",
      webGpuGeneration,
      "controlled native device loss",
      "runtime",
      "sceneRender",
    )).toBe(true);
    const consumedRetry = owner.getSnapshot("default").retryState;
    expect(consumedRetry).toMatchObject({ status: "consumed", failedSceneId: architectureRiseScene.id });
    const fallbackSelection = selectGroundGlassBackend({ ...policyInput, retryState: consumedRetry });
    expect(fallbackSelection).toMatchObject({ status: "selected", selectedBackend: "webgl" });
    expect(owner.requestSafeReplacement("default", "pilot-host", policyInput)).toBe(true);

    const r2 = createGroundGlassRequestInput({
      rawDebug: true,
      camera: { focusDistanceMm: 7200 },
    });
    owner.acceptRequest("default", "pilot-host", r2, { ...policyInput, retryState: consumedRetry });
    expect(owner.getDiagnostics("default")?.requestIdentity.requestId)
      .toBe(owner.getSnapshot("default").pendingRequest?.identity.requestId);
    expect(owner.getSnapshot("default").pendingRequest?.identity.requestId)
      .not.toBe(acceptedR1.identity.requestId);
    owner.reportAdapterDisposed("default", webGpuGeneration, "confirmed");

    const fallback = owner.getSnapshot("default");
    const webGlGeneration = fallback.activeGeneration;
    const acceptedR2 = fallback.activeRequest;
    if (!webGlGeneration || !acceptedR2) throw new Error("Expected WebGL to activate the latest request");
    expect(webGlGeneration.generationId).not.toBe(webGpuGeneration.generationId);
    expect(acceptedR2.identity.requestId).not.toBe(acceptedR1.identity.requestId);
    expect(acceptedR2.opticsState).toEqual(r2.opticsState);
    owner.markAdapterStarted("default", "pilot-host", webGlGeneration);
    owner.reportRendererMounted("default", "pilot-host", webGlGeneration, "webgl2");
    expect(owner.getDiagnostics("default")?.applicationFallback).toMatchObject({
      status: "occurred",
      failedBackend: "webgpu",
      fallbackRendererFamily: "webgl-renderer",
      failureStage: "runtime",
    });

    const r2Result: Extract<GroundGlassFrameResult, { status: "completed" }> = {
      status: "completed",
      generation: webGlGeneration,
      request: acceptedR2.identity,
      frameId: "r2-complete",
      requiredOperations: "all-completed",
    };
    expect(owner.receiveFrameResult("default", "pilot-host", r2Result)).toBe(true);

    const r3 = createGroundGlassRequestInput({
      rawDebug: true,
      camera: { focusDistanceMm: 7200 },
      aperture: 22,
    });
    const r3Selection = selectGroundGlassBackend({ ...policyInput, retryState: owner.getSnapshot("default").retryState });
    expect(r3Selection.selectedBackend).toBe("webgl");
    owner.acceptRequest("default", "pilot-host", r3, { ...policyInput, retryState: owner.getSnapshot("default").retryState });
    expect(owner.receiveFrameResult("default", "pilot-host", r2Result)).toBe(false);
    const lateWebGpuResult: Extract<GroundGlassFrameResult, { status: "completed" }> = {
      status: "completed",
      generation: webGpuGeneration,
      request: acceptedR1.identity,
      frameId: "late-native-r1",
      requiredOperations: "all-completed",
    };
    expect(owner.receiveFrameResult("default", "pilot-host", lateWebGpuResult)).toBe(false);

    const acceptedR3 = owner.getSnapshot("default").activeRequest;
    if (!acceptedR3) throw new Error("Expected the latest accepted request");
    const r3Result: Extract<GroundGlassFrameResult, { status: "completed" }> = {
      status: "completed",
      generation: webGlGeneration,
      request: acceptedR3.identity,
      frameId: "r3-complete",
      requiredOperations: "all-completed",
    };
    expect(owner.receiveFrameResult("default", "pilot-host", r3Result)).toBe(true);
    expect(owner.canPublishFrameNow("default", "pilot-host", r3Result)).toBe(true);
    expect(owner.getSnapshot("default").retryState?.status).toBe("consumed");
  });

  it.each(["failed", "uncertain"] as const)("does not mount fallback after %s WebGPU cleanup", (cleanupOutcome) => {
    const owner = new GroundGlassRenderHostState();
    const policyInput = architectureRiseWebGpuPolicyInput();
    const authorization = policyInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected pilot authorization");
    owner.beginPilotSession("default", authorization);
    owner.attachHost("default", "pilot-host");
    const request = createGroundGlassRequestInput({ rawDebug: true });
    owner.acceptRequest("default", "pilot-host", request, policyInput);
    const generation = owner.getSnapshot("default").activeGeneration;
    if (!generation) throw new Error("Expected WebGPU generation");
    owner.markAdapterStarted("default", "pilot-host", generation);
    owner.reportAdapterFailure("default", "pilot-host", generation, "controlled renderer failure", "runtime", "sceneRender");
    owner.requestSafeReplacement("default", "pilot-host", policyInput);
    owner.reportAdapterDisposed("default", generation, cleanupOutcome, "controlled cleanup result");

    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      activeGeneration: null,
      retiringGeneration: generation,
      cleanupStatus: cleanupOutcome,
      lifecycleStatus: "unavailable",
      retryState: { status: "consumed" },
    });
    expect(owner.getDiagnostics("default")?.applicationFallback).toEqual({ status: "not-observed" });
  });

  it("binds a request accepted during WebGPU cleanup to its new scene and preserves the consumed session", () => {
    const owner = new GroundGlassRenderHostState();
    const policyInput = architectureRiseWebGpuPolicyInput();
    const authorization = policyInput.authorization;
    if (authorization.status !== "authorized") throw new Error("Expected pilot authorization");
    owner.beginPilotSession("default", authorization);
    owner.attachHost("default", "pilot-host");
    const initial = createGroundGlassRequestInput({ rawDebug: true });
    owner.acceptRequest("default", "pilot-host", initial, policyInput);
    const generation = owner.getSnapshot("default").activeGeneration;
    if (!generation) throw new Error("Expected WebGPU generation");
    owner.markAdapterStarted("default", "pilot-host", generation);
    owner.reportAdapterFailure("default", "pilot-host", generation, "controlled init failure", "initialization");
    owner.requestSafeReplacement("default", "pilot-host", policyInput);

    const switchedSceneRequest = createGroundGlassRequestInput({ scene: understandingCameraMovementsScene });
    const scenePolicyInput = {
      ...policyInput,
      requestedBackend: null,
      sceneId: understandingCameraMovementsScene.id,
      requestedFeatures: [],
      sceneCompatibility: null,
      retryState: owner.getSnapshot("default").retryState,
    };
    owner.acceptRequest("default", "pilot-host", switchedSceneRequest, scenePolicyInput);
    owner.reportAdapterDisposed("default", generation, "confirmed");

    expect(owner.getSnapshot("default")).toMatchObject({
      activeRequest: { identity: { sceneId: understandingCameraMovementsScene.id } },
      selection: { status: "selected", selectedBackend: "webgl" },
      retryState: { status: "consumed", failedSceneId: architectureRiseScene.id },
    });
  });
});
