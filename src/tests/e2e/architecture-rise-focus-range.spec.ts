import { expect, test, type Locator } from "@playwright/test";

const readVector = async (locator: Locator, attribute: string): Promise<[number, number, number]> => {
  const value = await locator.getAttribute(attribute);
  if (!value) throw new Error(`${attribute} is missing from the Architecture Rise diagnostics`);
  const vector = value.split(",").map(Number);
  if (vector.length !== 3 || !vector.every(Number.isFinite)) {
    throw new Error(`${attribute} is not a finite three-dimensional vector: ${value}`);
  }
  return vector as [number, number, number];
};

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test("Architecture Rise focus control stays within scene depth and preserves thin-lens extension", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/architecture-rise");

  const scene = page.getByTestId("scene-canvas");
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  await expect(scene.locator("canvas")).toHaveCount(1);
  await expect(scene).toHaveAttribute("data-optics-fallback-applied", "false");
  await expect(focus).toBeEnabled();
  await expect(focus).toHaveValue("8890");
  await expect(focus).toHaveAttribute("min", "3090");
  await expect(focus).toHaveAttribute("max", "13000");
  await page.screenshot({ path: testInfo.outputPath("architecture-rise-focus-canonical.png") });

  // Home is a standard accessible range-control action and reaches the public
  // minimum without hundreds of expensive intermediate WebGL updates.
  await focus.focus();
  await focus.press("Home");
  await expect(focus).toHaveValue("3090");

  const lens = await readVector(scene, "data-camera-lens-center-world");
  const film = await readVector(scene, "data-camera-film-center-world");
  const lensToFilmDistanceMm = distance(lens, film);
  expect(lensToFilmDistanceMm).toBeCloseTo((150 * 3090) / (3090 - 150), 2);
  expect(lensToFilmDistanceMm).toBeLessThan(160);
  expect(lensToFilmDistanceMm).toBeLessThan(2400);
  await page.screenshot({ path: testInfo.outputPath("architecture-rise-focus-minimum.png") });
});
