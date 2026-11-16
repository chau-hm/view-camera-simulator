import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { setRangeDirectOnGrid } from "../e2e/helpers/rangeInput";
import { controlSolution, subjects } from "../../scenes/shelfSwingGeometry";

const FIXED_SEED = 284719;
const MAX_SEED = 0xffff_ffff;
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

const waitForScene = async (page: Page, seed?: number) => {
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
    await expect(controls).toHaveAttribute("data-active-schema", "1");
    await expect(controls).toContainText(`Seed ${seed} · schema v1`);
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
  const bytes = await canvas.screenshot();
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

test("Shelf Swing seeded RTT stays coherent through the three-station focus and aperture matrix", async ({
  page,
}, testInfo) => {
  test.setTimeout(480_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${SCENE_PATH}?seed=${FIXED_SEED}&sv=1&${CAPACITY_QUERY}`);
  const { scene, rtt } = await waitForScene(page, FIXED_SEED);
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
      frameRequestId: previousFrame,
      groundGlassImageSha256: await hashRttCanvas(rtt),
    });
  }

  expect(states).toHaveLength(12);
  expect(new Set(states.map((state) => state.frameRequestId)).size).toBe(12);
  expect(new Set(states.map((state) => state.groundGlassImageSha256)).size).toBeGreaterThan(1);
  expect(await readCapacityResidual(page)).toEqual(initialCapacity);
  await expect(rtt).toHaveAttribute("data-renderer-generation", rendererGeneration ?? "");
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", rttResourceGeneration ?? "");
  expect(pageErrors).toEqual([]);

  const report = {
    seed: FIXED_SEED,
    schemaVersion: 1,
    states,
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

test("Shelf Swing regeneration preserves camera state, history, RTT frames, and bounded resources", async ({
  page,
}, testInfo) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${SCENE_PATH}?seed=${FIXED_SEED}&sv=1&keep=one&${CAPACITY_QUERY}#pilot`);
  const { scene, rtt } = await waitForScene(page, FIXED_SEED);
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
    await expect(controls).toHaveAttribute("data-active-schema", "1");
    const nextUrl = new URL(page.url());
    expect(nextUrl.pathname).toBe(SCENE_PATH);
    expect(nextUrl.searchParams.get("seed")).toBe(String(nextSeed));
    expect(nextUrl.searchParams.get("sv")).toBe("1");
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
