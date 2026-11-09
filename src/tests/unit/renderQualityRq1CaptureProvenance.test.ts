import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { captureBelongsToRun, currentRunCaptureIds } from "../../../scripts/render-quality/rq1-capture-provenance.mjs";

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

describe("RQ1 capture run provenance", () => {
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

  it("checks a newer reproduction against its own source commit instead of the baseline report", async () => {
    const fixture = await createCheckerFixture();
    try {
      await bindSelectedCapturesToRun(fixture.directory, allCaptureIds, currentRun);
      await writeRunStatus(fixture.directory, currentRun, "captured");

      const result = runChecker(fixture.directory);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("7 validated captures; native M3 status captured");
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it("marks old native files as missing when the current invocation is blocked", async () => {
    const fixture = await createCheckerFixture();
    try {
      const nonNativeCaptureIds = [...observerCaptureIds, ...webglCaptureIds];
      await bindSelectedCapturesToRun(fixture.directory, nonNativeCaptureIds, currentRun);
      await writeRunStatus(fixture.directory, currentRun, "blocked");

      const result = runChecker(fixture.directory);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("5 validated captures; native M3 status blocked");
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
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

async function writeRunStatus(directory: string, run: typeof currentRun, nativeStatusValue: "captured" | "blocked") {
  const nativeStatusPath = resolve(directory, "captures/native-status.json");
  const webglStatusPath = resolve(directory, "captures/webgl-status.json");
  const nativeStatus = JSON.parse(await readFile(nativeStatusPath, "utf8"));
  const webglStatus = JSON.parse(await readFile(webglStatusPath, "utf8"));
  const capturedCaptureIds = nativeStatusValue === "captured"
    ? [...allCaptureIds].sort()
    : [...observerCaptureIds, ...webglCaptureIds].sort();

  webglStatus.captureRunId = run.captureRunId;
  webglStatus.sourceCommit = run.sourceCommit;
  webglStatus.status = "captured";
  webglStatus.capturedCaptureIds = [...webglCaptureIds].sort();
  webglStatus.missingCaptureIds = [];
  await writeFile(webglStatusPath, JSON.stringify(webglStatus, null, 2) + "\n");

  nativeStatus.captureRunId = run.captureRunId;
  nativeStatus.sourceCommit = run.sourceCommit;
  nativeStatus.status = nativeStatusValue;
  nativeStatus.capturedCaptureIds = nativeStatusValue === "captured" ? [...nativeCaptureIds].sort() : [];
  nativeStatus.missingCaptureIds = nativeStatusValue === "blocked" ? [...nativeCaptureIds].sort() : [];
  nativeStatus.blocker = nativeStatusValue === "blocked" ? "simulated native browser unavailable" : null;
  await writeFile(nativeStatusPath, JSON.stringify(nativeStatus, null, 2) + "\n");

  const runRecord = {
    schemaVersion: "rq1-capture-run-v1",
    captureRunId: run.captureRunId,
    sourceCommit: run.sourceCommit,
    observerCaptureMode: nativeStatusValue === "captured" ? "dream-loop-captured" : "reused-dream-loop-output",
    status: nativeStatusValue === "captured" ? "captured" : "native-blocked",
    capturedCaptureIds,
    webglStatus: "captured",
    nativeStatus: nativeStatusValue,
  };
  await writeFile(resolve(directory, "captures/capture-run.json"), JSON.stringify(runRecord, null, 2) + "\n");
}

function runChecker(directory: string) {
  return spawnSync(process.execPath, [
    "scripts/render-quality/rq1-check.mjs",
    "--output-dir",
    relative(process.cwd(), directory),
  ], { cwd: process.cwd(), encoding: "utf8" });
}
