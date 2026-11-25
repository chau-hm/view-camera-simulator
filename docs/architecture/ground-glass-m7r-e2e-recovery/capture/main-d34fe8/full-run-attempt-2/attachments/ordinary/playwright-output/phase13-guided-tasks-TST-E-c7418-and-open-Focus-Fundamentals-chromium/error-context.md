# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase13-guided-tasks.spec.ts >> TST-E2E-006: free mode can return to All Scenes and open Focus Fundamentals
- Location: src/tests/e2e/phase13-guided-tasks.spec.ts:59:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '3D Scene' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: '3D Scene' })

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import {
  3  |   expectLearningFeedbackCompleted,
  4  |   expectLearningFeedbackNotCompleted,
  5  |   openLearningFeedback,
  6  | } from "./helpers/learningOverlay";
  7  | import { setStepRangeInput } from "./helpers/stepRangeInput";
  8  | 
  9  | test("TST-E2E-002: user can open Architecture Rise from the Scenes page", async ({ page }) => {
  10 |   await page.goto("/");
  11 |   await page.getByTestId("landing-hero-cta").click();
  12 |   await expect(page).toHaveURL(/\/scenes$/);
  13 | 
  14 |   const architectureCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) });
  15 |   await expect(architectureCard).toBeVisible();
  16 |   await architectureCard.getByRole("link", { name: "Open Scene" }).click();
  17 | 
  18 |   await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  19 |   await expect(page.getByRole("heading", { name: "3D Scene" })).toBeVisible();
  20 |   await expect(page.getByRole("heading", { name: "Ground Glass" })).toBeVisible();
  21 |   await expect(page.getByLabel("Camera Controls")).toBeVisible();
  22 | });
  23 | 
  24 | test("TST-E2E-003: rise task starts in failed state", async ({ page }) => {
  25 |   await page.goto("/simulator/guided/architecture-rise/rise-01");
  26 |   await expectLearningFeedbackNotCompleted(page);
  27 |   const feedback = await openLearningFeedback(page);
  28 |   await expect(feedback).toContainText("Score:");
  29 |   await expect(feedback.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  30 | });
  31 | 
  32 | test("TST-E2E-004: rise task can be completed with valid rise", async ({ page }) => {
  33 |   await page.goto("/simulator/guided/architecture-rise/rise-01");
  34 |   await setStepRangeInput(page, "Rise", 12);
  35 |   await expectLearningFeedbackCompleted(page);
  36 |   const feedback = await openLearningFeedback(page);
  37 |   await expect(feedback.getByRole("heading", { name: "Task completed" })).toBeVisible();
  38 | });
  39 | 
  40 | test("TST-E2E-005: restart resets Architecture Rise guided task", async ({ page }) => {
  41 |   await page.goto("/simulator/guided/architecture-rise/rise-01");
  42 |   await setStepRangeInput(page, "Rise", 12);
  43 |   await expectLearningFeedbackCompleted(page);
  44 |   await openLearningFeedback(page);
  45 | 
  46 |   await page.getByRole("button", { name: "Restart task" }).click();
  47 | 
  48 |   await expectLearningFeedbackNotCompleted(page);
  49 |   const feedback = await openLearningFeedback(page);
  50 |   await expect(feedback.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  51 |   await expect(page.getByLabel("Rise")).toHaveValue("0");
  52 |   // Confirm tilt and swing remain at 0
  53 |   await expect(page.getByLabel("Tilt")).toHaveValue("0");
  54 |   await expect(page.getByLabel("Swing")).toHaveValue("0");
  55 |   // Aperture default for tasks
  56 |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute("data-selected-aperture", "11");
  57 | });
  58 | 
  59 | test("TST-E2E-006: free mode can return to All Scenes and open Focus Fundamentals", async ({ page }) => {
  60 |   await page.goto("/simulator/free/architecture-rise");
> 61 |   await expect(page.getByRole("heading", { name: "3D Scene" })).toBeVisible();
     |                                                                 ^ Error: expect(locator).toBeVisible() failed
  62 | 
  63 |   await page.getByRole("link", { name: "All Scenes" }).click();
  64 |   await expect(page).toHaveURL(/\/scenes$/);
  65 | 
  66 |   const focusCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Focus Fundamentals — Two Targets" }) });
  67 |   await expect(focusCard).toBeVisible();
  68 |   await focusCard.getByRole("link", { name: "Open Scene" }).click();
  69 | 
  70 |   await expect(page).toHaveURL(/\/simulator\/free\/focus-fundamentals-two-targets$/);
  71 |   await expect(page.getByLabel("Focus distance")).toBeVisible();
  72 | });
  73 | 
  74 | test("TST-E2E-007: shows webgl fallback when WebGL is unavailable", async ({ page }) => {
  75 |   // Deterministic interception that preserves non-WebGL contexts
  76 |   await page.addInitScript(() => {
  77 |     const original = HTMLCanvasElement.prototype.getContext;
  78 |     HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: unknown[]) {
  79 |       if (contextId === "webgl" || contextId === "webgl2" || contextId === "experimental-webgl") {
  80 |         return null;
  81 |       }
  82 |       // @ts-expect-error - forward to original (typing not important in test harness)
  83 |       return original.call(this, contextId, ...args);
  84 |     } as typeof HTMLCanvasElement.prototype.getContext;
  85 |   });
  86 | 
  87 |   await page.goto("/simulator/guided/architecture-rise/rise-01");
  88 |   await expect(
  89 |     page.getByText(
  90 |       "WebGL is unavailable in this browser. Please use a WebGL-capable browser on desktop.",
  91 |     ),
  92 |   ).toBeVisible();
  93 |   await expect(page.getByLabel("Camera Controls")).toBeVisible();
  94 | });
  95 | 
```