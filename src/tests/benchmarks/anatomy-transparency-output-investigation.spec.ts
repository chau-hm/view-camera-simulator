import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { arch, platform, release } from "node:os";
import { dirname } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { REVISION } from "three";
import {
  comparePixelRegions,
  decodePlaywrightPng,
  type DecodedPng,
} from "./observerBackendBenchmark";

const fixtureUrl = "/src/tests/benchmarks/anatomy-transparency-output-fixture.html";
const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const backgroundColor = "#64748b";
const families = ["basic", "standard", "line"] as const;
const colors = [
  { name: "gray", hex: "#808080" },
  { name: "white", hex: "#ffffff" },
  { name: "amber", hex: "#f59e0b" },
  { name: "dark", hex: "#111827" },
] as const;
const opacities = [1, 0.9, 0.5, 0.25, 0.16, 0.08] as const;
const variants = [
  { id: "webgl-standard", backend: "webgl", output: "standard" },
  { id: "webgpu-standard", backend: "webgpu", output: "standard" },
  { id: "webgpu-material-aware", backend: "webgpu", output: "material-aware" },
] as const;

type Variant = (typeof variants)[number];
type Pixel = Readonly<{ x: number; y: number; rgba: readonly number[] }>;
type RuntimeEvidence = Readonly<{
  rendererFamily: string;
  executionBackend: string;
  browserWebGpuApiPresent: boolean;
  adapterAvailability: string;
  outputPolicy: string;
  outputPolicyStatus: string;
  initializationAttempts: number;
  initializationFailure: string;
  applicationFallback: string;
  toneMapping: string;
  outputColorSpace: string;
  alpha: string;
  fixtureError: string | null;
  viewport: readonly [number, number];
  devicePixelRatio: number;
}>;

const pixelAt = (image: DecodedPng, x: number, y: number): Pixel => {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= image.width || py >= image.height) {
    throw new Error("Pixel sample is outside the captured framebuffer: " + px + "," + py);
  }
  const offset = (py * image.width + px) * image.channels;
  return {
    x: px,
    y: py,
    rgba: Array.from({ length: image.channels }, (_, channel) => image.pixels[offset + channel] ?? 0),
  };
};

const strongestLinePixel = (
  image: DecodedPng,
  centerX: number,
  centerY: number,
): Pixel & Readonly<{ contrastFromBackground: number }> => {
  const background = pixelAt(image, 5, 5).rgba;
  let strongest: (Pixel & Readonly<{ contrastFromBackground: number }>) | null = null;
  for (let y = Math.floor(centerY) - 4; y <= Math.ceil(centerY) + 4; y += 1) {
    for (let x = Math.floor(centerX) - 25; x <= Math.ceil(centerX) + 25; x += 1) {
      const pixel = pixelAt(image, x, y);
      const contrastFromBackground = meanDifference(pixel.rgba, background);
      if (!strongest || contrastFromBackground > strongest.contrastFromBackground) {
        strongest = { ...pixel, contrastFromBackground };
      }
    }
  }
  if (!strongest || strongest.contrastFromBackground <= 0) {
    throw new Error("The LineBasicMaterial swatch has no measurable rendered pixels");
  }
  return strongest;
};

const sampleKey = (
  family: string,
  color: string,
  toneMapped: boolean,
  transparent: boolean,
  opacity: number,
): string => [family, color, String(toneMapped), String(transparent), String(opacity)].join("/");

const readRuntime = async (page: Page): Promise<RuntimeEvidence> => page.evaluate(() => ({
  rendererFamily: document.body.dataset.rendererFamily ?? "unknown",
  executionBackend: document.body.dataset.executionBackend ?? "unknown",
  browserWebGpuApiPresent: document.body.dataset.browserWebGpuApiPresent === "true",
  adapterAvailability: document.body.dataset.adapterAvailability ?? "not-requested",
  outputPolicy: document.body.dataset.outputPolicy ?? "unknown",
  outputPolicyStatus: document.body.dataset.outputPolicyStatus ?? "pending",
  initializationAttempts: Number(document.body.dataset.factoryAttempts ?? 0),
  initializationFailure: document.body.dataset.initializationFailure ?? "unknown",
  applicationFallback: document.body.dataset.applicationFallback ?? "unknown",
  toneMapping: document.body.dataset.rendererToneMapping ?? "unknown",
  outputColorSpace: document.body.dataset.rendererOutputColorSpace ?? "unknown",
  alpha: document.body.dataset.rendererAlpha ?? "unknown",
  fixtureError: document.body.dataset.fixtureError || null,
  viewport: [window.innerWidth, window.innerHeight] as const,
  devicePixelRatio: window.devicePixelRatio,
}));

const configure = async (
  page: Page,
  payload: Readonly<Record<string, unknown>>,
): Promise<void> => {
  const previousFrame = Number(await page.locator("body").getAttribute("data-render-frames") ?? 0);
  await page.evaluate((detail) => {
    window.dispatchEvent(new CustomEvent("vcs:anatomy-transparency-fixture", { detail }));
  }, payload);
  await page.waitForFunction(({ expected, previous }) =>
    document.body.dataset.activeLayout === expected.layout &&
    (!expected.family || document.body.dataset.activeFamily === expected.family) &&
    (!expected.stage || document.body.dataset.activeStage === expected.stage) &&
    Number(document.body.dataset.renderFrames ?? 0) >= previous + 3 &&
    !document.body.dataset.fixtureError,
  {
    expected: payload,
    previous: previousFrame,
  });
};

const captureCanvas = async (page: Page): Promise<Buffer> =>
  page.locator("canvas").screenshot({ animations: "disabled" });

const meanDifference = (
  left: readonly number[],
  right: readonly number[],
): number => left.slice(0, 3).reduce(
  (total, value, channel) => total + Math.abs(value - (right[channel] ?? 0)),
  0,
) / 3;

const readSnapshot = async (page: Page): Promise<Record<string, unknown>> => page.evaluate(() => {
  const value = document.body.dataset.sceneSnapshot;
  if (!value) throw new Error("Fixture did not publish a scene/material snapshot");
  return JSON.parse(value) as Record<string, unknown>;
});

test("Anatomy material output investigation isolates alpha, color output, overlap, depth, and mutations", async ({ page, browser }, testInfo) => {
  test.setTimeout(1_800_000);
  expect(nativeRequired, "Run this isolated evidence fixture with OBSERVER_NATIVE_WEBGPU_REQUIRED=1 in headed Chrome").toBe(true);

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  const runs: Array<{
    variant: Variant;
    runtime: RuntimeEvidence;
    alphaGrid: Record<string, unknown>;
    alphaScreenshots: Record<string, string>;
    representativeMaterialSnapshots: Record<string, unknown[]>;
    repeatNoise: Record<string, unknown>;
    compositing: Array<Record<string, unknown>>;
    depth: Array<Record<string, unknown>>;
    mutations: Array<Record<string, unknown>>;
  }> = [];

  for (const variant of variants) {
    await page.goto(
      fixtureUrl + "?backend=" + variant.backend + "&output=" + variant.output,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForFunction(() => document.body.dataset.fixtureReady === "true");
    const runtime = await readRuntime(page);
    expect(runtime.fixtureError).toBeNull();
    if (variant.backend === "webgl") {
      expect(runtime.rendererFamily).toBe("webgl-renderer");
      expect(runtime.executionBackend).toBe("webgl2");
    } else {
      expect(runtime.browserWebGpuApiPresent).toBe(true);
      expect(runtime.adapterAvailability).toBe("available");
      expect(runtime.rendererFamily).toBe("webgpu-renderer");
      expect(runtime.executionBackend).toBe("webgpu");
      expect(runtime.initializationAttempts).toBe(1);
      expect(runtime.initializationFailure).toBe("none");
      expect(runtime.applicationFallback).toBe("none");
    }
    expect(runtime.outputPolicy).toBe(variant.output);
    expect(runtime.outputPolicyStatus).toBe(variant.output === "material-aware" ? "active" : "standard");
    expect(runtime.devicePixelRatio).toBe(1);
    expect(runtime.viewport).toEqual([1600, 900]);

    const alphaSamples: Array<Record<string, unknown>> = [];
    const alphaScreenshots: Record<string, string> = {};
    const representativeMaterialSnapshots: Record<string, unknown[]> = {};
    let repeatNoise: Record<string, unknown> = {};

    for (const family of families) {
      await configure(page, { layout: "grid", family });
      const firstPng = await captureCanvas(page);
      const firstImage = decodePlaywrightPng(firstPng);
      const gridSnapshot = await readSnapshot(page);
      const familySampleStart = alphaSamples.length;
      const screenshotName = variant.id + "-" + family + "-alpha-grid.png";
      const screenshotPath = testInfo.outputPath(screenshotName);
      await writeFile(screenshotPath, firstPng);
      alphaScreenshots[family] = screenshotName;

      for (let colorIndex = 0; colorIndex < colors.length; colorIndex += 1) {
        const color = colors[colorIndex]!;
        for (let toneIndex = 0; toneIndex < 2; toneIndex += 1) {
          const toneMapped = toneIndex === 0;
          for (let transparencyIndex = 0; transparencyIndex < 2; transparencyIndex += 1) {
            const transparent = transparencyIndex === 0;
            const column = colorIndex * 4 + toneIndex * 2 + transparencyIndex;
            for (let row = 0; row < opacities.length; row += 1) {
              const opacity = opacities[row]!;
              const x = ((column + 0.5) / 16) * firstImage.width;
              const y = ((2 + row) / 9) * firstImage.height;
              const pixel = family === "line"
                ? strongestLinePixel(firstImage, x, y)
                : pixelAt(firstImage, x, y);
              alphaSamples.push({
                family,
                color: color.name,
                sourceColorSrgbHex: color.hex,
                toneMapped,
                transparent,
                opacity,
                depthTest: true,
                depthWrite: transparent ? false : true,
                blending: "normal",
                premultipliedAlpha: false,
                roi: { left: pixel.x, top: pixel.y, right: pixel.x + 1, bottom: pixel.y + 1 },
                pixelRgba: pixel.rgba,
                samplePoint: { x: pixel.x, y: pixel.y },
                ...( "contrastFromBackground" in pixel
                  ? { linePixelContrastFromBackground: pixel.contrastFromBackground }
                  : {}),
              });
            }
          }
        }
      }

      const selectedMaterialSnapshots = ((gridSnapshot.objects ?? []) as Array<Record<string, unknown>>)
        .filter((object) => String(object.name).includes("tone-true-transparent-true-alpha-0.5"))
        .map((object) => ({
          name: object.name,
          renderOrder: object.renderOrder,
          source: object.source,
          output: object.output,
          sameMaterialIdentity: object.sameMaterialIdentity,
          sourceSignatures: object.sourceSignatures,
        }));
      expect(selectedMaterialSnapshots).toHaveLength(colors.length);
      representativeMaterialSnapshots[family] = selectedMaterialSnapshots;

      if (family === "basic") {
        const repeatedPng = await captureCanvas(page);
        const repeatedImage = decodePlaywrightPng(repeatedPng);
        repeatNoise = {
          firstCaptureId: variant.id + "/basic-alpha-grid/first",
          repeatedCaptureId: variant.id + "/basic-alpha-grid/repeat-1",
          camera: { left: -8, right: 8, top: 4.5, bottom: -4.5, position: [0, 0, 10] },
          viewport: runtime.viewport,
          devicePixelRatio: runtime.devicePixelRatio,
          canvas: [firstImage.width, firstImage.height],
          difference: comparePixelRegions(
            firstImage,
            repeatedImage,
            { left: 0, top: 0, right: firstImage.width, bottom: firstImage.height },
            8,
          ),
        };
      }

      // Measure output alpha with no opaque scene surface behind the swatches.
      // This separates the framebuffer alpha channel from RGB blending against
      // the fixed opaque reference field used by the color comparisons above.
      await configure(page, { layout: "alpha-grid", family });
      const clearAlphaName = variant.id + "-" + family + "-clear-alpha-grid.png";
      const clearAlphaPng = await page.screenshot({ omitBackground: true, animations: "disabled" });
      const clearAlphaImage = decodePlaywrightPng(clearAlphaPng);
      if (clearAlphaImage.channels !== 4) {
        throw new Error("Clear-background capture did not preserve alpha for " + variant.id);
      }
      await writeFile(testInfo.outputPath(clearAlphaName), clearAlphaPng);
      alphaScreenshots[family + "-clear-alpha"] = clearAlphaName;
      const familySamples = alphaSamples.slice(familySampleStart);
      familySamples.forEach((sample) => {
        const point = sample.samplePoint as { x: number; y: number };
        sample.canvasRgbaOnClear = pixelAt(clearAlphaImage, point.x, point.y).rgba;
      });
    }

    const compositing: Array<Record<string, unknown>> = [];
    for (const layoutCase of [
      { layout: "overlap", layerCount: 1, order: "natural" },
      { layout: "overlap", layerCount: 2, order: "natural" },
      { layout: "overlap", layerCount: 3, order: "natural" },
      { layout: "overlap", layerCount: 2, order: "near-first" },
      { layout: "overlap", layerCount: 3, order: "far-first" },
      { layout: "overlap", layerCount: 2, order: "natural", premultipliedAlpha: true },
      { layout: "overlap", layerCount: 2, order: "near-first", premultipliedAlpha: true },
    ] as const) {
      await configure(page, layoutCase);
      const png = await captureCanvas(page);
      const image = decodePlaywrightPng(png);
      const pixel = pixelAt(image, image.width / 2, image.height / 2);
      const snapshot = await readSnapshot(page);
      compositing.push({
        ...layoutCase,
        source: (snapshot.objects as Array<Record<string, unknown>>).map((object) => object.source),
        output: (snapshot.objects as Array<Record<string, unknown>>).map((object) => object.output),
        actualDrawOrder: snapshot.drawOrder,
        centerPixelRgba: pixel.rgba,
        camera: snapshot.camera,
        canvas: [image.width, image.height],
      });
    }

    const depth: Array<Record<string, unknown>> = [];
    for (const depthWrite of [false, true]) {
      for (const order of ["near-first", "far-first"] as const) {
        await configure(page, { layout: "depth", depthWrite, order });
        const png = await captureCanvas(page);
        const image = decodePlaywrightPng(png);
        const pixel = pixelAt(image, image.width / 2, image.height / 2);
        const snapshot = await readSnapshot(page);
        depth.push({
          depthWrite,
          order,
          materials: (snapshot.objects as Array<Record<string, unknown>>).map((object) => ({
            name: object.name,
            source: object.source,
            output: object.output,
            renderOrder: object.renderOrder,
            position: object.position,
          })),
          actualDrawOrder: snapshot.drawOrder,
          centerPixelRgba: pixel.rgba,
        });
      }
    }

    const mutations: Array<Record<string, unknown>> = [];
    for (const stage of ["normal", "highlighted", "dimmed", "ghost", "aperture", "normal", "rear-back-replacement"] as const) {
      await configure(page, { layout: "mutation", stage });
      const png = await captureCanvas(page);
      const image = decodePlaywrightPng(png);
      const pixel = pixelAt(image, image.width / 2, image.height / 2);
      const snapshot = await readSnapshot(page);
      const mutable = (snapshot.objects as Array<Record<string, unknown>>)
        .find((object) => object.name === "mutable-camera-part");
      if (!mutable) throw new Error("Mutable Anatomy-like fixture part was not observed");
      mutations.push({
        stage,
        material: mutable,
        centerPixelRgba: pixel.rgba,
      });
    }

    runs.push({
      variant,
      runtime,
      alphaGrid: {
        conditions: alphaSamples.length,
        conditionsPerFamily: alphaSamples.length / families.length,
        samples: alphaSamples,
        representativeMaterialSnapshots,
        comparisons: alphaSamples
          .filter((sample) => sample.transparent === true)
          .map((sample) => {
            const record = sample as {
              family: string;
              color: string;
              toneMapped: boolean;
              transparent: boolean;
              opacity: number;
              pixelRgba: number[];
            };
            return { key: sampleKey(record.family, record.color, record.toneMapped, true, record.opacity), pixelRgba: record.pixelRgba };
          }),
      },
      alphaScreenshots,
      representativeMaterialSnapshots,
      repeatNoise,
      compositing,
      depth,
      mutations,
    });
  }

  const sampleMap = new Map<string, Map<string, number[]>>();
  for (const run of runs) {
    const modeSamples = new Map<string, number[]>();
    const samples = (run.alphaGrid.samples ?? []) as Array<{
      family: string;
      color: string;
      toneMapped: boolean;
      transparent: boolean;
      opacity: number;
      pixelRgba: number[];
    }>;
    for (const sample of samples) {
      modeSamples.set(
        sampleKey(sample.family, sample.color, sample.toneMapped, sample.transparent, sample.opacity),
        sample.pixelRgba,
      );
    }
    sampleMap.set(run.variant.id, modeSamples);
  }

  const crossModeAlphaDifferences: Array<{
    key: string;
    webglVsStandardMeanAbsoluteRgbDifference: number;
    webglVsMaterialAwareMeanAbsoluteRgbDifference: number;
    standardVsMaterialAwareMeanAbsoluteRgbDifference: number;
  }> = [];
  for (const [key, webglPixel] of sampleMap.get("webgl-standard") ?? []) {
    const standardPixel = sampleMap.get("webgpu-standard")?.get(key);
    const candidatePixel = sampleMap.get("webgpu-material-aware")?.get(key);
    if (!standardPixel || !candidatePixel) throw new Error("A matched renderer mode is missing alpha evidence for " + key);
    crossModeAlphaDifferences.push({
      key,
      webglVsStandardMeanAbsoluteRgbDifference: meanDifference(webglPixel, standardPixel),
      webglVsMaterialAwareMeanAbsoluteRgbDifference: meanDifference(webglPixel, candidatePixel),
      standardVsMaterialAwareMeanAbsoluteRgbDifference: meanDifference(standardPixel, candidatePixel),
    });
  }

  const alphaDifferenceSummary = families.map((family) => ({
    family,
    comparisons: ["webglVsStandardMeanAbsoluteRgbDifference", "webglVsMaterialAwareMeanAbsoluteRgbDifference", "standardVsMaterialAwareMeanAbsoluteRgbDifference"]
      .map((comparison) => {
        const values = crossModeAlphaDifferences.filter((entry) => {
          const parts = entry.key.split("/");
          return parts[0] === family && parts[3] === "true";
        }).map((entry) => entry[comparison as keyof typeof entry] as number);
        return {
          comparison,
          sampleCount: values.length,
          meanRgbMae: values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1),
          maximumRgbMae: Math.max(...values),
        };
      }),
  }));

  const alphaDifferenceByFlags = families.flatMap((family) =>
    [true, false].flatMap((toneMapped) => [true, false].map((transparent) => {
      const values = crossModeAlphaDifferences.filter((entry) => {
        const parts = entry.key.split("/");
        return parts[0] === family && parts[2] === String(toneMapped) && parts[3] === String(transparent);
      });
      const summarize = (field: keyof (typeof crossModeAlphaDifferences)[number]) => {
        const samples = values.map((entry) => entry[field] as number);
        return {
          sampleCount: samples.length,
          meanRgbMae: samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1),
          maximumRgbMae: samples.length ? Math.max(...samples) : null,
        };
      };
      return {
        family,
        toneMapped,
        transparent,
        webglVsStandard: summarize("webglVsStandardMeanAbsoluteRgbDifference"),
        webglVsMaterialAware: summarize("webglVsMaterialAwareMeanAbsoluteRgbDifference"),
      };
    })),
  );

  const alphaChannelByMode = new Map<string, Map<string, number>>();
  for (const run of runs) {
    const modeAlpha = new Map<string, number>();
    const samples = run.alphaGrid.samples as Array<{
      family: string;
      color: string;
      toneMapped: boolean;
      transparent: boolean;
      opacity: number;
      canvasRgbaOnClear?: number[];
    }>;
    for (const sample of samples) {
      const rgba = sample.canvasRgbaOnClear;
      if (!rgba || rgba.length !== 4) throw new Error("Missing RGBA clear-canvas readback for " + run.variant.id);
      modeAlpha.set(
        sampleKey(sample.family, sample.color, sample.toneMapped, sample.transparent, sample.opacity),
        rgba[3] ?? 0,
      );
      if (sample.family !== "line" && sample.transparent) {
        expect(
          Math.abs((rgba[3] ?? 0) - Math.round(sample.opacity * 255)),
          `Transparent-material framebuffer alpha should preserve material opacity for ${run.variant.id}/${sampleKey(sample.family, sample.color, sample.toneMapped, sample.transparent, sample.opacity)}`,
        ).toBeLessThanOrEqual(2);
      }
    }
    alphaChannelByMode.set(run.variant.id, modeAlpha);
  }

  const alphaChannelComparisons: Array<{
    key: string;
    webglVsStandardAbsoluteDifference: number;
    webglVsMaterialAwareAbsoluteDifference: number;
  }> = [];
  for (const [key, webglAlpha] of alphaChannelByMode.get("webgl-standard") ?? []) {
    const standardAlpha = alphaChannelByMode.get("webgpu-standard")?.get(key);
    const candidateAlpha = alphaChannelByMode.get("webgpu-material-aware")?.get(key);
    if (standardAlpha === undefined || candidateAlpha === undefined) {
      throw new Error("A renderer mode is missing clear-canvas alpha evidence for " + key);
    }
    alphaChannelComparisons.push({
      key,
      webglVsStandardAbsoluteDifference: Math.abs(webglAlpha - standardAlpha),
      webglVsMaterialAwareAbsoluteDifference: Math.abs(webglAlpha - candidateAlpha),
    });
  }
  expect(alphaChannelComparisons).toHaveLength(288);
  expect(Math.max(...alphaChannelComparisons.map((entry) => entry.webglVsStandardAbsoluteDifference))).toBeLessThanOrEqual(1);
  expect(Math.max(...alphaChannelComparisons.map((entry) => entry.webglVsMaterialAwareAbsoluteDifference))).toBeLessThanOrEqual(1);

  const runsByMode = new Map(runs.map((run) => [run.variant.id, run]));
  const webglRun = runsByMode.get("webgl-standard")!;
  const standardRun = runsByMode.get("webgpu-standard")!;
  const candidateRun = runsByMode.get("webgpu-material-aware")!;
  const negativeControls = runs.map((run) => {
    const missingLayerDifference = meanDifference(
      run.compositing[0]!.centerPixelRgba as number[],
      run.compositing[1]!.centerPixelRgba as number[],
    );
    const renderOrderDifference = meanDifference(
      run.compositing[1]!.centerPixelRgba as number[],
      run.compositing[3]!.centerPixelRgba as number[],
    );
    const normalToDimmedDifference = meanDifference(
      run.mutations[0]!.centerPixelRgba as number[],
      run.mutations[2]!.centerPixelRgba as number[],
    );
    expect(missingLayerDifference, `${run.variant.id} detector did not respond when an overlapping layer was added`).toBeGreaterThan(0);
    expect(run.compositing[1]!.actualDrawOrder, `${run.variant.id} order control did not change the actual draw sequence`).not.toEqual(
      run.compositing[3]!.actualDrawOrder,
    );
    expect(renderOrderDifference, `${run.variant.id} detector did not respond to an explicit render-order swap`).toBeGreaterThan(0);
    expect(normalToDimmedDifference, `${run.variant.id} detector did not respond to a material opacity mutation`).toBeGreaterThan(0);
    return {
      mode: run.variant.id,
      oneLayerVsTwoLayersMeanRgbDifference: missingLayerDifference,
      naturalVsExplicitRenderOrderMeanRgbDifference: renderOrderDifference,
      normalVsDimmedOpacityMeanRgbDifference: normalToDimmedDifference,
      actualDrawOrderChanged: true,
    };
  });
  const materialProperties = [
    "colorSrgbHex",
    "opacity",
    "transparent",
    "blending",
    "premultipliedAlpha",
    "depthTest",
    "depthWrite",
    "side",
    "toneMapped",
    "alphaTest",
    "roughness",
    "metalness",
  ] as const;
  const candidateMutationStages = candidateRun.mutations.map((entry) => {
    const material = entry.material as {
      source: Record<string, unknown>;
      output: Record<string, unknown>;
      sourceSignatures?: { shaderSignature?: string };
    };
    for (const property of materialProperties) {
      expect(material.output[property], `Candidate output did not copy ${property} during ${entry.stage}`).toEqual(material.source[property]);
    }
    return {
      stage: entry.stage,
      sourceUuid: material.source.uuid,
      outputUuid: material.output.uuid,
      sourceVersion: Number(material.source.version),
      outputVersion: Number(material.output.version),
      shaderSignature: material.sourceSignatures?.shaderSignature,
      pixelRgba: entry.centerPixelRgba,
    };
  });
  expect(candidateMutationStages.slice(0, 6).every((entry) => entry.sourceUuid === candidateMutationStages[0]?.sourceUuid)).toBe(true);
  expect(candidateMutationStages.slice(0, 6).every((entry) => entry.outputUuid === candidateMutationStages[0]?.outputUuid)).toBe(true);
  expect(candidateMutationStages[1]?.shaderSignature).toBe(candidateMutationStages[0]?.shaderSignature);
  expect(candidateMutationStages[2]?.shaderSignature).not.toBe(candidateMutationStages[1]?.shaderSignature);
  expect(candidateMutationStages[3]?.shaderSignature).toBe(candidateMutationStages[2]?.shaderSignature);
  expect(candidateMutationStages[4]?.shaderSignature).not.toBe(candidateMutationStages[3]?.shaderSignature);
  expect(candidateMutationStages[2]!.outputVersion).toBeGreaterThan(candidateMutationStages[1]!.outputVersion);
  expect(candidateMutationStages[3]!.outputVersion).toBe(candidateMutationStages[2]!.outputVersion);
  expect(candidateMutationStages[4]!.outputVersion).toBeGreaterThan(candidateMutationStages[3]!.outputVersion);
  expect(candidateMutationStages[5]!.outputVersion).toBeGreaterThan(candidateMutationStages[4]!.outputVersion);
  expect(candidateMutationStages[6]!.sourceUuid).not.toBe(candidateMutationStages[0]?.sourceUuid);
  expect(candidateMutationStages[6]!.outputUuid).not.toBe(candidateMutationStages[0]?.outputUuid);

  for (const field of ["compositing", "depth"] as const) {
    for (let index = 0; index < webglRun[field].length; index += 1) {
      const reference = webglRun[field][index]!;
      const standard = standardRun[field][index]!;
      const candidate = candidateRun[field][index]!;
      expect(standard.actualDrawOrder, `${field} standard WebGPU draw order changed at case ${index}`).toEqual(reference.actualDrawOrder);
      expect(candidate.actualDrawOrder, `${field} candidate draw order changed at case ${index}`).toEqual(reference.actualDrawOrder);
      expect(meanDifference(
        reference.centerPixelRgba as number[],
        candidate.centerPixelRgba as number[],
      ), `${field} candidate pixel diverged from WebGL at case ${index}`).toBeLessThanOrEqual(1);
    }
  }
  expect(meanDifference(
    webglRun.compositing[1]!.centerPixelRgba as number[],
    webglRun.compositing[5]!.centerPixelRgba as number[],
  )).toBe(0);
  expect(meanDifference(
    candidateRun.compositing[1]!.centerPixelRgba as number[],
    candidateRun.compositing[5]!.centerPixelRgba as number[],
  )).toBe(0);
  expect(meanDifference(
    webglRun.depth[0]!.centerPixelRgba as number[],
    webglRun.depth[2]!.centerPixelRgba as number[],
  )).toBeGreaterThan(5);
  expect(meanDifference(
    webglRun.mutations[0]!.centerPixelRgba as number[],
    webglRun.mutations[1]!.centerPixelRgba as number[],
  )).toBeGreaterThan(20);
  for (let index = 0; index < candidateRun.mutations.length; index += 1) {
    expect(meanDifference(
      webglRun.mutations[index]!.centerPixelRgba as number[],
      candidateRun.mutations[index]!.centerPixelRgba as number[],
    ), `Candidate mutation pixel diverged from WebGL at ${candidateRun.mutations[index]!.stage}`).toBeLessThanOrEqual(1);
  }

  const report = {
    schemaVersion: 1,
    experimentId: "pr-m-inv-anatomy-transparency-output",
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sourceTree: "fixture and report generated by this PR; source commit records the checked-out implementation revision",
    threeRevision: REVISION,
    browser: {
      name: "Google Chrome",
      version: browser.version(),
      operatingSystem: { platform: platform(), release: release(), architecture: arch() },
      hardwareAcceleration: "unconfirmed",
      hardwareAccelerationEvidence: "No independent browser/system GPU diagnostics were collected.",
    },
    fixture: {
      url: fixtureUrl,
      modes: variants,
      viewport: [1600, 900],
      devicePixelRatio: 1,
      camera: { type: "orthographic", left: -8, right: 8, top: 4.5, bottom: -4.5, position: [0, 0, 10] },
      opaqueBackground: backgroundColor,
      colors,
      opacities,
      families,
      toneMapped: [true, false],
      transparent: [true, false],
      sampleMethod: "RGB is decoded from the rendered canvas screenshot over an opaque fixture background. Alpha is decoded from an independent Playwright screenshot captured with the page background omitted and transparent, exposing the actual canvas alpha channel.",
    },
    nativeBackendQualification: runs.slice(1).map((run) => ({
      mode: run.variant.id,
      rendererFamily: run.runtime.rendererFamily,
      executionBackend: run.runtime.executionBackend,
      browserWebGpuApiPresent: run.runtime.browserWebGpuApiPresent,
      adapterAvailability: run.runtime.adapterAvailability,
      outputPolicy: run.runtime.outputPolicy,
      outputPolicyStatus: run.runtime.outputPolicyStatus,
      initializationAttempts: run.runtime.initializationAttempts,
      initializationFailure: run.runtime.initializationFailure,
      applicationFallback: run.runtime.applicationFallback,
      hardwareAcceleration: "unconfirmed",
    })),
    runs,
    crossModeAlphaDifferences,
    alphaDifferenceSummary,
    alphaDifferenceByFlags,
    alphaChannelComparisons,
    mutationPropagationAssertions: {
      sourceToOutputPropertiesMatched: true,
      sourceAndAdaptedOutputIdentityStableAcrossInPlaceMutation: true,
      shaderSignaturesChangedForTransparencyAndToneMapping: true,
      adaptedOutputVersionAdvancedOnShaderSignatureChanges: true,
      replacementSourceReceivedNewAdaptedOutput: true,
      candidatePixelsMatchedWebglForAllMutationStages: true,
      stages: candidateMutationStages,
    },
    compositingAndDepthAssertions: {
      observedDrawOrdersMatchedAcrossModes: true,
      candidatePixelsMatchedWebglWithinRgbMae1: true,
      webglPremultipliedAlphaToggleMeanRgbDifference: meanDifference(
        webglRun.compositing[1]!.centerPixelRgba as number[],
        webglRun.compositing[5]!.centerPixelRgba as number[],
      ),
      candidatePremultipliedAlphaToggleMeanRgbDifference: meanDifference(
        candidateRun.compositing[1]!.centerPixelRgba as number[],
        candidateRun.compositing[5]!.centerPixelRgba as number[],
      ),
      webglDepthWriteNearFirstPixelDifference: meanDifference(
        webglRun.depth[0]!.centerPixelRgba as number[],
        webglRun.depth[2]!.centerPixelRgba as number[],
      ),
    },
    negativeControls,
    hypothesisClassifications: {
      H1: "controlled-clear-canvas-alpha-matches-source-opacity-and-all-renderer-modes",
      H2: "confirmed-controlled-per-fragment-rgb-output-before-transparent-blend",
      H3: "premultiplied-alpha-toggle-preserves-final-pixels-in-controlled-fixture",
      H4: "depth-write-control-behaves-consistently-across-webgl-and-candidate",
      H5: "observed-sort-and-render-order-match-across-modes",
      H6: "source-material-mutations-are-copied-to-stable-adapted-output",
      H7: "shader-signature-transitions-advance-adapted-output-version-as-expected",
      H8: "pending-real-scene-correlation",
      H9: "pending-real-scene-roi-and-repeat-audit",
    },
    pageErrors,
    limitations: [
      "This controlled fixture does not reproduce all world geometry and scene lighting from the Anatomy teaching scene.",
      "The fixture samples are diagnostic data, not visual-parity acceptance thresholds.",
      "Hardware acceleration remains unconfirmed.",
    ],
  };

  expect(pageErrors).toEqual([]);
  const reportPath = testInfo.outputPath("anatomy-transparency-investigation-report.json");
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await testInfo.attach("anatomy-transparency-investigation-report.json", {
    path: reportPath,
    contentType: "application/json",
  });

  const artifacts = runs.flatMap((run) => Object.values(run.alphaScreenshots)
    .map((name) => run.variant.id + "/" + name));
  await testInfo.attach("alpha-grid-artifact-index.json", {
    body: Buffer.from(JSON.stringify(artifacts, null, 2)),
    contentType: "application/json",
  });

  expect(crossModeAlphaDifferences.length).toBeGreaterThan(100);
});
