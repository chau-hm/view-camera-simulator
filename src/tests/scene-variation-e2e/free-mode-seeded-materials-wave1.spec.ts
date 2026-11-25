import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import * as THREE from "three";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import tableTiltGeometry, { tableTiltCalibration } from "../../scenes/tableTiltGeometry";
import { WORLD_SCALE } from "../../render/rttUtils";
import {
  applyGroundGlassRttDisplayTransform,
  resolveGroundGlassRttDisplayTransform,
} from "../../render/groundGlassRttOrientation";
import { setRangeDirectOnGrid } from "../e2e/helpers/rangeInput";

const FIXED_SEED = 284719;
const MAX_SEED = 0xffff_ffff;
const DIAGNOSTICS = "rttDiagnostics=1&sceneCapacityProfiling=1&dofProfiling=1";

type SceneCase = {
  id: "architecture-foreground" | "table-tilt";
  guidedTaskId: string;
};

type SceneCapacityMetrics = {
  objectCount: number;
  meshCount: number;
  uniqueGeometryCount: number;
  uniqueMaterialCount: number;
  uniqueTextureCount: number;
  effectiveTriangleCount: number;
};

type SceneCapacitySnapshot = {
  viewportSubject: SceneCapacityMetrics | null;
  rttSubject: SceneCapacityMetrics | null;
  rendererResources: { geometries: number; textures: number } | null;
  frameCadence: Record<string, number | null>;
  groundGlass: {
    profilingBackend?: string;
    timingUnit?: string;
    frame?: Record<string, unknown>;
    groundGlassCpuSubmit?: Record<string, unknown> | null;
    physicalDofCpuSubmit?: Record<string, unknown> | null;
  } | null;
};

type SceneCapacityShape = {
  viewportSubject: Record<string, number>;
  rttSubject: Record<string, number>;
  rendererResources: { geometries: number; textures: number };
  frameCadence: Record<string, number | null>;
  groundGlass: {
    profilingBackend: string | undefined;
    timingUnit: string | undefined;
    frame: Record<string, unknown> | undefined;
    groundGlassCpuSubmit: Record<string, unknown> | null | undefined;
    physicalDofCpuSubmit: Record<string, unknown> | null | undefined;
  } | null;
};

const SCENES: readonly SceneCase[] = [
  { id: "architecture-foreground", guidedTaskId: "architecture-foreground-compound-01" },
  { id: "table-tilt", guidedTaskId: "tilt-01" },
];

const evidenceDirectory = async (testInfo: TestInfo): Promise<string> => {
  const directory = process.env.SCENE_VARIATION_EVIDENCE_DIR
    ? path.resolve(process.env.SCENE_VARIATION_EVIDENCE_DIR)
    : testInfo.outputPath("captures");
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

const waitForCompletedFrame = async (rtt: Locator): Promise<string> => {
  await expect.poll(async () => {
    const requestId = await rtt.getAttribute("data-frame-request-id");
    const completedRequestId = await rtt.getAttribute("data-last-completed-request-id");
    const status = await rtt.getAttribute("data-frame-result-status");
    const rawContentful = await rtt.getAttribute("data-rtt-raw-contentful");
    const finalContentful = await rtt.getAttribute("data-rtt-final-contentful");
    return Boolean(
      requestId &&
      requestId === completedRequestId &&
      status === "completed" &&
      rawContentful === "true" &&
      finalContentful === "true",
    );
  }, { timeout: 120_000 }).toBe(true);
  return (await rtt.getAttribute("data-frame-request-id")) ?? "";
};

const waitForSceneReady = async (page: Page, sceneId: string) => {
  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(scene).toHaveAttribute("data-observer-renderer-status", "active", {
    timeout: 120_000,
  });
  await expect(scene).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(scene).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", sceneId);
  await expect(rtt.locator("canvas").first()).toBeVisible();
  await waitForCompletedFrame(rtt);
  await page.getByLabel("Render quality").selectOption("standard");
  const sceneFocus = page.getByRole("group", { name: "View Focus" }).getByRole("button", { name: "Scene", exact: true });
  await expect(sceneFocus).toHaveAttribute("aria-pressed", "true");
  const closeLearningPanel = page.getByRole("button", { name: "Close Task and Feedback" });
  if (await closeLearningPanel.count()) await closeLearningPanel.click();
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
  const groundGlassGrid = page.locator(".groundglass-panel").getByRole("checkbox", { name: "Grid" });
  if (await groundGlassGrid.count() && await groundGlassGrid.isEnabled() && await groundGlassGrid.isChecked()) {
    await groundGlassGrid.uncheck();
    await waitForCompletedFrame(rtt);
  }
  await page.addStyleTag({
    content: ".learning-overlay-panel, .scene-overlay-responsive, .btn--viewport-action, .groundglass-view-control, .groundglass-focus-label, .groundglass-scale-cue, [data-testid='ground-glass-blur-display-hint'], [data-testid='ground-glass-focus-loupe'], [data-testid='ground-glass-image-layer'] + div { visibility: hidden !important; pointer-events: none !important; }",
  });
  return { scene, rtt };
};

const waitForCapacity = async (page: Page): Promise<SceneCapacitySnapshot> => {
  const snapshot = page.getByTestId("scene-capacity-snapshot").first();
  await expect.poll(async () => {
    const content = (await snapshot.textContent())?.trim() ?? "";
    if (!content.includes('"rendererResources"')) return false;
    const parsed = JSON.parse(content) as SceneCapacitySnapshot;
    return Boolean(parsed.viewportSubject && parsed.rttSubject && parsed.rendererResources);
  }, { timeout: 60_000 }).toBe(true);
  const content = (await snapshot.textContent())?.trim();
  if (!content) throw new Error("Scene capacity diagnostics did not publish a snapshot");
  return JSON.parse(content) as SceneCapacitySnapshot;
};

const capacityShape = (snapshot: SceneCapacitySnapshot): SceneCapacityShape => {
  const viewportSubject = snapshot.viewportSubject;
  const rttSubject = snapshot.rttSubject;
  const rendererResources = snapshot.rendererResources;
  if (!viewportSubject || !rttSubject || !rendererResources) {
    throw new Error("Scene capacity snapshot is missing a subject or renderer resource count");
  }
  return {
  viewportSubject: {
    objects: viewportSubject.objectCount,
    meshes: viewportSubject.meshCount,
    geometries: viewportSubject.uniqueGeometryCount,
    materials: viewportSubject.uniqueMaterialCount,
    textures: viewportSubject.uniqueTextureCount,
    triangles: viewportSubject.effectiveTriangleCount,
  },
  rttSubject: {
    objects: rttSubject.objectCount,
    meshes: rttSubject.meshCount,
    geometries: rttSubject.uniqueGeometryCount,
    materials: rttSubject.uniqueMaterialCount,
    textures: rttSubject.uniqueTextureCount,
    triangles: rttSubject.effectiveTriangleCount,
  },
  rendererResources,
  frameCadence: snapshot.frameCadence,
  groundGlass: snapshot.groundGlass
    ? {
        profilingBackend: snapshot.groundGlass.profilingBackend,
        timingUnit: snapshot.groundGlass.timingUnit,
        frame: snapshot.groundGlass.frame,
        groundGlassCpuSubmit: snapshot.groundGlass.groundGlassCpuSubmit,
        physicalDofCpuSubmit: snapshot.groundGlass.physicalDofCpuSubmit,
      }
    : null,
  };
};

const captureCanvas = async (
  locator: Locator,
  directory: string,
  filename: string,
): Promise<{ filename: string; width: number; height: number; sha256: string }> => {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Cannot capture hidden canvas ${filename}`);
  const outputPath = path.join(directory, filename);
  await locator.screenshot({ path: outputPath });
  const bytes = await readFile(outputPath);
  return {
    filename,
    width: Math.round(box.width),
    height: Math.round(box.height),
    sha256: createHash("sha256").update(bytes).digest("hex"),
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
      context.drawImage(image, x + (panelWidth - width) / 2, y + 38 + (panelHeight - 52 - height) / 2, width, height);
    }
    return canvas.toDataURL("image/png");
  }, images);
  await writeFile(
    path.join(directory, filename),
    Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"),
  );
};

const setFocusToAnotherReachableValue = async (page: Page): Promise<number> => {
  const focus = page.getByRole("slider", { name: "Focus distance" });
  const range = await focus.evaluate((element) => {
    const input = element as HTMLInputElement;
    return {
      min: Number(input.min),
      max: Number(input.max),
      step: Number(input.step),
      value: Number(input.value),
    };
  });
  const midpointSteps = Math.round(((range.min + range.max) / 2 - range.min) / range.step);
  let target = range.min + midpointSteps * range.step;
  if (target === range.value) {
    target = target + range.step <= range.max ? target + range.step : target - range.step;
  }
  await setRangeDirectOnGrid(page, "Focus distance", target);
  return target;
};

const setMovementToAnotherReachableValue = async (page: Page, label: string): Promise<number> => {
  const slider = page.getByRole("slider", { name: label });
  const range = await slider.evaluate((element) => {
    const input = element as HTMLInputElement;
    return {
      min: Number(input.min),
      max: Number(input.max),
      step: Number(input.step),
      value: Number(input.value),
    };
  });
  const quarterSteps = Math.round(((range.min + range.max) / 4 - range.min) / range.step);
  let target = range.min + quarterSteps * range.step;
  if (target === range.value) {
    target = target + range.step <= range.max ? target + range.step : target - range.step;
  }
  await setRangeDirectOnGrid(page, label, target);
  return target;
};

const subjectGeneration = async (rtt: Locator): Promise<string> => {
  const stateKey = await rtt.getAttribute("data-rtt-sanity-state");
  const generation = stateKey?.match(/subject-generation:([^|]+)/)?.[1];
  if (!generation) throw new Error(`Ground Glass has no subject generation in ${stateKey ?? "sanity key"}`);
  return generation;
};

const qualifyScene = async (page: Page, testInfo: TestInfo, sceneCase: SceneCase) => {
  const { id: sceneId, guidedTaskId } = sceneCase;
  const directory = await evidenceDirectory(testInfo);
  const observerCaptures: Array<{ filename: string; label: string }> = [];
  const groundGlassCaptures: Array<{ filename: string; label: string }> = [];
  const visualRecords: Array<Record<string, unknown>> = [];
  const capacityByStage: Record<string, unknown> = {};

  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);

  const guidedPath = `/simulator/guided/${sceneId}/${guidedTaskId}?${DIAGNOSTICS}`;
  await page.goto(appRoute(testInfo, guidedPath));
  const canonical = await waitForSceneReady(page, sceneId);
  await expect(page.getByRole("button", { name: "Regenerate scene" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy share URL" })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("seed")).toBe(false);
  const guidedFilename = `${sceneId}-observer-guided-canonical.png`;
  const guidedCapture = await captureCanvas(canonical.scene.locator("canvas").first(), directory, guidedFilename);
  observerCaptures.push({
    filename: guidedFilename,
    label: sceneId === "table-tilt"
      ? "Integrated Guided canonical · matches PR #357 baseline signature"
      : "Guided · canonical",
  });
  visualRecords.push({ sceneId, mode: "guided-canonical", ...guidedCapture });
  capacityByStage.guidedCanonical = capacityShape(await waitForCapacity(page));

  const seedCases = sceneId === "table-tilt"
    ? [
        { seed: 0, slug: "seed-0" },
        { seed: 1, slug: "seed-1" },
        { seed: FIXED_SEED, slug: `seed-${FIXED_SEED}` },
        { seed: MAX_SEED, slug: `seed-${MAX_SEED}` },
      ] as const
    : [
        { seed: 0, slug: "seed-0" },
        { seed: FIXED_SEED, slug: `seed-${FIXED_SEED}` },
        { seed: MAX_SEED, slug: `seed-${MAX_SEED}` },
      ] as const;

  let fixedSeedRuntime: { scene: Locator; rtt: Locator } | undefined;

  for (const { seed, slug } of seedCases) {
    await page.goto(appRoute(testInfo, `/simulator/free/${sceneId}?seed=${seed}&sv=1&${DIAGNOSTICS}`));
    const runtime = await waitForSceneReady(page, sceneId);
    await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(seed));
    await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-schema", "1");
    expect(new URL(page.url()).searchParams.get("sv")).toBe("1");
    const observerFilename = `${sceneId}-observer-${slug}.png`;
    const observerCapture = await captureCanvas(runtime.scene.locator("canvas").first(), directory, observerFilename);
    const tableFamilyLabel = seed === 0
      ? "Medium Teak-like"
      : seed === 1
        ? "Dark Walnut-like"
        : "Light Oak-like";
    observerCaptures.push({
      filename: observerFilename,
      label: sceneId === "table-tilt"
        ? `Free · ${tableFamilyLabel} · seed ${seed}`
        : `Free · seed ${seed}`,
    });
    visualRecords.push({ sceneId, mode: "free", seed, ...observerCapture });

    const subjectGenerationBeforeControls = await subjectGeneration(runtime.rtt);
    if (sceneId === "table-tilt") {
      capacityByStage[`seed${seed}`] = capacityShape(await waitForCapacity(page));
    }
    const focusMm = await setFocusToAnotherReachableValue(page);
    await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: "f/11" }).check();
    await waitForCompletedFrame(runtime.rtt);
    await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
    const rawRequestId = await waitForCompletedFrame(runtime.rtt);
    await expect(runtime.rtt).toHaveAttribute("data-rtt-preview-mode", "raw");
    await expect(runtime.rtt).toHaveAttribute("data-rtt-raw-debug", "false");
    await expect(runtime.rtt).toHaveAttribute("data-rtt-dof-processing-enabled", "true");
    const rawFilename = `${sceneId}-ground-glass-${slug}-raw.png`;
    const rawCapture = await captureCanvas(runtime.rtt.locator("canvas").first(), directory, rawFilename);
    groundGlassCaptures.push({ filename: rawFilename, label: `${seed} · Raw` });
    visualRecords.push({ sceneId, mode: "ground-glass-raw", seed, focusMm, aperture: 11, requestId: rawRequestId, ...rawCapture });

    await page.getByRole("radio", { name: "Upright Assist" }).check();
    const uprightRequestId = await waitForCompletedFrame(runtime.rtt);
    await expect(runtime.rtt).toHaveAttribute("data-rtt-preview-mode", "upright");
    await expect(runtime.rtt).toHaveAttribute("data-rtt-raw-debug", "false");
    await expect(runtime.rtt).toHaveAttribute("data-rtt-dof-processing-enabled", "true");
    const uprightFilename = `${sceneId}-ground-glass-${slug}-upright.png`;
    const uprightCapture = await captureCanvas(runtime.rtt.locator("canvas").first(), directory, uprightFilename);
    groundGlassCaptures.push({ filename: uprightFilename, label: `${seed} · Upright` });
    visualRecords.push({ sceneId, mode: "ground-glass-upright", seed, focusMm, aperture: 11, requestId: uprightRequestId, ...uprightCapture });

    expect(await subjectGeneration(runtime.rtt)).toBe(subjectGenerationBeforeControls);
    if (seed === FIXED_SEED) {
      fixedSeedRuntime = runtime;
      const rawDebug = page.getByLabel("Raw RTT — bypass DOF");
      await expect(rawDebug).not.toBeChecked();
      await rawDebug.check();
      await waitForCompletedFrame(runtime.rtt);
      await expect(runtime.rtt).toHaveAttribute("data-rtt-preview-mode", "upright");
      await expect(runtime.rtt).toHaveAttribute("data-rtt-raw-debug", "true");
      await expect(runtime.rtt).toHaveAttribute("data-rtt-dof-processing-enabled", "false");
      await rawDebug.uncheck();
      await waitForCompletedFrame(runtime.rtt);
      await expect(runtime.rtt).toHaveAttribute("data-rtt-dof-processing-enabled", "true");
    }
  }

  if (!fixedSeedRuntime) throw new Error(`Seed ${FIXED_SEED} runtime was not qualified for ${sceneId}`);
  const { scene, rtt } = fixedSeedRuntime;

  const replayPath = `/simulator/free/${sceneId}?seed=${FIXED_SEED}&sv=1&${DIAGNOSTICS}`;
  await page.goto(appRoute(testInfo, replayPath));
  const replayRuntime = await waitForSceneReady(page, sceneId);
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(FIXED_SEED));
  const replayFilename = `${sceneId}-observer-same-seed-url-replay.png`;
  const replayCapture = await captureCanvas(replayRuntime.scene.locator("canvas").first(), directory, replayFilename);
  observerCaptures.push({
    filename: replayFilename,
    label: `Same-seed URL replay · seed ${FIXED_SEED}`,
  });
  visualRecords.push({ sceneId, mode: "same-seed-url-replay", seed: FIXED_SEED, ...replayCapture });
  fixedSeedRuntime = replayRuntime;

  await setFocusToAnotherReachableValue(page);
  await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: "f/11" }).check();
  const movementBefore: Record<string, number> = {};
  for (const label of ["Rise", "Tilt"]) {
    movementBefore[label] = await setMovementToAnotherReachableValue(page, label);
  }
  await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
  await waitForCompletedFrame(rtt);

  const cameraBeforeRegenerate = await scene.getAttribute("data-observer-camera-position");
  const focusValue = await page.getByRole("slider", { name: "Focus distance" })
    .evaluate((element) => (element as HTMLInputElement).value);
  const apertureGroup = page.getByRole("radiogroup", { name: "Aperture" });
  const initialCapacity = await waitForCapacity(page);
  const initialCapacityShape = capacityShape(initialCapacity);
  capacityByStage.regenerationStart = initialCapacityShape;

  const rendererCounts: Array<{ geometries: number; textures: number }> = [];
  const viewportCounts: Array<Record<string, number>> = [];
  const rttCounts: Array<Record<string, number>> = [];
  const subjectGenerations: string[] = [];
  const regeneratedSeeds: number[] = [];
  let previousSeed = FIXED_SEED;
  let previousGeneration = await subjectGeneration(rtt);
  let previousRequest = await rtt.getAttribute("data-frame-request-id");
  const rendererGeneration = (await rtt.getAttribute("data-renderer-generation")) ?? "";
  const rttResourceGeneration = (await rtt.getAttribute("data-rtt-resource-generation")) ?? "";
  const regenerate = page.getByRole("button", { name: "Regenerate scene" });

  for (let index = 0; index < 10; index += 1) {
    await regenerate.click();
    await expect(page.getByTestId("scene-variation-controls")).not.toHaveAttribute("data-active-seed", String(previousSeed), {
      timeout: 120_000,
    });
    const nextSeed = Number(await page.getByTestId("scene-variation-controls").getAttribute("data-active-seed"));
    expect(Number.isInteger(nextSeed) && nextSeed >= 0 && nextSeed <= MAX_SEED).toBe(true);
    expect(nextSeed).not.toBe(previousSeed);
    expect(new URL(page.url()).searchParams.get("seed")).toBe(String(nextSeed));
    expect(new URL(page.url()).searchParams.get("sv")).toBe("1");
    const requestId = await waitForCompletedFrame(rtt);
    expect(requestId).not.toBe(previousRequest);
    const generation = await subjectGeneration(rtt);
    expect(Number(generation)).toBeGreaterThan(Number(previousGeneration));
    expect(await rtt.getAttribute("data-renderer-generation")).toBe(rendererGeneration);
    expect(await rtt.getAttribute("data-rtt-resource-generation")).toBe(rttResourceGeneration);
    expect(await scene.getAttribute("data-observer-camera-position")).toBe(cameraBeforeRegenerate);
    await expect(page.getByRole("radio", { name: "Raw Ground Glass" })).toBeChecked();
    await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue(focusValue ?? "");
    await expect(apertureGroup).toHaveAttribute("data-selected-aperture", "11");
    for (const [label, value] of Object.entries(movementBefore)) {
      await expect(page.getByRole("slider", { name: label })).toHaveValue(String(value));
    }
    const shape = capacityShape(await waitForCapacity(page));
    viewportCounts.push(shape.viewportSubject);
    rttCounts.push(shape.rttSubject);
    rendererCounts.push(shape.rendererResources);
    regeneratedSeeds.push(nextSeed);
    subjectGenerations.push(generation);
    previousSeed = nextSeed;
    previousGeneration = generation;
    previousRequest = requestId;
  }

  const isStable = (records: readonly Record<string, number>[]) =>
    records.every((record) => JSON.stringify(record) === JSON.stringify(records[0]));
  expect(viewportCounts).toHaveLength(10);
  expect(rttCounts).toHaveLength(10);
  expect(rendererCounts).toHaveLength(10);
  expect(isStable(viewportCounts)).toBe(true);
  expect(isStable(rttCounts)).toBe(true);
  expect(isStable(rendererCounts)).toBe(true);
  expect(new Set(subjectGenerations).size).toBe(10);

  const latestSeed = previousSeed;
  const previousHistorySeed = regeneratedSeeds[regeneratedSeeds.length - 2] ?? FIXED_SEED;
  await page.goBack();
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(previousHistorySeed));
  await waitForCompletedFrame(rtt);
  await page.goForward();
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(latestSeed));
  await waitForCompletedFrame(rtt);

  await writeContactSheet(page, directory, `${sceneId}-observer-contact-sheet.png`, observerCaptures);
  await writeContactSheet(page, directory, `${sceneId}-ground-glass-contact-sheet.png`, groundGlassCaptures);
  await writeFile(path.join(directory, `${sceneId}-report.json`), JSON.stringify({
    sceneId,
    viewport: { width: 1440, height: 1000 },
    devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
    observerCaptures: observerCaptures.map((capture) => ({ ...capture, ...visualRecords.find((record) => record.filename === capture.filename) })),
    groundGlassCaptures: groundGlassCaptures.map((capture) => ({ ...capture, ...visualRecords.find((record) => record.filename === capture.filename) })),
    capacityByStage,
    regeneration: {
      actionCount: regeneratedSeeds.length,
      seeds: regeneratedSeeds,
      subjectGenerations,
      rendererCounts,
      viewportCounts,
      rttCounts,
      controlsPreserved: { focusValue, aperture: 11, movement: movementBefore, observerCameraPosition: cameraBeforeRegenerate },
      initialRendererGeneration: rendererGeneration,
      initialRttResourceGeneration: rttResourceGeneration,
    },
  }, null, 2));
};

type RangeControlState = { min: number; max: number; step: number; value: number };

const readRangeControl = async (page: Page, label: string): Promise<RangeControlState> =>
  page.getByRole("slider", { name: label, exact: true }).evaluate((element) => {
    const input = element as HTMLInputElement;
    return {
      min: Number(input.min),
      max: Number(input.max),
      step: Number(input.step),
      value: Number(input.value),
    };
  });

const setRangeToNearestReachableValue = async (
  page: Page,
  label: string,
  requested: number,
): Promise<{ requested: number; actual: number; min: number; max: number; step: number }> => {
  const range = await readRangeControl(page, label);
  if (requested < range.min || requested > range.max) {
    throw new Error(
      `${label} calibration ${requested} is outside the public range ${range.min}–${range.max}`,
    );
  }
  const steps = Math.round((requested - range.min) / range.step);
  const actual = Number((range.min + steps * range.step).toFixed(6));
  await setRangeDirectOnGrid(page, label, actual);
  await expect(page.getByRole("slider", { name: label, exact: true })).toHaveValue(String(actual));
  expect(Math.abs(actual - requested)).toBeLessThanOrEqual(range.step / 2 + 1e-8);
  return { requested, actual, min: range.min, max: range.max, step: range.step };
};

const setTableTiltCalibratedCamera = async (page: Page, rtt: Locator) => {
  const controls = page.locator('.movement-controls[data-standard="front"]');
  await expect(controls).toHaveCount(1);
  await expect(controls.locator(".movement-controls__heading")).toHaveText("Front standard");

  const tilt = controls.getByRole("slider", { name: "Tilt", exact: true });
  await expect(tilt).toBeEnabled();
  const initialSubjectGeneration = await subjectGeneration(rtt);
  const initialCapacity = capacityShape(await waitForCapacity(page));
  const assertMaterialResourcesStable = async () => {
    await expect(rtt).toHaveAttribute("data-rtt-sanity-state", new RegExp(`subject-generation:${initialSubjectGeneration}(?:\\||$)`));
    const capacity = capacityShape(await waitForCapacity(page));
    expect(capacity.viewportSubject.textures).toBe(initialCapacity.viewportSubject.textures);
    expect(capacity.rttSubject.textures).toBe(initialCapacity.rttSubject.textures);
    expect(capacity.rendererResources).toEqual(initialCapacity.rendererResources);
  };

  let previousRequestId = await rtt.getAttribute("data-frame-request-id");
  const tiltValue = await setRangeToNearestReachableValue(
    page,
    "Tilt",
    tableTiltCalibration.frontTiltDeg,
  );
  await expect.poll(async () => rtt.getAttribute("data-frame-request-id"), {
    timeout: 120_000,
  }).not.toBe(previousRequestId);
  await waitForCompletedFrame(rtt);
  await assertMaterialResourcesStable();
  previousRequestId = await rtt.getAttribute("data-frame-request-id");

  const focusValue = await setRangeToNearestReachableValue(
    page,
    "Focus distance",
    tableTiltCalibration.focusDistanceMm,
  );
  await expect.poll(async () => rtt.getAttribute("data-frame-request-id"), {
    timeout: 120_000,
  }).not.toBe(previousRequestId);
  await waitForCompletedFrame(rtt);
  await assertMaterialResourcesStable();

  for (const label of ["Rise", "Swing"]) {
    const slider = page.getByRole("slider", { name: label, exact: true });
    const current = Number(await slider.inputValue());
    if (current !== 0) await setRangeDirectOnGrid(page, label, 0);
    await expect(slider).toHaveValue("0");
  }

  await page.getByRole("radiogroup", { name: "Aperture" })
    .getByRole("radio", { name: "f/11" }).check();
  await expect(page.getByRole("slider", { name: "Tilt", exact: true }))
    .toHaveValue(String(tiltValue.actual));
  await expect(page.getByRole("slider", { name: "Focus distance", exact: true }))
    .toHaveValue(String(focusValue.actual));
  await expect(page.getByRole("radiogroup", { name: "Aperture" }))
    .toHaveAttribute("data-selected-aperture", "11");
  const requestId = await waitForCompletedFrame(rtt);
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true");
  await expect(rtt).toHaveAttribute("data-rtt-raw-debug", "false");
  await expect(rtt).toHaveAttribute("data-rtt-dof-processing-enabled", "true");

  return {
    movementControl: "Front standard / Tilt",
    frontRiseMm: Number(await page.getByRole("slider", { name: "Rise", exact: true }).inputValue()),
    frontTilt: tiltValue,
    frontSwingDeg: Number(await page.getByRole("slider", { name: "Swing", exact: true }).inputValue()),
    focusDistance: focusValue,
    aperture: 11,
    requestId,
    materialSubjectGeneration: initialSubjectGeneration,
    materialTextureCounts: {
      observer: initialCapacity.viewportSubject.textures,
      rtt: initialCapacity.rttSubject.textures,
      renderer: initialCapacity.rendererResources.textures,
    },
    materialResourcesStableDuringTiltAndFocus: true,
  };
};

const readRttCaptureDiagnostics = async (
  rtt: Locator,
  previewMode: "raw" | "upright",
  dofBypass = false,
) => {
  const attributes = await rtt.evaluate((element) => {
    const names = [
      "data-rtt-camera-position",
      "data-rtt-camera-up",
      "data-rtt-camera-forward",
      "data-rtt-projection-matrix",
      "data-rtt-camera-near-world",
      "data-rtt-camera-far-world",
      "data-rtt-camera-ok",
      "data-rtt-projection-determinant",
      "data-rtt-preview-mode",
      "data-rtt-raw-debug",
      "data-rtt-dof-processing-enabled",
      "data-rtt-dof-mode",
      "data-frame-request-id",
      "data-last-completed-request-id",
      "data-frame-result-status",
      "data-frame-scene-id",
      "data-renderer-generation",
      "data-rtt-resource-generation",
      "data-rtt-owner-id",
      "data-rtt-sanity-state",
      "data-rtt-raw-contentful",
      "data-rtt-final-contentful",
    ];
    return Object.fromEntries(names.map((name) => [name, element.getAttribute(name)]));
  });
  expect(attributes["data-frame-result-status"]).toBe("completed");
  expect(attributes["data-frame-request-id"]).toBe(attributes["data-last-completed-request-id"]);
  expect(attributes["data-frame-scene-id"]).toBe("table-tilt");
  expect(attributes["data-rtt-camera-ok"]).toBe("true");
  expect(attributes["data-rtt-preview-mode"]).toBe(previewMode);
  expect(attributes["data-rtt-raw-debug"]).toBe(String(dofBypass));
  expect(attributes["data-rtt-dof-processing-enabled"]).toBe(String(!dofBypass));

  const tuple = (name: string, length: number): number[] => {
    const value = attributes[name];
    if (!value) throw new Error(`Ground Glass diagnostic ${name} is unavailable`);
    const parsed = value.split(",").map(Number);
    if (parsed.length !== length || !parsed.every(Number.isFinite)) {
      throw new Error(`Ground Glass diagnostic ${name} is invalid: ${value}`);
    }
    return parsed;
  };
  const cameraPositionWorld = tuple("data-rtt-camera-position", 3);
  const cameraUpWorld = tuple("data-rtt-camera-up", 3);
  const cameraForwardWorld = tuple("data-rtt-camera-forward", 3);
  const projectionMatrix = tuple("data-rtt-projection-matrix", 16);
  const nearWorld = Number(attributes["data-rtt-camera-near-world"]);
  const farWorld = Number(attributes["data-rtt-camera-far-world"]);
  const projectionDeterminant = Number(attributes["data-rtt-projection-determinant"]);
  expect(Number.isFinite(nearWorld) && nearWorld > 0).toBe(true);
  expect(Number.isFinite(farWorld) && farWorld > nearWorld).toBe(true);
  expect(Number.isFinite(projectionDeterminant) && Math.abs(projectionDeterminant) > 0).toBe(true);

  const camera = new THREE.PerspectiveCamera();
  camera.position.fromArray(cameraPositionWorld);
  camera.up.fromArray(cameraUpWorld);
  camera.lookAt(
    camera.position.clone().add(new THREE.Vector3().fromArray(cameraForwardWorld)),
  );
  camera.updateMatrixWorld(true);
  camera.projectionMatrix.fromArray(projectionMatrix);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  const project = (pointMm: { x: number; y: number; z: number }) => {
    const ndc = new THREE.Vector3(
      pointMm.x * WORLD_SCALE,
      pointMm.y * WORLD_SCALE,
      pointMm.z * WORLD_SCALE,
    ).project(camera);
    const sourceUv = { u: (ndc.x + 1) / 2, v: (1 - ndc.y) / 2 };
    const displayUv = applyGroundGlassRttDisplayTransform(
      sourceUv,
      resolveGroundGlassRttDisplayTransform(previewMode),
    );
    return {
      ndc: { x: ndc.x, y: ndc.y, z: ndc.z },
      sourceUv,
      displayUv,
      insideFilmAndClip: ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1 && ndc.z >= -1 && ndc.z <= 1,
    };
  };
  const { tabletop } = tableTiltGeometry;
  const tabletopTopCorners = [
    { id: "near-left", localX: -tabletop.width / 2, localDepth: tabletop.nearLocalDepth },
    { id: "near-right", localX: tabletop.width / 2, localDepth: tabletop.nearLocalDepth },
    { id: "far-left", localX: -tabletop.width / 2, localDepth: tabletop.farLocalDepth },
    { id: "far-right", localX: tabletop.width / 2, localDepth: tabletop.farLocalDepth },
  ].map(({ id, ...local }) => ({
    id,
    worldMm: tableTiltGeometry.tabletopLocalToWorld(local),
  }));
  const tableBounds = tabletopTopCorners.map(({ id, worldMm }) => ({ id, worldMm, ...project(worldMm) }));
  const focusDetails = tableTiltGeometry.subjects.map((subject) => ({
    id: subject.id,
    worldMm: subject.focusDetailProbeWorld,
    ...project(subject.focusDetailProbeWorld),
  }));
  const tabletopCornersInsideFilmAndClip = tableBounds.filter((point) => point.insideFilmAndClip).length;
  const focusDetailsInsideFilmAndClip = focusDetails.filter((point) => point.insideFilmAndClip).length;
  expect(tableBounds).toHaveLength(4);
  expect(tabletopCornersInsideFilmAndClip).toBeGreaterThan(0);
  expect(focusDetails).toHaveLength(3);
  expect(focusDetailsInsideFilmAndClip).toBe(3);

  return {
    requestId: attributes["data-frame-request-id"],
    completedRequestId: attributes["data-last-completed-request-id"],
    frameStatus: attributes["data-frame-result-status"],
    sceneId: attributes["data-frame-scene-id"],
    previewMode,
    dofBypass,
    dofProcessingEnabled: !dofBypass,
    dofMode: attributes["data-rtt-dof-mode"],
    rawContentful: attributes["data-rtt-raw-contentful"],
    finalContentful: attributes["data-rtt-final-contentful"],
    rendererGeneration: attributes["data-renderer-generation"],
    subjectGeneration: attributes["data-rtt-sanity-state"]?.match(/subject-generation:([^|]+)/)?.[1] ?? null,
    rttResourceGeneration: attributes["data-rtt-resource-generation"],
    rttOwnerId: attributes["data-rtt-owner-id"],
    camera: {
      lensWorldPosition: cameraPositionWorld,
      filmPlaneUpWorld: cameraUpWorld,
      opticalAxisWorld: cameraForwardWorld,
      nearWorld,
      farWorld,
      projectionDeterminant,
      projectionMatrix,
    },
    framingProjectionSummary: {
      tabletopCornersInsideFilmAndClip,
      tabletopTopCornerCount: tableBounds.length,
      focusDetailsInsideFilmAndClip,
      focusDetailCount: focusDetails.length,
      interpretation: "Projected focus-detail points being inside the film is separate from whether their physical markings are legible at normal Ground Glass size.",
    },
    projectedTabletopTopCorners: tableBounds,
    projectedFocusDetails: focusDetails,
  };
};

const captureTableTiltGroundGlass = async (
  page: Page,
  rtt: Locator,
  directory: string,
  filename: string,
  label: string,
  previewMode: "raw" | "upright",
  settings: Record<string, unknown>,
) => {
  await page.getByRole("radio", {
    name: previewMode === "raw" ? "Raw Ground Glass" : "Upright Assist",
  }).check();
  await expect(rtt).toHaveAttribute("data-rtt-preview-mode", previewMode);
  await expect(rtt).toHaveAttribute("data-rtt-raw-debug", "false");
  await expect(rtt).toHaveAttribute("data-rtt-dof-processing-enabled", "true");
  const requestId = await waitForCompletedFrame(rtt);
  const capture = await captureCanvas(rtt.locator("canvas").first(), directory, filename);
  const diagnostics = await readRttCaptureDiagnostics(rtt, previewMode);
  expect(diagnostics.requestId).toBe(requestId);
  return {
    ...capture,
    label,
    settings,
    diagnostics,
  };
};

test("Table Tilt calibrated Ground Glass qualification distinguishes neutral and calibrated states", async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  const directory = await evidenceDirectory(testInfo);
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);

  const seed = FIXED_SEED;
  const route = (value: number) =>
    `/simulator/free/table-tilt?seed=${value}&sv=1&${DIAGNOSTICS}`;
  const assertSeedRoute = async (value: number) => {
    await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(value));
    await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-schema", "1");
    const url = new URL(page.url());
    expect(url.pathname).toBe(appRoute(testInfo, "/simulator/free/table-tilt"));
    expect(url.searchParams.get("seed")).toBe(String(value));
    expect(url.searchParams.get("sv")).toBe("1");
  };

  await page.goto(appRoute(testInfo, route(seed)));
  const { rtt } = await waitForSceneReady(page, "table-tilt");
  await assertSeedRoute(seed);
  await expect(page.getByRole("slider", { name: "Tilt", exact: true })).toHaveValue("0");
  const neutralFocusMm = tableTiltScene.cameraPreset.focusDistanceMm;
  const frontControls = page.locator('.movement-controls[data-standard="front"]');
  await expect(frontControls).toHaveCount(1);
  await expect(frontControls.locator(".movement-controls__heading")).toHaveText("Front standard");
  await expect(page.getByRole("slider", { name: "Rise", exact: true })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Focus distance", exact: true }))
    .toHaveValue(String(neutralFocusMm));
  await expect(page.getByRole("slider", { name: "Swing", exact: true })).toHaveValue("0");
  await expect(page.getByRole("radiogroup", { name: "Aperture" }))
    .toHaveAttribute("data-selected-aperture", "11");
  await expect(rtt).toHaveAttribute("data-rtt-raw-debug", "false");
  await expect(rtt).toHaveAttribute("data-rtt-dof-processing-enabled", "true");

  const neutralState = {
    mode: "neutral",
    frontStandard: "front",
    frontRiseMm: tableTiltCalibration.frontRiseMm,
    frontTiltDeg: 0,
    frontSwingDeg: tableTiltCalibration.frontSwingDeg,
    focusDistanceMm: neutralFocusMm,
    focusSource: "tableTiltScene.cameraPreset.focusDistanceMm (existing zero-tilt scene default)",
    aperture: 11,
  };
  const neutralRaw = await captureTableTiltGroundGlass(
    page,
    rtt,
    directory,
    "table-tilt-ground-glass-neutral-seed-284719-raw.png",
    "Neutral · Raw · f/11",
    "raw",
    neutralState,
  );
  const neutralUpright = await captureTableTiltGroundGlass(
    page,
    rtt,
    directory,
    "table-tilt-ground-glass-neutral-seed-284719-upright.png",
    "Neutral · Upright · f/11",
    "upright",
    neutralState,
  );

  const calibratedSettings = await setTableTiltCalibratedCamera(page, rtt);
  await assertSeedRoute(seed);
  const calibratedRaw = await captureTableTiltGroundGlass(
    page,
    rtt,
    directory,
    "table-tilt-ground-glass-calibrated-seed-284719-raw.png",
    "Calibrated · Raw · f/11",
    "raw",
    calibratedSettings,
  );
  const calibratedUpright = await captureTableTiltGroundGlass(
    page,
    rtt,
    directory,
    "table-tilt-ground-glass-calibrated-seed-284719-upright.png",
    "Calibrated · Upright · f/11",
    "upright",
    calibratedSettings,
  );

  await page.getByRole("radiogroup", { name: "Aperture" })
    .getByRole("radio", { name: "f/5.6" }).check();
  await expect(page.getByRole("radiogroup", { name: "Aperture" }))
    .toHaveAttribute("data-selected-aperture", "5.6");
  const f56RequestId = await waitForCompletedFrame(rtt);
  const f56Settings = { ...calibratedSettings, aperture: 5.6, requestId: f56RequestId };
  const f56Raw = await captureTableTiltGroundGlass(
    page,
    rtt,
    directory,
    "table-tilt-ground-glass-calibrated-seed-284719-f5p6-raw.png",
    "Calibrated · Raw · f/5.6 (supporting focus view)",
    "raw",
    f56Settings,
  );
  await page.getByRole("radiogroup", { name: "Aperture" })
    .getByRole("radio", { name: "f/11" }).check();
  await expect(page.getByRole("radiogroup", { name: "Aperture" }))
    .toHaveAttribute("data-selected-aperture", "11");
  await waitForCompletedFrame(rtt);

  const rawDebug = page.getByLabel("Raw RTT — bypass DOF", { exact: true });
  await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
  await expect(rtt).toHaveAttribute("data-rtt-preview-mode", "raw");
  await expect(rawDebug).not.toBeChecked();
  await rawDebug.check();
  await expect(rtt).toHaveAttribute("data-rtt-raw-debug", "true");
  await expect(rtt).toHaveAttribute("data-rtt-dof-processing-enabled", "false");
  const bypassRequestId = await waitForCompletedFrame(rtt);
  const bypassCapture = await captureCanvas(
    rtt.locator("canvas").first(),
    directory,
    "table-tilt-ground-glass-calibrated-seed-284719-raw-rtt-bypass-dof.png",
  );
  const bypassDiagnostics = await readRttCaptureDiagnostics(rtt, "raw", true);
  expect(bypassDiagnostics.requestId).toBe(bypassRequestId);
  await rawDebug.uncheck();
  await expect(rtt).toHaveAttribute("data-rtt-dof-processing-enabled", "true");
  await waitForCompletedFrame(rtt);

  const calibratedBySeed = new Map<number, {
    raw: typeof calibratedRaw;
    upright: typeof calibratedUpright;
    settings: typeof calibratedSettings;
  }>();
  calibratedBySeed.set(seed, { raw: calibratedRaw, upright: calibratedUpright, settings: calibratedSettings });
  for (const otherSeed of [0, 1, MAX_SEED]) {
    await page.goto(appRoute(testInfo, route(otherSeed)));
    const runtime = await waitForSceneReady(page, "table-tilt");
    await assertSeedRoute(otherSeed);
    const settings = await setTableTiltCalibratedCamera(page, runtime.rtt);
    const raw = await captureTableTiltGroundGlass(
      page,
      runtime.rtt,
      directory,
      `table-tilt-ground-glass-calibrated-seed-${otherSeed}-raw.png`,
      `Seed ${otherSeed} · Calibrated · Raw · f/11`,
      "raw",
      settings,
    );
    const upright = await captureTableTiltGroundGlass(
      page,
      runtime.rtt,
      directory,
      `table-tilt-ground-glass-calibrated-seed-${otherSeed}-upright.png`,
      `Seed ${otherSeed} · Calibrated · Upright · f/11`,
      "upright",
      settings,
    );
    calibratedBySeed.set(otherSeed, { raw, upright, settings });
  }

  const neutralComparison = [neutralRaw, neutralUpright, calibratedRaw, calibratedUpright];
  await writeContactSheet(
    page,
    directory,
    "table-tilt-calibrated-neutral-vs-calibrated-contact-sheet.png",
    neutralComparison,
  );
  const seedComparison = [0, 1, seed, MAX_SEED].flatMap((value) => {
    const captures = calibratedBySeed.get(value);
    if (!captures) throw new Error(`Missing calibrated captures for seed ${value}`);
    return [captures.raw, captures.upright];
  });
  await writeContactSheet(
    page,
    directory,
    "table-tilt-calibrated-four-seed-contact-sheet.png",
    seedComparison,
  );

  const report = {
    qualification: "Table Tilt v2 final integration Ground Glass qualification",
    integrationBase: "97908ec09e630f95471ab37bbc587158738872ae",
    canonicalCompatibility: {
      currentMainAndIntegratedNoDescriptorSignature:
        "d8bcb9595b6b55b12652dd541aff1d68ce18735da5e3e5303d205b82e92c27f1",
      source: "origin/main PR #357 factory with no variation descriptor; integrated Guided path uses the same canonical construction",
    },
    viewport: { width: 1440, height: 1000 },
    devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
    sceneId: "table-tilt",
    mode: "free",
    schemaVersion: 1,
    seed: FIXED_SEED,
    originalCaptureLimitation: "The Wave 1 capture selected a generic reachable midpoint focus value rather than the authoritative Table Tilt calibration.",
    calibrationSource: "src/scenes/tableTiltGeometry.ts#tableTiltCalibration",
    calibrationRequested: {
      frontTiltDeg: tableTiltCalibration.frontTiltDeg,
      focusDistanceMm: tableTiltCalibration.focusDistanceMm,
      aperture: tableTiltCalibration.aperture,
      frontRiseMm: tableTiltCalibration.frontRiseMm,
      frontSwingDeg: tableTiltCalibration.frontSwingDeg,
    },
    neutralState,
    calibratedSettings,
    focusControlResolution: calibratedSettings.focusDistance.step,
    tiltControlResolution: calibratedSettings.frontTilt.step,
    captures: {
      neutral: [neutralRaw, neutralUpright],
      calibratedSeed284719: [calibratedRaw, calibratedUpright],
      calibratedFourSeed: [0, 1, seed, MAX_SEED].flatMap((value) => {
        const capture = calibratedBySeed.get(value);
        return capture ? [capture.raw, capture.upright] : [];
      }),
      calibratedSeed284719F56: f56Raw,
      rawRttBypassDiagnostic: {
        filename: bypassCapture.filename,
        width: bypassCapture.width,
        height: bypassCapture.height,
        sha256: bypassCapture.sha256,
        settings: { ...calibratedSettings, aperture: 11 },
        classification: "Raw RTT diagnostic; DOF processing bypassed; not an ordinary photographic Ground Glass output.",
        diagnostics: bypassDiagnostics,
      },
    },
    contactSheets: [
      "table-tilt-calibrated-neutral-vs-calibrated-contact-sheet.png",
      "table-tilt-calibrated-four-seed-contact-sheet.png",
    ],
    visualAssessment: {
      inspectionMethod: "Manual inspection of the unretouched 514×411 Chromium Ground Glass captures and contact sheets at native display size.",
      tabletopVisibility: "The tabletop appears as a narrow band near the frame edge; its wood grain and seed-to-seed differences are not reliably inspectable at normal display size.",
      focusDetailVisibility: "Near, middle, and far focus-detail points project inside the film, but their markings remain too small to read in the photographic captures.",
      framing: "LIMITED: only the far pair of projected tabletop top corners lies inside the film; the near pair is clipped. Front Tilt changes focus-plane orientation but does not materially reframe the scene.",
      rawUpright: "Correct: Raw shows the inverted subject band near the top; Upright Assist places it near the bottom.",
      f56SupportingView: "The normal f/5.6 capture is very bright with a washed-out background; it remains supporting evidence and is not used to qualify tabletop material visibility.",
      materialsQualificationThroughGroundGlass: "NEEDS_REVIEW",
      photographicFramingClassification: "LIMITED",
    },
  };
  await writeFile(path.join(directory, "table-tilt-calibrated-ground-glass-report.json"), JSON.stringify(report, null, 2));
});

test("Architecture + Foreground seeded materials qualify in Chromium at ordinary size", async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  await qualifyScene(page, testInfo, SCENES[0]);
});

test("Table Tilt seeded materials qualify in Chromium at ordinary size", async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  await qualifyScene(page, testInfo, SCENES[1]);
});

test("Focus, Aperture, Rise, and Tilt changes do not rebuild seeded material subjects", async ({ page }, testInfo) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1440, height: 1000 });

  for (const { id: sceneId } of SCENES) {
    await page.goto(appRoute(testInfo, `/simulator/free/${sceneId}?seed=${FIXED_SEED}&sv=1&${DIAGNOSTICS}`));
    const { rtt } = await waitForSceneReady(page, sceneId);
    const initialSubjectGeneration = await subjectGeneration(rtt);
    const initialCapacity = await waitForCapacity(page);
    const initialTextureCounts = {
      observer: initialCapacity.viewportSubject?.uniqueTextureCount,
      rtt: initialCapacity.rttSubject?.uniqueTextureCount,
      renderer: initialCapacity.rendererResources?.textures,
    };

    const verifyNoMaterialRebuild = async () => {
      await waitForCompletedFrame(rtt);
      expect(await subjectGeneration(rtt)).toBe(initialSubjectGeneration);
      const currentCapacity = await waitForCapacity(page);
      expect({
        observer: currentCapacity.viewportSubject?.uniqueTextureCount,
        rtt: currentCapacity.rttSubject?.uniqueTextureCount,
        renderer: currentCapacity.rendererResources?.textures,
      }).toEqual(initialTextureCounts);
    };

    await setFocusToAnotherReachableValue(page);
    await verifyNoMaterialRebuild();
    await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: "f/11" }).check();
    await verifyNoMaterialRebuild();
    await setMovementToAnotherReachableValue(page, "Rise");
    await verifyNoMaterialRebuild();
    await setMovementToAnotherReachableValue(page, "Tilt");
    await verifyNoMaterialRebuild();
  }
});
