import { HISTORICAL_EVIDENCE_MANIFEST, classifyCompleteChangedPaths, parseNameStatusZ } from "./historical-evidence-routing.mjs";
import { HISTORICAL_QUALIFICATION_BASELINE, HISTORICAL_QUALIFICATION_BASELINE_IDENTITY, parseGitTreeZ, resolveBaselineDispositions, verifyBaselineManifest } from "./historical-qualification-baseline.mjs";

const shaPattern = /^[0-9a-f]{40}$/i;
const zeroSha = "0".repeat(40);
const registeredFamilies = HISTORICAL_EVIDENCE_MANIFEST.families.map(({ id }) => id);
const validatorFamilies = HISTORICAL_EVIDENCE_MANIFEST.families
  .filter(({ alwaysInOrdinaryCi }) => alwaysInOrdinaryCi !== true)
  .map(({ id }) => id);

async function requireCommit(runGit, sha, label, repositoryRoot) {
  if (!shaPattern.test(sha ?? "") || sha === zeroSha) throw new Error(`${label}-sha-invalid`);
  const check = await runGit(["cat-file", "-e", `${sha}^{commit}`], repositoryRoot, true);
  if (check.status !== 0) throw new Error(`${label}-commit-unavailable`);
}

async function getTreeMap(runGit, sha, repositoryRoot) {
  return parseGitTreeZ(await runGit(["ls-tree", "-r", "-z", "--full-tree", sha], repositoryRoot));
}

async function isAncestor(runGit, ancestor, descendant, repositoryRoot, reason) {
  const result = await runGit(["merge-base", "--is-ancestor", ancestor, descendant], repositoryRoot, true);
  if (result.status !== 0) throw new Error(reason);
}

function countBy(values, selector) {
  return values.reduce((counts, value) => {
    const key = selector(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function legacyArchiveDirectories(baseline) {
  return new Set(baseline.entries
    .filter(({ disposition }) => disposition === "legacy-archival-unverified")
    .map(({ path }) => path.slice(0, path.lastIndexOf("/")))
    .filter(Boolean));
}

/**
 * Proves a canonical production promotion from actual Git objects and returns
 * a cumulative, baseline-to-source qualification plan. It never trusts commit
 * messages or the immediately preceding production ref as deployment state.
 */
export async function discoverProductionRelease(event, {
  runGit,
  repositoryRoot = process.cwd(),
  repository = HISTORICAL_EVIDENCE_MANIFEST.repository,
  baseline = HISTORICAL_QUALIFICATION_BASELINE,
  baselineIdentity = HISTORICAL_QUALIFICATION_BASELINE_IDENTITY,
} = {}) {
  if (typeof runGit !== "function") throw new Error("production-release-git-client-unavailable");
  if (event?.repository?.full_name !== repository) throw new Error("production-release-repository-mismatch");
  if (event?.ref !== "refs/heads/production") throw new Error("production-release-ref-mismatch");
  if (event?.deleted === true) throw new Error("production-release-deleted-ref");

  const beforeSha = event.before;
  const afterSha = event.after;
  await requireCommit(runGit, beforeSha, "production-event-before", repositoryRoot);
  await requireCommit(runGit, afterSha, "production-event-after", repositoryRoot);
  const checkedOutSha = (await runGit(["rev-parse", "HEAD"], repositoryRoot)).trim();
  if (checkedOutSha !== afterSha) throw new Error("checked-out-head-does-not-match-production-event-after");

  const parents = (await runGit(["show", "-s", "--format=%P", afterSha], repositoryRoot)).trim().split(/\s+/).filter(Boolean);
  if (parents.length !== 2) throw new Error("production-promotion-merge-topology-not-two-parent");
  if (parents[0] !== beforeSha) throw new Error("production-promotion-first-parent-does-not-match-event-before");
  const sourceSha = parents[1];

  const destinationTree = (await runGit(["rev-parse", `${afterSha}^{tree}`], repositoryRoot)).trim();
  const sourceTreeSha = (await runGit(["rev-parse", `${sourceSha}^{tree}`], repositoryRoot)).trim();
  if (!shaPattern.test(destinationTree) || !shaPattern.test(sourceTreeSha)) throw new Error("production-promotion-tree-identity-invalid");
  if (destinationTree !== sourceTreeSha) throw new Error("production-promotion-source-and-destination-trees-differ");

  await runGit(["fetch", "--no-tags", "origin", "refs/heads/main:refs/remotes/origin/main"], repositoryRoot);
  const verifiedMainSha = (await runGit(["rev-parse", "refs/remotes/origin/main^{commit}"], repositoryRoot)).trim();
  await isAncestor(runGit, sourceSha, "refs/remotes/origin/main", repositoryRoot, "promoted-source-is-not-a-verified-main-revision");

  const baselineCommit = baseline?.policy?.policyCommit;
  const baselineTreeSha = baseline?.policy?.policyTree;
  await requireCommit(runGit, baselineCommit, "legacy-baseline", repositoryRoot);
  const baselineParents = (await runGit(["show", "-s", "--format=%P", baselineCommit], repositoryRoot)).trim().split(/\s+/).filter(Boolean);
  if (!baselineParents.includes(baseline?.policy?.prePolicyParent)) throw new Error("legacy-baseline-pre-policy-parent-mismatch");
  const actualBaselineTreeSha = (await runGit(["rev-parse", `${baselineCommit}^{tree}`], repositoryRoot)).trim();
  if (actualBaselineTreeSha !== baselineTreeSha) throw new Error("legacy-baseline-tree-identity-mismatch");
  await isAncestor(runGit, baselineCommit, sourceSha, repositoryRoot, "legacy-baseline-is-not-an-ancestor-of-promoted-source");

  const policyTree = await getTreeMap(runGit, baselineCommit, repositoryRoot);
  const sourceTree = await getTreeMap(runGit, sourceSha, repositoryRoot);
  const baselineIntegrity = verifyBaselineManifest(baseline, policyTree, baselineIdentity);
  if (!baselineIntegrity.valid) throw new Error(`legacy-baseline-integrity-failed:${baselineIntegrity.errors.join(",")}`);
  const baselineResolution = resolveBaselineDispositions({ baseline, sourceTree, currentValidatorFamilies: registeredFamilies });

  const eventDiff = await runGit(["diff", "--name-status", "-M", "-z", beforeSha, afterSha], repositoryRoot);
  const eventChangedPaths = parseNameStatusZ(eventDiff);
  const qualificationDiff = await runGit(["diff", "--name-status", "-M", "-z", baselineCommit, sourceSha], repositoryRoot);
  const qualificationPaths = parseNameStatusZ(qualificationDiff);
  const invalidatedPaths = new Set(baselineResolution.invalidated.map(({ path }) => path));
  const discoveredPaths = new Set(qualificationPaths);
  const unreportedInvalidations = [...invalidatedPaths].filter((path) => !discoveredPaths.has(path));
  if (unreportedInvalidations.length > 0) throw new Error(`baseline-invalidation-missing-from-change-discovery:${unreportedInvalidations.join(",")}`);

  const routing = classifyCompleteChangedPaths(qualificationPaths);
  const archiveDirectories = legacyArchiveDirectories(baseline);
  const unclassifiedLegacyDirectoryPaths = qualificationPaths.filter((path) => {
    const withinLegacyArchiveDirectory = [...archiveDirectories].some((directory) => path.startsWith(`${directory}/`));
    return withinLegacyArchiveDirectory && classifyCompleteChangedPaths([path]).decision === "NOT_APPLICABLE";
  });
  if (unclassifiedLegacyDirectoryPaths.length > 0) {
    routing.decision = "UNVERIFIED";
    routing.broad = true;
    routing.reasons = [
      ...(routing.reasons ?? []),
      ...unclassifiedLegacyDirectoryPaths.map((path) => `unmapped-evidence-verification-dependency:${path}`),
    ];
  }
  const baselineDispositionCounts = countBy(baselineResolution.unchanged, ({ disposition }) => disposition);
  const familyOwners = {
    ...baselineDispositionCounts,
    "current-validator": baselineResolution.validatorOwned.length,
  };
  const historicalLegacyCount = (baselineDispositionCounts["legacy-archival-unverified"] ?? 0) +
    (baselineDispositionCounts["documentation-only"] ?? 0);
  const reasons = [
    "canonical-production-merge-topology-verified-from-git-objects",
    "promoted-source-is-an-ancestor-of-the-fetched-origin-main-revision",
    "production-release-qualification-range-is-policy-baseline-to-promoted-source",
    "all-registered-historical-validators-run-for-production-releases",
    ...(routing.reasons ?? []),
  ];
  const decision = routing.decision === "UNVERIFIED"
    ? "UNVERIFIED"
    : historicalLegacyCount > 0 ? "QUALIFIED_WITH_LEGACY_ARCHIVAL" : "QUALIFIED";
  const unresolvedPaths = [...new Set((routing.reasons ?? []).flatMap((reason) => {
    const unsupportedPrefix = "unsupported-or-unmapped-historical-family:";
    const dependencyPrefix = "unmapped-evidence-verification-dependency:";
    if (reason.startsWith(unsupportedPrefix)) {
      const firstSeparator = reason.indexOf(":", unsupportedPrefix.length);
      return firstSeparator < 0 ? [] : [reason.slice(firstSeparator + 1)];
    }
    if (reason.startsWith(dependencyPrefix)) return [reason.slice(dependencyPrefix.length)];
    return [];
  }))];

  return {
    decision,
    families: validatorFamilies,
    changedPaths: qualificationPaths,
    eventChangedPaths,
    broad: routing.broad === true,
    reasons,
    unsupported: routing.unsupported ?? [],
    currentOwners: [...new Set([
      ...(routing.currentOwners ?? []),
      "ordinary-ci:evidence:check:m7r",
      "ordinary-ci:evidence:check:m7v",
      "ordinary-ci:application-ci",
    ])],
    releaseProof: {
      eventBeforeSha: beforeSha,
      eventAfterSha: afterSha,
      promotedSourceSha: sourceSha,
      verifiedMergeParents: parents,
      destinationTreeSha: destinationTree,
      sourceTreeSha,
      fetchedMainSha: verifiedMainSha,
      sourceIsVerifiedMainAncestor: true,
      policyIdentity: {
        id: baseline.policy.id,
        commit: baselineCommit,
        tree: baselineTreeSha,
        prePolicyParent: baseline.policy.prePolicyParent,
        verifiedParents: baselineParents,
        inventoryEntryCount: baseline.entries.length,
        inventorySha256: baseline.inventory.sha256,
      },
      eventChangedPathCount: eventChangedPaths.length,
      cumulativeQualificationPathCount: qualificationPaths.length,
      historicalValidatorScope: "all-registered-automatic-families",
    },
    qualificationCoverage: {
      currentRouteDecision: routing.decision,
      newlyRoutedReasons: routing.reasons ?? [],
      baselineDispositionCounts: familyOwners,
      invalidatedBaselinePaths: baselineResolution.invalidated,
      baselineContentNowOwnedByValidators: baselineResolution.validatorOwned,
      legacyDispositions: baselineResolution.unchanged
        .filter(({ disposition }) => disposition === "legacy-archival-unverified" || disposition === "documentation-only")
        .map(({ path, blobSha, kind, disposition, family, ordinaryCiOwner, limitation }) => ({ path, blobSha, kind, disposition, family, ordinaryCiOwner, limitation })),
      ordinaryCiOnlyBaselinePaths: baselineResolution.unchanged
        .filter(({ disposition }) => disposition === "ordinary-ci-code")
        .map(({ path, blobSha, kind, ordinaryCiOwner, limitation }) => ({ path, blobSha, kind, disposition: "ordinary-ci-code", ordinaryCiOwner, limitation })),
      unresolvedPaths,
      exactMainWorkflowEvidenceReused: false,
    },
  };
}
