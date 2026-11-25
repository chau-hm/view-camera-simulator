import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "scripts/promote-production.mjs");
const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
const fixtureRoots: string[] = [];

type FixtureKind = "identical" | "main-contained" | "production-ancestor" | "clean-divergence" | "conflict" | "unrelated";
type HookMode = "fail-worktree-add" | "fail-merge" | "move-main-after-fetch" | "move-production-before-push" | "move-production-after-push";

interface Fixture {
  root: string;
  remote: string;
  seed: string;
  clone: string;
  temporary: string;
  mainSha: string;
  productionSha: string;
  alternateMainSha: string;
  alternateProductionSha: string;
}

function run(cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function git(cwd: string, args: string[]): string {
  const result = run(cwd, args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed (${result.status}):\n${result.stderr}\n${result.stdout}`);
  }
  return result.stdout.trim();
}

function commitFile(directory: string, fileName: string, contents: string, message: string): string {
  writeFileSync(join(directory, fileName), contents);
  git(directory, ["add", "-A"]);
  git(directory, ["commit", "--quiet", "-m", message]);
  return git(directory, ["rev-parse", "HEAD"]);
}

function createFixture(kind: FixtureKind = "clean-divergence", { shallow = false }: { shallow?: boolean } = {}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "production-promotion-fixture-"));
  fixtureRoots.push(root);
  const remote = join(root, "origin.git");
  const seed = join(root, "seed");
  const clone = join(root, "clone");
  const temporary = join(root, "script-tmp");

  mkdirSync(seed, { recursive: true });
  mkdirSync(temporary, { recursive: true });
  git(root, ["init", "--bare", remote]);
  git(seed, ["init", "-b", "main"]);
  git(seed, ["config", "user.name", "Promotion Fixture"]);
  git(seed, ["config", "user.email", "promotion-fixture@example.invalid"]);

  commitFile(seed, "shared.txt", "base\n", "shared base");
  commitFile(seed, "working.txt", "clean\n", "working tree fixture");
  const graphBase = git(seed, ["rev-parse", "HEAD"]);
  let mainSha = graphBase;
  let productionSha = graphBase;

  if (kind === "unrelated") {
    git(seed, ["checkout", "--orphan", "production"]);
    git(seed, ["rm", "-rf", "--ignore-unmatch", "."]);
    rmSync(join(seed, "shared.txt"), { force: true });
    rmSync(join(seed, "working.txt"), { force: true });
    productionSha = commitFile(seed, "unrelated.txt", "separate root\n", "unrelated production root");
    git(seed, ["checkout", "main"]);
    mainSha = git(seed, ["rev-parse", "HEAD"]);
  } else {
    git(seed, ["checkout", "-b", "production"]);
    if (kind === "main-contained") {
      productionSha = commitFile(seed, "production.txt", "production only\n", "production advances");
      git(seed, ["checkout", "main"]);
      mainSha = graphBase;
    } else if (kind === "production-ancestor") {
      productionSha = graphBase;
      git(seed, ["checkout", "main"]);
      mainSha = commitFile(seed, "main.txt", "main only\n", "main advances");
    } else if (kind === "conflict") {
      commitFile(seed, "shared.txt", "production edit\n", "production edit");
      productionSha = git(seed, ["rev-parse", "HEAD"]);
      git(seed, ["checkout", "main"]);
      commitFile(seed, "shared.txt", "main edit\n", "main edit");
      mainSha = git(seed, ["rev-parse", "HEAD"]);
    } else if (kind === "identical") {
      productionSha = graphBase;
      git(seed, ["checkout", "main"]);
      mainSha = graphBase;
    } else {
      productionSha = commitFile(seed, "production.txt", "production change\n", "production change");
      git(seed, ["checkout", "main"]);
      mainSha = commitFile(seed, "main.txt", "main change\n", "main change");
    }
  }

  git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "--quiet", "origin", "main", "production"]);
  git(root, ["--git-dir", remote, "symbolic-ref", "HEAD", "refs/heads/main"]);

  let alternateMainSha = mainSha;
  let alternateProductionSha = productionSha;
  if (kind === "clean-divergence") {
    git(seed, ["checkout", "-b", "test-alternate-main", "main"]);
    alternateMainSha = commitFile(seed, "alternate-main.txt", "later main\n", "later main");
    git(seed, ["push", "--quiet", "origin", "test-alternate-main"]);

    git(seed, ["checkout", "-b", "test-alternate-production", "production"]);
    alternateProductionSha = commitFile(seed, "alternate-production.txt", "later production\n", "later production");
    git(seed, ["push", "--quiet", "origin", "test-alternate-production"]);
  }

  const cloneArgs = ["clone", "--no-local"];
  if (shallow) cloneArgs.push("--depth=1", "--no-single-branch");
  cloneArgs.push(pathToFileURL(remote).href, clone);
  const cloned = run(root, cloneArgs);
  if (cloned.status !== 0) throw new Error(`git clone failed: ${cloned.stderr}`);
  git(clone, ["config", "user.name", "Promotion Fixture Clone"]);
  git(clone, ["config", "user.email", "promotion-clone@example.invalid"]);
  git(clone, ["branch", "production", "refs/remotes/origin/production"]);
  git(clone, ["branch", "preservation-check", "refs/remotes/origin/main"]);

  if (kind !== "unrelated") {
    writeFileSync(join(clone, "working.txt"), "staged change\n");
    git(clone, ["add", "working.txt"]);
    writeFileSync(join(clone, "working.txt"), "unstaged change\n");
  }

  return {
    root,
    remote,
    seed,
    clone,
    temporary,
    mainSha,
    productionSha,
    alternateMainSha,
    alternateProductionSha,
  };
}

function remoteRefSnapshot(remote: string): string {
  return git(remote, ["for-each-ref", "--format=%(refname) %(objectname)", "refs/heads"]);
}

function localBranchSnapshot(clone: string): string {
  return git(clone, ["for-each-ref", "--format=%(refname) %(objectname)", "refs/heads"]);
}

function worktreeSnapshot(clone: string): string {
  return git(clone, ["worktree", "list", "--porcelain"]);
}

function repositorySnapshot(fixture: Fixture) {
  const index = readFileSync(join(fixture.clone, ".git", "index"));
  return {
    remoteRefs: remoteRefSnapshot(fixture.remote),
    localBranches: localBranchSnapshot(fixture.clone),
    status: git(fixture.clone, ["status", "--porcelain=v1", "--untracked-files=all"]),
    stagedDiff: git(fixture.clone, ["diff", "--cached", "--binary"]),
    unstagedDiff: git(fixture.clone, ["diff", "--binary"]),
    indexSha256: createHash("sha256").update(index).digest("hex"),
    workingContents: readFileSync(join(fixture.clone, "working.txt"), "utf8"),
    worktrees: worktreeSnapshot(fixture.clone),
  };
}

function installGitHook(fixture: Fixture, mode: HookMode): NodeJS.ProcessEnv {
  const shimDirectory = join(fixture.root, "git-shim");
  const stateFile = join(fixture.root, "git-hook-state.json");
  const wrapper = join(shimDirectory, "git");
  mkdirSync(shimDirectory, { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ lsRemoteCount: 0 }));
  writeFileSync(wrapper, `#!/usr/bin/env node
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const realGit = process.env.PROMOTION_TEST_REAL_GIT;
const args = process.argv.slice(2);
const mode = process.env.PROMOTION_TEST_HOOK;
const command = args[0] === "-c" ? args[2] : args[0];
const call = (nextArgs) => spawnSync(realGit, nextArgs, { encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "pipe"] });
const relay = (result) => {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.status === null ? 1 : result.status;
};
const updateRef = (ref, sha) => {
  const result = call(["--git-dir", process.env.PROMOTION_TEST_REMOTE, "update-ref", ref, sha]);
  if (result.status !== 0) {
    process.stderr.write(result.stderr || "failed to update disposable remote ref\\n");
    process.exit(90);
  }
};

if (mode === "fail-worktree-add" && args[0] === "worktree" && args[1] === "add") {
  process.stderr.write("injected disposable worktree creation failure\\n");
  process.exit(71);
}
if (mode === "fail-merge" && command === "merge") {
  process.stderr.write("injected unexpected merge command failure\\n");
  process.exit(72);
}
if (mode === "move-main-after-fetch" && args[0] === "fetch") {
  const result = call(args);
  if (result.status === 0) updateRef("refs/heads/main", process.env.PROMOTION_TEST_ALTERNATE_SHA);
  relay(result);
  return;
}
if (mode === "move-production-before-push" && args[0] === "ls-remote") {
  const result = call(args);
  const state = JSON.parse(fs.readFileSync(process.env.PROMOTION_TEST_HOOK_STATE, "utf8"));
  state.lsRemoteCount += 1;
  fs.writeFileSync(process.env.PROMOTION_TEST_HOOK_STATE, JSON.stringify(state));
  if (state.lsRemoteCount === 3) {
    updateRef("refs/heads/production", process.env.PROMOTION_TEST_ALTERNATE_SHA);
  }
  relay(result);
  return;
}
if (mode === "move-production-after-push" && args[0] === "push") {
  const result = call(args);
  if (result.status === 0) updateRef("refs/heads/production", process.env.PROMOTION_TEST_ALTERNATE_SHA);
  relay(result);
  return;
}
relay(call(args));
`);
  chmodSync(wrapper, 0o755);

  return {
    PATH: `${shimDirectory}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
    PROMOTION_TEST_REAL_GIT: realGit,
    PROMOTION_TEST_HOOK: mode,
    PROMOTION_TEST_HOOK_STATE: stateFile,
    PROMOTION_TEST_REMOTE: fixture.remote,
    PROMOTION_TEST_ALTERNATE_SHA: mode === "move-main-after-fetch" ? fixture.alternateMainSha : fixture.alternateProductionSha,
    TMPDIR: fixture.temporary,
    TMP: fixture.temporary,
    TEMP: fixture.temporary,
  };
}

function runPromotion(fixture: Fixture, args: string[] = ["--", "--check"], hook?: HookMode) {
  const env = {
    ...process.env,
    TMPDIR: fixture.temporary,
    TMP: fixture.temporary,
    TEMP: fixture.temporary,
    ...(hook ? installGitHook(fixture, hook) : {}),
  };
  const result = spawnSync(process.execPath, [scriptPath, ...args], { cwd: fixture.clone, env, encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    temporaryEntries: [] as string[],
  };
}

function withTemporaryEntries(fixture: Fixture, result: ReturnType<typeof runPromotion>) {
  const temporaryPath = result.output.match(/Creating isolated worktree: ([^\r\n]+)/)?.[1];
  const remainingPaths = temporaryPath && existsSync(temporaryPath) ? [temporaryPath] : [];
  remainingPaths.push(...readdirSync(fixture.temporary).map((entry) => join(fixture.temporary, entry)));
  return { ...result, temporaryEntries: remainingPaths };
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("production promotion safety", () => {
  it.each([
    ["identical refs", "identical" as const, [] as string[], "NO_PROMOTION_NEEDED"],
    ["main already contained in production", "main-contained" as const, ["--", "--check"], "NO_PROMOTION_NEEDED"],
  ])("reports a successful no-op when %s", (_label, kind, args, category) => {
    const fixture = createFixture(kind);
    const before = repositorySnapshot(fixture);
    const result = withTemporaryEntries(fixture, runPromotion(fixture, args));

    expect(result.status).toBe(0);
    expect(result.output).toContain(category);
    expect(repositorySnapshot(fixture)).toEqual(before);
    expect(result.temporaryEntries).toEqual([]);
  });

  it("reports a clean divergent merge as ready and preserves local and remote refs", () => {
    const fixture = createFixture("clean-divergence");
    const before = repositorySnapshot(fixture);
    const result = withTemporaryEntries(fixture, runPromotion(fixture));

    expect(result.status).toBe(0);
    expect(result.output).toContain("PROMOTION_READY");
    expect(result.output).toContain(`Common ancestor: ${git(fixture.seed, ["merge-base", fixture.mainSha, fixture.productionSha])}`);
    expect(result.output).toContain("Main-only commits:       1");
    expect(result.output).toContain("Production-only commits: 1");
    expect(result.output).toContain("branches diverged: yes");
    expect(result.output).toContain("Future promotion is not guaranteed");
    expect(repositorySnapshot(fixture)).toEqual(before);
    expect(result.temporaryEntries).toEqual([]);
  });

  it("accepts production as an ancestor of main", () => {
    const fixture = createFixture("production-ancestor");
    const result = withTemporaryEntries(fixture, runPromotion(fixture));

    expect(result.status).toBe(0);
    expect(result.output).toContain("PROMOTION_READY");
    expect(result.output).toContain("production is an ancestor of main: yes");
    expect(result.output).toContain("branches diverged: no");
    expect(result.temporaryEntries).toEqual([]);
  });

  it("blocks conflicting changes and preserves refs, index, and working tree", () => {
    const fixture = createFixture("conflict");
    const before = repositorySnapshot(fixture);
    const result = withTemporaryEntries(fixture, runPromotion(fixture));

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("BLOCKED_MERGE_CONFLICT");
    expect(result.output).toContain("shared.txt");
    expect(repositorySnapshot(fixture)).toEqual(before);
    expect(result.temporaryEntries).toEqual([]);
  });

  it("does not silently reuse a recorded rerere resolution", () => {
    const fixture = createFixture("conflict");
    git(fixture.clone, ["config", "rerere.enabled", "true"]);
    const resolutionWorktree = join(fixture.root, "rerere-resolution-worktree");
    git(fixture.clone, ["worktree", "add", "--detach", resolutionWorktree, fixture.productionSha]);
    const conflict = run(resolutionWorktree, ["merge", "--no-ff", "-m", "seed rerere resolution", fixture.mainSha]);
    expect(conflict.status).not.toBe(0);
    writeFileSync(join(resolutionWorktree, "shared.txt"), "manual resolution\n");
    git(resolutionWorktree, ["add", "shared.txt"]);
    git(resolutionWorktree, ["commit", "--quiet", "-m", "record rerere resolution"]);
    git(fixture.clone, ["worktree", "remove", "--force", resolutionWorktree]);

    const result = withTemporaryEntries(fixture, runPromotion(fixture));
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("BLOCKED_MERGE_CONFLICT");
    expect(result.output).toContain("shared.txt");
    expect(result.temporaryEntries).toEqual([]);
  });

  it("blocks shallow history with an actionable unshallow command before attempting a merge", () => {
    const fixture = createFixture("clean-divergence", { shallow: true });
    expect(git(fixture.clone, ["rev-parse", "--is-shallow-repository"])).toBe("true");
    const before = repositorySnapshot(fixture);
    const result = withTemporaryEntries(fixture, runPromotion(fixture, ["--check"]));

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("BLOCKED_SHALLOW_HISTORY");
    expect(result.output).toContain("git fetch --unshallow origin");
    expect(result.output).toContain("rerun `npm run promote:preflight`");
    expect(result.output).not.toContain("Creating isolated worktree");
    expect(repositorySnapshot(fixture)).toEqual(before);
    expect(result.temporaryEntries).toEqual([]);
  });

  it("distinguishes missing reachable objects from a genuinely unrelated graph", () => {
    const fixture = createFixture("clean-divergence", { shallow: true });
    rmSync(join(fixture.clone, ".git", "shallow"));
    expect(git(fixture.clone, ["rev-parse", "--is-shallow-repository"])).toBe("false");
    const result = withTemporaryEntries(fixture, runPromotion(fixture));

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("BLOCKED_INCOMPLETE_HISTORY");
    expect(result.output).toContain("missing or unreadable objects");
    expect(result.output).not.toContain("BLOCKED_NO_COMMON_ANCESTOR");
    expect(result.output).not.toContain("Creating isolated worktree");
    expect(result.temporaryEntries).toEqual([]);
  });

  it("blocks complete but genuinely unrelated histories without attempting a merge", () => {
    const fixture = createFixture("unrelated");
    expect(git(fixture.clone, ["rev-parse", "--is-shallow-repository"])).toBe("false");
    const result = withTemporaryEntries(fixture, runPromotion(fixture));

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("BLOCKED_NO_COMMON_ANCESTOR");
    expect(result.output).toContain("Git found no common ancestor");
    expect(result.output).not.toContain("Creating isolated worktree");
    expect(result.temporaryEntries).toEqual([]);
  });

  it("detects fetched refs that no longer match the authoritative remote", () => {
    const fixture = createFixture("clean-divergence");
    const result = withTemporaryEntries(fixture, runPromotion(fixture, ["--check"], "move-main-after-fetch"));

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("BLOCKED_REMOTE_REF_MISMATCH");
    expect(result.output).toContain("Fetched refs/remotes/origin/main does not match");
    expect(result.temporaryEntries).toEqual([]);
  });

  it("rechecks remote refs after the merge and blocks publication after remote movement", () => {
    const fixture = createFixture("clean-divergence");
    const result = withTemporaryEntries(fixture, runPromotion(fixture, [], "move-production-before-push"));

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("BLOCKED_REMOTE_REF_CHANGED");
    expect(result.output).toContain("aborting before publication");
    expect(git(fixture.remote, ["rev-parse", "refs/heads/production"])).toBe(fixture.alternateProductionSha);
    expect(result.temporaryEntries).toEqual([]);
  });

  it.each([
    ["worktree creation", "fail-worktree-add" as const, "injected disposable worktree creation failure"],
    ["unexpected merge command", "fail-merge" as const, "injected unexpected merge command failure"],
  ])("cleans up its temporary directory after %s failure", (_label, hook, diagnostic) => {
    const fixture = createFixture("clean-divergence");
    const before = repositorySnapshot(fixture);
    const result = withTemporaryEntries(fixture, runPromotion(fixture, ["--check"], hook));

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("BLOCKED_GIT_COMMAND_FAILURE");
    expect(result.output).toContain(diagnostic);
    expect(repositorySnapshot(fixture)).toEqual(before);
    expect(result.temporaryEntries).toEqual([]);
  });

  it("promotes successfully to a disposable remote and verifies both parent histories", () => {
    const fixture = createFixture("clean-divergence");
    const before = repositorySnapshot(fixture);
    const result = withTemporaryEntries(fixture, runPromotion(fixture, []));
    const promotedSha = git(fixture.remote, ["rev-parse", "refs/heads/production"]);

    expect(result.status).toBe(0);
    expect(result.output).toContain("PROMOTION_VERIFIED");
    expect(git(fixture.remote, ["rev-parse", "refs/heads/main"])).toBe(fixture.mainSha);
    expect(git(fixture.remote, ["merge-base", "--is-ancestor", fixture.mainSha, promotedSha])).toBe("");
    expect(git(fixture.remote, ["merge-base", "--is-ancestor", fixture.productionSha, promotedSha])).toBe("");
    expect(repositorySnapshot(fixture).localBranches).toBe(before.localBranches);
    expect(repositorySnapshot(fixture).status).toBe(before.status);
    expect(repositorySnapshot(fixture).stagedDiff).toBe(before.stagedDiff);
    expect(repositorySnapshot(fixture).unstagedDiff).toBe(before.unstagedDiff);
    expect(repositorySnapshot(fixture).indexSha256).toBe(before.indexSha256);
    expect(result.temporaryEntries).toEqual([]);
  });

  it("reports when a successful push cannot be verified afterward", () => {
    const fixture = createFixture("clean-divergence");
    const result = withTemporaryEntries(fixture, runPromotion(fixture, [], "move-production-after-push"));

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("PROMOTION_PUBLISHED_VERIFICATION_FAILED");
    expect(result.output).toContain("publication may already have occurred");
    expect(git(fixture.remote, ["rev-parse", "refs/heads/production"])).toBe(fixture.alternateProductionSha);
    expect(result.temporaryEntries).toEqual([]);
  });
});
