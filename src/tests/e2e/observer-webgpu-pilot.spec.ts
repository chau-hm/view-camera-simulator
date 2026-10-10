import { release } from "node:os";
import { REVISION } from "three";
import { expect, test, type Browser, type Locator, type Page, type TestInfo } from "@playwright/test";

const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";

const waitForMountedObserver = async (page: Page) => {
  const observer = page.getByTestId("scene-canvas");
  await expect(observer.locator("canvas")).toHaveCount(1);
  await expect(observer).toHaveAttribute("data-observer-renderer-request", /^(webgl|webgpu-pilot)$/);
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", {
    timeout: 60_000,
  });
  await expect(observer).toHaveAttribute(
    "data-observer-renderer-family",
    /^(webgl-renderer|webgpu-renderer)$/,
    { timeout: 60_000 },
  );
  await expect(observer).toHaveAttribute("data-scene-subject-id", "view-camera-anatomy");
  return observer;
};

const readObserverAttributes = async (observer: Locator) => observer.evaluate((element) =>
  Object.fromEntries(
    Array.from(element.attributes)
      .filter((attribute) => attribute.name.startsWith("data-observer-"))
      .map((attribute) => [attribute.name, attribute.value]),
  ),
);

const attachMountedObserverEvidence = async (
  testInfo: TestInfo,
  observer: Locator,
) => {
  const attributes = await readObserverAttributes(observer);
  await testInfo.attach("mounted-observer-capabilities.json", {
    body: JSON.stringify(attributes, null, 2),
    contentType: "application/json",
  });
  return attributes;
};

type CanvasPixelEvidence = Readonly<{
  width: number;
  height: number;
  distinctColorBuckets: number;
  foregroundPixelSamples: number;
  contentful: boolean;
}>;

const analyzeCanvasScreenshot = async (
  page: Page,
  screenshot: Buffer,
): Promise<CanvasPixelEvidence> => page.evaluate(async (pngBase64) => {
  const image = new Image();
  image.src = `data:image/png;base64,${pngBase64}`;
  await image.decode();

  const sample = document.createElement("canvas");
  sample.width = image.naturalWidth;
  sample.height = image.naturalHeight;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      distinctColorBuckets: 0,
      foregroundPixelSamples: 0,
      contentful: false,
    };
  }

  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  const colors = new Map<string, number>();
  let sampleCount = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const bucket = `${red >> 4}:${green >> 4}:${blue >> 4}`;
    colors.set(bucket, (colors.get(bucket) ?? 0) + 1);
    sampleCount += 1;
  }

  const backgroundPixelSamples = Math.max(...colors.values());
  const foregroundPixelSamples = sampleCount - backgroundPixelSamples;

  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    distinctColorBuckets: colors.size,
    foregroundPixelSamples,
    contentful: colors.size >= 12 && foregroundPixelSamples >= 20,
  };
}, screenshot.toString("base64"));

type ObserverViewState = Readonly<{
  position: string | null;
  target: string | null;
}>;

const readObserverViewState = async (observer: Locator): Promise<ObserverViewState> => ({
  position: await observer.getAttribute("data-observer-camera-position"),
  target: await observer.getAttribute("data-orbit-target"),
});

const vectorsMatch = (first: string | null, second: string | null): boolean => {
  if (first === null || second === null) return false;
  const firstValues = first.split(",").map(Number);
  const secondValues = second.split(",").map(Number);
  return firstValues.length === 3 && secondValues.length === 3 &&
    firstValues.every((value, index) =>
      Number.isFinite(value) && Number.isFinite(secondValues[index]) &&
      Math.abs(value - (secondValues[index] ?? Number.NaN)) < 0.00001
    );
};

const waitForViewStateChange = async (
  observer: Locator,
  baseline: ObserverViewState,
  shouldMatch: boolean,
  timeoutMs: number,
): Promise<ObserverViewState> => {
  const deadline = Date.now() + timeoutMs;
  let current = await readObserverViewState(observer);
  const matches = (state: ObserverViewState) =>
    vectorsMatch(state.position, baseline.position) &&
    vectorsMatch(state.target, baseline.target);

  while ((matches(current) !== shouldMatch) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    current = await readObserverViewState(observer);
  }
  return current;
};

const exerciseObserverControls = async (
  page: Page,
  observer: Locator,
) => {
  await page.getByRole("button", { name: "Camera" }).click();
  await expect(observer).toHaveAttribute("data-view-focus", "camera");
  const cameraFocusSelected = await observer.getAttribute("data-view-focus") === "camera";
  const resetBaseline = await readObserverViewState(observer);

  const canvas = observer.locator("canvas");
  const bounds = await canvas.boundingBox();
  if (bounds) {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 72, centerY + 26, { steps: 5 });
    await page.mouse.up();
  }

  const orbitViewState = await waitForViewStateChange(
    observer,
    resetBaseline,
    false,
    3_000,
  );
  const orbitInteractionWorked =
    !vectorsMatch(orbitViewState.position, resetBaseline.position) ||
    !vectorsMatch(orbitViewState.target, resetBaseline.target);

  await page.getByRole("button", { name: "Reset 3D view" }).click();
  const resetViewState = await waitForViewStateChange(
    observer,
    resetBaseline,
    true,
    5_000,
  );

  return {
    cameraFocusSelected,
    orbitInteractionWorked,
    resetRestoredCameraPosition: vectorsMatch(
      resetViewState.position,
      resetBaseline.position,
    ),
    resetRestoredOrbitTarget: vectorsMatch(resetViewState.target, resetBaseline.target),
  };
};

const attachRuntimeVerification = async (input: Readonly<{
  testInfo: TestInfo;
  browser: Browser;
  observer: Locator;
  groundGlass: Locator;
  canvasPixels: CanvasPixelEvidence;
  interactions: Awaited<ReturnType<typeof exerciseObserverControls>>;
  pageErrors: string[];
}>) => {
  const { testInfo, browser, observer, groundGlass, canvasPixels, interactions, pageErrors } = input;
  const attributes = await readObserverAttributes(observer);
  const groundGlassContentful =
    await groundGlass.getAttribute("data-rtt-final-contentful") === "true";
  const sceneSubjectId = await observer.getAttribute("data-scene-subject-id") ?? "unknown";
  const observerReady =
    sceneSubjectId === "view-camera-anatomy" &&
    canvasPixels.contentful && interactions.cameraFocusSelected &&
    interactions.orbitInteractionWorked &&
    interactions.resetRestoredCameraPosition &&
    interactions.resetRestoredOrbitTarget;

  const report = {
    schemaVersion: 1,
    environment: {
      operatingSystem: process.platform,
      osRelease: release(),
      architecture: process.arch,
      browserEngine: browser.browserType().name(),
      browserProduct: nativeWebGpuRequired ? "Google Chrome (stable channel)" : "Playwright Chromium",
      browserVersion: browser.version(),
      threeRevision: REVISION,
    },
    requestedRenderer: attributes["data-observer-renderer-request"] ?? "unknown",
    browserWebGpuApi:
      attributes["data-observer-webgpu-api-present"] === "true" ? "present" :
      attributes["data-observer-webgpu-api-present"] === "false" ? "absent" : "unknown",
    adapterAvailability: attributes["data-observer-adapter-availability"] ?? "unknown",
    mountedRendererFamily: attributes["data-observer-renderer-family"] ?? "unknown",
    executionBackend: attributes["data-observer-execution-backend"] ?? "unknown",
    applicationFallback: attributes["data-observer-application-fallback"] ?? "unknown",
    webgpuInitializationAttempts: Number(
      attributes["data-observer-webgpu-initialization-attempts"] ?? "0",
    ),
    initializationFailure:
      attributes["data-observer-renderer-failure-stage"] === "initialization",
    observerReadiness: {
      status: observerReady ? "ready" : "not-ready",
      sceneSubjectId,
      screenshotPixels: canvasPixels,
      interactions,
    },
    groundGlassReadiness: {
      status: groundGlassContentful ? "contentful" : "not-contentful",
      finalTargetContentful: groundGlassContentful,
    },
    hardwareAcceleration: {
      classification:
        attributes["data-observer-hardware-acceleration"] === "confirmed"
          ? "confirmed"
          : "unconfirmed",
      evidence:
        "Renderer identity and adapter availability do not establish whether the browser uses a hardware or software adapter.",
    },
    pageErrors,
  };

  const body = JSON.stringify(report, null, 2);
  await testInfo.attach("observer-runtime-verification.json", {
    body,
    contentType: "application/json",
  });
  console.info(`OBSERVER_RUNTIME_EVIDENCE ${JSON.stringify(report)}`);
  return report;
};

const attachScreenshots = async (
  page: Page,
  testInfo: TestInfo,
  canvas: Locator,
  canvasPath: string,
  pagePath: string,
) => {
  const canvasScreenshot = await canvas.screenshot({ path: canvasPath });
  const canvasPixels = await analyzeCanvasScreenshot(page, canvasScreenshot);
  await testInfo.attach("observer-canvas.png", {
    body: canvasScreenshot,
    contentType: "image/png",
  });
  const fullPageScreenshot = await page.screenshot({ path: pagePath });
  await testInfo.attach("observer-and-ground-glass.png", {
    body: fullPageScreenshot,
    contentType: "image/png",
  });
  return canvasPixels;
};

test("View Camera Anatomy keeps its default mounted Observer on WebGL", async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  const webgpuModuleRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (/three[._/-]webgpu/i.test(request.url())) webgpuModuleRequests.push(request.url());
  });

  await page.goto("/simulator/free/view-camera-anatomy?rttDiagnostics=1");
  const observer = await waitForMountedObserver(page);
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgl");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  await expect(observer).toHaveAttribute("data-observer-adapter-availability", "not-requested");
  await expect(observer).not.toHaveAttribute("data-observer-webgpu-initialization-attempts");
  await expect(observer).not.toHaveAttribute("data-observer-hardware-acceleration");
  await expect(observer).toHaveAttribute("data-observer-shadow-map-status", "active");
  await expect(observer).toHaveAttribute("data-observer-shadow-map-type", "pcf");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping-active", "true");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping", "aces-filmic");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping-exposure", "1.000000");
  await expect(observer).toHaveAttribute("data-observer-output-color-space", "srgb");
  await expect(observer).toHaveAttribute("data-scene-subject-id", "view-camera-anatomy");
  expect(webgpuModuleRequests).toEqual([]);

  const groundGlass = page.getByTestId("ground-glass-rtt");
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", {
    timeout: 60_000,
  });
  const canvas = observer.locator("canvas");
  const canvasPixels = await attachScreenshots(
    page,
    testInfo,
    canvas,
    "test-results/observer-webgl-baseline.png",
    "test-results/observer-webgl-baseline-page.png",
  );
  const interactions = await exerciseObserverControls(page, observer);
  const evidence = await attachMountedObserverEvidence(testInfo, observer);
  await attachRuntimeVerification({
    testInfo,
    browser,
    observer,
    groundGlass,
    canvasPixels,
    interactions,
    pageErrors,
  });

  expect(canvasPixels.contentful).toBe(true);
  expect(interactions).toEqual({
    cameraFocusSelected: true,
    orbitInteractionWorked: true,
    resetRestoredCameraPosition: true,
    resetRestoredOrbitTarget: true,
  });
  expect(evidence["data-observer-adapter-availability"]).toBe("not-requested");
  expect(webgpuModuleRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("development WebGPU pilot keeps View Camera Anatomy interactive beside WebGL Ground Glass", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const webgpuModuleRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (/three[._/-]webgpu/i.test(request.url())) webgpuModuleRequests.push(request.url());
  });

  await page.goto("/simulator/free/view-camera-anatomy?observerRenderer=webgpu&rttDiagnostics=1");
  const observer = await waitForMountedObserver(page);
  await expect.poll(() => webgpuModuleRequests.length).toBeGreaterThan(0);
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute("data-observer-webgpu-api-present", /^(true|false)$/);
  await expect(observer).toHaveAttribute("data-observer-hardware-acceleration", "unconfirmed");
  await expect(observer).toHaveAttribute(
    "data-observer-adapter-availability",
    /^(api-absent|available|unavailable|request-rejected|timed-out)$/,
    { timeout: 10_000 },
  );
  await expect.poll(() =>
    observer.getAttribute("data-observer-webgpu-initialization-attempts"),
  ).toBe("1");

  const initialEvidence = await attachMountedObserverEvidence(testInfo, observer);
  const family = initialEvidence["data-observer-renderer-family"];
  const executionBackend = initialEvidence["data-observer-execution-backend"];
  const applicationFallback = initialEvidence["data-observer-application-fallback"];
  await expect(observer).toHaveAttribute("data-observer-shadow-map-status", "active");
  await expect(observer).toHaveAttribute("data-observer-shadow-map-type", "pcf");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping-active", "true");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping", "aces-filmic");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping-exposure", "1.000000");
  await expect(observer).toHaveAttribute("data-observer-output-color-space", "srgb");

  if (family === "webgpu-renderer") {
    expect(executionBackend).toMatch(/^(webgpu|webgl2-fallback)$/);
    expect(applicationFallback).toBe("none");
  } else {
    expect(family).toBe("webgl-renderer");
    expect(executionBackend).toBe("webgl2");
    expect(applicationFallback).toBe("app-webgl");
    await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", "initialization");
  }

  const groundGlass = page.getByTestId("ground-glass-rtt");
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", {
    timeout: 60_000,
  });
  const canvas = observer.locator("canvas");
  const canvasPixels = await attachScreenshots(
    page,
    testInfo,
    canvas,
    "test-results/observer-webgpu-pilot.png",
    "test-results/observer-webgpu-pilot-page.png",
  );
  const interactions = await exerciseObserverControls(page, observer);
  const runtimeEvidence = await attachRuntimeVerification({
    testInfo,
    browser,
    observer,
    groundGlass,
    canvasPixels,
    interactions,
    pageErrors,
  });

  expect(webgpuModuleRequests).toHaveLength(1);
  expect(await observer.getAttribute("data-observer-webgpu-initialization-attempts")).toBe("1");
  expect(canvasPixels.contentful).toBe(true);
  expect(interactions).toEqual({
    cameraFocusSelected: true,
    orbitInteractionWorked: true,
    resetRestoredCameraPosition: true,
    resetRestoredOrbitTarget: true,
  });
  expect(pageErrors).toEqual([]);

  if (nativeWebGpuRequired) {
    expect(initialEvidence["data-observer-webgpu-api-present"]).toBe("true");
    expect(initialEvidence["data-observer-adapter-availability"]).toBe("available");
    expect(family).toBe("webgpu-renderer");
    expect(executionBackend).toBe("webgpu");
    expect(applicationFallback).toBe("none");
    expect(initialEvidence["data-observer-renderer-failure-stage"]).toBeUndefined();
    expect(runtimeEvidence.webgpuInitializationAttempts).toBe(1);
    expect(runtimeEvidence.observerReadiness.status).toBe("ready");
    expect(runtimeEvidence.groundGlassReadiness.status).toBe("contentful");
    expect(runtimeEvidence.initializationFailure).toBe(false);
  }
});
