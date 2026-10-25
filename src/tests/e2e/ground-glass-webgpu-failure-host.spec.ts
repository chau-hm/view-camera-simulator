import { expect, test, type Page } from "@playwright/test";
import type { GroundGlassWebGpuTestControl } from "../../render/webgpu/groundGlassWebGpuTestSeam";
import { clickStageAt } from "./helpers/groundGlass";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const nativeRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const failureIntegrationEnabled = process.env.GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION === "1";

type FailurePoint =
  | "initialization-after-target"
  | "scene-render-after-submit"
  | "texture-display-after-submit"
  | "dispose-target";

const pane = (page: Page) => page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');

const waitForStableRequestId = async (page: Page, glass: ReturnType<typeof pane>) => {
  await expect.poll(async () => {
    const first = await glass.getAttribute("data-frame-request-id");
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    const second = await glass.getAttribute("data-frame-request-id");
    return first && first === second ? second : null;
  }, { timeout: 15_000 }).not.toBeNull();
  return glass.getAttribute("data-frame-request-id");
};

const writeControl = async (page: Page, patch: Partial<GroundGlassWebGpuTestControl>) => page.evaluate((next) => {
  const control = window.__groundGlassWebGpuM3TestControl ??= {};
  Object.assign(control, next);
}, patch);

const installControl = async (page: Page) => {
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = { adapterAttemptGenerations: [], failurePoints: [] };
  });
};

const startNativePilot = async (page: Page, failurePoints: FailurePoint[]) => {
  await installControl(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  const glass = pane(page);
  await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await writeControl(page, { failurePoints });
  await page.getByLabel("Raw RTT — bypass DOF").check();
  await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 120_000 })
    .toContainEqual(expect.objectContaining({
      kind: "runtime-observed",
      rendererFamily: "webgpu-renderer",
      executionApi: "webgpu",
    }));
  const failedRequestId = await glass.getAttribute("data-frame-request-id");
  const failedGeneration = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations?.[0] ?? null);
  if (!failedRequestId || !failedGeneration) throw new Error("Native WebGPU request/generation identity was not captured");
  return { glass, failedRequestId, failedGeneration };
};

const assertConfirmedWebGlFallback = async (
  glass: ReturnType<typeof pane>,
  page: Page,
  failedRequestId: string,
  failedGeneration: string,
  failureStage: "initialization" | "runtime",
  failureOperation: string,
) => {
  await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
    .toContainEqual(expect.objectContaining({
      kind: "cleanup",
      generationId: failedGeneration,
      outcome: "confirmed",
    }));
  const events = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
  expect(events).toContainEqual(expect.objectContaining({
    kind: "failure",
    generationId: failedGeneration,
    stage: failureStage,
    operation: failureOperation,
  }));
  expect(events).not.toContainEqual(expect.objectContaining({
    kind: "frame-completed",
    generationId: failedGeneration,
    requestId: failedRequestId,
  }));
  await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-actual-execution-api", /^webgl2?$/);
  await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-last-completed-request-id", failedRequestId, { timeout: 90_000 });
  const currentGeneration = await glass.getAttribute("data-renderer-generation");
  expect(currentGeneration).toBeTruthy();
  expect(currentGeneration).not.toBe(failedGeneration);
};

test.describe("native M3 WebGPU adapter-to-host controlled failure recovery", () => {
  test.skip(
    !nativeRequired || !failureIntegrationEnabled,
    "Requires headed native Chrome, VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true, and GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1",
  );

  test("D1 initialization failure cleans acquired resources before WebGL fallback and remains sticky", async ({ page }) => {
    test.setTimeout(300_000);
    const { glass, failedRequestId, failedGeneration } = await startNativePilot(page, ["initialization-after-target"]);
    await assertConfirmedWebGlFallback(glass, page, failedRequestId, failedGeneration, "initialization", "unknown");

    const slider = page.getByRole("slider", { name: "Focus distance" });
    const currentFocus = Number(await slider.inputValue());
    const focusStep = Number(await slider.getAttribute("step"));
    await setStepRangeInput(page, "Focus distance", currentFocus + focusStep);
    await page.getByRole("radio", { name: "f/16" }).check();
    await page.getByRole("radio", { name: "Upright Assist", exact: true }).check();
    const stage = page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");
    await clickStageAt(page, stage, 0.68, 0.36);
    await page.setViewportSize({ width: 1160, height: 900 });
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");

    await page.getByRole("link", { name: "All Scenes", exact: true }).click();
    await expect(page).toHaveURL(/\/scenes$/);
    await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/interior-corner"]').click();
    await expect(page).toHaveURL(/\/simulator\/free\/interior-corner$/);
    await page.getByRole("link", { name: "All Scenes", exact: true }).click();
    await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/architecture-rise"]').click();
    await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
    const remountedGlass = pane(page);
    await expect(remountedGlass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    await expect(remountedGlass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
    const adapterAttempts = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    expect(adapterAttempts).toEqual([failedGeneration]);
  });

  for (const scenario of [
    { name: "D2 scene render submission", point: "scene-render-after-submit" as const, operation: "sceneRender" },
    { name: "D3 texture display submission", point: "texture-display-after-submit" as const, operation: "textureDisplay" },
  ]) {
    test(`${scenario.name} fails the whole frame and falls back only after confirmed cleanup`, async ({ page }) => {
      test.setTimeout(240_000);
      const { glass, failedRequestId, failedGeneration } = await startNativePilot(page, [scenario.point]);
      await assertConfirmedWebGlFallback(glass, page, failedRequestId, failedGeneration, "runtime", scenario.operation);
      const adapterAttempts = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
      expect(adapterAttempts).toEqual([failedGeneration]);
    });
  }

  test("D4 failed disposal keeps the host unavailable and prevents a replacement generation", async ({ page }) => {
    test.setTimeout(240_000);
    const { glass, failedRequestId, failedGeneration } = await startNativePilot(page, ["initialization-after-target", "dispose-target"]);
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
      .toContainEqual(expect.objectContaining({ kind: "failure", generationId: failedGeneration, stage: "initialization" }));
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
      .toContainEqual(expect.objectContaining({
        kind: "cleanup",
        generationId: failedGeneration,
        outcome: "failed",
      }));
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "unavailable");
    await expect(glass).toHaveAttribute("data-render-cleanup-status", "failed");
    await expect(glass).not.toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
    expect(await glass.getAttribute("data-renderer-generation")).toBe(failedGeneration);
    expect(await glass.getAttribute("data-last-completed-request-id")).not.toBe(failedRequestId);
    const adapterAttempts = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    expect(adapterAttempts).toEqual([failedGeneration]);
  });

  test("D5 pending queue work blocks replacement until the actual adapter operation settles", async ({ page }) => {
    test.setTimeout(180_000);
    await installControl(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
    const glass = pane(page);
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    await writeControl(page, { holdQueueCompletion: true });
    await page.getByLabel("Raw RTT — bypass DOF").check();
    const adapter = page.getByTestId("ground-glass-webgpu-pilot");
    await expect(adapter).toHaveAttribute("data-actual-execution-api", "webgpu", { timeout: 120_000 });
    await expect.poll(async () => page.evaluate(() => Boolean(window.__groundGlassWebGpuM3TestControl?.queueCompletionBarrierReached))).toBe(true);
    const retiredGeneration = await glass.getAttribute("data-renderer-generation");
    await page.getByLabel("Raw RTT — bypass DOF").uncheck();
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "retiring");
    await expect(glass).toHaveAttribute("data-render-cleanup-status", "pending");
    expect(await glass.getAttribute("data-renderer-generation")).toBe(retiredGeneration);
    await expect(glass).not.toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
    await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseQueueCompletion?.());
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
      .toContainEqual(expect.objectContaining({
        kind: "cleanup",
        generationId: retiredGeneration,
        outcome: "confirmed",
      }));
    await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 90_000 });
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  });

  test("D6 latest request wins after a held adapter failure and an out-of-order fallback completion", async ({ page }) => {
    test.setTimeout(300_000);
    await installControl(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
    const glass = pane(page);
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    await writeControl(page, {
      failurePoints: ["scene-render-after-submit"],
      holdAdapterOperationAfterFailure: true,
    });
    await page.getByLabel("Raw RTT — bypass DOF").check();
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 120_000 })
      .toContainEqual(expect.objectContaining({
        kind: "runtime-observed",
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
      }));
    await expect.poll(async () => page.evaluate(() => Boolean(window.__groundGlassWebGpuM3TestControl?.adapterOperationBarrierReached))).toBe(true);
    const r1 = await waitForStableRequestId(page, glass);
    const oldGeneration = await glass.getAttribute("data-renderer-generation");
    await setStepRangeInput(page, "Focus distance", 8000);
    const r2 = await waitForStableRequestId(page, glass);
    expect(r1).toBeTruthy();
    expect(r2).toBeTruthy();
    expect(r2).not.toBe(r1);
    await writeControl(page, { holdNextCompletedFrame: true });
    await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseAdapterOperation?.());
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
      .toContainEqual(expect.objectContaining({
        kind: "cleanup",
        generationId: oldGeneration,
        outcome: "confirmed",
      }));
    await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 90_000 });
    await expect(glass).toHaveAttribute("data-frame-request-id", r2!);
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.heldFrameRequestId ?? null), { timeout: 90_000 }).toBe(r2);
    const fallbackGeneration = await glass.getAttribute("data-renderer-generation");
    expect(fallbackGeneration).toBeTruthy();
    expect(fallbackGeneration).not.toBe(oldGeneration);
    await page.getByRole("radio", { name: "f/16" }).check();
    const r3 = await glass.getAttribute("data-frame-request-id");
    expect(r3).toBeTruthy();
    expect(r3).not.toBe(r2);
    await expect(glass).toHaveAttribute("data-frame-channel-id", "default");
    await expect(glass).toHaveAttribute("data-frame-scene-id", "architecture-rise");
    await expect(glass).toHaveAttribute("data-last-completed-request-id", r3!, { timeout: 90_000 });
    await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseHeldFrame?.());
    await expect(glass).toHaveAttribute("data-last-completed-request-id", r3!);
    await expect(glass).toHaveAttribute("data-renderer-generation", fallbackGeneration!);
    const adapterAttempts = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    expect(adapterAttempts).toEqual([oldGeneration]);
  });
});
