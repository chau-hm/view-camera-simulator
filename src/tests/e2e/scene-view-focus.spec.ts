import { expect, test, type Locator, type Page } from "@playwright/test";

type ViewState = {
  position: number[];
  target: number[];
};

const parseVector = (value: string | null): number[] => {
  const parsed = value?.split(",").map(Number) ?? [];
  if (parsed.length !== 3 || parsed.some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error(`Invalid observer vector: ${value}`);
  }
  return parsed;
};

const readViewState = async (sceneCanvas: Locator): Promise<ViewState> => ({
  position: parseVector(await sceneCanvas.getAttribute("data-observer-camera-position")),
  target: parseVector(await sceneCanvas.getAttribute("data-orbit-target")),
});

const readStableViewState = async (sceneCanvas: Locator): Promise<ViewState> => {
  let previous = "";
  await expect.poll(async () => {
    const current = JSON.stringify(await readViewState(sceneCanvas));
    const stable = current === previous;
    previous = current;
    return stable;
  }).toBe(true);
  return readViewState(sceneCanvas);
};

const viewDistance = (state: ViewState) =>
  Math.hypot(...state.position.map((coordinate, index) => coordinate - state.target[index]));

const orbitScene = async (page: Page, sceneCanvas: Locator) => {
  const canvas = sceneCanvas.locator("canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("3D Scene canvas bounds unavailable");
  const x = bounds.x + bounds.width * 0.58;
  const y = bounds.y + bounds.height * 0.52;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 72, y - 36, { steps: 6 });
  await page.mouse.up();
};

const openOverlayMenuIfNeeded = async (page: Page) => {
  const trigger = page.getByRole("button", { name: "View overlays" });
  if (await trigger.isVisible()) await trigger.click();
};

test("View Focus preserves independent Scene and Camera views and resets the active preset", async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (
      (message.type() === "error" || message.type() === "warning") &&
      !/GL Driver Message .*GPU stall due to ReadPixels/.test(message.text())
    ) {
      consoleProblems.push(message.text());
    }
  });

  await page.goto("/simulator/free/architecture-rise");
  const sceneCanvas = page.getByTestId("scene-canvas");
  await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  await expect(sceneCanvas).toHaveAttribute("data-view-focus", "scene");
  await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "true");
  const scenePreset = await readViewState(sceneCanvas);

  await orbitScene(page, sceneCanvas);
  await expect.poll(async () => (await readViewState(sceneCanvas)).position).not.toEqual(scenePreset.position);
  const savedSceneView = await readViewState(sceneCanvas);

  const cameraButton = page.getByRole("button", { name: "Camera" });
  await cameraButton.focus();
  await page.keyboard.press("Enter");
  await expect(cameraButton).toHaveAttribute("aria-pressed", "true");
  await expect(sceneCanvas).toHaveAttribute("data-view-focus", "camera");
  const cameraPreset = await readViewState(sceneCanvas);
  expect(cameraPreset.target).not.toEqual(scenePreset.target);
  expect(viewDistance(cameraPreset)).toBeCloseTo(0.72, 4);

  await orbitScene(page, sceneCanvas);
  await expect.poll(async () => (await readViewState(sceneCanvas)).position).not.toEqual(cameraPreset.position);
  const orbitedCameraView = await readViewState(sceneCanvas);
  await sceneCanvas.locator("canvas").hover();
  await page.mouse.wheel(0, -360);
  await expect.poll(async () => viewDistance(await readViewState(sceneCanvas))).not.toBeCloseTo(
    viewDistance(orbitedCameraView),
    4,
  );

  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await expect.poll(async () => viewDistance(await readViewState(sceneCanvas))).toBeCloseTo(0.72, 4);

  const beforeRise = await readStableViewState(sceneCanvas);
  const beforeRiseGeometry = await page.getByTestId("scene-front-y-mm").textContent();
  await page.getByLabel("Rise").press("ArrowRight");
  await expect(page.getByTestId("scene-front-y-mm")).not.toHaveText(beforeRiseGeometry ?? "");
  await expect.poll(async () => (await readViewState(sceneCanvas)).target).toEqual(beforeRise.target);

  for (const movementControl of ["Focus distance", "Tilt", "Swing"]) {
    await page.getByLabel(movementControl).press("ArrowRight");
    await expect.poll(async () => (await readViewState(sceneCanvas)).target).toEqual(beforeRise.target);
  }
  const afterMovements = await readStableViewState(sceneCanvas);

  const sceneButton = page.getByRole("button", { name: "Scene", exact: true });
  await sceneButton.focus();
  await page.keyboard.press("Space");
  await expect(sceneButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => readViewState(sceneCanvas)).toEqual(savedSceneView);

  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await expect.poll(() => readViewState(sceneCanvas)).toEqual(scenePreset);

  await cameraButton.click();
  await expect.poll(() => readViewState(sceneCanvas)).toEqual(afterMovements);
  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await expect.poll(async () => viewDistance(await readViewState(sceneCanvas))).toBeCloseTo(0.72, 4);
  await expect(sceneCanvas).toHaveAttribute("data-view-focus", "camera");

  // Free mode: Restart Task is absent, Reset Movements is present
  await expect(page.getByRole("button", { name: "Restart Task" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset Movements" })).toBeVisible();

  // Optical Geometry toggle in free mode (not tied to task restart)
  await openOverlayMenuIfNeeded(page);
  await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "false");

  // Reset Movements in free mode does NOT restore Optical Geometry visibility
  await page.getByRole("button", { name: "Reset Movements" }).click();
  // Optical Geometry visibility is user-controlled in free mode, not task-managed

  expect(pageErrors).toEqual([]);
  expect(consoleProblems).toEqual([]);
});

test("guided task restart restores task Optical Geometry preset", async ({ page }) => {
  test.setTimeout(30_000);

  // Navigate to a real guided task (Architecture Rise)
  await page.goto("/simulator/guided/architecture-rise/rise-01");
  const sceneCanvas = page.getByTestId("scene-canvas");
  await expect(sceneCanvas).toBeVisible({ timeout: 10000 });
  await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "true");

  // Restart Task button is visible in guided mode
  await expect(page.getByRole("button", { name: "Restart Task" })).toBeVisible();

  // Hide Optical Geometry
  await openOverlayMenuIfNeeded(page);
  await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "false");

  // Restart Task restores the task preset (Optical Geometry = true)
  await page.getByRole("button", { name: "Restart Task" }).click();
  await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "true");
});

test("SPA scene switching discards the previous Camera target and returns to Scene focus", async ({ page }) => {
  await page.goto("/scenes");
  const openScene = async (heading: string) => {
    const card = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: heading }) });
    await card.getByRole("link", { name: "Open Scene" }).click();
  };

  await openScene("Architecture Rise");
  const architectureCanvas = page.getByTestId("scene-canvas");
  await page.getByRole("button", { name: "Camera" }).click();
  const architectureCameraTarget = (await readStableViewState(architectureCanvas)).target;

  await page.getByRole("link", { name: "All Scenes" }).click();
  await openScene("Table Tilt");
  const tableCanvas = page.getByTestId("scene-canvas");
  await expect(page.getByRole("button", { name: "Scene", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(tableCanvas).toHaveAttribute("data-view-focus", "scene");
  await expect(tableCanvas).toHaveAttribute("data-optical-geometry-visible", "true");
  expect((await readStableViewState(tableCanvas)).target).not.toEqual(architectureCameraTarget);
});
