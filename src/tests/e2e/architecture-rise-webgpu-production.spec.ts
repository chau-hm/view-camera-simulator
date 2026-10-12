import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { release } from "node:os";
import { REVISION } from "three";
import { expect, test, type Page } from "@playwright/test";

const attachJson = async (testInfo: import("@playwright/test").TestInfo, name: string, value: unknown) => {
  const body = JSON.stringify(value, null, 2);
  const outputPath = testInfo.outputPath(name);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, body);
  await testInfo.attach(name, { body, contentType: "application/json" });
};

const analyzeScreenshot = async (page: Page, screenshot: Buffer) => page.evaluate(async (base64Png) => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64Png}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not decode the production preview screenshot");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const colors = new Map<string, number>();
  for (let index = 0; index < pixels.length; index += 4) {
    const bucket = `${(pixels[index] ?? 0) >> 4}:${(pixels[index + 1] ?? 0) >> 4}:${(pixels[index + 2] ?? 0) >> 4}`;
    colors.set(bucket, (colors.get(bucket) ?? 0) + 1);
  }
  const dominantColorSamples = Math.max(...colors.values());
  const foregroundPixelSamples = canvas.width * canvas.height - dominantColorSamples;
  return {
    width: canvas.width,
    height: canvas.height,
    distinctColorBuckets: colors.size,
    foregroundPixelSamples,
    contentful: colors.size >= 12 && foregroundPixelSamples >= 20,
  };
}, screenshot.toString("base64"));

test("production preview keeps Architecture Rise on WebGL for default and explicit WebGPU requests", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const webgpuModuleRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    if (/three[/._-]webgpu|\/webgpu\//i.test(request.url())) {
      webgpuModuleRequests.push(request.url());
    }
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");

  const observer = page.getByTestId("scene-canvas");
  const groundGlass = page.getByTestId("ground-glass-rtt").first();
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgl");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "default-webgl-request");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-scene-subject-id", "architecture-rise");
  const defaultObserverScreenshot = await observer.locator("canvas").screenshot();
  const defaultGroundGlassScreenshot = await groundGlass.screenshot();
  const defaultObserverPixels = await analyzeScreenshot(page, defaultObserverScreenshot);
  const defaultGroundGlassPixels = await analyzeScreenshot(page, defaultGroundGlassScreenshot);
  expect(defaultObserverPixels.contentful).toBe(true);
  expect(defaultGroundGlassPixels.contentful).toBe(true);
  expect(webgpuModuleRequests).toEqual([]);

  await page.evaluate((nextPath) => {
    window.history.pushState(window.history.state, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }, "/simulator/free/architecture-rise?observerRenderer=webgpu&rttDiagnostics=1");

  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "development-gate-disabled");
  await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "verified");
  await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "eligible");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "0");
  await expect(observer).not.toHaveAttribute("data-observer-renderer-failure-stage");
  const requestedObserverScreenshot = await observer.locator("canvas").screenshot();
  const requestedGroundGlassScreenshot = await groundGlass.screenshot();
  const requestedObserverPixels = await analyzeScreenshot(page, requestedObserverScreenshot);
  const requestedGroundGlassPixels = await analyzeScreenshot(page, requestedGroundGlassScreenshot);
  expect(requestedObserverPixels.contentful).toBe(true);
  expect(requestedGroundGlassPixels.contentful).toBe(true);
  expect(webgpuModuleRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);

  const evidence = await observer.evaluate((element) => ({
    requestedRenderer: element.getAttribute("data-observer-renderer-request"),
    selectionReason: element.getAttribute("data-observer-selection-reason"),
    rendererAttempt: element.getAttribute("data-observer-renderer-attempt"),
    rendererFamily: element.getAttribute("data-observer-renderer-family"),
    executionBackend: element.getAttribute("data-observer-execution-backend"),
    applicationFallback: element.getAttribute("data-observer-application-fallback"),
    initializationAttempts: element.getAttribute("data-observer-webgpu-initialization-attempts"),
    sceneCompatibility: element.getAttribute("data-observer-webgpu-scene-compatibility"),
    pilotEligibility: element.getAttribute("data-observer-webgpu-pilot-eligibility"),
    sceneSubjectId: element.getAttribute("data-scene-subject-id"),
    rendererGenerationAttributeAvailable: element.getAttribute("data-observer-renderer-generation") !== null,
    hasDevelopmentFixtureAttribute: element.hasAttribute("data-observer-verification-scene"),
    hasTestProbeAttribute: Array.from(element.attributes).some((attribute) =>
      attribute.name.startsWith("data-observer-test-"),
    ),
  }));
  expect(evidence.hasDevelopmentFixtureAttribute).toBe(false);
  expect(evidence.hasTestProbeAttribute).toBe(false);
  expect(evidence.rendererGenerationAttributeAvailable).toBe(false);
  const finalUrl = page.url();
  for (const [name, body] of [
    ["architecture-rise-production-observer-default.png", defaultObserverScreenshot],
    ["architecture-rise-production-ground-glass-default.png", defaultGroundGlassScreenshot],
    ["architecture-rise-production-observer-webgpu-request.png", requestedObserverScreenshot],
    ["architecture-rise-production-ground-glass-webgpu-request.png", requestedGroundGlassScreenshot],
  ] as const) {
    await testInfo.attach(name, { body, contentType: "image/png" });
  }
  await attachJson(testInfo, "architecture-rise-production-webgl-isolation.json", {
    build: "Vite production preview",
    browserVersion: page.context().browser()?.version() ?? "unknown",
    operatingSystem: `${process.platform} ${release()}`,
    threeRevision: REVISION,
    route: new URL(finalUrl).pathname + new URL(finalUrl).search,
    evidence,
    groundGlassDiagnostics: "rttDiagnostics attributes are development-only; production captures are pixel-analyzed",
    defaultObserverPixels,
    defaultGroundGlassPixels,
    requestedObserverPixels,
    requestedGroundGlassPixels,
    webgpuModuleRequests,
    pageErrors,
    consoleErrors,
  });
});
