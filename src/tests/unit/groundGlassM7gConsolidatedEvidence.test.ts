import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateGroundGlassM7cR187LifecycleEvidence } from "../../render/groundGlassM7cR187LifecycleEvidence";
import {
  GROUND_GLASS_M7G_EVALUATOR_REVISION,
  GROUND_GLASS_M7G_REPORT_ID,
  evaluateGroundGlassM7gConsolidation,
  validateGroundGlassM7gPlaywrightReport,
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
const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const makeReplayExecution = (kind: "m7e" | "m7f", replay: JsonRecord): JsonRecord => {
  const script = kind === "m7e" ? "scripts/run-m7e-offline-replay.mjs" : "scripts/run-m7f-presentation-evidence-replay.mjs";
  const outputPath = resolve(root, `.m7g-predecessor-replay-unit/${kind}-current.json`);
  const reportId = replay.reportId;
  const sourceCaptureSha = kind === "m7e" ? replay.captureSourceCommitSha : replay.nativeCaptureSourceSha;
  return {
    kind, script, outputPath,
    expectedSourceSha: sourceCaptureSha,
    expectedReplayCodeSha: replay.replayCodeCommitSha,
    timeoutMs: 600_000,
    nodeExecutable: process.execPath,
    invocation: `${process.execPath} ${script} --report-output=${outputPath}`,
    spawned: true, exitCode: 0, signal: null, spawnError: null,
    outputWasAbsentBeforeSpawn: true, reportPresent: true, reportParsed: true, reportParseError: null,
    reportSha256: "a".repeat(64),
    reportIdentity: {
      reportId,
      evaluatorRevision: replay.evaluatorRevision,
      sourceCaptureSha,
      replayCodeSha: replay.replayCodeCommitSha,
    },
    reportValidated: true, reportValidationIssues: [], stderrExcerpt: "", stdoutExcerpt: "", valid: true,
  };
};
const rawPlaywrightBytes = readFileSync(resolve(root, "docs/architecture/ground-glass-m7g-r187/validation/broad-e2e-playwright.json"));
const rawPlaywrightValue: unknown = JSON.parse(rawPlaywrightBytes.toString("utf8"));
const broadE2eFixture = readJson("docs/architecture/ground-glass-m7g-r187/validation/broad-e2e.json");
broadE2eFixture.playwrightReportValidation = validateGroundGlassM7gPlaywrightReport(rawPlaywrightValue, sha256(rawPlaywrightBytes));
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
const mutableCaptureEvents = (capture: JsonRecord, ...path: string[]): JsonRecord[] => {
  let value: unknown = capture;
  for (const key of path) value = isRecord(value) ? value[key] : undefined;
  if (!Array.isArray(value)) throw new TypeError(`Expected event array at ${path.join(".")}`);
  if (value.some((event) => !isRecord(event))) throw new TypeError(`Expected record events at ${path.join(".")}`);
  return value as JsonRecord[];
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
    predecessorReplays: {},
    predecessorReplayExecutions: {},
    captures: {
      initialization: readJson("docs/architecture/ground-glass-m7g-r187/native/initialization/init-after-target-recheck.json"),
      deviceLossEquivalent: readJson("docs/architecture/ground-glass-m7g-r187/native/device-loss/device-loss-equivalent.json"),
      testDestroyedDeviceLoss: readJson("docs/architecture/ground-glass-m7g-r187/native/device-loss/test-destroyed-device-lost-promise.json"),
      externalLoss: readJson("docs/architecture/ground-glass-m7g-r187/native/device-loss/external-loss-observation.json"),
      heldComposite: readJson("docs/architecture/ground-glass-m7g-r187/native/m5-composite-latest-request.json"),
      broadE2e: clone(broadE2eFixture),
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
  const predecessorReports = getRecord(input, "predecessorReports");
  const m7eSourceSha = getRecord(predecessorReports, "m7e").sourceCommitSha;
  const m7fSourceSha = getRecord(predecessorReports, "m7f").nativeCaptureSourceSha;
  input.predecessorReplays = {
    m7e: {
      reportId: "ground-glass-m7e-r187-offline-replay",
      evaluatorRevision: "m7e-r187-gather-b1-evaluator-v2",
      replayStatus: "passed",
      captureSourceCommitSha: m7eSourceSha,
      replayCodeCommitSha: "3".repeat(40),
      scenarioCounts: { passed: 12, failed: 0, blocked: 0, "not-run": 0 },
      issues: [],
      runtimeIdentity: { rendererRevision: "r187", actualExecutionApi: "webgpu" },
      authorization: { productionWebGpuEnabled: false },
    },
    m7f: {
      reportId: "ground-glass-m7f-r187-presentation",
      evaluatorRevision: "m7f-r187-presentation-evaluator-v2",
      qualificationPass: true,
      qualificationStatus: "passed",
      nativeCaptureSourceSha: m7fSourceSha,
      replayCodeCommitSha: "4".repeat(40),
      scenarioCounts: {
        inventoryConsistent: true,
        declared: { passed: 17, failed: 0, blocked: 0, "not-run": 0 },
        computed: { passed: 17, failed: 0, blocked: 0, "not-run": 0 },
      },
      runtimeIdentity: { rendererRevision: "r187", actualExecutionApi: "webgpu" },
      authorization: { m8Authorized: false, productionWebGpuEnabled: false },
    },
  };
  const replays = getRecord(input, "predecessorReplays");
  input.predecessorReplayExecutions = {
    m7e: makeReplayExecution("m7e", getRecord(replays, "m7e")),
    m7f: makeReplayExecution("m7f", getRecord(replays, "m7f")),
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
      passed: 5,
      failed: 0,
      blocked: 2,
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
      m7cError: "cleanup-host-acknowledgement-contradiction:m7c-r187-adapter-disposal-failure",
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
        const ack = captureEvents(observation, "cleanup", "events").find((event) => event.kind === "cleanup-acknowledged" && event.generationId === generation);
        const replacement = events.find((event) => event.kind === "renderer-mounted" && event.generationId !== generation &&
          ack && Number(event.sequence) > Number(ack.sequence));
        if (!replacement || !ack) throw new Error("Missing cleanup/replacement events");
        replacement.sequence = Number(ack.sequence) - 1;
      },
    },
    {
      name: "rejects an old request accepted after replacement",
      expectedIssue: "predecessor-report-invalid:m7c",
      m7cError: "latest-request-result-chain-contradiction:m7c-r187-latest-request-stale-rejection",
      mutate: (input) => {
        const scenario = getScenario(m7c(input), "m7c-r187-latest-request-stale-rejection");
        const summary = getObservation(scenario, "latest-request-interleaving");
        const staleRequestId = getRecord(summary, "requests").staleRequestId;
        const stale = arrayOfRecords(scenario.events).find((event) =>
          event.kind === "host-frame-result" && event.requestId === staleRequestId && event.acceptedByHost === false,
        );
        if (!stale) throw new Error("Missing rejected stale host frame result");
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
          .find((candidate) => candidate.kind === "host-frame-result" && candidate.requestId === capture(input, "heldComposite").r2RequestId &&
            candidate.acceptedByHost === true);
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
      expectedIssue: "test-destroyed-device-loss-native-generation-identity-invalid:m7g-r187-test-destroyed-device-loss-promise",
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
        const events = mutableCaptureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "cleanup", "events");
        const cleanup = events.find((event) => event.kind === "cleanup");
        if (cleanup) events.push({ ...cleanup });
      },
    },
    {
      name: "rejects device loss attributed to a retired generation",
      expectedIssue: "test-destroyed-device-loss-native-generation-identity-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const lost = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "qualificationEvents")
          .find((event) => event.kind === "device-lost-observed");
        if (lost) lost.generationId = "retired-generation";
      },
    },
    {
      name: "rejects destroy and loss events jointly moved to an unrelated generation",
      expectedIssue: "test-destroyed-device-loss-native-generation-identity-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const events = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "qualificationEvents");
        for (const event of events.filter((candidate) => candidate.kind === "device-destroy-requested" || candidate.kind === "device-lost-observed")) {
          event.generationId = "unrelated-generation";
        }
      },
    },
    {
      name: "rejects a destroy event whose attempt identity is unrelated",
      expectedIssue: "test-destroyed-device-loss-native-generation-identity-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const destroy = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "qualificationEvents")
          .find((event) => event.kind === "device-destroy-requested");
        if (destroy) destroy.attemptId = "unrelated-attempt";
      },
    },
    {
      name: "rejects a native runtime observation detached from the owned attempt",
      expectedIssue: "test-destroyed-device-loss-native-generation-identity-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const runtime = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "runtime", "adapterObservations")
          .find((event) => event.kind === "runtime-observed");
        if (runtime) runtime.executionApi = "webgl2";
      },
    },
    {
      name: "rejects policy runtime identity from another channel or pilot session",
      expectedIssue: "test-destroyed-device-loss-native-generation-identity-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const policy = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "m7cObservations")
          .find((event) => event.kind === "native-policy-runtime-identity");
        if (policy) {
          policy.channelId = "comparison";
          policy.pilotSessionId = "another-session";
        }
      },
    },
    {
      name: "rejects a runtime failure from another host request or scene",
      expectedIssue: "test-destroyed-device-loss-native-generation-identity-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const failure = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "failure", "adapterEvents")
          .find((event) => event.kind === "failure");
        if (failure) {
          failure.requestId = "another-request";
          failure.sceneId = "another-scene";
        }
      },
    },
    {
      name: "rejects a runtime failure detached from the destroyed generation request",
      expectedIssue: "test-destroyed-device-loss-native-generation-identity-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const failure = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "failure", "adapterEvents")
          .find((event) => event.kind === "failure");
        if (failure) failure.requestId = "unrelated-request";
      },
    },
    {
      name: "rejects cleanup and acknowledgement attributed to the wrong generation",
      expectedIssue: "cleanup-acknowledgement-mismatch:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const events = mutableCaptureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "cleanup", "events");
        const cleanup = events.find((event) => event.kind === "cleanup");
        const acknowledgement = events.find((event) => event.kind === "cleanup-acknowledged" &&
          event.generationId === getRecord(getRecord(capture(input, "testDestroyedDeviceLoss"), "observation"), "identities").generationId);
        if (cleanup) cleanup.generationId = "unrelated-generation";
        if (acknowledgement) acknowledgement.generationId = "unrelated-generation";
      },
    },
    {
      name: "rejects an acknowledgement attributed to the wrong host",
      expectedIssue: "cleanup-acknowledgement-mismatch:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const acknowledgement = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "cleanup", "events")
          .find((event) => event.kind === "cleanup-acknowledged" && event.generationId ===
            getRecord(getRecord(capture(input, "testDestroyedDeviceLoss"), "observation"), "identities").generationId);
        if (acknowledgement) acknowledgement.hostId = "unrelated-host";
      },
    },
    {
      name: "rejects cleanup acknowledgement from another channel",
      expectedIssue: "cleanup-acknowledgement-mismatch:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const observation = getRecord(capture(input, "testDestroyedDeviceLoss"), "observation");
        const generation = getRecord(observation, "identities").generationId;
        const acknowledgement = captureEvents(observation, "cleanup", "events").find((event) =>
          event.kind === "cleanup-acknowledged" && event.generationId === generation);
        if (acknowledgement) acknowledgement.channelId = "comparison";
      },
    },
    {
      name: "rejects duplicate device-destroy and loss events",
      expectedIssue: "test-destroyed-device-loss-native-generation-identity-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const events = mutableCaptureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "qualificationEvents");
        const destroy = events.find((event) => event.kind === "device-destroy-requested");
        const loss = events.find((event) => event.kind === "device-lost-observed");
        if (destroy) events.push({ ...destroy, sequence: 30 });
        if (loss) events.push({ ...loss, sequence: 31 });
      },
    },
    {
      name: "rejects loss observed before the test destroy request",
      expectedIssue: "test-destroyed-device-loss-event-chronology-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const events = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "qualificationEvents");
        const destroy = events.find((event) => event.kind === "device-destroy-requested");
        const loss = events.find((event) => event.kind === "device-lost-observed");
        if (destroy && loss) destroy.sequence = Number(loss.sequence) + 1;
      },
    },
    {
      name: "rejects runtime failure observed before the actual loss promise",
      expectedIssue: "test-destroyed-device-loss-event-chronology-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const events = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "qualificationEvents");
        const loss = events.find((event) => event.kind === "device-lost-observed");
        const failure = events.find((event) => event.kind === "failure" && event.operation === "device-loss");
        if (loss && failure) failure.sequence = Number(loss.sequence) - 1;
      },
    },
    {
      name: "rejects cleanup that predates the runtime loss failure",
      expectedIssue: "test-destroyed-device-loss-event-chronology-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const cleanup = captureEvents(capture(input, "testDestroyedDeviceLoss"), "observation", "cleanup", "events")
          .find((event) => event.kind === "cleanup");
        if (cleanup) cleanup.sequence = 23;
      },
    },
    {
      name: "rejects WebGL replacement mounted before cleanup acknowledgement",
      expectedIssue: "cleanup-fallback-order-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const observation = getRecord(capture(input, "testDestroyedDeviceLoss"), "observation");
        const generation = getRecord(observation, "identities").generationId;
        const acknowledgement = captureEvents(observation, "cleanup", "events").find((event) =>
          event.kind === "cleanup-acknowledged" && event.generationId === generation);
        const replacement = captureEvents(observation, "runtime", "hostMountObservations").find((event) =>
          event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer" && event.generationId !== generation && event.requestId === getRecord(observation, "identities").requestId);
        if (acknowledgement && replacement) replacement.sequence = Number(acknowledgement.sequence) - 1;
      },
    },
    {
      name: "rejects replacement renderer mounted on another host",
      expectedIssue: "test-destroyed-device-loss-native-generation-identity-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const observation = getRecord(capture(input, "testDestroyedDeviceLoss"), "observation");
        const identities = getRecord(observation, "identities");
        const generation = identities.generationId;
        const replacement = captureEvents(observation, "runtime", "hostMountObservations").find((event) =>
          event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer" &&
          event.generationId !== generation && event.requestId === identities.requestId);
        if (replacement) replacement.hostId = "another-host";
      },
    },
    {
      name: "rejects a current replacement frame for a different request",
      expectedIssue: "test-destroyed-device-loss-native-generation-identity-invalid:m7g-r187-test-destroyed-device-loss-promise",
      mutate: (input) => {
        const observation = getRecord(capture(input, "testDestroyedDeviceLoss"), "observation");
        const identities = getRecord(observation, "identities");
        const generation = identities.generationId;
        const replacement = captureEvents(observation, "runtime", "hostMountObservations").find((event) =>
          event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer" &&
          event.generationId !== generation && event.requestId === identities.requestId);
        const frame = captureEvents(observation, "qualificationEvents").find((event) =>
          event.kind === "host-frame-result" && event.generationId === replacement?.generationId && event.acceptedByHost === true);
        if (frame) frame.latestAcceptedRequestId = "stale-request";
      },
    },
    {
      name: "rejects a failed M7E replay process even if it emitted a passing report",
      expectedIssue: "predecessor-replay-execution-invalid:m7e",
      mutate: (input) => { getRecord(getRecord(input, "predecessorReplayExecutions"), "m7e").exitCode = 1; },
    },
    {
      name: "rejects a replay execution with the wrong expected source identity",
      expectedIssue: "predecessor-replay-execution-invalid:m7e",
      mutate: (input) => { getRecord(getRecord(input, "predecessorReplayExecutions"), "m7e").expectedSourceSha = "f".repeat(40); },
    },
    {
      name: "rejects a replay execution with a weakened process timeout",
      expectedIssue: "predecessor-replay-execution-invalid:m7f",
      mutate: (input) => { getRecord(getRecord(input, "predecessorReplayExecutions"), "m7f").timeoutMs = 120_000; },
    },
    {
      name: "rejects a signaled M7F replay process",
      expectedIssue: "predecessor-replay-execution-invalid:m7f",
      mutate: (input) => {
        const execution = getRecord(getRecord(input, "predecessorReplayExecutions"), "m7f");
        execution.exitCode = null;
        execution.signal = "SIGTERM";
      },
    },
    {
      name: "rejects a predecessor report path that reused the committed replay snapshot",
      expectedIssue: "predecessor-replay-execution-invalid:m7e",
      mutate: (input) => {
        const execution = getRecord(getRecord(input, "predecessorReplayExecutions"), "m7e");
        execution.outputPath = resolve(root, "docs/architecture/ground-glass-m7g-r187/replay/m7e-offline-replay.json");
        execution.invocation = `${process.execPath} ${execution.script} --report-output=${execution.outputPath}`;
      },
    },
    {
      name: "rejects a replay execution whose output was not absent before the child started",
      expectedIssue: "predecessor-replay-execution-invalid:m7f",
      mutate: (input) => { getRecord(getRecord(input, "predecessorReplayExecutions"), "m7f").outputWasAbsentBeforeSpawn = false; },
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
        const observation = getObservation(scenario, "terminal-webgl-context-loss");
        const failureSequence = Number(observation.failureSequence);
        const currentMaxSequence = Math.max(...arrayOfRecords(scenario.events).map((event) => Number(event.sequence)));
        scenario.events = [...arrayOfRecords(scenario.events), {
          kind: "host-frame-result", acceptedByHost: true,
          sequence: Math.max(failureSequence, currentMaxSequence) + 1,
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
      name: "rejects broad-suite pass status while the raw capture records 99 failures and 75 skipped tests",
      expectedIssue: "broad-e2e-passing-status-contradicts-outcomes:m7g-r187-broad-application-e2e",
      mutate: (input) => { capture(input, "broadE2e").status = "passed"; },
    },
    {
      name: "rejects a self-consistent passed summary with one unexpected result",
      expectedIssue: "broad-e2e-passing-status-contradicts-outcomes:m7g-r187-broad-application-e2e",
      mutate: (input) => {
        const broad = capture(input, "broadE2e");
        const validation = getRecord(broad, "playwrightReportValidation");
        const rawSha = "b".repeat(64);
        broad.status = "passed";
        getRecord(broad, "counts").passed = 276;
        getRecord(broad, "counts").failed = 1;
        getRecord(broad, "counts")["not-run"] = 0;
        getRecord(broad, "playwrightSummary").expected = 276;
        getRecord(broad, "playwrightSummary").unexpected = 1;
        getRecord(broad, "playwrightSummary").skipped = 0;
        getRecord(broad, "playwrightSummary").flaky = 0;
        getRecord(validation, "counts").expected = 276;
        getRecord(validation, "counts").unexpected = 1;
        getRecord(validation, "counts").skipped = 0;
        getRecord(validation, "counts").flaky = 0;
        getRecord(validation, "reportStats").expected = 276;
        getRecord(validation, "reportStats").unexpected = 1;
        getRecord(validation, "reportStats").skipped = 0;
        getRecord(validation, "reportStats").flaky = 0;
        validation.sha256 = rawSha;
        getRecord(broad, "playwrightReport").sha256 = rawSha;
        const comparison = getRecord(broad, "cleanMainComparison");
        comparison.results = [];
        getRecord(broad, "failureClassification").unexpectedFailureCount = 1;
        getRecord(broad, "failureClassification").cleanMainReproducedFailureCount = 0;
        getRecord(broad, "failureClassification").unclassifiedUnexpectedFailureCount = 1;
        getRecord(broad, "failureClassification").comparisonCoverage = "partial";
      },
    },
    {
      name: "rejects a summary that drops one unexpected Playwright failure",
      expectedIssue: "broad-e2e-provenance-or-counts-invalid:m7g-r187-broad-application-e2e",
      mutate: (input) => { getRecord(capture(input, "broadE2e"), "counts").failed = 98; },
    },
    {
      name: "rejects broad E2E report digest detached from the raw Playwright JSON",
      expectedIssue: "broad-e2e-provenance-or-counts-invalid:m7g-r187-broad-application-e2e",
      mutate: (input) => { getRecord(capture(input, "broadE2e"), "playwrightReport").sha256 = "0".repeat(64); },
    },
    {
      name: "rejects skipped cases relabeled as an intentional pass exemption",
      expectedIssue: "broad-e2e-provenance-or-counts-invalid:m7g-r187-broad-application-e2e",
      mutate: (input) => { capture(input, "broadE2e").intentionalSkippedExclusions = ["native-only tests"]; },
    },
    {
      name: "rejects clean-main failures labeled complete while 96 failures remain unclassified",
      expectedIssue: "broad-e2e-clean-main-classification-invalid:m7g-r187-broad-application-e2e",
      mutate: (input) => { getRecord(capture(input, "broadE2e"), "failureClassification").comparisonCoverage = "complete"; },
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

describe("M7G raw Playwright broad-suite evidence", () => {
  it("accepts the byte-digested report only with counts derived from its 277 test records", () => {
    const validation = validateGroundGlassM7gPlaywrightReport(rawPlaywrightValue, sha256(rawPlaywrightBytes));
    expect(validation.valid).toBe(true);
    expect(validation.testsDiscovered).toBe(277);
    expect(validation.counts).toEqual({ expected: 103, unexpected: 99, skipped: 75, flaky: 0 });
  });

  it("rejects an unexpected result changed without updating Playwright's summary", () => {
    const report = clone(rawPlaywrightValue) as JsonRecord;
    const visitSuite = (value: unknown): JsonRecord | null => {
      if (!isRecord(value)) return null;
      for (const spec of arrayOfRecords(value.specs)) {
        for (const test of arrayOfRecords(spec.tests)) {
          const result = Array.isArray(test.results) ? test.results[test.results.length - 1] : null;
          if (test.expectedStatus === "passed" && isRecord(result) && result.status === "failed") return result;
        }
      }
      for (const nested of Array.isArray(value.suites) ? value.suites : []) {
        const found = visitSuite(nested);
        if (found) return found;
      }
      return null;
    };
    const result = visitSuite(report);
    if (!result) throw new Error("No unexpected Playwright result found in captured report");
    result.status = "passed";
    const validation = validateGroundGlassM7gPlaywrightReport(report, sha256(rawPlaywrightBytes));
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain("playwright-report-summary-disagrees-with-test-tree");
  });

  it("rejects a missing test and a duplicate test identity", () => {
    expect(validateGroundGlassM7gPlaywrightReport(null, null).issues).toContain("playwright-report-schema-invalid");

    const missing = clone(rawPlaywrightValue) as JsonRecord;
    const removeOne = (value: unknown): boolean => {
      if (!isRecord(value)) return false;
      for (const spec of arrayOfRecords(value.specs)) {
        if (Array.isArray(spec.tests) && spec.tests.length > 0) {
          spec.tests.pop();
          return true;
        }
      }
      for (const nested of Array.isArray(value.suites) ? value.suites : []) if (removeOne(nested)) return true;
      return false;
    };
    expect(removeOne(missing)).toBe(true);
    expect(validateGroundGlassM7gPlaywrightReport(missing, sha256(rawPlaywrightBytes)).issues)
      .toContain("playwright-required-test-inventory-incomplete");

    const duplicate = clone(rawPlaywrightValue) as JsonRecord;
    const duplicateOne = (value: unknown): boolean => {
      if (!isRecord(value)) return false;
      for (const spec of arrayOfRecords(value.specs)) {
        if (Array.isArray(spec.tests) && spec.tests.length > 0) {
          spec.tests.push(clone(spec.tests[0]));
          return true;
        }
      }
      for (const nested of Array.isArray(value.suites) ? value.suites : []) if (duplicateOne(nested)) return true;
      return false;
    };
    expect(duplicateOne(duplicate)).toBe(true);
    expect(validateGroundGlassM7gPlaywrightReport(duplicate, sha256(rawPlaywrightBytes)).issues)
      .toContain("playwright-test-inventory-duplicate");
  });

  it("rejects an invalid report digest and accepts a complete synthetic all-passing control", () => {
    expect(validateGroundGlassM7gPlaywrightReport(rawPlaywrightValue, "wrong-digest").issues)
      .toContain("playwright-report-digest-invalid");

    const passing = clone(rawPlaywrightValue) as JsonRecord;
    const visit = (value: unknown): void => {
      if (!isRecord(value)) return;
      for (const spec of arrayOfRecords(value.specs)) {
        for (const test of arrayOfRecords(spec.tests)) {
          test.expectedStatus = "passed";
          test.results = [{ status: "passed" }];
        }
      }
      for (const nested of Array.isArray(value.suites) ? value.suites : []) visit(nested);
    };
    visit(passing);
    getRecord(passing, "stats").expected = 277;
    getRecord(passing, "stats").unexpected = 0;
    getRecord(passing, "stats").skipped = 0;
    getRecord(passing, "stats").flaky = 0;
    const validation = validateGroundGlassM7gPlaywrightReport(passing, "a".repeat(64));
    expect(validation.valid).toBe(true);
    expect(validation.counts).toEqual({ expected: 277, unexpected: 0, skipped: 0, flaky: 0 });
  });

  it("does not allow a skipped native test to be relabeled as an executed pass", () => {
    const report = clone(rawPlaywrightValue) as JsonRecord;
    const relabelSkipped = (value: unknown): boolean => {
      if (!isRecord(value)) return false;
      for (const spec of arrayOfRecords(value.specs)) {
        for (const test of arrayOfRecords(spec.tests)) {
          if (test.expectedStatus === "skipped") {
            test.expectedStatus = "passed";
            test.results = [{ status: "passed" }];
            return true;
          }
        }
      }
      for (const nested of Array.isArray(value.suites) ? value.suites : []) if (relabelSkipped(nested)) return true;
      return false;
    };
    expect(relabelSkipped(report)).toBe(true);
    const validation = validateGroundGlassM7gPlaywrightReport(report, sha256(rawPlaywrightBytes));
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain("playwright-report-summary-disagrees-with-test-tree");
  });
});
