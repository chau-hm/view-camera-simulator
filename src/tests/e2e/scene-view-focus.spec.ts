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

const expectCameraFocusTarget = async (sceneCanvas: Locator): Promise<ViewState> => {
  const view = await readStableViewState(sceneCanvas);
  const pivotMm = parseVector(await sceneCanvas.getAttribute("data-camera-body-pivot-world"));
  pivotMm.forEach((value, index) => {
    expect(view.target[index], `camera focus target component ${index}`).toBeCloseTo(value * 0.001, 5);
  });
  return view;
};

const expectTranslatedByTargetDelta = (before: ViewState, after: ViewState) => {
  for (let index = 0; index < 3; index += 1) {
    const targetDelta = after.target[index] - before.target[index];
    const positionDelta = after.position[index] - before.position[index];
    expect(positionDelta, `observer translation component ${index}`).toBeCloseTo(targetDelta, 5);
  }
};

const expectSameObserverOffset = (reference: ViewState, actual: ViewState) => {
  for (let index = 0; index < 3; index += 1) {
    const referenceOffset = reference.position[index] - reference.target[index];
    const actualOffset = actual.position[index] - actual.target[index];
    expect(actualOffset, `observer offset component ${index}`).toBeCloseTo(referenceOffset, 5);
  }
};

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
  const beforeRiseGeometry = await page.getByTestId("optical-debug-front-y-mm").textContent();
  await page.getByLabel("Rise").press("ArrowRight");
  await expect(page.getByTestId("optical-debug-front-y-mm")).not.toHaveText(beforeRiseGeometry ?? "");
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

test("Understanding Camera Movements Camera focus follows continuous viewpoint changes", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/understanding-camera-movements");

  const sceneCanvas = page.getByTestId("scene-canvas");
  await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  await expect(sceneCanvas).toHaveAttribute("data-mounted-lattice", "true", { timeout: 15_000 });
  const geometryId = await sceneCanvas.getAttribute("data-mounted-lattice-geometry-id");
  const generation = await sceneCanvas.getAttribute("data-mounted-lattice-generation");
  expect(geometryId).toBeTruthy();
  expect(generation).toBeTruthy();

  const cameraButton = page.getByRole("button", { name: "Camera", exact: true });
  const sceneButton = page.getByRole("button", { name: "Scene", exact: true });
  const viewpoint = page.getByRole("slider", { name: "Viewpoint" });
  const framing = page.getByRole("slider", { name: "Vertical framing" });
  const framingStandards = page.getByRole("group", { name: "Vertical framing standard" });
  await cameraButton.click();
  await expect(sceneCanvas).toHaveAttribute("data-view-focus", "camera");

  const neutralView = await expectCameraFocusTarget(sceneCanvas);
  const inspectionDistance = viewDistance(neutralView);
  const currentRtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await expect(currentRtt).toHaveCount(1);
  const rttHandle = await currentRtt.elementHandle();
  const rttResourceGeneration = await currentRtt.getAttribute("data-rtt-resource-generation");
  const rttSubjectGeneration = await currentRtt.getAttribute("data-rtt-lattice-subject-generation");
  const rttGeometryId = await currentRtt.getAttribute("data-rtt-lattice-geometry-id");
  if (!rttHandle || !rttResourceGeneration || !rttSubjectGeneration || !rttGeometryId) {
    throw new Error("Current Ground Glass identities unavailable");
  }

  const expectRendererIdentitiesStable = async () => {
    await expect(sceneCanvas).toHaveAttribute("data-mounted-lattice-geometry-id", geometryId!);
    await expect(sceneCanvas).toHaveAttribute("data-mounted-lattice-generation", generation!);
    await expect(currentRtt).toHaveCount(1);
    await expect(currentRtt).toHaveAttribute("data-rtt-resource-generation", rttResourceGeneration);
    await expect(currentRtt).toHaveAttribute("data-rtt-lattice-subject-generation", rttSubjectGeneration);
    await expect(currentRtt).toHaveAttribute("data-rtt-lattice-geometry-id", rttGeometryId);
    expect(
      await page.evaluate(
        (node) => node === document.querySelector('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]'),
        rttHandle,
      ),
    ).toBe(true);
  };

  // Standard vertical framing changes the image movement while the complete
  // camera remains at the neutral inspection pivot.
  await framing.fill("0.5");
  await expect(framing).toHaveValue("0.5");
  const frontFramingView = await expectCameraFocusTarget(sceneCanvas);
  expect(frontFramingView.target).toEqual(neutralView.target);
  expectTranslatedByTargetDelta(neutralView, frontFramingView);
  expectSameObserverOffset(neutralView, frontFramingView);
  expect(viewDistance(frontFramingView)).toBeCloseTo(inspectionDistance, 5);
  await expectRendererIdentitiesStable();

  await framingStandards.getByRole("radio", { name: "Rear standard" }).click();
  const rearFramingView = await expectCameraFocusTarget(sceneCanvas);
  expect(rearFramingView.target).toEqual(neutralView.target);
  expectTranslatedByTargetDelta(frontFramingView, rearFramingView);
  expectSameObserverOffset(frontFramingView, rearFramingView);
  expect(viewDistance(rearFramingView)).toBeCloseTo(inspectionDistance, 5);
  await expectRendererIdentitiesStable();

  await viewpoint.fill("0.5");
  await expect(viewpoint).toHaveValue("0.5");
  const intermediateView = await expectCameraFocusTarget(sceneCanvas);
  expect(intermediateView.target).not.toEqual(neutralView.target);
  expectTranslatedByTargetDelta(neutralView, intermediateView);
  expectSameObserverOffset(neutralView, intermediateView);
  expect(viewDistance(intermediateView)).toBeCloseTo(inspectionDistance, 5);
  await expectRendererIdentitiesStable();

  await viewpoint.fill("1");
  await expect(viewpoint).toHaveValue("1");
  await expect(sceneCanvas).toHaveAttribute("data-camera-rig-anchor", "high");
  const c3View = await expectCameraFocusTarget(sceneCanvas);
  expect(c3View.target).not.toEqual(neutralView.target);
  expect(c3View.target).not.toEqual(intermediateView.target);
  expect(intermediateView.target).not.toEqual(c3View.target);
  expectTranslatedByTargetDelta(neutralView, c3View);
  expectTranslatedByTargetDelta(intermediateView, c3View);
  expectSameObserverOffset(intermediateView, c3View);
  expect(viewDistance(c3View)).toBeCloseTo(inspectionDistance, 5);
  await expectRendererIdentitiesStable();

  await viewpoint.fill("-1");
  await expect(viewpoint).toHaveValue("-1");
  await expect(sceneCanvas).toHaveAttribute("data-camera-rig-anchor", "low");
  const d3View = await expectCameraFocusTarget(sceneCanvas);
  expect(d3View.target).not.toEqual(c3View.target);
  expect(d3View.target).not.toEqual(neutralView.target);
  expectTranslatedByTargetDelta(c3View, d3View);
  expectSameObserverOffset(neutralView, d3View);
  expect(viewDistance(d3View)).toBeCloseTo(inspectionDistance, 5);

  await page.getByRole("button", { name: "Reset 3D view" }).click();
  const d3ResetView = await expectCameraFocusTarget(sceneCanvas);
  expect(viewDistance(d3ResetView)).toBeCloseTo(inspectionDistance, 5);

  await viewpoint.fill("1");
  await page.getByRole("button", { name: "Reset 3D view" }).click();
  const c3ResetView = await expectCameraFocusTarget(sceneCanvas);
  expect(viewDistance(c3ResetView)).toBeCloseTo(inspectionDistance, 5);

  await orbitScene(page, sceneCanvas);
  await expect.poll(async () => (await readViewState(sceneCanvas)).position).not.toEqual(
    c3ResetView.position,
  );
  const c3OrbitedView = await expectCameraFocusTarget(sceneCanvas);
  expect(c3OrbitedView.target).toEqual(c3ResetView.target);
  const orbitedInspectionDistance = viewDistance(c3OrbitedView);

  await viewpoint.fill("-1");
  const d3AfterOrbitView = await expectCameraFocusTarget(sceneCanvas);
  expectTranslatedByTargetDelta(c3OrbitedView, d3AfterOrbitView);
  expectSameObserverOffset(c3OrbitedView, d3AfterOrbitView);
  expect(viewDistance(d3AfterOrbitView)).toBeCloseTo(orbitedInspectionDistance, 5);

  await viewpoint.fill("0");
  await expect(viewpoint).toHaveValue("0");
  await page.getByRole("button", { name: "Reset 3D view" }).click();
  const neutralResetView = await expectCameraFocusTarget(sceneCanvas);
  expect(neutralResetView.target).toEqual(neutralView.target);
  expect(viewDistance(neutralResetView)).toBeCloseTo(inspectionDistance, 5);

  await sceneButton.click();
  await expect(sceneCanvas).toHaveAttribute("data-view-focus", "scene");
  const sceneView = await readStableViewState(sceneCanvas);
  await viewpoint.fill("1");
  const c3SceneView = await readStableViewState(sceneCanvas);
  expect(c3SceneView.target).toEqual(sceneView.target);
  await viewpoint.fill("-1");
  const d3SceneView = await readStableViewState(sceneCanvas);
  expect(d3SceneView.target).toEqual(sceneView.target);

  await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  await expect(sceneCanvas).toHaveAttribute("data-mounted-lattice-geometry-id", geometryId!);
  await expect(sceneCanvas).toHaveAttribute("data-mounted-lattice-generation", generation!);
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
