import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { REVISION } from "three";

const FIXTURE_PATH = "/src/tests/e2e/fixtures/ground-glass-webgpu-aperture-gather.html?phaseH=1";
const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";

type Handle = {
  instanceId: string;
  generation: number;
  state: string;
  runtime: null | {
    rendererFamily: string;
    executionBackend: string;
    applicationFallback: boolean;
    initialized: boolean;
    threeRevision: string;
  };
  dimensions: null | {
    sourceWidthPx: number;
    sourceHeightPx: number;
    farGatherWidthPx: number;
    farGatherHeightPx: number;
    sampleCount: number;
    gatherScale: number;
    maximumCoCRadiusPx: number;
    sampledFilmWidthMm: number;
    sampledFilmHeightMm: number;
    focusOffsetMm: number;
  };
  phaseH: null | {
    coordinateContract: {
      readbackOrigin: string;
      sourceIdentityMismatchCount: number;
      gatherCoordinateMismatchCount: number;
      gatherCenterNominalFormulaMismatchCount: number;
      gatherCenterMaximumDeviationPx: number;
      gatherCenterOutOfBoundsCount: number;
      selectedGatherNominalFormulaMismatchCount: number;
      selectedCenterProvenanceMismatchCount: number;
      selectedGatherOutOfBoundsCount: number;
      sourcePixelsChecked: number;
      gatherTexelsChecked: number;
      samplingExamples: unknown[];
      gatherMismatchExamples: Array<Record<string, unknown>>;
      compositeMismatchExamples: Array<Record<string, unknown>>;
    };
    cpuReference: {
      validFarGatherCenters: number;
      gatherGpuVsCpu: { samples: number; maxRgbError: number; meanRgbError: number };
      reconstructionGpuVsCpu: { samples: number; maxRgbError: number; meanRgbError: number };
      candidateFarGpuVsCpu: null | { samples: number; maxRgbError: number; meanRgbError: number };
      candidateCompositeGpuVsCpu: null | { samples: number; maxRgbError: number; meanRgbError: number };
      candidateReconstructionMismatchExamples: Array<Record<string, unknown>>;
      expectedFarTexels: number;
      reconstructedSourcePixels: number;
    };
    leakage: {
      sourcePixelCount: number;
      baselineLeakPixelCount: number;
      baselineLeakEnergy: number;
      meanDistanceToForegroundPx: number;
      maximumDistanceToForegroundPx: number;
      classCounts: Record<string, number>;
      spatialDistribution: { byTopOriginRow: Record<string, number>; byColumn: Record<string, number> };
      records: Array<Record<string, unknown>>;
      candidate: null | {
        farLeakPixelCount: number;
        farLeakEnergy: number;
        farYellowSpreadPixels: number;
        farYellowSpreadEnergy: number;
        baselineFarYellowSpreadPixels: number;
        baselineFarYellowSpreadEnergy: number;
        nearRedSpreadPixels: number;
        nearAlphaCoveragePixels: number;
        nearBlueLeakPixels: number;
        focusedGreenSourcePixels: number;
        focusedGreenFarMeanAbsoluteDeviationFromRaw: number | null;
        candidatePathMismatchCount: number;
        candidatePathMismatchExamples: Array<Record<string, unknown>>;
        farCandidateVsBaseline: {
          changedPixelCountAboveRgbMaxError001: number;
          meanPixelMaxRgbError: number;
          maximumPixelRgbError: number;
        };
        candidateCompositeVsBaselineMaxRgbError: number | null;
      };
    };
    execution: {
      edgeCase: string;
      sampleCount: number;
      gatherDimensions: { widthPx: number; heightPx: number };
      additionalTargetStorageEstimateBytes: number;
      candidatePassTimings: Array<{
        stage: string;
        cpuSubmissionTimeMs: number;
        observedQueueCompletionMs: number | null;
        queueWaitAfterSubmissionMs: number | null;
      }>;
      gpuTimestampDurationMs: null;
    };
  };
  operations: Array<{
    operationId: string;
    state: string;
    stage: string;
    resultPublished: boolean;
    timing: null | {
      operationWallTimeMs: number;
      readbackWallTimeMs: number | null;
      stages: Array<{
        stage: string;
        cpuSubmissionTimeMs: number;
        observedQueueCompletionMs: number | null;
        queueWaitAfterSubmissionMs: number | null;
      }>;
      gpuTimestampDurationMs: null;
    };
  }>;
  passes: Array<{ id: string; state: string; error: string | null }>;
  resources: Array<{ id: string; role: string; state: string; error: string | null }>;
  error: string | null;
  cleanupError: string | null;
  cleanupCompletedAt: number | null;
};
type Diagnostics = { activeHandleId: string | null; handles: Handle[] };

const diagnostics = async (page: Page): Promise<Diagnostics> => {
  const text = await page.getByTestId("fixture-diagnostics").textContent();
  if (!text) throw new Error("Phase H diagnostics are not published");
  return JSON.parse(text) as Diagnostics;
};

const activeHandle = async (page: Page) => {
  const state = await diagnostics(page);
  const handle = state.handles.find((candidate) => candidate.instanceId === state.activeHandleId);
  if (!handle) throw new Error("Phase H has no active GPU renderer handle");
  return handle;
};

const waitForInitial = async (page: Page) => {
  await expect.poll(async () => {
    const handle = await activeHandle(page).catch(() => null);
    return Boolean(
      handle?.state === "active"
      && handle.operations.at(-1)?.state === "completed"
      && handle.operations.at(-1)?.resultPublished
      && handle.phaseH?.coordinateContract,
    );
  }, { timeout: 180_000, intervals: [100, 250, 500] }).toBe(true);
  return activeHandle(page);
};

const run = async (page: Page, buttonName: string) => {
  const before = await activeHandle(page);
  const previousCount = before.operations.length;
  const previousOperationId = before.operations.at(-1)?.operationId;
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  await expect.poll(async () => {
    const handle = (await diagnostics(page)).handles.find((candidate) => candidate.instanceId === before.instanceId);
    const operation = handle?.operations.at(-1);
    return Boolean(
      handle?.state === "active"
      && handle.operations.length === previousCount + 1
      && operation?.operationId !== previousOperationId
      && operation?.state === "completed"
      && operation.resultPublished
      && handle.phaseH?.coordinateContract,
    );
  }, { timeout: 120_000, intervals: [100, 250, 500, 1000] }).toBe(true);
  const handle = (await diagnostics(page)).handles.find((candidate) => candidate.instanceId === before.instanceId);
  if (!handle) throw new Error(`Phase H handle ${before.instanceId} disappeared after ${buttonName}`);
  return handle;
};

const assertNative = (handle: Handle) => {
  expect(handle.runtime).toMatchObject({
    rendererFamily: "webgpu-renderer",
    executionBackend: "webgpu",
    applicationFallback: false,
    initialized: true,
    threeRevision: "186",
  });
};

const assertNativeSampling = (handle: Handle) => {
  const phaseH = handle.phaseH;
  expect(phaseH, "native Phase H GPU diagnostics exist").not.toBeNull();
  expect(phaseH!.coordinateContract.sourceIdentityMismatchCount).toBe(0);
  expect(phaseH!.coordinateContract.gatherCoordinateMismatchCount, JSON.stringify(phaseH!.coordinateContract.gatherMismatchExamples)).toBe(0);
  expect(phaseH!.coordinateContract.gatherCenterOutOfBoundsCount).toBe(0);
  expect(phaseH!.coordinateContract.gatherCenterMaximumDeviationPx, JSON.stringify(phaseH!.coordinateContract.gatherMismatchExamples)).toBeLessThanOrEqual(1);
  expect(phaseH!.coordinateContract.selectedGatherNominalFormulaMismatchCount, JSON.stringify(phaseH!.coordinateContract.compositeMismatchExamples)).toBe(0);
  expect(phaseH!.coordinateContract.selectedCenterProvenanceMismatchCount, JSON.stringify(phaseH!.coordinateContract.compositeMismatchExamples)).toBe(0);
  expect(phaseH!.coordinateContract.selectedGatherOutOfBoundsCount).toBe(0);
  expect(phaseH!.coordinateContract.sourcePixelsChecked).toBe(128 * 96);
  expect(phaseH!.coordinateContract.gatherTexelsChecked).toBe(handle.dimensions!.farGatherWidthPx * handle.dimensions!.farGatherHeightPx);
};

const writeArtifact = async (testInfo: TestInfo, name: string, value: unknown) => {
  const path = testInfo.outputPath(name);
  await mkdir(testInfo.outputDir, { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
  await testInfo.attach(name, { path, contentType: "application/json" });
};

test("ordinary Chromium Phase H control records fallback-compatible behavior only", async ({ page }) => {
  test.skip(nativeWebGpuRequired, "Native execution evidence is collected in headed Chrome");
  await page.goto(FIXTURE_PATH);
  await expect(page.getByTestId("phase-h-controls")).toBeVisible();
  const handle = await waitForInitial(page);
  expect(handle.runtime?.initialized).toBe(true);
  expect(handle.runtime?.threeRevision).toBe(REVISION);
  expect(handle.runtime?.executionBackend).not.toBe("webgpu");
  assertNativeSampling(handle);
});

test("native Phase H verifies gather coordinates, leakage provenance, CPU reconstruction, and bounded candidate", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired, "Phase H GPU evidence requires the native headed Chrome project");
  test.setTimeout(900_000);
  await page.goto(FIXTURE_PATH);
  await expect(page.getByTestId("phase-h-controls")).toBeVisible();
  const initial = await waitForInitial(page);
  assertNative(initial);
  assertNativeSampling(initial);

  const configs = [
    { name: "Phase H full ×32 A/B", gatherScale: 1, sampleCount: 32, expectedBaselineLeakPixels: 0 },
    { name: "Phase H half ×16 A/B", gatherScale: 0.5, sampleCount: 16, expectedBaselineLeakPixels: 36 },
    { name: "Phase H half ×32 A/B", gatherScale: 0.5, sampleCount: 32, expectedBaselineLeakPixels: 36 },
    { name: "Phase H half ×64 A/B", gatherScale: 0.5, sampleCount: 64, expectedBaselineLeakPixels: 36 },
  ] as const;
  const results: Array<{ config: typeof configs[number]; handle: Handle }> = [];
  for (const config of configs) {
    const handle = await run(page, config.name);
    assertNative(handle);
    assertNativeSampling(handle);
    expect(handle.dimensions).toMatchObject({
      sourceWidthPx: 128,
      sourceHeightPx: 96,
      farGatherWidthPx: Math.floor(128 * config.gatherScale),
      farGatherHeightPx: Math.floor(96 * config.gatherScale),
      sampleCount: config.sampleCount,
      gatherScale: config.gatherScale,
      maximumCoCRadiusPx: 12,
      focusOffsetMm: 0,
    });
    const phaseH = handle.phaseH!;
    expect(phaseH.cpuReference.gatherGpuVsCpu.samples).toBe(phaseH.cpuReference.expectedFarTexels * 3);
    expect(phaseH.cpuReference.gatherGpuVsCpu.maxRgbError).toBeLessThan(0.04);
    expect(phaseH.cpuReference.reconstructionGpuVsCpu.samples).toBe(128 * 96 * 3);
    expect(phaseH.cpuReference.reconstructionGpuVsCpu.maxRgbError).toBeLessThan(0.04);
    expect(phaseH.leakage.baselineLeakPixelCount).toBe(config.expectedBaselineLeakPixels);
    expect(phaseH.leakage.records.length).toBe(config.expectedBaselineLeakPixels);
    const candidate = phaseH.leakage.candidate;
    expect(candidate).not.toBeNull();
    expect(phaseH.cpuReference.candidateFarGpuVsCpu?.maxRgbError).toBeLessThan(0.04);
    expect(phaseH.cpuReference.candidateCompositeGpuVsCpu?.maxRgbError).toBeLessThan(0.04);
    expect(candidate!.candidatePathMismatchCount, JSON.stringify(candidate!.candidatePathMismatchExamples)).toBe(0);
    expect(candidate!.farLeakPixelCount).toBeLessThanOrEqual(config.expectedBaselineLeakPixels);
    expect(candidate!.nearAlphaCoveragePixels).toBeGreaterThan(0);
    expect(candidate!.nearRedSpreadPixels).toBeGreaterThan(0);
    expect(candidate!.nearBlueLeakPixels).toBe(0);
    expect(candidate!.focusedGreenSourcePixels).toBeGreaterThan(0);
    expect(candidate!.focusedGreenFarMeanAbsoluteDeviationFromRaw).toBeLessThan(0.02);
    if (config.gatherScale === 0.5) {
      expect(phaseH.leakage.classCounts.A).toBeGreaterThan(0);
      expect(phaseH.leakage.classCounts.B).toBe(0);
      expect(phaseH.leakage.classCounts.C).toBe(0);
      expect(phaseH.leakage.classCounts.D + phaseH.leakage.classCounts.E).toBe(0);
      expect(candidate!.farYellowSpreadEnergy).toBeGreaterThan(0);
      // This candidate is intentionally rejected if surface fallback removes the measured far-feature spread.
      expect(candidate!.farYellowSpreadEnergy).toBeLessThan(candidate!.baselineFarYellowSpreadEnergy);
    }
    results.push({ config, handle });
    if (config.name === "Phase H half ×32 A/B") {
      await testInfo.attach("phase-h-baseline-half-32.png", {
        body: await page.locator('canvas[aria-label="Native WebGPU aperture gather composite"]').screenshot(),
        contentType: "image/png",
      });
      const candidateDisplay = await run(page, "Phase H show candidate half ×32");
      assertNativeSampling(candidateDisplay);
      await testInfo.attach("phase-h-compatible-far-half-32.png", {
        body: await page.locator('canvas[aria-label="Native WebGPU aperture gather composite"]').screenshot(),
        contentType: "image/png",
      });
    }
  }

  const diagonal = await run(page, "Phase H diagonal edge");
  assertNativeSampling(diagonal);
  expect(diagonal.phaseH?.execution.edgeCase).toBe("diagonal");
  expect(diagonal.phaseH?.cpuReference.gatherGpuVsCpu.maxRgbError).toBeLessThan(0.04);
  const thin = await run(page, "Phase H thin foreground");
  assertNativeSampling(thin);
  expect(thin.phaseH?.execution.edgeCase).toBe("thin");
  expect(thin.phaseH?.leakage.candidate).not.toBeNull();
  const cropped = await run(page, "Phase H tilted off-center crop");
  assertNativeSampling(cropped);
  expect(cropped.dimensions?.sampledFilmWidthMm).toBeCloseTo(9, 5);
  expect(cropped.dimensions?.sampledFilmHeightMm).toBeCloseTo(6, 5);

  const performanceOrder = [false, true, true, false, true, false, false, true, false, true, true, false, true, false] as const;
  const performance: Array<{ candidate: boolean; operationId: string; timing: NonNullable<Handle["operations"][number]["timing"]> }> = [];
  for (const candidate of performanceOrder) {
    const handle = await run(page, candidate
      ? "Phase H benchmark candidate half ×32"
      : "Phase H benchmark baseline half ×32");
    const operation = handle.operations.at(-1);
    expect(operation?.timing).not.toBeNull();
    performance.push({ candidate, operationId: operation!.operationId, timing: operation!.timing! });
  }
  const warmupCounts = { baseline: 0, candidate: 0 };
  const measured = performance.filter((entry) => {
    const key = entry.candidate ? "candidate" : "baseline";
    if (warmupCounts[key] < 2) {
      warmupCounts[key] += 1;
      return false;
    }
    return true;
  });
  expect(warmupCounts).toEqual({ baseline: 2, candidate: 2 });
  expect(measured.filter((entry) => !entry.candidate)).toHaveLength(5);
  expect(measured.filter((entry) => entry.candidate)).toHaveLength(5);
  const summarize = (values: number[]) => ({
    count: values.length,
    median: [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)],
    samples: values,
  });
  const performanceSummary = {
    timingSemantics: "CPU submission and observed queue completion wall intervals; no isolated GPU timestamp query; not production FPS",
    order: performance,
    baselineOperationWallMs: summarize(measured.filter((entry) => !entry.candidate).map((entry) => entry.timing.operationWallTimeMs)),
    candidateOperationWallMs: summarize(measured.filter((entry) => entry.candidate).map((entry) => entry.timing.operationWallTimeMs)),
    candidatePassSubmissionMs: summarize(measured.filter((entry) => entry.candidate).flatMap((entry) => entry.timing.stages
      .filter((stage) => stage.stage === "phase-h-compatible-far-reconstruction" || stage.stage === "phase-h-candidate-composite")
      .map((stage) => stage.cpuSubmissionTimeMs))),
    candidatePassObservedQueueCompletionMs: summarize(measured.filter((entry) => entry.candidate).flatMap((entry) => entry.timing.stages
      .filter((stage) => stage.stage === "phase-h-compatible-far-reconstruction" || stage.stage === "phase-h-candidate-composite")
      .map((stage) => stage.observedQueueCompletionMs ?? 0))),
    gpuTimestampDurationMs: null,
  };

  const beforeFailure = await activeHandle(page);
  await page.getByRole("button", { name: "Phase H fail after reconstruction", exact: true }).click();
  await expect.poll(async () => {
    const handle = (await diagnostics(page)).handles.find((candidate) => candidate.instanceId === beforeFailure.instanceId);
    return Boolean(handle?.state === "disposed" && handle.resources.every((resource) => resource.state === "disposed"));
  }, { timeout: 120_000, intervals: [100, 250, 500] }).toBe(true);
  const failedHandle = (await diagnostics(page)).handles.find((candidate) => candidate.instanceId === beforeFailure.instanceId)!;
  expect(failedHandle.operations.at(-1)?.state).toBe("failed");
  expect(failedHandle.passes.find((pass) => pass.id === "phase-h-compatible-far-reconstruction")?.state).toBe("completed");
  expect(failedHandle.cleanupError).toBeNull();
  await page.getByRole("link", { name: "Navigate away (SPA)" }).click();
  await expect(page.getByTestId("away-route")).toBeVisible();
  await page.getByRole("link", { name: "Return to experiment (SPA)" }).click();
  const remounted = await waitForInitial(page);
  expect(remounted.instanceId).not.toBe(beforeFailure.instanceId);
  assertNative(remounted);
  assertNativeSampling(remounted);

  await writeArtifact(testInfo, "phase-h-native-diagnostics.json", {
    schemaVersion: 1,
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    runtime: remounted.runtime,
    baselineAndCandidate: results.map(({ config, handle }) => ({ config, instanceId: handle.instanceId, generation: handle.generation, dimensions: handle.dimensions, phaseH: handle.phaseH })),
    edgeCases: { diagonal: diagonal.phaseH, thin: thin.phaseH, tiltedCrop: cropped.phaseH },
    performanceSummary,
    lifecycle: {
      failedCandidatePassHandle: beforeFailure.instanceId,
      failedOperation: failedHandle.operations.at(-1),
      ownedResourcesDisposed: failedHandle.resources.every((resource) => resource.state === "disposed"),
      remountedHandle: remounted.instanceId,
    },
  });
});
