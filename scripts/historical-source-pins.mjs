import { spawnSync } from "node:child_process";
import { HISTORICAL_EVIDENCE_MANIFEST } from "./historical-evidence-routing.mjs";

// Selection and dynamic expansion mirror the historical runner. The inventory
// document is read from the selected Git tree, never from the caller checkout.
export function expectedSourcePins(sourceSha, families, repositoryRoot = process.cwd(), readSource) {
  const read = readSource ?? ((path) => {
    const r = spawnSync("git", ["show", `${sourceSha}:${path}`], { cwd: repositoryRoot, maxBuffer: 32 * 1024 * 1024 });
    if (r.error || r.status !== 0) throw new Error("source-pin-inventory-unavailable");
    return r.stdout;
  });
  const selected = new Set(families);
  return HISTORICAL_EVIDENCE_MANIFEST.sourcePins.filter((pin) => pin.families.some((id) => selected.has(id))).map((pin) => {
    let paths = [...pin.verifyPaths];
    if (pin.verifyInventorySpecPathsFrom) {
      const tests = JSON.parse(read(pin.verifyInventorySpecPathsFrom).toString()).profiles?.standard?.tests;
      if (!Array.isArray(tests) || !tests.length || tests.some((t) => typeof t?.specPath !== "string" || !t.specPath.startsWith("src/tests/e2e/"))) throw new Error("source-pin-dynamic-inventory-invalid");
      paths = [...new Set([...paths, ...tests.map((t) => t.specPath)])];
    }
    return { id: pin.id, sha: pin.sha, retainedRef: pin.retainedRef ?? null, verifyPaths: paths, verifyPathCount: paths.length };
  });
}

export function verifySourcePins(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const seen = new Set();
  const byId = new Map(expected.map((pin) => [pin.id, pin]));
  if (byId.size !== expected.length) return false;
  return actual.every((entry) => {
    const pin = byId.get(entry?.id);
    if (!pin || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return entry.sha === pin.sha && entry.retainedRef === pin.retainedRef && entry.verifyPathCount === pin.verifyPathCount && JSON.stringify(entry.verifyPaths) === JSON.stringify(pin.verifyPaths) && entry.exitCode === 0 && !entry.error && !entry.signal;
  });
}
