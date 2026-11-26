import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HISTORICAL_EVIDENCE_MANIFEST,
  classifyCompleteChangedPaths,
  classifyChangedPaths,
  discoverPullRequestPaths,
  discoverPushPaths,
  determineQualificationDecision,
  failedClosedRoute,
} from "./historical-evidence-routing.mjs";
import { discoverProductionRelease } from "./historical-production-release.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = HISTORICAL_EVIDENCE_MANIFEST;
const familyById = new Map(manifest.families.map((family) => [family.id, family]));
const ZERO_SHA = "0".repeat(40);
const shaPattern = /^[0-9a-f]{40}$/i;
const startedAt = new Date().toISOString();

const parseArgs = (args) => {
  const options = { all: false, dryRun: false, files: null };
  for (const argument of args) {
    if (argument === "--all") options.all = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument.startsWith("--files=")) options.files = argument.slice("--files=".length).split(",").filter(Boolean);
    else throw new Error(`Unsupported historical qualification option: ${argument}`);
  }
  if (options.all && options.files) throw new Error("--all cannot be combined with --files");
  return options;
};

const plainEnv = () => {
  const env = { ...process.env };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  delete env.GITHUB_OUTPUT;
  delete env.GITHUB_STEP_SUMMARY;
  delete env.GITHUB_STATE;
  delete env.ACTIONS_RUNTIME_TOKEN;
  delete env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  delete env.ACTIONS_RUNTIME_URL;
  delete env.ACTIONS_CACHE_URL;
  delete env.GIT_CONFIG_COUNT;
  for (const key of Object.keys(env)) if (/^GIT_CONFIG_(?:KEY|VALUE)_\d+$/.test(key)) delete env[key];
  return env;
};

const gitAuthEnv = () => {
  const env = plainEnv();
  const token = process.env.GITHUB_TOKEN;
  const server = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  if (token) {
    const host = new URL(server).host;
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "http.extraheader";
    env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`;
    env.GIT_TERMINAL_PROMPT = "0";
    env.GITHUB_SERVER_HOST = host;
  }
  return env;
};

const runGit = async (args, cwd = root, allowFailure = false) => {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: gitAuthEnv(),
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const normalized = { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  if (!allowFailure && normalized.status !== 0) {
    throw new Error(`git ${args[0]} failed with exit ${normalized.status}: ${normalized.stderr.trim().slice(-1200)}`);
  }
  return allowFailure ? normalized : normalized.stdout;
};

const apiRequest = async (path) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("read-only GitHub token is unavailable");
  const apiBase = new URL(process.env.GITHUB_API_URL ?? "https://api.github.com");
  const basePath = apiBase.pathname.replace(/\/$/, "");
  const url = new URL(`${basePath}${path}`, apiBase.origin);
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub API request failed with HTTP ${response.status}`);
  return response.json();
};

const reportPath = process.env.HISTORICAL_QUALIFICATION_RESULT_PATH
  ?? (process.env.RUNNER_TEMP ? join(process.env.RUNNER_TEMP, "historical-qualification-result.json") : null);
const result = {
  schemaVersion: 1,
  repository: manifest.repository,
  decision: "UNVERIFIED",
  eventName: process.env.GITHUB_EVENT_NAME ?? "local",
  mode: process.env.HISTORICAL_QUALIFICATION_MODE ?? "changed",
  checkedOutSha: null,
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  startedAt,
  completedAt: null,
  changedPaths: [],
  eventChangedPaths: [],
  families: [],
  broadFallback: false,
  reasons: [],
  unsupported: [],
  pathOwnership: [],
  sourceFetches: [],
  validators: [],
  missingArtifacts: [],
  releaseProof: null,
  qualificationCoverage: null,
  blockingReasons: [],
};

function getBlockingReasons() {
  const reasons = [];
  if (result.decision === "UNVERIFIED") {
    reasons.push(...result.reasons.filter((reason) => /unsupported-or-unmapped|unmapped-evidence|source.*unavailable|baseline.*failed|topology|tree.*differ|does-not-match|not-a-verified-main|missing-from-change-discovery|routing-unverified|history-unavailable|qualification-could-not-complete|npm-ci-unavailable|qualification-fatal/i.test(reason)));
    for (const { id, reason } of result.unsupported) reasons.push(`unsupported family ${id}: ${reason}`);
    for (const path of result.missingArtifacts) reasons.push(`missing required artifact: ${path}`);
    for (const fetch of result.sourceFetches.filter(({ exitCode }) => exitCode !== 0)) reasons.push(`source verification failed: ${fetch.id ?? fetch.sha ?? "unknown"}`);
  }
  if (result.decision === "FAILED") {
    for (const validator of result.validators.filter(({ exitCode, signal, error }) => exitCode !== 0 || signal || error)) {
      reasons.push(`validator failed: ${validator.family} / ${validator.name}`);
    }
  }
  if (reasons.length === 0 && !["QUALIFIED", "QUALIFIED_WITH_LEGACY_ARCHIVAL", "NOT_APPLICABLE"].includes(result.decision)) {
    reasons.push(result.reasons[0] ?? `qualification-decision-${result.decision.toLowerCase()}`);
  }
  return [...new Set(reasons)];
}

function publishResult() {
  result.completedAt = new Date().toISOString();
  result.blockingReasons = getBlockingReasons();
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (reportPath) {
    mkdirSync(resolve(reportPath, ".."), { recursive: true });
    writeFileSync(reportPath, serialized);
  }
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) appendFileSync(outputPath, `decision=${result.decision}\nmode=${result.mode}\n`);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const primaryBlockingReason = result.blockingReasons[0] ?? null;
  const ownershipCounts = result.pathOwnership.reduce((counts, entry) => {
    counts[entry.classification] = (counts[entry.classification] ?? 0) + 1;
    return counts;
  }, {});
  const unresolvedOwnershipPaths = result.pathOwnership.filter(({ unresolved }) => unresolved).map(({ path }) => path);
  process.stdout.write(`Historical qualification decision: ${result.decision}${primaryBlockingReason ? `; primary blocking reason: ${primaryBlockingReason}` : ""}\n`);
  if (summaryPath) {
    const familyList = result.families.length ? result.families.join(", ") : "none";
    const releaseProof = result.releaseProof;
    const legacyDispositions = result.qualificationCoverage?.legacyDispositions ?? [];
    appendFileSync(summaryPath, [
      "## Historical evidence qualification",
      "",
      `**Decision:** \`${result.decision}\``,
      `**Mode:** \`${result.mode}\``,
      `**Families:** ${familyList}`,
      `**Ordinary-CI owners:** ${result.currentOwners?.length ? result.currentOwners.join(", ") : "none"}`,
      `**Changed-path ownership:** ${ownershipCounts["historical-validator"] ?? 0} historical-validator, ${ownershipCounts["ordinary-ci"] ?? 0} ordinary-CI, ${ownershipCounts["qualification-infrastructure"] ?? 0} qualification-infrastructure, ${ownershipCounts["non-evidence"] ?? 0} non-evidence, ${ownershipCounts.unresolved ?? 0} unresolved.`,
      `**Cumulative qualification paths inspected:** ${result.changedPaths.length}`,
      ...(releaseProof ? [
        `**Production event before/after:** \`${releaseProof.eventBeforeSha}\` → \`${releaseProof.eventAfterSha}\``,
        `**Promoted main source:** \`${releaseProof.promotedSourceSha}\``,
        `**Verified merge parents:** \`${releaseProof.verifiedMergeParents.join(" ")}\``,
        `**Source/destination tree:** \`${releaseProof.sourceTreeSha}\` / \`${releaseProof.destinationTreeSha}\``,
        `**Qualification baseline:** \`${releaseProof.policyIdentity.commit}\` (tree \`${releaseProof.policyIdentity.tree}\`)`,
        `**Baseline inventory:** ${releaseProof.policyIdentity.inventoryEntryCount} exact entries (SHA-256 \`${releaseProof.policyIdentity.inventorySha256}\`).`,
        `**Immediate event paths:** ${releaseProof.eventChangedPathCount}; **baseline-to-source paths:** ${releaseProof.cumulativeQualificationPathCount}`,
        `**Exact main workflow evidence reused:** no; all registered historical validators run for a production release.`,
        `**Unverified legacy archive dispositions:** ${legacyDispositions.length}; unchanged exact blobs only.`,
      ] : []),
      ...(primaryBlockingReason ? [`**Primary blocking reason:** ${primaryBlockingReason}`] : []),
      ...(unresolvedOwnershipPaths.length ? [
        `**Unresolved changed paths:** ${unresolvedOwnershipPaths.slice(0, 20).join(", ")}${unresolvedOwnershipPaths.length > 20 ? `, and ${unresolvedOwnershipPaths.length - 20} more in the machine-readable artifact` : ""}`,
      ] : []),
      ...(result.blockingReasons.length > 1 ? [`**Additional blocking reasons:** ${result.blockingReasons.length - 1} (see the machine-readable artifact).`] : []),
      ...(result.validators.length ? [
        "",
        "### Validator results",
        ...result.validators.map((validator) => `- ${validator.family} / ${validator.name}: ${validator.exitCode === 0 ? "passed" : "failed"}${Number.isFinite(validator.durationMs) ? ` (${validator.durationMs} ms)` : ""}`),
      ] : []),
      ...(result.reasons.length ? ["", "### Routing / qualification notes", ...result.reasons.slice(0, 20).map((reason) => `- ${reason}`), ...(result.reasons.length > 20 ? [`- ${result.reasons.length - 20} additional path-level routing notes are in the machine-readable artifact.`] : [])] : []),
      ...(result.unsupported.length ? ["", "### Unverified families", ...result.unsupported.map(({ id, reason }) => `- ${id}: ${reason}`)] : []),
      ...(result.missingArtifacts.length ? ["", "### Missing required artifacts", ...result.missingArtifacts.map((path) => `- ${path}`)] : []),
      "",
      "This lane validates frozen evidence integrity and provenance; it is not evidence that the current renderer or browser behavior works.",
      "",
    ].join("\n"));
  }
  if (!outputPath && !summaryPath) process.stdout.write(serialized);
}

async function route(options) {
  if (options.all || result.mode === "full") {
    return classifyChangedPaths([], { forceFull: true, includeUnsupported: true, reason: "manual-full-historical-qualification" });
  }
  if (options.files) return classifyChangedPaths(options.files);
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const eventName = process.env.GITHUB_EVENT_NAME;
  if (!eventPath || !eventName) throw new Error("local invocation needs --all or --files=<comma-separated-paths>");
  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const repository = process.env.GITHUB_REPOSITORY ?? manifest.repository;
  if (repository !== manifest.repository) throw new Error("workflow repository does not match the evidence manifest");
  if (eventName === "pull_request") {
    const discovered = await discoverPullRequestPaths(event, { repository, apiRequest });
    return { ...classifyCompleteChangedPaths(discovered.paths), ...discovered, changedPaths: discovered.paths };
  }
  if (eventName === "push") {
    if (result.mode === "production-release") {
      return await discoverProductionRelease(event, { runGit, repositoryRoot: root, repository });
    }
    const discovered = await discoverPushPaths(event, { runGit, repositoryRoot: root });
    if (discovered.noCommit) {
      return { decision: "NOT_APPLICABLE", families: [], changedPaths: [], broad: false, reasons: [discovered.reason], currentOwners: [], unsupported: [] };
    }
    return { ...classifyCompleteChangedPaths(discovered.paths), ...discovered, changedPaths: discovered.paths };
  }
  if (eventName === "workflow_dispatch") {
    return { decision: "NOT_APPLICABLE", families: [], changedPaths: [], broad: false, reasons: ["pages-workflow-manual-run-does-not-request-archive-replay"], currentOwners: [], unsupported: [] };
  }
  throw new Error(`unsupported automatic qualification event: ${eventName ?? "missing"}`);
}

function appendDynamicM7wPaths(pin) {
  const inventoryPath = resolve(root, pin.verifyInventorySpecPathsFrom);
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const tests = inventory?.profiles?.standard?.tests;
  if (!Array.isArray(tests) || tests.length === 0) throw new Error(`M7W source path inventory is incomplete: ${pin.verifyInventorySpecPathsFrom}`);
  const paths = tests.map((test) => test?.specPath);
  if (paths.some((path) => typeof path !== "string" || !path.startsWith("src/tests/e2e/"))) {
    throw new Error("M7W inventory contains an invalid execution source path");
  }
  return [...new Set([...pin.verifyPaths, ...paths])];
}

function verifyRequiredArtifacts(families) {
  for (const familyId of families) {
    const family = familyById.get(familyId);
    for (const path of family.requiredArtifacts) {
      if (!existsSync(resolve(root, path))) result.missingArtifacts.push(path);
    }
  }
  if (result.missingArtifacts.length) {
    result.decision = "UNVERIFIED";
    result.reasons.push("one-or-more-required-evidence-artifacts-are-unavailable");
  }
}

function selectedPins(families) {
  const ids = new Set(families);
  return manifest.sourcePins.filter((pin) => pin.families.some((family) => ids.has(family)));
}

function fetchHistoryFor(pin) {
  const args = ["scripts/fetch-m7k-execution-source.mjs", `--sha=${pin.sha}`];
  if (pin.retainedRef) args.push(`--retained-ref=${pin.retainedRef}`);
  const paths = pin.verifyInventorySpecPathsFrom ? appendDynamicM7wPaths(pin) : pin.verifyPaths;
  for (const path of paths) args.push(`--verify-path=${path}`);
  const fetched = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    env: gitAuthEnv(),
    maxBuffer: 8 * 1024 * 1024,
  });
  const record = {
    id: pin.id,
    sha: pin.sha,
    retainedRef: pin.retainedRef ?? null,
    verifyPaths: paths,
    verifyPathCount: paths.length,
    exitCode: fetched.status ?? 1,
  };
  result.sourceFetches.push(record);
  if (fetched.stdout) process.stdout.write(fetched.stdout);
  if (fetched.stderr) process.stderr.write(fetched.stderr);
  return fetched.status === 0;
}

function runValidator(family, command, tempDirectory) {
  const args = command.args.map((part) => part.replaceAll("{temp}", tempDirectory));
  const started = Date.now();
  const execution = spawnSync("npm", args, {
    cwd: root,
    env: plainEnv(),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 600_000,
  });
  const stdout = execution.stdout ?? "";
  const stderr = execution.stderr ?? "";
  const excerpt = (value) => value.length > 3000 ? value.slice(-3000) : value;
  const record = {
    family: family.id,
    name: command.name,
    command: ["npm", ...args],
    exitCode: execution.status ?? 1,
    signal: execution.signal ?? null,
    error: execution.error?.message ?? null,
    durationMs: Date.now() - started,
    stdoutExcerpt: excerpt(stdout),
    stderrExcerpt: excerpt(stderr),
  };
  if (record.exitCode === 0 && record.signal === null && record.error === null) {
    process.stdout.write(`${family.id} ${command.name}: passed (${record.durationMs} ms)\n`);
  } else {
    process.stderr.write(`${family.id} ${command.name}: failed (exit ${record.exitCode}, ${record.durationMs} ms)\n`);
    if (record.stdoutExcerpt) process.stderr.write(`${record.stdoutExcerpt}\n`);
    if (record.stderrExcerpt) process.stderr.write(`${record.stderrExcerpt}\n`);
  }
  result.validators.push(record);
  return record.exitCode === 0 && record.signal === null && record.error === null;
}

function compareM7fRoutes(tempDirectory) {
  const directPath = join(tempDirectory, "m7f-standalone.json");
  const consolidatedPath = join(tempDirectory, "m7g-report.json");
  let comparison = { passed: false, reason: "one-or-both-route-reports-missing" };
  try {
    const directBytes = readFileSync(directPath);
    const consolidated = JSON.parse(readFileSync(consolidatedPath, "utf8"));
    const direct = JSON.parse(directBytes.toString("utf8"));
    const childExecution = consolidated?.replayExecution?.m7f;
    const digest = createHash("sha256").update(directBytes).digest("hex");
    const childIdentity = childExecution?.reportIdentity;
    const counts = direct.scenarioCounts;
    const declared = counts?.declared;
    const computed = counts?.computed;
    const childIdentityMatch = childIdentity?.reportId === direct.reportId
      && childIdentity?.evaluatorRevision === direct.evaluatorRevision
      && childIdentity?.sourceCaptureSha === direct.nativeCaptureSourceSha
      && childIdentity?.replayCodeSha === direct.replayCodeCommitSha
      && childExecution?.expectedSourceSha === direct.nativeCaptureSourceSha
      && childExecution?.expectedReplayCodeSha === direct.replayCodeCommitSha;
    const scenarioCountsMatch = counts?.inventoryConsistent === true
      && declared?.passed === 17 && declared?.failed === 0 && declared?.blocked === 0 && declared?.["not-run"] === 0
      && computed?.passed === 17 && computed?.failed === 0 && computed?.blocked === 0 && computed?.["not-run"] === 0;
    const outcomeMatch = direct.qualificationStatus === "passed"
      && direct.qualificationPass === true
      && direct.sourceCommitVerification?.verified === true
      && direct.evidenceReadIssues?.length === 0;
    const integrityMatch = childExecution?.valid === true
      && childExecution?.exitCode === 0
      && childExecution?.signal === null
      && childExecution?.spawnError === null
      && childExecution?.reportPresent === true
      && childExecution?.reportParsed === true
      && childExecution?.reportValidated === true
      && childExecution?.reportValidationIssues?.length === 0
      && childExecution?.reportSha256 === digest;
    comparison = {
      passed: childIdentityMatch && scenarioCountsMatch && outcomeMatch && integrityMatch,
      childIdentityMatch,
      scenarioCountsMatch,
      outcomeMatch,
      integrityMatch,
      standaloneReportSha256: digest,
      consolidatedChildReportSha256: childExecution?.reportSha256 ?? null,
      standaloneSourceSha: direct.nativeCaptureSourceSha ?? null,
      consolidatedChildSourceSha: childIdentity?.sourceCaptureSha ?? null,
      standaloneReplayCodeSha: direct.replayCodeCommitSha ?? null,
      consolidatedChildReplayCodeSha: childIdentity?.replayCodeSha ?? null,
      standaloneScenarioCounts: counts ?? null,
      consolidatedChildScenarioCounts: scenarioCountsMatch ? counts : null,
      standaloneDecision: { status: direct.qualificationStatus, pass: direct.qualificationPass },
      consolidatedChildDecision: { status: outcomeMatch ? direct.qualificationStatus : null, pass: outcomeMatch ? direct.qualificationPass : null },
      reason: childIdentityMatch && scenarioCountsMatch && outcomeMatch && integrityMatch
        ? null
        : "m7f-routes-differ-or-child-report-integrity-failed",
    };
  } catch (error) {
    comparison.reason = error instanceof Error ? error.message : String(error);
  }
  result.validators.push({
    family: "M7F",
    name: "standalone versus M7G child replay equivalence",
    command: ["semantic-report-comparison"],
    exitCode: comparison.passed ? 0 : 1,
    comparison,
  });
  if (comparison.passed) {
    result.reasons.push("M7F standalone and M7G child reports have matching source, outcome, scenario counts, replay revision, and report digest");
  }
  return comparison.passed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  try {
    const checkedOutSha = (await runGit(["rev-parse", "HEAD"])).trim();
    if (!shaPattern.test(checkedOutSha)) throw new Error("checked-out-revision-invalid");
    result.checkedOutSha = checkedOutSha;
  } catch (error) {
    result.reasons.push(`qualification-checkout-unavailable:${error instanceof Error ? error.message : String(error)}`);
    result.decision = "UNVERIFIED";
    publishResult();
    return 1;
  }
  const classification = await route(options).catch((error) => {
    const failed = failedClosedRoute(`routing-unverified:${error instanceof Error ? error.message : String(error)}`);
    failed.changedPaths = [];
    return failed;
  });
  Object.assign(result, {
    decision: classification.decision,
    changedPaths: classification.changedPaths ?? [],
    families: classification.families ?? [],
    broadFallback: classification.broad === true,
    reasons: classification.reasons ?? [],
    unsupported: classification.unsupported ?? [],
    currentOwners: classification.currentOwners ?? [],
    pathOwnership: classification.pathOwnership ?? [],
    pullNumber: classification.pullNumber ?? null,
    eventChangedPaths: classification.eventChangedPaths ?? [],
    releaseProof: classification.releaseProof ?? null,
    qualificationCoverage: classification.qualificationCoverage ?? null,
    baseSha: classification.releaseProof?.policyIdentity?.commit ?? classification.baseSha ?? classification.comparisonBaseSha ?? null,
    headSha: classification.releaseProof?.promotedSourceSha ?? classification.headSha ?? classification.afterSha ?? null,
  });

  if (options.dryRun) {
    if (result.decision !== "NOT_APPLICABLE") {
      result.reasons.push("dry-run-did-not-execute-any-validator");
      result.decision = "UNVERIFIED";
    }
    publishResult();
    return result.decision === "NOT_APPLICABLE" ? 0 : 1;
  }
  if (result.decision === "NOT_APPLICABLE") {
    publishResult();
    return result.decision === "UNVERIFIED" ? 1 : 0;
  }

  const tempDirectory = mkdtempSync(join(root, ".historical-qualification-"));
  try {
    if (process.env.CI === "true" && result.families.length > 0) {
      const install = spawnSync("npm", ["ci"], {
        cwd: root,
        env: plainEnv(),
        stdio: "inherit",
        timeout: 600_000,
      });
      if (install.error || install.status !== 0) {
        result.decision = "UNVERIFIED";
        result.reasons.push(`npm-ci-unavailable:${install.error?.message ?? `exit-${install.status}`}`);
        publishResult();
        return 1;
      }
    }

    const shallow = (await runGit(["rev-parse", "--is-shallow-repository"])).trim() === "true";
    if (shallow) {
      try {
        await runGit(["fetch", "--unshallow", "--no-tags", "origin", "refs/heads/main"]);
        result.reasons.push("archive-lane-expanded-main-history-from-clean-shallow-checkout");
      } catch (error) {
        result.decision = "UNVERIFIED";
        result.reasons.push(`main-history-unavailable:${error instanceof Error ? error.message : String(error)}`);
      }
    }

    let sourceFailure = false;
    for (const pin of selectedPins(result.families)) {
      try {
        if (!fetchHistoryFor(pin)) sourceFailure = true;
      } catch (error) {
        sourceFailure = true;
        result.sourceFetches.push({ id: pin.id, sha: pin.sha, retainedRef: pin.retainedRef ?? null, exitCode: 1, error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (sourceFailure) result.reasons.push("one-or-more-pinned-source-commits-or-tree-paths-could-not-be-verified");

    verifyRequiredArtifacts(result.families);
    const missingFamilyIds = new Set(result.missingArtifacts.flatMap((path) =>
      result.families.filter((familyId) => familyById.get(familyId).requiredArtifacts.includes(path))));
    let validatorFailure = false;
    for (const familyId of result.families) {
      const family = familyById.get(familyId);
      if (missingFamilyIds.has(familyId)) continue;
      for (const command of family.commands) {
        if (!runValidator(family, command, tempDirectory)) validatorFailure = true;
      }
    }
    if (result.families.includes("M7F") && result.families.includes("M7G")) {
      if (!compareM7fRoutes(tempDirectory)) validatorFailure = true;
    }

    if (validatorFailure) result.reasons.push("one-or-more-historical-evidence-validators-failed");
    result.decision = determineQualificationDecision({
      routeDecision: result.decision,
      hasFamilies: result.families.length > 0,
      sourceFailure,
      missingArtifacts: result.missingArtifacts.length > 0,
      validatorFailure,
      unsupported: result.unsupported.length > 0,
    });
  } catch (error) {
    result.decision = "UNVERIFIED";
    result.reasons.push(`qualification-could-not-complete:${error instanceof Error ? error.message : String(error)}`);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
    publishResult();
  }
  return result.decision === "QUALIFIED" || result.decision === "QUALIFIED_WITH_LEGACY_ARCHIVAL" || result.decision === "NOT_APPLICABLE" ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((status) => { process.exitCode = status; }).catch((error) => {
    result.decision = "UNVERIFIED";
    result.reasons.push(`qualification-fatal:${error instanceof Error ? error.message : String(error)}`);
    publishResult();
    process.exitCode = 1;
  });
}
