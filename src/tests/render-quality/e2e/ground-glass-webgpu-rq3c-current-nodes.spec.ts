import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { arch, platform, release } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { REVISION } from "three";

const FIXTURE_PATH = "/src/tests/render-quality/e2e/fixtures/ground-glass-webgpu-rq3c.html";
const nativeWebGpuRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";

type Rq3cWindow = Window & {
  __rq3c?: {
    result: {
      schemaVersion: number;
      evidenceClass: string;
      sourceCommit: string;
      sourceTreeDirty: boolean;
      sceneSourceRevision: string | null;
      rendererRevision: string;
      runtime: {
        rendererFamily: string;
        actualExecutionApi: string;
        internalFallback: string;
        applicationFallback: string;
      };
      coordinateContract: Record<string, string>;
      controlledInputs: Record<string, unknown>;
      scenarios: Array<{
        scenarioId: string;
        gatherSize: { widthPx: number; heightPx: number };
        sampleCount: number;
        stagesAtProbe: Record<string, unknown>;
        metrics: Record<string, number>;
        timings: Record<string, number | null>;
      }>;
    };
    display: (scenarioId: "full32" | "half32" | "half64", layer: "far-b0" | "far-b1" | "near" | "composite-b0" | "composite-b1") => Promise<void>;
    dispose: () => Promise<void>;
  };
};

const readStatus = (page: Page) => page.getByTestId("rq3c-status").textContent();

test("native r187 shared nodes exercise a controlled half-resolution Far edge mismatch and B1 composite behavior", async ({ page, browser }, testInfo) => {
  test.skip(!nativeWebGpuRequired, "RQ3C shared-node GPU evidence requires the headed native WebGPU project");
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(FIXTURE_PATH);
  await expect.poll(() => readStatus(page), { timeout: 180_000, intervals: [100, 250, 500] }).toBe("complete");
  expect(REVISION).toBe("187");

  const result = await page.evaluate(() => (window as Rq3cWindow).__rq3c?.result ?? null);
  expect(result, "shared-node GPU diagnostics are published").not.toBeNull();
  expect(result!.evidenceClass).toBe("synthetic-shared-tsl-research");
  expect(result!.sceneSourceRevision).toBeNull();
  expect(result!.rendererRevision).toBe(REVISION);
  expect(result!.runtime).toEqual({
    rendererFamily: "webgpu-renderer",
    actualExecutionApi: "webgpu",
    internalFallback: "none",
    applicationFallback: "not-applicable",
  });
  expect(result!.scenarios.map(({ scenarioId }) => scenarioId)).toEqual(["full32", "half32", "half64"]);

  const full32 = result!.scenarios.find(({ scenarioId }) => scenarioId === "full32")!;
  const half32 = result!.scenarios.find(({ scenarioId }) => scenarioId === "half32")!;
  const half64 = result!.scenarios.find(({ scenarioId }) => scenarioId === "half64")!;
  expect(half32.gatherSize).toEqual({ widthPx: 64, heightPx: 48 });
  expect(half32.sampleCount).toBe(32);
  const probe = half32.stagesAtProbe;
  expect(probe.sourceIdentityGpu).toEqual([68, 26, 0, 1]);
  expect(probe.selectedGatherTexelTopOrigin).toEqual([34, 13]);
  expect(probe.observedGatherCenterSourceIdentityGpu).toEqual([69, 27, expect.any(Number), expect.any(Number)]);
  expect(probe.selectedProvenanceGpu).toEqual([34, 13, 69, 27]);
  expect((probe.sourcePhysicalAndValidityGpu as number[])[0]).toBeGreaterThan(0);
  expect((probe.nearCenterPhysicalAndValidityGpu as number[])[0]).toBeLessThan(0);
  expect((probe.farGatherAtSelectedTexelGpu as number[])[0]).toBeGreaterThan(0.8);
  expect((probe.b1DecisionAtSourcePixelGpu as number[])[1]).toBeCloseTo(4 / 255, 5);
  expect((probe.b1FarAtSourcePixelGpu as number[])[0]).toBeCloseTo(0.025, 3);
  expect(full32.metrics.farEdgeLeakPixelsB0).toBe(0);
  expect(half32.metrics.farEdgeLeakPixelsB0).toBeGreaterThan(100);
  expect(half32.metrics.farEdgeLeakEnergyB0).toBeGreaterThan(100);
  expect(half32.metrics.farEdgeLeakPixelsB1).toBe(0);
  expect(half32.metrics.farEdgeLeakEnergyB1).toBeLessThan(half32.metrics.farEdgeLeakEnergyB0 * 0.001);
  expect(half32.metrics.compositeFarEdgeLeakPixelsB0).toBe(0);
  expect(half32.metrics.compositeFarEdgeLeakPixelsB1).toBe(0);
  expect(half32.metrics.compositeFarEdgeLeakEnergyB1).toBeCloseTo(half32.metrics.compositeFarEdgeLeakEnergyB0, 4);
  expect(half64.metrics.farEdgeLeakPixelsB0).toBeGreaterThan(100);
  expect(half64.metrics.farEdgeLeakPixelsB1).toBe(0);
  expect(half32.metrics.farFeatureSpreadPixelsB1).toBeGreaterThan(0);
  expect(half32.metrics.farFeatureSpreadPixelsB1).toBeGreaterThanOrEqual(half32.metrics.farFeatureSpreadPixelsB0 - 2);
  expect(half32.metrics.farFeatureSpreadEnergyB1).toBeGreaterThan(half32.metrics.farFeatureSpreadEnergyB0 * 0.99);
  expect(half32.metrics.nearSpreadPixels).toBeGreaterThan(0);
  expect(half32.metrics.nearCoverageEnergy).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);

  const gitHead = execFileSync("git", ["rev-parse", "--verify", "HEAD"], { encoding: "utf8" }).trim();
  const status = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { encoding: "utf8" }).trim();
  const sourceTreeDirty = status.length > 0;
  const evidence = {
    ...result,
    sourceCommit: gitHead,
    sourceTreeDirty,
    environment: {
      browser: `Chrome ${browser.version()}`,
      operatingSystem: `${platform()} ${release()} (${arch()})`,
      nodeVersion: process.version,
      playwrightProject: "chrome-native-webgpu",
      workers: 1,
      retries: 0,
      testExecuted: true,
      testSkipped: false,
      pageErrors,
      adapterIdentity: "not exposed by this fixture",
      hardwareAcceleration: "not established",
    },
  };
  const artifactPath = testInfo.outputPath("rq3c-current-shared-node-readbacks.json");
  await mkdir(testInfo.outputDir, { recursive: true });
  await writeFile(artifactPath, JSON.stringify(evidence, null, 2));
  await testInfo.attach("rq3c-current-shared-node-readbacks.json", { path: artifactPath, contentType: "application/json" });

  const screenshots: Array<{ scenarioId: "full32" | "half32" | "half64"; layer: "far-b0" | "far-b1" | "near" | "composite-b0" | "composite-b1" }> = [
    { scenarioId: "full32", layer: "far-b1" },
    { scenarioId: "half32", layer: "far-b0" },
    { scenarioId: "half32", layer: "far-b1" },
    { scenarioId: "half64", layer: "far-b1" },
    { scenarioId: "half32", layer: "near" },
    { scenarioId: "half32", layer: "composite-b0" },
    { scenarioId: "half32", layer: "composite-b1" },
  ];
  for (const screenshot of screenshots) {
    await page.evaluate(async ({ scenarioId, layer }) => {
      await (window as Rq3cWindow).__rq3c?.display(scenarioId, layer);
    }, screenshot);
    const name = `rq3c-${screenshot.scenarioId}-${screenshot.layer}.png`;
    const path = testInfo.outputPath(name);
    const image = await page.locator("#rq3c-canvas").screenshot({ path, animations: "disabled" });
    await testInfo.attach(name, { path, contentType: "image/png" });
    await testInfo.attach(`${name}.sha256.txt`, {
      body: createHash("sha256").update(image).digest("hex"),
      contentType: "text/plain",
    });
  }
  await page.evaluate(async () => (window as Rq3cWindow).__rq3c?.dispose());
});
