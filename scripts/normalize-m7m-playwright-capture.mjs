import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const NORMALIZER_REVISION = "m7m-playwright-normalizer-v1";
const args = new Map(process.argv.slice(2).map((arg) => {
  const separator = arg.indexOf("=");
  return separator < 0 ? [arg, ""] : [arg.slice(0, separator), arg.slice(separator + 1)];
}));

const required = ["--input", "--output", "--id", "--source-sha", "--configured-retries"];
for (const key of required) {
  if (!args.get(key)) {
    process.stderr.write("Missing required argument " + key + "\n");
    process.exit(2);
  }
}

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const safeInteger = (value, fallback = null) => Number.isInteger(value) && value >= 0 ? value : fallback;
const inputBytes = readFileSync(args.get("--input"));
const raw = JSON.parse(inputBytes.toString("utf8"));
const rawStart = Date.parse(raw?.stats?.startTime);
if (!Number.isFinite(rawStart) || !Number.isInteger(raw?.config?.workers)) {
  throw new Error("Playwright JSON is missing its start time or configured worker count");
}
if (!/^[0-9a-f]{40}$/.test(args.get("--source-sha"))) {
  throw new Error("Execution source must be a full lowercase Git commit SHA");
}
const configuredRetries = Number(args.get("--configured-retries"));
if (!Number.isInteger(configuredRetries) || configuredRetries < 0) {
  throw new Error("Configured retries must be a nonnegative integer");
}
const testSeam = args.get("--test-seam") ?? "disabled";
if (!new Set(["disabled", "controlled-webgl-failure-recovery"]).has(testSeam)) {
  throw new Error("Unknown test seam declaration");
}

const tests = [];
const visit = (suite) => {
  if (!suite || typeof suite !== "object") return;
  for (const spec of Array.isArray(suite.specs) ? suite.specs : []) {
    const file = String(spec.file ?? "").replaceAll("\\", "/").split("/").pop();
    const title = String(spec.title ?? "");
    for (const test of Array.isArray(spec.tests) ? spec.tests : []) {
      const results = Array.isArray(test.results) ? test.results : [];
      const attempts = results.map((result) => {
        const start = Date.parse(result.startTime);
        return {
          status: String(result.status ?? "unknown"),
          retry: safeInteger(result.retry, 0),
          workerIndex: safeInteger(result.workerIndex),
          startOffsetMs: Number.isFinite(start) ? Math.round(start - rawStart) : null,
          durationMs: safeInteger(Math.round(result.duration), 0),
          failureSignature: failureSignature(result.error?.message ?? result.errors?.[0]?.message ?? ""),
        };
      });
      tests.push({
        identity: file + "::" + title,
        status: String(test.status ?? "unknown"),
        projectName: String(test.projectName ?? "unknown"),
        attempts,
      });
    }
  }
  for (const child of Array.isArray(suite.suites) ? suite.suites : []) visit(child);
};

function failureSignature(message) {
  if (!message) return null;
  if (/getByTestId\('scene-canvas'\)\.locator\('canvas'\)[\s\S]*Received:[^\n]*0/.test(message)) return "scene-canvas-mounted-without-canvas";
  if (/data-observer-renderer-family[\s\S]*webgl-renderer[\s\S]*Received:[^\n]*""/.test(message)) return "observer-renderer-family-empty";
  if (/heading.*3D Scene|3D Scene.*heading/i.test(message)) return "three-d-scene-heading-not-visible";
  if (/1\.25[\s\S]*1\.1988203216292916|1\.1988203216292916[\s\S]*1\.25/.test(message)) return "expanded-viewport-ratio-mismatch";
  if (/Test timeout of \d+ms exceeded/.test(message)) return "test-timeout";
  if (/toBe\(\)[\s\S]*Expected: true[\s\S]*Received: false/.test(message)) return "observer-state-predicate-false";
  if (/data-state[\s\S]*peek[\s\S]*transient/.test(message)) return "learning-drawer-transition-state";
  return "assertion-failed";
}

for (const suite of Array.isArray(raw.suites) ? raw.suites : []) visit(suite);
const identities = tests.map((test) => test.identity);
if (tests.length === 0 || identities.some((identity) => identity === "::") || new Set(identities).size !== identities.length) {
  throw new Error("Playwright report contains no tests, invalid identities, or duplicate test identities");
}

const attemptRows = tests.flatMap((test) => test.attempts.map((attempt) => ({ test, attempt })));
const timeline = attemptRows
  .filter(({ attempt }) => attempt.startOffsetMs !== null)
  .flatMap(({ attempt }) => [
    { at: attempt.startOffsetMs, delta: 1 },
    { at: attempt.startOffsetMs + attempt.durationMs, delta: -1 },
  ])
  .sort((left, right) => left.at - right.at || left.delta - right.delta);
let active = 0;
let maxConcurrentTests = 0;
for (const event of timeline) {
  active += event.delta;
  maxConcurrentTests = Math.max(maxConcurrentTests, active);
}

const finalStatuses = tests.map((test) => test.status);
const retries = tests.reduce((sum, test) => sum + test.attempts.reduce((testSum, attempt) => testSum + attempt.retry, 0), 0);
const flaky = tests.filter((test) => test.status === "flaky" ||
  (test.attempts.length > 1 && test.attempts.some((attempt) => attempt.status !== "passed") && test.status === "expected")).length;
const incomplete = tests.filter((test) => test.attempts.length === 0 || test.status === "interrupted" || test.status === "timedOut").length;
const actualWorkerIndices = [...new Set(attemptRows.map(({ attempt }) => attempt.workerIndex).filter(Number.isInteger))].sort((a, b) => a - b);
const result = {
  schema: "m7m-playwright-outcomes-v1",
  normalizerRevision: NORMALIZER_REVISION,
  captureId: args.get("--id"),
  executionSourceCommitSha: args.get("--source-sha"),
  rawCapture: { sha256: digest(inputBytes), bytes: inputBytes.length, retention: "private-local-only", offlineReplayAvailable: false },
  config: {
    projectNames: (raw.config.projects ?? []).map((project) => String(project.name ?? "")),
    configuredWorkers: raw.config.workers,
    configuredRetries,
    testSeam,
  },
  stats: {
    discovered: tests.length,
    passed: finalStatuses.filter((status) => status === "expected" || status === "passed").length,
    failed: finalStatuses.filter((status) => status === "unexpected" || status === "failed" || status === "timedOut" || status === "interrupted").length,
    skipped: finalStatuses.filter((status) => status === "skipped").length,
    flaky,
    incomplete,
    retries,
    maxConcurrentTests,
    actualWorkerIndices,
    durationMs: safeInteger(Math.round(raw.stats.duration), 0),
  },
  tests: tests.sort((left, right) => left.identity.localeCompare(right.identity)),
};

writeFileSync(args.get("--output"), JSON.stringify(result, null, 2) + "\n", { mode: 0o600, flag: "wx" });
process.stdout.write(JSON.stringify({ captureId: result.captureId, rawSha256: result.rawCapture.sha256, outcomes: result.stats }) + "\n");
