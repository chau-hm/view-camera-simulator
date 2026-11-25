# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: interior-corner-swing-focus.spec.ts >> validated direct Swing input rejects inaccessible and off-grid targets
- Location: src/tests/e2e/interior-corner-swing-focus.spec.ts:165:1

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator: getByRole('slider', { name: 'Swing' })
Expected: enabled
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeEnabled" with timeout 5000ms
  - waiting for getByRole('slider', { name: 'Swing' })

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  68  |   const rise = cameraControls.getByRole("slider", { name: "Rise" });
  69  |   const swing = cameraControls.getByRole("slider", { name: "Swing" });
  70  |   const focus = cameraControls.getByRole("slider", { name: "Focus distance" });
  71  |   const feedbackView = await measuredStage("Open Learning Feedback", () =>
  72  |     openLearningFeedback(page),
  73  |   );
  74  |   const compositionFeedback = feedbackView.getByTestId("interior-corner-rise-composition-feedback");
  75  |   const focusFeedback = feedbackView.getByTestId("interior-corner-focus-feedback");
  76  |
  77  |   await measuredStage("Initial public movement values and focus feedback", async () => {
  78  |     await expect(rise).toHaveValue("0");
  79  |     await expect(swing).toHaveValue("0");
  80  |     await expect(focus).toHaveValue("8000");
  81  |     await expect(focusFeedback).toContainText("Focus alone cannot hold the near, middle, and far details together");
  82  |   });
  83  |
  84  |   const rtt = page.getByTestId("ground-glass-rtt");
  85  |   await measuredStage("Ground Glass final-contentful readiness", async () => {
  86  |     await expect(rtt).toHaveAttribute("data-rtt-scene-id", "interior-corner");
  87  |     await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  88  |   });
  89  |
  90  |   await measuredStage("Rise 0 → 33", async () => {
  91  |     await setStepRangeInput(page, "Rise", 33);
  92  |     await expect(rise).toHaveValue("33");
  93  |     await expect(compositionFeedback).toContainText("upper architecture is now inside a safer frame");
  94  |   });
  95  |
  96  |   await measuredStage("Swing 0 → +3.6", async () => {
  97  |     await setRangeDirectOnGrid(page, "Swing", 3.6);
  98  |     await expect(swing).toHaveValue("3.6");
  99  |     await expect(focusFeedback).toContainText("receding wall is not yet consistently sharp");
  100 |   });
  101 |
  102 |   await measuredStage("Focus 8000 → 38140 and aligned-state feedback", async () => {
  103 |     await setReachableFocusValue(page, 38140);
  104 |     await expect(focus).toHaveValue("38140");
  105 |     await expect(focusFeedback).toContainText("near, middle, and far details on the receding side wall are acceptably sharp");
  106 |     await expect(compositionFeedback).toContainText("upper architecture is now inside a safer frame");
  107 |     await expect(swing).toBeEnabled();
  108 |   });
  109 |
  110 |   await measuredStage("Swing +3.6 → −3.6 and reverse-state feedback", async () => {
  111 |     await setRangeDirectOnGrid(page, "Swing", -3.6);
  112 |     await expect(swing).toHaveValue("-3.6");
  113 |     await expect(focusFeedback).toContainText("Focus alone cannot hold the near, middle, and far details together");
  114 |     await expect(focusFeedback).not.toContainText("Refine receding-wall focus");
  115 |   });
  116 |
  117 |   expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  118 |   expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
  119 | });
  120 |
  121 | test("Interior Corner Swing keyboard steps update the public movement readout in both directions", async ({ page }) => {
  122 |   await page.goto("/simulator/free/interior-corner?rttDiagnostics=1");
  123 |   await expect(page).toHaveURL(/\/simulator\/free\/interior-corner\?rttDiagnostics=1$/);
  124 |
  125 |   const swing = page.getByRole("region", { name: "Camera Controls" }).getByRole("slider", {
  126 |     name: "Swing",
  127 |   });
  128 |   await expect(swing).toBeEnabled();
  129 |   await expect(swing).toHaveValue("0");
  130 |
  131 |   const [minimumText, maximumText, stepText] = await Promise.all([
  132 |     swing.getAttribute("min"),
  133 |     swing.getAttribute("max"),
  134 |     swing.getAttribute("step"),
  135 |   ]);
  136 |   const minimum = Number(minimumText);
  137 |   const maximum = Number(maximumText);
  138 |   const step = Number(stepText);
  139 |   const initial = Number(await swing.inputValue());
  140 |   const forward = initial + step;
  141 |   const forwardAgain = initial + 2 * step;
  142 |   expect([minimum, maximum, step, initial, forward, forwardAgain].every(Number.isFinite)).toBe(true);
  143 |   expect(step).toBeGreaterThan(0);
  144 |   expect(forwardAgain).toBeLessThanOrEqual(maximum);
  145 |   expect(initial).toBeGreaterThanOrEqual(minimum);
  146 |
  147 |   const movementReadout = swing.locator("xpath=..").locator(".compact-range-row__value");
  148 |   const formattedValue = (value: number) => `${value.toFixed(1)}°`;
  149 |   await expect(movementReadout).toHaveText(formattedValue(initial));
  150 |
  151 |   await swing.focus();
  152 |   await swing.press("ArrowRight");
  153 |   await expect(swing).toHaveValue(String(forward));
  154 |   await expect(movementReadout).toHaveText(formattedValue(forward));
  155 |
  156 |   await swing.press("ArrowRight");
  157 |   await expect(swing).toHaveValue(String(forwardAgain));
  158 |   await expect(movementReadout).toHaveText(formattedValue(forwardAgain));
  159 |
  160 |   await swing.press("ArrowLeft");
  161 |   await expect(swing).toHaveValue(String(forward));
  162 |   await expect(movementReadout).toHaveText(formattedValue(forward));
  163 | });
  164 |
  165 | test("validated direct Swing input rejects inaccessible and off-grid targets", async ({ page }) => {
  166 |   await page.goto("/simulator/free/interior-corner?rttDiagnostics=1");
  167 |   const swing = page.getByRole("slider", { name: "Swing" });
> 168 |   await expect(swing).toBeEnabled();
      |                       ^ Error: expect(locator).toBeEnabled() failed
  169 |   await expect(swing).toHaveValue("0");
  170 |
  171 |   await expect(setRangeDirectOnGrid(page, "Missing Swing", 0.1)).rejects.toThrow();
  172 |   await expect(setRangeDirectOnGrid(page, "Swing", 3.65)).rejects.toThrow(/public control grid/);
  173 |   await expect(setRangeDirectOnGrid(page, "Swing", 10.1)).rejects.toThrow(/public control grid/);
  174 |   await expect(setRangeDirectOnGrid(page, "Swing", Number.NaN)).rejects.toThrow(/public control grid/);
  175 |   await expect(swing).toHaveValue("0");
  176 |
  177 |   await swing.evaluate((element) => {
  178 |     (element as HTMLInputElement).disabled = true;
  179 |   });
  180 |   await expect(setRangeDirectOnGrid(page, "Swing", 0.1)).rejects.toThrow();
  181 |   await expect(swing).toHaveValue("0");
  182 | });
  183 |
```