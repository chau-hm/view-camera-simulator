# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: camera-controls-compact.spec.ts >> Macro Focus stays in the lower controls rail at landscape widths
- Location: src/tests/e2e/camera-controls-compact.spec.ts:249:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: 'Macro focus' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('region', { name: 'Macro focus' })

```

```yaml
- status
- main:
  - link "View Camera Simulator home":
    - /url: /
    - text: View Camera Simulator
  - text: 1:1 Flat Subject Free Exploration
  - link "All Scenes":
    - /url: /scenes
  - text: Language
  - combobox "Language":
    - option "English" [selected]
    - option "繁體中文"
  - region "Simulator body":
    - main:
      - heading "3D Scene" [level=2]
      - button "Reset 3D view"
      - group "View Focus":
        - text: View Focus
        - button "Scene" [pressed]
        - button "Camera"
      - text: Render quality
      - combobox "Render quality":
        - option "High" [selected]
        - option "Standard"
        - option "Low"
      - button "Expand 3D Scene"
      - button "View overlays"
      - region "Task and Feedback":
        - button "Open Task and Feedback": Task and Feedback
      - heading "Ground Glass" [level=2]
      - group "Preview":
        - text: Preview
        - radio "Raw Ground Glass" [checked]
        - text: Raw Ground Glass
        - radio "Upright Assist"
        - text: Upright Assist
      - group "View Options":
        - text: View Options
        - region "View Options":
          - checkbox "Grid" [checked]
          - text: Grid
      - button "Focus loupe · 4× Ground Glass": Ground glass preview 2000.0 mm focus / CoC 0.857 mm (0%)
      - button "Focus loupe · 4× Ground Glass view": Focus loupe · 4×
      - text: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
      - button "Expand Ground Glass"
      - heading "2D Geometry" [level=2]
      - group "Geometry view":
        - button "Side" [pressed]
        - button "Top"
      - group "Geometry framing":
        - button "Fit Scene" [pressed]
      - button "Expand 2D Geometry"
      - paragraph: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
      - img: Optical axis Building mid facade
      - text: Film 0 mm Lens 162 mm DOF limit 2.0 m Focus 2.2 m Far DOF 2.4 m
      - region "Focus distribution · Focus":
        - heading "Focus distribution" [level=4]
        - text: Raw
        - table "Focus distribution":
          - caption: Focus distribution
          - rowgroup:
            - row
            - 'row "Centre Centre · Building mid facade: 0% · Soft"':
              - 'cell "Centre Centre · Building mid facade: 0% · Soft"':
                - text: Centre
                - 'group "Centre · Building mid facade: 0% · Soft"': Building mid facade 0%
            - row
      - group: Optical Debug architecture-rise · parallel
    - complementary:
      - region "Camera Controls":
        - heading "Camera Controls" [level=3]
        - region "Movement":
          - heading "Front standard" [level=4]
          - button "Help"
          - text: Rise
          - slider "Rise": "0"
          - text: Tilt
          - slider "Tilt": "0"
          - text: Swing
          - slider "Swing": "0"
        - region "Focus":
          - heading "Focus" [level=3]
          - text: Focus distance
          - slider "Focus distance": "3090"
          - button "Infinity Reset": ∞
        - region "Aperture":
          - heading "Aperture" [level=3]
          - radiogroup "Aperture":
            - radio "f/5.6"
            - text: f/5.6
            - radio "f/8"
            - text: f/8
            - radio "f/11" [checked]
            - text: f/11
            - radio "f/16"
            - text: f/16
            - radio "f/22"
            - text: f/22
            - radio "f/32"
            - text: f/32
        - text: Reset
        - region "Reset":
          - button "Reset movements"
          - button "Restart task"
      - region "Developer Tools":
        - heading "Developer Tools" [level=3]
        - checkbox "Raw RTT — bypass DOF"
        - text: Raw RTT — bypass DOF
```

# Test source

```ts
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
  179 |         return { left: rect.left, right: rect.right, width: rect.width };
  180 |       }),
  181 |     );
  182 |     expect(Math.min(...apertureOptions.map((option) => option.width))).toBeGreaterThanOrEqual(48);
  183 |     expect(apertureOptions.every(({ left, right }) => left >= railBounds.left - 1 && right <= railBounds.right + 1)).toBe(true);
  184 |   }
  185 | });
  186 | 
  187 | test("Focus slider and Infinity Reset stay usable across rail widths", async ({ page }) => {
  188 |   test.setTimeout(120_000);
  189 |   await page.goto("/simulator/free/architecture-rise");
  190 |   for (const viewport of [
  191 |     { width: 1133, height: 800 },
  192 |     { width: 1024, height: 768 },
  193 |     { width: 860, height: 768 },
  194 |     { width: 390, height: 844 },
  195 |     { width: 1499, height: 900 },
  196 |     { width: 1500, height: 900 },
  197 |     { width: 1501, height: 900 },
  198 |     { width: 1600, height: 900 },
  199 |     { width: 1900, height: 900 },
  200 |   ]) {
  201 |     await page.setViewportSize(viewport);
  202 | 
  203 |     const controls = page.getByRole("region", { name: "Camera Controls" });
  204 |     const rail = page.locator(".simulator-aside__scroll");
  205 |     const focus = controls.getByRole("slider", { name: "Focus distance" });
  206 |     const infinityReset = controls.getByRole("button", { name: "Infinity Reset" });
  207 |     await expect(focus).toBeVisible();
  208 |     await expect(infinityReset).toBeVisible();
  209 | 
  210 |     const layout = await rail.evaluate((element) => {
  211 |       const railRect = element.getBoundingClientRect();
  212 |       const row = element.querySelector<HTMLElement>(".focus-control .compact-range-row");
  213 |       const slider = row?.querySelector<HTMLInputElement>(".compact-range-row__slider");
  214 |       const value = row?.querySelector<HTMLElement>(".compact-range-row__value");
  215 |       const trailing = row?.querySelector<HTMLElement>(".compact-range-row__trailing");
  216 |       if (!row || !slider || !value || !trailing) throw new Error("Focus control bounds unavailable");
  217 |       const rowRect = row.getBoundingClientRect();
  218 |       const sliderRect = slider.getBoundingClientRect();
  219 |       const valueRect = value.getBoundingClientRect();
  220 |       const trailingRect = trailing.getBoundingClientRect();
  221 |       return {
  222 |         rail: { left: railRect.left, right: railRect.right, width: railRect.width },
  223 |         row: { right: rowRect.right, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth },
  224 |         slider: { left: sliderRect.left, right: sliderRect.right, width: sliderRect.width },
  225 |         value: { left: valueRect.left, right: valueRect.right },
  226 |         trailing: { left: trailingRect.left, right: trailingRect.right, width: trailingRect.width },
  227 |       };
  228 |     });
  229 |     const minimumUsefulTrackWidth = Math.min(160, layout.rail.width * 0.6);
  230 | 
  231 |     expect(layout.row.right).toBeLessThanOrEqual(layout.rail.right + 1);
  232 |     expect(layout.row.scrollWidth).toBeLessThanOrEqual(layout.row.clientWidth + 1);
  233 |     expect(layout.slider.left).toBeGreaterThanOrEqual(layout.rail.left - 1);
  234 |     expect(layout.slider.right).toBeLessThanOrEqual(layout.rail.right + 1);
  235 |     expect(layout.slider.width).toBeGreaterThanOrEqual(minimumUsefulTrackWidth);
  236 |     expect(layout.value.right).toBeLessThanOrEqual(layout.trailing.left);
  237 |     expect(layout.trailing.width).toBeGreaterThan(0);
  238 | 
  239 |     const focusBefore = await focus.inputValue();
  240 |     await focus.focus();
  241 |     await focus.press("ArrowRight");
  242 |     await expect(focus).not.toHaveValue(focusBefore);
  243 |     await infinityReset.focus();
  244 |     await expect(infinityReset).toBeFocused();
  245 |     await infinityReset.press("Enter");
  246 |   }
  247 | });
  248 | 
  249 | test("Macro Focus stays in the lower controls rail at landscape widths", async ({ page }) => {
  250 |   for (const viewport of [
  251 |     { width: 1440, height: 900 },
  252 |     { width: 1024, height: 768 },
  253 |   ]) {
  254 |     await page.setViewportSize(viewport);
  255 |     await page.goto("/simulator/free/macro-bellows-extension");
  256 | 
  257 |     const macro = page.getByRole("region", { name: "Macro focus" });
> 258 |     await expect(macro).toBeVisible();
      |                         ^ Error: expect(locator).toBeVisible() failed
  259 |     await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();
  260 | 
  261 |     const placement = await page.evaluate(() => {
  262 |       const macro = document.querySelector<HTMLElement>(".macro-focus-readout");
  263 |       const aside = document.querySelector<HTMLElement>(".simulator-aside");
  264 |       const scroll = document.querySelector<HTMLElement>(".simulator-aside__scroll");
  265 |       const metricGrid = macro?.querySelector<HTMLElement>("dl");
  266 |       if (!macro || !aside || !scroll || !metricGrid) {
  267 |         throw new Error("Macro Focus placement unavailable");
  268 |       }
  269 |       const macroBounds = macro.getBoundingClientRect();
  270 |       const asideBounds = aside.getBoundingClientRect();
  271 |       const scrollBounds = scroll.getBoundingClientRect();
  272 |       return {
  273 |         insideAside: Boolean(macro.closest(".simulator-aside")),
  274 |         macroTop: macroBounds.top,
  275 |         macroBottom: macroBounds.bottom,
  276 |         asideBottom: asideBounds.bottom,
  277 |         scrollBottom: scrollBounds.bottom,
  278 |         scrollOverflowY: getComputedStyle(scroll).overflowY,
  279 |         macroScrollWidth: macro.scrollWidth,
  280 |         macroClientWidth: macro.clientWidth,
  281 |         metricColumns: getComputedStyle(metricGrid).gridTemplateColumns.trim().split(/\s+/),
  282 |       };
  283 |     });
  284 | 
  285 |     expect(placement.insideAside).toBe(true);
  286 |     expect(placement.macroTop).toBeGreaterThan(placement.scrollBottom);
  287 |     expect(placement.macroBottom).toBeLessThanOrEqual(placement.asideBottom + 1);
  288 |     expect(placement.scrollOverflowY).toBe("auto");
  289 |     expect(placement.macroScrollWidth).toBeLessThanOrEqual(placement.macroClientWidth);
  290 |     expect(placement.metricColumns).toHaveLength(2);
  291 |   }
  292 | });
  293 | 
```