import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_M7H_CURRENT_MAIN_SHA,
  GROUND_GLASS_M7H_EVALUATOR_REVISION,
  GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH,
  GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256,
  GROUND_GLASS_M7H_HISTORICAL_SOURCE_SHA,
  GROUND_GLASS_M7H_REPORT_ID,
  evaluateGroundGlassM7hBroadE2eTriage,
  extractGroundGlassM7hPlaywrightTests,
} from "../../render/testing/groundGlassM7hBroadE2eTriage";

const sourceBytes = readFileSync(resolve(process.cwd(), GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH));
const sourceSha = createHash("sha256").update(sourceBytes).digest("hex");
const sourceReport = JSON.parse(sourceBytes.toString("utf8")) as Record<string, unknown>;
const sourceTests = extractGroundGlassM7hPlaywrightTests(sourceReport, sourceSha);
const sourceFailures = sourceTests.filter((test) => test.resultStatus === "unexpected");

const baseReport = () => ({
  schemaVersion: 1,
  reportId: GROUND_GLASS_M7H_REPORT_ID,
  evaluatorRevision: GROUND_GLASS_M7H_EVALUATOR_REVISION,
  historicalReportPath: GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH,
  historicalReportSha256: GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256,
  historicalSourceCommitSha: GROUND_GLASS_M7H_HISTORICAL_SOURCE_SHA,
  historicalCounts: {
    declared: { discovered: 277, expected: 103, unexpected: 99, skipped: 75, flaky: 0 },
    computed: { discovered: 277, expected: 103, unexpected: 99, skipped: 75, flaky: 0 },
  },
  historicalInventory: sourceTests,
  failureInventory: sourceFailures.map((test) => ({
    testId: test.testId,
    historicalErrorSignature: test.errorCategory,
    cohortId: "unclassified-historical-failure",
    originClassification: "not-compared",
    causeClassification: "unknown",
    confidence: "unclassified",
    baselineEvidence: null,
    candidateEvidence: null,
    reason: "The retained failure is inventoried, but this specific case has no comparable reproduction evidence.",
    remediationStatus: "unresolved",
    followUpRecommendation: "Select a representative or targeted case before assigning cause or regression origin.",
  })),
  reproductionRuns: [] as Array<Record<string, unknown>>,
  currentDiscovery: {
    disclosed: true,
    discoveredTests: 278,
    artifactPath: "docs/architecture/ground-glass-m7h-broad-e2e/validation/current-chromium-discovery.json",
    artifactSha256: discoverySha,
    command: "npm run test:e2e -- --project=chromium --list",
    added: ["chromium::smoke.spec.ts::smoke: Architecture Rise navigates to contentful WebGL Ground Glass controls"],
    removed: [],
    renamed: [],
  },
  productionIsolationControls: ["production-preview-webgl-only"],
  broadE2eQualification: "not-qualified",
  nativeWebGpuQualified: false,
  authorization: {
    m7Overall: "partially-qualified",
    m8Entry: "denied",
    productionGroundGlass: "WebGL-only",
    productionWebGpuEnabled: false,
  },
});

const digest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const addedSmokeTest = {
  testId: "chromium::smoke.spec.ts::smoke: Architecture Rise navigates to contentful WebGL Ground Glass controls",
  specFile: "smoke.spec.ts",
  describePath: [],
  testTitle: "smoke: Architecture Rise navigates to contentful WebGL Ground Glass controls",
  projectName: "chromium",
};
const discoveryPath = "docs/architecture/ground-glass-m7h-broad-e2e/validation/current-chromium-discovery.json";
const currentDiscoveryArtifact = { tests: [...sourceTests, addedSmokeTest] };
const discoverySha = digest(currentDiscoveryArtifact);
const evaluate = (report: unknown, artifacts: Record<string, { sha256: string; report: unknown }> = {}) =>
  evaluateGroundGlassM7hBroadE2eTriage(report, sourceReport, sourceSha, {
    [discoveryPath]: { sha256: discoverySha, report: currentDiscoveryArtifact },
    ...artifacts,
  });

const singleTestReport = (testId: string, status: "passed" | "failed" | "skipped") => {
  const sourceTest = sourceTests.find((test) => test.testId === testId);
  if (!sourceTest) throw new Error(`Missing source test ${testId}`);
  const result: Record<string, unknown> = { status, duration: 11, attachments: [] };
  if (status === "failed") result.error = { message: "Expected revision 186, received 187" };
  return {
    config: { projects: [{ id: "chromium" }], workers: 1 },
    suites: [{
      title: sourceTest.specFile,
      file: sourceTest.specFile,
      specs: [{
        title: sourceTest.testTitle,
        file: sourceTest.specFile,
        tests: [{
          expectedStatus: "passed",
          projectId: "chromium",
          projectName: "chromium",
          results: [result],
        }],
      }],
    }],
    stats: {
      expected: status === "passed" ? 1 : 0,
      unexpected: status === "failed" ? 1 : 0,
      skipped: status === "skipped" ? 1 : 0,
      flaky: 0,
    },
  };
};

const withFixedRevisionEvidence = () => {
  const report = baseReport();
  const fixed = sourceFailures.find((test) => test.errorCategory === "renderer-revision-assertion");
  if (!fixed) throw new Error("Historical revision failure fixture is missing");
  const baselineReport = singleTestReport(fixed.testId, "failed");
  const candidateReport = singleTestReport(fixed.testId, "passed");
  const baselinePath = "docs/architecture/ground-glass-m7h-broad-e2e/reproduction/base.json";
  const candidatePath = "docs/architecture/ground-glass-m7h-broad-e2e/reproduction/head.json";
  const baselineSha = digest(baselineReport);
  const candidateSha = digest(candidateReport);
  report.reproductionRuns = [
    {
      id: "current-main-r187-revision-check",
      sourceCommitSha: GROUND_GLASS_M7H_CURRENT_MAIN_SHA,
      invocation: "npm run test:e2e -- --project=chromium --workers=1 --grep revision-cases",
      projectName: "chromium",
      workers: 1,
      browserVersion: "Chromium 149.0.7827.55",
      environmentFingerprint: "node24-macos27-arm64-chromium149-workers1",
      executionClassification: "ordinary-chromium-non-native",
      reportPath: baselinePath,
      reportSha256: baselineSha,
      comparableWith: "m7h-head-r187-revision-check",
    },
    {
      id: "m7h-head-r187-revision-check",
      sourceCommitSha: "1111111111111111111111111111111111111111",
      invocation: "npm run test:e2e -- --project=chromium --workers=1 --grep revision-cases",
      projectName: "chromium",
      workers: 1,
      browserVersion: "Chromium 149.0.7827.55",
      environmentFingerprint: "node24-macos27-arm64-chromium149-workers1",
      executionClassification: "ordinary-chromium-non-native",
      reportPath: candidatePath,
      reportSha256: candidateSha,
      comparableWith: "current-main-r187-revision-check",
    },
  ];
  const entry = report.failureInventory.find((item) => item.testId === fixed.testId);
  if (!entry) throw new Error("Classification fixture is missing");
  Object.assign(entry, {
    cohortId: "three-version-assertion",
    originClassification: "verified-fixed-on-head",
    causeClassification: "obsolete-test-contract",
    confidence: "verified",
    baselineEvidence: "current-main-r187-revision-check",
    candidateEvidence: "m7h-head-r187-revision-check",
    reason: "A fallback-only fixture asserted historical r186 although the installed package is r187; the contract now follows REVISION.",
    remediationStatus: "test-contract-updated",
    followUpRecommendation: "Keep native r186 evidence assertions fixed to their historical record.",
  });
  return {
    report,
    artifacts: {
      [baselinePath]: { sha256: baselineSha, report: baselineReport },
      [candidatePath]: { sha256: candidateSha, report: candidateReport },
    },
    testId: fixed.testId,
  };
};

describe("M7H broad E2E triage evidence", () => {
  it("extracts and preserves the exact historical inventory", () => {
    expect(sourceSha).toBe(GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256);
    expect(sourceTests).toHaveLength(277);
    expect(new Set(sourceTests.map((test) => test.testId)).size).toBe(277);
    expect(sourceFailures).toHaveLength(99);
    expect(sourceTests.filter((test) => test.resultStatus === "expected")).toHaveLength(103);
    expect(sourceTests.filter((test) => test.resultStatus === "skipped")).toHaveLength(75);
  });

  it("accepts a complete inventory with a verified paired fix and explicit unresolved backlog", () => {
    const fixture = withFixedRevisionEvidence();
    const evaluation = evaluate(fixture.report, fixture.artifacts);
    expect(evaluation.valid, evaluation.issues.join(", ")).toBe(true);
    expect(evaluation.counts).toMatchObject({
      discovered: 277,
      unexpected: 99,
      failureInventory: 99,
      verifiedFixed: 1,
      remediated: 1,
      unclassified: 98,
    });
    expect(evaluation.broadE2eQualification).toBe("not-qualified");
  });

  it("rejects a changed historical digest or source commit", () => {
    const report = baseReport();
    expect(evaluate({ ...report, currentDiscovery: { ...report.currentDiscovery, artifactSha256: discoverySha } }, { [discoveryPath]: { sha256: "0".repeat(64), report: currentDiscoveryArtifact } }).valid).toBe(false);
    const changedSource = { ...report, historicalSourceCommitSha: "1".repeat(40) };
    expect(evaluate(changedSource).valid).toBe(false);
  });

  it("rejects missing, duplicate, invented, or passing-test failure entries", () => {
    const missing = baseReport();
    missing.failureInventory.pop();
    expect(evaluate(missing).valid).toBe(false);

    const duplicate = baseReport();
    duplicate.failureInventory.push(duplicate.failureInventory[0]);
    expect(evaluate(duplicate).valid).toBe(false);

    const invented = baseReport();
    const passing = sourceTests.find((test) => test.resultStatus === "expected");
    if (!passing) throw new Error("Passing historical fixture is missing");
    invented.failureInventory.push({
      ...invented.failureInventory[0],
      testId: passing.testId,
      historicalErrorSignature: passing.errorCategory,
    });
    expect(evaluate(invented).valid).toBe(false);
  });

  it("rejects inconsistent report counts and skipped tests represented as passed fixes", () => {
    const wrongCount = baseReport();
    wrongCount.historicalCounts.declared.unexpected = 98;
    expect(evaluate(wrongCount).valid).toBe(false);

    const fixture = withFixedRevisionEvidence();
    const run = fixture.report.reproductionRuns[1];
    const skipped = singleTestReport(fixture.testId, "skipped");
    const path = String(run.reportPath);
    const digestValue = digest(skipped);
    run.reportSha256 = digestValue;
    const evaluation = evaluate(fixture.report, {
      ...fixture.artifacts,
      [path]: { sha256: digestValue, report: skipped },
    });
    expect(evaluation.valid).toBe(false);
    expect(evaluation.issues).toContain("fixed-on-head-claim-not-observed");
  });

  it("rejects incomplete or non-comparable reproduction provenance", () => {
    const fixture = withFixedRevisionEvidence();
    fixture.report.reproductionRuns[0].invocation = "  ";
    expect(evaluate(fixture.report, fixture.artifacts).valid).toBe(false);

    const workerMismatch = withFixedRevisionEvidence();
    workerMismatch.report.reproductionRuns[1].workers = 4;
    const evaluation = evaluate(workerMismatch.report, workerMismatch.artifacts);
    expect(evaluation.valid).toBe(false);
    expect(evaluation.issues).toContain("baseline-candidate-environments-not-comparable");
  });

  it("rejects tentative verified diagnoses, removed tests counted as fixed, and invented clean-main results", () => {
    const tentative = withFixedRevisionEvidence();
    const entry = tentative.report.failureInventory.find((item) => item.testId === tentative.testId);
    if (!entry) throw new Error("Classification fixture is missing");
    entry.confidence = "tentative";
    expect(evaluate(tentative.report, tentative.artifacts).issues)
      .toContain("verified-origin-must-use-verified-confidence");

    const removed = baseReport();
    removed.failureInventory[0].remediationStatus = "test-contract-updated";
    expect(evaluate(removed).issues)
      .toContain("unverified-or-removed-test-counted-as-remediated");

    const inventedBase = withFixedRevisionEvidence();
    const baseline = inventedBase.report.reproductionRuns[0];
    const pass = singleTestReport(inventedBase.testId, "passed");
    const path = String(baseline.reportPath);
    const passSha = digest(pass);
    baseline.reportSha256 = passSha;
    const evaluation = evaluate(inventedBase.report, {
      ...inventedBase.artifacts,
      [path]: { sha256: passSha, report: pass },
    });
    expect(evaluation.issues).toContain("fixed-on-head-claim-not-observed");
  });

  it("keeps broad, native, M8, and production authorization boundaries closed", () => {
    const native = baseReport();
    native.nativeWebGpuQualified = true;
    native.currentDiscovery.artifactSha256 = discoverySha;
    expect(evaluate(native).valid).toBe(false);

    const production = baseReport();
    production.productionIsolationControls = [];
    production.currentDiscovery.artifactSha256 = discoverySha;
    expect(evaluate(production).valid).toBe(false);

    const m8 = baseReport();
    m8.authorization.m8Entry = "authorized";
    m8.currentDiscovery.artifactSha256 = discoverySha;
    expect(evaluate(m8).valid).toBe(false);
  });
});
