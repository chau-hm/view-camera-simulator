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

const right = (bounds: Bounds) => bounds.x + bounds.width;
const bottom = (bounds: Bounds) => bounds.y + bounds.height;

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
  await expect(drawer).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");

  const stageBounds = await requireBounds(stage, "Scene stage");
  const drawerBounds = await requireBounds(drawer, "Learning drawer");
  expect(drawerBounds.x).toBeGreaterThanOrEqual(stageBounds.x - 1);
  expect(drawerBounds.y).toBeGreaterThanOrEqual(stageBounds.y - 1);
  expect(drawerBounds.x + drawerBounds.width).toBeLessThanOrEqual(stageBounds.x + stageBounds.width + 1);
  expect(drawerBounds.y + drawerBounds.height).toBeLessThanOrEqual(stageBounds.y + stageBounds.height + 1);

  const pinButton = page.getByRole("button", { name: "Keep Task and Feedback open", exact: true });
  const closeButton = page.getByRole("button", { name: "Close Task and Feedback", exact: true });
  await expect(pinButton).toHaveAttribute("title", "Keep Task and Feedback open");
  await expect(pinButton.locator(".material-symbols-outlined")).toHaveText("push_pin");
  await expect(pinButton.locator("span:not(.material-symbols-outlined)")).toHaveCount(0);
  await expect(closeButton).toHaveAttribute("title", "Close Task and Feedback");
  await expect(closeButton.locator(".material-symbols-outlined")).toHaveText("close");
  await expect(closeButton.locator("span:not(.material-symbols-outlined)")).toHaveCount(0);

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

test("keyboard focus remains visible on the rail while the drawer opens transiently", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/guided/table-tilt/tilt-01");

  const learning = getLearningOverlay(page);
  const rail = getLearningRail(page);
  const drawer = getLearningDrawer(page);
  const stage = page.locator(".scene-viewport-stage");

  await expect(learning).toHaveAttribute("data-drawer-state", "peek");
  await expect(drawer).not.toBeVisible();

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  for (let tabCount = 0; tabCount < 80; tabCount += 1) {
    if (await rail.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(learning).toHaveAttribute("data-drawer-state", "transient");
  await expect(rail).toBeFocused();
  await expect(rail).toHaveCSS("opacity", "1");
  await expect(drawer).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  const railBounds = await requireBounds(rail, "Focused learning rail");
  expect(railBounds.width).toBeGreaterThan(0);
  expect(railBounds.height).toBeGreaterThan(0);
  const focusedRailIsTopmost = await page.evaluate(({ x, y }) => {
    const railElement = document.querySelector<HTMLElement>(".learning-overlay-panel__rail");
    const topmostElement = document.elementFromPoint(x, y);
    return Boolean(railElement && topmostElement && (topmostElement === railElement || railElement.contains(topmostElement)));
  }, {
    x: railBounds.x + railBounds.width / 2,
    y: railBounds.y + railBounds.height / 2,
  });
  expect(focusedRailIsTopmost).toBe(true);

  const stageBounds = await requireBounds(stage, "Scene stage");
  const drawerBounds = await requireBounds(drawer, "Learning drawer");
  const outsidePoint = {
    x: stageBounds.x + stageBounds.width - 12,
    y: stageBounds.y + stageBounds.height / 2,
  };
  expect(outsidePoint.x).toBeGreaterThan(drawerBounds.x + drawerBounds.width);
  await page.mouse.move(outsidePoint.x, outsidePoint.y);
  await page.waitForTimeout(500);
  await expect(learning).toHaveAttribute("data-drawer-state", "transient");
  await expect(drawer).toBeVisible();
  await expect(rail).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(drawer.getByRole("button", { name: "Task", exact: true })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(learning).toHaveAttribute("data-drawer-state", "peek");
  await expect(drawer).not.toBeVisible();
  await expect(rail).toBeFocused();
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
  const rail = getLearningRail(page);
  const drawer = getLearningDrawer(page);
  await expect(learning).toHaveAttribute("data-drawer-state", "flow");
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveCSS("position", "static");
  await expect(rail).toHaveCSS("display", "none");
  expect(await rail.boundingBox()).toBeNull();
  await expect(drawer.getByRole("button", { name: "Keep Task and Feedback open" })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Close Task and Feedback" })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Task", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(drawer.getByTestId("learning-overlay-task-view")).toContainText("Free practice");

  const taskButton = drawer.getByRole("button", { name: "Task", exact: true });
  const feedbackButton = drawer.getByRole("button", { name: "Feedback", exact: true });
  await taskButton.focus();
  await expect(taskButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(feedbackButton).toBeFocused();

  const feedback = await openLearningFeedback(page);
  await expect(feedback).toContainText("Live observation");
  await expect(learning).toHaveAttribute("data-drawer-state", "flow");
  await expect(rail).toHaveCSS("display", "none");
  expect(await rail.boundingBox()).toBeNull();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("desktop learning rail and Scene overlay controls keep separate visual anchors", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/simulator/free/architecture-rise");
  await page.getByRole("combobox", { name: "Language" }).selectOption("zh-HK");

  const rail = getLearningRail(page);
  const railLabel = rail.locator(".learning-overlay-panel__rail-label");
  const trigger = page.getByRole("button", { name: "檢視疊加層", exact: true });
  const stage = page.locator(".scene-viewport-stage");
  await expect(rail).toBeVisible();
  await expect(rail).toHaveAccessibleName("開啟任務及回饋");
  await expect(railLabel).toHaveText("任務及回饋");
  await expect(railLabel).toHaveCSS("writing-mode", "vertical-rl");
  await expect(railLabel).toHaveCSS("text-orientation", "mixed");
  await expect(railLabel).toHaveCSS("transform", "none");
  await expect(trigger).toBeVisible();

  const railBounds = await requireBounds(rail, "Learning rail");
  const triggerBounds = await requireBounds(trigger, "View overlays trigger");
  expect(railBounds.width).toBeGreaterThan(36);
  expect(railBounds.height).toBeGreaterThan(112);
  await expect(railLabel).toHaveCSS("font-size", "12px");
  await expect(railLabel).toHaveCSS("font-weight", "800");
  const railSurface = await rail.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderColor: style.borderTopColor,
      backgroundImage: style.backgroundImage,
      boxShadow: style.boxShadow,
    };
  });
  expect(railSurface.borderColor).toContain("143, 234, 255");
  expect(railSurface.backgroundImage).toContain("linear-gradient");
  expect(railSurface.boxShadow).toContain("53, 200, 237");
  expect(triggerBounds.x).toBeGreaterThan(railBounds.x + railBounds.width);

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const menu = page.locator(".scene-overlay-menu__panel");
  await expect(menu).toBeVisible();
  const menuBounds = await requireBounds(menu, "View overlays menu");
  const menuContentMetrics = await menu.locator(".scene-overlay-controls").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(menuContentMetrics.scrollWidth).toBeLessThanOrEqual(menuContentMetrics.clientWidth + 1);
  expect(Math.abs(menuBounds.x - triggerBounds.x)).toBeLessThanOrEqual(1);
  expect(menuBounds.y).toBeGreaterThanOrEqual(triggerBounds.y + triggerBounds.height);
  expect(menuBounds.y).toBeLessThan(triggerBounds.y + triggerBounds.height + 16);

  const triggerIsTopmost = await page.evaluate(({ x, y }) => {
    const triggerElement = document.querySelector<HTMLButtonElement>(".scene-overlay-menu__trigger");
    const topmostElement = document.elementFromPoint(x, y);
    return Boolean(
      triggerElement &&
        topmostElement &&
        (topmostElement === triggerElement || triggerElement.contains(topmostElement)),
    );
  }, {
    x: triggerBounds.x + triggerBounds.width / 2,
    y: triggerBounds.y + triggerBounds.height / 2,
  });
  expect(triggerIsTopmost).toBe(true);
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  const stageBounds = await requireBounds(stage, "Scene stage");
  expect(triggerBounds.x + triggerBounds.width).toBeLessThanOrEqual(stageBounds.x + stageBounds.width);
});

test("constrained desktop Scenes move overlay controls below the host without menu clipping", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 920, height: 900 });
  await page.goto("/simulator/free/architecture-rise");

  const stage = page.locator(".scene-viewport-stage");
  const host = page.locator(".scene-viewport-host");
  const controlsWrap = page.locator(".scene-overlay-controls-wrap");
  const rail = getLearningRail(page);
  const trigger = page.getByRole("button", { name: "View overlays", exact: true });
  const expand = host.locator(".btn--viewport-action");
  await expect(rail).toBeVisible();
  await expect(trigger).toBeVisible();
  await expect(expand).toBeVisible();
  await expect(controlsWrap).toHaveCSS("position", "static");

  const [railBounds, triggerBounds, expandBounds, hostBounds] = await Promise.all([
    requireBounds(rail, "Learning rail"),
    requireBounds(trigger, "View overlays trigger"),
    requireBounds(expand, "Scene expand button"),
    requireBounds(host, "Scene host"),
  ]);
  expect(triggerBounds.y).toBeGreaterThanOrEqual(bottom(hostBounds));
  expect(triggerBounds.x).toBeGreaterThanOrEqual(hostBounds.x);
  expect(right(triggerBounds)).toBeLessThanOrEqual(right(hostBounds));

  const rectanglesIntersect = (first: Bounds, second: Bounds) =>
    !(
      right(first) <= second.x ||
      right(second) <= first.x ||
      bottom(first) <= second.y ||
      bottom(second) <= first.y
    );
  expect(rectanglesIntersect(railBounds, triggerBounds)).toBe(false);
  expect(rectanglesIntersect(triggerBounds, expandBounds)).toBe(false);

  const triggerIsTopmost = await page.evaluate(({ x, y }) => {
    const triggerElement = document.querySelector<HTMLButtonElement>(".scene-overlay-menu__trigger");
    const topmostElement = document.elementFromPoint(x, y);
    return Boolean(
      triggerElement &&
        topmostElement &&
        (topmostElement === triggerElement || triggerElement.contains(topmostElement)),
    );
  }, {
    x: triggerBounds.x + triggerBounds.width / 2,
    y: triggerBounds.y + triggerBounds.height / 2,
  });
  expect(triggerIsTopmost).toBe(true);

  await trigger.click();
  const menu = page.locator(".scene-overlay-menu__panel");
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS("position", "static");
  const [menuBounds, openStageBounds] = await Promise.all([
    requireBounds(menu, "Constrained View overlays menu"),
    requireBounds(stage, "Expanded Scene stage"),
  ]);
  expect(menuBounds.x).toBeGreaterThanOrEqual(openStageBounds.x - 1);
  expect(right(menuBounds)).toBeLessThanOrEqual(right(openStageBounds) + 1);
  expect(menuBounds.y).toBeGreaterThanOrEqual(bottom(triggerBounds));
  expect(menuBounds.y).toBeLessThan(bottom(triggerBounds) + 16);
  expect(rectanglesIntersect(menuBounds, expandBounds)).toBe(false);

  const menuContentMetrics = await menu.locator(".scene-overlay-controls").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(menuContentMetrics.scrollWidth).toBeLessThanOrEqual(menuContentMetrics.clientWidth + 1);
  const menuTriggerIsTopmost = await page.evaluate(({ x, y }) => {
    const triggerElement = document.querySelector<HTMLButtonElement>(".scene-overlay-menu__trigger");
    const topmostElement = document.elementFromPoint(x, y);
    return Boolean(
      triggerElement &&
        topmostElement &&
        (topmostElement === triggerElement || triggerElement.contains(topmostElement)),
    );
  }, {
    x: triggerBounds.x + triggerBounds.width / 2,
    y: triggerBounds.y + triggerBounds.height / 2,
  });
  expect(menuTriggerIsTopmost).toBe(true);
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("Ground Glass expansion keeps one bounded learning rail and drawer", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/guided/architecture-rise/rise-01");

  const learning = getLearningOverlay(page);
  const rail = getLearningRail(page);
  const drawer = getLearningDrawer(page);
  const sceneHeading = page.getByRole("heading", { name: "3D Scene", exact: true });
  const frame = page.getByLabel("GroundGlassViewport");
  const expand = page.getByRole("button", { name: "Expand Ground Glass" });

  await expect(sceneHeading).toBeVisible();
  await expect(rail).toBeVisible();
  await expect(page.getByTestId("learning-overlay-panel")).toHaveCount(1);
  await expand.click();

  const restore = page.getByRole("button", { name: "Restore Ground Glass" });
  await expect(restore).toBeFocused();
  await expect(sceneHeading).toHaveCount(0);
  await expect(frame).toBeVisible();
  await expect(learning).toHaveAttribute("data-drawer-state", "peek");
  await expect(rail).toBeVisible();
  await expect(page.getByTestId("learning-overlay-panel")).toHaveCount(1);

  const [frameBounds, railBounds, restoreBounds] = await Promise.all([
    requireBounds(frame, "Expanded Ground Glass frame"),
    requireBounds(rail, "Expanded Ground Glass learning rail"),
    requireBounds(restore, "Ground Glass restore button"),
  ]);
  expect(railBounds.x).toBeGreaterThanOrEqual(frameBounds.x - 1);
  expect(railBounds.y).toBeGreaterThanOrEqual(frameBounds.y - 1);
  expect(right(railBounds)).toBeLessThanOrEqual(right(frameBounds) + 1);
  expect(bottom(railBounds)).toBeLessThanOrEqual(bottom(frameBounds) + 1);
  const rectanglesIntersect = (first: Bounds, second: Bounds) =>
    !(right(first) <= second.x || right(second) <= first.x || bottom(first) <= second.y || bottom(second) <= first.y);
  expect(rectanglesIntersect(railBounds, restoreBounds)).toBe(false);
  const restoreIsTopmost = await page.evaluate(({ x, y }) => {
    const restoreElement = document.querySelector<HTMLButtonElement>('[aria-label="Restore Ground Glass"]');
    const topmostElement = document.elementFromPoint(x, y);
    return Boolean(
      restoreElement &&
        topmostElement &&
        (topmostElement === restoreElement || restoreElement.contains(topmostElement)),
    );
  }, {
    x: restoreBounds.x + restoreBounds.width / 2,
    y: restoreBounds.y + restoreBounds.height / 2,
  });
  expect(restoreIsTopmost).toBe(true);

  await rail.click();
  await expect(learning).toHaveAttribute("data-drawer-state", "transient");
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(drawer.getByTestId("learning-overlay-task-view")).toBeVisible();
  await expect(sceneHeading).toHaveCount(0);
  await expect(restore).toBeVisible();

  const [drawerBounds, frameAfterOpenBounds, restoreAfterOpenBounds] = await Promise.all([
    requireBounds(drawer, "Expanded Ground Glass learning drawer"),
    requireBounds(frame, "Expanded Ground Glass frame after opening drawer"),
    requireBounds(restore, "Ground Glass restore button after opening drawer"),
  ]);
  expect(drawerBounds.x).toBeGreaterThanOrEqual(frameAfterOpenBounds.x - 1);
  expect(drawerBounds.y).toBeGreaterThanOrEqual(frameAfterOpenBounds.y - 1);
  expect(right(drawerBounds)).toBeLessThanOrEqual(right(frameAfterOpenBounds) + 1);
  expect(bottom(drawerBounds)).toBeLessThanOrEqual(bottom(frameAfterOpenBounds) + 1);
  expect(frameAfterOpenBounds.x).toBeCloseTo(frameBounds.x, 5);
  expect(frameAfterOpenBounds.y).toBeCloseTo(frameBounds.y, 5);
  expect(frameAfterOpenBounds.width).toBeCloseTo(frameBounds.width, 5);
  expect(frameAfterOpenBounds.height).toBeCloseTo(frameBounds.height, 5);
  expect(rectanglesIntersect(drawerBounds, restoreAfterOpenBounds)).toBe(false);

  await page.getByRole("button", { name: "Close Task and Feedback" }).click();
  await expect(learning).toHaveAttribute("data-drawer-state", "peek");
  await restore.click();
  await expect(sceneHeading).toBeVisible();
  await expect(page.getByTestId("learning-overlay-panel")).toHaveCount(1);
  await expect(getLearningRail(page)).toBeVisible();
  const restoredLearning = page.getByTestId("learning-overlay-panel");
  expect(await restoredLearning.evaluate((element) => Boolean(element.closest(".scene-viewport-stage")))).toBe(true);
});

test("narrow Ground Glass expansion keeps the learning flow outside the clipped frame", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto("/simulator/guided/architecture-rise/rise-01");

  const learning = getLearningOverlay(page);
  const rail = getLearningRail(page);
  const drawer = getLearningDrawer(page);
  const sceneHeading = page.getByRole("heading", { name: "3D Scene", exact: true });
  const groundGlassCard = page.getByLabel("GroundGlassColumn");
  const frame = page.getByLabel("GroundGlassViewport");
  const expand = page.getByRole("button", { name: "Expand Ground Glass" });

  await expect(learning).toHaveAttribute("data-drawer-state", "flow");
  await expect(expand).toBeVisible();
  await expand.click();

  const restore = page.getByRole("button", { name: "Restore Ground Glass" });
  const renderer = page.getByTestId("ground-glass-rtt");
  await expect(sceneHeading).toHaveCount(0);
  await expect(learning).toHaveAttribute("data-drawer-state", "flow");
  await expect(page.getByTestId("learning-overlay-panel")).toHaveCount(1);
  await expect(frame).toBeVisible();
  await expect(renderer).toBeVisible();
  await expect(restore).toBeVisible();
  await expect(rail).toHaveCSS("display", "none");
  expect(await rail.boundingBox()).toBeNull();

  const placement = await learning.evaluate((element) => ({
    insideFrame: Boolean(element.closest(".groundglass-viewport-frame")),
    insideGroundGlassCard: Boolean(element.closest('[aria-label="GroundGlassColumn"]')),
  }));
  expect(placement.insideFrame).toBe(false);
  expect(placement.insideGroundGlassCard).toBe(true);

  const [groundGlassBounds, frameBounds, rendererBounds, learningBounds, restoreBounds] = await Promise.all([
    requireBounds(groundGlassCard, "Expanded Ground Glass card"),
    requireBounds(frame, "Narrow expanded Ground Glass frame"),
    requireBounds(renderer, "Narrow expanded Ground Glass renderer"),
    requireBounds(learning, "Narrow expanded learning surface"),
    requireBounds(restore, "Narrow Ground Glass restore button"),
  ]);
  expect(frameBounds.height).toBeGreaterThan(100);
  expect(rendererBounds.width).toBeGreaterThan(0);
  expect(rendererBounds.height).toBeGreaterThan(0);
  expect(learningBounds.height).toBeGreaterThan(0);
  expect(learningBounds.y).toBeGreaterThanOrEqual(bottom(frameBounds) - 1);
  expect(groundGlassBounds.x).toBeLessThanOrEqual(learningBounds.x + 1);
  expect(right(learningBounds)).toBeLessThanOrEqual(right(groundGlassBounds) + 1);

  const rectanglesIntersect = (first: Bounds, second: Bounds) =>
    !(right(first) <= second.x || right(second) <= first.x || bottom(first) <= second.y || bottom(second) <= first.y);
  expect(rectanglesIntersect(learningBounds, restoreBounds)).toBe(false);

  await learning.scrollIntoViewIfNeeded();
  await expect(drawer).toBeVisible();
  const panelVisibility = await learning.evaluate((element) => {
    const panelBounds = element.getBoundingClientRect();
    const card = element.closest('[aria-label="GroundGlassColumn"]');
    const cardBounds = card?.getBoundingClientRect();
    const x = panelBounds.left + Math.min(panelBounds.width / 2, 20);
    const y = Math.min(panelBounds.bottom - 2, cardBounds?.bottom ?? window.innerHeight - 2, window.innerHeight - 2);
    const topmost = document.elementFromPoint(x, y);
    return {
      bottomWithinCard: cardBounds ? panelBounds.bottom <= cardBounds.bottom + 1 : false,
      lowerPointHitTestable: Boolean(topmost && (topmost === element || element.contains(topmost))),
    };
  });
  expect(panelVisibility.bottomWithinCard).toBe(true);
  expect(panelVisibility.lowerPointHitTestable).toBe(true);

  const taskButton = drawer.getByRole("button", { name: "Task", exact: true });
  const feedbackButton = drawer.getByRole("button", { name: "Feedback", exact: true });
  await taskButton.focus();
  await page.keyboard.press("Tab");
  await expect(feedbackButton).toBeFocused();
  await feedbackButton.click();
  await expect(drawer.getByTestId("learning-overlay-feedback-view")).toBeVisible();
  await expect(learning).toHaveAttribute("data-drawer-state", "flow");

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);

  await restore.click();
  await expect(sceneHeading).toBeVisible();
  await expect(page.getByTestId("learning-overlay-panel")).toHaveCount(1);
  const restoredLearning = page.getByTestId("learning-overlay-panel");
  await expect(restoredLearning).toHaveAttribute("data-drawer-state", "flow");
  expect(await restoredLearning.evaluate((element) => Boolean(element.closest(".scene-viewport-stage")))).toBe(true);
});
