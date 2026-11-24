export interface LocalCiOptions {
  mode: "full" | "focused" | "affected" | "core";
  base: string;
  tests: string[];
  owners: string[];
  e2eSpecs: string[];
  includeE2E: boolean;
  productionPreview: boolean;
  nativeWebGpu: boolean;
  workers: string | null;
  verbose: boolean;
  help: boolean;
}

export interface TestOwner {
  id: string;
  label?: string;
  paths: string[];
  tests?: string[];
  e2eSpecs?: string[];
  reason: string;
  fullVitest?: boolean;
  fullLocalCi?: boolean;
  requiresE2E?: boolean;
  nativeGpuRequired?: boolean;
  incompleteReason?: string;
}

export function parseLocalCiArgs(argv: string[]): LocalCiOptions;
export function nativeWebGpuAssertionForSpec(spec: string): { environmentKey: string; requiredValue: "1" } | null;
export function matchesOwnerPath(filePath: string, pattern: string): boolean;
export function resolveOwnerSelection(changedPaths: string[], owners: TestOwner[], pathExists: (path: string) => boolean): {
  ownerIds: string[];
  tests: string[];
  e2eSpecs: string[];
  e2eRequirements: { file: string; ownerIds: string[] }[];
  allDevelopmentE2EOwnerIds: string[];
  reasons: { path: string; owner: string; reason: string }[];
  unknownPaths: string[];
  staleTests: string[];
  staleSpecs: string[];
  incompleteReasons: { path: string; owner: string; reason: string }[];
  fullVitest: boolean;
  fullLocalCi: boolean;
  allDevelopmentE2E: boolean;
  nativeGpuRequired: boolean;
  requiresE2E: boolean;
  incomplete: boolean;
};
export function validateSelectedTestPaths(testPaths: string[], exists: (path: string) => boolean, isVitestPath: (path: string) => boolean): { valid: boolean; invalid: string[] };
export function parseVitestJsonReport(report: unknown): {
  discoveredFiles: number;
  discoveredSuites: number;
  discoveredCases: number;
  executedCases: number;
  passed: number;
  failed: number;
  skipped: number;
  todo: number;
  success: boolean;
  files: string[];
};
export function compareTestFileSelection(selectedFiles: string[], discoveredFiles: string[], repositoryRoot: string, options?: { matchBasenames?: boolean }): {
  matches: boolean;
  missing: string[];
  extra: string[];
};
export function parsePlaywrightJsonReport(report: unknown, repositoryRoot?: string): {
  discoveredFiles: number;
  files: string[];
  configFile: string;
  projectNames: string[];
  discoveredCases: number;
  executedCases: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  durationMs: number | "NOT_MEASURED";
};
