import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_M7M_BASE_COMMIT_SHA,
  GROUND_GLASS_M7M_DISCOVERY_PATHS,
  GROUND_GLASS_M7M_EVALUATOR_REVISION,
  GROUND_GLASS_M7M_MUTATION_SUITE_REVISION,
  GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA,
  GROUND_GLASS_M7M_REQUIRED_COHORT_IDENTITIES,
  GROUND_GLASS_M7M_REQUIRED_EXPERIMENT_IDS,
  GROUND_GLASS_M7M_REQUIRED_MUTATION_CASES,
  GROUND_GLASS_M7M_EXPECTED_EXPERIMENTS,
  evaluateGroundGlassM7mSceneReadiness,
  type GroundGlassM7mEvidence,
} from "../../render/testing/groundGlassM7mSceneReadiness";

type RecordValue = Record<string, unknown>;
type Fixture = { report: RecordValue; evidence: GroundGlassM7mEvidence };
const reportPath = "docs/architecture/GROUND_GLASS_M7M_SCENE_READINESS_REPORT.json";
const inventoryPath = "docs/architecture/ground-glass-m7l-learning-drawer/historical-82-failure-inventory.json";
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const readBytes = (path: string): Buffer => readFileSync(resolve(process.cwd(), path));
const readJson = (path: string): RecordValue => JSON.parse(readBytes(path).toString("utf8")) as RecordValue;
const record = (value: unknown): RecordValue => typeof value === "object" && value !== null && !Array.isArray(value) ? value as RecordValue : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const loadFixture = (): Fixture => {
  const report = readJson(reportPath);
  const artifacts: Record<string, { sha256: string; value: unknown }> = {};
  for (const [id, expected] of Object.entries(GROUND_GLASS_M7M_EXPECTED_EXPERIMENTS)) {
    const bytes = readBytes(expected.artifactPath);
    artifacts[id] = { sha256: digest(bytes), value: JSON.parse(bytes.toString("utf8")) as unknown };
  }
  const m7kBytes = readBytes("docs/architecture/GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION_REPORT.json");
  const m7lBytes = readBytes("docs/architecture/GROUND_GLASS_M7L_LEARNING_DRAWER_REMEDIATION_REPORT.json");
  const inventoryBytes = readBytes(inventoryPath);
  return {
    report,
    evidence: {
      historicalM7k: JSON.parse(m7kBytes.toString("utf8")) as unknown,
      historicalM7kSha256: digest(m7kBytes),
      historicalM7l: JSON.parse(m7lBytes.toString("utf8")) as unknown,
      historicalM7lSha256: digest(m7lBytes),
      historicalInventory: JSON.parse(inventoryBytes.toString("utf8")) as unknown,
      historicalInventorySha256: digest(inventoryBytes),
      sourceVerification: {
        executionCommitAvailable: true,
        executionRunnerTreeEntriesVerified: true,
        normalizerCommitAvailable: true,
        normalizerContentVerified: true,
        evaluatorCommitAvailable: true,
        evaluatorContentVerified: true,
      },
      discoveryLists: {
        ordinaryChromium: readBytes(GROUND_GLASS_M7M_DISCOVERY_PATHS.ordinaryChromium),
        rendererSerial: readBytes(GROUND_GLASS_M7M_DISCOVERY_PATHS.rendererSerial),
      },
      experiments: artifacts,
    },
  };
};
const evaluate = (fixture: Fixture) => evaluateGroundGlassM7mSceneReadiness(fixture.report, fixture.evidence);
const rejectFor = (fixture: Fixture, issue: string): void => {
  const result = evaluate(fixture);
  expect(result.passed).toBe(false);
  expect(result.issues).toContain(issue);
};
const experiment = (fixture: Fixture, id: string): RecordValue => {
  const found = array(fixture.report.experiments).map(record).find((entry) => entry.id === id);
  if (!found) throw new Error("Missing experiment " + id);
  return found;
};
const normalized = (fixture: Fixture, id: string): RecordValue => {
  const artifact = fixture.evidence.experiments[id];
  if (!artifact) throw new Error("Missing normalized artifact " + id);
  return record(artifact.value);
};
const outcomeRow = (fixture: Fixture, identity: string): RecordValue => {
  const found = array(record(fixture.report.cohort).outcomes).map(record).find((entry) => entry.identity === identity);
  if (!found) throw new Error("Missing cohort outcome row " + identity);
  return found;
};
const git = (cwd: string, args: readonly string[], allowFailure = false) => {
  const result = spawnSync("git", [...args], { cwd, encoding: "utf8" });
  if (!allowFailure && result.status !== 0) throw new Error("git " + args.join(" ") + " failed: " + result.stderr);
  return result;
};
const copyWorkingTreeSnapshot = (destination: string): void => {
  mkdirSync(destination, { recursive: true });
  const listing = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: process.cwd(),
  });
  if (listing.status !== 0 || !Buffer.isBuffer(listing.stdout)) throw new Error("Could not list current M7M snapshot files");
  for (const file of listing.stdout.toString("utf8").split("\0").filter(Boolean)) {
    const source = resolve(process.cwd(), file);
    const target = resolve(destination, file);
    if (!target.startsWith(destination + "/")) throw new Error("Snapshot path escaped its temporary repository");
    mkdirSync(dirname(target), { recursive: true });
    const stat = lstatSync(source);
    if (stat.isSymbolicLink()) symlinkSync(readlinkSync(source), target);
    else copyFileSync(source, target);
  }
};
const copyCommitObjects = (
  source: string,
  destinationBare: string,
  commits: readonly string[],
  sourceFilesByCommit: Readonly<Record<string, readonly string[]>>,
): void => {
  const objectTypes = new Map<string, string>();
  for (const commit of commits) {
    objectTypes.set(commit, "commit");
    const tree = git(source, ["rev-parse", commit + "^{tree}"]).stdout.trim();
    objectTypes.set(tree, "tree");
    const listing = spawnSync("git", ["ls-tree", "-r", "-t", "-z", "--full-tree", commit], { cwd: source, maxBuffer: 64 * 1024 * 1024 });
    if (listing.status !== 0 || !Buffer.isBuffer(listing.stdout)) throw new Error("Could not inspect source commit tree " + commit);
    for (const entry of listing.stdout.toString("utf8").split("\0").filter(Boolean)) {
      const metadata = entry.slice(0, entry.indexOf("\t")).split(" ");
      if (metadata.length === 3) objectTypes.set(metadata[2], metadata[1]);
    }
    for (const file of sourceFilesByCommit[commit] ?? []) {
      const blob = git(source, ["rev-parse", commit + ":" + file]).stdout.trim();
      objectTypes.set(blob, "blob");
    }
  }
  const newline = String.fromCharCode(10);
  const packed = spawnSync("git", ["pack-objects", "--stdout"], {
    cwd: source,
    input: Buffer.from([...objectTypes.keys()].join(newline) + newline),
    maxBuffer: 256 * 1024 * 1024,
  });
  if (packed.status !== 0 || !Buffer.isBuffer(packed.stdout)) throw new Error("Could not pack exact source Git objects: " + packed.stderr);
  const indexed = spawnSync("git", ["index-pack", "--stdin"], {
    cwd: destinationBare,
    input: packed.stdout,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (indexed.status !== 0) throw new Error("Could not import exact source Git objects: " + indexed.stderr);
};
const shallowClone = (remote: string, destination: string): void => {
  const result = spawnSync("git", ["clone", "--depth=1", "--no-tags", "--branch", "main", pathToFileURL(remote).href, destination], {
    cwd: tmpdir(),
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error("Could not create isolated shallow post-squash clone: " + result.stderr);
};
const runM7mCli = (cwd: string, reportPath?: string) => spawnSync(process.execPath, [
  join(cwd, "scripts/run-m7m-scene-readiness.mjs"),
  ...(reportPath ? ["--report-path=" + reportPath] : []),
], { cwd, encoding: "utf8" });
const sourceVerification = (fixture: Fixture): RecordValue => fixture.evidence.sourceVerification as RecordValue;
const discoveryBytes = (fixture: Fixture, lane: "ordinaryChromium" | "rendererSerial"): Buffer => {
  const bytes = fixture.evidence.discoveryLists[lane];
  if (!bytes) throw new Error("Missing retained discovery bytes for " + lane);
  return Buffer.from(bytes);
};

const mutations: ReadonlyArray<readonly [string, (fixture: Fixture) => void, string]> = [
  ["m7k-report-digest-changed", (f) => { record(f.report.historicalM7k).reportSha256 = "0".repeat(64); }, "historical-m7k-report-identity-or-digest-mismatch"],
  ["m7k-full-suite-counts-changed", (f) => { record(record(f.report.historicalM7k).fullSuiteCounts).unexpected = 81; }, "historical-m7k-full-suite-counts-mismatch"],
  ["m7l-report-digest-changed", (f) => { record(f.report.historicalM7l).reportSha256 = "0".repeat(64); }, "historical-m7l-report-identity-or-digest-mismatch"],
  ["m7l-raw-provenance-overstated", (f) => { record(record(f.evidence.historicalM7l).rawCaptureProvenance).originalRawCaptureProvenance = "verified"; }, "historical-m7l-provenance-limitations-overstated"],
  ["historical-inventory-digest-changed", (f) => { f.evidence = { ...f.evidence, historicalInventorySha256: "0".repeat(64) }; }, "historical-inventory-digest-mismatch"],
  ["historical-candidate-identity-removed", (f) => { record(f.report.historicalM7k).identityList = array(record(f.report.historicalM7k).identityList).slice(1); }, "historical-candidate-identity-claim-mismatch"],
  ["historical-candidate-identity-invented", (f) => { const ids = array(record(f.report.historicalM7k).identityList); ids[0] = "invented.spec.ts::not historical"; record(f.report.historicalM7k).identityList = ids; }, "historical-candidate-identity-claim-mismatch"],
  ["current-discovery-count-changed", (f) => { record(record(f.report.currentDiscovery).ordinaryChromium).discoveredTests = 273; }, "discovery-identity-count-mismatch:ordinaryChromium"],
  ["current-discovery-digest-changed", (f) => { record(record(f.report.currentDiscovery).rendererSerial).discoveryListSha256 = "0".repeat(64); }, "discovery-digest-mismatch:rendererSerial"],
  ["execution-source-role-unavailable", (f) => { sourceVerification(f).executionCommitAvailable = false; }, "execution-source-commit-unavailable"],
  ["execution-runner-tree-entry-missing", (f) => { sourceVerification(f).executionRunnerTreeEntriesVerified = false; }, "playwright-runner-tree-entries-unverified"],
  ["normalizer-source-sha-mismatch", (f) => { record(record(f.report.sourceProvenance).retainedNormalizer).sourceCommitSha = GROUND_GLASS_M7M_BASE_COMMIT_SHA; }, "source-provenance-role-mismatch"],
  ["normalizer-source-commit-unavailable", (f) => { sourceVerification(f).normalizerCommitAvailable = false; }, "retained-normalizer-source-commit-unavailable"],
  ["normalizer-source-content-mismatch", (f) => { sourceVerification(f).normalizerContentVerified = false; }, "retained-normalizer-source-content-mismatch"],
  ["evaluator-source-sha-mismatch", (f) => { record(record(f.report.sourceProvenance).retainedEvaluator).sourceCommitSha = GROUND_GLASS_M7M_BASE_COMMIT_SHA; }, "source-provenance-role-mismatch"],
  ["evaluator-source-commit-unavailable", (f) => { sourceVerification(f).evaluatorCommitAvailable = false; }, "retained-evaluator-source-commit-unavailable"],
  ["evaluator-source-content-mismatch", (f) => { sourceVerification(f).evaluatorContentVerified = false; }, "retained-evaluator-source-content-mismatch"],
  ["base-falsely-declared-as-normalizer-source", (f) => { record(record(f.report.sourceProvenance).retainedNormalizer).sourceCommitSha = GROUND_GLASS_M7M_BASE_COMMIT_SHA; }, "source-provenance-role-mismatch"],
  ["capture-time-normalizer-provenance-overstated", (f) => { record(record(f.report.sourceProvenance).captureTimeTooling).normalizerSourceCommitSha = GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA; }, "capture-time-tooling-provenance-overstated"],
  ["capture-time-evaluator-provenance-overstated", (f) => { record(record(f.report.sourceProvenance).captureTimeTooling).evaluatorSourceCommitSha = GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA; }, "capture-time-tooling-provenance-overstated"],
  ["retained-normalizer-confused-with-capture-time-source", (f) => { record(record(f.report.sourceProvenance).retainedNormalizer).captureTimeUse = "verified"; }, "retained-tooling-confused-with-capture-time-source"],
  ["ordinary-discovery-bytes-missing", (f) => { f.evidence = { ...f.evidence, discoveryLists: { ...f.evidence.discoveryLists, ordinaryChromium: null } }; }, "original-discovery-bytes-missing:ordinaryChromium"],
  ["serial-discovery-bytes-missing", (f) => { f.evidence = { ...f.evidence, discoveryLists: { ...f.evidence.discoveryLists, rendererSerial: null } }; }, "original-discovery-bytes-missing:rendererSerial"],
  ["ordinary-discovery-digest-mismatch", (f) => { record(record(f.report.currentDiscovery).ordinaryChromium).discoveryListSha256 = "0".repeat(64); }, "discovery-digest-mismatch:ordinaryChromium"],
  ["serial-discovery-digest-mismatch", (f) => { record(record(f.report.currentDiscovery).rendererSerial).discoveryListSha256 = "0".repeat(64); }, "discovery-digest-mismatch:rendererSerial"],
  ["discovery-project-name-changed", (f) => { record(record(f.report.currentDiscovery).ordinaryChromium).projectName = "firefox"; }, "discovery-project-name-mismatch:ordinaryChromium"],
  ["discovery-identity-count-changed", (f) => { record(record(f.report.currentDiscovery).ordinaryChromium).discoveredTests = 273; }, "discovery-identity-count-mismatch:ordinaryChromium"],
  ["discovery-spec-file-count-changed", (f) => { record(record(f.report.currentDiscovery).rendererSerial).specFiles = 3; }, "discovery-spec-file-count-mismatch:rendererSerial"],
  ["discovery-duplicate-identity", (f) => { const text = discoveryBytes(f, "ordinaryChromium").toString("utf8"); const rows = text.split("\n"); rows[2] = rows[1]; f.evidence = { ...f.evidence, discoveryLists: { ...f.evidence.discoveryLists, ordinaryChromium: Buffer.from(rows.join("\n")) } }; }, "discovery-duplicate-identity:ordinaryChromium"],
  ["selected-discovery-identity-missing", (f) => { const text = discoveryBytes(f, "ordinaryChromium").toString("utf8").replace("simulator viewports expand in main without replacing their active canvases", "invented scene viewport identity"); f.evidence = { ...f.evidence, discoveryLists: { ...f.evidence.discoveryLists, ordinaryChromium: Buffer.from(text) } }; }, "selected-discovery-identity-missing"],
  ["ordinary-and-serial-discovery-conflated", (f) => { record(record(f.report.currentDiscovery).rendererSerial).projectName = "chromium"; }, "ordinary-and-serial-discovery-conflated"],
  ["historical-discovery-claim-without-original-bytes", (f) => { f.evidence = { ...f.evidence, discoveryLists: { ordinaryChromium: null, rendererSerial: null } }; }, "historical-discovery-claim-without-original-bytes:ordinaryChromium"],
  ["fresh-discovery-mislabeled-historical", (f) => { record(f.report.currentDiscovery).freshDiscoveryRun = "executed-after-capture"; }, "fresh-discovery-mislabeled-historical"],
  ["sanitized-discovery-claimed-as-original", (f) => { record(f.report.currentDiscovery).discoverySanitization = "sanitized"; }, "sanitized-discovery-claimed-as-original"],
  ["duplicate-cohort-identity", (f) => { const ids = array(record(f.report.cohort).identities); ids[1] = ids[0]; record(f.report.cohort).identities = ids; }, "cohort-identity-set-mismatch"],
  ["missing-cohort-identity", (f) => { record(f.report.cohort).identities = array(record(f.report.cohort).identities).slice(1); }, "cohort-identity-set-mismatch"],
  ["invented-cohort-identity", (f) => { const ids = array(record(f.report.cohort).identities); ids[0] = "invented.spec.ts::not discovered"; record(f.report.cohort).identities = ids; }, "cohort-identity-set-mismatch"],
  ["normalized-artifact-digest-changed", (f) => { (f.evidence.experiments as Record<string, { sha256: string; value: unknown }>)["cohort-w4"].sha256 = "0".repeat(64); }, "normalized-artifact-digest-or-path-mismatch:cohort-w4"],
  ["normalized-raw-digest-changed", (f) => { record(normalized(f, "cohort-w4").rawCapture).sha256 = "0".repeat(64); }, "normalized-artifact-digest-or-path-mismatch:cohort-w4"],
  ["captured-failure-promoted-to-pass", (f) => { const row = normalized(f, "cohort-w4"); record(array(row.tests).map(record).find((test) => test.status === "unexpected")).status = "expected"; }, "normalized-artifact-digest-or-path-mismatch:cohort-w4"],
  ["captured-pass-promoted-to-failure", (f) => { record(array(normalized(f, "cohort-w1").tests).map(record)[0]).status = "unexpected"; }, "normalized-artifact-digest-or-path-mismatch:cohort-w1"],
  ["missing-result-counted-as-success", (f) => { record(array(normalized(f, "cohort-w1").tests).map(record)[0]).attempts = []; }, "normalized-artifact-digest-or-path-mismatch:cohort-w1"],
  ["wrong-project-identity", (f) => { record(array(normalized(f, "cohort-w4").tests).map(record)[0]).projectName = "chromium-renderer-serial"; }, "experiment-project-mismatch:cohort-w4"],
  ["configured-workers-mismatch", (f) => { experiment(f, "cohort-w4").configuredWorkers = 2; }, "experiment-config-mismatch:cohort-w4"],
  ["actual-concurrency-mismatch", (f) => { experiment(f, "cohort-w4").maxConcurrentTests = 3; }, "experiment-outcomes-or-concurrency-mismatch:cohort-w4"],
  ["retry-added-to-zero-retry-capture", (f) => { const test = record(array(normalized(f, "cohort-w1").tests).map(record)[0]); record(array(test.attempts).map(record)[0]).retry = 1; }, "normalized-artifact-digest-or-path-mismatch:cohort-w1"],
  ["partial-matrix-called-complete", (f) => { outcomeRow(f, GROUND_GLASS_M7M_REQUIRED_COHORT_IDENTITIES[0]).workers = { ...record(outcomeRow(f, GROUND_GLASS_M7M_REQUIRED_COHORT_IDENTITIES[0]).workers), "cohort-w4": "passed" }; }, "cohort-outcome-claim-mismatch:" + GROUND_GLASS_M7M_REQUIRED_COHORT_IDENTITIES[0] + ":cohort-w4"],
  ["viewport-geometry-misclassified-as-readiness", (f) => { outcomeRow(f, GROUND_GLASS_M7M_REQUIRED_COHORT_IDENTITIES[9]).classification = "environment-sensitive"; }, "cohort-classification-mismatch:" + GROUND_GLASS_M7M_REQUIRED_COHORT_IDENTITIES[9]],
  ["current-pass-promoted-to-verified-fixed", (f) => { outcomeRow(f, GROUND_GLASS_M7M_REQUIRED_COHORT_IDENTITIES[3]).verifiedFixed = true; }, "cohort-historical-signature-or-fix-classification-mismatch:" + GROUND_GLASS_M7M_REQUIRED_COHORT_IDENTITIES[3]],
  ["single-capture-promoted-to-verified-fix", (f) => { record(f.report.remediation).verifiedFixes = [GROUND_GLASS_M7M_REQUIRED_COHORT_IDENTITIES[0]]; record(f.report.remediation).verifiedFixCount = 1; }, "unsupported-remediation-claim"],
  ["raw-provenance-overstated", (f) => { record(f.report.rawCaptureProvenance).originalRawCaptureProvenance = "verified"; }, "raw-capture-provenance-overstated"],
  ["normalizer-revision-changed", (f) => { f.report.normalizationImplementationRevision = "m7m-playwright-normalizer-v0"; }, "normalizer-revision-mismatch"],
  ["full-broad-e2e-qualified-from-cohort", (f) => { record(f.report.qualification).fullBroadE2eStatus = "qualified"; }, "qualification-boundary-mismatch"],
  ["m7-overall-promoted", (f) => { record(f.report.qualification).m7Overall = "qualified"; }, "qualification-boundary-mismatch"],
  ["m8-entry-enabled", (f) => { record(f.report.qualification).m8Entry = "allowed"; }, "qualification-boundary-mismatch"],
  ["production-webgpu-enabled", (f) => { record(f.report.qualification).productionWebGpuEnabled = true; }, "qualification-boundary-mismatch"],
];

describe("Ground Glass M7M Scene readiness evidence integrity", () => {
  it("accepts the complete but worker-sensitive 12-identity evidence without claiming fixes", () => {
    const result = evaluate(loadFixture());
    expect(result).toMatchObject({
      passed: true,
      evidenceIntegrity: "passed",
      normalizedArtifactIntegrity: "passed",
      sourceProvenanceIntegrity: "verified",
      discoveryProvenance: "verified",
      executionCompleteness: "complete",
      cohortStatus: "worker-sensitive-unresolved",
      candidateIdentityCount: 12,
      verifiedFixCount: 0,
      fullBroadE2eQualification: "not-qualified",
      m7Overall: "partially-qualified",
      m8Entry: "denied",
      productionWebGpuEnabled: false,
    });
    expect(result.cohortWorkerOutcomes["cohort-w1"]).toMatchObject({ discovered: 12, passed: 11, failed: 1, retries: 0, maxConcurrentTests: 1 });
    expect(result.cohortWorkerOutcomes["cohort-w2"]).toMatchObject({ discovered: 12, passed: 9, failed: 3, retries: 0, maxConcurrentTests: 2 });
    expect(result.cohortWorkerOutcomes["cohort-w4"]).toMatchObject({ discovered: 12, passed: 4, failed: 8, retries: 0, maxConcurrentTests: 4 });
  });

  it.each(mutations)("rejects mutation: %s", (_name, mutate, issue) => {
    const fixture = loadFixture();
    mutate(fixture);
    rejectFor(fixture, issue);
  });

  it("requires a versioned mutation manifest matching the implemented cases", () => {
    const report = readJson(reportPath);
    const coverage = record(record(report.validation).mutationCoverage);
    expect(coverage.revision).toBe(GROUND_GLASS_M7M_MUTATION_SUITE_REVISION);
    expect(coverage.requiredCases).toEqual(GROUND_GLASS_M7M_REQUIRED_MUTATION_CASES);
    expect(coverage.testCount).toBe(GROUND_GLASS_M7M_REQUIRED_MUTATION_CASES.length);
    expect(mutations.map(([name]) => name)).toEqual(GROUND_GLASS_M7M_REQUIRED_MUTATION_CASES);
    expect(GROUND_GLASS_M7M_REQUIRED_EXPERIMENT_IDS).toHaveLength(13);
    expect(GROUND_GLASS_M7M_EVALUATOR_REVISION).toBe("m7m-scene-readiness-evaluator-v2");
  });

  it("returns failure when the pinned execution commit is unavailable", () => {
    const fixture = loadFixture();
    fixture.evidence = { ...fixture.evidence, sourceVerification: { ...fixture.evidence.sourceVerification, executionCommitAvailable: false } };
    rejectFor(fixture, "execution-source-commit-unavailable");
  });

  it("fails the production CLI with nonzero status for contradictory qualification", () => {
    const directory = mkdtempSync(join(process.cwd(), ".m7m-cli-negative-"));
    const mutatedPath = join(directory, "mutated-report.json");
    const relativePath = relative(process.cwd(), mutatedPath).replaceAll("\\", "/");
    try {
      const report = readJson(reportPath);
      record(report.qualification).fullBroadE2eStatus = "qualified";
      writeFileSync(mutatedPath, JSON.stringify(report, null, 2) + "\n");
      const result = spawnSync(process.execPath, [
        resolve(process.cwd(), "scripts/run-m7m-scene-readiness.mjs"),
        "--report-path=" + relativePath,
      ], { cwd: process.cwd(), encoding: "utf8" });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("qualification-boundary-mismatch");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails the production CLI when retained tooling provenance is replaced with the execution source", () => {
    const directory = mkdtempSync(join(process.cwd(), ".m7m-cli-source-negative-"));
    const report = readJson(reportPath);
    const mutatedPath = join(directory, "mutated-report.json");
    try {
      record(record(report.sourceProvenance).retainedNormalizer).sourceCommitSha = GROUND_GLASS_M7M_BASE_COMMIT_SHA;
      writeFileSync(mutatedPath, JSON.stringify(report, null, 2) + "\n");
      const result = spawnSync(process.execPath, [
        resolve(process.cwd(), "scripts/run-m7m-scene-readiness.mjs"),
        "--report-path=" + relative(process.cwd(), mutatedPath).replaceAll("\\", "/"),
      ], { cwd: process.cwd(), encoding: "utf8" });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("source-provenance-role-mismatch");
      expect(result.stdout).toContain("retained-normalizer-source-content-mismatch");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("retrieves retained M7M tooling and replays evidence from an isolated synthetic post-squash shallow checkout", () => {
    const directory = mkdtempSync(join(tmpdir(), "m7m-post-squash-"));
    const seed = join(directory, "squash-seed");
    const remote = join(directory, "retained-pr-remote.git");
    const exactClone = join(directory, "exact-fetch-clone");
    const fallbackClone = join(directory, "retained-ref-clone");
    const missingRemote = join(directory, "missing-retained-ref.git");
    const missingClone = join(directory, "missing-ref-clone");
    try {
      copyWorkingTreeSnapshot(seed);
      git(seed, ["init", "--quiet"]);
      git(seed, ["config", "user.name", "M7M isolated fixture"]);
      git(seed, ["config", "user.email", "m7m-fixture@example.invalid"]);
      git(seed, ["add", "-A"]);
      git(seed, ["commit", "--quiet", "-m", "synthetic squash snapshot"]);
      git(seed, ["branch", "-M", "main"]);

      git(directory, ["init", "--bare", "--quiet", remote]);
      const specFiles = new Set<string>();
      for (const lane of ["ordinaryChromium", "rendererSerial"] as const) {
        const discovery = readBytes(GROUND_GLASS_M7M_DISCOVERY_PATHS[lane]).toString("utf8");
        for (const line of discovery.split(/\r?\n/)) {
          const match = line.match(/^ {2}\[[^\]]+\] › ([^:\r\n]+):\d+:\d+ › /);
          if (match) specFiles.add("src/tests/e2e/" + match[1]);
        }
      }
      copyCommitObjects(process.cwd(), remote, [GROUND_GLASS_M7M_BASE_COMMIT_SHA, GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA], {
        [GROUND_GLASS_M7M_BASE_COMMIT_SHA]: ["playwright.config.ts", "scripts/e2e-spec-policy.mjs", ...specFiles],
        [GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA]: [
          "scripts/normalize-m7m-playwright-capture.mjs",
          ...["src/render/testing/groundGlassM7mSceneReadiness.ts", "scripts/evaluateM7mSceneReadiness.ts", "scripts/run-m7m-scene-readiness.mjs"],
        ],
      });
      writeFileSync(join(remote, "shallow"), GROUND_GLASS_M7M_BASE_COMMIT_SHA + "\n");
      git(remote, ["update-ref", "refs/pull/311/head", GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA]);
      git(seed, ["remote", "add", "origin", remote]);
      git(seed, ["push", "--quiet", "origin", "HEAD:refs/heads/main"]);

      shallowClone(remote, exactClone);
      expect(git(exactClone, ["rev-parse", "--is-shallow-repository"]).stdout.trim()).toBe("true");
      expect(git(exactClone, ["cat-file", "-e", GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA + "^{commit}"], true).status).not.toBe(0);
      expect(git(exactClone, ["cat-file", "-e", GROUND_GLASS_M7M_BASE_COMMIT_SHA + "^{commit}"], true).status).not.toBe(0);
      expect(git(exactClone, ["cat-file", "-e", GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA + ":scripts/normalize-m7m-playwright-capture.mjs"], true).status).not.toBe(0);
      const exactFetch = spawnSync(process.execPath, [
        resolve(process.cwd(), "scripts/fetch-m7k-execution-source.mjs"),
        "--sha=" + GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA,
        "--retained-ref=refs/pull/311/head",
        "--verify-path=scripts/normalize-m7m-playwright-capture.mjs",
      ], { cwd: exactClone, encoding: "utf8" });
      expect(exactFetch.status, exactFetch.stdout + exactFetch.stderr).toBe(0);
      expect(git(exactClone, ["cat-file", "-e", GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA + "^{commit}"]).status).toBe(0);

      shallowClone(remote, fallbackClone);
      expect(git(fallbackClone, ["cat-file", "-e", GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA + "^{commit}"], true).status).not.toBe(0);
      expect(git(fallbackClone, ["cat-file", "-e", GROUND_GLASS_M7M_BASE_COMMIT_SHA + "^{commit}"], true).status).not.toBe(0);
      expect(existsSync(join(fallbackClone, ".git/objects/info/alternates"))).toBe(false);
      symlinkSync(join(process.cwd(), "node_modules"), join(fallbackClone, "node_modules"), "dir");
      const beforeFetch = runM7mCli(fallbackClone);
      expect(beforeFetch.status).toBe(1);
      expect(beforeFetch.stdout).toContain("retained-normalizer-source-commit-unavailable");
      expect(beforeFetch.stdout).toContain("M7M evidence integrity: FAILED");

      const retainedFetch = spawnSync(process.execPath, [
        resolve(process.cwd(), "scripts/fetch-m7k-execution-source.mjs"),
        "--sha=" + GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA,
        "--retained-ref=refs/pull/311/head",
        "--force-retained-ref",
        "--verify-path=scripts/normalize-m7m-playwright-capture.mjs",
        "--verify-path=src/render/testing/groundGlassM7mSceneReadiness.ts",
        "--verify-path=scripts/evaluateM7mSceneReadiness.ts",
        "--verify-path=scripts/run-m7m-scene-readiness.mjs",
      ], { cwd: fallbackClone, encoding: "utf8" });
      expect(retainedFetch.status).toBe(0);
      expect(retainedFetch.stdout).toContain("retained-ref-history-fallback");
      expect(git(fallbackClone, ["cat-file", "-e", GROUND_GLASS_M7M_BASE_COMMIT_SHA + "^{commit}"]).status).toBe(0);
      expect(git(fallbackClone, ["cat-file", "-e", GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA + ":scripts/normalize-m7m-playwright-capture.mjs"]).status).toBe(0);
      expect(git(fallbackClone, ["cat-file", "-e", GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA + ":src/render/testing/groundGlassM7mSceneReadiness.ts"]).status).toBe(0);
      const afterFetch = runM7mCli(fallbackClone);
      expect(afterFetch.status).toBe(0);
      expect(afterFetch.stdout).toContain("M7M evidence integrity: PASSED");
      expect(afterFetch.stdout).toContain("M7M original discovery evidence: VERIFIED");

      const invalidReportPath = ".m7m-invalid-tooling-source.json";
      const invalidReport = readJson(join(fallbackClone, reportPath));
      record(record(invalidReport.sourceProvenance).retainedNormalizer).sourceCommitSha = GROUND_GLASS_M7M_BASE_COMMIT_SHA;
      writeFileSync(join(fallbackClone, invalidReportPath), JSON.stringify(invalidReport, null, 2) + "\n");
      const wrongSource = runM7mCli(fallbackClone, invalidReportPath);
      expect(wrongSource.status).toBe(1);
      expect(wrongSource.stdout).toContain("source-provenance-role-mismatch");

      git(directory, ["init", "--bare", "--quiet", missingRemote]);
      git(seed, ["remote", "add", "missing-origin", missingRemote]);
      git(seed, ["push", "--quiet", "missing-origin", "HEAD:refs/heads/main"]);
      shallowClone(missingRemote, missingClone);
      expect(git(missingClone, ["cat-file", "-e", GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA + "^{commit}"], true).status).not.toBe(0);
      const failedFetch = spawnSync(process.execPath, [
        resolve(process.cwd(), "scripts/fetch-m7k-execution-source.mjs"),
        "--sha=" + GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA,
        "--retained-ref=refs/pull/311/head",
        "--force-retained-ref",
      ], { cwd: missingClone, encoding: "utf8" });
      expect(failedFetch.status).not.toBe(0);
      expect(git(missingClone, ["cat-file", "-e", GROUND_GLASS_M7M_RETAINED_TOOLING_SOURCE_SHA + "^{commit}"], true).status).not.toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 120_000);

  it("preserves an existing normalized artifact instead of overwriting it", () => {
    const directory = mkdtempSync(join(process.cwd(), ".m7m-normalizer-negative-"));
    const rawPath = join(directory, "raw.json");
    const outputPath = join(directory, "existing-normalized.json");
    const originalOutput = "accepted evidence sentinel\n";
    const startTime = "2026-11-05T00:00:00.000Z";
    writeFileSync(rawPath, JSON.stringify({
      stats: { startTime, duration: 0 },
      config: { workers: 1, projects: [{ name: "chromium" }] },
      suites: [{ specs: [{
        file: "src/tests/e2e/sample.spec.ts",
        title: "sample",
        tests: [{ projectName: "chromium", status: "expected", results: [{ status: "passed", retry: 0, workerIndex: 0, startTime, duration: 0 }] }],
      }] }],
    }));
    writeFileSync(outputPath, originalOutput);
    try {
      const result = spawnSync(process.execPath, [
        resolve(process.cwd(), "scripts/normalize-m7m-playwright-capture.mjs"),
        "--input=" + rawPath,
        "--output=" + outputPath,
        "--id=overwrite-control",
        "--source-sha=" + "0c32f113c1e3d16a8fd42e7748c64909366c6ae8",
        "--configured-retries=0",
      ], { cwd: process.cwd(), encoding: "utf8" });
      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
      expect(readFileSync(outputPath, "utf8")).toBe(originalOutput);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
