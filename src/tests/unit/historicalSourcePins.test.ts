import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HISTORICAL_EVIDENCE_MANIFEST, classifyChangedPaths } from "../../../scripts/historical-evidence-routing.mjs";
// @ts-expect-error JavaScript helper
import { expectedSourcePins, verifySourcePins } from "../../../scripts/historical-source-pins.mjs";

const families = HISTORICAL_EVIDENCE_MANIFEST.families.filter((f) => !f.alwaysInOrdinaryCi).map((f) => f.id);
const source = "a".repeat(40);
const inventory = () => expectedSourcePins(source, families, process.cwd(), (path: string) => readFileSync(path));
const records = () => inventory().map((pin: object) => ({ ...pin, exitCode: 0 }));

describe("source pin evidence", () => {
  it("accepts the complete manifest-derived inventory including dynamic M7W paths", () => {
    const pins = inventory();
    const m7w = pins.find((p: { id: string }) => p.id === "m7w-execution");
    expect(m7w.verifyPaths.length).toBeGreaterThan(1);
    expect(verifySourcePins(records(), pins)).toBe(true);
  });
  it.each(["empty", "missing", "duplicate", "unexpected", "sha", "ref", "path", "extra-path", "count", "exit", "dynamic"])('rejects %s', (mode) => {
    const pins = inventory(), actual = records();
    if (mode === "empty") actual.length = 0;
    if (mode === "missing") actual.pop();
    if (mode === "duplicate") actual[0] = { ...actual[1] };
    if (mode === "unexpected") actual[0].id = "unknown";
    if (mode === "sha") actual[0].sha = "0".repeat(40);
    if (mode === "ref") actual[0].retainedRef = "incorrect";
    if (mode === "path") actual[0].verifyPaths = [];
    if (mode === "extra-path") actual[0].verifyPaths = [...actual[0].verifyPaths, "extra"];
    if (mode === "count") actual[0].verifyPathCount++;
    if (mode === "exit") actual[0].exitCode = 1;
    if (mode === "dynamic") { const m = actual.find((p: { id: string }) => p.id === "m7w-execution"); m.verifyPaths = m.verifyPaths.slice(0, -1); m.verifyPathCount--; }
    expect(verifySourcePins(actual, pins)).toBe(false);
  });
});

describe("source-bound capture audit", () => {
  const path = "src/tests/render-quality/e2e/macro-tourbillon-reviewfix-capture.spec.ts";
  const helper = "src/tests/e2e/helpers/stepRangeInput.ts";
  it("classifies using supplied bytes and fails closed for changed or missing source files", () => {
    const read = (p: string) => readFileSync(p);
    expect(classifyChangedPaths([helper], { readContent: read }).decision).not.toBe("UNVERIFIED");
    expect(classifyChangedPaths([helper], { readContent: (p) => p === helper ? Buffer.from("changed") : read(p) }).decision).toBe("UNVERIFIED");
    expect(classifyChangedPaths([path], { readContent: (p) => p === path ? Buffer.from("changed") : read(p) }).decision).toBe("UNVERIFIED");
    expect(classifyChangedPaths([helper], { readContent: () => { throw new Error("missing"); } }).decision).toBe("UNVERIFIED");
  });
});
