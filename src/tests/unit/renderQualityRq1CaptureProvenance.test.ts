import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { captureBelongsToRun, currentRunCaptureIds, findCurrentCaptureIds } from "../../../scripts/render-quality/rq1-capture-provenance.mjs";
import { classifyNativeCaptureOutcome } from "../../../scripts/render-quality/rq1-native-capture-status.mjs";

const currentRun = {
  captureRunId: randomUUID(),
  sourceCommit: "a".repeat(40),
};

const observerCaptureIds = [
  "architecture-rise-observer-clean",
  "architecture-rise-observer-teaching",
];
const webglCaptureIds = [
  "architecture-rise-neutral-webgl-raw",
  "architecture-rise-front-rise-webgl-raw",
  "architecture-rise-processed-webgl-reference",
];
const nativeCaptureIds = [
  "architecture-rise-neutral-webgpu-raw",
  "architecture-rise-front-rise-webgpu-raw",
];
const allCaptureIds = [...observerCaptureIds, ...webglCaptureIds, ...nativeCaptureIds];

describe("RQ1 capture run provenance and native classification", () => {
  it("binds a newly captured image to the source commit of its own run", () => {
    expect(captureBelongsToRun({
      captureRunId: currentRun.captureRunId,
      captureRunSourceCommit: currentRun.sourceCommit,
      sourceCommit: currentRun.sourceCommit,
    }, currentRun)).toBe(true);
  });

  it("keeps reused Observer image provenance while binding its copy to the current run", () => {
    expect(captureBelongsToRun({
      captureRunId: currentRun.captureRunId,
      captureRunSourceCommit: currentRun.sourceCommit,
      sourceCommit: "b".repeat(40),
    }, currentRun)).toBe(true);
  });

  it("does not count stale files from an earlier invocation as current captures", () => {
    const previousRunCapture = {
      captureRunId: "previous-run-id",
      captureRunSourceCommit: "c".repeat(40),
      sourceCommit: "c".repeat(40),
    };
    expect(currentRunCaptureIds(
      ["neutral", "front-rise"],
      { neutral: previousRunCapture },
      currentRun,
    )).toEqual([]);
  });

  it("excludes previous-run native files from the capture runner inventory", async () => {
    const fixture = await createCheckerFixture();
    try {
      const manifest = JSON.parse(await readFile(resolve(process.cwd(), "docs/render-quality/rq1-baseline/states.json"), "utf8"));
      const nativeSpecs = manifest.states.flatMap((state: { captures: Array<{ captureId: string; path: string; rendererFamily: string }> }) =>
        state.captures.filter((capture) => capture.rendererFamily === "webgpu-renderer"),
      );
      expect(nativeSpecs).toHaveLength(2);
      expect(await findCurrentCaptureIds(nativeSpecs, fixture.directory, currentRun)).toEqual([]);
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it("classifies a fully completed native capture as captured", () => {
    expect(classifyNativeCaptureOutcome({
      preflight: availablePreflight(),
      captureRun: currentRun,
      processExitCode: 0,
      processSignal: null,
      captureAttempted: true,
      expectedCaptureIds: nativeCaptureIds,
      currentCaptureIds: nativeCaptureIds,
      nativeArtifactsPresent: true,
    })).toEqual({ status: "captured", reasonClass: null });
  });

  it("classifies a proved unavailable adapter as blocked without attempting native captures", () => {
    expect(classifyNativeCaptureOutcome({
      preflight: unavailablePreflight(),
      captureRun: currentRun,
      processExitCode: 0,
      processSignal: null,
      captureAttempted: false,
      expectedCaptureIds: nativeCaptureIds,
      currentCaptureIds: [],
      nativeArtifactsPresent: false,
    })).toEqual({ status: "blocked", reasonClass: "environment-unavailable" });
  });

  it("classifies an explicit null adapter as environment unavailable", () => {
    const preflight = {
      ...unavailablePreflight(),
      probeStatus: "adapter-unavailable",
      navigatorGpuPresent: true,
      adapterAvailable: false,
    };
    expect(classifyNativeCaptureOutcome({
      preflight,
      captureRun: currentRun,
      processExitCode: 0,
      processSignal: null,
      captureAttempted: false,
      expectedCaptureIds: nativeCaptureIds,
      currentCaptureIds: [],
      nativeArtifactsPresent: false,
    })).toEqual({ status: "blocked", reasonClass: "environment-unavailable" });
  });

  it.each([
    ["assertion failure without PNGs", 1, [], false, availablePreflight()],
    ["assertion failure after partial output", 1, [nativeCaptureIds[0]], true, availablePreflight()],
    ["timeout without proved unavailability", 1, [], false, invalidPreflight("adapter-request-timeout")],
    ["renderer fallback assertion failure", 1, [], false, availablePreflight()],
    ["browser launch failure without preflight evidence", 1, [], false, null],
  ])("fails closed for %s", (_label, exitCode, currentIds, artifacts, preflight) => {
    expect(classifyNativeCaptureOutcome({
      preflight,
      captureRun: currentRun,
      processExitCode: exitCode,
      processSignal: null,
      captureAttempted: true,
      expectedCaptureIds: nativeCaptureIds,
      currentCaptureIds: currentIds,
      nativeArtifactsPresent: artifacts,
    }).status).toBe("invalid");
  });

  it("accepts a newer working run against its own clean source provenance", async () => {
    const fixture = await createCheckerFixture();
    try {
      await bindSelectedCapturesToRun(fixture.directory, allCaptureIds, currentRun);
      await writeRunStatus(fixture.directory, currentRun, "captured");

      const result = runChecker(fixture.directory);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("7 captures; native M3 captured");
      expect(result.stdout).toContain("clean and commit-reproducible");
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it("keeps reused Observer source provenance independent from the Ground Glass run commit", async () => {
    const fixture = await createCheckerFixture();
    try {
      await bindObserverCopiesToRun(fixture.directory, currentRun);
      await bindSelectedCapturesToRun(fixture.directory, [...webglCaptureIds, ...nativeCaptureIds], currentRun);
      await writeRunStatus(fixture.directory, currentRun, "captured");

      const result = runChecker(fixture.directory);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("clean and commit-reproducible");
      const runRecord = JSON.parse(await readFile(resolve(fixture.directory, "captures/capture-run.json"), "utf8"));
      expect(runRecord.observerSourceCommits).toEqual(["c4bba9cfeb5b8206f0aabaae012b556d0f959bd9"]);
      expect(runRecord.sourceCommit).toBe(currentRun.sourceCommit);
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it("accepts a supported native environment blocker only as limited WebGL evidence", async () => {
    const fixture = await createCheckerFixture();
    try {
      await bindSelectedCapturesToRun(fixture.directory, [...observerCaptureIds, ...webglCaptureIds], currentRun);
      await writeRunStatus(fixture.directory, currentRun, "blocked");

      const result = runChecker(fixture.directory);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("WebGL evidence valid; native environment unavailable");
      expect(result.stdout).toContain("Native rendering was not validated");
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it("rejects a native assertion failure with no screenshots instead of accepting a blocker string", async () => {
    const fixture = await createCheckerFixture();
    try {
      await bindSelectedCapturesToRun(fixture.directory, [...observerCaptureIds, ...webglCaptureIds], currentRun);
      await writeRunStatus(fixture.directory, currentRun, "blocked");
      await setNativeFailure(fixture.directory, { exitCode: 1, captureIds: [], probeStatus: "adapter-available" });

      const result = runChecker(fixture.directory);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("native capture is invalid");
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it("rejects a native assertion failure after one current-run screenshot", async () => {
    const fixture = await createCheckerFixture();
    try {
      await bindSelectedCapturesToRun(fixture.directory, [...observerCaptureIds, ...webglCaptureIds, nativeCaptureIds[0]], currentRun);
      await writeRunStatus(fixture.directory, currentRun, "captured");
      await setNativeFailure(fixture.directory, { exitCode: 1, captureIds: [nativeCaptureIds[0]], probeStatus: "adapter-available" });

      const result = runChecker(fixture.directory);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("native capture is invalid");
      expect(result.stderr).not.toContain("native environment unavailable");
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it("rejects a blocked claim with partial native capture output", async () => {
    const fixture = await createCheckerFixture();
    try {
      await bindSelectedCapturesToRun(fixture.directory, [...observerCaptureIds, ...webglCaptureIds], currentRun);
      await writeRunStatus(fixture.directory, currentRun, "blocked");
      const baselinePng = await readFile(resolve(process.cwd(), "docs/render-quality/rq1-baseline/ground-glass/neutral/webgpu-raw.png"));
      await writeFile(resolve(fixture.directory, "ground-glass/neutral/webgpu-raw.png"), baselinePng);

      const result = runChecker(fixture.directory);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("blocked native status contains partial current-run native artifacts");
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it("rejects a status record that disagrees with the capture-run summary", async () => {
    const fixture = await createCheckerFixture();
    try {
      await bindSelectedCapturesToRun(fixture.directory, [...observerCaptureIds, ...webglCaptureIds], currentRun);
      await writeRunStatus(fixture.directory, currentRun, "blocked");
      const runPath = resolve(fixture.directory, "captures/capture-run.json");
      const runRecord = JSON.parse(await readFile(runPath, "utf8"));
      runRecord.nativeStatus = "captured";
      await writeFile(runPath, JSON.stringify(runRecord, null, 2) + "\n");

      const result = runChecker(fixture.directory);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("capture-run status summary does not match backend status records");
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it("rejects a fabricated blocker description without structured environment evidence", async () => {
    const fixture = await createCheckerFixture();
    try {
      await bindSelectedCapturesToRun(fixture.directory, [...observerCaptureIds, ...webglCaptureIds], currentRun);
      await writeRunStatus(fixture.directory, currentRun, "blocked");
      const nativeStatusPath = resolve(fixture.directory, "captures/native-status.json");
      const nativeStatus = JSON.parse(await readFile(nativeStatusPath, "utf8"));
      nativeStatus.preflight = { ...invalidPreflight("adapter-request-timeout"), captureRunId: currentRun.captureRunId, sourceCommit: currentRun.sourceCommit };
      nativeStatus.blocker = "WebGPU is unavailable (fabricated human-readable claim)";
      await writeFile(nativeStatusPath, JSON.stringify(nativeStatus, null, 2) + "\n");

      const result = runChecker(fixture.directory);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("lacks supported environment-unavailability evidence");
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it("rejects a failed native process even after its outputs are deleted", async () => {
    const fixture = await createCheckerFixture();
    try {
      await bindSelectedCapturesToRun(fixture.directory, [...observerCaptureIds, ...webglCaptureIds], currentRun);
      await writeRunStatus(fixture.directory, currentRun, "blocked");
      await setNativeFailure(fixture.directory, { exitCode: 1, captureIds: [], probeStatus: "adapter-available" });

      const result = runChecker(fixture.directory);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("native capture is invalid");
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it("does not let stale native images satisfy the current captured run", async () => {
    const fixture = await createCheckerFixture();
    try {
      await bindSelectedCapturesToRun(fixture.directory, [...observerCaptureIds, ...webglCaptureIds], currentRun);
      await writeRunStatus(fixture.directory, currentRun, "captured");

      const result = runChecker(fixture.directory);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("native status classification is inconsistent");
      expect(result.stderr).toContain("current-run screenshot or metadata is missing");
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it("protects the committed baseline and keeps its accepted image digests unchanged", async () => {
    const before = await baselinePngDigests();
    const result = spawnSync(process.execPath, [
      "scripts/render-quality/rq1-capture.mjs",
      "--skip-observer",
      "--output-dir",
      "docs/render-quality/rq1-baseline",
    ], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("committed RQ1 baseline is immutable");
    expect(await baselinePngDigests()).toEqual(before);
  });

  it("refuses dirty-source capture before writing a run record", async () => {
    const dirtyMarker = resolve(process.cwd(), ".rq1-dirty-source-probe");
    const output = resolve(process.cwd(), "docs/render-quality/.rq1-dirty-test-run");
    try {
      await writeFile(dirtyMarker, "dirty source probe\n");
      const result = spawnSync(process.execPath, [
        "scripts/render-quality/rq1-capture.mjs",
        "--skip-observer",
        "--output-dir",
        "docs/render-quality/.rq1-dirty-test-run",
      ], { cwd: process.cwd(), encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("requires a clean source tree");
      await expect(readFile(resolve(output, "captures/capture-run.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(dirtyMarker, { force: true });
      await rm(output, { recursive: true, force: true });
    }
  });

  it("validates the original committed baseline independently", () => {
    const result = spawnSync(process.execPath, ["scripts/render-quality/rq1-check.mjs", "--baseline"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("committed baseline valid: 7 captures; native M3 captured");
  });

  it("keeps the normal capture destination outside the committed baseline", async () => {
    const script = await readFile(resolve(process.cwd(), "scripts/render-quality/rq1-capture.mjs"), "utf8");
    expect(script).toContain('const defaultOutput = "docs/render-quality/.rq1-runs/current";');
    const ignoreResult = spawnSync("git", ["check-ignore", "-q", "docs/render-quality/.rq1-runs/current/captures/capture-run.json"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(ignoreResult.status).toBe(0);
  });

  it("rejects capture output symlinks before writing outside the repository namespace", async () => {
    const linkPath = resolve(process.cwd(), "docs/render-quality/.rq1-output-link-probe");
    try {
      await symlink(resolve(process.cwd(), "docs"), linkPath, "dir");
      const result = spawnSync(process.execPath, [
        "scripts/render-quality/rq1-capture.mjs",
        "--skip-observer",
        "--output-dir",
        "docs/render-quality/.rq1-output-link-probe",
      ], { cwd: process.cwd(), encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("may not pass through symlinks");
    } finally {
      await rm(linkPath, { force: true });
    }
  });
});

async function createCheckerFixture() {
  const root = resolve(process.cwd(), "docs/render-quality");
  const directory = await mkdtemp(join(root, ".rq1-check-fixture-"));
  await cp(resolve(root, "rq1-baseline"), directory, { recursive: true });

  for (const captureId of allCaptureIds) {
    const metadataPath = resolve(directory, "captures", `${captureId}.json`);
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    metadata.imagePath = metadata.imagePath.replace(
      "docs/render-quality/rq1-baseline/",
      `${relative(process.cwd(), directory)}/`,
    );
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
  }

  return { directory };
}

async function bindSelectedCapturesToRun(directory: string, captureIds: string[], run: typeof currentRun) {
  for (const captureId of captureIds) {
    const metadataPath = resolve(directory, "captures", `${captureId}.json`);
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    metadata.captureRunId = run.captureRunId;
    metadata.captureRunSourceCommit = run.sourceCommit;
    metadata.sourceCommit = run.sourceCommit;
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
  }
}

async function bindObserverCopiesToRun(directory: string, run: typeof currentRun) {
  for (const captureId of observerCaptureIds) {
    const metadataPath = resolve(directory, "captures", `${captureId}.json`);
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    metadata.captureRunId = run.captureRunId;
    metadata.captureRunSourceCommit = run.sourceCommit;
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
  }
}

async function writeRunStatus(directory: string, run: typeof currentRun, nativeStatusValue: "captured" | "blocked") {
  const nativeStatusPath = resolve(directory, "captures/native-status.json");
  const webglStatusPath = resolve(directory, "captures/webgl-status.json");
  const nativeStatus = JSON.parse(await readFile(nativeStatusPath, "utf8"));
  const webglStatus = JSON.parse(await readFile(webglStatusPath, "utf8"));
  const capturedIds = nativeStatusValue === "captured"
    ? [...observerCaptureIds, ...webglCaptureIds, ...nativeCaptureIds]
    : [...observerCaptureIds, ...webglCaptureIds];

  if (nativeStatusValue === "blocked") {
    for (const captureId of nativeCaptureIds) {
      await rm(resolve(directory, "captures", `${captureId}.json`), { force: true });
      const metadata = JSON.parse(await readFile(resolve(process.cwd(), "docs/render-quality/rq1-baseline/captures", `${captureId}.json`), "utf8"));
      await rm(resolve(directory, metadata.imagePath.replace("docs/render-quality/rq1-baseline/", "")), { force: true });
    }
  }

  webglStatus.captureRunId = run.captureRunId;
  webglStatus.sourceCommit = run.sourceCommit;
  webglStatus.status = "captured";
  webglStatus.exitCode = 0;
  webglStatus.signal = null;
  webglStatus.capturedCaptureIds = [...webglCaptureIds];
  webglStatus.missingCaptureIds = [];
  await writeFile(webglStatusPath, JSON.stringify(webglStatus, null, 2) + "\n");

  nativeStatus.schemaVersion = "rq1-native-status-v1";
  nativeStatus.captureRunId = run.captureRunId;
  nativeStatus.sourceCommit = run.sourceCommit;
  nativeStatus.status = nativeStatusValue;
  nativeStatus.reasonClass = nativeStatusValue === "blocked" ? "environment-unavailable" : null;
  nativeStatus.preflight = nativeStatusValue === "blocked" ? unavailablePreflight(run) : availablePreflight(run);
  nativeStatus.nativeTest = { captureAttempted: nativeStatusValue === "captured", exitCode: 0, signal: null, error: null };
  nativeStatus.exitCode = 0;
  nativeStatus.signal = null;
  nativeStatus.capturedCaptureIds = nativeStatusValue === "captured" ? [...nativeCaptureIds] : [];
  nativeStatus.missingCaptureIds = nativeStatusValue === "blocked" ? [...nativeCaptureIds] : [];
  nativeStatus.blocker = nativeStatusValue === "blocked" ? `Native prerequisite unavailable: ${nativeStatus.preflight.probeStatus}.` : null;
  nativeStatus.failureSummary = null;
  await writeFile(nativeStatusPath, JSON.stringify(nativeStatus, null, 2) + "\n");

  const captureRun = {
    schemaVersion: "rq1-capture-run-v2",
    captureRunId: run.captureRunId,
    sourceCommit: run.sourceCommit,
    sourceTree: { status: "clean", commitReproducible: true, dirtyPaths: [] },
    observerCaptureMode: "reused-dream-loop-output",
    observerSourceCommits: [...new Set(await Promise.all(observerCaptureIds.map(async (captureId) => {
      const metadata = JSON.parse(await readFile(resolve(directory, "captures", `${captureId}.json`), "utf8"));
      return metadata.sourceCommit;
    })))].sort(),
    status: nativeStatusValue === "captured" ? "captured" : "native-blocked",
    capturedCaptureIds: capturedIds,
    webglStatus: "captured",
    nativeStatus: nativeStatusValue,
    nativeReasonClass: nativeStatusValue === "blocked" ? "environment-unavailable" : null,
  };
  await writeFile(resolve(directory, "captures/capture-run.json"), JSON.stringify(captureRun, null, 2) + "\n");
}

async function setNativeFailure(directory: string, options: { exitCode: number; captureIds: string[]; probeStatus: string }) {
  const statusPath = resolve(directory, "captures/native-status.json");
  const runPath = resolve(directory, "captures/capture-run.json");
  const nativeStatus = JSON.parse(await readFile(statusPath, "utf8"));
  const captureRun = JSON.parse(await readFile(runPath, "utf8"));
  nativeStatus.status = "invalid";
  nativeStatus.reasonClass = options.probeStatus === "adapter-available" ? "native-capture-failure" : "unknown-failure";
  nativeStatus.preflight = options.probeStatus === "adapter-available"
    ? availablePreflight(currentRun)
    : invalidPreflight(options.probeStatus, currentRun);
  nativeStatus.nativeTest = { captureAttempted: true, exitCode: options.exitCode, signal: null, error: null };
  nativeStatus.exitCode = options.exitCode;
  nativeStatus.signal = null;
  nativeStatus.capturedCaptureIds = options.captureIds;
  nativeStatus.missingCaptureIds = nativeCaptureIds.filter((captureId) => !options.captureIds.includes(captureId));
  nativeStatus.blocker = "WebGPU unavailable (human-readable text only)";
  await writeFile(statusPath, JSON.stringify(nativeStatus, null, 2) + "\n");
  captureRun.status = "invalid";
  captureRun.nativeStatus = "invalid";
  captureRun.nativeReasonClass = nativeStatus.reasonClass;
  captureRun.capturedCaptureIds = [...observerCaptureIds, ...webglCaptureIds, ...options.captureIds];
  await writeFile(runPath, JSON.stringify(captureRun, null, 2) + "\n");
}

function availablePreflight(run = currentRun) {
  return {
    schemaVersion: "rq1-native-preflight-v1",
    captureRunId: run.captureRunId,
    sourceCommit: run.sourceCommit,
    browserProject: "chrome-native-webgpu",
    browserVersion: "157.0.0.0",
    browserLaunched: true,
    localPageLoaded: true,
    secureContext: true,
    navigatorGpuPresent: true,
    adapterAvailable: true,
    probeStatus: "adapter-available",
    status: "available",
  };
}

function unavailablePreflight(run = currentRun) {
  return {
    schemaVersion: "rq1-native-preflight-v1",
    captureRunId: run.captureRunId,
    sourceCommit: run.sourceCommit,
    browserProject: "chrome-native-webgpu",
    browserVersion: "157.0.0.0",
    browserLaunched: true,
    localPageLoaded: true,
    secureContext: true,
    navigatorGpuPresent: false,
    adapterAvailable: null,
    probeStatus: "webgpu-api-absent",
    status: "environment-unavailable",
  };
}

function invalidPreflight(probeStatus: string, run = currentRun) {
  return {
    ...availablePreflight(run),
    status: "invalid",
    probeStatus,
    adapterAvailable: null,
  };
}

function runChecker(directory: string) {
  return spawnSync(process.execPath, [
    "scripts/render-quality/rq1-check.mjs",
    "--output-dir",
    relative(process.cwd(), directory),
  ], { cwd: process.cwd(), encoding: "utf8" });
}

async function baselinePngDigests() {
  const root = resolve(process.cwd(), "docs/render-quality/rq1-baseline");
  const paths = [
    "ground-glass/neutral/webgl-raw.png",
    "ground-glass/neutral/webgpu-raw.png",
    "ground-glass/front-rise/webgl-raw.png",
    "ground-glass/front-rise/webgpu-raw.png",
    "ground-glass/processed/webgl-processed.png",
    "observer/observer-clean.png",
    "observer/observer-teaching.png",
  ];
  return Promise.all(paths.map(async (path) => createHash("sha256").update(await readFile(resolve(root, path))).digest("hex")));
}
