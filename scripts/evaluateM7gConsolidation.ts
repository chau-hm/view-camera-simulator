import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import {
  GROUND_GLASS_M7G_EVALUATOR_REVISION,
  GROUND_GLASS_M7G_REPORT_ID,
  evaluateGroundGlassM7gConsolidation,
  validateGroundGlassM7gPlaywrightReport,
} from "../src/render/webgpu/groundGlassM7gConsolidatedEvidence";
import { createFreshReplayDirectory, runFreshReplay } from "./m7gReplayOrchestration.mjs";

const root = process.cwd();
const evidenceDirectory = "docs/architecture/ground-glass-m7g-r187";
const defaultReport = "docs/architecture/GROUND_GLASS_M7G_R187_LIFECYCLE_CONSOLIDATION_REPORT.json";
const defaultEvaluation = `${evidenceDirectory}/replay/consolidation-evaluation.json`;
const m7eScript = "scripts/run-m7e-offline-replay.mjs";
const m7fScript = "scripts/run-m7f-presentation-evidence-replay.mjs";

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const record = (value: unknown): JsonRecord | null => isRecord(value) ? value : null;
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

const readBroadE2eWithRawReportValidation = (): unknown => {
  const capture = record(readJson(`${evidenceDirectory}/validation/broad-e2e.json`));
  let reportBytes: Buffer | null = null;
  let reportValue: unknown = null;
  try {
    reportBytes = readFileSync(resolve(root, `${evidenceDirectory}/validation/broad-e2e-playwright.json`));
    reportValue = JSON.parse(reportBytes.toString("utf8")) as unknown;
  } catch {
    reportValue = null;
  }
  const validation = validateGroundGlassM7gPlaywrightReport(
    reportValue,
    reportBytes ? sha256(reportBytes) : null,
  );
  return capture ? { ...capture, playwrightReportValidation: validation } : null;
};

const resolveOutputPath = (path: string): string => {
  const absolute = isAbsolute(path) ? path : resolve(root, path);
  if (!absolute.startsWith(`${resolve(root)}/`)) {
    throw new TypeError("M7G report outputs must remain inside the repository");
  }
  return absolute;
};

const main = (): void => {
  const args = process.argv.slice(2);
  const diagnostic = args.includes("--diagnostic");
  const reportOutputOption = args.find((argument) => argument.startsWith("--report-output="));
  const evaluationOutputOption = args.find((argument) => argument.startsWith("--evaluation-output="));
  if (args.some((argument) => argument !== "--diagnostic" &&
      !argument.startsWith("--report-output=") && !argument.startsWith("--evaluation-output=")) ||
      args.filter((argument) => argument === "--diagnostic").length > 1 ||
      args.filter((argument) => argument.startsWith("--report-output=")).length > 1 ||
      args.filter((argument) => argument.startsWith("--evaluation-output=")).length > 1) {
    throw new TypeError("Supported M7G options are --diagnostic, --report-output=<path>, and --evaluation-output=<path>");
  }

  const reportOption = reportOutputOption?.slice("--report-output=".length).trim();
  const evaluationOption = evaluationOutputOption?.slice("--evaluation-output=".length).trim();
  const reportPath = reportOption || defaultReport;
  const evaluationPath = evaluationOption || defaultEvaluation;
  const resolvedReportPath = resolveOutputPath(reportPath);
  const resolvedEvaluationPath = resolveOutputPath(evaluationPath);
  if (resolvedReportPath === resolvedEvaluationPath) throw new TypeError("M7G report and evaluation outputs must be distinct");

  const predecessorReports = {
    m7c: readJson("docs/architecture/GROUND_GLASS_M7C_R187_RAW_LIFECYCLE_REPORT.json"),
    m7d: readJson("docs/architecture/GROUND_GLASS_M7D_R187_PHYSICAL_COC_REPORT.json"),
    m7e: readJson("docs/architecture/ground-glass-m7e-r187-gather-b1/GROUND_GLASS_M7E_R187_GATHER_B1_REPORT.json"),
    m7f: readJson("docs/architecture/GROUND_GLASS_M7F_R187_PRESENTATION_REPORT.json"),
  };
  const m7eSourceSha = record(predecessorReports.m7e)?.sourceCommitSha;
  const m7fSourceSha = record(predecessorReports.m7f)?.nativeCaptureSourceSha;
  const replayCodeSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const replayDirectory = createFreshReplayDirectory(root);
  let m7eReplayRun: ReturnType<typeof runFreshReplay> | null = null;
  let m7fReplayRun: ReturnType<typeof runFreshReplay> | null = null;

  try {
    m7eReplayRun = runFreshReplay({
      repoRoot: root,
      replayDirectory,
      kind: "m7e",
      script: m7eScript,
      expectedSourceSha: typeof m7eSourceSha === "string" ? m7eSourceSha : "",
      expectedReplayCodeSha: replayCodeSha,
    });
    m7fReplayRun = runFreshReplay({
      repoRoot: root,
      replayDirectory,
      kind: "m7f",
      script: m7fScript,
      expectedSourceSha: typeof m7fSourceSha === "string" ? m7fSourceSha : "",
      expectedReplayCodeSha: replayCodeSha,
    });

    const sourcePaths = [
      "docs/architecture/GROUND_GLASS_M7C_R187_RAW_LIFECYCLE_REPORT.json",
      "docs/architecture/GROUND_GLASS_M7D_R187_PHYSICAL_COC_REPORT.json",
      "docs/architecture/ground-glass-m7e-r187-gather-b1/GROUND_GLASS_M7E_R187_GATHER_B1_REPORT.json",
      "docs/architecture/GROUND_GLASS_M7F_R187_PRESENTATION_REPORT.json",
      `${evidenceDirectory}/native/initialization/init-after-target-recheck.json`,
      `${evidenceDirectory}/native/device-loss/device-loss-equivalent.json`,
      `${evidenceDirectory}/native/device-loss/test-destroyed-device-lost-promise.json`,
      `${evidenceDirectory}/native/device-loss/external-loss-observation.json`,
      `${evidenceDirectory}/native/m5-composite-latest-request.json`,
      `${evidenceDirectory}/validation/broad-e2e.json`,
      `${evidenceDirectory}/validation/broad-e2e-playwright.json`,
      `${evidenceDirectory}/validation/production-isolation.json`,
    ];

    const captures = {
      initialization: readJson(`${evidenceDirectory}/native/initialization/init-after-target-recheck.json`),
      deviceLossEquivalent: readJson(`${evidenceDirectory}/native/device-loss/device-loss-equivalent.json`),
      testDestroyedDeviceLoss: readJson(`${evidenceDirectory}/native/device-loss/test-destroyed-device-lost-promise.json`),
      externalLoss: readJson(`${evidenceDirectory}/native/device-loss/external-loss-observation.json`),
      heldComposite: readJson(`${evidenceDirectory}/native/m5-composite-latest-request.json`),
      broadE2e: readBroadE2eWithRawReportValidation(),
      productionIsolation: readJson(`${evidenceDirectory}/validation/production-isolation.json`),
    };
    const authorization = {
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
    };

    const initialInput: JsonRecord = {
      schemaVersion: 1,
      reportId: GROUND_GLASS_M7G_REPORT_ID,
      evaluatorRevision: GROUND_GLASS_M7G_EVALUATOR_REVISION,
      predecessorReports,
      predecessorReplays: { m7e: m7eReplayRun.report, m7f: m7fReplayRun.report },
      predecessorReplayExecutions: { m7e: m7eReplayRun.execution, m7f: m7fReplayRun.execution },
      captures,
      authorization,
    };

    const initialEvaluation = evaluateGroundGlassM7gConsolidation(initialInput);
    const scenarioClaims = initialEvaluation.scenarios.map(({ id, status }) => ({ id, status }));
    const scenarioCounts = initialEvaluation.scenarioCounts.computed;
    const input: JsonRecord = { ...initialInput, scenarios: scenarioClaims, scenarioCounts };
    const evaluation = evaluateGroundGlassM7gConsolidation(input);
    const sourceSha = replayCodeSha;
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
      replayExecution: { m7e: m7eReplayRun.execution, m7f: m7fReplayRun.execution },
    };
    mkdirSync(dirname(resolvedReportPath), { recursive: true });
    mkdirSync(dirname(resolvedEvaluationPath), { recursive: true });
    writeFileSync(resolvedReportPath, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolvedEvaluationPath, `${JSON.stringify({ ...evaluation, generatedFromSha: sourceSha }, null, 2)}\n`);

    if (diagnostic && evaluation.valid) {
      process.stdout.write("M7G evidence integrity: PASS\n");
      process.stdout.write(`M7G qualification: ${evaluation.qualificationStatus === "partially-qualified" ? "PARTIALLY QUALIFIED" : evaluation.qualificationStatus.toUpperCase()}\n`);
      process.stdout.write(`M8 entry: ${evaluation.decisions.m8EntryGate.toUpperCase()}\n`);
      process.stdout.write(`Production WebGPU: ${authorization.productionWebGpuEnabled ? "ENABLED" : "DISABLED"}\n`);
    } else if (diagnostic) {
      process.stdout.write("M7G evidence integrity: FAIL\n");
    }
    process.stdout.write(`${JSON.stringify({
      reportId: GROUND_GLASS_M7G_REPORT_ID,
      evaluatorRevision: GROUND_GLASS_M7G_EVALUATOR_REVISION,
      mode: report.mode,
      qualificationStatus: evaluation.qualificationStatus,
      qualificationPass: evaluation.qualificationPass,
      evidenceIntegrity: evaluation.evidenceIntegrity,
      valid: evaluation.valid,
      scenarioCounts: evaluation.scenarioCounts,
      decisions: evaluation.decisions,
      issues: evaluation.issues,
      reportOutput: reportPath,
      evaluationOutput: evaluationPath,
      predecessorReplayValidity: {
        m7e: m7eReplayRun.execution.valid,
        m7f: m7fReplayRun.execution.valid,
      },
    }, null, 2)}\n`);

    if (diagnostic) {
      if (!evaluation.valid) process.exitCode = 1;
    } else if (!evaluation.qualificationPass) {
      process.exitCode = 1;
    }
  } finally {
    rmSync(replayDirectory, { recursive: true, force: true });
  }
};

main();
