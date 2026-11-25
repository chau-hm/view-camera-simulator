import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  M7V_POLICY_REVISION,
  M7V_EXECUTION_ARTIFACT_ROOT,
  M7V_REPOSITORY,
  M7V_REPOSITORY_OWNER,
  M7V_RUNNER_WORKFLOW_PATH,
  M7V_SOURCE_DECLARATION_BASELINE_COMMIT,
  collectM7vPlaywrightInventories,
  collectM7vSourceDeclarationBaseline,
  collectM7vTestSourceEvidence,
  deriveM7vExecutionArtifactEvidence,
  evaluateM7vE2eQualification,
  extractOutcomeCoverageIssues,
  loadM7vExecutionArtifacts,
  loadM7vPolicyInputs,
  verifyM7vApprovalReview,
  verifyM7vRunnerArtifactProvenance,
} from "../../../scripts/evaluateM7vE2eQualification.mjs";

type M7vInput = ReturnType<typeof loadM7vPolicyInputs> & {
  discoveryProfiles: ReturnType<typeof collectM7vPlaywrightInventories>;
  sourceEvidenceByIdentity: ReturnType<typeof collectM7vTestSourceEvidence>;
  sourceDeclarationBaselineByIdentity: Map<string, unknown>;
  sourceDeclarationBaselineCommitSha: string;
  sourceDeclarationBaselineIssues: string[];
  mode?: "validate-policy" | "require-approved" | "require-qualified";
};

const clone = <T>(value: T): T => structuredClone(value);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
let accepted: M7vInput;

type SyntheticTestResult = {
  status: string;
  retry: number;
  duration: number;
  workerIndex: number;
  parallelIndex: number;
  errors: unknown[];
};
type SyntheticPlaywrightTest = {
  projectName: string;
  expectedStatus: string;
  status: string;
  results: SyntheticTestResult[];
};
type SyntheticSuite = {
  title: string;
  file?: string;
  specs?: Array<{ title: string; tests: SyntheticPlaywrightTest[] }>;
  suites?: SyntheticSuite[];
};
type SyntheticArtifact = {
  schemaVersion: number;
  lane: string;
  sourceCommitSha: string;
  projectName: string;
  browser: { name: string; version: string };
  nodeVersion: string;
  playwrightVersion: string;
  playwrightReport: {
    config: { version: string; rootDir: string; retries: number; projects: Array<{ name: string; retries?: number }> };
    errors: unknown[];
    suites: SyntheticSuite[];
  };
  runtimeEvidence: Array<{
    identity: string;
    projectName: string;
    sourceCommitSha: string;
    retry: number;
    workerIndex: number;
    parallelIndex: number;
    rendererFamily: string;
    executionApi: string;
    applicationFallback: boolean;
    webglCompatibilityBackend: boolean;
    productionBundleWebGpuExcluded?: boolean;
    urlCannotEnableWebGpu?: boolean;
  }>;
};

function collectFixtureSource(source: string, testTitle: string, declaration: string) {
  const root = mkdtempSync(join(tmpdir(), "m7v-source-ast-"));
  const specPath = "src/tests/e2e/fixture.spec.ts";
  const absolutePath = join(root, specPath);
  mkdirSync(join(root, "src/tests/e2e"), { recursive: true });
  writeFileSync(absolutePath, source);
  const sourceLine = source.split("\n").findIndex((line) => line.includes(declaration)) + 1;
  if (sourceLine < 1) throw new Error(`Could not find fixture declaration: ${declaration}`);
  const identity = `chromium::fixture.spec.ts::${testTitle}`;
  const test = {
    identity,
    project: "chromium",
    specPath,
    relativeSpecPath: "fixture.spec.ts",
    specFile: "fixture.spec.ts",
    titlePath: [testTitle],
    sourceLine,
  };
  try {
    const evidence = collectM7vTestSourceEvidence(root, [test]).get(identity);
    if (!evidence) throw new Error("AST collector returned no fixture evidence.");
    return evidence;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function collectRepositoryMutation(target: NonNullable<M7vInput["discoveryProfiles"]>["standard"][number], mutate: (source: string) => string) {
  const original = readFileSync(resolve(process.cwd(), target.specPath), "utf8");
  const source = mutate(original);
  if (source === original) throw new Error(`Source mutation did not alter ${target.identity}.`);
  const root = mkdtempSync(join(tmpdir(), "m7v-source-mutation-"));
  try {
    const mutatedPath = join(root, target.specPath);
    mkdirSync(join(root, "src/tests/e2e"), { recursive: true });
    writeFileSync(mutatedPath, source);
    const evidence = collectM7vTestSourceEvidence(root, [target]).get(target.identity);
    if (!evidence) throw new Error(`Mutated AST source evidence missing for ${target.identity}.`);
    return evidence;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function validPlaywrightArtifact(lane = "ordinary-webgl", identity = "chromium::fixture.spec.ts::fixture passes"): SyntheticArtifact {
  const projectName = lane === "native-webgpu" ? "chrome-native-webgpu"
    : lane === "renderer-serial" ? "chromium-renderer-serial"
      : lane === "production-preview" ? "chromium-production-preview" : "chromium";
  const sourceCommitSha = "a".repeat(40);
  const [specFile, ...titlePath] = identity.slice(projectName.length + 2).split("::");
  let suite: SyntheticSuite = {
    title: specFile,
    file: `src/tests/e2e/${specFile}`,
    specs: [{
      title: titlePath.at(-1) ?? "",
      tests: [{
        projectName,
        expectedStatus: "passed",
        status: "expected",
        results: [{ status: "passed", retry: 0, duration: 12, workerIndex: 0, parallelIndex: 0, errors: [] }],
      }],
    }],
  };
  for (const title of titlePath.slice(0, -1).reverse()) {
    suite = { title, suites: [suite] };
  }
  const runtime = {
    identity,
    projectName,
    sourceCommitSha,
    retry: 0,
    workerIndex: 0,
    parallelIndex: 0,
    rendererFamily: lane === "native-webgpu" ? "webgpu-renderer" : "webgl-renderer",
    executionApi: lane === "native-webgpu" ? "webgpu" : "webgl2",
    applicationFallback: false,
    webglCompatibilityBackend: false,
    ...(lane === "production-preview" ? { productionBundleWebGpuExcluded: true, urlCannotEnableWebGpu: true } : {}),
  };
  return {
    schemaVersion: 1,
    lane,
    sourceCommitSha,
    projectName,
    browser: { name: "chromium", version: "140.0.0" },
    nodeVersion: "v24.3.0",
    playwrightVersion: "1.61.1",
    playwrightReport: {
      config: { version: "1.61.1", rootDir: "/tmp/src/tests/e2e", retries: 0, projects: [{ name: projectName, retries: 0 }] },
      errors: [],
      suites: [suite],
    },
    runtimeEvidence: [runtime],
  };
}

function validRunnerProof(descriptor: {
  runId: number;
  artifactId: number;
  artifactName: string;
  sourceCommitSha: string;
  archiveSha256: string;
}) {
  return {
    status: "loaded",
    repository: M7V_REPOSITORY,
    sourceTreeMatchesCurrent: true,
    run: {
      id: descriptor.runId,
      repository: { full_name: M7V_REPOSITORY },
      path: M7V_RUNNER_WORKFLOW_PATH,
      status: "completed",
      conclusion: "success",
      head_sha: descriptor.sourceCommitSha,
    },
    artifact: {
      id: descriptor.artifactId,
      name: descriptor.artifactName,
      digest: descriptor.archiveSha256,
      expired: false,
    },
  };
}

describe("M7V E2E qualification lane and skip governance", () => {
  // Three Playwright --list subprocesses can exceed Vitest's default hook limit on a loaded CI runner.
  beforeAll(() => {
    const discoveryProfiles = collectM7vPlaywrightInventories(process.cwd());
    const sourceEvidenceByIdentity = collectM7vTestSourceEvidence(process.cwd(), discoveryProfiles.standard);
    const sourceDeclarationBaseline = collectM7vSourceDeclarationBaseline(
      process.cwd(), discoveryProfiles.standard, sourceEvidenceByIdentity,
    );
    accepted = {
      ...loadM7vPolicyInputs(process.cwd()),
      discoveryProfiles,
      sourceEvidenceByIdentity,
      sourceDeclarationBaselineByIdentity: sourceDeclarationBaseline.declarationsByIdentity,
      sourceDeclarationBaselineCommitSha: sourceDeclarationBaseline.commitSha,
      sourceDeclarationBaselineIssues: sourceDeclarationBaseline.issues,
    };
  }, 60_000);

  it("accepts the reconciled 75-identity matrix without claiming a lane or broad-suite qualification", () => {
    const result = evaluateM7vE2eQualification(accepted);
    expect(result.passed, result.integrityIssues.join(", ")).toBe(true);
    expect(result.policyIntegrityStatus).toBe("passed");
    expect(result.currentInventoryCount).toBe(280);
    expect(result.laneCounts).toMatchObject({
      "ordinary-webgl": 201,
      "renderer-serial": 4,
      "native-webgpu": 73,
      "research-development": 2,
    });
    expect(result.approvalSummary).toEqual({ pending: 75, approved: 0, rejected: 0 });
    expect(result.laneQualificationStatus).toBe("not-qualified");
    expect(result.qualificationStatus).toBe("not-qualified");
    expect(result.requiredIdentitiesByLane["native-webgpu"]).toHaveLength(73);
    expect(result.requiredIdentitiesByLane["native-webgpu"].every((identity) => identity.startsWith("chrome-native-webgpu::"))).toBe(true);
  });

  it("rejects a missing historical identity", () => {
    const mutated = clone(accepted);
    mutated.matrix.identities.pop();
    const result = evaluateM7vE2eQualification(mutated);
    expect(result.integrityIssues).toContain("m7v-historical-identity-matrix-incomplete-or-duplicated");
  });

  it("rejects a duplicate historical identity", () => {
    const mutated = clone(accepted);
    mutated.matrix.identities.push(clone(mutated.matrix.identities[0]));
    const result = evaluateM7vE2eQualification(mutated);
    expect(result.integrityIssues).toContain("m7v-historical-identity-matrix-incomplete-or-duplicated");
  });

  it("rejects moving a native-required historical identity into ordinary WebGL", () => {
    const mutated = clone(accepted);
    const row = mutated.matrix.identities.find((entry) => entry.proposedLane === "native-webgpu");
    if (!row) throw new Error("Native matrix identity missing from fixture.");
    row.proposedLane = "ordinary-webgl";
    const result = evaluateM7vE2eQualification(mutated);
    expect(result.integrityIssues).toContain(`m7v-source-lane-assignment-inconsistent:${row.identity}`);
  });

  it("rejects missing source conditions and missing required environment metadata", () => {
    const mutated = clone(accepted);
    const row = mutated.matrix.identities[0];
    row.actualSkipConditions = [];
    row.requiredEnvironment = [];
    const result = evaluateM7vE2eQualification(mutated);
    expect(result.integrityIssues).toContain(`m7v-required-environment-missing:${row.identity}`);
    expect(result.integrityIssues).toContain(`m7v-source-condition-requirements-mismatch:${row.identity}`);
  });

  it("keeps per-gate build-flag assignments conditional and rejects source/config contract drift", () => {
    const missingFlag = clone(accepted);
    const row = missingFlag.matrix.identities.find((entry) => {
      const assignments = entry.conditionalBuildFlagAssignments;
      return assignments.some((assignment) => assignment.flags.some((flag) => flag.value === "false")) &&
        assignments.some((assignment) => assignment.flags.some((flag) => flag.value === "true"));
    });
    if (!row) throw new Error("Conditional build flag assignments missing from fixture.");
    const sourceFlags = row.sourceEvidence.requiredBuildFlags;
    expect(row.requiredBuildFlags).toEqual(sourceFlags);
    expect(row.conditionalBuildFlagAssignments.some((assignment) => assignment.flags.some((flag) => flag.value === "false"))).toBe(true);
    expect(row.conditionalBuildFlagAssignments.some((assignment) => assignment.flags.some((flag) => flag.value === "true"))).toBe(true);
    row.conditionalBuildFlagAssignments = [];
    row.requiredBuildFlags = [];
    expect(evaluateM7vE2eQualification(missingFlag).integrityIssues).toContain(`m7v-source-condition-requirements-mismatch:${row.identity}`);

    const changedProject = clone(accepted);
    changedProject.reconciliation.playwrightConfigurationEvidence.standardProjects = "headless-only";
    expect(evaluateM7vE2eQualification(changedProject).integrityIssues).toContain("m7v-playwright-lane-or-build-flag-contract-drift");
  });

  it("rejects source predicate changes that are absent from the recorded matrix", () => {
    const mutated = clone(accepted);
    const row = mutated.matrix.identities[0];
    row.sourceEvidence.skipConditions[0].condition = "false";
    const result = evaluateM7vE2eQualification(mutated);
    expect(result.integrityIssues).toContain(`m7v-source-skip-condition-mismatch:${row.identity}`);
  });

  it("does not treat an unsupported approval label as owner authorization", () => {
    const mutated = clone(accepted);
    const row = mutated.matrix.identities[0];
    row.approvalStatus = "approved";
    row.approvalEvidence = null;
    const result = evaluateM7vE2eQualification({ ...mutated, mode: "require-approved" });
    expect(result.integrityIssues).toContain(`m7v-approval-evidence-missing:${row.identity}`);
    expect(result.passed).toBe(false);
  });

  it("passes policy integrity with pending decisions but fails the strict approval command", () => {
    const integrity = evaluateM7vE2eQualification(accepted);
    const strict = evaluateM7vE2eQualification({ ...accepted, mode: "require-approved" });
    expect(integrity.passed).toBe(true);
    expect(strict.passed).toBe(false);
    expect(strict.modeIssues).toContain("owner-approval-pending:75");
  });

  it("rejects claimed native qualification without complete native execution evidence", () => {
    const mutated = clone(accepted);
    mutated.governanceReport.laneEvidence["native-webgpu"].status = "qualified";
    const result = evaluateM7vE2eQualification({ ...mutated, mode: "require-qualified" });
    expect(result.integrityIssues).toContain("lane-execution-artifact-missing-or-unreadable:native-webgpu");
    expect(result.qualificationIssues).toContain("lane-execution-evidence-unverified:native-webgpu");
    expect(result.passed).toBe(false);
  });

  it("rejects a research-only identity whose established entrypoint is removed", () => {
    const mutated = clone(accepted);
    const row = mutated.matrix.identities.find((entry) => entry.proposedLane === "research-development");
    if (!row) throw new Error("Research/development identity missing from fixture.");
    row.executionEntrypoint = null;
    const result = evaluateM7vE2eQualification(mutated);
    expect(result.integrityIssues).toContain(`m7v-research-lane-entrypoint-missing:${row.identity}`);

    const missingRunner = clone(accepted);
    missingRunner.packageScriptTargetAvailability["scripts/dream-loop/capture.mjs"] = false;
    expect(evaluateM7vE2eQualification(missingRunner).integrityIssues).toContain("required-package-script-target-missing:scripts/dream-loop/capture.mjs");
  });

  it("rejects changing a historical skipped outcome to passed", () => {
    const mutated = clone(accepted);
    const row = mutated.matrix.identities[0];
    row.historicalM7rOutcome = "passed";
    const result = evaluateM7vE2eQualification(mutated);
    expect(result.integrityIssues).toContain(`m7v-historical-outcome-mutated:${row.identity}`);
  });

  it("rejects a new ordinary-WebGL source skip that has no reviewed policy row", () => {
    const mutated = clone(accepted);
    const test = mutated.discoveryProfiles.standard.find((entry) => entry.project === "chromium" &&
      !mutated.matrix.identities.some((row) => row.identity === entry.identity));
    if (!test) throw new Error("Ordinary non-historical test missing from fixture.");
    const evidence = mutated.sourceEvidenceByIdentity.get(test.identity);
    if (!evidence) throw new Error("Source evidence missing from ordinary test fixture.");
    mutated.sourceEvidenceByIdentity.set(test.identity, {
      ...evidence,
      skipConditions: [{ line: 1, scope: "test", sourceText: 'test.skip(true, "new skip")', condition: "true", reason: "new skip" }],
    });
    const result = evaluateM7vE2eQualification(mutated);
    expect(result.integrityIssues).toContain("m7v-source-skip-identity-set-drift");
  });

  it("rejects current discovery drift until inventory reconciliation is reviewed", () => {
    const mutated = clone(accepted);
    mutated.discoveryProfiles.standard.pop();
    const result = evaluateM7vE2eQualification(mutated);
    expect(result.integrityIssues).toContain("m7v-default-test-inventory-drift");
    expect(result.integrityIssues.some((issue) => issue.startsWith("m7v-current-discovery-drift:standard:"))).toBe(true);
  });

  it("allows unrelated package scripts and dependency updates", () => {
    const mutated = clone(accepted);
    mutated.packageManifest.scripts["example:future-feature"] = "node ./scripts/example.mjs";
    mutated.packageManifest.devDependencies ??= {};
    mutated.packageManifest.devDependencies["example-future-package"] = "1.2.3";
    const result = evaluateM7vE2eQualification(mutated);
    expect(result.passed, result.integrityIssues.join(", ")).toBe(true);
  });

  it("requires the production-facing M7V policy script to remain registered", () => {
    const removed = clone(accepted);
    delete removed.packageManifest.scripts["evidence:check:m7v"];
    expect(evaluateM7vE2eQualification(removed).integrityIssues).toContain("required-package-script-invalid:evidence:check:m7v");

    const redirected = clone(accepted);
    redirected.packageManifest.scripts["evidence:check:m7v"] = "node ./scripts/run-m7q-evidence.mjs validate-policy";
    expect(evaluateM7vE2eQualification(redirected).integrityIssues).toContain("required-package-script-invalid:evidence:check:m7v");
  });

  it("keeps native-project-only compatibility guards separate from the 75 historical skips", () => {
    const result = evaluateM7vE2eQualification(accepted);
    expect(accepted.matrix.identities).toHaveLength(75);
    expect(accepted.reconciliation.reconciliation.sourceGuardAudit.projectConditionalSkipGuards).toHaveLength(10);
    expect(result.integrityIssues).toEqual([]);
  });

  it("preserves both M7U additions as ordinary WebGL tests outside the historical M7R set", () => {
    const reconciliation = accepted.reconciliation.reconciliation;
    expect(reconciliation.m7uAddedIdentities).toHaveLength(2);
    expect(reconciliation.m7uAddedIdentities.every((identity: string) =>
      accepted.reconciliation.profiles.standard.tests.some((test) =>
        test.identity === identity && test.lane === "ordinary-webgl"))).toBe(true);
    expect(accepted.matrix.identities.some((row) => reconciliation.m7uAddedIdentities.includes(row.identity))).toBe(false);
  });

  it("preserves the M7R historical report bytes and SHA-256 source claim", () => {
    const reportBytes = readFileSync(resolve(process.cwd(), "docs/architecture/GROUND_GLASS_M7R_BROAD_E2E_QUALIFICATION_RECOVERY_REPORT.json"));
    expect(accepted.historicalReportSha256).toBe(accepted.matrix.provenance.historicalM7rReportSha256);
    expect(accepted.matrix.identities).toHaveLength(75);
    expect(accepted.historicalReport.summary).toMatchObject({ discovered: 278, passed: 118, unexpected: 85, skipped: 75 });
    expect(reportBytes.byteLength).toBeGreaterThan(0);
  });

  it("collects static skip/fixme declarations and applicable conditional gates from TypeScript source", () => {
    const staticSkip = collectFixtureSource(
      'test.skip("mandatory case", async () => {});',
      "mandatory case",
      'test.skip("mandatory case"',
    );
    expect(staticSkip.definition.callName).toBe("test.skip");
    expect(staticSkip.skipConditions).toMatchObject([{
      kind: "static-skip-declaration",
      scope: "test",
      condition: "unconditional",
      reason: null,
    }]);

    const staticFixme = collectFixtureSource(
      'test.fixme("mandatory case", async () => {});',
      "mandatory case",
      'test.fixme("mandatory case"',
    );
    expect(staticFixme.definition.callName).toBe("test.fixme");
    expect(staticFixme.skipConditions[0]).toMatchObject({ kind: "static-skip-declaration", scope: "test" });

    const skippedSuite = collectFixtureSource(
      'test.describe.skip("suite", () => {\n  test("child", async () => {});\n});',
      "child",
      'test("child"',
    );
    expect(skippedSuite.skipConditions[0]).toMatchObject({
      kind: "static-skip-declaration",
      scope: "suite",
      condition: "unconditional",
    });

    const fixmeSuite = collectFixtureSource(
      'test.describe.fixme("suite", () => {\n  test("child", async () => {});\n});',
      "child",
      'test("child"',
    );
    expect(fixmeSuite.skipConditions[0]).toMatchObject({ kind: "static-skip-declaration", scope: "suite" });

    const conditionalTest = collectFixtureSource(
      'test("conditional", async () => {\n  test.skip(process.env.SKIP_CASE === "1", "conditional reason");\n});',
      "conditional",
      'test("conditional"',
    );
    expect(conditionalTest.skipConditions).toMatchObject([{
      scope: "test",
      condition: 'process.env.SKIP_CASE === "1"',
      reason: "conditional reason",
    }]);

    const conditionalSuite = collectFixtureSource(
      'test.describe("suite", () => {\n  test.skip(process.env.SKIP_CASE === "1", "suite reason");\n  test("child", async () => {});\n});',
      "child",
      'test("child"',
    );
    expect(conditionalSuite.skipConditions).toMatchObject([{
      scope: "suite",
      condition: 'process.env.SKIP_CASE === "1"',
      reason: "suite reason",
    }]);

    const unsupportedModifier = collectFixtureSource(
      'test[modifier]("dynamic modifier", async () => {});',
      "dynamic modifier",
      'test[modifier]("dynamic modifier"',
    );
    expect(unsupportedModifier.unsupportedPatterns?.some((pattern: string) => pattern.includes("unsupported-test-skip-pattern"))).toBe(true);

    expect(accepted.reconciliation.reconciliation.sourceGuardAudit.projectConditionalSkipGuards).toHaveLength(10);
    expect(evaluateM7vE2eQualification(accepted).integrityIssues).toEqual([]);
  });

  it("requires the reviewed source declaration baseline to cover the complete current inventory", () => {
    expect(accepted.sourceDeclarationBaselineCommitSha).toBe(M7V_SOURCE_DECLARATION_BASELINE_COMMIT);
    expect(accepted.sourceDeclarationBaselineByIdentity.size).toBe(280);
    expect(accepted.sourceDeclarationBaselineIssues).toEqual([]);
    const unavailable = collectM7vSourceDeclarationBaseline(
      process.cwd(), accepted.discoveryProfiles.standard, accepted.sourceEvidenceByIdentity, "f".repeat(40),
    );
    expect(unavailable.issues.some((issue) => issue.startsWith("m7v-source-policy-baseline-file-unavailable:"))).toBe(true);
  });

  it.each([
    ["test.skip", (source: string) => source.replace(/\btest\(/, "test.skip(")],
    ["test.fixme", (source: string) => source.replace(/\btest\(/, "test.fixme(")],
  ])("rejects an actual mandatory source declaration changed to %s even when its identity remains", (_label, mutate) => {
    const target = accepted.discoveryProfiles.standard.find((test) => test.identity.includes("smoke.spec.ts::smoke: app boots at home"));
    if (!target) throw new Error("Stable mandatory source mutation target is missing.");
    const mutatedEvidence = collectRepositoryMutation(target, mutate);
    const sourceEvidenceByIdentity = new Map(accepted.sourceEvidenceByIdentity);
    sourceEvidenceByIdentity.set(target.identity, mutatedEvidence);
    const mutated = clone(accepted);
    mutated.sourceEvidenceByIdentity = sourceEvidenceByIdentity;
    // A report-side source-guard edit cannot replace the immutable reviewed declaration baseline.
    mutated.reconciliation.reconciliation.sourceGuardAudit.projectConditionalSkipGuards.push({
      identity: target.identity,
      sourceEvidence: mutatedEvidence,
    });
    const result = evaluateM7vE2eQualification(mutated);
    expect(result.integrityIssues).toContain(`m7v-source-declaration-changed-from-reviewed-baseline:${target.identity}`);
    expect(result.passed).toBe(false);
  });

  it.each(["test.describe.skip", "test.describe.fixme"])("rejects a real mandatory suite changed to %s", (modifier) => {
    const target = accepted.discoveryProfiles.standard.find((test) => test.identity.includes("marketing-responsive.spec.ts::Marketing responsive::"));
    if (!target) throw new Error("Stable nested suite source mutation target is missing.");
    const mutatedEvidence = collectRepositoryMutation(target, (source) => source.replace("test.describe(", `${modifier}(`));
    const sourceEvidenceByIdentity = new Map(accepted.sourceEvidenceByIdentity);
    sourceEvidenceByIdentity.set(target.identity, mutatedEvidence);
    const result = evaluateM7vE2eQualification({ ...accepted, sourceEvidenceByIdentity });
    expect(result.integrityIssues).toContain(`m7v-source-declaration-changed-from-reviewed-baseline:${target.identity}`);
  });

  it("rejects edits to the self-reported lane identity list", () => {
    const mutated = clone(accepted);
    (mutated.governanceReport.laneEvidence["ordinary-webgl"].requiredIdentities as string[]).pop();
    expect(evaluateM7vE2eQualification(mutated).integrityIssues).toContain("lane-required-identities-not-derived:ordinary-webgl");
  });

  it("derives a complete passing lane from the Playwright results and linked runtime evidence", () => {
    const identity = "chromium::fixture.spec.ts::fixture passes";
    const artifact = validPlaywrightArtifact("ordinary-webgl", identity);
    const result = deriveM7vExecutionArtifactEvidence({ lane: "ordinary-webgl", artifact, requiredIdentities: [identity] });
    expect(result.issues).toEqual([]);
    expect(result.summary).toMatchObject({ coveredIdentities: [identity], retries: 0, failed: 0, skipped: 0, incomplete: 0 });

    const contentSha256 = sha256(JSON.stringify(artifact));
    const descriptor = {
      runId: 101,
      artifactId: 202,
      artifactName: "m7v-ordinary-webgl-evidence",
      artifactFile: "execution.json",
      storedPath: "docs/architecture/ground-glass-m7v-skip-governance/execution-artifacts/execution.json",
      sourceCommitSha: artifact.sourceCommitSha,
      contentSha256,
      archiveSha256: `sha256:${"b".repeat(64)}`,
    };
    const evidence = {
      status: "qualified",
      artifact: descriptor,
      coveredIdentities: [identity],
      retries: 0,
      flaky: 0,
      incomplete: 0,
      failed: 0,
      skipped: 0,
    };
    const runnerProof = validRunnerProof(descriptor);
    expect(verifyM7vRunnerArtifactProvenance({ lane: "ordinary-webgl", descriptor, artifact, artifactContentSha256: contentSha256, proof: runnerProof })).toEqual([]);
    expect(extractOutcomeCoverageIssues("ordinary-webgl", evidence, [identity], { artifact, sha256: contentSha256 }, runnerProof)).toEqual({
      integrityIssues: [],
      qualificationIssues: [],
    });
  });

  it("rejects missing, substituted, skipped, failed, retried, incomplete, or miscounted lane artifacts", () => {
    const identity = "chromium::fixture.spec.ts::fixture passes";
    const artifact = validPlaywrightArtifact("ordinary-webgl", identity);
    const requiredIdentities = [identity];
    const mutations: Array<[string, (value: ReturnType<typeof validPlaywrightArtifact>) => void, string]> = [
      ["missing identity", (value) => { value.playwrightReport.suites[0].specs = []; }, "execution-required-identity-missing"],
      ["wrong project", (value) => { value.playwrightReport.suites[0].specs![0].tests[0].projectName = "chrome-native-webgpu"; }, "execution-required-project-mismatch"],
      ["failed outcome", (value) => { value.playwrightReport.suites[0].specs![0].tests[0].results[0].status = "failed"; }, "execution-required"],
      ["timed out", (value) => { value.playwrightReport.suites[0].specs![0].tests[0].results[0].status = "timedOut"; }, "execution-required"],
      ["skipped", (value) => { value.playwrightReport.suites[0].specs![0].tests[0].results[0].status = "skipped"; }, "execution-required"],
      ["retried", (value) => { value.playwrightReport.suites[0].specs![0].tests[0].results.push({ status: "passed", retry: 1, duration: 12, workerIndex: 0, parallelIndex: 0, errors: [] }); }, "execution-retried-or-flaky"],
      ["incomplete result", (value) => { value.playwrightReport.suites[0].specs![0].tests[0].results[0].duration = 0; }, "execution-result-incomplete"],
      ["changed source identity", (value) => { value.sourceCommitSha = "b".repeat(40); }, "runtime-evidence-not-linked-to-result"],
      ["false WebGPU identity", (value) => { value.runtimeEvidence[0].rendererFamily = "webgpu-renderer"; value.runtimeEvidence[0].executionApi = "webgpu"; }, "webgl-runtime-identity-invalid"],
    ];
    for (const [name, mutate, expectedIssue] of mutations) {
      const candidate = clone(artifact);
      mutate(candidate);
      const result = deriveM7vExecutionArtifactEvidence({ lane: "ordinary-webgl", artifact: candidate, requiredIdentities });
      expect(result.issues.some((issue) => issue.startsWith(expectedIssue)), name).toBe(true);
    }

    const absent = extractOutcomeCoverageIssues("ordinary-webgl", {
      status: "qualified",
      artifact: { runId: 1, artifactId: 2, artifactName: "missing", storedPath: "docs/architecture/ground-glass-m7v-skip-governance/execution-artifacts/missing.json", contentSha256: "0".repeat(64), sourceCommitSha: "a".repeat(40) },
      coveredIdentities: [identity], retries: 0, flaky: 0, incomplete: 0, failed: 0, skipped: 0,
    }, [identity], null, null);
    expect(absent.integrityIssues).toContain("lane-execution-artifact-missing-or-unreadable:ordinary-webgl");
    expect(absent.qualificationIssues).toContain("lane-execution-evidence-unverified:ordinary-webgl");

    const valid = validPlaywrightArtifact("ordinary-webgl", identity);
    const contentSha256 = sha256(JSON.stringify(valid));
    const descriptor = { runId: 1, artifactId: 2, artifactName: "m7v-evidence", artifactFile: "execution.json", storedPath: "docs/architecture/ground-glass-m7v-skip-governance/execution-artifacts/execution.json", sourceCommitSha: valid.sourceCommitSha, contentSha256, archiveSha256: `sha256:${"b".repeat(64)}` };
    const evidence = { status: "qualified", artifact: descriptor, coveredIdentities: [identity], retries: 0, flaky: 0, incomplete: 0, failed: 0, skipped: 0 };
    const wrongCounters = extractOutcomeCoverageIssues("ordinary-webgl", { ...evidence, failed: 1 }, [identity], { artifact: valid, sha256: contentSha256 }, validRunnerProof(descriptor));
    expect(wrongCounters.integrityIssues).toContain("lane-evidence-counter-not-derived:ordinary-webgl:failed");
    const missingAuth = extractOutcomeCoverageIssues("ordinary-webgl", evidence, [identity], { artifact: valid, sha256: contentSha256 }, null);
    expect(missingAuth.qualificationIssues).toContain("lane-runner-provenance-unavailable:ordinary-webgl");

    const nativeIdentity = "chrome-native-webgpu::fixture.spec.ts::fixture passes";
    const falseNative = validPlaywrightArtifact("native-webgpu", nativeIdentity);
    falseNative.runtimeEvidence[0].rendererFamily = "webgl-renderer";
    falseNative.runtimeEvidence[0].executionApi = "webgl2";
    expect(deriveM7vExecutionArtifactEvidence({ lane: "native-webgpu", artifact: falseNative, requiredIdentities: [nativeIdentity] }).issues)
      .toContain(`native-runtime-identity-invalid:${nativeIdentity}`);

    const malformed = validPlaywrightArtifact("ordinary-webgl", identity);
    malformed.playwrightReport.suites = [];
    malformed.playwrightReport.errors = ["test runner did not complete"];
    expect(deriveM7vExecutionArtifactEvidence({ lane: "ordinary-webgl", artifact: malformed, requiredIdentities: [identity] }).issues)
      .toContain("playwright-report-invalid-or-incomplete");
  });

  it("opens only digest-matched artifacts contained in the approved evidence directory", () => {
    const root = mkdtempSync(join(tmpdir(), "m7v-artifact-loader-"));
    try {
      const artifact = validPlaywrightArtifact();
      const bytes = Buffer.from(JSON.stringify(artifact));
      const artifactPath = join(root, M7V_EXECUTION_ARTIFACT_ROOT, "execution.json");
      mkdirSync(join(root, M7V_EXECUTION_ARTIFACT_ROOT), { recursive: true });
      writeFileSync(artifactPath, bytes);
      const storedPath = `${M7V_EXECUTION_ARTIFACT_ROOT}/execution.json`;
      const reportFor = (descriptor: Record<string, unknown>) => ({ laneEvidence: { "ordinary-webgl": { status: "qualified", artifact: descriptor } } });
      const descriptor = { storedPath, contentSha256: sha256(bytes.toString("utf8")) };
      const loaded = loadM7vExecutionArtifacts(root, reportFor(descriptor)).get("ordinary-webgl") as { artifact?: unknown; issue?: string };
      expect(loaded.artifact).toEqual(artifact);
      expect(loaded.issue).toBeUndefined();

      const traversal = loadM7vExecutionArtifacts(root, reportFor({ ...descriptor, storedPath: `${M7V_EXECUTION_ARTIFACT_ROOT}/../../../../package.json` })).get("ordinary-webgl") as { artifact?: unknown; issue?: string };
      expect(traversal.artifact).toBeNull();
      expect(traversal.issue).toContain("artifact-path-outside-policy");

      const badDigest = loadM7vExecutionArtifacts(root, reportFor({ ...descriptor, contentSha256: "0".repeat(64) })).get("ordinary-webgl") as { artifact?: unknown; issue?: string };
      expect(badDigest.artifact).toBeNull();
      expect(badDigest.issue).toContain("artifact-content-digest-mismatch");

      const missing = loadM7vExecutionArtifacts(root, reportFor({ ...descriptor, storedPath: `${M7V_EXECUTION_ARTIFACT_ROOT}/missing.json` })).get("ordinary-webgl") as { artifact?: unknown; issue?: string };
      expect(missing.artifact).toBeNull();
      expect(missing.issue).toContain("artifact-missing-or-invalid");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires independently verifiable current GitHub approval and permission evidence", () => {
    const identity = "chromium::fixture.spec.ts::fixture passes";
    const currentHeadSha = "c".repeat(40);
    const evidenceUrl = "https://github.com/chau-hm/view-camera-simulator/pull/320";
    const decision = { approver: "authorized-maintainer", authority: "maintain", scope: identity, policyRevision: M7V_POLICY_REVISION, rationale: "Reviewed exception for this exact identity." };
    const marker = `M7V-APPROVE ${M7V_POLICY_REVISION} ${sha256(identity)}`;
    const proof = {
      status: "loaded",
      repository: M7V_REPOSITORY,
      repositoryOwner: M7V_REPOSITORY_OWNER,
      pullNumber: 320,
      actorPermission: "maintain",
      reviews: [{ user: { login: decision.approver }, state: "APPROVED", commit_id: currentHeadSha, body: marker, submitted_at: "2026-11-08T00:00:00Z" }],
    };
    expect(verifyM7vApprovalReview({ identity, evidenceUrl, decision, currentHeadSha, proof })).toEqual([]);
    expect(verifyM7vApprovalReview({ identity, evidenceUrl, decision, currentHeadSha, proof: null })).toContain("owner-approval-verification-unavailable");
    expect(verifyM7vApprovalReview({ identity, evidenceUrl: "https://github.com/chau-hm/view-camera-simulator/pull/999", decision, currentHeadSha, proof })).toContain("owner-approval-reference-unverified");
    expect(verifyM7vApprovalReview({ identity, evidenceUrl, decision: { ...decision, authority: "write" }, currentHeadSha, proof }).length).toBeGreaterThan(0);
    expect(verifyM7vApprovalReview({ identity, evidenceUrl, decision: { ...decision, scope: "different identity" }, currentHeadSha, proof }).length).toBeGreaterThan(0);
    expect(verifyM7vApprovalReview({ identity, evidenceUrl, decision: { ...decision, policyRevision: "old-policy" }, currentHeadSha, proof }).length).toBeGreaterThan(0);
    expect(verifyM7vApprovalReview({ identity, evidenceUrl, decision: { ...decision, approver: "fabricated-owner" }, currentHeadSha, proof }).length).toBeGreaterThan(0);
    expect(verifyM7vApprovalReview({ identity, evidenceUrl, decision, currentHeadSha: "d".repeat(40), proof }).length).toBeGreaterThan(0);
    expect(verifyM7vApprovalReview({ identity, evidenceUrl, decision, currentHeadSha, proof: { ...proof, actorPermission: "write" } }).length).toBeGreaterThan(0);
    expect(verifyM7vApprovalReview({ identity, evidenceUrl, decision, currentHeadSha, proof: { ...proof, reviews: [{ ...proof.reviews[0], state: "COMMENTED" }] } }).length).toBeGreaterThan(0);
    expect(verifyM7vApprovalReview({ identity, evidenceUrl, decision, currentHeadSha, proof: { ...proof, reviews: [{ ...proof.reviews[0], body: "approved" }] } }).length).toBeGreaterThan(0);
  });

  it("fails a combined source-skip, fabricated-approval, and missing-artifact bypass", () => {
    const target = accepted.discoveryProfiles.standard.find((test) => test.identity.includes("smoke.spec.ts::smoke: app boots at home"));
    if (!target) throw new Error("Stable mandatory source mutation target is missing.");
    const report = clone(accepted);
    const mutatedEvidence = collectRepositoryMutation(target, (source) => source.replace(/\btest\(/, "test.skip("));
    report.sourceEvidenceByIdentity.set(target.identity, mutatedEvidence);
    report.reconciliation.reconciliation.sourceGuardAudit.projectConditionalSkipGuards.push({
      identity: target.identity,
      sourceEvidence: mutatedEvidence,
    });
    const row = report.matrix.identities[0];
    row.approvalStatus = "approved";
    row.approvalEvidence = "https://github.com/chau-hm/view-camera-simulator/pull/320";
    row.approvalDecision = {
      approver: "fabricated-owner",
      authority: "admin",
      scope: row.identity,
      policyRevision: M7V_POLICY_REVISION,
      rationale: "Fabricated approval metadata used in a negative control.",
    };
    report.governanceReport.laneEvidence["ordinary-webgl"].status = "qualified";
    report.governanceReport.laneEvidence["ordinary-webgl"].coveredIdentities = report.reconciliation.profiles.standard.tests
      .filter((test) => test.lane === "ordinary-webgl").map((test) => test.identity);
    report.governanceReport.laneEvidence["ordinary-webgl"].artifact = {
      runId: 999,
      artifactId: 999,
      artifactName: "fabricated-evidence",
      artifactFile: "missing.json",
      storedPath: "docs/architecture/ground-glass-m7v-skip-governance/execution-artifacts/missing.json",
      contentSha256: "0".repeat(64),
      archiveSha256: `sha256:${"0".repeat(64)}`,
      sourceCommitSha: "a".repeat(40),
    };
    const result = evaluateM7vE2eQualification({ ...report, mode: "require-qualified", currentHeadSha: "b".repeat(40) });
    expect(result.integrityIssues).toContain(`m7v-source-declaration-changed-from-reviewed-baseline:${target.identity}`);
    expect(result.approvalIssues.some((issue) => issue.startsWith("owner-approval-verification-unavailable:"))).toBe(true);
    expect(result.integrityIssues).toContain("lane-execution-artifact-missing-or-unreadable:ordinary-webgl");
    expect(result.passed).toBe(false);
    expect(target).toBeDefined();
  });
});
