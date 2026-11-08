import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  evaluateM7wEvidence,
  flattenM7wPlaywrightReport,
  measureM7wConcurrency,
  verifyM7wDigest,
} from "../../../scripts/evaluateM7wQualification.mjs";

const reportPath = "docs/architecture/GROUND_GLASS_M7W_WEBGL_QUALIFICATION_REPORT.json";
const inventoryPath = "docs/architecture/ground-glass-m7v-skip-governance/current-inventory-reconciliation.json";

const originalReport = JSON.parse(readFileSync(reportPath, "utf8"));
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const ordinaryRaw = JSON.parse(readFileSync(originalReport.captures.ordinary.publicRaw.path, "utf8"));
const serialRaw = JSON.parse(readFileSync(originalReport.captures.rendererSerial.publicRaw.path, "utf8"));
const representativeRaw = JSON.parse(readFileSync(originalReport.captures.representativeSingle.publicRaw.path, "utf8"));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fixture() {
  const report = clone(originalReport);
  const rawCaptures = {
    ordinary: clone(ordinaryRaw),
    rendererSerial: clone(serialRaw),
    representativeSingle: clone(representativeRaw),
  };
  const inventories = {
    ordinaryProject: inventory.profiles.standard.tests.filter((test: { project: string }) => test.project === "chromium").map((test: { identity: string }) => test.identity),
    ordinaryRequired: inventory.profiles.standard.tests.filter((test: { lane: string }) => test.lane === "ordinary-webgl").map((test: { identity: string }) => test.identity),
    ordinaryNonMandatory: inventory.profiles.standard.tests.filter((test: { project: string; lane: string }) => test.project === "chromium" && test.lane !== "ordinary-webgl").map((test: { identity: string }) => test.identity),
    rendererSerialRequired: inventory.profiles.standard.tests.filter((test: { lane: string }) => test.lane === "renderer-serial").map((test: { identity: string }) => test.identity),
    m7uAddedIdentities: inventory.reconciliation.m7uAddedIdentities,
    historicalOrdinaryByIdentity: Object.fromEntries(inventory.profiles.standard.tests
      .filter((test: { lane: string }) => test.lane === "ordinary-webgl")
      .map((test: { identity: string; historicalM7rOutcome: string | null }) => [test.identity, test.historicalM7rOutcome ?? "unknown"])),
  };
  return { report, rawCaptures, inventories };
}

function resultFor(fx: ReturnType<typeof fixture>) {
  return evaluateM7wEvidence(fx);
}

describe("M7W execution evidence integrity", () => {
  it("accepts the retained complete lane captures and their M7V-derived identity projection", () => {
    expect(resultFor(fixture())).toEqual({ passed: true, issues: [] });
  });

  it("rejects a missing mandatory execution identity", () => {
    const fx = fixture();
    fx.rawCaptures.ordinary.suites.at(-1).specs.at(-1).tests.pop();
    expect(resultFor(fx).issues).toContain("ordinary-normalized-results-mismatch");
    expect(resultFor(fx).issues).toContain("ordinary-identity-inventory-mismatch");
  });

  it("rejects duplicate identity rows", () => {
    const fx = fixture();
    const lastSuite = fx.rawCaptures.ordinary.suites.at(-1);
    lastSuite.specs.push(clone(lastSuite.specs.at(-1)));
    expect(resultFor(fx).issues).toContain("ordinary-normalized-results-mismatch");
    expect(resultFor(fx).issues).toContain("ordinary-duplicate-identity");
  });

  it("rejects a required test represented as skipped", () => {
    const fx = fixture();
    fx.report.captures.ordinary.results.find((row: { identity: string }) => fx.inventories.ordinaryRequired.includes(row.identity)).status = "skipped";
    expect(resultFor(fx).issues).toContain("ordinary-mandatory-unexpected-skip");
  });

  it("rejects a test assigned to the wrong Playwright project", () => {
    const fx = fixture();
    fx.rawCaptures.ordinary.suites[0].specs[0].tests[0].projectName = "chromium-renderer-serial";
    expect(resultFor(fx).issues).toContain("ordinary-wrong-project");
    expect(resultFor(fx).issues).toContain("ordinary-normalized-results-mismatch");
  });

  it("rejects a missing reporter artifact", () => {
    const fx = fixture();
    fx.rawCaptures.ordinary = null as never;
    expect(resultFor(fx).issues).toContain("ordinary-capture-missing");
  });

  it("detects a changed artifact digest against the retained bytes", () => {
    const fx = fixture();
    const bytes = readFileSync(fx.report.captures.ordinary.publicRaw.path);
    expect(verifyM7wDigest(bytes, fx.report.captures.ordinary.publicRaw.sha256)).toBe(true);
    fx.report.captures.ordinary.publicRaw.sha256 = "0".repeat(64);
    expect(verifyM7wDigest(bytes, fx.report.captures.ordinary.publicRaw.sha256)).toBe(false);
  });

  it("rejects an execution source revision outside the pinned M7V merge", () => {
    const fx = fixture();
    fx.report.provenance.executionSourceCommitSha = "a".repeat(40);
    expect(resultFor(fx).issues).toContain("execution-source-revision-invalid");
  });

  it("requires the current evaluator bytes to match the report's pinned source content", () => {
    const pin = originalReport.provenance.analysisSourceFiles.find((item: { path: string }) => item.path === "scripts/evaluateM7wQualification.mjs");
    const sourceBytes = readFileSync(pin.path);
    expect(verifyM7wDigest(sourceBytes, pin.sha256)).toBe(true);
    expect(verifyM7wDigest(Buffer.concat([sourceBytes, Buffer.from("\\n// changed")]), pin.sha256)).toBe(false);
  });

  it("rejects incorrect configured or actual worker metadata", () => {
    const fx = fixture();
    fx.rawCaptures.ordinary.config.workers = 2;
    expect(resultFor(fx).issues).toContain("ordinary-configured-workers-mismatch");
    expect(resultFor(fx).issues).toContain("ordinary-summary-mismatch");
  });

  it("rejects incomplete Playwright capture evidence", () => {
    const fx = fixture();
    fx.rawCaptures.ordinary.errors.push({ message: "reporter incomplete" });
    expect(resultFor(fx).issues).toContain("ordinary-capture-incomplete");
    expect(resultFor(fx).issues).toContain("ordinary-summary-mismatch");
  });

  it("does not accept a passing summary that contradicts retained failing results", () => {
    const fx = fixture();
    fx.report.decision.ordinaryWebgl.requiredIdentityCounts.passed = 201;
    fx.report.decision.ordinaryWebgl.requiredIdentityCounts.unexpected = 0;
    expect(resultFor(fx).issues).toContain("ordinary-mandatory-summary-mismatch");
  });

  it("rejects a renderer-serial report if any required identity is no longer passed", () => {
    const fx = fixture();
    fx.report.captures.rendererSerial.results[0].status = "failed";
    expect(resultFor(fx).issues).toContain("renderer-serial-normalized-results-mismatch");
    expect(resultFor(fx).issues).toContain("renderer-serial-summary-mismatch");
  });

  it("requires the expected four representative identities and retains the single-worker pass distinction", () => {
    const fx = fixture();
    fx.report.targetedReproduction.selectedIdentities.pop();
    expect(resultFor(fx).issues).toContain("representative-selection-invalid");
  });

  it("computes concurrency from result intervals instead of summary claims", () => {
    const rows = [0, 1, 2, 3].map((parallelIndex) => ({
      identity: "test-" + parallelIndex,
      attempts: [{
        status: "passed",
        startTime: "2026-11-08T00:00:00.000Z",
        durationMs: 1000,
        workerIndex: parallelIndex,
        parallelIndex,
      }],
    }));
    expect(measureM7wConcurrency(rows)).toMatchObject({
      actualWorkers: 4,
      peakConcurrency: 4,
      fourWayOverlapMs: 1000,
    });
    const sequentialRows = rows.map((row, index) => ({
      ...row,
      attempts: [{ ...row.attempts[0], startTime: new Date(Date.parse(row.attempts[0].startTime) + index * 1000).toISOString() }],
    }));
    expect(measureM7wConcurrency(sequentialRows)).toMatchObject({
      actualWorkers: 4,
      peakConcurrency: 1,
      fourWayOverlapMs: 0,
    });
    const invalidRows = clone(rows);
    invalidRows[0].attempts[0].startTime = null;
    expect(measureM7wConcurrency(invalidRows).unverifiableExecutionIntervals).toBe(1);
  });

  it("preserves all 75 conditional skips outside the mandatory projection", () => {
    const fx = fixture();
    const rows = flattenM7wPlaywrightReport(fx.rawCaptures.ordinary);
    expect(rows.filter((row) => row.status === "skipped")).toHaveLength(75);
    expect(fx.report.inventory.ordinaryNonMandatoryIdentities).toHaveLength(75);
    expect(resultFor(fx).issues).toEqual([]);
  });
});
