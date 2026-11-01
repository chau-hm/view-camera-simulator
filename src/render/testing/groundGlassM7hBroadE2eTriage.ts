export const GROUND_GLASS_M7H_REPORT_ID = "ground-glass-m7h-broad-e2e-triage" as const;
export const GROUND_GLASS_M7H_EVALUATOR_REVISION = "m7h-broad-e2e-triage-evaluator-v1" as const;
export const GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH =
  "docs/architecture/ground-glass-m7g-r187/validation/broad-e2e-playwright.json" as const;
export const GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256 =
  "393d1360f32a85c83664ca3ed7ec4d5bec217e77edd8045f4ace61b054ae32d6" as const;
export const GROUND_GLASS_M7H_HISTORICAL_SOURCE_SHA =
  "095d9725a1ddb272bf780bd5e7e9e2a2b8f61837" as const;
export const GROUND_GLASS_M7H_CLEAN_BASELINE_SHA =
  "bda4ce9244111517e0898a0ead3b61d5faba7eb2" as const;
export const GROUND_GLASS_M7H_CURRENT_MAIN_SHA =
  "cf5d91ab879208ea123a5b9a5d046cb5178217cf" as const;

export const GROUND_GLASS_M7H_ORIGIN_CLASSIFICATIONS = Object.freeze([
  "verified-existing-on-base",
  "verified-introduced-on-head",
  "verified-fixed-on-head",
  "not-reproduced",
  "comparison-inconclusive",
  "not-compared",
] as const);
export const GROUND_GLASS_M7H_CAUSE_CLASSIFICATIONS = Object.freeze([
  "product-behavior-defect",
  "obsolete-test-contract",
  "test-harness-defect",
  "environment-or-infrastructure",
  "timing-or-concurrency",
  "unsupported-test-configuration",
  "unknown",
] as const);
export const GROUND_GLASS_M7H_CONFIDENCE_LEVELS = Object.freeze([
  "verified",
  "strongly-supported",
  "tentative",
  "unclassified",
] as const);

export type GroundGlassM7hOriginClassification = typeof GROUND_GLASS_M7H_ORIGIN_CLASSIFICATIONS[number];
export type GroundGlassM7hCauseClassification = typeof GROUND_GLASS_M7H_CAUSE_CLASSIFICATIONS[number];
export type GroundGlassM7hConfidence = typeof GROUND_GLASS_M7H_CONFIDENCE_LEVELS[number];
export type GroundGlassM7hRawOutcome = "expected" | "unexpected" | "skipped";
export type GroundGlassM7hRunStatus = "passed" | "failed" | "timedOut" | "interrupted" | "skipped";

export type GroundGlassM7hTest = Readonly<{
  testId: string;
  specFile: string;
  describePath: readonly string[];
  testTitle: string;
  projectName: string;
  expectedStatus: string;
  actualStatus: GroundGlassM7hRunStatus;
  resultStatus: GroundGlassM7hRawOutcome;
  retryCount: number;
  durationMs: number;
  errorMessage: string | null;
  errorCategory: string;
  sourceArtifactSha256: string;
  historicalSourceCommitSha: string;
  attachments: readonly string[];
}>;

export type GroundGlassM7hReproductionRun = Readonly<{
  id: string;
  sourceCommitSha: string;
  invocation: string;
  projectName: string;
  workers: number;
  browserVersion: string;
  environmentFingerprint: string;
  executionClassification: "ordinary-chromium-non-native";
  reportPath: string;
  reportSha256: string;
  comparableWith: string | null;
}>;

export type GroundGlassM7hFailureClassification = Readonly<{
  testId: string;
  cohortId: string;
  originClassification: GroundGlassM7hOriginClassification;
  causeClassification: GroundGlassM7hCauseClassification;
  confidence: GroundGlassM7hConfidence;
  baselineEvidence: string | null;
  candidateEvidence: string | null;
  reason: string;
  remediationStatus: "unchanged" | "test-contract-updated" | "harness-updated" | "partially-addressed" | "unresolved";
  followUpRecommendation: string;
}>;

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const string = (value: unknown): string => typeof value === "string" ? value : "";
const sha = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
const sha256 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const numeric = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : 0;
const ANSI_COLOR_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

const errorCategory = (message: string): string => {
  if (!message) return "no-error-message";
  if (/Test timeout of \d+ms exceeded|Test timeout \d+ms exceeded/.test(message)) return "test-timeout";
  if (/Timeout \d+ms exceeded while waiting on the predicate/.test(message)) return "predicate-timeout";
  if (/toBeVisible/.test(message)) return "visibility-assertion";
  if (/toHaveAttribute/.test(message)) return "attribute-assertion";
  if (/toHaveCount/.test(message)) return "count-assertion";
  if (/toHaveCSS/.test(message)) return "css-assertion";
  if (/toHaveValue/.test(message)) return "value-assertion";
  if (/toContainText/.test(message)) return "text-assertion";
  if (/Expected: ["']?186["']?/.test(message) && /Received: ["']?187["']?/.test(message)) return "renderer-revision-assertion";
  if (/WebGPU|webgpu/i.test(message)) return "webgpu-policy-or-runtime-assertion";
  if (/Timed out|timeout/i.test(message)) return "other-timeout";
  if (/toBe\(/.test(message)) return "value-equality-assertion";
  return "other-assertion";
};

const suiteFile = (suite: JsonRecord): string => {
  const file = string(suite.file);
  if (file) return file.replaceAll("\\", "/").split("/").pop() ?? file;
  return string(suite.title);
};

const normalizedSuitePath = (path: readonly string[], file: string): string[] =>
  path.filter((part) => part && part !== file && part !== "src/tests/e2e");

const stableTestId = (projectName: string, specFile: string, describePath: readonly string[], title: string): string =>
  [projectName, specFile, ...describePath, title].join("::");

/** Extracts stable per-test outcomes from Playwright's raw JSON suite tree. */
export const extractGroundGlassM7hPlaywrightTests = (
  reportValue: unknown,
  sourceArtifactSha256: unknown,
): readonly GroundGlassM7hTest[] => {
  if (!isRecord(reportValue) || !Array.isArray(reportValue.suites) || !sha256(sourceArtifactSha256)) return [];
  const tests: GroundGlassM7hTest[] = [];
  const visit = (suiteValue: unknown, parents: readonly string[]): void => {
    if (!isRecord(suiteValue)) return;
    const file = suiteFile(suiteValue);
    const path = normalizedSuitePath([...parents, string(suiteValue.title)], file);
    for (const specValue of Array.isArray(suiteValue.specs) ? suiteValue.specs : []) {
      if (!isRecord(specValue)) continue;
      const specFile = string(specValue.file) || file;
      const describePath = normalizedSuitePath(path, specFile);
      for (const testValue of Array.isArray(specValue.tests) ? specValue.tests : []) {
        if (!isRecord(testValue)) continue;
        const results = Array.isArray(testValue.results) ? testValue.results.filter(isRecord) : [];
        const finalResult = results[results.length - 1] ?? {};
        const expectedStatus = string(testValue.expectedStatus) || "passed";
        const actualStatus = string(finalResult.status) as GroundGlassM7hRunStatus;
        const skipped = expectedStatus === "skipped" || actualStatus === "skipped";
        const expected = !skipped && actualStatus === expectedStatus;
        const message = (string(isRecord(finalResult.error) ? finalResult.error.message : null) ||
          (Array.isArray(finalResult.errors) && isRecord(finalResult.errors[0]) ? string(finalResult.errors[0].message) : ""))
          .replace(ANSI_COLOR_PATTERN, "");
        const testTitle = string(specValue.title);
        const projectName = string(testValue.projectName) || string(testValue.projectId);
        const attachments = Array.isArray(finalResult.attachments)
          ? finalResult.attachments.filter(isRecord).map((attachment) => string(attachment.name)).filter(Boolean)
          : [];
        tests.push({
          testId: stableTestId(projectName, specFile, describePath, testTitle),
          specFile,
          describePath,
          testTitle,
          projectName,
          expectedStatus,
          actualStatus,
          resultStatus: skipped ? "skipped" : expected ? "expected" : "unexpected",
          retryCount: Math.max(0, results.length - 1),
          durationMs: results.reduce((total, result) => total + numeric(result.duration), 0),
          errorMessage: message || null,
          errorCategory: errorCategory(message),
          sourceArtifactSha256,
          historicalSourceCommitSha: GROUND_GLASS_M7H_HISTORICAL_SOURCE_SHA,
          attachments,
        });
      }
    }
    for (const nested of Array.isArray(suiteValue.suites) ? suiteValue.suites : []) visit(nested, path);
  };
  for (const suite of reportValue.suites) visit(suite, []);
  return tests;
};

export type GroundGlassM7hTriageEvaluation = Readonly<{
  valid: boolean;
  inventoryIntegrity: "passed" | "failed";
  classificationIntegrity: "passed" | "failed";
  reproductionIntegrity: "passed" | "failed";
  broadE2eQualification: "not-qualified";
  issues: readonly string[];
  counts: Readonly<{
    discovered: number;
    expected: number;
    unexpected: number;
    skipped: number;
    flaky: number;
    failureInventory: number;
    verified: number;
    inferred: number;
    unclassified: number;
    verifiedExistingOnBase: number;
    verifiedIntroduced: number;
    verifiedFixed: number;
    remediated: number;
    partiallyAddressed: number;
  }>;
  extractedTests: readonly GroundGlassM7hTest[];
}>;

/**
 * Checks raw-source identity, all 277 historical outcomes, the complete
 * 99-failure classification map, and every claimed reproduction against the
 * referenced raw Playwright report loaded by the caller.
 */
export const evaluateGroundGlassM7hBroadE2eTriage = (
  reportValue: unknown,
  historicalReportValue: unknown,
  historicalReportSha256: unknown,
  reproductionArtifacts: Readonly<Record<string, Readonly<{ sha256: string; report: unknown }>>> = {},
): GroundGlassM7hTriageEvaluation => {
  const issues: string[] = [];
  const report = isRecord(reportValue) ? reportValue : {};
  const historical = isRecord(historicalReportValue) ? historicalReportValue : {};
  const stats = isRecord(historical.stats) ? historical.stats : {};
  const reportIdentityValid = report.schemaVersion === 1 &&
    report.reportId === GROUND_GLASS_M7H_REPORT_ID &&
    report.evaluatorRevision === GROUND_GLASS_M7H_EVALUATOR_REVISION &&
    report.historicalReportPath === GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH &&
    report.historicalSourceCommitSha === GROUND_GLASS_M7H_HISTORICAL_SOURCE_SHA &&
    report.historicalReportSha256 === GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256 &&
    historicalReportSha256 === GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256;
  if (!reportIdentityValid) issues.push("historical-report-identity-or-digest-invalid");

  const extractedTests = extractGroundGlassM7hPlaywrightTests(historical, historicalReportSha256);
  const extractedIds = new Set(extractedTests.map((test) => test.testId));
  const duplicateExtractedIds = extractedIds.size !== extractedTests.length;
  const counts = {
    discovered: extractedTests.length,
    expected: extractedTests.filter((test) => test.resultStatus === "expected").length,
    unexpected: extractedTests.filter((test) => test.resultStatus === "unexpected").length,
    skipped: extractedTests.filter((test) => test.resultStatus === "skipped").length,
    flaky: extractedTests.filter((test) => test.retryCount > 0 && test.resultStatus === "expected").length,
    failureInventory: 0,
    verified: 0,
    inferred: 0,
    unclassified: 0,
    verifiedExistingOnBase: 0,
    verifiedIntroduced: 0,
    verifiedFixed: 0,
    remediated: 0,
    partiallyAddressed: 0,
  };
  const sourceCountsValid = counts.discovered === 277 && counts.expected === 103 &&
    counts.unexpected === 99 && counts.skipped === 75 && counts.flaky === 0 &&
    counts.discovered === numeric(stats.expected) + numeric(stats.unexpected) + numeric(stats.skipped) &&
    numeric(stats.expected) === counts.expected && numeric(stats.unexpected) === counts.unexpected &&
    numeric(stats.skipped) === counts.skipped && numeric(stats.flaky) === counts.flaky &&
    !duplicateExtractedIds;
  if (!sourceCountsValid) issues.push("historical-source-counts-or-test-identities-invalid");
  const declaredCounts = isRecord(report.historicalCounts) ? report.historicalCounts : {};
  const declared = isRecord(declaredCounts.declared) ? declaredCounts.declared : {};
  const computed = isRecord(declaredCounts.computed) ? declaredCounts.computed : {};
  if (["discovered", "expected", "unexpected", "skipped", "flaky"].some((key) =>
    declared[key] !== counts[key as keyof typeof counts] || computed[key] !== counts[key as keyof typeof counts])) {
    issues.push("declared-historical-counts-do-not-match-inventory");
  }

  const rawInventory = Array.isArray(report.historicalInventory) ? report.historicalInventory.filter(isRecord) : [];
  if (rawInventory.length !== counts.discovered) issues.push("historical-inventory-length-mismatch");
  const inventoryIds = new Set(rawInventory.map((test) => string(test.testId)));
  if (inventoryIds.size !== rawInventory.length || extractedTests.some((test) => !inventoryIds.has(test.testId))) {
    issues.push("historical-inventory-identities-incomplete-or-duplicated");
  }
  const extractedById = new Map(extractedTests.map((test) => [test.testId, test]));
  for (const testValue of rawInventory) {
    const test = extractedById.get(string(testValue.testId));
    if (!test || testValue.resultStatus !== test.resultStatus || testValue.specFile !== test.specFile ||
        testValue.testTitle !== test.testTitle || testValue.projectName !== test.projectName ||
        testValue.sourceArtifactSha256 !== GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256) {
      issues.push("historical-inventory-outcome-does-not-match-source");
      break;
    }
  }

  const failureInventory = Array.isArray(report.failureInventory) ? report.failureInventory.filter(isRecord) : [];
  counts.failureInventory = failureInventory.length;
  const sourceFailureIds = new Set(extractedTests.filter((test) => test.resultStatus === "unexpected").map((test) => test.testId));
  const classifiedIds = new Set(failureInventory.map((entry) => string(entry.testId)));
  if (failureInventory.length !== 99 || classifiedIds.size !== failureInventory.length ||
      classifiedIds.size !== sourceFailureIds.size || [...sourceFailureIds].some((id) => !classifiedIds.has(id))) {
    issues.push("failure-inventory-missing-duplicate-or-unexpected-entry");
  }

  const reproductionRuns = Array.isArray(report.reproductionRuns) ? report.reproductionRuns.filter(isRecord) : [];
  const runsById = new Map(reproductionRuns.map((run) => [string(run.id), run]));
  const validOrigin = new Set<string>(GROUND_GLASS_M7H_ORIGIN_CLASSIFICATIONS);
  const validCause = new Set<string>(GROUND_GLASS_M7H_CAUSE_CLASSIFICATIONS);
  const validConfidence = new Set<string>(GROUND_GLASS_M7H_CONFIDENCE_LEVELS);
  const validRemediation = new Set(["unchanged", "test-contract-updated", "harness-updated", "partially-addressed", "unresolved"]);
  const artifactIssues = new Set<string>();
  for (const run of reproductionRuns) {
    const artifact = reproductionArtifacts[string(run.reportPath)];
    const raw = isRecord(artifact?.report) ? artifact.report : {};
    const rawConfig = isRecord(raw.config) ? raw.config : {};
    const rawProjects = Array.isArray(rawConfig.projects) ? rawConfig.projects.filter(isRecord) : [];
    const commandHasProject = typeof run.invocation === "string" &&
      run.invocation.includes(`--project=${string(run.projectName)}`);
    const commandWorkers = typeof run.invocation === "string"
      ? run.invocation.match(/--workers(?:=|\s+)(\d+)/)?.[1]
      : null;
    if (!artifact || !sha256(run.reportSha256) || artifact.sha256 !== run.reportSha256 ||
        !sha(run.sourceCommitSha) || typeof run.invocation !== "string" || !run.invocation.trim() ||
        run.projectName !== "chromium" || rawProjects.length !== 1 || rawProjects[0].id !== run.projectName ||
        !Number.isInteger(run.workers) || numeric(run.workers) <= 0 || rawConfig.workers !== run.workers ||
        !commandHasProject || commandWorkers !== String(run.workers) ||
        run.executionClassification !== "ordinary-chromium-non-native" ||
        !string(run.browserVersion) || !string(run.environmentFingerprint)) {
      artifactIssues.add("reproduction-provenance-or-artifact-invalid");
    }
  }
  for (const entry of failureInventory) {
    const sourceTest = extractedById.get(string(entry.testId));
    const origin = entry.originClassification;
    const cause = entry.causeClassification;
    const confidence = entry.confidence;
    if (!sourceTest || !validOrigin.has(string(origin)) || !validCause.has(string(cause)) ||
        !validConfidence.has(string(confidence)) || !validRemediation.has(string(entry.remediationStatus)) ||
        entry.historicalErrorSignature !== sourceTest.errorCategory) {
      issues.push("failure-classification-schema-or-source-mismatch");
      continue;
    }
    if (confidence === "verified") counts.verified += 1;
    else if (confidence === "tentative" || confidence === "strongly-supported") counts.inferred += 1;
    else counts.unclassified += 1;
    if (origin === "verified-existing-on-base") counts.verifiedExistingOnBase += 1;
    if (origin === "verified-introduced-on-head") counts.verifiedIntroduced += 1;
    if (origin === "verified-fixed-on-head") counts.verifiedFixed += 1;
    if (entry.remediationStatus === "test-contract-updated" || entry.remediationStatus === "harness-updated") {
      counts.remediated += 1;
      if (origin !== "verified-fixed-on-head") issues.push("unverified-or-removed-test-counted-as-remediated");
    }
    if (entry.remediationStatus === "partially-addressed") counts.partiallyAddressed += 1;
    if (typeof entry.reason !== "string" || !entry.reason.trim() ||
        typeof entry.followUpRecommendation !== "string" || !entry.followUpRecommendation.trim()) {
      issues.push("failure-classification-reason-or-follow-up-missing");
    }
    const baselineId = typeof entry.baselineEvidence === "string" ? entry.baselineEvidence : null;
    const candidateId = typeof entry.candidateEvidence === "string" ? entry.candidateEvidence : null;
    const baseline = baselineId ? runsById.get(baselineId) : undefined;
    const candidate = candidateId ? runsById.get(candidateId) : undefined;
    const verifiedOrigin = origin === "verified-existing-on-base" ||
      origin === "verified-introduced-on-head" || origin === "verified-fixed-on-head";
    if (verifiedOrigin && confidence !== "verified") issues.push("verified-origin-must-use-verified-confidence");
    if (verifiedOrigin && (!baseline || !candidate || baseline.comparableWith !== candidate.id ||
        candidate.comparableWith !== baseline.id)) {
      issues.push("verified-origin-lacks-matched-baseline-and-candidate-runs");
      continue;
    }
    if (verifiedOrigin && baseline && candidate) {
      const baseArtifact = reproductionArtifacts[string(baseline.reportPath)];
      const candidateArtifact = reproductionArtifacts[string(candidate.reportPath)];
      const baseTest = extractGroundGlassM7hPlaywrightTests(baseArtifact?.report, baseArtifact?.sha256)
        .find((test) => test.testId === sourceTest.testId);
      const candidateTest = extractGroundGlassM7hPlaywrightTests(candidateArtifact?.report, candidateArtifact?.sha256)
        .find((test) => test.testId === sourceTest.testId);
      if (!baseTest || !candidateTest) artifactIssues.add("verified-origin-test-absent-from-reproduction");
      else if (origin === "verified-existing-on-base" &&
          (baseTest.resultStatus !== "unexpected" || candidateTest.resultStatus !== "unexpected")) {
        artifactIssues.add("existing-on-base-claim-not-observed");
      } else if (origin === "verified-introduced-on-head" &&
          (baseTest.resultStatus !== "expected" || candidateTest.resultStatus !== "unexpected")) {
        artifactIssues.add("introduced-on-head-claim-not-observed");
      } else if (origin === "verified-fixed-on-head" &&
          (baseTest.resultStatus !== "unexpected" || candidateTest.resultStatus !== "expected")) {
        artifactIssues.add("fixed-on-head-claim-not-observed");
      }
      if (baseline.workers !== candidate.workers || baseline.projectName !== candidate.projectName ||
          baseline.environmentFingerprint !== candidate.environmentFingerprint) {
        artifactIssues.add("baseline-candidate-environments-not-comparable");
      }
      if (baseline.sourceCommitSha !== GROUND_GLASS_M7H_CLEAN_BASELINE_SHA &&
          baseline.sourceCommitSha !== GROUND_GLASS_M7H_CURRENT_MAIN_SHA) {
        artifactIssues.add("verified-baseline-commit-is-not-an-identified-main-revision");
      }
      if (candidate.sourceCommitSha === baseline.sourceCommitSha) {
        artifactIssues.add("candidate-reproduction-does-not-identify-a-distinct-source-commit");
      }
    }
    if (confidence === "verified" && !verifiedOrigin && cause !== "unknown") {
      // A verified cause still needs a concrete attached reproduction even when
      // the regression origin itself remains unclassified.
      if (!baseline || !candidate) artifactIssues.add("verified-cause-lacks-reproduction-evidence");
    }
    if (confidence === "unclassified" && cause !== "unknown") issues.push("unclassified-entry-has-specific-cause");
  }
  if (artifactIssues.size > 0) issues.push(...artifactIssues);

  const discovery = isRecord(report.currentDiscovery) ? report.currentDiscovery : {};
  const discoveryArtifact = typeof discovery.artifactPath === "string"
    ? reproductionArtifacts[discovery.artifactPath]
    : undefined;
  const discoveryValue = isRecord(discoveryArtifact?.report) ? discoveryArtifact.report : {};
  const discoveredTests = Array.isArray(discoveryValue.tests) ? discoveryValue.tests.filter(isRecord) : [];
  const discoveredIds = discoveredTests.map((test) => string(test.testId));
  const currentIds = new Set(discoveredIds);
  const historicalIds = new Set(extractedTests.map((test) => test.testId));
  const actualAdded = [...currentIds].filter((id) => !historicalIds.has(id)).sort();
  const actualRemoved = [...historicalIds].filter((id) => !currentIds.has(id)).sort();
  const declaredAdded = Array.isArray(discovery.added) ? discovery.added.filter((id): id is string => typeof id === "string").sort() : [];
  const declaredRemoved = Array.isArray(discovery.removed) ? discovery.removed.filter((id): id is string => typeof id === "string").sort() : [];
  if (!discoveryArtifact || !sha256(discovery.artifactSha256) ||
      discoveryArtifact.sha256 !== discovery.artifactSha256 ||
      discoveredTests.length !== discovery.discoveredTests || currentIds.size !== discoveredTests.length ||
      actualAdded.join("\n") !== declaredAdded.join("\n") || actualRemoved.join("\n") !== declaredRemoved.join("\n")) {
    issues.push("current-discovery-artifact-or-drift-mismatch");
  }
  if (discovery.disclosed !== true || !Number.isInteger(discovery.discoveredTests) ||
      !Array.isArray(discovery.added) || !Array.isArray(discovery.removed) ||
      !Array.isArray(discovery.renamed) || typeof discovery.command !== "string" || !discovery.command.trim()) {
    issues.push("current-discovery-drift-not-disclosed");
  }
  const authorization = isRecord(report.authorization) ? report.authorization : {};
  if (authorization.m7Overall !== "partially-qualified" || authorization.m8Entry !== "denied" ||
      authorization.productionGroundGlass !== "WebGL-only" || authorization.productionWebGpuEnabled !== false ||
      report.broadE2eQualification !== "not-qualified" || report.nativeWebGpuQualified !== false) {
    issues.push("triage-must-not-promote-m7-m8-or-production-webgpu");
  }
  if (!Array.isArray(report.productionIsolationControls) ||
      !report.productionIsolationControls.includes("production-preview-webgl-only")) {
    issues.push("production-isolation-negative-control-missing");
  }

  const classificationFailures = issues.some((issue) =>
    issue.includes("failure-classification") || issue.includes("failure-inventory") ||
    issue.includes("verified-origin") || issue.includes("unclassified-entry") || issue.includes("remediated"));
  const inventoryFailures = issues.some((issue) =>
    issue.includes("historical-") || issue.includes("duplicate") || issue.includes("source-counts"));
  const reproductionFailures = [...artifactIssues].length > 0 || issues.some((issue) => issue.includes("reproduction"));
  return {
    valid: issues.length === 0,
    inventoryIntegrity: inventoryFailures ? "failed" : "passed",
    classificationIntegrity: classificationFailures ? "failed" : "passed",
    reproductionIntegrity: reproductionFailures ? "failed" : "passed",
    broadE2eQualification: "not-qualified",
    issues,
    counts,
    extractedTests,
  };
};
