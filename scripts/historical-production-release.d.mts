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

/** Plans cumulative source evidence only; does not establish artifact trust or execute validators. */
export function discoverCumulativeSource(source: { sourceSha: string; sourceTreeSha: string }, options: {
  runGit: (args: string[], cwd: string, allowFailure?: boolean) => Promise<string | { status: number; stdout: string; stderr: string }>;
  repositoryRoot?: string;
  baseline?: HistoricalQualificationBaseline;
  baselineIdentity?: Readonly<Record<string, unknown>>;
}): Promise<Omit<Awaited<ReturnType<typeof discoverProductionRelease>>, "eventChangedPaths">>;

/** Main-ancestry-checked planning only; it does not verify a candidate or execute validators. */
export function planMainSource(source: { repository: string; sourceSha: string; sourceTreeSha: string; expectedMainSha?: string }, options: Parameters<typeof discoverCumulativeSource>[1]): Promise<Awaited<ReturnType<typeof discoverCumulativeSource>> & { planOnly: true; fetchedMainSha: string }>;
