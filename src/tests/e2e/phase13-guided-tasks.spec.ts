import { expect, test } from "@playwright/test";
import {
  expectLearningFeedbackCompleted,
  expectLearningFeedbackNotCompleted,
  openLearningFeedback,
} from "./helpers/learningOverlay";
import { setStepRangeInput } from "./helpers/stepRangeInput";

test("TST-E2E-002: user can open Architecture Rise from the Scenes page", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("landing-hero-cta").click();
  await expect(page).toHaveURL(/\/scenes$/);

  const architectureCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) });
  await expect(architectureCard).toBeVisible();
  await architectureCard.getByRole("link", { name: "Open Scene" }).click();

  await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  await expect(page.getByRole("heading", { name: "3D Scene" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ground Glass" })).toBeVisible();
  await expect(page.getByLabel("Camera Controls")).toBeVisible();
});

test("TST-E2E-003: rise task starts in failed state", async ({ page }) => {
  await page.goto("/simulator/guided/architecture-rise/rise-01");
  await expectLearningFeedbackNotCompleted(page);
  const feedback = await openLearningFeedback(page);
  await expect(feedback).toContainText("Score:");
  await expect(feedback.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
});

test("TST-E2E-004: rise task can be completed with valid rise", async ({ page }) => {
  await page.goto("/simulator/guided/architecture-rise/rise-01");
  await setStepRangeInput(page, "Rise", 12);
  await expectLearningFeedbackCompleted(page);
  const feedback = await openLearningFeedback(page);
  await expect(feedback.getByRole("heading", { name: "Task completed" })).toBeVisible();
});

test("TST-E2E-005: restart resets Architecture Rise guided task", async ({ page }) => {
  await page.goto("/simulator/guided/architecture-rise/rise-01");
  await setStepRangeInput(page, "Rise", 12);
  await expectLearningFeedbackCompleted(page);
  await openLearningFeedback(page);

  await page.getByRole("button", { name: "Restart task" }).click();

  await expectLearningFeedbackNotCompleted(page);
  const feedback = await openLearningFeedback(page);
  await expect(feedback.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(page.getByLabel("Rise")).toHaveValue("0");
  // Confirm tilt and swing remain at 0
  await expect(page.getByLabel("Tilt")).toHaveValue("0");
  await expect(page.getByLabel("Swing")).toHaveValue("0");
  // Aperture default for tasks
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
});

test("TST-E2E-006: free mode can return to All Scenes and open Focus Fundamentals", async ({ page }) => {
  await page.goto("/simulator/free/architecture-rise");
  await expect(page.getByRole("heading", { name: "3D Scene" })).toBeVisible();

  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect(page).toHaveURL(/\/scenes$/);

  const focusCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Focus Fundamentals — Two Targets" }) });
  await expect(focusCard).toBeVisible();
  await focusCard.getByRole("link", { name: "Open Scene" }).click();

  await expect(page).toHaveURL(/\/simulator\/free\/focus-fundamentals-two-targets$/);
  await expect(page.getByLabel("Focus distance")).toBeVisible();
});

test("TST-E2E-007: shows webgl fallback when WebGL is unavailable", async ({ page }) => {
  // Deterministic interception that preserves non-WebGL contexts
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: unknown[]) {
      if (contextId === "webgl" || contextId === "webgl2" || contextId === "experimental-webgl") {
        return null;
      }
      // @ts-expect-error - forward to original (typing not important in test harness)
      return original.call(this, contextId, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto("/simulator/guided/architecture-rise/rise-01");
  await expect(
    page.getByText(
      "WebGL is unavailable in this browser. Please use a WebGL-capable browser on desktop.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Camera Controls")).toBeVisible();
});
