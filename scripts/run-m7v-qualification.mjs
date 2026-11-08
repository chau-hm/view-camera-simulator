#!/usr/bin/env node
import {
  collectM7vPlaywrightInventories,
  collectM7vSourceDeclarationBaseline,
  collectM7vTestSourceEvidence,
  evaluateM7vE2eQualification,
  loadM7vExecutionArtifacts,
  loadM7vPolicyInputs,
  loadM7vTrustedVerificationInputs,
} from "./evaluateM7vE2eQualification.mjs";

const modes = new Set(["validate-policy", "require-approved", "require-qualified"]);
const mode = process.argv[2] ?? "validate-policy";

try {
  if (!modes.has(mode)) throw new Error(`Unknown mode '${mode}'. Use validate-policy, require-approved, or require-qualified.`);
  const profiles = collectM7vPlaywrightInventories(process.cwd());
  const sourceEvidenceByIdentity = collectM7vTestSourceEvidence(process.cwd(), profiles.standard);
  const sourceDeclarationBaseline = collectM7vSourceDeclarationBaseline(
    process.cwd(), profiles.standard, sourceEvidenceByIdentity,
  );
  const policyInputs = loadM7vPolicyInputs(process.cwd());
  const verificationInputs = loadM7vTrustedVerificationInputs(process.cwd(), policyInputs, mode);
  const result = evaluateM7vE2eQualification({
    ...policyInputs,
    discoveryProfiles: profiles,
    sourceEvidenceByIdentity,
    sourceDeclarationBaselineByIdentity: sourceDeclarationBaseline.declarationsByIdentity,
    sourceDeclarationBaselineCommitSha: sourceDeclarationBaseline.commitSha,
    sourceDeclarationBaselineIssues: sourceDeclarationBaseline.issues,
    executionArtifactsByLane: loadM7vExecutionArtifacts(process.cwd(), policyInputs.governanceReport),
    ...verificationInputs,
    mode,
  });

  console.log(`M7V policy integrity: ${result.policyIntegrityStatus.toUpperCase()}`);
  console.log(`M7R historical skipped identities: 75`);
  console.log(`Current standard discovery: ${result.currentInventoryCount}`);
  console.log(`Current lane assignments: ${JSON.stringify(result.laneCounts)}`);
  console.log(`M7R/current additions: ${result.m7rCurrentDiff.added.length}; removals: ${result.m7rCurrentDiff.removed.length}`);
  console.log(`Owner approvals: ${result.approvalSummary.approved}/75 approved; ${result.approvalSummary.pending} pending; ${result.approvalSummary.rejected} rejected`);
  console.log(`Lane qualification: ${result.laneQualificationStatus}`);
  console.log(`Broad E2E qualification: ${result.qualificationStatus}`);

  const failures = [...result.integrityIssues, ...result.modeIssues];
  if (failures.length) {
    console.error(`M7V ${mode} failed:`);
    for (const issue of failures) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(`M7V ${mode}: PASS`);
  }
} catch (error) {
  console.error(`M7V qualification check could not complete: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
