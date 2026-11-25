import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const playwrightEntry = createRequire(import.meta.url).resolve("@playwright/test");
const cliPath = resolve(dirname(playwrightEntry), "cli.js");
const argumentsMap = new Map(process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  return separator < 0
    ? [argument.replace(/^--/, ""), "true"]
    : [argument.slice(2, separator), argument.slice(separator + 1)];
}));
const outputDirectory = resolve(argumentsMap.get("out-dir") ?? "/private/tmp/m7o-captures");
const attempts = Number(argumentsMap.get("attempts") ?? "3");
const selectedCondition = argumentsMap.get("condition") ?? null;
if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) throw new Error("--attempts must be between 1 and 5.");

const targetFile = "src/tests/e2e/architecture-rise-focus-range.spec.ts";
const definitions = [
  {
    id: "A",
    name: "target-solo-instrumentation-off",
    workers: 1,
    instrumentation: false,
    paths: [targetFile],
    grep: "Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
  },
  {
    id: "B",
    name: "target-solo-instrumentation-on",
    workers: 1,
    instrumentation: true,
    paths: [targetFile],
    grep: "Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
  },
  {
    id: "C",
    name: "target-plus-light-peers-w4",
    workers: 4,
    instrumentation: true,
    paths: [
      targetFile,
      "src/tests/e2e/home.spec.ts",
      "src/tests/e2e/simulator-header.spec.ts",
      "src/tests/e2e/smoke.spec.ts",
    ],
    grep: "Architecture Rise focus control stays within scene depth and preserves thin-lens extension|concept learning sections keep their responsive grids without overflow|keeps the active lesson context between the brand and desktop actions|smoke: app boots at home",
  },
  {
    id: "D",
    name: "target-plus-renderer-heavy-peers-w4",
    workers: 4,
    instrumentation: true,
    paths: [
      targetFile,
      "src/tests/e2e/macro-bellows-extension.spec.ts",
      "src/tests/e2e/macro-compound-movements.spec.ts",
      "src/tests/e2e/mirror-shift-rig-lateral.spec.ts",
    ],
    grep: "Architecture Rise focus control stays within scene depth and preserves thin-lens extension|Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions|Macro 4 teaches compound Tilt \\+ Swing \\+ Focus through the public route|Mirror Shift Camera focus follows the rig while Scene focus stays fixed",
  },
];
const definitionsToRun = selectedCondition
  ? definitions.filter((definition) => definition.id === selectedCondition)
  : definitions;
if (definitionsToRun.length === 0) throw new Error(`Unknown --condition=${selectedCondition}. Use A, B, C, or D.`);

await mkdir(outputDirectory, { recursive: true });
const runSummary = [];
for (const definition of definitionsToRun) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const captureId = `m7o-${definition.id.toLowerCase()}-r${attempt}`;
    const port = 4190 + ("ABCD".indexOf(definition.id) * 10) + attempt;
    const reportPath = resolve(outputDirectory, `${captureId}.playwright.json`);
    const outputDir = resolve(outputDirectory, `${captureId}-results`);
    const environment = { ...process.env, PLAYWRIGHT_WEB_SERVER_PORT: String(port) };
    if (definition.instrumentation) {
      environment.M7O_CAPTURE_DIAGNOSTICS = "1";
      environment.M7O_CAPTURE_ID = captureId;
      environment.M7O_POST_FAILURE_POLL = "1";
    } else {
      delete environment.M7O_CAPTURE_DIAGNOSTICS;
      delete environment.M7O_CAPTURE_ID;
      delete environment.M7O_POST_FAILURE_POLL;
    }
    const args = [
      cliPath,
      "test",
      ...definition.paths,
      `--grep=${definition.grep}`,
      `--workers=${definition.workers}`,
      "--retries=0",
      "--reporter=json",
      `--output=${outputDir}`,
    ];
    const result = spawnSync(process.execPath, args, {
      cwd: repositoryRoot,
      env: environment,
      encoding: "utf8",
      maxBuffer: 25 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    await writeFile(reportPath, result.stdout ?? "");
    const row = {
      captureId,
      condition: definition.id,
      name: definition.name,
      configuredWorkers: definition.workers,
      instrumentationEnabled: definition.instrumentation,
      exitCode: result.status ?? 1,
      reportPath,
      stderr: (result.stderr ?? "").slice(-2000),
    };
    runSummary.push(row);
    console.log(JSON.stringify(row));
  }
}

const summaryPath = resolve(outputDirectory, "m7o-run-summary.json");
await writeFile(summaryPath, `${JSON.stringify({ schemaVersion: 1, attemptsPerCondition: attempts, runs: runSummary }, null, 2)}\n`);
console.log(`M7O raw Playwright captures: ${summaryPath}`);
if (runSummary.some((run) => run.exitCode !== 0 && run.exitCode !== 1)) process.exitCode = 1;
