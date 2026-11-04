export const GROUND_GLASS_M7L_REPORT_ID = "ground-glass-m7l-learning-drawer-remediation" as const;
export const GROUND_GLASS_M7L_EVALUATOR_REVISION = "m7l-learning-drawer-remediation-evaluator-v1" as const;
export const GROUND_GLASS_M7L_MUTATION_SUITE_REVISION = "m7l-learning-drawer-evidence-mutations-v1" as const;
export const GROUND_GLASS_M7L_BASE_COMMIT_SHA = "ed51a370689421befc9e33b8367f05e2e71308eb" as const;
export const GROUND_GLASS_M7K_EXECUTION_SOURCE_SHA = "e6066a244510387c32995c1e973a771667b04d10" as const;
export const GROUND_GLASS_M7K_REPORT_SHA256 = "963b9001f29d43073b0c07912bb2c4904a9bd79ffb3dbe9878d9add6e5c9b60f" as const;
export const GROUND_GLASS_M7K_ORDINARY_RAW_SHA256 = "95a7abebfaa7abe53805be7171d0ff84166dbb9e3e3d45eaa134a68f098963de" as const;
export const GROUND_GLASS_M7K_RENDERER_SERIAL_RAW_SHA256 = "4be43aa1e68c5bd45d861092cf298db6f43e77576f3a338dc4533f162e32d71a" as const;
export const GROUND_GLASS_M7L_INVENTORY_SHA256 = "ee7e6e0de2e280207f5b5e1935b812dcc19432922061c01cf57cfbc6fb25a647" as const;
export const GROUND_GLASS_M7L_FOCUSED_VALIDATION_SHA256 = "f7ec6f84c1f221ff79985218b722143694311d3d8c7c5780d0662a6d83102f90" as const;
export const GROUND_GLASS_M7L_INVENTORY_PATH = "docs/architecture/ground-glass-m7l-learning-drawer/historical-82-failure-inventory.json" as const;
export const GROUND_GLASS_M7L_FOCUSED_VALIDATION_PATH = "docs/architecture/ground-glass-m7l-learning-drawer/validation/focused-drawer-regressions.json" as const;
export const GROUND_GLASS_M7L_EXPERIMENT_ARTIFACTS = Object.freeze({
  "single-case-w1": { raw: "c72c864bb506d1a86dae17826249a00eae7d5cf36c0ade319f2ec22ed42cecc8", artifact: "27ebfa11c8f0d32363d8d6b6f97c7d63148d81a16b018d82c6cfe98c7341bf04" },
  "cohort-w1": { raw: "34611073b34e7ca57c131fcb097e41a5944724dc9eba41e62608407036d8edf3", artifact: "6235e161419b8398d8a8b7739657d776de55ca030c49ff4a0b0de6d05e7da2e7" },
  "cohort-w2": { raw: "0aca6f968973fd5e33e44503b9d7bb20ebdd652e06b496c6de6b1d9ced7de621", artifact: "42ed4f4ddc21f438dc3ab86098c23244d9950a1b4f52e9bcff284da49546ad26" },
  "cohort-w4": { raw: "ed628e6fa7d96771ea461bacbc2bb3587d85a9e98acd5648fa2d3c43633bec99", artifact: "dc7a1151818d855b8353e9010c6edd127c301d4ea3f63f939118e6869d5c62ef" },
  "controlled-heavy-free-w4": { raw: "c3e310cfc0c2c11181403c6607285f22048465a18dee9abb2beb2a803bce6048", artifact: "070599e80d6eee511fc1ae2835cfc9530fa94b2c2cae5fbe9749f1dc2b3cc9a1" },
  "controlled-heavy-guided-w4": { raw: "d740041258592627531be1101229784218e19121c78f1e7d1a8555d3228c005c", artifact: "e561049449352901b61e8e74544db265d0f426807961715effb5962104507c2c" },
  "controlled-light-guided-w4": { raw: "d870796260a9073b6b89042509f77bb9a1053716766c00d056b337494ff8d03a", artifact: "c308e99787c7e88b39bf012f07a360aaac78def37686c4adb260680aaf757ed1" },
} as const);
export const GROUND_GLASS_M7L_EXPECTED_OUTCOMES = Object.freeze({
  "single-case-w1": { discovered: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, incomplete: 0, retries: 0, maxConcurrentTests: 1 },
  "cohort-w1": { discovered: 11, passed: 11, failed: 0, skipped: 0, flaky: 0, incomplete: 0, retries: 0, maxConcurrentTests: 1 },
  "cohort-w2": { discovered: 11, passed: 9, failed: 2, skipped: 0, flaky: 0, incomplete: 0, retries: 0, maxConcurrentTests: 2 },
  "cohort-w4": { discovered: 11, passed: 4, failed: 7, skipped: 0, flaky: 0, incomplete: 0, retries: 0, maxConcurrentTests: 4 },
  "controlled-heavy-free-w4": { discovered: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, incomplete: 0, retries: 0, maxConcurrentTests: 4 },
  "controlled-heavy-guided-w4": { discovered: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, incomplete: 0, retries: 0, maxConcurrentTests: 4 },
  "controlled-light-guided-w4": { discovered: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, incomplete: 0, retries: 0, maxConcurrentTests: 4 },
} as const);

export const GROUND_GLASS_M7L_REQUIRED_COHORT_IDENTITIES = [
  "architecture-foreground-dof.spec.ts::Architecture + Foreground DOF task starts solved through PR7C and completes with Aperture only",
  "architecture-foreground-guided-lesson.spec.ts::Architecture + Foreground lesson entry resets after Free Practice and direct task routes stay standalone",
  "interior-corner-guided-lesson.spec.ts::Interior Corner completes the public Compose → Swing → Refine → Aperture lesson",
  "interior-corner-guided-lesson.spec.ts::Interior Corner keeps the solved focus state when returning to Swing",
  "interior-corner-rise-composition.spec.ts::Interior Corner free mode exposes reachable Rise composition feedback",
  "mirror-shift-guided-lesson.spec.ts::Mirror Shift guided task teaches camera movement followed by opposite Front Shift",
  "oblique-architecture.spec.ts::Oblique Architecture compound task solves Rise, Swing, and Focus from neutral",
  "oblique-architecture.spec.ts::Oblique Architecture guided lesson progresses through the four stages",
  "oblique-architecture.spec.ts::Oblique Architecture guided Rise task solves observable framing and restarts to neutral",
  "oblique-tabletop-guided-lesson.spec.ts::Oblique Tabletop completes the public Focus → Tilt → Swing → Focus → Aperture lesson",
  "table-tilt.spec.ts::Table Tilt zero-tilt point focus moves from near to middle to far",
] as const;

export const GROUND_GLASS_M7L_EXPERIMENT_IDS = [
  "single-case-w1",
  "cohort-w1",
  "cohort-w2",
  "cohort-w4",
  "controlled-heavy-free-w4",
  "controlled-heavy-guided-w4",
  "controlled-light-guided-w4",
] as const;

export const GROUND_GLASS_M7L_REQUIRED_MUTATION_CASES = [
  "historical-report-digest-changed",
  "historical-inventory-count-changed",
  "historical-identity-removed",
  "historical-inventory-identity-invented",
  "cohort-identity-removed",
  "raw-artifact-digest-changed",
  "raw-artifact-missing",
  "configured-worker-count-mismatch",
  "actual-concurrency-mismatch",
  "retry-dependent-pass-hidden",
  "incomplete-run-counted-as-complete",
  "not-reproduced-case-promoted-to-fixed",
  "cohort-promoted-to-full-broad-qualified",
  "m8-authorization-enabled",
  "production-webgpu-enabled",
  "evaluator-revision-changed",
  "historical-full-suite-count-altered",
  "accepted-m7k-counts-altered",
  "captured-outcome-promoted-to-pass",
  "candidate-source-replaced",
  "reported-worker-matrix-altered",
  "raw-failed-outcome-promoted-to-pass",
] as const;

type JsonRecord = Record<string, unknown>;
export type GroundGlassM7lArtifact = Readonly<{ sha256: string; value: unknown }>;
export type GroundGlassM7lEvidence = Readonly<{
  historicalM7kReport: unknown;
  historicalInventory: unknown;
  historicalInventorySha256: string;
  historicalRawArtifacts: Readonly<Record<string, GroundGlassM7lArtifact>>;
  experiments: Readonly<Record<string, GroundGlassM7lArtifact>>;
  focusedValidation: GroundGlassM7lArtifact;
}>;
export type GroundGlassM7lEvaluation = Readonly<{
  reportId: string;
  evaluatorRevision: string;
  passed: boolean;
  evidenceIntegrity: "passed" | "failed";
  historicalUnexpectedCount: number;
  cohortIdentityCount: number;
  verifiedFixCount: number;
  workerOutcomes: Readonly<Record<string, Readonly<{ discovered: number; passed: number; failed: number; skipped: number; flaky: number; incomplete: number; retries: number; maxConcurrentTests: number }>>>;
  fullBroadE2eStatus: "not-qualified";
  m7Overall: "partially-qualified";
  m8Entry: "denied";
  productionWebGpuEnabled: false;
  issues: readonly string[];
}>;

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === "string" ? value : "";
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const sort = (values: readonly string[]): string[] => [...values].sort();
const sameStrings = (left: readonly string[], right: readonly string[]): boolean => JSON.stringify(sort(left)) === JSON.stringify(sort(right));
const issueOnce = (issues: string[], issue: string): void => { if (!issues.includes(issue)) issues.push(issue); };

type PlaywrightEntry = Readonly<{
  testId: string;
  status: string;
  retry: number;
  startTime: string;
  duration: number;
}>;

const playwrightEntries = (value: unknown): PlaywrightEntry[] => {
  if (!isRecord(value)) return [];
  const entries: PlaywrightEntry[] = [];
  const visitSuite = (suiteValue: unknown): void => {
    if (!isRecord(suiteValue)) return;
    for (const specValue of array(suiteValue.specs)) {
      if (!isRecord(specValue)) continue;
      const file = text(specValue.file);
      const title = text(specValue.title);
      for (const testValue of array(specValue.tests)) {
        if (!isRecord(testValue)) continue;
        for (const resultValue of array(testValue.results)) {
          if (!isRecord(resultValue)) continue;
          entries.push({
            testId: `${file}::${title}`,
            status: text(resultValue.status),
            retry: number(resultValue.retry) ?? 0,
            startTime: text(resultValue.startTime),
            duration: number(resultValue.duration) ?? 0,
          });
        }
      }
    }
    for (const child of array(suiteValue.suites)) visitSuite(child);
  };
  for (const suite of array(value.suites)) visitSuite(suite);
  return entries;
};

const maxOverlap = (entries: readonly PlaywrightEntry[]): number => {
  const events = entries.flatMap((entry) => {
    const start = Date.parse(entry.startTime);
    if (!Number.isFinite(start)) return [];
    return [{ time: start, delta: 1 }, { time: start + entry.duration, delta: -1 }];
  }).sort((left, right) => left.time - right.time || left.delta - right.delta);
  let active = 0;
  let maximum = 0;
  for (const event of events) {
    active += event.delta;
    maximum = Math.max(maximum, active);
  }
  return maximum;
};

const summarize = (value: unknown): GroundGlassM7lEvaluation["workerOutcomes"][string] => {
  const entries = playwrightEntries(value);
  const statuses = entries.map((entry) => entry.status);
  const run = isRecord(value) ? value : {};
  const testCases: JsonRecord[] = [];
  const visitSuite = (suiteValue: unknown): void => {
    if (!isRecord(suiteValue)) return;
    for (const specValue of array(suiteValue.specs)) {
      if (!isRecord(specValue)) continue;
      for (const testValue of array(specValue.tests)) if (isRecord(testValue)) testCases.push(testValue);
    }
    for (const child of array(suiteValue.suites)) visitSuite(child);
  };
  for (const suite of array(run.suites)) visitSuite(suite);
  const retries = entries.reduce((total, entry) => total + entry.retry, 0);
  const flaky = new Set(entries.filter((entry) => entry.retry > 0).map((entry) => entry.testId)).size;
  const incomplete = testCases.filter((testCase) => array(testCase.results).length === 0).length + statuses.filter((status) => status === "interrupted").length;
  return {
    discovered: testCases.length,
    passed: statuses.filter((status) => status === "passed").length,
    failed: statuses.filter((status) => status === "failed" || status === "timedOut" || status === "interrupted").length,
    skipped: statuses.filter((status) => status === "skipped").length,
    flaky,
    incomplete,
    retries,
    maxConcurrentTests: maxOverlap(entries),
  };
};

const validateExperiment = (
  experiment: unknown,
  artifacts: GroundGlassM7lEvidence["experiments"],
  issues: string[],
): GroundGlassM7lEvaluation["workerOutcomes"][string] | null => {
  if (!isRecord(experiment)) return null;
  const id = text(experiment.id);
  const path = text(experiment.artifactPath);
  const artifact = artifacts[id];
  if (!artifact || !isRecord(artifact.value)) {
    issueOnce(issues, `experiment-artifact-missing:${id}`);
    return null;
  }
  if (artifact.sha256 !== experiment.artifactSha256) issueOnce(issues, `experiment-artifact-digest-mismatch:${id}`);
  const expectedDigest = GROUND_GLASS_M7L_EXPERIMENT_ARTIFACTS[id as keyof typeof GROUND_GLASS_M7L_EXPERIMENT_ARTIFACTS];
  if (!expectedDigest || artifact.sha256 !== expectedDigest.artifact || text(artifact.value.sourceCaptureSha256) !== expectedDigest.raw) {
    issueOnce(issues, `experiment-artifact-pinned-digest-mismatch:${id}`);
  }
  if (text(artifact.value.schema) !== "m7l-playwright-outcomes-v1") issueOnce(issues, `experiment-artifact-schema-invalid:${id}`);
  if (text(artifact.value.sourceCaptureSha256) !== experiment.rawCaptureSha256) issueOnce(issues, `experiment-source-capture-digest-mismatch:${id}`);
  const config = isRecord(artifact.value.config) ? artifact.value.config : {};
  const actual = summarize(artifact.value);
  const recordedOutcomes = isRecord(experiment.outcomes) ? experiment.outcomes : {};
  const expectedOutcome = GROUND_GLASS_M7L_EXPECTED_OUTCOMES[id as keyof typeof GROUND_GLASS_M7L_EXPECTED_OUTCOMES];
  if (number(config.workers) !== experiment.configuredWorkers) issueOnce(issues, `configured-workers-mismatch:${id}`);
  if (number(config.actualWorkerMetadata) !== experiment.playwrightActualWorkers) issueOnce(issues, `playwright-worker-metadata-mismatch:${id}`);
  if (actual.maxConcurrentTests !== experiment.maxConcurrentTests) issueOnce(issues, `actual-concurrency-mismatch:${id}`);
  if (actual.discovered !== recordedOutcomes.discovered || actual.passed !== recordedOutcomes.passed || actual.failed !== recordedOutcomes.failed ||
    actual.skipped !== recordedOutcomes.skipped || actual.flaky !== recordedOutcomes.flaky || actual.incomplete !== recordedOutcomes.incomplete ||
    actual.retries !== recordedOutcomes.retries) {
    issueOnce(issues, `experiment-outcomes-mismatch:${id}`);
  }
  if (!expectedOutcome || Object.entries(expectedOutcome).some(([key, value]) => actual[key as keyof typeof actual] !== value)) {
    issueOnce(issues, `experiment-outcome-does-not-match-captured-run:${id}`);
  }
  if (experiment.sourceCommitSha !== GROUND_GLASS_M7L_BASE_COMMIT_SHA || experiment.repetitions !== 1) {
    issueOnce(issues, `experiment-source-or-repetition-mismatch:${id}`);
  }
  if (!path.startsWith("docs/architecture/ground-glass-m7l-learning-drawer/")) issueOnce(issues, `experiment-artifact-path-invalid:${id}`);
  return actual;
};

export const evaluateGroundGlassM7lLearningDrawerRemediation = (
  reportValue: unknown,
  evidence: GroundGlassM7lEvidence,
): GroundGlassM7lEvaluation => {
  const issues: string[] = [];
  const report = isRecord(reportValue) ? reportValue : {};
  if (report.reportId !== GROUND_GLASS_M7L_REPORT_ID) issueOnce(issues, "report-id-mismatch");
  if (report.schemaVersion !== 1) issueOnce(issues, "report-schema-version-mismatch");
  if (report.evaluatorRevision !== GROUND_GLASS_M7L_EVALUATOR_REVISION) issueOnce(issues, "evaluator-revision-mismatch");
  if (report.baseCommitSha !== GROUND_GLASS_M7L_BASE_COMMIT_SHA || report.candidateCommitSha !== GROUND_GLASS_M7L_BASE_COMMIT_SHA) {
    issueOnce(issues, "baseline-candidate-source-mismatch");
  }

  const historical = isRecord(report.historicalM7k) ? report.historicalM7k : {};
  if (historical.executionSourceCommitSha !== GROUND_GLASS_M7K_EXECUTION_SOURCE_SHA) issueOnce(issues, "historical-execution-source-mismatch");
  if (historical.reportSha256 !== GROUND_GLASS_M7K_REPORT_SHA256) issueOnce(issues, "historical-report-digest-mismatch");
  if (historical.unexpectedCount !== 82) issueOnce(issues, "historical-unexpected-count-mismatch");
  const historicalCounts = isRecord(historical.fullSuiteCounts) ? historical.fullSuiteCounts : {};
  if (historicalCounts.discovered !== 278 || historicalCounts.passed !== 121 || historicalCounts.unexpected !== 82 ||
      historicalCounts.skipped !== 75 || historicalCounts.flaky !== 0 || historicalCounts.incomplete !== 0) {
    issueOnce(issues, "historical-full-suite-counts-mismatch");
  }
  const historicalReport = isRecord(evidence.historicalM7kReport) ? evidence.historicalM7kReport : {};
  if (historicalReport.executionSourceCommitSha !== GROUND_GLASS_M7K_EXECUTION_SOURCE_SHA || historicalReport.schemaVersion !== 1) {
    issueOnce(issues, "historical-m7k-report-invalid");
  }
  const execution = isRecord(historicalReport.execution) ? historicalReport.execution : {};
  const historicalOutcomes = isRecord(execution.combinedOutcomes) ? execution.combinedOutcomes : {};
  if (historicalOutcomes.discovered !== 278 || historicalOutcomes.passed !== 121 || historicalOutcomes.unexpected !== 82 ||
      historicalOutcomes.skipped !== 75 || historicalOutcomes.flaky !== 0 || historicalOutcomes.incomplete !== 0) {
    issueOnce(issues, "accepted-m7k-full-suite-counts-changed");
  }
  const historicalUnexpected = isRecord(historicalReport.historicalComparison) && isRecord(historicalReport.historicalComparison.summary)
    ? array(historicalReport.historicalComparison.summary.currentUnexpectedFailures)
    : [];
  const inventory = isRecord(evidence.historicalInventory) ? evidence.historicalInventory : {};
  const inventoryRows = array(inventory.outcomes).filter(isRecord);
  const sourceIds = historicalUnexpected.filter(isRecord).map((row) => text(row.testId));
  const inventoryIds = inventoryRows.map((row) => text(row.testId));
  if (historicalUnexpected.length !== 82 || inventoryRows.length !== 82 || !sameStrings(sourceIds, inventoryIds)) {
    issueOnce(issues, "historical-inventory-identity-mismatch");
  }
  if (inventory.sourceReportSha256 !== GROUND_GLASS_M7K_REPORT_SHA256 || inventory.historicalUnexpectedCount !== 82) {
    issueOnce(issues, "historical-inventory-provenance-mismatch");
  }
  const backlog = isRecord(report.remainingBacklog) ? report.remainingBacklog : {};
  if (backlog.inventoryPath !== GROUND_GLASS_M7L_INVENTORY_PATH || backlog.inventorySha256 !== GROUND_GLASS_M7L_INVENTORY_SHA256 ||
      backlog.historicalUnexpectedCount !== 82 || backlog.drawerCohortCount !== 11 || backlog.otherHistoricalFailureCount !== 71) {
    issueOnce(issues, "remaining-backlog-inventory-contract-mismatch");
  }
  if (evidence.historicalInventorySha256 !== GROUND_GLASS_M7L_INVENTORY_SHA256) issueOnce(issues, "historical-inventory-digest-mismatch");
  const expectedHistoricalRaw = {
    "m7k-ordinary": GROUND_GLASS_M7K_ORDINARY_RAW_SHA256,
    "m7k-renderer-serial": GROUND_GLASS_M7K_RENDERER_SERIAL_RAW_SHA256,
  } as const;
  for (const [key, expectedDigest] of Object.entries(expectedHistoricalRaw)) {
    if (evidence.historicalRawArtifacts[key]?.sha256 !== expectedDigest) issueOnce(issues, `historical-raw-artifact-digest-mismatch:${key}`);
  }
  const sourceFailureById = new Map(historicalUnexpected.filter(isRecord).map((row) => [text(row.testId), row]));
  for (const row of inventoryRows) {
    const source = sourceFailureById.get(text(row.testId));
    const outcome = isRecord(row.historicalOutcome) ? row.historicalOutcome : {};
    if (!source || outcome.disposition !== "unexpected" || row.lane !== source.lane ||
      row.failureSignature !== source.errorSignature || outcome.actualStatus !== source.actualStatus || row.failureMessage !== source.errorMessage) {
      issueOnce(issues, `historical-inventory-record-mismatch:${text(row.testId)}`);
    }
  }

  const ids = array(historical.cohortIdentities).filter((value): value is string => typeof value === "string");
  if (!sameStrings(ids, GROUND_GLASS_M7L_REQUIRED_COHORT_IDENTITIES)) issueOnce(issues, "cohort-identity-set-mismatch");
  if (!sameStrings(array(inventory.cohortTestIds).filter((value): value is string => typeof value === "string"), GROUND_GLASS_M7L_REQUIRED_COHORT_IDENTITIES)) {
    issueOnce(issues, "inventory-cohort-identity-set-mismatch");
  }
  const sourceCohort = historicalUnexpected.filter(isRecord).filter((row) => GROUND_GLASS_M7L_REQUIRED_COHORT_IDENTITIES.includes(text(row.testId) as never));
  if (sourceCohort.length !== 11) issueOnce(issues, "historical-cohort-failure-count-mismatch");
  const cohortSignatures = sourceCohort.map((row) => text(row.errorSignature));
  if (cohortSignatures.filter((signature) => signature === "css-assertion").length !== 10 ||
    cohortSignatures.filter((signature) => signature === "text-assertion").length !== 1) {
    issueOnce(issues, "historical-cohort-signature-count-mismatch");
  }
  const artifactRefs = array(historical.artifacts).filter(isRecord);
  for (const [path, digest] of [
    ["docs/architecture/ground-glass-m7k-broad-e2e/execution/three-r187/execution/ordinary-playwright.json", GROUND_GLASS_M7K_ORDINARY_RAW_SHA256],
    ["docs/architecture/ground-glass-m7k-broad-e2e/execution/three-r187/execution/renderer-serial-playwright.json", GROUND_GLASS_M7K_RENDERER_SERIAL_RAW_SHA256],
  ]) {
    if (!artifactRefs.some((reference) => reference.path === path && reference.sha256 === digest)) {
      issueOnce(issues, `historical-raw-artifact-reference-mismatch:${path}`);
    }
  }

  const experiments = array(report.experiments);
  const experimentIds = experiments.filter(isRecord).map((experiment) => text(experiment.id));
  if (!sameStrings(experimentIds, GROUND_GLASS_M7L_EXPERIMENT_IDS)) issueOnce(issues, "experiment-id-set-mismatch");
  const workerOutcomes: Record<string, GroundGlassM7lEvaluation["workerOutcomes"][string]> = {};
  for (const experiment of experiments) {
    if (!isRecord(experiment)) continue;
    const actual = validateExperiment(experiment, evidence.experiments, issues);
    if (actual) workerOutcomes[text(experiment.id)] = actual;
  }
  const cohortRuns = ["cohort-w1", "cohort-w2", "cohort-w4"];
  for (const id of cohortRuns) {
    const experiment = experiments.find((candidate) => isRecord(candidate) && candidate.id === id);
    const artifact = evidence.experiments[id];
    const expectedIds = GROUND_GLASS_M7L_REQUIRED_COHORT_IDENTITIES;
    const entries = artifact ? playwrightEntries(artifact.value) : [];
    if (!sameStrings(entries.map((entry) => entry.testId), expectedIds)) issueOnce(issues, `cohort-run-identity-set-mismatch:${id}`);
    if (entries.some((entry) => entry.retry !== 0)) issueOnce(issues, `cohort-run-retry-present:${id}`);
    const expectedWorker = id === "cohort-w1" ? 1 : id === "cohort-w2" ? 2 : 4;
    if (isRecord(experiment) && (experiment.configuredWorkers !== expectedWorker || experiment.maxConcurrentTests !== expectedWorker)) {
      issueOnce(issues, `cohort-worker-configuration-invalid:${id}`);
    }
  }

  const expectedMatrix = new Map<string, Record<string, string>>();
  for (const [worker, id] of [["w1", "cohort-w1"], ["w2", "cohort-w2"], ["w4", "cohort-w4"]] as const) {
    const artifact = evidence.experiments[id];
    for (const entry of artifact ? playwrightEntries(artifact.value) : []) {
      const matrix = expectedMatrix.get(entry.testId) ?? {};
      matrix[worker] = entry.status;
      expectedMatrix.set(entry.testId, matrix);
    }
  }
  for (const row of inventoryRows.filter((candidate) => GROUND_GLASS_M7L_REQUIRED_COHORT_IDENTITIES.includes(text(candidate.testId) as never))) {
    const recorded = isRecord(row.currentWorkerMatrix) ? row.currentWorkerMatrix : {};
    const actual = expectedMatrix.get(text(row.testId)) ?? {};
    for (const worker of ["w1", "w2", "w4"]) if (recorded[worker] !== actual[worker]) issueOnce(issues, `cohort-worker-outcome-mismatch:${text(row.testId)}:${worker}`);
    if (row.reproductionStatus === "verified-fixed") issueOnce(issues, `non-matched-case-labeled-verified-fixed:${text(row.testId)}`);
  }

  const remediation = isRecord(report.remediation) ? report.remediation : {};
  if (array(remediation.verifiedFixIdentities).length !== 0 || remediation.verifiedFixCount !== 0) issueOnce(issues, "unmatched-fix-claim-present");
  if (remediation.applicationFilesChanged !== false || remediation.testAssertionsChanged !== false) issueOnce(issues, "unsubstantiated-remediation-claim");
  if (report.focusedRegressionPath !== GROUND_GLASS_M7L_FOCUSED_VALIDATION_PATH ||
      !isRecord(report.diagnosis) || report.diagnosis.sharedRootCauseEstablished !== false) {
    issueOnce(issues, "diagnosis-or-focused-validation-contract-mismatch");
  }
  const qualification = isRecord(report.qualification) ? report.qualification : {};
  if (qualification.cohortStatus !== "scheduling-sensitive-unresolved" || qualification.fullBroadE2eStatus !== "not-qualified" ||
    qualification.m7Overall !== "partially-qualified" || qualification.m8Entry !== "denied" || qualification.productionWebGpuEnabled !== false ||
    qualification.productionGroundGlass !== "WebGL-only") {
    issueOnce(issues, "qualification-boundary-mismatch");
  }

  const focused = isRecord(evidence.focusedValidation.value) ? evidence.focusedValidation.value : {};
  if (evidence.focusedValidation.sha256 !== report.focusedRegressionSha256 || evidence.focusedValidation.sha256 !== GROUND_GLASS_M7L_FOCUSED_VALIDATION_SHA256 ||
    focused.schema !== "m7l-focused-drawer-regression-validation-v1" || focused.exitCode !== 0 || focused.passed !== 6 ||
    focused.failed !== 0 || focused.skipped !== 0 || focused.flaky !== 0 || focused.retries !== 0) {
    issueOnce(issues, "focused-regression-validation-mismatch");
  }
  const validation = isRecord(report.validation) ? report.validation : {};
  const mutation = isRecord(validation.mutationCoverage) ? validation.mutationCoverage : {};
  if (mutation.revision !== GROUND_GLASS_M7L_MUTATION_SUITE_REVISION ||
    !sameStrings(array(mutation.requiredCases).filter((value): value is string => typeof value === "string"), GROUND_GLASS_M7L_REQUIRED_MUTATION_CASES) ||
    mutation.testCount !== GROUND_GLASS_M7L_REQUIRED_MUTATION_CASES.length) {
    issueOnce(issues, "mutation-coverage-manifest-mismatch");
  }

  const passed = issues.length === 0;
  return {
    reportId: GROUND_GLASS_M7L_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7L_EVALUATOR_REVISION,
    passed,
    evidenceIntegrity: passed ? "passed" : "failed",
    historicalUnexpectedCount: historicalUnexpected.length,
    cohortIdentityCount: ids.length,
    verifiedFixCount: array(remediation.verifiedFixIdentities).length,
    workerOutcomes,
    fullBroadE2eStatus: "not-qualified",
    m7Overall: "partially-qualified",
    m8Entry: "denied",
    productionWebGpuEnabled: false,
    issues,
  };
};
