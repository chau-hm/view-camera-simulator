import { createHash } from "node:crypto";

export const GROUND_GLASS_M7M_REPORT_ID = "ground-glass-m7m-scene-readiness" as const;
export const GROUND_GLASS_M7M_EVALUATOR_REVISION = "m7m-scene-readiness-evaluator-v1" as const;
export const GROUND_GLASS_M7M_MUTATION_SUITE_REVISION = "m7m-scene-readiness-evidence-mutations-v1" as const;
export const GROUND_GLASS_M7M_BASE_COMMIT_SHA = "0c32f113c1e3d16a8fd42e7748c64909366c6ae8" as const;
export const GROUND_GLASS_M7M_EXECUTION_SOURCE_SHA = GROUND_GLASS_M7M_BASE_COMMIT_SHA;
export const GROUND_GLASS_M7M_M7K_REPORT_SHA256 = "963b9001f29d43073b0c07912bb2c4904a9bd79ffb3dbe9878d9add6e5c9b60f" as const;
export const GROUND_GLASS_M7M_M7L_REPORT_SHA256 = "d72698c8ad5e28f5a0fd9d9ba052e654e6d9aa1d90f0acec0a769e35c2616eed" as const;
export const GROUND_GLASS_M7M_M7L_INVENTORY_SHA256 = "ee7e6e0de2e280207f5b5e1935b812dcc19432922061c01cf57cfbc6fb25a647" as const;
export const GROUND_GLASS_M7M_NORMALIZER_REVISION = "m7m-playwright-normalizer-v1" as const;

export const GROUND_GLASS_M7M_REQUIRED_COHORT_IDENTITIES = [
  "architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
  "macro-bellows-extension.spec.ts::Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions",
  "macro-compound-movements.spec.ts::Macro 4 teaches compound Tilt + Swing + Focus through the public route",
  "mirror-shift-rig-lateral.spec.ts::Mirror Shift Camera focus follows the rig while Scene focus stays fixed",
  "observer-webgpu-pilot.spec.ts::Architecture Rise restores standard output after a controlled material-aware module failure",
  "phase13-guided-tasks.spec.ts::TST-E2E-002: user can open Architecture Rise from the Scenes page",
  "scene-view-focus.spec.ts::Understanding Camera Movements Camera focus follows continuous viewpoint changes",
  "scene-view-focus.spec.ts::Architecture + Foreground Camera focus uses the physical camera anchor",
  "scene-view-focus.spec.ts::SPA scene switching discards the previous Camera target and returns to Scene focus",
  "scene-viewport-expansion.spec.ts::simulator viewports expand in main without replacing their active canvases",
  "secondary-workspace-pairing.spec.ts::normal desktop pairs Geometry with Scene and Focus Distribution with Ground Glass",
  "viewport-learning-overlay.spec.ts::Scene-local learning drawer leaves the paired workspace layout intact",
] as const;

export const GROUND_GLASS_M7M_REQUIRED_MUTATION_CASES = [
  "m7k-report-digest-changed",
  "m7k-full-suite-counts-changed",
  "m7l-report-digest-changed",
  "m7l-raw-provenance-overstated",
  "historical-inventory-digest-changed",
  "historical-candidate-identity-removed",
  "historical-candidate-identity-invented",
  "current-discovery-count-changed",
  "current-discovery-digest-changed",
  "duplicate-cohort-identity",
  "missing-cohort-identity",
  "invented-cohort-identity",
  "normalized-artifact-digest-changed",
  "normalized-raw-digest-changed",
  "captured-failure-promoted-to-pass",
  "captured-pass-promoted-to-failure",
  "missing-result-counted-as-success",
  "wrong-project-identity",
  "configured-workers-mismatch",
  "actual-concurrency-mismatch",
  "retry-added-to-zero-retry-capture",
  "partial-matrix-called-complete",
  "viewport-geometry-misclassified-as-readiness",
  "current-pass-promoted-to-verified-fixed",
  "single-capture-promoted-to-verified-fix",
  "raw-provenance-overstated",
  "normalizer-revision-changed",
  "full-broad-e2e-qualified-from-cohort",
  "m7-overall-promoted",
  "m8-entry-enabled",
  "production-webgpu-enabled",
] as const;

type JsonRecord = Record<string, unknown>;
export type GroundGlassM7mArtifact = Readonly<{ sha256: string; value: unknown }>;
export type GroundGlassM7mEvidence = Readonly<{
  historicalM7k: unknown;
  historicalM7kSha256: string;
  historicalM7l: unknown;
  historicalM7lSha256: string;
  historicalInventory: unknown;
  historicalInventorySha256: string;
  sourceCommitAvailable: boolean;
  experiments: Readonly<Record<string, GroundGlassM7mArtifact>>;
}>;
export type GroundGlassM7mEvaluation = Readonly<{
  reportId: string;
  evaluatorRevision: string;
  passed: boolean;
  evidenceIntegrity: "passed" | "failed";
  normalizedArtifactIntegrity: "passed" | "failed";
  executionCompleteness: "complete" | "incomplete";
  cohortStatus: "worker-sensitive-unresolved" | "incomplete";
  candidateIdentityCount: number;
  verifiedFixCount: number;
  cohortWorkerOutcomes: Readonly<Record<string, Readonly<{ discovered: number; passed: number; failed: number; skipped: number; retries: number; maxConcurrentTests: number }>>>;
  fullBroadE2eQualification: "not-qualified";
  m7Overall: "partially-qualified";
  m8Entry: "denied";
  productionWebGpuEnabled: false;
  issues: readonly string[];
}>;

type ExpectedExperiment = Readonly<{
  artifactPath: string;
  artifactSha256: string;
  rawSha256: string;
  configuredWorkers: number;
  maxConcurrentTests: number;
  testSeam: "disabled" | "controlled-webgl-failure-recovery";
  outcomes: Readonly<{ discovered: number; passed: number; failed: number; skipped: number; flaky: number; incomplete: number; retries: number }>;
  identities: readonly string[];
}>;

const cohort = GROUND_GLASS_M7M_REQUIRED_COHORT_IDENTITIES;
const fiveRepresentatives = [cohort[0], cohort[4], cohort[5], cohort[7], cohort[9]];
const traceSubset = [cohort[0], cohort[4], cohort[5], cohort[6], cohort[7], cohort[8]];
const lightPeers = [
  cohort[0],
  "smoke.spec.ts::smoke: app boots at home",
  "home.spec.ts::concept learning sections keep their responsive grids without overflow",
  "simulator-header.spec.ts::keeps the active lesson context between the brand and desktop actions",
];
const heavyPeers = [cohort[0], cohort[1], cohort[2], cohort[3]];
const lifecycle = [
  "understanding-camera-movements.spec.ts::camera movements scene loads and renders valid Ground Glass content",
  "understanding-camera-movements.spec.ts::canonical lattice remains stable across controls and SPA routes",
];

export const GROUND_GLASS_M7M_EXPECTED_EXPERIMENTS: Readonly<Record<string, ExpectedExperiment>> = Object.freeze({
  "single-canvas-w1": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/baseline/single-canvas-w1.json", artifactSha256: "f0ea1f946ad1d3299822b5f91fdeeaeef8da9118538141f3a0e1ce418016329b", rawSha256: "a1f0d0eab0d48b6d87b031158c94d9f086c2257fa8cbc4e174215f0685000b7c", configuredWorkers: 1, maxConcurrentTests: 1, testSeam: "disabled", outcomes: { discovered: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: [cohort[0]] },
  "single-route-heading-w1": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/baseline/single-route-heading-w1.json", artifactSha256: "c7b7768acbd70abe239252c4586ba0a4cf780a7c660b577e358854c2f22a3f6f", rawSha256: "50cffa2594b62f791185a111c0180f27a8871613e782cf5936b8580b7cb15483", configuredWorkers: 1, maxConcurrentTests: 1, testSeam: "disabled", outcomes: { discovered: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: [cohort[5]] },
  "single-camera-focus-w1": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/baseline/single-camera-focus-w1.json", artifactSha256: "9edf89952366de816b6e2b88aca00945a954caacd9d0192b237c6fed11f12984", rawSha256: "face0defdffb09641cea0d03501778e741677eac9ad43ab915fd7c47bda62106", configuredWorkers: 1, maxConcurrentTests: 1, testSeam: "disabled", outcomes: { discovered: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: [cohort[7]] },
  "single-renderer-identity-w1": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/baseline/single-renderer-identity-w1.json", artifactSha256: "f680278b7fe10af2b0a01d3cb2a0744cac822416ae76f1cbf16c6feca3cebb52", rawSha256: "5e1913392ac1ed11b41cca00fd4be954c6823dd72f763a81890f672db7de6c5c", configuredWorkers: 1, maxConcurrentTests: 1, testSeam: "controlled-webgl-failure-recovery", outcomes: { discovered: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: [cohort[4]] },
  "single-viewport-geometry-w1": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/baseline/single-viewport-geometry-w1.json", artifactSha256: "7d63d304540a3e024276becaeb79467a64b5959fd55143fe06c31baaa7377865", rawSha256: "7e1d71996741fc6025026203aca898e8a096512d2816a71e7287ae8d2da61482", configuredWorkers: 1, maxConcurrentTests: 1, testSeam: "disabled", outcomes: { discovered: 1, passed: 0, failed: 1, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: [cohort[9]] },
  "five-representatives-w1": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/baseline/five-representatives-w1.json", artifactSha256: "f5672503b2c7c46c9ba8de5805e6c7e797b8e5f4fa8bced6a98063a8efffdcd7", rawSha256: "4716459832a62a7da050cf1292f0d66f53482656901b6c52b603540d08546624", configuredWorkers: 1, maxConcurrentTests: 1, testSeam: "controlled-webgl-failure-recovery", outcomes: { discovered: 5, passed: 4, failed: 1, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: fiveRepresentatives },
  "cohort-w1": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/baseline/cohort-w1.json", artifactSha256: "70a1f373788ff869a87a6e93d1f0d698e081e355183fc1004e75a0f3f097670e", rawSha256: "c5541d74a54aff8600d7cfb677614371f57602fec2c7f00c9cdb0c919f0936d7", configuredWorkers: 1, maxConcurrentTests: 1, testSeam: "controlled-webgl-failure-recovery", outcomes: { discovered: 12, passed: 11, failed: 1, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: cohort },
  "cohort-w2": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/baseline/cohort-w2.json", artifactSha256: "ecfb0a666ec463ff94e357ac34ed4d9d3ae36700bf0dfd9c1167cb571bde9d44", rawSha256: "22b7a6d7e21282a48a1b2a7efd413a3dedd3125302ec61e52559b97ee7b5444b", configuredWorkers: 2, maxConcurrentTests: 2, testSeam: "controlled-webgl-failure-recovery", outcomes: { discovered: 12, passed: 9, failed: 3, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: cohort },
  "cohort-w4": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/baseline/cohort-w4.json", artifactSha256: "459d8edc8674b613ca24a5ce5a72045a30dee116e93fe0e77132eafaaee51f78", rawSha256: "cc3611e166ff77cc8ab1d7dc8a29d6eac56274efb82f0973738b0ab65a8b357e", configuredWorkers: 4, maxConcurrentTests: 4, testSeam: "controlled-webgl-failure-recovery", outcomes: { discovered: 12, passed: 4, failed: 8, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: cohort },
  "trace-subset-w4": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/diagnostics/trace-subset-w4.json", artifactSha256: "f52c963b53ade2be9477dddd58a7a31b63f71d4d1aaff4eeb384e0298337e336", rawSha256: "419f5beb58c0b821f23b38b9978bc6d08691ec1bee318c55b684842d2eb71b35", configuredWorkers: 4, maxConcurrentTests: 4, testSeam: "controlled-webgl-failure-recovery", outcomes: { discovered: 6, passed: 3, failed: 3, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: traceSubset },
  "light-peer-w4": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/comparison/light-peer-w4.json", artifactSha256: "3a748521129eea01690b0d6a826bba637899e4b51fc94f45cc5e7ffa39731d99", rawSha256: "89ba871ee8ec4c8d1b80cbacef7de8ef9d82fb5943f684f1ec1be1436ccbe0f9", configuredWorkers: 4, maxConcurrentTests: 4, testSeam: "disabled", outcomes: { discovered: 4, passed: 4, failed: 0, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: lightPeers },
  "heavy-peer-w4": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/comparison/heavy-peer-w4.json", artifactSha256: "c232274ed82c77314f1ca872dbbea86d23952d1fea1d63af3c229d21c8c34a8c", rawSha256: "c7859db6ec761b04d687d9d5b53cd6f93eca2c3de05633cb4d0e604ee096f15c", configuredWorkers: 4, maxConcurrentTests: 4, testSeam: "disabled", outcomes: { discovered: 4, passed: 1, failed: 3, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: heavyPeers },
  "lifecycle-rtt-spa-w1": { artifactPath: "docs/architecture/ground-glass-m7m-scene-readiness/validation/lifecycle-rtt-spa-w1.json", artifactSha256: "58112f1418de1b80a569b244c8e9b7e2b2967abf780a2a5fc5701e636ed88f30", rawSha256: "ac3c375575044455d5d2d5472d2971879603c2b65132cf5ad4ae1548853d9e6d", configuredWorkers: 1, maxConcurrentTests: 1, testSeam: "disabled", outcomes: { discovered: 2, passed: 2, failed: 0, skipped: 0, flaky: 0, incomplete: 0, retries: 0 }, identities: lifecycle },
});

export const GROUND_GLASS_M7M_REQUIRED_EXPERIMENT_IDS = Object.keys(GROUND_GLASS_M7M_EXPECTED_EXPERIMENTS);

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown): string => typeof value === "string" ? value : "";
const asNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const sorted = (values: readonly string[]): string[] => [...values].sort();
const sameStrings = (left: readonly string[], right: readonly string[]): boolean => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;
const issueOnce = (issues: string[], issue: string): void => { if (!issues.includes(issue)) issues.push(issue); };
const canonicalSha256 = (value: unknown): string => createHash("sha256")
  .update(JSON.stringify(value, null, 2) + "\n", "utf8")
  .digest("hex");

type NormalizedTest = Readonly<{ identity: string; status: string; projectName: string; attempts: readonly JsonRecord[] }>;
type NormalizedSummary = Readonly<{ discovered: number; passed: number; failed: number; skipped: number; flaky: number; incomplete: number; retries: number; maxConcurrentTests: number }>;

const normalizedTests = (value: unknown): NormalizedTest[] => {
  if (!isRecord(value)) return [];
  return asArray(value.tests).filter(isRecord).map((test) => ({
    identity: asString(test.identity),
    status: asString(test.status),
    projectName: asString(test.projectName),
    attempts: asArray(test.attempts).filter(isRecord),
  }));
};
const summarize = (value: unknown): NormalizedSummary => {
  const tests = normalizedTests(value);
  const statuses = tests.map((test) => test.status);
  const attemptRows = tests.flatMap((test) => test.attempts);
  const events = attemptRows.flatMap((attempt) => {
    const start = asNumber(attempt.startOffsetMs);
    const duration = asNumber(attempt.durationMs);
    if (start === null || duration === null) return [];
    return [{ time: start, delta: 1 }, { time: start + duration, delta: -1 }];
  }).sort((left, right) => left.time - right.time || left.delta - right.delta);
  let active = 0;
  let maximum = 0;
  for (const event of events) {
    active += event.delta;
    maximum = Math.max(maximum, active);
  }
  return {
    discovered: tests.length,
    passed: statuses.filter((status) => status === "expected" || status === "passed").length,
    failed: statuses.filter((status) => status === "unexpected" || status === "failed" || status === "timedOut" || status === "interrupted").length,
    skipped: statuses.filter((status) => status === "skipped").length,
    flaky: statuses.filter((status) => status === "flaky").length,
    incomplete: tests.filter((test) => test.attempts.length === 0 || test.status === "interrupted" || test.status === "timedOut").length,
    retries: attemptRows.reduce((sum, attempt) => sum + (asNumber(attempt.retry) ?? 0), 0),
    maxConcurrentTests: maximum,
  };
};

const sameOutcomes = (actual: NormalizedSummary, expected: ExpectedExperiment["outcomes"]): boolean =>
  Object.entries(expected).every(([key, value]) => actual[key as keyof NormalizedSummary] === value);

const historicalCandidateIds = (inventoryValue: unknown): string[] => {
  const inventory = isRecord(inventoryValue) ? inventoryValue : {};
  return asArray(inventory.outcomes).filter(isRecord).map((entry) => asString(entry.testId))
    .filter((id) => GROUND_GLASS_M7M_REQUIRED_COHORT_IDENTITIES.includes(id as typeof cohort[number]));
};

export const evaluateGroundGlassM7mSceneReadiness = (
  reportValue: unknown,
  evidence: GroundGlassM7mEvidence,
): GroundGlassM7mEvaluation => {
  const issues: string[] = [];
  const report = isRecord(reportValue) ? reportValue : {};
  const historicalM7k = isRecord(evidence.historicalM7k) ? evidence.historicalM7k : {};
  const historicalM7l = isRecord(evidence.historicalM7l) ? evidence.historicalM7l : {};
  const inventory = isRecord(evidence.historicalInventory) ? evidence.historicalInventory : {};
  const integrityStart = issues.length;

  if (report.schemaVersion !== 1 || report.reportId !== GROUND_GLASS_M7M_REPORT_ID) issueOnce(issues, "report-identity-mismatch");
  if (report.evaluatorRevision !== GROUND_GLASS_M7M_EVALUATOR_REVISION) issueOnce(issues, "evaluator-revision-mismatch");
  if (report.baseCommitSha !== GROUND_GLASS_M7M_BASE_COMMIT_SHA || report.candidateCommitSha !== GROUND_GLASS_M7M_BASE_COMMIT_SHA ||
      report.executionSourceCommitSha !== GROUND_GLASS_M7M_EXECUTION_SOURCE_SHA || report.toolingCommitSha !== GROUND_GLASS_M7M_BASE_COMMIT_SHA) {
    issueOnce(issues, "source-identity-mismatch");
  }
  if (!evidence.sourceCommitAvailable) issueOnce(issues, "execution-source-commit-unavailable");
  if (report.normalizationImplementationRevision !== GROUND_GLASS_M7M_NORMALIZER_REVISION) issueOnce(issues, "normalizer-revision-mismatch");

  const m7k = isRecord(report.historicalM7k) ? report.historicalM7k : {};
  if (evidence.historicalM7kSha256 !== GROUND_GLASS_M7M_M7K_REPORT_SHA256 || m7k.reportSha256 !== GROUND_GLASS_M7M_M7K_REPORT_SHA256 ||
      historicalM7k.reportId !== "ground-glass-m7k-broad-e2e-qualification" || historicalM7k.evaluatorRevision !== "m7k-broad-e2e-qualification-evaluator-v1") {
    issueOnce(issues, "historical-m7k-report-identity-or-digest-mismatch");
  }
  const historicalIdentityList = asArray(m7k.identityList).filter((entry): entry is string => typeof entry === "string");
  if (m7k.candidateIdentityCount !== cohort.length || historicalIdentityList.length !== cohort.length || !unique(historicalIdentityList) || !sameStrings(historicalIdentityList, cohort)) {
    issueOnce(issues, "historical-candidate-identity-claim-mismatch");
  }
  const counts = isRecord(historicalM7k.execution) && isRecord(historicalM7k.execution.combinedOutcomes)
    ? historicalM7k.execution.combinedOutcomes : {};
  const reportCounts = isRecord(m7k.fullSuiteCounts) ? m7k.fullSuiteCounts : {};
  if (counts.discovered !== 278 || counts.passed !== 121 || counts.unexpected !== 82 || counts.skipped !== 75 || counts.flaky !== 0 || counts.incomplete !== 0 ||
      reportCounts.discovered !== 278 || reportCounts.passed !== 121 || reportCounts.unexpected !== 82 || reportCounts.skipped !== 75) {
    issueOnce(issues, "historical-m7k-full-suite-counts-mismatch");
  }
  const historicalExecution = isRecord(historicalM7k.execution) ? historicalM7k.execution : {};
  if (historicalExecution.sourceCommitSha !== "e6066a244510387c32995c1e973a771667b04d10") issueOnce(issues, "historical-m7k-source-mismatch");
  const historicalLanes = isRecord(historicalExecution.lanes) ? historicalExecution.lanes : {};
  const ordinaryLane = isRecord(historicalLanes.ordinary) ? historicalLanes.ordinary : {};
  const rendererSerialLane = isRecord(historicalLanes.rendererSerial) ? historicalLanes.rendererSerial : {};
  if (ordinaryLane.rawReportSha256 !== "95a7abebfaa7abe53805be7171d0ff84166dbb9e3e3d45eaa134a68f098963de" ||
      rendererSerialLane.rawReportSha256 !== "4be43aa1e68c5bd45d861092cf298db6f43e77576f3a338dc4533f162e32d71a") {
    issueOnce(issues, "historical-m7k-raw-digest-mismatch");
  }

  const m7l = isRecord(report.historicalM7l) ? report.historicalM7l : {};
  if (evidence.historicalM7lSha256 !== GROUND_GLASS_M7M_M7L_REPORT_SHA256 || m7l.reportSha256 !== GROUND_GLASS_M7M_M7L_REPORT_SHA256 ||
      historicalM7l.reportId !== "ground-glass-m7l-learning-drawer-remediation" ||
      historicalM7l.evaluatorRevision !== "m7l-learning-drawer-remediation-evaluator-v2") issueOnce(issues, "historical-m7l-report-identity-or-digest-mismatch");
  const m7lProvenance = isRecord(historicalM7l.rawCaptureProvenance) ? historicalM7l.rawCaptureProvenance : {};
  if (m7lProvenance.originalRawCaptureProvenance !== "unverified" || m7lProvenance.rawToNormalizedNormalization !== "unverified") {
    issueOnce(issues, "historical-m7l-provenance-limitations-overstated");
  }
  const declaredM7lLimitations = isRecord(m7l.provenanceLimitations) ? m7l.provenanceLimitations : {};
  if (m7l.inventorySha256 !== GROUND_GLASS_M7M_M7L_INVENTORY_SHA256 ||
      declaredM7lLimitations.originalRawCaptureProvenance !== "unverified" ||
      declaredM7lLimitations.rawToNormalizedNormalization !== "unverified" ||
      declaredM7lLimitations.rawPlaywrightCapturesRetainedForOfflineReplay !== false) {
    issueOnce(issues, "historical-m7l-provenance-or-inventory-claim-mismatch");
  }

  if (evidence.historicalInventorySha256 !== GROUND_GLASS_M7M_M7L_INVENTORY_SHA256 ||
      isRecord(report.historicalM7lInventory) && report.historicalM7lInventory.sha256 !== GROUND_GLASS_M7M_M7L_INVENTORY_SHA256) {
    issueOnce(issues, "historical-inventory-digest-mismatch");
  }
  const inventoryRows = asArray(inventory.outcomes).filter(isRecord);
  const inventoryAllIds = inventoryRows.map((entry) => asString(entry.testId));
  const inventoryIds = historicalCandidateIds(evidence.historicalInventory);
  if (inventory.historicalUnexpectedCount !== 82 || inventoryRows.length !== 82 || !unique(inventoryAllIds) ||
      inventoryIds.length !== cohort.length || !unique(inventoryIds) || !sameStrings(inventoryIds, cohort)) {
    issueOnce(issues, "historical-candidate-identity-set-mismatch");
  }
  const declaredCohort = asArray(isRecord(report.cohort) ? report.cohort.identities : []).filter((entry): entry is string => typeof entry === "string");
  if (declaredCohort.length !== cohort.length || !unique(declaredCohort) || !sameStrings(declaredCohort, cohort)) {
    issueOnce(issues, "cohort-identity-set-mismatch");
  }
  const discovery = isRecord(report.currentDiscovery) ? report.currentDiscovery : {};
  const ordinaryDiscovery = isRecord(discovery.ordinaryChromium) ? discovery.ordinaryChromium : {};
  const rendererSerialDiscovery = isRecord(discovery.rendererSerial) ? discovery.rendererSerial : {};
  const discoveredIdentities = asArray(discovery.selectedIdentities).filter((entry): entry is string => typeof entry === "string");
  if (ordinaryDiscovery.discoveredTests !== 274 || ordinaryDiscovery.specFiles !== 80 ||
      ordinaryDiscovery.discoveryListSha256 !== "1d24cc0fd985b3c2c41b83ab6c4880699eeeea81c1e4fb97bb8889a38736823d" ||
      rendererSerialDiscovery.discoveredTests !== 4 || rendererSerialDiscovery.specFiles !== 4 ||
      rendererSerialDiscovery.discoveryListSha256 !== "1db87b1ae129b443f369d8ed2538f635ab2289dc73a2cf5d34491339104ec39f" ||
      discovery.combinedDiscoveredTests !== 278 ||
      discovery.exactSelectedIdentityCount !== cohort.length || discovery.exactSelectedIdentitySetMatchesHistoricalM7l !== true ||
      discovery.fullApplicationDiscoveryClaimed !== false || discoveredIdentities.length !== cohort.length ||
      !sameStrings(discoveredIdentities, cohort)) issueOnce(issues, "current-discovery-identity-or-provenance-mismatch");

  const experimentRecords = asArray(report.experiments).filter(isRecord);
  const ids = experimentRecords.map((entry) => asString(entry.id));
  if (!unique(ids) || !sameStrings(ids, GROUND_GLASS_M7M_REQUIRED_EXPERIMENT_IDS)) issueOnce(issues, "experiment-id-set-mismatch");

  const workerOutcomes: Record<string, NormalizedSummary> = {};
  for (const [id, expected] of Object.entries(GROUND_GLASS_M7M_EXPECTED_EXPERIMENTS)) {
    const experiment = experimentRecords.find((entry) => entry.id === id);
    const artifact = evidence.experiments[id];
    if (!experiment || !artifact) {
      issueOnce(issues, "experiment-artifact-missing:" + id);
      continue;
    }
    const value = isRecord(artifact.value) ? artifact.value : {};
    const rawCapture = isRecord(value.rawCapture) ? value.rawCapture : {};
    const config = isRecord(value.config) ? value.config : {};
    const actual = summarize(value);
    workerOutcomes[id] = actual;
    if (experiment.artifactPath !== expected.artifactPath || experiment.artifactSha256 !== expected.artifactSha256 ||
        artifact.sha256 !== expected.artifactSha256 || canonicalSha256(value) !== expected.artifactSha256) {
      issueOnce(issues, "normalized-artifact-digest-or-path-mismatch:" + id);
    }
    if (value.schema !== "m7m-playwright-outcomes-v1" || value.normalizerRevision !== GROUND_GLASS_M7M_NORMALIZER_REVISION || value.captureId !== id ||
        value.executionSourceCommitSha !== GROUND_GLASS_M7M_EXECUTION_SOURCE_SHA) issueOnce(issues, "normalized-artifact-identity-mismatch:" + id);
    if (rawCapture.sha256 !== expected.rawSha256 || experiment.recordedSourceCaptureSha256 !== expected.rawSha256 ||
        rawCapture.retention !== "private-local-only" || rawCapture.offlineReplayAvailable !== false) {
      issueOnce(issues, "raw-capture-digest-or-retention-mismatch:" + id);
    }
    if (config.configuredWorkers !== expected.configuredWorkers || experiment.configuredWorkers !== expected.configuredWorkers ||
        config.configuredRetries !== 0 || experiment.configuredRetries !== 0 || config.testSeam !== expected.testSeam ||
        experiment.testSeam !== expected.testSeam) issueOnce(issues, "experiment-config-mismatch:" + id);
    const actualTests = normalizedTests(value);
    const actualIds = actualTests.map((test) => test.identity);
    if (actualIds.length !== expected.identities.length || !unique(actualIds) || !sameStrings(actualIds, expected.identities)) {
      issueOnce(issues, "experiment-test-identity-set-mismatch:" + id);
    }
    if (experiment.projectName !== "chromium" || actualTests.some((test) => test.projectName !== "chromium")) {
      issueOnce(issues, "experiment-project-mismatch:" + id);
    }
    if (!sameOutcomes(actual, expected.outcomes) || experiment.outcomes && !sameOutcomes(actual, experiment.outcomes as ExpectedExperiment["outcomes"]) ||
        actual.maxConcurrentTests !== expected.maxConcurrentTests || experiment.maxConcurrentTests !== expected.maxConcurrentTests) {
      issueOnce(issues, "experiment-outcomes-or-concurrency-mismatch:" + id);
    }
    if (actualTests.some((test) => test.attempts.some((attempt) => attempt.retry !== 0))) issueOnce(issues, "unexpected-retry-present:" + id);
    if (expected.configuredWorkers === 1 && actual.maxConcurrentTests !== 1) issueOnce(issues, "single-worker-capture-overlapped:" + id);
  }

  const declaredRows = asArray(isRecord(report.cohort) ? report.cohort.outcomes : []).filter(isRecord);
  const declaredIdentities = declaredRows.map((row) => asString(row.identity));
  if (declaredRows.length !== cohort.length || !unique(declaredIdentities)) issueOnce(issues, "cohort-outcome-row-identity-set-mismatch");
  const matrixById = new Map(declaredRows.map((row) => [asString(row.identity), row]));
  for (const identity of cohort) {
    const declared = matrixById.get(identity);
    if (!declared) {
      issueOnce(issues, "cohort-result-missing:" + identity);
      continue;
    }
    for (const id of ["cohort-w1", "cohort-w2", "cohort-w4"] as const) {
      const test = normalizedTests(evidence.experiments[id]?.value).find((entry) => entry.identity === identity);
      const resultStatus = test?.status === "expected" || test?.status === "passed" ? "passed" :
        test?.status === "skipped" ? "skipped" : test?.attempts.length ? "failed" : "incomplete";
      const recorded = isRecord(declared.workers) ? declared.workers[id] : undefined;
      if (recorded !== resultStatus) issueOnce(issues, "cohort-outcome-claim-mismatch:" + identity + ":" + id);
    }
    const history = inventoryRows.find((row) => row.testId === identity);
    if (!history || declared.historicalFailureSignature !== history.failureSignature || declared.verifiedFixed !== false) {
      issueOnce(issues, "cohort-historical-signature-or-fix-classification-mismatch:" + identity);
    }
    const workerClaims = isRecord(declared.workers) ? declared.workers : {};
    const expectedClassification = identity === cohort[9] ? "separate-failure-mechanism" :
      [workerClaims["cohort-w1"], workerClaims["cohort-w2"], workerClaims["cohort-w4"]].every((status) => status === "passed")
        ? "currently-passed-not-verified-fixed" : "environment-sensitive";
    if (declared.classification !== expectedClassification) issueOnce(issues, "cohort-classification-mismatch:" + identity);
  }

  const provenance = isRecord(report.rawCaptureProvenance) ? report.rawCaptureProvenance : {};
  if (provenance.persistedNormalizedIntegrity !== "verified" || provenance.originalRawCaptureProvenance !== "unverified" ||
      provenance.rawToNormalizedReplay !== "unverified" || provenance.rawFilesRetainedForOfflineReplay !== false) {
    issueOnce(issues, "raw-capture-provenance-overstated");
  }
  const remediation = isRecord(report.remediation) ? report.remediation : {};
  if (remediation.verifiedFixCount !== 0 || !Array.isArray(remediation.verifiedFixes) || remediation.verifiedFixes.length !== 0 ||
      !Array.isArray(remediation.changedApplicationFiles) || remediation.changedApplicationFiles.length !== 0 || remediation.assertionsChanged !== false) {
    issueOnce(issues, "unsupported-remediation-claim");
  }
  const currentlyPassed = declaredRows.filter((row) => row.classification === "currently-passed-not-verified-fixed").map((row) => asString(row.identity));
  if (!sameStrings(asArray(remediation.currentlyPassedNotVerifiedFixed).filter((entry): entry is string => typeof entry === "string"), currentlyPassed)) {
    issueOnce(issues, "current-pass-classification-list-mismatch");
  }
  const diagnosis = isRecord(report.diagnosis) ? report.diagnosis : {};
  if (diagnosis.sharedRootCauseEstablished !== false || !Array.isArray(diagnosis.supportedCauses) || diagnosis.supportedCauses.length !== 0) {
    issueOnce(issues, "unsupported-causal-claim");
  }
  const qualification = isRecord(report.qualification) ? report.qualification : {};
  if (qualification.cohortStatus !== "worker-sensitive-unresolved" || qualification.fullBroadE2eStatus !== "not-qualified" ||
      qualification.fullBroadE2eRun !== "not-run" || qualification.m7Overall !== "partially-qualified" ||
      qualification.m8Entry !== "denied" || qualification.productionGroundGlass !== "WebGL-only" ||
      qualification.productionWebGpuEnabled !== false || qualification.externalGpuDeviceLoss !== "blocked" ||
      qualification.m5q !== "partially-qualified" || qualification.m6 !== "development-only") {
    issueOnce(issues, "qualification-boundary-mismatch");
  }

  const artifactIssues = issues.slice(integrityStart).filter((issue) =>
    issue.startsWith("experiment-") || issue.startsWith("normalized-artifact-") || issue.startsWith("raw-capture-") || issue.startsWith("unexpected-retry-") || issue.startsWith("single-worker-") || issue.startsWith("cohort-outcome-claim-") || issue.startsWith("cohort-result-missing:"));
  const cohortOutcomes = [workerOutcomes["cohort-w1"], workerOutcomes["cohort-w2"], workerOutcomes["cohort-w4"]];
  const executionCompleteness = cohortOutcomes.every((outcome) => outcome?.discovered === cohort.length && outcome.incomplete === 0 && outcome.skipped === 0)
    ? "complete" : "incomplete";
  const passed = issues.length === 0;
  return {
    reportId: GROUND_GLASS_M7M_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7M_EVALUATOR_REVISION,
    passed,
    evidenceIntegrity: passed ? "passed" : "failed",
    normalizedArtifactIntegrity: artifactIssues.length === 0 ? "passed" : "failed",
    executionCompleteness,
    cohortStatus: executionCompleteness === "complete" ? "worker-sensitive-unresolved" : "incomplete",
    candidateIdentityCount: cohort.length,
    verifiedFixCount: 0,
    cohortWorkerOutcomes: Object.fromEntries(Object.entries(workerOutcomes).filter(([id]) => id.startsWith("cohort-"))),
    fullBroadE2eQualification: "not-qualified",
    m7Overall: "partially-qualified",
    m8Entry: "denied",
    productionWebGpuEnabled: false,
    issues,
  };
};
