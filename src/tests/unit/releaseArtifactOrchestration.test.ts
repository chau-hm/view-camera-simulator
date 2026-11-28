import { describe, expect, it } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error JavaScript helper without declarations
import { INTEGRATED_SOURCE_BLOBS, runPreflight, verifyRun } from "../../../scripts/release-artifact-preflight.mjs";
// @ts-expect-error JavaScript fixture without declarations
import { fixture } from "./helpers/releasePreflightFixture.mjs";
// @ts-expect-error JavaScript helper without declarations
import { candidateIdentity, contentDigest, inventory } from "../../../scripts/pages-artifact.mjs";

type Fixture = ReturnType<typeof fixture>;
function execute(f: Fixture) {
  return runPreflight(f.args, { runCommand: f.command, tempRoot: f.root });
}
function assertNoSideEffects(f: Fixture) {
  expect(f.staging()).toEqual([]);
  expect(f.calls.filter(([bin]: string[]) => !["git", "gh", "python3"].includes(bin))).toEqual([]);
  const gitCalls = f.calls.filter(([bin]: string[]) => bin === "git").map((call: string[]) => call[1]);
  expect(gitCalls.every((command: string) => ["remote", "ls-remote", "rev-parse", "merge-base", "show"].includes(command))).toBe(true);
  const ghCalls = f.calls.filter(([bin]: string[]) => bin === "gh");
  expect(ghCalls.every((call: string[]) => (call[1] === "api" && call.length === 3) || (call[1] === "run" && call[2] === "view" && call.length === 9))).toBe(true);
}
function checkRejected(change: (f: Fixture) => void, message?: RegExp) {
  const f = fixture();
  try {
    change(f);
    expect(() => execute(f)).toThrow(message);
    assertNoSideEffects(f);
  } finally { f.cleanup(); }
}

describe("complete release preflight orchestration", () => {
  it.each(["current", "older"]) ("accepts an eligible %s main candidate and cleans staging", (kind) => {
    const f = fixture();
    try {
      if (kind === "current") f.main = f.localMain = f.finalMain = f.source;
      const result = execute(f);
      expect(result).toMatchObject({ status: "RELEASE_PREFLIGHT_VERIFIED", qualification: "RELEASE_QUALIFICATION_PENDING", deployment: "NOT_DEPLOYED", source: f.source, tree: f.tree, main: f.main, identity: { contentDigest: f.pin.contentDigest } });
      expect(f.calls.some(([bin]: string[]) => bin === "python3")).toBe(true);
      expect(f.calls.some((call: string[]) => call.join(" ").includes("attempts/2/jobs"))).toBe(true);
      assertNoSideEffects(f);
    } finally { f.cleanup(); }
  });
  it.each([
    ["feature-only source", (f: Fixture) => { f.ancestry = false; }, /not an ancestor/],
    ["unrelated source", (f: Fixture) => { f.ancestry = false; }, /not an ancestor/],
    ["missing source", (f: Fixture) => { f.sourceExists = false; }, /missing/],
    ["incomplete ancestry", (f: Fixture) => { f.ancestry = false; }, /not an ancestor/],
    ["stale local main", (f: Fixture) => { f.localMain = f.source; }, /stale/],
    ["wrong tree", (f: Fixture) => { f.selectedTree = f.main; }, /pin source or tree/],
    ["wrong remote", (f: Fixture) => { f.remote = "https://example.com/other.git"; }, /Unexpected repository/],
    ["workflow blob", (f: Fixture) => { f.blobs[".github/workflows/pages.yml"] = f.main; }, /unreviewed.*workflow/i],
    ["failed CI", (f: Fixture) => { f.ciRun.conclusion = "failure"; }, /Untrusted run/],
    ["pending CI", (f: Fixture) => { f.ciRun.status = "in_progress"; }, /UNVERIFIED/],
    ["canceled CI", (f: Fixture) => { f.ciRun.conclusion = "cancelled"; }, /Untrusted run/],
    ["pull request CI", (f: Fixture) => { f.ciRun.event = "pull_request"; }, /Untrusted run/],
    ["feature push CI", (f: Fixture) => { f.ciRun.head_branch = "feature"; }, /Untrusted run/],
    ["wrong CI workflow", (f: Fixture) => { f.ciRun.workflow_id = 1; }, /Untrusted run/],
    ["missing CI job", (f: Fixture) => { f.ciJobs.pop(); }, /Required job/],
    ["missing mandatory step", (f: Fixture) => { f.ciJobs[2].steps.shift(); }, /Required step/],
    ["incomplete attempt jobs", (f: Fixture) => { f.incompleteJobs = true; }, /Incomplete or mismatched/],
    ["skipped mandatory step", (f: Fixture) => { f.ciJobs[2].steps[0].conclusion = "skipped"; }, /Required step/],
    ["inherited wrong job attempt", (f: Fixture) => { f.ciJobs[2].run_attempt = 1; }, /mismatched attempt/],
    ["independently valid producer run for another source", (f: Fixture) => { f.producerRun.head_sha = f.main; verifyRun(f.producerRun, { id: "456", attempt: "1", source: f.main, path: ".github/workflows/pages-artifact-pilot.yml", event: "workflow_dispatch", workflowId: 432187587 }); }, /Untrusted run/],
    ["wrong producer attempt", (f: Fixture) => { f.producerRun.run_attempt = 2; }, /Untrusted run/],
    ["failed retained verification", (f: Fixture) => { f.producerJobs[0].steps.at(-1).conclusion = "failure"; }, /Required step/],
    ["artifact association", (f: Fixture) => { f.artifact.workflow_run.id = 777; }, /mismatched artifact/],
    ["missing artifact", (f: Fixture) => { f.missingArtifact = true; }, /not found/],
    ["expired artifact", (f: Fixture) => { f.artifact.expired = true; }, /expired/],
    ["transport digest", (f: Fixture) => { f.artifact.digest = `sha256:${"0".repeat(64)}`; }, /transport/],
    ["transport size", (f: Fixture) => { f.artifact.size_in_bytes += 1; }, /transport/],
    ["producer pin", (f: Fixture) => { f.log = f.log.replace(f.pin.sourceTree, f.main); }, /identity evidence/],
    ["unsafe zip", (f: Fixture) => { f.packUnsafe(); }, undefined],
    ["changed payload", (f: Fixture) => { writeFileSync(join(f.payload, ".nojekyll"), "changed"); f.pack(); }, /content mismatch/],
    ["changed manifest", (f: Fixture) => { f.manifest.nodeVersion = "v24.4.0"; f.saveManifest(); f.pack(); }, /Pinned identity mismatch/],
    ["changed payload and manifest", (f: Fixture) => { writeFileSync(join(f.payload, ".nojekyll"), "changed"); f.manifest.files = inventory(f.payload); f.manifest.contentDigest = contentDigest(f.manifest.files); f.saveManifest(); f.pack(); }, /Pinned identity mismatch/],
    ["missing validation", (f: Fixture) => { unlinkSync(join(f.candidate, "validation.json")); f.pack(); }, /candidate entries/],
    ["wrong lockfile", (f: Fixture) => { f.lock = Buffer.from("wrong lock"); }, /lockfile|provenance/],
    ["main moved", (f: Fixture) => { f.finalMain = f.source; }, /main changed/],
  ])("rejects %s and performs no publishing", (_label, change, message) => checkRejected(change as (f: Fixture) => void, message as RegExp | undefined));
});

function integratedFixture() {
  const f = fixture();
  f.blobs[".github/workflows/pages.yml"] = "1f2f97b115ec4baf1b18ab8f3777eabe6efaa81e";
  Object.assign(f.blobs, INTEGRATED_SOURCE_BLOBS);
  f.manifest.buildConfiguration = "vite-pages-after-typecheck-v1";
  f.manifest.buildCommand = "npm run build:production-preview:after-typecheck -- --base=<basePath>";
  f.manifest.workflow = "CI and Deploy to GitHub Pages"; f.manifest.runId = "123"; f.manifest.runAttempt = "2";
  f.saveManifest(); f.pin = candidateIdentity(f.candidate, { sourceCommit: f.source, sourceTree: f.tree });
  writeFileSync(join(f.candidate, "validation.json"), JSON.stringify({ status: "ARTIFACT_VALIDATED", qualification: "RELEASE_QUALIFICATION_PENDING", deployment: "NOT_DEPLOYED", ...f.pin }));
  f.artifact.name = "pages-candidate-123-2"; f.artifact.workflow_run.id = 123;
  f.args = [f.source, "123", "2", "123", "2", "789"];
  const names = ["Build and identify candidate", "Pin original identity outside the candidate", "Test prebuilt candidate", "Verify unchanged payload", "Retain candidate and identity", "Retrieve retained candidate into a fresh directory", "Verify retained candidate"];
  f.ciJobs[2].steps.push(...names.map((name: string) => ({ name, status: "completed", conclusion: "success" })));
  f.log = `ci\tPin original identity outside the candidate\t2026 ${JSON.stringify(f.pin)}\nci\tRetain candidate and identity\t2026 Artifact ID 789\nci\tRetrieve retained candidate into a fresh directory\t2026 (ID: 789, Size: 1)\nci\tVerify retained candidate\t2026 ${JSON.stringify(f.pin)}\n`;
  f.pack(); return f;
}

describe("integrated main CI producer", () => {
  it("verifies the exact same-run producer and retained artifact", () => {
    const f = integratedFixture(); try { expect(execute(f)).toMatchObject({ status: "RELEASE_PREFLIGHT_VERIFIED", policy: "main-ci-integrated-v1", source: f.source }); assertNoSideEffects(f); } finally { f.cleanup(); }
  });
  it.each(["wrong run", "wrong attempt", "missing typecheck", "failed retention", "wrong artifact", "wrong profile", "changed source build"])('rejects %s', (mode) => {
    const f = integratedFixture();
    try {
      if (mode === "wrong run") f.args[3] = "456";
      if (mode === "wrong attempt") f.args[4] = "1";
      if (mode === "missing typecheck") f.ciJobs[2].steps.find((s: {name: string}) => s.name === "Type-check").conclusion = "skipped";
      if (mode === "failed retention") f.ciJobs[2].steps.at(-1).conclusion = "failure";
      if (mode === "changed source build") f.blobs["vite.config.ts"] = f.main;
      if (mode === "wrong artifact") f.artifact.workflow_run.id = 456;
      if (mode === "wrong profile") { f.manifest.buildConfiguration = "vite-pages-v1"; f.saveManifest(); f.pack(); }
      expect(() => execute(f)).toThrow();
    } finally { f.cleanup(); }
  });
});
