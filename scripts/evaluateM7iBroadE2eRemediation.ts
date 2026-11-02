import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH,
  GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256,
} from "../src/render/testing/groundGlassM7hBroadE2eTriage";
import {
  GROUND_GLASS_M7I_EVALUATOR_REVISION,
  GROUND_GLASS_M7I_REPORT_ID,
  evaluateGroundGlassM7iBroadE2eRemediation,
  type GroundGlassM7iArtifact,
} from "../src/render/testing/groundGlassM7iBroadE2eRemediation";

const root = process.cwd();
const reportPath = "docs/architecture/GROUND_GLASS_M7I_BROAD_E2E_REMEDIATION_REPORT.json";
const m7hReportPath = "docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const readBytes = (path: string): Buffer | null => {
  try {
    return readFileSync(resolve(root, path));
  } catch {
    return null;
  }
};
const readJson = (path: string): unknown => {
  const bytes = readBytes(path);
  if (!bytes) return null;
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    return null;
  }
};

const main = (): void => {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--diagnostic") ||
      args.filter((argument) => argument === "--diagnostic").length > 1) {
    process.stderr.write("Supported M7I option: --diagnostic\n");
    process.exitCode = 2;
    return;
  }

  const historicalRawBytes = readBytes(GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH);
  const historicalTriageBytes = readBytes(m7hReportPath);
  const historicalRawReport = historicalRawBytes ? readJson(GROUND_GLASS_M7H_HISTORICAL_REPORT_PATH) : null;
  const historicalTriage = historicalTriageBytes ? readJson(m7hReportPath) : null;
  const historicalRawSha = historicalRawBytes ? sha256(historicalRawBytes) : "";
  const reportValue = readJson(reportPath);
  if (!isRecord(reportValue)) {
    process.stderr.write(`M7I report missing or malformed: ${reportPath}\n`);
    process.exitCode = 1;
    return;
  }

  const artifacts: Record<string, GroundGlassM7iArtifact> = {};
  const runs = Array.isArray(reportValue.reproductionRuns) ? reportValue.reproductionRuns : [];
  const discovery = isRecord(reportValue.currentDiscovery) ? reportValue.currentDiscovery : {};
  const paths = [
    ...runs.filter(isRecord).map((run) => run.reportPath),
    ...((Array.isArray(reportValue.supportingArtifacts) ? reportValue.supportingArtifacts : [])
      .filter(isRecord).map((artifact) => artifact.path)),
    discovery.artifactPath,
    discovery.sourceOutputPath,
  ].filter((path): path is string => typeof path === "string");
  for (const path of paths) {
    const bytes = readBytes(path);
    if (!bytes) continue;
    let artifactValue: unknown = null;
    try {
      artifactValue = JSON.parse(bytes.toString("utf8")) as unknown;
    } catch {
      artifactValue = bytes.toString("utf8");
    }
    artifacts[path] = { sha256: sha256(bytes), report: artifactValue };
  }

  const evaluation = evaluateGroundGlassM7iBroadE2eRemediation(
    reportValue,
    historicalTriage,
    historicalRawReport,
    historicalRawSha,
    historicalTriageBytes ? sha256(historicalTriageBytes) : "",
    artifacts,
  );
  process.stdout.write(`${JSON.stringify(evaluation, null, 2)}\n`);
  if (historicalRawSha !== GROUND_GLASS_M7H_HISTORICAL_REPORT_SHA256 || !evaluation.passed) {
    process.exitCode = 1;
  }
  if (reportValue.evaluatorRevision !== GROUND_GLASS_M7I_EVALUATOR_REVISION ||
      reportValue.reportId !== GROUND_GLASS_M7I_REPORT_ID) process.exitCode = 1;
};

main();
