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
  await page.getByLabel("Rise").press("ArrowRight");
  await expect.poll(async () => (await readViewState(sceneCanvas)).target[1]).toBeGreaterThan(
    beforeRise.target[1],
  );
  const afterRise = await readStableViewState(sceneCanvas);
  afterRise.position.forEach((coordinate, index) => {
    expect(coordinate - afterRise.target[index]).toBeCloseTo(
      beforeRise.position[index] - beforeRise.target[index],
      4,
    );
  });

  const sceneButton = page.getByRole("button", { name: "Scene" });
  await sceneButton.focus();
  await page.keyboard.press("Space");
  await expect(sceneButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => readViewState(sceneCanvas)).toEqual(savedSceneView);

  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await expect.poll(() => readViewState(sceneCanvas)).toEqual(scenePreset);

  await cameraButton.click();
  await expect.poll(() => readViewState(sceneCanvas)).toEqual(afterRise);
  await page.getByRole("button", { name: "Reset 3D view" }).click();
  await expect.poll(async () => viewDistance(await readViewState(sceneCanvas))).toBeCloseTo(0.72, 4);
  await expect(sceneCanvas).toHaveAttribute("data-view-focus", "camera");

  await openOverlayMenuIfNeeded(page);
  await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "false");
  await page.getByRole("button", { name: "Restart task" }).click();
  await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "true");

  expect(pageErrors).toEqual([]);
  expect(consoleProblems).toEqual([]);
});

test("all public scenes start with Scene focus, Camera framing, and default Optical Geometry", async ({ page }) => {
  test.setTimeout(120_000);
  for (const sceneId of [
    "focus-fundamentals-two-targets",
    "architecture-rise",
    "table-tilt",
    "shelf-swing",
  ]) {
    await page.goto(`/simulator/free/${sceneId}`);
    const sceneCanvas = page.getByTestId("scene-canvas");
    await expect(sceneCanvas).toHaveAttribute("data-view-focus", "scene");
    await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "true");
    await page.getByRole("button", { name: "Camera" }).click();
    await expect(sceneCanvas).toHaveAttribute("data-view-focus", "camera");
    await expect.poll(async () => viewDistance(await readViewState(sceneCanvas))).toBeCloseTo(0.72, 4);

    const cameraPreset = await readViewState(sceneCanvas);
    await orbitScene(page, sceneCanvas);
    await expect.poll(async () => (await readViewState(sceneCanvas)).position).not.toEqual(
      cameraPreset.position,
    );
    const beforeZoomDistance = viewDistance(await readStableViewState(sceneCanvas));
    await sceneCanvas.locator("canvas").hover();
    await page.mouse.wheel(0, -240);
    await expect.poll(async () => viewDistance(await readViewState(sceneCanvas))).not.toBeCloseTo(
      beforeZoomDistance,
      4,
    );

    const movementControl =
      sceneId === "focus-fundamentals-two-targets"
        ? "Focus distance"
        : sceneId === "architecture-rise"
          ? "Rise"
          : sceneId === "table-tilt"
            ? "Tilt"
            : "Swing";
    const beforeMovementTarget = (await readStableViewState(sceneCanvas)).target;
    await page.getByLabel(movementControl).press("Shift+ArrowRight");
    if (sceneId === "focus-fundamentals-two-targets" || sceneId === "architecture-rise") {
      await expect.poll(async () => (await readViewState(sceneCanvas)).target).not.toEqual(
        beforeMovementTarget,
      );
    } else {
      await expect.poll(async () => (await readViewState(sceneCanvas)).target).toEqual(
        beforeMovementTarget,
      );
    }
  }

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/simulator/free/architecture-rise");
    await expect(page.getByRole("group", { name: "View Focus" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
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
  await expect(page.getByRole("button", { name: "Scene" })).toHaveAttribute("aria-pressed", "true");
  await expect(tableCanvas).toHaveAttribute("data-view-focus", "scene");
  await expect(tableCanvas).toHaveAttribute("data-optical-geometry-visible", "true");
  expect((await readStableViewState(tableCanvas)).target).not.toEqual(architectureCameraTarget);
});
