# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: groundglass-interaction.spec.ts >> Ground Glass interaction >> Architecture Rise: Reset view preserves the contentful RTT resource graph
- Location: src/tests/e2e/groundglass-interaction.spec.ts:22:3

# Error details

```
Error: Test timeout of 180000ms exceeded
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
                            - generic: 8890.0 mm focus / CoC 0.000 mm (100%)
                      - button "Focus loupe · 4× Ground Glass view" [active] [ref=e90] [cursor=pointer]: Focus loupe · 4×
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
                - generic [ref=e136]: Focus 9.0 m
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
                  - 'row "Centre Centre · Building mid facade: 100% · Sharp" [ref=e152]':
                    - cell [ref=e153]
                    - 'cell "Centre Centre · Building mid facade: 100% · Sharp" [ref=e154]':
                      - generic "Centre" [ref=e155]
                      - 'group "Centre · Building mid facade: 100% · Sharp" [ref=e157]':
                        - generic "Building mid facade" [ref=e159]
                        - generic [ref=e160]:
                          - text: 100%
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
                    - slider "Focus distance" [ref=e203]: "8890"
                    - generic [ref=e204]: 8890.0 mm
                    - button "Infinity Reset" [ref=e206] [cursor=pointer]: ∞
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
  59  |     };
  60  |     const expectSameCanvas = async (canvasHandle: NonNullable<Awaited<ReturnType<typeof canvas.elementHandle>>>) => {
  61  |       await expect
  62  |         .poll(() =>
  63  |           page.evaluate(
  64  |             (node) =>
  65  |               node.isConnected &&
  66  |               document.querySelector('[data-testid="ground-glass-rtt"] canvas') === node,
  67  |             canvasHandle,
  68  |           ),
  69  |         )
  70  |         .toBe(true);
  71  |     };
  72  |
  73  |     await expect(viewport).toBeVisible();
  74  |     await expect(canvas).toHaveCount(1);
  75  |     await expectContentfulRtt();
  76  |     await expectCurrentRequestPublished();
  77  |     const canvasHandle = await canvas.elementHandle();
  78  |     if (!canvasHandle) throw new Error('Ground Glass Canvas element was not mounted');
  79  |     const initialGeneration = await rtt.getAttribute('data-rtt-resource-generation');
  80  |     const initialHostGeneration = await rtt.getAttribute('data-renderer-generation');
  81  |     const initialRequestId = await rtt.getAttribute('data-frame-request-id');
  82  |     const initialSanityState = await rtt.getAttribute('data-rtt-sanity-state');
  83  |     expect(initialGeneration).toBeTruthy();
  84  |     expect(initialHostGeneration).toBeTruthy();
  85  |     expect(initialRequestId).toBeTruthy();
  86  |     expect(initialSanityState).toBeTruthy();
  87  |
  88  |     await viewport
  89  |       .getByRole('button', { name: 'Focus loupe · 4× Ground Glass view', exact: true })
  90  |       .click();
  91  |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  92  |     await expect(stage).toHaveAttribute('data-focus-loupe-scale', '4');
  93  |     await expect(stage).toHaveAttribute('data-presentation-css-scale', '1');
  94  |     await expect(stage).toHaveAttribute('data-scale', '1');
  95  |     await expect(stage).toHaveAttribute('data-focus-loupe-window-width', '0.25');
  96  |     await expect(stage).toHaveAttribute('data-focus-loupe-window-height', '0.25');
  97  |     await expect.poll(() => rtt.getAttribute('data-rtt-sampled-film-width-mm'), { timeout: 120_000 }).toBe('31.75');
  98  |     await expect.poll(() => rtt.getAttribute('data-frame-request-id'), { timeout: 120_000 }).not.toBe(initialRequestId);
  99  |     await expectCurrentRequestPublished();
  100 |     expect(await rtt.getAttribute('data-renderer-generation')).toBe(initialHostGeneration);
  101 |     await expect.poll(() => rtt.getAttribute('data-rtt-sanity-state'), { timeout: 120_000 }).not.toBe(initialSanityState);
  102 |     await expectContentfulRtt();
  103 |     const stableLoupeSanityState = await rtt.getAttribute('data-rtt-sanity-state');
  104 |     expect(stableLoupeSanityState).not.toBe(initialSanityState);
  105 |
  106 |     const box = await readFreshElementBounds(stage);
  107 |     const centerX = box.x + box.width / 2;
  108 |     const centerY = box.y + box.height / 2;
  109 |     await page.mouse.move(centerX, centerY);
  110 |     await page.mouse.down();
  111 |     await page.mouse.move(centerX + 60, centerY + 40, { steps: 6 });
  112 |     await page.mouse.up();
  113 |     await expect.poll(async () => {
  114 |       const panX = Number(await stage.getAttribute('data-inspection-pan-x'));
  115 |       const panY = Number(await stage.getAttribute('data-inspection-pan-y'));
  116 |       return Math.abs(panX) > 0 || Math.abs(panY) > 0;
  117 |     }).toBe(true);
  118 |     await expectCurrentRequestPublished();
  119 |     expect(await rtt.getAttribute('data-renderer-generation')).toBe(initialHostGeneration);
  120 |
  121 |     await viewport
  122 |       .getByRole('button', { name: 'Reset Ground Glass view', exact: true })
  123 |       .click();
  124 |     await expect(stage).toHaveAttribute('data-zoomed', 'false');
  125 |     await expect(stage).toHaveAttribute('data-scale', '1');
  126 |     await expect(stage).toHaveAttribute('data-focus-loupe-window-width', '1');
  127 |     await expect(stage).toHaveAttribute('data-focus-loupe-window-height', '1');
  128 |     await expect(stage).toHaveAttribute('data-pan-x', '0');
  129 |     await expect(stage).toHaveAttribute('data-pan-y', '0');
  130 |     await expect(stage).toHaveAttribute('data-dragging', 'false');
  131 |     await expect(stage).toHaveAttribute('data-pointer-active', 'false');
  132 |     await expect(stage).toHaveAttribute('data-pointer-captured', 'false');
  133 |     await expect(transformedLayer).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  134 |     await expectCurrentRequestPublished();
  135 |     expect(await rtt.getAttribute('data-renderer-generation')).toBe(initialHostGeneration);
  136 |     await expect.poll(() => rtt.getAttribute('data-rtt-sanity-state'), { timeout: 120_000 }).toBe(initialSanityState);
  137 |     expect(await rtt.getAttribute('data-rtt-resource-generation')).toBe(initialGeneration);
  138 |     await expectSameCanvas(canvasHandle);
  139 |     await expectContentfulRtt();
  140 |
  141 |     for (let cycle = 0; cycle < 5; cycle += 1) {
  142 |       await viewport
  143 |         .getByRole('button', { name: 'Focus loupe · 4× Ground Glass view', exact: true })
  144 |         .click();
  145 |       await expect(stage).toHaveAttribute('data-zoomed', 'true');
  146 |       await expect(stage).toHaveAttribute('data-scale', '1');
  147 |       await expect(stage).toHaveAttribute('data-focus-loupe-scale', '4');
  148 |       await expect.poll(() => rtt.getAttribute('data-rtt-sanity-state'), { timeout: 120_000 }).toBe(stableLoupeSanityState);
  149 |       await expectContentfulRtt();
  150 |
  151 |       await viewport
  152 |         .getByRole('button', { name: 'Reset Ground Glass view', exact: true })
  153 |         .click();
  154 |       await expect(stage).toHaveAttribute('data-zoomed', 'false');
  155 |       await expect(stage).toHaveAttribute('data-scale', '1');
  156 |       await expect(stage).toHaveAttribute('data-pan-x', '0');
  157 |       await expect(stage).toHaveAttribute('data-pan-y', '0');
  158 |       await expect(transformedLayer).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
> 159 |       await expect.poll(() => rtt.getAttribute('data-rtt-sanity-state'), { timeout: 120_000 }).toBe(initialSanityState);
      |                                                                                                ^ Error: Test timeout of 180000ms exceeded
  160 |       expect(await rtt.getAttribute('data-rtt-resource-generation')).toBe(initialGeneration);
  161 |       await expectSameCanvas(canvasHandle);
  162 |       await expectContentfulRtt();
  163 |     }
  164 |
  165 |     expect(pageErrors, `Uncaught page errors: ${pageErrors.join('\n')}`).toEqual([]);
  166 |     expect(rendererWarnings, `React/Three.js/WebGL warnings: ${rendererWarnings.join('\n')}`).toEqual([]);
  167 |   });
  168 |
  169 |   test('Architecture Rise: off-center anchor, drag pan, short-click preservation, and immediate re-zoom', async ({ page }) => {
  170 |     // allow a longer timeout for this interaction-heavy test to tolerate renderer scheduling in CI/local
  171 |     test.setTimeout(120_000);
  172 |     await page.goto('/simulator/free/architecture-rise');
  173 |
  174 |     const viewport = page.getByLabel('GroundGlassViewport');
  175 |     await expect(viewport).toBeVisible();
  176 |     const rtt = viewport.getByTestId('ground-glass-rtt');
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
```