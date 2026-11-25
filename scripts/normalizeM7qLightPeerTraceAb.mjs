import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  return separator < 0
    ? [argument.replace(/^--/, ""), "true"]
    : [argument.slice(2, separator), argument.slice(separator + 1)];
}));
if (!args.has("input-dir")) {
  throw new Error("Usage: npm run evidence:normalize:m7q -- --input-dir=/private/tmp/m7q-run [--out-dir=docs/architecture/ground-glass-m7q-light-peer-trace-ab/capture/final].");
}
const inputDirectory = resolve(args.get("input-dir"));
const outputDirectory = resolve(args.get("out-dir") ?? resolve(repositoryRoot, "docs/architecture/ground-glass-m7q-light-peer-trace-ab/capture/final"));
const inputRelative = relative(repositoryRoot, inputDirectory);
if (inputRelative === "" || (!inputRelative.startsWith(`..${sep}`) && inputRelative !== "..")) {
  throw new Error("M7Q raw capture input must be outside the repository worktree.");
}
const outputRelative = relative(repositoryRoot, outputDirectory);
if (outputRelative === "" || outputRelative.startsWith(`..${sep}`) || outputRelative === "..") {
  throw new Error("M7Q normalized evidence must be written inside the repository worktree.");
}
const rawOutputDirectory = resolve(outputDirectory, "raw");
const summaryPath = resolve(inputDirectory, "m7q-run-summary.json");
const targetTitle = "Architecture Rise focus control stays within scene depth and preserves thin-lens extension";
const expectedTests = [
  { file: "architecture-rise-focus-range.spec.ts", title: targetTitle, role: "target" },
  { file: "home.spec.ts", title: "concept learning sections keep their responsive grids without overflow", role: "light-peer" },
  { file: "simulator-header.spec.ts", title: "keeps the active lesson context between the brand and desktop actions", role: "light-peer" },
  { file: "smoke.spec.ts", title: "smoke: app boots at home", role: "light-peer" },
];
const expectedKeys = expectedTests.map(({ file, title }) => `${file}::${title}`).sort();
const pairs = [
  { pairId: "pair-1", order: ["off", "on"] },
  { pairId: "pair-2", order: ["on", "off"] },
  { pairId: "pair-3", order: ["on", "off"] },
  { pairId: "pair-4", order: ["off", "on"] },
];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const rounded = (value, digits = 3) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const verifyTreePath = (sha, path) => {
  const result = spawnSync("git", ["cat-file", "-e", `${sha}:${path}`], { cwd: repositoryRoot, encoding: "utf8" });
  return result.status === 0;
};
const collectResults = (suites) => {
  const results = [];
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          results.push({
            file: spec.file?.split(/[\\/]/).at(-1) ?? null,
            title: spec.title,
            projectName: test.projectName,
            status: result.status,
            retry: result.retry,
            durationMs: result.duration,
            startTime: result.startTime,
            startEpochMs: typeof result.startTime === "string" ? Date.parse(result.startTime) : null,
            workerIndex: result.workerIndex,
            parallelIndex: result.parallelIndex,
            expectedStatus: test.expectedStatus,
            errorMessages: (result.errors ?? []).map((error) => error.message ?? "").slice(0, 2),
          });
        }
      }
    }
    results.push(...collectResults(suite.suites));
  }
  return results;
};
const deriveOverlap = (testResults) => {
  const valid = testResults.length === 4 && testResults.every((test) =>
    Number.isFinite(test.startEpochMs)
      && Number.isFinite(test.durationMs)
      && test.durationMs > 0
      && Number.isSafeInteger(test.workerIndex)
      && test.workerIndex >= 0
      && Number.isSafeInteger(test.parallelIndex)
      && test.parallelIndex >= 0);
  if (!valid) return { valid: false, peakConcurrency: null, workers: [], overlap: null };
  const events = testResults.flatMap((test) => [
    { time: test.startEpochMs, delta: 1 },
    { time: test.startEpochMs + test.durationMs, delta: -1 },
  ]).sort((left, right) => left.time - right.time || left.delta - right.delta);
  let active = 0;
  let peakConcurrency = 0;
  for (const event of events) {
    active += event.delta;
    peakConcurrency = Math.max(peakConcurrency, active);
  }
  const startEpochMs = Math.max(...testResults.map((test) => test.startEpochMs));
  const endEpochMs = Math.min(...testResults.map((test) => test.startEpochMs + test.durationMs));
  const identities = testResults.map(({ file, title }) => `${file}::${title}`).sort();
  const workers = [...new Set(testResults.map(({ workerIndex }) => workerIndex))].sort((a, b) => a - b);
  const parallelIds = [...new Set(testResults.map(({ parallelIndex }) => parallelIndex))].sort((a, b) => a - b);
  const targetParticipated = testResults.some((test) => test.file === expectedTests[0].file && test.title === targetTitle
    && test.startEpochMs <= startEpochMs && test.startEpochMs + test.durationMs >= endEpochMs);
  return {
    valid: true,
    peakConcurrency,
    workers,
    intervals: testResults.map(({ file, title, startEpochMs: start, durationMs, workerIndex, parallelIndex }) => ({
      identity: `${file}::${title}`,
      startEpochMs: start,
      durationMs,
      endEpochMs: start + durationMs,
      workerIndex,
      parallelIndex,
    })),
    overlap: {
      active: endEpochMs > startEpochMs && testResults.length === 4 && workers.length === 4
        && parallelIds.length === 4 && targetParticipated,
      startEpochMs,
      endEpochMs,
      durationMs: Math.max(0, endEpochMs - startEpochMs),
      workerIds: workers,
      parallelIds,
      testIdentities: identities,
      targetParticipated,
    },
  };
};
const deriveDeadline = (capture) => {
  const assertionAnchor = capture.publicEvaluationIntervals?.find((interval) => interval.label === "assertion-entry-anchor");
  const browserAnchorMs = assertionAnchor?.browserResult?.browserMonotonicMs;
  const requestStart = assertionAnchor?.requestStartedAtMs;
  const responseEnd = assertionAnchor?.responseSettledAtMs;
  const assertion = capture.assertion;
  const roundTripMs = Number.isFinite(requestStart) && Number.isFinite(responseEnd) && responseEnd >= requestStart
    ? responseEnd - requestStart
    : null;
  const entryNodeMs = assertion?.nodeAssertionEntryMs;
  const timeoutMs = assertion?.timeoutBudgetMs;
  const browserEntryLowerMs = Number.isFinite(browserAnchorMs)
    && Number.isFinite(entryNodeMs)
    && Number.isFinite(responseEnd)
    && Number.isFinite(roundTripMs)
    && entryNodeMs >= responseEnd
    ? browserAnchorMs + entryNodeMs - responseEnd
    : null;
  const lowerMs = Number.isFinite(browserEntryLowerMs) && Number.isFinite(timeoutMs)
    ? browserEntryLowerMs + timeoutMs
    : null;
  const upperMs = Number.isFinite(lowerMs) && Number.isFinite(roundTripMs)
    ? lowerMs + roundTripMs
    : null;
  const valid = Number.isFinite(lowerMs) && Number.isFinite(upperMs) && lowerMs <= upperMs && roundTripMs >= 0;
  return {
    valid,
    clockDomain: "browser-page-performance-monotonic-ms",
    anchorKind: "public-evaluation-request-response-bracket",
    browserAnchorMs: rounded(browserAnchorMs, 6),
    nodeRequestStartedAtMs: rounded(requestStart, 6),
    nodeResponseSettledAtMs: rounded(responseEnd, 6),
    anchorRoundTripMs: rounded(roundTripMs, 6),
    nodeAssertionEntryMs: rounded(entryNodeMs, 6),
    timeoutBudgetMs: timeoutMs,
    browserAssertionEntryLowerMs: rounded(browserEntryLowerMs, 6),
    deadlineLowerMs: rounded(lowerMs, 6),
    deadlineUpperMs: rounded(upperMs, 6),
    uncertaintyWidthMs: rounded(Number.isFinite(lowerMs) && Number.isFinite(upperMs) ? upperMs - lowerMs : null, 6),
    roundingToleranceMs: 0.001,
  };
};
const classifyCanvas = (observationMs, deadline) => {
  if (!Number.isFinite(observationMs) || !deadline?.valid) return "unavailable-or-uncertain";
  if (observationMs < deadline.deadlineLowerMs - deadline.roundingToleranceMs) return "observed-before-deadline";
  if (observationMs > deadline.deadlineUpperMs + deadline.roundingToleranceMs) return "observed-after-deadline";
  return "deadline-interval-uncertain";
};
const classifyTaskDeadline = (task, deadline) => {
  if (!deadline?.valid || !Number.isFinite(task.startPageLowerMs) || !Number.isFinite(task.startPageUpperMs)
    || !Number.isFinite(task.endPageLowerMs) || !Number.isFinite(task.endPageUpperMs)
    || task.startPageLowerMs > task.startPageUpperMs || task.endPageLowerMs > task.endPageUpperMs) return "unverifiable";
  if (task.startPageUpperMs <= deadline.deadlineLowerMs && task.endPageLowerMs >= deadline.deadlineUpperMs) return "definitely-spans-deadline-interval";
  if (task.startPageLowerMs <= deadline.deadlineUpperMs && task.endPageUpperMs >= deadline.deadlineLowerMs) return "possibly-overlaps-deadline";
  return "does-not-overlap-deadline";
};
const extractTraceEvidence = (traceDocument, capture, deadline, snapshot) => {
  const events = Array.isArray(traceDocument?.traceEvents) ? traceDocument.traceEvents : [];
  const anchors = events.flatMap((event) => {
    const pageMs = event.args?.data?.startTime;
    return typeof event.name === "string" && event.name.startsWith("m7p-")
      && Number.isFinite(event.ts) && Number.isFinite(pageMs)
      ? [{ name: event.name, pageMs, traceMs: event.ts / 1000, pid: event.pid, tid: event.tid, offsetMs: event.ts / 1000 - pageMs }]
      : [];
  });
  const entryAnchor = anchors.find((anchor) => anchor.name === "m7p-assertion-entry-anchor");
  if (anchors.length === 0 || !entryAnchor) return { valid: false, eventCount: events.length, pageAnchors: anchors.length, targetRenderer: null, rendererMainTasks: [] };
  const offsets = anchors.map((anchor) => anchor.offsetMs);
  const offsetLowerMs = Math.min(...offsets);
  const offsetUpperMs = Math.max(...offsets);
  const offsetMs = offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
  const threadName = events.find((event) => event.ph === "M" && event.name === "thread_name"
    && event.pid === entryAnchor.pid && event.tid === entryAnchor.tid)?.args?.name ?? null;
  const processName = events.find((event) => event.ph === "M" && event.name === "process_name"
    && event.pid === entryAnchor.pid)?.args?.name ?? null;
  const assertionEntryMs = deadline.browserAssertionEntryLowerMs;
  const snapshotMs = snapshot?.browserMonotonicMs;
  const observationWindowStartMs = Number.isFinite(assertionEntryMs) ? assertionEntryMs - 200 : Number.NEGATIVE_INFINITY;
  const observationWindowEndMs = Number.isFinite(snapshotMs) ? snapshotMs + 200 : Number.POSITIVE_INFINITY;
  const rendererMainTasks = events.flatMap((event) => {
    if (!new Set(["RunTask", "ThreadControllerImpl::RunTask"]).has(event.name)
      || event.ph !== "X" || !Number.isFinite(event.ts) || !Number.isFinite(event.dur)
      || event.dur < 0 || event.pid !== entryAnchor.pid || event.tid !== entryAnchor.tid) return [];
    const traceStartMs = event.ts / 1000;
    const traceEndMs = (event.ts + event.dur) / 1000;
    const startPageLowerMs = traceStartMs - offsetUpperMs;
    const startPageUpperMs = traceStartMs - offsetLowerMs;
    const endPageLowerMs = traceEndMs - offsetUpperMs;
    const endPageUpperMs = traceEndMs - offsetLowerMs;
    if (endPageUpperMs < observationWindowStartMs || startPageLowerMs > observationWindowEndMs) return [];
    const task = {
      name: event.name,
      category: event.cat ?? null,
      processId: event.pid,
      threadId: event.tid,
      traceStartMs: rounded(traceStartMs, 6),
      traceEndMs: rounded(traceEndMs, 6),
      traceDurationMs: rounded(event.dur / 1000, 6),
      startPageMs: rounded(traceStartMs - offsetMs, 3),
      endPageMs: rounded(traceEndMs - offsetMs, 3),
      startPageLowerMs: rounded(startPageLowerMs, 6),
      startPageUpperMs: rounded(startPageUpperMs, 6),
      endPageLowerMs: rounded(endPageLowerMs, 6),
      endPageUpperMs: rounded(endPageUpperMs, 6),
    };
    task.deadlineRelationship = classifyTaskDeadline(task, deadline);
    return [task];
  });
  const intervalTask = rendererMainTasks.toSorted((left, right) => right.traceDurationMs - left.traceDurationMs)[0] ?? null;
  const deadlineTaskCounts = Object.groupBy(rendererMainTasks, (task) => task.deadlineRelationship);
  return {
    valid: threadName === "CrRendererMain" && entryAnchor.pid != null && entryAnchor.tid != null,
    eventCount: events.length,
    pageAnchors: anchors.length,
    tracePageOffsetMs: rounded(offsetMs, 6),
    tracePageOffsetRangeMs: [rounded(offsetLowerMs, 6), rounded(offsetUpperMs, 6)],
    tracePageOffsetSpreadMs: rounded(offsetUpperMs - offsetLowerMs, 6),
    targetRenderer: {
      processId: entryAnchor.pid,
      mainThreadId: entryAnchor.tid,
      processName,
      threadName,
    },
    coverageWindowPageMs: [rounded(observationWindowStartMs, 3), rounded(observationWindowEndMs, 3)],
    rendererMainTaskCount: rendererMainTasks.length,
    maximumRendererMainTaskDurationMs: rounded(Math.max(0, ...rendererMainTasks.map((task) => task.traceDurationMs)), 3),
    deadlineTaskCounts: Object.fromEntries(Object.entries(deadlineTaskCounts).map(([key, value]) => [key, value.length])),
    longestRendererMainTask: intervalTask,
    rendererMainTasks,
  };
};
const historicalFiles = {
  m7oReport: "docs/architecture/GROUND_GLASS_M7O_CANVAS_ASSERTION_TIMING_REPORT.json",
  m7pReport: "docs/architecture/GROUND_GLASS_M7P_ASSERTION_SCHEDULING_REPORT.json",
  m7pNormalizedCapture: "docs/architecture/ground-glass-m7p-assertion-scheduling/capture/final/normalized-captures.json",
};
const expectedSourcePaths = [
  "playwright.config.ts",
  "src/tests/e2e/architecture-rise-focus-range.spec.ts",
  "src/tests/e2e/home.spec.ts",
  "src/tests/e2e/simulator-header.spec.ts",
  "src/tests/e2e/smoke.spec.ts",
  "src/tests/e2e/helpers/m7pAssertionSchedulingCapture.ts",
  "scripts/run-m7q-light-peer-trace-ab.mjs",
];

const runSummary = await readJson(summaryPath);
const captureSourceCommit = runSummary.captureSourceCommit;
if (typeof captureSourceCommit !== "string" || !/^[0-9a-f]{40}$/.test(captureSourceCommit)) {
  throw new Error("M7Q capture source commit is unavailable or malformed.");
}
const commitCheck = spawnSync("git", ["cat-file", "-e", `${captureSourceCommit}^{commit}`], { cwd: repositoryRoot, encoding: "utf8" });
if (commitCheck.status !== 0) throw new Error(`M7Q capture source ${captureSourceCommit} is unavailable in the local Git object database.`);
for (const sourcePath of expectedSourcePaths) {
  if (!verifyTreePath(captureSourceCommit, sourcePath)) throw new Error(`M7Q capture source tree is missing ${sourcePath}.`);
}
if (runSummary.attempts?.length !== 8) throw new Error("M7Q normalization requires all eight planned attempts.");
await mkdir(rawOutputDirectory, { recursive: true });
const existingEntries = await import("node:fs/promises").then(({ readdir }) => readdir(rawOutputDirectory));
if (existingEntries.length > 0) throw new Error("M7Q normalization refuses to overwrite existing retained raw evidence.");

const attempts = [];
for (const pair of pairs) {
  for (const arm of pair.order) {
    const captureId = `m7q-${pair.pairId}-${arm}`;
    const runMetadata = runSummary.attempts.find((attempt) => attempt.captureId === captureId);
    if (!runMetadata) throw new Error(`M7Q raw run summary is missing ${captureId}.`);
    const playwrightPath = resolve(inputDirectory, "playwright", `${captureId}.playwright.json`);
    const capturePath = resolve(inputDirectory, "artifacts", `${captureId}.capture.json`);
    const playwrightBytes = await readFile(playwrightPath);
    const captureBytes = await readFile(capturePath);
    const playwrightReport = JSON.parse(playwrightBytes.toString("utf8"));
    const capture = JSON.parse(captureBytes.toString("utf8"));
    const testResults = collectResults(playwrightReport.suites);
    const identities = testResults.map(({ file, title }) => `${file}::${title}`).sort();
    const identityMatch = JSON.stringify(identities) === JSON.stringify(expectedKeys);
    const overlap = deriveOverlap(testResults);
    const assertion = capture.assertion ?? {};
    const assertionOutcome = assertion.outcome ?? null;
    const targetResult = testResults.find((test) => test.file === expectedTests[0].file && test.title === targetTitle);
    const anchor = capture.publicEvaluationIntervals?.find((interval) => interval.label === "assertion-entry-anchor") ?? null;
    const deadline = deriveDeadline(capture);
    const snapshot = capture.browserSnapshot?.snapshot ?? null;
    const lifecycle = Array.isArray(snapshot?.lifecycle) ? snapshot.lifecycle : [];
    const firstCanvas = lifecycle.find((entry) => entry.canvasCount > 0 && entry.canvasConnected?.includes(true)) ?? null;
    const canvasObservationMs = firstCanvas?.browserMonotonicMs ?? null;
    const canvasDeadlineClassification = classifyCanvas(canvasObservationMs, deadline);
    const longTasks = (snapshot?.longTasks ?? []).map((item) => ({
      startMs: item.startMs,
      endMs: item.endMs,
      durationMs: item.durationMs,
      callbackDeliveredAtMs: item.callbackDeliveredAtMs,
      name: item.name,
    }));
    const nodeAssertionStart = assertion.nodeAssertionEntryMs;
    const nodeAssertionEnd = assertion.nodeAssertionSettledMs;
    const nodeHeartbeats = (capture.nodeHeartbeat ?? []).filter((item) => Number.isFinite(nodeAssertionStart)
      && Number.isFinite(nodeAssertionEnd) && item.observedAtMs >= nodeAssertionStart && item.observedAtMs <= nodeAssertionEnd);
    const browserAtEntryLower = deadline.browserAssertionEntryLowerMs;
    const browserAtEntryUpper = Number.isFinite(browserAtEntryLower) && Number.isFinite(deadline.anchorRoundTripMs)
      ? browserAtEntryLower + deadline.anchorRoundTripMs
      : null;
    const browserAtCatch = capture.publicEvaluationIntervals?.find((item) => item.label === "assertion-failure-catch")
      ?? capture.publicEvaluationIntervals?.find((item) => item.label === "assertion-settlement-snapshot");
    const pageHeartbeatWindow = (snapshot?.heartbeat ?? []).filter((item) => Number.isFinite(browserAtEntryLower)
      && Number.isFinite(browserAtCatch?.browserResult?.browserMonotonicMs)
      && item.observedAtMs >= browserAtEntryLower - deadline.roundingToleranceMs
      && item.observedAtMs <= browserAtCatch.browserResult.browserMonotonicMs + deadline.roundingToleranceMs);
    const traceEnabled = arm === "on";
    const tracePath = resolve(inputDirectory, "artifacts", `${captureId}.trace.json`);
    const traceMeta = capture.trace ?? {};
    let traceEvidence = {
      enabled: traceMeta.enabled === true,
      started: traceMeta.started === true,
      completed: traceMeta.completed === true,
      dataLossOccurred: traceMeta.dataLossOccurred ?? null,
      stopError: traceMeta.stopError ?? null,
      overflowedByCollector: traceMeta.overflowedByCollector === true,
      eventCount: traceMeta.traceEventCount ?? null,
      bufferSizeInKb: traceMeta.traceBufferSizeInKb ?? null,
      maximumBufferPercent: traceMeta.maximumBufferPercent ?? null,
      rawSizeBytes: traceMeta.rawTraceSizeBytes ?? 0,
      rawSha256: traceMeta.rawTraceSha256 ?? null,
      retainedPath: null,
      retainedGzipSha256: null,
      rendererEvidence: { valid: false, reason: "tracing-disabled" },
    };
    if (traceEnabled) {
      const traceBytes = await readFile(tracePath);
      const traceDocument = JSON.parse(traceBytes.toString("utf8"));
      const rawTraceSha256 = digest(traceBytes);
      if (rawTraceSha256 !== traceMeta.rawTraceSha256 || traceBytes.byteLength !== traceMeta.rawTraceSizeBytes) {
        throw new Error(`${captureId} raw Chromium trace digest/size does not match its capture metadata.`);
      }
      const retainedPath = `raw/${captureId}.trace.json.gz`;
      const gzipBytes = gzipSync(traceBytes, { level: 9, mtime: 0 });
      await writeFile(resolve(outputDirectory, retainedPath), gzipBytes, { flag: "wx" });
      const rendererEvidence = extractTraceEvidence(traceDocument, capture, deadline, snapshot);
      traceEvidence = {
        ...traceEvidence,
        retainedPath,
        retainedGzipSha256: digest(gzipBytes),
        rendererEvidence,
      };
    }

    const rawArtifacts = {};
    for (const [kind, bytes, suffix] of [
      ["playwrightReport", playwrightBytes, ".playwright.json"],
      ["m7pCapture", captureBytes, ".capture.json"],
    ]) {
      const retainedPath = `raw/${captureId}${suffix}`;
      await writeFile(resolve(outputDirectory, retainedPath), bytes, { flag: "wx" });
      rawArtifacts[kind] = { retainedPath, sha256: digest(bytes), sizeBytes: bytes.byteLength };
    }

    const pageLongTasksInAssertionWindow = longTasks.filter((task) => Number.isFinite(browserAtEntryLower)
      && Number.isFinite(browserAtCatch?.browserResult?.browserMonotonicMs)
      && task.startMs <= browserAtCatch.browserResult.browserMonotonicMs
      && task.endMs >= browserAtEntryLower);
    const validForComparison = identityMatch
      && testResults.length === 4
      && testResults.every((test) => test.projectName === "chromium" && test.retry === 0)
      && overlap.valid
      && overlap.overlap?.active === true
      && targetResult?.status === assertionOutcome
      && deadline.valid
      && firstCanvas !== null
      && snapshot?.lifecycleMutationObserverAvailable === true
      && snapshot?.longTaskObserverAvailable === true
      && capture.testIdentity?.endsWith(targetTitle)
      && Array.isArray(capture.publicEvaluationIntervals)
      && anchor !== null
      && traceMeta.enabled === traceEnabled
      && traceMeta.started === traceEnabled
      && traceMeta.completed === traceEnabled
      && (traceEnabled
        ? traceMeta.dataLossOccurred === false && traceMeta.overflowedByCollector === false
          && traceEvidence.rendererEvidence.valid
        : traceMeta.dataLossOccurred === null);

    attempts.push({
      captureId,
      pairId: pair.pairId,
      arm,
      executionOrder: [...pair.order],
      orderIndex: pair.order.indexOf(arm),
      tracingEnabled: traceEnabled,
      configuredWorkers: 4,
      retriesConfigured: 0,
      browserSideInstrumentationEnabled: true,
      cdpSessionCreated: true,
      webGlMode: "application-default-WebGL",
      sourceCommit: captureSourceCommit,
      portCleanup: {
        webServerPort: runMetadata.webServerPort,
        closedBeforeRun: runMetadata.portClosedBeforeRun,
        closedAfterRun: runMetadata.portClosedAfterRun?.closed === true,
      },
      outcomes: {
        exitCode: runMetadata.exitCode,
        target: targetResult?.status ?? "unavailable",
        targetAssertion: assertionOutcome,
        targetOutcomeConsistent: targetResult?.status === assertionOutcome,
        tests: testResults,
        identitiesMatch: identityMatch,
      },
      workerExecution: {
        configuredWorkers: 4,
        actualWorkerIds: overlap.workers,
        peakConcurrency: overlap.peakConcurrency,
        intervals: overlap.intervals ?? [],
        fourTestOverlap: overlap.overlap,
        valid: overlap.valid && overlap.overlap?.active === true,
      },
      assertion: {
        outcome: assertionOutcome,
        nodeEntryMs: assertion.nodeAssertionEntryMs ?? null,
        timeoutBudgetMs: assertion.timeoutBudgetMs ?? null,
        nodeInferredDeadlineMs: assertion.inferredNodeDeadlineMs ?? null,
        nodeSettledMs: assertion.nodeAssertionSettledMs ?? null,
        elapsedMs: Number.isFinite(nodeAssertionStart) && Number.isFinite(nodeAssertionEnd) ? nodeAssertionEnd - nodeAssertionStart : null,
        deadlineInterval: deadline,
        publicEvaluations: (capture.publicEvaluationIntervals ?? []).map((item) => ({
          label: item.label,
          requestStartedAtMs: item.requestStartedAtMs,
          responseSettledAtMs: item.responseSettledAtMs,
          browserMonotonicMs: item.browserResult?.browserMonotonicMs ?? null,
          scene: item.browserResult?.scene ?? null,
        })),
      },
      browserObservations: {
        firstConnectedCanvas: firstCanvas ? {
          browserMonotonicMs: canvasObservationMs,
          canvasCount: firstCanvas.canvasCount,
          canvasIdentities: firstCanvas.canvasIdentities,
          canvasConnected: firstCanvas.canvasConnected,
          rendererStatus: firstCanvas.rendererStatus,
          source: "MutationObserver-driven lifecycle snapshot; callback/sample time, not exact insertion time",
        } : null,
        canvasDeadlineClassification,
        lifecycleObservationCount: lifecycle.length,
        longTasks,
        longTaskDropped: snapshot?.longTaskDropped ?? null,
        longTasksDuringAssertionWindow: pageLongTasksInAssertionWindow,
        largestLongTaskDuringAssertionWindowMs: rounded(Math.max(0, ...pageLongTasksInAssertionWindow.map((task) => task.durationMs)), 3),
        pageHeartbeat: snapshot?.heartbeat ?? [],
        pageHeartbeatDropped: snapshot?.heartbeatDropped ?? null,
        pageHeartbeatDuringAssertionWindow: pageHeartbeatWindow,
        maximumPageHeartbeatDelayDuringAssertionWindowMs: rounded(Math.max(0, ...pageHeartbeatWindow.map((item) => item.intervalMs)), 3),
        nodeHeartbeatDuringAssertionWindow: nodeHeartbeats,
        nodeHeartbeatDropped: capture.nodeHeartbeatDropped ?? null,
        maximumNodeHeartbeatDelayDuringAssertionWindowMs: rounded(Math.max(0, ...nodeHeartbeats.map((item) => item.intervalMs)), 3),
        documentTimeOriginMs: snapshot?.documentTimeOriginMs ?? null,
        browserMonotonicMsAtCatch: browserAtCatch?.browserResult?.browserMonotonicMs ?? null,
        longTaskObserverAvailable: snapshot?.longTaskObserverAvailable === true,
        lifecycleMutationObserverAvailable: snapshot?.lifecycleMutationObserverAvailable === true,
      },
      trace: traceEvidence,
      rawArtifacts,
      validity: {
        validForComparison,
        originalRunnerPreliminaryFlag: runMetadata.captureValid === true,
        originalRunnerFlagCorrection: runMetadata.captureValid === true ? null
          : "The initial runner flag compared a file-prefixed testIdentity to a bare title and required trace clock-sync markers in trace-off arms; raw outcomes and capture bytes are preserved, and the corrected checks above validate the intended mode-specific contract.",
      },
    });
  }
}

const historicalEvidence = {};
for (const [key, path] of Object.entries(historicalFiles)) {
  const bytes = await readFile(resolve(repositoryRoot, path));
  historicalEvidence[key] = { path, sha256: digest(bytes) };
}
const normalized = {
  schemaVersion: 1,
  evidenceId: "m7q-matched-light-peer-trace-ab-v1",
  captureSourceCommit,
  captureSourceTreePaths: expectedSourcePaths,
  createdFromRawDirectoryLabel: "M7Q sequential eight-attempt capture bundle",
  rawEvidenceRetention: {
    playwrightReports: "original UTF-8 Playwright JSON reporter bytes retained unchanged",
    m7pCaptureFiles: "original JSON capture bytes retained unchanged",
    chromiumTraces: "gzip-compressed for repository size; gunzip reproduces original trace bytes and recorded SHA-256",
  },
  environment: {
    browserVersion: runSummary.browserVersion,
    playwrightVersion: runSummary.playwrightVersion,
    nodeVersion: runSummary.nodeVersion,
    platform: runSummary.host?.platform,
    osRelease: runSummary.host?.osRelease,
    architecture: runSummary.host?.architecture,
    cpuModel: runSummary.host?.cpuModel,
    cpuCount: runSummary.host?.cpuCount,
    rendererBackend: runSummary.rendererBackend,
    browserSideInstrumentationEnabled: runSummary.browserSideInstrumentationEnabled === true,
  },
  plannedPairs: pairs,
  expectedTests,
  attempts,
  historicalEvidence,
};
const normalizedPath = resolve(outputDirectory, "normalized-captures.json");
await writeFile(normalizedPath, `${JSON.stringify(normalized, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({
  normalizedPath,
  normalizedSha256: digest(Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`)),
  attempts: attempts.length,
  validAttempts: attempts.filter((attempt) => attempt.validity.validForComparison).length,
  outcomes: attempts.map((attempt) => ({ id: attempt.captureId, arm: attempt.arm, target: attempt.outcomes.target, valid: attempt.validity.validForComparison })),
}));
