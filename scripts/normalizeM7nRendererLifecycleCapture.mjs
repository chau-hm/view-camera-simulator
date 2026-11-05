import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

const args = new Map(process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  return separator < 0
    ? [argument.replace(/^--/, ""), "true"]
    : [argument.slice(2, separator), argument.slice(separator + 1)];
}));
const required = ["input", "out-dir", "capture-id", "execution-source-sha", "tooling-source-sha"];
for (const name of required) if (!args.has(name)) throw new Error(`Missing --${name}`);

const captureDefinitions = {
  "target-solo-w1-trace-off": {
    workload: "canvas-target-alone",
    configuredWorkers: 1,
    tracingEnabled: false,
    identities: ["architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension"],
  },
  "target-solo-w1-trace-on": {
    workload: "canvas-target-alone",
    configuredWorkers: 1,
    tracingEnabled: true,
    identities: ["architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension"],
  },
  "target-light-peers-w4": {
    workload: "canvas-target-plus-three-light-peers",
    configuredWorkers: 4,
    tracingEnabled: true,
    identities: [
      "architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
      "home.spec.ts::concept learning sections keep their responsive grids without overflow",
      "simulator-header.spec.ts::keeps the active lesson context between the brand and desktop actions",
      "smoke.spec.ts::smoke: app boots at home",
    ],
  },
  "target-renderer-heavy-peers-w4": {
    workload: "canvas-target-plus-three-renderer-heavy-peers",
    configuredWorkers: 4,
    tracingEnabled: true,
    identities: [
      "architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
      "macro-bellows-extension.spec.ts::Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions",
      "macro-compound-movements.spec.ts::Macro 4 teaches compound Tilt + Swing + Focus through the public route",
      "mirror-shift-rig-lateral.spec.ts::Mirror Shift Camera focus follows the rig while Scene focus stays fixed",
    ],
  },
};
const definition = captureDefinitions.get?.(args.get("capture-id")) ?? captureDefinitions[args.get("capture-id")];
if (!definition) throw new Error(`Unknown M7N capture id: ${args.get("capture-id")}`);
const shaPattern = /^[0-9a-f]{40}$/i;
if (!shaPattern.test(args.get("execution-source-sha")) || !shaPattern.test(args.get("tooling-source-sha"))) {
  throw new Error("M7N execution/tooling source identities must be full 40-character commit SHAs.");
}
const inputPath = resolve(args.get("input"));
const outputDirectory = resolve(args.get("out-dir"));
const runId = args.get("run-id") ?? args.get("capture-id");
if (args.has("workers") && Number(args.get("workers")) !== definition.configuredWorkers) {
  throw new Error(`${args.get("capture-id")} requires ${definition.configuredWorkers} configured worker(s).`);
}
if (args.has("trace-enabled") && (args.get("trace-enabled") === "true") !== definition.tracingEnabled) {
  throw new Error(`${args.get("capture-id")} has an inconsistent trace-enabled value.`);
}

const rawBytes = await readFile(inputPath);
const playwrightReport = JSON.parse(rawBytes.toString("utf8"));
const gatheredSpecs = [];
const gatherSpecs = (suites, inheritedFile = null) => {
  for (const suite of suites ?? []) {
    const file = suite.file ?? inheritedFile;
    for (const spec of suite.specs ?? []) gatheredSpecs.push({ spec, file: spec.file ?? file });
    gatherSpecs(suite.suites, file);
  }
};
gatherSpecs(playwrightReport.suites);

const normalizeFailure = (results) => {
  const failed = results.find((result) => result.status === "failed" || result.status === "timedOut" || result.status === "interrupted");
  if (!failed) return null;
  const firstError = failed.errors?.[0]?.message ?? failed.errors?.[0]?.value ?? failed.status;
  const summary = String(firstError).split("\n")[0].slice(0, 240);
  if (/scene-canvas.*canvas|canvas.*scene-canvas/i.test(summary)) return "scene-canvas-missing";
  if (/timeout|timed out/i.test(summary) || failed.status === "timedOut") return "test-timeout";
  return summary.replace(/\b(?:[A-Z]:)?(?:\/[^\s:]+)+/g, "<path>");
};

const normalizedTests = gatheredSpecs.map(({ spec, file }) => {
  const fileName = basename(file ?? "unknown.spec.ts");
  const identity = `${fileName}::${spec.title}`;
  const test = spec.tests?.find((candidate) => candidate.projectName === "chromium") ?? spec.tests?.[0];
  const results = test?.results ?? [];
  const statuses = results.map((result) => result.status);
  let outcome = "incomplete";
  if (statuses.includes("skipped") || test?.expectedStatus === "skipped") outcome = "skipped";
  else if (statuses.includes("interrupted") || statuses.length === 0) outcome = "incomplete";
  else if (statuses.every((status) => status === "passed")) outcome = statuses.length > 1 ? "flaky" : "passed";
  else outcome = "unexpected";

  const attempts = results.map((result) => ({
    status: result.status,
    retry: result.retry,
    workerIndex: result.workerIndex,
    startTime: result.startTime,
    durationMs: result.duration,
    failureSignature: result.status === "passed" ? null : normalizeFailure([result]),
  }));
  return { identity, outcome, expectedStatus: test?.expectedStatus ?? null, attempts, sourceSpecFile: fileName };
});

const identities = normalizedTests.map((test) => test.identity).sort();
if (identities.length !== definition.identities.length || identities.some((identity, index) => identity !== [...definition.identities].sort()[index])) {
  throw new Error(`Selected test identities do not match ${args.get("capture-id")}: ${identities.join(" | ")}`);
}
if (normalizedTests.some((test) => test.attempts.length > 1)) {
  throw new Error(`M7N controlled captures require zero retries: ${args.get("capture-id")} contains multiple attempts.`);
}

const timedAttempts = normalizedTests.flatMap((test) => test.attempts.map((attempt) => ({
  start: Date.parse(attempt.startTime),
  end: Date.parse(attempt.startTime) + attempt.durationMs,
  workerIndex: attempt.workerIndex,
})));
const points = timedAttempts.flatMap((attempt) => [
  { time: attempt.start, delta: 1 },
  { time: attempt.end, delta: -1 },
]).sort((a, b) => a.time - b.time || a.delta - b.delta);
let currentConcurrency = 0;
let maxConcurrentTests = 0;
for (const point of points) {
  currentConcurrency += point.delta;
  maxConcurrentTests = Math.max(maxConcurrentTests, currentConcurrency);
}

const targetSpec = gatheredSpecs.find(({ spec, file }) =>
  `${basename(file ?? "unknown.spec.ts")}::${spec.title}` === definition.identities[0],
);
const targetTest = targetSpec?.spec.tests?.find((candidate) => candidate.projectName === "chromium") ?? targetSpec?.spec.tests?.[0];
const snapshotAttachments = targetTest?.results?.flatMap((result) => result.attachments ?? []) ?? [];
const snapshotAttachment = snapshotAttachments.find((attachment) =>
  attachment.name === `m7n-${runId}-canvas-count-assertion-failure-lifecycle-snapshot.json`,
) ?? snapshotAttachments.find((attachment) => attachment.name === `m7n-${runId}-lifecycle-snapshot.json`);
let lifecycleSnapshot = null;
if (snapshotAttachment?.body) {
  try {
    lifecycleSnapshot = JSON.parse(Buffer.from(snapshotAttachment.body, "base64").toString("utf8"));
  } catch (error) {
    throw new Error(`Unable to decode M7N failure snapshot: ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (!lifecycleSnapshot) {
  throw new Error(`Capture ${args.get("capture-id")} is missing its M7N browser diagnostic snapshot.`);
}
if (definition.tracingEnabled && !lifecycleSnapshot.observed?.applicationTrace) {
  throw new Error(`Trace-enabled capture ${args.get("capture-id")} is missing application lifecycle telemetry.`);
}
if (!definition.tracingEnabled && lifecycleSnapshot.observed?.applicationTrace) {
  throw new Error(`Trace-disabled capture ${args.get("capture-id")} unexpectedly created application telemetry.`);
}

const outputCaptureId = args.get("capture-id");
const diagnosticsPath = `${outputCaptureId}.diagnostics.json`;
const outcomesPath = `${outputCaptureId}.outcomes.json`;
const diagnosticsArtifactPath = relative(process.cwd(), join(outputDirectory, diagnosticsPath)).split(sep).join("/");
const diagnosticsBody = lifecycleSnapshot ? `${JSON.stringify(lifecycleSnapshot, null, 2)}\n` : null;
const diagnosticsSha256 = diagnosticsBody
  ? createHash("sha256").update(diagnosticsBody).digest("hex")
  : null;
const rawCaptureSha256 = createHash("sha256").update(rawBytes).digest("hex");
const rawCaptureByteCount = rawBytes.byteLength;
const statDurationMs = playwrightReport.stats?.duration ?? null;
const statusCounts = normalizedTests.reduce((counts, test) => {
  counts[test.outcome] = (counts[test.outcome] ?? 0) + 1;
  return counts;
}, {});
const browserVersion = lifecycleSnapshot?.browserVersion ?? "unknown";
const report = {
  schema: "m7n-playwright-outcomes-v1",
  captureId: outputCaptureId,
  executionSourceCommitSha: args.get("execution-source-sha"),
  toolingSourceCommitSha: args.get("tooling-source-sha"),
  normalizerSourceCommitSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  rawCapture: {
    sha256: rawCaptureSha256,
    bytes: rawCaptureByteCount,
    retention: "private-local-only",
    offlineReplayAvailable: false,
  },
  normalizedTrace: diagnosticsBody ? {
    artifactPath: diagnosticsArtifactPath,
    sha256: diagnosticsSha256,
    eventSchemaVersion: lifecycleSnapshot.observed.applicationTrace?.schemaVersion ?? null,
    eventCount: lifecycleSnapshot.observed.applicationTrace?.events.length ?? 0,
    droppedEventCount: lifecycleSnapshot.observed.applicationTrace?.droppedEventCount ?? 0,
    unavailable: false,
  } : {
    artifactPath: null,
    sha256: null,
    eventSchemaVersion: null,
    eventCount: 0,
    droppedEventCount: 0,
    unavailable: true,
  },
  config: {
    projectName: "chromium",
    configuredWorkers: definition.configuredWorkers,
    configuredRetries: 0,
    traceEnabled: definition.tracingEnabled,
  },
  experiment: {
    workload: definition.workload,
    selectedIdentities: definition.identities,
    maxConcurrentTests,
    actualWorkerIndices: [...new Set(timedAttempts.map((attempt) => attempt.workerIndex))].sort((a, b) => a - b),
    durationMs: statDurationMs,
  },
  outcomes: {
    discovered: normalizedTests.length,
    passed: statusCounts.passed ?? 0,
    unexpected: statusCounts.unexpected ?? 0,
    skipped: statusCounts.skipped ?? 0,
    flaky: statusCounts.flaky ?? 0,
    incomplete: statusCounts.incomplete ?? 0,
    retries: normalizedTests.reduce((total, test) => total + Math.max(0, test.attempts.length - 1), 0),
  },
  diagnosticSnapshotPhase: lifecycleSnapshot.capturePhase ?? "unknown",
  tests: normalizedTests,
  environment: {
    nodeVersion: process.version,
    platform: process.platform,
    browserName: "Chromium",
    browserVersion,
  },
};
const outcomesBody = `${JSON.stringify(report, null, 2)}\n`;

await mkdir(outputDirectory, { recursive: true });
if (diagnosticsBody) await writeFile(join(outputDirectory, diagnosticsPath), diagnosticsBody, { flag: "wx" });
await writeFile(join(outputDirectory, outcomesPath), outcomesBody, { flag: "wx" });
console.log(JSON.stringify({
  captureId: outputCaptureId,
  outcomesPath: join(outputDirectory, outcomesPath),
  diagnosticsPath: diagnosticsBody ? join(outputDirectory, diagnosticsPath) : null,
  rawCaptureSha256,
  normalizedTraceSha256: diagnosticsSha256,
  outcomes: report.outcomes,
  configuredWorkers: definition.configuredWorkers,
  maxConcurrentTests,
}, null, 2));
