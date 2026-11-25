import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFreshReplayDirectory, M7G_REPLAY_PROCESS_TIMEOUT_MS, runFreshReplay, type M7gReplayKind } from "../../../scripts/m7gReplayOrchestration.mjs";

const roots: string[] = [];
const sourceSha = "1".repeat(40);
const replayCodeSha = "2".repeat(40);
const baseCounts = { passed: 12, failed: 0, blocked: 0, "not-run": 0 };

const reportFor = (kind: M7gReplayKind, overrides: Record<string, unknown> = {}): Record<string, unknown> => {
  if (kind === "m7e") {
    return {
      reportId: "ground-glass-m7e-r187-offline-replay",
      evaluatorRevision: "m7e-r187-gather-b1-evaluator-v2",
      replayStatus: "passed",
      captureSourceCommitSha: sourceSha,
      replayCodeCommitSha: replayCodeSha,
      scenarioCounts: baseCounts,
      issues: [],
      runtimeIdentity: { rendererRevision: "r187", actualExecutionApi: "webgpu" },
      authorization: { productionWebGpuEnabled: false },
      ...overrides,
    };
  }
  const counts = { passed: 17, failed: 0, blocked: 0, "not-run": 0 };
  return {
    reportId: "ground-glass-m7f-r187-presentation",
    evaluatorRevision: "m7f-r187-presentation-evaluator-v2",
    qualificationStatus: "passed",
    qualificationPass: true,
    nativeCaptureSourceSha: sourceSha,
    replayCodeCommitSha: replayCodeSha,
    scenarioCounts: { inventoryConsistent: true, declared: counts, computed: counts },
    sourceCommitVerification: { verified: true },
    evidenceReadIssues: [],
    runtimeIdentity: { rendererRevision: "r187", actualExecutionApi: "webgpu" },
    authorization: { m8Authorized: false, productionWebGpuEnabled: false },
    ...overrides,
  };
};

const makeRepo = (): string => {
  const repoRoot = mkdtempSync(join(tmpdir(), "m7g-replay-process-test-"));
  roots.push(repoRoot);
  return repoRoot;
};

const makeChild = (repoRoot: string, report: Record<string, unknown> | null, options: {
  exitCode?: number;
  signal?: boolean;
  malformed?: boolean;
  hang?: boolean;
} = {}): string => {
  const script = resolve(repoRoot, "fake-predecessor-replay.mjs");
  const write = report === null && !options.malformed ? "" :
    `writeFileSync(output, ${JSON.stringify(options.malformed ? "{ malformed" : JSON.stringify(report))});`;
  const ending = options.signal ? "process.kill(process.pid, 'SIGTERM');" :
    options.hang ? "setInterval(() => {}, 1000);" : `process.exit(${options.exitCode ?? 0});`;
  writeFileSync(script,
    `import { writeFileSync } from 'node:fs';\nconst outputArg = process.argv.find((arg) => arg.startsWith('--report-output='));\nconst output = outputArg?.slice('--report-output='.length);\n${write}\n${ending}\n`);
  return script;
};

const run = (repoRoot: string, kind: M7gReplayKind, report: Record<string, unknown> | null,
  options: { exitCode?: number; signal?: boolean; malformed?: boolean; hang?: boolean; timeoutMs?: number } = {}) => {
  const replayDirectory = createFreshReplayDirectory(repoRoot);
  const script = makeChild(repoRoot, report, options);
  const result = runFreshReplay({
    repoRoot,
    replayDirectory,
    kind,
    script: script.slice(repoRoot.length + 1),
    expectedSourceSha: sourceSha,
    expectedReplayCodeSha: replayCodeSha,
    timeoutMs: options.timeoutMs,
  });
  return { ...result, replayDirectory };
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("M7G predecessor replay process orchestration", () => {
  it.each(["m7e", "m7f"] as const)("accepts a fresh, valid %s child report", (kind) => {
    const result = run(makeRepo(), kind, reportFor(kind));
    expect(result.execution.valid).toBe(true);
    expect(result.execution.spawned).toBe(true);
    expect(result.execution.exitCode).toBe(0);
    expect(result.execution.outputWasAbsentBeforeSpawn).toBe(true);
    expect(result.execution.reportValidated).toBe(true);
    expect(result.execution.expectedSourceSha).toBe(sourceSha);
    expect(result.execution.expectedReplayCodeSha).toBe(replayCodeSha);
    expect(result.execution.timeoutMs).toBe(M7G_REPLAY_PROCESS_TIMEOUT_MS);
    expect(result.execution.outputPath).toMatch(/\.m7g-predecessor-replay-.*-current\.json$/);
  });

  it("does not let a valid report emitted by a nonzero process mask process failure", () => {
    const result = run(makeRepo(), "m7e", reportFor("m7e"), { exitCode: 7 });
    expect(result.execution.reportValidated).toBe(true);
    expect(result.execution.exitCode).toBe(7);
    expect(result.execution.valid).toBe(false);
  });

  it("does not let a child terminated by signal count as a completed replay", () => {
    const result = run(makeRepo(), "m7f", reportFor("m7f"), { signal: true });
    expect(result.execution.signal).toBe("SIGTERM");
    expect(result.execution.valid).toBe(false);
  });

  it("rejects a child that exceeds its bounded replay timeout", () => {
    const result = run(makeRepo(), "m7e", null, { hang: true, timeoutMs: 25 });
    expect(result.execution.spawnError).toContain("ETIMEDOUT");
    expect(result.execution.signal).not.toBeNull();
    expect(result.execution.valid).toBe(false);
  });

  it("rejects a successful child that writes no fresh report", () => {
    const result = run(makeRepo(), "m7e", null);
    expect(result.execution.exitCode).toBe(0);
    expect(result.execution.reportPresent).toBe(false);
    expect(result.execution.valid).toBe(false);
  });

  it("rejects malformed output instead of reading any committed replay snapshot", () => {
    const result = run(makeRepo(), "m7f", null, { malformed: true });
    expect(result.execution.reportPresent).toBe(true);
    expect(result.execution.reportParsed).toBe(false);
    expect(result.execution.reportValidated).toBe(false);
    expect(result.execution.valid).toBe(false);
  });

  it.each([
    ["wrong identity", { reportId: "wrong-report" }],
    ["wrong evaluator revision", { evaluatorRevision: "old-evaluator" }],
    ["wrong source SHA", { captureSourceCommitSha: "f".repeat(40) }],
    ["wrong replay-code source SHA", { replayCodeCommitSha: "e".repeat(40) }],
    ["wrong scenario count", { scenarioCounts: { passed: 11, failed: 0, blocked: 1, "not-run": 0 } }],
  ])("rejects M7E replay with %s", (_name, mutation) => {
    const result = run(makeRepo(), "m7e", reportFor("m7e", mutation));
    expect(result.execution.spawned).toBe(true);
    expect(result.execution.exitCode).toBe(0);
    expect(result.execution.reportValidated).toBe(false);
    expect(result.execution.valid).toBe(false);
  });

  it("rejects M7F evidence that weakens its computed inventory", () => {
    const result = run(makeRepo(), "m7f", reportFor("m7f", {
      scenarioCounts: { inventoryConsistent: true, declared: { passed: 17, failed: 0, blocked: 0, "not-run": 0 },
        computed: { passed: 16, failed: 1, blocked: 0, "not-run": 0 } },
    }));
    expect(result.execution.reportValidated).toBe(false);
    expect(result.execution.valid).toBe(false);
  });

  it("fails closed when a fresh output path already exists before the child starts", () => {
    const repoRoot = makeRepo();
    const replayDirectory = createFreshReplayDirectory(repoRoot);
    const outputPath = join(replayDirectory, "m7e-current.json");
    mkdirSync(replayDirectory, { recursive: true });
    writeFileSync(outputPath, JSON.stringify(reportFor("m7e")));
    const script = makeChild(repoRoot, reportFor("m7e"));
    const result = runFreshReplay({
      repoRoot,
      replayDirectory,
      kind: "m7e",
      script: script.slice(repoRoot.length + 1),
      expectedSourceSha: sourceSha,
      expectedReplayCodeSha: replayCodeSha,
    });
    expect(result.execution.outputWasAbsentBeforeSpawn).toBe(false);
    expect(result.execution.spawned).toBe(false);
    expect(result.execution.reportValidated).toBe(true);
    expect(result.execution.valid).toBe(false);
  });

  it("records a failed spawn as invalid even when no report is present", () => {
    const repoRoot = makeRepo();
    const result = runFreshReplay({
      repoRoot,
      replayDirectory: createFreshReplayDirectory(repoRoot),
      kind: "m7e",
      script: "scripts/any-script.mjs",
      expectedSourceSha: sourceSha,
      expectedReplayCodeSha: replayCodeSha,
      nodeExecutable: join(repoRoot, "missing-node-runtime"),
    });
    expect(result.execution.spawned).toBe(false);
    expect(result.execution.spawnError).not.toBeNull();
    expect(result.execution.valid).toBe(false);
  });
});
