import { test, expect } from "@playwright/test";

test("camera movements scene loads and renders valid Ground Glass content", async ({ page }) => {
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  await expect(page.locator('[data-testid="scene-canvas"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-optical-geometry-visible="true"]')).toBeVisible({ timeout: 5000 });

  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(rtt).toHaveCount(1);
  await expect(rtt).toBeVisible({ timeout: 15000 });

  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });

  const rawNonBg = Number(await rtt.getAttribute("data-rtt-raw-non-background"));
  const finalNonBg = Number(await rtt.getAttribute("data-rtt-final-non-background"));
  expect(Number.isFinite(rawNonBg) && rawNonBg > 0).toBe(true);
  expect(Number.isFinite(finalNonBg) && finalNonBg > 0).toBe(true);

  const sanityError = await rtt.getAttribute("data-rtt-sanity-error");
  expect(sanityError === null || sanityError === "" || sanityError === "null").toBe(true);

  const movementRadio = page.locator('fieldset.movement-selector');
  await expect(movementRadio.first()).toBeVisible();
  await expect(movementRadio.first().locator('input[type="radio"]')).toHaveCount(4);

  await expect(page.getByRole("button", { name: "Reset Movements" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restart Task" })).toHaveCount(0);
});

test("all four movements change Ground Glass without breaking", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(rtt).toBeVisible({ timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15000 });

  const movements: Array<{ label: string }> = [
    { label: "Front Rise" },
    { label: "Rear Rise" },
    { label: "Front Tilt" },
    { label: "Rear Tilt" },
  ];

  for (const { label } of movements) {
    // Select the movement radio
    const labelEl = page.locator('fieldset.movement-selector').first()
      .locator('label').filter({ hasText: label }).first();
    await labelEl.click();

    // Verify radio is checked
    await expect(labelEl.locator('input[type="radio"]')).toBeChecked();

    // Exactly one movement slider visible
    const slider = page.getByRole("slider", { name: label });
    await expect(slider).toBeVisible({ timeout: 3000 });

    // Capture current sanity state before changing
    const prevState = await rtt.getAttribute("data-rtt-sanity-state");

    // Change slider using keyboard for deterministic input
    await slider.focus();
    await slider.press("Home"); // reset to min
    if (label.includes("Tilt")) {
      await slider.press("ArrowDown");
      await slider.press("ArrowDown");
      await slider.press("ArrowDown");
    } else {
      for (let i = 0; i < 10; i++) {
        await slider.press("ArrowRight");
      }
    }

    // Wait for a new RTT frame (sanity state differs from previous)
    await expect.poll(async () => {
      const state = await rtt.getAttribute("data-rtt-sanity-state");
      if (state && state !== prevState && state.length > 0) return true;
      return false;
    }, { timeout: 15000, intervals: [500, 1000, 2000] }).toBe(true);

    // RTT stays valid
    await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5000 });
    await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5000 });
    await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10000 });
    await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });
  }
});

test("Reset Movements restores zero state and keeps Ground Glass valid", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(rtt).toBeVisible({ timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15000 });

  // Select and change Front Rise
  await page.locator('fieldset.movement-selector').first()
    .locator('label').filter({ hasText: "Front Rise" }).first().click();
  const slider = page.getByRole("slider", { name: "Front Rise" });
  await expect(slider).toBeVisible({ timeout: 3000 });
  await slider.focus();
  for (let i = 0; i < 15; i++) {
    await slider.press("ArrowRight");
  }

  const sliderValue = await slider.inputValue();
  expect(Number(sliderValue)).toBeGreaterThan(0);

  const prevState = await rtt.getAttribute("data-rtt-sanity-state");

  // Reset Movements
  await page.getByRole("button", { name: "Reset Movements" }).click();

  // Verify slider returned to zero
  const resetSlider = page.getByRole("slider", { name: "Front Rise" });
  await expect(resetSlider).toBeVisible({ timeout: 3000 });
  await expect(resetSlider).toHaveValue("0");

  // Wait for a new RTT frame after reset
  await expect.poll(async () => {
    const state = await rtt.getAttribute("data-rtt-sanity-state");
    if (state && state !== prevState && state.length > 0) return true;
    return false;
  }, { timeout: 10000, intervals: [500, 1000] }).toBe(true);

  // Ground Glass stays valid
  await expect(rtt).toBeVisible({ timeout: 5000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });

  // Default movement (Front Rise) should be selected
  const frontRiseRadio = page.locator('fieldset.movement-selector').first()
    .locator('label').filter({ hasText: "Front Rise" }).first()
    .locator('input[type="radio"]');
  await expect(frontRiseRadio).toBeChecked();
});

test("canonical lattice remains stable across controls and SPA routes", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  const unexpectedGraphicsWarnings: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "warning" || !/(WebGL|THREE)/i.test(message.text())) return;
    if (/GPU stall due to ReadPixels/i.test(message.text())) return;
    unexpectedGraphicsWarnings.push(message.text());
  });

  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  const scene = page.locator('[data-testid="scene-canvas"]');
  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(page.getByText("Subjects", { exact: true })).toHaveCount(0);
  await expect(scene).toHaveAttribute("data-lattice-edge-count", "224", { timeout: 15_000 });
  await expect(scene).toHaveAttribute("data-lattice-target-region", "middle", { timeout: 15_000 });
  await expect(scene).toHaveAttribute("data-reference-camera-visible", "false", { timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-focal-length-mm", "105", { timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-lattice-edge-count", "224", { timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-lattice-target-region", "middle", { timeout: 15_000 });

  const frontRise = page.getByRole("slider", { name: "Front Rise" });
  await frontRise.focus();
  await frontRise.press("ArrowRight");
  await expect(frontRise).not.toHaveValue("0");
  await page.getByRole("button", { name: "Reset Movements" }).click();
  await expect(frontRise).toHaveValue("0");
  await expect(scene).toHaveAttribute("data-lattice-target-region", "middle");
  await expect(rtt).toHaveAttribute("data-rtt-lattice-target-region", "middle");
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });

  await page.getByRole("link", { name: "All Scenes" }).click();
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) })
    .getByRole("link", { name: "Open Scene" })
    .click();
  const legacyRtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(legacyRtt).toHaveAttribute("data-rtt-focal-length-mm", "150", { timeout: 15_000 });
  await page.getByRole("link", { name: "All Scenes" }).click();
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Understanding Camera Movements" }) })
    .getByRole("link", { name: "Open Scene" })
    .click();
  await expect(page.locator('[data-testid="scene-canvas"]')).toHaveAttribute("data-lattice-edge-count", "224", { timeout: 15_000 });
  await expect(page.locator('[data-testid="ground-glass-rtt"]')).toHaveAttribute("data-rtt-focal-length-mm", "105", { timeout: 15_000 });
  await expect(page.locator('[data-testid="ground-glass-rtt"]')).toHaveAttribute("data-rtt-lattice-edge-count", "224", { timeout: 15_000 });

  expect(pageErrors).toEqual([]);
  expect(unexpectedGraphicsWarnings).toEqual([]);
});
