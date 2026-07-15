import { expect, test } from "@playwright/test";
import { setRangeDirect } from "./helpers/rangeInput";

test("Shelf Swing invalid construction falls back to Top and stays in Fit Scene", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/shelf-swing");
  await setRangeDirect(page, "Swing", 5);
  await page.getByRole("button", { name: "Open 2D Geometry" }).click();

  const geometryPanel = page.locator('section[data-geometry-fit]');
  const topButton = page.getByRole("button", { name: "Top", exact: true });
  const scheimpflugButton = page.getByRole("button", {
    name: "Scheimpflug Section",
    exact: true,
  });
  const fitSceneButton = page.getByRole("button", { name: "Fit Scene" });
  const fitConstructionButton = page.getByRole("button", { name: "Fit Construction" });

  await fitConstructionButton.click();
  await expect(scheimpflugButton).toHaveAttribute("aria-pressed", "true");
  await expect(geometryPanel).toHaveAttribute("data-geometry-view", "scheimpflug");
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "construction");
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "split");
  await expect(page.getByTestId("camera-construction-region")).toBeVisible();
  await expect(page.getByTestId("subject-field-region")).toBeVisible();

  await setRangeDirect(page, "Swing", 0);
  await expect(topButton).toHaveAttribute("aria-pressed", "true");
  await expect(fitSceneButton).toHaveAttribute("aria-pressed", "true");
  await expect(geometryPanel).toHaveAttribute("data-geometry-view", "top");
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "single");
  await expect(page.getByTestId("geometry-construction-split")).toHaveCount(0);
  for (const targetId of ["shelf-front", "shelf-middle", "shelf-back"]) {
    await expect(page.getByTestId(`geometry-target-${targetId}`)).toBeVisible();
  }

  await setRangeDirect(page, "Swing", 5);
  await expect(topButton).toHaveAttribute("aria-pressed", "true");
  await expect(fitSceneButton).toHaveAttribute("aria-pressed", "true");
  await expect(geometryPanel).toHaveAttribute("data-geometry-view", "top");
  await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "single");

  await fitConstructionButton.click();
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "split");
  await fitSceneButton.click();
  await expect(topButton).toHaveAttribute("aria-pressed", "true");
  await expect(fitSceneButton).toHaveAttribute("aria-pressed", "true");
  await expect(geometryPanel).toHaveAttribute("data-geometry-view", "top");
  await expect(geometryPanel).toHaveAttribute("data-construction-layout", "single");
});
