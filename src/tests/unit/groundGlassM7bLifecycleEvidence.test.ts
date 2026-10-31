import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  evaluateGroundGlassM7bLifecycleEvidence,
  GROUND_GLASS_M7B_EVALUATOR_REVISION,
  GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS,
  type GroundGlassM7bEvidenceClass,
  type GroundGlassM7bScenarioEvidence,
  type GroundGlassM7bScenarioId,
} from "../../render/groundGlassM7bLifecycleEvidence";

const sourceHeadSha = "a".repeat(40);

const scenarioCountsFor = (scenarios: readonly GroundGlassM7bScenarioEvidence[]) => {
  const counts = { passed: 0, failed: 0, blocked: 0, "not-run": 0 };
  for (const scenario of scenarios) counts[scenario.status] += 1;
  return counts;
};

const evidenceClassByScenario: Readonly<Record<GroundGlassM7bScenarioId, GroundGlassM7bEvidenceClass>> = {
  "m7b-phase-a-timeout-diagnosis": "native-webgpu-runtime",
  "m7b-b1-initialization-after-target": "native-webgpu-pre-mount-failure",
  "m7b-b2-runtime-failure-matrix": "native-webgpu-runtime-failure",
  "m7b-b3-async-retirement-and-latest-request": "native-webgpu-runtime-failure",
  "m7b-b4-cleanup-failure-sticky": "native-webgpu-cleanup-failure",
  "m7b-c1-device-loss-equivalent": "native-webgpu-device-loss-equivalent",
  "m7b-c2-test-destroyed-gpu-device-lost-promise": "native-webgpu-device-destroy-lost-promise",
  "m7b-d1-d3-request-and-resize-freshness": "native-webgpu-runtime",
  "m7b-d4-d5-scene-navigation-and-remount": "native-webgpu-pre-mount-failure",
  "m7b-d6-rapid-transition-sequence": "native-webgpu-runtime-failure",
  "m7b-e1-e4-retry-session-and-rejected-actions": "native-webgpu-runtime",
  "m7b-e5-independent-channel-owner": "unit-integration",
  "m7b-e6-terminal-webgl-context-loss": "native-webgl2",
  "m7b-f-production-preview-isolation": "production-preview-webgl",
  "m7b-f-m5q-and-m6-regression-locks": "native-regression-suite",
  "m7b-standard-validation": "unit-integration",
  "m7b-broad-local-e2e": "environment-blocked",
};

const baseScenario = (
  id: GroundGlassM7bScenarioId,
  status: GroundGlassM7bScenarioEvidence["status"] = "not-run",
  evidenceClass: GroundGlassM7bEvidenceClass = "not-run",
): GroundGlassM7bScenarioEvidence => ({
  id,
  title: id,
  status,
  evidenceClass,
  sourceHeadSha: status === "not-run" ? null : sourceHeadSha,
  testId: status === "not-run" ? null : `test:${id}`,
  testProject: status === "not-run" ? null : "chromium",
  browserIdentity: evidenceClass.startsWith("native-") ? "Chrome 140" : null,
  threeRevision: evidenceClass.startsWith("native-") ? "186" : null,
  invocation: status === "not-run" ? null : "npm run test:e2e -- --project=chrome-native-webgpu",
  identity: {
    channelId: null,
    pilotSessionId: null,
    retryEpoch: null,
    hostId: null,
    attemptId: null,
    rendererGenerationId: null,
    requestId: null,
    sceneId: null,
  },
  requestedBackend: null,
  selectedBackend: null,
  runtime: {
    observed: false,
    hostMounted: false,
    rendererFamily: null,
    actualExecutionApi: null,
    internalFallback: null,
  },
  applicationFallback: null,
  events: [],
  cleanupOutcome: "not-observed",
  fallbackOutcome: "not-observed",
  publication: {
    status: "not-observed",
    acceptedRequestId: null,
    completedRequestId: null,
  },
  supportingArtifacts: [],
  limitations: status === "not-run" ? ["not executed"] : [],
});

const event = (
  sequence: number,
  kind: string,
  generationId: string | null = "generation-1",
  attemptId: string | null = "attempt-1",
): GroundGlassM7bScenarioEvidence["events"][number] => ({
  sequence,
  kind,
  attemptId,
  generationId,
  requestId: "request-1",
  detail: null,
});

const passedScenario = (id: GroundGlassM7bScenarioId): GroundGlassM7bScenarioEvidence => {
  const evidenceClass = evidenceClassByScenario[id];
  const scenario = {
    ...baseScenario(id, "passed", evidenceClass),
    identity: {
      channelId: "default",
      pilotSessionId: evidenceClass.startsWith("native-webgpu-") ? "session-1" : null,
      retryEpoch: evidenceClass.startsWith("native-webgpu-") ? 0 : null,
      hostId: "host-1",
      attemptId: "attempt-1",
      rendererGenerationId: "generation-1",
      requestId: "request-1",
      sceneId: "architecture-rise",
    },
    requestedBackend: evidenceClass.startsWith("native-webgpu-") ? "webgpu" : "default",
    selectedBackend: evidenceClass.startsWith("native-webgpu-") ? "webgpu" : "webgl",
    runtime: {
      observed: false,
      hostMounted: false,
      rendererFamily: null,
      actualExecutionApi: null,
      internalFallback: null,
    },
    applicationFallback: false,
    cleanupOutcome: "confirmed" as const,
    fallbackOutcome: "none" as const,
    publication: {
      status: "current" as const,
      acceptedRequestId: "request-1",
      completedRequestId: "request-1",
    },
  };

  switch (evidenceClass) {
    case "native-webgpu-pre-mount-failure":
      return {
        ...scenario,
        runtime: {
          observed: true,
          hostMounted: false,
          rendererFamily: "webgpu-renderer",
          actualExecutionApi: "webgpu",
          internalFallback: "none",
        },
        applicationFallback: true,
        fallbackOutcome: "webgl-mounted",
        events: [event(0, "attempt"), event(1, "runtime-observed"), event(2, "failure"), eventWithFields(3, "cleanup-acknowledged", { outcome: "confirmed", channelId: "default", hostId: "host-1" })],
      };
    case "native-webgpu-runtime":
      return {
        ...scenario,
        runtime: {
          observed: true,
          hostMounted: true,
          rendererFamily: "webgpu-renderer",
          actualExecutionApi: "webgpu",
          internalFallback: "none",
        },
        events: [event(0, "attempt"), event(1, "runtime-observed"), event(2, "renderer-mounted")],
      };
    case "native-webgpu-runtime-failure":
      return {
        ...scenario,
        runtime: {
          observed: true,
          hostMounted: true,
          rendererFamily: "webgpu-renderer",
          actualExecutionApi: "webgpu",
          internalFallback: "none",
        },
        applicationFallback: true,
        fallbackOutcome: "webgl-mounted",
        events: [event(0, "attempt"), event(1, "runtime-observed"), event(2, "renderer-mounted"), event(3, "failure"), eventWithFields(4, "cleanup", { outcome: "confirmed" })],
      };
    case "native-webgpu-cleanup-failure":
      return {
        ...scenario,
        runtime: {
          observed: true,
          hostMounted: false,
          rendererFamily: "webgpu-renderer",
          actualExecutionApi: "webgpu",
          internalFallback: "none",
        },
        applicationFallback: false,
        cleanupOutcome: "failed",
        fallbackOutcome: "unavailable",
        events: [
          event(0, "attempt"), event(1, "runtime-observed"), event(2, "failure"),
          eventWithFields(3, "cleanup", { outcome: "failed" }),
          eventWithFields(4, "cleanup-acknowledged", { outcome: "failed", channelId: "default", hostId: "host-1" }),
        ],
      };
    case "native-webgpu-device-loss-equivalent":
      return {
        ...scenario,
        runtime: {
          observed: true,
          hostMounted: true,
          rendererFamily: "webgpu-renderer",
          actualExecutionApi: "webgpu",
          internalFallback: "none",
        },
        applicationFallback: true,
        fallbackOutcome: "webgl-mounted",
        events: [
          event(0, "attempt"), event(1, "runtime-observed"), event(2, "renderer-mounted"),
          event(3, "device-loss-equivalent-requested"), event(4, "failure"), eventWithFields(5, "cleanup", { outcome: "confirmed" }),
        ],
      };
    case "native-webgpu-device-destroy-lost-promise":
      return {
        ...scenario,
        runtime: {
          observed: true,
          hostMounted: true,
          rendererFamily: "webgpu-renderer",
          actualExecutionApi: "webgpu",
          internalFallback: "none",
        },
        applicationFallback: true,
        fallbackOutcome: "webgl-mounted",
        events: [
          event(0, "attempt"), event(1, "runtime-observed"), event(2, "renderer-mounted"),
          event(3, "device-destroy-requested"), event(4, "device-lost-observed"), event(5, "failure"), eventWithFields(6, "cleanup", { outcome: "confirmed" }),
        ].map((item) => item.kind === "device-lost-observed" ? { ...item, cause: "test-destroy" } : item),
      };
    case "native-webgl2":
      return {
        ...scenario,
        runtime: {
          observed: true,
          hostMounted: true,
          rendererFamily: "webgl-renderer",
          actualExecutionApi: "webgl2",
          internalFallback: "none",
        },
        fallbackOutcome: "unavailable",
        events: [
          eventWithFields(0, "failed-frame-result", { requestId: "request-1", acceptedByHost: true, channelId: "default", hostId: "host-1", sceneId: "architecture-rise" }),
          eventWithFields(1, "cleanup-acknowledged", { outcome: "confirmed", channelId: "default", hostId: "host-1" }),
        ],
      };
    case "native-regression-suite":
      return {
        ...scenario,
        runtime: {
          observed: true,
          hostMounted: true,
          rendererFamily: "webgpu-renderer",
          actualExecutionApi: "webgpu",
          internalFallback: "none",
        },
      };
    case "production-preview-webgl":
      return {
        ...scenario,
        runtime: {
          observed: true,
          hostMounted: true,
          rendererFamily: "webgl-renderer",
          actualExecutionApi: "webgl2",
          internalFallback: "none",
        },
      };
    case "unit-integration":
    case "environment-blocked":
    case "not-run":
      return scenario;
  }
};

const eventWithFields = (
  sequence: number,
  kind: string,
  fields: Readonly<Record<string, unknown>>,
): GroundGlassM7bScenarioEvidence["events"][number] => ({
  ...event(sequence, kind),
  ...fields,
} as unknown as GroundGlassM7bScenarioEvidence["events"][number]);


/** Preserve independent event facts in full-inventory synthetic fixtures. */
const enrichPassedScenarioWithObservedEvents = (id: GroundGlassM7bScenarioId): GroundGlassM7bScenarioEvidence => {
  const source = passedScenario(id);
  let events: GroundGlassM7bScenarioEvidence["events"][number][] = source.events.map((item) => {
    if (item.kind === "attempt") return { ...item, rendererRevision: source.threeRevision };
    if (item.kind === "runtime-observed") return {
      ...item,
      channelId: source.identity.channelId,
      hostId: source.identity.hostId,
      sceneId: source.identity.sceneId,
      rendererRevision: source.threeRevision,
      rendererFamily: source.runtime.rendererFamily as "webgpu-renderer" | "webgl-renderer" | null,
      executionApi: source.runtime.actualExecutionApi as "webgpu" | "webgl2" | "webgl" | null,
      internalFallback: source.runtime.internalFallback as "none" | "webgl2-compatibility" | null,
    };
    if (item.kind === "renderer-mounted") return {
      ...item,
      channelId: source.identity.channelId,
      hostId: source.identity.hostId,
      sceneId: source.identity.sceneId,
      rendererFamily: source.runtime.rendererFamily as "webgpu-renderer" | "webgl-renderer" | null,
      executionApi: source.runtime.actualExecutionApi as "webgpu" | "webgl2" | "webgl" | null,
      internalFallback: source.runtime.internalFallback as "none" | "webgl2-compatibility" | null,
    };
    return item;
  });
  if (source.evidenceClass === "native-regression-suite") {
    events.push({
      sequence: 0, kind: "runtime-observed", attemptId: "attempt-1",
      generationId: "generation-1", requestId: "request-1", detail: null,
      rendererRevision: source.threeRevision, rendererFamily: "webgpu-renderer",
      executionApi: "webgpu", internalFallback: "none",
    });
    events.push({
      sequence: 0, kind: "renderer-mounted", attemptId: "attempt-1",
      generationId: "generation-1", requestId: "request-1", detail: null,
      channelId: "default", hostId: "host-1", sceneId: "architecture-rise",
      rendererFamily: "webgpu-renderer", executionApi: "webgpu", internalFallback: "none",
    });
  }
  if (source.fallbackOutcome === "webgl-mounted") {
    events = events.filter((item) => item.kind !== "cleanup-acknowledged");
    if (!events.some((item) => item.kind === "cleanup")) {
      events.push(eventWithFields(0, "cleanup", { outcome: "confirmed" }));
    }
    events.push(eventWithFields(0, "cleanup-acknowledged", {
      outcome: "confirmed", channelId: "default", hostId: "host-1",
    }));
    events.push({
      sequence: 0, kind: "renderer-mounted", attemptId: "replacement-attempt",
      generationId: "generation-2", requestId: "request-1", detail: null,
      channelId: "default", hostId: "host-1", sceneId: "architecture-rise",
      rendererFamily: "webgl-renderer", executionApi: "webgl2", internalFallback: "none",
    });
  }
  const noPublicationRequired = new Set([
    "native-webgpu-cleanup-failure", "native-webgl2", "native-regression-suite",
    "production-preview-webgl", "unit-integration", "environment-blocked",
  ]);
  const publication = noPublicationRequired.has(source.evidenceClass)
    ? { status: "not-applicable" as const, acceptedRequestId: null, completedRequestId: null }
    : source.publication;
  if (publication.status === "current") {
    const replacement = source.fallbackOutcome === "webgl-mounted";
    events.push({
      sequence: 0, kind: "host-frame-result",
      attemptId: replacement ? "replacement-attempt" : "attempt-1",
      generationId: replacement ? "generation-2" : "generation-1",
      activeGenerationId: replacement ? "generation-2" : "generation-1",
      requestId: "request-1", latestAcceptedRequestId: "request-1",
      latestAcceptedSceneId: "architecture-rise",
      channelId: "default", hostId: "host-1", sceneId: "architecture-rise",
      frameStatus: "completed", acceptedByHost: true, detail: null,
      activeRendererFamily: replacement ? "webgl-renderer" : "webgpu-renderer",
    });
  }
  return { ...source, events: events.map((item, sequence) => ({ ...item, sequence })), publication };
};

const makePartialReport = () => {
  const scenarios = GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS.map((id) => baseScenario(id));
  return {
    schemaVersion: "ground-glass-m7b-native-lifecycle-v1",
    evaluatorRevision: GROUND_GLASS_M7B_EVALUATOR_REVISION,
    sourceHeadSha,
    qualification: "partially-qualified",
    scenarioCounts: scenarioCountsFor(scenarios),
    reviewFixRound1: { evaluatorRevision: GROUND_GLASS_M7B_EVALUATOR_REVISION },
    scenarios,
  };
};

const makeFullyQualifiedReport = () => {
  const scenarios = GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS.map(enrichPassedScenarioWithObservedEvents);
  return {
    schemaVersion: "ground-glass-m7b-native-lifecycle-v1",
    evaluatorRevision: GROUND_GLASS_M7B_EVALUATOR_REVISION,
    sourceHeadSha,
    qualification: "qualified-for-scoped-development-pilot",
    scenarioCounts: scenarioCountsFor(scenarios),
    reviewFixRound1: { evaluatorRevision: GROUND_GLASS_M7B_EVALUATOR_REVISION },
    scenarios,
  };
};

const readCommittedReport = (): Record<string, unknown> => JSON.parse(readFileSync(
  "docs/architecture/GROUND_GLASS_M7B_NATIVE_LIFECYCLE_REPORT.json",
  "utf8",
)) as Record<string, unknown>;

describe("Ground Glass M7B lifecycle evidence", () => {
  it("keeps a complete inventory with unrun entries only partially qualified", () => {
    const result = evaluateGroundGlassM7bLifecycleEvidence(makePartialReport());
    expect(result).toMatchObject({
      valid: true,
      qualification: "partially-qualified",
      counts: { passed: 0, failed: 0, blocked: 0, "not-run": GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS.length },
    });
  });

  it("rejects a missing required scenario", () => {
    const report = makePartialReport();
    report.scenarios = report.scenarios.slice(1);
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`missing-required-scenario:${GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS[0]}`);
  });

  it("rejects duplicate and unexpected scenario identities", () => {
    const report = makePartialReport() as { scenarios: unknown[]; [key: string]: unknown };
    report.scenarios = [
      ...report.scenarios,
      report.scenarios[0],
      { ...baseScenario("m7b-phase-a-timeout-diagnosis"), id: "m7b-invented" },
    ];
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("duplicate-scenario:m7b-phase-a-timeout-diagnosis");
    expect(result.errors).toContain("unexpected-scenario:m7b-invented");
  });

  it("accepts scenario evidence with explicit historical capture source heads", () => {
    const report = makeFullyQualifiedReport();
    report.scenarios[0] = { ...report.scenarios[0], sourceHeadSha: "b".repeat(40) };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result).toMatchObject({
      valid: true,
      qualification: "qualified-for-scoped-development-pilot",
    });
  });

  it("rejects malformed report and scenario source identities", () => {
    const report = makeFullyQualifiedReport();
    report.sourceHeadSha = "current-head";
    report.scenarios[0] = { ...report.scenarios[0], sourceHeadSha: "captured-head" };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("invalid-report-source-head-sha");
    expect(result.errors).toContain(`invalid-source-head-sha:${report.scenarios[0].id}`);
  });

  it("rejects contradictory native WebGPU runtime identity", () => {
    const report = makeFullyQualifiedReport();
    const scenarioIndex = report.scenarios.findIndex((scenario) => scenario.evidenceClass === "native-webgpu-runtime");
    const scenario = report.scenarios[scenarioIndex];
    report.scenarios[scenarioIndex] = {
      ...scenario,
      runtime: { ...scenario.runtime, actualExecutionApi: "webgl2", internalFallback: "webgl2-compatibility" },
    };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`native-webgpu-runtime-identity-contradiction:${scenario.id}`);
  });

  it("rejects a mounted-runtime claim for the same failed pre-mount generation", () => {
    const report = makeFullyQualifiedReport();
    const scenarioIndex = report.scenarios.findIndex((scenario) => scenario.evidenceClass === "native-webgpu-pre-mount-failure");
    const scenario = report.scenarios[scenarioIndex];
    report.scenarios[scenarioIndex] = {
      ...scenario,
      events: [...scenario.events, event(4, "renderer-mounted")],
    };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`pre-mount-failure-claims-mounted-renderer:${scenario.id}`);
  });

  it("rejects missing failure/cleanup evidence and out-of-order lifecycle events", () => {
    const report = makeFullyQualifiedReport();
    const scenarioIndex = report.scenarios.findIndex((scenario) => scenario.evidenceClass === "native-webgpu-runtime-failure");
    const scenario = report.scenarios[scenarioIndex];
    report.scenarios[scenarioIndex] = {
      ...scenario,
      events: [event(0, "attempt"), event(2, "runtime-observed"), event(1, "renderer-mounted")],
    };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`stale-or-duplicate-event-order:${scenario.id}`);
    expect(result.errors).toContain(`invalid-mounted-failure-order:${scenario.id}`);
  });

  it("rejects cleanup-failure evidence that claims successful disposal or fallback", () => {
    const report = makeFullyQualifiedReport();
    const scenarioIndex = report.scenarios.findIndex((scenario) => scenario.evidenceClass === "native-webgpu-cleanup-failure");
    const scenario = report.scenarios[scenarioIndex];
    report.scenarios[scenarioIndex] = {
      ...scenario,
      cleanupOutcome: "confirmed",
      applicationFallback: true,
      fallbackOutcome: "webgl-mounted",
    };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`cleanup-failure-fallback-contradiction:${scenario.id}`);
  });

  it("rejects a current publication whose completed request is stale", () => {
    const report = makeFullyQualifiedReport();
    const scenarioIndex = report.scenarios.findIndex((scenario) => scenario.publication.status === "current");
    const scenario = report.scenarios[scenarioIndex];
    report.scenarios[scenarioIndex] = {
      ...scenario,
      publication: { status: "current", acceptedRequestId: "request-2", completedRequestId: "request-1" },
    };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`current-publication-identity-mismatch:${scenario.id}`);
  });

  it("rejects a native WebGL failure frame attributed to another accepted request", () => {
    const report = makeFullyQualifiedReport();
    const scenarioIndex = report.scenarios.findIndex((scenario) => scenario.evidenceClass === "native-webgl2");
    const scenario = report.scenarios[scenarioIndex];
    const events = scenario.events.map((item) => item.kind === "failed-frame-result"
      ? { ...item, requestId: "stale-request", acceptedByHost: false } as unknown as GroundGlassM7bScenarioEvidence["events"][number]
      : item);
    report.scenarios[scenarioIndex] = { ...scenario, events };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`webgl-failure-not-attributed-to-current-request:${scenario.id}`);
  });


  it("rejects WebGL2 event evidence even when the native scenario summary remains unchanged", () => {
    const report = makeFullyQualifiedReport();
    const index = report.scenarios.findIndex((item) => item.evidenceClass === "native-webgpu-runtime");
    const scenario = report.scenarios[index];
    report.scenarios[index] = { ...scenario, events: scenario.events.map((event) =>
      event.kind === "runtime-observed" ? {
        ...event, rendererFamily: "webgpu-renderer", executionApi: "webgl2",
      } as GroundGlassM7bScenarioEvidence["events"][number] : event,
    ) };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("observed-native-runtime-contradiction:" + scenario.id);
  });

  it("rejects host-confirmed fallback after failed adapter cleanup", () => {
    const report = makeFullyQualifiedReport();
    const index = report.scenarios.findIndex((item) => item.evidenceClass === "native-webgpu-runtime-failure");
    const scenario = report.scenarios[index];
    report.scenarios[index] = {
      ...scenario, cleanupOutcome: "failed",
      events: scenario.events.map((event) => event.kind === "cleanup"
        ? { ...event, outcome: "failed" as const } : event),
    };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("cleanup-host-acknowledgement-contradiction:" + scenario.id);
    expect(result.errors).toContain("fallback-before-confirmed-cleanup:" + scenario.id);
  });

  it("rejects fallback when the host acknowledgement is absent or belongs to another generation", () => {
    const report = makeFullyQualifiedReport();
    const index = report.scenarios.findIndex((item) => item.evidenceClass === "native-webgpu-runtime-failure");
    const scenario = report.scenarios[index];
    for (const mutation of [
      scenario.events.filter((event) => event.kind !== "cleanup-acknowledged"),
      scenario.events.map((event) => event.kind === "cleanup-acknowledged"
        ? { ...event, generationId: "incorrect-generation" } : event),
    ]) {
      report.scenarios[index] = { ...scenario, events: mutation };
      expect(evaluateGroundGlassM7bLifecycleEvidence(report).errors).toContain(
        "cleanup-host-acknowledgement-contradiction:" + scenario.id,
      );
    }
  });

  it("rejects current publication with matching but fabricated summary request IDs", () => {
    const report = makeFullyQualifiedReport();
    const index = report.scenarios.findIndex((item) => item.id === "m7b-b3-async-retirement-and-latest-request");
    const scenario = report.scenarios[index];
    report.scenarios[index] = { ...scenario, publication: {
      status: "current", acceptedRequestId: "fabricated", completedRequestId: "fabricated",
    } };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("missing-host-publication-evidence:" + scenario.id);
  });

  it("rejects a fallback frame attributed to the retiring WebGPU generation", () => {
    const report = makeFullyQualifiedReport();
    const index = report.scenarios.findIndex((item) => item.id === "m7b-b3-async-retirement-and-latest-request");
    const scenario = report.scenarios[index];
    report.scenarios[index] = { ...scenario, events: scenario.events.map((event) =>
      event.kind === "host-frame-result" ? {
        ...event, generationId: "generation-1", activeGenerationId: "generation-1",
      } : event,
    ) };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("publication-not-from-confirmed-replacement:" + scenario.id);
  });

  it("rejects native WebGPU claims when any observed runtime contract field is changed or absent", () => {
    const mutations: Array<[
      string,
      (events: GroundGlassM7bScenarioEvidence["events"]) => GroundGlassM7bScenarioEvidence["events"],
    ]> = [
      ["runtime API", (events) => events.map((event) => event.kind === "runtime-observed"
        ? { ...event, executionApi: "webgl2" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["mounted API", (events) => events.map((event) => event.kind === "renderer-mounted"
        ? { ...event, executionApi: "webgl2" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["runtime renderer family", (events) => events.map((event) => event.kind === "runtime-observed"
        ? { ...event, rendererFamily: "webgl-renderer" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["mounted renderer family", (events) => events.map((event) => event.kind === "renderer-mounted"
        ? { ...event, rendererFamily: "webgl-renderer" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["runtime internal fallback", (events) => events.map((event) => event.kind === "runtime-observed"
        ? { ...event, internalFallback: "webgl2-compatibility" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["mounted internal fallback", (events) => events.map((event) => event.kind === "renderer-mounted"
        ? { ...event, internalFallback: "webgl2-compatibility" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["renderer revision", (events) => events.map((event) => event.kind === "runtime-observed"
        ? { ...event, rendererRevision: "185" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["attempt revision", (events) => events.map((event) => event.kind === "attempt"
        ? { ...event, rendererRevision: "185" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["runtime and mount disagreement", (events) => events.map((event) => event.kind === "renderer-mounted"
        ? { ...event, executionApi: "webgl2" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["runtime attempt identity", (events) => events.map((event) => event.kind === "runtime-observed"
        ? { ...event, attemptId: "other-attempt" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["runtime generation identity", (events) => events.map((event) => event.kind === "runtime-observed"
        ? { ...event, generationId: "other-generation" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["mount attempt identity", (events) => events.map((event) => event.kind === "renderer-mounted"
        ? { ...event, attemptId: "other-attempt" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["mount generation identity", (events) => events.map((event) => event.kind === "renderer-mounted"
        ? { ...event, generationId: "other-generation" } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
      ["missing runtime observation", (events) => events.filter((event) => event.kind !== "runtime-observed")],
      ["missing mount observation", (events) => events.filter((event) => event.kind !== "renderer-mounted")],
      ["missing observed fallback", (events) => events.map((event) => event.kind === "runtime-observed"
        ? { ...event, internalFallback: undefined } as GroundGlassM7bScenarioEvidence["events"][number] : event)],
    ];

    for (const [label, mutate] of mutations) {
      const report = makeFullyQualifiedReport();
      const index = report.scenarios.findIndex((item) => item.id === "m7b-phase-a-timeout-diagnosis");
      const scenario = report.scenarios[index];
      report.scenarios[index] = { ...scenario, events: mutate(scenario.events) };
      expect(evaluateGroundGlassM7bLifecycleEvidence(report).valid, label).toBe(false);
    }
  });

  it("rejects fallback unless cleanup agreement, host identity, and replacement ordering are valid", () => {
    const mutations: Array<[
      string,
      (scenario: GroundGlassM7bScenarioEvidence) => GroundGlassM7bScenarioEvidence,
    ]> = [
      ["host cleanup disagrees", (scenario) => ({
        ...scenario,
        events: scenario.events.map((event) => event.kind === "cleanup-acknowledged"
          ? { ...event, outcome: "failed" as const } : event),
      })],
      ["adapter cleanup precedes the failure", (scenario) => {
        const failure = scenario.events.find((event) => event.kind === "failure")!;
        const cleanup = scenario.events.find((event) => event.kind === "cleanup")!;
        return { ...scenario, events: scenario.events.map((event) =>
          event === failure ? { ...event, sequence: cleanup.sequence }
            : event === cleanup ? { ...event, sequence: failure.sequence }
              : event,
        ) };
      }],
      ["replacement precedes acknowledgement", (scenario) => {
        const acknowledgement = scenario.events.find((event) => event.kind === "cleanup-acknowledged")!;
        const replacement = scenario.events.find((event) => event.kind === "renderer-mounted" && event.generationId !== "generation-1")!;
        return { ...scenario, events: scenario.events.map((event) =>
          event === acknowledgement ? { ...event, sequence: replacement.sequence + 1 }
            : event === replacement ? { ...event, sequence: acknowledgement.sequence + 1 }
              : event,
        ) };
      }],
      ["uncertain cleanup claims fallback", (scenario) => ({
        ...scenario,
        cleanupOutcome: "uncertain",
        events: scenario.events.map((event) => event.kind === "cleanup" || event.kind === "cleanup-acknowledged"
          ? { ...event, outcome: "uncertain" as const } : event),
      })],
      ["replacement belongs to another host", (scenario) => ({
        ...scenario,
        events: scenario.events.map((event) => event.kind === "renderer-mounted" && event.generationId !== "generation-1"
          ? { ...event, hostId: "other-host" } : event),
      })],
    ];

    for (const [label, mutate] of mutations) {
      const report = makeFullyQualifiedReport();
      const index = report.scenarios.findIndex((item) => item.id === "m7b-b2-runtime-failure-matrix");
      report.scenarios[index] = mutate(report.scenarios[index]);
      expect(evaluateGroundGlassM7bLifecycleEvidence(report).valid, label).toBe(false);
    }
  });

  it("does not allow a later generation after failed cleanup even when the summary says unavailable", () => {
    const report = makeFullyQualifiedReport();
    const index = report.scenarios.findIndex((item) => item.id === "m7b-b4-cleanup-failure-sticky");
    const scenario = report.scenarios[index];
    report.scenarios[index] = {
      ...scenario,
      events: [...scenario.events, {
        sequence: scenario.events.length,
        kind: "renderer-mounted",
        attemptId: "attempt-2",
        generationId: "generation-2",
        requestId: "request-1",
        detail: null,
        channelId: "default",
        hostId: "host-1",
        sceneId: "architecture-rise",
        rendererFamily: "webgl-renderer",
        executionApi: "webgl2",
        internalFallback: "none",
      } as GroundGlassM7bScenarioEvidence["events"][number]],
    };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("failed-cleanup-allows-replacement:" + scenario.id);
  });

  it("rejects host publication evidence when channel, generation, host acceptance, freshness, or ordering contradicts it", () => {
    const mutations: Array<[
      string,
      (scenario: GroundGlassM7bScenarioEvidence) => GroundGlassM7bScenarioEvidence,
    ]> = [
      ["wrong channel", (scenario) => ({
        ...scenario,
        events: scenario.events.map((event) => event.kind === "host-frame-result"
          ? { ...event, channelId: "another-channel" } : event),
      })],
      ["retiring generation", (scenario) => ({
        ...scenario,
        events: scenario.events.map((event) => event.kind === "host-frame-result"
          ? { ...event, generationId: "generation-1", activeGenerationId: "generation-1" } : event),
      })],
      ["host rejection reported as current", (scenario) => ({
        ...scenario,
        events: scenario.events.map((event) => event.kind === "host-frame-result"
          ? { ...event, acceptedByHost: false } : event),
      })],
      ["latest request differs", (scenario) => ({
        ...scenario,
        publication: { ...scenario.publication, acceptedRequestId: "request-2" },
      })],
      ["latest accepted scene differs", (scenario) => ({
        ...scenario,
        events: scenario.events.map((event) => event.kind === "host-frame-result"
          ? { ...event, latestAcceptedSceneId: "interior-corner" } : event),
      })],
      ["publication after retirement", (scenario) => {
        const index = scenario.events.findIndex((event) => event.kind === "host-frame-result");
        const result = scenario.events[index];
        return {
          ...scenario,
          events: [
            ...scenario.events.slice(0, index),
            {
              ...result,
              kind: "cleanup-acknowledged",
              sequence: result.sequence,
              outcome: "confirmed",
            } as GroundGlassM7bScenarioEvidence["events"][number],
            { ...result, sequence: result.sequence + 1 },
            ...scenario.events.slice(index + 1),
          ],
        };
      }],
      ["missing host publication event", (scenario) => ({
        ...scenario,
        events: scenario.events.filter((event) => event.kind !== "host-frame-result"),
      })],
    ];

    for (const [label, mutate] of mutations) {
      const report = makeFullyQualifiedReport();
      const index = report.scenarios.findIndex((item) => item.id === "m7b-b3-async-retirement-and-latest-request");
      report.scenarios[index] = mutate(report.scenarios[index]);
      expect(evaluateGroundGlassM7bLifecycleEvidence(report).valid, label).toBe(false);
    }
  });

  it("accepts an observed stale result rejected after a confirmed cross-generation replacement", () => {
    const report = makeFullyQualifiedReport();
    const index = report.scenarios.findIndex((item) => item.id === "m7b-e5-independent-channel-owner");
    const scenario = report.scenarios[index];
    report.scenarios[index] = {
      ...scenario,
      publication: { status: "stale-rejected", acceptedRequestId: "request-current", completedRequestId: "request-stale" },
      events: [
        {
          sequence: 0, kind: "renderer-mounted", attemptId: "attempt-1", generationId: "generation-1",
          requestId: "request-stale", detail: null, channelId: "default", hostId: "host-1",
          sceneId: "architecture-rise", rendererFamily: "webgpu-renderer", executionApi: "webgpu",
          internalFallback: "none",
        },
        {
          sequence: 1, kind: "cleanup-acknowledged", attemptId: null, generationId: "generation-1",
          requestId: null, detail: null, channelId: "default", hostId: "host-1", outcome: "confirmed",
        },
        {
          sequence: 2, kind: "renderer-mounted", attemptId: "attempt-2", generationId: "generation-2",
          requestId: "request-current", detail: null, channelId: "default", hostId: "host-1",
          sceneId: "interior-corner", rendererFamily: "webgl-renderer", executionApi: "webgl2",
          internalFallback: "none",
        },
        {
          sequence: 3, kind: "host-frame-result", attemptId: "attempt-1", generationId: "generation-1",
          activeGenerationId: "generation-2", requestId: "request-stale", latestAcceptedRequestId: "request-current",
          latestAcceptedSceneId: "interior-corner",
          detail: null, channelId: "default", hostId: "host-1", sceneId: "architecture-rise",
          frameStatus: "completed", acceptedByHost: false, activeRendererFamily: "webgl-renderer",
        },
      ] as GroundGlassM7bScenarioEvidence["events"],
    };
    expect(evaluateGroundGlassM7bLifecycleEvidence(report)).toMatchObject({
      valid: true,
      qualification: "qualified-for-scoped-development-pilot",
    });
  });

  it("accepts the committed M7B report and its partial-qualification counts", () => {
    const report = readCommittedReport();
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result).toMatchObject({
      valid: true,
      qualification: "partially-qualified",
      counts: { passed: 6, failed: 0, blocked: 10, "not-run": 1 },
    });
    expect(report.evaluatorRevision).toBe(GROUND_GLASS_M7B_EVALUATOR_REVISION);
    expect(report.scenarioCounts).toEqual(result.counts);
  });

  it("rejects a declared passed count that disagrees with the inventory", () => {
    const report = readCommittedReport();
    (report.scenarioCounts as Record<string, unknown>).passed = 5;
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("scenario-count-mismatch:passed");
    expect(result.errors).toContain("scenario-count-total-mismatch");
  });

  it("rejects a declared blocked count that disagrees with the inventory", () => {
    const report = readCommittedReport();
    (report.scenarioCounts as Record<string, unknown>).blocked = 11;
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("scenario-count-mismatch:blocked");
    expect(result.errors).toContain("scenario-count-total-mismatch");
  });

  it("rejects missing scenario count metadata and required count fields", () => {
    const missingMetadata = readCommittedReport();
    delete missingMetadata.scenarioCounts;
    expect(evaluateGroundGlassM7bLifecycleEvidence(missingMetadata).errors).toContain("missing-scenario-counts");

    const missingField = readCommittedReport();
    delete (missingField.scenarioCounts as Record<string, unknown>).blocked;
    expect(evaluateGroundGlassM7bLifecycleEvidence(missingField).errors).toContain("missing-scenario-count:blocked");
  });

  it.each([-1, 1.5, "6"])("rejects invalid scenario count values (%j)", (value) => {
    const report = makeFullyQualifiedReport();
    (report.scenarioCounts as unknown as Record<string, unknown>).passed = value;
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("invalid-scenario-count:passed");
  });

  it("rejects unexpected scenario count keys", () => {
    const report = makeFullyQualifiedReport();
    (report.scenarioCounts as unknown as Record<string, unknown>).unverified = 0;
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("unexpected-scenario-count-key:unverified");
  });

  it("rejects missing and unsupported evaluator revisions", () => {
    const missingRevision = makeFullyQualifiedReport();
    delete (missingRevision as unknown as Record<string, unknown>).evaluatorRevision;
    expect(evaluateGroundGlassM7bLifecycleEvidence(missingRevision).errors).toContain("missing-evaluator-revision");

    const unsupportedRevision = makeFullyQualifiedReport();
    (unsupportedRevision as unknown as Record<string, unknown>).evaluatorRevision = "m7b-lifecycle-evidence-v2";
    expect(evaluateGroundGlassM7bLifecycleEvidence(unsupportedRevision).errors).toContain("unsupported-evaluator-revision");
  });

  it("rejects evaluator revision conflicts in structured review metadata", () => {
    const report = makeFullyQualifiedReport();
    (report.reviewFixRound1 as Record<string, unknown>).evaluatorRevision = "m7b-lifecycle-evidence-v2";
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("conflicting-evaluator-revision-metadata");
  });

  it("validates the JSON-serialized report with the same evidence decision", () => {
    const report = JSON.parse(JSON.stringify(makeFullyQualifiedReport())) as unknown;
    expect(evaluateGroundGlassM7bLifecycleEvidence(report)).toMatchObject({
      valid: true,
      qualification: "qualified-for-scoped-development-pilot",
    });
  });

  it("rejects fabricated events attached to an unrun scenario", () => {
    const report = makePartialReport();
    const scenario = report.scenarios[0];
    report.scenarios[0] = { ...scenario, events: [event(0, "attempt")] };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`not-run-has-events:${scenario.id}`);
  });

  it("accepts only a structurally complete synthetic inventory for full qualification", () => {
    const report = makeFullyQualifiedReport();
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.errors).toEqual([]);
    expect(result).toMatchObject({
      valid: true,
      qualification: "qualified-for-scoped-development-pilot",
      counts: { passed: GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS.length, failed: 0, blocked: 0, "not-run": 0 },
    });
  });
});
