import { execFileSync, spawnSync } from "node:child_process";
import { access, chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  matchesOwnerPath,
  compareTestFileSelection,
  nativeWebGpuAssertionForSpec,
  parseLocalCiArgs,
  parsePlaywrightJsonReport,
  parseVitestJsonReport,
  resolveOwnerSelection,
  validateSelectedTestPaths,
} from "../../../scripts/local-ci/selection.mjs";
import {
  aggregateLocalCiEvidence,
  applyRunnerEvidenceStatus,
  determineOverallStatus,
  evaluateEnvironmentRequirements,
  writeJsonAtomically,
} from "../../../scripts/local-ci/reporting.mjs";
import { listChangedPaths, resolveCommit, snapshotSourceState } from "../../../scripts/local-ci/source-state.mjs";

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vcs-local-ci-contracts-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeFixtureFile(root: string, relativePath: string, contents: string, executable = false) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
  if (executable) await chmod(target, 0o755);
}

async function makeLocalCiRunnerFixture() {
  const root = await makeTemporaryDirectory();
  const repositoryRoot = process.cwd();
  const sourceFiles = [
    "scripts/ci-local.mjs",
    "scripts/e2e-spec-policy.mjs",
    "scripts/local-ci/owners.json",
    "scripts/local-ci/reporting.mjs",
    "scripts/local-ci/selection.mjs",
    "scripts/local-ci/source-state.mjs",
    "playwright.config.ts",
    "playwright.production.config.ts",
  ];
  for (const relativePath of sourceFiles) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(repositoryRoot, relativePath), target);
  }

  const manifest: { owners: { id: string; tests?: string[]; e2eSpecs?: string[] }[] } =
    JSON.parse(await readFile(path.join(root, "scripts/local-ci/owners.json"), "utf8"));
  const opticsOwner = manifest.owners.find((owner) => owner.id === "canonical-optics");
  if (!opticsOwner) throw new Error("Local CI fixture has no canonical-optics owner");
  for (const testFile of opticsOwner.tests ?? []) await writeFixtureFile(root, testFile, "export {}\n");
  for (const specFile of [
    ...(opticsOwner.e2eSpecs ?? []),
    "src/tests/e2e/smoke.spec.ts",
    "src/tests/e2e/architecture-rise-webgpu-production.spec.ts",
    "src/tests/unit/focused.test.ts",
  ]) {
    await writeFixtureFile(root, specFile, "// controlled Local CI execution fixture\n");
  }

  await writeFixtureFile(root, ".gitignore", "node_modules/\n.agents/output/ci-local/\n");
  await writeFixtureFile(root, "package.json", JSON.stringify({
    name: "local-ci-execution-fixture",
    private: true,
    type: "module",
    scripts: {
      test: "node ./fake-vitest.mjs",
      "test:e2e": "node ./fake-playwright.mjs",
    },
  }, null, 2));
  await writeFixtureFile(root, "fake-vitest.mjs", `
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const output = process.argv.find((argument) => argument.startsWith("--outputFile="))?.slice("--outputFile=".length);
const files = process.argv.slice(2).filter((argument) => /\\.test\\.tsx?$/.test(argument));
if (!output || files.length === 0) process.exit(2);
const testResults = files.map((file) => ({ name: path.resolve(process.cwd(), file) }));
const count = testResults.length;
const destination = path.resolve(process.cwd(), output);
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify({
  numTotalTestSuites: count,
  numPassedTestSuites: count,
  numFailedTestSuites: 0,
  numPendingTestSuites: 0,
  numTotalTests: count,
  numPassedTests: count,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  success: true,
  testResults,
}));
`);
  await writeFixtureFile(root, "fake-playwright.mjs", `
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const args = process.argv.slice(2);
const selected = [...args].reverse().find((argument) => argument.startsWith("src/tests/e2e/") && argument.endsWith(".spec.ts"));
const output = process.env.PLAYWRIGHT_JSON_OUTPUT_FILE;
if (!selected || !output) process.exit(2);
const failedTarget = process.env.FAKE_PLAYWRIGHT_FAIL_SPEC;
const result = failedTarget && (failedTarget === selected || failedTarget === path.basename(selected))
  ? "fail"
  : process.env.FAKE_PLAYWRIGHT_STATUS ?? "pass";
const configArgument = args.find((argument) => argument.startsWith("--config="))?.slice("--config=".length) ?? "playwright.config.ts";
const projectArgument = args.find((argument) => argument.startsWith("--project="))?.slice("--project=".length) ?? "chromium";
const projectName = process.env.FAKE_PLAYWRIGHT_REPORT_PROJECT ?? projectArgument;
const configFile = process.env.FAKE_PLAYWRIGHT_REPORT_CONFIG ?? configArgument;
const reportedSpec = process.env.FAKE_PLAYWRIGHT_REPORT_SPEC ?? selected;
const outcome = result === "fail" ? "unexpected" : result === "skip" ? "skipped" : "expected";
const destination = path.resolve(output);
await mkdir(path.dirname(destination), { recursive: true });
if (process.env.FAKE_PLAYWRIGHT_OMIT_REPORT !== "1") {
  await writeFile(destination, JSON.stringify({
    config: {
      configFile: path.resolve(process.cwd(), configFile),
      rootDir: path.resolve(process.cwd(), "src/tests/e2e"),
      projects: [{ name: projectName }],
    },
    suites: [{
      file: path.basename(reportedSpec),
      specs: [{
        file: path.basename(reportedSpec),
        tests: [{ projectName, results: [{ status: outcome }] }],
      }],
    }],
    stats: {
      expected: result === "pass" ? 1 : 0,
      skipped: result === "skip" ? 1 : 0,
      unexpected: result === "fail" ? 1 : 0,
      flaky: result === "flaky" ? 1 : 0,
      duration: 5,
    },
  }));
}
if (result === "fail") process.exitCode = 1;
`);

  await writeFixtureFile(root, "node_modules/.bin/vitest", "#!/bin/sh\nexit 0\n", true);
  await writeFixtureFile(root, "node_modules/vitest/package.json", JSON.stringify({ name: "vitest", version: "3.2.7" }));
  await writeFixtureFile(root, "node_modules/@playwright/test/package.json", JSON.stringify({
    name: "@playwright/test",
    version: "1.61.1",
    type: "module",
    exports: "./index.js",
  }));
  await writeFixtureFile(root, "node_modules/@playwright/test/index.js", `
import { fileURLToPath } from "node:url";
export const chromium = { executablePath: () => fileURLToPath(new URL("./fake-chromium", import.meta.url)) };
`);
  await writeFixtureFile(root, "node_modules/@playwright/test/fake-chromium", "#!/bin/sh\nexit 0\n", true);

  const git = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
  git(["init", "--quiet"]);
  git(["config", "user.email", "local-ci@example.invalid"]);
  git(["config", "user.name", "Local CI execution test"]);
  git(["add", "-A"]);
  git(["commit", "--quiet", "-m", "fixture base"]);
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  await writeFixtureFile(root, "src/core/optics/newModel.ts", "export const changed = true;\n");
  git(["add", "src/core/optics/newModel.ts"]);
  git(["commit", "--quiet", "-m", "change optics"]);
  return { root, base };
}

async function executeLocalCi(fixture: { root: string; base: string }, args: string[], environment: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [path.join(fixture.root, "scripts/ci-local.mjs"), ...args], {
    cwd: fixture.root,
    env: { ...process.env, ...environment },
    encoding: "utf8",
    timeout: 30_000,
  });
  if (result.error) throw result.error;
  const reportMatch = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.match(/report (\.agents\/output\/ci-local\/[^\\s]+\/report\.json)/);
  if (!reportMatch) throw new Error(`Runner did not print its report path. stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  const report = JSON.parse(await readFile(path.join(fixture.root, reportMatch[1]), "utf8"));
  return { exitCode: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", report };
}

function makePlaywrightStep(options: {
  file: string;
  qualification?: "ordinaryChromium" | "productionPreview" | "nativeWebGpu";
  status?: "PASS" | "FAIL" | "INCOMPLETE";
  evidenceValid?: boolean;
  config?: string;
  project?: string;
  passed?: number;
  failed?: number;
  skipped?: number;
  flaky?: number;
}) {
  const qualification = options.qualification ?? "ordinaryChromium";
  const contracts = {
    ordinaryChromium: { mode: "ordinary-chromium", config: "playwright.config.ts", project: "chromium" },
    productionPreview: { mode: "production-preview", config: "playwright.production.config.ts", project: "chromium-production-preview" },
    nativeWebGpu: { mode: "native-webgpu", config: "playwright.config.ts", project: "chrome-native-webgpu" },
  } as const;
  const contract = contracts[qualification];
  const evidenceValid = options.evidenceValid ?? true;
  return {
    runner: "playwright",
    qualification,
    mode: contract.mode,
    status: options.status ?? "PASS",
    runnerEvidenceValid: evidenceValid,
    qualificationEvidence: { valid: evidenceValid },
    testFilesSelected: [options.file],
    expectedConfiguration: contract.config,
    actualConfiguration: options.config ?? contract.config,
    actualProjects: [options.project ?? contract.project],
    nativeBackendAssertion: qualification === "nativeWebGpu"
      ? { requiredValue: "1", providedValue: "1" }
      : null,
    counts: {
      files: [options.file],
      passed: options.passed ?? (options.status === "FAIL" ? 0 : 1),
      failed: options.failed ?? (options.status === "FAIL" ? 1 : 0),
      skipped: options.skipped ?? 0,
      flaky: options.flaky ?? 0,
    },
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("Local CI argument and ownership contracts", () => {
  it("retains the legacy E2E alias and parses focused owner and extra test selections", () => {
    const options = parseLocalCiArgs([
      "--mode=focused",
      "--owner", "canonical-optics",
      "--tests", "src/tests/unit/thinLensModel.test.ts,src/tests/unit/imageCircleGeometry.test.ts",
      "--with-e2e",
    ]);
    expect(options.mode).toBe("focused");
    expect(options.includeE2E).toBe(true);
    expect(options.owners).toEqual(["canonical-optics"]);
    expect(options.tests).toHaveLength(2);
  });

  it("rejects malformed flags and incomplete focused commands", () => {
    expect(() => parseLocalCiArgs(["--mdoe=focused"])).toThrow("Unknown option");
    expect(() => parseLocalCiArgs(["--mode", "focused"])).toThrow("Focused mode needs");
    expect(() => parseLocalCiArgs(["--mode=focused", "--tests", "a.test.ts", "--workers", "0"])).toThrow("positive integer");
  });

  it("matches exact, wildcard, and subtree owner paths", () => {
    expect(matchesOwnerPath("src/core/optics/thinLensModel.ts", "src/core/optics/**")).toBe(true);
    expect(matchesOwnerPath("src/render/webgpu/adapter/runtime.ts", "src/render/**")).toBe(true);
    expect(matchesOwnerPath("src/core/optics/coordinates/projection.ts", "src/core/optics/**")).toBe(true);
    expect(matchesOwnerPath("src/app/sceneVariationRoute.ts", "src/app/scene*.ts")).toBe(true);
    expect(matchesOwnerPath("src/app/pages.tsx", "src/app/scene*.ts")).toBe(false);
    expect(matchesOwnerPath("vitest.config.ts", "vitest.config.ts")).toBe(true);
  });

  it("selects every matching contract owner and preserves manual test additions", () => {
    const owners = [
      { id: "optics", paths: ["src/core/optics/**"], tests: ["optics.test.ts"], reason: "fixed geometry" },
      { id: "coordinates", paths: ["src/core/optics/calculateGroundGlassProjection.ts"], tests: ["coordinates.test.ts"], reason: "film coordinates", requiresE2E: true, e2eSpecs: ["src/tests/e2e/groundglass-interaction.spec.ts"] },
    ];
    const selection = resolveOwnerSelection(["src/core/optics/calculateGroundGlassProjection.ts"], owners, () => true);
    expect(selection.ownerIds).toEqual(["coordinates", "optics"]);
    expect(selection.tests).toEqual(["coordinates.test.ts", "optics.test.ts"]);
    expect(selection.e2eSpecs).toEqual(["src/tests/e2e/groundglass-interaction.spec.ts"]);
    expect(selection.requiresE2E).toBe(true);

    const explicit = parseLocalCiArgs(["--mode=affected", "--tests", "src/tests/unit/extra.test.ts"]);
    expect(explicit.tests).toContain("src/tests/unit/extra.test.ts");
  });

  it("falls back to full Vitest and stays incomplete for unknown paths", () => {
    const selection = resolveOwnerSelection(["src/unmapped/newModule.ts"], [], () => true);
    expect(selection.fullVitest).toBe(true);
    expect(selection.incomplete).toBe(true);
    expect(selection.unknownPaths).toEqual(["src/unmapped/newModule.ts"]);
    expect(selection.tests).toEqual([]);
  });

  it("preserves selected scene tests but marks incomplete dependency ownership", () => {
    const selection = resolveOwnerSelection(
      ["src/scenes/presentation/example.ts"],
      [{
        id: "scene-implementation-incomplete",
        paths: ["src/scenes/**"],
        tests: ["sceneDefinitions.test.ts"],
        reason: "Scene implementation dependencies need review.",
        incompleteReason: "Not all scene dependencies map to these tests.",
      }],
      () => true,
    );
    expect(selection.tests).toEqual(["sceneDefinitions.test.ts"]);
    expect(selection.fullVitest).toBe(false);
    expect(selection.incomplete).toBe(true);
    expect(selection.incompleteReasons).toEqual([{
      path: "src/scenes/presentation/example.ts",
      owner: "scene-implementation-incomplete",
      reason: "Not all scene dependencies map to these tests.",
    }]);
  });

  it("falls back when a maintained owner references a missing test", () => {
    const selection = resolveOwnerSelection(
      ["src/core/optics/newModel.ts"],
      [{ id: "optics", paths: ["src/core/optics/**"], tests: ["missing.test.ts"], reason: "geometry" }],
      () => false,
    );
    expect(selection.fullVitest).toBe(true);
    expect(selection.staleTests).toEqual(["missing.test.ts"]);
    expect(selection.incomplete).toBe(true);
  });

  it("does not accept missing files or paths outside Vitest discovery as a selection", () => {
    const result = validateSelectedTestPaths(
      ["src/tests/unit/exists.test.ts", "src/tests/e2e/not-unit.spec.ts", "src/tests/unit/missing.test.ts"],
      (filePath) => filePath !== "src/tests/unit/missing.test.ts",
      (filePath) => /^src\/tests\/(unit|integration)\/.*\.test\.tsx?$/.test(filePath),
    );
    expect(result.valid).toBe(false);
    expect(result.invalid).toEqual(["src/tests/e2e/not-unit.spec.ts", "src/tests/unit/missing.test.ts"]);
  });

  it("keeps the candidate manifest on existing paths covered by Vitest's configured roots", async () => {
    const manifest: { coreRegressionOwnerIds: string[]; owners: { id: string; tests?: string[] }[] } =
      JSON.parse(await readFile(path.join(process.cwd(), "scripts/local-ci/owners.json"), "utf8"));
    const candidateOwners = manifest.owners.filter((owner) => manifest.coreRegressionOwnerIds.includes(owner.id));
    const candidates = [...new Set(candidateOwners.flatMap((owner) => owner.tests ?? []))];
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(/^src\/tests\/(unit|integration)\/.*\.test\.tsx?$/.test(candidate)).toBe(true);
      await expect(access(path.join(process.cwd(), candidate))).resolves.toBeUndefined();
    }
  });

  it("keeps every maintained owner test and browser target on an existing repository path", async () => {
    const manifest: { owners: { tests?: string[]; e2eSpecs?: string[] }[] } =
      JSON.parse(await readFile(path.join(process.cwd(), "scripts/local-ci/owners.json"), "utf8"));
    const paths = [...new Set(manifest.owners.flatMap((owner) => [...(owner.tests ?? []), ...(owner.e2eSpecs ?? [])]))];
    for (const repositoryPath of paths) {
      await expect(access(path.join(process.cwd(), repositoryPath))).resolves.toBeUndefined();
    }
  });
});

describe("Local CI runner evidence contracts", () => {
  it("uses only actual Vitest JSON fields for discovered and executed counts", () => {
    const result = parseVitestJsonReport({
      numTotalTestSuites: 7,
      numPassedTestSuites: 6,
      numFailedTestSuites: 1,
      numPendingTestSuites: 0,
      numTotalTests: 12,
      numPassedTests: 9,
      numFailedTests: 1,
      numPendingTests: 2,
      numTodoTests: 0,
      success: false,
      testResults: [{ name: "a.test.ts" }, { name: "b.test.ts" }, { name: "c.test.ts" }],
    });
    expect(result).toMatchObject({ discoveredFiles: 3, discoveredSuites: 7, discoveredCases: 12, executedCases: 10, passed: 9, failed: 1, skipped: 2, success: false });
  });

  it("treats missing, stale, or empty runner output as incomplete evidence", () => {
    expect(() => parseVitestJsonReport({ success: true, testResults: [] })).toThrow("numTotalTestSuites");
    expect(() => parseVitestJsonReport({
      numTotalTestSuites: 0,
      numPassedTestSuites: 0,
      numFailedTestSuites: 0,
      numPendingTestSuites: 0,
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0,
      numTodoTests: 0,
      success: true,
      testResults: [],
    })).toThrow("collected no tests");
    expect(() => parsePlaywrightJsonReport({ suites: [] })).toThrow("missing reliable stats");
  });

  it("reads Playwright totals from its reporter summary", () => {
    const repositoryRoot = process.cwd();
    expect(parsePlaywrightJsonReport({
      config: {
        configFile: path.join(repositoryRoot, "playwright.config.ts"),
        rootDir: path.join(repositoryRoot, "src/tests/e2e"),
      },
      suites: [{ specs: [
        { file: "a.spec.ts", tests: [{ projectName: "chromium" }] },
        { file: "b.spec.ts", tests: [{ projectName: "chromium-renderer-serial" }] },
      ] }],
      stats: { expected: 8, skipped: 2, unexpected: 1, flaky: 1, duration: 4000 },
    })).toEqual({
      discoveredFiles: 2,
      discoveredCases: 12,
      executedCases: 10,
      passed: 9,
      failed: 1,
      skipped: 2,
      flaky: 1,
      durationMs: 4000,
      files: ["src/tests/e2e/a.spec.ts", "src/tests/e2e/b.spec.ts"],
      configFile: "playwright.config.ts",
      projectNames: ["chromium", "chromium-renderer-serial"],
    });
  });

  it("rejects inconsistent Vitest totals and missing test file identities", () => {
    const report = {
      numTotalTestSuites: 1,
      numPassedTestSuites: 1,
      numFailedTestSuites: 0,
      numPendingTestSuites: 0,
      numTotalTests: 2,
      numPassedTests: 2,
      numFailedTests: 0,
      numPendingTests: 0,
      numTodoTests: 0,
      success: true,
      testResults: [{ name: "src/tests/unit/sample.test.ts" }],
    };
    expect(() => parseVitestJsonReport({ ...report, numTotalTests: 100 })).toThrow("inconsistent test totals");
    expect(() => parseVitestJsonReport({ ...report, numFailedTestSuites: 1 })).toThrow("inconsistent suite totals");
    expect(() => parseVitestJsonReport({ ...report, testResults: [{}] })).toThrow("without file paths");
  });

  it("requires selected runner files to match discovered files exactly", () => {
    const root = process.cwd();
    const comparison = compareTestFileSelection(
      ["src/tests/unit/one.test.ts", "src/tests/unit/two.test.ts"],
      [path.join(root, "src/tests/unit/one.test.ts"), path.join(root, "src/tests/unit/unexpected.test.ts")],
      root,
    );
    expect(comparison).toEqual({
      matches: false,
      missing: ["src/tests/unit/two.test.ts"],
      extra: ["src/tests/unit/unexpected.test.ts"],
    });
    expect(compareTestFileSelection(
      ["src/tests/e2e/smoke.spec.ts"],
      ["smoke.spec.ts"],
      root,
      { matchBasenames: true },
    ).matches).toBe(true);
    expect(applyRunnerEvidenceStatus("PASS", "vitest", { success: true, failed: 0, skipped: 0, todo: 1 })).toBe("INCOMPLETE");
  });

  it("requires a Playwright flaky count and discovered spec paths for a complete report", () => {
    expect(() => parsePlaywrightJsonReport({ suites: [], stats: { expected: 1, skipped: 0, unexpected: 0 } })).toThrow("missing reliable stats");
    expect(() => parsePlaywrightJsonReport({
      config: { configFile: "playwright.config.ts", rootDir: "src/tests/e2e" },
      suites: [],
      stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0 },
    })).toThrow("missing discovered spec file paths");
  });

  it("uses the native-backend assertion declared by each supported WebGPU spec", () => {
    expect(nativeWebGpuAssertionForSpec("src/tests/e2e/architecture-rise-webgpu-validation.spec.ts"))
      .toEqual({ environmentKey: "OBSERVER_NATIVE_WEBGPU_REQUIRED", requiredValue: "1" });
    expect(nativeWebGpuAssertionForSpec("src/tests/e2e/ground-glass-webgpu-correspondence-large-coc.spec.ts"))
      .toEqual({ environmentKey: "OBSERVER_NATIVE_WEBGPU_REQUIRED", requiredValue: "1" });
    expect(nativeWebGpuAssertionForSpec("src/tests/e2e/ground-glass-webgpu-host.spec.ts"))
      .toEqual({ environmentKey: "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED", requiredValue: "1" });
    expect(nativeWebGpuAssertionForSpec("src/tests/e2e/unmapped-webgpu-sample.spec.ts")).toBeNull();
  });

  it("requires every affected owner's browser contract even when an unrelated explicit spec passes", () => {
    const requiredFiles = [
      "src/tests/e2e/camera-movement-ground-glass-comparison.spec.ts",
      "src/tests/e2e/lesson-zero-image-circle-coverage.spec.ts",
      "src/tests/e2e/physical-image-circle.spec.ts",
      "src/tests/e2e/understanding-camera-movements.spec.ts",
    ];
    const smoke = "src/tests/e2e/smoke.spec.ts";
    const evidence = aggregateLocalCiEvidence({
      sourceStable: true,
      steps: [makePlaywrightStep({ file: smoke })],
      requiredE2EContracts: requiredFiles.map((file) => ({ file, owners: [{ id: "canonical-optics" }] })),
      requestedE2EFiles: [smoke],
      scheduledE2EFiles: [smoke],
      affectedE2ERequired: true,
      qualificationRequests: { ordinaryChromium: { requested: true, files: [smoke] } },
    });

    expect(evidence.qualifications.ordinaryChromium).toBe("PASS");
    expect(evidence.e2eCoverage).toMatchObject({
      requested: [smoke],
      scheduled: [smoke],
      executed: [smoke],
      verified: [smoke],
      status: "INCOMPLETE",
    });
    expect(evidence.e2eCoverage.missingRequired).toEqual(requiredFiles.map((file) => ({
      file,
      owners: ["canonical-optics"],
    })));
  });

  it("credits affected browser coverage only for all successfully verified required specs", () => {
    const requiredFiles = [
      "src/tests/e2e/camera-movement-ground-glass-comparison.spec.ts",
      "src/tests/e2e/lesson-zero-image-circle-coverage.spec.ts",
      "src/tests/e2e/physical-image-circle.spec.ts",
      "src/tests/e2e/understanding-camera-movements.spec.ts",
    ];
    const smoke = "src/tests/e2e/smoke.spec.ts";
    const contracts = requiredFiles.map((file) => ({ file, owners: [{ id: "canonical-optics" }] }));
    const allVerified = aggregateLocalCiEvidence({
      sourceStable: true,
      steps: [smoke, ...requiredFiles].map((file) => makePlaywrightStep({ file })),
      requiredE2EContracts: contracts,
      requestedE2EFiles: [smoke],
      scheduledE2EFiles: [smoke, ...requiredFiles],
      includeOwnerE2E: true,
      affectedE2ERequired: true,
      qualificationRequests: { ordinaryChromium: { requested: true, files: [smoke, ...requiredFiles] } },
    });
    expect(allVerified.e2eCoverage.status).toBe("PASS");
    expect(allVerified.e2eCoverage.missingRequired).toEqual([]);
    expect(allVerified.qualifications.ordinaryChromium).toBe("PASS");

    const skippedSubset = aggregateLocalCiEvidence({
      sourceStable: true,
      steps: [
        makePlaywrightStep({ file: requiredFiles[0], status: "INCOMPLETE", skipped: 1, passed: 0 }),
        makePlaywrightStep({ file: requiredFiles[1] }),
      ],
      requiredE2EContracts: contracts,
      scheduledE2EFiles: requiredFiles,
      affectedE2ERequired: true,
      qualificationRequests: { ordinaryChromium: { requested: true, files: requiredFiles } },
    });
    expect(skippedSubset.e2eCoverage.executed).toEqual(requiredFiles.slice(0, 2));
    expect(skippedSubset.e2eCoverage.verified).toEqual(requiredFiles.slice(1, 2));
    expect(skippedSubset.e2eCoverage.missingRequired.map((contract) => contract.file)).toEqual([requiredFiles[0], ...requiredFiles.slice(2)]);
    expect(skippedSubset.e2eCoverage.status).toBe("INCOMPLETE");
    expect(skippedSubset.qualifications.ordinaryChromium).toBe("INCOMPLETE");

    const scheduledOnly = aggregateLocalCiEvidence({
      sourceStable: true,
      steps: [],
      requiredE2EContracts: contracts,
      scheduledE2EFiles: requiredFiles,
      affectedE2ERequired: true,
    });
    expect(scheduledOnly.e2eCoverage.executed).toEqual([]);
    expect(scheduledOnly.e2eCoverage.missingRequired).toEqual(requiredFiles.map((file) => ({
      file,
      owners: ["canonical-optics"],
    })));
    expect(scheduledOnly.e2eCoverage.status).toBe("INCOMPLETE");
  });

  it("derives specialized qualification only from matching verified browser evidence", () => {
    const smoke = "src/tests/e2e/smoke.spec.ts";
    const preview = "src/tests/e2e/architecture-rise-webgpu-production.spec.ts";
    const native = "src/tests/e2e/architecture-rise-webgpu-validation.spec.ts";
    const requests = {
      ordinaryChromium: { requested: true, files: [smoke] },
      productionPreview: { requested: true, files: [preview] },
      nativeWebGpu: { requested: true, files: [native] },
    };
    const vitestPass = { runner: "vitest", status: "PASS" };
    const missingBrowser = aggregateLocalCiEvidence({ sourceStable: true, steps: [vitestPass], qualificationRequests: requests });
    expect(missingBrowser.qualifications).toMatchObject({
      ordinaryChromium: "INCOMPLETE",
      productionPreview: "INCOMPLETE",
      nativeWebGpu: "INCOMPLETE",
    });

    const evidence = aggregateLocalCiEvidence({
      sourceStable: true,
      steps: [vitestPass, makePlaywrightStep({ file: smoke }), makePlaywrightStep({ file: preview, qualification: "productionPreview" })],
      qualificationRequests: requests,
    });
    expect(evidence.qualifications).toMatchObject({
      ordinaryChromium: "PASS",
      productionPreview: "PASS",
      nativeWebGpu: "INCOMPLETE",
    });

    const productionFailure = aggregateLocalCiEvidence({
      sourceStable: true,
      steps: [vitestPass, makePlaywrightStep({ file: preview, qualification: "productionPreview", status: "FAIL" })],
      qualificationRequests: requests,
    });
    expect(productionFailure.qualifications.productionPreview).toBe("FAIL");
    expect(productionFailure.qualifications.nativeWebGpu).toBe("INCOMPLETE");

    const nativeFailure = aggregateLocalCiEvidence({
      sourceStable: true,
      steps: [vitestPass, makePlaywrightStep({ file: native, qualification: "nativeWebGpu", status: "FAIL" })],
      qualificationRequests: requests,
    });
    expect(nativeFailure.qualifications.nativeWebGpu).toBe("FAIL");

    const nativeUnavailable = aggregateLocalCiEvidence({
      sourceStable: true,
      steps: [vitestPass, makePlaywrightStep({ file: native, qualification: "nativeWebGpu", status: "INCOMPLETE", skipped: 1, passed: 0 })],
      qualificationRequests: requests,
    });
    expect(nativeUnavailable.qualifications.nativeWebGpu).toBe("INCOMPLETE");
    expect(nativeUnavailable.qualifications.productionPreview).toBe("INCOMPLETE");

    const wrongProject = aggregateLocalCiEvidence({
      sourceStable: true,
      steps: [makePlaywrightStep({ file: preview, qualification: "productionPreview", project: "chromium" })],
      qualificationRequests: requests,
    });
    expect(wrongProject.qualifications.productionPreview).toBe("INCOMPLETE");

    const failedWrongProject = aggregateLocalCiEvidence({
      sourceStable: true,
      steps: [makePlaywrightStep({ file: preview, qualification: "productionPreview", project: "chromium", status: "FAIL" })],
      qualificationRequests: requests,
    });
    expect(failedWrongProject.qualifications.productionPreview).toBe("INCOMPLETE");

    const wrongConfig = aggregateLocalCiEvidence({
      sourceStable: true,
      steps: [makePlaywrightStep({ file: preview, qualification: "productionPreview", config: "playwright.config.ts" })],
      qualificationRequests: requests,
    });
    expect(wrongConfig.qualifications.productionPreview).toBe("INCOMPLETE");
  });

  it("fails preflight on unsupported Node, missing dependencies, or unavailable browser qualification", () => {
    const result = evaluateEnvironmentRequirements({
      nodeVersion: "v26.12.1",
      npmVersion: "11.0.0",
      npmAvailable: true,
      dependenciesAvailable: false,
      playwrightRequested: true,
      playwrightPackageAvailable: true,
      browserAvailable: false,
      nativeWebGpuRequested: false,
      systemChromeAvailable: false,
    });
    expect(result.passed).toBe(false);
    expect(result.issues.join(" ")).toMatch(/Node 24/);
    expect(result.issues.join(" ")).toMatch(/dependencies are not installed/);
    expect(result.issues.join(" ")).toMatch(/Chromium is unavailable/);
  });

  it("keeps an unavailable native Chrome qualification distinct from ordinary Chromium", () => {
    const result = evaluateEnvironmentRequirements({
      nodeVersion: "v24.3.0",
      npmVersion: "11.12.0",
      npmAvailable: true,
      dependenciesAvailable: true,
      playwrightRequested: true,
      playwrightPackageAvailable: true,
      browserAvailable: true,
      nativeWebGpuRequested: true,
      systemChromeAvailable: false,
    });
    expect(result.passed).toBe(false);
    expect(result.issues.join(" ")).toMatch(/system Chrome/);
  });

  it("distinguishes pass, fail, incomplete, interruption, and not-run", () => {
    const pass = [{ status: "PASS" }];
    expect(determineOverallStatus({ sourceStable: true, failedStep: false, steps: pass, incomplete: false })).toBe("PASS");
    expect(determineOverallStatus({ sourceStable: true, failedStep: true, steps: [{ status: "FAIL" }], incomplete: false })).toBe("FAIL");
    expect(determineOverallStatus({ sourceStable: false, failedStep: false, steps: pass, incomplete: false })).toBe("INCOMPLETE");
    expect(determineOverallStatus({ sourceStable: true, failedStep: false, steps: pass, incomplete: true })).toBe("INCOMPLETE");
    expect(determineOverallStatus({ sourceStable: true, failedStep: false, steps: [], incomplete: false })).toBe("NOT_RUN");
    expect(determineOverallStatus({ sourceStable: true, failedStep: false, steps: pass, incomplete: false, interrupted: true })).toBe("INCOMPLETE");
  });

  it("does not trust a successful process exit over failed, skipped, or flaky runner evidence", () => {
    expect(applyRunnerEvidenceStatus("PASS", "vitest", { success: false, failed: 0, skipped: 0 })).toBe("FAIL");
    expect(applyRunnerEvidenceStatus("PASS", "vitest", { success: true, failed: 0, skipped: 1 })).toBe("INCOMPLETE");
    expect(applyRunnerEvidenceStatus("PASS", "playwright", { failed: 1, skipped: 0, flaky: 0 })).toBe("FAIL");
    expect(applyRunnerEvidenceStatus("PASS", "playwright", { failed: 0, skipped: 0, flaky: 1 })).toBe("INCOMPLETE");
    expect(applyRunnerEvidenceStatus("FAIL", "vitest", { success: true, failed: 0, skipped: 0 })).toBe("FAIL");
  });

  it("writes reports atomically and rejects an impossible report destination", async () => {
    const directory = await makeTemporaryDirectory();
    const reportPath = path.join(directory, "out", "report.json");
    await writeJsonAtomically(reportPath, { status: "PASS" });
    expect(JSON.parse(await readFile(reportPath, "utf8"))).toEqual({ status: "PASS" });
    const blocker = path.join(directory, "file-parent");
    await writeFile(blocker, "not a directory");
    await expect(writeJsonAtomically(path.join(blocker, "report.json"), {})).rejects.toThrow();
  });

});

describe("Local CI emitted report integration", () => {
  it("reports affected browser contracts as incomplete when only an unrelated explicit smoke spec passes", async () => {
    const fixture = await makeLocalCiRunnerFixture();
    const smoke = "src/tests/e2e/smoke.spec.ts";
    const result = await executeLocalCi(fixture, [
      "--mode=affected",
      "--base",
      fixture.base,
      "--e2e-spec",
      smoke,
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.report.status).toBe("INCOMPLETE");
    expect(result.report.execution.completeForRequestedScope).toBe(false);
    expect(result.report.steps.map((step: { runner: string; status: string }) => [step.runner, step.status])).toEqual([
      ["vitest", "PASS"],
      ["playwright", "PASS"],
    ]);
    expect(result.report.qualifications.ordinaryChromium).toBe("PASS");
    expect(result.report.execution.e2eCoverage).toMatchObject({
      requested: [smoke],
      scheduled: [smoke],
      executed: [smoke],
      verified: [smoke],
      status: "INCOMPLETE",
    });
    expect(result.report.execution.e2eCoverage.required).toHaveLength(4);
    expect(result.report.execution.e2eCoverage.missingRequired).toEqual(
      result.report.execution.e2eCoverage.required,
    );
    expect(result.report.execution.e2eCoverage.missingRequired.every((contract: { owners: string[] }) =>
      contract.owners.includes("canonical-optics"),
    )).toBe(true);
    const playwrightStep = result.report.steps[1];
    expect(playwrightStep).toMatchObject({
      runner: "playwright",
      mode: "ordinary-chromium",
      qualification: "ordinaryChromium",
      expectedConfiguration: "playwright.config.ts",
      actualConfiguration: "playwright.config.ts",
      actualProjects: ["chromium"],
      runnerEvidenceValid: true,
      selectionEvidence: { matches: true },
    });
    expect(playwrightStep.counts.files).toEqual([smoke]);
  });

  it("recognizes a successful focused ordinary Chromium run from the emitted Playwright report", async () => {
    const fixture = await makeLocalCiRunnerFixture();
    const smoke = "src/tests/e2e/smoke.spec.ts";
    const result = await executeLocalCi(fixture, [
      "--mode=focused",
      "--e2e-spec",
      smoke,
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.report.status).toBe("PASS");
    expect(result.report.execution.completeForRequestedScope).toBe(true);
    expect(result.report.qualifications.ordinaryChromium).toBe("PASS");
    expect(result.report.execution.e2eCoverage).toMatchObject({
      required: [],
      requested: [smoke],
      scheduled: [smoke],
      executed: [smoke],
      verified: [smoke],
      status: "NOT_REQUIRED",
    });
    expect(result.report.steps[0]).toMatchObject({
      runner: "playwright",
      mode: "ordinary-chromium",
      qualification: "ordinaryChromium",
      status: "PASS",
      runnerEvidenceValid: true,
      counts: { files: [smoke], passed: 1, failed: 0, skipped: 0, flaky: 0 },
    });
  });

  it("rejects a focused Playwright report whose discovered spec differs from the selected target", async () => {
    const fixture = await makeLocalCiRunnerFixture();
    const smoke = "src/tests/e2e/smoke.spec.ts";
    const result = await executeLocalCi(fixture, [
      "--mode=focused",
      "--e2e-spec",
      smoke,
    ], { FAKE_PLAYWRIGHT_REPORT_SPEC: "src/tests/e2e/other.spec.ts" });

    expect(result.exitCode).toBe(2);
    expect(result.report.status).toBe("INCOMPLETE");
    expect(result.report.execution.completeForRequestedScope).toBe(false);
    expect(result.report.qualifications.ordinaryChromium).toBe("INCOMPLETE");
    expect(result.report.steps[0]).toMatchObject({
      runner: "playwright",
      status: "INCOMPLETE",
      runnerEvidenceValid: false,
      selectionEvidence: { matches: false, missing: [smoke], extra: ["src/tests/e2e/other.spec.ts"] },
    });
  });

  it("keeps scheduled but unexecuted affected E2E contracts uncovered after a real step failure", async () => {
    const fixture = await makeLocalCiRunnerFixture();
    const failedRequired = "src/tests/e2e/camera-movement-ground-glass-comparison.spec.ts";
    const result = await executeLocalCi(fixture, [
      "--mode=affected",
      "--base",
      fixture.base,
      "--with-e2e",
    ], { FAKE_PLAYWRIGHT_FAIL_SPEC: failedRequired });

    expect(result.exitCode).toBe(1);
    expect(result.report.status).toBe("FAIL");
    expect(result.report.execution.completeForRequestedScope).toBe(false);
    expect(result.report.execution.e2eCoverage.scheduled).toContain(failedRequired);
    expect(result.report.execution.e2eCoverage.scheduled).toContain("src/tests/e2e/physical-image-circle.spec.ts");
    expect(result.report.execution.e2eCoverage.executed).toContain(failedRequired);
    expect(result.report.execution.e2eCoverage.verified).not.toContain(failedRequired);
    expect(result.report.execution.e2eCoverage.missingRequired.map((contract: { file: string }) => contract.file)).toEqual([
      "src/tests/e2e/camera-movement-ground-glass-comparison.spec.ts",
      "src/tests/e2e/lesson-zero-image-circle-coverage.spec.ts",
      "src/tests/e2e/physical-image-circle.spec.ts",
      "src/tests/e2e/understanding-camera-movements.spec.ts",
    ]);
    expect(result.report.steps.filter((step: { runner: string }) => step.runner === "playwright")).toHaveLength(1);
    expect(result.report.qualifications.ordinaryChromium).toBe("FAIL");
  });

  it("does not let a successful Vitest step mask a failed Production Preview browser step", async () => {
    const fixture = await makeLocalCiRunnerFixture();
    const preview = "src/tests/e2e/architecture-rise-webgpu-production.spec.ts";
    const result = await executeLocalCi(fixture, [
      "--mode=affected",
      "--base",
      fixture.base,
      "--e2e-spec",
      preview,
      "--production-preview",
    ], { FAKE_PLAYWRIGHT_FAIL_SPEC: preview });

    expect(result.exitCode).toBe(1);
    expect(result.report.status).toBe("FAIL");
    expect(result.report.execution.completeForRequestedScope).toBe(false);
    expect(result.report.steps[0]).toMatchObject({ runner: "vitest", status: "PASS" });
    expect(result.report.steps[1]).toMatchObject({
      runner: "playwright",
      qualification: "productionPreview",
      mode: "production-preview",
      expectedConfiguration: "playwright.production.config.ts",
      actualConfiguration: "playwright.production.config.ts",
      expectedProjectNames: ["chromium-production-preview"],
      actualProjects: ["chromium-production-preview"],
      status: "FAIL",
      runnerEvidenceValid: true,
      qualificationEvidence: { valid: true },
    });
    expect(result.report.qualifications.productionPreview).toBe("FAIL");
    expect(result.report.qualifications.ordinaryChromium).toBe("NOT_RUN");
    expect(result.report.qualifications.nativeWebGpu).toBe("NOT_RUN");
  });

  it("leaves a requested specialized qualification incomplete when Playwright evidence is missing", async () => {
    const fixture = await makeLocalCiRunnerFixture();
    const preview = "src/tests/e2e/architecture-rise-webgpu-production.spec.ts";
    const result = await executeLocalCi(fixture, [
      "--mode=affected",
      "--base",
      fixture.base,
      "--e2e-spec",
      preview,
      "--production-preview",
    ], { FAKE_PLAYWRIGHT_OMIT_REPORT: "1" });

    expect(result.exitCode).toBe(2);
    expect(result.report.status).toBe("INCOMPLETE");
    expect(result.report.steps[0]).toMatchObject({ runner: "vitest", status: "PASS" });
    expect(result.report.steps[1]).toMatchObject({
      runner: "playwright",
      status: "INCOMPLETE",
      runnerEvidenceValid: false,
      qualificationEvidence: { valid: false },
    });
    expect(result.report.qualifications.productionPreview).toBe("INCOMPLETE");
    expect(result.report.execution.completeForRequestedScope).toBe(false);
  });
});

describe("Local CI source state", () => {
  it("fingerprints tracked edits and untracked files and discovers them against a base SHA", async () => {
    const directory = await makeTemporaryDirectory();
    const git = (args: string[]) => execFileSync("git", args, { cwd: directory, stdio: "ignore" });
    git(["init", "--quiet"]);
    git(["config", "user.email", "local-ci@example.invalid"]);
    git(["config", "user.name", "Local CI test"]);
    const baseContents = Array.from({ length: 10 }, (_, index) => `stable line ${index}`).join("\n") + "\n";
    await writeFile(path.join(directory, "tracked.txt"), baseContents);
    git(["add", "tracked.txt"]);
    git(["commit", "--quiet", "-m", "base"]);
    const base = resolveCommit(directory, "HEAD");
    expect(() => resolveCommit(directory, "missing-ref")).toThrow();
    const clean = await snapshotSourceState(directory);
    expect(clean.clean).toBe(true);

    await writeFile(path.join(directory, "tracked.txt"), baseContents.replace("stable line 3", "changed line 3"));
    git(["mv", "tracked.txt", "renamed.txt"]);
    await writeFile(path.join(directory, "new-source.ts"), "export const value = 1;\n");
    const changed = await snapshotSourceState(directory);
    expect(changed.clean).toBe(false);
    expect(changed.untracked).toEqual(["new-source.ts"]);
    expect(changed.fingerprint).not.toBe(clean.fingerprint);
    expect(listChangedPaths(directory, base)).toEqual(["new-source.ts", "renamed.txt", "tracked.txt"]);

    await writeFile(path.join(directory, "new-source.ts"), "export const value = 2;\n");
    const editedUntracked = await snapshotSourceState(directory);
    expect(editedUntracked.fingerprint).not.toBe(changed.fingerprint);

    await writeFile(path.join(directory, "renamed.txt"), Buffer.from([0xff, 0xfe, 0x00, 0x80]));
    const binaryEdit = await snapshotSourceState(directory);
    expect(binaryEdit.fingerprint).not.toBe(editedUntracked.fingerprint);
  });
});
