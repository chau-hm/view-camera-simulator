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
  deriveGroundGlassM7hPlaywrightOutcome,
  evaluateGroundGlassM7hBroadE2eTriage,
  extractGroundGlassM7hPlaywrightTests,
} from "../../render/testing/groundGlassM7hBroadE2eTriage";

const sourceBytes = readFileSync(resolve(process.cwd(), GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH));
const sourceSha = createHash("sha256").update(sourceBytes).digest("hex");
const sourceReport = JSON.parse(sourceBytes.toString("utf8")) as Record<string, unknown>;
const sourceTests = extractGroundGlassM7hPlaywrightTests(sourceReport, sourceSha);
const sourceFailures = sourceTests.filter((test) => test.resultStatus === "unexpected");

const countBy = (entries: readonly Record<string, unknown>[], key: string): Record<string, number> =>
  entries.reduce<Record<string, number>>((counts, entry) => {
    const value = entry[key];
    if (typeof value === "string") counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});

const summarizeClassifications = (entries: readonly Record<string, unknown>[]) => {
  const sourceById = new Map(sourceTests.map((test) => [test.testId, test]));
  const bySpec = entries.reduce<Record<string, number>>((counts, entry) => {
    const specFile = sourceById.get(String(entry.testId))?.specFile;
    if (specFile) counts[specFile] = (counts[specFile] ?? 0) + 1;
    return counts;
  }, {});
  return {
    failureCount: entries.length,
    byOrigin: countBy(entries, "originClassification"),
    byCause: countBy(entries, "causeClassification"),
    byErrorCategory: countBy(entries, "historicalErrorSignature"),
    bySpec,
    verifiedFixed: entries.filter((entry) => entry.originClassification === "verified-fixed-on-head").length,
    verifiedExistingOnBase: entries.filter((entry) => entry.originClassification === "verified-existing-on-base").length,
    verifiedIntroduced: entries.filter((entry) => entry.originClassification === "verified-introduced-on-head").length,
    tentativeCohortMembers: entries.filter((entry) => entry.confidence === "tentative").length,
    unclassified: entries.filter((entry) => entry.confidence === "unclassified").length,
    partiallyAddressed: entries.filter((entry) => entry.remediationStatus === "partially-addressed").length,
    remediated: entries.filter((entry) => entry.remediationStatus === "test-contract-updated" || entry.remediationStatus === "harness-updated").length,
  };
};

const baseReport = () => {
  const failureInventory = sourceFailures.map((test) => ({
    testId: test.testId,
    historicalOutcome: test.resultStatus,
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
  }));
  return {
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
    failureInventory,
    classificationSummary: summarizeClassifications(failureInventory),
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
  };
};

const digest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
type ReproductionArtifact = Readonly<{ sha256: string; report: unknown }>;
type FixedEvidenceFixture = Readonly<{
  report: ReturnType<typeof baseReport>;
  artifacts: Record<string, ReproductionArtifact>;
  testId: string;
}>;

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

const withFixedRevisionEvidence = (): FixedEvidenceFixture => {
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
  report.classificationSummary = summarizeClassifications(report.failureInventory);
  return {
    report,
    artifacts: {
      [baselinePath]: { sha256: baselineSha, report: baselineReport },
      [candidatePath]: { sha256: candidateSha, report: candidateReport },
    },
    testId: fixed.testId,
  };
};

const withCandidateOutcome = (
  fixture: ReturnType<typeof withFixedRevisionEvidence>,
  expectedStatus: string,
  statuses: readonly string[],
) => {
  const candidateRun = fixture.report.reproductionRuns.find((run) => run.id === "m7h-head-r187-revision-check");
  if (!candidateRun) throw new Error("Candidate reproduction fixture is missing");
  const candidatePath = String(candidateRun.reportPath);
  const candidate = structuredClone(fixture.artifacts[candidatePath]!.report) as ReturnType<typeof singleTestReport>;
  const candidateTest = candidate.suites[0]!.specs[0]!.tests[0]!;
  candidateTest.expectedStatus = expectedStatus;
  candidateTest.results = statuses.map((status) => ({
    status,
    duration: 11,
    attachments: [],
    ...(status === "failed" || status === "timedOut" || status === "interrupted"
      ? { error: { message: "Synthetic candidate failure" } }
      : {}),
  }));
  const candidateSha = digest(candidate);
  candidateRun.reportSha256 = candidateSha;
  fixture.artifacts[candidatePath] = { sha256: candidateSha, report: candidate };
  return fixture;
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

  it.each([
    ["expected failure", "failed", ["failed"]],
    ["expected skip", "skipped", ["skipped"]],
    ["unexpected failure", "passed", ["failed"]],
    ["timeout", "passed", ["timedOut"]],
    ["interruption", "passed", ["interrupted"]],
    ["unexpected pass for a test declared to fail", "failed", ["passed"]],
    ["retry-dependent pass", "passed", ["failed", "passed"]],
    ["missing result", "passed", []],
    ["invalid result status", "passed", ["unknown"]],
  ] as const)("rejects a candidate %s as a verified fix", (_label, expectedStatus, statuses) => {
    const fixture = withCandidateOutcome(withFixedRevisionEvidence(), expectedStatus, statuses);
    const evaluation = evaluate(fixture.report, fixture.artifacts);
    expect(evaluation.valid).toBe(false);
    expect(evaluation.issues).toContain("fixed-on-head-claim-not-observed");
  });

  it("preserves a valid expected-failure observation without counting it as an actual pass", () => {
    const outcome = deriveGroundGlassM7hPlaywrightOutcome("failed", [{ status: "failed" }]);
    expect(outcome).toMatchObject({ resultStatus: "expected", actualStatus: "failed", actualPass: false });
    const fixture = withCandidateOutcome(withFixedRevisionEvidence(), "failed", ["failed"]);
    expect(evaluate(fixture.report, fixture.artifacts).issues)
      .toContain("fixed-on-head-claim-not-observed");
  });

  it("rejects a removed candidate test or a changed stable identity", () => {
    const removed = withFixedRevisionEvidence();
    const removedRun = removed.report.reproductionRuns[1];
    if (!removedRun) throw new Error("Candidate reproduction fixture is missing");
    const removedPath = String(removedRun.reportPath);
    const removedReport = structuredClone(removed.artifacts[removedPath]!.report) as ReturnType<typeof singleTestReport>;
    removedReport.suites[0]!.specs[0]!.tests = [];
    const removedSha = digest(removedReport);
    removedRun.reportSha256 = removedSha;
    removed.artifacts[removedPath] = { sha256: removedSha, report: removedReport };
    expect(evaluate(removed.report, removed.artifacts).issues)
      .toContain("verified-origin-test-absent-from-reproduction");

    const renamed = withFixedRevisionEvidence();
    const renamedRun = renamed.report.reproductionRuns[1];
    if (!renamedRun) throw new Error("Candidate reproduction fixture is missing");
    const renamedPath = String(renamedRun.reportPath);
    const renamedReport = structuredClone(renamed.artifacts[renamedPath]!.report) as ReturnType<typeof singleTestReport>;
    renamedReport.suites[0]!.specs[0]!.title = "changed test identity";
    const renamedSha = digest(renamedReport);
    renamedRun.reportSha256 = renamedSha;
    renamed.artifacts[renamedPath] = { sha256: renamedSha, report: renamedReport };
    expect(evaluate(renamed.report, renamed.artifacts).issues)
      .toContain("verified-origin-test-absent-from-reproduction");
  });

  it("requires a genuine unexpected baseline failure and distinct source commits", () => {
    for (const [expectedStatus, status] of [["failed", "failed"], ["passed", "passed"]] as const) {
      const fixture = withFixedRevisionEvidence();
      const baseline = fixture.report.reproductionRuns[0];
      if (!baseline) throw new Error("Baseline reproduction fixture is missing");
      const path = String(baseline.reportPath);
      const mutated = singleTestReport(fixture.testId, status);
      const test = mutated.suites[0]!.specs[0]!.tests[0]!;
      test.expectedStatus = expectedStatus;
      const sha = digest(mutated);
      baseline.reportSha256 = sha;
      fixture.artifacts[path] = { sha256: sha, report: mutated };
      expect(evaluate(fixture.report, fixture.artifacts).issues)
        .toContain("fixed-on-head-claim-not-observed");
    }

    const sameSource = withFixedRevisionEvidence();
    sameSource.report.reproductionRuns[1]!.sourceCommitSha = sameSource.report.reproductionRuns[0]!.sourceCommitSha;
    expect(evaluate(sameSource.report, sameSource.artifacts).issues)
      .toContain("candidate-reproduction-does-not-identify-a-distinct-source-commit");
  });

  it("retains an expected-pass interruption as a distinct baseline observation", () => {
    const fixture = withFixedRevisionEvidence();
    const baseline = fixture.report.reproductionRuns[0];
    if (!baseline) throw new Error("Baseline reproduction fixture is missing");
    const path = String(baseline.reportPath);
    const interrupted = singleTestReport(fixture.testId, "passed");
    interrupted.suites[0]!.specs[0]!.tests[0]!.results[0]!.status = "interrupted";
    const sha = digest(interrupted);
    baseline.reportSha256 = sha;
    fixture.artifacts[path] = { sha256: sha, report: interrupted };

    const evaluation = evaluate(fixture.report, fixture.artifacts);
    expect(evaluation.valid, evaluation.issues.join(", ")).toBe(true);
    expect(evaluation.counts.verifiedFixed).toBe(1);
  });

  it("rejects a failed verification even when an edited classification summary hides the fixed count", () => {
    const fixture = withCandidateOutcome(withFixedRevisionEvidence(), "passed", ["failed"]);
    fixture.report.classificationSummary.verifiedFixed = 0;
    const evaluation = evaluate(fixture.report, fixture.artifacts);
    expect(evaluation.issues).toContain("fixed-on-head-claim-not-observed");
    expect(evaluation.issues).toContain("classification-aggregate-counts-do-not-match-inventory");
  });

  it("accepts matched existing-on-base evidence only while both runs still fail", () => {
    const fixture = withCandidateOutcome(withFixedRevisionEvidence(), "passed", ["failed"]);
    const entry = fixture.report.failureInventory.find((item) => item.testId === fixture.testId);
    if (!entry) throw new Error("Classification fixture is missing");
    entry.originClassification = "verified-existing-on-base";
    entry.remediationStatus = "unresolved";
    fixture.report.classificationSummary = summarizeClassifications(fixture.report.failureInventory);
    const evaluation = evaluate(fixture.report, fixture.artifacts);
    expect(evaluation.valid, evaluation.issues.join(", ")).toBe(true);
    expect(evaluation.counts.verifiedExistingOnBase).toBe(1);
  });

  it("rejects a changed historical digest or source commit", () => {
    const report = baseReport();
    expect(evaluate({ ...report, currentDiscovery: { ...report.currentDiscovery, artifactSha256: discoverySha } }, { [discoveryPath]: { sha256: "0".repeat(64), report: currentDiscoveryArtifact } }).valid).toBe(false);
    const changedSource = { ...report, historicalSourceCommitSha: "1".repeat(40) };
    expect(evaluate(changedSource).valid).toBe(false);
  });

  it("rejects altered normalized historical outcomes", () => {
    const report = baseReport();
    const historicalInventory = report.historicalInventory.map((test, index) =>
      index === 0 ? { ...test, actualStatus: test.actualStatus === "passed" ? "failed" : "passed" } : test);
    const evaluation = evaluate({ ...report, historicalInventory });
    expect(evaluation.issues).toContain("historical-inventory-outcome-does-not-match-source");
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

  it("records a partially addressed test without counting it as remediated", () => {
    const report = baseReport();
    report.failureInventory[0].remediationStatus = "partially-addressed";
    report.classificationSummary = summarizeClassifications(report.failureInventory);
    const evaluation = evaluate(report);
    expect(evaluation.valid, evaluation.issues.join(", ")).toBe(true);
    expect(evaluation.counts).toMatchObject({ partiallyAddressed: 1, remediated: 0 });
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

  it("rejects invented baseline commits and ordinary WebGL2 runs relabeled as native", () => {
    const inventedBaseline = withFixedRevisionEvidence();
    inventedBaseline.report.reproductionRuns[0].sourceCommitSha = "2".repeat(40);
    expect(evaluate(inventedBaseline.report, inventedBaseline.artifacts).issues)
      .toContain("verified-baseline-commit-is-not-an-identified-main-revision");

    const nativeRelabel = withFixedRevisionEvidence();
    nativeRelabel.report.reproductionRuns[1].executionClassification = "native-webgpu";
    expect(evaluate(nativeRelabel.report, nativeRelabel.artifacts).issues)
      .toContain("reproduction-provenance-or-artifact-invalid");
  });

  it("accepts production-preview evidence only with its separate non-native project identity", () => {
    const report = baseReport();
    const testId = sourceFailures[0]?.testId;
    if (!testId) throw new Error("Historical failure fixture is missing");
    const productionRawReport = singleTestReport(testId, "passed");
    productionRawReport.config.projects[0]!.id = "chromium-production-preview";
    productionRawReport.suites[0]!.specs[0]!.tests[0]!.projectId = "chromium-production-preview";
    productionRawReport.suites[0]!.specs[0]!.tests[0]!.projectName = "chromium-production-preview";
    const path = "docs/architecture/ground-glass-m7h-broad-e2e/reproduction/production-preview-control.json";
    const sha = digest(productionRawReport);
    report.reproductionRuns.push({
      id: "production-preview-isolation-control",
      sourceCommitSha: "1111111111111111111111111111111111111111",
      invocation: "npm run test:e2e -- --config=playwright.production.config.ts --project=chromium-production-preview --workers=1",
      projectName: "chromium-production-preview",
      workers: 1,
      browserVersion: "Chromium 149.0.7827.55",
      environmentFingerprint: "macOS27-arm64-chromium149-production-preview-workers1",
      executionClassification: "production-preview-non-native",
      reportPath: path,
      reportSha256: sha,
      comparableWith: null,
    });
    const artifacts = { [path]: { sha256: sha, report: productionRawReport } };
    expect(evaluate(report, artifacts).valid).toBe(true);

    report.reproductionRuns[0]!.executionClassification = "native-webgpu";
    expect(evaluate(report, artifacts).issues).toContain("reproduction-provenance-or-artifact-invalid");
  });

  it("rejects classification totals edited independently of the inventory", () => {
    const report = baseReport();
    report.classificationSummary.failureCount -= 1;
    const evaluation = evaluate(report);
    expect(evaluation.issues).toContain("classification-aggregate-counts-do-not-match-inventory");
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
