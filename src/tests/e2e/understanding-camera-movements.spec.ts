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
    { label: "Front Rise / Fall" },
    { label: "Rear Rise / Fall" },
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
    .locator('label').filter({ hasText: "Front Rise / Fall" }).first().click();
  const slider = page.getByRole("slider", { name: "Front Rise / Fall" });
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
  const resetSlider = page.getByRole("slider", { name: "Front Rise / Fall" });
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
    .locator('label').filter({ hasText: "Front Rise / Fall" }).first()
    .locator('input[type="radio"]');
  await expect(frontRiseRadio).toBeChecked();
});

test("subject presentation control stays synchronized across calibration and SPA routes", async ({ page }) => {
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
  const subjects = page.locator('fieldset.subject-count-control');
  await expect(scene).toHaveAttribute("data-scene-subject-count", "3", { timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-focal-length-mm", "105", { timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-subject-count", "3", { timeout: 15_000 });

  for (const count of [1, 2, 3]) {
    const radio = subjects.getByRole("radio", { name: `${count} subject${count === 1 ? "" : "s"}` });
    await radio.check();
    await expect(radio).toBeChecked();
    await expect(scene).toHaveAttribute("data-scene-subject-count", String(count));
    await expect(rtt).toHaveAttribute("data-rtt-subject-count", String(count));
  }

  // Reset must only clear camera movements, not the selected presentation count.
  const twoSubjects = subjects.getByRole("radio", { name: "2 subjects" });
  await twoSubjects.check();
  const frontRise = page.getByRole("slider", { name: "Front Rise / Fall" });
  await frontRise.focus();
  await frontRise.press("ArrowRight");
  await expect(frontRise).not.toHaveValue("0");
  await expect(scene).toHaveAttribute("data-scene-subject-count", "2");
  await expect(rtt).toHaveAttribute("data-rtt-subject-count", "2");

  await page.getByRole("button", { name: "Reset Movements" }).click();
  await expect(frontRise).toHaveValue("0");
  await expect(scene).toHaveAttribute("data-scene-subject-count", "2");
  await expect(rtt).toHaveAttribute("data-rtt-subject-count", "2");
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
  await expect(page.locator('[data-testid="scene-canvas"]')).toHaveAttribute("data-scene-subject-count", "3", { timeout: 15_000 });
  await expect(page.locator('[data-testid="ground-glass-rtt"]')).toHaveAttribute("data-rtt-focal-length-mm", "105", { timeout: 15_000 });
  await expect(page.locator('[data-testid="ground-glass-rtt"]')).toHaveAttribute("data-rtt-subject-count", "3", { timeout: 15_000 });

  expect(pageErrors).toEqual([]);
  expect(unexpectedGraphicsWarnings).toEqual([]);
});

test("configuration presets: whole camera, indirect shift, then reset", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");

  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  const config = page.locator('[data-testid="camera-configuration-control"]');
  await expect(rtt).toBeVisible({ timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15_000 });
  await expect(config).toBeVisible({ timeout: 5_000 });

  const baselineSanity = await rtt.getAttribute("data-rtt-sanity-state");

  // Whole camera upward → Ground Glass changes
  await config.getByRole("radio", { name: "Whole camera", exact: true }).check();
  await config.getByRole("radio", { name: "Upward", exact: true }).check();
  await expect.poll(async () => {
    const state = await rtt.getAttribute("data-rtt-sanity-state");
    return Boolean(state && state !== baselineSanity && state.length > 0);
  }, { timeout: 15_000, intervals: [500, 1000, 2000] }).toBe(true);
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5_000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5_000 });
  const wholeSanity = await rtt.getAttribute("data-rtt-sanity-state");

  // Indirect shift upward → corrected geometry (new GG state, still valid)
  await config.getByRole("radio", { name: "Indirect shift", exact: true }).check();
  await expect.poll(async () => {
    const state = await rtt.getAttribute("data-rtt-sanity-state");
    return Boolean(state && state !== wholeSanity && state.length > 0);
  }, { timeout: 15_000, intervals: [500, 1000, 2000] }).toBe(true);
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5_000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5_000 });

  // Reset → neutral state restored with no complete preset selected
  await page.getByRole("button", { name: "Reset Movements" }).click();
  await expect(config.getByRole("radio", { name: "Whole camera", exact: true })).not.toBeChecked();
  await expect(config.getByRole("radio", { name: "Direct shift", exact: true })).not.toBeChecked();
  await expect(config.getByRole("radio", { name: "Indirect shift", exact: true })).not.toBeChecked();
  await expect(config.getByRole("radio", { name: "Upward", exact: true })).not.toBeChecked();
  await expect(config.getByRole("radio", { name: "Downward", exact: true })).not.toBeChecked();

  const frontRise = page.getByRole("slider", { name: "Front Rise / Fall" });
  await expect(frontRise).toHaveValue("0");

  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5_000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10_000 });
});


test("configuration presets: direct shift downward then reset", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");

  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  const config = page.locator('[data-testid="camera-configuration-control"]');
  await expect(rtt).toBeVisible({ timeout: 15_000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15_000 });
  await expect(config).toBeVisible({ timeout: 5_000 });

  const baselineSanity = await rtt.getAttribute("data-rtt-sanity-state");

  // Select Direct Shift Downward preset
  await config.getByRole("radio", { name: "Direct shift", exact: true }).check();
  await config.getByRole("radio", { name: "Downward", exact: true }).check();
  await expect(config.getByRole("radio", { name: "Direct shift", exact: true })).toBeChecked();
  await expect(config.getByRole("radio", { name: "Downward", exact: true })).toBeChecked();

  const frontRise = page.getByRole("slider", { name: "Front Rise / Fall" });
  await expect(frontRise).toBeVisible({ timeout: 3_000 });

  // Assert slider range and step attributes
  await expect(frontRise).toHaveAttribute("min", "-40");
  await expect(frontRise).toHaveAttribute("max", "40");
  await expect(frontRise).toHaveAttribute("step", "1");

  // Assert the exact calibrated negative value
  await expect(frontRise).toHaveValue("-15");

  // Value lies on the 1 mm step grid (exact integer)
  const sliderValue = Number(await frontRise.inputValue());
  expect(sliderValue).toBe(-15);
  expect(sliderValue % 1).toBe(0);

  // RTT sanity state changed after applying the preset
  await expect.poll(async () => {
    const state = await rtt.getAttribute("data-rtt-sanity-state");
    return Boolean(state && state !== baselineSanity && state.length > 0);
  }, { timeout: 15_000, intervals: [500, 1000, 2000] }).toBe(true);
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5_000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10_000 });

  // Reset → value back to 0 and all preset radio selections cleared
  await page.getByRole("button", { name: "Reset Movements" }).click();
  await expect(config.getByRole("radio", { name: "Direct shift", exact: true })).not.toBeChecked();
  await expect(config.getByRole("radio", { name: "Downward", exact: true })).not.toBeChecked();
  await expect(config.getByRole("radio", { name: "Whole camera", exact: true })).not.toBeChecked();
  await expect(config.getByRole("radio", { name: "Indirect shift", exact: true })).not.toBeChecked();
  await expect(config.getByRole("radio", { name: "Upward", exact: true })).not.toBeChecked();
  await expect(frontRise).toHaveValue("0");
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5_000 });
});
