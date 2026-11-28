import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
// @ts-expect-error JavaScript helper without declarations
import { checkArchive, producerPin, requireJob, verifyArtifactMetadata, verifyRun } from "../../../scripts/release-artifact-preflight.mjs";

const source = "a".repeat(40), tree = "b".repeat(40), repository = "chau-hm/view-camera-simulator";
const run = { id: 123, run_attempt: 2, path: ".github/workflows/pages.yml", workflow_id: 304398257, event: "push", status: "completed", conclusion: "success", head_sha: source, head_branch: "main", repository: { full_name: repository }, head_repository: { full_name: repository } };
const runExpected = { id: "123", attempt: "2", source, path: run.path, event: "push", workflowId: run.workflow_id };
const pin = { identityVersion: 1, sourceCommit: source, sourceTree: tree, manifestSha256: "c".repeat(64) };
const producerLog = `prepare\tPin original identity outside the candidate\t2026-01-01 ${JSON.stringify(pin)}\nprepare\tRetain candidate and identity\t2026-01-01 Artifact ID 789\nprepare\tRetrieve retained candidate into a fresh directory\t2026-01-01 (ID: 789, Size: 1)\nprepare\tVerify retained candidate\t2026-01-01 ${JSON.stringify(pin)}\n`;
const bytes = Buffer.from("archive");
const artifact = { id: 789, name: "pages-candidate-456-1", expired: false, size_in_bytes: bytes.length, digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`, created_at: "2026-01-01T00:00:00Z", expires_at: "2099-01-01T00:00:00Z", workflow_run: { id: 456, head_sha: source, head_branch: "main", repository_id: 1283640696, head_repository_id: 1283640696 } };
const artifactExpected = { artifactId: "789", producerId: "456", attempt: "1", source };

describe("trusted release artifact preflight", () => {
  it("accepts only the exact completed main run and attempt", () => {
    expect(() => verifyRun(run, runExpected)).not.toThrow();
    for (const changed of [{ run_attempt: 1 }, { conclusion: "failure" }, { head_sha: tree }, { head_branch: "feature" }, { path: "other" }, { workflow_id: 1 }, { event: "pull_request" }, { head_repository: { full_name: "fork/repo" } }]) {
      expect(() => verifyRun({ ...run, ...changed }, runExpected)).toThrow();
    }
  });
  it("requires one successful job and every named step", () => {
    const job = { name: "ci", status: "completed", conclusion: "success", steps: [{ name: "test", status: "completed", conclusion: "success" }] };
    expect(requireJob([job], "ci", ["test"])).toBe(job);
    expect(() => requireJob([job, job], "ci", ["test"])).toThrow();
    expect(() => requireJob([{ ...job, conclusion: "failure" }], "ci", ["test"])).toThrow();
    expect(() => requireJob([{ ...job, steps: [{ ...job.steps[0], conclusion: "skipped" }] }], "ci", ["test"])).toThrow();
    expect(() => requireJob([job], "ci", ["missing"])).toThrow();
  });
  it("binds producer's original and retained pins to the selected uploaded ID", () => {
    expect(producerPin(producerLog, "789")).toEqual(pin);
    expect(() => producerPin(producerLog, "78")).toThrow();
    expect(() => producerPin(producerLog.replace(JSON.stringify(pin), JSON.stringify({ ...pin, sourceTree: source })), "789")).toThrow();
    expect(() => producerPin(producerLog.replace("Verify retained candidate", "other"), "789")).toThrow();
  });
  it("rejects artifact misassociation, expiry and transport corruption", () => {
    expect(() => verifyArtifactMetadata(artifact, artifactExpected)).not.toThrow();
    for (const changed of [{ expired: true }, { expires_at: "2000-01-01" }, { name: "pages-candidate-456-2" }, { digest: null }, { workflow_run: { ...artifact.workflow_run, id: 999 } }, { workflow_run: { ...artifact.workflow_run, head_sha: tree } }]) {
      expect(() => verifyArtifactMetadata({ ...artifact, ...changed }, artifactExpected)).toThrow();
    }
    expect(() => checkArchive(artifact, bytes)).not.toThrow();
    expect(() => checkArchive(artifact, Buffer.from("corrupt"))).toThrow();
    expect(() => checkArchive({ ...artifact, size_in_bytes: 4 }, bytes)).toThrow();
  });
  it("fails closed with machine-readable status for invalid identifiers", () => {
    const result = spawnSync(process.execPath, [resolve("scripts/release-artifact-preflight.mjs"), "not-a-sha", "1", "1", "1", "1", "1"], { encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: "RELEASE_PREFLIGHT_FAILED", qualification: "RELEASE_QUALIFICATION_PENDING", deployment: "NOT_DEPLOYED" });
  });
  it.each(["traversal", "absolute", "backslash", "duplicate", "symlink", "fifo", "collision", "case-file", "unicode-file", "case-dir", "unicode-dir", "normalized-prefix", "drive", "reserved", "trailing"]) ("rejects %s zip before extraction", (kind) => {
    const dir = mkdtempSync(join(tmpdir(), "vcs-unsafe-zip-"));
    try {
      const zip = join(dir, "bad.zip"), out = join(dir, "output");
      const script = `import sys,zipfile,stat\nz=zipfile.ZipFile(sys.argv[1],'w')\nk=sys.argv[2]\nif k=='traversal': z.writestr('../escape','x')\nelif k=='absolute': z.writestr('/absolute','x')\nelif k=='backslash': z.writestr('a\\\\b','x')\nelif k=='duplicate': z.writestr('a','x'); z.writestr('a','y')\nelif k=='fifo':\n i=zipfile.ZipInfo('fifo'); i.create_system=3; i.external_attr=(stat.S_IFIFO|0o644)<<16; z.writestr(i,'x')\nelif k=='collision': z.writestr('a','x'); z.writestr('a/b','y')\nelif k=='case-file': z.writestr('payload/A.js','x'); z.writestr('payload/a.js','y')\nelif k=='unicode-file': z.writestr('payload/é.js','x'); z.writestr('payload/e\\u0301.js','y')\nelif k=='case-dir': z.writestr('payload/Assets/a.js','x'); z.writestr('payload/assets/b.js','y')\nelif k=='unicode-dir': z.writestr('payload/é/a.js','x'); z.writestr('payload/e\\u0301/b.js','y')\nelif k=='normalized-prefix': z.writestr('payload/Assets','x'); z.writestr('payload/assets/b','y')\nelif k=='drive': z.writestr('C:/escape','x')\nelif k=='reserved': z.writestr('payload/CON.txt','x')\nelif k=='trailing': z.writestr('payload/unsafe.','x')\nelse:\n i=zipfile.ZipInfo('link'); i.create_system=3; i.external_attr=(stat.S_IFLNK|0o777)<<16; z.writestr(i,'target')\nz.close()`;
      execFileSync("python3", ["-c", script, zip, kind], { stdio: "ignore" });
      const result = spawnSync("python3", [resolve("scripts/extract-pages-artifact.py"), zip, out], { encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(existsSync(out)).toBe(false);
      expect(existsSync(join(dir, "escape"))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
