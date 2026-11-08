# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: oblique-tabletop-guided-lesson.spec.ts >> Oblique Tabletop completes the public Focus → Tilt → Swing → Focus → Aperture lesson
- Location: src/tests/e2e/oblique-tabletop-guided-lesson.spec.ts:41:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer')
Expected substring: "Step 1 of 6"
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
  5   |   getLearningDrawer,
  6   |   getLearningOverlay,
  7   |   openPinnedLearningDrawer,
  8   |   openLearningFeedback,
  9   | } from "./helpers/learningOverlay";
  10  | import { setRangeDirect } from "./helpers/rangeInput";
  11  | import { setStepRangeInput } from "./helpers/stepRangeInput";
  12  |
  13  | const expectLessonStage = async (page: Page, step: string, label: string) => {
  14  |   const drawer = getLearningDrawer(page);
> 15  |   await expect(drawer).toContainText(step);
      |                        ^ Error: expect(locator).toContainText(expected) failed
  16  |   await openPinnedLearningDrawer(page);
  17  |   const progress = page.getByRole("region", { name: "Guided lesson progress" });
  18  |   await expect(progress).toBeVisible();
  19  |   await expect(progress).toContainText(step);
  20  |   await expect(page.locator('[aria-current="step"]')).toHaveText(new RegExp(label));
  21  | };
  22  |
  23  | const inspectCompletedFeedbackAndReturnToTask = async (page: Page) => {
  24  |   await expectLearningFeedbackCompleted(page);
  25  |   const feedback = await openLearningFeedback(page);
  26  |   await expect(feedback.getByRole("heading", { name: "Task completed" })).toBeVisible();
  27  |   await getLearningOverlay(page).getByRole("button", { name: "Task", exact: true }).click();
  28  | };
  29  |
  30  | const expectGroundGlass = async (page: Page) => {
  31  |   const rtt = page.getByTestId("ground-glass-rtt");
  32  |   const stage = page.getByLabel("GroundGlassViewport").locator("[data-focus-loupe-active]");
  33  |   await expect(rtt).toHaveAttribute("data-rtt-scene-id", "oblique-tabletop");
  34  |   await expect(rtt).not.toHaveAttribute("data-focus-inspection-magnification");
  35  |   await expect(rtt).not.toHaveAttribute("data-focus-inspection-active");
  36  |   await expect(stage).toHaveAttribute("data-focus-loupe-active", "false");
  37  |   await expect(stage).toHaveAttribute("data-focus-loupe-scale", "1");
  38  |   await expect(rtt.locator("canvas")).toBeVisible();
  39  | };
  40  |
  41  | test("Oblique Tabletop completes the public Focus → Tilt → Swing → Focus → Aperture lesson", async ({
  42  |   page,
  43  | }) => {
  44  |   test.setTimeout(360_000);
  45  |   const pageErrors: string[] = [];
  46  |   const consoleProblems: string[] = [];
  47  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  48  |   page.on("console", (message) => {
  49  |     if (isKnownFiberClockDeprecation(message)) return;
  50  |     if (message.type() === "error" || message.type() === "warning") {
  51  |       if (!/GL Driver Message .*GPU stall due to ReadPixels/.test(message.text())) {
  52  |         consoleProblems.push(message.text());
  53  |       }
  54  |     }
  55  |   });
  56  |
  57  |   await page.goto("/scenes");
  58  |   const card = page
  59  |     .getByRole("article")
  60  |     .filter({ has: page.getByRole("heading", { name: "Oblique Tabletop" }) });
  61  |   await expect(card.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
  62  |     "href",
  63  |     "/simulator/free/oblique-tabletop",
  64  |   );
  65  |   await expect(card.getByRole("link", { name: "Guided Lesson" })).toHaveAttribute(
  66  |     "href",
  67  |     "/simulator/free/oblique-tabletop?lesson=1",
  68  |   );
  69  |   await card.getByRole("link", { name: "Guided Lesson" }).click();
  70  |
  71  |   await expect(page).toHaveURL(/\/simulator\/free\/oblique-tabletop\?lesson=1$/);
  72  |   await expectLessonStage(page, "Step 1 of 6", "Observe");
  73  |   await expect(page.getByRole("heading", { name: "Observe the Problem" })).toBeVisible();
  74  |   await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  75  |   await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("0");
  76  |   await expect(page.getByLabel("Focus distance")).toHaveValue("4540");
  77  |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute("data-selected-aperture", "11");
  78  |   await expectGroundGlass(page);
  79  |   await page.getByRole("button", { name: "Focus loupe · 4× Ground Glass view", exact: true }).click();
  80  |   await expect(page.getByRole("region", { name: "Pan Ground Glass", exact: true })).toHaveAttribute(
  81  |     "data-focus-loupe-scale",
  82  |     "4",
  83  |   );
  84  |   await expect(page.getByTestId("ground-glass-focus-loupe")).toHaveText("Focus loupe · 4×");
  85  |   await page.getByRole("button", { name: "Reset Ground Glass view", exact: true }).click();
  86  |
  87  |   await page.getByRole("link", { name: "Continue" }).click();
  88  |   await expect(page).toHaveURL(
  89  |     /\/simulator\/guided\/oblique-tabletop\/oblique-tabletop-focus-01\?lesson=1$/,
  90  |   );
  91  |   await expectLessonStage(page, "Step 2 of 6", "Focus");
  92  |   await expect(page.getByRole("heading", { name: "Focus the subject-board centre" })).toBeVisible();
  93  |   await expect(page.getByRole("slider", { name: "Tilt" })).toBeDisabled();
  94  |   await expect(page.getByRole("slider", { name: "Swing" })).toBeDisabled();
  95  |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeDisabled();
  96  |   await expect(page.getByLabel("Focus distance")).toHaveValue("4740");
  97  |   await setRangeDirect(page, "Focus distance", 4540);
  98  |   await inspectCompletedFeedbackAndReturnToTask(page);
  99  |
  100 |   await page.getByRole("link", { name: "Continue" }).click();
  101 |   await expect(page).toHaveURL(
  102 |     /\/simulator\/guided\/oblique-tabletop\/oblique-tabletop-tilt-01\?lesson=1$/,
  103 |   );
  104 |   await expectLessonStage(page, "Step 3 of 6", "Front Tilt");
  105 |   await expect(page.getByRole("heading", { name: "Improve near-to-far focus" })).toBeVisible();
  106 |   await expect(page.getByRole("slider", { name: "Swing" })).toBeDisabled();
  107 |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeDisabled();
  108 |   await setStepRangeInput(page, "Tilt", 3.6);
  109 |   await setRangeDirect(page, "Focus distance", 3530);
  110 |   await inspectCompletedFeedbackAndReturnToTask(page);
  111 |
  112 |   await page.getByRole("link", { name: "Continue" }).click();
  113 |   await expect(page).toHaveURL(
  114 |     /\/simulator\/guided\/oblique-tabletop\/oblique-tabletop-swing-01\?lesson=1$/,
  115 |   );
```