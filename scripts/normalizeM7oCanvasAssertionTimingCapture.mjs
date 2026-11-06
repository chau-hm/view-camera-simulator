import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argumentsMap = new Map(process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  return separator < 0
    ? [argument.replace(/^--/, ""), "true"]
    : [argument.slice(2, separator), argument.slice(separator + 1)];
}));
const requiredArguments = ["input", "out-dir", "capture-id", "condition", "configured-workers", "instrumentation-enabled", "execution-source-sha", "tooling-source-sha"];
for (const name of requiredArguments) if (!argumentsMap.has(name)) throw new Error(`Missing --${name}`);
const shaPattern = /^[0-9a-f]{40}$/i;
for (const name of ["execution-source-sha", "tooling-source-sha"]) {
  if (!shaPattern.test(argumentsMap.get(name))) throw new Error(`--${name} must be a full 40-character commit SHA.`);
}

const captureContracts = {
  A: {
    id: "A",
    workload: "target-alone-instrumentation-off",
    workers: 1,
    instrumentation: false,
    identities: ["architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension"],
  },
  B: {
    id: "B",
    workload: "target-alone-instrumentation-on",
    workers: 1,
    instrumentation: true,
    identities: ["architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension"],
  },
  C: {
    id: "C",
    workload: "target-plus-three-light-peers",
    workers: 4,
    instrumentation: true,
    identities: [
      "architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
      "home.spec.ts::concept learning sections keep their responsive grids without overflow",
      "simulator-header.spec.ts::keeps the active lesson context between the brand and desktop actions",
      "smoke.spec.ts::smoke: app boots at home",
    ],
  },
  D: {
    id: "D",
    workload: "target-plus-three-renderer-heavy-peers",
    workers: 4,
    instrumentation: true,
    identities: [
      "architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
      "macro-bellows-extension.spec.ts::Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions",
      "macro-compound-movements.spec.ts::Macro 4 teaches compound Tilt + Swing + Focus through the public route",
      "mirror-shift-rig-lateral.spec.ts::Mirror Shift Camera focus follows the rig while Scene focus stays fixed",
    ],
  },
};
const playwrightEntry = createRequire(import.meta.url).resolve("@playwright/test");
const playwrightPackage = JSON.parse(await readFile(resolve(dirname(playwrightEntry), "package.json"), "utf8"));
const contract = captureContracts[argumentsMap.get("condition")];
if (!contract) throw new Error("--condition must be A, B, C, or D.");
const configuredWorkers = Number(argumentsMap.get("configured-workers"));
const instrumentationEnabled = argumentsMap.get("instrumentation-enabled") === "true";
if (configuredWorkers !== contract.workers || instrumentationEnabled !== contract.instrumentation) {
  throw new Error(`Condition ${contract.id} has an inconsistent worker or instrumentation configuration.`);
}

const rawBytes = await readFile(resolve(argumentsMap.get("input")));
const playwrightReport = JSON.parse(rawBytes.toString("utf8"));
const specs = [];
const gatherSpecs = (suites, inheritedFile = null) => {
  for (const suite of suites ?? []) {
    const file = suite.file ?? inheritedFile;
    for (const spec of suite.specs ?? []) specs.push({ spec, file: spec.file ?? file });
    gatherSpecs(suite.suites, file);
  }
};
gatherSpecs(playwrightReport.suites);
const tests = [];
for (const { spec, file } of specs) {
  const fileName = basename(file ?? "unknown.spec.ts");
  const identity = `${fileName}::${spec.title}`;
  for (const test of spec.tests ?? []) {
    if (test.projectName !== "chromium") continue;
    for (const result of test.results ?? []) {
      tests.push({
        identity,
        projectName: test.projectName,
        expectedStatus: test.expectedStatus,
        outcome: result.status,
        retry: result.retry,
        workerIndex: result.workerIndex,
        startTime: result.startTime,
        durationMs: result.duration,
        errorSummary: result.errors?.[0]?.message?.split("\n")[0]?.slice(0, 240) ?? null,
        rawFailureMessage: result.errors?.[0]?.message ?? null,
        attachments: result.attachments ?? [],
      });
    }
  }
}

const identities = [...new Set(tests.map((test) => test.identity))].sort();
const expectedIdentities = [...contract.identities].sort();
if (identities.length !== expectedIdentities.length || identities.some((identity, index) => identity !== expectedIdentities[index])) {
  throw new Error(`Condition ${contract.id} test identities mismatch: ${identities.join(" | ")}`);
}
if (tests.length !== expectedIdentities.length) throw new Error(`Condition ${contract.id} expected exactly one attempt per selected test; got ${tests.length}.`);
if (tests.some((test) => test.retry !== 0)) throw new Error(`Condition ${contract.id} must have zero retries.`);

const targetTest = tests.find((test) => test.identity === contract.identities[0]);
const plainTargetFailure = String(targetTest?.rawFailureMessage ?? "").replace(/\u001b\[[0-9;]*m/g, "");
const parseCount = (pattern) => Number(plainTargetFailure.match(pattern)?.[1] ?? NaN);
const targetFailureEvidence = targetTest?.outcome === "passed" ? null : {
  evidenceSource: "Playwright public assertion failure message and aggregated call log",
  matcher: plainTargetFailure.includes("toHaveCount") ? "toHaveCount" : null,
  expectedCount: parseCount(/Expected:\s*(\d+)/),
  receivedCount: parseCount(/Received:\s*(\d+)/),
  timeoutMs: parseCount(/Timeout:\s*(\d+)ms/),
  aggregatedLocatorResolutionsAtZero: parseCount(/(\d+)\s*[×x]\s*locator resolved to 0 elements/),
  perObservationTimestampsAvailable: false,
  limitation: "The rendered call log aggregates repeated locator resolutions and does not expose an exact timestamped toHaveCount retry callback.",
};
const captureAttachment = targetTest?.attachments.find((attachment) => attachment.name === `m7o-${argumentsMap.get("capture-id")}-canvas-assertion-timing.json`);
let diagnosticCapture = null;
if (captureAttachment?.body) {
  try {
    try {
      diagnosticCapture = JSON.parse(captureAttachment.body);
    } catch {
      diagnosticCapture = JSON.parse(Buffer.from(captureAttachment.body, "base64").toString("utf8"));
    }
  } catch (error) {
    throw new Error(`Unable to decode M7O diagnostic attachment: ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (contract.instrumentation && !diagnosticCapture) throw new Error(`Condition ${contract.id} is missing its M7O diagnostic attachment.`);
if (!contract.instrumentation && diagnosticCapture) throw new Error("Instrumentation-off baseline unexpectedly contains M7O browser instrumentation.");

const timedTests = tests.map((test) => ({
  start: Date.parse(test.startTime),
  end: Date.parse(test.startTime) + test.durationMs,
  workerIndex: test.workerIndex,
}));
const points = timedTests.flatMap((test) => [{ time: test.start, delta: 1 }, { time: test.end, delta: -1 }])
  .sort((left, right) => left.time - right.time || left.delta - right.delta);
let currentConcurrency = 0;
let observedConcurrency = 0;
for (const point of points) {
  currentConcurrency += point.delta;
  observedConcurrency = Math.max(observedConcurrency, currentConcurrency);
}
const statusCounts = tests.reduce((counts, test) => {
  counts[test.outcome] = (counts[test.outcome] ?? 0) + 1;
  return counts;
}, {});
const assertionOutcome = diagnosticCapture?.assertion?.outcome ?? (targetTest?.outcome === "passed" ? "passed" : "failed");
const capture = {
  schemaVersion: 1,
  evaluatorRevision: "m7o-canvas-assertion-timing-evaluator-v1",
  captureId: argumentsMap.get("capture-id"),
  condition: contract.id,
  workload: contract.workload,
  source: {
    executionSourceCommitSha: argumentsMap.get("execution-source-sha"),
    toolingSourceCommitSha: argumentsMap.get("tooling-source-sha"),
    testSourcePath: "src/tests/e2e/architecture-rise-focus-range.spec.ts",
    testIdentity: contract.identities[0],
    normalizerSourceCommitSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim(),
  },
  rawCapture: {
    sha256: createHash("sha256").update(rawBytes).digest("hex"),
    bytes: rawBytes.byteLength,
    retention: "private-local-only",
    outputPath: null,
  },
  configuration: {
    project: "chromium",
    browserName: "Chromium",
    configuredWorkers,
    retries: 0,
    diagnosticInstrumentationEnabled: instrumentationEnabled,
    selectedIdentities: contract.identities,
  },
  execution: {
    selectedTests: tests.map(({ attachments, rawFailureMessage, ...test }) => test),
    discovered: tests.length,
    passed: statusCounts.passed ?? 0,
    failed: statusCounts.failed ?? 0,
    timedOut: statusCounts.timedOut ?? 0,
    skipped: statusCounts.skipped ?? 0,
    incomplete: statusCounts.interrupted ?? 0,
    retries: 0,
    observedConcurrency,
    workerIndices: [...new Set(tests.map((test) => test.workerIndex))].sort((left, right) => left - right),
    targetAssertionOutcome: assertionOutcome,
    targetFailureEvidence,
    processExitCode: playwrightReport.stats?.unexpected > 0 ? 1 : 0,
  },
  diagnosticCapture,
  provenance: {
    playwrightVersion: playwrightPackage.version,
    nodeVersion: process.version,
    normalizedAt: new Date().toISOString(),
  },
};

const outputDirectory = resolve(argumentsMap.get("out-dir"));
await mkdir(outputDirectory, { recursive: true });
const outputPath = resolve(outputDirectory, `${argumentsMap.get("capture-id")}.json`);
const outputBytes = Buffer.from(`${JSON.stringify(capture, null, 2)}\n`);
await writeFile(outputPath, outputBytes, { flag: "wx" });
console.log(JSON.stringify({
  captureId: capture.captureId,
  outputPath: relative(repositoryRoot, outputPath).split(sep).join("/"),
  sha256: createHash("sha256").update(outputBytes).digest("hex"),
  observedConcurrency,
  outcomes: { passed: capture.execution.passed, failed: capture.execution.failed, skipped: capture.execution.skipped },
  targetAssertionOutcome: assertionOutcome,
  instrumentationEnabled,
}, null, 2));
