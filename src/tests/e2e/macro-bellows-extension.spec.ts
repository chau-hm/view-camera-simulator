import { expect, test } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const parseMmVector = (value: string | null): number[] => {
  const parsed = value?.split(",").map(Number) ?? [];
  if (parsed.length !== 3 || parsed.some((component) => !Number.isFinite(component))) {
    throw new Error(`Invalid millimetre vector: ${value}`);
  }
  return parsed;
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

  await page.getByRole("button", { name: "Focus loupe · 4× Ground Glass view", exact: true }).click();
  await expect(page.getByRole("button", { name: /Reset Ground Glass view/ })).toBeVisible();
  await expect.poll(async () =>
    grid.evaluate((element) => Number.parseFloat(getComputedStyle(element).backgroundSize.split(" ")[0])),
  ).toBeGreaterThan(initialGridSpacing * 3.9);

  const initialFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  expect(initialFilmCenter[2]).toBeCloseTo(-180, 5);
  const initialSceneImage = await sceneWebglCanvas.screenshot();
  const initialGroundGlassImage = await groundGlassCanvas.screenshot();

  await setStepRangeInput(page, "Focus distance", 300);
  await expect(readout).toContainText("300.0 mm");
  await expect(readout).toContainText("1.00×");
  await expect(readout).toContainText("1:1");
  await expect(readout).toContainText("4.00×");
  await expect(readout).toContainText("+2.00 stops");
  await expect(readout).toContainText("Life-size reproduction reached (1:1)");
  await expect(readout).toContainText("specimen is now sharply reproduced");
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

  await aperture.getByRole("radio", { name: "f/22" }).check();
  await expect(aperture).toHaveAttribute("data-selected-aperture", "22");
  await expect.poll(readGroundGlassGain).toBeCloseTo(0.0625, 3);
  expect(await readGroundGlassGain()).toBeLessThan(0.25);

  const finalFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  expect(finalFilmCenter[2]).toBeCloseTo(-300, 5);
  expect(await sceneWebglCanvas.screenshot()).not.toEqual(initialSceneImage);
  expect(await groundGlassCanvas.screenshot()).not.toEqual(initialGroundGlassImage);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
