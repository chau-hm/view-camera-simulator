# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: groundglass-interaction.spec.ts >> Ground Glass interaction >> Architecture Rise: off-center anchor, drag pan, short-click preservation, and immediate re-zoom
- Location: src/tests/e2e/groundglass-interaction.spec.ts:169:3

# Error details

```
Error: Test timeout of 120000ms exceeded
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
                  - region "Task and Feedback" [ref=e54]:
                    - generic [ref=e55]:
                      - group "Task and Feedback views" [ref=e57]:
                        - button "Task" [pressed] [ref=e58] [cursor=pointer]
                        - button "Feedback" [ref=e59] [cursor=pointer]
                      - generic "Task" [ref=e61]:
                        - region "Task" [ref=e62]:
                          - generic [ref=e63]:
                            - generic [ref=e65]: Free practice
                            - paragraph [ref=e66]: Explore how Front Rise changes framing while the camera remains level and the whole-camera viewpoint stays fixed.
                            - list [ref=e67]:
                              - listitem [ref=e68]: Increase Front Rise to include more of the building.
                              - listitem [ref=e69]: Keep the camera body and intended film-plane orientation level; watch the parallel verticals.
                              - listitem [ref=e70]: Adjust Focus and Aperture to compare sharpness and depth of field.
            - generic "GroundGlassColumn" [ref=e71]:
              - generic [ref=e72]:
                - generic [ref=e74]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e75]
              - generic [ref=e76]:
                - generic [ref=e78]:
                  - group "Preview" [ref=e79]:
                    - generic [ref=e80]: Preview
                    - generic [ref=e82]:
                      - generic [ref=e83]:
                        - radio "Raw Ground Glass" [checked] [ref=e84]
                        - generic [ref=e85]: Raw Ground Glass
                      - generic [ref=e86]:
                        - radio "Upright Assist" [ref=e87]
                        - generic [ref=e88]: Upright Assist
                  - group "View Options" [ref=e89]:
                    - generic [ref=e90]: View Options
                    - region "View Options" [ref=e92]:
                      - generic [ref=e94]:
                        - checkbox "Grid" [checked] [ref=e95]
                        - generic [ref=e96]: Grid
                - generic "GroundGlassViewport" [ref=e97]:
                  - generic [ref=e99]:
                    - generic [ref=e100]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e101]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 8890.0 mm focus / CoC 0.000 mm (100%)
                      - button "Focus loupe · 4× Ground Glass view" [active] [ref=e105] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e106]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e107] [cursor=pointer]:
                    - generic [ref=e108]: open_in_new
            - generic [ref=e110]:
              - generic [ref=e111]:
                - heading "2D Geometry" [level=2] [ref=e112]
                - generic [ref=e113]:
                  - group "Geometry view" [ref=e114]:
                    - button "Side" [pressed] [ref=e115] [cursor=pointer]
                    - button "Top" [ref=e116] [cursor=pointer]
                  - group "Geometry framing" [ref=e117]:
                    - button "Fit Scene" [pressed] [ref=e118] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e119] [cursor=pointer]:
                    - generic [ref=e120]: open_in_new
              - paragraph [ref=e121]: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e123]:
                - generic [ref=e124]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e125]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e126]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e127]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e128]
                  - generic [ref=e130]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e131]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e137]: Building mid facade
              - generic "Optical depth order" [ref=e139]:
                - generic [ref=e142]: Film 0 mm
                - generic [ref=e145]: Lens 153 mm
                - generic [ref=e148]: DOF limit 6.4 m
                - generic [ref=e151]: Focus 9.0 m
                - generic [ref=e154]: Far DOF > 13.3 m
            - region "Focus distribution · Focus" [ref=e156]:
              - generic [ref=e157]:
                - heading "Focus distribution" [level=4] [ref=e158]
                - 'generic "Ground Glass orientation: Raw" [ref=e159]': Raw
              - table "Focus distribution" [ref=e160]:
                - caption [ref=e161]: Focus distribution
                - rowgroup [ref=e162]:
                  - row [ref=e163]:
                    - cell [ref=e164]
                    - cell [ref=e165]
                    - cell [ref=e166]
                  - 'row "Centre Centre · Building mid facade: 100% · Sharp" [ref=e167]':
                    - cell [ref=e168]
                    - 'cell "Centre Centre · Building mid facade: 100% · Sharp" [ref=e169]':
                      - generic "Centre" [ref=e170]
                      - 'group "Centre · Building mid facade: 100% · Sharp" [ref=e172]':
                        - generic "Building mid facade" [ref=e174]
                        - generic [ref=e175]:
                          - text: 100%
                          - generic [ref=e176]: ✓
                    - cell [ref=e177]
                  - row [ref=e178]:
                    - cell [ref=e179]
                    - cell [ref=e180]
                    - cell [ref=e181]
          - group [ref=e184]:
            - generic "Optical Debug architecture-rise · parallel" [ref=e185] [cursor=pointer]:
              - generic [ref=e186]: Optical Debug
              - generic [ref=e187]: architecture-rise · parallel
        - complementary [ref=e188]:
          - generic [ref=e189]:
            - region "Camera Controls" [ref=e190]:
              - heading "Camera Controls" [level=3] [ref=e192]
              - generic [ref=e193]:
                - region "Movement" [ref=e195]:
                  - generic [ref=e196]:
                    - heading "Front standard" [level=4] [ref=e197]
                    - button "Help" [ref=e198] [cursor=pointer]:
                      - generic [ref=e199]: "?"
                  - generic [ref=e200]:
                    - generic [ref=e201]:
                      - generic [ref=e202]: Rise
                      - slider "Rise" [ref=e203]: "0"
                      - generic [ref=e204]: 0.0 mm
                    - generic [ref=e205]:
                      - generic [ref=e206]: Tilt
                      - slider "Tilt" [ref=e207]: "0"
                      - generic [ref=e208]: 0.0°
                    - generic [ref=e209]:
                      - generic [ref=e210]: Swing
                      - slider "Swing" [ref=e211]: "0"
                      - generic [ref=e212]: 0.0°
                - region "Focus" [ref=e214]:
                  - heading "Focus" [level=3] [ref=e215]
                  - generic [ref=e216]:
                    - generic [ref=e217]: Focus distance
                    - slider "Focus distance" [ref=e218]: "8890"
                    - generic [ref=e219]: 8890.0 mm
                    - button "Infinity Reset" [ref=e221] [cursor=pointer]: ∞
                - region "Aperture" [ref=e223]:
                  - heading "Aperture" [level=3] [ref=e224]
                  - radiogroup "Aperture" [ref=e225]:
                    - generic [ref=e226] [cursor=pointer]:
                      - radio "f/5.6" [ref=e227]
                      - generic [ref=e228]: f/5.6
                    - generic [ref=e229] [cursor=pointer]:
                      - radio "f/8" [ref=e230]
                      - generic [ref=e231]: f/8
                    - generic [ref=e232] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e233]
                      - generic [ref=e234]: f/11
                    - generic [ref=e235] [cursor=pointer]:
                      - radio "f/16" [ref=e236]
                      - generic [ref=e237]: f/16
                    - generic [ref=e238] [cursor=pointer]:
                      - radio "f/22" [ref=e239]
                      - generic [ref=e240]: f/22
                    - generic [ref=e241] [cursor=pointer]:
                      - radio "f/32" [ref=e242]
                      - generic [ref=e243]: f/32
                - generic [ref=e244]:
                  - generic [ref=e245]: Reset
                  - region "Reset" [ref=e246]:
                    - button "Reset movements" [ref=e248] [cursor=pointer]
            - region "Developer Tools" [ref=e249]:
              - heading "Developer Tools" [level=3] [ref=e250]
              - generic [ref=e252]:
                - checkbox "Raw RTT — bypass DOF" [ref=e253]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  177 |     await expect(rtt).toHaveAttribute('data-renderer-generation', /generation-\d+$/, { timeout: 60_000 });
  178 |     const initialHostGeneration = await rtt.getAttribute('data-renderer-generation');
  179 |
  180 |     const stage = viewport.locator('[data-zoomed]');
  181 |     await expect(stage).toBeVisible();
  182 |     await expect(stage).toHaveAttribute('role', 'button');
  183 |
  184 |     const transformedLayer = transformedLayerFor(viewport);
  185 |
  186 |     // Place the pointer at a known fraction of the actual image/client box.
  187 |     // The measured DOM content coordinates are an independent browser oracle.
  188 |     const clientBox = await readStageClientBox(stage);
  189 |     const clickX = clientBox.left + clientBox.width * 0.25;
  190 |     const clickY = clientBox.top + clientBox.height * 0.25;
  191 |     await page.mouse.click(clickX, clickY);
  192 |
  193 |     // state change
  194 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  195 |     await expect(stage).toHaveAttribute('aria-label', 'Pan Ground Glass');
  196 |     await expect(stage).toHaveAttribute('role', 'region');
  197 |     await expect(viewport.getByRole('region', { name: 'Pan Ground Glass', exact: true })).toHaveCount(1);
  198 |     await expect(viewport.getByRole('button', { name: 'Pan Ground Glass', exact: true })).toHaveCount(0);
  199 |     await expect.poll(async () => Number(await stage.getAttribute('data-normalized-pan-x'))).toBeCloseTo(0.5, 5);
  200 |     await expect.poll(async () => Number(await stage.getAttribute('data-normalized-pan-y'))).toBeCloseTo(0.5, 5);
  201 |
  202 |     // RTT loupe keeps the CSS image at identity; the physical crop is exposed
  203 |     // through the inspection-window diagnostics instead.
  204 |     await expect.poll(async () => {
  205 |       const cssScale = Number(await stage.getAttribute('data-presentation-css-scale'));
  206 |       const centerU = Number(await stage.getAttribute('data-focus-loupe-center-u'));
  207 |       const centerV = Number(await stage.getAttribute('data-focus-loupe-center-v'));
  208 |       return cssScale === 1 && centerU < 0.5 && centerV < 0.5;
  209 |     }, { timeout: 8000 }).toBeTruthy();
  210 |
  211 |     // store pre-drag transform
  212 |     const preInspectionPan = {
  213 |       x: await stage.getAttribute('data-inspection-pan-x'),
  214 |       y: await stage.getAttribute('data-inspection-pan-y'),
  215 |     };
  216 |
  217 |     // drag from center by +60, +40 using real page.mouse
  218 |     const centerBox = await readFreshElementBounds(stage);
  219 |     const centerX = centerBox.x + centerBox.width / 2;
  220 |     const centerY = centerBox.y + centerBox.height / 2;
  221 |     await page.mouse.move(centerX, centerY);
  222 |     await page.mouse.down();
  223 |     await page.mouse.move(centerX - 60, centerY - 40, { steps: 6 });
  224 |     await page.mouse.up();
  225 |
  226 |     // should remain zoomed and expose the pan action
  227 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  228 |     await expect(stage).toHaveAttribute('aria-label', 'Pan Ground Glass');
  229 |
  230 |     const postInspectionPan = {
  231 |       x: await stage.getAttribute('data-inspection-pan-x'),
  232 |       y: await stage.getAttribute('data-inspection-pan-y'),
  233 |     };
  234 |     expect(postInspectionPan.x !== preInspectionPan.x || postInspectionPan.y !== preInspectionPan.y).toBeTruthy();
  235 |     await expect(transformedLayer()).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  236 |
  237 |     // assert fixed overlay visibility (preview label)
  238 |     const previewOverlay = viewport.getByText('Ground glass preview');
  239 |     await expect(previewOverlay).toBeVisible();
  240 |     // Ensure exactly one overlay exists before inspecting ancestry to avoid detached-element races
  241 |     await expect(previewOverlay).toHaveCount(1);
  242 |     const isInside = await previewOverlay.evaluate((el) => Boolean((el as Element).closest('.groundglass-stage')));
  243 |     expect(isInside).toBe(false);
  244 |
  245 |     // An ordinary click on the zoomed image is a no-op and preserves the pan.
  246 |     const beforeShortClick = await readStageTransform(transformedLayer());
  247 |     await clickStageAt(page, stage, 0.5, 0.5);
  248 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  249 |     await expect(stage).toHaveAttribute('aria-label', 'Pan Ground Glass');
  250 |     expect(await readStageTransform(transformedLayer())).toEqual(beforeShortClick);
  251 |
  252 |     // The explicit reset control is the only zoom-out affordance.
  253 |     await viewport.getByRole('button', { name: 'Reset Ground Glass view', exact: true }).click();
  254 |     await expect(stage).toHaveAttribute('data-zoomed', 'false');
  255 |
  256 |     // A resized responsive stage maps the same relative pointer location to
  257 |     // the same normalized pan using its new client-box dimensions.
  258 |     await page.setViewportSize({ width: 900, height: 900 });
  259 |     await expect(stage).toBeVisible();
  260 |     expect(await rtt.getAttribute('data-renderer-generation')).toBe(initialHostGeneration);
  261 |     await stage.scrollIntoViewIfNeeded();
  262 |     const resizedClientBox = await readStageClientBox(stage);
  263 |     await page.mouse.click(
  264 |       resizedClientBox.left + resizedClientBox.width * 0.3,
  265 |       resizedClientBox.top + resizedClientBox.height * 0.6,
  266 |     );
  267 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  268 |     await expect.poll(async () => Number(await stage.getAttribute('data-normalized-pan-x'))).toBeCloseTo(0.4, 5);
  269 |     await expect.poll(async () => Number(await stage.getAttribute('data-normalized-pan-y'))).toBeCloseTo(-0.2, 5);
  270 |     await viewport.getByRole('button', { name: 'Reset Ground Glass view', exact: true }).click();
  271 |     await expect(stage).toHaveAttribute('data-zoomed', 'false');
  272 |
  273 |     // read the presentation transform and assert identity — crop state resets separately.
  274 |     await expect.poll(async () => {
  275 |       const t = await readStageTransform(transformedLayer());
  276 |       return Math.abs(t.scaleX - 1) < 0.2 && Math.abs(t.translateX) <= 0.5 && Math.abs(t.translateY) <= 0.5;
> 277 |     }, { timeout: 8000 }).toBeTruthy();
      |                           ^ Error: Test timeout of 120000ms exceeded
  278 |
  279 |     // immediate re-zoom: click at 70% left, 65% top — obtain fresh geometry and use absolute page click
  280 |     const freshBox = await readFreshElementBounds(stage);
  281 |     await page.mouse.click(freshBox.x + freshBox.width * 0.7, freshBox.y + freshBox.height * 0.65);
  282 |
  283 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  284 |     await expect(stage).toHaveAttribute('aria-label', 'Pan Ground Glass');
  285 |
  286 |     // right-bottom click selects the corresponding physical film crop.
  287 |     await expect.poll(async () => {
  288 |       const scaleOk = Number(await stage.getAttribute('data-presentation-css-scale')) === 1;
  289 |       const uOk = Number(await stage.getAttribute('data-focus-loupe-center-u')) > 0.5;
  290 |       const vOk = Number(await stage.getAttribute('data-focus-loupe-center-v')) > 0.5;
  291 |       return scaleOk && uOk && vOk;
  292 |     }, { timeout: 8000 }).toBeTruthy();
  293 |
  294 |     // repeated centered cycles (3x) using real Playwright clicks
  295 |     for (let i = 0; i < 3; i++) {
  296 |       // reset explicitly (a zoomed image click is intentionally inert)
  297 |       await viewport.getByRole('button', { name: 'Reset Ground Glass view', exact: true }).click();
  298 |       await expect(stage).toHaveAttribute('data-zoomed', 'false');
  299 |       await expect.poll(async () => {
  300 |         return Number(await stage.getAttribute('data-focus-loupe-window-width')) === 1;
  301 |       }, { timeout: 8000 }).toBeTruthy();
  302 |
  303 |       // zoom in (center)
  304 |       await clickStageAt(page, stage, 0.5, 0.5);
  305 |       await expect(stage).toHaveAttribute('data-zoomed', 'true');
  306 |       await expect.poll(async () => {
  307 |         return Number(await stage.getAttribute('data-focus-loupe-window-width')) === 0.25;
  308 |       }, { timeout: 8000 }).toBeTruthy();
  309 |     }
  310 |   });
  311 |
  312 |   test('Focus Fundamentals: image zoom and explicit reset smoke test', async ({ page }) => {
  313 |     test.setTimeout(90_000);
  314 |     await page.goto('/simulator/free/focus-fundamentals-two-targets');
  315 |     const viewport = page.getByLabel('GroundGlassViewport');
  316 |     await expect(viewport).toBeVisible();
  317 |     const stage = viewport.locator('[data-zoomed]');
  318 |     await expect(stage).toBeVisible();
  319 |
  320 |     const transformedLayer = transformedLayerFor(viewport);
  321 |
  322 |     const box = await readFreshElementBounds(stage);
  323 |     const cx = Math.round(box.width / 2);
  324 |     const cy = Math.round(box.height / 2);
  325 |
  326 |     // initial
  327 |     await expect(stage).toHaveAttribute('data-zoomed', 'false');
  328 |
  329 |     // click 1
  330 |     await stage.click({ position: { x: cx, y: cy } });
  331 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  332 |     await expect(stage).toHaveAttribute('data-focus-loupe-scale', '4');
  333 |     await expect(stage).toHaveAttribute('data-presentation-css-scale', '1');
  334 |     await expect(stage).toHaveAttribute('data-scale', '1');
  335 |     await expect.poll(
  336 |       async () => Number(await stage.getAttribute('data-focus-loupe-window-width')),
  337 |       { timeout: 15_000 },
  338 |     ).toBeCloseTo(0.25, 2);
  339 |     await expect(transformedLayer()).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  340 |
  341 |     // A second image click does not reset a zoomed stage.
  342 |     await stage.click({ position: { x: cx, y: cy } });
  343 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  344 |     await expect(stage).toHaveAttribute('data-scale', '1');
  345 |     await expect.poll(
  346 |       async () => Number(await stage.getAttribute('data-focus-loupe-window-width')),
  347 |       { timeout: 15_000 },
  348 |     ).toBeCloseTo(0.25, 2);
  349 |
  350 |     // The explicit Reset View control restores the identity transform.
  351 |     await viewport.getByRole('button', { name: 'Reset Ground Glass view', exact: true }).click();
  352 |     await expect(stage).toHaveAttribute('data-zoomed', 'false');
  353 |     await expect(stage).toHaveAttribute('data-scale', '1');
  354 |     await expect(stage).toHaveAttribute('data-focus-loupe-window-width', '1');
  355 |
  356 |     // A subsequent image click can zoom in again.
  357 |     await stage.click({ position: { x: cx, y: cy } });
  358 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  359 |     await expect(stage).toHaveAttribute('data-scale', '1');
  360 |     await expect.poll(
  361 |       async () => Number(await stage.getAttribute('data-focus-loupe-window-width')),
  362 |       { timeout: 15_000 },
  363 |     ).toBeCloseTo(0.25, 2);
  364 |   });
  365 | });
  366 |
```