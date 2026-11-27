import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { HISTORICAL_EVIDENCE_MANIFEST, classifyCompleteChangedPaths } from "../../../scripts/historical-evidence-routing.mjs";
import { calculateBaselineInventoryDigest } from "../../../scripts/historical-qualification-baseline.mjs";
import { discoverCumulativeSource, discoverProductionRelease, planMainSource } from "../../../scripts/historical-production-release.mjs";

const activeFixtures: string[] = [];
const shaPattern = /^[0-9a-f]{40}$/;
const repository = HISTORICAL_EVIDENCE_MANIFEST.repository;
const derivation = "All tracked paths at policyCommit were classified by that commit’s historical-evidence router; entries include every unsupported-family and unmapped-evidence route, not only paths present in the later incident diff.";

afterEach(() => {
  for (const directory of activeFixtures.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const git = (cwd: string, args: string[]) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
};

const runGit = async (args: string[], cwd: string, allowFailure = false) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  const normalized = { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  if (!allowFailure && normalized.status !== 0) throw new Error(`git ${args[0]} failed: ${normalized.stderr.trim()}`);
  return allowFailure ? normalized : normalized.stdout;
};

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "historical-production-release-"));
  activeFixtures.push(root);
  const origin = resolve(root, "origin.git");
  const work = resolve(root, "work");
  git(root, ["init", "--bare", origin]);
  git(root, ["init", "-b", "main", work]);
  git(work, ["config", "user.name", "Historical release fixture"]);
  git(work, ["config", "user.email", "historical-release-fixture@example.invalid"]);
  git(work, ["remote", "add", "origin", origin]);

  const seedFile = resolve(work, "README.md");
  writeFileSync(seedFile, "fixture\n");
  git(work, ["add", "README.md"]);
  git(work, ["commit", "-m", "fixture seed"]);
  const prePolicyParent = git(work, ["rev-parse", "HEAD"]);

  const legacyPath = "docs/architecture/legacy-report.json";
  mkdirSync(resolve(work, "docs/architecture"), { recursive: true });
  writeFileSync(resolve(work, legacyPath), JSON.stringify({ retained: true }) + "\n");
  git(work, ["add", legacyPath]);
  git(work, ["commit", "-m", "policy baseline"]);
  const baselineCommit = git(work, ["rev-parse", "HEAD"]);
  const baselineTree = git(work, ["rev-parse", `${baselineCommit}^{tree}`]);
  const blobSha = git(work, ["rev-parse", `${baselineCommit}:${legacyPath}`]);
  const entry = {
    path: legacyPath,
    blobSha,
    kind: "archived-report-or-capture",
    disposition: "legacy-archival-unverified" as const,
    family: null,
    ordinaryCiOwner: null,
    limitation: "No equivalent retained integrity validator is available; this exact blob remains unverified.",
  };
  const entries = [entry];
  const baseline = {
    schemaVersion: 1 as const,
    policy: {
      id: "fixture-policy",
      policyCommit: baselineCommit,
      policyTree: baselineTree,
      prePolicyParent,
      acceptedDisposition: "Unchanged exact blobs remain unverified; this is not validator success.",
    },
    inventory: {
      entryCount: entries.length,
      sha256: calculateBaselineInventoryDigest(entries),
      policyIntroductionRouterReasons: { "unmapped-evidence-verification-dependency": 1 },
      derivation,
    },
    entries,
  };
  const baselineIdentity = {
    ...baseline.policy,
    entryCount: baseline.inventory.entryCount,
    inventorySha256: baseline.inventory.sha256,
    policyIntroductionRouterReasons: baseline.inventory.policyIntroductionRouterReasons,
  };
  git(work, ["push", "-u", "origin", "main"]);
  const previousProduction = git(work, ["commit-tree", baselineTree, "-p", baselineCommit, "-m", "previous production"]);
  git(work, ["update-ref", "refs/heads/production", previousProduction]);
  git(work, ["push", "origin", "refs/heads/production:refs/heads/production"]);
  return { root, origin, work, legacyPath, baselineCommit, baselineTree, previousProduction, baseline, baselineIdentity };
}

function addCommit(work: string, path: string, contents: string, message: string) {
  const target = resolve(work, path);
  mkdirSync(resolve(target, ".."), { recursive: true });
  writeFileSync(target, contents);
  git(work, ["add", path]);
  git(work, ["commit", "-m", message]);
  return git(work, ["rev-parse", "HEAD"]);
}

function mergeTree(work: string, productionParent: string, sourceParent: string, tree = git(work, ["rev-parse", `${sourceParent}^{tree}`]), extraParents: string[] = []) {
  return git(work, ["commit-tree", tree, "-p", productionParent, "-p", sourceParent, ...extraParents.flatMap((parent) => ["-p", parent]), "-m", "fixture production promotion"]);
}

function eventFor(before: string, after: string) {
  return { repository: { full_name: repository }, ref: "refs/heads/production", before, after, deleted: false };
}

async function promote(fixture: ReturnType<typeof createFixture>, sourceSha: string, productionParent = fixture.previousProduction) {
  const after = mergeTree(fixture.work, productionParent, sourceSha);
  git(fixture.work, ["checkout", "--detach", after]);
  const result = await discoverProductionRelease(eventFor(productionParent, after), {
    runGit,
    repositoryRoot: fixture.work,
    baseline: fixture.baseline,
    baselineIdentity: fixture.baselineIdentity,
  });
  return { after, result };
}

describe("production historical release proof", () => {
  it("accepts only an exact two-parent promotion whose source is on main and tree matches", async () => {
    const fixture = createFixture();
    const sourceSha = addCommit(fixture.work, "src/ordinary-change.ts", "export const changed = true;\n", "ordinary main change");
    git(fixture.work, ["push", "origin", "main"]);
    const { after, result } = await promote(fixture, sourceSha);

    expect(result.decision).toBe("QUALIFIED_WITH_LEGACY_ARCHIVAL");
    expect(result.families).toEqual(HISTORICAL_EVIDENCE_MANIFEST.families.filter(({ alwaysInOrdinaryCi }) => alwaysInOrdinaryCi !== true).map(({ id }) => id));
    expect(result.releaseProof).toMatchObject({
      eventAfterSha: after,
      promotedSourceSha: sourceSha,
      verifiedMergeParents: [fixture.previousProduction, sourceSha],
      sourceTreeSha: git(fixture.work, ["rev-parse", `${sourceSha}^{tree}`]),
      destinationTreeSha: git(fixture.work, ["rev-parse", `${after}^{tree}`]),
      sourceIsVerifiedMainAncestor: true,
    });
    expect(result.qualificationCoverage.legacyDispositions).toContainEqual(expect.objectContaining({
      path: fixture.legacyPath,
      blobSha: fixture.baseline.entries[0]!.blobSha,
      disposition: "legacy-archival-unverified",
    }));
  });

  it("shares cumulative planning between production and exact source", async () => {
    const fixture = createFixture();
    const sourceSha = addCommit(fixture.work, "src/ordinary-change.ts", "export const changed = true;\n", "ordinary main change");
    git(fixture.work, ["push", "origin", "main"]);
    const { result } = await promote(fixture, sourceSha);
    const sourceTreeSha = git(fixture.work, ["rev-parse", `${sourceSha}^{tree}`]);
    const sourcePlan = await discoverCumulativeSource({ sourceSha, sourceTreeSha }, {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    });
    expect(sourcePlan.decision).toBe(result.decision);
    expect(sourcePlan.changedPaths).toEqual(result.changedPaths);
    expect(sourcePlan.families).toEqual(result.families);
    expect(sourcePlan.qualificationCoverage).toEqual(result.qualificationCoverage);
    expect(sourcePlan.releaseProof.policyIdentity).toEqual(result.releaseProof.policyIdentity);
    await expect(discoverCumulativeSource({ sourceSha, sourceTreeSha: "f".repeat(40) }, {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    })).rejects.toThrow("qualification-source-tree-mismatch");
  });

  it("plans an eligible exact main source without claiming artifact validation", async () => {
    const fixture = createFixture();
    const sourceSha = addCommit(fixture.work, "src/a.ts", "export {};\n", "selected source");
    const sourceTreeSha = git(fixture.work, ["rev-parse", `${sourceSha}^{tree}`]);
    const newer = addCommit(fixture.work, "src/b.ts", "export {};\n", "later main");
    git(fixture.work, ["push", "origin", "main"]);
    const options = { runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity };
    const source = { repository, sourceSha, sourceTreeSha, expectedMainSha: newer };
    const plan = await planMainSource(source, options);
    expect(plan.planOnly).toBe(true);
    expect(plan.fetchedMainSha).toBe(newer);
    expect(plan.changedPaths).toContain("src/a.ts");
    expect(plan.changedPaths).not.toContain("src/b.ts");
    await expect(planMainSource({ ...source, repository: "invalid" }, options)).rejects.toThrow("source-plan-repository-mismatch");
    await expect(planMainSource({ ...source, expectedMainSha: sourceSha }, options)).rejects.toThrow("source-plan-main-identity-mismatch");
    await expect(planMainSource({ ...source, sourceTreeSha: "f".repeat(40) }, options)).rejects.toThrow("qualification-source-tree-mismatch");
    const unrelated = git(fixture.work, ["commit-tree", sourceTreeSha, "-p", fixture.baselineCommit, "-m", "feature-only"]);
    await expect(planMainSource({ ...source, sourceSha: unrelated }, options)).rejects.toThrow("source-plan-source-not-on-main");
  });

  it("rejects a tree mismatch even when the merge parents look canonical", async () => {
    const fixture = createFixture();
    const sourceSha = addCommit(fixture.work, "src/main.ts", "export {};\n", "main source");
    git(fixture.work, ["push", "origin", "main"]);
    const wrongTree = git(fixture.work, ["rev-parse", `${fixture.baselineCommit}^{tree}`]);
    const after = mergeTree(fixture.work, fixture.previousProduction, sourceSha, wrongTree);
    git(fixture.work, ["checkout", "--detach", after]);
    await expect(discoverProductionRelease(eventFor(fixture.previousProduction, after), {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    })).rejects.toThrow("production-promotion-source-and-destination-trees-differ");
  });

  it("rejects an incorrect first parent and an unexpected merge topology", async () => {
    const fixture = createFixture();
    const sourceSha = addCommit(fixture.work, "src/main.ts", "export {};\n", "main source");
    git(fixture.work, ["push", "origin", "main"]);
    const wrongFirstParent = git(fixture.work, ["commit-tree", git(fixture.work, ["rev-parse", `${sourceSha}^{tree}`]), "-p", fixture.baselineCommit, "-p", sourceSha, "-m", "wrong first parent"]);
    git(fixture.work, ["checkout", "--detach", wrongFirstParent]);
    await expect(discoverProductionRelease(eventFor(fixture.previousProduction, wrongFirstParent), {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    })).rejects.toThrow("production-promotion-first-parent-does-not-match-event-before");

    const oneParent = git(fixture.work, ["commit-tree", git(fixture.work, ["rev-parse", `${sourceSha}^{tree}`]), "-p", fixture.previousProduction, "-m", "not a merge"]);
    git(fixture.work, ["checkout", "--detach", oneParent]);
    await expect(discoverProductionRelease(eventFor(fixture.previousProduction, oneParent), {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    })).rejects.toThrow("production-promotion-merge-topology-not-two-parent");

    const threeParents = mergeTree(fixture.work, fixture.previousProduction, sourceSha, undefined, [fixture.baselineCommit]);
    git(fixture.work, ["checkout", "--detach", threeParents]);
    await expect(discoverProductionRelease(eventFor(fixture.previousProduction, threeParents), {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    })).rejects.toThrow("production-promotion-merge-topology-not-two-parent");
  });

  it("rejects an unrelated source revision and an incompatible baseline identity", async () => {
    const fixture = createFixture();
    const sourceSha = addCommit(fixture.work, "src/main.ts", "export {};\n", "main source");
    git(fixture.work, ["push", "origin", "main"]);
    const unrelatedSha = git(fixture.work, ["commit-tree", git(fixture.work, ["rev-parse", `${fixture.baselineCommit}^{tree}`]), "-p", fixture.baselineCommit, "-m", "unrelated source"]);
    const unrelatedPromotion = mergeTree(fixture.work, fixture.previousProduction, unrelatedSha);
    git(fixture.work, ["checkout", "--detach", unrelatedPromotion]);
    await expect(discoverProductionRelease(eventFor(fixture.previousProduction, unrelatedPromotion), {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    })).rejects.toThrow("promoted-source-is-not-a-verified-main-revision");

    const wrongBaseline = structuredClone(fixture.baseline);
    wrongBaseline.policy.policyTree = "0".repeat(40);
    const promotion = mergeTree(fixture.work, fixture.previousProduction, sourceSha);
    git(fixture.work, ["checkout", "--detach", promotion]);
    await expect(discoverProductionRelease(eventFor(fixture.previousProduction, promotion), {
      runGit, repositoryRoot: fixture.work, baseline: wrongBaseline, baselineIdentity: fixture.baselineIdentity,
    })).rejects.toThrow("legacy-baseline-tree-identity-mismatch");
  });

  it("uses the same fail-closed route for unknown archive additions in development and production", async () => {
    const fixture = createFixture();
    const newEvidencePath = "docs/architecture/opaque-archive-directory/new.json";
    const developmentRoute = classifyCompleteChangedPaths([newEvidencePath]);
    const sourceSha = addCommit(fixture.work, newEvidencePath, "{\"newEvidence\":true}\n", "add unclassified evidence under a legacy directory");
    git(fixture.work, ["push", "origin", "main"]);
    const { result } = await promote(fixture, sourceSha);

    expect(developmentRoute).toMatchObject({
      decision: "UNVERIFIED",
      pathOwnership: [{ path: newEvidencePath, classification: "unresolved", unresolved: true }],
    });
    expect(result.qualificationCoverage.currentRouteDecision).toBe(developmentRoute.decision);
    expect(result.decision).toBe("UNVERIFIED");
    expect(result.qualificationCoverage.unresolvedPaths).toEqual([newEvidencePath]);
  });

  it("keeps registered M7R and scene-capacity ordinary-CI ownership out of unresolved routing", async () => {
    const fixture = createFixture();
    const paths = [
      "docs/architecture/GROUND_GLASS_M7R_BROAD_E2E_QUALIFICATION_RECOVERY_REPORT.json",
      "docs/architecture/ground-glass-m7r-e2e-recovery/capture/final/normalized-capture.json",
      "src/render/sceneCapacityBenchmarkQualification.ts",
      "src/tests/unit/sceneCapacityBenchmarkQualification.test.ts",
    ];
    let sourceSha = "";
    for (let index = 0; index < paths.length; index += 1) {
      sourceSha = addCommit(fixture.work, paths[index]!, `registered ordinary CI input ${index}\n`, `change ordinary CI input ${index}`);
    }
    git(fixture.work, ["push", "origin", "main"]);
    const { result } = await promote(fixture, sourceSha);

    expect(result.decision).toBe("QUALIFIED_WITH_LEGACY_ARCHIVAL");
    expect(result.qualificationCoverage.currentRouteDecision).toBe("NOT_APPLICABLE");
    expect(result.qualificationCoverage.unresolvedPaths).toEqual([]);
    expect(result.qualificationCoverage.ordinaryCiOwnedPaths).toEqual(expect.arrayContaining([
      { path: paths[0], owners: ["ordinary-ci:evidence:check:m7r"] },
      { path: paths[1], owners: ["ordinary-ci:evidence:check:m7r"] },
      { path: paths[2], owners: ["ordinary-ci:unit-tests"] },
      { path: paths[3], owners: ["ordinary-ci:unit-tests"] },
    ]));
    expect(result.currentOwners).toContain("ordinary-ci:evidence:check:m7r");
    expect(result.currentOwners).toContain("ordinary-ci:unit-tests");
    expect(result.qualificationCoverage.nonEvidencePaths).toEqual([]);
  });

  it("keeps legitimate new architecture documentation non-applicable in the shared production route", async () => {
    const fixture = createFixture();
    const path = "docs/architecture/new-camera-movement-design.md";
    const sourceSha = addCommit(fixture.work, path, "Design notes for a future lesson.\n", "add architecture design documentation");
    git(fixture.work, ["push", "origin", "main"]);
    const { result } = await promote(fixture, sourceSha);

    expect(classifyCompleteChangedPaths([path])).toMatchObject({
      decision: "NOT_APPLICABLE",
      pathOwnership: [{ path, classification: "non-evidence" }],
    });
    expect(result.qualificationCoverage.currentRouteDecision).toBe("NOT_APPLICABLE");
    expect(result.qualificationCoverage.nonEvidencePaths).toEqual([path]);
    expect(result.qualificationCoverage.unresolvedPaths).toEqual([]);
    expect(result.decision).toBe("QUALIFIED_WITH_LEGACY_ARCHIVAL");
  });

  it("fails closed for an unknown addition under a registered historical evidence root", async () => {
    const fixture = createFixture();
    const path = "docs/architecture/anatomy-gpu-blend-intermediate/unregistered-report.json";
    const sourceSha = addCommit(fixture.work, path, "{\"unowned\":true}\n", "add unknown evidence under an audited archive root");
    git(fixture.work, ["push", "origin", "main"]);
    const { result } = await promote(fixture, sourceSha);

    expect(classifyCompleteChangedPaths([path])).toMatchObject({
      decision: "UNVERIFIED",
      pathOwnership: [{ path, classification: "unresolved", unresolved: true }],
    });
    expect(result.qualificationCoverage.currentRouteDecision).toBe("UNVERIFIED");
    expect(result.qualificationCoverage.unresolvedPaths).toEqual([path]);
  });

  it("invalidates an exact archive disposition when the protected file is renamed", async () => {
    const fixture = createFixture();
    const renamedPath = "docs/architecture/legacy-report-renamed.json";
    git(fixture.work, ["mv", fixture.legacyPath, renamedPath]);
    git(fixture.work, ["commit", "-am", "rename the protected legacy report"]);
    const sourceSha = git(fixture.work, ["rev-parse", "HEAD"]);
    git(fixture.work, ["push", "origin", "main"]);
    const { result } = await promote(fixture, sourceSha);

    expect(result.decision).toBe("UNVERIFIED");
    expect(result.qualificationCoverage.invalidatedBaselinePaths).toContainEqual(expect.objectContaining({
      path: fixture.legacyPath,
      currentBlobSha: null,
      reason: "baseline-protected-path-deleted",
    }));
    expect(result.changedPaths).toEqual(expect.arrayContaining([fixture.legacyPath, renamedPath]));
    expect(result.qualificationCoverage.unresolvedPaths).toEqual(expect.arrayContaining([fixture.legacyPath, renamedPath]));
  });

  it("rejects wrong event repository, ref, head, and missing source identity", async () => {
    const fixture = createFixture();
    const sourceSha = addCommit(fixture.work, "src/main.ts", "export {};\n", "main source");
    git(fixture.work, ["push", "origin", "main"]);
    const after = mergeTree(fixture.work, fixture.previousProduction, sourceSha);
    git(fixture.work, ["checkout", "--detach", after]);
    const validEvent = eventFor(fixture.previousProduction, after);
    await expect(discoverProductionRelease({ ...validEvent, ref: "refs/heads/main" }, {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    })).rejects.toThrow("production-release-ref-mismatch");
    await expect(discoverProductionRelease({ ...validEvent, repository: { full_name: "other/repository" } }, {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    })).rejects.toThrow("production-release-repository-mismatch");
    await expect(discoverProductionRelease({ ...validEvent, after: fixture.previousProduction }, {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    })).rejects.toThrow("checked-out-head-does-not-match-production-event-after");
    await expect(discoverProductionRelease({ ...validEvent, before: "f".repeat(40) }, {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    })).rejects.toThrow("production-event-before-commit-unavailable");
    expect(shaPattern.test(sourceSha)).toBe(true);
  });

  it("keeps a failed cumulative evidence range visible after production advances by a small promotion", async () => {
    const fixture = createFixture();
    const largeSource = addCommit(
      fixture.work,
      "docs/architecture/new-unowned-capture-report.json",
      JSON.stringify({ unowned: true }) + "\n",
      "large source adds unowned historical evidence",
    );
    git(fixture.work, ["push", "origin", "main"]);
    const failedPromotion = mergeTree(fixture.work, fixture.previousProduction, largeSource);
    git(fixture.work, ["checkout", "--detach", failedPromotion]);
    const failedResult = await discoverProductionRelease(eventFor(fixture.previousProduction, failedPromotion), {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    });
    expect(failedResult.decision).toBe("UNVERIFIED");
    expect(failedResult.changedPaths).toContain("docs/architecture/new-unowned-capture-report.json");
    expect(failedResult.qualificationCoverage.unresolvedPaths).toEqual([
      "docs/architecture/new-unowned-capture-report.json",
    ]);

    git(fixture.work, ["checkout", "main"]);
    const smallSource = addCommit(fixture.work, "src/small-follow-up.ts", "export const followUp = true;\n", "small follow-up");
    git(fixture.work, ["push", "origin", "main"]);
    const nextPromotion = mergeTree(fixture.work, failedPromotion, smallSource);
    git(fixture.work, ["checkout", "--detach", nextPromotion]);
    const nextResult = await discoverProductionRelease(eventFor(failedPromotion, nextPromotion), {
      runGit, repositoryRoot: fixture.work, baseline: fixture.baseline, baselineIdentity: fixture.baselineIdentity,
    });
    expect(nextResult.eventChangedPaths).toEqual(["src/small-follow-up.ts"]);
    expect(nextResult.changedPaths).toContain("docs/architecture/new-unowned-capture-report.json");
    expect(nextResult.decision).toBe("UNVERIFIED");
  });
});
