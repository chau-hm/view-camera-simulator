import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  GROUND_GLASS_M7E_EVALUATOR_REVISION,
  GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS,
  type GroundGlassM7eRuntimeIdentity,
} from "../src/render/webgpu/groundGlassM7eGatherB1Evidence";
import {
  decodeGroundGlassM7eLosslessJson,
  equalGroundGlassM7eLosslessJsonValue,
} from "../src/render/webgpu/groundGlassM7eLosslessEvidenceJson";
import {
  replayGroundGlassM7eReport,
  type GroundGlassM7eSerializedReport,
} from "../src/render/webgpu/groundGlassM7eReportReplay";
import {
  assertM7eArtifactSha256,
  assertM7eReplayPlatform,
  readGroundGlassM7eCaptureArtifact,
} from "./m7eEvidenceReplayLoader";
import type { GroundGlassB1BoundaryProbeReadback } from "../src/render/webgpu/groundGlassWebGpuTestSeam";

const EVIDENCE_DIRECTORY = "docs/architecture/ground-glass-m7e-r187-gather-b1";
const DEFAULT_OUTPUT = `${EVIDENCE_DIRECTORY}/M7E_OFFLINE_REPLAY_REPORT.json`;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const parseJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new SyntaxError(`Cannot parse M7E evidence JSON ${path}: ${error instanceof Error ? error.message : "parse error"}`);
  }
};

const decodeProbe = (artifact: unknown, captureSourceCommitSha: string, label: string): GroundGlassB1BoundaryProbeReadback => {
  if (!isRecord(artifact) || !isRecord(artifact.provenance)) throw new TypeError(`${label} is missing its lossless codec provenance`);
  const provenance = artifact.provenance;
  if (provenance.captureSourceCommitSha !== captureSourceCommitSha
      || !["captured-before-json", "controlled-case-and-half-bits"].includes(String(provenance.valueRecovery))) {
    throw new TypeError(`${label} provenance does not identify the capture source and numeric recovery method`);
  }
  const decoded = decodeGroundGlassM7eLosslessJson(artifact);
  if (!isRecord(decoded)) throw new TypeError(`${label} payload must be a boundary-probe object`);
  return decoded as unknown as GroundGlassB1BoundaryProbeReadback;
};

const main = (): void => {
  assertM7eReplayPlatform();
  const root = process.cwd();
  const args = JSON.parse(process.env.GROUND_GLASS_M7E_REPLAY_ARGS ?? "[]") as string[];
  const noWrite = args.includes("--no-write-report");
  const outputFlag = args.find((arg) => arg.startsWith("--report-output="));
  if (args.some((arg) => !["--no-write-report"].includes(arg) && !arg.startsWith("--report-output="))) {
    throw new TypeError("Supported M7E replay options are --no-write-report and --report-output=<path>");
  }
  const reportPath = resolve(root, EVIDENCE_DIRECTORY, "GROUND_GLASS_M7E_R187_GATHER_B1_REPORT.json");
  const report = parseJson(reportPath) as GroundGlassM7eSerializedReport;
  if (!/^[0-9a-f]{40}$/i.test(report.sourceCommitSha)) throw new TypeError("M7E capture source commit SHA is malformed");
  execFileSync("git", ["cat-file", "-e", `${report.sourceCommitSha}^{commit}`], { cwd: root, stdio: "ignore" });

  const embeddedProbe = isRecord(report.b1BoundaryProbe) ? report.b1BoundaryProbe.readback : undefined;
  const boundaryProbe = decodeProbe(embeddedProbe, report.sourceCommitSha, "Embedded B1 boundary probe");
  const standaloneArtifact = parseJson(resolve(root, EVIDENCE_DIRECTORY, "b1-boundary-probe.json"));
  const standaloneProbe = decodeProbe(standaloneArtifact, report.sourceCommitSha, "Standalone B1 boundary probe");

  const supportRows = report.supportingArtifacts;
  if (!Array.isArray(supportRows) || supportRows.length !== GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS.length) {
    throw new TypeError("M7E report does not enumerate exactly twelve capture artifact pairs");
  }
  const supportByScenario = new Map<string, (typeof supportRows)[number]>();
  for (const item of supportRows) {
    if (supportByScenario.has(item.scenarioId)) throw new TypeError(`Duplicate M7E artifact provenance for ${item.scenarioId}`);
    supportByScenario.set(item.scenarioId, item);
  }

  const runtime = report.runtime as GroundGlassM7eRuntimeIdentity;
  const captures = [];
  const captureArtifactSummaries: Array<Readonly<{ scenarioId: string; manifestSha256: string; payloadSha256: string }>> = [];
  for (const scenarioId of GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS) {
    const support = supportByScenario.get(scenarioId);
    if (!support) throw new TypeError(`Missing M7E artifact provenance for ${scenarioId}`);
    const expectedFiles = `captures/${scenarioId}.json;captures/${scenarioId}.bin.gz`;
    if (support.files !== expectedFiles) throw new TypeError(`M7E report artifact paths do not match the safe scenario path for ${scenarioId}`);
    const loaded = readGroundGlassM7eCaptureArtifact(
      resolve(root, EVIDENCE_DIRECTORY, "captures"),
      scenarioId,
      report.sourceCommitSha,
      runtime,
      report.testInvocation,
    );
    assertM7eArtifactSha256(loaded.manifestBytes, support.manifestSha256, `${scenarioId} manifest`);
    assertM7eArtifactSha256(loaded.compressedPayload, support.sha256, `${scenarioId} gzip payload`);
    captures.push(loaded.envelope);
    captureArtifactSummaries.push({
      scenarioId,
      manifestSha256: support.manifestSha256,
      payloadSha256: support.sha256,
    });
  }

  const replay = replayGroundGlassM7eReport(report, captures, boundaryProbe, standaloneProbe);
  const replayCodeCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const statusCounts = {
    passed: replay.captureEvaluations.filter(({ status }) => status === "passed").length,
    failed: replay.captureEvaluations.filter(({ status }) => status === "failed").length,
    blocked: 0,
    "not-run": 0,
  };
  const summary = {
    schemaVersion: 1,
    reportId: "ground-glass-m7e-r187-offline-replay",
    evaluatorRevision: GROUND_GLASS_M7E_EVALUATOR_REVISION,
    replayStatus: replay.status,
    replayMode: "offline-persisted-artifacts",
    noBrowser: true,
    noApplicationServer: true,
    noGpu: true,
    noTemporaryFiles: true,
    captureSourceCommitSha: report.sourceCommitSha,
    replayCodeCommitSha,
    replayInvocation: "npm run evidence:replay:m7e",
    runtimeIdentity: report.runtime,
    testInvocation: report.testInvocation,
    scenarioCounts: statusCounts,
    declaredInventoryCountsMatched: replay.inventoryIssues.length === 0,
    captures: replay.captureEvaluations.map(({ scenarioId, status, issues, measured }) => ({ scenarioId, status, issueCodes: issues.map(({ code }) => code), measured })),
    b1BoundaryProbe: {
      status: replay.boundaryProbe.status,
      observedCaseIds: replay.boundaryProbe.observedCaseIds,
      issueCodes: replay.boundaryProbe.issues.map(({ code }) => code),
      standaloneAndEmbeddedPayloadsMatched: sameProbe(boundaryProbe, standaloneProbe),
    },
    qualityReplay: {
      replayedMetricsMatched: !replay.issues.some((issue) => issue.includes("R3 metrics") || issue.includes("Q1-Q7 metrics")),
      persistedResearchQualificationStatus: report.qualification.status,
      dimensionStatuses: Object.fromEntries(Object.entries(replay.qualityEvaluation.dimensions).map(([dimension, result]) => [dimension, result.status])),
      dimensions: Object.fromEntries(Object.entries(replay.qualityEvaluation.dimensions).map(([dimension, result]) => [dimension, {
        status: result.status,
        captureIds: result.captureIds,
        measurements: result.measurements,
        failedGates: result.criteria.filter(({ met }) => !met).map(({ key }) => key),
      }])),
      issues: replay.qualityEvaluation.issues,
    },
    authorization: {
      rendererAttemptAuthority: report.inventory.m3RendererSelectionAuthority,
      m5RendererAttemptAuthorized: report.inventory.m5RendererAttemptAuthorized,
      m5GatherEvidenceStatus: report.inventory.m5GatherEvidenceStatus,
      m5B1EvidenceStatus: report.inventory.m5B1EvidenceStatus,
      m6R187Authorized: report.inventory.m6R187Authorized,
      productionWebGpuEnabled: report.inventory.productionWebGpuEnabled,
    },
    captureArtifacts: captureArtifactSummaries,
    issues: replay.issues,
  };
  const outputPath = outputFlag
    ? (outputFlag.slice("--report-output=".length).trim() || DEFAULT_OUTPUT)
    : DEFAULT_OUTPUT;
  if (!noWrite) {
    const resolvedOutput = isAbsolute(outputPath) ? outputPath : resolve(root, outputPath);
    if (!resolvedOutput.startsWith(`${resolve(root)}/`)) throw new TypeError("M7E replay summary output must stay inside the repository");
    writeFileSync(resolvedOutput, `${JSON.stringify(summary, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (replay.status !== "passed") process.exitCode = 1;
};

const sameProbe = (left: GroundGlassB1BoundaryProbeReadback, right: GroundGlassB1BoundaryProbeReadback): boolean =>
  equalGroundGlassM7eLosslessJsonValue(left, right);

main();
