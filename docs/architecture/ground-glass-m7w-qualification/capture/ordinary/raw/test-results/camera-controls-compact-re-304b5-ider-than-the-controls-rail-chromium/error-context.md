# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: camera-controls-compact.spec.ts >> responsive workspace keeps the primary simulator wider than the controls rail
- Location: src/tests/e2e/camera-controls-compact.spec.ts:70:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.waitFor: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.scene-toolbar') to be visible

```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   |
  3   | test("compact common camera controls stay usable at desktop and narrow widths", async ({ page }) => {
  4   |   for (const viewport of [
  5   |     { width: 1280, height: 800 },
  6   |     { width: 390, height: 844 },
  7   |   ]) {
  8   |     await page.setViewportSize(viewport);
  9   |     await page.goto("/simulator/free/architecture-foreground");
  10  |
  11  |     const controls = page.getByRole("region", { name: "Camera Controls" });
  12  |     await controls.scrollIntoViewIfNeeded();
  13  |     await expect(controls.getByRole("heading", { name: "Front standard" })).toBeVisible();
  14  |
  15  |     const workspaceLayout = await page.locator(".simulator-body").evaluate((element) => {
  16  |       const styles = getComputedStyle(element);
  17  |       const main = element.querySelector<HTMLElement>(".simulator-main")?.getBoundingClientRect();
  18  |       const aside = element.querySelector<HTMLElement>(".simulator-aside")?.getBoundingClientRect();
  19  |       return {
  20  |         gridTemplateColumns: styles.gridTemplateColumns,
  21  |         gridTemplateRows: styles.gridTemplateRows,
  22  |         main,
  23  |         aside,
  24  |       };
  25  |     });
  26  |     expect(workspaceLayout.gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
  27  |     expect(workspaceLayout.gridTemplateRows.trim().split(/\s+/)).toHaveLength(1);
  28  |     expect(workspaceLayout.main).not.toBeNull();
  29  |     expect(workspaceLayout.aside).not.toBeNull();
  30  |     expect(workspaceLayout.aside!.left).toBeGreaterThanOrEqual(workspaceLayout.main!.right - 1);
  31  |     expect(Math.abs(workspaceLayout.aside!.top - workspaceLayout.main!.top)).toBeLessThanOrEqual(1);
  32  |
  33  |     const movement = controls.getByRole("region", { name: "Movement" });
  34  |     await expect(movement.getByRole("slider")).toHaveCount(3);
  35  |     await expect(movement.getByRole("slider", { name: /rear/i })).toHaveCount(0);
  36  |
  37  |     const tilt = movement.getByRole("slider", { name: "Tilt" });
  38  |     await tilt.fill("3.2");
  39  |     await expect(tilt).toHaveValue("3.2");
  40  |     await expect(movement.locator(".compact-range-row").nth(1).locator(".compact-range-row__value")).toHaveText("3.2°");
  41  |
  42  |     const aperture = controls.getByRole("radiogroup", { name: "Aperture" });
  43  |     await expect(aperture.getByRole("radio")).toHaveCount(6);
  44  |     await expect(aperture.getByRole("radio", { name: "f/16" })).toBeVisible();
  45  |
  46  |     const railLayout = await controls.evaluate((element) => {
  47  |       const rail = element.getBoundingClientRect();
  48  |       return {
  49  |         right: rail.right,
  50  |         scrollWidth: element.scrollWidth,
  51  |         clientWidth: element.clientWidth,
  52  |       };
  53  |     });
  54  |     expect(railLayout.scrollWidth).toBeLessThanOrEqual(railLayout.clientWidth);
  55  |
  56  |     const asideBounds = await page.locator(".simulator-aside").evaluate((element) => {
  57  |       const rect = element.getBoundingClientRect();
  58  |       return { left: rect.left, right: rect.right };
  59  |     });
  60  |     const rects = await controls.locator(".compact-range-row, .aperture-control__option").evaluateAll(
  61  |       (elements) => elements.map((element) => {
  62  |         const rect = element.getBoundingClientRect();
  63  |         return { left: rect.left, right: rect.right };
  64  |       }),
  65  |     );
  66  |     expect(rects.every(({ left, right }) => left >= asideBounds.left - 1 && right <= asideBounds.right + 1)).toBe(true);
  67  |   }
  68  | });
  69  |
  70  | test("responsive workspace keeps the primary simulator wider than the controls rail", async ({ page }) => {
  71  |   for (const { viewport, maxToolbarHeight } of [
  72  |     { viewport: { width: 1440, height: 900 }, maxToolbarHeight: 40 },
  73  |     { viewport: { width: 1280, height: 800 }, maxToolbarHeight: 40 },
  74  |     { viewport: { width: 1024, height: 768 }, maxToolbarHeight: 80 },
  75  |   ]) {
  76  |     await page.setViewportSize(viewport);
  77  |     await page.goto("/simulator/free/architecture-rise");
> 78  |     await page.locator(".scene-toolbar").waitFor();
      |                                          ^ Error: locator.waitFor: Test timeout of 30000ms exceeded.
  79  |
  80  |     const layout = await page.locator(".simulator-body").evaluate((element) => {
  81  |       const main = element.querySelector<HTMLElement>(".simulator-main")?.getBoundingClientRect();
  82  |       const aside = element.querySelector<HTMLElement>(".simulator-aside")?.getBoundingClientRect();
  83  |       const sceneToolbar = element.querySelector<HTMLElement>(".scene-toolbar")?.getBoundingClientRect();
  84  |       const groundGlassToolbar = element.querySelector<HTMLElement>(".groundglass-control-groups")?.getBoundingClientRect();
  85  |       if (!main || !aside || !sceneToolbar || !groundGlassToolbar) {
  86  |         throw new Error("Responsive workspace bounds unavailable");
  87  |       }
  88  |       return {
  89  |         mainWidth: main.width,
  90  |         asideWidth: aside.width,
  91  |         sceneToolbarHeight: sceneToolbar.height,
  92  |         groundGlassToolbarHeight: groundGlassToolbar.height,
  93  |       };
  94  |     });
  95  |
  96  |     expect(layout.asideWidth).toBeLessThan(layout.mainWidth);
  97  |     expect(layout.asideWidth).toBeLessThan(viewport.width * 0.31);
  98  |     expect(layout.sceneToolbarHeight).toBeLessThanOrEqual(maxToolbarHeight);
  99  |     expect(layout.groundGlassToolbarHeight).toBeLessThanOrEqual(maxToolbarHeight);
  100 |   }
  101 | });
  102 |
  103 | test("camera control rows keep useful rendered tracks across rail widths", {
  104 |   tag: "@m7j-renderer-contention",
  105 | }, async ({ page }) => {
  106 |   test.setTimeout(120_000);
  107 |   await page.goto("/simulator/free/architecture-foreground");
  108 |   for (const viewport of [
  109 |     { width: 1440, height: 900 },
  110 |     { width: 1280, height: 800 },
  111 |     { width: 1133, height: 800 },
  112 |     { width: 1024, height: 768 },
  113 |     { width: 860, height: 768 },
  114 |     { width: 390, height: 844 },
  115 |     { width: 1499, height: 900 },
  116 |     { width: 1500, height: 900 },
  117 |     { width: 1501, height: 900 },
  118 |     { width: 1600, height: 900 },
  119 |     { width: 1900, height: 900 },
  120 |   ]) {
  121 |     await page.setViewportSize(viewport);
  122 |
  123 |     const controls = page.getByRole("region", { name: "Camera Controls" });
  124 |     const rail = page.locator(".simulator-aside__scroll");
  125 |     await expect(controls).toBeVisible();
  126 |     await expect(controls.getByRole("slider", { name: "Rise" })).toBeEnabled();
  127 |     await expect(controls.getByRole("slider", { name: "Tilt" })).toBeEnabled();
  128 |     await expect(controls.getByRole("slider", { name: "Swing" })).toBeVisible();
  129 |
  130 |     const railBounds = await rail.evaluate((element) => {
  131 |       const rect = element.getBoundingClientRect();
  132 |       return {
  133 |         left: rect.left,
  134 |         right: rect.right,
  135 |         width: rect.width,
  136 |         scrollWidth: element.scrollWidth,
  137 |         clientWidth: element.clientWidth,
  138 |       };
  139 |     });
  140 |     const minimumUsefulTrackWidth = Math.min(160, railBounds.width * 0.6);
  141 |     const rows = await controls.locator(".movement-controls__rows .compact-range-row").evaluateAll(
  142 |       (elements) => elements.map((element) => {
  143 |         const row = element.getBoundingClientRect();
  144 |         const label = element.querySelector<HTMLElement>(".compact-range-row__label")?.getBoundingClientRect();
  145 |         const slider = element.querySelector<HTMLInputElement>(".compact-range-row__slider")?.getBoundingClientRect();
  146 |         const value = element.querySelector<HTMLElement>(".compact-range-row__value")?.getBoundingClientRect();
  147 |         if (!label || !slider || !value) throw new Error("Movement control bounds unavailable");
  148 |         return {
  149 |           row: { left: row.left, right: row.right, width: row.width },
  150 |           label: { width: label.width },
  151 |           slider: { left: slider.left, right: slider.right, width: slider.width },
  152 |           value: { left: value.left, right: value.right, width: value.width },
  153 |         };
  154 |       }),
  155 |     );
  156 |
  157 |     expect(rows).toHaveLength(3);
  158 |     expect(railBounds.scrollWidth).toBeLessThanOrEqual(railBounds.clientWidth + 1);
  159 |     for (const row of rows) {
  160 |       expect(row.row.right).toBeLessThanOrEqual(railBounds.right + 1);
  161 |       expect(row.label.width).toBeGreaterThan(0);
  162 |       expect(row.value.width).toBeGreaterThan(0);
  163 |       expect(row.slider.left).toBeGreaterThanOrEqual(railBounds.left - 1);
  164 |       expect(row.slider.right).toBeLessThanOrEqual(railBounds.right + 1);
  165 |       expect(row.slider.width).toBeGreaterThanOrEqual(minimumUsefulTrackWidth);
  166 |     }
  167 |
  168 |     const tilt = controls.getByRole("slider", { name: "Tilt" });
  169 |     const tiltBefore = await tilt.inputValue();
  170 |     await tilt.focus();
  171 |     await tilt.press("ArrowRight");
  172 |     await expect(tilt).not.toHaveValue(tiltBefore);
  173 |
  174 |     const aperture = controls.getByRole("radiogroup", { name: "Aperture" });
  175 |     await expect(aperture.getByRole("radio")).toHaveCount(6);
  176 |     const apertureOptions = await aperture.locator(".aperture-control__option").evaluateAll(
  177 |       (elements) => elements.map((element) => {
  178 |         const rect = element.getBoundingClientRect();
```