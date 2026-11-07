import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

export const M7R_EVALUATOR_REVISION = "m7r-broad-e2e-recovery-evaluator-v5";
export const M7R_EXECUTION_SOURCE_SHA = "d34fe8b39f6c1e0509b3ffecb6fcc6566282d9f8";
export const M7R_CAPTURE_RUNNER_SHA = "ccae6bdd904d654fc73b12ec5875376575c3e16b";
export const M7R_HISTORICAL_M7K_REPORT_SHA256 = "963b9001f29d43073b0c07912bb2c4904a9bd79ffb3dbe9878d9add6e5c9b60f";
export const M7R_HISTORICAL_M7K_RAW_SHA256 = {
  ordinary: "95a7abebfaa7abe53805be7171d0ff84166dbb9e3e3d45eaa134a68f098963de",
  rendererSerial: "4be43aa1e68c5bd45d861092cf298db6f43e77576f3a338dc4533f162e32d71a",
};
export const M7R_ANALYSIS_SOURCE_PATHS = [
  "scripts/run-m7r-broad-e2e.mjs",
  "scripts/normalizeM7rBroadE2eCapture.mjs",
  "scripts/evaluateM7rBroadE2eRecovery.ts",
  "scripts/run-m7r-evidence.mjs",
  "src/tests/unit/m7rBroadE2eRecoveryEvidence.test.ts",
  "package.json",
];
export const M7R_REQUIRED_EXECUTION_PATHS = ["package.json", "package-lock.json", "playwright.config.ts"];

type JsonRecord = Record<string, unknown>;
type TestResult = {
  status: string;
  retry: number;
  startTime: string | null;
  durationMs: number | null;
  workerIndex: number | null;
  parallelIndex: number | null;
  errors: { message: string | null; stack: string | null; location: unknown }[];
};
type TestRow = {
  projectName: string;
  sourceSpec: string;
  titlePath: string[];
  testId: string;
  expectedStatus: string;
  actualStatus: string;
  retryCount: number;
  annotations: { type: string | null; description: string | null; location: unknown }[];
  location: unknown;
  results: TestResult[];
};

const historyPath = "docs/architecture/GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION_REPORT.json";
const m7gRawPath = "docs/architecture/ground-glass-m7g-r187/validation/broad-e2e-playwright.json";
const shaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const sourceCheckCache = new Map<string, boolean>();
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const recordAt = (value: unknown, key: string): JsonRecord => isRecord(value) && isRecord(value[key]) ? value[key] as JsonRecord : {};
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => {
  if (isRecord(item)) return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)));
  return item;
});

const git = (root: string, args: string[], allowFailure = false) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const fileAt = (root: string, relativePath: unknown): { path: string; bytes: Buffer } | null => {
  if (typeof relativePath !== "string" || relativePath.length === 0) return null;
  const fullPath = resolve(root, relativePath);
  const relativeCheck = relative(resolve(root), fullPath);
  if (!relativeCheck || relativeCheck.startsWith(`..${sep}`) || relativeCheck === ".." || relativeCheck.startsWith(sep)) return null;
  try {
    return { path: fullPath, bytes: readFileSync(fullPath) };
  } catch {
    return null;
  }
};

const flattenRawTests = (raw: unknown, legacyFileSuiteMapping = false): TestRow[] => {
  if (!isRecord(raw)) return [];
  const rows: TestRow[] = [];
  const visit = (suites: unknown[], inheritedFile = "", titles: string[] = []) => {
    for (const suiteValue of suites) {
      if (!isRecord(suiteValue)) continue;
      const sourceFile = typeof suiteValue.file === "string" ? suiteValue.file : inheritedFile;
      const isFileRoot = typeof suiteValue.file === "string" && suiteValue.title === basename(suiteValue.file);
      const nestedTitles = (legacyFileSuiteMapping ? Boolean(suiteValue.file) : isFileRoot)
        ? titles
        : typeof suiteValue.title === "string" && suiteValue.title ? [...titles, suiteValue.title] : titles;
      for (const specValue of asArray(suiteValue.specs)) {
        if (!isRecord(specValue)) continue;
        const testTitles = [...nestedTitles, typeof specValue.title === "string" ? specValue.title : ""].filter(Boolean);
        for (const testValue of asArray(specValue.tests)) {
          if (!isRecord(testValue)) continue;
          const sourceSpec = basename(sourceFile || (isRecord(specValue.location) && typeof specValue.location.file === "string" ? specValue.location.file : "unknown.spec.ts"));
          const results = asArray(testValue.results).filter(isRecord).map((result) => ({
            status: typeof result.status === "string" ? result.status : "no-result",
            retry: typeof result.retry === "number" && Number.isFinite(result.retry) ? result.retry : 0,
            startTime: typeof result.startTime === "string" ? result.startTime : null,
            durationMs: typeof result.duration === "number" ? result.duration : null,
            workerIndex: typeof result.workerIndex === "number" ? result.workerIndex : null,
            parallelIndex: typeof result.parallelIndex === "number" ? result.parallelIndex : null,
            errors: asArray(result.errors).filter(isRecord).map((entry) => ({
              message: typeof entry.message === "string" ? entry.message : null,
              stack: typeof entry.stack === "string" ? entry.stack : null,
              location: entry.location ?? null,
            })),
          }));
          rows.push({
            projectName: typeof testValue.projectName === "string" ? testValue.projectName : "unknown",
            sourceSpec,
            titlePath: testTitles,
            testId: `${sourceSpec}::${testTitles.join("::")}`,
            expectedStatus: typeof testValue.expectedStatus === "string" ? testValue.expectedStatus : "unknown",
            actualStatus: results.at(-1)?.status ?? "no-result",
            retryCount: results.reduce((max, result) => Math.max(max, result.retry), 0),
            annotations: asArray(testValue.annotations).filter(isRecord).map((annotation) => ({
              type: typeof annotation.type === "string" ? annotation.type : null,
              description: typeof annotation.description === "string" ? annotation.description : null,
              location: annotation.location ?? null,
            })),
            location: specValue.location ?? null,
            results,
          });
        }
      }
      visit(asArray(suiteValue.suites), sourceFile, nestedTitles);
    }
  };
  visit(asArray(raw.suites));
  return rows;
};

const reconcileIdentityKeys = (discoveredKeys: string[], reportedKeys: string[]) => {
  const discoverySet = new Set(discoveredKeys);
  const resultSet = new Set(reportedKeys);
  return {
    discovered: discoveredKeys.length,
    reported: reportedKeys.length,
    missing: [...new Set(discoveredKeys.filter((key) => !resultSet.has(key)))],
    extra: reportedKeys.filter((key) => !discoverySet.has(key)),
    duplicates: reportedKeys.filter((key, index) => reportedKeys.indexOf(key) !== index),
  };
};
const identityReconciliationCounts = (value: JsonRecord) => ({
  discovered: value.discovered,
  reported: value.reported,
  missing: Array.isArray(value.missing) ? value.missing.length : value.missing,
  extra: Array.isArray(value.extra) ? value.extra.length : value.extra,
  duplicates: Array.isArray(value.duplicates) ? value.duplicates.length : value.duplicates,
});

export const deriveM7rWorkerEvidence = (results: {
  status: string;
  workerIndex: number | null;
  parallelIndex: number | null;
  startEpochMs: number;
  durationMs: number | null;
  identity: string;
}[]) => {
  const executed = results.filter((row) => row.status !== "skipped");
  const valid = executed.filter((row) => Number.isFinite(row.startEpochMs)
    && typeof row.durationMs === "number" && Number.isFinite(row.durationMs) && row.durationMs > 0
    && Number.isSafeInteger(row.workerIndex) && row.workerIndex !== null && row.workerIndex >= 0
    && Number.isSafeInteger(row.parallelIndex) && row.parallelIndex !== null && row.parallelIndex >= 0);
  const events = valid.flatMap((row) => [
    { at: row.startEpochMs, parallelIndex: row.parallelIndex as number, delta: 1 },
    { at: row.startEpochMs + (row.durationMs as number), parallelIndex: row.parallelIndex as number, delta: -1 },
  ]).sort((left, right) => left.at - right.at || left.delta - right.delta);
  const active = new Map<number, number>();
  const segments: { startEpochMs: number; endEpochMs: number; activeWorkers: number[] }[] = [];
  const sameWorkerOverlapTimes = new Set<string>();
  let peakConcurrentWorkers = 0;
  let previousAt = events[0]?.at ?? null;
  let index = 0;
  while (index < events.length) {
    const at = events[index].at;
    if (previousAt !== null && at > previousAt && active.size > 0) {
      const activeWorkers = [...active.keys()].sort((left, right) => left - right);
      peakConcurrentWorkers = Math.max(peakConcurrentWorkers, activeWorkers.length);
      if (activeWorkers.length >= 2) segments.push({ startEpochMs: previousAt, endEpochMs: at, activeWorkers });
      if ([...active.values()].some((count) => count > 1)) sameWorkerOverlapTimes.add(`${previousAt}:${at}`);
    }
    while (index < events.length && events[index].at === at && events[index].delta < 0) {
      const event = events[index++];
      const count = (active.get(event.parallelIndex) ?? 0) - 1;
      if (count <= 0) active.delete(event.parallelIndex);
      else active.set(event.parallelIndex, count);
    }
    while (index < events.length && events[index].at === at) {
      const event = events[index++];
      active.set(event.parallelIndex, (active.get(event.parallelIndex) ?? 0) + 1);
    }
    previousAt = at;
  }
  const longestOverlap = segments.reduce((best, segment) => {
    const durationMs = segment.endEpochMs - segment.startEpochMs;
    return durationMs > best.durationMs ? { ...segment, durationMs } : best;
  }, { startEpochMs: null as number | null, endEpochMs: null as number | null, activeWorkers: [] as number[], durationMs: 0 });
  return {
    resultIntervals: results.length,
    executedResultIntervals: executed.length,
    validExecutionIntervals: valid.length,
    invalidExecutionIntervals: executed.length - valid.length,
    workerProcessGenerationIndexes: [...new Set(valid.map((row) => row.workerIndex as number))].sort((a, b) => a - b),
    parallelWorkerIndexes: [...new Set(valid.map((row) => row.parallelIndex as number))].sort((a, b) => a - b),
    peakConcurrentWorkers,
    longestOverlap,
    sameWorkerOverlapSegmentCount: sameWorkerOverlapTimes.size,
  };
};

const failureSignature = (test: TestRow): string => {
  if (test.actualStatus === "timedOut") return "test-timeout";
  const message = test.results.at(-1)?.errors[0]?.message ?? "";
  const firstLine = message.replaceAll(String.fromCharCode(27), "").split(/\r?\n/, 1)[0]?.replace(/\[[0-9;]*m/g, "") ?? "";
  if (/toHaveCSS\(/.test(firstLine)) return "css-assertion";
  if (/toHaveCount\(/.test(firstLine)) return "count-assertion";
  if (/toBeVisible\(/.test(firstLine)) return "visibility-assertion";
  if (/toHaveAttribute\(/.test(firstLine)) return "attribute-assertion";
  if (/toHaveValue\(/.test(firstLine)) return "value-assertion";
  if (/toContainText\(/.test(firstLine)) return "text-assertion";
  if (/toBeEnabled\(/.test(firstLine)) return "enabled-state-assertion";
  if (/toBeChecked\(/.test(firstLine)) return "checked-state-assertion";
  if (/Timeout .* exceeded while waiting on the predicate/.test(firstLine)) return "predicate-timeout";
  if (/toBeGreaterThan\(/.test(firstLine)) return "numeric-greater-than-assertion";
  if (/toBeLessThan\(/.test(firstLine)) return "numeric-less-than-assertion";
  if (/toBeCloseTo\(/.test(firstLine)) return "numeric-close-to-assertion";
  if (/toBe\(/.test(firstLine)) return "equality-assertion";
  return message ? "other-assertion" : "no-error-message";
};

const classifySkipDisposition = (reason: string): string => {
  if (/dream-loop:capture|benchmark:scene-capacity/i.test(reason)) return "development-or-research-only";
  if (/native|headed|gpu|webgpu|adapter|chrome-native/i.test(reason)) return "legitimate-platform-gated";
  if (/development|research|test seam|feature flag/i.test(reason)) return "development-or-research-only";
  return "requires-owner-decision";
};

const summarize = (tests: TestRow[]) => {
  const count = (status: string) => tests.filter((test) => test.actualStatus === status).length;
  const workerRows = tests.flatMap((test) => test.results.map((result) => ({
    identity: test.testId,
    status: result.status,
    workerIndex: result.workerIndex,
    parallelIndex: result.parallelIndex,
    startEpochMs: result.startTime === null ? Number.NaN : Date.parse(result.startTime),
    durationMs: result.durationMs,
  })));
  const workerEvidence = deriveM7rWorkerEvidence(workerRows);
  const failureGroups = new Map<string, string[]>();
  for (const test of tests.filter((row) => row.actualStatus !== row.expectedStatus)) {
    const signature = failureSignature(test);
    failureGroups.set(signature, [...(failureGroups.get(signature) ?? []), test.testId]);
  }
  return {
    discovered: tests.length,
    passed: count("passed"),
    failed: count("failed"),
    timedOut: count("timedOut"),
    skipped: count("skipped"),
    interrupted: count("interrupted"),
    unexpected: tests.filter((test) => test.actualStatus !== test.expectedStatus).length,
    flaky: tests.filter((test) => test.results.length > 1 || test.results.some((result) => result.retry > 0)).length,
    incomplete: tests.filter((test) => test.results.length !== 1 || test.actualStatus === "no-result").length,
    retries: tests.reduce((sum, test) => sum + test.retryCount, 0),
    workerEvidence,
    failureGroups: [...failureGroups.entries()].map(([signature, identities]) => ({ signature, count: identities.length, identities })).sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature)),
  };
};

const reconcileHistory = (currentTests: TestRow[], history: JsonRecord) => {
  const priorRows = asArray(isRecord(history.execution) ? history.execution.perTest : []).filter(isRecord)
    .sort((left, right) => `${String(left.projectName)}::${String(left.testId)}`.localeCompare(`${String(right.projectName)}::${String(right.testId)}`));
  const currentByKey = new Map(currentTests.map((test) => [`${test.projectName}::${test.testId}`, test]));
  return priorRows.map((prior) => {
    const identity = `${String(prior.projectName)}::${String(prior.testId)}`;
    const current = currentByKey.get(identity);
    let disposition = "missing-current-identity";
    if (current) {
      const currentUnexpected = current.actualStatus !== current.expectedStatus;
      const priorUnexpected = prior.resultStatus === "unexpected";
      if (prior.resultStatus === "skipped") disposition = current.actualStatus === "skipped"
        ? "historical-skip-still-skipped" : "historical-skip-currently-unskipped-requires-review";
      else if (!priorUnexpected && !currentUnexpected) disposition = "expected-in-both";
      else if (!priorUnexpected && currentUnexpected) disposition = "new-current-unexpected";
      else if (priorUnexpected && !currentUnexpected) disposition = "historical-unexpected-now-expected";
      else disposition = failureSignature(current) === prior.errorSignature ? "unexpected-same-signature" : "unexpected-changed-signature";
    }
    return {
      identity,
      historicalLane: prior.lane ?? null,
      historicalExpectedStatus: prior.expectedStatus ?? null,
      historicalActualStatus: prior.actualStatus ?? null,
      historicalResultStatus: prior.resultStatus ?? null,
      historicalFailureSignature: prior.errorSignature ?? null,
      currentLane: current ? (current.projectName === "chromium" ? "ordinary" : "renderer-serial") : null,
      currentExpectedStatus: current?.expectedStatus ?? null,
      currentActualStatus: current?.actualStatus ?? null,
      currentFailureSignature: current && current.actualStatus !== current.expectedStatus ? failureSignature(current) : null,
      disposition,
    };
  });
};

const deriveTransitionMatrix = (reconciliation: ReturnType<typeof reconcileHistory>) => {
  const matrix = {
    historicalPassed: { currentPassed: 0, currentUnexpected: 0, currentSkipped: 0, missingOrChanged: 0 },
    historicalUnexpected: { currentPassed: 0, currentUnexpected: 0, currentSkipped: 0, missingOrChanged: 0 },
    historicalSkipped: { currentPassed: 0, currentUnexpected: 0, currentSkipped: 0, missingOrChanged: 0 },
  };
  for (const row of reconciliation) {
    const historicalRow = row.historicalResultStatus === "expected" ? "historicalPassed"
      : row.historicalResultStatus === "unexpected" ? "historicalUnexpected"
        : row.historicalResultStatus === "skipped" ? "historicalSkipped" : null;
    if (!historicalRow) continue;
    const currentColumn = row.disposition === "missing-current-identity" ? "missingOrChanged"
      : row.currentActualStatus === "passed" ? "currentPassed"
        : row.currentActualStatus === "skipped" ? "currentSkipped"
          : row.currentActualStatus === null || row.currentActualStatus === "no-result" ? "missingOrChanged" : "currentUnexpected";
    matrix[historicalRow][currentColumn] += 1;
  }
  return matrix;
};

const recheckSkips = (currentTests: TestRow[], history: JsonRecord) => {
  const historicalSkips = asArray(history.skipAudit).filter(isRecord);
  const currentByKey = new Map(currentTests.map((test) => [`${test.projectName}::${test.testId}`, test]));
  const historical = historicalSkips.map((previous) => {
    const identity = `${String(previous.project)}::${String(previous.testId)}`;
    const current = currentByKey.get(identity);
    const skipAnnotations = current?.annotations.filter((annotation) => annotation.type === "skip") ?? [];
    const currentSkipReason = skipAnnotations.map((annotation) => annotation.description).filter((value) => typeof value === "string" && value.length > 0).join(" | ") || "missing-skip-reason";
    return {
      identity,
      sourceSpec: current?.sourceSpec ?? null,
      priorM7KSkipReason: previous.skipReason,
      currentSkipReason,
      currentLane: current ? (current.projectName === "chromium" ? "ordinary" : "renderer-serial") : null,
      currentExpectedStatus: current?.expectedStatus ?? null,
      currentActualStatus: current?.actualStatus ?? "missing",
      skipAnnotations,
      stillSkipped: current?.actualStatus === "skipped",
      disposition: !current ? "missing-current-identity" : current.actualStatus === "skipped" ? "still-skipped-no-exclusion-approved" : "historical-skip-currently-not-skipped-requires-review",
      proposedSkipCategory: currentSkipReason === "missing-skip-reason" ? "unjustified-skip" : classifySkipDisposition(currentSkipReason),
      conditionality: "not-established-by-Playwright-result-annotation",
      exclusionApproval: "unapproved",
      qualificationImpact: "blocks-qualification-unless-explicitly-accepted",
      approvedExclusion: null,
    };
  });
  const current = currentTests.filter((test) => test.actualStatus === "skipped").map((test) => {
    const identity = `${test.projectName}::${test.testId}`;
    const previous = historicalSkips.find((entry) => `${String(entry.project)}::${String(entry.testId)}` === identity);
    const annotations = test.annotations.filter((annotation) => annotation.type === "skip");
    const skipReason = annotations.map((annotation) => annotation.description).filter((value) => typeof value === "string" && value.length > 0).join(" | ") || "missing-skip-reason";
    return {
      identity,
      sourceSpec: test.sourceSpec,
      lane: test.projectName === "chromium" ? "ordinary" : "renderer-serial",
      expectedStatus: test.expectedStatus,
      annotations,
      skipReason,
      priorM7KSkipReason: previous?.skipReason ?? null,
      priorApprovedExclusion: previous?.approvedExclusion ?? null,
      currentDisposition: previous ? "historical-skip-rechecked-no-new-exclusion" : "new-current-skip-requires-review",
      proposedSkipCategory: skipReason === "missing-skip-reason" ? "unjustified-skip" : classifySkipDisposition(skipReason),
      conditionality: "not-established-by-Playwright-result-annotation",
      exclusionApproval: "unapproved",
      qualificationImpact: "blocks-qualification-unless-explicitly-accepted",
      approvedExclusion: null,
    };
  });
  return { historical, current };
};

const buildTestInventory = (currentTests: TestRow[], history: JsonRecord, reconciliation: ReturnType<typeof reconcileHistory>, skipAudit: ReturnType<typeof recheckSkips>, manifest: JsonRecord) => {
  const historyRows = asArray(recordAt(history, "execution").perTest).filter(isRecord);
  const historyByKey = new Map(historyRows.map((row) => [`${String(row.projectName)}::${String(row.testId)}`, row]));
  const reconciliationByIdentity = new Map(reconciliation.map((row) => [row.identity, row]));
  const currentSkipByIdentity = new Map(skipAudit.current.map((row) => [row.identity, row]));
  const manifestLanes = recordAt(manifest, "lanes");
  const outputDirectory = String(manifest.outputDirectory);
  return currentTests.map((test) => {
    const identity = `${test.projectName}::${test.testId}`;
    const historical = historyByKey.get(identity);
    const currentSkip = currentSkipByIdentity.get(identity);
    const unexpected = test.actualStatus !== test.expectedStatus;
    const signature = unexpected ? failureSignature(test) : null;
    const message = test.results.at(-1)?.errors[0]?.message ?? "";
    const errorSummary = message.replaceAll(String.fromCharCode(27), "").split(/\r?\n/)[0]?.replace(/\[[0-9;]*m/g, "") || null;
    const sourceLocation = isRecord(test.location) ? test.location : {};
    const lane = test.projectName === "chromium" ? "ordinary" : "renderer-serial";
    const laneManifest = recordAt(manifestLanes, lane === "ordinary" ? "ordinary" : "rendererSerial");
    return {
      canonicalIdentity: identity,
      project: test.projectName,
      lane,
      specFile: test.sourceSpec,
      titlePath: test.titlePath,
      sourceLine: typeof sourceLocation.line === "number" ? sourceLocation.line : null,
      historicalM7KStatus: historical ? {
        resultStatus: historical.resultStatus,
        expectedStatus: historical.expectedStatus,
        actualStatus: historical.actualStatus,
        failureSignature: historical.errorSignature ?? null,
      } : null,
      historicalDisposition: reconciliationByIdentity.get(identity)?.disposition ?? "not-in-historical-inventory",
      currentDiscoveryStatus: "discovered",
      currentExpectedStatus: test.expectedStatus,
      currentActualStatus: test.actualStatus,
      currentRetryCount: test.retryCount,
      failureSignature: signature,
      observedFailureCohort: signature ? `observed-${signature}` : null,
      errorSummary,
      rootCauseCategory: unexpected ? "insufficient-evidence" : null,
      rootCauseConfidence: unexpected ? "unclassified" : null,
      currentSkipAudit: currentSkip ? {
        reason: currentSkip.skipReason,
        proposedCategory: currentSkip.proposedSkipCategory,
        conditionality: currentSkip.conditionality,
        exclusionApproval: currentSkip.exclusionApproval,
        qualificationImpact: currentSkip.qualificationImpact,
      } : null,
      qualificationImpact: test.actualStatus === "skipped"
        ? "blocks-unless-explicitly-approved-for-a-specific-lane"
        : unexpected ? "unexpected-result-blocks-broad-qualification" : "no-failure-evidence-in-this-single-run",
      recommendedAction: test.actualStatus === "skipped"
        ? "adjudicate-lane-placement-and-explicit-exclusion; annotation-alone-is-not-approval"
        : unexpected ? "retain-as-currently-unexpected; reproduce-and-classify-before-fix"
          : historical?.resultStatus === "unexpected" ? "record-current-pass-once; do-not-label-fixed" : "retain-current-pass-evidence",
      priorInvestigationRefs: test.testId === "architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension"
        ? ["M7O", "M7P", "M7Q; scheduling sequence closed, not reopened by this baseline"] : [],
      evidenceReferences: [{
        kind: "raw-playwright-result",
        lane,
        artifactPath: `${outputDirectory}/raw/${lane === "ordinary" ? "ordinary" : "renderer-serial"}-playwright.json`,
        artifactSha256: laneManifest.rawReportSha256,
        resultCount: test.results.length,
        retryCount: test.retryCount,
      }],
    };
  });
};

const verifySourceTreePath = (root: string, sha: string, sourcePath: string, contentMustMatch: boolean): boolean => {
  const cacheKey = `${resolve(root)}\u0000${sha}\u0000${sourcePath}\u0000${contentMustMatch}`;
  const cached = sourceCheckCache.get(cacheKey);
  if (cached !== undefined) return cached;
  if (!shaPattern.test(sha)) return false;
  const exists = git(root, ["cat-file", "-e", `${sha}:${sourcePath}`], true).status === 0;
  if (!exists || !contentMustMatch) {
    sourceCheckCache.set(cacheKey, exists);
    return exists;
  }
  const source = fileAt(root, sourcePath);
  if (!source) {
    sourceCheckCache.set(cacheKey, false);
    return false;
  }
  const committed = git(root, ["show", `${sha}:${sourcePath}`]);
  const result = hash(Buffer.from(committed.stdout)) === hash(source.bytes);
  sourceCheckCache.set(cacheKey, result);
  return result;
};

const verifyRequiredWorkflowGate = (root: string): boolean => {
  const file = fileAt(root, ".github/workflows/pages.yml");
  if (!file) return false;
  const lines = file.bytes.toString("utf8").split(/\r?\n/);
  const stepName = "      - name: Validate M7R broad E2E recovery evidence integrity";
  const starts = lines.flatMap((line, index) => line === stepName ? [index] : []);
  if (starts.length !== 1) return false;
  const start = starts[0];
  const endOffset = lines.slice(start + 1).findIndex((line) => /^ {6}- name: /.test(line) || /^ {2}[A-Za-z][\w-]*:/.test(line));
  const block = lines.slice(start, endOffset < 0 ? undefined : start + 1 + endOffset).join("\n");
  const deployIndex = lines.findIndex((line) => line === "  deploy:");
  const deploy = deployIndex < 0 ? "" : lines.slice(deployIndex, deployIndex + 12).join("\n");
  const hasGeneralCiTriggers = lines.includes("  pull_request:") && lines.includes("  push:") && lines.includes("      - \"**\"");
  return block.includes("        run: npm run evidence:check:m7r")
    && !block.includes("continue-on-error: true")
    && !/^\s+if:/m.test(block)
    && hasGeneralCiTriggers
    && /needs: ci/.test(deploy);
};

const compareLane = (actual: JsonRecord, manifestLane: JsonRecord, raw: JsonRecord, tests: TestRow[], discoveredKeys: string[], laneName: string, issues: string[]) => {
  const summary = summarize(tests);
  const runnerSummary = recordAt(manifestLane, "rawSummary");
  const normalizedSummary = actual.summary;
  if (stable(normalizedSummary) !== stable(summary)) issues.push(`m7r-${laneName}-normalized-outcomes-mismatch`);
  const expectedCount = laneName === "ordinary" ? 274 : 4;
  if (tests.length !== expectedCount) issues.push(`m7r-${laneName}-test-count-invalid`);
  const identities = tests.map((test) => `${test.projectName}::${test.testId}`);
  if (new Set(identities).size !== identities.length) issues.push(`m7r-${laneName}-duplicate-identities`);
  if (tests.some((test) => test.results.length !== 1 || test.retryCount !== 0 || test.results.some((result) => result.retry !== 0))) issues.push(`m7r-${laneName}-incomplete-or-retried-test-result`);
  if (tests.some((test) => test.actualStatus === "no-result")) issues.push(`m7r-${laneName}-missing-result`);
  if (!isRecord(raw.stats) || (raw.errors && asArray(raw.errors).length > 0)) issues.push(`m7r-${laneName}-raw-playwright-report-invalid`);
  if (runnerSummary.resultCount !== tests.length || runnerSummary.retryFree !== true || runnerSummary.resultCountValid !== true) issues.push(`m7r-${laneName}-runner-summary-invalid`);
  const correctedIdentityKeys = tests.map((test) => `${test.projectName}::${test.testId}`);
  const legacyTests = flattenRawTests(raw, true);
  const legacyIdentityKeys = legacyTests.map((test) => `${test.projectName}::${test.testId}`);
  const legacyReconciliation = reconcileIdentityKeys(discoveredKeys, legacyIdentityKeys);
  const hasLegacyIdentityMismatch = legacyReconciliation.missing.length > 0 || legacyReconciliation.extra.length > 0 || legacyReconciliation.duplicates.length > 0;
  const originalRunnerMismatchReproduced = stable(identityReconciliationCounts(recordAt(runnerSummary, "identityReconciliation")))
    === stable(identityReconciliationCounts(legacyReconciliation));
  const expectedCorrection = {
    applied: hasLegacyIdentityMismatch,
    correctionId: hasLegacyIdentityMismatch ? "m7r-playwright-json-repeated-file-suite-title-v1" : null,
    explanation: hasLegacyIdentityMismatch
      ? "The initial runner treated every nested suite carrying a repeated file field as a file root and omitted nested describe titles. The corrected mapping identifies a file root only when its title equals the source basename."
      : null,
    originalRunnerMismatchReproduced,
    runnerMarkedInvalidForIdentityMismatch: hasLegacyIdentityMismatch && originalRunnerMismatchReproduced
      && manifestLane.captureValidity === "invalid" && manifestLane.executionCompleteness === "incomplete",
  };
  if (stable(actual.correctedLegacyIdentityReconciliation) !== stable(legacyReconciliation)
    || stable(actual.runnerIdentityReconciliation) !== stable(runnerSummary.identityReconciliation)
    || stable(actual.normalizationCorrection) !== stable(expectedCorrection)) issues.push(`m7r-${laneName}-legacy-identity-correction-not-derived-from-raw`);
  const correction = isRecord(actual.normalizationCorrection) ? actual.normalizationCorrection : {};
  if (hasLegacyIdentityMismatch) {
    if (laneName !== "ordinary" || legacyReconciliation.discovered !== 274 || legacyReconciliation.reported !== 274
      || legacyReconciliation.missing.length !== 30 || legacyReconciliation.extra.length !== 30 || legacyReconciliation.duplicates.length !== 0
      || manifestLane.captureValidity !== "invalid" || manifestLane.executionCompleteness !== "incomplete"
      || stable(identityReconciliationCounts(recordAt(runnerSummary, "identityReconciliation"))) !== stable(identityReconciliationCounts(legacyReconciliation))
      || correction.applied !== true || correction.correctionId !== "m7r-playwright-json-repeated-file-suite-title-v1"
      || correction.runnerMarkedInvalidForIdentityMismatch !== true) issues.push(`m7r-${laneName}-unsupported-capture-validity-correction`);
  } else if (manifestLane.captureValidity !== "valid" || manifestLane.executionCompleteness !== "complete"
    || correction.applied !== false || correction.correctionId !== null || correction.runnerMarkedInvalidForIdentityMismatch !== false) {
    issues.push(`m7r-${laneName}-capture-validity-claim-invalid`);
  }
  const correctedReconciliation = reconcileIdentityKeys(discoveredKeys, correctedIdentityKeys);
  if (correctedReconciliation.missing.length > 0 || correctedReconciliation.extra.length > 0 || correctedReconciliation.duplicates.length > 0
    || actual.captureValidity !== "valid" || actual.executionCompleteness !== "complete"
    || actual.runnerReportedCaptureValidity !== manifestLane.captureValidity
    || actual.runnerReportedExecutionCompleteness !== manifestLane.executionCompleteness) issues.push(`m7r-${laneName}-corrected-capture-is-not-complete`);
  if (!isRecord(manifestLane.server) || manifestLane.server.closedAfterInvocation !== true || manifestLane.server.priorListenerAbsent !== true) issues.push(`m7r-${laneName}-server-isolation-invalid`);
  if (actual.rawSha256 !== manifestLane.rawReportSha256 || actual.rawBytes !== manifestLane.rawReportBytes
    || stable(actual.runnerSummary) !== stable(runnerSummary)
    || stable(actual.server) !== stable(manifestLane.server)) issues.push(`m7r-${laneName}-normalized-capture-metadata-mismatch`);
  if (laneName === "ordinary") {
    if (manifestLane.projectName !== "chromium" || manifestLane.configuredWorkers !== 4 || manifestLane.configuredRetries !== 0) issues.push("m7r-ordinary-execution-policy-invalid");
  } else if (manifestLane.projectName !== "chromium-renderer-serial" || manifestLane.configuredWorkers !== 1 || manifestLane.configuredRetries !== 0) {
    issues.push("m7r-renderer-serial-execution-policy-invalid");
  }
  const rawConfig = isRecord(raw.config) ? raw.config : {};
  const rawProjects = asArray(rawConfig.projects).filter(isRecord);
  const rawProject = rawProjects.find((project) => project.name === manifestLane.projectName);
  if (rawConfig.workers !== manifestLane.configuredWorkers || !rawProject || rawProject.retries !== 0) issues.push(`m7r-${laneName}-raw-config-does-not-match-policy`);
  const rawStats = isRecord(raw.stats) ? raw.stats : {};
  const expectedNonSkipped = tests.filter((test) => test.actualStatus === test.expectedStatus && test.actualStatus !== "skipped").length;
  if (rawStats.expected !== expectedNonSkipped || rawStats.unexpected !== summary.unexpected
    || rawStats.skipped !== summary.skipped || rawStats.flaky !== summary.flaky
    || stable(runnerSummary.stats) !== stable(raw.stats)) issues.push(`m7r-${laneName}-raw-stats-do-not-reconcile`);
  const workerEvidence = summary.workerEvidence;
  const requiredSlots = laneName === "ordinary" ? [0, 1, 2, 3] : [0];
  const requiredPeak = laneName === "ordinary" ? 4 : 1;
  if (workerEvidence.invalidExecutionIntervals !== 0
    || stable(workerEvidence.parallelWorkerIndexes) !== stable(requiredSlots)
    || workerEvidence.peakConcurrentWorkers !== requiredPeak
    || (laneName === "ordinary" && (workerEvidence.longestOverlap.durationMs <= 0
      || workerEvidence.longestOverlap.activeWorkers.length !== 4))) issues.push(`m7r-${laneName}-actual-worker-overlap-not-established`);
  if (stable(actual.identityReconciliation) !== stable(correctedReconciliation)) issues.push(`m7r-${laneName}-corrected-identity-reconciliation-invalid`);
  return summary;
};

export const evaluateM7rBroadE2eRecovery = (reportValue: unknown, repositoryRoot = process.cwd()) => {
  const issues: string[] = [];
  const add = (issue: string) => { if (!issues.includes(issue)) issues.push(issue); };
  const report = isRecord(reportValue) ? reportValue : {};
  const artifactClaims = recordAt(report, "artifacts");
  const provenance = recordAt(report, "provenance");
  const getArtifact = (name: string) => recordAt(artifactClaims, name);
  const loadJson = (artifact: JsonRecord, issue: string): { value: JsonRecord; bytes: Buffer; path: string } | null => {
    const file = fileAt(repositoryRoot, artifact.path);
    if (!file) { add(`${issue}-missing`); return null; }
    if (typeof artifact.sha256 !== "string" || !digestPattern.test(artifact.sha256) || hash(file.bytes) !== artifact.sha256) add(`${issue}-digest-invalid`);
    try {
      const value = JSON.parse(file.bytes.toString("utf8"));
      return isRecord(value) ? { value, bytes: file.bytes, path: file.path } : null;
    } catch {
      add(`${issue}-json-invalid`);
      return null;
    }
  };

  if (report.schemaVersion !== 1 || report.evaluatorRevision !== M7R_EVALUATOR_REVISION) add("m7r-schema-or-evaluator-revision-invalid");
  if (provenance.executionSourceCommitSha !== M7R_EXECUTION_SOURCE_SHA) add("m7r-execution-source-sha-invalid");
  if (provenance.captureRunnerSourceCommitSha !== M7R_CAPTURE_RUNNER_SHA) add("m7r-capture-runner-source-sha-invalid");
  const analysisSha = provenance.analysisToolingSourceCommitSha;
  if (typeof analysisSha !== "string" || !shaPattern.test(analysisSha)) add("m7r-analysis-source-sha-invalid");
  if (stable(provenance.analysisToolingSourcePaths) !== stable(M7R_ANALYSIS_SOURCE_PATHS)) add("m7r-analysis-source-path-contract-invalid");

  const normalizedLoaded = loadJson(getArtifact("normalizedCapture"), "m7r-normalized-capture");
  const manifestLoaded = loadJson(getArtifact("captureManifest"), "m7r-capture-manifest");
  const historicalLoaded = loadJson({ path: historyPath, sha256: M7R_HISTORICAL_M7K_REPORT_SHA256 }, "m7r-historical-m7k-report");
  if (!normalizedLoaded || !manifestLoaded || !historicalLoaded) return { passed: false, issues: [...issues, "m7r-required-artifact-unavailable"] };
  const normalized = normalizedLoaded.value;
  const manifest = manifestLoaded.value;
  const history = historicalLoaded.value;

  if (normalized.schemaVersion !== 1 || normalized.evidenceId !== "m7r-broad-e2e-current-source-recovery-v1") add("m7r-normalized-schema-invalid");
  if (normalized.provenance === undefined || !isRecord(normalized.provenance)) add("m7r-normalized-provenance-missing");
  const normalizedProvenance = recordAt(normalized, "provenance");
  if (normalizedProvenance.executionSourceCommitSha !== M7R_EXECUTION_SOURCE_SHA || normalizedProvenance.captureRunnerSourceCommitSha !== M7R_CAPTURE_RUNNER_SHA
    || normalizedProvenance.normalizerSourceCommitSha !== analysisSha || normalizedProvenance.correctedRunnerSourceCommitSha !== analysisSha
    || normalizedProvenance.analysisToolingSourceCommitSha !== analysisSha) add("m7r-normalized-source-provenance-invalid");
  const executionTreeSha = git(repositoryRoot, ["rev-parse", `${M7R_EXECUTION_SOURCE_SHA}^{tree}`], true);
  if (executionTreeSha.status !== 0 || normalizedProvenance.executionSourceTreeSha !== executionTreeSha.stdout.trim()
    || recordAt(manifest, "source").executionCommitTree !== executionTreeSha.stdout.trim()) add("m7r-execution-source-tree-identity-invalid");
  if (normalizedProvenance.captureManifestSha256 !== hash(manifestLoaded.bytes)) add("m7r-normalized-capture-manifest-link-invalid");
  if (normalizedProvenance.captureManifestPath !== getArtifact("captureManifest").path || normalizedProvenance.captureId !== manifest.captureId) add("m7r-normalized-capture-identity-link-invalid");
  if (normalizedProvenance.historicalM7kReportSha256 !== M7R_HISTORICAL_M7K_REPORT_SHA256) add("m7r-historical-baseline-link-invalid");
  if (manifest.executionSourceCommitSha !== M7R_EXECUTION_SOURCE_SHA || manifest.captureRunnerSourceCommitSha !== M7R_CAPTURE_RUNNER_SHA || manifest.captureRunnerSourcePath !== "scripts/run-m7r-broad-e2e.mjs") add("m7r-capture-manifest-provenance-invalid");
  const manifestLanes = recordAt(manifest, "lanes");
  const ordinaryManifestLane = recordAt(manifestLanes, "ordinary");
  const serialManifestLane = recordAt(manifestLanes, "rendererSerial");
  const expectedRawArtifacts = [
    { path: `${String(manifest.outputDirectory)}/raw/ordinary-playwright.json`, sha256: ordinaryManifestLane.rawReportSha256, sizeBytes: ordinaryManifestLane.rawReportBytes },
    { path: `${String(manifest.outputDirectory)}/raw/renderer-serial-playwright.json`, sha256: serialManifestLane.rawReportSha256, sizeBytes: serialManifestLane.rawReportBytes },
  ];
  if (stable(normalizedProvenance.rawArtifacts) !== stable(expectedRawArtifacts)) add("m7r-raw-report-artifact-links-invalid");
  const manifestPolicy = recordAt(manifest, "policy");
  const ordinaryPolicy = recordAt(manifestPolicy, "ordinary");
  const serialPolicy = recordAt(manifestPolicy, "rendererSerial");
  if (ordinaryPolicy.configuredWorkers !== 4 || ordinaryPolicy.retries !== 0
    || serialPolicy.configuredWorkers !== 1 || serialPolicy.retries !== 0
    || serialPolicy.dependenciesDisabled !== true || manifestPolicy.lanesExecutedSequentially !== true
    || manifestPolicy.ordinaryFailureSuppressesSerial !== false || manifestPolicy.testTimeoutsChanged !== false) add("m7r-capture-policy-invalid");
  const manifestEnvironment = recordAt(manifest, "environment");
  if (manifestEnvironment.nativeWebGpuRequested !== false || manifestEnvironment.nativeFeatureGatesEnabled !== false
    || manifestEnvironment.rendererBackend !== "application-default-WebGL") add("m7r-production-runtime-boundary-invalid");
  if (stable(normalized.policy) !== stable(manifest.policy)) add("m7r-normalized-execution-policy-mismatch");

  const laneClaims = recordAt(normalized, "lanes");
  const laneTests = new Map<string, TestRow[]>();
  const laneSummaries = new Map<string, JsonRecord>();
  for (const laneName of ["ordinary", "rendererSerial"] as const) {
    const laneLabel = laneName === "ordinary" ? "ordinary" : "renderer-serial";
    const manifestLane = recordAt(manifestLanes, laneName);
    const laneClaim = recordAt(laneClaims, laneName);
    const rawArtifactName = `${manifest.outputDirectory}/raw/${laneLabel}-playwright.json`;
    const reportRaw = isRecord(getArtifact("rawReports")) ? getArtifact("rawReports")[laneName] : undefined;
    const rawClaim = isRecord(reportRaw) ? reportRaw as JsonRecord : {};
    if (rawClaim.path !== rawArtifactName) add(`m7r-${laneLabel}-raw-path-invalid`);
    const rawLoaded = loadJson({ path: rawArtifactName, sha256: manifestLane.rawReportSha256 }, `m7r-${laneLabel}-raw-report`);
    if (!rawLoaded) continue;
    if (rawClaim.sha256 !== hash(rawLoaded.bytes) || manifestLane.rawReportBytes !== rawLoaded.bytes.byteLength) add(`m7r-${laneLabel}-raw-digest-or-size-invalid`);
    const raw = rawLoaded.value;
    const tests = flattenRawTests(raw);
    const discoveryKey = laneName === "ordinary" ? "ordinary" : "rendererSerial";
    const discovery = recordAt(recordAt(manifest, "discovery"), discoveryKey);
    const discovered = asArray(discovery.identities).filter(isRecord).map((entry) => `${String(entry.projectName)}::${String(entry.testId)}`);
    const summary = compareLane(laneClaim, manifestLane, raw, tests, discovered, laneLabel, issues);
    laneTests.set(laneName, tests);
    laneSummaries.set(laneName, summary as unknown as JsonRecord);
    const reported = tests.map((test) => `${test.projectName}::${test.testId}`).sort();
    if (stable([...discovered].sort()) !== stable([...reported].sort())) add(`m7r-${laneLabel}-discovery-and-raw-identities-differ`);
    const reconciliation = isRecord(laneClaim.identityReconciliation) ? laneClaim.identityReconciliation : {};
    if (reconciliation.discovered !== discovered.length || reconciliation.reported !== reported.length
      || asArray(reconciliation.missing).length !== 0 || asArray(reconciliation.extra).length !== 0 || asArray(reconciliation.duplicates).length !== 0) add(`m7r-${laneLabel}-identity-reconciliation-invalid`);
  }
  const ordinaryTests = laneTests.get("ordinary") ?? [];
  const serialTests = laneTests.get("rendererSerial") ?? [];
  const currentTests = [...ordinaryTests, ...serialTests];
  const normalizedDiscovery = recordAt(normalized, "discovery");
  const normalizedHistoricalReconciliation = recordAt(normalized, "historicalReconciliation");
  const normalizedSummary = recordAt(normalized, "summary");
  const normalizedSkipAudit = recordAt(normalized, "currentSkipAudit");
  const normalizedArtifactIntegrity = recordAt(normalized, "artifactIntegrity");
  const historyExecution = recordAt(history, "execution");
  if (ordinaryTests.length !== 274 || serialTests.length !== 4 || currentTests.length !== 278) add("m7r-current-discovery-inventory-invalid");
  if (new Set(ordinaryTests.map((test) => test.sourceSpec)).size !== 80 || new Set(serialTests.map((test) => test.sourceSpec)).size !== 4) add("m7r-current-spec-file-inventory-invalid");
  if (normalizedDiscovery.ordinaryCount !== ordinaryTests.length || normalizedDiscovery.rendererSerialCount !== serialTests.length
    || normalizedDiscovery.ordinarySpecFiles !== 80 || normalizedDiscovery.rendererSerialSpecFiles !== 4
    || normalizedDiscovery.total !== currentTests.length || normalizedDiscovery.unique !== new Set(currentTests.map((test) => `${test.projectName}::${test.testId}`)).size
    || normalizedDiscovery.historicalM7kCount !== asArray(historyExecution.perTest).length) add("m7r-normalized-discovery-summary-invalid");

  const historyTests = asArray(historyExecution.perTest).filter(isRecord);
  const historyByKey = new Map(historyTests.map((test) => [`${String(test.projectName)}::${String(test.testId)}`, test]));
  const currentByKey = new Map(currentTests.map((test) => [`${test.projectName}::${test.testId}`, test]));
  const historicalKeys = [...historyByKey.keys()].sort();
  const currentKeys = [...currentByKey.keys()].sort();
  const missingHistory = historicalKeys.filter((key) => !currentByKey.has(key));
  const newCurrent = currentKeys.filter((key) => !historyByKey.has(key));
  if (historyTests.length !== 278 || missingHistory.length > 0 || newCurrent.length > 0) add("m7r-m7k-historical-test-identity-reconciliation-invalid");
  const recon = reconcileHistory(currentTests, history);
  const transitionMatrix = deriveTransitionMatrix(recon);
  if (stable(normalizedHistoricalReconciliation.tests) !== stable(recon)) add("m7r-historical-outcome-reconciliation-not-derived-from-raw");
  if (stable(normalizedHistoricalReconciliation.transitionMatrix) !== stable(transitionMatrix)) add("m7r-historical-transition-matrix-not-derived-from-raw");
  if (normalizedHistoricalReconciliation.compared !== recon.length || normalizedHistoricalReconciliation.missingHistoricalCount !== 0 || normalizedHistoricalReconciliation.newCurrentCount !== 0) add("m7r-historical-reconciliation-summary-invalid");
  const dispositions = Object.fromEntries([...new Set(recon.map((entry) => entry.disposition))].sort().map((disposition) => [disposition, recon.filter((entry) => entry.disposition === disposition).length]));
  if (stable(normalizedHistoricalReconciliation.dispositions) !== stable(dispositions)) add("m7r-historical-reconciliation-dispositions-invalid");
  const reportHistory = isRecord(report.historicalReconciliation) ? report.historicalReconciliation : {};
  if (reportHistory.compared !== recon.length || stable(reportHistory.dispositions) !== stable(dispositions)
    || stable(reportHistory.transitionMatrix) !== stable(transitionMatrix)) add("m7r-report-historical-reconciliation-invalid");

  const allSummary = {
    discovered: currentTests.length,
    passed: currentTests.filter((test) => test.actualStatus === "passed").length,
    unexpected: currentTests.filter((test) => test.actualStatus !== test.expectedStatus).length,
    failed: currentTests.filter((test) => test.actualStatus === "failed").length,
    timedOut: currentTests.filter((test) => test.actualStatus === "timedOut").length,
    skipped: currentTests.filter((test) => test.actualStatus === "skipped").length,
    flaky: currentTests.filter((test) => test.results.length > 1 || test.retryCount > 0).length,
    incomplete: currentTests.filter((test) => test.results.length !== 1 || test.actualStatus === "no-result").length,
    retries: currentTests.reduce((sum, test) => sum + test.retryCount, 0),
    ordinary: laneSummaries.get("ordinary") ?? null,
    rendererSerial: laneSummaries.get("rendererSerial") ?? null,
  };
  if (stable(normalizedSummary) !== stable(allSummary) || stable(report.summary) !== stable(allSummary)) add("m7r-combined-outcome-summary-invalid");
  if (normalizedSummary.discovered !== 278 || normalizedSummary.incomplete !== 0 || normalizedSummary.flaky !== 0 || normalizedSummary.retries !== 0) add("m7r-current-run-not-complete-and-retry-free");

  const historicalSkipAudit = asArray(history.skipAudit).filter(isRecord);
  const skipRechecks = recheckSkips(currentTests, history);
  const derivedTestInventory = buildTestInventory(currentTests, history, recon, skipRechecks, manifest);
  const skipReasonCounts = new Map<string, number>();
  for (const skip of skipRechecks.current) {
    const reason = skip.annotations.map((annotation) => annotation.description).filter((value) => typeof value === "string" && value.length > 0).join(" | ") || "missing-skip-reason";
    skipReasonCounts.set(reason, (skipReasonCounts.get(reason) ?? 0) + 1);
  }
  const skipReasonGroups = [...skipReasonCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
  if (historicalSkipAudit.length !== 75 || stable(normalizedSkipAudit.historicalTests) !== stable(skipRechecks.historical)) add("m7r-historical-skips-not-individually-rechecked");
  if (stable(normalizedSkipAudit.tests) !== stable(skipRechecks.current)) add("m7r-current-skip-audit-not-derived-from-raw");
  if (stable(normalizedSkipAudit.reasonGroups) !== stable(skipReasonGroups)) add("m7r-skip-reason-groups-not-derived-from-raw");
  if (normalizedSkipAudit.historicalSkipRechecks !== 75 || normalizedSkipAudit.approvedExclusions !== 0
    || normalizedSkipAudit.count !== skipRechecks.current.length) add("m7r-skip-audit-summary-invalid");
  if (skipRechecks.current.some((entry) => entry.annotations.length === 0 || entry.annotations.some((annotation) => !annotation.description))) add("m7r-current-skip-reason-unverifiable");
  if (stable(normalized.testInventory) !== stable(derivedTestInventory) || stable(report.testInventory) !== stable(derivedTestInventory)) add("m7r-per-test-inventory-not-derived-from-raw");
  const reportSkips = isRecord(report.skipAudit) ? report.skipAudit : {};
  if (reportSkips.historicalSkipped !== 75 || reportSkips.individuallyRechecked !== 75
    || reportSkips.currentSkipped !== skipRechecks.current.length || reportSkips.approvedExclusions !== 0
    || stable(reportSkips.reasonGroups) !== stable(skipReasonGroups)) add("m7r-report-skip-audit-invalid");

  const currentFiles = [...new Set(currentTests.map((test) => `src/tests/e2e/${test.sourceSpec}`))].sort();
  const executionPaths = [...M7R_REQUIRED_EXECUTION_PATHS, ...currentFiles].sort();
  const claimedExecutionPaths = asArray(provenance.executionSourcePaths);
  if (stable(claimedExecutionPaths) !== stable(executionPaths)) add("m7r-execution-source-path-contract-invalid");
  for (const sourcePath of executionPaths) {
    if (!verifySourceTreePath(repositoryRoot, M7R_EXECUTION_SOURCE_SHA, sourcePath, false)) add(`m7r-execution-source-missing:${sourcePath}`);
  }
  if (!verifySourceTreePath(repositoryRoot, M7R_CAPTURE_RUNNER_SHA, "scripts/run-m7r-broad-e2e.mjs", false)) add("m7r-capture-runner-source-tree-entry-unavailable");
  if (typeof analysisSha === "string") {
    for (const sourcePath of M7R_ANALYSIS_SOURCE_PATHS) {
      if (!verifySourceTreePath(repositoryRoot, analysisSha, sourcePath, true)) add(`m7r-analysis-source-missing-or-mismatched:${sourcePath}`);
    }
  }
  if (!verifyRequiredWorkflowGate(repositoryRoot)) add("m7r-required-ci-gate-missing-or-optional");

  const artifactManifest = asArray(manifest.artifactManifest).filter(isRecord);
  const checkedArtifacts = artifactManifest.map((entry) => {
    const path = typeof entry.path === "string" ? `${manifest.outputDirectory}/${entry.path}` : "";
    const file = fileAt(repositoryRoot, path);
    return {
      path: entry.path,
      sizeBytes: file?.bytes.byteLength ?? null,
      expectedSizeBytes: entry.sizeBytes,
      sha256: file ? hash(file.bytes) : null,
      expectedSha256: entry.sha256,
      passed: file !== null && file.bytes.byteLength === entry.sizeBytes && hash(file.bytes) === entry.sha256,
    };
  });
  if (checkedArtifacts.length === 0 || checkedArtifacts.some((entry) => !entry.passed)) add("m7r-capture-artifact-manifest-invalid");
  if (normalizedArtifactIntegrity.checked !== checkedArtifacts.length || asArray(normalizedArtifactIntegrity.failed).length !== 0) add("m7r-normalized-artifact-integrity-invalid");
  if (stable(normalizedArtifactIntegrity.artifacts) !== stable(checkedArtifacts)) add("m7r-normalized-artifact-digests-not-recomputed");

  const actualWorkerOverlap = {
    ordinary: (laneSummaries.get("ordinary") as JsonRecord | undefined)?.workerEvidence ?? null,
    rendererSerial: (laneSummaries.get("rendererSerial") as JsonRecord | undefined)?.workerEvidence ?? null,
  };
  if (stable(normalized.actualWorkerOverlap) !== stable(actualWorkerOverlap) || stable(report.actualWorkerOverlap) !== stable(actualWorkerOverlap)) add("m7r-worker-overlap-summary-not-recomputed");

  const historyCounts = recordAt(historyExecution, "combinedOutcomes");
  if (historyCounts.discovered !== 278 || historyCounts.passed !== 121 || historyCounts.unexpected !== 82 || historyCounts.skipped !== 75
    || historyCounts.timedOut !== 34 || historyCounts.actualFailed !== 48 || historyCounts.flaky !== 0 || historyCounts.incomplete !== 0 || historyCounts.retries !== 0) add("m7r-m7k-historical-counts-changed");
  const historicalEvidence = recordAt(history, "historicalEvidence");
  if (historicalEvidence.m7iReportSha256 !== "486f1c7ac010cd4d4fbede55fdb669f448c26adfaaee6de5717814ddff9bccde"
    || historicalEvidence.m7gRawReportSha256 !== "393d1360f32a85c83664ca3ed7ec4d5bec217e77edd8045f4ace61b054ae32d6") add("m7r-prior-m7-evidence-digest-metadata-changed");
  const m7iReportMeta = recordAt(recordAt(historicalEvidence, "artifacts"), "m7iReport");
  const m7iReportFile = isRecord(m7iReportMeta) ? fileAt(repositoryRoot, m7iReportMeta.path) : null;
  if (!m7iReportFile || hash(m7iReportFile.bytes) !== "486f1c7ac010cd4d4fbede55fdb669f448c26adfaaee6de5717814ddff9bccde") add("m7r-m7i-historical-report-changed");
  for (const laneName of ["ordinary", "rendererSerial"] as const) {
    const historicalLane = recordAt(recordAt(historyExecution, "lanes"), laneName);
    const expectedSha = M7R_HISTORICAL_M7K_RAW_SHA256[laneName];
    const file = isRecord(historicalLane) ? fileAt(repositoryRoot, historicalLane.rawReportPath) : null;
    if (!file || historicalLane.rawReportSha256 !== expectedSha || hash(file.bytes) !== expectedSha) add(`m7r-m7k-${laneName}-raw-artifact-changed`);
  }
  const m7gRaw = fileAt(repositoryRoot, m7gRawPath);
  if (!m7gRaw || hash(m7gRaw.bytes) !== "393d1360f32a85c83664ca3ed7ec4d5bec217e77edd8045f4ace61b054ae32d6") add("m7r-m7g-historical-raw-artifact-changed");

  const qualification = recordAt(report, "qualification");
  if (qualification.currentRunCompleteness !== "complete" || qualification.broadE2eQualification !== "not-qualified"
    || qualification.m7Overall !== "partially-qualified" || qualification.m8Entry !== "denied"
    || qualification.externalGpuDeviceLoss !== "blocked" || qualification.productionGroundGlass !== "WebGL-only"
    || qualification.productionWebGpu !== "disabled") add("m7r-qualification-boundaries-invalid");
  const claims = recordAt(report, "claims");
  if (asArray(claims.verifiedApplicationFixes).length !== 0 || asArray(claims.establishedRootCauses).length !== 0
    || claims.reopensM7NThroughM7Q !== false || claims.selectedCaptureQualifiesBroadE2e !== false) add("m7r-unsupported-causal-or-qualification-claim");
  const closure = recordAt(report, "diagnosticClosure");
  if (closure.status !== "closed" || closure.priorSequence !== "M7N-M7Q" || closure.reopensGeneralSchedulingDiagnosis !== false) add("m7r-prior-diagnostic-sequence-not-closed");
  const actionPlan = asArray(report.actionPlan).filter(isRecord);
  if (actionPlan.length === 0 || actionPlan.length > 3 || actionPlan.some((action) => typeof action.priority !== "number"
    || typeof action.evidence !== "string" || !action.evidence.trim() || typeof action.nextStep !== "string" || !action.nextStep.trim()
    || typeof action.acceptanceGate !== "string" || !action.acceptanceGate.trim())) add("m7r-qualification-action-plan-not-bounded");

  return {
    passed: issues.length === 0,
    evaluatorRevision: M7R_EVALUATOR_REVISION,
    issues,
    evidenceIntegrity: issues.length === 0 ? "passed" : "failed",
    executionCompleteness: normalizedSummary.incomplete === 0 ? "complete" : "incomplete",
    broadE2eQualification: qualification.broadE2eQualification ?? null,
    currentSummary: normalizedSummary,
  };
};

if (process.env.M7R_EVIDENCE_CLI === "1") {
  const repositoryRoot = process.env.M7R_EVIDENCE_REPOSITORY_ROOT ?? process.cwd();
  const reportPath = process.env.M7R_EVIDENCE_REPORT_PATH ?? "docs/architecture/GROUND_GLASS_M7R_BROAD_E2E_QUALIFICATION_RECOVERY_REPORT.json";
  try {
    const reportFile = fileAt(repositoryRoot, reportPath);
    if (!reportFile) throw new Error("M7R report path is unavailable or outside the repository.");
    const report = JSON.parse(reportFile.bytes.toString("utf8")) as unknown;
    const result = evaluateM7rBroadE2eRecovery(report, repositoryRoot);
    process.stdout.write(`M7R evidence integrity: ${result.evidenceIntegrity}; execution completeness: ${result.executionCompleteness}; Broad E2E qualification: ${result.broadE2eQualification}.\n`);
    if (result.passed) {
      process.stdout.write(`M7R current outcomes: ${result.currentSummary?.passed} passed; ${result.currentSummary?.unexpected} unexpected; ${result.currentSummary?.skipped} skipped; ${result.currentSummary?.retries} retries.\n`);
    } else {
      for (const issue of result.issues) process.stderr.write(`- ${issue}\n`);
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`M7R evidence evaluation failed closed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
