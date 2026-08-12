import { expect, test, type Page } from "@playwright/test";

const collectGraphicsErrors = (page: Page) => {
  const pageErrors: string[] = [];
  const graphicsErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (!["warning", "error"].includes(message.type())) return;
    const text = message.text();
    if (!/(WebGL|THREE|GPU)/i.test(text) || /GPU stall due to ReadPixels/i.test(text)) return;
    graphicsErrors.push(`${message.type()}: ${text}`);
  });
  return { pageErrors, graphicsErrors };
};

const expectSharedLattice = async (
  page: Page,
  expectedEdgeCount: string,
  expectContentDiagnostics = true,
) => {
  const scene = page.locator('[data-testid="scene-canvas"]');
  const rtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await expect(scene).toHaveAttribute("data-mounted-lattice", "true", { timeout: 15_000 });
  await expect(scene).toHaveAttribute("data-mounted-lattice-edge-count", expectedEdgeCount);
  const geometryId = await scene.getAttribute("data-mounted-lattice-geometry-id");
  expect(geometryId).toBeTruthy();
  await expect(rtt).toHaveAttribute("data-rtt-lattice-geometry-id", geometryId!);
  await expect(rtt).toHaveAttribute("data-rtt-lattice-edge-count", expectedEdgeCount);
  if (expectContentDiagnostics) {
    await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 15_000 });
    await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 15_000 });
  }
  return { scene, rtt, geometryId: geometryId! };
};

test("calibration workbench is hidden on the production route", async ({ page }) => {
  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  await expect(page.getByRole("region", { name: "Camera movement calibration workbench" })).toHaveCount(0);
  const { scene, rtt } = await expectSharedLattice(page, "224");
  await expect(scene).toHaveAttribute("data-camera-rig-origin", "0.000000,0.000000,0.000000");
  await expect(rtt).toHaveAttribute("data-rtt-focal-length-mm", "90");
});

test("session calibration separates geometry, optics, rig, reset, and SPA lifecycle", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectGraphicsErrors(page);
  await page.goto(
    "/simulator/free/understanding-camera-movements?cameraCalibration=1&rttDiagnostics=1",
  );
  const workbench = page.getByRole("region", {
    name: "Camera movement calibration workbench",
  });
  await expect(workbench).toBeVisible();
  await expect(workbench.getByText(/Session revision 0/)).toBeVisible();

  const baseline = await expectSharedLattice(page, "224");
  const baselineGeneration = await baseline.scene.getAttribute(
    "data-mounted-lattice-generation",
  );
  await workbench.getByLabel("Levels").fill("7");
  await workbench.getByLabel("Levels").press("Enter");
  const sevenLevel = await expectSharedLattice(page, "304");
  expect(sevenLevel.geometryId).not.toBe(baseline.geometryId);
  await expect(workbench.getByText(/Session revision 1/)).toBeVisible();

  const geometryGeneration = await sevenLevel.scene.getAttribute(
    "data-mounted-lattice-generation",
  );
  expect(geometryGeneration).not.toBe(baselineGeneration);

  await workbench.getByLabel("Focal length (mm)").fill("120");
  await workbench.getByLabel("Focal length (mm)").press("Enter");
  await expect(sevenLevel.rtt).toHaveAttribute("data-rtt-focal-length-mm", "120");
  await expect(sevenLevel.scene).toHaveAttribute(
    "data-mounted-lattice-geometry-id",
    sevenLevel.geometryId,
  );
  await expect(sevenLevel.scene).toHaveAttribute(
    "data-mounted-lattice-generation",
    geometryGeneration!,
  );

  await workbench.getByLabel("Viewpoint anchor").selectOption("high");
  await expect(sevenLevel.scene).toHaveAttribute("data-camera-rig-anchor", "high");
  await expect(workbench.getByLabel("Front rise (mm)")).toBeDisabled();
  await expect(workbench.getByLabel("Rear tilt (°)")).toBeDisabled();
  await expect(workbench.getByLabel("Camera body pitch (°)")).toBeEnabled();
  await workbench.getByLabel("Camera body pitch (°)").fill("-8");
  await workbench.getByLabel("Camera body pitch (°)").press("Enter");
  await expect(sevenLevel.scene).toHaveAttribute("data-camera-body-pitch-deg", "-8.000000");
  await expect(sevenLevel.scene).toHaveAttribute(
    "data-mounted-lattice-generation",
    geometryGeneration!,
  );
  await expect(sevenLevel.rtt).toHaveAttribute("data-rtt-final-contentful", "true");

  await workbench.getByRole("button", { name: "Reset calibration" }).click();
  const reset = await expectSharedLattice(page, "224");
  await expect(reset.scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  await expect(reset.scene).toHaveAttribute("data-camera-body-pitch-deg", "0.000000");
  await expect(reset.scene).toHaveAttribute("data-mounted-lattice-presentation-region", "middle");
  await expect(reset.rtt).toHaveAttribute("data-rtt-focal-length-mm", "90");
  await expect(workbench.getByLabel("Focus distance (mm)")).toHaveValue("2000");

  await workbench.getByLabel("Levels").fill("7");
  await workbench.getByLabel("Levels").press("Enter");
  await expect(workbench.getByText(/Session revision 1/)).toBeVisible();
  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect(workbench).toHaveCount(0);
  await page.goBack();
  await expect(workbench).toBeVisible();
  await expect(workbench.getByText(/Session revision 0/)).toBeVisible();
  await expect(workbench.getByLabel("Levels")).toHaveValue("5");

  await page.getByRole("link", { name: "All Scenes" }).click();
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) })
    .getByRole("link", { name: "Open Scene" })
    .click();
  await expect(workbench).toHaveCount(0);
  await page.getByRole("link", { name: "All Scenes" }).click();
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Understanding Camera Movements" }) })
    .getByRole("link", { name: "Open Scene" })
    .click();
  await expect(page).not.toHaveURL(/cameraCalibration=1/);
  await expect(page.getByRole("region", { name: "Camera movement calibration workbench" })).toHaveCount(0);
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("rttDiagnostics", "1");
    window.history.replaceState(window.history.state, "", url);
  });
  await expectSharedLattice(page, "224");
  expect(errors.pageErrors).toEqual([]);
  expect(errors.graphicsErrors).toEqual([]);
});
