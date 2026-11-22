import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { setStepRangeInput } from "../e2e/helpers/stepRangeInput";

const SCENE_PATH = "/simulator/free/architecture-rise";
const GUIDED_PATH = "/simulator/guided/architecture-rise/rise-01";
const FIXED_SEEDS = [
  0, 1, 284719, 4294967295, 3079748268, 654013979,
  4041585854, 2762659077, 2004402848, 1824298367,
  2130322642, 4065361417,
] as const;
const FAMILY_BY_SEED: Record<number, string> = {
  0: "weathered-brown-brick",
  1: "weathered-brown-brick",
  284719: "traditional-red-brick",
  4294967295: "weathered-brown-brick",
  3079748268: "light-clay-brick",
  654013979: "light-clay-brick",
  4041585854: "weathered-brown-brick",
  2762659077: "traditional-red-brick",
  2004402848: "light-clay-brick",
  1824298367: "light-clay-brick",
  2130322642: "dark-fired-brick",
  4065361417: "dark-fired-brick",
};
const CAPTURE_ROOT = join(process.cwd(), ".dream-loop/architecture-rise/wave2/captures/root");

test.use({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

const waitForObserver = async (page: Page) => {
  const observer = page.getByTestId("scene-canvas");
  const quality = page.getByRole("combobox", { name: "Render quality", exact: true });
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer.locator("canvas")).toHaveCount(1, { timeout: 90_000 });
  await quality.selectOption("standard");
  await expect(quality).toHaveValue("standard");
  const closeLearningDrawer = page.getByRole("button", { name: "Close Task and Feedback", exact: true });
  if (await closeLearningDrawer.count() && await closeLearningDrawer.isVisible()) {
    await closeLearningDrawer.click();
  }
  const overlayTrigger = page.getByRole("button", { name: "View overlays", exact: true });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const inline = page.getByTestId("scene-overlay-inline");
    const collapsed = page.getByTestId("scene-overlay-collapsed");
    let group: Locator;
    if (await inline.count() === 1 && await inline.isVisible()) {
      group = inline;
    } else {
      group = collapsed;
      if (await group.count() === 0 || !(await group.isVisible())) await overlayTrigger.click();
      await expect(group).toBeVisible();
    }
    const active = group.locator('button[aria-pressed="true"]');
    if (await active.count() === 0) break;
    await active.first().click();
  }
  await expect(observer).toHaveAttribute("data-optical-geometry-visible", "false");
  await expect(observer).toHaveAttribute("data-focus-overlay-visible", "false");
  await expect(observer).toHaveAttribute("data-dof-overlay-visible", "false");
  await expect(page.locator('[data-testid^="scene-overlay-"] button[aria-pressed="true"]')).toHaveCount(0);
  if (await overlayTrigger.getAttribute("aria-expanded") === "true") await overlayTrigger.click();
  return observer;
};

const captureSurfaceWithoutDomOverlays = async (surface: Locator): Promise<Buffer> => {
  const marker = "data-architecture-rise-capture-style";
  await surface.evaluate((target, attribute) => {
    const bounds = target.getBoundingClientRect();
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element === target || element.contains(target) || target.contains(element)) return;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = element.getBoundingClientRect();
      const overlaps = rect.width > 0 && rect.height > 0 &&
        rect.right > bounds.left && rect.left < bounds.right &&
        rect.bottom > bounds.top && rect.top < bounds.bottom;
      if (!overlaps) return;
      element.setAttribute(attribute, element.getAttribute("style") ?? "__no-inline-style__");
      element.style.setProperty("visibility", "hidden", "important");
    });
  }, marker);
  try {
    return await surface.screenshot({ animations: "disabled" });
  } finally {
    await surface.evaluate((_, attribute) => {
      document.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((element) => {
        const previous = element.getAttribute(attribute);
        if (previous === "__no-inline-style__") element.removeAttribute("style");
        else if (previous !== null) element.setAttribute("style", previous);
        element.removeAttribute(attribute);
      });
    }, marker);
  }
};

const waitForCurrentFrame = async (rtt: Locator) => {
  await expect.poll(async () => {
    const requestId = await rtt.getAttribute("data-frame-request-id");
    const completedRequestId = await rtt.getAttribute("data-last-completed-request-id");
    return Boolean(requestId && requestId === completedRequestId);
  }, { timeout: 90_000 }).toBe(true);
  await expect(rtt).toHaveAttribute("data-frame-result-status", "completed");
};

const seededRoute = (seed: number) => `${SCENE_PATH}?seed=${seed}&sv=1`;

const saveCapture = async (
  page: Page,
  locator: Locator,
  name: string,
  metadata: Record<string, unknown>,
) => {
  mkdirSync(CAPTURE_ROOT, { recursive: true });
  const png = await captureSurfaceWithoutDomOverlays(locator);
  writeFileSync(join(CAPTURE_ROOT, `${name}.png`), png);
  const digest = createHash("sha256").update(png).digest("hex");
  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  }));
  writeFileSync(join(CAPTURE_ROOT, `${name}.json`), `${JSON.stringify({
    ...metadata,
    capture: name,
    viewport,
    sha256: digest,
    source: "Chromium production Vite preview · WebGL2",
    captureDomOverlays: "temporarily hidden and restored after native canvas capture",
  }, null, 2)}\n`);
  return { png, digest };
};

test("production preview captures all frozen material families and replays the same seed", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  let originalReplayPng: Buffer | null = null;
  for (const seed of FIXED_SEEDS) {
    await page.goto(seededRoute(seed));
    const observer = await waitForObserver(page);
    const controls = page.getByTestId("scene-variation-controls");
    await expect(controls).toHaveAttribute("data-active-seed", String(seed));
    await expect(controls).toHaveAttribute("data-active-schema", "1");
    await expect(controls).toContainText(`Seed ${seed} · schema v1`);
    await expect(page.getByRole("combobox", { name: "Render quality", exact: true })).toHaveValue("standard");
    const canvas = observer.locator("canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThan(700);
    expect(box!.height).toBeLessThan(600);
    const capture = await saveCapture(page, canvas, `observer-seed-${seed}`, {
      mode: "free",
      sceneId: "architecture-rise",
      seed,
      schemaVersion: 1,
      family: FAMILY_BY_SEED[seed],
      view: "canonical front three-quarter",
      canvasCssPixels: { width: box!.width, height: box!.height },
      overlays: "disabled through public View overlays controls",
    });
    if (seed === 284719) originalReplayPng = capture.png;
  }

  await page.goto(seededRoute(284719));
  const replayObserver = await waitForObserver(page);
  const replayPng = await captureSurfaceWithoutDomOverlays(replayObserver.locator("canvas").first());
  expect(originalReplayPng).not.toBeNull();
  expect(replayPng).toEqual(originalReplayPng);
  await testInfo.attach("architecture-rise-seed-284719-replay.png", {
    body: replayPng,
    contentType: "image/png",
  });
  expect(pageErrors).toEqual([]);
});

test("production preview captures the east return and rear-side diagnostic observer views", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(seededRoute(284719));
  const observer = await waitForObserver(page);
  const canvas = observer.locator("canvas").first();
  const resetView = page.getByRole("button", { name: "Reset 3D view", exact: true });
  const initialPosition = await observer.getAttribute("data-observer-camera-position");
  const initialTarget = await observer.getAttribute("data-orbit-target");
  expect(initialPosition).toBeTruthy();
  expect(initialTarget).toBeTruthy();

  const orbitAndCapture = async (name: string, deltaX: number, view: string) => {
    await resetView.click();
    await expect.poll(() => observer.getAttribute("data-observer-camera-position")).toBe(initialPosition);
    await expect.poll(() => observer.getAttribute("data-orbit-target")).toBe(initialTarget);
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("Architecture Rise Observer canvas is not visible for orbit input");
    const x = bounds.x + bounds.width * 0.28;
    const y = bounds.y + bounds.height * 0.48;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + deltaX, y, { steps: 10 });
    await page.mouse.up();
    await expect.poll(() => observer.getAttribute("data-observer-camera-position"))
      .not.toBe(initialPosition);
    await expect.poll(() => observer.getAttribute("data-orbit-target")).toBe(initialTarget);
    const cameraPosition = await observer.getAttribute("data-observer-camera-position");
    const orbitTarget = await observer.getAttribute("data-orbit-target");
    const position = cameraPosition?.split(",").map(Number) ?? [];
    expect(position).toHaveLength(3);
    if (view.startsWith("east service-return")) {
      expect(position[0]).toBeGreaterThan(10);
      expect(position[2]).toBeGreaterThan(7);
      expect(position[2]).toBeLessThan(12);
    } else {
      expect(position[2]).toBeGreaterThan(15);
      expect(Math.abs(position[0])).toBeLessThan(2);
    }
    await saveCapture(page, canvas, name, {
      mode: "free",
      sceneId: "architecture-rise",
      seed: 284719,
      schemaVersion: 1,
      family: FAMILY_BY_SEED[284719],
      view,
      orbitDeltaXCssPixels: deltaX,
      cameraPosition,
      orbitTarget,
      frontRiseMm: Number(await page.getByRole("slider", { name: "Rise", exact: true }).inputValue()),
      focusDistanceMm: Number(await page.getByRole("slider", { name: "Focus distance", exact: true }).inputValue()),
      aperture: Number((await page.getByRole("radiogroup", { name: "Aperture", exact: true })
        .getAttribute("data-selected-aperture")) ?? "0"),
    });
  };

  await orbitAndCapture("observer-east-return", 90, "east service-return elevation orbit diagnostic");
  await orbitAndCapture("observer-rear-side", 174, "rear elevation orbit diagnostic");
});

test("Regenerate preserves camera, preview, Observer canvas, RTT canvas and browser history", async ({ page }) => {
  test.setTimeout(180_000);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(seededRoute(284719));
  const observer = await waitForObserver(page);
  const rtt = page.getByTestId("ground-glass-rtt");
  const controls = page.getByTestId("scene-variation-controls");
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const rise = page.getByRole("slider", { name: "Rise", exact: true });
  const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  const rawPreview = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
  await waitForCurrentFrame(rtt);

  const initialCameraPosition = await observer.getAttribute("data-observer-camera-position");
  const orbitTarget = await observer.getAttribute("data-orbit-target");
  const observerCanvas = observer.locator("canvas").first();
  const observerBounds = await observerCanvas.boundingBox();
  expect(initialCameraPosition).toBeTruthy();
  expect(orbitTarget).toBeTruthy();
  expect(observerBounds).not.toBeNull();
  const orbitX = observerBounds!.x + observerBounds!.width * 0.28;
  const orbitY = observerBounds!.y + observerBounds!.height * 0.48;
  await page.mouse.move(orbitX, orbitY);
  await page.mouse.down();
  await page.mouse.move(orbitX + 40, orbitY, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => observer.getAttribute("data-observer-camera-position"))
    .not.toBe(initialCameraPosition);
  const orbitCameraPosition = await observer.getAttribute("data-observer-camera-position");

  const focusCurrent = Number(await focus.inputValue());
  const focusStep = Number(await focus.getAttribute("step"));
  const focusMax = Number(await focus.getAttribute("max"));
  const focusTarget = Math.min(focusMax, focusCurrent + focusStep * 2);
  await setStepRangeInput(page, "Focus distance", focusTarget);
  await setStepRangeInput(page, "Rise", 12);
  await aperture.getByRole("radio", { name: "f/8", exact: true }).check();
  await rawPreview.check();
  await waitForCurrentFrame(rtt);

  await observer.locator("canvas").evaluate((canvas) => {
    (window as Window & { __architectureRiseObserverCanvas?: Element }).__architectureRiseObserverCanvas = canvas;
  });
  await rtt.locator("canvas").first().evaluate((canvas) => {
    (window as Window & { __architectureRiseGroundGlassCanvas?: Element }).__architectureRiseGroundGlassCanvas = canvas;
  });
  const previousRequestId = await rtt.getAttribute("data-frame-request-id");
  const oldSeed = await controls.getAttribute("data-active-seed");
  await controls.getByRole("button", { name: "Regenerate scene", exact: true }).click();
  await expect(controls).not.toHaveAttribute("data-active-seed", oldSeed ?? "");
  const newSeed = await controls.getAttribute("data-active-seed");
  expect(newSeed).toMatch(/^(0|[1-9][0-9]*)$/);
  expect(Number(newSeed)).not.toBe(Number(oldSeed));
  await expect(focus).toHaveValue(String(focusTarget));
  await expect(rise).toHaveValue("12");
  await expect(aperture).toHaveAttribute("data-selected-aperture", "8");
  await expect(observer).toHaveAttribute("data-observer-camera-position", orbitCameraPosition ?? "");
  await expect(observer).toHaveAttribute("data-orbit-target", orbitTarget ?? "");
  await expect(rawPreview).toBeChecked();
  await expect(rtt).toHaveAttribute("data-rtt-preview-mode", "raw");
  await expect(rtt).toHaveAttribute("data-rtt-dof-processing-enabled", "true");
  await expect.poll(() => rtt.getAttribute("data-frame-request-id"))
    .not.toBe(previousRequestId);
  await waitForCurrentFrame(rtt);
  const canvasIdentity = await page.evaluate(() => ({
    observerSame: document.querySelector('[data-testid="scene-canvas"] canvas') ===
      (window as Window & { __architectureRiseObserverCanvas?: Element }).__architectureRiseObserverCanvas,
    groundGlassSame: document.querySelector('[data-testid="ground-glass-rtt"] canvas') ===
      (window as Window & { __architectureRiseGroundGlassCanvas?: Element }).__architectureRiseGroundGlassCanvas,
  }));
  expect(canvasIdentity).toEqual({ observerSame: true, groundGlassSame: true });

  await page.getByRole("button", { name: "Copy share URL", exact: true }).click();
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedUrl).toBe(page.url());
  expect(new URL(copiedUrl).pathname).toBe(SCENE_PATH);
  expect(new URL(copiedUrl).searchParams.get("seed")).toBe(newSeed);
  expect(new URL(copiedUrl).searchParams.get("sv")).toBe("1");
  await page.goBack();
  await expect(controls).toHaveAttribute("data-active-seed", oldSeed ?? "");
  await page.goForward();
  await expect(controls).toHaveAttribute("data-active-seed", newSeed ?? "");
});

test("ten Regenerate actions reuse the renderers and Ground Glass render targets", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(seededRoute(0));
  const observer = await waitForObserver(page);
  const rtt = page.getByTestId("ground-glass-rtt");
  const controls = page.getByTestId("scene-variation-controls");
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const rise = page.getByRole("slider", { name: "Rise", exact: true });
  const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  await waitForCurrentFrame(rtt);
  const initialRttResourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  const initialRttRendererGeneration = await rtt.getAttribute("data-renderer-generation");
  await observer.locator("canvas").evaluate((canvas) => {
    (window as Window & { __architectureRiseStableObserverCanvas?: Element }).__architectureRiseStableObserverCanvas = canvas;
    (window as Window & { __architectureRiseStableObserverContext?: RenderingContext | null }).__architectureRiseStableObserverContext =
      (canvas as HTMLCanvasElement).getContext("webgl2");
  });
  await rtt.locator("canvas").first().evaluate((canvas) => {
    (window as Window & { __architectureRiseStableRttCanvas?: Element }).__architectureRiseStableRttCanvas = canvas;
    (window as Window & { __architectureRiseStableRttContext?: RenderingContext | null }).__architectureRiseStableRttContext =
      (canvas as HTMLCanvasElement).getContext("webgl2");
  });

  const seeds: number[] = [0];
  for (let index = 0; index < 10; index += 1) {
    const previousSeed = Number(await controls.getAttribute("data-active-seed"));
    const previousRequestId = await rtt.getAttribute("data-frame-request-id");
    await controls.getByRole("button", { name: "Regenerate scene", exact: true }).click();
    await expect.poll(async () => Number(await controls.getAttribute("data-active-seed")))
      .not.toBe(previousSeed);
    const nextSeed = Number(await controls.getAttribute("data-active-seed"));
    seeds.push(nextSeed);
    await expect(focus).toHaveValue("8890");
    await expect(rise).toHaveValue("0");
    await expect(aperture).toHaveAttribute("data-selected-aperture", "11");
    await expect.poll(() => rtt.getAttribute("data-frame-request-id"))
      .not.toBe(previousRequestId);
    await waitForCurrentFrame(rtt);
    await expect(rtt).toHaveAttribute("data-rtt-resource-generation", initialRttResourceGeneration ?? "");
    if (initialRttRendererGeneration !== null) {
      await expect(rtt).toHaveAttribute("data-renderer-generation", initialRttRendererGeneration);
    }
    const lifecycle = await page.evaluate(() => {
      const state = window as Window & {
        __architectureRiseStableObserverCanvas?: Element;
        __architectureRiseStableObserverContext?: RenderingContext | null;
        __architectureRiseStableRttCanvas?: Element;
        __architectureRiseStableRttContext?: RenderingContext | null;
      };
      const observerCanvas = document.querySelector('[data-testid="scene-canvas"] canvas') as HTMLCanvasElement | null;
      const rttCanvas = document.querySelector('[data-testid="ground-glass-rtt"] canvas') as HTMLCanvasElement | null;
      return {
        observerCanvasStable: observerCanvas === state.__architectureRiseStableObserverCanvas,
        observerContextStable: observerCanvas?.getContext("webgl2") === state.__architectureRiseStableObserverContext,
        rttCanvasStable: rttCanvas === state.__architectureRiseStableRttCanvas,
        rttContextStable: rttCanvas?.getContext("webgl2") === state.__architectureRiseStableRttContext,
      };
    });
    expect(lifecycle).toEqual({
      observerCanvasStable: true,
      observerContextStable: true,
      rttCanvasStable: true,
      rttContextStable: true,
    });
  }
  expect(new Set(seeds).size).toBe(11);
});

test("Ground Glass shows three material families in Raw and Upright at normal display size", async ({ page }, testInfo) => {
  test.setTimeout(480_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const seeds = [284719, 3079748268, 2130322642] as const;

  for (const seed of seeds) {
    await page.goto(seededRoute(seed));
    await waitForObserver(page);
    const variation = page.getByTestId("scene-variation-controls");
    await expect(variation).toHaveAttribute("data-active-seed", String(seed));
    await expect(variation).toHaveAttribute("data-active-schema", "1");
    expect(new URL(page.url()).searchParams.get("seed")).toBe(String(seed));
    expect(new URL(page.url()).searchParams.get("sv")).toBe("1");
    const rtt = page.getByTestId("ground-glass-rtt");
    await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-rise");
    await expect(rtt).toHaveAttribute("data-frame-scene-id", "architecture-rise");
    await expect(rtt).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 90_000 });
    await expect(rtt).toHaveAttribute("data-actual-execution-api", "webgl2");
    const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
    await expect(focus).toHaveValue("8890");
    const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
    await aperture.getByRole("radio", { name: "f/11", exact: true }).check();
    const grid = page.getByRole("checkbox", { name: "Grid", exact: true });
    await expect(grid).toBeEnabled();
    if (await grid.isEnabled() && await grid.isChecked()) await grid.uncheck();
    await expect(grid).not.toBeChecked();
    await expect(page.getByTestId("ground-glass-grid")).toHaveCount(0);
    await expect(rtt).toHaveAttribute("data-rtt-raw-debug", "false");
    const rawDebug = page.getByLabel("Raw RTT — bypass DOF");
    if (await rawDebug.count()) await expect(rawDebug).not.toBeChecked();

    for (const [orientation, label] of [
      ["raw", "Raw Ground Glass"],
      ["upright", "Upright Assist"],
    ] as const) {
      const preview = page.getByRole("radio", { name: label, exact: true });
      const modeAlreadySelected = await rtt.getAttribute("data-rtt-preview-mode") === orientation;
      const previousRequestId = await rtt.getAttribute("data-frame-request-id");
      await preview.check();
      await expect(rtt).toHaveAttribute("data-rtt-preview-mode", orientation);
      await expect(rtt).toHaveAttribute("data-rtt-dof-processing-enabled", "true");
      await expect(rtt).toHaveAttribute("data-rtt-raw-debug", "false");
      if (!modeAlreadySelected) {
        await expect.poll(() => rtt.getAttribute("data-frame-request-id")).not.toBe(previousRequestId);
      }
      await waitForCurrentFrame(rtt);
      const requestId = await rtt.getAttribute("data-frame-request-id");
      const completedRequestId = await rtt.getAttribute("data-last-completed-request-id");
      expect(requestId).toBe(completedRequestId);
      const filename = `ground-glass-seed-${seed}-f11-${orientation}`;
      await saveCapture(page, rtt.locator("canvas").first(), filename, {
        mode: "free",
        sceneId: "architecture-rise",
        seed,
        schemaVersion: 1,
        family: FAMILY_BY_SEED[seed],
        focusDistanceMm: Number(await focus.inputValue()),
        aperture: 11,
        frontRiseMm: Number(await page.getByRole("slider", { name: "Rise", exact: true }).inputValue()),
        previewOrientation: orientation,
        dofBypass: false,
        gridEnabled: await grid.isChecked(),
        rttRequestId: requestId,
        rttCompletedRequestId: completedRequestId,
        rendererGeneration: await rtt.getAttribute("data-renderer-generation"),
      });
    }

    if (seed === 284719) {
      const beforeRawRequestId = await rtt.getAttribute("data-frame-request-id");
      await page.getByRole("radio", { name: "Raw Ground Glass", exact: true }).check();
      await expect(rtt).toHaveAttribute("data-rtt-preview-mode", "raw");
      await expect.poll(() => rtt.getAttribute("data-frame-request-id")).not.toBe(beforeRawRequestId);
      await waitForCurrentFrame(rtt);
      const beforeApertureRequestId = await rtt.getAttribute("data-frame-request-id");
      await aperture.getByRole("radio", { name: "f/5.6", exact: true }).check();
      await expect.poll(() => rtt.getAttribute("data-frame-request-id")).not.toBe(beforeApertureRequestId);
      await waitForCurrentFrame(rtt);
      await saveCapture(page, rtt.locator("canvas").first(), "ground-glass-seed-284719-f5_6-raw", {
        mode: "free",
        sceneId: "architecture-rise",
        seed,
        schemaVersion: 1,
        family: FAMILY_BY_SEED[seed],
        focusDistanceMm: Number(await focus.inputValue()),
        aperture: 5.6,
        frontRiseMm: 0,
        previewOrientation: "raw",
        dofBypass: false,
        gridEnabled: await grid.isChecked(),
        rttRequestId: await rtt.getAttribute("data-frame-request-id"),
        rttCompletedRequestId: await rtt.getAttribute("data-last-completed-request-id"),
      });
      await aperture.getByRole("radio", { name: "f/11", exact: true }).check();
      const beforeRiseRequestId = await rtt.getAttribute("data-frame-request-id");
      await setStepRangeInput(page, "Rise", 20);
      await expect.poll(() => rtt.getAttribute("data-frame-request-id")).not.toBe(beforeRiseRequestId);
      await waitForCurrentFrame(rtt);
      await saveCapture(page, rtt.locator("canvas").first(), "ground-glass-seed-284719-f11-rise20-raw", {
        mode: "free",
        sceneId: "architecture-rise",
        seed,
        schemaVersion: 1,
        family: FAMILY_BY_SEED[seed],
        focusDistanceMm: Number(await focus.inputValue()),
        aperture: 11,
        frontRiseMm: Number(await page.getByRole("slider", { name: "Rise", exact: true }).inputValue()),
        previewOrientation: "raw",
        dofBypass: false,
        gridEnabled: await grid.isChecked(),
        rttRequestId: await rtt.getAttribute("data-frame-request-id"),
        rttCompletedRequestId: await rtt.getAttribute("data-last-completed-request-id"),
      });
    }
  }
  expect(pageErrors).toEqual([]);
  await testInfo.attach("architecture-rise-ground-glass-capture-index.json", {
    body: Buffer.from(JSON.stringify({
      seeds: seeds.map((seed) => ({ seed, family: FAMILY_BY_SEED[seed] })),
      states: ["neutral f/11 Raw", "neutral f/11 Upright Assist", "neutral f/5.6 Raw", "Front Rise 20 mm f/11 Raw"],
      dpr: 1,
      viewport: [1440, 1000],
    }, null, 2)),
    contentType: "application/json",
  });
});

test("guided Architecture Rise remains canonical and ignores seeded query parameters", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`${GUIDED_PATH}?seed=284719&sv=1`);
  await expect(page.getByRole("heading", { name: "Frame the building with Front Rise" })).toBeVisible();
  const observer = await waitForObserver(page);
  expect(new URL(page.url()).searchParams.has("seed")).toBe(false);
  expect(new URL(page.url()).searchParams.has("sv")).toBe(false);
  await expect(page.getByTestId("scene-variation-controls")).toHaveCount(0);
  await saveCapture(page, observer.locator("canvas"), "guided-canonical", {
    mode: "guided",
    sceneId: "architecture-rise",
    taskId: "rise-01",
    appearance: "canonical materials; no variation descriptor",
  });
});
