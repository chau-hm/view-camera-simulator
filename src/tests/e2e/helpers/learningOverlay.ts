import { expect, type Locator, type Page } from "@playwright/test";

export const getLearningOverlay = (page: Page): Locator =>
  page.getByTestId("learning-overlay-panel");

export const getLearningRail = (page: Page): Locator =>
  getLearningOverlay(page).locator(".learning-overlay-panel__rail");

export const getLearningDrawer = (page: Page): Locator =>
  getLearningOverlay(page).getByTestId("learning-overlay-drawer");

export const openLearningDrawer = async (page: Page): Promise<Locator> => {
  const drawer = getLearningDrawer(page);
  if (!(await drawer.isVisible())) {
    await getLearningRail(page).click();
  }
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
