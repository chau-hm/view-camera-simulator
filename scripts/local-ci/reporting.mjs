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

export async function writeJsonAtomically(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, filePath);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
