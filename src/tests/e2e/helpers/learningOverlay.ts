import { expect, type Locator, type Page } from "@playwright/test";

export const getLearningOverlay = (page: Page): Locator =>
  page.getByTestId("learning-overlay-panel");

export const getLearningRail = (page: Page): Locator =>
  getLearningOverlay(page).locator(".learning-overlay-panel__rail");

export const getLearningDrawer = (page: Page): Locator =>
  getLearningOverlay(page).getByTestId("learning-overlay-drawer");

export const openLearningDrawer = async (page: Page): Promise<Locator> => {
  const overlay = getLearningOverlay(page);
  const drawer = getLearningDrawer(page);
  if (!(await drawer.isVisible())) {
    await getLearningRail(page).hover();
  }
  await expect(drawer).toBeVisible();
  if (await overlay.getAttribute("data-drawer-state") === "transient") {
    await expect(drawer).toHaveCSS("transform", /^matrix\(1, 0, 0, 1, 0, 0\)$/);
  }
  return drawer;
};

export const openPinnedLearningDrawer = async (page: Page): Promise<Locator> => {
  const overlay = getLearningOverlay(page);
  const drawer = getLearningDrawer(page);
  const currentState = await overlay.getAttribute("data-drawer-state");
  if (currentState === "flow") {
    await expect(drawer).toBeVisible();
    return drawer;
  }
  if (currentState !== "pinned") {
    await getLearningRail(page).focus();
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS("transform", /^matrix\(1, 0, 0, 1, 0, 0\)$/);
    await page.getByRole("button", { name: "Keep Task and Feedback open" }).click();
  }
  await expect(overlay).toHaveAttribute("data-drawer-state", "pinned");
  await expect(drawer).toBeVisible();
  return drawer;
};

export const getLearningFeedbackButton = (page: Page): Locator =>
  getLearningDrawer(page).getByRole("button", {
    name: /^Feedback(?: — Task completed)?$/,
  });

export const openLearningFeedback = async (page: Page): Promise<Locator> => {
  const drawer = await openLearningDrawer(page);
  await getLearningFeedbackButton(page).click();
  return drawer.getByTestId("learning-overlay-feedback-view");
};

export const expectLearningFeedbackCompleted = async (page: Page): Promise<void> => {
  await openLearningDrawer(page);
  const button = getLearningFeedbackButton(page);
  await expect(button).toHaveAttribute("data-status", "completed");
  await expect(button).toHaveAccessibleName("Feedback — Task completed");
};

export const expectLearningFeedbackNotCompleted = async (page: Page): Promise<void> => {
  await openLearningDrawer(page);
  const button = getLearningFeedbackButton(page);
  await expect(button).toHaveAttribute("data-status", "in-progress");
  await expect(button).toHaveAccessibleName("Feedback");
};
