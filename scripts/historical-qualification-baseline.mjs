import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const baselinePath = resolve(process.cwd(), "scripts/historical-qualification-baseline.json");
export const HISTORICAL_QUALIFICATION_BASELINE = JSON.parse(readFileSync(baselinePath, "utf8"));
export const HISTORICAL_QUALIFICATION_BASELINE_IDENTITY = Object.freeze({
  id: "change-triggered-historical-qualification-v1",
  policyCommit: "a0b2fa4b2b9acc323c64a057599d10d3063cef8b",
  policyTree: "9643611510e9856890934097250423b7de65ded4",
  prePolicyParent: "981fea7e0e969a7494ad58b319d906650ad7c891",
  acceptedDisposition: "Unchanged baseline blobs may remain as explicitly unverified archive/documentation; this is not validator success.",
  entryCount: 139,
  inventorySha256: "a6e664949cb9050de85f9dafb2ead7df549e236cbd431ff3144d5e7a75922d76",
  policyIntroductionRouterReasons: Object.freeze({
    "unsupported-or-unmapped-historical-family": 62,
    "unmapped-evidence-verification-dependency": 77,
  }),
});
const shaPattern = /^[0-9a-f]{40}$/i;
const allowedDispositions = new Set([
  "current-validator",
  "documentation-only",
  "legacy-archival-unverified",
  "ordinary-ci-code",
]);

export function parseGitTreeZ(output) {
  const tree = new Map();
  for (const record of output.split("\0")) {
    if (!record) continue;
    const tab = record.indexOf("\t");
    if (tab < 0) throw new Error("git-tree-record-incomplete");
    const [mode, type, oid] = record.slice(0, tab).split(" ");
    const path = record.slice(tab + 1);
    if (type !== "blob" || !shaPattern.test(oid ?? "") || !path || tree.has(path)) {
      throw new Error(`git-tree-record-invalid:${path || "<empty>"}`);
    }
    tree.set(path, oid);
  }
  return tree;
}

function inventoryLine(entry) {
  return [entry.path, entry.blobSha, entry.kind, entry.disposition, entry.family ?? "", entry.ordinaryCiOwner ?? "", entry.limitation].join("\0");
}

export function calculateBaselineInventoryDigest(entries) {
  return createHash("sha256")
    .update([...entries].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0).map(inventoryLine).join("\n"))
    .digest("hex");
}

/** Checks manifest shape and its exact identities against the immutable policy-introduction tree. */
export function verifyBaselineManifest(baseline, policyTree, expectedIdentity = HISTORICAL_QUALIFICATION_BASELINE_IDENTITY) {
  const errors = [];
  if (baseline?.schemaVersion !== 1) errors.push("legacy-baseline-schema-unsupported");
  const policy = baseline?.policy;
  if (!policy || !shaPattern.test(policy.policyCommit ?? "") || !shaPattern.test(policy.policyTree ?? "") ||
      !shaPattern.test(policy.prePolicyParent ?? "")) errors.push("legacy-baseline-policy-identity-incomplete");
  const entries = baseline?.entries;
  if (!Array.isArray(entries) || !Number.isSafeInteger(baseline?.inventory?.entryCount) ||
      baseline.inventory.entryCount !== entries.length) {
    errors.push("legacy-baseline-entry-inventory-incomplete");
    return { valid: false, errors };
  }
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.path !== "string" || !entry.path || entry.path.startsWith("/") ||
        entry.path.split("/").includes("..") || !shaPattern.test(entry.blobSha ?? "") ||
        !allowedDispositions.has(entry.disposition) || typeof entry.kind !== "string" ||
        typeof entry.limitation !== "string" || !entry.limitation) {
      errors.push(`legacy-baseline-entry-invalid:${entry?.path ?? "<missing>"}`);
      continue;
    }
    if (seen.has(entry.path)) errors.push(`legacy-baseline-path-duplicated:${entry.path}`);
    seen.add(entry.path);
    if (!policyTree?.has(entry.path)) errors.push(`legacy-baseline-path-missing-from-policy-tree:${entry.path}`);
    else if (policyTree.get(entry.path) !== entry.blobSha) errors.push(`legacy-baseline-blob-mismatch:${entry.path}`);
  }
  if (baseline.inventory?.sha256 !== calculateBaselineInventoryDigest(entries)) {
    errors.push("legacy-baseline-inventory-digest-mismatch");
  }
  if (baseline.inventory?.derivation !== "All tracked paths at policyCommit were classified by that commit’s historical-evidence router; entries include every unsupported-family and unmapped-evidence route, not only paths present in the later incident diff.") {
    errors.push("legacy-baseline-derivation-missing");
  }
  const expectedReasons = expectedIdentity?.policyIntroductionRouterReasons ?? {};
  const normalizedReasons = (value) => Object.fromEntries(Object.entries(value ?? {}).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  const identityMatches = policy?.id === expectedIdentity?.id &&
    policy?.policyCommit === expectedIdentity?.policyCommit &&
    policy?.policyTree === expectedIdentity?.policyTree &&
    policy?.prePolicyParent === expectedIdentity?.prePolicyParent &&
    policy?.acceptedDisposition === expectedIdentity?.acceptedDisposition &&
    entries?.length === expectedIdentity?.entryCount &&
    baseline.inventory?.sha256 === expectedIdentity?.inventorySha256 &&
    JSON.stringify(normalizedReasons(baseline.inventory?.policyIntroductionRouterReasons)) === JSON.stringify(normalizedReasons(expectedReasons));
  if (!identityMatches) errors.push("legacy-baseline-identity-mismatch");
  return { valid: errors.length === 0, errors };
}

/** Returns only exact, unchanged entries; a newly registered family validator supersedes archival status. */
export function resolveBaselineDispositions({ baseline, sourceTree, currentValidatorFamilies = [] }) {
  const validatorFamilies = new Set(currentValidatorFamilies);
  const unchanged = [];
  const invalidated = [];
  const validatorOwned = [];
  for (const entry of baseline.entries) {
    const currentBlobSha = sourceTree.get(entry.path) ?? null;
    if (currentBlobSha !== entry.blobSha) {
      invalidated.push({
        path: entry.path,
        expectedBlobSha: entry.blobSha,
        currentBlobSha,
        reason: currentBlobSha === null ? "baseline-protected-path-deleted" : "baseline-protected-blob-changed",
      });
      continue;
    }
    if ((entry.family && validatorFamilies.has(entry.family)) || entry.disposition === "current-validator") {
      validatorOwned.push({ ...entry, currentBlobSha, supersededBy: entry.family ?? "registered-historical-validator" });
      continue;
    }
    unchanged.push({ ...entry, currentBlobSha });
  }
  return { unchanged, invalidated, validatorOwned };
}
