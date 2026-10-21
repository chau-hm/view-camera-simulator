import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  APERTURE_GATHER_CASES,
  requireGatherReferenceProbePair,
  referenceGatherProbe,
  type GatherReferenceProbe,
} from "./fixtures/ground-glass-webgpu-aperture-gather-cases";
import {
  GATHER_QUALITY_MATRIX,
  summarizeMeasurements,
} from "./fixtures/ground-glass-webgpu-gather-quality-cases";

const FIXTURE_PATH = "/src/tests/e2e/fixtures/ground-glass-webgpu-aperture-gather.html?phaseG=1";
const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";

type RuntimeEvidence = {
  rendererFamily: string;
  executionBackend: string;
  applicationFallback: boolean;
  initialized: boolean;
  threeRevision: string;
};
type Timing = {
  operationWallTimeMs: number;
  readbackWallTimeMs: number | null;
  renderTargetResizeWallTimeMs: number;
  stages: Array<{
    stage: string;
    cpuSubmissionTimeMs: number;
    observedQueueCompletionMs: number | null;
    queueWaitAfterSubmissionMs: number | null;
  }>;
  gpuTimestampDurationMs: null;
};
type Handle = {
  instanceId: string;
  generation: number;
  state: string;
  runtime: RuntimeEvidence | null;
  dimensions: null | {
    sourceWidthPx: number;
    sourceHeightPx: number;
    physicalCocWidthPx: number;
    physicalCocHeightPx: number;
    farGatherWidthPx: number;
    farGatherHeightPx: number;
    nearGatherWidthPx: number;
    nearGatherHeightPx: number;
    compositeWidthPx: number;
    compositeHeightPx: number;
    sampledFilmWidthMm: number;
    sampledFilmHeightMm: number;
    focusOffsetMm: number;
    quality: string;
    sampleCount: number;
    maximumCoCRadiusPx: number;
    gatherScale: number;
    scene: string;
  };
  sceneProvenance: null | {
    scenarioId: string;
    geometrySource: string;
    placementAdaptation: string;
    proxyScale: number;
    canonicalOpticsReused: boolean;
  };
  metrics: null | {
    rawRedPixelCount: number;
    compositeRedPixelCount: number;
    nearSpreadPixelGain: number;
    rawYellowPixelCount: number;
    compositeYellowPixelCount: number;
    farSpreadPixelGain: number;
    farYellowSignalOutsideBluePixelCount: number;
    farYellowSignalOutsideBlueEnergy: number;
    nearRedSpreadOutsideSharpPixelCount: number;
    nearBlueBackgroundLeakPixelCount: number;
    farRedForegroundLeakPixelCount: number;
    farRedForegroundLeakEnergy: number;
    farNativeTargetRedForegroundLeakPixelCount: number;
    farNativeTargetRedForegroundLeakEnergy: number;
    compositeRedForegroundLeakPixelCount: number;
    compositeRedForegroundLeakEnergy: number;
    blueBackgroundPixelCount: number;
    farRedForegroundLeakFraction: number;
    meanFarLeakDistanceToForegroundPx: number;
    maximumFarLeakDistanceToForegroundPx: number;
    nonzeroNearAlphaPixels: number;
    validPhysicalPixelCount: number;
    noDepthPixelCount: number;
    invalidPhysicalPixelCount: number;
    unresolvedPixelCount: number;
    nearSidePixelCount: number;
    farSidePixelCount: number;
    maximumAbsSignedCoCMm: number;
    maximumPhysicalAxisMm: number;
  };
  pointProbes: Array<{
    id: string;
    worldPositionErrorMm: number;
    gpuDepth: number;
    worldPositionMm: [number, number, number];
    physicalRgba16Float: [number, number, number, number];
    validityCode: number;
  }>;
  gatherReferenceProbes: GatherReferenceProbe[];
  sampleDiagnostics: null | {
    referencePixelRole: string;
    physicalMajorRadiusMm: number;
    physicalMinorRadiusMm: number;
    physicalOrientationRad: number;
    pixelMajorVectorPx: [number, number];
    pixelMinorVectorPx: [number, number];
    cpuReference: {
      maximumTransformedEllipseRadiusPx: number;
      rendererMaximumRadiusPx: number;
      clampScale: number;
      maximumClampedEllipseRadiusPx: number;
      sampleCount: number;
    };
    gpu: {
      maximumTransformedEllipseRadiusPx: number;
      rendererMaximumRadiusPx: number;
      clampScale: number;
      maximumClampedEllipseRadiusPx: number;
    };
  };
  targetResizeCount: number;
  targetMemoryEstimate: null | {
    sourcePixels: number;
    gatherPixels: number;
    estimatedBytes: number;
    estimatedMiB: number;
    includes: string[];
  };
  operations: Array<{
    operationId: string;
    kind: string;
    state: string;
    stage: string;
    completedAt: number | null;
    resultPublished: boolean;
    readbackStarted: boolean;
    readbackOutcome: string;
    error: string | null;
    timing: Timing | null;
  }>;
  passes: Array<{ id: string; state: string; error: string | null }>;
  resources: Array<{ id: string; role: string; state: string; error: string | null }>;
  formats: Record<string, { requested: string; actual: string | null }> | null;
  error: string | null;
  cleanupError: string | null;
  cleanupCompletedAt: number | null;
};
type Diagnostics = { status: string; activeHandleId: string | null; handles: Handle[] };

const readDiagnostics = async (page: Page): Promise<Diagnostics> => {
  const text = await page.getByTestId("fixture-diagnostics").textContent();
  if (!text) throw new Error("Phase G diagnostics are not available");
  return JSON.parse(text) as Diagnostics;
};

const activeHandle = async (page: Page): Promise<Handle> => {
  const diagnostics = await readDiagnostics(page);
  const handle = diagnostics.handles.find((entry) => entry.instanceId === diagnostics.activeHandleId);
  if (!handle) throw new Error("Phase G has no active renderer handle");
  return handle;
};

const waitForInitialRender = async (page: Page): Promise<Handle> => {
  await expect.poll(async () => {
    const diagnostics = await readDiagnostics(page);
    const handle = diagnostics.handles.find((entry) => entry.instanceId === diagnostics.activeHandleId);
    return Boolean(
      handle?.state === "active"
      && handle.operations.at(-1)?.state === "completed"
      && handle.operations.at(-1)?.resultPublished
      && handle.passes.some((pass) => pass.id === "display-pass" && pass.state === "completed"),
    );
  }, { timeout: 180_000, intervals: [100, 250, 500] }).toBe(true);
  return activeHandle(page);
};

const runButton = async (page: Page, name: string, instanceId: string, timeoutMs = 180_000): Promise<Handle> => {
  const previous = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === instanceId);
  if (!previous) throw new Error(`Missing renderer handle ${instanceId} before ${name}`);
  const previousCount = previous.operations.length;
  const previousOperationId = previous.operations.at(-1)?.operationId;
  await page.getByRole("button", { name }).click();
  await expect.poll(async () => {
    const handle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === instanceId);
    const operation = handle?.operations.at(-1);
    return Boolean(
      handle?.state === "active"
      && handle.operations.length === previousCount + 1
      && operation?.operationId !== previousOperationId
      && operation?.state === "completed"
      && operation.resultPublished
      && operation.readbackOutcome === "succeeded"
      && operation.timing
      && handle.passes.some((pass) => pass.id === "display-pass" && pass.state === "completed"),
    );
  }, { timeout: timeoutMs, intervals: [100, 250, 500, 1000] }).toBe(true);
  const handle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === instanceId);
  if (!handle) throw new Error(`Renderer handle ${instanceId} disappeared after ${name}`);
  return handle;
};

const captureCanvas = async (page: Page, testInfo: TestInfo, name: string) => {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await testInfo.attach(name, {
    body: await page.locator('canvas[aria-label="Native WebGPU aperture gather composite"]').screenshot(),
    contentType: "image/png",
  });
};

const metricsSnapshot = (handle: Handle) => {
  if (!handle.dimensions || !handle.metrics || !handle.sampleDiagnostics || !handle.targetMemoryEstimate) {
    throw new Error(`Incomplete Phase G result for ${handle.instanceId}`);
  }
  const operation = handle.operations.at(-1);
  if (!operation?.timing) throw new Error(`Missing timing for ${operation?.operationId ?? "last operation"}`);
  return {
    instanceId: handle.instanceId,
    operationId: operation.operationId,
    dimensions: handle.dimensions,
    sceneProvenance: handle.sceneProvenance,
    metrics: handle.metrics,
    sampleDiagnostics: handle.sampleDiagnostics,
    targetMemoryEstimate: handle.targetMemoryEstimate,
    timing: operation.timing,
    gatherReferenceProbes: handle.gatherReferenceProbes,
  };
};

const assertCpuGatherPair = (handle: Handle) => {
  const pair = requireGatherReferenceProbePair(handle.gatherReferenceProbes);
  const comparisons = [pair.far, pair.near].map((probe) => {
    const reference = referenceGatherProbe(probe);
    expect(reference.maxRgbError, `${probe.layer} ${probe.sampleCount}-sample CPU-reference RGB error`).toBeLessThan(0.04);
    expect(reference.alphaError, `${probe.layer} ${probe.sampleCount}-sample CPU-reference coverage error`).toBeLessThan(0.025);
    expect(probe.patch.width * probe.patch.height).toBeGreaterThan(0);
    return { layer: probe.layer, x: probe.x, y: probe.y, actualRgba: probe.actualRgba, ...reference };
  });
  const farCenter = pair.far.patch.colors[(pair.far.y - pair.far.patch.top) * pair.far.patch.width + pair.far.x - pair.far.patch.left];
  const nearCenter = pair.near.patch.colors[(pair.near.y - pair.near.patch.top) * pair.near.patch.width + pair.near.x - pair.near.patch.left];
  expect(farCenter?.[2], "far reference probe starts in a blue background region").toBeGreaterThan(0.5);
  expect(pair.far.actualRgba[0] - (farCenter?.[0] ?? 1), "far reference probe contains nontrivial foreground color contribution").toBeGreaterThan(0.005);
  expect(nearCenter, "near reference probe includes a captured source center").toBeDefined();
  expect(pair.near.actualRgba[3], "near reference probe has nonzero coverage").toBeGreaterThan(0.02);
  expect(pair.near.actualRgba[0], "near reference probe contains foreground red").toBeGreaterThan(0.5);
  return { probes: pair, comparisons };
};

const summarizeStageTimings = (handles: readonly Handle[]) => {
  const timings = handles.map((handle) => handle.operations.at(-1)?.timing).filter((timing): timing is Timing => timing !== null && timing !== undefined);
  const stages = ["scene-color-depth", "physical-coc-and-validity", "far-gather", "near-gather", "research-composite", "display-pass"];
  return {
    operationWallTimeMs: summarizeMeasurements(timings.map((timing) => timing.operationWallTimeMs)),
    readbackWallTimeMs: summarizeMeasurements(timings.map((timing) => timing.readbackWallTimeMs ?? 0)),
    renderTargetResizeWallTimeMs: summarizeMeasurements(timings.map((timing) => timing.renderTargetResizeWallTimeMs)),
    stages: Object.fromEntries(stages.map((stage) => {
      const stageRuns = timings.flatMap((timing) => timing.stages.filter((entry) => entry.stage === stage));
      return [stage, {
        cpuSubmissionTimeMs: summarizeMeasurements(stageRuns.map((entry) => entry.cpuSubmissionTimeMs)),
        observedQueueCompletionMs: summarizeMeasurements(stageRuns.map((entry) => entry.observedQueueCompletionMs ?? 0)),
        queueWaitAfterSubmissionMs: summarizeMeasurements(stageRuns.map((entry) => entry.queueWaitAfterSubmissionMs ?? 0)),
      }];
    })),
    gpuTimestampDurationMs: null,
  };
};

const assertNativeRuntime = (handle: Handle) => {
  expect(handle.runtime).toMatchObject({
    rendererFamily: "webgpu-renderer",
    executionBackend: "webgpu",
    applicationFallback: false,
    initialized: true,
    threeRevision: "186",
  });
};

const writeRunArtifact = async (testInfo: TestInfo, result: Record<string, unknown>, runId: string) => {
  const filename = `ground-glass-webgpu-gather-quality-${runId}.json`;
  const destination = testInfo.outputPath(filename);
  await mkdir(testInfo.outputDir, { recursive: true });
  await writeFile(destination, JSON.stringify(result, null, 2));
  await testInfo.attach(filename, {
    path: destination,
    contentType: "application/json",
  });
};

test("Phase G ordinary Chromium compatibility control does not claim native execution", async ({ page }) => {
  test.skip(nativeWebGpuRequired, "Fallback-compatible browser control runs in the ordinary Chromium project");
  test.setTimeout(180_000);
  await page.goto(FIXTURE_PATH);
  await expect(page.getByTestId("phase-g-controls")).toBeVisible();
  const handle = await waitForInitialRender(page);
  expect(handle.runtime?.initialized).toBe(true);
  expect(handle.runtime?.threeRevision).toBe("186");
  expect(handle.dimensions).toMatchObject({ sourceWidthPx: 128, sourceHeightPx: 96 });
  expect(handle.metrics?.validPhysicalPixelCount).toBeGreaterThan(0);
  await captureCanvas(page, test.info(), "phase-g-ordinary-chromium-control.png");
});

test("native Phase G factorial gather-quality study, scaling, caps, scene proxies, and lifecycle", async ({ page }) => {
  test.skip(!nativeWebGpuRequired, "Native WebGPU quality and performance evidence requires headed Chrome");
  test.setTimeout(1_200_000);
  const gitCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const runId = `${gitCommit.slice(0, 12)}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const artifact: Record<string, unknown> = {
    schemaVersion: 1,
    status: "partially complete",
    runId,
    gitCommit,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      browser: null,
      threeRevision: "186",
      rendererFamily: null,
      executionBackend: null,
      applicationFallback: null,
      adapterInfo: "not exposed by this fixture",
      hardwareAcceleration: "not established",
    },
    runtime: { source: "native-required headed Chrome Playwright project" },
    scene: { id: "phase-f-controlled", provenance: "unchanged Phase F four-plane geometry" },
    optics: { focalLengthMm: APERTURE_GATHER_CASES.focalLengthMm, phaseFBaselineApertureFNumber: 2, factorialApertureFNumber: 1, sampledFilmMm: [36, 24] },
    configuration: { factorial: [], sourceScaling: [], radiusCaps: [], representativeScenes: [] },
    qualityMetrics: {},
    performanceMetrics: { timingClass: "CPU submission, observed queue completion, readback wall time, and operation wall time; GPU timestamps unavailable" },
    resourceEstimates: {},
    lifecycle: {},
    limitations: [
      "The 64-sample render is a high-sample numerical comparison reference, not photographic ground truth.",
      "Architecture Rise and Interior Corner subjects are authentic factory geometry uniformly scaled and recentered into the controlled optical volume; their production optical states are not reused.",
      "The Macro Depth of Field factory adaptation was attempted but produced no rasterized depth in this host and is excluded; macro coverage remains incomplete.",
      "No hardware-acceleration or GPU shader execution time claim is made.",
      "The study does not validate production WebGL parity, Image Circle, lighting or production Ground Glass integration.",
    ],
    errors: [],
  };
  let currentHandleId: string | null = null;
  let nativeRuntimeObserved = false;
  let runSucceeded = false;
  try {
    await page.goto(FIXTURE_PATH);
    await expect(page.getByTestId("phase-g-controls")).toBeVisible();
    const initial = await waitForInitialRender(page);
    currentHandleId = initial.instanceId;
    assertNativeRuntime(initial);
    nativeRuntimeObserved = true;
    const browserInfo = await page.evaluate(() => ({ userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language }));
    const environment = artifact.environment as Record<string, unknown>;
    Object.assign(environment, browserInfo, initial.runtime);
    artifact.runtime = {
      source: "native-required headed Chrome Playwright project",
      coldInitializationOperationId: initial.operations.at(-1)?.operationId,
      initialOperationTiming: initial.operations.at(-1)?.timing,
      nativeIdentity: initial.runtime,
    };
    const documentToken = await page.evaluate(() => {
      document.documentElement.dataset.phaseGDocumentToken ??= crypto.randomUUID();
      return document.documentElement.dataset.phaseGDocumentToken;
    });

    const afterAperture = await runButton(page, "Aperture f/2", initial.instanceId);
    assertNativeRuntime(afterAperture);
    const baselineStandard = await runButton(page, "Standard gather", initial.instanceId);
    const baselineLow = await runButton(page, "Low resolution gather", initial.instanceId);
    expect(baselineStandard.dimensions).toMatchObject({ gatherScale: 1, sampleCount: 32, maximumCoCRadiusPx: 12 });
    expect(baselineLow.dimensions).toMatchObject({ gatherScale: 0.5, sampleCount: 16, maximumCoCRadiusPx: 12 });
    expect(baselineStandard.metrics?.farRedForegroundLeakPixelCount).toBe(0);
    expect(baselineLow.metrics?.farRedForegroundLeakPixelCount).toBe(36);
    await captureCanvas(page, test.info(), "phase-g-phase-f-standard-baseline.png");
    const phaseFBaseline = {
      originalSourceDimensions: [128, 96],
      apertureFNumber: 2,
      standard: metricsSnapshot(baselineStandard),
      low: metricsSnapshot(baselineLow),
      matchedHistoricalCounts: {
        standardFarForegroundLeakPixels: baselineStandard.metrics?.farRedForegroundLeakPixelCount === 0,
        lowFarForegroundLeakPixels: baselineLow.metrics?.farRedForegroundLeakPixelCount === 36,
      },
    };
    artifact.scene = phaseFBaseline;

    await runButton(page, "Aperture f/1", initial.instanceId);
    const factorial: Array<Record<string, unknown>> = [];
    let referencePhysical: [number, number, number, number] | null = null;
    for (const cell of GATHER_QUALITY_MATRIX) {
      const buttonName = `${cell.gatherScale === 1 ? "Full" : "Half"} gather × ${cell.sampleCount}`;
      const warmups: Handle[] = [];
      const measured: Handle[] = [];
      for (let iteration = 0; iteration < 7; iteration += 1) {
        const handle = await runButton(page, buttonName, initial.instanceId);
        assertNativeRuntime(handle);
        expect(handle.dimensions).toMatchObject({
          sourceWidthPx: 128,
          sourceHeightPx: 96,
          gatherScale: cell.gatherScale,
          sampleCount: cell.sampleCount,
          maximumCoCRadiusPx: 12,
          scene: "phase-f-controlled",
        });
        const yellow = handle.pointProbes.find((probe) => probe.id === "far-yellow-feature");
        expect(yellow?.validityCode).toBe(1);
        expect(yellow?.physicalRgba16Float[0]).toBeGreaterThan(0);
        if (cell.gatherScale === 1) {
          const cpu = assertCpuGatherPair(handle);
          if (cell.sampleCount === 64) {
            expect(cpu.probes.far.sampleCount).toBe(64);
            expect(cpu.probes.near.sampleCount).toBe(64);
            expect(cpu.probes.far.actualRgba[0] - cpu.probes.far.patch.colors[(cpu.probes.far.y - cpu.probes.far.patch.top) * cpu.probes.far.patch.width + cpu.probes.far.x - cpu.probes.far.patch.left]![0]).toBeGreaterThan(0.005);
          }
        }
        const physical = yellow!.physicalRgba16Float;
        if (referencePhysical === null) referencePhysical = [...physical];
        else physical.forEach((value, index) => expect(value, `physical point probe channel ${index} invariant across gather settings`).toBeCloseTo(referencePhysical![index]!, 4));
        if (iteration < 2) warmups.push(handle);
        else measured.push(handle);
        if (iteration === 6) await captureCanvas(page, test.info(), `phase-g-${cell.id}.png`);
      }
      const representative = measured.at(-1)!;
      const sampleDiag = representative.sampleDiagnostics!;
      expect(sampleDiag.referencePixelRole).toBe("far-gather-probe");
      expect(sampleDiag.cpuReference.sampleCount).toBe(cell.sampleCount);
      expect(Math.abs(sampleDiag.cpuReference.maximumTransformedEllipseRadiusPx - sampleDiag.gpu.maximumTransformedEllipseRadiusPx)).toBeLessThan(0.05);
      expect(Math.abs(sampleDiag.cpuReference.clampScale - sampleDiag.gpu.clampScale)).toBeLessThan(0.005);
      expect(sampleDiag.gpu.maximumClampedEllipseRadiusPx).toBeLessThanOrEqual(12.02);
      const farReference = cell.gatherScale === 1 ? referenceGatherProbe(requireGatherReferenceProbePair(representative.gatherReferenceProbes).far) : null;
      const nearReference = cell.gatherScale === 1 ? referenceGatherProbe(requireGatherReferenceProbePair(representative.gatherReferenceProbes).near) : null;
      factorial.push({
        id: cell.id,
        apertureFNumber: 1,
        warmupOperationIds: warmups.map((handle) => handle.operations.at(-1)?.operationId),
        measured: measured.map(metricsSnapshot),
        cpuReference: { far: farReference, near: nearReference },
        performance: summarizeStageTimings(measured),
        qualitySummary: {
          meanFarUpsampledRedLeakPixels: summarizeMeasurements(measured.map((handle) => handle.metrics!.farRedForegroundLeakPixelCount)),
          meanFarUpsampledRedLeakEnergy: summarizeMeasurements(measured.map((handle) => handle.metrics!.farRedForegroundLeakEnergy)),
          meanFarNativeTargetRedLeakPixels: summarizeMeasurements(measured.map((handle) => handle.metrics!.farNativeTargetRedForegroundLeakPixelCount)),
          meanCompositeRedLeakPixels: summarizeMeasurements(measured.map((handle) => handle.metrics!.compositeRedForegroundLeakPixelCount)),
          meanNearBlueLeakPixels: summarizeMeasurements(measured.map((handle) => handle.metrics!.nearBlueBackgroundLeakPixelCount)),
          meanNearSpreadPixels: summarizeMeasurements(measured.map((handle) => handle.metrics!.nearRedSpreadOutsideSharpPixelCount)),
          meanFarYellowSignalEnergy: summarizeMeasurements(measured.map((handle) => handle.metrics!.farYellowSignalOutsideBlueEnergy)),
          meanFarLeakDistancePx: summarizeMeasurements(measured.map((handle) => handle.metrics!.meanFarLeakDistanceToForegroundPx)),
        },
      });
      artifact.configuration = { factorial: [...factorial], sourceScaling: [], radiusCaps: [], representativeScenes: [] };
      artifact.qualityMetrics = { factorial: factorial.map((entry) => ({ id: entry.id, qualitySummary: entry.qualitySummary, cpuReference: entry.cpuReference })) };
      artifact.performanceMetrics = { timingClass: "CPU submission, observed queue completion, readback wall time, and operation wall time; gpuTimestampDurationMs=null", factorial: factorial.map((entry) => ({ id: entry.id, summary: entry.performance })) };
    }
    expect(factorial).toHaveLength(6);
    const baseResources = initial.resources.map((resource) => resource.id);
    expect(new Set(baseResources).size).toBe(baseResources.length);
    const currentAfterMatrix = await activeHandle(page);
    expect(currentAfterMatrix.resources.map((resource) => resource.id)).toEqual(baseResources);
    expect(currentAfterMatrix.targetResizeCount).toBe(14); // Seven half/full switches × two gather targets; resource identities remain stable.

    const sourceScaling: Array<Record<string, unknown>> = [];
    let scalingPhysical: [number, number, number, number] | null = null;
    for (const size of [
      { label: "Source 128 × 96", width: 128, height: 96 },
      { label: "Source 512 × 384", width: 512, height: 384 },
      { label: "Source 256 × 192", width: 256, height: 192 },
    ]) {
      const measured: Handle[] = [];
      const warmups: Handle[] = [];
      for (let iteration = 0; iteration < 7; iteration += 1) {
        const handle = await runButton(page, size.label, initial.instanceId, 240_000);
        expect(handle.dimensions).toMatchObject({ sourceWidthPx: size.width, sourceHeightPx: size.height, gatherScale: 1, sampleCount: 32, maximumCoCRadiusPx: 60 });
        const yellow = handle.pointProbes.find((probe) => probe.id === "far-yellow-feature");
        expect(yellow?.validityCode).toBe(1);
        const physical = yellow!.physicalRgba16Float;
        if (scalingPhysical === null) scalingPhysical = [...physical];
        else physical.forEach((value, index) => expect(value, `physical millimetre channel ${index} invariant at ${size.width}×${size.height}`).toBeCloseTo(scalingPhysical![index]!, 4));
        if (iteration < 2) warmups.push(handle);
        else measured.push(handle);
        if (iteration === 6) await captureCanvas(page, test.info(), `phase-g-source-${size.width}x${size.height}.png`);
      }
      sourceScaling.push({
        resolution: [size.width, size.height],
        warmupOperationIds: warmups.map((handle) => handle.operations.at(-1)?.operationId),
        measured: measured.map(metricsSnapshot),
        performance: summarizeStageTimings(measured),
        pixelFootprintScaling: measured.map((handle) => ({
          maximumTransformedEllipseRadiusPx: handle.sampleDiagnostics!.gpu.maximumTransformedEllipseRadiusPx,
          physicalMajorRadiusMm: handle.sampleDiagnostics!.physicalMajorRadiusMm,
          physicalMinorRadiusMm: handle.sampleDiagnostics!.physicalMinorRadiusMm,
        })),
        targetMemoryEstimate: measured.at(-1)?.targetMemoryEstimate,
        targetResizeCount: measured.at(-1)?.targetResizeCount,
      });
      artifact.configuration = { factorial, sourceScaling: [...sourceScaling], radiusCaps: [], representativeScenes: [] };
    }
    const scalingRadiusByWidth = new Map(sourceScaling.map((entry) => [
      (entry.resolution as number[])[0]!,
      (entry.pixelFootprintScaling as Array<{ maximumTransformedEllipseRadiusPx: number }>)[0]!.maximumTransformedEllipseRadiusPx,
    ]));
    expect(scalingRadiusByWidth.get(256)! / scalingRadiusByWidth.get(128)!).toBeGreaterThan(1.7);
    expect(scalingRadiusByWidth.get(256)! / scalingRadiusByWidth.get(128)!).toBeLessThan(2.3);
    expect(scalingRadiusByWidth.get(512)! / scalingRadiusByWidth.get(128)!).toBeGreaterThan(3.4);
    expect(scalingRadiusByWidth.get(512)! / scalingRadiusByWidth.get(128)!).toBeLessThan(4.6);

    const radiusCaps: Array<Record<string, unknown>> = [];
    const capRuns = new Map<number, { warmups: Handle[]; measured: Handle[] }>([
      [24, { warmups: [], measured: [] }],
      [60, { warmups: [], measured: [] }],
    ]);
    for (let iteration = 0; iteration < 7; iteration += 1) {
      const capOrder = iteration % 2 === 0 ? [24, 60] : [60, 24];
      for (const cap of capOrder) {
        const handle = await runButton(page, `512 crop / cap ${cap}`, initial.instanceId, 240_000);
        expect(handle.dimensions).toMatchObject({ sourceWidthPx: 512, sourceHeightPx: 384, sampledFilmWidthMm: 9, sampledFilmHeightMm: 6, sampleCount: 64, maximumCoCRadiusPx: cap });
        const yellow = handle.pointProbes.find((probe) => probe.id === "far-yellow-feature");
        expect(yellow?.validityCode).toBe(1);
        const current = capRuns.get(cap)!;
        if (iteration < 2) current.warmups.push(handle);
        else current.measured.push(handle);
        if (iteration === 6) await captureCanvas(page, test.info(), `phase-g-cap-${cap}.png`);
      }
    }
    const physicalByCap = new Map<number, [number, number, number, number]>();
    for (const cap of [24, 60]) {
      const { warmups, measured } = capRuns.get(cap)!;
      const last = measured.at(-1)!;
      const diagnostics = last.sampleDiagnostics!;
      expect(diagnostics.gpu.rendererMaximumRadiusPx).toBe(cap);
      expect(diagnostics.gpu.maximumClampedEllipseRadiusPx).toBeLessThanOrEqual(cap + 0.02);
      if (cap === 24) expect(diagnostics.gpu.clampScale).toBeLessThan(0.999);
      else expect(diagnostics.gpu.clampScale).toBeGreaterThanOrEqual(0.999);
      const yellow = last.pointProbes.find((probe) => probe.id === "far-yellow-feature");
      if (!yellow) throw new Error(`Missing physical point for cap-${cap} comparison`);
      physicalByCap.set(cap, [...yellow.physicalRgba16Float]);
      radiusCaps.push({
        cap,
        warmupOperationIds: warmups.map((handle) => handle.operations.at(-1)?.operationId),
        measured: measured.map(metricsSnapshot),
        performance: summarizeStageTimings(measured),
        capActive: diagnostics.gpu.clampScale < 0.999,
        clampScale: diagnostics.gpu.clampScale,
      });
      artifact.configuration = { factorial, sourceScaling, radiusCaps: [...radiusCaps], representativeScenes: [] };
    }
    const physicalAtCap24 = physicalByCap.get(24);
    const physicalAtCap60 = physicalByCap.get(60);
    if (!physicalAtCap24 || !physicalAtCap60) throw new Error("Missing physical point for cap comparison");
    physicalAtCap60.forEach((value, index) => expect(value, `physical channel ${index} is independent of the radius cap`).toBeCloseTo(physicalAtCap24[index]!, 4));

    const representativeScenes: Array<Record<string, unknown>> = [];
    for (const sceneCase of [
      { scene: "architecture-rise-geometry-proxy", button: "Architecture Rise geometry proxy" },
      { scene: "interior-corner-geometry-proxy", button: "Interior Corner geometry proxy" },
    ]) {
      const handle = await runButton(page, sceneCase.button, initial.instanceId, 240_000);
      expect(handle.dimensions?.scene).toBe(sceneCase.scene);
      expect(handle.sceneProvenance).toMatchObject({ placementAdaptation: "uniform-scale-and-recenter", canonicalOpticsReused: false });
      expect(handle.metrics?.validPhysicalPixelCount).toBeGreaterThan(0);
      expect((handle.metrics?.nearSidePixelCount ?? 0) + (handle.metrics?.farSidePixelCount ?? 0)).toBeGreaterThan(0);
      expect(handle.formats?.sceneDepth?.actual).toBeTruthy();
      await captureCanvas(page, test.info(), `phase-g-${sceneCase.scene}.png`);
      representativeScenes.push({
        scene: sceneCase.scene,
        provenance: handle.sceneProvenance,
        dimensions: handle.dimensions,
        metrics: handle.metrics,
        timing: handle.operations.at(-1)?.timing,
        targetMemoryEstimate: handle.targetMemoryEstimate,
      });
      artifact.configuration = { factorial, sourceScaling, radiusCaps, representativeScenes: [...representativeScenes] };
    }
    const resourceIdsBeforeNavigation = currentAfterMatrix.resources.map((resource) => resource.id);
    const resourceCountBeforeNavigation = currentAfterMatrix.resources.length;
    const finalHandle = await activeHandle(page);
    expect(finalHandle.resources.map((resource) => resource.id)).toEqual(resourceIdsBeforeNavigation);
    expect(finalHandle.resources.length).toBe(resourceCountBeforeNavigation);
    const resizeCount = finalHandle.targetResizeCount;

    await page.getByRole("link", { name: "Navigate away (SPA)" }).click();
    await expect(page.getByTestId("away-route")).toBeVisible();
    await expect.poll(async () => (await readDiagnostics(page)).handles.find((handle) => handle.instanceId === initial.instanceId)?.state)
      .toBe("disposed");
    const retired = (await readDiagnostics(page)).handles.find((handle) => handle.instanceId === initial.instanceId);
    expect(retired?.resources.every((resource) => resource.state === "disposed")).toBe(true);
    expect(retired?.cleanupError).toBeNull();
    expect(retired?.cleanupCompletedAt).not.toBeNull();
    const tokenAfterUnmount = await page.evaluate(() => document.documentElement.dataset.phaseGDocumentToken);
    expect(tokenAfterUnmount).toBe(documentToken);
    await page.getByRole("link", { name: "Return to experiment (SPA)" }).click();
    await expect(page.getByRole("heading", { name: "Native WebGPU physical aperture gather" })).toBeVisible();
    const remounted = await waitForInitialRender(page);
    assertNativeRuntime(remounted);
    expect(remounted.instanceId).not.toBe(initial.instanceId);
    expect(remounted.metrics?.validPhysicalPixelCount).toBeGreaterThan(0);
    await page.getByRole("link", { name: "Navigate away (SPA)" }).click();
    await expect(page.getByTestId("away-route")).toBeVisible();
    await expect.poll(async () => (await readDiagnostics(page)).handles.find((handle) => handle.instanceId === remounted.instanceId)?.state)
      .toBe("disposed");
    const remountedRetired = (await readDiagnostics(page)).handles.find((handle) => handle.instanceId === remounted.instanceId);
    expect(remountedRetired?.resources.every((resource) => resource.state === "disposed")).toBe(true);

    artifact.status = "complete";
    artifact.scene = phaseFBaseline;
    artifact.configuration = { factorial, sourceScaling, radiusCaps, representativeScenes };
    artifact.qualityMetrics = {
      factorial: factorial.map((entry) => ({ id: entry.id, qualitySummary: entry.qualitySummary, cpuReference: entry.cpuReference })),
      phaseFBaseline: (phaseFBaseline as { matchedHistoricalCounts: Record<string, boolean> }).matchedHistoricalCounts,
    };
    artifact.performanceMetrics = {
      timingClass: "CPU submission, observed queue completion, readback wall time, and operation wall time; gpuTimestampDurationMs=null",
      factorial: factorial.map((entry) => ({ id: entry.id, summary: entry.performance })),
      sourceScaling: sourceScaling.map((entry) => ({ resolution: entry.resolution, summary: entry.performance })),
      radiusCaps: radiusCaps.map((entry) => ({ cap: entry.cap, summary: entry.performance })),
    };
    artifact.resourceEstimates = {
      sourceScaling: sourceScaling.map((entry) => ({ resolution: entry.resolution, estimate: entry.targetMemoryEstimate })),
      repeatedTargetResizes: resizeCount,
      ownedResourceCount: finalHandle.resources.length,
    };
    artifact.lifecycle = {
      retiredHandleId: retired?.instanceId,
      cleanupCompletedAt: retired?.cleanupCompletedAt,
      allOwnedResourcesDisposed: retired?.resources.every((resource) => resource.state === "disposed"),
      remountedHandleId: remounted.instanceId,
      remountedCleanupCompletedAt: remountedRetired?.cleanupCompletedAt,
      remountedAllOwnedResourcesDisposed: remountedRetired?.resources.every((resource) => resource.state === "disposed"),
      documentPreservedAcrossSpaNavigation: tokenAfterUnmount === documentToken,
    };
    runSucceeded = true;
  } catch (error) {
    (artifact.errors as string[]).push(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    artifact.status = nativeRuntimeObserved ? "measurement invalid" : "native unavailable";
    throw error;
  } finally {
    const status = artifact.status as string;
    if (!runSucceeded && nativeRuntimeObserved && status === "partially complete") artifact.status = "infrastructure failure";
    if (currentHandleId) {
      try {
        const current = (await readDiagnostics(page)).handles.find((handle) => handle.instanceId === currentHandleId);
        if (current) artifact.lastObservedHandle = metricsSnapshot(current);
      } catch (error) {
        (artifact.errors as string[]).push(`Final diagnostic read failed: ${String(error)}`);
      }
    }
    try {
      await writeRunArtifact(test.info(), artifact, runId);
    } catch (error) {
      (artifact.errors as string[]).push(`Run artifact write failed: ${String(error)}`);
    }
  }
});
