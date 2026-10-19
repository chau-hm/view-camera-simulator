import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const FIXTURE_PATH = "/src/tests/e2e/fixtures/ground-glass-webgpu-raw-rtt.html";
const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";

const ARCHITECTURE_RASTER_POINTS = [
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

const OFF_CENTER_DISPLAY_WINDOW = {
  centerU: 0.70625,
  centerV: 0.36875,
  widthFraction: 0.25,
  heightFraction: 0.25,
} as const;

const CROP_DISPLAY_SAMPLE_POINTS = [
  { id: "crop-upper-left-window", u: 0.18, v: 0.21 },
  { id: "crop-upper-facade", u: 0.42, v: 0.21 },
  { id: "crop-upper-right-return", u: 0.80, v: 0.26 },
  { id: "crop-lower-left-window", u: 0.18, v: 0.62 },
  { id: "crop-lower-facade", u: 0.55, v: 0.65 },
  { id: "crop-lower-right-context", u: 0.88, v: 0.85 },
] as const;

type SamplePoint = Readonly<{ id: string; u: number; v: number }>;
type Patch = Readonly<{
  id: string;
  red: number;
  green: number;
  blue: number;
  luminance: number;
}>;

const waitForPaint = async (page: Page) => {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
};

const readDiagnostics = async (page: Page) => {
  const text = await page.getByTestId("ground-glass-webgpu-diagnostics").textContent();
  if (!text) throw new Error("Ground Glass feasibility diagnostics were not published");
  return JSON.parse(text) as {
    status: string;
    generation: number;
    mode: "raw" | "upright";
    crop: string;
    adapter: { available: boolean; apiAvailable: boolean; error: string | null };
    browser: { userAgent: string; platform: string; threeRevision: string };
    cameraInput: {
      sceneId: string;
      focalLengthMm: number;
      focusDistanceMm: number;
      aperture: number;
      frontRiseMm: number;
      filmWidthMm: number;
      filmHeightMm: number;
    };
    webgl: {
      runtime: null | {
        rendererFamily: string;
        executionBackend: string;
        applicationFallback: boolean;
        initialized: boolean;
        targetKind: string;
      };
      render: null | Record<string, unknown>;
      error: string | null;
    };
    webgpu: {
      runtime: null | {
        rendererFamily: string;
        executionBackend: string;
        applicationFallback: boolean;
        initialized: boolean;
        targetKind: string;
      };
      render: null | Record<string, unknown>;
      error: string | null;
    };
    lifecycle: Record<string, number>;
  };
};

const captureCanvas = async (
  canvas: Locator,
  testInfo: TestInfo,
  name: string,
): Promise<Buffer> => {
  const image = await canvas.screenshot({ animations: "disabled" });
  const outputPath = testInfo.outputPath(name + ".png");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, image);
  await testInfo.attach(name, { path: outputPath, contentType: "image/png" });
  return image;
};

const attachJson = async (testInfo: TestInfo, name: string, value: unknown) => {
  const body = JSON.stringify(value, null, 2);
  const outputPath = testInfo.outputPath(name + ".json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, body);
  await testInfo.attach(name, { path: outputPath, contentType: "application/json" });
};

const samplePatches = async (
  page: Page,
  image: Buffer,
  points: readonly SamplePoint[],
  radiusPx = 5,
): Promise<Patch[]> => page.evaluate(async ({ base64, requestedPoints, radius }) => {
  const decoded = new Image();
  decoded.src = "data:image/png;base64," + base64;
  await decoded.decode();
  const canvas = document.createElement("canvas");
  canvas.width = decoded.naturalWidth;
  canvas.height = decoded.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to sample captured Ground Glass canvas");
  context.drawImage(decoded, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return requestedPoints.map(({ id, u, v }) => {
    const centerX = Math.round(u * (canvas.width - 1));
    const centerY = Math.round(v * (canvas.height - 1));
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    for (let y = Math.max(0, centerY - radius); y <= Math.min(canvas.height - 1, centerY + radius); y += 1) {
      for (let x = Math.max(0, centerX - radius); x <= Math.min(canvas.width - 1, centerX + radius); x += 1) {
        const index = (y * canvas.width + x) * 4;
        red += imageData.data[index] ?? 0;
        green += imageData.data[index + 1] ?? 0;
        blue += imageData.data[index + 2] ?? 0;
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
  base64: image.toString("base64"),
  requestedPoints: points,
  radius: radiusPx,
});

const meanPatchDifference = (first: readonly Patch[], second: readonly Patch[]): number => {
  if (first.length !== second.length || first.length === 0) {
    throw new Error("Raster sample sets must have the same nonzero length");
  }
  return first.reduce((sum, sample, index) => {
    const counterpart = second[index];
    if (!counterpart) return sum;
    return sum + (
      Math.abs(sample.red - counterpart.red) +
      Math.abs(sample.green - counterpart.green) +
      Math.abs(sample.blue - counterpart.blue)
    ) / 3;
  }, 0) / first.length;
};

const collectOrientationEvidence = async (
  page: Page,
  canvas: Locator,
  testInfo: TestInfo,
  label: string,
) => {
  await page.getByRole("button", { name: "Full film" }).click();
  await page.getByRole("button", { name: "Raw", exact: true }).click();
  await waitForPaint(page);
  const rawImage = await captureCanvas(canvas, testInfo, label + "-raw");
  const rawPatches = await samplePatches(page, rawImage, ARCHITECTURE_RASTER_POINTS);

  await page.getByRole("button", { name: "Upright Assist" }).click();
  await waitForPaint(page);
  const uprightImage = await captureCanvas(canvas, testInfo, label + "-upright");
  const expectedUprightPoints = ARCHITECTURE_RASTER_POINTS.map((point) => ({
    ...point,
    u: 1 - point.u,
    v: 1 - point.v,
  }));
  const uprightPatches = await samplePatches(page, uprightImage, expectedUprightPoints);
  const wrongHorizontalPatches = await samplePatches(
    page,
    uprightImage,
    ARCHITECTURE_RASTER_POINTS.map((point) => ({ ...point, v: 1 - point.v })),
  );
  const wrongVerticalPatches = await samplePatches(
    page,
    uprightImage,
    ARCHITECTURE_RASTER_POINTS.map((point) => ({ ...point, u: 1 - point.u })),
  );
  const correctDifference = meanPatchDifference(rawPatches, uprightPatches);
  const wrongHorizontalDifference = meanPatchDifference(rawPatches, wrongHorizontalPatches);
  const wrongVerticalDifference = meanPatchDifference(rawPatches, wrongVerticalPatches);
  const luminance = rawPatches.map((patch) => patch.luminance);
  const evidence = {
    referencePointsTopOrigin: ARCHITECTURE_RASTER_POINTS,
    rawPatches,
    uprightPatches,
    rawPatchLuminanceRange: Math.max(...luminance) - Math.min(...luminance),
    correctDifference,
    wrongHorizontalDifference,
    wrongVerticalDifference,
  };
  const evidenceJson = JSON.stringify(evidence, null, 2);
  const evidencePath = testInfo.outputPath(label + "-orientation-samples.json");
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, evidenceJson);
  await testInfo.attach(label + "-orientation-samples.json", {
    path: evidencePath,
    contentType: "application/json",
  });
  return evidence;
};

const expectOrientationEvidence = (evidence: Awaited<ReturnType<typeof collectOrientationEvidence>>) => {
  expect(
    evidence.rawPatchLuminanceRange,
    "the fixed asymmetric samples must include distinguishable Architecture Rise regions",
  ).toBeGreaterThan(20);
  expect(evidence.correctDifference, "Raw and Upright counterpart patches should agree").toBeLessThan(8);
  expect(
    evidence.wrongHorizontalDifference,
    "omitting horizontal reflection must worsen the actual raster agreement",
  ).toBeGreaterThan(evidence.correctDifference + 8);
  expect(
    evidence.wrongVerticalDifference,
    "omitting vertical reflection must worsen the actual raster agreement",
  ).toBeGreaterThan(evidence.correctDifference + 8);
  const sideContext = evidence.rawPatches.find((patch) => patch.id === "left-side-context");
  const sideReturn = evidence.rawPatches.find((patch) => patch.id === "right-side-return");
  expect(sideContext).toBeDefined();
  expect(sideReturn).toBeDefined();
  // The registered subject factory places a one-sided return at positive X.
  // Its absolute Raw display placement anchors the paired-mode comparison.
  expect(sideReturn!.luminance + 20).toBeLessThan(sideContext!.luminance);
};

const capturePairedBackendRaster = async (
  page: Page,
  testInfo: TestInfo,
  label: string,
) => {
  const webglImage = await captureCanvas(
    page.getByTestId("webgl-reference-canvas"),
    testInfo,
    label + "-webgl",
  );
  const webgpuImage = await captureCanvas(
    page.getByTestId("webgpu-candidate-canvas"),
    testInfo,
    label + "-webgpu",
  );
  const webglPatches = await samplePatches(page, webglImage, ARCHITECTURE_RASTER_POINTS);
  const webgpuPatches = await samplePatches(page, webgpuImage, ARCHITECTURE_RASTER_POINTS);
  const wrongHorizontalPatches = await samplePatches(
    page,
    webgpuImage,
    ARCHITECTURE_RASTER_POINTS.map((point) => ({ ...point, u: 1 - point.u })),
  );
  const wrongVerticalPatches = await samplePatches(
    page,
    webgpuImage,
    ARCHITECTURE_RASTER_POINTS.map((point) => ({ ...point, v: 1 - point.v })),
  );
  const evidence = {
    referencePointsTopOrigin: ARCHITECTURE_RASTER_POINTS,
    webglPatches,
    webgpuPatches,
    correctBackendDifference: meanPatchDifference(webglPatches, webgpuPatches),
    wrongHorizontalOriginDifference: meanPatchDifference(webglPatches, wrongHorizontalPatches),
    wrongVerticalOriginDifference: meanPatchDifference(webglPatches, wrongVerticalPatches),
  };
  await attachJson(testInfo, label + "-paired-raster-samples", evidence);
  expect(
    evidence.correctBackendDifference,
    "same-mode WebGPU and WebGL asymmetric raster landmarks should agree within the measured patch tolerance",
  ).toBeLessThan(8);
  expect(
    evidence.wrongHorizontalOriginDifference,
    "a horizontal source-origin mistake should materially worsen the paired raster evidence",
  ).toBeGreaterThan(evidence.correctBackendDifference + 8);
  expect(
    evidence.wrongVerticalOriginDifference,
    "a vertical source-origin mistake should materially worsen the paired raster evidence",
  ).toBeGreaterThan(evidence.correctBackendDifference + 8);
  return { evidence, webglImage, webgpuImage };
};

const assertCropCorrespondsToFullFilm = async (
  page: Page,
  testInfo: TestInfo,
  label: string,
  fullFilmImage: Buffer,
  croppedImage: Buffer,
) => {
  const fullFilmPoints = CROP_DISPLAY_SAMPLE_POINTS.map((point) => ({
    ...point,
    u: OFF_CENTER_DISPLAY_WINDOW.centerU +
      (point.u - 0.5) * OFF_CENTER_DISPLAY_WINDOW.widthFraction,
    v: OFF_CENTER_DISPLAY_WINDOW.centerV +
      (point.v - 0.5) * OFF_CENTER_DISPLAY_WINDOW.heightFraction,
  }));
  const incorrectCenteredPoints = CROP_DISPLAY_SAMPLE_POINTS.map((point) => ({
    ...point,
    u: 0.5 + (point.u - 0.5) * OFF_CENTER_DISPLAY_WINDOW.widthFraction,
    v: 0.5 + (point.v - 0.5) * OFF_CENTER_DISPLAY_WINDOW.heightFraction,
  }));
  const expectedPatches = await samplePatches(page, fullFilmImage, fullFilmPoints, 2);
  const croppedPatches = await samplePatches(page, croppedImage, CROP_DISPLAY_SAMPLE_POINTS, 2);
  const incorrectCenteredPatches = await samplePatches(page, fullFilmImage, incorrectCenteredPoints, 2);
  const evidence = {
    expectedDisplayWindow: OFF_CENTER_DISPLAY_WINDOW,
    cropDisplaySamplePoints: CROP_DISPLAY_SAMPLE_POINTS,
    correspondingFullFilmPoints: fullFilmPoints,
    expectedFullFilmPatches: expectedPatches,
    actualCroppedImagePatches: croppedPatches,
    incorrectCenteredWindowPatches: incorrectCenteredPatches,
    correctCropDifference: meanPatchDifference(expectedPatches, croppedPatches),
    incorrectCenteredWindowDifference: meanPatchDifference(incorrectCenteredPatches, croppedPatches),
  };
  await attachJson(testInfo, label + "-crop-correspondence", evidence);
  expect(
    Math.max(...expectedPatches.map((patch) => patch.luminance)) -
      Math.min(...expectedPatches.map((patch) => patch.luminance)),
    "fixed crop samples must cross distinguishable Architecture Rise regions",
  ).toBeGreaterThan(20);
  expect(
    evidence.correctCropDifference,
    "cropped render samples should correspond to the independently mapped off-center full-film locations",
  ).toBeLessThan(20);
  expect(
    evidence.incorrectCenteredWindowDifference,
    "the same crop pixels must not match a centered-window interpretation",
  ).toBeGreaterThan(evidence.correctCropDifference + 16);
};

test("Ground Glass WebGL control renders the registered subject through an offscreen texture", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto(FIXTURE_PATH);
  const fixture = page.getByTestId("ground-glass-webgpu-fixture");
  await expect(fixture).not.toHaveAttribute("data-status", "starting", { timeout: 90_000 });
  const diagnostics = await readDiagnostics(page);
  expect(diagnostics.webgl.runtime?.rendererFamily).toBe("webgl-renderer");
  expect(diagnostics.webgl.runtime?.executionBackend).toBe("webgl2");
  expect(diagnostics.webgl.runtime?.targetKind).toBe("THREE.WebGLRenderTarget");
  expect(diagnostics.webgl.render?.sceneRenderCount).toBeGreaterThan(0);
  expect(diagnostics.webgl.render?.displayRenderCount).toBeGreaterThan(0);
  const targetReadback = diagnostics.webgl.render?.targetReadback as {
    sampleCount: number;
    luminanceRange: number;
    contentfulSampleCount: number;
  };
  expect(targetReadback.sampleCount).toBeGreaterThan(0);
  expect(targetReadback.luminanceRange).toBeGreaterThan(20);
  expect(targetReadback.contentfulSampleCount).toBeGreaterThan(0);
  expect(diagnostics.browser.threeRevision).toBe("186");
  await testInfo.attach("ground-glass-webgl-target-and-display-evidence.json", {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: "application/json",
  });

  const canvas = page.getByTestId("webgl-reference-canvas");
  await expect(canvas).toBeVisible();
  expectOrientationEvidence(
    await collectOrientationEvidence(page, canvas, testInfo, "webgl-reference"),
  );

  await page.getByRole("button", { name: "4× off-center crop" }).click();
  await expect.poll(async () => (await readDiagnostics(page)).crop).toBe("off-center-4x");
  await waitForPaint(page);
  const cropped = await readDiagnostics(page);
  const cropEvidence = cropped.webgl.render as {
    sampledFilmWidthMm: number;
    sampledFilmHeightMm: number;
    inspectionWindow: { centerU: number; centerV: number; widthFraction: number; heightFraction: number };
    cameraFrustum: { left: number; right: number; top: number; bottom: number };
  };
  expect(cropEvidence.sampledFilmWidthMm).toBeCloseTo(127 / 4, 6);
  expect(cropEvidence.sampledFilmHeightMm).toBeCloseTo(101.6 / 4, 6);
  expect(cropEvidence.inspectionWindow.centerU).not.toBe(0.5);
  expect(cropEvidence.inspectionWindow.centerV).not.toBe(0.5);
  expect(cropEvidence.cameraFrustum.right - cropEvidence.cameraFrustum.left).toBeLessThan(1);
  await captureCanvas(canvas, testInfo, "webgl-reference-off-center-4x-crop");

  await page.getByRole("button", { name: "Resize targets" }).click();
  await expect.poll(async () => {
    const state = await readDiagnostics(page);
    return (state.webgl.render?.resizeCount as number | undefined) ?? 0;
  }).toBe(1);
  await waitForPaint(page);
  const resized = await readDiagnostics(page);
  expect(resized.webgl.render?.targetWidth).toBe(400);
  expect(resized.webgl.render?.targetHeight).toBe(320);
  expect(resized.webgl.render?.resizeCount).toBe(1);
  expect(resized.webgl.render?.targetResizeDisposeEvents).toBeGreaterThan(0);
});

test("native-required WebGPU Ground Glass RTT samples and presents an offscreen target", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired, "Run with OBSERVER_NATIVE_WEBGPU_REQUIRED=1 for a native-only gate");
  test.setTimeout(180_000);
  await page.goto(FIXTURE_PATH);
  const fixture = page.getByTestId("ground-glass-webgpu-fixture");
  await expect(fixture).not.toHaveAttribute("data-status", "starting", { timeout: 120_000 });
  const diagnostics = await readDiagnostics(page);
  expect(diagnostics.webgpu.runtime?.rendererFamily).toBe("webgpu-renderer");
  expect(diagnostics.webgpu.runtime?.executionBackend).toBe("webgpu");
  expect(diagnostics.webgpu.runtime?.targetKind).toBe("THREE.RenderTarget");
  expect(diagnostics.webgpu.runtime?.applicationFallback).toBe(false);
  expect(diagnostics.webgpu.runtime?.initialized).toBe(true);
  expect(diagnostics.webgpu.error).toBeNull();
  expect(diagnostics.adapter.apiAvailable).toBe(true);
  expect(diagnostics.adapter.available).toBe(true);
  expect(diagnostics.webgpu.render?.sceneRenderCount).toBeGreaterThan(0);
  expect(diagnostics.webgpu.render?.displayRenderCount).toBeGreaterThan(0);
  expect(diagnostics.webgl.render?.outputColorSpace).toBe("srgb");
  expect(diagnostics.webgpu.render?.outputColorSpace).toBe("srgb");
  expect(diagnostics.webgl.render?.toneMapping).toBe("0");
  expect(diagnostics.webgpu.render?.toneMapping).toBe("0");
  const targetReadback = diagnostics.webgpu.render?.targetReadback as {
    sampleCount: number;
    luminanceRange: number;
    contentfulSampleCount: number;
  };
  expect(targetReadback.sampleCount).toBeGreaterThan(0);
  expect(targetReadback.luminanceRange).toBeGreaterThan(20);
  expect(targetReadback.contentfulSampleCount).toBeGreaterThan(0);
  const webglRawImage = await captureCanvas(
    page.getByTestId("webgl-reference-canvas"),
    testInfo,
    "webgl-reference-paired-raw",
  );
  const nativeRawImage = await captureCanvas(
    page.getByTestId("webgpu-candidate-canvas"),
    testInfo,
    "native-webgpu-paired-raw",
  );
  const webglRawPatches = await samplePatches(page, webglRawImage, ARCHITECTURE_RASTER_POINTS);
  const nativeRawPatches = await samplePatches(page, nativeRawImage, ARCHITECTURE_RASTER_POINTS);
  const nativeVerticalFlipPatches = await samplePatches(
    page,
    nativeRawImage,
    ARCHITECTURE_RASTER_POINTS.map((point) => ({ ...point, v: 1 - point.v })),
  );
  const nativeHorizontalFlipPatches = await samplePatches(
    page,
    nativeRawImage,
    ARCHITECTURE_RASTER_POINTS.map((point) => ({ ...point, u: 1 - point.u })),
  );
  const pairedRasterEvidence = {
    identicalCanonicalCameraAndScene: true,
    cameraInput: diagnostics.cameraInput,
    webglRawPatches,
    nativeRawPatches,
    meanRgbDifference: meanPatchDifference(webglRawPatches, nativeRawPatches),
    wrongVerticalOriginDifference: meanPatchDifference(webglRawPatches, nativeVerticalFlipPatches),
    wrongHorizontalOriginDifference: meanPatchDifference(webglRawPatches, nativeHorizontalFlipPatches),
  };
  expect(
    pairedRasterEvidence.meanRgbDifference,
    "Raw reference landmarks should occupy the same physical-film display regions",
  ).toBeLessThan(pairedRasterEvidence.wrongVerticalOriginDifference + 8);
  expect(
    pairedRasterEvidence.meanRgbDifference,
    "Raw reference landmarks should not require a horizontal correction",
  ).toBeLessThan(pairedRasterEvidence.wrongHorizontalOriginDifference + 8);
  await attachJson(testInfo, "webgl-native-paired-raw-samples", pairedRasterEvidence);
  await attachJson(testInfo, "native-webgpu-renderer-evidence", {
    testHostPlatform: process.platform,
    adapterProbe: diagnostics.adapter,
    browser: diagnostics.browser,
    mountedRuntime: diagnostics.webgpu.runtime,
    applicationFallback: diagnostics.webgpu.runtime?.applicationFallback,
    render: diagnostics.webgpu.render,
    outputColorSpace: (diagnostics.webgpu.render as { outputColorSpace?: string } | null)?.outputColorSpace,
    toneMapping: (diagnostics.webgpu.render as { toneMapping?: string } | null)?.toneMapping,
    lifecycle: diagnostics.lifecycle,
    hardwareAcceleration: "not independently established by this test",
  });

  const canvas = page.getByTestId("webgpu-candidate-canvas");
  await expect(canvas).toBeVisible();
  expectOrientationEvidence(
    await collectOrientationEvidence(page, canvas, testInfo, "native-webgpu"),
  );

  const uprightFullFilmPair = await capturePairedBackendRaster(
    page,
    testInfo,
    "native-webgpu-upright-full-film",
  );

  await page.getByRole("button", { name: "4× centered crop" }).click();
  await expect.poll(async () => (await readDiagnostics(page)).crop).toBe("center-4x");
  await waitForPaint(page);
  const centered = await readDiagnostics(page);
  const centeredEvidence = centered.webgpu.render as {
    sampledFilmWidthMm: number;
    sampledFilmHeightMm: number;
    cameraFrustum: { left: number; right: number; top: number; bottom: number };
  };
  expect(centeredEvidence.sampledFilmWidthMm).toBeCloseTo(127 / 4, 6);
  expect(centeredEvidence.sampledFilmHeightMm).toBeCloseTo(101.6 / 4, 6);
  expect(centeredEvidence.cameraFrustum.right - centeredEvidence.cameraFrustum.left).toBeLessThan(1);
  await captureCanvas(canvas, testInfo, "native-webgpu-centered-4x-crop");

  await page.getByRole("button", { name: "4× off-center crop" }).click();
  await expect.poll(async () => (await readDiagnostics(page)).crop).toBe("off-center-4x");
  await waitForPaint(page);
  const offCenter = await readDiagnostics(page);
  const offCenterEvidence = offCenter.webgpu.render as {
    inspectionWindow: { centerU: number; centerV: number };
    sourceCropWindow: { centerU: number; centerV: number; widthFraction: number; heightFraction: number };
    cameraFrustum: { left: number; right: number; top: number; bottom: number };
  };
  // Independent expected center: a 4× window with display pan (-0.55, 0.35)
  // has center (0.5 - (-0.55 * 0.75 / 2), 0.5 - (0.35 * 0.75 / 2)).
  expect(offCenterEvidence.inspectionWindow.centerU).toBeCloseTo(0.70625, 6);
  expect(offCenterEvidence.inspectionWindow.centerV).toBeCloseTo(0.36875, 6);
  expect(offCenterEvidence.sourceCropWindow.centerU).toBeCloseTo(0.70625, 6);
  expect(offCenterEvidence.sourceCropWindow.centerV).toBeCloseTo(0.36875, 6);
  expect(offCenterEvidence.sourceCropWindow.widthFraction).toBeCloseTo(0.25, 6);
  expect(offCenterEvidence.sourceCropWindow.heightFraction).toBeCloseTo(0.25, 6);
  expect(offCenterEvidence.cameraFrustum.left).not.toBe(centeredEvidence.cameraFrustum.left);
  expect(offCenterEvidence.cameraFrustum.top).not.toBe(centeredEvidence.cameraFrustum.top);
  await captureCanvas(canvas, testInfo, "native-webgpu-off-center-4x-crop");
  const uprightCropPair = await capturePairedBackendRaster(
    page,
    testInfo,
    "native-webgpu-upright-off-center-4x",
  );
  await assertCropCorrespondsToFullFilm(
    page,
    testInfo,
    "native-webgpu-upright",
    uprightFullFilmPair.webgpuImage,
    uprightCropPair.webgpuImage,
  );
  await assertCropCorrespondsToFullFilm(
    page,
    testInfo,
    "webgl-upright",
    uprightFullFilmPair.webglImage,
    uprightCropPair.webglImage,
  );

  await page.getByRole("button", { name: "Raw", exact: true }).click();
  await expect.poll(async () => (await readDiagnostics(page)).mode).toBe("raw");
  await waitForPaint(page);
  await page.getByRole("button", { name: "Full film" }).click();
  await expect.poll(async () => (await readDiagnostics(page)).crop).toBe("full");
  await waitForPaint(page);
  const rawFullFilmPair = await capturePairedBackendRaster(
    page,
    testInfo,
    "native-webgpu-raw-full-film",
  );
  await page.getByRole("button", { name: "4× off-center crop" }).click();
  await expect.poll(async () => (await readDiagnostics(page)).crop).toBe("off-center-4x");
  await waitForPaint(page);
  const rawCrop = await readDiagnostics(page);
  const rawCropEvidence = rawCrop.webgpu.render as {
    sourceCropWindow: { centerU: number; centerV: number; widthFraction: number; heightFraction: number };
    cameraFrustum: { left: number; right: number; top: number; bottom: number };
  };
  // Raw's existing 180-degree display transform maps the same displayed pan
  // to the opposite source-crop center; optics and crop size stay unchanged.
  expect(rawCropEvidence.sourceCropWindow.centerU).toBeCloseTo(0.29375, 6);
  expect(rawCropEvidence.sourceCropWindow.centerV).toBeCloseTo(0.63125, 6);
  expect(rawCropEvidence.sourceCropWindow.widthFraction).toBeCloseTo(0.25, 6);
  expect(rawCropEvidence.sourceCropWindow.heightFraction).toBeCloseTo(0.25, 6);
  const rawTargetReadback = rawCrop.webgpu.render?.targetReadback as {
    sampleCount: number;
    luminanceRange: number;
    contentfulSampleCount: number;
  };
  expect(rawTargetReadback.sampleCount).toBeGreaterThan(0);
  expect(rawTargetReadback.luminanceRange).toBeGreaterThan(20);
  expect(rawTargetReadback.contentfulSampleCount).toBeGreaterThan(0);
  expect(rawCropEvidence.cameraFrustum.left).not.toBe(offCenterEvidence.cameraFrustum.left);
  expect(rawCropEvidence.cameraFrustum.top).not.toBe(offCenterEvidence.cameraFrustum.top);
  await captureCanvas(canvas, testInfo, "native-webgpu-raw-off-center-4x-crop");
  const rawCropPair = await capturePairedBackendRaster(
    page,
    testInfo,
    "native-webgpu-raw-off-center-4x",
  );
  await assertCropCorrespondsToFullFilm(
    page,
    testInfo,
    "native-webgpu-raw",
    rawFullFilmPair.webgpuImage,
    rawCropPair.webgpuImage,
  );
  await assertCropCorrespondsToFullFilm(
    page,
    testInfo,
    "webgl-raw",
    rawFullFilmPair.webglImage,
    rawCropPair.webglImage,
  );

  await page.getByRole("button", { name: "Resize targets" }).click();
  await expect.poll(async () => {
    const state = await readDiagnostics(page);
    return (state.webgpu.render?.resizeCount as number | undefined) ?? 0;
  }).toBe(1);
  await waitForPaint(page);
  const resized = await readDiagnostics(page);
  expect(resized.webgpu.render?.targetWidth).toBe(400);
  expect(resized.webgpu.render?.targetHeight).toBe(320);
  expect(resized.webgpu.render?.resizeCount).toBe(1);
  expect(resized.webgpu.render?.targetResizeDisposeEvents).toBeGreaterThan(0);

  const generation = Number(await fixture.getAttribute("data-generation"));
  await page.getByRole("button", { name: "Unmount and remount" }).click();
  await expect(fixture).toHaveAttribute("data-generation", String(generation + 1));
  await expect.poll(async () => (await readDiagnostics(page)).webgpu.runtime?.executionBackend).toBe("webgpu");
  const afterRemount = await readDiagnostics(page);
  expect(afterRemount.lifecycle.subjectDisposeCount).toBeGreaterThanOrEqual(2);
  expect(afterRemount.lifecycle.rendererDisposeCount).toBeGreaterThanOrEqual(1);

  const remountedGeneration = Number(await fixture.getAttribute("data-generation"));
  await page.getByRole("button", { name: "Remount during WebGPU readback" }).click();
  await expect(fixture).toHaveAttribute("data-generation", String(remountedGeneration + 1));
  await expect(fixture).toHaveAttribute("data-status", "ready", { timeout: 90_000 });
  await expect.poll(async () => (await readDiagnostics(page)).lifecycle.staleReadbacksDiscarded)
    .toBeGreaterThan(0);
  const afterReadbackRemount = await readDiagnostics(page);
  await attachJson(testInfo, "native-webgpu-lifecycle-evidence", {
    mountedExecutionBackend: afterReadbackRemount.webgpu.runtime?.executionBackend,
    resizedRender: resized.webgpu.render,
    afterOrdinaryRemount: afterRemount.lifecycle,
    afterReadbackRemount: afterReadbackRemount.lifecycle,
  });
});

test("native-required WebGPU display failure stays observable and remounts cleanly", async ({ page }) => {
  test.skip(!nativeWebGpuRequired, "Run with OBSERVER_NATIVE_WEBGPU_REQUIRED=1 for a native-only gate");
  test.setTimeout(120_000);
  await page.goto(FIXTURE_PATH);
  const fixture = page.getByTestId("ground-glass-webgpu-fixture");
  await expect(fixture).toHaveAttribute("data-status", "ready", { timeout: 120_000 });
  const mounted = await readDiagnostics(page);
  expect(mounted.webgpu.runtime?.rendererFamily).toBe("webgpu-renderer");
  expect(mounted.webgpu.runtime?.executionBackend).toBe("webgpu");
  expect(mounted.webgpu.runtime?.applicationFallback).toBe(false);

  await page.getByRole("button", { name: "Inject display failure" }).click();
  await expect(fixture).toHaveAttribute("data-status", "failed");
  const failed = await readDiagnostics(page);
  expect(failed.webgpu.render?.failedPass).toBe("textureDisplay");
  expect(failed.webgpu.error).toContain("Injected texture-display operation failure");
  expect(failed.webgpu.render?.targetReadback).toMatchObject({ sampleCount: 2048 });

  const generation = Number(await fixture.getAttribute("data-generation"));
  await page.getByRole("button", { name: "Unmount and remount" }).click();
  await expect(fixture).toHaveAttribute("data-generation", String(generation + 1));
  await expect(fixture).toHaveAttribute("data-status", "ready", { timeout: 120_000 });
  const remounted = await readDiagnostics(page);
  expect(remounted.webgpu.runtime?.executionBackend).toBe("webgpu");
  expect(remounted.lifecycle.rendererDisposeCount).toBeGreaterThan(0);
  expect(remounted.lifecycle.targetDisposeEvents).toBeGreaterThan(0);
  expect(remounted.lifecycle.subjectDisposeCount).toBeGreaterThan(0);
});

test("fixture failure after target allocation disposes the registered subject and renderer", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(FIXTURE_PATH + "?fixtureFailure=after-target-allocation");
  const fixture = page.getByTestId("ground-glass-webgpu-fixture");
  await expect(fixture).toHaveAttribute("data-status", "failed", { timeout: 90_000 });
  const diagnostics = await readDiagnostics(page);
  expect(diagnostics.webgpu.runtime).toBeNull();
  expect(diagnostics.webgpu.error).toContain("Injected partial initialization failure");
  expect(diagnostics.lifecycle.failedInitializationCleanupCount).toBeGreaterThan(0);
  expect(diagnostics.lifecycle.subjectDisposeCount).toBeGreaterThan(0);
  expect(diagnostics.lifecycle.rendererDisposeCount).toBeGreaterThan(0);
});

test("display failure remains visible and does not prevent a clean remount", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(FIXTURE_PATH);
  const fixture = page.getByTestId("ground-glass-webgpu-fixture");
  await expect(fixture).toHaveAttribute("data-status", "ready", { timeout: 90_000 });
  await page.getByRole("button", { name: "Inject display failure" }).click();
  await expect(fixture).toHaveAttribute("data-status", "failed");
  let diagnostics = await readDiagnostics(page);
  expect(diagnostics.webgpu.render?.failedPass).toBe("textureDisplay");
  expect(diagnostics.webgpu.error).toContain("Injected texture-display operation failure");
  const generation = Number(await fixture.getAttribute("data-generation"));
  await page.getByRole("button", { name: "Unmount and remount" }).click();
  await expect(fixture).toHaveAttribute("data-generation", String(generation + 1));
  await expect(fixture).toHaveAttribute("data-status", "ready", { timeout: 90_000 });
  diagnostics = await readDiagnostics(page);
  expect(diagnostics.lifecycle.subjectDisposeCount).toBeGreaterThan(0);
  expect(diagnostics.lifecycle.rendererDisposeCount).toBeGreaterThan(0);

  const remountedGeneration = Number(await fixture.getAttribute("data-generation"));
  await page.getByRole("button", { name: "Remount during WebGPU readback" }).click();
  await expect(fixture).toHaveAttribute("data-generation", String(remountedGeneration + 1));
  await expect(fixture).toHaveAttribute("data-status", "ready", { timeout: 90_000 });
  diagnostics = await readDiagnostics(page);
  expect(diagnostics.lifecycle.staleReadbacksDiscarded).toBeGreaterThan(0);
});
