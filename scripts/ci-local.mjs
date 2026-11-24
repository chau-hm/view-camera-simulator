import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { access, mkdir, readFile, readdir } from "node:fs/promises";
import { constants as fsConstants, createWriteStream, existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { isDevelopmentE2ESpec, isProductionPreviewSpec } from "./e2e-spec-policy.mjs";
import {
  applyRunnerEvidenceStatus,
  determineOverallStatus,
  evaluateEnvironmentRequirements,
  sha256,
  writeJsonAtomically,
} from "./local-ci/reporting.mjs";
import {
  parseLocalCiArgs,
  compareTestFileSelection,
  parsePlaywrightJsonReport,
  parseVitestJsonReport,
  resolveOwnerSelection,
  validateSelectedTestPaths,
} from "./local-ci/selection.mjs";
import {
  currentBranch,
  currentCommit,
  findRepositoryRoot,
  listChangedPaths,
  resolveCommit,
  safeRepositoryIdentifier,
  snapshotSourceState,
} from "./local-ci/source-state.mjs";

const runnerPath = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(runnerPath), "..");
const reportRunId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}-${randomUUID().slice(0, 8)}`;
const reportRelativeDirectory = path.posix.join(".agents", "output", "ci-local", reportRunId);
const reportDirectory = path.join(packageRoot, ...reportRelativeDirectory.split("/"));
const reportRelativePath = path.posix.join(reportRelativeDirectory, "report.json");
const reportPath = path.join(packageRoot, ...reportRelativePath.split("/"));
const nodeBinDirectory = path.dirname(process.execPath);
const childPath = [nodeBinDirectory, process.env.PATH ?? ""].filter(Boolean).join(path.delimiter);
const spawnEnvironment = { ...process.env, PATH: childPath };

let options = null;
let activeChild = null;
let receivedSignal = null;
let fatalWriteError = false;
let report;

const now = () => new Date().toISOString();
const redact = (value) => String(value)
  .replaceAll(packageRoot, "<worktree>")
  .replaceAll(os.homedir(), "<home>");

function initialReport() {
  return {
    schemaVersion: 1,
    runId: reportRunId,
    status: "NOT_RUN",
    startedAt: now(),
    completedAt: null,
    durationMs: "NOT_MEASURED",
    repository: {
      identifier: "unknown-repository",
      commitSha: "NOT_MEASURED",
      branch: "NOT_MEASURED",
      worktreeRoot: "NOT_RECORDED",
    },
    execution: {
      mode: "NOT_RUN",
      requestedBase: null,
      resolvedBaseSha: null,
      scope: "NOT_RUN",
      completeForRequestedScope: false,
      repositoryCoverage: "none",
      commands: [],
      selectedTestFiles: [],
      changedFiles: [],
      owners: [],
      selectionReasons: [],
      fallback: null,
    },
    sourceState: { initial: null, final: null, stableDuringRun: "NOT_MEASURED" },
    environment: {
      os: `${os.type()} ${os.release()}`,
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      npm: "NOT_MEASURED",
      tools: { vitest: "NOT_MEASURED", playwright: "NOT_MEASURED", eslint: "NOT_MEASURED", typescript: "NOT_MEASURED", vite: "NOT_MEASURED" },
      browser: "NOT_RUN",
      rendererQualification: "NOT_RUN",
      workerSetting: "Vitest default; Playwright serial for ci:local:e2e",
    },
    preflight: { passed: false, checks: [], issues: [] },
    steps: [],
    qualifications: {
      ordinaryChromium: "NOT_RUN",
      productionPreview: "NOT_RUN",
      nativeWebGpu: "NOT_RUN",
      visualEvidence: "NOT_RUN",
    },
    artifacts: [],
    limitations: [],
    errors: [],
  };
}

async function writeReport() {
  await writeJsonAtomically(reportPath, report);
}

function setIssue(list, message) {
  if (!list.includes(message)) list.push(message);
}

function requireReadFileSync(filePath) {
  return readFileSync(filePath, "utf8");
}

function npmVersion() {
  const result = spawnSync("npm", ["--version"], { cwd: packageRoot, encoding: "utf8", env: spawnEnvironment });
  if (result.status !== 0) return "NOT_MEASURED";
  return result.stdout.trim() || "NOT_MEASURED";
}

function installedPackageVersion(root, packagePath) {
  try {
    return JSON.parse(requireReadFileSync(path.join(root, "node_modules", packagePath, "package.json"))).version ?? "NOT_MEASURED";
  } catch {
    return "NOT_MEASURED";
  }
}

function fileExists(relativePath) {
  return existsSync(path.join(packageRoot, relativePath));
}

function normalizeRepositoryPath(input) {
  const normalized = input.replaceAll("\\", "/");
  if (path.isAbsolute(input) || normalized.split("/").includes("..") || normalized.startsWith("../")) {
    throw new Error(`Test paths must be repository-relative: ${input}`);
  }
  return normalized.replace(/^\.\//, "");
}

function isVitestPath(filePath) {
  return /^src\/tests\/(unit|integration)\/.*\.test\.tsx?$/.test(filePath);
}

function repositoryRelativeReportPath(filePath) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(packageRoot, filePath);
  const relativePath = path.relative(packageRoot, absolutePath);
  return relativePath === ".." || relativePath.startsWith(`..${path.sep}`)
    ? "OUTSIDE_REPOSITORY"
    : relativePath.split(path.sep).join("/");
}

function loadOwnerManifest() {
  return JSON.parse(requireReadFileSync(path.join(packageRoot, "scripts", "local-ci", "owners.json")));
}

function loadCandidateSelection(manifest) {
  const selectedOwners = manifest.owners.filter((owner) => manifest.coreRegressionOwnerIds.includes(owner.id));
  const missingOwners = manifest.coreRegressionOwnerIds.filter((id) => !manifest.owners.some((owner) => owner.id === id));
  const tests = [...new Set(selectedOwners.flatMap((owner) => owner.tests ?? []))].sort();
  const invalid = validateSelectedTestPaths(tests, fileExists, isVitestPath).invalid;
  return { selectedOwners, tests, invalid, missingOwners };
}

function validateE2eSpecs(specs, productionPreview, nativeWebGpu) {
  const invalid = [];
  for (const input of specs) {
    let spec;
    try {
      spec = normalizeRepositoryPath(input);
    } catch {
      invalid.push(input);
      continue;
    }
    if (!spec.startsWith("src/tests/e2e/") || !spec.endsWith(".spec.ts") || !fileExists(spec)) {
      invalid.push(input);
      continue;
    }
    if (isProductionPreviewSpec(path.basename(spec)) !== productionPreview) invalid.push(input);
    if (nativeWebGpu && !/webgpu/i.test(spec)) invalid.push(input);
  }
  return { valid: invalid.length === 0, invalid };
}

function npmCommand(args) {
  return { command: "npm", args };
}

function makeVitestStep(testFiles, outputRelative, mode, workerCount) {
  const args = ["run", "test", "--", "--reporter=json", "--reporter=default", `--outputFile=${outputRelative}`];
  if (workerCount) args.push(`--maxWorkers=${workerCount}`);
  args.push(...testFiles);
  return {
    id: mode === "core" ? "core-regression-candidate" : mode === "focused" ? "focused-vitest" : mode === "affected" ? "affected-vitest" : "full-vitest",
    label: mode === "core" ? "Core Regression candidate (shadow only)" : mode === "focused" ? "Focused Vitest" : mode === "affected" ? "Affected Vitest" : "Full Unit and Integration suite",
    ...npmCommand(args),
    mode,
    testFilesSelected: testFiles.length > 0 ? testFiles : ["Vitest configured discovery"],
    runner: "vitest",
    reportFile: path.join(packageRoot, ...outputRelative.split("/")),
    reportRelativeFile: outputRelative,
  };
}

function makeE2eStep(spec, index, settings) {
  const outputRelative = path.posix.join(reportRelativeDirectory, `playwright-${String(index + 1).padStart(2, "0")}.json`);
  const artifactRelativeDirectory = path.posix.join(reportRelativeDirectory, `playwright-artifacts-${String(index + 1).padStart(2, "0")}`);
  const args = ["run", "test:e2e", "--", "--workers=1", "--reporter=list,json", `--output=${artifactRelativeDirectory}`];
  if (settings.productionPreview) args.push("--config=playwright.production.config.ts", "--project=chromium-production-preview");
  if (settings.nativeWebGpu) args.push("--project=chrome-native-webgpu");
  args.push(spec);
  return {
    id: `playwright-${String(index + 1).padStart(2, "0")}`,
    label: `Playwright ${settings.nativeWebGpu ? "native WebGPU" : settings.productionPreview ? "production preview" : "Chromium"}: ${path.basename(spec)}`,
    ...npmCommand(args),
    mode: settings.nativeWebGpu ? "native-webgpu" : settings.productionPreview ? "production-preview" : "ordinary-chromium",
    testFilesSelected: [spec],
    runner: "playwright",
    reportFile: path.join(packageRoot, ...outputRelative.split("/")),
    reportRelativeFile: outputRelative,
    artifactDirectory: path.join(packageRoot, ...artifactRelativeDirectory.split("/")),
    artifactRelativeDirectory,
    environment: {
      PLAYWRIGHT_JSON_OUTPUT_FILE: path.join(packageRoot, ...outputRelative.split("/")),
      ...(settings.nativeWebGpu ? {
        ...(spec.includes("architecture-rise-webgpu") ? { OBSERVER_NATIVE_WEBGPU_REQUIRED: "1" } : {}),
        ...(spec.includes("ground-glass-webgpu") ? { GROUND_GLASS_NATIVE_WEBGPU_REQUIRED: "1" } : {}),
        ...(spec.endsWith("ground-glass-webgpu-failure-host.spec.ts") ? { GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION: "1" } : {}),
      } : {}),
    },
  };
}

async function runStep(step) {
  await mkdir(reportDirectory, { recursive: true });
  return new Promise((resolve) => {
    const startedAt = now();
    const start = Date.now();
    process.stdout.write(`\n==> ${step.label}\n`);
    const childEnvironment = { ...spawnEnvironment, ...(step.environment ?? {}) };
    const logRelativeFile = path.posix.join(
      reportRelativeDirectory,
      `step-${String(report.steps.length + 1).padStart(2, "0")}-${step.id}.log`,
    );
    const logFile = path.join(packageRoot, ...logRelativeFile.split("/"));
    const logStream = createWriteStream(logFile, { flags: "wx", mode: 0o600 });
    let logWriteError = null;
    logStream.once("error", (error) => { logWriteError = error; });
    const captureOutput = (source, destination) => {
      source.on("data", (chunk) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (!logWriteError) logStream.write(bytes);
        if (options.verbose) destination.write(bytes);
      });
    };
    const child = spawn(step.command, step.args, {
      cwd: packageRoot,
      env: childEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    captureOutput(child.stdout, process.stdout);
    captureOutput(child.stderr, process.stderr);
    activeChild = child;
    let spawnError = null;
    child.once("error", (error) => { spawnError = error; });
    child.once("close", async (code, signal) => {
      activeChild = null;
      logStream.end();
      await finished(logStream).catch((error) => { logWriteError ??= error; });
      const completedAt = now();
      const stepResult = {
        id: step.id,
        label: step.label,
        command: step.command,
        args: step.args,
        mode: step.mode,
        startedAt,
        completedAt,
        durationMs: Date.now() - start,
        exitCode: code ?? (signal ? 128 : 1),
        signal: signal ?? null,
        testFilesSelected: step.testFilesSelected,
        environment: Object.fromEntries(Object.entries(step.environment ?? {}).map(([key, value]) => [
          key,
          key === "PLAYWRIGHT_JSON_OUTPUT_FILE" ? step.reportRelativeFile : value,
        ])),
        counts: "NOT_MEASURED",
        artifacts: [],
        status: code === 0 && !spawnError ? "PASS" : receivedSignal ? "INCOMPLETE" : "FAIL",
        error: spawnError ? redact(spawnError.message) : null,
        runnerReportError: null,
        logFile: logRelativeFile,
        logWriteError: logWriteError ? redact(logWriteError.message) : null,
      };

      if (step.reportFile) {
        try {
          const raw = await readFile(step.reportFile, "utf8");
          const parsed = JSON.parse(raw);
          stepResult.counts = step.runner === "vitest" ? parseVitestJsonReport(parsed) : parsePlaywrightJsonReport(parsed);
          stepResult.status = applyRunnerEvidenceStatus(stepResult.status, step.runner, stepResult.counts);
          if (step.runner === "vitest" || step.runner === "playwright") {
            if (!(step.runner === "vitest" && step.testFilesSelected[0] === "Vitest configured discovery")) {
              const selectionEvidence = compareTestFileSelection(
                step.testFilesSelected,
                stepResult.counts.files,
                packageRoot,
                { matchBasenames: step.runner === "playwright" },
              );
              if (!selectionEvidence.matches) {
                stepResult.status = stepResult.status === "FAIL" ? "FAIL" : "INCOMPLETE";
                stepResult.runnerReportError = `${step.runner} discovered files do not match the selected file set (missing: ${selectionEvidence.missing.join(", ") || "none"}; extra: ${selectionEvidence.extra.join(", ") || "none"}).`;
                setIssue(report.limitations, `${step.runner} discovery differed from the selected test files for ${step.id}.`);
              }
            }
            if (step.runner === "vitest") stepResult.counts.files = stepResult.counts.files.map(repositoryRelativeReportPath);
          }
          report.artifacts.push({ path: step.reportRelativeFile, sha256: sha256(raw), kind: `${step.runner}-json` });
          stepResult.artifacts.push(step.reportRelativeFile);
          if (step.runner === "playwright" && step.artifactRelativeDirectory) stepResult.artifacts.push(step.artifactRelativeDirectory);
          if (step.mode === "native-webgpu" && stepResult.counts.skipped > 0 && stepResult.status !== "FAIL") {
            stepResult.status = "INCOMPLETE";
            stepResult.runnerReportError = "Native WebGPU qualification contains skipped tests; a skip is not a hardware pass.";
            setIssue(report.limitations, "Native WebGPU qualification reported skipped cases and remains incomplete.");
          }
        } catch (error) {
          stepResult.status = stepResult.status === "FAIL" ? "FAIL" : "INCOMPLETE";
          stepResult.runnerReportError = redact(error.message);
          setIssue(report.limitations, `${step.runner} runner counts are unavailable for ${step.id}; run is incomplete.`);
        }
      }
      if (logWriteError) {
        stepResult.status = stepResult.status === "FAIL" ? "FAIL" : "INCOMPLETE";
        setIssue(report.limitations, `Step log could not be written for ${step.id}: ${redact(logWriteError.message)}`);
      } else {
        const logBytes = await readFile(logFile);
        report.artifacts.push({ path: logRelativeFile, sha256: sha256(logBytes), kind: "step-log" });
        stepResult.artifacts.push(logRelativeFile);
      }
      report.steps.push(stepResult);
      const commandString = [step.command, ...step.args].join(" ");
      report.execution.commands.push({
        step: step.id,
        invocation: commandString,
        environmentKeys: Object.keys(step.environment ?? {}).sort(),
      });
      await writeReport().catch((error) => {
        fatalWriteError = true;
        process.stderr.write(`Unable to update Local CI report: ${redact(error.message)}\n`);
      });
      const conciseResult = `${stepResult.status}: ${step.label} (${stepResult.durationMs} ms)`;
      const marker = stepResult.status === "PASS" ? "✓" : stepResult.status === "FAIL" ? "✗" : "!";
      process.stdout.write(`${marker} ${conciseResult}${stepResult.status === "PASS" ? "" : `; log ${logRelativeFile}`}\n`);
      resolve(stepResult);
    });
  });
}

function executableAvailable(name) {
  const lookup = spawnSync(process.platform === "win32" ? "where.exe" : "which", [name], {
    encoding: "utf8",
    env: spawnEnvironment,
  });
  return lookup.status === 0 ? lookup.stdout.trim().split(/\r?\n/)[0] : null;
}

async function browserPreflight(root, settings) {
  const result = {
    packageAvailable: existsSync(path.join(root, "node_modules", "@playwright", "test", "package.json")),
    browserAvailable: false,
    systemChromeAvailable: false,
  };
  if (!settings.requested) return result;
  try {
    const { chromium } = await import("@playwright/test");
    if (settings.nativeWebGpu) {
      const systemChrome = process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : executableAvailable(process.platform === "win32" ? "chrome.exe" : "google-chrome");
      result.systemChromeAvailable = Boolean(systemChrome && existsSync(systemChrome));
      report.environment.browser = "Google Chrome channel; headed native-WebGPU project";
      report.environment.rendererQualification = "native-webgpu requested; adapter/backend must be asserted by the selected test";
      report.qualifications.nativeWebGpu = "INCOMPLETE";
      return result;
    }
    const browserPath = chromium.executablePath();
    await access(browserPath, fsConstants.X_OK);
    result.browserAvailable = true;
    report.environment.browser = settings.productionPreview ? "Playwright Chromium production-preview project" : "Playwright Chromium development project(s)";
    report.environment.rendererQualification = settings.productionPreview ? "production-preview WebGL isolation" : "ordinary Chromium/WebGL";
    if (settings.productionPreview) report.qualifications.productionPreview = "INCOMPLETE";
    else report.qualifications.ordinaryChromium = "INCOMPLETE";
  } catch (error) {
    result.browserError = redact(error.message);
  }
  return result;
}

async function preflight(root, settings) {
  const npm = npmVersion();
  report.environment.npm = npm;
  const vitestAvailable = existsSync(path.join(root, "node_modules", ".bin", process.platform === "win32" ? "vitest.cmd" : "vitest"));
  report.environment.tools.vitest = installedPackageVersion(root, "vitest");
  report.environment.tools.playwright = installedPackageVersion(root, "@playwright/test");
  report.environment.tools.eslint = installedPackageVersion(root, "eslint");
  report.environment.tools.typescript = installedPackageVersion(root, "typescript");
  report.environment.tools.vite = installedPackageVersion(root, "vite");
  const browser = await browserPreflight(root, settings);
  const evaluated = evaluateEnvironmentRequirements({
    nodeVersion: process.version,
    npmVersion: npm,
    npmAvailable: npm !== "NOT_MEASURED",
    dependenciesAvailable: vitestAvailable,
    playwrightRequested: settings.requested,
    playwrightPackageAvailable: browser.packageAvailable,
    browserAvailable: browser.browserAvailable,
    nativeWebGpuRequested: settings.nativeWebGpu,
    systemChromeAvailable: browser.systemChromeAvailable,
  });
  const checks = [...evaluated.checks];
  const issues = [...evaluated.issues];
  if (settings.fullLocalCi) {
    for (const executable of ["eslint", "tsc", "vite"]) {
      const executableName = process.platform === "win32" ? `${executable}.cmd` : executable;
      const available = existsSync(path.join(root, "node_modules", ".bin", executableName));
      checks.push({ id: `${executable}-executable`, status: available ? "PASS" : "FAIL" });
      if (!available) issues.push(`Required local executable is unavailable: ${executable}.`);
    }
  }
  if (browser.browserError) issues.push(`Playwright environment unavailable: ${browser.browserError}. Install dependencies/browser through the approved development workflow; this runner will not download them.`);
  const hasBase = settings.baseSha ? "PASS" : settings.mode === "affected" ? "FAIL" : "NOT_APPLICABLE";
  checks.push({ id: "git-and-base", status: hasBase });
  if (hasBase === "FAIL") issues.push(`Comparison base could not be resolved: ${settings.requestedBase ?? "NOT_SPECIFIED"}.`);

  report.preflight = { passed: issues.length === 0, checks, issues };
  return issues;
}

function getDevelopmentE2ESpecs(root) {
  const e2eDirectory = path.join(root, "src", "tests", "e2e");
  return readdir(e2eDirectory, { withFileTypes: true }).then((entries) => entries
    .filter((entry) => entry.isFile() && isDevelopmentE2ESpec(entry.name))
    .map((entry) => `src/tests/e2e/${entry.name}`)
    .sort());
}

function printUsage() {
  process.stdout.write([
    "Local CI commands:",
    "  npm run ci:local",
    "  npm run ci:local:e2e",
    "  npm run ci:local:focused -- --owner canonical-optics",
    "  npm run ci:local:focused -- --tests src/tests/unit/thinLensModel.test.ts",
    "  npm run ci:local:affected -- --base origin/main [--with-e2e]",
    "  npm run ci:local:core",
    "  npm run ci:local:focused -- --e2e-spec src/tests/e2e/smoke.spec.ts",
    "  npm run ci:local:focused -- --e2e-spec src/tests/e2e/architecture-rise-webgpu-production.spec.ts --production-preview",
    "  npm run ci:local:focused -- --e2e-spec src/tests/e2e/ground-glass-webgpu-failure-host.spec.ts --native-webgpu",
    "",
    "Options: --mode full|focused|affected|core, --base REF, --tests PATH[,PATH], --owner ID,",
    "         --e2e-spec PATH, --with-e2e, --production-preview, --native-webgpu, --workers N, --verbose",
  ].join("\n") + "\n");
}

async function addArtifactDigest(relativePath, kind) {
  const absolutePath = path.join(packageRoot, ...relativePath.split("/"));
  try {
    const bytes = await readFile(absolutePath);
    report.artifacts.push({ path: relativePath, sha256: sha256(bytes), kind });
  } catch {
    // Playwright output directories may be absent when a run fails before browser launch.
  }
}

async function main() {
  report = initialReport();
  const startMs = Date.now();
  let root;
  let initialSnapshot;
  let failedStep = false;
  let incomplete = false;

  try {
    options = parseLocalCiArgs(process.argv.slice(2));
  } catch (error) {
    report.errors.push(redact(error.message));
    report.status = "NOT_RUN";
    report.completedAt = now();
    report.durationMs = Date.now() - startMs;
    await writeReport();
    process.stderr.write(`Local CI options invalid: ${redact(error.message)}\nReport: ${reportRelativePath}\n`);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    printUsage();
    return;
  }

  try {
    root = findRepositoryRoot(packageRoot);
    report.repository.worktreeRoot = "NOT_RECORDED";
    report.repository.commitSha = currentCommit(root);
    report.repository.branch = currentBranch(root);
    const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    report.repository.identifier = safeRepositoryIdentifier(root, packageJson.name);
    report.execution.mode = options.mode;
    report.execution.scope = options.mode === "full" ? "full-local-ci" : options.mode === "core" ? "core-regression-shadow" : options.mode;
    report.execution.repositoryCoverage = options.mode === "full" ? "full-local-ci-core" : "partial";
    report.status = "INCOMPLETE";
    report.environment.workerSetting = options.workers ? `Vitest maxWorkers=${options.workers}; Playwright workers=1` : "Vitest default; Playwright workers=1";
    initialSnapshot = await snapshotSourceState(root);
    report.sourceState.initial = initialSnapshot;
    const manifest = loadOwnerManifest();
    let selectedTests = [];
    let selectedE2ESpecs = options.e2eSpecs.map(normalizeRepositoryPath);
    let selection = null;
    let fullVitest = options.mode === "full";
    let fullLocalCi = options.mode === "full";

    if (options.mode === "affected") {
      report.execution.requestedBase = options.base;
      try {
        report.execution.resolvedBaseSha = resolveCommit(root, options.base);
      } catch (error) {
        report.errors.push(`Invalid affected-test base: ${redact(error.message)}`);
        report.status = "NOT_RUN";
        incomplete = true;
      }
      if (!incomplete) {
        const changed = listChangedPaths(root, report.execution.resolvedBaseSha);
        report.execution.changedFiles = changed;
        selection = resolveOwnerSelection(changed, manifest.owners, fileExists);
        selectedTests = selection.tests;
        selectedE2ESpecs = [...new Set([...selectedE2ESpecs, ...selection.e2eSpecs])];
        fullVitest ||= selection.fullVitest;
        fullLocalCi ||= selection.fullLocalCi;
        if (selection.incomplete) {
          incomplete = true;
          for (const item of selection.incompleteReasons) {
            setIssue(report.limitations, `Affected coverage is incomplete for ${item.path} (${item.owner}): ${item.reason}`);
          }
        }
        if (selection.requiresE2E && !options.includeE2E && options.e2eSpecs.length === 0) {
          incomplete = true;
          setIssue(report.limitations, "Affected ownership includes a browser contract; rerun with --with-e2e or the explicit qualification command.");
        }
        if (selection.allDevelopmentE2E && options.includeE2E) selectedE2ESpecs = await getDevelopmentE2ESpecs(root);
        if (selection.nativeGpuRequired && !options.nativeWebGpu) {
          incomplete = true;
          setIssue(report.limitations, "Affected WebGPU code requires explicit native-WebGPU qualification; ordinary Chromium is not a substitute.");
        }
        if (changed.length === 0) {
          report.status = "NOT_RUN";
          incomplete = true;
          setIssue(report.limitations, "No changed files are present relative to the requested base; no affected-test PASS was issued.");
        }
        report.execution.owners = selection.ownerIds;
        report.execution.selectionReasons = selection.reasons;
        if (selection.unknownPaths.length > 0 || selection.staleTests.length > 0 || selection.staleSpecs.length > 0) {
          report.execution.fallback = {
            kind: "full-vitest",
            reason: "Unknown or stale ownership selected the broad Vitest fallback; the result remains INCOMPLETE until ownership is repaired.",
            unknownPaths: selection.unknownPaths,
            staleTests: selection.staleTests,
            staleSpecs: selection.staleSpecs,
          };
        }
      }
    } else if (options.mode === "focused") {
      const knownOwners = new Map(manifest.owners.map((owner) => [owner.id, owner]));
      const unknownOwners = options.owners.filter((ownerId) => !knownOwners.has(ownerId));
      if (unknownOwners.length > 0) throw new Error(`Unknown test owner(s): ${unknownOwners.join(", ")}`);
      const focusedOwners = options.owners.map((ownerId) => knownOwners.get(ownerId));
      selectedTests = focusedOwners.flatMap((owner) => owner.tests ?? []);
      selectedE2ESpecs = [...new Set([...selectedE2ESpecs, ...focusedOwners.flatMap((owner) => owner.e2eSpecs ?? [])])];
      selectedTests.push(...options.tests.map(normalizeRepositoryPath));
      report.execution.owners = options.owners;
      report.execution.selectionReasons = focusedOwners.map((owner) => ({ owner: owner.id, reason: owner.reason }));
      report.execution.recommendedE2EFiles = selectedE2ESpecs;
      for (const owner of focusedOwners) {
        if (!owner.incompleteReason) continue;
        incomplete = true;
        setIssue(report.limitations, `Focused owner ${owner.id} has incomplete coverage: ${owner.incompleteReason}`);
      }
      if (focusedOwners.some((owner) => owner.nativeGpuRequired) && !options.nativeWebGpu) {
        incomplete = true;
        setIssue(report.limitations, "Focused owner includes native-WebGPU qualification; ordinary Chromium cannot satisfy that qualification.");
      }
    } else if (options.mode === "core") {
      const core = loadCandidateSelection(manifest);
      selectedTests = core.tests;
      report.execution.owners = core.selectedOwners.map((owner) => owner.id);
      report.execution.selectionReasons = core.selectedOwners.map((owner) => ({ owner: owner.id, reason: owner.reason }));
      if (core.missingOwners.length > 0 || core.invalid.length > 0) {
        fullVitest = true;
        incomplete = true;
        report.execution.fallback = { kind: "full-vitest", reason: "Candidate manifest has missing owners or test references.", invalid: core.invalid, missingOwners: core.missingOwners };
        setIssue(report.limitations, "Core candidate manifest validation failed; full Vitest is selected and candidate evidence is incomplete.");
      }
      selectedTests.push(...options.tests.map(normalizeRepositoryPath));
    } else {
      selectedTests = options.tests.map(normalizeRepositoryPath);
    }

    if (options.mode === "affected") selectedTests.push(...options.tests.map(normalizeRepositoryPath));
    selectedTests = [...new Set(selectedTests)].sort();
    const invalidTests = validateSelectedTestPaths(selectedTests, fileExists, isVitestPath).invalid;
    if (invalidTests.length > 0) {
      report.errors.push(`Selected Vitest path(s) are missing or outside the configured test roots: ${invalidTests.join(", ")}`);
      if (options.mode === "affected") {
        fullVitest = true;
        incomplete = true;
        report.execution.fallback = { kind: "full-vitest", reason: "Invalid or stale mapped test path; full Vitest fallback selected.", invalidTests };
        selectedTests = [];
      } else {
        report.status = "NOT_RUN";
        incomplete = true;
      }
    }

    if (options.includeE2E && options.mode === "full" && selectedE2ESpecs.length === 0) {
      selectedE2ESpecs = await getDevelopmentE2ESpecs(root);
    }
    if (options.includeE2E && options.mode === "affected" && selection?.allDevelopmentE2E) {
      selectedE2ESpecs = await getDevelopmentE2ESpecs(root);
    }

    const e2ESpecsToRun = options.includeE2E ? selectedE2ESpecs : options.e2eSpecs.map(normalizeRepositoryPath);
    const e2eValidation = validateE2eSpecs(e2ESpecsToRun, options.productionPreview, options.nativeWebGpu);
    if (!e2eValidation.valid) {
      report.errors.push(`Invalid Playwright target(s) or qualification mode: ${e2eValidation.invalid.join(", ")}`);
      report.status = "NOT_RUN";
      incomplete = true;
    }
    if (options.mode === "focused" && selectedTests.length === 0 && e2ESpecsToRun.length === 0) {
      report.errors.push("No focused test files were selected.");
      report.status = "NOT_RUN";
      incomplete = true;
    }
    if (options.mode === "affected" && selectedTests.length === 0 && !fullVitest && !fullLocalCi) {
      report.status = "NOT_RUN";
      incomplete = true;
      setIssue(report.limitations, "Affected selection produced no test owner; no empty-set PASS was issued.");
    }

    report.execution.selectedTestFiles = fullVitest || fullLocalCi ? ["Vitest configured discovery"] : selectedTests;
    report.execution.selectedE2EFiles = selectedE2ESpecs;
    report.execution.recommendedE2EFiles ??= options.mode === "affected" ? selectedE2ESpecs : [];
    report.execution.e2eRunRequested = e2ESpecsToRun.length > 0;
    report.execution.e2eRunFiles = e2ESpecsToRun;

    const specializedBrowser = options.productionPreview || options.nativeWebGpu;
    if (specializedBrowser && selectedE2ESpecs.length !== 1) {
      report.errors.push("Specialized browser qualification accepts exactly one explicit Playwright spec.");
      report.status = "NOT_RUN";
      incomplete = true;
    }

    if (options.mode === "affected") {
      report.execution.repositoryCoverage = fullLocalCi ? "full-local-ci" : fullVitest ? "full-vitest" : "selected-owner-tests";
      if (selection?.requiresE2E && !options.includeE2E && options.e2eSpecs.length === 0 && !options.productionPreview && !options.nativeWebGpu) {
        incomplete = true;
        setIssue(report.limitations, "Affected contract ownership includes browser validation that was not requested.");
      }
    }
    if (options.mode === "core") report.execution.repositoryCoverage = "candidate-vitest-only; browser, native GPU, visual and historical qualification remain separate";

    const preflightSettings = {
      mode: options.mode,
      baseSha: report.execution.resolvedBaseSha,
      requestedBase: report.execution.requestedBase,
      requested: e2ESpecsToRun.length > 0,
      productionPreview: options.productionPreview,
      nativeWebGpu: options.nativeWebGpu,
      fullLocalCi,
    };
    const preflightIssues = await preflight(root, preflightSettings);
    if (preflightIssues.length > 0) {
      if (report.status !== "NOT_RUN") report.status = "INCOMPLETE";
      incomplete = true;
    }

    if (report.status !== "NOT_RUN" && preflightIssues.length === 0) {
      const steps = [];
      if (fullLocalCi) {
        steps.push(
          { id: "css-structure", label: "CSS structure check", ...npmCommand(["run", "check:css"]), mode: "full", testFilesSelected: [] },
          { id: "lint", label: "ESLint", ...npmCommand(["run", "lint"]), mode: "full", testFilesSelected: [] },
          { id: "typecheck", label: "TypeScript type check", ...npmCommand(["run", "typecheck"]), mode: "full", testFilesSelected: [] },
        );
      }

      if (fullVitest || fullLocalCi || selectedTests.length > 0) {
        const testFiles = fullVitest || fullLocalCi ? [] : selectedTests;
        const reportName = path.posix.join(reportRelativeDirectory, "vitest.json");
        steps.push(makeVitestStep(testFiles, reportName, fullVitest || fullLocalCi ? "full" : options.mode, options.workers));
      }

      if (fullLocalCi) steps.push({ id: "application-build", label: "Production application build", ...npmCommand(["run", "build"]), mode: "full", testFilesSelected: [] });

      if (e2ESpecsToRun.length > 0) {
        e2ESpecsToRun.forEach((spec, index) => steps.push(makeE2eStep(spec, index, options)));
      }

      if (steps.length === 0) {
        report.status = "NOT_RUN";
        setIssue(report.limitations, "No validation steps were selected.");
      } else {
        for (const step of steps) {
          if (receivedSignal) {
            report.limitations.push(`Execution interrupted by ${receivedSignal}; remaining steps were not run.`);
            incomplete = true;
            break;
          }
          const result = await runStep(step);
          if (result.status === "FAIL") {
            failedStep = true;
            break;
          }
          if (result.status === "INCOMPLETE") incomplete = true;
        }
      }
    }

    if (options.productionPreview && report.steps.some((step) => step.status === "PASS")) report.qualifications.productionPreview = "PASS";
    else if (options.nativeWebGpu && report.steps.some((step) => step.status === "PASS")) report.qualifications.nativeWebGpu = "PASS";
    else if (report.steps.some((step) => step.runner === "playwright" && step.mode === "ordinary-chromium" && step.status === "PASS")) report.qualifications.ordinaryChromium = "PASS";

    report.sourceState.final = await snapshotSourceState(root);
    const endingCommit = currentCommit(root);
    report.sourceState.stableDuringRun = report.sourceState.initial.fingerprint === report.sourceState.final.fingerprint && report.repository.commitSha === endingCommit;
    if (report.sourceState.stableDuringRun === false) {
      incomplete = true;
      setIssue(report.limitations, "Git commit or source fingerprint changed during validation; the result cannot be attributed to the initial source state.");
    }

    for (const step of report.steps) {
      for (const artifactPath of step.artifacts ?? []) {
        if (artifactPath.endsWith(".json") && !report.artifacts.some((artifact) => artifact.path === artifactPath)) {
          await addArtifactDigest(artifactPath, "runner-report");
        }
      }
    }
    if (receivedSignal) {
      incomplete = true;
      setIssue(report.limitations, `Execution was interrupted by ${receivedSignal}.`);
    }
    if (report.status !== "NOT_RUN" || report.steps.length > 0) {
      report.status = determineOverallStatus({
        sourceStable: report.sourceState.stableDuringRun,
        failedStep,
        steps: report.steps,
        incomplete: incomplete || report.limitations.length > 0,
        preflightIssues: report.preflight.issues,
        interrupted: Boolean(receivedSignal),
      });
    }
    report.execution.completeForRequestedScope = report.status === "PASS";
  } catch (error) {
    report.errors.push(redact(error?.stack ?? error?.message ?? error));
    report.status = report.steps.some((step) => step.status === "FAIL") ? "FAIL" : "INCOMPLETE";
    try {
      if (root) {
        report.sourceState.final = await snapshotSourceState(root);
        report.sourceState.stableDuringRun = report.sourceState.initial?.fingerprint === report.sourceState.final.fingerprint;
      }
    } catch {
      report.sourceState.stableDuringRun = "NOT_MEASURED";
    }
  }

  report.completedAt = now();
  report.durationMs = Date.now() - startMs;
  if (report.environment.tools.vitest === "NOT_MEASURED" && root) {
    report.environment.tools.vitest = installedPackageVersion(root, "vitest");
  }
  try {
    await writeReport();
  } catch (error) {
    fatalWriteError = true;
    process.stderr.write(`Unable to write Local CI report: ${redact(error.message)}\n`);
  }

  const summary = `${report.status}: ${report.execution.scope} (${report.steps.length} step(s)); report ${reportRelativePath}`;
  process.stdout.write(`\n${summary}\n`);
  if (report.errors.length > 0 || report.preflight.issues.length > 0) {
    for (const issue of [...report.errors, ...report.preflight.issues]) process.stderr.write(`- ${redact(issue)}\n`);
  }
  process.exitCode = fatalWriteError ? 1 : report.status === "PASS" ? 0 : report.status === "FAIL" ? 1 : 2;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    receivedSignal = signal;
    if (activeChild && !activeChild.killed) activeChild.kill(signal);
  });
}

await main();
