import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readlink } from "node:fs/promises";
import path from "node:path";

const maxUntrackedBytes = 100 * 1024 * 1024;

function git(cwd, args, options = {}) {
  return execFileSync("git", args, {
    cwd,
    encoding: options.encoding === null ? null : options.encoding ?? "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function findRepositoryRoot(cwd) {
  return git(cwd, ["rev-parse", "--show-toplevel"]).trim();
}

export function resolveCommit(cwd, revision) {
  if (!revision || revision.startsWith("-") || /[\r\n]/.test(revision)) {
    throw new Error("The comparison base must be a non-empty Git revision");
  }
  return git(cwd, ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`]).trim();
}

function parseNameStatus(output) {
  const fields = output.split("\0").filter(Boolean);
  const paths = [];
  for (let index = 0; index < fields.length; index += 1) {
    const status = fields[index];
    if (/^[RC]/.test(status)) {
      const oldPath = fields[index + 1];
      const newPath = fields[index + 2];
      if (oldPath) paths.push(oldPath);
      if (newPath) paths.push(newPath);
      index += 2;
    } else if (fields[index + 1]) {
      paths.push(fields[index + 1]);
      index += 1;
    }
  }
  return paths;
}

export function listChangedPaths(cwd, baseSha) {
  const paths = new Set();
  if (baseSha) {
    const committed = git(cwd, ["diff", "--name-status", "-z", `${baseSha}...HEAD`, "--"]);
    for (const filePath of parseNameStatus(committed)) paths.add(filePath);
  }
  const worktree = git(cwd, ["diff", "--name-status", "-z", "HEAD", "--"]);
  for (const filePath of parseNameStatus(worktree)) paths.add(filePath);
  const untracked = git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]);
  for (const filePath of untracked.split("\0").filter(Boolean)) paths.add(filePath);
  return [...paths].sort();
}

function statusEntries(cwd) {
  const output = git(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const fields = output.split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const code = field.slice(0, 2);
    const filePath = field.slice(3);
    entries.push({
      path: filePath,
      indexStatus: code[0] === " " ? "clean" : code[0],
      worktreeStatus: code[1] === " " ? "clean" : code[1],
      untracked: code === "??",
    });
    if (/^[RC]/.test(code) && fields[index + 1]) {
      entries.push({ path: fields[index + 1], indexStatus: code[0], worktreeStatus: code[1], untracked: false, renameSource: true });
      index += 1;
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function hashUntrackedFiles(cwd, entries) {
  const hash = createHash("sha256");
  const untracked = entries.filter((entry) => entry.untracked).sort((left, right) => left.path.localeCompare(right.path));
  let totalBytes = 0;
  for (const entry of untracked) {
    const filePath = path.join(cwd, entry.path);
    const metadata = await lstat(filePath);
    hash.update(entry.path);
    hash.update("\0");
    if (metadata.isSymbolicLink()) {
      hash.update("symlink\0");
      hash.update(await readlink(filePath));
    } else if (metadata.isFile()) {
      totalBytes += metadata.size;
      if (totalBytes > maxUntrackedBytes) throw new Error("Untracked source exceeds the 100 MiB fingerprint limit");
      hash.update("file\0");
      hash.update(await readFile(filePath));
    } else {
      hash.update(`special:${metadata.mode}\0`);
    }
    hash.update("\0");
  }
  return hash.digest("hex");
}

export async function snapshotSourceState(cwd) {
  const entries = statusEntries(cwd);
  const diff = git(cwd, ["diff", "--binary", "--no-ext-diff", "HEAD", "--"], { encoding: null });
  const untrackedDigest = await hashUntrackedFiles(cwd, entries);
  const hash = createHash("sha256");
  hash.update(JSON.stringify(entries));
  hash.update("\0");
  hash.update(diff);
  hash.update("\0");
  hash.update(untrackedDigest);
  const state = {
    clean: entries.length === 0,
    staged: entries.filter((entry) => !entry.untracked && entry.indexStatus !== "clean").map((entry) => entry.path),
    unstaged: entries.filter((entry) => entry.worktreeStatus !== "clean" && !entry.untracked).map((entry) => entry.path),
    untracked: entries.filter((entry) => entry.untracked).map((entry) => entry.path),
    changes: entries,
    fingerprint: hash.digest("hex"),
  };
  return state;
}

export function currentCommit(cwd) {
  return git(cwd, ["rev-parse", "--verify", "HEAD"]).trim();
}

export function currentBranch(cwd) {
  const branch = git(cwd, ["branch", "--show-current"]).trim();
  return branch || "DETACHED";
}

export function safeRepositoryIdentifier(cwd, packageName) {
  try {
    const remote = git(cwd, ["remote", "get-url", "origin"]).trim();
    const httpsMatch = remote.match(/^(?:https?:\/\/)(?:[^/@]+@)?([^/]+)\/(.+?)(?:\.git)?$/i);
    if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2].split(/[?#]/, 1)[0]}`;
    const sshMatch = remote.match(/^[^@]+@([^:]+):(.+?)(?:\.git)?$/);
    if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;
  } catch {
    // A local or unavailable origin does not prevent local validation.
  }
  return packageName ?? "unknown-repository";
}

export function runGit(cwd, args) {
  return git(cwd, args);
}
