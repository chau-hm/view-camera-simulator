import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { expect, type Page, type TestInfo } from "@playwright/test";

type PixelImage = { width: number; height: number; data: Buffer };
const { PNG } = createRequire(import.meta.url)("playwright-core/lib/utilsBundle") as {
  PNG: { sync: { read(buffer: Buffer): PixelImage; write(image: PixelImage): Buffer } };
};

export const coverageViewport = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 };

const observer = (page: Page) => page.getByTestId("scene-canvas");

export async function prepareCoverageView(page: Page) {
  // Use the public quality tier with a 1x drawing buffer and the camera inspection pose.
  await page.getByLabel("Render quality").selectOption("low");
  await page.getByRole("group", { name: "View Focus" }).getByRole("button", { name: "Camera" }).click();
  await expect(observer(page)).toHaveAttribute("data-view-focus", "camera");
  await expect(observer(page)).toHaveAttribute("data-observer-execution-backend", "webgl2");
}

export async function setCoverageGeometryVisible(page: Page, visible: boolean) {
  const toggle = page.getByRole("button", { name: `${visible ? "Show" : "Hide"} Optical geometry` });
  if (!(await toggle.isVisible())) await page.getByRole("button", { name: "View overlays" }).click();
  await toggle.click();
  await expect(observer(page)).toHaveAttribute("data-optical-geometry-visible", String(visible));
}

export async function captureCoverageFrame(page: Page) {
  const canvas = observer(page).locator("canvas");
  // The Observer renders continuously. Cross a paint before capturing the
  // compositor output. The contour assertion below also checks the new state.
  await canvas.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const pose = await observer(page).evaluate(element => ({
    position: element.getAttribute("data-observer-camera-position"),
    target: element.getAttribute("data-orbit-target"),
    focus: element.getAttribute("data-view-focus"),
    backend: element.getAttribute("data-observer-execution-backend"),
  }));
  const start = performance.now();
  const png = await canvas.screenshot({
    scale: "css",
    // Legends and toolbar buttons can overlap the WebGL canvas in a normal
    // screenshot. Hide DOM paint while leaving the layout and canvas intact.
    style: 'body * { visibility: hidden !important; } [data-testid="scene-canvas"] canvas { visibility: visible !important; }',
  });
  return { png, pose, captureMs: performance.now() - start };
}

type CoverageFrame = Awaited<ReturnType<typeof captureCoverageFrame>>;
export type ContourReferences = {
  points: readonly (readonly [x: number, y: number])[];
  size: readonly [width: number, height: number];
  kind: "parallel-circle" | "nonparallel-conic";
  movements: { riseMm?: number; tiltDeg?: number; swingDeg?: number };
};

const artifact = async (testInfo: TestInfo, name: string, body: Buffer | string, contentType: string) => {
  const path = testInfo.outputPath(name);
  await writeFile(path, body);
  await testInfo.attach(name, { path, contentType });
};

let sourceSha: string | undefined;
const implementationSha = () => sourceSha ??= execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const regionRadius = 4;
const minimumRosePixels = 4;

const isStrongRose = (red: number, green: number, blue: number) =>
  red >= 150 && red - green >= 100 && red - blue >= 85 && blue > green;

const countLandmarkPixels = (
  reference: ContourReferences,
  includes: (offset: number) => boolean,
) => reference.points.map(([x, y]) => {
  const [width] = reference.size;
  let count = 0;
  for (let row = y - regionRadius; row <= y + regionRadius; row++) {
    for (let column = x - regionRadius; column <= x + regionRadius; column++) {
      if (includes((row * width + column) * 4)) count++;
    }
  }
  return { center: [x, y], count };
});

const compareCoveragePixels = (visible: PixelImage, hidden: PixelImage) => {
  const { width, height } = visible;
  const mask: PixelImage = { width, height, data: Buffer.alloc(width * height * 4) };
  let changedPixels = 0;
  let rosePixels = 0;
  for (let offset = 0; offset < mask.data.length; offset += 4) {
    const r = visible.data[offset];
    const g = visible.data[offset + 1];
    const b = visible.data[offset + 2];
    const hiddenR = hidden.data[offset];
    const hiddenG = hidden.data[offset + 1];
    const hiddenB = hidden.data[offset + 2];
    if (Math.max(Math.abs(r - hiddenR), Math.abs(g - hiddenG), Math.abs(b - hiddenB)) >= 10) {
      changedPixels++;
    }
    const strongerRose = (r - g) - (hiddenR - hiddenG) >= 30;
    if (isStrongRose(r, g, b) && strongerRose) {
      rosePixels++;
      mask.data[offset] = 255;
      mask.data[offset + 2] = 100;
    }
    mask.data[offset + 3] = 255;
  }
  return { mask, changedPixels, rosePixels };
};

export async function expectCoverageContour(
  page: Page,
  testInfo: TestInfo,
  label: string,
  reference: ContourReferences,
  options: { hidden?: CoverageFrame; reject?: ContourReferences } = {},
) {
  let { hidden } = options;
  if (!hidden) {
    await setCoverageGeometryVisible(page, false);
    hidden = await captureCoverageFrame(page);
    await setCoverageGeometryVisible(page, true);
  }
  const visible = await captureCoverageFrame(page);
  expect(visible.pose, `${label} matched Observer pose and backend`).toEqual(hidden.pose);
  const diagnostics = await observer(page).evaluate(element => ({
    visible: element.getAttribute("data-lens-coverage-visible"),
    kind: element.getAttribute("data-lens-coverage-kind"),
    imageCircleVisible: element.getAttribute("data-image-circle-visible"),
    rayCount: element.getAttribute("data-lens-coverage-ray-count"),
    perimeterCount: element.getAttribute("data-lens-coverage-perimeter-count"),
  }));
  const analysisStart = performance.now();
  const on = PNG.sync.read(visible.png);
  const off = PNG.sync.read(hidden.png);
  expect([on.width, on.height], `${label} reference canvas size`).toEqual(reference.size);
  expect([off.width, off.height], `${label} matched canvas size`).toEqual(reference.size);

  const { mask, changedPixels, rosePixels } = compareCoveragePixels(on, off);
  const inMask = (offset: number) => mask.data[offset] !== 0;
  const regions = countLandmarkPixels(reference, inMask);
  const hiddenRegions = countLandmarkPixels(reference, offset =>
    isStrongRose(off.data[offset], off.data[offset + 1], off.data[offset + 2]),
  );
  const rejectedRegions = options.reject && countLandmarkPixels(options.reject, inMask);
  const analysisMs = performance.now() - analysisStart;
  // One weak segment is allowed for raster/contrast variance on a thin line.
  const minimumSupportedLandmarks = reference.points.length - 1;
  const present = regions.filter(region => region.count >= minimumRosePixels).length >= minimumSupportedLandmarks;
  const absentWhenHidden = hiddenRegions.every(region => region.count < minimumRosePixels);
  const competingContourAbsent = !rejectedRegions ||
    rejectedRegions.filter(region => region.count < minimumRosePixels).length >= 2;
  const browser = page.context().browser();
  await artifact(testInfo, `${label}-visible.png`, visible.png, "image/png");
  await artifact(testInfo, `${label}-hidden.png`, hidden.png, "image/png");
  await artifact(testInfo, `${label}-rose-delta.png`, PNG.sync.write(mask), "image/png");
  await artifact(testInfo, `${label}-evidence.json`, JSON.stringify({
    sourceSha: implementationSha(),
    route: new URL(page.url()).pathname,
    browser: { name: browser?.browserType().name(), version: browser?.version(), project: testInfo.project.name },
    viewport: coverageViewport,
    expectedKind: reference.kind,
    movements: reference.movements,
    sceneSeed: new URL(page.url()).searchParams.get("seed"),
    observer: { ...visible.pose, quality: "low", diagnostics },
    captureMs: { visible: visible.captureMs, hidden: hidden.captureMs },
    analysisMs,
    screenshotSize: reference.size,
    rule: { regionRadius, minimumRosePixels, minimumSupportedLandmarks, minimumRed: 150, minimumRedMinusGreen: 100, minimumRedMinusBlue: 85,
      blueAboveGreen: true, minimumRedMinusGreenIncrease: 30 },
    result: { changedPixels, rosePixels, regions, hiddenRegions, rejectedRegions },
    passed: present && absentWhenHidden && competingContourAbsent,
  }, null, 2), "application/json");
  expect(present, `${label} Observer contour pixels at fixed landmarks: ${JSON.stringify(regions)}`).toBe(true);
  expect(absentWhenHidden, `${label} hidden Observer landmarks: ${JSON.stringify(hiddenRegions)}`).toBe(true);
  expect(competingContourAbsent, `${label} stale contour landmarks: ${JSON.stringify(rejectedRegions)}`).toBe(true);
}
