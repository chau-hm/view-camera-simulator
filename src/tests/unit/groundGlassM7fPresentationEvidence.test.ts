import { describe, expect, it } from "vitest";
import {
  evaluateGroundGlassM7fPresentationEvidence,
  GROUND_GLASS_M7F_EVALUATOR_REVISION,
  GROUND_GLASS_M7F_REPORT_ID,
  type GroundGlassM7fPresentationEvidenceBundle,
} from "../../render/webgpu/groundGlassM7fPresentationEvidence";

const sourceCommitSha = "a".repeat(40);
const invocation = "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- --project=chrome-native-webgpu";
const authorization = {
  rendererAttemptAuthority: "m3-raw-pilot",
  m4Status: "research-only",
  m5Status: "research-only",
  m6EvidenceUsedForRendererSelection: false,
  productionWebGpuEnabled: false,
  m5qChanged: false,
  m8Authorized: false,
  m9Authorized: false,
};
const provenance = {
  sourceCommitSha,
  testInvocation: invocation,
  threePackageVersion: "0.187.0",
  rendererRevision: "r187",
  browserProject: "chrome-native-webgpu",
  rendererFamily: "webgpu-renderer",
  actualExecutionApi: "webgpu",
  internalFallback: "none",
  nodeVersion: "v24.3.0",
  operatingSystem: "darwin 26.1",
};

const createM6dCapture = () => {
  const requestId = "request-current";
  const channelId = "channel-default";
  const sceneId = "architecture-rise";
  const generationId = "generation-current";
  const attemptId = "attempt-current";
  const farRgba = [0.2, 0.4, 0.6, 1];
  const nearRgba = [0.8, 0.6, 0.4, 1];
  const coverages = [0, 0.25, 0.5, 0.75, 1];
  return {
    captureProvenance: { ...provenance },
    registeredM5Capture: {
      sceneId,
      rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgpu",
      internalFallback: "none",
      compositeTargetFormat: "rgba16float",
      sourceRevision: "architecture-rise-raw-rtt-v1",
      completedPasses: ["researchComposite"],
      requestId,
      channelId,
      rendererGenerationId: generationId,
    },
    controlledCompositeProbe: {
      contractRevision: "m6d-opaque-presentation-v1",
      rendererRevision: "r187",
      rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgpu",
      internalFallback: "none",
      applicationFallback: false,
      requestId,
      channelId,
      sceneId,
      rendererGenerationId: generationId,
      sourceTextureFormat: "rgba16float",
      nearTextureFormat: "rgba16float",
      targetFormat: "rgba16float",
      sourceTextureIdentity: { farUuid: "far-source", nearUuid: "near-source" },
      targetIdentity: { uuid: "m6d-target", widthPx: 5, heightPx: 1 },
      targetAllocationObserved: true,
      targetColorSpace: "no-color-space",
      rendererStateRestored: true,
      temporaryResourcesDisposed: true,
      cases: coverages.map((coverage) => ({
        id: `near-coverage-${coverage}`,
        coverage,
        farRgba,
        nearRgba,
        measuredCompositeRgba: [0, 1, 2].map((channel) =>
          farRgba[channel]! * (1 - coverage) + nearRgba[channel]! * coverage,
        ).concat(1),
      })),
    },
    adapterEvents: [
      {
        kind: "runtime-observed",
        attemptId,
        generationId,
        rendererRevision: "r187",
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
        internalFallback: "none",
      },
      {
        kind: "renderer-mounted",
        attemptId,
        generationId,
        requestId,
        channelId,
        sceneId,
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
        internalFallback: "none",
      },
      {
        kind: "host-frame-result",
        frameStatus: "completed",
        acceptedByHost: true,
        requestId,
        channelId,
        sceneId,
        generationId,
        latestAcceptedRequestId: requestId,
        latestAcceptedSceneId: sceneId,
        activeGenerationId: generationId,
        activeRendererFamily: "webgpu-renderer",
      },
    ],
  };
};

const createFailureCapture = () => ({
  scenarioId: "optical-resource-initialization-failure",
  captureProvenance: { ...provenance },
  observations: { fallbackBackend: "webgl-renderer" },
  events: [
    {
      kind: "runtime-observed",
      attemptId: "attempt-failure",
      generationId: "generation-failed",
      rendererRevision: "r187",
      rendererFamily: "webgpu-renderer",
      executionApi: "webgpu",
      internalFallback: "none",
    },
    {
      kind: "renderer-mounted",
      attemptId: "attempt-failure",
      generationId: "generation-failed",
      requestId: "request-failed",
      channelId: "channel-default",
      sceneId: "architecture-rise",
      rendererFamily: "webgpu-renderer",
      executionApi: "webgpu",
      internalFallback: "none",
    },
    {
      kind: "failure",
      stage: "initialization",
      attemptId: "attempt-failure",
      generationId: "generation-failed",
      requestId: "request-failed",
      channelId: "channel-default",
      sceneId: "architecture-rise",
      operation: "initialize-optical-resources",
      reason: "injected-failure",
    },
    { kind: "cleanup", outcome: "confirmed", generationId: "generation-failed" },
    { kind: "cleanup-acknowledged", outcome: "confirmed", generationId: "generation-failed" },
    {
      kind: "renderer-mounted",
      generationId: "generation-webgl",
      requestId: "request-failed",
      channelId: "channel-default",
      sceneId: "architecture-rise",
      rendererFamily: "webgl-renderer",
    },
  ],
});

const createRegisteredAppCapture = () => {
  const requestId = "request-app";
  const channelId = "channel-default";
  const sceneId = "architecture-rise";
  const generationId = "generation-app";
  const attemptId = "attempt-app";
  const sceneSourceRevision = "architecture-rise-raw-rtt-v1+m6-presentation-v1";
  const runtime = {
    kind: "runtime-observed",
    attemptId,
    generationId,
    rendererRevision: "r187",
    rendererFamily: "webgpu-renderer",
    executionApi: "webgpu",
    internalFallback: "none",
  };
  return {
    captureProvenance: { ...provenance },
    sceneId,
    sceneSourceRevision,
    rendererRevision: "r187",
    rendererFamily: "webgpu-renderer",
    actualExecutionApi: "webgpu",
    internalFallback: "none",
    applicationFallback: "not-observed",
    presentationStatus: "completed",
    presentationSource: "m5-research-composite",
    presentationQuality: "unqualified",
    requestId,
    channelId,
    rendererGenerationId: generationId,
    presentationRequestId: requestId,
    presentationChannelId: channelId,
    presentationSceneId: sceneId,
    presentationRendererGenerationId: generationId,
    opticalReadback: {
      exactIdentityMatch: true,
      requestId,
      rendererGenerationId: generationId,
      sourceRevision: "architecture-rise-raw-rtt-v1",
      completedPasses: ["physicalCoC", "farGather", "nearGather", "farReconstructionB1", "researchComposite"],
      targetFormats: { composite: "rgba16float" },
    },
    comparisons: { orientationMetrics: {
      correct180DegreeMatchMeanRgbError: 1,
      horizontalOnlyNegativeControlMeanRgbError: 48,
      verticalOnlyNegativeControlMeanRgbError: 49,
    } },
    resize: { width: 640, height: 480, targetWidth: 320, targetHeight: 240 },
    adapterEvents: [
      runtime,
      {
        kind: "renderer-mounted",
        attemptId,
        generationId,
        requestId,
        channelId,
        sceneId,
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
        internalFallback: "none",
      },
      {
        kind: "host-frame-result",
        frameStatus: "completed",
        acceptedByHost: true,
        requestId,
        channelId,
        sceneId,
        generationId,
        latestAcceptedRequestId: requestId,
        latestAcceptedSceneId: sceneId,
        activeGenerationId: generationId,
        activeRendererFamily: "webgpu-renderer",
      },
    ],
  };
};

const createBundle = (
  overrides: Partial<GroundGlassM7fPresentationEvidenceBundle> = {},
): GroundGlassM7fPresentationEvidenceBundle => ({
  schemaVersion: 1,
  reportId: GROUND_GLASS_M7F_REPORT_ID,
  evaluatorRevision: GROUND_GLASS_M7F_EVALUATOR_REVISION,
  sourceCommitSha,
  testInvocation: invocation,
  authorization,
  m6dComposite: null,
  m6bConformance: null,
  m6cAlpha: null,
  registeredApp: null,
  lifecycle: {},
  productionIsolation: null,
  ...overrides,
});

const replay = (bundle: GroundGlassM7fPresentationEvidenceBundle) => {
  const first = evaluateGroundGlassM7fPresentationEvidence(bundle);
  return evaluateGroundGlassM7fPresentationEvidence({ ...bundle, declaredCounts: first.computedCounts });
};

const scenario = (bundle: GroundGlassM7fPresentationEvidenceBundle, id: string) =>
  replay(bundle).scenarios.find((item) => item.id === id)!;

describe("M7F r187 presentation evidence replay", () => {
  it("accepts the controlled native opaque composite when its observed event chain and equation agree", () => {
    const result = replay(createBundle({ m6dComposite: createM6dCapture() }));
    const m6d = result.scenarios.find((item) => item.id === "m6d-opaque-composite");

    expect(m6d?.status).toBe("passed");
    expect(m6d?.issues).toEqual([]);
    expect(result.inventoryConsistent).toBe(true);
    expect(result.computedCounts.passed).toBe(1);
    expect(result.decisions.m6DevelopmentAuthorization).toBe(false);
  });

  it("accepts the current M5 composite as the registered app's exact M6 input", () => {
    const result = replay(createBundle({
      m6dComposite: createM6dCapture(),
      registeredApp: createRegisteredAppCapture(),
    }));

    expect(scenario(createBundle({
      m6dComposite: createM6dCapture(),
      registeredApp: createRegisteredAppCapture(),
    }), "m5-m6-source-contract").status).toBe("passed");
    expect(result.scenarios.find((item) => item.id === "registered-architecture-rise-m3-m6")?.status).toBe("passed");
  });

  it.each([
    ["M3 Raw source substituted for M5", (capture: ReturnType<typeof createRegisteredAppCapture>) => {
      capture.presentationSource = "m3-raw";
    }, "m6-source-is-not-current-m5-composite"],
    ["M5 composite pass omitted", (capture: ReturnType<typeof createRegisteredAppCapture>) => {
      capture.opticalReadback.completedPasses = capture.opticalReadback.completedPasses.filter((pass) => pass !== "researchComposite");
    }, "registered-m5-composite-incomplete-or-stale"],
    ["stale M6 request identity", (capture: ReturnType<typeof createRegisteredAppCapture>) => {
      capture.presentationRequestId = "retired-request";
    }, "registered-presentation-request-generation-mismatch"],
  ])("rejects %s through the registered source/request contract", (_name, mutate, expectedIssue) => {
    const app = createRegisteredAppCapture();
    mutate(app);
    const result = replay(createBundle({ m6dComposite: createM6dCapture(), registeredApp: app }));
    if (expectedIssue === "m6-source-is-not-current-m5-composite") {
      expect(result.scenarios.find((item) => item.id === "m5-m6-source-contract")?.issues)
        .toContain(expectedIssue);
      expect(result.scenarios.find((item) => item.id === "registered-architecture-rise-m3-m6")?.issues)
        .toContain("registered-m6-presentation-identity-or-status-invalid");
    } else {
      expect(result.scenarios.find((item) => item.id === "registered-architecture-rise-m3-m6")?.issues)
        .toContain(expectedIssue);
    }
  });

  it.each([
    ["Three.js revision", (capture: ReturnType<typeof createM6dCapture>) => {
      capture.captureProvenance.rendererRevision = "r186";
      capture.controlledCompositeProbe.rendererRevision = "r186";
    }, "renderer-revision-mismatch"],
    ["WebGL2 compatibility execution", (capture: ReturnType<typeof createM6dCapture>) => {
      capture.captureProvenance.actualExecutionApi = "webgl2";
      capture.controlledCompositeProbe.actualExecutionApi = "webgl2";
    }, "native-runtime-provenance-invalid"],
    ["coverage blending", (capture: ReturnType<typeof createM6dCapture>) => {
      capture.controlledCompositeProbe.cases[2]!.measuredCompositeRgba[0] = 0.95;
    }, "m6d-coverage-case-0.5-composite-rgb-invalid"],
    ["composite alpha", (capture: ReturnType<typeof createM6dCapture>) => {
      capture.controlledCompositeProbe.cases[2]!.measuredCompositeRgba[3] = 0.5;
    }, "m6d-coverage-case-0.5-opaque-alpha-invalid"],
    ["target ownership", (capture: ReturnType<typeof createM6dCapture>) => {
      capture.controlledCompositeProbe.targetIdentity.uuid = "far-source";
    }, "m6d-target-ownership-or-allocation-invalid"],
    ["target disposal", (capture: ReturnType<typeof createM6dCapture>) => {
      capture.controlledCompositeProbe.temporaryResourcesDisposed = false;
    }, "m6d-lifecycle-contract-invalid"],
    ["host acceptance", (capture: ReturnType<typeof createM6dCapture>) => {
      capture.adapterEvents[2]!.acceptedByHost = false;
    }, "m6d-no-host-accepted-current-frame-result"],
    ["stale generation", (capture: ReturnType<typeof createM6dCapture>) => {
      capture.adapterEvents[2]!.activeGenerationId = "retired-generation";
    }, "m6d-no-host-accepted-current-frame-result"],
  ])("rejects %s when its specific M6D contract is mutated", (_name, mutate, expectedIssue) => {
    const capture = createM6dCapture();
    mutate(capture);
    const result = scenario(createBundle({ m6dComposite: capture }), "m6d-opaque-composite");

    expect(result.status).toBe("failed");
    expect(result.issues).toContain(expectedIssue);
  });

  it("requires a captured failure, confirmed adapter cleanup, host acknowledgement, then WebGL replacement", () => {
    const bundle = createBundle({
      lifecycle: { "optical-resource-initialization-failure.json": createFailureCapture() },
    });
    expect(scenario(bundle, "optical-resource-initialization-failure").status).toBe("passed");
  });

  it.each([
    ["missing host acknowledgement", (capture: ReturnType<typeof createFailureCapture>) => {
      capture.events.splice(4, 1);
    }, "host-cleanup-acknowledgement-missing-or-contradictory"],
    ["replacement before host acknowledgement", (capture: ReturnType<typeof createFailureCapture>) => {
      const replacement = capture.events.pop()!;
      capture.events.splice(3, 0, replacement);
    }, "fallback-mounted-before-confirmed-cleanup"],
    ["failed cleanup represented as confirmed", (capture: ReturnType<typeof createFailureCapture>) => {
      capture.events[3]!.outcome = "failed";
    }, "confirmed-cleanup-not-observed-after-failure"],
    ["failed request published", (capture: ReturnType<typeof createFailureCapture>) => {
      capture.events.push({
        kind: "frame-completed",
        requestId: "request-failed",
        channelId: "channel-default",
        sceneId: "architecture-rise",
        generationId: "generation-failed",
        rendererFamily: "webgpu-renderer",
      });
    }, "failed-m6-request-published-as-complete"],
  ])("rejects %s in lifecycle evidence", (_name, mutate, expectedIssue) => {
    const capture = createFailureCapture();
    mutate(capture);
    const result = scenario(createBundle({
      lifecycle: { "optical-resource-initialization-failure.json": capture },
    }), "optical-resource-initialization-failure");

    expect(result.status).toBe("failed");
    expect(result.issues).toContain(expectedIssue);
  });

  it("rejects a capture with missing provenance or a source SHA from another revision", () => {
    const noProvenance = createM6dCapture();
    delete (noProvenance as { captureProvenance?: unknown }).captureProvenance;
    expect(scenario(createBundle({ m6dComposite: noProvenance }), "m6d-opaque-composite").issues)
      .toContain("capture-provenance-missing");

    const wrongCommit = createM6dCapture();
    wrongCommit.captureProvenance.sourceCommitSha = "b".repeat(40);
    expect(scenario(createBundle({ m6dComposite: wrongCommit }), "m6d-opaque-composite").issues)
      .toContain("capture-source-sha-does-not-match-report");
  });

  it("rejects omitted and contradictory scenario counts", () => {
    const bundle = createBundle({ m6dComposite: createM6dCapture() });
    const noCounts = evaluateGroundGlassM7fPresentationEvidence(bundle);
    expect(noCounts.inventoryConsistent).toBe(false);

    const correct = replay(bundle);
    const contradictory = evaluateGroundGlassM7fPresentationEvidence({
      ...bundle,
      declaredCounts: { ...correct.computedCounts, passed: correct.computedCounts.passed + 1 },
    });
    expect(contradictory.inventoryConsistent).toBe(false);
    expect(contradictory.decisions.m6DevelopmentAuthorization).toBe(false);
  });

  it("keeps M6 evidence from becoming renderer-attempt authority or later-stage authorization", () => {
    const result = replay(createBundle({
      authorization: {
        ...authorization,
        rendererAttemptAuthority: "m6-full-presentation",
        m8Authorized: true,
      },
    }));
    expect(result.scenarios.every(({ issues }) =>
      issues.includes("m6-evidence-may-authorize-renderer-attempt") &&
      issues.includes("future-stage-authorization-invalid"),
    )).toBe(true);
    expect(result.decisions.m6DevelopmentAuthorization).toBe(false);
    expect(result.decisions.m8M9Authorized).toBe(false);
  });
});
