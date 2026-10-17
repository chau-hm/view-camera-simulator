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

  await page.evaluate((nextPath) => {
    window.history.pushState(window.history.state, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }, "/simulator/free/architecture-rise?observerRenderer=webgpu&observerOutput=material-aware&rttDiagnostics=1");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "development-gate-disabled");
  await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "0");
  const candidateObserverScreenshot = await observer.locator("canvas").screenshot();
  const candidateGroundGlassScreenshot = await groundGlass.screenshot();
  const candidateObserverPixels = await analyzeScreenshot(page, candidateObserverScreenshot);
  const candidateGroundGlassPixels = await analyzeScreenshot(page, candidateGroundGlassScreenshot);
  expect(candidateObserverPixels.contentful).toBe(true);
  expect(candidateGroundGlassPixels.contentful).toBe(true);
  expect(await observer.getAttribute("data-observer-output-policy-selected")).toBeNull();
  expect(await observer.getAttribute("data-observer-material-inventory")).toBeNull();

  await page.evaluate((nextPath) => {
    window.history.pushState(window.history.state, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }, "/simulator/free/architecture-rise?observerRenderer=webgpu&observerOutput=standard&rttDiagnostics=1");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "development-gate-disabled");
  await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "0");
  const standardObserverScreenshot = await observer.locator("canvas").screenshot();
  const standardGroundGlassScreenshot = await groundGlass.screenshot();
  const standardObserverPixels = await analyzeScreenshot(page, standardObserverScreenshot);
  const standardGroundGlassPixels = await analyzeScreenshot(page, standardGroundGlassScreenshot);
  expect(standardObserverPixels.contentful).toBe(true);
  expect(standardGroundGlassPixels.contentful).toBe(true);
  expect(await observer.getAttribute("data-observer-output-policy-selected")).toBeNull();
  expect(await observer.getAttribute("data-observer-material-inventory")).toBeNull();
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
    ["architecture-rise-production-observer-material-aware-request.png", candidateObserverScreenshot],
    ["architecture-rise-production-ground-glass-material-aware-request.png", candidateGroundGlassScreenshot],
    ["architecture-rise-production-observer-standard-output-request.png", standardObserverScreenshot],
    ["architecture-rise-production-ground-glass-standard-output-request.png", standardGroundGlassScreenshot],
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
    candidateObserverPixels,
    candidateGroundGlassPixels,
    standardObserverPixels,
    standardGroundGlassPixels,
    webgpuModuleRequests,
    pageErrors,
    consoleErrors,
  });
});

test("production preview denies the Anatomy material-aware WebGPU candidate", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const webgpuModuleRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    if (/three[/._-]webgpu|\/webgpu\//i.test(request.url())) webgpuModuleRequests.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/view-camera-anatomy?observerRenderer=webgpu&observerOutput=material-aware&rttDiagnostics=1");
  const observer = page.getByTestId("scene-canvas");
  const groundGlass = page.getByTestId("ground-glass-rtt").first();
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "development-gate-disabled");
  await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "0");
  await expect(observer).toHaveAttribute("data-scene-subject-id", "view-camera-anatomy");
  await expect(observer).not.toHaveAttribute("data-observer-anatomy-output-intervention-hook");
  const observerScreenshot = await observer.locator("canvas").screenshot();
  const groundGlassScreenshot = await groundGlass.screenshot();
  const observerPixels = await analyzeScreenshot(page, observerScreenshot);
  const groundGlassPixels = await analyzeScreenshot(page, groundGlassScreenshot);
  expect(observerPixels.contentful).toBe(true);
  expect(groundGlassPixels.contentful).toBe(true);
  expect(webgpuModuleRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);

  const loadedJavaScript = await page.evaluate(async () => {
    const urls = new Set<string>(Array.from(document.scripts)
      .map((script) => script.src)
      .filter(Boolean));
    performance.getEntriesByType("resource").forEach((entry) => {
      if (/\.m?js(?:$|\?)/i.test(entry.name)) urls.add(entry.name);
    });
    const assets = await Promise.all([...urls].map(async (url) => {
      try {
        const response = await fetch(url, { credentials: "same-origin" });
        return { url, body: response.ok ? await response.text() : "" };
      } catch {
        return { url, body: "" };
      }
    }));
    const forbiddenIdentifiers = [
      "AnatomyGpuBlendIntermediateProbe",
      "anatomy-gpu-blend-intermediate",
      "GPU_BLEND_INTERMEDIATE",
    ];
    const bundleIdentifierMatches = forbiddenIdentifiers.filter((identifier) =>
      assets.some(({ body }) => body.includes(identifier)),
    );
    return {
      urls: assets.map(({ url }) => url),
      interventionEventPresent: assets.some(({ body }) =>
        body.includes("vcs:observer-verification:anatomy-output-intervention")),
      bundleIdentifierMatches,
    };
  });
  expect(loadedJavaScript.interventionEventPresent,
    "Production JavaScript assets loaded by the Anatomy route must not contain the test-only intervention event").toBe(false);
  expect(loadedJavaScript.bundleIdentifierMatches,
    "Production JavaScript assets loaded by the Anatomy route must not contain the development-only GPU capture probe or events").toEqual([]);

  const evidence = await observer.evaluate((element) => ({
    rendererRequest: element.getAttribute("data-observer-renderer-request"),
    selectionReason: element.getAttribute("data-observer-selection-reason"),
    rendererAttempt: element.getAttribute("data-observer-renderer-attempt"),
    rendererFamily: element.getAttribute("data-observer-renderer-family"),
    executionBackend: element.getAttribute("data-observer-execution-backend"),
    applicationFallback: element.getAttribute("data-observer-application-fallback"),
    initializationAttempts: element.getAttribute("data-observer-webgpu-initialization-attempts"),
    candidatePolicyAttributesPresent: [
      "data-observer-output-policy-selected",
      "data-observer-output-policy-installed",
      "data-observer-output-policy-status",
    ].some((name) => element.hasAttribute(name)),
    developmentVerificationHookPresent: element.hasAttribute("data-observer-verification-scene") ||
      Array.from(element.attributes).some((attribute) => attribute.name.startsWith("data-observer-test-")),
    anatomyOutputInterventionHookPresent: element.hasAttribute("data-observer-anatomy-output-intervention-hook"),
    anatomyGpuBlendProbeAttributePresent: element.hasAttribute("data-observer-anatomy-gpu-blend-probe"),
  }));
  expect(evidence.candidatePolicyAttributesPresent).toBe(false);
  expect(evidence.developmentVerificationHookPresent).toBe(false);
  expect(evidence.anatomyOutputInterventionHookPresent).toBe(false);
  expect(evidence.anatomyGpuBlendProbeAttributePresent).toBe(false);
  await testInfo.attach("view-camera-anatomy-production-webgl-denial.json", {
    body: JSON.stringify({
      browserVersion: page.context().browser()?.version() ?? "unknown",
      threeRevision: REVISION,
      route: new URL(page.url()).pathname + new URL(page.url()).search,
      evidence,
      loadedJavaScript,
      observerPixels,
      groundGlassPixels,
      webgpuModuleRequests,
      pageErrors,
      consoleErrors,
    }, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("view-camera-anatomy-production-observer.png", {
    body: observerScreenshot,
    contentType: "image/png",
  });
});
