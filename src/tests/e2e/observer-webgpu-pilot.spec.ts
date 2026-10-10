import { expect, test } from "@playwright/test";

const waitForMountedObserver = async (page: import("@playwright/test").Page) => {
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
  return observer;
};

const attachMountedObserverEvidence = async (
  testInfo: import("@playwright/test").TestInfo,
  observer: import("@playwright/test").Locator,
) => {
  const evidence = await observer.evaluate((element) =>
    Object.fromEntries(
      Array.from(element.attributes)
        .filter((attribute) => attribute.name.startsWith("data-observer-"))
        .map((attribute) => [attribute.name, attribute.value]),
    ),
  );
  await testInfo.attach("mounted-observer-capabilities.json", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
};

test("View Camera Anatomy keeps its default mounted Observer on WebGL", async ({ page }) => {
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
  await expect(observer).toHaveAttribute("data-observer-shadow-map-status", "active");
  await expect(observer).toHaveAttribute("data-observer-shadow-map-type", "pcf");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping-active", "true");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping", "aces-filmic");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping-exposure", "1.000000");
  await expect(observer).toHaveAttribute("data-observer-output-color-space", "srgb");
  await attachMountedObserverEvidence(test.info(), observer);
  expect(webgpuModuleRequests).toEqual([]);
  await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute(
    "data-rtt-final-contentful",
    "true",
    { timeout: 60_000 },
  );

  const canvas = observer.locator("canvas");
  const bounds = await canvas.boundingBox();
  expect(bounds?.width).toBeGreaterThan(0);
  expect(bounds?.height).toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/observer-webgl-baseline.png" });

  const cameraFocus = page.getByRole("button", { name: "Camera" });
  await cameraFocus.click();
  await expect(observer).toHaveAttribute("data-view-focus", "camera");
  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await expect(observer).toHaveAttribute("data-view-focus", "camera");
  expect(pageErrors).toEqual([]);
});

test("development WebGPU pilot keeps View Camera Anatomy interactive beside WebGL Ground Glass", async ({ page }) => {
  test.setTimeout(150_000);
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
  await expect(observer).toHaveAttribute("data-observer-execution-backend", /^(webgpu|webgl2-fallback|webgl2)$/);

  const family = await observer.getAttribute("data-observer-renderer-family");
  const executionBackend = await observer.getAttribute("data-observer-execution-backend");
  const applicationFallback = await observer.getAttribute("data-observer-application-fallback");
  await expect(observer).toHaveAttribute("data-observer-shadow-map-status", "active");
  await expect(observer).toHaveAttribute("data-observer-shadow-map-type", "pcf");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping-active", "true");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping", "aces-filmic");
  await expect(observer).toHaveAttribute("data-observer-tone-mapping-exposure", "1.000000");
  await expect(observer).toHaveAttribute("data-observer-output-color-space", "srgb");
  await attachMountedObserverEvidence(test.info(), observer);
  if (family === "webgpu-renderer") {
    expect(executionBackend).toMatch(/^(webgpu|webgl2-fallback)$/);
    expect(applicationFallback).toBe("none");
  } else {
    expect(family).toBe("webgl-renderer");
    expect(executionBackend).toBe("webgl2");
    expect(applicationFallback).toBe("app-webgl");
    await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", "initialization");
  }

  const canvas = observer.locator("canvas");
  const bounds = await canvas.boundingBox();
  expect(bounds?.width).toBeGreaterThan(0);
  expect(bounds?.height).toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/observer-webgpu-pilot.png" });

  const cameraFocus = page.getByRole("button", { name: "Camera" });
  await cameraFocus.click();
  await expect(observer).toHaveAttribute("data-view-focus", "camera");
  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await expect(observer).toHaveAttribute("data-view-focus", "camera");

  const groundGlass = page.getByTestId("ground-glass-rtt");
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", {
    timeout: 60_000,
  });
  expect(pageErrors).toEqual([]);
});
