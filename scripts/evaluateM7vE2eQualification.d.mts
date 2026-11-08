export type M7vSkipCondition = {
  kind?: "conditional-skip-gate" | "static-skip-declaration";
  line: number;
  scope: "suite" | "test";
  sourceText: string;
  condition: string | null;
  reason: string | null;
};

export type M7vTestIdentity = {
  identity: string;
  project: string;
  specPath: string;
  relativeSpecPath: string;
  specFile: string;
  titlePath: string[];
  sourceLine: number | null;
  lane?: string;
  laneRequirement?: string;
  [key: string]: unknown;
};

export type M7vSourceEvidence = {
  identity: string;
  sourcePath: string;
  definition: { line: number; callName: string; titleExpression: string };
  skipConditions: M7vSkipCondition[];
  requiredEnvironment: string[];
  requiredBuildFlags: string[];
  declarationSignature?: Record<string, unknown>;
  unsupportedPatterns?: string[];
};

export type M7vMatrixIdentity = {
  identity: string;
  historicalM7rOutcome: string;
  historicalCategory: string;
  proposedLane: string;
  sourceEvidence: M7vSourceEvidence;
  actualSkipConditions: M7vSkipCondition[];
  requiredEnvironment: string[];
  requiredBuildFlags: string[];
  conditionalBuildFlagAssignments: Array<{ sourceEnvironment: string; requiredValue: string; flags: Array<{ name: string; value: string }> }>;
  executionEntrypoint: string | null;
  laneRequirement: string;
  approvalStatus: "pending" | "approved" | "rejected";
  approvalEvidence: string | null;
  approvalDecision: null | { approver: string; authority: "admin" | "maintain"; scope: string; policyRevision: string; rationale: string };
  [key: string]: unknown;
};

export type M7vDiscoveryProfiles = {
  standard: M7vTestIdentity[];
  native: M7vTestIdentity[];
  production: M7vTestIdentity[];
};

export type M7vPolicyInput = {
  historicalReport: {
    actionPlan?: Array<{ affectedIdentities?: string[] }>;
    testInventory: Array<Record<string, unknown> & { canonicalIdentity: string; currentSkipAudit?: Record<string, unknown>; currentActualStatus?: string }>;
    provenance: { executionSourceCommitSha: string };
    summary: { discovered: number; passed: number; unexpected: number; skipped: number; retries: number; incomplete: number };
    skipAudit: { historicalSkipped: number; individuallyRechecked: number; currentSkipped: number; approvedExclusions: number };
  };
  historicalReportSha256: string;
  matrix: { identities: M7vMatrixIdentity[]; provenance: Record<string, unknown> };
  reconciliation: {
    profiles: {
      standard: { tests: M7vTestIdentity[]; projectCounts: Record<string, number>; [key: string]: unknown };
      native: { tests: M7vTestIdentity[]; projectCounts: Record<string, number>; [key: string]: unknown };
      production: { tests: M7vTestIdentity[]; projectCounts: Record<string, number>; [key: string]: unknown };
    };
    reconciliation: {
      currentDiff: { added: string[]; removed: string[] };
      m7uAddedIdentities: string[];
      laneAssignmentCounts: Record<string, number>;
      sourceGuardAudit: { projectConditionalSkipGuards: Array<Record<string, unknown> & { identity: string }> };
      [key: string]: unknown;
    };
    playwrightConfigurationEvidence: Record<string, unknown>;
    [key: string]: unknown;
  };
  governanceReport: {
    laneEvidence: Record<string, Record<string, unknown>>;
    qualification: Record<string, string>;
    [key: string]: unknown;
  };
  packageManifest: { scripts: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; [key: string]: unknown };
  packageScriptTargetAvailability: Record<string, boolean>;
  playwrightConfigurationEvidence: Record<string, unknown>;
};

export type M7vEvaluationResult = {
  mode: string;
  integrityIssues: string[];
  approvalIssues: string[];
  qualificationIssues: string[];
  modeIssues: string[];
  policyIntegrityStatus: "passed" | "failed";
  approvalStatus: "approved" | "pending-approval";
  laneQualificationStatus: "qualified" | "not-qualified";
  qualificationStatus: string | undefined;
  approvalSummary: { pending: number; approved: number; rejected: number };
  laneCounts: Record<string, number>;
  requiredIdentitiesByLane: Record<string, string[]>;
  currentInventoryCount: number;
  m7rCurrentDiff: { added: string[]; removed: string[] };
  passed: boolean;
};

export declare const M7V_POLICY_REVISION: string;
export declare const M7V_SOURCE_DECLARATION_BASELINE_COMMIT: string;
export declare const M7V_REPOSITORY: string;
export declare const M7V_REPOSITORY_OWNER: string;
export declare const M7V_RUNNER_WORKFLOW_PATH: string;
export declare const M7V_EXECUTION_ARTIFACT_ROOT: string;
export declare const M7V_LANES: string[];
export declare const M7V_M7U_ADDITIONS: string[];
export declare const M7V_CONFIGURED_BUILD_FLAGS_BY_ENV: Record<string, Array<{ name: string; value: string }>>;
export declare function deriveM7vBuildFlagRequirements(requiredEnvironment: string[], sourceBuildFlags: string[]): {
  requiredBuildFlags: string[];
  conditionalBuildFlagAssignments: M7vMatrixIdentity["conditionalBuildFlagAssignments"];
};
export declare function collectM7vPlaywrightInventories(repositoryRoot?: string): M7vDiscoveryProfiles;
export declare function collectM7vPlaywrightConfigurationEvidence(repositoryRoot?: string): Record<string, unknown>;
export declare function collectM7vTestSourceEvidence(repositoryRoot: string, discoveredTests: M7vTestIdentity[]): Map<string, M7vSourceEvidence>;
export declare function collectM7vSourceDeclarationBaseline(
  repositoryRoot: string,
  discoveredTests: M7vTestIdentity[],
  currentSourceEvidence: Map<string, M7vSourceEvidence>,
  commitSha?: string,
): { commitSha: string; declarationsByIdentity: Map<string, unknown>; issues: string[] };
export declare function deriveM7vExecutionArtifactEvidence(input: {
  lane: string;
  artifact: unknown;
  requiredIdentities: string[];
}): {
  issues: string[];
  summary: null | { coveredIdentities: string[]; retries: number; flaky: number; incomplete: number; failed: number; skipped: number; executedIdentities: string[] };
  passedIdentities: string[];
};
export declare function extractOutcomeCoverageIssues(
  lane: string,
  evidence: Record<string, unknown>,
  requiredIdentities: string[],
  loadedArtifact: unknown,
  runnerProof: unknown,
): { integrityIssues: string[]; qualificationIssues: string[] };
export declare function verifyM7vRunnerArtifactProvenance(input: Record<string, unknown>): string[];
export declare function verifyM7vApprovalReview(input: Record<string, unknown>): string[];
export declare function loadM7vExecutionArtifacts(repositoryRoot: string, governanceReport: unknown): Map<string, unknown>;
export declare function loadM7vTrustedVerificationInputs(repositoryRoot: string, input: M7vPolicyInput, mode: string): {
  currentHeadSha: string | null;
  verifiedApprovalsByIdentity: Map<string, unknown>;
  verifiedRunnerArtifactsByLane: Map<string, unknown>;
};
export declare function evaluateM7vE2eQualification(input: M7vPolicyInput & {
  discoveryProfiles: M7vDiscoveryProfiles;
  sourceEvidenceByIdentity: Map<string, M7vSourceEvidence>;
  sourceDeclarationBaselineByIdentity?: Map<string, unknown>;
  sourceDeclarationBaselineCommitSha?: string;
  sourceDeclarationBaselineIssues?: string[];
  verifiedApprovalsByIdentity?: Map<string, unknown>;
  executionArtifactsByLane?: Map<string, unknown>;
  verifiedRunnerArtifactsByLane?: Map<string, unknown>;
  currentHeadSha?: string | null;
  mode?: "validate-policy" | "require-approved" | "require-qualified";
}): M7vEvaluationResult;
export declare function loadM7vPolicyInputs(repositoryRoot?: string): M7vPolicyInput;
export declare function summarizeM7vInventory(profiles: M7vDiscoveryProfiles): Record<string, unknown>;
