import { describe, expect, it, vi } from "vitest";
import { HISTORICAL_EVIDENCE_MANIFEST } from "../../../scripts/historical-evidence-routing.mjs";
// @ts-expect-error JavaScript helper without declarations
import { qualifyCandidate } from "../../../scripts/release-artifact-qualify.mjs";

const source = "a".repeat(40), tree = "b".repeat(40), main = "c".repeat(40);
const args = [source, "10", "2", "20", "1", "30"];
const families = HISTORICAL_EVIDENCE_MANIFEST.families.filter(({ alwaysInOrdinaryCi }) => !alwaysInOrdinaryCi);
const validators = families.flatMap((family) => family.commands.map((command) => ({ family: family.id, name: command.name, exitCode: 0 })));
validators.push({ family: "M7F", name: "standalone versus M7G child replay equivalence", exitCode: 0 });
function fixture() {
  const candidate = { status: "RELEASE_PREFLIGHT_VERIFIED", qualification: "RELEASE_QUALIFICATION_PENDING", deployment: "NOT_DEPLOYED", repository: "chau-hm/view-camera-simulator", source, tree, main, ci: { runId: "10", attempt: 2 }, producer: { runId: "20", attempt: 1 }, artifact: { id: "30", transportDigest: `sha256:${"d".repeat(64)}` }, identity: { sourceCommit: source, sourceTree: tree, manifestSha256: "e".repeat(64), contentDigest: "f".repeat(64) } };
  const plan = { planOnly: true, decision: "QUALIFIED_WITH_LEGACY_ARCHIVAL", fetchedMainSha: main, releaseProof: { promotedSourceSha: source, sourceTreeSha: tree, policyIdentity: { commit: "baseline" } }, qualificationCoverage: { unresolvedPaths: [] as string[], legacyDispositions: [{ path: "archive" }] }, unsupported: [], families: families.map(({ id }) => id), changedPaths: ["src/a"], planningTimings: { baselineMs: 1, routingMs: 1 } };
  const evidence = { evidenceOnly: true, sourceSha: source, sourceTreeSha: tree, qualificationManifestBlob: "f".repeat(40), families: families.map(({ id }) => id), validators: validators.map((v) => ({ ...v })), sourceFetches: [{ exitCode: 0 }], missingArtifacts: [], checkoutMs: 1, installMs: 1, executionMs: 1 };
  const preflight = vi.fn(async () => candidate);
  const planner = vi.fn(async () => plan);
  const execute = vi.fn(async () => evidence);
  const runGit = vi.fn(async () => `${main}\trefs/heads/main\n`);
  return { candidate, plan, evidence, preflight, planner, execute, runGit };
}

describe("release artifact historical qualification", () => {
  it("binds fresh preflight, source planning and completed validation without deployment authority", async () => {
    const f = fixture();
    const result = await qualifyCandidate(args, f);
    expect(result).toMatchObject({ status: "RELEASE_HISTORICALLY_QUALIFIED", historicalDecision: "QUALIFIED_WITH_LEGACY_ARCHIVAL", deploymentAuthorization: "NOT_GRANTED", deployment: "NOT_DEPLOYED", ordinaryCiReruns: 0, pagesArtifactBuilds: 0 });
    expect(f.preflight).toHaveBeenCalledWith(args);
    expect(f.planner).toHaveBeenCalledWith(expect.objectContaining({ sourceSha: source, sourceTreeSha: tree, expectedMainSha: main }), expect.anything());
    expect(f.execute).toHaveBeenCalledWith({ sourceSha: source, sourceTreeSha: tree }, expect.anything());
  });
  it("cannot use a caller-supplied result in place of the trusted preflight", async () => {
    await expect(qualifyCandidate(args)).rejects.toThrow("trusted-release-preflight-unavailable");
    const f = fixture(); f.preflight.mockRejectedValue(new Error("preflight failed"));
    await expect(qualifyCandidate(args, f)).rejects.toThrow("preflight failed");
    expect(f.planner).not.toHaveBeenCalled();
  });
  it.each(["source", "tree", "artifact", "producer", "plan-source", "unresolved", "validator", "fetch", "execution-source", "main-moved"]) ("rejects %s mismatch without deployment", async (mode) => {
    const f = fixture();
    if (mode === "source") f.candidate.source = main;
    if (mode === "tree") f.candidate.identity.sourceTree = main;
    if (mode === "artifact") f.candidate.artifact.id = "31";
    if (mode === "producer") f.candidate.producer.attempt = 2;
    if (mode === "plan-source") f.plan.releaseProof.promotedSourceSha = main;
    if (mode === "unresolved") f.plan.qualificationCoverage.unresolvedPaths = ["unknown"];
    if (mode === "validator") f.evidence.validators[0]!.exitCode = 1;
    if (mode === "fetch") f.evidence.sourceFetches[0]!.exitCode = 1;
    if (mode === "execution-source") f.evidence.sourceSha = main;
    if (mode === "main-moved") f.runGit.mockResolvedValue(`${source}\trefs/heads/main\n`);
    await expect(qualifyCandidate(args, f)).rejects.toThrow();
  });
});
