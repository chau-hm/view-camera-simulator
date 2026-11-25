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
  const verificationPaths = [];
  let forceFullHistory = false;
  let forceRetainedRef = false;
  for (const argument of process.argv.slice(2)) {
    if (argument === "--force-main-history") {
      if (forceFullHistory) throw new Error("Duplicate option: --force-main-history");
      forceFullHistory = true;
      continue;
    }
    if (argument === "--force-retained-ref") {
      if (forceRetainedRef) throw new Error("Duplicate option: --force-retained-ref");
      forceRetainedRef = true;
      continue;
    }
    const match = argument.match(/^--(sha|remote|main-ref|retained-ref|verify-path)=(.+)$/);
    if (!match || (match[1] !== "verify-path" && values.has(match[1]))) {
      throw new Error(`Unsupported option: ${argument}`);
    }
    if (match[1] === "verify-path") {
      const path = match[2].replaceAll("\\", "/");
      if (!path || path.startsWith("/") || path.split("/").some((part) => !part || part === "." || part === "..") || path.includes(":")) {
        throw new Error(`Invalid --verify-path: ${match[2]}`);
      }
      verificationPaths.push(path);
      continue;
    }
    values.set(match[1], match[2]);
  }
  const sha = values.get("sha");
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) throw new Error("--sha must be a full lowercase commit SHA");
  const retainedRef = values.get("retained-ref");
  if (retainedRef && (!retainedRef.startsWith("refs/") ||
      run(["check-ref-format", retainedRef], { allowFailure: true }).status !== 0)) {
    throw new Error("--retained-ref must be a valid fully-qualified Git ref");
  }
  if (forceFullHistory && retainedRef) throw new Error("--force-main-history cannot be combined with --retained-ref");
  if (forceRetainedRef && !retainedRef) throw new Error("--force-retained-ref requires --retained-ref");
  if (forceFullHistory && forceRetainedRef) throw new Error("Only one forced fallback option may be used");
  return {
    sha,
    remote: values.get("remote") ?? "origin",
    mainRef: values.get("main-ref") ?? "refs/heads/main",
    retainedRef,
    verificationPaths: [...new Set(verificationPaths)],
    forceFullHistory,
    forceRetainedRef,
  };
};

const hasCommit = (sha, cwd) => run(["cat-file", "-e", `${sha}^{commit}`], { cwd, allowFailure: true }).status === 0;
const missingVerificationPaths = (sha, paths, cwd) => paths.filter((path) =>
  run(["cat-file", "-e", `${sha}:${path}`], { cwd, allowFailure: true }).status !== 0);

const fetchPinnedSource = ({
  sha,
  remote,
  mainRef,
  retainedRef,
  verificationPaths,
  cwd = process.cwd(),
  forceFullHistory = false,
  forceRetainedRef = false,
}) => {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Pinned source SHA must be a full lowercase commit SHA");
  const verify = (method) => {
    if (!hasCommit(sha, cwd)) return null;
    const missingPaths = missingVerificationPaths(sha, verificationPaths, cwd);
    if (missingPaths.length) {
      throw new Error(`Pinned M7K source ${sha} is missing verified tree path(s): ${missingPaths.join(", ")}`);
    }
    return method;
  };
  const existing = verify("already-present");
  if (existing) return existing;

  let exactFetchError = "exact commit fetch was skipped";
  if (!forceFullHistory && !forceRetainedRef) {
    const exactFetch = run(["fetch", "--no-tags", remote, sha], { cwd, allowFailure: true });
    exactFetchError = exactFetch.stderr.trim() || `git fetch exited ${exactFetch.status}`;
    if (exactFetch.status === 0) {
      const fetched = verify("exact-commit-fetch");
      if (fetched) return fetched;
    }
  }

  const shallowResult = run(["rev-parse", "--is-shallow-repository"], { cwd });
  const fallbackRef = retainedRef ?? mainRef;
  const fullHistoryArgs = shallowResult.stdout.trim() === "true"
    ? ["fetch", "--unshallow", "--no-tags", remote, fallbackRef]
    : ["fetch", "--no-tags", remote, fallbackRef];
  const fallback = run(fullHistoryArgs, { cwd, allowFailure: true });
  const fallbackMethod = retainedRef ? "retained-ref-history-fallback" : "full-main-history-fallback";
  if (fallback.status === 0) {
    const fetched = verify(fallbackMethod);
    if (fetched) return fetched;
  }
  if (fallback.status !== 0 || !hasCommit(sha, cwd)) {
    const fallbackError = fallback.stderr.trim() || `git ${fullHistoryArgs.join(" ")} exited ${fallback.status}`;
    const fallbackLabel = retainedRef ? `retained-ref ${retainedRef} history fallback` : "full main-history fallback";
    throw new Error(
      `Pinned M7K source ${sha} is unavailable after exact fetch and ${fallbackLabel}. ` +
      `Exact fetch: ${exactFetchError}. Fallback fetch: ${fallbackError}`,
    );
  }
  throw new Error(`Pinned M7K source ${sha} failed final verification after ${fallbackMethod}`);
};

try {
  const options = parseArgs();
  const method = fetchPinnedSource(options);
  const paths = options.verificationPaths.length ? `; verified paths: ${options.verificationPaths.join(", ")}` : "";
  process.stdout.write(`Pinned M7K source ${options.sha} available (${method})${paths}.\n`);
} catch (error) {
  process.stderr.write(`M7K source fetch failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
