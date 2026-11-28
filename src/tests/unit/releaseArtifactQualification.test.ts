import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error JavaScript helper without declarations
import { expectedSourcePins } from "../../../scripts/historical-source-pins.mjs";
import { HISTORICAL_EVIDENCE_MANIFEST } from "../../../scripts/historical-evidence-routing.mjs";
// @ts-expect-error JavaScript helper without declarations
import { qualifyCandidate, verifyReleaseBContract } from "../../../scripts/release-artifact-qualify.mjs";

const source = "a".repeat(40), tree = "b".repeat(40), main = "c".repeat(40);
const args = [source, "10", "2", "20", "1", "30"];
const families = HISTORICAL_EVIDENCE_MANIFEST.families.filter(({ alwaysInOrdinaryCi }) => !alwaysInOrdinaryCi);
const validators = families.flatMap((family) => family.commands.map((command) => ({ family: family.id, name: command.name, exitCode: 0 })));
validators.push({ family: "M7F", name: "standalone versus M7G child replay equivalence", exitCode: 0 });
function fixture() {
  const candidate = { status: "RELEASE_PREFLIGHT_VERIFIED", qualification: "RELEASE_QUALIFICATION_PENDING", deployment: "NOT_DEPLOYED", repository: "chau-hm/view-camera-simulator", source, tree, main, ci: { runId: "10", attempt: 2 }, producer: { runId: "20", attempt: 1 }, artifact: { id: "30", transportDigest: `sha256:${"d".repeat(64)}` }, identity: { sourceCommit: source, sourceTree: tree, manifestSha256: "e".repeat(64), contentDigest: "f".repeat(64) } };
  const plan = { planOnly: true, decision: "QUALIFIED_WITH_LEGACY_ARCHIVAL", fetchedMainSha: main, releaseProof: { promotedSourceSha: source, sourceTreeSha: tree, policyIdentity: { commit: "baseline" } }, qualificationCoverage: { unresolvedPaths: [] as string[], legacyDispositions: [{ path: "archive" }] }, unsupported: [], families: families.map(({ id }) => id), changedPaths: ["src/a"], planningTimings: { baselineMs: 1, routingMs: 1 } };
  const pins = expectedSourcePins(source, families.map(({ id }) => id), process.cwd(), (path: string) => readFileSync(path));
  const pinInventory = () => pins;
  const evidence = { evidenceOnly: true, sourceSha: source, sourceTreeSha: tree, qualificationManifestBlob: "f".repeat(40), families: families.map(({ id }) => id), validators: validators.map((v) => ({ ...v })), sourceFetches: pins.map((pin: object) => ({ ...pin, exitCode: 0 })), missingArtifacts: [], checkoutMs: 1, installMs: 1, executionMs: 1 };
  const preflight = vi.fn(async () => candidate);
  const planner = vi.fn(async () => plan);
  const execute = vi.fn(async () => evidence);
  const runGit = vi.fn(async () => `${main}\trefs/heads/main\n`);
  return { candidate, plan, evidence, preflight, planner, execute, runGit, pinInventory };
}

describe("release artifact historical qualification", () => {
  it("requires the reviewed Release B implementation to be tracked and unchanged", async () => {
    const reviewed: Record<string, string> = {
      "scripts/release-artifact-preflight.mjs": "2d1e8c14258b5cf0d330dbdc96f9af7661ba2421",
      "scripts/extract-pages-artifact.py": "716bdcc4e0f5ee7d74dbe68faf702672b9919914",
      "scripts/pages-artifact.mjs": "2e5268c81b9ee0cc6ed9fe2b677b82aa1770667d",
    };
    const runGit = async (args: string[]) => {
      if (args[0] === "remote") return { status: 0, stdout: "https://github.com/chau-hm/view-camera-simulator.git", stderr: "" };
      if (args[0] === "ls-remote") return { status: 0, stdout: `${"b".repeat(40)}\trefs/heads/main`, stderr: "" };
      if (args.at(-1) === "refs/remotes/origin/main^{commit}") return { status: 0, stdout: "b".repeat(40), stderr: "" };
      if (args[0] === "diff") return { status: 0, stdout: "", stderr: "" };
      const path = args.at(-1)!.replace(/^(?:HEAD|refs\/remotes\/origin\/main):/, "");
      const value = reviewed[path] ?? "a".repeat(40);
      return { status: 0, stdout: value, stderr: "" };
    };
    await expect(verifyReleaseBContract({ runGit })).resolves.toBeUndefined();
    for (const path of ["scripts/historical-qualification-baseline.mjs", "scripts/historical-qualification-baseline.json", "scripts/release-candidate-eligibility.mjs"]) {
      await expect(verifyReleaseBContract({ runGit: async (args: string[]) => args[0] === "diff" && args.at(-1) === path ? { status: 1, stdout: "", stderr: "" } : runGit(args) })).rejects.toThrow("orchestration-not-canonical");
      await expect(verifyReleaseBContract({ runGit: async (args: string[]) => args.at(-1) === `HEAD:${path}` ? { status: 1, stdout: "", stderr: "" } : runGit(args) })).rejects.toThrow("orchestration-not-canonical");
      await expect(verifyReleaseBContract({ runGit: async (args: string[]) => args.at(-1) === `HEAD:${path}` ? { status: 0, stdout: "c".repeat(40), stderr: "" } : runGit(args) })).rejects.toThrow("orchestration-not-canonical");
    }
    await expect(verifyReleaseBContract({ runGit: async (args: string[]) => args[0] === "ls-remote" ? { status: 0, stdout: `${"c".repeat(40)}\trefs/heads/main`, stderr: "" } : runGit(args) })).rejects.toThrow("main-stale");
    await expect(verifyReleaseBContract({ runGit: async () => ({ status: 1, stdout: "", stderr: "" }) })).rejects.toThrow("remote-mismatch");
    await expect(verifyReleaseBContract({ runGit: async (args: string[]) => args.at(-1)?.startsWith("HEAD:") ? { status: 1, stdout: "", stderr: "" } : runGit(args) })).rejects.toThrow("not-integrated");
    await expect(verifyReleaseBContract({ runGit: async (args: string[]) => args[0] === "diff" ? { status: 1, stdout: "", stderr: "" } : runGit(args) })).rejects.toThrow("modified");
    await expect(verifyReleaseBContract({ runGit: async (args: string[]) => args.at(-1) === "HEAD:scripts/release-candidate.mjs" ? { status: 1, stdout: "", stderr: "" } : runGit(args) })).rejects.toThrow("orchestration-not-canonical");
  });
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
