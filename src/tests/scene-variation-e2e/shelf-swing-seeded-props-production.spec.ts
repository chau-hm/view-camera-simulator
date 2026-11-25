import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { setRangeDirectOnGrid } from "../e2e/helpers/rangeInput";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { controlSolution, subjects } from "../../scenes/shelfSwingGeometry";
import { resolveShelfSwingPropVariationPlan } from "../../scenes/shelfSwingPropVariation";
import { createSceneVariantIdentity, resolveSceneVariationDescriptor } from "../../scenes/sceneVariation";

const FIXED_SEED = 284719;
const MAX_SEED = 0xffff_ffff;
const FROZEN_AUDIT_SEEDS = [
  0,
  1,
  FIXED_SEED,
  MAX_SEED,
  3079748268,
  654013979,
  4041585854,
  2762659077,
  2004402848,
  1824298367,
  2130322642,
  4065361417,
] as const;
const SHELF_SWING_BLIND_PAIRS = [
  [2004402848, 4041585854],
  [3079748268, 4065361417],
  [FIXED_SEED, 2762659077],
  [MAX_SEED, 654013979],
  [0, 1],
  [2130322642, 1824298367],
] as const;
const CAPACITY_QUERY = "rttDiagnostics=1&sceneCapacityProfiling=1&dofProfiling=1";
const SCENE_PATH = "/simulator/free/shelf-swing";

const evidenceDirectory = async (testInfo: TestInfo): Promise<string> => {
  const directory = process.env.SCENE_VARIATION_EVIDENCE_DIR
    ? path.resolve(process.env.SCENE_VARIATION_EVIDENCE_DIR)
    : testInfo.outputPath("captures");
  await mkdir(directory, { recursive: true });
  return directory;
};

const hashRttCanvas = async (rtt: Locator): Promise<string> => createHash("sha256")
  .update(await rtt.locator("canvas").screenshot())
  .digest("hex");

const waitForFrame = async (rtt: Locator, previousRequestId?: string | null): Promise<string> => {
  if (previousRequestId !== undefined) {
    await expect.poll(() => rtt.getAttribute("data-frame-request-id"), { timeout: 120_000 })
      .not.toBe(previousRequestId);
  }
  await expect.poll(async () => {
    const requestId = await rtt.getAttribute("data-frame-request-id");
    const completedRequestId = await rtt.getAttribute("data-last-completed-request-id");
    return Boolean(requestId && requestId === completedRequestId);
  }, { timeout: 120_000 }).toBe(true);
  await expect(rtt).toHaveAttribute("data-frame-result-status", "completed");
  return (await rtt.getAttribute("data-frame-request-id")) ?? "";
};

const navigateSpaTo = async (page: Page, route: string): Promise<void> => {
  await page.evaluate((nextRoute) => {
    window.history.pushState({}, "", nextRoute);
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }, route);
};

const waitForScene = async (page: Page, seed?: number, schemaVersion = 1) => {
  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(scene).toHaveAttribute("data-scene-subject-id", "shelf-swing");
  await expect(scene).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(scene).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(scene).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "shelf-swing");
  await expect(rtt).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(rtt).toHaveAttribute("data-actual-execution-api", "webgl2");
  await waitForFrame(rtt);
  if (seed !== undefined) {
    const controls = page.getByTestId("scene-variation-controls");
    await expect(controls).toHaveAttribute("data-active-seed", String(seed));
    await expect(controls).toHaveAttribute("data-active-schema", String(schemaVersion));
    await expect(controls).toContainText(`Seed ${seed} · schema v${schemaVersion}`);
  }
  return { scene, rtt };
};

const setStandardCameraState = async (page: Page, rtt: Locator): Promise<void> => {
  await page.getByLabel("Render quality").selectOption("standard");
  await setRangeDirectOnGrid(page, "Focus distance", controlSolution.focusDistanceMm);
  await setRangeDirectOnGrid(page, "Swing", controlSolution.frontSwingDeg);
  await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: "f/11" }).check();
  await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
  await waitForFrame(rtt);
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue(
    String(controlSolution.focusDistanceMm),
  );
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue(
    String(controlSolution.frontSwingDeg),
  );
  await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute(
    "data-selected-aperture",
    "11",
  );
  await expect(page.getByLabel("Render quality")).toHaveValue("standard");
};

const getOverlayGroup = async (page: Page): Promise<Locator> => {
  const inlineGroup = page.getByTestId("scene-overlay-inline");
  if (await inlineGroup.count() === 1) {
    await expect(inlineGroup).toBeVisible();
    return inlineGroup;
  }
  const collapsedGroup = page.getByTestId("scene-overlay-collapsed");
  if (await collapsedGroup.count() === 0) {
    await page.getByRole("button", { name: /View overlays/i }).click();
  }
  await expect(collapsedGroup).toBeVisible();
  return collapsedGroup;
};

const clearObserverOverlays = async (page: Page, scene: Locator): Promise<void> => {
  const trigger = page.getByRole("button", { name: /View overlays/i });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const group = await getOverlayGroup(page);
    const active = group.locator('button[aria-pressed="true"]');
    if (await active.count() === 0) break;
    await active.first().click();
  }
  const group = await getOverlayGroup(page);
  await expect(group.locator('button[aria-pressed="true"]')).toHaveCount(0);
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
  await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");
  if (await trigger.count() === 1 && await trigger.getAttribute("aria-expanded") === "true") {
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  }
};

const closeTaskFeedbackDrawerIfOpen = async (page: Page): Promise<void> => {
  const panel = page.getByTestId("learning-overlay-panel");
  if (await panel.count() === 0 || await panel.getAttribute("data-drawer-state") === "peek") return;
  await panel.getByRole("button", { name: "Close Task and Feedback" }).click();
  await expect(panel).toHaveAttribute("data-drawer-state", "peek");
};

const captureObserver = async (
  page: Page,
  scene: Locator,
  testInfo: TestInfo,
  file: string,
): Promise<{ bytes: Buffer; cameraPosition: string; orbitTarget: string; canvasSize: { width: number; height: number } }> => {
  const canvas = scene.locator("canvas").first();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Shelf Swing Observer canvas is not visible");
  expect(bounds.width).toBeGreaterThanOrEqual(500);
  expect(bounds.height).toBeGreaterThanOrEqual(400);
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);
  const backupAttribute = "data-scene-variation-capture-inline-style";
  await canvas.evaluate((targetCanvas, backupKey) => {
    const targetRect = targetCanvas.getBoundingClientRect();
    const elements = Array.from(document.querySelectorAll<HTMLElement>("body *"));
    elements.forEach((element) => {
      if (element === targetCanvas || element.contains(targetCanvas) || targetCanvas.contains(element)) return;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = element.getBoundingClientRect();
      const overlaps = rect.right > targetRect.left && rect.left < targetRect.right &&
        rect.bottom > targetRect.top && rect.top < targetRect.bottom;
      if (!overlaps || rect.width <= 0 || rect.height <= 0) return;
      const previousStyle = element.getAttribute("style");
      element.setAttribute(backupKey, previousStyle ?? "__scene_capture_no_inline_style__");
      element.style.setProperty("visibility", "hidden", "important");
    });
  }, backupAttribute);
  let bytes: Buffer;
  try {
    bytes = await canvas.screenshot({ animations: "disabled" });
  } finally {
    await page.evaluate((backupKey) => {
      document.querySelectorAll<HTMLElement>(`[${backupKey}]`).forEach((element) => {
        const previousStyle = element.getAttribute(backupKey);
        if (previousStyle === "__scene_capture_no_inline_style__") element.removeAttribute("style");
        else if (previousStyle !== null) element.setAttribute("style", previousStyle);
        element.removeAttribute(backupKey);
      });
    }, backupAttribute);
  }
  const canvasSize = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  expect(canvasSize.width).toBeGreaterThanOrEqual(500);
  expect(canvasSize.height).toBeGreaterThanOrEqual(400);
  await writeFile(path.join(await evidenceDirectory(testInfo), file), bytes);
  await testInfo.attach(file, { body: bytes, contentType: "image/png" });
  return {
    bytes,
    cameraPosition: (await scene.getAttribute("data-observer-camera-position")) ?? "",
    orbitTarget: (await scene.getAttribute("data-orbit-target")) ?? "",
    canvasSize,
  };
};

const captureMetadata = (
  capture: Awaited<ReturnType<typeof captureObserver>>,
): Omit<Awaited<ReturnType<typeof captureObserver>>, "bytes"> => ({
  cameraPosition: capture.cameraPosition,
  orbitTarget: capture.orbitTarget,
  canvasSize: capture.canvasSize,
});

type EvidenceTile = Readonly<{
  title: string;
  images: readonly Readonly<{ label: string; bytes: Buffer }>[];
}>;

const dataUrlForPng = (bytes: Buffer): string => `data:image/png;base64,${bytes.toString("base64")}`;

const renderEvidenceSheet = async (
  page: Page,
  testInfo: TestInfo,
  file: string,
  tiles: readonly EvidenceTile[],
  columns: number,
): Promise<Buffer> => {
  const tileImageCount = tiles[0]?.images.length ?? 1;
  const tileWidth = tileImageCount * 514;
  const tileHeight = 447 + (tiles.some((tile) => tile.images.some((item) => item.label)) ? 24 : 0);
  const tileMarkup = tiles.map((tile) => `
    <article class="tile">
      <div class="title">${tile.title}</div>
      <div class="images">${tile.images.map((item) => `
        <figure>
          ${item.label ? `<figcaption>${item.label}</figcaption>` : ""}
          <img alt="${item.label || tile.title}" src="${dataUrlForPng(item.bytes)}" />
        </figure>
      `).join("")}</div>
    </article>
  `).join("");
  const width = columns * tileWidth;
  const rowCount = Math.ceil(tiles.length / columns);
  await page.setViewportSize({ width, height: rowCount * tileHeight });
  await page.setContent(`<!doctype html><html><head><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; font: 14px Arial, sans-serif; }
    #sheet { width: ${width}px; display: grid; grid-template-columns: repeat(${columns}, ${tileWidth}px); }
    .tile { width: ${tileWidth}px; min-height: ${tileHeight}px; overflow: hidden; background: #f7f8fa; }
    .title { height: 36px; padding: 8px 6px; color: #1d2530; font-weight: 700; white-space: nowrap; }
    .images { display: flex; width: max-content; }
    figure { margin: 0; width: max-content; background: #f7f8fa; }
    figcaption { height: 24px; padding: 5px 6px; font-size: 12px; color: #344154; }
    img { display: block; width: 514px; height: 411px; object-fit: contain; background: #fff; }
  </style></head><body><main id="sheet">${tileMarkup}</main></body></html>`);
  await page.evaluate(async () => {
    await Promise.all(Array.from(document.images, (image) => image.decode()));
  });
  const bytes = await page.locator("#sheet").screenshot({ animations: "disabled" });
  await writeFile(path.join(await evidenceDirectory(testInfo), file), bytes);
  await testInfo.attach(file, { body: bytes, contentType: "image/png" });
  return bytes;
};

const cropHistoricalShelfSwingCaptures = async (
  page: Page,
  seedGrid: Buffer,
  canonicalComparison: Buffer,
): Promise<{ v1BySeed: ReadonlyMap<number, Buffer>; canonical: Buffer }> => {
  const results = await page.evaluate(async ({ seedGridData, canonicalData, seeds }) => {
    const load = async (dataUrl: string): Promise<HTMLImageElement> => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      return image;
    };
    const [grid, comparison] = await Promise.all([
      load(seedGridData),
      load(canonicalData),
    ]);
    const crop = (image: HTMLImageElement, sourceX: number, sourceY: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = 514;
      canvas.height = 411;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not create crop canvas");
      context.drawImage(image, sourceX, sourceY, 514, 411, 0, 0, 514, 411);
      return canvas.toDataURL("image/png");
    };
    return {
      v1: seeds.map((seed: number, index: number) => ({
        seed,
        image: crop(grid, (index % 3) * 514, Math.floor(index / 3) * 447 + 36),
      })),
      canonical: crop(comparison, 0, 36),
    };
  }, {
    seedGridData: dataUrlForPng(seedGrid),
    canonicalData: dataUrlForPng(canonicalComparison),
    seeds: FROZEN_AUDIT_SEEDS,
  });
  const v1BySeed = new Map(results.v1.map((capture) => [
    capture.seed,
    Buffer.from(capture.image.split(",")[1]!, "base64"),
  ]));
  return {
    v1BySeed,
    canonical: Buffer.from(results.canonical.split(",")[1]!, "base64"),
  };
};

const compareHistoricalAndV2Captures = async (
  page: Page,
  v1BySeed: ReadonlyMap<number, Buffer>,
  v2BySeed: ReadonlyMap<number, Buffer>,
  canonical: Buffer,
) => page.evaluate(async ({ v1, v2, canonicalImage, seeds, referenceSeed }) => {
  const decode = async (dataUrl: string): Promise<ImageData> => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 514;
    canvas.height = 411;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not create image-diagnostics canvas");
    context.drawImage(image, 0, 0, 514, 411);
    return context.getImageData(0, 0, 514, 411);
  };
  const dataUrl = (base64: string) => `data:image/png;base64,${base64}`;
  const v1Pixels = new Map<number, ImageData>();
  const v2Pixels = new Map<number, ImageData>();
  for (const seed of seeds) {
    v1Pixels.set(seed, await decode(dataUrl(v1[seed]!)));
    v2Pixels.set(seed, await decode(dataUrl(v2[seed]!)));
  }
  const canonicalPixels = await decode(dataUrl(canonicalImage));
  const roiSegments = [[70, 145], [232, 296], [382, 456]] as const;
  const measure = (baseline: ImageData, candidate: ImageData) => {
    let changed = 0;
    let sum = 0;
    let maximum = 0;
    let roiChanged = 0;
    let roiSum = 0;
    let roiMaximum = 0;
    let minX = 514;
    let minY = 411;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < 411; y += 1) {
      for (let x = 0; x < 514; x += 1) {
        const offset = (y * 514 + x) * 4;
        let pixelChanged = false;
        for (let channel = 0; channel < 3; channel += 1) {
          const delta = Math.abs(baseline.data[offset + channel]! - candidate.data[offset + channel]!);
          sum += delta;
          maximum = Math.max(maximum, delta);
          if (delta > 0) pixelChanged = true;
        }
        if (pixelChanged) changed += 1;
        const inHistoricalRoi = y >= 224 && y < 264 && roiSegments.some(([start, end]) => x >= start && x < end);
        if (inHistoricalRoi) {
          if (pixelChanged) {
            roiChanged += 1;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
          for (let channel = 0; channel < 3; channel += 1) {
            const delta = Math.abs(baseline.data[offset + channel]! - candidate.data[offset + channel]!);
            roiSum += delta;
            roiMaximum = Math.max(roiMaximum, delta);
          }
        }
      }
    }
    const roiArea = (264 - 224) * roiSegments.reduce((sumX, [start, end]) => sumX + end - start, 0);
    return {
      changedPixels: changed,
      changedPixelFraction: changed / (514 * 411),
      meanAbsoluteChannelDifference: sum / (514 * 411 * 3),
      maxChannelDifference: maximum,
      historicalRoi: {
        changedPixels: roiChanged,
        changedPixelFraction: roiChanged / roiArea,
        meanAbsoluteChannelDifference: roiSum / (roiArea * 3),
        maxChannelDifference: roiMaximum,
        changedBounds: maxX < 0 ? null : { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 },
      },
    };
  };
  const paired = seeds.map((seed: number) => ({
    seed,
    sameSeedV1V2: measure(v1Pixels.get(seed)!, v2Pixels.get(seed)!),
    v1VsCanonical: measure(canonicalPixels, v1Pixels.get(seed)!),
    v2VsCanonical: measure(canonicalPixels, v2Pixels.get(seed)!),
  }));
  const referenceV1 = v1Pixels.get(referenceSeed)!;
  const referenceV2 = v2Pixels.get(referenceSeed)!;
  const withinSchema = {
    v1: seeds.filter((seed: number) => seed !== referenceSeed).map((seed: number) => ({
      seed,
      vsReferenceSeed: measure(referenceV1, v1Pixels.get(seed)!),
    })),
    v2: seeds.filter((seed: number) => seed !== referenceSeed).map((seed: number) => ({
      seed,
      vsReferenceSeed: measure(referenceV2, v2Pixels.get(seed)!),
    })),
  };
  return {
    canvas: { width: 514, height: 411 },
    historicalRoi: {
      xSegments: roiSegments,
      y: [224, 264],
      canvasFraction: ((264 - 224) * roiSegments.reduce((sumX, [start, end]) => sumX + end - start, 0)) / (514 * 411),
    },
    paired,
    withinSchemaAgainstSeed284719: withinSchema,
  };
}, {
  v1: Object.fromEntries(Array.from(v1BySeed, ([seed, bytes]) => [seed, bytes.toString("base64")])),
  v2: Object.fromEntries(Array.from(v2BySeed, ([seed, bytes]) => [seed, bytes.toString("base64")])),
  canonicalImage: canonical.toString("base64"),
  seeds: FROZEN_AUDIT_SEEDS,
  referenceSeed: FIXED_SEED,
});

const readCapacity = async (page: Page) => {
  const snapshot = page.getByTestId("scene-capacity-snapshot").first();
  await expect.poll(async () => (await snapshot.textContent())?.trim() ?? "", { timeout: 30_000 })
    .toContain('"rendererResources"');
  const content = (await snapshot.textContent())?.trim();
  if (!content) throw new Error("Scene capacity diagnostics did not publish a snapshot");
  return JSON.parse(content) as {
    viewportSubject: {
      objectCount: number;
      meshCount: number;
      renderableMeshCount: number;
      instancedMeshCount: number;
      lightCount: number;
      lineCount: number;
      pointsCount: number;
      uniqueGeometryCount: number;
      uniqueMaterialCount: number;
      uniqueTextureCount: number;
      triangleCount: number;
      instancedTriangleCount: number;
      effectiveTriangleCount: number;
      renderableEffectiveTriangleCount: number;
    } | null;
    rttSubject: {
      objectCount: number;
      meshCount: number;
      renderableMeshCount: number;
      instancedMeshCount: number;
      lightCount: number;
      lineCount: number;
      pointsCount: number;
      uniqueGeometryCount: number;
      uniqueMaterialCount: number;
      uniqueTextureCount: number;
      triangleCount: number;
      instancedTriangleCount: number;
      effectiveTriangleCount: number;
      renderableEffectiveTriangleCount: number;
    } | null;
    rendererResources: { geometries: number; textures: number } | null;
    groundGlass: { enabled: boolean; frame: { count: number } } | null;
  };
};

const readCapacityResidual = async (page: Page) => {
  const snapshot = await readCapacity(page);
  if (!snapshot.viewportSubject || !snapshot.rttSubject || !snapshot.rendererResources) {
    throw new Error("Scene capacity snapshot is missing a subject or renderer resource count");
  }
  return {
    subject: { observer: snapshot.viewportSubject, groundGlass: snapshot.rttSubject },
    renderer: snapshot.rendererResources,
  };
};

const orbitScene = async (page: Page, scene: Locator): Promise<void> => {
  const canvas = scene.locator("canvas").first();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Shelf Swing Observer canvas is not visible for orbit input");
  const x = bounds.x + bounds.width * 0.58;
  const y = bounds.y + bounds.height * 0.48;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 44, y - 22, { steps: 4 });
  await page.mouse.up();
};

const assertCameraAndPreviewPreserved = async (
  page: Page,
  scene: Locator,
  cameraPosition: string,
  orbitTarget: string,
): Promise<void> => {
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue(
    String(controlSolution.focusDistanceMm),
  );
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue(
    String(controlSolution.frontSwingDeg),
  );
  await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute(
    "data-selected-aperture",
    "11",
  );
  await expect(page.getByLabel("Render quality")).toHaveValue("standard");
  await expect(page.getByRole("radio", { name: "Upright Assist" })).toBeChecked();
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
  await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");
  await expect.poll(() => scene.getAttribute("data-observer-camera-position")).toBe(cameraPosition);
  await expect.poll(() => scene.getAttribute("data-orbit-target")).toBe(orbitTarget);
};

test("Shelf Swing Free Practice has reproducible, readable v1 prop captures", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const captures: Array<Record<string, unknown>> = [];

  const canonicalRoute = "/simulator/guided/shelf-swing/swing-01";
  const canonical = await page.goto(canonicalRoute);
  expect(canonical?.ok()).toBeTruthy();
  const canonicalScene = await waitForScene(page);
  await expect(page.getByTestId("scene-variation-controls")).toHaveCount(0);
  await closeTaskFeedbackDrawerIfOpen(page);
  await clearObserverOverlays(page, canonicalScene.scene);
  const canonicalCapture = await captureObserver(
    page,
    canonicalScene.scene,
    testInfo,
    "shelf-swing-observer-canonical.png",
  );
  captures.push({
    label: "Canonical Guided Mode subject",
    route: canonicalRoute,
    ...captureMetadata(canonicalCapture),
  });

  let seed284719Capture: Buffer | null = null;
  let seed284719Url = "";
  let expectedCameraPosition = "";
  let expectedOrbitTarget = "";
  const cases = [
    { seed: FIXED_SEED, label: `Seed ${FIXED_SEED}`, file: `shelf-swing-observer-seed-${FIXED_SEED}.png` },
    { seed: MAX_SEED, label: `Seed ${MAX_SEED}`, file: `shelf-swing-observer-seed-${MAX_SEED}.png` },
    { seed: 1, label: "Seed 1 · additional arrangement", file: "shelf-swing-observer-seed-1.png" },
  ];

  for (const captureCase of cases) {
    const route = `${SCENE_PATH}?seed=${captureCase.seed}&sv=1&keep=one#pilot`;
    await page.goto(route);
    const { scene, rtt } = await waitForScene(page, captureCase.seed);
    await closeTaskFeedbackDrawerIfOpen(page);
    await clearObserverOverlays(page, scene);
    await setStandardCameraState(page, rtt);
    await clearObserverOverlays(page, scene);
    const capture = await captureObserver(page, scene, testInfo, captureCase.file);
    expect(new URL(page.url()).pathname).toBe(SCENE_PATH);
    if (expectedCameraPosition === "") {
      expectedCameraPosition = capture.cameraPosition;
      expectedOrbitTarget = capture.orbitTarget;
    } else {
      expect(capture.cameraPosition).toBe(expectedCameraPosition);
      expect(capture.orbitTarget).toBe(expectedOrbitTarget);
    }
    captures.push({
      label: captureCase.label,
      route,
      ...captureMetadata(capture),
      devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
      renderQuality: await page.getByLabel("Render quality").inputValue(),
      focusDistanceMm: controlSolution.focusDistanceMm,
      frontSwingDeg: controlSolution.frontSwingDeg,
      aperture: 11,
    });

    if (captureCase.seed === FIXED_SEED) {
      seed284719Capture = capture.bytes;
      await page.getByRole("button", { name: "Copy share URL" }).click();
      await expect(page.getByTestId("scene-variation-controls").getByRole("status"))
        .toContainText("Share URL copied");
      seed284719Url = await page.evaluate(() => navigator.clipboard.readText());
      expect(seed284719Url).toBe(page.url());
      const shared = new URL(seed284719Url);
      expect(shared.pathname).toBe(SCENE_PATH);
      expect(shared.searchParams.get("seed")).toBe(String(FIXED_SEED));
      expect(shared.searchParams.get("sv")).toBe("1");
      expect(shared.searchParams.get("keep")).toBe("one");
      expect(shared.hash).toBe("#pilot");
    }
  }

  if (!seed284719Capture || !seed284719Url) throw new Error("Missing fixed-seed capture and share URL");
  await page.goto(seed284719Url);
  const replay = await waitForScene(page, FIXED_SEED);
  await closeTaskFeedbackDrawerIfOpen(page);
  await clearObserverOverlays(page, replay.scene);
  await setStandardCameraState(page, replay.rtt);
  await clearObserverOverlays(page, replay.scene);
  const replayCapture = await captureObserver(
    page,
    replay.scene,
    testInfo,
    "shelf-swing-observer-seed-284719-replay.png",
  );
  expect(replayCapture.bytes.equals(seed284719Capture)).toBe(true);
  expect(replayCapture.cameraPosition).toBe(expectedCameraPosition);
  expect(replayCapture.orbitTarget).toBe(expectedOrbitTarget);
  expect(page.url()).toBe(seed284719Url);
  captures.push({
    label: `Seed ${FIXED_SEED} · same-URL replay`,
    route: seed284719Url,
    ...captureMetadata(replayCapture),
    pixelIdentical: true,
  });
  expect(pageErrors).toEqual([]);

  await writeFile(path.join(await evidenceDirectory(testInfo), "shelf-swing-observer-captures.json"), JSON.stringify({
    viewport: { width: 1440, height: 1000 },
    devicePixelRatio: 1,
    renderer: "WebGL2 production preview",
    renderQuality: "standard",
    observerView: "Clean Observer; overlays hidden",
    camera: {
      cameraPosition: expectedCameraPosition,
      orbitTarget: expectedOrbitTarget,
      focusDistanceMm: controlSolution.focusDistanceMm,
      frontSwingDeg: controlSolution.frontSwingDeg,
      aperture: 11,
    },
    captures,
    fixedSeedReplayPixelIdentical: true,
    pageErrors,
  }, null, 2));
});

test("Shelf Swing schema v2 captures the full frozen seed sample at normal Observer size", async ({
  page,
}, testInfo) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(SCENE_PATH);
  const implicit = await waitForScene(page);
  const implicitControls = page.getByTestId("scene-variation-controls");
  await expect(implicitControls).toHaveAttribute("data-active-schema", "1");
  const implicitUrl = new URL(page.url());
  expect(implicitUrl.searchParams.get("sv")).toBe("1");
  expect(implicitUrl.searchParams.get("seed")).toMatch(/^\d+$/);
  await expect(implicit.scene).toHaveAttribute("data-observer-camera-position", "4.200000,1.450000,1.400000");

  const legacyFrame = await implicit.rtt.getAttribute("data-frame-request-id");
  await navigateSpaTo(page, `${SCENE_PATH}?seed=${FIXED_SEED}`);
  const legacy = await waitForScene(page, FIXED_SEED, 1);
  await waitForFrame(legacy.rtt, legacyFrame);
  expect(new URL(page.url()).searchParams.get("sv")).toBe("1");

  const captures = new Map<number, Awaited<ReturnType<typeof captureObserver>>>();
  const captureMetadataBySeed: Array<Record<string, unknown>> = [];
  const canonicalRoute = "/simulator/guided/shelf-swing/swing-01";
  const legacyRouteFrame = await legacy.rtt.getAttribute("data-frame-request-id");
  await navigateSpaTo(page, canonicalRoute);
  const canonicalScene = await waitForScene(page);
  await waitForFrame(canonicalScene.rtt, legacyRouteFrame);
  await expect(page.getByTestId("scene-variation-controls")).toHaveCount(0);
  await closeTaskFeedbackDrawerIfOpen(page);
  await clearObserverOverlays(page, canonicalScene.scene);
  const canonicalCapture = await captureObserver(
    page,
    canonicalScene.scene,
    testInfo,
    "shelf-swing-observer-canonical-guided.png",
  );

  const initialV2Route = `${SCENE_PATH}?seed=${FROZEN_AUDIT_SEEDS[0]}&sv=2&${CAPACITY_QUERY}`;
  const canonicalFrame = await canonicalScene.rtt.getAttribute("data-frame-request-id");
  await navigateSpaTo(page, initialV2Route);
  let current = await waitForScene(page, FROZEN_AUDIT_SEEDS[0], 2);
  await waitForFrame(current.rtt, canonicalFrame);
  await closeTaskFeedbackDrawerIfOpen(page);
  await clearObserverOverlays(page, current.scene);
  await setStandardCameraState(page, current.rtt);
  await clearObserverOverlays(page, current.scene);

  for (const seed of FROZEN_AUDIT_SEEDS) {
    const route = `${SCENE_PATH}?seed=${seed}&sv=2&${CAPACITY_QUERY}`;
    if (seed !== FROZEN_AUDIT_SEEDS[0]) {
      const previousFrame = await current.rtt.getAttribute("data-frame-request-id");
      await navigateSpaTo(page, route);
      current = await waitForScene(page, seed, 2);
      await waitForFrame(current.rtt, previousFrame);
    }
    const { scene, rtt } = current;
    const capture = await captureObserver(
      page,
      scene,
      testInfo,
      `shelf-swing-observer-schema-v2-seed-${seed}.png`,
    );
    const cssBounds = await scene.locator("canvas").first().boundingBox();
    expect(cssBounds).not.toBeNull();
    expect(cssBounds!.width).toBeCloseTo(514, 0);
    expect(cssBounds!.height).toBeCloseTo(410.39, 0);
    expect(capture.canvasSize).toEqual({ width: 514, height: 411 });
    expect(capture.cameraPosition).toBe("4.200000,1.450000,1.400000");
    expect(capture.orbitTarget).toBe("0.000000,-0.040000,3.850000");
    expect(new URL(page.url()).searchParams.get("seed")).toBe(String(seed));
    expect(new URL(page.url()).searchParams.get("sv")).toBe("2");
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);
    expect(await page.getByRole("slider", { name: "Focus distance" }).inputValue())
      .toBe(String(controlSolution.focusDistanceMm));
    expect(await page.getByRole("slider", { name: "Swing" }).inputValue())
      .toBe(String(controlSolution.frontSwingDeg));
    await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute(
      "data-selected-aperture",
      "11",
    );
    await expect(rtt).toHaveAttribute("data-frame-result-status", "completed");
    expect(capture.cameraPosition).toBe(canonicalCapture.cameraPosition);
    expect(capture.orbitTarget).toBe(canonicalCapture.orbitTarget);
    captures.set(seed, capture);

    const descriptor = resolveSceneVariationDescriptor(
      shelfSwingScene,
      createSceneVariantIdentity("shelf-swing", seed, 2),
    );
    const plan = resolveShelfSwingPropVariationPlan(descriptor ?? undefined);
    if (!plan || plan.schemaVersion !== 2) throw new Error(`Missing schema-v2 plan for seed ${seed}`);
    captureMetadataBySeed.push({
      seed,
      route,
      ...captureMetadata(capture),
      cssCanvasBounds: cssBounds,
      devicePixelRatio: 1,
      renderQuality: "standard",
      focusDistanceMm: controlSolution.focusDistanceMm,
      frontSwingDeg: controlSolution.frontSwingDeg,
      riseMm: 0,
      aperture: 11,
      activeSchema: 2,
      fallbackUsed: plan.fallbackUsed,
      stations: plan.stations.map((station) => ({
        stationId: station.stationId,
        composition: station.composition,
      })),
      props: plan.stations.flatMap((station) => station.props.map((prop) => ({
        stationId: station.stationId,
        composition: "composition" in station ? station.composition : "single",
        id: prop.id,
        family: prop.family,
        dimensionsMm: prop.dimensionsMm,
        positionMm: prop.positionMm,
        bodyColor: prop.palette.body,
      }))),
    });
  }

  const originalFixedCapture = captures.get(FIXED_SEED);
  if (!originalFixedCapture) throw new Error("Frozen v2 sample omitted the fixed comparison seed");
  const fixedReplayRoute = `${SCENE_PATH}?seed=${FIXED_SEED}&sv=2&${CAPACITY_QUERY}`;
  await page.goto(fixedReplayRoute);
  const replay = await waitForScene(page, FIXED_SEED, 2);
  await closeTaskFeedbackDrawerIfOpen(page);
  await clearObserverOverlays(page, replay.scene);
  await setStandardCameraState(page, replay.rtt);
  await clearObserverOverlays(page, replay.scene);
  const replayCapture = await captureObserver(
    page,
    replay.scene,
    testInfo,
    "shelf-swing-observer-schema-v2-seed-284719-replay.png",
  );
  expect(replayCapture.bytes.equals(originalFixedCapture.bytes)).toBe(true);
  expect(replayCapture.cameraPosition).toBe(originalFixedCapture.cameraPosition);
  expect(replayCapture.orbitTarget).toBe(originalFixedCapture.orbitTarget);

  const rttCanvasBytes = await replay.rtt.locator("canvas").screenshot();
  await writeFile(
    path.join(await evidenceDirectory(testInfo), "shelf-swing-ground-glass-schema-v2-seed-284719.png"),
    rttCanvasBytes,
  );
  await testInfo.attach("shelf-swing-ground-glass-schema-v2-seed-284719.png", {
    body: rttCanvasBytes,
    contentType: "image/png",
  });
  const groundGlassFrame = {
    frameStatus: await replay.rtt.getAttribute("data-frame-result-status"),
    frameRequestId: await replay.rtt.getAttribute("data-frame-request-id"),
    lastCompletedRequestId: await replay.rtt.getAttribute("data-last-completed-request-id"),
    finalContentful: await replay.rtt.getAttribute("data-rtt-final-contentful"),
    actualCanvasPixels: { width: rttCanvasBytes.readUInt32BE(16), height: rttCanvasBytes.readUInt32BE(20) },
  };
  expect(groundGlassFrame.frameStatus).toBe("completed");
  expect(groundGlassFrame.frameRequestId).toBe(groundGlassFrame.lastCompletedRequestId);
  // Render-sanity readback is development-only. Production preview still
  // exposes renderer-owned camera readiness and completed profiling frames.
  await expect(replay.rtt).toHaveAttribute("data-rtt-camera-ok", "true");
  await expect(replay.rtt).toHaveAttribute("data-rtt-profiling-frame-count", /[1-9]\d*/);
  if (groundGlassFrame.finalContentful !== null) {
    expect(groundGlassFrame.finalContentful).toBe("true");
  }

  const auditEvidencePath = path.resolve("docs/render-quality/evidence/scene-variation-visual-audit");
  const historical = await cropHistoricalShelfSwingCaptures(
    page,
    await readFile(path.join(auditEvidencePath, "shelf-swing-schema-v1-seed-grid.png")),
    await readFile(path.join(auditEvidencePath, "shelf-swing-canonical-seed-284719.png")),
  );
  const v2BySeed = new Map(Array.from(captures, ([seed, capture]) => [seed, capture.bytes]));
  const v2Tiles: EvidenceTile[] = FROZEN_AUDIT_SEEDS.map((seed) => ({
    title: `Schema v2 · seed ${seed}`,
    images: [{ label: "", bytes: captures.get(seed)!.bytes }],
  }));
  await renderEvidenceSheet(page, testInfo, "shelf-swing-schema-v2-seed-grid.png", v2Tiles, 3);
  const matchedTiles: EvidenceTile[] = FROZEN_AUDIT_SEEDS.map((seed) => ({
    title: `Seed ${seed}`,
    images: [
      { label: "Schema v1", bytes: historical.v1BySeed.get(seed)! },
      { label: "Schema v2", bytes: captures.get(seed)!.bytes },
    ],
  }));
  await renderEvidenceSheet(page, testInfo, "shelf-swing-schema-v1-v2-matched-seeds.png", matchedTiles, 2);
  const blindTiles: EvidenceTile[] = SHELF_SWING_BLIND_PAIRS.map(([seedA, seedB], index) => ({
    title: `Pair P${index + 1}`,
    images: [
      { label: "A", bytes: captures.get(seedA)!.bytes },
      { label: "B", bytes: captures.get(seedB)!.bytes },
    ],
  }));
  await renderEvidenceSheet(page, testInfo, "shelf-swing-schema-v2-blind-pairs.png", blindTiles, 1);
  await renderEvidenceSheet(page, testInfo, "shelf-swing-canonical-v1-v2.png", [
    { title: "Canonical Guided", images: [{ label: "", bytes: historical.canonical }] },
    { title: "Schema v1 · seed 284719", images: [{ label: "", bytes: historical.v1BySeed.get(FIXED_SEED)! }] },
    { title: "Schema v2 · seed 284719", images: [{ label: "", bytes: originalFixedCapture.bytes }] },
  ], 3);
  await renderEvidenceSheet(page, testInfo, "shelf-swing-schema-v2-observer-ground-glass-parity.png", [
    {
      title: "Seed 284719 · completed WebGL2 outputs",
      images: [
        { label: "Observer · v2 subject", bytes: originalFixedCapture.bytes },
        { label: "Ground Glass · same descriptor", bytes: rttCanvasBytes },
      ],
    },
  ], 1);

  const imageDiagnostics = await compareHistoricalAndV2Captures(
    page,
    historical.v1BySeed,
    v2BySeed,
    historical.canonical,
  );
  const fallbackCount = captureMetadataBySeed.filter((capture) => capture.fallbackUsed === true).length;
  const familyCounts = new Map<string, number>();
  const compositionCounts = new Map<string, number>();
  for (const capture of captureMetadataBySeed) {
    for (const prop of capture.props as Array<{ family: string }>) {
      familyCounts.set(prop.family, (familyCounts.get(prop.family) ?? 0) + 1);
    }
    for (const station of capture.stations as Array<{ composition: string }>) {
      compositionCounts.set(station.composition, (compositionCounts.get(station.composition) ?? 0) + 1);
    }
  }
  const report = {
    seedSample: FROZEN_AUDIT_SEEDS,
    schemaVersion: 2,
    implicitFreePracticeSchemaVersion: 1,
    seedOnlyLegacySchemaVersion: 1,
    viewport: { width: 1440, height: 1000 },
    devicePixelRatio: 1,
    renderer: "Chromium production Vite preview · WebGL2",
    observerCssCanvas: { width: 514, height: 410.39 },
    observerCapturePixels: { width: 514, height: 411 },
    renderQuality: "standard",
    focusDistanceMm: controlSolution.focusDistanceMm,
    aperture: 11,
    frontSwingDeg: controlSolution.frontSwingDeg,
    riseMm: 0,
    cameraPosition: canonicalCapture.cameraPosition,
    orbitTarget: canonicalCapture.orbitTarget,
    overlays: "clean Observer; optical, focus, and DOF overlays disabled",
    historicalV1Source: {
      file: "docs/render-quality/evidence/scene-variation-visual-audit/shelf-swing-schema-v1-seed-grid.png",
      sourceSha256: createHash("sha256").update(await readFile(path.join(auditEvidencePath, "shelf-swing-schema-v1-seed-grid.png"))).digest("hex"),
      method: "native 514×411 cells cropped from the accepted PR #345 3×4 grid; title bands excluded",
      canonicalSource: "docs/render-quality/evidence/scene-variation-visual-audit/shelf-swing-canonical-seed-284719.png",
    },
    implicitRoute: { url: implicitUrl.pathname + implicitUrl.search, schemaVersion: 1 },
    legacySeedOnlyRoute: { requested: `${SCENE_PATH}?seed=${FIXED_SEED}`, normalizedUrl: `${SCENE_PATH}?seed=${FIXED_SEED}&sv=1`, schemaVersion: 1 },
    fixedSeedReplayPixelIdentical: true,
    fallbackCount,
    familyCounts: Object.fromEntries(familyCounts),
    compositionCounts: Object.fromEntries(compositionCounts),
    captures: captureMetadataBySeed,
    groundGlass: {
      ...groundGlassFrame,
      representativeState: "schema v2 seed 284719 · focus 3400 mm · aperture f/11 · Front Swing -4° · Raw preview orientation · processed WebGL2 path",
    },
    imageDiagnostics,
    pageErrors,
  };
  await writeFile(
    path.join(await evidenceDirectory(testInfo), "shelf-swing-schema-v2-capture-and-diagnostics.json"),
    JSON.stringify(report, null, 2),
  );
  await testInfo.attach("shelf-swing-schema-v2-capture-and-diagnostics.json", {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: "application/json",
  });
  expect(captures.size).toBe(12);
  expect(fallbackCount).toBe(0);
  expect(familyCounts.has("bowl")).toBe(true);
  expect(familyCounts.has("necked-vessel")).toBe(true);
  expect(familyCounts.has("faceted")).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("Shelf Swing schema v2 RTT stays coherent through optics and Ground Glass modes", async ({
  page,
}, testInfo) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${SCENE_PATH}?seed=${FIXED_SEED}&sv=2&${CAPACITY_QUERY}`);
  const { scene, rtt } = await waitForScene(page, FIXED_SEED, 2);
  await closeTaskFeedbackDrawerIfOpen(page);
  await clearObserverOverlays(page, scene);
  await setStandardCameraState(page, rtt);

  const rendererGeneration = await rtt.getAttribute("data-renderer-generation");
  const rttResourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  const initialCapacity = await readCapacityResidual(page);
  const apertureValues = [5.6, 11, 22] as const;
  const states: Array<{
    stationId: string;
    focusDistanceMm: number;
    frontSwingDeg: number;
    aperture: number;
    previewMode: "processed";
    orientation: "raw";
    frameRequestId: string;
    groundGlassImageSha256: string;
  }> = [];
  let previousFrame = (await rtt.getAttribute("data-frame-request-id")) ?? "";

  await setRangeDirectOnGrid(page, "Swing", 0);
  previousFrame = await waitForFrame(rtt, previousFrame);
  for (const subject of subjects) {
    const focusDistanceMm = subject.focusDetailProbeWorld.z;
    await setRangeDirectOnGrid(page, "Focus distance", focusDistanceMm);
    previousFrame = await waitForFrame(rtt, previousFrame);
    for (const aperture of apertureValues) {
      await page.getByRole("radiogroup", { name: "Aperture" })
        .getByRole("radio", { name: `f/${aperture}` }).check();
      previousFrame = await waitForFrame(rtt, previousFrame);
      await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true");
      states.push({
        stationId: subject.id,
        focusDistanceMm,
        frontSwingDeg: 0,
        aperture,
        previewMode: "processed",
        orientation: "raw",
        frameRequestId: previousFrame,
        groundGlassImageSha256: await hashRttCanvas(rtt),
      });
      await expect(rtt).toHaveAttribute("data-renderer-generation", rendererGeneration ?? "");
      await expect(rtt).toHaveAttribute("data-rtt-resource-generation", rttResourceGeneration ?? "");
    }
  }

  await setRangeDirectOnGrid(page, "Swing", controlSolution.frontSwingDeg);
  previousFrame = await waitForFrame(rtt, previousFrame);
  await setRangeDirectOnGrid(page, "Focus distance", controlSolution.focusDistanceMm);
  previousFrame = await waitForFrame(rtt, previousFrame);
  for (const aperture of apertureValues) {
    await page.getByRole("radiogroup", { name: "Aperture" })
      .getByRole("radio", { name: `f/${aperture}` }).check();
    previousFrame = await waitForFrame(rtt, previousFrame);
    await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true");
    states.push({
      stationId: "calibrated-plane",
      focusDistanceMm: controlSolution.focusDistanceMm,
      frontSwingDeg: controlSolution.frontSwingDeg,
      aperture,
      previewMode: "processed",
      orientation: "raw",
      frameRequestId: previousFrame,
      groundGlassImageSha256: await hashRttCanvas(rtt),
    });
  }

  const previewModes: Array<{
    mode: "processed" | "raw" | "upright";
    orientation: "raw-ground-glass" | "upright-assist";
    bypassDof: boolean;
    frameRequestId: string;
    groundGlassImageSha256: string;
  }> = [];
  const rawToggle = page.getByLabel("Raw RTT — bypass DOF");
  await expect(rawToggle).not.toBeChecked();
  await expect(rtt).toHaveAttribute("data-rtt-profiling-raw-debug", "false");
  previewModes.push({
    mode: "processed",
    orientation: "raw-ground-glass",
    bypassDof: false,
    frameRequestId: previousFrame,
    groundGlassImageSha256: await hashRttCanvas(rtt),
  });

  await rawToggle.check();
  previousFrame = await waitForFrame(rtt, previousFrame);
  await expect(rtt).toHaveAttribute("data-rtt-profiling-raw-debug", "true");
  previewModes.push({
    mode: "raw",
    orientation: "raw-ground-glass",
    bypassDof: true,
    frameRequestId: previousFrame,
    groundGlassImageSha256: await hashRttCanvas(rtt),
  });

  await rawToggle.uncheck();
  previousFrame = await waitForFrame(rtt, previousFrame);
  await page.getByRole("radio", { name: "Upright Assist" }).check();
  previousFrame = await waitForFrame(rtt, previousFrame);
  previewModes.push({
    mode: "upright",
    orientation: "upright-assist",
    bypassDof: false,
    frameRequestId: previousFrame,
    groundGlassImageSha256: await hashRttCanvas(rtt),
  });
  expect(new Set(previewModes.map((state) => state.groundGlassImageSha256)).size).toBeGreaterThan(1);
  expect(new Set(previewModes.map((state) => state.frameRequestId)).size).toBe(3);
  await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
  previousFrame = await waitForFrame(rtt, previousFrame);

  expect(states).toHaveLength(12);
  expect(new Set(states.map((state) => state.frameRequestId)).size).toBe(12);
  expect(new Set(states.map((state) => state.groundGlassImageSha256)).size).toBeGreaterThan(1);
  expect(await readCapacityResidual(page)).toEqual(initialCapacity);
  await expect(rtt).toHaveAttribute("data-renderer-generation", rendererGeneration ?? "");
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", rttResourceGeneration ?? "");
  expect(pageErrors).toEqual([]);

  const report = {
    seed: FIXED_SEED,
    schemaVersion: 2,
    states,
    previewModes,
    previewModeCoverage: ["processed", "raw", "upright"],
    allFramesCompleted: true,
    subjectCapacityStable: true,
    rendererGenerationStable: true,
    rttResourceGenerationStable: true,
    pageErrors,
  };
  await writeFile(path.join(await evidenceDirectory(testInfo), "shelf-swing-focus-aperture-matrix.json"), JSON.stringify(report, null, 2));
  await testInfo.attach("shelf-swing-focus-aperture-matrix.json", {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: "application/json",
  });
});

test("Shelf Swing schema v2 regeneration preserves camera state, history, RTT frames, and bounded resources", async ({
  page,
}, testInfo) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${SCENE_PATH}?seed=${FIXED_SEED}&sv=2&keep=one&${CAPACITY_QUERY}#pilot`);
  const { scene, rtt } = await waitForScene(page, FIXED_SEED, 2);
  await closeTaskFeedbackDrawerIfOpen(page);
  await clearObserverOverlays(page, scene);
  await setStandardCameraState(page, rtt);
  await page.getByRole("radio", { name: "Upright Assist" }).check();
  await waitForFrame(rtt);
  const cameraBeforeOrbit = (await scene.getAttribute("data-observer-camera-position")) ?? "";
  await orbitScene(page, scene);
  await expect.poll(() => scene.getAttribute("data-observer-camera-position"))
    .not.toBe(cameraBeforeOrbit);
  const cameraPosition = (await scene.getAttribute("data-observer-camera-position")) ?? "";
  const orbitTarget = (await scene.getAttribute("data-orbit-target")) ?? "";
  const rendererGeneration = await rtt.getAttribute("data-renderer-generation");
  const rttResourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  const initialRequestId = await rtt.getAttribute("data-frame-request-id");
  const initialCapacity = await readCapacityResidual(page);
  const initialScreenshot = await scene.locator("canvas").first().screenshot();
  const seenSeeds = new Set([FIXED_SEED]);
  const arrangementHashes = new Set([
    createHash("sha256").update(initialScreenshot).digest("hex"),
  ]);
  const resourceCounts: Array<{ geometries: number; textures: number }> = [initialCapacity.renderer];
  const planCapacities = new Set([JSON.stringify(initialCapacity.subject)]);

  const regenerate = page.getByRole("button", { name: "Regenerate scene" });
  const regenerateOnce = async (previousSeed: number, previousRequestId: string | null) => {
    await regenerate.click();
    const controls = page.getByTestId("scene-variation-controls");
    await expect(controls).not.toHaveAttribute("data-active-seed", String(previousSeed), { timeout: 90_000 });
    const nextSeed = Number(await controls.getAttribute("data-active-seed"));
    expect(Number.isInteger(nextSeed) && nextSeed >= 0 && nextSeed <= MAX_SEED).toBe(true);
    expect(seenSeeds.has(nextSeed)).toBe(false);
    seenSeeds.add(nextSeed);
    await expect(controls).toHaveAttribute("data-active-schema", "2");
    const nextUrl = new URL(page.url());
    expect(nextUrl.pathname).toBe(SCENE_PATH);
    expect(nextUrl.searchParams.get("seed")).toBe(String(nextSeed));
    expect(nextUrl.searchParams.get("sv")).toBe("2");
    expect(nextUrl.searchParams.get("keep")).toBe("one");
    expect(nextUrl.hash).toBe("#pilot");
    const frameRequestId = await waitForFrame(rtt, previousRequestId);
    await expect(rtt).toHaveAttribute("data-renderer-generation", rendererGeneration ?? "");
    await expect(rtt).toHaveAttribute("data-rtt-resource-generation", rttResourceGeneration ?? "");
    await assertCameraAndPreviewPreserved(page, scene, cameraPosition, orbitTarget);
    const capacity = await readCapacityResidual(page);
    const screenshot = await scene.locator("canvas").first().screenshot();
    arrangementHashes.add(createHash("sha256").update(screenshot).digest("hex"));
    resourceCounts.push(capacity.renderer);
    planCapacities.add(JSON.stringify(capacity.subject));
    return { seed: nextSeed, frameRequestId, capacity };
  };

  const firstB = await regenerateOnce(FIXED_SEED, initialRequestId);
  await page.getByRole("button", { name: "Copy share URL" }).click();
  await expect(page.getByTestId("scene-variation-controls").getByRole("status"))
    .toContainText("Share URL copied");
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedUrl).toBe(page.url());

  await page.goBack();
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(FIXED_SEED));
  await expect.poll(() => rtt.getAttribute("data-frame-request-id")).not.toBe(firstB.frameRequestId);
  await waitForFrame(rtt);
  await assertCameraAndPreviewPreserved(page, scene, cameraPosition, orbitTarget);
  const restoredA = await readCapacityResidual(page);
  expect(restoredA).toEqual(initialCapacity);

  await page.goForward();
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(firstB.seed));
  await expect.poll(() => rtt.getAttribute("data-frame-request-id")).not.toBe(firstB.frameRequestId);
  const restoredBFrame = await waitForFrame(rtt);
  await assertCameraAndPreviewPreserved(page, scene, cameraPosition, orbitTarget);
  expect(await readCapacityResidual(page)).toEqual(firstB.capacity);

  let previousSeed = firstB.seed;
  let previousFrameId = restoredBFrame;
  const regeneratedSeeds = [firstB.seed];
  for (let index = 1; index < 10; index += 1) {
    const result = await regenerateOnce(previousSeed, previousFrameId);
    regeneratedSeeds.push(result.seed);
    previousSeed = result.seed;
    previousFrameId = result.frameRequestId;
  }

  expect(regeneratedSeeds).toHaveLength(10);
  expect(new Set(regeneratedSeeds).size).toBe(10);
  expect(arrangementHashes.size).toBeGreaterThanOrEqual(5);
  expect(planCapacities.size).toBeGreaterThanOrEqual(2);
  const geometryCounts = resourceCounts.map((item) => item.geometries);
  const textureCounts = resourceCounts.map((item) => item.textures);
  expect(Math.max(...geometryCounts) - Math.min(...geometryCounts)).toBeLessThanOrEqual(20);
  expect(Math.max(...textureCounts) - Math.min(...textureCounts)).toBeLessThanOrEqual(12);
  expect(geometryCounts.every((value, index) => index === 0 || value > geometryCounts[index - 1])).toBe(false);
  expect(textureCounts.every((value, index) => index === 0 || value > textureCounts[index - 1])).toBe(false);
  const finalProfile = await readCapacity(page);
  expect(finalProfile.groundGlass?.enabled).toBe(true);
  expect(finalProfile.groundGlass?.frame.count).toBeGreaterThan(0);
  expect(errors).toEqual([]);

  await writeFile(path.join(await evidenceDirectory(testInfo), "shelf-swing-regeneration-capacity.json"), JSON.stringify({
    initialSeed: FIXED_SEED,
    regeneratedSeeds,
    regenerationCount: 10,
    historyBackRestoredCapacity: restoredA,
    historyForwardRestoredCapacity: firstB.capacity,
    resourceCounts,
    distinctSubjectCapacities: planCapacities.size,
    distinctObserverImages: arrangementHashes.size,
    cameraPosition,
    orbitTarget,
    preservedFocusDistanceMm: controlSolution.focusDistanceMm,
    preservedFrontSwingDeg: controlSolution.frontSwingDeg,
    preservedAperture: 11,
    preservedPreviewMode: "upright",
    preservedCleanObserver: true,
    rendererGenerationStable: true,
    rttResourceGenerationStable: true,
    copyUrl: copiedUrl,
    groundGlassFrameCount: finalProfile.groundGlass?.frame.count,
    pageErrors: errors,
  }, null, 2));
});

test("Shelf Swing subject capacity recovers across canonical, v1, v2, and guided/free transitions", async ({
  page,
}, testInfo) => {
  test.setTimeout(480_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${SCENE_PATH}?seed=${FIXED_SEED}&sv=2&${CAPACITY_QUERY}`);
  const { scene, rtt } = await waitForScene(page, FIXED_SEED, 2);
  await closeTaskFeedbackDrawerIfOpen(page);
  await clearObserverOverlays(page, scene);
  await setStandardCameraState(page, rtt);

  const rendererGeneration = await rtt.getAttribute("data-renderer-generation");
  const rttResourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  const variants: Record<string, Awaited<ReturnType<typeof readCapacityResidual>>> = {
    "schema-v2-a": await readCapacityResidual(page),
  };

  const transition = async (route: string, seed?: number, schemaVersion = 1) => {
    const previousFrame = await rtt.getAttribute("data-frame-request-id");
    await navigateSpaTo(page, route);
    if (seed === undefined) {
      await waitForScene(page);
      await expect(page.getByTestId("scene-variation-controls")).toHaveCount(0);
    } else {
      await waitForScene(page, seed, schemaVersion);
    }
    await waitForFrame(rtt, previousFrame);
    await expect(rtt).toHaveAttribute("data-renderer-generation", rendererGeneration ?? "");
    await expect(rtt).toHaveAttribute("data-rtt-resource-generation", rttResourceGeneration ?? "");
    return readCapacityResidual(page);
  };

  variants["schema-v1-fixed"] = await transition(
    `${SCENE_PATH}?seed=${FIXED_SEED}&sv=1&${CAPACITY_QUERY}`,
    FIXED_SEED,
    1,
  );
  variants["schema-v2-a-restored"] = await transition(
    `${SCENE_PATH}?seed=${FIXED_SEED}&sv=2&${CAPACITY_QUERY}`,
    FIXED_SEED,
    2,
  );
  variants["schema-v2-b"] = await transition(
    `${SCENE_PATH}?seed=${MAX_SEED}&sv=2&${CAPACITY_QUERY}`,
    MAX_SEED,
    2,
  );
  variants.canonical = await transition(
    `/simulator/guided/shelf-swing/swing-01?${CAPACITY_QUERY}`,
  );
  variants["free-after-guided"] = await transition(
    `${SCENE_PATH}?seed=${FIXED_SEED}&sv=2&${CAPACITY_QUERY}`,
    FIXED_SEED,
    2,
  );
  variants["guided-after-free"] = await transition(
    `/simulator/guided/shelf-swing/swing-01?${CAPACITY_QUERY}`,
  );

  expect(variants["schema-v2-a-restored"]).toEqual(variants["schema-v2-a"]);
  expect(variants["free-after-guided"]).toEqual(variants["schema-v2-a"]);
  expect(variants["guided-after-free"]).toEqual(variants.canonical);
  expect(variants["schema-v1-fixed"].subject).not.toEqual(variants["schema-v2-a"].subject);
  expect(variants["schema-v2-b"].subject).not.toEqual(variants["schema-v2-a"].subject);
  const geometryCounts = Object.values(variants).map(({ renderer }) => renderer.geometries);
  const textureCounts = Object.values(variants).map(({ renderer }) => renderer.textures);
  expect(Math.max(...geometryCounts) - Math.min(...geometryCounts)).toBeLessThanOrEqual(20);
  expect(Math.max(...textureCounts) - Math.min(...textureCounts)).toBeLessThanOrEqual(12);
  expect(geometryCounts.every((value, index) => index === 0 || value > geometryCounts[index - 1])).toBe(false);
  expect(textureCounts.every((value, index) => index === 0 || value > textureCounts[index - 1])).toBe(false);
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true");
  expect(pageErrors).toEqual([]);

  const report = {
    initialSeed: FIXED_SEED,
    schemaVersion: 2,
    transitions: Object.keys(variants),
    variants,
    rendererGenerationStable: true,
    rttResourceGenerationStable: true,
    aAfterBRestored: true,
    guidedFreeGuidedCapacityRestored: true,
    geometryCounts,
    textureCounts,
    pageErrors,
  };
  await writeFile(
    path.join(await evidenceDirectory(testInfo), "shelf-swing-cross-variant-capacity.json"),
    JSON.stringify(report, null, 2),
  );
  await testInfo.attach("shelf-swing-cross-variant-capacity.json", {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: "application/json",
  });
});
