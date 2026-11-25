# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: camera-controls-compact.spec.ts >> Focus slider and Infinity Reset stay usable across rail widths
- Location: src/tests/e2e/camera-controls-compact.spec.ts:187:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.press: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('region', { name: 'Camera Controls' }).getByRole('button', { name: 'Infinity Reset' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - status
  - main [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - link "View Camera Simulator home" [ref=e8] [cursor=pointer]:
          - /url: /
          - img [ref=e9]
          - generic [ref=e10]: View Camera Simulator
        - generic [ref=e11]:
          - generic [ref=e12]: Architecture Rise
          - generic [ref=e13]: Free Exploration
        - generic [ref=e14]:
          - link "All Scenes" [ref=e15] [cursor=pointer]:
            - /url: /scenes
          - generic [ref=e16]:
            - text: Language
            - combobox "Language" [ref=e17]:
              - option "English" [selected]
              - option "繁體中文"
      - region "Simulator body" [ref=e18]:
        - main [ref=e19]:
          - generic [ref=e21]:
            - generic [ref=e22]:
              - generic [ref=e23]:
                - generic [ref=e25]: view_in_ar
                - heading "3D Scene" [level=2] [ref=e26]
              - generic [ref=e27]:
                - generic [ref=e29]:
                  - generic [ref=e30]:
                    - button "Reset 3D view" [ref=e31] [cursor=pointer]
                    - group "View Focus" [ref=e32]:
                      - generic [ref=e33]: View Focus
                      - generic [ref=e34]:
                        - button "Scene" [pressed] [ref=e35] [cursor=pointer]
                        - button "Camera" [ref=e36] [cursor=pointer]
                  - generic [ref=e37]:
                    - generic [ref=e38]: Render quality
                    - combobox "Render quality" [ref=e39]:
                      - option "High" [selected]
                      - option "Standard"
                      - option "Low"
                - generic [ref=e41]:
                  - button "Expand 3D Scene" [ref=e47] [cursor=pointer]:
                    - generic [ref=e48]: open_in_new
                  - button "View overlays" [ref=e50] [cursor=pointer]:
                    - generic [ref=e51]: layers
                    - generic [ref=e52]: View overlays
                    - generic [ref=e53]: ▾
                  - region "Task and Feedback":
                    - button "Open Task and Feedback" [ref=e54] [cursor=pointer]:
                      - generic [ref=e55]: Task and Feedback
            - generic "GroundGlassColumn" [ref=e56]:
              - generic [ref=e57]:
                - generic [ref=e59]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e60]
              - generic [ref=e61]:
                - generic [ref=e63]:
                  - group "Preview" [ref=e64]:
                    - generic [ref=e65]: Preview
                    - generic [ref=e67]:
                      - generic [ref=e68]:
                        - radio "Raw Ground Glass" [checked] [ref=e69]
                        - generic [ref=e70]: Raw Ground Glass
                      - generic [ref=e71]:
                        - radio "Upright Assist" [ref=e72]
                        - generic [ref=e73]: Upright Assist
                  - group "View Options" [ref=e74]:
                    - generic [ref=e75]: View Options
                    - region "View Options" [ref=e77]:
                      - generic [ref=e79]:
                        - checkbox "Grid" [checked] [ref=e80]
                        - generic [ref=e81]: Grid
                - generic "GroundGlassViewport" [ref=e82]:
                  - generic [ref=e84]:
                    - generic [ref=e85]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e86]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 8950.0 mm focus / CoC 0.002 mm (98%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e90] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e91]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e92] [cursor=pointer]:
                    - generic [ref=e93]: open_in_new
            - generic [ref=e95]:
              - generic [ref=e96]:
                - heading "2D Geometry" [level=2] [ref=e97]
                - generic [ref=e98]:
                  - group "Geometry view" [ref=e99]:
                    - button "Side" [pressed] [ref=e100] [cursor=pointer]
                    - button "Top" [ref=e101] [cursor=pointer]
                  - group "Geometry framing" [ref=e102]:
                    - button "Fit Scene" [pressed] [ref=e103] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e104] [cursor=pointer]:
                    - generic [ref=e105]: open_in_new
              - paragraph [ref=e106]: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e108]:
                - generic [ref=e109]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e110]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e111]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e112]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e113]
                  - generic [ref=e115]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e116]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e122]: Building mid facade
              - generic "Optical depth order" [ref=e124]:
                - generic [ref=e127]: Film 0 mm
                - generic [ref=e130]: Lens 153 mm
                - generic [ref=e133]: DOF limit 6.4 m
                - generic [ref=e136]: Focus 9.1 m
                - generic [ref=e139]: Far DOF > 13.3 m
            - region "Focus distribution · Focus" [ref=e141]:
              - generic [ref=e142]:
                - heading "Focus distribution" [level=4] [ref=e143]
                - 'generic "Ground Glass orientation: Raw" [ref=e144]': Raw
              - table "Focus distribution" [ref=e145]:
                - caption [ref=e146]: Focus distribution
                - rowgroup [ref=e147]:
                  - row [ref=e148]:
                    - cell [ref=e149]
                    - cell [ref=e150]
                    - cell [ref=e151]
                  - 'row "Centre Centre · Building mid facade: 98% · Sharp" [ref=e152]':
                    - cell [ref=e153]
                    - 'cell "Centre Centre · Building mid facade: 98% · Sharp" [ref=e154]':
                      - generic "Centre" [ref=e155]
                      - 'group "Centre · Building mid facade: 98% · Sharp" [ref=e157]':
                        - generic "Building mid facade" [ref=e159]
                        - generic [ref=e160]:
                          - text: 98%
                          - generic [ref=e161]: ✓
                    - cell [ref=e162]
                  - row [ref=e163]:
                    - cell [ref=e164]
                    - cell [ref=e165]
                    - cell [ref=e166]
          - group [ref=e169]:
            - generic "Optical Debug architecture-rise · parallel" [ref=e170] [cursor=pointer]:
              - generic [ref=e171]: Optical Debug
              - generic [ref=e172]: architecture-rise · parallel
        - complementary [ref=e173]:
          - generic [ref=e174]:
            - region "Camera Controls" [ref=e175]:
              - heading "Camera Controls" [level=3] [ref=e177]
              - generic [ref=e178]:
                - region "Movement" [ref=e180]:
                  - generic [ref=e181]:
                    - heading "Front standard" [level=4] [ref=e182]
                    - button "Help" [ref=e183] [cursor=pointer]:
                      - generic [ref=e184]: "?"
                  - generic [ref=e185]:
                    - generic [ref=e186]:
                      - generic [ref=e187]: Rise
                      - slider "Rise" [ref=e188]: "0"
                      - generic [ref=e189]: 0.0 mm
                    - generic [ref=e190]:
                      - generic [ref=e191]: Tilt
                      - slider "Tilt" [ref=e192]: "0"
                      - generic [ref=e193]: 0.0°
                    - generic [ref=e194]:
                      - generic [ref=e195]: Swing
                      - slider "Swing" [ref=e196]: "0"
                      - generic [ref=e197]: 0.0°
                - region "Focus" [ref=e199]:
                  - heading "Focus" [level=3] [ref=e200]
                  - generic [ref=e201]:
                    - generic [ref=e202]: Focus distance
                    - slider "Focus distance" [ref=e203]: "8950"
                    - generic [ref=e204]: 8950.0 mm
                    - button "Infinity Reset" [active] [ref=e206] [cursor=pointer]: ∞
                - region "Aperture" [ref=e208]:
                  - heading "Aperture" [level=3] [ref=e209]
                  - radiogroup "Aperture" [ref=e210]:
                    - generic [ref=e211] [cursor=pointer]:
                      - radio "f/5.6" [ref=e212]
                      - generic [ref=e213]: f/5.6
                    - generic [ref=e214] [cursor=pointer]:
                      - radio "f/8" [ref=e215]
                      - generic [ref=e216]: f/8
                    - generic [ref=e217] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e218]
                      - generic [ref=e219]: f/11
                    - generic [ref=e220] [cursor=pointer]:
                      - radio "f/16" [ref=e221]
                      - generic [ref=e222]: f/16
                    - generic [ref=e223] [cursor=pointer]:
                      - radio "f/22" [ref=e224]
                      - generic [ref=e225]: f/22
                    - generic [ref=e226] [cursor=pointer]:
                      - radio "f/32" [ref=e227]
                      - generic [ref=e228]: f/32
                - generic [ref=e229]:
                  - generic [ref=e230]: Reset
                  - region "Reset" [ref=e231]:
                    - button "Reset movements" [ref=e233] [cursor=pointer]
            - region "Developer Tools" [ref=e234]:
              - heading "Developer Tools" [level=3] [ref=e235]
              - generic [ref=e237]:
                - checkbox "Raw RTT — bypass DOF" [ref=e238]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
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
> 245 |     await infinityReset.press("Enter");
      |                         ^ Error: locator.press: Test timeout of 120000ms exceeded.
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
  258 |     await expect(macro).toBeVisible();
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