import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  GROUND_GLASS_M7K_HISTORICAL_ARTIFACT_PATHS,
  buildGroundGlassM7kQualificationReport,
  evaluateGroundGlassM7kBroadE2eQualification,
  type GroundGlassM7kArtifact,
  type GroundGlassM7kCaptureManifest,
} from "../src/render/testing/groundGlassM7kBroadE2eQualification";

type JsonRecord = Record<string, unknown>;
const root = process.cwd();
const reportPathDefault = "docs/architecture/GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION_REPORT.json";
const manifestArtifacts = (manifest: GroundGlassM7kCaptureManifest): string[] => [
  ...GROUND_GLASS_M7K_HISTORICAL_ARTIFACT_PATHS,
  manifest.discovery.ordinary.outputPath,
  manifest.discovery.rendererSerial.outputPath,
  ...Object.values(manifest.lanes).flatMap((lane) => lane
    ? [lane.rawReportPath, lane.consolePath]
    : []),
];
const reportArtifacts = (report: JsonRecord): string[] => {
  const paths: string[] = [...GROUND_GLASS_M7K_HISTORICAL_ARTIFACT_PATHS];
  const historical = record(report.historicalEvidence);
  const references = record(historical.artifacts);
  paths.push(...Object.values(references).map((reference) => string(record(reference).path)));
  const discovery = record(report.discovery);
  for (const key of ["ordinary", "rendererSerial"]) {
    const lane = record(discovery[key]);
    paths.push(string(lane.outputPath));
  }
  const execution = record(report.execution);
  const lanes = record(execution.lanes);
  for (const key of ["ordinary", "rendererSerial"]) {
    const lane = record(lanes[key]);
    paths.push(string(lane.rawReportPath), string(lane.consolePath));
  }
  return [...new Set(paths.filter(Boolean))];
};
const record = (value: unknown): JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
const string = (value: unknown): string => typeof value === "string" ? value : "";
const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const readBytes = (path: string): Buffer => readFileSync(resolve(root, path));
const parseArtifact = (path: string, bytes: Buffer): unknown => {
  if (path.endsWith(".txt") || path.endsWith(".log")) return bytes.toString("utf8");
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    return bytes.toString("utf8");
  }
};
const loadArtifacts = (paths: readonly string[]): Record<string, GroundGlassM7kArtifact> => {
  const artifacts: Record<string, GroundGlassM7kArtifact> = {};
  for (const path of [...new Set(paths)]) {
    const bytes = readBytes(path);
    artifacts[path] = { sha256: sha256(bytes), value: parseArtifact(path, bytes) };
  }
  return artifacts;
};
const sourceCommitAvailable = (sha: string): boolean => spawnSync(
  "git",
  ["cat-file", "-e", `${sha}^{commit}`],
  { cwd: root, stdio: "ignore" },
).status === 0;
const usage = (): void => {
  process.stderr.write(
    "Usage: node scripts/run-m7k-qualification.mjs [--report-path=<path>] [--evaluation-output=<path>] [--require-qualified]\n" +
    "   or: node scripts/run-m7k-qualification.mjs --capture-manifest=<path> --report-output=<path> [--evaluation-output=<path>] [--require-qualified]\n",
  );
  process.exitCode = 2;
};

const main = (): void => {
  const args = process.argv.slice(2);
  const values = new Map<string, string>();
  let requireQualified = false;
  for (const argument of args) {
    if (argument === "--require-qualified") {
      requireQualified = true;
      continue;
    }
    const match = argument.match(/^--([a-z-]+)=(.+)$/);
    if (!match || values.has(match[1])) return usage();
    values.set(match[1], match[2]);
  }
  const manifestPath = values.get("capture-manifest");
  const reportPath = values.get("report-path") ?? reportPathDefault;
  const reportOutputPath = values.get("report-output");
  const evaluationOutputPath = values.get("evaluation-output");
  if (values.size !== ["capture-manifest", "report-path", "report-output", "evaluation-output"]
    .filter((key) => values.has(key)).length ||
      (manifestPath && (values.has("report-path") || !reportOutputPath)) ||
      (!manifestPath && reportOutputPath) ||
      (manifestPath && !values.has("capture-manifest"))) return usage();

  try {
    let reportValue: unknown;
    let artifactPaths: string[];
    if (manifestPath) {
      const manifest = JSON.parse(readBytes(manifestPath).toString("utf8")) as GroundGlassM7kCaptureManifest;
      artifactPaths = manifestArtifacts(manifest);
      const artifacts = loadArtifacts(artifactPaths);
      const report = buildGroundGlassM7kQualificationReport(manifest, artifacts);
      writeFileSync(resolve(root, reportOutputPath!), `${JSON.stringify(report, null, 2)}\n`);
      reportValue = report;
    } else {
      const reportBytes = readBytes(reportPath);
      reportValue = JSON.parse(reportBytes.toString("utf8")) as unknown;
      artifactPaths = reportArtifacts(record(reportValue));
    }
    const artifacts = loadArtifacts(artifactPaths);
    const report = record(reportValue);
    const source = string(report.executionSourceCommitSha);
    const evaluation = evaluateGroundGlassM7kBroadE2eQualification(
      reportValue,
      artifacts,
      sourceCommitAvailable(source),
    );
    if (evaluationOutputPath) {
      writeFileSync(resolve(root, evaluationOutputPath), `${JSON.stringify(evaluation, null, 2)}\n`);
    }
    process.stdout.write(`${JSON.stringify(evaluation, null, 2)}\n`);
    if (!evaluation.passed || (requireQualified && evaluation.broadE2eQualification !== "qualified")) {
      process.exitCode = requireQualified && evaluation.passed ? 3 : 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`M7K evidence evaluation failed closed: ${message}\n`);
    process.exitCode = 1;
  }
};

main();
