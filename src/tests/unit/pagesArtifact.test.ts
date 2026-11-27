import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// The production helper is JavaScript and has no TypeScript declaration.
// @ts-expect-error JavaScript helper without declarations
import { candidateIdentity, contentDigest, inventory, verify, verifyPinned } from "../../../scripts/pages-artifact.mjs";

const directories: string[] = [];
const sha = "a".repeat(40), tree = "b".repeat(40);
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pages-contract-"));
  directories.push(root);
  const payload = join(root, "candidate", "payload");
  mkdirSync(join(payload, ".well-known"), { recursive: true });
  writeFileSync(join(payload, "index.html"), "hello");
  writeFileSync(join(payload, "404.html"), "hello");
  writeFileSync(join(payload, ".nojekyll"), "");
  writeFileSync(join(payload, ".well-known", "example"), "hidden");
  const files = inventory(payload);
  const manifest = { schemaVersion: 1, repository: "chau-hm/view-camera-simulator", sourceCommit: sha, sourceTree: tree, buildConfiguration: "vite-pages-v1", basePath: "/view-camera-simulator/", mode: "production", nodeVersion: "v24.3.0", packageLockSha256: "c".repeat(64), buildCommand: "npm run build -- --base=<basePath>", files, contentDigest: contentDigest(files) };
  const candidate = join(root, "candidate");
  const save = () => writeFileSync(join(candidate, "manifest.json"), JSON.stringify(manifest));
  save();
  return { root, payload, candidate, manifest, save, pin: candidateIdentity(candidate, { sourceCommit: sha, sourceTree: tree }) };
}
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { force: true, recursive: true }); });
const expected = { sourceCommit: sha, sourceTree: tree };

describe("Pages artifact integrity", () => {
  it("pins and verifies a complete candidate with hidden files", () => {
    const f = fixture();
    expect(verifyPinned(f.candidate, f.pin, expected).fileCount).toBe(4);
    expect(f.manifest.files.map((file: { path: string }) => file.path)).toContain(".well-known/example");
  });
  it("rejects simultaneous consistent payload and manifest replacement", () => {
    const f = fixture();
    writeFileSync(join(f.payload, ".well-known", "example"), "replaced");
    f.manifest.files = inventory(f.payload);
    f.manifest.contentDigest = contentDigest(f.manifest.files);
    f.save();
    expect(() => verify(f.payload, f.manifest, expected)).not.toThrow();
    expect(() => verifyPinned(f.candidate, f.pin, expected)).toThrow(/Pinned identity mismatch/);
  });
  it.each(["payload", "manifest", "source", "tree", "metadata", "missing-pin", "invalid-pin"]) ("rejects %s mutation", (change) => {
    const f = fixture();
    if (change === "payload") writeFileSync(join(f.payload, ".nojekyll"), "changed");
    if (change === "manifest") writeFileSync(join(f.candidate, "manifest.json"), JSON.stringify(f.manifest, null, 2));
    if (change === "source") { f.manifest.sourceCommit = "d".repeat(40); f.save(); }
    if (change === "tree") { f.manifest.sourceTree = "d".repeat(40); f.save(); }
    if (change === "metadata") { f.manifest.nodeVersion = "v24.4.0"; f.save(); }
    expect(() => verifyPinned(f.candidate, change === "missing-pin" ? undefined : change === "invalid-pin" ? {} : f.pin, expected)).toThrow();
  });
  it("checks a fresh retained copy and rejects loss, additions and modifications", () => {
    const f = fixture();
    writeFileSync(join(f.candidate, "validation.json"), JSON.stringify({ status: "ARTIFACT_VALIDATED", qualification: "RELEASE_QUALIFICATION_PENDING", deployment: "NOT_DEPLOYED", ...f.pin }));
    const retained = join(f.root, "retained");
    cpSync(f.candidate, retained, { recursive: true });
    expect(verifyPinned(retained, f.pin, expected, true).contentDigest).toBe(f.pin.contentDigest);
    const metadata = readFileSync(join(retained, "validation.json"));
    unlinkSync(join(retained, "validation.json"));
    expect(() => verifyPinned(retained, f.pin, expected, true)).toThrow();
    writeFileSync(join(retained, "validation.json"), metadata);
    writeFileSync(join(retained, "unexpected.log"), "private");
    expect(() => verifyPinned(retained, f.pin, expected, true)).toThrow();
    unlinkSync(join(retained, "unexpected.log"));
    unlinkSync(join(retained, "payload", ".nojekyll"));
    expect(() => verifyPinned(retained, f.pin, expected, true)).toThrow();
    writeFileSync(join(retained, "payload", ".nojekyll"), "");
    writeFileSync(join(retained, "payload", "extra"), "x");
    expect(() => verifyPinned(retained, f.pin, expected, true)).toThrow();
    unlinkSync(join(retained, "payload", "extra"));
    writeFileSync(join(retained, "payload", ".well-known", "example"), "modified");
    expect(() => verifyPinned(retained, f.pin, expected, true)).toThrow();
  });
  it("rejects invalid manifests, private files and unsupported entries", () => {
    const f = fixture();
    f.manifest.schemaVersion = 2; f.save();
    expect(() => candidateIdentity(f.candidate)).toThrow(/Invalid/);
    f.manifest.schemaVersion = 1; f.save();
    writeFileSync(join(f.payload, ".env.production"), "secret");
    expect(() => inventory(f.payload)).toThrow(/Disallowed/);
    unlinkSync(join(f.payload, ".env.production"));
    writeFileSync(join(f.payload, "credentials.json"), "secret");
    expect(() => inventory(f.payload)).toThrow(/Disallowed/);
    unlinkSync(join(f.payload, "credentials.json"));
    symlinkSync("index.html", join(f.payload, "link"));
    expect(() => inventory(f.payload)).toThrow(/Unsupported/);
  });
  it("requires a manual, read-only pilot with pin, complete upload, fresh download and verification", () => {
    const yaml = readFileSync(".github/workflows/pages-artifact-pilot.yml", "utf8");
    expect(yaml).toMatch(/workflow_dispatch:/);
    expect(yaml).toMatch(/contents: read/);
    expect(yaml).not.toMatch(/pages:\s*write|id-token:\s*write|deploy-pages|github-pages|git push/);
    expect(yaml).toMatch(/include-hidden-files: true/);
    expect(yaml).toMatch(/merge-multiple: true/);
    expect(yaml).toMatch(/artifact-ids: \$\{\{ steps.upload.outputs.artifact-id \}\}/);
    expect(yaml.indexOf("mjs pin")).toBeLessThan(yaml.indexOf("playwright.pages-artifact.config.ts"));
    expect(yaml.indexOf("playwright.pages-artifact.config.ts")).toBeLessThan(yaml.indexOf("mjs verify-pinned"));
    expect(yaml.indexOf("actions/upload-artifact")).toBeLessThan(yaml.indexOf("actions/download-artifact"));
    expect(yaml).toMatch(/pages-retained.*pages-identity\.json.*--retained/);
  });
});
