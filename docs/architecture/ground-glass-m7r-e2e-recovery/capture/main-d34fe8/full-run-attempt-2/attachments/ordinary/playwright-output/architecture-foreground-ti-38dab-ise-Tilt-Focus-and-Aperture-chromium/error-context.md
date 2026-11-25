# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: architecture-foreground-tilt-focus.spec.ts >> Architecture + Foreground Free Practice exposes Rise, Tilt, Focus, and Aperture
- Location: src/tests/e2e/architecture-foreground-tilt-focus.spec.ts:45:1

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator: getByRole('region', { name: 'Camera Controls' }).getByRole('slider', { name: 'Rise' })
Expected: enabled
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeEnabled" with timeout 5000ms
  - waiting for getByRole('region', { name: 'Camera Controls' }).getByRole('slider', { name: 'Rise' })

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  1   | import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
  2   | import { expect, test } from "@playwright/test";
  3   | import { readFocusDistributionPercent } from "./helpers/focusDistribution";
  4   | import {
  5   |   expectLearningFeedbackCompleted,
  6   |   expectLearningFeedbackNotCompleted,
  7   |   openPinnedLearningDrawer,
  8   |   openLearningFeedback,
  9   | } from "./helpers/learningOverlay";
  10  | import { setStepRangeInput } from "./helpers/stepRangeInput";
  11  | 
  12  | const isAllowedEnvironmentConsoleMessage = (message: string) =>
  13  |   /GL Driver Message .*GPU stall due to ReadPixels/.test(message);
  14  | 
  15  | test("Architecture + Foreground is discoverable from the Scenes page", async ({ page }) => {
  16  |   await page.goto("/scenes");
  17  | 
  18  |   const heading = page.getByRole("heading", { name: "Architecture + Foreground", level: 3 });
  19  |   await expect(heading).toBeVisible();
  20  |   const card = heading.locator("xpath=ancestor::article");
  21  |   await expect(card.locator("img")).toHaveAttribute("src", "/assets/architecture-foreground.webp");
  22  |   await expect(card.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
  23  |     "href",
  24  |     "/simulator/free/architecture-foreground",
  25  |   );
  26  |   await expect(card.getByRole("link", { name: "Guided Lesson" })).toHaveAttribute(
  27  |     "href",
  28  |     "/simulator/free/architecture-foreground?lesson=1",
  29  |   );
  30  | 
  31  |   const sceneHeadings = await page.getByRole("heading", { level: 3 }).allTextContents();
  32  |   expect(sceneHeadings).toContain("Oblique Architecture");
  33  |   expect(sceneHeadings).toContain("Architecture + Foreground");
  34  |   expect(sceneHeadings).toContain("Interior Corner — Rise + Swing");
  35  | 
  36  |   await card.getByRole("link", { name: "Open Scene" }).click();
  37  |   await expect(page).toHaveURL(/\/simulator\/free\/architecture-foreground$/);
  38  |   await expect(page.getByTestId("scene-canvas")).toHaveAttribute(
  39  |     "data-scene-subject-id",
  40  |     "architecture-foreground",
  41  |     { timeout: 15_000 },
  42  |   );
  43  | });
  44  | 
  45  | test("Architecture + Foreground Free Practice exposes Rise, Tilt, Focus, and Aperture", async ({ page }) => {
  46  |   test.setTimeout(120_000);
  47  |   const pageErrors: string[] = [];
  48  |   const consoleProblems: string[] = [];
  49  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  50  |   page.on("console", (message) => {
  51  |     if (isKnownFiberClockDeprecation(message)) return;
  52  |     if (
  53  |       (message.type() === "error" || message.type() === "warning") &&
  54  |       !isAllowedEnvironmentConsoleMessage(message.text())
  55  |     ) {
  56  |       consoleProblems.push(message.text());
  57  |     }
  58  |   });
  59  | 
  60  |   await page.goto("/simulator/free/architecture-foreground?rttDiagnostics=1");
  61  |   const controls = page.getByRole("region", { name: "Camera Controls" });
  62  |   const rise = controls.getByRole("slider", { name: "Rise" });
  63  |   const tilt = controls.getByRole("slider", { name: "Tilt" });
  64  |   const focus = page.getByLabel("Focus distance");
  65  | 
> 66  |   await expect(rise).toBeEnabled();
      |                      ^ Error: expect(locator).toBeEnabled() failed
  67  |   await expect(tilt).toBeEnabled();
  68  |   await expect(controls.getByRole("slider", { name: "Swing" })).toBeDisabled();
  69  |   await expect(focus).toBeEnabled();
  70  |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeEnabled();
  71  | 
  72  |   const rtt = page.getByTestId("ground-glass-rtt");
  73  |   await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  74  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  75  | 
  76  |   await expect(page.getByTestId("focus-distribution-panel")).toBeVisible();
  77  |   const readNearSharpness = () => readFocusDistributionPercent(page, { targetId: "foreground-near" });
  78  |   const readBuildingSharpness = () => readFocusDistributionPercent(page, { targetId: "building-middle" });
  79  |   const initialBuildingSharpness = await readBuildingSharpness();
  80  | 
  81  |   await setStepRangeInput(page, "Rise", 20);
  82  |   await setStepRangeInput(page, "Tilt", 2);
  83  |   await expect(rtt).toHaveAttribute("data-rtt-dof-mode", "derived-planes");
  84  |   const tiltedBuildingSharpness = await readBuildingSharpness();
  85  |   expect(tiltedBuildingSharpness).not.toBe(initialBuildingSharpness);
  86  | 
  87  |   await setStepRangeInput(page, "Focus distance", 6830);
  88  |   await expect.poll(readNearSharpness).toBeGreaterThanOrEqual(70);
  89  |   await expect.poll(readBuildingSharpness).toBeGreaterThanOrEqual(70);
  90  | 
  91  |   expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  92  |   expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
  93  | });
  94  | 
  95  | test("Architecture + Foreground Tilt + Focus guided task starts composed and is restartable", async ({ page }) => {
  96  |   test.setTimeout(120_000);
  97  |   await page.goto(
  98  |     "/simulator/guided/architecture-foreground/architecture-foreground-tilt-focus-01?rttDiagnostics=1",
  99  |   );
  100 |   await expect(page).toHaveURL(
  101 |     /\/simulator\/guided\/architecture-foreground\/architecture-foreground-tilt-focus-01\?rttDiagnostics=1$/,
  102 |   );
  103 |   await openPinnedLearningDrawer(page);
  104 |   await expect(page.getByRole("heading", { name: "Align the Focus Plane" })).toBeVisible();
  105 |   await expect(
  106 |     page.getByText(
  107 |       "Use Front Tilt and Focus to make the near foreground and the building usefully sharp while preserving the corrected architectural framing.",
  108 |       { exact: true },
  109 |     ),
  110 |   ).toBeVisible();
  111 |   await expectLearningFeedbackNotCompleted(page);
  112 | 
  113 |   const controls = page.getByRole("region", { name: "Camera Controls" });
  114 |   const rise = controls.getByRole("slider", { name: "Rise" });
  115 |   const tilt = controls.getByRole("slider", { name: "Tilt" });
  116 |   const focus = page.getByLabel("Focus distance");
  117 |   await expect(rise).toBeDisabled();
  118 |   await expect(rise).toHaveValue("20");
  119 |   await expect(tilt).toBeEnabled();
  120 |   await expect(focus).toBeEnabled();
  121 |   await expect(controls.getByRole("slider", { name: "Swing" })).toBeDisabled();
  122 |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeDisabled();
  123 | 
  124 |   const rtt = page.getByTestId("ground-glass-rtt");
  125 |   await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  126 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  127 | 
  128 |   await setStepRangeInput(page, "Tilt", 2);
  129 |   await expectLearningFeedbackNotCompleted(page);
  130 |   await setStepRangeInput(page, "Focus distance", 6830);
  131 |   await expectLearningFeedbackCompleted(page);
  132 |   const feedback = await openLearningFeedback(page);
  133 |   await expect(feedback.getByRole("heading", { name: "Task completed" })).toBeVisible({ timeout: 20_000 });
  134 |   await expect(
  135 |     feedback.getByText(/Aperture will address the remaining depth-of-field limitation later/i),
  136 |   ).toBeVisible();
  137 | 
  138 |   await page.getByRole("button", { name: "Restart task" }).click();
  139 |   await expectLearningFeedbackNotCompleted(page);
  140 |   const resetFeedback = await openLearningFeedback(page);
  141 |   await expect(resetFeedback.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  142 |   await expect(rise).toHaveValue("20");
  143 |   await expect(tilt).toHaveValue("0");
  144 |   await expect(focus).toHaveValue("9490");
  145 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  146 | });
  147 | 
```