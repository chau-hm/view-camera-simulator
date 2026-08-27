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

const readViewState = async (scene: Locator): Promise<ViewState> => ({
  position: parseVector(await scene.getAttribute("data-observer-camera-position")),
  target: parseVector(await scene.getAttribute("data-orbit-target")),
});

const readStableViewState = async (scene: Locator): Promise<ViewState> => {
  let previous = "";
  await expect.poll(async () => {
    const current = JSON.stringify(await readViewState(scene));
    const stable = current === previous;
    previous = current;
    return stable;
  }).toBe(true);
  return readViewState(scene);
};

const viewDistance = (view: ViewState) =>
  Math.hypot(...view.position.map((coordinate, index) => coordinate - view.target[index]));

const expectSameObserverOffset = (reference: ViewState, actual: ViewState) => {
  for (let index = 0; index < 3; index += 1) {
    expect(actual.position[index] - actual.target[index]).toBeCloseTo(
      reference.position[index] - reference.target[index],
      5,
    );
  }
};

const orbitScene = async (page: Page, scene: Locator) => {
  const canvas = scene.locator("canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("3D Scene canvas bounds unavailable");
  const x = bounds.x + bounds.width * 0.58;
  const y = bounds.y + bounds.height * 0.52;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 72, y - 36, { steps: 6 });
  await page.mouse.up();
};

test("Mirror Shift moves the canonical rig while keeping its RTT mounted", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/simulator/free/mirror-shift?rttDiagnostics=1");

  const scene = page.locator('[data-testid="scene-canvas"]');
  const rtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  const position = page.getByRole("slider", { name: "Camera Position" });
  const frontShift = page.getByRole("slider", { name: "Front Shift" });

  await expect(position).toHaveValue("0");
  await expect(frontShift).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveCount(0);
  await expect(scene).toHaveAttribute(
    "data-camera-rig-origin",
    "0.000000,0.000000,0.000000",
  );
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 30_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });

  const sceneElement = await scene.elementHandle();
  const rttElement = await rtt.elementHandle();
  const resourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  expect(resourceGeneration).toBeTruthy();

  await position.fill("1800");
  await expect(position).toHaveValue("1800");
  await expect(scene).toHaveAttribute(
    "data-camera-rig-origin",
    "1800.000000,0.000000,0.000000",
  );
  await expect(scene).toHaveAttribute("data-camera-lens-center-world", "1800.000000,0.000000,0.000000");
  const movedFilmCenter = await scene.getAttribute("data-camera-film-center-world");
  expect(movedFilmCenter?.split(",")[0]).toBe("1800.000000");
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 30_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
  await expect.poll(() => page.evaluate((node) => node?.isConnected, sceneElement)).toBe(true);
  await expect.poll(() => page.evaluate((node) => node?.isConnected, rttElement)).toBe(true);

  await frontShift.fill("-50");
  await expect(frontShift).toHaveValue("-50");
  await expect(scene).toHaveAttribute(
    "data-camera-rig-origin",
    "1800.000000,0.000000,0.000000",
  );
  await expect(scene).toHaveAttribute("data-camera-lens-center-world", "1750.000000,0.000000,0.000000");
  const movedFilmCenterAfterShift = await scene.getAttribute("data-camera-film-center-world");
  expect(movedFilmCenterAfterShift?.split(",")[0]).toBe("1800.000000");
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 30_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
  await expect.poll(() => page.evaluate((node) => node?.isConnected, sceneElement)).toBe(true);
  await expect.poll(() => page.evaluate((node) => node?.isConnected, rttElement)).toBe(true);

  await page.getByRole("button", { name: "Reset movements" }).click();
  await expect(position).toHaveValue("0");
  await expect(frontShift).toHaveValue("0");
  await expect(scene).toHaveAttribute(
    "data-camera-rig-origin",
    "0.000000,0.000000,0.000000",
  );
});

test("Mirror Shift Camera focus follows the rig while Scene focus stays fixed", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/mirror-shift");

  const scene = page.locator('[data-testid="scene-canvas"]');
  const position = page.getByRole("slider", { name: "Camera Position" });
  const cameraButton = page.getByRole("button", { name: "Camera", exact: true });
  const sceneButton = page.getByRole("button", { name: "Scene", exact: true });

  await expect(scene.locator("canvas")).toHaveCount(1);
  await cameraButton.click();
  await expect(scene).toHaveAttribute("data-view-focus", "camera");
  const neutralCameraPreset = await readStableViewState(scene);
  // Mirror Shift uses the shared stable body-midpoint anchor at -60 mm for
  // its 120 mm camera, rather than the former subject-space target.
  expect(neutralCameraPreset.target).toEqual([0, 0, -0.06]);
  expect(viewDistance(neutralCameraPreset)).toBeCloseTo(0.72, 4);
  await orbitScene(page, scene);
  await expect.poll(async () => (await readViewState(scene)).position).not.toEqual(
    neutralCameraPreset.position,
  );
  const neutralCameraView = await readStableViewState(scene);

  await position.fill("1800");
  await expect(position).toHaveValue("1800");
  await expect(scene).toHaveAttribute(
    "data-camera-rig-origin",
    "1800.000000,0.000000,0.000000",
  );
  const movedCameraView = await readStableViewState(scene);

  expect(movedCameraView.target[0] - neutralCameraView.target[0]).toBeCloseTo(1.8, 5);
  expect(movedCameraView.position[0] - neutralCameraView.position[0]).toBeCloseTo(1.8, 5);
  for (const index of [1, 2]) {
    expect(movedCameraView.target[index] - neutralCameraView.target[index]).toBeCloseTo(0, 5);
    expect(movedCameraView.position[index] - neutralCameraView.position[index]).toBeCloseTo(0, 5);
  }
  expectSameObserverOffset(neutralCameraView, movedCameraView);
  expect(viewDistance(movedCameraView)).toBeCloseTo(viewDistance(neutralCameraView), 5);

  await sceneButton.click();
  await expect(scene).toHaveAttribute("data-view-focus", "scene");
  const sceneViewAtMovedRig = await readStableViewState(scene);

  await position.fill("-1800");
  await expect(position).toHaveValue("-1800");
  const sceneViewAtOppositeRig = await readStableViewState(scene);
  expect(sceneViewAtOppositeRig.target).toEqual(sceneViewAtMovedRig.target);
  expect(sceneViewAtOppositeRig.position).toEqual(sceneViewAtMovedRig.position);

  await page.getByRole("button", { name: "Reset movements" }).click();
  await expect(position).toHaveValue("0");
  await cameraButton.click();
  const resetCameraView = await readStableViewState(scene);
  expect(resetCameraView.target).toEqual(neutralCameraView.target);
  expectSameObserverOffset(neutralCameraView, resetCameraView);
});
