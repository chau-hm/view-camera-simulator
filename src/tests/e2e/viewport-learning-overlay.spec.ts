import { expect, test, type Page } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const overlay = (page: Page) => page.getByTestId("learning-overlay-panel");

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
  await expect(page.getByRole("region", { name: "Guided lesson progress" })).toBeVisible();
  await expect(page.locator(".simulator-task-feedback-grid")).toHaveCount(0);

  await learning.getByRole("button", { name: "Feedback", exact: true }).click();
  await expect(learning.getByTestId("learning-overlay-feedback-view")).toContainText("In progress");

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
  await expect(learning.getByRole("button", { name: "Feedback", exact: true })).toBeVisible();
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

  await learning.getByRole("button", { name: "Feedback", exact: true }).click();
  await expect(learning.getByTestId("learning-overlay-feedback-view")).toContainText("Live observation");
  await learning.getByRole("button", { name: "Task", exact: true }).click();
  await expect(learning.getByTestId("learning-overlay-task-view")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
