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

  await page.goto("/simulator/free/macro-bellows-extension");
  const sceneCanvas = page.getByTestId("scene-canvas");
  const sceneWebglCanvas = sceneCanvas.locator("canvas");
  const groundGlassCanvas = page.locator(".groundglass-renderer-host canvas");
  const readout = page.getByRole("region", { name: "Macro focus" });

  await expect(sceneWebglCanvas).toHaveCount(1);
  await expect(groundGlassCanvas).toHaveCount(1);
  await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-bellows-extension");
  await expect(readout).toContainText("180.0 mm");
  await expect(readout).toContainText("0.20×");

  const initialFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  expect(initialFilmCenter[2]).toBeCloseTo(-180, 5);
  const initialSceneImage = await sceneWebglCanvas.screenshot();
  const initialGroundGlassImage = await groundGlassCanvas.screenshot();

  await setStepRangeInput(page, "Focus distance", 300);
  await expect(readout).toContainText("300.0 mm");
  await expect(readout).toContainText("1.00×");
  await expect(readout).toContainText("4.00×");
  await expect(readout).toContainText("+2.00 stops");
  await expect(readout).toContainText("Approximately life-size (1:1)");

  const finalFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  expect(finalFilmCenter[2]).toBeCloseTo(-300, 5);
  expect(await sceneWebglCanvas.screenshot()).not.toEqual(initialSceneImage);
  expect(await groundGlassCanvas.screenshot()).not.toEqual(initialGroundGlassImage);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
