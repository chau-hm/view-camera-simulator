import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const pilotsDirectory = new URL("./pilots/", import.meta.url);
const usage = "Usage: npm run dream-loop:guard -- --pilot <pilot-id> --base <iteration-baseline-commit>";

const parseArgs = (args) => {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg !== "--pilot" && arg !== "--base") throw new Error("Unknown argument: " + arg);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error("Missing value for " + arg);
    options[arg.slice(2)] = value;
    index += 1;
  }
  if (!options.pilot || !options.base) throw new Error(usage);
  return options;
};

const git = (args, cwd) =>
  execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });

const gitText = (args, cwd) => git(args, cwd).toString("utf8").trim();
const nulSeparated = (buffer) => buffer.toString("utf8").split("\0").filter(Boolean);

const matchesPathPattern = (pattern, path) => {
  if (pattern.endsWith("/**")) return path.startsWith(pattern.slice(0, -2));
  if (pattern.endsWith("*")) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
};

const isInsidePilotScope = (manifest, path) => {
  if (path.startsWith("/") || path.split("/").includes("..")) return false;
  if (manifest.writeScope.protectedPaths.some((pattern) => matchesPathPattern(pattern, path))) {
    return false;
  }
  return manifest.writeScope.allowedPaths.some((pattern) => matchesPathPattern(pattern, path));
};

const resolveManifest = async (pilotId) => {
  if (!/^[a-z0-9-]+$/.test(pilotId)) throw new Error("Invalid pilot id: " + pilotId);
  const path = new URL(pilotId + ".json", pilotsDirectory);
  const manifest = JSON.parse(await readFile(path, "utf8"));
  if (
    manifest.pilotId !== pilotId ||
    typeof manifest.sceneId !== "string" ||
    typeof manifest.assetKey !== "string" ||
    !Array.isArray(manifest.writeScope?.allowedPaths) ||
    !Array.isArray(manifest.writeScope?.protectedPaths)
  ) {
    throw new Error("Pilot manifest is incomplete or mismatched: " + fileURLToPath(path));
  }
  return manifest;
};

const collectChangedPaths = (baseCommit, repositoryRoot) => {
  const tracked = nulSeparated(
    git(["diff", "--name-only", "--no-renames", "-z", baseCommit, "--"], repositoryRoot),
  );
  const untracked = nulSeparated(
    git(["ls-files", "--others", "--exclude-standard", "-z"], repositoryRoot),
  );
  return [...new Set([...tracked, ...untracked])].sort();
};

const run = async () => {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage);
      return 0;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  try {
    const manifest = await resolveManifest(options.pilot);
    const repositoryRoot = gitText(["rev-parse", "--show-toplevel"], process.cwd());
    const baseCommit = gitText(["rev-parse", "--verify", options.base + "^{commit}"], repositoryRoot);
    const headCommit = gitText(["rev-parse", "HEAD"], repositoryRoot);
    execFileSync("git", ["merge-base", "--is-ancestor", baseCommit, headCommit], {
      cwd: repositoryRoot,
      stdio: "ignore",
    });

    const changedPaths = collectChangedPaths(baseCommit, repositoryRoot);
    const forbidden = changedPaths.filter((path) => !isInsidePilotScope(manifest, path));
    if (forbidden.length > 0) {
      console.error("Dream Loop write-scope guard failed for pilot " + JSON.stringify(manifest.pilotId) + ".");
      console.error("Forbidden paths:");
      for (const path of forbidden) console.error("  - " + path);
      console.error("No files were modified or restored by the guard.");
      return 1;
    }

    console.log(
      "Dream Loop write-scope guard passed for " +
        manifest.pilotId +
        ": " +
        changedPaths.length +
        " changed path(s) within the declared pilot scope.",
    );
    return 0;
  } catch (error) {
    if (error?.status === 1) {
      console.error("Iteration baseline is not an ancestor of the current HEAD: " + options.base);
      return 2;
    }
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Dream Loop write-scope guard could not verify the workspace: " + detail);
    return 2;
  }
};

process.exitCode = await run();
