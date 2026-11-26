import type { HistoricalQualificationDecision } from "./historical-evidence-routing.mjs";
import type { HistoricalQualificationBaseline } from "./historical-qualification-baseline.mjs";

export function discoverProductionRelease(event: unknown, options: {
  runGit: (args: string[], cwd: string, allowFailure?: boolean) => Promise<string | { status: number; stdout: string; stderr: string }>;
  repositoryRoot?: string;
  repository?: string;
  baseline?: HistoricalQualificationBaseline;
  baselineIdentity?: Readonly<Record<string, unknown>>;
}): Promise<{
  decision: HistoricalQualificationDecision;
  families: string[];
  changedPaths: string[];
  eventChangedPaths: string[];
  broad: boolean;
  reasons: string[];
  unsupported: Array<{ id: string; reason: string }>;
  currentOwners: string[];
  releaseProof: Record<string, unknown>;
  qualificationCoverage: Record<string, unknown>;
}>;
