export type HistoricalQualificationDecision = "QUALIFIED" | "QUALIFIED_WITH_LEGACY_ARCHIVAL" | "NOT_APPLICABLE" | "FAILED" | "UNVERIFIED";

export type HistoricalEvidenceFamily = Readonly<{
  id: string;
  owner?: string;
  alwaysInOrdinaryCi?: boolean;
  artifactRoots: readonly string[];
  documentationPaths?: readonly string[];
  replaySourcePaths?: readonly string[];
  commands: readonly Readonly<{ name: string; args: readonly string[] }>[];
  requiredArtifacts: readonly string[];
}>;

export const HISTORICAL_EVIDENCE_MANIFEST: Readonly<{
  repository: string;
  families: readonly HistoricalEvidenceFamily[];
  dependencies: Readonly<Record<string, readonly string[]>>;
  unsupportedFamilies: Readonly<Record<string, string>>;
  ordinaryCiPaths: readonly Readonly<{ path: string; owner: string }>[];
  sourcePins: readonly Readonly<{
    id: string;
    families: readonly string[];
    sha: string;
    retainedRef?: string;
    verifyPaths: readonly string[];
    verifyInventorySpecPathsFrom?: string;
  }>[];
}>;

export function classifyCompleteChangedPaths(changedPaths: string[]): {
  decision: HistoricalQualificationDecision;
  families: string[];
  changedPaths: string[];
  broad: boolean;
  reasons: string[];
  currentOwners: string[];
  unsupported: Array<{ id: string; reason: string }>;
};

export function classifyChangedPaths(changedPaths: string[], options?: {
  forceFull?: boolean;
  includeUnsupported?: boolean;
  reason?: string;
}): {
  decision: HistoricalQualificationDecision;
  families: string[];
  changedPaths: string[];
  broad: boolean;
  reasons: string[];
  currentOwners: string[];
  unsupported: Array<{ id: string; reason: string }>;
};

export function discoverPullRequestPaths(event: unknown, options: {
  repository: string;
  apiRequest: (path: string) => Promise<unknown>;
  maxPages?: number;
}): Promise<{ paths: string[]; pullNumber: number; headSha: string; baseSha: string; baseRef: string }>;

export function discoverPushPaths(event: unknown, options: {
  runGit: (args: string[], cwd: string, allowFailure?: boolean) => Promise<string | { status: number; stdout: string; stderr: string }>;
  repositoryRoot?: string;
}): Promise<Record<string, unknown> & { paths: string[]; noCommit?: boolean; reason?: string }>;

export function determineQualificationDecision(input: {
  routeDecision: HistoricalQualificationDecision;
  hasFamilies: boolean;
  sourceFailure?: boolean;
  missingArtifacts?: boolean;
  validatorFailure?: boolean;
  unsupported?: boolean;
}): HistoricalQualificationDecision;

export function failedClosedRoute(reason: string): {
  decision: "UNVERIFIED";
  families: string[];
  changedPaths: string[];
  broad: true;
  reasons: string[];
  currentOwners: string[];
  unsupported: [];
};

export function parseNameStatusZ(output: string): string[];
