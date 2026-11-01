import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  GROUND_GLASS_M7H_EVALUATOR_REVISION,
  GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH,
  GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256,
  GROUND_GLASS_M7H_REPORT_ID,
  evaluateGroundGlassM7hBroadE2eTriage,
  extractGroundGlassM7hPlaywrightTests,
} from "../src/render/testing/groundGlassM7hBroadE2eTriage";

const root = process.cwd();
const reportPath = "docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json";
type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const string = (value: unknown): string => typeof value === "string" ? value : "";
const numeric = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : 0;
const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const readBytes = (path: string): Buffer | null => {
  try {
    return readFileSync(resolve(root, path));
  } catch {
    return null;
  }
};
const readJson = (path: string): unknown => {
  const bytes = readBytes(path);
  if (!bytes) return null;
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    return null;
  }
};
const fail = (message: string): never => {
  throw new TypeError(message);
};

const main = (): void => {
  const args = process.argv.slice(2);
  const diagnostic = args.includes("--diagnostic");
  const inventory = args.includes("--inventory");
  const compareOption = args.find((argument) => argument.startsWith("--compare-report="));
  const sourceCommitOption = args.find((argument) => argument.startsWith("--source-commit-sha="));
  const browserVersionOption = args.find((argument) => argument.startsWith("--browser-version="));
  const invocationOption = args.find((argument) => argument.startsWith("--invocation="));
  const outputOption = args.find((argument) => argument.startsWith("--evaluation-output="));
  if (args.some((argument) => argument !== "--diagnostic" && argument !== "--inventory" &&
      !argument.startsWith("--evaluation-output=") && !argument.startsWith("--compare-report=") &&
      !argument.startsWith("--source-commit-sha=") && !argument.startsWith("--browser-version=") &&
      !argument.startsWith("--invocation=")) ||
      args.filter((argument) => argument === "--diagnostic").length > 1 ||
      args.filter((argument) => argument === "--inventory").length > 1 ||
      args.filter((argument) => argument.startsWith("--evaluation-output=")).length > 1 ||
      args.filter((argument) => argument.startsWith("--compare-report=")).length > 1 ||
      args.filter((argument) => argument.startsWith("--source-commit-sha=")).length > 1 ||
      args.filter((argument) => argument.startsWith("--browser-version=")).length > 1 ||
      args.filter((argument) => argument.startsWith("--invocation=")).length > 1 ||
      (diagnostic && inventory) || (compareOption && (diagnostic || inventory || outputOption))) {
    fail("Supported M7H options are --diagnostic, --inventory, --evaluation-output=<path>, or --compare-report=<path> with run provenance");
  }
  const historicalBytes = readBytes(GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH);
  const historical = historicalBytes ? readJson(GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH) : null;
  const historicalSha = historicalBytes ? sha256(historicalBytes) : null;
  if (historicalSha !== GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256) {
    process.stderr.write("M7H historical raw Playwright report digest mismatch\n");
    process.exitCode = 1;
    return;
  }
  const report = readJson(reportPath);
  if (inventory) {
    process.stdout.write(`${JSON.stringify(extractGroundGlassM7hPlaywrightTests(historical, historicalSha), null, 2)}\n`);
    return;
  }
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    process.stderr.write(`M7H report missing or malformed: ${reportPath}\n`);
    process.exitCode = 1;
    return;
  }

  const runs = Array.isArray((report as { reproductionRuns?: unknown }).reproductionRuns)
    ? (report as { reproductionRuns: Array<{ reportPath?: unknown }> }).reproductionRuns
    : [];
  const discovery = (report as { currentDiscovery?: { artifactPath?: unknown } }).currentDiscovery;
  const artifactPaths = [
    ...runs.map((run) => run.reportPath),
    discovery?.artifactPath,
  ].filter((path): path is string => typeof path === "string");
  const artifacts: Record<string, { sha256: string; report: unknown }> = {};
  for (const artifactPath of artifactPaths) {
    const bytes = readBytes(artifactPath);
    let parsed: unknown = null;
    try {
      if (bytes) parsed = JSON.parse(bytes.toString("utf8")) as unknown;
    } catch {
      parsed = null;
    }
    artifacts[artifactPath] = { sha256: bytes ? sha256(bytes) : "", report: parsed };
  }
  if (compareOption) {
    const runPath = compareOption.slice("--compare-report=".length).trim();
    const runBytes = readBytes(runPath);
    let runReport: unknown = null;
    try {
      if (runBytes) runReport = JSON.parse(runBytes.toString("utf8")) as unknown;
    } catch {
      runReport = null;
    }
    const sourceCommitSha = sourceCommitOption?.slice("--source-commit-sha=".length).trim() ?? "";
    const browserVersion = browserVersionOption?.slice("--browser-version=".length).trim() ?? "";
    const invocation = invocationOption?.slice("--invocation=".length).trim() ?? "";
    if (!runBytes || !runReport || !/^[0-9a-f]{40}$/i.test(sourceCommitSha) || !browserVersion || !invocation) {
      fail("Comparing a Playwright run requires a readable raw report, source SHA, browser version, and exact invocation");
    }
    const runSha = sha256(runBytes);
    const runTests = extractGroundGlassM7hPlaywrightTests(runReport, runSha);
    const runProjects = isRecord((runReport as { config?: unknown }).config) &&
        Array.isArray((runReport as { config: { projects?: unknown } }).config.projects)
      ? (runReport as { config: { projects: Array<{ id?: unknown }> } }).config.projects.map((project) => project.id)
      : [];
    const runConfig = isRecord((runReport as { config?: unknown }).config) ?
      (runReport as { config: Record<string, unknown> }).config : {};
    const project = runProjects.length === 1 ? runProjects[0] : null;
    if (project !== "chromium") fail("M7H broad run comparison accepts only the ordinary chromium project");
    const discoveryValue = isRecord(artifacts[string(discovery?.artifactPath)]?.report)
      ? artifacts[string(discovery?.artifactPath)].report as { tests?: unknown }
      : {};
    const recordedIds = new Set(Array.isArray(discoveryValue.tests)
      ? discoveryValue.tests.filter(isRecord).map((test) => string(test.testId))
      : []);
    const runIds = new Set(runTests.map((test) => test.testId));
    const runStats = isRecord((runReport as { stats?: unknown }).stats) ?
      (runReport as { stats: Record<string, unknown> }).stats : {};
    const comparison = {
      reportId: GROUND_GLASS_M7H_REPORT_ID,
      sourceCommitSha,
      invocation,
      project,
      workers: Number.isInteger(runConfig.workers) ? runConfig.workers : null,
      browserVersion,
      rawReportPath: runPath,
      rawReportSha256: runSha,
      testsDiscovered: runTests.length,
      expected: numeric(runStats.expected),
      unexpected: numeric(runStats.unexpected),
      skipped: numeric(runStats.skipped),
      flaky: numeric(runStats.flaky),
      addedSinceInventory: [...runIds].filter((id) => !recordedIds.has(id)).sort(),
      missingFromRun: [...recordedIds].filter((id) => !runIds.has(id)).sort(),
      unexpectedTests: runTests.filter((test) => test.resultStatus === "unexpected").map((test) => ({
        testId: test.testId,
        status: test.actualStatus,
        errorCategory: test.errorCategory,
      })),
      note: "Comparison reports outcomes and inventory drift only; it does not assign regression origin or qualify the broad suite.",
    };
    process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
    if (comparison.addedSinceInventory.length || comparison.missingFromRun.length || comparison.unexpected > 0 || comparison.flaky > 0) {
      process.exitCode = 1;
    }
    return;
  }
  const evaluation = evaluateGroundGlassM7hBroadE2eTriage(report, historical, historicalSha, artifacts);
  const result = {
    reportId: GROUND_GLASS_M7H_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7H_EVALUATOR_REVISION,
    reportPath,
    valid: evaluation.valid,
    inventoryIntegrity: evaluation.inventoryIntegrity,
    classificationIntegrity: evaluation.classificationIntegrity,
    reproductionIntegrity: evaluation.reproductionIntegrity,
    broadE2eQualification: evaluation.broadE2eQualification,
    counts: evaluation.counts,
    issues: evaluation.issues,
  };
  if (diagnostic) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
  if (outputOption) {
    const outputPath = outputOption.slice("--evaluation-output=".length).trim();
    const absolute = isAbsolute(outputPath) ? outputPath : resolve(root, outputPath);
    if (!absolute.startsWith(`${resolve(root)}/`) || absolute === resolve(root)) {
      fail("M7H evaluation output must remain inside the repository");
    }
    writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
  }
  if (!evaluation.valid) process.exitCode = 1;
};

main();
