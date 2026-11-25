import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { arch, platform, release } from "node:os";
import { PerspectiveCamera, REVISION, Vector3 } from "three";
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import architectureRiseGeometry from "../../scenes/architectureRiseGeometry";
import { toWorld } from "../../render/rttUtils";
import {
  comparePixelRegions,
  decodePlaywrightPng,
  observerBackendMismatches,
  subjectRoiHasMeaningfulPixels,
  summarizePixelRegion,
  type DecodedPng,
  type ImageDifferenceSummary,
  type PixelRegion,
} from "./observerBackendBenchmark";
import {
  evaluateVisualParityAcceptance,
  compareBaselineAndCompositedRegion,
  readNativeObserverAfterAdapterProbe,
  waitForNativeAdapterAvailability,
  type BackgroundReferenceEvidence,
  type CompositedStateEvidence,
  type OverlayResponseMetric,
  type OverlayResponseState,
} from "./observerVisualParityDiagnostics";

const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const enabled = nativeRequired || process.env.OBSERVER_VISUAL_PARITY_REQUIRED === "1";
const baselineOnly = process.env.OBSERVER_VISUAL_PARITY_BASELINE === "1";
const requestedOutputPolicy = process.env.OBSERVER_OUTPUT_POLICY ?? "standard";
if (!new Set(["standard", "material-aware"]).has(requestedOutputPolicy)) {
  throw new Error(`Unsupported OBSERVER_OUTPUT_POLICY: ${requestedOutputPolicy}`);
}
const materialAwareCandidate = requestedOutputPolicy === "material-aware";
const materialAwareDefaultRequest = process.env.OBSERVER_OUTPUT_POLICY_DEFAULT === "1";
if (materialAwareDefaultRequest && !materialAwareCandidate) {
  throw new Error("OBSERVER_OUTPUT_POLICY_DEFAULT=1 requires OBSERVER_OUTPUT_POLICY=material-aware");
}
const viewEvent = "vcs:observer-verification:architecture-rise-view";
const architectureView = {
  position: [4.8, 2.7, 4.2] as const,
  target: [0, 1.25, 9.3] as const,
};
const authoredBackgroundRgb = [248, 250, 252] as const;
const overlayContract = {
  focusPlane: { color: "#16a34a", opacity: 0.42 },
  nearDofPlane: { color: "#60a5fa", opacity: 0.24 },
  farDofPlane: { color: "#a78bfa", opacity: 0.22 },
  depthTest: true,
  depthWrite: false,
  polygonOffset: { enabled: true, factor: -1, units: -1 },
  fillToneMapped: false,
  outline: { color: "same as fill", opacity: "min(1, fill opacity + 0.45)", depthTest: false, depthWrite: false, toneMapped: false },
} as const;
const stateDefinitions = [
  { name: "no-overlays", focusPlane: false, dofPlanes: false },
  { name: "focus-plane-only", focusPlane: true, dofPlanes: false },
  { name: "dof-planes-only", focusPlane: false, dofPlanes: true },
  { name: "combined-overlays", focusPlane: true, dofPlanes: true },
] as const;

type Backend = "webgl" | "webgpu";
type StateName = (typeof stateDefinitions)[number]["name"];
type VectorTuple = readonly [number, number, number];
type Rgb = readonly [number, number, number];
type RgbRegionSummary = Readonly<{
  region: PixelRegion;
  pixelCount: number;
  meanRgb: Rgb;
  standardDeviationRgb: Rgb;
  minRgb: Rgb;
  maxRgb: Rgb;
}>;
type OverlayContribution = Readonly<{
  pixelCount: number;
  changedPixels: number;
  changedFraction: number;
  bounds: PixelRegion | null;
  meanSignedRgbDelta: Rgb;
  meanAbsoluteRgbDelta: number;
}>;
type CapturedState = Readonly<{
  png: Buffer;
  image: DecodedPng;
  cameraPosition: VectorTuple;
  orbitTarget: VectorTuple;
  canvas: Readonly<{
    cssWidth: number;
    cssHeight: number;
    backingWidth: number;
    backingHeight: number;
    dpr: number;
  }>;
  attributes: Record<string, string>;
}>;
type BackendCapture = Readonly<{
  backend: Backend;
  mountedObserver: Record<string, string | undefined>;
  qualificationMismatches: string[];
  nativeQualification: Awaited<ReturnType<typeof readNativeObserverAfterAdapterProbe>> | null;
  requestedModuleUrls: string[];
  captureConsistencyMismatches: string[];
  pageErrors: string[];
  consoleErrors: string[];
  browser: Readonly<{ name: string; version: string; userAgent: string }>;
  adapter: Readonly<{ apiPresent: string | null; availability: string | null }>;
  canvasOutput: Readonly<Record<string, string | boolean | null>>;
  materialInventory: Record<string, unknown> | null;
  canonicalControls: unknown;
  canvas: CapturedState["canvas"];
  camera: Readonly<{ position: VectorTuple; target: VectorTuple; fov: 45; near: 0.01; far: 200 }>;
  overlayGeometry: Readonly<{ focusVertices: number; nearDofVertices: number; farDofVertices: number }>;
  subjectEvidence: Readonly<{
    region: PixelRegion | null;
    sampleCount: number | null;
    distinctColorBuckets: number | null;
    luminanceStandardDeviation: number | null;
    meaningful: boolean;
  }>;
  groundGlass: Readonly<{ contentful: boolean; renderer: string | null; canvasCount: number }>;
  captures: Partial<Record<StateName | "restored-no-overlays", CapturedState>>;
}>;

const observerLocator = (page: Page) => page.getByTestId("scene-canvas");

const parseMaterialInventory = (value: string | undefined): Record<string, unknown> | null => {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

const parseVector = (value: string | null): VectorTuple | null => {
  if (!value) return null;
  const parts = value.split(",").map(Number);
  return parts.length === 3 && parts.every(Number.isFinite)
    ? [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
    : null;
};

const vectorsMatch = (actual: VectorTuple | null, expected: VectorTuple): boolean =>
  actual !== null && actual.every((value, index) =>
    Math.abs(value - (expected[index] ?? Number.NaN)) < 1e-5,
  );

const waitForFrames = async (page: Page, count = 5): Promise<void> => {
  await page.evaluate((frames) => new Promise<void>((resolvePromise) => {
    const next = (remaining: number) => {
      if (remaining <= 0) return resolvePromise();
      requestAnimationFrame(() => next(remaining - 1));
    };
    next(frames);
  }), count);
};

const readAttributes = async (observer: Locator): Promise<Record<string, string>> =>
  observer.evaluate((element) => Object.fromEntries(
    Array.from(element.attributes)
      .filter((attribute) =>
        attribute.name.startsWith("data-observer-") ||
        attribute.name === "data-scene-subject-id" ||
        attribute.name === "data-focus-overlay-visible" ||
        attribute.name === "data-dof-overlay-visible" ||
        attribute.name === "data-optical-geometry-visible" ||
        attribute.name === "data-focus-overlay-vertices" ||
        attribute.name === "data-near-dof-overlay-vertices" ||
        attribute.name === "data-far-dof-overlay-vertices",
      )
      .map((attribute) => [attribute.name, attribute.value]),
  ));

const readCanonicalControls = async (page: Page) => page.evaluate(() => Array.from(
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"),
).filter((element) => element.getClientRects().length > 0).map((element) => {
  const label = Array.from(element.labels ?? [])
    .map((entry) => entry.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" / ");
  const input = element instanceof HTMLInputElement ? element : null;
  return {
    label: label || element.getAttribute("aria-label") || element.name || element.tagName.toLowerCase(),
    type: input?.type ?? "select",
    name: element.name,
    value: element.value,
    checked: input && (input.type === "checkbox" || input.type === "radio")
      ? input.checked
      : null,
  };
}).filter((entry) => entry.type !== "radio" || entry.checked === true)
  .sort((first, second) => `${first.label}:${first.name}`.localeCompare(`${second.label}:${second.name}`)));

const getBackgroundRegions = (width: number, height: number): Record<string, PixelRegion> => ({
  topLeft: { left: 0.025 * width, top: 0.035 * height, right: 0.16 * width, bottom: 0.16 * height },
  topRight: { left: 0.84 * width, top: 0.035 * height, right: 0.975 * width, bottom: 0.16 * height },
});

const projectArchitectureFacade = (
  width: number,
  height: number,
  position: VectorTuple,
  target: VectorTuple,
): PixelRegion | null => {
  const { building, facade } = architectureRiseGeometry;
  const bounds = {
    min: [
      toWorld(-building.width / 2),
      toWorld(facade.mainBodyBottomY),
      toWorld(facade.frontFacadeZ - 20),
    ] as const,
    max: [
      toWorld(building.width / 2),
      toWorld(facade.mainBodyTopY),
      toWorld(facade.backFacadeZ + 20),
    ] as const,
  };
  const camera = new PerspectiveCamera(45, width / height, 0.01, 200);
  camera.position.set(...position);
  camera.up.set(0, 1, 0);
  camera.lookAt(...target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const projected: Vector3[] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const point = new Vector3(x, y, z).project(camera);
        if (point.z >= -1 && point.z <= 1) projected.push(point);
      }
    }
  }
  if (projected.length < 2) return null;
  const padding = 4;
  const left = Math.max(0, Math.floor((Math.min(...projected.map((point) => point.x)) + 1) * width / 2 - padding));
  const right = Math.min(width, Math.ceil((Math.max(...projected.map((point) => point.x)) + 1) * width / 2 + padding));
  const top = Math.max(0, Math.floor((1 - Math.max(...projected.map((point) => point.y))) * height / 2 - padding));
  const bottom = Math.min(height, Math.ceil((1 - Math.min(...projected.map((point) => point.y))) * height / 2 + padding));
  return right > left && bottom > top ? { left, top, right, bottom } : null;
};

const summarizeRgbRegion = (image: DecodedPng, region: PixelRegion): RgbRegionSummary => {
  const left = Math.max(0, Math.floor(region.left));
  const top = Math.max(0, Math.floor(region.top));
  const right = Math.min(image.width, Math.ceil(region.right));
  const bottom = Math.min(image.height, Math.ceil(region.bottom));
  const sums = [0, 0, 0];
  const squares = [0, 0, 0];
  const mins = [255, 255, 255];
  const maxes = [0, 0, 0];
  let pixelCount = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * image.width + x) * image.channels;
      for (let channel = 0; channel < 3; channel += 1) {
        const value = image.pixels[index + channel] ?? 0;
        sums[channel] = (sums[channel] ?? 0) + value;
        squares[channel] = (squares[channel] ?? 0) + value * value;
        mins[channel] = Math.min(mins[channel] ?? 255, value);
        maxes[channel] = Math.max(maxes[channel] ?? 0, value);
      }
      pixelCount += 1;
    }
  }
  const mean = sums.map((sum) => pixelCount > 0 ? sum / pixelCount : 0);
  const standardDeviation = squares.map((sum, channel) => {
    if (pixelCount === 0) return 0;
    const average = mean[channel] ?? 0;
    return Math.sqrt(Math.max(0, sum / pixelCount - average * average));
  });
  return {
    region: { left, top, right, bottom },
    pixelCount,
    meanRgb: mean as unknown as Rgb,
    standardDeviationRgb: standardDeviation as unknown as Rgb,
    minRgb: mins as unknown as Rgb,
    maxRgb: maxes as unknown as Rgb,
  };
};

const contribution = (
  disabled: DecodedPng,
  enabledImage: DecodedPng,
  region: PixelRegion,
  channelThreshold = 4,
): OverlayContribution => {
  if (disabled.width !== enabledImage.width || disabled.height !== enabledImage.height) {
    throw new Error("Overlay captures must have identical dimensions");
  }
  const left = Math.max(0, Math.floor(region.left));
  const top = Math.max(0, Math.floor(region.top));
  const right = Math.min(disabled.width, Math.ceil(region.right));
  const bottom = Math.min(disabled.height, Math.ceil(region.bottom));
  let changedPixels = 0;
  let count = 0;
  let absoluteTotal = 0;
  const signed = [0, 0, 0];
  let minX = right;
  let minY = bottom;
  let maxX = left;
  let maxY = top;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * disabled.width + x) * disabled.channels;
      const delta = [0, 1, 2].map((channel) =>
        (enabledImage.pixels[index + channel] ?? 0) - (disabled.pixels[index + channel] ?? 0),
      );
      const maximumChannelDelta = Math.max(...delta.map(Math.abs));
      if (maximumChannelDelta < channelThreshold) continue;
      changedPixels += 1;
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let channel = 0; channel < 3; channel += 1) {
        const absoluteDelta = Math.abs(delta[channel] ?? 0);
        signed[channel] = (signed[channel] ?? 0) + (delta[channel] ?? 0);
        absoluteTotal += absoluteDelta;
      }
    }
  }
  const pixelCount = Math.max(0, right - left) * Math.max(0, bottom - top);
  return {
    pixelCount,
    changedPixels,
    changedFraction: pixelCount > 0 ? changedPixels / pixelCount : 0,
    bounds: changedPixels > 0 ? { left: minX, top: minY, right: maxX + 1, bottom: maxY + 1 } : null,
    meanSignedRgbDelta: count > 0
      ? signed.map((value) => value / count) as unknown as Rgb
      : [0, 0, 0],
    meanAbsoluteRgbDelta: count > 0 ? absoluteTotal / (count * 3) : 0,
  };
};

const compareOverlayResponses = (
  webglOff: DecodedPng,
  webglOn: DecodedPng,
  webgpuOff: DecodedPng,
  webgpuOn: DecodedPng,
  region: PixelRegion = { left: 0, top: 0, right: webglOff.width, bottom: webglOff.height },
  channelThreshold = 4,
): OverlayResponseMetric => {
  if (
    webglOff.width !== webglOn.width ||
    webglOff.height !== webglOn.height ||
    webglOff.width !== webgpuOff.width ||
    webglOff.height !== webgpuOff.height ||
    webglOff.width !== webgpuOn.width ||
    webglOff.height !== webgpuOn.height
  ) throw new Error("Cross-backend overlay response captures must have identical dimensions");

  let unionPixels = 0;
  let bothPixels = 0;
  let webglActivePixels = 0;
  let webgpuActivePixels = 0;
  let responseDifferenceTotal = 0;
  const webglDelta = [0, 0, 0];
  const webgpuDelta = [0, 0, 0];
  const left = Math.max(0, Math.floor(region.left));
  const top = Math.max(0, Math.floor(region.top));
  const right = Math.min(webglOff.width, Math.ceil(region.right));
  const bottom = Math.min(webglOff.height, Math.ceil(region.bottom));
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * webglOff.width + x) * webglOff.channels;
      const deltaGl = [0, 1, 2].map((channel) =>
        (webglOn.pixels[index + channel] ?? 0) - (webglOff.pixels[index + channel] ?? 0),
      );
      const deltaGpu = [0, 1, 2].map((channel) =>
        (webgpuOn.pixels[index + channel] ?? 0) - (webgpuOff.pixels[index + channel] ?? 0),
      );
      const activeGl = Math.max(...deltaGl.map(Math.abs)) >= channelThreshold;
      const activeGpu = Math.max(...deltaGpu.map(Math.abs)) >= channelThreshold;
      if (activeGl) webglActivePixels += 1;
      if (activeGpu) webgpuActivePixels += 1;
      if (!activeGl && !activeGpu) continue;
      unionPixels += 1;
      if (activeGl && activeGpu) bothPixels += 1;
      for (let channel = 0; channel < 3; channel += 1) {
        const glValue = deltaGl[channel] ?? 0;
        const gpuValue = deltaGpu[channel] ?? 0;
        webglDelta[channel] = (webglDelta[channel] ?? 0) + glValue;
        webgpuDelta[channel] = (webgpuDelta[channel] ?? 0) + gpuValue;
        responseDifferenceTotal += Math.abs(glValue - gpuValue);
      }
    }
  }
  return {
    region: { left, top, right, bottom },
    activePixelUnion: unionPixels,
    activePixelIntersection: bothPixels,
    webglActivePixels,
    webgpuActivePixels,
    intersectionOverUnion: unionPixels > 0 ? bothPixels / unionPixels : 0,
    meanWebglResponseRgb: unionPixels > 0
      ? webglDelta.map((value) => value / unionPixels) as unknown as Rgb
      : [0, 0, 0],
    meanWebgpuResponseRgb: unionPixels > 0
      ? webgpuDelta.map((value) => value / unionPixels) as unknown as Rgb
      : [0, 0, 0],
    meanAbsoluteResponseDifference: unionPixels > 0
      ? responseDifferenceTotal / (unionPixels * 3)
      : 0,
  };
};

const compareOverlayResponsesSafely = (
  webglOff: DecodedPng,
  webglOn: DecodedPng,
  webgpuOff: DecodedPng,
  webgpuOn: DecodedPng,
  region: PixelRegion,
): OverlayResponseMetric => {
  try {
    return compareOverlayResponses(webglOff, webglOn, webgpuOff, webgpuOn, region);
  } catch (error) {
    return {
      region,
      activePixelUnion: 0,
      activePixelIntersection: 0,
      webglActivePixels: 0,
      webgpuActivePixels: 0,
      intersectionOverUnion: 0,
      meanAbsoluteResponseDifference: 0,
      measurementError: error instanceof Error ? error.message : String(error),
    };
  }
};

const ensureOverlayGroupOpen = async (page: Page): Promise<void> => {
  const choices = page.locator(
    '[data-testid="scene-overlay-inline"], [data-testid="scene-overlay-collapsed"]',
  );
  if (await choices.isVisible().catch(() => false)) return;
  await page.getByRole("button", { name: "View overlays", exact: true }).click();
  await expect(choices).toBeVisible();
};

const setOverlay = async (
  page: Page,
  observer: Locator,
  label: "Focus plane" | "DOF region" | "Optical geometry",
  enabledState: boolean,
): Promise<void> => {
  await ensureOverlayGroupOpen(page);
  const button = page.getByRole("button", {
    name: new RegExp(`^(Show|Hide) ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  });
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-pressed")) !== String(enabledState)) {
    await button.click();
  }
  await expect(button).toHaveAttribute("aria-pressed", String(enabledState));
  if (label === "Focus plane") {
    await expect(observer).toHaveAttribute("data-focus-overlay-visible", String(enabledState));
  } else if (label === "DOF region") {
    await expect(observer).toHaveAttribute("data-dof-overlay-visible", String(enabledState));
  } else {
    await expect(observer).toHaveAttribute("data-optical-geometry-visible", String(enabledState));
  }
};

const applyOverlayState = async (
  page: Page,
  observer: Locator,
  focusPlane: boolean,
  dofPlanes: boolean,
): Promise<void> => {
  await setOverlay(page, observer, "Focus plane", focusPlane);
  await setOverlay(page, observer, "DOF region", dofPlanes);
  await setOverlay(page, observer, "Optical geometry", false);
  await expect(observer).toHaveAttribute("data-optical-geometry-visible", "false");
  await waitForFrames(page);
};

const captureState = async (
  page: Page,
  observer: Locator,
  testInfo: TestInfo,
  backend: Backend,
  name: StateName | "restored-no-overlays",
): Promise<CapturedState> => {
  await waitForFrames(page);
  const cameraPosition = parseVector(await observer.getAttribute("data-observer-camera-position"));
  const orbitTarget = parseVector(await observer.getAttribute("data-orbit-target"));
  if (!cameraPosition || !orbitTarget) throw new Error("The mounted Observer camera pose is unavailable");
  const canvas = await observer.locator("canvas").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      cssWidth: rect.width,
      cssHeight: rect.height,
      backingWidth: (element as HTMLCanvasElement).width,
      backingHeight: (element as HTMLCanvasElement).height,
      dpr: window.devicePixelRatio,
    };
  });
  const canvasLocator = observer.locator("canvas");
  await page.evaluate(() => {
    const container = document.querySelector<HTMLElement>('[data-testid="scene-canvas"]');
    const canvas = container?.querySelector("canvas");
    if (!container || !canvas) throw new Error("The Observer canvas is unavailable for pixel capture");
    const canvasRect = canvas.getBoundingClientRect();
    for (const element of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      if (element === canvas || element.contains(canvas) || canvas.contains(element)) continue;
      const position = getComputedStyle(element).position;
      if (position !== "absolute" && position !== "fixed" && position !== "sticky") continue;
      const rect = element.getBoundingClientRect();
      const overlapsCanvas =
        rect.left < canvasRect.right && rect.right > canvasRect.left &&
        rect.top < canvasRect.bottom && rect.bottom > canvasRect.top;
      if (!overlapsCanvas) continue;
      element.dataset.observerParityPreviousVisibility = element.style.visibility;
      element.dataset.observerParityCaptureHidden = "true";
      element.style.visibility = "hidden";
    }
  });
  let png: Buffer;
  try {
    png = await canvasLocator.screenshot({ animations: "disabled" });
  } finally {
    await page.evaluate(() => {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(
        '[data-observer-parity-capture-hidden="true"]',
      ))) {
        element.style.visibility = element.dataset.observerParityPreviousVisibility ?? "";
        delete element.dataset.observerParityPreviousVisibility;
        delete element.dataset.observerParityCaptureHidden;
      }
    });
  }
  const image = decodePlaywrightPng(png);
  const attributes = await readAttributes(observer);
  const output = testInfo.outputPath(`observer-parity-${backend}-${name}.png`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, png);
  await testInfo.attach(`observer-parity-${backend}-${name}.png`, {
    body: png,
    contentType: "image/png",
  });
  return { png, image, cameraPosition, orbitTarget, canvas, attributes };
};

const captureBackend = async (
  browser: Browser,
  backend: Backend,
  testInfo: TestInfo,
): Promise<BackendCapture> => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "en-US",
  });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const requestedModuleUrls: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    if (/(three[_-]webgpu|three\/webgpu|webgpu\.js|\/webgpu\/)/i.test(request.url())) {
      requestedModuleUrls.push(request.url());
    }
  });

  try {
    const outputParameter = materialAwareCandidate
      ? materialAwareDefaultRequest ? "" : "&observerOutput=material-aware"
      : "&observerOutput=standard";
    const query = backend === "webgpu"
      ? `?observerRenderer=webgpu${outputParameter}&rttDiagnostics=1`
      : "?rttDiagnostics=1";
    await page.goto(`/simulator/free/architecture-rise${query}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    const observer = observerLocator(page);
    await expect(observer.locator("canvas")).toHaveCount(1, { timeout: 90_000 });
    await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 120_000 });
    await expect(observer).toHaveAttribute("data-scene-subject-id", "architecture-rise");
    await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 90_000 });
    let mountedObserver: Record<string, string | undefined>;
    let nativeQualification: Awaited<ReturnType<typeof readNativeObserverAfterAdapterProbe>> | null = null;
    let qualificationMismatches: string[];
    if (backend === "webgpu") {
      nativeQualification = await readNativeObserverAfterAdapterProbe(
        () => readAttributes(observer),
        () => waitForNativeAdapterAvailability(
          () => observer.getAttribute("data-observer-adapter-availability"),
          { timeoutMs: 30_000, pollIntervalMs: 100 },
        ),
      );
      mountedObserver = { ...nativeQualification.final };
      qualificationMismatches = [...nativeQualification.mismatches];
    } else {
      mountedObserver = await readAttributes(observer);
      qualificationMismatches = observerBackendMismatches(mountedObserver, "webgl");
    }
    if (backend === "webgpu" && materialAwareCandidate) {
      let candidateDiagnosticSettled = false;
      try {
        await page.waitForFunction(() => {
          const element = document.querySelector<HTMLElement>('[data-testid="scene-canvas"]');
          return element?.getAttribute("data-observer-output-policy-status") === "active" ||
            element?.getAttribute("data-observer-output-policy-status") === "failed" ||
            element?.getAttribute("data-observer-renderer-family") === "webgl-renderer";
        }, undefined, { timeout: 30_000 });
        candidateDiagnosticSettled = true;
      } catch {
        // Preserve the failure as structured capture evidence below.
      }
      mountedObserver = await readAttributes(observer);
      qualificationMismatches.push(...observerBackendMismatches(mountedObserver, "native-webgpu"));
      for (const attribute of [
        "data-observer-renderer-status",
        "data-observer-renderer-generation",
        "data-observer-renderer-request",
        "data-observer-renderer-family",
        "data-observer-execution-backend",
        "data-observer-application-fallback",
        "data-observer-webgpu-initialization-attempts",
        "data-observer-renderer-failure-stage",
      ]) {
        if (mountedObserver[attribute] !== nativeQualification?.final[attribute]) {
          qualificationMismatches.push(`mounted native renderer changed before output evidence at ${attribute}`);
        }
      }
      if (!candidateDiagnosticSettled) {
        qualificationMismatches.push("material-aware output diagnostics did not reach an active, failed, or fallback state");
      }
      if (mountedObserver["data-observer-output-policy-selected"] !== "material-aware") {
        qualificationMismatches.push("the selected output policy was not material-aware");
      }
      const expectedOutputParameter = materialAwareDefaultRequest ? "unspecified" : "material-aware";
      if (mountedObserver["data-observer-output-policy-requested-param"] !== expectedOutputParameter) {
        qualificationMismatches.push(`the output policy request parameter was not ${expectedOutputParameter}`);
      }
      const expectedSelectionReason = materialAwareDefaultRequest
        ? "development-pilot-default"
        : "material-aware-selected";
      if (mountedObserver["data-observer-output-policy-selection-reason"] !== expectedSelectionReason) {
        qualificationMismatches.push(`the output policy selection reason was not ${expectedSelectionReason}`);
      }
      if (mountedObserver["data-observer-output-policy-installed"] !== "material-aware") {
        qualificationMismatches.push("the material-aware output policy was not installed");
      }
      if (mountedObserver["data-observer-output-policy-status"] !== "active") {
        qualificationMismatches.push("the material-aware output policy did not become active");
      }
      const inventory = parseMaterialInventory(mountedObserver["data-observer-material-inventory"]);
      if (!inventory) {
        qualificationMismatches.push("the runtime material inventory was missing or invalid");
      } else {
        if (inventory.sceneId !== "architecture-rise") {
          qualificationMismatches.push("the runtime material inventory was not for Architecture Rise");
        }
        if (inventory.unsupportedMaterialInstances !== 0) {
          qualificationMismatches.push(`the runtime inventory found ${String(inventory.unsupportedMaterialInstances)} unsupported material instances`);
        }
        if (Number(inventory.adaptedMaterialInstances) <= 0) {
          qualificationMismatches.push("the runtime inventory found no adapted material instances");
        }
        const families = Array.isArray(inventory.families)
          ? inventory.families as Array<Record<string, unknown>>
          : [];
        if (families.length === 0 || families.some((family) => family.status !== "supported")) {
          qualificationMismatches.push("one or more runtime material families were unsupported or absent");
        }
      }
    }
    const materialInventory = parseMaterialInventory(mountedObserver["data-observer-material-inventory"]);
    const canvasOutput = await observer.locator("canvas").evaluate((element, selectedBackend) => {
      const canvas = element as HTMLCanvasElement;
      if (selectedBackend === "webgl") {
        const context = canvas.getContext("webgl2");
        const attributes = context?.getContextAttributes();
        return {
          context: "webgl2",
          alpha: attributes?.alpha ?? null,
          premultipliedAlpha: attributes?.premultipliedAlpha ?? null,
          antialias: attributes?.antialias ?? null,
          preserveDrawingBuffer: attributes?.preserveDrawingBuffer ?? null,
          format: null,
          colorSpace: null,
          alphaMode: null,
          toneMappingMode: null,
        };
      }
      const context = canvas.getContext("webgpu") as GPUCanvasContext | null;
      const configuration = context?.getConfiguration();
      const toneMapping = (configuration as (typeof configuration & {
        toneMapping?: { mode?: string };
      }) | null)?.toneMapping;
      return {
        context: "webgpu",
        format: configuration?.format ?? null,
        colorSpace: configuration?.colorSpace ?? null,
        alphaMode: configuration?.alphaMode ?? null,
        toneMappingMode: toneMapping?.mode ?? null,
        alpha: null,
        premultipliedAlpha: null,
        antialias: null,
        preserveDrawingBuffer: null,
      };
    }, backend);
    if (backend === "webgpu" && requestedModuleUrls.length === 0) {
      qualificationMismatches.push("the explicit WebGPU route did not request the lazy WebGPU module");
    }
    if (backend === "webgl" && requestedModuleUrls.length > 0) {
      qualificationMismatches.push("the default WebGL route requested the lazy WebGPU module");
    }

    const groundGlass = page.getByTestId("ground-glass-rtt").first();
    await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 90_000 });
    const groundGlassEvidence = await groundGlass.evaluate((element) => {
      const canvas = element.querySelector("canvas");
      const context = canvas?.getContext("webgl2");
      return {
        contentful: element.getAttribute("data-rtt-final-contentful") === "true",
        renderer: context instanceof WebGL2RenderingContext
          ? context.getParameter(context.VERSION)
          : null,
        canvasCount: element.querySelectorAll("canvas").length,
      };
    });

    await observer.evaluate((element, payload) => {
      element.dispatchEvent(new CustomEvent(payload.event, { detail: payload.view }));
    }, {
      event: viewEvent,
      view: { position: [...architectureView.position], target: [...architectureView.target] },
    });
    await waitForFrames(page);

    const canonicalControls = await readCanonicalControls(page);
    const canvas = await observer.locator("canvas").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        cssWidth: rect.width,
        cssHeight: rect.height,
        backingWidth: (element as HTMLCanvasElement).width,
        backingHeight: (element as HTMLCanvasElement).height,
        dpr: window.devicePixelRatio,
      };
    });
    const captureConsistencyMismatches: string[] = [];
    const initialAttributes = await readAttributes(observer);
    for (const attribute of [
      "data-observer-renderer-status",
      "data-observer-renderer-generation",
      "data-observer-renderer-request",
      "data-observer-renderer-attempt",
      "data-observer-renderer-family",
      "data-observer-execution-backend",
      "data-observer-application-fallback",
      "data-observer-webgpu-initialization-attempts",
      "data-observer-renderer-failure-stage",
    ]) {
      if (initialAttributes[attribute] !== mountedObserver[attribute]) {
        captureConsistencyMismatches.push(`mounted renderer changed after qualification at ${attribute}`);
      }
    }
    if (canvas.dpr !== 1) captureConsistencyMismatches.push("device pixel ratio was not one");
    if (canvas.backingWidth <= 100) captureConsistencyMismatches.push("Observer canvas backing width was too small");
    if (canvas.backingHeight <= 100) captureConsistencyMismatches.push("Observer canvas backing height was too small");
    const overlayGeometry = {
      focusVertices: Number(initialAttributes["data-focus-overlay-vertices"] ?? 0),
      nearDofVertices: Number(initialAttributes["data-near-dof-overlay-vertices"] ?? 0),
      farDofVertices: Number(initialAttributes["data-far-dof-overlay-vertices"] ?? 0),
    };

    const captures: Partial<Record<StateName | "restored-no-overlays", CapturedState>> = {};
    for (const state of stateDefinitions) {
      await applyOverlayState(page, observer, state.focusPlane, state.dofPlanes);
      captures[state.name] = await captureState(page, observer, testInfo, backend, state.name);
    }
    await applyOverlayState(page, observer, false, false);
    captures["restored-no-overlays"] = await captureState(
      page,
      observer,
      testInfo,
      backend,
      "restored-no-overlays",
    );

    const camera = captures["no-overlays"];
    if (!camera) throw new Error("The no-overlay capture is missing");
    for (const [name, capture] of Object.entries(captures)) {
      if (!capture) continue;
      if (!vectorsMatch(capture.cameraPosition, architectureView.position)) {
        captureConsistencyMismatches.push(`${backend}/${name} camera position did not match the requested view`);
      }
      if (!vectorsMatch(capture.orbitTarget, architectureView.target)) {
        captureConsistencyMismatches.push(`${backend}/${name} orbit target did not match the requested view`);
      }
      if (JSON.stringify(capture.canvas) !== JSON.stringify(canvas)) {
        captureConsistencyMismatches.push(`${backend}/${name} canvas dimensions changed during the capture series`);
      }
      for (const attribute of [
        "data-observer-renderer-status",
        "data-observer-renderer-generation",
        "data-observer-renderer-request",
        "data-observer-renderer-attempt",
        "data-observer-renderer-family",
        "data-observer-execution-backend",
        "data-observer-application-fallback",
        "data-observer-webgpu-initialization-attempts",
        "data-observer-renderer-failure-stage",
      ]) {
        if (capture.attributes[attribute] !== initialAttributes[attribute]) {
          captureConsistencyMismatches.push(`${backend}/${name} mounted renderer changed at ${attribute}`);
        }
      }
    }

    const facadeRegion = projectArchitectureFacade(
      camera.image.width,
      camera.image.height,
      camera.cameraPosition,
      camera.orbitTarget,
    );
    const subjectEvidence = facadeRegion ? summarizePixelRegion(camera.image, facadeRegion) : null;

    const browserEvidence = {
      name: backend === "webgl" ? "Google Chrome (stable channel)" : "Google Chrome (stable channel)",
      version: browser.version(),
      userAgent: await page.evaluate(() => navigator.userAgent),
    };
    const adapter = {
      apiPresent: mountedObserver["data-observer-webgpu-api-present"] ?? null,
      availability: mountedObserver["data-observer-adapter-availability"] ?? null,
    };
    return {
      backend,
      mountedObserver,
      qualificationMismatches,
      nativeQualification,
      requestedModuleUrls,
      captureConsistencyMismatches,
      pageErrors,
      consoleErrors,
      browser: browserEvidence,
      adapter,
      canvasOutput,
      materialInventory,
      canonicalControls,
      canvas,
      camera: {
        position: camera.cameraPosition,
        target: camera.orbitTarget,
        fov: 45,
        near: 0.01,
        far: 200,
      },
      overlayGeometry,
      subjectEvidence: {
        region: facadeRegion,
        sampleCount: subjectEvidence?.sampleCount ?? null,
        distinctColorBuckets: subjectEvidence?.distinctColorBuckets ?? null,
        luminanceStandardDeviation: subjectEvidence?.luminanceStandardDeviation ?? null,
        meaningful: subjectRoiHasMeaningfulPixels(subjectEvidence),
      },
      groundGlass: groundGlassEvidence,
      captures,
    };
  } finally {
    await context.close();
  }
};

const requiredCapture = (
  capture: BackendCapture,
  name: StateName | "restored-no-overlays",
): CapturedState => {
  const result = capture.captures[name];
  if (!result) throw new Error(`Missing ${capture.backend} capture for ${name}`);
  return result;
};

const imageDifference = (
  first: DecodedPng,
  second: DecodedPng,
  region: PixelRegion,
): ImageDifferenceSummary | null => {
  try {
    return comparePixelRegions(first, second, region, 4);
  } catch {
    return null;
  }
};

const fullCanvasRegion = (image: DecodedPng): PixelRegion => ({
  left: 0,
  top: 0,
  right: image.width,
  bottom: image.height,
});

const backgroundStats = (image: DecodedPng): Record<string, RgbRegionSummary> =>
  Object.fromEntries(Object.entries(getBackgroundRegions(image.width, image.height))
    .map(([name, region]) => [name, summarizeRgbRegion(image, region)]));

const backgroundRegionIsUniform = (summary: RgbRegionSummary): boolean =>
  summary.pixelCount > 100 &&
  summary.standardDeviationRgb.every((value) => value <= 2.5);

const overlayStateMetrics = (capture: BackendCapture) => {
  const noOverlay = requiredCapture(capture, "no-overlays").image;
  const focus = requiredCapture(capture, "focus-plane-only").image;
  const dof = requiredCapture(capture, "dof-planes-only").image;
  const combined = requiredCapture(capture, "combined-overlays").image;
  return {
    focusOnly: contribution(noOverlay, focus, fullCanvasRegion(noOverlay)),
    dofOnly: contribution(noOverlay, dof, fullCanvasRegion(noOverlay)),
    combined: contribution(noOverlay, combined, fullCanvasRegion(noOverlay)),
    combinedBeyondFocus: contribution(focus, combined, fullCanvasRegion(noOverlay)),
    combinedBeyondDof: contribution(dof, combined, fullCanvasRegion(noOverlay)),
  };
};

const summarizeBackend = (capture: BackendCapture) => {
  const noOverlay = requiredCapture(capture, "no-overlays");
  const facadeRegion = projectArchitectureFacade(
    noOverlay.image.width,
    noOverlay.image.height,
    noOverlay.cameraPosition,
    noOverlay.orbitTarget,
  );
  const regions = getBackgroundRegions(noOverlay.image.width, noOverlay.image.height);
  const background = backgroundStats(noOverlay.image);
  const uniformBackgroundRegions = Object.entries(background)
    .filter(([, summary]) => backgroundRegionIsUniform(summary))
    .map(([name]) => name);
  const overlay = overlayStateMetrics(capture);
  const restoration = imageDifference(
    noOverlay.image,
    requiredCapture(capture, "restored-no-overlays").image,
    fullCanvasRegion(noOverlay.image),
  );
  return {
    backend: capture.backend,
    requestedRenderer: capture.mountedObserver["data-observer-renderer-request"],
    selectionReason: capture.mountedObserver["data-observer-selection-reason"],
    rendererFamily: capture.mountedObserver["data-observer-renderer-family"],
    executionBackend: capture.mountedObserver["data-observer-execution-backend"],
    applicationFallback: capture.mountedObserver["data-observer-application-fallback"],
    initializationAttempts: capture.mountedObserver["data-observer-webgpu-initialization-attempts"] ?? "0",
    adapter: capture.adapter,
    canvasOutput: capture.canvasOutput,
    camera: capture.camera,
    canvas: capture.canvas,
    canonicalControls: capture.canonicalControls,
    renderSettings: {
      toneMapping: capture.mountedObserver["data-observer-tone-mapping"],
      exposure: capture.mountedObserver["data-observer-tone-mapping-exposure"],
      outputColorSpace: capture.mountedObserver["data-observer-output-color-space"],
      shadowMapStatus: capture.mountedObserver["data-observer-shadow-map-status"],
      shadowMapType: capture.mountedObserver["data-observer-shadow-map-type"],
    },
    outputPolicy: {
      requested: capture.mountedObserver["data-observer-output-policy-requested"] ?? null,
      selected: capture.mountedObserver["data-observer-output-policy-selected"] ?? null,
      selectionReason: capture.mountedObserver["data-observer-output-policy-selection-reason"] ?? null,
      installed: capture.mountedObserver["data-observer-output-policy-installed"] ?? null,
      status: capture.mountedObserver["data-observer-output-policy-status"] ?? null,
      failure: capture.mountedObserver["data-observer-output-policy-failure"] ?? null,
      materialInventory: capture.materialInventory,
    },
    overlayGeometry: capture.overlayGeometry,
    overlayContract,
    background: {
      authoredHex: "#f8fafc",
      authoredRgb: authoredBackgroundRgb,
      samples: background,
      uniformRegions: uniformBackgroundRegions,
      comparedRegions: Object.fromEntries(uniformBackgroundRegions.map((name) => [name, regions[name]])),
      subjectRoi: facadeRegion,
      subjectPixels: facadeRegion ? summarizePixelRegion(noOverlay.image, facadeRegion) : null,
      subjectEvidence: capture.subjectEvidence,
    },
    overlayContribution: overlay,
    restoredNoOverlayImage: restoration,
    groundGlass: capture.groundGlass,
    requestedWebGpuModuleUrls: capture.requestedModuleUrls,
    pageErrors: capture.pageErrors,
    consoleErrors: capture.consoleErrors,
    captures: Object.fromEntries(Object.keys(capture.captures).map((name) => {
      const image = capture.captures[name as StateName | "restored-no-overlays"];
      return [name, image ? {
        cameraPosition: image.cameraPosition,
        orbitTarget: image.orbitTarget,
        canvas: image.canvas,
        overlayVisibility: {
          focusPlane: image.attributes["data-focus-overlay-visible"],
          dofPlanes: image.attributes["data-dof-overlay-visible"],
          opticalGeometry: image.attributes["data-optical-geometry-visible"],
        },
        screenshot: `observer-parity-${capture.backend}-${name}.png`,
      } : null];
    })),
  };
};

const compareOverlayStateAcrossBackends = (
  webgl: BackendCapture,
  webgpu: BackendCapture,
  focusPlane: boolean,
  dofPlanes: boolean,
) => {
  const stateName = stateDefinitions.find((state) =>
    state.focusPlane === focusPlane && state.dofPlanes === dofPlanes,
  )?.name;
  if (!stateName) throw new Error("Requested overlay comparison state was not captured");
  const webglState = requiredCapture(webgl, stateName);
  const webgpuState = requiredCapture(webgpu, stateName);
  const full = fullCanvasRegion(webglState.image);
  const subjectRegion = projectArchitectureFacade(
    webglState.image.width,
    webglState.image.height,
    webglState.cameraPosition,
    webglState.orbitTarget,
  );
  const backgroundRegions = getBackgroundRegions(webglState.image.width, webglState.image.height);
  const webglBaselineImage = requiredCapture(webgl, "no-overlays").image;
  const webgpuBaselineImage = requiredCapture(webgpu, "no-overlays").image;
  const webglBackground = backgroundStats(webglBaselineImage);
  const webgpuBackground = backgroundStats(webgpuBaselineImage);
  const baselineCleanBackgroundReferenceRegions = Object.fromEntries(Object.entries(backgroundRegions).map(([name, region]) => {
    const webglSummary = webglBackground[name];
    const webgpuSummary = webgpuBackground[name];
    const eligible = Boolean(
      webglSummary && webgpuSummary &&
      backgroundRegionIsUniform(webglSummary) && backgroundRegionIsUniform(webgpuSummary),
    );
    const comparison = eligible
      ? compareBaselineAndCompositedRegion(
        webglBaselineImage,
        webgpuBaselineImage,
        webglBaselineImage,
        webgpuBaselineImage,
        region,
      )
      : null;
    return [name, {
      eligible,
      reason: eligible ? undefined : "region is not stable and uniform in both no-overlay baseline captures",
      pixelCount: eligible ? Math.min(webglSummary?.pixelCount ?? 0, webgpuSummary?.pixelCount ?? 0) : null,
      webgl: webglSummary ?? null,
      webgpu: webgpuSummary ?? null,
      difference: comparison?.baselineDifference ?? null,
    }];
  }));
  const stateCompositedBackgroundRegions = Object.fromEntries(Object.entries(backgroundRegions).map(([name, region]) => {
    const baselineReference = baselineCleanBackgroundReferenceRegions[name];
    const comparison = baselineReference?.eligible
      ? compareBaselineAndCompositedRegion(
        webglBaselineImage,
        webgpuBaselineImage,
        webglState.image,
        webgpuState.image,
        region,
      )
      : null;
    return [name, {
      eligible: baselineReference?.eligible ?? false,
      reason: baselineReference?.reason,
      difference: comparison?.compositedDifference ?? null,
    }];
  }));
  return {
    stateName,
    wholeCanvas: imageDifference(webglState.image, webgpuState.image, full),
    subjectRoi: subjectRegion ? imageDifference(webglState.image, webgpuState.image, subjectRegion) : null,
    baselineCleanBackgroundReferenceRegions,
    stateCompositedBackgroundRegions,
  };
};

const compareOverlayResponse = (webgl: BackendCapture, webgpu: BackendCapture) => {
  const webglOff = requiredCapture(webgl, "no-overlays").image;
  const webgpuOff = requiredCapture(webgpu, "no-overlays").image;
  const subjectRoi = projectArchitectureFacade(
    webglOff.width,
    webglOff.height,
    requiredCapture(webgl, "no-overlays").cameraPosition,
    requiredCapture(webgl, "no-overlays").orbitTarget,
  );
  const backgroundRegions = getBackgroundRegions(webglOff.width, webglOff.height);
  const compare = (stateName: StateName) => {
    const webglOn = requiredCapture(webgl, stateName).image;
    const webgpuOn = requiredCapture(webgpu, stateName).image;
    const compareIn = (region: PixelRegion) => compareOverlayResponsesSafely(
      webglOff,
      webglOn,
      webgpuOff,
      webgpuOn,
      region,
    );
    return {
      wholeCanvas: compareIn(fullCanvasRegion(webglOff)),
      subjectRoi: subjectRoi ? compareIn(subjectRoi) : null,
      backgroundRegions: Object.fromEntries(Object.entries(backgroundRegions).map(([name, region]) => [
        name,
        compareIn(region),
      ])),
    };
  };
  return {
    focusOnly: compare("focus-plane-only"),
    dofOnly: compare("dof-planes-only"),
    combined: compare("combined-overlays"),
  };
};

test.describe("Observer Architecture Rise background and overlay parity", () => {
  test.skip(!enabled, "Opt-in visual verification: set OBSERVER_VISUAL_PARITY_REQUIRED=1 with the headed Chrome benchmark config.");
  test.skip(!nativeRequired, "Requires the explicitly qualified native-WebGPU Chrome run.");
  test.describe.configure({ mode: "serial" });

  test("captures matched WebGL and native WebGPU backgrounds and teaching overlays", async ({ browser }, testInfo) => {
    test.setTimeout(12 * 60 * 1000);
    const webgl = await captureBackend(browser, "webgl", testInfo);
    const webgpu = await captureBackend(browser, "webgpu", testInfo);

    const webglSummary = summarizeBackend(webgl);
    const webgpuSummary = summarizeBackend(webgpu);

    const overlayResponse = compareOverlayResponse(webgl, webgpu);
    const crossBackendByState = Object.fromEntries(stateDefinitions.map((state) => [
      state.name,
      compareOverlayStateAcrossBackends(webgl, webgpu, state.focusPlane, state.dofPlanes),
    ]));
    const baselineState = crossBackendByState["no-overlays"];
    const baselineBackgroundRegions: Record<string, BackgroundReferenceEvidence> = Object.fromEntries(
      Object.entries(baselineState?.baselineCleanBackgroundReferenceRegions ?? {}).map(([name, evidence]) => [name, {
        eligible: evidence.eligible,
        reason: evidence.reason,
        pixelCount: evidence.pixelCount,
        baselineDifference: evidence.difference,
      }]),
    );
    const compositedStates: Record<string, CompositedStateEvidence> = Object.fromEntries(
      Object.entries(crossBackendByState).map(([stateName, evidence]) => [stateName, {
        wholeCanvas: evidence.wholeCanvas,
        subjectRoi: evidence.subjectRoi,
        backgroundRegions: Object.fromEntries(
          Object.entries(evidence.stateCompositedBackgroundRegions).map(([name, region]) => [name, {
            eligible: region.eligible,
            reason: region.reason,
            difference: region.difference,
          }]),
        ),
      }]),
    );
    const parityAcceptance = evaluateVisualParityAcceptance({
      baselineBackgroundRegions,
      compositedStates,
      overlayContribution: overlayResponse as Record<string, OverlayResponseState>,
      subjectEvidence: {
        webgl: webgl.subjectEvidence,
        webgpu: webgpu.subjectEvidence,
      },
      overlayGeometry: {
        webgl: webgl.overlayGeometry,
        webgpu: webgpu.overlayGeometry,
      },
      restoredNoOverlay: {
        webgl: webglSummary.restoredNoOverlayImage,
        webgpu: webgpuSummary.restoredNoOverlayImage,
      },
      consistency: {
        webgl: webgl.captureConsistencyMismatches.length === 0,
        webgpu: webgpu.captureConsistencyMismatches.length === 0,
      },
    });
    const captureValidityChecks = [
      { id: "webgl-mounted-backend", passed: webgl.qualificationMismatches.length === 0, details: webgl.qualificationMismatches },
      { id: "native-webgpu-mounted-backend", passed: webgpu.qualificationMismatches.length === 0, details: webgpu.qualificationMismatches },
      { id: "webgl-standard-output-policy", passed: webgl.mountedObserver["data-observer-output-policy-selected"] === "standard" && webgl.mountedObserver["data-observer-output-policy-installed"] === "standard", details: { selected: webgl.mountedObserver["data-observer-output-policy-selected"], installed: webgl.mountedObserver["data-observer-output-policy-installed"] } },
      { id: `webgpu-${materialAwareCandidate ? "material-aware" : "standard"}-output-policy`, passed: webgpu.mountedObserver["data-observer-output-policy-selected"] === (materialAwareCandidate ? "material-aware" : "standard") && webgpu.mountedObserver["data-observer-output-policy-installed"] === (materialAwareCandidate ? "material-aware" : "standard") && (!materialAwareCandidate || webgpu.mountedObserver["data-observer-output-policy-status"] === "active"), details: { selected: webgpu.mountedObserver["data-observer-output-policy-selected"], installed: webgpu.mountedObserver["data-observer-output-policy-installed"], status: webgpu.mountedObserver["data-observer-output-policy-status"] ?? null } },
      { id: "webgl-capture-stability", passed: webgl.captureConsistencyMismatches.length === 0, details: webgl.captureConsistencyMismatches },
      { id: "webgpu-capture-stability", passed: webgpu.captureConsistencyMismatches.length === 0, details: webgpu.captureConsistencyMismatches },
      { id: "matched-canvas-dimensions", passed: JSON.stringify(webgl.canvas) === JSON.stringify(webgpu.canvas), details: { webgl: webgl.canvas, webgpu: webgpu.canvas } },
      { id: "matched-observer-camera", passed: JSON.stringify(webgl.camera) === JSON.stringify(webgpu.camera), details: { webgl: webgl.camera, webgpu: webgpu.camera } },
      { id: "matched-canonical-controls", passed: JSON.stringify(webgl.canonicalControls) === JSON.stringify(webgpu.canonicalControls), details: null },
      { id: "webgl-subject-visible", passed: webgl.subjectEvidence.meaningful, details: webgl.subjectEvidence },
      { id: "webgpu-subject-visible", passed: webgpu.subjectEvidence.meaningful, details: webgpu.subjectEvidence },
      { id: "webgl-ground-glass", passed: webgl.groundGlass.contentful && webgl.groundGlass.renderer?.includes("WebGL 2") === true && webgl.groundGlass.canvasCount === 1, details: webgl.groundGlass },
      { id: "webgpu-ground-glass", passed: webgpu.groundGlass.contentful && webgpu.groundGlass.renderer?.includes("WebGL 2") === true && webgpu.groundGlass.canvasCount === 1, details: webgpu.groundGlass },
      { id: "webgl-no-page-or-console-errors", passed: webgl.pageErrors.length === 0 && webgl.consoleErrors.length === 0, details: { pageErrors: webgl.pageErrors, consoleErrors: webgl.consoleErrors } },
      { id: "webgpu-no-page-or-console-errors", passed: webgpu.pageErrors.length === 0 && webgpu.consoleErrors.length === 0, details: { pageErrors: webgpu.pageErrors, consoleErrors: webgpu.consoleErrors } },
    ];
    const captureValidity = {
      status: captureValidityChecks.every((check) => check.passed) ? "pass" as const : "fail" as const,
      checks: captureValidityChecks,
      failures: captureValidityChecks.filter((check) => !check.passed),
    };
    const result = {
      schemaVersion: 2,
      phase: baselineOnly ? "baseline-capture-only" : "strict-verification",
      generatedAt: new Date().toISOString(),
      host: { platform: platform(), architecture: arch(), osRelease: release(), node: process.version },
      browser: webgl.browser,
      browserVersion: webgpu.browser.version,
      threeRevision: REVISION,
      sceneId: "architecture-rise",
      route: {
        webgl: "/simulator/free/architecture-rise?rttDiagnostics=1",
        webgpu: `/simulator/free/architecture-rise?observerRenderer=webgpu${materialAwareCandidate
          ? materialAwareDefaultRequest ? "" : "&observerOutput=material-aware"
          : "&observerOutput=standard"}&rttDiagnostics=1`,
      },
      outputPolicyExperiment: {
        requested: requestedOutputPolicy,
        requestedParameter: materialAwareCandidate
          ? materialAwareDefaultRequest ? "unspecified" : "material-aware"
          : "standard",
        selectedForWebGpuRoute: webgpu.mountedObserver["data-observer-output-policy-selected"] ?? null,
        installedOnWebGpuRoute: webgpu.mountedObserver["data-observer-output-policy-installed"] ?? null,
        status: webgpu.mountedObserver["data-observer-output-policy-status"] ?? null,
        materialInventory: webgpu.materialInventory,
      },
      camera: {
        requestedAndObserved: architectureView,
        fov: 45,
        near: 0.01,
        far: 200,
        dpr: 1,
      },
      canonicalControlsMatched: JSON.stringify(webgl.canonicalControls) === JSON.stringify(webgpu.canonicalControls),
      authoredBackground: { hex: "#f8fafc", rgb: authoredBackgroundRgb },
      renderSettings: {
        webgl: webglSummary.renderSettings,
        webgpu: webgpuSummary.renderSettings,
      },
      canvasOutput: { webgl: webgl.canvasOutput, webgpu: webgpu.canvasOutput },
      overlayContract,
      backendQualification: {
        webgl: {
          family: webglSummary.rendererFamily,
          executionBackend: webglSummary.executionBackend,
          applicationFallback: webglSummary.applicationFallback,
          webgpuModuleRequestCount: webgl.requestedModuleUrls.length,
          mismatches: webgl.qualificationMismatches,
        },
        webgpu: {
          apiPresent: webgpu.adapter.apiPresent,
          adapterAvailability: webgpu.adapter.availability,
          family: webgpuSummary.rendererFamily,
          executionBackend: webgpuSummary.executionBackend,
          applicationFallback: webgpuSummary.applicationFallback,
          initializationAttempts: webgpuSummary.initializationAttempts,
          webgpuModuleRequestCount: webgpu.requestedModuleUrls.length,
          adapterProbe: webgpu.nativeQualification,
          mismatches: webgpu.qualificationMismatches,
        },
        hardwareAcceleration: "unconfirmed",
      },
      captureValidity,
      strictParityAcceptance: {
        enforcement: baselineOnly ? "diagnostic-only" : "required",
        ...parityAcceptance,
      },
      webgl: webglSummary,
      webgpu: webgpuSummary,
      visualComparisons: {
        definitions: {
          baselineBackgroundParity: "Cross-backend difference between the matched no-overlay captures, measured only in regions uniform in both captures.",
          stateCompositedPixelParity: "Cross-backend difference between each state's actual selected WebGL and WebGPU captures; clean regions are selected using no-overlay baselines only.",
          overlayContributionResponse: "Per-backend overlay-on minus that backend's own no-overlay image, then compare the incremental responses and changed-pixel masks.",
        },
        baselineBackgroundParity: baselineState?.baselineCleanBackgroundReferenceRegions ?? {},
        stateCompositedPixelParity: crossBackendByState,
        overlayContributionResponse: overlayResponse,
      },
      groundGlass: { webgl: webgl.groundGlass, webgpu: webgpu.groundGlass },
      errors: {
        webgl: { page: webgl.pageErrors, console: webgl.consoleErrors },
        webgpu: { page: webgpu.pageErrors, console: webgpu.consoleErrors },
      },
      limitations: [
        "Screenshots capture the actual Observer canvas; values are display-space PNG samples.",
        "Pixel differences are diagnostic and do not replace visual teaching-use review.",
        "Hardware acceleration is unconfirmed; mounted WebGPU API execution does not identify the selected adapter type.",
      ],
    };

    const report = JSON.stringify(result, null, 2);
    const reportPath = testInfo.outputPath("observer-visual-parity.json");
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, report);
    await testInfo.attach("observer-visual-parity.json", {
      body: Buffer.from(report),
      contentType: "application/json",
    });
    console.info(`Observer visual parity evidence: capture=${captureValidity.status}, strict-parity=${parityAcceptance.status}, failing-criteria=${parityAcceptance.failures.length}, report=${reportPath}`);

    expect(captureValidity.status, `invalid capture evidence: ${captureValidity.failures.map((failure) => failure.id).join(", ")}`)
      .toBe("pass");
    if (!baselineOnly) {
      expect(parityAcceptance.status, `strict parity criteria failed: ${parityAcceptance.failures.map((failure) => failure.id).join(", ")}`)
        .toBe("pass");
    }
  });
});
