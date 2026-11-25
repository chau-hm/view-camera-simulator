import { describe, expect, it } from "vitest";
import {
  HISTORICAL_QUALIFICATION_BASELINE,
  calculateBaselineInventoryDigest,
  resolveBaselineDispositions,
  verifyBaselineManifest,
} from "../../../scripts/historical-qualification-baseline.mjs";

const completePolicyTree = () => new Map(
  HISTORICAL_QUALIFICATION_BASELINE.entries.map(({ path, blobSha }) => [path, blobSha]),
);
type MutableBaseline = {
  schemaVersion: 1;
  policy: { id: string; policyCommit: string; policyTree: string; prePolicyParent: string; acceptedDisposition: string };
  inventory: { entryCount: number; sha256: string; policyIntroductionRouterReasons: Record<string, number>; derivation: string };
  entries: Array<{ path: string; blobSha: string; kind: string; disposition: "current-validator" | "documentation-only" | "legacy-archival-unverified" | "ordinary-ci-code"; family: string | null; ordinaryCiOwner: string | null; limitation: string }>;
};
const cloneBaseline = () => structuredClone(HISTORICAL_QUALIFICATION_BASELINE) as unknown as MutableBaseline;

describe("historical qualification legacy baseline", () => {
  it("pins a complete, sorted, exact-blob inventory from the policy introduction tree", () => {
    expect(HISTORICAL_QUALIFICATION_BASELINE.policy).toMatchObject({
      id: "change-triggered-historical-qualification-v1",
      policyCommit: "a0b2fa4b2b9acc323c64a057599d10d3063cef8b",
      policyTree: "9643611510e9856890934097250423b7de65ded4",
      prePolicyParent: "981fea7e0e969a7494ad58b319d906650ad7c891",
    });
    expect(HISTORICAL_QUALIFICATION_BASELINE.inventory).toMatchObject({
      entryCount: 139,
      policyIntroductionRouterReasons: {
        "unsupported-or-unmapped-historical-family": 62,
        "unmapped-evidence-verification-dependency": 77,
      },
    });
    expect(calculateBaselineInventoryDigest(HISTORICAL_QUALIFICATION_BASELINE.entries))
      .toBe(HISTORICAL_QUALIFICATION_BASELINE.inventory.sha256);
    const paths = HISTORICAL_QUALIFICATION_BASELINE.entries.map(({ path }) => path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual([...paths].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
    expect(verifyBaselineManifest(HISTORICAL_QUALIFICATION_BASELINE, completePolicyTree()))
      .toEqual({ valid: true, errors: [] });
  });

  it("keeps unchanged unsupported archives explicitly unverified and reports no validator success", () => {
    const sourceTree = completePolicyTree();
    const resolution = resolveBaselineDispositions({ baseline: HISTORICAL_QUALIFICATION_BASELINE, sourceTree });
    const unsupportedArchive = resolution.unchanged.find(({ family, disposition }) => family === "M7S" && disposition === "legacy-archival-unverified");
    expect(unsupportedArchive).toMatchObject({ disposition: "legacy-archival-unverified" });
    expect(unsupportedArchive?.limitation).toMatch(/No equivalent retained integrity validator is available/);
    expect(resolution.invalidated).toEqual([]);
  });

  it("supersedes an archival disposition when a family gains a current validator", () => {
    const sourceTree = completePolicyTree();
    const archivalEntry = HISTORICAL_QUALIFICATION_BASELINE.entries.find(({ family }) => family === "M7S");
    expect(archivalEntry).toBeDefined();
    const resolution = resolveBaselineDispositions({
      baseline: HISTORICAL_QUALIFICATION_BASELINE,
      sourceTree,
      currentValidatorFamilies: ["M7S"],
    });
    expect(resolution.unchanged.some(({ path }) => path === archivalEntry?.path)).toBe(false);
    expect(resolution.validatorOwned).toContainEqual(expect.objectContaining({
      path: archivalEntry?.path,
      supersededBy: "M7S",
    }));
  });

  it.each(["modified", "deleted", "renamed"]) (
    "invalidates a protected blob when its content is %s",
    (change) => {
      const sourceTree = completePolicyTree();
      const entry = HISTORICAL_QUALIFICATION_BASELINE.entries.find(({ disposition }) => disposition === "legacy-archival-unverified");
      expect(entry).toBeDefined();
      if (change === "deleted") sourceTree.delete(entry!.path);
      else if (change === "renamed") {
        sourceTree.delete(entry!.path);
        sourceTree.set(`${entry!.path}.renamed`, entry!.blobSha);
      } else sourceTree.set(entry!.path, "0".repeat(40));
      const resolution = resolveBaselineDispositions({ baseline: HISTORICAL_QUALIFICATION_BASELINE, sourceTree });
      expect(resolution.invalidated).toContainEqual(expect.objectContaining({
        path: entry!.path,
        reason: change === "modified" ? "baseline-protected-blob-changed" : "baseline-protected-path-deleted",
      }));
      expect(resolution.unchanged.some(({ path }) => path === entry!.path)).toBe(false);
    },
  );

  it("fails closed for incorrect blob identities, duplicate paths, and incomplete metadata", () => {
    const original = HISTORICAL_QUALIFICATION_BASELINE.entries[0]!;
    const wrongBlob = cloneBaseline();
    wrongBlob.entries[0]!.blobSha = "0".repeat(40);
    wrongBlob.inventory.sha256 = calculateBaselineInventoryDigest(wrongBlob.entries);
    expect(verifyBaselineManifest(wrongBlob, completePolicyTree()).errors)
      .toContain(`legacy-baseline-blob-mismatch:${original.path}`);

    const duplicate = cloneBaseline();
    duplicate.entries[1]!.path = duplicate.entries[0]!.path;
    duplicate.inventory.sha256 = calculateBaselineInventoryDigest(duplicate.entries);
    expect(verifyBaselineManifest(duplicate, completePolicyTree()).errors)
      .toContain(`legacy-baseline-path-duplicated:${duplicate.entries[0]!.path}`);

    const incomplete = cloneBaseline();
    incomplete.inventory.entryCount -= 1;
    expect(verifyBaselineManifest(incomplete, completePolicyTree()).errors)
      .toContain("legacy-baseline-entry-inventory-incomplete");
  });

  it("rejects an altered baseline inventory digest", () => {
    const altered = cloneBaseline();
    altered.inventory.sha256 = "0".repeat(64);
    expect(verifyBaselineManifest(altered, completePolicyTree()).errors)
      .toContain("legacy-baseline-inventory-digest-mismatch");
  });

  it("rejects a self-consistent inventory that attempts to change the audited legacy set", () => {
    const altered = cloneBaseline();
    altered.entries.pop();
    altered.inventory.entryCount = altered.entries.length;
    altered.inventory.sha256 = calculateBaselineInventoryDigest(altered.entries);
    const errors = verifyBaselineManifest(altered, completePolicyTree()).errors;
    expect(errors).toContain("legacy-baseline-identity-mismatch");
  });
});
