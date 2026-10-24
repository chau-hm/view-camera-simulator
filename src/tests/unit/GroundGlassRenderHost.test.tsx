import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GroundGlassRenderHost, GroundGlassRenderHostStateProvider } from "../../render/GroundGlassRenderHost";
import { GroundGlassCleanupEvidenceCoordinator } from "../../render/groundGlassCleanupEvidence";
import type { GroundGlassWebGLAdapterProps } from "../../render/GroundGlassWebGLAdapter";
import type { GroundGlassFrameResult } from "../../render/backend/groundGlassBackendContracts";
import type { GroundGlassRuntimeInfoObservation } from "../../render/groundGlassRuntimeObservation";
import type { GroundGlassRttRuntimeInfoChangeHandler } from "../../render/groundGlassRttDimensions";
import { selectGroundGlassBackend } from "../../render/backend/groundGlassBackendPolicy";
import { GroundGlassRenderHostState } from "../../render/groundGlassRenderHostState";
import { createGroundGlassRequestInput } from "./groundGlassFrameRequestFixtures";
import { createWebGpuPolicyInput } from "./groundGlassBackendTestFixtures";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";

const adapterHarness = vi.hoisted(() => ({
  propsByGeneration: new Map<string, unknown>(),
  cleanupCallbacks: [] as Array<() => void>,
  failNextInitialization: false,
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

const adapterProps = (generationId: string): GroundGlassWebGLAdapterProps => {
  const props = adapterHarness.propsByGeneration.get(generationId);
  if (!props) throw new Error(`No controlled adapter recorded for ${generationId}`);
  return props as GroundGlassWebGLAdapterProps;
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

const requestObservation = (
  props: GroundGlassWebGLAdapterProps,
  requestIdentity = props.request.identity,
  ownerId = "runtime-owner",
): GroundGlassRuntimeInfoObservation => ({
  scope: "request",
  channelId: props.request.channel,
  generation: props.generation,
  requestIdentity,
  ownerId,
  info: null,
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
});

describe("GroundGlassRenderHost request and lifecycle authority", () => {
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

  it("retires one generation, accepts the latest replacement request, and rejects stale results", async () => {
    const owner = new GroundGlassRenderHostState();
    const r1 = createGroundGlassRequestInput();
    const r2 = createGroundGlassRequestInput({
      scene: understandingCameraMovementsScene,
      camera: { focusDistanceMm: 1800 },
    });
    const r3 = createGroundGlassRequestInput({
      scene: understandingCameraMovementsScene,
      camera: { focusDistanceMm: 2400 },
      aperture: 16,
    });
    const published: string[] = [];
    const retiredRuntimeInfoChange = vi.fn();
    const first = render(hostTree(
      owner,
      r1,
      (result) => published.push(result.request.requestId),
      retiredRuntimeInfoChange,
    ));
    const firstGeneration = owner.getSnapshot("default").activeGeneration;
    if (!firstGeneration) throw new Error("Expected initial renderer generation");
    const firstSceneSnapshot = owner.getSnapshot("default").latestRequest?.scene;
    if (!firstSceneSnapshot) throw new Error("Expected an initial immutable scene snapshot");

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
    expect(owner.getSnapshot("default").frame.current?.status).toBe("failed");

    // Mount the next application host before the old channel's deferred detach/cleanup settles.
    const second = render(hostTree(
      owner,
      r2,
      (result) => published.push(result.request.requestId),
      retiredRuntimeInfoChange,
    ));
    first.unmount();
    await act(async () => { await Promise.resolve(); });
    expect(owner.getSnapshot("default")).toMatchObject({
      activeHostId: null,
      retiringGeneration: firstGeneration,
      pendingHostId: expect.any(String),
      cleanupStatus: "pending",
    });
    expect(adapterHarness.cleanupCallbacks).toHaveLength(1);

    act(() => adapterHarness.cleanupCallbacks[0]());
    const secondGeneration = owner.getSnapshot("default").activeGeneration;
    if (!secondGeneration) throw new Error("Expected a replacement renderer generation");
    expect(secondGeneration.generationId).not.toBe(firstGeneration.generationId);
    expect(owner.getSnapshot("default").latestRequest?.identity.sceneId).toBe(understandingCameraMovementsScene.id);
    expect(owner.getSnapshot("default").latestRequest?.scene).not.toBe(firstSceneSnapshot);
    act(() => adapterProps(secondGeneration.generationId).onRendererMounted(secondGeneration, "webgl2"));

    const r2Props = adapterProps(secondGeneration.generationId);
    const acceptedR2Id = r2Props.request.identity.requestId;
    act(() => r1Props.onRuntimeObservation?.(requestObservation(
      r1Props,
      r1Props.request.identity,
      "retired-owner",
    )));
    expect(retiredRuntimeInfoChange).not.toHaveBeenCalled();
    second.rerender(hostTree(
      owner,
      r3,
      (result) => published.push(result.request.requestId),
      retiredRuntimeInfoChange,
    ));
    const r3Props = adapterProps(secondGeneration.generationId);
    expect(r3Props.request.identity.requestId).not.toBe(acceptedR2Id);
    expect(r3Props.generation.generationId).toBe(secondGeneration.generationId);

    act(() => r2Props.onRuntimeObservation?.(requestObservation(r2Props)));
    expect(retiredRuntimeInfoChange).not.toHaveBeenCalled();
    act(() => r3Props.onRuntimeObservation?.(requestObservation(r3Props)));
    expect(retiredRuntimeInfoChange).toHaveBeenCalledTimes(1);
    expect(retiredRuntimeInfoChange).toHaveBeenLastCalledWith("default", null, "runtime-owner");

    act(() => r3Props.onRuntimeObservation?.({
      ...requestObservation(r3Props),
      channelId: "camera-movement-current",
    }));
    act(() => r3Props.onRuntimeObservation?.({
      ...requestObservation(r3Props),
      generation: undefined,
    } as unknown as GroundGlassRuntimeInfoObservation));
    expect(retiredRuntimeInfoChange).toHaveBeenCalledTimes(1);

    act(() => r2Props.onFrameResult(completedFrame(r2Props, "late-r2")));
    expect(published).toEqual([]);
    expect(owner.getSnapshot("default").frame.lastSuccessfullyCompleted).toBeNull();

    act(() => r1Props.onFrameResult(completedFrame(r1Props, "late-r1")));
    expect(published).toEqual([]);

    act(() => r3Props.onFrameResult(completedFrame(r3Props, "current-r3")));
    expect(published).toEqual([r3Props.request.identity.requestId]);
    expect(owner.getSnapshot("default").frame.lastSuccessfullyCompleted).toMatchObject({
      request: r3Props.request.identity,
      generation: secondGeneration,
      frameId: "current-r3",
    });

    act(() => adapterHarness.cleanupCallbacks[0]());
    expect(owner.getSnapshot("default").activeGeneration).toEqual(secondGeneration);
    second.unmount();
    await act(async () => { await Promise.resolve(); });
    const secondCleanup = adapterHarness.cleanupCallbacks[1];
    act(() => secondCleanup?.());
    expect(owner.getSnapshot("default").cleanupStatus).toBe("confirmed");
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
    expect(diagnostics?.cleanup.status).toBe("not-required");

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

  it("retires a partially initialized adapter only after acquired owners clean up", () => {
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
    expect(state.activeHostId).toBe("replacement-host");
    expect(state.activeGeneration?.generationId).not.toBe(firstGeneration.generationId);
    expect(state.mountedRuntime).toEqual({ status: "unknown" });
    expect(state.frame).toMatchObject({
      current: { status: "pending" },
      lastSuccessfullyCompleted: null,
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
});
