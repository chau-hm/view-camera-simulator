import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const CHECK_ONLY = process.argv.includes("--check");
const PROMOTION_MESSAGE = "Merge origin/main into production";

class GitCommandError extends Error {
  constructor(args, result) {
    const status = result.status === null ? `signal ${result.signal}` : `exit ${result.status}`;
    const details = [result.error?.message, result.stderr?.trim(), result.stdout?.trim()]
      .filter(Boolean)
      .join("\n");
    super(`git ${args.join(" ")} failed (${status})${details ? `:\n${details}` : "."}`);
    this.name = "GitCommandError";
    this.args = args;
    this.status = result.status;
    this.signal = result.signal;
    this.stderr = result.stderr ?? "";
    this.stdout = result.stdout ?? "";
    this.spawnError = result.error;
  }
}

class PromotionError extends Error {
  constructor(category, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "PromotionError";
    this.category = category;
  }
}

function runGit(args, { cwd, env = process.env } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0) {
    throw new GitCommandError(args, result);
  }

  return result.stdout.trim();
}

function runGitResult(args, { cwd, env = process.env } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw new GitCommandError(args, result);
  }

  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function requireGitResult(args, result) {
  if (result.status !== 0) {
    throw new GitCommandError(args, result);
  }
  return result.stdout.trim();
}

function remoteSha(ref, repoRoot) {
  const args = ["ls-remote", "--exit-code", "origin", ref];
  const result = runGitResult(args, { cwd: repoRoot });

  if (result.status === 2 && !result.stdout.trim()) {
    throw new PromotionError(
      "BLOCKED_REMOTE_REF_MISMATCH",
      `Remote origin does not advertise ${ref}. Confirm that the expected branch exists before retrying.`,
    );
  }
  if (result.status !== 0) {
    throw new GitCommandError(args, result);
  }

  const [sha] = result.stdout.trim().split(/\s+/);
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i.test(sha ?? "")) {
    throw new PromotionError(
      "BLOCKED_REMOTE_REF_MISMATCH",
      `Could not resolve ${ref} to a commit SHA on origin. Check the remote response and retry.`,
    );
  }
  return sha;
}

function assertEqual(actual, expected, category, message) {
  if (actual !== expected) {
    throw new PromotionError(category, `${message}\nexpected: ${expected}\nactual:   ${actual}`);
  }
}

function isAncestor(ancestor, descendant, repoRoot) {
  const args = ["merge-base", "--is-ancestor", ancestor, descendant];
  const result = runGitResult(args, { cwd: repoRoot });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new GitCommandError(args, result);
}

function verifyRecordedCommit(sha, ref, repoRoot) {
  const args = ["cat-file", "-t", sha];
  const result = runGitResult(args, { cwd: repoRoot });
  if (result.status !== 0) {
    throw new PromotionError(
      "BLOCKED_INCOMPLETE_HISTORY",
      `The recorded ${ref} commit ${sha} is not available locally. The fetch completed, but its commit object is missing. Check the configured fetch refspec and Git object availability, then rerun preflight.\n${new GitCommandError(args, result).message}`,
    );
  }
  if (result.stdout.trim() !== "commit") {
    throw new PromotionError(
      "BLOCKED_REMOTE_REF_MISMATCH",
      `The recorded ${ref} SHA ${sha} resolves to a ${result.stdout.trim() || "non-commit object"}, not a commit. Promotion requires branch refs that point to commits.`,
    );
  }
}

function fetchedTrackingSha(trackingRef, authoritativeRef, authoritativeSha, repoRoot) {
  const args = ["rev-parse", "--verify", trackingRef];
  const result = runGitResult(args, { cwd: repoRoot });
  if (result.status !== 0) {
    throw new PromotionError(
      "BLOCKED_REMOTE_REF_MISMATCH",
      `Fetched tracking ref ${trackingRef} is unavailable locally, while ${authoritativeRef} resolves on origin to ${authoritativeSha}. Check the fetch refspec and rerun preflight.\n${new GitCommandError(args, result).message}`,
    );
  }
  return result.stdout.trim();
}

function verifyReachableObjectConnectivity(mainSha, productionSha, repoRoot) {
  const args = [
    "fsck",
    "--connectivity-only",
    "--no-reflogs",
    "--no-progress",
    mainSha,
    productionSha,
  ];
  const result = runGitResult(args, { cwd: repoRoot });
  if (result.status === 0) return;

  const failure = new GitCommandError(args, result);
  const missingObject = /missing (?:blob|tree|commit|tag)|broken link from|bad object|unable to read|failed to traverse/i
    .test(`${result.stderr}\n${result.stdout}`);
  if (missingObject) {
    throw new PromotionError(
      "BLOCKED_INCOMPLETE_HISTORY",
      `Git found missing or unreadable objects while checking the recorded release histories. Restore complete Git objects, then rerun preflight.\n${failure.message}`,
    );
  }
  throw new PromotionError(
    "BLOCKED_GIT_COMMAND_FAILURE",
    `Git could not validate object connectivity for the recorded release histories. This does not establish that the branches are unrelated. Inspect the Git diagnostic and retry after correcting the repository or Git failure.\n${failure.message}`,
  );
}

function commonAncestors(mainSha, productionSha, repoRoot) {
  const args = ["merge-base", "--all", mainSha, productionSha];
  const result = runGitResult(args, { cwd: repoRoot });

  if (result.status === 1) {
    throw new PromotionError(
      "BLOCKED_NO_COMMON_ANCESTOR",
      `Git found no common ancestor between recorded origin/main ${mainSha} and origin/production ${productionSha}. The reachable object graphs were checked and no missing-object diagnostic was reported. Confirm the remote refs and repository history; promotion stopped without attempting an unrelated-history merge.`,
    );
  }
  if (result.status !== 0) {
    throw new GitCommandError(args, result);
  }

  const bases = result.stdout.trim().split(/\s+/).filter(Boolean);
  if (bases.length === 0) {
    throw new PromotionError(
      "BLOCKED_GIT_COMMAND_FAILURE",
      `git merge-base returned success without a common ancestor for ${mainSha} and ${productionSha}. Promotion stopped because the graph result was inconsistent.`,
    );
  }
  return bases;
}

function countOnly(source, other, repoRoot) {
  const args = ["rev-list", "--count", source, `^${other}`];
  const count = runGit(args, { cwd: repoRoot });
  if (!/^\d+$/.test(count)) {
    throw new PromotionError(
      "BLOCKED_GIT_COMMAND_FAILURE",
      `Git returned an invalid commit count for ${source} against ${other}: ${count}`,
    );
  }
  return Number(count);
}

function validateRecordedRemoteState(repoRoot) {
  const originUrl = runGit(["remote", "get-url", "origin"], { cwd: repoRoot });
  if (!originUrl) throw new Error("Remote 'origin' is not configured.");

  console.log(`Repository: ${repoRoot}`);
  console.log(`Origin:     ${originUrl}`);
  console.log("Fetching origin...");
  const fetchArgs = ["fetch", "origin", "--prune"];
  const fetchResult = runGitResult(fetchArgs, { cwd: repoRoot });
  requireGitResult(fetchArgs, fetchResult);
  outputGitResult(fetchResult);

  const mainSha = remoteSha("refs/heads/main", repoRoot);
  const productionSha = remoteSha("refs/heads/production", repoRoot);
  const mainTrackingRef = "refs/remotes/origin/main";
  const productionTrackingRef = "refs/remotes/origin/production";
  const fetchedMain = fetchedTrackingSha(
    mainTrackingRef,
    "origin/main",
    mainSha,
    repoRoot,
  );
  const fetchedProduction = fetchedTrackingSha(
    productionTrackingRef,
    "origin/production",
    productionSha,
    repoRoot,
  );

  assertEqual(
    fetchedMain,
    mainSha,
    "BLOCKED_REMOTE_REF_MISMATCH",
    `Fetched ${mainTrackingRef} does not match the authoritative origin/main ref.`,
  );
  assertEqual(
    fetchedProduction,
    productionSha,
    "BLOCKED_REMOTE_REF_MISMATCH",
    `Fetched ${productionTrackingRef} does not match the authoritative origin/production ref.`,
  );

  console.log(`origin/main:       ${mainSha}`);
  console.log(`origin/production: ${productionSha}`);

  const shallow = runGitResult(["rev-parse", "--is-shallow-repository"], { cwd: repoRoot });
  const shallowValue = requireGitResult(["rev-parse", "--is-shallow-repository"], shallow);
  if (shallowValue === "true") {
    throw new PromotionError(
      "BLOCKED_SHALLOW_HISTORY",
      `This repository is shallow, so its local commit graph is incomplete. Preflight cannot distinguish missing ancestry from unrelated histories or safely test the merge. Recover history manually with \`git fetch --unshallow origin\`, then rerun \`npm run promote:preflight\`. No automatic unshallow was attempted.`,
    );
  }
  if (shallowValue !== "false") {
    throw new PromotionError(
      "BLOCKED_GIT_COMMAND_FAILURE",
      `Git returned an unexpected shallow-repository status: ${shallowValue}`,
    );
  }

  verifyRecordedCommit(mainSha, "origin/main", repoRoot);
  verifyRecordedCommit(productionSha, "origin/production", repoRoot);
  verifyReachableObjectConnectivity(mainSha, productionSha, repoRoot);
  const commonBases = commonAncestors(mainSha, productionSha, repoRoot);
  const mainContainedInProduction = isAncestor(mainSha, productionSha, repoRoot);
  const productionAncestorOfMain = isAncestor(productionSha, mainSha, repoRoot);
  const mainOnly = countOnly(mainSha, productionSha, repoRoot);
  const productionOnly = countOnly(productionSha, mainSha, repoRoot);
  const diverged = !mainContainedInProduction && !productionAncestorOfMain;

  const state = {
    mainSha,
    productionSha,
    commonBases,
    mainOnly,
    productionOnly,
    mainContainedInProduction,
    productionAncestorOfMain,
    diverged,
  };
  reportRelationship(state);
  return state;
}

function reportRelationship(state) {
  console.log(`Common ancestor${state.commonBases.length === 1 ? "" : "s"}: ${state.commonBases.join(", ")}`);
  console.log(`Main-only commits:       ${state.mainOnly}`);
  console.log(`Production-only commits: ${state.productionOnly}`);
  console.log(`main contained in production: ${state.mainContainedInProduction ? "yes" : "no"}`);
  console.log(`production is an ancestor of main: ${state.productionAncestorOfMain ? "yes" : "no"}`);
  console.log(`branches diverged: ${state.diverged ? "yes" : "no"}`);
}

function outputGitResult(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function unresolvedPaths(worktreeDir) {
  const args = ["ls-files", "--unmerged", "-z"];
  const result = runGitResult(args, { cwd: worktreeDir });
  const output = requireGitResult(args, result);
  if (!output) return [];

  return [...new Set(output.split("\0").filter(Boolean).map((entry) => entry.slice(entry.indexOf("\t") + 1)))];
}

function verifyMergeResult(mainSha, productionSha, mergedSha, worktreeDir) {
  if (!isAncestor(mainSha, mergedSha, worktreeDir)) {
    throw new PromotionError(
      "BLOCKED_GIT_COMMAND_FAILURE",
      "The merge result does not contain the recorded origin/main commit.",
    );
  }
  if (!isAncestor(productionSha, mergedSha, worktreeDir)) {
    throw new PromotionError(
      "BLOCKED_GIT_COMMAND_FAILURE",
      "The merge result does not contain the recorded origin/production commit.",
    );
  }
}

function runPromotionMerge(state, repoRoot, temporaryDirectory) {
  console.log(`Creating isolated worktree: ${temporaryDirectory}`);
  runGit(["worktree", "add", "--detach", temporaryDirectory, state.productionSha], { cwd: repoRoot });

  console.log("Merging the recorded origin/main commit into the recorded production commit...");
  const mergeArgs = [
    "-c",
    "rerere.enabled=false",
    "merge",
    "--no-ff",
    "-m",
    PROMOTION_MESSAGE,
    state.mainSha,
  ];
  const mergeResult = runGitResult(mergeArgs, { cwd: temporaryDirectory });
  if (mergeResult.status !== 0) {
    outputGitResult(mergeResult);
    const conflicts = unresolvedPaths(temporaryDirectory);
    if (conflicts.length > 0) {
      throw new PromotionError(
        "BLOCKED_MERGE_CONFLICT",
        `The recorded commits cannot be merged without conflict. Resolve the conflict through the normal release process and rerun preflight. Conflicting paths: ${conflicts.join(", ")}`,
      );
    }
    throw new GitCommandError(mergeArgs, mergeResult);
  }
  outputGitResult(mergeResult);

  const mergedSha = runGit(["rev-parse", "HEAD"], { cwd: temporaryDirectory });
  verifyMergeResult(state.mainSha, state.productionSha, mergedSha, temporaryDirectory);
  return mergedSha;
}

function worktreeIsRegistered(repoRoot, worktreeDir) {
  const args = ["worktree", "list", "--porcelain", "-z"];
  const result = runGitResult(args, { cwd: repoRoot });
  const output = requireGitResult(args, result);
  const expectedPath = canonicalPath(worktreeDir);
  const registeredPaths = output
    .split("\0")
    .filter((field) => field.startsWith("worktree "))
    .map((field) => field.slice("worktree ".length));
  return registeredPaths.some((registeredPath) => canonicalPath(registeredPath) === expectedPath);
}

function canonicalPath(path) {
  let unresolvedPath = resolve(path);
  const unresolvedSuffix = [];

  while (true) {
    try {
      return join(realpathSync.native(unresolvedPath), ...unresolvedSuffix);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;

      const parent = dirname(unresolvedPath);
      if (parent === unresolvedPath) throw error;
      unresolvedSuffix.unshift(basename(unresolvedPath));
      unresolvedPath = parent;
    }
  }
}

function cleanupTemporaryDirectory(repoRoot, temporaryDirectory) {
  if (repoRoot && worktreeIsRegistered(repoRoot, temporaryDirectory)) {
    runGit(["worktree", "remove", "--force", temporaryDirectory], { cwd: repoRoot });
  }

  if (existsSync(temporaryDirectory)) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }

  if (repoRoot && worktreeIsRegistered(repoRoot, temporaryDirectory)) {
    throw new Error(`Temporary worktree registration remains after cleanup: ${temporaryDirectory}`);
  }
}

function formatFailure(error) {
  if (error instanceof PromotionError) {
    const cause = error.cause instanceof Error ? `\n${error.cause.message}` : "";
    return `${error.category}: ${error.message}${cause}`;
  }
  if (error instanceof GitCommandError) {
    return `BLOCKED_GIT_COMMAND_FAILURE: ${error.message}`;
  }
  return `BLOCKED_GIT_COMMAND_FAILURE: ${error?.message ?? error}`;
}

function main() {
  let repoRoot = null;
  let temporaryDirectory = null;
  let successfulStatus = null;

  try {
    repoRoot = runGit(["rev-parse", "--show-toplevel"]);
    const state = validateRecordedRemoteState(repoRoot);

    if (state.mainContainedInProduction) {
      successfulStatus = {
        kind: "NO_PROMOTION_NEEDED",
        message: "NO_PROMOTION_NEEDED: origin/main is already contained in origin/production.",
      };
      return;
    }

    temporaryDirectory = mkdtempSync(join(tmpdir(), "view-camera-production-"));
    const mergedSha = runPromotionMerge(state, repoRoot, temporaryDirectory);

    if (CHECK_ONLY) {
      successfulStatus = {
        kind: "PROMOTION_READY",
        message: [
          `PROMOTION_READY: recorded origin/main ${state.mainSha} can be merged into recorded origin/production ${state.productionSha}.`,
          "The disposable merge was not published. Future promotion is not guaranteed because remote refs and repository conditions can change.",
        ].join("\n"),
      };
      return;
    }

    const mainPrePush = remoteSha("refs/heads/main", repoRoot);
    const productionPrePush = remoteSha("refs/heads/production", repoRoot);
    assertEqual(
      mainPrePush,
      state.mainSha,
      "BLOCKED_REMOTE_REF_CHANGED",
      "origin/main changed during promotion; aborting before publication.",
    );
    assertEqual(
      productionPrePush,
      state.productionSha,
      "BLOCKED_REMOTE_REF_CHANGED",
      "origin/production changed during promotion; aborting before publication.",
    );

    console.log(`Publishing ${mergedSha} to refs/heads/production...`);
    try {
      runGit(["push", "origin", "HEAD:refs/heads/production"], { cwd: temporaryDirectory });
    } catch (error) {
      throw new PromotionError(
        "BLOCKED_PUBLICATION_FAILED",
        `The production push failed. Inspect origin/production before retrying because the remote outcome must be checked directly.\n${error.message}`,
      );
    }
    try {
      const mainAfter = remoteSha("refs/heads/main", repoRoot);
      const productionAfter = remoteSha("refs/heads/production", repoRoot);
      assertEqual(
        mainAfter,
        state.mainSha,
        "PROMOTION_PUBLISHED_VERIFICATION_FAILED",
        `origin/main changed after the production push. Published commit: ${mergedSha}.`,
      );
      assertEqual(
        productionAfter,
        mergedSha,
        "PROMOTION_PUBLISHED_VERIFICATION_FAILED",
        `origin/production does not match the promoted commit after publication. Expected ${mergedSha}, found ${productionAfter}.`,
      );
      successfulStatus = {
        kind: "PROMOTION_VERIFIED",
        mergedSha,
        message: [
          "PROMOTION_VERIFIED: production publication matches the recorded merge result.",
          `origin/main unchanged: ${mainAfter}`,
          `origin/production:      ${productionAfter}`,
        ].join("\n"),
      };
    } catch (error) {
      throw new PromotionError(
        "PROMOTION_PUBLISHED_VERIFICATION_FAILED",
        `The push command completed, but post-publication verification failed. Production publication may already have occurred; inspect both remote refs before retrying.\n${error.message}`,
      );
    }
  } catch (error) {
    console.error(formatFailure(error));
    process.exitCode = 1;
  } finally {
    if (temporaryDirectory) {
      try {
        cleanupTemporaryDirectory(repoRoot, temporaryDirectory);
      } catch (cleanupError) {
        if (successfulStatus?.kind === "PROMOTION_VERIFIED") {
          console.error(`PROMOTION_VERIFIED_BUT_CLEANUP_FAILED: Production publication succeeded and was verified at ${successfulStatus.mergedSha}. Temporary local worktree cleanup failed for ${temporaryDirectory}: ${cleanupError?.message ?? cleanupError}`);
        } else if (successfulStatus?.kind === "PROMOTION_READY") {
          console.error(`BLOCKED_TEMPORARY_WORKTREE_CLEANUP: The recorded commits were merge-compatible, but preflight did not complete because temporary local worktree cleanup failed for ${temporaryDirectory}: ${cleanupError?.message ?? cleanupError}. No remote publication was attempted.`);
        } else {
          console.error(`BLOCKED_TEMPORARY_WORKTREE_CLEANUP: failed to remove this invocation's temporary worktree ${temporaryDirectory}: ${cleanupError?.message ?? cleanupError}`);
        }
        process.exitCode = 1;
      }
    }

    if (successfulStatus && process.exitCode === undefined) {
      console.log(successfulStatus.message);
      process.exitCode = 0;
    }
  }
}

main();
