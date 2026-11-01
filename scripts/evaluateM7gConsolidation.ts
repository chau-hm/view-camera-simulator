import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import {
  GROUND_GLASS_M7G_EVALUATOR_REVISION,
  GROUND_GLASS_M7G_REPORT_ID,
  evaluateGroundGlassM7gConsolidation,
} from "../src/render/webgpu/groundGlassM7gConsolidatedEvidence";

const root = process.cwd();
const evidenceDirectory = "docs/architecture/ground-glass-m7g-r187";
const defaultReport = "docs/architecture/GROUND_GLASS_M7G_R187_LIFECYCLE_CONSOLIDATION_REPORT.json";
const evaluationOutput = `${evidenceDirectory}/replay/consolidation-evaluation.json`;
const replayOutputs = {
  m7e: `${evidenceDirectory}/replay/m7e-offline-replay.json`,
  m7f: `${evidenceDirectory}/replay/m7f-offline-replay.json`,
};

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
const sha256 = (content: Buffer | string): string => createHash("sha256").update(content).digest("hex");

const readJson = (relativePath: string): unknown => {
  try {
    return JSON.parse(readFileSync(resolve(root, relativePath), "utf8")) as unknown;
  } catch {
    return null;
  }
};

const artifactInventory = (relativePaths: readonly string[]) => Object.fromEntries(relativePaths.map((path) => {
  const absolute = resolve(root, path);
  return [path, existsSync(absolute) ? { present: true, sha256: sha256(readFileSync(absolute)) } : { present: false, sha256: null }];
}));

const runReplay = (script: string, outputPath: string): JsonRecord => {
  const invocation = `${process.execPath} ${script} --report-output=${outputPath}`;
  const result = spawnSync(process.execPath, [script, `--report-output=${outputPath}`], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  const replayReport = record(readJson(outputPath));
  const replaySummary = replayReport ? {
    replayStatus: replayReport.replayStatus ?? null,
    qualificationStatus: replayReport.qualificationStatus ?? null,
    qualificationPass: replayReport.qualificationPass ?? null,
    scenarioCounts: replayReport.scenarioCounts ?? null,
    issueCount: Array.isArray(replayReport.issues) ? replayReport.issues.length :
      Array.isArray(replayReport.evidenceReadIssues) ? replayReport.evidenceReadIssues.length : null,
  } : null;
  return {
    invocation,
    exitCode: result.status,
    signal: result.signal,
    error: result.error?.message ?? null,
    replaySummary,
    stderr: (result.stderr ?? "").slice(-4_000),
    reportOutput: outputPath,
    reportPresent: existsSync(resolve(root, outputPath)),
  };
};

const main = (): void => {
  const args = process.argv.slice(2);
  const diagnostic = args.includes("--diagnostic");
  const outputOption = args.find((argument) => argument.startsWith("--report-output="));
  if (args.some((argument) => argument !== "--diagnostic" && !argument.startsWith("--report-output=")) ||
      args.filter((argument) => argument === "--diagnostic").length > 1 ||
      args.filter((argument) => argument.startsWith("--report-output=")).length > 1) {
    throw new TypeError("Supported M7G options are --diagnostic and --report-output=<path>");
  }

  mkdirSync(resolve(root, `${evidenceDirectory}/replay`), { recursive: true });
  const m7eReplayExecution = runReplay("scripts/run-m7e-offline-replay.mjs", replayOutputs.m7e);
  const m7fReplayExecution = runReplay("scripts/run-m7f-presentation-evidence-replay.mjs", replayOutputs.m7f);

  const sourcePaths = [
    "docs/architecture/GROUND_GLASS_M7C_R187_RAW_LIFECYCLE_REPORT.json",
    "docs/architecture/GROUND_GLASS_M7D_R187_PHYSICAL_COC_REPORT.json",
    "docs/architecture/ground-glass-m7e-r187-gather-b1/GROUND_GLASS_M7E_R187_GATHER_B1_REPORT.json",
    "docs/architecture/GROUND_GLASS_M7F_R187_PRESENTATION_REPORT.json",
    replayOutputs.m7e,
    replayOutputs.m7f,
    `${evidenceDirectory}/native/initialization/init-after-target-recheck.json`,
    `${evidenceDirectory}/native/device-loss/device-loss-equivalent.json`,
    `${evidenceDirectory}/native/device-loss/test-destroyed-device-lost-promise.json`,
    `${evidenceDirectory}/native/device-loss/external-loss-observation.json`,
    `${evidenceDirectory}/native/m5-composite-latest-request.json`,
    `${evidenceDirectory}/validation/broad-e2e.json`,
    `${evidenceDirectory}/validation/production-isolation.json`,
  ];

  const initialInput: JsonRecord = {
    schemaVersion: 1,
    reportId: GROUND_GLASS_M7G_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7G_EVALUATOR_REVISION,
    predecessorReports: {
      m7c: readJson("docs/architecture/GROUND_GLASS_M7C_R187_RAW_LIFECYCLE_REPORT.json"),
      m7d: readJson("docs/architecture/GROUND_GLASS_M7D_R187_PHYSICAL_COC_REPORT.json"),
      m7e: readJson("docs/architecture/ground-glass-m7e-r187-gather-b1/GROUND_GLASS_M7E_R187_GATHER_B1_REPORT.json"),
      m7f: readJson("docs/architecture/GROUND_GLASS_M7F_R187_PRESENTATION_REPORT.json"),
    },
    predecessorReplays: {
      m7e: readJson(replayOutputs.m7e),
      m7f: readJson(replayOutputs.m7f),
    },
    captures: {
      initialization: readJson(`${evidenceDirectory}/native/initialization/init-after-target-recheck.json`),
      deviceLossEquivalent: readJson(`${evidenceDirectory}/native/device-loss/device-loss-equivalent.json`),
      testDestroyedDeviceLoss: readJson(`${evidenceDirectory}/native/device-loss/test-destroyed-device-lost-promise.json`),
      externalLoss: readJson(`${evidenceDirectory}/native/device-loss/external-loss-observation.json`),
      heldComposite: readJson(`${evidenceDirectory}/native/m5-composite-latest-request.json`),
      broadE2e: readJson(`${evidenceDirectory}/validation/broad-e2e.json`),
      productionIsolation: readJson(`${evidenceDirectory}/validation/production-isolation.json`),
    },
    authorization: {
      m3RawRttRendererAttemptAuthority: "m3-raw-pilot",
      r187M4Status: "research-only",
      r187M5Status: "research-only",
      r187M6Status: "development-only",
      m5qStatus: "partially-qualified",
      m6EvidenceUsedForRendererSelection: false,
      productionWebGpuEnabled: false,
      productionGroundGlass: "WebGL-only",
      m8Authorized: false,
      m9Authorized: false,
      productionTestSeamExposed: false,
    },
  };

  const initialEvaluation = evaluateGroundGlassM7gConsolidation(initialInput);
  const scenarioClaims = initialEvaluation.scenarios.map(({ id, status }) => ({ id, status }));
  const scenarioCounts = initialEvaluation.scenarioCounts.computed;
  const input: JsonRecord = { ...initialInput, scenarios: scenarioClaims, scenarioCounts };
  const evaluation = evaluateGroundGlassM7gConsolidation(input);
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const outputPathArg = outputOption?.slice("--report-output=".length).trim();
  const reportPath = outputPathArg || defaultReport;
  const resolvedReportPath = isAbsolute(reportPath) ? reportPath : resolve(root, reportPath);
  if (!resolvedReportPath.startsWith(`${resolve(root)}/`)) throw new TypeError("M7G report output must remain inside the repository");
  mkdirSync(dirname(resolvedReportPath), { recursive: true });

  const report = {
    schemaVersion: 1,
    reportId: GROUND_GLASS_M7G_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7G_EVALUATOR_REVISION,
    generatedAt: new Date().toISOString(),
    reportGenerationSourceSha: sourceSha,
    mode: diagnostic ? "diagnostic-report" : "strict-qualification-replay",
    evidenceSources: artifactInventory(sourcePaths),
    predecessorEvidence: evaluation.predecessorEvidence,
    scenarioCounts: {
      declared: scenarioCounts,
      computed: evaluation.scenarioCounts.computed,
      inventoryConsistent: evaluation.scenarioCounts.inventoryConsistent,
    },
    scenarios: evaluation.scenarios,
    decisions: evaluation.decisions,
    qualificationStatus: evaluation.qualificationStatus,
    qualificationPass: evaluation.qualificationPass,
    evidenceIntegrity: evaluation.evidenceIntegrity,
    valid: evaluation.valid,
    issues: evaluation.issues,
    authorization: evaluation.authorization,
    replayExecution: { m7e: m7eReplayExecution, m7f: m7fReplayExecution },
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  writeFileSync(resolvedReportPath, serialized);
  const evaluationPath = resolve(root, evaluationOutput);
  writeFileSync(evaluationPath, `${JSON.stringify({ ...evaluation, generatedFromSha: sourceSha }, null, 2)}\n`);

  process.stdout.write(`${JSON.stringify({
    reportId: GROUND_GLASS_M7G_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7G_EVALUATOR_REVISION,
    mode: report.mode,
    qualificationStatus: evaluation.qualificationStatus,
    qualificationPass: evaluation.qualificationPass,
    valid: evaluation.valid,
    scenarioCounts: evaluation.scenarioCounts,
    decisions: evaluation.decisions,
    issues: evaluation.issues,
    reportOutput: reportPath,
    evaluationOutput,
    predecessorReplayExitCodes: {
      m7e: m7eReplayExecution.exitCode,
      m7f: m7fReplayExecution.exitCode,
    },
  }, null, 2)}\n`);

  if (diagnostic) {
    if (!evaluation.valid) process.exitCode = 1;
  } else if (!evaluation.qualificationPass) {
    process.exitCode = 1;
  }
};

main();
