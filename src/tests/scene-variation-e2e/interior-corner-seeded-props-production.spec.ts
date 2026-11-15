import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { setRangeDirectOnGrid } from "../e2e/helpers/rangeInput";

const FIXED_SEED = 284719;
const SECOND_SEED = 0xffff_ffff;
const CAPACITY_QUERY = "rttDiagnostics=1&sceneCapacityProfiling=1&dofProfiling=1";

const evidenceDirectory = async (testInfo: TestInfo): Promise<string> => {
  const directory = process.env.SCENE_VARIATION_EVIDENCE_DIR
    ? path.resolve(process.env.SCENE_VARIATION_EVIDENCE_DIR)
    : testInfo.outputPath("captures");
  await mkdir(directory, { recursive: true });
  return directory;
};

const waitForFrame = async (rtt: Locator): Promise<string> => {
  await expect.poll(async () => {
    const requestId = await rtt.getAttribute("data-frame-request-id");
    const completedRequestId = await rtt.getAttribute("data-last-completed-request-id");
    return Boolean(requestId && requestId === completedRequestId);
  }, { timeout: 120_000 }).toBe(true);
  await expect(rtt).toHaveAttribute("data-frame-result-status", "completed");
  return (await rtt.getAttribute("data-frame-request-id")) ?? "";
};

const navigateWithinApp = async (page: Page, route: string): Promise<void> => {
  await page.evaluate((nextRoute) => {
    window.history.pushState(null, "", nextRoute);
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  }, route);
  await expect(page).toHaveURL(new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
};

const waitForScene = async (page: Page, seed?: number, schemaVersion?: number) => {
  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(scene).toHaveAttribute("data-observer-renderer-status", "active", {
    timeout: 90_000,
  });
  await expect(scene).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(scene).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "interior-corner");
  await expect(rtt).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(rtt).toHaveAttribute("data-actual-execution-api", "webgl2");
  await waitForFrame(rtt);
  if (seed !== undefined && schemaVersion !== undefined) {
    const controls = page.getByTestId("scene-variation-controls");
    await expect(controls).toHaveAttribute("data-active-seed", String(seed));
    await expect(controls).toHaveAttribute("data-active-schema", String(schemaVersion));
    await expect(controls).toContainText(`Seed ${seed} · schema v${schemaVersion}`);
  }
  return { scene, rtt };
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
  const hasInlineGroup = await page.getByTestId("scene-overlay-inline").count() > 0;
  const hasCollapsedGroup = await page.getByTestId("scene-overlay-collapsed").count() > 0;
  const overlayTrigger = page.getByRole("button", { name: /View overlays/i });
  if (!hasInlineGroup && !hasCollapsedGroup && await overlayTrigger.count() === 0) {
    await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
    await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
    await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");
    return;
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const group = await getOverlayGroup(page);
    const active = group.locator('button[aria-pressed="true"]');
    if (await active.count() === 0) break;
    await active.first().click();
  }
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
  await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");
  if (await overlayTrigger.count() === 1 && await overlayTrigger.getAttribute("aria-expanded") === "true") {
    await overlayTrigger.click();
    await expect(overlayTrigger).toHaveAttribute("aria-expanded", "false");
  }
};

const readCapacity = async (page: Page) => {
  const snapshot = page.getByTestId("scene-capacity-snapshot").first();
  await expect.poll(async () => (await snapshot.textContent())?.trim() ?? "", {
    timeout: 30_000,
  }).toContain('"rendererResources"');
  const content = (await snapshot.textContent())?.trim();
  if (!content) throw new Error("Scene capacity diagnostics did not publish a snapshot");
  return JSON.parse(content) as {
    viewportSubject: {
      objectCount: number;
      meshCount: number;
      uniqueGeometryCount: number;
      uniqueMaterialCount: number;
      uniqueTextureCount: number;
    } | null;
    rttSubject: {
      objectCount: number;
      meshCount: number;
      uniqueGeometryCount: number;
      uniqueMaterialCount: number;
      uniqueTextureCount: number;
    } | null;
    rendererResources: { geometries: number; textures: number } | null;
    frameCadence: { p50Ms: number | null; p95Ms: number | null; approxFps: number | null };
    groundGlass: {
      enabled: boolean;
      profilingBackend: string;
      timingUnit: string;
      frame: { p50Ms: number | null; p95Ms: number | null; count: number };
      groundGlassCpuSubmit: { p50Ms: number | null; p95Ms: number | null; count: number } | null;
    } | null;
  };
};

const capacityResidual = async (page: Page) => {
  const snapshot = await readCapacity(page);
  if (!snapshot.viewportSubject || !snapshot.rttSubject || !snapshot.rendererResources) {
    throw new Error("Scene capacity snapshot is missing a subject or renderer resource count");
  }
  return {
    subject: {
      observer: snapshot.viewportSubject,
      groundGlass: snapshot.rttSubject,
    },
    renderer: snapshot.rendererResources,
  };
};

test("new implicit sessions select v2 while legacy seed links stay v1 and lesson Observe stays canonical", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/simulator/free/interior-corner");
  await expect(page).toHaveURL(/seed=(0|[1-9][0-9]*)&sv=2$/);
  const implicitSeed = Number(new URL(page.url()).searchParams.get("seed"));
  await waitForScene(page, implicitSeed, 2);

  await page.goto(`/simulator/free/interior-corner?seed=${FIXED_SEED}`);
  await waitForScene(page, FIXED_SEED, 1);
  await expect(page).toHaveURL(new RegExp(`seed=${FIXED_SEED}&sv=1$`));

  await page.goto(`/simulator/free/interior-corner?lesson=1&seed=${FIXED_SEED}&sv=2`);
  await expect(page.getByTestId("scene-variation-controls")).toHaveCount(0);
  await expect(page).toHaveURL(/lesson=1$/);
  await waitForScene(page);

  await page.goto(
    `/simulator/guided/interior-corner/interior-corner-compose-01?lesson=1&seed=${FIXED_SEED}&sv=2#guided`,
  );
  await expect(page.getByTestId("scene-variation-controls")).toHaveCount(0);
  await expect(page).toHaveURL(/lesson=1#guided$/);
  await waitForScene(page);

  await page.goto(`/simulator/free/interior-corner?seed=1&sv=2`);
  await waitForScene(page, 1, 2);
  await page.goto(
    `/simulator/guided/interior-corner/interior-corner-compose-01?lesson=1&seed=${FIXED_SEED}&sv=2#guided`,
  );
  await expect(page.getByTestId("scene-variation-controls")).toHaveCount(0);
  await expect(page).toHaveURL(/lesson=1#guided$/);
  await waitForScene(page);
});

test("normal-size Observer captures show v1 preservation and recognizable v2 arrangements", async ({
  page,
}, testInfo) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const outputDirectory = await evidenceDirectory(testInfo);
  const captures: Array<Record<string, unknown>> = [];
  let fixedV2Reference: Buffer | null = null;
  let shareUrl = "";

  const cases = [
    {
      label: "Canonical lesson Observe",
      url: "/simulator/free/interior-corner?lesson=1",
      seed: null,
      schemaVersion: null,
      file: "observer-canonical-lesson.png",
    },
    {
      label: `Free Practice · seed ${FIXED_SEED} · schema v1`,
      url: `/simulator/free/interior-corner?seed=${FIXED_SEED}&sv=1`,
      seed: FIXED_SEED,
      schemaVersion: 1,
      file: `observer-seed-${FIXED_SEED}-schema-v1.png`,
    },
    {
      label: `Free Practice · seed ${FIXED_SEED} · schema v2`,
      url: `/simulator/free/interior-corner?seed=${FIXED_SEED}&sv=2&keep=one#pilot`,
      seed: FIXED_SEED,
      schemaVersion: 2,
      file: `observer-seed-${FIXED_SEED}-schema-v2.png`,
    },
    ...([0, SECOND_SEED] as const).map((seed) => ({
      label: `Free Practice · seed ${seed} · schema v2`,
      url: `/simulator/free/interior-corner?seed=${seed}&sv=2`,
      seed,
      schemaVersion: 2,
      file: `observer-seed-${seed}-schema-v2.png`,
    })),
  ];

  for (const [index, captureCase] of cases.entries()) {
    if (index >= 3) await navigateWithinApp(page, captureCase.url);
    else await page.goto(captureCase.url);
    const { scene, rtt } = captureCase.seed === null
      ? await waitForScene(page)
      : await waitForScene(page, captureCase.seed, captureCase.schemaVersion ?? undefined);
    await clearObserverOverlays(page, scene);
    const canvas = scene.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error(`Missing Observer canvas for ${captureCase.label}`);
    const image = await canvas.screenshot();
    await writeFile(path.join(outputDirectory, captureCase.file), image);
    await testInfo.attach(captureCase.file, { body: image, contentType: "image/png" });
    const bitmapSize = { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
    expect(bitmapSize).toEqual({ width: 514, height: 411 });
    captures.push({
      ...captureCase,
      canvasSize: bitmapSize,
      canvasCssSize: { width: Number(box.width.toFixed(2)), height: Number(box.height.toFixed(2)) },
      devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
      observerBackend: await scene.getAttribute("data-observer-execution-backend"),
      groundGlassFrame: await rtt.getAttribute("data-last-completed-request-id"),
    });
    expect(box.width).toBeGreaterThanOrEqual(500);
    expect(box.height).toBeGreaterThanOrEqual(400);
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);

    if (captureCase.seed === FIXED_SEED && captureCase.schemaVersion === 2) {
      fixedV2Reference = image;
      await page.getByRole("button", { name: "Copy share URL" }).click();
      await expect(page.getByTestId("scene-variation-controls").getByRole("status"))
        .toContainText("Share URL copied");
      shareUrl = await page.evaluate(() => navigator.clipboard.readText());
      expect(shareUrl).toBe(page.url());
      const shared = new URL(shareUrl);
      expect(shared.pathname).toBe("/simulator/free/interior-corner");
      expect(shared.searchParams.get("seed")).toBe(String(FIXED_SEED));
      expect(shared.searchParams.get("sv")).toBe("2");
      expect(shared.searchParams.get("keep")).toBe("one");
      expect(shared.hash).toBe("#pilot");
      const rttImage = await rtt.locator("canvas").first().screenshot();
      const rttFilename = `ground-glass-seed-${FIXED_SEED}-schema-v2.png`;
      await writeFile(path.join(outputDirectory, rttFilename), rttImage);
      await testInfo.attach(rttFilename, { body: rttImage, contentType: "image/png" });
    }
  }

  if (!fixedV2Reference || !shareUrl) throw new Error("Did not capture the shareable v2 reference seed");
  await page.goto(shareUrl);
  const replay = await waitForScene(page, FIXED_SEED, 2);
  await clearObserverOverlays(page, replay.scene);
  const replayImage = await replay.scene.locator("canvas").first().screenshot();
  expect(replayImage.equals(fixedV2Reference)).toBe(true);
  expect(page.url()).toBe(shareUrl);
  await writeFile(path.join(outputDirectory, "observer-seed-284719-schema-v2-replay.png"), replayImage);
  await testInfo.attach("observer-seed-284719-schema-v2-replay.png", {
    body: replayImage,
    contentType: "image/png",
  });
  await writeFile(path.join(outputDirectory, "observer-capture-report.json"), JSON.stringify({
    viewport: { width: 1440, height: 1000 },
    devicePixelRatio: 1,
    deploymentBase: "/",
    captures,
    shareUrl,
    replay: { seed: FIXED_SEED, schemaVersion: 2, pixelIdentical: true },
  }, null, 2));
});

test("v2 Ground Glass matrix, regeneration, Back/Forward, and resource lifetime remain stable", async ({
  page,
}, testInfo) => {
  test.setTimeout(480_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(
    `/simulator/free/interior-corner?seed=${FIXED_SEED}&sv=2&keep=one&${CAPACITY_QUERY}#pilot`,
  );
  const { scene, rtt } = await waitForScene(page, FIXED_SEED, 2);
  await clearObserverOverlays(page, scene);
  const initialRendererGeneration = await rtt.getAttribute("data-renderer-generation");
  const initialResourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  const capacityBeforeCameraChanges = await capacityResidual(page);
  const matrixEvidence: Array<{ focusDistanceMm: number; aperture: number; frameRequestId: string }> = [];

  for (const focus of [5800, 8000, 10400]) {
    await setRangeDirectOnGrid(page, "Focus distance", focus);
    for (const aperture of [5.6, 11, 22]) {
      await page.getByRole("radiogroup", { name: "Aperture" })
        .getByRole("radio", { name: `f/${aperture}` }).check();
      matrixEvidence.push({ focusDistanceMm: focus, aperture, frameRequestId: await waitForFrame(rtt) });
    }
  }
  expect(new Set(matrixEvidence.map((item) => item.frameRequestId)).size).toBe(9);
  await writeFile(path.join(await evidenceDirectory(testInfo), "v2-ground-glass-matrix.json"), JSON.stringify({
    seed: FIXED_SEED,
    schemaVersion: 2,
    states: matrixEvidence,
    allFramesCompleted: true,
  }, null, 2));
  expect(await rtt.getAttribute("data-renderer-generation")).toBe(initialRendererGeneration);
  expect(await rtt.getAttribute("data-rtt-resource-generation")).toBe(initialResourceGeneration);
  const capacityAfterCameraChanges = await capacityResidual(page);
  expect(capacityAfterCameraChanges.subject).toEqual(capacityBeforeCameraChanges.subject);
  expect(capacityAfterCameraChanges.renderer).toEqual(capacityBeforeCameraChanges.renderer);

  await setRangeDirectOnGrid(page, "Rise", 33);
  await setRangeDirectOnGrid(page, "Swing", 3.6);
  await setRangeDirectOnGrid(page, "Focus distance", 10400);
  await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: "f/22" }).check();
  await page.getByRole("radio", { name: "Upright Assist" }).check();
  await waitForFrame(rtt);
  const cameraBeforeRegenerate = await scene.getAttribute("data-observer-camera-position");
  const initialCapacity = await capacityResidual(page);
  const initialRequest = await rtt.getAttribute("data-frame-request-id");
  const regenerate = page.getByRole("button", { name: "Regenerate scene" });

  await regenerate.click();
  await expect(page.getByTestId("scene-variation-controls")).not.toHaveAttribute(
    "data-active-seed",
    String(FIXED_SEED),
    { timeout: 90_000 },
  );
  const firstNewSeed = Number(await page.getByTestId("scene-variation-controls").getAttribute("data-active-seed"));
  expect(Number.isInteger(firstNewSeed) && firstNewSeed >= 0 && firstNewSeed <= 0xffff_ffff).toBe(true);
  const firstNewUrl = new URL(page.url());
  expect(firstNewUrl.searchParams.get("seed")).toBe(String(firstNewSeed));
  expect(firstNewUrl.searchParams.get("sv")).toBe("2");
  expect(firstNewUrl.searchParams.get("keep")).toBe("one");
  expect(firstNewUrl.hash).toBe("#pilot");
  const firstNewFrame = await waitForFrame(rtt);
  expect(firstNewFrame).not.toBe(initialRequest);
  await expect(rtt).toHaveAttribute("data-renderer-generation", initialRendererGeneration ?? "");
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", initialResourceGeneration ?? "");
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("33");
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("3.6");
  await expect(page.getByLabel("Focus distance")).toHaveValue("10400");
  await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute(
    "data-selected-aperture",
    "22",
  );
  await expect(page.getByRole("radio", { name: "Upright Assist" })).toBeChecked();
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
  await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");
  await expect.poll(() => scene.getAttribute("data-observer-camera-position"))
    .toBe(cameraBeforeRegenerate);
  const firstNewCapacity = await capacityResidual(page);

  await page.getByRole("button", { name: "Copy share URL" }).click();
  await expect(page.getByTestId("scene-variation-controls").getByRole("status"))
    .toContainText("Share URL copied");
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedUrl).toBe(page.url());

  const frameBeforeBack = await rtt.getAttribute("data-frame-request-id");
  await page.goBack();
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute(
    "data-active-seed",
    String(FIXED_SEED),
  );
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-schema", "2");
  await expect.poll(() => rtt.getAttribute("data-frame-request-id")).not.toBe(frameBeforeBack);
  await waitForFrame(rtt);
  const restoredACapacity = await capacityResidual(page);
  expect(restoredACapacity.subject).toEqual(initialCapacity.subject);
  expect(restoredACapacity.renderer).toEqual(initialCapacity.renderer);
  const frameBeforeForward = await rtt.getAttribute("data-frame-request-id");
  await page.goForward();
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute(
    "data-active-seed",
    String(firstNewSeed),
  );
  await expect.poll(() => rtt.getAttribute("data-frame-request-id")).not.toBe(frameBeforeForward);
  await waitForFrame(rtt);
  const restoredBCapacity = await capacityResidual(page);
  expect(restoredBCapacity.subject).toEqual(firstNewCapacity.subject);
  expect(restoredBCapacity.renderer).toEqual(firstNewCapacity.renderer);

  const resourceCounts: Array<{ geometries: number; textures: number }> = [firstNewCapacity.renderer];
  const planCapacities = new Set([JSON.stringify(firstNewCapacity.subject)]);
  let previousSeed = firstNewSeed;
  let previousFrame = await rtt.getAttribute("data-frame-request-id");
  for (let index = 0; index < 10; index += 1) {
    await regenerate.click();
    await expect(page.getByTestId("scene-variation-controls")).not.toHaveAttribute(
      "data-active-seed",
      String(previousSeed),
      { timeout: 90_000 },
    );
    const nextSeed = Number(await page.getByTestId("scene-variation-controls").getAttribute("data-active-seed"));
    expect(nextSeed).not.toBe(previousSeed);
    await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-schema", "2");
    const completedFrame = await waitForFrame(rtt);
    expect(completedFrame).not.toBe(previousFrame);
    await expect(rtt).toHaveAttribute("data-renderer-generation", initialRendererGeneration ?? "");
    await expect(rtt).toHaveAttribute("data-rtt-resource-generation", initialResourceGeneration ?? "");
    const capacity = await capacityResidual(page);
    resourceCounts.push(capacity.renderer);
    planCapacities.add(JSON.stringify(capacity.subject));
    await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("33");
    await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("3.6");
    await expect(page.getByLabel("Focus distance")).toHaveValue("10400");
    await expect(page.getByRole("radio", { name: "Upright Assist" })).toBeChecked();
    await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
    await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
    await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");
    await expect.poll(() => scene.getAttribute("data-observer-camera-position"))
      .toBe(cameraBeforeRegenerate);
    previousSeed = nextSeed;
    previousFrame = completedFrame;
  }
  const geometryCounts = resourceCounts.map((item) => item.geometries);
  const textureCounts = resourceCounts.map((item) => item.textures);
  expect(planCapacities.size).toBeGreaterThanOrEqual(2);
  expect(Math.max(...geometryCounts) - Math.min(...geometryCounts)).toBeLessThanOrEqual(20);
  expect(Math.max(...textureCounts) - Math.min(...textureCounts)).toBeLessThanOrEqual(12);
  expect(geometryCounts.every((value, index) => index === 0 || value > geometryCounts[index - 1]))
    .toBe(false);
  expect(textureCounts.every((value, index) => index === 0 || value > textureCounts[index - 1]))
    .toBe(false);
  const finalProfile = await readCapacity(page);
  expect(finalProfile.groundGlass?.enabled).toBe(true);
  expect(finalProfile.groundGlass?.frame.count).toBeGreaterThan(0);

  await writeFile(path.join(await evidenceDirectory(testInfo), "v2-regeneration-capacity.json"), JSON.stringify({
    seedA: FIXED_SEED,
    seedB: firstNewSeed,
    restoredACapacity,
    restoredBCapacity,
    resourceCounts,
    distinctPlanCapacities: planCapacities.size,
    regenerationCount: 11,
    schemaVersion: 2,
    previewModePreserved: "upright",
    rendererGenerationStable: true,
    rttResourceGenerationStable: true,
    frameCadence: finalProfile.frameCadence,
    groundGlassProfile: finalProfile.groundGlass,
  }, null, 2));
});

test("a second v2 seed keeps Ground Glass orientation and movement paths functional", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/simulator/free/interior-corner?seed=${SECOND_SEED}&sv=2&${CAPACITY_QUERY}`);
  const { rtt } = await waitForScene(page, SECOND_SEED, 2);
  await page.getByRole("radio", { name: "Upright Assist" }).check();
  await waitForFrame(rtt);
  const uprightImage = await rtt.locator("canvas").first().screenshot();
  const uprightFilename = "ground-glass-seed-4294967295-schema-v2-upright.png";
  await writeFile(path.join(await evidenceDirectory(testInfo), uprightFilename), uprightImage);
  await testInfo.attach(uprightFilename, { body: uprightImage, contentType: "image/png" });
  await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
  await setRangeDirectOnGrid(page, "Rise", 33);
  await waitForFrame(rtt);
  await setRangeDirectOnGrid(page, "Swing", 3.6);
  await waitForFrame(rtt);
  const image = await rtt.locator("canvas").first().screenshot();
  const filename = "ground-glass-seed-4294967295-schema-v2-raw-rise33-swing3_6.png";
  await writeFile(path.join(await evidenceDirectory(testInfo), filename), image);
  await testInfo.attach(filename, { body: image, contentType: "image/png" });
  const capacity = await capacityResidual(page);
  expect(capacity.subject.groundGlass.meshCount).toBeGreaterThan(0);
  expect(capacity.subject.groundGlass.meshCount).toBeLessThan(100);
});
