import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateM7nRendererLifecycleEvidence } from "../../../scripts/evaluateM7nRendererLifecycle";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const acceptedReportPath = "docs/architecture/GROUND_GLASS_M7N_RENDERER_LIFECYCLE_REPORT.json";
type JsonRecord = Record<string, unknown>;

describe("M7N renderer lifecycle evidence evaluator", () => {
  it("reports a result through the production-facing evidence CLI", () => {
    const output = execFileSync(process.execPath, ["scripts/run-m7n-renderer-lifecycle.mjs"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    expect(output).toContain("M7N evidence integrity: PASS");
  });

  it("returns a nonzero status through the CLI for a contradicted qualification", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    const fixtureDirectory = await mkdtemp(resolve(repositoryRoot, ".m7n-cli-test-"));
    const reportPath = resolve(fixtureDirectory, "report.json");
    const relativeReportPath = reportPath.slice(repositoryRoot.length + 1);
    (report.qualification as JsonRecord).broadE2eQualification = "qualified";
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    try {
      const result = spawnSync(process.execPath, [
        "scripts/run-m7n-renderer-lifecycle.mjs",
        `--report-path=${relativeReportPath}`,
      ], { cwd: repositoryRoot, encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("M7N evidence integrity: FAIL");
      expect(result.stderr).toContain("m7n-broad-e2e-qualification-boundary-invalid");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("accepts the retained report and rejects digest or causal-claim mutations", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    const fixtureDirectory = await mkdtemp(resolve(repositoryRoot, ".m7n-evidence-test-"));
    const reportPath = resolve(fixtureDirectory, "report.json");
    const relativeReportPath = reportPath.slice(repositoryRoot.length + 1);

    const evaluateMutation = async (mutation: (candidate: JsonRecord) => void) => {
      const candidate = structuredClone(report);
      mutation(candidate);
      await writeFile(reportPath, `${JSON.stringify(candidate, null, 2)}\n`);
      return evaluateM7nRendererLifecycleEvidence(relativeReportPath);
    };

    try {
      const valid = await evaluateMutation(() => undefined);
      expect(valid.passed, valid.issues.join(", ")).toBe(true);

      const alteredArtifact = await evaluateMutation((candidate) => {
        const experiments = candidate.experiments as JsonRecord[];
        experiments[0]!.outcomesArtifactSha256 = "0".repeat(64);
      });
      expect(alteredArtifact.passed).toBe(false);
      expect(alteredArtifact.issues).toContain("m7n-artifact-digest-mismatch");

      const unsupportedCause = await evaluateMutation((candidate) => {
        (candidate.diagnosis as JsonRecord).rootCause = "renderer-creation-failure";
      });
      expect(unsupportedCause.passed).toBe(false);
      expect(unsupportedCause.issues).toContain("m7n-causal-claim-exceeds-evidence");

      const selectedPassPromoted = await evaluateMutation((candidate) => {
        (candidate.qualification as JsonRecord).broadE2eQualification = "qualified";
      });
      expect(selectedPassPromoted.passed).toBe(false);
      expect(selectedPassPromoted.issues).toContain("m7n-broad-e2e-qualification-boundary-invalid");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("rejects a trace-enabled experiment when its app trace is marked unavailable", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    const fixtureDirectory = await mkdtemp(resolve(repositoryRoot, ".m7n-missing-trace-test-"));
    const reportPath = resolve(fixtureDirectory, "report.json");
    const relativeReportPath = reportPath.slice(repositoryRoot.length + 1);
    const experiment = (report.experiments as JsonRecord[]).find((entry) => entry.id === "target-solo-w1-trace-on");
    if (!experiment) throw new Error("M7N trace-enabled experiment is missing");
    const outcomes = JSON.parse(await readFile(resolve(repositoryRoot, String(experiment.outcomesArtifactPath)), "utf8")) as JsonRecord;
    (outcomes.normalizedTrace as JsonRecord).unavailable = true;
    const outcomesBytes = `${JSON.stringify(outcomes, null, 2)}\n`;
    const outcomesPath = resolve(fixtureDirectory, "trace-on.outcomes.json");
    await writeFile(outcomesPath, outcomesBytes);
    experiment.outcomesArtifactPath = outcomesPath.slice(repositoryRoot.length + 1);
    experiment.outcomesArtifactSha256 = createHash("sha256").update(outcomesBytes).digest("hex");
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    try {
      const result = await evaluateM7nRendererLifecycleEvidence(relativeReportPath);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("m7n-opted-in-trace-unavailable");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("detects modified diagnostic bytes while keeping outcome counts separate", async () => {
    const report = JSON.parse(await readFile(resolve(repositoryRoot, acceptedReportPath), "utf8")) as JsonRecord;
    const fixtureDirectory = await mkdtemp(resolve(repositoryRoot, ".m7n-artifact-test-"));
    const reportPath = resolve(fixtureDirectory, "report.json");
    const relativeReportPath = reportPath.slice(repositoryRoot.length + 1);
    const experiment = (report.experiments as JsonRecord[]).find((entry) => entry.id === "target-solo-w1-trace-on");
    if (!experiment) throw new Error("M7N trace-enabled experiment is missing");
    const tracePath = String(experiment.traceArtifactPath);
    const originalTrace = await readFile(resolve(repositoryRoot, tracePath));
    const mutatedTracePath = resolve(fixtureDirectory, "mutated.diagnostics.json");
    await writeFile(mutatedTracePath, Buffer.concat([originalTrace, Buffer.from(" ")]));
    const mutatedTraceRelativePath = mutatedTracePath.slice(repositoryRoot.length + 1);
    const outcomes = JSON.parse(await readFile(resolve(repositoryRoot, String(experiment.outcomesArtifactPath)), "utf8")) as JsonRecord;
    (outcomes.normalizedTrace as JsonRecord).artifactPath = mutatedTraceRelativePath;
    const outcomesBytes = `${JSON.stringify(outcomes, null, 2)}\n`;
    const outcomesPath = resolve(fixtureDirectory, "trace-on.outcomes.json");
    await writeFile(outcomesPath, outcomesBytes);
    experiment.outcomesArtifactPath = outcomesPath.slice(repositoryRoot.length + 1);
    experiment.outcomesArtifactSha256 = createHash("sha256").update(outcomesBytes).digest("hex");
    experiment.traceArtifactPath = mutatedTraceRelativePath;
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    try {
      const result = await evaluateM7nRendererLifecycleEvidence(relativeReportPath);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("m7n-artifact-digest-mismatch");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("preserves normalized outcome counts while sanitizing failure paths", async () => {
    const fixtureDirectory = await mkdtemp(resolve(repositoryRoot, ".m7n-normalizer-test-"));
    const inputPath = resolve(fixtureDirectory, "raw-playwright.json");
    const outputDirectory = resolve(fixtureDirectory, "normalized");
    const runId = "normalizer-sanitization-control";
    const snapshot = {
      schemaVersion: 1,
      runId,
      capturePhase: "after-test",
      testIdentity: "Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
      testOutcome: "unexpected",
      expectedStatus: "passed",
      browserVersion: "149.0.7827.55",
      projectName: "chromium",
      observed: { applicationTrace: null },
    };
    const attachmentBody = Buffer.from(JSON.stringify(snapshot)).toString("base64");
    const rawReport = {
      stats: { duration: 100 },
      suites: [{
        file: "src/tests/e2e/architecture-rise-focus-range.spec.ts",
        specs: [{
          title: snapshot.testIdentity,
          tests: [{
            projectName: "chromium",
            expectedStatus: "passed",
            results: [{
              status: "failed",
              retry: 0,
              workerIndex: 0,
              startTime: "2026-11-06T00:00:00.000Z",
              duration: 100,
              errors: [{ message: "Assertion failed at /Users/homan/private/session/source.ts" }],
              attachments: [{
                name: `m7n-${runId}-lifecycle-snapshot.json`,
                body: attachmentBody,
              }],
            }],
          }],
        }],
      }],
    };
    await writeFile(inputPath, JSON.stringify(rawReport));

    try {
      execFileSync(process.execPath, [
        "scripts/normalizeM7nRendererLifecycleCapture.mjs",
        `--input=${inputPath}`,
        `--out-dir=${outputDirectory}`,
        "--capture-id=target-solo-w1-trace-off",
        `--run-id=${runId}`,
        "--execution-source-sha=5034edf1551466649623a920024057b57f8dddbf",
        "--tooling-source-sha=3ec85599c3cd28019126ce00cff6115c1bcdf059",
        "--workers=1",
        "--trace-enabled=false",
      ], { cwd: repositoryRoot, encoding: "utf8" });

      const outcomes = JSON.parse(await readFile(resolve(outputDirectory, "target-solo-w1-trace-off.outcomes.json"), "utf8")) as JsonRecord;
      expect(outcomes.outcomes).toMatchObject({ discovered: 1, passed: 0, unexpected: 1, retries: 0 });
      expect(outcomes.normalizedTrace).toMatchObject({ unavailable: true, eventCount: 0 });
      expect(JSON.stringify(outcomes)).not.toContain("/Users/homan/private/session");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });
});
