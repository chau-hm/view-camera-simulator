import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { arch, platform, release } from "node:os";
import { writeFile } from "node:fs/promises";
import { relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const sceneId = "macro-depth-of-field";
const captureRunId = randomUUID();

const readFrame = async (
  page: Page,
  rtt: Locator,
  expectedSceneId = sceneId,
): Promise<Readonly<{ requestId: string; lastCompletedRequestId: string; acceptedByHost: boolean }>> => {
  await expect.poll(async () => {
    const attrs = await rtt.evaluate((element) => ({
      sceneId: element.getAttribute("data-rtt-scene-id"),
      rendererFamily: element.getAttribute("data-mounted-renderer-family"),
      executionApi: element.getAttribute("data-actual-execution-api"),
      lifecycle: element.getAttribute("data-render-host-lifecycle"),
      frameStatus: element.getAttribute("data-frame-result-status"),
      contentful: element.getAttribute("data-rtt-final-contentful"),
      requestId: element.getAttribute("data-frame-request-id"),
      completedRequestId: element.getAttribute("data-last-completed-request-id"),
    }));
    return attrs.sceneId === expectedSceneId &&
      attrs.rendererFamily === "webgl-renderer" &&
      attrs.executionApi === "webgl2" &&
      attrs.lifecycle === "ready" &&
      attrs.frameStatus === "completed" &&
      attrs.contentful === "true" &&
      Boolean(attrs.requestId) && attrs.requestId === attrs.completedRequestId;
  }, { timeout: 120_000 }).toBe(true);

  const frame = await rtt.evaluate((element) => ({
    requestId: element.getAttribute("data-frame-request-id") ?? "",
    lastCompletedRequestId: element.getAttribute("data-last-completed-request-id") ?? "",
  }));
  const acceptedByHost = await page.evaluate((requestId) => {
    const events = window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? [];
    return events.some((event) => event.kind === "host-frame-result" &&
      event.requestId === requestId && event.acceptedByHost === true &&
      event.latestAcceptedRequestId === requestId);
  }, frame.requestId);
  expect(acceptedByHost, `Host accepted current completed frame ${frame.requestId}`).toBe(true);
  return { ...frame, acceptedByHost };
};

const captureCanvas = async (
  page: Page,
  canvas: Locator,
  outputPath: string,
  cssClip?: Readonly<{ width: number; height: number }>,
): Promise<Readonly<{ imagePath: string; imageWidth: number; imageHeight: number; sha256: string }>> => {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error(`Canvas is not visible for capture: ${outputPath}`);
  const image = cssClip
    ? await page.screenshot({
      path: outputPath,
      clip: {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: cssClip.width,
        height: cssClip.height,
      },
      scale: "css",
      animations: "disabled",
    })
    : await canvas.screenshot({ path: outputPath, animations: "disabled" });
  return {
    imagePath: relative(repositoryRoot, outputPath),
    imageWidth: image.readUInt32BE(16),
    imageHeight: image.readUInt32BE(20),
    sha256: createHash("sha256").update(image).digest("hex"),
  };
};

const hideCaptureDom = async (
  canvas: Locator,
  hideGroundGlassGuides = false,
): Promise<string[]> => canvas.evaluate((canvasElement, hideGuides) => {
  const canvasBounds = canvasElement.getBoundingClientRect();
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(
    "button, a[href], [role='button'], [data-testid='ground-glass-focus-label'], " +
    "[data-testid='ground-glass-webgpu-pilot-status'], [data-testid='ground-glass-image-layer'] + div",
  ));
  const hidden: string[] = [];
  const markHidden = (candidate: HTMLElement, description: string) => {
    candidate.dataset.rq3dCaptureHidden = "true";
    hidden.push(description);
  };

  for (const candidate of candidates) {
    if (candidate === canvasElement || candidate.contains(canvasElement) || canvasElement.contains(candidate)) continue;
    const forcedOverlay = candidate.matches(
      "[data-testid='ground-glass-focus-label'], [data-testid='ground-glass-webgpu-pilot-status'], " +
      "[data-testid='ground-glass-image-layer'] + div",
    );
    const bounds = candidate.getBoundingClientRect();
    const overlaps = bounds.width > 0 && bounds.height > 0 &&
      bounds.left < canvasBounds.right && bounds.right > canvasBounds.left &&
      bounds.top < canvasBounds.bottom && bounds.bottom > canvasBounds.top;
    if (forcedOverlay || overlaps) {
      markHidden(candidate, candidate.getAttribute("aria-label") ?? candidate.getAttribute("data-testid") ??
        (candidate.textContent?.trim() || String(candidate.className) || candidate.tagName));
    }
  }

  if (hideGuides) {
    const imageLayer = document.querySelector<HTMLElement>("[data-testid='ground-glass-image-layer']");
    const guideElements = Array.from(imageLayer?.querySelectorAll<HTMLElement>("div") ?? [])
      .filter((element) => Boolean(element.style.borderLeft || element.style.borderTop));
    guideElements.forEach((element, index) => markHidden(element, `ground-glass-center-guide-${index + 1}`));
  }

  const style = document.createElement("style");
  style.dataset.rq3dCaptureStyles = "true";
  style.textContent = "[data-rq3d-capture-hidden='true'] { visibility: hidden !important; pointer-events: none !important; }";
  document.head.append(style);
  return hidden;
}, hideGroundGlassGuides);

const restoreCaptureDom = async (page: Page): Promise<void> => page.evaluate(() => {
  document.querySelector("[data-rq3d-capture-styles='true']")?.remove();
  document.querySelectorAll<HTMLElement>("[data-rq3d-capture-hidden='true']")
    .forEach((element) => delete element.dataset.rq3dCaptureHidden);
});

const waitForPaint = async (page: Page): Promise<void> => page.evaluate(() => new Promise<void>((resolveFrame) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
}));

test("capture Macro Depth of Field Observer and 4× Ground Glass inspection references", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const sourceCommit = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const sourceStatus = execFileSync("git", [
    "status", "--porcelain=v1", "--untracked-files=all", "--", ".",
    ":(exclude,top)node_modules", ":(exclude,top)node_modules/**",
  ], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  expect(sourceStatus, "capture source tree is clean; ignored outputs do not dirty the source").toBe("");

  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = { adapterEvents: [] };
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  const browser = page.context().browser();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(`/simulator/free/${sceneId}?rttDiagnostics=1&sceneCapacityProfiling=1`, {
    waitUntil: "domcontentloaded",
  });
  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt").first();
  await expect(scene).toHaveAttribute("data-scene-subject-id", sceneId);
  await expect(scene).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(scene).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(scene).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(scene).toHaveAttribute("data-observer-three-revision", "187");
  await expect(scene).toHaveAttribute("data-observer-application-fallback", "none");
  await page.getByRole("combobox", { name: "Render quality", exact: true })
    .selectOption({ label: "Standard" });
  await page.getByRole("button", { name: "Reset 3D view", exact: true }).click();
  await expect(scene).toHaveAttribute("data-view-focus", "scene");

  const overlayButton = page.getByRole("button", { name: "View overlays", exact: true });
  const overlayStates = await page.locator('[data-testid^="scene-overlay-"] button[aria-pressed]')
    .evaluateAll((buttons) => buttons.map((button) => ({
      label: button.textContent?.trim() ?? "",
      active: button.getAttribute("aria-pressed") === "true",
    })));
  if (await overlayButton.getAttribute("aria-expanded") === "false") await overlayButton.click();
  const activeOverlays = page.locator('[data-testid^="scene-overlay-"] button[aria-pressed="true"]');
  while (await activeOverlays.count() > 0) await activeOverlays.first().click();
  await expect(activeOverlays).toHaveCount(0);
  if (await overlayButton.getAttribute("aria-expanded") === "true") await overlayButton.click();

  const capacityText = await page.getByTestId("scene-capacity-snapshot").textContent();
  const subjectSnapshot = capacityText ? JSON.parse(capacityText) as Record<string, unknown> : null;
  expect(subjectSnapshot).not.toBeNull();
  expect(JSON.stringify(subjectSnapshot)).toContain('"sceneId":"macro-depth-of-field"');
  const observerCameraPose = await scene.evaluate((element) => ({
    cameraPosition: element.getAttribute("data-observer-camera-position"),
    orbitTarget: element.getAttribute("data-orbit-target"),
    rendererFamily: element.getAttribute("data-observer-renderer-family"),
    executionApi: element.getAttribute("data-observer-execution-backend"),
    rendererRevision: element.getAttribute("data-observer-three-revision"),
  }));
  expect(observerCameraPose.cameraPosition).toBeTruthy();
  expect(observerCameraPose.orbitTarget).toBeTruthy();
  const observerCanvas = scene.locator("canvas").first();
  const observerBounds = await observerCanvas.boundingBox();
  expect(observerBounds).not.toBeNull();
  if (!observerBounds) throw new Error("Observer canvas is not visible");
  const observerHiddenDomControls = await hideCaptureDom(observerCanvas);
  await waitForPaint(page);
  let observer: Awaited<ReturnType<typeof captureCanvas>>;
  try {
    observer = await captureCanvas(
      page,
      observerCanvas,
      testInfo.outputPath("macro-depth-of-field-observer.png"),
      { width: Math.round(observerBounds.width), height: Math.round(observerBounds.height) },
    );
  } finally {
    await restoreCaptureDom(page);
  }
  expect(observer.imageWidth).toBeGreaterThan(0);
  expect(observer.imageHeight).toBeGreaterThan(0);

  await expect(rtt).toHaveAttribute("data-rtt-scene-id", sceneId);
  const quality = page.getByRole("combobox", { name: "Render quality", exact: true });
  await quality.selectOption({ label: "Standard" });
  const rawPreview = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
  await rawPreview.check();
  const rawDebug = page.getByLabel("Raw RTT — bypass DOF", { exact: true });
  if (await rawDebug.isChecked()) await rawDebug.uncheck();
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  await expect(focus).toHaveValue("400");
  await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  const grid = page.getByRole("checkbox", { name: "Grid", exact: true });
  if (await grid.isChecked()) await grid.uncheck();
  const frame = await readFrame(page, rtt);

  const loupeButton = page.getByRole("button", {
    name: "Focus loupe · 4× Ground Glass view",
    exact: true,
  });
  await loupeButton.click();
  const stage = page.locator('[data-focus-loupe-active="true"]').first();
  await expect(stage).toHaveAttribute("data-focus-loupe-scale", "4");
  await expect(stage).toHaveAttribute("data-focus-loupe-window-width", "0.25");
  await expect(stage).toHaveAttribute("data-focus-loupe-window-height", "0.25");
  await expect.poll(async () => rtt.getAttribute("data-frame-request-id"))
    .not.toBe(frame.requestId);
  const loupeFrame = await readFrame(page, rtt);
  await page.evaluate(() => new Promise<void>((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
  }));
  const loupeBounds = await rtt.locator("canvas").first().boundingBox();
  expect(loupeBounds?.width).toBe(450);
  expect(loupeBounds?.height).toBe(360);
  const loupeCanvas = rtt.locator("canvas").first();
  const hiddenDomControls = await hideCaptureDom(loupeCanvas, true);
  await waitForPaint(page);
  let loupe: Awaited<ReturnType<typeof captureCanvas>>;
  try {
    loupe = await captureCanvas(
      page,
      loupeCanvas,
      testInfo.outputPath("macro-depth-of-field-middle-focus-loupe-4x.png"),
      { width: 450, height: 360 },
    );
  } finally {
    await restoreCaptureDom(page);
  }
  expect(loupe.imageWidth).toBe(450);
  expect(loupe.imageHeight).toBe(360);

  const secondarySceneCaptures: Array<Record<string, unknown>> = [];
  for (const secondarySceneId of ["macro-bellows-extension", "macro-oblique-plane"] as const) {
    await page.goto(`/simulator/free/${secondarySceneId}?rttDiagnostics=1`, {
      waitUntil: "domcontentloaded",
    });
    const secondaryScene = page.getByTestId("scene-canvas");
    const secondaryRtt = page.getByTestId("ground-glass-rtt").first();
    await expect(secondaryScene).toHaveAttribute("data-scene-subject-id", secondarySceneId);
    await expect(secondaryRtt).toHaveAttribute("data-rtt-scene-id", secondarySceneId);
    await page.getByRole("combobox", { name: "Render quality", exact: true })
      .selectOption({ label: "Standard" });
    const secondaryRawPreview = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
    await secondaryRawPreview.check();
    const secondaryRawDebug = page.getByLabel("Raw RTT — bypass DOF", { exact: true });
    if (await secondaryRawDebug.isChecked()) await secondaryRawDebug.uncheck();
    const secondaryGrid = page.getByRole("checkbox", { name: "Grid", exact: true });
    if (await secondaryGrid.isChecked()) await secondaryGrid.uncheck();
    const secondaryFrame = await readFrame(page, secondaryRtt, secondarySceneId);
    const secondaryCanvas = secondaryRtt.locator("canvas").first();
    const secondaryBounds = await secondaryCanvas.boundingBox();
    expect(secondaryBounds?.width).toBe(450);
    expect(secondaryBounds?.height).toBe(360);
    const secondaryHiddenDomControls = await hideCaptureDom(secondaryCanvas, true);
    await waitForPaint(page);
    let secondaryImage: Awaited<ReturnType<typeof captureCanvas>>;
    try {
      secondaryImage = await captureCanvas(
        page,
        secondaryCanvas,
        testInfo.outputPath(`${secondarySceneId}-regression.png`),
        { width: 450, height: 360 },
      );
    } finally {
      await restoreCaptureDom(page);
    }
    const secondaryRanges = await page.locator('input[type="range"]').evaluateAll((inputs) =>
      inputs.map((input) => {
        const range = input as HTMLInputElement;
        return {
          label: range.getAttribute("aria-label"),
          value: Number(range.value),
          min: Number(range.min),
          max: Number(range.max),
          step: Number(range.step),
          disabled: range.disabled,
        };
      }),
    );
    secondarySceneCaptures.push({
      captureId: `${secondarySceneId}-canonical-regression`,
      captureRole: "secondary-macro-regression-reference",
      sceneId: secondarySceneId,
      route: `/simulator/free/${secondarySceneId}?rttDiagnostics=1`,
      cameraState: {
        focalLengthMm: Number(await secondaryRtt.getAttribute("data-rtt-focal-length-mm")),
        focusDistanceMm: Number(await page.getByRole("slider", { name: "Focus distance", exact: true }).inputValue()),
        apertureFNumber: Number(await page.getByRole("radiogroup", { name: "Aperture", exact: true })
          .getAttribute("data-selected-aperture")),
        movements: secondaryRanges.filter((range) => range.label !== "Focus distance"),
      },
      renderQuality: "standard",
      previewMode: await secondaryRawPreview.isChecked() ? "Raw" : "unexpected",
      rawDebug: await secondaryRawDebug.isChecked(),
      gridEnabled: false,
      rendererIdentity: {
        rendererFamily: await secondaryRtt.getAttribute("data-mounted-renderer-family"),
        executionApi: await secondaryRtt.getAttribute("data-actual-execution-api"),
        rendererRevision: await secondaryRtt.getAttribute("data-three-revision"),
        applicationFallback: await secondaryRtt.getAttribute("data-application-fallback"),
        internalFallback: await secondaryRtt.getAttribute("data-internal-fallback"),
      },
      frame: secondaryFrame,
      contentful: (await secondaryRtt.getAttribute("data-rtt-final-contentful")) === "true",
      hiddenDomControls: secondaryHiddenDomControls,
      image: secondaryImage,
    });
  }

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  const run = {
    schemaVersion: "rq3d-macro-support-capture-v1",
    captureRunId,
    sourceCommit,
    sourceTreeStatus: "clean",
    sceneId,
    sceneSourceRevision: null,
    browser: { name: "Chromium (Playwright)", version: browser?.version() ?? "unknown" },
    operatingSystem: { platform: platform(), release: release(), architecture: arch() },
    viewport: { width: 1280, height: 900, devicePixelRatio: await page.evaluate(() => window.devicePixelRatio) },
    renderQuality: "standard",
    captures: [
      {
        captureId: "macro-depth-of-field-observer-default-pose",
        captureRole: "observer-regression-reference",
        target: "observer-canvas",
        cameraPose: observerCameraPose,
        overlaysAtCapture: overlayStates,
        hiddenDomControls: observerHiddenDomControls,
        rendererIdentity: {
          rendererFamily: "webgl-renderer",
          executionApi: "webgl2",
          rendererRevision: "r187",
          applicationFallback: "none",
        },
        subjectEvidence: subjectSnapshot,
        image: observer,
      },
      {
        captureId: "macro-depth-of-field-middle-focus-loupe-4x",
        captureRole: "ground-glass-inspection-reference",
        target: "ground-glass-webgl-canvas",
        cameraState: {
          sceneId,
          focalLengthMm: Number(await rtt.getAttribute("data-rtt-focal-length-mm")),
          focusDistanceMm: Number(await focus.inputValue()),
          apertureFNumber: Number(await aperture.getAttribute("data-selected-aperture")),
          frontRiseMm: 0,
          frontShiftMm: 0,
          frontTiltDeg: 0,
          frontSwingDeg: 0,
          rearRiseMm: 0,
          rearShiftMm: 0,
          rearTiltDeg: 0,
          rearSwingDeg: 0,
        },
        previewMode: "Raw",
        rawDebug: false,
        gridEnabled: false,
        focusLoupe: {
          active: true,
          scale: 4,
          centerU: Number(await stage.getAttribute("data-focus-loupe-center-u")),
          centerV: Number(await stage.getAttribute("data-focus-loupe-center-v")),
          windowWidth: 0.25,
          windowHeight: 0.25,
        },
        rendererIdentity: {
          rendererFamily: await rtt.getAttribute("data-mounted-renderer-family"),
          executionApi: await rtt.getAttribute("data-actual-execution-api"),
          rendererRevision: await rtt.getAttribute("data-three-revision"),
          applicationFallback: await rtt.getAttribute("data-application-fallback"),
          internalFallback: await rtt.getAttribute("data-internal-fallback"),
        },
        frame: loupeFrame,
        hiddenDomControls,
        contentful: (await rtt.getAttribute("data-rtt-final-contentful")) === "true",
        image: loupe,
      },
      ...secondarySceneCaptures,
    ],
    pageErrors,
    consoleErrors,
  };
  await writeFile(testInfo.outputPath("rq3d-support-capture-run.json"), `${JSON.stringify(run, null, 2)}\n`);
});
