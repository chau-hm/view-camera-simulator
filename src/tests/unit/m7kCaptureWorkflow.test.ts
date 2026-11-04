import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const git = (cwd: string, args: string[]) => spawnSync("git", args, {
  cwd,
  encoding: "utf8",
  env: {
    ...process.env,
    GIT_AUTHOR_NAME: "M7K workflow test",
    GIT_AUTHOR_EMAIL: "m7k-workflow-test@example.invalid",
    GIT_COMMITTER_NAME: "M7K workflow test",
    GIT_COMMITTER_EMAIL: "m7k-workflow-test@example.invalid",
  },
});

describe("M7K capture workflow provenance", () => {
  it("rejects a tooling worktree reused as the execution worktree before starting browser tests", () => {
    const root = process.cwd();
    const outputDir = `.m7k-runner-collision-${process.pid}`;
    const result = spawnSync(process.execPath, [
      resolve(root, "scripts/run-m7k-broad-e2e.mjs"),
      `--execution-worktree=${root}`,
      `--output-dir=${outputDir}`,
      "--preflight-only",
    ], { cwd: root, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Tooling and execution worktrees must be separate directories");
    expect(result.stdout).not.toContain("M7K preflight passed");
  });

  it("rejects an execution worktree at the wrong commit before discovery", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "m7k-wrong-source-"));
    const wrongWorktree = join(temporaryRoot, "wrong-source");
    mkdirSync(wrongWorktree);
    try {
      expect(git(wrongWorktree, ["init", "--quiet"]).status).toBe(0);
      expect(git(wrongWorktree, ["config", "user.name", "M7K workflow test"]).status).toBe(0);
      expect(git(wrongWorktree, ["config", "user.email", "m7k-workflow-test@example.invalid"]).status).toBe(0);
      writeFileSync(join(wrongWorktree, "README.md"), "wrong execution source\n");
      expect(git(wrongWorktree, ["add", "README.md"]).status).toBe(0);
      expect(git(wrongWorktree, ["commit", "--quiet", "-m", "wrong source fixture"]).status).toBe(0);
      const outputDir = `.m7k-wrong-source-${process.pid}`;
      const result = spawnSync(process.execPath, [
        resolve(process.cwd(), "scripts/run-m7k-broad-e2e.mjs"),
        `--execution-worktree=${wrongWorktree}`,
        `--output-dir=${outputDir}`,
        "--preflight-only",
      ], { cwd: process.cwd(), encoding: "utf8" });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Execution worktree must be pinned to e6066a244510387c32995c1e973a771667b04d10");
      expect(result.stdout).not.toContain("›");
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("rejects output paths outside the tooling worktree before resolving execution", () => {
    const root = process.cwd();
    const result = spawnSync(process.execPath, [
      resolve(root, "scripts/run-m7k-broad-e2e.mjs"),
      "--execution-worktree=.",
      "--output-dir=../outside-m7k-capture",
      "--preflight-only",
    ], { cwd: root, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--output-dir must be a non-root path inside the tooling worktree");
    expect(result.stderr).not.toContain("Execution worktree");
  });

  it("refuses to overwrite an existing capture output directory", () => {
    const root = process.cwd();
    const outputDir = `.m7k-existing-output-${process.pid}`;
    const outputPath = join(root, outputDir);
    mkdirSync(outputPath);
    writeFileSync(join(outputPath, "keep.txt"), "preserve this existing output\n");
    try {
      const result = spawnSync(process.execPath, [
        resolve(root, "scripts/run-m7k-broad-e2e.mjs"),
        "--execution-worktree=.",
        `--output-dir=${outputDir}`,
        "--preflight-only",
      ], { cwd: root, encoding: "utf8" });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Output directory already exists; refusing to overwrite");
      expect(readFileSync(join(outputPath, "keep.txt"), "utf8")).toBe("preserve this existing output\n");
    } finally {
      rmSync(outputPath, { recursive: true, force: true });
    }
  });

  it("rejects a schema-v2 manifest that escapes its declared artifact directory before reading raw files", () => {
    const root = process.cwd();
    const temporaryRoot = mkdtempSync(join(tmpdir(), "m7k-path-scope-"));
    const manifestPath = join(temporaryRoot, "manifest.json");
    writeFileSync(manifestPath, `${JSON.stringify({
      schemaVersion: 2,
      outputDirectory: "docs/architecture/ground-glass-m7k-broad-e2e/review-fix-r1",
      discovery: {
        ordinary: { outputPath: "../outside.txt" },
        rendererSerial: { outputPath: "docs/architecture/ground-glass-m7k-broad-e2e/review-fix-r1/serial.txt" },
      },
      lanes: {
        ordinary: { rawReportPath: "docs/architecture/ground-glass-m7k-broad-e2e/review-fix-r1/raw.json", consolePath: "docs/architecture/ground-glass-m7k-broad-e2e/review-fix-r1/ordinary.log" },
        rendererSerial: { rawReportPath: "docs/architecture/ground-glass-m7k-broad-e2e/review-fix-r1/serial.json", consolePath: "docs/architecture/ground-glass-m7k-broad-e2e/review-fix-r1/serial.log" },
      },
    }, null, 2)}\n`);
    try {
      const result = spawnSync(process.execPath, [
        "scripts/run-m7k-qualification.mjs",
        `--capture-manifest=${manifestPath}`,
        `--report-output=${join(temporaryRoot, "report.json")}`,
      ], { cwd: root, encoding: "utf8" });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("raw and discovery artifacts must remain inside the declared output directory");
      expect(result.stderr).not.toContain("ENOENT");
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("fetches a pinned source more than 50 commits behind a depth-1 main checkout and rejects an unknown SHA", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "m7k-source-history-"));
    const sourceRepo = join(temporaryRoot, "source");
    const bareRemote = join(temporaryRoot, "remote.git");
    const shallowClone = join(temporaryRoot, "shallow");
    const exactClone = join(temporaryRoot, "exact");
    mkdirSync(sourceRepo);
    const fetchScript = resolve(process.cwd(), "scripts/fetch-m7k-execution-source.mjs");
    try {
      expect(git(sourceRepo, ["init", "--quiet"]).status).toBe(0);
      expect(git(sourceRepo, ["config", "user.name", "M7K workflow test"]).status).toBe(0);
      expect(git(sourceRepo, ["config", "user.email", "m7k-workflow-test@example.invalid"]).status).toBe(0);
      writeFileSync(join(sourceRepo, "playwright.config.ts"), "export default {};\n");
      expect(git(sourceRepo, ["add", "playwright.config.ts"]).status).toBe(0);
      expect(git(sourceRepo, ["commit", "--quiet", "-m", "pinned baseline fixture"]).status).toBe(0);
      expect(git(sourceRepo, ["branch", "-M", "main"]).status).toBe(0);
      const pinnedSha = git(sourceRepo, ["rev-parse", "HEAD"]).stdout.trim();

      expect(git(temporaryRoot, ["init", "--bare", "--quiet", bareRemote]).status).toBe(0);
      expect(git(bareRemote, ["symbolic-ref", "HEAD", "refs/heads/main"]).status).toBe(0);
      expect(git(sourceRepo, ["remote", "add", "origin", bareRemote]).status).toBe(0);
      for (let index = 0; index < 60; index += 1) {
        writeFileSync(join(sourceRepo, "history.txt"), `${index}\n`, { flag: "a" });
        expect(git(sourceRepo, ["add", "history.txt"]).status).toBe(0);
        expect(git(sourceRepo, ["commit", "--quiet", "-m", `future main commit ${index + 1}`]).status).toBe(0);
      }
      expect(git(sourceRepo, ["push", "--quiet", "origin", "main"]).status).toBe(0);

      expect(git(temporaryRoot, ["clone", "--quiet", "--depth=1", "--branch", "main", `file://${bareRemote}`, shallowClone]).status).toBe(0);
      expect(git(temporaryRoot, ["clone", "--quiet", "--depth=1", "--branch", "main", `file://${bareRemote}`, exactClone]).status).toBe(0);
      expect(git(shallowClone, ["cat-file", "-e", `${pinnedSha}^{commit}`]).status).not.toBe(0);
      expect(git(exactClone, ["cat-file", "-e", `${pinnedSha}^{commit}`]).status).not.toBe(0);
      const sourceCount = git(sourceRepo, ["rev-list", "--count", "main"]).stdout.trim();
      expect(Number(sourceCount)).toBeGreaterThan(50);

      const exactFetch = spawnSync(process.execPath, [fetchScript, `--sha=${pinnedSha}`], {
        cwd: exactClone,
        encoding: "utf8",
      });
      expect(exactFetch.status).toBe(0);
      expect(exactFetch.stdout).toContain("available (exact-commit-fetch)");
      expect(git(exactClone, ["cat-file", "-e", `${pinnedSha}:playwright.config.ts`]).status).toBe(0);

      const fullHistoryFetch = spawnSync(process.execPath, [fetchScript, `--sha=${pinnedSha}`, "--force-main-history"], {
        cwd: shallowClone,
        encoding: "utf8",
      });
      expect(fullHistoryFetch.status).toBe(0);
      expect(fullHistoryFetch.stdout).toContain("available (full-main-history-fallback)");
      expect(fullHistoryFetch.stdout).toContain(pinnedSha);
      expect(git(shallowClone, ["cat-file", "-e", `${pinnedSha}^{commit}`]).status).toBe(0);
      expect(git(shallowClone, ["cat-file", "-e", `${pinnedSha}:playwright.config.ts`]).status).toBe(0);

      const wrongSha = "f".repeat(40);
      const wrongFetch = spawnSync(process.execPath, [fetchScript, `--sha=${wrongSha}`], {
        cwd: shallowClone,
        encoding: "utf8",
      });
      expect(wrongFetch.status).toBe(1);
      expect(wrongFetch.stderr).toContain("Pinned M7K source");
      expect(git(shallowClone, ["cat-file", "-e", `${wrongSha}^{commit}`]).status).not.toBe(0);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("retrieves schema-v2 tooling from the retained PR ref after main advances and verifies exact source files", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "m7k-tooling-source-history-"));
    const sourceRepo = join(temporaryRoot, "source");
    const bareRemote = join(temporaryRoot, "remote.git");
    const exactClone = join(temporaryRoot, "exact");
    const fallbackClone = join(temporaryRoot, "fallback");
    const unavailableClone = join(temporaryRoot, "unavailable");
    mkdirSync(sourceRepo);
    const fetchScript = resolve(process.cwd(), "scripts/fetch-m7k-execution-source.mjs");
    const runnerPath = "scripts/run-m7k-broad-e2e.mjs";
    const evaluatorPath = "src/render/testing/groundGlassM7kBroadE2eQualification.ts";
    const retainedRef = "refs/pull/309/head";
    const shallowClone = (path: string): void => {
      expect(git(temporaryRoot, ["clone", "--quiet", "--depth=1", "--branch", "main", `file://${bareRemote}`, path]).status).toBe(0);
      expect(git(path, ["rev-parse", "--is-shallow-repository"]).stdout.trim()).toBe("true");
    };
    const fetchTooling = (cwd: string, extraArgs: string[] = []) => spawnSync(process.execPath, [
      fetchScript,
      `--sha=${toolingSha}`,
      `--retained-ref=${retainedRef}`,
      `--verify-path=${runnerPath}`,
      `--verify-path=${evaluatorPath}`,
      ...extraArgs,
    ], { cwd, encoding: "utf8" });
    let toolingSha = "";

    try {
      expect(git(sourceRepo, ["init", "--quiet"]).status).toBe(0);
      expect(git(sourceRepo, ["config", "user.name", "M7K workflow test"]).status).toBe(0);
      expect(git(sourceRepo, ["config", "user.email", "m7k-workflow-test@example.invalid"]).status).toBe(0);
      writeFileSync(join(sourceRepo, "execution-source.txt"), "accepted execution source\n");
      expect(git(sourceRepo, ["add", "execution-source.txt"]).status).toBe(0);
      expect(git(sourceRepo, ["commit", "--quiet", "-m", "execution source fixture"]).status).toBe(0);
      expect(git(sourceRepo, ["branch", "-M", "main"]).status).toBe(0);
      expect(git(sourceRepo, ["checkout", "-q", "-b", "tooling"]).status).toBe(0);
      mkdirSync(join(sourceRepo, "scripts"));
      mkdirSync(join(sourceRepo, "src", "render", "testing"), { recursive: true });
      writeFileSync(join(sourceRepo, runnerPath), "// retained M7K runner\n");
      writeFileSync(join(sourceRepo, evaluatorPath), "// retained M7K evaluator\n");
      expect(git(sourceRepo, ["add", runnerPath, evaluatorPath]).status).toBe(0);
      expect(git(sourceRepo, ["commit", "--quiet", "-m", "schema-v2 tooling source"]).status).toBe(0);
      toolingSha = git(sourceRepo, ["rev-parse", "HEAD"]).stdout.trim();
      for (let index = 0; index < 60; index += 1) {
        expect(git(sourceRepo, ["checkout", "-q", "main"]).status).toBe(0);
        writeFileSync(join(sourceRepo, "main-history.txt"), `${index}\n`, { flag: "a" });
        expect(git(sourceRepo, ["add", "main-history.txt"]).status).toBe(0);
        expect(git(sourceRepo, ["commit", "--quiet", "-m", `main advance ${index + 1}`]).status).toBe(0);
        if (index < 59) expect(git(sourceRepo, ["checkout", "-q", "tooling"]).status).toBe(0);
      }
      const toolingTip = git(sourceRepo, ["rev-parse", "tooling"]).stdout.trim();
      expect(git(temporaryRoot, ["init", "--bare", "--quiet", bareRemote]).status).toBe(0);
      expect(git(bareRemote, ["config", "receive.shallowUpdate", "true"]).status).toBe(0);
      expect(git(sourceRepo, ["remote", "add", "origin", bareRemote]).status).toBe(0);
      expect(git(sourceRepo, ["push", "--quiet", "origin", "main:refs/heads/main"]).status).toBe(0);
      expect(git(sourceRepo, ["push", "--quiet", "origin", `tooling:refs/heads/m7k-tooling-source`]).status).toBe(0);
      expect(git(bareRemote, ["update-ref", retainedRef, toolingTip]).status).toBe(0);
      expect(Number(git(sourceRepo, ["rev-list", "--count", "main"]).stdout.trim())).toBeGreaterThanOrEqual(61);

      shallowClone(exactClone);
      shallowClone(fallbackClone);
      shallowClone(unavailableClone);
      for (const clone of [exactClone, fallbackClone, unavailableClone]) {
        expect(git(clone, ["cat-file", "-e", `${toolingSha}^{commit}`]).status).not.toBe(0);
        expect(git(clone, ["cat-file", "-e", `${toolingSha}:${runnerPath}`]).status).not.toBe(0);
        expect(git(clone, ["cat-file", "-e", `${toolingSha}:${evaluatorPath}`]).status).not.toBe(0);
      }

      const exactFetch = fetchTooling(exactClone);
      expect(exactFetch.status).toBe(0);
      expect(exactFetch.stdout).toContain("available (exact-commit-fetch)");
      expect(git(exactClone, ["cat-file", "-e", `${toolingSha}^{commit}`]).status).toBe(0);
      expect(git(exactClone, ["cat-file", "-e", `${toolingSha}:${runnerPath}`]).status).toBe(0);
      expect(git(exactClone, ["cat-file", "-e", `${toolingSha}:${evaluatorPath}`]).status).toBe(0);

      const retainedFetch = fetchTooling(fallbackClone, ["--force-retained-ref"]);
      expect(retainedFetch.status).toBe(0);
      expect(retainedFetch.stdout).toContain("available (retained-ref-history-fallback)");
      expect(git(fallbackClone, ["cat-file", "-e", `${toolingSha}:${runnerPath}`]).status).toBe(0);
      expect(git(fallbackClone, ["cat-file", "-e", `${toolingSha}:${evaluatorPath}`]).status).toBe(0);

      const missingTreePath = spawnSync(process.execPath, [
        fetchScript,
        `--sha=${toolingSha}`,
        `--retained-ref=${retainedRef}`,
        "--verify-path=scripts/not-the-runner.mjs",
      ], { cwd: exactClone, encoding: "utf8" });
      expect(missingTreePath.status).toBe(1);
      expect(missingTreePath.stderr).toContain("missing verified tree path");

      const missingEvaluatorPath = spawnSync(process.execPath, [
        fetchScript,
        `--sha=${toolingSha}`,
        `--retained-ref=${retainedRef}`,
        "--verify-path=src/render/testing/not-the-evaluator.ts",
      ], { cwd: exactClone, encoding: "utf8" });
      expect(missingEvaluatorPath.status).toBe(1);
      expect(missingEvaluatorPath.stderr).toContain("missing verified tree path");

      const unavailableSha = "f".repeat(40);
      const unavailableFetch = spawnSync(process.execPath, [
        fetchScript,
        `--sha=${unavailableSha}`,
        `--retained-ref=${retainedRef}`,
        `--verify-path=${runnerPath}`,
      ], { cwd: unavailableClone, encoding: "utf8" });
      expect(unavailableFetch.status).toBe(1);
      expect(unavailableFetch.stderr).toContain("is unavailable after exact fetch and retained-ref");
      expect(git(unavailableClone, ["cat-file", "-e", `${unavailableSha}^{commit}`]).status).not.toBe(0);

      const fakeGitDir = join(temporaryRoot, "fake-git-bin");
      mkdirSync(fakeGitDir);
      const fakeGitPath = join(fakeGitDir, "git");
      const systemGitPath = "/usr/bin/git";
      expect(existsSync(systemGitPath)).toBe(true);
      writeFileSync(fakeGitPath, "#!/bin/sh\nif [ \"$1\" = fetch ]; then exit 0; fi\nexec /usr/bin/git \"$@\"\n");
      chmodSync(fakeGitPath, 0o755);
      const falseSuccessFetch = spawnSync(process.execPath, [
        fetchScript,
        `--sha=${unavailableSha}`,
        `--retained-ref=${retainedRef}`,
        `--verify-path=${runnerPath}`,
      ], {
        cwd: unavailableClone,
        encoding: "utf8",
        env: { ...process.env, PATH: `${fakeGitDir}${delimiter}${process.env.PATH ?? ""}` },
      });
      expect(falseSuccessFetch.status).toBe(1);
      expect(falseSuccessFetch.stderr).toContain("is unavailable after exact fetch and retained-ref");

      const malformedRetainedRef = spawnSync(process.execPath, [
        fetchScript,
        `--sha=${toolingSha}`,
        "--retained-ref=not-a-fully-qualified-ref",
      ], { cwd: unavailableClone, encoding: "utf8" });
      expect(malformedRetainedRef.status).toBe(1);
      expect(malformedRetainedRef.stderr).toContain("valid fully-qualified Git ref");

      const invalidRetainedRef = spawnSync(process.execPath, [
        fetchScript,
        `--sha=${unavailableSha}`,
        "--retained-ref=refs/pull/999/head",
        `--verify-path=${runnerPath}`,
      ], { cwd: unavailableClone, encoding: "utf8" });
      expect(invalidRetainedRef.status).toBe(1);
      expect(invalidRetainedRef.stderr).toContain("Fallback fetch");
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }, 20_000);

  it("requires the accepted schema-v1 and selected schema-v2 evidence checks in the CI job", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/pages.yml"), "utf8");
    const ciStart = workflow.indexOf("  ci:\n");
    const deployStart = workflow.indexOf("\n  deploy:", ciStart);
    expect(ciStart).toBeGreaterThanOrEqual(0);
    expect(deployStart).toBeGreaterThan(ciStart);
    const ciJob = workflow.slice(ciStart, deployStart);
    expect(workflow).toContain("  push:\n    branches:\n      - \"**\"\n");
    expect(ciJob).not.toContain("if:");
    expect(ciJob).toContain("name: Fetch M7E native capture source history");
    expect(ciJob).toContain("name: Fetch M7F native capture source history");
    expect(ciJob).toContain("name: Fetch M7J retained capture source history");
    expect(ciJob).toContain("name: Fetch M7K execution source history");
    expect(ciJob).toContain("      - name: Validate M7K accepted schema-v1 full-suite evidence integrity\n        run: npm run evidence:check:m7k\n");
    expect(ciJob).toContain("      - name: Validate M7K schema-v2 selected evidence integrity\n" +
      "        run: >-\n          npm run evidence:check:m7k --\n" +
      "          --report-path=docs/architecture/ground-glass-m7k-broad-e2e/" +
      "review-fix-r1/selected/qualification-report.json\n");
    expect(ciJob).toContain("name: Fetch M7K schema-v2 tooling and evaluator source history");
    expect(ciJob).toContain("--retained-ref=refs/pull/309/head");
    expect(ciJob).toContain("--verify-path=scripts/run-m7k-broad-e2e.mjs");
    expect(ciJob).toContain("--verify-path=src/render/testing/groundGlassM7kBroadE2eQualification.ts");
    expect(ciJob).not.toContain("continue-on-error: true");
    expect(workflow).toContain("  deploy:\n    if: github.event_name == 'push' && github.ref == 'refs/heads/production'\n    needs: ci\n");
  });
});
