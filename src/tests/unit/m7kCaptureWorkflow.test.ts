import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
});
