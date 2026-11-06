import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const M7P_EVIDENCE_EVALUATOR_REVISION = "m7p-assertion-scheduling-evaluator-v1";
const repositoryRoot = resolve(process.env.M7P_ASSERTION_SCHEDULING_REPO_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const shaPattern = /^[0-9a-f]{40}$/i;
const digestPattern = /^[0-9a-f]{64}$/i;
const targetIdentity = "Architecture Rise focus control stays within scene depth and preserves thin-lens extension";
const conditions = {
  P1: { attempts: 3, configuredWorkers: 1, tracing: false, syntheticStallMs: 0 },
  P2: { attempts: 3, configuredWorkers: 1, tracing: true, syntheticStallMs: 0 },
  P3: { attempts: 3, configuredWorkers: 4, tracing: true, syntheticStallMs: 0 },
  "P4-off": { attempts: 3, configuredWorkers: 4, tracing: false, syntheticStallMs: 0 },
  "P4-trace": { attempts: 3, configuredWorkers: 4, tracing: true, syntheticStallMs: 0 },
  P5: { attempts: 3, configuredWorkers: 1, tracing: true, syntheticStallMs: 5_400 },
} as const;
const requiredSourceFiles = {
  execution: ["playwright.config.ts", "src/tests/e2e/architecture-rise-focus-range.spec.ts"],
  instrumentation: ["src/tests/e2e/helpers/m7pAssertionSchedulingCapture.ts"],
  runner: ["scripts/run-m7p-assertion-scheduling.mjs"],
  normalizer: ["scripts/normalizeM7pAssertionSchedulingCapture.mjs"],
  evaluator: ["scripts/evaluateM7pAssertionScheduling.ts", "scripts/run-m7p-evidence.mjs", "src/tests/unit/m7pAssertionSchedulingEvidence.test.ts"],
};
const captureSourceFieldByReportField = {
  executionSourceCommitSha: "executionCommitSha",
  instrumentationSourceCommitSha: "instrumentationCommitSha",
  normalizerSourceCommitSha: "normalizerCommitSha",
  evaluatorSourceCommitSha: "captureEvaluatorCommitSha",
} as const;
const requiredTestFilesByCondition: Record<string, string[]> = {
  P1: ["architecture-rise-focus-range.spec.ts"],
  P2: ["architecture-rise-focus-range.spec.ts"],
  P3: ["architecture-rise-focus-range.spec.ts", "home.spec.ts", "simulator-header.spec.ts", "smoke.spec.ts"],
  "P4-off": ["architecture-rise-focus-range.spec.ts", "macro-bellows-extension.spec.ts", "macro-compound-movements.spec.ts", "mirror-shift-rig-lateral.spec.ts"],
  "P4-trace": ["architecture-rise-focus-range.spec.ts", "macro-bellows-extension.spec.ts", "macro-compound-movements.spec.ts", "mirror-shift-rig-lateral.spec.ts"],
  P5: ["architecture-rise-focus-range.spec.ts"],
};
const targetTestFile = "architecture-rise-focus-range.spec.ts";
const peerTestIdentityByFile: Record<string, string> = {
  "home.spec.ts": "concept learning sections keep their responsive grids without overflow",
  "simulator-header.spec.ts": "keeps the active lesson context between the brand and desktop actions",
  "smoke.spec.ts": "smoke: app boots at home",
  "macro-bellows-extension.spec.ts": "Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions",
  "macro-compound-movements.spec.ts": "Macro 4 teaches compound Tilt + Swing + Focus through the public route",
  "mirror-shift-rig-lateral.spec.ts": "Mirror Shift Camera focus follows the rig while Scene focus stays fixed",
};

type JsonRecord = Record<string, unknown>;
type EvaluationResult = { passed: boolean; issues: string[]; summary: Record<string, unknown> };
const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown): string | null => typeof value === "string" ? value : null;
const asNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const sameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const runGit = (args: string[]) => spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
const hasCommit = (sha: string) => runGit(["cat-file", "-e", `${sha}^{commit}`]).status === 0;
const hasTreePath = (sha: string, path: string) => runGit(["cat-file", "-e", `${sha}:${path}`]).status === 0;
const sameBlobAsWorkingTree = (sha: string, path: string) => {
  const sourceBlob = runGit(["rev-parse", `${sha}:${path}`]);
  const workingBlob = runGit(["hash-object", path]);
  return sourceBlob.status === 0 && workingBlob.status === 0 && sourceBlob.stdout.trim() === workingBlob.stdout.trim();
};

const safeReadArtifact = async (artifactPath: unknown, expectedDigest: unknown) => {
  if (typeof artifactPath !== "string" || !artifactPath || artifactPath.startsWith("/")
    || artifactPath.split(/[\\/]/).some((part) => part === "..") || !digestPattern.test(String(expectedDigest ?? ""))) return null;
  const absolutePath = resolve(repositoryRoot, artifactPath);
  const pathFromRoot = relative(repositoryRoot, absolutePath);
  if (pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === "..") return null;
  try {
    const bytes = await readFile(absolutePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== expectedDigest) return null;
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    return null;
  }
};

const issue = (issues: Set<string>, name: string) => issues.add(name);

export const evaluateM7pAssertionSchedulingEvidence = async (
  reportPath = "docs/architecture/GROUND_GLASS_M7P_ASSERTION_SCHEDULING_REPORT.json",
): Promise<EvaluationResult> => {
  const issues = new Set<string>();
  let report: JsonRecord | null = null;
  try {
    report = asRecord(JSON.parse(await readFile(resolve(repositoryRoot, reportPath), "utf8")));
  } catch {
    issue(issues, "m7p-report-unreadable");
  }
  if (!report) return { passed: false, issues: [...issues], summary: { evaluatorRevision: M7P_EVIDENCE_EVALUATOR_REVISION } };

  if (report.schemaVersion !== 1 || report.evaluatorRevision !== M7P_EVIDENCE_EVALUATOR_REVISION) issue(issues, "m7p-evaluator-schema-invalid");
  const summaryRef = asRecord(report.captureSummary);
  const captureSummary = asRecord(await safeReadArtifact(summaryRef?.artifactPath, summaryRef?.sha256));
  if (!captureSummary) issue(issues, "m7p-normalized-capture-summary-integrity-invalid");
  if (captureSummary?.schemaVersion !== 1 || captureSummary?.captureMatrixRevision !== "m7p-assertion-scheduling-matrix-v1") {
    issue(issues, "m7p-capture-summary-schema-invalid");
  }

  const reportSource = asRecord(report.source);
  const summarySource = asRecord(captureSummary?.source);
  const sourceRoles = [
    ["executionSourceCommitSha", "m7p-execution-source-identity-invalid"],
    ["instrumentationSourceCommitSha", "m7p-instrumentation-source-identity-invalid"],
    ["normalizerSourceCommitSha", "m7p-normalizer-source-identity-invalid"],
    ["evaluatorSourceCommitSha", "m7p-evaluator-source-identity-invalid"],
  ] as const;
  const sourceShas = new Map<string, string>();
  for (const [field, issueName] of sourceRoles) {
    const reportSha = asString(reportSource?.[field]);
    const summarySha = asString(summarySource?.[field]);
    if (!reportSha || !shaPattern.test(reportSha) || reportSha !== summarySha) issue(issues, issueName);
    else sourceShas.set(field, reportSha);
  }
  if (!sameJson(asRecord(summarySource?.sourceFiles), requiredSourceFiles)) issue(issues, "m7p-source-file-contract-invalid");
  for (const [field, sha] of sourceShas) {
    if (!hasCommit(sha)) issue(issues, "m7p-source-commit-unavailable");
    for (const paths of Object.values(requiredSourceFiles)) {
      for (const path of paths) if (!hasTreePath(sha, path)) issue(issues, "m7p-source-tree-entry-missing");
    }
    if (field === "evaluatorSourceCommitSha" && !sameBlobAsWorkingTree(sha, "scripts/evaluateM7pAssertionScheduling.ts")) {
      issue(issues, "m7p-evaluator-source-content-mismatch");
    }
  }

  const captures = asArray(captureSummary?.captures).map(asRecord).filter((entry): entry is JsonRecord => entry !== null);
  const expectedCaptureCount = Object.values(conditions).reduce((total, condition) => total + condition.attempts, 0);
  if (captures.length !== expectedCaptureCount || captureSummary?.captureCount !== expectedCaptureCount) issue(issues, "m7p-capture-matrix-incomplete");
  const captureIds = captures.map((capture) => asString(capture.captureId)).filter((entry): entry is string => entry !== null);
  if (new Set(captureIds).size !== expectedCaptureCount) issue(issues, "m7p-capture-identity-duplicate-or-missing");

  const outcomesByCondition: Record<string, string[]> = {};
  for (const [conditionName, contract] of Object.entries(conditions)) {
    const conditionCaptures = captures.filter((capture) => capture.condition === conditionName);
    if (conditionCaptures.length !== contract.attempts) issue(issues, "m7p-required-capture-condition-missing");
    if (asRecord(captureSummary?.attemptsPerCondition)?.[conditionName] !== contract.attempts) {
      issue(issues, "m7p-capture-summary-condition-count-invalid");
    }
    const attempts = conditionCaptures.map((capture) => asNumber(capture.attempt)).sort((a, b) => (a ?? 0) - (b ?? 0));
    if (!sameJson(attempts, Array.from({ length: contract.attempts }, (_, index) => index + 1))) issue(issues, "m7p-condition-attempt-sequence-invalid");
    outcomesByCondition[conditionName] = [];

    for (const capture of conditionCaptures) {
      const traceEnabled = capture.tracingEnabled === true;
      const testResults = asArray(capture.testResults).map(asRecord).filter((entry): entry is JsonRecord => entry !== null);
      const targetResults = testResults.filter((entry) => entry.identity === targetIdentity);
      if (targetResults.length !== 1) issue(issues, "m7p-target-test-identity-invalid");
      const expectedTestIdentities = (requiredTestFilesByCondition[conditionName] ?? []).map((file) =>
        `${file}::${file === targetTestFile ? targetIdentity : peerTestIdentityByFile[file] ?? "unknown"}`,
      ).sort();
      const observedTestIdentities = testResults.map((entry) => `${String(entry.file)}::${String(entry.identity)}`).sort();
      if (!sameJson(observedTestIdentities, expectedTestIdentities)) issue(issues, "m7p-cohort-test-identities-invalid");
      if (testResults.some((entry) => entry.retry !== 0) || capture.retries !== 0) issue(issues, "m7p-unexpected-retry-observed");
      if (capture.configuredWorkers !== contract.configuredWorkers) issue(issues, "m7p-configured-worker-contract-invalid");
      if (contract.configuredWorkers === 4
        && ((asNumber(capture.actualConcurrency) ?? 0) < 2 || (asNumber(capture.actualWorkers) ?? 0) < 2)) {
        issue(issues, "m7p-required-worker-overlap-unverified");
      }
      for (const result of testResults) outcomesByCondition[conditionName]?.push(`${result.identity}:${result.status}`);
      const targetResult = targetResults[0];
      const targetAssertion = asRecord(capture.targetAssertion);
      const assertionOutcome = asString(targetAssertion?.outcome);
      if (assertionOutcome !== "passed" && assertionOutcome !== "failed") issue(issues, "m7p-assertion-outcome-missing");
      if (targetResult && targetResult.status !== assertionOutcome) issue(issues, "m7p-assertion-result-contradicts-playwright-outcome");
      if (targetAssertion?.timeoutBudgetMs !== 5_000) issue(issues, "m7p-assertion-timeout-contract-invalid");
      const entryMs = asNumber(targetAssertion?.entryNodeMonotonicMs);
      const settledMs = asNumber(targetAssertion?.settlementNodeMonotonicMs);
      const deadlineMs = asNumber(targetAssertion?.inferredDeadlineNodeMonotonicMs);
      if (entryMs === null || settledMs === null || deadlineMs === null || settledMs < entryMs
        || Math.abs((deadlineMs ?? 0) - ((entryMs ?? 0) + 5_000)) > 1) {
        issue(issues, "m7p-assertion-node-timeline-invalid");
      }

      const timing = asRecord(capture.clockAlignment);
      const anchorRtt = asNumber(timing?.requestResponseUncertaintyMs);
      if (timing?.domainsPreserved !== true || !asString(timing?.assertionAnchorLabel)
        || anchorRtt === null || anchorRtt < 0 || anchorRtt > 1_000
        || !Array.isArray(timing?.inferredBrowserDeadlineIntervalMs)
        || timing?.inferredBrowserDeadlineIntervalMs.length !== 2) {
        issue(issues, "m7p-timestamp-domain-alignment-invalid");
      }

      const canvas = asRecord(capture.canvasAvailability);
      if (!new Set(["observed-before-deadline", "observed-after-deadline", "unavailable-or-uncertain"]).has(String(canvas?.classification))) {
        issue(issues, "m7p-canvas-availability-classification-invalid");
      }
      if (canvas?.firstObservationIsMutationTime !== false) issue(issues, "m7p-dom-insertion-time-overclaim");

      const trace = asRecord(capture.diagnosticCoverage);
      if (trace?.traceEnabled !== contract.tracing || traceEnabled !== contract.tracing) issue(issues, "m7p-instrumentation-condition-mislabeled");
      if (contract.tracing) {
        if (trace?.traceCompleted !== true || trace?.dataLossOccurred !== false || trace?.collectorOverflowed !== false
          || asNumber(trace?.traceEventCount) === null || (asNumber(trace?.traceEventCount) ?? 0) <= 0
          || (asNumber(trace?.maximumTraceBufferUsage) ?? 1) >= 0.95
          || !digestPattern.test(String(trace?.rawTraceSha256 ?? "")) || (asNumber(trace?.rawTraceSizeBytes) ?? 0) <= 0
          || trace?.rawTracePathIsExternal !== true || trace?.traceCaptureError !== null) {
          issue(issues, "m7p-trace-provenance-or-coverage-invalid");
        }
        const traceWindow = asRecord(trace?.traceCoverageWindow);
        const dropped = asRecord(trace?.droppedOrTruncated);
        if (traceWindow?.assertionWindowCovered !== true
          || dropped?.chromiumReportedDataLoss !== false
          || dropped?.collectorDroppedEvents !== false
          || dropped?.browserLifecycleDropped !== 0
          || dropped?.browserLongTaskDropped !== 0
          || dropped?.browserHeartbeatDropped !== 0
          || dropped?.nodeHeartbeatDropped !== 0) {
          issue(issues, "m7p-trace-temporal-coverage-incomplete");
        }
        if ((asNumber(timing?.tracePageOffsetSpreadMs) ?? 1) > 1 || !Array.isArray(timing?.nodeTraceOffsetIntervals)
          || (timing?.nodeTraceOffsetIntervals as unknown[]).length === 0) {
          issue(issues, "m7p-trace-clock-alignment-invalid");
        }
        if ((asNumber(timing?.tracePageOffsetSpreadMs) ?? 1) > 1
          || asRecord(capture.browserMainThread)?.targetRendererThreadName !== "CrRendererMain") {
          issue(issues, "m7p-target-renderer-thread-attribution-invalid");
        }
        const unsupported = asRecord(trace?.unsupportedObservation);
        if (unsupported?.matcherInternalRetryTimestamps !== true
          || unsupported?.perRetryLocatorResolutionResults !== true
          || unsupported?.exactDomInsertionTime !== true
          || unsupported?.pageAttributionForGenericRunTask !== true
          || unsupported?.gpuExecutionAttribution !== true) {
          issue(issues, "m7p-unsupported-observation-boundary-invalid");
        }
      } else if (trace?.traceCompleted !== false || trace?.rawTraceSha256 !== null || trace?.rawTraceSizeBytes !== 0) {
        issue(issues, "m7p-tracing-off-contract-invalid");
      }

      const source = asRecord(capture.source);
      for (const [field] of sourceRoles) {
        const captureField = captureSourceFieldByReportField[field as keyof typeof captureSourceFieldByReportField];
        if (source?.[captureField] !== reportSource?.[field]) issue(issues, "m7p-capture-source-identity-mismatch");
      }
      const synthetic = asRecord(capture.syntheticControl);
      if (conditionName === "P5") {
        const duration = asNumber(synthetic?.observedDurationMs);
        if (synthetic?.configuredDurationMs !== contract.syntheticStallMs || duration === null || duration < 5_300 || duration > 5_600
          || synthetic?.canvasBefore !== true || synthetic?.canvasDuring !== "unobservable-while-main-thread-task-runs"
          || synthetic?.canvasAtTaskReturn !== 1 || synthetic?.canvasAfter !== true
          || synthetic?.taskObservedOnTargetRendererMainThread !== true
          || synthetic?.taskEventContainsFrameId !== false) {
          issue(issues, "m7p-synthetic-intervention-evidence-invalid");
        }
      } else if (synthetic !== null) {
        issue(issues, "m7p-synthetic-result-mislabeled-as-historical-workload");
      }
    }
    outcomesByCondition[conditionName]?.sort();
  }
  if (!sameJson(captureSummary?.outcomesByCondition, outcomesByCondition)) issue(issues, "m7p-capture-summary-outcomes-inconsistent");

  const diagnosis = asRecord(report.diagnosis);
  const claims = asRecord(diagnosis?.claims);
  if (claims?.internalMatcherRetryTimestampsAvailable !== false
    || claims?.perRetryLocatorResolutionResultsAvailable !== false
    || claims?.exactDomInsertionTimeAvailable !== false
    || claims?.genericRunTaskFrameAttributionAvailable !== false
    || claims?.rendererSpecificMechanismEstablished !== false
    || claims?.gpuSaturationEstablished !== false
    || claims?.syntheticStallProvesRendererCausation !== false
    || claims?.instrumentationOverheadCausalEstimate !== false) {
    issue(issues, "m7p-unsupported-causal-claim");
  }
  if (!sameJson(diagnosis?.outcomesByCondition, outcomesByCondition)) issue(issues, "m7p-diagnosis-outcome-summary-inconsistent");
  if (!new Set(["A-test-synchronization-remediation", "B-application-lifecycle-remediation", "C-workload-infrastructure-remediation", "D-further-targeted-investigation", "E-accept-environmental-limitation"]).has(String(diagnosis?.nextAction))) {
    issue(issues, "m7p-next-action-invalid");
  }
  const qualification = asRecord(report.qualification);
  if (qualification?.broadE2eQualification !== "not-qualified"
    || qualification?.m7Overall !== "partially-qualified"
    || qualification?.m8Entry !== "denied"
    || qualification?.spontaneousExternalGpuDeviceLoss !== "blocked"
    || qualification?.productionGroundGlass !== "WebGL-only"
    || qualification?.productionWebGpu !== "disabled"
    || qualification?.m7oVerifiedApplicationFixes !== 0
    || qualification?.m7kBroadE2eDiscovered !== 278
    || qualification?.m7kBroadE2ePassed !== 121
    || qualification?.m7kBroadE2eUnexpected !== 82
    || qualification?.m7kBroadE2eSkipped !== 75) {
    issue(issues, "m7p-qualification-boundary-invalid");
  }

  return {
    passed: issues.size === 0,
    issues: [...issues].sort(),
    summary: {
      evaluatorRevision: M7P_EVIDENCE_EVALUATOR_REVISION,
      captureCount: captures.length,
      conditionCounts: captureSummary?.attemptsPerCondition ?? null,
      outcomesByCondition,
      nextAction: diagnosis?.nextAction ?? null,
      broadE2eQualification: qualification?.broadE2eQualification ?? null,
    },
  };
};

const isCli = process.env.M7P_ASSERTION_SCHEDULING_CLI === "1";
if (isCli) {
  const cliArgument = process.argv.slice(2).find((argument) => argument.startsWith("--report-path="));
  const positionalArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  const reportPath = cliArgument?.slice("--report-path=".length)
    ?? positionalArgument
    ?? "docs/architecture/GROUND_GLASS_M7P_ASSERTION_SCHEDULING_REPORT.json";
  const result = await evaluateM7pAssertionSchedulingEvidence(reportPath);
  console.log(`M7P evidence integrity: ${result.passed ? "PASS" : "FAIL"}`);
  console.log(JSON.stringify(result.summary, null, 2));
  if (!result.passed) {
    for (const name of result.issues) console.error(name);
    process.exitCode = 1;
  }
}
