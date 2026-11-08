import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  collectM7vPlaywrightInventories,
  collectM7vTestSourceEvidence,
  evaluateM7vE2eQualification,
  loadM7vPolicyInputs,
} from "../../../scripts/evaluateM7vE2eQualification.mjs";

type M7vInput = ReturnType<typeof loadM7vPolicyInputs> & {
  discoveryProfiles: ReturnType<typeof collectM7vPlaywrightInventories>;
  sourceEvidenceByIdentity: ReturnType<typeof collectM7vTestSourceEvidence>;
  mode?: "validate-policy" | "require-approved" | "require-qualified";
};

const clone = <T>(value: T): T => structuredClone(value);
let accepted: M7vInput;

describe("M7V E2E qualification lane and skip governance", () => {
  beforeAll(() => {
    const discoveryProfiles = collectM7vPlaywrightInventories(process.cwd());
    accepted = {
      ...loadM7vPolicyInputs(process.cwd()),
      discoveryProfiles,
      sourceEvidenceByIdentity: collectM7vTestSourceEvidence(process.cwd(), discoveryProfiles.standard),
    };
  });

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
    expect(result.qualificationIssues).toContain("lane-evidence-coverage-incomplete:native-webgpu");
    expect(result.qualificationIssues).toContain("lane-evidence-outcomes-invalid:native-webgpu");
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
});
