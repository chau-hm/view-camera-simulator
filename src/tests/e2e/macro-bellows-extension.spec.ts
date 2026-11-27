import { cagePhaseError } from "./helpers/cagePhase";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";
import { CAMERA_CONSTANTS } from "../../utils/constants";

const parseMmVector = (value: string | null): number[] => {
  const parsed = value?.split(",").map(Number) ?? [];
  if (parsed.length !== 3 || parsed.some((component) => !Number.isFinite(component))) {
    throw new Error(`Invalid millimetre vector: ${value}`);
  }
  return parsed;
};

const readFiniteAttribute = async (locator: Locator, name: string) => {
  const value = Number(await locator.getAttribute(name));
  expect(Number.isFinite(value), `${name} must be finite`).toBe(true);
  return value;
};

const collectBrowserErrors = (page: Page) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  return () => {
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  };
};

const waitForSceneSubject = async (page: Page, sceneId: string) => {
  await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("scene-canvas")).toHaveAttribute(
    "data-scene-subject-id",
    sceneId,
    { timeout: 30_000 },
  );
};

const waitForAcceptedRttFrame = async (rtt: Locator) => {
  try {
    await expect.poll(async () => {
      const [lifecycle, status, requestId, completedId] = await Promise.all([
        rtt.getAttribute("data-render-host-lifecycle"),
        rtt.getAttribute("data-frame-result-status"),
        rtt.getAttribute("data-frame-request-id"),
        rtt.getAttribute("data-last-completed-request-id"),
      ]);
      return lifecycle === "ready" && status === "completed" &&
        Boolean(requestId) && requestId === completedId;
    }, { timeout: 25_000 }).toBe(true);
  } catch (error) {
    const diagnostics = await rtt.evaluate((element) => ({
      data: Object.fromEntries(Array.from(element.attributes)
        .filter((attribute) => attribute.name.startsWith("data-"))
        .map(({ name, value }) => [name, value])),
      canvases: Array.from(element.querySelectorAll("canvas"), (canvas) => {
        const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        return {
          width: canvas.width,
          height: canvas.height,
          connected: canvas.isConnected,
          contextLost: context?.isContextLost() ?? null,
          contextError: context?.getError() ?? null,
        };
      }),
    }));
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nGround Glass readiness evidence: ${JSON.stringify(diagnostics)}`);
  }
};

const readGroundGlassGain = async (rtt: Locator) =>
  Number(await rtt.getAttribute("data-rtt-ground-glass-illuminance-gain"));

const readGridSpacing = async (grid: Locator) => grid.evaluate((element) =>
  Number.parseFloat(getComputedStyle(element).backgroundSize.split(" ")[0]),
);

const readGridPhase = async (grid: Locator) => grid.evaluate((element) => {
  const rect = element.getBoundingClientRect();
  const [x = "0px", y = "0px"] = getComputedStyle(element).backgroundPosition.split(" ");
  return {
    x: Number.parseFloat(x),
    y: Number.parseFloat(y),
    width: rect.width,
    height: rect.height,
  };
});

const expectMacroCoverageState = async (
  scene: Locator,
  rtt: Locator,
  readout: Locator,
  expectedDiameterMm: number,
) => {
  await waitForAcceptedRttFrame(rtt);
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  await expect(scene).toHaveAttribute("data-image-circle-ray-count", "12");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect(readout).toContainText(`${expectedDiameterMm.toFixed(1)} mm · simulator profile`);
  const [sceneRadiusMm, rttRadiusMm] = await Promise.all([
    readFiniteAttribute(scene, "data-image-circle-radius-mm"),
    readFiniteAttribute(rtt, "data-rtt-coverage-radius-mm"),
  ]);
  const filmCornerRadiusMm = Math.hypot(CAMERA_CONSTANTS.filmWidthMm / 2, CAMERA_CONSTANTS.filmHeightMm / 2);
  expect(sceneRadiusMm).toBeCloseTo(expectedDiameterMm / 2, 1);
  expect(sceneRadiusMm).toBeCloseTo(rttRadiusMm, 5);
  expect(sceneRadiusMm).toBeGreaterThan(filmCornerRadiusMm);
  return sceneRadiusMm;
};

test("Macro 1 tracks canonical Image Circle growth and bellows exposure across focus", async ({ page }) => {
  test.setTimeout(100_000);
  const expectNoBrowserErrors = collectBrowserErrors(page);

  await page.goto("/simulator/free/architecture-rise");
  await waitForSceneSubject(page, "architecture-rise");
  await expect(page.getByRole("button", { name: "Infinity Reset" })).toBeVisible();
  await page.getByRole("button", { name: "Infinity Reset" }).click();
  await expect(page.getByText(/Focus: ∞/)).toBeVisible();

  // Preserve the cross-scene Infinity Focus initialization regression.
  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await page.locator('a[href="/simulator/free/macro-bellows-extension"]').click();
  await expect(page).toHaveURL(/\/simulator\/free\/macro-bellows-extension$/);
  await waitForSceneSubject(page, "macro-bellows-extension");

  const sceneCanvas = page.getByTestId("scene-canvas");
  const groundGlassRtt = page.getByTestId("ground-glass-rtt");
  const readout = page.getByRole("region", { name: "Macro focus" });
  const focus = page.getByRole("slider", { name: "Focus distance" });
  const aperture = page.getByRole("radiogroup", { name: "Aperture" });

  await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-bellows-extension");
  await expect(focus).toHaveValue("900");
  await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  await expect(aperture).toBeEnabled();
  await expect(aperture.getByRole("radio")).toHaveCount(6);
  await expect(aperture.getByRole("radio", { name: "f/11" })).toBeEnabled();
  await expect(page.getByText("Aperture is fixed for this lesson", { exact: true })).toHaveCount(0);
  await expect(readout).toContainText("180.0 mm");
  await expect(readout).toContainText("0.20×");
  const initialCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 261.56);
  const initialFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  expect(initialFilmCenter[2]).toBeCloseTo(-180, 5);
  await expect(readout).toContainText("1:5");
  await expect(readout).toContainText("320.0 mm");
  await expect(readout).toContainText("Selected focus-plane magnification");

  const expectedInitialGain = ((11 / 5.6) ** 2) / 1.44;
  await expect.poll(() => readGroundGlassGain(groundGlassRtt)).toBeCloseTo(expectedInitialGain, 3);
  const initialGroundGlassGain = await readGroundGlassGain(groundGlassRtt);

  await page.getByRole("button", { name: "Open Task and Feedback" }).click();
  const taskView = page.getByTestId("learning-overlay-task-view");
  await expect(taskView).toContainText("261.6 mm");
  await expect(taskView).toContainText("current film plane");
  await expect(taskView).toContainText("separate from subject magnification");

  await setStepRangeInput(page, "Focus distance", 450);
  await expect(focus).toHaveValue("450");
  await expect(readout).toContainText("225.0 mm");
  await expect(readout).toContainText("0.50×");
  await expect(readout).toContainText("2.25×");
  await expect(readout).toContainText("+1.17 stops");
  const middleCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 326.94);
  expect(middleCircleRadiusMm).toBeGreaterThan(initialCircleRadiusMm);
  await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  const middleFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  expect(middleFilmCenter[2]).toBeCloseTo(-225, 5);
  await expect(taskView).toContainText("326.9 mm");
  await expect(taskView).toContainText("at a fixed aperture");
  const middleGroundGlassGain = await readGroundGlassGain(groundGlassRtt);
  expect(middleGroundGlassGain).toBeLessThan(initialGroundGlassGain);

  await setStepRangeInput(page, "Focus distance", 300);
  await expect(focus).toHaveValue("300");
  await expect(readout).toContainText("300.0 mm");
  await expect(readout).toContainText("1.00×");
  await expect(readout).toContainText("1:1");
  await expect(readout).toContainText("4.00×");
  await expect(readout).toContainText("+2.00 stops");
  await expect(readout).toContainText("Life-size reproduction reached (1:1)");
  await expect(taskView).toContainText("selected chapter-ring plane is now sharply reproduced");
  const finalCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 435.93);
  expect(finalCircleRadiusMm).toBeGreaterThan(middleCircleRadiusMm);
  await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  await expect(taskView).toContainText("435.9 mm");
  await expect(taskView).toContainText("rear standard moves farther from the lens");
  await expect(taskView).toContainText("carries the film plane with it");
  await expect(taskView).toContainText("4×5 film rectangle keeps the same physical dimensions");
  const finalFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  expect(finalFilmCenter[2]).toBeCloseTo(-300, 5);
  await expect.poll(() => readGroundGlassGain(groundGlassRtt)).toBeCloseTo(((11 / 5.6) ** 2) * 0.25, 3);
  expect(await readGroundGlassGain(groundGlassRtt)).toBeLessThan(initialGroundGlassGain);

  expectNoBrowserErrors();
});

test("Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions", async ({ page }) => {
  test.setTimeout(75_000);
  const expectNoBrowserErrors = collectBrowserErrors(page);
  await page.goto("/simulator/free/macro-bellows-extension");

  const sceneCanvas = page.getByTestId("scene-canvas");
  const sceneWebglCanvas = sceneCanvas.locator("canvas");
  const groundGlassCanvas = page.locator(".groundglass-renderer-host canvas");
  const groundGlassRtt = page.getByTestId("ground-glass-rtt");
  const readout = page.getByRole("region", { name: "Macro focus" });
  const focus = page.getByRole("slider", { name: "Focus distance" });
  const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  const grid = page.getByTestId("ground-glass-grid");

  await waitForSceneSubject(page, "macro-bellows-extension");
  await expect(sceneWebglCanvas).toHaveCount(1);
  await expect(groundGlassCanvas).toHaveCount(1);
  await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-bellows-extension");
  // Circular distance remains valid when the 60-second phase wraps.
  const angularDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const sampleCage = async (canvas: Locator) => canvas.evaluate((element) => ({
    angle: Number(element.getAttribute("data-macro-watch-cage-angle")),
    time: performance.now(),
  }));
  const readCageAngle = async (canvas: Locator) => {
    const value = await canvas.getAttribute("data-macro-watch-cage-angle");
    return value === null ? Number.NaN : Number(value);
  };
  await expect.poll(async () => Number.isFinite(await readCageAngle(sceneWebglCanvas)), { timeout: 60_000 }).toBe(true);
  await expect.poll(async () => Number.isFinite(await readCageAngle(groundGlassCanvas)), { timeout: 60_000 }).toBe(true);
  await waitForAcceptedRttFrame(groundGlassRtt);
  const initialObserverCageAngle = await readCageAngle(sceneWebglCanvas);
  const initialRttCageAngle = await readCageAngle(groundGlassCanvas);
  expect(angularDistance(initialObserverCageAngle, initialRttCageAngle)).toBeLessThan(0.18);
  await expect(focus).toHaveValue("900");
  await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  await expect(readout).toContainText("180.0 mm");
  const initialCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 261.56);
  const initialFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  expect(initialFilmCenter[2]).toBeCloseTo(-180, 5);

  await expect(grid).toHaveAttribute("data-grid-mode", "physical");
  await expect(page.getByTestId("ground-glass-scale-cue")).toHaveText("Grid: 1 cm per square");
  const initialGridSpacing = await readGridSpacing(grid);
  expect(initialGridSpacing).toBeGreaterThan(30);
  expect(initialGridSpacing).not.toBeCloseTo(20, 0);
  const initialSceneImage = await sceneWebglCanvas.screenshot({ animations: "disabled" });

  await page.waitForTimeout(2_000);
  const advancedObserverCageAngle = await readCageAngle(sceneWebglCanvas);
  const advancedRttCageAngle = await readCageAngle(groundGlassCanvas);
  expect(angularDistance(initialObserverCageAngle, advancedObserverCageAngle)).toBeGreaterThan(0.08);
  expect(angularDistance(initialRttCageAngle, advancedRttCageAngle)).toBeGreaterThan(0.08);
  expect(angularDistance(advancedObserverCageAngle, advancedRttCageAngle)).toBeLessThan(0.18);

  // Wait for a nonzero canonical phase so a reset during controls is detectable.
  await expect.poll(async () => Math.abs(await readCageAngle(sceneWebglCanvas)), { timeout: 20_000 }).toBeGreaterThan(0.5);
  const beforeControls = await sampleCage(sceneWebglCanvas);
  await page.getByRole("button", { name: "Focus loupe · 4× Ground Glass view", exact: true }).click();
  await expect(page.getByRole("button", { name: /Reset Ground Glass view/ })).toBeVisible();
  await expect.poll(() => readGridSpacing(grid)).toBeGreaterThan(initialGridSpacing * 3.9);

  await setStepRangeInput(page, "Focus distance", 300);
  await expect(focus).toHaveValue("300");
  await expect(readout).toContainText("300.0 mm");
  await expect(readout).toContainText("1.00×");
  await expect(readout).toContainText("1:1");
  await expect(readout).toContainText("4.00×");
  await expect(readout).toContainText("+2.00 stops");
  const finalCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 435.93);
  expect(finalCircleRadiusMm).toBeGreaterThan(initialCircleRadiusMm);
  const finalFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  expect(finalFilmCenter[2]).toBeCloseTo(-300, 5);
  expect(await sceneWebglCanvas.screenshot({ animations: "disabled" })).not.toEqual(initialSceneImage);

  const readGain = () => readGroundGlassGain(groundGlassRtt);
  await expect.poll(readGain).toBeCloseTo(((11 / 5.6) ** 2) * 0.25, 3);
  const oneToOneWideOpenGain = await readGain();
  await aperture.getByRole("radio", { name: "f/11" }).check();
  await expect(aperture).toHaveAttribute("data-selected-aperture", "11");
  await expect.poll(readGain).toBeCloseTo(0.25, 3);
  expect(await readGain()).toBeLessThan(oneToOneWideOpenGain);

  await aperture.getByRole("radio", { name: "f/22" }).check();
  await expect(aperture).toHaveAttribute("data-selected-aperture", "22");
  await expect.poll(readGain).toBeCloseTo(0.0625, 3);
  expect(await readGain()).toBeLessThan(0.25);
  const afterControls = await sampleCage(sceneWebglCanvas);
  // 0.2 rad allows approximately 1.9 s of render/observation lag, while
  // rejecting a reset from the sampled nonzero phase.
  expect(cagePhaseError(beforeControls.angle, afterControls.angle, afterControls.time - beforeControls.time)).toBeLessThan(0.2);
  expect(await readFiniteAttribute(sceneCanvas, "data-image-circle-radius-mm")).toBeCloseTo(finalCircleRadiusMm, 5);
  expect(await readGain()).toBeLessThan(oneToOneWideOpenGain);

  // Macro Bellows exposes no movement-reset button. A public catalog re-entry
  // starts this scene's shared cage clock at its canonical phase while keeping
  // the ordinary free-scene optical state intact in the store.
  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/macro-bellows-extension"]').click();
  await expect(page).toHaveURL(/\/simulator\/free\/macro-bellows-extension$/);
  await waitForSceneSubject(page, "macro-bellows-extension");
  await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-bellows-extension");
  await expect(sceneWebglCanvas).toHaveCount(1);
  await expect(groundGlassCanvas).toHaveCount(1);
  await waitForAcceptedRttFrame(groundGlassRtt);
  await expect.poll(() => readCageAngle(sceneWebglCanvas), { timeout: 20_000 }).toBeGreaterThan(-0.18);
  await expect.poll(() => readCageAngle(groundGlassCanvas), { timeout: 25_000 }).toBeGreaterThan(-0.18);
  expect(angularDistance(await readCageAngle(sceneWebglCanvas), await readCageAngle(groundGlassCanvas))).toBeLessThan(0.18);
  expectNoBrowserErrors();
});

test("Macro 1 physical grid follows both Raw and Upright film-origin positions", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/simulator/free/macro-bellows-extension");
  const rttCanvas = page.locator(".groundglass-renderer-host canvas");
  const grid = page.getByTestId("ground-glass-grid");
  await waitForSceneSubject(page, "macro-bellows-extension");
  await expect(rttCanvas).toHaveCount(1);
  await expect(grid).toHaveAttribute("data-grid-mode", "physical");

  const rawPhase = await readGridPhase(grid);
  // The raw film origin (physical upper-left) appears at display upper-right.
  expect(rawPhase.x).toBeCloseTo(rawPhase.width, 0);
  expect(rawPhase.y).toBeCloseTo(0, 0);
  await testInfo.attach("macro-bellows-raw-grid-over-webgl", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  const uprightMode = page.getByRole("radio", { name: "Upright Assist" });
  await uprightMode.check();
  await expect(uprightMode).toBeChecked();
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const uprightPhase = await readGridPhase(grid);
  // Upright Assist places the same physical origin at display lower-left.
  expect(uprightPhase.x).toBeCloseTo(0, 0);
  expect(uprightPhase.y).toBeCloseTo(uprightPhase.height, 0);
  await testInfo.attach("macro-bellows-upright-grid-over-webgl", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});
