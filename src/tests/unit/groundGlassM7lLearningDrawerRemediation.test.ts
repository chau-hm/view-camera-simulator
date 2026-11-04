import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_M7L_EVALUATOR_REVISION,
  GROUND_GLASS_M7L_MUTATION_SUITE_REVISION,
  GROUND_GLASS_M7L_REQUIRED_MUTATION_CASES,
  evaluateGroundGlassM7lLearningDrawerRemediation,
  type GroundGlassM7lArtifact,
  type GroundGlassM7lEvidence,
} from "../../render/testing/groundGlassM7lLearningDrawerRemediation";

type JsonRecord = Record<string, unknown>;
type Fixture = { report: JsonRecord; evidence: GroundGlassM7lEvidence };
const reportPath = "docs/architecture/GROUND_GLASS_M7L_LEARNING_DRAWER_REMEDIATION_REPORT.json";
const inventoryPath = "docs/architecture/ground-glass-m7l-learning-drawer/historical-82-failure-inventory.json";
const focusedPath = "docs/architecture/ground-glass-m7l-learning-drawer/validation/focused-drawer-regressions.json";
const historicalPath = "docs/architecture/GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION_REPORT.json";
const historicalRawPaths = {
  "m7k-ordinary": "docs/architecture/ground-glass-m7k-broad-e2e/execution/three-r187/execution/ordinary-playwright.json",
  "m7k-renderer-serial": "docs/architecture/ground-glass-m7k-broad-e2e/execution/three-r187/execution/renderer-serial-playwright.json",
} as const;
const readBytes = (path: string): Buffer => readFileSync(resolve(process.cwd(), path));
const readJson = (path: string): JsonRecord => JSON.parse(readBytes(path).toString("utf8")) as JsonRecord;
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const record = (value: unknown): JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const loadFixture = (): Fixture => {
  const report = readJson(reportPath);
  const experiments: Record<string, GroundGlassM7lArtifact> = {};
  for (const experimentValue of array(report.experiments)) {
    const experiment = record(experimentValue);
    const path = String(experiment.artifactPath);
    const bytes = readBytes(path);
    experiments[String(experiment.id)] = {
      sha256: digest(bytes),
      value: JSON.parse(bytes.toString("utf8")) as unknown,
    };
  }
  const historicalRawArtifacts: Record<string, GroundGlassM7lArtifact> = {};
  for (const [key, path] of Object.entries(historicalRawPaths)) {
    const bytes = readBytes(path);
    historicalRawArtifacts[key] = { sha256: digest(bytes), value: JSON.parse(bytes.toString("utf8")) as unknown };
  }
  const inventoryBytes = readBytes(inventoryPath);
  const focusedBytes = readBytes(focusedPath);
  return {
    report,
    evidence: {
      historicalM7kReport: readJson(historicalPath),
      historicalInventory: JSON.parse(inventoryBytes.toString("utf8")) as unknown,
      historicalInventorySha256: digest(inventoryBytes),
      historicalRawArtifacts,
      experiments,
      focusedValidation: { sha256: digest(focusedBytes), value: JSON.parse(focusedBytes.toString("utf8")) as unknown },
    },
  };
};

const rejectFor = (fixture: Fixture, issue: string): void => {
  const evaluation = evaluateGroundGlassM7lLearningDrawerRemediation(fixture.report, fixture.evidence);
  expect(evaluation.passed).toBe(false);
  expect(evaluation.issues).toContain(issue);
};
const setExperiment = (fixture: Fixture, id: string, mutate: (experiment: JsonRecord) => void): void => {
  const experiments = array(fixture.report.experiments);
  const found = experiments.find((value) => record(value).id === id);
  if (!found) throw new Error(`Missing experiment ${id}`);
  mutate(found as JsonRecord);
};
const setRun = (fixture: Fixture, id: string, mutate: (run: JsonRecord) => void): void => {
  const artifact = fixture.evidence.experiments[id];
  if (!artifact) throw new Error(`Missing evidence run ${id}`);
  mutate(artifact.value as JsonRecord);
};
const mutateFirstTest = (run: JsonRecord, mutate: (test: JsonRecord) => void): void => {
  const visit = (suiteValue: unknown): boolean => {
    const suite = record(suiteValue);
    for (const specValue of array(suite.specs)) {
      for (const testValue of array(record(specValue).tests)) {
        mutate(testValue as JsonRecord);
        return true;
      }
    }
    for (const child of array(suite.suites)) if (visit(child)) return true;
    return false;
  };
  if (!array(run.suites).some((suite) => visit(suite))) throw new Error("No Playwright test available for mutation");
};
const mutateFirstResultWithStatus = (run: JsonRecord, status: string, mutate: (result: JsonRecord) => void): void => {
  const visit = (suiteValue: unknown): boolean => {
    const suite = record(suiteValue);
    for (const specValue of array(suite.specs)) {
      for (const testValue of array(record(specValue).tests)) {
        for (const resultValue of array(record(testValue).results)) {
          if (record(resultValue).status !== status) continue;
          mutate(resultValue as JsonRecord);
          return true;
        }
      }
    }
    for (const child of array(suite.suites)) if (visit(child)) return true;
    return false;
  };
  if (!array(run.suites).some((suite) => visit(suite))) throw new Error(`No Playwright result with status ${status}`);
};

const mutations: ReadonlyArray<readonly [string, (fixture: Fixture) => void, string]> = [
  ["historical-report-digest-changed", (fixture) => { record(fixture.report.historicalM7k).reportSha256 = "0".repeat(64); }, "historical-report-digest-mismatch"],
  ["historical-inventory-count-changed", (fixture) => { record(fixture.report.historicalM7k).unexpectedCount = 81; }, "historical-unexpected-count-mismatch"],
  ["historical-identity-removed", (fixture) => { record(fixture.evidence.historicalInventory).outcomes = array(record(fixture.evidence.historicalInventory).outcomes).slice(1); }, "historical-inventory-identity-mismatch"],
  ["historical-inventory-identity-invented", (fixture) => { record(array(record(fixture.evidence.historicalInventory).outcomes)[0]).testId = "invented.spec.ts::made-up test"; }, "historical-inventory-identity-mismatch"],
  ["cohort-identity-removed", (fixture) => { record(fixture.report.historicalM7k).cohortIdentities = array(record(fixture.report.historicalM7k).cohortIdentities).slice(1); }, "cohort-identity-set-mismatch"],
  ["raw-artifact-digest-changed", (fixture) => { (fixture.evidence.historicalRawArtifacts as Record<string, GroundGlassM7lArtifact>)["m7k-ordinary"] = { ...fixture.evidence.historicalRawArtifacts["m7k-ordinary"], sha256: "0".repeat(64) }; }, "historical-raw-artifact-digest-mismatch:m7k-ordinary"],
  ["raw-artifact-missing", (fixture) => { delete (fixture.evidence.experiments as Record<string, GroundGlassM7lArtifact>)["cohort-w4"]; }, "experiment-artifact-missing:cohort-w4"],
  ["configured-worker-count-mismatch", (fixture) => { setExperiment(fixture, "cohort-w4", (experiment) => { experiment.configuredWorkers = 2; }); }, "configured-workers-mismatch:cohort-w4"],
  ["actual-concurrency-mismatch", (fixture) => { setExperiment(fixture, "cohort-w4", (experiment) => { experiment.maxConcurrentTests = 3; }); }, "actual-concurrency-mismatch:cohort-w4"],
  ["retry-dependent-pass-hidden", (fixture) => { setRun(fixture, "cohort-w1", (run) => { mutateFirstTest(run, (test) => { record(array(test.results)[0]).retry = 1; }); }); }, "cohort-run-retry-present:cohort-w1"],
  ["incomplete-run-counted-as-complete", (fixture) => { setRun(fixture, "cohort-w1", (run) => { mutateFirstTest(run, (test) => { test.results = []; }); }); }, "experiment-outcomes-mismatch:cohort-w1"],
  ["not-reproduced-case-promoted-to-fixed", (fixture) => { const inventory = record(fixture.evidence.historicalInventory); const row = array(inventory.outcomes).find((value) => record(value).currentWorkerMatrix !== null); record(row).reproductionStatus = "verified-fixed"; }, "non-matched-case-labeled-verified-fixed:"],
  ["cohort-promoted-to-full-broad-qualified", (fixture) => { record(fixture.report.qualification).fullBroadE2eStatus = "qualified"; }, "qualification-boundary-mismatch"],
  ["m8-authorization-enabled", (fixture) => { record(fixture.report.qualification).m8Entry = "allowed"; }, "qualification-boundary-mismatch"],
  ["production-webgpu-enabled", (fixture) => { record(fixture.report.qualification).productionWebGpuEnabled = true; }, "qualification-boundary-mismatch"],
  ["evaluator-revision-changed", (fixture) => { fixture.report.evaluatorRevision = "m7l-learning-drawer-remediation-evaluator-v2"; }, "evaluator-revision-mismatch"],
  ["historical-full-suite-count-altered", (fixture) => { record(record(fixture.report.historicalM7k).fullSuiteCounts).discovered = 277; }, "historical-full-suite-counts-mismatch"],
  ["accepted-m7k-counts-altered", (fixture) => { record(record(fixture.evidence.historicalM7kReport).execution).combinedOutcomes = { ...record(record(fixture.evidence.historicalM7kReport).execution).combinedOutcomes as JsonRecord, passed: 120 }; }, "accepted-m7k-full-suite-counts-changed"],
  ["captured-outcome-promoted-to-pass", (fixture) => { setExperiment(fixture, "cohort-w4", (experiment) => { record(experiment.outcomes).passed = 11; record(experiment.outcomes).failed = 0; }); }, "experiment-outcomes-mismatch:cohort-w4"],
  ["candidate-source-replaced", (fixture) => { fixture.report.candidateCommitSha = "0".repeat(40); }, "baseline-candidate-source-mismatch"],
  ["reported-worker-matrix-altered", (fixture) => { const inventory = record(fixture.evidence.historicalInventory); const row = array(inventory.outcomes).find((value) => record(value).currentWorkerMatrix !== null); record(row).currentWorkerMatrix = { ...record(record(row).currentWorkerMatrix), w4: "failed" }; }, "cohort-worker-outcome-mismatch:"],
  ["raw-failed-outcome-promoted-to-pass", (fixture) => { setRun(fixture, "cohort-w4", (run) => { mutateFirstResultWithStatus(run, "failed", (result) => { result.status = "passed"; }); }); }, "experiment-outcome-does-not-match-captured-run:cohort-w4"],
];

describe("Ground Glass M7L Learning Drawer evidence integrity", () => {
  it("accepts the genuine partial-remediation report and all selected-run evidence", () => {
    const fixture = loadFixture();
    const evaluation = evaluateGroundGlassM7lLearningDrawerRemediation(fixture.report, fixture.evidence);
    expect(evaluation).toMatchObject({
      passed: true,
      evidenceIntegrity: "passed",
      historicalUnexpectedCount: 82,
      cohortIdentityCount: 11,
      verifiedFixCount: 0,
      fullBroadE2eStatus: "not-qualified",
      m7Overall: "partially-qualified",
      m8Entry: "denied",
      productionWebGpuEnabled: false,
    });
    expect(evaluation.workerOutcomes["cohort-w1"]).toMatchObject({ discovered: 11, passed: 11, failed: 0, retries: 0, maxConcurrentTests: 1 });
    expect(evaluation.workerOutcomes["cohort-w2"]).toMatchObject({ discovered: 11, passed: 9, failed: 2, retries: 0, maxConcurrentTests: 2 });
    expect(evaluation.workerOutcomes["cohort-w4"]).toMatchObject({ discovered: 11, passed: 4, failed: 7, retries: 0, maxConcurrentTests: 4 });
  });

  it.each(mutations)("rejects mutation: %s", (_name, mutate, issue) => {
    const fixture = loadFixture();
    mutate(fixture);
    if (issue.endsWith(":")) {
      const evaluation = evaluateGroundGlassM7lLearningDrawerRemediation(fixture.report, fixture.evidence);
      expect(evaluation.passed).toBe(false);
      expect(evaluation.issues.some((candidate) => candidate.startsWith(issue))).toBe(true);
      return;
    }
    rejectFor(fixture, issue);
  });

  it("keeps the required mutation manifest versioned and complete", () => {
    const fixture = loadFixture();
    const coverage = record(record(fixture.report.validation).mutationCoverage);
    expect(coverage.revision).toBe(GROUND_GLASS_M7L_MUTATION_SUITE_REVISION);
    expect(coverage.testCount).toBe(GROUND_GLASS_M7L_REQUIRED_MUTATION_CASES.length);
    expect(coverage.requiredCases).toEqual(GROUND_GLASS_M7L_REQUIRED_MUTATION_CASES);
    expect(GROUND_GLASS_M7L_EVALUATOR_REVISION).toBe("m7l-learning-drawer-remediation-evaluator-v1");
    expect(mutations.map(([name]) => name)).toEqual(GROUND_GLASS_M7L_REQUIRED_MUTATION_CASES);
  });

  it("makes the CLI exit nonzero for a false Broad E2E qualification claim", () => {
    const directory = mkdtempSync(join(process.cwd(), ".m7l-cli-negative-"));
    const mutatedPath = join(directory, "mutated-report.json");
    const relativePath = relative(process.cwd(), mutatedPath).replaceAll("\\", "/");
    try {
      const report = readJson(reportPath);
      record(report.qualification).fullBroadE2eStatus = "qualified";
      writeFileSync(mutatedPath, `${JSON.stringify(report, null, 2)}\n`);
      const result = spawnSync(process.execPath, [
        resolve(process.cwd(), "scripts/run-m7l-learning-drawer-remediation.mjs"),
        `--report-path=${relativePath}`,
      ], { cwd: process.cwd(), encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("qualification-boundary-mismatch");
      expect(result.stdout).toContain('"evidenceIntegrity": "failed"');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
