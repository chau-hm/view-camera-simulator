import { test, expect } from "@playwright/test";

test("camera movements scene loads and renders valid Ground Glass content", async ({ page }) => {
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  await expect(page.locator('[data-testid="scene-canvas"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-optical-geometry-visible="true"]')).toBeVisible({ timeout: 5000 });

  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(rtt).toHaveCount(1);
  await expect(rtt).toBeVisible({ timeout: 15000 });

  // Wait for camera + uniforms to be valid
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5000 });

  // RTT content diagnostics: pixel readback must show content (non-background pixels > 0)
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });

  const rawNonBg = Number(await rtt.getAttribute("data-rtt-raw-non-background"));
  const finalNonBg = Number(await rtt.getAttribute("data-rtt-final-non-background"));
  expect(Number.isFinite(rawNonBg) && rawNonBg > 0).toBe(true);
  expect(Number.isFinite(finalNonBg) && finalNonBg > 0).toBe(true);

  // No sanity error
  const sanityError = await rtt.getAttribute("data-rtt-sanity-error");
  expect(sanityError === null || sanityError === "" || sanityError === "null").toBe(true);

  // Four movement radio options
  const movementRadio = page.locator('fieldset.movement-selector');
  await expect(movementRadio.first()).toBeVisible();
  await expect(movementRadio.first().locator('input[type="radio"]')).toHaveCount(4);

  await expect(page.getByRole("button", { name: "Reset Movements" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restart Task" })).toHaveCount(0);
});

test("all four movements change Ground Glass without breaking", async ({ page }) => {
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(rtt).toBeVisible({ timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15000 });

  const movements: Array<{ label: string; slider: string }> = [
    { label: "Front Rise", slider: "20" },
    { label: "Rear Rise", slider: "20" },
    { label: "Front Tilt", slider: "-3" },
    { label: "Rear Tilt", slider: "-3" },
  ];

  for (const { label, slider: sliderVal } of movements) {
    // Select the movement radio
    await page.locator('fieldset.movement-selector').first()
      .locator('label').filter({ hasText: label }).first().click();
    await expect(rtt).toBeVisible({ timeout: 5000 });

    // Find and set the movement slider
    const slider = page.getByRole("slider", { name: label });
    await expect(slider).toBeVisible({ timeout: 3000 });
    await slider.fill(sliderVal);
    await page.waitForTimeout(2000);

    // RTT stays valid
    await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5000 });
    await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5000 });
    await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10000 });
    await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });
  }
});

test("Reset Movements restores zero state and keeps Ground Glass valid", async ({ page }) => {
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(rtt).toBeVisible({ timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15000 });

  // Select and change Front Rise
  await page.locator('fieldset.movement-selector').first()
    .locator('label').filter({ hasText: "Front Rise" }).first().click();
  const slider = page.getByRole("slider", { name: "Front Rise" });
  await expect(slider).toBeVisible({ timeout: 3000 });
  await slider.fill("25");
  await page.waitForTimeout(2000);

  // Reset
  await page.getByRole("button", { name: "Reset Movements" }).click();
  await page.waitForTimeout(1500);

  await expect(rtt).toBeVisible({ timeout: 5000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });
});
