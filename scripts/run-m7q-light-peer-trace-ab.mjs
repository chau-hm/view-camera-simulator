import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { tmpdir, release, cpus, networkInterfaces } from "node:os";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  return separator < 0
    ? [argument.replace(/^--/, ""), "true"]
    : [argument.slice(2, separator), argument.slice(separator + 1)];
}));
const outputDirectory = resolve(args.get("out-dir") ?? resolve(tmpdir(), `m7q-light-peer-trace-ab-${Date.now()}`));
const outputRelativeToRepository = relative(repositoryRoot, outputDirectory);
if (outputRelativeToRepository === "" || (!outputRelativeToRepository.startsWith(`..${sep}`) && outputRelativeToRepository !== "..")) {
  throw new Error("M7Q raw output must be outside the repository worktree.");
}

const targetTitle = "Architecture Rise focus control stays within scene depth and preserves thin-lens extension";
const expectedTests = [
  { file: "architecture-rise-focus-range.spec.ts", title: targetTitle, role: "target" },
  { file: "home.spec.ts", title: "concept learning sections keep their responsive grids without overflow", role: "light-peer" },
  { file: "simulator-header.spec.ts", title: "keeps the active lesson context between the brand and desktop actions", role: "light-peer" },
  { file: "smoke.spec.ts", title: "smoke: app boots at home", role: "light-peer" },
];
const selectedPaths = [
  "src/tests/e2e/architecture-rise-focus-range.spec.ts",
  "src/tests/e2e/home.spec.ts",
  "src/tests/e2e/simulator-header.spec.ts",
  "src/tests/e2e/smoke.spec.ts",
];
const grep = expectedTests.map(({ title }) => title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const pairs = [
  { pairId: "pair-1", order: ["off", "on"] },
  { pairId: "pair-2", order: ["on", "off"] },
  { pairId: "pair-3", order: ["on", "off"] },
  { pairId: "pair-4", order: ["off", "on"] },
];
const require = createRequire(import.meta.url);
const playwrightPackage = require("@playwright/test/package.json");
const playwrightEntry = require.resolve("@playwright/test");
const cliPath = resolve(dirname(playwrightEntry), "cli.js");
const sourceCommit = (command, parameters = []) => {
  const result = spawnSync("git", [command, ...parameters], { cwd: repositoryRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Could not read Git source identity: git ${command} ${parameters.join(" ")}`);
  return result.stdout.trim();
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const isWithinRepository = (path) => {
  const relativePath = relative(repositoryRoot, path);
  return relativePath === "" || (!relativePath.startsWith(`..${sep}`) && relativePath !== "..");
};

const chooseAvailablePort = async () => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close(() => reject(new Error("Could not allocate an isolated Playwright server port.")));
      return;
    }
    const port = address.port;
    server.close((error) => error ? reject(error) : resolvePort(port));
  });
});
const portIsClosed = async (port) => new Promise((resolveClosed) => {
  const server = createServer();
  server.once("error", () => resolveClosed(false));
  server.listen(port, "127.0.0.1", () => server.close((error) => resolveClosed(!error)));
});
const waitForPortClosed = async (port, timeoutMs = 20_000) => {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    if (await portIsClosed(port)) return { closed: true, waitedMs: Date.now() - started };
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  return { closed: false, waitedMs: Date.now() - started };
};

const collectResults = (suites) => {
  const results = [];
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          results.push({
            file: spec.file?.split(/[\\/]/).at(-1) ?? null,
            title: spec.title,
            projectName: test.projectName,
            status: result.status,
            retry: result.retry,
            durationMs: result.duration,
            startTime: result.startTime,
            workerIndex: result.workerIndex,
            parallelIndex: result.parallelIndex,
            expectedStatus: test.expectedStatus,
            errorMessages: (result.errors ?? []).map((error) => error.message ?? "").slice(0, 2),
          });
        }
      }
    }
    results.push(...collectResults(suite.suites));
  }
  return results;
};

const summarizeOverlap = (testResults) => {
  const intervals = testResults.map((result) => ({
    file: result.file,
    title: result.title,
    startEpochMs: typeof result.startTime === "string" ? Date.parse(result.startTime) : Number.NaN,
    durationMs: result.durationMs,
    workerIndex: result.workerIndex,
    parallelIndex: result.parallelIndex,
  }));
  const allValid = intervals.length === expectedTests.length && intervals.every((interval) =>
    Number.isFinite(interval.startEpochMs)
      && Number.isFinite(interval.durationMs)
      && interval.durationMs > 0
      && Number.isSafeInteger(interval.workerIndex)
      && interval.workerIndex >= 0
      && Number.isSafeInteger(interval.parallelIndex)
      && interval.parallelIndex >= 0);
  if (!allValid) return { valid: false, intervals, peakConcurrency: null, overlap: null };

  const events = intervals.flatMap((interval) => [
    { atMs: interval.startEpochMs, delta: 1 },
    { atMs: interval.startEpochMs + interval.durationMs, delta: -1 },
  ]).sort((left, right) => left.atMs - right.atMs || left.delta - right.delta);
  let active = 0;
  let peakConcurrency = 0;
  for (const event of events) {
    active += event.delta;
    peakConcurrency = Math.max(peakConcurrency, active);
  }

  const startEpochMs = Math.max(...intervals.map((interval) => interval.startEpochMs));
  const endEpochMs = Math.min(...intervals.map((interval) => interval.startEpochMs + interval.durationMs));
  const activeIntervals = endEpochMs > startEpochMs
    ? intervals.filter((interval) => interval.startEpochMs <= startEpochMs && interval.startEpochMs + interval.durationMs >= endEpochMs)
    : [];
  const workerIds = [...new Set(activeIntervals.map((interval) => interval.workerIndex))].sort((a, b) => a - b);
  const parallelIds = [...new Set(activeIntervals.map((interval) => interval.parallelIndex))].sort((a, b) => a - b);
  const overlap = {
    active: activeIntervals.length === 4
      && workerIds.length === 4
      && parallelIds.length === 4
      && activeIntervals.some((interval) => interval.file === "architecture-rise-focus-range.spec.ts" && interval.title === targetTitle),
    startEpochMs,
    endEpochMs,
    durationMs: Math.max(0, endEpochMs - startEpochMs),
    workerIds,
    parallelIds,
    testIdentities: activeIntervals.map(({ file, title }) => `${file}::${title}`).sort(),
    targetParticipated: activeIntervals.some((interval) => interval.file === "architecture-rise-focus-range.spec.ts" && interval.title === targetTitle),
  };
  return { valid: true, intervals, peakConcurrency, overlap };
};

await mkdir(resolve(outputDirectory, "playwright"), { recursive: true });
await mkdir(resolve(outputDirectory, "artifacts"), { recursive: true });
if (isWithinRepository(outputDirectory)) throw new Error("Resolved M7Q output directory is inside the repository worktree.");

const clean = spawnSync("git", ["status", "--porcelain"], { cwd: repositoryRoot, encoding: "utf8" });
if (clean.status !== 0 || clean.stdout.trim() !== "") {
  throw new Error("M7Q capture requires a clean committed worktree so the source identity is unambiguous.");
}
const captureSourceCommit = sourceCommit("rev-parse", ["--verify", "HEAD"]);
const executionSourceCommit = sourceCommit("rev-parse", ["--verify", "HEAD^{commit}"]);
const executionSourceTreePaths = selectedPaths;
const runStartedAt = new Date().toISOString();
const runSummary = [];
const usedPorts = new Set();

const { chromium } = require("@playwright/test");
let browserVersion = null;
const versionProbe = await chromium.launch();
browserVersion = versionProbe.version();
await versionProbe.close();

for (const pair of pairs) {
  for (const mode of pair.order) {
    const captureId = `m7q-${pair.pairId}-${mode}`;
    const tracingEnabled = mode === "on";
    let port = await chooseAvailablePort();
    while (usedPorts.has(port)) port = await chooseAvailablePort();
    usedPorts.add(port);
    const reportPath = resolve(outputDirectory, "playwright", `${captureId}.playwright.json`);
    const stderrPath = resolve(outputDirectory, "playwright", `${captureId}.stderr.txt`);
    const stdoutPath = resolve(outputDirectory, "playwright", `${captureId}.stdout.txt`);
    const outputDir = resolve(outputDirectory, "playwright", `${captureId}-results`);
    const capturePath = resolve(outputDirectory, "artifacts", `${captureId}.capture.json`);
    const tracePath = resolve(outputDirectory, "artifacts", `${captureId}.trace.json`);
    const attemptStartedAt = new Date().toISOString();
    const attemptStartedMonotonicMs = performance.now();
    const record = {
      captureId,
      pairId: pair.pairId,
      orderIndex: pair.order.indexOf(mode),
      executionOrder: [...pair.order],
      arm: mode,
      tracingEnabled,
      configuredWorkers: 4,
      retries: 0,
      targetIdentity: expectedTests[0],
      expectedTestIdentities: expectedTests,
      executionSourceCommit,
      captureSourceCommit,
      executionSourceTreePaths,
      browserSideInstrumentationEnabled: true,
      cdpSessionCreated: true,
      browserVersion,
      playwrightVersion: playwrightPackage.version,
      nodeVersion: process.version,
      platform: process.platform,
      osRelease: release(),
      architecture: process.arch,
      cpuModel: cpus()[0]?.model ?? null,
      cpuCount: cpus().length,
      webGlMode: "application-default-WebGL",
      webServerPort: port,
      portClosedBeforeRun: await portIsClosed(port),
      attemptStartedAt,
    };

    let environment = { ...process.env };
    for (const key of Object.keys(environment)) {
      if (/^(M7[NO]|GROUND_GLASS_WEBGPU_|OBSERVER_NATIVE_WEBGPU|VITE_GROUND_GLASS_WEBGPU)/.test(key)) delete environment[key];
    }
    environment.PLAYWRIGHT_WEB_SERVER_PORT = String(port);
    environment.M7P_CAPTURE_DIAGNOSTICS = "1";
    environment.M7P_CAPTURE_ID = captureId;
    environment.M7P_CAPTURE_OUTPUT_DIR = resolve(outputDirectory, "artifacts");
    environment.M7P_TRACE_ENABLED = tracingEnabled ? "1" : "0";

    const args = [
      cliPath,
      "test",
      ...selectedPaths,
      `--grep=${grep}`,
      "--workers=4",
      "--retries=0",
      "--project=chromium",
      "--reporter=json",
      `--output=${outputDir}`,
    ];
    const result = spawnSync(process.execPath, args, {
      cwd: repositoryRoot,
      env: environment,
      encoding: "utf8",
      maxBuffer: 96 * 1024 * 1024,
      timeout: 180_000,
      killSignal: "SIGTERM",
    });
    const attemptFinishedAt = new Date().toISOString();
    record.attemptFinishedAt = attemptFinishedAt;
    record.attemptElapsedMs = performance.now() - attemptStartedMonotonicMs;
    record.exitCode = result.status;
    record.signal = result.signal;
    record.spawnError = result.error?.message ?? null;
    record.stderrPath = stderrPath;
    record.stdoutPath = stdoutPath;
    await writeFile(stdoutPath, result.stdout ?? "");
    await writeFile(stderrPath, result.stderr ?? "");
    record.stdoutSha256 = sha256(Buffer.from(result.stdout ?? ""));
    record.stderrSha256 = sha256(Buffer.from(result.stderr ?? ""));
    record.stderrTail = (result.stderr ?? "").slice(-2500);

    let playwrightReport = null;
    try {
      playwrightReport = JSON.parse(result.stdout ?? "");
      const reportBytes = Buffer.from(result.stdout ?? "");
      await writeFile(reportPath, reportBytes);
      record.playwrightReportPath = reportPath;
      record.playwrightReportSha256 = sha256(reportBytes);
      record.testResults = collectResults(playwrightReport.suites);
      record.observedTestIdentities = record.testResults.map(({ file, title }) => `${file}::${title}`).sort();
      record.expectedTestIdentityKeys = expectedTests.map(({ file, title }) => `${file}::${title}`).sort();
      record.testIdentityMatch = JSON.stringify(record.observedTestIdentities) === JSON.stringify(record.expectedTestIdentityKeys);
      record.retriesObserved = record.testResults.map((test) => test.retry);
      const overlap = summarizeOverlap(record.testResults);
      record.workerExecution = overlap;
      record.fourWorkerOverlap = overlap.valid && overlap.overlap?.active === true;
    } catch (error) {
      record.playwrightReportPath = null;
      record.playwrightReportParseError = String(error);
      record.testResults = [];
      record.observedTestIdentities = [];
      record.testIdentityMatch = false;
      record.retriesObserved = [];
      record.workerExecution = { valid: false, intervals: [], peakConcurrency: null, overlap: null };
      record.fourWorkerOverlap = false;
    }

    try {
      const captureBytes = await readFile(capturePath);
      record.capturePath = capturePath;
      record.captureSha256 = sha256(captureBytes);
      record.captureSizeBytes = captureBytes.byteLength;
      const capture = JSON.parse(captureBytes.toString("utf8"));
      const trace = capture.trace ?? {};
      const snapshot = capture.browserSnapshot?.snapshot ?? null;
      const lifecycle = Array.isArray(snapshot?.lifecycle) ? snapshot.lifecycle : [];
      const firstConnectedCanvas = lifecycle.find((item) => item.canvasCount > 0 && item.canvasConnected?.includes(true)) ?? null;
      record.diagnosticCapture = {
        captureId: capture.captureId,
        testIdentity: capture.testIdentity,
        testStatus: capture.testStatus,
        assertion: capture.assertion ?? null,
        nodeClockSyncBrackets: capture.nodeClockSyncBrackets ?? [],
        publicEvaluationIntervals: capture.publicEvaluationIntervals ?? [],
        nodeHeartbeat: capture.nodeHeartbeat ?? [],
        nodeHeartbeatDropped: capture.nodeHeartbeatDropped ?? null,
        browserSnapshot: snapshot ? {
          browserMonotonicMs: snapshot.browserMonotonicMs,
          documentTimeOriginMs: snapshot.documentTimeOriginMs,
          route: snapshot.route,
          longTaskObserverAvailable: snapshot.longTaskObserverAvailable,
          lifecycleMutationObserverAvailable: snapshot.lifecycleMutationObserverAvailable,
          lifecycle: lifecycle,
          lifecycleDropped: snapshot.lifecycleDropped,
          longTasks: snapshot.longTasks ?? [],
          longTaskDropped: snapshot.longTaskDropped,
          heartbeat: snapshot.heartbeat ?? [],
          heartbeatDropped: snapshot.heartbeatDropped,
          heartbeatIntervalMs: snapshot.heartbeatIntervalMs,
        } : null,
        firstConnectedCanvasObservation: firstConnectedCanvas,
        browserSnapshotError: capture.browserSnapshotError ?? null,
        trace: {
          enabled: trace.enabled,
          started: trace.started,
          completed: trace.completed,
          dataLossOccurred: trace.dataLossOccurred,
          stopError: trace.stopError,
          overflowedByCollector: trace.overflowedByCollector,
          maxTraceEvents: trace.maxTraceEvents,
          traceEventCount: trace.traceEventCount,
          traceBufferSizeInKb: trace.traceBufferSizeInKb,
          bufferUsageSamples: trace.bufferUsageSamples,
          maximumBufferPercent: trace.maximumBufferPercent,
          rawTraceSha256: trace.rawTraceSha256,
          rawTraceSizeBytes: trace.rawTraceSizeBytes,
          traceFilePresent: tracingEnabled ? await stat(tracePath).then(() => true, () => false) : false,
        },
      };
      record.tracePath = tracingEnabled ? tracePath : null;
      if (tracingEnabled && record.diagnosticCapture.trace.traceFilePresent) {
        const traceBytes = await readFile(tracePath);
        record.traceSha256Recomputed = sha256(traceBytes);
        record.traceSizeBytesRecomputed = traceBytes.byteLength;
      }
      record.diagnosticCaptureComplete = capture.captureId === captureId
      && typeof capture.testIdentity === "string"
      && capture.testIdentity.endsWith(targetTitle)
        && record.diagnosticCapture.browserSnapshot?.lifecycleMutationObserverAvailable === true
        && record.diagnosticCapture.firstConnectedCanvasObservation !== null
        && Array.isArray(record.diagnosticCapture.nodeClockSyncBrackets)
        && (!tracingEnabled || record.diagnosticCapture.nodeClockSyncBrackets.length >= 2)
        && Array.isArray(record.diagnosticCapture.publicEvaluationIntervals)
        && record.diagnosticCapture.publicEvaluationIntervals.some((interval) => interval.label === "assertion-entry-anchor")
        && record.diagnosticCapture.trace.enabled === tracingEnabled
        && record.diagnosticCapture.trace.started === tracingEnabled
        && record.diagnosticCapture.trace.completed === tracingEnabled
        && (tracingEnabled
          ? record.diagnosticCapture.trace.dataLossOccurred === false
            && record.diagnosticCapture.trace.overflowedByCollector === false
            && record.diagnosticCapture.trace.traceFilePresent === true
            && record.traceSha256Recomputed === record.diagnosticCapture.trace.rawTraceSha256
            && record.traceSizeBytesRecomputed === record.diagnosticCapture.trace.rawTraceSizeBytes
          : record.diagnosticCapture.trace.dataLossOccurred === null
            && record.diagnosticCapture.trace.traceFilePresent === false);
    } catch (error) {
      record.capturePath = null;
      record.captureReadError = String(error);
      record.diagnosticCapture = null;
      record.diagnosticCaptureComplete = false;
      record.tracePath = null;
    }

    record.testOutcome = record.testResults.find((test) => test.file === expectedTests[0].file && test.title === targetTitle)?.status ?? "unavailable";
    record.assertionOutcome = record.diagnosticCapture?.assertion?.outcome ?? null;
    record.assertionOutcomeConsistent = record.assertionOutcome === (record.testOutcome === "passed" ? "passed" : record.testOutcome === "failed" ? "failed" : null);
    record.portClosedAfterRun = await waitForPortClosed(port);
    record.captureValid = record.portClosedBeforeRun
      && record.portClosedAfterRun.closed
      && record.testIdentityMatch
      && record.testResults.length === expectedTests.length
      && record.testResults.every((test) => test.retry === 0 && test.projectName === "chromium")
      && record.fourWorkerOverlap
      && record.diagnosticCaptureComplete
      && record.assertionOutcomeConsistent
      && (result.status === 0 || result.status === 1);

    runSummary.push(record);
    await writeJson(resolve(outputDirectory, "m7q-run-progress.json"), {
      schemaVersion: 1,
      runStartedAt,
      captureSourceCommit,
      executionSourceCommit,
      environment: {
        nodeVersion: process.version,
        playwrightVersion: playwrightPackage.version,
        browserVersion,
        platform: process.platform,
        osRelease: release(),
        architecture: process.arch,
        cpuModel: cpus()[0]?.model ?? null,
        cpuCount: cpus().length,
        rendererBackend: "application-default-WebGL",
        browserSideInstrumentationEnabled: true,
        selectedPaths,
        expectedTests,
      },
      plannedPairs: pairs,
      attemptsCompleted: runSummary.length,
      attempts: runSummary,
    });
    console.log(JSON.stringify({
      captureId,
      tracingEnabled,
      exitCode: record.exitCode,
      targetOutcome: record.testOutcome,
      elapsedMs: record.diagnosticCapture?.assertion?.nodeAssertionSettledMs != null
        ? record.diagnosticCapture.assertion.nodeAssertionSettledMs - record.diagnosticCapture.assertion.nodeAssertionEntryMs
        : null,
      fourWorkerOverlap: record.fourWorkerOverlap,
      overlapMs: record.workerExecution?.overlap?.durationMs ?? null,
      captureValid: record.captureValid,
      portClosed: record.portClosedAfterRun.closed,
    }));
  }
}

const summary = {
  schemaVersion: 1,
  runStartedAt,
  runFinishedAt: new Date().toISOString(),
  repositoryRoot,
  captureSourceCommit,
  executionSourceCommit,
  executionSourceTreePaths,
  host: {
    platform: process.platform,
    osRelease: release(),
    architecture: process.arch,
    cpuModel: cpus()[0]?.model ?? null,
    cpuCount: cpus().length,
    networkInterfaces: Object.entries(networkInterfaces()).flatMap(([name, interfaces]) => (interfaces ?? []).map((item) => ({ name, family: item.family, internal: item.internal }))),
  },
  nodeVersion: process.version,
  playwrightVersion: playwrightPackage.version,
  browserVersion,
  rendererBackend: "application-default-WebGL",
  browserSideInstrumentationEnabled: true,
  plannedPairs: pairs,
  attempts: runSummary,
  rawDirectory: outputDirectory,
};
await writeJson(resolve(outputDirectory, "m7q-run-summary.json"), summary);
console.log(`M7Q raw capture bundle: ${resolve(outputDirectory, "m7q-run-summary.json")}`);

if (runSummary.length !== 8) process.exitCode = 1;
