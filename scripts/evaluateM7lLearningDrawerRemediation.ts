import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GROUND_GLASS_M7K_ORDINARY_RAW_SHA256,
  GROUND_GLASS_M7K_RENDERER_SERIAL_RAW_SHA256,
  GROUND_GLASS_M7K_REPORT_SHA256,
  evaluateGroundGlassM7lLearningDrawerRemediation,
  type GroundGlassM7lArtifact,
  type GroundGlassM7lEvidence,
} from "../src/render/testing/groundGlassM7lLearningDrawerRemediation";

type JsonRecord = Record<string, unknown>;
const root = process.cwd();
const defaultReportPath = "docs/architecture/GROUND_GLASS_M7L_LEARNING_DRAWER_REMEDIATION_REPORT.json";
const historicalReportPath = "docs/architecture/GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION_REPORT.json";
const inventoryPath = "docs/architecture/ground-glass-m7l-learning-drawer/historical-82-failure-inventory.json";
const focusedPath = "docs/architecture/ground-glass-m7l-learning-drawer/validation/focused-drawer-regressions.json";
const historicalRawPaths = {
  "m7k-ordinary": "docs/architecture/ground-glass-m7k-broad-e2e/execution/three-r187/execution/ordinary-playwright.json",
  "m7k-renderer-serial": "docs/architecture/ground-glass-m7k-broad-e2e/execution/three-r187/execution/renderer-serial-playwright.json",
} as const;

const record = (value: unknown): JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
const text = (value: unknown): string => typeof value === "string" ? value : "";
const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const readSafeBytes = (path: string): Buffer => {
  const normalized = path.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized) ||
      normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Evidence path is not a safe repository-relative path: ${path}`);
  }
  const absolute = resolve(root, normalized);
  if (!absolute.startsWith(`${root}/`)) throw new Error(`Evidence path escapes the repository: ${path}`);
  return readFileSync(absolute);
};
const parseJson = (path: string, bytes = readSafeBytes(path)): unknown => {
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error(`Evidence file is not valid JSON: ${path}`);
  }
};
const loadArtifact = (path: string): GroundGlassM7lArtifact => {
  const bytes = readSafeBytes(path);
  return { sha256: sha256(bytes), value: parseJson(path, bytes) };
};
const usage = (): void => {
  process.stderr.write("Usage: node scripts/run-m7l-learning-drawer-remediation.mjs [--report-path=<path>]\n");
  process.exitCode = 2;
};

const main = (): void => {
  const args = process.argv.slice(2);
  let reportPath = defaultReportPath;
  if (args.length > 1 || (args.length === 1 && !args[0].startsWith("--report-path="))) return usage();
  if (args.length === 1) reportPath = args[0].slice("--report-path=".length);
  try {
    const reportBytes = readSafeBytes(reportPath);
    const reportValue = parseJson(reportPath, reportBytes);
    const report = record(reportValue);
    const experiments: Record<string, GroundGlassM7lArtifact> = {};
    for (const experimentValue of Array.isArray(report.experiments) ? report.experiments : []) {
      const experiment = record(experimentValue);
      const id = text(experiment.id);
      const path = text(experiment.artifactPath);
      if (!id || !path || experiments[id]) throw new Error("M7L report contains a missing or duplicate experiment artifact reference");
      experiments[id] = loadArtifact(path);
    }

    const historicalBytes = readSafeBytes(historicalReportPath);
    if (sha256(historicalBytes) !== GROUND_GLASS_M7K_REPORT_SHA256) throw new Error("Accepted M7K report digest changed");
    const ordinaryRawBytes = readSafeBytes(historicalRawPaths["m7k-ordinary"]);
    const serialRawBytes = readSafeBytes(historicalRawPaths["m7k-renderer-serial"]);
    if (sha256(ordinaryRawBytes) !== GROUND_GLASS_M7K_ORDINARY_RAW_SHA256 ||
        sha256(serialRawBytes) !== GROUND_GLASS_M7K_RENDERER_SERIAL_RAW_SHA256) {
      throw new Error("Accepted M7K raw Playwright capture digest changed");
    }
    const evidence: GroundGlassM7lEvidence = {
      historicalM7kReport: parseJson(historicalReportPath, historicalBytes),
      historicalInventory: loadArtifact(inventoryPath).value,
      historicalInventorySha256: sha256(readSafeBytes(inventoryPath)),
      historicalRawArtifacts: {
        "m7k-ordinary": { sha256: sha256(ordinaryRawBytes), value: parseJson(historicalRawPaths["m7k-ordinary"], ordinaryRawBytes) },
        "m7k-renderer-serial": { sha256: sha256(serialRawBytes), value: parseJson(historicalRawPaths["m7k-renderer-serial"], serialRawBytes) },
      },
      experiments,
      focusedValidation: loadArtifact(focusedPath),
    };
    const evaluation = evaluateGroundGlassM7lLearningDrawerRemediation(reportValue, evidence);
    process.stdout.write(`${JSON.stringify(evaluation, null, 2)}\n`);
    process.stdout.write(`M7L normalized artifact integrity: ${evaluation.normalizedArtifactIntegrity.toUpperCase()}\n`);
    process.stdout.write(`M7L original raw capture provenance: ${evaluation.originalRawCaptureProvenance.toUpperCase()}\n`);
    process.stdout.write(`M7L raw-to-normalized verification: ${evaluation.rawToNormalizedNormalization.toUpperCase()}\n`);
    process.stdout.write(`M7L evidence integrity (normalized scope): ${evaluation.evidenceIntegrity.toUpperCase()}\n`);
    process.stdout.write(`Historical unexpected failures: ${evaluation.historicalUnexpectedCount}\n`);
    process.stdout.write(`M7L cohort identities: ${evaluation.cohortIdentityCount}\n`);
    process.stdout.write(`Verified fixes: ${evaluation.verifiedFixCount}\n`);
    process.stdout.write(`Full Broad E2E: ${evaluation.fullBroadE2eStatus}\n`);
    if (!evaluation.passed) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`M7L evidence evaluation failed closed: ${message}\n`);
    process.exitCode = 1;
  }
};

main();
