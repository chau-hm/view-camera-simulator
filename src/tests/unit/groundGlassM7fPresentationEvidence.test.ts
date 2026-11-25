import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  evaluateGroundGlassM7fPresentationEvidence,
  isGroundGlassM7fQualificationPass,
  GROUND_GLASS_M7F_EVALUATOR_REVISION,
  GROUND_GLASS_M7F_REPORT_ID,
  type GroundGlassM7fPresentationEvidenceBundle,
  type GroundGlassM7fPresentationEvaluation,
} from "../../render/webgpu/groundGlassM7fPresentationEvidence";
import { encodeGroundGlassLinearChannelToSrgb } from "../../render/webgpu/groundGlassPresentationReference";
import { fingerprintGroundGlassM6bPresentationState } from "../../render/groundGlassPhysicalOverlayConformance";
import { evaluateGroundGlassM6bSpatialConformance } from "../../render/groundGlassM6bSpatialConformance";
import type { GroundGlassPresentationNodeState } from "../../render/webgpu/groundGlassPresentationNodes";

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
type MutableRecord = Record<string, unknown>;
const asMutableRecord = (value: unknown): MutableRecord => value as MutableRecord;
const asMutableArray = (value: unknown): unknown[] => value as unknown[];
const readEvidenceFixture = (path: string): MutableRecord => JSON.parse(readFileSync(path, "utf8")) as MutableRecord;
const cloneEvidenceFixture = (path: string): MutableRecord => structuredClone(readEvidenceFixture(path));
const m6bFixturePath = "docs/architecture/ground-glass-m7f-r187-presentation/m6b-conformance.json";
const m6cFixturePath = "docs/architecture/ground-glass-m7f-r187-presentation/m6c-alpha-conformance.json";
const productionFixturePath = "docs/architecture/ground-glass-m7f-r187-presentation/production-isolation.json";
const staleResizeFixturePath = "docs/architecture/ground-glass-m7f-r187-presentation/lifecycle/presentation-stale-resize.json";
const replayReportPath = "docs/architecture/GROUND_GLASS_M7F_R187_PRESENTATION_REPORT.json";
const persistedBundle = (
  field: "m6bConformance" | "m6cAlpha" | "productionIsolation",
  fixture: MutableRecord,
  overrides: Partial<GroundGlassM7fPresentationEvidenceBundle> = {},
) => {
  const captureProvenance = asMutableRecord(fixture.captureProvenance ?? fixture.sourceProvenance);
  return createBundle({
    sourceCommitSha: String(captureProvenance.sourceCommitSha),
    testInvocation: String(captureProvenance.testInvocation),
    [field]: fixture,
    ...overrides,
  });
};
const persistedScenario = (
  artifact: MutableRecord,
  scenarioId: string,
  field: "m6bConformance" | "m6cAlpha" | "productionIsolation" = "m6bConformance",
) => scenario(persistedBundle(field, artifact), scenarioId);
const rgbCase = (artifact: MutableRecord, name: string): MutableRecord => {
  const item = asMutableArray(artifact.pixelOracleCases)
    .map(asMutableRecord)
    .find((candidate) => candidate.name === name);
  if (!item) throw new Error(`Missing RGB case ${name}`);
  return item;
};
const rgbSample = (capture: MutableRecord, id: string): MutableRecord => {
  const oracle = asMutableRecord(capture.oracle);
  const sample = asMutableArray(oracle.samples).map(asMutableRecord).find((candidate) => candidate.id === id);
  if (!sample) throw new Error(`Missing RGB sample ${id}`);
  return sample;
};
const lifecycleScenario = (capture: MutableRecord, filename: string, scenarioId: string) => {
  const captureProvenance = asMutableRecord(capture.captureProvenance);
  return scenario(createBundle({
    sourceCommitSha: String(captureProvenance.sourceCommitSha),
    testInvocation: String(captureProvenance.testInvocation),
    lifecycle: { [filename]: capture },
  }), scenarioId);
};
const refreshRgbSummaries = (artifact: MutableRecord): void => {
  const allErrors: number[] = [];
  for (const caseValue of asMutableArray(artifact.pixelOracleCases)) {
    const oracle = asMutableRecord(asMutableRecord(caseValue).oracle);
    const errors: number[] = [];
    for (const sampleValue of asMutableArray(oracle.samples)) {
      const sample = asMutableRecord(sampleValue);
      const expected = asMutableArray(sample.expectedSrgbRgb);
      const measured = asMutableArray(sample.measuredSrgbRgba);
      const sampleErrors = expected.map((value, index) => Math.abs(Number(value) - Number(measured[index])));
      sample.absoluteChannelError = sampleErrors;
      sample.maximumChannelError = Math.max(...sampleErrors);
      sample.rgbRmse = Math.sqrt(sampleErrors.reduce((sum, error) => sum + error * error, 0) / sampleErrors.length);
      sample.meanAbsoluteChannelError = sampleErrors.reduce((sum, error) => sum + error, 0) / sampleErrors.length;
      errors.push(...sampleErrors);
    }
    oracle.maximumChannelError = Math.max(...errors);
    oracle.rgbRmse = Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length);
    allErrors.push(...errors);
  }
  const aggregate = asMutableRecord(artifact.pixelOracleAggregate);
  aggregate.sampleCount = allErrors.length / 3;
  aggregate.maximumChannelError = Math.max(...allErrors);
  aggregate.rgbRmse = Math.sqrt(allErrors.reduce((sum, error) => sum + error * error, 0) / allErrors.length);
};
const refreshPresentationStateFingerprint = (capture: MutableRecord): void => {
  const state = capture.presentationState as GroundGlassPresentationNodeState;
  asMutableRecord(capture.inputFingerprints).presentationState = fingerprintGroundGlassM6bPresentationState(state);
};
const shiftSpatialMeasurement = (measurement: MutableRecord, dx: number, dy = 0): void => {
  const expectedImage = asMutableRecord(measurement.expectedImagePx);
  const expectedTarget = asMutableRecord(measurement.expectedTargetPx);
  const measuredImage = asMutableRecord(measurement.measuredImagePx);
  const measuredTarget = asMutableRecord(measurement.measuredTargetPx);
  measuredImage.x = Number(expectedImage.x) + dx;
  measuredImage.y = Number(expectedImage.y) + dy;
  measuredTarget.x = Number(expectedTarget.x) + dx;
  measuredTarget.y = Number(expectedTarget.y) + dy;
  measurement.imageErrorXPx = Number(measuredImage.x) - Number(expectedImage.x);
  measurement.imageErrorYPx = Number(measuredImage.y) - Number(expectedImage.y);
  measurement.imageMappingErrorPx = Math.hypot(Number(measurement.imageErrorXPx), Number(measurement.imageErrorYPx));
  measurement.targetErrorXPx = Number(measuredTarget.x) - Number(expectedTarget.x);
  measurement.targetErrorYPx = Number(measuredTarget.y) - Number(expectedTarget.y);
  measurement.overlayMappingErrorPx = Math.hypot(Number(measurement.targetErrorXPx), Number(measurement.targetErrorYPx));
  const measuredGridValue = measurement.measuredGridIntersectionPx;
  if (measuredGridValue && typeof measuredGridValue === "object") {
    const expectedGrid = asMutableRecord(measurement.expectedGridIntersectionPx);
    const measuredGrid = asMutableRecord(measuredGridValue);
    measuredGrid.x = Number(expectedGrid.x) + dx;
    measuredGrid.y = Number(expectedGrid.y) + dy;
    measurement.gridErrorXPx = Number(measuredGrid.x) - Number(expectedGrid.x);
    measurement.gridErrorYPx = Number(measuredGrid.y) - Number(expectedGrid.y);
    measurement.gridMappingErrorPx = Math.hypot(Number(measurement.gridErrorXPx), Number(measurement.gridErrorYPx));
    measurement.gridToLandmarkErrorPx = Math.hypot(
      Number(measuredGrid.x) - Number(measuredImage.x),
      Number(measuredGrid.y) - Number(measuredImage.y),
    );
  }
};
const refreshSpatialReplaySnapshots = (artifact: MutableRecord): void => {
  const inputs = asMutableArray(artifact.spatialConformanceInputs);
  for (const value of inputs) {
    const input = asMutableRecord(value);
    const alignment = asMutableRecord(input.alignment);
    const errors: number[] = [];
    for (const measurementValue of asMutableArray(alignment.measurements)) {
      const measurement = asMutableRecord(measurementValue);
      if (measurement.status !== "measured") continue;
      errors.push(Number(measurement.imageMappingErrorPx), Number(measurement.overlayMappingErrorPx));
      if (measurement.measuredGridIntersectionPx) {
        errors.push(Number(measurement.gridMappingErrorPx), Number(measurement.gridToLandmarkErrorPx));
      }
    }
    alignment.maximumErrorPx = Math.max(...errors);
    alignment.rmsErrorPx = Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length);
  }
  const result = evaluateGroundGlassM6bSpatialConformance({
    captures: inputs as unknown as Parameters<typeof evaluateGroundGlassM6bSpatialConformance>[0]["captures"],
    stateSpecificAssertionsPassed: false,
  });
  artifact.spatialConformance = result;
  for (const classification of result.perCaptureClassifications) {
    const observed = asMutableArray(artifact.captures).map(asMutableRecord)
      .find((capture) => capture.captureId === classification.captureId);
    const input = inputs.map(asMutableRecord).find((capture) => capture.captureId === classification.captureId);
    if (observed && input) {
      observed.alignment = structuredClone(input.alignment);
      observed.spatialConformance = classification;
    }
  }
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
      kind: "failure",
      stage: "initialization",
      attemptId: "attempt-failure",
      generationId: "generation-failed",
      requestId: "request-failed",
      channelId: "channel-default",
      sceneId: "architecture-rise",
      operation: "initialize-m6-optical-resources",
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
      executionApi: "webgl2",
      internalFallback: "none",
    },
  ],
});

const createM5CompositeFailureCapture = () => {
  const capture = createFailureCapture();
  capture.scenarioId = "m5-composite-incomplete-failure";
  const failure = capture.events.find((event) => event.kind === "failure");
  if (!failure) throw new Error("M5 composite failure fixture is incomplete");
  failure.stage = "runtime";
  failure.operation = "presentation";
  failure.reason = "M6 presentation requires completed M4 and M5 inputs for the exact accepted request and renderer generation";
  capture.events.splice(1, 0, {
    kind: "renderer-mounted",
    attemptId: "attempt-failure",
    generationId: "generation-failed",
    requestId: "request-failed",
    channelId: "channel-default",
    sceneId: "architecture-rise",
    rendererFamily: "webgpu-renderer",
    executionApi: "webgpu",
    internalFallback: "none",
  } as unknown as typeof capture.events[number]);
  return {
    ...capture,
    failurePoint: "aperture-composite-after-submit",
    failedOperation: "presentation",
  };
};

const createRetiredM6cCapture = () => {
  const frame = createM6dCapture();
  const identity = {
    requestId: "request-current",
    channelId: "channel-default",
    sceneId: "architecture-rise",
    rendererGenerationId: "generation-current",
  };
  return {
    scenarioId: "m6c-retired-generation-readback",
    captureProvenance: { ...provenance },
    events: frame.adapterEvents,
    staleReadback: {
      status: "stale",
      samples: [],
      identity,
      resourceAccounting: {
        targetDisposed: true,
        previousRenderTargetRestored: true,
        disposalOutcome: "confirmed",
      },
    },
    cleanupOutcome: "confirmed",
    currentHostMounted: false as boolean,
    currentRequestId: null as string | null,
    routeAfterNavigation: "http://127.0.0.1:4175/scenes",
  };
};

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
      completedPasses: ["farGather", "nearGather", "farReconstructionB1", "researchComposite"],
      targetFormats: { composite: "rgba16float", physical: "rgba16float", validity: "rgba8unorm" },
      physicalDataFingerprint: "physical-fingerprint",
      inputFingerprints: {
        physical: "physical-fingerprint",
        depth: "depth-fingerprint",
        validity: "validity-fingerprint",
      },
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
      {
        kind: "frame-performance",
        evidence: {
          requestId,
          generationId,
          physicalCocFootprint: { wallClockMs: 0.4 },
          physicalValidity: { wallClockMs: 0.3 },
        },
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
  it("requires exact inventory, passed scenarios, authorization, and verified provenance for replay success", () => {
    const report = readEvidenceFixture(replayReportPath);
    const counts = asMutableRecord(report.scenarioCounts);
    const evaluation = {
      reportId: report.reportId,
      evaluatorRevision: report.evaluatorRevision,
      sourceCommitSha: report.nativeCaptureSourceSha,
      scenarios: report.scenarios,
      declaredCounts: counts.declared,
      computedCounts: counts.computed,
      inventoryConsistent: counts.inventoryConsistent,
      decisions: report.decisions,
    } as unknown as GroundGlassM7fPresentationEvaluation;
    const validInput = {
      evaluation,
      qualificationStatus: "passed",
      sourceCommitVerified: true,
      evidenceReadIssues: [],
    };

    expect(isGroundGlassM7fQualificationPass(validInput)).toBe(true);

    const withNotRun = structuredClone(evaluation) as unknown as MutableRecord;
    const notRunScenario = asMutableArray(withNotRun.scenarios)[0] as MutableRecord;
    notRunScenario.status = "not-run";
    expect(isGroundGlassM7fQualificationPass({ ...validInput, evaluation: withNotRun as unknown as GroundGlassM7fPresentationEvaluation })).toBe(false);

    const withContradictoryCounts = structuredClone(evaluation) as unknown as MutableRecord;
    asMutableRecord(withContradictoryCounts.declaredCounts).passed = 16;
    expect(isGroundGlassM7fQualificationPass({
      ...validInput,
      evaluation: withContradictoryCounts as unknown as GroundGlassM7fPresentationEvaluation,
    })).toBe(false);

    expect(isGroundGlassM7fQualificationPass({ ...validInput, sourceCommitVerified: false })).toBe(false);
    expect(isGroundGlassM7fQualificationPass({ ...validInput, evidenceReadIssues: ["artifact parse failed"] })).toBe(false);
    expect(isGroundGlassM7fQualificationPass({ ...validInput, qualificationStatus: "partially-qualified" })).toBe(false);

    const wrongIdentity = structuredClone(evaluation) as unknown as MutableRecord;
    wrongIdentity.reportId = "other-report";
    expect(isGroundGlassM7fQualificationPass({
      ...validInput,
      evaluation: wrongIdentity as unknown as GroundGlassM7fPresentationEvaluation,
    })).toBe(false);

    const wrongEvaluator = structuredClone(evaluation) as unknown as MutableRecord;
    wrongEvaluator.evaluatorRevision = "m7f-r187-presentation-evaluator-v1";
    expect(isGroundGlassM7fQualificationPass({
      ...validInput,
      evaluation: wrongEvaluator as unknown as GroundGlassM7fPresentationEvaluation,
    })).toBe(false);

    const denied = structuredClone(evaluation) as unknown as MutableRecord;
    asMutableRecord(denied.decisions).m6DevelopmentAuthorization = false;
    expect(isGroundGlassM7fQualificationPass({
      ...validInput,
      evaluation: denied as unknown as GroundGlassM7fPresentationEvaluation,
    })).toBe(false);
  });

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
    ["raw M5 Near texture substituted for the completed composite", (capture: ReturnType<typeof createRegisteredAppCapture>) => {
      capture.presentationSource = "m5-near";
    }, "m6-source-is-not-current-m5-composite"],
    ["M5 composite pass omitted", (capture: ReturnType<typeof createRegisteredAppCapture>) => {
      capture.opticalReadback.completedPasses = capture.opticalReadback.completedPasses.filter((pass) => pass !== "researchComposite");
    }, "registered-m5-composite-incomplete-or-stale"],
    ["M6 completion claimed before the current M5 composite", (capture: ReturnType<typeof createRegisteredAppCapture>) => {
      capture.opticalReadback.requestId = "previous-m5-request";
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

  it("requires observed current-request M4 physical pass evidence", () => {
    const app = createRegisteredAppCapture();
    app.adapterEvents = app.adapterEvents.filter((event) => event.kind !== "frame-performance");
    const result = scenario(createBundle({ registeredApp: app }), "registered-architecture-rise-m3-m6");

    expect(result.issues).toContain("registered-m4-physical-passes-not-observed-for-current-request");
  });

  it("requires the registered M4 physical storage fingerprint to match its readback", () => {
    const app = createRegisteredAppCapture();
    app.opticalReadback.inputFingerprints.physical = "different-physical-texture";
    const result = scenario(createBundle({ registeredApp: app }), "registered-architecture-rise-m3-m6");

    expect(result.issues).toContain("registered-m5-composite-incomplete-or-stale");
  });

  it("replays all persisted M6B spatial and visible RGB measurements as a positive control", () => {
    const artifact = cloneEvidenceFixture(m6bFixturePath);
    const result = replay(persistedBundle("m6bConformance", artifact));

    expect(scenario(persistedBundle("m6bConformance", cloneEvidenceFixture(m6bFixturePath)), "m6b-spatial-fixture").status)
      .toBe("passed");
    expect(result.scenarios.find((item) => item.id === "m6b-final-rgb")?.status).toBe("passed");
  });

  it("reproduces F2: rejects a completed host-accepted stale frame appended after the latest result", () => {
    const capture = cloneEvidenceFixture(staleResizeFixturePath);
    const events = asMutableArray(capture.events).map(asMutableRecord);
    const latestPublication = [...events].reverse().find((event) => event.kind === "host-frame-result");
    if (!latestPublication) throw new Error("Stale-resize fixture has no latest host frame");
    events.push({
      ...structuredClone(latestPublication),
      requestId: capture.staleRequestId,
      frameStatus: "completed",
      acceptedByHost: true,
      latestAcceptedRequestId: capture.staleRequestId,
      sequence: Number(asMutableRecord(events.at(-1)).sequence) + 1,
    });
    capture.events = events;

    const result = lifecycleScenario(capture, "presentation-stale-resize.json", "presentation-stale-resize");
    expect(result.status).toBe("failed");
    expect(result.issues).toContain("stale-frame-accepted-after-latest-request");
  });

  it("accepts a completed stale frame only when the current host rejects it after the new request", () => {
    const capture = cloneEvidenceFixture(staleResizeFixturePath);
    const events = asMutableArray(capture.events).map(asMutableRecord);
    const latestPublication = [...events].reverse().find((event) => event.kind === "host-frame-result");
    if (!latestPublication) throw new Error("Stale-resize fixture has no latest host frame");
    const staleCompletion = {
      kind: "frame-completed",
      attemptId: latestPublication.attemptId,
      generationId: latestPublication.generationId,
      requestId: capture.staleRequestId,
      sequence: Number(asMutableRecord(events.at(-1)).sequence) + 1,
    };
    events.push(staleCompletion);
    events.push({
      ...structuredClone(latestPublication),
      requestId: capture.staleRequestId,
      frameStatus: "completed",
      acceptedByHost: false,
      latestAcceptedRequestId: capture.latestRequestId,
      sequence: Number(staleCompletion.sequence) + 1,
    });
    capture.events = events;
    capture.staleRequestPublished = true;

    const result = lifecycleScenario(capture, "presentation-stale-resize.json", "presentation-stale-resize");
    expect(result.status).toBe("passed");
  });

  it("allows an earlier accepted stale frame before the latest-request boundary", () => {
    const capture = cloneEvidenceFixture(staleResizeFixturePath);
    const events = asMutableArray(capture.events).map(asMutableRecord);
    const initialResultIndex = events.findIndex((event) => event.kind === "host-frame-result");
    if (initialResultIndex < 0) throw new Error("Stale-resize fixture has no initial host frame");
    for (const event of events.slice(initialResultIndex + 1)) {
      event.sequence = Number(event.sequence) + 2;
    }
    const original = structuredClone(events[initialResultIndex]!);
    const earlierCompletion = {
      kind: "frame-completed",
      attemptId: original.attemptId,
      generationId: original.generationId,
      requestId: capture.staleRequestId,
      sequence: Number(original.sequence) + 1,
    };
    const earlierAcceptance = {
      ...original,
      requestId: capture.staleRequestId,
      latestAcceptedRequestId: capture.staleRequestId,
      sequence: Number(original.sequence) + 2,
    };
    events.splice(initialResultIndex + 1, 0, earlierCompletion, earlierAcceptance);
    capture.events = events;
    capture.staleRequestPublished = true;

    const result = lifecycleScenario(capture, "presentation-stale-resize.json", "presentation-stale-resize");
    expect(result.status).toBe("passed");
  });

  it.each([
    ["completion without a host rejection", (capture: MutableRecord) => {
      const events = asMutableArray(capture.events);
      const last = asMutableRecord(events.at(-1));
      events.push({
        kind: "frame-completed",
        attemptId: last.attemptId,
        generationId: last.generationId,
        requestId: capture.staleRequestId,
        sequence: Number(last.sequence) + 1,
      });
      capture.staleRequestPublished = true;
    }],
    ["rejection from another renderer generation", (capture: MutableRecord) => {
      const events = asMutableArray(capture.events);
      const last = asMutableRecord(events.at(-1));
      const completion = {
        kind: "frame-completed",
        attemptId: last.attemptId,
        generationId: last.generationId,
        requestId: capture.staleRequestId,
        sequence: Number(last.sequence) + 1,
      };
      events.push(completion, {
        ...structuredClone(last),
        requestId: capture.staleRequestId,
        acceptedByHost: false,
        latestAcceptedRequestId: capture.latestRequestId,
        generationId: "retired-generation",
        activeGenerationId: "retired-generation",
        sequence: Number(completion.sequence) + 1,
      });
      capture.staleRequestPublished = true;
    }],
    ["out-of-order event sequence", (capture: MutableRecord) => {
      const events = asMutableArray(capture.events).map(asMutableRecord);
      events.at(-1)!.sequence = Number(events.at(-2)!.sequence);
      capture.events = events;
    }],
  ])("rejects stale lifecycle evidence with %s", (_name, mutate) => {
    const capture = cloneEvidenceFixture(staleResizeFixturePath);
    mutate(capture);
    const result = lifecycleScenario(capture, "presentation-stale-resize.json", "presentation-stale-resize");
    expect(result.status).toBe("failed");
  });

  it("reproduces F3: detects coordinated serialized source/output/measurement RGB forgery", () => {
    const artifact = cloneEvidenceFixture(m6bFixturePath);
    const sample = rgbSample(rgbCase(artifact, "neutral-raw"), "asymmetric-rgb");
    const forgedSource = [0.5, 0.25, 0.125, 1];
    sample.inputLinearRgba = forgedSource;
    sample.expectedOutputLinearRgba = [...forgedSource];
    sample.expectedSrgbRgb = forgedSource.slice(0, 3).map((value) =>
      Math.round(encodeGroundGlassLinearChannelToSrgb(value) * 255));
    sample.measuredSrgbRgba = [...sample.expectedSrgbRgb as number[], 255];
    refreshRgbSummaries(artifact);

    const result = persistedScenario(artifact, "m6b-final-rgb");
    expect(result.status).toBe("failed");
    expect(result.issues).toContain("rgb-source-sample-does-not-match-deterministic-fixture:neutral-raw:asymmetric-rgb");
  });

  it.each([
    ["serialized source RGB", "neutral-raw", (sample: MutableRecord) => { sample.inputLinearRgba = [0.5, 0.25, 0.125, 1]; },
      "rgb-source-sample-does-not-match-deterministic-fixture:neutral-raw:middle-gray"],
    ["source texel identity", "neutral-raw", (sample: MutableRecord) => {
      asMutableRecord(sample.sourceTexelPx).x = Number(asMutableRecord(sample.sourceTexelPx).x) + 1;
    }, "rgb-source-texel-mapping-invalid:neutral-raw:middle-gray"],
    ["display pixel identity", "neutral-raw", (sample: MutableRecord) => {
      asMutableRecord(sample.displayPixel).x = Number(asMutableRecord(sample.displayPixel).x) + 1;
    }, "rgb-display-pixel-coordinate-mismatch:neutral-raw:middle-gray"],
    ["source dimensions", "neutral-raw", (_sample: MutableRecord, pixelCase: MutableRecord) => {
      asMutableRecord(asMutableRecord(pixelCase.oracle).sourceDimensions).widthPx = 256;
    }, "rgb-source-dimensions-do-not-match-deterministic-fixture:neutral-raw"],
    ["source texture fingerprint", "m6b-throughput-half", (_sample: MutableRecord, pixelCase: MutableRecord) => {
      asMutableRecord(pixelCase.inputFingerprints).sourceData = "fnv1a32:00000000";
    }, "rgb-source-fingerprint-mismatch:m6b-throughput-half"],
    ["nearest edge texel", "neutral-raw", (sample: MutableRecord) => {
      asMutableRecord(sample.sourceTexelPx).x = Number(asMutableRecord(sample.sourceTexelPx).x) - 1;
    }, "rgb-source-texel-mapping-invalid:neutral-raw:nearest-edge-saturated-red"],
  ])("reconstructs the fixture source independently of %s", (_name, caseName, mutate, expectedIssue) => {
    const artifact = cloneEvidenceFixture(m6bFixturePath);
    const pixelCase = rgbCase(artifact, caseName);
    const sample = rgbSample(pixelCase, caseName === "m6b-throughput-half" ? "middle-gray" :
      caseName === "neutral-raw" && String(expectedIssue).includes("nearest-edge")
        ? "nearest-edge-saturated-red" : "middle-gray");
    mutate(sample, pixelCase);

    const result = persistedScenario(artifact, "m6b-final-rgb");
    expect(result.status).toBe("failed");
    expect(result.issues).toContain(expectedIssue);
  });

  it.each([
    ["Raw horizontal flip", "neutral-raw", "black", "u"],
    ["Upright vertical flip", "m6b-throughput-half", "black", "v"],
    ["Focus Loupe crop-origin inversion", "loupe-centered-crop", "black", "v"],
  ])("rejects %s through the source/display coordinate contract", (_name, caseName, sampleId, axis) => {
    const artifact = cloneEvidenceFixture(m6bFixturePath);
    const sample = rgbSample(rgbCase(artifact, caseName), sampleId);
    const sourceUv = asMutableRecord(sample.sourceUvTopOrigin);
    sourceUv[axis] = 1 - Number(sourceUv[axis]);

    expect(persistedScenario(artifact, "m6b-final-rgb").issues)
      .toContain(`rgb-orientation-or-crop-origin-invalid:${caseName}:${sampleId}`);
  });

  it("rejects a Focus Loupe pan offset that differs from its measured spatial crop", () => {
    const artifact = cloneEvidenceFixture(m6bFixturePath);
    const capture = rgbCase(artifact, "loupe-centered-crop");
    const crop = asMutableRecord(capture.sourceCrop);
    crop.centerU = Number(crop.centerU) + 0.1;

    expect(persistedScenario(artifact, "m6b-final-rgb").issues)
      .toContain("rgb-crop-does-not-match-spatial-capture:m6b-loupe-centered");
  });

  it.each([
    ["shifted Image Circle optical-axis sign", "m6b-circle-shifted", (state: MutableRecord) => {
      const coverage = asMutableRecord(state.coverage);
      const geometry = asMutableRecord(coverage.geometry);
      geometry.opticalAxisOffsetXMm = -Number(geometry.opticalAxisOffsetXMm);
    }, "rgb-linear-output-or-gain-invalid:m6b-circle-shifted:asymmetric-rgb"],
    ["nonparallel conic image-side orientation", "m6b-conic-coverage", (state: MutableRecord) => {
      const coverage = asMutableRecord(state.coverage);
      const geometry = asMutableRecord(coverage.geometry);
      const axial = asMutableRecord(geometry.axial);
      axial.x = -2;
    }, "rgb-linear-output-or-gain-invalid:m6b-conic-coverage:field-right"],
    ["natural-illumination physical optical axis", "m6b-combined-effects", (state: MutableRecord) => {
      const illumination = asMutableRecord(state.naturalIllumination);
      const geometry = asMutableRecord(illumination.geometry);
      geometry.opticalAxisOffsetXMm = -Number(geometry.opticalAxisOffsetXMm);
    }, "rgb-linear-output-or-gain-invalid:m6b-combined-effects:asymmetric-rgb"],
  ])("rejects %s when its independently replayed physical output changes", (_name, caseName, mutateState, expectedIssue) => {
    const artifact = cloneEvidenceFixture(m6bFixturePath);
    const capture = rgbCase(artifact, caseName);
    const state = asMutableRecord(capture.presentationState);
    mutateState(state);
    refreshPresentationStateFingerprint(capture);

    expect(persistedScenario(artifact, "m6b-final-rgb").issues).toContain(expectedIssue);
  });

  it.each([
    ["RGB gain applied twice", "m6b-throughput-half", "middle-gray", "rgb-linear-output-or-gain-invalid:m6b-throughput-half:middle-gray"],
    ["incorrect linear-to-sRGB conversion", "neutral-raw", "middle-gray", "rgb-linear-srgb-or-gain-reference-invalid:neutral-raw:middle-gray"],
    ["actual final RGB outside the frozen channel limit", "neutral-raw", "middle-gray", "rgb-channel-error-exceeds-frozen-limit:neutral-raw"],
  ])("rejects %s using the per-sample CPU presentation replay", (_name, caseName, sampleId, expectedIssue) => {
    const artifact = cloneEvidenceFixture(m6bFixturePath);
    const sample = rgbSample(rgbCase(artifact, caseName), sampleId);
    if (expectedIssue.includes("rgb-linear-output")) {
      const output = asMutableArray(sample.expectedOutputLinearRgba);
      output[0] = Number(output[0]) + 0.25;
    } else if (expectedIssue.includes("rgb-linear-srgb")) {
      const expected = asMutableArray(sample.expectedSrgbRgb);
      expected[0] = Number(expected[0]) + 8;
    } else {
      const measured = asMutableArray(sample.measuredSrgbRgba);
      const expected = asMutableArray(sample.expectedSrgbRgb);
      measured[0] = Number(expected[0]) + 10;
      const errors = asMutableArray(sample.absoluteChannelError);
      errors[0] = 10;
    }

    expect(persistedScenario(artifact, "m6b-final-rgb").issues).toContain(expectedIssue);
  });

  it("rejects missing RGB samples instead of trusting the nine-state summary", () => {
    const artifact = cloneEvidenceFixture(m6bFixturePath);
    const samples = asMutableArray(asMutableRecord(rgbCase(artifact, "neutral-raw").oracle).samples);
    samples.pop();

    expect(persistedScenario(artifact, "m6b-final-rgb").issues)
      .toContain("rgb-sample-inventory-incomplete:neutral-raw");
  });

  it.each([
    ["stale request", (capture: MutableRecord) => { capture.requestId = "retired-request"; }],
    ["stale renderer generation", (capture: MutableRecord) => { capture.rendererGenerationId = "retired-generation"; }],
  ])("rejects M6B %s evidence without a matching accepted host frame", (_name, mutate) => {
    const artifact = cloneEvidenceFixture(m6bFixturePath);
    mutate(rgbCase(artifact, "neutral-raw"));

    expect(persistedScenario(artifact, "m6b-final-rgb").issues)
      .toContain("rgb-neutral-raw-no-host-accepted-current-frame-result");
  });

  it.each([
    ["a missing capture", (artifact: MutableRecord) => { asMutableArray(artifact.spatialConformanceInputs).pop(); }, "spatial-capture-inventory-invalid"],
    ["a duplicate capture", (artifact: MutableRecord) => {
      const inputs = asMutableArray(artifact.spatialConformanceInputs);
      inputs.push(structuredClone(inputs[0]));
    }, "spatial-capture-identity-duplicate-or-missing"],
    ["a visible landmark marked unsupported", (artifact: MutableRecord) => {
      const input = asMutableRecord(asMutableArray(artifact.spatialConformanceInputs)[0]);
      const measurements = asMutableArray(asMutableRecord(input.alignment).measurements);
      asMutableRecord(measurements[0]).status = "unsupported";
    }, "spatial-per-capture-threshold-or-landmark-gate-failed"],
    ["a spatial error above two CSS pixels", (artifact: MutableRecord) => {
      const input = asMutableRecord(asMutableArray(artifact.spatialConformanceInputs)[0]);
      const measurements = asMutableArray(asMutableRecord(input.alignment).measurements);
      shiftSpatialMeasurement(asMutableRecord(measurements[0]), 5);
    }, "spatial-per-capture-threshold-or-landmark-gate-failed"],
    ["a per-capture RMS above 1.25 CSS pixels", (artifact: MutableRecord) => {
      const input = asMutableRecord(asMutableArray(artifact.spatialConformanceInputs)[0]);
      const measurements = asMutableArray(asMutableRecord(input.alignment).measurements);
      for (const value of measurements) {
        shiftSpatialMeasurement(asMutableRecord(value), 1.5);
      }
      refreshSpatialReplaySnapshots(artifact);
    }, "spatial-per-capture-error-exceeds-frozen-limit"],
  ])("rejects %s in the replayed per-capture spatial gate", (_name, mutate, expectedIssue) => {
    const artifact = cloneEvidenceFixture(m6bFixturePath);
    mutate(artifact);

    const issues = persistedScenario(artifact, "m6b-spatial-fixture").issues;
    if (!issues.includes(expectedIssue)) throw new Error(JSON.stringify({ expectedIssue, issues }));
  });

  it.each([
    ["a substituted material", (readback: MutableRecord) => {
      asMutableRecord(readback.material).uuid = "different-material-instance";
    }],
    ["the rejected NoBlending variant", (readback: MutableRecord) => {
      asMutableRecord(readback.material).blending = "none";
    }],
    ["nonopaque actual target alpha", (readback: MutableRecord) => {
      const samples = asMutableArray(readback.samples);
      const bytes = asMutableArray(asMutableRecord(samples[0]).actualTargetBytes);
      bytes[3] = 128;
    }],
    ["tone mapping silently enabled", (readback: MutableRecord) => {
      asMutableRecord(readback.material).toneMapped = true;
    }],
  ])("rejects M6C %s under the actual target/material contract", (_name, mutate) => {
    const artifact = cloneEvidenceFixture(m6cFixturePath);
    const firstCapture = asMutableRecord(asMutableArray(artifact.captures)[0]);
    mutate(asMutableRecord(firstCapture.readback));

    const issues = persistedScenario(artifact, "m6c-opaque-target-alpha", "m6cAlpha").issues;
    expect(issues.some((issue) => issue.startsWith("m6c-material-equivalence-invalid:") ||
      issue.startsWith("m6c-opaque-alpha-or-rgb-contract-failed:"))).toBe(true);
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

  it("qualifies an incomplete M5 composite only after its current M6 attempt fails and cleanup precedes WebGL", () => {
    const capture = createM5CompositeFailureCapture();
    const bundle = createBundle({
      lifecycle: { "m5-composite-incomplete-failure.json": capture },
    });
    expect(scenario(bundle, "m5-composite-incomplete-failure").status).toBe("passed");

    capture.failurePoint = "m6-presentation-before-render";
    expect(scenario(bundle, "m5-composite-incomplete-failure").issues)
      .toContain("incomplete-m5-composite-not-rejected-before-presentation");
  });

  it("accepts stale M6C readback retirement only after SPA navigation unmounts the host", () => {
    const capture = createRetiredM6cCapture();
    expect(scenario(createBundle({
      lifecycle: { "m6c-retired-generation.json": capture },
    }), "m6c-retired-generation-readback").status).toBe("passed");
  });

  it.each([
    ["a still-mounted host", (capture: ReturnType<typeof createRetiredM6cCapture>) => {
      capture.currentHostMounted = true;
    }],
    ["a surviving current request", (capture: ReturnType<typeof createRetiredM6cCapture>) => {
      capture.currentRequestId = "request-stale";
    }],
    ["a route that did not leave the scene", (capture: ReturnType<typeof createRetiredM6cCapture>) => {
      capture.routeAfterNavigation = "http://127.0.0.1:4175/simulator/free/architecture-rise";
    }],
  ])("rejects retired readback evidence with %s", (_name, mutate) => {
    const capture = createRetiredM6cCapture();
    mutate(capture);
    const result = scenario(createBundle({
      lifecycle: { "m6c-retired-generation.json": capture },
    }), "m6c-retired-generation-readback");

    expect(result.status).toBe("failed");
    expect(result.issues).toContain("retired-generation-host-still-published-after-navigation");
  });

  it.each([
    ["missing host acknowledgement", (capture: ReturnType<typeof createFailureCapture>) => {
      capture.events.splice(3, 1);
    }, "host-cleanup-acknowledgement-missing-or-contradictory"],
    ["replacement before host acknowledgement", (capture: ReturnType<typeof createFailureCapture>) => {
      const replacement = capture.events.pop()!;
      capture.events.splice(3, 0, replacement);
    }, "fallback-mounted-before-confirmed-cleanup"],
    ["failed cleanup represented as confirmed", (capture: ReturnType<typeof createFailureCapture>) => {
      capture.events[2]!.outcome = "failed";
    }, "confirmed-cleanup-not-observed-after-failure"],
    ["failed request published", (capture: ReturnType<typeof createFailureCapture>) => {
      capture.events.push({
        kind: "frame-completed",
        requestId: "request-failed",
        channelId: "channel-default",
        sceneId: "architecture-rise",
        generationId: "generation-failed",
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
        internalFallback: "none",
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

  it("rejects a production capture claiming WebGPU despite the WebGL-only boundary", () => {
    const artifact = cloneEvidenceFixture(productionFixturePath);
    artifact.productionWebGpuEnabled = true;
    const result = persistedScenario(artifact, "production-webgl-isolation", "productionIsolation");

    expect(result.issues).toContain("production-webgpu-enabled-or-runtime-revision-invalid");
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
