import { arch, platform, release } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { REVISION } from "three";
import {
  comparePixelRegions,
  decodePlaywrightPng,
  summarizePixelRegion,
  type DecodedPng,
  type PixelRegion,
} from "./observerBackendBenchmark";

const fixtureUrl = "/src/tests/e2e/fixtures/observer-output-compositing.html";
const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const backgrounds = ["light", "gray", "dark"] as const;
const isolatedOverlays = ["focus", "near", "far"] as const;

type Variant = Readonly<{
  id: "webgl" | "webgpu-standard" | "webgpu-material-aware";
  backend: "webgl" | "webgpu";
  output: "standard" | "material-aware";
}>;

type CapturedImage = Readonly<{
  variant: Variant;
  background: (typeof backgrounds)[number];
  overlay: "none" | "focus" | "near" | "far" | "overlap" | "behind";
  view: "front" | "oblique" | "back-oblique";
  png: Buffer;
  decoded: DecodedPng;
  runtime: RuntimeEvidence;
}>;

type RuntimeEvidence = Readonly<{
  rendererFamily: string;
  executionBackend: string;
  browserWebGpuApiPresent: boolean;
  rendererAlpha: string;
  initializationAttempts: number;
  applicationFallback: string;
  initializationFailure: string;
  toneMapping: string;
  outputColorSpace: string;
  fixtureError: string | null;
}>;

const variants: readonly Variant[] = [
  { id: "webgl", backend: "webgl", output: "standard" },
  { id: "webgpu-standard", backend: "webgpu", output: "standard" },
  { id: "webgpu-material-aware", backend: "webgpu", output: "material-aware" },
];

const ratioRegion = (
  image: DecodedPng,
  left: number,
  top: number,
  right: number,
  bottom: number,
): PixelRegion => ({
  left: Math.floor(image.width * left),
  top: Math.floor(image.height * top),
  right: Math.ceil(image.width * right),
  bottom: Math.ceil(image.height * bottom),
});

const channelMean = (image: DecodedPng, region: PixelRegion): readonly [number, number, number] => {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let y = region.top; y < region.bottom; y += 1) {
    for (let x = region.left; x < region.right; x += 1) {
      const index = (y * image.width + x) * image.channels;
      red += image.pixels[index] ?? 0;
      green += image.pixels[index + 1] ?? 0;
      blue += image.pixels[index + 2] ?? 0;
      count += 1;
    }
  }
  return count > 0 ? [red / count, green / count, blue / count] : [0, 0, 0];
};

const difference = (
  first: DecodedPng,
  second: DecodedPng,
  region: PixelRegion,
) => comparePixelRegions(first, second, region, 8);

const compareOverlayResponses = (
  firstBase: DecodedPng,
  firstOverlay: DecodedPng,
  secondBase: DecodedPng,
  secondOverlay: DecodedPng,
  region: PixelRegion,
) => {
  let absoluteResponseDifference = 0;
  let changedPixelCount = 0;
  let pixelCount = 0;
  for (let y = region.top; y < region.bottom; y += 1) {
    for (let x = region.left; x < region.right; x += 1) {
      const pixelStart = (y * firstBase.width + x) * firstBase.channels;
      let pixelChanged = false;
      for (let channel = 0; channel < 3; channel += 1) {
        const baseA = firstBase.pixels[pixelStart + channel] ?? 0;
        const overlayA = firstOverlay.pixels[pixelStart + channel] ?? 0;
        const baseB = secondBase.pixels[pixelStart + channel] ?? 0;
        const overlayB = secondOverlay.pixels[pixelStart + channel] ?? 0;
        const responseDifference = Math.abs((overlayA - baseA) - (overlayB - baseB));
        absoluteResponseDifference += responseDifference;
        if (responseDifference >= 8) pixelChanged = true;
      }
      if (pixelChanged) changedPixelCount += 1;
      pixelCount += 1;
    }
  }
  return {
    meanAbsoluteRgbResponseDifference: pixelCount > 0
      ? absoluteResponseDifference / (pixelCount * 3)
      : 0,
    changedPixelCount,
    changedPixelFraction: pixelCount > 0 ? changedPixelCount / pixelCount : 0,
  };
};

const readRuntime = async (page: Page): Promise<RuntimeEvidence> => page.evaluate(() => ({
  rendererFamily: document.body.dataset.rendererFamily ?? "unknown",
  executionBackend: document.body.dataset.executionBackend ?? "unknown",
  browserWebGpuApiPresent: document.body.dataset.browserWebGpuApiPresent === "true",
  rendererAlpha: document.body.dataset.rendererAlpha ?? "unknown",
  initializationAttempts: Number(document.body.dataset.factoryAttempts ?? 0),
  applicationFallback: document.body.dataset.applicationFallback ?? "unknown",
  initializationFailure: document.body.dataset.initializationFailure ?? "unknown",
  toneMapping: document.body.dataset.rendererToneMapping ?? "unknown",
  outputColorSpace: document.body.dataset.rendererOutputColorSpace ?? "unknown",
  fixtureError: document.body.dataset.fixtureError ?? null,
}));

const waitForFrameAfterControl = async (
  page: Page,
  control: "Background" | "Teaching overlay" | "Camera view",
  value: string,
): Promise<void> => {
  const priorFrames = Number(await page.locator("body").getAttribute("data-render-frames") ?? 0);
  const key = control === "Background" ? "activeBackground"
    : control === "Teaching overlay" ? "activeOverlay"
    : "activeView";
  await page.getByLabel(control).selectOption(value);
  await page.waitForFunction(({ datasetKey, expected, afterFrames }) =>
    document.body.dataset[datasetKey] === expected &&
    Number(document.body.dataset.renderFrames ?? 0) >= afterFrames,
  { datasetKey: key, expected: value, afterFrames: priorFrames + 4 });
};

test("isolated output/compositing experiment records renderer and subject pixel evidence", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  const captures = new Map<string, CapturedImage>();
  const runtimes: RuntimeEvidence[] = [];
  const capture = async (
    variant: Variant,
    background: CapturedImage["background"],
    overlay: CapturedImage["overlay"],
    view: CapturedImage["view"],
  ): Promise<CapturedImage> => {
    const runtime = await readRuntime(page);
    if (runtime.fixtureError) throw new Error(`Experiment fixture error: ${runtime.fixtureError}`);
    const png = await page.locator("canvas").screenshot({ animations: "disabled" });
    const decoded = decodePlaywrightPng(png);
    const image = { variant, background, overlay, view, png, decoded, runtime } satisfies CapturedImage;
    captures.set(`${variant.id}/${background}/${overlay}/${view}`, image);
    return image;
  };

  for (const variant of variants) {
    await page.goto(
      `${fixtureUrl}?backend=${variant.backend}&output=${variant.output}`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForFunction(() => document.body.dataset.fixtureReady === "true");
    const runtime = await readRuntime(page);
    runtimes.push(runtime);
    expect(runtime.fixtureError).toBeNull();
    if (variant.backend === "webgl") {
      expect(runtime.rendererFamily).toBe("webgl-renderer");
      expect(runtime.executionBackend).toBe("webgl2");
    } else {
      expect(runtime.rendererFamily).toBe("webgpu-renderer");
      expect(runtime.initializationAttempts).toBe(1);
      expect(runtime.initializationFailure).toBe("none");
      if (nativeRequired) {
        expect(runtime.browserWebGpuApiPresent).toBe(true);
        expect(runtime.executionBackend).toBe("webgpu");
        expect(runtime.applicationFallback).toBe("none");
        expect(runtime.initializationAttempts).toBe(1);
      }
    }

    for (const background of backgrounds) {
      await waitForFrameAfterControl(page, "Background", background);
      await waitForFrameAfterControl(page, "Camera view", "front");
      await waitForFrameAfterControl(page, "Teaching overlay", "none");
      const empty = await capture(variant, background, "none", "front");

      await waitForFrameAfterControl(page, "Teaching overlay", "overlap");
      await capture(variant, background, "overlap", "front");

      if (background === "light" || background === "dark") {
        for (const overlay of isolatedOverlays) {
          await waitForFrameAfterControl(page, "Teaching overlay", overlay);
          await capture(variant, background, overlay, "front");
        }
      }

      if (background === "light") {
        await waitForFrameAfterControl(page, "Teaching overlay", "behind");
        await capture(variant, background, "behind", "front");
      }

      if (background === "gray") {
        await waitForFrameAfterControl(page, "Camera view", "oblique");
        await waitForFrameAfterControl(page, "Teaching overlay", "none");
        await capture(variant, background, "none", "oblique");
        await waitForFrameAfterControl(page, "Teaching overlay", "overlap");
        await capture(variant, background, "overlap", "oblique");

        await waitForFrameAfterControl(page, "Camera view", "back-oblique");
        await waitForFrameAfterControl(page, "Teaching overlay", "none");
        await capture(variant, background, "none", "back-oblique");
        await waitForFrameAfterControl(page, "Teaching overlay", "overlap");
        await capture(variant, background, "overlap", "back-oblique");
      }

      expect(summarizePixelRegion(empty.decoded, ratioRegion(empty.decoded, 0.02, 0.02, 0.13, 0.13)).sampleCount)
        .toBeGreaterThan(0);
      expect(summarizePixelRegion(empty.decoded, ratioRegion(empty.decoded, 0.38, 0.32, 0.62, 0.67)).distinctColorBuckets)
        .toBeGreaterThan(2);
    }
  }

  const getCapture = (
    variant: Variant,
    background: CapturedImage["background"],
    overlay: CapturedImage["overlay"],
    view: CapturedImage["view"] = "front",
  ) => {
    const image = captures.get(`${variant.id}/${background}/${overlay}/${view}`);
    if (!image) throw new Error(`Missing experiment capture ${variant.id}/${background}/${overlay}/${view}`);
    return image;
  };

  const backgroundRegion = (image: CapturedImage) => ratioRegion(image.decoded, 0.02, 0.02, 0.13, 0.13);
  const subjectRegion = (image: CapturedImage) => ratioRegion(image.decoded, 0.39, 0.3, 0.61, 0.67);
  const overlapRegion = (image: CapturedImage) => ratioRegion(image.decoded, 0.41, 0.36, 0.6, 0.66);
  const occludedCenterRegion = (image: CapturedImage) => ratioRegion(image.decoded, 0.46, 0.45, 0.54, 0.56);
  const exposedPlaneRegion = (image: CapturedImage) => ratioRegion(image.decoded, 0.39, 0.45, 0.41, 0.55);

  const backgroundEvidence = backgrounds.map((background) => {
    const webgl = getCapture(variants[0]!, background, "none");
    const webgpu = getCapture(variants[1]!, background, "none");
    const candidate = getCapture(variants[2]!, background, "none");
    return {
      authored: backgroundColorsForReport[background],
      webglRgb: channelMean(webgl.decoded, backgroundRegion(webgl)),
      webgpuStandardRgb: channelMean(webgpu.decoded, backgroundRegion(webgpu)),
      materialAwareRgb: channelMean(candidate.decoded, backgroundRegion(candidate)),
      standardVsWebgl: difference(webgl.decoded, webgpu.decoded, backgroundRegion(webgl)),
      materialAwareVsWebgl: difference(webgl.decoded, candidate.decoded, backgroundRegion(webgl)),
    };
  });

  const litSubjectEvidence = [variants[0]!, variants[1]!, variants[2]!].map((variant) => {
    const image = getCapture(variant, "light", "none");
    return {
      variant: variant.id,
      meanRgb: channelMean(image.decoded, subjectRegion(image)),
      colorBuckets: summarizePixelRegion(image.decoded, subjectRegion(image)).distinctColorBuckets,
      materialVsWebgl: variant.id === "webgl"
        ? null
        : difference(getCapture(variants[0]!, "light", "none").decoded, image.decoded, subjectRegion(image)),
    };
  });

  const overlayParityEvidence = backgrounds.flatMap((background) => {
    const overlayStates: CapturedImage["overlay"][] = background === "light" || background === "dark"
      ? ["focus", "near", "far", "overlap"]
      : ["overlap"];
    return overlayStates.map((overlay) => {
      const webglBase = getCapture(variants[0]!, background, "none");
      const webglOverlay = getCapture(variants[0]!, background, overlay);
      const candidateBase = getCapture(variants[2]!, background, "none");
      const candidateOverlay = getCapture(variants[2]!, background, overlay);
      return {
        background,
        overlay,
        materialAwareResponseVsWebgl: compareOverlayResponses(
          webglBase.decoded,
          webglOverlay.decoded,
          candidateBase.decoded,
          candidateOverlay.decoded,
          overlapRegion(webglBase),
        ),
      };
    });
  });

  const shadowEvidence = [variants[0]!, variants[1]!, variants[2]!].map((variant) => {
    const image = getCapture(variant, "light", "none");
    const shadowRegion = ratioRegion(image.decoded, 0.35, 0.6, 0.54, 0.68);
    const adjacentGroundRegion = ratioRegion(image.decoded, 0.59, 0.6, 0.78, 0.68);
    const shadowRgb = channelMean(image.decoded, shadowRegion);
    const adjacentGroundRgb = channelMean(image.decoded, adjacentGroundRegion);
    const luminance = (rgb: readonly [number, number, number]) =>
      0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return {
      variant: variant.id,
      shadowRgb,
      adjacentGroundRgb,
      absoluteMeanLuminanceContrast: Math.abs(luminance(shadowRgb) - luminance(adjacentGroundRgb)),
      shadowRegionBuckets: summarizePixelRegion(image.decoded, shadowRegion).distinctColorBuckets,
    };
  });

  const overlayResponseEvidence = [variants[0]!, variants[1]!, variants[2]!].flatMap((variant) => {
    const pairs = backgrounds.flatMap((background) => {
      const base = getCapture(variant, background, "none");
      const overlap = getCapture(variant, background, "overlap");
      const active = difference(base.decoded, overlap.decoded, overlapRegion(base));
      const roleStates = background === "light" || background === "dark"
        ? isolatedOverlays.map((overlay) => {
          const single = getCapture(variant, background, overlay);
          return {
            overlay,
            measuredRgb: channelMean(single.decoded, overlapRegion(single)),
            contribution: difference(base.decoded, single.decoded, overlapRegion(base)),
          };
        })
        : [];
      return [{ variant: variant.id, background, overlapContribution: active, isolated: roleStates }];
    });
    return pairs;
  });

  const depthOcclusionEvidence = [variants[0]!, variants[1]!, variants[2]!].map((variant) => {
    const base = getCapture(variant, "light", "none");
    const behind = getCapture(variant, "light", "behind");
    return {
      variant: variant.id,
      subjectCenterDifference: difference(base.decoded, behind.decoded, occludedCenterRegion(base)),
      exposedPlaneDifference: difference(base.decoded, behind.decoded, exposedPlaneRegion(base)),
    };
  });

  const obliqueEvidence = (["oblique", "back-oblique"] as const).flatMap((view) =>
    [variants[0]!, variants[1]!, variants[2]!].map((variant) => {
      const base = getCapture(variant, "gray", "none", view);
      const overlay = getCapture(variant, "gray", "overlap", view);
      const webglBase = getCapture(variants[0]!, "gray", "none", view);
      const webglOverlay = getCapture(variants[0]!, "gray", "overlap", view);
      return {
        variant: variant.id,
        view,
        visibleContribution: difference(base.decoded, overlay.decoded, overlapRegion(base)),
        renderedColorBuckets: summarizePixelRegion(overlay.decoded, overlapRegion(overlay)).distinctColorBuckets,
        materialAwareResponseVsWebgl: variant.id === "webgpu-material-aware"
          ? compareOverlayResponses(
            webglBase.decoded,
            webglOverlay.decoded,
            base.decoded,
            overlay.decoded,
            overlapRegion(base),
          )
          : null,
      };
    }),
  );

  const repeatVariant = variants[2]!;
  await waitForFrameAfterControl(page, "Background", "light");
  await waitForFrameAfterControl(page, "Camera view", "front");
  await waitForFrameAfterControl(page, "Teaching overlay", "overlap");
  const repeated = await capture(repeatVariant, "light", "overlap", "front");
  const repeatedCaptureConsistency = difference(
    getCapture(repeatVariant, "light", "overlap").decoded,
    repeated.decoded,
    overlapRegion(repeated),
  );

  const selectedArtifactKeys = [
    "webgl/light/overlap/front",
    "webgpu-standard/light/overlap/front",
    "webgpu-material-aware/light/overlap/front",
    "webgpu-material-aware/dark/overlap/front",
    "webgpu-material-aware/gray/overlap/oblique",
    "webgpu-material-aware/gray/overlap/back-oblique",
    "webgpu-material-aware/light/behind/front",
  ];
  for (const key of selectedArtifactKeys) {
    const image = captures.get(key);
    if (!image) continue;
    await testInfo.attach(`observer-output-${key.replaceAll("/", "-")}.png`, {
      body: image.png,
      contentType: "image/png",
    });
  }

  const report = {
    objective: "r186 isolated WebGPU output/compositing architecture prototype",
    generatedAt: new Date().toISOString(),
    environment: {
      browserVersion: browser.version(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      platform: platform(),
      release: release(),
      architecture: arch(),
      nodeVersion: process.version,
      threeRevision: REVISION,
      viewport: page.viewportSize(),
      deviceScaleFactor: await page.evaluate(() => window.devicePixelRatio),
      browserWebGpuApiPresent: runtimes.some((runtime) => runtime.browserWebGpuApiPresent),
      nativeRequired,
      hardwareAcceleration: "unconfirmed",
    },
    rendererRuns: runtimes.map((runtime, index) => ({ variant: variants[index]?.id, ...runtime })),
    backgroundEvidence,
    litSubjectEvidence,
    overlayParityEvidence,
    shadowEvidence,
    overlayResponseEvidence,
    depthOcclusionEvidence,
    obliqueEvidence,
    repeatedCaptureConsistency,
    fixtureErrors: pageErrors,
    testInterpretation: "The material-aware path is an isolated TSL/NodeMaterial prototype. It does not change SceneRenderer or establish Architecture Rise parity.",
    overlayAuthoring: [
      { role: "focus", color: "#16a34a", opacity: 0.42 },
      { role: "near", color: "#60a5fa", opacity: 0.24 },
      { role: "far", color: "#a78bfa", opacity: 0.22 },
    ],
    overlayPipeline: {
      transparent: true,
      blending: "NormalBlending",
      premultipliedAlpha: false,
      side: "DoubleSide",
      depthTest: true,
      depthWrite: false,
      outlineDepthTest: false,
      outlineDepthWrite: false,
      objectCreationOrder: ["far", "near", "focus"],
    },
  };

  await testInfo.attach("observer-output-compositing-report.json", {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: "application/json",
  });
  const outputDirectory = join("test-results", "observer-output-compositing");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, "report.json"), JSON.stringify(report, null, 2));
  for (const key of selectedArtifactKeys) {
    const image = captures.get(key);
    if (image) await writeFile(join(outputDirectory, `${key.replaceAll("/", "-")}.png`), image.png);
  }
  console.log(`OBSERVER_OUTPUT_COMPOSITING_SUMMARY ${JSON.stringify({
    environment: report.environment,
    rendererRuns: report.rendererRuns,
    backgroundEvidence: report.backgroundEvidence,
    litSubjectEvidence: report.litSubjectEvidence,
    overlayParityEvidence: report.overlayParityEvidence,
    shadowEvidence: report.shadowEvidence,
    depthOcclusionEvidence: report.depthOcclusionEvidence,
    obliqueEvidence: report.obliqueEvidence,
    repeatedCaptureConsistency: report.repeatedCaptureConsistency,
  })}`);

  expect(pageErrors).toEqual([]);
  expect(backgroundEvidence.every((item) => item.materialAwareVsWebgl.meanAbsoluteRgbDifference <= 4)).toBe(true);
  for (const item of litSubjectEvidence) expect(item.colorBuckets).toBeGreaterThan(8);
  expect(litSubjectEvidence[2]?.materialVsWebgl?.meanAbsoluteRgbDifference ?? Infinity).toBeLessThanOrEqual(2);
  expect(overlayParityEvidence.every((item) =>
    item.materialAwareResponseVsWebgl.meanAbsoluteRgbResponseDifference <= 2,
  )).toBe(true);
  expect(shadowEvidence.every((item) => item.absoluteMeanLuminanceContrast >= 8)).toBe(true);
  for (const item of overlayResponseEvidence) {
    for (const state of item.isolated) expect(state.contribution.changedPixelCount).toBeGreaterThan(0);
    expect(item.overlapContribution.changedPixelCount).toBeGreaterThan(0);
  }
  for (const item of depthOcclusionEvidence) {
    expect(item.subjectCenterDifference.changedPixelCount).toBeLessThanOrEqual(3);
    expect(item.exposedPlaneDifference.changedPixelCount).toBeGreaterThan(0);
  }
  for (const item of obliqueEvidence) expect(item.visibleContribution.changedPixelCount).toBeGreaterThan(0);
  expect(obliqueEvidence.filter((item) => item.variant === "webgpu-material-aware").every((item) =>
    item.materialAwareResponseVsWebgl?.meanAbsoluteRgbResponseDifference !== undefined &&
    item.materialAwareResponseVsWebgl.meanAbsoluteRgbResponseDifference <= 2,
  )).toBe(true);
  expect(repeatedCaptureConsistency.meanAbsoluteRgbDifference).toBeLessThanOrEqual(0.5);
});

const backgroundColorsForReport = {
  light: "#f8fafc",
  gray: "#808080",
  dark: "#172331",
} as const;
