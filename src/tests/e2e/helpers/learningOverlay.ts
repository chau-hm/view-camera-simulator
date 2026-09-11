import { expect, type Locator, type Page } from "@playwright/test";

export const getLearningOverlay = (page: Page): Locator =>
  page.getByTestId("learning-overlay-panel");

export const getLearningFeedbackButton = (page: Page): Locator =>
  getLearningOverlay(page).getByRole("button", {
    name: /^Feedback(?: — Task completed)?$/,
  });

export const openLearningFeedback = async (page: Page): Promise<Locator> => {
  const panel = getLearningOverlay(page);
  await getLearningFeedbackButton(page).click();
  return panel.getByTestId("learning-overlay-feedback-view");
};

export const expectLearningFeedbackCompleted = async (page: Page): Promise<void> => {
  const button = getLearningFeedbackButton(page);
  await expect(button).toHaveAttribute("data-status", "completed");
  await expect(button).toHaveAccessibleName("Feedback — Task completed");
};

export const expectLearningFeedbackNotCompleted = async (page: Page): Promise<void> => {
  const button = getLearningFeedbackButton(page);
  await expect(button).toHaveAttribute("data-status", "in-progress");
  await expect(button).toHaveAccessibleName("Feedback");
};
