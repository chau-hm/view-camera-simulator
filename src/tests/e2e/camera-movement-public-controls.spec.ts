import { test, expect, type Page } from "@playwright/test";

const disableOpticalGeometry = async (page: Page) => {
  const scene = page.locator('[data-testid="scene-canvas"]');
  if ((await scene.getAttribute("data-optical-geometry-visible")) !== "true") return;
  const trigger = page.getByRole("button", { name: "View overlays" });
  if (await trigger.isVisible()) await trigger.click();
  await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
};

const expectGroundGlassValid = async (page: Page) => {
  const rtt = page.locator('[data-testid="ground-glass-rtt"]');
  await expect(rtt).toBeVisible({ timeout: 15000 });
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 10000 });
  await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });
};

test("public camera movement controls on the normal route", async ({ page }) => {
  test.setTimeout(150_000);
  const pageErrors: string[] = [];
  const unexpectedGraphicsMessages: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (!(message.type() === "warning" || message.type() === "error") || !/(WebGL|THREE|GPU)/i.test(text)) return;
    if (/GPU stall due to ReadPixels/i.test(text)) return;
    unexpectedGraphicsMessages.push(`${message.type()}: ${text}`);
  });

  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  const scene = page.locator('[data-testid="scene-canvas"]');
  await expect(scene).toHaveAttribute("data-mounted-lattice", "true", { timeout: 15000 });
  await disableOpticalGeometry(page);
  await expectGroundGlassValid(page);

  // 1. Neutral is selected and no workbench is visible.
  await expect(page.getByRole("radio", { name: "Neutral" })).toBeChecked();
  await expect(page.getByText("Camera Movement Calibration")).toHaveCount(0);
  await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  await expect(scene).toHaveAttribute("data-lattice-target-region", "middle");

  // 2. Select A: front tilt changes, rear tilt stays zero.
  await page.getByRole("radio", { name: "A — Front tilt" }).click();
  await expect(page.getByRole("radio", { name: "A — Front tilt" })).toBeChecked();
  await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  await expectGroundGlassValid(page);

  // 3. Select B: rear convergence state.
  await page.getByRole("radio", { name: "B — Rear tilt" }).click();
  await expect(page.getByRole("radio", { name: "B — Rear tilt" })).toBeChecked();
  await expectGroundGlassValid(page);

  // 4. Select C3: high anchor, upper target, positive body pitch, zero standard movements.
  await page.getByRole("radio", { name: "C3 — Higher viewpoint" }).click();
  await expect(page.getByRole("radio", { name: "C3 — Higher viewpoint" })).toBeChecked();
  await expect(scene).toHaveAttribute("data-camera-rig-anchor", "high");
  await expect(scene).toHaveAttribute("data-lattice-target-region", "upper");
  await expect(scene).toHaveAttribute("data-camera-body-pitch-deg", "6.000000");
  await expectGroundGlassValid(page);

  // 5. Switch to Camera inspection and confirm the camera stays visible.
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(scene).toHaveAttribute("data-view-focus", "camera", { timeout: 5000 });
  await expectGroundGlassValid(page);
  await page.getByRole("button", { name: "Scene", exact: true }).click();

  // 6. Select D3: low anchor, lower target, negative body pitch.
  await page.getByRole("radio", { name: "D3 — Lower viewpoint" }).click();
  await expect(page.getByRole("radio", { name: "D3 — Lower viewpoint" })).toBeChecked();
  await expect(scene).toHaveAttribute("data-camera-rig-anchor", "low");
  await expect(scene).toHaveAttribute("data-lattice-target-region", "lower");
  await expect(scene).toHaveAttribute("data-camera-body-pitch-deg", "-6.000000");
  await expectGroundGlassValid(page);

  // 7. Select D1 and confirm negative fall applied.
  await page.getByRole("radio", { name: "D1 — Front fall" }).click();
  await expect(page.getByRole("radio", { name: "D1 — Front fall" })).toBeChecked();
  await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  await expectGroundGlassValid(page);

  // 8. Reset Movements returns to Neutral.
  await page.getByRole("button", { name: "Reset Movements" }).click();
  await expect(page.getByRole("radio", { name: "Neutral" })).toBeChecked();
  await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  await expect(scene).toHaveAttribute("data-lattice-target-region", "middle");

  // 9. Orbit/zoom then Reset View restores the observer preset and preserves the case.
  await page.getByRole("radio", { name: "C1 — Front rise" }).click();
  await expect(page.getByRole("radio", { name: "C1 — Front rise" })).toBeChecked();
  const sceneCanvas = scene.locator("canvas");
  const bounds = await sceneCanvas.boundingBox();
  if (bounds) {
    const x = bounds.x + bounds.width * 0.58;
    const y = bounds.y + bounds.height * 0.52;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 72, y - 36, { steps: 6 });
    await page.mouse.up();
  }
  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await expect(page.getByRole("radio", { name: "C1 — Front rise" })).toBeChecked();
  await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  await expectGroundGlassValid(page);

  // 10. Navigate away and return; Neutral is restored.
  await page.getByRole("link", { name: "All Scenes" }).click();
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Understanding Camera Movements" }) })
    .getByRole("link", { name: "Open Scene" })
    .click();
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("rttDiagnostics", "1");
    window.history.replaceState(window.history.state, "", url);
  });
  await expect(page.getByRole("radio", { name: "Neutral" })).toBeChecked({ timeout: 15000 });
  await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  await expectGroundGlassValid(page);

  expect(pageErrors).toEqual([]);
  expect(unexpectedGraphicsMessages).toEqual([]);
});

test("calibration route preserves workbench and hides public controls", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/understanding-camera-movements?cameraCalibration=1&rttDiagnostics=1");
  await expect(page.getByText("Camera Movement Calibration")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("radio", { name: "A — Front tilt" })).toHaveCount(0);

  // Make one valid calibration edit (change focal length from 90 to 120.5)
  const focalLength = page.getByLabel("Focal length (mm)");
  await focalLength.fill("120.5");
  await focalLength.press("Enter");
  await expect(page.getByLabel("Focal length (mm)")).toHaveValue("120.5");

  // Public teaching controls remain absent after a workbench edit.
  await expect(page.getByRole("radio", { name: "A — Front tilt" })).toHaveCount(0);
});
