import { expect, test } from "@playwright/test";

type PixelComparison = Readonly<{
  width: number;
  height: number;
  subjectRoiMeanAbsoluteRgbDelta: number;
  subjectRoiChangedPixelFraction: number;
  subjectRoiVisibleAgainstBackground: number;
  backgroundCornerMeanAbsoluteRgbDelta: number;
}>;

const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";

const compareCapturedCanvases = async (
  page: import("@playwright/test").Page,
  firstPng: Buffer,
  secondPng: Buffer,
): Promise<PixelComparison> => page.evaluate(async ({ first, second }) => {
  const decode = async (base64: string): Promise<ImageData> => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create screenshot measurement context");
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  };

  const [a, b] = await Promise.all([decode(first), decode(second)]);
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error("Environment comparison captures do not share dimensions");
  }
  const width = a.width;
  const height = a.height;
  const subject = {
    left: Math.floor(width * 0.4),
    right: Math.ceil(width * 0.6),
    top: Math.floor(height * 0.35),
    bottom: Math.ceil(height * 0.65),
  };
  const regions = {
    topLeft: { left: 0, right: width * 0.12, top: 0, bottom: height * 0.12 },
    topRight: { left: width * 0.88, right: width, top: 0, bottom: height * 0.12 },
    bottomLeft: { left: 0, right: width * 0.12, top: height * 0.88, bottom: height },
    bottomRight: { left: width * 0.88, right: width, top: height * 0.88, bottom: height },
  };
  const summarize = (
    left: ImageData,
    right: ImageData,
    region: { left: number; right: number; top: number; bottom: number },
  ) => {
    let total = 0;
    let changed = 0;
    let pixels = 0;
    for (let y = Math.floor(region.top); y < Math.ceil(region.bottom); y += 1) {
      for (let x = Math.floor(region.left); x < Math.ceil(region.right); x += 1) {
        const index = (y * width + x) * 4;
        const delta = Math.max(
          Math.abs(left.data[index] - right.data[index]),
          Math.abs(left.data[index + 1] - right.data[index + 1]),
          Math.abs(left.data[index + 2] - right.data[index + 2]),
        );
        total += (
          Math.abs(left.data[index] - right.data[index]) +
          Math.abs(left.data[index + 1] - right.data[index + 1]) +
          Math.abs(left.data[index + 2] - right.data[index + 2])
        ) / 3;
        if (delta > 8) changed += 1;
        pixels += 1;
      }
    }
    return { mean: pixels ? total / pixels : 0, changedFraction: pixels ? changed / pixels : 0 };
  };

  const subjectChange = summarize(a, b, subject);
  const cornerChanges = Object.values(regions).map((region) => summarize(a, b, region).mean);
  const cornerMean = (data: ImageData) => {
    let total = 0;
    let count = 0;
    for (const region of Object.values(regions)) {
      for (let y = Math.floor(region.top); y < Math.ceil(region.bottom); y += 1) {
        for (let x = Math.floor(region.left); x < Math.ceil(region.right); x += 1) {
          const index = (y * width + x) * 4;
          total += (data.data[index] + data.data[index + 1] + data.data[index + 2]) / 3;
          count += 1;
        }
      }
    }
    return count ? total / count : 0;
  };
  const regionMean = (data: ImageData, region: typeof subject) => {
    let total = 0;
    let count = 0;
    for (let y = region.top; y < region.bottom; y += 1) {
      for (let x = region.left; x < region.right; x += 1) {
        const index = (y * width + x) * 4;
        total += (data.data[index] + data.data[index + 1] + data.data[index + 2]) / 3;
        count += 1;
      }
    }
    return count ? total / count : 0;
  };
  const enabledContrast = Math.abs(regionMean(a, subject) - cornerMean(a));
  const disabledContrast = Math.abs(regionMean(b, subject) - cornerMean(b));

  return {
    width,
    height,
    subjectRoiMeanAbsoluteRgbDelta: subjectChange.mean,
    subjectRoiChangedPixelFraction: subjectChange.changedFraction,
    subjectRoiVisibleAgainstBackground: Math.min(enabledContrast, disabledContrast),
    backgroundCornerMeanAbsoluteRgbDelta: Math.max(...cornerChanges),
  };
}, {
  first: firstPng.toString("base64"),
  second: secondPng.toString("base64"),
});

const captureFixtureImage = async (
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo,
  name: string,
): Promise<Buffer> => {
  const image = await page.locator("#observer canvas").screenshot();
  await testInfo.attach(name, { body: image, contentType: "image/png" });
  return image;
};

test("Architecture Rise keeps its normal WebGL environment and Ground Glass path", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");

  const observer = page.getByTestId("scene-canvas");
  await expect(observer).toBeVisible({ timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "verified");
  await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "eligible");
  await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  expect(pageErrors).toEqual([]);

  const image = await observer.screenshot();
  await testInfo.attach("architecture-rise-webgl-observer.png", {
    body: image,
    contentType: "image/png",
  });
});

for (const renderer of ["webgl", "webgpu"] as const) {
  test(`${renderer} Observer PMREM changes only the reflective subject region`, async ({ page, browser }, testInfo) => {
    test.setTimeout(90_000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`/src/tests/e2e/fixtures/observer-world-environment.html?renderer=${renderer}`);

    const body = page.locator("body");
    await expect(body).toHaveAttribute("data-fixture-ready", "true", { timeout: 60_000 });
    await expect(body).toHaveAttribute("data-environment-status", "active", { timeout: 60_000 });
    await expect(body).toHaveAttribute("data-scene-environment-assigned", "true");
    await expect(body).toHaveAttribute("data-scene-environment-target-texture", "true");
    await expect(body).toHaveAttribute("data-visible-background", "#f8fafc");

    const runtime = {
      ...(await body.evaluate((element) => ({
      browser: navigator.userAgent,
      rendererFamily: element.getAttribute("data-renderer-family"),
      executionBackend: element.getAttribute("data-execution-backend"),
      initialization: element.getAttribute("data-renderer-initialization"),
      environmentStatus: element.getAttribute("data-environment-status"),
      environmentTextureId: element.getAttribute("data-scene-environment-texture-id"),
      browserWebGpuApiPresent: element.getAttribute("data-browser-web-gpu-api-present"),
      background: element.getAttribute("data-visible-background"),
      shadowMapStatus: element.getAttribute("data-shadow-map-status"),
      shadowMapType: element.getAttribute("data-shadow-map-type"),
      toneMapping: element.getAttribute("data-tone-mapping"),
      toneMappingExposure: element.getAttribute("data-tone-mapping-exposure"),
      outputColorSpace: element.getAttribute("data-output-color-space"),
      hardwareAcceleration: element.getAttribute("data-hardware-acceleration"),
      }))),
      browserProject: testInfo.project.name,
      browserVersion: browser.version(),
      hostPlatform: process.platform,
      hostArchitecture: process.arch,
    };
    expect(runtime.rendererFamily).toBe(renderer === "webgpu" ? "webgpu-renderer" : "webgl-renderer");
    expect(typeof runtime.executionBackend).toBe("string");
    expect(["true", "false"]).toContain(runtime.browserWebGpuApiPresent);
    if (renderer === "webgpu") {
      expect(["webgpu", "webgl2-fallback"]).toContain(runtime.executionBackend);
      expect(runtime.initialization).toBe("active");
      if (nativeWebGpuRequired) {
        expect(runtime.browserWebGpuApiPresent).toBe("true");
        expect(runtime.executionBackend).toBe("webgpu");
      }
    }

    const enabledImage = await captureFixtureImage(page, testInfo, `${renderer}-environment-enabled.png`);
    const firstEnvironmentId = runtime.environmentTextureId;

    const framesBeforeDisable = Number(await body.getAttribute("data-render-frames"));
    await page.getByRole("button", { name: "Disable environment" }).click();
    await expect(body).toHaveAttribute("data-environment-status", "not-configured");
    await expect(body).toHaveAttribute("data-scene-environment-assigned", "false");
    await expect.poll(async () => Number(await body.getAttribute("data-render-frames")))
      .toBeGreaterThan(framesBeforeDisable);
    const disabledImage = await captureFixtureImage(page, testInfo, `${renderer}-environment-disabled.png`);

    const comparison = await compareCapturedCanvases(page, enabledImage, disabledImage);
    expect(comparison.subjectRoiMeanAbsoluteRgbDelta).toBeGreaterThan(8);
    expect(comparison.subjectRoiChangedPixelFraction).toBeGreaterThan(0.5);
    expect(comparison.subjectRoiVisibleAgainstBackground).toBeGreaterThan(8);
    expect(comparison.backgroundCornerMeanAbsoluteRgbDelta).toBeLessThan(2);

    const framesBeforeEnable = Number(await body.getAttribute("data-render-frames"));
    await page.getByRole("button", { name: "Enable environment" }).click();
    await expect(body).toHaveAttribute("data-environment-status", "active", { timeout: 60_000 });
    await expect(body).toHaveAttribute("data-scene-environment-assigned", "true");
    await expect.poll(async () => Number(await body.getAttribute("data-render-frames")))
      .toBeGreaterThan(framesBeforeEnable);
    const restoredEnvironmentId = await body.getAttribute("data-scene-environment-texture-id");
    expect(restoredEnvironmentId).not.toBe(firstEnvironmentId);
    const restoredImage = await captureFixtureImage(page, testInfo, `${renderer}-environment-remounted.png`);

    await page.getByRole("button", { name: "Disable environment" }).click();
    await expect(body).toHaveAttribute("data-scene-environment-assigned", "false");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    const evidence = {
      rendererRequested: renderer,
      runtime,
      nativeRequired: nativeWebGpuRequired,
      environmentDisabledNegativeControl: comparison,
      environmentTextureReplacedOnRemount: restoredEnvironmentId !== firstEnvironmentId,
      environmentRemovedAfterFinalUnmount: await body.getAttribute("data-scene-environment-assigned"),
      noPageErrors: pageErrors.length === 0,
      noConsoleErrors: consoleErrors.length === 0,
    };
    console.info(`Observer environment evidence ${renderer}: ${JSON.stringify(evidence)}`);
    await testInfo.attach(`${renderer}-observer-environment-evidence.json`, {
      body: Buffer.from(JSON.stringify({ ...evidence, screenshots: ["enabled", "disabled", "remounted"] }, null, 2)),
      contentType: "application/json",
    });
    expect(restoredImage.byteLength).toBeGreaterThan(0);
  });
}
