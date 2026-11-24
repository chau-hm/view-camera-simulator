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
export function aggregateLocalCiEvidence(input: {
  sourceStable: boolean | "NOT_MEASURED";
  steps: {
    runner?: string | null;
    qualification?: string | null;
    mode?: string | null;
    status: string;
    runnerEvidenceValid?: boolean;
    qualificationEvidence?: { valid?: boolean } | null;
    testFilesSelected?: string[];
    actualProjects?: string[];
    expectedConfiguration?: string | null;
    actualConfiguration?: string | null;
    nativeBackendAssertion?: { requiredValue?: string; providedValue?: string } | null;
    counts?: { files?: string[]; passed?: number; failed?: number; skipped?: number; flaky?: number } | "NOT_MEASURED";
  }[];
  requiredE2EContracts?: { file: string; owners?: ({ id: string } | string)[] }[];
  requestedE2EFiles?: string[];
  scheduledE2EFiles?: string[];
  affectedE2ERequired?: boolean;
  includeOwnerE2E?: boolean;
  qualificationRequests?: Record<string, { requested: boolean; files?: string[] }>;
}): {
  qualifications: {
    ordinaryChromium: "NOT_RUN" | "PASS" | "FAIL" | "INCOMPLETE";
    productionPreview: "NOT_RUN" | "PASS" | "FAIL" | "INCOMPLETE";
    nativeWebGpu: "NOT_RUN" | "PASS" | "FAIL" | "INCOMPLETE";
    visualEvidence: "NOT_RUN";
  };
  e2eCoverage: {
    required: { file: string; owners: string[] }[];
    requested: string[];
    includeOwnerE2E: boolean;
    scheduled: string[];
    executed: string[];
    verified: string[];
    missingRequired: { file: string; owners: string[] }[];
    status: "NOT_REQUIRED" | "PASS" | "INCOMPLETE";
  };
  limitations: string[];
};
export function writeJsonAtomically(filePath: string, value: unknown): Promise<void>;
export function sha256(value: string | Uint8Array): string;
