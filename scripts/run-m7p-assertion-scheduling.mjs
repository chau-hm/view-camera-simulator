import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argumentsMap = new Map(process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  return separator < 0
    ? [argument.replace(/^--/, ""), "true"]
    : [argument.slice(2, separator), argument.slice(separator + 1)];
}));
const outputDirectory = resolve(argumentsMap.get("out-dir") ?? resolve(tmpdir(), `m7p-assertion-scheduling-${Date.now()}`));
const attempts = Number(argumentsMap.get("attempts") ?? "3");
const selectedCondition = argumentsMap.get("condition") ?? null;
if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) throw new Error("--attempts must be between 1 and 5.");
const outputRelativeToRepository = relative(repositoryRoot, outputDirectory);
if (outputRelativeToRepository === "" || (!outputRelativeToRepository.startsWith(`..${sep}`) && outputRelativeToRepository !== "..")) {
  throw new Error("M7P raw output must be outside the repository worktree.");
}

const playwrightEntry = createRequire(import.meta.url).resolve("@playwright/test");
const cliPath = resolve(dirname(playwrightEntry), "cli.js");
const targetFile = "src/tests/e2e/architecture-rise-focus-range.spec.ts";
const targetTestTitle = "Architecture Rise focus control stays within scene depth and preserves thin-lens extension";
const definitions = [
  {
    id: "P1",
    name: "target-solo-tracing-off",
    workers: 1,
    traceEnabled: false,
    syntheticStallMs: 0,
    paths: [targetFile],
    grep: targetTestTitle,
    expectedIdentities: [targetTestTitle],
  },
  {
    id: "P2",
    name: "target-solo-tracing-on",
    workers: 1,
    traceEnabled: true,
    syntheticStallMs: 0,
    paths: [targetFile],
    grep: targetTestTitle,
    expectedIdentities: [targetTestTitle],
  },
  {
    id: "P3",
    name: "target-plus-light-peers-w4",
    workers: 4,
    traceEnabled: true,
    syntheticStallMs: 0,
    paths: [
      targetFile,
      "src/tests/e2e/home.spec.ts",
      "src/tests/e2e/simulator-header.spec.ts",
      "src/tests/e2e/smoke.spec.ts",
    ],
    grep: "Architecture Rise focus control stays within scene depth and preserves thin-lens extension|concept learning sections keep their responsive grids without overflow|keeps the active lesson context between the brand and desktop actions|smoke: app boots at home",
    expectedIdentities: [
      targetTestTitle,
      "concept learning sections keep their responsive grids without overflow",
      "keeps the active lesson context between the brand and desktop actions",
      "smoke: app boots at home",
    ],
  },
  {
    id: "P4-off",
    name: "target-plus-renderer-heavy-peers-w4-tracing-off",
    workers: 4,
    traceEnabled: false,
    syntheticStallMs: 0,
    paths: [
      targetFile,
      "src/tests/e2e/macro-bellows-extension.spec.ts",
      "src/tests/e2e/macro-compound-movements.spec.ts",
      "src/tests/e2e/mirror-shift-rig-lateral.spec.ts",
    ],
    grep: "Architecture Rise focus control stays within scene depth and preserves thin-lens extension|Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions|Macro 4 teaches compound Tilt \\+ Swing \\+ Focus through the public route|Mirror Shift Camera focus follows the rig while Scene focus stays fixed",
    expectedIdentities: [
      targetTestTitle,
      "Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions",
      "Macro 4 teaches compound Tilt + Swing + Focus through the public route",
      "Mirror Shift Camera focus follows the rig while Scene focus stays fixed",
    ],
  },
  {
    id: "P4-trace",
    name: "target-plus-renderer-heavy-peers-w4-tracing-on",
    workers: 4,
    traceEnabled: true,
    syntheticStallMs: 0,
    paths: [
      targetFile,
      "src/tests/e2e/macro-bellows-extension.spec.ts",
      "src/tests/e2e/macro-compound-movements.spec.ts",
      "src/tests/e2e/mirror-shift-rig-lateral.spec.ts",
    ],
    grep: "Architecture Rise focus control stays within scene depth and preserves thin-lens extension|Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions|Macro 4 teaches compound Tilt \\+ Swing \\+ Focus through the public route|Mirror Shift Camera focus follows the rig while Scene focus stays fixed",
    expectedIdentities: [
      targetTestTitle,
      "Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions",
      "Macro 4 teaches compound Tilt + Swing + Focus through the public route",
      "Mirror Shift Camera focus follows the rig while Scene focus stays fixed",
    ],
  },
  {
    id: "P5",
    name: "target-with-bounded-non-renderer-main-thread-stall",
    workers: 1,
    traceEnabled: true,
    syntheticStallMs: 5_400,
    paths: [targetFile],
    grep: targetTestTitle,
    expectedIdentities: [targetTestTitle],
  },
];
const definitionsToRun = selectedCondition
  ? definitions.filter((definition) => definition.id === selectedCondition)
  : definitions;
if (definitionsToRun.length === 0) {
  throw new Error(`Unknown --condition=${selectedCondition}. Use P1, P2, P3, P4-off, P4-trace, or P5.`);
}

const collectResults = (suites, pathPrefix = []) => {
  const results = [];
  for (const suite of suites ?? []) {
    const suitePath = [...pathPrefix, suite.title].filter(Boolean);
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          results.push({
            identity: spec.title,
            file: spec.file,
            projectName: test.projectName,
            status: result.status,
            retry: result.retry,
            durationMs: result.duration,
            startTime: result.startTime,
            workerIndex: result.workerIndex,
            parallelIndex: result.parallelIndex,
            expectedStatus: test.expectedStatus,
            errorMessages: (result.errors ?? []).map((error) => error.message ?? "").slice(0, 2),
            suitePath,
          });
        }
      }
    }
    results.push(...collectResults(suite.suites, suitePath));
  }
  return results;
};

const peakConcurrentTests = (results) => {
  const intervals = results.flatMap((result) => {
    const startMs = Date.parse(result.startTime);
    return Number.isFinite(startMs) && Number.isFinite(result.durationMs)
      ? [{ startMs, endMs: startMs + result.durationMs, identity: result.identity, workerIndex: result.workerIndex }]
      : [];
  });
  const points = intervals.flatMap((interval) => [
    { atMs: interval.startMs, delta: 1, interval },
    { atMs: interval.endMs, delta: -1, interval },
  ]).sort((a, b) => a.atMs - b.atMs || a.delta - b.delta);
  let active = 0;
  let peak = 0;
  for (const point of points) {
    active += point.delta;
    peak = Math.max(peak, active);
  }
  return { peakConcurrentTests: peak, intervals };
};

await mkdir(resolve(outputDirectory, "playwright"), { recursive: true });
await mkdir(resolve(outputDirectory, "artifacts"), { recursive: true });
const runSummary = [];
for (const [conditionIndex, definition] of definitionsToRun.entries()) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const captureId = `${definition.id.toLowerCase()}-r${attempt}`;
    const port = 4300 + conditionIndex * 10 + attempt;
    const reportPath = resolve(outputDirectory, "playwright", `${captureId}.playwright.json`);
    const outputDir = resolve(outputDirectory, "playwright", `${captureId}-results`);
    const environment = {
      ...process.env,
      PLAYWRIGHT_WEB_SERVER_PORT: String(port),
      M7P_CAPTURE_DIAGNOSTICS: "1",
      M7P_CAPTURE_ID: captureId,
      M7P_CAPTURE_OUTPUT_DIR: resolve(outputDirectory, "artifacts"),
      M7P_TRACE_ENABLED: definition.traceEnabled ? "1" : "0",
    };
    if (definition.syntheticStallMs > 0) environment.M7P_SYNTHETIC_STALL_MS = String(definition.syntheticStallMs);
    else delete environment.M7P_SYNTHETIC_STALL_MS;

    const args = [
      cliPath,
      "test",
      ...definition.paths,
      `--grep=${definition.grep}`,
      `--workers=${definition.workers}`,
      "--retries=0",
      "--project=chromium",
      "--reporter=json",
      `--output=${outputDir}`,
    ];
    const result = spawnSync(process.execPath, args, {
      cwd: repositoryRoot,
      env: environment,
      encoding: "utf8",
      maxBuffer: 80 * 1024 * 1024,
      timeout: 180_000,
    });
    if (result.error) throw result.error;
    const output = result.stdout ?? "";
    await writeFile(reportPath, output);
    let report;
    try {
      report = JSON.parse(output);
    } catch (error) {
      throw new Error(`Could not parse Playwright JSON for ${captureId}: ${String(error)}\n${(result.stderr ?? "").slice(-2000)}`);
    }
    const testResults = collectResults(report.suites);
    const observedIdentities = testResults.map((test) => test.identity).sort();
    const expectedIdentities = [...definition.expectedIdentities].sort();
    if (JSON.stringify(observedIdentities) !== JSON.stringify(expectedIdentities)) {
      throw new Error(`${captureId} test identity mismatch: expected ${expectedIdentities.join(" | ")}; got ${observedIdentities.join(" | ")}`);
    }
    if (testResults.some((test) => test.retry !== 0)) throw new Error(`${captureId} unexpectedly retried a test.`);
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`${captureId} runner failed outside captured test outcomes (exit ${result.status ?? "null"}, signal ${result.signal ?? "none"}).`);
    }
    const concurrency = peakConcurrentTests(testResults);
    const row = {
      captureId,
      condition: definition.id,
      name: definition.name,
      configuredWorkers: definition.workers,
      tracingEnabled: definition.traceEnabled,
      syntheticStallMs: definition.syntheticStallMs,
      exitCode: result.status ?? 1,
      testResults,
      ...concurrency,
      reportPath,
      stderrTail: (result.stderr ?? "").slice(-2000),
    };
    runSummary.push(row);
    console.log(JSON.stringify(row));
  }
}

const sourceCommit = spawnSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" });
if (sourceCommit.status !== 0) throw new Error("Could not identify the M7P source commit.");
const summaryPath = resolve(outputDirectory, "m7p-run-summary.json");
await writeFile(summaryPath, `${JSON.stringify({
  schemaVersion: 1,
  repositoryRoot,
  sourceCommit: sourceCommit.stdout.trim(),
  host: { platform: process.platform, release: process.release.name, osRelease: (await import("node:os")).release() },
  nodeVersion: process.version,
  attemptsPerCondition: attempts,
  runs: runSummary,
}, null, 2)}\n`);
console.log(`M7P raw capture bundle: ${summaryPath}`);
