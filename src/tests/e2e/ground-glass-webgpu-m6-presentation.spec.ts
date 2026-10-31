import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { release } from "node:os";
import { clickStageAt, readFreshElementBounds } from "./helpers/groundGlass";
import {
  groundGlassM7fCaptureProvenance,
  groundGlassM7fSourceProvenance,
  isGroundGlassM7fRequired,
  writeGroundGlassM7fCapture,
} from "./helpers/groundGlassM7fEvidence";
import type {
  GroundGlassApertureGatherCaptureReadback,
  GroundGlassWebGpuTestFailurePoint,
  GroundGlassWebGpuTestEvent,
} from "../../render/webgpu/groundGlassWebGpuTestSeam";

const nativeWebGpuRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const m6PresentationRequired = process.env.GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED === "1";
const m7fRequired = isGroundGlassM7fRequired();
const m6NativeRunRequired = m6PresentationRequired &&
  process.env.GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED === "1";
const expectedM6RendererRevision = m7fRequired ? "r187" : "r186";
const expectedM6EvidenceRevision = m7fRequired
  ? "m6-architecture-rise-native-presentation-r187-v1"
  : "m6-architecture-rise-native-presentation-v1";
const webServerPort = process.env.PLAYWRIGHT_WEB_SERVER_PORT ?? "4175";
const baselinePort = process.env.GROUND_GLASS_M6_WEBGL_BASELINE_PORT ?? String(Number(webServerPort) + 1);

const paneFor = (page: Page) => page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
const pilotFor = (page: Page) => page.getByTestId("ground-glass-webgpu-pilot");

const attachM6Evidence = async (
  testInfo: TestInfo,
  name: string,
  body: Buffer | string,
  contentType: string,
): Promise<void> => {
  const path = testInfo.outputPath(name);
  await writeFile(path, body);
  await testInfo.attach(name, { path, contentType });
};

const waitForCurrentFrame = async (page: Page): Promise<void> => {
  const pane = paneFor(page);
  await expect.poll(async () => {
    const requestId = await pane.getAttribute("data-frame-request-id");
    return Boolean(
      requestId &&
      requestId === await pane.getAttribute("data-last-completed-request-id") &&
      await pane.getAttribute("data-frame-result-status") === "completed",
    );
  }, { timeout: 120_000 }).toBe(true);
};

const screenshotStats = async (page: Page, png: Buffer) => page.evaluate(async (base64) => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not decode the M6 presentation capture");
  context.drawImage(image, 0, 0);
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let luminanceSum = 0;
  let nonBlack = 0;
  const colors = new Set<string>();
  for (let index = 0; index < rgba.length; index += 4) {
    const red = rgba[index] ?? 0;
    const green = rgba[index + 1] ?? 0;
    const blue = rgba[index + 2] ?? 0;
    luminanceSum += red * 0.2126 + green * 0.7152 + blue * 0.0722;
    if (Math.max(red, green, blue) > 8) nonBlack += 1;
    colors.add(`${red >> 4}:${green >> 4}:${blue >> 4}`);
  }
  return {
    width: canvas.width,
    height: canvas.height,
    meanSrgbLuminance: luminanceSum / Math.max(1, rgba.length / 4),
    nonBlackPixels: nonBlack,
    distinctSrgbBuckets: colors.size,
    contentful: nonBlack > 100 && colors.size > 16,
  };
}, png.toString("base64"));

const samplePatches = async (
  page: Page,
  png: Buffer,
  points: readonly Readonly<{ u: number; v: number }>[],
) => page.evaluate(async ({ base64, locations }) => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not sample asymmetric M6 presentation landmarks");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return locations.map(({ u, v }) => {
    const centerX = Math.round(u * (canvas.width - 1));
    const centerY = Math.round(v * (canvas.height - 1));
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    for (let y = Math.max(0, centerY - 2); y <= Math.min(canvas.height - 1, centerY + 2); y += 1) {
      for (let x = Math.max(0, centerX - 2); x <= Math.min(canvas.width - 1, centerX + 2); x += 1) {
        const offset = (y * canvas.width + x) * 4;
        red += pixels[offset] ?? 0;
        green += pixels[offset + 1] ?? 0;
        blue += pixels[offset + 2] ?? 0;
        count += 1;
      }
    }
    return [red / count, green / count, blue / count];
  });
}, { base64: png.toString("base64"), locations: points });

const patchDifference = (
  first: readonly (readonly number[])[],
  second: readonly (readonly number[])[],
): number => first.reduce((total, patch, index) => {
  const other = second[index] ?? [];
  return total + patch.reduce((sum, channel, channelIndex) =>
    sum + Math.abs(channel - (other[channelIndex] ?? 0)), 0);
}, 0) / Math.max(1, first.length * 3);

const comparePngPixels = async (page: Page, before: Buffer, after: Buffer) => page.evaluate(async ({ beforeBase64, afterBase64 }) => {
  const decode = async (base64: string): Promise<ImageData> => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not compare M6 overlay screenshots");
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  };
  const first = await decode(beforeBase64);
  const second = await decode(afterBase64);
  if (first.width !== second.width || first.height !== second.height) {
    throw new Error("M6 overlay screenshots have different dimensions");
  }
  let changedPixels = 0;
  let absoluteChannelError = 0;
  for (let offset = 0; offset < first.data.length; offset += 4) {
    let pixelChanged = false;
    for (let channel = 0; channel < 3; channel += 1) {
      const error = Math.abs((first.data[offset + channel] ?? 0) - (second.data[offset + channel] ?? 0));
      absoluteChannelError += error;
      pixelChanged ||= error > 0;
    }
    if (pixelChanged) changedPixels += 1;
  }
  return {
    width: first.width,
    height: first.height,
    changedPixels,
    meanAbsoluteChannelError: absoluteChannelError / Math.max(1, first.width * first.height * 3),
  };
}, {
  beforeBase64: before.toString("base64"),
  afterBase64: after.toString("base64"),
});

const captureM5CompositeReadback = async (page: Page, token: string, outputPath: string) => {
  const triggered = await page.evaluate((captureToken) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.requestApertureGatherCapture) return false;
    control.apertureGatherCaptureReadback = null;
    control.apertureGatherCaptureRequest = {
      token: captureToken,
      qualityMode: "half32",
      retainReadbackBuffers: true,
    };
    control.requestApertureGatherCapture();
    return true;
  }, token);
  expect(triggered, "Explicit M5 readback seam is attached to the native M6 adapter").toBe(true);
  await expect.poll(() => page.evaluate((captureToken) =>
    window.__groundGlassWebGpuM3TestControl?.apertureGatherCaptureReadback?.token === captureToken,
  token), { timeout: 180_000 }).toBe(true);

  const compressed = await page.evaluate(async (captureToken) => {
    const capture = window.__groundGlassWebGpuM3TestControl?.apertureGatherCaptureReadback;
    if (!capture || capture.token !== captureToken || !capture.readbackBuffers) return null;
    const values = [
      ["sourceRgba", capture.readbackBuffers.sourceRgba],
      ["farGatherRgba", capture.readbackBuffers.farGatherRgba],
      ["nearRgba", capture.readbackBuffers.nearRgba],
      ["b1FarRgba", capture.readbackBuffers.b1FarRgba],
      ["researchCompositeRgba", capture.readbackBuffers.researchCompositeRgba],
    ] as const;
    let byteLength = 0;
    const fields = values.map(([name, data]) => {
      const field = { name, offset: byteLength, byteLength: data.byteLength, valueCount: data.length };
      byteLength += data.byteLength;
      return field;
    });
    const bytes = new Uint8Array(byteLength);
    values.forEach(([, data], index) => {
      const field = fields[index];
      if (!field) throw new Error("Missing optical composite readback field metadata");
      bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), field.offset);
    });
    const gzip = await new Response(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer();
    const gzipBytes = new Uint8Array(gzip);
    const chunks: string[] = [];
    for (let offset = 0; offset < gzipBytes.length; offset += 0x6000) {
      chunks.push(btoa(String.fromCharCode(...gzipBytes.subarray(offset, offset + 0x6000))));
    }
    return {
      fields,
      gzipBase64: chunks.join(""),
      summary: { ...capture, readbackBuffers: null },
    };
  }, token);
  expect(compressed).not.toBeNull();
  if (!compressed) throw new Error("M5 composite capture did not include the explicit readback buffers");
  await writeFile(outputPath, Buffer.from(compressed.gzipBase64, "base64"));
  return {
    summary: compressed.summary as Omit<GroundGlassApertureGatherCaptureReadback, "readbackBuffers">,
    fields: compressed.fields,
    compressedReadbackArtifact: outputPath,
  };
};

const startM6NativeLowPage = async (
  page: Page,
  failurePoint?: GroundGlassWebGpuTestFailurePoint,
  initialRawDebug = false,
): Promise<void> => {
  await page.addInitScript(({ point, rawDebug }) => {
    window.__groundGlassWebGpuM3TestControl = {
      ...(point ? { failurePoint: point } : {}),
      ...(rawDebug ? { initialRawDebug: true } : {}),
    };
  }, { point: failurePoint ?? null, rawDebug: initialRawDebug });
  await page.setViewportSize({ width: 1000, height: 760 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  await page.getByLabel("Render quality").selectOption("low");
};

const readM6TestEvents = (page: Page): Promise<GroundGlassWebGpuTestEvent[]> => page.evaluate(() =>
  window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? [],
);

const persistM7fLifecycleEvidence = async (
  page: Page,
  scenarioId: string,
  observations: Readonly<Record<string, unknown>> = {},
): Promise<void> => {
  if (!m7fRequired) return;
  const pane = paneFor(page);
  const pilot = pilotFor(page);
  const [events, host, renderer] = await Promise.all([
    readM6TestEvents(page),
    pane.evaluate((element) => Object.fromEntries([
      "data-render-host-lifecycle", "data-policy-selected-backend", "data-application-fallback",
      "data-mounted-renderer-family", "data-actual-execution-api", "data-renderer-generation",
      "data-frame-request-id", "data-frame-channel-id", "data-frame-scene-id", "data-frame-result-status",
      "data-last-completed-request-id", "data-render-cleanup-status", "data-pilot-retry-status",
      "data-pilot-session-id",
    ].map((name) => [name, element.getAttribute(name)]))),
    pilot.count().then(async (count) => count === 0 ? null : pilot.evaluate((element) => Object.fromEntries([
      "data-mounted-renderer-family", "data-actual-execution-api", "data-internal-fallback",
      "data-renderer-generation", "data-frame-request-id", "data-frame-scene-id", "data-preview-mode",
      "data-presentation-status", "data-presentation-source", "data-presentation-request-id",
      "data-presentation-renderer-generation", "data-presentation-evidence-revision",
      "data-physical-coc-status", "data-aperture-gather-status",
    ].map((name) => [name, element.getAttribute(name)])))),
  ]);
  writeGroundGlassM7fCapture(`lifecycle/${scenarioId}.json`, {
    schemaVersion: 1,
    scenarioId,
    captureProvenance: {
      ...groundGlassM7fSourceProvenance(),
      browserProject: "chrome-native-webgpu",
    },
    browserVersion: page.context().browser()?.version() ?? "unknown",
    operatingSystem: `${process.platform} ${release()} ${process.arch}`,
    runtime: (() => {
      const runtime = events.find((event) => event.kind === "runtime-observed");
      return runtime ? { ...runtime, actualExecutionApi: runtime.executionApi } : null;
    })(),
    host,
    renderer,
    events,
    sceneId: host["data-frame-scene-id"],
    rendererGenerationId: host["data-renderer-generation"],
    pilotSessionId: host["data-pilot-session-id"],
    ...observations,
    observations,
  });
};

test("native M6 displays the M5 composite with shared crop and presentation behavior", async ({ page, context }, testInfo) => {
  test.skip(!nativeWebGpuRequired || !m6NativeRunRequired,
    "Requires headed chrome-native-webgpu and the trusted M6 development build flag");
  test.setTimeout(600_000);

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {};
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  console.log("[M6 E2E] loaded Architecture Rise");
  // M5 gather is intentionally expensive; keep both comparison paths at the same lower raster
  // resolution so this integration test can exercise the full interaction sequence in bounded time.
  await page.getByLabel("Render quality").selectOption("low");
  const pane = paneFor(page);
  const pilot = pilotFor(page);
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-internal-fallback", "none");
  await expect(pilot).toHaveAttribute("data-presentation-mode", "m6-experimental-dof");
  await expect(pilot).toHaveAttribute("data-presentation-source", "m5-research-composite");
  await expect(pilot).toHaveAttribute("data-presentation-renderer-revision", expectedM6RendererRevision);
  await expect(pilot).toHaveAttribute(
    "data-presentation-scene-source-revision",
    "architecture-rise-raw-rtt-v1+m6-presentation-v1",
  );
  await expect(pilot).toHaveAttribute(
    "data-presentation-evidence-revision",
    expectedM6EvidenceRevision,
  );
  await expect(pilot).toHaveAttribute("data-presentation-quality", "unqualified");
  await expect(pilot).toHaveAttribute("data-presentation-status", "completed", { timeout: 120_000 });
  await expect(pilot).toHaveAttribute("data-presentation-natural-illumination", "applied");
  await expect(pilot).toHaveAttribute("data-presentation-coverage", "applied");
  await expect(page.getByTestId("ground-glass-webgpu-pilot-status"))
    .toContainText("WebGPU M6 Experimental · Optical quality unqualified · Production disabled");
  await waitForCurrentFrame(page);
  console.log("[M6 E2E] initial M6 frame completed");

  const webglPage = await context.newPage();
  await webglPage.setViewportSize({ width: 1440, height: 1000 });
  await webglPage.goto(`http://127.0.0.1:${baselinePort}/simulator/free/architecture-rise?rttDiagnostics=1`);
  await webglPage.getByLabel("Render quality").selectOption("low");
  const webglPane = paneFor(webglPage);
  await expect(webglPane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(webglPane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await waitForCurrentFrame(webglPage);
  const webglCanvas = webglPage.locator('[data-testid="ground-glass-rtt"] canvas').first();
  await expect(webglCanvas).toBeVisible();
  const webglReference = await webglCanvas.screenshot({ animations: "disabled" });
  const webglStats = await screenshotStats(webglPage, webglReference);
  expect(webglStats.contentful).toBe(true);
  await attachM6Evidence(testInfo, "ground-glass-m6-webgl-reference.png", webglReference, "image/png");

  const m6RawCanvas = pilot.locator("canvas");
  const m6Raw = await m6RawCanvas.screenshot({ animations: "disabled" });
  const m6RawStats = await screenshotStats(page, m6Raw);
  expect(m6RawStats.contentful).toBe(true);
  await attachM6Evidence(testInfo, "ground-glass-m6-experimental-raw.png", m6Raw, "image/png");
  const displayFrameAtOpticalReadback = {
    requestId: await pane.getAttribute("data-frame-request-id"),
    channelId: await pane.getAttribute("data-rtt-channel"),
    sceneId: await pane.getAttribute("data-frame-scene-id"),
    rendererGenerationId: await pane.getAttribute("data-renderer-generation"),
    presentationStatus: await pilot.getAttribute("data-presentation-status"),
  };
  const m5CompositeCapture = await captureM5CompositeReadback(
    page,
    `m6-composite-${Date.now()}`,
    testInfo.outputPath("ground-glass-m6-native-optical-readback.bin.gz"),
  );
  expect(m5CompositeCapture.summary.requestId).toBe(displayFrameAtOpticalReadback.requestId);
  expect(m5CompositeCapture.summary.channelId).toBe(displayFrameAtOpticalReadback.channelId);
  expect(m5CompositeCapture.summary.sceneId).toBe(displayFrameAtOpticalReadback.sceneId);
  expect(m5CompositeCapture.summary.rendererGenerationId).toBe(displayFrameAtOpticalReadback.rendererGenerationId);
  expect(displayFrameAtOpticalReadback.presentationStatus).toBe("completed");
  await testInfo.attach("ground-glass-m6-native-optical-readback.bin.gz", {
    path: m5CompositeCapture.compressedReadbackArtifact,
    contentType: "application/gzip",
  });
  await attachM6Evidence(
    testInfo,
    "ground-glass-m6-m5-composite-capture.json",
    JSON.stringify(m5CompositeCapture, null, 2),
    "application/json",
  );
  console.log("[M6 E2E] M5 composite readback captured");

  const rawDebug = page.getByLabel("Raw RTT — bypass DOF");
  await rawDebug.check();
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-frame-ready", "true");
  await waitForCurrentFrame(page);
  console.log("[M6 E2E] Raw Debug frame completed");
  const m3Raw = await m6RawCanvas.screenshot({ animations: "disabled" });
  const m3RawStats = await screenshotStats(page, m3Raw);
  expect(m3RawStats.contentful).toBe(true);
  expect(await pilot.getAttribute("data-presentation-mode")).toBeNull();
  const m6VsM3RawComparison = await comparePngPixels(page, m6Raw, m3Raw);
  expect(m6VsM3RawComparison.changedPixels).toBeGreaterThan(0);
  await attachM6Evidence(testInfo, "ground-glass-m3-raw-debug-native.png", m3Raw, "image/png");

  await rawDebug.uncheck();
  await expect(pilot).toHaveAttribute("data-presentation-mode", "m6-experimental-dof", { timeout: 120_000 });
  await expect(pilot).toHaveAttribute("data-presentation-status", "completed", { timeout: 120_000 });
  await waitForCurrentFrame(page);
  console.log("[M6 E2E] restored M6 frame completed");
  const rawMode = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
  const uprightMode = page.getByRole("radio", { name: "Upright Assist", exact: true });
  await rawMode.check();
  await waitForCurrentFrame(page);
  console.log("[M6 E2E] Raw M6 frame completed");
  const rawPresentation = await m6RawCanvas.screenshot({ animations: "disabled" });
  const rawPresentationStats = await screenshotStats(page, rawPresentation);
  expect(rawPresentationStats.contentful).toBe(true);
  const rawRequest = await pane.getAttribute("data-frame-request-id");

  await uprightMode.check();
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(rawRequest);
  await waitForCurrentFrame(page);
  console.log("[M6 E2E] Upright M6 frame completed");
  const uprightPresentation = await m6RawCanvas.screenshot({ animations: "disabled" });
  const uprightStats = await screenshotStats(page, uprightPresentation);
  expect(uprightStats.contentful).toBe(true);
  const landmarks = [
    { u: 0.29, v: 0.48 }, { u: 0.37, v: 0.32 }, { u: 0.51, v: 0.65 },
    { u: 0.63, v: 0.34 }, { u: 0.25, v: 0.54 }, { u: 0.75, v: 0.54 },
    { u: 0.29, v: 0.67 }, { u: 0.76, v: 0.69 }, { u: 0.51, v: 0.81 },
  ];
  const rawPatches = await samplePatches(page, rawPresentation, landmarks);
  const uprightCorrect = await samplePatches(page, uprightPresentation,
    landmarks.map(({ u, v }) => ({ u: 1 - u, v: 1 - v })));
  const uprightHorizontalOnly = await samplePatches(page, uprightPresentation,
    landmarks.map(({ u, v }) => ({ u: 1 - u, v })));
  const uprightVerticalOnly = await samplePatches(page, uprightPresentation,
    landmarks.map(({ u, v }) => ({ u, v: 1 - v })));
  const orientationMetrics = {
    correct180DegreeMatchMeanRgbError: patchDifference(rawPatches, uprightCorrect),
    horizontalOnlyNegativeControlMeanRgbError: patchDifference(rawPatches, uprightHorizontalOnly),
    verticalOnlyNegativeControlMeanRgbError: patchDifference(rawPatches, uprightVerticalOnly),
  };
  expect(orientationMetrics.correct180DegreeMatchMeanRgbError + 4)
    .toBeLessThan(orientationMetrics.horizontalOnlyNegativeControlMeanRgbError);
  expect(orientationMetrics.correct180DegreeMatchMeanRgbError + 4)
    .toBeLessThan(orientationMetrics.verticalOnlyNegativeControlMeanRgbError);
  await attachM6Evidence(testInfo, "ground-glass-m6-experimental-upright.png", uprightPresentation, "image/png");

  await rawMode.check();
  await waitForCurrentFrame(page);
  console.log("[M6 E2E] loupe center frame completed");
  const stage = page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");
  const requestBeforeLoupe = await pane.getAttribute("data-frame-request-id");
  await clickStageAt(page, stage, 0.7, 0.35);
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(requestBeforeLoupe);
  await waitForCurrentFrame(page);
  console.log("[M6 E2E] loupe pan frame completed");
  const centeredCrop = await stage.evaluate((element) => ({
    centerU: Number(element.getAttribute("data-focus-loupe-center-u")),
    centerV: Number(element.getAttribute("data-focus-loupe-center-v")),
    width: Number(element.getAttribute("data-focus-loupe-window-width")),
    height: Number(element.getAttribute("data-focus-loupe-window-height")),
  }));
  const sourceCropAfterLoupe = (await pilot.getAttribute("data-source-crop"))?.split(",").map(Number) ?? [];
  expect(sourceCropAfterLoupe).toHaveLength(4);
  expect(sourceCropAfterLoupe[0]).toBeCloseTo(1 - centeredCrop.centerU, 5);
  expect(sourceCropAfterLoupe[1]).toBeCloseTo(1 - centeredCrop.centerV, 5);
  expect(sourceCropAfterLoupe[2]).toBeCloseTo(centeredCrop.width, 5);
  expect(sourceCropAfterLoupe[3]).toBeCloseTo(centeredCrop.height, 5);
  const loupeCenter = await m6RawCanvas.screenshot({ animations: "disabled" });
  await attachM6Evidence(testInfo, "ground-glass-m6-loupe-center.png", loupeCenter, "image/png");
  const grid = stage.getByTestId("ground-glass-grid");
  await expect(grid).toBeVisible();
  // Architecture Rise has the shared decorative grid; physical grid is supplied only by Macro.
  await expect(grid).toHaveAttribute("data-grid-mode", "decorative");
  const gridMetrics = await grid.evaluate((element) => ({
    mode: element.getAttribute("data-grid-mode"),
    physicalSpacingXPx: element.getAttribute("data-grid-spacing-x-px"),
    physicalSpacingYPx: element.getAttribute("data-grid-spacing-y-px"),
    backgroundPosition: getComputedStyle(element).backgroundPosition,
  }));
  expect(gridMetrics.physicalSpacingXPx).toBeNull();
  expect(gridMetrics.physicalSpacingYPx).toBeNull();
  const correctOverlayFrame = await stage.screenshot({ animations: "disabled" });
  const readUnderlyingFrameState = async () => ({
    requestId: await pane.getAttribute("data-frame-request-id"),
    generationId: await pane.getAttribute("data-renderer-generation"),
    presentationStatus: await pilot.getAttribute("data-presentation-status"),
    canvas: await m6RawCanvas.evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const bounds = canvas.getBoundingClientRect();
      return {
        width: canvas.width,
        height: canvas.height,
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        transform: getComputedStyle(canvas).transform,
      };
    }),
  });
  const underlyingFrameStateBeforeFlip = await readUnderlyingFrameState();
  const originalOverlayTransform = await grid.evaluate((element) => (element as HTMLElement).style.transform);
  await grid.evaluate((element) => {
    (element as HTMLElement).style.transform = "scale(-1, -1)";
  });
  const flippedOverlayFrame = await stage.screenshot({ animations: "disabled" });
  const underlyingFrameStateAfterFlip = await readUnderlyingFrameState();
  const overlayFlipNegativeControl = await comparePngPixels(page, correctOverlayFrame, flippedOverlayFrame);
  const underlyingFrameStateUnchanged =
    JSON.stringify(underlyingFrameStateAfterFlip) === JSON.stringify(underlyingFrameStateBeforeFlip);
  expect(overlayFlipNegativeControl.changedPixels).toBeGreaterThan(0);
  expect(underlyingFrameStateUnchanged).toBe(true);
  await grid.evaluate((element, transform) => {
    (element as HTMLElement).style.transform = transform;
  }, originalOverlayTransform);
  await attachM6Evidence(
    testInfo,
    "ground-glass-m6-stage-overlay-alignment.png",
    correctOverlayFrame,
    "image/png",
  );
  await attachM6Evidence(
    testInfo,
    "ground-glass-m6-grid-only-flip-negative-control.png",
    flippedOverlayFrame,
    "image/png",
  );

  const bounds = await readFreshElementBounds(stage);
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.62, bounds.y + bounds.height * 0.42, { steps: 5 });
  await page.mouse.up();
  await waitForCurrentFrame(page);
  console.log("[M6 E2E] f/22 frame completed");
  const pannedCrop = (await pilot.getAttribute("data-source-crop"))?.split(",").map(Number) ?? [];
  expect(pannedCrop).toHaveLength(4);
  expect(pannedCrop[0]).not.toBeCloseTo(sourceCropAfterLoupe[0] ?? Number.NaN, 4);
  const loupePanned = await m6RawCanvas.screenshot({ animations: "disabled" });
  await attachM6Evidence(testInfo, "ground-glass-m6-loupe-panned.png", loupePanned, "image/png");

  const lowThroughput = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  await lowThroughput.getByRole("radio", { name: "f/22" }).check();
  await waitForCurrentFrame(page);
  console.log("[M6 E2E] f/5.6 frame completed");
  const f22Gain = Number(await pilot.getAttribute("data-presentation-throughput-gain"));
  await lowThroughput.getByRole("radio", { name: "f/5.6" }).check();
  await waitForCurrentFrame(page);
  console.log("[M6 E2E] resized M6 frame completed");
  const f56Gain = Number(await pilot.getAttribute("data-presentation-throughput-gain"));
  expect(Number.isFinite(f22Gain) && Number.isFinite(f56Gain)).toBe(true);
  expect(f56Gain).toBeGreaterThan(f22Gain);

  const requestBeforeResize = await pane.getAttribute("data-frame-request-id");
  await page.setViewportSize({ width: 1160, height: 900 });
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(requestBeforeResize);
  await expect(pilot).toHaveAttribute("data-presentation-status", "completed", { timeout: 120_000 });
  await waitForCurrentFrame(page);
  const resizedOutput = {
    width: Number(await pilot.getAttribute("data-presentation-output-width")),
    height: Number(await pilot.getAttribute("data-presentation-output-height")),
    targetWidth: Number(await pilot.getAttribute("data-target-width")),
    targetHeight: Number(await pilot.getAttribute("data-target-height")),
  };
  expect(resizedOutput.width).toBeGreaterThan(0);
  expect(resizedOutput.height).toBeGreaterThan(0);
  expect(resizedOutput.targetWidth).toBeGreaterThan(0);
  expect(resizedOutput.targetHeight).toBeGreaterThan(0);
  const presentationPerformance = {
    additionalRenderTargetCount: Number(await pilot.getAttribute("data-presentation-additional-target-count")),
    additionalTargetAttachmentBytes: Number(await pilot.getAttribute("data-presentation-additional-target-attachment-bytes")),
    additionalFullscreenPassCount: Number(await pilot.getAttribute("data-presentation-additional-fullscreen-pass-count")),
    rendererCallCpuMs: Number(await pilot.getAttribute("data-presentation-pass-renderer-call-cpu-ms")),
    queueCompletionWaitMs: Number(await pilot.getAttribute("data-presentation-pass-queue-completion-wait-ms")),
    wallClockMs: Number(await pilot.getAttribute("data-presentation-pass-wall-clock-ms")),
  };
  expect(presentationPerformance.additionalRenderTargetCount).toBe(0);
  expect(presentationPerformance.additionalTargetAttachmentBytes).toBe(0);
  expect(presentationPerformance.additionalFullscreenPassCount).toBe(0);
  expect(Number.isFinite(presentationPerformance.rendererCallCpuMs)).toBe(true);
  expect(Number.isFinite(presentationPerformance.queueCompletionWaitMs)).toBe(true);
  expect(Number.isFinite(presentationPerformance.wallClockMs)).toBe(true);

  const finalDisplayIdentity = {
    requestId: await pane.getAttribute("data-frame-request-id"),
    channelId: await pane.getAttribute("data-rtt-channel"),
    sceneId: await pane.getAttribute("data-frame-scene-id"),
    rendererGenerationId: await pane.getAttribute("data-renderer-generation"),
  };
  const finalM5CompositeCapture = await captureM5CompositeReadback(
    page,
    `m6-final-composite-${Date.now()}`,
    testInfo.outputPath("ground-glass-m6-final-optical-readback.bin.gz"),
  );
  expect(finalM5CompositeCapture.summary.requestId).toBe(finalDisplayIdentity.requestId);
  expect(finalM5CompositeCapture.summary.channelId).toBe(finalDisplayIdentity.channelId);
  expect(finalM5CompositeCapture.summary.sceneId).toBe(finalDisplayIdentity.sceneId);
  expect(finalM5CompositeCapture.summary.rendererGenerationId).toBe(finalDisplayIdentity.rendererGenerationId);
  expect(await pilot.getAttribute("data-presentation-status")).toBe("completed");

  const m7fProvenance = m7fRequired ? groundGlassM7fCaptureProvenance() : null;
  const finalM6Report = {
    evaluatorRevision: m7fRequired ? "m7f-r187-registered-app-v1" : "m6-native-presentation-v1",
    sourceCommit: m7fProvenance?.sourceCommitSha ?? process.env.GROUND_GLASS_M6_SOURCE_COMMIT ?? "uncommitted-worktree",
    captureProvenance: m7fProvenance,
    threePackageVersion: m7fProvenance?.threePackageVersion ?? null,
    nodeVersion: m7fProvenance?.nodeVersion ?? process.version,
    browserVersion: context.browser()?.version() ?? "unknown",
    operatingSystem: `${process.platform} ${release()} ${process.arch}`,
    renderQuality: "low",
    sceneId: await pilot.getAttribute("data-frame-scene-id"),
    requestId: await pane.getAttribute("data-frame-request-id"),
    channelId: await pane.getAttribute("data-frame-channel-id"),
    rendererGenerationId: await pane.getAttribute("data-renderer-generation"),
    presentationRequestId: await pilot.getAttribute("data-presentation-request-id"),
    presentationChannelId: await pilot.getAttribute("data-presentation-channel-id"),
    presentationSceneId: await pilot.getAttribute("data-presentation-scene-id"),
    presentationRendererGenerationId: await pilot.getAttribute("data-presentation-renderer-generation"),
    rendererFamily: await pane.getAttribute("data-mounted-renderer-family"),
    actualExecutionApi: await pane.getAttribute("data-actual-execution-api"),
    rendererRevision: await pilot.getAttribute("data-presentation-renderer-revision"),
    sceneSourceRevision: await pilot.getAttribute("data-presentation-scene-source-revision"),
    verificationEvidenceRevision: await pilot.getAttribute("data-presentation-evidence-revision"),
    internalFallback: await pilot.getAttribute("data-internal-fallback"),
    applicationFallback: await pane.getAttribute("data-application-fallback"),
    presentationMode: await pilot.getAttribute("data-presentation-mode"),
    presentationStatus: await pilot.getAttribute("data-presentation-status"),
    presentationSource: await pilot.getAttribute("data-presentation-source"),
    presentationQuality: await pilot.getAttribute("data-presentation-quality"),
    previewMode: await pilot.getAttribute("data-preview-mode"),
    sourceDimensionsPx: {
      width: finalM5CompositeCapture.summary.sourceWidthPx,
      height: finalM5CompositeCapture.summary.sourceHeightPx,
    },
    displayDimensionsPx: {
      width: Number(await pilot.getAttribute("data-presentation-output-width")),
      height: Number(await pilot.getAttribute("data-presentation-output-height")),
    },
    naturalIllumination: await pilot.getAttribute("data-presentation-natural-illumination"),
    imageCircleCoverage: await pilot.getAttribute("data-presentation-coverage"),
    opticalReadback: {
      captureId: finalM5CompositeCapture.summary.captureId,
      requestId: finalM5CompositeCapture.summary.requestId,
      rendererGenerationId: finalM5CompositeCapture.summary.rendererGenerationId,
      sourceRevision: finalM5CompositeCapture.summary.sceneSourceRevision,
      effectiveOpticalRequestFingerprint: finalM5CompositeCapture.summary.effectiveOpticalRequestFingerprint,
      cameraStateFingerprint: finalM5CompositeCapture.summary.cameraStateFingerprint,
      sourceDimensionsPx: {
        width: finalM5CompositeCapture.summary.sourceWidthPx,
        height: finalM5CompositeCapture.summary.sourceHeightPx,
      },
      targetFormats: finalM5CompositeCapture.summary.targetFormats,
      completedPasses: finalM5CompositeCapture.summary.completedPasses,
      readbackColorDomain: finalM5CompositeCapture.summary.colorDomain,
      inputFingerprints: finalM5CompositeCapture.summary.inputFingerprints,
      physicalDataFingerprint: finalM5CompositeCapture.summary.physicalDataFingerprint,
      sourceToGatherMappingConformance: finalM5CompositeCapture.summary.sourceToGatherMappingConformance,
      nominalGatherCenterMappingConformance: finalM5CompositeCapture.summary.nominalGatherCenterMappingConformance,
      displayFrameAtCapture: finalDisplayIdentity,
      exactIdentityMatch: true,
    },
    f22ThroughputGain: f22Gain,
    f56ThroughputGain: f56Gain,
    crop: { centered: centeredCrop, sourceAfterZoom: sourceCropAfterLoupe, panned: pannedCrop },
    stageGridAndOverlay: {
      ...gridMetrics,
      physicalGridSceneStatus: "not-supported-by-Architecture-Rise; Macro-only shared overlay",
      overlayOnlyFlipNegativeControl: overlayFlipNegativeControl,
      underlyingFrameStateUnchanged,
      underlyingFrameStateBeforeFlip,
      underlyingFrameStateAfterFlip,
    },
    resize: resizedOutput,
    performance: presentationPerformance,
    comparisons: {
      webglReference: webglStats,
      m6Raw: m6RawStats,
      m3RawDebug: m3RawStats,
      webglVsM6Raw: await comparePngPixels(page, webglReference, m6Raw),
      m6VsM3Raw: m6VsM3RawComparison,
      upright: uprightStats,
      orientationMetrics,
    },
    qualityQualification: "unqualified",
    productionAuthorization: "disabled",
    adapterEvents: await readM6TestEvents(page),
  };
  await attachM6Evidence(
    testInfo,
    "ground-glass-m6-presentation-evidence.json",
    JSON.stringify(finalM6Report, null, 2),
    "application/json",
  );
  writeGroundGlassM7fCapture("registered-app-m6.json", finalM6Report);
  expect(pageErrors).toEqual([]);
  await webglPage.close();
  console.log("[M6 E2E] comparison page closed; test body complete");
});

test("native M6 provisions once from initial Raw Debug and completes Raw/M6/loupe/resize transitions", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired || !m6NativeRunRequired,
    "Requires headed chrome-native-webgpu and the trusted M6 development build flag");
  test.setTimeout(600_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await startM6NativeLowPage(page, undefined, true);

  const pane = paneFor(page);
  const pilot = pilotFor(page);
  const rawDebug = page.getByLabel("Raw RTT — bypass DOF");
  await expect(rawDebug).toBeChecked();
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-policy-selected-backend", "webgpu");
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pane).toHaveAttribute("data-application-fallback", "not-observed");
  await expect(pilot).toHaveAttribute("data-frame-raw-debug", "true");
  await expect(pilot).toHaveAttribute("data-adapter-initial-raw-debug", "true");
  await expect(pilot).toHaveAttribute("data-m6-session-provisioning", "ready");
  await expect(pilot).toHaveAttribute("data-m6-physical-resources-ready", "true");
  await expect(pilot).toHaveAttribute("data-m6-gather-resources-ready", "true");
  await expect(pilot).toHaveAttribute("data-m6-build-raw-pilot-enabled", "true");
  await expect(pilot).toHaveAttribute("data-m6-build-presentation-enabled", "true");
  await expect(pilot).toHaveAttribute("data-m6-build-physical-research-enabled", "false");
  await expect(pilot).toHaveAttribute("data-m6-build-gather-research-enabled", "false");
  await waitForCurrentFrame(page);

  const initialRawRequest = await pane.getAttribute("data-frame-request-id");
  const generation = await pane.getAttribute("data-renderer-generation");
  const pilotSessionId = await pane.getAttribute("data-pilot-session-id");
  const initialTargetDimensions = {
    widthPx: Number(await pilot.getAttribute("data-target-width")),
    heightPx: Number(await pilot.getAttribute("data-target-height")),
  };
  const initialPhysicalDimensions = {
    width: Number(await pilot.getAttribute("data-physical-coc-width-px")),
    height: Number(await pilot.getAttribute("data-physical-coc-height-px")),
  };
  const initialGatherSourceDimensions = {
    width: Number(await pilot.getAttribute("data-aperture-gather-source-width-px")),
    height: Number(await pilot.getAttribute("data-aperture-gather-source-height-px")),
  };
  const initialFarGatherDimensions = {
    width: Number(await pilot.getAttribute("data-aperture-gather-far-width-px")),
    height: Number(await pilot.getAttribute("data-aperture-gather-far-height-px")),
  };
  const initialNearGatherDimensions = {
    width: Number(await pilot.getAttribute("data-aperture-gather-near-width-px")),
    height: Number(await pilot.getAttribute("data-aperture-gather-near-height-px")),
  };
  const initialGatherTargetCount = Number(await pilot.getAttribute("data-m6-gather-target-count"));
  expect(initialRawRequest).toBeTruthy();
  expect(generation).toBeTruthy();
  expect(pilotSessionId).toBeTruthy();
  expect(initialPhysicalDimensions).toEqual({
    width: initialTargetDimensions.widthPx,
    height: initialTargetDimensions.heightPx,
  });
  expect(initialGatherSourceDimensions).toEqual({
    width: initialTargetDimensions.widthPx,
    height: initialTargetDimensions.heightPx,
  });
  expect(initialFarGatherDimensions.width).toBeGreaterThan(0);
  expect(initialFarGatherDimensions.height).toBeGreaterThan(0);
  expect(initialFarGatherDimensions).toEqual(initialNearGatherDimensions);
  await expect(pane).toHaveAttribute("data-pilot-retry-status", "available");
  expect(Number(await pilot.getAttribute("data-m6-gather-target-count"))).toBeGreaterThan(0);
  expect(await pilot.getAttribute("data-adapter-initial-request-id")).toBeTruthy();
  await expect(pilot).toHaveAttribute("data-physical-coc-status", "ready");
  await expect(pilot).toHaveAttribute("data-physical-coc-request-id", initialRawRequest!);
  await expect(pilot).toHaveAttribute("data-physical-coc-channel-id", "default");
  await expect(pilot).toHaveAttribute("data-physical-coc-scene-id", "architecture-rise");
  await expect(pilot).toHaveAttribute("data-physical-coc-renderer-generation", generation!);
  await expect(pilot).toHaveAttribute("data-physical-coc-passes", "");
  await expect(pilot).toHaveAttribute("data-aperture-gather-status", "ready");
  await expect(pilot).toHaveAttribute("data-aperture-gather-request-id", initialRawRequest!);
  await expect(pilot).toHaveAttribute("data-aperture-gather-renderer-generation", generation!);
  await expect(pilot).toHaveAttribute("data-aperture-gather-passes", "");
  await expect(pilot).not.toHaveAttribute("data-presentation-status", "completed");
  await expect(pilot).toHaveAttribute("data-last-displayed-request-id", initialRawRequest!);
  const initialRawPng = await pilot.locator("canvas").screenshot({ animations: "disabled" });
  expect((await screenshotStats(page, initialRawPng)).contentful).toBe(true);
  await attachM6Evidence(testInfo, "ground-glass-m6-raw-first-initial.png", initialRawPng, "image/png");

  const stage = page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");
  await clickStageAt(page, stage, 0.7, 0.35);
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 })
    .not.toBe(initialRawRequest);
  await waitForCurrentFrame(page);
  const loupeRawRequest = await pane.getAttribute("data-frame-request-id");
  expect(loupeRawRequest).not.toBe(initialRawRequest);
  expect(await pilot.getAttribute("data-frame-raw-debug")).toBe("true");
  const loupeSourceCrop = (await pilot.getAttribute("data-source-crop"))?.split(",").map(Number) ?? [];
  expect(loupeSourceCrop).toHaveLength(4);
  expect(loupeSourceCrop[2]).toBeLessThan(1);
  expect(loupeSourceCrop[3]).toBeLessThan(1);
  expect(await pilot.getAttribute("data-physical-coc-passes")).toBe("");
  expect(await pilot.getAttribute("data-aperture-gather-passes")).toBe("");

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 })
    .not.toBe(loupeRawRequest);
  await waitForCurrentFrame(page);
  const resizedRawRequest = await pane.getAttribute("data-frame-request-id");
  expect(resizedRawRequest).not.toBe(loupeRawRequest);
  expect(await pilot.getAttribute("data-frame-raw-debug")).toBe("true");
  expect(await pilot.getAttribute("data-physical-coc-passes")).toBe("");
  expect(await pilot.getAttribute("data-aperture-gather-passes")).toBe("");

  await page.evaluate(() => {
    window.__groundGlassWebGpuM3TestControl!.holdQueueCompletion = true;
  });
  await rawDebug.uncheck();
  await expect(pilot).toHaveAttribute("data-frame-raw-debug", "false");
  await expect(pilot).toHaveAttribute("data-presentation-mode", "m6-experimental-dof");
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 })
    .not.toBe(resizedRawRequest);
  const heldM6Request = await pane.getAttribute("data-frame-request-id");
  expect(heldM6Request).toBeTruthy();
  await expect.poll(() => page.evaluate(() =>
    window.__groundGlassWebGpuM3TestControl?.queueCompletionBarrierReached === true,
  ), { timeout: 60_000 }).toBe(true);
  expect(await pilot.getAttribute("data-last-displayed-request-id")).toBe(resizedRawRequest);
  const apertureGroup = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  const apertureOptions = await apertureGroup.getByRole("radio").evaluateAll((elements) =>
    elements.map((element) => ({
      name: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
      checked: (element as HTMLInputElement).checked,
    })),
  );
  const nextAperture = apertureOptions.find((option) => !option.checked)?.name;
  expect(nextAperture).toBeTruthy();
  try {
    await apertureGroup.getByRole("radio", { name: nextAperture!, exact: true }).check();
    await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 })
      .not.toBe(heldM6Request);
  } finally {
    await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseQueueCompletion?.());
  }
  const newestM6Request = await pane.getAttribute("data-frame-request-id");
  expect(newestM6Request).toBeTruthy();
  expect(newestM6Request).not.toBe(heldM6Request);
  await expect(pilot).toHaveAttribute("data-presentation-status", "completed", { timeout: 120_000 });
  await waitForCurrentFrame(page);
  const firstM6Request = await pane.getAttribute("data-frame-request-id");
  await expect(pane).toHaveAttribute("data-policy-selected-backend", "webgpu");
  await expect(pane).toHaveAttribute("data-pilot-session-id", pilotSessionId!);
  await expect(pane).toHaveAttribute("data-pilot-retry-status", "available");
  await expect(pane).toHaveAttribute("data-application-fallback", "not-observed");
  expect(firstM6Request).toBe(newestM6Request);
  await expect(pilot).toHaveAttribute("data-physical-coc-status", "completed");
  await expect(pilot).toHaveAttribute("data-physical-coc-request-id", firstM6Request!);
  await expect(pilot).toHaveAttribute("data-physical-coc-channel-id", "default");
  await expect(pilot).toHaveAttribute("data-physical-coc-scene-id", "architecture-rise");
  await expect(pilot).toHaveAttribute("data-physical-coc-renderer-generation", generation!);
  await expect(pilot).toHaveAttribute("data-aperture-gather-status", "completed");
  await expect(pilot).toHaveAttribute("data-aperture-gather-request-id", firstM6Request!);
  await expect(pilot).toHaveAttribute("data-aperture-gather-channel-id", "default");
  await expect(pilot).toHaveAttribute("data-aperture-gather-scene-id", "architecture-rise");
  await expect(pilot).toHaveAttribute("data-aperture-gather-renderer-generation", generation!);
  await expect(pilot).toHaveAttribute("data-presentation-source", "m5-research-composite");
  await expect(pilot).toHaveAttribute("data-presentation-request-id", firstM6Request!);
  await expect(pilot).toHaveAttribute("data-presentation-channel-id", "default");
  await expect(pilot).toHaveAttribute("data-presentation-scene-id", "architecture-rise");
  await expect(pilot).toHaveAttribute("data-presentation-renderer-generation", generation!);
  await expect(pilot).toHaveAttribute("data-last-displayed-request-id", firstM6Request!);
  await expect(pane).toHaveAttribute("data-last-completed-request-id", firstM6Request!);
  await expect(pilot).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-internal-fallback", "none");
  expect(await pilot.getAttribute("data-renderer-generation")).toBe(generation);
  expect(Number(await pilot.getAttribute("data-m6-gather-target-count"))).toBe(initialGatherTargetCount);
  const m6Image = await pilot.locator("canvas").screenshot({ animations: "disabled" });
  expect((await screenshotStats(page, m6Image)).contentful).toBe(true);
  await attachM6Evidence(testInfo, "ground-glass-m6-raw-first-completed.png", m6Image, "image/png");

  await rawDebug.check();
  await expect(pilot).toHaveAttribute("data-frame-raw-debug", "true");
  await waitForCurrentFrame(page);
  const middleRawRequest = await pane.getAttribute("data-frame-request-id");
  expect(middleRawRequest).not.toBe(firstM6Request);
  await expect(pilot).not.toHaveAttribute("data-presentation-status", "completed");
  expect(await pilot.getAttribute("data-physical-coc-passes")).toBe("");
  expect(await pilot.getAttribute("data-aperture-gather-passes")).toBe("");

  await page.setViewportSize({ width: 1000, height: 760 });
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 })
    .not.toBe(middleRawRequest);
  await waitForCurrentFrame(page);
  const finalRawRequest = await pane.getAttribute("data-frame-request-id");
  expect(finalRawRequest).not.toBe(middleRawRequest);
  await rawDebug.uncheck();
  await expect(pilot).toHaveAttribute("data-presentation-status", "completed", { timeout: 120_000 });
  await waitForCurrentFrame(page);
  const finalM6Request = await pane.getAttribute("data-frame-request-id");
  await expect(pilot).toHaveAttribute("data-physical-coc-request-id", finalM6Request!);
  await expect(pilot).toHaveAttribute("data-aperture-gather-request-id", finalM6Request!);
  const finalTargetDimensions = {
    widthPx: Number(await pilot.getAttribute("data-target-width")),
    heightPx: Number(await pilot.getAttribute("data-target-height")),
  };
  await expect(pilot).toHaveAttribute("data-physical-coc-width-px", String(finalTargetDimensions.widthPx));
  await expect(pilot).toHaveAttribute("data-physical-coc-height-px", String(finalTargetDimensions.heightPx));
  await expect(pilot).toHaveAttribute("data-aperture-gather-source-width-px", String(finalTargetDimensions.widthPx));
  await expect(pilot).toHaveAttribute("data-aperture-gather-source-height-px", String(finalTargetDimensions.heightPx));
  await expect(pilot).toHaveAttribute("data-aperture-gather-near-width-px", await pilot.getAttribute("data-aperture-gather-far-width-px") ?? "");
  await expect(pilot).toHaveAttribute("data-aperture-gather-near-height-px", await pilot.getAttribute("data-aperture-gather-far-height-px") ?? "");
  await expect(pilot).toHaveAttribute("data-presentation-request-id", finalM6Request!);
  await expect(pilot).toHaveAttribute("data-last-displayed-request-id", finalM6Request!);
  expect(finalM6Request).not.toBe(finalRawRequest);
  expect(await pilot.getAttribute("data-renderer-generation")).toBe(generation);
  await expect(pane).toHaveAttribute("data-policy-selected-backend", "webgpu");
  await expect(pane).toHaveAttribute("data-pilot-session-id", pilotSessionId!);
  await expect(pane).toHaveAttribute("data-pilot-retry-status", "available");
  await expect(pane).toHaveAttribute("data-application-fallback", "not-observed");

  const events = await readM6TestEvents(page);
  expect(events.filter((event) => event.kind === "failure")).toEqual([]);
  expect(events.filter((event) => event.kind === "attempt")).toHaveLength(1);
  expect(new Set(events.filter((event) => event.kind === "attempt").map((event) => event.generationId)))
    .toEqual(new Set([generation]));
  for (const requestId of [initialRawRequest, loupeRawRequest, resizedRawRequest, middleRawRequest, finalRawRequest]) {
    expect(events.some((event) => event.kind === "frame-completed" && event.requestId === requestId)).toBe(true);
  }
  expect(events.some((event) => event.kind === "frame-completed" && event.requestId === heldM6Request)).toBe(false);
  expect(events.some((event) => event.kind === "frame-completed" && event.requestId === finalM6Request)).toBe(true);
  expect(pageErrors).toEqual([]);
  const rawFirstLifecycleEvidence = {
    schemaVersion: 1,
    scenarioId: "raw-first-resource-provisioning",
    captureProvenance: m7fRequired ? groundGlassM7fCaptureProvenance() : null,
    browserVersion: page.context().browser()?.version() ?? "unknown",
    operatingSystem: `${process.platform} ${release()} ${process.arch}`,
    threePackageVersion: m7fRequired ? groundGlassM7fCaptureProvenance().threePackageVersion : null,
    nodeVersion: process.version,
    sceneId: await pane.getAttribute("data-frame-scene-id"),
    rendererGenerationId: generation,
    pilotSessionId,
    runtime: (() => {
      const runtime = events.find((event) => event.kind === "runtime-observed");
      return runtime ? { ...runtime, actualExecutionApi: runtime.executionApi } : null;
    })(),
    events,
    effectiveBuildConfiguration: {
      rawPilotEnabled: true,
      m6PresentationEnabled: true,
      physicalCocResearchEnabled: false,
      apertureGatherResearchEnabled: false,
    },
    initialRequest: {
      requestId: await pilot.getAttribute("data-adapter-initial-request-id"),
      rawDebug: true,
      completedRequestId: initialRawRequest,
      targetDimensionsPx: initialTargetDimensions,
      screenshotContentful: true,
    },
    provisionedResources: {
      sessionStatus: "ready",
      physicalResourcesReady: true,
      gatherResourcesReady: true,
      m5OwnedRenderTargetCount: initialGatherTargetCount,
      firstRawFrameResourceDimensionsPx: {
        physical: initialPhysicalDimensions,
        gatherSource: initialGatherSourceDimensions,
        farGather: initialFarGatherDimensions,
        nearGather: initialNearGatherDimensions,
      },
      currentRawFrameTargetDimensionsPx: initialTargetDimensions,
      rawFrameM4Passes: [],
      rawFrameM5Passes: [],
      m4AndM5TargetDimensionsTrackSource: true,
      resizedTargetDimensionsPx: finalTargetDimensions,
      resizedFarGatherDimensionsPx: {
        widthPx: Number(await pilot.getAttribute("data-aperture-gather-far-width-px")),
        heightPx: Number(await pilot.getAttribute("data-aperture-gather-far-height-px")),
      },
    },
    rawToM6QueueHold: {
      staleM6RequestId: heldM6Request,
      latestM6RequestId: firstM6Request,
      staleRequestPublished: events.some((event) => event.kind === "frame-completed" && event.requestId === heldM6Request),
      latestRequestCompleted: events.some((event) => event.kind === "frame-completed" && event.requestId === firstM6Request),
    },
    modeTransitions: [
      { requestId: initialRawRequest, rawDebug: true },
      { requestId: loupeRawRequest, rawDebug: true, focusLoupe: true },
      { requestId: resizedRawRequest, rawDebug: true, resized: true },
      { requestId: firstM6Request, rawDebug: false, m4M5M6Completed: true },
      { requestId: middleRawRequest, rawDebug: true, opticalPassesBypassed: true },
      { requestId: finalRawRequest, rawDebug: true, resized: true, opticalPassesBypassed: true },
      { requestId: finalM6Request, rawDebug: false, m4M5M6Completed: true },
    ],
    retryStateAfterValidTransitions: {
      status: await pane.getAttribute("data-pilot-retry-status"),
      epoch: Number(await pane.getAttribute("data-pilot-retry-epoch")),
    },
    adapterAttempts: events.filter((event) => event.kind === "attempt").map((event) => event.generationId),
    failures: events.filter((event) => event.kind === "failure"),
  };
  await attachM6Evidence(testInfo, "ground-glass-m6-raw-first-lifecycle-evidence.json", JSON.stringify(rawFirstLifecycleEvidence, null, 2), "application/json");
  writeGroundGlassM7fCapture("lifecycle/raw-first-provisioning.json", rawFirstLifecycleEvidence);
});

test("native M6 optical-resource initialization failure cleans up the Raw-first adapter and falls back", async ({ page }) => {
  test.skip(!nativeWebGpuRequired || !m6NativeRunRequired,
    "Requires headed chrome-native-webgpu and the trusted M6 development build flag");
  test.setTimeout(180_000);
  await startM6NativeLowPage(page, "m6-optical-resource-initialization", true);
  const pane = paneFor(page);
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-application-fallback", "occurred");
  await waitForCurrentFrame(page);
  await expect(pilotFor(page)).toHaveCount(0);

  const events = await readM6TestEvents(page);
  const failure = events.find((event) => event.kind === "failure" &&
    event.reason.includes("m6-optical-resource-initialization"));
  expect(failure).toMatchObject({ kind: "failure", stage: "initialization" });
  if (failure?.kind !== "failure") throw new Error("Raw-first M6 resource initialization failure was not observed");
  expect(events.some((event) => event.kind === "frame-completed" &&
    event.generationId === failure.generationId)).toBe(false);
  expect(events.filter((event) => event.kind === "cleanup" && event.generationId === failure.generationId))
    .toEqual([expect.objectContaining({ outcome: "confirmed" })]);
  const cleanupEvent = events.find((event) => event.kind === "cleanup" && event.generationId === failure.generationId);
  await persistM7fLifecycleEvidence(page, "optical-resource-initialization-failure", {
    failureStage: failure.stage,
    failureOperation: failure.operation,
    failureGenerationId: failure.generationId,
    cleanupOutcome: cleanupEvent?.kind === "cleanup" ? cleanupEvent.outcome : null,
  });
});

test("native M6 flags leave an unsupported Ground Glass scene on WebGL without attempting WebGPU", async ({ page }) => {
  test.skip(!nativeWebGpuRequired || !m6NativeRunRequired,
    "Requires headed chrome-native-webgpu and both trusted M6 development build flags");
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {};
  });
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("/simulator/free/macro-depth-of-field?rttDiagnostics=1");

  const pane = paneFor(page);
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(pane).toHaveAttribute("data-policy-selected-backend", "webgl");
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgl2");
  await expect(pane).toHaveAttribute("data-application-fallback", "not-observed");
  await expect(page.getByTestId("ground-glass-webgpu-pilot")).toHaveCount(0);
  expect((await readM6TestEvents(page)).filter((event) => event.kind === "attempt")).toEqual([]);
  await persistM7fLifecycleEvidence(page, "unsupported-scene-denied", { sceneId: "macro-depth-of-field", attemptCount: 0 });
});

const assertM6RuntimeFailureFallsBackWithoutPublishingDoF = async (
  page: Page,
  failurePoint: GroundGlassWebGpuTestFailurePoint,
  failedOperation: "presentation" | "textureDisplay",
): Promise<void> => {
  await startM6NativeLowPage(page);
  const pane = paneFor(page);
  const pilot = pilotFor(page);
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-presentation-status", "completed", { timeout: 120_000 });
  await waitForCurrentFrame(page);
  const priorRequestId = await pane.getAttribute("data-frame-request-id");

  await page.evaluate((point) => {
    window.__groundGlassWebGpuM3TestControl!.failurePoint = point;
  }, failurePoint);
  await page.getByRole("radiogroup", { name: "Aperture", exact: true })
    .getByRole("radio", { name: "f/8" }).check();
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 })
    .not.toBe(priorRequestId);
  const failedRequestId = await pane.getAttribute("data-frame-request-id");
  expect(failedRequestId).toBeTruthy();
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
  await waitForCurrentFrame(page);
  await expect(pilot).toHaveCount(0);

  const events = await readM6TestEvents(page);
  const failure = events.find((event) => event.kind === "failure" && event.operation === failedOperation);
  expect(failure).toMatchObject({
    kind: "failure",
    stage: "runtime",
    operation: failedOperation,
  });
  if (failure?.kind !== "failure") throw new Error("M6 injected failure was not observed");
  expect(failure.reason).toContain(`at ${failurePoint}`);
  expect(events.some((event) => event.kind === "frame-completed" &&
    event.generationId === failure.generationId && event.requestId === failedRequestId)).toBe(false);
  expect(new Set(events.filter((event) => event.kind === "attempt").map((event) => event.generationId)))
    .toEqual(new Set([failure.generationId]));
  expect(await pane.getAttribute("data-actual-execution-api")).not.toBe("webgpu");
  await persistM7fLifecycleEvidence(page, failedOperation === "presentation"
    ? "presentation-pass-failure"
    : "final-display-failure", {
    failurePoint,
    failedOperation,
    failedRequestId,
    failureStage: failure.stage,
    failureGenerationId: failure.generationId,
    fallbackBackend: await pane.getAttribute("data-mounted-renderer-family"),
    frameCompletedForFailedRequest: events.some((event) => event.kind === "frame-completed" &&
      event.generationId === failure.generationId && event.requestId === failedRequestId),
    attemptGenerations: [...new Set(events.filter((event) => event.kind === "attempt").map((event) => event.generationId))],
  });
};

test("native M6 presentation node initialization failure selects the existing WebGL host", async ({ page }) => {
  test.skip(!nativeWebGpuRequired || !m6NativeRunRequired,
    "Requires headed chrome-native-webgpu and the trusted M6 development build flag");
  test.setTimeout(180_000);
  await startM6NativeLowPage(page, "m6-presentation-node-initialization");
  const pane = paneFor(page);
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
  await waitForCurrentFrame(page);
  await expect(pilotFor(page)).toHaveCount(0);

  const events = await readM6TestEvents(page);
  const failure = events.find((event) => event.kind === "failure" &&
    event.reason.includes("m6-presentation-node-initialization"));
  expect(failure).toMatchObject({ kind: "failure", stage: "initialization" });
  if (failure?.kind !== "failure") throw new Error("M6 presentation node initialization failure was not observed");
  expect(events.some((event) => event.kind === "frame-completed" &&
    event.generationId === failure.generationId)).toBe(false);
  await persistM7fLifecycleEvidence(page, "presentation-node-initialization-failure", {
    failureStage: failure.stage,
    failureOperation: failure.operation,
    failureGenerationId: failure.generationId,
    fallbackBackend: await pane.getAttribute("data-mounted-renderer-family"),
  });
});

test("native M6 presentation-pass failure never publishes a completed M6 frame", async ({ page }) => {
  test.skip(!nativeWebGpuRequired || !m6NativeRunRequired,
    "Requires headed chrome-native-webgpu and the trusted M6 development build flag");
  test.setTimeout(180_000);
  await assertM6RuntimeFailureFallsBackWithoutPublishingDoF(
    page,
    "m6-presentation-before-render",
    "presentation",
  );
});

test("native M6 final-display failure never publishes a completed M6 frame", async ({ page }) => {
  test.skip(!nativeWebGpuRequired || !m6NativeRunRequired,
    "Requires headed chrome-native-webgpu and the trusted M6 development build flag");
  test.setTimeout(180_000);
  await assertM6RuntimeFailureFallsBackWithoutPublishingDoF(
    page,
    "texture-display-after-submit",
    "textureDisplay",
  );
});

test("native M6 rejects presentation work made stale by resize before queue completion", async ({ page }) => {
  test.skip(!nativeWebGpuRequired || !m6NativeRunRequired,
    "Requires headed chrome-native-webgpu and the trusted M6 development build flag");
  test.setTimeout(180_000);
  await startM6NativeLowPage(page);
  const pane = paneFor(page);
  const pilot = pilotFor(page);
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expect(pilot).toHaveAttribute("data-presentation-status", "completed", { timeout: 120_000 });
  await waitForCurrentFrame(page);

  await page.evaluate(() => {
    window.__groundGlassWebGpuM3TestControl!.holdPresentationQueueCompletion = true;
  });
  const previousRequestId = await pane.getAttribute("data-frame-request-id");
  await page.getByRole("radiogroup", { name: "Aperture", exact: true })
    .getByRole("radio", { name: "f/8" }).check();
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 })
    .not.toBe(previousRequestId);
  const heldRequestId = await pane.getAttribute("data-frame-request-id");
  await expect.poll(() => page.evaluate(() =>
    window.__groundGlassWebGpuM3TestControl?.presentationQueueCompletionBarrierReached === true,
  ), { timeout: 60_000 }).toBe(true);

  let newestRequestId: string | null = null;
  try {
    await page.setViewportSize({ width: 1160, height: 900 });
    await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 })
      .not.toBe(heldRequestId);
    newestRequestId = await pane.getAttribute("data-frame-request-id");
  } finally {
    await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releasePresentationQueueCompletion?.());
  }
  expect(newestRequestId).toBeTruthy();
  await waitForCurrentFrame(page);
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(pilot).toHaveAttribute("data-presentation-status", "completed");

  const events = await readM6TestEvents(page);
  expect(events.some((event) => event.kind === "frame-completed" &&
    event.requestId === heldRequestId)).toBe(false);
  expect(events.some((event) => event.kind === "frame-completed" &&
    event.requestId === newestRequestId)).toBe(true);
  expect(await pane.getAttribute("data-last-completed-request-id")).toBe(newestRequestId);
  await persistM7fLifecycleEvidence(page, "presentation-stale-resize", {
    staleRequestId: heldRequestId,
    latestRequestId: newestRequestId,
    staleRequestPublished: events.some((event) => event.kind === "frame-completed" && event.requestId === heldRequestId),
    latestRequestPublished: events.some((event) => event.kind === "frame-completed" && event.requestId === newestRequestId),
  });
});
