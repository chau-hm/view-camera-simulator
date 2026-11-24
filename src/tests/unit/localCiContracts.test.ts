import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  matchesOwnerPath,
  compareTestFileSelection,
  parseLocalCiArgs,
  parsePlaywrightJsonReport,
  parseVitestJsonReport,
  resolveOwnerSelection,
  validateSelectedTestPaths,
} from "../../../scripts/local-ci/selection.mjs";
import {
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
    expect(parsePlaywrightJsonReport({ suites: [{ specs: [{ file: "a.spec.ts" }, { file: "b.spec.ts" }] }], stats: { expected: 8, skipped: 2, unexpected: 1, flaky: 1, duration: 4000 } })).toEqual({
      discoveredFiles: 2,
      discoveredCases: 12,
      executedCases: 10,
      passed: 9,
      failed: 1,
      skipped: 2,
      flaky: 1,
      durationMs: 4000,
      files: ["a.spec.ts", "b.spec.ts"],
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
    expect(() => parsePlaywrightJsonReport({ suites: [], stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0 } })).toThrow("missing discovered spec file paths");
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
