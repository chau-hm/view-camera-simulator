import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const evaluatorRevision = "m7n-renderer-lifecycle-evaluator-v1";
const expectedBaseSha = "8a383e740d6a3f14b7673ae3adb18471b7d55d4c";
const shaPattern = /^[0-9a-f]{40}$/i;
const allowedSurfaces = new Set(["route", "simulator", "scene", "observer", "ground-glass"]);

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const stringValue = (value: unknown): string | null => typeof value === "string" ? value : null;
const numberValue = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

const captureContracts = {
  "target-solo-w1-trace-off": {
    workers: 1,
    traceEnabled: false,
    identities: ["architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension"],
  },
  "target-solo-w1-trace-on": {
    workers: 1,
    traceEnabled: true,
    identities: ["architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension"],
  },
  "target-light-peers-w4": {
    workers: 4,
    traceEnabled: true,
    identities: [
      "architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
      "home.spec.ts::concept learning sections keep their responsive grids without overflow",
      "simulator-header.spec.ts::keeps the active lesson context between the brand and desktop actions",
      "smoke.spec.ts::smoke: app boots at home",
    ],
  },
  "target-renderer-heavy-peers-w4": {
    workers: 4,
    traceEnabled: true,
    identities: [
      "architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
      "macro-bellows-extension.spec.ts::Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions",
      "macro-compound-movements.spec.ts::Macro 4 teaches compound Tilt + Swing + Focus through the public route",
      "mirror-shift-rig-lateral.spec.ts::Mirror Shift Camera focus follows the rig while Scene focus stays fixed",
    ],
  },
} as const;

type EvaluationResult = Readonly<{
  passed: boolean;
  issues: readonly string[];
  summary: Readonly<Record<string, unknown>>;
}>;

export const evaluateM7nRendererLifecycleEvidence = async (
  reportPath = "docs/architecture/GROUND_GLASS_M7N_RENDERER_LIFECYCLE_REPORT.json",
  repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
): Promise<EvaluationResult> => {
  const issues = new Set<string>();
  const issue = (value: string) => issues.add(value);
  const root = resolve(repoRoot);
  const absoluteReportPath = resolve(root, reportPath);
  const relativeReportPath = relative(root, absoluteReportPath);
  if (relativeReportPath.startsWith(`..${sep}`) || isAbsolute(relativeReportPath)) {
    return { passed: false, issues: ["m7n-report-path-outside-repository"], summary: {} };
  }

  let report: JsonRecord;
  try {
    report = asRecord(JSON.parse(await readFile(absoluteReportPath, "utf8"))) ?? {};
  } catch {
    return { passed: false, issues: ["m7n-report-unavailable-or-invalid-json"], summary: {} };
  }

  if (report.schemaVersion !== 1) issue("m7n-report-schema-invalid");
  if (report.evaluatorRevision !== evaluatorRevision) issue("m7n-evaluator-revision-invalid");
  if (report.baseCommitSha !== expectedBaseSha) issue("m7n-base-source-identity-invalid");
  if (report.executionSourceCommitSha !== report.instrumentationSourceCommitSha) {
    issue("m7n-execution-and-instrumentation-source-roles-inconsistent");
  }
  const executionSourceSha = stringValue(report.executionSourceCommitSha);
  const toolingSourceSha = stringValue(report.toolingSourceCommitSha);
  const normalizationSourceSha = stringValue(report.normalizationSourceCommitSha);
  const evaluatorSourceSha = stringValue(report.evaluatorSourceCommitSha);
  const priorCaptureToolingSha = stringValue(report.priorCaptureToolingSourceCommitSha);
  if (!executionSourceSha || !shaPattern.test(executionSourceSha)) issue("m7n-execution-source-sha-invalid");
  if (!toolingSourceSha || !shaPattern.test(toolingSourceSha)) issue("m7n-tooling-source-sha-invalid");
  if (!normalizationSourceSha || !shaPattern.test(normalizationSourceSha)) issue("m7n-normalizer-source-sha-invalid");
  if (!evaluatorSourceSha || !shaPattern.test(evaluatorSourceSha)) issue("m7n-evaluator-source-sha-invalid");
  if (!priorCaptureToolingSha || !shaPattern.test(priorCaptureToolingSha)) issue("m7n-prior-capture-tooling-source-sha-invalid");

  const gitExists = (sha: string) => {
    try {
      execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: root, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  };
  if (executionSourceSha && shaPattern.test(executionSourceSha) && !gitExists(executionSourceSha)) {
    issue("m7n-execution-source-commit-unavailable");
  }
  if (toolingSourceSha && shaPattern.test(toolingSourceSha) && !gitExists(toolingSourceSha)) {
    issue("m7n-tooling-source-commit-unavailable");
  }
  if (normalizationSourceSha && shaPattern.test(normalizationSourceSha) && !gitExists(normalizationSourceSha)) {
    issue("m7n-normalizer-source-commit-unavailable");
  }
  if (evaluatorSourceSha && shaPattern.test(evaluatorSourceSha) && !gitExists(evaluatorSourceSha)) {
    issue("m7n-evaluator-source-commit-unavailable");
  }
  if (priorCaptureToolingSha && shaPattern.test(priorCaptureToolingSha) && !gitExists(priorCaptureToolingSha)) {
    issue("m7n-prior-capture-tooling-source-commit-unavailable");
  }

  const sourceFiles = asArray(report.sourceFiles);
  const verifiedSourceRoles = new Set<string>();
  const verifiedSourcePaths = new Set<string>();
  for (const sourceFileValue of sourceFiles) {
    const sourceFile = asRecord(sourceFileValue);
    if (!sourceFile) {
      issue("m7n-source-file-record-invalid");
      continue;
    }
    const role = stringValue(sourceFile.role);
    const sha = stringValue(sourceFile.commitSha);
    const path = stringValue(sourceFile.path);
    const expectedSha = stringValue(sourceFile.sha256);
    if (!role || !sha || !path || !expectedSha || !shaPattern.test(sha) || !/^[0-9a-f]{64}$/i.test(expectedSha)) {
      issue("m7n-source-file-provenance-invalid");
      continue;
    }
    if (!path || path.startsWith("/") || path.split("/").includes("..")) {
      issue("m7n-source-path-invalid");
      continue;
    }
    try {
      const bytes = execFileSync("git", ["show", `${sha}:${path}`], { cwd: root, encoding: "buffer" });
      const actualSha = createHash("sha256").update(bytes).digest("hex");
      if (actualSha !== expectedSha) issue("m7n-source-file-digest-mismatch");
    } catch {
      issue("m7n-source-file-tree-entry-unavailable");
    }
    if (role === "execution" && sha !== executionSourceSha) issue("m7n-execution-source-file-role-mismatch");
    if (role === "capture-tooling" && sha !== toolingSourceSha) issue("m7n-tooling-source-file-role-mismatch");
    if (role === "normalizer" && sha !== normalizationSourceSha) issue("m7n-normalizer-source-file-role-mismatch");
    if (role === "evaluator" && sha !== evaluatorSourceSha) issue("m7n-evaluator-source-file-role-mismatch");
    if (role === "prior-tooling" && sha !== priorCaptureToolingSha) issue("m7n-prior-tooling-source-file-role-mismatch");
    if (!["execution", "capture-tooling", "normalizer", "evaluator", "prior-tooling"].includes(role ?? "")) issue("m7n-source-file-role-invalid");
    if (role && path) verifiedSourceRoles.add(`${role}:${path}`);
    if (path) verifiedSourcePaths.add(path);
  }
  const requiredSourceFiles = [
    "execution:src/render/testing/m7nRendererLifecycleTrace.ts",
    "execution:src/render/SceneRenderer.tsx",
    "capture-tooling:src/tests/e2e/helpers/m7nRendererLifecycleCapture.ts",
    "capture-tooling:src/tests/e2e/architecture-rise-focus-range.spec.ts",
    "capture-tooling:scripts/m7n-spa-generation-probe.mjs",
    "capture-tooling:scripts/run-m7n-renderer-lifecycle.mjs",
    "prior-tooling:src/tests/e2e/helpers/m7nRendererLifecycleCapture.ts",
    "normalizer:scripts/normalizeM7nRendererLifecycleCapture.mjs",
    "evaluator:scripts/evaluateM7nRendererLifecycle.ts",
  ];
  if (requiredSourceFiles.some((source) => !verifiedSourceRoles.has(source))) issue("m7n-required-source-provenance-missing");
  if (verifiedSourcePaths.size !== sourceFiles.length) issue("m7n-source-file-path-duplicated");

  const priorAttempts = asArray(report.priorCaptureAttempts).map(asRecord).filter((attempt): attempt is JsonRecord => attempt !== null);
  if (priorAttempts.length !== 4) issue("m7n-prior-capture-attempt-inventory-invalid");
  const priorAttemptIds = new Set<string>();
  for (const attempt of priorAttempts) {
    const attemptId = stringValue(attempt.id);
    const rawCapture = asRecord(attempt.rawCapture);
    const executionSha = stringValue(attempt.executionSourceCommitSha);
    const captureToolingSha = stringValue(attempt.toolingSourceCommitSha);
    const outcomes = asRecord(attempt.outcomes);
    if (!attemptId || priorAttemptIds.has(attemptId)) issue("m7n-prior-capture-attempt-identity-invalid");
    if (attemptId) priorAttemptIds.add(attemptId);
    if (
      !rawCapture ||
      !/^[0-9a-f]{64}$/i.test(stringValue(rawCapture.sha256) ?? "") ||
      !(numberValue(rawCapture.bytes) && numberValue(rawCapture.bytes)! > 0) ||
      rawCapture.retention !== "private-local-only" ||
      rawCapture.offlineReplayAvailable !== false
    ) issue("m7n-prior-capture-raw-provenance-invalid");
    if (executionSha !== executionSourceSha || captureToolingSha !== priorCaptureToolingSha || !captureToolingSha || !shaPattern.test(captureToolingSha) || !gitExists(captureToolingSha)) {
      issue("m7n-prior-capture-source-identity-invalid");
    }
    if (attempt.excludedFromPrimaryExperiments !== true || !stringValue(attempt.exclusionReason)) {
      issue("m7n-prior-capture-boundary-not-disclosed");
    }
    if (
      !outcomes ||
      !Number.isInteger(numberValue(outcomes.discovered)) ||
      !Number.isInteger(numberValue(outcomes.passed)) ||
      !Number.isInteger(numberValue(outcomes.unexpected)) ||
      outcomes.retries !== 0
    ) issue("m7n-prior-capture-outcome-summary-invalid");
  }

  const safeReadArtifact = async (artifactPath: unknown, expectedDigest: unknown) => {
    const path = stringValue(artifactPath);
    const digest = stringValue(expectedDigest);
    if (!path || path.startsWith("/") || path.split("/").includes("..") || !digest || !/^[0-9a-f]{64}$/i.test(digest)) {
      issue("m7n-artifact-reference-invalid");
      return null;
    }
    const absolutePath = resolve(root, path);
    const artifactRelative = relative(root, absolutePath);
    if (artifactRelative.startsWith(`..${sep}`) || isAbsolute(artifactRelative)) {
      issue("m7n-artifact-path-outside-repository");
      return null;
    }
    try {
      const bytes = await readFile(absolutePath);
      if (createHash("sha256").update(bytes).digest("hex") !== digest) {
        issue("m7n-artifact-digest-mismatch");
        return null;
      }
      return JSON.parse(bytes.toString("utf8")) as unknown;
    } catch {
      issue("m7n-artifact-unavailable-or-invalid-json");
      return null;
    }
  };

  const experimentsById = new Map<string, JsonRecord>();
  for (const value of asArray(report.experiments)) {
    const experiment = asRecord(value);
    const id = stringValue(experiment?.id);
    if (!experiment || !id || experimentsById.has(id)) {
      issue("m7n-experiment-list-invalid-or-duplicated");
      continue;
    }
    experimentsById.set(id, experiment);
  }
  if (experimentsById.size !== Object.keys(captureContracts).length) issue("m7n-experiment-count-invalid");

  const calculatedMetrics: Record<string, Record<string, number | null>> = {};
  let totalPassed = 0;
  let totalUnexpected = 0;
  let totalSkipped = 0;
  let totalDiscovered = 0;
  let totalTraceEvents = 0;
  let totalDroppedEvents = 0;

  for (const [captureId, contract] of Object.entries(captureContracts)) {
    const experiment = experimentsById.get(captureId);
    if (!experiment) {
      issue("m7n-required-experiment-missing");
      continue;
    }
    const outcomes = asRecord(await safeReadArtifact(experiment.outcomesArtifactPath, experiment.outcomesArtifactSha256));
    if (!outcomes) continue;
    const config = asRecord(outcomes.config);
    const recordedExperiment = asRecord(outcomes.experiment);
    const recordedOutcomes = asRecord(outcomes.outcomes);
    const identities = asArray(recordedExperiment?.selectedIdentities).map(stringValue);
    if (outcomes.schema !== "m7n-playwright-outcomes-v1" || outcomes.captureId !== captureId) issue("m7n-outcome-artifact-schema-or-identity-invalid");
    if (
      outcomes.executionSourceCommitSha !== executionSourceSha ||
      outcomes.toolingSourceCommitSha !== toolingSourceSha ||
      outcomes.normalizerSourceCommitSha !== normalizationSourceSha
    ) issue("m7n-outcome-source-identity-mismatch");
    if (config?.configuredWorkers !== contract.workers || config.configuredRetries !== 0 || config.traceEnabled !== contract.traceEnabled) issue("m7n-workload-configuration-invalid");
    if (recordedExperiment?.maxConcurrentTests !== contract.workers) issue("m7n-measured-concurrency-invalid");
    if (identities.length !== contract.identities.length || identities.some((identity, index) => identity !== contract.identities[index])) {
      issue("m7n-selected-test-identities-invalid");
    }
    if (stringValue(experiment.workload) !== stringValue(recordedExperiment?.workload)) issue("m7n-experiment-workload-mismatch");
    if (experiment.configuredWorkers !== contract.workers || experiment.retries !== 0) issue("m7n-experiment-summary-invalid");

    const testRows = asArray(outcomes.tests).map(asRecord).filter((test): test is JsonRecord => test !== null);
    const targetOutcome = testRows.find((test) => test.identity === contract.identities[0]);
    const expectedSnapshotPhase =
      (captureId === "target-light-peers-w4" || captureId === "target-renderer-heavy-peers-w4") &&
      targetOutcome?.outcome === "unexpected"
        ? "canvas-count-assertion-failure"
        : "after-test";
    if (outcomes.diagnosticSnapshotPhase !== expectedSnapshotPhase) issue("m7n-diagnostic-snapshot-boundary-invalid");
    const counts = { passed: 0, unexpected: 0, skipped: 0, flaky: 0, incomplete: 0 };
    for (const test of testRows) {
      const outcome = stringValue(test.outcome);
      if (outcome && outcome in counts) counts[outcome as keyof typeof counts] += 1;
    }
    for (const [name, count] of Object.entries(counts)) {
      if (recordedOutcomes?.[name] !== count) issue("m7n-test-outcome-counts-inconsistent");
    }
    if (recordedOutcomes?.discovered !== testRows.length || recordedOutcomes?.retries !== 0) issue("m7n-test-inventory-or-retry-count-invalid");
    totalPassed += counts.passed;
    totalUnexpected += counts.unexpected;
    totalSkipped += counts.skipped;
    totalDiscovered += testRows.length;

    const rawCapture = asRecord(outcomes.rawCapture);
    if (!/^[0-9a-f]{64}$/i.test(stringValue(rawCapture?.sha256) ?? "") || !(numberValue(rawCapture?.bytes) && numberValue(rawCapture?.bytes)! > 0)) {
      issue("m7n-raw-capture-provenance-invalid");
    }
    if (rawCapture?.retention !== "private-local-only" || rawCapture.offlineReplayAvailable !== false) issue("m7n-raw-capture-retention-claim-invalid");

    const traceEvidence = asRecord(outcomes.normalizedTrace);
    const tracePath = stringValue(experiment.traceArtifactPath);
    const traceDigest = stringValue(experiment.traceDigest);
    if (experiment.traceArtifactPath !== tracePath || experiment.traceDigest !== traceDigest) issue("m7n-trace-reference-invalid");
    if (traceEvidence?.artifactPath !== tracePath || traceEvidence.sha256 !== traceDigest) issue("m7n-normalized-trace-reference-inconsistent");
    const diagnostics = await safeReadArtifact(tracePath, traceDigest);
    const observed = asRecord(asRecord(diagnostics)?.observed);
    const applicationTrace = asRecord(observed?.applicationTrace);
    if (!diagnostics) continue;
    if (experiment.traceArtifactSha256 !== traceDigest) issue("m7n-trace-report-digest-inconsistent");

    const events = asArray(applicationTrace?.events).map(asRecord).filter((event): event is JsonRecord => event !== null);
    if (contract.traceEnabled) {
      if (traceEvidence?.unavailable !== false || !applicationTrace) issue("m7n-opted-in-trace-unavailable");
      if (applicationTrace?.schemaVersion !== 1 || applicationTrace.capacity !== 512) issue("m7n-trace-schema-or-capacity-invalid");
      const dropped = numberValue(applicationTrace?.droppedEventCount);
      if (dropped === null || dropped < 0 || traceEvidence?.droppedEventCount !== dropped) issue("m7n-trace-overflow-not-disclosed");
      totalTraceEvents += events.length;
      totalDroppedEvents += dropped ?? 0;
      let previousSequence = -1;
      let previousTimestamp = -1;
      const pageId = stringValue(applicationTrace?.pageId);
      const origin = numberValue(applicationTrace?.timeOriginMs);
      for (const event of events) {
        const sequence = numberValue(event.sequence);
        const timestamp = numberValue(event.timestampMs);
        if (event.pageId !== pageId || event.timeOriginMs !== origin || !allowedSurfaces.has(stringValue(event.surface) ?? "")) {
          issue("m7n-trace-event-identity-invalid");
        }
        if (sequence === null || timestamp === null || sequence <= previousSequence || timestamp < previousTimestamp) {
          issue("m7n-trace-event-order-invalid");
        }
        previousSequence = sequence ?? previousSequence;
        previousTimestamp = timestamp ?? previousTimestamp;
      }
      const firstSceneTrace = events.filter((event) => event.sceneId === "architecture-rise");
      const orderedEvents = [
        "workspace-module-load-started",
        "simulator-route-component-committed",
        "workspace-module-load-completed",
      ];
      const rendererEvents = [
        "scene-renderer-component-committed",
        "observer-canvas-dom-attached",
        "observer-renderer-requested",
        "observer-r3f-renderer-created",
        "observer-capabilities-published",
      ];
      for (const lifecycleOrder of [orderedEvents, rendererEvents]) {
        const indexes = lifecycleOrder
        .map((eventName) => firstSceneTrace.findIndex((event) => event.event === eventName))
        .filter((index) => index >= 0);
        if (indexes.some((index, position) => position > 0 && index < (indexes[position - 1] ?? -1))) {
          issue("m7n-observed-lifecycle-order-invalid");
        }
      }
      const groundGlassEvents = events.filter((event) => event.surface === "ground-glass");
      const generationActiveIndex = groundGlassEvents.findIndex((event) => event.event === "ground-glass-generation-active");
      const firstPublishedFrameIndex = groundGlassEvents.findIndex((event) => event.event === "ground-glass-current-frame-published");
      if (
        generationActiveIndex >= 0 &&
        firstPublishedFrameIndex >= 0 &&
        firstPublishedFrameIndex < generationActiveIndex
      ) {
        issue("m7n-ground-glass-publication-order-invalid");
      }
      const observerEventsWithoutGeneration = events.filter((event) =>
        event.surface === "observer" && event.rendererGeneration === null,
      );
      const groundGlassEventsWithoutGeneration = events.filter((event) =>
        event.surface === "ground-glass" &&
        event.rendererGeneration === null &&
        event.event !== "ground-glass-request-accepted" &&
        event.event !== "ground-glass-request-not-active-after-acceptance",
      );
      if (observerEventsWithoutGeneration.length > 0 || groundGlassEventsWithoutGeneration.length > 0) {
        issue("m7n-renderer-generation-identity-missing");
      }
      if (traceEvidence?.eventCount !== events.length) issue("m7n-trace-event-count-inconsistent");
      const milestones = asRecord(observed?.pageNavigationAndLongTaskTiming);
      const pageMilestones = asArray(milestones?.lifecycleMilestones).map(asRecord).filter((event): event is JsonRecord => event !== null);
      const timeOf = (name: string) => numberValue(pageMilestones.find((event) => event.event === name)?.timestampMs);
      const startTime = timeOf("document-start-observed") ?? numberValue(asRecord(pageMilestones[0])?.timestampMs);
      const elapsedFromNavigation = (eventName: string) => {
        const eventTime = timeOf(eventName);
        return startTime === null || eventTime === null ? null : eventTime - startTime;
      };
      calculatedMetrics[captureId] = {
        workspaceMountedMs: elapsedFromNavigation("workspace-dom-mounted"),
        canvasDomAttachedMs: elapsedFromNavigation("observer-canvas-dom-attached"),
        rendererActiveMs: elapsedFromNavigation("observer-status-active"),
      };
    } else {
      if (traceEvidence?.unavailable !== true || applicationTrace !== null) issue("m7n-trace-disabled-capture-has-telemetry");
      const milestones = asRecord(observed?.pageNavigationAndLongTaskTiming);
      const pageMilestones = asArray(milestones?.lifecycleMilestones).map(asRecord).filter((event): event is JsonRecord => event !== null);
      const timeOf = (name: string) => numberValue(pageMilestones.find((event) => event.event === name)?.timestampMs);
      const startTime = timeOf("document-start-observed") ?? numberValue(asRecord(pageMilestones[0])?.timestampMs);
      const elapsedFromNavigation = (eventName: string) => {
        const eventTime = timeOf(eventName);
        return startTime === null || eventTime === null ? null : eventTime - startTime;
      };
      calculatedMetrics[captureId] = {
        workspaceMountedMs: elapsedFromNavigation("workspace-dom-mounted"),
        canvasDomAttachedMs: elapsedFromNavigation("observer-canvas-dom-attached"),
        rendererActiveMs: elapsedFromNavigation("observer-status-active"),
      };
    }
    if (experiment.eventCount !== (traceEvidence?.eventCount ?? 0) || experiment.droppedEventCount !== (traceEvidence?.droppedEventCount ?? 0)) {
      issue("m7n-trace-count-summary-invalid");
    }
  }

  for (const captureId of Object.keys(captureContracts)) {
    if (!calculatedMetrics[captureId]) issue("m7n-instrumentation-overhead-capture-missing");
  }
  const comparison = asRecord(report.comparison);
  const overhead = asRecord(comparison?.instrumentationOverhead);
  for (const metricName of ["workspaceMountedMs", "canvasDomAttachedMs", "rendererActiveMs"] as const) {
    for (const captureId of ["target-solo-w1-trace-off", "target-solo-w1-trace-on"]) {
      const reported = numberValue(asRecord(asRecord(overhead?.[captureId])?.timings)?.[metricName]);
      const calculated = calculatedMetrics[captureId]?.[metricName] ?? null;
      if (reported !== calculated) issue("m7n-instrumentation-overhead-metrics-inconsistent");
    }
  }

  const spaProbeRecord = asRecord(report.spaTransition);
  const spaProbe = await safeReadArtifact(spaProbeRecord?.artifactPath, spaProbeRecord?.sha256);
  const spaRecord = asRecord(spaProbe);
  if (!spaRecord || spaRecord.experimentId !== "spa-a-b-a-generation-probe") issue("m7n-spa-generation-probe-invalid");
  if (spaRecord && (spaRecord.sourceCommitSha !== toolingSourceSha || spaRecord.traceEnabled !== true)) issue("m7n-spa-probe-source-or-tracing-invalid");
  if (spaRecord && JSON.stringify(spaRecord.activeObserverSceneSequence) !== JSON.stringify(["architecture-rise", "macro-bellows-extension", "architecture-rise"])) {
    issue("m7n-spa-scene-sequence-invalid");
  }
  if (spaRecord) {
    const identities = asArray(spaRecord.distinctArchitectureRiseMountIdentities);
    if (identities.length < 2 || identities[0] === identities[identities.length - 1]) issue("m7n-spa-mount-identities-not-distinct");
    if (numberValue(spaRecord.traceDroppedEventCount) === null) issue("m7n-spa-trace-overflow-not-reported");
  }

  const diagnosis = asRecord(report.diagnosis);
  if (diagnosis?.rootCause !== "unresolved") issue("m7n-causal-claim-exceeds-evidence");
  if (asArray(asRecord(report.remediation)?.verifiedFixes).length !== 0) issue("m7n-unverified-remediation-claim");
  const qualification = asRecord(report.qualification);
  if (qualification?.fullBroadE2e !== "not-run" || qualification.broadE2eQualification !== "not-qualified") issue("m7n-broad-e2e-qualification-boundary-invalid");
  if (qualification?.m7Overall !== "partially-qualified" || qualification.m8Entry !== "denied") issue("m7n-milestone-authorization-boundary-invalid");
  if (qualification?.productionGroundGlass !== "webgl-only" || qualification.productionWebGpu !== "disabled") issue("m7n-production-renderer-boundary-invalid");
  if (qualification?.spontaneousExternalGpuDeviceLoss !== "blocked") issue("m7n-gpu-device-loss-boundary-invalid");

  const instrumentation = asRecord(report.instrumentation);
  if (instrumentation?.eventSchemaVersion !== 1 || instrumentation.eventBufferCapacity !== 512) issue("m7n-instrumentation-contract-invalid");
  if (instrumentation?.productionDisabled !== true || instrumentation.enabledCondition !== "import.meta.env.DEV && VITE_M7N_RENDERER_LIFECYCLE_TRACE=true") {
    issue("m7n-instrumentation-gate-invalid");
  }

  const summary = {
    evaluatorRevision,
    experimentCount: experimentsById.size,
    discovered: totalDiscovered,
    passed: totalPassed,
    unexpected: totalUnexpected,
    skipped: totalSkipped,
    traceEvents: totalTraceEvents,
    droppedEvents: totalDroppedEvents,
    broadE2eQualification: qualification?.broadE2eQualification ?? null,
    m7Overall: qualification?.m7Overall ?? null,
    m8Entry: qualification?.m8Entry ?? null,
  };
  return { passed: issues.size === 0, issues: [...issues].sort(), summary };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reportArgument = process.argv.slice(2).find((argument) => argument.startsWith("--report-path="));
  const reportPath = reportArgument?.slice("--report-path=".length) ?? "docs/architecture/GROUND_GLASS_M7N_RENDERER_LIFECYCLE_REPORT.json";
  const result = await evaluateM7nRendererLifecycleEvidence(reportPath);
  console.log(`M7N evidence integrity: ${result.passed ? "PASS" : "FAIL"}`);
  console.log(JSON.stringify(result.summary, null, 2));
  if (!result.passed) {
    for (const issueName of result.issues) console.error(`- ${issueName}`);
    process.exitCode = 1;
  }
}
