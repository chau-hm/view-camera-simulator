# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: interior-corner-guided-lesson.spec.ts >> Interior Corner completes the public Compose → Swing → Refine → Aperture lesson
- Location: src/tests/e2e/interior-corner-guided-lesson.spec.ts:47:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer')
Expected substring: "Step 1 of 5"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer')

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
  3   | import {
  4   |   expectLearningFeedbackCompleted,
  5   |   expectLearningFeedbackNotCompleted,
  6   |   getLearningDrawer,
  7   |   getLearningOverlay,
  8   |   openPinnedLearningDrawer,
  9   |   openLearningFeedback,
  10  | } from "./helpers/learningOverlay";
  11  | import { setRangeDirect } from "./helpers/rangeInput";
  12  | import { setStepRangeInput } from "./helpers/stepRangeInput";
  13  |
  14  | const expectLessonStage = async (page: Page, step: string, label: string) => {
  15  |   const drawer = getLearningDrawer(page);
> 16  |   await expect(drawer).toContainText(step);
      |                        ^ Error: expect(locator).toContainText(expected) failed
  17  |   await openPinnedLearningDrawer(page);
  18  |   const progress = page.getByRole("region", { name: "Guided lesson progress" });
  19  |   await expect(progress).toBeVisible();
  20  |   await expect(progress).toContainText(step);
  21  |   await expect(page.locator('[aria-current="step"]')).toHaveText(new RegExp(label));
  22  | };
  23  |
  24  | const inspectCompletedFeedbackAndReturnToTask = async (page: Page) => {
  25  |   await expectLearningFeedbackCompleted(page);
  26  |   const feedback = await openLearningFeedback(page);
  27  |   await expect(feedback.getByRole("heading", { name: "Task completed" })).toBeVisible();
  28  |   await getLearningOverlay(page).getByRole("button", { name: "Task", exact: true }).click();
  29  | };
  30  |
  31  | const expectGroundGlassMounted = async (page: Page) => {
  32  |   const rtt = page.getByTestId("ground-glass-rtt");
  33  |   await expect(rtt).toHaveAttribute("data-rtt-scene-id", "interior-corner");
  34  |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  35  |   await expect(rtt.locator("canvas")).toBeVisible();
  36  | };
  37  |
  38  | const expectGroundGlassReady = async (page: Page) => {
  39  |   const rtt = page.getByTestId("ground-glass-rtt");
  40  |   await expectGroundGlassMounted(page);
  41  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  42  | };
  43  |
  44  | const isAllowedEnvironmentConsoleMessage = (message: string) =>
  45  |   /GL Driver Message .*GPU stall due to ReadPixels/.test(message);
  46  |
  47  | test("Interior Corner completes the public Compose → Swing → Refine → Aperture lesson", async ({
  48  |   page,
  49  | }) => {
  50  |   test.setTimeout(360_000);
  51  |   const pageErrors: string[] = [];
  52  |   const consoleProblems: string[] = [];
  53  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  54  |   page.on("console", (message) => {
  55  |     if (isKnownFiberClockDeprecation(message)) return;
  56  |     if (
  57  |       (message.type() === "error" || message.type() === "warning") &&
  58  |       !isAllowedEnvironmentConsoleMessage(message.text())
  59  |     ) {
  60  |       consoleProblems.push(message.text());
  61  |     }
  62  |   });
  63  |
  64  |   await page.goto("/scenes");
  65  |   const card = page
  66  |     .getByRole("article")
  67  |     .filter({ has: page.getByRole("heading", { name: "Interior Corner — Rise + Swing" }) });
  68  |   await expect(card.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
  69  |     "href",
  70  |     "/simulator/free/interior-corner",
  71  |   );
  72  |   await expect(card.getByRole("link", { name: "Guided Lesson" })).toHaveAttribute(
  73  |     "href",
  74  |     "/simulator/free/interior-corner?lesson=1",
  75  |   );
  76  |   // Keep the catalog link contract above, then opt into the existing RTT
  77  |   // diagnostics marker for the public lesson route.
  78  |   await page.goto("/simulator/free/interior-corner?lesson=1&rttDiagnostics=1");
  79  |
  80  |   await expect(page).toHaveURL(/\/simulator\/free\/interior-corner\?lesson=1&rttDiagnostics=1$/);
  81  |   await expectLessonStage(page, "Step 1 of 5", "Observe");
  82  |   await expect(page.getByRole("heading", { name: "Observe the Problem" })).toBeVisible();
  83  |   await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  84  |   await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("0");
  85  |   await expect(page.getByLabel("Focus distance")).toHaveValue("8000");
  86  |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute("data-selected-aperture", "5.6");
  87  |   await expectGroundGlassReady(page);
  88  |
  89  |   await page.getByRole("link", { name: "Continue" }).click();
  90  |   await expect(page).toHaveURL(
  91  |     /\/simulator\/guided\/interior-corner\/interior-corner-compose-01\?lesson=1$/,
  92  |   );
  93  |   await expectLessonStage(page, "Step 2 of 5", "Compose");
  94  |   await expect(page.getByRole("heading", { name: "Compose the Interior Corner with Rise" })).toBeVisible();
  95  |   await expect(page.getByRole("slider", { name: "Rise" })).toBeEnabled();
  96  |   await expect(page.getByRole("slider", { name: "Swing" })).toBeDisabled();
  97  |   await expect(page.getByLabel("Focus distance")).toBeDisabled();
  98  |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeDisabled();
  99  |   await setStepRangeInput(page, "Rise", 33);
  100 |   await inspectCompletedFeedbackAndReturnToTask(page);
  101 |
  102 |   await page.getByRole("link", { name: "Continue" }).click();
  103 |   await expect(page).toHaveURL(
  104 |     /\/simulator\/guided\/interior-corner\/interior-corner-swing-01\?lesson=1$/,
  105 |   );
  106 |   await expectLessonStage(page, "Step 3 of 5", "Front Swing");
  107 |   await expect(page.getByRole("heading", { name: "Turn the Focus Plane with Swing" })).toBeVisible();
  108 |   await expect(page.getByRole("slider", { name: "Rise" })).toBeDisabled();
  109 |   await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("0");
  110 |   await expect(page.getByRole("slider", { name: "Swing" })).toBeEnabled();
  111 |   await expect(page.getByLabel("Focus distance")).toHaveValue("8000");
  112 |   await expect(page.getByLabel("Focus distance")).toBeDisabled();
  113 |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeDisabled();
  114 |   await setStepRangeInput(page, "Swing", 3.6);
  115 |   await inspectCompletedFeedbackAndReturnToTask(page);
  116 |
```