import { evaluateGroundGlassM7cR187LifecycleEvidence } from "../groundGlassM7cR187LifecycleEvidence";
import { ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION } from "./groundGlassRawWebGpuCompatibility";
import { evaluateGroundGlassM7dPhysicalCocReport } from "./groundGlassM7dPhysicalCocEvidence";

export const GROUND_GLASS_M7G_REPORT_ID = "ground-glass-m7g-r187-lifecycle-consolidation" as const;
export const GROUND_GLASS_M7G_EVALUATOR_REVISION = "m7g-r187-consolidation-evaluator-v2" as const;
export const GROUND_GLASS_M7G_SCHEMA_VERSION = 1 as const;

export const GROUND_GLASS_M7G_REQUIRED_SCENARIO_IDS = Object.freeze([
  "m7g-r187-init-after-target-operation-recheck",
  "m7g-r187-device-loss-equivalent",
  "m7g-r187-test-destroyed-device-loss-promise",
  "m7g-r187-spontaneous-external-device-loss",
  "m7g-r187-held-m5-composite-latest-request",
  "m7g-r187-broad-application-e2e",
  "m7g-r187-production-preview-isolation",
] as const);

export type GroundGlassM7gScenarioStatus = "passed" | "failed" | "blocked" | "not-run";
export type GroundGlassM7gQualificationStatus =
  | "qualified-for-exact-development-pilot-scope"
  | "partially-qualified"
  | "blocked"
  | "failed";
export type GroundGlassM7gScenario = Readonly<{
  id: typeof GROUND_GLASS_M7G_REQUIRED_SCENARIO_IDS[number];
  status: GroundGlassM7gScenarioStatus;
  evidenceClass: string;
  sourceCommitSha: string | null;
  testInvocation: string | null;
  rendererRevision: string | null;
  runtimeIdentity: Readonly<Record<string, unknown>> | null;
  supportingArtifacts: readonly string[];
  orderedEvents: readonly unknown[];
  knownLimitations: readonly string[];
  issues: readonly string[];
}>;

export type GroundGlassM7gConsolidatedEvaluation = Readonly<{
  schemaVersion: 1;
  reportId: typeof GROUND_GLASS_M7G_REPORT_ID;
  evaluatorRevision: typeof GROUND_GLASS_M7G_EVALUATOR_REVISION;
  valid: boolean;
  evidenceIntegrity: "passed" | "failed";
  issues: readonly string[];
  qualificationStatus: GroundGlassM7gQualificationStatus;
  qualificationPass: boolean;
  scenarioCounts: Readonly<{
    declared: Readonly<Record<GroundGlassM7gScenarioStatus, number>> | null;
    computed: Readonly<Record<GroundGlassM7gScenarioStatus, number>>;
    inventoryConsistent: boolean;
  }>;
  scenarios: readonly GroundGlassM7gScenario[];
  predecessorEvidence: Readonly<Record<string, unknown>>;
  decisions: Readonly<{
    rawLifecycle: "partially-qualified" | "qualified" | "failed";
    physicalCocResearch: "research-qualified" | "failed" | "blocked";
    gatherB1Research: "research-qualified" | "failed" | "blocked";
    m5OpticalQuality: "partially-qualified" | "failed" | "unqualified";
    presentationConformance: "passed" | "failed" | "blocked";
    crossStageRequestIntegrity: "passed" | "failed" | "blocked";
    initializationFailureIntegrity: "passed" | "failed" | "blocked";
    runtimeFailureRecovery: "passed" | "failed" | "blocked";
    deviceLossHandling: "partially-qualified" | "passed" | "failed";
    resourceCleanup: "passed" | "failed" | "blocked";
    stickyFallback: "passed" | "failed" | "blocked";
    retryAndSessionOwnership: "passed" | "failed" | "blocked";
    resizeAndRemount: "passed" | "failed" | "blocked";
    sceneTransition: "passed" | "failed" | "blocked";
    productionIsolation: "passed" | "failed" | "blocked";
    consolidatedM7: GroundGlassM7gQualificationStatus;
    m8EntryGate: "authorized" | "denied";
  }>;
  authorization: Readonly<Record<string, unknown>>;
}>;

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const record = (value: unknown): JsonRecord | null => isRecord(value) ? value : null;
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isSha = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
const isSha256 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const isStatus = (value: unknown): value is GroundGlassM7gScenarioStatus =>
  value === "passed" || value === "failed" || value === "blocked" || value === "not-run";
const countKeys = ["passed", "failed", "blocked", "not-run"] as const;
const emptyCounts = (): Record<GroundGlassM7gScenarioStatus, number> => ({
  passed: 0,
  failed: 0,
  blocked: 0,
  "not-run": 0,
});
const eventList = (value: unknown): JsonRecord[] => Array.isArray(value) ? value.filter(isRecord) : [];
const bySequence = (left: JsonRecord, right: JsonRecord): number => Number(left.sequence) - Number(right.sequence);
const seq = (value: unknown): number | null => Number.isInteger(value) ? value as number : null;
const get = (value: unknown, ...keys: string[]): unknown => {
  let cursor = value;
  for (const key of keys) cursor = record(cursor)?.[key];
  return cursor;
};

const validReplayExecution = (executionValue: unknown, replay: JsonRecord | null, kind: "m7e" | "m7f"): boolean => {
  const execution = record(executionValue);
  const identity = record(execution?.reportIdentity);
  const expectedReportId = kind === "m7e" ? "ground-glass-m7e-r187-offline-replay" : "ground-glass-m7f-r187-presentation";
  const expectedEvaluator = kind === "m7e" ? "m7e-r187-gather-b1-evaluator-v2" : "m7f-r187-presentation-evaluator-v2";
  const sourceSha = replay ? (kind === "m7e" ? replay.captureSourceCommitSha : replay.nativeCaptureSourceSha) : null;
  const outputPath = execution?.outputPath;
  const invocation = execution?.invocation;
  const freshOutputPattern = new RegExp(`[/\\\\]\\.m7g-predecessor-replay-[^/\\\\]+[/\\\\]${kind}-current\\.json$`);
  const outputPathValid = typeof outputPath === "string" &&
    freshOutputPattern.test(outputPath) &&
    execution?.nodeExecutable === process.execPath &&
    invocation === `${process.execPath} ${execution?.script} --report-output=${outputPath}`;
  return !!execution && !!replay && execution.kind === kind &&
    execution.script === (kind === "m7e" ? "scripts/run-m7e-offline-replay.mjs" : "scripts/run-m7f-presentation-evidence-replay.mjs") &&
    outputPathValid && execution.spawned === true && execution.exitCode === 0 && execution.signal === null &&
    execution.spawnError === null && execution.outputWasAbsentBeforeSpawn === true && execution.reportPresent === true &&
    execution.reportParsed === true && execution.reportParseError === null && isSha256(execution.reportSha256) &&
    execution.reportValidated === true && Array.isArray(execution.reportValidationIssues) &&
    execution.reportValidationIssues.length === 0 && execution.valid === true &&
    identity?.reportId === expectedReportId && identity.evaluatorRevision === expectedEvaluator &&
    execution.expectedSourceSha === sourceSha && execution.expectedReplayCodeSha === replay.replayCodeCommitSha &&
    identity.sourceCaptureSha === sourceSha && isSha(sourceSha) &&
    identity.replayCodeSha === replay.replayCodeCommitSha && isSha(replay.replayCodeCommitSha);
};

const PLAYWRIGHT_RESULT_STATUSES = new Set(["passed", "failed", "timedOut", "interrupted", "skipped"]);

export type GroundGlassM7gPlaywrightReportValidation = Readonly<{
  artifact: "validation/broad-e2e-playwright.json";
  sha256: string | null;
  valid: boolean;
  issues: readonly string[];
  projectIds: readonly string[];
  testsDiscovered: number;
  testsWithResults: number;
  incompleteTests: number;
  counts: Readonly<{ expected: number; unexpected: number; skipped: number; flaky: number }>;
  reportStats: Readonly<{ expected: number; unexpected: number; skipped: number; flaky: number }> | null;
}>;

/**
 * Derives Playwright outcomes from the original JSON report tree. `sha256` is
 * computed by the Node loader from the exact file bytes before JSON parsing.
 */
export const validateGroundGlassM7gPlaywrightReport = (
  reportValue: unknown,
  sha256: unknown,
  expectedProject = "chromium",
): GroundGlassM7gPlaywrightReportValidation => {
  const issues: string[] = [];
  const report = record(reportValue);
  const config = record(report?.config);
  const projects = Array.isArray(config?.projects) ? config.projects.filter(isRecord) : [];
  const projectIds = projects.map((project) => nonEmpty(project.id) ? project.id : "");
  const stats = record(report?.stats);
  const countFromStats = (key: "expected" | "unexpected" | "skipped" | "flaky"): number | null =>
    Number.isInteger(stats?.[key]) && (stats?.[key] as number) >= 0 ? stats?.[key] as number : null;
  const reportStats = stats && countFromStats("expected") !== null && countFromStats("unexpected") !== null &&
      countFromStats("skipped") !== null && countFromStats("flaky") !== null
    ? {
      expected: countFromStats("expected") as number,
      unexpected: countFromStats("unexpected") as number,
      skipped: countFromStats("skipped") as number,
      flaky: countFromStats("flaky") as number,
    }
    : null;
  const counts = { expected: 0, unexpected: 0, skipped: 0, flaky: 0 };
  const seenTestIds = new Set<string>();
  let testsDiscovered = 0;
  let testsWithResults = 0;
  let incompleteTests = 0;

  if (!report || !config || !Array.isArray(report.suites) || !reportStats || !nonEmpty(config.version)) {
    issues.push("playwright-report-schema-invalid");
  }
  if (projectIds.length !== 1 || projectIds[0] !== expectedProject) {
    issues.push("playwright-report-project-inventory-invalid");
  }
  if (!Array.isArray(report?.errors) || report.errors.length !== 0) {
    issues.push("playwright-report-has-run-errors");
  }
  if (!isSha256(sha256)) issues.push("playwright-report-digest-invalid");

  const visitSuite = (suiteValue: unknown): void => {
    const suite = record(suiteValue);
    if (!suite) {
      issues.push("playwright-suite-entry-invalid");
      return;
    }
    const specs = suite.specs ?? [];
    const nestedSuites = suite.suites ?? [];
    if (!Array.isArray(specs) || !Array.isArray(nestedSuites)) {
      issues.push("playwright-suite-inventory-invalid");
      return;
    }
    for (const specValue of specs) {
      const spec = record(specValue);
      if (!spec || !nonEmpty(spec.id) || !Array.isArray(spec.tests) || spec.tests.length === 0) {
        issues.push("playwright-spec-inventory-invalid");
        continue;
      }
      for (const testValue of spec.tests) {
        const test = record(testValue);
        testsDiscovered += 1;
        if (!test || !nonEmpty(test.projectId) || test.projectId !== expectedProject ||
            !nonEmpty(test.projectName) || test.projectName !== expectedProject ||
            !Array.isArray(test.results) || test.results.length === 0 ||
            !(test.expectedStatus === "passed" || test.expectedStatus === "failed" || test.expectedStatus === "skipped")) {
          incompleteTests += 1;
          issues.push("playwright-test-result-incomplete");
          continue;
        }
        const testIdentity = `${test.projectId}:${spec.id}`;
        if (seenTestIds.has(testIdentity)) issues.push("playwright-test-inventory-duplicate");
        seenTestIds.add(testIdentity);
        const results = test.results.filter(isRecord);
        if (results.length !== test.results.length || results.some((result) =>
          !PLAYWRIGHT_RESULT_STATUSES.has(String(result.status)))) {
          incompleteTests += 1;
          issues.push("playwright-test-result-status-invalid");
          continue;
        }
        testsWithResults += 1;
        const finalStatus = results[results.length - 1]?.status;
        if (test.expectedStatus === "skipped" || finalStatus === "skipped") {
          counts.skipped += 1;
        } else if (finalStatus === test.expectedStatus) {
          if (results.slice(0, -1).some((result) => result.status !== test.expectedStatus)) counts.flaky += 1;
          else counts.expected += 1;
        } else {
          counts.unexpected += 1;
        }
      }
    }
    for (const nested of nestedSuites) visitSuite(nested);
  };

  for (const suite of Array.isArray(report?.suites) ? report.suites : []) visitSuite(suite);
  if (reportStats && (reportStats.expected !== counts.expected || reportStats.unexpected !== counts.unexpected ||
      reportStats.skipped !== counts.skipped || reportStats.flaky !== counts.flaky)) {
    issues.push("playwright-report-summary-disagrees-with-test-tree");
  }
  if (testsDiscovered === 0 || testsDiscovered !== 277 || testsWithResults + incompleteTests !== testsDiscovered) {
    issues.push("playwright-required-test-inventory-incomplete");
  }

  return {
    artifact: "validation/broad-e2e-playwright.json",
    sha256: isSha256(sha256) ? sha256 : null,
    valid: issues.length === 0,
    issues,
    projectIds,
    testsDiscovered,
    testsWithResults,
    incompleteTests,
    counts,
    reportStats,
  };
};

const requireM7gCaptureProvenance = (capture: JsonRecord, id: string, issues: string[]): JsonRecord | null => {
  const provenance = record(capture.captureProvenance);
  const environment = record(capture.environment);
  const capturedInvocation = capture.invocation ?? provenance?.testInvocation;
  if (!provenance || !isSha(provenance.sourceCommitSha) || provenance.sourceCommitSha !== capture.sourceHeadSha ||
      !nonEmpty(provenance.testInvocation) || provenance.testInvocation !== capturedInvocation ||
      provenance.browserProject !== "chrome-native-webgpu" || provenance.threePackageVersion !== "0.187.0" ||
      provenance.rendererRevision !== "r187" || provenance.rendererFamily !== "webgpu-renderer" ||
      provenance.actualExecutionApi !== "webgpu" || provenance.internalFallback !== "none") {
    issues.push(`capture-provenance-invalid:${id}`);
  }
  if (!environment || environment.testProject !== "chrome-native-webgpu" || environment.threeRevision !== "187" ||
      !nonEmpty(environment.browserVersion) || !record(environment.operatingSystem) ||
      !nonEmpty(get(environment, "operatingSystem", "platform")) ||
      !nonEmpty(get(environment, "operatingSystem", "release")) ||
      !nonEmpty(get(environment, "operatingSystem", "architecture"))) {
    issues.push(`native-environment-incomplete:${id}`);
  }
  if (!isSha(capture.sourceHeadSha) || !nonEmpty(capture.invocation) ||
      typeof capture.invocation !== "string" || !capture.invocation.includes("--project=chrome-native-webgpu")) {
    issues.push(`source-or-invocation-invalid:${id}`);
  }
  const runtimeEvent = record(capture.runtime);
  const runtimeEvents = [...eventList(get(capture, "observation", "runtime", "adapterObservations")),
    ...(runtimeEvent ? [runtimeEvent] : [])];
  if (!runtimeEvents.some((event) => event.kind === "runtime-observed" && event.rendererRevision === "187" &&
      event.rendererFamily === "webgpu-renderer" && event.executionApi === "webgpu" && event.internalFallback === "none")) {
    issues.push(`native-runtime-not-observed:${id}`);
  }
  return provenance;
};

const validateConfirmedFallback = (capture: JsonRecord, id: string, issues: string[]): void => {
  const observation = record(capture.observation);
  const identity = record(observation?.identities);
  const failure = record(observation?.failure);
  const cleanupEvents = eventList(get(observation, "cleanup", "events")).sort(bySequence);
  const failureEvents = eventList(failure?.adapterEvents);
  const lifecycleEvents = eventList(observation?.qualificationEvents).sort(bySequence);
  const mountEvents = eventList(get(observation, "runtime", "hostMountObservations")).sort(bySequence);
  const generationId = identity?.generationId;
  const failureEvent = failureEvents.find((event) => event.kind === "failure" && event.generationId === generationId);
  const adapterCleanup = cleanupEvents.find((event) => event.kind === "cleanup" && event.generationId === generationId);
  const hostAck = cleanupEvents.find((event) => event.kind === "cleanup-acknowledged" && event.generationId === generationId);
  const failureSequence = seq(failureEvent?.sequence);
  const cleanupSequence = seq(adapterCleanup?.sequence);
  const acknowledgementSequence = seq(hostAck?.sequence);
  const fallbackMount = mountEvents.find((event) => event.kind === "renderer-mounted" &&
    event.rendererFamily === "webgl-renderer" && event.generationId !== generationId &&
    event.requestId === identity?.requestId && event.channelId === identity?.channelId &&
    event.hostId === identity?.hostId && event.sceneId === identity?.sceneId &&
    acknowledgementSequence !== null && (seq(event.sequence) ?? -1) > acknowledgementSequence);
  const replacementSequence = seq(fallbackMount?.sequence);
  const latestPublication = lifecycleEvents.find((event) => event.kind === "host-frame-result" &&
    event.acceptedByHost === true && event.activeRendererFamily === "webgl-renderer" &&
    event.generationId === fallbackMount?.generationId && replacementSequence !== null &&
    (seq(event.sequence) ?? -1) > replacementSequence);
  const publicationSequence = seq(latestPublication?.sequence);
  if (!failureEvent || failureEvent.attemptId !== identity?.attemptId || failureEvent.requestId !== identity?.requestId ||
      failureEvent.channelId !== identity?.channelId || failureEvent.sceneId !== identity?.sceneId) {
    issues.push(`failure-identity-mismatch:${id}`);
  }
  if (!adapterCleanup || adapterCleanup.outcome !== "confirmed" || !hostAck || hostAck.outcome !== "confirmed" ||
      hostAck.hostId !== identity?.hostId || hostAck.channelId !== identity?.channelId) {
    issues.push(`cleanup-acknowledgement-mismatch:${id}`);
  }
  if (failureSequence === null || cleanupSequence === null || acknowledgementSequence === null ||
      replacementSequence === null || publicationSequence === null ||
      !(failureSequence < cleanupSequence && cleanupSequence < acknowledgementSequence &&
        acknowledgementSequence < replacementSequence && replacementSequence < publicationSequence)) {
    issues.push(`cleanup-fallback-order-invalid:${id}`);
  }
  if (!fallbackMount || fallbackMount.hostId !== identity?.hostId || fallbackMount.channelId !== identity?.channelId ||
      fallbackMount.sceneId !== identity?.sceneId || !latestPublication ||
      latestPublication.hostId !== identity?.hostId || latestPublication.generationId !== fallbackMount.generationId ||
      latestPublication.requestId !== fallbackMount.requestId ||
      latestPublication.latestAcceptedRequestId !== fallbackMount.requestId ||
      latestPublication.sceneId !== identity?.sceneId || latestPublication.channelId !== identity?.channelId) {
    issues.push(`fallback-publication-identity-invalid:${id}`);
  }
  if (get(observation, "fallback", "applicationFallback") !== "occurred") {
    issues.push(`application-fallback-not-observed:${id}`);
  }
  const duplicateCleanups = cleanupEvents.filter((event) => event.kind === "cleanup" && event.generationId === generationId);
  if (duplicateCleanups.length !== 1) issues.push(`duplicate-or-missing-cleanup:${id}`);
};

const strictlyIncreasingSequences = (events: readonly JsonRecord[]): boolean => {
  let previous = -1;
  for (const event of events) {
    const current = seq(event.sequence);
    if (current === null || current <= previous) return false;
    previous = current;
  }
  return true;
};

const sameEventIdentity = (left: JsonRecord | null, right: JsonRecord | null,
  fields: readonly string[]): boolean => !!left && !!right && fields.every((field) => left[field] === right[field]);

const validateTestDestroyedDeviceLossChain = (capture: JsonRecord, id: string, issues: string[]): void => {
  const observation = record(capture.observation);
  const identity = record(observation?.identities);
  const qualificationEvents = eventList(observation?.qualificationEvents);
  const cleanupEvents = eventList(get(observation, "cleanup", "events"));
  const failureAdapterEvents = eventList(get(observation, "failure", "adapterEvents"));
  const hostMountEvents = eventList(get(observation, "runtime", "hostMountObservations"));
  const runtimeEvents = eventList(get(observation, "runtime", "adapterObservations"));
  const m7cObservations = eventList(observation?.m7cObservations);
  const attempts = eventList(identity?.attempts);
  const failedGenerationId = identity?.generationId;
  const failedAttemptId = identity?.attemptId;
  const byKind = (events: readonly JsonRecord[], kind: string): JsonRecord[] =>
    events.filter((event) => event.kind === kind);
  const single = (events: readonly JsonRecord[], kind: string): JsonRecord | null => {
    const matches = byKind(events, kind);
    return matches.length === 1 ? matches[0]! : null;
  };

  const policy = single(m7cObservations, "native-policy-runtime-identity");
  const attempt = attempts.filter((event) => event.kind === "attempt" && event.generationId === failedGenerationId &&
    event.attemptId === failedAttemptId);
  const nativeMount = hostMountEvents.filter((event) => event.kind === "renderer-mounted" &&
    event.generationId === failedGenerationId && event.rendererFamily === "webgpu-renderer");
  const nativeMountEvent = nativeMount.length === 1 ? nativeMount[0]! : null;
  const nativeRuntimeEvents = runtimeEvents.filter((event) => event.kind === "runtime-observed" &&
    event.generationId === failedGenerationId && event.attemptId === failedAttemptId);
  const nativeRuntimeEvent = nativeRuntimeEvents.length === 1 ? nativeRuntimeEvents[0]! : null;
  const timelineMount = qualificationEvents.filter((event) => event.kind === "renderer-mounted" &&
    event.generationId === failedGenerationId && event.rendererFamily === "webgpu-renderer");
  const destroy = single(qualificationEvents, "device-destroy-requested");
  const loss = single(qualificationEvents, "device-lost-observed");
  const timelineFailure = single(qualificationEvents, "failure");
  const adapterFailure = single(failureAdapterEvents, "failure");
  const cleanup = cleanupEvents.filter((event) => event.kind === "cleanup" && event.generationId === failedGenerationId);
  const acknowledgement = cleanupEvents.filter((event) =>
    event.kind === "cleanup-acknowledged" && event.generationId === failedGenerationId);
  const timelineCleanup = qualificationEvents.filter((event) => event.kind === "cleanup" &&
    event.generationId === failedGenerationId);
  const timelineAcknowledgement = qualificationEvents.filter((event) => event.kind === "cleanup-acknowledged" &&
    event.generationId === failedGenerationId);
  const replacementMount = hostMountEvents.filter((event) => event.kind === "renderer-mounted" &&
    event.rendererFamily === "webgl-renderer" && event.generationId !== failedGenerationId &&
    event.requestId === identity?.requestId);
  const replacement = replacementMount.length === 1 ? replacementMount[0]! : null;
  const acceptedFrames = qualificationEvents.filter((event) => event.kind === "host-frame-result" &&
    event.generationId === replacement?.generationId && event.acceptedByHost === true);
  const currentFrame = acceptedFrames.length === 1 ? acceptedFrames[0]! : null;

  const identityValid = !!identity && nonEmpty(identity.channelId) && nonEmpty(identity.pilotSessionId) &&
    (typeof identity.retryEpoch === "string" || Number.isInteger(identity.retryEpoch)) &&
    nonEmpty(identity.hostId) && nonEmpty(identity.generationId) && nonEmpty(identity.attemptId) &&
    nonEmpty(identity.requestId) && nonEmpty(identity.sceneId) && identity.sceneId === "architecture-rise" &&
    attempt.length === 1 && attempt[0]?.attemptId === identity.attemptId &&
    attempt[0]?.generationId === identity.generationId && attempt[0]?.channelId === identity.channelId &&
    attempt[0]?.requestId === identity.requestId && attempt[0]?.sceneId === identity.sceneId &&
    Array.isArray(identity.attemptIds) && identity.attemptIds.length === 1 && identity.attemptIds[0] === identity.attemptId &&
    policy?.attemptId === identity.attemptId && policy.generationId === identity.generationId &&
    policy.requestId === identity.requestId && policy.sceneId === identity.sceneId &&
    policy.channelId === identity.channelId && policy.hostId === identity.hostId &&
    policy.pilotSessionId === identity.pilotSessionId && Number(policy.retryEpoch) === Number(identity.retryEpoch) &&
    get(policy, "runtimeIdentity", "rendererRevision") === "187" &&
    get(policy, "runtimeIdentity", "rendererFamily") === "webgpu-renderer" &&
    get(policy, "runtimeIdentity", "executionApi") === "webgpu" &&
    get(policy, "runtimeIdentity", "internalFallback") === "none" &&
    nativeRuntimeEvent?.rendererRevision === "187" && nativeRuntimeEvent.rendererFamily === "webgpu-renderer" &&
    nativeRuntimeEvent.executionApi === "webgpu" && nativeRuntimeEvent.internalFallback === "none" &&
    nativeRuntimeEvent.sequence === policy.runtimeEventSequence &&
    nativeMountEvent?.attemptId === identity.attemptId && nativeMountEvent.channelId === identity.channelId &&
    nativeMountEvent.hostId === identity.hostId && nativeMountEvent.requestId === identity.requestId &&
    nativeMountEvent.sceneId === identity.sceneId && nativeMountEvent.executionApi === "webgpu" &&
    nativeMountEvent.rendererFamily === "webgpu-renderer" && nativeMountEvent.internalFallback === "none" &&
    timelineMount.length === 1 && sameEventIdentity(timelineMount[0] ?? null, nativeMountEvent,
      ["attemptId", "channelId", "hostId", "generationId", "requestId", "sceneId", "sequence"]);

  const failedEventIdentityValid = !!identity && destroy?.cause === "test-destroy" && loss?.cause === "test-destroy" &&
    destroy.generationId === identity.generationId && loss.generationId === identity.generationId &&
    destroy.attemptId === identity.attemptId && loss.attemptId === identity.attemptId &&
    loss.reason === "destroyed" && typeof loss.message === "string" && loss.message.toLowerCase().includes("destroy") &&
    adapterFailure?.stage === "runtime" && adapterFailure.operation === "device-loss" &&
    timelineFailure?.stage === "runtime" && timelineFailure.operation === "device-loss" &&
    sameEventIdentity(adapterFailure, timelineFailure,
      ["attemptId", "channelId", "generationId", "requestId", "sceneId", "stage", "operation", "sequence"]) &&
    adapterFailure?.attemptId === identity.attemptId && adapterFailure.channelId === identity.channelId &&
    adapterFailure.generationId === identity.generationId && adapterFailure.requestId === identity.requestId &&
    adapterFailure.sceneId === identity.sceneId &&
    cleanup.length === 1 && cleanup[0]?.attemptId === identity.attemptId &&
    cleanup[0]?.outcome === "confirmed" && acknowledgement.length === 1 &&
    acknowledgement[0]?.channelId === identity.channelId && acknowledgement[0]?.hostId === identity.hostId &&
    acknowledgement[0]?.outcome === "confirmed" &&
    timelineCleanup.length === 1 && timelineAcknowledgement.length === 1 &&
    sameEventIdentity(cleanup[0] ?? null, timelineCleanup[0] ?? null,
      ["attemptId", "generationId", "outcome", "sequence"]) &&
    sameEventIdentity(acknowledgement[0] ?? null, timelineAcknowledgement[0] ?? null,
      ["channelId", "hostId", "generationId", "outcome", "sequence"]);

  const replacementIdentityValid = !!identity && !!replacement && !!currentFrame &&
    nonEmpty(replacement.generationId) && replacement.generationId !== identity.generationId &&
    nonEmpty(replacement.attemptId) && replacement.attemptId !== identity.attemptId &&
    replacement.channelId === identity.channelId && replacement.hostId === identity.hostId &&
    replacement.requestId === identity.requestId && replacement.sceneId === identity.sceneId &&
    replacement.executionApi === "webgl2" && currentFrame.attemptId === replacement.attemptId &&
    currentFrame.channelId === identity.channelId && currentFrame.hostId === identity.hostId &&
    currentFrame.generationId === replacement.generationId && currentFrame.requestId === identity.requestId &&
    currentFrame.latestAcceptedRequestId === identity.requestId &&
    currentFrame.latestAcceptedSceneId === identity.sceneId && currentFrame.activeGenerationId === replacement.generationId &&
    currentFrame.activeRendererFamily === "webgl-renderer" && currentFrame.frameStatus === "completed";

  const attemptSequence = attempt.length === 1 ? seq(attempt[0]?.sequence) : null;
  const runtimeIdentitySequence = seq(policy?.runtimeEventSequence);
  const chain = [nativeMountEvent, destroy, loss, adapterFailure, cleanup[0] ?? null,
    acknowledgement[0] ?? null, replacement, currentFrame];
  const chainSequences = chain.map((event) => event ? seq(event.sequence) : null);
  const chronologyValid = attemptSequence !== null && runtimeIdentitySequence !== null &&
    attemptSequence < runtimeIdentitySequence && runtimeIdentitySequence < (seq(nativeMountEvent?.sequence) ?? -1) &&
    chainSequences.every((sequence) => sequence !== null) &&
    chainSequences.every((sequence, index) => index === 0 ||
      (sequence as number) > (chainSequences[index - 1] as number)) &&
    strictlyIncreasingSequences(qualificationEvents) && strictlyIncreasingSequences(cleanupEvents) &&
    strictlyIncreasingSequences(hostMountEvents) &&
    byKind(qualificationEvents, "device-destroy-requested").length === 1 &&
    byKind(qualificationEvents, "device-lost-observed").length === 1 &&
    byKind(failureAdapterEvents, "failure").length === 1;

  if (!identityValid || !failedEventIdentityValid || !replacementIdentityValid) {
    issues.push(`test-destroyed-device-loss-native-generation-identity-invalid:${id}`);
  }
  if (!chronologyValid) issues.push(`test-destroyed-device-loss-event-chronology-invalid:${id}`);
};

const evaluateNativeCapture = (
  captureValue: unknown,
  id: typeof GROUND_GLASS_M7G_REQUIRED_SCENARIO_IDS[number],
  evidenceClass: string,
  issues: string[],
): GroundGlassM7gScenario => {
  const capture = record(captureValue);
  const before = issues.length;
  if (!capture) {
    issues.push(`capture-missing:${id}`);
    return {
      id, status: "blocked", evidenceClass, sourceCommitSha: null, testInvocation: null,
      rendererRevision: null, runtimeIdentity: null, supportingArtifacts: [], orderedEvents: [],
      knownLimitations: ["Required native capture is absent."], issues: [...issues.slice(before)],
    };
  }
  const provenance = requireM7gCaptureProvenance(capture, id, issues);
  const sourceCommitSha = isSha(provenance?.sourceCommitSha) ? provenance.sourceCommitSha : null;
  const testInvocation = nonEmpty(provenance?.testInvocation) ? provenance.testInvocation : null;
  const runtimeIdentity = eventList(get(capture, "observation", "runtime", "adapterObservations"))
    .find((event) => event.kind === "runtime-observed") ?? record(capture.runtime) ?? null;
  const orderedEvents = eventList(get(capture, "observation", "qualificationEvents"));
  if (id === "m7g-r187-init-after-target-operation-recheck") {
    const failure = record(get(capture, "observation", "failure"));
    const identity = record(get(capture, "observation", "identities"));
    const failureEvent = eventList(failure?.adapterEvents).find((event) => event.kind === "failure");
    const nativePolicyObservation = eventList(get(capture, "observation", "m7cObservations"))
      .find((event) => event.kind === "native-policy-runtime-identity");
    const mountedNativeGeneration = eventList(get(capture, "observation", "runtime", "hostMountObservations"))
      .some((event) => event.kind === "renderer-mounted" && event.generationId === identity?.generationId);
    const failurePoints = get(capture, "observation", "configuredFailurePoints");
    if (capture.scenarioId !== id || !Array.isArray(failurePoints) || !failurePoints.includes("initialization-after-target") ||
        failure?.stage !== "initialization" ||
        failureEvent?.stage !== "initialization" || failureEvent.operation !== "initialize-render-target-state" ||
        !identity || failureEvent.attemptId !== identity.attemptId || failureEvent.generationId !== identity.generationId ||
        failureEvent.requestId !== identity.requestId || failureEvent.channelId !== identity.channelId ||
        failureEvent.sceneId !== identity.sceneId || identity.sceneId !== "architecture-rise" ||
        get(nativePolicyObservation, "policyEvidence", "policyEvidenceRevision") !== "m3-architecture-rise-raw-rtt-native-r187-v1" ||
        mountedNativeGeneration) {
      issues.push(`initialization-operation-identity-invalid:${id}`);
    }
    validateConfirmedFallback(capture, id, issues);
  } else if (id === "m7g-r187-device-loss-equivalent") {
    const failure = record(get(capture, "observation", "failure"));
    const failureEvent = eventList(failure?.adapterEvents).find((event) => event.kind === "failure");
    const allEvents = [
      ...eventList(get(capture, "observation", "qualificationEvents")),
      ...eventList(get(capture, "observation", "cleanup", "events")),
    ];
    if (capture.scenarioId !== id || failure?.stage !== "runtime" || failureEvent?.operation !== "device-loss" ||
        !String(failureEvent.reason).includes("device-loss equivalent") ||
        allEvents.some((event) => event.kind === "device-lost-observed")) {
      issues.push(`device-loss-equivalent-misclassified:${id}`);
    }
    validateConfirmedFallback(capture, id, issues);
  } else if (id === "m7g-r187-test-destroyed-device-loss-promise") {
    if (capture.scenarioId !== id) issues.push(`test-destroyed-device-loss-scenario-identity-invalid:${id}`);
    validateTestDestroyedDeviceLossChain(capture, id, issues);
    validateConfirmedFallback(capture, id, issues);
  }
  const status: GroundGlassM7gScenarioStatus = issues.length === before ? "passed" : "failed";
  return {
    id,
    status,
    evidenceClass,
    sourceCommitSha,
    testInvocation,
    rendererRevision: "r187",
    runtimeIdentity,
    supportingArtifacts: [nonEmpty(capture.scenarioId) ? capture.scenarioId : id],
    orderedEvents,
    knownLimitations: ["Tested on Chrome 156.0.8078.76, macOS 27 arm64; no hardware acceleration claim is made."],
    issues: [...issues.slice(before)],
  };
};

const evaluateHeldComposite = (captureValue: unknown, issues: string[]): GroundGlassM7gScenario => {
  const id = "m7g-r187-held-m5-composite-latest-request" as const;
  const before = issues.length;
  const capture = record(captureValue);
  if (!capture) {
    issues.push(`capture-missing:${id}`);
    return {
      id, status: "blocked", evidenceClass: "native-webgpu-m3-m6-request-interleaving",
      sourceCommitSha: null, testInvocation: null, rendererRevision: null, runtimeIdentity: null,
      supportingArtifacts: [], orderedEvents: [], knownLimitations: ["The held M5 composite native capture is absent."],
      issues: [...issues.slice(before)],
    };
  }
  const provenance = requireM7gCaptureProvenance(capture, id, issues);
  const runtime = eventList(capture.orderedEvents).find((event) => event.kind === "runtime-observed");
  const r1 = capture.r1RequestId;
  const r2 = capture.r2RequestId;
  const generationId = capture.rendererGenerationId;
  const heldIdentity = record(capture.heldIdentity);
  const phases = eventList(capture.r1Phases);
  const r1CompletedBeforeComposite = Array.isArray(phases[0]?.completedPassesBeforeSubmission)
    ? phases[0]!.completedPassesBeforeSubmission as unknown[]
    : [];
  const expectedPhases = ["submitted", "hold-reached", "hold-released", "queue-settled", "stale-discarded"];
  if (capture.scenarioId !== id || !nonEmpty(r1) || !nonEmpty(r2) || r1 === r2 || !nonEmpty(generationId) ||
      heldIdentity?.requestId !== r1 || heldIdentity.generationId !== generationId ||
      heldIdentity.channelId !== "default" || heldIdentity.sceneId !== "architecture-rise" ||
      !nonEmpty(heldIdentity.targetUuid) || phases.length !== expectedPhases.length ||
      phases.some((event, index) => event.phase !== expectedPhases[index]) ||
      phases.some((event) => get(event, "identity", "requestId") !== r1 ||
        get(event, "identity", "generationId") !== generationId ||
        get(event, "identity", "targetUuid") !== heldIdentity.targetUuid ||
        get(event, "identity", "channelId") !== "default" ||
        get(event, "identity", "sceneId") !== "architecture-rise" ||
        event.executionApi !== "webgpu" || event.internalFallback !== "none")) {
    issues.push(`held-m5-composite-identity-or-order-invalid:${id}`);
  }
  const phaseSequences = phases.map((event) => seq(event.sequence));
  if (phaseSequences.some((value) => value === null) || phaseSequences.some((value, index) =>
      index > 0 && (value as number) <= (phaseSequences[index - 1] as number))) {
    issues.push(`held-m5-composite-event-sequence-invalid:${id}`);
  }
  if (!runtime || runtime.rendererRevision !== "187" || runtime.rendererFamily !== "webgpu-renderer" ||
      runtime.executionApi !== "webgpu" || runtime.internalFallback !== "none") {
    issues.push(`held-m5-composite-native-runtime-invalid:${id}`);
  }
  const orderedEvents = eventList(capture.orderedEvents).sort(bySequence);
  const holdReachedSequence = phaseSequences[1] ?? null;
  const holdReleasedSequence = phaseSequences[2] ?? null;
  const queueSettledSequence = phaseSequences[3] ?? null;
  const staleDiscardedSequence = phaseSequences[4] ?? null;
  const r2AcceptedDuringHold = orderedEvents.find((event) => event.kind === "host-request-accepted" && event.requestId === r2);
  const acceptedR1 = orderedEvents.some((event) => event.kind === "host-frame-result" && event.requestId === r1 && event.acceptedByHost === true);
  const completedR1 = orderedEvents.some((event) => event.kind === "frame-completed" && event.requestId === r1);
  const completedR2 = orderedEvents.find((event) => event.kind === "frame-completed" && event.requestId === r2);
  const acceptedR2 = orderedEvents.find((event) => event.kind === "host-frame-result" && event.requestId === r2 && event.acceptedByHost === true);
  const activeHost = orderedEvents.find((event) => event.kind === "host-attached" && event.channelId === "default");
  const latestR2Composite = orderedEvents.find((event) => event.kind === "m5-composite-lifecycle" &&
    get(event, "identity", "requestId") === r2 && event.phase === "queue-settled");
  if (acceptedR1 || completedR1 || !r2AcceptedDuringHold || r2AcceptedDuringHold.channelId !== "default" ||
      !activeHost || r2AcceptedDuringHold.hostId !== activeHost.hostId ||
      r2AcceptedDuringHold.sceneId !== "architecture-rise" || r2AcceptedDuringHold.activeGenerationId !== generationId ||
      r2AcceptedDuringHold.latestAcceptedRequestId !== r2 || holdReachedSequence === null ||
      seq(r2AcceptedDuringHold.sequence) === null || (seq(r2AcceptedDuringHold.sequence) as number) <= holdReachedSequence ||
      holdReleasedSequence === null || (seq(r2AcceptedDuringHold.sequence) as number) >= holdReleasedSequence ||
      queueSettledSequence === null || staleDiscardedSequence === null || queueSettledSequence >= staleDiscardedSequence ||
      holdReleasedSequence >= queueSettledSequence || !completedR2 || !acceptedR2 ||
      !latestR2Composite || (seq(latestR2Composite.sequence) ?? Number.MAX_SAFE_INTEGER) >= (seq(completedR2?.sequence) ?? -1) ||
      (seq(completedR2?.sequence) ?? Number.MAX_SAFE_INTEGER) >= (seq(acceptedR2?.sequence) ?? -1) ||
      acceptedR2.latestAcceptedRequestId !== r2 ||
      acceptedR2.generationId !== generationId || acceptedR2.activeGenerationId !== generationId ||
      acceptedR2.hostId !== activeHost?.hostId || acceptedR2.channelId !== "default" || acceptedR2.sceneId !== "architecture-rise") {
    issues.push(`stale-m5-result-published-or-r2-not-accepted:${id}`);
  }
  const captureSummary = record(get(capture, "capture", "summary"));
  const fingerprints = record(captureSummary?.inputFingerprints);
  const completedPasses = Array.isArray(captureSummary?.completedPasses) ? captureSummary.completedPasses : [];
  const r1DiagnosticsAtHold = record(capture.r1DiagnosticsAtHold);
  if (capture.route !== "/simulator/free/architecture-rise" || !captureSummary ||
      captureSummary.sceneSourceRevision !== ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION ||
      captureSummary.requestId !== r2 || captureSummary.rendererGenerationId !== generationId ||
      captureSummary.rendererRevision !== "r187" || captureSummary.actualExecutionApi !== "webgpu" ||
      captureSummary.rendererFamily !== "webgpu-renderer" || captureSummary.internalFallback !== "none" ||
      !nonEmpty(captureSummary.physicalDataFingerprint) ||
      !["sourceColor", "depth", "physical", "validity"].every((key) => nonEmpty(fingerprints?.[key])) ||
      !["farGather", "nearGather", "farReconstructionB1", "researchComposite"].every((pass) => completedPasses.includes(pass)) ||
      !r1DiagnosticsAtHold || r1DiagnosticsAtHold.frameRequestId !== r1 ||
      r1DiagnosticsAtHold.physicalRequestId !== r1 || r1DiagnosticsAtHold.physicalStatus !== "completed" ||
      r1DiagnosticsAtHold.apertureGatherRequestId !== r1 || r1DiagnosticsAtHold.apertureGatherStatus !== "ready" ||
      !["farGather", "nearGather", "farReconstructionB1"].every((pass) => r1CompletedBeforeComposite.includes(pass)) ||
      r1DiagnosticsAtHold.presentationRequestId !== r1 || r1DiagnosticsAtHold.presentationStatus !== "pending" ||
      r1DiagnosticsAtHold.lastDisplayedRequestId === r1) {
    issues.push(`current-m5-readback-incomplete-or-stale:${id}`);
  }
  const publications = eventList(get(capture, "capture", "publications"));
  if (publications.length !== 1 || publications[0]?.token !== get(capture, "capture", "summary", "token") ||
      publications[0]?.requestId !== r2 || publications[0]?.rendererGenerationId !== generationId) {
    issues.push(`stale-or-duplicate-m5-readback-publication:${id}`);
  }
  const diagnostics = record(capture.finalDiagnostics);
  if (!diagnostics || diagnostics.frameRequestId !== r2 || diagnostics.lastCompletedRequestId !== r2 ||
      diagnostics.physicalRequestId !== r2 || diagnostics.physicalStatus !== "completed" ||
      diagnostics.physicalGenerationId !== generationId || diagnostics.apertureGatherRequestId !== r2 ||
      diagnostics.apertureGatherGenerationId !== generationId || diagnostics.apertureGatherStatus !== "completed" ||
      diagnostics.presentationRequestId !== r2 || diagnostics.presentationGenerationId !== generationId ||
      diagnostics.presentationSource !== "m5-research-composite" || diagnostics.presentationStatus !== "completed" ||
      diagnostics.lastDisplayedRequestId !== r2) {
    issues.push(`m4-m5-m6-final-diagnostics-not-current:${id}`);
  }
  const status: GroundGlassM7gScenarioStatus = issues.length === before ? "passed" : "failed";
  return {
    id, status, evidenceClass: "native-webgpu-m3-m6-request-interleaving",
    sourceCommitSha: isSha(provenance?.sourceCommitSha) ? provenance.sourceCommitSha : null,
    testInvocation: nonEmpty(provenance?.testInvocation) ? provenance.testInvocation : null,
    rendererRevision: "r187", runtimeIdentity: runtime ?? null,
    supportingArtifacts: ["native/m5-composite-latest-request.json"], orderedEvents,
    knownLimitations: ["The controlled hold delays adapter settlement after native submission; it does not claim the GPU queue remained physically busy for the full hold interval."],
    issues: [...issues.slice(before)],
  };
};

const evaluateExternalLoss = (captureValue: unknown, issues: string[]): GroundGlassM7gScenario => {
  const id = "m7g-r187-spontaneous-external-device-loss" as const;
  const capture = record(captureValue);
  const localIssues: string[] = [];
  if (!capture || capture.status !== "blocked" || capture.evidenceClass !== "unobserved-external-device-loss" ||
      capture.externalLossObserved !== false || capture.testDestroyObserved !== false ||
      !nonEmpty(capture.limitation)) {
    localIssues.push(`external-loss-classification-invalid:${id}`);
  }
  const status: GroundGlassM7gScenarioStatus = localIssues.length > 0 ? "failed" : "blocked";
  issues.push(...localIssues);
  return {
    id, status, evidenceClass: "unobserved-external-device-loss",
    sourceCommitSha: null, testInvocation: null, rendererRevision: "r187", runtimeIdentity: null,
    supportingArtifacts: capture ? ["native/device-loss/external-loss-observation.json"] : [],
    orderedEvents: [], knownLimitations: capture && nonEmpty(capture.limitation) ? [capture.limitation] : [],
    issues: localIssues,
  };
};

const evaluateBroadE2e = (captureValue: unknown, issues: string[]): GroundGlassM7gScenario => {
  const id = "m7g-r187-broad-application-e2e" as const;
  const capture = record(captureValue);
  if (!capture) {
    issues.push(`broad-e2e-capture-missing:${id}`);
    return {
    id, status: "not-run", evidenceClass: "broad-application-e2e", sourceCommitSha: null,
    testInvocation: null, rendererRevision: null, runtimeIdentity: null, supportingArtifacts: [],
    orderedEvents: [], knownLimitations: ["The broad application E2E suite has no persisted current-run result."],
    issues: [`broad-e2e-capture-missing:${id}`],
    };
  }
  const localIssues: string[] = [];
  const counts = record(capture.counts);
  const reportLink = record(capture.playwrightReport);
  const reportValidation = record(capture.playwrightReportValidation);
  const resultMapping = record(capture.playwrightResultMapping);
  const validatedCounts = record(reportValidation?.counts);
  const reportedStats = record(reportValidation?.reportStats);
  const playwrightSummary = record(capture.playwrightSummary);
  const summaryCounts = playwrightSummary ? {
    expected: playwrightSummary.expected,
    unexpected: playwrightSummary.unexpected,
    skipped: playwrightSummary.skipped,
    flaky: playwrightSummary.flaky,
    artifact: playwrightSummary.artifact,
  } : null;
  const derivedCountsValid = !!validatedCounts && !!reportedStats &&
    ["expected", "unexpected", "skipped", "flaky"].every((key) =>
      Number.isInteger(validatedCounts[key]) && (validatedCounts[key] as number) >= 0 &&
      Number.isInteger(reportedStats[key]) && validatedCounts[key] === reportedStats[key]) &&
    Number.isInteger(reportValidation?.testsWithResults) &&
    Number.isInteger(reportValidation?.incompleteTests) &&
    Number(reportValidation?.testsWithResults) + Number(reportValidation?.incompleteTests) === reportValidation?.testsDiscovered &&
    Number(validatedCounts?.expected ?? 0) + Number(validatedCounts?.unexpected ?? 0) +
      Number(validatedCounts?.skipped ?? 0) + Number(validatedCounts?.flaky ?? 0) +
      Number(reportValidation?.incompleteTests ?? 0) === reportValidation?.testsDiscovered &&
    Array.isArray(reportValidation?.projectIds) && reportValidation.projectIds.length === 1 &&
    reportValidation.projectIds[0] === "chromium";
  const outcomeCountsValid = !!counts && derivedCountsValid &&
    counts.passed === validatedCounts.expected &&
    counts.failed === (Number(validatedCounts.unexpected) + Number(validatedCounts.flaky)) &&
    counts.blocked === Number(reportValidation?.incompleteTests) &&
    counts["not-run"] === validatedCounts.skipped;
  const skippedExclusions = capture.intentionalSkippedExclusions;
  if (capture.schemaVersion !== "ground-glass-m7g-r187-broad-e2e-v2" ||
      !nonEmpty(capture.command) || !isSha(capture.sourceCommitSha) || capture.browserProject !== "chromium" ||
      !counts || !countKeys.every((key) => Number.isInteger(counts[key]) && (counts[key] as number) >= 0) ||
      !isStatus(capture.status) || capture.testsExecuted !== reportValidation?.testsDiscovered ||
      capture.testsExecuted !== 277 || !reportValidation || reportValidation.valid !== true ||
      !Array.isArray(reportValidation.issues) || reportValidation.issues.length !== 0 ||
      reportValidation.artifact !== "validation/broad-e2e-playwright.json" ||
      !isSha256(reportValidation.sha256) || !reportLink || reportLink.artifact !== reportValidation.artifact ||
      reportLink.sha256 !== reportValidation.sha256 || !derivedCountsValid || !outcomeCountsValid || !resultMapping ||
      resultMapping.passed !== "Playwright stats.expected" ||
      resultMapping.failed !== "Playwright stats.unexpected plus stats.flaky" ||
      resultMapping.blocked !== "Test cases without a complete usable result" ||
      resultMapping["not-run"] !== "Playwright stats.skipped; no skipped tests are exempted by this capture" ||
      !summaryCounts || summaryCounts.expected !== validatedCounts?.expected ||
      summaryCounts.unexpected !== validatedCounts?.unexpected || summaryCounts.skipped !== validatedCounts?.skipped ||
      summaryCounts.flaky !== validatedCounts?.flaky || summaryCounts.artifact !== reportValidation.artifact ||
      !Array.isArray(skippedExclusions) || skippedExclusions.length !== 0) {
    localIssues.push(`broad-e2e-provenance-or-counts-invalid:${id}`);
  }
  if (isStatus(capture.status)) {
    const failureCount = Number(counts?.failed ?? 0);
    const blockedCount = Number(counts?.blocked ?? 0);
    const notRunCount = Number(counts?.["not-run"] ?? 0);
    if (capture.status === "passed" && (failureCount > 0 || blockedCount > 0 || notRunCount > 0 ||
        reportValidation?.valid !== true || reportValidation?.testsDiscovered !== 277)) {
      localIssues.push(`broad-e2e-passing-status-contradicts-outcomes:${id}`);
    }
    if (capture.status === "blocked" && failureCount === 0 && blockedCount === 0 && notRunCount === 0) {
      localIssues.push(`broad-e2e-blocked-status-has-no-blocker:${id}`);
    }
    if (capture.status === "failed" && failureCount === 0) {
      localIssues.push(`broad-e2e-failed-status-has-no-failures:${id}`);
    }
    if (capture.status === "not-run" && (capture.testsExecuted !== 0 ||
        countKeys.some((key) => Number(counts?.[key] ?? 0) !== 0))) {
      localIssues.push(`broad-e2e-not-run-status-contradicts-outcomes:${id}`);
    }
  }

  const comparison = record(capture.cleanMainComparison);
  const comparisonResults = Array.isArray(comparison?.results) ? comparison.results.filter(isRecord) : [];
  const comparedTests = comparisonResults.map((item) => item.test);
  const reproducedCount = comparisonResults.length;
  const failureClassification = record(capture.failureClassification);
  const unclassifiedFailureCount = Number(counts?.failed ?? 0) - reproducedCount;
  const comparisonValid = !!comparison && isSha(comparison.sourceSha) && nonEmpty(comparison.checkout) &&
    Array.isArray(comparison.results) && comparisonResults.length === comparison.results.length &&
    comparedTests.every(nonEmpty) && new Set(comparedTests).size === reproducedCount &&
    comparisonResults.every((item) => item.status === "failed" && nonEmpty(item.sameObservedFailure) &&
      nonEmpty(item.invocation)) && unclassifiedFailureCount >= 0 && !!failureClassification &&
    failureClassification.unexpectedFailureCount === Number(counts?.failed ?? 0) &&
    failureClassification.cleanMainReproducedFailureCount === reproducedCount &&
    failureClassification.unclassifiedUnexpectedFailureCount === unclassifiedFailureCount &&
    failureClassification.comparisonCoverage === (unclassifiedFailureCount === 0 ? "complete" : "partial");
  if (!comparisonValid) {
    localIssues.push(`broad-e2e-clean-main-classification-invalid:${id}`);
  }
  if (localIssues.length > 0) issues.push(...localIssues);
  return {
    id,
    status: localIssues.length > 0 ? "failed" : capture.status as GroundGlassM7gScenarioStatus,
    evidenceClass: "broad-application-e2e",
    sourceCommitSha: isSha(capture.sourceCommitSha) ? capture.sourceCommitSha : null,
    testInvocation: nonEmpty(capture.command) ? capture.command : null,
    rendererRevision: null,
    runtimeIdentity: { environment: record(capture.environment), playwrightReportValidation: reportValidation },
    supportingArtifacts: ["validation/broad-e2e.json", "validation/broad-e2e-playwright.json"], orderedEvents: [],
    knownLimitations: Array.isArray(capture.limitations) ? capture.limitations.filter(nonEmpty) : [],
    issues: localIssues,
  };
};

const evaluateProductionIsolation = (captureValue: unknown, issues: string[]): GroundGlassM7gScenario => {
  const id = "m7g-r187-production-preview-isolation" as const;
  const capture = record(captureValue);
  const localIssues: string[] = [];
  if (!capture) localIssues.push(`production-isolation-capture-missing:${id}`);
  else if (capture.status !== "passed" || capture.productionWebGpuEnabled !== false ||
      capture.testSeamExposed !== false || capture.webGpuAttemptCount !== 0 ||
      capture.policySelectedBackend !== "webgl" || capture.rendererFamily !== "webgl-renderer" ||
      capture.actualExecutionApi !== "webgl2" || !isSha(capture.sourceCommitSha) ||
      !nonEmpty(capture.command) || capture.browserProject !== "chromium-production-preview") {
    localIssues.push(`production-isolation-contract-invalid:${id}`);
  }
  if (localIssues.length > 0) issues.push(...localIssues);
  return {
    id, status: localIssues.length > 0 ? (capture ? "failed" : "blocked") : "passed",
    evidenceClass: "production-preview-webgl-isolation",
    sourceCommitSha: isSha(capture?.sourceCommitSha) ? capture.sourceCommitSha : null,
    testInvocation: nonEmpty(capture?.command) ? capture.command : null,
    rendererRevision: "r187", runtimeIdentity: capture ? capture : null,
    supportingArtifacts: capture ? ["validation/production-isolation.json"] : [],
    orderedEvents: [], knownLimitations: [], issues: localIssues,
  };
};

const summarizePredecessors = (input: JsonRecord, issues: string[]): JsonRecord => {
  const reports = record(input.predecessorReports);
  const replays = record(input.predecessorReplays);
  const replayExecutions = record(input.predecessorReplayExecutions);
  if (!reports) {
    issues.push("predecessor-reports-missing");
    return {};
  }
  const m7c = record(reports.m7c);
  const m7d = record(reports.m7d);
  const m7e = record(reports.m7e);
  const m7f = record(reports.m7f);
  const m7eReplay = record(replays?.m7e);
  const m7fReplay = record(replays?.m7f);
  const m7eReplayExecution = record(replayExecutions?.m7e);
  const m7fReplayExecution = record(replayExecutions?.m7f);
  if (!m7c) issues.push("predecessor-report-missing:m7c");
  else {
    const evaluated = evaluateGroundGlassM7cR187LifecycleEvidence(m7c);
    if (!evaluated.valid || m7c.reportId !== "m7c-r187-native-raw-lifecycle-qualification-2026-10-31" ||
        m7c.evaluatorRevision !== "m7c-r187-lifecycle-evidence-v2" || !isSha(m7c.sourceHeadSha) ||
        evaluated.qualification !== "partially-qualified" || evaluated.counts.passed !== 18 ||
        evaluated.counts.failed !== 0 || evaluated.counts.blocked !== 2 || evaluated.counts["not-run"] !== 1) {
      issues.push("predecessor-report-invalid:m7c");
    }
  }
  if (!m7d) issues.push("predecessor-report-missing:m7d");
  else {
    const evaluated = evaluateGroundGlassM7dPhysicalCocReport(m7d);
    if (evaluated.status !== "passed" || evaluated.issues.length > 0 || evaluated.computedCounts.passed !== 8 ||
        m7d.reportId !== "ground-glass-m7d-r187-physical-coc" ||
        m7d.evaluatorRevision !== "m7d-physical-coc-evidence-v2" ||
        get(m7d, "nativeRuntime", "threeRevision") !== "187" ||
        get(m7d, "nativeRuntime", "actualExecutionApi") !== "webgpu" ||
        m7d.qualification !== "research-qualified-for-tested-environment") {
      issues.push("predecessor-report-invalid:m7d");
    }
  }
  if (!m7e) issues.push("predecessor-report-missing:m7e");
  else if (m7e.reportId !== "ground-glass-m7e-r187-gather-b1" ||
      m7e.evaluatorRevision !== "m7e-r187-gather-b1-evaluator-v2" || !isSha(m7e.sourceCommitSha) ||
      get(m7e, "runtime", "rendererRevision") !== "r187" || get(m7e, "runtime", "actualExecutionApi") !== "webgpu" ||
      get(m7e, "inventory", "m5GatherEvidenceStatus") !== "research-only" ||
      get(m7e, "inventory", "m5B1EvidenceStatus") !== "research-only" ||
      get(m7e, "inventory", "productionWebGpuEnabled") !== false) {
    issues.push("predecessor-report-invalid:m7e");
  }
  if (!m7f) issues.push("predecessor-report-missing:m7f");
  else if (m7f.reportId !== "ground-glass-m7f-r187-presentation" ||
      m7f.evaluatorRevision !== "m7f-r187-presentation-evaluator-v2" ||
      !isSha(m7f.nativeCaptureSourceSha) || m7f.qualificationStatus !== "passed" ||
      get(m7f, "runtimeIdentity", "rendererRevision") !== "r187" ||
      get(m7f, "runtimeIdentity", "actualExecutionApi") !== "webgpu" ||
      get(m7f, "historicalEvidencePreserved", "m6dContract") !== "m6d-opaque-presentation-v1" ||
      get(m7f, "authorization", "m6EvidenceUsedForRendererSelection") !== false ||
      get(m7f, "authorization", "productionWebGpuEnabled") !== false) {
    issues.push("predecessor-report-invalid:m7f");
  }
  const m7fScenarios = Array.isArray(m7f?.scenarios) ? m7f.scenarios.filter(isRecord) : [];
  const registeredApp = m7fScenarios.find((scenario) => scenario.id === "registered-architecture-rise-m3-m6");
  const alphaFixture = m7fScenarios.find((scenario) => scenario.id === "m6c-opaque-target-alpha");
  const m7fScenarioIds = m7fScenarios.map((scenario) => scenario.id);
  if (m7fScenarios.length !== 17 || new Set(m7fScenarioIds).size !== 17 ||
      registeredApp?.status !== "passed" || registeredApp.sourceCommitSha !== m7f?.nativeCaptureSourceSha ||
      get(registeredApp, "runtimeIdentity", "sceneId") !== "architecture-rise" ||
      get(registeredApp, "runtimeIdentity", "rendererRevision") !== "r187" ||
      get(registeredApp, "runtimeIdentity", "actualExecutionApi") !== "webgpu" ||
      get(alphaFixture, "runtimeIdentity", "evidenceScope") !== "controlled-native-presentation-fixture") {
    issues.push("m7f-registered-and-fixture-evidence-boundary-invalid");
  }
  if (!m7eReplay || m7eReplay.reportId !== "ground-glass-m7e-r187-offline-replay" ||
      m7eReplay.evaluatorRevision !== "m7e-r187-gather-b1-evaluator-v2" || m7eReplay.replayStatus !== "passed" ||
      get(m7eReplay, "scenarioCounts", "passed") !== 12 || get(m7eReplay, "scenarioCounts", "failed") !== 0 ||
      m7eReplay.captureSourceCommitSha !== m7e?.sourceCommitSha || !isSha(m7eReplay.replayCodeCommitSha) ||
      get(m7eReplay, "runtimeIdentity", "rendererRevision") !== "r187" ||
      get(m7eReplay, "runtimeIdentity", "actualExecutionApi") !== "webgpu" ||
      get(m7eReplay, "authorization", "productionWebGpuEnabled") !== false ||
      !Array.isArray(m7eReplay.issues) || m7eReplay.issues.length !== 0) {
    issues.push("predecessor-replay-invalid:m7e");
  }
  if (!m7fReplay || m7fReplay.reportId !== "ground-glass-m7f-r187-presentation" ||
      m7fReplay.evaluatorRevision !== "m7f-r187-presentation-evaluator-v2" ||
      m7fReplay.qualificationPass !== true || m7fReplay.qualificationStatus !== "passed" ||
      get(m7fReplay, "scenarioCounts", "computed", "passed") !== 17 ||
      get(m7fReplay, "scenarioCounts", "computed", "failed") !== 0 ||
      m7fReplay.nativeCaptureSourceSha !== m7f?.nativeCaptureSourceSha || !isSha(m7fReplay.replayCodeCommitSha) ||
      get(m7fReplay, "runtimeIdentity", "rendererRevision") !== "r187" ||
      get(m7fReplay, "runtimeIdentity", "actualExecutionApi") !== "webgpu" ||
      get(m7fReplay, "authorization", "m8Authorized") !== false ||
      get(m7fReplay, "authorization", "productionWebGpuEnabled") !== false) {
    issues.push("predecessor-replay-invalid:m7f");
  }
  if (!validReplayExecution(m7eReplayExecution, m7eReplay, "m7e")) {
    issues.push("predecessor-replay-execution-invalid:m7e");
  }
  if (!validReplayExecution(m7fReplayExecution, m7fReplay, "m7f")) {
    issues.push("predecessor-replay-execution-invalid:m7f");
  }
  const quality = record(m7e?.qualification);
  const dimensions = record(quality?.dimensions);
  const expectedQuality = [
    "reference-not-converged", "insufficient-support", "bounded-qualified", "insufficient-support",
    "reference-not-converged", "reference-not-converged", "reference-not-converged",
  ];
  const observedQuality = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7"].map((id) => get(dimensions, id, "status"));
  if (observedQuality.some((status, index) => status !== expectedQuality[index])) {
    issues.push("m5q-quality-status-changed-or-promoted");
  }
  const m7cScenarios = Array.isArray(m7c?.scenarios) ? m7c.scenarios : [];
  const m7cStatus = (id: string): unknown => record(m7cScenarios.find((item) => get(item, "id") === id))?.status;
  const m7fCounts = record(get(m7f, "scenarioCounts", "computed"));
  return {
    m7c: m7c ? { reportId: m7c.reportId, evaluatorRevision: m7c.evaluatorRevision, sourceSha: m7c.sourceHeadSha,
      qualification: m7c.qualification, scenarioCounts: m7c.scenarioCounts, openScenarios: {
        initialization: m7cStatus("m7c-r187-init-after-target-fallback"),
        spontaneousLoss: m7cStatus("m7c-r187-spontaneous-device-loss"),
        broadE2e: m7cStatus("m7c-r187-broad-local-e2e"),
      } } : null,
    m7d: m7d ? { reportId: m7d.reportId, evaluatorRevision: m7d.evaluatorRevision,
      nativeCaptureSourceSha: get(m7d, "provenance", "nativeM4CaptureSourceSha"), qualification: m7d.qualification,
      counts: m7d.counts } : null,
    m7e: m7e ? { reportId: m7e.reportId, evaluatorRevision: m7e.evaluatorRevision,
      nativeCaptureSourceSha: m7e.sourceCommitSha, nativeRunId: m7e.nativeRunId,
      runtime: m7e.runtime, qualification: get(m7e, "qualification", "status"), qualityStatuses: observedQuality } : null,
    m7eOfflineReplay: m7eReplay ? { reportId: m7eReplay.reportId, evaluatorRevision: m7eReplay.evaluatorRevision,
      status: m7eReplay.replayStatus, counts: m7eReplay.scenarioCounts, noBrowser: m7eReplay.noBrowser,
      freshExecution: m7eReplayExecution } : null,
    m7f: m7f ? { reportId: m7f.reportId, evaluatorRevision: m7f.evaluatorRevision,
      nativeCaptureSourceSha: m7f.nativeCaptureSourceSha, qualification: m7f.qualificationStatus,
      counts: m7f.scenarioCounts, runtime: m7f.runtimeIdentity,
      physicalOverlayScope: "M6B evidence remains a controlled calibration fixture, not registered-scene alignment.",
      alphaEvidenceScope: get(m7fScenarios.find((scenario) => scenario.id === "m6c-opaque-target-alpha"),
        "runtimeIdentity", "evidenceScope") } : null,
    m7fOfflineReplay: m7fReplay ? { reportId: m7fReplay.reportId, evaluatorRevision: m7fReplay.evaluatorRevision,
      status: m7fReplay.qualificationStatus, counts: m7fReplay.scenarioCounts,
      qualificationPass: m7fReplay.qualificationPass, freshExecution: m7fReplayExecution } : null,
    m6PresentationScenarioCount: m7fCounts?.passed ?? null,
  };
};

const scenarioClaimsConsistent = (input: JsonRecord, scenarios: readonly GroundGlassM7gScenario[], issues: string[]): boolean => {
  const claims = input.scenarios;
  if (!Array.isArray(claims)) return true;
  const byId = new Map<string, JsonRecord>();
  for (const value of claims) {
    const claim = record(value);
    if (!claim || !nonEmpty(claim.id) || !isStatus(claim.status)) {
      issues.push("scenario-inventory-entry-invalid");
      continue;
    }
    if (byId.has(claim.id)) issues.push(`duplicate-scenario:${claim.id}`);
    byId.set(claim.id, claim);
  }
  for (const requiredId of GROUND_GLASS_M7G_REQUIRED_SCENARIO_IDS) {
    const computed = scenarios.find((scenario) => scenario.id === requiredId);
    const claimed = byId.get(requiredId);
    if (!claimed) issues.push(`scenario-claim-missing:${requiredId}`);
    else if (computed && claimed.status !== computed.status) issues.push(`scenario-status-claim-contradiction:${requiredId}`);
  }
  for (const id of byId.keys()) {
    if (!(GROUND_GLASS_M7G_REQUIRED_SCENARIO_IDS as readonly string[]).includes(id)) issues.push(`unexpected-scenario:${id}`);
  }
  return issues.length === 0;
};

export const evaluateGroundGlassM7gConsolidation = (inputValue: unknown): GroundGlassM7gConsolidatedEvaluation => {
  const input = record(inputValue);
  const issues: string[] = [];
  if (!input) {
    return {
      schemaVersion: GROUND_GLASS_M7G_SCHEMA_VERSION,
      reportId: GROUND_GLASS_M7G_REPORT_ID,
      evaluatorRevision: GROUND_GLASS_M7G_EVALUATOR_REVISION,
      valid: false,
      evidenceIntegrity: "failed",
      issues: ["report-must-be-an-object"],
      qualificationStatus: "blocked",
      qualificationPass: false,
      scenarioCounts: { declared: null, computed: emptyCounts(), inventoryConsistent: false },
      scenarios: [], predecessorEvidence: {}, decisions: {} as GroundGlassM7gConsolidatedEvaluation["decisions"], authorization: {},
    };
  }
  if (input.schemaVersion !== GROUND_GLASS_M7G_SCHEMA_VERSION) issues.push("unsupported-schema-version");
  if (input.reportId !== GROUND_GLASS_M7G_REPORT_ID) issues.push("report-id-mismatch");
  if (input.evaluatorRevision !== GROUND_GLASS_M7G_EVALUATOR_REVISION) issues.push("evaluator-revision-mismatch");
  const predecessorEvidence = summarizePredecessors(input, issues);
  const captures = record(input.captures) ?? {};
  const scenarios: GroundGlassM7gScenario[] = [];
  scenarios.push(evaluateNativeCapture(captures.initialization, GROUND_GLASS_M7G_REQUIRED_SCENARIO_IDS[0], "native-webgpu-initialization-failure", issues));
  scenarios.push(evaluateNativeCapture(captures.deviceLossEquivalent, GROUND_GLASS_M7G_REQUIRED_SCENARIO_IDS[1], "injected-device-loss-equivalent", issues));
  scenarios.push(evaluateNativeCapture(captures.testDestroyedDeviceLoss, GROUND_GLASS_M7G_REQUIRED_SCENARIO_IDS[2], "test-induced-gpu-device-lost-promise", issues));
  scenarios.push(evaluateExternalLoss(captures.externalLoss, issues));
  scenarios.push(evaluateHeldComposite(captures.heldComposite, issues));
  scenarios.push(evaluateBroadE2e(captures.broadE2e, issues));
  scenarios.push(evaluateProductionIsolation(captures.productionIsolation, issues));
  scenarioClaimsConsistent(input, scenarios, issues);

  const computedCounts = emptyCounts();
  for (const scenario of scenarios) computedCounts[scenario.status] += 1;
  const declaredRecord = record(input.scenarioCounts);
  let declaredCounts: Record<GroundGlassM7gScenarioStatus, number> | null = null;
  let inventoryConsistent = true;
  if (declaredRecord) {
    declaredCounts = emptyCounts();
    for (const key of countKeys) {
      if (!Number.isInteger(declaredRecord[key]) || declaredRecord[key] !== computedCounts[key]) inventoryConsistent = false;
      else declaredCounts[key] = declaredRecord[key] as number;
    }
    if (Object.keys(declaredRecord).some((key) => !countKeys.includes(key as typeof countKeys[number]))) inventoryConsistent = false;
    if (!inventoryConsistent) issues.push("scenario-count-inventory-mismatch");
  }
  const authorized = record(input.authorization) ?? {};
  const authorizationValid = authorized.m3RawRttRendererAttemptAuthority === "m3-raw-pilot" &&
    authorized.r187M4Status === "research-only" && authorized.r187M5Status === "research-only" &&
    authorized.r187M6Status === "development-only" && authorized.m5qStatus === "partially-qualified" &&
    authorized.m6EvidenceUsedForRendererSelection === false && authorized.productionWebGpuEnabled === false &&
    authorized.productionGroundGlass === "WebGL-only" && authorized.m8Authorized === false &&
    authorized.m9Authorized === false && authorized.productionTestSeamExposed === false;
  if (!authorizationValid) issues.push("authorization-boundary-violated");

  const hasFailure = computedCounts.failed > 0;
  const hasBlock = computedCounts.blocked > 0 || computedCounts["not-run"] > 0;
  const qualificationStatus: GroundGlassM7gQualificationStatus = hasFailure
    ? "failed"
    : hasBlock ? "partially-qualified" : "qualified-for-exact-development-pilot-scope";
  const valid = issues.length === 0;
  const qualificationPass = valid && qualificationStatus === "qualified-for-exact-development-pilot-scope";
  const statusOf = (id: string): GroundGlassM7gScenarioStatus =>
    scenarios.find((scenario) => scenario.id === id)?.status ?? "blocked";
  const predecessorReplayPassed = !issues.includes("predecessor-replay-invalid:m7e") &&
    !issues.includes("predecessor-replay-invalid:m7f");
  const m7cEval = record(get(input, "predecessorReports", "m7c"));
  const m7cScenarioStatus = (id: string): unknown => {
    const list = Array.isArray(m7cEval?.scenarios) ? m7cEval.scenarios : [];
    return get(list.find((entry) => get(entry, "id") === id), "status");
  };
  const decisions: GroundGlassM7gConsolidatedEvaluation["decisions"] = {
    rawLifecycle: statusOf("m7g-r187-init-after-target-operation-recheck") === "passed" &&
      m7cScenarioStatus("m7c-r187-spontaneous-device-loss") === "blocked" ? "partially-qualified" :
      statusOf("m7g-r187-init-after-target-operation-recheck") === "failed" ? "failed" : "qualified",
    physicalCocResearch: issues.some((issue) => issue.includes("m7d")) ? "blocked" : "research-qualified",
    gatherB1Research: issues.some((issue) => issue.includes("m7e")) ? "blocked" : "research-qualified",
    m5OpticalQuality: issues.includes("m5q-quality-status-changed-or-promoted") ? "failed" : "partially-qualified",
    presentationConformance: issues.some((issue) => issue.includes("m7f")) ? "blocked" : "passed",
    crossStageRequestIntegrity: statusOf("m7g-r187-held-m5-composite-latest-request") === "passed" ? "passed" :
      statusOf("m7g-r187-held-m5-composite-latest-request") === "failed" ? "failed" : "blocked",
    initializationFailureIntegrity: statusOf("m7g-r187-init-after-target-operation-recheck") === "passed" ? "passed" :
      statusOf("m7g-r187-init-after-target-operation-recheck") === "failed" ? "failed" : "blocked",
    runtimeFailureRecovery: statusOf("m7g-r187-device-loss-equivalent") === "passed" &&
      statusOf("m7g-r187-test-destroyed-device-loss-promise") === "passed" ? "passed" :
      statusOf("m7g-r187-device-loss-equivalent") === "failed" || statusOf("m7g-r187-test-destroyed-device-loss-promise") === "failed" ? "failed" : "blocked",
    deviceLossHandling: statusOf("m7g-r187-spontaneous-external-device-loss") === "blocked" ? "partially-qualified" :
      statusOf("m7g-r187-spontaneous-external-device-loss") === "failed" ? "failed" : "passed",
    resourceCleanup: statusOf("m7g-r187-init-after-target-operation-recheck") === "passed" && predecessorReplayPassed ? "passed" : "blocked",
    stickyFallback: m7cScenarioStatus("m7c-r187-sticky-fallback-remount") === "passed" ? "passed" : "blocked",
    retryAndSessionOwnership: m7cScenarioStatus("m7c-r187-explicit-retry-new-session") === "passed" ? "passed" : "blocked",
    resizeAndRemount: m7cScenarioStatus("m7c-r187-sticky-fallback-remount") === "passed" &&
      !issues.includes("predecessor-replay-invalid:m7f") ? "passed" : "blocked",
    sceneTransition: m7cScenarioStatus("m7c-r187-pending-cleanup-scene-navigation") === "passed" ? "passed" : "blocked",
    productionIsolation: statusOf("m7g-r187-production-preview-isolation") === "passed" ? "passed" :
      statusOf("m7g-r187-production-preview-isolation") === "failed" ? "failed" : "blocked",
    consolidatedM7: qualificationStatus,
    m8EntryGate: qualificationStatus === "qualified-for-exact-development-pilot-scope" && authorizationValid ? "authorized" : "denied",
  };
  return {
    schemaVersion: GROUND_GLASS_M7G_SCHEMA_VERSION,
    reportId: GROUND_GLASS_M7G_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7G_EVALUATOR_REVISION,
    valid,
    evidenceIntegrity: valid ? "passed" : "failed",
    issues,
    qualificationStatus,
    qualificationPass,
    scenarioCounts: { declared: declaredCounts, computed: computedCounts, inventoryConsistent },
    scenarios,
    predecessorEvidence,
    decisions,
    authorization: authorized,
  };
};
