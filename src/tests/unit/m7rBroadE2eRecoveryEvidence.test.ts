import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deriveM7rWorkerEvidence, evaluateM7rBroadE2eRecovery, M7R_EVALUATOR_REVISION } from "../../../scripts/evaluateM7rBroadE2eRecovery";

type JsonRecord = Record<string, unknown>;
const reportPath = resolve(process.cwd(), "docs/architecture/GROUND_GLASS_M7R_BROAD_E2E_QUALIFICATION_RECOVERY_REPORT.json");
let acceptedReport: JsonRecord;
let temporaryReportPath: string | null = null;
let temporaryNormalizedPath: string | null = null;

const clone = <T>(value: T): T => structuredClone(value);
const record = (value: unknown): JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const workerInterval = (parallelIndex: number, startEpochMs: number, durationMs: number, workerIndex = parallelIndex) => ({
  identity: `test-${parallelIndex}`,
  status: "passed",
  workerIndex,
  parallelIndex,
  startEpochMs,
  durationMs,
});

const createRepositoryFixture = (mutatePackage: (manifest: JsonRecord) => void = () => undefined): string => {
  const repositoryRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), "m7r-package-contract-"));
  const gitDir = spawnSync("git", ["rev-parse", "--absolute-git-dir"], { cwd: repositoryRoot, encoding: "utf8" });
  if (gitDir.status !== 0) throw new Error(gitDir.stderr || "Could not locate the current worktree Git directory.");
  writeFileSync(join(fixtureRoot, ".git"), `gitdir: ${gitDir.stdout.trim()}\n`);
  for (const entry of readdirSync(repositoryRoot)) {
    if ([".git", "node_modules", ".worktrees", "package.json"].includes(entry)) continue;
    const source = join(repositoryRoot, entry);
    symlinkSync(source, join(fixtureRoot, entry), statSync(source).isDirectory() ? "dir" : "file");
  }
  const manifest = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as JsonRecord;
  mutatePackage(manifest);
  writeFileSync(join(fixtureRoot, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return fixtureRoot;
};

const withRepositoryFixture = (mutatePackage: (manifest: JsonRecord) => void, run: (fixtureRoot: string) => void): void => {
  const fixtureRoot = createRepositoryFixture(mutatePackage);
  try {
    run(fixtureRoot);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
};

const copyScriptsAndMutate = (fixtureRoot: string, mutate: (path: string) => void): void => {
  const scriptsPath = join(fixtureRoot, "scripts");
  rmSync(scriptsPath, { recursive: true, force: true });
  cpSync(join(process.cwd(), "scripts"), scriptsPath, { recursive: true, dereference: true });
  mutate(join(scriptsPath, "evaluateM7rBroadE2eRecovery.ts"));
};

describe("M7R broad E2E recovery evidence evaluator", () => {
  beforeAll(() => {
    acceptedReport = JSON.parse(readFileSync(reportPath, "utf8")) as JsonRecord;
  });

  afterAll(() => {
    if (temporaryReportPath) unlinkSync(temporaryReportPath);
    if (temporaryNormalizedPath) unlinkSync(temporaryNormalizedPath);
  });

  it("accepts the complete, raw-linked M7R capture without promoting qualification", () => {
    const result = evaluateM7rBroadE2eRecovery(acceptedReport);
    expect(result.passed, result.issues.join(", ")).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.executionCompleteness).toBe("complete");
    expect(result.broadE2eQualification).toBe("not-qualified");
    expect(result.evaluatorRevision).toBe(M7R_EVALUATOR_REVISION);
    const normalizedClaim = record(record(acceptedReport.artifacts).normalizedCapture);
    const normalized = JSON.parse(readFileSync(resolve(process.cwd(), String(normalizedClaim.path)), "utf8")) as JsonRecord;
    const ordinary = record(record(normalized.lanes).ordinary);
    expect(record(ordinary.normalizationCorrection)).toMatchObject({
      applied: true,
      correctionId: "m7r-playwright-json-repeated-file-suite-title-v1",
      originalRunnerMismatchReproduced: true,
      runnerMarkedInvalidForIdentityMismatch: true,
    });
    expect(record(ordinary.correctedLegacyIdentityReconciliation)).toMatchObject({
      discovered: 274,
      reported: 274,
      duplicates: [],
    });
    expect(record(ordinary.correctedLegacyIdentityReconciliation).missing).toHaveLength(30);
    expect(record(ordinary.correctedLegacyIdentityReconciliation).extra).toHaveLength(30);
  });

  it("allows an unrelated npm script while preserving the M7R qualification result", () => {
    withRepositoryFixture((manifest) => {
      const scripts = record(manifest.scripts);
      scripts["example:future-feature"] = "node ./scripts/example-future-feature.mjs";
      scripts["evidence:check:m7r"] = "node --enable-source-maps scripts/run-m7r-evidence.mjs";
    }, (fixtureRoot) => {
      const result = evaluateM7rBroadE2eRecovery(acceptedReport, fixtureRoot);
      expect(result.passed, result.issues.join(", ")).toBe(true);
      expect(result.broadE2eQualification).toBe("not-qualified");
    });
  });

  it("allows an unrelated dependency update without changing evidence validation", () => {
    withRepositoryFixture((manifest) => {
      const devDependencies = record(manifest.devDependencies);
      devDependencies["example-future-contract"] = "1.2.3";
    }, (fixtureRoot) => {
      const result = evaluateM7rBroadE2eRecovery(acceptedReport, fixtureRoot);
      expect(result.passed, result.issues.join(", ")).toBe(true);
      expect(result.broadE2eQualification).toBe("not-qualified");
    });
  });

  it("rejects removal of the required M7R evidence-check package script", () => {
    withRepositoryFixture((manifest) => {
      delete record(manifest.scripts)["evidence:check:m7r"];
    }, (fixtureRoot) => {
      const result = evaluateM7rBroadE2eRecovery(acceptedReport, fixtureRoot);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("m7r-required-package-script-missing:evidence:check:m7r");
    });
  });

  it("rejects redirecting the required M7R evidence-check script to another evaluator", () => {
    withRepositoryFixture((manifest) => {
      record(manifest.scripts)["evidence:check:m7r"] = "node ./scripts/run-m7q-evidence.mjs";
    }, (fixtureRoot) => {
      const result = evaluateM7rBroadE2eRecovery(acceptedReport, fixtureRoot);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("m7r-required-package-script-target-invalid:evidence:check:m7r");
    });
  });

  it("rejects a missing or redirected M7R normalization command", () => {
    withRepositoryFixture((manifest) => {
      delete record(manifest.scripts)["evidence:normalize:m7r"];
    }, (fixtureRoot) => {
      const result = evaluateM7rBroadE2eRecovery(acceptedReport, fixtureRoot);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("m7r-required-package-script-missing:evidence:normalize:m7r");
    });
    withRepositoryFixture((manifest) => {
      record(manifest.scripts)["evidence:normalize:m7r"] = "node ./scripts/normalizeM7qLightPeerTraceAb.mjs";
    }, (fixtureRoot) => {
      const result = evaluateM7rBroadE2eRecovery(acceptedReport, fixtureRoot);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("m7r-required-package-script-target-invalid:evidence:normalize:m7r");
    });
  });

  it("requires the pinned historical analysis source to remain available", () => {
    const mutated = clone(acceptedReport);
    record(record(mutated).provenance).analysisToolingSourceCommitSha = "f".repeat(40);
    const result = evaluateM7rBroadE2eRecovery(mutated);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7r-analysis-source-missing-or-mismatched:scripts/evaluateM7rBroadE2eRecovery.ts");
  });

  it("rejects changed current evaluator content against its pinned analysis commit", () => {
    const fixtureRoot = createRepositoryFixture(() => undefined);
    try {
      copyScriptsAndMutate(fixtureRoot, (path) => {
        writeFileSync(path, `${readFileSync(path, "utf8")}\n// unpinned evaluator mutation\n`);
      });
      const result = evaluateM7rBroadE2eRecovery(acceptedReport, fixtureRoot);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("m7r-analysis-source-missing-or-mismatched:scripts/evaluateM7rBroadE2eRecovery.ts");
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("requires the separately pinned historical package manifest tree entry", () => {
    const mutated = clone(acceptedReport);
    record(record(mutated).provenance).historicalPackageManifestSourceCommitSha = "f".repeat(40);
    const result = evaluateM7rBroadE2eRecovery(mutated);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7r-historical-package-manifest-commit-unavailable");
    expect(result.issues).toContain("m7r-historical-package-manifest-unavailable");
  });

  it("rejects a claim that the current Broad E2E suite is qualified", () => {
    const mutated = clone(acceptedReport);
    record(mutated.qualification).broadE2eQualification = "qualified";
    const result = evaluateM7rBroadE2eRecovery(mutated);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7r-qualification-boundaries-invalid");
  });

  it("rejects a changed current outcome summary even when raw digests remain valid", () => {
    const mutated = clone(acceptedReport);
    record(mutated.summary).unexpected = Number(record(mutated.summary).unexpected) + 1;
    const result = evaluateM7rBroadE2eRecovery(mutated);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7r-combined-outcome-summary-invalid");
  });

  it("rejects an unsupported application root-cause claim", () => {
    const mutated = clone(acceptedReport);
    const claims = record(mutated.claims);
    claims.establishedRootCauses = ["renderer resource leak"];
    const result = evaluateM7rBroadE2eRecovery(mutated);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7r-unsupported-causal-or-qualification-claim");
  });

  it("keeps per-identity causes unclassified and skip exclusions unapproved", () => {
    const inventory = record(acceptedReport).testInventory;
    expect(Array.isArray(inventory)).toBe(true);
    expect((inventory as unknown[])).toHaveLength(278);
    const skipped = (inventory as JsonRecord[]).filter((entry) => entry.currentActualStatus === "skipped");
    const unexpected = (inventory as JsonRecord[]).filter((entry) => entry.currentActualStatus !== entry.currentExpectedStatus);
    expect(skipped).toHaveLength(75);
    expect(skipped.every((entry) => record(entry.currentSkipAudit).exclusionApproval === "unapproved")).toBe(true);
    expect(unexpected.every((entry) => record(entry).rootCauseCategory === "insufficient-evidence"
      && record(entry).rootCauseConfidence === "unclassified")).toBe(true);
  });

  it("accepts equivalent skip reason groups independent of host collation order", () => {
    const normalizedClaim = record(record(acceptedReport.artifacts).normalizedCapture);
    const normalizedPath = resolve(process.cwd(), String(normalizedClaim.path));
    const normalized = JSON.parse(readFileSync(normalizedPath, "utf8")) as JsonRecord;
    const currentSkipAudit = record(normalized.currentSkipAudit);
    currentSkipAudit.reasonGroups = (currentSkipAudit.reasonGroups as JsonRecord[]).reverse();
    temporaryNormalizedPath = resolve(process.cwd(), `.m7r-reordered-normalized-${process.pid}.json`);
    writeFileSync(temporaryNormalizedPath, `${JSON.stringify(normalized, null, 2)}\n`, { flag: "wx" });
    const mutated = clone(acceptedReport);
    const normalizedArtifact = record(record(mutated.artifacts).normalizedCapture);
    normalizedArtifact.path = basename(temporaryNormalizedPath);
    normalizedArtifact.sha256 = sha256(readFileSync(temporaryNormalizedPath));
    const reportSkipAudit = record(mutated.skipAudit);
    reportSkipAudit.reasonGroups = (reportSkipAudit.reasonGroups as JsonRecord[]).reverse();
    const result = evaluateM7rBroadE2eRecovery(mutated);
    expect(result.passed, result.issues.join(", ")).toBe(true);
    expect(result.issues).toEqual([]);
    unlinkSync(temporaryNormalizedPath);
    temporaryNormalizedPath = null;
  });

  it("rejects changed skip reason counts regardless of list ordering", () => {
    const mutated = clone(acceptedReport);
    const reportSkipAudit = record(mutated.skipAudit);
    const groups = reportSkipAudit.reasonGroups as JsonRecord[];
    groups[0].count = Number(groups[0].count) + 1;
    const result = evaluateM7rBroadE2eRecovery(mutated);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7r-report-skip-audit-invalid");
  });

  it("reconciles all historical M7K outcomes without calling one-run passes fixes", () => {
    const dispositions = record(record(acceptedReport).historicalReconciliation).dispositions;
    expect(record(dispositions)).toMatchObject({
      "expected-in-both": 106,
      "historical-skip-still-skipped": 75,
      "historical-unexpected-now-expected": 12,
      "new-current-unexpected": 15,
      "unexpected-changed-signature": 24,
      "unexpected-same-signature": 46,
    });
    const inventory = record(acceptedReport).testInventory as JsonRecord[];
    expect(inventory.filter((entry) => entry.historicalDisposition === "historical-unexpected-now-expected")
      .every((entry) => entry.recommendedAction === "record-current-pass-once; do-not-label-fixed")).toBe(true);
    const transition = record(record(acceptedReport).historicalReconciliation).transitionMatrix as JsonRecord;
    expect(transition).toEqual({
      historicalPassed: { currentPassed: 106, currentUnexpected: 15, currentSkipped: 0, missingOrChanged: 0 },
      historicalUnexpected: { currentPassed: 12, currentUnexpected: 70, currentSkipped: 0, missingOrChanged: 0 },
      historicalSkipped: { currentPassed: 0, currentUnexpected: 0, currentSkipped: 75, missingOrChanged: 0 },
    });
  });

  it("classifies failure signatures from the assertion that actually failed", () => {
    const groups = record(acceptedReport.summary).ordinary as JsonRecord;
    const failures = groups.failureGroups as JsonRecord[];
    const counts = Object.fromEntries(failures.map((group) => [String(group.signature), group.count]));
    expect(counts).toMatchObject({
      "css-assertion": 13,
      "count-assertion": 7,
      "visibility-assertion": 8,
      "attribute-assertion": 7,
      "value-assertion": 1,
      "text-assertion": 3,
      "predicate-timeout": 2,
      "equality-assertion": 3,
      "checked-state-assertion": 1,
    });
  });

  it("rejects an analyst promotion of an unverified root cause", () => {
    const mutated = clone(acceptedReport);
    const inventory = record(mutated).testInventory as JsonRecord[];
    const unexpected = inventory.find((entry) => entry.currentActualStatus !== entry.currentExpectedStatus);
    if (!unexpected) throw new Error("Expected at least one currently unexpected identity.");
    unexpected.rootCauseCategory = "verified-application-regression";
    unexpected.rootCauseConfidence = "verified";
    const result = evaluateM7rBroadE2eRecovery(mutated);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("m7r-per-test-inventory-not-derived-from-raw");
  });

  it("derives non-empty four-worker overlap from raw start and duration intervals", () => {
    const evidence = deriveM7rWorkerEvidence([
      workerInterval(0, 100, 100),
      workerInterval(1, 110, 100),
      workerInterval(2, 120, 100),
      workerInterval(3, 130, 100),
    ]);
    expect(evidence.parallelWorkerIndexes).toEqual([0, 1, 2, 3]);
    expect(evidence.peakConcurrentWorkers).toBe(4);
    expect(evidence.longestOverlap.durationMs).toBeGreaterThan(0);
    expect(evidence.longestOverlap.activeWorkers).toEqual([0, 1, 2, 3]);
  });

  it("does not infer simultaneous workers from four sequential intervals", () => {
    const evidence = deriveM7rWorkerEvidence([
      workerInterval(0, 0, 10),
      workerInterval(1, 10, 10),
      workerInterval(2, 20, 10),
      workerInterval(3, 30, 10),
    ]);
    expect(evidence.parallelWorkerIndexes).toEqual([0, 1, 2, 3]);
    expect(evidence.peakConcurrentWorkers).toBe(1);
    expect(evidence.longestOverlap.durationMs).toBe(0);
  });

  it("rejects malformed execution intervals instead of counting them as active workers", () => {
    const evidence = deriveM7rWorkerEvidence([
      workerInterval(0, 0, -10),
      { ...workerInterval(1, 10, 10), startEpochMs: Number.NaN },
      { ...workerInterval(2, 20, 10), parallelIndex: -1 },
      { ...workerInterval(3, 30, 10), workerIndex: -1 },
    ]);
    expect(evidence.validExecutionIntervals).toBe(0);
    expect(evidence.invalidExecutionIntervals).toBe(4);
    expect(evidence.peakConcurrentWorkers).toBe(0);
  });

  it("rejects a normalized worker summary that contradicts raw Playwright intervals", () => {
    const normalizedClaim = record(record(acceptedReport.artifacts).normalizedCapture);
    const normalizedPath = resolve(process.cwd(), String(normalizedClaim.path));
    const normalized = JSON.parse(readFileSync(normalizedPath, "utf8")) as JsonRecord;
    const ordinarySummary = record(record(record(normalized.lanes).ordinary).summary);
    ordinarySummary.workerEvidence = {
      ...record(ordinarySummary.workerEvidence),
      peakConcurrentWorkers: 2,
    };
    const temporaryNormalized = resolve(process.cwd(), `.m7r-mutated-normalized-${process.pid}.json`);
    writeFileSync(temporaryNormalized, `${JSON.stringify(normalized, null, 2)}\n`, { flag: "wx" });
    try {
      const mutated = clone(acceptedReport);
      const artifact = record(record(mutated.artifacts).normalizedCapture);
      artifact.path = basename(temporaryNormalized);
      artifact.sha256 = sha256(readFileSync(temporaryNormalized));
      const result = evaluateM7rBroadE2eRecovery(mutated);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("m7r-ordinary-normalized-outcomes-mismatch");
    } finally {
      unlinkSync(temporaryNormalized);
    }
  });

  it("makes the production-facing CLI exit nonzero for contradictory qualification metadata", () => {
    const mutated = clone(acceptedReport);
    record(mutated.qualification).broadE2eQualification = "qualified";
    temporaryReportPath = resolve(process.cwd(), `.m7r-invalid-report-${process.pid}.json`);
    writeFileSync(temporaryReportPath, `${JSON.stringify(mutated, null, 2)}\n`, { flag: "wx" });
    const relativeReportPath = basename(temporaryReportPath);
    const result = spawnSync(process.execPath, ["scripts/run-m7r-evidence.mjs", `--report-path=${relativeReportPath}`], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("m7r-qualification-boundaries-invalid");
  });
});
