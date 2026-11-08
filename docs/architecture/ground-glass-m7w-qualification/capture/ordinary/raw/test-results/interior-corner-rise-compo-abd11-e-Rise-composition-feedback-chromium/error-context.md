# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: interior-corner-rise-composition.spec.ts >> Interior Corner free mode exposes reachable Rise composition feedback
- Location: src/tests/e2e/interior-corner-rise-composition.spec.ts:9:1

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
  1  | import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
  2  | import { expect, test } from "@playwright/test";
  3  | import { setStepRangeInput } from "./helpers/stepRangeInput";
  4  | import { openLearningFeedback } from "./helpers/learningOverlay";
  5  |
  6  | const isAllowedEnvironmentConsoleMessage = (message: string) =>
  7  |   /GL Driver Message .*GPU stall due to ReadPixels/.test(message);
  8  |
  9  | test("Interior Corner free mode exposes reachable Rise composition feedback", async ({ page }) => {
  10 |   test.setTimeout(120_000);
  11 |   const pageErrors: string[] = [];
  12 |   const consoleProblems: string[] = [];
  13 |   page.on("pageerror", (error) => pageErrors.push(error.message));
  14 |   page.on("console", (message) => {
  15 |     if (isKnownFiberClockDeprecation(message)) return;
  16 |     if (
  17 |       (message.type() === "error" || message.type() === "warning") &&
  18 |       !isAllowedEnvironmentConsoleMessage(message.text())
  19 |     ) {
  20 |       consoleProblems.push(message.text());
  21 |     }
  22 |   });
  23 |
  24 |   await page.goto("/simulator/free/interior-corner?rttDiagnostics=1");
  25 |   await expect(page).toHaveURL(/\/simulator\/free\/interior-corner\?rttDiagnostics=1$/);
  26 |
  27 |   const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  28 |   const rise = cameraControls.getByRole("slider", { name: "Rise" });
> 29 |   await expect(rise).toBeEnabled();
     |                      ^ Error: expect(locator).toBeEnabled() failed
  30 |   await expect(rise).toHaveValue("0");
  31 |
  32 |   const feedbackView = await openLearningFeedback(page);
  33 |   const feedback = feedbackView.getByTestId("interior-corner-rise-composition-feedback");
  34 |   await expect(feedback).toContainText("upper architecture is still too close to the top edge");
  35 |
  36 |   const rtt = page.getByTestId("ground-glass-rtt");
  37 |   await expect(rtt).toHaveAttribute("data-rtt-scene-id", "interior-corner");
  38 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  39 |
  40 |   await setStepRangeInput(page, "Rise", 33);
  41 |   await expect(rise).toHaveValue("33");
  42 |   await expect(feedback).toContainText("upper architecture is now inside a safer frame");
  43 |   await expect(cameraControls.getByRole("slider", { name: "Swing" })).toBeEnabled();
  44 |
  45 |   expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  46 |   expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
  47 | });
  48 |
```