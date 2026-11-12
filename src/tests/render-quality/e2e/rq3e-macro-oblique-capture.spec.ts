import { execFileSync } from "node:child_process";
import { arch, platform, release } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { setStepRangeInput } from "../../e2e/helpers/stepRangeInput";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const captureRunId = randomUUID();
const capturePhase = process.env.RQ3E_CAPTURE_PHASE ?? "working";
const mainSceneId = "macro-oblique-plane";

const states = [
  { stateId: "o1-neutral", focusDistanceMm: 400, frontTiltDeg: 0 },
  { stateId: "o2-focus-near-no-tilt", focusDistanceMm: 390, frontTiltDeg: 0 },
  { stateId: "o3-partial-alignment", focusDistanceMm: 390, frontTiltDeg: 6.2 },
  { stateId: "o4-aligned", focusDistanceMm: 390, frontTiltDeg: 6.3 },
] as const;

const readAcceptedFrame = async (
  page: Page,
  rtt: Locator,
  expectedSceneId: string,
  previousRequestId = "",
) => {
  await expect.poll(async () => {
    const attributes = await rtt.evaluate((element) => ({
      sceneId: element.getAttribute("data-rtt-scene-id"),
      rendererFamily: element.getAttribute("data-mounted-renderer-family"),
      executionApi: element.getAttribute("data-actual-execution-api"),
      lifecycle: element.getAttribute("data-render-host-lifecycle"),
      frameStatus: element.getAttribute("data-frame-result-status"),
      contentful: element.getAttribute("data-rtt-final-contentful"),
      requestId: element.getAttribute("data-frame-request-id"),
      completedRequestId: element.getAttribute("data-last-completed-request-id"),
      applicationFallback: element.getAttribute("data-application-fallback"),
      internalFallback: element.getAttribute("data-internal-fallback"),
    }));
    return attributes.sceneId === expectedSceneId &&
      attributes.rendererFamily === "webgl-renderer" &&
      attributes.executionApi === "webgl2" &&
      attributes.lifecycle === "ready" &&
      attributes.frameStatus === "completed" &&
      attributes.contentful === "true" &&
      attributes.applicationFallback === "not-observed" &&
      attributes.internalFallback === "none" &&
      Boolean(attributes.requestId) &&
      attributes.requestId === attributes.completedRequestId &&
      attributes.requestId !== previousRequestId;
  }, { timeout: 120_000 }).toBe(true);

  const frame = await rtt.evaluate((element) => ({
    requestId: element.getAttribute("data-frame-request-id") ?? "",
    lastCompletedRequestId: element.getAttribute("data-last-completed-request-id") ?? "",
  }));
  const acceptedByHost = await page.evaluate((requestId) =>
    window.__groundGlassWebGpuM3TestControl?.adapterEvents?.some((event) =>
      event.kind === "host-frame-result" &&
      event.requestId === requestId &&
      event.acceptedByHost === true &&
      event.latestAcceptedRequestId === requestId,
    ) ?? false,
  frame.requestId);
  expect(acceptedByHost, `Host accepted completed request ${frame.requestId}`).toBe(true);
  return { ...frame, acceptedByHost };
};

const hideOverlappingDom = async (canvas: Locator): Promise<string[]> => canvas.evaluate((canvasElement) => {
  const bounds = canvasElement.getBoundingClientRect();
  const hidden: string[] = [];
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(
    "button, a[href], [role='button'], [data-testid='ground-glass-focus-label'], " +
    "[data-testid='ground-glass-webgpu-pilot-status'], [data-testid='ground-glass-image-layer'] + div",
  ));
  for (const candidate of candidates) {
    if (candidate === canvasElement || candidate.contains(canvasElement) || canvasElement.contains(candidate)) continue;
    const forcedOverlay = candidate.matches(
      "[data-testid='ground-glass-focus-label'], [data-testid='ground-glass-webgpu-pilot-status'], " +
      "[data-testid='ground-glass-image-layer'] + div",
    );
    const candidateBounds = candidate.getBoundingClientRect();
    const overlaps = candidateBounds.width > 0 && candidateBounds.height > 0 &&
      candidateBounds.left < bounds.right && candidateBounds.right > bounds.left &&
      candidateBounds.top < bounds.bottom && candidateBounds.bottom > bounds.top;
    if (!forcedOverlay && !overlaps) continue;
    candidate.dataset.rq3eCaptureHidden = "true";
    hidden.push(candidate.getAttribute("aria-label") ?? candidate.getAttribute("data-testid") ??
      (candidate.textContent?.trim() || String(candidate.className) || candidate.tagName));
  }
  const style = document.createElement("style");
  style.dataset.rq3eCaptureStyles = "true";
  style.textContent = "[data-rq3e-capture-hidden='true'] { visibility: hidden !important; pointer-events: none !important; }";
  document.head.append(style);
  return hidden;
});

const restoreDom = async (page: Page): Promise<void> => page.evaluate(() => {
  document.querySelector("[data-rq3e-capture-styles='true']")?.remove();
  document.querySelectorAll<HTMLElement>("[data-rq3e-capture-hidden='true']")
    .forEach((element) => delete element.dataset.rq3eCaptureHidden);
});

const waitForPaint = async (page: Page): Promise<void> => page.evaluate(() => new Promise<void>((resolvePaint) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolvePaint()));
}));

const screenshot = async (
  page: Page,
  canvas: Locator,
  imagePath: string,
  width?: number,
  height?: number,
) => {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error(`Capture target is not visible: ${imagePath}`);
  const image = await page.screenshot({
    path: imagePath,
    clip: {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: width ?? Math.round(bounds.width),
      height: height ?? Math.round(bounds.height),
    },
    scale: "css",
    animations: "disabled",
  });
  return {
    imagePath: imagePath.split(/[\\/]/).at(-1),
    imageWidth: image.readUInt32BE(16),
    imageHeight: image.readUInt32BE(20),
    sha256: createHash("sha256").update(image).digest("hex"),
  };
};

const readRuntime = async (rtt: Locator) => rtt.evaluate((element) => {
  const attributes: Record<string, string> = {};
  for (const attribute of element.attributes) {
    if (attribute.name.startsWith("data-")) attributes[attribute.name] = attribute.value;
  }
  return attributes;
});

test("capture RQ3E matched Macro Oblique Plane WebGL references", async ({ page }, testInfo) => {
  test.setTimeout(360_000);
  const sourceCommit = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const sourceStatus = execFileSync("git", [
    "status", "--porcelain=v1", "--untracked-files=all", "--", ".",
    ":(exclude,top)node_modules", ":(exclude,top)node_modules/**",
  ], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  expect(sourceStatus, "capture source tree is clean; ignored capture output is excluded").toBe("");

  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = { adapterEvents: [] };
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);
  const browser = page.context().browser();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const captures: Array<Record<string, unknown>> = [];

  await page.goto(`/simulator/free/${mainSceneId}?rttDiagnostics=1&sceneCapacityProfiling=1`, { waitUntil: "domcontentloaded" });
  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt").first();
  await expect(scene).toHaveAttribute("data-scene-subject-id", mainSceneId);
  await expect(scene).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(scene).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(scene).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(scene).toHaveAttribute("data-observer-three-revision", "187");
  await expect(scene).toHaveAttribute("data-observer-application-fallback", "none");
  const capacitySnapshot = page.getByTestId("scene-capacity-snapshot");
  await expect.poll(async () => {
    const text = await capacitySnapshot.textContent();
    try {
      return text ? (JSON.parse(text) as { sceneId?: string }).sceneId : null;
    } catch {
      return null;
    }
  }).toBe("macro-oblique-plane");
  const subjectSnapshot = JSON.parse(await capacitySnapshot.textContent() ?? "null") as Record<string, unknown>;
  expect(subjectSnapshot).not.toBeNull();
  await page.getByRole("combobox", { name: "Render quality", exact: true }).selectOption({ label: "Standard" });
  await page.getByRole("button", { name: "Reset 3D view", exact: true }).click();
  await expect(scene).toHaveAttribute("data-view-focus", "scene");

  const overlayButton = page.getByRole("button", { name: "View overlays", exact: true });
  if (await overlayButton.getAttribute("aria-expanded") === "false") await overlayButton.click();
  const activeOverlays = page.locator('[data-testid^="scene-overlay-"] button[aria-pressed="true"]');
  const disabledOverlays: string[] = [];
  while (await activeOverlays.count() > 0) {
    disabledOverlays.push((await activeOverlays.first().textContent())?.trim() ?? "unknown overlay");
    await activeOverlays.first().click();
  }
  if (await overlayButton.getAttribute("aria-expanded") === "true") await overlayButton.click();
  const observerPose = await scene.evaluate((element) => ({
    cameraPosition: element.getAttribute("data-observer-camera-position"),
    orbitTarget: element.getAttribute("data-orbit-target"),
    rendererFamily: element.getAttribute("data-observer-renderer-family"),
    executionApi: element.getAttribute("data-observer-execution-backend"),
    rendererRevision: element.getAttribute("data-observer-three-revision"),
  }));
  expect(observerPose.cameraPosition).toBeTruthy();
  expect(observerPose.orbitTarget).toBeTruthy();
  const observerCanvas = scene.locator("canvas").first();
  const observerHidden = await hideOverlappingDom(observerCanvas);
  await waitForPaint(page);
  let observerImage;
  try {
    observerImage = await screenshot(page, observerCanvas, testInfo.outputPath("observer-default-pose.png"));
  } finally {
    await restoreDom(page);
  }
  captures.push({
    captureId: `rq3e-${captureRunId}-observer`,
    stateId: "macro-oblique-observer-default-pose",
    captureRole: "fixed-observer-reference",
    cameraPose: observerPose,
    disabledOverlays,
    hiddenDomControls: observerHidden,
    rendererIdentity: {
      rendererFamily: observerPose.rendererFamily,
      executionApi: observerPose.executionApi,
      rendererRevision: observerPose.rendererRevision,
      applicationFallback: "none",
    },
    image: observerImage,
  });

  const quality = page.getByRole("combobox", { name: "Render quality", exact: true });
  await quality.selectOption({ label: "Standard" });
  const rawPreview = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
  await rawPreview.check();
  const rawDebug = page.getByLabel("Raw RTT — bypass DOF", { exact: true });
  if (await rawDebug.isChecked()) await rawDebug.uncheck();
  const grid = page.getByRole("checkbox", { name: "Grid", exact: true });
  if (await grid.isChecked()) await grid.uncheck();
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const tilt = page.getByRole("slider", { name: "Front Tilt", exact: true });
  const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");

  let previousRequestId = "";
  for (const state of states) {
    if (Number(await focus.inputValue()) !== state.focusDistanceMm) {
      previousRequestId = await rtt.getAttribute("data-frame-request-id") ?? previousRequestId;
      await setStepRangeInput(page, "Focus distance", state.focusDistanceMm);
    }
    if (Number(await tilt.inputValue()) !== state.frontTiltDeg) {
      previousRequestId = await rtt.getAttribute("data-frame-request-id") ?? previousRequestId;
      await setStepRangeInput(page, "Front Tilt", state.frontTiltDeg);
    }
    await expect(focus).toHaveValue(String(state.focusDistanceMm));
    await expect(tilt).toHaveValue(String(state.frontTiltDeg));
    const frame = await readAcceptedFrame(page, rtt, mainSceneId, previousRequestId);
    previousRequestId = frame.requestId;
    const canvas = rtt.locator("canvas").first();
    const bounds = await canvas.boundingBox();
    if (!bounds || Math.abs(bounds.width - 450) > 1 || Math.abs(bounds.height - 360) > 1) {
      throw new Error(`Unexpected 450 × 360 Ground Glass display size for ${state.stateId}`);
    }
    const hiddenDomControls = await hideOverlappingDom(canvas);
    await waitForPaint(page);
    const filename = `${state.stateId}.png`;
    let image;
    try {
      image = await screenshot(page, canvas, testInfo.outputPath(filename), 450, 360);
    } finally {
      await restoreDom(page);
    }
    const runtime = await readRuntime(rtt);
    const rangeValues = await page.locator('input[type="range"]').evaluateAll((elements) =>
      elements.map((element) => {
        const input = element as HTMLInputElement;
        return {
          label: input.getAttribute("aria-label"),
          value: Number(input.value),
          min: Number(input.min),
          max: Number(input.max),
          step: Number(input.step),
        };
      }),
    );
    const capture = {
      captureId: `rq3e-${captureRunId}-${state.stateId}`,
      stateId: state.stateId,
      sceneId: mainSceneId,
      route: `/simulator/free/${mainSceneId}?rttDiagnostics=1&sceneCapacityProfiling=1`,
      captureRole: "photographic-ground-glass-reference",
      cameraState: {
        focalLengthMm: Number(await rtt.getAttribute("data-rtt-focal-length-mm")),
        focusDistanceMm: Number(await focus.inputValue()),
        apertureFNumber: Number(await aperture.getAttribute("data-selected-aperture")),
        movements: rangeValues,
      },
      renderQuality: "standard",
      previewMode: await rawPreview.isChecked() ? "Raw" : "unexpected",
      rawDebug: await rawDebug.isChecked(),
      gridEnabled: await grid.isChecked(),
      pipelineStage: "photographic-composite-displayed-in-raw-orientation",
      rendererIdentity: {
        rendererFamily: runtime["data-mounted-renderer-family"],
        executionApi: runtime["data-actual-execution-api"],
        rendererRevision: runtime["data-three-revision"],
        applicationFallback: runtime["data-application-fallback"],
        internalFallback: runtime["data-internal-fallback"],
      },
      frame,
      contentful: runtime["data-rtt-final-contentful"] === "true",
      display: {
        widthCssPx: bounds.width,
        heightCssPx: bounds.height,
        dpr: await page.evaluate(() => window.devicePixelRatio),
        rttWidth: runtime["data-rtt-internal-width"],
        rttHeight: runtime["data-rtt-internal-height"],
      },
      hiddenDomControls,
      runtime,
      image,
    };
    expect(capture.cameraState.focalLengthMm).toBe(150);
    expect(capture.cameraState.focusDistanceMm).toBe(state.focusDistanceMm);
    expect(capture.cameraState.apertureFNumber).toBe(5.6);
    expect(capture.previewMode).toBe("Raw");
    expect(capture.rawDebug).toBe(false);
    expect(capture.contentful).toBe(true);
    expect(image.imageWidth).toBe(450);
    expect(image.imageHeight).toBe(360);
    captures.push(capture);
  }

  const loupeButton = page.getByRole("button", { name: "Focus loupe · 4× Ground Glass view", exact: true });
  await loupeButton.click();
  const loupeStage = page.locator('[data-focus-loupe-active="true"]').first();
  await expect(loupeStage).toHaveAttribute("data-focus-loupe-scale", "4");
  await expect.poll(async () => rtt.getAttribute("data-frame-request-id"))
    .not.toBe(previousRequestId);
  const loupeFrame = await readAcceptedFrame(page, rtt, mainSceneId, previousRequestId);
  previousRequestId = loupeFrame.requestId;
  const loupeCanvas = rtt.locator("canvas").first();
  const loupeHidden = await hideOverlappingDom(loupeCanvas);
  await waitForPaint(page);
  let loupeImage;
  try {
    loupeImage = await screenshot(page, loupeCanvas, testInfo.outputPath("o4-aligned-focus-loupe-4x.png"), 450, 360);
  } finally {
    await restoreDom(page);
  }
  captures.push({
    captureId: `rq3e-${captureRunId}-o4-focus-loupe-4x`,
    stateId: "o4-aligned-focus-loupe-4x",
    sceneId: mainSceneId,
    captureRole: "ground-glass-inspection-reference",
    cameraState: {
      focusDistanceMm: Number(await focus.inputValue()),
      frontTiltDeg: Number(await tilt.inputValue()),
      apertureFNumber: Number(await aperture.getAttribute("data-selected-aperture")),
    },
    focusLoupe: {
      active: await loupeStage.getAttribute("data-focus-loupe-active") === "true",
      scale: Number(await loupeStage.getAttribute("data-focus-loupe-scale")),
      centerU: Number(await loupeStage.getAttribute("data-focus-loupe-center-u")),
      centerV: Number(await loupeStage.getAttribute("data-focus-loupe-center-v")),
    },
    previewMode: "Raw",
    rawDebug: false,
    rendererIdentity: {
      rendererFamily: await rtt.getAttribute("data-mounted-renderer-family"),
      executionApi: await rtt.getAttribute("data-actual-execution-api"),
      rendererRevision: await rtt.getAttribute("data-three-revision"),
      applicationFallback: await rtt.getAttribute("data-application-fallback"),
      internalFallback: await rtt.getAttribute("data-internal-fallback"),
    },
    frame: loupeFrame,
    contentful: await rtt.getAttribute("data-rtt-final-contentful") === "true",
    hiddenDomControls: loupeHidden,
    image: loupeImage,
  });

  const secondaryScenes = ["macro-depth-of-field", "macro-bellows-extension"] as const;
  for (const sceneId of secondaryScenes) {
    await page.goto(`/simulator/free/${sceneId}?rttDiagnostics=1`, { waitUntil: "domcontentloaded" });
    const secondaryRtt = page.getByTestId("ground-glass-rtt").first();
    await expect(secondaryRtt).toHaveAttribute("data-rtt-scene-id", sceneId);
    await page.getByRole("combobox", { name: "Render quality", exact: true }).selectOption({ label: "Standard" });
    const secondaryRaw = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
    await secondaryRaw.check();
    const secondaryRawDebug = page.getByLabel("Raw RTT — bypass DOF", { exact: true });
    if (await secondaryRawDebug.isChecked()) await secondaryRawDebug.uncheck();
    const secondaryGrid = page.getByRole("checkbox", { name: "Grid", exact: true });
    if (await secondaryGrid.isChecked()) await secondaryGrid.uncheck();
    const frame = await readAcceptedFrame(page, secondaryRtt, sceneId);
    const canvas = secondaryRtt.locator("canvas").first();
    const bounds = await canvas.boundingBox();
    if (!bounds || Math.abs(bounds.width - 450) > 1 || Math.abs(bounds.height - 360) > 1) {
      throw new Error(`Unexpected Ground Glass display size in ${sceneId}`);
    }
    const hiddenDomControls = await hideOverlappingDom(canvas);
    await waitForPaint(page);
    const imageName = `${sceneId}-regression.png`;
    let image;
    try {
      image = await screenshot(page, canvas, testInfo.outputPath(imageName), 450, 360);
    } finally {
      await restoreDom(page);
    }
    captures.push({
      captureId: `rq3e-${captureRunId}-${sceneId}-regression`,
      stateId: `${sceneId}-canonical-regression`,
      sceneId,
      captureRole: "secondary-macro-regression-reference",
      renderQuality: "standard",
      previewMode: "Raw",
      rawDebug: false,
      rendererIdentity: {
        rendererFamily: await secondaryRtt.getAttribute("data-mounted-renderer-family"),
        executionApi: await secondaryRtt.getAttribute("data-actual-execution-api"),
        rendererRevision: await secondaryRtt.getAttribute("data-three-revision"),
        applicationFallback: await secondaryRtt.getAttribute("data-application-fallback"),
        internalFallback: await secondaryRtt.getAttribute("data-internal-fallback"),
      },
      frame,
      contentful: await secondaryRtt.getAttribute("data-rtt-final-contentful") === "true",
      hiddenDomControls,
      image,
    });
  }

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  const run = {
    schemaVersion: "rq3e-macro-oblique-capture-v1",
    captureRunId,
    capturePhase,
    sourceCommit,
    sourceTreeStatus: "clean",
    sceneId: mainSceneId,
    viewport: { width: 1280, height: 900, devicePixelRatio: 1 },
    renderQuality: "standard",
    previewMode: "Raw",
    rawDebug: false,
    browser: { name: "Chromium (Playwright)", version: browser?.version() ?? "unknown" },
    operatingSystem: { platform: platform(), release: release(), architecture: arch() },
    captureMethod: "Playwright screenshots of public Observer and actual WebGL Ground Glass canvases",
    subjectEvidence: subjectSnapshot,
    captures,
    pageErrors,
    consoleErrors,
  };
  await writeFile(testInfo.outputPath("capture-run.json"), `${JSON.stringify(run, null, 2)}\n`);
  expect(captures.filter((capture) => capture.captureRole === "photographic-ground-glass-reference")).toHaveLength(4);
  console.info("RQ3E Macro Oblique captures:", JSON.stringify({
    captureRunId,
    capturePhase,
    sourceCommit,
    captures: captures.map((capture) => ({
      stateId: capture.stateId,
      role: capture.captureRole,
      image: capture.image,
    })),
    subjectEvidence: subjectSnapshot,
  }));
});
