import { createHash } from "node:crypto";
import { basename } from "node:path";

export const M7W_EVALUATOR_REVISION = "m7w-webgl-qualification-evaluator-v2";
export const M7W_EXECUTION_SOURCE_SHA = "17a4ccb9f4ae08069defaa9a1eac9938833412ae";
export const M7W_REPRESENTATIVE_IDENTITIES = [
  "chromium::architecture-foreground-dof.spec.ts::Architecture + Foreground DOF task starts solved through PR7C and completes with Aperture only",
  "chromium::architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
  "chromium::interior-corner-guided-lesson.spec.ts::Interior Corner completes the public Compose → Swing → Refine → Aperture lesson",
  "chromium::interior-corner-rise-composition.spec.ts::Interior Corner free mode exposes reachable Rise composition feedback",
];

const ANSI_ESCAPE = /\u001b\[[0-9;]*m/g;

function cleanText(value) {
  return String(value ?? "").replace(ANSI_ESCAPE, "");
}

function normalizedErrorLocation(result) {
  const location = (result.errors ?? []).find((entry) => entry.location)?.location;
  if (!location) return null;
  let file = String(location.file ?? "").replaceAll("<M7W_WORKTREE>/", "");
  file = file.replace(/^\.?\/?src\//, "src/");
  return {
    file,
    line: Number.isFinite(location.line) ? location.line : null,
    column: Number.isFinite(location.column) ? location.column : null,
  };
}

function normalizeAttempt(result, fallbackRetry) {
  const errorText = (result.errors ?? []).map((entry) => entry.message ?? "").filter(Boolean).join("\n") || result.error?.message || "";
  return {
    status: result.status ?? "missing-status",
    retry: Number.isInteger(result.retry) ? result.retry : fallbackRetry,
    durationMs: Number.isFinite(result.duration) ? result.duration : null,
    startTime: typeof result.startTime === "string" ? result.startTime : null,
    workerIndex: Number.isInteger(result.workerIndex) ? result.workerIndex : null,
    parallelIndex: Number.isInteger(result.parallelIndex) ? result.parallelIndex : null,
    errorText: cleanText(errorText),
    errorLocation: normalizedErrorLocation(result),
    attachments: (result.attachments ?? []).map((attachment) => ({
      name: String(attachment.name ?? ""),
      contentType: String(attachment.contentType ?? ""),
      path: typeof attachment.path === "string" ? attachment.path : null,
    })),
  };
}

/** Convert Playwright's public JSON reporter document into stable test identities and attempts. */
export function flattenM7wPlaywrightReport(playwrightReport) {
  const rows = [];

  function visitSuite(suite, parentFile = null, parentTitles = []) {
    const file = suite.file ?? parentFile;
    const isFileSuite = Boolean(suite.file && suite.title === basename(suite.file));
    const suiteTitles = isFileSuite ? parentTitles : [...parentTitles, suite.title].filter(Boolean);

    for (const child of suite.suites ?? []) visitSuite(child, file, suiteTitles);
    for (const spec of suite.specs ?? []) {
      const specFile = spec.file ?? file;
      const titlePath = [...suiteTitles, spec.title].filter(Boolean);
      for (const test of spec.tests ?? []) {
        const project = test.projectName ?? test.projectId ?? "";
        const attempts = (test.results ?? []).map((result, index) => normalizeAttempt(result, index));
        const finalAttempt = attempts.at(-1) ?? null;
        const resultStatus = finalAttempt?.status ?? (test.status === "skipped" ? "skipped" : "incomplete");
        rows.push({
          identity: project + "::" + basename(specFile ?? "unknown.spec.ts") + "::" + titlePath.join("::"),
          project,
          specPath: "src/tests/e2e/" + basename(specFile ?? "unknown.spec.ts"),
          titlePath,
          sourceLine: Number.isInteger(spec.line) ? spec.line : null,
          expectedStatus: test.expectedStatus ?? "passed",
          status: resultStatus,
          retryCount: Math.max(0, attempts.length - 1),
          attempts,
        });
      }
    }
  }

  for (const suite of playwrightReport.suites ?? []) visitSuite(suite);
  return rows;
}

function parseIntervals(rows) {
  const intervals = [];
  let unverifiableExecutionIntervals = 0;
  for (const row of rows) {
    for (const [attemptIndex, attempt] of row.attempts.entries()) {
      if (attempt.status === "skipped") continue;
      const startMs = Date.parse(attempt.startTime ?? "");
      const durationMs = attempt.durationMs;
      if (!Number.isFinite(startMs) || !Number.isFinite(durationMs) || durationMs <= 0 ||
          !Number.isInteger(attempt.parallelIndex) || attempt.parallelIndex < 0 ||
          !Number.isInteger(attempt.workerIndex) || attempt.workerIndex < 0) {
        unverifiableExecutionIntervals += 1;
        continue;
      }
      intervals.push({
        identity: row.identity + "#" + attemptIndex,
        workerIndex: attempt.workerIndex,
        parallelIndex: attempt.parallelIndex,
        startMs,
        endMs: startMs + durationMs,
      });
    }
  }
  return { intervals, unverifiableExecutionIntervals };
}

export function measureM7wConcurrency(rows) {
  const parsed = parseIntervals(rows);
  const intervals = parsed.intervals;
  const slots = [...new Set(intervals.map((interval) => interval.parallelIndex))].sort((a, b) => a - b);
  const workers = [...new Set(intervals.map((interval) => interval.workerIndex))].sort((a, b) => a - b);
  const events = intervals.flatMap((interval) => [
    { time: interval.startMs, delta: 1 },
    { time: interval.endMs, delta: -1 },
  ]).sort((a, b) => a.time - b.time || a.delta - b.delta);
  let active = 0;
  let peakConcurrency = 0;
  let fourWayOverlapMs = 0;
  let currentFourWayOverlapMs = 0;
  let previousTime = null;
  for (const event of events) {
    if (previousTime !== null) {
      const elapsed = Math.max(0, event.time - previousTime);
      if (active === 4) currentFourWayOverlapMs += elapsed;
      else currentFourWayOverlapMs = 0;
      fourWayOverlapMs = Math.max(fourWayOverlapMs, currentFourWayOverlapMs);
    }
    active += event.delta;
    peakConcurrency = Math.max(peakConcurrency, active);
    previousTime = event.time;
  }
  return {
    actualWorkerSlots: slots,
    actualWorkers: slots.length,
    actualWorkerIndexes: workers,
    unverifiableExecutionIntervals: parsed.unverifiableExecutionIntervals,
    peakConcurrency,
    fourWayOverlapMs,
  };
}

export function summarizeM7wCapture(playwrightReport, rows) {
  const statuses = rows.map((row) => row.status);
  const config = playwrightReport.config ?? {};
  const projectNames = [...new Set(rows.map((row) => row.project))].sort();
  const projectConfig = (config.projects ?? []).find((project) => project.name === projectNames[0]);
  const concurrency = measureM7wConcurrency(rows);
  return {
    projectNames,
    discovered: rows.length,
    passed: statuses.filter((status) => status === "passed").length,
    failed: statuses.filter((status) => status === "failed").length,
    timedOut: statuses.filter((status) => status === "timedOut").length,
    skipped: statuses.filter((status) => status === "skipped").length,
    unexpected: statuses.filter((status) => !["passed", "skipped"].includes(status)).length,
    flaky: statuses.filter((status) => status === "flaky").length,
    incomplete: statuses.filter((status) => status === "incomplete" || status === "interrupted").length,
    retries: rows.reduce((sum, row) => sum + row.retryCount, 0),
    configuredWorkers: Number.isInteger(config.workers) ? config.workers : null,
    configuredRetries: Number.isInteger(projectConfig?.retries) ? projectConfig.retries : null,
    actualWorkersFromRunnerMetadata: Number.isInteger(config.metadata?.actualWorkers) ? config.metadata.actualWorkers : null,
    ...concurrency,
    runStartTime: typeof playwrightReport.stats?.startTime === "string" ? playwrightReport.stats.startTime : null,
    runDurationMs: Number.isFinite(playwrightReport.stats?.duration) ? playwrightReport.stats.duration : null,
    runnerErrors: Array.isArray(playwrightReport.errors) ? playwrightReport.errors.length : 0,
    reporterCounts: {
      expected: Number.isFinite(playwrightReport.stats?.expected) ? playwrightReport.stats.expected : null,
      unexpected: Number.isFinite(playwrightReport.stats?.unexpected) ? playwrightReport.stats.unexpected : null,
      skipped: Number.isFinite(playwrightReport.stats?.skipped) ? playwrightReport.stats.skipped : null,
      flaky: Number.isFinite(playwrightReport.stats?.flaky) ? playwrightReport.stats.flaky : null,
    },
  };
}

export function sameM7wStringSet(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) return false;
  const expectedSet = new Set(expected);
  return expectedSet.size === expected.length && actual.every((value) => expectedSet.has(value));
}

export function verifyM7wDigest(bytes, expectedDigest) {
  if (!/^[a-f0-9]{64}$/.test(expectedDigest ?? "")) return false;
  return createHash("sha256").update(bytes).digest("hex") === expectedDigest;
}

export function deriveM7wFailureSurface(row) {
  const message = row.attempts?.at(-1)?.errorText ?? "";
  const location = row.attempts?.at(-1)?.errorLocation?.file ?? "";
  if (row.status === "timedOut" && location.endsWith("helpers/learningOverlay.ts") && message.includes("toHaveCSS")) return "learning-drawer-open-position-timeout";
  if (location.endsWith("helpers/learningOverlay.ts") && message.includes("toHaveCSS")) return "learning-drawer-open-position-assertion";
  if (location.endsWith("helpers/learningOverlay.ts")) return "learning-drawer-helper-timeout";
  if (/toHaveCount[\s\S]{0,500}canvas|canvas[\s\S]{0,500}toHaveCount/i.test(message)) return "canvas-count-assertion";
  if (/toHaveCount/i.test(message)) return "element-count-assertion";
  if (/toHaveAttribute/i.test(message)) return "attribute-assertion";
  if (/toBeEnabled/i.test(message)) return "control-enabled-assertion";
  if (/toBeVisible/i.test(message)) return "visibility-assertion";
  if (/toContainText|toHaveText/i.test(message)) return "content-assertion";
  if (row.status === "timedOut" || /timeout/i.test(message)) return "test-timeout";
  return "other-assertion-or-action";
}

function sameJson(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function issuesForCapture(name, capture, raw, expectedProject, expectedIdentities, expectedConfig, issues) {
  if (!capture || !raw) {
    issues.push(name + "-capture-missing");
    return;
  }
  const rawRows = flattenM7wPlaywrightReport(raw);
  const derived = summarizeM7wCapture(raw, rawRows);
  if (!sameJson(capture.results, rawRows)) issues.push(name + "-normalized-results-mismatch");
  if (!sameJson(capture.summary, derived)) issues.push(name + "-summary-mismatch");
  if (!sameM7wStringSet(rawRows.map((row) => row.identity), expectedIdentities)) issues.push(name + "-identity-inventory-mismatch");
  if (new Set(rawRows.map((row) => row.identity)).size !== rawRows.length) issues.push(name + "-duplicate-identity");
  if (rawRows.some((row) => row.project !== expectedProject)) issues.push(name + "-wrong-project");
  if (derived.configuredWorkers !== expectedConfig.workers) issues.push(name + "-configured-workers-mismatch");
  if (derived.configuredRetries !== 0 || derived.retries !== 0 || derived.flaky !== 0) issues.push(name + "-retry-policy-invalid");
  if (derived.runnerErrors !== 0 || derived.incomplete !== 0) issues.push(name + "-capture-incomplete");
  if (derived.unverifiableExecutionIntervals !== 0) issues.push(name + "-execution-interval-invalid");
  if (derived.actualWorkersFromRunnerMetadata !== derived.actualWorkers) issues.push(name + "-runner-worker-metadata-mismatch");
  if (capture.summary?.passed !== derived.passed || capture.summary?.unexpected !== derived.unexpected || capture.summary?.skipped !== derived.skipped) issues.push(name + "-summary-outcome-mismatch");
  if (derived.reporterCounts.expected !== derived.passed || derived.reporterCounts.unexpected !== derived.unexpected || derived.reporterCounts.skipped !== derived.skipped) issues.push(name + "-reporter-counts-mismatch");
  if (expectedConfig.fourWorkers && (derived.actualWorkers !== 4 || derived.peakConcurrency !== 4 || derived.fourWayOverlapMs <= 0)) issues.push(name + "-four-worker-overlap-unproven");
  if (expectedConfig.singleWorker && (derived.configuredWorkers !== 1 || derived.actualWorkers !== 1 || derived.peakConcurrency !== 1)) issues.push(name + "-single-worker-policy-invalid");
  if (!capture.publicRaw?.sha256 || !/^[a-f0-9]{64}$/.test(capture.publicRaw.sha256)) issues.push(name + "-public-artifact-digest-invalid");
}

export function evaluateM7wEvidence({ report, inventories, rawCaptures }) {
  const issues = [];
  if (report?.schemaVersion !== 1) issues.push("schema-version-invalid");
  if (report?.evaluatorRevision !== M7W_EVALUATOR_REVISION) issues.push("evaluator-revision-mismatch");
  if (report?.provenance?.executionSourceCommitSha !== M7W_EXECUTION_SOURCE_SHA) issues.push("execution-source-revision-invalid");
  if (report?.provenance?.originalRawArtifactsRetained !== false) issues.push("raw-artifact-redaction-disclosure-invalid");
  if (!inventories?.ordinaryRequired || !inventories?.ordinaryProject || !inventories?.rendererSerialRequired) issues.push("m7v-inventory-missing");
  if (!sameM7wStringSet(report?.inventory?.requiredOrdinaryIdentities, inventories?.ordinaryRequired ?? [])) issues.push("ordinary-required-inventory-mismatch");
  if (!sameM7wStringSet(report?.inventory?.ordinaryProjectIdentities, inventories?.ordinaryProject ?? [])) issues.push("ordinary-project-inventory-mismatch");
  if (!sameM7wStringSet(report?.inventory?.rendererSerialIdentities, inventories?.rendererSerialRequired ?? [])) issues.push("renderer-serial-inventory-mismatch");
  if (!sameM7wStringSet(report?.inventory?.ordinaryNonMandatoryIdentities, inventories?.ordinaryNonMandatory ?? [])) issues.push("ordinary-nonmandatory-inventory-mismatch");
  if (!sameJson(report?.inventory?.historicalOrdinaryByIdentity, inventories?.historicalOrdinaryByIdentity)) issues.push("historical-m7r-identity-inventory-mismatch");
  if (report?.inventory?.standardDiscovered !== 280 || report?.inventory?.ordinaryProjectDiscovered !== 276 ||
      report?.inventory?.requiredOrdinaryIdentities?.length !== 201 ||
      report?.inventory?.rendererSerialIdentities?.length !== 4 ||
      report?.inventory?.ordinaryNonMandatoryIdentities?.length !== 75) issues.push("m7v-inventory-counts-invalid");
  if (!sameM7wStringSet(report?.inventory?.m7uAddedIdentities, inventories?.m7uAddedIdentities ?? [])) issues.push("m7u-added-inventory-mismatch");

  issuesForCapture("ordinary", report?.captures?.ordinary, rawCaptures?.ordinary, "chromium", inventories?.ordinaryProject ?? [], { workers: 4, fourWorkers: true }, issues);
  issuesForCapture("renderer-serial", report?.captures?.rendererSerial, rawCaptures?.rendererSerial, "chromium-renderer-serial", inventories?.rendererSerialRequired ?? [], { workers: 1, singleWorker: true }, issues);
  const reproductionIds = report?.targetedReproduction?.selectedIdentities ?? [];
  if (!sameM7wStringSet(reproductionIds, M7W_REPRESENTATIVE_IDENTITIES)) issues.push("representative-selection-invalid");
  issuesForCapture("representative-single", report?.captures?.representativeSingle, rawCaptures?.representativeSingle, "chromium", reproductionIds, { workers: 1, singleWorker: true }, issues);

  const ordinary = report?.captures?.ordinary?.results ?? [];
  const requiredSet = new Set(inventories?.ordinaryRequired ?? []);
  const mandatory = ordinary.filter((row) => requiredSet.has(row.identity));
  const skippedRequired = mandatory.filter((row) => row.status === "skipped");
  if (mandatory.length !== (inventories?.ordinaryRequired?.length ?? -1)) issues.push("ordinary-mandatory-results-incomplete");
  if (skippedRequired.length > 0) issues.push("ordinary-mandatory-unexpected-skip");
  const excludedSet = new Set(inventories?.ordinaryNonMandatory ?? []);
  if (ordinary.some((row) => excludedSet.has(row.identity) && row.status !== "skipped")) issues.push("ordinary-nonmandatory-outcome-misrepresented");

  const unexpectedMandatory = mandatory.filter((row) => !["passed", "skipped"].includes(row.status));
  const classifications = report?.failureClassifications ?? [];
  if (!sameM7wStringSet(classifications.map((item) => item.identity), unexpectedMandatory.map((row) => row.identity))) issues.push("failure-classification-coverage-mismatch");
  for (const classification of classifications) {
    const row = unexpectedMandatory.find((candidate) => candidate.identity === classification.identity);
    if (!row || classification.fullRunStatus !== row.status) issues.push("failure-classification-outcome-mismatch:" + classification.identity);
    if (![
      "application-defect", "test-contract-defect", "renderer-lifecycle", "interaction-performance",
      "browser-environment", "infrastructure-invalid", "unclassified",
    ].includes(classification.category)) issues.push("failure-classification-category-invalid:" + classification.identity);
    if (!["reproduced", "not-reproduced", "different-failure", "not-rechecked", "infrastructure-blocked"].includes(classification.reproductionStatus)) issues.push("failure-reproduction-status-invalid:" + classification.identity);
    if (classification.category !== "unclassified" || classification.rootCauseConfidence !== "none") issues.push("unsupported-root-cause-claim:" + classification.identity);
    if (row) {
      const attempt = row.attempts.at(-1);
      const historicalValue = report.inventory?.historicalOrdinaryByIdentity?.[row.identity] ?? "unknown";
      const historical = historicalValue === "unknown" && (report.inventory?.m7uAddedIdentities ?? []).includes(row.identity) ? "new-in-m7u" : historicalValue;
      const isolated = (report.captures?.representativeSingle?.results ?? []).find((candidate) => candidate.identity === row.identity);
      const expectedReproductionStatus = isolated?.status === "passed" ? "not-reproduced" : "not-rechecked";
      if (classification.failureSurface !== deriveM7wFailureSurface(row)) issues.push("failure-surface-does-not-match-raw:" + row.identity);
      if (classification.failureStage?.file !== attempt?.errorLocation?.file ||
          classification.failureStage?.line !== attempt?.errorLocation?.line ||
          classification.failureStage?.column !== attempt?.errorLocation?.column) issues.push("failure-location-does-not-match-raw:" + row.identity);
      if (classification.assertionOrAction !== (attempt?.errorText ?? "").slice(0, 1800)) issues.push("failure-message-does-not-match-raw:" + row.identity);
      if (classification.workerIndex !== attempt?.workerIndex || classification.parallelIndex !== attempt?.parallelIndex || classification.durationMs !== attempt?.durationMs) issues.push("failure-execution-metadata-does-not-match-raw:" + row.identity);
      if (classification.historicalM7rStatus !== historical) issues.push("failure-historical-status-mismatch:" + row.identity);
      if (classification.reproductionStatus !== expectedReproductionStatus || classification.targetedSingleWorkerOutcome !== (isolated?.status ?? null)) issues.push("failure-reproduction-claim-mismatch:" + row.identity);
    }
  }

  const ordinaryCounts = {
    discovered: mandatory.length,
    passed: mandatory.filter((row) => row.status === "passed").length,
    unexpected: unexpectedMandatory.length,
    skipped: skippedRequired.length,
    retries: mandatory.reduce((sum, row) => sum + row.retryCount, 0),
    incomplete: mandatory.filter((row) => ["incomplete", "interrupted"].includes(row.status)).length,
  };
  if (!sameJson(report?.decision?.ordinaryWebgl?.requiredIdentityCounts, ordinaryCounts)) issues.push("ordinary-mandatory-summary-mismatch");
  const serialRows = report?.captures?.rendererSerial?.results ?? [];
  const serialCounts = {
    discovered: serialRows.length,
    passed: serialRows.filter((row) => row.status === "passed").length,
    unexpected: serialRows.filter((row) => !["passed", "skipped"].includes(row.status)).length,
    skipped: serialRows.filter((row) => row.status === "skipped").length,
    retries: serialRows.reduce((sum, row) => sum + row.retryCount, 0),
    incomplete: serialRows.filter((row) => ["incomplete", "interrupted"].includes(row.status)).length,
  };
  if (!sameJson(report?.decision?.rendererSerial?.requiredIdentityCounts, serialCounts)) issues.push("renderer-serial-summary-mismatch");

  const groupMap = new Map();
  for (const classification of classifications) {
    const identities = groupMap.get(classification.failureSurface) ?? [];
    identities.push(classification.identity);
    groupMap.set(classification.failureSurface, identities);
  }
  const derivedGroups = [...groupMap.entries()].map(([failureSurface, identities]) => ({
    failureSurface,
    count: identities.length,
    identities,
  })).sort((a, b) => b.count - a.count || a.failureSurface.localeCompare(b.failureSurface));
  if (!sameJson(report?.failureCohorts, derivedGroups)) issues.push("failure-cohort-summary-mismatch");
  const drawerCohort = classifications.filter((item) => item.failureSurface === "learning-drawer-open-position-assertion").map((item) => item.identity);
  if (!sameM7wStringSet(report?.decision?.nextRemediation?.affectedIdentities ?? [], drawerCohort)) issues.push("next-remediation-cohort-mismatch");

  const reproductionRows = report?.captures?.representativeSingle?.results ?? [];
  const reproductionByIdentity = new Map(reproductionRows.map((row) => [row.identity, row]));
  for (const identity of reproductionIds) {
    const reproduced = reproductionByIdentity.get(identity);
    const full = ordinary.find((row) => row.identity === identity);
    if (!reproduced || !full || reproduced.status !== "passed" || full.status === "passed") issues.push("targeted-reproduction-claim-invalid:" + identity);
  }
  if (report?.decision?.outcome !== "W2") issues.push("m7w-decision-invalid");
  if (report?.decision?.ordinaryWebgl?.qualification !== "not-qualified") issues.push("ordinary-lane-qualification-boundary-invalid");
  if (report?.decision?.m7vStrictEvidence !== "incomplete" || report?.decision?.m7vCompatibility?.accepted !== false) issues.push("m7v-formal-evidence-boundary-invalid");
  if (report?.decision?.rendererSerial?.localExecution !== "locally-passed") issues.push("renderer-serial-local-result-invalid");
  if (serialCounts.discovered !== 4 || serialCounts.passed !== 4 || serialCounts.unexpected !== 0 ||
      serialCounts.skipped !== 0 || serialCounts.retries !== 0 || serialCounts.incomplete !== 0) issues.push("renderer-serial-results-not-all-passed");
  if (report?.qualification?.broadE2e !== "not-qualified" || report?.qualification?.m7 !== "partially-qualified" || report?.qualification?.m8Entry !== "denied" || report?.qualification?.productionGroundGlass !== "webgl-only" || report?.qualification?.productionWebgpu !== "disabled") issues.push("qualification-boundary-invalid");

  return { passed: issues.length === 0, issues };
}
