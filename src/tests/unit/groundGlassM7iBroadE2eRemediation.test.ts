import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH,
  GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256,
  deriveGroundGlassM7hPlaywrightReportOutcomes,
} from "../../render/testing/groundGlassM7hBroadE2eTriage";
import {
  evaluateGroundGlassM7iBroadE2eRemediation,
  type GroundGlassM7iArtifact,
  type GroundGlassM7iArtifacts,
} from "../../render/testing/groundGlassM7iBroadE2eRemediation";

type JsonRecord = Record<string, unknown>;
const readJson = (path: string): JsonRecord =>
  JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as JsonRecord;
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const historicalTriage = readJson("docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json");
const historicalRaw = readJson(GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH);
const reportPath = "docs/architecture/GROUND_GLASS_M7I_BROAD_E2E_REMEDIATION_REPORT.json";
const sourceReport = readJson(reportPath);
const rawReportSha = GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256;
const historicalTriageSha = createHash("sha256")
  .update(readFileSync(resolve(process.cwd(), "docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json")))
  .digest("hex");
const artifactPaths = [
  ...(sourceReport.reproductionRuns as JsonRecord[]).map((run) => String(run.reportPath)),
  ...((sourceReport.supportingArtifacts as JsonRecord[]).map((artifact) => String(artifact.path))),
  String((sourceReport.currentDiscovery as JsonRecord).artifactPath),
  String((sourceReport.currentDiscovery as JsonRecord).sourceOutputPath),
];
const sourceArtifacts: GroundGlassM7iArtifacts = Object.fromEntries(artifactPaths.map((path) => {
  const bytes = readFileSync(resolve(process.cwd(), path));
  let report: unknown;
  try {
    report = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    report = bytes.toString("utf8");
  }
  return [path, { sha256: createHash("sha256").update(bytes).digest("hex"), report } satisfies GroundGlassM7iArtifact];
}));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const fixture = () => ({ report: clone(sourceReport), artifacts: clone(sourceArtifacts) as Record<string, GroundGlassM7iArtifact> });
const evaluate = (
  value: ReturnType<typeof fixture>,
  historicalSha: string = rawReportSha,
  historicalTriageDigest = historicalTriageSha,
) =>
  evaluateGroundGlassM7iBroadE2eRemediation(
    value.report,
    historicalTriage,
    historicalRaw,
    historicalSha,
    historicalTriageDigest,
    value.artifacts,
  );
const runFor = (value: ReturnType<typeof fixture>, id: string): JsonRecord =>
  (value.report.reproductionRuns as JsonRecord[]).find((run) => run.id === id)!;
const artifactFor = (value: ReturnType<typeof fixture>, runId: string): GroundGlassM7iArtifact =>
  value.artifacts[String(runFor(value, runId).reportPath)];

const visitSuites = (suite: JsonRecord, visitor: (suite: JsonRecord) => void): void => {
  visitor(suite);
  for (const child of Array.isArray(suite.suites) ? suite.suites : []) {
    if (typeof child === "object" && child !== null && !Array.isArray(child)) {
      visitSuites(child as JsonRecord, visitor);
    }
  }
};

const findRawTest = (value: unknown, testId: string): JsonRecord => {
  const [, fileName, ...identityParts] = testId.split("::");
  const title = identityParts[identityParts.length - 1];
  const report = value as JsonRecord;
  for (const suite of Array.isArray(report.suites) ? report.suites : []) {
    if (typeof suite !== "object" || suite === null || Array.isArray(suite)) continue;
    let found: JsonRecord | undefined;
    visitSuites(suite as JsonRecord, (candidateSuite) => {
      if (found) return;
      for (const spec of Array.isArray(candidateSuite.specs) ? candidateSuite.specs : []) {
        if (typeof spec !== "object" || spec === null || Array.isArray(spec)) continue;
        const specRecord = spec as JsonRecord;
        const specFile = basename(String(specRecord.file || candidateSuite.file || ""));
        if (specFile !== fileName || specRecord.title !== title) continue;
        for (const test of Array.isArray(specRecord.tests) ? specRecord.tests : []) {
          if (typeof test !== "object" || test === null || Array.isArray(test)) continue;
          const testRecord = test as JsonRecord;
          if (String(testRecord.projectName || testRecord.projectId) === "chromium") found = testRecord;
        }
      }
    });
    if (found) return found;
  }
  throw new Error(`Raw report is missing ${testId}`);
};

const refreshRunDigest = (value: ReturnType<typeof fixture>, runId: string): void => {
  const run = runFor(value, runId);
  const artifactPath = String(run.reportPath);
  const artifact = value.artifacts[artifactPath] as { sha256: string; report: unknown };
  const reportJson = JSON.stringify(artifact.report);
  const reportSha = digest(reportJson);
  artifact.sha256 = reportSha;
  run.rawReportSha256 = reportSha;
};

const refreshRunStats = (value: ReturnType<typeof fixture>, runId: string): void => {
  const artifact = artifactFor(value, runId);
  const report = artifact.report as JsonRecord;
  const derived = deriveGroundGlassM7hPlaywrightReportOutcomes(report, artifact.sha256);
  report.stats = {
    ...(report.stats as JsonRecord),
    expected: derived.counts.expected,
    unexpected: derived.counts.unexpected,
    skipped: derived.counts.skipped,
    flaky: derived.counts.flaky,
  };
  refreshRunDigest(value, runId);
};

const mutateCandidateCase = (
  value: ReturnType<typeof fixture>,
  status: "failed" | "skipped" | "retry-pass",
  expectedStatus?: string,
): void => {
  const testId = String((value.report.verifiedFixes as JsonRecord[])
    .find((entry) => entry.evidenceKind === "m7i-matched")?.testId);
  const raw = artifactFor(value, "candidate-cohorts-w4").report as JsonRecord;
  const test = findRawTest(raw, testId);
  if (expectedStatus) test.expectedStatus = expectedStatus;
  if (status === "retry-pass") {
    test.results = [
      { status: "failed", duration: 5, error: { message: "injected first-attempt failure" } },
      { status: "passed", duration: 5, attachments: [] },
    ];
  } else {
    test.results = [{ status, duration: 5, error: status === "failed" ? { message: "injected failure" } : undefined }];
  }
  refreshRunStats(value, "candidate-cohorts-w4");
};

describe("M7I broad E2E remediation evidence", () => {
  it("accepts the historical M7H inventory and the two matched deterministic candidate fixes", () => {
    const result = evaluate(fixture());
    expect(result.passed).toBe(true);
    expect(result.historicalFailureCount).toBe(99);
    expect(result.tentativeDrawerCount).toBe(15);
    expect(result.unknownFailureCount).toBe(67);
    expect(result.m7iVerifiedFixCount).toBe(2);
    expect(result.unresolvedCount).toBe(80);
    expect(result.issues).toEqual([]);
  });

  it("requires a full matched candidate pass for the compound Restart task", () => {
    const value = fixture();
    const raw = artifactFor(value, "candidate-compound-w1").report as JsonRecord;
    const compoundId = String((value.report.compoundTask as JsonRecord).testId);
    findRawTest(raw, compoundId).results = [
      { status: "failed", duration: 5, error: { message: "injected compound failure" } },
    ];
    refreshRunStats(value, "candidate-compound-w1");
    expect(evaluate(value).issues).toContain("compound-task-candidate-run-not-passed-or-matched");
  });

  it("rejects a compound candidate run with a mismatched browser environment", () => {
    const value = fixture();
    (runFor(value, "candidate-compound-w1").environment as JsonRecord).browserVersion = "150.0.0.0";
    expect(evaluate(value).issues).toContain("compound-task-candidate-run-not-passed-or-matched");
  });

  it("rejects a wrong baseline SHA", () => {
    const value = fixture();
    value.report.baseCommitSha = "cf5d91ab879208ea123a5b9a5d046cb5178217cf";
    expect(evaluate(value).issues).toContain("base-commit-mismatch");
  });

  it("rejects an invalid candidate source SHA", () => {
    const value = fixture();
    runFor(value, "candidate-cohorts-w4").sourceCommitSha = "57eacc0d7c41014a3288cbee63a8b58a7aa08557";
    expect(evaluate(value).issues).toContain("run-source-identity-mismatch:candidate-cohorts-w4");
  });

  it("rejects a raw report digest mismatch", () => {
    const value = fixture();
    runFor(value, "candidate-cohorts-w4").rawReportSha256 = "0".repeat(64);
    expect(evaluate(value).issues).toContain("raw-report-digest-mismatch:candidate-cohorts-w4");
  });

  it("rejects a supporting classification artifact digest mismatch", () => {
    const value = fixture();
    const supporting = value.report.supportingArtifacts as JsonRecord[];
    const entry = supporting.find((artifact) => artifact.artifactType === "classification")!;
    const artifact = value.artifacts[String(entry.path)] as { sha256: string; report: unknown };
    artifact.sha256 = "0".repeat(64);
    expect(evaluate(value).issues).toContain(
      `supporting-artifact-digest-mismatch:${String(entry.path)}`,
    );
  });

  it("rejects an expected-failure test relabeled as a verified fix", () => {
    const value = fixture();
    mutateCandidateCase(value, "failed");
    expect(evaluate(value).issues).toContain(
      "m7i-fix-lacks-matched-deterministic-evidence:chromium::fringe-club-dev-integration.spec.ts::Stage 2N-A Observer and RTT instances survive independent sibling removal",
    );
  });

  it("rejects a Playwright expected failure even when the final raw result is failed", () => {
    const value = fixture();
    mutateCandidateCase(value, "failed", "failed");
    expect(evaluate(value).issues).toContain(
      "m7i-fix-lacks-matched-deterministic-evidence:chromium::fringe-club-dev-integration.spec.ts::Stage 2N-A Observer and RTT instances survive independent sibling removal",
    );
  });

  it("rejects a retry-dependent candidate pass", () => {
    const value = fixture();
    mutateCandidateCase(value, "retry-pass");
    expect(evaluate(value).issues).toContain(
      "m7i-fix-lacks-matched-deterministic-evidence:chromium::fringe-club-dev-integration.spec.ts::Stage 2N-A Observer and RTT instances survive independent sibling removal",
    );
  });

  it("rejects a skipped required candidate test", () => {
    const value = fixture();
    mutateCandidateCase(value, "skipped");
    expect(evaluate(value).issues).toContain(
      "m7i-fix-lacks-matched-deterministic-evidence:chromium::fringe-club-dev-integration.spec.ts::Stage 2N-A Observer and RTT instances survive independent sibling removal",
    );
  });

  it("rejects aggregate statistics that disagree with the raw test tree", () => {
    const value = fixture();
    const raw = artifactFor(value, "candidate-cohorts-w4").report as JsonRecord;
    const stats = raw.stats as JsonRecord;
    stats.unexpected = Number(stats.unexpected) + 1;
    refreshRunDigest(value, "candidate-cohorts-w4");
    expect(evaluate(value).issues).toContain("raw-report-stats-mismatch:candidate-cohorts-w4:unexpected");
  });

  it("rejects a removed candidate test counted as fixed", () => {
    const value = fixture();
    const testId = String((value.report.verifiedFixes as JsonRecord[])
      .find((entry) => entry.evidenceKind === "m7i-matched")?.testId);
    const raw = artifactFor(value, "candidate-cohorts-w4").report as JsonRecord;
    const target = testId.split("::").pop();
    for (const suite of raw.suites as JsonRecord[]) {
      for (const spec of suite.specs as JsonRecord[]) {
        if (spec.title === target) spec.tests = [];
      }
    }
    refreshRunStats(value, "candidate-cohorts-w4");
    (runFor(value, "candidate-cohorts-w4").testIds as string[]).splice(
      (runFor(value, "candidate-cohorts-w4").testIds as string[]).indexOf(testId),
      1,
    );
    expect(evaluate(value).issues).toContain(
      `m7i-fix-lacks-matched-deterministic-evidence:${testId}`,
    );
  });

  it("rejects a wrong test identity in a fix claim", () => {
    const value = fixture();
    const fix = (value.report.verifiedFixes as JsonRecord[]).find((entry) => entry.evidenceKind === "m7i-matched")!;
    fix.testId = "chromium::camera-controls-compact.spec.ts::not the reproduced test";
    expect(evaluate(value).issues).toContain("m7i-fix-identity-invalid-or-duplicated");
  });

  it("rejects reusing one test's evidence to claim a second fix", () => {
    const value = fixture();
    const fixes = value.report.verifiedFixes as JsonRecord[];
    fixes.push({ ...fixes.find((entry) => entry.evidenceKind === "m7i-matched")!, testId: String(unknownInventoryId(value)) });
    expect(evaluate(value).issues.some((issue) => issue.startsWith("m7i-fix-lacks-matched-deterministic-evidence:"))).toBe(true);
  });

  it("rejects a missing tentative drawer member", () => {
    const value = fixture();
    (value.report.tentativeDrawerInventory as JsonRecord[]).pop();
    expect(evaluate(value).issues).toContain("tentative-drawer-inventory-mismatch");
  });

  it("rejects a tentative drawer case bulk-promoted without a matched failure/pass pair", () => {
    const value = fixture();
    const tentativeId = String((value.report.tentativeDrawerInventory as JsonRecord[])[0].testId);
    (value.report.verifiedFixes as JsonRecord[]).push({
      testId: tentativeId,
      evidenceKind: "m7i-matched",
      baselineRunId: "drawer-compound-w1",
      candidateRunId: "candidate-cohorts-w1",
    });
    expect(evaluate(value).issues).toContain("m7i-fix-identity-invalid-or-duplicated");
  });

  it("rejects a duplicated historical failure entry", () => {
    const value = fixture();
    const failures = (value.report.historicalDisposition as JsonRecord).failureInventory as JsonRecord[];
    failures.push(clone(failures[0]));
    expect(evaluate(value).issues).toContain("historical-failure-disposition-drift");
  });

  it("rejects an omitted unclassified historical failure", () => {
    const value = fixture();
    (value.report.unknownFailureInventory as JsonRecord[]).pop();
    expect(evaluate(value).issues).toContain("unknown-failure-inventory-mismatch");
  });

  it("rejects a missing unresolved historical identity", () => {
    const value = fixture();
    (value.report.unresolved as string[]).pop();
    expect(evaluate(value).issues).toContain("unresolved-inventory-mismatch");
  });

  it("rejects a candidate environment that differs from its matched baseline", () => {
    const value = fixture();
    const environment = runFor(value, "candidate-cohorts-w4").environment as JsonRecord;
    environment.browserVersion = "150.0.0.0";
    expect(evaluate(value).issues).toContain(
      "m7i-fix-lacks-matched-deterministic-evidence:chromium::fringe-club-dev-integration.spec.ts::Stage 2N-A Observer and RTT instances survive independent sibling removal",
    );
  });

  it("rejects worker metadata that contradicts Playwright's configured workers", () => {
    const value = fixture();
    runFor(value, "candidate-cohorts-w4").workers = 1;
    expect(evaluate(value).issues).toContain("raw-report-configuration-mismatch:candidate-cohorts-w4");
  });

  it("rejects a partial selected run labeled as the full broad suite", () => {
    const value = fixture();
    value.report.broadRunDecision = { status: "executed", blockers: [] };
    value.report.broadRunResult = { runId: "candidate-cohorts-w4" };
    expect(evaluate(value).issues).toContain("partial-run-labeled-as-broad");
  });

  it("rejects unauthorized production WebGPU claims", () => {
    const value = fixture();
    (value.report.productionAuthorization as JsonRecord).productionWebGpuEnabled = true;
    expect(evaluate(value).issues).toContain("authorization-boundary-changed");
  });

  it("rejects M8 entry promotion", () => {
    const value = fixture();
    value.report.m8Entry = "approved";
    expect(evaluate(value).issues).toContain("authorization-boundary-changed");
  });

  it("rejects a changed accepted M7H raw-report digest", () => {
    const result = evaluate(fixture(), "0".repeat(64));
    expect(result.issues).toContain("historical-raw-report-digest-mismatch");
  });

  it("rejects a changed accepted M7H triage-report digest", () => {
    const result = evaluate(fixture(), rawReportSha, "0".repeat(64));
    expect(result.issues).toContain("accepted-m7h-triage-report-digest-mismatch");
  });
});

const unknownInventoryId = (value: ReturnType<typeof fixture>): unknown =>
  (value.report.unknownFailureInventory as JsonRecord[])[0]?.testId;
