import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { setRangeDirectOnGrid } from "../e2e/helpers/rangeInput";
import { stillLifeStudioScene } from "../../scenes/definitions/still-life-studio";
import { resolveStillLifeStudioPlan } from "../../scenes/stillLifeStudioVariation";
import { createSceneVariantIdentity, resolveSceneVariationDescriptor } from "../../scenes/sceneVariation";

const frozenSeeds = [0, 1, 284719, 4294967295, 3079748268, 654013979, 4041585854, 2762659077, 2004402848, 1824298367, 2130322642, 4065361417] as const;
const basePath = (process.env.STILL_LIFE_STUDIO_BASE_PATH ?? "/").replace(/\/$/, "");
const scenePath = `${basePath}/simulator/free/still-life-studio`;
const diagnostics = "rttDiagnostics=1&sceneCapacityProfiling=1&dofProfiling=1";
const rawDirectory = path.resolve(process.env.SCENE_VARIATION_EVIDENCE_DIR ?? "/private/tmp/still-life-studio-evidence");
const evidenceDirectory = path.resolve("docs/render-quality/evidence/still-life-studio");

const descriptorFor = (seed: number) => resolveSceneVariationDescriptor(
  stillLifeStudioScene,
  createSceneVariantIdentity(stillLifeStudioScene.id, seed, 1),
)!;

const navigateSpaTo = async (page: Page, route: string): Promise<void> => {
  await page.evaluate((nextRoute) => {
    window.history.pushState({}, "", nextRoute);
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }, route);
};

const waitForFrame = async (rtt: Locator, previous?: string | null): Promise<string> => {
  if (previous !== undefined) {
    await expect.poll(() => rtt.getAttribute("data-frame-request-id"), { timeout: 120_000 }).not.toBe(previous);
  }
  await expect.poll(async () => {
    const [requested, completed] = await Promise.all([
      rtt.getAttribute("data-frame-request-id"),
      rtt.getAttribute("data-last-completed-request-id"),
    ]);
    return Boolean(requested && requested === completed);
  }, { timeout: 120_000 }).toBe(true);
  await expect(rtt).toHaveAttribute("data-frame-result-status", "completed");
  return (await rtt.getAttribute("data-frame-request-id")) ?? "";
};

const waitForScene = async (page: Page, seed?: number) => {
  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(scene).toHaveAttribute("data-scene-subject-id", "still-life-studio");
  await expect(scene).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(scene).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(scene).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "still-life-studio");
  await expect(rtt).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(rtt).toHaveAttribute("data-actual-execution-api", "webgl2");
  await waitForFrame(rtt);
  if (seed !== undefined) {
    const controls = page.getByTestId("scene-variation-controls");
    await expect(controls).toHaveAttribute("data-active-seed", String(seed));
    await expect(controls).toHaveAttribute("data-active-schema", "1");
    await expect(controls).toContainText(`Seed ${seed} · schema v1`);
  }
  return { scene, rtt };
};

const clearObserverOverlays = async (page: Page, scene: Locator): Promise<void> => {
  const trigger = page.getByRole("button", { name: /View overlays/i });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let group = page.getByTestId("scene-overlay-inline");
    if (await group.count() !== 1) {
      group = page.getByTestId("scene-overlay-collapsed");
      if (await group.count() === 0) await trigger.click();
    }
    await expect(group).toBeVisible();
    const active = group.locator('button[aria-pressed="true"]');
    if (await active.count() === 0) break;
    await active.first().click();
  }
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
  await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");
  if (await trigger.count() === 1 && await trigger.getAttribute("aria-expanded") === "true") await trigger.click();
};

const setStandardCamera = async (page: Page, rtt: Locator): Promise<void> => {
  await page.getByLabel("Render quality").selectOption("standard");
  await setRangeDirectOnGrid(page, "Focus distance", 4100);
  await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: "f/11" }).check();
  await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
  await waitForFrame(rtt);
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue("4100");
  await expect(page.getByLabel("Render quality")).toHaveValue("standard");
  await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute("data-selected-aperture", "11");
};

const setMovementRange = async (page: Page, label: string, value: number): Promise<void> => {
  const slider = page.getByRole("slider", { name: label });
  const [minText, maxText, stepText] = await Promise.all([
    slider.getAttribute("min"), slider.getAttribute("max"), slider.getAttribute("step"),
  ]);
  if (minText === null || maxText === null || stepText === null) throw new Error(`${label} is missing its public range`);
  const minimum = Number(minText);
  const maximum = Number(maxText);
  const step = Number(stepText);
  if (value < minimum || value > maximum || Math.abs((value - minimum) / step - Math.round((value - minimum) / step)) > 1e-8) {
    throw new Error(`${label} value ${value} is outside its public control grid`);
  }
  await slider.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Range input value setter unavailable");
    setter.call(input, String(nextValue));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await expect(slider).toHaveValue(String(value));
};

const captureObserver = async (page: Page, scene: Locator): Promise<Buffer> => {
  const canvas = scene.locator("canvas").first();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Still-Life Studio Observer canvas is not visible");
  expect(bounds.width).toBeCloseTo(514, 0);
  expect(bounds.height).toBeCloseTo(410.39, 0);
  const backupAttribute = "data-still-life-capture-inline-style";
  await canvas.evaluate((targetCanvas, backupKey) => {
    const targetRect = targetCanvas.getBoundingClientRect();
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element === targetCanvas || element.contains(targetCanvas) || targetCanvas.contains(element)) return;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = element.getBoundingClientRect();
      const overlaps = rect.right > targetRect.left && rect.left < targetRect.right &&
        rect.bottom > targetRect.top && rect.top < targetRect.bottom;
      if (!overlaps || rect.width <= 0 || rect.height <= 0) return;
      element.setAttribute(backupKey, element.getAttribute("style") ?? "__no-inline-style__");
      element.style.setProperty("visibility", "hidden", "important");
    });
  }, backupAttribute);
  try {
    return await canvas.screenshot({ animations: "disabled" });
  } finally {
    await page.evaluate((backupKey) => {
      document.querySelectorAll<HTMLElement>(`[${backupKey}]`).forEach((element) => {
        const previous = element.getAttribute(backupKey);
        if (previous === "__no-inline-style__") element.removeAttribute("style");
        else if (previous !== null) element.setAttribute("style", previous);
        element.removeAttribute(backupKey);
      });
    }, backupAttribute);
  }
};

const renderSheet = async (
  page: Page,
  file: string,
  tiles: readonly { title: string; images: readonly { label: string; bytes: Buffer }[] }[],
  columns: number,
): Promise<Buffer> => {
  const imageWidth = 514;
  const tileWidth = imageWidth * (tiles[0]?.images.length ?? 1);
  const tileHeight = 469;
  const rowCount = Math.ceil(tiles.length / columns);
  const markup = tiles.map((tile) => `<article><h2>${tile.title}</h2><div>${tile.images.map((image) =>
    `<figure><figcaption>${image.label}</figcaption><img src="data:image/png;base64,${image.bytes.toString("base64")}" /></figure>`,
  ).join("")}</div></article>`).join("");
  await page.setViewportSize({ width: columns * tileWidth, height: rowCount * tileHeight });
  await page.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}html,body{margin:0;background:#f7f8fa;font:14px Arial,sans-serif}
    #sheet{width:${columns * tileWidth}px;display:grid;grid-template-columns:repeat(${columns},${tileWidth}px)}
    article{height:${tileHeight}px;overflow:hidden;background:#f7f8fa}h2{height:36px;margin:0;padding:8px;color:#1d2530;font-size:15px;white-space:nowrap}
    article>div{display:flex}figure{margin:0;width:${imageWidth}px}figcaption{height:22px;padding:4px 6px;color:#344154;font-size:12px}
    img{display:block;width:${imageWidth}px;height:411px;object-fit:contain;background:#fff}
  </style></head><body><main id="sheet">${markup}</main></body></html>`);
  await page.evaluate(async () => Promise.all(Array.from(document.images, (image) => image.decode())));
  const bytes = await page.locator("#sheet").screenshot({ animations: "disabled" });
  await writeFile(path.join(evidenceDirectory, file), bytes);
  return bytes;
};

const readCapacity = async (page: Page) => {
  const snapshot = page.getByTestId("scene-capacity-snapshot").first();
  await expect.poll(() => snapshot.textContent(), { timeout: 30_000 }).toContain('"rendererResources"');
  const content = await snapshot.textContent();
  if (!content) throw new Error("Missing scene capacity snapshot");
  return JSON.parse(content) as Record<string, unknown>;
};

const orbitScene = async (page: Page, scene: Locator): Promise<void> => {
  const canvas = scene.locator("canvas").first();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Still-Life Studio Observer canvas is not visible for orbit input");
  const x = bounds.x + bounds.width * 0.58;
  const y = bounds.y + bounds.height * 0.48;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 36, y - 18, { steps: 4 });
  await page.mouse.up();
};

const capacitySignature = (capacity: Record<string, unknown>) => {
  const subject = (value: unknown) => {
    if (!value || typeof value !== "object") return value;
    const data = value as Record<string, unknown>;
    return Object.fromEntries([
      "objectCount", "meshCount", "renderableMeshCount", "uniqueGeometryCount",
      "uniqueMaterialCount", "uniqueTextureCount", "triangleCount", "effectiveTriangleCount",
    ].map((key) => [key, data[key]]));
  };
  return {
    viewportSubject: subject(capacity.viewportSubject),
    rttSubject: subject(capacity.rttSubject),
    rendererResources: capacity.rendererResources,
  };
};

test("Still-Life Studio qualifies for visual and runtime evidence", async ({ page, context }, testInfo) => {
  test.skip(basePath !== "", "The full frozen visual sample is captured at the root deployment base.");
  test.setTimeout(1_200_000);
  await mkdir(rawDirectory, { recursive: true });
  await mkdir(evidenceDirectory, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const implicitResponse = await page.goto(`${scenePath}?sv=1&${diagnostics}`);
  expect(implicitResponse?.ok()).toBeTruthy();
  await waitForScene(page);
  const implicitUrl = new URL(page.url());
  expect(implicitUrl.searchParams.get("sv")).toBe("1");
  expect(implicitUrl.searchParams.get("seed")).toMatch(/^\d+$/);

  const initialUrl = `${scenePath}?seed=0&sv=1&${diagnostics}&keep=still-life#qualification`;
  const response = await page.goto(initialUrl);
  expect(response?.ok()).toBeTruthy();
  const current = await waitForScene(page, 0);
  await setStandardCamera(page, current.rtt);
  await clearObserverOverlays(page, current.scene);
  const cameraPosition = (await current.scene.getAttribute("data-observer-camera-position")) ?? "";
  const orbitTarget = (await current.scene.getAttribute("data-orbit-target")) ?? "";
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  expect(dpr).toBe(1);

  const captures = new Map<number, Buffer>();
  const planRows: Array<Record<string, unknown>> = [];
  for (const seed of frozenSeeds) {
    if (seed !== 0) {
      const oldFrame = await current.rtt.getAttribute("data-frame-request-id");
      await navigateSpaTo(page, `${scenePath}?seed=${seed}&sv=1&${diagnostics}&keep=still-life#qualification`);
      const next = await waitForScene(page, seed);
      await waitForFrame(next.rtt, oldFrame);
      await clearObserverOverlays(page, next.scene);
      expect(await next.scene.getAttribute("data-observer-camera-position")).toBe(cameraPosition);
      expect(await next.scene.getAttribute("data-orbit-target")).toBe(orbitTarget);
    }
    const bytes = await captureObserver(page, current.scene);
    captures.set(seed, bytes);
    await writeFile(path.join(rawDirectory, `still-life-seed-${seed}.png`), bytes);
    const plan = resolveStillLifeStudioPlan(descriptorFor(seed));
    planRows.push({
      seed,
      compositionId: plan.compositionId,
      objectFamilies: plan.objects.map(({ family }) => family),
      objectCount: plan.objects.length,
      planSignature: createHash("sha256").update(JSON.stringify(plan)).digest("hex"),
      fallbackUsed: plan.fallbackUsed,
      fallbackIssues: plan.fallbackIssues,
    });
  }

  const fixedRoute = `${scenePath}?seed=284719&sv=1&${diagnostics}&keep=still-life#qualification`;
  await navigateSpaTo(page, fixedRoute);
  const fixed = await waitForScene(page, 284719);
  await clearObserverOverlays(page, fixed.scene);
  const fixedCapture = await captureObserver(page, fixed.scene);
  await page.getByRole("button", { name: /Copy share URL/i }).click();
  await expect(page.getByTestId("scene-variation-controls").getByRole("status")).toContainText("Share URL copied");
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedUrl).toBe(page.url());
  const previousReloadFrame = await fixed.rtt.getAttribute("data-frame-request-id");
  await page.reload();
  const replay = await waitForScene(page, 284719);
  await setStandardCamera(page, replay.rtt);
  await clearObserverOverlays(page, replay.scene);
  const replayCapture = await captureObserver(page, replay.scene);
  await writeFile(path.join(rawDirectory, "still-life-seed-284719-before-reload.png"), fixedCapture);
  await writeFile(path.join(rawDirectory, "still-life-seed-284719-after-reload.png"), replayCapture);
  expect(createHash("sha256").update(replayCapture).digest("hex"))
    .toBe(createHash("sha256").update(fixedCapture).digest("hex"));
  expect(previousReloadFrame).not.toBe("");

  const parityRtt = await replay.rtt.locator("canvas").screenshot({ animations: "disabled" });
  const previewStates: Array<Record<string, unknown>> = [];
  const rawToggle = page.getByLabel("Raw RTT — bypass DOF");
  let previousFrame = (await replay.rtt.getAttribute("data-frame-request-id")) ?? "";
  const focusStates: number[] = [];
  for (const focusDistanceMm of [3000, 4100, 5300]) {
    await setRangeDirectOnGrid(page, "Focus distance", focusDistanceMm);
    previousFrame = await waitForFrame(replay.rtt, previousFrame);
    focusStates.push(focusDistanceMm);
    for (const aperture of [5.6, 11, 22]) {
      await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: `f/${aperture}` }).check();
      previousFrame = await waitForFrame(replay.rtt, previousFrame);
      previewStates.push({ focusDistanceMm, aperture, mode: "processed", frameRequestId: previousFrame });
    }
  }
  await rawToggle.check();
  previousFrame = await waitForFrame(replay.rtt, previousFrame);
  previewStates.push({ focusDistanceMm: 5300, aperture: 22, mode: "raw", frameRequestId: previousFrame });
  await rawToggle.uncheck();
  previousFrame = await waitForFrame(replay.rtt, previousFrame);
  await page.getByRole("radio", { name: "Upright Assist" }).check();
  previousFrame = await waitForFrame(replay.rtt, previousFrame);
  previewStates.push({ focusDistanceMm: 5300, aperture: 22, mode: "upright", frameRequestId: previousFrame });
  await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
  previousFrame = await waitForFrame(replay.rtt, previousFrame);

  const movementStates = [
    ["Front Rise", 10], ["Front Shift", 20], ["Front Tilt", -2], ["Front Swing", 2],
    ["Rear Rise", 10], ["Rear Shift", -20], ["Rear Tilt", 2], ["Rear Swing", -2],
  ] as const;
  for (const [movementName, value] of movementStates) {
    const selector = page.getByRole("radio", { name: movementName });
    await expect(selector).toHaveCount(1);
    await selector.check();
    await setMovementRange(page, movementName, value);
    previousFrame = await waitForFrame(replay.rtt, previousFrame);
    expect(await page.getByTestId("scene-variation-controls").getAttribute("data-active-seed")).toBe("284719");
    await setMovementRange(page, movementName, 0);
    previousFrame = await waitForFrame(replay.rtt, previousFrame);
  }
  await page.getByRole("radio", { name: "Front Tilt" }).check();
  await setMovementRange(page, "Front Tilt", -2);
  previousFrame = await waitForFrame(replay.rtt, previousFrame);
  await setRangeDirectOnGrid(page, "Focus distance", 5300);
  await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: "f/22" }).check();
  await expect(replay.rtt).toHaveAttribute("data-frame-result-status", "completed");
  await orbitScene(page, replay.scene);
  const runtimeCameraPosition = (await replay.scene.getAttribute("data-observer-camera-position")) ?? "";
  const runtimeOrbitTarget = (await replay.scene.getAttribute("data-orbit-target")) ?? "";

  const controls = page.getByTestId("scene-variation-controls");
  const seedA = Number(await controls.getAttribute("data-active-seed"));
  const capacityA = await readCapacity(page);
  const capacitySamples = [capacityA];
  const regenerationFrame = await replay.rtt.getAttribute("data-frame-request-id");
  await page.getByRole("button", { name: /Regenerate scene/i }).click();
  await expect.poll(() => controls.getAttribute("data-active-seed")).not.toBe(String(seedA));
  const seedB = Number(await controls.getAttribute("data-active-seed"));
  const regenerated = await waitForScene(page, seedB);
  await waitForFrame(regenerated.rtt, regenerationFrame);
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue("5300");
  await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute("data-selected-aperture", "22");
  await expect(regenerated.scene).toHaveAttribute("data-observer-camera-position", runtimeCameraPosition);
  await expect(regenerated.scene).toHaveAttribute("data-orbit-target", runtimeOrbitTarget);
  await expect(page.getByRole("slider", { name: "Front Tilt" })).toHaveValue("-2");
  await expect(page.getByRole("radio", { name: "Front Tilt" })).toBeChecked();
  const capacityB = await readCapacity(page);
  capacitySamples.push(capacityB);
  await page.goBack();
  const historyA = await waitForScene(page, seedA);
  const restoredA = await readCapacity(page);
  expect(capacitySignature(restoredA)).toEqual(capacitySignature(capacityA));
  capacitySamples.push(restoredA);
  await page.goForward();
  const historyB = await waitForScene(page, seedB);
  const restoredB = await readCapacity(page);
  expect(capacitySignature(restoredB)).toEqual(capacitySignature(capacityB));
  capacitySamples.push(restoredB);

  const beforeRearMovementRegeneration = await historyB.rtt.getAttribute("data-frame-request-id");
  await page.getByRole("radio", { name: "Rear Swing" }).check();
  await setMovementRange(page, "Rear Swing", 2);
  await waitForFrame(historyB.rtt, beforeRearMovementRegeneration);
  await page.getByRole("button", { name: /Regenerate scene/i }).click();
  await expect.poll(() => controls.getAttribute("data-active-seed")).not.toBe(String(seedB));
  const seedC = Number(await controls.getAttribute("data-active-seed"));
  const regeneratedRearMovement = await waitForScene(page, seedC);
  await expect(page.getByRole("slider", { name: "Rear Swing" })).toHaveValue("2");
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue("5300");
  await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute("data-selected-aperture", "22");
  await expect(regeneratedRearMovement.scene).toHaveAttribute("data-observer-camera-position", runtimeCameraPosition);
  await expect(regeneratedRearMovement.scene).toHaveAttribute("data-orbit-target", runtimeOrbitTarget);
  const capacityC = await readCapacity(page);
  capacitySamples.push(capacityC);

  const regenerationSeeds = [seedA, seedB, seedC];
  for (let index = 0; index < 10; index += 1) {
    const beforeSeed = Number(await controls.getAttribute("data-active-seed"));
    const oldFrame = await regeneratedRearMovement.rtt.getAttribute("data-frame-request-id");
    await page.getByRole("button", { name: /Regenerate scene/i }).click();
    await expect.poll(() => controls.getAttribute("data-active-seed")).not.toBe(String(beforeSeed));
    const nextSeed = Number(await controls.getAttribute("data-active-seed"));
    const changed = await waitForScene(page, nextSeed);
    await waitForFrame(changed.rtt, oldFrame);
    regenerationSeeds.push(nextSeed);
    capacitySamples.push(await readCapacity(page));
  }
  const afterTenRegenerations = await readCapacity(page);
  const scenesPath = basePath ? `${basePath}/scenes` : "/scenes";
  await navigateSpaTo(page, scenesPath);
  await expect(page).toHaveURL(new RegExp(`${basePath}/scenes$`));
  await navigateSpaTo(page, `${scenePath}?seed=284719&sv=1&${diagnostics}`);
  const reentered = await waitForScene(page, 284719);
  const afterLeaveReenter = await readCapacity(page);
  capacitySamples.push(afterLeaveReenter);

  const rendererResourceSamples = capacitySamples.map((sample) => {
    const resources = sample.rendererResources as { geometries?: number; textures?: number } | null;
    const subject = sample.viewportSubject as { uniqueGeometryCount?: number; uniqueTextureCount?: number } | null;
    return resources && subject ? {
      geometries: resources.geometries ?? 0,
      textures: resources.textures ?? 0,
      geometryOverhead: (resources.geometries ?? 0) - (subject.uniqueGeometryCount ?? 0),
      textureOverhead: (resources.textures ?? 0) - (subject.uniqueTextureCount ?? 0),
    } : null;
  }).filter((sample): sample is { geometries: number; textures: number; geometryOverhead: number; textureOverhead: number } => sample !== null);
  const resourceOverhead = {
    geometryValues: [...new Set(rendererResourceSamples.map(({ geometryOverhead }) => geometryOverhead))],
    textureValues: [...new Set(rendererResourceSamples.map(({ textureOverhead }) => textureOverhead))],
    minimumRendererGeometries: Math.min(...rendererResourceSamples.map(({ geometries }) => geometries)),
    maximumRendererGeometries: Math.max(...rendererResourceSamples.map(({ geometries }) => geometries)),
    minimumRendererTextures: Math.min(...rendererResourceSamples.map(({ textures }) => textures)),
    maximumRendererTextures: Math.max(...rendererResourceSamples.map(({ textures }) => textures)),
  };
  expect(capacitySignature(afterLeaveReenter)).toEqual(capacitySignature(capacityA));
  expect(resourceOverhead.geometryValues).toHaveLength(1);
  expect(resourceOverhead.textureValues).toHaveLength(1);

  const summarizeSubject = (value: unknown) => {
    if (!value || typeof value !== "object") return null;
    const subject = value as Record<string, unknown>;
    return Object.fromEntries([
      "objectCount", "meshCount", "renderableMeshCount", "uniqueGeometryCount",
      "uniqueMaterialCount", "uniqueTextureCount", "triangleCount", "effectiveTriangleCount",
    ].map((key) => [key, subject[key]]));
  };
  const summarizeCapacity = (sample: Record<string, unknown>) => {
    const groundGlass = sample.groundGlass as Record<string, unknown> | null;
    const frame = groundGlass?.frame as Record<string, unknown> | undefined;
    const profiling = groundGlass?.profilingDiagnostics as Record<string, unknown> | undefined;
    return {
      viewportSubject: summarizeSubject(sample.viewportSubject),
      rttSubject: summarizeSubject(sample.rttSubject),
      rendererResources: sample.rendererResources,
      groundGlass: groundGlass ? {
        enabled: groundGlass.enabled,
        renderQuality: groundGlass.renderQuality,
        frameCount: frame?.count,
        profilingBackend: groundGlass.profilingBackend,
        cpuSubmit: groundGlass.groundGlassCpuSubmit,
        physicalDofCpuSubmit: groundGlass.physicalDofCpuSubmit,
        framesAccepted: profiling?.framesAccepted,
        framesRejectedCapacity: profiling?.framesRejectedCapacity,
        framesInvalidated: profiling?.framesInvalidated,
        framesCompletedGpu: profiling?.framesCompletedGpu,
      } : null,
    };
  };

  const sheetPage = await context.newPage();
  const grid = await renderSheet(sheetPage, "still-life-studio-12-seed-grid.png", frozenSeeds.map((seed) => ({
    title: `Frozen seed ${seed}`,
    images: [{ label: `schema v1 · ${seed}`, bytes: captures.get(seed)! }],
  })), 3);
  const representatives = await renderSheet(sheetPage, "still-life-studio-four-representatives.png", [0, 284719, 3079748268, 4294967295].map((seed) => ({
    title: `Representative seed ${seed}`,
    images: [{ label: `schema v1 · ${seed}`, bytes: captures.get(seed)! }],
  })), 2);
  const blindPairs = [
    [2004402848, 4041585854], [3079748268, 4065361417], [284719, 2762659077],
    [4294967295, 654013979], [0, 1], [2130322642, 1824298367],
  ] as const;
  const blind = await renderSheet(sheetPage, "still-life-studio-blind-pairs.png", blindPairs.map(([a, b], index) => ({
    title: `Blind pair ${index + 1}`,
    images: [{ label: "A", bytes: captures.get(a)! }, { label: "B", bytes: captures.get(b)! }],
  })), 1);
  await renderSheet(sheetPage, "still-life-studio-observer-ground-glass-parity.png", [{
    title: "Seed 284719 · same schema v1 plan",
    images: [
      { label: "Observer · clean canvas", bytes: captures.get(284719)! },
      { label: "Ground Glass · completed WebGL2 frame", bytes: parityRtt },
    ],
  }], 1);
  const sameSeedReplay = await renderSheet(sheetPage, "still-life-studio-same-seed-replay.png", [{
    title: "Seed 284719 · reload and replay",
    images: [
      { label: "Initial capture", bytes: fixedCapture },
      { label: "After page reload", bytes: replayCapture },
    ],
  }], 1);
  const thumbnailDataUrl = await sheetPage.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create thumbnail encoder canvas");
    context.drawImage(image, 0, 0);
    return canvas.toDataURL("image/webp", 0.88);
  }, captures.get(4294967295)!.toString("base64"));
  const thumbnailBytes = Buffer.from(thumbnailDataUrl.split(",")[1]!, "base64");
  expect(thumbnailBytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(thumbnailBytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
  await writeFile(path.resolve("public/assets/still-life-studio.webp"), thumbnailBytes);
  await sheetPage.close();

  const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  const report = {
    sceneId: stillLifeStudioScene.id,
    schemaVersion: 1,
    browser: "Chromium production preview · WebGL2",
    viewport: { width: 1440, height: 1000 },
    devicePixelRatio: dpr,
    observerCanvas: { width: 514, height: 411 },
    renderQuality: "standard",
    overlays: "clean Observer; optical, focus and DOF overlays disabled",
    focusDistanceMm: 4100,
    aperture: 11,
    cameraPosition,
    orbitTarget,
    seeds: planRows,
    implicitEntry: { url: `${implicitUrl.pathname}${implicitUrl.search}`, seed: implicitUrl.searchParams.get("seed") },
    variation: {
      distinctPlanCount: new Set(planRows.map(({ planSignature }) => planSignature)).size,
      distinctCompositionCount: new Set(planRows.map(({ compositionId }) => compositionId)).size,
      screenshotHashes: Object.fromEntries([...captures].map(([seed, bytes]) => [seed, hash(bytes)])),
      pixelIdenticalReloadReplay: hash(fixedCapture) === hash(replayCapture),
    },
    artifacts: {
      seedGrid: "still-life-studio-12-seed-grid.png",
      representatives: "still-life-studio-four-representatives.png",
      blindPairs: "still-life-studio-blind-pairs.png",
      observerGroundGlass: "still-life-studio-observer-ground-glass-parity.png",
      sameSeedReplay: "still-life-studio-same-seed-replay.png",
      thumbnail: "public/assets/still-life-studio.webp",
      thumbnailSha256: hash(thumbnailBytes),
      contactSheetHashes: {
        seedGrid: hash(grid),
        representatives: hash(representatives),
        blindPairs: hash(blind),
        sameSeedReplay: hash(sameSeedReplay),
      },
    },
    shareUrl: copiedUrl,
    history: { seedA, seedB, restoredA: seedA, restoredB: seedB },
    regenerationSeeds,
    groundGlass: {
      frameStatus: await reentered.rtt.getAttribute("data-frame-result-status"),
      frameRequestId: await reentered.rtt.getAttribute("data-frame-request-id"),
      lastCompletedRequestId: await reentered.rtt.getAttribute("data-last-completed-request-id"),
      previewStates,
      focusStates,
      movementStates: movementStates.map(([movement, value]) => ({ movement, value })),
    },
    capacity: {
      sampleCount: capacitySamples.length,
      seedA: summarizeCapacity(capacityA),
      seedB: summarizeCapacity(capacityB),
      historyA: summarizeCapacity(restoredA),
      historyB: summarizeCapacity(restoredB),
      afterTenRegenerations: summarizeCapacity(afterTenRegenerations),
      afterLeaveReenter: summarizeCapacity(afterLeaveReenter),
      samples: capacitySamples.map(summarizeCapacity),
      rendererResourceOverhead: resourceOverhead,
      resourceOwnershipResiduals: rendererResourceSamples.map(({ geometryOverhead, textureOverhead }) => ({ geometryOverhead, textureOverhead })),
    },
    pageErrors,
  };
  await writeFile(path.join(evidenceDirectory, "still-life-studio-qualification.json"), JSON.stringify(report, null, 2));
  expect(captures.size).toBe(12);
  expect(new Set(planRows.map(({ planSignature }) => planSignature)).size).toBeGreaterThan(8);
  expect(new Set(planRows.map(({ compositionId }) => compositionId)).size).toBe(4);
  expect(report.variation.pixelIdenticalReloadReplay).toBe(true);
  expect(report.groundGlass.frameStatus).toBe("completed");
  expect(report.groundGlass.frameRequestId).toBe(report.groundGlass.lastCompletedRequestId);
  expect(regenerationSeeds.length).toBe(13);
  expect(capacitySamples.length).toBeGreaterThanOrEqual(13);
  expect(historyA.scene).toBeDefined();
  expect(pageErrors).toEqual([]);
  await testInfo.attach("still-life-studio-qualification.json", { body: Buffer.from(JSON.stringify(report, null, 2)), contentType: "application/json" });
});

test("Still-Life Studio seeded share and history work under the deployment subpath", async ({ page, context }) => {
  test.skip(basePath !== "/view-camera-simulator", "This path contract check targets the GitHub Pages deployment basename.");
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const route = `${scenePath}?seed=284719&sv=1&keep=base#subpath`;
  const response = await page.goto(route);
  expect(response?.ok()).toBeTruthy();
  const initial = await waitForScene(page, 284719);
  await setStandardCamera(page, initial.rtt);
  const cameraPosition = (await initial.scene.getAttribute("data-observer-camera-position")) ?? "";
  await page.getByRole("button", { name: /Copy share URL/i }).click();
  const copiedUrl = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  expect(copiedUrl.pathname).toBe(scenePath);
  expect(copiedUrl.searchParams.get("seed")).toBe("284719");
  expect(copiedUrl.searchParams.get("keep")).toBe("base");
  expect(copiedUrl.hash).toBe("#subpath");
  await page.reload();
  const replay = await waitForScene(page, 284719);
  await setStandardCamera(page, replay.rtt);
  expect(await replay.scene.getAttribute("data-observer-camera-position")).toBe(cameraPosition);
  const controls = page.getByTestId("scene-variation-controls");
  await page.getByRole("button", { name: /Regenerate scene/i }).click();
  await expect.poll(() => controls.getAttribute("data-active-seed")).not.toBe("284719");
  const regeneratedSeed = Number(await controls.getAttribute("data-active-seed"));
  await waitForScene(page, regeneratedSeed);
  await page.goBack();
  await waitForScene(page, 284719);
  await page.goForward();
  await waitForScene(page, regeneratedSeed);
  await navigateSpaTo(page, `${basePath}/scenes`);
  await expect(page).toHaveURL(new RegExp("/view-camera-simulator/scenes$"));
  await navigateSpaTo(page, `${scenePath}?seed=284719&sv=1`);
  const reentered = await waitForScene(page, 284719);
  expect(await reentered.scene.getAttribute("data-scene-subject-id")).toBe("still-life-studio");
  await expect(reentered.rtt).toHaveAttribute("data-frame-result-status", "completed");
});
