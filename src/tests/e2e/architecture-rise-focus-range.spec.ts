import { writeFile } from "node:fs/promises";
import { expect, test, type Locator } from "@playwright/test";
import { readFocusDistributionPercent } from "./helpers/focusDistribution";
import { expectGroundGlassPhysicalScale } from "./helpers/groundGlass";
import { setStepRangeInput } from "./helpers/stepRangeInput";
import { installM7nRendererLifecycleCapture } from "./helpers/m7nRendererLifecycleCapture";
import { installM7oCanvasAssertionTimingCapture, type M7oCapture } from "./helpers/m7oCanvasAssertionTimingCapture";
import { installM7pAssertionSchedulingCapture, type M7pAssertionSchedulingCapture } from "./helpers/m7pAssertionSchedulingCapture";

let finishM7nCapture: ((capturePhase?: "after-test" | "canvas-count-assertion-failure") => Promise<void>) | null = null;
let m7oCapture: M7oCapture | null = null;
let m7pCapture: M7pAssertionSchedulingCapture | null = null;

test.beforeEach(async ({ page }, testInfo) => {
  if (process.env.M7P_CAPTURE_DIAGNOSTICS === "1") {
    m7pCapture = await installM7pAssertionSchedulingCapture(
      page,
      testInfo,
      process.env.M7P_CAPTURE_ID ?? "unlabelled",
    );
  }
  if (process.env.M7O_CAPTURE_DIAGNOSTICS === "1") {
    m7oCapture = await installM7oCanvasAssertionTimingCapture(
      page,
      testInfo,
      process.env.M7O_CAPTURE_ID ?? "unlabelled",
    );
  }
  if (process.env.M7N_CAPTURE_DIAGNOSTICS !== "1") return;
  finishM7nCapture = await installM7nRendererLifecycleCapture(
    page,
    testInfo,
    process.env.M7N_CAPTURE_RUN_ID ?? "unlabelled",
  );
});

test.afterEach(async () => {
  const finish = finishM7nCapture;
  finishM7nCapture = null;
  await finish?.();
  const capture = m7oCapture;
  m7oCapture = null;
  await capture?.finish();
  const m7p = m7pCapture;
  m7pCapture = null;
  await m7p?.finish();
});

const readVector = async (locator: Locator, attribute: string): Promise<[number, number, number]> => {
  const value = await locator.getAttribute(attribute);
  if (!value) throw new Error(`${attribute} is missing from the Architecture Rise diagnostics`);
  const vector = value.split(",").map(Number);
  if (vector.length !== 3 || !vector.every(Number.isFinite)) {
    throw new Error(`${attribute} is not a finite three-dimensional vector: ${value}`);
  }
  return vector as [number, number, number];
};

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test("Architecture Rise focus control stays within scene depth and preserves thin-lens extension", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/architecture-rise");

  const scene = page.getByTestId("scene-canvas");
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const canvasCountTimeoutMs = 5_000;
  const syntheticStallMs = Number(process.env.M7P_SYNTHETIC_STALL_MS ?? "0");
  if (syntheticStallMs > 0) {
    if (!m7pCapture) throw new Error("M7P synthetic stall requires diagnostic capture to be enabled.");
    const waitStartedAtMs = performance.now();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="scene-canvas"] canvas') !== null,
      undefined,
      { timeout: canvasCountTimeoutMs },
    );
    m7pCapture?.recordNodeInterval("synthetic-control-waited-for-connected-canvas", waitStartedAtMs, performance.now());
    await m7pCapture?.recordBrowserEvaluation("synthetic-control-before-stall");
  }
  await m7oCapture?.captureBoundary("before-canvas-count-assertion");
  await m7pCapture?.recordBrowserEvaluation("assertion-entry-anchor");
  m7pCapture?.beginAssertion(canvasCountTimeoutMs);
  m7oCapture?.beginAssertion(canvasCountTimeoutMs);
  const syntheticStallSettled = syntheticStallMs > 0
    ? m7pCapture?.beginSyntheticMainThreadStall(syntheticStallMs)
      .then(() => null, (error: unknown) => error instanceof Error ? error.message : String(error))
    : null;
  try {
    await expect(scene.locator("canvas")).toHaveCount(1, { timeout: canvasCountTimeoutMs });
    m7pCapture?.settleAssertion("passed");
    m7oCapture?.settleAssertion("passed");
  } catch (error) {
    m7pCapture?.settleAssertion("failed", error instanceof Error ? error.message : String(error));
    await m7pCapture?.recordBrowserEvaluation("assertion-failure-catch");
    const syntheticStallError = await syntheticStallSettled;
    if (syntheticStallError) throw new Error(`M7P synthetic stall failed: ${syntheticStallError}`, { cause: error });
    await m7pCapture?.finish();
    m7oCapture?.settleAssertion("failed", error instanceof Error ? error.message : String(error));
    if (m7oCapture) {
      await m7oCapture.captureBoundary("immediate-canvas-assertion-failure-snapshot");
    }
    await finishM7nCapture?.("canvas-count-assertion-failure");
    if (m7oCapture) {
      if (process.env.M7O_POST_FAILURE_POLL === "1") {
        m7oCapture.mark("separate-diagnostic-expect-poll-started", { timeoutMs: canvasCountTimeoutMs });
        let diagnosticPollResult: "passed" | "failed" = "failed";
        let diagnosticPollError: string | null = null;
        try {
          await expect.poll(async () => {
            const nodeRequestStartMs = performance.now();
            const browser = await page.evaluate(() => {
              const diagnostics = (window as Window & {
                __m7oCanvasTimingCapture?: { observeDom: () => Record<string, unknown> };
              }).__m7oCanvasTimingCapture;
              return diagnostics?.observeDom() ?? null;
            });
            const nodeResponseEndMs = performance.now();
            const dom = browser;
            const scenes = Array.isArray(dom?.sceneContainers) ? dom.sceneContainers as Array<Record<string, unknown>> : [];
            const canvases = scenes.flatMap((container) => Array.isArray(container.canvases)
              ? container.canvases as Array<Record<string, unknown>>
              : []);
            m7oCapture?.recordPollObservation({
              nodeRequestStartMs,
              nodeResponseEndMs,
              browserMonotonicMs: typeof browser?.sampledAtPageMonotonicMs === "number"
                ? browser.sampledAtPageMonotonicMs
                : null,
              count: canvases.length,
              documentIdentity: typeof dom?.documentIdentity === "string" ? dom.documentIdentity : null,
              sceneContainerIdentities: scenes.flatMap((container) => typeof container.identity === "string" ? [container.identity] : []),
              canvasIdentities: canvases.flatMap((canvas) => typeof canvas.identity === "string" ? [canvas.identity] : []),
            });
            return canvases.length;
          }, { timeout: canvasCountTimeoutMs }).toBe(1);
          diagnosticPollResult = "passed";
        } catch (pollError) {
          diagnosticPollError = pollError instanceof Error ? pollError.message.split("\n")[0] : String(pollError);
        }
        m7oCapture.mark("separate-diagnostic-expect-poll-settled", {
          result: diagnosticPollResult,
          errorSummary: diagnosticPollError,
          primaryAssertionOutcomeUnchanged: "failed",
        });
      }
    }
    throw error;
  }
  const syntheticStallError = await syntheticStallSettled;
  if (syntheticStallError) throw new Error(`M7P synthetic stall failed: ${syntheticStallError}`);
  await m7pCapture?.recordBrowserEvaluation("assertion-settlement-snapshot");
  await m7pCapture?.finish();
  await expect(scene).toHaveAttribute("data-optics-fallback-applied", "false");
  await expect(focus).toBeEnabled();
  await expect(focus).toHaveValue("8890");
  await expect(focus).toHaveAttribute("min", "3090");
  await expect(focus).toHaveAttribute("max", "13000");
  await page.screenshot({ path: testInfo.outputPath("architecture-rise-focus-canonical.png") });

  // Home is a standard accessible range-control action and reaches the public
  // minimum without hundreds of expensive intermediate WebGL updates.
  await focus.focus();
  await focus.press("Home");
  await expect(focus).toHaveValue("3090");

  const lens = await readVector(scene, "data-camera-lens-center-world");
  const film = await readVector(scene, "data-camera-film-center-world");
  const lensToFilmDistanceMm = distance(lens, film);
  expect(lensToFilmDistanceMm).toBeCloseTo((150 * 3090) / (3090 - 150), 2);
  expect(lensToFilmDistanceMm).toBeLessThan(160);
  expect(lensToFilmDistanceMm).toBeLessThan(2400);
  await page.screenshot({ path: testInfo.outputPath("architecture-rise-focus-minimum.png") });
});

test("Architecture Rise exposes visible blur for the reported strong-defocus state", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");

  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt").first();
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });

  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await setStepRangeInput(page, "Rise", 22);
  await setStepRangeInput(page, "Tilt", 0.4);
  await setStepRangeInput(page, "Swing", -1.1);
  await focus.focus();
  await focus.press("End");
  await expect(focus).toHaveValue("13000");
  await aperture.getByRole("radio", { name: "f/5.6" }).check();

  await expect(focus).toHaveValue("13000");
  await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  await expect(scene).toHaveAttribute("data-optics-fallback-applied", "false");
  const fullFilmScale = await expectGroundGlassPhysicalScale(rtt);
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await expect.poll(() => readFocusDistributionPercent(page, { targetId: "building-mid-facade" })).toBe(0);
  await testInfo.attach("architecture-rise-strong-defocus-physical-blur-scale", {
    body: JSON.stringify(fullFilmScale),
    contentType: "application/json",
  });
  await writeFile(
    testInfo.outputPath("architecture-rise-strong-defocus-physical-blur-scale.json"),
    JSON.stringify(fullFilmScale, null, 2),
  );
  await page.screenshot({ path: testInfo.outputPath("architecture-rise-strong-defocus.png") });
  await rtt.locator("canvas").screenshot({ path: testInfo.outputPath("architecture-rise-strong-defocus-ground-glass.png") });

  const loupeButton = page.getByRole("button", { name: /Focus loupe.*Ground Glass view/ });
  await loupeButton.click();
  await expect(rtt).toHaveAttribute("data-rtt-inspection-window-active", "true");
  const loupeScale = await expectGroundGlassPhysicalScale(rtt);
  expect(loupeScale.physicalBoundaryRadiusPx / fullFilmScale.physicalBoundaryRadiusPx).toBeCloseTo(
    fullFilmScale.sampledFilmWidthMm / loupeScale.sampledFilmWidthMm,
    4,
  );
  await page.screenshot({ path: testInfo.outputPath("architecture-rise-strong-defocus-focus-loupe.png") });
  await rtt.locator("canvas").screenshot({ path: testInfo.outputPath("architecture-rise-strong-defocus-focus-loupe-ground-glass.png") });
  await testInfo.attach("architecture-rise-focus-loupe-physical-scale", {
    body: JSON.stringify({ fullFilmScale, loupeScale }),
    contentType: "application/json",
  });
});
