import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  GROUND_GLASS_PROFILING_WINDOW_SIZE,
} from "../../render/groundGlassProfiling";
import type {
  GroundGlassProfilingSnapshot,
  GroundGlassProfilingTimingStats,
} from "../../render/groundGlassProfiling";
import type {
  SceneCapacitySnapshot,
  SceneGraphCapacityMetrics,
} from "../../render/sceneCapacityProfiling";
import {
  classifyGraphicsBackend,
  type GraphicsBackendQualification,
} from "../../render/sceneCapacityBenchmarkQualification";
import {
  classifyGroundGlassProfilingReadiness,
  profilingProgressForSnapshot,
  selectQualifyingFreshSnapshot,
  type ProfilingProgressMarker,
} from "../helpers/sceneCapacityBenchmarkReadiness";
import {
  runtimeFromMeasurement,
  type BenchmarkRuntimeMetadata,
  type MeasurementStateEvidence,
} from "../helpers/sceneCapacityBenchmarkRuntime";

const benchmarkEnabled = process.env.SCENE_CAPACITY_BENCHMARK === "1";
const benchmarkOutputDirectory = process.env.SCENE_CAPACITY_BENCHMARK_OUTPUT_DIR ?? "test-results";
const productionPreview = process.env.SCENE_CAPACITY_PRODUCTION_PREVIEW === "1";
const MEASUREMENT_STATE_TIMEOUT_MS = 120_000;
const rawScenes = new Set([
  "focus-fundamentals-two-targets",
  "architecture-foreground",
  "interior-corner",
  "mirror-shift",
]);
const loupeScenes = new Set(["architecture-foreground", "interior-corner"]);
const benchmarkScenes = [
  "focus-fundamentals-two-targets",
  "table-tilt",
  "shelf-swing",
  "oblique-tabletop",
  "architecture-rise",
  "architecture-foreground",
  "oblique-architecture",
  "interior-corner",
  "mirror-shift",
] as const;

type BenchmarkMode = "processed" | "raw-rtt" | "processed-loupe";

type RequestedMeasurementState = {
  rawDebug: boolean;
  inspectionWindowActive: boolean;
};

type BenchmarkSamplingEvidence = {
  backend: "cpu-fallback" | "gpu-query";
  progressStart: number;
  progressEnd: number;
  freshSamples: number;
  windowSize: number;
  sessionResetsStart: number;
  sessionResetsEnd: number;
};

type BenchmarkRecord = {
  sceneId: string;
  mode: BenchmarkMode;
  snapshot: SceneCapacitySnapshot;
  sampling: BenchmarkSamplingEvidence;
  runtime: BenchmarkRuntimeMetadata;
};

type BenchmarkEnvironment = {
  commitSha: string | null;
  timestamp: string;
  viewport: { width: number; height: number };
  browserName: string;
  userAgent: string;
  devicePixelRatio: number;
  webgl: { vendor: string | null; renderer: string | null };
  profilingBackend: string | null;
  timingUnit: string | null;
  hardwareQualification: GraphicsBackendQualification & { required: boolean };
};

const timingStats = (
  snapshot: GroundGlassProfilingSnapshot | null,
  key: "groundGlassGpu" | "groundGlassCpuSubmit" | "physicalDofGpu" | "physicalDofCpuSubmit",
): GroundGlassProfilingTimingStats | null => snapshot?.[key] ?? null;

const passStats = (
  snapshot: GroundGlassProfilingSnapshot | null,
  pass: keyof NonNullable<GroundGlassProfilingSnapshot["passes"]>,
): GroundGlassProfilingTimingStats | null => snapshot?.passes?.[pass] ?? null;

const finiteMetricValues = (metrics: SceneGraphCapacityMetrics): number[] =>
  Object.values(metrics).filter((value): value is number => typeof value === "number");

const requiredPasses = (rawDebug: boolean): readonly (keyof NonNullable<GroundGlassProfilingSnapshot["passes"]>)[] =>
  rawDebug
    ? ["sceneRenderMs", "compositeMs"]
    : ["sceneRenderMs", "cocFootprintMs", "farGatherMs", "nearGatherMs", "compositeMs"];

const activeAggregateStats = (
  snapshot: GroundGlassProfilingSnapshot,
  aggregate: "groundGlass" | "physicalDof",
): GroundGlassProfilingTimingStats | null => {
  if (snapshot.profilingBackend === "gpu-query") {
    return aggregate === "groundGlass" ? snapshot.groundGlassGpu : snapshot.physicalDofGpu;
  }
  if (snapshot.profilingBackend === "cpu-fallback") {
    return aggregate === "groundGlass" ? snapshot.groundGlassCpuSubmit : snapshot.physicalDofCpuSubmit;
  }
  return null;
};

const assertBackendHealth = (snapshot: GroundGlassProfilingSnapshot): void => {
  const readiness = classifyGroundGlassProfilingReadiness(snapshot);
  if (readiness === "fatal") {
    throw new Error(`Scene capacity benchmark GPU timing degraded: ${snapshot.profilingDiagnostics.gpuQueryState}`);
  }
  if (readiness === "unavailable") {
    throw new Error(`Scene capacity benchmark has no active timing backend: ${snapshot.profilingBackend}`);
  }
};

const timingWindowsAreComplete = (
  snapshot: GroundGlassProfilingSnapshot,
  rawDebug: boolean,
): boolean => {
  const windowSize = GROUND_GLASS_PROFILING_WINDOW_SIZE;
  if (snapshot.frame.count < windowSize) return false;
  if (requiredPasses(rawDebug).some((pass) => (snapshot.passes[pass]?.count ?? 0) < windowSize)) {
    return false;
  }
  if ((activeAggregateStats(snapshot, "groundGlass")?.count ?? 0) < windowSize) return false;
  if (rawDebug) {
    return snapshot.passes.cocFootprintMs === null &&
      snapshot.passes.farGatherMs === null &&
      snapshot.passes.nearGatherMs === null &&
      snapshot.physicalDofGpu === null &&
      snapshot.physicalDofCpuSubmit === null;
  }
  return (activeAggregateStats(snapshot, "physicalDof")?.count ?? 0) >= windowSize;
};

const assertCapacitySnapshot = (
  snapshot: SceneCapacitySnapshot,
  sceneId: string,
  rawDebug: boolean,
): void => {
  expect(snapshot.sceneId).toBe(sceneId);
  expect(snapshot.viewportSubject).not.toBeNull();
  expect(snapshot.rttSubject).not.toBeNull();
  expect(snapshot.groundGlass).not.toBeNull();
  expect(finiteMetricValues(snapshot.viewportSubject as SceneGraphCapacityMetrics).every(Number.isFinite)).toBe(true);
  expect(finiteMetricValues(snapshot.rttSubject as SceneGraphCapacityMetrics).every(Number.isFinite)).toBe(true);
  expect(snapshot.frameCadence.count).toBeGreaterThanOrEqual(GROUND_GLASS_PROFILING_WINDOW_SIZE);
  expect(snapshot.groundGlass?.frame.count ?? 0).toBeGreaterThanOrEqual(GROUND_GLASS_PROFILING_WINDOW_SIZE);
  expect(timingWindowsAreComplete(snapshot.groundGlass as GroundGlassProfilingSnapshot, rawDebug)).toBe(true);
  expect(JSON.stringify(snapshot)).not.toMatch(/NaN|Infinity/);
};

const readCapacitySnapshot = async (page: Page): Promise<SceneCapacitySnapshot | null> => {
  const text = await page.getByTestId("scene-capacity-snapshot").textContent();
  if (!text || text.trim() === "null") return null;
  return JSON.parse(text) as SceneCapacitySnapshot;
};

const waitForMeasurementState = async (
  page: Page,
  sceneId: string,
  state: RequestedMeasurementState,
): Promise<MeasurementStateEvidence> => {
  const rtt = page.getByTestId("ground-glass-rtt");
  const loupeStage = page.locator("[data-focus-loupe-active]").first();
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", sceneId, {
    timeout: MEASUREMENT_STATE_TIMEOUT_MS,
  });
  const finalContentful = await rtt.getAttribute("data-rtt-final-contentful");
  let finalContentfulEvidence: boolean | null;
  if (productionPreview && finalContentful === null) {
    // Render-sanity readback is intentionally DEV-only. The production
    // preview still exposes the renderer-owned camera/readiness and profiler
    // progress attributes, which are the non-invasive readiness contract for
    // this hardware run.
    await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: MEASUREMENT_STATE_TIMEOUT_MS });
    await expect(rtt).toHaveAttribute("data-rtt-profiling-frame-count", /[1-9]\d*/, { timeout: MEASUREMENT_STATE_TIMEOUT_MS });
    finalContentfulEvidence = null;
  } else {
    await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: MEASUREMENT_STATE_TIMEOUT_MS });
    finalContentfulEvidence = true;
  }
  await expect(loupeStage).toHaveAttribute(
    "data-focus-loupe-active",
    String(state.inspectionWindowActive),
    { timeout: MEASUREMENT_STATE_TIMEOUT_MS },
  );
  await expect(rtt).toHaveAttribute(
    "data-rtt-inspection-window-active",
    String(state.inspectionWindowActive),
    { timeout: MEASUREMENT_STATE_TIMEOUT_MS },
  );
  await expect(rtt).toHaveAttribute(
    "data-rtt-profiling-raw-debug",
    String(state.rawDebug),
    { timeout: MEASUREMENT_STATE_TIMEOUT_MS },
  );
  return {
    finalContentful: finalContentfulEvidence,
    inspectionWindowActive: state.inspectionWindowActive,
  };
};

const readProgressMarker = (snapshot: SceneCapacitySnapshot | null): ProfilingProgressMarker | null => {
  const groundGlass = snapshot?.groundGlass;
  if (!groundGlass) return null;
  assertBackendHealth(groundGlass);
  if (groundGlass.profilingBackend !== "cpu-fallback" && groundGlass.profilingBackend !== "gpu-query") {
    return null;
  }
  const progress = profilingProgressForSnapshot(groundGlass);
  if (progress === null) return null;
  return {
    backend: groundGlass.profilingBackend,
    progress,
    sessionResets: groundGlass.profilingDiagnostics.sessionResets,
  };
};

const formatProfilingDiagnostics = (snapshot: SceneCapacitySnapshot | null): string => {
  const groundGlass = snapshot?.groundGlass;
  if (!groundGlass) return JSON.stringify({ groundGlass: null });
  const diagnostics = groundGlass.profilingDiagnostics;
  return JSON.stringify({
    sceneId: groundGlass.sceneId,
    rawDebug: groundGlass.rawDebug,
    profilingBackend: groundGlass.profilingBackend,
    timingUnit: groundGlass.timingUnit,
    gpuQueryState: diagnostics.gpuQueryState,
    frameCount: groundGlass.frame.count,
    framesAttempted: diagnostics.framesAttempted,
    framesAccepted: diagnostics.framesAccepted,
    framesCompletedGpu: diagnostics.framesCompletedGpu,
    framesRejectedCapacity: diagnostics.framesRejectedCapacity,
    framesInvalidated: diagnostics.framesInvalidated,
    pendingQueries: diagnostics.pendingQueries,
    pendingFrames: diagnostics.pendingFrames,
    queriesBegun: diagnostics.queriesBegun,
    queriesCompleted: diagnostics.queriesCompleted,
    queriesUnavailable: diagnostics.queriesUnavailable,
    sessionResets: diagnostics.sessionResets,
    lastResetReason: diagnostics.lastResetReason,
    lastRejectedReason: diagnostics.lastRejectedReason,
    lastGpuQueryError: diagnostics.lastGpuQueryError,
  });
};

const waitForProgressMarker = async (
  page: Page,
  sceneId: string,
  state: RequestedMeasurementState,
  timeoutMs = 120_000,
): Promise<ProfilingProgressMarker> => {
  const deadline = Date.now() + timeoutMs;
  let latestSnapshot: SceneCapacitySnapshot | null = null;
  while (Date.now() < deadline) {
    latestSnapshot = await readCapacitySnapshot(page);
    if (latestSnapshot?.sceneId === sceneId && latestSnapshot.groundGlass?.rawDebug === state.rawDebug) {
      const marker = readProgressMarker(latestSnapshot);
      if (marker !== null) return marker;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(
    `Timed out waiting for a profiling progress marker after ${timeoutMs}ms: ${formatProfilingDiagnostics(latestSnapshot)}`,
  );
};

type FreshSnapshotResult = {
  snapshot: SceneCapacitySnapshot;
  marker: ProfilingProgressMarker;
};

const waitForFreshSnapshot = async (
  page: Page,
  sceneId: string,
  state: RequestedMeasurementState,
  initialMarker: ProfilingProgressMarker,
  timeoutMs = 180_000,
): Promise<FreshSnapshotResult> => {
  const deadline = Date.now() + timeoutMs;
  let latestSnapshot: SceneCapacitySnapshot | null = null;

  while (Date.now() < deadline) {
    latestSnapshot = await readCapacitySnapshot(page);
    if (latestSnapshot?.sceneId === sceneId && latestSnapshot.groundGlass?.rawDebug === state.rawDebug) {
      const marker = readProgressMarker(latestSnapshot);
      const selected = selectQualifyingFreshSnapshot(
        [{ snapshot: latestSnapshot, marker }],
        ({ snapshot, marker: candidateMarker }) => {
          if (!snapshot.groundGlass) return false;
          if (candidateMarker.backend !== initialMarker.backend) return false;
          if (candidateMarker.sessionResets !== initialMarker.sessionResets) return false;
          if (candidateMarker.progress - initialMarker.progress < GROUND_GLASS_PROFILING_WINDOW_SIZE) {
            return false;
          }
          return timingWindowsAreComplete(snapshot.groundGlass, state.rawDebug);
        },
      );
      if (selected) return selected;
    }
    await page.waitForTimeout(250);
  }

  throw new Error(
    `Timed out waiting for a fresh profiling window after ${timeoutMs}ms: ${formatProfilingDiagnostics(latestSnapshot)}`,
  );
};

const waitForFreshStableSnapshot = async (
  page: Page,
  sceneId: string,
  state: RequestedMeasurementState,
): Promise<{
  snapshot: SceneCapacitySnapshot;
  sampling: BenchmarkSamplingEvidence;
  runtime: BenchmarkRuntimeMetadata;
}> => {
  const measurementState = await waitForMeasurementState(page, sceneId, state);
  const initialMarker = await waitForProgressMarker(page, sceneId, state);
  const { snapshot, marker: finalMarker } = await waitForFreshSnapshot(
    page,
    sceneId,
    state,
    initialMarker,
  );
  assertCapacitySnapshot(snapshot, sceneId, state.rawDebug);
  return {
    snapshot,
    runtime: runtimeFromMeasurement(snapshot, measurementState),
    sampling: {
      backend: finalMarker.backend,
      progressStart: initialMarker.progress,
      progressEnd: finalMarker.progress,
      freshSamples: finalMarker.progress - initialMarker.progress,
      windowSize: GROUND_GLASS_PROFILING_WINDOW_SIZE,
      sessionResetsStart: initialMarker.sessionResets,
      sessionResetsEnd: finalMarker.sessionResets,
    },
  };
};

const readEnvironment = async (page: Page, browserName: string): Promise<BenchmarkEnvironment> => {
  expect(await page.locator("canvas").count()).toBeGreaterThan(0);
  const capacitySnapshot = await readCapacitySnapshot(page);
  const profilingSnapshot = capacitySnapshot?.groundGlass;
  if (!profilingSnapshot) {
    throw new Error("Scene capacity benchmark could not read profiling metadata after the simulator canvas mounted");
  }
  const browserInfo = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const context = (
      canvas?.getContext("webgl2") ??
      canvas?.getContext("webgl") ??
      canvas?.getContext("experimental-webgl")
    ) as WebGLRenderingContext | null;
    let vendor: string | null = null;
    let renderer: string | null = null;
    if (context) {
      const debugInfo = context.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        vendor = String(context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        renderer = String(context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      }
    }
    return {
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      webgl: { vendor, renderer },
    };
  });
  const hardwareQualification = classifyGraphicsBackend({
    renderer: browserInfo.webgl.renderer,
    profilingBackend: profilingSnapshot.profilingBackend,
    timingUnit: profilingSnapshot.timingUnit,
  });
  return {
    commitSha: process.env.SCENE_CAPACITY_BENCHMARK_COMMIT ?? null,
    timestamp: new Date().toISOString(),
    viewport: { width: 1440, height: 1000 },
    browserName,
    profilingBackend: profilingSnapshot.profilingBackend,
    timingUnit: profilingSnapshot.timingUnit,
    hardwareQualification: {
      required: process.env.SCENE_CAPACITY_REQUIRE_HARDWARE === "1",
      ...hardwareQualification,
    },
    ...browserInfo,
  };
};

const timingValue = (stats: GroundGlassProfilingTimingStats | null): number | null => stats?.p95Ms ?? null;

const formatTiming = (value: number | null): string => value === null ? "—" : value.toFixed(2);

const markdownSummary = (
  environment: BenchmarkEnvironment,
  records: readonly BenchmarkRecord[],
): string => {
  const rows = records.map((record) => {
    const groundGlass = record.snapshot.groundGlass;
    const sceneRender = passStats(groundGlass, "sceneRenderMs");
    const dof = timingStats(groundGlass, groundGlass?.profilingBackend === "gpu-query" ? "physicalDofGpu" : "physicalDofCpuSubmit");
    const groundGlassTotal = timingStats(groundGlass, groundGlass?.profilingBackend === "gpu-query" ? "groundGlassGpu" : "groundGlassCpuSubmit");
    return `| ${record.sceneId} | ${record.mode} | ${record.sampling.freshSamples} | ${record.snapshot.viewportSubject?.meshCount ?? "—"} | ${record.snapshot.rttSubject?.meshCount ?? "—"} | ${record.snapshot.rttSubject?.effectiveTriangleCount ?? "—"} | ${formatTiming(record.snapshot.frameCadence.p95Ms)} | ${formatTiming(timingValue(sceneRender))} | ${formatTiming(timingValue(groundGlassTotal))} | ${formatTiming(timingValue(dof))} | ${groundGlass?.profilingBackend ?? "—"} |`;
  });
  const baseline = records.find((record) => record.sceneId === "focus-fundamentals-two-targets" && record.mode === "processed");
  const comparisons = records.map((record) => {
    const baseTriangles = baseline?.snapshot.rttSubject?.effectiveTriangleCount ?? 0;
    const triangles = record.snapshot.rttSubject?.effectiveTriangleCount ?? 0;
    const baseRender = timingValue(passStats(baseline?.snapshot.groundGlass ?? null, "sceneRenderMs")) ?? 0;
    const render = timingValue(passStats(record.snapshot.groundGlass, "sceneRenderMs")) ?? 0;
    const baseGroundGlass = timingValue(timingStats(baseline?.snapshot.groundGlass ?? null, baseline?.snapshot.groundGlass?.profilingBackend === "gpu-query" ? "groundGlassGpu" : "groundGlassCpuSubmit")) ?? 0;
    const groundGlass = timingValue(timingStats(record.snapshot.groundGlass, record.snapshot.groundGlass?.profilingBackend === "gpu-query" ? "groundGlassGpu" : "groundGlassCpuSubmit")) ?? 0;
    return {
      sceneId: record.sceneId,
      mode: record.mode,
      effectiveTrianglesRatio: baseTriangles > 0 ? triangles / baseTriangles : null,
      sceneRenderP95Ratio: baseRender > 0 ? render / baseRender : null,
      groundGlassP95Ratio: baseGroundGlass > 0 ? groundGlass / baseGroundGlass : null,
    };
  });
  const hardwareRendererSummary = environment.hardwareQualification.hardwareRendererQualified
    ? "qualified"
    : environment.hardwareQualification.softwareRendererDetected
      ? environment.hardwareQualification.required
        ? "FAILED — known software renderer detected"
        : "known software renderer detected (requirement not requested)"
      : "unavailable";
  const gpuTimingSummary = environment.hardwareQualification.gpuTimingQualified
    ? "qualified"
    : environment.profilingBackend === "cpu-fallback"
      ? "unavailable — CPU fallback"
      : "unavailable";
  return [
    "# Scene capacity benchmark",
    "",
    `Commit: ${environment.commitSha ?? "unknown"}`,
    `Timestamp: ${environment.timestamp}`,
    `Browser: ${environment.browserName}`,
    `Viewport: ${environment.viewport.width}×${environment.viewport.height}, DPR ${environment.devicePixelRatio}`,
    `WebGL vendor: ${environment.webgl.vendor ?? "unavailable"}`,
    `WebGL renderer: ${environment.webgl.renderer ?? "unavailable"}`,
    `Hardware renderer requirement: ${environment.hardwareQualification.required ? "required" : "not requested"}`,
    `Hardware renderer: ${hardwareRendererSummary}`,
    `GPU timer queries: ${gpuTimingSummary}`,
    `Profiling backend: ${environment.profilingBackend ?? "unavailable"}`,
    `Timing unit: ${environment.timingUnit ?? "unavailable"}`,
    "",
    `Each record contains at least ${GROUND_GLASS_PROFILING_WINDOW_SIZE} fresh post-state samples after contentfulness and mode activation. Processed, Focus Loupe, and Raw RTT records use isolated state setup. WebGL metadata is collected after the first simulator canvas mounts.`,
    "Timings are same-session observations. GPU-query values are GPU milliseconds; CPU fallback values are CPU-submit milliseconds. Frame cadence is observed R3F frame cadence, not pure GPU execution time.",
    "",
    "| Scene | Mode | Fresh samples | Viewport meshes | RTT meshes | RTT effective triangles | Frame p95 ms | Scene render p95 ms | Ground Glass p95 ms | Physical DOF p95 ms | Backend |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...rows,
    "",
    "## Same-run relative comparisons",
    "",
    "```json",
    JSON.stringify(comparisons, null, 2),
    "```",
    "",
  ].join("\n");
};

const writeBenchmarkOutput = async (
  environment: BenchmarkEnvironment,
  records: readonly BenchmarkRecord[],
): Promise<void> => {
  const output = {
    environment,
    records,
    notes: {
      frameCadence: "Observed active Ground Glass R3F frame cadence while the simulator viewport and UI are mounted; it is not pure GPU render time.",
      rendererResources: "rendererResources.geometries and rendererResources.textures are renderer resource counts, not byte-accurate VRAM measurements.",
      sampling: `Every timing record waits for a fresh post-state window of at least ${GROUND_GLASS_PROFILING_WINDOW_SIZE} valid backend samples after contentfulness and mode activation.`,
    },
  };
  await mkdir(benchmarkOutputDirectory, { recursive: true });
  await writeFile(`${benchmarkOutputDirectory}/scene-capacity-benchmark.json`, JSON.stringify(output, null, 2));
  await writeFile(`${benchmarkOutputDirectory}/scene-capacity-benchmark.md`, markdownSummary(environment, records));
};

test.describe("scene capacity benchmark", () => {
  test.skip(!benchmarkEnabled, "Run through npm run benchmark:scene-capacity.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  test("captures static scene capacity and Ground Glass timing matrix", async ({ page, browserName }) => {
    test.setTimeout(1_200_000);
    const environment = { current: null as BenchmarkEnvironment | null };
    const records: BenchmarkRecord[] = [];

    for (const sceneId of benchmarkScenes) {
      await page.goto(`/simulator/free/${sceneId}?sceneCapacityProfiling=1&dofProfiling=1&rttDiagnostics=1`);
      const processedState = { rawDebug: false, inspectionWindowActive: false };
      const processed = await waitForFreshStableSnapshot(page, sceneId, processedState);
      if (!environment.current) {
        environment.current = await readEnvironment(page, browserName);
        if (
          environment.current.hardwareQualification.required &&
          !environment.current.hardwareQualification.hardwareRendererQualified
        ) {
          await writeBenchmarkOutput(environment.current, records);
          const renderer = environment.current.webgl.renderer ?? "unavailable";
          throw new Error(
            `Hardware scene-capacity benchmark requires a qualified renderer; detected ${renderer}. ` +
            "Use stable Google Chrome with hardware acceleration enabled and rerun.",
          );
        }
      }
      records.push({
        sceneId,
        mode: "processed",
        snapshot: processed.snapshot,
        sampling: processed.sampling,
        runtime: processed.runtime,
      });

      if (loupeScenes.has(sceneId)) {
        await page.goto(`/simulator/free/${sceneId}?sceneCapacityProfiling=1&dofProfiling=1&rttDiagnostics=1`);
        await waitForMeasurementState(page, sceneId, {
          rawDebug: false,
          inspectionWindowActive: false,
        });
        const loupeButton = page.getByRole("button", { name: /Focus Loupe .*view/i }).first();
        await expect(loupeButton).toHaveCount(1);
        await loupeButton.click();
        await expect(page.locator('[data-focus-loupe-active="true"]')).toHaveCount(1);
        const loupe = await waitForFreshStableSnapshot(page, sceneId, {
          rawDebug: false,
          inspectionWindowActive: true,
        });
        records.push({
          sceneId,
          mode: "processed-loupe",
          snapshot: loupe.snapshot,
          sampling: loupe.sampling,
          runtime: loupe.runtime,
        });
      }

      if (rawScenes.has(sceneId)) {
        await page.goto(`/simulator/free/${sceneId}?sceneCapacityProfiling=1&dofProfiling=1&rttDiagnostics=1`);
        await waitForMeasurementState(page, sceneId, {
          rawDebug: false,
          inspectionWindowActive: false,
        });
        await expect(page.locator('[data-focus-loupe-active="true"]')).toHaveCount(0);
        const rawToggle = page.getByLabel("Raw RTT — bypass DOF");
        await expect(rawToggle).toHaveCount(1);
        await rawToggle.check();
        await expect(rawToggle).toBeChecked();
        const raw = await waitForFreshStableSnapshot(page, sceneId, {
          rawDebug: true,
          inspectionWindowActive: false,
        });
        records.push({
          sceneId,
          mode: "raw-rtt",
          snapshot: raw.snapshot,
          sampling: raw.sampling,
          runtime: raw.runtime,
        });
      }
    }

    expect(environment.current).not.toBeNull();
    await writeBenchmarkOutput(environment.current as BenchmarkEnvironment, records);
    expect(records.length).toBe(benchmarkScenes.length + loupeScenes.size + rawScenes.size);
  });
});
