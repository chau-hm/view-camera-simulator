import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const expectedExecutionSha = "d34fe8b39f6c1e0509b3ffecb6fcc6566282d9f8";
const expectedRunnerSha = "ccae6bdd904d654fc73b12ec5875376575c3e16b";
const runnerPath = "scripts/run-m7r-broad-e2e.mjs";
const normalizerPath = "scripts/normalizeM7rBroadE2eCapture.mjs";
const historyPath = "docs/architecture/GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION_REPORT.json";
const shaPattern = /^[0-9a-f]{40}$/;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const fail = (message) => { throw new Error(message); };
const stable = (value) => JSON.stringify(value, (_key, item) => {
  if (isRecord(item)) return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)));
  return item;
});

const git = (args, allowFailure = false) => {
  const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) fail(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const parseArgs = () => {
  const values = new Map();
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([a-z-]+)=(.+)$/);
    if (!match || values.has(match[1])) fail(`Unsupported or duplicate option: ${arg}`);
    values.set(match[1], match[2]);
  }
  const allowed = new Set(["capture-manifest", "output", "normalizer-source-sha"]);
  if ([...values.keys()].some((key) => !allowed.has(key))) fail("Options: --capture-manifest=<path> --output=<path> --normalizer-source-sha=<commit>");
  const manifestPath = values.get("capture-manifest");
  const outputPath = values.get("output");
  const normalizerSha = values.get("normalizer-source-sha");
  if (!manifestPath || !outputPath || !normalizerSha || !shaPattern.test(normalizerSha)) {
    fail("All options are required; normalizer source must be a full Git commit SHA.");
  }
  const manifestAbsolute = resolve(repositoryRoot, manifestPath);
  const outputAbsolute = resolve(repositoryRoot, outputPath);
  const relativeManifest = relative(repositoryRoot, manifestAbsolute);
  const relativeOutput = relative(repositoryRoot, outputAbsolute);
  if (!relativeManifest || relativeManifest.startsWith(`..${sep}`) || !relativeOutput || relativeOutput.startsWith(`..${sep}`)) {
    fail("Capture manifest and normalized output must be inside the repository.");
  }
  if (existsSync(outputAbsolute)) fail(`Refusing to overwrite normalized evidence: ${outputPath}`);
  return { manifestAbsolute, manifestPath: relativeManifest.split(sep).join("/"), outputAbsolute, outputPath: relativeOutput.split(sep).join("/"), normalizerSha };
};

const verifyCommitPath = (sha, path) => git(["cat-file", "-e", `${sha}:${path}`], true).status === 0;
const verifyCommit = (sha) => git(["cat-file", "-e", `${sha}^{commit}`], true).status === 0;
const sourceBytes = (sha, path) => Buffer.from(git(["show", `${sha}:${path}`]).stdout);

const flattenRawTests = (raw) => {
  const rows = [];
  const visit = (suites, inheritedFile = "", titles = []) => {
    for (const suite of suites ?? []) {
      if (!isRecord(suite)) continue;
      const sourceFile = typeof suite.file === "string" ? suite.file : inheritedFile;
      const isFileRoot = typeof suite.file === "string" && suite.title === basename(suite.file);
      const nestedTitles = isFileRoot ? titles : suite.title ? [...titles, suite.title] : titles;
      for (const spec of suite.specs ?? []) {
        const testTitles = [...nestedTitles, spec.title].filter(Boolean);
        for (const test of spec.tests ?? []) {
          const sourceSpec = basename(sourceFile || spec.location?.file || "unknown.spec.ts");
          const results = Array.isArray(test.results) ? test.results : [];
          const last = results.at(-1) ?? null;
          rows.push({
            projectName: test.projectName ?? null,
            sourceSpec,
            titlePath: testTitles,
            testId: `${sourceSpec}::${testTitles.join("::")}`,
            expectedStatus: test.expectedStatus ?? "unknown",
            actualStatus: last?.status ?? "no-result",
            retryCount: results.reduce((maximum, result) => Math.max(maximum, Number(result.retry ?? 0)), 0),
            annotations: Array.isArray(test.annotations) ? test.annotations.map((annotation) => ({
              type: annotation.type ?? null,
              description: annotation.description ?? null,
              location: annotation.location ?? null,
            })) : [],
            location: spec.location ?? null,
            results: results.map((result) => ({
              status: result.status ?? null,
              retry: Number(result.retry ?? 0),
              startTime: result.startTime ?? null,
              durationMs: result.duration ?? null,
              workerIndex: result.workerIndex ?? null,
              parallelIndex: result.parallelIndex ?? null,
              errors: (result.errors ?? []).map((entry) => ({
                message: entry.message ?? null,
                stack: entry.stack ?? null,
                location: entry.location ?? null,
              })),
            })),
          });
        }
      }
      visit(suite.suites, sourceFile, nestedTitles);
    }
  };
  visit(raw.suites);
  return rows;
};

const flattenLegacyRunnerIdentities = (raw) => {
  const identities = [];
  const visit = (suites, inheritedFile = "", titles = []) => {
    for (const suite of suites ?? []) {
      if (!isRecord(suite)) continue;
      const sourceFile = typeof suite.file === "string" ? suite.file : inheritedFile;
      const legacyTitles = suite.file ? titles : suite.title ? [...titles, suite.title] : titles;
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          const sourceSpec = basename(sourceFile || spec.location?.file || "unknown.spec.ts");
          const titlePath = [...legacyTitles, spec.title].filter(Boolean);
          identities.push(`${test.projectName}::${sourceSpec}::${titlePath.join("::")}`);
        }
      }
      visit(suite.suites, sourceFile, legacyTitles);
    }
  };
  visit(raw.suites);
  return identities;
};

const summarizeWorkerOverlap = (tests) => {
  const rows = tests.flatMap((test) => test.results.map((result) => ({
    identity: test.testId,
    status: result.status,
    workerIndex: result.workerIndex,
    parallelIndex: result.parallelIndex,
    startEpochMs: typeof result.startTime === "string" ? Date.parse(result.startTime) : Number.NaN,
    durationMs: result.durationMs,
  })));
  const executed = rows.filter((row) => row.status !== "skipped");
  const valid = executed.filter((row) => Number.isFinite(row.startEpochMs)
    && typeof row.durationMs === "number" && Number.isFinite(row.durationMs) && row.durationMs > 0
    && Number.isSafeInteger(row.workerIndex) && row.workerIndex >= 0
    && Number.isSafeInteger(row.parallelIndex) && row.parallelIndex >= 0);
  const events = valid.flatMap((row) => [
    { at: row.startEpochMs, parallelIndex: row.parallelIndex, delta: 1 },
    { at: row.startEpochMs + row.durationMs, parallelIndex: row.parallelIndex, delta: -1 },
  ]).sort((left, right) => left.at - right.at || left.delta - right.delta);
  const active = new Map();
  const segments = [];
  const sameWorkerOverlapTimes = new Set();
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
  }, { startEpochMs: null, endEpochMs: null, activeWorkers: [], durationMs: 0 });
  return {
    resultIntervals: rows.length,
    executedResultIntervals: executed.length,
    validExecutionIntervals: valid.length,
    invalidExecutionIntervals: executed.length - valid.length,
    workerProcessGenerationIndexes: [...new Set(valid.map((row) => row.workerIndex))].sort((left, right) => left - right),
    parallelWorkerIndexes: [...new Set(valid.map((row) => row.parallelIndex))].sort((left, right) => left - right),
    peakConcurrentWorkers,
    longestOverlap,
    sameWorkerOverlapSegmentCount: sameWorkerOverlapTimes.size,
  };
};

const classifyError = (test) => {
  if (test.actualStatus === "timedOut") return "test-timeout";
  const message = test.results.at(-1)?.errors?.[0]?.message ?? "";
  if (/toHaveCSS\(/.test(message)) return "css-assertion";
  if (/toHaveCount\(/.test(message)) return "count-assertion";
  if (/toBeVisible\(/.test(message)) return "visibility-assertion";
  if (/toHaveAttribute\(/.test(message)) return "attribute-assertion";
  if (/toHaveValue\(/.test(message)) return "value-assertion";
  if (/toContainText\(/.test(message)) return "text-assertion";
  if (/toBeEnabled\(/.test(message)) return "other-timeout";
  if (/Timeout .* exceeded while waiting on the predicate/.test(message)) return "predicate-timeout";
  if (/toBeCloseTo\(/.test(message)) return "numeric-assertion";
  return message ? "other-assertion" : "no-error-message";
};

const classifySkipDisposition = (reason) => {
  if (/dream-loop:capture|benchmark:scene-capacity/i.test(reason)) return "development-or-research-only";
  if (/native|headed|gpu|webgpu|adapter|chrome-native/i.test(reason)) return "legitimate-platform-gated";
  if (/development|research|test seam|feature flag/i.test(reason)) return "development-or-research-only";
  return "requires-owner-decision";
};

const summarize = (tests) => {
  const actual = (status) => tests.filter((test) => test.actualStatus === status).length;
  const unexpected = tests.filter((test) => test.actualStatus !== test.expectedStatus).length;
  const retries = tests.reduce((sum, test) => sum + test.retryCount, 0);
  const incomplete = tests.filter((test) => test.results.length !== 1 || test.actualStatus === "no-result").length;
  const failureGroups = new Map();
  for (const test of tests.filter((row) => row.actualStatus !== row.expectedStatus)) {
    const signature = classifyError(test);
    failureGroups.set(signature, [...(failureGroups.get(signature) ?? []), test.testId]);
  }
  return {
    discovered: tests.length,
    passed: actual("passed"),
    failed: actual("failed"),
    timedOut: actual("timedOut"),
    skipped: actual("skipped"),
    interrupted: actual("interrupted"),
    unexpected,
    flaky: tests.filter((test) => test.results.length > 1 || test.results.some((result) => result.retry > 0)).length,
    incomplete,
    retries,
    workerEvidence: summarizeWorkerOverlap(tests),
    failureGroups: [...failureGroups.entries()].map(([signature, identities]) => ({ signature, count: identities.length, identities })).sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature)),
  };
};

const readLane = (captureRoot, manifest, laneKey, laneName = laneKey) => {
  const lane = manifest.lanes?.[laneKey];
  if (!isRecord(lane)) fail(`Capture manifest is missing lane ${laneKey}.`);
  const reportName = basename(lane.rawReport ?? "");
  const expectedName = `${laneName}-playwright.json`;
  if (reportName !== expectedName) fail(`${laneKey} raw report path does not name the expected artifact.`);
  const rawAbsolute = resolve(captureRoot, "raw", expectedName);
  const rawBytes = readFileSync(rawAbsolute);
  if (sha256(rawBytes) !== lane.rawReportSha256 || rawBytes.byteLength !== lane.rawReportBytes) fail(`${laneName} raw report digest or size does not match the capture manifest.`);
  const consoleArtifact = `execution/${laneName}/${laneName}-console.log`;
  const consoleBytes = readFileSync(resolve(captureRoot, consoleArtifact));
  const exitCodeArtifact = `execution/${laneName}/${laneName}-exit-code.txt`;
  const exitCodeText = readFileSync(resolve(captureRoot, exitCodeArtifact), "utf8").trim();
  if (exitCodeText !== String(lane.invocation?.exitCode ?? "")) fail(`${laneName} exit-code artifact disagrees with the invocation result.`);
  const raw = JSON.parse(rawBytes.toString("utf8"));
  const tests = flattenRawTests(raw);
  const summary = summarize(tests);
  const legacyIdentityKeys = flattenLegacyRunnerIdentities(raw);
  const discovery = manifest.discovery?.[laneName === "ordinary" ? "ordinary" : "rendererSerial"];
  const discoveredKeys = (discovery?.identities ?? []).map((entry) => `${entry.projectName}::${entry.testId}`);
  const resultKeys = tests.map((entry) => `${entry.projectName}::${entry.testId}`);
  const discoverySet = new Set(discoveredKeys);
  const resultSet = new Set(resultKeys);
  const reconciliation = {
    discovered: discoveredKeys.length,
    reported: resultKeys.length,
    missing: [...discoverySet].filter((key) => !resultSet.has(key)).sort(),
    extra: resultKeys.filter((key) => !discoverySet.has(key)).sort(),
    duplicates: resultKeys.filter((key, index) => resultKeys.indexOf(key) !== index).sort(),
  };
  const legacySet = new Set(legacyIdentityKeys);
  const legacyReconciliation = {
    discovered: discoveredKeys.length,
    reported: legacyIdentityKeys.length,
    missing: [...new Set(discoveredKeys.filter((key) => !legacySet.has(key)))],
    extra: legacyIdentityKeys.filter((key) => !discoverySet.has(key)),
    duplicates: legacyIdentityKeys.filter((key, index) => legacyIdentityKeys.indexOf(key) !== index),
  };
  const summaryFromRunner = lane.rawSummary ?? {};
  const rawProject = raw.config?.projects?.find((entry) => entry.name === lane.projectName) ?? null;
  const expectedRowsHaveOneResult = tests.every((test) => test.results.length === 1 && test.actualStatus !== "no-result");
  const rawExecutionComplete = tests.length === discoveredKeys.length
    && reconciliation.missing.length === 0 && reconciliation.extra.length === 0 && reconciliation.duplicates.length === 0
    && expectedRowsHaveOneResult && summary.flaky === 0 && summary.incomplete === 0 && summary.retries === 0
    && lane.rawSummary?.resultCount === tests.length && lane.rawSummary?.resultCountValid === true
    && lane.rawSummary?.retryFree === true && Array.isArray(lane.rawSummary?.errors) && lane.rawSummary.errors.length === 0
    && Array.isArray(raw.errors) && raw.errors.length === 0 && isRecord(raw.stats)
    && raw.config?.workers === lane.configuredWorkers && rawProject?.retries === 0
    && stable(lane.rawSummary?.stats) === stable(raw.stats)
    && lane.server?.closedAfterInvocation === true && lane.server?.priorListenerAbsent === true
    && lane.rawParseError === null && lane.invocation?.signal === null && lane.invocation?.spawnError === null;
  const identityCorrectionApplied = legacyReconciliation.missing.length > 0 || legacyReconciliation.extra.length > 0 || legacyReconciliation.duplicates.length > 0;
  const originalRunnerMismatchReproduced = stable(summaryFromRunner.identityReconciliation) === stable(legacyReconciliation);
  return {
    projectName: lane.projectName,
    configuredWorkers: lane.configuredWorkers,
    configuredRetries: lane.configuredRetries,
    invocation: lane.invocation,
    server: lane.server,
    rawArtifact: `raw/${expectedName}`,
    rawSha256: sha256(rawBytes),
    rawBytes: rawBytes.byteLength,
    consoleArtifact,
    consoleSha256: lane.consoleSha256,
    exitCodeArtifact,
    exitCodeArtifactValue: exitCodeText,
    exitCode: lane.invocation?.exitCode ?? null,
    runnerReportedExecutionCompleteness: lane.executionCompleteness,
    runnerReportedCaptureValidity: lane.captureValidity,
    executionCompleteness: rawExecutionComplete ? "complete" : "incomplete",
    captureValidity: rawExecutionComplete ? "valid" : "invalid",
    runnerSummary: summaryFromRunner,
    identityReconciliation: reconciliation,
    runnerIdentityReconciliation: summaryFromRunner.identityReconciliation ?? null,
    correctedLegacyIdentityReconciliation: legacyReconciliation,
    normalizationCorrection: {
      applied: identityCorrectionApplied,
      correctionId: identityCorrectionApplied ? "m7r-playwright-json-repeated-file-suite-title-v1" : null,
      explanation: identityCorrectionApplied
        ? "The initial runner treated every nested suite carrying a repeated file field as a file root and omitted nested describe titles. The corrected mapping identifies a file root only when its title equals the source basename."
        : null,
      originalRunnerMismatchReproduced,
      runnerMarkedInvalidForIdentityMismatch: identityCorrectionApplied
        && originalRunnerMismatchReproduced && lane.captureValidity === "invalid" && lane.executionCompleteness === "incomplete",
    },
    summary,
    tests,
  };
};

const main = () => {
  const args = parseArgs();
  const manifestBytes = readFileSync(args.manifestAbsolute);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const captureRoot = resolve(repositoryRoot, manifest.outputDirectory);
  if (!manifest.outputDirectory || !captureRoot.startsWith(`${repositoryRoot}${sep}`)) fail("Capture output directory is outside the repository.");
  if (manifest.executionSourceCommitSha !== expectedExecutionSha) fail("M7R execution source differs from the verified current main source.");
  if (manifest.captureRunnerSourceCommitSha !== expectedRunnerSha || manifest.captureRunnerSourcePath !== runnerPath) fail("M7R capture runner provenance is unexpected.");
  if (!verifyCommit(expectedExecutionSha) || !verifyCommit(expectedRunnerSha) || !verifyCommit(args.normalizerSha)) fail("A pinned M7R source commit is unavailable.");
  if (!verifyCommitPath(expectedExecutionSha, "playwright.config.ts")) fail("Pinned M7R execution source is missing playwright.config.ts.");
  if (!verifyCommitPath(expectedRunnerSha, runnerPath)) fail("M7R capture runner source tree entry is unavailable at the retained capture commit.");
  if (!verifyCommitPath(args.normalizerSha, runnerPath) || sha256(sourceBytes(args.normalizerSha, runnerPath)) !== sha256(readFileSync(resolve(repositoryRoot, runnerPath)))) fail("Corrected M7R runner source does not match the analysis tooling commit.");
  if (!verifyCommitPath(args.normalizerSha, normalizerPath) || sha256(sourceBytes(args.normalizerSha, normalizerPath)) !== sha256(readFileSync(resolve(repositoryRoot, normalizerPath)))) fail("M7R normalizer source does not match its committed provenance.");

  const historicalBytes = readFileSync(resolve(repositoryRoot, historyPath));
  const historical = JSON.parse(historicalBytes.toString("utf8"));
  const historicalTests = historical.execution?.perTest ?? [];
  const historicalByKey = new Map(historicalTests.map((test) => [`${test.projectName}::${test.testId}`, test]));
  const historySkipByKey = new Map((historical.skipAudit ?? []).map((test) => [`${test.project}::${test.testId}`, test]));
  if (historicalTests.length !== 278 || historical.discovery?.ordinary?.discoveredTests !== 274 || historical.discovery?.rendererSerial?.discoveredTests !== 4) fail("Accepted M7K historical inventory is not the expected 278-test record.");

  const ordinary = readLane(captureRoot, manifest, "ordinary");
  const rendererSerial = readLane(captureRoot, manifest, "rendererSerial", "renderer-serial");
  if (ordinary.rawArtifact !== "raw/ordinary-playwright.json" || rendererSerial.rawArtifact !== "raw/renderer-serial-playwright.json") fail("M7R lane raw artifact identity is invalid.");
  const currentTests = [
    ...ordinary.tests.map((test) => ({ ...test, lane: "ordinary" })),
    ...rendererSerial.tests.map((test) => ({ ...test, lane: "renderer-serial" })),
  ];
  const currentByKey = new Map(currentTests.map((test) => [`${test.projectName}::${test.testId}`, test]));
  const historicalKeys = [...historicalByKey.keys()].sort();
  const currentKeys = [...currentByKey.keys()].sort();
  const missingHistorical = historicalKeys.filter((key) => !currentByKey.has(key));
  const newCurrent = currentKeys.filter((key) => !historicalByKey.has(key));
  const reconciliation = historicalKeys.map((key) => {
    const prior = historicalByKey.get(key);
    const current = currentByKey.get(key);
    let disposition = "missing-current-identity";
    if (current) {
      const currentUnexpected = current.actualStatus !== current.expectedStatus;
      const priorUnexpected = prior.resultStatus === "unexpected";
      if (!priorUnexpected && !currentUnexpected) disposition = "expected-in-both";
      else if (!priorUnexpected && currentUnexpected) disposition = "new-current-unexpected";
      else if (priorUnexpected && !currentUnexpected) disposition = "historical-unexpected-now-expected";
      else disposition = classifyError(current) === prior.errorSignature ? "unexpected-same-signature" : "unexpected-changed-signature";
    }
    return {
      identity: key,
      historicalLane: prior?.lane ?? null,
      historicalExpectedStatus: prior?.expectedStatus ?? null,
      historicalActualStatus: prior?.actualStatus ?? null,
      historicalResultStatus: prior?.resultStatus ?? null,
      historicalFailureSignature: prior?.errorSignature ?? null,
      currentLane: current?.lane ?? null,
      currentExpectedStatus: current?.expectedStatus ?? null,
      currentActualStatus: current?.actualStatus ?? null,
      currentFailureSignature: current && current.actualStatus !== current.expectedStatus ? classifyError(current) : null,
      disposition,
    };
  });
  const currentSkips = currentTests.filter((test) => test.actualStatus === "skipped").map((test) => {
    const key = `${test.projectName}::${test.testId}`;
    const previous = historySkipByKey.get(key);
    const skipAnnotations = test.annotations.filter((annotation) => annotation.type === "skip");
    const skipReason = skipAnnotations.map((annotation) => annotation.description).filter((value) => typeof value === "string" && value.length > 0).join(" | ") || "missing-skip-reason";
    return {
      identity: key,
      sourceSpec: test.sourceSpec,
      lane: test.lane,
      expectedStatus: test.expectedStatus,
      annotations: skipAnnotations,
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
  const historicalSkipRechecks = [...historySkipByKey.entries()].map(([identity, previous]) => {
    const current = currentByKey.get(identity);
    const skipAnnotations = current?.annotations.filter((annotation) => annotation.type === "skip") ?? [];
    const currentSkipReason = skipAnnotations.map((annotation) => annotation.description).filter((value) => typeof value === "string" && value.length > 0).join(" | ") || "missing-skip-reason";
    return {
      identity,
      sourceSpec: current?.sourceSpec ?? null,
      priorM7KSkipReason: previous.skipReason,
      currentSkipReason,
      currentLane: current?.lane ?? null,
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
  const reconciliationByIdentity = new Map(reconciliation.map((entry) => [entry.identity, entry]));
  const currentSkipByIdentity = new Map(currentSkips.map((entry) => [entry.identity, entry]));
  const testInventory = currentTests.map((test) => {
    const identity = `${test.projectName}::${test.testId}`;
    const historical = historicalByKey.get(identity);
    const currentSkip = currentSkipByIdentity.get(identity);
    const unexpected = test.actualStatus !== test.expectedStatus;
    const signature = unexpected ? classifyError(test) : null;
    const rawMessage = test.results.at(-1)?.errors?.[0]?.message ?? "";
    const errorSummary = rawMessage.replaceAll(String.fromCharCode(27), "").split(/\r?\n/)[0]?.replace(/\[[0-9;]*m/g, "") || null;
    return {
      canonicalIdentity: identity,
      project: test.projectName,
      lane: test.lane,
      specFile: test.sourceSpec,
      titlePath: test.titlePath,
      sourceLine: typeof test.location?.line === "number" ? test.location.line : null,
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
        lane: test.lane,
        artifactPath: `${manifest.outputDirectory}/raw/${test.lane === "ordinary" ? "ordinary" : "renderer-serial"}-playwright.json`,
        artifactSha256: test.lane === "ordinary" ? ordinary.rawSha256 : rendererSerial.rawSha256,
        resultCount: test.results.length,
        retryCount: test.retryCount,
      }],
    };
  });
  const currentSkipReasons = new Map();
  for (const skip of currentSkips) {
    const description = skip.annotations.map((annotation) => annotation.description).filter((value) => typeof value === "string" && value.length > 0).join(" | ") || "missing-skip-reason";
    currentSkipReasons.set(description, (currentSkipReasons.get(description) ?? 0) + 1);
  }
  const identitySet = new Set(currentKeys);
  const historicalSkipKeys = [...historySkipByKey.keys()];
  const rawArtifactManifest = manifest.artifactManifest ?? [];
  const artifactChecks = rawArtifactManifest.map((entry) => {
    if (typeof entry.path !== "string") fail("Capture artifact manifest contains a malformed path.");
    const path = resolve(captureRoot, entry.path);
    const relativeArtifactPath = relative(captureRoot, path);
    if (!relativeArtifactPath || relativeArtifactPath === ".." || relativeArtifactPath.startsWith(`..${sep}`)) fail("Capture artifact manifest path escapes the capture directory.");
    const bytes = readFileSync(path);
    return { path: entry.path, sizeBytes: bytes.byteLength, expectedSizeBytes: entry.sizeBytes, sha256: sha256(bytes), expectedSha256: entry.sha256, passed: bytes.byteLength === entry.sizeBytes && sha256(bytes) === entry.sha256 };
  });
  const normalized = {
    schemaVersion: 1,
    evidenceId: "m7r-broad-e2e-current-source-recovery-v1",
    generatedAt: new Date().toISOString(),
    provenance: {
      executionSourceCommitSha: manifest.executionSourceCommitSha,
      executionSourceTreeSha: manifest.source?.executionCommitTree ?? null,
      captureRunnerSourceCommitSha: manifest.captureRunnerSourceCommitSha,
      normalizerSourceCommitSha: args.normalizerSha,
      correctedRunnerSourceCommitSha: args.normalizerSha,
      analysisToolingSourceCommitSha: args.normalizerSha,
      captureId: manifest.captureId,
      captureManifestPath: args.manifestPath,
      captureManifestSha256: sha256(manifestBytes),
      historicalM7kReportPath: historyPath,
      historicalM7kReportSha256: sha256(historicalBytes),
      rawArtifacts: [ordinary, rendererSerial].map((lane) => ({ path: `${manifest.outputDirectory}/${lane.rawArtifact}`, sha256: lane.rawSha256, sizeBytes: lane.rawBytes })),
    },
    environment: {
      runtime: manifest.environment?.runtime ?? null,
      npmVersion: manifest.environment?.npmVersion ?? null,
      playwrightVersion: manifest.environment?.playwrightVersion ?? null,
      browserVersion: manifest.environment?.browserVersion ?? null,
      browserEvidence: manifest.environment?.browserEvidence ?? null,
      threeJsVersion: manifest.environment?.threeJsVersion ?? null,
      threeRevision: manifest.environment?.threeRevision ?? null,
      nativeWebGpuRequested: manifest.environment?.nativeWebGpuRequested ?? null,
      rendererBackend: manifest.environment?.rendererBackend ?? null,
      effectiveEnvironmentFlags: manifest.environment?.effectiveEnvironmentFlags ?? null,
    },
    policy: manifest.policy,
    discovery: {
      ordinaryCount: ordinary.identityReconciliation.discovered,
      rendererSerialCount: rendererSerial.identityReconciliation.discovered,
      ordinarySpecFiles: new Set(ordinary.tests.map((test) => test.sourceSpec)).size,
      rendererSerialSpecFiles: new Set(rendererSerial.tests.map((test) => test.sourceSpec)).size,
      total: currentTests.length,
      unique: identitySet.size,
      historicalM7kCount: historicalKeys.length,
      missingHistorical,
      newCurrent,
    },
    lanes: {
      ordinary: { ...ordinary, tests: undefined },
      rendererSerial: { ...rendererSerial, tests: undefined },
    },
    summary: {
      discovered: currentTests.length,
      passed: currentTests.filter((test) => test.actualStatus === "passed").length,
      unexpected: currentTests.filter((test) => test.actualStatus !== test.expectedStatus).length,
      failed: currentTests.filter((test) => test.actualStatus === "failed").length,
      timedOut: currentTests.filter((test) => test.actualStatus === "timedOut").length,
      skipped: currentTests.filter((test) => test.actualStatus === "skipped").length,
      flaky: currentTests.filter((test) => test.results.length > 1 || test.retryCount > 0).length,
      incomplete: currentTests.filter((test) => test.results.length !== 1 || test.actualStatus === "no-result").length,
      retries: currentTests.reduce((total, test) => total + test.retryCount, 0),
      ordinary: ordinary.summary,
      rendererSerial: rendererSerial.summary,
    },
    actualWorkerOverlap: {
      ordinary: ordinary.summary.workerEvidence,
      rendererSerial: rendererSerial.summary.workerEvidence,
    },
    historicalReconciliation: {
      compared: reconciliation.length,
      missingHistoricalCount: missingHistorical.length,
      newCurrentCount: newCurrent.length,
      dispositions: Object.fromEntries([...new Set(reconciliation.map((item) => item.disposition))].sort().map((disposition) => [disposition, reconciliation.filter((item) => item.disposition === disposition).length])),
      tests: reconciliation,
    },
    testInventory,
    currentSkipAudit: {
      count: currentSkips.length,
      historicalSkipIdentities: historicalSkipKeys.length,
      historicalSkipRechecks: historicalSkipRechecks.length,
      approvedExclusions: currentSkips.filter((entry) => entry.approvedExclusion !== null).length,
      reasonGroups: [...currentSkipReasons.entries()].map(([reason, count]) => ({ reason, count })).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
      tests: currentSkips,
      historicalTests: historicalSkipRechecks,
    },
    artifactIntegrity: {
      manifestArtifactCount: rawArtifactManifest.length,
      checked: artifactChecks.length,
      failed: artifactChecks.filter((entry) => !entry.passed).map((entry) => entry.path),
      artifacts: artifactChecks,
    },
  };
  mkdirSync(dirname(args.outputAbsolute), { recursive: true });
  writeFileSync(args.outputAbsolute, `${JSON.stringify(normalized, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`M7R normalized capture: ${args.outputPath}\n`);
  process.stdout.write(`Current inventory: ${normalized.summary.discovered}; passed ${normalized.summary.passed}; unexpected ${normalized.summary.unexpected}; skipped ${normalized.summary.skipped}; incomplete ${normalized.summary.incomplete}.\n`);
};

try {
  main();
} catch (error) {
  process.stderr.write(`M7R normalization failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
