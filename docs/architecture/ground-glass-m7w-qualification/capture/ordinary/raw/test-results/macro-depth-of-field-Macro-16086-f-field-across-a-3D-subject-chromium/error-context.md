# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: macro-depth-of-field.spec.ts >> Macro 2 teaches shallow physical depth of field across a 3D subject
- Location: src/tests/e2e/macro-depth-of-field.spec.ts:11:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Infinity Reset' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: 'Infinity Reset' })

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | import { readFocusDistributionScores } from "./helpers/focusDistribution";
  3   | import { setPublicRangeInput } from "./helpers/publicRangeInput";
  4   |
  5   | const TARGET_IDS = [
  6   |   "macro-depth-near",
  7   |   "macro-depth-middle",
  8   |   "macro-depth-far",
  9   | ] as const;
  10  |
  11  | test("Macro 2 teaches shallow physical depth of field across a 3D subject", async ({ page }) => {
  12  |   test.setTimeout(90_000);
  13  |   const pageErrors: string[] = [];
  14  |   const consoleErrors: string[] = [];
  15  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  16  |   page.on("console", (message) => {
  17  |     if (message.type() === "error") consoleErrors.push(message.text());
  18  |   });
  19  |
  20  |   await page.goto("/simulator/free/architecture-rise");
> 21  |   await expect(page.getByRole("button", { name: "Infinity Reset" })).toBeVisible();
      |                                                                      ^ Error: expect(locator).toBeVisible() failed
  22  |   await page.getByRole("button", { name: "Infinity Reset" }).click();
  23  |   await expect(page.getByText(/Focus: ∞/)).toBeVisible();
  24  |
  25  |   // Preserve the previous scene's Infinity state while using the public SPA
  26  |   // navigation path into the finite-only Macro scene.
  27  |   await page.getByRole("link", { name: "All Scenes" }).click();
  28  |   await expect(page).toHaveURL(/\/scenes$/);
  29  |   await page.locator('a[href="/simulator/free/macro-depth-of-field"]').click();
  30  |   await expect(page).toHaveURL(/\/simulator\/free\/macro-depth-of-field$/);
  31  |
  32  |   const sceneCanvas = page.getByTestId("scene-canvas");
  33  |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  34  |   await expect(page.locator(".groundglass-renderer-host canvas")).toHaveCount(1);
  35  |   await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-depth-of-field");
  36  |
  37  |   const focus = page.getByRole("slider", { name: "Focus distance" });
  38  |   const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  39  |   const groundGlassRtt = page.getByTestId("ground-glass-rtt");
  40  |   const readout = page.getByRole("region", { name: "Macro focus" });
  41  |   await expect(focus).toHaveValue("400");
  42  |   await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  43  |   await expect(aperture).toBeEnabled();
  44  |   await expect(readout).toContainText("240.0 mm");
  45  |   await expect(readout).toContainText("0.60×");
  46  |   await expect(page.getByText("Movement", { exact: true })).toHaveCount(0);
  47  |   await expect(page.getByRole("button", { name: "Infinity Reset" })).toHaveCount(0);
  48  |   await expect(page.getByRole("combobox", { name: /focal length/i })).toHaveCount(0);
  49  |   await expect(page.getByRole("group", { name: "Focus standard" })).toHaveCount(0);
  50  |
  51  |   await page.getByRole("button", { name: "Open Task and Feedback" }).click();
  52  |   const teaching = page.getByTestId("macro-depth-teaching");
  53  |   const taskView = page.getByTestId("learning-overlay-task-view");
  54  |   await expect(teaching).toHaveAttribute("data-stage", "wide-open");
  55  |   await expect(teaching).toHaveAttribute("data-focused-region", "middle");
  56  |   await expect(taskView).toContainText("three-dimensional subject");
  57  |   await expect(taskView).toContainText("Refocusing moves");
  58  |   await expect(taskView).not.toContainText("bellows travel");
  59  |
  60  |   const readGroundGlassGain = async () =>
  61  |     Number(await groundGlassRtt.getAttribute("data-rtt-ground-glass-illuminance-gain"));
  62  |   await expect.poll(readGroundGlassGain).toBeGreaterThan(0);
  63  |   const wideApertureGroundGlassGain = await readGroundGlassGain();
  64  |
  65  |   const panel = page.getByTestId("focus-distribution-panel");
  66  |   await expect(panel.locator("[data-focus-target-id]")).toHaveCount(3);
  67  |   for (const targetId of TARGET_IDS) {
  68  |     await expect(panel.locator(`[data-focus-target-id="${targetId}"]`)).toBeVisible();
  69  |   }
  70  |
  71  |   const wideScores = await readFocusDistributionScores(page, TARGET_IDS);
  72  |   expect(wideScores["macro-depth-middle"]).toBeGreaterThan(wideScores["macro-depth-near"]);
  73  |   expect(wideScores["macro-depth-middle"]).toBeGreaterThan(wideScores["macro-depth-far"]);
  74  |   expect(
  75  |     await panel.locator('[data-focus-target-id="macro-depth-middle"]').getAttribute("aria-label"),
  76  |   ).toMatch(/Sharp/);
  77  |   expect(
  78  |     await panel.locator('[data-focus-target-id="macro-depth-near"]').getAttribute("aria-label"),
  79  |   ).toMatch(/Soft/);
  80  |   expect(
  81  |     await panel.locator('[data-focus-target-id="macro-depth-far"]').getAttribute("aria-label"),
  82  |   ).toMatch(/Soft/);
  83  |
  84  |   await aperture.getByRole("radio", { name: "f/32" }).check();
  85  |   await expect(aperture).toHaveAttribute("data-selected-aperture", "32");
  86  |   await expect(teaching).toHaveAttribute("data-stage", "minimum-aperture");
  87  |   await expect(taskView).toContainText("remain Soft");
  88  |   await expect(taskView).toContainText("aperture alone cannot always cover");
  89  |   await expect.poll(readGroundGlassGain).toBeLessThan(wideApertureGroundGlassGain);
  90  |   await expect.poll(async () => {
  91  |     const scores = await readFocusDistributionScores(page, ["macro-depth-near", "macro-depth-far"]);
  92  |     return scores["macro-depth-near"] + scores["macro-depth-far"];
  93  |   }).toBeGreaterThan(wideScores["macro-depth-near"] + wideScores["macro-depth-far"]);
  94  |   const stoppedDownLabels = await Promise.all(
  95  |     TARGET_IDS.map((targetId) =>
  96  |       panel.locator(`[data-focus-target-id="${targetId}"]`).getAttribute("aria-label"),
  97  |     ),
  98  |   );
  99  |   expect(stoppedDownLabels.some((label) => label?.includes("Soft"))).toBe(true);
  100 |
  101 |   await aperture.getByRole("radio", { name: "f/5.6" }).check();
  102 |   await setPublicRangeInput(focus, 390);
  103 |   await expect(teaching).toHaveAttribute("data-stage", "wide-open");
  104 |   await expect(teaching).toHaveAttribute("data-focused-region", "near");
  105 |   const nearFocusScores = await readFocusDistributionScores(page, TARGET_IDS);
  106 |   expect(nearFocusScores["macro-depth-near"]).toBeGreaterThan(nearFocusScores["macro-depth-middle"]);
  107 |   expect(nearFocusScores["macro-depth-near"]).toBeGreaterThan(nearFocusScores["macro-depth-far"]);
  108 |
  109 |   await setPublicRangeInput(focus, 410);
  110 |   await expect(teaching).toHaveAttribute("data-focused-region", "far");
  111 |   const farFocusScores = await readFocusDistributionScores(page, TARGET_IDS);
  112 |   expect(farFocusScores["macro-depth-far"]).toBeGreaterThan(farFocusScores["macro-depth-near"]);
  113 |   expect(farFocusScores["macro-depth-far"]).toBeGreaterThan(farFocusScores["macro-depth-middle"]);
  114 |
  115 |   await setPublicRangeInput(focus, 360);
  116 |   await expect(teaching).toHaveAttribute("data-focused-region", "near");
  117 |   await expect(taskView).toContainText("Near detail is currently strongest");
  118 |
  119 |   await setPublicRangeInput(focus, 440);
  120 |   await expect(teaching).toHaveAttribute("data-focused-region", "far");
  121 |   await expect(taskView).toContainText("Far detail is currently strongest");
```