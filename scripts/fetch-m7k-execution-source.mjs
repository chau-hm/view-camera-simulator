import { spawnSync } from "node:child_process";

const run = (args, { cwd = process.cwd(), allowFailure = false } = {}) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const parseArgs = () => {
  const values = new Map();
  let forceFullHistory = false;
  for (const argument of process.argv.slice(2)) {
    if (argument === "--force-main-history") {
      if (forceFullHistory) throw new Error("Duplicate option: --force-main-history");
      forceFullHistory = true;
      continue;
    }
    const match = argument.match(/^--(sha|remote|main-ref)=(.+)$/);
    if (!match || values.has(match[1])) throw new Error(`Unsupported option: ${argument}`);
    values.set(match[1], match[2]);
  }
  const sha = values.get("sha");
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) throw new Error("--sha must be a full lowercase commit SHA");
  return {
    sha,
    remote: values.get("remote") ?? "origin",
    mainRef: values.get("main-ref") ?? "refs/heads/main",
    forceFullHistory,
  };
};

const hasCommit = (sha, cwd) => run(["cat-file", "-e", `${sha}^{commit}`], { cwd, allowFailure: true }).status === 0;

const fetchPinnedSource = ({ sha, remote, mainRef, cwd = process.cwd(), forceFullHistory = false }) => {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Pinned source SHA must be a full lowercase commit SHA");
  if (hasCommit(sha, cwd)) return "already-present";

  let exactFetchError = "exact commit fetch was skipped";
  if (!forceFullHistory) {
    const exactFetch = run(["fetch", "--no-tags", remote, sha], { cwd, allowFailure: true });
    exactFetchError = exactFetch.stderr.trim() || `git fetch exited ${exactFetch.status}`;
    if (exactFetch.status === 0 && hasCommit(sha, cwd)) return "exact-commit-fetch";
  }

  const shallowResult = run(["rev-parse", "--is-shallow-repository"], { cwd });
  const fullHistoryArgs = shallowResult.stdout.trim() === "true"
    ? ["fetch", "--unshallow", "--no-tags", remote, mainRef]
    : ["fetch", "--no-tags", remote, mainRef];
  const fallback = run(fullHistoryArgs, { cwd, allowFailure: true });
  if (fallback.status !== 0 || !hasCommit(sha, cwd)) {
    const fallbackError = fallback.stderr.trim() || `git ${fullHistoryArgs.join(" ")} exited ${fallback.status}`;
    throw new Error(
      `Pinned M7K source ${sha} is unavailable after exact fetch and full main-history fallback. ` +
      `Exact fetch: ${exactFetchError}. Full-history fetch: ${fallbackError}`,
    );
  }
  return "full-main-history-fallback";
};

try {
  const options = parseArgs();
  const method = fetchPinnedSource(options);
  process.stdout.write(`Pinned M7K source ${options.sha} available (${method}).\n`);
} catch (error) {
  process.stderr.write(`M7K source fetch failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
