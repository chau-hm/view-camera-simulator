import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  GROUND_GLASS_M7H_EVALUATOR_REVISION,
  GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH,
  GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256,
  GROUND_GLASS_M7H_REPORT_ID,
  deriveGroundGlassM7hPlaywrightReportOutcomes,
  evaluateGroundGlassM7hBroadE2eTriage,
  extractGroundGlassM7hPlaywrightTests,
} from "../src/render/testing/groundGlassM7hBroadE2eTriage";

const root = process.cwd();
const reportPath = "docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json";
type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const string = (value: unknown): string => typeof value === "string" ? value : "";
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
      process.stdout.write(`${JSON.stringify({
        reportId: GROUND_GLASS_M7H_REPORT_ID,
        sourceCommitSha,
        invocation,
        browserVersion,
        rawReportPath: runPath,
        reportedCounts: null,
        derivedCounts: null,
        discoveredTests: 0,
        testsWithUsableResults: 0,
        incompleteTests: [],
        duplicateTestIds: [],
        statsConsistent: false,
        inventoryConsistent: false,
        unexpectedTests: [],
        flakyTests: [],
        skippedTests: [],
        addedSinceInventory: [],
        missingFromRun: [],
        qualificationDecision: "not-qualified",
        issues: ["comparison-report-or-provenance-missing-or-malformed"],
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    const runSha = sha256(runBytes);
    const derived = deriveGroundGlassM7hPlaywrightReportOutcomes(runReport, runSha);
    const runTests = derived.tests;
    const runProjects = isRecord((runReport as { config?: unknown }).config) &&
        Array.isArray((runReport as { config: { projects?: unknown } }).config.projects)
      ? (runReport as { config: { projects: Array<{ id?: unknown }> } }).config.projects.map((project) => project.id)
      : [];
    const runConfig = isRecord((runReport as { config?: unknown }).config) ?
      (runReport as { config: Record<string, unknown> }).config : {};
    const project = runProjects.length === 1 ? runProjects[0] : null;
    const discoveryValue = isRecord(artifacts[string(discovery?.artifactPath)]?.report)
      ? artifacts[string(discovery?.artifactPath)].report as { tests?: unknown }
      : {};
    const discoveryArtifact = artifacts[string(discovery?.artifactPath)];
    const discoveryTests = Array.isArray(discoveryValue.tests) ? discoveryValue.tests.filter(isRecord) : [];
    const discoveryIds = discoveryTests.map((test) => string(test.testId));
    const recordedIds = new Set(discoveryIds);
    const runIds = new Set(runTests.map((test) => test.testId));
    const runStats = isRecord((runReport as { stats?: unknown }).stats) ?
      (runReport as { stats: Record<string, unknown> }).stats : {};
    const statKeys = ["expected", "unexpected", "skipped", "flaky"] as const;
    const reportedCounts = Object.fromEntries(statKeys.map((key) => {
      const value = runStats[key];
      return [key, typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null];
    })) as Record<(typeof statKeys)[number], number | null>;
    const statsPresentAndValid = statKeys.every((key) => reportedCounts[key] !== null);
    const statsMatchDerived = statsPresentAndValid && statKeys.every((key) =>
      reportedCounts[key] === derived.counts[key]);
    const statsConsistent = statsMatchDerived && derived.counts.incomplete === 0 &&
      statKeys.reduce<number>((total, key) => total + (reportedCounts[key] ?? 0), 0) === derived.counts.discovered;
    const reportCurrentDiscovery = isRecord(report) && isRecord(report.currentDiscovery) ? report.currentDiscovery : {};
    const discoveryDigestMatches = Boolean(discoveryArtifact) &&
      discoveryArtifact?.sha256 === reportCurrentDiscovery.artifactSha256;
    const discoveryIdentitiesValid = discoveryTests.every((test) => {
      const validDescribePath = Array.isArray(test.describePath) &&
        test.describePath.every((part) => typeof part === "string");
      const parts = [
        string(test.projectName),
        string(test.specFile),
        ...(validDescribePath ? test.describePath as string[] : []),
        string(test.testTitle),
      ];
      return validDescribePath && parts.every(Boolean) && string(test.testId) === parts.join("::") && test.projectName === "chromium";
    });
    const duplicateDiscoveryIds = new Set(discoveryIds).size !== discoveryIds.length;
    const duplicateTestIds = [...new Set([...derived.duplicateTestIds, ...(duplicateDiscoveryIds ? discoveryIds.filter((id, index) => discoveryIds.indexOf(id) !== index) : [])])].sort();
    const discoveryCountMatches = Number.isInteger(reportCurrentDiscovery.discoveredTests) &&
      reportCurrentDiscovery.discoveredTests === discoveryTests.length;
    const addedSinceInventory = [...runIds].filter((id) => !recordedIds.has(id)).sort();
    const missingFromRun = [...recordedIds].filter((id) => !runIds.has(id)).sort();
    const testProjectsValid = runTests.every((test) => test.projectName === "chromium");
    const inventoryConsistent = discoveryDigestMatches && discoveryIdentitiesValid && !duplicateDiscoveryIds &&
      discoveryCountMatches && addedSinceInventory.length === 0 && missingFromRun.length === 0 &&
      duplicateTestIds.length === 0 && testProjectsValid && derived.counts.discovered === discoveryTests.length;
    const unexpectedTests = runTests.filter((test) => test.resultStatus === "unexpected").map((test) => ({
      testId: test.testId,
      expectedStatus: test.expectedStatus,
      actualStatus: test.actualStatus,
      errorCategory: test.errorCategory,
    }));
    const flakyTests = runTests.filter((test) => test.resultStatus === "flaky").map((test) => ({
      testId: test.testId,
      expectedStatus: test.expectedStatus,
      actualStatus: test.actualStatus,
      attemptStatuses: test.attemptStatuses,
    }));
    const skippedTests = runTests.filter((test) => test.resultStatus === "skipped").map((test) => ({
      testId: test.testId,
      expectedStatus: test.expectedStatus,
      actualStatus: test.actualStatus,
    }));
    const actualPassingTests = runTests.filter((test) => test.actualPass).length;
    const issues = [
      ...derived.issues,
      ...(project === "chromium" ? [] : ["ordinary-chromium-project-required"]),
      ...(!testProjectsValid ? ["non-chromium-test-identity-present"] : []),
      ...(derived.counts.incomplete ? ["incomplete-test-results-present"] : []),
      ...(duplicateTestIds.length ? ["duplicate-test-identities-present"] : []),
      ...(!statsPresentAndValid ? ["aggregate-playwright-stats-missing-or-invalid"] : []),
      ...(statsPresentAndValid && !statsMatchDerived ? ["aggregate-playwright-stats-disagree-with-raw-tree"] : []),
      ...(!statsConsistent && statsMatchDerived ? ["aggregate-playwright-stats-do-not-reconcile-with-discovered-tests"] : []),
      ...(!discoveryDigestMatches ? ["current-discovery-artifact-digest-mismatch"] : []),
      ...(!discoveryIdentitiesValid || !discoveryCountMatches ? ["current-discovery-inventory-invalid"] : []),
      ...(!inventoryConsistent && (addedSinceInventory.length || missingFromRun.length) ? ["test-inventory-does-not-match-current-discovery"] : []),
      ...(unexpectedTests.length ? ["unexpected-test-outcomes-present"] : []),
      ...(flakyTests.length ? ["flaky-test-outcomes-present"] : []),
      ...(skippedTests.length ? ["required-tests-skipped"] : []),
      ...(actualPassingTests !== derived.counts.discovered ? ["required-tests-not-actually-passing"] : []),
      ...(!Number.isInteger(runConfig.workers) || Number(runConfig.workers) <= 0 ? ["invalid-worker-count"] : []),
    ];
    const comparison = {
      reportId: GROUND_GLASS_M7H_REPORT_ID,
      sourceCommitSha,
      invocation,
      project,
      workers: Number.isInteger(runConfig.workers) ? runConfig.workers : null,
      browserVersion,
      rawReportPath: runPath,
      rawReportSha256: runSha,
      reportedCounts,
      derivedCounts: derived.counts,
      discoveredTests: derived.counts.discovered,
      testsWithUsableResults: derived.testsWithUsableResults,
      incompleteTests: derived.incompleteTests,
      duplicateTestIds,
      statsConsistent,
      inventoryConsistent,
      unexpectedTests,
      flakyTests,
      skippedTests,
      addedSinceInventory,
      missingFromRun,
      actualPassingTests,
      qualificationDecision: issues.length === 0 ? "passed" : "not-qualified",
      issues: [...new Set(issues)],
      note: "Raw per-test results are authoritative. A consistent expected failure remains an expected outcome, but does not count as an actual passing test.",
    };
    process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
    if (comparison.qualificationDecision !== "passed") process.exitCode = 1;
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
