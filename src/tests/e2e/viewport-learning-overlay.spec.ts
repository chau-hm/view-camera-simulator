import { expect, test, type Page } from "@playwright/test";
import {
  expectLearningFeedbackCompleted,
  expectLearningFeedbackNotCompleted,
  getLearningFeedbackButton,
  getLearningOverlay,
  openLearningFeedback,
} from "./helpers/learningOverlay";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const overlay = (page: Page) => getLearningOverlay(page);

test("guided learning stays available over the viewport and preserves the camera loop", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/guided/oblique-architecture/oblique-rise-01?lesson=1");

  const learning = overlay(page);
  await expect(page.getByRole("heading", { name: "3D Scene", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ground Glass", exact: true })).toBeVisible();
  await expect(learning).toBeVisible();
  await expect(learning.getByRole("button", { name: "Task", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectLearningFeedbackNotCompleted(page);
  await expect(page.getByRole("region", { name: "Guided lesson progress" })).toBeVisible();
  await expect(page.locator(".simulator-task-feedback-grid")).toHaveCount(0);

  const content = learning.locator(".learning-overlay-panel__content");
  const scrollTarget = learning.locator(".guided-lesson-progress__stages li").first();
  await expect(scrollTarget).toBeVisible();
  const contentMetrics = await content.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(contentMetrics.scrollHeight).toBeGreaterThan(contentMetrics.clientHeight);
  const scrollTargetBox = await scrollTarget.boundingBox();
  if (!scrollTargetBox) throw new Error("Expected the Task stage list to have a visible bounding box");
  await page.mouse.move(scrollTargetBox.x + scrollTargetBox.width / 2, scrollTargetBox.y + scrollTargetBox.height / 2);
  const initialScrollTop = await content.evaluate((element) => element.scrollTop);
  await page.mouse.wheel(0, 180);
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(initialScrollTop);

  await expect(await openLearningFeedback(page)).toContainText("In progress");

  const rise = page.getByLabel("Rise", { exact: true });
  await expect(rise).toBeEnabled();
  await setStepRangeInput(page, "Rise", 20);
  await expect(rise).toHaveValue("20");
  await expect(learning).toBeVisible();

  await learning.getByRole("button", { name: "Task", exact: true }).click();
  await expect(learning.getByTestId("learning-overlay-task-view")).toContainText("Frame the Building");

  await learning.getByRole("button", { name: "Collapse Task and Feedback" }).click();
  await expect(learning.getByRole("button", { name: "Show Task and Feedback" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await learning.getByRole("button", { name: "Show Task and Feedback" }).click();
  await expect(learning.getByTestId("learning-overlay-task-view")).toBeVisible();

  await page.getByRole("button", { name: "Expand Ground Glass" }).click();
  await expect(page.getByRole("button", { name: "Restore Ground Glass" })).toBeVisible();
  await expect(learning).toBeVisible();
  await expect(getLearningFeedbackButton(page)).toBeVisible();
});

test("guided completion remains discoverable while the overlay is collapsed", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/guided/architecture-rise/rise-01");

  const learning = overlay(page);
  await expect(learning.getByRole("button", { name: "Task", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await learning.getByRole("button", { name: "Collapse Task and Feedback" }).click();

  const expand = learning.getByRole("button", { name: "Show Task and Feedback" });
  await expect(expand).toHaveAttribute("aria-expanded", "false");

  await setStepRangeInput(page, "Rise", 12);
  await expect(expand).toHaveAccessibleName("Show Task and Feedback — Task completed");
  await expect(learning.locator(".learning-overlay-panel__completion-cue")).toBeVisible();

  await expand.click();
  await expect(learning.getByRole("button", { name: "Task", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectLearningFeedbackCompleted(page);
  const feedback = await openLearningFeedback(page);
  await expect(feedback.getByRole("heading", { name: "Task completed" })).toBeVisible();
});

test("Free Practice keeps the compact learning views usable at a narrow width", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/shelf-swing");

  await page.setViewportSize({ width: 700, height: 800 });
  const learning = overlay(page);
  await expect(learning).toBeVisible();
  await expect(learning.getByRole("button", { name: "Task", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(learning.getByTestId("learning-overlay-task-view")).toContainText("Free practice");

  await expect(await openLearningFeedback(page)).toContainText("Live observation");
  await learning.getByRole("button", { name: "Task", exact: true }).click();
  await expect(learning.getByTestId("learning-overlay-task-view")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
