import { createHash } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_M7K_BASE_COMMIT_SHA,
  GROUND_GLASS_M7K_EVALUATOR_REVISION,
  GROUND_GLASS_M7K_HISTORICAL_ARTIFACT_PATHS,
  GROUND_GLASS_M7K_MUTATION_SUITE_REVISION,
  GROUND_GLASS_M7K_REQUIRED_MUTATION_CASES,
  GROUND_GLASS_M7K_REQUIRED_RENDERER_TESTS,
  buildGroundGlassM7kQualificationReport,
  evaluateGroundGlassM7kBroadE2eQualification,
  type GroundGlassM7kArtifact,
  type GroundGlassM7kCaptureManifest,
  type GroundGlassM7kLaneName,
} from "../../render/testing/groundGlassM7kBroadE2eQualification";

type JsonRecord = Record<string, unknown>;
type Fixture = {
  manifest: GroundGlassM7kCaptureManifest;
  artifacts: Record<string, GroundGlassM7kArtifact>;
  report: JsonRecord;
};

const manifestPath = "docs/architecture/ground-glass-m7k-broad-e2e/capture-manifest.json";
const readJson = (path: string): JsonRecord => JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as JsonRecord;
const sha256 = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const record = (value: unknown): JsonRecord => isRecord(value) ? value : {};
const text = (value: unknown): string => typeof value === "string" ? value : "";
const baseManifest = readJson(manifestPath) as unknown as GroundGlassM7kCaptureManifest;
const artifactPaths = [
  ...GROUND_GLASS_M7K_HISTORICAL_ARTIFACT_PATHS,
  baseManifest.discovery.ordinary.outputPath,
  baseManifest.discovery.rendererSerial.outputPath,
  ...Object.values(baseManifest.lanes).flatMap((lane) => lane ? [lane.rawReportPath, lane.consolePath] : []),
];
const baseArtifacts: Record<string, GroundGlassM7kArtifact> = {};
for (const path of artifactPaths) {
  const bytes = readFileSync(resolve(process.cwd(), path));
  let value: unknown;
  if (path.endsWith(".txt") || path.endsWith(".log")) value = bytes.toString("utf8");
  else value = JSON.parse(bytes.toString("utf8")) as unknown;
  baseArtifacts[path] = { sha256: sha256(bytes), value };
}
const baseReport = buildGroundGlassM7kQualificationReport(baseManifest, baseArtifacts);

const fixture = (): Fixture => ({
  manifest: clone(baseManifest),
  artifacts: { ...baseArtifacts },
  report: clone(baseReport),
});
const rebuild = (value: Fixture): void => {
  value.report = buildGroundGlassM7kQualificationReport(value.manifest, value.artifacts);
};
const evaluate = (
  value: Fixture,
  sourceAvailable = true,
  sourceFileAvailability = { tooling: true, evaluator: true },
) => evaluateGroundGlassM7kBroadE2eQualification(
  value.report,
  value.artifacts,
  sourceAvailable,
  sourceFileAvailability,
);
const schemaV2Fixture = (captureMode: "full" | "selected" = "full"): Fixture => {
  const value = fixture();
  const outputDirectory = "docs/architecture/ground-glass-m7k-broad-e2e/review-fix-r1-fixtures";
  const alias = (sourcePath: string, outputPath: string): void => {
    value.artifacts[outputPath] = value.artifacts[sourcePath];
  };
  const discovery = {
    ordinary: {
      ...value.manifest.discovery.ordinary,
      outputPath: `${outputDirectory}/discovery/ordinary.txt`,
    },
    rendererSerial: {
      ...value.manifest.discovery.rendererSerial,
      outputPath: `${outputDirectory}/discovery/renderer-serial.txt`,
    },
  };
  alias(value.manifest.discovery.ordinary.outputPath, discovery.ordinary.outputPath);
  alias(value.manifest.discovery.rendererSerial.outputPath, discovery.rendererSerial.outputPath);
  const lanes = Object.fromEntries(Object.entries(value.manifest.lanes).map(([name, lane]) => {
    if (!lane) return [name, lane];
    const rawReportPath = `${outputDirectory}/execution/${name}/playwright.json`;
    const consolePath = `${outputDirectory}/execution/${name}/console.log`;
    alias(lane.rawReportPath, rawReportPath);
    alias(lane.consolePath, consolePath);
    return [name, { ...lane, rawReportPath, consolePath }];
  })) as GroundGlassM7kCaptureManifest["lanes"];
  const oldEnvironment = value.manifest.environment;
  value.manifest = {
    ...value.manifest,
    schemaVersion: 2,
    toolingCommitSha: "1".repeat(40),
    evaluationCommitSha: "2".repeat(40),
    captureMode,
    selection: captureMode === "selected"
      ? { ordinaryGrep: "representative observer test", rendererSerialGrep: "@m7j-renderer-contention" }
      : null,
    outputDirectory,
    toolingSourcePath: "scripts/run-m7k-broad-e2e.mjs",
    evaluatorSourcePath: "src/render/testing/groundGlassM7kBroadE2eQualification.ts",
    environment: {
      ...oldEnvironment,
      toolingNodeVersion: "v24.3.0",
      browserProject: "chromium",
      viewport: { width: 1280, height: 720 },
      browserWebGlProbe: { webgl2Available: true, webglVersion: "WebGL 2.0 (OpenGL ES 3.0 Chromium)" },
      dependencyLock: { playwright: text(oldEnvironment.playwrightVersion), three: text(oldEnvironment.threeJsVersion) },
      testSeamEnabled: false,
    },
    discovery,
    lanes,
  };
  rebuild(value);
  return value;
};
const rejectFor = (value: Fixture, issue: string): void => {
  const result = evaluate(value);
  expect(result.passed).toBe(false);
  expect(result.issues.some((candidate) => candidate === issue || candidate.startsWith(`${issue}:`))).toBe(true);
};
const rejectV2For = (value: Fixture, issue: string, sourceFiles = { tooling: true, evaluator: true }): void => {
  const result = evaluate(value, true, sourceFiles);
  expect(result.passed).toBe(false);
  expect(result.issues).toContain(issue);
};
const laneRecord = (value: Fixture, lane: GroundGlassM7kLaneName): JsonRecord => {
  const execution = record(value.report.execution);
  const lanes = record(execution.lanes);
  return record(lanes[lane]);
};
const rawReport = (value: Fixture, lane: GroundGlassM7kLaneName): JsonRecord => {
  const path = text(laneRecord(value, lane).rawReportPath);
  return record(value.artifacts[path]?.value);
};
const walkRawTests = (raw: JsonRecord, visit: (test: JsonRecord, spec: JsonRecord, file: string) => void): void => {
  const walkSuite = (suiteValue: unknown): void => {
    if (!isRecord(suiteValue)) return;
    const suite = suiteValue;
    const suiteFile = text(suite.file);
    for (const specValue of Array.isArray(suite.specs) ? suite.specs : []) {
      if (!isRecord(specValue)) continue;
      const spec = specValue;
      const file = basename(text(spec.file) || suiteFile);
      for (const testValue of Array.isArray(spec.tests) ? spec.tests : []) {
        if (isRecord(testValue)) visit(testValue, spec, file);
      }
    }
    for (const child of Array.isArray(suite.suites) ? suite.suites : []) walkSuite(child);
  };
  for (const suite of Array.isArray(raw.suites) ? raw.suites : []) walkSuite(suite);
};
const mutateRaw = (
  value: Fixture,
  lane: GroundGlassM7kLaneName,
  mutate: (raw: JsonRecord) => void,
): void => {
  const capture = value.manifest.lanes[lane];
  if (!capture) throw new Error(`Missing lane ${lane}`);
  const raw = clone(rawReport(value, lane));
  mutate(raw);
  const bytes = Buffer.from(`${JSON.stringify(raw, null, 2)}\n`);
  const digest = sha256(bytes);
  value.artifacts[capture.rawReportPath] = { sha256: digest, value: raw };
  (value.manifest.lanes as Record<string, JsonRecord>)[lane] = {
    ...capture,
    rawReportSha256: digest,
  } as never;
};
const mutatePerTest = (value: Fixture, identity: string, changes: JsonRecord): void => {
  const execution = record(value.report.execution);
  const tests = Array.isArray(execution.perTest) ? execution.perTest : [];
  const target = tests.find((test) => isRecord(test) && test.testId === identity);
  if (!isRecord(target)) throw new Error(`Missing per-test identity ${identity}`);
  Object.assign(target, changes);
};
const mutateOneSkippedToPass = (value: Fixture): void => {
  const skips = Array.isArray(value.report.skipAudit) ? value.report.skipAudit : [];
  const identity = text(record(skips[0]).testId);
  mutatePerTest(value, identity, { actualPass: true, disposition: "passed" });
};
const rawTestFor = (raw: JsonRecord, predicate: (test: JsonRecord, spec: JsonRecord, file: string) => boolean): JsonRecord => {
  let found: JsonRecord | null = null;
  walkRawTests(raw, (test, spec, file) => { if (!found && predicate(test, spec, file)) found = test; });
  if (!found) throw new Error("No raw test matched the fixture predicate");
  return found;
};
const refreshRawStats = (raw: JsonRecord): void => {
  let expected = 0;
  let unexpected = 0;
  let skipped = 0;
  let flaky = 0;
  walkRawTests(raw, (test) => {
    const results = Array.isArray(test.results) ? test.results : [];
    const last = isRecord(results[results.length - 1]) ? results[results.length - 1] as JsonRecord : {};
    const status = text(last.status);
    if (status === "skipped") skipped += 1;
    else if (results.length > 1 && results.some((result) => isRecord(result) && result.status !== "passed")) flaky += 1;
    else if (status === "passed" && test.expectedStatus === "passed") expected += 1;
    else unexpected += 1;
  });
  raw.stats = { ...record(raw.stats), expected, unexpected, skipped, flaky };
};
const setActualWorkers = (value: Fixture, lane: GroundGlassM7kLaneName, workers: number): void => {
  mutateRaw(value, lane, (raw) => {
    const config = record(raw.config);
    config.metadata = { ...record(config.metadata), actualWorkers: workers };
    const projectName = lane === "ordinary" ? "chromium" : "chromium-renderer-serial";
    const projects = Array.isArray(config.projects) ? config.projects : [];
    const project = projects.find((entry) => isRecord(entry) && entry.name === projectName);
    if (isRecord(project)) project.metadata = { ...record(project.metadata), actualWorkers: workers };
  });
};
const allCurrentUnexpectedToPass = (
  value: Fixture,
  lane: GroundGlassM7kLaneName,
  preserveSkips = true,
): void => {
  mutateRaw(value, lane, (raw) => {
    walkRawTests(raw, (test) => {
      if (preserveSkips && text(test.expectedStatus) === "skipped") return;
      test.expectedStatus = "passed";
      test.results = [{ ...record(Array.isArray(test.results) ? test.results[0] : null), status: "passed", retry: 0 }];
      test.status = "expected";
    });
    refreshRawStats(raw);
  });
  const capture = value.manifest.lanes[lane];
  if (capture) (value.manifest.lanes as Record<string, JsonRecord>)[lane] = { ...capture, exitCode: 0 } as never;
};
const makeReportMutation = (mutate: (value: Fixture) => void) => (): void => {
  const value = fixture();
  mutate(value);
  rejectFor(value, "report-claim-does-not-match-derived-evidence");
};

const negativeCases: Array<{ name: string; run: () => void }> = [
  {
    name: "ordinary-lane-missing",
    run: () => {
      const value = fixture();
      record(record(value.report.execution).lanes).ordinary = null;
      const result = evaluate(value);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("complete-run-missing-lane:ordinary");
    },
  },
  {
    name: "renderer-serial-lane-missing",
    run: () => {
      const value = fixture();
      record(record(value.report.execution).lanes).rendererSerial = null;
      const result = evaluate(value);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain("complete-run-missing-lane:rendererSerial");
    },
  },
  {
    name: "renderer-serial-dependency-skipped",
    run: () => {
      const value = fixture();
      const lane = laneRecord(value, "rendererSerial");
      lane.invocationStatus = "not-started";
      rejectFor(value, "lane-invocation-not-executed:rendererSerial");
    },
  },
  {
    name: "same-test-counted-in-both-lanes",
    run: makeReportMutation((value) => {
      record(record(value.report.discovery).combined).projectOverlap = ["scene-view-focus.spec.ts::duplicate"];
    }),
  },
  {
    name: "ordinary-test-attributed-to-serial-project",
    run: () => {
      const value = fixture();
      const identities = record(record(value.report.discovery).combined).testIdentities;
      mutatePerTest(value, String(Array.isArray(identities) ? identities[0] : ""), {
        lane: "ordinary",
        projectName: "chromium-renderer-serial",
      });
      rejectFor(value, "report-claim-does-not-match-derived-evidence:execution");
    },
  },
  {
    name: "tagged-test-omitted",
    run: () => {
      const value = fixture();
      mutateRaw(value, "rendererSerial", (raw) => {
        const suite = record(Array.isArray(raw.suites) ? raw.suites[0] : null);
        const spec = (Array.isArray(suite.specs) ? suite.specs : []).find((entry) => isRecord(entry) &&
          text(entry.title) === GROUND_GLASS_M7K_REQUIRED_RENDERER_TESTS[0].split("::")[1]);
        if (isRecord(spec)) spec.tags = [];
      });
      rebuild(value);
      rejectFor(value, `renderer-serial-required-tag-missing:${GROUND_GLASS_M7K_REQUIRED_RENDERER_TESTS[0]}`);
    },
  },
  {
    name: "removed-test-counted-as-passed",
    run: makeReportMutation((value) => {
      const discovery = record(value.report.discovery);
      const combined = record(discovery.combined);
      combined.testIdentities = (Array.isArray(combined.testIdentities) ? combined.testIdentities : []).slice(1);
    }),
  },
  {
    name: "duplicate-identity-counted-twice",
    run: makeReportMutation((value) => {
      record(record(value.report.discovery).combined).duplicateIds = ["same-identity"];
    }),
  },
  {
    name: "partial-discovery-labeled-complete",
    run: makeReportMutation((value) => {
      const ordinary = record(record(value.report.discovery).ordinary);
      ordinary.discoveredTests = 273;
      record(value.report.qualification).executionCompleteness = "complete";
    }),
  },
  {
    name: "unexpected-failure-changed-to-expected",
    run: () => {
      const value = fixture();
      mutateRaw(value, "ordinary", (raw) => {
        const test = rawTestFor(raw, (candidate) => Array.isArray(candidate.results) &&
          candidate.results.some((result) => isRecord(result) && (result.status === "failed" || result.status === "timedOut")));
        test.expectedStatus = "failed";
      });
      rebuild(value);
      rejectFor(value, "expected-failure-reclassification-present:ordinary");
    },
  },
  {
    name: "expected-failure-counted-as-actual-pass",
    run: makeReportMutation((value) => {
      const execution = record(value.report.execution);
      const failed = (Array.isArray(execution.perTest) ? execution.perTest : []).find((test) =>
        isRecord(test) && test.actualStatus === "failed");
      if (isRecord(failed)) Object.assign(failed, { actualPass: true, resultStatus: "expected", disposition: "passed" });
    }),
  },
  {
    name: "skipped-test-counted-as-passed",
    run: makeReportMutation(mutateOneSkippedToPass),
  },
  {
    name: "interrupted-test-counted-as-passed",
    run: makeReportMutation((value) => {
      const execution = record(value.report.execution);
      const test = (Array.isArray(execution.perTest) ? execution.perTest : []).find((entry) =>
        isRecord(entry) && entry.actualPass === true);
      if (isRecord(test)) Object.assign(test, { actualPass: true, attemptStatuses: ["interrupted"], disposition: "passed" });
    }),
  },
  {
    name: "timed-out-test-counted-as-passed",
    run: makeReportMutation((value) => {
      const execution = record(value.report.execution);
      const test = (Array.isArray(execution.perTest) ? execution.perTest : []).find((entry) =>
        isRecord(entry) && entry.actualStatus === "timedOut");
      if (isRecord(test)) Object.assign(test, { actualPass: true, disposition: "passed" });
    }),
  },
  {
    name: "retry-dependent-pass-called-deterministic",
    run: () => {
      const value = fixture();
      mutateRaw(value, "ordinary", (raw) => {
        const test = rawTestFor(raw, (candidate) => text(candidate.expectedStatus) === "passed" &&
          Array.isArray(candidate.results) && candidate.results.length === 1 &&
          isRecord(candidate.results[0]) && candidate.results[0].status === "passed");
        const firstResult = Array.isArray(test.results) ? record(test.results[0]) : {};
        test.results = [
          { ...firstResult, status: "failed", retry: 0 },
          { ...firstResult, status: "passed", retry: 1 },
        ];
        test.status = "flaky";
        refreshRawStats(raw);
      });
      rebuild(value);
      rejectFor(value, "retry-dependent-outcome-present:ordinary");
    },
  },
  {
    name: "corrupted-raw-report-digest",
    run: () => {
      const value = fixture();
      laneRecord(value, "ordinary").rawReportSha256 = "0".repeat(64);
      rejectFor(value, "artifact-digest-mismatch:ordinary:raw");
    },
  },
  {
    name: "raw-summary-counts-disagree",
    run: () => {
      const value = fixture();
      laneRecord(value, "ordinary").statsReconciled = false;
      rejectFor(value, "playwright-summary-counts-disagree:ordinary");
    },
  },
  {
    name: "baseline-attributed-to-candidate",
    run: () => {
      const value = fixture();
      record(value.report.execution).sourceCommitSha = "17a2616b151aa50ad34b2d137eee0a43c5759ad3";
      rejectFor(value, "execution-source-attribution-mismatch");
    },
  },
  {
    name: "mismatched-browser-environment",
    run: () => {
      const value = fixture();
      record(value.report.environment).playwrightVersion = "0.0.0";
      rejectFor(value, "playwright-environment-mismatch:ordinary");
    },
  },
  {
    name: "browser-version-disagrees-with-runtime-capture",
    run: () => {
      const value = fixture();
      record(value.report.environment).browserVersion = "0.0.0";
      rejectFor(value, "browser-runtime-environment-mismatch");
    },
  },
  {
    name: "three-revision-disagrees-with-runtime-capture",
    run: () => {
      const value = fixture();
      record(value.report.environment).threeJsVersion = "0.186.0";
      rejectFor(value, "three-runtime-revision-mismatch");
    },
  },
  {
    name: "serial-one-worker-relabeled-as-four-worker-stability",
    run: () => {
      const value = fixture();
      const lane = laneRecord(value, "rendererSerial");
      lane.configuredWorkers = 4;
      lane.actualWorkers = 4;
      rejectFor(value, "renderer-serial-worker-count-mismatch");
    },
  },
  {
    name: "ordinary-four-workers-mislabeled-as-serial",
    run: () => {
      const value = fixture();
      const lane = laneRecord(value, "ordinary");
      lane.projectName = "chromium-renderer-serial";
      lane.configuredWorkers = 1;
      lane.actualWorkers = 1;
      rejectFor(value, "execution-project-mismatch:ordinary");
    },
  },
  {
    name: "missing-invocation-exit-code",
    run: () => {
      const value = fixture();
      laneRecord(value, "ordinary").exitCode = null;
      rejectFor(value, "invocation-exit-code-missing:ordinary");
    },
  },
  {
    name: "process-failure-hidden-by-orchestrator",
    run: () => {
      const value = fixture();
      laneRecord(value, "ordinary").exitCode = 0;
      laneRecord(value, "ordinary").processStatus = "passed";
      rejectFor(value, "process-failure-hidden-by-orchestrator:ordinary");
    },
  },
  {
    name: "dependency-skipped-project-marked-executed",
    run: () => {
      const value = fixture();
      laneRecord(value, "rendererSerial").invocationStatus = "not-started";
      rejectFor(value, "lane-invocation-not-executed:rendererSerial");
    },
  },
  {
    name: "native-webgpu-in-ordinary-qualification",
    run: () => {
      const value = fixture();
      record(value.report.environment).nativeWebGpuRequested = true;
      rejectFor(value, "execution-environment-out-of-qualification-scope");
    },
  },
  {
    name: "production-preview-in-wrong-inventory",
    run: () => {
      const value = fixture();
      const discoveryPath = value.manifest.discovery.ordinary.outputPath;
      const current = text(value.artifacts[discoveryPath].value);
      const extra = "  [chromium] › fake-production.spec.ts:1:1 › production preview must be isolated\n";
      const bytes = Buffer.from(`${current}${extra}`);
      const digest = sha256(bytes);
      value.artifacts[discoveryPath] = { sha256: digest, value: bytes.toString("utf8") };
      (value.manifest.discovery as unknown as JsonRecord).ordinary = {
        ...value.manifest.discovery.ordinary,
        outputSha256: digest,
      };
      (value.manifest.lanes as Record<string, JsonRecord>).ordinary = {
        ...value.manifest.lanes.ordinary,
        discoveredTestIdentities: [
          ...(value.manifest.lanes.ordinary!.discoveredTestIdentities ?? []),
          "fake-production.spec.ts::production preview must be isolated",
        ],
      };
      rebuild(value);
      rejectFor(value, "production-preview-test-in-ordinary-inventory");
    },
  },
  {
    name: "unreviewed-skip-exclusion-qualified",
    run: () => {
      const value = fixture();
      record(value.report.qualification).broadE2eQualification = "qualified";
      rejectFor(value, "broad-qualification-claim-unsupported-by-outcomes");
    },
  },
  {
    name: "complete-failing-suite-qualified",
    run: () => {
      const value = fixture();
      record(value.report.qualification).broadE2eQualification = "qualified";
      rejectFor(value, "broad-qualification-claim-unsupported-by-outcomes");
    },
  },
  {
    name: "274-tests-called-complete-278-suite",
    run: makeReportMutation((value) => {
      record(record(value.report.discovery).combined).discoveredTests = 274;
    }),
  },
  {
    name: "broad-qualification-authorizes-m8",
    run: () => {
      const value = fixture();
      record(value.report.authorization).m8Entry = "allowed";
      rejectFor(value, "m7-m8-or-production-authorization-boundary-invalid");
    },
  },
  {
    name: "broad-qualification-enables-production-webgpu",
    run: () => {
      const value = fixture();
      record(value.report.authorization).productionWebGpuEnabled = true;
      rejectFor(value, "m7-m8-or-production-authorization-boundary-invalid");
    },
  },
  {
    name: "squash-merge-sha-replaces-execution-source",
    run: () => {
      const value = fixture();
      value.report.executionSourceCommitSha = "17a2616b151aa50ad34b2d137eee0a43c5759ad3";
      rejectFor(value, "execution-source-sha-mismatch");
    },
  },
];

const v2NegativeCases: Array<{ name: string; run: () => void }> = [
  {
    name: "v2-missing-playwright-version",
    run: () => {
      const value = schemaV2Fixture();
      delete value.manifest.environment.playwrightVersion;
      rebuild(value);
      rejectV2For(value, "playwright-version-missing");
    },
  },
  {
    name: "v2-missing-browser-version",
    run: () => {
      const value = schemaV2Fixture();
      delete value.manifest.environment.browserVersion;
      rebuild(value);
      rejectV2For(value, "browser-version-missing");
    },
  },
  {
    name: "v2-missing-three-version",
    run: () => {
      const value = schemaV2Fixture();
      delete value.manifest.environment.threeJsVersion;
      rebuild(value);
      rejectV2For(value, "three-js-version-missing");
    },
  },
  {
    name: "v2-wrong-three-version",
    run: () => {
      const value = schemaV2Fixture();
      value.manifest.environment.threeJsVersion = "0.186.0";
      rebuild(value);
      rejectV2For(value, "three-js-version-out-of-scope");
    },
  },
  {
    name: "v2-evaluator-sha-missing",
    run: () => {
      const value = schemaV2Fixture();
      value.manifest = { ...value.manifest, evaluationCommitSha: "" };
      rebuild(value);
      rejectV2For(value, "evaluation-commit-sha-invalid");
    },
  },
  {
    name: "v2-tooling-sha-attributed-to-execution-source",
    run: () => {
      const value = schemaV2Fixture();
      value.manifest = { ...value.manifest, toolingCommitSha: GROUND_GLASS_M7K_BASE_COMMIT_SHA };
      rebuild(value);
      rejectV2For(value, "execution-source-replaced-by-tooling-or-squash-commit");
    },
  },
  {
    name: "v2-evaluator-sha-attributed-to-execution-source",
    run: () => {
      const value = schemaV2Fixture();
      value.manifest = { ...value.manifest, evaluationCommitSha: GROUND_GLASS_M7K_BASE_COMMIT_SHA };
      rebuild(value);
      rejectV2For(value, "execution-source-replaced-by-evaluator-or-squash-commit");
    },
  },
  {
    name: "v2-tooling-source-file-unavailable",
    run: () => rejectV2For(schemaV2Fixture(), "tooling-source-file-unavailable", { tooling: false, evaluator: true }),
  },
  {
    name: "v2-evaluator-source-file-unavailable",
    run: () => rejectV2For(schemaV2Fixture(), "evaluator-source-file-unavailable", { tooling: true, evaluator: false }),
  },
  {
    name: "v2-cli-wrapper-cannot-substitute-for-evaluator-implementation-source",
    run: () => {
      const value = schemaV2Fixture();
      value.manifest = { ...value.manifest, evaluatorSourcePath: "scripts/evaluateM7kBroadE2eQualification.ts" };
      rebuild(value);
      rejectV2For(value, "evaluator-source-path-invalid");
    },
  },
  {
    name: "v2-selected-capture-cannot-qualify",
    run: () => {
      const value = schemaV2Fixture("selected");
      record(value.report.qualification).broadE2eQualification = "qualified";
      rejectV2For(value, "broad-qualification-claim-unsupported-by-outcomes");
    },
  },
  {
    name: "v2-selected-ordinary-worker-count-out-of-range",
    run: () => {
      const value = schemaV2Fixture("selected");
      setActualWorkers(value, "ordinary", 5);
      rebuild(value);
      rejectV2For(value, "ordinary-worker-count-mismatch");
    },
  },
  {
    name: "v2-raw-artifact-path-escapes-output-directory",
    run: () => {
      const value = schemaV2Fixture();
      const lane = value.manifest.lanes.ordinary;
      if (!lane) throw new Error("Missing ordinary capture lane");
      value.manifest = {
        ...value.manifest,
        lanes: { ...value.manifest.lanes, ordinary: { ...lane, rawReportPath: "../outside.json" } },
      };
      rebuild(value);
      rejectV2For(value, "raw-artifact-path-outside-output-directory");
    },
  },
];

describe("M7K broad E2E qualification evidence evaluator", () => {
  it("pins the evaluator and stable mutation coverage manifest", () => {
    expect(GROUND_GLASS_M7K_BASE_COMMIT_SHA).toBe("e6066a244510387c32995c1e973a771667b04d10");
    expect(GROUND_GLASS_M7K_EVALUATOR_REVISION).toBe("m7k-broad-e2e-qualification-evaluator-v2");
    expect(GROUND_GLASS_M7K_MUTATION_SUITE_REVISION).toBe("m7k-broad-e2e-mutations-v2");
    expect(GROUND_GLASS_M7K_REQUIRED_MUTATION_CASES).toEqual([
      ...negativeCases.map((test) => test.name),
      ...v2NegativeCases.map((test) => test.name),
      "positive-complete-passing-two-lane-report",
      "positive-complete-failing-report-not-qualified",
      "positive-reviewed-skip-exclusion-policy",
      "positive-partial-report-labeled-incomplete",
      "positive-historical-m7g-failure-record",
      "positive-four-test-serial-lane",
      "v2-accepted-full-capture-remains-valid",
      "v2-selected-one-actual-worker-remains-incomplete",
    ]);
  });

  it.each(negativeCases)("rejects mutation: $name", ({ run }) => run());
  it.each(v2NegativeCases)("rejects schema-v2 mutation: $name", ({ run }) => run());

  it("accepts the complete captured report while keeping qualification not-qualified", () => {
    const value = fixture();
    const result = evaluate(value);
    expect(result.issues).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.evidenceIntegrity).toBe("passed");
    expect(result.executionCompleteness).toBe("complete");
    expect(result.broadE2eQualification).toBe("not-qualified");
    expect(result.counts).toMatchObject({
      discovered: 278,
      passed: 121,
      failed: 82,
      skipped: 75,
      flaky: 0,
      incomplete: 0,
      historicalFailures: 99,
      historicalNowPassing: 31,
      historicalStillFailing: 68,
      newUnexpectedFailures: 14,
    });
  });

  it("accepts a complete schema-v2 capture without manual metadata enrichment", () => {
    const value = schemaV2Fixture();
    const result = evaluate(value);
    expect(result.issues).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.evaluatorRevision).toBe(GROUND_GLASS_M7K_EVALUATOR_REVISION);
    expect(result.executionCompleteness).toBe("complete");
    expect(result.broadE2eQualification).toBe("not-qualified");
    expect(result.counts).toMatchObject({ discovered: 278, passed: 121, failed: 82, skipped: 75, flaky: 0, incomplete: 0 });
  });

  it("accepts a selected schema-v2 capture with one actual ordinary worker as incomplete", () => {
    const value = schemaV2Fixture("selected");
    setActualWorkers(value, "ordinary", 1);
    rebuild(value);
    const result = evaluate(value);
    expect(result.issues).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.executionCompleteness).toBe("incomplete");
    expect(result.broadE2eQualification).toBe("blocked");
  });

  it("checks captured evidence before mutation-suite validation metadata is attached", () => {
    const value = fixture();
    value.manifest = { ...value.manifest, validation: {} };
    rebuild(value);
    const result = evaluate(value);
    expect(result.passed).toBe(true);
    expect(result.executionCompleteness).toBe("complete");
    expect(result.broadE2eQualification).toBe("not-qualified");
  });

  it("accepts the serial renderer lane only as its actual one-worker 4/4 result", () => {
    const value = fixture();
    const result = evaluate(value);
    const lane = laneRecord(value, "rendererSerial");
    expect(lane.configuredWorkers).toBe(1);
    expect(lane.actualWorkers).toBe(1);
    expect(record(lane.outcomes)).toMatchObject({ discovered: 4, passed: 4, failed: 0, skipped: 0, flaky: 0 });
    expect(result.rendererSerialLane).toBe("passed");
    expect(GROUND_GLASS_M7K_REQUIRED_RENDERER_TESTS).toHaveLength(4);
  });

  it("accepts a complete two-lane passing raw report as qualified evidence", () => {
    const value = fixture();
    allCurrentUnexpectedToPass(value, "ordinary", false);
    allCurrentUnexpectedToPass(value, "rendererSerial", false);
    rebuild(value);
    const result = evaluate(value);
    expect(result.passed).toBe(true);
    expect(result.executionCompleteness).toBe("complete");
    expect(result.broadE2eQualification).toBe("qualified");
  });

  it("allows reviewed skip exclusions while keeping raw skipped outcomes explicit", () => {
    const value = fixture();
    allCurrentUnexpectedToPass(value, "ordinary");
    const initial = buildGroundGlassM7kQualificationReport(value.manifest, value.artifacts);
    const skips = Array.isArray(initial.skipAudit) ? initial.skipAudit : [];
    value.manifest = {
      ...value.manifest,
      approvedSkipExclusions: skips.filter(isRecord).map((entry) => ({
        testId: entry.testId,
        reviewStatus: "accepted",
        reason: "The native-only scenario is outside the documented ordinary Chromium/WebGL baseline.",
        supportedScope: "ordinary Chromium WebGL baseline; native WebGPU qualification remains separate",
      })),
    };
    rebuild(value);
    const result = evaluate(value);
    expect(result.issues).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.broadE2eQualification).toBe("qualified");
    expect(record(value.report.qualification).skipPolicy).toBeDefined();
    expect((Array.isArray(value.report.skipAudit) ? value.report.skipAudit : []).filter(isRecord)
      .every((entry) => entry.qualificationImpact === "explicitly-accepted-exclusion")).toBe(true);
  });

  it("accepts a partial report only when it is explicitly labeled incomplete", () => {
    const value = fixture();
    value.manifest = { ...value.manifest, lanes: { ordinary: value.manifest.lanes.ordinary } };
    rebuild(value);
    const result = evaluate(value);
    expect(result.issues).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.executionCompleteness).toBe("incomplete");
    expect(result.broadE2eQualification).toBe("blocked");
  });

  it("retains the 277/99 M7G historical record without relabeling one-run passes as fixes", () => {
    const value = fixture();
    const result = evaluate(value);
    expect(result.passed).toBe(true);
    expect(result.counts.historicalFailures).toBe(99);
    expect(record(record(value.report.historicalComparison).summary)).toMatchObject({
      historicalFailureCount: 99,
      historicalCurrentlyPassed: 31,
      historicalStillFailing: 68,
      newUnexpectedFailureCount: 14,
    });
    const comparison = Array.isArray(record(value.report.historicalComparison).tests)
      ? record(value.report.historicalComparison).tests as JsonRecord[]
      : [];
    expect(comparison.every((test) => test.causeConclusion === "no-new-causal-classification" ||
      test.causeConclusion === "currently-passed-once; historical-cause-not-reassigned")).toBe(true);
  });

  it("rejects a missing retained execution source commit", () => {
    const result = evaluate(fixture(), false);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("execution-source-commit-missing");
  });

  it("makes the production CLI reject a contradictory qualification claim with a nonzero exit", () => {
    const value = fixture();
    record(value.report.qualification).broadE2eQualification = "qualified";
    const tempReport = join(tmpdir(), `m7k-invalid-${process.pid}.json`);
    writeFileSync(tempReport, `${JSON.stringify(value.report, null, 2)}\n`);
    try {
      const result = spawnSync(process.execPath, [
        "scripts/run-m7k-qualification.mjs",
        `--report-path=${tempReport}`,
      ], { cwd: process.cwd(), encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("broad-qualification-claim-unsupported-by-outcomes");
    } finally {
      rmSync(tempReport, { force: true });
    }
  });

  it("returns a distinct nonzero status when a valid partial report is required to qualify", () => {
    const result = spawnSync(process.execPath, [
      "scripts/run-m7k-qualification.mjs",
      `--report-path=${resolve(process.cwd(), "docs/architecture/GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION_REPORT.json")}`,
      "--require-qualified",
    ], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).toBe(3);
    expect(result.stdout).toContain('"broadE2eQualification": "not-qualified"');
  });
});
