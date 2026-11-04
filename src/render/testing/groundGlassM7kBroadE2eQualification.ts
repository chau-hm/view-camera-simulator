import {
  deriveGroundGlassM7hPlaywrightReportOutcomes,
  type GroundGlassM7hTest,
} from "./groundGlassM7hBroadE2eTriage";

export const GROUND_GLASS_M7K_REPORT_ID = "ground-glass-m7k-broad-e2e-qualification" as const;
export const GROUND_GLASS_M7K_LEGACY_EVALUATOR_REVISION = "m7k-broad-e2e-qualification-evaluator-v1" as const;
export const GROUND_GLASS_M7K_EVALUATOR_REVISION = "m7k-broad-e2e-qualification-evaluator-v2" as const;
export const GROUND_GLASS_M7K_MUTATION_SUITE_REVISION = "m7k-broad-e2e-mutations-v2" as const;
export const GROUND_GLASS_M7K_BASE_COMMIT_SHA = "e6066a244510387c32995c1e973a771667b04d10" as const;
export const GROUND_GLASS_M7K_EXECUTION_SOURCE_SHA = "e6066a244510387c32995c1e973a771667b04d10" as const;
export const GROUND_GLASS_M7K_M7G_SOURCE_SHA = "095d9725a1ddb272bf780bd5e7e9e2a2b8f61837" as const;
export const GROUND_GLASS_M7K_M7G_RAW_SHA256 =
  "393d1360f32a85c83664ca3ed7ec4d5bec217e77edd8045f4ace61b054ae32d6" as const;
export const GROUND_GLASS_M7K_M7H_REPORT_SHA256 =
  "88545c33a32ed57f6ebbf5bdfbcf9e1320cca32d918c2c08d3fbee1c4efc72d8" as const;
export const GROUND_GLASS_M7K_M7I_REPORT_SHA256 =
  "486f1c7ac010cd4d4fbede55fdb669f448c26adfaaee6de5717814ddff9bccde" as const;
export const GROUND_GLASS_M7K_M7J_REPORT_PATH =
  "docs/architecture/GROUND_GLASS_M7J_FOUR_WORKER_STABILITY_REPORT.json" as const;
export const GROUND_GLASS_M7K_M7J_DISCOVERY_PATH =
  "docs/architecture/ground-glass-m7j-four-worker/validation/controlled-chromium-discovery.txt" as const;
export const GROUND_GLASS_M7K_M7J_SERIAL_DISCOVERY_PATH =
  "docs/architecture/ground-glass-m7j-four-worker/validation/renderer-serial-project-discovery.txt" as const;
export const GROUND_GLASS_M7K_HISTORICAL_ARTIFACT_PATHS = Object.freeze([
  "docs/architecture/GROUND_GLASS_M7G_R187_LIFECYCLE_CONSOLIDATION_REPORT.json",
  "docs/architecture/ground-glass-m7g-r187/validation/broad-e2e-playwright.json",
  "docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json",
  "docs/architecture/GROUND_GLASS_M7I_BROAD_E2E_REMEDIATION_REPORT.json",
  GROUND_GLASS_M7K_M7J_REPORT_PATH,
  GROUND_GLASS_M7K_M7J_DISCOVERY_PATH,
  GROUND_GLASS_M7K_M7J_SERIAL_DISCOVERY_PATH,
]);
export const GROUND_GLASS_M7K_LANE_NAMES = ["ordinary", "rendererSerial"] as const;
export const GROUND_GLASS_M7K_REQUIRED_RENDERER_TESTS = [
  "camera-controls-compact.spec.ts::camera control rows keep useful rendered tracks across rail widths",
  "fringe-club-dev-integration.spec.ts::Stage 2N-A Observer and RTT instances survive independent sibling removal",
  "scene-view-focus.spec.ts::View Focus preserves independent Scene and Camera views and resets the active preset",
  "table-tilt.spec.ts::Table Tilt RTT survives focus, preview, zoom, quality, and tilt resource stress",
] as const;
export const GROUND_GLASS_M7K_REQUIRED_MUTATION_CASES = [
  "ordinary-lane-missing",
  "renderer-serial-lane-missing",
  "renderer-serial-dependency-skipped",
  "same-test-counted-in-both-lanes",
  "ordinary-test-attributed-to-serial-project",
  "tagged-test-omitted",
  "removed-test-counted-as-passed",
  "duplicate-identity-counted-twice",
  "partial-discovery-labeled-complete",
  "unexpected-failure-changed-to-expected",
  "expected-failure-counted-as-actual-pass",
  "skipped-test-counted-as-passed",
  "interrupted-test-counted-as-passed",
  "timed-out-test-counted-as-passed",
  "retry-dependent-pass-called-deterministic",
  "corrupted-raw-report-digest",
  "raw-summary-counts-disagree",
  "baseline-attributed-to-candidate",
  "mismatched-browser-environment",
  "browser-version-disagrees-with-runtime-capture",
  "three-revision-disagrees-with-runtime-capture",
  "serial-one-worker-relabeled-as-four-worker-stability",
  "ordinary-four-workers-mislabeled-as-serial",
  "missing-invocation-exit-code",
  "process-failure-hidden-by-orchestrator",
  "dependency-skipped-project-marked-executed",
  "native-webgpu-in-ordinary-qualification",
  "production-preview-in-wrong-inventory",
  "unreviewed-skip-exclusion-qualified",
  "complete-failing-suite-qualified",
  "274-tests-called-complete-278-suite",
  "broad-qualification-authorizes-m8",
  "broad-qualification-enables-production-webgpu",
  "squash-merge-sha-replaces-execution-source",
  "v2-missing-playwright-version",
  "v2-missing-browser-version",
  "v2-missing-three-version",
  "v2-wrong-three-version",
  "v2-evaluator-sha-missing",
  "v2-tooling-sha-attributed-to-execution-source",
  "v2-evaluator-sha-attributed-to-execution-source",
  "v2-tooling-source-file-unavailable",
  "v2-evaluator-source-file-unavailable",
  "v2-selected-capture-cannot-qualify",
  "v2-raw-artifact-path-escapes-output-directory",
  "positive-complete-passing-two-lane-report",
  "positive-complete-failing-report-not-qualified",
  "positive-reviewed-skip-exclusion-policy",
  "positive-partial-report-labeled-incomplete",
  "positive-historical-m7g-failure-record",
  "positive-four-test-serial-lane",
  "v2-accepted-full-capture-remains-valid",
] as const;

type JsonRecord = Record<string, unknown>;
export type GroundGlassM7kArtifact = Readonly<{ sha256: string; value: unknown }>;
export type GroundGlassM7kArtifacts = Readonly<Record<string, GroundGlassM7kArtifact>>;
export type GroundGlassM7kArtifactReference = Readonly<{ path: string; sha256: string }>;
export type GroundGlassM7kLaneName = typeof GROUND_GLASS_M7K_LANE_NAMES[number];

export type GroundGlassM7kCaptureLane = Readonly<{
  projectName: string;
  command: string;
  exitCode: number | null;
  rawReportPath: string;
  rawReportSha256: string;
  consolePath: string;
  consoleSha256: string;
  serverPort: number;
  invocationStatus: "executed" | "not-started" | "failed-to-start";
  discoveredTestIdentities?: readonly string[];
}>;

export type GroundGlassM7kCaptureManifest = Readonly<{
  schemaVersion: 1 | 2;
  baseCommitSha: string;
  executionSourceCommitSha: string;
  toolingCommitSha?: string;
  evaluationCommitSha: string;
  captureMode?: "full" | "selected";
  outputDirectory?: string;
  selection?: Readonly<{ ordinaryGrep: string; rendererSerialGrep: string }> | null;
  toolingSourcePath?: string;
  evaluatorSourcePath?: string;
  generatedAt: string;
  environment: JsonRecord;
  discovery: Readonly<{
    ordinary: Readonly<{ projectName: string; command: string; exitCode: number; outputPath: string; outputSha256: string }>;
    rendererSerial: Readonly<{ projectName: string; command: string; exitCode: number; outputPath: string; outputSha256: string }>;
  }>;
  lanes: Readonly<Partial<Record<GroundGlassM7kLaneName, GroundGlassM7kCaptureLane>>>;
  approvedSkipExclusions?: readonly JsonRecord[];
  validation: JsonRecord;
}>;

export type GroundGlassM7kEvaluation = Readonly<{
  reportId: string;
  evaluatorRevision: string;
  passed: boolean;
  evidenceIntegrity: "passed" | "failed";
  executionCompleteness: "complete" | "incomplete";
  ordinaryLane: "passed" | "failed" | "incomplete";
  rendererSerialLane: "passed" | "failed" | "incomplete";
  broadE2eQualification: "qualified" | "not-qualified" | "blocked";
  m7Overall: "partially-qualified";
  m8Entry: "denied";
  productionWebGpuEnabled: false;
  counts: Readonly<{
    discovered: number;
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
    incomplete: number;
    historicalFailures: number;
    historicalNowPassing: number;
    historicalStillFailing: number;
    newUnexpectedFailures: number;
  }>;
  issues: readonly string[];
}>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown): string => typeof value === "string" ? value : "";
const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const sha = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
const sha256 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const basename = (value: string): string => value.replaceAll("\\", "/").split("/").pop() ?? value;
const sort = (values: readonly string[]): string[] => [...values].sort();
const sameStrings = (left: readonly string[], right: readonly string[]): boolean =>
  JSON.stringify(sort(left)) === JSON.stringify(sort(right));
const sameValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
const safeRelativeSegments = (value: string): string[] | null => {
  const normalized = value.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return null;
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  return segments;
};
const isInsideRelativeDirectory = (directory: string, path: string): boolean => {
  const directorySegments = safeRelativeSegments(directory);
  const pathSegments = safeRelativeSegments(path);
  return Boolean(directorySegments && pathSegments && pathSegments.length > directorySegments.length &&
    directorySegments.every((segment, index) => segment === pathSegments[index]));
};
const canonicalTestId = (test: GroundGlassM7hTest): string =>
  test.testId.split("::").slice(1).join("::");
const rawIdentity = (file: string, describePath: readonly string[], title: string): string =>
  [basename(file), ...describePath, title].filter(Boolean).join("::");
const normalizedSuitePath = (path: readonly string[], file: string): string[] =>
  path.filter((part) => part && part !== file && part !== "src/tests/e2e");

export const parseGroundGlassM7kDiscoveryOutput = (value: unknown, expectedProject: string): Readonly<{
  identities: string[];
  files: string[];
  issues: string[];
}> => {
  const issues: string[] = [];
  if (typeof value !== "string") return { identities: [], files: [], issues: ["discovery-output-not-text"] };
  const identities: string[] = [];
  const files: string[] = [];
  const lines = value.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s+\[([^\]]+)\]\s+›\s+(.+?):\d+:\d+\s+›\s+(.*)$/);
    if (!match) continue;
    const [, projectName, sourceFile, fullTitlePath] = match;
    if (projectName !== expectedProject) {
      issues.push(`discovery-project-mismatch:${projectName}`);
      continue;
    }
    const file = basename(sourceFile);
    const titlePath = fullTitlePath.split(/\s+›\s+/).map((part) => part.trim()).filter(Boolean);
    if (!file || titlePath.length === 0) {
      issues.push("discovery-identity-malformed");
      continue;
    }
    identities.push(`${file}::${titlePath.join("::")}`);
    files.push(file);
  }
  const duplicated = identities.filter((identity, index) => identities.indexOf(identity) !== index);
  if (duplicated.length > 0) issues.push("duplicate-discovery-identities");
  if (identities.some((identity) => basename(identity.split("::")[0]).endsWith("-production.spec.ts") ||
      identity.startsWith("chromium-production-preview::"))) issues.push("production-preview-test-in-development-inventory");
  return {
    identities: sort(identities),
    files: sort([...new Set(files)]),
    issues: [...new Set(issues)],
  };
};

const referenceFor = (path: string, artifacts: GroundGlassM7kArtifacts): GroundGlassM7kArtifactReference => ({
  path,
  sha256: artifacts[path]?.sha256 ?? "",
});

const readReferencedValue = (
  reference: unknown,
  artifacts: GroundGlassM7kArtifacts,
  issues: string[],
  label: string,
): unknown => {
  if (!isRecord(reference)) {
    issues.push(`artifact-reference-missing:${label}`);
    return null;
  }
  const path = asString(reference.path);
  const digest = asString(reference.sha256);
  const artifact = artifacts[path];
  if (!path || !artifact) {
    issues.push(`artifact-missing:${label}`);
    return null;
  }
  if (!sha256(digest) || artifact.sha256 !== digest) {
    issues.push(`artifact-digest-mismatch:${label}`);
    return null;
  }
  return artifact.value;
};

const countLaneOutcomes = (tests: readonly GroundGlassM7hTest[]): JsonRecord => ({
  discovered: tests.length,
  passed: tests.filter((test) => test.actualPass).length,
  failed: tests.filter((test) => test.resultStatus === "unexpected").length,
  expectedFailure: tests.filter((test) => test.expectedStatus === "failed" &&
    (test.actualStatus === "failed" || test.actualStatus === "timedOut")).length,
  actualFailed: tests.filter((test) => test.actualStatus === "failed").length,
  timedOut: tests.filter((test) => test.attemptStatuses.includes("timedOut")).length,
  interrupted: tests.filter((test) => test.attemptStatuses.includes("interrupted")).length,
  skipped: tests.filter((test) => test.resultStatus === "skipped").length,
  flaky: tests.filter((test) => test.resultStatus === "flaky").length,
  incomplete: tests.filter((test) => test.resultStatus === "incomplete").length,
  retries: tests.reduce((total, test) => total + test.retryCount, 0),
  expected: tests.filter((test) => test.resultStatus === "expected").length,
  unexpected: tests.filter((test) => test.resultStatus === "unexpected").length,
});

const testDisposition = (test: GroundGlassM7hTest): string => {
  if (test.actualPass) return "passed";
  if (test.resultStatus === "skipped") return "skipped";
  if (test.resultStatus === "flaky") return "flaky";
  if (test.resultStatus === "incomplete") return "incomplete";
  if (test.attemptStatuses.includes("interrupted")) return "interrupted";
  if (test.actualStatus === "timedOut") return "timed-out";
  if (test.expectedStatus === "failed" && test.actualStatus === "failed") return "expected-failure";
  return "failed";
};

const buildRawTestMetadata = (reportValue: unknown): Map<string, JsonRecord> => {
  const metadata = new Map<string, JsonRecord>();
  const report = isRecord(reportValue) ? reportValue : {};
  const visit = (suiteValue: unknown, parents: readonly string[]): void => {
    if (!isRecord(suiteValue)) return;
    const fileValue = asString(suiteValue.file);
    const file = fileValue ? basename(fileValue) : asString(suiteValue.title);
    const path = normalizedSuitePath([...parents, asString(suiteValue.title)], file);
    for (const specValue of asArray(suiteValue.specs)) {
      if (!isRecord(specValue)) continue;
      const specFile = asString(specValue.file) || file;
      const describePath = normalizedSuitePath(path, specFile);
      for (const testValue of asArray(specValue.tests)) {
        if (!isRecord(testValue)) continue;
        const projectName = asString(testValue.projectName) || asString(testValue.projectId);
        const identity = rawIdentity(specFile, describePath, asString(specValue.title));
        metadata.set(`${projectName}::${identity}`, {
          annotations: asArray(testValue.annotations),
          tags: [...asArray(specValue.tags), ...asArray(testValue.tags)]
            .filter((tag): tag is string => typeof tag === "string"),
          location: testValue.location,
        });
      }
    }
    for (const nested of asArray(suiteValue.suites)) visit(nested, path);
  };
  for (const suite of asArray(report.suites)) visit(suite, []);
  return metadata;
};

const getSkipAudit = (
  tests: readonly (GroundGlassM7hTest & { lane: GroundGlassM7kLaneName })[],
  rawByLane: Partial<Record<GroundGlassM7kLaneName, unknown>>,
  approvedValue: unknown,
): JsonRecord[] => {
  const approved = asArray(approvedValue).filter(isRecord);
  const exclusions = new Map(approved.map((entry) => [asString(entry.testId), entry]));
  return tests.filter((test) => test.resultStatus === "skipped").map((test) => {
    const identity = canonicalTestId(test);
    const metadata = buildRawTestMetadata(rawByLane[test.lane]).get(test.testId) ?? {};
    const annotation = asArray(metadata.annotations).map((entry) => isRecord(entry) ? entry : {})
      .find((entry) => entry.type === "skip");
    const reason = annotation ? asString(annotation.description) : "";
    const candidateExclusion = exclusions.get(identity);
    const exclusion = isGroundGlassM7kApprovedSkipExclusion(candidateExclusion) ? candidateExclusion : undefined;
    return {
      testId: identity,
      sourceSpec: basename(test.specFile),
      project: test.projectName,
      skipReason: reason || "unknown",
      skipMechanism: annotation ? "annotated-Playwright-skip" : "unknown",
      expectedOrUnexpected: test.expectedStatus === "skipped" && test.actualStatus === "skipped"
        ? "expected"
        : "unexpected",
      qualificationImpact: exclusion?.reviewStatus === "accepted"
        ? "explicitly-accepted-exclusion"
        : "blocks-qualification-unless-explicitly-accepted",
      approvedExclusion: exclusion ? {
        reviewStatus: asString(exclusion.reviewStatus),
        reason: asString(exclusion.reason),
        supportedScope: asString(exclusion.supportedScope),
      } : null,
    };
  });
};

const compareHistoricalFailures = (
  historicalTests: readonly GroundGlassM7hTest[],
  m7hReport: unknown,
  m7iReport: unknown,
  currentTests: readonly (GroundGlassM7hTest & { lane: GroundGlassM7kLaneName })[],
): Readonly<{ tests: JsonRecord[]; summary: JsonRecord }> => {
  const m7h = isRecord(m7hReport) ? m7hReport : {};
  const m7i = isRecord(m7iReport) ? m7iReport : {};
  const currentById = new Map(currentTests.map((test) => [canonicalTestId(test), test]));
  const historicalFailures = asArray(m7h.failureInventory).filter(isRecord);
  const m7hById = new Map(historicalFailures.map((entry) => [
    asString(entry.testId).replace(/^chromium::/, ""), entry,
  ]));
  const dispositionById = new Map<string, string>();
  for (const entry of asArray(m7i.unknownFailureInventory).filter(isRecord)) {
    dispositionById.set(asString(entry.testId).replace(/^chromium::/, ""), "unknown-not-verified-fixed");
  }
  for (const entry of asArray(m7i.tentativeDrawerInventory).filter(isRecord)) {
    dispositionById.set(asString(entry.testId).replace(/^chromium::/, ""), "tentative-not-reproduced-in-m7i");
  }
  for (const entry of asArray(m7i.partiallyAddressed).filter(isRecord)) {
    dispositionById.set(asString(entry.testId).replace(/^chromium::/, ""), "partially-addressed-in-m7i");
  }
  for (const entry of asArray(m7i.verifiedFixes).filter(isRecord)) {
    const kind = asString(entry.evidenceKind);
    dispositionById.set(asString(entry.testId).replace(/^chromium::/, ""),
      kind === "m7i-matched" ? "m7i-matched-verified-fix" : "m7h-verified-fix-inherited");
  }
  const failures = historicalTests.filter((test) => test.resultStatus === "unexpected" || test.resultStatus === "flaky");
  const comparisons = failures.map((historicalTest) => {
    const identity = canonicalTestId(historicalTest);
    const current = currentById.get(identity);
    const disposition = m7hById.get(identity) ?? {};
    return {
      testId: identity,
      historicalOutcome: historicalTest.resultStatus,
      historicalErrorSignature: asString(disposition.historicalErrorSignature) || historicalTest.errorCategory,
      historicalM7hDisposition: asString(disposition.remediationStatus) || "unclassified",
      m7iDisposition: dispositionById.get(identity) ?? "not-listed-in-m7i-dispositions",
      currentDiscovered: current !== undefined,
      currentLane: current?.lane ?? null,
      currentOutcome: current ? testDisposition(current) : "not-discovered",
      currentErrorSignature: current?.errorCategory ?? null,
      currentActualStatus: current?.actualStatus ?? null,
      causeConclusion: current?.actualPass
        ? "currently-passed-once; historical-cause-not-reassigned"
        : "no-new-causal-classification",
    };
  });
  const countBy = (predicate: (entry: JsonRecord) => boolean): number => comparisons.filter(predicate).length;
  const currentFailures = currentTests.filter((test) => test.resultStatus === "unexpected" || test.resultStatus === "flaky");
  const historicalIds = new Set(comparisons.map((entry) => asString(entry.testId)));
  const newUnexpected = currentFailures.filter((test) => !historicalIds.has(canonicalTestId(test)));
  const dispositionCounts: Record<string, number> = {};
  for (const entry of comparisons) {
    const label = asString(entry.m7iDisposition);
    dispositionCounts[label] = (dispositionCounts[label] ?? 0) + 1;
  }
  const errorSignatureCounts: Record<string, number> = {};
  for (const test of currentFailures) {
    errorSignatureCounts[test.errorCategory] = (errorSignatureCounts[test.errorCategory] ?? 0) + 1;
  }
  return {
    tests: comparisons,
    summary: {
      historicalFailureCount: comparisons.length,
      historicalCurrentlyPassed: countBy((entry) => entry.currentOutcome === "passed"),
      historicalStillFailing: countBy((entry) => entry.currentOutcome === "failed" ||
        entry.currentOutcome === "timed-out" || entry.currentOutcome === "expected-failure"),
      historicalCurrentlySkipped: countBy((entry) => entry.currentOutcome === "skipped"),
      historicalNotDiscovered: countBy((entry) => entry.currentOutcome === "not-discovered"),
      historicalDispositionCounts: dispositionCounts,
      currentUnexpectedFailureCount: currentFailures.length,
      newUnexpectedFailureCount: newUnexpected.length,
      newUnexpectedFailures: newUnexpected.map((test) => ({
        testId: canonicalTestId(test),
        lane: test.lane,
        actualStatus: test.actualStatus,
        errorSignature: test.errorCategory,
        errorMessage: test.errorMessage,
      })),
      currentFailureSignatureCounts: errorSignatureCounts,
      currentUnexpectedFailures: currentFailures.map((test) => ({
        testId: canonicalTestId(test),
        lane: test.lane,
        actualStatus: test.actualStatus,
        errorSignature: test.errorCategory,
        errorMessage: test.errorMessage,
      })),
    },
  };
};

const laneProjectName = (lane: GroundGlassM7kLaneName): string =>
  lane === "ordinary" ? "chromium" : "chromium-renderer-serial";
const laneWorkers = (lane: GroundGlassM7kLaneName): number => lane === "ordinary" ? 4 : 1;

const buildLane = (
  lane: GroundGlassM7kLaneName,
  captureValue: unknown,
  discoveryValue: unknown,
  artifacts: GroundGlassM7kArtifacts,
  approvedSkipIds: ReadonlySet<string>,
): Readonly<{ result: JsonRecord | null; tests: (GroundGlassM7hTest & { lane: GroundGlassM7kLaneName })[]; raw: unknown }> => {
  if (!isRecord(captureValue)) return { result: null, tests: [], raw: null };
  const rawReference = {
    path: captureValue.rawReportPath,
    sha256: captureValue.rawReportSha256,
  };
  const raw = isRecord(artifacts[asString(rawReference.path)])
    ? artifacts[asString(rawReference.path)].value
    : null;
  const outcome = deriveGroundGlassM7hPlaywrightReportOutcomes(raw, rawReference.sha256);
  const tests = outcome.tests.map((test) => ({ ...test, lane }));
  const discoveryOutput = isRecord(discoveryValue) ? asString(discoveryValue.text) : asString(discoveryValue);
  const discovery = parseGroundGlassM7kDiscoveryOutput(discoveryOutput, laneProjectName(lane));
  const discoveryExitCode = asNumber(isRecord(discoveryValue) ? discoveryValue.exitCode : null);
  const discoveryPath = asString(isRecord(discoveryValue) ? discoveryValue.outputPath : null);
  const discoveryDigest = asString(isRecord(discoveryValue) ? discoveryValue.outputSha256 : null);
  const discoveryArtifact = artifacts[discoveryPath];
  const discoveryArtifactValid = Boolean(discoveryArtifact && discoveryDigest && discoveryArtifact.sha256 === discoveryDigest);
  const rawIds = tests.map(canonicalTestId);
  const declaredIds = asArray(captureValue.discoveredTestIdentities)
    .filter((entry): entry is string => typeof entry === "string");
  const actualWorkers = isRecord(raw) && isRecord(raw.config)
    ? asNumber(isRecord(raw.config.metadata) ? raw.config.metadata.actualWorkers : null)
    : null;
  const selectedProject = isRecord(raw) && isRecord(raw.config)
    ? asArray(raw.config.projects).filter(isRecord).find((project) => project.name === laneProjectName(lane))
    : undefined;
  const projectWorkers = isRecord(selectedProject) && isRecord(selectedProject.metadata)
    ? asNumber(selectedProject.metadata.actualWorkers)
    : null;
  const configuredWorkers = isRecord(raw) && isRecord(raw.config) ? asNumber(raw.config.workers) : null;
  const retries = isRecord(selectedProject) ? asNumber(selectedProject.retries) : null;
  const stats = isRecord(raw) && isRecord(raw.stats) ? raw.stats : {};
  const derivedCounts = outcome.counts;
  const statsMatch = stats.expected === derivedCounts.expected && stats.unexpected === derivedCounts.unexpected &&
    stats.skipped === derivedCounts.skipped && stats.flaky === derivedCounts.flaky;
  const noRunErrors = isRecord(raw) && Array.isArray(raw.errors) && raw.errors.length === 0;
  const outcomeCounts = countLaneOutcomes(tests);
  const unresolvedOutcome = tests.some((test) => !test.actualPass &&
    !(test.resultStatus === "skipped" && approvedSkipIds.has(canonicalTestId(test))));
  const runFailed = derivedCounts.unexpected > 0 || derivedCounts.flaky > 0 || !noRunErrors;
  const exitCode = asNumber(captureValue.exitCode);
  const processStatus = exitCode === null ? "incomplete" : exitCode === 0 ? "passed" : "failed";
  const interrupted = tests.some((test) => test.attemptStatuses.includes("interrupted"));
  const complete = captureValue.invocationStatus === "executed" && exitCode !== null &&
    discoveryExitCode === 0 && discoveryArtifactValid &&
    outcome.counts.discovered === discovery.identities.length &&
    sameStrings(rawIds, discovery.identities) && sameStrings(declaredIds, discovery.identities) &&
    outcome.issues.length === 0 && statsMatch && noRunErrors && !interrupted &&
    tests.every((test) => test.retryCount === 0) &&
    configuredWorkers === laneWorkers(lane) && actualWorkers === laneWorkers(lane) &&
    projectWorkers === laneWorkers(lane) && retries === 0;
  const result: JsonRecord = {
    projectName: laneProjectName(lane),
    command: asString(captureValue.command),
    sourceCommitSha: asString(captureValue.sourceCommitSha),
    invocationStatus: asString(captureValue.invocationStatus),
    processStatus,
    exitCode,
    configuredWorkers,
    actualWorkers,
    configuredRetries: retries,
    serverPort: captureValue.serverPort,
    rawReportPath: asString(captureValue.rawReportPath),
    rawReportSha256: asString(captureValue.rawReportSha256),
    consolePath: asString(captureValue.consolePath),
    consoleSha256: asString(captureValue.consoleSha256),
    discoveryCommand: asString(isRecord(discoveryValue) ? discoveryValue.command : null),
    discoveryExitCode,
    discoveryOutputPath: discoveryPath,
    discoveryOutputSha256: discoveryDigest,
    discovered: discovery.identities.length,
    discoveredTestIdentities: discovery.identities,
    specFiles: discovery.files.length,
    outcomes: outcomeCounts,
    playwrightStats: {
      expected: stats.expected ?? null,
      unexpected: stats.unexpected ?? null,
      skipped: stats.skipped ?? null,
      flaky: stats.flaky ?? null,
      durationMs: stats.duration ?? null,
    },
    statsReconciled: statsMatch,
    rawOutcomeIssues: outcome.issues,
    discoveryIssues: discovery.issues,
    executionCompleteness: complete ? "complete" : "incomplete",
    laneStatus: !complete ? "incomplete" : runFailed || unresolvedOutcome ? "failed" : "passed",
  };
  return { result, tests, raw };
};

export const buildGroundGlassM7kQualificationReport = (
  manifest: GroundGlassM7kCaptureManifest,
  artifacts: GroundGlassM7kArtifacts,
): JsonRecord => {
  const ordinaryCapture = manifest.lanes.ordinary ?? null;
  const serialCapture = manifest.lanes.rendererSerial ?? null;
  const approvedSkipIds = new Set(asArray(manifest.approvedSkipExclusions)
    .filter(isGroundGlassM7kApprovedSkipExclusion)
    .map((entry) => asString(entry.testId)));
  const ordinaryDiscovery = manifest.discovery.ordinary;
  const serialDiscovery = manifest.discovery.rendererSerial;
  const ordinaryDiscoveryArtifact = artifacts[ordinaryDiscovery.outputPath];
  const serialDiscoveryArtifact = artifacts[serialDiscovery.outputPath];
  const m7jDiscoveryArtifact = artifacts[GROUND_GLASS_M7K_M7J_DISCOVERY_PATH];
  const m7jSerialDiscoveryArtifact = artifacts[GROUND_GLASS_M7K_M7J_SERIAL_DISCOVERY_PATH];
  const ordinary = buildLane("ordinary", ordinaryCapture, {
    ...ordinaryDiscovery,
    text: ordinaryDiscoveryArtifact?.value,
  }, artifacts, approvedSkipIds);
  const serial = buildLane("rendererSerial", serialCapture, {
    ...serialDiscovery,
    text: serialDiscoveryArtifact?.value,
  }, artifacts, approvedSkipIds);
  if (ordinary.result) ordinary.result.sourceCommitSha = manifest.executionSourceCommitSha;
  if (serial.result) serial.result.sourceCommitSha = manifest.executionSourceCommitSha;
  const ordinaryIds = ordinary.result ? asArray(ordinary.result.discoveredTestIdentities) as string[] : [];
  const serialIds = serial.result ? asArray(serial.result.discoveredTestIdentities) as string[] : [];
  const combinedIds = [...ordinaryIds, ...serialIds];
  const overlaps = ordinaryIds.filter((identity) => serialIds.includes(identity));
  const duplicates = combinedIds.filter((identity, index) => combinedIds.indexOf(identity) !== index);
  const m7jIds = [
    ...parseGroundGlassM7kDiscoveryOutput(m7jDiscoveryArtifact?.value, "chromium").identities,
    ...parseGroundGlassM7kDiscoveryOutput(m7jSerialDiscoveryArtifact?.value, "chromium-renderer-serial").identities,
  ];
  const m7gArtifact = artifacts["docs/architecture/ground-glass-m7g-r187/validation/broad-e2e-playwright.json"];
  const historicalRawOutcomes = deriveGroundGlassM7hPlaywrightReportOutcomes(
    m7gArtifact?.value,
    m7gArtifact?.sha256,
  );
  const historicalIds = historicalRawOutcomes.tests.map(canonicalTestId);
  const currentIds = sort([...new Set(combinedIds)]);
  const m7jAdded = currentIds.filter((identity) => !m7jIds.includes(identity));
  const m7jRemoved = m7jIds.filter((identity) => !currentIds.includes(identity));
  const m7gAdded = currentIds.filter((identity) => !historicalIds.includes(identity));
  const m7gRemoved = historicalIds.filter((identity) => !currentIds.includes(identity));
  const historic = {
    m7gReport: referenceFor("docs/architecture/GROUND_GLASS_M7G_R187_LIFECYCLE_CONSOLIDATION_REPORT.json", artifacts),
    m7gRawReport: referenceFor("docs/architecture/ground-glass-m7g-r187/validation/broad-e2e-playwright.json", artifacts),
    m7hReport: referenceFor("docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json", artifacts),
    m7iReport: referenceFor("docs/architecture/GROUND_GLASS_M7I_BROAD_E2E_REMEDIATION_REPORT.json", artifacts),
    m7jReport: referenceFor(GROUND_GLASS_M7K_M7J_REPORT_PATH, artifacts),
    m7jDiscovery: referenceFor(GROUND_GLASS_M7K_M7J_DISCOVERY_PATH, artifacts),
    m7jRendererSerialDiscovery: referenceFor(GROUND_GLASS_M7K_M7J_SERIAL_DISCOVERY_PATH, artifacts),
  };
  const currentLaneStatuses = [ordinary.result, serial.result].filter(isRecord);
  const executionCompleteness = currentLaneStatuses.length === 2 &&
    currentLaneStatuses.every((lane) => lane.executionCompleteness === "complete") &&
    overlaps.length === 0 && duplicates.length === 0 &&
    sameStrings(combinedIds, sort(m7jIds)) &&
    (manifest.schemaVersion === 1 || manifest.captureMode === "full")
    ? "complete"
    : "incomplete";
  const laneOutcomes = [ordinary, serial];
  const allRawTests = laneOutcomes.flatMap((lane) => lane.tests);
  const skipAudit = getSkipAudit(allRawTests, {
    ordinary: ordinary.raw,
    rendererSerial: serial.raw,
  }, manifest.approvedSkipExclusions ?? []);
  const historicalM7hArtifact = artifacts["docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json"];
  const historicalM7iArtifact = artifacts["docs/architecture/GROUND_GLASS_M7I_BROAD_E2E_REMEDIATION_REPORT.json"];
  const historicalComparison = compareHistoricalFailures(
    historicalRawOutcomes.tests,
    historicalM7hArtifact?.value,
    historicalM7iArtifact?.value,
    allRawTests,
  );
  const unapprovedSkipped = skipAudit.filter((entry) => !approvedSkipIds.has(asString(entry.testId)));
  const combinedCounts = countLaneOutcomes(allRawTests);
  const allOutcomesResolved = allRawTests.length > 0 && allRawTests.every((test) => test.actualPass ||
    (test.resultStatus === "skipped" && approvedSkipIds.has(canonicalTestId(test))));
  const skipIds = new Set(skipAudit.map((entry) => asString(entry.testId)));
  const staleSkipExclusions = [...approvedSkipIds].filter((identity) => !skipIds.has(identity));
  const qualificationEligible = executionCompleteness === "complete" && allOutcomesResolved &&
    allRawTests.every((test) => test.resultStatus !== "flaky" && test.resultStatus !== "incomplete") &&
    unapprovedSkipped.length === 0;
  const broadQualification = executionCompleteness !== "complete"
    ? "blocked"
    : qualificationEligible ? "qualified" : "not-qualified";
  const qualificationReasons = executionCompleteness !== "complete"
    ? ["both independent lanes and every discovered identity are required"]
    : [
        ...(Number(combinedCounts.failed) > 0 ? [`${combinedCounts.failed} unexpected outcomes remain`] : []),
        ...(Number(combinedCounts.expectedFailure) > 0 ? [`${combinedCounts.expectedFailure} required tests have expected-failure annotations`] : []),
        ...(Number(combinedCounts.flaky) > 0 ? [`${combinedCounts.flaky} tests are flaky`] : []),
        ...(Number(combinedCounts.incomplete) > 0 ? [`${combinedCounts.incomplete} tests have incomplete results`] : []),
        ...(unapprovedSkipped.length > 0 ? [`${unapprovedSkipped.length} skipped tests lack an accepted exclusion decision`] : []),
        ...(staleSkipExclusions.length > 0 ? [`${staleSkipExclusions.length} accepted exclusions do not identify current skipped tests`] : []),
      ];
  const legacyManifest = manifest.schemaVersion === 1;
  const evaluationRef = asString(manifest.evaluationCommitSha);
  const report: JsonRecord = {
    schemaVersion: legacyManifest ? 1 : 2,
    reportId: GROUND_GLASS_M7K_REPORT_ID,
    evaluatorRevision: legacyManifest
      ? GROUND_GLASS_M7K_LEGACY_EVALUATOR_REVISION
      : GROUND_GLASS_M7K_EVALUATOR_REVISION,
    baseCommitSha: manifest.baseCommitSha,
    executionSourceCommitSha: manifest.executionSourceCommitSha,
    ...(legacyManifest ? {} : {
      toolingCommitSha: manifest.toolingCommitSha,
      captureMode: manifest.captureMode,
      selection: manifest.selection ?? null,
      outputDirectory: manifest.outputDirectory,
      toolingSourcePath: manifest.toolingSourcePath,
      evaluatorSourcePath: manifest.evaluatorSourcePath,
    }),
    evaluationCommitSha: evaluationRef,
    generatedAt: manifest.generatedAt,
    sourceProvenance: {
      executionSourceCommitSha: manifest.executionSourceCommitSha,
      sourceRole: "accepted-main-baseline-before-M7K-evaluator-and-report-changes",
      sourceCommitAvailable: true,
      sourceCommitVerification: "git-cat-file-commit-object",
      ...(!legacyManifest ? {
        toolingCommitSha: manifest.toolingCommitSha,
        toolingSourcePath: manifest.toolingSourcePath,
        toolingSourceAvailable: true,
        toolingSourceVerification: "git-cat-file-tree-entry",
        evaluationCommitSha: manifest.evaluationCommitSha,
        evaluatorSourcePath: manifest.evaluatorSourcePath,
        evaluatorSourceAvailable: true,
        evaluatorSourceVerification: "git-cat-file-tree-entry",
      } : {}),
    },
    historicalEvidence: {
      m7gSourceCommitSha: GROUND_GLASS_M7K_M7G_SOURCE_SHA,
      m7gRawReportSha256: GROUND_GLASS_M7K_M7G_RAW_SHA256,
      m7hEvaluatorRevision: "m7h-broad-e2e-triage-evaluator-v3",
      m7iEvaluatorRevision: "m7i-broad-e2e-remediation-evaluator-v2",
      m7iReportSha256: GROUND_GLASS_M7K_M7I_REPORT_SHA256,
      m7jEvaluatorRevision: "m7j-four-worker-stability-evaluator-v1",
      m7jBaseCommitSha: "b917ad46f99d8de339adbd028f0ae57c4922df1f",
      m7jCandidateCaptureCommitSha: "17a2616b151aa50ad34b2d137eee0a43c5759ad3",
      artifacts: historic,
    },
    environment: manifest.environment,
    discovery: {
      ordinary: ordinary.result ? {
        projectName: "chromium",
        command: ordinary.result.discoveryCommand,
        exitCode: ordinary.result.discoveryExitCode,
        outputPath: ordinary.result.discoveryOutputPath,
        outputSha256: ordinary.result.discoveryOutputSha256,
        discoveredTests: ordinary.result.discovered,
        specFiles: ordinary.result.specFiles,
        testIdentities: ordinary.result.discoveredTestIdentities,
      } : null,
      rendererSerial: serial.result ? {
        projectName: "chromium-renderer-serial",
        command: serial.result.discoveryCommand,
        exitCode: serial.result.discoveryExitCode,
        outputPath: serial.result.discoveryOutputPath,
        outputSha256: serial.result.discoveryOutputSha256,
        discoveredTests: serial.result.discovered,
        specFiles: serial.result.specFiles,
        testIdentities: serial.result.discoveredTestIdentities,
      } : null,
      combined: {
        discoveredTests: combinedIds.length,
        uniqueIdentities: new Set(combinedIds).size,
        duplicateIds: sort([...new Set(duplicates)]),
        projectOverlap: sort([...new Set(overlaps)]),
        testIdentities: sort(combinedIds),
      },
      comparedWithM7J: { addedTestIds: sort(m7jAdded), removedTestIds: sort(m7jRemoved) },
      comparedWithM7G: { addedTestIds: sort(m7gAdded), removedTestIds: sort(m7gRemoved) },
    },
    execution: {
      sourceCommitSha: manifest.executionSourceCommitSha,
      lanes: {
        ordinary: ordinary.result,
        rendererSerial: serial.result,
      },
      executionCompleteness,
      combinedOutcomes: combinedCounts,
      perTest: allRawTests.map((test) => ({
        testId: canonicalTestId(test),
        lane: test.lane,
        projectName: test.projectName,
        sourceSpec: basename(test.specFile),
        describePath: test.describePath,
        title: test.testTitle,
        expectedStatus: test.expectedStatus,
        actualStatus: test.actualStatus,
        attemptStatuses: test.attemptStatuses,
        resultStatus: test.resultStatus,
        retryCount: test.retryCount,
        actualPass: test.actualPass,
        disposition: testDisposition(test),
        errorSignature: test.errorCategory,
        errorMessage: test.errorMessage,
        durationMs: test.durationMs,
      })).sort((a, b) => String(a.testId).localeCompare(String(b.testId))),
    },
    skipAudit,
    historicalComparison: {
      tests: historicalComparison.tests,
      summary: historicalComparison.summary,
    },
    qualification: {
      executionCompleteness,
      evidenceIntegrity: "computed-by-evaluator",
      ordinaryLane: ordinary.result?.laneStatus ?? "incomplete",
      rendererSerialLane: serial.result?.laneStatus ?? "incomplete",
      broadE2eQualification: broadQualification,
      scope: "Controlled ordinary Chromium application E2E with four renderer-sensitive tests in the one-worker serial lane; ordinary WebGL fallback only.",
      supportedClaims: [
        "complete ordinary Chromium application regression baseline",
        "four required renderer-sensitive tests executed in the renderer-serial project",
      ],
      excludedClaims: ["native WebGPU qualification", "unrestricted four-worker renderer stability", "M7 completion", "M8 authorization"],
      reasons: qualificationReasons,
      skipPolicy: {
        approvedExclusions: manifest.approvedSkipExclusions ?? [],
        unapprovedSkippedTestIds: sort(unapprovedSkipped.map((entry) => asString(entry.testId))),
      },
    },
    remainingBacklog: {
      historicalFailures: 99,
      m7hInheritedVerifiedFixes: 16,
      m7iMatchedVerifiedFixes: 2,
      tentativeDrawerCases: 15,
      originalUnknownFailureIdentities: 67,
      originalUnknownStillUnverified: 65,
      partiallyAddressedCompoundCase: 1,
      historicalUnresolvedIdentities: 80,
      currentHistoricalFailuresStillFailing: historicalComparison.summary.historicalStillFailing,
      newUnexpectedFailureIdentities: historicalComparison.summary.newUnexpectedFailures,
      nextRecommendation: "targeted-application-regression-remediation",
    },
    authorization: {
      m7Overall: "partially-qualified",
      m8Entry: "denied",
      spontaneousExternalGpuDeviceLoss: "blocked",
      m5qQuality: "partially-qualified",
      m6: "development-only",
      productionGroundGlass: "WebGL-only",
      productionWebGpuEnabled: false,
      unrestrictedFourWorkerStability: "unstable",
    },
    validation: manifest.validation,
  };
  return report;
};

const getRawAndDiscoveryArtifacts = (
  report: JsonRecord,
  artifacts: GroundGlassM7kArtifacts,
  issues: string[],
): GroundGlassM7kArtifacts => {
  const selected: Record<string, GroundGlassM7kArtifact> = {};
  const historical = isRecord(report.historicalEvidence) ? report.historicalEvidence : {};
  const historicalRefs = isRecord(historical.artifacts) ? Object.values(historical.artifacts) : [];
  for (const ref of historicalRefs) {
    if (!isRecord(ref)) continue;
    const value = readReferencedValue(ref, artifacts, issues, `historical:${asString(ref.path)}`);
    const path = asString(ref.path);
    if (path && artifacts[path]) selected[path] = { ...artifacts[path], value };
  }
  const discovery = isRecord(report.discovery) ? report.discovery : {};
  for (const lane of ["ordinary", "rendererSerial"] as const) {
    const value = isRecord(discovery[lane]) ? discovery[lane] : null;
    if (!value) continue;
    const path = asString(value.outputPath);
    const ref = { path, sha256: value.outputSha256 };
    const artifactValue = readReferencedValue(ref, artifacts, issues, `discovery:${lane}`);
    if (path && artifacts[path]) selected[path] = { ...artifacts[path], value: artifactValue };
  }
  const execution = isRecord(report.execution) ? report.execution : {};
  const lanes = isRecord(execution.lanes) ? execution.lanes : {};
  for (const lane of ["ordinary", "rendererSerial"] as const) {
    const laneValue = isRecord(lanes[lane]) ? lanes[lane] : null;
    if (!laneValue) continue;
    for (const [label, pathKey, digestKey] of [
      ["raw", "rawReportPath", "rawReportSha256"],
      ["console", "consolePath", "consoleSha256"],
    ] as const) {
      const path = asString(laneValue[pathKey]);
      const value = readReferencedValue({ path, sha256: laneValue[digestKey] }, artifacts, issues, `${lane}:${label}`);
      if (path && artifacts[path]) selected[path] = { ...artifacts[path], value };
    }
  }
  return selected;
};

const observerRuntimeEvidence = (consoleOutput: string, renderer: "webgl" | "webgpu"): JsonRecord[] => {
  const results: JsonRecord[] = [];
  for (const line of consoleOutput.split(/\r?\n/)) {
    const match = line.match(new RegExp(`Observer environment evidence ${renderer}: (\\{.*\\})`));
    if (!match) continue;
    try {
      const value: unknown = JSON.parse(match[1]);
      if (isRecord(value) && isRecord(value.runtime)) results.push(value.runtime);
    } catch {
      // Malformed runtime diagnostics are not usable environment evidence.
    }
  }
  return results;
};

export const evaluateGroundGlassM7kBroadE2eQualification = (
  reportValue: unknown,
  artifactsValue: GroundGlassM7kArtifacts,
  sourceCommitAvailable: boolean,
  sourceFileAvailability: Readonly<{ tooling: boolean; evaluator: boolean }> = { tooling: false, evaluator: false },
): GroundGlassM7kEvaluation => {
  const issues: string[] = [];
  const report = isRecord(reportValue) ? reportValue : {};
  const artifacts = isRecord(artifactsValue) ? artifactsValue : {};
  if (report.reportId !== GROUND_GLASS_M7K_REPORT_ID) issues.push("report-id-mismatch");
  const schemaVersion = report.schemaVersion;
  const legacyReport = schemaVersion === 1;
  const schemaV2Report = schemaVersion === 2;
  if (!legacyReport && !schemaV2Report) issues.push("report-schema-version-mismatch");
  if (legacyReport && report.evaluatorRevision !== GROUND_GLASS_M7K_LEGACY_EVALUATOR_REVISION) {
    issues.push("evaluator-revision-mismatch");
  }
  if (schemaV2Report && report.evaluatorRevision !== GROUND_GLASS_M7K_EVALUATOR_REVISION) {
    issues.push("evaluator-revision-mismatch");
  }
  if (report.baseCommitSha !== GROUND_GLASS_M7K_BASE_COMMIT_SHA) issues.push("m7k-base-commit-mismatch");
  const sourceSha = asString(report.executionSourceCommitSha);
  if (sourceSha !== GROUND_GLASS_M7K_EXECUTION_SOURCE_SHA) issues.push("execution-source-sha-mismatch");
  if (!sha(sourceSha) || !sourceCommitAvailable) issues.push("execution-source-commit-missing");
  const evaluationSha = asString(report.evaluationCommitSha);
  if (!sha(evaluationSha)) issues.push("evaluation-commit-sha-invalid");
  if (sourceSha === evaluationSha) issues.push("execution-source-replaced-by-evaluation-or-squash-commit");
  const toolingSha = asString(report.toolingCommitSha);
  if (schemaV2Report) {
    if (!sha(toolingSha)) issues.push("tooling-commit-sha-invalid");
    if (toolingSha === sourceSha) issues.push("execution-source-replaced-by-tooling-or-squash-commit");
    if (evaluationSha === sourceSha) issues.push("execution-source-replaced-by-evaluator-or-squash-commit");
    if (!sourceFileAvailability.tooling) issues.push("tooling-source-file-unavailable");
    if (!sourceFileAvailability.evaluator) issues.push("evaluator-source-file-unavailable");
    if (report.captureMode !== "full" && report.captureMode !== "selected") {
      issues.push("capture-mode-invalid");
    }
    if (report.toolingSourcePath !== "scripts/run-m7k-broad-e2e.mjs") {
      issues.push("tooling-source-path-invalid");
    }
    if (report.evaluatorSourcePath !== "scripts/evaluateM7kBroadE2eQualification.ts") {
      issues.push("evaluator-source-path-invalid");
    }
    const outputDirectory = asString(report.outputDirectory);
    if (!safeRelativeSegments(outputDirectory)) issues.push("output-directory-invalid");
    const discoveryRecords = isRecord(report.discovery) ? report.discovery : {};
    const executionRecords = isRecord(report.execution) ? report.execution : {};
    const laneRecords = isRecord(executionRecords.lanes) ? executionRecords.lanes : {};
    const outputPaths = [
      asString(isRecord(discoveryRecords.ordinary) ? discoveryRecords.ordinary.outputPath : null),
      asString(isRecord(discoveryRecords.rendererSerial) ? discoveryRecords.rendererSerial.outputPath : null),
      ...[laneRecords.ordinary, laneRecords.rendererSerial].filter(isRecord).flatMap((lane) => [
        asString(lane.rawReportPath),
        asString(lane.consolePath),
      ]),
    ];
    if (outputPaths.some((path) => !isInsideRelativeDirectory(outputDirectory, path))) {
      issues.push("raw-artifact-path-outside-output-directory");
    }
  }
  const provenance = isRecord(report.sourceProvenance) ? report.sourceProvenance : {};
  if (provenance.executionSourceCommitSha !== GROUND_GLASS_M7K_EXECUTION_SOURCE_SHA ||
      provenance.sourceRole !== "accepted-main-baseline-before-M7K-evaluator-and-report-changes" ||
      provenance.sourceCommitAvailable !== true || provenance.sourceCommitVerification !== "git-cat-file-commit-object") {
    issues.push("execution-source-provenance-claim-invalid");
  }
  if (schemaV2Report && (provenance.toolingCommitSha !== toolingSha ||
      provenance.toolingSourcePath !== report.toolingSourcePath || provenance.toolingSourceAvailable !== true ||
      provenance.toolingSourceVerification !== "git-cat-file-tree-entry" ||
      provenance.evaluationCommitSha !== evaluationSha || provenance.evaluatorSourcePath !== report.evaluatorSourcePath ||
      provenance.evaluatorSourceAvailable !== true || provenance.evaluatorSourceVerification !== "git-cat-file-tree-entry")) {
    issues.push("tooling-or-evaluator-source-provenance-claim-invalid");
  }
  const executionRecord = isRecord(report.execution) ? report.execution : {};
  if (executionRecord.sourceCommitSha !== GROUND_GLASS_M7K_EXECUTION_SOURCE_SHA) {
    issues.push("execution-source-attribution-mismatch");
  }

  const refs = getRawAndDiscoveryArtifacts(report, artifacts, issues);
  const m7gRawPath = "docs/architecture/ground-glass-m7g-r187/validation/broad-e2e-playwright.json";
  const m7gRaw = refs[m7gRawPath]?.value;
  const m7gDerived = deriveGroundGlassM7hPlaywrightReportOutcomes(m7gRaw, refs[m7gRawPath]?.sha256);
  if (refs[m7gRawPath]?.sha256 !== GROUND_GLASS_M7K_M7G_RAW_SHA256 || m7gDerived.issues.length > 0 ||
      m7gDerived.counts.discovered !== 277 || m7gDerived.counts.expected !== 103 ||
      m7gDerived.counts.unexpected !== 99 || m7gDerived.counts.skipped !== 75 || m7gDerived.counts.flaky !== 0) {
    issues.push("m7g-historical-raw-baseline-invalid");
  }
  const m7h = refs["docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json"]?.value;
  const m7i = refs["docs/architecture/GROUND_GLASS_M7I_BROAD_E2E_REMEDIATION_REPORT.json"]?.value;
  const m7j = refs[GROUND_GLASS_M7K_M7J_REPORT_PATH]?.value;
  if (!isRecord(m7h) || m7h.reportId !== "ground-glass-m7h-broad-e2e-triage" ||
      m7h.evaluatorRevision !== "m7h-broad-e2e-triage-evaluator-v3" ||
      refs["docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json"]?.sha256 !== GROUND_GLASS_M7K_M7H_REPORT_SHA256 ||
      asArray(m7h.failureInventory).length !== 99) issues.push("m7h-historical-report-invalid");
  if (!isRecord(m7i) || m7i.reportId !== "ground-glass-m7i-broad-e2e-remediation" ||
      m7i.evaluatorRevision !== "m7i-broad-e2e-remediation-evaluator-v2" ||
      refs["docs/architecture/GROUND_GLASS_M7I_BROAD_E2E_REMEDIATION_REPORT.json"]?.sha256 !== GROUND_GLASS_M7K_M7I_REPORT_SHA256 ||
      m7i.historicalFailureCount !== 99 || asArray(m7i.tentativeDrawerInventory).length !== 15 ||
      asArray(m7i.unknownFailureInventory).length !== 67 || asArray(m7i.partiallyAddressed).length !== 1 ||
      asArray(m7i.verifiedFixes).length !== 18 || asArray(m7i.unresolved).length !== 80 ||
      m7i.broadE2eQualification !== "not-qualified" || m7i.m7Qualification !== "partially-qualified" ||
      m7i.m8Entry !== "denied") issues.push("m7i-historical-report-or-authorization-invalid");
  const m7iAuthorization = isRecord(m7i) && isRecord(m7i.productionAuthorization)
    ? m7i.productionAuthorization
    : {};
  if (m7iAuthorization.productionGroundGlass !== "WebGL-only" ||
      m7iAuthorization.productionWebGpuEnabled !== false ||
      m7iAuthorization.spontaneousExternalDeviceLoss !== "blocked") {
    issues.push("m7i-production-authorization-boundary-invalid");
  }
  if (!isRecord(m7j) || m7j.reportId !== "ground-glass-m7j-four-worker-stability" ||
      m7j.evaluatorRevision !== "m7j-four-worker-stability-evaluator-v1" ||
      m7j.candidateCommitSha !== "17a2616b151aa50ad34b2d137eee0a43c5759ad3" ||
      m7j.fourWorkerStability !== "unstable" || m7j.broadE2eQualification !== "not-qualified" ||
      m7j.m7Qualification !== "partially-qualified" || m7j.m8Entry !== "denied" ||
      m7j.productionWebGpuEnabled !== false || m7j.spontaneousExternalGpuDeviceLoss !== "blocked") {
    issues.push("m7j-historical-report-or-authorization-invalid");
  }

  const m7gReport = refs["docs/architecture/GROUND_GLASS_M7G_R187_LIFECYCLE_CONSOLIDATION_REPORT.json"]?.value;
  if (!isRecord(m7gReport) || m7gReport.reportId !== "ground-glass-m7g-r187-lifecycle-consolidation" ||
      m7gReport.evaluatorRevision !== "m7g-r187-consolidation-evaluator-v2") {
    issues.push("m7g-historical-report-invalid");
  }

  const reportDiscovery = isRecord(report.discovery) ? report.discovery : {};
  const reportExecution = isRecord(report.execution) ? report.execution : {};
  const laneRecords = isRecord(reportExecution.lanes)
    ? reportExecution.lanes
    : {};
  const captureManifest: GroundGlassM7kCaptureManifest = {
    schemaVersion: schemaVersion as 1 | 2,
    baseCommitSha: asString(report.baseCommitSha),
    executionSourceCommitSha: sourceSha,
    ...(schemaV2Report ? {
      toolingCommitSha: toolingSha,
      captureMode: report.captureMode as "full" | "selected",
      selection: isRecord(report.selection)
        ? { ordinaryGrep: asString(report.selection.ordinaryGrep), rendererSerialGrep: asString(report.selection.rendererSerialGrep) }
        : null,
      outputDirectory: asString(report.outputDirectory),
      toolingSourcePath: asString(report.toolingSourcePath),
      evaluatorSourcePath: asString(report.evaluatorSourcePath),
    } : {}),
    evaluationCommitSha: evaluationSha,
    generatedAt: asString(report.generatedAt),
    environment: isRecord(report.environment) ? report.environment : {},
    discovery: {
      ordinary: {
        projectName: "chromium",
        command: isRecord(reportDiscovery.ordinary) ? asString(reportDiscovery.ordinary.command) : "",
        exitCode: isRecord(reportDiscovery.ordinary) ? asNumber(reportDiscovery.ordinary.exitCode) ?? -1 : -1,
        outputPath: isRecord(reportDiscovery.ordinary) ? asString(reportDiscovery.ordinary.outputPath) : "",
        outputSha256: isRecord(reportDiscovery.ordinary) ? asString(reportDiscovery.ordinary.outputSha256) : "",
      },
      rendererSerial: {
        projectName: "chromium-renderer-serial",
        command: isRecord(reportDiscovery.rendererSerial) ? asString(reportDiscovery.rendererSerial.command) : "",
        exitCode: isRecord(reportDiscovery.rendererSerial) ? asNumber(reportDiscovery.rendererSerial.exitCode) ?? -1 : -1,
        outputPath: isRecord(reportDiscovery.rendererSerial) ? asString(reportDiscovery.rendererSerial.outputPath) : "",
        outputSha256: isRecord(reportDiscovery.rendererSerial) ? asString(reportDiscovery.rendererSerial.outputSha256) : "",
      },
    },
    lanes: {
      ...(isRecord(laneRecords.ordinary) ? { ordinary: laneRecords.ordinary as unknown as GroundGlassM7kCaptureLane } : {}),
      ...(isRecord(laneRecords.rendererSerial)
        ? { rendererSerial: laneRecords.rendererSerial as unknown as GroundGlassM7kCaptureLane }
        : {}),
    },
    approvedSkipExclusions: isRecord(report.qualification) && isRecord(report.qualification.skipPolicy)
      ? asArray(report.qualification.skipPolicy.approvedExclusions).filter(isRecord)
      : [],
    validation: isRecord(report.validation) ? report.validation : {},
  };
  const recomputed = buildGroundGlassM7kQualificationReport(captureManifest, refs);

  const requiredClaims: Array<[string, unknown, unknown]> = [
    ["discovery", report.discovery, recomputed.discovery],
    ["execution", report.execution, recomputed.execution],
    ["skip-audit", report.skipAudit, recomputed.skipAudit],
    ["historical-comparison", report.historicalComparison, recomputed.historicalComparison],
    ["qualification", report.qualification, recomputed.qualification],
    ["remaining-backlog", report.remainingBacklog, recomputed.remainingBacklog],
    ["authorization", report.authorization, recomputed.authorization],
    ["historical-evidence", report.historicalEvidence, recomputed.historicalEvidence],
  ];
  for (const [name, claim, expected] of requiredClaims) {
    if (!sameValue(claim, expected)) issues.push(`report-claim-does-not-match-derived-evidence:${name}`);
  }

  const discovery = recomputed.discovery as JsonRecord;
  const ordinaryDiscovery = isRecord(discovery.ordinary) ? discovery.ordinary : null;
  const serialDiscovery = isRecord(discovery.rendererSerial) ? discovery.rendererSerial : null;
  const combined = isRecord(discovery.combined) ? discovery.combined : {};
  const ordinaryRecord = isRecord(laneRecords.ordinary) ? laneRecords.ordinary : null;
  const serialRecord = isRecord(laneRecords.rendererSerial) ? laneRecords.rendererSerial : null;
  const ordinaryExpected = ordinaryDiscovery ? asArray(ordinaryDiscovery.testIdentities) as string[] : [];
  const serialExpected = serialDiscovery ? asArray(serialDiscovery.testIdentities) as string[] : [];
  const completeClaim = isRecord(report.qualification)
    ? report.qualification.executionCompleteness === "complete"
    : false;
  if (completeClaim && !ordinaryRecord) issues.push("complete-run-missing-lane:ordinary");
  if (completeClaim && !serialRecord) issues.push("complete-run-missing-lane:rendererSerial");
  if (completeClaim && (!ordinaryDiscovery || !serialDiscovery)) issues.push("complete-run-discovery-lane-missing");
  if (completeClaim && (ordinaryExpected.length !== 274 || serialExpected.length !== 4 || combined.discoveredTests !== 278)) {
    issues.push("complete-run-inventory-count-mismatch");
  }
  if (Array.isArray(combined.duplicateIds) && combined.duplicateIds.length > 0) issues.push("duplicate-identity-counted-across-lanes");
  if (Array.isArray(combined.projectOverlap) && combined.projectOverlap.length > 0) issues.push("same-test-counted-in-both-lanes");
  if (ordinaryExpected.some((identity) => identity.endsWith("-production.spec.ts"))) {
    issues.push("production-preview-test-in-ordinary-inventory");
  }
  if ([...ordinaryExpected, ...serialExpected].some((identity) => identity.includes("-production.spec.ts"))) {
    issues.push("production-preview-test-in-qualification-inventory");
  }
  const serialExpectedIds: string[] = GROUND_GLASS_M7K_REQUIRED_RENDERER_TESTS.map((identity) => identity);
  if (serialRecord && !sameStrings(serialExpected, serialExpectedIds)) issues.push("renderer-serial-required-test-inventory-mismatch");
  if (ordinaryExpected.some((identity) => serialExpectedIds.includes(identity))) {
    issues.push("renderer-sensitive-test-in-ordinary-lane");
  }

  for (const [laneName, record, expectedProject] of [
    ["ordinary", ordinaryRecord, "chromium"],
    ["rendererSerial", serialRecord, "chromium-renderer-serial"],
  ] as const) {
    if (!record) continue;
    if (record.invocationStatus !== "executed") issues.push(`lane-invocation-not-executed:${laneName}`);
    if (record.sourceCommitSha !== GROUND_GLASS_M7K_EXECUTION_SOURCE_SHA) {
      issues.push(`execution-source-attribution-mismatch:${laneName}`);
    }
    const discoveryRecord = isRecord(reportDiscovery[laneName === "ordinary" ? "ordinary" : "rendererSerial"])
      ? reportDiscovery[laneName === "ordinary" ? "ordinary" : "rendererSerial"] as JsonRecord
      : {};
    if (discoveryRecord.exitCode !== 0) issues.push(`discovery-process-failed:${laneName}`);
    if (record.projectName !== expectedProject) issues.push(`execution-project-mismatch:${laneName}`);
    if (record.invocationStatus !== "executed" && record.executionCompleteness === "complete") {
      issues.push(`lane-not-executed-but-marked-complete:${laneName}`);
    }
    if (asNumber(record.exitCode) === null && record.executionCompleteness === "complete") {
      issues.push(`invocation-exit-code-missing:${laneName}`);
    }
    if (asNumber(record.exitCode) === null) issues.push(`invocation-exit-code-missing:${laneName}`);
    if (laneName === "rendererSerial" && (record.configuredWorkers !== 1 || record.actualWorkers !== 1)) {
      issues.push("renderer-serial-worker-count-mismatch");
    }
    if (laneName === "ordinary" && (record.configuredWorkers !== 4 || record.actualWorkers !== 4)) {
      issues.push("ordinary-worker-count-mismatch");
    }
    if (record.configuredRetries !== 0) issues.push(`retries-not-disabled:${laneName}`);
    if (!record.statsReconciled) issues.push(`playwright-summary-counts-disagree:${laneName}`);
    if (isRecord(record.outcomes) && asNumber(record.outcomes.retries) !== 0) {
      issues.push(`retry-dependent-outcome-present:${laneName}`);
    }
    if (asArray(record.discoveryIssues).includes("production-preview-test-in-development-inventory")) {
      issues.push(`production-preview-test-in-${laneName}-inventory`);
    }
    const raw = refs[asString(record.rawReportPath)]?.value;
    const consoleOutput = asString(refs[asString(record.consolePath)]?.value);
    const rawProjectNames = isRecord(raw) && isRecord(raw.config)
      ? asArray(raw.config.projects).filter(isRecord).map((project) => asString(project.name))
      : [];
    const derived = deriveGroundGlassM7hPlaywrightReportOutcomes(raw, record.rawReportSha256);
    if (derived.tests.some((test) => test.projectName !== expectedProject)) {
      issues.push(`test-attributed-to-wrong-project:${laneName}`);
    }
    if (derived.tests.some((test) => test.expectedStatus === "failed")) {
      issues.push(`expected-failure-reclassification-present:${laneName}`);
    }
    if (!rawProjectNames.includes(expectedProject)) issues.push(`raw-project-missing:${laneName}`);
    if (laneName === "rendererSerial") {
      const rawMetadata = buildRawTestMetadata(raw);
      for (const identity of GROUND_GLASS_M7K_REQUIRED_RENDERER_TESTS) {
        const test = derived.tests.find((candidate) => canonicalTestId(candidate) === identity);
        const metadata = test ? rawMetadata.get(test.testId) : undefined;
        if (!metadata || !asArray(metadata.tags).includes("m7j-renderer-contention")) {
          issues.push(`renderer-serial-required-tag-missing:${identity}`);
        }
      }
    }
    if (isRecord(raw) && isRecord(raw.config) && asString(raw.config.version) !== asString(isRecord(report.environment) ? report.environment.playwrightVersion : null)) {
      issues.push(`playwright-environment-mismatch:${laneName}`);
    }
    if (laneName === "ordinary") {
      const environment = isRecord(report.environment) ? report.environment : {};
      const expectedBrowser = asString(environment.browserVersion);
      const expectedThreeVersion = asString(environment.threeJsVersion);
      const expectedThreeRevision = expectedThreeVersion.match(/^0\.(\d+)\./)?.[1] ?? "";
      const webglRuntime = observerRuntimeEvidence(consoleOutput, "webgl");
      const webgpuRuntime = observerRuntimeEvidence(consoleOutput, "webgpu");
      const runtimeEvidence = [...webglRuntime, ...webgpuRuntime];
      if (!expectedBrowser || webglRuntime.length === 0 || webgpuRuntime.length === 0 ||
          runtimeEvidence.some((runtime) => runtime.browserVersion !== expectedBrowser ||
            !asString(runtime.browser).includes(`Chrome/${expectedBrowser}`) ||
            runtime.hostPlatform !== environment.platform ||
            runtime.hostArchitecture !== environment.architecture)) {
        issues.push("browser-runtime-environment-mismatch");
      }
      if (!expectedThreeRevision || runtimeEvidence.length === 0 ||
          runtimeEvidence.some((runtime) => runtime.threeRevision !== expectedThreeRevision)) {
        issues.push("three-runtime-revision-mismatch");
      }
    }
    if (asString(isRecord(report.environment) ? report.environment.browserMode : null) !== "headless" ||
        asString(isRecord(report.environment) ? report.environment.webglBackend : null) !== "webgl2-fallback") {
      issues.push("ordinary-chromium-environment-out-of-scope");
    }
    if (asNumber(record.exitCode) === 0 && (derived.counts.unexpected > 0 || derived.counts.flaky > 0)) {
      issues.push(`process-failure-hidden-by-orchestrator:${laneName}`);
    }
    if (asNumber(record.exitCode) !== 0 && derived.counts.unexpected === 0 && derived.counts.flaky === 0 &&
        derived.counts.incomplete === 0 && isRecord(raw) && Array.isArray(raw.errors) && raw.errors.length === 0) {
      issues.push(`process-status-contradicts-raw-results:${laneName}`);
    }
  }

  const reportEnvironment = isRecord(report.environment) ? report.environment : {};
  if (schemaV2Report) {
    if (!asString(reportEnvironment.playwrightVersion)) issues.push("playwright-version-missing");
    if (!asString(reportEnvironment.browserVersion)) issues.push("browser-version-missing");
    if (!asString(reportEnvironment.threeJsVersion)) issues.push("three-js-version-missing");
    if (!asString(reportEnvironment.npmVersion)) issues.push("npm-version-missing");
    if (!asString(reportEnvironment.nodeVersion) || !asString(reportEnvironment.toolingNodeVersion)) {
      issues.push("node-version-missing");
    }
    if (reportEnvironment.threeJsVersion !== "0.187.0") issues.push("three-js-version-out-of-scope");
    if (reportEnvironment.testSeamEnabled !== false || reportEnvironment.nativeWebGpuRequested !== false) {
      issues.push("execution-environment-out-of-qualification-scope");
    }
    if (reportEnvironment.browserMode !== "headless" || reportEnvironment.browserProject !== "chromium" ||
        reportEnvironment.webglBackend !== "webgl2-fallback") {
      issues.push("ordinary-chromium-environment-out-of-scope");
    }
    if (!asString(reportEnvironment.platform) || !asString(reportEnvironment.architecture)) {
      issues.push("host-platform-metadata-missing");
    }
    if (!isRecord(reportEnvironment.viewport) ||
        asNumber(reportEnvironment.viewport.width) !== 1280 || asNumber(reportEnvironment.viewport.height) !== 720) {
      issues.push("browser-viewport-missing-or-mismatched");
    }
    const browserProbe = isRecord(reportEnvironment.browserWebGlProbe) ? reportEnvironment.browserWebGlProbe : {};
    if (browserProbe.webgl2Available !== true || !asString(browserProbe.webglVersion)) {
      issues.push("browser-webgl2-probe-missing");
    }
    const dependencyLock = isRecord(reportEnvironment.dependencyLock) ? reportEnvironment.dependencyLock : {};
    if (dependencyLock.playwright !== reportEnvironment.playwrightVersion ||
        dependencyLock.three !== reportEnvironment.threeJsVersion) {
      issues.push("installed-dependencies-do-not-match-lockfile");
    }
    if (report.captureMode === "selected" &&
        (!isRecord(report.selection) || !asString(report.selection.ordinaryGrep) || !asString(report.selection.rendererSerialGrep))) {
      issues.push("selected-capture-selection-missing");
    }
    if (report.captureMode === "full" && report.selection !== null) issues.push("full-capture-has-selection-filter");
  }
  if (reportEnvironment.nativeWebGpuRequested !== false ||
      reportEnvironment.webglBackend !== "webgl2-fallback" ||
      reportEnvironment.productionPreviewTestsIncluded !== false) {
    issues.push("execution-environment-out-of-qualification-scope");
  }

  const execution = isRecord(recomputed.execution) ? recomputed.execution : {};
  const recomputedCompleteness = execution.executionCompleteness;
  const qualification = isRecord(recomputed.qualification) ? recomputed.qualification : {};
  const submittedQualification = isRecord(report.qualification) ? report.qualification : {};
  if (schemaV2Report && report.captureMode === "selected" &&
      (qualification.executionCompleteness !== "incomplete" || qualification.broadE2eQualification !== "blocked")) {
    issues.push("selected-capture-must-remain-incomplete-and-blocked");
  }
  if (submittedQualification.broadE2eQualification === "qualified" &&
      qualification.broadE2eQualification !== "qualified") {
    issues.push("broad-qualification-claim-unsupported-by-outcomes");
  }
  if (qualification.executionCompleteness !== recomputedCompleteness) issues.push("execution-completeness-claim-invalid");
  if (qualification.broadE2eQualification === "qualified" &&
      (qualification.executionCompleteness !== "complete" ||
       (isRecord(execution.combinedOutcomes) && (execution.combinedOutcomes.failed !== 0 ||
        execution.combinedOutcomes.flaky !== 0 ||
        execution.combinedOutcomes.incomplete !== 0)))) {
    issues.push("complete-failing-or-skipped-suite-labeled-qualified");
  }
  if (qualification.broadE2eQualification === "qualified" &&
      !sameStrings(asArray(isRecord(qualification.skipPolicy) ? qualification.skipPolicy.unapprovedSkippedTestIds : null)
        .filter((entry): entry is string => typeof entry === "string"), [])) {
    issues.push("unreviewed-skip-exclusion-treated-as-qualified");
  }
  if (!isRecord(report.authorization) || report.authorization.m7Overall !== "partially-qualified" ||
      report.authorization.m8Entry !== "denied" ||
      report.authorization.spontaneousExternalGpuDeviceLoss !== "blocked" ||
      report.authorization.m5qQuality !== "partially-qualified" ||
      report.authorization.m6 !== "development-only" ||
      report.authorization.productionGroundGlass !== "WebGL-only" ||
      report.authorization.productionWebGpuEnabled !== false ||
      report.authorization.unrestrictedFourWorkerStability !== "unstable") {
    issues.push("m7-m8-or-production-authorization-boundary-invalid");
  }
  const laneStatus = (record: JsonRecord | null): "passed" | "failed" | "incomplete" =>
    !record || record.executionCompleteness !== "complete" ? "incomplete"
      : record.laneStatus === "passed" ? "passed" : "failed";
  const counts = isRecord(execution.combinedOutcomes) ? execution.combinedOutcomes : {};
  const historical = isRecord(recomputed.historicalComparison) && isRecord(recomputed.historicalComparison.summary)
    ? recomputed.historicalComparison.summary
    : {};
  const passed = issues.length === 0;
  return {
    reportId: GROUND_GLASS_M7K_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7K_EVALUATOR_REVISION,
    passed,
    evidenceIntegrity: passed ? "passed" : "failed",
    executionCompleteness: recomputedCompleteness === "complete" ? "complete" : "incomplete",
    ordinaryLane: laneStatus(ordinaryRecord),
    rendererSerialLane: laneStatus(serialRecord),
    broadE2eQualification: qualification.broadE2eQualification === "qualified" ? "qualified"
      : qualification.broadE2eQualification === "blocked" ? "blocked" : "not-qualified",
    m7Overall: "partially-qualified",
    m8Entry: "denied",
    productionWebGpuEnabled: false,
    counts: {
      discovered: asNumber(counts.discovered) ?? 0,
      passed: asNumber(counts.passed) ?? 0,
      failed: asNumber(counts.failed) ?? 0,
      skipped: asNumber(counts.skipped) ?? 0,
      flaky: asNumber(counts.flaky) ?? 0,
      incomplete: asNumber(counts.incomplete) ?? 0,
      historicalFailures: asNumber(historical.historicalFailureCount) ?? 0,
      historicalNowPassing: asNumber(historical.historicalCurrentlyPassed) ?? 0,
      historicalStillFailing: asNumber(historical.historicalStillFailing) ?? 0,
      newUnexpectedFailures: asNumber(historical.newUnexpectedFailureCount) ?? 0,
    },
    issues: [...new Set(issues)],
  };
};

/** Returns true only when a skipped test has an explicit reviewed exclusion contract. */
export const isGroundGlassM7kApprovedSkipExclusion = (value: unknown): value is JsonRecord =>
  isRecord(value) && value.reviewStatus === "accepted" &&
  asString(value.testId).length > 0 && asString(value.reason).length > 0 &&
  asString(value.supportedScope).length > 0;

