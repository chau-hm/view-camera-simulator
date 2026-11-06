import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateM7oCanvasAssertionTimingEvidence } from "../../../scripts/evaluateM7oCanvasAssertionTiming";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const acceptedReportPath = "docs/architecture/GROUND_GLASS_M7O_CANVAS_ASSERTION_TIMING_REPORT.json";
type JsonRecord = Record<string, unknown>;

describe("M7O Canvas assertion timing evidence evaluator", () => {
  it("accepts the retained controlled capture matrix through the production CLI", () => {
    const output = execFileSync(process.execPath, ["scripts/run-m7o-evidence.mjs"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    expect(output).toContain("M7O evidence integrity: PASS");
  });

  it("rejects an unsupported claim that internal toHaveCount retries were observed", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    const claims = report.diagnosis as JsonRecord;
    (claims.claims as JsonRecord).exactInternalToHaveCountPolls = true;
    const result = await evaluateMutation(report);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7o-internal-poll-claim-unsupported");
  });

  it("rejects claiming the failure snapshot had no Canvas when that same evaluation observed one", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    ((report.diagnosis as JsonRecord).claims as JsonRecord).canvasAbsentAtFailureSnapshot = true;
    const result = await evaluateMutation(report);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7o-failure-snapshot-claim-contradicted");
  });

  it("rejects a Long Task overlap claim that disagrees with the mapped timing intervals", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    ((report.diagnosis as JsonRecord).claims as JsonRecord).longTaskOverlapsAssertionWindow = 0;
    const result = await evaluateMutation(report);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7o-long-task-overlap-claim-inconsistent");
  });

  it("rejects GPU saturation inferred only from Long Task and heartbeat evidence", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    ((report.diagnosis as JsonRecord).claims as JsonRecord).gpuSaturation = "established";
    const result = await evaluateMutation(report);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7o-gpu-causation-unsupported");
  });

  it("rejects changing the reported target outcome or promoting the selected cohort", async () => {
    const original = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    const wrongOutcome = structuredClone(original);
    const summary = wrongOutcome.experimentSummary as JsonRecord;
    const targetOutcomes = summary.targetOutcomesByCondition as JsonRecord;
    targetOutcomes.D = ["passed", "passed", "passed"];
    const outcomeResult = await evaluateMutation(wrongOutcome);
    expect(outcomeResult.passed).toBe(false);
    expect(outcomeResult.issues).toContain("m7o-derived-summary-mismatch");

    const qualified = structuredClone(original);
    (qualified.qualification as JsonRecord).broadE2eQualification = "qualified";
    const qualificationResult = await evaluateMutation(qualified);
    expect(qualificationResult.passed).toBe(false);
    expect(qualificationResult.issues).toContain("m7o-broad-e2e-qualification-boundary-invalid");
  });

  it("returns nonzero from the CLI for contradictory qualification evidence", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    (report.qualification as JsonRecord).broadE2eQualification = "qualified";
    const fixtureDirectory = await mkdtemp(resolve(repositoryRoot, ".m7o-cli-test-"));
    const reportPath = resolve(fixtureDirectory, "report.json");
    const relativeReportPath = reportPath.slice(repositoryRoot.length + 1);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    try {
      const result = spawnSync(process.execPath, ["scripts/run-m7o-evidence.mjs", `--report-path=${relativeReportPath}`], {
        cwd: repositoryRoot,
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("M7O evidence integrity: FAIL");
      expect(result.stderr).toContain("m7o-broad-e2e-qualification-boundary-invalid");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("rejects a changed normalized artifact digest", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    const manifest = report.captureManifest as JsonRecord;
    (manifest).sha256 = "0".repeat(64);
    const result = await evaluateMutation(report);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7o-capture-manifest-integrity-invalid");
  });

  it("rejects an unavailable normalizer source commit instead of trusting its SHA shape", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    (report.source as JsonRecord).matrixNormalizerSourceCommitSha = "0".repeat(40);
    const result = await evaluateMutation(report);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7o-matrix-normalizer-source-identity-invalid");
    expect(result.issues).toContain("m7o-source-commit-unavailable");
  });

  it("rejects browser metadata that conflicts with the captured DOM user agent", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    (report.captureEnvironment as JsonRecord).browserVersion = "149.0.0.0";
    const result = await evaluateMutation(report);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7o-capture-environment-invalid");
    expect(result.issues).toContain("m7o-browser-version-provenance-invalid");
  });
});

const evaluateMutation = async (report: JsonRecord) => {
  const fixtureDirectory = await mkdtemp(resolve(repositoryRoot, ".m7o-evidence-test-"));
  const reportPath = resolve(fixtureDirectory, "report.json");
  const relativeReportPath = reportPath.slice(repositoryRoot.length + 1);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  try {
    return await evaluateM7oCanvasAssertionTimingEvidence(relativeReportPath);
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
};
