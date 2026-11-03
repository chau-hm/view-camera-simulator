import {
  deriveGroundGlassM7hPlaywrightReportOutcomes,
  type GroundGlassM7hPlaywrightReportOutcomes,
} from "./groundGlassM7hBroadE2eTriage";
import {
  GROUND_GLASS_M7I_EVALUATOR_REVISION,
  GROUND_GLASS_M7I_REPORT_ID,
} from "./groundGlassM7iBroadE2eRemediation";

export const GROUND_GLASS_M7J_REPORT_ID = "ground-glass-m7j-four-worker-stability" as const;
export const GROUND_GLASS_M7J_EVALUATOR_REVISION = "m7j-four-worker-stability-evaluator-v1" as const;
export const GROUND_GLASS_M7J_MUTATION_SUITE_REVISION = "m7j-evidence-mutations-v1" as const;
export const GROUND_GLASS_M7J_MUTATION_TEST_COUNT = 22 as const;
export const GROUND_GLASS_M7J_BASE_COMMIT_SHA = "b917ad46f99d8de339adbd028f0ae57c4922df1f" as const;
export const GROUND_GLASS_M7J_CANDIDATE_COMMIT_SHA = "17a2616b151aa50ad34b2d137eee0a43c5759ad3" as const;
export const GROUND_GLASS_M7J_M7I_REPORT_SHA256 = "486f1c7ac010cd4d4fbede55fdb669f448c26adfaaee6de5717814ddff9bccde" as const;
export const GROUND_GLASS_M7J_REQUIRED_RENDERER_TESTS = [
  "camera-controls-compact.spec.ts::camera control rows keep useful rendered tracks across rail widths",
  "fringe-club-dev-integration.spec.ts::Stage 2N-A Observer and RTT instances survive independent sibling removal",
  "scene-view-focus.spec.ts::View Focus preserves independent Scene and Camera views and resets the active preset",
  "table-tilt.spec.ts::Table Tilt RTT survives focus, preview, zoom, quality, and tilt resource stress",
] as const;
export const GROUND_GLASS_M7J_REQUIRED_EXPERIMENT_IDS = [
  "baseline-j1-isolated-w1",
  "baseline-j1-isolated-w4-config",
  "baseline-j2-isolated-w1",
  "baseline-j2-isolated-w4-config",
  "baseline-j3-isolated-w1",
  "baseline-j3-isolated-w4-config",
  "baseline-cohort5-w1",
  "baseline-cohort5-w2",
  "baseline-cohort5-w4",
  "probe-three-targets-w4",
  "probe-cohort5-w4",
  "experiment-j2-light-page-w2",
  "experiment-j2-renderer-page-w2",
  "experiment-j2-renderer-headed-w2",
  "candidate-renderer-serial",
] as const;
export const GROUND_GLASS_M7J_REQUIRED_MUTATION_CASES = [
  "cli-rejects-invalid-evidence",
  "missing-required-experiment-record",
  "one-worker-run-relabeled-as-four",
  "worker-metadata-contradiction",
  "failed-test-relabeled-as-passed",
  "expected-failure-counted-as-passed",
  "skipped-test-counted-as-passed",
  "retry-dependent-pass-called-deterministic",
  "partial-cohort-called-complete",
  "missing-raw-artifact",
  "altered-raw-artifact-digest",
  "candidate-attributed-to-baseline",
  "incompatible-browser-revision",
  "changed-viewport-hidden",
  "unmeasured-gpu-metric",
  "correlation-overclaimed-as-verified-cause",
  "historical-backlog-identity-omitted",
  "false-broad-qualification",
  "false-m8-authorization",
  "production-webgpu-activation",
  "positive-partial-diagnostic-evidence",
] as const;

type JsonRecord = Record<string, unknown>;
export type GroundGlassM7jArtifact = Readonly<{ sha256: string; value: unknown }>;
export type GroundGlassM7jArtifacts = Readonly<Record<string, GroundGlassM7jArtifact>>;
export type GroundGlassM7jCommitAvailability = Readonly<Record<string, boolean>>;

export type GroundGlassM7jEvaluation = Readonly<{
  reportId: string;
  evaluatorRevision: string;
  passed: boolean;
  evidenceIntegrity: "passed" | "failed";
  experimentRecordIntegrity: "passed" | "failed";
  comparability: "passed" | "failed";
  rawOutcomes: "passed" | "failed";
  hypothesisSupport: "passed" | "failed";
  readinessDecision: "ready-for-controlled-broad-run" | "not-ready" | "environment-limited";
  fourWorkerStability: "unstable" | "stable" | "unresolved";
  fullBroadE2eQualification: "not-qualified";
  counts: Readonly<{ experiments: number; rawTests: number; discoveredTests: number; unresolvedHistoricalIdentities: number }>;
  issues: readonly string[];
}>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown): string => typeof value === "string" ? value : "";
const sha = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
const sha256 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const basename = (value: string): string => value.replaceAll("\\", "/").split("/").pop() ?? value;
const identityOf = (file: string, title: string): string => `${basename(file)}::${title}`;
const sorted = (items: readonly string[]): string[] => [...items].sort();
const sameStrings = (left: readonly string[], right: readonly string[]): boolean =>
  JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));

const reportProject = (report: unknown, projectName: string): JsonRecord | null => {
  if (!isRecord(report) || !isRecord(report.config)) return null;
  return asArray(report.config.projects).find((project) =>
    isRecord(project) && project.name === projectName) as JsonRecord | undefined ?? null;
};

const readRawProbe = (report: unknown, expectedIdentity: string): JsonRecord | null => {
  const root = isRecord(report) ? report : {};
  const walk = (suiteValue: unknown): JsonRecord | null => {
    if (!isRecord(suiteValue)) return null;
    const suiteFile = asString(suiteValue.file);
    for (const specValue of asArray(suiteValue.specs)) {
      if (!isRecord(specValue)) continue;
      const file = asString(specValue.file) || suiteFile;
      const title = asString(specValue.title);
      if (identityOf(file, title) !== expectedIdentity) continue;
      for (const testValue of asArray(specValue.tests)) {
        if (!isRecord(testValue)) continue;
        for (const resultValue of asArray(testValue.results)) {
          if (!isRecord(resultValue)) continue;
          for (const attachmentValue of asArray(resultValue.attachments)) {
            if (!isRecord(attachmentValue) || attachmentValue.name !== "m7j-stall-probe.json" ||
                typeof attachmentValue.body !== "string") continue;
            try {
              const parsed: unknown = JSON.parse(Buffer.from(attachmentValue.body, "base64").toString("utf8"));
              if (isRecord(parsed)) return parsed;
            } catch {
              return null;
            }
          }
        }
      }
    }
    for (const nested of asArray(suiteValue.suites)) {
      const result = walk(nested);
      if (result) return result;
    }
    return null;
  };
  for (const suite of asArray(root.suites)) {
    const result = walk(suite);
    if (result) return result;
  }
  return null;
};

const toOutcomeClaims = (value: unknown): Map<string, JsonRecord> => {
  const claims = new Map<string, JsonRecord>();
  for (const entry of asArray(value)) {
    if (!isRecord(entry)) continue;
    const identity = asString(entry.identity);
    if (identity) claims.set(identity, entry);
  }
  return claims;
};

/** Validates M7J diagnostic provenance and keeps evidence integrity separate from suite qualification. */
export const evaluateGroundGlassM7jFourWorkerStability = (
  reportValue: unknown,
  historicalM7iValue: unknown,
  historicalM7iReportSha256: unknown,
  artifacts: GroundGlassM7jArtifacts,
  knownCommits: GroundGlassM7jCommitAvailability,
): GroundGlassM7jEvaluation => {
  const issues: string[] = [];
  const report = isRecord(reportValue) ? reportValue : {};
  const historical = isRecord(historicalM7iValue) ? historicalM7iValue : {};
  if (report.reportId !== GROUND_GLASS_M7J_REPORT_ID) issues.push("report-id-mismatch");
  if (report.evaluatorRevision !== GROUND_GLASS_M7J_EVALUATOR_REVISION) issues.push("evaluator-revision-mismatch");
  if (report.baseCommitSha !== GROUND_GLASS_M7J_BASE_COMMIT_SHA ||
      report.pr307MergeCommitSha !== GROUND_GLASS_M7J_BASE_COMMIT_SHA) issues.push("accepted-base-identity-mismatch");
  if (report.candidateCommitSha !== GROUND_GLASS_M7J_CANDIDATE_COMMIT_SHA || !sha(report.candidateCommitSha)) {
    issues.push("candidate-source-identity-mismatch");
  }
  for (const commitSha of [GROUND_GLASS_M7J_BASE_COMMIT_SHA, GROUND_GLASS_M7J_CANDIDATE_COMMIT_SHA]) {
    if (knownCommits[commitSha] !== true) issues.push(`source-commit-missing:${commitSha}`);
  }

  const history = isRecord(report.historicalM7i) ? report.historicalM7i : {};
  if (historical.reportId !== GROUND_GLASS_M7I_REPORT_ID ||
      historical.evaluatorRevision !== GROUND_GLASS_M7I_EVALUATOR_REVISION ||
      historicalM7iReportSha256 !== GROUND_GLASS_M7J_M7I_REPORT_SHA256 ||
      history.reportSha256 !== GROUND_GLASS_M7J_M7I_REPORT_SHA256) {
    issues.push("accepted-m7i-report-identity-or-digest-mismatch");
  }
  const historicalIds = asArray(historical.unresolved).filter((entry): entry is string => typeof entry === "string");
  const declaredHistoricalIds = asArray(history.unresolvedTestIds).filter((entry): entry is string => typeof entry === "string");
  if (historicalIds.length !== 80 || new Set(historicalIds).size !== 80 ||
      !sameStrings(historicalIds, declaredHistoricalIds)) issues.push("historical-unresolved-identities-drift");
  const historicalTentative = asArray(historical.tentativeDrawerInventory).filter(isRecord)
    .map((entry) => asString(entry.testId));
  const historicalUnknown = asArray(historical.unknownFailureInventory).filter(isRecord)
    .map((entry) => asString(entry.testId));
  const historicalPartial = asArray(historical.partiallyAddressed).filter(isRecord)
    .map((entry) => asString(entry.testId));
  const verifiedFixes = asArray(historical.verifiedFixes).filter(isRecord);
  const inheritedFixes = verifiedFixes.filter((entry) => entry.evidenceKind === "m7h-inherited").map((entry) => asString(entry.testId));
  const newM7iFixes = verifiedFixes.filter((entry) => entry.evidenceKind === "m7i-matched").map((entry) => asString(entry.testId));
  if (historical.historicalFailureCount !== 99 || verifiedFixes.length !== 18 || inheritedFixes.length !== 16 ||
      newM7iFixes.length !== 2 || historicalTentative.length !== 15 ||
      historicalUnknown.length !== 67 || historicalPartial.length !== 1 ||
      historical.broadE2eQualification !== "not-qualified" || historical.m7Qualification !== "partially-qualified" ||
      historical.m8Entry !== "denied" || !isRecord(historical.productionAuthorization) ||
      historical.productionAuthorization.productionGroundGlass !== "WebGL-only" ||
      historical.productionAuthorization.productionWebGpuEnabled !== false ||
      historical.productionAuthorization.spontaneousExternalDeviceLoss !== "blocked" ||
      !sameStrings(historicalTentative, asArray(history.tentativeDrawerTestIds).filter((entry): entry is string => typeof entry === "string")) ||
      !sameStrings(historicalUnknown, asArray(history.originalUnknownTestIds).filter((entry): entry is string => typeof entry === "string")) ||
      !sameStrings(historicalPartial, asArray(history.partiallyAddressedTestIds).filter((entry): entry is string => typeof entry === "string")) ||
      !sameStrings(newM7iFixes, asArray(history.m7iVerifiedFixTestIds).filter((entry): entry is string => typeof entry === "string"))) {
    issues.push("m7i-inventory-or-authorization-boundary-drift");
  }
  const historicalM7h = isRecord(historical.historicalM7h) ? historical.historicalM7h : {};
  if (historicalM7h.discoveredTests !== 277 || historicalM7h.expected !== 103 ||
      historicalM7h.unexpected !== 99 || historicalM7h.skipped !== 75 || historicalM7h.flaky !== 0) {
    issues.push("m7h-historical-outcome-counts-drift");
  }
  const historicalValidation = isRecord(historical.validation) ? historical.validation : {};
  const acceptedControls = isRecord(report.acceptedM7iValidationControls) ? report.acceptedM7iValidationControls : {};
  for (const key of ["ordinaryChromiumSmoke", "productionPreviewIsolation"] as const) {
    const sourceControl = isRecord(historicalValidation[key]) ? historicalValidation[key] : {};
    const recordedControl = isRecord(acceptedControls[key]) ? acceptedControls[key] : {};
    if (sourceControl.rawReportPath !== recordedControl.rawReportPath ||
        sourceControl.rawReportSha256 !== recordedControl.rawReportSha256 ||
        sourceControl.sourceCommitSha !== recordedControl.sourceCommitSha) {
      issues.push(`accepted-m7i-validation-control-drift:${key}`);
    }
  }
  if (historicalValidation.m7hEvidence !== "passed" || historicalValidation.m7iEvidence !== "passed") {
    issues.push("accepted-m7i-evidence-validation-not-passed");
  }
  if (report.historicalM7iCounts && isRecord(report.historicalM7iCounts)) {
    const counts = report.historicalM7iCounts;
    if (counts.historicalTests !== 277 || counts.historicalUnexpected !== 99 || counts.verifiedFixes !== 18 ||
        counts.m7iVerifiedFixes !== 2 || counts.tentativeDrawer !== 15 || counts.unknown !== 67 ||
        counts.unresolved !== 80) issues.push("historical-m7i-counts-drift");
  } else {
    issues.push("historical-m7i-counts-missing");
  }

  const environment = isRecord(report.environment) ? report.environment : {};
  if (environment.os !== "macOS 27.0.1 (26A434)" || environment.architecture !== "arm64" ||
      environment.nodeVersion !== "24.3.0" || environment.npmVersion !== "11.12.0" ||
      environment.playwrightVersion !== "1.61.1" || environment.browserVersion !== "149.0.7827.55" ||
      environment.threeRevision !== "0.187.0") issues.push("runtime-fingerprint-incomplete-or-incompatible");
  const viewport = isRecord(environment.viewport) ? environment.viewport : {};
  if (viewport.width !== 1280 || viewport.height !== 720) issues.push("controlled-viewport-mismatch");
  const metrics = isRecord(environment.processMetrics) ? environment.processMetrics : {};
  if (metrics.cpuUtilization !== null || metrics.gpuUtilization !== null ||
      metrics.availability !== "unavailable") issues.push("unmeasured-host-metric-claimed");

  const runValues = asArray(report.experiments).filter(isRecord);
  const runById = new Map<string, JsonRecord>();
  const outcomesByRun = new Map<string, GroundGlassM7hPlaywrightReportOutcomes>();
  let rawTestCount = 0;
  for (const run of runValues) {
    const runId = asString(run.id);
    if (!runId || runById.has(runId)) {
      issues.push("experiment-id-missing-or-duplicated");
      continue;
    }
    runById.set(runId, run);
    const sourceCommitSha = asString(run.sourceCommitSha);
    const role = asString(run.sourceRole);
    const expectedSourceSha = role === "baseline" ? GROUND_GLASS_M7J_BASE_COMMIT_SHA
      : role === "candidate" ? GROUND_GLASS_M7J_CANDIDATE_COMMIT_SHA : "";
    if (!expectedSourceSha || sourceCommitSha !== expectedSourceSha || !sha(sourceCommitSha)) {
      issues.push(`experiment-source-attribution-invalid:${runId}`);
    }
    const reportPath = asString(run.rawReportPath);
    const expectedDigest = asString(run.rawReportSha256);
    const artifact = artifacts[reportPath];
    if (!artifact || !sha256(expectedDigest) || artifact.sha256 !== expectedDigest) {
      issues.push(`raw-artifact-missing-or-digest-mismatch:${runId}`);
      continue;
    }
    const raw = artifact.value;
    const derived = deriveGroundGlassM7hPlaywrightReportOutcomes(raw, expectedDigest);
    outcomesByRun.set(runId, derived);
    rawTestCount += derived.counts.discovered;
    if (derived.issues.length > 0 || derived.counts.incomplete > 0) {
      issues.push(`raw-results-incomplete-or-malformed:${runId}`);
    }
    const config = isRecord(raw) && isRecord(raw.config) ? raw.config : {};
    const configuredWorkers = asNumber(config.workers);
    const actualWorkers = isRecord(config.metadata) ? asNumber(config.metadata.actualWorkers) : null;
    const declaredConfig = isRecord(run.execution) ? run.execution : {};
    const declaredProject = asString(declaredConfig.projectName);
    const project = reportProject(raw, declaredProject);
    const projectActualWorkers = project && isRecord(project.metadata)
      ? asNumber(project.metadata.actualWorkers)
      : null;
    const projectRetries = project ? asNumber(project.retries) : null;
    if (configuredWorkers === null || actualWorkers === null || projectActualWorkers === null ||
        declaredConfig.configuredWorkers !== configuredWorkers || declaredConfig.actualWorkers !== actualWorkers ||
        projectActualWorkers !== actualWorkers || projectRetries !== 0 ||
        declaredConfig.configuredRetries !== projectRetries) {
      issues.push(`worker-configuration-or-actual-count-mismatch:${runId}`);
    }
    const testProjects = new Set(derived.tests.map((test) => test.projectName));
    if (testProjects.size !== 1 || !testProjects.has(declaredProject)) {
      issues.push(`execution-project-mismatch:${runId}`);
    }
    const runEnvironment = isRecord(run.environment) ? run.environment : {};
    const runViewport = isRecord(runEnvironment.viewport) ? runEnvironment.viewport : {};
    if (runEnvironment.os !== environment.os || runEnvironment.architecture !== environment.architecture ||
        runEnvironment.nodeVersion !== environment.nodeVersion ||
        runEnvironment.playwrightVersion !== environment.playwrightVersion ||
        runEnvironment.browserVersion !== environment.browserVersion ||
        runEnvironment.threeRevision !== environment.threeRevision ||
        runEnvironment.browserMode !== "headless" && runEnvironment.browserMode !== "headed" ||
        declaredConfig.headless !== (runEnvironment.browserMode === "headless") ||
        runViewport.width !== viewport.width || runViewport.height !== viewport.height) {
      issues.push(`experiment-environment-not-comparable:${runId}`);
    }
    if (runEnvironment.playwrightVersion !== asString(config.version)) {
      issues.push(`playwright-version-does-not-match-raw-report:${runId}`);
    }
    const observedPages = run.observedConcurrentPages;
    if (observedPages !== null && (asNumber(observedPages) === null || (observedPages as number) < 1 ||
        actualWorkers === null || (observedPages as number) > actualWorkers)) {
      issues.push(`observed-page-count-invalid:${runId}`);
    }

    const actualIdentities = derived.tests.map((test) => identityOf(test.specFile, test.testTitle));
    const expectedIdentities = asArray(run.expectedTestIdentities)
      .filter((entry): entry is string => typeof entry === "string");
    const claims = toOutcomeClaims(run.testOutcomes);
    const claimedCounts = isRecord(run.outcomeCounts) ? run.outcomeCounts : {};
    if (!sameStrings(actualIdentities, expectedIdentities) ||
        new Set(expectedIdentities).size !== expectedIdentities.length ||
        run.inventoryComplete !== true || claims.size !== derived.tests.length ||
        claimedCounts.discovered !== derived.counts.discovered ||
        claimedCounts.expected !== derived.counts.expected ||
        claimedCounts.unexpected !== derived.counts.unexpected ||
        claimedCounts.skipped !== derived.counts.skipped || claimedCounts.flaky !== derived.counts.flaky ||
        claimedCounts.incomplete !== derived.counts.incomplete) {
      issues.push(`experiment-test-inventory-incomplete-or-mismatched:${runId}`);
    }
    for (const test of derived.tests) {
      const identity = identityOf(test.specFile, test.testTitle);
      const claim = claims.get(identity);
      if (!claim || claim.expectedStatus !== test.expectedStatus || claim.actualStatus !== test.actualStatus ||
          claim.resultStatus !== test.resultStatus || claim.retryCount !== test.retryCount ||
          claim.actualPass !== test.actualPass || isGroundGlassM7jPassClaimIncorrect(claim, test)) {
        issues.push(`test-outcome-claim-mismatch:${runId}:${identity}`);
      }
    }

    const instrumentation = asString(run.instrumentation);
    if (instrumentation === "m7j-stall-probe-perturbing") {
      const probedIdentities = asArray(run.probeTestIdentities)
        .filter((entry): entry is string => typeof entry === "string");
      if (probedIdentities.length === 0 || probedIdentities.some((identity) => !actualIdentities.includes(identity))) {
        issues.push(`diagnostic-probe-identity-inventory-invalid:${runId}`);
      }
      for (const identity of probedIdentities) {
        const probe = readRawProbe(raw, identity);
        if (!probe || probe.probePerturbsAnimationScheduling !== true ||
            probe.hostProcessCpuAndGpuMetrics !== "unavailable") {
          issues.push(`diagnostic-probe-provenance-invalid:${runId}:${identity}`);
          break;
        }
      }
    } else if (instrumentation !== "none") {
      issues.push(`unknown-instrumentation-classification:${runId}`);
    }
  }
  for (const runId of GROUND_GLASS_M7J_REQUIRED_EXPERIMENT_IDS) {
    if (!runById.has(runId)) issues.push(`required-experiment-record-missing:${runId}`);
  }

  const discovery = isRecord(report.currentDiscovery) ? report.currentDiscovery : {};
  const discoveryArtifact = artifacts[asString(discovery.outputPath)];
  const projectDiscovery = artifacts[asString(discovery.rendererProjectOutputPath)];
  if (!discoveryArtifact || discoveryArtifact.sha256 !== discovery.outputSha256 ||
      typeof discoveryArtifact.value !== "string" || !projectDiscovery ||
      projectDiscovery.sha256 !== discovery.rendererProjectOutputSha256 || typeof projectDiscovery.value !== "string") {
    issues.push("controlled-discovery-artifact-missing-or-digest-mismatch");
  } else {
    const allLines = discoveryArtifact.value.split(/\r?\n/);
    const projectLines = allLines.filter((line) => /^\s+\[(chromium|chromium-renderer-serial)\]\s+›/.test(line));
    const ordinaryCount = projectLines.filter((line) => line.includes("[chromium] ›")).length;
    const serialCount = projectLines.filter((line) => line.includes("[chromium-renderer-serial] ›")).length;
    const listedTotal = Number(discoveryArtifact.value.match(/Total:\s+(\d+)\s+tests\s+in\s+(\d+)\s+files/)?.[1] ?? NaN);
    const listedFiles = Number(discoveryArtifact.value.match(/Total:\s+(\d+)\s+tests\s+in\s+(\d+)\s+files/)?.[2] ?? NaN);
    const serialTotal = Number(projectDiscovery.value.match(/Total:\s+(\d+)\s+tests\s+in\s+(\d+)\s+files/)?.[1] ?? NaN);
    if (discovery.discoveredTests !== 278 || discovery.specFiles !== 80 || listedTotal !== 278 ||
        listedFiles !== 80 || ordinaryCount !== 274 || serialCount !== 4 || serialTotal !== 4 ||
        discovery.ordinaryProjectTests !== 274 || discovery.rendererSerialProjectTests !== 4) {
      issues.push("controlled-discovery-inventory-mismatch");
    }
  }

  const validationRecord = isRecord(report.validation) ? report.validation : {};
  const browserControls = asArray(validationRecord.browserControls).filter(isRecord);
  for (const expected of [
    { id: "ordinary-chromium-smoke", project: "chromium", count: 2 },
    { id: "production-preview-isolation", project: "chromium-production-preview", count: 4 },
  ]) {
    const control = browserControls.find((entry) => entry.id === expected.id);
    if (!control || control.sourceCommitSha !== GROUND_GLASS_M7J_CANDIDATE_COMMIT_SHA ||
        control.projectName !== expected.project || control.expectedTests !== expected.count ||
        control.expectedPasses !== expected.count || control.configuredWorkers !== 1 ||
        control.actualWorkers !== 1 || control.retries !== 0 || control.skipped !== 0) {
      issues.push(`browser-validation-control-record-invalid:${expected.id}`);
      continue;
    }
    const reportPath = asString(control.rawReportPath);
    const reportDigest = asString(control.rawReportSha256);
    const artifact = artifacts[reportPath];
    if (!artifact || artifact.sha256 !== reportDigest || !sha256(reportDigest)) {
      issues.push(`browser-validation-control-artifact-invalid:${expected.id}`);
      continue;
    }
    const outcomes = deriveGroundGlassM7hPlaywrightReportOutcomes(artifact.value, reportDigest);
    const config = isRecord(artifact.value) && isRecord(artifact.value.config) ? artifact.value.config : {};
    const project = reportProject(artifact.value, expected.project);
    const projectActualWorkers = project && isRecord(project.metadata)
      ? asNumber(project.metadata.actualWorkers)
      : null;
    if (outcomes.issues.length > 0 || outcomes.counts.discovered !== expected.count ||
        outcomes.tests.some((test) => !test.actualPass)) {
      issues.push(`browser-validation-control-results-invalid:${expected.id}:raw-outcomes`);
    }
    if (config.workers !== 1 || !isRecord(config.metadata) || config.metadata.actualWorkers !== 1 ||
        projectActualWorkers !== 1 || project?.retries !== 0) {
      issues.push(`browser-validation-control-results-invalid:${expected.id}:worker-policy`);
    }
    if (!project || new Set(outcomes.tests.map((test) => test.projectName)).size !== 1 ||
        !outcomes.tests.every((test) => test.projectName === expected.project)) {
      issues.push(`browser-validation-control-results-invalid:${expected.id}:project`);
    }
  }
  if (browserControls.length !== 2) issues.push("browser-validation-control-inventory-invalid");

  const candidateRun = runById.get("candidate-renderer-serial");
  const serialOutcomes = outcomesByRun.get("candidate-renderer-serial");
  if (!candidateRun || !serialOutcomes ||
      !sameStrings(serialOutcomes.tests.map((test) => identityOf(test.specFile, test.testTitle)),
        GROUND_GLASS_M7J_REQUIRED_RENDERER_TESTS) ||
      serialOutcomes.tests.some((test) => !test.actualPass) ||
      !isRecord(candidateRun.execution) || candidateRun.execution.projectName !== "chromium-renderer-serial" ||
      candidateRun.execution.configuredWorkers !== 1 || candidateRun.execution.actualWorkers !== 1 ||
      candidateRun.sourceRole !== "candidate" || candidateRun.inventoryComplete !== true) {
    issues.push("candidate-renderer-serial-regression-run-invalid");
  }
  const perTestDiagnosis = asArray(report.perTestDiagnosis).filter(isRecord);
  const diagnosisIdentities = perTestDiagnosis.map((entry) => asString(entry.identity));
  if (perTestDiagnosis.length !== 3 ||
      !sameStrings(diagnosisIdentities, [GROUND_GLASS_M7J_REQUIRED_RENDERER_TESTS[0],
        GROUND_GLASS_M7J_REQUIRED_RENDERER_TESTS[2], GROUND_GLASS_M7J_REQUIRED_RENDERER_TESTS[3]]) ||
      perTestDiagnosis.some((entry) => /verified root cause/i.test(asString(entry.confidence)))) {
    issues.push("per-test-diagnosis-inventory-or-confidence-invalid");
  }

  const fourWorkerRun = runById.get("baseline-cohort5-w4");
  const fourWorkerOutcomes = outcomesByRun.get("baseline-cohort5-w4");
  const j1 = fourWorkerOutcomes?.tests.find((test) => identityOf(test.specFile, test.testTitle) ===
    GROUND_GLASS_M7J_REQUIRED_RENDERER_TESTS[2]);
  const j2 = fourWorkerOutcomes?.tests.find((test) => identityOf(test.specFile, test.testTitle) ===
    GROUND_GLASS_M7J_REQUIRED_RENDERER_TESTS[0]);
  const j3 = fourWorkerOutcomes?.tests.find((test) => identityOf(test.specFile, test.testTitle) ===
    GROUND_GLASS_M7J_REQUIRED_RENDERER_TESTS[3]);
  const derivedFourWorkerState = fourWorkerRun && isRecord(fourWorkerRun.execution) &&
    fourWorkerRun.execution.actualWorkers === 4 && [j1, j2, j3].filter((test) => test && !test.actualPass).length >= 2
    ? "unstable" : "stable";
  if (report.fourWorkerStability !== derivedFourWorkerState) issues.push("four-worker-stability-classification-mismatch");

  const commonCause = isRecord(report.sharedCause) ? report.sharedCause : {};
  if (commonCause.classification !== "strongly-supported-common-factor" || commonCause.verifiedCause !== false ||
      !Array.isArray(commonCause.supportingExperimentIds) || commonCause.supportingExperimentIds.length < 3 ||
      commonCause.gpuUtilizationAttribution !== "unavailable" ||
      commonCause.cpuVersusGpuAttribution !== "unresolved") {
    issues.push("shared-cause-strength-or-limitations-overclaimed");
  }
  const diagnostic = runById.get("probe-cohort5-w4");
  const diagnosticArtifact = diagnostic ? artifacts[asString(diagnostic.rawReportPath)] : undefined;
  const diagnosticRaw = diagnosticArtifact?.value;
  const probedTargets = GROUND_GLASS_M7J_REQUIRED_RENDERER_TESTS.filter((identity) => {
    const probe = readRawProbe(diagnosticRaw, identity);
    if (!probe || !isRecord(probe.probeResult) || !isRecord(probe.probeResult.value)) return false;
    const sample = isRecord(probe.probeResult.value.probe) ? probe.probeResult.value.probe : {};
    const renderer = isRecord(probe.probeResult.value.renderer) ? probe.probeResult.value.renderer : {};
    const groundGlass = isRecord(probe.probeResult.value.groundGlass) ? probe.probeResult.value.groundGlass : {};
    return probe.probePerturbsAnimationScheduling === true &&
      (asNumber(sample.longTaskTotalMs) ?? 0) >= (asNumber(sample.probeNow) ?? Infinity) * 0.7 &&
      (asNumber(sample.timerMaxGapMs) ?? 0) > 2000 &&
      sample.contextLostEvents === 0 && sample.visibilityState === "visible" &&
      renderer["data-observer-renderer-status"] === "active" &&
      renderer["data-observer-execution-backend"] === "webgl2" &&
      groundGlass["data-frame-request-id"] === groundGlass["data-last-completed-request-id"];
  });
  const lightRun = outcomesByRun.get("experiment-j2-light-page-w2");
  const rendererRun = outcomesByRun.get("experiment-j2-renderer-page-w2");
  const headedRun = outcomesByRun.get("experiment-j2-renderer-headed-w2");
  const j2Identity = GROUND_GLASS_M7J_REQUIRED_RENDERER_TESTS[0];
  const isPass = (outcome: GroundGlassM7hPlaywrightReportOutcomes["tests"][number] | undefined): boolean =>
    Boolean(outcome?.actualPass);
  const j2Duration = (runId: string): number | null => outcomesByRun.get(runId)?.tests
    .find((test) => identityOf(test.specFile, test.testTitle) === j2Identity)?.durationMs ?? null;
  const comparisonSupported = isPass(lightRun?.tests.find((test) => identityOf(test.specFile, test.testTitle) === j2Identity)) &&
    !isPass(rendererRun?.tests.find((test) => identityOf(test.specFile, test.testTitle) === j2Identity)) &&
    isPass(headedRun?.tests.find((test) => identityOf(test.specFile, test.testTitle) === j2Identity)) &&
    (j2Duration("experiment-j2-renderer-headed-w2") ?? Infinity) < 10_000;
  if (probedTargets.length < 2 || !comparisonSupported) issues.push("shared-cause-supporting-observations-insufficient");

  const readiness = asString(report.readinessDecision);
  if (readiness !== "ready-for-controlled-broad-run" && readiness !== "not-ready" && readiness !== "environment-limited") {
    issues.push("readiness-decision-invalid");
  }
  const policy = isRecord(report.executionPolicy) ? report.executionPolicy : {};
  if (readiness === "ready-for-controlled-broad-run" &&
      (policy.defaultChromiumRendererTestCount !== 274 || policy.rendererSerialTestCount !== 4 ||
       policy.rendererSerialProject !== "chromium-renderer-serial" || policy.rendererSerialWorkers !== 1 ||
       policy.fullBroadRunExecuted !== false || !candidateRun)) {
    issues.push("controlled-readiness-policy-incomplete");
  }
  if (report.fullBroadE2eRun !== "not-run" || report.broadE2eQualification !== "not-qualified" ||
      report.m7Qualification !== "partially-qualified" || report.m8Entry !== "denied" ||
      report.productionGroundGlass !== "webgl-only" || report.productionWebGpuEnabled !== false ||
      report.spontaneousExternalGpuDeviceLoss !== "blocked" || report.m5qQualification !== "partially-qualified" ||
      report.m6Status !== "development-only") issues.push("qualification-or-production-boundary-changed");
  if (report.verifiedApplicationFixCount !== 0 || report.verifiedSchedulingPolicyResult !== "passed") {
    issues.push("remediation-classification-invalid");
  }
  const validation = isRecord(report.validation) ? report.validation : {};
  const mutationSuite = isRecord(validation.mutationTests) ? validation.mutationTests : {};
  const declaredMutationCases = asArray(mutationSuite.requiredCases)
    .filter((entry): entry is string => typeof entry === "string");
  if (mutationSuite.suiteRevision !== GROUND_GLASS_M7J_MUTATION_SUITE_REVISION ||
      mutationSuite.tests !== GROUND_GLASS_M7J_MUTATION_TEST_COUNT ||
      !sameStrings(declaredMutationCases, GROUND_GLASS_M7J_REQUIRED_MUTATION_CASES)) {
    issues.push("mutation-suite-validation-metadata-invalid");
  }

  const uniqueIssues = [...new Set(issues)];
  const passed = uniqueIssues.length === 0;
  const matchesIssue = (prefixes: readonly string[]): boolean => uniqueIssues.some((issue) =>
    prefixes.some((prefix) => issue.startsWith(prefix)));
  const hasUnclassifiedIssue = uniqueIssues.some((issue) => ![
    "worker-configuration-or-actual-count-mismatch:", "execution-project-mismatch:",
    "experiment-environment-not-comparable:", "playwright-version-does-not-match-raw-report:",
    "observed-page-count-invalid:", "runtime-fingerprint-incomplete-or-incompatible", "controlled-viewport-mismatch",
    "unmeasured-host-metric-claimed", "raw-artifact-missing-or-digest-mismatch:", "raw-results-incomplete-or-malformed:",
    "experiment-test-inventory-incomplete-or-mismatched:", "test-outcome-claim-mismatch:",
    "candidate-renderer-serial-regression-run-invalid", "four-worker-stability-classification-mismatch",
    "diagnostic-probe-identity-inventory-invalid:", "diagnostic-probe-provenance-invalid:",
    "shared-cause-strength-or-limitations-overclaimed", "shared-cause-supporting-observations-insufficient",
    "browser-validation-control-record-invalid:", "browser-validation-control-artifact-invalid:",
    "browser-validation-control-results-invalid:", "browser-validation-control-inventory-invalid",
  ].some((prefix) => issue.startsWith(prefix)));
  const experimentRecordIntegrity = matchesIssue([
    "report-id-", "evaluator-revision-", "accepted-", "candidate-source-", "source-commit-missing:",
    "historical-", "m7i-inventory-", "m7h-historical-", "per-test-diagnosis-", "experiment-id-", "experiment-source-attribution-invalid:",
    "accepted-m7i-validation-", "accepted-m7i-evidence-",
    "raw-artifact-missing-or-digest-mismatch:", "experiment-test-inventory-incomplete-or-mismatched:",
    "required-experiment-record-missing:", "controlled-discovery-", "readiness-", "controlled-readiness-",
    "qualification-", "remediation-",
    "mutation-suite-validation-",
  ]) || hasUnclassifiedIssue;
  const comparability = matchesIssue([
    "runtime-fingerprint-", "controlled-viewport-", "worker-configuration-", "execution-project-",
    "experiment-environment-", "playwright-version-", "observed-page-count-",
  ]);
  const rawOutcomes = matchesIssue([
    "raw-artifact-", "raw-results-", "experiment-test-inventory-", "test-outcome-",
    "candidate-renderer-serial-", "four-worker-stability-", "browser-validation-control-artifact-",
    "browser-validation-control-results-",
  ]);
  const hypothesisSupport = matchesIssue([
    "shared-cause-", "diagnostic-probe-", "unmeasured-host-metric-",
  ]);
  return {
    reportId: GROUND_GLASS_M7J_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7J_EVALUATOR_REVISION,
    passed,
    evidenceIntegrity: passed ? "passed" : "failed",
    experimentRecordIntegrity: experimentRecordIntegrity ? "failed" : "passed",
    comparability: comparability ? "failed" : "passed",
    rawOutcomes: rawOutcomes ? "failed" : "passed",
    hypothesisSupport: hypothesisSupport ? "failed" : "passed",
    readinessDecision: readiness === "ready-for-controlled-broad-run" || readiness === "not-ready" ||
      readiness === "environment-limited" ? readiness : "not-ready",
    fourWorkerStability: derivedFourWorkerState,
    fullBroadE2eQualification: "not-qualified",
    counts: {
      experiments: runValues.length,
      rawTests: rawTestCount,
      discoveredTests: asNumber(isRecord(report.currentDiscovery) ? report.currentDiscovery.discoveredTests : null) ?? 0,
      unresolvedHistoricalIdentities: historicalIds.length,
    },
    issues: uniqueIssues,
  };
};

const isGroundGlassM7jPassClaimIncorrect = (
  claim: JsonRecord,
  test: GroundGlassM7hPlaywrightReportOutcomes["tests"][number],
): boolean => claim.actualPass === true &&
  (test.expectedStatus !== "passed" || test.actualStatus !== "passed" || test.retryCount !== 0 ||
   test.resultStatus !== "expected" || !test.actualPass);
