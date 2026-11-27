import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { HISTORICAL_EVIDENCE_MANIFEST } from "./historical-evidence-routing.mjs";

// These inputs define the selected source's historical runner contract. Changes
// require a reviewed compatibility decision, not copying newer code into it.
const CONTRACT_PATHS = ["scripts/run-historical-qualification.mjs", "scripts/historical-evidence-routing.mjs", "scripts/historical-evidence-manifest.json", "scripts/historical-qualification-baseline.json", "scripts/fetch-m7k-execution-source.mjs", "package.json", "package-lock.json"];
// Narrow compatibility for this PR's routing registration only. The historical
// source runner has the same validators and pins before these paths existed.
const ALLOWED_ADDED_PATHS = new Set(["scripts/historical-source-execution.mjs", "scripts/release-artifact-qualify.mjs", "src/tests/unit/historicalSourceExecution.test.ts", "src/tests/unit/releaseArtifactQualification.test.ts"]);
const pattern = /^[a-f0-9]{40}$/;

export function compatibleHistoricalManifest(source, trusted) {
  if (!Array.isArray(source?.sharedQualificationPaths) || !Array.isArray(trusted?.sharedQualificationPaths)) return false;
  const { sharedQualificationPaths: sourcePaths, ...sourcePolicy } = source;
  const { sharedQualificationPaths: trustedPaths, ...trustedPolicy } = trusted;
  if (JSON.stringify(sourcePolicy) !== JSON.stringify(trustedPolicy)) return false;
  const oldPaths = new Set(sourcePaths), currentPaths = new Set(trustedPaths);
  return oldPaths.size === sourcePaths.length && currentPaths.size === trustedPaths.length &&
    [...oldPaths].every((path) => currentPaths.has(path)) &&
    [...currentPaths].filter((path) => !oldPaths.has(path)).every((path) => ALLOWED_ADDED_PATHS.has(path));
}

/** Executes the existing historical runner on a detached source. This is evidence, not release authorization. */
export function executeSourceValidators({ sourceSha, sourceTreeSha }, { repositoryRoot = process.cwd(), run = spawnSync, tempRoot = tmpdir() } = {}) {
  if (!pattern.test(sourceSha ?? "") || !pattern.test(sourceTreeSha ?? "")) throw new Error("source-execution-identity-invalid");
  const root = resolve(repositoryRoot);
  const call = (command, args, cwd, env = process.env) => {
    const result = run(command, args, { cwd, env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 600_000 });
    if (result.error || result.status !== 0 || result.signal) throw new Error(`${command}-failed:${result.error?.message ?? result.signal ?? result.status}:${(result.stderr ?? "").slice(-1000)}`);
    return result.stdout ?? "";
  };
  const git = (args, cwd = root) => call("git", args, cwd).trim();
  if (git(["rev-parse", `${sourceSha}^{tree}`]) !== sourceTreeSha) throw new Error("source-execution-tree-mismatch");
  const contract = {};
  for (const path of CONTRACT_PATHS) {
    const sourceBlob = git(["rev-parse", `${sourceSha}:${path}`]);
    const trustedBlob = git(["rev-parse", `HEAD:${path}`]);
    if (sourceBlob !== trustedBlob) {
      if (path !== "scripts/historical-evidence-manifest.json" || !compatibleHistoricalManifest(
        JSON.parse(call("git", ["show", `${sourceSha}:${path}`], root)),
        JSON.parse(call("git", ["show", `HEAD:${path}`], root)),
      )) throw new Error(`source-execution-incompatible-contract:${path}`);
    }
    contract[path] = sourceBlob;
  }
  const temp = mkdtempSync(join(tempRoot, "vcs-source-validation-"));
  const checkout = join(temp, "source");
  const reportPath = join(temp, "report.json");
  let added = false;
  try {
    const checkoutStart = Date.now();
    git(["worktree", "add", "--detach", checkout, sourceSha]);
    added = true;
    if (git(["rev-parse", "HEAD"], checkout) !== sourceSha || git(["rev-parse", "HEAD^{tree}"], checkout) !== sourceTreeSha || git(["status", "--porcelain"], checkout)) throw new Error("source-execution-checkout-mismatch");
    const checkoutMs = Date.now() - checkoutStart;
    const env = { ...process.env, CI: "false", HISTORICAL_QUALIFICATION_RESULT_PATH: reportPath };
    for (const key of ["GITHUB_OUTPUT", "GITHUB_STEP_SUMMARY", "GITHUB_STATE", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN", "ACTIONS_RUNTIME_URL", "ACTIONS_CACHE_URL"]) delete env[key];
    const installStart = Date.now();
    const installEnv = { ...env };
    for (const key of Object.keys(installEnv)) {
      if (["GITHUB_TOKEN", "GH_TOKEN", "GIT_CONFIG_COUNT"].includes(key) || /^GIT_CONFIG_(?:KEY|VALUE)_\d+$/.test(key)) delete installEnv[key];
    }
    call("npm", ["ci", "--no-audit", "--no-fund"], checkout, installEnv);
    const installMs = Date.now() - installStart;
    const executionStart = Date.now();
    // This existing shared-infrastructure selector requests all automatic
    // families without supplying a fabricated production event. Its path is a
    // scope selector, not the candidate's actual changed-path set.
    call(process.execPath, ["scripts/run-historical-qualification.mjs", "--files=scripts/historical-evidence-routing.mjs"], checkout, env);
    const executionMs = Date.now() - executionStart;
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    const families = HISTORICAL_EVIDENCE_MANIFEST.families.filter(({ alwaysInOrdinaryCi }) => alwaysInOrdinaryCi !== true);
    const expected = families.flatMap((family) => family.commands.map((command) => `${family.id}:${command.name}`));
    if (families.some(({ id }) => id === "M7F") && families.some(({ id }) => id === "M7G")) expected.push("M7F:standalone versus M7G child replay equivalence");
    const actual = (report.validators ?? []).map((entry) => `${entry.family}:${entry.name}`);
    if (report.checkedOutSha !== sourceSha || report.decision !== "QUALIFIED" || JSON.stringify(report.families) !== JSON.stringify(families.map(({ id }) => id)) || JSON.stringify(actual) !== JSON.stringify(expected) || report.validators.some((entry) => entry.exitCode !== 0 || entry.signal || entry.error) || report.sourceFetches.some((entry) => entry.exitCode !== 0) || report.missingArtifacts.length || report.unsupported.length) throw new Error("source-execution-evidence-incomplete");
    if (git(["rev-parse", "HEAD"], checkout) !== sourceSha || git(["rev-parse", "HEAD^{tree}"], checkout) !== sourceTreeSha || git(["status", "--porcelain"], checkout)) throw new Error("source-execution-checkout-mutated");
    return { evidenceOnly: true, cleanup: "REMOVED_ON_SUCCESS", scopeSelector: "scripts/historical-evidence-routing.mjs", sourceSha, sourceTreeSha, qualificationManifestBlob: contract["scripts/historical-evidence-manifest.json"], checkoutMs, installMs, executionMs, validators: report.validators, sourceFetches: report.sourceFetches, missingArtifacts: report.missingArtifacts, families: report.families };
  } finally {
    try {
      if (added || existsSync(join(checkout, ".git"))) git(["worktree", "remove", "--force", checkout]);
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
}
