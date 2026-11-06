import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argumentsMap = new Map(process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  return separator < 0
    ? [argument.replace(/^--/, "true"), "true"]
    : [argument.slice(2, separator), argument.slice(separator + 1)];
}));
const required = ["input-dir", "out-dir", "execution-source-sha", "tooling-source-sha"];
for (const name of required) if (!argumentsMap.has(name)) throw new Error(`Missing --${name}`);
const inputDirectory = resolve(argumentsMap.get("input-dir"));
const outputDirectory = resolve(argumentsMap.get("out-dir"));
const runSummary = JSON.parse(await readFile(resolve(inputDirectory, "m7o-run-summary.json"), "utf8"));
if (!Array.isArray(runSummary.runs) || runSummary.runs.length !== 12) {
  throw new Error(`M7O final matrix requires exactly 12 independent attempts; found ${runSummary.runs?.length ?? 0}.`);
}
const normalizerPath = resolve(repositoryRoot, "scripts/normalizeM7oCanvasAssertionTimingCapture.mjs");
const matrixNormalizerSourceCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
const manifestRows = [];
for (const run of runSummary.runs) {
  const normalized = spawnSync(process.execPath, [
    normalizerPath,
    `--input=${run.reportPath}`,
    `--out-dir=${outputDirectory}`,
    `--capture-id=${run.captureId}`,
    `--condition=${run.condition}`,
    `--configured-workers=${run.configuredWorkers}`,
    `--instrumentation-enabled=${run.instrumentationEnabled}`,
    `--execution-source-sha=${argumentsMap.get("execution-source-sha")}`,
    `--tooling-source-sha=${argumentsMap.get("tooling-source-sha")}`,
  ], { cwd: repositoryRoot, encoding: "utf8" });
  if (normalized.error) throw normalized.error;
  if (normalized.status !== 0) throw new Error(normalized.stderr || normalized.stdout || `Normalization failed for ${run.captureId}.`);
  process.stdout.write(normalized.stdout);
  const output = resolve(outputDirectory, `${run.captureId}.json`);
  const outputBytes = await readFile(output);
  const capture = JSON.parse(outputBytes.toString("utf8"));
  const boundaries = capture.diagnosticCapture?.browserBoundaries ?? [];
  const clockAnchors = boundaries.flatMap((boundary) => {
    const browserMonotonicMs = boundary.browser?.sampledAtPageMonotonicMs;
    if (typeof browserMonotonicMs !== "number" || !Number.isFinite(browserMonotonicMs)) return [];
    return [{
      label: boundary.label,
      browserMonotonicMs,
      nodeRequestStartMs: boundary.nodeRequestStartMs,
      nodeResponseEndMs: boundary.nodeResponseEndMs,
      nodeMinusBrowserOffset: {
        minimumMs: boundary.nodeRequestStartMs - browserMonotonicMs,
        maximumMs: boundary.nodeResponseEndMs - browserMonotonicMs,
      },
    }];
  });
  let commonOffsetBounds = null;
  let clockMappingStatus = "unavailable";
  if (clockAnchors.length > 0) {
    const minimumMs = Math.max(...clockAnchors.map((anchor) => anchor.nodeMinusBrowserOffset.minimumMs));
    const maximumMs = Math.min(...clockAnchors.map((anchor) => anchor.nodeMinusBrowserOffset.maximumMs));
    if (minimumMs <= maximumMs) {
      commonOffsetBounds = { minimumMs, maximumMs, uncertaintyMs: maximumMs - minimumMs };
      clockMappingStatus = "bounded-by-overlapping-request-response-anchors";
    } else {
      const unionMinimumMs = Math.min(...clockAnchors.map((anchor) => anchor.nodeMinusBrowserOffset.minimumMs));
      const unionMaximumMs = Math.max(...clockAnchors.map((anchor) => anchor.nodeMinusBrowserOffset.maximumMs));
      commonOffsetBounds = { minimumMs: unionMinimumMs, maximumMs: unionMaximumMs, uncertaintyMs: unionMaximumMs - unionMinimumMs };
      clockMappingStatus = "anchors-do-not-intersect; conservative-union-only";
    }
  }
  capture.clockAlignment = {
    domains: ["Node performance.now() monotonic", "browser performance.now() monotonic"],
    conversion: "browser event interval = browser monotonic time + node-minus-browser offset bounds",
    browserTimeOriginRetainedPerObservation: true,
    anchors: clockAnchors,
    commonOffsetBounds,
    status: clockMappingStatus,
    eventObservationsAreCallbackOrEvaluationTimes: true,
  };
  capture.source.matrixNormalizerSourceCommitSha = matrixNormalizerSourceCommitSha;
  const revisedBytes = Buffer.from(`${JSON.stringify(capture, null, 2)}\n`);
  await writeFile(output, revisedBytes);
  manifestRows.push({
    captureId: run.captureId,
    condition: run.condition,
    configuredWorkers: run.configuredWorkers,
    runnerExitCode: run.exitCode,
    artifactPath: output.replace(`${repositoryRoot}/`, "").split(sep).join("/"),
    artifactSha256: createHash("sha256").update(revisedBytes).digest("hex"),
    artifactBytes: revisedBytes.byteLength,
    rawCaptureSha256: capture.rawCapture.sha256,
    rawCaptureBytes: capture.rawCapture.bytes,
    rawRetention: "private-local-only",
    observedConcurrency: capture.execution.observedConcurrency,
    targetAssertionOutcome: capture.execution.targetAssertionOutcome,
    statusCounts: {
      passed: capture.execution.passed,
      failed: capture.execution.failed,
      timedOut: capture.execution.timedOut,
      skipped: capture.execution.skipped,
      incomplete: capture.execution.incomplete,
    },
    clockMappingStatus,
  });
}
const manifest = {
  schemaVersion: 1,
  evaluatorRevision: "m7o-canvas-assertion-timing-evaluator-v1",
  attemptsPerCondition: runSummary.attemptsPerCondition,
  source: {
    executionSourceCommitSha: argumentsMap.get("execution-source-sha"),
    toolingSourceCommitSha: argumentsMap.get("tooling-source-sha"),
    matrixNormalizerSourceCommitSha,
  },
  artifacts: manifestRows,
};
const manifestPath = resolve(outputDirectory, "capture-manifest.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
console.log(`M7O normalized capture manifest: ${manifestPath.replace(`${repositoryRoot}/`, "").split(sep).join("/")}`);
