# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: macro-bellows-extension.spec.ts >> Macro 1 tracks canonical Image Circle growth and bellows exposure across focus
- Location: src/tests/e2e/macro-bellows-extension.spec.ts:72:1

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
  1   | import { expect, test, type Locator, type Page } from "@playwright/test";
  2   | import { setStepRangeInput } from "./helpers/stepRangeInput";
  3   | import { CAMERA_CONSTANTS } from "../../utils/constants";
  4   | 
  5   | const parseMmVector = (value: string | null): number[] => {
  6   |   const parsed = value?.split(",").map(Number) ?? [];
  7   |   if (parsed.length !== 3 || parsed.some((component) => !Number.isFinite(component))) {
  8   |     throw new Error(`Invalid millimetre vector: ${value}`);
  9   |   }
  10  |   return parsed;
  11  | };
  12  | 
  13  | const readFiniteAttribute = async (locator: Locator, name: string) => {
  14  |   const value = Number(await locator.getAttribute(name));
  15  |   expect(Number.isFinite(value), `${name} must be finite`).toBe(true);
  16  |   return value;
  17  | };
  18  | 
  19  | const collectBrowserErrors = (page: Page) => {
  20  |   const pageErrors: string[] = [];
  21  |   const consoleErrors: string[] = [];
  22  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  23  |   page.on("console", (message) => {
  24  |     if (message.type() === "error") consoleErrors.push(message.text());
  25  |   });
  26  |   return () => {
  27  |     expect(pageErrors).toEqual([]);
  28  |     expect(consoleErrors).toEqual([]);
  29  |   };
  30  | };
  31  | 
  32  | const readGroundGlassGain = async (rtt: Locator) =>
  33  |   Number(await rtt.getAttribute("data-rtt-ground-glass-illuminance-gain"));
  34  | 
  35  | const readGridSpacing = async (grid: Locator) => grid.evaluate((element) =>
  36  |   Number.parseFloat(getComputedStyle(element).backgroundSize.split(" ")[0]),
  37  | );
  38  | 
  39  | const readGridPhase = async (grid: Locator) => grid.evaluate((element) => {
  40  |   const rect = element.getBoundingClientRect();
  41  |   const [x = "0px", y = "0px"] = getComputedStyle(element).backgroundPosition.split(" ");
  42  |   return {
  43  |     x: Number.parseFloat(x),
  44  |     y: Number.parseFloat(y),
  45  |     width: rect.width,
  46  |     height: rect.height,
  47  |   };
  48  | });
  49  | 
  50  | const expectMacroCoverageState = async (
  51  |   scene: Locator,
  52  |   rtt: Locator,
  53  |   readout: Locator,
  54  |   expectedDiameterMm: number,
  55  | ) => {
  56  |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  57  |   await expect(scene).toHaveAttribute("data-image-circle-ray-count", "12");
  58  |   await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  59  |   await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  60  |   await expect(readout).toContainText(`${expectedDiameterMm.toFixed(1)} mm · simulator profile`);
  61  |   const [sceneRadiusMm, rttRadiusMm] = await Promise.all([
  62  |     readFiniteAttribute(scene, "data-image-circle-radius-mm"),
  63  |     readFiniteAttribute(rtt, "data-rtt-coverage-radius-mm"),
  64  |   ]);
  65  |   const filmCornerRadiusMm = Math.hypot(CAMERA_CONSTANTS.filmWidthMm / 2, CAMERA_CONSTANTS.filmHeightMm / 2);
  66  |   expect(sceneRadiusMm).toBeCloseTo(expectedDiameterMm / 2, 1);
  67  |   expect(sceneRadiusMm).toBeCloseTo(rttRadiusMm, 5);
  68  |   expect(sceneRadiusMm).toBeGreaterThan(filmCornerRadiusMm);
  69  |   return sceneRadiusMm;
  70  | };
  71  | 
  72  | test("Macro 1 tracks canonical Image Circle growth and bellows exposure across focus", async ({ page }) => {
  73  |   test.setTimeout(100_000);
  74  |   const expectNoBrowserErrors = collectBrowserErrors(page);
  75  | 
  76  |   await page.goto("/simulator/free/architecture-rise");
> 77  |   await expect(page.getByRole("button", { name: "Infinity Reset" })).toBeVisible();
      |                                                                      ^ Error: expect(locator).toBeVisible() failed
  78  |   await page.getByRole("button", { name: "Infinity Reset" }).click();
  79  |   await expect(page.getByText(/Focus: ∞/)).toBeVisible();
  80  | 
  81  |   // Preserve the cross-scene Infinity Focus initialization regression.
  82  |   await page.getByRole("link", { name: "All Scenes" }).click();
  83  |   await expect(page).toHaveURL(/\/scenes$/);
  84  |   await page.locator('a[href="/simulator/free/macro-bellows-extension"]').click();
  85  |   await expect(page).toHaveURL(/\/simulator\/free\/macro-bellows-extension$/);
  86  | 
  87  |   const sceneCanvas = page.getByTestId("scene-canvas");
  88  |   const groundGlassRtt = page.getByTestId("ground-glass-rtt");
  89  |   const readout = page.getByRole("region", { name: "Macro focus" });
  90  |   const focus = page.getByRole("slider", { name: "Focus distance" });
  91  |   const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  92  | 
  93  |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  94  |   await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-bellows-extension");
  95  |   await expect(focus).toHaveValue("900");
  96  |   await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  97  |   await expect(aperture).toBeEnabled();
  98  |   await expect(aperture.getByRole("radio")).toHaveCount(6);
  99  |   await expect(aperture.getByRole("radio", { name: "f/11" })).toBeEnabled();
  100 |   await expect(page.getByText("Aperture is fixed for this lesson", { exact: true })).toHaveCount(0);
  101 |   await expect(readout).toContainText("180.0 mm");
  102 |   await expect(readout).toContainText("0.20×");
  103 |   const initialCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 261.56);
  104 |   const initialFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  105 |   expect(initialFilmCenter[2]).toBeCloseTo(-180, 5);
  106 |   await expect(readout).toContainText("1:5");
  107 |   await expect(readout).toContainText("320.0 mm");
  108 |   await expect(readout).toContainText("Selected focus-plane magnification");
  109 | 
  110 |   const expectedInitialGain = ((11 / 5.6) ** 2) / 1.44;
  111 |   await expect.poll(() => readGroundGlassGain(groundGlassRtt)).toBeCloseTo(expectedInitialGain, 3);
  112 |   const initialGroundGlassGain = await readGroundGlassGain(groundGlassRtt);
  113 | 
  114 |   await page.getByRole("button", { name: "Open Task and Feedback" }).click();
  115 |   const taskView = page.getByTestId("learning-overlay-task-view");
  116 |   await expect(taskView).toContainText("261.6 mm");
  117 |   await expect(taskView).toContainText("current film plane");
  118 |   await expect(taskView).toContainText("separate from subject magnification");
  119 | 
  120 |   await setStepRangeInput(page, "Focus distance", 450);
  121 |   await expect(focus).toHaveValue("450");
  122 |   await expect(readout).toContainText("225.0 mm");
  123 |   await expect(readout).toContainText("0.50×");
  124 |   await expect(readout).toContainText("2.25×");
  125 |   await expect(readout).toContainText("+1.17 stops");
  126 |   const middleCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 326.94);
  127 |   expect(middleCircleRadiusMm).toBeGreaterThan(initialCircleRadiusMm);
  128 |   await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  129 |   const middleFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  130 |   expect(middleFilmCenter[2]).toBeCloseTo(-225, 5);
  131 |   await expect(taskView).toContainText("326.9 mm");
  132 |   await expect(taskView).toContainText("at a fixed aperture");
  133 |   const middleGroundGlassGain = await readGroundGlassGain(groundGlassRtt);
  134 |   expect(middleGroundGlassGain).toBeLessThan(initialGroundGlassGain);
  135 | 
  136 |   await setStepRangeInput(page, "Focus distance", 300);
  137 |   await expect(focus).toHaveValue("300");
  138 |   await expect(readout).toContainText("300.0 mm");
  139 |   await expect(readout).toContainText("1.00×");
  140 |   await expect(readout).toContainText("1:1");
  141 |   await expect(readout).toContainText("4.00×");
  142 |   await expect(readout).toContainText("+2.00 stops");
  143 |   await expect(readout).toContainText("Life-size reproduction reached (1:1)");
  144 |   await expect(readout).toContainText("specimen is now sharply reproduced");
  145 |   const finalCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 435.93);
  146 |   expect(finalCircleRadiusMm).toBeGreaterThan(middleCircleRadiusMm);
  147 |   await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  148 |   await expect(taskView).toContainText("435.9 mm");
  149 |   await expect(taskView).toContainText("rear standard moves farther from the lens");
  150 |   await expect(taskView).toContainText("carries the film plane with it");
  151 |   await expect(taskView).toContainText("4×5 film rectangle keeps the same physical dimensions");
  152 |   const finalFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  153 |   expect(finalFilmCenter[2]).toBeCloseTo(-300, 5);
  154 |   await expect.poll(() => readGroundGlassGain(groundGlassRtt)).toBeCloseTo(((11 / 5.6) ** 2) * 0.25, 3);
  155 |   expect(await readGroundGlassGain(groundGlassRtt)).toBeLessThan(initialGroundGlassGain);
  156 | 
  157 |   expectNoBrowserErrors();
  158 | });
  159 | 
  160 | test("Macro 1 keeps Ground Glass and scene rendering stable through auxiliary interactions", async ({ page }) => {
  161 |   test.setTimeout(75_000);
  162 |   const expectNoBrowserErrors = collectBrowserErrors(page);
  163 |   await page.goto("/simulator/free/macro-bellows-extension");
  164 | 
  165 |   const sceneCanvas = page.getByTestId("scene-canvas");
  166 |   const sceneWebglCanvas = sceneCanvas.locator("canvas");
  167 |   const groundGlassCanvas = page.locator(".groundglass-renderer-host canvas");
  168 |   const groundGlassRtt = page.getByTestId("ground-glass-rtt");
  169 |   const readout = page.getByRole("region", { name: "Macro focus" });
  170 |   const focus = page.getByRole("slider", { name: "Focus distance" });
  171 |   const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  172 |   const grid = page.getByTestId("ground-glass-grid");
  173 | 
  174 |   await expect(sceneWebglCanvas).toHaveCount(1);
  175 |   await expect(groundGlassCanvas).toHaveCount(1);
  176 |   await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-bellows-extension");
  177 |   await expect(focus).toHaveValue("900");
```