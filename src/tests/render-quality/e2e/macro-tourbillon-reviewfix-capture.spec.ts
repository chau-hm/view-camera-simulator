import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { setStepRangeInput } from "../../e2e/helpers/stepRangeInput";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const evidenceDirectory = resolve(process.env.MACRO_TOURBILLON_EVIDENCE_DIR ??
  resolve(repositoryRoot, "docs/render-quality/macro-tourbillon-reviewfix/evidence"));
const sceneId = "macro-bellows-extension";
const baseRoute = `/simulator/free/${sceneId}?rttDiagnostics=1&sceneCapacityProfiling=1&groundGlassProfiling=1&macroWatchCage=static`;
const states = [
  { id: "b1-initial", focus: 900, aperture: 5.6 },
  { id: "b2-intermediate", focus: 450, aperture: 5.6 },
  { id: "b3-life-size", focus: 300, aperture: 5.6 },
  { id: "b4-life-size-f11", focus: 300, aperture: 11 },
  { id: "b5-life-size-f22", focus: 300, aperture: 22 },
] as const;

type FrameState = {
  requestId: string;
  completedRequestId: string;
  lifecycle: string;
  status: string;
  contentful: string;
};

const readFrame = (rtt: Locator): Promise<FrameState> => rtt.evaluate((element) => ({
  requestId: element.getAttribute("data-frame-request-id") ?? "",
  completedRequestId: element.getAttribute("data-last-completed-request-id") ?? "",
  lifecycle: element.getAttribute("data-render-host-lifecycle") ?? "",
  status: element.getAttribute("data-frame-result-status") ?? "",
  contentful: element.getAttribute("data-rtt-final-contentful") ?? "",
}));

const waitForAcceptedFrame = async (
  rtt: Locator,
  previousRequestId?: string,
): Promise<FrameState> => {
  await expect.poll(async () => {
    const frame = await readFrame(rtt);
    return frame.lifecycle === "ready" && frame.status === "completed" &&
      frame.requestId.length > 0 &&
      frame.requestId === frame.completedRequestId &&
      (previousRequestId === undefined || frame.requestId !== previousRequestId);
  }, { timeout: 120_000 }).toBe(true);
  return readFrame(rtt);
};

const adapterForCanvas = async (canvas: Locator) => canvas.evaluate((element) => {
  const node = element as HTMLCanvasElement;
  const gl = node.getContext("webgl2") ?? node.getContext("webgl");
  if (!gl) return { api: "unavailable", vendor: "unavailable", renderer: "unavailable" };
  const extension = gl.getExtension("WEBGL_debug_renderer_info") as {
    UNMASKED_VENDOR_WEBGL: number;
    UNMASKED_RENDERER_WEBGL: number;
  } | null;
  return {
    api: gl instanceof WebGL2RenderingContext ? "webgl2" : "webgl",
    vendor: extension ? String(gl.getParameter(extension.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR)),
    renderer: extension ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
    contextLost: gl.isContextLost(),
  };
});

const samplePageFrameCadence = async (page: Page, durationMs = 5_000) => page.evaluate((duration) =>
  new Promise((resolveSamples) => {
    const samples: number[] = [];
    let previous: number | null = null;
    const start = performance.now();
    const sample = (now: number) => {
      if (previous !== null) samples.push(now - previous);
      previous = now;
      if (now - start >= duration) {
        const sorted = [...samples].sort((a, b) => a - b);
        const at = (fraction: number) => sorted.length
          ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]
          : null;
        resolveSamples({ count: samples.length, p50Ms: at(0.5), p95Ms: at(0.95) });
        return;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }), durationMs);

const readMetrics = async (page: Page, rtt: Locator) => {
  const [profileJson, sceneCapacityJson, rendererStatsJson, rttState] = await Promise.all([
    rtt.getAttribute("data-rtt-profiling-snapshot"),
    rtt.getAttribute("data-rtt-scene-capacity"),
    rtt.getAttribute("data-rtt-renderer-stats"),
    rtt.evaluate((element) => Object.fromEntries(
      Array.from(element.attributes)
        .filter(({ name }) => name.startsWith("data-rtt-") || name.startsWith("data-frame-") || name.startsWith("data-render-host-"))
        .map(({ name, value }) => [name, value]),
    )),
  ]);
  const sceneCapacityText = await page.locator('[data-testid="scene-capacity-snapshot"]').textContent().catch(() => null);
  return {
    groundGlassProfile: profileJson ? JSON.parse(profileJson) : null,
    groundGlassSceneCapacity: sceneCapacityJson ? JSON.parse(sceneCapacityJson) : null,
    groundGlassRendererStats: rendererStatsJson ? JSON.parse(rendererStatsJson) : null,
    fullSceneCapacity: sceneCapacityText ? JSON.parse(sceneCapacityText) : null,
    rttState,
  };
};

const saveCanvas = async (
  canvas: Locator,
  filename: string,
  options: { captureDeviceScale?: boolean; hideGroundGlassGuides?: boolean } = {},
): Promise<{ path: string; imageResolution: { width: number; height: number } }> => {
  const output = resolve(evidenceDirectory, filename);
  await canvas.evaluate((node, captureOptions) => {
    const bounds = node.getBoundingClientRect();
    const selectors = [
      "button", "a[href]", "[role='button']", "[data-testid='ground-glass-grid']",
      "[data-testid='ground-glass-focus-label']", "[data-testid='ground-glass-scale-cue']",
      "[data-testid='ground-glass-image-layer'] + div",
    ];
    const candidates = new Set(Array.from(document.querySelectorAll<HTMLElement>(selectors.join(","))));
    document.querySelectorAll<HTMLElement>("div").forEach((element) => {
      const text = element.textContent?.trim() ?? "";
      if (element.style.borderLeft || element.style.borderTop ||
          text === "Ground glass preview" || text.startsWith("Grid:")) candidates.add(element);
    });
    const overlapping = Array.from(candidates)
      .filter((candidate) => {
        if (candidate === node || candidate.contains(node) || node.contains(candidate)) return false;
        if (candidate.matches("[data-testid='ground-glass-grid']")) return true;
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.left < bounds.right && rect.right > bounds.left &&
          rect.top < bounds.bottom && rect.bottom > bounds.top;
      });
    for (const candidate of overlapping) {
      candidate.dataset.macroReviewfixPreviousVisibility = candidate.style.visibility;
      candidate.style.visibility = "hidden";
    }
    if (captureOptions.hideGroundGlassGuides) {
      node.querySelectorAll<HTMLElement>("div").forEach((element) => {
        if (!element.style.borderLeft && !element.style.borderTop) return;
        element.dataset.macroReviewfixPreviousVisibility = element.style.visibility;
        element.style.visibility = "hidden";
      });
    }
  }, options);
  try {
    const png = await canvas.screenshot({
      animations: "disabled",
      scale: options.captureDeviceScale ? "device" : "css",
    });
    await writeFile(output, png);
    return {
      path: output,
      imageResolution: { width: png.readUInt32BE(16), height: png.readUInt32BE(20) },
    };
  } finally {
    await canvas.evaluate(() => {
      document.querySelectorAll<HTMLElement>("[data-macro-reviewfix-previous-visibility]").forEach((candidate) => {
        candidate.style.visibility = candidate.dataset.macroReviewfixPreviousVisibility ?? "";
        delete candidate.dataset.macroReviewfixPreviousVisibility;
      });
    });
  }
};

test("hardware review captures watch fidelity, optical states and render cost", async ({ page, browser }, testInfo) => {
  test.setTimeout(12 * 60_000);
  await mkdir(evidenceDirectory, { recursive: true });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
    if (message.type() === "warning") runtimeWarnings.push(message.text());
  });

  const captures: Array<Record<string, unknown>> = [];
  const measurements: Array<Record<string, unknown>> = [];
  const runtimeWarnings: string[] = [];

  const openScene = async (route = baseRoute) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const sceneCanvas = page.getByTestId("scene-canvas");
    const observerCanvas = sceneCanvas.locator("canvas");
    const groundGlassCanvas = page.locator(".groundglass-renderer-host canvas");
    const rtt = page.getByTestId("ground-glass-rtt");
    await expect(page.getByRole("slider", { name: "Focus distance" })).toBeVisible({ timeout: 120_000 });
    await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", sceneId);
    await expect(rtt).toHaveAttribute("data-rtt-scene-id", sceneId);
    await expect(observerCanvas).toHaveCount(1);
    await expect(groundGlassCanvas).toHaveCount(1);
    const observerAdapter = await adapterForCanvas(observerCanvas);
    const groundGlassAdapter = await adapterForCanvas(groundGlassCanvas);
    for (const [surface, adapter] of [["Observer", observerAdapter], ["Ground Glass", groundGlassAdapter]] as const) {
      expect(adapter.api, `${surface} WebGL API`).toBe("webgl2");
      expect(adapter.contextLost, `${surface} context loss`).toBe(false);
      expect(adapter.renderer, `${surface} must use hardware rendering`).not.toMatch(/swiftshader|llvmpipe|software/i);
    }
    await waitForAcceptedFrame(rtt);
    return { sceneCanvas, observerCanvas, groundGlassCanvas, rtt, observerAdapter, groundGlassAdapter };
  };

  const setFocus = async (rtt: Locator, target: number) => {
    const slider = page.getByRole("slider", { name: "Focus distance" });
    if (Number(await slider.inputValue()) === target) return waitForAcceptedFrame(rtt);
    const previous = await readFrame(rtt);
    await setStepRangeInput(page, "Focus distance", target);
    return waitForAcceptedFrame(rtt, previous.requestId);
  };
  const setQuality = async (rtt: Locator, quality: "Standard" | "High") => {
    const selector = page.getByRole("combobox", { name: "Render quality", exact: true });
    const targetValue = await selector.locator("option").filter({ hasText: quality }).getAttribute("value");
    if (targetValue !== null && await selector.inputValue() === targetValue) return waitForAcceptedFrame(rtt);
    const previous = await readFrame(rtt);
    await selector.selectOption({ label: quality });
    return waitForAcceptedFrame(rtt, previous.requestId);
  };
  const setAperture = async (rtt: Locator, fNumber: 5.6 | 11 | 22) => {
    const group = page.getByRole("radiogroup", { name: "Aperture" });
    if (Number(await group.getAttribute("data-selected-aperture")) === fNumber) return waitForAcceptedFrame(rtt);
    const previous = await readFrame(rtt);
    await group.getByRole("radio", { name: `f/${fNumber}`, exact: true }).check();
    return waitForAcceptedFrame(rtt, previous.requestId);
  };
  const captureGroundGlass = async (
    label: string,
    quality: "Standard" | "High",
    state: typeof states[number],
    context: Awaited<ReturnType<typeof openScene>>,
  ) => {
    const frame = await waitForAcceptedFrame(context.rtt);
    if (state.id === "b5-life-size-f22") {
      await expect(context.rtt).toHaveAttribute("data-rtt-raw-contentful", "true");
      await expect(context.rtt).toHaveAttribute("data-rtt-ground-glass-illuminance-gain", "0.0625");
    } else {
      expect(frame.contentful, `${state.id} processed image should remain contentful`).toBe("true");
    }
    await page.waitForTimeout(250);
    const filename = `${quality.toLowerCase()}-${label}.png`;
    const image = await saveCanvas(context.groundGlassCanvas, filename, {
      captureDeviceScale: quality === "High",
    });
    const bounds = await context.groundGlassCanvas.boundingBox();
    const drawingBuffer = await context.groundGlassCanvas.evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      return { width: canvas.width, height: canvas.height };
    });
    const runtime = await readMetrics(page, context.rtt);
    const crystalVisible = await context.groundGlassCanvas.getAttribute("data-macro-watch-crystal-visible");
    const cageAngleRad = Number(await context.groundGlassCanvas.getAttribute("data-macro-watch-cage-angle"));
    captures.push({
      id: label,
      quality,
      state,
      path: image.path,
      imageResolution: image.imageResolution,
      frame,
      crystalVisible,
      cageAngleRad,
      drawingBuffer,
      canvasCss: bounds ? { width: bounds.width, height: bounds.height } : null,
      runtime,
    });
    return runtime;
  };

  let context = await openScene();
  await expect(page.getByRole("radio", { name: "Raw Ground Glass", exact: true })).toBeChecked();
  await expect(context.sceneCanvas).toHaveAttribute("data-orbit-target", "0.000000,0.000000,0.300000");
  const overlaysButton = page.getByRole("button", { name: "View overlays", exact: true });
  await overlaysButton.click();
  for (const label of ["Focus plane", "DOF region", "Optical geometry"]) {
    const hideOverlay = page.getByRole("button", { name: `Hide ${label}`, exact: true });
    if (await hideOverlay.isVisible()) await hideOverlay.click();
  }
  await overlaysButton.click();
  const observerPosition = await context.sceneCanvas.getAttribute("data-observer-camera-position");
  const defaultObserver = await saveCanvas(context.observerCanvas, "observer-default.png");
  captures.push({
    id: "observer-default",
    path: defaultObserver.path,
    imageResolution: defaultObserver.imageResolution,
    observerPosition,
  });
  const observerBounds = await context.observerCanvas.boundingBox();
  if (!observerBounds) throw new Error("Observer canvas has no measurable bounds");
  await page.mouse.move(observerBounds.x + observerBounds.width / 2, observerBounds.y + observerBounds.height / 2);
  for (let step = 0; step < 27; step += 1) await page.mouse.wheel(0, -120);
  await page.waitForTimeout(350);
  const readObserverDistance = async () => context.sceneCanvas.evaluate((element) => {
    const parseVector = (name: string) => (element.getAttribute(name) ?? "").split(",").map(Number);
    const position = parseVector("data-observer-camera-position");
    const target = parseVector("data-orbit-target");
    return Math.hypot(...position.map((value, index) => value - target[index]));
  });
  await expect.poll(readObserverDistance).toBeLessThan(0.13);
  const frontClosePosition = await context.sceneCanvas.getAttribute("data-observer-camera-position");
  expect(Number(frontClosePosition?.split(",")[2])).toBeLessThan(0.3);
  const frontClose = await saveCanvas(context.observerCanvas, "observer-front-close.png");
  captures.push({
    id: "observer-front-close",
    path: frontClose.path,
    imageResolution: frontClose.imageResolution,
    cameraPosition: frontClosePosition,
    cameraDistanceM: await readObserverDistance(),
  });
  await page.getByRole("button", { name: "Reset 3D view", exact: true }).click();
  await expect(context.sceneCanvas).toHaveAttribute("data-observer-camera-position", "0.000000,0.000000,0.650000");
  await page.mouse.move(observerBounds.x + observerBounds.width / 2, observerBounds.y + observerBounds.height / 2);
  for (let step = 0; step < 8; step += 1) await page.mouse.wheel(0, -120);
  await page.waitForTimeout(350);
  const rearClosePosition = await context.sceneCanvas.getAttribute("data-observer-camera-position");
  expect(Math.abs(Number(rearClosePosition?.split(",")[0]))).toBeLessThan(0.01);
  const rearCloseZ = Number(rearClosePosition?.split(",")[2]);
  expect(rearCloseZ).toBeGreaterThan(0.31);
  const rearCloseDistance = await readObserverDistance();
  expect(rearCloseDistance).toBeGreaterThan(0.05);
  expect(rearCloseDistance).toBeLessThan(0.1);
  const rearClose = await saveCanvas(context.observerCanvas, "observer-rear-close.png");
  captures.push({
    id: "observer-rear-close",
    path: rearClose.path,
    imageResolution: rearClose.imageResolution,
    cameraPosition: rearClosePosition,
    cameraDistanceM: rearCloseDistance,
  });

  for (const quality of ["Standard", "High"] as const) {
    if (quality === "Standard") {
      await setQuality(context.rtt, quality);
    } else {
      await setQuality(context.rtt, quality);
    }
    for (const state of states) {
      if (Number(await page.getByRole("slider", { name: "Focus distance" }).inputValue()) !== state.focus) {
        await setFocus(context.rtt, state.focus);
      }
      if (Number(await page.getByRole("radiogroup", { name: "Aperture" }).getAttribute("data-selected-aperture")) !== state.aperture) {
        await setAperture(context.rtt, state.aperture);
      }
      const runtime = await captureGroundGlass(state.id, quality, state, context);
      if (state.id === "b3-life-size") {
        if (quality === "Standard") {
          const rawDebug = page.getByRole("checkbox", { name: "Raw RTT — bypass DOF" });
          const previous = await readFrame(context.rtt);
          await rawDebug.check();
          await waitForAcceptedFrame(context.rtt, previous.requestId);
          const rawCapture = await saveCanvas(context.groundGlassCanvas, "standard-b3-source-before-dof.png");
          captures.push({
            id: "b3-source-before-dof",
            path: rawCapture.path,
            imageResolution: rawCapture.imageResolution,
            frame: await readFrame(context.rtt),
            runtime: await readMetrics(page, context.rtt),
          });
          const rawFrame = await readFrame(context.rtt);
          await rawDebug.uncheck();
          await waitForAcceptedFrame(context.rtt, rawFrame.requestId);

          const beforeUpright = await readFrame(context.rtt);
          await page.getByRole("radio", { name: "Upright Assist", exact: true }).check();
          await waitForAcceptedFrame(context.rtt, beforeUpright.requestId);
          const uprightCapture = await saveCanvas(context.groundGlassCanvas, "standard-b3-upright.png");
          captures.push({
            id: "b3-upright",
            quality,
            path: uprightCapture.path,
            imageResolution: uprightCapture.imageResolution,
            frame: await readFrame(context.rtt),
            runtime: await readMetrics(page, context.rtt),
          });
          const beforeRaw = await readFrame(context.rtt);
          await page.getByRole("radio", { name: "Raw Ground Glass", exact: true }).check();
          await waitForAcceptedFrame(context.rtt, beforeRaw.requestId);
        }
        await page.waitForTimeout(5_000);
        const raf = await samplePageFrameCadence(page, 5_000);
        const refreshedRuntime = await readMetrics(page, context.rtt);
        measurements.push({
          mode: "static",
          quality,
          state,
          observerAndPageRafCadence: raf,
          ...refreshedRuntime,
          fallbackRuntime: runtime.groundGlassProfile,
        });
      }
    }
  }

  const loupeButton = page.getByRole("button", { name: "Focus loupe · 4× Ground Glass view", exact: true });
  await setFocus(context.rtt, 300);
  await setAperture(context.rtt, 5.6);
  await setQuality(context.rtt, "High");
  await loupeButton.click();
  await expect(page.locator('[data-focus-loupe-active="true"]').first()).toHaveAttribute("data-focus-loupe-scale", "4");
  await waitForAcceptedFrame(context.rtt);
  const loupeCapture = await saveCanvas(
    page.locator('[data-testid="ground-glass-image-layer"]'),
    "high-b3-focus-loupe-4x.png",
    { hideGroundGlassGuides: true },
  );
  await page.waitForTimeout(5_000);
  measurements.push({
    mode: "static-loupe",
    quality: "High",
    state: states[2],
    observerAndPageRafCadence: await samplePageFrameCadence(page, 5_000),
    ...(await readMetrics(page, context.rtt)),
  });
  captures.push({
    id: "b3-focus-loupe-4x",
    quality: "High",
    path: loupeCapture.path,
    imageResolution: loupeCapture.imageResolution,
    frame: await readFrame(context.rtt),
  });

  const beforeInteraction = await readFrame(context.rtt);
  const interactionStarted = performance.now();
  await setFocus(context.rtt, 450);
  const focusResponseMs = performance.now() - interactionStarted;
  const apertureStarted = performance.now();
  await setAperture(context.rtt, 11);
  const apertureResponseMs = performance.now() - apertureStarted;
  const afterInteraction = await readFrame(context.rtt);
  expect(afterInteraction.requestId).not.toBe(beforeInteraction.requestId);
  measurements.push({ mode: "control-interactions", focusResponseMs, apertureResponseMs, acceptedFrame: afterInteraction });

  context = await openScene(baseRoute.replace("&macroWatchCage=static", ""));
  await setQuality(context.rtt, "Standard");
  await setFocus(context.rtt, 300);
  await page.waitForTimeout(6_000);
  const animatedStandard = await readMetrics(page, context.rtt);
  const animatedStandardRaf = await samplePageFrameCadence(page, 5_000);
  measurements.push({
    mode: "animated",
    quality: "Standard",
    state: states[2],
    cageAngles: {
      observer: await context.observerCanvas.getAttribute("data-macro-watch-cage-angle"),
      groundGlass: await context.groundGlassCanvas.getAttribute("data-macro-watch-cage-angle"),
    },
    observerAndPageRafCadence: animatedStandardRaf,
    ...animatedStandard,
  });
  await setQuality(context.rtt, "High");
  await page.waitForTimeout(6_000);
  const animatedHigh = await readMetrics(page, context.rtt);
  measurements.push({
    mode: "animated",
    quality: "High",
    state: states[2],
    cageAngles: {
      observer: await context.observerCanvas.getAttribute("data-macro-watch-cage-angle"),
      groundGlass: await context.groundGlassCanvas.getAttribute("data-macro-watch-cage-angle"),
    },
    observerAndPageRafCadence: await samplePageFrameCadence(page, 5_000),
    ...animatedHigh,
  });

  const crystalOffRoute = baseRoute.replace("&macroWatchCage=static", "&macroWatchCage=static&macroWatchCrystal=off");
  const crystalOffContext = await openScene(crystalOffRoute);
  await setQuality(crystalOffContext.rtt, "Standard");
  await setFocus(crystalOffContext.rtt, 300);
  await setAperture(crystalOffContext.rtt, 5.6);
  await expect(crystalOffContext.observerCanvas).toHaveAttribute("data-macro-watch-crystal-visible", "false");
  await expect(crystalOffContext.groundGlassCanvas).toHaveAttribute("data-macro-watch-crystal-visible", "false");
  const crystalOffCapture = await saveCanvas(crystalOffContext.groundGlassCanvas, "standard-b3-crystal-off-diagnostic.png");
  captures.push({
    id: "b3-crystal-off-diagnostic",
    path: crystalOffCapture.path,
    imageResolution: crystalOffCapture.imageResolution,
    frame: await readFrame(crystalOffContext.rtt),
  });

  const highResolutionContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    baseURL: `http://127.0.0.1:${process.env.MACRO_TOURBILLON_HARDWARE_PORT ?? "4187"}`,
  });
  const highResolutionPage = await highResolutionContext.newPage();
  highResolutionPage.on("pageerror", (error) => pageErrors.push(error.message));
  highResolutionPage.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
    if (message.type() === "warning") runtimeWarnings.push(message.text());
  });
  await highResolutionPage.goto(baseRoute, { waitUntil: "domcontentloaded" });
  const highResolutionRtt = highResolutionPage.getByTestId("ground-glass-rtt");
  const highResolutionCanvas = highResolutionPage.locator(".groundglass-renderer-host canvas");
  await expect(highResolutionPage.evaluate(() => window.devicePixelRatio)).resolves.toBe(2);
  await expect(highResolutionPage.getByTestId("scene-canvas"))
    .toHaveAttribute("data-scene-subject-id", sceneId);
  await expect(highResolutionRtt).toHaveAttribute("data-rtt-scene-id", sceneId);
  await expect(highResolutionCanvas).toHaveCount(1);
  await waitForAcceptedFrame(highResolutionRtt);
  const highResolutionQuality = highResolutionPage.getByRole("combobox", { name: "Render quality", exact: true });
  await highResolutionQuality.selectOption({ label: "High" });
  await waitForAcceptedFrame(highResolutionRtt);
  const highResolutionRecaptures: Array<Record<string, unknown>> = [];
  for (const state of states) {
    const highResolutionFocus = highResolutionPage.getByRole("slider", { name: "Focus distance" });
    if (Number(await highResolutionFocus.inputValue()) !== state.focus) {
      const previous = await readFrame(highResolutionRtt);
      await setStepRangeInput(highResolutionPage, "Focus distance", state.focus);
      await waitForAcceptedFrame(highResolutionRtt, previous.requestId);
    }
    const highResolutionAperture = highResolutionPage.getByRole("radiogroup", { name: "Aperture" });
    if (Number(await highResolutionAperture.getAttribute("data-selected-aperture")) !== state.aperture) {
      const previous = await readFrame(highResolutionRtt);
      await highResolutionAperture.getByRole("radio", { name: `f/${state.aperture}`, exact: true }).check();
      await waitForAcceptedFrame(highResolutionRtt, previous.requestId);
    }
    await waitForAcceptedFrame(highResolutionRtt);
    await highResolutionPage.waitForTimeout(150);
    const image = await saveCanvas(highResolutionCanvas, `high-${state.id}.png`, {
      captureDeviceScale: true,
    });
    const existing = captures.find((capture) => {
      const captureState = capture.state as typeof states[number] | undefined;
      return capture.quality === "High" && captureState?.id === state.id;
    });
    if (existing) {
      existing.imageResolution = image.imageResolution;
      existing.captureDevicePixelRatio = 2;
      existing.captureDrawingBuffer = await highResolutionCanvas.evaluate((node) => {
        const canvas = node as HTMLCanvasElement;
        return { width: canvas.width, height: canvas.height };
      });
    }
    highResolutionRecaptures.push({
      id: state.id,
      path: image.path,
      imageResolution: image.imageResolution,
      captureDpr: 2,
      frame: await readFrame(highResolutionRtt),
      runtime: await readMetrics(highResolutionPage, highResolutionRtt),
    });
    if (state.id === "b3-life-size") {
      await highResolutionPage.getByRole("button", { name: "Focus loupe · 4× Ground Glass view", exact: true }).click();
      await expect(highResolutionPage.locator('[data-focus-loupe-active="true"]').first())
        .toHaveAttribute("data-focus-loupe-scale", "4");
      await waitForAcceptedFrame(highResolutionRtt);
      const loupe = await saveCanvas(
        highResolutionPage.locator('[data-testid="ground-glass-image-layer"]'),
        "high-b3-focus-loupe-4x.png",
        { captureDeviceScale: true, hideGroundGlassGuides: true },
      );
      highResolutionRecaptures.push({
        id: "b3-focus-loupe-4x",
        path: loupe.path,
        imageResolution: loupe.imageResolution,
        captureDpr: 2,
        frame: await readFrame(highResolutionRtt),
        focusLoupeSampledFilmWidthMm: await highResolutionRtt.getAttribute("data-rtt-sampled-film-width-mm"),
      });
      const existingLoupe = captures.find((capture) => capture.id === "b3-focus-loupe-4x");
      if (existingLoupe) {
        existingLoupe.imageResolution = loupe.imageResolution;
        existingLoupe.captureDevicePixelRatio = 2;
      }
    }
  }
  await highResolutionContext.close();

  expect(pageErrors, "browser errors").toEqual([]);
  const manifest = {
    schemaVersion: "macro-tourbillon-reviewfix-hardware-v1",
    sourceBaseCommit: "811456d209988e9f9f4792f5aa46425616eec3d5",
    branch: "feature/macro-tourbillon-integration",
    browser: { name: browser.browserType().name(), version: browser.version() },
    viewport: { width: 1280, height: 900, dpr: 1 },
    highResolutionCaptureViewport: { width: 1280, height: 900, dpr: 2 },
    renderer: {
      observer: context.observerAdapter,
      groundGlass: context.groundGlassAdapter,
    },
    standardAndHighStaticCaptures: captures.filter((capture) => capture.state !== undefined).length,
    captures,
    measurements,
    highResolutionRecaptures,
    runtimeWarnings,
    browserErrors: pageErrors,
    testInfo: { title: testInfo.title },
  };
  await writeFile(resolve(evidenceDirectory, "hardware-capture-run.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  expect(captures.filter((capture) => capture.state !== undefined)).toHaveLength(10);
});
