import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, sep } from "node:path";

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isSha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isEmptyIssues = (value) => Array.isArray(value) && value.length === 0;
const countsEqual = (actual, expected) => isRecord(actual) &&
  Object.entries(expected).every(([key, value]) => actual[key] === value);

const validateReplayReport = (kind, reportValue, expectedSourceSha, expectedReplayCodeSha) => {
  const report = isRecord(reportValue) ? reportValue : null;
  const issues = [];
  if (!report) return { valid: false, issues: ["replay-report-not-an-object"] };
  if (kind === "m7e") {
    if (report.reportId !== "ground-glass-m7e-r187-offline-replay" ||
        report.evaluatorRevision !== "m7e-r187-gather-b1-evaluator-v2" ||
        report.replayStatus !== "passed" || report.captureSourceCommitSha !== expectedSourceSha ||
        !isSha(expectedReplayCodeSha) || report.replayCodeCommitSha !== expectedReplayCodeSha ||
        !countsEqual(report.scenarioCounts, { passed: 12, failed: 0, blocked: 0, "not-run": 0 }) ||
        !isEmptyIssues(report.issues) ||
        report.runtimeIdentity?.rendererRevision !== "r187" ||
        report.runtimeIdentity?.actualExecutionApi !== "webgpu" ||
        report.authorization?.productionWebGpuEnabled !== false) {
      issues.push("m7e-replay-report-contract-invalid");
    }
  } else if (kind === "m7f") {
    const counts = report.scenarioCounts;
    const expectedCounts = { passed: 17, failed: 0, blocked: 0, "not-run": 0 };
    if (report.reportId !== "ground-glass-m7f-r187-presentation" ||
        report.evaluatorRevision !== "m7f-r187-presentation-evaluator-v2" ||
        report.qualificationStatus !== "passed" || report.qualificationPass !== true ||
        report.nativeCaptureSourceSha !== expectedSourceSha || !isSha(expectedReplayCodeSha) ||
        report.replayCodeCommitSha !== expectedReplayCodeSha ||
        !isRecord(counts) || counts.inventoryConsistent !== true ||
        !countsEqual(counts.declared, expectedCounts) || !countsEqual(counts.computed, expectedCounts) ||
        report.sourceCommitVerification?.verified !== true || !isEmptyIssues(report.evidenceReadIssues) ||
        report.runtimeIdentity?.rendererRevision !== "r187" ||
        report.runtimeIdentity?.actualExecutionApi !== "webgpu" ||
        report.authorization?.m8Authorized !== false || report.authorization?.productionWebGpuEnabled !== false) {
      issues.push("m7f-replay-report-contract-invalid");
    }
  } else {
    issues.push("unknown-predecessor-replay-kind");
  }
  return { valid: issues.length === 0, issues };
};

export const createFreshReplayDirectory = (repoRoot) =>
  mkdtempSync(join(resolve(repoRoot), ".m7g-predecessor-replay-"));

/** Runs the real predecessor CLI at a unique, initially empty report path. */
export const runFreshReplay = ({ repoRoot, replayDirectory, kind, script, expectedSourceSha, expectedReplayCodeSha,
  env = process.env, nodeExecutable = process.execPath }) => {
  const root = resolve(repoRoot);
  const outputPath = join(resolve(replayDirectory), `${kind}-current.json`);
  const isInsideRepo = outputPath.startsWith(`${root}${sep}`);
  const outputWasAbsentBeforeSpawn = !existsSync(outputPath);
  const invocation = [nodeExecutable, script, `--report-output=${outputPath}`];
  let result = null;
  let spawnError = null;
  let reportBytes = null;
  let report = null;
  let reportParseError = null;
  let reportValidation = { valid: false, issues: ["replay-report-not-generated"] };

  if (!isInsideRepo || !outputWasAbsentBeforeSpawn) {
    spawnError = !isInsideRepo ? "replay output is outside the repository" : "fresh replay output path already exists";
  } else {
    result = spawnSync(nodeExecutable, [resolve(root, script), `--report-output=${outputPath}`], {
      cwd: root,
      env,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      timeout: 120_000,
    });
    spawnError = result.error?.message ?? null;
  }

  const reportPresent = existsSync(outputPath);
  if (reportPresent) {
    try {
      reportBytes = readFileSync(outputPath);
      report = JSON.parse(reportBytes.toString("utf8"));
      reportValidation = validateReplayReport(kind, report, expectedSourceSha, expectedReplayCodeSha);
    } catch (error) {
      reportParseError = error instanceof Error ? error.message : String(error);
      reportValidation = { valid: false, issues: ["replay-report-json-invalid"] };
    }
  }

  const spawned = result !== null && result.pid !== undefined && result.pid !== null && spawnError === null;
  const exitCode = result?.status ?? null;
  const signal = result?.signal ?? null;
  const reportIdentity = isRecord(report) ? {
    reportId: report.reportId ?? null,
    evaluatorRevision: report.evaluatorRevision ?? null,
    sourceCaptureSha: kind === "m7e" ? report.captureSourceCommitSha ?? null : report.nativeCaptureSourceSha ?? null,
    replayCodeSha: report.replayCodeCommitSha ?? null,
  } : null;
  const execution = {
    kind,
    script,
    expectedSourceSha,
    expectedReplayCodeSha,
    outputPath,
    nodeExecutable,
    invocation: invocation.join(" "),
    spawned,
    exitCode,
    signal,
    spawnError,
    outputWasAbsentBeforeSpawn,
    reportPresent,
    reportParsed: report !== null,
    reportParseError,
    reportSha256: reportBytes ? sha256(reportBytes) : null,
    reportIdentity,
    reportValidated: reportValidation.valid,
    reportValidationIssues: reportValidation.issues,
    stderrExcerpt: (result?.stderr ?? "").slice(-4_000),
    stdoutExcerpt: (result?.stdout ?? "").slice(-2_000),
  };
  execution.valid = spawned && exitCode === 0 && signal === null && spawnError === null &&
    outputWasAbsentBeforeSpawn && reportPresent && report !== null && reportValidation.valid;

  return { execution, report, outputPath };
};
