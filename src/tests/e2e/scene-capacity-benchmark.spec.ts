import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type {
  GroundGlassProfilingSnapshot,
  GroundGlassProfilingTimingStats,
} from "../../render/groundGlassProfiling";
import type {
  SceneCapacitySnapshot,
  SceneGraphCapacityMetrics,
} from "../../render/sceneCapacityProfiling";

const benchmarkEnabled = process.env.SCENE_CAPACITY_BENCHMARK === "1";
const benchmarkOutputDirectory = process.env.SCENE_CAPACITY_BENCHMARK_OUTPUT_DIR ?? "test-results";
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

type BenchmarkRecord = {
  sceneId: string;
  mode: BenchmarkMode;
  snapshot: SceneCapacitySnapshot;
  runtime: {
    finalContentful: boolean | null;
    internalResolution: [number, number] | null;
    gatherResolution: [number, number] | null;
    profilingBackend: string | null;
  };
};

type BenchmarkEnvironment = {
  commitSha: string | null;
  timestamp: string;
  viewport: { width: number; height: number };
  browserName: string;
  userAgent: string;
  devicePixelRatio: number;
  webgl: { vendor: string | null; renderer: string | null };
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

const assertCapacitySnapshot = (snapshot: SceneCapacitySnapshot, sceneId: string): void => {
  expect(snapshot.sceneId).toBe(sceneId);
  expect(snapshot.viewportSubject).not.toBeNull();
  expect(snapshot.rttSubject).not.toBeNull();
  expect(snapshot.groundGlass).not.toBeNull();
  expect(finiteMetricValues(snapshot.viewportSubject as SceneGraphCapacityMetrics).every(Number.isFinite)).toBe(true);
  expect(finiteMetricValues(snapshot.rttSubject as SceneGraphCapacityMetrics).every(Number.isFinite)).toBe(true);
  expect(snapshot.frameCadence.count).toBeGreaterThan(0);
  expect(snapshot.groundGlass?.frame.count ?? 0).toBeGreaterThan(0);
  expect(JSON.stringify(snapshot)).not.toMatch(/NaN|Infinity/);
};

const readCapacitySnapshot = async (page: Page): Promise<SceneCapacitySnapshot | null> => {
  const text = await page.getByTestId("scene-capacity-snapshot").textContent();
  if (!text || text.trim() === "null") return null;
  return JSON.parse(text) as SceneCapacitySnapshot;
};

const readEnvironment = async (page: Page, browserName: string): Promise<BenchmarkEnvironment> => {
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
  return {
    commitSha: process.env.SCENE_CAPACITY_BENCHMARK_COMMIT ?? null,
    timestamp: new Date().toISOString(),
    viewport: { width: 1440, height: 1000 },
    browserName,
    ...browserInfo,
  };
};

const waitForStableSnapshot = async (
  page: Page,
  sceneId: string,
  rawDebug: boolean,
): Promise<SceneCapacitySnapshot> => {
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", sceneId);
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 120_000 });
  await expect.poll(
    async () => {
      const snapshot = await readCapacitySnapshot(page);
      if (!snapshot || snapshot.sceneId !== sceneId || !snapshot.groundGlass) return false;
      if (snapshot.groundGlass.rawDebug !== rawDebug) return false;
      if (!snapshot.viewportSubject || !snapshot.rttSubject) return false;
      const expectedPasses = rawDebug
        ? ["sceneRenderMs", "compositeMs"] as const
        : ["sceneRenderMs", "cocFootprintMs", "farGatherMs", "nearGatherMs", "compositeMs"] as const;
      return expectedPasses.every((pass) => (snapshot.groundGlass?.passes[pass]?.count ?? 0) > 0);
    },
    { timeout: 120_000, intervals: [250, 500, 1_000] },
  ).toBe(true);
  const snapshot = await readCapacitySnapshot(page);
  expect(snapshot).not.toBeNull();
  assertCapacitySnapshot(snapshot as SceneCapacitySnapshot, sceneId);
  return snapshot as SceneCapacitySnapshot;
};

const readRuntime = async (page: Page): Promise<BenchmarkRecord["runtime"]> => {
  const rtt = page.getByTestId("ground-glass-rtt");
  const attrs = await rtt.evaluate((element) => ({
    finalContentful: element.getAttribute("data-rtt-final-contentful"),
    internalWidth: element.getAttribute("data-rtt-internal-width"),
    internalHeight: element.getAttribute("data-rtt-internal-height"),
    gatherWidth: element.getAttribute("data-rtt-blur-target-width"),
    gatherHeight: element.getAttribute("data-rtt-blur-target-height"),
    profilingBackend: element.getAttribute("data-rtt-profiling-backend"),
  }));
  const parseNumber = (value: string | null): number | null => {
    const parsed = value === null ? Number.NaN : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const internalWidth = parseNumber(attrs.internalWidth);
  const internalHeight = parseNumber(attrs.internalHeight);
  const gatherWidth = parseNumber(attrs.gatherWidth);
  const gatherHeight = parseNumber(attrs.gatherHeight);
  return {
    finalContentful: attrs.finalContentful === null ? null : attrs.finalContentful === "true",
    internalResolution: internalWidth !== null && internalHeight !== null ? [internalWidth, internalHeight] : null,
    gatherResolution: gatherWidth !== null && gatherHeight !== null ? [gatherWidth, gatherHeight] : null,
    profilingBackend: attrs.profilingBackend,
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
    return `| ${record.sceneId} | ${record.mode} | ${record.snapshot.viewportSubject?.meshCount ?? "—"} | ${record.snapshot.rttSubject?.meshCount ?? "—"} | ${record.snapshot.rttSubject?.effectiveTriangleCount ?? "—"} | ${formatTiming(record.snapshot.frameCadence.p95Ms)} | ${formatTiming(timingValue(sceneRender))} | ${formatTiming(timingValue(groundGlassTotal))} | ${formatTiming(timingValue(dof))} | ${groundGlass?.profilingBackend ?? "—"} |`;
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
  return [
    "# Scene capacity benchmark",
    "",
    `Commit: ${environment.commitSha ?? "unknown"}`,
    `Timestamp: ${environment.timestamp}`,
    `Browser: ${environment.browserName}`,
    `Viewport: ${environment.viewport.width}×${environment.viewport.height}, DPR ${environment.devicePixelRatio}`,
    `WebGL vendor: ${environment.webgl.vendor ?? "unavailable"}`,
    `WebGL renderer: ${environment.webgl.renderer ?? "unavailable"}`,
    "",
    "Timings are same-session observations. GPU-query values are GPU milliseconds; CPU fallback values are CPU-submit milliseconds. Frame cadence is observed R3F frame cadence, not pure GPU execution time.",
    "",
    "| Scene | Mode | Viewport meshes | RTT meshes | RTT effective triangles | Frame p95 ms | Scene render p95 ms | Ground Glass p95 ms | Physical DOF p95 ms | Backend |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
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

test.describe("scene capacity benchmark", () => {
  test.skip(!benchmarkEnabled, "Run through npm run benchmark:scene-capacity.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  test("captures static scene capacity and Ground Glass timing matrix", async ({ page, browserName }) => {
    test.setTimeout(1_200_000);
    const environment = await readEnvironment(page, browserName);
    const records: BenchmarkRecord[] = [];

    for (const sceneId of benchmarkScenes) {
      await page.goto(`/simulator/free/${sceneId}?sceneCapacityProfiling=1&dofProfiling=1&rttDiagnostics=1`);
      const processed = await waitForStableSnapshot(page, sceneId, false);
      records.push({ sceneId, mode: "processed", snapshot: processed, runtime: await readRuntime(page) });

      if (loupeScenes.has(sceneId)) {
        const loupeButton = page.getByRole("button", { name: /Focus Loupe .*view/i }).first();
        await expect(loupeButton).toHaveCount(1);
        await loupeButton.click();
        await expect(page.locator('[data-focus-loupe-active="true"]')).toHaveCount(1);
        const loupe = await waitForStableSnapshot(page, sceneId, false);
        records.push({ sceneId, mode: "processed-loupe", snapshot: loupe, runtime: await readRuntime(page) });
      }

      if (rawScenes.has(sceneId)) {
        const rawToggle = page.getByLabel("Raw RTT — bypass DOF");
        await expect(rawToggle).toHaveCount(1);
        await rawToggle.check();
        await expect(rawToggle).toBeChecked();
        const raw = await waitForStableSnapshot(page, sceneId, true);
        records.push({ sceneId, mode: "raw-rtt", snapshot: raw, runtime: await readRuntime(page) });
      }
    }

    const output = {
      environment,
      records,
      notes: {
        frameCadence: "Observed active Ground Glass R3F frame cadence while the simulator viewport and UI are mounted; it is not pure GPU render time.",
        rendererResources: "rendererResources.geometries and rendererResources.textures are renderer resource counts, not byte-accurate VRAM measurements.",
      },
    };
    await mkdir(benchmarkOutputDirectory, { recursive: true });
    await writeFile(`${benchmarkOutputDirectory}/scene-capacity-benchmark.json`, JSON.stringify(output, null, 2));
    await writeFile(`${benchmarkOutputDirectory}/scene-capacity-benchmark.md`, markdownSummary(environment, records));
    expect(records.length).toBeGreaterThanOrEqual(benchmarkScenes.length);
  });
});
