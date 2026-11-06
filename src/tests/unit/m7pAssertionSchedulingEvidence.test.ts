import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateM7pAssertionSchedulingEvidence } from "../../../scripts/evaluateM7pAssertionScheduling";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const reportPath = "docs/architecture/GROUND_GLASS_M7P_ASSERTION_SCHEDULING_REPORT.json";
type JsonRecord = Record<string, unknown>;

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
    expect(result.issues).toContain("m7p-required-worker-overlap-unverified");
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
    (capture.source as JsonRecord).instrumentationCommitSha = (report.source as JsonRecord).executionSourceCommitSha;
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
