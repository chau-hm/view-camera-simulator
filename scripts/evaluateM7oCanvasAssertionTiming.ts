import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const M7O_EVIDENCE_EVALUATOR_REVISION = "m7o-canvas-assertion-timing-evaluator-v1";

const repositoryRoot = resolve(process.env.M7O_CANVAS_TIMING_REPO_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const expectedExecutionSourceSha = "e5150fdaa6d9660c99ac3c36086cfaa1439e4bcb";
const expectedToolingSourceSha = "c1135c8bdeba2ba0e9cf86d68644bf5b6a957b97";
const expectedMatrixNormalizerSourceSha = "817f534dc0e61068cf20c586947ea3d6b4b5b481";
const shaPattern = /^[0-9a-f]{40}$/i;
const digestPattern = /^[0-9a-f]{64}$/i;
const expectedTargetIdentity = "architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension";

type JsonRecord = Record<string, unknown>;
type ArtifactResult = { value: unknown; bytes: Buffer | null };
type CaptureContract = {
  condition: string;
  configuredWorkers: number;
  instrumentationEnabled: boolean;
  workload: string;
  identities: string[];
};

const captureContracts: Record<string, CaptureContract> = {
  "m7o-a-r1": { condition: "A", configuredWorkers: 1, instrumentationEnabled: false, workload: "target-alone-instrumentation-off", identities: [expectedTargetIdentity] },
  "m7o-a-r2": { condition: "A", configuredWorkers: 1, instrumentationEnabled: false, workload: "target-alone-instrumentation-off", identities: [expectedTargetIdentity] },
  "m7o-a-r3": { condition: "A", configuredWorkers: 1, instrumentationEnabled: false, workload: "target-alone-instrumentation-off", identities: [expectedTargetIdentity] },
  "m7o-b-r1": { condition: "B", configuredWorkers: 1, instrumentationEnabled: true, workload: "target-alone-instrumentation-on", identities: [expectedTargetIdentity] },
  "m7o-b-r2": { condition: "B", configuredWorkers: 1, instrumentationEnabled: true, workload: "target-alone-instrumentation-on", identities: [expectedTargetIdentity] },
  "m7o-b-r3": { condition: "B", configuredWorkers: 1, instrumentationEnabled: true, workload: "target-alone-instrumentation-on", identities: [expectedTargetIdentity] },
  "m7o-c-r1": { condition: "C", configuredWorkers: 4, instrumentationEnabled: true, workload: "target-plus-three-light-peers", identities: [expectedTargetIdentity, "home.spec.ts::concept learning sections keep their responsive grids without overflow", "simulator-header.spec.ts::keeps the active lesson context between the brand and desktop actions", "smoke.spec.ts::smoke: app boots at home"] },
  "m7o-c-r2": { condition: "C", configuredWorkers: 4, instrumentationEnabled: true, workload: "target-plus-three-light-peers", identities: [expectedTargetIdentity, "home.spec.ts::concept learning sections keep their responsive grids without overflow", "simulator-header.spec.ts::keeps the active lesson context between the brand and desktop actions", "smoke.spec.ts::smoke: app boots at home"] },
  "m7o-c-r3": { condition: "C", configuredWorkers: 4, instrumentationEnabled: true, workload: "target-plus-three-light-peers", identities: [expectedTargetIdentity, "home.spec.ts::concept learning sections keep their responsive grids without overflow", "simulator-header.spec.ts::keeps the active lesson context between the brand and desktop actions", "smoke.spec.ts::smoke: app boots at home"] },
  "m7o-d-r1": { condition: "D", configuredWorkers: 4, instrumentationEnabled: true, workload: "target-plus-three-renderer-heavy-peers", identities: [expectedTargetIdentity, "macro-bellows-extension.spec.ts::Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions", "macro-compound-movements.spec.ts::Macro 4 teaches compound Tilt + Swing + Focus through the public route", "mirror-shift-rig-lateral.spec.ts::Mirror Shift Camera focus follows the rig while Scene focus stays fixed"] },
  "m7o-d-r2": { condition: "D", configuredWorkers: 4, instrumentationEnabled: true, workload: "target-plus-three-renderer-heavy-peers", identities: [expectedTargetIdentity, "macro-bellows-extension.spec.ts::Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions", "macro-compound-movements.spec.ts::Macro 4 teaches compound Tilt + Swing + Focus through the public route", "mirror-shift-rig-lateral.spec.ts::Mirror Shift Camera focus follows the rig while Scene focus stays fixed"] },
  "m7o-d-r3": { condition: "D", configuredWorkers: 4, instrumentationEnabled: true, workload: "target-plus-three-renderer-heavy-peers", identities: [expectedTargetIdentity, "macro-bellows-extension.spec.ts::Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions", "macro-compound-movements.spec.ts::Macro 4 teaches compound Tilt + Swing + Focus through the public route", "mirror-shift-rig-lateral.spec.ts::Mirror Shift Camera focus follows the rig while Scene focus stays fixed"] },
};

const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown): string | null => typeof value === "string" ? value : null;
const asNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const approximatelyEqual = (left: number, right: number, tolerance = 1e-5) => Math.abs(left - right) <= tolerance;

const runGit = (args: string[]) => {
  const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const hasCommit = (sha: string) => runGit(["cat-file", "-e", `${sha}^{commit}`]).status === 0;
const hasTreePath = (sha: string, path: string) => runGit(["cat-file", "-e", `${sha}:${path}`]).status === 0;
const sameBlobAsWorkingTree = (sha: string, path: string) => {
  const sourceBlob = runGit(["rev-parse", `${sha}:${path}`]);
  const workingBlob = runGit(["hash-object", path]);
  return sourceBlob.status === 0 && workingBlob.status === 0 && sourceBlob.stdout.trim() === workingBlob.stdout.trim();
};

const safeReadArtifact = async (artifactPath: unknown, expectedDigest: unknown): Promise<ArtifactResult> => {
  if (typeof artifactPath !== "string" || !artifactPath || artifactPath.startsWith("/") || artifactPath.split(/[\\/]/).some((part) => part === "..")) {
    return { value: null, bytes: null };
  }
  const absolutePath = resolve(repositoryRoot, artifactPath);
  const rel = relative(repositoryRoot, absolutePath);
  if (rel.startsWith(`..${sep}`) || rel === ".." || !digestPattern.test(String(expectedDigest ?? ""))) return { value: null, bytes: null };
  try {
    const bytes = await readFile(absolutePath);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== expectedDigest) return { value: null, bytes };
    return { value: JSON.parse(bytes.toString("utf8")), bytes };
  } catch {
    return { value: null, bytes: null };
  }
};

const sorted = (values: string[]) => [...values].sort();
const median = (values: number[]) => {
  const items = [...values].sort((a, b) => a - b);
  if (items.length === 0) return null;
  const middle = Math.floor(items.length / 2);
  return items.length % 2 === 0 ? ((items[middle - 1] ?? 0) + (items[middle] ?? 0)) / 2 : items[middle] ?? null;
};

const getTimelineEnd = (capture: JsonRecord) => {
  const end = asNumber(capture.nodeResponseEndMs);
  const start = asNumber(capture.nodeRequestStartMs);
  const roundTrip = asNumber(capture.roundTripMs);
  return end !== null && start !== null && roundTrip !== null && end >= start && approximatelyEqual(roundTrip, end - start)
    ? { start, end }
    : null;
};

type DerivedCapture = {
  id: string;
  condition: string;
  targetOutcome: string;
  targetDurationMs: number | null;
  assertionFailure: boolean;
  failureSnapshotCanvasCount: number | null;
  firstCanvasObservedBeforeDeadline: boolean;
  sameSceneCanvasIdentityAtFailure: boolean;
  canvasRemovalOrReplacementObserved: boolean;
  aggregatedLocatorResolutionsAtZero: number | null;
  failureEvaluationRoundTripMs: number | null;
  failureEvaluationSampleAfterDeadline: boolean;
  overlappingLongTaskCount: number;
  maxLongTaskMs: number;
  browserHeartbeatMaxMs: number;
  nodeHeartbeatMaxExcessMs: number;
  diagnosticPollCount: number;
  diagnosticPollFirstCount: number | null;
  droppedEvents: number;
};

export type M7oEvaluationResult = {
  passed: boolean;
  issues: string[];
  summary: Record<string, unknown>;
};

export const evaluateM7oCanvasAssertionTimingEvidence = async (
  reportPath = "docs/architecture/GROUND_GLASS_M7O_CANVAS_ASSERTION_TIMING_REPORT.json",
): Promise<M7oEvaluationResult> => {
  const issues = new Set<string>();
  const issue = (name: string) => issues.add(name);
  let report: JsonRecord | null = null;
  try {
    const reportBytes = await readFile(resolve(repositoryRoot, reportPath));
    report = asRecord(JSON.parse(reportBytes.toString("utf8")));
  } catch {
    issue("m7o-report-unreadable");
  }
  if (!report) return { passed: false, issues: [...issues], summary: { evaluatorRevision: M7O_EVIDENCE_EVALUATOR_REVISION } };

  if (report.schemaVersion !== 1 || report.evaluatorRevision !== M7O_EVIDENCE_EVALUATOR_REVISION) issue("m7o-evaluator-schema-invalid");
  const captureEnvironment = asRecord(report.captureEnvironment);
  if (captureEnvironment?.host !== "macOS 27.0.1 (26A434), arm64"
    || captureEnvironment.nodeVersion !== "v24.3.0"
    || captureEnvironment.playwrightVersion !== "1.61.1"
    || captureEnvironment.browserName !== "Chromium"
    || captureEnvironment.browserVersion !== "149.0.7827.55"
    || captureEnvironment.playwrightBrowserRevision !== "chromium-1228 / chromium_headless_shell-1228"
    || captureEnvironment.browserExecution !== "Playwright bundled headless Chromium; standard chromium project"
    || captureEnvironment.rendererBackend !== "production-default WebGL; no WebGPU qualification or override enabled"
    || captureEnvironment.retries !== 0
    || captureEnvironment.rawPlaywrightReports !== "private-local-only") {
    issue("m7o-capture-environment-invalid");
  }
  const source = asRecord(report.source);
  const executionSourceSha = asString(source?.executionSourceCommitSha);
  const toolingSourceSha = asString(source?.toolingSourceCommitSha);
  const matrixNormalizerSourceSha = asString(source?.matrixNormalizerSourceCommitSha);
  const evidenceNormalizerSourceSha = asString(source?.evidenceNormalizerSourceCommitSha);
  const evaluationSourceSha = asString(source?.evaluationSourceCommitSha);
  if (executionSourceSha !== expectedExecutionSourceSha || !shaPattern.test(executionSourceSha ?? "")) issue("m7o-execution-source-identity-invalid");
  if (toolingSourceSha !== expectedToolingSourceSha || !shaPattern.test(toolingSourceSha ?? "")) issue("m7o-tooling-source-identity-invalid");
  if (matrixNormalizerSourceSha !== expectedMatrixNormalizerSourceSha || !shaPattern.test(matrixNormalizerSourceSha ?? "")) issue("m7o-matrix-normalizer-source-identity-invalid");
  if (evidenceNormalizerSourceSha !== expectedMatrixNormalizerSourceSha || !shaPattern.test(evidenceNormalizerSourceSha ?? "")) issue("m7o-evidence-normalizer-source-identity-invalid");
  if (!shaPattern.test(evaluationSourceSha ?? "")) issue("m7o-evaluator-source-identity-invalid");

  const sourceContracts = [
    { sha: executionSourceSha, paths: ["playwright.config.ts", "src/components/simulator/SceneViewport.tsx"] },
    { sha: toolingSourceSha, paths: ["src/tests/e2e/helpers/m7oCanvasAssertionTimingCapture.ts", "src/tests/e2e/architecture-rise-focus-range.spec.ts", "scripts/run-m7o-canvas-assertion-timing.mjs", "scripts/normalizeM7oCanvasAssertionTimingCapture.mjs"] },
    { sha: matrixNormalizerSourceSha, paths: ["scripts/normalizeM7oCanvasAssertionTimingMatrix.mjs", "scripts/normalizeM7oCanvasAssertionTimingCapture.mjs"] },
    { sha: evaluationSourceSha, paths: ["scripts/evaluateM7oCanvasAssertionTiming.ts", "scripts/run-m7o-evidence.mjs", "src/tests/unit/m7oCanvasAssertionTimingEvidence.test.ts"] },
  ];
  for (const contract of sourceContracts) {
    if (!contract.sha || !hasCommit(contract.sha)) {
      issue("m7o-source-commit-unavailable");
      continue;
    }
    for (const path of contract.paths) if (!hasTreePath(contract.sha, path)) issue("m7o-source-tree-entry-missing");
  }
  if (evaluationSourceSha && !sameBlobAsWorkingTree(evaluationSourceSha, "scripts/evaluateM7oCanvasAssertionTiming.ts")) {
    issue("m7o-evaluator-source-content-mismatch");
  }

  const manifestRef = asRecord(report.captureManifest);
  const manifestArtifact = await safeReadArtifact(manifestRef?.artifactPath, manifestRef?.sha256);
  const manifest = asRecord(manifestArtifact.value);
  if (!manifest) issue("m7o-capture-manifest-integrity-invalid");
  const manifestRows = asArray(manifest?.artifacts).map(asRecord).filter((entry): entry is JsonRecord => entry !== null);
  if (manifestRows.length !== Object.keys(captureContracts).length || manifest?.attemptsPerCondition !== 3) issue("m7o-capture-matrix-incomplete");
  const manifestSource = asRecord(manifest?.source);
  if (manifestSource?.executionSourceCommitSha !== executionSourceSha || manifestSource?.toolingSourceCommitSha !== toolingSourceSha || manifestSource?.matrixNormalizerSourceCommitSha !== matrixNormalizerSourceSha || manifestSource?.evidenceNormalizerSourceCommitSha !== evidenceNormalizerSourceSha) {
    issue("m7o-manifest-source-identity-invalid");
  }

  const rowsById = new Map<string, JsonRecord>();
  for (const row of manifestRows) {
    const id = asString(row.captureId);
    if (!id || rowsById.has(id) || !captureContracts[id]) issue("m7o-capture-manifest-identities-invalid");
    else rowsById.set(id, row);
  }

  const derivedCaptures: DerivedCapture[] = [];
  for (const [captureId, contract] of Object.entries(captureContracts)) {
    const manifestRow = rowsById.get(captureId);
    if (!manifestRow) {
      issue("m7o-required-capture-missing");
      continue;
    }
    const artifact = await safeReadArtifact(manifestRow.artifactPath, manifestRow.artifactSha256);
    const capture = asRecord(artifact.value);
    if (!capture) {
      issue("m7o-capture-artifact-integrity-invalid");
      continue;
    }
    if (capture.schemaVersion !== 1 || capture.evaluatorRevision !== M7O_EVIDENCE_EVALUATOR_REVISION || capture.captureId !== captureId || capture.condition !== contract.condition || capture.workload !== contract.workload) {
      issue("m7o-capture-identity-invalid");
    }
    const captureSource = asRecord(capture.source);
    if (captureSource?.executionSourceCommitSha !== executionSourceSha || captureSource.toolingSourceCommitSha !== toolingSourceSha || captureSource.matrixNormalizerSourceCommitSha !== matrixNormalizerSourceSha) {
      issue("m7o-capture-source-identity-invalid");
    }
    if (captureSource?.normalizerSourceCommitSha !== evidenceNormalizerSourceSha || !shaPattern.test(String(captureSource?.normalizerSourceCommitSha ?? ""))) {
      issue("m7o-normalizer-source-identity-invalid");
    }
    const rawCapture = asRecord(capture.rawCapture);
    if (!digestPattern.test(String(rawCapture?.sha256 ?? "")) || (asNumber(rawCapture?.bytes) ?? 0) <= 0 || rawCapture?.retention !== "private-local-only") {
      issue("m7o-raw-capture-provenance-invalid");
    }
    const configuration = asRecord(capture.configuration);
    if (configuration?.configuredWorkers !== contract.configuredWorkers || configuration?.retries !== 0 || configuration?.diagnosticInstrumentationEnabled !== contract.instrumentationEnabled || configuration?.project !== "chromium") {
      issue("m7o-capture-configuration-invalid");
    }
    const provenance = asRecord(capture.provenance);
    if (provenance?.playwrightVersion !== captureEnvironment?.playwrightVersion || provenance?.nodeVersion !== captureEnvironment?.nodeVersion) {
      issue("m7o-capture-runtime-provenance-invalid");
    }
    const selectedIdentities = asArray(configuration?.selectedIdentities).filter((identity): identity is string => typeof identity === "string");
    if (JSON.stringify(sorted(selectedIdentities)) !== JSON.stringify(sorted(contract.identities))) issue("m7o-selected-test-identities-invalid");

    const execution = asRecord(capture.execution);
    const selectedTests = asArray(execution?.selectedTests).map(asRecord).filter((entry): entry is JsonRecord => entry !== null);
    const testIdentities = selectedTests.map((test) => asString(test.identity) ?? "");
    if (selectedTests.length !== contract.identities.length || new Set(testIdentities).size !== contract.identities.length || JSON.stringify(sorted(testIdentities)) !== JSON.stringify(sorted(contract.identities))) {
      issue("m7o-selected-test-results-incomplete");
    }
    if (selectedTests.some((test) => test.retry !== 0 || test.projectName !== "chromium" || !Number.isFinite(Date.parse(String(test.startTime))) || (asNumber(test.durationMs) ?? -1) < 0)) {
      issue("m7o-test-outcome-timing-invalid");
    }
    const statusCounts = selectedTests.reduce<Record<string, number>>((counts, test) => {
      const status = asString(test.outcome) ?? "unknown";
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});
    if (execution?.discovered !== contract.identities.length || execution.retries !== 0 || execution.observedConcurrency !== contract.configuredWorkers || execution.passed !== (statusCounts.passed ?? 0) || execution.failed !== (statusCounts.failed ?? 0) || execution.timedOut !== (statusCounts.timedOut ?? 0) || execution.skipped !== (statusCounts.skipped ?? 0) || execution.incomplete !== (statusCounts.interrupted ?? 0)) {
      issue("m7o-outcome-or-concurrency-summary-invalid");
    }
    const targetTest = selectedTests.find((test) => test.identity === expectedTargetIdentity);
    const targetOutcome = asString(targetTest?.outcome) ?? "missing";
    const diagnostic = asRecord(capture.diagnosticCapture);
    if (contract.instrumentationEnabled && !diagnostic) issue("m7o-instrumentation-capture-missing");
    if (!contract.instrumentationEnabled && diagnostic !== null) issue("m7o-instrumentation-off-control-invalid");
    if (execution?.targetAssertionOutcome !== (targetOutcome === "passed" ? "passed" : "failed")) issue("m7o-target-assertion-outcome-invalid");

    let failureSnapshotCanvasCount: number | null = null;
    let firstCanvasObservedBeforeDeadline = false;
    let sameSceneCanvasIdentityAtFailure = false;
    let canvasRemovalOrReplacementObserved = false;
    let failureEvaluationRoundTripMs: number | null = null;
    let failureEvaluationSampleAfterDeadline = false;
    let overlappingLongTaskCount = 0;
    let maxLongTaskMs = 0;
    let browserHeartbeatMaxMs = 0;
    let nodeHeartbeatMaxExcessMs = 0;
    let diagnosticPollCount = 0;
    let diagnosticPollFirstCount: number | null = null;
    let droppedEvents = 0;
    const targetFailureEvidence = asRecord(execution?.targetFailureEvidence);
    const aggregatedLocatorResolutionsAtZero = asNumber(targetFailureEvidence?.aggregatedLocatorResolutionsAtZero);
    if (targetOutcome === "failed" && (
      targetFailureEvidence?.matcher !== "toHaveCount"
      || targetFailureEvidence?.expectedCount !== 1
      || targetFailureEvidence?.receivedCount !== 0
      || targetFailureEvidence?.timeoutMs !== 5000
      || (aggregatedLocatorResolutionsAtZero ?? 0) < 1
      || targetFailureEvidence?.perObservationTimestampsAvailable !== false
    )) issue("m7o-playwright-failure-call-log-invalid");
    if (targetOutcome === "passed" && targetFailureEvidence !== null) issue("m7o-unexpected-target-failure-evidence");

    if (diagnostic) {
      const diagnosticAttempt = asRecord(diagnostic.testAttempt);
      if (diagnostic.evaluatorRevision !== M7O_EVIDENCE_EVALUATOR_REVISION || diagnosticAttempt?.retry !== 0 || diagnosticAttempt?.projectName !== "chromium") {
        issue("m7o-diagnostic-attempt-identity-invalid");
      }
      const assertion = asRecord(diagnostic.assertion);
      if (assertion?.matcher !== "toHaveCount(1)" || assertion?.configuredTimeoutMs !== 5000 || assertion?.deadlineNature !== "budget-derived, not an observed final matcher poll" || assertion?.observationSemantics !== "Playwright locator matcher retries internally; installed public API has no per-retry observation hook.") {
        issue("m7o-assertion-contract-invalid");
      }
      const nodeCallStart = asNumber(assertion?.nodeCallEntryMonotonicMs);
      const deadline = asNumber(assertion?.inferredDeadlineNodeMonotonicMs);
      const nodeCallEnd = asNumber(assertion?.nodeCallSettlementMonotonicMs);
      const elapsed = asNumber(assertion?.elapsedMs);
      if (nodeCallStart === null || deadline === null || nodeCallEnd === null || elapsed === null || !approximatelyEqual(deadline, nodeCallStart + 5000) || nodeCallEnd < nodeCallStart || !approximatelyEqual(elapsed, nodeCallEnd - nodeCallStart)) {
        issue("m7o-assertion-timing-invalid");
      }
      if (assertion?.outcome !== (targetOutcome === "passed" ? "passed" : "failed")) issue("m7o-assertion-outcome-disagrees-with-playwright");

      const boundaries = asArray(diagnostic.browserBoundaries).map(asRecord).filter((entry): entry is JsonRecord => entry !== null);
      const anchorRows = boundaries.flatMap((boundary) => {
        const window = getTimelineEnd(boundary);
        const browser = asRecord(boundary.browser);
        const browserMs = asNumber(browser?.sampledAtPageMonotonicMs);
        if (!window || browserMs === null || asNumber(browser?.performanceTimeOriginMs) === null) return [];
        return [{
          label: boundary.label,
          browserMs,
          lower: window.start - browserMs,
          upper: window.end - browserMs,
        }];
      });
      if (contract.instrumentationEnabled && boundaries.length < 2) issue("m7o-clock-anchor-missing");
      if (boundaries.some((boundary) => !getTimelineEnd(boundary) || !asRecord(boundary.browser))) issue("m7o-evaluation-boundary-invalid");

      const alignment = asRecord(capture.clockAlignment);
      const offsetBounds = asRecord(alignment?.commonOffsetBounds);
      const expectedLower = anchorRows.length ? Math.max(...anchorRows.map((anchor) => anchor.lower)) : null;
      const expectedUpper = anchorRows.length ? Math.min(...anchorRows.map((anchor) => anchor.upper)) : null;
      const isBounded = expectedLower !== null && expectedUpper !== null && expectedLower <= expectedUpper;
      if (alignment?.domains?.toString() !== "Node performance.now() monotonic,browser performance.now() monotonic" || alignment?.browserTimeOriginRetainedPerObservation !== true || alignment?.eventObservationsAreCallbackOrEvaluationTimes !== true) {
        issue("m7o-clock-domain-contract-invalid");
      }
      if (anchorRows.length > 0 && (!offsetBounds || (isBounded && (alignment?.status !== "bounded-by-overlapping-request-response-anchors" || !approximatelyEqual(asNumber(offsetBounds.minimumMs) ?? NaN, expectedLower ?? NaN) || !approximatelyEqual(asNumber(offsetBounds.maximumMs) ?? NaN, expectedUpper ?? NaN))) || (!isBounded && alignment?.status !== "anchors-do-not-intersect; conservative-union-only"))) {
        issue("m7o-cross-clock-alignment-invalid");
      }
      const safeOffset = isBounded ? { lower: expectedLower as number, upper: expectedUpper as number } : null;
      const mapBrowserEvent = (browserMs: number) => safeOffset ? [browserMs + safeOffset.lower, browserMs + safeOffset.upper] as const : null;

      const failureBoundary = asRecord(diagnostic.assertionCatchBoundary);
      const failureBrowser = asRecord(failureBoundary?.browser);
      const userAgent = asString(asRecord(failureBrowser?.dom)?.browserUserAgent)
        ?? boundaries.map((boundary) => asString(asRecord(asRecord(boundary.browser)?.dom)?.browserUserAgent)).find(Boolean)
        ?? null;
      if (contract.instrumentationEnabled && (!userAgent || !userAgent.includes(`Chrome/${String(captureEnvironment?.browserVersion ?? "")}`))) {
        issue("m7o-browser-version-provenance-invalid");
      }
      const failureDom = asRecord(failureBrowser?.dom);
      const failureCanvases = asArray(failureDom?.sceneContainers).flatMap((scene) => asArray(asRecord(scene)?.canvases));
      failureSnapshotCanvasCount = asNumber(failureDom?.totalCanvasCount);
      const failureStart = asNumber(assertion?.nodeCallEntryMonotonicMs);
      const failureDeadline = asNumber(assertion?.inferredDeadlineNodeMonotonicMs);
      const catchRequest = asNumber(failureBoundary?.nodeRequestStartMs);
      const catchResponse = asNumber(failureBoundary?.nodeResponseEndMs);
      failureEvaluationRoundTripMs = asNumber(failureBoundary?.roundTripMs);
      const failureSample = asNumber(failureBrowser?.sampledAtPageMonotonicMs);
      if (assertion?.outcome === "failed") {
        if (failureDom?.route !== "/simulator/free/architecture-rise" || failureSnapshotCanvasCount !== 1 || failureCanvases.length !== 1) issue("m7o-failure-boundary-snapshot-invalid");
        if (catchRequest === null || catchResponse === null || failureStart === null || catchRequest < failureStart || catchResponse < catchRequest) issue("m7o-catch-snapshot-boundary-invalid");
        if (safeOffset && failureDeadline !== null && failureSample !== null) {
          const sampleInterval = mapBrowserEvent(failureSample);
          failureEvaluationSampleAfterDeadline = sampleInterval !== null && sampleInterval[0] > failureDeadline;
        }
      }

      const transitions = asArray(failureBrowser?.transitions).map(asRecord).filter((entry): entry is JsonRecord => entry !== null);
      const transitionTimes = transitions.map((transition) => asNumber(transition.observedAtPageMonotonicMs));
      if (transitionTimes.some((timestamp) => timestamp === null) || transitionTimes.some((timestamp, index) => index > 0 && timestamp !== null && (transitionTimes[index - 1] ?? 0) > timestamp)) {
        issue("m7o-browser-transition-order-invalid");
      }
      const firstCanvasTransitionIndex = transitions.findIndex((transition) => (asNumber(asRecord(transition.current)?.totalCanvasCount) ?? 0) > 0);
      const firstCanvasTransition = firstCanvasTransitionIndex >= 0 ? transitions[firstCanvasTransitionIndex] : null;
      const firstCanvasBrowserMs = asNumber(firstCanvasTransition?.observedAtPageMonotonicMs);
      const firstCanvasDom = asRecord(firstCanvasTransition?.current);
      const firstScene = asRecord(asArray(firstCanvasDom?.sceneContainers)[0]);
      const firstCanvas = asRecord(asArray(firstScene?.canvases)[0]);
      if (safeOffset && failureDeadline !== null && firstCanvasBrowserMs !== null) {
        const firstCanvasInterval = mapBrowserEvent(firstCanvasBrowserMs);
        firstCanvasObservedBeforeDeadline = firstCanvasInterval !== null && firstCanvasInterval[1] < failureDeadline;
      }
      const failureScene = asRecord(asArray(failureDom?.sceneContainers)[0]);
      const failureCanvas = asRecord(asArray(failureScene?.canvases)[0]);
      sameSceneCanvasIdentityAtFailure = firstScene?.identity === failureScene?.identity
        && firstCanvas?.identity === failureCanvas?.identity
        && firstScene?.sceneId === "architecture-rise"
        && failureScene?.sceneId === "architecture-rise"
        && failureScene?.isConnected === true
        && failureCanvas?.isConnected === true;
      if (assertion?.outcome === "failed" && firstCanvasTransitionIndex >= 0) {
        canvasRemovalOrReplacementObserved = transitions.slice(firstCanvasTransitionIndex + 1).some((transition) => {
          const current = asRecord(transition.current);
          const currentScenes = asArray(current?.sceneContainers).map(asRecord).filter((entry): entry is JsonRecord => entry !== null);
          const currentCanvases = currentScenes.flatMap((scene) => asArray(scene.canvases).map(asRecord).filter((entry): entry is JsonRecord => entry !== null));
          return currentCanvases.length !== 1 || currentScenes.length !== 1 || currentScenes[0]?.identity !== firstScene?.identity || currentCanvases[0]?.identity !== firstCanvas?.identity;
        });
        if (!firstCanvasObservedBeforeDeadline || !sameSceneCanvasIdentityAtFailure || canvasRemovalOrReplacementObserved) issue("m7o-failure-dom-identity-evidence-invalid");
      }

      const longTasks = asArray(failureBrowser?.longTasks).map(asRecord).filter((entry): entry is JsonRecord => entry !== null);
      const longTaskStarts = longTasks.map((task) => asNumber(task.startTimeMs));
      if (longTaskStarts.some((timestamp) => timestamp === null) || longTaskStarts.some((timestamp, index) => index > 0 && timestamp !== null && (longTaskStarts[index - 1] ?? 0) > timestamp) || longTasks.some((task) => (asNumber(task.durationMs) ?? -1) <= 0)) {
        issue("m7o-long-task-timing-invalid");
      }
      maxLongTaskMs = Math.max(0, ...longTasks.map((task) => asNumber(task.durationMs) ?? 0));
      if (safeOffset && failureStart !== null && failureDeadline !== null) {
        overlappingLongTaskCount = longTasks.filter((task) => {
          const taskStart = asNumber(task.startTimeMs);
          const duration = asNumber(task.durationMs);
          if (taskStart === null || duration === null) return false;
          const startInterval = mapBrowserEvent(taskStart);
          const endInterval = mapBrowserEvent(taskStart + duration);
          return startInterval !== null && endInterval !== null
            && startInterval[1] < failureDeadline
            && endInterval[0] > failureStart;
        }).length;
      }
      const heartbeat = asRecord(failureBrowser?.heartbeat);
      const browserDelays = asArray(failureBrowser?.heartbeatDelays).map(asRecord).filter((entry): entry is JsonRecord => entry !== null);
      if (heartbeat?.available === true && (heartbeat.expectedIntervalMs !== 100 || heartbeat.delayedCallbackThresholdMs !== 50 || (asNumber(heartbeat.callbackCount) ?? -1) < 0)) {
        issue("m7o-browser-heartbeat-contract-invalid");
      }
      browserHeartbeatMaxMs = asNumber(heartbeat?.maxActualIntervalMs) ?? 0;
      if (browserDelays.some((delay) => (asNumber(delay.excessDelayMs) ?? -1) < 50 || !approximatelyEqual(asNumber(delay.excessDelayMs) ?? NaN, (asNumber(delay.actualIntervalMs) ?? NaN) - 100))) {
        issue("m7o-browser-heartbeat-delay-invalid");
      }
      const scheduling = asRecord(diagnostic.browserAndNodeScheduling);
      const nodeHeartbeat = asRecord(scheduling?.nodeHeartbeat);
      const nodeDelays = asArray(nodeHeartbeat?.delays).map(asRecord).filter((entry): entry is JsonRecord => entry !== null);
      if (nodeHeartbeat?.expectedIntervalMs !== 100 || nodeHeartbeat?.delayedCallbackThresholdMs !== 50 || nodeDelays.some((delay) => (asNumber(delay.excessDelayMs) ?? -1) < 50)) {
        issue("m7o-node-heartbeat-contract-invalid");
      }
      nodeHeartbeatMaxExcessMs = asNumber(nodeHeartbeat?.maxExcessDelayMs) ?? 0;
      const droppedSummary = asRecord(diagnostic.droppedEventCounts);
      droppedEvents = Object.values(droppedSummary ?? {}).reduce<number>((total, value) => total + (asNumber(value) ?? 0), 0);
      const browserDropped = asRecord(failureBrowser?.droppedEventCounts);
      droppedEvents += Object.values(browserDropped ?? {}).reduce<number>((total, value) => total + (asNumber(value) ?? 0), 0);
      if (Object.values(droppedSummary ?? {}).some((value) => (asNumber(value) ?? -1) < 0) || Object.values(browserDropped ?? {}).some((value) => (asNumber(value) ?? -1) < 0)) {
        issue("m7o-dropped-event-count-invalid");
      }

      const poll = asRecord(diagnostic.diagnosticPoll);
      const pollObservations = asArray(poll?.observations).map(asRecord).filter((entry): entry is JsonRecord => entry !== null);
      diagnosticPollCount = pollObservations.length;
      diagnosticPollFirstCount = asNumber(pollObservations[0]?.count);
      if (poll?.implementation !== "independent public expect.poll callback; never an internal toHaveCount retry trace" || poll?.executed !== (pollObservations.length > 0)) {
        issue("m7o-diagnostic-poll-contract-invalid");
      }
      if (pollObservations.some((observation) => !getTimelineEnd({
        nodeRequestStartMs: observation.nodeRequestStartMs,
        nodeResponseEndMs: observation.nodeResponseEndMs,
        roundTripMs: (asNumber(observation.nodeResponseEndMs) ?? NaN) - (asNumber(observation.nodeRequestStartMs) ?? NaN),
      }) || asNumber(observation.browserMonotonicMs) === null || asNumber(observation.count) === null)) {
        issue("m7o-diagnostic-poll-observation-invalid");
      }
      if (assertion?.outcome === "failed" && (diagnosticPollCount < 1 || diagnosticPollFirstCount !== 1)) issue("m7o-post-failure-poll-observation-invalid");
      const pollSettlement = asArray(diagnostic.nodeTimeline).map(asRecord).find((entry) => entry?.event === "separate-diagnostic-expect-poll-settled");
      if (pollObservations.length > 0 && asString(asRecord(pollSettlement?.detail)?.primaryAssertionOutcomeUnchanged) !== "failed") {
        issue("m7o-primary-assertion-outcome-not-preserved");
      }
    }

    const manifestComparison = {
      targetOutcome,
      observedConcurrency: execution?.observedConcurrency ?? null,
      statusCounts: {
        passed: execution?.passed ?? null,
        failed: execution?.failed ?? null,
        timedOut: execution?.timedOut ?? null,
        skipped: execution?.skipped ?? null,
      },
    };
    const unexpectedOutcomeCount = Number(manifestComparison.statusCounts.failed ?? 0) + Number(manifestComparison.statusCounts.timedOut ?? 0) + Number(manifestComparison.statusCounts.skipped ?? 0);
    if (manifestRow.runnerExitCode !== (unexpectedOutcomeCount > 0 ? 1 : 0)) {
      issue("m7o-runner-exit-status-inconsistent");
    }
    if (manifestRow.observedConcurrency !== execution?.observedConcurrency || manifestRow.targetAssertionOutcome !== targetOutcome) issue("m7o-manifest-outcome-summary-inconsistent");
    const manifestCounts = asRecord(manifestRow.statusCounts);
    if (manifestCounts?.passed !== execution?.passed || manifestCounts?.failed !== execution?.failed || manifestCounts?.timedOut !== execution?.timedOut || manifestCounts?.skipped !== execution?.skipped) {
      issue("m7o-manifest-status-counts-inconsistent");
    }

    derivedCaptures.push({
      id: captureId,
      condition: contract.condition,
      targetOutcome,
      targetDurationMs: asNumber(targetTest?.durationMs),
      assertionFailure: asRecord(diagnostic?.assertion)?.outcome === "failed",
      failureSnapshotCanvasCount,
      firstCanvasObservedBeforeDeadline,
      sameSceneCanvasIdentityAtFailure,
      canvasRemovalOrReplacementObserved,
      aggregatedLocatorResolutionsAtZero,
      failureEvaluationRoundTripMs,
      failureEvaluationSampleAfterDeadline,
      overlappingLongTaskCount,
      maxLongTaskMs,
      browserHeartbeatMaxMs,
      nodeHeartbeatMaxExcessMs,
      diagnosticPollCount,
      diagnosticPollFirstCount,
      droppedEvents,
    });
  }

  const outcomesFor = (condition: string) => derivedCaptures.filter((capture) => capture.condition === condition);
  const targetsByCondition = Object.fromEntries(["A", "B", "C", "D"].map((condition) => [condition, outcomesFor(condition).map((capture) => capture.targetOutcome)]));
  const instrumentationOffDurations = outcomesFor("A").flatMap((capture) => capture.targetDurationMs === null ? [] : [capture.targetDurationMs]);
  const instrumentationOnDurations = outcomesFor("B").flatMap((capture) => capture.targetDurationMs === null ? [] : [capture.targetDurationMs]);
  const failureCaptures = derivedCaptures.filter((capture) => capture.assertionFailure);
  const computed = {
    attemptsPerCondition: Object.fromEntries(["A", "B", "C", "D"].map((condition) => [condition, outcomesFor(condition).length])),
    targetOutcomesByCondition: targetsByCondition,
    instrumentationOverhead: {
      instrumentationOffWholeTestDurationsMs: instrumentationOffDurations,
      instrumentationOnWholeTestDurationsMs: instrumentationOnDurations,
      medianOffMs: median(instrumentationOffDurations),
      medianOnMs: median(instrumentationOnDurations),
      medianOnMinusOffMs: (median(instrumentationOnDurations) ?? 0) - (median(instrumentationOffDurations) ?? 0),
      interpretation: "whole-test durations include browser instrumentation and diagnostic teardown; three pairs do not isolate its causal cost",
    },
    failureAnalysis: {
      targetFailures: failureCaptures.length,
      failureSnapshotsWithOneCanvas: failureCaptures.filter((capture) => capture.failureSnapshotCanvasCount === 1).length,
      firstCanvasObservedBeforeBudgetDeadline: failureCaptures.filter((capture) => capture.firstCanvasObservedBeforeDeadline).length,
      sameSceneAndCanvasIdentityAtFailure: failureCaptures.filter((capture) => capture.sameSceneCanvasIdentityAtFailure).length,
      canvasRemovalOrReplacementObserved: failureCaptures.filter((capture) => capture.canvasRemovalOrReplacementObserved).length,
      failuresWithLongTaskOverlap: failureCaptures.filter((capture) => capture.overlappingLongTaskCount > 0).length,
      maxLongTaskDurationsMs: failureCaptures.map((capture) => capture.maxLongTaskMs),
      immediateCatchEvaluationRoundTripMs: failureCaptures.map((capture) => capture.failureEvaluationRoundTripMs),
      catchEvaluationSampleAfterBudgetDeadline: failureCaptures.filter((capture) => capture.failureEvaluationSampleAfterDeadline).length,
      browserHeartbeatMaxIntervalsMs: failureCaptures.map((capture) => capture.browserHeartbeatMaxMs),
      nodeHeartbeatMaxExcessDelayMs: failureCaptures.map((capture) => capture.nodeHeartbeatMaxExcessMs),
      postFailurePollCounts: failureCaptures.map((capture) => capture.diagnosticPollFirstCount),
      aggregatedLocatorResolutionsAtZero: failureCaptures.map((capture) => capture.aggregatedLocatorResolutionsAtZero),
      totalDroppedEvents: derivedCaptures.reduce((total, capture) => total + capture.droppedEvents, 0),
    },
  };

  const reportedSummary = asRecord(report.experimentSummary);
  if (!reportedSummary || JSON.stringify(reportedSummary) !== JSON.stringify(computed)) issue("m7o-derived-summary-mismatch");
  const diagnosis = asRecord(report.diagnosis);
  const hypotheses = asRecord(diagnosis?.hypotheses);
  const claims = asRecord(diagnosis?.claims);
  if (diagnosis?.rootCause !== "unresolved" || diagnosis?.remediationDecision !== "scheduling-pressure-supported-cause-unresolved") issue("m7o-causal-classification-overstates-evidence");
  if (hypotheses?.H1 !== "supported-but-unproven" || hypotheses?.H2 !== "supported-but-unproven" || hypotheses?.H3 !== "contradicted" || hypotheses?.H4 !== "supported-but-unproven" || hypotheses?.H5 !== "inconclusive") {
    issue("m7o-hypothesis-classification-invalid");
  }
  if (claims?.exactInternalToHaveCountPolls === true) issue("m7o-internal-poll-claim-unsupported");
  if (claims?.canvasAbsentAtFailureSnapshot === true && computed.failureAnalysis.failureSnapshotsWithOneCanvas > 0) issue("m7o-failure-snapshot-claim-contradicted");
  if (claims?.firstCanvasObservedBeforeBudgetDeadline !== computed.failureAnalysis.firstCanvasObservedBeforeBudgetDeadline) issue("m7o-canvas-deadline-claim-inconsistent");
  if (claims?.longTaskOverlapsAssertionWindow !== computed.failureAnalysis.failuresWithLongTaskOverlap) issue("m7o-long-task-overlap-claim-inconsistent");
  if (JSON.stringify(claims?.aggregatedCallLogZeroResolutionCounts) !== JSON.stringify(computed.failureAnalysis.aggregatedLocatorResolutionsAtZero)) issue("m7o-playwright-call-log-claim-inconsistent");
  if (claims?.gpuSaturation === "established" || claims?.gpuCausation === "confirmed") issue("m7o-gpu-causation-unsupported");
  if (claims?.nodeEventLoopCause === "confirmed" && computed.failureAnalysis.nodeHeartbeatMaxExcessDelayMs.every((delay) => delay < 50)) issue("m7o-node-event-loop-cause-unsupported");
  if (claims?.sameSceneAndCanvasIdentityAtFailure !== computed.failureAnalysis.sameSceneAndCanvasIdentityAtFailure) issue("m7o-locator-identity-claim-inconsistent");
  if (claims?.verifiedApplicationFixes !== 0) issue("m7o-unverified-fix-claim");
  if (claims?.originalAssertionPreserved !== true || claims?.retries !== 0) issue("m7o-original-test-semantics-invalid");

  const qualification = asRecord(report.qualification);
  if (qualification?.fullBroadE2e !== "not-run" || qualification?.broadE2eQualification !== "not-qualified") issue("m7o-broad-e2e-qualification-boundary-invalid");
  if (qualification?.m7Overall !== "partially-qualified" || qualification.m8Entry !== "denied") issue("m7o-milestone-authorization-boundary-invalid");
  if (qualification?.spontaneousExternalGpuDeviceLoss !== "blocked" || qualification?.productionGroundGlass !== "webgl-only" || qualification?.productionWebGpu !== "disabled") {
    issue("m7o-production-renderer-boundary-invalid");
  }

  const summary = {
    evaluatorRevision: M7O_EVIDENCE_EVALUATOR_REVISION,
    captureCount: derivedCaptures.length,
    targetOutcomesByCondition: computed.targetOutcomesByCondition,
    targetFailureCount: computed.failureAnalysis.targetFailures,
    catchSnapshotsWithCanvas: computed.failureAnalysis.failureSnapshotsWithOneCanvas,
    failuresWithLongTaskOverlap: computed.failureAnalysis.failuresWithLongTaskOverlap,
    diagnosticPollsAfterFailure: failureCaptures.reduce((total, capture) => total + capture.diagnosticPollCount, 0),
    rootCause: diagnosis?.rootCause ?? null,
    broadE2eQualification: qualification?.broadE2eQualification ?? null,
    m7Overall: qualification?.m7Overall ?? null,
    m8Entry: qualification?.m8Entry ?? null,
    experimentSummary: computed,
  };
  return { passed: issues.size === 0, issues: [...issues].sort(), summary };
};

if (process.env.M7O_CANVAS_TIMING_CLI === "1" || (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))) {
  const reportArgument = process.argv.slice(2).find((argument) => argument.startsWith("--report-path="));
  const path = reportArgument?.slice("--report-path=".length) ?? "docs/architecture/GROUND_GLASS_M7O_CANVAS_ASSERTION_TIMING_REPORT.json";
  const result = await evaluateM7oCanvasAssertionTimingEvidence(path);
  process.stdout.write(`M7O evidence integrity: ${result.passed ? "PASS" : "FAIL"}\n`);
  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
  if (!result.passed) {
    for (const issueName of result.issues) process.stderr.write(`- ${issueName}\n`);
    process.exitCode = 1;
  }
}
