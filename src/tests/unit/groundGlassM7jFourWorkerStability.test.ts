import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_M7J_BASE_COMMIT_SHA,
  GROUND_GLASS_M7J_CANDIDATE_COMMIT_SHA,
  GROUND_GLASS_M7J_MUTATION_SUITE_REVISION,
  GROUND_GLASS_M7J_REQUIRED_MUTATION_CASES,
  evaluateGroundGlassM7jFourWorkerStability,
  type GroundGlassM7jArtifact,
} from "../../render/testing/groundGlassM7jFourWorkerStability";

type JsonRecord = Record<string, unknown>;
type Fixture = { report: JsonRecord; artifacts: Record<string, GroundGlassM7jArtifact> };
const reportPath = "docs/architecture/GROUND_GLASS_M7J_FOUR_WORKER_STABILITY_REPORT.json";
const historicalPath = "docs/architecture/GROUND_GLASS_M7I_BROAD_E2E_REMEDIATION_REPORT.json";
const readJson = (path: string): JsonRecord =>
  JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as JsonRecord;
const sha256 = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const sourceReport = readJson(reportPath);
const historicalM7i = readJson(historicalPath);
const historicalSha = sha256(readFileSync(resolve(process.cwd(), historicalPath)));
const sourceArtifacts: Record<string, GroundGlassM7jArtifact> = {};
for (const run of sourceReport.experiments as JsonRecord[]) {
  const path = String(run.rawReportPath);
  const bytes = readFileSync(resolve(process.cwd(), path));
  sourceArtifacts[path] = { sha256: sha256(bytes), value: JSON.parse(bytes.toString("utf8")) as unknown };
}
for (const path of [
  String((sourceReport.currentDiscovery as JsonRecord).outputPath),
  String((sourceReport.currentDiscovery as JsonRecord).rendererProjectOutputPath),
]) {
  const bytes = readFileSync(resolve(process.cwd(), path));
  sourceArtifacts[path] = { sha256: sha256(bytes), value: bytes.toString("utf8") };
}
const controlPaths = [
  ...((sourceReport.validation as JsonRecord).browserControls as JsonRecord[])
    .map((control) => String(control.rawReportPath)),
  ...Object.values(sourceReport.acceptedM7iValidationControls as JsonRecord)
    .filter((control): control is JsonRecord => typeof control === "object" && control !== null && !Array.isArray(control))
    .map((control) => String(control.rawReportPath)),
];
for (const path of controlPaths) {
  const bytes = readFileSync(resolve(process.cwd(), path));
  sourceArtifacts[path] = { sha256: sha256(bytes), value: JSON.parse(bytes.toString("utf8")) as unknown };
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const fixture = (): Fixture => ({ report: clone(sourceReport), artifacts: clone(sourceArtifacts) });
const evaluate = (value: Fixture) => evaluateGroundGlassM7jFourWorkerStability(
  value.report,
  historicalM7i,
  historicalSha,
  value.artifacts,
  {
    [GROUND_GLASS_M7J_BASE_COMMIT_SHA]: true,
    [GROUND_GLASS_M7J_CANDIDATE_COMMIT_SHA]: true,
  },
);
const runFor = (value: Fixture, id: string): JsonRecord =>
  (value.report.experiments as JsonRecord[]).find((run) => run.id === id)!;
const artifactFor = (value: Fixture, id: string): JsonRecord => {
  const run = runFor(value, id);
  return value.artifacts[String(run.rawReportPath)] as unknown as JsonRecord;
};
const rawFor = (value: Fixture, id: string): JsonRecord => artifactFor(value, id).value as JsonRecord;
const walkRawTests = (report: JsonRecord, visitor: (test: JsonRecord, file: string, title: string) => void): void => {
  const walk = (suite: JsonRecord): void => {
    const suiteFile = String(suite.file ?? "");
    for (const specValue of Array.isArray(suite.specs) ? suite.specs : []) {
      if (typeof specValue !== "object" || specValue === null || Array.isArray(specValue)) continue;
      const spec = specValue as JsonRecord;
      const file = basename(String(spec.file || suiteFile));
      const title = String(spec.title ?? "");
      for (const testValue of Array.isArray(spec.tests) ? spec.tests : []) {
        if (typeof testValue === "object" && testValue !== null && !Array.isArray(testValue)) {
          visitor(testValue as JsonRecord, file, title);
        }
      }
    }
    for (const child of Array.isArray(suite.suites) ? suite.suites : []) {
      if (typeof child === "object" && child !== null && !Array.isArray(child)) walk(child as JsonRecord);
    }
  };
  for (const suite of Array.isArray(report.suites) ? report.suites : []) {
    if (typeof suite === "object" && suite !== null && !Array.isArray(suite)) walk(suite as JsonRecord);
  }
};
const claimFor = (value: Fixture, runId: string, file: string, title: string): JsonRecord => {
  const run = runFor(value, runId);
  return (run.testOutcomes as JsonRecord[]).find((claim) => claim.identity === `${file}::${title}`)!;
};
const refreshMutatedRawDigest = (value: Fixture, runId: string): void => {
  const run = runFor(value, runId);
  const artifact = artifactFor(value, runId);
  const bytes = `${JSON.stringify(artifact.value, null, 2)}\n`;
  const digest = sha256(bytes);
  artifact.sha256 = digest;
  run.rawReportSha256 = digest;
};
const expectRejectedFor = (value: Fixture, issuePrefix: string): void => {
  const result = evaluate(value);
  expect(result.passed).toBe(false);
  expect(result.issues.some((issue) => issue.startsWith(issuePrefix))).toBe(true);
};

describe("M7J four-worker stability evidence evaluator", () => {
  it("records the required mutation suite revision and case inventory", () => {
    expect(GROUND_GLASS_M7J_MUTATION_SUITE_REVISION).toBe("m7j-evidence-mutations-v1");
    expect(GROUND_GLASS_M7J_REQUIRED_MUTATION_CASES).toHaveLength(21);
  });

  it("rejects a report that omits a required worker-matrix experiment", () => {
    const value = fixture();
    value.report.experiments = (value.report.experiments as JsonRecord[])
      .filter((run) => run.id !== "baseline-cohort5-w2");
    expectRejectedFor(value, "required-experiment-record-missing:baseline-cohort5-w2");
  });

  it("rejects a single-test run with one actual worker relabeled as four", () => {
    const value = fixture();
    runFor(value, "baseline-j1-isolated-w4-config").execution = {
      ...runFor(value, "baseline-j1-isolated-w4-config").execution as JsonRecord,
      actualWorkers: 4,
    };
    const result = evaluate(value);
    expect(result.passed).toBe(false);
    expect(result.comparability).toBe("failed");
    expect(result.issues.some((issue) => issue.startsWith("worker-configuration-or-actual-count-mismatch:baseline-j1-isolated-w4-config"))).toBe(true);
  });

  it("rejects worker metadata that contradicts Playwright configuration", () => {
    const value = fixture();
    runFor(value, "baseline-cohort5-w4").execution = {
      ...runFor(value, "baseline-cohort5-w4").execution as JsonRecord,
      configuredWorkers: 2,
    };
    expectRejectedFor(value, "worker-configuration-or-actual-count-mismatch:baseline-cohort5-w4");
  });

  it("rejects a failed test relabeled as passed", () => {
    const value = fixture();
    const title = "View Focus preserves independent Scene and Camera views and resets the active preset";
    const claim = claimFor(value, "baseline-cohort5-w4", "scene-view-focus.spec.ts", title);
    Object.assign(claim, { actualStatus: "passed", resultStatus: "expected", retryCount: 0, actualPass: true });
    const result = evaluate(value);
    expect(result.passed).toBe(false);
    expect(result.rawOutcomes).toBe("failed");
    expect(result.issues.some((issue) => issue.startsWith("test-outcome-claim-mismatch:baseline-cohort5-w4"))).toBe(true);
  });

  it("does not count an expected failure as an actual pass", () => {
    const value = fixture();
    const runId = "baseline-cohort5-w1";
    const title = "Stage 2N-A Observer and RTT instances survive independent sibling removal";
    walkRawTests(rawFor(value, runId), (test, file, testTitle) => {
      if (file !== "fringe-club-dev-integration.spec.ts" || testTitle !== title) return;
      test.expectedStatus = "failed";
    });
    const claim = claimFor(value, runId, "fringe-club-dev-integration.spec.ts", title);
    Object.assign(claim, { expectedStatus: "failed", actualStatus: "failed", resultStatus: "expected", actualPass: true });
    refreshMutatedRawDigest(value, runId);
    expectRejectedFor(value, "test-outcome-claim-mismatch:baseline-cohort5-w1");
  });

  it("rejects a skipped required test counted as passed", () => {
    const value = fixture();
    const runId = "candidate-renderer-serial";
    const title = "View Focus preserves independent Scene and Camera views and resets the active preset";
    walkRawTests(rawFor(value, runId), (test, file, testTitle) => {
      if (file === "scene-view-focus.spec.ts" && testTitle === title) {
        (test.results as JsonRecord[])[0].status = "skipped";
      }
    });
    const claim = claimFor(value, runId, "scene-view-focus.spec.ts", title);
    Object.assign(claim, { actualStatus: "skipped", resultStatus: "skipped", actualPass: true });
    const counts = runFor(value, runId).outcomeCounts as JsonRecord;
    counts.expected = 3;
    counts.skipped = 1;
    refreshMutatedRawDigest(value, runId);
    expectRejectedFor(value, "test-outcome-claim-mismatch:candidate-renderer-serial");
  });

  it("rejects a retry-dependent pass claimed as deterministic", () => {
    const value = fixture();
    const runId = "candidate-renderer-serial";
    const title = "View Focus preserves independent Scene and Camera views and resets the active preset";
    walkRawTests(rawFor(value, runId), (test, file, testTitle) => {
      if (file !== "scene-view-focus.spec.ts" || testTitle !== title) return;
      const result = (test.results as JsonRecord[])[0];
      test.results = [
        { ...result, status: "failed", retry: 0 },
        { ...result, status: "passed", retry: 1 },
      ];
    });
    const claim = claimFor(value, runId, "scene-view-focus.spec.ts", title);
    Object.assign(claim, { resultStatus: "expected", retryCount: 0, actualPass: true });
    const counts = runFor(value, runId).outcomeCounts as JsonRecord;
    counts.expected = 3;
    counts.flaky = 1;
    refreshMutatedRawDigest(value, runId);
    expectRejectedFor(value, "test-outcome-claim-mismatch:candidate-renderer-serial");
  });

  it("rejects a partial raw test inventory labeled complete", () => {
    const value = fixture();
    const run = runFor(value, "baseline-cohort5-w4");
    (run.expectedTestIdentities as string[]).pop();
    run.inventoryComplete = true;
    expectRejectedFor(value, "experiment-test-inventory-incomplete-or-mismatched:baseline-cohort5-w4");
  });

  it("rejects a missing raw report artifact", () => {
    const value = fixture();
    delete value.artifacts[String(runFor(value, "baseline-cohort5-w4").rawReportPath)];
    expectRejectedFor(value, "raw-artifact-missing-or-digest-mismatch:baseline-cohort5-w4");
  });

  it("rejects an altered raw report digest", () => {
    const value = fixture();
    artifactFor(value, "baseline-cohort5-w4").sha256 = "0".repeat(64);
    expectRejectedFor(value, "raw-artifact-missing-or-digest-mismatch:baseline-cohort5-w4");
  });

  it("rejects candidate evidence attributed to the baseline", () => {
    const value = fixture();
    runFor(value, "candidate-renderer-serial").sourceCommitSha = GROUND_GLASS_M7J_BASE_COMMIT_SHA;
    expectRejectedFor(value, "experiment-source-attribution-invalid:candidate-renderer-serial");
  });

  it("rejects an incompatible browser revision hidden in a run environment", () => {
    const value = fixture();
    runFor(value, "candidate-renderer-serial").environment = {
      ...runFor(value, "candidate-renderer-serial").environment as JsonRecord,
      browserVersion: "148.0.0.0",
    };
    expectRejectedFor(value, "experiment-environment-not-comparable:candidate-renderer-serial");
  });

  it("rejects a changed viewport hidden from the environment record", () => {
    const value = fixture();
    const run = runFor(value, "candidate-renderer-serial");
    run.environment = {
      ...run.environment as JsonRecord,
      viewport: { width: 1024, height: 720 },
    };
    expectRejectedFor(value, "experiment-environment-not-comparable:candidate-renderer-serial");
  });

  it("rejects an unmeasured GPU utilization value", () => {
    const value = fixture();
    (value.report.environment as JsonRecord).processMetrics = {
      cpuUtilization: null,
      gpuUtilization: 74,
      availability: "unavailable",
    };
    expectRejectedFor(value, "unmeasured-host-metric-claimed");
  });

  it("rejects a correlated factor promoted to a verified root cause", () => {
    const value = fixture();
    value.report.sharedCause = {
      ...value.report.sharedCause as JsonRecord,
      confidence: "verified",
      verifiedCause: true,
    };
    const result = evaluate(value);
    expect(result.passed).toBe(false);
    expect(result.hypothesisSupport).toBe("failed");
    expect(result.issues).toContain("shared-cause-strength-or-limitations-overclaimed");
  });

  it("rejects omission of one original unresolved historical identity", () => {
    const value = fixture();
    (value.report.historicalM7i as JsonRecord).unresolvedTestIds =
      ((value.report.historicalM7i as JsonRecord).unresolvedTestIds as string[]).slice(1);
    expectRejectedFor(value, "historical-unresolved-identities-drift");
  });

  it("rejects a false full Broad E2E qualification", () => {
    const value = fixture();
    value.report.broadE2eQualification = "qualified";
    expectRejectedFor(value, "qualification-or-production-boundary-changed");
  });

  it("rejects an M8 authorization claim", () => {
    const value = fixture();
    value.report.m8Entry = "authorized";
    expectRejectedFor(value, "qualification-or-production-boundary-changed");
  });

  it("rejects production WebGPU activation", () => {
    const value = fixture();
    value.report.productionWebGpuEnabled = true;
    expectRejectedFor(value, "qualification-or-production-boundary-changed");
  });

  it("makes the production-facing evidence CLI exit nonzero for invalid evidence", () => {
    const value = fixture();
    value.report.productionWebGpuEnabled = true;
    const scratch = mkdtempSync(resolve(tmpdir(), "m7j-evidence-cli-"));
    const mutatedReportPath = resolve(scratch, "mutated-m7j-report.json");
    try {
      writeFileSync(mutatedReportPath, `${JSON.stringify(value.report, null, 2)}\n`);
      const result = spawnSync(process.execPath, [
        "scripts/run-m7j-four-worker-stability.mjs",
        `--report-path=${mutatedReportPath}`,
      ], { cwd: process.cwd(), encoding: "utf8" });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("qualification-or-production-boundary-changed");
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("accepts the genuine partial diagnostic report without qualifying Broad E2E", () => {
    const result = evaluate(fixture());
    expect(result.issues).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.readinessDecision).toBe("ready-for-controlled-broad-run");
    expect(result.fourWorkerStability).toBe("unstable");
    expect(result.fullBroadE2eQualification).toBe("not-qualified");
    expect(result.counts.unresolvedHistoricalIdentities).toBe(80);
    expect(result.issues).toEqual([]);
  });
});
