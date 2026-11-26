export type HistoricalQualificationBaselineEntry = Readonly<{
  path: string;
  blobSha: string;
  kind: string;
  disposition: "current-validator" | "documentation-only" | "legacy-archival-unverified" | "ordinary-ci-code";
  family: string | null;
  ordinaryCiOwner: string | null;
  limitation: string;
}>;

export type HistoricalQualificationBaseline = Readonly<{
  schemaVersion: 1;
  policy: Readonly<{ id: string; policyCommit: string; policyTree: string; prePolicyParent: string; acceptedDisposition: string }>;
  inventory: Readonly<{ entryCount: number; sha256: string; policyIntroductionRouterReasons: Readonly<Record<string, number>>; derivation: string }>;
  entries: readonly HistoricalQualificationBaselineEntry[];
}>;

export const HISTORICAL_QUALIFICATION_BASELINE: HistoricalQualificationBaseline;
export const HISTORICAL_QUALIFICATION_BASELINE_IDENTITY: Readonly<{
  id: string;
  policyCommit: string;
  policyTree: string;
  prePolicyParent: string;
  acceptedDisposition: string;
  entryCount: number;
  inventorySha256: string;
  policyIntroductionRouterReasons: Readonly<Record<string, number>>;
}>;

export function parseGitTreeZ(output: string): Map<string, string>;
export function calculateBaselineInventoryDigest(entries: readonly HistoricalQualificationBaselineEntry[]): string;
export function verifyBaselineManifest(baseline: HistoricalQualificationBaseline, policyTree: Map<string, string>, expectedIdentity?: typeof HISTORICAL_QUALIFICATION_BASELINE_IDENTITY): { valid: boolean; errors: string[] };
export function resolveBaselineDispositions(input: {
  baseline: HistoricalQualificationBaseline;
  sourceTree: Map<string, string>;
  currentValidatorFamilies?: readonly string[];
}): { unchanged: HistoricalQualificationBaselineEntry[]; invalidated: Array<{ path: string; expectedBlobSha: string; currentBlobSha: string | null; reason: string }>; validatorOwned: HistoricalQualificationBaselineEntry[] };
