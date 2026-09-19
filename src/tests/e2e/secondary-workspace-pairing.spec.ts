import { expect, test, type Locator } from "@playwright/test";

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const requireBounds = async (locator: Locator, label: string): Promise<Bounds> => {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error(`${label} bounds unavailable`);
  return bounds;
};

const right = (bounds: Bounds) => bounds.x + bounds.width;
const bottom = (bounds: Bounds) => bounds.y + bounds.height;

const expectColumnAligned = (first: Bounds, second: Bounds): void => {
  expect(Math.abs(first.x - second.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(2);
};

test("normal desktop pairs Geometry with Scene and Focus Distribution with Ground Glass", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/guided/table-tilt/tilt-01");

  const scene = page.locator('[data-workspace-slot="scene"]');
  const groundGlass = page.locator('[data-workspace-slot="ground-glass"]');
  const geometry = page.locator('[data-workspace-slot="geometry"]');
  const focusDistribution = page.locator('[data-workspace-slot="focus-distribution"]');

  await expect(page.getByTestId("scene-canvas")).toBeVisible();
  await expect(page.getByTestId("ground-glass-rtt")).toBeVisible();
  await expect(scene).toBeVisible();
  await expect(groundGlass).toBeVisible();
  await expect(geometry).toBeVisible();
  await expect(focusDistribution).toBeVisible();
  await expect(page.getByTestId("learning-overlay-panel")).toHaveCount(1);

  const [sceneBounds, groundGlassBounds, geometryBounds, focusBounds] = await Promise.all([
    requireBounds(scene, "Scene workspace slot"),
    requireBounds(groundGlass, "Ground Glass workspace slot"),
    requireBounds(geometry, "Geometry workspace slot"),
    requireBounds(focusDistribution, "Focus Distribution workspace slot"),
  ]);

  expectColumnAligned(sceneBounds, geometryBounds);
  expectColumnAligned(groundGlassBounds, focusBounds);
  expect(geometryBounds.y).toBeGreaterThanOrEqual(bottom(sceneBounds) - 1);
  expect(focusBounds.y).toBeGreaterThanOrEqual(bottom(groundGlassBounds) - 1);
  expect(Math.abs(sceneBounds.width - groundGlassBounds.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(groundGlassBounds.x - right(sceneBounds) - 16)).toBeLessThanOrEqual(2);

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(2);
  expect(
    await page.getByTestId("learning-overlay-panel").evaluate((element) =>
      Boolean(element.closest('[data-workspace-slot="scene"]')),
    ),
  ).toBe(true);
});

test("a scene without Focus Distribution keeps Geometry in the left secondary slot", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/understanding-camera-movements");

  const scene = page.locator('[data-workspace-slot="scene"]');
  const geometry = page.locator('[data-workspace-slot="geometry"]');
  await expect(scene).toBeVisible();
  await expect(geometry).toBeVisible();
  await expect(page.locator('[data-workspace-slot="focus-distribution"]')).toHaveCount(0);

  const [sceneBounds, geometryBounds] = await Promise.all([
    requireBounds(scene, "Scene workspace slot"),
    requireBounds(geometry, "Geometry workspace slot"),
  ]);
  expectColumnAligned(sceneBounds, geometryBounds);
  expect(geometryBounds.y).toBeGreaterThanOrEqual(bottom(sceneBounds) - 1);
});

test("Geometry owns expansion and restores focus to its normal-workspace trigger", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/simulator/free/architecture-rise");

  const trigger = page.getByRole("button", { name: "Expand 2D Geometry" });
  await expect(trigger).toBeVisible();
  await expect(trigger.locator(".material-symbols-outlined")).toHaveText("open_in_new");

  const secondaryGeometryDetails = page.locator(
    ".geometry-viewport:not(.geometry-viewport--expanded) .geometry-viewport__secondary",
  );
  await expect(secondaryGeometryDetails.first()).toBeHidden();

  await trigger.click();

  const restore = page.getByRole("button", { name: "Restore 2D Geometry" });
  await expect(restore).toBeFocused();
  await expect(page.getByRole("heading", { name: "3D Scene" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ground Glass" })).toHaveCount(0);
  await expect(page.getByTestId("focus-distribution-panel")).toHaveCount(0);
  await expect(page.locator('[data-workspace-slot="geometry"]')).toHaveCount(1);
  await expect(page.locator("section.geometry-viewport")).toBeVisible();
  await expect(page.locator(".geometry-viewport--expanded .geometry-viewport__secondary").first()).toBeVisible();
  await expect(restore.locator(".material-symbols-outlined")).toHaveText("close_fullscreen");

  await restore.click();
  await expect(page.getByRole("heading", { name: "3D Scene" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ground Glass" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand 2D Geometry" })).toBeFocused();
  await expect(page.getByTestId("focus-distribution-panel")).toBeVisible();
  await expect(secondaryGeometryDetails.first()).toBeHidden();
});

test("narrow normal workspace flows Scene, Ground Glass, Geometry, and Focus Distribution in one column", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto("/simulator/guided/table-tilt/tilt-01");

  const scene = page.locator('[data-workspace-slot="scene"]');
  const groundGlass = page.locator('[data-workspace-slot="ground-glass"]');
  const geometry = page.locator('[data-workspace-slot="geometry"]');
  const focusDistribution = page.locator('[data-workspace-slot="focus-distribution"]');
  await expect(scene).toBeVisible();
  await expect(groundGlass).toBeVisible();
  await expect(geometry).toBeVisible();
  await expect(focusDistribution).toBeVisible();
  await expect(page.getByTestId("learning-overlay-panel")).toHaveAttribute("data-drawer-state", "flow");

  const [sceneBounds, groundGlassBounds, geometryBounds, focusBounds] = await Promise.all([
    requireBounds(scene, "Narrow Scene workspace slot"),
    requireBounds(groundGlass, "Narrow Ground Glass workspace slot"),
    requireBounds(geometry, "Narrow Geometry workspace slot"),
    requireBounds(focusDistribution, "Narrow Focus Distribution workspace slot"),
  ]);
  expectColumnAligned(sceneBounds, groundGlassBounds);
  expectColumnAligned(sceneBounds, geometryBounds);
  expectColumnAligned(sceneBounds, focusBounds);
  expect(groundGlassBounds.y).toBeGreaterThanOrEqual(bottom(sceneBounds) - 1);
  expect(geometryBounds.y).toBeGreaterThanOrEqual(bottom(groundGlassBounds) - 1);
  expect(focusBounds.y).toBeGreaterThanOrEqual(bottom(geometryBounds) - 1);

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(2);
});
