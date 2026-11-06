import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifyM7pDeadlineObservation,
  classifyM7pTaskDeadlineOverlap,
  evaluateM7pAssertionSchedulingEvidence,
  reconstructM7pWorkerOverlap,
} from "../../../scripts/evaluateM7pAssertionScheduling";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const reportPath = "docs/architecture/GROUND_GLASS_M7P_ASSERTION_SCHEDULING_REPORT.json";
type JsonRecord = Record<string, unknown>;
const workerKeys = [
  "architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
  "home.spec.ts::light home peer",
  "simulator-header.spec.ts::light header peer",
  "smoke.spec.ts::light smoke peer",
];
const workerRows = () => {
  const start = 1_700_000_000_000;
  const offsets = [0, 1, 2, 3];
  const durations = [10, 10, 8, 7];
  return workerKeys.map((key, index) => {
    const [file, identity] = key.split("::");
    return {
      file,
      identity,
      startTime: new Date(start + offsets[index]!).toISOString(),
      durationMs: durations[index],
      workerIndex: index,
      parallelIndex: index,
    };
  });
};

describe("M7P timing and concurrency mathematics", () => {
  it("classifies observations against the complete independently specified deadline interval", () => {
    const deadline = [6_000, 6_100];
    expect(classifyM7pDeadlineObservation(5_950, deadline)).toBe("observed-before-deadline");
    expect(classifyM7pDeadlineObservation(6_050, deadline)).toBe("unavailable-or-uncertain");
    expect(classifyM7pDeadlineObservation(6_150, deadline)).toBe("observed-after-deadline");
    expect(classifyM7pDeadlineObservation(6_000, [6_000, 6_000])).toBe("unavailable-or-uncertain");
    expect(classifyM7pDeadlineObservation(5_998, [6_000, 6_000])).toBe("observed-before-deadline");
    expect(classifyM7pDeadlineObservation(6_002, [6_000, 6_000])).toBe("observed-after-deadline");
  });

  it("fails closed for missing, inverted, and non-finite deadline inputs", () => {
    expect(classifyM7pDeadlineObservation(6_050, null)).toBe("unavailable-or-uncertain");
    expect(classifyM7pDeadlineObservation(6_050, [6_100, 6_000])).toBe("unavailable-or-uncertain");
    expect(classifyM7pDeadlineObservation(Number.POSITIVE_INFINITY, [6_000, 6_100])).toBe("unavailable-or-uncertain");
    expect(classifyM7pDeadlineObservation(6_050, [Number.NaN, 6_100])).toBe("unavailable-or-uncertain");
  });

  it("distinguishes definite, possible, and absent task/deadline overlap", () => {
    const deadline = [100, 110];
    expect(classifyM7pTaskDeadlineOverlap({ startPageMs: 0, endPageMs: 120, durationMs: 120 }, deadline, 1))
      .toBe("definitely-spans-deadline");
    expect(classifyM7pTaskDeadlineOverlap({ startPageMs: 104, endPageMs: 106, durationMs: 2 }, deadline, 1))
      .toBe("possibly-overlaps-deadline");
    expect(classifyM7pTaskDeadlineOverlap({ startPageMs: 70, endPageMs: 90, durationMs: 20 }, deadline, 1))
      .toBe("does-not-overlap");
    expect(classifyM7pTaskDeadlineOverlap({ startPageMs: 104, endPageMs: 106, durationMs: 2 }, deadline, 1))
      .not.toBe("definitely-spans-deadline");
  });

  it("marks malformed task intervals and attribution clocks unverifiable", () => {
    expect(classifyM7pTaskDeadlineOverlap({ startPageMs: 120, endPageMs: 100, durationMs: 20 }, [100, 110], 0))
      .toBe("unverifiable");
    expect(classifyM7pTaskDeadlineOverlap({ startPageMs: 100, endPageMs: 110, durationMs: 3 }, [100, 110], 0))
      .toBe("unverifiable");
    expect(classifyM7pTaskDeadlineOverlap({ startPageMs: 0, endPageMs: 120, durationMs: 120 }, [110, 100], 0))
      .toBe("unverifiable");
    expect(classifyM7pTaskDeadlineOverlap({ startPageMs: 0, endPageMs: 120, durationMs: 120 }, [100, 110], Number.NaN))
      .toBe("unverifiable");
  });

  it("rejects missing, invalid, inverted, and non-finite deadline anchor evidence", async () => {
    for (const mutate of [
      (timing: JsonRecord) => { delete timing.browserAnchorMonotonicMs; },
      (timing: JsonRecord) => { timing.nodeAnchorRequestStartedAtMs = 9_000; },
      (timing: JsonRecord) => { timing.inferredBrowserDeadlineIntervalMs = [6_100, 6_000]; },
      (timing: JsonRecord) => { timing.inferredBrowserDeadlineIntervalMs = [null, 6_100]; },
    ]) {
      const { report, summary } = await acceptedEvidence();
      mutate(findCapture(summary, "P1", 1).clockAlignment as JsonRecord);
      const result = await evaluateMutation(report, summary);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("m7p-timestamp-domain-alignment-invalid");
    }
  });

  it("accepts a valid zero-width anchor and deadline interval", async () => {
    const { report, summary } = await acceptedEvidence();
    const capture = findCapture(summary, "P1", 1);
    const timing = capture.clockAlignment as JsonRecord;
    timing.nodeAnchorResponseSettledAtMs = timing.nodeAnchorRequestStartedAtMs;
    timing.requestResponseUncertaintyMs = 0;
    const browserEntry = Number(timing.browserAnchorMonotonicMs)
      + Number((capture.targetAssertion as JsonRecord).entryNodeMonotonicMs)
      - Number(timing.nodeAnchorResponseSettledAtMs);
    timing.browserAtNodeAssertionEntryEstimateMs = Number(browserEntry.toFixed(3));
    const deadline = Number((browserEntry + 5_000).toFixed(3));
    timing.inferredBrowserDeadlineIntervalMs = [deadline, deadline];
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(true);
  });

  it("reconstructs a non-empty four-test overlap with the target and four workers", () => {
    const rows = workerRows();
    const result = reconstructM7pWorkerOverlap(rows, workerKeys, workerKeys[0]!, 4);
    expect(result.valid).toBe(true);
    expect(result.peakConcurrency).toBe(4);
    expect(result.workerIds).toEqual([0, 1, 2, 3]);
    expect(result.parallelIds).toEqual([0, 1, 2, 3]);
    expect(result.fourTestOverlap).toMatchObject({ active: true, durationMs: 7, targetParticipated: true });
  });

  it.each([
    ["two actual workers", workerRows().map((row, index) => ({ ...row, workerIndex: Math.floor(index / 2) }))],
    ["four workers without time overlap", workerRows().map((row, index) => ({ ...row, startTime: new Date(1_700_000_000_000 + index * 20_000).toISOString() }))],
    ["only three simultaneous tests", workerRows().map((row, index) => ({ ...row, startTime: index === 3 ? new Date(1_700_000_004_000).toISOString() : row.startTime, durationMs: index === 3 ? 1_000 : 3_000 }))],
    ["target absent from the common interval", workerRows().map((row, index) => ({ ...row, startTime: index === 0 ? new Date(1_700_000_004_000).toISOString() : row.startTime, durationMs: index === 0 ? 1_000 : 3_000 }))],
    ["duplicate worker IDs", workerRows().map((row, index) => ({ ...row, workerIndex: index === 3 ? 2 : row.workerIndex }))],
    ["missing or malformed start time", workerRows().map((row, index) => index === 0 ? { ...row, startTime: "not-a-date" } : row)],
    ["negative execution duration", workerRows().map((row, index) => index === 0 ? { ...row, durationMs: -1 } : row)],
    ["zero execution duration", workerRows().map((row, index) => index === 0 ? { ...row, durationMs: 0 } : row)],
    ["non-finite execution duration", workerRows().map((row, index) => index === 0 ? { ...row, durationMs: Number.NaN } : row)],
  ])("does not establish four-way overlap for %s", (_name, rows) => {
    const result = reconstructM7pWorkerOverlap(rows, workerKeys, workerKeys[0]!, 4);
    expect(result.fourTestOverlap?.active).not.toBe(true);
  });
});

describe("M7P assertion scheduling evidence evaluator", () => {
  it("accepts the retained M7P investigation through the production CLI", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, reportPath), "utf8")) as JsonRecord;
    expect((report.qualification as JsonRecord).broadE2eQualification).toBe("not-qualified");
    expect((report.qualification as JsonRecord).m7Overall).toBe("partially-qualified");
    const output = execFileSync(process.execPath, ["scripts/run-m7p-evidence.mjs"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    expect(output).toContain("M7P evidence integrity: PASS");
  });

  it("rejects a missing required trace-on heavy-workload attempt", async () => {
    const { report, summary } = await acceptedEvidence();
    summary.captures = (summary.captures as JsonRecord[]).filter((capture) => capture.captureId !== "p4-trace-r3");
    summary.captureCount = (summary.captureCount as number) - 1;
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-capture-matrix-incomplete");
    expect(result.issues).toContain("m7p-required-capture-condition-missing");
  });

  it("rejects retries in any selected test", async () => {
    const { report, summary } = await acceptedEvidence();
    const capture = findCapture(summary, "P3", 1);
    (capture.testResults as JsonRecord[])[0]!.retry = 1;
    capture.retries = 1;
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-unexpected-retry-observed");
  });

  it("rejects configured four-worker runs without measured overlap", async () => {
    const { report, summary } = await acceptedEvidence();
    const capture = findCapture(summary, "P4-trace", 2);
    capture.actualConcurrency = 1;
    capture.actualWorkers = 1;
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-worker-overlap-evidence-invalid");
  });

  it("rejects a four-way summary when test intervals do not prove overlap", async () => {
    const { report, summary } = await acceptedEvidence();
    const results = findCapture(summary, "P3", 1).testResults as JsonRecord[];
    results.forEach((result, index) => { result.startTime = new Date(1_700_000_000_000 + index * 20_000).toISOString(); });
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-four-way-worker-overlap-not-established");
    expect(result.issues).toContain("m7p-worker-overlap-evidence-invalid");
  });

  it.each(["before", "after"] as const)("rejects a trace task moved entirely %s the corrected deadline", async (direction) => {
    const { report, summary } = await acceptedEvidence();
    const capture = findCapture(summary, "P3", 1);
    moveTasksOutsideDeadline(capture, direction);
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-task-overlap-classification-inconsistent");
    expect(result.issues).toContain("m7p-task-deadline-summary-inconsistent");
  });

  it.each([
    ["inverted task endpoints", (task: JsonRecord) => { task.endPageMs = Number(task.startPageMs) - 1; }],
    ["duration inconsistent with endpoints", (task: JsonRecord) => { task.durationMs = Number(task.durationMs) + 10; }],
  ])("rejects %s in retained renderer-main-thread tasks", async (_name, mutateTask) => {
    const { report, summary } = await acceptedEvidence();
    const tasks = (findCapture(summary, "P3", 1).browserMainThread as JsonRecord).rendererMainRunTasks as JsonRecord[];
    mutateTask(tasks.find((task) => task.deadlineOverlapClassification === "definitely-spans-deadline")!);
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-renderer-main-task-evidence-invalid");
  });

  it("rejects task process or thread identities outside the recorded target renderer", async () => {
    for (const field of ["processId", "threadId"]) {
      const { report, summary } = await acceptedEvidence();
      const tasks = (findCapture(summary, "P3", 1).browserMainThread as JsonRecord).rendererMainRunTasks as JsonRecord[];
      tasks.find((task) => task.deadlineOverlapClassification === "definitely-spans-deadline")![field] = -1;
      const result = await evaluateMutation(report, summary);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("m7p-renderer-main-task-evidence-invalid");
    }
  });

  it("rejects removed CrRendererMain metadata", async () => {
    const { report, summary } = await acceptedEvidence();
    const thread = findCapture(summary, "P3", 1).browserMainThread as JsonRecord;
    const process = thread.traceProcessAttribution as JsonRecord;
    const metadata = process.threadMetadata as JsonRecord[];
    const targetMetadataIndex = metadata.findIndex((entry) => entry.pid === process.processId && entry.tid === process.mainThreadId);
    metadata.splice(targetMetadataIndex, 1);
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-target-renderer-thread-attribution-invalid");
  });

  it("rejects a shifted deadline interval even if the trace metadata remains plausible", async () => {
    const { report, summary } = await acceptedEvidence();
    const interval = (findCapture(summary, "P3", 1).clockAlignment as JsonRecord).inferredBrowserDeadlineIntervalMs as number[];
    interval[0] -= 100;
    interval[1] -= 100;
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-timestamp-domain-alignment-invalid");
  });

  it("rejects a task whose retained interval no longer supports its declared overlap", async () => {
    const { report, summary } = await acceptedEvidence();
    const capture = findCapture(summary, "P3", 1);
    moveTasksOutsideDeadline(capture, "before");
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-diagnosis-task-overlap-summary-inconsistent");
  });

  it("rejects a possible task/deadline overlap falsely labeled definite", async () => {
    const { report, summary } = await acceptedEvidence();
    const capture = findCapture(summary, "P3", 1);
    const interval = (capture.clockAlignment as JsonRecord).inferredBrowserDeadlineIntervalMs as number[];
    const offset = Number((capture.clockAlignment as JsonRecord).tracePageOffsetMs);
    const task = ((capture.browserMainThread as JsonRecord).rendererMainRunTasks as JsonRecord[])
      .find((entry) => entry.deadlineOverlapClassification === "definitely-spans-deadline")!;
    task.startPageMs = interval[0]! + 1;
    task.endPageMs = interval[0]! + 3;
    task.durationMs = 2;
    task.traceStartMs = Number((Number(task.startPageMs) + offset).toFixed(6));
    task.traceEndMs = Number((Number(task.endPageMs) + offset).toFixed(6));
    task.traceDurationMs = 2;
    task.deadlineOverlapClassification = "definitely-spans-deadline";
    expect(classifyM7pTaskDeadlineOverlap(task as { startPageMs: number; endPageMs: number; durationMs: number }, interval, 0.1))
      .toBe("possibly-overlaps-deadline");
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-task-overlap-classification-inconsistent");
  });

  it("rejects unsupported GPU-causation claims on task evidence", async () => {
    const { report, summary } = await acceptedEvidence();
    (findCapture(summary, "P3", 1).browserMainThread as JsonRecord).gpuCausationClaim = "gpu-saturation-caused-failure";
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-unsupported-causal-claim");
  });

  it.each([
    ["only two actual workers", (results: JsonRecord[]) => { results.forEach((result, index) => { result.workerIndex = Math.floor(index / 2); }); }],
    ["four distinct workers with no overlap", (results: JsonRecord[]) => { results.forEach((result, index) => { result.startTime = new Date(1_700_000_000_000 + index * 20_000).toISOString(); }); }],
    ["only three tests overlapping", (results: JsonRecord[]) => { results.forEach((result, index) => { result.startTime = new Date(1_700_000_000_000 + (index === 3 ? 4_000 : 0)).toISOString(); result.durationMs = 1_000; }); }],
    ["target missing from common overlap", (results: JsonRecord[]) => { results.forEach((result, index) => { result.startTime = new Date(1_700_000_000_000 + (index === 0 ? 4_000 : index * 1_000)).toISOString(); result.durationMs = index === 0 ? 1_000 : 3_000; }); }],
    ["duplicate worker identities", (results: JsonRecord[]) => { results[3]!.workerIndex = results[2]!.workerIndex; }],
    ["malformed start timestamp", (results: JsonRecord[]) => { results[0]!.startTime = "invalid"; }],
    ["negative duration", (results: JsonRecord[]) => { results[0]!.durationMs = -1; }],
    ["zero duration", (results: JsonRecord[]) => { results[0]!.durationMs = 0; }],
    ["non-finite duration", (results: JsonRecord[]) => { results[0]!.durationMs = null; }],
  ])("rejects four-worker evidence with %s", async (_name, mutateResults) => {
    const { report, summary } = await acceptedEvidence();
    mutateResults(findCapture(summary, "P3", 1).testResults as JsonRecord[]);
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-four-way-worker-overlap-not-established");
  });

  it("rejects a report summary that claims four-way overlap when intervals prove less", async () => {
    const { report, summary } = await acceptedEvidence();
    findCapture(summary, "P3", 1).actualConcurrency = 2;
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-worker-overlap-evidence-invalid");
  });

  it("rejects a tracing-on capture labeled as tracing off", async () => {
    const { report, summary } = await acceptedEvidence();
    findCapture(summary, "P2", 1).tracingEnabled = false;
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-instrumentation-condition-mislabeled");
  });

  it("rejects an unavailable source commit even when its SHA has valid syntax", async () => {
    const { report, summary } = await acceptedEvidence();
    const source = summary.source as JsonRecord;
    const missingSha = "0".repeat(40);
    for (const field of ["executionSourceCommitSha", "instrumentationSourceCommitSha", "normalizerSourceCommitSha", "evaluatorSourceCommitSha"]) {
      source[field] = missingSha;
      (report.source as JsonRecord)[field] = missingSha;
    }
    for (const capture of summary.captures as JsonRecord[]) {
      for (const field of ["executionCommitSha", "instrumentationCommitSha", "normalizerCommitSha", "captureEvaluatorCommitSha"]) {
        (capture.source as JsonRecord)[field] = missingSha;
      }
    }
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-source-commit-unavailable");
  });

  it("rejects an available commit that lacks the pinned M7P source tree entries", async () => {
    const { report, summary } = await acceptedEvidence();
    const olderCommit = "7c5b1892afedd50af4aa5718a1fa6ed19cb6ec1e";
    const source = summary.source as JsonRecord;
    for (const field of ["executionSourceCommitSha", "instrumentationSourceCommitSha", "normalizerSourceCommitSha", "evaluatorSourceCommitSha"]) {
      source[field] = olderCommit;
      (report.source as JsonRecord)[field] = olderCommit;
    }
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-source-tree-entry-missing");
  });

  it("rejects swapping the declared instrumentation source role", async () => {
    const { report, summary } = await acceptedEvidence();
    const source = summary.source as JsonRecord;
    (source.sourceFiles as JsonRecord).instrumentation = ["scripts/run-m7p-assertion-scheduling.mjs"];
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-source-file-contract-invalid");
  });

  it("rejects a capture whose role-specific source identity disagrees with the report", async () => {
    const { report, summary } = await acceptedEvidence();
    const capture = findCapture(summary, "P2", 1);
    (capture.source as JsonRecord).captureEvaluatorCommitSha = (report.source as JsonRecord).executionSourceCommitSha;
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-capture-source-identity-mismatch");
  });

  it("rejects trace loss and invalid raw trace digests", async () => {
    const { report, summary } = await acceptedEvidence();
    const coverage = findCapture(summary, "P2", 1).diagnosticCoverage as JsonRecord;
    coverage.dataLossOccurred = true;
    coverage.rawTraceSha256 = "bad-digest";
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-trace-provenance-or-coverage-invalid");
  });

  it("rejects contradictory timestamp domains and unaligned trace clocks", async () => {
    const { report, summary } = await acceptedEvidence();
    const capture = findCapture(summary, "P2", 1);
    const clock = capture.clockAlignment as JsonRecord;
    clock.domainsPreserved = false;
    clock.nodeTraceOffsetIntervals = [];
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-timestamp-domain-alignment-invalid");
    expect(result.issues).toContain("m7p-trace-clock-alignment-invalid");
  });

  it("rejects claims that private Playwright matcher retries were observed", async () => {
    const { report } = await acceptedEvidence();
    ((report.diagnosis as JsonRecord).claims as JsonRecord).internalMatcherRetryTimestampsAvailable = true;
    const result = await evaluateMutation(report);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-unsupported-causal-claim");
  });

  it("rejects GPU saturation or renderer-specific causation without direct evidence", async () => {
    const { report } = await acceptedEvidence();
    const claims = (report.diagnosis as JsonRecord).claims as JsonRecord;
    claims.gpuSaturationEstablished = true;
    claims.rendererSpecificMechanismEstablished = true;
    const result = await evaluateMutation(report);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-unsupported-causal-claim");
  });

  it("rejects a synthetic result relabeled as part of the renderer-heavy cohort", async () => {
    const { report, summary } = await acceptedEvidence();
    const syntheticResult = findCapture(summary, "P5", 1).syntheticControl;
    findCapture(summary, "P4-trace", 1).syntheticControl = syntheticResult;
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-synthetic-result-mislabeled-as-historical-workload");
  });

  it("requires the P5 control to prove bounded duration and actual Canvas observations", async () => {
    const { report, summary } = await acceptedEvidence();
    const control = findCapture(summary, "P5", 1).syntheticControl as JsonRecord;
    control.canvasBefore = false;
    control.taskObservedOnTargetRendererMainThread = false;
    const result = await evaluateMutation(report, summary);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7p-synthetic-intervention-evidence-invalid");
  });

  it("returns nonzero from the CLI for unsupported qualification and causality claims", async () => {
    const { report } = await acceptedEvidence();
    (report.qualification as JsonRecord).broadE2eQualification = "qualified";
    ((report.diagnosis as JsonRecord).claims as JsonRecord).gpuSaturationEstablished = true;
    const fixture = await writeFixture(report);
    try {
      const result = spawnSync(process.execPath, ["scripts/run-m7p-evidence.mjs", `--report-path=${fixture.reportRelativePath}`], {
        cwd: repositoryRoot,
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("M7P evidence integrity: FAIL");
      expect(result.stderr).toContain("m7p-qualification-boundary-invalid");
      expect(result.stderr).toContain("m7p-unsupported-causal-claim");
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });
});

const acceptedEvidence = async () => {
  const report = JSON.parse(await readFile(resolve(repositoryRoot, reportPath), "utf8")) as JsonRecord;
  const summaryRef = report.captureSummary as JsonRecord;
  const summary = JSON.parse(await readFile(resolve(repositoryRoot, String(summaryRef.artifactPath)), "utf8")) as JsonRecord;
  return { report, summary };
};

const findCapture = (summary: JsonRecord, condition: string, attempt: number) => {
  const capture = (summary.captures as JsonRecord[]).find((entry) => entry.condition === condition && entry.attempt === attempt);
  if (!capture) throw new Error(`Missing accepted ${condition} attempt ${attempt}.`);
  return capture;
};

const moveTasksOutsideDeadline = (capture: JsonRecord, direction: "before" | "after") => {
  const interval = (capture.clockAlignment as JsonRecord).inferredBrowserDeadlineIntervalMs as number[];
  const offset = Number((capture.clockAlignment as JsonRecord).tracePageOffsetMs);
  const tasks = ((capture.browserMainThread as JsonRecord).rendererMainRunTasks as JsonRecord[]);
  for (const task of tasks) {
    const duration = Number(task.durationMs);
    const end = direction === "before" ? interval[0]! - 100 : interval[1]! + 100 + duration;
    const start = end - duration;
    task.startPageMs = Number(start.toFixed(3));
    task.endPageMs = Number(end.toFixed(3));
    task.durationMs = Number((Number(task.endPageMs) - Number(task.startPageMs)).toFixed(3));
    task.traceStartMs = Number((Number(task.startPageMs) + offset).toFixed(6));
    task.traceEndMs = Number((Number(task.endPageMs) + offset).toFixed(6));
    task.traceDurationMs = Number(Number(task.durationMs).toFixed(6));
  }
};

const writeFixture = async (report: JsonRecord, summary?: JsonRecord) => {
  const directory = await mkdtemp(resolve(repositoryRoot, ".m7p-evidence-test-"));
  const reportFile = resolve(directory, "report.json");
  const reportForWrite = structuredClone(report) as JsonRecord;
  if (summary) {
    const summaryFile = resolve(directory, "normalized-captures.json");
    const summaryBytes = Buffer.from(`${JSON.stringify(summary, null, 2)}\n`);
    await writeFile(summaryFile, summaryBytes);
    reportForWrite.captureSummary = {
      artifactPath: `${relativeToRepository(directory)}/normalized-captures.json`,
      sha256: createHash("sha256").update(summaryBytes).digest("hex"),
    };
  }
  await writeFile(reportFile, `${JSON.stringify(reportForWrite, null, 2)}\n`);
  return { directory, reportPath: reportFile, reportRelativePath: relativeToRepository(reportFile) };
};

const relativeToRepository = (path: string) => path.slice(repositoryRoot.length + 1);

const evaluateMutation = async (report: JsonRecord, summary?: JsonRecord) => {
  const fixture = await writeFixture(report, summary);
  try {
    return await evaluateM7pAssertionSchedulingEvidence(fixture.reportRelativePath);
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
};
