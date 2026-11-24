export function evaluateEnvironmentRequirements(input: {
  nodeVersion: string;
  npmVersion: string;
  npmAvailable: boolean;
  dependenciesAvailable: boolean;
  playwrightRequested: boolean;
  playwrightPackageAvailable: boolean;
  browserAvailable: boolean;
  nativeWebGpuRequested: boolean;
  systemChromeAvailable: boolean;
}): { checks: { id: string; status: string; [key: string]: unknown }[]; issues: string[]; passed: boolean };
export function determineOverallStatus(input: {
  sourceStable: boolean | "NOT_MEASURED";
  failedStep: boolean;
  steps: { status: string }[];
  incomplete: boolean;
  preflightIssues?: string[];
  interrupted?: boolean;
}): "PASS" | "FAIL" | "INCOMPLETE" | "NOT_RUN";
export function applyRunnerEvidenceStatus(
  commandStatus: "PASS" | "FAIL" | "INCOMPLETE",
  runner: "vitest" | "playwright",
  counts: { success?: boolean; failed?: number; skipped?: number; flaky?: number; todo?: number },
): "PASS" | "FAIL" | "INCOMPLETE";
export function writeJsonAtomically(filePath: string, value: unknown): Promise<void>;
export function sha256(value: string | Uint8Array): string;
