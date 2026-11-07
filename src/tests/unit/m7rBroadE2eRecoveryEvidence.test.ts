import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deriveM7rWorkerEvidence, evaluateM7rBroadE2eRecovery, M7R_EVALUATOR_REVISION } from "../../../scripts/evaluateM7rBroadE2eRecovery";

type JsonRecord = Record<string, unknown>;
const reportPath = resolve(process.cwd(), "docs/architecture/GROUND_GLASS_M7R_BROAD_E2E_QUALIFICATION_RECOVERY_REPORT.json");
let acceptedReport: JsonRecord;
let temporaryReportPath: string | null = null;

const clone = <T>(value: T): T => structuredClone(value);
const record = (value: unknown): JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const workerInterval = (parallelIndex: number, startEpochMs: number, durationMs: number, workerIndex = parallelIndex) => ({
  identity: `test-${parallelIndex}`,
  status: "passed",
  workerIndex,
  parallelIndex,
  startEpochMs,
  durationMs,
});

describe("M7R broad E2E recovery evidence evaluator", () => {
  beforeAll(() => {
    acceptedReport = JSON.parse(readFileSync(reportPath, "utf8")) as JsonRecord;
  });

  afterAll(() => {
    if (temporaryReportPath) unlinkSync(temporaryReportPath);
  });

  it("accepts the complete, raw-linked M7R capture without promoting qualification", () => {
    const result = evaluateM7rBroadE2eRecovery(acceptedReport);
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.executionCompleteness).toBe("complete");
    expect(result.broadE2eQualification).toBe("not-qualified");
    expect(result.evaluatorRevision).toBe(M7R_EVALUATOR_REVISION);
  });

  it("rejects a claim that the current Broad E2E suite is qualified", () => {
    const mutated = clone(acceptedReport);
    record(mutated.qualification).broadE2eQualification = "qualified";
    const result = evaluateM7rBroadE2eRecovery(mutated);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7r-qualification-boundaries-invalid");
  });

  it("rejects a changed current outcome summary even when raw digests remain valid", () => {
    const mutated = clone(acceptedReport);
    record(mutated.summary).unexpected = Number(record(mutated.summary).unexpected) + 1;
    const result = evaluateM7rBroadE2eRecovery(mutated);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7r-combined-outcome-summary-invalid");
  });

  it("rejects an unsupported application root-cause claim", () => {
    const mutated = clone(acceptedReport);
    const claims = record(mutated.claims);
    claims.establishedRootCauses = ["renderer resource leak"];
    const result = evaluateM7rBroadE2eRecovery(mutated);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7r-unsupported-causal-or-qualification-claim");
  });

  it("keeps per-identity causes unclassified and skip exclusions unapproved", () => {
    const inventory = record(acceptedReport).testInventory;
    expect(Array.isArray(inventory)).toBe(true);
    expect((inventory as unknown[])).toHaveLength(278);
    const skipped = (inventory as JsonRecord[]).filter((entry) => entry.currentActualStatus === "skipped");
    const unexpected = (inventory as JsonRecord[]).filter((entry) => entry.currentActualStatus !== entry.currentExpectedStatus);
    expect(skipped).toHaveLength(75);
    expect(skipped.every((entry) => record(entry.currentSkipAudit).exclusionApproval === "unapproved")).toBe(true);
    expect(unexpected.every((entry) => record(entry).rootCauseCategory === "insufficient-evidence"
      && record(entry).rootCauseConfidence === "unclassified")).toBe(true);
  });

  it("reconciles all historical M7K outcomes without calling one-run passes fixes", () => {
    const dispositions = record(record(acceptedReport).historicalReconciliation).dispositions;
    expect(record(dispositions)).toMatchObject({
      "expected-in-both": 181,
      "historical-unexpected-now-expected": 12,
      "new-current-unexpected": 15,
      "unexpected-changed-signature": 23,
      "unexpected-same-signature": 47,
    });
    const inventory = record(acceptedReport).testInventory as JsonRecord[];
    expect(inventory.filter((entry) => entry.historicalDisposition === "historical-unexpected-now-expected")
      .every((entry) => entry.recommendedAction === "record-current-pass-once; do-not-label-fixed")).toBe(true);
  });

  it("rejects an analyst promotion of an unverified root cause", () => {
    const mutated = clone(acceptedReport);
    const inventory = record(mutated).testInventory as JsonRecord[];
    const unexpected = inventory.find((entry) => entry.currentActualStatus !== entry.currentExpectedStatus);
    if (!unexpected) throw new Error("Expected at least one currently unexpected identity.");
    unexpected.rootCauseCategory = "verified-application-regression";
    unexpected.rootCauseConfidence = "verified";
    const result = evaluateM7rBroadE2eRecovery(mutated);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7r-per-test-inventory-not-derived-from-raw");
  });

  it("derives non-empty four-worker overlap from raw start and duration intervals", () => {
    const evidence = deriveM7rWorkerEvidence([
      workerInterval(0, 100, 100),
      workerInterval(1, 110, 100),
      workerInterval(2, 120, 100),
      workerInterval(3, 130, 100),
    ]);
    expect(evidence.parallelWorkerIndexes).toEqual([0, 1, 2, 3]);
    expect(evidence.peakConcurrentWorkers).toBe(4);
    expect(evidence.longestOverlap.durationMs).toBeGreaterThan(0);
    expect(evidence.longestOverlap.activeWorkers).toEqual([0, 1, 2, 3]);
  });

  it("does not infer simultaneous workers from four sequential intervals", () => {
    const evidence = deriveM7rWorkerEvidence([
      workerInterval(0, 0, 10),
      workerInterval(1, 10, 10),
      workerInterval(2, 20, 10),
      workerInterval(3, 30, 10),
    ]);
    expect(evidence.parallelWorkerIndexes).toEqual([0, 1, 2, 3]);
    expect(evidence.peakConcurrentWorkers).toBe(1);
    expect(evidence.longestOverlap.durationMs).toBe(0);
  });

  it("rejects malformed execution intervals instead of counting them as active workers", () => {
    const evidence = deriveM7rWorkerEvidence([
      workerInterval(0, 0, -10),
      { ...workerInterval(1, 10, 10), startEpochMs: Number.NaN },
      { ...workerInterval(2, 20, 10), parallelIndex: -1 },
      { ...workerInterval(3, 30, 10), workerIndex: -1 },
    ]);
    expect(evidence.validExecutionIntervals).toBe(0);
    expect(evidence.invalidExecutionIntervals).toBe(4);
    expect(evidence.peakConcurrentWorkers).toBe(0);
  });

  it("rejects a normalized worker summary that contradicts raw Playwright intervals", () => {
    const normalizedClaim = record(record(acceptedReport.artifacts).normalizedCapture);
    const normalizedPath = resolve(process.cwd(), String(normalizedClaim.path));
    const normalized = JSON.parse(readFileSync(normalizedPath, "utf8")) as JsonRecord;
    const ordinarySummary = record(record(record(normalized.lanes).ordinary).summary);
    ordinarySummary.workerEvidence = {
      ...record(ordinarySummary.workerEvidence),
      peakConcurrentWorkers: 2,
    };
    const temporaryNormalized = resolve(process.cwd(), `.m7r-mutated-normalized-${process.pid}.json`);
    writeFileSync(temporaryNormalized, `${JSON.stringify(normalized, null, 2)}\n`, { flag: "wx" });
    try {
      const mutated = clone(acceptedReport);
      const artifact = record(record(mutated.artifacts).normalizedCapture);
      artifact.path = basename(temporaryNormalized);
      artifact.sha256 = sha256(readFileSync(temporaryNormalized));
      const result = evaluateM7rBroadE2eRecovery(mutated);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("m7r-ordinary-normalized-outcomes-mismatch");
    } finally {
      unlinkSync(temporaryNormalized);
    }
  });

  it("makes the production-facing CLI exit nonzero for contradictory qualification metadata", () => {
    const mutated = clone(acceptedReport);
    record(mutated.qualification).broadE2eQualification = "qualified";
    temporaryReportPath = resolve(process.cwd(), `.m7r-invalid-report-${process.pid}.json`);
    writeFileSync(temporaryReportPath, `${JSON.stringify(mutated, null, 2)}\n`, { flag: "wx" });
    const relativeReportPath = basename(temporaryReportPath);
    const result = spawnSync(process.execPath, ["scripts/run-m7r-evidence.mjs", `--report-path=${relativeReportPath}`], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("m7r-qualification-boundaries-invalid");
  });
});
