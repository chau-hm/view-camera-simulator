import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import type { SceneDefinition } from "../../types/scene";
import type { SceneVariationDescriptor } from "../../types/sceneVariation";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import {
  resolveArchitectureForegroundMaterialVariations,
} from "../../scenes/architectureForegroundMaterialVariation";
import {
  resolveTableTiltMaterialVariations,
} from "../../scenes/tableTiltMaterialVariation";
import {
  createSceneVariantIdentity,
  resolveSceneVariationDescriptor,
} from "../../scenes/sceneVariation";

const REQUIRED_SEEDS = [0, 1, 284719, 0xffff_ffff] as const;
// Frozen before Round 2 family appearances are inspected. Keep this sample stable.
const ADDITIONAL_SEEDS = [
  17,
  2024,
  8675309,
  123456789,
  987654321,
  2718281828,
  3141592653,
  4000000000,
] as const;
const VISUAL_SAMPLE_SEEDS = [...REQUIRED_SEEDS, ...ADDITIONAL_SEEDS];
const DIAGNOSTICS = "sceneCapacityProfiling=1&rttDiagnostics=1";

type SceneCase = Readonly<{
  definition: SceneDefinition;
  id: "architecture-foreground" | "table-tilt";
  guidedTaskId: string;
  resolveMaterials: (descriptor: SceneVariationDescriptor | undefined) => unknown;
}>;

const SCENES: readonly SceneCase[] = [
  {
    definition: architectureForegroundScene,
    id: "architecture-foreground",
    guidedTaskId: "architecture-foreground-compound-01",
    resolveMaterials: resolveArchitectureForegroundMaterialVariations,
  },
  {
    definition: tableTiltScene,
    id: "table-tilt",
    guidedTaskId: "tilt-01",
    resolveMaterials: resolveTableTiltMaterialVariations,
  },
];

const CAPTURE_OVERLAY_MASK = ".learning-overlay-panel, .scene-overlay-responsive, .btn--viewport-action, .groundglass-view-control, .groundglass-focus-label, .groundglass-scale-cue, [data-testid='ground-glass-blur-display-hint'], [data-testid='ground-glass-focus-loupe'], [data-testid='ground-glass-image-layer'] + div { visibility: hidden !important; pointer-events: none !important; }";

const evidenceDirectory = async (testInfo: TestInfo): Promise<string> => {
  const directory = process.env.SCENE_VARIATION_EVIDENCE_DIR
    ? path.resolve(process.env.SCENE_VARIATION_EVIDENCE_DIR)
    : testInfo.outputPath("appearance-family-captures");
  await mkdir(directory, { recursive: true });
  return directory;
};

const appBasePath = (testInfo: TestInfo): string => {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright project has no baseURL");
  const pathname = new URL(baseURL).pathname.replace(/\/$/, "");
  return pathname === "/" ? "" : pathname;
};

const appRoute = (testInfo: TestInfo, route: string): string =>
  `${appBasePath(testInfo)}${route}`;

const waitForCompletedGroundGlass = async (page: Page): Promise<string> => {
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect.poll(async () => {
    const request = await rtt.getAttribute("data-frame-request-id");
    const complete = await rtt.getAttribute("data-last-completed-request-id");
    return Boolean(request && request === complete);
  }, { timeout: 120_000 }).toBe(true);
  await expect(rtt).toHaveAttribute("data-frame-result-status", "completed");
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true");
  return (await rtt.getAttribute("data-frame-request-id")) ?? "";
};

const prepareCleanObserver = async (page: Page, sceneId: string) => {
  const scene = page.getByTestId("scene-canvas");
  await expect(scene).toHaveAttribute("data-observer-renderer-status", "active", {
    timeout: 120_000,
  });
  await expect(scene).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(scene).toHaveAttribute("data-observer-execution-backend", "webgl2");
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", sceneId);
  await waitForCompletedGroundGlass(page);
  await page.getByLabel("Render quality").selectOption("standard");

  const sceneFocus = page.getByRole("group", { name: "View Focus" })
    .getByRole("button", { name: "Scene", exact: true });
  if (await sceneFocus.getAttribute("aria-pressed") !== "true") await sceneFocus.click();
  const closeTask = page.getByRole("button", { name: "Close Task and Feedback" });
  if (await closeTask.count()) await closeTask.click();

  const overlayTrigger = page.getByRole("button", { name: "View overlays" });
  if (await overlayTrigger.count()) await overlayTrigger.click();
  const overlayControls = page.locator(".scene-overlay-controls").first();
  await expect(overlayControls).toBeVisible();
  const activeOverlays = overlayControls.locator("button[aria-pressed='true']");
  while (await activeOverlays.count()) await activeOverlays.first().click();
  await expect(activeOverlays).toHaveCount(0);
  if (await overlayTrigger.count() && await overlayTrigger.getAttribute("aria-expanded") === "true") {
    await overlayTrigger.click();
  }
  await page.getByRole("button", { name: "Reset 3D view", exact: true }).click();
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(scene).toHaveAttribute("data-view-focus", "scene");
  return { scene, rtt };
};

const readObserverState = async (page: Page, scene: ReturnType<Page["getByTestId"]>) => {
  const pose = await scene.evaluate((element) => ({
    position: element.getAttribute("data-observer-camera-position"),
    target: element.getAttribute("data-orbit-target"),
    viewFocus: element.getAttribute("data-view-focus"),
  }));
  if (!pose.position || !pose.target) throw new Error("Observer pose diagnostics are unavailable");
  const focusDistanceMm = Number(await page.getByRole("slider", {
    name: "Focus distance",
    exact: true,
  }).inputValue());
  const aperture = await page.getByRole("radiogroup", { name: "Aperture" })
    .getAttribute("data-selected-aperture");
  const movements = await page.locator(".movement-controls").evaluateAll((groups) =>
    groups.map((group) => ({
      standard: group.getAttribute("data-standard"),
      controls: [...group.querySelectorAll<HTMLInputElement>('input[type="range"]')].map((input) => ({
        label: input.getAttribute("aria-label") ?? input.labels?.[0]?.textContent?.trim() ?? "",
        value: Number(input.value),
      })),
    })),
  );
  const rendererGeneration = await scene.getAttribute("data-observer-renderer-generation");
  if (!aperture || !rendererGeneration || !Number.isFinite(focusDistanceMm)) {
    throw new Error("Observer camera or renderer state is incomplete");
  }
  return {
    ...pose,
    focusDistanceMm,
    aperture: Number(aperture),
    movements,
    rendererGeneration,
  };
};

const captureObserver = async (
  page: Page,
  scene: ReturnType<Page["getByTestId"]>,
  directory: string,
  filename: string,
) => {
  const canvas = scene.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error(`Observer canvas is hidden for ${filename}`);
  const output = path.join(directory, filename);
  const captureMask = await page.addStyleTag({
    content: CAPTURE_OVERLAY_MASK,
  });
  try {
    await canvas.screenshot({ path: output });
  } finally {
    await captureMask.evaluate((element) => element.parentNode?.removeChild(element));
  }
  const bytes = await readFile(output);
  return {
    filename,
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
};

type ObserverCrop = Readonly<{ x: number; y: number; width: number; height: number }>;

const captureObserverCrop = async (
  page: Page,
  scene: ReturnType<Page["getByTestId"]>,
  directory: string,
  filename: string,
  crop: ObserverCrop,
) => {
  const canvas = scene.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error(`Observer canvas is hidden for ${filename}`);
  const clip = {
    x: Math.round(bounds.x + bounds.width * crop.x),
    y: Math.round(bounds.y + bounds.height * crop.y),
    width: Math.round(bounds.width * crop.width),
    height: Math.round(bounds.height * crop.height),
  };
  const captureMask = await page.addStyleTag({ content: CAPTURE_OVERLAY_MASK });
  const output = path.join(directory, filename);
  try {
    await page.screenshot({ path: output, clip });
  } finally {
    await captureMask.evaluate((element) => element.parentNode?.removeChild(element));
  }
  const bytes = await readFile(output);
  return {
    filename,
    width: clip.width,
    height: clip.height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
};

type ArchitectureDetailView = "front-facade" | "side" | "window-limestone" | "roofline-cornice" | "paving-close-up";
type ArchitectureDetailCapture = Readonly<{
  filename: string;
  label: string;
  cameraPosition: string;
  orbitTarget: string;
  sha256: string;
}>;

const captureArchitectureDetailViews = async (
  page: Page,
  scene: ReturnType<Page["getByTestId"]>,
  directory: string,
  seed: number,
  baselinePose: string,
): Promise<Record<ArchitectureDetailView, ArchitectureDetailCapture>> => {
  const canvas = scene.locator("canvas").first();
  const resetView = page.getByRole("button", { name: "Reset 3D view", exact: true });
  const pose = async () => scene.evaluate((element) => ({
    cameraPosition: element.getAttribute("data-observer-camera-position") ?? "",
    orbitTarget: element.getAttribute("data-orbit-target") ?? "",
  }));
  const currentPose = async () => {
    const value = await pose();
    return `${value.cameraPosition}|${value.orbitTarget}`;
  };
  const reset = async () => {
    await resetView.click();
    await expect.poll(currentPose).toBe(baselinePose);
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
  };
  const canvasCenter = async () => {
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("Architecture Observer canvas is not visible for detail capture");
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  };
  const orbit = async (deltaX: number, deltaY: number) => {
    const center = await canvasCenter();
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + deltaX, center.y + deltaY, { steps: 12 });
    await page.mouse.up();
    await expect.poll(currentPose).not.toBe(baselinePose);
  };
  const zoomIn = async (steps: number) => {
    const center = await canvasCenter();
    await page.mouse.move(center.x, center.y);
    for (let index = 0; index < steps; index += 1) {
      await page.mouse.wheel(0, -120);
    }
    await expect.poll(currentPose).not.toBe(baselinePose);
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
  };
  const capture = async (
    view: ArchitectureDetailView,
    action: () => Promise<void>,
    crop?: ObserverCrop,
  ): Promise<ArchitectureDetailCapture> => {
    await reset();
    await action();
    const actualPose = await pose();
    const filename = `architecture-foreground-v2-${view}-seed-${seed}.png`;
    const image = crop
      ? await captureObserverCrop(page, scene, directory, filename, crop)
      : await captureObserver(page, scene, directory, filename);
    return {
      filename,
      label: `Seed ${seed}`,
      cameraPosition: actualPose.cameraPosition,
      orbitTarget: actualPose.orbitTarget,
      sha256: image.sha256,
    };
  };

  return {
    "front-facade": await capture("front-facade", async () => {}, {
      x: 0.2, y: 0.13, width: 0.52, height: 0.62,
    }),
    side: await capture("side", () => orbit(230, 0)),
    "window-limestone": await capture("window-limestone", () => zoomIn(20)),
    "roofline-cornice": await capture("roofline-cornice", async () => {}, {
      x: 0.18, y: 0.17, width: 0.66, height: 0.25,
    }),
    "paving-close-up": await capture("paving-close-up", async () => {
      await orbit(0, 26);
      await zoomIn(16);
    }, {
      x: 0.05, y: 0.55, width: 0.9, height: 0.4,
    }),
  };
};

const writeContactSheet = async (
  page: Page,
  directory: string,
  filename: string,
  captures: readonly { filename: string; label: string }[],
): Promise<void> => {
  const images = await Promise.all(captures.map(async ({ filename: captureFilename, label }) => ({
    label,
    dataUrl: `data:image/png;base64,${(await readFile(path.join(directory, captureFilename))).toString("base64")}`,
  })));
  const dataUrl = await page.evaluate(async (items) => {
    const panelWidth = 680;
    const panelHeight = 460;
    const columns = 2;
    const rows = Math.ceil(items.length / columns);
    const canvas = document.createElement("canvas");
    canvas.width = columns * panelWidth;
    canvas.height = rows * panelHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser canvas 2D context unavailable for evidence sheet");
    context.fillStyle = "#101820";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const [index, item] of items.entries()) {
      const image = new Image();
      image.src = item.dataUrl;
      await image.decode();
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = column * panelWidth;
      const y = row * panelHeight;
      context.fillStyle = "#eef2f3";
      context.fillRect(x, y, panelWidth, panelHeight);
      context.fillStyle = "#17212b";
      context.font = "600 18px system-ui, sans-serif";
      context.fillText(item.label, x + 16, y + 26, panelWidth - 32);
      const scale = Math.min((panelWidth - 24) / image.width, (panelHeight - 52) / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(
        image,
        x + (panelWidth - width) / 2,
        y + 38 + (panelHeight - 52 - height) / 2,
        width,
        height,
      );
    }
    return canvas.toDataURL("image/png");
  }, images);
  const encoded = dataUrl.split(",")[1];
  if (!encoded) throw new Error("Evidence contact sheet did not return PNG data");
  await writeFile(path.join(directory, filename), Buffer.from(encoded, "base64"));
};

const captureScene = async (page: Page, testInfo: TestInfo, scene: SceneCase) => {
  const directory = await evidenceDirectory(testInfo);
  const viewport = { width: 1440, height: 1000 };
  await page.setViewportSize(viewport);
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);

  const canonicalPath = `/simulator/guided/${scene.id}/${scene.guidedTaskId}?${DIAGNOSTICS}`;
  await page.goto(appRoute(testInfo, canonicalPath));
  const guided = await prepareCleanObserver(page, scene.id);
  await expect(page.getByTestId("scene-variation-controls")).toHaveCount(0);
  const canonicalState = await readObserverState(page, guided.scene);
  const canonicalCapture = await captureObserver(
    page,
    guided.scene,
    directory,
    `${scene.id}-appearance-family-guided-canonical.png`,
  );

  const baselinePose = canonicalState.position + "|" + canonicalState.target;
  const captures: Array<Record<string, unknown>> = [];
  const sheetEntries: Array<{ filename: string; label: string }> = [];
  let replayReferenceSha: string | undefined;
  let sharedFreeState: Awaited<ReturnType<typeof readObserverState>> | undefined;
  const seedCaptures = new Map<number, { filename: string; label: string }>();

  for (const seed of VISUAL_SAMPLE_SEEDS) {
    const route = `/simulator/free/${scene.id}?seed=${seed}&sv=1&${DIAGNOSTICS}`;
    await page.goto(appRoute(testInfo, route));
    const runtime = await prepareCleanObserver(page, scene.id);
    const controls = page.getByTestId("scene-variation-controls");
    await expect(controls).toHaveAttribute("data-active-seed", String(seed));
    await expect(controls).toHaveAttribute("data-active-schema", "1");
    const resolvedUrl = new URL(page.url());
    expect(resolvedUrl.pathname).toBe(appRoute(testInfo, `/simulator/free/${scene.id}`));
    expect(resolvedUrl.searchParams.get("seed")).toBe(String(seed));
    expect(resolvedUrl.searchParams.get("sv")).toBe("1");

    const state = await readObserverState(page, runtime.scene);
    expect(state.viewFocus).toBe("scene");
    expect(state.position + "|" + state.target).toBe(baselinePose);
    if (sharedFreeState) {
      expect(state.focusDistanceMm).toBe(sharedFreeState.focusDistanceMm);
      expect(state.aperture).toBe(sharedFreeState.aperture);
      expect(state.movements).toEqual(sharedFreeState.movements);
    } else {
      sharedFreeState = state;
    }

    const descriptor = resolveSceneVariationDescriptor(
      scene.definition,
      createSceneVariantIdentity(scene.id, seed, 1),
    );
    if (!descriptor) throw new Error(`Missing scene variation descriptor for ${scene.id}`);
    const materialParameters = scene.resolveMaterials(descriptor);
    const filename = `${scene.id}-appearance-family-seed-${seed}.png`;
    const capture = await captureObserver(page, runtime.scene, directory, filename);
    expect(capture.width).toBe(canonicalCapture.width);
    expect(capture.height).toBe(canonicalCapture.height);
    expect(capture.width).toBeGreaterThanOrEqual(480);
    expect(capture.width).toBeLessThanOrEqual(560);
    const requestId = await waitForCompletedGroundGlass(page);
    const rtt = await page.getByTestId("ground-glass-rtt").evaluate((element) => ({
      requestId: element.getAttribute("data-frame-request-id"),
      completedRequestId: element.getAttribute("data-last-completed-request-id"),
      sceneId: element.getAttribute("data-frame-scene-id"),
      frameStatus: element.getAttribute("data-frame-result-status"),
      subjectGeneration: element.getAttribute("data-rtt-sanity-state")?.match(/subject-generation:([^|]+)/)?.[1] ?? null,
      resourceGeneration: element.getAttribute("data-rtt-resource-generation"),
    }));
    expect(rtt.requestId).toBe(rtt.completedRequestId);
    expect(rtt.sceneId).toBe(scene.id);
    expect(rtt.frameStatus).toBe("completed");

    captures.push({
      seed,
      schemaVersion: 1,
      mode: "free",
      state,
      materialParameters,
      observerCapture: capture,
      groundGlass: { ...rtt, requestId },
    });
    const entry = { filename, label: `Seed ${seed}` };
    sheetEntries.push(entry);
    seedCaptures.set(seed, entry);
    if (seed === 284719) replayReferenceSha = capture.sha256;
  }

  const replayPath = `/simulator/free/${scene.id}?seed=284719&sv=1&${DIAGNOSTICS}`;
  await page.goto(appRoute(testInfo, replayPath));
  const replayRuntime = await prepareCleanObserver(page, scene.id);
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", "284719");
  const replayState = await readObserverState(page, replayRuntime.scene);
  expect(replayState.position + "|" + replayState.target).toBe(baselinePose);
  const replayFilename = `${scene.id}-appearance-family-seed-284719-url-replay.png`;
  const replayCapture = await captureObserver(page, replayRuntime.scene, directory, replayFilename);
  const replayCaptureSha = replayCapture.sha256;
  expect(replayCaptureSha).toBe(replayReferenceSha);
  sheetEntries.push({ filename: replayFilename, label: "Seed 284719 · URL replay" });

  const familyCoverage = captures.reduce<Record<string, number[]>>((coverage, capture) => {
    const materialParameters = capture.materialParameters as { appearanceFamily?: string };
    const family = materialParameters.appearanceFamily ?? "unreported";
    coverage[family] ??= [];
    coverage[family].push(capture.seed as number);
    return coverage;
  }, {});

  const requiredComparisonEntries = [
    { filename: canonicalCapture.filename, label: "Guided · canonical" },
    ...REQUIRED_SEEDS.map((seed) => seedCaptures.get(seed)!),
  ];
  await writeContactSheet(
    page,
    directory,
    `${scene.id}-appearance-family-required-comparison.png`,
    requiredComparisonEntries,
  );
  await writeContactSheet(
    page,
    directory,
    `${scene.id}-appearance-family-seed-sample.png`,
    sheetEntries.filter(({ label }) => !label.includes("URL replay")),
  );
  const report = {
    captureHead: process.env.SCENE_VARIATION_CAPTURE_HEAD ?? "unspecified working tree",
    captureMode: process.env.SCENE_VARIATION_CAPTURE_MODE ?? "unspecified",
    sceneId: scene.id,
    schemaVersion: 1,
    viewport,
    devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
    renderQuality: "standard",
    observer: {
      overlays: "disabled through public controls",
      resetAction: "Reset 3D view",
      cameraPosition: canonicalState.position,
      cameraTarget: canonicalState.target,
      canonicalState,
      freeState: sharedFreeState,
      canonicalCapture,
      captures,
      replay: {
        seed: 284719,
        capture: replayCapture,
        matchesSeedCapture: replayCaptureSha === replayReferenceSha,
      },
    },
    fixedSeedSample: {
      required: REQUIRED_SEEDS,
      additionalSelectedBeforeVisualInspection: ADDITIONAL_SEEDS,
      allSeeds: VISUAL_SAMPLE_SEEDS,
    },
    familyCoverage,
    contactSheets: {
      requiredComparison: `${scene.id}-appearance-family-required-comparison.png`,
      multiSeedSample: `${scene.id}-appearance-family-seed-sample.png`,
    },
  };
  await writeFile(
    path.join(directory, `${scene.id}-appearance-family-report.json`),
    JSON.stringify(report, null, 2),
  );
};

test.describe("Wave 1 material appearance family visual qualification", () => {
  test.use({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  for (const scene of SCENES) {
    test(`${scene.id} captures a matched canonical and frozen Free Mode seed sample`, async ({ page }, testInfo) => {
      test.setTimeout(900_000);
      await captureScene(page, testInfo, scene);
    });
  }
});

test("Architecture + Foreground renders the unrepresented cool-contemporary candidate family", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const scene = SCENES[0]!;
  const seed = Array.from({ length: 1024 }, (_, candidate) => candidate).find((candidate) => {
    const descriptor = resolveSceneVariationDescriptor(
      scene.definition,
      createSceneVariantIdentity(scene.id, candidate, 1),
    );
    return descriptor && resolveArchitectureForegroundMaterialVariations(descriptor)?.appearanceFamily ===
      "cool-contemporary";
  });
  if (seed === undefined) throw new Error("No cool-contemporary diagnostic seed found in [0, 1023]");

  const directory = await evidenceDirectory(testInfo);
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);
  await page.goto(appRoute(testInfo, `/simulator/free/${scene.id}?seed=${seed}&sv=1&${DIAGNOSTICS}`));
  const runtime = await prepareCleanObserver(page, scene.id);
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(seed));
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-schema", "1");
  const descriptor = resolveSceneVariationDescriptor(
    scene.definition,
    createSceneVariantIdentity(scene.id, seed, 1),
  );
  if (!descriptor) throw new Error("Missing cool-contemporary diagnostic descriptor");
  const materials = resolveArchitectureForegroundMaterialVariations(descriptor);
  expect(materials?.appearanceFamily).toBe("cool-contemporary");
  const state = await readObserverState(page, runtime.scene);
  expect(state.viewFocus).toBe("scene");
  const filename = "architecture-foreground-cool-contemporary-family-diagnostic.png";
  const capture = await captureObserver(page, runtime.scene, directory, filename);
  const requestId = await waitForCompletedGroundGlass(page);
  const rtt = await page.getByTestId("ground-glass-rtt").evaluate((element) => ({
    requestId: element.getAttribute("data-frame-request-id"),
    completedRequestId: element.getAttribute("data-last-completed-request-id"),
    sceneId: element.getAttribute("data-frame-scene-id"),
    frameStatus: element.getAttribute("data-frame-result-status"),
  }));
  expect(rtt.requestId).toBe(rtt.completedRequestId);
  expect(rtt.sceneId).toBe(scene.id);
  expect(rtt.frameStatus).toBe("completed");
  await writeFile(
    path.join(directory, "architecture-foreground-cool-contemporary-family-diagnostic.json"),
    JSON.stringify({
      captureMode: "candidate-family diagnostic; excluded from frozen twelve-seed coverage",
      sceneId: scene.id,
      seed,
      schemaVersion: 1,
      viewport: { width: 1440, height: 1000 },
      devicePixelRatio: 1,
      renderQuality: "standard",
      state,
      materials,
      observerCapture: capture,
      groundGlass: { ...rtt, requestId },
    }, null, 2),
  );
});

test("Architecture + Foreground v2 captures matched facade and material detail views", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const scene = SCENES[0]!;
  const directory = await evidenceDirectory(testInfo);
  const viewport = { width: 1440, height: 1000 };
  const seeds = [0, 284719, 0xffff_ffff] as const;
  const captures: Record<ArchitectureDetailView, ArchitectureDetailCapture[]> = {
    "front-facade": [],
    side: [],
    "window-limestone": [],
    "roofline-cornice": [],
    "paving-close-up": [],
  };
  const frameRecords: Array<Record<string, unknown>> = [];
  let baselinePose: string | undefined;
  let baselineCameraState: Awaited<ReturnType<typeof readObserverState>> | undefined;

  await page.setViewportSize(viewport);
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);

  for (const seed of seeds) {
    const route = `/simulator/free/${scene.id}?seed=${seed}&sv=1&${DIAGNOSTICS}`;
    await page.goto(appRoute(testInfo, route));
    const runtime = await prepareCleanObserver(page, scene.id);
    const controls = page.getByTestId("scene-variation-controls");
    await expect(controls).toHaveAttribute("data-active-seed", String(seed));
    await expect(controls).toHaveAttribute("data-active-schema", "1");
    const resolvedUrl = new URL(page.url());
    expect(resolvedUrl.pathname).toBe(appRoute(testInfo, `/simulator/free/${scene.id}`));
    expect(resolvedUrl.searchParams.get("seed")).toBe(String(seed));
    expect(resolvedUrl.searchParams.get("sv")).toBe("1");

    const state = await readObserverState(page, runtime.scene);
    expect(state.viewFocus).toBe("scene");
    const pose = state.position + "|" + state.target;
    if (baselinePose && baselineCameraState) {
      expect(pose).toBe(baselinePose);
      expect(state.focusDistanceMm).toBe(baselineCameraState.focusDistanceMm);
      expect(state.aperture).toBe(baselineCameraState.aperture);
      expect(state.movements).toEqual(baselineCameraState.movements);
    } else {
      baselinePose = pose;
      baselineCameraState = state;
    }

    const detailViews = await captureArchitectureDetailViews(
      page,
      runtime.scene,
      directory,
      seed,
      baselinePose,
    );
    Object.entries(detailViews).forEach(([view, capture]) => {
      captures[view as ArchitectureDetailView].push(capture);
    });

    const requestId = await waitForCompletedGroundGlass(page);
    const rtt = await page.getByTestId("ground-glass-rtt").evaluate((element) => ({
      requestId: element.getAttribute("data-frame-request-id"),
      completedRequestId: element.getAttribute("data-last-completed-request-id"),
      sceneId: element.getAttribute("data-frame-scene-id"),
      status: element.getAttribute("data-frame-result-status"),
      orientation: element.getAttribute("data-rtt-preview-mode"),
      dofProcessingEnabled: element.getAttribute("data-rtt-dof-processing-enabled"),
    }));
    expect(rtt.requestId).toBe(rtt.completedRequestId);
    expect(rtt.sceneId).toBe(scene.id);
    expect(rtt.status).toBe("completed");
    frameRecords.push({ seed, state, requestId, rtt });
  }

  const contactSheets: Record<string, string> = {};
  for (const [view, viewCaptures] of Object.entries(captures) as Array<[
    ArchitectureDetailView,
    ArchitectureDetailCapture[],
  ]>) {
    expect(viewCaptures).toHaveLength(seeds.length);
    expect(new Set(viewCaptures.map(({ cameraPosition, orbitTarget }) =>
      `${cameraPosition}|${orbitTarget}`,
    )).size).toBe(1);
    const filename = `architecture-foreground-v2-${view}-seed-comparison.png`;
    await writeContactSheet(page, directory, filename, viewCaptures);
    contactSheets[view] = filename;
  }

  await writeFile(
    path.join(directory, "architecture-foreground-v2-detail-views-report.json"),
    JSON.stringify({
      captureHead: process.env.SCENE_VARIATION_CAPTURE_HEAD ?? "unspecified working tree",
      captureMode: process.env.SCENE_VARIATION_CAPTURE_MODE ?? "unspecified",
      sceneId: scene.id,
      schemaVersion: 1,
      viewport,
      devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
      renderQuality: "standard",
      seeds,
      observerPoseMustMatchAcrossSeeds: true,
      focusApertureAndMovementValuesMustMatchAcrossSeeds: true,
      detailViews: captures,
      groundGlassFrames: frameRecords,
      contactSheets,
      detailCrops: "Front facade, roofline and paving captures are native browser pixels cropped from clean Observer canvases without scaling or retouching; no brightness treatment or retouching was applied.",
    }, null, 2),
  );
});
