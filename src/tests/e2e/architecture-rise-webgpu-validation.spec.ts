import { release } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PerspectiveCamera, REVISION, Vector3 } from "three";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const FIXTURE_PATH = "/src/tests/e2e/fixtures/architecture-rise-webgpu-validation.html";
const SUBJECT_EVENT = "vcs:observer-verification:architecture-rise-subject";
const ENVIRONMENT_EVENT = "vcs:observer-verification:architecture-rise-environment";
const LIGHT_EVENT = "vcs:observer-verification:architecture-rise-light";
const VIEW_EVENT = "vcs:observer-verification:architecture-rise-view";

type PixelRegion = Readonly<{ left: number; top: number; right: number; bottom: number }>;
type WorldBounds = Readonly<{ min: readonly [number, number, number]; max: readonly [number, number, number] }>;
type ObserverView = Readonly<{ position: string | null; target: string | null }>;
type FeatureInventory = Readonly<{
  objectName: string;
  meshCount: number;
  bounds: WorldBounds;
  materials: Array<Readonly<{
    type: string;
    color: string | null;
    roughness: number | null;
    metalness: number | null;
    map: { colorSpace: string; width: number | null; height: number | null; repeat: number[] } | null;
    normalMap: { colorSpace: string; width: number | null; height: number | null; repeat: number[] } | null;
    roughnessMap: { colorSpace: string; width: number | null; height: number | null; repeat: number[] } | null;
  }>>;
}>;
type SceneInventory = Readonly<{
  rootName: string;
  meshCount: number;
  subjectBounds: WorldBounds;
  materialTypes: string[];
  mappedMaterialCount: number;
  normalMappedMaterialCount: number;
  expectedMeshes: Record<string, boolean>;
  features: Record<string, FeatureInventory | null>;
  environmentTextureAssigned: boolean;
  daylightLightPresent: boolean;
  daylightCastsShadow: boolean | null;
  presentationKeyPresent: boolean;
  presentationKeyCastsShadow: boolean | null;
}>;

const waitForFrames = async (page: Page, count = 3) => {
  await page.evaluate((frames) => new Promise<void>((resolve) => {
    const next = (remaining: number) => {
      if (remaining <= 0) return resolve();
      requestAnimationFrame(() => next(remaining - 1));
    };
    next(frames);
  }), count);
};

const readView = async (observer: Locator): Promise<ObserverView> => ({
  position: await observer.getAttribute("data-observer-camera-position"),
  target: await observer.getAttribute("data-orbit-target"),
});

const vectorsMatch = (first: string | null, second: string | null): boolean => {
  if (!first || !second) return false;
  const a = first.split(",").map(Number);
  const b = second.split(",").map(Number);
  return a.length === 3 && b.length === 3 && a.every((value, index) =>
    Number.isFinite(value) && Math.abs(value - (b[index] ?? Number.NaN)) < 1e-5,
  );
};

const applyVerificationView = async (
  page: Page,
  observer: Locator,
  position: readonly [number, number, number],
  target: readonly [number, number, number],
) => {
  await observer.evaluate((element, payload) => {
    element.dispatchEvent(new CustomEvent(payload.eventName, { detail: payload.detail }));
  }, { eventName: VIEW_EVENT, detail: { position: [...position], target: [...target] } });
  await expect.poll(async () => {
    const current = await readView(observer);
    return vectorsMatch(current.position, position.join(",")) && vectorsMatch(current.target, target.join(","));
  }).toBe(true);
  await waitForFrames(page);
};

const captureCanvas = async (observer: Locator, testInfo: TestInfo, name: string): Promise<Buffer> => {
  const image = await observer.locator("canvas").screenshot({ animations: "disabled" });
  const outputPath = testInfo.outputPath(`${name}.png`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, image);
  await testInfo.attach(name, { body: image, contentType: "image/png" });
  return image;
};

const attachJson = async (testInfo: TestInfo, name: string, value: unknown) => {
  const body = JSON.stringify(value, null, 2);
  const outputPath = testInfo.outputPath(name);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, body);
  await testInfo.attach(name, {
    body,
    contentType: "application/json",
  });
};

const parseInventory = async (observer: Locator): Promise<SceneInventory> => {
  const serialized = await observer.getAttribute("data-observer-test-architecture-rise-inventory");
  if (!serialized) throw new Error("The mounted Architecture Rise scene inventory was not reported");
  return JSON.parse(serialized) as SceneInventory;
};

const projectBounds = (
  bounds: WorldBounds,
  imageWidth: number,
  imageHeight: number,
  view: ObserverView,
): PixelRegion | null => {
  if (!view.position || !view.target) return null;
  const position = view.position.split(",").map(Number);
  const target = view.target.split(",").map(Number);
  if (position.length !== 3 || target.length !== 3 || !position.every(Number.isFinite) || !target.every(Number.isFinite)) {
    return null;
  }
  const camera = new PerspectiveCamera(45, imageWidth / imageHeight, 0.01, 200);
  camera.position.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
  camera.up.set(0, 1, 0);
  camera.lookAt(target[0] ?? 0, target[1] ?? 0, target[2] ?? 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const corners: Vector3[] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const point = new Vector3(x, y, z).project(camera);
        if (point.z < -1 || point.z > 1) continue;
        corners.push(point);
      }
    }
  }
  if (corners.length < 2) return null;
  const pad = 4;
  const left = Math.max(0, Math.floor(Math.min(...corners.map((point) => (point.x + 1) * imageWidth / 2)) - pad));
  const right = Math.min(imageWidth, Math.ceil(Math.max(...corners.map((point) => (point.x + 1) * imageWidth / 2)) + pad));
  const top = Math.max(0, Math.floor(Math.min(...corners.map((point) => (1 - point.y) * imageHeight / 2)) - pad));
  const bottom = Math.min(imageHeight, Math.ceil(Math.max(...corners.map((point) => (1 - point.y) * imageHeight / 2)) + pad));
  return right > left && bottom > top ? { left, top, right, bottom } : null;
};

type RegionPixels = Readonly<{
  region: PixelRegion;
  pixels: number;
  meanRgb: readonly [number, number, number];
  meanLuminance: number;
  luminanceStdDev: number;
  comparisonMeanRgb: readonly [number, number, number] | null;
  comparisonMeanLuminance: number | null;
  changedPixels: number;
  changedFraction: number;
  meanAbsoluteRgbDelta: number;
  redLikePixels: number;
}>;

const analyzeImageRegions = async (
  page: Page,
  first: Buffer,
  second: Buffer | null,
  regions: Record<string, PixelRegion>,
): Promise<{ width: number; height: number; regions: Record<string, RegionPixels> }> =>
  page.evaluate(async ({ firstBase64, secondBase64, regions: namedRegions }) => {
    const decode = async (base64: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to decode Observer screenshot pixels");
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const firstImage = await decode(firstBase64);
    const secondImage = secondBase64 ? await decode(secondBase64) : null;
    if (secondImage && (firstImage.width !== secondImage.width || firstImage.height !== secondImage.height)) {
      throw new Error("Observer comparison screenshots have different dimensions");
    }
    const results: Record<string, RegionPixels> = {};
    for (const [name, region] of Object.entries(namedRegions)) {
      const left = Math.max(0, Math.floor(region.left));
      const top = Math.max(0, Math.floor(region.top));
      const right = Math.min(firstImage.width, Math.ceil(region.right));
      const bottom = Math.min(firstImage.height, Math.ceil(region.bottom));
      let count = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      let luminance = 0;
      let luminanceSquare = 0;
      let comparisonRed = 0;
      let comparisonGreen = 0;
      let comparisonBlue = 0;
      let comparisonLuminance = 0;
      let changedPixels = 0;
      let redLikePixels = 0;
      let deltaTotal = 0;
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const index = (y * firstImage.width + x) * 4;
          const r = firstImage.data[index] ?? 0;
          const g = firstImage.data[index + 1] ?? 0;
          const b = firstImage.data[index + 2] ?? 0;
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (r > 100 && r > g * 1.25 && r > b * 1.25) redLikePixels += 1;
          red += r;
          green += g;
          blue += b;
          luminance += luma;
          luminanceSquare += luma * luma;
          if (secondImage) {
            const comparisonR = secondImage.data[index] ?? 0;
            const comparisonG = secondImage.data[index + 1] ?? 0;
            const comparisonB = secondImage.data[index + 2] ?? 0;
            comparisonRed += comparisonR;
            comparisonGreen += comparisonG;
            comparisonBlue += comparisonB;
            comparisonLuminance += 0.2126 * comparisonR + 0.7152 * comparisonG + 0.0722 * comparisonB;
            const delta = Math.max(
              Math.abs(r - comparisonR),
              Math.abs(g - comparisonG),
              Math.abs(b - comparisonB),
            );
            deltaTotal += (
              Math.abs(r - comparisonR) +
              Math.abs(g - comparisonG) +
              Math.abs(b - comparisonB)
            ) / 3;
            if (delta >= 12) changedPixels += 1;
          }
          count += 1;
        }
      }
      const meanLuminance = count ? luminance / count : 0;
      results[name] = {
        region: { left, top, right, bottom },
        pixels: count,
        meanRgb: count ? [red / count, green / count, blue / count] : [0, 0, 0],
        meanLuminance,
        luminanceStdDev: count ? Math.sqrt(Math.max(0, luminanceSquare / count - meanLuminance ** 2)) : 0,
        comparisonMeanRgb: count && secondImage
          ? [comparisonRed / count, comparisonGreen / count, comparisonBlue / count]
          : null,
        comparisonMeanLuminance: count && secondImage ? comparisonLuminance / count : null,
        changedPixels,
        changedFraction: count ? changedPixels / count : 0,
        meanAbsoluteRgbDelta: count ? deltaTotal / count : 0,
        redLikePixels,
      };
    }
    return { width: firstImage.width, height: firstImage.height, regions: results };
  }, {
    firstBase64: first.toString("base64"),
    secondBase64: second?.toString("base64") ?? null,
    regions,
  });

const waitForPublicArchitectureRise = async (page: Page) => {
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  const observer = page.getByTestId("scene-canvas");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "not-eligible");
  await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 60_000 });
  await expect(page.getByTestId("ground-glass-rtt").first()).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await expect(observer.locator("canvas")).toHaveCount(1);
  await waitForFrames(page);
  return observer;
};

const waitForVerificationScene = async (page: Page, search = "?rttDiagnostics=1") => {
  await page.goto(`${FIXTURE_PATH}${search}`);
  await expect(page.locator("body")).toHaveAttribute("data-fixture-ready", "true");
  const observer = page.getByTestId("scene-canvas");
  await expect(observer).toHaveAttribute("data-observer-verification-scene", "architecture-rise");
  await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-verification");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", /^(webgl-renderer|webgpu-renderer)$/, { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-execution-backend", /^(webgl2|webgpu|webgl2-fallback|unknown)$/);
  await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-adapter-availability", /^(available|unavailable|api-absent|request-rejected|timed-out)$/ , { timeout: 30_000 });
  await expect(observer).toHaveAttribute("data-observer-test-architecture-rise-probe", "ready");
  await expect(observer).toHaveAttribute("data-observer-test-key-shadow-enabled", /^(true|false)$/);
  await expect(observer).toHaveAttribute("data-observer-test-architecture-rise-visibility-hook", "ready");
  await expect(observer).toHaveAttribute("data-observer-test-architecture-rise-subject-mounted", "true", { timeout: 90_000 });
  await expect(page.getByTestId("ground-glass-rtt").first()).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 90_000 });
  await waitForFrames(page);
  return observer;
};

const dispatchBoolean = async (observer: Locator, eventName: string, detail: boolean) => {
  await observer.evaluate((element, payload) => {
    element.dispatchEvent(new CustomEvent(payload.eventName, { detail: payload.detail }));
  }, { eventName, detail });
};

const dispatchLight = async (observer: Locator, eventName: string, detail: { name: string; enabled: boolean }) => {
  await observer.evaluate((element, payload) => {
    element.dispatchEvent(new CustomEvent(payload.eventName, { detail: payload.detail }));
  }, { eventName, detail });
};

test("public Architecture Rise keeps WebGL and the public WebGPU request denied", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const unexpectedErrors: string[] = [];
  const webgpuRequests: string[] = [];
  page.on("pageerror", (error) => unexpectedErrors.push(error.message));
  page.on("request", (request) => {
    if (/three[/_-]webgpu|\/webgpu\//i.test(request.url())) webgpuRequests.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });

  const defaultObserver = await waitForPublicArchitectureRise(page);
  const defaultCapture = await captureCanvas(defaultObserver, testInfo, "architecture-rise-public-webgl-default.png");
  const defaultEvidence = await defaultObserver.evaluate((element) => ({
    apiPresent: element.getAttribute("data-observer-webgpu-api-present"),
    family: element.getAttribute("data-observer-renderer-family"),
    backend: element.getAttribute("data-observer-execution-backend"),
    toneMapping: element.getAttribute("data-observer-tone-mapping"),
    toneMappingExposure: element.getAttribute("data-observer-tone-mapping-exposure"),
    outputColorSpace: element.getAttribute("data-observer-output-color-space"),
    shadowStatus: element.getAttribute("data-observer-shadow-map-status"),
    shadowType: element.getAttribute("data-observer-shadow-map-type"),
    environmentStatus: element.getAttribute("data-observer-environment-status"),
    generation: element.getAttribute("data-observer-renderer-generation"),
    view: {
      position: element.getAttribute("data-observer-camera-position"),
      target: element.getAttribute("data-orbit-target"),
    },
  }));
  expect(defaultCapture.length).toBeGreaterThan(0);
  expect(defaultEvidence.toneMapping).toBeTruthy();
  expect(defaultEvidence.outputColorSpace).toBeTruthy();

  await page.goto("/simulator/free/architecture-rise?observerRenderer=webgpu&rttDiagnostics=1");
  const deniedObserver = page.getByTestId("scene-canvas");
  await expect(deniedObserver).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(deniedObserver).toHaveAttribute("data-observer-renderer-family", "webgl-renderer", { timeout: 60_000 });
  await expect(deniedObserver).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(deniedObserver).toHaveAttribute("data-observer-selection-reason", "scene-compatibility-not-evaluated");
  await expect(deniedObserver).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "not-eligible");
  await expect(page.getByTestId("ground-glass-rtt").first()).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  expect(webgpuRequests).toEqual([]);
  expect(unexpectedErrors).toEqual([]);
  await attachJson(testInfo, "architecture-rise-public-webgl-evidence.json", {
    browserVersion: page.context().browser()?.version() ?? "unknown",
    threeRevision: REVISION,
    requestedRenderer: "default-webgl",
    publicWebGpuRequest: {
      family: await deniedObserver.getAttribute("data-observer-renderer-family"),
      backend: await deniedObserver.getAttribute("data-observer-execution-backend"),
      selectionReason: await deniedObserver.getAttribute("data-observer-selection-reason"),
      pilotEligibility: await deniedObserver.getAttribute("data-observer-webgpu-pilot-eligibility"),
      lazyWebGpuRequests: webgpuRequests.length,
    },
    default: defaultEvidence,
    groundGlass: await page.getByTestId("ground-glass-rtt").first().getAttribute("data-rtt-final-contentful"),
    pageErrors: unexpectedErrors,
  });
});

test("full Architecture Rise scene has measurable subject, material, environment, lighting, interaction and lifecycle evidence", async ({ page, browser }, testInfo) => {
  test.setTimeout(600_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const closePosition = [4.8, 2.7, 4.2] as const;
  const closeTarget = [0, 1.25, 9.3] as const;

  const baselineObserver = await waitForPublicArchitectureRise(page);
  const baselineAttributes = await baselineObserver.evaluate((element) => Object.fromEntries(
    Array.from(element.attributes)
      .filter((attribute) => attribute.name.startsWith("data-observer-"))
      .map((attribute) => [attribute.name, attribute.value]),
  ));
  const baselineFocus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const baselineAperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  const baselineSceneState = {
    viewFocus: baselineAttributes["data-view-focus"],
    focusDistanceMm: await baselineFocus.inputValue(),
    focusMinimumMm: await baselineFocus.getAttribute("min"),
    focusMaximumMm: await baselineFocus.getAttribute("max"),
    aperture: await baselineAperture.getAttribute("data-selected-aperture"),
    riseMm: await page.getByRole("slider", { name: "Rise", exact: true }).inputValue(),
    tiltDeg: await page.getByRole("slider", { name: "Tilt", exact: true }).inputValue(),
    swingDeg: await page.getByRole("slider", { name: "Swing", exact: true }).inputValue(),
  };
  const baselineGroundGlass = await page.getByTestId("ground-glass-rtt").first().getAttribute("data-rtt-final-contentful");
  const webglDefault = await captureCanvas(baselineObserver, testInfo, "architecture-rise-webgl-matched-default.png");
  const webglDefaultMetrics = await analyzeImageRegions(page, webglDefault, null, {
    wholeFrame: { left: 0, top: 0, right: 1440, bottom: 1000 },
  });
  await applyVerificationView(page, baselineObserver, closePosition, closeTarget);
  const webglCloseView = await readView(baselineObserver);
  const webglClose = await captureCanvas(baselineObserver, testInfo, "architecture-rise-webgl-building-close.png");

  const observer = await waitForVerificationScene(page);
  const mounted = await observer.evaluate((element) => Object.fromEntries(
    Array.from(element.attributes)
      .filter((attribute) => attribute.name.startsWith("data-observer-"))
      .map((attribute) => [attribute.name, attribute.value]),
  ));
  const initialInventory = await parseInventory(observer);
  expect(initialInventory.rootName).toBe("architecture-rise-subject");
  expect(initialInventory.meshCount).toBeGreaterThan(50);
  expect(initialInventory.materialTypes).toContain("MeshStandardMaterial");
  expect(initialInventory.materialTypes).toContain("MeshBasicMaterial");
  expect(initialInventory.mappedMaterialCount).toBeGreaterThan(0);
  expect(initialInventory.normalMappedMaterialCount).toBeGreaterThan(0);
  expect(Object.values(initialInventory.expectedMeshes).every(Boolean)).toBe(true);
  expect(initialInventory.environmentTextureAssigned).toBe(true);
  expect(initialInventory.daylightLightPresent).toBe(true);
  expect(initialInventory.daylightCastsShadow).toBe(false);
  expect(initialInventory.presentationKeyPresent).toBe(true);
  expect(initialInventory.presentationKeyCastsShadow).toBe(true);
  const facadeMaterial = initialInventory.features.facade?.materials[0];
  expect(facadeMaterial?.type).toBe("MeshStandardMaterial");
  expect(facadeMaterial?.map?.width).toBe(128);
  expect(facadeMaterial?.map?.colorSpace).toBe("srgb");
  expect(facadeMaterial?.normalMap?.width).toBe(128);
  expect(facadeMaterial?.roughnessMap?.width).toBe(128);
  const frontGlazingMaterial = initialInventory.features.frontGlazing?.materials[0];
  expect(frontGlazingMaterial).toMatchObject({
    type: "MeshStandardMaterial",
    color: "#182d37",
    roughness: 0.24,
    metalness: 0.08,
  });
  expect(await observer.getAttribute("data-observer-webgpu-scene-compatibility")).toBe("not-evaluated");
  expect(await observer.getAttribute("data-observer-webgpu-pilot-eligibility")).toBe("not-eligible");

  const rendererFamily = await observer.getAttribute("data-observer-renderer-family");
  const executionBackend = await observer.getAttribute("data-observer-execution-backend");
  const applicationFallback = await observer.getAttribute("data-observer-application-fallback");
  const failureStage = await observer.getAttribute("data-observer-renderer-failure-stage");
  const initializationAttempts = Number(await observer.getAttribute("data-observer-webgpu-initialization-attempts"));
  const initialRendererGeneration = await observer.getAttribute("data-observer-renderer-generation");
  expect(initializationAttempts).toBe(1);
  if (nativeWebGpuRequired) {
    expect(await observer.getAttribute("data-observer-webgpu-api-present")).toBe("true");
    expect(await observer.getAttribute("data-observer-adapter-availability")).toBe("available");
    expect(rendererFamily).toBe("webgpu-renderer");
    expect(executionBackend).toBe("webgpu");
    expect(applicationFallback).toBe("none");
    expect(failureStage).toBeNull();
    expect(mounted["data-observer-shadow-map-status"]).toBe("active");
    expect(mounted["data-observer-shadow-map-type"]).toBe("pcf");
    expect(mounted["data-observer-tone-mapping"]).toBe("aces-filmic");
    expect(mounted["data-observer-tone-mapping-exposure"]).toBe("1.000000");
    expect(mounted["data-observer-output-color-space"]).toBe("srgb");
  }

  const webgpuDefault = await captureCanvas(observer, testInfo, "architecture-rise-verification-default.png");
  const backendComparison = await analyzeImageRegions(page, webglDefault, webgpuDefault, {
    wholeFrame: { left: 0, top: 0, right: 1440, bottom: 1000 },
  });
  const initialFrame = await analyzeImageRegions(page, webgpuDefault, null, {
    wholeFrame: { left: 0, top: 0, right: 1440, bottom: 1000 },
  });

  // Use the same observer pose in the public WebGL baseline and the verification mount.
  await applyVerificationView(page, observer, closePosition, closeTarget);
  const initialView = await readView(observer);
  expect(vectorsMatch(webglCloseView.position, initialView.position)).toBe(true);
  expect(vectorsMatch(webglCloseView.target, initialView.target)).toBe(true);
  const visibleSubject = await captureCanvas(observer, testInfo, "architecture-rise-subject-visible-close.png");
  const dimensions = await analyzeImageRegions(page, visibleSubject, null, {
    canvas: { left: 0, top: 0, right: 1440, bottom: 1000 },
  });
  const closeFeatureRegions = Object.fromEntries(
    Object.entries(initialInventory.features).flatMap(([name, feature]) => {
      if (!feature) return [];
      const region = projectBounds(feature.bounds, dimensions.width, dimensions.height, initialView);
      return region ? [[name, region]] : [];
    }),
  );
  const closeFeatureRois = closeFeatureRegions as Record<string, PixelRegion>;
  const closeBackendComparison = await analyzeImageRegions(page, visibleSubject, webglClose, closeFeatureRois);
  for (const featureName of ["facade", "roofParapet", "frontGlazing", "sideGlazing", "sideReturn", "ground", "sidewalk", "focusChart"]) {
    const comparison = closeBackendComparison.regions[featureName];
    expect(comparison, `${featureName} needs a matched WebGL/WebGPU comparison region`).toBeTruthy();
    expect(comparison?.meanAbsoluteRgbDelta, `${featureName} cross-backend mean color delta must remain bounded`).toBeLessThan(50);
  }
  const subjectRegion = projectBounds(initialInventory.subjectBounds, dimensions.width, dimensions.height, initialView);
  if (!subjectRegion) throw new Error("The projected registered subject bounds are unavailable");
  const subjectCaptureBackend = await observer.getAttribute("data-observer-execution-backend");
  const subjectCaptureFamily = await observer.getAttribute("data-observer-renderer-family");

  let hiddenSubject: Buffer | null = null;
  let restoredSubject: Buffer | null = null;
  try {
    await dispatchBoolean(observer, SUBJECT_EVENT, false);
    await expect(observer).toHaveAttribute("data-observer-test-architecture-rise-subject-visible", "false");
    hiddenSubject = await captureCanvas(observer, testInfo, "architecture-rise-subject-hidden-negative-control.png");
    await expect(page.getByTestId("ground-glass-rtt").first()).toHaveAttribute("data-rtt-final-contentful", "true");
  } finally {
    await dispatchBoolean(observer, SUBJECT_EVENT, true);
    await expect(observer).toHaveAttribute("data-observer-test-architecture-rise-subject-visible", "true");
    restoredSubject = await captureCanvas(observer, testInfo, "architecture-rise-subject-restored.png");
  }
  if (!hiddenSubject || !restoredSubject) throw new Error("Subject negative-control captures did not complete");
  const backgroundRegion = {
    left: Math.max(0, dimensions.width - 48),
    top: 0,
    right: dimensions.width,
    bottom: Math.min(48, dimensions.height),
  };
  const backgroundControl = await analyzeImageRegions(page, visibleSubject, hiddenSubject, {
    unaffectedBackground: backgroundRegion,
  });
  expect(backgroundControl.regions.unaffectedBackground.meanLuminance).toBeGreaterThan(20);
  expect(backgroundControl.regions.unaffectedBackground.changedPixels).toBeLessThan(8);
  const subjectDifferential = await analyzeImageRegions(page, visibleSubject, hiddenSubject, {
    subject: subjectRegion,
    ...closeFeatureRegions,
  });
  const subjectRestoration = await analyzeImageRegions(page, visibleSubject, restoredSubject, {
    subject: subjectRegion,
  });
  expect(subjectDifferential.regions.subject.changedPixels).toBeGreaterThan(500);
  expect(subjectDifferential.regions.subject.changedFraction).toBeGreaterThan(0.01);
  for (const featureName of ["facade", "roofParapet", "frontGlazing", "sideGlazing", "sideReturn", "focusChart"]) {
    const feature = subjectDifferential.regions[featureName];
    expect(feature, `${featureName} projected ROI must be present`).toBeTruthy();
    expect(feature?.pixels, `${featureName} ROI must contain pixels`).toBeGreaterThan(20);
    expect(feature?.changedPixels, `${featureName} must contribute subject pixels`).toBeGreaterThan(4);
  }
  expect(subjectDifferential.regions.focusChart?.redLikePixels, "the projected focus chart ROI must retain its red crosshair").toBeGreaterThan(0);
  expect(subjectRestoration.regions.subject.changedFraction).toBeLessThan(0.025);
  await expect(observer).toHaveAttribute("data-observer-execution-backend", subjectCaptureBackend ?? "unknown");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", subjectCaptureFamily ?? "unknown");
  await expect(observer).toHaveAttribute("data-observer-renderer-generation", initialRendererGeneration ?? "");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", String(initializationAttempts));
  const rendererStableDuringSubjectDifferential =
    subjectCaptureBackend === await observer.getAttribute("data-observer-execution-backend") &&
    subjectCaptureFamily === await observer.getAttribute("data-observer-renderer-family") &&
    initialRendererGeneration === await observer.getAttribute("data-observer-renderer-generation");
  expect(rendererStableDuringSubjectDifferential).toBe(true);
  const currentAfterSubjectCapture = await readView(observer);
  const subjectCaptureViewStable = vectorsMatch(initialView.position, currentAfterSubjectCapture.position) &&
    vectorsMatch(initialView.target, currentAfterSubjectCapture.target);
  expect(subjectCaptureViewStable).toBe(true);

  // Environment negative control changes only the real Observer scene.environment assignment.
  const glazingRegion = closeFeatureRegions.frontGlazing;
  if (!glazingRegion) throw new Error("Front glazing ROI is not in the close-up camera view");
  const environmentOn = await captureCanvas(observer, testInfo, "architecture-rise-environment-active.png");
  await dispatchBoolean(observer, ENVIRONMENT_EVENT, false);
  await expect(observer).toHaveAttribute("data-observer-test-environment-enabled", "false");
  const environmentOff = await captureCanvas(observer, testInfo, "architecture-rise-environment-disabled-negative-control.png");
  await dispatchBoolean(observer, ENVIRONMENT_EVENT, true);
  await expect(observer).toHaveAttribute("data-observer-test-environment-enabled", "true");
  await expect(observer).toHaveAttribute("data-observer-environment-status", "active");
  const environmentDiff = await analyzeImageRegions(page, environmentOn, environmentOff, { frontGlazing: glazingRegion });
  expect(environmentDiff.regions.frontGlazing.changedPixels).toBeGreaterThan(100);
  expect(environmentDiff.regions.frontGlazing.meanAbsoluteRgbDelta).toBeGreaterThan(2);
  const environmentRestored = await captureCanvas(observer, testInfo, "architecture-rise-environment-restored.png");
  const environmentRestoreDiff = await analyzeImageRegions(page, environmentOn, environmentRestored, { frontGlazing: glazingRegion });
  const environmentReenabled = await observer.getAttribute("data-observer-test-environment-enabled");
  expect(environmentReenabled).toBe("true");
  expect(environmentRestoreDiff.regions.frontGlazing.changedPixels).toBeLessThan(8);
  expect(environmentRestoreDiff.regions.frontGlazing.meanAbsoluteRgbDelta).toBeLessThan(0.25);
  await expect(observer).toHaveAttribute("data-observer-renderer-generation", initialRendererGeneration ?? "");

  // Light negative controls independently alter the actual configured Three.js lights.
  const lightEvidence: Record<string, { enabledVsDisabled: RegionPixels; restoration: RegionPixels }> = {};
  for (const light of ["teaching-lighting-key", "architecture-rise-daylight"] as const) {
    const eventName = LIGHT_EVENT;
    const on = await captureCanvas(observer, testInfo, `${light}-enabled.png`);
    await dispatchLight(observer, eventName, { name: light, enabled: false });
    const attributeName = light === "teaching-lighting-key"
      ? "data-observer-test-presentation-key-enabled"
      : "data-observer-test-daylight-enabled";
    await expect(observer).toHaveAttribute(attributeName, "false");
    const off = await captureCanvas(observer, testInfo, `${light}-disabled-negative-control.png`);
    await dispatchLight(observer, eventName, { name: light, enabled: true });
    await expect(observer).toHaveAttribute(attributeName, "true");
    const diff = await analyzeImageRegions(page, on, off, { facade: closeFeatureRegions.facade! });
    const restored = await captureCanvas(observer, testInfo, `${light}-restored.png`);
    const restorationDiff = await analyzeImageRegions(page, on, restored, { facade: closeFeatureRegions.facade! });
    expect(diff.regions.facade.changedPixels, `${light} must contribute measurable facade pixels`).toBeGreaterThan(1_000);
    expect(diff.regions.facade.meanAbsoluteRgbDelta, `${light} must cause a meaningful facade change`).toBeGreaterThan(1);
    expect(restorationDiff.regions.facade.changedPixels, `${light} restoration must return to its enabled image`).toBeLessThan(8);
    expect(restorationDiff.regions.facade.meanAbsoluteRgbDelta).toBeLessThan(0.25);
    lightEvidence[light] = {
      enabledVsDisabled: diff.regions.facade,
      restoration: restorationDiff.regions.facade,
    };
  }
  await expect(observer).toHaveAttribute("data-observer-renderer-generation", initialRendererGeneration ?? "");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", String(initializationAttempts));
  let shadowEvidence: Readonly<Record<string, unknown>> = {
    status: "pending-measurement",
    configuredStatus: mounted["data-observer-shadow-map-status"],
    configuredType: mounted["data-observer-shadow-map-type"],
    daylightCastsShadow: false,
    presentationKeyCastsShadow: initialInventory.presentationKeyCastsShadow,
  };
  const shadowOnView = await readView(observer);
  const shadowOn = await captureCanvas(observer, testInfo, "architecture-rise-shadow-map-enabled.png");
  // The negative control starts with castShadow disabled before the first
  // WebGPU frame. Three r186 can dereference a null shadow depth texture when
  // castShadow is toggled after a native WebGPU shadow node has been created.
  await waitForVerificationScene(page, "?rttDiagnostics=1&shadowMode=disabled");
  await expect(observer).toHaveAttribute("data-observer-test-key-shadow-enabled", "false");
  await expect(observer).toHaveAttribute("data-observer-renderer-family", rendererFamily ?? "unknown");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", executionBackend ?? "unknown");
  await expect(observer).toHaveAttribute("data-observer-application-fallback", applicationFallback ?? "none");
  await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  const shadowOffInventory = await parseInventory(observer);
  expect(shadowOffInventory.presentationKeyCastsShadow).toBe(false);
  await applyVerificationView(page, observer, closePosition, closeTarget);
  const shadowOffView = await readView(observer);
  expect(vectorsMatch(shadowOnView.position, shadowOffView.position)).toBe(true);
  expect(vectorsMatch(shadowOnView.target, shadowOffView.target)).toBe(true);
  const shadowOff = await captureCanvas(observer, testInfo, "architecture-rise-shadow-map-disabled-negative-control.png");
  const shadowDiff = await analyzeImageRegions(page, shadowOn, shadowOff, {
    subject: subjectRegion,
    ground: closeFeatureRegions.ground ?? subjectRegion,
  });
  shadowEvidence = {
    status: shadowDiff.regions.subject.changedPixels > 100 ? "measurable-shadow-contribution" : "no-measurable-shadow-difference",
    configuredStatus: mounted["data-observer-shadow-map-status"],
    configuredType: mounted["data-observer-shadow-map-type"],
    subjectChangedPixels: shadowDiff.regions.subject.changedPixels,
    subjectChangedFraction: shadowDiff.regions.subject.changedFraction,
    groundRegion: shadowDiff.regions.ground,
    daylightCastsShadow: initialInventory.daylightCastsShadow,
    presentationKeyCastsShadowOn: initialInventory.presentationKeyCastsShadow,
    presentationKeyCastsShadowOff: shadowOffInventory.presentationKeyCastsShadow,
    sameMountedFamily: await observer.getAttribute("data-observer-renderer-family") === rendererFamily,
    sameExecutionBackend: await observer.getAttribute("data-observer-execution-backend") === executionBackend,
    negativeControlInitializationAttempts: Number(await observer.getAttribute("data-observer-webgpu-initialization-attempts")),
  };
  expect(shadowDiff.regions.subject.changedPixels).toBeGreaterThan(100);
  expect(shadowDiff.regions.ground.changedPixels).toBeGreaterThan(100);

  // Matched, view-dependent glazing captures demonstrate that the scene response changes with camera direction.
  const opposingViewPosition = [-4.8, 2.7, 4.2] as const;
  await applyVerificationView(page, observer, opposingViewPosition, closeTarget);
  const opposingView = await readView(observer);
  const opposingViewImage = await captureCanvas(observer, testInfo, "architecture-rise-glazing-opposing-view.png");
  const opposingGlazingRegion = initialInventory.features.frontGlazing
    ? projectBounds(initialInventory.features.frontGlazing.bounds, dimensions.width, dimensions.height, opposingView)
    : null;
  const viewDependentGlazing = opposingGlazingRegion
    ? await analyzeImageRegions(page, opposingViewImage, null, { frontGlazing: opposingGlazingRegion })
    : null;
  const initialGlazingPixels = await analyzeImageRegions(page, environmentOn, null, { frontGlazing: glazingRegion });

  // Public controls update canonical state and Ground Glass without remounting the Observer.
  await applyVerificationView(page, observer, closePosition, closeTarget);
  const stableGeneration = await observer.getAttribute("data-observer-renderer-generation");
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const groundGlass = page.getByTestId("ground-glass-rtt").first();
  const groundGlassBeforeControls = await captureCanvas(groundGlass, testInfo, "ground-glass-before-public-controls.png");
  await focus.focus();
  await focus.press("End");
  await expect(focus).toHaveValue("13000");
  const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  await aperture.getByRole("radio", { name: "f/5.6" }).check();
  await setStepRangeInput(page, "Rise", 22);
  await setStepRangeInput(page, "Tilt", 0.4);
  await setStepRangeInput(page, "Swing", -1.1);
  await expect(page.getByRole("slider", { name: "Rise", exact: true })).toHaveValue("22");
  await expect(page.getByRole("slider", { name: "Tilt", exact: true })).toHaveValue("0.4");
  await expect(page.getByRole("slider", { name: "Swing", exact: true })).toHaveValue("-1.1");
  await expect(observer).toHaveAttribute("data-optics-fallback-applied", "false");
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  const groundGlassAfterControls = await captureCanvas(groundGlass, testInfo, "ground-glass-after-public-controls.png");
  const groundGlassControlDimensions = await analyzeImageRegions(page, groundGlassBeforeControls, null, {
    wholeFrame: { left: 0, top: 0, right: 10_000, bottom: 10_000 },
  });
  const groundGlassControlResponse = await analyzeImageRegions(page, groundGlassBeforeControls, groundGlassAfterControls, {
    wholeFrame: {
      left: 0,
      top: 0,
      right: groundGlassControlDimensions.width,
      bottom: groundGlassControlDimensions.height,
    },
  });
  expect(groundGlassControlResponse.regions.wholeFrame.changedPixels).toBeGreaterThan(100);
  await expect(observer).toHaveAttribute("data-observer-renderer-generation", stableGeneration ?? "");
  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await waitForFrames(page);
  const beforeZoom = await readView(observer);
  const zoomCanvasBounds = await observer.locator("canvas").boundingBox();
  if (!zoomCanvasBounds) throw new Error("Observer canvas has no visible bounds for zoom validation");
  await page.mouse.move(zoomCanvasBounds.x + zoomCanvasBounds.width / 2, zoomCanvasBounds.y + zoomCanvasBounds.height / 2);
  await page.mouse.wheel(0, -240);
  await expect.poll(async () => !vectorsMatch((await readView(observer)).position, beforeZoom.position), { timeout: 5_000 }).toBe(true);
  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await expect.poll(async () => {
    const current = await readView(observer);
    return vectorsMatch(current.position, beforeZoom.position) && vectorsMatch(current.target, beforeZoom.target);
  }, { timeout: 5_000 }).toBe(true);
  const cameraBaseline = await readView(observer);
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(observer).toHaveAttribute("data-view-focus", "camera");
  await page.getByRole("button", { name: "Scene", exact: true }).click();
  await expect(observer).toHaveAttribute("data-view-focus", "scene");
  const canvasBounds = await observer.locator("canvas").boundingBox();
  if (!canvasBounds) throw new Error("Observer canvas has no visible bounds for orbit validation");
  await page.mouse.move(canvasBounds.x + canvasBounds.width / 2, canvasBounds.y + canvasBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBounds.x + canvasBounds.width / 2 + 58, canvasBounds.y + canvasBounds.height / 2 + 20, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => {
    const current = await readView(observer);
    return !vectorsMatch(current.position, cameraBaseline.position) || !vectorsMatch(current.target, cameraBaseline.target);
  }, { timeout: 5_000 }).toBe(true);
  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await expect.poll(async () => {
    const current = await readView(observer);
    return vectorsMatch(current.position, cameraBaseline.position) && vectorsMatch(current.target, cameraBaseline.target);
  }, { timeout: 5_000 }).toBe(true);
  await expect(observer).toHaveAttribute("data-observer-renderer-generation", stableGeneration ?? "");
  await expect(observer).toHaveAttribute("data-observer-environment-status", "active");
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");
  const rawMode = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
  const uprightMode = page.getByRole("radio", { name: "Upright Assist", exact: true });
  await expect(rawMode).toBeChecked();
  const rawModeImage = await captureCanvas(groundGlass, testInfo, "ground-glass-raw-mode.png");
  await uprightMode.check();
  await expect(uprightMode).toBeChecked();
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");
  const uprightModeImage = await captureCanvas(groundGlass, testInfo, "ground-glass-upright-assist-mode.png");
  const groundGlassDimensions = await analyzeImageRegions(page, rawModeImage, null, {
    wholeFrame: { left: 0, top: 0, right: 10_000, bottom: 10_000 },
  });
  const groundGlassModeDifference = await analyzeImageRegions(page, rawModeImage, uprightModeImage, {
    wholeFrame: { left: 0, top: 0, right: groundGlassDimensions.width, bottom: groundGlassDimensions.height },
  });
  expect(groundGlassModeDifference.regions.wholeFrame.changedPixels).toBeGreaterThan(100);
  await rawMode.check();
  await expect(rawMode).toBeChecked();
  await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");
  const rendererGenerationStableDuringControls =
    stableGeneration === await observer.getAttribute("data-observer-renderer-generation");
  expect(rendererGenerationStableDuringControls).toBe(true);
  const controlsAtFinalRender = {
    focusDistanceMm: await focus.inputValue(),
    aperture: await aperture.getAttribute("data-selected-aperture"),
    riseMm: await page.getByRole("slider", { name: "Rise", exact: true }).inputValue(),
    tiltDeg: await page.getByRole("slider", { name: "Tilt", exact: true }).inputValue(),
    swingDeg: await page.getByRole("slider", { name: "Swing", exact: true }).inputValue(),
  };
  const groundGlassContentfulAtFinalRender =
    await groundGlass.getAttribute("data-rtt-final-contentful") === "true";
  const rawGroundGlassRestored = await rawMode.isChecked();

  const finalScreenshot = await captureCanvas(observer, testInfo, "architecture-rise-interactive-final.png");
  const groundGlassScreenshot = await page.screenshot({ animations: "disabled", fullPage: true });
  const groundGlassOutputPath = testInfo.outputPath("architecture-rise-ground-glass-and-observer.png");
  await mkdir(dirname(groundGlassOutputPath), { recursive: true });
  await writeFile(groundGlassOutputPath, groundGlassScreenshot);
  await testInfo.attach("architecture-rise-ground-glass-and-observer.png", { body: groundGlassScreenshot, contentType: "image/png" });
  const originalObserverGeneration = await observer.getAttribute("data-observer-renderer-generation");
  await observer.evaluate((element) => {
    (window as Window & { __architectureRiseObserverBeforeSpaNavigation?: Element })
      .__architectureRiseObserverBeforeSpaNavigation = element;
  });
  await page.getByTestId("verification-navigate-away").click();
  await expect(page).toHaveURL(/\/simulator\/free\/view-camera-anatomy\?rttDiagnostics=1$/);
  const navigationSceneObserver = page.getByTestId("scene-canvas");
  await expect(navigationSceneObserver).toHaveAttribute("data-scene-subject-id", "view-camera-anatomy", { timeout: 90_000 });
  await expect(navigationSceneObserver).toHaveAttribute("data-observer-renderer-family", "webgl-renderer", { timeout: 90_000 });
  await expect(navigationSceneObserver).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(page.getByTestId("ground-glass-rtt").first()).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 90_000 });
  const anatomyNavigationEvidence = {
    sceneSubjectId: await navigationSceneObserver.getAttribute("data-scene-subject-id"),
    rendererFamily: await navigationSceneObserver.getAttribute("data-observer-renderer-family"),
    executionBackend: await navigationSceneObserver.getAttribute("data-observer-execution-backend"),
    groundGlassContentful: await page.getByTestId("ground-glass-rtt").first().getAttribute("data-rtt-final-contentful"),
  };
  await page.getByTestId("verification-return").click();
  await expect(page).toHaveURL(new RegExp(`${FIXTURE_PATH.replaceAll("/", "\\/")}\\?rttDiagnostics=1$`));
  await expect(page.locator("body")).toHaveAttribute("data-fixture-ready", "true");
  const returnedObserver = page.getByTestId("scene-canvas");
  await expect(returnedObserver).toHaveAttribute("data-observer-verification-scene", "architecture-rise", { timeout: 90_000 });
  await expect(returnedObserver).toHaveAttribute("data-observer-renderer-request", "webgpu-verification");
  await expect(returnedObserver).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(returnedObserver).toHaveAttribute("data-observer-renderer-family", rendererFamily ?? "unknown", { timeout: 90_000 });
  await expect(returnedObserver).toHaveAttribute("data-observer-execution-backend", executionBackend ?? "unknown", { timeout: 90_000 });
  await expect(returnedObserver).toHaveAttribute("data-observer-application-fallback", applicationFallback ?? "none");
  await expect(returnedObserver).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  await expect(returnedObserver).toHaveAttribute("data-observer-environment-status", "active", { timeout: 90_000 });
  await expect(returnedObserver).toHaveAttribute("data-observer-test-architecture-rise-subject-mounted", "true", { timeout: 90_000 });
  await expect(page.getByTestId("ground-glass-rtt").first()).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 90_000 });
  const observerCanvasReplaced = await returnedObserver.evaluate((element) =>
    (window as Window & { __architectureRiseObserverBeforeSpaNavigation?: Element })
      .__architectureRiseObserverBeforeSpaNavigation !== element,
  );
  await page.evaluate(() => {
    delete (window as Window & { __architectureRiseObserverBeforeSpaNavigation?: Element })
      .__architectureRiseObserverBeforeSpaNavigation;
  });
  expect(observerCanvasReplaced).toBe(true);
  const spaNavigationEvidence = {
    awayScene: anatomyNavigationEvidence,
    returnedRendererFamily: await returnedObserver.getAttribute("data-observer-renderer-family"),
    returnedExecutionBackend: await returnedObserver.getAttribute("data-observer-execution-backend"),
    returnedApplicationFallback: await returnedObserver.getAttribute("data-observer-application-fallback"),
    returnedInitializationAttempts: Number(await returnedObserver.getAttribute("data-observer-webgpu-initialization-attempts")),
    returnedGeneration: await returnedObserver.getAttribute("data-observer-renderer-generation"),
    previousGeneration: originalObserverGeneration,
    observerCanvasReplaced,
    groundGlassContentfulAfterReturn: await page.getByTestId("ground-glass-rtt").first().getAttribute("data-rtt-final-contentful"),
  };
  if (nativeWebGpuRequired) {
    expect(anatomyNavigationEvidence.rendererFamily).toBe("webgl-renderer");
    expect(anatomyNavigationEvidence.executionBackend).toBe("webgl2");
    expect(spaNavigationEvidence.returnedRendererFamily).toBe("webgpu-renderer");
    expect(spaNavigationEvidence.returnedExecutionBackend).toBe("webgpu");
  }
  expect(spaNavigationEvidence.returnedInitializationAttempts).toBe(1);
  expect(spaNavigationEvidence.groundGlassContentfulAfterReturn).toBe("true");
  const inventory = await parseInventory(observer);
  const runtimeEvidence = {
    schemaVersion: 1,
    environment: {
      operatingSystem: process.platform,
      osRelease: release(),
      architecture: process.arch,
      browserEngine: browser.browserType().name(),
      browserVersion: browser.version(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      threeRevision: REVISION,
      viewport: page.viewportSize(),
      devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
      nativeRequiredMode: nativeWebGpuRequired,
    },
    publicCompatibility: {
      webglFamily: baselineAttributes["data-observer-renderer-family"],
      webglBackend: baselineAttributes["data-observer-execution-backend"],
      architectureRiseRegistryStatus: mounted["data-observer-webgpu-scene-compatibility"],
      developmentPilotEligibility: mounted["data-observer-webgpu-pilot-eligibility"],
    },
    baselineSceneState,
    mountedRenderer: {
      request: mounted["data-observer-renderer-request"],
      family: rendererFamily,
      executionBackend,
      adapterAvailability: mounted["data-observer-adapter-availability"],
      browserWebGpuApi: mounted["data-observer-webgpu-api-present"],
      applicationFallback,
      failureStage,
      initializationAttempts,
      generation: mounted["data-observer-renderer-generation"],
      hardwareAcceleration: mounted["data-observer-hardware-acceleration"] ?? "unconfirmed",
      toneMapping: mounted["data-observer-tone-mapping"],
      toneMappingExposure: mounted["data-observer-tone-mapping-exposure"],
      outputColorSpace: mounted["data-observer-output-color-space"],
      shadowMapStatus: mounted["data-observer-shadow-map-status"],
      shadowMapType: mounted["data-observer-shadow-map-type"],
      environmentStatus: mounted["data-observer-environment-status"],
    },
    actualRegisteredSubject: {
      visibleVsHidden: subjectDifferential.regions,
      unaffectedBackgroundWhileHidden: backgroundControl.regions.unaffectedBackground,
      restored: subjectRestoration.regions.subject,
      inventory,
      cameraPoseStableDuringDifferential: subjectCaptureViewStable,
      rendererStableDuringDifferential: rendererStableDuringSubjectDifferential,
    },
    environmentNegativeControl: {
      activeVsDisabledFrontGlazing: environmentDiff.regions.frontGlazing,
      restored: environmentRestoreDiff.regions.frontGlazing,
      renderingStayedContentful: initialFrame.regions.wholeFrame.pixels > 0,
      environmentReenabled,
    },
    lighting: {
      presentationKey: lightEvidence["teaching-lighting-key"],
      daylight: lightEvidence["architecture-rise-daylight"],
      shadowMap: {
        ...shadowEvidence,
      },
    },
    glazing: {
      originalView: initialGlazingPixels.regions.frontGlazing,
      opposingView: viewDependentGlazing?.regions.frontGlazing ?? null,
      viewDependentMeanLuminanceDelta: viewDependentGlazing
        ? Math.abs(initialGlazingPixels.regions.frontGlazing.meanLuminance - viewDependentGlazing.regions.frontGlazing.meanLuminance)
        : null,
    },
    webglVsVerificationDefault: {
      dimensions: { width: backendComparison.width, height: backendComparison.height },
      meanAbsoluteRgbDelta: backendComparison.regions.wholeFrame.meanAbsoluteRgbDelta,
      changedPixelFraction: backendComparison.regions.wholeFrame.changedFraction,
      webglDefault: webglDefaultMetrics.regions.wholeFrame,
      verificationDefault: initialFrame.regions.wholeFrame,
    },
    webglVsWebGpuCloseFeatures: closeBackendComparison.regions,
    interactions: {
      ...controlsAtFinalRender,
      sceneCameraOrbitAndReset: true,
      zoomChangedCameraAndReset: true,
      cameraFraming: {
        defaultWebgl: {
          position: baselineAttributes["data-observer-camera-position"],
          target: baselineAttributes["data-orbit-target"],
        },
        closeWebgl: webglCloseView,
        closeWebgpu: initialView,
        closePoseMatched: vectorsMatch(webglCloseView.position, initialView.position) &&
          vectorsMatch(webglCloseView.target, initialView.target),
        resetAfterOrbit: cameraBaseline,
      },
      rendererGenerationStable: rendererGenerationStableDuringControls,
      groundGlassContentful: baselineGroundGlass === "true" && groundGlassContentfulAtFinalRender,
      groundGlassResponseToPublicControls: groundGlassControlResponse.regions.wholeFrame,
      spaSceneNavigation: spaNavigationEvidence,
      groundGlassRenderer: "existing independent WebGL RTT",
      groundGlassRawUprightModes: {
        rawSelected: rawGroundGlassRestored,
        uprightAssistChangedPixels: groundGlassModeDifference.regions.wholeFrame.changedPixels,
        uprightAssistChangedFraction: groundGlassModeDifference.regions.wholeFrame.changedFraction,
        bothModesContentful: true,
      },
      finalObserverScreenshotBytes: finalScreenshot.length,
      groundGlassScreenshotBytes: groundGlassScreenshot.length,
    },
    pageErrors,
    consoleErrors,
  };
  console.info("Architecture Rise scene verification evidence", JSON.stringify(runtimeEvidence));
  await attachJson(testInfo, "architecture-rise-native-webgpu-runtime-evidence.json", runtimeEvidence);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(runtimeEvidence.interactions.rendererGenerationStable).toBe(true);
  expect(runtimeEvidence.interactions.groundGlassContentful).toBe(true);

  if (nativeWebGpuRequired) {
    expect(rendererFamily).toBe("webgpu-renderer");
    expect(executionBackend).toBe("webgpu");
    expect(applicationFallback).toBe("none");
    expect(failureStage).toBeNull();
    expect(initializationAttempts).toBe(1);
    expect(await observer.getAttribute("data-observer-environment-status")).toBe("active");
    expect(subjectDifferential.regions.subject.changedPixels).toBeGreaterThan(500);
    expect(spaNavigationEvidence.returnedApplicationFallback).toBe("none");
  }
});
