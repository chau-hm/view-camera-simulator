import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHECK_ONLY = process.argv.includes("--check");

function run(args, { cwd, inherit = false } = {}) {
  const output = execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  });
  return inherit ? "" : output.trim();
}

function remoteSha(ref) {
  const output = run(["ls-remote", "--exit-code", "origin", ref]);
  const sha = output.split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error(`Could not resolve ${ref} on origin.`);
  }
  return sha;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nexpected: ${expected}\nactual:   ${actual}`);
  }
}

function isAncestor(ancestor, descendant, cwd) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd,
      stdio: "ignore",
    });
    return true;
  } catch (error) {
    if (error?.status === 1) return false;
    throw error;
  }
}

const repoRoot = run(["rev-parse", "--show-toplevel"]);
let worktreeDir = null;

try {
  const originUrl = run(["remote", "get-url", "origin"], { cwd: repoRoot });
  if (!originUrl) throw new Error("Remote 'origin' is not configured.");

  console.log(`Repository: ${repoRoot}`);
  console.log(`Origin:     ${originUrl}`);
  console.log("Fetching origin...");
  run(["fetch", "origin", "--prune"], { cwd: repoRoot, inherit: true });

  const mainBefore = remoteSha("refs/heads/main");
  const productionBefore = remoteSha("refs/heads/production");
  const fetchedMain = run(["rev-parse", "refs/remotes/origin/main"], { cwd: repoRoot });
  const fetchedProduction = run(["rev-parse", "refs/remotes/origin/production"], { cwd: repoRoot });

  assertEqual(fetchedMain, mainBefore, "Fetched origin/main does not match the remote main ref.");
  assertEqual(
    fetchedProduction,
    productionBefore,
    "Fetched origin/production does not match the remote production ref.",
  );

  console.log(`origin/main:       ${mainBefore}`);
  console.log(`origin/production: ${productionBefore}`);

  if (isAncestor(mainBefore, productionBefore, repoRoot)) {
    console.log("No promotion needed: origin/main is already contained in origin/production.");
    process.exit(0);
  }

  if (CHECK_ONLY) {
    console.log("Promotion needed. --check specified, so no merge or push was performed.");
    process.exit(0);
  }

  worktreeDir = mkdtempSync(join(tmpdir(), "view-camera-production-"));
  console.log(`Creating isolated worktree: ${worktreeDir}`);
  run(["worktree", "add", "--detach", worktreeDir, productionBefore], {
    cwd: repoRoot,
    inherit: true,
  });

  console.log("Merging the recorded origin/main commit into the recorded production commit...");
  run(
    ["merge", "--no-ff", "-m", "Merge origin/main into production", mainBefore],
    { cwd: worktreeDir, inherit: true },
  );

  const promotedHead = run(["rev-parse", "HEAD"], { cwd: worktreeDir });
  if (!isAncestor(mainBefore, promotedHead, worktreeDir)) {
    throw new Error("Promotion result does not contain the recorded origin/main commit.");
  }
  if (!isAncestor(productionBefore, promotedHead, worktreeDir)) {
    throw new Error("Promotion result does not contain the recorded origin/production commit.");
  }

  const mainPrePush = remoteSha("refs/heads/main");
  const productionPrePush = remoteSha("refs/heads/production");
  assertEqual(mainPrePush, mainBefore, "origin/main changed during promotion; aborting.");
  assertEqual(
    productionPrePush,
    productionBefore,
    "origin/production changed during promotion; aborting.",
  );

  console.log(`Publishing ${promotedHead} to refs/heads/production...`);
  run(["push", "origin", "HEAD:refs/heads/production"], {
    cwd: worktreeDir,
    inherit: true,
  });

  const mainAfter = remoteSha("refs/heads/main");
  const productionAfter = remoteSha("refs/heads/production");
  assertEqual(mainAfter, mainBefore, "origin/main changed during production publication.");
  assertEqual(
    productionAfter,
    promotedHead,
    "origin/production does not match the promoted commit after publication.",
  );

  console.log("Production promotion verified.");
  console.log(`origin/main unchanged: ${mainAfter}`);
  console.log(`origin/production:      ${productionAfter}`);
} catch (error) {
  console.error(`Production promotion failed: ${error?.message ?? error}`);
  process.exitCode = 1;
} finally {
  if (worktreeDir) {
    try {
      run(["worktree", "remove", "--force", worktreeDir], { cwd: repoRoot, inherit: true });
    } catch (cleanupError) {
      console.error(`Warning: failed to remove temporary worktree ${worktreeDir}: ${cleanupError?.message ?? cleanupError}`);
      process.exitCode = 1;
    }
  }
}
