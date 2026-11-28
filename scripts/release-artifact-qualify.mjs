import { expectedSourcePins, verifySourcePins } from "./historical-source-pins.mjs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { planMainSource } from "./historical-production-release.mjs";
import { HISTORICAL_EVIDENCE_MANIFEST } from "./historical-evidence-routing.mjs";
import { executeSourceValidators } from "./historical-source-execution.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowed = new Set(["QUALIFIED", "QUALIFIED_WITH_LEGACY_ARCHIVAL"]);
const sha = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;

const git = async (args, cwd = root, allowFailure = false) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  const response = { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  if (!allowFailure && response.status !== 0) throw new Error(`git-${args[0]}-failed:${response.stderr.slice(-1000)}`);
  return allowFailure ? response : response.stdout;
};

// Release B's reviewed implementation and its transitive artifact helpers must
// be tracked at HEAD and unmodified before this CLI imports them. A future
// reviewed Release B policy update must explicitly update these identities.
const RELEASE_B_BLOBS = Object.freeze({
  "scripts/release-artifact-preflight.mjs": "65cb62b2094aa4177b10927c6af148b2776f0719",
  "scripts/extract-pages-artifact.py": "716bdcc4e0f5ee7d74dbe68faf702672b9919914",
  "scripts/pages-artifact.mjs": "f4a6588664b2a95deef4f4b2215987d063ff3d1c",
});

export async function verifyReleaseBContract({ runGit = git, repositoryRoot = root } = {}) {
  for (const [path, expected] of Object.entries(RELEASE_B_BLOBS)) {
    const onMain = await runGit(["rev-parse", "--verify", `refs/remotes/origin/main:${path}`], repositoryRoot, true);
    if (onMain.status !== 0 || onMain.stdout.trim() !== expected) throw new Error(`release-b-reviewed-contract-not-on-main:${path}`);
    const tracked = await runGit(["rev-parse", "--verify", `HEAD:${path}`], repositoryRoot, true);
    if (tracked.status !== 0 || tracked.stdout.trim() !== expected) throw new Error(`release-b-reviewed-contract-not-integrated:${path}`);
    const unchanged = await runGit(["diff", "--quiet", "HEAD", "--", path], repositoryRoot, true);
    if (unchanged.status !== 0) throw new Error(`release-b-reviewed-contract-modified:${path}`);
    const actual = await runGit(["hash-object", "--", path], repositoryRoot, true);
    if (actual.status !== 0 || actual.stdout.trim() !== expected) throw new Error(`release-b-reviewed-contract-modified:${path}`);
  }
}

/** Re-establishes preflight; injected functions are for controlled tests only. */
export async function qualifyCandidate(args, { preflight, planner = planMainSource, execute = executeSourceValidators, runGit = git, repositoryRoot = root, pinInventory = expectedSourcePins } = {}) {
  if (!Array.isArray(args) || args.length !== 6 || !sha.test(args[0] ?? "") || !args.slice(1).every((v) => /^[1-9][0-9]{0,15}$/.test(v))) throw new Error("qualification-identifiers-invalid");
  if (typeof preflight !== "function") throw new Error("trusted-release-preflight-unavailable");
  const startedAt = Date.now();
  const before = Date.now();
  const candidate = await preflight(args);
  const preflightMs = Date.now() - before;
  const [source, ciId, ciAttempt, producerId, producerAttempt, artifactId] = args;
  if (candidate?.status !== "RELEASE_PREFLIGHT_VERIFIED" || candidate.qualification !== "RELEASE_QUALIFICATION_PENDING" || candidate.deployment !== "NOT_DEPLOYED" || candidate.repository !== "chau-hm/view-camera-simulator" || candidate.source !== source || !sha.test(candidate.tree ?? "") || !sha.test(candidate.main ?? "") || candidate.ci?.runId !== ciId || candidate.ci?.attempt !== Number(ciAttempt) || candidate.producer?.runId !== producerId || candidate.producer?.attempt !== Number(producerAttempt) || candidate.artifact?.id !== artifactId || !/^sha256:[a-f0-9]{64}$/.test(candidate.artifact?.transportDigest ?? "") || candidate.identity?.sourceCommit !== source || candidate.identity?.sourceTree !== candidate.tree || !digest.test(candidate.identity?.manifestSha256 ?? "") || !digest.test(candidate.identity?.contentDigest ?? "")) throw new Error("qualification-preflight-identity-mismatch");
  const planningStart = Date.now();
  const plan = await planner({ repository: candidate.repository, sourceSha: source, sourceTreeSha: candidate.tree, expectedMainSha: candidate.main }, { runGit, repositoryRoot });
  const planningMs = Date.now() - planningStart;
  if (!plan.planOnly || !allowed.has(plan.decision) || plan.fetchedMainSha !== candidate.main || plan.releaseProof?.promotedSourceSha !== source || plan.releaseProof?.sourceTreeSha !== candidate.tree || plan.qualificationCoverage?.unresolvedPaths?.length || plan.unsupported?.length) throw new Error("qualification-source-plan-unverified");
  const evidence = await execute({ sourceSha: source, sourceTreeSha: candidate.tree }, { repositoryRoot });
  const requiredFamilies = HISTORICAL_EVIDENCE_MANIFEST.families.filter(({ alwaysInOrdinaryCi }) => alwaysInOrdinaryCi !== true);
  const requiredValidators = requiredFamilies.flatMap((family) => family.commands.map((command) => `${family.id}:${command.name}`));
  if (requiredFamilies.some(({ id }) => id === "M7F") && requiredFamilies.some(({ id }) => id === "M7G")) requiredValidators.push("M7F:standalone versus M7G child replay equivalence");
  if (!evidence?.evidenceOnly || evidence.sourceSha !== source || evidence.sourceTreeSha !== candidate.tree || !sha.test(evidence.qualificationManifestBlob ?? "") || !Array.isArray(evidence.validators) || JSON.stringify(evidence.validators.map((v) => `${v.family}:${v.name}`)) !== JSON.stringify(requiredValidators) || evidence.validators.some((v) => v.exitCode !== 0 || v.signal || v.error) || !verifySourcePins(evidence.sourceFetches, pinInventory(source, requiredFamilies.map(({ id }) => id), repositoryRoot)) || evidence.missingArtifacts?.length || JSON.stringify(evidence.families) !== JSON.stringify(plan.families) || JSON.stringify(plan.families) !== JSON.stringify(requiredFamilies.map(({ id }) => id))) throw new Error("qualification-validator-evidence-mismatch");
  const refs = (await runGit(["ls-remote", "--heads", "origin", "refs/heads/main"], repositoryRoot)).trim().split(/\s+/);
  if (refs[0] !== candidate.main || refs[1] !== "refs/heads/main") throw new Error("qualification-main-moved");
  const ownershipCounts = (plan.qualificationCoverage.pathOwnership ?? []).reduce((counts, entry) => {
    counts[entry.classification] = (counts[entry.classification] ?? 0) + 1;
    return counts;
  }, {});
  return {
    schemaVersion: 1,
    status: "RELEASE_HISTORICALLY_QUALIFIED",
    historicalDecision: plan.decision,
    deploymentAuthorization: "NOT_GRANTED",
    deployment: "NOT_DEPLOYED",
    ordinaryCiEvidenceReused: true,
    historicalValidatorsReexecuted: true,
    ordinaryCiReruns: 0,
    pagesArtifactBuilds: 0,
    candidate,
    qualification: { mode: "exact-source", source, tree: candidate.tree, ownershipCounts, changedPathCount: plan.changedPaths.length, baseline: plan.releaseProof.policyIdentity, qualificationManifestBlob: evidence.qualificationManifestBlob, executionSource: evidence.sourceSha, executionTree: evidence.sourceTreeSha, executionScopeSelector: evidence.scopeSelector, executionCleanup: evidence.cleanup, changedPaths: plan.changedPaths, coverage: { ...plan.qualificationCoverage, exactMainWorkflowEvidenceReused: true }, families: plan.families, validators: evidence.validators, sourceFetches: evidence.sourceFetches, missingArtifacts: evidence.missingArtifacts },
    timings: { preflightMs, planningMs, baselineMs: plan.planningTimings?.baselineMs, routingMs: plan.planningTimings?.routingMs, checkoutMs: evidence.checkoutMs, dependencyInstallMs: evidence.installMs, validatorsMs: evidence.executionMs, totalMs: Date.now() - startedAt },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (resolve(process.cwd()) !== root) throw new Error("qualification-must-run-from-repository-root");
    // This fixed local import is deliberately fail-closed until Release B lands.
    await verifyReleaseBContract();
    const { runPreflight } = await import(/* @vite-ignore */ new URL("./release-artifact-preflight.mjs", import.meta.url).href);
    const result = await qualifyCandidate(process.argv.slice(2), { preflight: runPreflight });
    console.log(JSON.stringify(result, null, 2));
    console.error(`Historical qualification ${result.historicalDecision}; deployment authorization not granted.`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify({ schemaVersion: 1, status: "RELEASE_QUALIFICATION_FAILED", deploymentAuthorization: "NOT_GRANTED", deployment: "NOT_DEPLOYED", reason }));
    console.error(`Release qualification failed: ${reason}`);
    process.exitCode = 1;
  }
}
