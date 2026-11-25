import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  GROUND_GLASS_M7J_BASE_COMMIT_SHA,
  GROUND_GLASS_M7J_CANDIDATE_COMMIT_SHA,
  evaluateGroundGlassM7jFourWorkerStability,
  type GroundGlassM7jArtifact,
} from "../src/render/testing/groundGlassM7jFourWorkerStability";

const root = process.cwd();
const defaultReportPath = "docs/architecture/GROUND_GLASS_M7J_FOUR_WORKER_STABILITY_REPORT.json";
const historicalM7iPath = "docs/architecture/GROUND_GLASS_M7I_BROAD_E2E_REMEDIATION_REPORT.json";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const readBytes = (path: string): Buffer | null => {
  try {
    return readFileSync(resolve(root, path));
  } catch {
    return null;
  }
};
const readJson = (bytes: Buffer | null): unknown => {
  if (!bytes) return null;
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    return null;
  }
};
const commitExists = (sha: string): boolean => spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
  cwd: root,
  stdio: "ignore",
}).status === 0;

const main = (): void => {
  const args = process.argv.slice(2);
  const reportOptions = args.filter((argument) => argument.startsWith("--report-path="));
  if (args.length !== reportOptions.length || reportOptions.length > 1 ||
      reportOptions.some((argument) => argument.slice("--report-path=".length).trim().length === 0)) {
    process.stderr.write("Supported M7J options: --report-path=<path>\n");
    process.exitCode = 2;
    return;
  }
  const reportPath = reportOptions.length === 1
    ? reportOptions[0].slice("--report-path=".length)
    : defaultReportPath;
  const reportBytes = readBytes(reportPath);
  const reportValue = readJson(reportBytes);
  const historicalBytes = readBytes(historicalM7iPath);
  const historicalValue = readJson(historicalBytes);
  if (!isRecord(reportValue) || !isRecord(historicalValue) || !historicalBytes) {
    process.stderr.write("M7J or accepted M7I evidence report is missing or malformed.\n");
    process.exitCode = 1;
    return;
  }

  const artifactPaths = [
    ...((Array.isArray(reportValue.experiments) ? reportValue.experiments : [])
      .filter(isRecord).map((experiment) => experiment.rawReportPath)),
    ...(["ordinaryChromiumSmoke", "productionPreviewIsolation"]
      .map((key) => isRecord(historicalValue.validation) && isRecord(historicalValue.validation[key])
        ? historicalValue.validation[key].rawReportPath
        : null)),
    ...[reportValue.currentDiscovery].filter(isRecord).flatMap((discovery) => [
      discovery.outputPath,
      discovery.rendererProjectOutputPath,
    ]),
    ...(isRecord(reportValue.validation) && Array.isArray(reportValue.validation.browserControls)
      ? reportValue.validation.browserControls.filter(isRecord).map((control) => control.rawReportPath)
      : []),
  ].filter((path): path is string => typeof path === "string");
  const artifacts: Record<string, GroundGlassM7jArtifact> = {};
  for (const path of artifactPaths) {
    const bytes = readBytes(path);
    if (!bytes) continue;
    let value: unknown;
    try {
      value = JSON.parse(bytes.toString("utf8")) as unknown;
    } catch {
      value = bytes.toString("utf8");
    }
    artifacts[path] = { sha256: digest(bytes), value };
  }
  const knownCommits = {
    [GROUND_GLASS_M7J_BASE_COMMIT_SHA]: commitExists(GROUND_GLASS_M7J_BASE_COMMIT_SHA),
    [GROUND_GLASS_M7J_CANDIDATE_COMMIT_SHA]: commitExists(GROUND_GLASS_M7J_CANDIDATE_COMMIT_SHA),
  };
  const evaluation = evaluateGroundGlassM7jFourWorkerStability(
    reportValue,
    historicalValue,
    digest(historicalBytes),
    artifacts,
    knownCommits,
  );
  process.stdout.write(`${JSON.stringify(evaluation, null, 2)}\n`);
  if (!evaluation.passed) process.exitCode = 1;
};

main();
