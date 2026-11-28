import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateA1RetainedEvidence } from "../../../scripts/validate-a1-retained-evidence.mjs";

const source = resolve("docs/architecture/environment-readiness/a1-evidence");
const temporary: string[] = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "a1-retained-evidence-"));
  temporary.push(root);
  cpSync(source, root, { recursive: true });
  return root;
}

function readRecord(root: string) {
  return JSON.parse(readFileSync(join(root, "record.json"), "utf8"));
}

afterEach(() => temporary.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("A1 retained partial evidence integrity", () => {
  it("rederives retained frame and optical controls without claiming current qualification", () => {
    expect(validateA1RetainedEvidence(source)).toEqual({
      integrity: "PASS", qualification: "PARTIAL", evidenceType: "retained-offline",
    });
  });

  it("links the qualification document to the partial offline record and its limits", () => {
    const document = readFileSync(
      "docs/architecture/environment-readiness/10-ground-glass-diagnostic-qualification.md", "utf8",
    );
    expect(document).toContain("a1-evidence/record.json");
    expect(document).toContain("previous partial qualification observations");
    expect(document).toContain("does not run a current browser or GPU");
    expect(document).toContain("does not establish complete A1 qualification");
    const record = readRecord(source);
    for (const contract of record.contracts as Array<{ id: string; status: string }>) {
      const row = document.split("\n").find((line) => line.startsWith(`| ${contract.id} `));
      expect(row, `missing document row for ${contract.id}`).toBeDefined();
      expect(row).toMatch(/\| Partial \|/);
      expect(contract.status).toBe("PARTIAL");
    }
  });

  it("fails when required raw evidence is absent or altered", () => {
    const root = fixture();
    rmSync(join(root, "control-next-request-final32.rgba"));
    expect(() => validateA1RetainedEvidence(root)).toThrow();
    cpSync(join(source, "control-next-request-final32.rgba"), join(root, "control-next-request-final32.rgba"));
    writeFileSync(join(root, "depth-edge.json"), "{}");
    expect(() => validateA1RetainedEvidence(root)).toThrow(/digest mismatch/);
  });

  it("rederives controls even if a modified artifact has a matching declared digest", () => {
    const root = fixture();
    const record = readRecord(root);
    const file = "depth-edge.json";
    const data = JSON.parse(readFileSync(join(root, file), "utf8"));
    data.cases["focus-foreground-400-f2_8"].legacyEdgeRedIncrease = 0;
    const bytes = Buffer.from(JSON.stringify(data));
    writeFileSync(join(root, file), bytes);
    record.files[file] = createHash("sha256").update(bytes).digest("hex");
    expect(() => validateA1RetainedEvidence(root, record)).toThrow(/legacy depth-rejection/);

    const frameFile = "control-next-request.json";
    const frame = JSON.parse(readFileSync(join(root, frameFile), "utf8"));
    frame.cameraState.focusDistanceMm = 7740;
    const frameBytes = Buffer.from(JSON.stringify(frame));
    writeFileSync(join(root, frameFile), frameBytes);
    const frameRecord = readRecord(root);
    frameRecord.files[frameFile] = createHash("sha256").update(frameBytes).digest("hex");
    cpSync(join(source, file), join(root, file));
    expect(() => validateA1RetainedEvidence(root, frameRecord)).toThrow(/stale-frame/);
  });

  it("rejects unsupported schemas, incomplete contracts and unsupported qualification", () => {
    const root = fixture();
    const record = readRecord(root);
    record.schemaVersion = 2;
    expect(() => validateA1RetainedEvidence(root, record)).toThrow();
    record.schemaVersion = 1;
    record.contracts.pop();
    expect(() => validateA1RetainedEvidence(root, record)).toThrow();
    record.contracts = readRecord(root).contracts;
    record.decision = "QUALIFIED";
    expect(() => validateA1RetainedEvidence(root, record)).toThrow();
    record.decision = "PARTIAL";
    record.contracts[3].status = "QUALIFIED";
    expect(() => validateA1RetainedEvidence(root, record)).toThrow();
  });

  it("rejects contradictory control outcomes and evidence provenance", () => {
    const root = fixture();
    const record = readRecord(root);
    record.contracts[2].negative = [];
    expect(() => validateA1RetainedEvidence(root, record)).toThrow(/contradictory/);
    record.contracts = readRecord(root).contracts;
    record.provenance.sourceCommit = "0".repeat(40);
    expect(() => validateA1RetainedEvidence(root, record)).toThrow(/provenance/);
  });
});
