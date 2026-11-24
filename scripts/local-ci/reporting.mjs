import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export function evaluateEnvironmentRequirements(input) {
  const checks = [];
  const issues = [];
  const nodeMajor = Number(String(input.nodeVersion).replace(/^v/, "").split(".")[0]);
  const nodeCompatible = nodeMajor === 24;
  checks.push({ id: "node-major-24", status: nodeCompatible ? "PASS" : "FAIL", observed: input.nodeVersion, required: "24.x" });
  if (!nodeCompatible) issues.push(`Local CI requires the repository CI runtime Node 24.x; found ${input.nodeVersion}.`);

  checks.push({ id: "npm", status: input.npmAvailable ? "PASS" : "FAIL", version: input.npmVersion });
  if (!input.npmAvailable) issues.push("npm is unavailable under the selected Node runtime.");

  checks.push({ id: "installed-dependencies", status: input.dependenciesAvailable ? "PASS" : "FAIL" });
  if (!input.dependenciesAvailable) issues.push("Repository dependencies are not installed; Local CI never runs npm install automatically.");

  if (input.playwrightRequested) {
    checks.push({ id: "playwright-package", status: input.playwrightPackageAvailable ? "PASS" : "FAIL" });
    if (!input.playwrightPackageAvailable) issues.push("@playwright/test is not installed; browser validation cannot run.");
    if (input.nativeWebGpuRequested) {
      checks.push({ id: "system-chrome", status: input.systemChromeAvailable ? "PASS" : "FAIL" });
      if (!input.systemChromeAvailable) issues.push("Native WebGPU qualification requires installed system Chrome; no browser was downloaded.");
    } else {
      checks.push({ id: "playwright-chromium", status: input.browserAvailable ? "PASS" : "FAIL" });
      if (!input.browserAvailable) issues.push("Playwright Chromium is unavailable; no browser was downloaded.");
    }
  }
  return { checks, issues, passed: issues.length === 0 };
}

export function determineOverallStatus({ sourceStable, failedStep, steps, incomplete, preflightIssues = [], interrupted = false }) {
  if (sourceStable === false || interrupted) return "INCOMPLETE";
  if (failedStep || steps.some((step) => step.status === "FAIL")) return "FAIL";
  if (preflightIssues.length > 0 || incomplete || steps.some((step) => step.status === "INCOMPLETE")) return "INCOMPLETE";
  if (steps.length === 0) return "NOT_RUN";
  return "PASS";
}

export function applyRunnerEvidenceStatus(commandStatus, runner, counts) {
  if (commandStatus !== "PASS") return commandStatus;
  if (counts?.failed > 0 || (runner === "vitest" && counts?.success === false)) return "FAIL";
  if (counts?.skipped > 0 || counts?.flaky > 0 || (runner === "vitest" && counts?.todo > 0)) return "INCOMPLETE";
  return "PASS";
}

const qualificationContracts = {
  ordinaryChromium: { mode: "ordinary-chromium", configuration: "playwright.config.ts", projects: ["chromium", "chromium-renderer-serial"] },
  productionPreview: { mode: "production-preview", configuration: "playwright.production.config.ts", projects: ["chromium-production-preview"] },
  nativeWebGpu: { mode: "native-webgpu", configuration: "playwright.config.ts", projects: ["chrome-native-webgpu"] },
};

function uniqueSortedPaths(paths) {
  return [...new Set(paths.filter((file) => typeof file === "string" && file.length > 0))].sort();
}

function qualificationStepMatches(step, qualification) {
  const contract = qualificationContracts[qualification];
  return Boolean(contract && step.runner === "playwright" && step.qualification === qualification && step.mode === contract.mode);
}

function hasMatchingPlaywrightEvidence(step, qualification, expectedFile) {
  const contract = qualificationContracts[qualification];
  const counts = step.counts;
  const actualProjects = step.actualProjects;
  const selected = step.testFilesSelected;
  const nativeAssertion = step.nativeBackendAssertion;
  if (!contract || !qualificationStepMatches(step, qualification) || step.runnerEvidenceValid !== true) return false;
  if (step.qualificationEvidence?.valid !== true) return false;
  if (step.expectedConfiguration !== contract.configuration || step.actualConfiguration !== contract.configuration) return false;
  if (!Array.isArray(actualProjects) || actualProjects.length === 0 || actualProjects.some((project) => !contract.projects.includes(project))) return false;
  if (!Array.isArray(selected) || selected.length !== 1 || selected[0] !== expectedFile) return false;
  if (!counts || !Array.isArray(counts.files) || counts.files.length !== 1 || counts.files[0] !== expectedFile) return false;
  if (qualification === "nativeWebGpu" && (!nativeAssertion || nativeAssertion.requiredValue !== "1" || nativeAssertion.providedValue !== "1")) return false;
  return true;
}

function hasVerifiedPlaywrightEvidence(step, qualification, expectedFile) {
  const counts = step.counts;
  return step.status === "PASS" &&
    hasMatchingPlaywrightEvidence(step, qualification, expectedFile) &&
    Number.isInteger(counts.passed) && counts.passed > 0 &&
    counts.failed === 0 && counts.skipped === 0 && counts.flaky === 0;
}

function aggregateQualification(request, qualification, steps, sourceStable) {
  if (!request?.requested) return "NOT_RUN";
  const expectedFiles = uniqueSortedPaths(request.files ?? []);
  const matchingSteps = steps.filter((step) => qualificationStepMatches(step, qualification));
  if (expectedFiles.length === 0 || !sourceStable) return "INCOMPLETE";

  for (const file of expectedFiles) {
    const candidateSteps = matchingSteps.filter((candidate) => candidate.testFilesSelected?.length === 1 && candidate.testFilesSelected[0] === file);
    const step = candidateSteps.find((candidate) => hasMatchingPlaywrightEvidence(candidate, qualification, file));
    if (step?.status === "FAIL") return "FAIL";
    if (!step || !hasVerifiedPlaywrightEvidence(step, qualification, file)) return "INCOMPLETE";
  }
  return "PASS";
}

/**
 * Aggregate browser coverage and renderer qualifications from completed,
 * identity-checked Playwright results. Requested targets and scheduled steps
 * are recorded for diagnosis but never count as executed or verified proof.
 */
export function aggregateLocalCiEvidence(input) {
  const steps = Array.isArray(input.steps) ? input.steps : [];
  const sourceStable = input.sourceStable === true;
  const playwrightSteps = steps.filter((step) => step.runner === "playwright");
  const required = (input.requiredE2EContracts ?? []).map((contract) => ({
    file: contract.file,
    owners: [...new Set((contract.owners ?? []).map((owner) => typeof owner === "string" ? owner : owner.id).filter(Boolean))].sort(),
  })).sort((left, right) => left.file.localeCompare(right.file));
  const requested = uniqueSortedPaths(input.requestedE2EFiles ?? []);
  const scheduled = uniqueSortedPaths(input.scheduledE2EFiles ?? []);
  const executed = uniqueSortedPaths(playwrightSteps
    .filter((step) => step.runnerEvidenceValid === true)
    .flatMap((step) => step.testFilesSelected ?? []));
  const verified = uniqueSortedPaths(playwrightSteps
    .filter((step) => sourceStable && step.status === "PASS" && step.runnerEvidenceValid === true && step.qualificationEvidence?.valid === true)
    .flatMap((step) => step.testFilesSelected ?? []));
  const verifiedSet = new Set(verified);
  const missingRequired = required.filter((contract) => !verifiedSet.has(contract.file));
  const requiredButUnmapped = input.affectedE2ERequired === true && required.length === 0;
  const e2eCoverageStatus = input.affectedE2ERequired !== true
    ? "NOT_REQUIRED"
    : requiredButUnmapped || missingRequired.length > 0
      ? "INCOMPLETE"
      : "PASS";
  const limitations = [];
  if (!sourceStable && (input.affectedE2ERequired === true || Object.values(input.qualificationRequests ?? {}).some((request) => request?.requested))) {
    limitations.push("Source state was not stable during validation; browser results are not credited as verified coverage.");
  }
  if (requiredButUnmapped) limitations.push("Affected ownership requires browser validation but no required E2E spec mapping is available.");
  for (const contract of missingRequired) {
    limitations.push(`Affected browser contract is not verified: ${contract.file}${contract.owners.length > 0 ? ` (owner: ${contract.owners.join(", ")})` : ""}.`);
  }

  const requests = input.qualificationRequests ?? {};
  const qualifications = {
    ordinaryChromium: aggregateQualification(requests.ordinaryChromium, "ordinaryChromium", steps, sourceStable),
    productionPreview: aggregateQualification(requests.productionPreview, "productionPreview", steps, sourceStable),
    nativeWebGpu: aggregateQualification(requests.nativeWebGpu, "nativeWebGpu", steps, sourceStable),
    visualEvidence: "NOT_RUN",
  };
  for (const [name, status] of Object.entries(qualifications)) {
    if (name !== "visualEvidence" && requests[name]?.requested && status === "INCOMPLETE") {
      limitations.push(`${name} was requested but matching Playwright evidence did not complete successfully.`);
    }
  }

  return {
    qualifications,
    e2eCoverage: {
      required,
      requested,
      includeOwnerE2E: input.includeOwnerE2E === true,
      scheduled,
      executed,
      verified,
      missingRequired,
      status: e2eCoverageStatus,
    },
    limitations,
  };
}

export async function writeJsonAtomically(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, filePath);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
