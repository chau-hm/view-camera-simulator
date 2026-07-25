import { test, expect } from "@playwright/test";

test("camera movements scene loads and functions", async ({ page }) => {
  await page.goto("/simulator/free/understanding-camera-movements");

  // Scene renders
  await expect(page.locator('[data-testid="scene-canvas"]')).toBeVisible({ timeout: 10000 });

  // Ground Glass heading is present
  await expect(page.getByRole("heading", { name: "Ground Glass" })).toBeVisible({ timeout: 5000 });

  // Movement radio group exists (MovementSelector uses fieldset with radiogroup)
  const movementSection = page.locator('fieldset.movement-selector');
  await expect(movementSection.first()).toBeVisible({ timeout: 5000 });
  await expect(movementSection.first().locator('input[type="radio"]')).toHaveCount(4);

  // Reset Movements button exists
  await expect(page.getByRole("button", { name: "Reset Movements" })).toBeVisible();

  // Infinity Reset is absent
  await expect(page.getByRole("button", { name: "Infinity Reset" })).toHaveCount(0);

  // Restart Task is absent in free mode
  await expect(page.getByRole("button", { name: "Restart Task" })).toHaveCount(0);
});
