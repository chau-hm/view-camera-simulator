export interface SourceStateSnapshot {
  clean: boolean;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  changes: { path: string; indexStatus: string; worktreeStatus: string; untracked: boolean; renameSource?: boolean }[];
  fingerprint: string;
}

export function findRepositoryRoot(cwd: string): string;
export function resolveCommit(cwd: string, revision: string): string;
export function listChangedPaths(cwd: string, baseSha: string): string[];
export function snapshotSourceState(cwd: string): Promise<SourceStateSnapshot>;
export function currentCommit(cwd: string): string;
export function currentBranch(cwd: string): string;
export function safeRepositoryIdentifier(cwd: string, packageName: string): string;
export function runGit(cwd: string, args: string[]): string;
