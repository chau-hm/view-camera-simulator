import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateGroundGlassM7cR187LifecycleEvidence } from "../../render/groundGlassM7cR187LifecycleEvidence";
import {
  GROUND_GLASS_M7G_EVALUATOR_REVISION,
  GROUND_GLASS_M7G_REPORT_ID,
  evaluateGroundGlassM7gConsolidation,
} from "../../render/webgpu/groundGlassM7gConsolidatedEvidence";

type JsonRecord = Record<string, unknown>;
const root = process.cwd();
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const readJson = (relativePath: string): JsonRecord => {
  const value: unknown = JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
  if (!isRecord(value)) throw new TypeError(`Expected a JSON object at ${relativePath}`);
  return value;
};
const clone = <T,>(value: T): T => structuredClone(value);
const getRecord = (value: unknown, key: string): JsonRecord => {
  const result = isRecord(value) ? value[key] : undefined;
  if (!isRecord(result)) throw new TypeError(`Expected object field ${key}`);
  return result;
};
const arrayOfRecords = (value: unknown): JsonRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];
const getScenario = (report: JsonRecord, id: string): JsonRecord => {
  const found = arrayOfRecords(report.scenarios).find((scenario) => scenario.id === id);
  if (!found) throw new Error(`Missing scenario ${id}`);
  return found;
};
const getObservation = (scenario: JsonRecord, kind: string): JsonRecord => {
  const provenance = getRecord(scenario, "provenance");
  const found = arrayOfRecords(provenance.observations).find((observation) => observation.kind === kind);
  if (!found) throw new Error(`Missing observation ${kind}`);
  return found;
};
const eventOf = (scenario: JsonRecord, kind: string): JsonRecord => {
  const found = arrayOfRecords(scenario.events).find((event) => event.kind === kind);
  if (!found) throw new Error(`Missing event ${kind}`);
  return found;
};
const captureEvents = (capture: JsonRecord, ...path: string[]): JsonRecord[] => {
  let value: unknown = capture;
  for (const key of path) value = isRecord(value) ? value[key] : undefined;
  return arrayOfRecords(value);
};

const createEvidenceInput = (): JsonRecord => {
  const input: JsonRecord = {
    schemaVersion: 1,
    reportId: GROUND_GLASS_M7G_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7G_EVALUATOR_REVISION,
    predecessorReports: {
      m7c: readJson("docs/architecture/GROUND_GLASS_M7C_R187_RAW_LIFECYCLE_REPORT.json"),
      m7d: readJson("docs/architecture/GROUND_GLASS_M7D_R187_PHYSICAL_COC_REPORT.json"),
      m7e: readJson("docs/architecture/ground-glass-m7e-r187-gather-b1/GROUND_GLASS_M7E_R187_GATHER_B1_REPORT.json"),
      m7f: readJson("docs/architecture/GROUND_GLASS_M7F_R187_PRESENTATION_REPORT.json"),
    },
    predecessorReplays: {
      m7e: readJson("docs/architecture/ground-glass-m7g-r187/replay/m7e-offline-replay.json"),
      m7f: readJson("docs/architecture/ground-glass-m7g-r187/replay/m7f-offline-replay.json"),
    },
    captures: {
      initialization: readJson("docs/architecture/ground-glass-m7g-r187/native/initialization/init-after-target-recheck.json"),
      deviceLossEquivalent: readJson("docs/architecture/ground-glass-m7g-r187/native/device-loss/device-loss-equivalent.json"),
      testDestroyedDeviceLoss: readJson("docs/architecture/ground-glass-m7g-r187/native/device-loss/test-destroyed-device-lost-promise.json"),
      externalLoss: readJson("docs/architecture/ground-glass-m7g-r187/native/device-loss/external-loss-observation.json"),
      heldComposite: readJson("docs/architecture/ground-glass-m7g-r187/native/m5-composite-latest-request.json"),
      broadE2e: readJson("docs/architecture/ground-glass-m7g-r187/validation/broad-e2e.json"),
      productionIsolation: readJson("docs/architecture/ground-glass-m7g-r187/validation/production-isolation.json"),
    },
    authorization: {
      m3RawRttRendererAttemptAuthority: "m3-raw-pilot",
      r187M4Status: "research-only",
      r187M5Status: "research-only",
      r187M6Status: "development-only",
      m5qStatus: "partially-qualified",
      m6EvidenceUsedForRendererSelection: false,
      productionWebGpuEnabled: false,
      productionGroundGlass: "WebGL-only",
      m8Authorized: false,
      m9Authorized: false,
      productionTestSeamExposed: false,
    },
  };
  const first = evaluateGroundGlassM7gConsolidation(input);
  input.scenarios = first.scenarios.map(({ id, status }) => ({ id, status }));
  input.scenarioCounts = first.scenarioCounts.computed;
  return input;
};

const m7c = (input: JsonRecord): JsonRecord => getRecord(getRecord(input, "predecessorReports"), "m7c");
const capture = (input: JsonRecord, key: string): JsonRecord => getRecord(getRecord(input, "captures"), key);
const expectM7gIssue = (input: JsonRecord, expectedIssue: string): void => {
  const evaluation = evaluateGroundGlassM7gConsolidation(input);
  expect(evaluation.valid, evaluation.issues.join("\n")).toBe(false);
  expect(evaluation.issues).toContain(expectedIssue);
};

describe("M7G consolidated r187 evidence integrity", () => {
  it("replays all predecessor contracts and preserves the blocked external-loss gate", () => {
    const evaluation = evaluateGroundGlassM7gConsolidation(createEvidenceInput());
    expect(evaluation.valid).toBe(true);
    expect(evaluation.qualificationStatus).toBe("partially-qualified");
    expect(evaluation.qualificationPass).toBe(false);
    expect(evaluation.scenarioCounts.computed).toEqual({
      passed: 6,
      failed: 0,
      blocked: 1,
      "not-run": 0,
    });
    expect(evaluation.decisions.m8EntryGate).toBe("denied");
    expect(evaluation.decisions.deviceLossHandling).toBe("partially-qualified");
  });

  const mutations: Array<Readonly<{
    name: string;
    expectedIssue: string;
    mutate: (input: JsonRecord) => void;
    m7cError?: string;
  }>> = [
    {
      name: "rejects r186 runtime evidence relabeled as r187",
      expectedIssue: "native-runtime-not-observed:m7g-r187-init-after-target-operation-recheck",
      mutate: (input) => {
        const init = capture(input, "initialization");
        const runtime = captureEvents(init, "observation", "runtime", "adapterObservations").find((e) => e.kind === "runtime-observed");
        if (!runtime) throw new Error("Missing M7G initialization runtime event");
        runtime.rendererRevision = "186";
      },
    },
    {
      name: "rejects WebGL2 compatibility represented as native WebGPU",
      expectedIssue: "capture-provenance-invalid:m7g-r187-init-after-target-operation-recheck",
      mutate: (input) => {
        const init = capture(input, "initialization");
        getRecord(init, "captureProvenance").actualExecutionApi = "webgl2";
        getRecord(init, "captureProvenance").internalFallback = "webgl2-compatibility";
      },
    },
    {
      name: "rejects a missing M7C source report",
      expectedIssue: "predecessor-report-missing:m7c",
      mutate: (input) => { getRecord(input, "predecessorReports").m7c = null; },
    },
    {
      name: "rejects a missing M7D source report",
      expectedIssue: "predecessor-report-missing:m7d",
      mutate: (input) => { getRecord(input, "predecessorReports").m7d = null; },
    },
    {
      name: "rejects a missing M7E source report",
      expectedIssue: "predecessor-report-missing:m7e",
      mutate: (input) => { getRecord(input, "predecessorReports").m7e = null; },
    },
    {
      name: "rejects a missing M7F source report",
      expectedIssue: "predecessor-report-missing:m7f",
      mutate: (input) => { getRecord(input, "predecessorReports").m7f = null; },
    },
    {
      name: "rejects an incorrect native capture source SHA",
      expectedIssue: "capture-provenance-invalid:m7g-r187-device-loss-equivalent",
      mutate: (input) => { capture(input, "deviceLossEquivalent").sourceHeadSha = "0".repeat(40); },
    },
    {
      name: "rejects duplicate consolidated scenario identities",
      expectedIssue: "duplicate-scenario:m7g-r187-device-loss-equivalent",
      mutate: (input) => {
        const scenarios = input.scenarios as JsonRecord[];
        scenarios.push({ ...scenarios[1] });
      },
    },
    {
      name: "rejects an unobserved external loss claimed as passed",
      expectedIssue: "external-loss-classification-invalid:m7g-r187-spontaneous-external-device-loss",
      mutate: (input) => { capture(input, "externalLoss").status = "passed"; },
    },
    {
      name: "rejects initialization failure with an unknown operation",
      expectedIssue: "initialization-operation-identity-invalid:m7g-r187-init-after-target-operation-recheck",
      mutate: (input) => {
        const failure = getRecord(getRecord(capture(input, "initialization"), "observation"), "failure");
        const event = arrayOfRecords(failure.adapterEvents).find((candidate) => candidate.kind === "failure");
        if (!event) throw new Error("Missing initialization failure event");
        event.operation = "unknown";
      },
    },
    {
      name: "rejects cleanup before the held GPU operation settles",
      expectedIssue: "predecessor-report-invalid:m7c",
      m7cError: "pending-retirement-cleanup-chain-contradiction:m7c-r187-pending-queue-retirement",
      mutate: (input) => {
        const scenario = getScenario(m7c(input), "m7c-r187-pending-queue-retirement");
        const cleanup = eventOf(scenario, "cleanup");
        const settled = eventOf(scenario, "queue-completion-settled");
        cleanup.sequence = Number(settled.sequence) - 1;
      },
    },
    {
      name: "rejects failed resource cleanup reported as confirmed",
      expectedIssue: "predecessor-report-invalid:m7c",
      m7cError: "cleanup-failure-fallback-contradiction:m7c-r187-adapter-disposal-failure",
      mutate: (input) => {
        const scenario = getScenario(m7c(input), "m7c-r187-adapter-disposal-failure");
        const cleanup = eventOf(scenario, "cleanup");
        cleanup.outcome = "confirmed";
        const acknowledgement = arrayOfRecords(scenario.events).find((event) =>
          event.kind === "cleanup-acknowledged" && event.generationId === cleanup.generationId,
        );
        if (!acknowledgement) throw new Error("Missing failed-cleanup host acknowledgement");
        acknowledgement.outcome = "confirmed";
      },
    },
    {
      name: "rejects WebGL replacement mounted before host cleanup acknowledgement",
      expectedIssue: "cleanup-fallback-order-invalid:m7g-r187-init-after-target-operation-recheck",
      mutate: (input) => {
        const init = capture(input, "initialization");
        const observation = getRecord(init, "observation");
        const generation = getRecord(observation, "identities").generationId;
        const events = captureEvents(observation, "runtime", "hostMountObservations");
        const replacement = events.find((event) => event.kind === "renderer-mounted" && event.generationId !== generation);
        const ack = captureEvents(observation, "cleanup", "events").find((event) => event.kind === "cleanup-acknowledged" && event.generationId === generation);
        if (!replacement || !ack) throw new Error("Missing cleanup/replacement events");
        replacement.sequence = Number(ack.sequence) - 1;
      },
    },
    {
      name: "rejects an old request accepted after replacement",
      expectedIssue: "predecessor-report-invalid:m7c",
      m7cError: "latest-request-result-chain-contradiction:m7c-r187-latest-request-stale-rejection",
      mutate: (input) => {
        const stale = eventOf(getScenario(m7c(input), "m7c-r187-latest-request-stale-rejection"), "host-frame-result");
        const summary = getObservation(getScenario(m7c(input), "m7c-r187-latest-request-stale-rejection"), "latest-request-interleaving");
        stale.requestId = getRecord(summary, "requests").staleRequestId;
        stale.acceptedByHost = true;
      },
    },
    {
      name: "rejects an old M5 composite routed through the new M6 presentation",
      expectedIssue: "m4-m5-m6-final-diagnostics-not-current:m7g-r187-held-m5-composite-latest-request",
      mutate: (input) => {
        const held = capture(input, "heldComposite");
        getRecord(held, "finalDiagnostics").presentationRequestId = held.r1RequestId;
      },
    },
    {
      name: "rejects a stale M6 diagnostic after request replacement",
      expectedIssue: "m4-m5-m6-final-diagnostics-not-current:m7g-r187-held-m5-composite-latest-request",
      mutate: (input) => {
        const held = capture(input, "heldComposite");
        getRecord(held, "finalDiagnostics").lastDisplayedRequestId = held.r1RequestId;
      },
    },
    {
      name: "rejects the current result tied to the wrong renderer generation",
      expectedIssue: "stale-m5-result-published-or-r2-not-accepted:m7g-r187-held-m5-composite-latest-request",
      mutate: (input) => {
        const event = captureEvents(capture(input, "heldComposite"), "orderedEvents")
          .find((candidate) => candidate.kind === "host-frame-result" && candidate.acceptedByHost === true);
        if (event) event.generationId = "retired-generation";
      },
    },
    {
      name: "rejects the wrong host instance identity",
      expectedIssue: "stale-m5-result-published-or-r2-not-accepted:m7g-r187-held-m5-composite-latest-request",
      mutate: (input) => {
        const event = captureEvents(capture(input, "heldComposite"), "orderedEvents")
          .find((candidate) => candidate.kind === "host-request-accepted" && candidate.requestId === capture(input, "heldComposite").r2RequestId);
        if (event) event.hostId = "another-host";
      },
    },
    {
      name: "rejects a cross-channel current request",
      expectedIssue: "stale-m5-result-published-or-r2-not-accepted:m7g-r187-held-m5-composite-latest-request",
      mutate: (input) => {
        const event = captureEvents(capture(input, "heldComposite"), "orderedEvents")
          .find((candidate) => candidate.kind === "host-request-accepted" && candidate.requestId === capture(input, "heldComposite").r2RequestId);
        if (event) event.channelId = "comparison";
      },
    },
    {
      name: "rejects a cross-scene current request",
      expectedIssue: "stale-m5-result-published-or-r2-not-accepted:m7g-r187-held-m5-composite-latest-request",
      mutate: (input) => {
        const event = captureEvents(capture(input, "heldComposite"), "orderedEvents")
          .find((candidate) => candidate.kind === "host-request-accepted" && candidate.requestId === capture(input, "heldComposite").r2RequestId);
        if (event) event.sceneId = "unknown-scene";
      },
    },
    {
      name: "rejects an injected device-loss equivalent relabeled as spontaneous loss",
      expectedIssue: "device-loss-equivalent-misclassified:m7g-r187-device-loss-equivalent",
      mutate: (input) => {
        const equivalent = capture(input, "deviceLossEquivalent");
        getRecord(equivalent, "observation").qualificationEvents = [
          ...arrayOfRecords(getRecord(equivalent, "observation").qualificationEvents),
          { kind: "device-lost-observed", cause: "runtime-loss", generationId: getRecord(getRecord(equivalent, "observation"), "identities").generationId },
        ];
      },
    },
    {
      name: "rejects test-destroyed GPUDevice loss relabeled as external",
      expectedIssue: "test-destroyed-device-loss-chain-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const lost = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "qualificationEvents")
          .find((event) => event.kind === "device-lost-observed");
        if (lost) lost.cause = "runtime-loss";
      },
    },
    {
      name: "rejects duplicate cleanup after one test-induced device loss",
      expectedIssue: "duplicate-or-missing-cleanup:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const events = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "cleanup", "events");
        const cleanup = events.find((event) => event.kind === "cleanup");
        if (cleanup) events.push({ ...cleanup });
      },
    },
    {
      name: "rejects device loss attributed to a retired generation",
      expectedIssue: "test-destroyed-device-loss-chain-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const lost = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "qualificationEvents")
          .find((event) => event.kind === "device-lost-observed");
        if (lost) lost.generationId = "retired-generation";
      },
    },
    {
      name: "rejects sticky fallback remount that creates an implicit WebGPU attempt",
      expectedIssue: "predecessor-report-invalid:m7c",
      m7cError: "remount-implicitly-retried-pilot-session:m7c-r187-sticky-fallback-remount",
      mutate: (input) => {
        const observation = getObservation(getScenario(m7c(input), "m7c-r187-sticky-fallback-remount"), "sticky-session-remount");
        (observation.attemptGenerationsAfterRemount as unknown[]).push("implicit-native-retry");
      },
    },
    {
      name: "rejects explicit retry without fresh authorization",
      expectedIssue: "predecessor-report-invalid:m7c",
      m7cError: "authorized-recovery-boundary-contradiction:m7c-r187-explicit-retry-new-session",
      mutate: (input) => {
        getRecord(getObservation(getScenario(m7c(input), "m7c-r187-explicit-retry-new-session"), "authorized-recovery-actions"), "explicitRetry").status = "rejected";
      },
    },
    {
      name: "rejects an unknown action that changes the retry attempt inventory",
      expectedIssue: "predecessor-report-invalid:m7c",
      m7cError: "authorized-recovery-boundary-contradiction:m7c-r187-explicit-retry-new-session",
      mutate: (input) => {
        const observation = getObservation(getScenario(m7c(input), "m7c-r187-explicit-retry-new-session"), "authorized-recovery-actions");
        (observation.attemptsAfterInvalidAction as unknown[]).push("unknown-action-attempt");
      },
    },
    {
      name: "rejects automatic replacement after terminal WebGL failure",
      expectedIssue: "predecessor-report-invalid:m7c",
      m7cError: "webgl-terminal-publication-after-terminal-failure:m7c-r187-terminal-webgl-remount",
      mutate: (input) => {
        const scenario = getScenario(m7c(input), "m7c-r187-terminal-webgl-remount");
        const event = eventOf(scenario, "failure");
        scenario.events = [...arrayOfRecords(scenario.events), {
          kind: "host-frame-result", acceptedByHost: true, sequence: Number(event.sequence) + 1,
        }];
      },
    },
    {
      name: "rejects a missing broad E2E result claimed as passed",
      expectedIssue: "scenario-status-claim-contradiction:m7g-r187-broad-application-e2e",
      mutate: (input) => {
        getRecord(input, "captures").broadE2e = null;
        const claims = input.scenarios as JsonRecord[];
        const claim = claims.find((item) => item.id === "m7g-r187-broad-application-e2e");
        if (claim) claim.status = "passed";
      },
    },
    {
      name: "rejects a controlled presentation fixture represented as registered-scene alignment",
      expectedIssue: "m7f-registered-and-fixture-evidence-boundary-invalid",
      mutate: (input) => {
        const m7f = getRecord(getRecord(input, "predecessorReports"), "m7f");
        const fixture = getScenario(m7f, "m6c-opaque-target-alpha");
        getRecord(fixture, "runtimeIdentity").evidenceScope = "registered-scene-alignment";
      },
    },
    {
      name: "rejects promotion of an M5Q photographic quality status",
      expectedIssue: "m5q-quality-status-changed-or-promoted",
      mutate: (input) => {
        const m7e = getRecord(getRecord(input, "predecessorReports"), "m7e");
        getRecord(getRecord(getRecord(m7e, "qualification"), "dimensions"), "Q1").status = "qualified";
      },
    },
    {
      name: "rejects M6 evidence used as renderer-attempt authority",
      expectedIssue: "predecessor-report-invalid:m7f",
      mutate: (input) => {
        getRecord(getRecord(input, "predecessorReports").m7f, "authorization").m6EvidenceUsedForRendererSelection = true;
      },
    },
    {
      name: "rejects research-only M4/M5 records promoted to production",
      expectedIssue: "authorization-boundary-violated",
      mutate: (input) => {
        const authorization = getRecord(input, "authorization");
        authorization.r187M4Status = "production-ready";
        authorization.r187M5Status = "production-ready";
        authorization.productionWebGpuEnabled = true;
      },
    },
    {
      name: "rejects M8 entry with a mandatory M7 blocker",
      expectedIssue: "authorization-boundary-violated",
      mutate: (input) => { getRecord(input, "authorization").m8Authorized = true; },
    },
    {
      name: "rejects production WebGPU enablement",
      expectedIssue: "authorization-boundary-violated",
      mutate: (input) => { getRecord(input, "authorization").productionWebGpuEnabled = true; },
    },
    {
      name: "rejects production test-seam exposure",
      expectedIssue: "authorization-boundary-violated",
      mutate: (input) => { getRecord(input, "authorization").productionTestSeamExposed = true; },
    },
  ];

  it.each(mutations)("$name", ({ mutate, expectedIssue, m7cError }) => {
    const input = clone(createEvidenceInput());
    mutate(input);
    if (m7cError) {
      const legacyEvaluation = evaluateGroundGlassM7cR187LifecycleEvidence(m7c(input));
      expect(legacyEvaluation.valid).toBe(false);
      expect(legacyEvaluation.errors).toContain(m7cError);
    }
    expectM7gIssue(input, expectedIssue);
  });
});
