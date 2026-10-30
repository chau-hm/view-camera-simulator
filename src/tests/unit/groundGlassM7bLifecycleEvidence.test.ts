import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  evaluateGroundGlassM7bLifecycleEvidence,
  GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS,
  type GroundGlassM7bEvidenceClass,
  type GroundGlassM7bScenarioEvidence,
  type GroundGlassM7bScenarioId,
} from "../../render/groundGlassM7bLifecycleEvidence";

const sourceHeadSha = "a".repeat(40);

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

const makePartialReport = () => ({
  schemaVersion: "ground-glass-m7b-native-lifecycle-v1",
  sourceHeadSha,
  qualification: "partially-qualified",
  scenarios: GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS.map((id) => baseScenario(id)),
});

const makeFullyQualifiedReport = () => ({
  schemaVersion: "ground-glass-m7b-native-lifecycle-v1",
  sourceHeadSha,
  qualification: "qualified-for-scoped-development-pilot",
  scenarios: GROUND_GLASS_M7B_REQUIRED_SCENARIO_IDS.map(passedScenario),
});

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

  it("rejects source evidence captured from a different source head", () => {
    const report = makeFullyQualifiedReport();
    report.scenarios[0] = { ...report.scenarios[0], sourceHeadSha: "b".repeat(40) };
    const result = evaluateGroundGlassM7bLifecycleEvidence(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`stale-source-head:${report.scenarios[0].id}`);
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

  it("accepts the committed M7B report and its partial-qualification counts", () => {
    const report = JSON.parse(readFileSync(
      "docs/architecture/GROUND_GLASS_M7B_NATIVE_LIFECYCLE_REPORT.json",
      "utf8",
    )) as unknown;
    expect(evaluateGroundGlassM7bLifecycleEvidence(report)).toMatchObject({
      valid: true,
      qualification: "partially-qualified",
      counts: { passed: 12, failed: 0, blocked: 4, "not-run": 1 },
    });
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
