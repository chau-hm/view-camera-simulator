import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const compareScript = resolve(repositoryRoot, "scripts/run-m7h-triage.mjs");
const discoveryPath = resolve(
  repositoryRoot,
  "docs/architecture/ground-glass-m7h-broad-e2e/validation/current-chromium-discovery.json",
);
const discovery = JSON.parse(readFileSync(discoveryPath, "utf8")) as {
  tests: Array<{
    testId: string;
    specFile: string;
    describePath: string[];
    testTitle: string;
    projectName: string;
  }>;
};

type TestOverride = Readonly<{
  testId: string;
  expectedStatus?: string;
  attemptStatuses?: readonly string[];
  projectName?: string;
  omitResults?: boolean;
  testTitle?: string;
}>;
type JsonRecord = Record<string, unknown>;
type SyntheticReport = {
  config: { projects: JsonRecord[]; workers: number };
  suites: JsonRecord[];
  stats: JsonRecord;
};
type CompareOutput = {
  [key: string]: unknown;
  qualificationDecision: string;
  issues: string[];
  derivedCounts: { discovered: number; expected: number; unexpected: number; skipped: number; flaky: number; incomplete: number };
  reportedCounts: { expected: number | null; unexpected: number | null; skipped: number | null; flaky: number | null };
  unexpectedTests: Array<{ testId: string; expectedStatus: string; actualStatus: string; errorCategory: string }>;
  flakyTests: Array<{ testId: string; expectedStatus: string; actualStatus: string; attemptStatuses: string[] }>;
  skippedTests: Array<{ testId: string; expectedStatus: string; actualStatus: string }>;
  incompleteTests: Array<{ testId: string | null; issue: string }>;
  addedSinceInventory: string[];
  missingFromRun: string[];
};

const testNode = (test: typeof discovery.tests[number], override?: TestOverride) => {
  const expectedStatus = override?.expectedStatus ?? "passed";
  const statuses = override?.attemptStatuses ?? ["passed"];
  return {
    expectedStatus,
    projectId: test.projectName,
    projectName: override?.projectName ?? test.projectName,
    ...(override?.omitResults ? {} : {
      results: statuses.map((status) => ({
        status,
        duration: 1,
        attachments: [],
        ...(status === "failed" || status === "timedOut" || status === "interrupted"
          ? { error: { message: "Synthetic test result" } }
          : {}),
      })),
    }),
  };
};

const suiteFor = (test: typeof discovery.tests[number], override?: TestOverride) => {
  const spec = {
    title: override?.testTitle ?? test.testTitle,
    file: test.specFile,
    tests: [testNode(test, override)],
  };
  let nested: JsonRecord = { specs: [spec] };
  for (const title of [...test.describePath].reverse()) {
    nested = { title, file: test.specFile, suites: [nested] };
  }
  return {
    title: test.specFile,
    file: test.specFile,
    ...nested,
  };
};

const completeReport = (override?: TestOverride, statsOverride?: JsonRecord): SyntheticReport => ({
  config: { projects: [{ id: "chromium" }], workers: 1 },
  suites: discovery.tests.map((test) => suiteFor(test, test.testId === override?.testId ? override : undefined)),
  // These describe the all-pass report unless a test explicitly overrides them.
  stats: statsOverride ?? { expected: discovery.tests.length, unexpected: 0, skipped: 0, flaky: 0 },
});

const compare = (report: unknown) => {
  const scratch = mkdtempSync(join(tmpdir(), "m7h-compare-cli-"));
  try {
    const reportPath = join(scratch, "playwright.json");
    const bytes = `${JSON.stringify(report)}\n`;
    writeFileSync(reportPath, bytes);
    const result = spawnSync(process.execPath, [
      compareScript,
      `--compare-report=${reportPath}`,
      "--source-commit-sha=d560fd1f16dd98439f840bac3c8237d30fe304a9",
      "--browser-version=Chromium 149.0.7827.55",
      "--invocation=npm run test:e2e -- --project=chromium --workers=1",
    ], { cwd: repositoryRoot, encoding: "utf8", timeout: 120_000 });
    return { result, reportSha256: createHash("sha256").update(bytes).digest("hex") };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

const parsedOutput = (result: ReturnType<typeof compare>["result"]): CompareOutput => {
  expect(result.error).toBeUndefined();
  expect(result.stdout).not.toBe("");
  return JSON.parse(result.stdout) as CompareOutput;
};

const expectRejected = (report: unknown, expectedIssue?: string) => {
  const { result } = compare(report);
  expect(result.status).not.toBe(0);
  const output = parsedOutput(result);
  expect(output.qualificationDecision).not.toBe("passed");
  if (expectedIssue) expect(output.issues).toContain(expectedIssue);
  return output;
};

const target = discovery.tests[0];
if (!target) throw new Error("Current discovery fixture is empty");

describe("M7H raw Playwright comparison CLI", () => {
  it("accepts a complete, consistent all-pass report", () => {
    const { result } = compare(completeReport());
    expect(result.status).toBe(0);
    const output = parsedOutput(result);
    expect(output).toMatchObject({
      discoveredTests: discovery.tests.length,
      testsWithUsableResults: discovery.tests.length,
      statsConsistent: true,
      inventoryConsistent: true,
      actualPassingTests: discovery.tests.length,
      qualificationDecision: "passed",
      issues: [],
    });
  });

  it("rejects a raw unexpected failure hidden by stats.unexpected = 0", () => {
    const output = expectRejected(completeReport(
      { testId: target.testId, attemptStatuses: ["failed"] },
      { expected: discovery.tests.length, unexpected: 0, skipped: 0, flaky: 0 },
    ), "aggregate-playwright-stats-disagree-with-raw-tree");
    expect(output.derivedCounts.unexpected).toBe(1);
    expect(output.unexpectedTests[0].testId).toBe(target.testId);
  });

  it("rejects all-pass raw results when stats.unexpected falsely reports one failure", () => {
    const output = expectRejected(completeReport(undefined, {
      expected: discovery.tests.length - 1, unexpected: 1, skipped: 0, flaky: 0,
    }), "aggregate-playwright-stats-disagree-with-raw-tree");
    expect(output.derivedCounts.expected).toBe(discovery.tests.length);
  });

  it("rejects a skipped required test even when the aggregate omits it", () => {
    const output = expectRejected(completeReport(
      { testId: target.testId, expectedStatus: "skipped", attemptStatuses: ["skipped"] },
    ), "required-tests-skipped");
    expect(output.derivedCounts.skipped).toBe(1);
    expect(output.skippedTests).toHaveLength(1);
  });

  it("rejects a stats-consistent skipped report under the no-exemption policy", () => {
    const output = expectRejected(completeReport(
      { testId: target.testId, expectedStatus: "skipped", attemptStatuses: ["skipped"] },
      { expected: discovery.tests.length - 1, unexpected: 0, skipped: 1, flaky: 0 },
    ), "required-tests-skipped");
    expect(output.statsConsistent).toBe(true);
    expect(output.derivedCounts.skipped).toBe(1);
  });

  it("uses Playwright's skipped aggregate for an interrupted-only run but retains its raw status", () => {
    const output = expectRejected(completeReport(
      { testId: target.testId, attemptStatuses: ["interrupted"] },
      { expected: discovery.tests.length - 1, unexpected: 0, skipped: 1, flaky: 0 },
    ), "required-tests-skipped");
    expect(output.statsConsistent).toBe(true);
    expect(output.skippedTests[0].actualStatus).toBe("interrupted");
  });

  it("rejects a retry-dependent pass and reports it as flaky", () => {
    const output = expectRejected(completeReport(
      { testId: target.testId, attemptStatuses: ["failed", "passed"] },
    ), "flaky-test-outcomes-present");
    expect(output.derivedCounts.flaky).toBe(1);
    expect(output.flakyTests[0].attemptStatuses).toEqual(["failed", "passed"]);
  });

  it("does not classify repeated equivalent expected results as flaky", () => {
    const { result } = compare(completeReport({ testId: target.testId, attemptStatuses: ["passed", "passed"] }));
    expect(result.status).not.toBe(0);
    const output = parsedOutput(result);
    expect(output.derivedCounts.flaky).toBe(0);
    expect(output.flakyTests).toHaveLength(0);
    expect(output.actualPassingTests).toBe(discovery.tests.length - 1);
  });

  it("rejects a missing per-test result with apparently successful aggregate stats", () => {
    const output = expectRejected(completeReport({ testId: target.testId, omitResults: true }), "incomplete-test-results-present");
    expect(output.derivedCounts.incomplete).toBe(1);
    expect(output.incompleteTests[0].testId).toBe(target.testId);
    expect(output.testsWithUsableResults).toBe(discovery.tests.length - 1);
  });

  it("rejects a missing stats object", () => {
    const report = { ...completeReport() } as Record<string, unknown>;
    delete report.stats;
    expectRejected(report, "aggregate-playwright-stats-missing-or-invalid");
  });

  it.each(["expected", "unexpected", "skipped", "flaky"] as const)("rejects a missing stats.%s field", (field) => {
    const report = completeReport();
    delete report.stats[field];
    expectRejected(report, "aggregate-playwright-stats-missing-or-invalid");
  });

  it.each([-1, 1.5])("rejects non-integer or negative stats values (%s)", (value) => {
    const report = completeReport();
    report.stats.unexpected = value;
    const output = expectRejected(report, "aggregate-playwright-stats-missing-or-invalid");
    expect(output.reportedCounts.unexpected).toBeNull();
  });

  it("rejects an invalid per-attempt status", () => {
    const output = expectRejected(completeReport({ testId: target.testId, attemptStatuses: ["unknown-status"] }), "incomplete-test-results-present");
    expect(output.incompleteTests[0].testId).toBe(target.testId);
  });

  it("rejects duplicate stable test identities independently of aggregate counts", () => {
    const report = completeReport();
    const firstSuite = report.suites[0];
    const firstSpec = (firstSuite.specs as JsonRecord[])[0];
    (firstSuite.specs as JsonRecord[]).push(structuredClone(firstSpec));
    report.stats = { expected: discovery.tests.length + 1, unexpected: 0, skipped: 0, flaky: 0 };
    const output = expectRejected(report, "duplicate-test-identities-present");
    expect(output.duplicateTestIds).toContain(target.testId);
  });

  it("rejects a report configured with multiple projects", () => {
    const report = completeReport();
    report.config.projects.push({ id: "chromium-native-webgpu" });
    expectRejected(report, "ordinary-chromium-project-required");
  });

  it("rejects a wrong per-test project identity", () => {
    const output = expectRejected(completeReport({ testId: target.testId, projectName: "chromium-native-webgpu" }), "non-chromium-test-identity-present");
    expect(output.addedSinceInventory.length).toBeGreaterThan(0);
  });

  it("rejects a new test identity absent from the declared discovery inventory", () => {
    const output = expectRejected(completeReport({ testId: target.testId, testTitle: "unlisted new test identity" }), "test-inventory-does-not-match-current-discovery");
    expect(output.addedSinceInventory).toHaveLength(1);
    expect(output.missingFromRun).toHaveLength(1);
  });

  it("rejects a required discovered identity missing from the run", () => {
    const report = completeReport();
    report.suites.pop();
    const output = expectRejected(report, "test-inventory-does-not-match-current-discovery");
    expect(output.missingFromRun).toHaveLength(1);
  });

  it("does not count an expected failure as an actual successful test", () => {
    const report = completeReport({ testId: target.testId, expectedStatus: "failed", attemptStatuses: ["failed"] });
    const { result } = compare(report);
    expect(result.status).not.toBe(0);
    const output = parsedOutput(result);
    expect(output.statsConsistent).toBe(true);
    expect(output.derivedCounts.expected).toBe(discovery.tests.length);
    expect(output.actualPassingTests).toBe(discovery.tests.length - 1);
    expect(output.qualificationDecision).toBe("not-qualified");
  });

  it("rejects an unexpectedly passing test declared to fail", () => {
    const output = expectRejected(completeReport({ testId: target.testId, expectedStatus: "failed", attemptStatuses: ["passed"] }), "unexpected-test-outcomes-present");
    expect(output.unexpectedTests[0]).toMatchObject({ expectedStatus: "failed", actualStatus: "passed" });
  });

  it("reports a consistently failing run and returns nonzero", () => {
    const output = expectRejected(completeReport(
      { testId: target.testId, attemptStatuses: ["failed"] },
      { expected: discovery.tests.length - 1, unexpected: 1, skipped: 0, flaky: 0 },
    ), "unexpected-test-outcomes-present");
    expect(output.statsConsistent).toBe(true);
    expect(output.unexpectedTests).toHaveLength(1);
  });

  it("computes a fresh digest for a mutated raw report and still rejects its evidence", () => {
    const report = completeReport(
      { testId: target.testId, attemptStatuses: ["failed"] },
      { expected: discovery.tests.length, unexpected: 0, skipped: 0, flaky: 0 },
    );
    const { result, reportSha256 } = compare(report);
    expect(result.status).not.toBe(0);
    const output = parsedOutput(result);
    expect(output.rawReportSha256).toBe(reportSha256);
    expect(createHash("sha256").update(`${JSON.stringify(report)}\n`).digest("hex")).toBe(reportSha256);
    expect(output.issues).toContain("aggregate-playwright-stats-disagree-with-raw-tree");
  });

  it("keeps raw expected failures visible without treating them as passes", () => {
    const report = completeReport({ testId: target.testId, expectedStatus: "failed", attemptStatuses: ["failed"] });
    const { result } = compare(report);
    const output = parsedOutput(result);
    expect(output.derivedCounts.expected).toBe(discovery.tests.length);
    expect(output.derivedCounts.unexpected).toBe(0);
    expect(output.actualPassingTests).toBe(discovery.tests.length - 1);
    expect(output.qualificationDecision).toBe("not-qualified");
    expect(output.issues).toContain("required-tests-not-actually-passing");
  });

  it("rejects incomplete result history instead of trusting a fresh artifact hash", () => {
    const report = completeReport({ testId: target.testId, attemptStatuses: [] });
    const { result, reportSha256 } = compare(report);
    expect(result.status).not.toBe(0);
    const output = parsedOutput(result);
    expect(output.rawReportSha256).toBe(reportSha256);
    expect(output.derivedCounts.incomplete).toBe(1);
    expect(output.qualificationDecision).toBe("not-qualified");
  });

  it("preserves the separate expected/unexpected classification in per-test evidence", () => {
    const { result } = compare(completeReport({ testId: target.testId, expectedStatus: "failed", attemptStatuses: ["failed"] }));
    const output = parsedOutput(result);
    expect(output.statsConsistent).toBe(true);
    expect(output.unexpectedTests).toHaveLength(0);
    expect(output.derivedCounts.expected).toBe(discovery.tests.length);
  });
});
