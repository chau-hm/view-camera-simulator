# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lens-catalog-ui.spec.ts >> lens catalog presentation stays readable and localized at desktop and tablet widths
- Location: src/tests/e2e/lens-catalog-ui.spec.ts:140:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('lens-control')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('lens-control')

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  48  |     await expect(lensControl).toHaveAttribute(
  49  |       "data-selected-lens-id",
  50  |       `simulator-parametric-${focalLengthMm}mm`,
  51  |     );
  52  |     await expect(lensControl).toHaveAttribute("data-selected-lens-coverage-kind", "angular");
  53  |     await expect(lensControl).toHaveAttribute(
  54  |       "data-selected-lens-image-circle-diameter-mm",
  55  |       /\d+\.\d{6}/,
  56  |     );
  57  |     await expect(lensControl.getByTestId("lens-control-coverage-value")).toHaveText(
  58  |       `${angle}° simulator coverage (teaching profile)`,
  59  |     );
  60  |     await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  61  |     await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  62  |     await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  63  |     await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  64  |     const physicalScale = await expectGroundGlassPhysicalScale(rtt);
  65  |     if (focalLengthMm === 90 || focalLengthMm === 150) {
  66  |       await page.getByTestId("scene-canvas").locator("canvas").screenshot({
  67  |         path: testInfo.outputPath(`understanding-camera-movements-${focalLengthMm}mm.png`),
  68  |       });
  69  |       const calibrationFile = `understanding-camera-movements-${focalLengthMm}mm-physical-blur-scale.json`;
  70  |       const calibrationRecord = { ...physicalScale, focalLengthMm };
  71  |       await testInfo.attach(calibrationFile, {
  72  |         body: JSON.stringify(calibrationRecord),
  73  |         contentType: "application/json",
  74  |       });
  75  |       await writeFile(
  76  |         testInfo.outputPath(calibrationFile),
  77  |         JSON.stringify(calibrationRecord, null, 2),
  78  |       );
  79  |     }
  80  |   }
  81  | 
  82  |   await standard.check();
  83  |   await expect(standard).toBeChecked();
  84  |   await expect(lensControl).toHaveAttribute(
  85  |     "data-selected-lens-id",
  86  |     "simulator-parametric-150mm",
  87  |   );
  88  |   await expect(lensControl).toHaveAttribute("data-selected-lens-coverage-kind", "angular");
  89  |   await expect(lensControl).toHaveAttribute(
  90  |     "data-selected-lens-image-circle-diameter-mm",
  91  |     /\d+\.\d{6}/,
  92  |   );
  93  |   await expect(lensControl.getByTestId("lens-control-coverage-value")).toHaveText(
  94  |     "72° simulator coverage (teaching profile)",
  95  |   );
  96  |   await expect(lensControl.getByTestId("lens-control-image-circle-label")).toHaveText(
  97  |     "Image circle",
  98  |   );
  99  |   await expect(lensControl.getByTestId("lens-control-image-circle-value")).toHaveText(/mm/);
  100 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  101 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  102 |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  103 |   await expect(scene).toHaveAttribute("data-image-circle-radius-mm", /\d+\.\d+/);
  104 | 
  105 |   await setStepRangeInput(page, "Tilt", 0.5);
  106 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  107 |   await expect(rtt).toHaveAttribute("data-rtt-natural-illumination-kind", "neutral");
  108 |   await expect(scene).toHaveAttribute("data-lens-coverage-kind", "nonparallel-conic");
  109 |   await expect(scene).not.toHaveAttribute("data-image-circle-radius-mm", /.+/);
  110 |   await expect(lensControl.getByTestId("lens-control-image-circle-label")).toHaveText(
  111 |     "Reference image circle",
  112 |   );
  113 |   await expect(lensControl.getByTestId("lens-control-image-circle-reference-note")).toContainText(
  114 |     "Coverage Footprint",
  115 |   );
  116 |   await expect(lensControl.getByTestId("lens-control-image-circle-value")).toHaveText(/mm/);
  117 |   await expect(lensControl).toHaveAttribute(
  118 |     "data-selected-lens-image-circle-diameter-mm",
  119 |     /\d+\.\d{6}/,
  120 |   );
  121 | 
  122 |   await setStepRangeInput(page, "Tilt", 0);
  123 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  124 |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  125 |   await expect(lensControl.getByTestId("lens-control-image-circle-label")).toHaveText(
  126 |     "Image circle",
  127 |   );
  128 |   await expect(lensControl.getByTestId("lens-control-image-circle-reference-note")).toHaveCount(0);
  129 | 
  130 |   await wide.check();
  131 |   await expect(wide).toBeChecked();
  132 |   await expect(lensControl).toHaveAttribute("data-selected-lens-id", "simulator-parametric-90mm");
  133 |   await expect(lensControl).toHaveAttribute("data-selected-lens-coverage-kind", "angular");
  134 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  135 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  136 |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  137 |   await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  138 | });
  139 | 
  140 | test("lens catalog presentation stays readable and localized at desktop and tablet widths", async ({ page }) => {
  141 |   for (const viewport of [
  142 |     { width: 1280, height: 800 },
  143 |     { width: 1024, height: 768 },
  144 |   ]) {
  145 |     await page.setViewportSize(viewport);
  146 |     await page.goto("/simulator/free/understanding-camera-movements");
  147 |     const lensControl = page.getByTestId("lens-control");
> 148 |     await expect(lensControl).toBeVisible();
      |                               ^ Error: expect(locator).toBeVisible() failed
  149 |     await expect(lensControl.getByRole("radio", { name: /90 mm.*Wide/ })).toBeVisible();
  150 |     await expect(lensControl.getByRole("radio", { name: /150 mm.*Standard/ })).toBeVisible();
  151 |     const bounds = await lensControl.boundingBox();
  152 |     expect(bounds).not.toBeNull();
  153 |     expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  154 |   }
  155 | 
  156 |   await page.getByRole("combobox", { name: "Language" }).selectOption("zh-HK");
  157 |   const localizedLensControl = page.getByTestId("lens-control");
  158 |   await expect(localizedLensControl).toBeVisible();
  159 |   await expect(page.getByRole("combobox", { name: "語言" })).toHaveValue("zh-HK");
  160 |   await expect(localizedLensControl.getByRole("radiogroup", { name: "鏡頭選項" })).toBeVisible();
  161 |   await expect(
  162 |     localizedLensControl.getByRole("radio", {
  163 |       name: /90 mm.*廣角.*鏡頭成像範圍: 100\.9° 模擬成像範圍（教學模型）/,
  164 |     }),
  165 |   ).toBeVisible();
  166 |   await expect(
  167 |     localizedLensControl.getByRole("radio", {
  168 |       name: /150 mm.*標準.*鏡頭成像範圍: 72° 模擬成像範圍（教學模型）/,
  169 |     }),
  170 |   ).toBeVisible();
  171 |   await expect(localizedLensControl.getByTestId("lens-control-coverage-value")).toHaveText(
  172 |     "100.9° 模擬成像範圍（教學模型）",
  173 |   );
  174 | });
  175 | 
```