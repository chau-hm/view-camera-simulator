import {
  GROUND_GLASS_M7H_CLEAN_BASELINE_SHA,
  GROUND_GLASS_M7H_EVALUATOR_REVISION,
  GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256,
  GROUND_GLASS_M7H_HISTORICAL_SOURCE_SHA,
  GROUND_GLASS_M7H_CURRENT_MAIN_SHA,
  deriveGroundGlassM7hPlaywrightReportOutcomes,
  extractGroundGlassM7hPlaywrightTests,
  isGroundGlassM7hActualPass,
  isGroundGlassM7hBaselineFailure,
} from "./groundGlassM7hBroadE2eTriage";

export const GROUND_GLASS_M7I_REPORT_ID = "ground-glass-m7i-broad-e2e-remediation" as const;
export const GROUND_GLASS_M7I_EVALUATOR_REVISION = "m7i-broad-e2e-remediation-evaluator-v1" as const;
export const GROUND_GLASS_M7I_BASE_COMMIT_SHA = "57eacc0d7c41014a3288cbee63a8b58a7aa08557" as const;
export const GROUND_GLASS_M7H_TRIAGE_REPORT_SHA256 = "88545c33a32ed57f6ebbf5bdfbcf9e1320cca32d918c2c08d3fbee1c4efc72d8" as const;
export const GROUND_GLASS_M7I_HISTORICAL_FAILURE_COUNT = 99 as const;
export const GROUND_GLASS_M7I_TENTATIVE_DRAWER_COUNT = 15 as const;
export const GROUND_GLASS_M7I_UNKNOWN_FAILURE_COUNT = 67 as const;

type JsonRecord = Record<string, unknown>;
export type GroundGlassM7iArtifact = Readonly<{ sha256: string; report: unknown }>;
export type GroundGlassM7iArtifacts = Readonly<Record<string, GroundGlassM7iArtifact>>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const string = (value: unknown): string => typeof value === "string" ? value : "";
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const sha = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
const sha256 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const sorted = (values: readonly string[]): string[] => [...values].sort();
const sameStrings = (left: readonly string[], right: readonly string[]): boolean =>
  JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
const readStringList = (value: unknown): string[] =>
  array(value).filter((entry): entry is string => typeof entry === "string");
const getHistoricalFailures = (report: unknown): JsonRecord[] =>
  array(isRecord(report) ? report.failureInventory : null).filter(isRecord);
const getRun = (runs: readonly JsonRecord[], id: string): JsonRecord | undefined =>
  runs.find((run) => string(run.id) === id);
const getTest = (tests: ReturnType<typeof extractGroundGlassM7hPlaywrightTests>, testId: string) =>
  tests.find((test) => test.testId === testId);
const withoutServerPort = (environment: unknown): string => {
  if (!isRecord(environment)) return "";
  const comparable = { ...environment };
  delete comparable.serverPort;
  return JSON.stringify(comparable);
};

export type GroundGlassM7iEvaluation = Readonly<{
  reportId: string;
  evaluatorRevision: string;
  passed: boolean;
  historicalFailureCount: number;
  tentativeDrawerCount: number;
  unknownFailureCount: number;
  verifiedFixCount: number;
  m7iVerifiedFixCount: number;
  unresolvedCount: number;
  reproductionRuns: readonly Readonly<{
    id: string;
    sourceCommitSha: string;
    rawReportSha256: string;
    counts: Readonly<{ discovered: number; expected: number; unexpected: number; skipped: number; flaky: number }>;
    actualWorkers: number;
  }>[];
  issues: readonly string[];
}>;

/** Validates M7I's historical lineage, selected raw runs, and strictly matched fix claims. */
export const evaluateGroundGlassM7iBroadE2eRemediation = (
  reportValue: unknown,
  historicalTriageValue: unknown,
  historicalRawReportValue: unknown,
  historicalRawReportSha256: unknown,
  historicalTriageReportSha256: unknown,
  artifacts: GroundGlassM7iArtifacts,
): GroundGlassM7iEvaluation => {
  const issues: string[] = [];
  const report = isRecord(reportValue) ? reportValue : {};
  const historical = isRecord(historicalTriageValue) ? historicalTriageValue : {};
  if (report.reportId !== GROUND_GLASS_M7I_REPORT_ID) issues.push("report-id-mismatch");
  if (report.evaluatorRevision !== GROUND_GLASS_M7I_EVALUATOR_REVISION) issues.push("evaluator-revision-mismatch");
  if (report.baseCommitSha !== GROUND_GLASS_M7I_BASE_COMMIT_SHA) issues.push("base-commit-mismatch");
  if (!sha(report.candidateCommitSha)) issues.push("candidate-commit-missing-or-invalid");

  const historicalMeta = isRecord(report.historicalM7h) ? report.historicalM7h : {};
  if (historicalMeta.evaluatorRevision !== GROUND_GLASS_M7H_EVALUATOR_REVISION) {
    issues.push("historical-m7h-evaluator-mismatch");
  }
  if (historicalMeta.sourceCommitSha !== GROUND_GLASS_M7H_HISTORICAL_SOURCE_SHA) {
    issues.push("historical-source-commit-mismatch");
  }
  if (historicalMeta.rawReportSha256 !== GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256 ||
      historicalRawReportSha256 !== GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256) {
    issues.push("historical-raw-report-digest-mismatch");
  }
  if (historicalMeta.currentMainSha !== GROUND_GLASS_M7H_CURRENT_MAIN_SHA ||
      historicalMeta.m7hCleanBaselineSha !== GROUND_GLASS_M7H_CLEAN_BASELINE_SHA) {
    issues.push("historical-baseline-lineage-mismatch");
  }
  if (historical.reportId !== "ground-glass-m7h-broad-e2e-triage" ||
      historical.evaluatorRevision !== GROUND_GLASS_M7H_EVALUATOR_REVISION ||
      historical.historicalReportSha256 !== GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256 ||
      historical.historicalSourceCommitSha !== GROUND_GLASS_M7H_HISTORICAL_SOURCE_SHA) {
    issues.push("accepted-m7h-report-identity-mismatch");
  }
  if (historicalMeta.triageReportSha256 !== GROUND_GLASS_M7H_TRIAGE_REPORT_SHA256 ||
      historicalTriageReportSha256 !== GROUND_GLASS_M7H_TRIAGE_REPORT_SHA256) {
    issues.push("accepted-m7h-triage-report-digest-mismatch");
  }
  const historicalRaw = deriveGroundGlassM7hPlaywrightReportOutcomes(
    historicalRawReportValue,
    historicalRawReportSha256,
  );
  if (historicalRaw.counts.discovered !== 277 || historicalRaw.counts.expected !== 103 ||
      historicalRaw.counts.unexpected !== 99 || historicalRaw.counts.skipped !== 75 ||
      historicalRaw.counts.flaky !== 0 || historicalRaw.counts.incomplete !== 0 || historicalRaw.issues.length > 0) {
    issues.push("accepted-m7h-raw-inventory-invalid");
  }

  const sourceFailures = getHistoricalFailures(historicalTriageValue);
  const historicalIds = sourceFailures.map((entry) => string(entry.testId));
  const historicalDuplicates = historicalIds.filter((id, index) => historicalIds.indexOf(id) !== index);
  if (sourceFailures.length !== GROUND_GLASS_M7I_HISTORICAL_FAILURE_COUNT ||
      historicalIds.some((id) => !id) || historicalDuplicates.length > 0) {
    issues.push("historical-99-failure-inventory-invalid");
  }
  const declaredHistorical = array(isRecord(report.historicalDisposition)
    ? report.historicalDisposition.failureInventory
    : null).filter(isRecord);
  const projectHistorical = (entries: readonly JsonRecord[]) => entries.map((entry) => ({
    testId: string(entry.testId),
    historicalOutcome: string(entry.historicalOutcome),
    historicalErrorSignature: string(entry.historicalErrorSignature),
    cohortId: string(entry.cohortId),
    originClassification: string(entry.originClassification),
    causeClassification: string(entry.causeClassification),
    confidence: string(entry.confidence),
    remediationStatus: string(entry.remediationStatus),
  })).sort((a, b) => a.testId.localeCompare(b.testId));
  if (JSON.stringify(projectHistorical(declaredHistorical)) !== JSON.stringify(projectHistorical(sourceFailures))) {
    issues.push("historical-failure-disposition-drift");
  }

  const expectedTentative = sourceFailures
    .filter((entry) => entry.cohortId === "task-content-hidden-in-collapsed-learning-drawer" &&
      entry.confidence === "tentative")
    .map((entry) => string(entry.testId));
  const expectedUnknown = sourceFailures
    .filter((entry) => entry.causeClassification === "unknown")
    .map((entry) => string(entry.testId));
  const tentativeEntries = array(report.tentativeDrawerInventory).filter(isRecord);
  const unknownEntries = array(report.unknownFailureInventory).filter(isRecord);
  const tentativeIds = tentativeEntries.map((entry) => string(entry.testId));
  const unknownIds = unknownEntries.map((entry) => string(entry.testId));
  if (expectedTentative.length !== GROUND_GLASS_M7I_TENTATIVE_DRAWER_COUNT ||
      !sameStrings(tentativeIds, expectedTentative) || new Set(tentativeIds).size !== tentativeIds.length) {
    issues.push("tentative-drawer-inventory-mismatch");
  }
  if (expectedUnknown.length !== GROUND_GLASS_M7I_UNKNOWN_FAILURE_COUNT ||
      !sameStrings(unknownIds, expectedUnknown) || new Set(unknownIds).size !== unknownIds.length) {
    issues.push("unknown-failure-inventory-mismatch");
  }
  for (const entry of [...tentativeEntries, ...unknownEntries]) {
    const source = sourceFailures.find((failure) => failure.testId === entry.testId);
    if (!source || entry.historicalErrorSignature !== source.historicalErrorSignature) {
      issues.push("historical-signature-or-identity-mismatch");
      break;
    }
  }

  const runEntries = array(report.reproductionRuns).filter(isRecord);
  const runsById = new Map<string, JsonRecord>();
  const runOutcomes = new Map<string, ReturnType<typeof extractGroundGlassM7hPlaywrightTests>>();
  const runSummaries: Array<GroundGlassM7iEvaluation["reproductionRuns"][number]> = [];
  for (const run of runEntries) {
    const runId = string(run.id);
    if (!runId || runsById.has(runId)) {
      issues.push("reproduction-run-id-missing-or-duplicated");
      continue;
    }
    runsById.set(runId, run);
    const reportPath = string(run.reportPath);
    const rawSha = string(run.rawReportSha256);
    const artifact = artifacts[reportPath];
    if (!artifact || !sha256(rawSha) || artifact.sha256 !== rawSha) {
      issues.push(`raw-report-digest-mismatch:${runId}`);
      continue;
    }
    const outcomes = deriveGroundGlassM7hPlaywrightReportOutcomes(artifact.report, rawSha);
    const extracted = outcomes.tests;
    runOutcomes.set(runId, extracted);
    if (outcomes.issues.length > 0 || outcomes.counts.incomplete > 0 || outcomes.duplicateTestIds.length > 0) {
      issues.push(`raw-report-tree-invalid:${runId}`);
    }
    const artifactReport = isRecord(artifact.report) ? artifact.report : {};
    const rawStats = isRecord(artifactReport.stats) ? artifactReport.stats : {};
    for (const key of ["expected", "unexpected", "skipped", "flaky"] as const) {
      if (rawStats[key] !== outcomes.counts[key]) issues.push(`raw-report-stats-mismatch:${runId}:${key}`);
    }
    const config = isRecord(artifactReport.config) ? artifactReport.config : {};
    const metadata = isRecord(config.metadata) ? config.metadata : {};
    const actualWorkers = Number(metadata.actualWorkers ?? 0);
    const runWorkers = Number(run.workers ?? 0);
    const projects = array(config.projects).filter(isRecord);
    const projectIds = projects.map((project) => string(project.id ?? project.name));
    const argv = array(config.argv).filter((item): item is string => typeof item === "string");
    if (actualWorkers !== runWorkers || projectIds.length !== 1 || projectIds[0] !== "chromium" ||
        !argv.includes(`--workers=${runWorkers}`) || !argv.includes("--project=chromium")) {
      issues.push(`raw-report-configuration-mismatch:${runId}`);
    }
    const sourceSha = string(run.sourceCommitSha);
    if ((sourceSha === GROUND_GLASS_M7I_BASE_COMMIT_SHA && run.runKind !== "baseline") ||
        (sourceSha === report.candidateCommitSha && run.runKind !== "candidate") ||
        (!new Set([GROUND_GLASS_M7I_BASE_COMMIT_SHA, report.candidateCommitSha]).has(sourceSha))) {
      issues.push(`run-source-identity-mismatch:${runId}`);
    }
    const environment = isRecord(run.environment) ? run.environment : {};
    if (!string(environment.os) || !string(environment.architecture) || !string(environment.nodeVersion) ||
        !string(environment.playwrightVersion) || !string(environment.browserVersion) ||
        !string(environment.threeRevision) || !string(environment.viteFlags) || !string(environment.serverPort)) {
      issues.push(`run-environment-incomplete:${runId}`);
    }
    const expectedIds = readStringList(run.testIds);
    const actualIds = extracted.map((test) => test.testId);
    if (!sameStrings(expectedIds, actualIds) || expectedIds.length !== actualIds.length) {
      issues.push(`run-test-inventory-mismatch:${runId}`);
    }
    runSummaries.push({
      id: runId,
      sourceCommitSha: sourceSha,
      rawReportSha256: rawSha,
      counts: {
        discovered: outcomes.counts.discovered,
        expected: outcomes.counts.expected,
        unexpected: outcomes.counts.unexpected,
        skipped: outcomes.counts.skipped,
        flaky: outcomes.counts.flaky,
      },
      actualWorkers,
    });
  }

  for (const artifactEntry of array(report.supportingArtifacts).filter(isRecord)) {
    const path = string(artifactEntry.path);
    const expectedSha = string(artifactEntry.sha256);
    const artifact = artifacts[path];
    if (!path || !sha256(expectedSha) || !artifact || artifact.sha256 !== expectedSha) {
      issues.push(`supporting-artifact-digest-mismatch:${path || "missing-path"}`);
    }
  }

  const verifiedFixes = array(report.verifiedFixes).filter(isRecord);
  const inheritedFixedIds = sourceFailures
    .filter((entry) => entry.originClassification === "verified-fixed-on-head")
    .map((entry) => string(entry.testId));
  const inheritedFixEntries = verifiedFixes.filter((entry) => entry.evidenceKind === "m7h-inherited");
  const m7iFixEntries = verifiedFixes.filter((entry) => entry.evidenceKind === "m7i-matched");
  const inheritedFixIds = inheritedFixEntries.map((entry) => string(entry.testId));
  if (!sameStrings(inheritedFixIds, inheritedFixedIds) || new Set(inheritedFixIds).size !== inheritedFixIds.length) {
    issues.push("inherited-m7h-verified-fix-inventory-mismatch");
  }
  const m7iFixIds = m7iFixEntries.map((entry) => string(entry.testId));
  if (new Set(m7iFixIds).size !== m7iFixIds.length ||
      m7iFixIds.some((id) => !expectedUnknown.includes(id))) {
    issues.push("m7i-fix-identity-invalid-or-duplicated");
  }
  for (const fix of m7iFixEntries) {
    const testId = string(fix.testId);
    const baselineRunId = string(fix.baselineRunId);
    const candidateRunId = string(fix.candidateRunId);
    const baselineRun = getRun(runEntries, baselineRunId);
    const candidateRun = getRun(runEntries, candidateRunId);
    const baselineTests = runOutcomes.get(baselineRunId) ?? [];
    const candidateTests = runOutcomes.get(candidateRunId) ?? [];
    const baseline = getTest(baselineTests, testId);
    const candidate = getTest(candidateTests, testId);
    if (!baselineRun || !candidateRun || !baseline || !candidate ||
        baselineRun.runKind !== "baseline" || candidateRun.runKind !== "candidate" ||
        baselineRun.sourceCommitSha !== GROUND_GLASS_M7I_BASE_COMMIT_SHA ||
        candidateRun.sourceCommitSha !== report.candidateCommitSha ||
        Number(baselineRun.workers) !== Number(candidateRun.workers) ||
        withoutServerPort(baselineRun.environment) !== withoutServerPort(candidateRun.environment) ||
        !isGroundGlassM7hBaselineFailure(baseline) || !isGroundGlassM7hActualPass(candidate)) {
      issues.push(`m7i-fix-lacks-matched-deterministic-evidence:${testId}`);
    }
  }

  const expectedExistingIds = sourceFailures
    .filter((entry) => entry.originClassification === "verified-existing-on-base")
    .map((entry) => string(entry.testId));
  const existingIds = array(report.verifiedExisting).filter(isRecord).map((entry) => string(entry.testId));
  if (!sameStrings(existingIds, expectedExistingIds)) issues.push("verified-existing-inventory-mismatch");
  const expectedPartialIds = sourceFailures
    .filter((entry) => entry.remediationStatus === "partially-addressed")
    .map((entry) => string(entry.testId));
  const partialEntries = array(report.partiallyAddressed).filter(isRecord);
  const partialIds = partialEntries.map((entry) => string(entry.testId));
  if (!sameStrings(partialIds, expectedPartialIds)) issues.push("partially-addressed-inventory-mismatch");

  const introduced = array(report.verifiedIntroduced).filter(isRecord);
  for (const entry of introduced) {
    const testId = string(entry.testId);
    const baseline = getTest(runOutcomes.get(string(entry.baselineRunId)) ?? [], testId);
    const candidate = getTest(runOutcomes.get(string(entry.candidateRunId)) ?? [], testId);
    if (!baseline || !candidate || !isGroundGlassM7hActualPass(baseline) ||
        !isGroundGlassM7hBaselineFailure(candidate)) {
      issues.push(`introduced-failure-lacks-matched-evidence:${testId}`);
    }
  }

  const expectedUnresolved = [
    ...expectedTentative,
    ...expectedUnknown.filter((id) => !m7iFixIds.includes(id)),
  ];
  const unresolvedIds = readStringList(report.unresolved);
  if (!sameStrings(unresolvedIds, expectedUnresolved) || new Set(unresolvedIds).size !== unresolvedIds.length) {
    issues.push("unresolved-inventory-mismatch");
  }

  const drawerRunId = string(isRecord(report.drawerVerification) ? report.drawerVerification.runId : null);
  const drawerTests = runOutcomes.get(drawerRunId) ?? [];
  const drawerIds = tentativeEntries.map((entry) => string(entry.testId));
  if (drawerIds.some((id) => {
    const outcome = getTest(drawerTests, id);
    return !outcome || !isGroundGlassM7hActualPass(outcome) ||
      array(outcome.attemptStatuses).length !== 1;
  })) issues.push("tentative-drawer-case-not-fully-passed");
  const compoundId = string(isRecord(report.compoundTask) ? report.compoundTask.testId : null);
  const compound = getTest(drawerTests, compoundId);
  if (!compoundId || !compound || !isGroundGlassM7hActualPass(compound)) {
    issues.push("compound-task-full-run-not-passed");
  }
  const compoundCandidateRunId = string(isRecord(report.compoundTask)
    ? report.compoundTask.candidateRunId
    : null);
  const compoundCandidateRun = getRun(runEntries, compoundCandidateRunId);
  const compoundCandidate = getTest(runOutcomes.get(compoundCandidateRunId) ?? [], compoundId);
  if (!compoundCandidateRun || compoundCandidateRun.runKind !== "candidate" ||
      compoundCandidateRun.sourceCommitSha !== report.candidateCommitSha ||
      Number(compoundCandidateRun.workers) !== Number(getRun(runEntries, drawerRunId)?.workers) ||
      withoutServerPort(compoundCandidateRun.environment) !== withoutServerPort(getRun(runEntries, drawerRunId)?.environment) ||
      !compoundCandidate || !isGroundGlassM7hActualPass(compoundCandidate)) {
    issues.push("compound-task-candidate-run-not-passed-or-matched");
  }
  if (isRecord(report.compoundTask) && report.compoundTask.comparisonOutcome !== "not-reproduced") {
    issues.push("compound-task-comparison-outcome-invalid");
  }

  const discovery = isRecord(report.currentDiscovery) ? report.currentDiscovery : {};
  const discoveryArtifact = artifacts[string(discovery.artifactPath)];
  const discoveryRecord = isRecord(discoveryArtifact?.report) ? discoveryArtifact?.report : {};
  const discoveryOutputArtifact = artifacts[string(discoveryRecord.sourceOutputPath)];
  if (discovery.discoveredTests !== 278 || discovery.specFiles !== 80 ||
      !string(discovery.artifactPath) || !sha256(discovery.artifactSha256) ||
      !string(discovery.command) || !discoveryArtifact ||
      discoveryArtifact.sha256 !== discovery.artifactSha256 ||
      discoveryRecord.command !== discovery.command ||
      discoveryRecord.discoveredTests !== discovery.discoveredTests ||
      discoveryRecord.specFiles !== discovery.specFiles ||
      !sha256(discoveryRecord.sourceOutputSha256) || !discoveryOutputArtifact ||
      discoveryOutputArtifact.sha256 !== discoveryRecord.sourceOutputSha256 ||
      !string(discoveryOutputArtifact.report).includes("Total: 278 tests in 80 files")) {
    issues.push("current-discovery-inventory-invalid");
  }
  const validation = isRecord(report.validation) ? report.validation : {};
  const testValidation = isRecord(validation.unitIntegrationTests) ? validation.unitIntegrationTests : {};
  if (testValidation.passed !== true || testValidation.files !== 315 || testValidation.tests !== 3585) {
    issues.push("unit-integration-validation-missing-or-inconsistent");
  }
  const mutationValidation = isRecord(validation.m7iEvaluatorMutationTests)
    ? validation.m7iEvaluatorMutationTests
    : {};
  if (mutationValidation.passed !== true || mutationValidation.tests !== 27) {
    issues.push("m7i-mutation-tests-missing-or-inconsistent");
  }
  for (const key of ["typecheck", "lint", "css", "build", "m7hEvidence", "m7iEvidence"] as const) {
    if (validation[key] !== "passed") issues.push(`validation-check-not-passed:${key}`);
  }
  const m7f = isRecord(validation.m7fReplay) ? validation.m7fReplay : {};
  if (m7f.passed !== true || m7f.passedScenarios !== 17) issues.push("m7f-replay-validation-invalid");
  const m7g = isRecord(validation.m7gReport) ? validation.m7gReport : {};
  if (m7g.evidenceIntegrity !== "passed" || m7g.passedScenarios !== 5 ||
      m7g.blockedScenarios !== 2 || m7g.m8Entry !== "denied" ||
      m7g.productionWebGpuEnabled !== false) issues.push("m7g-validation-invalid");
  const validateE2eRawReport = (
    run: JsonRecord,
    expectedProject: string,
    expectedCount: number,
    id: string,
  ): void => {
    const path = string(run.rawReportPath);
    const expectedSha = string(run.rawReportSha256);
    const artifact = artifacts[path];
    if (!artifact || !sha256(expectedSha) || artifact.sha256 !== expectedSha) {
      issues.push(`validation-e2e-report-digest-mismatch:${id}`);
      return;
    }
    const outcomes = deriveGroundGlassM7hPlaywrightReportOutcomes(artifact.report, expectedSha);
    const raw = isRecord(artifact.report) ? artifact.report : {};
    const config = isRecord(raw.config) ? raw.config : {};
    const projects = array(config.projects).filter(isRecord);
    const projectIds = projects.map((project) => string(project.id ?? project.name));
    const allActualPass = outcomes.tests.length === expectedCount &&
      outcomes.tests.every(isGroundGlassM7hActualPass);
    if (outcomes.counts.discovered !== expectedCount || outcomes.counts.expected !== expectedCount ||
        outcomes.counts.unexpected !== 0 || outcomes.counts.skipped !== 0 || outcomes.counts.flaky !== 0 ||
        outcomes.counts.incomplete !== 0 || outcomes.issues.length > 0 || !allActualPass ||
        projectIds.length !== 1 || projectIds[0] !== expectedProject ||
        Number(isRecord(config.metadata) ? config.metadata.actualWorkers : 0) !== 1) {
      issues.push(`validation-e2e-report-invalid:${id}`);
    }
  };
  const smokeValidation = isRecord(validation.ordinaryChromiumSmoke)
    ? validation.ordinaryChromiumSmoke
    : {};
  validateE2eRawReport(smokeValidation, "chromium", 2, "ordinary-chromium-smoke");
  const productionValidation = isRecord(validation.productionPreviewIsolation)
    ? validation.productionPreviewIsolation
    : {};
  validateE2eRawReport(productionValidation, "chromium-production-preview", 4, "production-preview-isolation");
  if (validation.fullBroadE2eRun !== "not-run") issues.push("full-broad-e2e-run-status-missing-or-invalid");

  const broadDecision = isRecord(report.broadRunDecision) ? report.broadRunDecision : {};
  if (broadDecision.status === "not-ready") {
    if (report.broadRunResult !== null || report.broadE2eQualification !== "not-qualified" ||
        array(broadDecision.blockers).length === 0) issues.push("broad-not-ready-decision-inconsistent");
  } else if (broadDecision.status === "executed") {
    const broadRun = getRun(runEntries, string(isRecord(report.broadRunResult)
      ? report.broadRunResult.runId
      : null));
    const rawCount = broadRun ? runOutcomes.get(string(broadRun.id))?.length ?? 0 : 0;
    if (!broadRun || rawCount !== discovery.discoveredTests) issues.push("partial-run-labeled-as-broad");
  } else {
    issues.push("broad-run-decision-missing-or-invalid");
  }

  const authorization = isRecord(report.productionAuthorization) ? report.productionAuthorization : {};
  if (report.m7Qualification !== "partially-qualified" || report.m8Entry !== "denied" ||
      authorization.productionGroundGlass !== "WebGL-only" || authorization.productionWebGpuEnabled !== false ||
      authorization.spontaneousExternalDeviceLoss !== "blocked" || authorization.m5qQuality !== "partially-qualified") {
    issues.push("authorization-boundary-changed");
  }

  return {
    reportId: GROUND_GLASS_M7I_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7I_EVALUATOR_REVISION,
    passed: issues.length === 0,
    historicalFailureCount: sourceFailures.length,
    tentativeDrawerCount: tentativeIds.length,
    unknownFailureCount: unknownIds.length,
    verifiedFixCount: inheritedFixIds.length + m7iFixIds.length,
    m7iVerifiedFixCount: m7iFixIds.length,
    unresolvedCount: unresolvedIds.length,
    reproductionRuns: runSummaries,
    issues: [...new Set(issues)],
  };
};
