export type M7gReplayKind = "m7e" | "m7f";
export const M7G_REPLAY_PROCESS_TIMEOUT_MS: number;

export type M7gReplayExecution = Readonly<{
  kind: M7gReplayKind;
  script: string;
  expectedSourceSha: string;
  expectedReplayCodeSha: string;
  timeoutMs: number;
  outputPath: string;
  nodeExecutable: string;
  invocation: string;
  spawned: boolean;
  exitCode: number | null;
  signal: string | null;
  spawnError: string | null;
  outputWasAbsentBeforeSpawn: boolean;
  reportPresent: boolean;
  reportParsed: boolean;
  reportParseError: string | null;
  reportSha256: string | null;
  reportIdentity: Readonly<Record<string, unknown>> | null;
  reportValidated: boolean;
  reportValidationIssues: readonly string[];
  stderrExcerpt: string;
  stdoutExcerpt: string;
  valid: boolean;
}>;

export type M7gReplayRun = Readonly<{
  execution: M7gReplayExecution;
  report: unknown;
  outputPath: string;
}>;

export function createFreshReplayDirectory(repoRoot: string): string;
export function runFreshReplay(args: Readonly<{
  repoRoot: string;
  replayDirectory: string;
  kind: M7gReplayKind;
  script: string;
  expectedSourceSha: string;
  expectedReplayCodeSha: string;
  env?: NodeJS.ProcessEnv;
  nodeExecutable?: string;
  timeoutMs?: number;
}>): M7gReplayRun;
