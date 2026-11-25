# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: architecture-foreground-dof.spec.ts >> Architecture + Foreground DOF task starts solved through PR7C and completes with Aperture only
- Location: src/tests/e2e/architecture-foreground-dof.spec.ts:43:1

# Error details

```
Error: expect(locator).toHaveCSS(expected) failed

Locator: getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer')
Expected pattern: /^matrix\(1, 0, 0, 1, 0, 0\)$/
Received string:  "matrix(1, 0, 0, 1, -224.648, 0)"
Timeout: 5000ms

Call log:
  - Expect "toHaveCSS" with timeout 5000ms
  - waiting for getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer')
    - locator resolved to <div id="_r_6_-drawer" aria-hidden="false" data-testid="learning-overlay-drawer" class="learning-overlay-panel__drawer">…</div>
    - unexpected value "matrix(1, 0, 0, 1, -278.361, 0)"
    - locator resolved to <div id="_r_6_-drawer" aria-hidden="false" data-testid="learning-overlay-drawer" class="learning-overlay-panel__drawer">…</div>
    - unexpected value "matrix(1, 0, 0, 1, -224.648, 0)"

```

```yaml
- group "Task and Feedback views":
  - button "Task" [pressed]
  - button "Feedback"
- button "Keep Task and Feedback open"
- button "Close Task and Feedback"
- region "Task":
  - text: Guided task
  - heading "Extend the Depth of Field" [level=3]
  - paragraph: Stop down the Aperture until the foreground and building are acceptably sharp while keeping the existing composition and focus-plane alignment.
  - strong: "Allowed controls:"
  - text: Aperture2D Geometry
  - group: View requirements
```

# Test source

```ts
  1  | import { expect, type Locator, type Page } from "@playwright/test";
  2  | 
  3  | export const getLearningOverlay = (page: Page): Locator =>
  4  |   page.getByTestId("learning-overlay-panel");
  5  | 
  6  | export const getLearningRail = (page: Page): Locator =>
  7  |   getLearningOverlay(page).locator(".learning-overlay-panel__rail");
  8  | 
  9  | export const getLearningDrawer = (page: Page): Locator =>
  10 |   getLearningOverlay(page).getByTestId("learning-overlay-drawer");
  11 | 
  12 | export const openLearningDrawer = async (page: Page): Promise<Locator> => {
  13 |   const overlay = getLearningOverlay(page);
  14 |   const drawer = getLearningDrawer(page);
  15 |   if (!(await drawer.isVisible())) {
  16 |     await getLearningRail(page).hover();
  17 |   }
  18 |   await expect(drawer).toBeVisible();
  19 |   if (await overlay.getAttribute("data-drawer-state") === "transient") {
  20 |     await expect(drawer).toHaveCSS("transform", /^matrix\(1, 0, 0, 1, 0, 0\)$/);
  21 |   }
  22 |   return drawer;
  23 | };
  24 | 
  25 | export const openPinnedLearningDrawer = async (page: Page): Promise<Locator> => {
  26 |   const overlay = getLearningOverlay(page);
  27 |   const drawer = getLearningDrawer(page);
  28 |   const currentState = await overlay.getAttribute("data-drawer-state");
  29 |   if (currentState === "flow") {
  30 |     await expect(drawer).toBeVisible();
  31 |     return drawer;
  32 |   }
  33 |   if (currentState !== "pinned") {
  34 |     await getLearningRail(page).focus();
  35 |     await expect(drawer).toBeVisible();
> 36 |     await expect(drawer).toHaveCSS("transform", /^matrix\(1, 0, 0, 1, 0, 0\)$/);
     |                          ^ Error: expect(locator).toHaveCSS(expected) failed
  37 |     await page.getByRole("button", { name: "Keep Task and Feedback open" }).click();
  38 |   }
  39 |   await expect(overlay).toHaveAttribute("data-drawer-state", "pinned");
  40 |   await expect(drawer).toBeVisible();
  41 |   return drawer;
  42 | };
  43 | 
  44 | export const getLearningFeedbackButton = (page: Page): Locator =>
  45 |   getLearningDrawer(page).getByRole("button", {
  46 |     name: /^Feedback(?: — Task completed)?$/,
  47 |   });
  48 | 
  49 | export const openLearningFeedback = async (page: Page): Promise<Locator> => {
  50 |   const drawer = await openLearningDrawer(page);
  51 |   await getLearningFeedbackButton(page).click();
  52 |   return drawer.getByTestId("learning-overlay-feedback-view");
  53 | };
  54 | 
  55 | export const expectLearningFeedbackCompleted = async (page: Page): Promise<void> => {
  56 |   await openLearningDrawer(page);
  57 |   const button = getLearningFeedbackButton(page);
  58 |   await expect(button).toHaveAttribute("data-status", "completed");
  59 |   await expect(button).toHaveAccessibleName("Feedback — Task completed");
  60 | };
  61 | 
  62 | export const expectLearningFeedbackNotCompleted = async (page: Page): Promise<void> => {
  63 |   await openLearningDrawer(page);
  64 |   const button = getLearningFeedbackButton(page);
  65 |   await expect(button).toHaveAttribute("data-status", "in-progress");
  66 |   await expect(button).toHaveAccessibleName("Feedback");
  67 | };
  68 | 
```