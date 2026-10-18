import { createServer } from "vite";
import { expect, test, type Browser, type Page } from "@playwright/test";
import type { AddressInfo } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

type Version = "r184" | "r185" | "r186";
type Backend = "webgl" | "webgpu";
type Output = "stock" | "material-aware";
type Fixture = "F0" | "F1" | "F2";
type Family = "basic" | "standard";
type Background = "light" | "dark" | "transparent" | "clear";
type Condition = Readonly<{ fixture: Fixture; opacity: number; background: Background }>;
type Pixel = [number, number, number, number];
type MaterialDescription = {
  transparent: boolean;
  blending: number;
  depthTest: boolean;
  depthWrite: boolean;
  premultipliedAlpha: boolean;
  toneMapped: boolean;
  forceSinglePass: boolean;
  sourceFamily: Family;
  blendSrc: number;
  blendDst: number;
};
type RendererSummary = {
  requestedBackend: Backend;
  requestedOutput: Output;
  rendererFamily: string;
  backendName: string;
  nativeContextApi: string | null;
  executionBackend: string;
  revision: string;
  outputColorSpace: string;
  toneMapping: string;
  toneMappingExposure: number;
  canvas: { width: number; height: number };
  requestedContextOptions: { alpha: boolean; premultipliedAlpha: boolean; antialias: boolean };
  context: {
    webglAttributes: WebGLContextAttributes | null;
    webgpu: { format: string | null; alphaMode: string | null; colorSpace: string | null; usage: number | null } | null;
    webgpuAlphaModeObservable: string | null;
    htmlCanvasReadbackIsRawFramebuffer: boolean;
  };
};
type FixtureEvidence = {
  fixture: Fixture;
  objectNames: string[];
  camera: {
    type: string;
    position: number[];
    quaternion: number[];
    left: number;
    right: number;
    top: number;
    bottom: number;
    near: number;
    far: number;
  };
  resolution: { width: number; height: number; deviceScaleFactor: number };
  centerIntersectionCount: number;
  centerIntersections: Array<{ object: string; distance: number; point: number[] }>;
  materialDescriptions: MaterialDescription[];
};
type DrawObservation = { name: string; renderOrder: number; z: number };
type CaptureConditionMetadata = {
  fixture: Fixture;
  family: Family;
  opacity: number;
  transparent: boolean;
  requestedBackground: Background;
  requestedClearAlpha: number;
  cssBackground: string;
  imageRepresentation: string;
  opaqueBackgroundSentinel: string | null;
  canvasAlphaIndependentlyRead: boolean;
  pageCompositorCanAffectScreenshot: boolean;
  opaqueBackgroundSentinelAbsent?: boolean;
  opaqueCanvasPresentationQualified?: boolean | null;
};
type PresentationSamples = {
  background: Pixel;
  center: Pixel;
  left: Pixel;
  right: Pixel;
  checkerA: Pixel;
  checkerB: Pixel;
};
type CaptureMetadata = RendererSummary & {
  condition: CaptureConditionMetadata;
  fixtureEvidence: FixtureEvidence;
  draws: {
    rendererInfoRenderCalls: number;
    rendererDrawCounterName: string;
    rendererDrawCalls: number;
    rendererInfoRenderCallsBefore: number;
    rendererInfoRenderCallsAfter: number;
    rendererDrawCounterBefore: number;
    rendererDrawCounterAfter: number;
    onBeforeRenderOrder: DrawObservation[];
  };
  materialDescriptions: MaterialDescription[];
  ownedResourceIds: { materials: string[]; geometry: string[] };
  disposalEventCountAtCapture: number;
  samples?: PresentationSamples;
};
type ImageMetrics = {
  sampleCount: number;
  rgbMAE: number;
  perChannelAbsoluteMAE: number[];
  perChannelSignedMean: number[];
  maxChannelDifference: number;
  rgbChangedPixels: number;
  rgbaChangedPixels: number;
  alphaMAE: number;
};
type RegionMetrics = Record<"full" | "background" | "subject" | "overlap" | "leftNonOverlap" | "rightNonOverlap", ImageMetrics>;
type CapturePixels = Readonly<{ metadata: CaptureMetadata; pixels: Buffer }>;
type Capture = CapturePixels & Readonly<{ repeated: ImageMetrics }>;
type CleanupResult = {
  rendererDisposed: boolean;
  disposalEvents: Array<{ uuid: string; kind: "material" | "geometry"; count: number }>;
  ownedResourceRecords: Array<{ uuid: string; kind: "material" | "geometry"; count: number }>;
  allOwnedDisposalsExactlyOnce: boolean;
};
type VersionProvenance = { packageVersion: string; runtimeRevision: string | null; lockfileResolution: boolean };
type Evidence = {
  schemaVersion: number;
  provenance: {
    requiredBase: string;
    versions: Partial<Record<Version, VersionProvenance>>;
    browser: { name: string; userAgent: string } | null;
    operatingSystem: { platform: string; release: string; architecture: string };
    hardwareAccelerationIndependentlyVerified: boolean;
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
    imageRepresentation: string;
    screenshots: string[];
  };
  captures: Array<{ key: string; metadata: CaptureMetadata; repeat: ImageMetrics }>;
  comparisons: Array<{ name: string; fixture: Fixture; representation: string; metrics: RegionMetrics }>;
  repeatability: Array<{ key: string; result: "unstable" | "pixel-identical"; metrics: ImageMetrics }>;
  opacityResponse: Array<{
    version: Version;
    mode: string;
    fixture: Fixture;
    family?: Family;
    o0ToO1: RegionMetrics;
    o0ToO2: RegionMetrics;
    alphaRemainsMaterialClassification: boolean;
  }>;
  backgroundResponse: Array<{ version: Version; mode: string; fixture: Fixture; metrics: RegionMetrics }>;
  cleanup: Array<{ version: Version; backend: Backend; output: Output; fixture: Fixture } & CleanupResult>;
  negativeControls: Array<{ name: string; status: string }>;
};
const evidence: Evidence = {
  schemaVersion: 1,
  provenance: {
    requiredBase: "5d88d8f629b062bb1177b68616b86204d5dc152f",
    versions: {},
    browser: null,
    operatingSystem: { platform: process.platform, release: os.release(), architecture: os.arch() },
    hardwareAccelerationIndependentlyVerified: false,
    viewport: { width: 320, height: 320 },
    deviceScaleFactor: 1,
    imageRepresentation: "Browser viewport PNG presentation screenshot including page compositor contribution. It is not a raw framebuffer or fragment-alpha readback.",
    screenshots: [],
  },
  captures: [],
  comparisons: [],
  repeatability: [],
  opacityResponse: [],
  backgroundResponse: [],
  cleanup: [],
  negativeControls: [],
};

declare global {
  interface Window {
    __runCondition?: (condition: Condition) => Promise<{ metadata: CaptureMetadata }>;
    __disposeFixture?: () => Promise<CleanupResult>;
    __initialRenderer?: RendererSummary;
    __fixtureErrors?: string[];
  }
}

const experimentRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(experimentRoot, "../..");
const sharedRoot = path.join(experimentRoot, "shared");
const versions: readonly Version[] = ["r184", "r185", "r186"];
const opacities = [0.16, 0.5, 1] as const;
const pixelsByKey = new Map<string, Capture>();

const caseKey = (
  version: Version,
  backend: Backend,
  output: Output,
  fixture: Fixture,
  family: Family,
  opacity: number,
  background: Background,
) => [version, backend, output, fixture, family, opacity.toFixed(2), background].join("/");

const makeVersionServer = async (version: Version) => {
  const packageRoot = path.join(experimentRoot, "versions", version, "node_modules/three");
  const pkg = JSON.parse(await readFile(path.join(experimentRoot, "versions", version, "package.json"), "utf8")) as {
    dependencies: { three: string };
  };
  const lock = JSON.parse(await readFile(path.join(experimentRoot, "versions", version, "package-lock.json"), "utf8")) as {
    packages: { "node_modules/three": { version: string } };
  };
  const packageVersion = pkg.dependencies.three;
  const lockVersion = lock.packages["node_modules/three"].version;
  expect(packageVersion, `${version} exact manifest dependency`).toBe(`0.${version.slice(1)}.0`);
  expect(lockVersion, `${version} lock resolution`).toBe(packageVersion);
  const server = await createServer({
    configFile: false,
    root: sharedRoot,
    appType: "mpa",
    logLevel: "error",
    server: {
      host: "127.0.0.1",
      port: 0,
      strictPort: false,
      hmr: false,
      fs: { allow: [repositoryRoot] },
    },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: {
      alias: [
        { find: /^three\/webgpu$/, replacement: path.join(packageRoot, "build/three.webgpu.js") },
        { find: /^three\/tsl$/, replacement: path.join(packageRoot, "build/three.tsl.js") },
        { find: /^three$/, replacement: path.join(packageRoot, "build/three.module.js") },
      ],
    },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error(`Vite did not bind an address for ${version}`);
  return { server, url: `http://127.0.0.1:${(address as AddressInfo).port}/`, packageVersion };
};

const capturePixels = async (page: Page, condition: Condition): Promise<CapturePixels> => {
  const result = await page.evaluate(async (nextCondition) => {
    if (typeof window.__runCondition !== "function") throw new Error("Fixture runner is not ready");
    return window.__runCondition(nextCondition);
  }, condition);
  const png = await page.screenshot({ type: "png", animations: "disabled" });
  return { metadata: result.metadata, pixels: decodePng(png) };
};

const decodePng = (png: Buffer): Buffer => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!png.subarray(0, 8).equals(signature)) throw new Error("Browser screenshot is not a PNG");
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const imageData: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
    } else if (type === "IDAT") {
      imageData.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (width !== 320 || height !== 320 || bitDepth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) {
    throw new Error(`Unsupported browser screenshot PNG: ${width}x${height}, depth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }
  const source = inflateSync(Buffer.concat(imageData));
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const reconstructed = Buffer.alloc(height * stride);
  const paeth = (left: number, up: number, upperLeft: number) => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
    return upDistance <= upperLeftDistance ? up : upperLeft;
  };
  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * (stride + 1);
    const filter = source[sourceOffset] ?? 0;
    for (let x = 0; x < stride; x += 1) {
      const raw = source[sourceOffset + 1 + x] ?? 0;
      const left = x >= bytesPerPixel ? reconstructed[y * stride + x - bytesPerPixel] ?? 0 : 0;
      const up = y > 0 ? reconstructed[(y - 1) * stride + x] ?? 0 : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? reconstructed[(y - 1) * stride + x - bytesPerPixel] ?? 0
        : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upperLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      reconstructed[y * stride + x] = (raw + predictor) & 0xff;
    }
  }
  if (colorType === 6) return reconstructed;
  const rgba = Buffer.alloc(width * height * 4, 255);
  for (let sourceOffset = 0, targetOffset = 0; sourceOffset < reconstructed.length; sourceOffset += 3, targetOffset += 4) {
    rgba[targetOffset] = reconstructed[sourceOffset] ?? 0;
    rgba[targetOffset + 1] = reconstructed[sourceOffset + 1] ?? 0;
    rgba[targetOffset + 2] = reconstructed[sourceOffset + 2] ?? 0;
  }
  return rgba;
};

const sampleRgba = (pixels: Buffer, x: number, y: number) => {
  const offset = (y * 320 + x) * 4;
  return [pixels[offset] ?? 0, pixels[offset + 1] ?? 0, pixels[offset + 2] ?? 0, pixels[offset + 3] ?? 0] as Pixel;
};

const roiDefinitions = (fixture: Fixture) => ({
  full: { x: 0, y: 0, width: 320, height: 320 },
  background: { x: 8, y: 8, width: 48, height: 48 },
  subject: fixture === "F0"
    ? { x: 72, y: 60, width: 176, height: 200 }
    : fixture === "F1"
      ? { x: 88, y: 60, width: 144, height: 200 }
      : { x: 56, y: 60, width: 208, height: 200 },
  overlap: fixture === "F0"
    ? { x: 104, y: 92, width: 112, height: 136 }
    : { x: 104, y: 92, width: 112, height: 136 },
  leftNonOverlap: { x: 50, y: 120, width: 32, height: 64 },
  rightNonOverlap: { x: 238, y: 120, width: 32, height: 64 },
});

const measure = (left: Buffer, right: Buffer, roi: { x: number; y: number; width: number; height: number }) => {
  const channelAbsolute = [0, 0, 0, 0];
  const channelSigned = [0, 0, 0, 0];
  let maxChannelDifference = 0;
  let rgbChangedPixels = 0;
  let rgbaChangedPixels = 0;
  let sampleCount = 0;
  for (let y = roi.y; y < roi.y + roi.height; y += 1) {
    for (let x = roi.x; x < roi.x + roi.width; x += 1) {
      const offset = (y * 320 + x) * 4;
      let rgbPixelChanged = false;
      let rgbaPixelChanged = false;
      for (let channel = 0; channel < 4; channel += 1) {
        const difference = (right[offset + channel] ?? 0) - (left[offset + channel] ?? 0);
        channelAbsolute[channel]! += Math.abs(difference);
        channelSigned[channel]! += difference;
        maxChannelDifference = Math.max(maxChannelDifference, Math.abs(difference));
        if (difference !== 0) rgbaPixelChanged = true;
        if (channel < 3 && difference !== 0) rgbPixelChanged = true;
      }
      if (rgbPixelChanged) rgbChangedPixels += 1;
      if (rgbaPixelChanged) rgbaChangedPixels += 1;
      sampleCount += 1;
    }
  }
  const rgbMAE = channelAbsolute.slice(0, 3).reduce((sum, value) => sum + value, 0) / (sampleCount * 3);
  return {
    sampleCount,
    rgbMAE: Number(rgbMAE.toFixed(6)),
    perChannelAbsoluteMAE: channelAbsolute.map((sum) => Number((sum / sampleCount).toFixed(6))),
    perChannelSignedMean: channelSigned.map((sum) => Number((sum / sampleCount).toFixed(6))),
    maxChannelDifference,
    rgbChangedPixels,
    rgbaChangedPixels,
    alphaMAE: Number((channelAbsolute[3]! / sampleCount).toFixed(6)),
  };
};

const compareCaptures = (left: CapturePixels, right: CapturePixels, fixture: Fixture): RegionMetrics => {
  const rois = roiDefinitions(fixture);
  return Object.fromEntries(Object.entries(rois).map(([name, roi]) => [name, measure(left.pixels, right.pixels, roi)])) as RegionMetrics;
};

const summarizeMode = (backend: Backend, output: Output): string =>
  output === "material-aware" ? "A" : backend === "webgl" ? "G" : "W";

const runGroup = async (
  browser: Browser,
  version: Version,
  serverUrl: string,
  backend: Backend,
  output: Output,
  fixture: Fixture,
  family: Family,
  conditions: readonly Condition[],
) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 320 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const entry = output === "material-aware" ? "adapter.html" : "index.html";
  const url = new URL(entry, serverUrl);
  url.searchParams.set("backend", backend);
  url.searchParams.set("family", family);
  await page.goto(url.toString(), { waitUntil: "networkidle" });
  await page.waitForFunction(() => ["ready", "error"].includes(document.documentElement.dataset.fixtureState ?? ""));
  const state = await page.locator("html").getAttribute("data-fixture-state");
  if (state !== "ready") {
    const errors = await page.evaluate(() => window.__fixtureErrors ?? []);
    await context.close();
    throw new Error(`${version}/${backend}/${output} fixture failed to initialize: ${JSON.stringify(errors)}`);
  }
  const initial = await page.evaluate(() => {
    if (!window.__initialRenderer) throw new Error("Renderer metadata is unavailable");
    return window.__initialRenderer;
  });
  expect(initial.revision, `${version} runtime revision`).toBe(version.slice(1));
  expect(initial.executionBackend, `${version}/${backend}/${output} execution backend`).toBe(backend === "webgpu" ? "webgpu" : "webgl2");
  expect(initial.rendererFamily).toBe(backend === "webgpu" ? "WebGPURenderer" : "WebGLRenderer");
  expect(initial.canvas).toEqual({ width: 320, height: 320 });
  expect(initial.requestedContextOptions).toEqual({ alpha: true, premultipliedAlpha: true, antialias: false });
  expect(initial.outputColorSpace).toBe(output === "material-aware" ? "srgb-linear" : "srgb");
  expect(initial.toneMapping).toBe(output === "material-aware" ? "NoToneMapping" : "ACESFilmicToneMapping");
  evidence.provenance.versions[version] = {
    packageVersion: version === "r184" ? "0.184.0" : version === "r185" ? "0.185.0" : "0.186.0",
    runtimeRevision: initial.revision,
    lockfileResolution: initial.revision === version.slice(1),
  };

  for (const condition of conditions) {
    const first = await capturePixels(page, condition);
    const second = await capturePixels(page, condition);
    const repeat = compareCaptures(first, second, fixture).full;
    const key = caseKey(version, backend, output, fixture, family, condition.opacity, condition.background);
    const capture: Capture = { metadata: second.metadata, pixels: second.pixels, repeated: repeat };
    const samples: PresentationSamples = {
      background: sampleRgba(second.pixels, 20, 20),
      center: sampleRgba(second.pixels, 160, 160),
      left: sampleRgba(second.pixels, 70, 160),
      right: sampleRgba(second.pixels, 250, 160),
      checkerA: sampleRgba(second.pixels, 8, 8),
      checkerB: sampleRgba(second.pixels, 24, 8),
    };
    second.metadata.samples = samples;
    if (condition.background !== "transparent") {
      const [red, green, blue] = samples.background;
      const sentinelAbsent = green < Math.max(red, blue);
      second.metadata.condition.opaqueBackgroundSentinelAbsent = sentinelAbsent;
      second.metadata.condition.opaqueCanvasPresentationQualified = sentinelAbsent;
      expect(sentinelAbsent, `${key} should not expose the green page-compositor sentinel`).toBe(true);
    } else {
      second.metadata.condition.opaqueCanvasPresentationQualified = null;
      expect(samples.checkerA).not.toEqual(samples.checkerB);
    }
    expect(second.metadata.condition.opacity).toBe(condition.opacity);
    expect(second.metadata.condition.transparent).toBe(true);
    expect(second.metadata.condition.imageRepresentation).toContain("viewport PNG presentation screenshot");
    expect(second.metadata.condition.imageRepresentation).toContain("not raw framebuffer");
    expect(second.metadata.condition.requestedClearAlpha).toBe(condition.background === "transparent" ? 0 : 1);
    const expectedFixtureNames = fixture === "F0"
      ? ["single-transparent-plane"]
      : fixture === "F1"
        ? ["far-overlap-plane", "near-overlap-plane"]
        : ["folded-bellows-analogue"];
    expect(second.metadata.fixtureEvidence.objectNames, `${key} expected fixture objects`).toEqual(expectedFixtureNames);
    expect(second.metadata.fixtureEvidence.camera, `${key} fixed camera pose`).toEqual({
      type: "OrthographicCamera",
      position: [0, 0, 10],
      quaternion: [0, 0, 0, 1],
      left: -2,
      right: 2,
      top: 2,
      bottom: -2,
      near: 0.1,
      far: 30,
    });
    expect(second.metadata.fixtureEvidence.resolution, `${key} fixture viewport and DPR`).toEqual({
      width: 320,
      height: 320,
      deviceScaleFactor: 1,
    });
    expect(second.metadata.materialDescriptions.every((material: MaterialDescription) =>
      material.transparent === true
      && material.blending === 1
      && material.depthTest === true
      && material.depthWrite === false
      && material.premultipliedAlpha === false
      && material.toneMapped === true
      && material.forceSinglePass === false
      && material.sourceFamily === family
      && material.blendSrc === 204
      && material.blendDst === 205,
    ), `${key} material-state controls`).toBe(true);
    expect(second.metadata.draws.rendererInfoRenderCalls, `${key} per-capture renderer.info render-call delta`).toBeGreaterThan(0);
    expect(
      second.metadata.draws.rendererInfoRenderCallsAfter - second.metadata.draws.rendererInfoRenderCallsBefore,
      `${key} cumulative renderer.info counter delta`,
    ).toBe(second.metadata.draws.rendererInfoRenderCalls);
    expect(second.metadata.draws.rendererDrawCalls, `${key} per-capture draw call delta`).toBeGreaterThan(0);
    expect(
      second.metadata.draws.rendererDrawCounterAfter - second.metadata.draws.rendererDrawCounterBefore,
      `${key} cumulative draw counter delta`,
    ).toBe(second.metadata.draws.rendererDrawCalls);
    expect(second.metadata.draws.onBeforeRenderOrder.length, `${key} has observed draw callbacks`).toBeGreaterThan(0);
    const expectedNames = second.metadata.fixtureEvidence.objectNames;
    const actualNames = [...new Set(second.metadata.draws.onBeforeRenderOrder.map((draw: { name: string }) => draw.name))];
    expect(actualNames, `${key} draw identity/order control`).toEqual(expectedNames);
    if (fixture === "F1" || fixture === "F2") {
      expect(second.metadata.fixtureEvidence.centerIntersectionCount, `${key} actual projected surface overlap`).toBeGreaterThanOrEqual(2);
    }
    if (repeat.rgbChangedPixels !== 0) {
      evidence.repeatability.push({ key, result: "unstable", metrics: repeat });
    } else {
      evidence.repeatability.push({ key, result: "pixel-identical", metrics: repeat });
    }
    pixelsByKey.set(key, capture);
    evidence.captures.push({ key, metadata: second.metadata, repeat });

    const keepScreenshot = condition.opacity === 0.5 && (
      (fixture === "F1" && condition.background === "light")
      || (fixture === "F0" && condition.background === "transparent")
      || (fixture === "F2" && condition.background === "light")
    );
    if (keepScreenshot) {
      const screenshotPath = path.join(
        repositoryRoot,
        "test-results/threejs-transparency-upstream-reproduction",
        `${version}-${summarizeMode(backend, output)}-${fixture}-${condition.background}-o1.png`,
      );
      await mkdir(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath });
      evidence.provenance.screenshots.push(path.relative(repositoryRoot, screenshotPath));
    }
  }

  const cleanup = await page.evaluate(async () => {
    if (typeof window.__disposeFixture !== "function") throw new Error("Fixture cleanup is unavailable");
    return window.__disposeFixture();
  });
  expect(cleanup.rendererDisposed).toBe(true);
  expect(cleanup.allOwnedDisposalsExactlyOnce, `${version}/${backend}/${output}/${fixture} owned resource disposal`).toBe(true);
  expect(pageErrors, `${version}/${backend}/${output}/${fixture} page errors`).toEqual([]);
  const fixtureErrors = await page.evaluate(() => window.__fixtureErrors ?? []);
  expect(fixtureErrors, `${version}/${backend}/${output}/${fixture} runtime errors`).toEqual([]);
  evidence.cleanup.push({ version, backend, output, fixture, ...cleanup });
  await context.close();
};

const captureFor = (
  version: Version,
  backend: Backend,
  output: Output,
  fixture: Fixture,
  family: Family,
  opacity: number,
  background: Background,
) => pixelsByKey.get(caseKey(version, backend, output, fixture, family, opacity, background));

const addPairComparison = (
  name: string,
  left: Capture | undefined,
  right: Capture | undefined,
  fixture: Fixture,
) => {
  if (!left || !right) return;
  evidence.comparisons.push({ name, fixture, representation: "browser-presentation-png-rgba8", metrics: compareCaptures(left, right, fixture) });
};

const buildAnalyses = () => {
  for (const version of versions) {
    for (const fixture of ["F0", "F1", "F2"] as const) {
      for (const opacity of opacities) {
        const bg = captureFor(version, "webgl", "stock", fixture, "standard", opacity, "light");
        const wg = captureFor(version, "webgpu", "stock", fixture, "standard", opacity, "light");
        const adapter = captureFor(version, "webgpu", "material-aware", fixture, "standard", opacity, "light");
        addPairComparison(`${version} G↔W ${fixture} standard O${opacity}`, bg, wg, fixture);
        addPairComparison(`${version} W↔A ${fixture} standard O${opacity}`, wg, adapter, fixture);
        addPairComparison(`${version} G↔A ${fixture} standard O${opacity}`, bg, adapter, fixture);
        const darkG = captureFor(version, "webgl", "stock", fixture, "standard", opacity, "dark");
        const darkW = captureFor(version, "webgpu", "stock", fixture, "standard", opacity, "dark");
        const darkA = captureFor(version, "webgpu", "material-aware", fixture, "standard", opacity, "dark");
        addPairComparison(`${version} G↔W ${fixture} standard O${opacity} dark`, darkG, darkW, fixture);
        addPairComparison(`${version} W↔A ${fixture} standard O${opacity} dark`, darkW, darkA, fixture);
      }
    }
    if (version === "r186") {
      for (const backend of ["webgl", "webgpu"] as const) {
        addPairComparison(
          `r186 ${backend} F0 standard O0.50 scene-background↔explicit-clear`,
          captureFor(version, backend, "stock", "F0", "standard", 0.5, "light"),
          captureFor(version, backend, "stock", "F0", "standard", 0.5, "clear"),
          "F0",
        );
      }
      for (const fixture of ["F0", "F1"] as const) {
        for (const opacity of opacities) {
          const gl = captureFor(version, "webgl", "stock", fixture, "basic", opacity, "light");
          const gpu = captureFor(version, "webgpu", "stock", fixture, "basic", opacity, "light");
          const adapter = captureFor(version, "webgpu", "material-aware", fixture, "basic", opacity, "light");
          addPairComparison(`r186 G↔W ${fixture} basic O${opacity}`, gl, gpu, fixture);
          addPairComparison(`r186 W↔A ${fixture} basic O${opacity}`, gpu, adapter, fixture);
          addPairComparison(`r186 G↔A ${fixture} basic O${opacity}`, gl, adapter, fixture);
        }
      }
    }
    for (const mode of [
      { backend: "webgl" as const, output: "stock" as const },
      { backend: "webgpu" as const, output: "stock" as const },
      { backend: "webgpu" as const, output: "material-aware" as const },
    ]) {
      for (const fixture of ["F0", "F1", "F2"] as const) {
        const o0 = captureFor(version, mode.backend, mode.output, fixture, "standard", 0.16, "light");
        const o1 = captureFor(version, mode.backend, mode.output, fixture, "standard", 0.5, "light");
        const o2 = captureFor(version, mode.backend, mode.output, fixture, "standard", 1, "light");
        if (o0 && o1 && o2) {
          evidence.opacityResponse.push({
            version,
            mode: summarizeMode(mode.backend, mode.output),
            fixture,
            o0ToO1: compareCaptures(o0, o1, fixture),
            o0ToO2: compareCaptures(o0, o2, fixture),
            alphaRemainsMaterialClassification: [0.16, 0.5, 1].every((opacity) => captureFor(version, mode.backend, mode.output, fixture, "standard", opacity, "light")?.metadata.condition.transparent === true),
          });
        }
      }
    }
    for (const fixture of ["F0", "F1", "F2"] as const) {
      for (const mode of [
        { backend: "webgl" as const, output: "stock" as const },
        { backend: "webgpu" as const, output: "stock" as const },
        { backend: "webgpu" as const, output: "material-aware" as const },
      ]) {
        const light = captureFor(version, mode.backend, mode.output, fixture, "standard", 0.5, "light");
        const dark = captureFor(version, mode.backend, mode.output, fixture, "standard", 0.5, "dark");
        if (light && dark) evidence.backgroundResponse.push({
          version,
          mode: summarizeMode(mode.backend, mode.output),
          fixture,
          metrics: compareCaptures(light, dark, fixture),
        });
      }
    }
  }

  for (const version of versions) {
    for (const opacity of opacities) {
      const webgl = captureFor(version, "webgl", "stock", "F1", "standard", opacity, "light");
      const webgpu = captureFor(version, "webgpu", "stock", "F1", "standard", opacity, "light");
      const adapter = captureFor(version, "webgpu", "material-aware", "F1", "standard", opacity, "light");
      addPairComparison(`${version} F1 version-control O${opacity} G↔W`, webgl, webgpu, "F1");
      addPairComparison(`${version} F1 version-control O${opacity} W↔A`, webgpu, adapter, "F1");
    }
  }
  for (const backend of ["webgl", "webgpu"] as const) {
    for (const opacity of opacities) {
      addPairComparison(
        `r184↔r185 B0 F1 ${backend} O${opacity}`,
        captureFor("r184", backend, "stock", "F1", "standard", opacity, "light"),
        captureFor("r185", backend, "stock", "F1", "standard", opacity, "light"),
        "F1",
      );
    }
    addPairComparison(
      `r184↔r185 B1 F0 ${backend} O0.50`,
      captureFor("r184", backend, "stock", "F0", "standard", 0.5, "transparent"),
      captureFor("r185", backend, "stock", "F0", "standard", 0.5, "transparent"),
      "F0",
    );
  }
  for (const fixture of ["F0", "F1"] as const) {
    for (const mode of [
      { backend: "webgl" as const, output: "stock" as const },
      { backend: "webgpu" as const, output: "stock" as const },
      { backend: "webgpu" as const, output: "material-aware" as const },
    ]) {
      const o0 = captureFor("r186", mode.backend, mode.output, fixture, "basic", 0.16, "light");
      const o1 = captureFor("r186", mode.backend, mode.output, fixture, "basic", 0.5, "light");
      const o2 = captureFor("r186", mode.backend, mode.output, fixture, "basic", 1, "light");
      if (o0 && o1 && o2) evidence.opacityResponse.push({
        version: "r186",
        mode: summarizeMode(mode.backend, mode.output),
        fixture,
        family: "basic",
        o0ToO1: compareCaptures(o0, o1, fixture),
        o0ToO2: compareCaptures(o0, o2, fixture),
        alphaRemainsMaterialClassification: [0.16, 0.5, 1].every((opacity) => captureFor("r186", mode.backend, mode.output, fixture, "basic", opacity, "light")?.metadata.condition.transparent === true),
      });
    }
  }

  for (const version of ["r184", "r185"] as const) {
    for (const backend of ["webgl", "webgpu"] as const) {
      const old = captureFor(version, backend, "stock", "F0", "standard", 0.5, "transparent");
      const r186 = captureFor("r186", backend, "stock", "F0", "standard", 0.5, "transparent");
      addPairComparison(`${version}↔r186 B1 F0 ${backend} O0.50`, old, r186, "F0");
      for (const opacity of opacities) {
        const earlier = captureFor(version, backend, "stock", "F1", "standard", opacity, "light");
        const current = captureFor("r186", backend, "stock", "F1", "standard", opacity, "light");
        addPairComparison(`${version}↔r186 B0 F1 ${backend} O${opacity}`, earlier, current, "F1");
      }
    }
    const adapter = captureFor(version, "webgpu", "material-aware", "F1", "standard", 0.5, "light");
    const currentAdapter = captureFor("r186", "webgpu", "material-aware", "F1", "standard", 0.5, "light");
    addPairComparison(`${version}↔r186 F1 adapter O0.50`, adapter, currentAdapter, "F1");
    addPairComparison(
      `${version}↔r186 B1 F0 adapter O0.50`,
      captureFor(version, "webgpu", "material-aware", "F0", "standard", 0.5, "transparent"),
      captureFor("r186", "webgpu", "material-aware", "F0", "standard", 0.5, "transparent"),
      "F0",
    );
  }
  for (const mode of [
    { backend: "webgl" as const, output: "stock" as const },
    { backend: "webgpu" as const, output: "stock" as const },
    { backend: "webgpu" as const, output: "material-aware" as const },
  ]) {
    for (const opacity of opacities) {
      const light = captureFor("r186", mode.backend, mode.output, "F0", "standard", opacity, "light");
      const transparent = captureFor("r186", mode.backend, mode.output, "F0", "standard", opacity, "transparent");
      addPairComparison(`r186 ${summarizeMode(mode.backend, mode.output)} B0↔B1 F0 O${opacity}`, light, transparent, "F0");
    }
  }
};

const makeConditions = (fixture: Fixture, entries: readonly (readonly [number, Background])[]): Condition[] =>
  entries.map(([opacity, background]) => ({ fixture, opacity, background }));

test("isolates stock Three.js transparency behavior across r184-r186", async ({ browser, browserName }) => {
  const browserContext = await browser.newContext();
  const userAgent = await browserContext.newPage().then(async (page) => {
    const value = await page.evaluate(() => navigator.userAgent);
    await page.close();
    return value;
  });
  await browserContext.close();
  evidence.provenance.browser = { name: browserName, userAgent };
  const modes = [
    { backend: "webgl" as const, output: "stock" as const },
    { backend: "webgpu" as const, output: "stock" as const },
    { backend: "webgpu" as const, output: "material-aware" as const },
  ];

  const smokeOnly = process.env.THREE_TRANSPARENCY_SMOKE === "1";
  const activeVersions = smokeOnly ? ["r186"] as const : versions;
  for (const version of activeVersions) {
    const { server, url, packageVersion } = await makeVersionServer(version);
    evidence.provenance.versions[version] = { packageVersion, runtimeRevision: null, lockfileResolution: true };
    try {
      if (smokeOnly) {
        for (const mode of modes) {
          await runGroup(browser, version, url, mode.backend, mode.output, "F0", "standard", [
            { fixture: "F0", opacity: 0.5, background: "light" },
            { fixture: "F0", opacity: 0.5, background: "transparent" },
          ]);
        }
      } else if (version === "r186") {
        for (const mode of modes) {
          for (const fixture of ["F0", "F1", "F2"] as const) {
            const entries: Array<readonly [number, Background]> = opacities.map((opacity) => [opacity, "light"] as const);
            entries.push([0.5, "dark"]);
            if (fixture === "F0") {
              entries.push(...opacities.map((opacity) => [opacity, "transparent"] as const));
              if (mode.output === "stock") entries.push([0.5, "clear"]);
            }
            await runGroup(browser, version, url, mode.backend, mode.output, fixture, "standard", makeConditions(fixture, entries));
          }
        }
        for (const mode of modes) {
          for (const fixture of ["F0", "F1"] as const) {
            const entries: Array<readonly [number, Background]> = opacities.map((opacity) => [opacity, "light"] as const);
            if (fixture === "F1") entries.push([0.5, "dark"]);
            await runGroup(browser, version, url, mode.backend, mode.output, fixture, "basic", makeConditions(fixture, entries));
          }
        }
      } else {
        for (const mode of modes) {
          await runGroup(
            browser,
            version,
            url,
            mode.backend,
            mode.output,
            "F1",
            "standard",
            makeConditions("F1", [...opacities.map((opacity) => [opacity, "light"] as const), [0.5, "dark"]]),
          );
          await runGroup(
            browser,
            version,
            url,
            mode.backend,
            mode.output,
            "F0",
            "standard",
            makeConditions("F0", [[0.5, "transparent"]]),
          );
        }
      }
    } finally {
      await server.close();
    }
  }

  buildAnalyses();
  evidence.negativeControls = [
    { name: "wrong-version", status: "guarded-by-runtime-revision-and-lockfile-equality-assertions" },
    { name: "native-fallback", status: "guarded-by-GPUCanvasContext-method-and-backend-assertions" },
    { name: "wrong-material-family", status: "guarded-by-recorded-constructor-name-and-family" },
    { name: "wrong-opacity-or-transparent-classification", status: "guarded-by-exact-values-at-0.16-0.50-1.00-and-transparent-true" },
    { name: "blend-depth-side-pipeline-state", status: "guarded-by-per-capture-material-state-assertions" },
    { name: "draw-count-order-and-projected-overlap", status: "guarded-by-observed-render-callback-order-and-raycaster-intersection-count" },
    { name: "viewport-camera-dpr-color-and-tone-policy", status: "recorded-and-asserted-per-capture" },
    { name: "background-alpha-and-page-compositor", status: "opaque-background-page-sentinel-and-transparent-canvas-checkerboard-presentation-checked; target-alpha-not-claimed" },
    { name: "same-condition-repeatability", status: "every-condition-repeated-with-pixel-difference-metrics" },
    { name: "incompatible-image-representations", status: "all-numeric-comparisons-use-the-same-browser-presentation-PNG-representation" },
    { name: "resource-leak-and-double-dispose", status: "owned-material-and-geometry-dispose-events-counted-exactly-once" },
  ];
  const outputPath = path.join(repositoryRoot, "test-results/threejs-transparency-upstream-reproduction/evidence.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  expect(evidence.captures.length).toBeGreaterThan(0);
  expect(evidence.cleanup.every((entry) => entry.allOwnedDisposalsExactlyOnce)).toBe(true);
  expect(evidence.repeatability.every((entry) => entry.result === "pixel-identical"), "same-condition captures must repeat exactly").toBe(true);
});
