import { expect, test, type Locator } from "@playwright/test";
import {
  expectLearningFeedbackCompleted,
  getLearningDrawer,
  getLearningOverlay,
  getLearningRail,
  openLearningDrawer,
  openLearningFeedback,
} from "./helpers/learningOverlay";
import { setStepRangeInput } from "./helpers/stepRangeInput";

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

test("Scene-local learning drawer keeps Focus Distribution full-width and leaves the Scene layout intact", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/guided/table-tilt/tilt-01");

  const learning = getLearningOverlay(page);
  const rail = getLearningRail(page);
  const drawer = getLearningDrawer(page);
  const sceneCard = page
    .locator(".simulator-card")
    .filter({ has: page.getByRole("heading", { name: "3D Scene", exact: true }) });
  const stage = page.locator(".scene-viewport-stage");
  const groundGlass = page.getByLabel("GroundGlassColumn");
  const focusDistribution = page.getByTestId("focus-distribution-panel");

  await expect(page.getByRole("heading", { name: "3D Scene", exact: true })).toBeVisible();
  await expect(focusDistribution).toBeVisible();
  await expect(page.getByTestId("current-settings-readout")).toHaveCount(0);
  await expect(page.getByText("Current Settings", { exact: true })).toHaveCount(0);
  await expect(page.locator(".simulator-primary-info-grid")).toHaveCount(0);
  await expect(rail).toBeVisible();
  await expect(drawer).not.toBeVisible();

  const sceneBefore = await requireBounds(sceneCard, "Scene card");
  const groundGlassBefore = await requireBounds(groundGlass, "Ground Glass card");
  await rail.click();
  await expect(drawer).toBeVisible();

  const stageBounds = await requireBounds(stage, "Scene stage");
  const drawerBounds = await requireBounds(drawer, "Learning drawer");
  expect(drawerBounds.x).toBeGreaterThanOrEqual(stageBounds.x - 1);
  expect(drawerBounds.y).toBeGreaterThanOrEqual(stageBounds.y - 1);
  expect(drawerBounds.x + drawerBounds.width).toBeLessThanOrEqual(stageBounds.x + stageBounds.width + 1);
  expect(drawerBounds.y + drawerBounds.height).toBeLessThanOrEqual(stageBounds.y + stageBounds.height + 1);

  const sceneAfter = await requireBounds(sceneCard, "Scene card after opening drawer");
  const groundGlassAfter = await requireBounds(groundGlass, "Ground Glass card after opening drawer");
  expect(sceneAfter.x).toBeCloseTo(sceneBefore.x, 5);
  expect(sceneAfter.y).toBeCloseTo(sceneBefore.y, 5);
  expect(sceneAfter.width).toBeCloseTo(sceneBefore.width, 5);
  expect(sceneAfter.height).toBeCloseTo(sceneBefore.height, 5);
  expect(groundGlassAfter.x).toBeCloseTo(groundGlassBefore.x, 5);
  expect(groundGlassAfter.y).toBeCloseTo(groundGlassBefore.y, 5);
  expect(groundGlassAfter.width).toBeCloseTo(groundGlassBefore.width, 5);
  expect(groundGlassAfter.height).toBeCloseTo(groundGlassBefore.height, 5);

  const outsidePoint = {
    x: Math.min(stageBounds.x + stageBounds.width - 2, drawerBounds.x + drawerBounds.width + 8),
    y: stageBounds.y + stageBounds.height * 0.55,
  };
  await page.mouse.move(outsidePoint.x, outsidePoint.y);
  await expect(learning).toHaveAttribute("data-drawer-state", "peek", { timeout: 2_000 });
  await expect(drawer).not.toBeVisible({ timeout: 2_000 });

  await rail.click();
  await expect(drawer).toBeVisible();
  await page.waitForTimeout(220);
  const reopenedDrawerBounds = await requireBounds(drawer, "Reopened learning drawer");
  await page.mouse.move(reopenedDrawerBounds.x + reopenedDrawerBounds.width / 2, reopenedDrawerBounds.y + 24);
  await page.getByRole("button", { name: "Keep Task and Feedback open" }).click();
  await page.mouse.move(groundGlassAfter.x + groundGlassAfter.width / 2, groundGlassAfter.y + 24);
  await expect(drawer).toBeVisible();

  await page.getByRole("button", { name: "Allow Task and Feedback to auto-hide" }).click();
  await page.getByRole("button", { name: "Close Task and Feedback" }).click();
  await expect(drawer).not.toBeVisible({ timeout: 2_000 });
  await expect(rail).toHaveAttribute("aria-expanded", "false");
  await expect(learning).toHaveAttribute("data-drawer-state", "peek");
});

test("learning drawer supports keyboard focus and internal scrolling without changing Task/Feedback content", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/guided/oblique-architecture/oblique-rise-01?lesson=1");

  const drawer = getLearningDrawer(page);
  const rail = getLearningRail(page);
  await openLearningDrawer(page);
  await page.waitForTimeout(220);

  const content = drawer.locator(".learning-overlay-panel__content");
  const contentMetrics = await content.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(contentMetrics.scrollHeight).toBeGreaterThan(contentMetrics.clientHeight);
  const initialScrollTop = await content.evaluate((element) => element.scrollTop);
  await content.hover();
  await page.mouse.wheel(0, 800);
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(initialScrollTop);

  const feedback = drawer.getByRole("button", { name: "Feedback", exact: true });
  await feedback.focus();
  await page.keyboard.press("Enter");
  await expect(drawer.getByTestId("learning-overlay-feedback-view")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible({ timeout: 2_000 });
  await expect(rail).toBeFocused();

  await rail.click();
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Task", exact: true }).focus();
  await expect(drawer).toBeVisible();
});

test("guided completion updates the peek rail without auto-opening or leaving Task", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/guided/architecture-rise/rise-01");

  const learning = getLearningOverlay(page);
  const rail = getLearningRail(page);
  const drawer = getLearningDrawer(page);
  await expect(drawer).not.toBeVisible();
  await setStepRangeInput(page, "Rise", 12);

  await expect(rail).toHaveAccessibleName("Task and Feedback — Task completed");
  await expect(rail.locator(".learning-overlay-panel__completion-cue")).toBeVisible();
  await expect(drawer).not.toBeVisible();
  await expect(learning).toHaveAttribute("data-drawer-state", "peek");

  await rail.click();
  await expect(drawer.getByRole("button", { name: "Task", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expectLearningFeedbackCompleted(page);
});

test("narrow layouts keep the learning surface in flow without horizontal overflow", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto("/simulator/free/shelf-swing");

  const learning = getLearningOverlay(page);
  const drawer = getLearningDrawer(page);
  await expect(learning).toHaveAttribute("data-drawer-state", "flow");
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveCSS("position", "static");
  await expect(drawer.getByRole("button", { name: "Task", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(drawer.getByTestId("learning-overlay-task-view")).toContainText("Free practice");

  const feedback = await openLearningFeedback(page);
  await expect(feedback).toContainText("Live observation");
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
