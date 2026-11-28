import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { HISTORICAL_EVIDENCE_MANIFEST, parseNameStatusZ } from "./historical-evidence-routing.mjs";
import { HISTORICAL_QUALIFICATION_BASELINE, parseGitTreeZ, verifyBaselineManifest } from "./historical-qualification-baseline.mjs";
import { discoverCumulativeSource, discoverProductionRelease } from "./historical-production-release.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const fixturePath = resolve(root, "scripts/fixtures/historical-qualification-production-incident.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const incident = fixture.failedProductionRun;
const shaPattern = /^[0-9a-f]{40}$/i;

const gitEnv = () => {
  const env = { ...process.env };
  delete env.GH_TOKEN;
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    const server = new URL(process.env.GITHUB_SERVER_URL ?? "https://github.com");
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "http.extraheader";
    env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`;
    env.GIT_TERMINAL_PROMPT = "0";
    env.GITHUB_SERVER_HOST = server.host;
  }
  return env;
};

const runGit = async (args, cwd = root, allowFailure = false) => {
  if (args[0] === "fetch" && !process.env.GITHUB_TOKEN && args.includes("refs/heads/main:refs/remotes/origin/main")) {
    const cachedMain = spawnSync("git", ["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"], { cwd, encoding: "utf8" });
    if (cachedMain.status === 0) return "";
  }
  const result = spawnSync("git", args, { cwd, env: gitEnv(), encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  const normalized = { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  if (!allowFailure && normalized.status !== 0) {
    throw new Error(`git ${args[0]} failed with exit ${normalized.status}: ${normalized.stderr.trim().slice(-1200)}`);
  }
  return allowFailure ? normalized : normalized.stdout;
};

const writeGitFile = async (directory, revision, path) => {
  const file = await runGit(["show", `${revision}:${path}`], root, true);
  if (file.status !== 0) return false;
  const target = resolve(directory, path);
  mkdirSync(resolve(target, ".."), { recursive: true });
  writeFileSync(target, file.stdout);
  return true;
};

async function classifyWithRouterAtRevision(paths, revision, tempPrefix) {
  const directory = mkdtempSync(join(tmpdir(), tempPrefix));
  try {
    for (const path of [
      "scripts/historical-evidence-routing.mjs",
      "scripts/historical-evidence-manifest.json",
    ]) {
      if (!await writeGitFile(directory, revision, path)) throw new Error(`incident-router-source-unavailable:${path}`);
    }
    for (const path of [
      "src/tests/unit/roomAtDawnCaptureSync.test.ts",
      "experiments/room-at-dawn/capture-sync.cjs",
      "src/tests/unit/roomAtDawnReflectionCapture.test.ts",
      "experiments/room-at-dawn/reflection-capture.js",
      "src/tests/unit/roomAtDawnComparisonCapture.test.ts",
      "experiments/room-at-dawn/comparison-capture.ts",
    ]) await writeGitFile(directory, revision, path);
    writeFileSync(resolve(directory, "incident-paths.json"), JSON.stringify(paths));
    const script = [
      "import { readFileSync } from 'node:fs';",
      "import { classifyCompleteChangedPaths } from './scripts/historical-evidence-routing.mjs';",
      "const paths = JSON.parse(readFileSync('./incident-paths.json', 'utf8'));",
      "process.stdout.write(JSON.stringify(classifyCompleteChangedPaths(paths)));",
    ].join("\n");
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: directory,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`incident-router-process-failed:${result.stderr.trim()}`);
    return JSON.parse(result.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function unresolvedPathFromReason(reason) {
  const unsupportedPrefix = "unsupported-or-unmapped-historical-family:";
  const dependencyPrefix = "unmapped-evidence-verification-dependency:";
  if (reason.startsWith(unsupportedPrefix)) {
    const firstSeparator = reason.indexOf(":", unsupportedPrefix.length);
    return firstSeparator < 0 ? null : reason.slice(firstSeparator + 1);
  }
  return reason.startsWith(dependencyPrefix) ? reason.slice(dependencyPrefix.length) : null;
}

async function auditPolicyIntroductionBaseline() {
  const { policy } = HISTORICAL_QUALIFICATION_BASELINE;
  const policyTreeSha = (await runGit(["rev-parse", `${policy.policyCommit}^{tree}`])).trim();
  if (policyTreeSha !== policy.policyTree) throw new Error("policy-introduction-tree-identity-changed");
  const policyParents = (await runGit(["show", "-s", "--format=%P", policy.policyCommit])).trim().split(/\s+/).filter(Boolean);
  if (!policyParents.includes(policy.prePolicyParent)) throw new Error("policy-introduction-parent-identity-changed");
  const policyTree = parseGitTreeZ(await runGit(["ls-tree", "-r", "-z", "--full-tree", policy.policyCommit]));
  const integrity = verifyBaselineManifest(HISTORICAL_QUALIFICATION_BASELINE, policyTree);
  if (!integrity.valid) throw new Error(`policy-introduction-baseline-integrity-failed:${integrity.errors.join(",")}`);

  const trackedPaths = [...policyTree.keys()];
  const original = await classifyWithRouterAtRevision(
    trackedPaths,
    policy.policyCommit,
    "historical-policy-tree-router-",
  );
  const unresolvedPaths = original.reasons.map(unresolvedPathFromReason).filter(Boolean).sort();
  const baselinePaths = HISTORICAL_QUALIFICATION_BASELINE.entries.map(({ path }) => path).sort();
  const reasons = countIncidentReasons(original.reasons);
  const expectedReasons = HISTORICAL_QUALIFICATION_BASELINE.inventory.policyIntroductionRouterReasons;
  if (original.decision !== "UNVERIFIED" || JSON.stringify(unresolvedPaths) !== JSON.stringify(baselinePaths) ||
      JSON.stringify(Object.fromEntries(Object.entries(reasons).sort(([left], [right]) => left.localeCompare(right)))) !==
        JSON.stringify(Object.fromEntries(Object.entries(expectedReasons).sort(([left], [right]) => left.localeCompare(right)))) ||
      HISTORICAL_QUALIFICATION_BASELINE.entries.some(({ path, blobSha }) => policyTree.get(path) !== blobSha)) {
    throw new Error(`policy-introduction-baseline-coverage-mismatch:${JSON.stringify({ decision: original.decision, trackedPathCount: trackedPaths.length, unresolvedPathCount: unresolvedPaths.length, reasonCounts: reasons })}`);
  }
  const dispositionCounts = {};
  for (const entry of HISTORICAL_QUALIFICATION_BASELINE.entries) {
    dispositionCounts[entry.disposition] = (dispositionCounts[entry.disposition] ?? 0) + 1;
  }
  return {
    policyCommit: policy.policyCommit,
    policyTree: policyTreeSha,
    prePolicyParent: policy.prePolicyParent,
    trackedPathCount: trackedPaths.length,
    unresolvedPathCount: unresolvedPaths.length,
    unresolvedReasonCounts: reasons,
    pinnedBaselineInventorySha256: HISTORICAL_QUALIFICATION_BASELINE.inventory.sha256,
    baselineDispositionCounts: dispositionCounts,
  };
}

async function ensureIncidentCommits() {
  if (process.env.GITHUB_TOKEN) {
    await runGit(["fetch", "--no-tags", "origin", "refs/heads/production:refs/remotes/origin/production"]);
    await runGit(["fetch", "--no-tags", "origin", "refs/heads/main:refs/remotes/origin/main"]);
  } else {
    for (const ref of ["refs/remotes/origin/production", "refs/remotes/origin/main"]) {
      const present = await runGit(["rev-parse", "--verify", `${ref}^{commit}`], root, true);
      if (present.status !== 0) throw new Error(`incident-authoritative-ref-unavailable:${ref}`);
    }
  }
  for (const sha of [incident.previousProductionSha, incident.productionMergeSha, incident.promotedMainSourceSha]) {
    if (!shaPattern.test(sha)) throw new Error(`incident-sha-invalid:${sha}`);
    const present = await runGit(["cat-file", "-e", `${sha}^{commit}`], root, true);
    if (present.status !== 0) throw new Error(`incident-commit-unavailable:${sha}`);
  }
}

async function createIncidentCheckout() {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "historical-production-event-checkout-"));
  const checkout = resolve(temporaryDirectory, "repository");
  const authoritativeOrigin = (await runGit(["remote", "get-url", "origin"])).trim();
  const clone = spawnSync("git", ["clone", "--shared", "--no-checkout", root, checkout], {
    cwd: temporaryDirectory,
    env: gitEnv(),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (clone.error) throw clone.error;
  if (clone.status !== 0) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    throw new Error(`incident-checkout-clone-failed:${clone.stderr.trim()}`);
  }
  const remote = spawnSync("git", ["remote", "set-url", "origin", authoritativeOrigin], {
    cwd: checkout,
    env: gitEnv(),
    encoding: "utf8",
  });
  if (remote.error) throw remote.error;
  if (remote.status !== 0) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    throw new Error(`incident-checkout-remote-setup-failed:${remote.stderr.trim()}`);
  }
  const checkoutResult = spawnSync("git", ["checkout", "--detach", incident.productionMergeSha], {
    cwd: checkout,
    env: gitEnv(),
    encoding: "utf8",
  });
  if (checkoutResult.error) throw checkoutResult.error;
  if (checkoutResult.status !== 0) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    throw new Error(`incident-checkout-revision-failed:${checkoutResult.stderr.trim()}`);
  }
  return { checkout, temporaryDirectory };
}

function countIncidentReasons(reasons) {
  const counts = {};
  for (const reason of reasons) {
    const family = "unsupported-or-unmapped-historical-family:";
    const dependency = "unmapped-evidence-verification-dependency:";
    if (reason.startsWith(family)) counts["unsupported-or-unmapped-historical-family"] = (counts["unsupported-or-unmapped-historical-family"] ?? 0) + 1;
    if (reason.startsWith(dependency)) counts["unmapped-evidence-verification-dependency"] = (counts["unmapped-evidence-verification-dependency"] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  await ensureIncidentCommits();
  const policyIntroductionBaselineAudit = await auditPolicyIntroductionBaseline();
  const actualParents = (await runGit(["show", "-s", "--format=%P", incident.productionMergeSha])).trim().split(/\s+/).filter(Boolean);
  if (JSON.stringify(actualParents) !== JSON.stringify(incident.mergeParents)) throw new Error("incident-production-merge-parents-changed");
  const sourceTree = (await runGit(["rev-parse", `${incident.promotedMainSourceSha}^{tree}`])).trim();
  const destinationTree = (await runGit(["rev-parse", `${incident.productionMergeSha}^{tree}`])).trim();
  if (sourceTree !== incident.treeSha || destinationTree !== incident.treeSha) throw new Error("incident-production-tree-identity-changed");

  const diff = await runGit(["diff", "--name-status", "-M", "-z", incident.previousProductionSha, incident.productionMergeSha]);
  const paths = parseNameStatusZ(diff);
  const pathDigest = createHash("sha256").update(paths.join("\n")).digest("hex");
  if (paths.length !== incident.changedPathCount || pathDigest !== incident.changedPathSetSha256) {
    throw new Error(`incident-path-set-mismatch:count=${paths.length};sha256=${pathDigest}`);
  }

  const original = await classifyWithRouterAtRevision(paths, incident.promotedMainSourceSha, "historical-incident-router-");
  const originalReasonCounts = countIncidentReasons(original.reasons);
  const expectedReasonCounts = incident.originalUnresolvedReasonCounts;
  const sortedCounts = (counts) => Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
  if (original.decision !== incident.originalDecision || original.broad !== incident.originalBroadFallback ||
      JSON.stringify(sortedCounts(originalReasonCounts)) !== JSON.stringify(sortedCounts(expectedReasonCounts))) {
    throw new Error(`incident-original-classification-mismatch:${JSON.stringify({ decision: original.decision, broad: original.broad, reasonCounts: originalReasonCounts })}`);
  }
  if (JSON.stringify(original.unsupported.map(({ id }) => id).sort()) !== JSON.stringify([...incident.unsupportedFamilies].sort())) {
    throw new Error("incident-unsupported-family-inventory-mismatch");
  }

  const incidentCheckout = await createIncidentCheckout();
  let recovered;
  let directPlan;
  try {
    recovered = await discoverProductionRelease({
      repository: { full_name: HISTORICAL_EVIDENCE_MANIFEST.repository },
      ref: "refs/heads/production",
      before: incident.previousProductionSha,
      after: incident.productionMergeSha,
      deleted: false,
    }, { runGit, repositoryRoot: incidentCheckout.checkout });
    directPlan = await discoverCumulativeSource({ sourceSha: incident.promotedMainSourceSha, sourceTreeSha: sourceTree }, { runGit, repositoryRoot: incidentCheckout.checkout });
    for (const key of ["decision", "families", "changedPaths", "qualificationCoverage"]) {
      if (JSON.stringify(directPlan[key]) !== JSON.stringify(recovered[key])) throw new Error(`incident-direct-source-plan-mismatch:${key}`);
    }
    if (JSON.stringify(directPlan.releaseProof.policyIdentity) !== JSON.stringify(recovered.releaseProof.policyIdentity)) throw new Error("incident-direct-source-baseline-mismatch");
  } finally {
    rmSync(incidentCheckout.temporaryDirectory, { recursive: true, force: true });
  }
  if (recovered.decision !== "QUALIFIED_WITH_LEGACY_ARCHIVAL" || recovered.releaseProof.eventChangedPathCount !== incident.changedPathCount ||
      recovered.qualificationCoverage.unresolvedPaths.length !== 0) {
    throw new Error(`incident-corrected-policy-not-qualified:${JSON.stringify({ decision: recovered.decision, currentRoute: recovered.qualificationCoverage.currentRouteDecision, unresolved: recovered.qualificationCoverage.unresolvedPaths.length })}`);
  }

  const registeredValidatorEntryCount = recovered.families
    .reduce((count, familyId) => count + (HISTORICAL_EVIDENCE_MANIFEST.families.find(({ id }) => id === familyId)?.commands.length ?? 0), 0) +
    (recovered.families.includes("M7F") && recovered.families.includes("M7G") ? 1 : 0);
  process.stdout.write(`${JSON.stringify({
    incident: {
      runId: incident.runId,
      artifactSha256: incident.artifactSha256,
      originalDecision: original.decision,
      originalChangedPathCount: paths.length,
      originalPathSetSha256: pathDigest,
      originalBroadFallback: original.broad,
      originalUnresolvedReasonCounts: originalReasonCounts,
      historicalValidatorsPassedInRunArtifact: incident.historicalValidatorsPassed,
      pinnedSourceFetchesPassedInRunArtifact: incident.pinnedSourceFetchesPassed,
      missingRequiredArtifactsInRunArtifact: incident.missingRequiredArtifacts,
    },
    policyIntroductionBaselineAudit,
    directSourcePlanningMatchesProduction: true,
    correctedProductionRoute: {
      decision: recovered.decision,
      eventBeforeSha: recovered.releaseProof.eventBeforeSha,
      eventAfterSha: recovered.releaseProof.eventAfterSha,
      promotedSourceSha: recovered.releaseProof.promotedSourceSha,
      verifiedMergeParents: recovered.releaseProof.verifiedMergeParents,
      sourceTreeSha: recovered.releaseProof.sourceTreeSha,
      destinationTreeSha: recovered.releaseProof.destinationTreeSha,
      policyBaselineCommit: recovered.releaseProof.policyIdentity.commit,
      cumulativeQualificationPathCount: recovered.changedPaths.length,
      fullHistoricalValidationEntryCount: registeredValidatorEntryCount,
      selectedHistoricalFamilies: recovered.families,
      newlyUnresolvedPaths: recovered.qualificationCoverage.unresolvedPaths,
      exactMainWorkflowEvidenceReused: false,
      legacyArchivalDispositionCount: recovered.qualificationCoverage.legacyDispositions.length,
      ordinaryCiOnlyBaselinePathCount: recovered.qualificationCoverage.ordinaryCiOnlyBaselinePaths.length,
    },
    successfulIncrementalMainRun: fixture.successfulMainRunForPromotedSource,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`Historical qualification incident regression failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
