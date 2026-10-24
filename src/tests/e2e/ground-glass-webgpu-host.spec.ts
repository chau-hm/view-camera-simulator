import { expect, test, type Page } from "@playwright/test";
import { REVISION } from "three";
import { clickStageAt } from "./helpers/groundGlass";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const nativeWebGpuRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";

const ASYMMETRIC_POINTS = [
  { id: "left-upper-context", u: 0.29, v: 0.48 },
  { id: "left-upper-facade", u: 0.37, v: 0.32 },
  { id: "facade-focus-chart", u: 0.51, v: 0.65 },
  { id: "right-facade-window", u: 0.63, v: 0.34 },
  { id: "left-side-context", u: 0.25, v: 0.54 },
  { id: "right-side-return", u: 0.75, v: 0.54 },
  { id: "left-lower-context", u: 0.29, v: 0.67 },
  { id: "right-lower-return", u: 0.76, v: 0.69 },
  { id: "lower-facade", u: 0.51, v: 0.81 },
] as const;

type RasterPatch = Readonly<{ id: string; red: number; green: number; blue: number; luminance: number }>;

const waitForCurrentFrame = async (page: Page) => {
  const pane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await expect.poll(async () => {
    const requestId = await pane.getAttribute("data-frame-request-id");
    return Boolean(
      requestId &&
      requestId === await pane.getAttribute("data-last-completed-request-id") &&
      await pane.getAttribute("data-frame-result-status") === "completed",
    );
  }, { timeout: 90_000 }).toBe(true);
};

const analyzeCanvasScreenshot = async (page: Page, screenshot: Buffer) => page.evaluate(async (base64Png) => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64Png}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not decode the Raw WebGPU canvas screenshot");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Set<string>();
  let luminanceTotal = 0;
  let foregroundSamples = 0;
  let dominantBucket = "";
  const frequencies = new Map<string, number>();
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const bucket = `${red >> 4}:${green >> 4}:${blue >> 4}`;
    buckets.add(bucket);
    frequencies.set(bucket, (frequencies.get(bucket) ?? 0) + 1);
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 8) foregroundSamples += 1;
    luminanceTotal += red * 0.2126 + green * 0.7152 + blue * 0.0722;
  }
  let dominantCount = 0;
  for (const [bucket, count] of frequencies) {
    if (count > dominantCount) {
      dominantBucket = bucket;
      dominantCount = count;
    }
  }
  return {
    width: canvas.width,
    height: canvas.height,
    distinctColorBuckets: buckets.size,
    foregroundSamples,
    dominantBucket,
    meanLuminance: pixels.length ? luminanceTotal / (pixels.length / 4) : 0,
    contentful: buckets.size >= 12 && canvas.width * canvas.height - dominantCount >= 20,
  };
}, screenshot.toString("base64"));

const samplePatches = async (
  page: Page,
  screenshot: Buffer,
  points: readonly Readonly<{ id: string; u: number; v: number }>[],
  radius = 2,
): Promise<RasterPatch[]> => page.evaluate(async ({ base64, requestedPoints, patchRadius }) => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not sample the Raw WebGPU screenshot");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return requestedPoints.map(({ id, u, v }) => {
    const centerX = Math.round(u * (canvas.width - 1));
    const centerY = Math.round(v * (canvas.height - 1));
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    for (let y = Math.max(0, centerY - patchRadius); y <= Math.min(canvas.height - 1, centerY + patchRadius); y += 1) {
      for (let x = Math.max(0, centerX - patchRadius); x <= Math.min(canvas.width - 1, centerX + patchRadius); x += 1) {
        const offset = (y * canvas.width + x) * 4;
        red += pixels[offset] ?? 0;
        green += pixels[offset + 1] ?? 0;
        blue += pixels[offset + 2] ?? 0;
        count += 1;
      }
    }
    const meanRed = red / count;
    const meanGreen = green / count;
    const meanBlue = blue / count;
    return {
      id,
      red: meanRed,
      green: meanGreen,
      blue: meanBlue,
      luminance: meanRed * 0.2126 + meanGreen * 0.7152 + meanBlue * 0.0722,
    };
  });
}, {
  base64: screenshot.toString("base64"),
  requestedPoints: points,
  patchRadius: radius,
});

const meanPatchDifference = (left: readonly RasterPatch[], right: readonly RasterPatch[]) => {
  if (left.length !== right.length || left.length === 0) throw new Error("Raster patch inputs must be nonempty and aligned");
  return left.reduce((sum, patch, index) => {
    const other = right[index];
    if (!other) return sum;
    return sum + (Math.abs(patch.red - other.red) + Math.abs(patch.green - other.green) + Math.abs(patch.blue - other.blue)) / 3;
  }, 0) / left.length;
};

test("development Raw request defaults to WebGL and URL parameters cannot authorize the adapter", async ({ page }) => {
  const webgpuModuleRequests: string[] = [];
  page.on("request", (request) => {
    if (/three[/._-]webgpu|GroundGlassWebGPUAdapter/i.test(request.url())) webgpuModuleRequests.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise?groundGlassBackend=webgpu&rawDebug=true&rttDiagnostics=1");

  const pane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await expect(page.getByLabel("Raw RTT — bypass DOF")).not.toBeChecked();
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 60_000 });
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(pane).toHaveAttribute("data-actual-execution-api", /^webgl2?$/);
  await expect(page.getByTestId("ground-glass-webgpu-pilot")).toHaveCount(0);
  expect(webgpuModuleRequests).toEqual([]);
});

test("native-required app-host pilot renders Architecture Rise Raw RTT and cleans up across SPA remount", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired, "Run with GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 in the headed Chrome project");
  test.setTimeout(300_000);

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const webgpuModuleRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    if (/three[/._-]webgpu|GroundGlassWebGPUAdapter/i.test(request.url())) webgpuModuleRequests.push(request.url());
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  const pane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");

  const rawDebug = page.getByLabel("Raw RTT — bypass DOF");
  await rawDebug.check();
  let pilot = page.getByTestId("ground-glass-webgpu-pilot");
  await expect(pilot).toBeVisible({ timeout: 90_000 });
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(pilot).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-frame-ready", "true");
  await expect(pilot).toHaveAttribute("data-scene-subject-realization", "registered-ground-glass-profile");
  await expect(pilot).toHaveAttribute("data-scene-subject-mounted", "true");
  await expect(pilot).toHaveAttribute("data-scene-subject-child-count", /^[1-9]\d*$/);
  await expect(pilot).toHaveAttribute("data-camera-configured", "true");
  await expect(pilot).toHaveAttribute("data-camera-coordinate-system", "webgpu");
  await expect(pilot).toHaveAttribute("data-target-depth-enabled", "true");
  await expect(pilot).toHaveAttribute("data-target-depth-format", "depth24plus");
  await expect(pilot).toHaveAttribute("data-target-color-format", "rgba8unorm");
  await expect(pilot).toHaveAttribute("data-frame-scene-id", "architecture-rise");
  // Match the independently sampled Phase C state through the public, reachable control step.
  await setStepRangeInput(page, "Rise", 20);
  await waitForCurrentFrame(page);

  const initialGeneration = await pane.getAttribute("data-renderer-generation");
  const initialRequestId = await pane.getAttribute("data-frame-request-id");
  const currentCanvas = pilot.locator("canvas");
  const initialCanvasHandle = await currentCanvas.elementHandle();
  expect(initialGeneration).toBeTruthy();
  expect(initialRequestId).toBeTruthy();
  await expect(pane).toHaveAttribute("data-last-completed-request-id", initialRequestId!);
  await expect(pilot).toHaveAttribute("data-renderer-generation", initialGeneration!);
  await expect(pilot).toHaveAttribute("data-frame-request-id", initialRequestId!);
  await expect(pilot).toHaveAttribute("data-last-displayed-request-id", initialRequestId!);
  await expect(pilot).toHaveAttribute("data-last-displayed-frame-id", /generation-/);

  const initialCamera = await pilot.evaluate((element) => ({
    left: Number(element.getAttribute("data-camera-left")),
    right: Number(element.getAttribute("data-camera-right")),
    top: Number(element.getAttribute("data-camera-top")),
    bottom: Number(element.getAttribute("data-camera-bottom")),
    near: Number(element.getAttribute("data-camera-near")),
    far: Number(element.getAttribute("data-camera-far")),
  }));
  expect(Object.values(initialCamera).every(Number.isFinite)).toBe(true);
  expect(initialCamera.right).toBeGreaterThan(initialCamera.left);
  expect(initialCamera.top).toBeGreaterThan(initialCamera.bottom);
  expect(initialCamera.near).toBeGreaterThan(0);
  expect(initialCamera.far).toBeGreaterThan(initialCamera.near);

  const rawMode = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
  const uprightMode = page.getByRole("radio", { name: "Upright Assist", exact: true });
  await rawMode.check();
  await expect(pilot).toHaveAttribute("data-preview-mode", "raw");
  await waitForCurrentFrame(page);
  const rawImage = await currentCanvas.screenshot({ animations: "disabled" });
  const rawImageAnalysis = await analyzeCanvasScreenshot(page, rawImage);
  expect(rawImageAnalysis.contentful).toBe(true);
  expect(rawImageAnalysis.meanLuminance).toBeGreaterThan(1);
  await testInfo.attach("ground-glass-m3-webgpu-raw-native.png", {
    body: rawImage,
    contentType: "image/png",
  });

  const rawRequestId = await pane.getAttribute("data-frame-request-id");
  await uprightMode.check();
  await expect(pilot).toHaveAttribute("data-preview-mode", "upright");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(rawRequestId);
  await waitForCurrentFrame(page);
  const uprightImage = await currentCanvas.screenshot({ animations: "disabled" });
  const uprightImageAnalysis = await analyzeCanvasScreenshot(page, uprightImage);
  expect(uprightImageAnalysis.contentful).toBe(true);

  const rawPatches = await samplePatches(page, rawImage, ASYMMETRIC_POINTS);
  const uprightExpectedPatches = await samplePatches(page, uprightImage, ASYMMETRIC_POINTS.map((point) => ({
    ...point,
    u: 1 - point.u,
    v: 1 - point.v,
  })));
  const uprightWrongHorizontalPatches = await samplePatches(page, uprightImage, ASYMMETRIC_POINTS.map((point) => ({
    ...point,
    u: 1 - point.u,
  })));
  const uprightWrongVerticalPatches = await samplePatches(page, uprightImage, ASYMMETRIC_POINTS.map((point) => ({
    ...point,
    v: 1 - point.v,
  })));
  const orientationEvidence = {
    rawImage: rawImageAnalysis,
    uprightImage: uprightImageAnalysis,
    rawPatches,
    uprightExpectedPatches,
    correctMeanRgbDifference: meanPatchDifference(rawPatches, uprightExpectedPatches),
    wrongHorizontalDifference: meanPatchDifference(rawPatches, uprightWrongHorizontalPatches),
    wrongVerticalDifference: meanPatchDifference(rawPatches, uprightWrongVerticalPatches),
  };
  expect(orientationEvidence.correctMeanRgbDifference + 8).toBeLessThan(orientationEvidence.wrongHorizontalDifference);
  expect(orientationEvidence.correctMeanRgbDifference + 8).toBeLessThan(orientationEvidence.wrongVerticalDifference);

  const uprightRequestId = await pane.getAttribute("data-frame-request-id");
  await rawMode.check();
  await expect(pilot).toHaveAttribute("data-preview-mode", "raw");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(uprightRequestId);
  await waitForCurrentFrame(page);
  const stage = page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");
  const generationBeforeCrop = await pane.getAttribute("data-renderer-generation");
  const requestBeforeCrop = await pane.getAttribute("data-frame-request-id");
  await clickStageAt(page, stage, 0.7, 0.35);
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  await expect(stage).toHaveAttribute("data-focus-loupe-window-width", "0.25");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(requestBeforeCrop);
  await waitForCurrentFrame(page);
  expect(await pane.getAttribute("data-renderer-generation")).toBe(generationBeforeCrop);

  const displayedCrop = await stage.evaluate((element) => ({
    centerU: Number(element.getAttribute("data-focus-loupe-center-u")),
    centerV: Number(element.getAttribute("data-focus-loupe-center-v")),
    width: Number(element.getAttribute("data-focus-loupe-window-width")),
    height: Number(element.getAttribute("data-focus-loupe-window-height")),
  }));
  const rawSourceCrop = (await pilot.getAttribute("data-source-crop"))?.split(",").map(Number) ?? [];
  expect(rawSourceCrop).toHaveLength(4);
  expect(rawSourceCrop[0]).toBeCloseTo(1 - displayedCrop.centerU, 5);
  expect(rawSourceCrop[1]).toBeCloseTo(1 - displayedCrop.centerV, 5);
  expect(rawSourceCrop[2]).toBeCloseTo(0.25, 5);
  expect(rawSourceCrop[3]).toBeCloseTo(0.25, 5);
  const rawCropImage = await currentCanvas.screenshot({ animations: "disabled" });
  expect((await analyzeCanvasScreenshot(page, rawCropImage)).contentful).toBe(true);

  const rawCropRequestId = await pane.getAttribute("data-frame-request-id");
  await uprightMode.check();
  await expect(pilot).toHaveAttribute("data-preview-mode", "upright");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(rawCropRequestId);
  await waitForCurrentFrame(page);

  // Changing the public orientation intentionally resets the Stage loupe. Create a fresh
  // upright-space crop so this assertion checks the actual mode-specific crop contract.
  await expect(stage).toHaveAttribute("data-zoomed", "false");
  const uprightCropBaseRequest = await pane.getAttribute("data-frame-request-id");
  await clickStageAt(page, stage, 0.7, 0.35);
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(uprightCropBaseRequest);
  await waitForCurrentFrame(page);
  const uprightDisplayedCrop = await stage.evaluate((element) => ({
    centerU: Number(element.getAttribute("data-focus-loupe-center-u")),
    centerV: Number(element.getAttribute("data-focus-loupe-center-v")),
    width: Number(element.getAttribute("data-focus-loupe-window-width")),
    height: Number(element.getAttribute("data-focus-loupe-window-height")),
  }));
  const uprightSourceCrop = (await pilot.getAttribute("data-source-crop"))?.split(",").map(Number) ?? [];
  expect(uprightSourceCrop).toHaveLength(4);
  expect(uprightSourceCrop[0]).toBeCloseTo(uprightDisplayedCrop.centerU, 5);
  expect(uprightSourceCrop[1]).toBeCloseTo(uprightDisplayedCrop.centerV, 5);
  expect(uprightSourceCrop[2]).toBeCloseTo(0.25, 5);
  expect(uprightSourceCrop[3]).toBeCloseTo(0.25, 5);

  const resizeGeneration = await pane.getAttribute("data-renderer-generation");
  const resizeRequest = await pane.getAttribute("data-frame-request-id");
  const oldTargetSize = {
    width: Number(await pilot.getAttribute("data-target-width")),
    height: Number(await pilot.getAttribute("data-target-height")),
  };
  await page.setViewportSize({ width: 1160, height: 900 });
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(resizeRequest);
  await waitForCurrentFrame(page);
  expect(await pane.getAttribute("data-renderer-generation")).toBe(resizeGeneration);
  const resizedTargetSize = {
    width: Number(await pilot.getAttribute("data-target-width")),
    height: Number(await pilot.getAttribute("data-target-height")),
  };
  expect(resizedTargetSize.width > 0 && resizedTargetSize.height > 0).toBe(true);
  expect(resizedTargetSize.width !== oldTargetSize.width || resizedTargetSize.height !== oldTargetSize.height).toBe(true);

  const retiredGeneration = await pane.getAttribute("data-renderer-generation");
  const retiredCanvas = initialCanvasHandle;
  const retiredAdapter = await pilot.elementHandle();
  if (!retiredCanvas || !retiredAdapter) throw new Error("Native WebGPU adapter evidence could not be retained for cleanup verification");
  await page.getByRole("link", { name: "All Scenes", exact: true }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect.poll(() => page.evaluate((element) => !element.isConnected, retiredCanvas)).toBe(true);
  await expect.poll(() => retiredAdapter.getAttribute("data-cleanup-outcome"), { timeout: 90_000 }).toBe("confirmed");

  await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/architecture-rise"]').click();
  await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  const remountedPane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await expect(remountedPane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(remountedPane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await page.getByLabel("Raw RTT — bypass DOF").check();
  pilot = page.getByTestId("ground-glass-webgpu-pilot");
  await expect(remountedPane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expect(remountedPane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await waitForCurrentFrame(page);
  const remountedGeneration = await remountedPane.getAttribute("data-renderer-generation");
  const remountedRequestId = await remountedPane.getAttribute("data-frame-request-id");
  expect(remountedGeneration).toBeTruthy();
  expect(remountedRequestId).toBeTruthy();
  expect(remountedGeneration).not.toBe(retiredGeneration);
  await expect(pilot).toHaveAttribute("data-last-displayed-request-id", remountedRequestId!);
  expect(webgpuModuleRequests.length).toBeGreaterThan(0);

  await testInfo.attach("ground-glass-m3-native-host-evidence.json", {
    body: JSON.stringify({
      browserVersion: page.context().browser()?.version() ?? "unknown",
      operatingSystem: `${process.platform} ${process.arch}`,
      threeRevision: REVISION,
      environment: "headed native-required Chrome",
      sceneId: "architecture-rise",
      feature: "raw-rtt",
      initialGeneration,
      retiredGeneration,
      remountedGeneration,
      initialRequestId,
      rawSourceCrop,
      uprightSourceCrop,
      initialCamera,
      initialTargetSize: oldTargetSize,
      resizedTargetSize,
      rawImageAnalysis,
      orientationEvidence,
      cleanupOutcome: await retiredAdapter.getAttribute("data-cleanup-outcome"),
      mountedRendererFamily: await remountedPane.getAttribute("data-mounted-renderer-family"),
      actualExecutionApi: await remountedPane.getAttribute("data-actual-execution-api"),
      webgpuModuleRequests,
      pageErrors,
      consoleErrors,
    }, null, 2),
    contentType: "application/json",
  });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
