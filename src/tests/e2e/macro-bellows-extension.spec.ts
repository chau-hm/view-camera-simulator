import { expect, test, type Locator } from "@playwright/test";
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

const expectMacroCoverageState = async (
  scene: Locator,
  rtt: Locator,
  readout: Locator,
  expectedDiameterMm: number,
) => {
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

test("Macro 1 keeps canonical bellows geometry and RTT subject across the focus range", async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/simulator/free/architecture-rise");
  await expect(page.getByRole("button", { name: "Infinity Reset" })).toBeVisible();
  await page.getByRole("button", { name: "Infinity Reset" }).click();
  await expect(page.getByText(/Focus: ∞/)).toBeVisible();

  // Navigate through the SPA so the previous scene's Infinity Focus state is
  // still present when Macro Scene 1 initializes its route.
  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await page.locator('a[href="/simulator/free/macro-bellows-extension"]').click();
  await expect(page).toHaveURL(/\/simulator\/free\/macro-bellows-extension$/);

  const sceneCanvas = page.getByTestId("scene-canvas");
  const sceneWebglCanvas = sceneCanvas.locator("canvas");
  const groundGlassCanvas = page.locator(".groundglass-renderer-host canvas");
  const groundGlassRtt = page.getByTestId("ground-glass-rtt");
  const readout = page.getByRole("region", { name: "Macro focus" });
  const focus = page.getByRole("slider", { name: "Focus distance" });
  const aperture = page.getByRole("radiogroup", { name: "Aperture" });

  await expect(sceneWebglCanvas).toHaveCount(1);
  await expect(groundGlassCanvas).toHaveCount(1);
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
  await expect(readout).toContainText("1:5");
  await expect(readout).toContainText("320.0 mm");
  await expect(readout).toContainText("Selected focus-plane magnification");
  const readGroundGlassGain = async () =>
    Number(await groundGlassRtt.getAttribute("data-rtt-ground-glass-illuminance-gain"));
  const expectedInitialGain = ((11 / 5.6) ** 2) / 1.44;
  await expect.poll(readGroundGlassGain).toBeCloseTo(expectedInitialGain, 3);
  const initialGroundGlassGain = await readGroundGlassGain();
  const grid = page.getByTestId("ground-glass-grid");
  await expect(grid).toHaveAttribute("data-grid-mode", "physical");
  await expect(page.getByTestId("ground-glass-scale-cue")).toHaveText("Grid: 1 cm per square");
  const initialGridSpacing = await grid.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).backgroundSize.split(" ")[0]),
  );
  expect(initialGridSpacing).toBeGreaterThan(30);
  expect(initialGridSpacing).not.toBeCloseTo(20, 0);

  await page.getByRole("button", { name: "Open Task and Feedback" }).click();
  const taskView = page.getByTestId("learning-overlay-task-view");
  await expect(taskView).toContainText("261.6 mm");

  await page.getByRole("button", { name: "Focus loupe · 4× Ground Glass view", exact: true }).click();
  await expect(page.getByRole("button", { name: /Reset Ground Glass view/ })).toBeVisible();
  await expect.poll(async () =>
    grid.evaluate((element) => Number.parseFloat(getComputedStyle(element).backgroundSize.split(" ")[0])),
  ).toBeGreaterThan(initialGridSpacing * 3.9);

  const initialFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  expect(initialFilmCenter[2]).toBeCloseTo(-180, 5);
  const initialSceneImage = await sceneWebglCanvas.screenshot();

  await setStepRangeInput(page, "Focus distance", 450);
  await expect(focus).toHaveValue("450");
  await expect(readout).toContainText("225.0 mm");
  await expect(readout).toContainText("0.50×");
  await expect(readout).toContainText("2.25×");
  await expect(readout).toContainText("+1.17 stops");
  const middleCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 326.94);
  expect(middleCircleRadiusMm).toBeGreaterThan(initialCircleRadiusMm);
  await expect(taskView).toContainText("326.9 mm");
  await expect(taskView).toContainText("at a fixed aperture");
  const middleGroundGlassGain = await readGroundGlassGain();
  expect(middleGroundGlassGain).toBeLessThan(initialGroundGlassGain);

  await setStepRangeInput(page, "Focus distance", 300);
  await expect(readout).toContainText("300.0 mm");
  await expect(readout).toContainText("1.00×");
  await expect(readout).toContainText("1:1");
  await expect(readout).toContainText("4.00×");
  await expect(readout).toContainText("+2.00 stops");
  await expect(readout).toContainText("Life-size reproduction reached (1:1)");
  await expect(readout).toContainText("specimen is now sharply reproduced");
  const finalCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 435.93);
  expect(finalCircleRadiusMm).toBeGreaterThan(middleCircleRadiusMm);
  await expect(taskView).toContainText("435.9 mm");
  await expect(taskView).toContainText("rear standard moves farther from the lens");
  await expect(taskView).toContainText("carries the film plane with it");
  await expect(taskView).toContainText("4×5 film rectangle keeps the same physical dimensions");
  await expect.poll(readGroundGlassGain).toBeCloseTo(((11 / 5.6) ** 2) * 0.25, 3);
  const oneToOneWideOpenGain = await readGroundGlassGain();
  expect(oneToOneWideOpenGain).toBeLessThan(initialGroundGlassGain);

  await aperture.getByRole("radio", { name: "f/11" }).check();
  await expect(aperture).toHaveAttribute("data-selected-aperture", "11");
  await expect.poll(readGroundGlassGain).toBeCloseTo(0.25, 3);
  expect(await readGroundGlassGain()).toBeLessThan(oneToOneWideOpenGain);
  await expect(focus).toHaveValue("300");
  await expect(readout).toContainText("300.0 mm");
  await expect(readout).toContainText("1.00×");
  await expect(readout).toContainText("1:1");
  await expect(readout).toContainText("4.00×");
  await expect(readout).toContainText("+2.00 stops");
  expect(await readFiniteAttribute(sceneCanvas, "data-image-circle-radius-mm")).toBeCloseTo(finalCircleRadiusMm, 5);

  await aperture.getByRole("radio", { name: "f/22" }).check();
  await expect(aperture).toHaveAttribute("data-selected-aperture", "22");
  await expect.poll(readGroundGlassGain).toBeCloseTo(0.0625, 3);
  expect(await readGroundGlassGain()).toBeLessThan(0.25);

  const finalFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  expect(finalFilmCenter[2]).toBeCloseTo(-300, 5);
  expect(await sceneWebglCanvas.screenshot()).not.toEqual(initialSceneImage);
  expect(await readGroundGlassGain()).toBeLessThan(initialGroundGlassGain);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
