import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { release } from "node:os";
import { REVISION } from "three";
import { expect, test, type Page } from "@playwright/test";
import { writeGroundGlassM7fCapture } from "./helpers/groundGlassM7fEvidence";
import { writeGroundGlassM7gCapture } from "./helpers/groundGlassM7gEvidence";

const attachJson = async (testInfo: import("@playwright/test").TestInfo, name: string, value: unknown) => {
  const body = JSON.stringify(value, null, 2);
  const outputPath = testInfo.outputPath(name);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, body);
  const captureDirectory = process.env.GROUND_GLASS_M7C_CAPTURE_DIR;
  if (captureDirectory) {
    await mkdir(captureDirectory, { recursive: true });
    await writeFile(join(captureDirectory, name), body);
  }
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
  const samplingStride = Math.max(1, Math.ceil(Math.sqrt((canvas.width * canvas.height) / 100_000)));
  const colorCounts = new Uint32Array(4096);
  let sampleCount = 0;
  for (let y = 0; y < canvas.height; y += samplingStride) {
    for (let x = 0; x < canvas.width; x += samplingStride) {
      const index = (y * canvas.width + x) * 4;
      const bucket = (((pixels[index] ?? 0) >> 4) << 8) |
        (((pixels[index + 1] ?? 0) >> 4) << 4) |
        ((pixels[index + 2] ?? 0) >> 4);
      colorCounts[bucket] = (colorCounts[bucket] ?? 0) + 1;
      sampleCount += 1;
    }
  }
  let distinctColorBuckets = 0;
  let dominantColorSamples = 0;
  for (const count of colorCounts) {
    if (count === 0) continue;
    distinctColorBuckets += 1;
    dominantColorSamples = Math.max(dominantColorSamples, count);
  }
  const foregroundPixelEstimate = Math.min(
    canvas.width * canvas.height,
    (sampleCount - dominantColorSamples) * samplingStride ** 2,
  );
  return {
    width: canvas.width,
    height: canvas.height,
    samplingStride,
    distinctColorBuckets,
    foregroundPixelEstimate,
    contentful: distinctColorBuckets >= 12 && foregroundPixelEstimate >= 20,
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
    if (/GroundGlassWebGPUAdapter|three[/._-]webgpu|\/webgpu\//i.test(request.url())) {
      webgpuModuleRequests.push(request.url());
    }
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  // URL-shaped backend and raw-debug values are not trusted activation inputs.
  await page.goto("/simulator/free/architecture-rise?groundGlassBackend=webgpu&rawDebug=true&rttDiagnostics=1");

  const observer = page.getByTestId("scene-canvas");
  const groundGlass = page.getByTestId("ground-glass-rtt").first();
  await expect(page.getByLabel("Raw RTT — bypass DOF")).not.toBeChecked();
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgl");
  await expect(observer).toHaveAttribute("data-observer-selection-reason", "default-webgl-request");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-scene-subject-id", "architecture-rise");
  await expect(groundGlass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 60_000 });
  await expect(groundGlass).toHaveAttribute("data-policy-selected-backend", "webgl");
  await expect(groundGlass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(groundGlass).toHaveAttribute("data-actual-execution-api", "webgl2");
  await expect(page.getByTestId("ground-glass-webgpu-pilot")).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.__groundGlassWebGpuM3TestControl)).toBe("undefined");
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
  const groundGlassEvidence = await groundGlass.evaluate((element) => ({
    policySelectedBackend: element.getAttribute("data-policy-selected-backend"),
    rendererFamily: element.getAttribute("data-mounted-renderer-family"),
    actualExecutionApi: element.getAttribute("data-actual-execution-api"),
    lifecycle: element.getAttribute("data-render-host-lifecycle"),
    pilotCount: document.querySelectorAll('[data-testid="ground-glass-webgpu-pilot"]').length,
    testSeamGlobal: typeof window.__groundGlassWebGpuM3TestControl !== "undefined",
  }));
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
  const productionIsolationEvidence = {
    build: "Vite production preview",
    captureSourceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    testId: testInfo.titlePath.join(" › "),
    testProject: testInfo.project.name,
    invocation: process.env.GROUND_GLASS_M7C_TEST_INVOCATION ??
      "npm run test:e2e -- --project=chromium src/tests/e2e/architecture-rise-webgpu-production.spec.ts",
    processArguments: process.argv,
    browserVersion: page.context().browser()?.version() ?? "unknown",
    operatingSystem: `${process.platform} ${release()}`,
    productionWebGpuEnabled: false,
    threeRevision: REVISION,
    route: new URL(finalUrl).pathname + new URL(finalUrl).search,
    evidence,
    groundGlassEvidence,
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
  };
  writeGroundGlassM7gCapture("validation/production-isolation.json", {
    status: "passed",
    sourceCommitSha: productionIsolationEvidence.captureSourceSha,
    command: process.env.GROUND_GLASS_M7G_PRODUCTION_TEST_INVOCATION ??
      "npm run test:e2e -- --config=playwright.production.config.ts --project=chromium-production-preview src/tests/e2e/architecture-rise-webgpu-production.spec.ts",
    browserProject: testInfo.project.name,
    browserVersion: productionIsolationEvidence.browserVersion,
    operatingSystem: productionIsolationEvidence.operatingSystem,
    threeRevision: REVISION,
    productionWebGpuEnabled: false,
    testSeamExposed: groundGlassEvidence.testSeamGlobal || groundGlassEvidence.pilotCount !== 0 ||
      evidence.hasTestProbeAttribute,
    webGpuAttemptCount: Number(evidence.initializationAttempts),
    policySelectedBackend: groundGlassEvidence.policySelectedBackend,
    rendererFamily: groundGlassEvidence.rendererFamily,
    actualExecutionApi: groundGlassEvidence.actualExecutionApi,
    webGpuModuleRequests: webgpuModuleRequests,
  });
  await attachJson(testInfo, "architecture-rise-production-webgl-isolation.json", productionIsolationEvidence);
  writeGroundGlassM7fCapture("production-isolation.json", {
    schemaVersion: 1,
    captureSourceSha: productionIsolationEvidence.captureSourceSha,
    sourceProvenance: {
      sourceCommitSha: productionIsolationEvidence.captureSourceSha,
      testInvocation: process.env.GROUND_GLASS_M7F_PRODUCTION_TEST_INVOCATION ??
        process.env.GROUND_GLASS_M7F_TEST_INVOCATION ?? productionIsolationEvidence.invocation,
      browserProject: "production-preview",
      threePackageVersion: "0.187.0",
      rendererRevision: "r187",
      nodeVersion: process.version,
      operatingSystem: productionIsolationEvidence.operatingSystem,
    },
    testInvocation: process.env.GROUND_GLASS_M7F_PRODUCTION_TEST_INVOCATION ??
      process.env.GROUND_GLASS_M7F_TEST_INVOCATION ?? productionIsolationEvidence.invocation,
    testProject: testInfo.project.name,
    build: productionIsolationEvidence.build,
    threeRevision: REVISION,
    browserVersion: productionIsolationEvidence.browserVersion,
    operatingSystem: productionIsolationEvidence.operatingSystem,
    productionWebGpuEnabled: false,
    webglOnlyDecision: evidence.rendererAttempt === "webgl" && evidence.executionBackend === "webgl2",
    evidence,
    groundGlassEvidence,
    webgpuModuleRequests,
    productionIsolationEvidence,
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
    if (/GroundGlassWebGPUAdapter|three[/._-]webgpu|\/webgpu\//i.test(request.url())) webgpuModuleRequests.push(request.url());
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
      "AnatomyBellowsCompositingIntervention",
      "AnatomyBellowsDrawMetadataCapture",
      "anatomy-bellows-compositing-intervention",
      "bellows-draw-metadata",
      "anatomyBellowsNativePipelineEvidence",
      "__vcsMInv8NativePipelineObserver",
      "three-r186-m-inv8-pipeline-v1",
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
