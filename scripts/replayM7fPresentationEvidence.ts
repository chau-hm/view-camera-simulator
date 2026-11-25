import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import {
  GROUND_GLASS_M7F_EVALUATOR_REVISION,
  GROUND_GLASS_M7F_PRESENTATION_EVIDENCE_REVISION,
  GROUND_GLASS_M7F_REPORT_ID,
  evaluateGroundGlassM7fPresentationEvidence,
  isGroundGlassM7fQualificationPass,
  type GroundGlassM7fPresentationEvidenceBundle,
} from "../src/render/webgpu/groundGlassM7fPresentationEvidence";

const DEFAULT_EVIDENCE_DIRECTORY = "docs/architecture/ground-glass-m7f-r187-presentation";
const DEFAULT_REPORT_OUTPUT = "docs/architecture/GROUND_GLASS_M7F_R187_PRESENTATION_REPORT.json";
const lifecycleFiles = [
  "raw-first-provisioning.json",
  "m5-composite-incomplete-failure.json",
  "optical-resource-initialization-failure.json",
  "presentation-node-initialization-failure.json",
  "presentation-pass-failure.json",
  "final-display-failure.json",
  "presentation-stale-resize.json",
  "m6c-stale-request.json",
  "m6c-retired-generation.json",
  "unsupported-scene-denied.json",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readOptionalJson = (directory: string, relativePath: string, readIssues: string[]): unknown => {
  const absolutePath = resolve(directory, relativePath);
  if (!existsSync(absolutePath)) return undefined;
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;
  } catch (error) {
    readIssues.push(`${relativePath}: ${error instanceof Error ? error.message : "invalid JSON"}`);
    return undefined;
  }
};

const recordAt = (value: unknown, path: readonly string[]): unknown => {
  let current = value;
  for (const key of path) current = isRecord(current) ? current[key] : undefined;
  return current;
};

const sourceCommitFrom = (...artifacts: unknown[]): string => {
  for (const artifact of artifacts) {
    const sourceCommit = recordAt(artifact, ["captureProvenance", "sourceCommitSha"])
      ?? recordAt(artifact, ["sourceProvenance", "sourceCommitSha"])
      ?? recordAt(artifact, ["sourceCommit"]);
    if (typeof sourceCommit === "string" && /^[0-9a-f]{40}$/i.test(sourceCommit)) return sourceCommit;
  }
  return "";
};

const captureInvocationFrom = (...artifacts: unknown[]): string => {
  for (const artifact of artifacts) {
    const invocation = recordAt(artifact, ["captureProvenance", "testInvocation"])
      ?? recordAt(artifact, ["sourceProvenance", "testInvocation"])
      ?? recordAt(artifact, ["testInvocation"]);
    if (typeof invocation === "string" && invocation.trim().length > 0) return invocation;
  }
  return "";
};

const gitCommitExists = (root: string, sha: string): Readonly<{ verified: boolean; error: string | null }> => {
  if (!/^[0-9a-f]{40}$/i.test(sha)) return { verified: false, error: "capture source commit SHA is missing or malformed" };
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: root, stdio: "ignore" });
    return { verified: true, error: null };
  } catch {
    return { verified: false, error: "capture source commit is unavailable in the current Git object database" };
  }
};

const main = (): void => {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const outputFlag = args.find((arg) => arg.startsWith("--report-output="));
  const evidenceFlag = args.find((arg) => arg.startsWith("--evidence-dir="));
  if (args.some((arg) => !arg.startsWith("--report-output=") && !arg.startsWith("--evidence-dir=")) ||
      args.filter((arg) => arg.startsWith("--report-output=")).length > 1 ||
      args.filter((arg) => arg.startsWith("--evidence-dir=")).length > 1) {
    throw new TypeError("Supported M7F replay options are --report-output=<path> and --evidence-dir=<path>");
  }

  const evidenceDirectoryArg = evidenceFlag?.slice("--evidence-dir=".length).trim() || DEFAULT_EVIDENCE_DIRECTORY;
  const evidenceDirectory = isAbsolute(evidenceDirectoryArg) ? evidenceDirectoryArg : resolve(root, evidenceDirectoryArg);
  const readIssues: string[] = [];
  const read = (path: string): unknown => readOptionalJson(evidenceDirectory, path, readIssues);
  const m6dComposite = read("m6d-composite.json");
  const m6bConformance = read("m6b-conformance.json");
  const m6cAlpha = read("m6c-alpha-conformance.json");
  const registeredApp = read("registered-app-m6.json");
  const productionIsolation = read("production-isolation.json");
  const lifecycle = Object.fromEntries(lifecycleFiles.flatMap((filename) => {
    const artifact = read(`lifecycle/${filename}`);
    return artifact === undefined ? [] : [[filename, artifact]];
  }));
  const artifacts = [m6dComposite, m6bConformance, m6cAlpha, registeredApp, productionIsolation, ...Object.values(lifecycle)];
  const sourceCommitSha = sourceCommitFrom(...artifacts);
  const testInvocation = captureInvocationFrom(m6bConformance, m6cAlpha, m6dComposite, registeredApp);
  const sourceCommitVerification = gitCommitExists(root, sourceCommitSha);

  const authorization = {
    rendererAttemptAuthority: "m3-raw-pilot",
    m4Status: "research-only",
    m5Status: "research-only",
    m6EvidenceUsedForRendererSelection: false,
    productionWebGpuEnabled: false,
    m5qChanged: false,
    m8Authorized: false,
    m9Authorized: false,
  } as const;
  const baseBundle: GroundGlassM7fPresentationEvidenceBundle = {
    schemaVersion: 1,
    reportId: GROUND_GLASS_M7F_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7F_EVALUATOR_REVISION,
    sourceCommitSha,
    testInvocation,
    authorization,
    m6dComposite,
    m6bConformance,
    m6cAlpha,
    registeredApp,
    lifecycle,
    productionIsolation,
  };
  const firstPass = evaluateGroundGlassM7fPresentationEvidence(baseBundle);
  const evaluation = evaluateGroundGlassM7fPresentationEvidence({
    ...baseBundle,
    declaredCounts: firstPass.computedCounts,
  });
  const hasFailed = evaluation.scenarios.some(({ status }) => status === "failed");
  const hasPassed = evaluation.scenarios.some(({ status }) => status === "passed");
  const candidateStatus = evaluation.decisions.m6DevelopmentAuthorization
    ? "passed"
    : hasFailed ? "failed" : hasPassed ? "partially-qualified" : "blocked";
  const qualificationStatus = sourceCommitVerification.verified && readIssues.length === 0
    ? candidateStatus
    : candidateStatus === "passed" ? "blocked" : candidateStatus;
  const decisions = {
    ...evaluation.decisions,
    m6DevelopmentAuthorization: evaluation.decisions.m6DevelopmentAuthorization &&
      sourceCommitVerification.verified && readIssues.length === 0,
  };
  const qualificationPass = isGroundGlassM7fQualificationPass({
    evaluation: { ...evaluation, decisions },
    qualificationStatus,
    sourceCommitVerified: sourceCommitVerification.verified,
    evidenceReadIssues: readIssues,
  });
  const captureArtifacts = [
    ["m6d-opaque-composite", "m6d-composite.json"],
    ["m6b-spatial-fixture", "m6b-conformance.json"],
    ["m6b-final-rgb", "m6b-conformance.json"],
    ["m6c-opaque-target-alpha", "m6c-alpha-conformance.json"],
    ["registered-architecture-rise-m3-m6", "registered-app-m6.json"],
    ...lifecycleFiles.map((file) => [file.replace(".json", ""), `lifecycle/${file}`]),
    ["production-webgl-isolation", "production-isolation.json"],
  ].map(([scenarioId, file]) => ({
    scenarioId,
    file,
    present: existsSync(resolve(evidenceDirectory, file)),
  }));
  const replayCodeCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const report = {
    schemaVersion: 1,
    reportId: GROUND_GLASS_M7F_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7F_EVALUATOR_REVISION,
    m6ImplementationEvidenceRevision: GROUND_GLASS_M7F_PRESENTATION_EVIDENCE_REVISION,
    replayMode: "offline-persisted-json-evidence",
    replayHasNoLiveBrowserOrGpu: true,
    nativeCaptureSourceSha: sourceCommitSha || null,
    sourceCommitVerification,
    replayCodeCommitSha,
    reportGenerationCommitSha: replayCodeCommitSha,
    testInvocation,
    evidenceReadIssues: readIssues,
    qualificationStatus,
    qualificationPass,
    runtimeIdentity: {
      threePackageVersion: recordAt(m6bConformance, ["captureProvenance", "threePackageVersion"]) ?? null,
      rendererRevision: recordAt(registeredApp, ["rendererRevision"]) ?? null,
      rendererFamily: recordAt(registeredApp, ["rendererFamily"]) ?? null,
      actualExecutionApi: recordAt(registeredApp, ["actualExecutionApi"]) ?? null,
      internalFallback: recordAt(registeredApp, ["internalFallback"]) ?? null,
      browserVersion: recordAt(registeredApp, ["browserVersion"]) ?? null,
      operatingSystem: recordAt(registeredApp, ["operatingSystem"]) ?? null,
    },
    authorization,
    historicalEvidencePreserved: {
      m6dContract: "m6d-opaque-presentation-v1",
      m5qRevision: "m5q-architecture-rise-r186-v3; M7E r187 quality results are independent and unchanged",
      m6R186EvidenceRewritten: false,
      productionWebGpuEnabled: false,
      m8Authorized: false,
      m9Authorized: false,
    },
    scenarioCounts: {
      declared: evaluation.declaredCounts,
      computed: evaluation.computedCounts,
      inventoryConsistent: evaluation.inventoryConsistent,
    },
    decisions,
    scenarios: evaluation.scenarios,
    captureArtifacts,
    limitations: [
      "Offline replay recomputes persisted numerical expectations and event contracts; it does not reproduce GPU execution.",
      "The native capture source SHA is preserved independently from the replay implementation and report-generation commit.",
      "Physical overlay evidence is limited to the controlled M6B calibration fixture.",
      "M5Q photographic quality remains separately qualified and is not promoted by M6 presentation conformance.",
    ],
  };
  const outputPath = outputFlag?.slice("--report-output=".length).trim() || DEFAULT_REPORT_OUTPUT;
  const resolvedOutput = isAbsolute(outputPath) ? outputPath : resolve(root, outputPath);
  const repositoryPrefix = `${resolve(root)}${sep}`;
  const temporaryPrefix = `${resolve(tmpdir())}${sep}`;
  if (!resolvedOutput.startsWith(repositoryPrefix) && !resolvedOutput.startsWith(temporaryPrefix)) {
    throw new TypeError("M7F report output must remain inside the repository or system temporary directory");
  }
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    reportId: GROUND_GLASS_M7F_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7F_EVALUATOR_REVISION,
    qualificationStatus,
    qualificationPass,
    scenarioCounts: report.scenarioCounts,
    sourceCommitVerification,
    evidenceReadIssues: readIssues,
    reportOutput: resolvedOutput,
  }, null, 2)}\n`);
  if (!qualificationPass) process.exitCode = 1;
};

main();
