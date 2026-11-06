import { readFileSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  classifyM7qCanvasObservation,
  classifyM7qTaskDeadlineRelationship,
  deriveM7qDeadlineInterval,
  deriveM7qFourWorkerOverlap,
  evaluateM7qLightPeerTraceAb,
  runM7qEvidenceCli,
} from "../../../scripts/evaluateM7qLightPeerTraceAb";

const reportPath = resolve(process.cwd(), "docs/architecture/GROUND_GLASS_M7Q_LIGHT_PEER_TRACE_AB_REPORT.json");
const capturesPath = resolve(process.cwd(), "docs/architecture/ground-glass-m7q-light-peer-trace-ab/capture/final/normalized-captures.json");
const validReport = JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, unknown>;
const validCaptures = JSON.parse(readFileSync(capturesPath, "utf8")) as Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);
const attempts = (captures: Record<string, unknown>) => captures.attempts as Array<Record<string, unknown>>;
const attempt = (captures: Record<string, unknown>, captureId: string) => attempts(captures).find((entry) => entry.captureId === captureId) as Record<string, unknown>;
const outcomes = (capture: Record<string, unknown>) => capture.outcomes as Record<string, unknown>;
const tests = (capture: Record<string, unknown>) => outcomes(capture).tests as Array<Record<string, unknown>>;
const workerExecution = (capture: Record<string, unknown>) => capture.workerExecution as Record<string, unknown>;
const assertion = (capture: Record<string, unknown>) => capture.assertion as Record<string, unknown>;
const trace = (capture: Record<string, unknown>) => capture.trace as Record<string, unknown>;
const renderer = (capture: Record<string, unknown>) => trace(capture).rendererEvidence as Record<string, unknown>;
const issuesFor = (report = clone(validReport), captures = clone(validCaptures)) => evaluateM7qLightPeerTraceAb(report, captures).issues;

describe("M7Q evidence contract", () => {
  it("accepts the eight valid matched captures and the documented Path B result", () => {
    expect(evaluateM7qLightPeerTraceAb(validReport, validCaptures)).toEqual({ passed: true, issues: [] });
  });

  it("derives the forward browser deadline bracket independently from the public evaluation round trip", () => {
    const interval = deriveM7qDeadlineInterval({
      browserAnchorMs: 1_000,
      nodeRequestStartedAtMs: 100,
      nodeResponseSettledAtMs: 200,
      nodeAssertionEntryMs: 200,
      timeoutBudgetMs: 5_000,
    });
    expect(interval).toEqual({ valid: true, lowerMs: 6_000, upperMs: 6_100, roundTripMs: 100 });
    expect(classifyM7qCanvasObservation(5_950, { lowerMs: 6_000, upperMs: 6_100 })).toBe("observed-before-deadline");
    expect(classifyM7qCanvasObservation(6_050, { lowerMs: 6_000, upperMs: 6_100 })).toBe("deadline-interval-uncertain");
    expect(classifyM7qCanvasObservation(6_150, { lowerMs: 6_000, upperMs: 6_100 })).toBe("observed-after-deadline");
  });

  it("handles a zero-width deadline and fails closed for invalid anchor metadata", () => {
    expect(deriveM7qDeadlineInterval({
      browserAnchorMs: 1_000,
      nodeRequestStartedAtMs: 200,
      nodeResponseSettledAtMs: 200,
      nodeAssertionEntryMs: 200,
      timeoutBudgetMs: 5_000,
    })).toEqual({ valid: true, lowerMs: 6_000, upperMs: 6_000, roundTripMs: 0 });
    expect(deriveM7qDeadlineInterval({
      browserAnchorMs: 1_000,
      nodeRequestStartedAtMs: 200,
      nodeResponseSettledAtMs: 100,
      nodeAssertionEntryMs: 200,
      timeoutBudgetMs: 5_000,
    }).valid).toBe(false);
    expect(deriveM7qDeadlineInterval({
      browserAnchorMs: Number.NaN,
      nodeRequestStartedAtMs: 100,
      nodeResponseSettledAtMs: 200,
      nodeAssertionEntryMs: 200,
      timeoutBudgetMs: 5_000,
    }).valid).toBe(false);
  });

  it("keeps possible deadline overlap distinct from definite coverage", () => {
    const deadline = { lowerMs: 5_000, upperMs: 5_100 };
    expect(classifyM7qTaskDeadlineRelationship({ startPageLowerMs: 4_000, startPageUpperMs: 4_020, endPageLowerMs: 5_200, endPageUpperMs: 5_220 }, deadline))
      .toBe("definitely-spans-deadline-interval");
    expect(classifyM7qTaskDeadlineRelationship({ startPageLowerMs: 5_050, startPageUpperMs: 5_070, endPageLowerMs: 5_200, endPageUpperMs: 5_220 }, deadline))
      .toBe("possibly-overlaps-deadline");
    expect(classifyM7qTaskDeadlineRelationship({ startPageLowerMs: 4_000, startPageUpperMs: 4_020, endPageLowerMs: 4_900, endPageUpperMs: 4_920 }, deadline))
      .toBe("does-not-overlap-deadline");
    expect(classifyM7qTaskDeadlineRelationship({ startPageLowerMs: 6_000, startPageUpperMs: 5_000, endPageLowerMs: 6_100, endPageUpperMs: 6_200 }, deadline))
      .toBe("unverifiable");
  });

  it("reconstructs a non-empty four-worker intersection from test intervals", () => {
    const intervals = workerExecution(attempt(validCaptures, "m7q-pair-1-off")).intervals as Array<Record<string, unknown>>;
    const result = deriveM7qFourWorkerOverlap(intervals);
    expect(result.valid).toBe(true);
    expect(result.peakConcurrency).toBe(4);
    expect(result.overlap?.active).toBe(true);
    expect(result.overlap?.workerIds).toEqual([0, 1, 2, 3]);
    expect(result.overlap?.targetParticipated).toBe(true);
  });

  it("rejects missing, duplicate, or misordered attempts", () => {
    const missing = clone(validCaptures);
    attempts(missing).pop();
    expect(issuesFor(validReport, missing)).toContain("m7q-planned-attempt-count-invalid");

    const duplicate = clone(validCaptures);
    attempts(duplicate)[1] = clone(attempts(duplicate)[0]);
    expect(issuesFor(validReport, duplicate)).toContain("m7q-attempt-identities-missing-or-duplicated");

    const misordered = clone(validCaptures);
    attempts(misordered).reverse();
    expect(issuesFor(validReport, misordered).some((issue) => issue.includes("pair-order-invalid"))).toBe(true);
  });

  it("rejects retries, unexpected identities, and a changed tracing mode", () => {
    const retry = clone(validCaptures);
    tests(attempt(retry, "m7q-pair-1-off"))[0].retry = 1;
    expect(issuesFor(validReport, retry).some((issue) => issue.includes("project-or-retry-invalid"))).toBe(true);

    const identity = clone(validCaptures);
    tests(attempt(identity, "m7q-pair-1-off"))[0].title = "an unrelated test";
    expect(issuesFor(validReport, identity).some((issue) => issue.includes("test-inventory-invalid"))).toBe(true);

    const tracing = clone(validCaptures);
    attempt(tracing, "m7q-pair-1-off").tracingEnabled = true;
    expect(issuesFor(validReport, tracing).some((issue) => issue.includes("control-configuration-invalid"))).toBe(true);
  });

  it("rejects configured four-worker claims without four-way overlap", () => {
    const onlyTwoWorkers = clone(validCaptures);
    const affected = attempt(onlyTwoWorkers, "m7q-pair-1-off");
    const execution = workerExecution(affected);
    const rows = execution.intervals as Array<Record<string, unknown>>;
    rows[2].workerIndex = 0;
    rows[2].parallelIndex = 0;
    rows[3].workerIndex = 1;
    rows[3].parallelIndex = 1;
    expect(issuesFor(validReport, onlyTwoWorkers)).toContain("m7q-attempt-m7q-pair-1-off-four-worker-overlap-invalid");

    const nonOverlapping = clone(validCaptures);
    const nonOverlappingAttempt = attempt(nonOverlapping, "m7q-pair-1-off");
    const nonOverlappingExecution = workerExecution(nonOverlappingAttempt);
    const intervals = nonOverlappingExecution.intervals as Array<Record<string, unknown>>;
    intervals.forEach((row, index) => {
      row.startEpochMs = Number(row.startEpochMs) + index * 20_000;
      row.endEpochMs = Number(row.startEpochMs) + Number(row.durationMs);
    });
    expect(issuesFor(validReport, nonOverlapping)).toContain("m7q-attempt-m7q-pair-1-off-four-worker-overlap-invalid");

    const threeWay = clone(validCaptures);
    const threeWayRows = workerExecution(attempt(threeWay, "m7q-pair-1-off")).intervals as Array<Record<string, unknown>>;
    threeWayRows[3].startEpochMs = Math.max(...threeWayRows.slice(0, 3).map((item) => Number(item.endEpochMs))) + 1;
    threeWayRows[3].endEpochMs = Number(threeWayRows[3].startEpochMs) + Number(threeWayRows[3].durationMs);
    expect(issuesFor(validReport, threeWay)).toContain("m7q-attempt-m7q-pair-1-off-four-worker-overlap-invalid");
  });

  it("rejects malformed test times and a target missing from the common interval", () => {
    const malformed = clone(validCaptures);
    const row = (workerExecution(attempt(malformed, "m7q-pair-1-off")).intervals as Array<Record<string, unknown>>)[0];
    row.durationMs = 0;
    expect(issuesFor(validReport, malformed)).toContain("m7q-attempt-m7q-pair-1-off-four-worker-overlap-invalid");

    const targetLate = clone(validCaptures);
    const targetRow = (workerExecution(attempt(targetLate, "m7q-pair-1-off")).intervals as Array<Record<string, unknown>>)
      .find((item) => String(item.identity).startsWith("architecture-rise-focus-range.spec.ts::")) as Record<string, unknown>;
    targetRow.startEpochMs = Number(targetRow.startEpochMs) + 20_000;
    targetRow.endEpochMs = Number(targetRow.startEpochMs) + Number(targetRow.durationMs);
    expect(issuesFor(validReport, targetLate)).toContain("m7q-attempt-m7q-pair-1-off-four-worker-overlap-invalid");
  });

  it("rejects shifted, reversed, or reclassified browser deadline evidence", () => {
    const shifted = clone(validCaptures);
    const shiftedInterval = assertion(attempt(shifted, "m7q-pair-1-off")).deadlineInterval as Record<string, unknown>;
    shiftedInterval.deadlineLowerMs = Number(shiftedInterval.deadlineLowerMs) - 1_000;
    shiftedInterval.deadlineUpperMs = Number(shiftedInterval.deadlineUpperMs) - 1_000;
    expect(issuesFor(validReport, shifted).some((issue) => issue.includes("deadline-lower-inconsistent"))).toBe(true);

    const inverted = clone(validCaptures);
    const invertedInterval = assertion(attempt(inverted, "m7q-pair-1-off")).deadlineInterval as Record<string, unknown>;
    invertedInterval.deadlineUpperMs = Number(invertedInterval.deadlineLowerMs) - 1;
    expect(issuesFor(validReport, inverted).some((issue) => issue.includes("deadline-interval-invalid"))).toBe(true);

    const wrongCanvas = clone(validCaptures);
    const browser = attempt(wrongCanvas, "m7q-pair-1-off").browserObservations as Record<string, unknown>;
    browser.canvasDeadlineClassification = "observed-after-deadline";
    expect(issuesFor(validReport, wrongCanvas).some((issue) => issue.includes("canvas-deadline-classification-invalid"))).toBe(true);
  });

  it("rejects trace loss, missing CrRendererMain attribution, or an unsupported task overlap", () => {
    const lost = clone(validCaptures);
    trace(attempt(lost, "m7q-pair-1-on")).dataLossOccurred = true;
    expect(issuesFor(validReport, lost)).toContain("m7q-attempt-m7q-pair-1-on-trace-evidence-invalid");

    const unnamed = clone(validCaptures);
    const rendererEvidence = renderer(attempt(unnamed, "m7q-pair-1-on"));
    (rendererEvidence.targetRenderer as Record<string, unknown>).threadName = "unknown";
    expect(issuesFor(validReport, unnamed)).toContain("m7q-attempt-m7q-pair-1-on-trace-evidence-invalid");

    const early = clone(validCaptures);
    const earlyRenderer = renderer(attempt(early, "m7q-pair-1-on"));
    const earlyTask = (earlyRenderer.rendererMainTasks as Array<Record<string, unknown>>)
      .find((item) => item.deadlineRelationship === "definitely-spans-deadline-interval") as Record<string, unknown>;
    earlyTask.startPageLowerMs = 0;
    earlyTask.startPageUpperMs = 1;
    earlyTask.endPageLowerMs = 2;
    earlyTask.endPageUpperMs = 3;
    expect(issuesFor(validReport, early).some((issue) => issue.includes("trace-task-evidence-invalid"))).toBe(true);
    expect(issuesFor(validReport, early)).toContain("m7q-attempt-m7q-pair-1-on-trace-evidence-invalid");
  });

  it("rejects inverted or duration-inconsistent trace intervals", () => {
    const inverted = clone(validCaptures);
    const rendererEvidence = renderer(attempt(inverted, "m7q-pair-1-on"));
    const task = (rendererEvidence.rendererMainTasks as Array<Record<string, unknown>>)[0];
    task.traceEndMs = Number(task.traceStartMs) - 1;
    expect(issuesFor(validReport, inverted).some((issue) => issue.includes("trace-task-evidence-invalid"))).toBe(true);

    const duration = clone(validCaptures);
    const durationRenderer = renderer(attempt(duration, "m7q-pair-1-on"));
    const durationTask = (durationRenderer.rendererMainTasks as Array<Record<string, unknown>>)[0];
    durationTask.traceDurationMs = Number(durationTask.traceDurationMs) + 10;
    expect(issuesFor(validReport, duration).some((issue) => issue.includes("trace-task-evidence-invalid"))).toBe(true);

    const wrongProcess = clone(validCaptures);
    const processRenderer = renderer(attempt(wrongProcess, "m7q-pair-1-on"));
    const processTask = (processRenderer.rendererMainTasks as Array<Record<string, unknown>>)
      .find((item) => item.deadlineRelationship === "definitely-spans-deadline-interval") as Record<string, unknown>;
    processTask.processId = -1;
    expect(issuesFor(validReport, wrongProcess).some((issue) => issue.includes("trace-task-evidence-invalid"))).toBe(true);
  });

  it("rejects a possible task overlap falsely represented as definite", () => {
    const mutated = clone(validCaptures);
    const traceEvidence = renderer(attempt(mutated, "m7q-pair-1-on"));
    const tasks = traceEvidence.rendererMainTasks as Array<Record<string, unknown>>;
    const spanningIndex = tasks.findIndex((item) => item.deadlineRelationship === "definitely-spans-deadline-interval");
    const spanning = tasks[spanningIndex];
    spanning.startPageLowerMs = Number(assertion(attempt(mutated, "m7q-pair-1-on")).deadlineInterval
      && (assertion(attempt(mutated, "m7q-pair-1-on")).deadlineInterval as Record<string, unknown>).deadlineLowerMs) + 20;
    spanning.startPageUpperMs = Number(spanning.startPageLowerMs) + 10;
    spanning.deadlineRelationship = "definitely-spans-deadline-interval";
    expect(issuesFor(validReport, mutated).some((issue) => issue.includes("trace-task-evidence-invalid"))).toBe(true);
  });

  it("rejects raw digest metadata, source identity, or historical evidence mutation", () => {
    const source = clone(validCaptures);
    source.captureSourceCommit = "ffffffffffffffffffffffffffffffffffffffff";
    expect(issuesFor(validReport, source)).toContain("m7q-capture-source-provenance-invalid");

    const digestMutation = clone(validCaptures);
    (((attempt(digestMutation, "m7q-pair-1-on").rawArtifacts as Record<string, unknown>).playwrightReport) as Record<string, unknown>).sha256 = "bad";
    expect(issuesFor(validReport, digestMutation).some((issue) => issue.includes("digest-metadata-invalid"))).toBe(true);

    const history = clone(validCaptures);
    (((history.historicalEvidence as Record<string, unknown>).m7oReport) as Record<string, unknown>).sha256 = "0".repeat(64);
    expect(issuesFor(validReport, history).some((issue) => issue.includes("historical-evidence-m7oReport-pin-invalid"))).toBe(true);
  });

  it("rejects renderer or GPU causal promotion, Broad E2E promotion, and WebGPU authorization", () => {
    const causal = clone(validReport);
    (causal.primaryFinding as Record<string, unknown>).gpuSaturationEstablished = true;
    expect(issuesFor(causal)).toContain("m7q-primary-causal-claim-unsupported");

    const renderer = clone(validReport);
    (renderer.primaryFinding as Record<string, unknown>).rendererSpecificCausation = "confirmed";
    expect(issuesFor(renderer)).toContain("m7q-primary-causal-claim-unsupported");

    const broad = clone(validReport);
    (broad.qualificationBoundaries as Record<string, unknown>).broadE2e = "qualified";
    expect(issuesFor(broad)).toContain("m7q-qualification-boundary-invalid");

    const webGpu = clone(validReport);
    (webGpu.qualificationBoundaries as Record<string, unknown>).productionWebGpu = "enabled";
    expect(issuesFor(webGpu)).toContain("m7q-qualification-boundary-invalid");
  });

  it("keeps the production-facing CLI nonzero when a retained raw trace digest is altered", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "m7q-cli-negative-"));
    try {
      const sourceEvidence = resolve(process.cwd(), "docs/architecture/ground-glass-m7q-light-peer-trace-ab/capture/final");
      const destinationEvidence = resolve(temporaryRoot, "docs/architecture/ground-glass-m7q-light-peer-trace-ab/capture/final");
      await cp(sourceEvidence, destinationEvidence, { recursive: true });
      const temporaryReport = resolve(temporaryRoot, "GROUND_GLASS_M7Q_LIGHT_PEER_TRACE_AB_REPORT.json");
      await cp(reportPath, temporaryReport);
      const cliArgs = [`--report-path=${temporaryReport}`, `--evidence-root=${temporaryRoot}`];
      expect(await runM7qEvidenceCli(cliArgs)).toBe(0);

      const tracePath = join(destinationEvidence, "raw/m7q-pair-1-on.trace.json.gz");
      const traceBytes = await readFile(tracePath);
      traceBytes[traceBytes.length - 1] ^= 0xff;
      await writeFile(tracePath, traceBytes);
      expect(await runM7qEvidenceCli(cliArgs)).toBe(1);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
