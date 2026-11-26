import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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

async function resolveCheckedInOwnerSelection(changedPaths: string[], pathExists: (file: string) => boolean = (file) => existsSync(file)) {
  const manifest: { owners: Parameters<typeof resolveOwnerSelection>[1] } = JSON.parse(
    await readFile(path.join(process.cwd(), "scripts/local-ci/owners.json"), "utf8"),
  );
  return resolveOwnerSelection(changedPaths, manifest.owners, pathExists);
}

async function makeLocalCiRunnerFixture(changedPaths = ["src/core/optics/newModel.ts"]) {
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
  const testFiles = new Set(manifest.owners.flatMap((owner) => owner.tests ?? []));
  const specFiles = new Set(manifest.owners.flatMap((owner) => owner.e2eSpecs ?? []));
  for (const testFile of testFiles) await writeFixtureFile(root, testFile, "export {}\n");
  for (const specFile of [
    ...specFiles,
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
      lint: "node ./fake-ok.mjs",
      typecheck: "node ./fake-ok.mjs",
      "check:css": "node ./fake-ok.mjs",
      build: "node ./fake-ok.mjs",
    },
  }, null, 2));
  await writeFixtureFile(root, "fake-vitest.mjs", `
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
const output = process.argv.find((argument) => argument.startsWith("--outputFile="))?.slice("--outputFile=".length);
const requested = process.argv.slice(2).filter((argument) => /^src\\/tests\\/(unit|integration)\\/.*\\.test\\.tsx?$/.test(argument));
async function discover(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return []; }
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await discover(target));
    else if (entry.isFile() && /\\.test\\.tsx?$/.test(entry.name)) files.push(path.relative(process.cwd(), target).split(path.sep).join("/"));
  }
  return files;
}
const files = requested.length > 0 ? requested : [
  ...await discover(path.join(process.cwd(), "src/tests/unit")),
  ...await discover(path.join(process.cwd(), "src/tests/integration")),
];
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
  await writeFixtureFile(root, "fake-ok.mjs", "process.exit(0);\n");
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
  for (const tool of [
    { packageName: "eslint", executable: "eslint" },
    { packageName: "typescript", executable: "tsc" },
    { packageName: "vite", executable: "vite" },
  ]) {
    await writeFixtureFile(root, `node_modules/${tool.packageName}/package.json`, JSON.stringify({ name: tool.packageName, version: "0.0.0-fixture" }));
    await writeFixtureFile(root, `node_modules/.bin/${tool.executable}`, "#!/bin/sh\nexit 0\n", true);
  }
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
  for (const changedPath of changedPaths) await writeFixtureFile(root, changedPath, "export const changed = true;\n");
  git(["add", ...changedPaths]);
  git(["commit", "--quiet", "-m", "change source"]);
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

  it("keeps every checked-in owner test and browser path present", async () => {
    const manifest: { owners: { tests?: string[]; e2eSpecs?: string[] }[] } =
      JSON.parse(await readFile(path.join(process.cwd(), "scripts/local-ci/owners.json"), "utf8"));
    const testFiles = [...new Set(manifest.owners.flatMap((owner) => owner.tests ?? []))];
    const specFiles = [...new Set(manifest.owners.flatMap((owner) => owner.e2eSpecs ?? []))];
    for (const file of [...testFiles, ...specFiles]) {
      expect(existsSync(path.join(process.cwd(), file)), file).toBe(true);
    }
  });

  it("maps Table Tilt furnishing and geometry inputs to mounted-scene contracts", async () => {
    const manifest: { owners: { id: string; tests?: string[] }[] } =
      JSON.parse(await readFile(path.join(process.cwd(), "scripts/local-ci/owners.json"), "utf8"));
    const tableTiltOwner = manifest.owners.find((owner) => owner.id === "table-tilt-mounted-geometry");
    expect(tableTiltOwner?.tests).toContain("src/tests/unit/tableTiltMountedVisibility.test.ts");
    expect(tableTiltOwner?.tests).toContain("src/tests/unit/tableTiltGeometry.test.ts");

    const furnishing = await resolveCheckedInOwnerSelection([
      "src/render/table-tilt/TableTiltStudioFurnishings.ts",
    ]);
    expect(furnishing.ownerIds).toContain("table-tilt-mounted-geometry");
    expect(furnishing.e2eSpecs).toContain("src/tests/e2e/table-tilt.spec.ts");
    expect(furnishing.ownerIds).not.toContain("webgpu-lifecycle");
    expect(furnishing.fullVitest).toBe(true);
    expect(furnishing.provisionalPaths).toEqual(["src/render/table-tilt/TableTiltStudioFurnishings.ts"]);
    expect(furnishing.incomplete).toBe(true);
    expect(furnishing.incompleteReasons.some((item) => item.owner === "table-tilt-mounted-geometry"))
      .toBe(true);

    const sceneGeometry = await resolveCheckedInOwnerSelection([
      "src/scenes/tableTiltGeometry.ts",
    ]);
    expect(sceneGeometry.ownerIds).toContain("table-tilt-mounted-geometry");
    expect(sceneGeometry.ownerIds).toContain("scene-implementation-incomplete");
    expect(sceneGeometry.tests).toContain("src/tests/unit/tableTiltMountedVisibility.test.ts");
    expect(sceneGeometry.incomplete).toBe(true);
    expect(sceneGeometry.incompleteReasons.some((item) => item.owner === "scene-implementation-incomplete")).toBe(true);

    const assetFactory = await resolveCheckedInOwnerSelection([
      "src/render/TableTiltSubjectFactory.tsx",
    ]);
    expect(assetFactory.ownerIds).toContain("table-tilt-mounted-geometry");
    expect(assetFactory.e2eSpecs).toContain("src/tests/e2e/table-tilt.spec.ts");
    expect(assetFactory.fullVitest).toBe(true);
    expect(assetFactory.incomplete).toBe(true);
  });

  it("selects direct Ground Glass frame-request, execution, and renderer-lifecycle contracts", async () => {
    const request = await resolveCheckedInOwnerSelection([
      "src/render/groundGlassFrameRequest.ts",
    ]);
    expect(request.ownerIds).toContain("renderer-lifecycle");
    expect(request.tests).toContain("src/tests/unit/groundGlassFrameRequest.test.ts");
    expect(request.tests).toContain("src/tests/unit/GroundGlassRTT.test.ts");
    expect(request.e2eSpecs).toContain("src/tests/e2e/scene-switching.spec.ts");
    expect(request.incomplete).toBe(false);

    const execution = await resolveCheckedInOwnerSelection([
      "src/render/groundGlassFrameExecution.ts",
    ]);
    expect(execution.ownerIds).toContain("renderer-lifecycle");
    expect(execution.tests).toContain("src/tests/unit/groundGlassFrameExecution.test.ts");
    expect(execution.tests).toContain("src/tests/unit/GroundGlassRTT.test.ts");
    expect(execution.tests).toContain("src/tests/unit/groundGlassRttResources.test.ts");
    expect(execution.incomplete).toBe(false);

    const host = await resolveCheckedInOwnerSelection(["src/render/GroundGlassRenderHost.tsx"]);
    expect(host.tests).toContain("src/tests/unit/GroundGlassRenderHost.test.tsx");
    expect(host.tests).toContain("src/tests/unit/groundGlassFrameRequest.test.ts");
    expect(host.tests).toContain("src/tests/unit/groundGlassFrameExecution.test.ts");
  });

  it("maps scene subject and asset registries to their separate registry, resource, route, and browser owners", async () => {
    const registry = await resolveCheckedInOwnerSelection([
      "src/render/sceneSubjectRegistry.tsx",
      "src/render/assets/sceneAssetRegistry.ts",
    ]);
    expect(registry.ownerIds).toContain("scene-subject-registry");
    expect(registry.tests).toContain("src/tests/unit/sceneSubjectRegistry.test.tsx");
    expect(registry.tests).toContain("src/tests/unit/sceneAssetRegistry.test.ts");
    expect(registry.tests).toContain("src/tests/unit/sharedSceneResourceLifecycle.test.ts");
    expect(registry.tests).toContain("src/tests/unit/tableTiltMountedVisibility.test.ts");
    expect(registry.tests).toContain("src/tests/integration/scene-publication-gate.test.tsx");
    expect(registry.e2eSpecs).toContain("src/tests/e2e/scene-switching.spec.ts");
    expect(registry.tests.filter((file) => file === "src/tests/unit/sceneSubjectRegistry.test.tsx")).toHaveLength(1);
    expect(registry.incomplete).toBe(false);
  });

  it("retains asymmetric Raw/Upright coordinate proof for orientation changes", async () => {
    const selection = await resolveCheckedInOwnerSelection([
      "src/render/groundGlassRttOrientation.ts",
    ]);
    expect(selection.ownerIds).toContain("ground-glass-coordinates");
    expect(selection.tests).toContain("src/tests/unit/groundGlassRttOrientation.test.ts");
    expect(selection.tests).toContain("src/tests/unit/groundGlassCoordinateContract.test.ts");
    expect(selection.e2eSpecs).toContain("src/tests/e2e/groundglass-interaction.spec.ts");
    expect(selection.incomplete).toBe(false);
  });

  it("maps active evaluator, routing, and exact-source provenance changes to active Unit contracts", async () => {
    const evaluator = await resolveCheckedInOwnerSelection([
      "scripts/evaluateM7mSceneReadiness.ts",
    ]);
    expect(evaluator.ownerIds).toContain("historical-active-unit-contracts");
    expect(evaluator.ownerIds).toContain("historical-m7m-scene-readiness");
    expect(evaluator.tests).toContain("src/tests/unit/groundGlassM7mSceneReadiness.test.ts");
    expect(evaluator.fullLocalCi).toBe(true);
    expect(evaluator.fullVitest).toBe(false);
    expect(evaluator.incomplete).toBe(false);

    const routing = await resolveCheckedInOwnerSelection([
      "scripts/historical-evidence-routing.mjs",
    ]);
    expect(routing.ownerIds).toContain("historical-evidence-routing");
    expect(routing.tests).toContain("src/tests/unit/historicalEvidenceRouting.test.ts");
    expect(routing.tests).toContain("src/tests/unit/m7kCaptureWorkflow.test.ts");
    expect(routing.fullLocalCi).toBe(true);
    expect(routing.incomplete).toBe(false);

    const provenance = await resolveCheckedInOwnerSelection([
      "scripts/fetch-m7k-execution-source.mjs",
    ]);
    expect(provenance.ownerIds).toContain("evidence-and-ci-policy");
    expect(provenance.tests).toContain("src/tests/unit/m7kCaptureWorkflow.test.ts");
    expect(provenance.tests).toContain("src/tests/unit/groundGlassM7mSceneReadiness.test.ts");
    expect(provenance.incomplete).toBe(false);

    const normalizer = await resolveCheckedInOwnerSelection([
      "scripts/normalizeM7nRendererLifecycleCapture.mjs",
    ]);
    expect(normalizer.ownerIds).toContain("historical-active-unit-contracts");
    expect(normalizer.ownerIds).toContain("historical-m7n-renderer-lifecycle-normalizer");
    expect(normalizer.tests).toEqual([]);
    expect(normalizer.fullLocalCi).toBe(true);
    expect(normalizer.fullVitest).toBe(true);
    expect(normalizer.provisionalPaths).toEqual(["scripts/normalizeM7nRendererLifecycleCapture.mjs"]);
    expect(normalizer.incomplete).toBe(true);
    const manifest: { owners: { id: string; tests?: string[] }[] } = JSON.parse(
      await readFile(path.join(process.cwd(), "scripts/local-ci/owners.json"), "utf8"),
    );
    expect(manifest.owners.find((owner) => owner.id === "historical-m7n-renderer-lifecycle-normalizer")?.tests)
      .toContain("src/tests/unit/m7nRendererLifecycleEvidence.test.ts");

    const m7nEvaluator = await resolveCheckedInOwnerSelection([
      "scripts/evaluateM7nRendererLifecycle.ts",
    ]);
    expect(m7nEvaluator.ownerIds).toContain("historical-m7n-renderer-lifecycle-evaluator");
    expect(m7nEvaluator.tests).toContain("src/tests/unit/m7nRendererLifecycleEvidence.test.ts");
    expect(m7nEvaluator.fullVitest).toBe(false);
    expect(m7nEvaluator.incomplete).toBe(false);

    const trace = await resolveCheckedInOwnerSelection([
      "src/render/testing/m7nRendererLifecycleTrace.ts",
    ]);
    expect(trace.ownerIds).toContain("historical-m7n-renderer-lifecycle-trace");
    expect(trace.tests).toContain("src/tests/unit/m7nRendererLifecycleTrace.test.ts");
    expect(trace.fullVitest).toBe(false);
    expect(trace.incomplete).toBe(false);
  });

  it("keeps unknown M7 family-prefix paths provisional without an unrelated complete owner", async () => {
    const unknownPaths = [
      "src/render/webgpu/groundGlassM7zNewEvidence.ts",
      "src/render/testing/groundGlassM7zNewEvaluator.ts",
      "scripts/evaluateM7zNewEvaluator.ts",
      "scripts/normalizeM7zNewCapture.mjs",
    ];

    for (const changed of unknownPaths) {
      const selection = await resolveCheckedInOwnerSelection([changed]);
      expect(selection.ownerIds).toContain("historical-active-unit-contracts");
      expect(selection.ownerIds.some((ownerId) => [
        "historical-m7e-gather-b1-evidence",
        "historical-m7m-scene-readiness",
        "historical-m7n-renderer-lifecycle-evaluator",
        "historical-m7n-renderer-lifecycle-trace",
        "historical-evidence-routing",
        "evidence-and-ci-policy",
      ].includes(ownerId))).toBe(false);
      expect(selection.provisionalPaths).toContain(changed);
      expect(selection.fullVitest).toBe(true);
      expect(selection.incomplete).toBe(true);
      expect(selection.tests).toEqual([]);
      if (changed.startsWith("scripts/")) expect(selection.fullLocalCi).toBe(true);
    }
  });

  it("keeps reviewed M7E source ownership separate from frozen archive replay", async () => {
    const changed = "src/render/webgpu/groundGlassM7eGatherB1Evidence.ts";
    const selection = await resolveCheckedInOwnerSelection([changed]);

    expect(selection.ownerIds).toContain("historical-m7e-gather-b1-evidence");
    expect(selection.ownerIds).toContain("historical-active-unit-contracts");
    expect(selection.tests).toContain("src/tests/unit/groundGlassM7eGatherB1Evidence.test.ts");
    expect(selection.tests).toContain("src/tests/unit/groundGlassM7eArtifactReplay.test.ts");
    expect(selection.fullVitest).toBe(false);
    expect(selection.provisionalPaths).toEqual([]);
    expect(selection.incomplete).toBe(false);
    expect(selection.nativeGpuRequired).toBe(false);
    expect(selection.e2eSpecs).toEqual([]);
  });

  it("combines reviewed owners but keeps a mixed change incomplete when one M7 source is unknown", async () => {
    const unknown = "src/render/webgpu/groundGlassM7zNewEvidence.ts";
    const selection = await resolveCheckedInOwnerSelection([
      "src/render/webgpu/groundGlassB1Reference.ts",
      "scripts/evaluateM7mSceneReadiness.ts",
      unknown,
    ]);

    expect(selection.ownerIds).toEqual(expect.arrayContaining([
      "webgpu-b1-reference",
      "historical-m7m-scene-readiness",
      "historical-active-unit-contracts",
      "webgpu-source-supplement",
    ]));
    expect(selection.provisionalPaths).toContain(unknown);
    expect(selection.fullVitest).toBe(true);
    expect(selection.fullLocalCi).toBe(true);
    expect(selection.incomplete).toBe(true);
    expect(selection.tests).toEqual([]);
    expect(new Set(selection.reasons.map((item) => item.path))).toEqual(new Set([
      "src/render/webgpu/groundGlassB1Reference.ts",
      "scripts/evaluateM7mSceneReadiness.ts",
      unknown,
    ]));
  });

  it("maps the B1 CPU reference to its direct contract tests without requiring native GPU proof", async () => {
    const reference = await resolveCheckedInOwnerSelection([
      "src/render/webgpu/groundGlassB1Reference.ts",
    ]);

    expect(reference.ownerIds).toContain("webgpu-b1-reference");
    expect(reference.ownerIds).toContain("webgpu-source-supplement");
    expect(reference.ownerIds).toContain("render-source-supplement");
    expect(reference.ownerIds).not.toContain("webgpu-lifecycle");
    expect(reference.tests).toContain("src/tests/unit/groundGlassWebGpuB1Reference.test.ts");
    expect(reference.tests).toContain("src/tests/unit/groundGlassM7eGatherB1Evidence.test.ts");
    expect(reference.fullVitest).toBe(false);
    expect(reference.incomplete).toBe(false);
    expect(reference.provisionalPaths).toEqual([]);
    expect(reference.requiresE2E).toBe(false);
    expect(reference.nativeGpuRequired).toBe(false);
  });

  it("keeps unknown WebGPU files provisional and fails closed to full Vitest", async () => {
    const changed = "src/render/webgpu/newUnmappedReference.ts";
    const selection = await resolveCheckedInOwnerSelection([changed]);

    expect(selection.ownerIds).toContain("webgpu-source-supplement");
    expect(selection.ownerIds).toContain("render-source-supplement");
    expect(selection.ownerIds).not.toContain("webgpu-lifecycle");
    expect(selection.provisionalPaths).toEqual([changed]);
    expect(selection.fullVitest).toBe(true);
    expect(selection.incomplete).toBe(true);
    expect(selection.tests).toEqual([]);
    expect(selection.requiresE2E).toBe(false);
    expect(selection.nativeGpuRequired).toBe(false);
  });

  it("keeps verified runtime helpers precise and adapter lifecycle provisional with native proof", async () => {
    const runtime = await resolveCheckedInOwnerSelection([
      "src/render/webgpu/groundGlassWebGpuRuntime.ts",
    ]);
    expect(runtime.ownerIds).toContain("webgpu-runtime-classification");
    expect(runtime.tests).toContain("src/tests/unit/groundGlassWebGpuRuntime.test.ts");
    expect(runtime.fullVitest).toBe(false);
    expect(runtime.incomplete).toBe(false);
    expect(runtime.requiresE2E).toBe(false);
    expect(runtime.nativeGpuRequired).toBe(false);

    const diagnostics = await resolveCheckedInOwnerSelection([
      "src/render/webgpu/groundGlassWebGpuDiagnostics.ts",
    ]);
    expect(diagnostics.ownerIds).toContain("webgpu-diagnostic-attribution");
    expect(diagnostics.tests).toContain("src/tests/unit/GroundGlassWebGPUAdapterDiagnostics.test.ts");
    expect(diagnostics.fullVitest).toBe(false);
    expect(diagnostics.incomplete).toBe(false);
    expect(diagnostics.requiresE2E).toBe(false);
    expect(diagnostics.nativeGpuRequired).toBe(false);

    const adapter = await resolveCheckedInOwnerSelection([
      "src/render/webgpu/GroundGlassWebGPUAdapter.tsx",
    ]);
    expect(adapter.ownerIds).toContain("webgpu-lifecycle");
    expect(adapter.tests).toEqual([]);
    expect(adapter.e2eSpecs).toContain("src/tests/e2e/ground-glass-webgpu-failure-host.spec.ts");
    expect(nativeWebGpuAssertionForSpec("src/tests/e2e/ground-glass-webgpu-failure-host.spec.ts"))
      .toEqual({ environmentKey: "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED", requiredValue: "1" });
    expect(adapter.fullVitest).toBe(true);
    expect(adapter.incomplete).toBe(true);
    expect(adapter.provisionalPaths).toContain("src/render/webgpu/GroundGlassWebGPUAdapter.tsx");
    expect(adapter.requiresE2E).toBe(true);
    expect(adapter.nativeGpuRequired).toBe(true);

    const seam = await resolveCheckedInOwnerSelection([
      "src/render/webgpu/groundGlassWebGpuTestSeam.ts",
    ]);
    expect(seam.ownerIds).toContain("webgpu-test-seam");
    expect(seam.tests).toEqual([]);
    expect(seam.fullVitest).toBe(true);
    expect(seam.incomplete).toBe(true);
    expect(seam.requiresE2E).toBe(true);
    expect(seam.nativeGpuRequired).toBe(true);
  });

  it("preserves active M7 Unit ownership and unions it with precise WebGPU owners", async () => {
    const evidencePath = "src/render/webgpu/groundGlassM7eGatherB1Evidence.ts";
    const evidence = await resolveCheckedInOwnerSelection([evidencePath]);
    expect(evidence.ownerIds).toContain("historical-active-unit-contracts");
    expect(evidence.ownerIds).toContain("webgpu-source-supplement");
    expect(evidence.tests).toContain("src/tests/unit/groundGlassM7eGatherB1Evidence.test.ts");
    expect(evidence.incomplete).toBe(false);
    expect(evidence.nativeGpuRequired).toBe(false);
    expect(evidence.requiresE2E).toBe(false);

    const mappedUnion = await resolveCheckedInOwnerSelection([
      "src/render/webgpu/groundGlassB1Reference.ts",
      "src/render/webgpu/groundGlassWebGpuRuntime.ts",
    ]);
    expect(mappedUnion.tests).toContain("src/tests/unit/groundGlassWebGpuB1Reference.test.ts");
    expect(mappedUnion.tests).toContain("src/tests/unit/groundGlassWebGpuRuntime.test.ts");
    expect(new Set(mappedUnion.tests).size).toBe(mappedUnion.tests.length);
    expect(mappedUnion.incomplete).toBe(false);

    const mixed = await resolveCheckedInOwnerSelection([
      "src/render/webgpu/groundGlassB1Reference.ts",
      "src/render/webgpu/groundGlassWebGpuRuntime.ts",
      "src/render/webgpu/newUnmappedReference.ts",
    ]);
    expect(mixed.ownerIds).toEqual(expect.arrayContaining([
      "webgpu-b1-reference",
      "webgpu-runtime-classification",
      "webgpu-source-supplement",
      "render-source-supplement",
    ]));
    expect(mixed.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "src/render/webgpu/groundGlassB1Reference.ts",
        owner: "webgpu-b1-reference",
      }),
      expect.objectContaining({
        path: "src/render/webgpu/groundGlassWebGpuRuntime.ts",
        owner: "webgpu-runtime-classification",
      }),
    ]));
    expect(mixed.provisionalPaths).toContain("src/render/webgpu/newUnmappedReference.ts");
    expect(mixed.fullVitest).toBe(true);
    expect(mixed.incomplete).toBe(true);
    expect(mixed.tests).toEqual([]);
  });

  it("does not let broad renderer or infrastructure matches establish complete affected ownership", async () => {
    const renderer = await resolveCheckedInOwnerSelection(["src/render/newSharedSurface.ts"]);
    expect(renderer.ownerIds).toEqual(["render-source-supplement"]);
    expect(renderer.provisionalPaths).toEqual(["src/render/newSharedSurface.ts"]);
    expect(renderer.fullVitest).toBe(true);
    expect(renderer.incomplete).toBe(true);
    expect(renderer.tests).toEqual([]);

    const script = await resolveCheckedInOwnerSelection(["scripts/sharedEvidenceHelper.mjs"]);
    expect(script.ownerIds).toEqual(["ci-and-test-infrastructure"]);
    expect(script.provisionalPaths).toEqual(["scripts/sharedEvidenceHelper.mjs"]);
    expect(script.fullLocalCi).toBe(true);
    expect(script.fullVitest).toBe(true);
    expect(script.incomplete).toBe(true);
  });

  it("combines owners without duplicate tests and fails closed on stale test references", async () => {
    const mappedUnion = await resolveCheckedInOwnerSelection([
      "src/render/groundGlassFrameExecution.ts",
      "scripts/evaluateM7mSceneReadiness.ts",
    ]);
    expect(new Set(mappedUnion.tests).size).toBe(mappedUnion.tests.length);
    expect(mappedUnion.tests).toContain("src/tests/unit/groundGlassFrameExecution.test.ts");
    expect(mappedUnion.tests).toContain("src/tests/unit/groundGlassM7mSceneReadiness.test.ts");

    const combined = await resolveCheckedInOwnerSelection([
      "src/render/table-tilt/TableTiltStudioFurnishings.ts",
      "src/render/groundGlassFrameExecution.ts",
      "scripts/evaluateM7mSceneReadiness.ts",
    ]);
    expect(combined.ownerIds).toEqual(expect.arrayContaining([
      "table-tilt-mounted-geometry",
      "renderer-lifecycle",
      "historical-active-unit-contracts",
    ]));
    expect(combined.provisionalPaths).toContain("src/render/table-tilt/TableTiltStudioFurnishings.ts");
    expect(combined.fullVitest).toBe(true);
    expect(combined.incomplete).toBe(true);
    expect(combined.tests).toEqual([]);

    const stale = await resolveCheckedInOwnerSelection(
      ["src/render/table-tilt/TableTiltStudioFurnishings.ts"],
      (file) => file !== "src/tests/unit/tableTiltMountedVisibility.test.ts" && existsSync(path.join(process.cwd(), file)),
    );
    expect(stale.staleTests).toContain("src/tests/unit/tableTiltMountedVisibility.test.ts");
    expect(stale.fullVitest).toBe(true);
    expect(stale.incomplete).toBe(true);
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
  it("reports Table Tilt mounted coverage and missing browser proof from an actual affected runner report", async () => {
    const furnishing = "src/render/table-tilt/TableTiltStudioFurnishings.ts";
    const fixture = await makeLocalCiRunnerFixture([furnishing]);
    const result = await executeLocalCi(fixture, ["--mode=affected", "--base", fixture.base]);

    expect(result.exitCode).toBe(2);
    expect(result.report.status).toBe("INCOMPLETE");
    expect(result.report.execution.completeForRequestedScope).toBe(false);
    expect(result.report.execution.changedFiles).toEqual([furnishing]);
    expect(result.report.execution.owners).toContain("table-tilt-mounted-geometry");
    expect(result.report.execution.selectedTestFiles).toEqual(["Vitest configured discovery"]);
    expect(result.report.steps.find((step: { runner: string }) => step.runner === "vitest").counts.files)
      .toContain("src/tests/unit/tableTiltMountedVisibility.test.ts");
    expect(result.report.execution.e2eCoverage.required).toEqual([{
      file: "src/tests/e2e/table-tilt.spec.ts",
      owners: ["table-tilt-mounted-geometry"],
    }]);
    expect(result.report.execution.e2eCoverage.scheduled).toEqual([]);
    expect(result.report.execution.e2eCoverage.verified).toEqual([]);
    expect(result.report.execution.e2eCoverage.missingRequired.map((contract: { file: string }) => contract.file))
      .toEqual(["src/tests/e2e/table-tilt.spec.ts"]);
  });

  it("keeps Table Tilt affected coverage incomplete after browser proof while furnishing layout remains provisional", async () => {
    const furnishing = "src/render/table-tilt/TableTiltStudioFurnishings.ts";
    const fixture = await makeLocalCiRunnerFixture([furnishing]);
    const result = await executeLocalCi(fixture, [
      "--mode=affected",
      "--base",
      fixture.base,
      "--with-e2e",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.report.status).toBe("INCOMPLETE");
    expect(result.report.execution.completeForRequestedScope).toBe(false);
    expect(result.report.execution.changedFiles).toEqual([furnishing]);
    expect(result.report.execution.owners).toContain("table-tilt-mounted-geometry");
    expect(result.report.execution.fallback).toMatchObject({
      kind: "full-vitest",
      provisionalPaths: [furnishing],
    });
    expect(result.report.execution.selectedTestFiles).toEqual(["Vitest configured discovery"]);
    expect(result.report.steps.find((step: { runner: string }) => step.runner === "vitest").status).toBe("PASS");
    expect(result.report.steps.find((step: { runner: string }) => step.runner === "vitest").counts.files)
      .toContain("src/tests/unit/tableTiltMountedVisibility.test.ts");
    expect(result.report.execution.e2eCoverage).toMatchObject({
      required: [{ file: "src/tests/e2e/table-tilt.spec.ts" }],
      scheduled: ["src/tests/e2e/table-tilt.spec.ts"],
      executed: ["src/tests/e2e/table-tilt.spec.ts"],
      verified: ["src/tests/e2e/table-tilt.spec.ts"],
      missingRequired: [],
      status: "PASS",
    });
  });

  it("keeps an unmapped renderer source incomplete after broad fallback Vitest passes", async () => {
    const changed = "src/render/newSharedSurface.ts";
    const fixture = await makeLocalCiRunnerFixture([changed]);
    const result = await executeLocalCi(fixture, ["--mode=affected", "--base", fixture.base]);

    expect(result.exitCode).toBe(2);
    expect(result.report.status).toBe("INCOMPLETE");
    expect(result.report.execution.completeForRequestedScope).toBe(false);
    expect(result.report.execution.changedFiles).toEqual([changed]);
    expect(result.report.execution.owners).toEqual(["render-source-supplement"]);
    expect(result.report.execution.fallback).toMatchObject({
      kind: "full-vitest",
      provisionalPaths: [changed],
      unknownPaths: [],
    });
    expect(result.report.steps).toHaveLength(1);
    expect(result.report.steps[0]).toMatchObject({
      runner: "vitest",
      mode: "full",
      status: "PASS",
      testFilesSelected: ["Vitest configured discovery"],
    });
    expect(result.report.limitations.join(" ")).toContain("Only provisional ownership matched");
  });

  it("reports direct B1 reference coverage as complete without scheduling native GPU qualification", async () => {
    const changed = "src/render/webgpu/groundGlassB1Reference.ts";
    const fixture = await makeLocalCiRunnerFixture([changed]);
    const result = await executeLocalCi(fixture, ["--mode=affected", "--base", fixture.base]);

    expect(result.exitCode).toBe(0);
    expect(result.report.status).toBe("PASS");
    expect(result.report.execution.completeForRequestedScope).toBe(true);
    expect(result.report.execution.changedFiles).toEqual([changed]);
    expect(result.report.execution.owners).toContain("webgpu-b1-reference");
    expect(result.report.execution.owners).not.toContain("webgpu-lifecycle");
    expect(result.report.execution.fallback).toBeNull();
    expect(result.report.execution.selectedTestFiles).toContain("src/tests/unit/groundGlassWebGpuB1Reference.test.ts");
    expect(result.report.execution.selectedTestFiles).toContain("src/tests/unit/groundGlassM7eGatherB1Evidence.test.ts");
    expect(result.report.execution.e2eCoverage).toMatchObject({
      required: [],
      scheduled: [],
      missingRequired: [],
      status: "NOT_REQUIRED",
    });
    expect(result.report.steps).toHaveLength(1);
    expect(result.report.steps[0]).toMatchObject({
      runner: "vitest",
      mode: "affected",
      status: "PASS",
    });
    expect(result.report.steps[0].counts.files).toContain("src/tests/unit/groundGlassWebGpuB1Reference.test.ts");
  });

  it("keeps unknown WebGPU ownership incomplete after the full Vitest fallback passes", async () => {
    const changed = "src/render/webgpu/newUnmappedReference.ts";
    const fixture = await makeLocalCiRunnerFixture([changed]);
    const result = await executeLocalCi(fixture, ["--mode=affected", "--base", fixture.base]);

    expect(result.exitCode).toBe(2);
    expect(result.report.status).toBe("INCOMPLETE");
    expect(result.report.execution.completeForRequestedScope).toBe(false);
    expect(result.report.execution.changedFiles).toEqual([changed]);
    expect(result.report.execution.owners).toContain("webgpu-source-supplement");
    expect(result.report.execution.fallback).toMatchObject({
      kind: "full-vitest",
      provisionalPaths: [changed],
      unknownPaths: [],
    });
    expect(result.report.execution.selectedTestFiles).toEqual(["Vitest configured discovery"]);
    expect(result.report.steps).toHaveLength(1);
    expect(result.report.steps[0]).toMatchObject({
      runner: "vitest",
      mode: "full",
      status: "PASS",
      testFilesSelected: ["Vitest configured discovery"],
    });
    expect(result.report.limitations.join(" ")).toContain("Only provisional ownership matched");
  });

  it("reports unknown M7 implementations as incomplete after their real affected-runner fallback passes", async () => {
    const changed = "src/render/webgpu/groundGlassM7zNewEvidence.ts";
    const fixture = await makeLocalCiRunnerFixture([changed]);
    const result = await executeLocalCi(fixture, ["--mode=affected", "--base", fixture.base]);

    expect(result.exitCode).toBe(2);
    expect(result.report.status).toBe("INCOMPLETE");
    expect(result.report.execution.completeForRequestedScope).toBe(false);
    expect(result.report.execution.changedFiles).toEqual([changed]);
    expect(result.report.execution.owners).toEqual(expect.arrayContaining([
      "historical-active-unit-contracts",
      "webgpu-source-supplement",
      "render-source-supplement",
    ]));
    expect(result.report.execution.selectionReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: changed, owner: "historical-active-unit-contracts" }),
      expect.objectContaining({ path: changed, owner: "webgpu-source-supplement" }),
    ]));
    expect(result.report.execution.fallback).toMatchObject({
      kind: "full-vitest",
      provisionalPaths: [changed],
      unknownPaths: [],
    });
    expect(result.report.execution.selectedTestFiles).toEqual(["Vitest configured discovery"]);
    expect(result.report.steps).toMatchObject([
      { runner: "vitest", mode: "full", status: "PASS", testFilesSelected: ["Vitest configured discovery"] },
    ]);
    expect(result.report.limitations.join(" ")).toContain("Only provisional ownership matched");
  });

  it("keeps active historical Unit contracts visible in the full Local CI report", async () => {
    const changed = "scripts/evaluateM7mSceneReadiness.ts";
    const fixture = await makeLocalCiRunnerFixture([changed]);
    const result = await executeLocalCi(fixture, ["--mode=affected", "--base", fixture.base]);

    expect(result.exitCode).toBe(0);
    expect(result.report.status).toBe("PASS");
    expect(result.report.execution.completeForRequestedScope).toBe(true);
    expect(result.report.execution.owners).toEqual(expect.arrayContaining([
      "historical-active-unit-contracts",
      "historical-m7m-scene-readiness",
      "ci-and-test-infrastructure",
    ]));
    expect(result.report.execution.fallback).toBeNull();
    expect(result.report.execution.selectionReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: changed, owner: "historical-m7m-scene-readiness" }),
    ]));
    expect(result.report.execution.repositoryCoverage).toBe("full-local-ci");
    expect(result.report.execution.selectedTestFiles).toEqual(["Vitest configured discovery"]);
    expect(result.report.steps.map((step: { id: string; status: string }) => [step.id, step.status])).toEqual([
      ["css-structure", "PASS"],
      ["lint", "PASS"],
      ["typecheck", "PASS"],
      ["full-vitest", "PASS"],
      ["application-build", "PASS"],
    ]);
    expect(result.report.steps.find((step: { runner: string }) => step.runner === "vitest").counts.files)
      .toContain("src/tests/unit/groundGlassM7mSceneReadiness.test.ts");
  });

  it("keeps a mixed reviewed and unknown M7 report incomplete despite passing full Local CI steps", async () => {
    const b1Reference = "src/render/webgpu/groundGlassB1Reference.ts";
    const evaluator = "scripts/evaluateM7mSceneReadiness.ts";
    const unknown = "src/render/webgpu/groundGlassM7zNewEvidence.ts";
    const fixture = await makeLocalCiRunnerFixture([b1Reference, evaluator, unknown]);
    const result = await executeLocalCi(fixture, ["--mode=affected", "--base", fixture.base]);

    expect(result.exitCode).toBe(2);
    expect(result.report.status).toBe("INCOMPLETE");
    expect(result.report.execution.completeForRequestedScope).toBe(false);
    expect(result.report.execution.changedFiles).toEqual([evaluator, b1Reference, unknown].sort());
    expect(result.report.execution.owners).toEqual(expect.arrayContaining([
      "webgpu-b1-reference",
      "historical-m7m-scene-readiness",
      "historical-active-unit-contracts",
      "webgpu-source-supplement",
    ]));
    expect(result.report.execution.selectionReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: b1Reference, owner: "webgpu-b1-reference" }),
      expect.objectContaining({ path: evaluator, owner: "historical-m7m-scene-readiness" }),
      expect.objectContaining({ path: unknown, owner: "historical-active-unit-contracts" }),
    ]));
    expect(result.report.execution.fallback).toMatchObject({
      kind: "full-vitest",
      provisionalPaths: [unknown],
      unknownPaths: [],
    });
    expect(result.report.execution.selectedTestFiles).toEqual(["Vitest configured discovery"]);
    expect(result.report.steps.map((step: { id: string; status: string }) => [step.id, step.status])).toEqual([
      ["css-structure", "PASS"],
      ["lint", "PASS"],
      ["typecheck", "PASS"],
      ["full-vitest", "PASS"],
      ["application-build", "PASS"],
    ]);
  });

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
    await writeFile(path.join(directory, "deleted-source.ts"), "export const removed = true;\n");
    await writeFixtureFile(directory, "src/render/table-tilt/OldFurnishing.ts", "export const furnishing = true;\n");
    git(["add", "tracked.txt", "deleted-source.ts", "src/render/table-tilt/OldFurnishing.ts"]);
    git(["commit", "--quiet", "-m", "base"]);
    const base = resolveCommit(directory, "HEAD");
    expect(() => resolveCommit(directory, "missing-ref")).toThrow();
    const clean = await snapshotSourceState(directory);
    expect(clean.clean).toBe(true);

    await writeFile(path.join(directory, "tracked.txt"), baseContents.replace("stable line 3", "changed line 3"));
    git(["mv", "tracked.txt", "renamed.txt"]);
    git(["mv", "src/render/table-tilt/OldFurnishing.ts", "src/render/table-tilt/NewFurnishing.ts"]);
    git(["rm", "deleted-source.ts"]);
    await writeFile(path.join(directory, "new-source.ts"), "export const value = 1;\n");
    await writeFixtureFile(directory, "src/render/table-tilt/AddedFurnishing.ts", "export const added = true;\n");
    const changed = await snapshotSourceState(directory);
    expect(changed.clean).toBe(false);
    expect(changed.untracked).toEqual(["new-source.ts", "src/render/table-tilt/AddedFurnishing.ts"]);
    expect(changed.fingerprint).not.toBe(clean.fingerprint);
    const changedPaths = listChangedPaths(directory, base);
    expect(changedPaths).toEqual([
      "deleted-source.ts",
      "new-source.ts",
      "renamed.txt",
      "src/render/table-tilt/AddedFurnishing.ts",
      "src/render/table-tilt/NewFurnishing.ts",
      "src/render/table-tilt/OldFurnishing.ts",
      "tracked.txt",
    ]);
    const renameSelection = await resolveCheckedInOwnerSelection(changedPaths);
    expect(renameSelection.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "src/render/table-tilt/OldFurnishing.ts", owner: "table-tilt-mounted-geometry" }),
      expect.objectContaining({ path: "src/render/table-tilt/NewFurnishing.ts", owner: "table-tilt-mounted-geometry" }),
      expect.objectContaining({ path: "src/render/table-tilt/AddedFurnishing.ts", owner: "table-tilt-mounted-geometry" }),
    ]));
    expect(renameSelection.incomplete).toBe(true);
    expect(renameSelection.unknownPaths).toContain("deleted-source.ts");

    await writeFile(path.join(directory, "new-source.ts"), "export const value = 2;\n");
    const editedUntracked = await snapshotSourceState(directory);
    expect(editedUntracked.fingerprint).not.toBe(changed.fingerprint);

    await writeFile(path.join(directory, "renamed.txt"), Buffer.from([0xff, 0xfe, 0x00, 0x80]));
    const binaryEdit = await snapshotSourceState(directory);
    expect(binaryEdit.fingerprint).not.toBe(editedUntracked.fingerprint);
  });
});
