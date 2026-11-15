import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { setRangeDirectOnGrid } from "../e2e/helpers/rangeInput";

const FIXED_SEED = 284719;
const SECOND_SEED = 0xffff_ffff;
const PILOT_QUERY = "rttDiagnostics=1&sceneCapacityProfiling=1";
const PILOT_PROFILE_QUERY = `${PILOT_QUERY}&dofProfiling=1`;
const VISUAL_QUERY = "rttDiagnostics=1";

const evidenceDirectory = async (testInfo: TestInfo): Promise<string> => {
  const directory = process.env.SCENE_VARIATION_EVIDENCE_DIR
    ? path.resolve(process.env.SCENE_VARIATION_EVIDENCE_DIR)
    : testInfo.outputPath("captures");
  await mkdir(directory, { recursive: true });
  return directory;
};

const waitForCompletedFrame = async (rtt: Locator): Promise<string> => {
  await expect.poll(async () => {
    const requestId = await rtt.getAttribute("data-frame-request-id");
    const completedRequestId = await rtt.getAttribute("data-last-completed-request-id");
    return Boolean(requestId && requestId === completedRequestId);
  }, { timeout: 120_000 }).toBe(true);
  await expect(rtt).toHaveAttribute("data-frame-result-status", "completed");
  return (await rtt.getAttribute("data-frame-request-id")) ?? "";
};

const waitForPilotMounted = async (page: Page) => {
  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(scene).toHaveAttribute("data-observer-renderer-status", "active", {
    timeout: 90_000,
  });
  await expect(scene).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(scene).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "interior-corner");
  await expect(rtt.locator("canvas").first()).toBeVisible();
  await waitForCompletedFrame(rtt);
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", {
    timeout: 90_000,
  });
  return { scene, rtt };
};

const subjectGeneration = async (rtt: Locator): Promise<string> => {
  const stateKey = await rtt.getAttribute("data-rtt-sanity-state");
  const generation = stateKey?.match(/subject-generation:([^|]+)/)?.[1];
  if (!generation) throw new Error(`Ground Glass has no subject generation in ${stateKey ?? "sanity key"}`);
  return generation;
};

const expectSeedUrl = async (page: Page, seed: number, keep = true): Promise<void> => {
  const url = new URL(page.url());
  expect(url.pathname).toBe("/simulator/free/interior-corner");
  expect(url.searchParams.get("seed")).toBe(String(seed));
  expect(url.searchParams.get("sv")).toBe("1");
  if (keep) expect(url.searchParams.get("keep")).toBe("one");
  expect(url.hash).toBe("#pilot");
};

const captureCanvas = async (
  locator: Locator,
  directory: string,
  filename: string,
): Promise<{ path: string; width: number; height: number }> => {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Cannot capture hidden canvas ${filename}`);
  const outputPath = path.join(directory, filename);
  await locator.screenshot({ path: outputPath });
  return {
    path: outputPath,
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
};

const readSceneCapacity = async (page: Page): Promise<Record<string, unknown>> => {
  const snapshot = page.getByTestId("scene-capacity-snapshot").first();
  await expect.poll(async () => (await snapshot.textContent())?.trim() ?? "", {
    timeout: 30_000,
  }).toContain('"rendererResources"');
  const content = (await snapshot.textContent())?.trim();
  if (!content) throw new Error("Scene capacity diagnostics did not publish a snapshot");
  return JSON.parse(content) as Record<string, unknown>;
};

const waitForGroundGlassProfile = async (page: Page): Promise<Record<string, unknown>> => {
  await expect.poll(async () => {
    const snapshot = await readSceneCapacity(page);
    const groundGlass = snapshot.groundGlass as { frame?: { count?: number } } | null;
    return groundGlass?.frame?.count ?? 0;
  }, { timeout: 30_000 }).toBeGreaterThan(0);
  return readSceneCapacity(page);
};

test("Interior Corner variation controls follow Free Practice and protect canonical lesson content", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/simulator/free/interior-corner?seed=${FIXED_SEED}&sv=1&${PILOT_QUERY}`);
  const { scene, rtt } = await waitForPilotMounted(page);
  await expect(page).toHaveURL(new RegExp(`seed=${FIXED_SEED}.*sv=1`));
  await expect(page.getByRole("region", { name: "Scene variation" })).toBeVisible();
  await expect(page.getByText(`Seed ${FIXED_SEED} · schema v1`)).toBeVisible();

  await page.locator("#language-selector").selectOption("zh-HK");
  await expect(page.getByRole("region", { name: "場景變化" })).toBeVisible();
  await expect(page.getByText(`種子 ${FIXED_SEED} · 結構版本 v1`)).toBeVisible();
  await expect(page.getByRole("button", { name: "重新生成場景" })).toBeVisible();
  await page.locator("#language-selector").selectOption("en");

  await expect(scene.locator("canvas").first()).toBeVisible();
  await expect(rtt).toHaveAttribute("data-frame-result-status", "completed");
  await page.goto(`/simulator/free/interior-corner?lesson=1&seed=${FIXED_SEED}&sv=1#observe`);
  await expect(page).toHaveURL(/lesson=1#observe$/);
  await expect(page.getByRole("button", { name: "Regenerate scene" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy share URL" })).toHaveCount(0);
  await page.goto(`/simulator/free/interior-corner?seed=${FIXED_SEED}&sv=3`);
  await expect(page.getByTestId("scene-variation-controls").getByRole("status")).toContainText(
    "This variation version is unsupported",
  );
  await expect(page.getByRole("button", { name: "Regenerate scene" })).toHaveCount(0);
  await expect(page).toHaveURL(/seed=284719&sv=3$/);
  await page.goto(`/simulator/free/interior-corner?seed=${FIXED_SEED}&sv=1&sv=1`);
  await expect(page.getByTestId("scene-variation-controls").getByRole("status")).toContainText(
    "This variation version is invalid",
  );
  await expect(page.getByRole("button", { name: "Regenerate scene" })).toHaveCount(0);
  await page.goto(
    `/simulator/guided/interior-corner/interior-corner-compose-01?lesson=1&seed=${FIXED_SEED}&sv=1#guided`,
  );
  await expect(page).toHaveURL(/lesson=1#guided$/);
  await expect(page.getByRole("button", { name: "Regenerate scene" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy share URL" })).toHaveCount(0);
});

test("seed regeneration preserves controls, Back/Forward restores variants, and ten replacements plateau", async ({
  page,
}) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(
    `/simulator/free/interior-corner?seed=${FIXED_SEED}&sv=1&keep=one&${PILOT_PROFILE_QUERY}#pilot`,
  );
  const { scene, rtt } = await waitForPilotMounted(page);
  const initialRendererGeneration = await rtt.getAttribute("data-renderer-generation");
  const initialRttResourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");

  await setRangeDirectOnGrid(page, "Rise", 20);
  await setRangeDirectOnGrid(page, "Swing", 2.4);
  await setRangeDirectOnGrid(page, "Focus distance", 5800);
  await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: "f/11" }).check();
  await waitForCompletedFrame(rtt);
  await page.getByRole("button", { name: "Reset Movements" }).click();
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("8000");
  await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute(
    "data-selected-aperture",
    "5.6",
  );
  await expectSeedUrl(page, FIXED_SEED);

  await setRangeDirectOnGrid(page, "Rise", 33);
  await setRangeDirectOnGrid(page, "Swing", 3.6);
  await setRangeDirectOnGrid(page, "Focus distance", 10400);
  await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: "f/22" }).check();
  await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
  await waitForCompletedFrame(rtt);
  const observerCanvas = scene.locator("canvas").first();
  const observerBox = await observerCanvas.boundingBox();
  if (!observerBox) throw new Error("Observer canvas is not visible");
  const cameraBeforeOrbit = await scene.getAttribute("data-observer-camera-position");
  await page.mouse.move(observerBox.x + observerBox.width * 0.55, observerBox.y + observerBox.height * 0.46);
  await page.mouse.down();
  await page.mouse.move(observerBox.x + observerBox.width * 0.64, observerBox.y + observerBox.height * 0.53, {
    steps: 6,
  });
  await page.mouse.up();
  await expect.poll(() => scene.getAttribute("data-observer-camera-position"), {
    timeout: 10_000,
  }).not.toBe(cameraBeforeOrbit);
  const cameraBeforeRegenerate = await scene.getAttribute("data-observer-camera-position");

  const initialSeed = await page.getByTestId("scene-variation-controls").getAttribute("data-active-seed");
  expect(initialSeed).toBe(String(FIXED_SEED));
  const previousGeneration = await subjectGeneration(rtt);
  const initialRequest = await rtt.getAttribute("data-frame-request-id");
  const regenerate = page.getByRole("button", { name: "Regenerate scene" });
  await regenerate.focus();
  await regenerate.press("Space");
  await expect(page).not.toHaveURL(new RegExp(`seed=${FIXED_SEED}(?:&|$)`));
  await expect(page.getByTestId("scene-variation-controls")).not.toHaveAttribute(
    "data-active-seed",
    String(FIXED_SEED),
    { timeout: 90_000 },
  );
  const firstRegeneratedSeed = await page.getByTestId("scene-variation-controls").getAttribute("data-active-seed");
  expect(firstRegeneratedSeed).toMatch(/^(0|[1-9][0-9]*)$/);
  await expectSeedUrl(page, Number(firstRegeneratedSeed));
  await waitForCompletedFrame(rtt);
  expect(await rtt.getAttribute("data-frame-request-id")).not.toBe(initialRequest);
  await expect(rtt).toHaveAttribute("data-renderer-generation", initialRendererGeneration ?? "");
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", initialRttResourceGeneration ?? "");
  await expect(page.getByRole("radio", { name: "Raw Ground Glass" })).toBeChecked();
  await expect.poll(() => scene.getAttribute("data-observer-camera-position")).toBe(cameraBeforeRegenerate);
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("33");
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("3.6");
  await expect(page.getByLabel("Focus distance")).toHaveValue("10400");
  await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute(
    "data-selected-aperture",
    "22",
  );
  expect(Number(await subjectGeneration(rtt))).toBeGreaterThan(Number(previousGeneration));

  await page.getByRole("button", { name: "Copy share URL" }).click();
  await expect(page.getByTestId("scene-variation-controls").getByRole("status")).toContainText(
    "Share URL copied",
  );
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedUrl).toBe(page.url());

  const rendererCounts: Array<{ geometries: number; textures: number }> = [];
  const viewportCounts: Array<{ objects: number; meshes: number; materials: number; textures: number }> = [];
  const subjectCounts: Array<{ objects: number; meshes: number; materials: number; textures: number }> = [];
  const profilingSnapshots: Array<Record<string, unknown>> = [];
  const historySeeds = [FIXED_SEED, Number(firstRegeneratedSeed)];
  const recordCapacity = async () => {
    const snapshot = await readSceneCapacity(page) as {
      viewportSubject: { objectCount: number; meshCount: number; uniqueMaterialCount: number; uniqueTextureCount: number } | null;
      rttSubject: { objectCount: number; meshCount: number; uniqueMaterialCount: number; uniqueTextureCount: number } | null;
      rendererResources: { geometries: number; textures: number } | null;
      frameCadence: { p50Ms: number | null; p95Ms: number | null; approxFps: number | null; count: number };
      groundGlass: {
        previewMode: string;
        profilingBackend: string;
        timingUnit: string;
        frame: { p50Ms: number | null; p95Ms: number | null; count: number };
        approxFps: number | null;
        groundGlassCpuSubmit: { p50Ms: number | null; p95Ms: number | null; count: number } | null;
        physicalDofCpuSubmit: { p50Ms: number | null; p95Ms: number | null; count: number } | null;
      } | null;
    };
    if (snapshot.rendererResources) rendererCounts.push(snapshot.rendererResources);
    if (snapshot.viewportSubject) {
      viewportCounts.push({
        objects: snapshot.viewportSubject.objectCount,
        meshes: snapshot.viewportSubject.meshCount,
        materials: snapshot.viewportSubject.uniqueMaterialCount,
        textures: snapshot.viewportSubject.uniqueTextureCount,
      });
    }
    if (snapshot.rttSubject) {
      subjectCounts.push({
        objects: snapshot.rttSubject.objectCount,
        meshes: snapshot.rttSubject.meshCount,
        materials: snapshot.rttSubject.uniqueMaterialCount,
        textures: snapshot.rttSubject.uniqueTextureCount,
      });
    }
    if (snapshot.groundGlass) {
      profilingSnapshots.push({
        seed: Number(await page.getByTestId("scene-variation-controls").getAttribute("data-active-seed")),
        previewMode: snapshot.groundGlass.previewMode,
        profilingBackend: snapshot.groundGlass.profilingBackend,
        timingUnit: snapshot.groundGlass.timingUnit,
        frame: snapshot.groundGlass.frame,
        approxFps: snapshot.groundGlass.approxFps,
        groundGlassCpuSubmit: snapshot.groundGlass.groundGlassCpuSubmit,
        physicalDofCpuSubmit: snapshot.groundGlass.physicalDofCpuSubmit,
        frameCadence: snapshot.frameCadence,
      });
    }
  };
  const measuredSnapshot = await waitForGroundGlassProfile(page);
  expect(measuredSnapshot.groundGlass).not.toBeNull();
  await recordCapacity();
  let previousSeed = Number(firstRegeneratedSeed);
  let previousSubjectGeneration = await subjectGeneration(rtt);
  let previousRequest = await rtt.getAttribute("data-frame-request-id");
  for (let index = 0; index < 10; index += 1) {
    await regenerate.click();
    await expect(page.getByTestId("scene-variation-controls")).not.toHaveAttribute(
      "data-active-seed",
      String(previousSeed),
      { timeout: 90_000 },
    );
    const nextSeedText = await page.getByTestId("scene-variation-controls").getAttribute("data-active-seed");
    const nextSeed = Number(nextSeedText);
    expect(Number.isInteger(nextSeed) && nextSeed >= 0 && nextSeed <= 0xffff_ffff).toBe(true);
    expect(nextSeed).not.toBe(previousSeed);
    await expectSeedUrl(page, nextSeed);
    await waitForCompletedFrame(rtt);
    const nextRequest = await rtt.getAttribute("data-frame-request-id");
    expect(nextRequest).not.toBe(previousRequest);
    const nextSubjectGeneration = await subjectGeneration(rtt);
    expect(Number(nextSubjectGeneration)).toBeGreaterThan(Number(previousSubjectGeneration));
    await expect(rtt).toHaveAttribute("data-renderer-generation", initialRendererGeneration ?? "");
    await expect.poll(() => scene.getAttribute("data-observer-camera-position")).toBe(cameraBeforeRegenerate);
    await expect(page.getByRole("radio", { name: "Raw Ground Glass" })).toBeChecked();
    await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("33");
    await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("3.6");
    await expect(page.getByLabel("Focus distance")).toHaveValue("10400");
    await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute(
      "data-selected-aperture",
      "22",
    );
    await recordCapacity();
    historySeeds.push(nextSeed);
    previousSeed = nextSeed;
    previousSubjectGeneration = nextSubjectGeneration;
    previousRequest = nextRequest;
  }

  const sameShape = (values: readonly unknown[]) =>
    values.every((value) => JSON.stringify(value) === JSON.stringify(values[0]));
  expect(rendererCounts.length).toBeGreaterThanOrEqual(10);
  expect(viewportCounts.length).toBeGreaterThanOrEqual(10);
  expect(subjectCounts.length).toBeGreaterThanOrEqual(10);
  expect(sameShape(rendererCounts)).toBe(true);
  expect(sameShape(viewportCounts)).toBe(true);
  expect(sameShape(subjectCounts)).toBe(true);

  const activeSeed = Number(await page.getByTestId("scene-variation-controls").getAttribute("data-active-seed"));
  await page.goBack();
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute(
    "data-active-seed",
    String(historySeeds[historySeeds.length - 2]),
  );
  await waitForCompletedFrame(rtt);
  await expectSeedUrl(page, historySeeds[historySeeds.length - 2] ?? FIXED_SEED);
  await page.goForward();
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute(
    "data-active-seed",
    String(activeSeed),
  );
  await waitForCompletedFrame(rtt);
  await expectSeedUrl(page, activeSeed);

  const outputDirectory = await evidenceDirectory(test.info());
  await writeFile(path.join(outputDirectory, "regeneration-capacity.json"), JSON.stringify({
    fixedSeed: FIXED_SEED,
    initialRendererGeneration,
    initialRttResourceGeneration,
    rendererCounts,
    viewportCounts,
    subjectCounts,
    profilingSnapshots,
    finalSeed: activeSeed,
  }, null, 2));
});

test("seeded materials remain reproducible at ordinary Observer size", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const outputDirectory = await evidenceDirectory(testInfo);
  const captures: Array<Record<string, unknown>> = [];
  const cases = [
    {
      seed: null,
      label: "Canonical lesson Observe",
      url: `/simulator/free/interior-corner?lesson=1&${PILOT_QUERY}`,
      filename: "observer-ordinary-size-canonical-lesson.png",
    },
    {
      seed: FIXED_SEED,
      label: "Seed 284719 · schema v1",
      url: `/simulator/free/interior-corner?seed=${FIXED_SEED}&sv=1&${PILOT_QUERY}`,
      filename: `observer-ordinary-size-seed-${FIXED_SEED}.png`,
    },
    {
      seed: SECOND_SEED,
      label: "Seed 4294967295 · schema v1",
      url: `/simulator/free/interior-corner?seed=${SECOND_SEED}&sv=1&${PILOT_QUERY}`,
      filename: `observer-ordinary-size-seed-${SECOND_SEED}.png`,
    },
  ];
  for (const { seed, label, url, filename } of cases) {
    await page.goto(url);
    const { scene } = await waitForPilotMounted(page);
    const capture = await captureCanvas(
      scene.locator("canvas").first(),
      outputDirectory,
      filename,
    );
    captures.push({ seed, label, ...capture });
  }
  expect(captures.every((capture) => Number(capture.width) >= 500)).toBe(true);
  expect(captures.every((capture) => Number(capture.height) >= 400)).toBe(true);
  await writeFile(path.join(outputDirectory, "ordinary-observer-size-report.json"), JSON.stringify({
    viewport: { width: 1440, height: 1000 },
    devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
    captures,
  }, null, 2));
});

test("seeded Interior Corner visual evidence covers material replay and the Ground Glass matrix", async ({
  page,
}, testInfo) => {
  test.setTimeout(480_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(
    `/simulator/free/interior-corner?seed=${FIXED_SEED}&sv=1&${VISUAL_QUERY}`,
  );
  const outputDirectory = await evidenceDirectory(testInfo);
  const captures: Array<Record<string, unknown>> = [];
  const recordObserver = async (label: string, filename: string) => {
    const { scene, rtt } = await waitForPilotMounted(page);
    const canvas = scene.locator("canvas").first();
    const capture = await captureCanvas(canvas, outputDirectory, filename);
    captures.push({ label, seed: Number(new URL(page.url()).searchParams.get("seed")), ...capture });
    return { scene, rtt, capture };
  };
  const initial = await recordObserver("Free Practice seed 284719", "observer-seed-284719.png");
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  expect(dpr).toBe(1);

  const initialGeneration = await subjectGeneration(initial.rtt);
  for (const focus of [5800, 8000, 10400]) {
    await setRangeDirectOnGrid(page, "Focus distance", focus);
    for (const aperture of [5.6, 11, 22]) {
      await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: `f/${aperture}` }).check();
      const requestId = await waitForCompletedFrame(initial.rtt);
      const filename = `ground-glass-seed-284719-focus-${focus}-f-${aperture}.png`;
      const capture = await captureCanvas(initial.rtt.locator("canvas").first(), outputDirectory, filename);
      captures.push({
        label: `Seed 284719 · focus ${focus} mm · f/${aperture}`,
        seed: FIXED_SEED,
        focusMm: focus,
        aperture,
        requestId,
        subjectGeneration: await subjectGeneration(initial.rtt),
        ...capture,
      });
      expect(await subjectGeneration(initial.rtt)).toBe(initialGeneration);
    }
  }

  const replayUrl = `/simulator/free/interior-corner?seed=${FIXED_SEED}&sv=1&${VISUAL_QUERY}`;
  await page.goto(replayUrl);
  const replay = await recordObserver("Direct URL replay seed 284719", "observer-direct-replay-284719.png");
  const replaySubjectGeneration = await subjectGeneration(replay.rtt);
  await page.reload();
  const reloaded = await recordObserver("Page reload seed 284719", "observer-reload-284719.png");
  expect(await subjectGeneration(reloaded.rtt)).toBe(replaySubjectGeneration);

  const button = page.getByRole("button", { name: "Regenerate scene" });
  await button.click();
  await expect(page).not.toHaveURL(new RegExp(`seed=${FIXED_SEED}(?:&|$)`));
  await expect(page.getByTestId("scene-variation-controls")).not.toHaveAttribute(
    "data-active-seed",
    String(FIXED_SEED),
    { timeout: 90_000 },
  );
  await waitForCompletedFrame(reloaded.rtt);
  const browserNextSeed = await page.getByTestId("scene-variation-controls").getAttribute("data-active-seed");
  const { capture: randomSeedCapture } = await recordObserver(
    `Regenerated seed ${browserNextSeed}`,
    `observer-regenerated-seed-${browserNextSeed}.png`,
  );
  await page.goBack();
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(FIXED_SEED));
  const back = await recordObserver("Browser Back restored seed 284719", "observer-back-restored-284719.png");
  await page.goForward();
  await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", browserNextSeed ?? "");
  await waitForCompletedFrame(reloaded.rtt);

  await page.goto(
    `/simulator/free/interior-corner?lesson=1&${VISUAL_QUERY}`,
  );
  await expect(page).toHaveURL(/lesson=1.*#?$|lesson=1$/);
  await expect(page.getByRole("button", { name: "Regenerate scene" })).toHaveCount(0);
  const canonical = await waitForPilotMounted(page);
  const canonicalCapture = await captureCanvas(
    canonical.scene.locator("canvas").first(),
    outputDirectory,
    "observer-canonical-lesson.png",
  );
  captures.push({ label: "Canonical lesson Observe", seed: null, ...canonicalCapture });

  const observerSizes = captures
    .filter((item) => String(item.label).startsWith("Free Practice") || String(item.label).includes("replay") || String(item.label).includes("restored"))
    .map((item) => `${item.width}x${item.height}`);
  expect(new Set(observerSizes).size).toBeLessThanOrEqual(1);
  await writeFile(path.join(outputDirectory, "fixed-seed-visual-capture-report.json"), JSON.stringify({
    viewport: { width: 1280, height: 900 },
    devicePixelRatio: dpr,
    observerSize: initial.capture,
    fixedSeed: FIXED_SEED,
    captures,
  }, null, 2));

  expect(randomSeedCapture.width).toBeGreaterThan(0);
  expect(back.capture.width).toBeGreaterThan(0);
});

test("second seed Ground Glass evidence covers orientation and front movements", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/simulator/free/interior-corner?seed=${SECOND_SEED}&sv=1&${VISUAL_QUERY}`);
  const outputDirectory = await evidenceDirectory(testInfo);
  const secondSeed = await waitForPilotMounted(page);
  const secondSubjectGeneration = await subjectGeneration(secondSeed.rtt);
  const captures: Array<Record<string, unknown>> = [];
  await page.getByRole("radio", { name: "Upright Assist" }).check();
  let requestId = await waitForCompletedFrame(secondSeed.rtt);
  let capture = await captureCanvas(
    secondSeed.rtt.locator("canvas").first(),
    outputDirectory,
    "ground-glass-seed-4294967295-upright.png",
  );
  captures.push({ label: "Seed 4294967295 · Upright Assist", seed: SECOND_SEED, requestId, ...capture });
  await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
  requestId = await waitForCompletedFrame(secondSeed.rtt);
  capture = await captureCanvas(
    secondSeed.rtt.locator("canvas").first(),
    outputDirectory,
    "ground-glass-seed-4294967295-raw.png",
  );
  captures.push({ label: "Seed 4294967295 · Raw", seed: SECOND_SEED, requestId, ...capture });
  await page.getByRole("radio", { name: "Upright Assist" }).check();
  await setRangeDirectOnGrid(page, "Rise", 33);
  requestId = await waitForCompletedFrame(secondSeed.rtt);
  capture = await captureCanvas(
    secondSeed.rtt.locator("canvas").first(),
    outputDirectory,
    "ground-glass-seed-4294967295-front-rise.png",
  );
  captures.push({ label: "Seed 4294967295 · Front Rise 33 mm", seed: SECOND_SEED, requestId, ...capture });
  await setRangeDirectOnGrid(page, "Swing", 3.6);
  requestId = await waitForCompletedFrame(secondSeed.rtt);
  capture = await captureCanvas(
    secondSeed.rtt.locator("canvas").first(),
    outputDirectory,
    "ground-glass-seed-4294967295-front-swing.png",
  );
  captures.push({ label: "Seed 4294967295 · Front Swing 3.6°", seed: SECOND_SEED, requestId, ...capture });

  expect(await subjectGeneration(secondSeed.rtt)).toBe(secondSubjectGeneration);
  await writeFile(path.join(outputDirectory, "second-seed-visual-capture-report.json"), JSON.stringify({
    viewport: { width: 1280, height: 900 },
    secondSeed: SECOND_SEED,
    captures,
  }, null, 2));
});
