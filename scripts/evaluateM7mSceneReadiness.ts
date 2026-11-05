import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  GROUND_GLASS_M7M_DISCOVERY_PATHS,
  GROUND_GLASS_M7M_EXPECTED_EXPERIMENTS,
  GROUND_GLASS_M7M_RETAINED_EVALUATOR_FILES,
  GROUND_GLASS_M7M_RETAINED_NORMALIZER_SHA256,
  GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA,
  evaluateGroundGlassM7mSceneReadiness,
  parseGroundGlassM7mDiscoveryList,
  type GroundGlassM7mArtifact,
} from "../src/render/testing/groundGlassM7mSceneReadiness";

const root = process.cwd();
const defaultReportPath = "docs/architecture/GROUND_GLASS_M7M_SCENE_READINESS_REPORT.json";
const paths = {
  m7k: "docs/architecture/GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION_REPORT.json",
  m7l: "docs/architecture/GROUND_GLASS_M7L_LEARNING_DRAWER_REMEDIATION_REPORT.json",
  inventory: "docs/architecture/ground-glass-m7l-learning-drawer/historical-82-failure-inventory.json",
  runnerConfig: "playwright.config.ts",
} as const;

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const readSafeBytes = (path: string): Buffer => {
  const normalized = path.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized) ||
      normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Evidence path must be a safe repository-relative path: " + path);
  }
  const absolute = resolve(root, normalized);
  if (!absolute.startsWith(root + "/")) throw new Error("Evidence path escapes the repository: " + path);
  return readFileSync(absolute);
};
const parse = (path: string, bytes: Buffer): unknown => {
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error("Evidence file is not valid JSON: " + path);
  }
};
const load = (path: string) => {
  const bytes = readSafeBytes(path);
  return { bytes, value: parse(path, bytes), sha256: digest(bytes) };
};
const sourceCommitAvailable = (sha: string): boolean => spawnSync("git", ["cat-file", "-e", sha + "^{commit}"], {
  cwd: root,
  stdio: "ignore",
}).status === 0;
const sourceTreeEntryAvailable = (sha: string, path: string): boolean => spawnSync("git", ["cat-file", "-e", sha + ":" + path], {
  cwd: root,
  stdio: "ignore",
}).status === 0;
const sourceFileSha256 = (sha: string, path: string): string | null => {
  const result = spawnSync("git", ["cat-file", "blob", sha + ":" + path], { cwd: root });
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) return null;
  return digest(result.stdout);
};
const sourceFilesMatch = (sha: string, files: Readonly<Record<string, string>>): boolean =>
  Object.entries(files).every(([path, sha256]) => sourceFileSha256(sha, path) === sha256);

const main = (): void => {
  const args = process.argv.slice(2);
  const reportOptions = args.filter((argument) => argument.startsWith("--report-path="));
  if (args.length !== reportOptions.length || reportOptions.length > 1 ||
      reportOptions.some((argument) => argument.slice("--report-path=".length).trim().length === 0)) {
    process.stderr.write("Supported M7M options: --report-path=<path>\n");
    process.exitCode = 2;
    return;
  }
  const reportPath = reportOptions.length ? reportOptions[0].slice("--report-path=".length) : defaultReportPath;
  try {
    const reportFile = load(reportPath);
    const report = record(reportFile.value);
    const sourceProvenance = record(report.sourceProvenance);
    const runnerSource = record(sourceProvenance.playwrightRunner);
    const normalizerSource = record(sourceProvenance.retainedNormalizer);
    const evaluatorSource = record(sourceProvenance.retainedEvaluator);
    const historicalM7k = load(paths.m7k);
    const historicalM7l = load(paths.m7l);
    const historicalInventory = load(paths.inventory);
    const experiments: Record<string, GroundGlassM7mArtifact> = {};
    for (const [id, expected] of Object.entries(GROUND_GLASS_M7M_EXPECTED_EXPERIMENTS)) {
      const artifact = load(expected.artifactPath);
      experiments[id] = { sha256: artifact.sha256, value: artifact.value };
    }
    const ordinaryDiscoveryBytes = readSafeBytes(GROUND_GLASS_M7M_DISCOVERY_PATHS.ordinaryChromium);
    const rendererSerialDiscoveryBytes = readSafeBytes(GROUND_GLASS_M7M_DISCOVERY_PATHS.rendererSerial);
    const ordinaryDiscovery = parseGroundGlassM7mDiscoveryList(ordinaryDiscoveryBytes);
    const rendererSerialDiscovery = parseGroundGlassM7mDiscoveryList(rendererSerialDiscoveryBytes);
    const runnerSha = String(runnerSource.sourceCommitSha ?? "");
    const runnerPaths = [paths.runnerConfig, ...(ordinaryDiscovery?.specFiles ?? []), ...(rendererSerialDiscovery?.specFiles ?? [])]
      .map((path, index) => index === 0 || path.includes("/") ? path : "src/tests/e2e/" + path);
    const normalizerSha = String(normalizerSource.sourceCommitSha ?? "");
    const evaluatorSha = String(evaluatorSource.sourceCommitSha ?? "");
    const sourceVerification = {
      executionCommitAvailable: sourceCommitAvailable(String(report.executionSourceCommitSha ?? "")),
      executionRunnerTreeEntriesVerified: runnerPaths.every((path) => sourceTreeEntryAvailable(runnerSha, path)),
      normalizerCommitAvailable: sourceCommitAvailable(normalizerSha),
      normalizerContentVerified: sourceFileSha256(normalizerSha, "scripts/normalize-m7m-playwright-capture.mjs") === GROUND_GLASS_M7M_RETAINED_NORMALIZER_SHA256,
      evaluatorCommitAvailable: sourceCommitAvailable(evaluatorSha),
      evaluatorContentVerified: evaluatorSha === GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA && sourceFilesMatch(evaluatorSha, GROUND_GLASS_M7M_RETAINED_EVALUATOR_FILES),
    };
    const evaluation = evaluateGroundGlassM7mSceneReadiness(reportFile.value, {
      historicalM7k: historicalM7k.value,
      historicalM7kSha256: historicalM7k.sha256,
      historicalM7l: historicalM7l.value,
      historicalM7lSha256: historicalM7l.sha256,
      historicalInventory: historicalInventory.value,
      historicalInventorySha256: historicalInventory.sha256,
      sourceVerification,
      discoveryLists: {
        ordinaryChromium: ordinaryDiscoveryBytes,
        rendererSerial: rendererSerialDiscoveryBytes,
      },
      experiments,
    });
    process.stdout.write(JSON.stringify(evaluation, null, 2) + "\n");
    process.stdout.write("M7M normalized evidence integrity: " + evaluation.normalizedArtifactIntegrity.toUpperCase() + "\n");
    process.stdout.write("M7M evidence integrity: " + evaluation.evidenceIntegrity.toUpperCase() + "\n");
    process.stdout.write("M7M tooling source provenance: " + evaluation.sourceProvenanceIntegrity.toUpperCase() + "\n");
    process.stdout.write("M7M original discovery evidence: " + evaluation.discoveryProvenance.toUpperCase() + "\n");
    process.stdout.write("M7M candidate identities: " + evaluation.candidateIdentityCount + "\n");
    process.stdout.write("M7M verified fixes: " + evaluation.verifiedFixCount + "\n");
    process.stdout.write("Full Broad E2E: " + evaluation.fullBroadE2eQualification + "\n");
    if (!evaluation.passed) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write("M7M evidence evaluation failed closed: " + message + "\n");
    process.exitCode = 1;
  }
};

main();
