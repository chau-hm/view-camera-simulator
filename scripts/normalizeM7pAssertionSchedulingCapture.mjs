import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  return separator < 0
    ? [argument.replace(/^--/, ""), "true"]
    : [argument.slice(2, separator), argument.slice(separator + 1)];
}));
const inputDirectory = resolve(args.get("input-dir") ?? "");
const outputPath = resolve(args.get("out") ?? resolve(repositoryRoot, "docs/architecture/ground-glass-m7p-assertion-scheduling/capture/final/normalized-captures.json"));
if (!args.has("input-dir")) throw new Error("Usage: npm run evidence:normalize:m7p -- --input-dir=/private/tmp/m7p-run ... [--out=path].");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const round = (value, digits = 3) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const clampWindow = (startMs, endMs, lowerMs, upperMs) => startMs <= upperMs && endMs >= lowerMs;

const runner = await readJson(resolve(inputDirectory, "m7p-run-summary.json"));
const captureRows = [];
for (const run of runner.runs) {
  for (const test of run.testResults) {
    if (test.identity !== "Architecture Rise focus control stays within scene depth and preserves thin-lens extension") continue;
    const captureId = run.captureId;
    const capturePath = resolve(inputDirectory, "artifacts", `${captureId}.capture.json`);
    const captureBytes = await readFile(capturePath);
    const capture = JSON.parse(captureBytes.toString("utf8"));
    const reportBytes = await readFile(run.reportPath);
    const playwrightReport = JSON.parse(reportBytes.toString("utf8"));
    const traceEnabled = capture.trace.enabled === true;
    const tracePath = capture.trace.rawTracePath;
    const traceBytes = traceEnabled && tracePath ? await readFile(tracePath) : null;
    const traceDocument = traceBytes ? JSON.parse(traceBytes.toString("utf8")) : null;
    const traceEvents = Array.isArray(traceDocument?.traceEvents) ? traceDocument.traceEvents : [];
    const pageAnchors = traceEvents.flatMap((event) => {
      const startTime = event.args?.data?.startTime;
      return typeof event.name === "string"
        && event.name.startsWith("m7p-")
        && typeof event.ts === "number"
        && typeof startTime === "number"
        ? [{ name: event.name, pageMs: startTime, traceMs: event.ts / 1000, pid: event.pid, tid: event.tid, offsetMs: event.ts / 1000 - startTime }]
        : [];
    });
    const pageTraceOffsets = pageAnchors.map((anchor) => anchor.offsetMs);
    const pageTraceOffsetMs = pageTraceOffsets.length > 0
      ? pageTraceOffsets.reduce((sum, value) => sum + value, 0) / pageTraceOffsets.length
      : null;
    const pageTraceOffsetSpreadMs = pageTraceOffsets.length > 0
      ? Math.max(...pageTraceOffsets) - Math.min(...pageTraceOffsets)
      : null;
    const clockEvents = traceEvents.flatMap((event) => {
      if (event.name !== "clock_sync" || typeof event.ts !== "number") return [];
      const syncId = event.args?.sync_id;
      const bracket = capture.nodeClockSyncBrackets.find((entry) => entry.syncId === syncId);
      return bracket ? [{ syncId, traceMs: event.ts / 1000, ...bracket }] : [];
    });
    const nodeTraceOffsetIntervals = clockEvents.map((event) => ({
      syncId: event.syncId,
      minimumOffsetMs: event.traceMs - event.settledAtMs,
      maximumOffsetMs: event.traceMs - event.startedAtMs,
      bracketWidthMs: event.settledAtMs - event.startedAtMs,
    }));
    const assertionAnchor = capture.publicEvaluationIntervals.find((entry) => entry.label === "assertion-entry-anchor");
    const browserAnchorMs = assertionAnchor?.browserResult?.browserMonotonicMs;
    const assertion = capture.assertion;
    const nodeAssertionEntryMs = assertion?.nodeAssertionEntryMs;
    const nodeAssertionDeadlineMs = assertion?.inferredNodeDeadlineMs;
    const anchorRequestStart = assertionAnchor?.requestStartedAtMs;
    const anchorResponseEnd = assertionAnchor?.responseSettledAtMs;
    const anchorRoundTripMs = typeof anchorRequestStart === "number" && typeof anchorResponseEnd === "number"
      ? anchorResponseEnd - anchorRequestStart
      : null;
    const browserAtAssertionEntry = typeof browserAnchorMs === "number"
      && typeof nodeAssertionEntryMs === "number"
      && typeof anchorResponseEnd === "number"
      ? browserAnchorMs + nodeAssertionEntryMs - anchorResponseEnd
      : null;
    const browserDeadlineLowerMs = typeof browserAtAssertionEntry === "number" && typeof anchorRoundTripMs === "number"
      ? browserAtAssertionEntry + 5_000 - anchorRoundTripMs
      : null;
    const browserDeadlineUpperMs = typeof browserAtAssertionEntry === "number"
      ? browserAtAssertionEntry + 5_000
      : null;
    const browserSnapshot = capture.browserSnapshot?.snapshot ?? null;
    const lifecycle = Array.isArray(browserSnapshot?.lifecycle) ? browserSnapshot.lifecycle : [];
    const firstCanvasObservation = lifecycle.find((entry) => entry.canvasCount > 0 && entry.canvasConnected?.includes(true)) ?? null;
    const canvasFirstBrowserMs = firstCanvasObservation?.browserMonotonicMs ?? null;
    let canvasBeforeDeadline = "unavailable-or-uncertain";
    if (typeof canvasFirstBrowserMs === "number" && typeof browserDeadlineLowerMs === "number" && typeof browserDeadlineUpperMs === "number") {
      if (canvasFirstBrowserMs <= browserDeadlineLowerMs) canvasBeforeDeadline = "observed-before-deadline";
      else if (canvasFirstBrowserMs > browserDeadlineUpperMs) canvasBeforeDeadline = "observed-after-deadline";
    }
    const assertionPageStartMs = browserAtAssertionEntry;
    const assertionPageEndMs = typeof browserSnapshot?.browserMonotonicMs === "number" ? browserSnapshot.browserMonotonicMs : null;
    const observationWindowStart = typeof assertionPageStartMs === "number" ? assertionPageStartMs - 200 : 0;
    const observationWindowEnd = typeof assertionPageEndMs === "number" ? assertionPageEndMs + 200 : Number.POSITIVE_INFINITY;

    let targetRendererPid = null;
    let targetRendererTid = null;
    const entryAnchor = pageAnchors.find((anchor) => anchor.name === "m7p-assertion-entry-anchor");
    if (entryAnchor) {
      targetRendererPid = entryAnchor.pid ?? null;
      targetRendererTid = entryAnchor.tid ?? null;
    }
    const settlementAnchor = pageAnchors.find((anchor) => anchor.name === "m7p-assertion-settlement-snapshot")
      ?? pageAnchors.find((anchor) => anchor.name === "m7p-assertion-failure-catch");
    const targetProcessPageTimes = pageTraceOffsetMs === null
      ? []
      : traceEvents.flatMap((event) => event.ph !== "M" && typeof event.ts === "number" && event.ts > 0 && event.pid === targetRendererPid
        ? [(event.ts / 1000) - pageTraceOffsetMs]
        : []);
    const traceCoverageWindow = traceEnabled && targetProcessPageTimes.length > 0
      ? {
          firstTargetRendererEventPageMs: round(targetProcessPageTimes.reduce((minimum, value) => Math.min(minimum, value), Number.POSITIVE_INFINITY)),
          lastTargetRendererEventPageMs: round(targetProcessPageTimes.reduce((maximum, value) => Math.max(maximum, value), Number.NEGATIVE_INFINITY)),
          assertionEntryMarkPageMs: entryAnchor ? round(entryAnchor.pageMs) : null,
          assertionSettlementMarkPageMs: settlementAnchor ? round(settlementAnchor.pageMs) : null,
          assertionEntryMarkPresent: entryAnchor !== undefined,
          assertionSettlementMarkPresent: settlementAnchor !== undefined,
          assertionWindowCovered: entryAnchor !== undefined && settlementAnchor !== undefined,
        }
      : null;
    const threadMetadata = traceEvents
      .filter((event) => event.ph === "M" && event.name === "thread_name")
      .map((event) => ({ pid: event.pid, tid: event.tid, name: event.args?.name }))
      .filter((event) => event.pid === targetRendererPid || event.name === "CrBrowserMain" || event.name === "CrGpuMain");
    const processMetadata = traceEvents
      .filter((event) => event.ph === "M" && event.name === "process_name")
      .map((event) => ({ pid: event.pid, name: event.args?.name }));
    const targetMainRunTasks = traceEvents.flatMap((event) => {
      if (!new Set(["RunTask", "ThreadControllerImpl::RunTask"]).has(event.name)
        || event.ph !== "X" || typeof event.ts !== "number" || typeof event.dur !== "number") return [];
      if (event.pid !== targetRendererPid || event.tid !== targetRendererTid || pageTraceOffsetMs === null) return [];
      const startPageMs = event.ts / 1000 - pageTraceOffsetMs;
      const endPageMs = (event.ts + event.dur) / 1000 - pageTraceOffsetMs;
      return clampWindow(startPageMs, endPageMs, observationWindowStart, observationWindowEnd)
        ? [{ name: event.name, category: event.cat ?? null, startPageMs: round(startPageMs), endPageMs: round(endPageMs), durationMs: round(event.dur / 1000), processId: event.pid, threadId: event.tid, attribution: "renderer-process main thread; RunTask does not itself encode a frame ID" }]
        : [];
    });
    const selectedTargetMainRunTasks = [...targetMainRunTasks]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 80)
      .sort((left, right) => left.startPageMs - right.startPageMs);
    const frameScopedEvents = traceEvents.flatMap((event) => {
      if (!new Set(["FunctionCall", "EvaluateScript", "UpdateLayoutTree", "Layout", "Paint"]).has(event.name)
        || event.ph !== "X" || typeof event.ts !== "number" || typeof event.dur !== "number") return [];
      if (event.args?.data?.frame !== capture.targetFrameId || pageTraceOffsetMs === null) return [];
      const startPageMs = event.ts / 1000 - pageTraceOffsetMs;
      const endPageMs = (event.ts + event.dur) / 1000 - pageTraceOffsetMs;
      return clampWindow(startPageMs, endPageMs, observationWindowStart, observationWindowEnd)
        ? [{ name: event.name, category: event.cat ?? null, startPageMs: round(startPageMs), endPageMs: round(endPageMs), durationMs: round(event.dur / 1000), frameId: event.args?.data?.frame, processId: event.pid, threadId: event.tid }]
        : [];
    });
    const selectedFrameScopedEvents = [...frameScopedEvents]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 120)
      .sort((left, right) => left.startPageMs - right.startPageMs);
    const longTasks = Array.isArray(browserSnapshot?.longTasks) ? browserSnapshot.longTasks : [];
    const assertionLongTasks = longTasks.filter((task) => typeof assertionPageStartMs === "number"
      && typeof assertionPageEndMs === "number"
      && clampWindow(task.startMs, task.endMs, assertionPageStartMs, assertionPageEndMs));
    const heartbeats = Array.isArray(browserSnapshot?.heartbeat) ? browserSnapshot.heartbeat : [];
    const assertionHeartbeats = heartbeats.filter((beat) => typeof assertionPageStartMs === "number"
      && typeof assertionPageEndMs === "number"
      && beat.observedAtMs >= assertionPageStartMs
      && beat.observedAtMs <= assertionPageEndMs);
    const nodeHeartbeats = Array.isArray(capture.nodeHeartbeat) ? capture.nodeHeartbeat : [];
    const assertionNodeHeartbeats = nodeHeartbeats.filter((beat) => typeof nodeAssertionEntryMs === "number"
      && typeof assertion?.nodeAssertionSettledMs === "number"
      && beat.observedAtMs >= nodeAssertionEntryMs
      && beat.observedAtMs <= assertion.nodeAssertionSettledMs);
    const preStall = capture.publicEvaluationIntervals.find((entry) => entry.label === "synthetic-control-before-stall")?.browserResult?.scene ?? null;
    const postStall = capture.publicEvaluationIntervals.find((entry) => entry.label === "assertion-failure-catch")?.browserResult?.scene
      ?? capture.publicEvaluationIntervals.find((entry) => entry.label === "assertion-settlement-snapshot")?.browserResult?.scene
      ?? null;
    const syntheticControl = run.condition === "P5"
      ? {
          configuredDurationMs: run.syntheticStallMs,
          observedDurationMs: capture.syntheticStall?.browserResult?.settledAtMs - capture.syntheticStall?.browserResult?.startedAtMs ?? null,
          browserTaskStartMs: capture.syntheticStall?.browserResult?.startedAtMs ?? null,
          browserTaskEndMs: capture.syntheticStall?.browserResult?.settledAtMs ?? null,
          canvasBefore: preStall?.canvasCount === 1 && preStall?.canvasConnected?.[0] === true,
          canvasDuring: "unobservable-while-main-thread-task-runs",
          canvasAtTaskReturn: capture.syntheticStall?.browserResult?.canvasCount ?? null,
          canvasAfter: postStall?.canvasCount === 1 && postStall?.canvasConnected?.[0] === true,
          taskObservedOnTargetRendererMainThread: targetMainRunTasks.some((event) => event.durationMs >= 5_300
            && typeof capture.syntheticStall?.browserResult?.startedAtMs === "number"
            && event.startPageMs <= capture.syntheticStall.browserResult.startedAtMs + 1
            && event.endPageMs >= capture.syntheticStall.browserResult.settledAtMs - 1),
          taskEventContainsFrameId: false,
        }
      : null;
    const userAgent = assertionAnchor?.browserResult?.userAgent ?? null;
    const browserVersion = typeof userAgent === "string" ? userAgent.match(/Chrome\/([0-9.]+)/)?.[1] ?? null : null;
    const testResults = run.testResults.map((item) => ({
      identity: item.identity,
      file: item.file,
      projectName: item.projectName,
      status: item.status,
      retry: item.retry,
      durationMs: item.durationMs,
      startTime: item.startTime,
      workerIndex: item.workerIndex,
      parallelIndex: item.parallelIndex,
      expectedStatus: item.expectedStatus,
    }));

    captureRows.push({
      captureId,
      condition: run.condition,
      conditionName: run.name,
      attempt: Number(captureId.match(/r(\d+)$/)?.[1] ?? 0),
      tracingEnabled: run.tracingEnabled,
      configuredWorkers: run.configuredWorkers,
      actualConcurrency: run.peakConcurrentTests,
      actualWorkers: new Set(testResults.map((item) => item.workerIndex)).size,
      testResults,
      retries: testResults.reduce((total, item) => total + item.retry, 0),
      targetAssertion: {
        outcome: assertion?.outcome ?? null,
        entryNodeMonotonicMs: round(nodeAssertionEntryMs),
        settlementNodeMonotonicMs: round(assertion?.nodeAssertionSettledMs),
        timeoutBudgetMs: assertion?.timeoutBudgetMs ?? null,
        inferredDeadlineNodeMonotonicMs: round(nodeAssertionDeadlineMs),
        elapsedNodeMs: typeof nodeAssertionEntryMs === "number" && typeof assertion?.nodeAssertionSettledMs === "number"
          ? round(assertion.nodeAssertionSettledMs - nodeAssertionEntryMs)
          : null,
      },
      clockAlignment: {
        assertionAnchorLabel: assertionAnchor?.label ?? null,
        browserAnchorMonotonicMs: round(browserAnchorMs),
        nodeAnchorRequestStartedAtMs: round(anchorRequestStart),
        nodeAnchorResponseSettledAtMs: round(anchorResponseEnd),
        requestResponseUncertaintyMs: round(anchorRoundTripMs),
        browserAtNodeAssertionEntryEstimateMs: round(browserAtAssertionEntry),
        inferredBrowserDeadlineIntervalMs: browserDeadlineLowerMs !== null && browserDeadlineUpperMs !== null
          ? [round(browserDeadlineLowerMs), round(browserDeadlineUpperMs)]
          : null,
        tracePageOffsetMs: round(pageTraceOffsetMs, 6),
        tracePageOffsetSpreadMs: round(pageTraceOffsetSpreadMs, 6),
        nodeTraceOffsetIntervals: nodeTraceOffsetIntervals.map((interval) => ({
          ...interval,
          minimumOffsetMs: round(interval.minimumOffsetMs, 6),
          maximumOffsetMs: round(interval.maximumOffsetMs, 6),
          bracketWidthMs: round(interval.bracketWidthMs, 6),
        })),
        domainsPreserved: true,
      },
      canvasAvailability: {
        classification: canvasBeforeDeadline,
        firstMutationObserverScanBrowserMonotonicMs: round(canvasFirstBrowserMs),
        firstObservationIsMutationTime: false,
        firstObservationSnapshot: firstCanvasObservation,
        finalSnapshot: browserSnapshot?.currentState ?? null,
      },
      browserMainThread: {
        longTaskObserverAvailable: browserSnapshot?.longTaskObserverAvailable === true,
        overlappingLongTasks: assertionLongTasks,
        heartbeatIntervalMs: browserSnapshot?.heartbeatIntervalMs ?? null,
        maximumHeartbeatIntervalMs: assertionHeartbeats.length > 0 ? round(Math.max(...assertionHeartbeats.map((beat) => beat.intervalMs))) : null,
        maximumHeartbeatExcessMs: assertionHeartbeats.length > 0 ? round(Math.max(...assertionHeartbeats.map((beat) => beat.excessOver50Ms))) : null,
        traceProcessAttribution: targetRendererPid === null ? null : { processId: targetRendererPid, mainThreadId: targetRendererTid, threadMetadata, processMetadata },
        targetRendererThreadName: threadMetadata.find((thread) => thread.pid === targetRendererPid && thread.tid === targetRendererTid)?.name ?? null,
        rendererMainRunTasks: selectedTargetMainRunTasks,
        frameScopedEvents: selectedFrameScopedEvents,
        nodeHeartbeatIntervalMs: 50,
        nodeHeartbeatSampleCount: assertionNodeHeartbeats.length,
        nodeHeartbeatMaximumIntervalMs: assertionNodeHeartbeats.length > 0 ? round(Math.max(...assertionNodeHeartbeats.map((beat) => beat.intervalMs))) : null,
        nodeHeartbeatMaximumExcessMs: assertionNodeHeartbeats.length > 0 ? round(Math.max(...assertionNodeHeartbeats.map((beat) => beat.excessOver50Ms))) : null,
        nodeHeartbeatDropped: capture.nodeHeartbeatDropped,
        gpuTraceCategoriesEnabled: false,
        gpuCausationClaim: "not-claimed",
      },
      syntheticControl,
      diagnosticCoverage: {
        traceEnabled,
        traceCompleted: capture.trace.completed,
        dataLossOccurred: capture.trace.dataLossOccurred,
        collectorOverflowed: capture.trace.overflowedByCollector,
        maximumTraceBufferUsage: round(capture.trace.maximumBufferPercent, 6),
        traceEventCount: capture.trace.traceEventCount,
        traceCoverageWindow,
        rawTraceSha256: capture.trace.rawTraceSha256,
        rawTraceSizeBytes: capture.trace.rawTraceSizeBytes,
        rawTracePathIsExternal: traceEnabled && typeof capture.trace.rawTracePath === "string" && !capture.trace.rawTracePath.startsWith(repositoryRoot),
        traceCaptureError: capture.trace.stopError,
        droppedOrTruncated: {
          chromiumReportedDataLoss: capture.trace.dataLossOccurred,
          collectorDroppedEvents: capture.trace.overflowedByCollector,
          browserLifecycleDropped: browserSnapshot?.lifecycleDropped ?? null,
          browserLongTaskDropped: browserSnapshot?.longTaskDropped ?? null,
          browserHeartbeatDropped: browserSnapshot?.heartbeatDropped ?? null,
          nodeHeartbeatDropped: capture.nodeHeartbeatDropped,
        },
        unsupportedObservation: {
          matcherInternalRetryTimestamps: true,
          perRetryLocatorResolutionResults: true,
          exactDomInsertionTime: true,
          pageAttributionForGenericRunTask: true,
          gpuExecutionAttribution: true,
        },
      },
      source: {
        executionCommitSha: runner.sourceCommit,
        instrumentationCommitSha: runner.sourceCommit,
        normalizerCommitSha: runner.sourceCommit,
        captureEvaluatorCommitSha: runner.sourceCommit,
      },
      environment: {
        nodeVersion: runner.nodeVersion,
        playwrightVersion: playwrightReport.config?.version ?? null,
        browserName: "Chromium",
        browserVersion,
        browserUserAgent: userAgent,
        operatingSystem: runner.host?.osRelease ?? null,
        platform: runner.host?.platform ?? null,
        browserStartupMode: "Playwright standard chromium project, headless",
        rendererBackend: "application default WebGL; WebGPU qualification flags remain disabled",
        contextPolicy: "Playwright test page/context isolated per test; worker browser processes may be shared",
      },
      rawPlaywright: {
        exitCode: run.exitCode,
        sha256: digest(reportBytes),
        sizeBytes: reportBytes.length,
        parsedRunStatus: playwrightReport.stats ?? null,
      },
    });
  }
}

const source = {
  executionSourceCommitSha: runner.sourceCommit,
  instrumentationSourceCommitSha: runner.sourceCommit,
  normalizerSourceCommitSha: runner.sourceCommit,
  evaluatorSourceCommitSha: runner.sourceCommit,
  sourceFiles: {
    execution: ["playwright.config.ts", "src/tests/e2e/architecture-rise-focus-range.spec.ts"],
    instrumentation: ["src/tests/e2e/helpers/m7pAssertionSchedulingCapture.ts"],
    runner: ["scripts/run-m7p-assertion-scheduling.mjs"],
    normalizer: ["scripts/normalizeM7pAssertionSchedulingCapture.mjs"],
    evaluator: ["scripts/evaluateM7pAssertionScheduling.ts", "scripts/run-m7p-evidence.mjs", "src/tests/unit/m7pAssertionSchedulingEvidence.test.ts"],
  },
};
const summary = {
  schemaVersion: 1,
  captureMatrixRevision: "m7p-assertion-scheduling-matrix-v1",
  source,
  captureEnvironment: {
    nodeVersion: runner.nodeVersion,
    playwrightVersion: "1.61.1",
    browserName: "Chromium",
    browserRevision: "chromium-1228 / chromium_headless_shell-1228",
    operatingSystem: runner.host?.osRelease ?? null,
    platform: runner.host?.platform ?? null,
    browserStartupMode: "Playwright standard chromium project, headless",
    rendererBackend: "application default WebGL; WebGPU qualification flags remain disabled",
    ordinaryProject: "chromium",
    serialProjectUsed: false,
  },
  captureCount: captureRows.length,
  attemptsPerCondition: Object.fromEntries([...new Set(captureRows.map((row) => row.condition))].map((condition) => [
    condition,
    captureRows.filter((row) => row.condition === condition).length,
  ])),
  captures: captureRows,
};
summary.outcomesByCondition = Object.fromEntries([...new Set(captureRows.map((capture) => capture.condition))].map((condition) => [
  condition,
  captureRows.filter((capture) => capture.condition === condition)
    .flatMap((capture) => capture.testResults.map((result) => `${result.identity}:${result.status}`))
    .sort(),
]));
summary.targetOutcomesByCondition = Object.fromEntries([...new Set(captureRows.map((capture) => capture.condition))].map((condition) => [
  condition,
  captureRows.filter((capture) => capture.condition === condition).map((capture) => capture.targetAssertion.outcome),
]));
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};
const outcomeSeries = (condition) => captureRows
  .filter((capture) => capture.condition === condition)
  .map((capture) => capture.targetAssertion.outcome);
const assertionDurationSeries = (condition) => captureRows
  .filter((capture) => capture.condition === condition && capture.targetAssertion.elapsedNodeMs !== null)
  .map((capture) => capture.targetAssertion.elapsedNodeMs);
summary.traceOverheadAssessment = {
  instrumentationHeldConstant: true,
  assertionElapsedMs: {
    P1TracingOff: assertionDurationSeries("P1"),
    P2TracingOn: assertionDurationSeries("P2"),
    medianOffMs: median(assertionDurationSeries("P1")),
    medianOnMs: median(assertionDurationSeries("P2")),
    medianDifferenceOnMinusOffMs: median(assertionDurationSeries("P2")) !== null && median(assertionDurationSeries("P1")) !== null
      ? median(assertionDurationSeries("P2")) - median(assertionDurationSeries("P1"))
      : null,
  },
  heavyWorkloadTargetOutcomes: {
    tracingOff: outcomeSeries("P4-off"),
    tracingOn: outcomeSeries("P4-trace"),
  },
  interpretation: "Descriptive repeated-capture comparison only; not a causal estimate of tracing overhead.",
};
const outputBytes = Buffer.from(`${JSON.stringify(summary, null, 2)}\n`);
await writeFile(outputPath, outputBytes);
console.log(JSON.stringify({ outputPath, sha256: digest(outputBytes), captureCount: captureRows.length }));
