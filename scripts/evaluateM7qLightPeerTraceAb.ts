import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";

export const M7Q_EVALUATOR_REVISION = "m7q-light-peer-trace-ab-evaluator-v1";

type JsonRecord = Record<string, unknown>;
type DeadlineInterval = { lowerMs: number; upperMs: number };

const expectedTests = [
  { file: "architecture-rise-focus-range.spec.ts", title: "Architecture Rise focus control stays within scene depth and preserves thin-lens extension", role: "target" },
  { file: "home.spec.ts", title: "concept learning sections keep their responsive grids without overflow", role: "light-peer" },
  { file: "simulator-header.spec.ts", title: "keeps the active lesson context between the brand and desktop actions", role: "light-peer" },
  { file: "smoke.spec.ts", title: "smoke: app boots at home", role: "light-peer" },
];
const expectedTestKeys = expectedTests.map(({ file, title }) => `${file}::${title}`).sort();
const expectedPairs = [
  { pairId: "pair-1", order: ["off", "on"] },
  { pairId: "pair-2", order: ["on", "off"] },
  { pairId: "pair-3", order: ["on", "off"] },
  { pairId: "pair-4", order: ["off", "on"] },
];
const expectedCaptureIds = expectedPairs.flatMap(({ pairId, order }) => order.map((arm) => `m7q-${pairId}-${arm}`));
const expectedCaptureSourcePaths = [
  "playwright.config.ts",
  "src/tests/e2e/architecture-rise-focus-range.spec.ts",
  "src/tests/e2e/home.spec.ts",
  "src/tests/e2e/simulator-header.spec.ts",
  "src/tests/e2e/smoke.spec.ts",
  "src/tests/e2e/helpers/m7pAssertionSchedulingCapture.ts",
  "scripts/run-m7q-light-peer-trace-ab.mjs",
];
const expectedEvaluatorSourcePaths = [
  "scripts/normalizeM7qLightPeerTraceAb.mjs",
  "scripts/evaluateM7qLightPeerTraceAb.ts",
  "scripts/run-m7q-evidence.mjs",
  "src/tests/unit/m7qLightPeerTraceAbEvidence.test.ts",
];
const deadlineToleranceMs = 0.001;
const taskEndpointToleranceMs = 0.002;
const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const sha256Pattern = /^[0-9a-f]{64}$/;
const commitPattern = /^[0-9a-f]{40}$/;
const approximatelyEqual = (left: unknown, right: number, tolerance = 0.01) => finite(left) && Math.abs(left - right) <= tolerance;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const nested = (value: unknown, ...keys: string[]): unknown => keys.reduce<unknown>((current, key) => isRecord(current) ? current[key] : undefined, value);

export const deriveM7qDeadlineInterval = (input: {
  browserAnchorMs: number;
  nodeRequestStartedAtMs: number;
  nodeResponseSettledAtMs: number;
  nodeAssertionEntryMs: number;
  timeoutBudgetMs: number;
}): { valid: boolean; lowerMs: number | null; upperMs: number | null; roundTripMs: number | null } => {
  const { browserAnchorMs, nodeRequestStartedAtMs, nodeResponseSettledAtMs, nodeAssertionEntryMs, timeoutBudgetMs } = input;
  const validInputs = [browserAnchorMs, nodeRequestStartedAtMs, nodeResponseSettledAtMs, nodeAssertionEntryMs, timeoutBudgetMs].every(Number.isFinite)
    && nodeResponseSettledAtMs >= nodeRequestStartedAtMs
    && nodeAssertionEntryMs >= nodeResponseSettledAtMs
    && timeoutBudgetMs >= 0;
  if (!validInputs) return { valid: false, lowerMs: null, upperMs: null, roundTripMs: null };
  const roundTripMs = nodeResponseSettledAtMs - nodeRequestStartedAtMs;
  const browserAssertionEntryLowerMs = browserAnchorMs + nodeAssertionEntryMs - nodeResponseSettledAtMs;
  const lowerMs = browserAssertionEntryLowerMs + timeoutBudgetMs;
  const upperMs = lowerMs + roundTripMs;
  return {
    valid: Number.isFinite(lowerMs) && Number.isFinite(upperMs) && lowerMs <= upperMs,
    lowerMs,
    upperMs,
    roundTripMs,
  };
};

export const classifyM7qCanvasObservation = (observationMs: number, interval: DeadlineInterval, tolerance = deadlineToleranceMs) => {
  if (!Number.isFinite(observationMs) || !Number.isFinite(interval.lowerMs) || !Number.isFinite(interval.upperMs) || interval.lowerMs > interval.upperMs) {
    return "unavailable-or-uncertain";
  }
  if (observationMs < interval.lowerMs - tolerance) return "observed-before-deadline";
  if (observationMs > interval.upperMs + tolerance) return "observed-after-deadline";
  return "deadline-interval-uncertain";
};

export const classifyM7qTaskDeadlineRelationship = (task: {
  startPageLowerMs: number;
  startPageUpperMs: number;
  endPageLowerMs: number;
  endPageUpperMs: number;
}, deadline: DeadlineInterval) => {
  if (![task.startPageLowerMs, task.startPageUpperMs, task.endPageLowerMs, task.endPageUpperMs, deadline.lowerMs, deadline.upperMs].every(Number.isFinite)
    || task.startPageLowerMs > task.startPageUpperMs
    || task.endPageLowerMs > task.endPageUpperMs
    || deadline.lowerMs > deadline.upperMs) return "unverifiable";
  if (task.startPageUpperMs <= deadline.lowerMs && task.endPageLowerMs >= deadline.upperMs) return "definitely-spans-deadline-interval";
  if (task.startPageLowerMs <= deadline.upperMs && task.endPageUpperMs >= deadline.lowerMs) return "possibly-overlaps-deadline";
  return "does-not-overlap-deadline";
};

export const deriveM7qFourWorkerOverlap = (intervals: unknown[]) => {
  if (intervals.length !== 4) return { valid: false, peakConcurrency: null, workerIds: [], overlap: null };
  const rows = intervals.map((value) => {
    const row = isRecord(value) ? value : {};
    const startMs = row.startEpochMs;
    const durationMs = row.durationMs;
    return {
      identity: row.identity,
      startEpochMs: startMs,
      durationMs,
      endEpochMs: row.endEpochMs,
      workerIndex: row.workerIndex,
      parallelIndex: row.parallelIndex,
    };
  });
  const allValid = rows.every((row) => finite(row.startEpochMs)
    && finite(row.durationMs) && row.durationMs > 0
    && finite(row.endEpochMs) && approximatelyEqual(row.endEpochMs, row.startEpochMs + row.durationMs, 0.01)
    && Number.isSafeInteger(row.workerIndex) && (row.workerIndex as number) >= 0
    && Number.isSafeInteger(row.parallelIndex) && (row.parallelIndex as number) >= 0
    && typeof row.identity === "string");
  if (!allValid) return { valid: false, peakConcurrency: null, workerIds: [], overlap: null };
  const events = rows.flatMap((row) => [
    { atMs: row.startEpochMs as number, delta: 1 },
    { atMs: row.endEpochMs as number, delta: -1 },
  ]).sort((left, right) => left.atMs - right.atMs || left.delta - right.delta);
  let active = 0;
  let peakConcurrency = 0;
  for (const event of events) {
    active += event.delta;
    peakConcurrency = Math.max(peakConcurrency, active);
  }
  const startEpochMs = Math.max(...rows.map((row) => row.startEpochMs as number));
  const endEpochMs = Math.min(...rows.map((row) => row.endEpochMs as number));
  const activeRows = endEpochMs > startEpochMs
    ? rows.filter((row) => (row.startEpochMs as number) <= startEpochMs && (row.endEpochMs as number) >= endEpochMs)
    : [];
  const workerIds = [...new Set(activeRows.map((row) => row.workerIndex as number))].sort((left, right) => left - right);
  const parallelIds = [...new Set(activeRows.map((row) => row.parallelIndex as number))].sort((left, right) => left - right);
  const testIdentities = activeRows.map((row) => row.identity as string).sort();
  const overlap = {
    active: endEpochMs > startEpochMs && activeRows.length === 4 && workerIds.length === 4 && parallelIds.length === 4,
    startEpochMs,
    endEpochMs,
    durationMs: Math.max(0, endEpochMs - startEpochMs),
    workerIds,
    parallelIds,
    testIdentities,
    targetParticipated: testIdentities.includes(expectedTestKeys[0]),
  };
  return { valid: true, peakConcurrency, workerIds, overlap };
};

const extractPlaywrightResults = (suites: unknown[]): JsonRecord[] => {
  const rows: JsonRecord[] = [];
  for (const item of suites) {
    if (!isRecord(item)) continue;
    const specs = asArray(item.specs);
    for (const specValue of specs) {
      if (!isRecord(specValue)) continue;
      for (const testValue of asArray(specValue.tests)) {
        if (!isRecord(testValue)) continue;
        for (const resultValue of asArray(testValue.results)) {
          if (!isRecord(resultValue)) continue;
          const fileValue = specValue.file;
          const file = typeof fileValue === "string" ? fileValue.split(/[\\/]/).at(-1) : null;
          const startTime = resultValue.startTime;
          rows.push({
            file,
            title: specValue.title,
            projectName: testValue.projectName,
            status: resultValue.status,
            retry: resultValue.retry,
            durationMs: resultValue.duration,
            startTime,
            startEpochMs: typeof startTime === "string" ? Date.parse(startTime) : null,
            workerIndex: resultValue.workerIndex,
            parallelIndex: resultValue.parallelIndex,
            expectedStatus: testValue.expectedStatus,
            errorMessages: asArray(resultValue.errors).map((error) => isRecord(error) ? error.message ?? "" : "").slice(0, 2),
          });
        }
      }
    }
    rows.push(...extractPlaywrightResults(asArray(item.suites)));
  }
  return rows;
};

const getExpectedPairSchedule = () => expectedPairs.flatMap(({ pairId, order }) => order.map((arm) => ({
  captureId: `m7q-${pairId}-${arm}`,
  pairId,
  arm,
  order,
  orderIndex: order.indexOf(arm),
})));

const compareNumber = (actual: unknown, expected: number, label: string, issues: string[], tolerance = 0.01) => {
  if (!approximatelyEqual(actual, expected, tolerance)) issues.push(`${label}-inconsistent`);
};

export const evaluateM7qLightPeerTraceAb = (reportValue: unknown, capturesValue: unknown) => {
  const issues: string[] = [];
  const report = isRecord(reportValue) ? reportValue : {};
  const captures = isRecord(capturesValue) ? capturesValue : {};
  const add = (issue: string) => { if (!issues.includes(issue)) issues.push(issue); };

  if (report.schemaVersion !== 1 || report.evaluatorRevision !== M7Q_EVALUATOR_REVISION) add("m7q-evidence-schema-or-revision-invalid");
  if (captures.schemaVersion !== 1 || captures.evidenceId !== "m7q-matched-light-peer-trace-ab-v1") add("m7q-normalized-capture-schema-invalid");
  const provenance = isRecord(report.provenance) ? report.provenance : {};
  const captureSourceSha = provenance.captureRunnerSourceCommit;
  const analysisSourceSha = provenance.analysisToolingSourceCommit;
  if (typeof captureSourceSha !== "string" || !commitPattern.test(captureSourceSha)
    || captures.captureSourceCommit !== captureSourceSha) add("m7q-capture-source-provenance-invalid");
  if (typeof analysisSourceSha !== "string" || !commitPattern.test(analysisSourceSha)) add("m7q-analysis-source-provenance-invalid");
  if (JSON.stringify(provenance.captureRunnerSourcePaths) !== JSON.stringify(expectedCaptureSourcePaths)) add("m7q-capture-source-tree-contract-invalid");
  if (JSON.stringify(provenance.analysisToolingSourcePaths) !== JSON.stringify(expectedEvaluatorSourcePaths)) add("m7q-analysis-source-tree-contract-invalid");
  if (typeof provenance.normalizedCapturesSha256 !== "string" || !sha256Pattern.test(provenance.normalizedCapturesSha256)) add("m7q-normalized-capture-digest-invalid");

  const attempts = asArray(captures.attempts).filter(isRecord);
  const schedule = getExpectedPairSchedule();
  if (attempts.length !== 8) add("m7q-planned-attempt-count-invalid");
  const seenCaptureIds = attempts.map((attempt) => attempt.captureId);
  if (new Set(seenCaptureIds).size !== 8 || expectedCaptureIds.some((id) => !seenCaptureIds.includes(id))) add("m7q-attempt-identities-missing-or-duplicated");
  if (JSON.stringify(asArray(captures.plannedPairs)) !== JSON.stringify(expectedPairs)) add("m7q-pair-order-contract-invalid");
  if (JSON.stringify(asArray(captures.expectedTests)) !== JSON.stringify(expectedTests)) add("m7q-selected-test-identity-contract-invalid");

  for (const [index, expected] of schedule.entries()) {
    const attempt = attempts[index];
    if (!attempt) continue;
    if (attempt.captureId !== expected.captureId || attempt.pairId !== expected.pairId || attempt.arm !== expected.arm
      || attempt.orderIndex !== expected.orderIndex || JSON.stringify(attempt.executionOrder) !== JSON.stringify(expected.order)) {
      add(`m7q-attempt-${expected.captureId}-pair-order-invalid`);
    }
    if (attempt.tracingEnabled !== (expected.arm === "on") || attempt.cdpSessionCreated !== true
      || attempt.browserSideInstrumentationEnabled !== true || attempt.configuredWorkers !== 4
      || attempt.retriesConfigured !== 0 || attempt.webGlMode !== "application-default-WebGL") {
      add(`m7q-attempt-${expected.captureId}-control-configuration-invalid`);
    }
    if (attempt.sourceCommit !== captureSourceSha) add(`m7q-attempt-${expected.captureId}-source-identity-invalid`);
    const validity = isRecord(attempt.validity) ? attempt.validity : {};
    if (validity.validForComparison !== true) add(`m7q-attempt-${expected.captureId}-capture-invalid`);
    const portCleanup = isRecord(attempt.portCleanup) ? attempt.portCleanup : {};
    if (portCleanup.closedBeforeRun !== true || portCleanup.closedAfterRun !== true) add(`m7q-attempt-${expected.captureId}-server-cleanup-invalid`);

    const outcomes = isRecord(attempt.outcomes) ? attempt.outcomes : {};
    const results = asArray(outcomes.tests).filter(isRecord);
    const identities = results.map((test) => `${String(test.file)}::${String(test.title)}`).sort();
    if (JSON.stringify(identities) !== JSON.stringify(expectedTestKeys) || outcomes.identitiesMatch !== true) add(`m7q-attempt-${expected.captureId}-test-inventory-invalid`);
    if (results.some((test) => test.projectName !== "chromium" || test.retry !== 0)) add(`m7q-attempt-${expected.captureId}-project-or-retry-invalid`);
    if (results.length !== 4 || results.some((test) => !finite(test.durationMs) || test.durationMs <= 0
      || !finite(test.startEpochMs) || !Number.isSafeInteger(test.workerIndex) || !Number.isSafeInteger(test.parallelIndex))) {
      add(`m7q-attempt-${expected.captureId}-test-interval-invalid`);
    }
    const workerExecution = isRecord(attempt.workerExecution) ? attempt.workerExecution : {};
    const derivedOverlap = deriveM7qFourWorkerOverlap(asArray(workerExecution.intervals));
    const declaredOverlap = isRecord(workerExecution.fourTestOverlap) ? workerExecution.fourTestOverlap : {};
    if (!derivedOverlap.valid || !derivedOverlap.overlap?.active || workerExecution.valid !== true
      || workerExecution.configuredWorkers !== 4 || workerExecution.peakConcurrency !== derivedOverlap.peakConcurrency
      || JSON.stringify(workerExecution.actualWorkerIds) !== JSON.stringify(derivedOverlap.workerIds)
      || JSON.stringify(declaredOverlap.workerIds) !== JSON.stringify(derivedOverlap.overlap?.workerIds)
      || JSON.stringify(declaredOverlap.testIdentities) !== JSON.stringify(derivedOverlap.overlap?.testIdentities)
      || declaredOverlap.targetParticipated !== true || declaredOverlap.active !== true) {
      add(`m7q-attempt-${expected.captureId}-four-worker-overlap-invalid`);
    } else {
      compareNumber(declaredOverlap.startEpochMs, derivedOverlap.overlap.startEpochMs, `m7q-attempt-${expected.captureId}-overlap-start`, issues);
      compareNumber(declaredOverlap.endEpochMs, derivedOverlap.overlap.endEpochMs, `m7q-attempt-${expected.captureId}-overlap-end`, issues);
      compareNumber(declaredOverlap.durationMs, derivedOverlap.overlap.durationMs, `m7q-attempt-${expected.captureId}-overlap-duration`, issues);
    }

    const assertion = isRecord(attempt.assertion) ? attempt.assertion : {};
    const targetResult = results.find((test) => test.file === expectedTests[0].file && test.title === expectedTests[0].title);
    if (assertion.outcome !== targetResult?.status || outcomes.target !== targetResult?.status || outcomes.targetAssertion !== targetResult?.status
      || outcomes.targetOutcomeConsistent !== true) add(`m7q-attempt-${expected.captureId}-target-outcome-inconsistent`);
    if (assertion.timeoutBudgetMs !== 5_000 || !finite(assertion.nodeEntryMs) || !finite(assertion.nodeSettledMs)
      || !approximatelyEqual(assertion.elapsedMs, assertion.nodeSettledMs - assertion.nodeEntryMs, 0.01)
      || !approximatelyEqual(assertion.nodeInferredDeadlineMs, assertion.nodeEntryMs + 5_000, 0.01)) {
      add(`m7q-attempt-${expected.captureId}-assertion-timing-invalid`);
    }
    const publicEvaluations = asArray(assertion.publicEvaluations).filter(isRecord);
    const entryAnchor = publicEvaluations.find((evaluation) => evaluation.label === "assertion-entry-anchor");
    const deadline = isRecord(assertion.deadlineInterval) ? assertion.deadlineInterval : {};
    const derivedDeadline = entryAnchor && finite(entryAnchor.browserMonotonicMs)
      && finite(entryAnchor.requestStartedAtMs) && finite(entryAnchor.responseSettledAtMs) && finite(assertion.nodeEntryMs)
      ? deriveM7qDeadlineInterval({
          browserAnchorMs: entryAnchor.browserMonotonicMs,
          nodeRequestStartedAtMs: entryAnchor.requestStartedAtMs,
          nodeResponseSettledAtMs: entryAnchor.responseSettledAtMs,
          nodeAssertionEntryMs: assertion.nodeEntryMs,
          timeoutBudgetMs: 5_000,
        })
      : { valid: false, lowerMs: null, upperMs: null, roundTripMs: null };
    if (!derivedDeadline.valid || deadline.valid !== true || deadline.clockDomain !== "browser-page-performance-monotonic-ms"
      || deadline.anchorKind !== "public-evaluation-request-response-bracket"
      || !finite(deadline.deadlineLowerMs) || !finite(deadline.deadlineUpperMs)
      || deadline.deadlineLowerMs > deadline.deadlineUpperMs
      || deadline.roundingToleranceMs !== deadlineToleranceMs) {
      add(`m7q-attempt-${expected.captureId}-deadline-interval-invalid`);
    } else {
      compareNumber(deadline.deadlineLowerMs, derivedDeadline.lowerMs as number, `m7q-attempt-${expected.captureId}-deadline-lower`, issues, 0.00001);
      compareNumber(deadline.deadlineUpperMs, derivedDeadline.upperMs as number, `m7q-attempt-${expected.captureId}-deadline-upper`, issues, 0.00001);
      compareNumber(deadline.anchorRoundTripMs, derivedDeadline.roundTripMs as number, `m7q-attempt-${expected.captureId}-deadline-rtt`, issues, 0.00001);
    }
    const browserObservations = isRecord(attempt.browserObservations) ? attempt.browserObservations : {};
    const canvas = isRecord(browserObservations.firstConnectedCanvas) ? browserObservations.firstConnectedCanvas : {};
    const canvasClass = classifyM7qCanvasObservation(canvas.browserMonotonicMs as number, {
      lowerMs: deadline.deadlineLowerMs as number,
      upperMs: deadline.deadlineUpperMs as number,
    }, deadline.roundingToleranceMs as number);
    if (!finite(canvas.browserMonotonicMs) || canvasClass !== browserObservations.canvasDeadlineClassification
      || canvasClass !== "observed-before-deadline") add(`m7q-attempt-${expected.captureId}-canvas-deadline-classification-invalid`);
    if (browserObservations.lifecycleMutationObserverAvailable !== true || browserObservations.longTaskObserverAvailable !== true
      || !Array.isArray(browserObservations.longTasks) || !Array.isArray(browserObservations.pageHeartbeat)
      || !Array.isArray(browserObservations.nodeHeartbeatDuringAssertionWindow)) add(`m7q-attempt-${expected.captureId}-browser-instrumentation-incomplete`);

    const trace = isRecord(attempt.trace) ? attempt.trace : {};
    if (expected.arm === "off") {
      if (trace.enabled !== false || trace.started !== false || trace.completed !== false || trace.dataLossOccurred !== null
        || trace.retainedPath !== null || trace.rawSha256 !== null || nested(trace, "rendererEvidence", "reason") !== "tracing-disabled") {
        add(`m7q-attempt-${expected.captureId}-trace-off-contract-invalid`);
      }
    } else {
      const renderer = isRecord(trace.rendererEvidence) ? trace.rendererEvidence : {};
      const attribution = isRecord(renderer.targetRenderer) ? renderer.targetRenderer : {};
      const tasks = asArray(renderer.rendererMainTasks).filter(isRecord);
      const taskCounts: Record<string, number> = {};
      let definiteCount = 0;
      for (const task of tasks) {
        const expectedRelation = classifyM7qTaskDeadlineRelationship({
          startPageLowerMs: task.startPageLowerMs as number,
          startPageUpperMs: task.startPageUpperMs as number,
          endPageLowerMs: task.endPageLowerMs as number,
          endPageUpperMs: task.endPageUpperMs as number,
        }, { lowerMs: deadline.deadlineLowerMs as number, upperMs: deadline.deadlineUpperMs as number });
        const duration = finite(task.traceStartMs) && finite(task.traceEndMs) ? task.traceEndMs - task.traceStartMs : Number.NaN;
        if (!finite(task.traceStartMs) || !finite(task.traceEndMs) || !finite(task.traceDurationMs) || task.traceDurationMs <= 0
          || task.traceStartMs > task.traceEndMs
          || !approximatelyEqual(duration, task.traceDurationMs, taskEndpointToleranceMs)
          || !finite(task.startPageLowerMs) || !finite(task.startPageUpperMs) || task.startPageLowerMs > task.startPageUpperMs
          || !finite(task.endPageLowerMs) || !finite(task.endPageUpperMs) || task.endPageLowerMs > task.endPageUpperMs
          || task.processId !== attribution.processId || task.threadId !== attribution.mainThreadId
          || task.deadlineRelationship !== expectedRelation || expectedRelation === "unverifiable") {
          add(`m7q-attempt-${expected.captureId}-trace-task-evidence-invalid`);
        }
        taskCounts[expectedRelation] = (taskCounts[expectedRelation] ?? 0) + 1;
        if (expectedRelation === "definitely-spans-deadline-interval") definiteCount += 1;
      }
      if (trace.enabled !== true || trace.started !== true || trace.completed !== true || trace.dataLossOccurred !== false
        || trace.stopError !== null || trace.overflowedByCollector !== false
        || typeof trace.rawSha256 !== "string" || !sha256Pattern.test(trace.rawSha256)
        || !finite(trace.rawSizeBytes) || trace.rawSizeBytes <= 0
        || typeof trace.retainedPath !== "string" || !trace.retainedPath.startsWith("raw/")
        || typeof trace.retainedGzipSha256 !== "string" || !sha256Pattern.test(trace.retainedGzipSha256)
        || renderer.valid !== true || !finite(renderer.pageAnchors) || renderer.pageAnchors < 2 || attribution.threadName !== "CrRendererMain"
        || !Number.isSafeInteger(attribution.processId) || !Number.isSafeInteger(attribution.mainThreadId)
        || definiteCount < 1 || renderer.rendererMainTaskCount !== tasks.length
        || JSON.stringify(renderer.deadlineTaskCounts) !== JSON.stringify(taskCounts)) {
        add(`m7q-attempt-${expected.captureId}-trace-evidence-invalid`);
      }
    }

    const rawArtifacts = isRecord(attempt.rawArtifacts) ? attempt.rawArtifacts : {};
    for (const artifactKind of expected.arm === "on" ? ["playwrightReport", "m7pCapture"] : ["playwrightReport", "m7pCapture"]) {
      const artifact = isRecord(rawArtifacts[artifactKind]) ? rawArtifacts[artifactKind] : {};
      if (typeof artifact.retainedPath !== "string" || !artifact.retainedPath.startsWith("raw/")
        || typeof artifact.sha256 !== "string" || !sha256Pattern.test(artifact.sha256)
        || !finite(artifact.sizeBytes) || artifact.sizeBytes <= 0) add(`m7q-attempt-${expected.captureId}-${artifactKind}-digest-metadata-invalid`);
    }
    if (expected.arm === "on" && !isRecord(rawArtifacts.chromiumTraceGzip)) {
      // The trace descriptor is represented by the trace object to keep raw trace provenance next to its event summary.
      if (typeof trace.retainedPath !== "string" || typeof trace.retainedGzipSha256 !== "string") add(`m7q-attempt-${expected.captureId}-trace-digest-metadata-invalid`);
    }
  }

  const comparison = isRecord(report.comparison) ? report.comparison : {};
  const byArm = isRecord(comparison.outcomesByArm) ? comparison.outcomesByArm : {};
  const derivedCounts = Object.fromEntries(["off", "on"].map((arm) => {
    const matching = attempts.filter((attempt) => attempt.arm === arm);
    return [arm, {
      attempts: matching.length,
      targetPassed: matching.filter((attempt) => nested(attempt, "outcomes", "target") === "passed").length,
      targetFailed: matching.filter((attempt) => nested(attempt, "outcomes", "target") === "failed").length,
      valid: matching.filter((attempt) => nested(attempt, "validity", "validForComparison") === true).length,
    }];
  }));
  if (JSON.stringify(byArm) !== JSON.stringify(derivedCounts)) add("m7q-arm-outcome-summary-inconsistent");
  const allPeersPassed = attempts.length === 8 && attempts.every((attempt) => {
    const rows = asArray(nested(attempt, "outcomes", "tests")).filter(isRecord);
    return rows.filter((test) => test.file !== expectedTests[0].file).length === 3
      && rows.filter((test) => test.file !== expectedTests[0].file).every((test) => test.status === "passed");
  });
  if (!allPeersPassed || attempts.some((attempt) => nested(attempt, "outcomes", "target") !== "failed")) add("m7q-arm-outcome-matrix-invalid");

  const summarize = (values: number[]) => values.length === 0 ? null : ({
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
  });
  const timing = isRecord(comparison.descriptiveTiming) ? comparison.descriptiveTiming : {};
  for (const arm of ["off", "on"] as const) {
    const armAttempts = attempts.filter((attempt) => attempt.arm === arm);
    const assertionStats = summarize(armAttempts.map((attempt) => nested(attempt, "assertion", "elapsedMs")).filter(finite));
    const longTaskStats = summarize(armAttempts.map((attempt) => nested(attempt, "browserObservations", "largestLongTaskDuringAssertionWindowMs")).filter(finite));
    const browserHeartbeatStats = summarize(armAttempts.map((attempt) => nested(attempt, "browserObservations", "maximumPageHeartbeatDelayDuringAssertionWindowMs")).filter(finite));
    const nodeHeartbeatStats = summarize(armAttempts.map((attempt) => nested(attempt, "browserObservations", "maximumNodeHeartbeatDelayDuringAssertionWindowMs")).filter(finite));
    const overlapStats = summarize(armAttempts.map((attempt) => nested(attempt, "workerExecution", "fourTestOverlap", "durationMs")).filter(finite));
    for (const [metricKey, derived] of [
      ["assertionEntryToSettlementMs", assertionStats],
      ["largestBrowserLongTaskDuringAssertionWindowMs", longTaskStats],
      ["maximumBrowserHeartbeatGapDuringAssertionWindowMs", browserHeartbeatStats],
      ["maximumNodeHeartbeatIntervalDuringAssertionWindowMs", nodeHeartbeatStats],
      ["fourTestOverlapDurationMs", overlapStats],
    ] as const) {
      const declaredArmStats = nested(timing, metricKey, arm);
      if (!derived || !isRecord(declaredArmStats)) {
        add(`m7q-${arm}-${metricKey}-summary-missing`);
      } else {
        const tolerance = metricKey === "largestBrowserLongTaskDuringAssertionWindowMs" ? 1.01 : 0.02;
        compareNumber(declaredArmStats.minimum, derived.minimum, `m7q-${arm}-${metricKey}-minimum`, issues, tolerance);
        compareNumber(declaredArmStats.maximum, derived.maximum, `m7q-${arm}-${metricKey}-maximum`, issues, tolerance);
        if (finite(declaredArmStats.mean)) compareNumber(declaredArmStats.mean, derived.mean, `m7q-${arm}-${metricKey}-mean`, issues, tolerance);
      }
    }
  }
  const traceOnAttempts = attempts.filter((attempt) => attempt.arm === "on");
  if (nested(comparison, "traceOnOnly", "completeTraces") !== traceOnAttempts.filter((attempt) => nested(attempt, "trace", "completed") === true).length
    || nested(comparison, "traceOnOnly", "dataLossOrTruncation") !== traceOnAttempts.filter((attempt) => nested(attempt, "trace", "dataLossOccurred") !== false || nested(attempt, "trace", "overflowedByCollector") !== false).length
    || nested(comparison, "traceOnOnly", "attributedCrRendererMain") !== traceOnAttempts.filter((attempt) => nested(attempt, "trace", "rendererEvidence", "targetRenderer", "threadName") === "CrRendererMain").length
    || nested(comparison, "traceOnOnly", "capturesWithAtLeastOneTaskDefinitelySpanningDeadlineInterval") !== traceOnAttempts.filter((attempt) => asArray(nested(attempt, "trace", "rendererEvidence", "rendererMainTasks")).some((task) => nested(task, "deadlineRelationship") === "definitely-spans-deadline-interval")).length) {
    add("m7q-trace-summary-inconsistent");
  }
  const primaryFinding = isRecord(report.primaryFinding) ? report.primaryFinding : {};
  if (primaryFinding.decisionPath !== "B"
    || primaryFinding.traceRequirement !== "CDP tracing is not required to reproduce the target failure under this tested configuration"
    || primaryFinding.rendererSpecificCausation !== "unresolved"
    || primaryFinding.gpuSaturationEstablished !== false
    || primaryFinding.matcherInternalRetryScheduleKnown !== false
    || primaryFinding.browserMainThreadSchedulingPressureObserved !== true
    || primaryFinding.applicationLifecycleDefectEstablished !== false
    || primaryFinding.testReadinessContractProvenInvalid !== false) add("m7q-primary-causal-claim-unsupported");
  if (comparison.targetFailureReproducedWithTracingDisabled !== true
    || comparison.targetFailureReproducedWithTracingEnabled !== true
    || comparison.allThreeLightPeersPassedInEveryAttempt !== true) add("m7q-comparison-claim-inconsistent");
  const closure = isRecord(report.diagnosticClosure) ? report.diagnosticClosure : {};
  if (closure.m7nThroughM7qSchedulingSequence !== "closed"
    || closure.anotherGeneralSchedulingInvestigationRecommended !== false
    || closure.nextAction !== "M7 broad failure-cohort remediation and final qualification evaluation") add("m7q-diagnostic-closure-contract-invalid");
  const historicalReconciliation = isRecord(report.historicalReconciliation) ? report.historicalReconciliation : {};
  if (historicalReconciliation.M7OlightPeers !== "3/3 target attempts passed"
    || historicalReconciliation.M7P_P3TracingOn !== "0/3 target attempts passed"
    || historicalReconciliation.M7Q_Qoff !== "0/4 target attempts passed"
    || historicalReconciliation.M7Q_Qon !== "0/4 target attempts passed") add("m7q-historical-reconciliation-invalid");
  const qualification = isRecord(report.qualificationBoundaries) ? report.qualificationBoundaries : {};
  if (nested(qualification, "M7K", "discovered") !== 278
    || nested(qualification, "M7K", "passed") !== 121
    || nested(qualification, "M7K", "unexpected") !== 82
    || nested(qualification, "M7K", "skipped") !== 75
    || qualification.broadE2e !== "not-qualified"
    || qualification.M7 !== "partially-qualified"
    || qualification.M8Entry !== "denied"
    || qualification.spontaneousExternalGpuDeviceLoss !== "blocked"
    || qualification.productionGroundGlass !== "WebGL-only"
    || qualification.productionWebGpu !== "disabled") add("m7q-qualification-boundary-invalid");

  const historical = isRecord(provenance.historicalEvidence) ? provenance.historicalEvidence : {};
  const capturesHistorical = isRecord(captures.historicalEvidence) ? captures.historicalEvidence : {};
  for (const key of ["m7oReport", "m7pReport", "m7pNormalizedCapture"]) {
    const reportEntry = isRecord(historical[key]) ? historical[key] : {};
    const captureEntry = isRecord(capturesHistorical[key]) ? capturesHistorical[key] : {};
    if (typeof reportEntry.sha256 !== "string" || !sha256Pattern.test(reportEntry.sha256)
      || reportEntry.sha256 !== captureEntry.sha256 || reportEntry.path !== captureEntry.path) add(`m7q-historical-evidence-${key}-pin-invalid`);
  }

  return { passed: issues.length === 0, issues };
};

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const readJsonFile = async (path: string) => JSON.parse(await readFile(path, "utf8")) as unknown;
const assertSafeRelativePath = (path: unknown, label: string, issues: string[]) => {
  if (typeof path !== "string" || path.startsWith("/") || path.split(/[\\/]/).includes("..")) {
    issues.push(`${label}-path-invalid`);
    return null;
  }
  return path;
};
const runGit = (repositoryRoot: string, args: string[]) => spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
const verifyTreeEntries = async (
  repositoryRoot: string,
  commit: unknown,
  paths: unknown,
  label: string,
  issues: string[],
  verifyWorkingContent: boolean,
) => {
  if (typeof commit !== "string" || !commitPattern.test(commit)) {
    issues.push(`${label}-commit-invalid`);
    return;
  }
  const commitResult = runGit(repositoryRoot, ["cat-file", "-e", `${commit}^{commit}`]);
  if (commitResult.status !== 0) issues.push(`${label}-commit-unavailable`);
  for (const path of asArray(paths)) {
    if (typeof path !== "string" || runGit(repositoryRoot, ["cat-file", "-e", `${commit}:${path}`]).status !== 0) {
      issues.push(`${label}-tree-entry-unavailable`);
    } else if (verifyWorkingContent) {
      const gitFile = spawnSync("git", ["show", `${commit}:${path}`], { cwd: repositoryRoot, encoding: "buffer" });
      const currentFile = await readFile(resolve(repositoryRoot, path)).catch(() => null);
      if (gitFile.status !== 0 || !currentFile || !Buffer.isBuffer(gitFile.stdout)
        || hash(gitFile.stdout) !== hash(currentFile)) issues.push(`${label}-source-content-mismatch`);
    }
  }
};
const actualPathInsideRepository = (repositoryRoot: string, path: string) => {
  const absolute = resolve(repositoryRoot, path);
  const relativePath = relative(repositoryRoot, absolute);
  return relativePath === "" || (!relativePath.startsWith(`..${sep}`) && relativePath !== "..");
};

const recomputeTraceFromRaw = (traceEvents: JsonRecord[], capture: JsonRecord, attempt: JsonRecord) => {
  const anchors = traceEvents.flatMap((event) => {
    const pageMs = nested(event, "args", "data", "startTime");
    return typeof event.name === "string" && event.name.startsWith("m7p-") && finite(event.ts) && finite(pageMs)
      ? [{ name: event.name, pageMs, traceMs: event.ts / 1000, pid: event.pid, tid: event.tid, offsetMs: event.ts / 1000 - pageMs }]
      : [];
  });
  const entry = anchors.find((anchor) => anchor.name === "m7p-assertion-entry-anchor");
  if (!entry) return { valid: false, pageAnchors: anchors.length, rendererMainTasks: [] as JsonRecord[] };
  const offsets = anchors.map((anchor) => anchor.offsetMs);
  const offsetLower = Math.min(...offsets);
  const offsetUpper = Math.max(...offsets);
  const offsetMean = offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
  const threadName = traceEvents.find((event) => event.ph === "M" && event.name === "thread_name"
    && event.pid === entry.pid && event.tid === entry.tid)?.args && nested(traceEvents.find((event) => event.ph === "M" && event.name === "thread_name"
      && event.pid === entry.pid && event.tid === entry.tid), "args", "name") || null;
  const processName = nested(traceEvents.find((event) => event.ph === "M" && event.name === "process_name" && event.pid === entry.pid), "args", "name") ?? null;
  const assertion = isRecord(attempt.assertion) ? attempt.assertion : {};
  const deadline = isRecord(assertion.deadlineInterval) ? assertion.deadlineInterval : {};
  const snapshot = nested(capture, "browserSnapshot", "snapshot");
  const snapshotMs = nested(snapshot, "browserMonotonicMs");
  const evaluationEntry = asArray(capture.publicEvaluationIntervals).find((item) => nested(item, "label") === "assertion-entry-anchor");
  const browserAnchor = nested(evaluationEntry, "browserResult", "browserMonotonicMs");
  const requestStart = nested(evaluationEntry, "requestStartedAtMs");
  const responseEnd = nested(evaluationEntry, "responseSettledAtMs");
  const nodeEntry = nested(capture, "assertion", "nodeAssertionEntryMs");
  const assertionEntryPage = finite(browserAnchor) && finite(requestStart) && finite(responseEnd) && finite(nodeEntry)
    ? browserAnchor + nodeEntry - responseEnd
    : Number.NaN;
  const windowStart = assertionEntryPage - 200;
  const windowEnd = finite(snapshotMs) ? snapshotMs + 200 : Number.POSITIVE_INFINITY;
  const tasks = traceEvents.flatMap((event) => {
    if (!new Set(["RunTask", "ThreadControllerImpl::RunTask"]).has(String(event.name))
      || event.ph !== "X" || !finite(event.ts) || !finite(event.dur) || event.dur < 0
      || event.pid !== entry.pid || event.tid !== entry.tid) return [];
    const traceStartMs = event.ts / 1000;
    const traceEndMs = (event.ts + event.dur) / 1000;
    const startPageLowerMs = traceStartMs - offsetUpper;
    const startPageUpperMs = traceStartMs - offsetLower;
    const endPageLowerMs = traceEndMs - offsetUpper;
    const endPageUpperMs = traceEndMs - offsetLower;
    if (endPageUpperMs < windowStart || startPageLowerMs > windowEnd) return [];
    const relation = classifyM7qTaskDeadlineRelationship({ startPageLowerMs, startPageUpperMs, endPageLowerMs, endPageUpperMs }, {
      lowerMs: deadline.deadlineLowerMs as number,
      upperMs: deadline.deadlineUpperMs as number,
    });
    return [{
      name: event.name,
      category: event.cat ?? null,
      processId: event.pid,
      threadId: event.tid,
      traceStartMs: Number(traceStartMs.toFixed(6)),
      traceEndMs: Number(traceEndMs.toFixed(6)),
      traceDurationMs: Number((event.dur / 1000).toFixed(6)),
      startPageMs: Number((traceStartMs - offsetMean).toFixed(3)),
      endPageMs: Number((traceEndMs - offsetMean).toFixed(3)),
      startPageLowerMs: Number(startPageLowerMs.toFixed(6)),
      startPageUpperMs: Number(startPageUpperMs.toFixed(6)),
      endPageLowerMs: Number(endPageLowerMs.toFixed(6)),
      endPageUpperMs: Number(endPageUpperMs.toFixed(6)),
      deadlineRelationship: relation,
    }];
  });
  const groups: Record<string, number> = {};
  for (const task of tasks) groups[String(task.deadlineRelationship)] = (groups[String(task.deadlineRelationship)] ?? 0) + 1;
  return {
    valid: threadName === "CrRendererMain" && finite(entry.pid) && finite(entry.tid),
    eventCount: traceEvents.length,
    pageAnchors: anchors.length,
    tracePageOffsetMs: Number(offsetMean.toFixed(6)),
    tracePageOffsetRangeMs: [Number(offsetLower.toFixed(6)), Number(offsetUpper.toFixed(6))],
    tracePageOffsetSpreadMs: Number((offsetUpper - offsetLower).toFixed(6)),
    targetRenderer: { processId: entry.pid, mainThreadId: entry.tid, processName, threadName },
    coverageWindowPageMs: [Number(windowStart.toFixed(3)), Number(windowEnd.toFixed(3))],
    rendererMainTaskCount: tasks.length,
    maximumRendererMainTaskDurationMs: Number(Math.max(0, ...tasks.map((task) => task.traceDurationMs as number)).toFixed(3)),
    deadlineTaskCounts: groups,
    longestRendererMainTask: tasks.toSorted((left, right) => Number(right.traceDurationMs) - Number(left.traceDurationMs))[0] ?? null,
    rendererMainTasks: tasks,
  };
};

export const verifyM7qRawEvidence = async (
  reportValue: unknown,
  capturesValue: unknown,
  repositoryRoot: string,
  artifactRoot = repositoryRoot,
) => {
  const issues: string[] = [];
  const report = isRecord(reportValue) ? reportValue : {};
  const captures = isRecord(capturesValue) ? capturesValue : {};
  const provenance = isRecord(report.provenance) ? report.provenance : {};
  const captureSourceCommit = provenance.captureRunnerSourceCommit;
  const analysisSourceCommit = provenance.analysisToolingSourceCommit;
  await verifyTreeEntries(repositoryRoot, captureSourceCommit, provenance.captureRunnerSourcePaths, "m7q-capture-source", issues, false);
  await verifyTreeEntries(repositoryRoot, analysisSourceCommit, provenance.analysisToolingSourcePaths, "m7q-analysis-source", issues, true);
  for (const pathValue of [provenance.normalizedCapturesPath, nested(report, "provenance", "historicalEvidence", "m7oReport", "path"), nested(report, "provenance", "historicalEvidence", "m7pReport", "path"), nested(report, "provenance", "historicalEvidence", "m7pNormalizedCapture", "path")]) {
    if (typeof pathValue !== "string" || !actualPathInsideRepository(repositoryRoot, pathValue)) issues.push("m7q-evidence-path-invalid");
  }
  const capturesBytes = typeof provenance.normalizedCapturesPath === "string"
    ? await readFile(resolve(artifactRoot, provenance.normalizedCapturesPath)).catch(() => null)
    : null;
  if (!capturesBytes || hash(capturesBytes) !== provenance.normalizedCapturesSha256) issues.push("m7q-normalized-capture-content-digest-mismatch");
  const historical = isRecord(provenance.historicalEvidence) ? provenance.historicalEvidence : {};
  for (const key of ["m7oReport", "m7pReport", "m7pNormalizedCapture"]) {
    const item = isRecord(historical[key]) ? historical[key] : {};
    if (typeof item.path !== "string") {
      issues.push(`m7q-historical-${key}-path-missing`);
      continue;
    }
    const bytes = await readFile(resolve(repositoryRoot, item.path)).catch(() => null);
    if (!bytes || hash(bytes) !== item.sha256) issues.push(`m7q-historical-${key}-digest-mismatch`);
  }
  const attempts = asArray(captures.attempts).filter(isRecord);
  for (const attempt of attempts) {
    const captureId = String(attempt.captureId ?? "unknown");
    const rawArtifacts = isRecord(attempt.rawArtifacts) ? attempt.rawArtifacts : {};
    const playwrightArtifact = isRecord(rawArtifacts.playwrightReport) ? rawArtifacts.playwrightReport : {};
    const captureArtifact = isRecord(rawArtifacts.m7pCapture) ? rawArtifacts.m7pCapture : {};
    const loadArtifact = async (artifact: JsonRecord, kind: string) => {
      const path = assertSafeRelativePath(artifact.retainedPath, `m7q-${captureId}-${kind}`, issues);
      if (!path) return null;
      const absolute = resolve(artifactRoot, path);
      if (!actualPathInsideRepository(artifactRoot, absolute)) {
        issues.push(`m7q-${captureId}-${kind}-path-escapes-repository`);
        return null;
      }
      const bytes = await readFile(absolute).catch(() => null);
      if (!bytes || hash(bytes) !== artifact.sha256 || (bytes?.byteLength ?? 0) !== artifact.sizeBytes) {
        issues.push(`m7q-${captureId}-${kind}-digest-mismatch`);
        return null;
      }
      return bytes;
    };
    const playwrightBytes = await loadArtifact(playwrightArtifact, "playwright-report");
    const captureBytes = await loadArtifact(captureArtifact, "m7p-capture");
    const normalizedResults = asArray(nested(attempt, "outcomes", "tests")).filter(isRecord);
    if (playwrightBytes) {
      const rawReport = JSON.parse(playwrightBytes.toString("utf8")) as JsonRecord;
      const rawResults = extractPlaywrightResults(asArray(rawReport.suites));
      const comparable = (rows: JsonRecord[]) => rows.map(({ file, title, projectName, status, retry, durationMs, startTime, startEpochMs, workerIndex, parallelIndex, expectedStatus }) => ({
        file, title, projectName, status, retry, durationMs, startTime, startEpochMs, workerIndex, parallelIndex, expectedStatus,
      }));
      if (JSON.stringify(comparable(rawResults)) !== JSON.stringify(comparable(normalizedResults))) issues.push(`m7q-${captureId}-playwright-results-not-rederived`);
      const overlap = deriveM7qFourWorkerOverlap(rawResults.map((row) => ({
        identity: `${String(row.file)}::${String(row.title)}`,
        startEpochMs: row.startEpochMs,
        durationMs: row.durationMs,
        endEpochMs: finite(row.startEpochMs) && finite(row.durationMs) ? row.startEpochMs + row.durationMs : null,
        workerIndex: row.workerIndex,
        parallelIndex: row.parallelIndex,
      })));
      if (!overlap.valid || !overlap.overlap?.active
        || JSON.stringify(overlap.workerIds) !== JSON.stringify(nested(attempt, "workerExecution", "actualWorkerIds"))
        || !approximatelyEqual(overlap.overlap.durationMs, nested(attempt, "workerExecution", "fourTestOverlap", "durationMs") as number, 0.01)) {
        issues.push(`m7q-${captureId}-raw-four-worker-overlap-not-verified`);
      }
    }
    let rawCapture: JsonRecord | null = null;
    if (captureBytes) {
      try { rawCapture = JSON.parse(captureBytes.toString("utf8")) as JsonRecord; } catch { issues.push(`m7q-${captureId}-capture-json-invalid`); }
    }
    if (rawCapture) {
      if (rawCapture.captureId !== captureId || typeof rawCapture.testIdentity !== "string"
        || !rawCapture.testIdentity.endsWith(expectedTests[0].title)) issues.push(`m7q-${captureId}-capture-identity-not-verified`);
      const rawAssertion = isRecord(rawCapture.assertion) ? rawCapture.assertion : {};
      if (rawAssertion.outcome !== nested(attempt, "assertion", "outcome")
        || !approximatelyEqual(rawAssertion.nodeAssertionEntryMs, nested(attempt, "assertion", "nodeEntryMs") as number, 0.000001)
        || !approximatelyEqual(rawAssertion.nodeAssertionSettledMs, nested(attempt, "assertion", "nodeSettledMs") as number, 0.000001)
        || rawAssertion.timeoutBudgetMs !== 5_000) issues.push(`m7q-${captureId}-raw-assertion-not-verified`);
      const rawTrace = isRecord(rawCapture.trace) ? rawCapture.trace : {};
      const expectedTrace = nested(attempt, "trace", "enabled");
      if (rawTrace.enabled !== expectedTrace || rawTrace.started !== expectedTrace || rawTrace.completed !== expectedTrace
        || rawTrace.dataLossOccurred !== nested(attempt, "trace", "dataLossOccurred")
        || rawTrace.rawTraceSha256 !== nested(attempt, "trace", "rawSha256")) issues.push(`m7q-${captureId}-raw-trace-metadata-not-verified`);
      const rawEvaluations = asArray(rawCapture.publicEvaluationIntervals).filter(isRecord).map((item) => ({
        label: item.label,
        requestStartedAtMs: item.requestStartedAtMs,
        responseSettledAtMs: item.responseSettledAtMs,
        browserMonotonicMs: nested(item, "browserResult", "browserMonotonicMs") ?? null,
        scene: nested(item, "browserResult", "scene") ?? null,
      }));
      if (JSON.stringify(rawEvaluations) !== JSON.stringify(nested(attempt, "assertion", "publicEvaluations"))) {
        issues.push(`m7q-${captureId}-public-evaluation-timings-not-preserved`);
      }
      const rawSnapshot = nested(rawCapture, "browserSnapshot", "snapshot");
      const rawLifecycle = asArray(nested(rawSnapshot, "lifecycle")).filter(isRecord);
      const rawFirstCanvas = rawLifecycle.find((item) => finite(item.canvasCount) && item.canvasCount > 0 && asArray(item.canvasConnected).includes(true));
      const normalizedCanvas = nested(attempt, "browserObservations", "firstConnectedCanvas");
      if (!rawFirstCanvas || nested(normalizedCanvas, "browserMonotonicMs") !== rawFirstCanvas.browserMonotonicMs
        || nested(normalizedCanvas, "canvasCount") !== rawFirstCanvas.canvasCount
        || JSON.stringify(nested(normalizedCanvas, "canvasIdentities")) !== JSON.stringify(rawFirstCanvas.canvasIdentities)
        || JSON.stringify(nested(normalizedCanvas, "canvasConnected")) !== JSON.stringify(rawFirstCanvas.canvasConnected)) {
        issues.push(`m7q-${captureId}-canvas-observation-not-preserved`);
      }
      const normalizedLongTasks = asArray(nested(attempt, "browserObservations", "longTasks")).filter(isRecord);
      const rawLongTasks = asArray(nested(rawSnapshot, "longTasks")).filter(isRecord).map((item) => ({
        startMs: item.startMs,
        endMs: item.endMs,
        durationMs: item.durationMs,
        callbackDeliveredAtMs: item.callbackDeliveredAtMs,
        name: item.name,
      }));
      if (JSON.stringify(normalizedLongTasks) !== JSON.stringify(rawLongTasks)) issues.push(`m7q-${captureId}-long-task-observations-not-preserved`);
    }
    if (nested(attempt, "arm") === "on") {
      const trace = isRecord(attempt.trace) ? attempt.trace : {};
      const relativePath = assertSafeRelativePath(trace.retainedPath, `m7q-${captureId}-chromium-trace`, issues);
      if (relativePath) {
        const gzipBytes = await readFile(resolve(artifactRoot, relativePath)).catch(() => null);
        if (!gzipBytes || hash(gzipBytes) !== trace.retainedGzipSha256) {
          issues.push(`m7q-${captureId}-retained-trace-gzip-digest-mismatch`);
        } else {
          try {
            const traceBytes = gunzipSync(gzipBytes);
            if (hash(traceBytes) !== trace.rawSha256 || traceBytes.byteLength !== trace.rawSizeBytes) {
              issues.push(`m7q-${captureId}-raw-trace-digest-mismatch`);
            } else {
              const traceDocument = JSON.parse(traceBytes.toString("utf8")) as JsonRecord;
              const events = asArray(traceDocument.traceEvents).filter(isRecord);
              const derived = recomputeTraceFromRaw(events, rawCapture ?? {}, attempt);
              const expectedRenderer = nested(attempt, "trace", "rendererEvidence");
              const derivedComparable = {
                valid: derived.valid,
                eventCount: derived.eventCount,
                pageAnchors: derived.pageAnchors,
                tracePageOffsetMs: derived.tracePageOffsetMs,
                tracePageOffsetRangeMs: derived.tracePageOffsetRangeMs,
                tracePageOffsetSpreadMs: derived.tracePageOffsetSpreadMs,
                targetRenderer: derived.targetRenderer,
                coverageWindowPageMs: derived.coverageWindowPageMs,
                rendererMainTaskCount: derived.rendererMainTaskCount,
                maximumRendererMainTaskDurationMs: derived.maximumRendererMainTaskDurationMs,
                deadlineTaskCounts: derived.deadlineTaskCounts,
              };
              const expectedComparable = {
                valid: nested(expectedRenderer, "valid"),
                eventCount: nested(expectedRenderer, "eventCount"),
                pageAnchors: nested(expectedRenderer, "pageAnchors"),
                tracePageOffsetMs: nested(expectedRenderer, "tracePageOffsetMs"),
                tracePageOffsetRangeMs: nested(expectedRenderer, "tracePageOffsetRangeMs"),
                tracePageOffsetSpreadMs: nested(expectedRenderer, "tracePageOffsetSpreadMs"),
                targetRenderer: nested(expectedRenderer, "targetRenderer"),
                coverageWindowPageMs: nested(expectedRenderer, "coverageWindowPageMs"),
                rendererMainTaskCount: nested(expectedRenderer, "rendererMainTaskCount"),
                maximumRendererMainTaskDurationMs: nested(expectedRenderer, "maximumRendererMainTaskDurationMs"),
                deadlineTaskCounts: nested(expectedRenderer, "deadlineTaskCounts"),
              };
              if (JSON.stringify(derivedComparable) !== JSON.stringify(expectedComparable)) issues.push(`m7q-${captureId}-renderer-task-evidence-not-rederived`);
              const expectedTasks = asArray(nested(expectedRenderer, "rendererMainTasks"));
              if (JSON.stringify(derived.rendererMainTasks) !== JSON.stringify(expectedTasks)) issues.push(`m7q-${captureId}-renderer-task-intervals-not-rederived`);
            }
          } catch {
            issues.push(`m7q-${captureId}-retained-trace-invalid`);
          }
        }
      }
    }
  }
  return { passed: issues.length === 0, issues };
};

const parseArguments = (argv: string[]) => new Map(argv.map((argument) => {
  const separator = argument.indexOf("=");
  return separator < 0 ? [argument.replace(/^--/, ""), "true"] : [argument.slice(2, separator), argument.slice(separator + 1)];
}));

export const runM7qEvidenceCli = async (argv = process.argv.slice(2)) => {
  const args = parseArguments(argv);
  const repositoryRoot = process.env.M7Q_LIGHT_PEER_TRACE_AB_REPO_ROOT ?? process.cwd();
  const evidenceRoot = resolve(args.get("evidence-root") ?? repositoryRoot);
  const reportPath = resolve(repositoryRoot, args.get("report-path") ?? "docs/architecture/GROUND_GLASS_M7Q_LIGHT_PEER_TRACE_AB_REPORT.json");
  const report = await readJsonFile(reportPath);
  const provenance = nested(report, "provenance");
  const normalizedPath = nested(provenance, "normalizedCapturesPath");
  if (typeof normalizedPath !== "string") throw new Error("M7Q report is missing its normalized capture path.");
  const captures = await readJsonFile(resolve(evidenceRoot, normalizedPath));
  const integrity = evaluateM7qLightPeerTraceAb(report, captures);
  const raw = await verifyM7qRawEvidence(report, captures, repositoryRoot, evidenceRoot);
  const issues = [...new Set([...integrity.issues, ...raw.issues])];
  const passed = issues.length === 0;
  console.log(`M7Q evidence integrity: ${passed ? "PASS" : "FAIL"}`);
  if (isRecord(report)) {
    console.log(`Matched attempts: ${asArray(nested(captures, "attempts")).filter((attempt) => nested(attempt, "validity", "validForComparison") === true).length}/8`);
    console.log(`Decision path: ${nested(report, "primaryFinding", "decisionPath") ?? "invalid"}`);
    console.log(`Broad E2E: ${nested(report, "qualificationBoundaries", "broadE2e") ?? "invalid"}`);
  }
  for (const issue of issues) console.error(`- ${issue}`);
  return passed ? 0 : 1;
};

if (process.env.M7Q_LIGHT_PEER_TRACE_AB_CLI === "1") {
  runM7qEvidenceCli().then((status) => { process.exitCode = status; }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
