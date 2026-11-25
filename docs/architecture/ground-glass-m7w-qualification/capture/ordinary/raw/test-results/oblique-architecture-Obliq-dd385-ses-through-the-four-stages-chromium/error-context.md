# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: oblique-architecture.spec.ts >> Oblique Architecture guided lesson progresses through the four stages
- Location: src/tests/e2e/oblique-architecture.spec.ts:292:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer').locator('[aria-current="step"]')
Expected pattern: /Observe/
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer').locator('[aria-current="step"]')

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  1   | import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
  2   | import { expect, test, type Page } from "@playwright/test";
  3   | import { readFocusDistributionScores } from "./helpers/focusDistribution";
  4   | import {
  5   |   expectLearningFeedbackCompleted,
  6   |   expectLearningFeedbackNotCompleted,
  7   |   getLearningDrawer,
  8   |   getLearningOverlay,
  9   |   openPinnedLearningDrawer,
  10  |   openLearningFeedback,
  11  | } from "./helpers/learningOverlay";
  12  | import { setRangeDirect } from "./helpers/rangeInput";
  13  | import { setStepRangeInput } from "./helpers/stepRangeInput";
  14  |
  15  | const isAllowedEnvironmentConsoleMessage = (message: string) =>
  16  |   /GL Driver Message .*GPU stall due to ReadPixels/.test(message);
  17  |
  18  | const openCompletedFeedback = async (page: Page) => {
  19  |   await expectLearningFeedbackCompleted(page);
  20  |   const feedback = await openLearningFeedback(page);
  21  |   await expect(feedback.getByRole("heading", { name: "Task completed" })).toBeVisible();
  22  |   return feedback;
  23  | };
  24  |
  25  | const openLessonProgress = async (page: Page, label: string) => {
  26  |   const currentStep = page.locator('[aria-current="step"]');
> 27  |   await expect(getLearningDrawer(page).locator('[aria-current="step"]')).toHaveText(new RegExp(label));
      |                                                                          ^ Error: expect(locator).toHaveText(expected) failed
  28  |   await openPinnedLearningDrawer(page);
  29  |   await expect(currentStep).toHaveText(new RegExp(label));
  30  | };
  31  |
  32  | const inspectCompletedFeedbackAndReturnToTask = async (page: Page) => {
  33  |   await openCompletedFeedback(page);
  34  |   await getLearningOverlay(page).getByRole("button", { name: "Task", exact: true }).click();
  35  | };
  36  |
  37  | const assertSharedObliqueRendering = async (page: Page) => {
  38  |   await expect(page.getByRole("heading", { name: "3D Scene" })).toBeVisible();
  39  |   await expect(page.getByRole("heading", { name: "Ground Glass", exact: true })).toBeVisible();
  40  |
  41  |   const sceneCanvas = page.getByTestId("scene-canvas");
  42  |   await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "oblique-architecture");
  43  |   await expect(sceneCanvas).toHaveAttribute("data-optics-fallback-applied", "false");
  44  |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  45  |
  46  |   const rtt = page.getByTestId("ground-glass-rtt");
  47  |   await expect(rtt).toHaveAttribute("data-rtt-scene-id", "oblique-architecture");
  48  |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  49  |   await expect(rtt).toHaveAttribute("data-rtt-depth-available", "true", { timeout: 60_000 });
  50  |   await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 60_000 });
  51  |   await expect(rtt).toHaveAttribute("data-rtt-dof-mode", "parallel-thin-lens");
  52  |   await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
  53  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  54  |   expect(Number(await rtt.getAttribute("data-rtt-final-variance"))).toBeGreaterThan(4);
  55  |   expect(Number(await rtt.getAttribute("data-rtt-final-non-background"))).toBeGreaterThan(0);
  56  |   await expect(rtt.locator("canvas")).toBeVisible();
  57  |
  58  |   const sharpness = Object.values(
  59  |     await readFocusDistributionScores(page, ["facade-near", "facade-middle", "facade-far"]),
  60  |   );
  61  |   expect(sharpness[1]).toBeGreaterThan(sharpness[0]);
  62  |   expect(sharpness[1]).toBeGreaterThan(sharpness[2]);
  63  |
  64  |   return { rtt, sceneCanvas };
  65  | };
  66  |
  67  | const assertRiseTaskControls = async (page: Page) => {
  68  |   const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  69  |   const rise = cameraControls.getByRole("slider", { name: "Rise" });
  70  |   await expect(rise).toBeVisible();
  71  |   await expect(rise).toBeEnabled();
  72  |   await expect(cameraControls.getByRole("slider", { name: "Swing" })).toBeDisabled();
  73  |   await expect(cameraControls.getByRole("slider", { name: "Tilt" })).toBeDisabled();
  74  |   await expect(page.getByLabel("Focus distance")).toBeDisabled();
  75  |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeDisabled();
  76  |   await expect(page.getByRole("button", { name: "Reset movements" })).toBeVisible();
  77  |   return rise;
  78  | };
  79  |
  80  | const assertFreeControls = async (page: Page) => {
  81  |   const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  82  |   const rise = cameraControls.getByRole("slider", { name: "Rise" });
  83  |   const swing = cameraControls.getByRole("slider", { name: "Swing" });
  84  |   const tilt = cameraControls.getByRole("slider", { name: "Tilt" });
  85  |   const focus = page.getByLabel("Focus distance");
  86  |   await expect(rise).toBeEnabled();
  87  |   await expect(swing).toBeEnabled();
  88  |   await expect(tilt).toBeDisabled();
  89  |   await expect(focus).toBeEnabled();
  90  |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeDisabled();
  91  |   await expect(page.getByRole("button", { name: "Reset movements" })).toBeVisible();
  92  |   return { rise, swing, focus, rtt: page.getByTestId("ground-glass-rtt") };
  93  | };
  94  |
  95  | test("Oblique Architecture free practice exposes Rise, Swing, and Focus", async ({ page }) => {
  96  |   test.setTimeout(120_000);
  97  |   const pageErrors: string[] = [];
  98  |   const consoleProblems: string[] = [];
  99  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  100 |   page.on("console", (message) => {
  101 |     if (isKnownFiberClockDeprecation(message)) return;
  102 |     if (
  103 |       (message.type() === "error" || message.type() === "warning") &&
  104 |       !isAllowedEnvironmentConsoleMessage(message.text())
  105 |     ) {
  106 |       consoleProblems.push(message.text());
  107 |     }
  108 |   });
  109 |
  110 |   await page.goto("/simulator/free/oblique-architecture?rttDiagnostics=1");
  111 |   await expect(page).toHaveURL(/\/simulator\/free\/oblique-architecture\?rttDiagnostics=1$/);
  112 |   await assertSharedObliqueRendering(page);
  113 |   const { rise, swing, focus, rtt } = await assertFreeControls(page);
  114 |   await expect(page.getByRole("region", { name: "Guided lesson progress" })).not.toBeVisible();
  115 |   await expect(rise).toHaveValue("0");
  116 |   await expect(page.getByText("Aperture is fixed for this lesson", { exact: true })).toBeVisible();
  117 |   await expect(swing).toHaveValue("0");
  118 |
  119 |   await setStepRangeInput(page, "Rise", 20);
  120 |   await setStepRangeInput(page, "Swing", 5);
  121 |   await expect(rise).toHaveValue("20");
  122 |   await expect(swing).toHaveValue("5");
  123 |
  124 |   const focusBefore = await focus.inputValue();
  125 |
  126 |   const neutralSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  127 |   await setStepRangeInput(page, "Swing", 1);
```